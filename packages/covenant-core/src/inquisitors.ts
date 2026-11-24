import {
  compileRule,
  compileScope,
  conditionVariables,
  evaluateNormalizedCondition,
  negateNormalizedCondition,
  normalizedConditionKey,
  normalizeCondition,
} from "./condition.js";
import type {
  AnySolverResult,
  CompiledRule,
  Condition,
  CovenantDocument,
  CovenantSolver,
  Finding,
  Inquisitor,
  InquisitorVerdict,
  NonEmpty,
  NormalizedCondition,
  SolveOptions,
  SolverProblem,
  SolverRuleGroup,
  SolverUnknownReason,
  VerificationTelemetry,
  VerificationUnknownReason,
} from "./model.js";
import { cweControls, securityControlVariableNames } from "./security-controls.js";

export interface InquisitorRun<I extends Inquisitor> {
  readonly verdict: InquisitorVerdict<I>;
  readonly telemetry: readonly VerificationTelemetry[];
}

type SolveAttempt =
  | AnySolverResult
  | { readonly status: "ADAPTER_FAILURE" }
  | { readonly status: "BUDGET_EXHAUSTED"; readonly reason: SolverUnknownReason };
const manual = { kind: "manual", reason: "Automatic repair synthesis is deferred to the Chalice task." } as const;

interface ConsistencyAllowance {
  readonly deadline: number;
  readonly signal: AbortSignal | undefined;
  remainingSteps: number;
}

function nonEmpty<T>(values: readonly T[]): NonEmpty<T> {
  const [first, ...rest] = values;
  if (first === undefined) throw new TypeError("Expected at least one item");
  return [first, ...rest];
}

async function solve(
  solver: CovenantSolver,
  problem: SolverProblem,
  options: SolveOptions | undefined,
  telemetry: VerificationTelemetry[],
): Promise<SolveAttempt> {
  try {
    const result = await solver.solve(problem, options);
    telemetry.push(result.telemetry);
    return result;
  } catch {
    return { status: "ADAPTER_FAILURE" };
  }
}

async function solveWithinConsistency(
  solver: CovenantSolver,
  problem: SolverProblem,
  allowance: ConsistencyAllowance,
  telemetry: VerificationTelemetry[],
): Promise<SolveAttempt> {
  if (allowance.signal?.aborted === true) return { status: "BUDGET_EXHAUSTED", reason: "CANCELLED" };
  const remainingMs = allowance.deadline - performance.now();
  if (remainingMs <= 0) return { status: "BUDGET_EXHAUSTED", reason: "TIMEOUT" };
  if (allowance.remainingSteps <= 0) return { status: "BUDGET_EXHAUSTED", reason: "RESOURCE_LIMIT" };
  const nextOptions: SolveOptions = {
    timeoutMs: remainingMs,
    maxSteps: allowance.remainingSteps,
    ...(allowance.signal === undefined ? {} : { signal: allowance.signal }),
  };
  const result = await solve(solver, problem, nextOptions, telemetry);
  if (result.status !== "ADAPTER_FAILURE" && result.status !== "BUDGET_EXHAUSTED") {
    allowance.remainingSteps -= result.telemetry.clausesChecked;
  }
  return result;
}

function consumeCandidate(allowance: ConsistencyAllowance): SolverUnknownReason | null {
  if (allowance.signal?.aborted === true) return "CANCELLED";
  if (performance.now() >= allowance.deadline) return "TIMEOUT";
  allowance.remainingSteps -= 1;
  return allowance.remainingSteps < 0 ? "RESOURCE_LIMIT" : null;
}

function untracked(
  queryId: string,
  document: CovenantDocument,
  constraints: readonly NormalizedCondition[],
): SolverProblem<"NONE"> {
  return { kind: "SUPPORTED", queryId, variables: document.variables, fixedConstraints: constraints, ruleGroups: [], coreTracking: "NONE" };
}

function tracked(
  queryId: string,
  document: CovenantDocument,
  rules: readonly CompiledRule[],
): SolverProblem<"RULES"> {
  const groups = rules.map((rule): SolverRuleGroup => {
    if (rule.hardConsequence === null) throw new TypeError("A tracked Consistency rule must have a hard consequence");
    return {
      ruleId: rule.id,
      constraints: [rule.applicability, rule.hardConsequence],
      consequence: rule.triggeredConsequence,
    };
  });
  const [firstGroup, secondGroup, ...remainingGroups] = groups;
  if (firstGroup === undefined || secondGroup === undefined) throw new TypeError("Consistency candidates require two rules");
  return {
    kind: "SUPPORTED",
    queryId,
    variables: document.variables,
    fixedConstraints: [],
    ruleGroups: [firstGroup, secondGroup, ...remainingGroups],
    coreTracking: "RULES",
  };
}

function unresolvedReason(result: SolveAttempt): VerificationUnknownReason | null {
  if (result.status === "UNKNOWN" || result.status === "BUDGET_EXHAUSTED") return result.reason;
  return result.status === "ADAPTER_FAILURE" ? "ADAPTER_FAILURE" : null;
}

function uniqueReasons(reasons: readonly VerificationUnknownReason[]): readonly VerificationUnknownReason[] {
  return [...new Set(reasons)];
}

function sourceOrderedRules(document: CovenantDocument): readonly CompiledRule[] {
  return document.rules
    .map(compileRule)
    .sort((left, right) => left.source.start.offset - right.source.start.offset || left.id.localeCompare(right.id));
}

function sourceText(document: CovenantDocument, rule: CompiledRule): string {
  return document.source.text.slice(rule.source.start.offset, rule.source.end.offset);
}

export async function runTestability(
  document: CovenantDocument,
  solver: CovenantSolver,
  options?: SolveOptions,
): Promise<InquisitorRun<"TESTABILITY">> {
  const telemetry: VerificationTelemetry[] = [];
  const findings: Finding<"TESTABILITY">[] = [];
  const unresolved: VerificationUnknownReason[] = document.unsupportedConstructs.length > 0 ? ["UNSUPPORTED_THEORY"] : [];
  const compiled = sourceOrderedRules(document);
  const vague = /\b(?:reasonable|appropriate|adequate|promptly|timely|best efforts|as needed)\b/giu;
  for (const rule of compiled) {
    const terms = [...sourceText(document, rule).matchAll(vague)].map((match) => match[0].toLowerCase());
    if (terms.length > 0) {
      findings.push({
        id: `${document.source.id}:testability:${rule.id}`,
        patternId: "VAGUE_LANGUAGE",
        title: "Untestable language",
        message: `Rule ${rule.id} uses language without a measurable condition.`,
        evidence: { kind: "TESTABILITY", source: rule.source, terms: nonEmpty(terms) },
        support: "CUSTOM",
        resolution: manual,
      });
    }
    if (rule.hardConsequence === null) continue;
    const result = await solve(
      solver,
      untracked(`${document.source.id}:testability:${rule.id}`, document, [rule.applicability, rule.hardConsequence]),
      options,
      telemetry,
    );
    const reason = unresolvedReason(result);
    if (reason !== null) unresolved.push(reason);
    if (result.status === "UNSAT") {
      findings.push({
        id: `${document.source.id}:testability:impossible:${rule.id}`,
        patternId: "INTERNALLY_IMPOSSIBLE_RULE",
        title: "Internally impossible rule",
        message: `Rule ${rule.id} cannot satisfy its own applicability and consequence.`,
        evidence: { kind: "TESTABILITY", source: rule.source, terms: ["internally impossible rule"] },
        support: "CUSTOM",
        resolution: manual,
      });
    }
  }
  if (findings.length > 0) {
    return { verdict: { inquisitor: "TESTABILITY", status: "FAIL", findings: nonEmpty(findings), unresolved: uniqueReasons(unresolved) }, telemetry };
  }
  const reasons = uniqueReasons(unresolved);
  return reasons.length > 0
    ? { verdict: { inquisitor: "TESTABILITY", status: "UNKNOWN", findings: [], unresolved: nonEmpty(reasons) }, telemetry }
    : { verdict: { inquisitor: "TESTABILITY", status: "PASS", findings: [], unresolved: [] }, telemetry };
}

function intersects(left: readonly string[], right: readonly string[]): boolean {
  const values = new Set(left);
  return right.some((value) => values.has(value));
}

function dependencyComponents(rules: readonly CompiledRule[]): readonly (readonly CompiledRule[])[] {
  const remaining = new Set(rules);
  const components: CompiledRule[][] = [];
  for (const root of rules) {
    if (!remaining.delete(root)) continue;
    const component = [root];
    for (let cursor = 0; cursor < component.length; cursor += 1) {
      const current = component[cursor];
      if (current === undefined || current.hardConsequence === null) continue;
      const currentHard = conditionVariables(current.hardConsequence);
      for (const candidate of [...remaining]) {
        if (candidate.hardConsequence === null) continue;
        const candidateHard = conditionVariables(candidate.hardConsequence);
        const connected = intersects(currentHard, [...conditionVariables(candidate.applicability), ...candidateHard]) ||
          intersects(candidateHard, [...conditionVariables(current.applicability), ...currentHard]);
        if (connected) {
          remaining.delete(candidate);
          component.push(candidate);
        }
      }
    }
    if (component.length > 1) components.push(component);
  }
  return components;
}

function* combinations<T>(values: readonly T[], size: number): Generator<readonly T[]> {
  function* choose(start: number, selected: readonly T[]): Generator<readonly T[]> {
    if (selected.length === size) {
      yield selected;
      return;
    }
    for (let index = start; index <= values.length - (size - selected.length); index += 1) {
      const value = values[index];
      if (value !== undefined) yield* choose(index + 1, [...selected, value]);
    }
  }
  yield* choose(0, []);
}

export async function runConsistency(
  document: CovenantDocument,
  solver: CovenantSolver,
  options?: SolveOptions,
): Promise<InquisitorRun<"CONSISTENCY">> {
  const telemetry: VerificationTelemetry[] = [];
  const findings: Finding<"CONSISTENCY">[] = [];
  const unresolved: VerificationUnknownReason[] = document.unsupportedConstructs.length > 0 ? ["UNSUPPORTED_THEORY"] : [];
  const allowance: ConsistencyAllowance = {
    deadline: options?.timeoutMs === undefined ? Number.POSITIVE_INFINITY : performance.now() + Math.max(0, options.timeoutMs),
    remainingSteps: options?.maxSteps ?? 100_000,
    signal: options?.signal,
  };
  const eligible: CompiledRule[] = [];
  let halted = false;
  for (const rule of sourceOrderedRules(document).filter((item) => item.hardConsequence !== null)) {
    if (rule.hardConsequence === null) continue;
    const individual = await solveWithinConsistency(
      solver,
      untracked(`${document.source.id}:consistency:individual:${rule.id}`, document, [rule.applicability, rule.hardConsequence]),
      allowance,
      telemetry,
    );
    const reason = unresolvedReason(individual);
    if (reason !== null) unresolved.push(reason);
    if (individual.status === "SAT") eligible.push(rule);
    if (individual.status === "ADAPTER_FAILURE" || individual.status === "BUDGET_EXHAUSTED" || individual.status === "UNKNOWN") {
      halted = true;
      break;
    }
  }
  const coreKeys: string[][] = [];
  candidateSearch: for (const component of dependencyComponents(eligible)) {
    for (let size = 2; size <= component.length; size += 1) {
      for (const candidate of combinations(component, size)) {
        const exhausted = consumeCandidate(allowance);
        if (exhausted !== null) {
          unresolved.push(exhausted);
          halted = true;
          break candidateSearch;
        }
        const ids = candidate.map((rule) => rule.id);
        if (coreKeys.some((core) => core.every((id) => ids.includes(id)))) continue;
        const queryId = `${document.source.id}:consistency:${ids.join("+")}`;
        const applicability = await solveWithinConsistency(
          solver,
          untracked(`${queryId}:applicability`, document, candidate.map((rule) => rule.applicability)),
          allowance,
          telemetry,
        );
        const applicabilityReason = unresolvedReason(applicability);
        if (applicabilityReason !== null) unresolved.push(applicabilityReason);
        if (applicability.status === "ADAPTER_FAILURE" || applicability.status === "BUDGET_EXHAUSTED" || applicability.status === "UNKNOWN") {
          halted = true;
          break candidateSearch;
        }
        if (applicability.status !== "SAT") continue;
        const contradiction = await solveWithinConsistency(solver, tracked(queryId, document, candidate), allowance, telemetry);
        const contradictionReason = unresolvedReason(contradiction);
        if (contradictionReason !== null) unresolved.push(contradictionReason);
        if (contradiction.status === "ADAPTER_FAILURE" || contradiction.status === "BUDGET_EXHAUSTED" || contradiction.status === "UNKNOWN") {
          halted = true;
          break candidateSearch;
        }
        if (contradiction.status !== "UNSAT" || contradiction.core === null) continue;
        const coreRules = candidate.filter((rule) => contradiction.core.ruleIds.includes(rule.id));
        const witnessResult = await solveWithinConsistency(
          solver,
          untracked(`${queryId}:witness`, document, coreRules.map((rule) => rule.applicability)),
          allowance,
          telemetry,
        );
        const witnessReason = unresolvedReason(witnessResult);
        if (witnessReason !== null) unresolved.push(witnessReason);
        if (witnessResult.status === "ADAPTER_FAILURE" || witnessResult.status === "BUDGET_EXHAUSTED" || witnessResult.status === "UNKNOWN") {
          halted = true;
          break candidateSearch;
        }
        if (witnessResult.status !== "SAT") {
          unresolved.push("INVALID_EVIDENCE");
          continue;
        }
        const variables = new Set(coreRules.flatMap((rule) => conditionVariables(rule.applicability)));
        const assignments = witnessResult.model.filter((entry) => variables.has(entry.variable));
        if (!coreRules.every((rule) => evaluateNormalizedCondition(rule.applicability, assignments))) {
          unresolved.push("INVALID_EVIDENCE");
          continue;
        }
        coreKeys.push([...contradiction.core.ruleIds]);
        findings.push({
          id: `${document.source.id}:consistency:${contradiction.core.ruleIds.join("+")}`,
          patternId: "HARD_CONSEQUENCE_CONTRADICTION",
          title: "Consistency Contradiction",
          message: `Rules ${contradiction.core.ruleIds.join(", ")} apply together but require incompatible consequences.`,
          evidence: {
            kind: "CONSISTENCY",
            core: contradiction.core,
            witness: {
              queryId: `${queryId}:witness`,
              coreRuleIds: contradiction.core.ruleIds,
              assignments,
              triggeredConsequences: nonEmpty(contradiction.core.incompatibleConsequences),
            },
          },
          support: "CUSTOM",
          resolution: manual,
        });
      }
    }
  }
  if (halted && unresolved.length === 0) unresolved.push("RESOURCE_LIMIT");
  if (findings.length > 0) {
    return { verdict: { inquisitor: "CONSISTENCY", status: "FAIL", findings: nonEmpty(findings), unresolved: uniqueReasons(unresolved) }, telemetry };
  }
  const reasons = uniqueReasons(unresolved);
  return reasons.length > 0
    ? { verdict: { inquisitor: "CONSISTENCY", status: "UNKNOWN", findings: [], unresolved: nonEmpty(reasons) }, telemetry }
    : { verdict: { inquisitor: "CONSISTENCY", status: "PASS", findings: [], unresolved: [] }, telemetry };
}

export async function runCompleteness(
  document: CovenantDocument,
  solver: CovenantSolver,
  options?: SolveOptions,
): Promise<InquisitorRun<"COMPLETENESS">> {
  const telemetry: VerificationTelemetry[] = [];
  const unresolved: VerificationUnknownReason[] = document.unsupportedConstructs.length > 0 ? ["UNSUPPORTED_THEORY"] : [];
  const uncovered: NormalizedCondition = document.rules.length === 0
    ? { kind: "TRUE" }
    : {
        kind: "ALL",
        conditions: nonEmpty(document.rules.map((rule) => negateNormalizedCondition(compileRule(rule).applicability))),
      };
  const result = await solve(solver, untracked(`${document.source.id}:completeness`, document, [uncovered]), options, telemetry);
  const reason = unresolvedReason(result);
  if (reason !== null) unresolved.push(reason);
  if (result.status === "SAT") {
    const finding: Finding<"COMPLETENESS"> = {
      id: `${document.source.id}:completeness:gap`,
      patternId: "UNCOVERED_INPUT",
      title: "Unhandled input combination",
      message: "The declared input domain contains a combination handled by no rule.",
      evidence: { kind: "COMPLETENESS", assignments: result.model },
      support: "CUSTOM",
      resolution: manual,
    };
    return { verdict: { inquisitor: "COMPLETENESS", status: "FAIL", findings: [finding], unresolved: uniqueReasons(unresolved) }, telemetry };
  }
  const reasons = uniqueReasons(unresolved);
  return reasons.length > 0
    ? { verdict: { inquisitor: "COMPLETENESS", status: "UNKNOWN", findings: [], unresolved: nonEmpty(reasons) }, telemetry }
    : { verdict: { inquisitor: "COMPLETENESS", status: "PASS", findings: [], unresolved: [] }, telemetry };
}

function sameConsequence(left: CompiledRule, right: CompiledRule): boolean {
  return normalizedConditionKey(normalizeCondition(left.triggeredConsequence.consequence)) ===
    normalizedConditionKey(normalizeCondition(right.triggeredConsequence.consequence));
}

export async function runUnambiguity(
  document: CovenantDocument,
  solver: CovenantSolver,
  options?: SolveOptions,
): Promise<InquisitorRun<"UNAMBIGUITY">> {
  const telemetry: VerificationTelemetry[] = [];
  const findings: Finding<"UNAMBIGUITY">[] = [];
  const unresolved: VerificationUnknownReason[] = document.unsupportedConstructs.length > 0 ? ["UNSUPPORTED_THEORY"] : [];
  const rules = sourceOrderedRules(document);
  const originals = new Map(document.rules.map((rule) => [rule.id, rule]));
  for (let leftIndex = 0; leftIndex < rules.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < rules.length; rightIndex += 1) {
      const left = rules[leftIndex];
      const right = rules[rightIndex];
      if (left === undefined || right === undefined || !sameConsequence(left, right)) continue;
      const leftModality = left.triggeredConsequence.modality;
      const rightModality = right.triggeredConsequence.modality;
      const modalConflict = leftModality !== rightModality &&
        (leftModality === "MUST_NOT" || rightModality === "MUST_NOT");
      if (!modalConflict) continue;
      const result = await solve(solver, untracked(`${document.source.id}:unambiguity:${left.id}+${right.id}`, document, [left.applicability, right.applicability]), options, telemetry);
      const reason = unresolvedReason(result);
      if (reason !== null) unresolved.push(reason);
      if (result.status !== "SAT") continue;
      const leftRule = originals.get(left.id);
      const rightRule = originals.get(right.id);
      if (leftRule === undefined || rightRule === undefined) continue;
      const overlap: Condition = {
        kind: "ALL",
        conditions: [compileScope(leftRule.scope), leftRule.activation, compileScope(rightRule.scope), rightRule.activation],
      };
      findings.push({
        id: `${document.source.id}:unambiguity:${left.id}+${right.id}`,
        patternId: "CONFLICTING_MODALITY_OVERLAP",
        title: "Conflicting modal interpretation",
        message: `Rules ${left.id} and ${right.id} have overlapping scope and incompatible modalities for the same consequence.`,
        evidence: { kind: "UNAMBIGUITY", ruleIds: [left.id, right.id], overlap },
        support: "CUSTOM",
        resolution: manual,
      });
    }
  }
  if (findings.length > 0) {
    return { verdict: { inquisitor: "UNAMBIGUITY", status: "FAIL", findings: nonEmpty(findings), unresolved: uniqueReasons(unresolved) }, telemetry };
  }
  const reasons = uniqueReasons(unresolved);
  return reasons.length > 0
    ? { verdict: { inquisitor: "UNAMBIGUITY", status: "UNKNOWN", findings: [], unresolved: nonEmpty(reasons) }, telemetry }
    : { verdict: { inquisitor: "UNAMBIGUITY", status: "PASS", findings: [], unresolved: [] }, telemetry };
}

function implication(rule: CompiledRule): NormalizedCondition | null {
  return rule.hardConsequence === null ? null : {
    kind: "ANY",
    conditions: [negateNormalizedCondition(rule.applicability), rule.hardConsequence],
  };
}

export async function runSecurityLiveness(
  document: CovenantDocument,
  solver: CovenantSolver,
  options?: SolveOptions,
): Promise<InquisitorRun<"SECURITY_LIVENESS">> {
  const telemetry: VerificationTelemetry[] = [];
  const findings: Finding<"SECURITY_LIVENESS">[] = [];
  const unresolved: VerificationUnknownReason[] = document.unsupportedConstructs.length > 0 ? ["UNSUPPORTED_THEORY"] : [];
  const declared = new Set(document.variables.map((variable) => variable.name));
  const rules = sourceOrderedRules(document);
  const hardRules = rules.filter((rule) => rule.hardConsequence !== null);
  const semantics = hardRules.map(implication).filter((condition): condition is NormalizedCondition => condition !== null);
  for (const control of cweControls) {
    const names = securityControlVariableNames(control.id);
    if (!declared.has(names.applies) || !declared.has(names.required)) continue;
    const governedRules = rules.filter((rule) => conditionVariables(rule.applicability).includes(names.applies));
    for (const governed of governedRules) {
      const result = await solve(
        solver,
        untracked(`${document.source.id}:security:${control.id}:${governed.id}`, document, [
          normalizeCondition(control.appliesWhen),
          governed.applicability,
          ...semantics,
          negateNormalizedCondition(normalizeCondition(control.requiredObligation)),
        ]),
        options,
        telemetry,
      );
      const reason = unresolvedReason(result);
      if (reason !== null) unresolved.push(reason);
      if (result.status !== "SAT") continue;
      findings.push({
        id: `${document.source.id}:security:${control.id}:${governed.id}`,
        patternId: `MISSING_${control.id}`,
        title: `${control.id} obligation gap`,
        message: control.evidenceMessage,
        evidence: {
          kind: "SECURITY_LIVENESS",
          category: "SECURITY",
          controlId: control.id,
          governedSource: governed.source,
          ruleIds: [governed.id],
          assignments: result.model,
        },
        support: "CUSTOM",
        resolution: manual,
      });
    }
  }
  for (const workflow of document.primaryWorkflows) {
    if (hardRules.length === 0) continue;
    const workflowConstraints = [
      normalizeCondition(workflow.entry),
      ...workflow.requiredConsequences.map((condition) => normalizeCondition(condition)),
    ];
    const result = await solve(
      solver,
      untracked(`${document.source.id}:liveness:${workflow.id}`, document, [...workflowConstraints, ...semantics]),
      options,
      telemetry,
    );
    const reason = unresolvedReason(result);
    if (reason !== null) unresolved.push(reason);
    if (result.status !== "UNSAT") continue;
    const witnessResult = await solve(
      solver,
      untracked(`${document.source.id}:liveness:${workflow.id}:witness`, document, [normalizeCondition(workflow.entry)]),
      options,
      telemetry,
    );
    const witnessReason = unresolvedReason(witnessResult);
    if (witnessReason !== null) unresolved.push(witnessReason);
    if (witnessResult.status !== "SAT") {
      unresolved.push("INVALID_EVIDENCE");
      continue;
    }
    let blockers = [...hardRules];
    for (let index = blockers.length - 1; index >= 0; index -= 1) {
      const candidate = blockers.filter((_, position) => position !== index);
      const candidateSemantics = candidate.map(implication).filter((condition): condition is NormalizedCondition => condition !== null);
      const reduced = await solve(
        solver,
        untracked(`${document.source.id}:liveness:${workflow.id}:without:${blockers[index]?.id ?? index}`, document, [...workflowConstraints, ...candidateSemantics]),
        options,
        telemetry,
      );
      const reducedReason = unresolvedReason(reduced);
      if (reducedReason !== null) unresolved.push(reducedReason);
      if (reduced.status === "UNSAT") blockers = candidate;
    }
    const ids = blockers.map((rule) => rule.id);
    const governed = blockers[0];
    if (governed === undefined || ids.length === 0) continue;
    const witnessVariables = new Set(conditionVariables(normalizeCondition(workflow.entry)));
    findings.push({
      id: `${document.source.id}:liveness:${workflow.id}`,
      patternId: "PRIMARY_WORKFLOW_DEADLOCK",
      title: "Primary workflow deadlock",
      message: `Cumulative hard rules block the ${workflow.label} workflow.`,
      evidence: {
        kind: "SECURITY_LIVENESS",
        category: "LIVENESS",
        workflowId: workflow.id,
        governedSource: governed.source,
        ruleIds: nonEmpty(ids),
        assignments: witnessResult.model.filter((entry) => witnessVariables.has(entry.variable)),
      },
      support: "CUSTOM",
      resolution: manual,
    });
  }
  if (findings.length > 0) {
    return { verdict: { inquisitor: "SECURITY_LIVENESS", status: "FAIL", findings: nonEmpty(findings), unresolved: uniqueReasons(unresolved) }, telemetry };
  }
  const reasons = uniqueReasons(unresolved);
  return reasons.length > 0
    ? { verdict: { inquisitor: "SECURITY_LIVENESS", status: "UNKNOWN", findings: [], unresolved: nonEmpty(reasons) }, telemetry }
    : { verdict: { inquisitor: "SECURITY_LIVENESS", status: "PASS", findings: [], unresolved: [] }, telemetry };
}

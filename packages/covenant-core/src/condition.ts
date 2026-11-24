import type {
  CompiledRule,
  Condition,
  CovenantDocument,
  NormalizedAtom,
  NormalizedCondition,
  NumericBound,
  Rule,
  RuleFingerprint,
  RuleScope,
  ScopeFacet,
  VariableAssignment,
  VariableDeclaration,
} from "./model.js";
import { compareRationals, isCanonicalRational, stringifyCovenant } from "./rational.js";

const TRUE: NormalizedCondition = { kind: "TRUE" };
const FALSE: NormalizedCondition = { kind: "FALSE" };

export function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

/** Flattens one Boolean level, drops identities, and short-circuits on the absorbing element. */
function combine(kind: "ALL" | "ANY", parts: readonly NormalizedCondition[]): NormalizedCondition {
  const [identity, absorbing] = kind === "ALL" ? [TRUE, FALSE] : [FALSE, TRUE];
  const flat: NormalizedCondition[] = [];
  for (const part of parts) {
    if (part.kind === absorbing.kind) return absorbing;
    if (part.kind === kind) flat.push(...part.conditions);
    else if (part.kind !== identity.kind) flat.push(part);
  }
  const [first, ...rest] = flat;
  if (first === undefined) return identity;
  return rest.length === 0 ? first : { kind, conditions: [first, ...rest] };
}

function normalizeBound(bound: NumericBound, negate: boolean): NormalizedCondition {
  const { variable, domain, lower, upper } = bound;
  const atom = (value: NumericBound): NormalizedCondition => ({ kind: "ATOM", atom: { kind: "NUMERIC", bound: value } });
  if (lower === undefined && upper === undefined) return negate ? FALSE : TRUE;
  if (!negate) return atom(bound);
  const complements: NormalizedCondition[] = [];
  if (lower !== undefined) complements.push(atom({ variable, domain, upper: { value: lower.value, inclusive: !lower.inclusive } }));
  if (upper !== undefined) complements.push(atom({ variable, domain, lower: { value: upper.value, inclusive: !upper.inclusive } }));
  return combine("ANY", complements);
}

/** Removes `NOT`, flattens Boolean composition, and keeps source-stable atom order. */
export function normalizeCondition(condition: Condition, negate = false): NormalizedCondition {
  switch (condition.kind) {
    case "TRUE":
      return negate ? FALSE : TRUE;
    case "FALSE":
      return negate ? TRUE : FALSE;
    case "BOOLEAN":
      return { kind: "ATOM", atom: { ...condition, equals: condition.equals !== negate } };
    case "ENUM":
      return { kind: "ATOM", atom: { ...condition, operator: (condition.operator === "EQ") !== negate ? "EQ" : "NEQ" } };
    case "NUMERIC":
      return normalizeBound(condition.bound, negate);
    case "NOT":
      return normalizeCondition(condition.condition, !negate);
    case "ALL":
    case "ANY": {
      const kind = (condition.kind === "ALL") !== negate ? "ALL" : "ANY";
      return combine(kind, condition.conditions.map((child) => normalizeCondition(child, negate)));
    }
  }
}

function conjoin(parts: readonly Condition[]): Condition {
  const [first, second, ...rest] = parts;
  if (first === undefined) return { kind: "TRUE" };
  return second === undefined ? first : { kind: "ALL", conditions: [first, second, ...rest] };
}

function facetCondition({ variable, values }: ScopeFacet): Condition {
  const [first, second, ...rest] = values.map((value): Condition => ({ kind: "ENUM", variable, operator: "EQ", value }));
  if (first === undefined) return { kind: "FALSE" };
  return second === undefined ? first : { kind: "ANY", conditions: [first, second, ...rest] };
}

/** Compiles a scope into the same `Condition` language used by activations. */
export function compileScope(scope: RuleScope): Condition {
  const facets = [...scope.actors, ...scope.resources, ...scope.actions].map(facetCondition);
  return conjoin(scope.context.kind === "TRUE" ? facets : [...facets, scope.context]);
}

export function compileRule(rule: Rule): CompiledRule {
  const consequence = normalizeCondition(rule.consequence);
  const { modality } = rule;
  return {
    id: rule.id,
    source: rule.source,
    applicability: normalizeCondition(conjoin([compileScope(rule.scope), rule.activation])),
    hardConsequence: modality === "MAY" ? null : modality === "MUST" ? consequence : normalizeCondition(rule.consequence, true),
    permission: modality === "MAY" ? consequence : null,
    triggeredConsequence: { ruleId: rule.id, modality, consequence: rule.consequence },
  };
}

export function negateNormalizedCondition(condition: NormalizedCondition): NormalizedCondition {
  switch (condition.kind) {
    case "TRUE": return FALSE;
    case "FALSE": return TRUE;
    case "ATOM": {
      const atom = condition.atom;
      if (atom.kind === "BOOLEAN") return { kind: "ATOM", atom: { ...atom, equals: !atom.equals } };
      if (atom.kind === "ENUM") return { kind: "ATOM", atom: { ...atom, operator: atom.operator === "EQ" ? "NEQ" : "EQ" } };
      return normalizeBound(atom.bound, true);
    }
    case "ALL": return combine("ANY", condition.conditions.map(negateNormalizedCondition));
    case "ANY": return combine("ALL", condition.conditions.map(negateNormalizedCondition));
  }
}

export function conditionVariables(condition: NormalizedCondition): readonly string[] {
  const found = new Set<string>();
  const visit = (node: NormalizedCondition): void => {
    if (node.kind === "ATOM") found.add(node.atom.kind === "NUMERIC" ? node.atom.bound.variable : node.atom.variable);
    else if (node.kind === "ALL" || node.kind === "ANY") node.conditions.forEach(visit);
  };
  visit(condition);
  return [...found];
}

/** Canonicalizes commutative normalized conditions as collision-free JSON. */
export function normalizedConditionKey(condition: NormalizedCondition): string {
  if (condition.kind === "TRUE" || condition.kind === "FALSE") return stringifyCovenant([condition.kind]);
  if (condition.kind === "ATOM") {
    const atom = condition.atom;
    if (atom.kind === "BOOLEAN") return stringifyCovenant(["BOOLEAN", atom.variable, atom.equals]);
    if (atom.kind === "ENUM") return stringifyCovenant(["ENUM", atom.variable, atom.operator, atom.value]);
    const endpoint = (value: NumericBound["lower"]): readonly unknown[] | null => value === undefined
      ? null
      : [value.value.numerator, value.value.denominator, value.inclusive];
    return stringifyCovenant([
      "NUMERIC",
      atom.bound.variable,
      atom.bound.domain,
      endpoint(atom.bound.lower),
      endpoint(atom.bound.upper),
    ]);
  }
  const children = [...new Set(condition.conditions.map(normalizedConditionKey))].sort();
  return stringifyCovenant([condition.kind, children]);
}

/** Returns the canonical, normalized meaning of an authored condition. */
export function conditionFingerprint(condition: Condition): string {
  return normalizedConditionKey(normalizeCondition(condition));
}

function canonicalFacets(facets: readonly ScopeFacet[]): readonly string[] {
  return [...new Set(facets.map((facet) =>
    stringifyCovenant([facet.variable, [...new Set(facet.values)].sort()])))].sort();
}

/** Excludes identity and source coordinates while retaining complete normalized rule meaning. */
export function ruleSemanticFingerprint(rule: Rule): string {
  return stringifyCovenant([
    [canonicalFacets(rule.scope.actors), canonicalFacets(rule.scope.resources), canonicalFacets(rule.scope.actions), conditionFingerprint(rule.scope.context)],
    conditionFingerprint(rule.activation),
    rule.modality,
    conditionFingerprint(rule.consequence),
  ]);
}

/** Uses the exact source slice and canonical normalized meaning; no opaque hash is involved. */
export function ruleFingerprint(document: CovenantDocument, ruleId: string): RuleFingerprint {
  const rule = document.rules.find((candidate) => candidate.id === ruleId);
  if (rule === undefined) throw new TypeError(`Unknown rule ${ruleId}`);
  return {
    ruleId,
    sourceFingerprint: document.source.text.slice(rule.source.start.offset, rule.source.end.offset),
    semanticFingerprint: ruleSemanticFingerprint(rule),
  };
}

/** Canonical complete post-patch rule sequence, retained in source order. */
export function documentSemanticFingerprint(document: CovenantDocument): string {
  return stringifyCovenant(document.rules.map((rule) => [rule.id, ruleSemanticFingerprint(rule)]));
}

/** Canonical compiled behavior used to reject logically duplicate repair options. */
export function documentBehaviorFingerprint(document: CovenantDocument): string {
  return stringifyCovenant(document.rules.map((rule) => {
    const compiled = compileRule(rule);
    return [
      rule.id,
      normalizedConditionKey(compiled.applicability),
      compiled.hardConsequence === null ? null : normalizedConditionKey(compiled.hardConsequence),
      compiled.permission === null ? null : normalizedConditionKey(compiled.permission),
    ];
  }));
}

function atomValue(atom: NormalizedAtom, assignments: ReadonlyMap<string, VariableAssignment["value"]>): boolean {
  const assigned = assignments.get(atom.kind === "NUMERIC" ? atom.bound.variable : atom.variable);
  if (assigned === undefined) return false;
  if (atom.kind === "BOOLEAN") return assigned.kind === "BOOLEAN" && assigned.value === atom.equals;
  if (atom.kind === "ENUM") {
    return assigned.kind === "ENUM" && (assigned.value === atom.value) === (atom.operator === "EQ");
  }
  if (assigned.kind !== atom.bound.domain) return false;
  const value = assigned.kind === "INTEGER" ? { numerator: assigned.value, denominator: 1n } : assigned.value;
  const { lower, upper } = atom.bound;
  if (lower !== undefined) {
    const comparison = compareRationals(value, lower.value);
    if (comparison < 0 || (comparison === 0 && !lower.inclusive)) return false;
  }
  if (upper !== undefined) {
    const comparison = compareRationals(value, upper.value);
    if (comparison > 0 || (comparison === 0 && !upper.inclusive)) return false;
  }
  return true;
}

export function evaluateNormalizedCondition(
  condition: NormalizedCondition,
  table: readonly VariableAssignment[],
  onStep?: () => void,
): boolean {
  const assignments = new Map<string, VariableAssignment["value"]>();
  for (const entry of table) {
    onStep?.();
    assignments.set(entry.variable, entry.value);
  }
  const evaluate = (node: NormalizedCondition): boolean => {
    onStep?.();
    switch (node.kind) {
      case "TRUE": return true;
      case "FALSE": return false;
      case "ATOM": return atomValue(node.atom, assignments);
      case "ALL": return node.conditions.every(evaluate);
      case "ANY": return node.conditions.some(evaluate);
    }
  };
  return evaluate(condition);
}

export async function evaluateNormalizedConditionsWithBudget(
  conditions: readonly NormalizedCondition[],
  table: readonly VariableAssignment[],
  onStep: () => void | Promise<void>,
): Promise<boolean> {
  const assignments = new Map<string, VariableAssignment["value"]>();
  for (const entry of table) {
    await onStep();
    assignments.set(entry.variable, entry.value);
  }
  const evaluate = async (node: NormalizedCondition): Promise<boolean> => {
    await onStep();
    switch (node.kind) {
      case "TRUE": return true;
      case "FALSE": return false;
      case "ATOM": return atomValue(node.atom, assignments);
      case "ALL":
        for (const child of node.conditions) if (!await evaluate(child)) return false;
        return true;
      case "ANY":
        for (const child of node.conditions) if (await evaluate(child)) return true;
        return false;
    }
  };
  for (const condition of conditions) if (!await evaluate(condition)) return false;
  return true;
}

export function evaluateCondition(condition: Condition, table: readonly VariableAssignment[]): boolean {
  return evaluateNormalizedCondition(normalizeCondition(condition), table);
}

/** Returns the first diagnostic code for an invalid external condition, or `null` when valid. */
export function validateCondition(input: unknown, variables: ReadonlyMap<string, VariableDeclaration>): string | null {
  const node = asRecord(input);
  const kind = node?.["kind"];
  if (node === null || typeof kind !== "string") return "INVALID_CONDITION";
  if (kind === "TRUE" || kind === "FALSE") return null;
  if (kind === "NOT") return validateCondition(node["condition"], variables);
  if (kind === "ALL" || kind === "ANY") {
    const children = node["conditions"];
    if (!Array.isArray(children) || children.length === 0) return "INVALID_CONDITION";
    for (const child of children) {
      const failure = validateCondition(child, variables);
      if (failure !== null) return failure;
    }
    return null;
  }
  if (kind !== "BOOLEAN" && kind !== "ENUM" && kind !== "NUMERIC") return "INVALID_CONDITION";
  const target = kind === "NUMERIC" ? asRecord(node["bound"]) : node;
  const name = target?.["variable"];
  if (target === null || typeof name !== "string") return "INVALID_CONDITION";
  const declaration = variables.get(name);
  if (declaration === undefined) return "UNDECLARED_VARIABLE";
  if (declaration.kind !== kind) return "VARIABLE_KIND_MISMATCH";
  if (kind === "BOOLEAN") return typeof node["equals"] === "boolean" ? null : "INVALID_CONDITION";
  if (declaration.kind === "ENUM") {
    const value = node["value"];
    if (typeof value !== "string" || (node["operator"] !== "EQ" && node["operator"] !== "NEQ")) return "INVALID_CONDITION";
    return declaration.values.includes(value) ? null : "INVALID_ENUM_VALUE";
  }
  if (declaration.kind !== "NUMERIC" || target["domain"] !== declaration.domain) return "VARIABLE_KIND_MISMATCH";
  return validateEndpoints(target);
}

/** Checks optional `lower` and `upper` endpoints of a numeric bound or declared range. */
export function validateEndpoints(range: Record<string, unknown>): string | null {
  for (const side of ["lower", "upper"]) {
    const endpoint = range[side];
    if (endpoint === undefined) continue;
    const record = asRecord(endpoint);
    if (record === null || typeof record["inclusive"] !== "boolean") return "INVALID_CONDITION";
    if (!isCanonicalRational(record["value"])) return "INVALID_RATIONAL";
  }
  return null;
}

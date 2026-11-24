import type {
  AnySolverResult,
  AssignmentTable,
  CanonicalRational,
  CovenantProblem,
  CovenantSolver,
  NormalizedAtom,
  NormalizedCondition,
  NumericDomain,
  NumericRange,
  ScalarValue,
  SolveOptions,
  SolverProblem,
  SolverResult,
  SolverRuleGroup,
  SolverSat,
  SolverUnknown,
  SolverUnknownReason,
  UnsupportedSolverProblem,
  VariableDeclaration,
  VerificationTelemetry,
} from "./model.js";
import { conditionVariables } from "./condition.js";
import {
  absoluteRational,
  addRationals,
  ceilRational,
  compareRationals,
  divideRational,
  floorRational,
  isCanonicalRational,
  makeRational,
  subtractRationals,
} from "./rational.js";

interface SearchState {
  readonly booleans: Map<string, boolean>;
  readonly enums: Map<string, Set<string>>;
  readonly numerics: Map<string, NumericRange>;
}

export interface SearchBudget {
  readonly started: number;
  readonly deadline: number;
  readonly maxSteps: number;
  readonly signal: AbortSignal | undefined;
  steps: number;
}

class BudgetError extends Error {
  constructor(readonly reason: SolverUnknownReason) { super(reason); }
}

const now = (): number => performance.now();
const cloneRange = (range: NumericRange): NumericRange => ({
  ...(range.lower === undefined ? {} : { lower: range.lower }),
  ...(range.upper === undefined ? {} : { upper: range.upper }),
});

function consume(budget: SearchBudget): void {
  if (budget.signal?.aborted === true) throw new BudgetError("CANCELLED");
  if (now() > budget.deadline) throw new BudgetError("TIMEOUT");
  budget.steps += 1;
  if (budget.steps > budget.maxSteps) throw new BudgetError("RESOURCE_LIMIT");
}

function copyState(state: SearchState): SearchState {
  return {
    booleans: new Map(state.booleans),
    enums: new Map([...state.enums].map(([name, values]) => [name, new Set(values)])),
    numerics: new Map([...state.numerics].map(([name, range]) => [name, cloneRange(range)])),
  };
}

function initialState(variables: readonly VariableDeclaration[]): SearchState {
  const enums = new Map<string, Set<string>>();
  const numerics = new Map<string, NumericRange>();
  for (const variable of variables) {
    if (variable.kind === "ENUM") enums.set(variable.name, new Set(variable.values));
    if (variable.kind === "NUMERIC") numerics.set(variable.name, cloneRange(variable.range ?? {}));
  }
  return { booleans: new Map(), enums, numerics };
}

function laterLower(left: NumericRange["lower"], right: NumericRange["lower"]): NumericRange["lower"] {
  if (left === undefined) return right;
  if (right === undefined) return left;
  const comparison = compareRationals(left.value, right.value);
  if (comparison > 0) return left;
  if (comparison < 0) return right;
  return { value: left.value, inclusive: left.inclusive && right.inclusive };
}

function earlierUpper(left: NumericRange["upper"], right: NumericRange["upper"]): NumericRange["upper"] {
  if (left === undefined) return right;
  if (right === undefined) return left;
  const comparison = compareRationals(left.value, right.value);
  if (comparison < 0) return left;
  if (comparison > 0) return right;
  return { value: left.value, inclusive: left.inclusive && right.inclusive };
}

function integerMinimum(range: NumericRange): bigint | null {
  if (range.lower === undefined) return null;
  const exact = range.lower.value.numerator % range.lower.value.denominator === 0n;
  return ceilRational(range.lower.value) + (!range.lower.inclusive && exact ? 1n : 0n);
}

function integerMaximum(range: NumericRange): bigint | null {
  if (range.upper === undefined) return null;
  const exact = range.upper.value.numerator % range.upper.value.denominator === 0n;
  return floorRational(range.upper.value) - (!range.upper.inclusive && exact ? 1n : 0n);
}

function rangeIsEmpty(range: NumericRange, domain: NumericDomain): boolean {
  const { lower, upper } = range;
  if (lower !== undefined && upper !== undefined) {
    const comparison = compareRationals(lower.value, upper.value);
    if (comparison > 0 || (comparison === 0 && (!lower.inclusive || !upper.inclusive))) return true;
  }
  if (domain === "INTEGER") {
    const minimum = integerMinimum(range);
    const maximum = integerMaximum(range);
    return minimum !== null && maximum !== null && minimum > maximum;
  }
  return false;
}

function applyAtom(state: SearchState, atom: NormalizedAtom): SearchState | null {
  const next = copyState(state);
  if (atom.kind === "BOOLEAN") {
    const current = next.booleans.get(atom.variable);
    if (current !== undefined && current !== atom.equals) return null;
    next.booleans.set(atom.variable, atom.equals);
    return next;
  }
  if (atom.kind === "ENUM") {
    const allowed = next.enums.get(atom.variable);
    if (allowed === undefined) return null;
    if (atom.operator === "EQ") {
      if (!allowed.has(atom.value)) return null;
      next.enums.set(atom.variable, new Set([atom.value]));
    } else {
      allowed.delete(atom.value);
      if (allowed.size === 0) return null;
    }
    return next;
  }
  const current = next.numerics.get(atom.bound.variable);
  if (current === undefined) return null;
  const lower = laterLower(current.lower, atom.bound.lower);
  const upper = earlierUpper(current.upper, atom.bound.upper);
  const intersection: NumericRange = {
    ...(lower === undefined ? {} : { lower }),
    ...(upper === undefined ? {} : { upper }),
  };
  if (rangeIsEmpty(intersection, atom.bound.domain)) return null;
  next.numerics.set(atom.bound.variable, intersection);
  return next;
}

function satisfy(condition: NormalizedCondition, state: SearchState, budget: SearchBudget): readonly SearchState[] {
  consume(budget);
  switch (condition.kind) {
    case "TRUE": return [state];
    case "FALSE": return [];
    case "ATOM": {
      const next = applyAtom(state, condition.atom);
      return next === null ? [] : [next];
    }
    case "ANY": return condition.conditions.flatMap((child) => satisfy(child, state, budget));
    case "ALL": {
      let states: readonly SearchState[] = [state];
      for (const child of condition.conditions) {
        states = states.flatMap((candidate) => satisfy(child, candidate, budget));
        if (states.length === 0) break;
      }
      return states;
    }
  }
}

function solveConstraints(
  variables: readonly VariableDeclaration[],
  constraints: readonly NormalizedCondition[],
  budget: SearchBudget,
): SearchState | null {
  let states: readonly SearchState[] = [initialState(variables)];
  for (const condition of constraints) {
    states = states.flatMap((state) => satisfy(condition, state, budget));
    if (states.length === 0) return null;
  }
  return states[0] ?? null;
}

function contains(range: NumericRange, value: CanonicalRational): boolean {
  if (range.lower !== undefined) {
    const comparison = compareRationals(value, range.lower.value);
    if (comparison < 0 || (comparison === 0 && !range.lower.inclusive)) return false;
  }
  if (range.upper !== undefined) {
    const comparison = compareRationals(value, range.upper.value);
    if (comparison > 0 || (comparison === 0 && !range.upper.inclusive)) return false;
  }
  return true;
}

function orderedIncludedEndpoints(range: NumericRange): readonly CanonicalRational[] {
  return [range.lower, range.upper]
    .filter((endpoint): endpoint is NonNullable<typeof endpoint> => endpoint !== undefined && endpoint.inclusive)
    .map((endpoint) => endpoint.value)
    .sort((left, right) => compareRationals(absoluteRational(left), absoluteRational(right)) || compareRationals(left, right));
}

function positiveIntegerCandidate(range: NumericRange): CanonicalRational | null {
  let candidate = 1n;
  if (range.lower !== undefined) {
    const exact = range.lower.value.numerator % range.lower.value.denominator === 0n;
    const first = ceilRational(range.lower.value) + (!range.lower.inclusive && exact ? 1n : 0n);
    if (first > candidate) candidate = first;
  }
  const rational = makeRational(candidate, 1n);
  return contains(range, rational) ? rational : null;
}

function chooseDecimal(range: NumericRange): CanonicalRational {
  const zero = makeRational(0n, 1n);
  const positive = positiveIntegerCandidate(range);
  for (const candidate of [...orderedIncludedEndpoints(range), zero]) if (contains(range, candidate)) return candidate;
  if (positive !== null) return positive;
  if (range.lower !== undefined && range.upper !== undefined) {
    return divideRational(addRationals(range.lower.value, range.upper.value), 2n);
  }
  const one = makeRational(1n, 1n);
  if (range.lower !== undefined) return addRationals(range.lower.value, one);
  if (range.upper !== undefined) return subtractRationals(range.upper.value, one);
  return zero;
}

function chooseInteger(range: NumericRange): bigint {
  const endpoints = orderedIncludedEndpoints(range)
    .filter((candidate) => candidate.denominator === 1n)
    .map((candidate) => candidate.numerator);
  if (endpoints[0] !== undefined) return endpoints[0];
  const zero = makeRational(0n, 1n);
  if (contains(range, zero)) return 0n;
  const positive = positiveIntegerCandidate(range);
  if (positive !== null) return positive.numerator;
  return integerMinimum(range) ?? integerMaximum(range) ?? 0n;
}

function chooseScalar(variable: VariableDeclaration, state: SearchState): ScalarValue {
  if (variable.kind === "BOOLEAN") return { kind: "BOOLEAN", value: state.booleans.get(variable.name) ?? false };
  if (variable.kind === "ENUM") {
    const value = state.enums.get(variable.name)?.values().next().value;
    if (typeof value !== "string") throw new Error(`No value for enum ${variable.name}`);
    return { kind: "ENUM", value };
  }
  const range = state.numerics.get(variable.name) ?? {};
  if (variable.domain === "INTEGER") {
    return { kind: "INTEGER", value: chooseInteger(range) };
  }
  return { kind: "DECIMAL", value: chooseDecimal(range) };
}

function assignment(variables: readonly VariableDeclaration[], state: SearchState): AssignmentTable {
  return variables.map((variable) => ({ variable: variable.name, value: chooseScalar(variable, state) }));
}

function conditionsOf(problem: SolverProblem, groups = problem.ruleGroups): readonly NormalizedCondition[] {
  return [...problem.fixedConstraints, ...groups.flatMap((group) => group.constraints)];
}

function rangeIsWellFormed(range: NumericRange, domain: NumericDomain): boolean {
  const endpoints = [range.lower, range.upper];
  if (endpoints.some((endpoint) => endpoint !== undefined && !isCanonicalRational(endpoint.value))) return false;
  return !rangeIsEmpty(range, domain);
}

function conditionIsWellFormed(condition: NormalizedCondition, declarations: ReadonlyMap<string, VariableDeclaration>): boolean {
  if (condition.kind === "TRUE" || condition.kind === "FALSE") return true;
  if (condition.kind === "ALL" || condition.kind === "ANY") {
    return condition.conditions.length > 0 && condition.conditions.every((child) => conditionIsWellFormed(child, declarations));
  }
  const atom = condition.atom;
  const name = atom.kind === "NUMERIC" ? atom.bound.variable : atom.variable;
  const declaration = declarations.get(name);
  if (atom.kind === "BOOLEAN") return declaration?.kind === "BOOLEAN";
  if (atom.kind === "ENUM") return declaration?.kind === "ENUM" && declaration.values.includes(atom.value);
  return declaration?.kind === "NUMERIC" && declaration.domain === atom.bound.domain && rangeIsWellFormed(atom.bound, atom.bound.domain);
}

export function validateSolverProblem(problem: CovenantProblem): void {
  if (problem.kind === "UNSUPPORTED") return;
  const names = problem.variables.map((variable) => variable.name);
  if (new Set(names).size !== names.length) throw new TypeError("Solver variable names must be unique");
  for (const variable of problem.variables) {
    if (variable.name === "") throw new TypeError("Solver variable names must not be empty");
    if (variable.kind === "ENUM" && (variable.values.length === 0 || new Set(variable.values).size !== variable.values.length)) {
      throw new TypeError(`Enum ${variable.name} must have a unique nonempty domain`);
    }
    if (variable.kind === "NUMERIC" && !rangeIsWellFormed(variable.range ?? {}, variable.domain)) {
      throw new TypeError(`Numeric declaration ${variable.name} has an invalid range`);
    }
  }
  const declarations = new Map(problem.variables.map((variable) => [variable.name, variable]));
  const groups = problem.ruleGroups;
  if (new Set(groups.map((group) => group.ruleId)).size !== groups.length) throw new TypeError("Solver rule IDs must be unique");
  if (groups.some((group) => group.ruleId === "" || group.constraints.length === 0 || group.consequence.ruleId !== group.ruleId)) {
    throw new TypeError("Solver rule groups require matching IDs, consequences, and constraints");
  }
  if (problem.coreTracking === "RULES" && groups.length < 2) throw new TypeError("Tracked problems require at least two rule groups");
  for (const condition of conditionsOf(problem)) {
    if (!conditionIsWellFormed(condition, declarations)) throw new TypeError("Solver condition does not match its declaration");
  }
  for (const group of groups) {
    const variables = group.constraints.flatMap(conditionVariables);
    if (variables.some((name) => !declarations.has(name))) throw new TypeError(`Rule ${group.ruleId} uses an undeclared variable`);
  }
}

export async function minimizeRuleGroups(
  problem: SolverProblem<"RULES">,
  decide: (groups: readonly SolverRuleGroup[]) => Promise<"SAT" | "UNSAT" | "UNKNOWN">,
): Promise<readonly SolverRuleGroup[]> {
  let core = [...problem.ruleGroups];
  for (let index = core.length - 1; index >= 0; index -= 1) {
    if (core.length <= 2) break;
    const candidate = core.filter((_, position) => position !== index);
    if (await decide(candidate) === "UNSAT") core = candidate;
  }
  for (const group of core) {
    const candidate = core.filter((item) => item !== group);
    if (candidate.length >= 2 && await decide(candidate) === "UNSAT") {
      throw new Error("Unsat Core minimization did not reach subset minimality");
    }
  }
  return core;
}

export abstract class BaseCovenantSolver implements CovenantSolver {
  abstract solve(problem: UnsupportedSolverProblem, options?: SolveOptions): Promise<SolverUnknown>;
  abstract solve(problem: SolverProblem<"RULES">, options?: SolveOptions): Promise<SolverResult<"RULES">>;
  abstract solve(problem: SolverProblem<"NONE">, options?: SolveOptions): Promise<SolverResult<"NONE">>;
  abstract solve(problem: CovenantProblem, options?: SolveOptions): Promise<AnySolverResult>;
}

export function createSearchBudget(options: SolveOptions = {}): SearchBudget {
  const started = now();
  return {
    started,
    deadline: options.timeoutMs === undefined ? Number.POSITIVE_INFINITY : started + Math.max(0, options.timeoutMs),
    maxSteps: options.maxSteps ?? 100_000,
    signal: options.signal,
    steps: 0,
  };
}

export function browserTelemetry(budget: SearchBudget): VerificationTelemetry {
  return { solver: "BROWSER_DETERMINISTIC", elapsedMs: now() - budget.started, clausesChecked: budget.steps };
}

export function searchProblem(
  problem: SolverProblem,
  groups: readonly SolverRuleGroup[],
  budget: SearchBudget,
): SolverSat | { readonly status: "UNSAT" } {
  const state = solveConstraints(problem.variables, conditionsOf(problem, groups), budget);
  return state === null ? { status: "UNSAT" } : { status: "SAT", model: assignment(problem.variables, state), telemetry: browserTelemetry(budget) };
}

export function budgetUnknown(error: unknown, budget: SearchBudget): SolverUnknown | null {
  return error instanceof BudgetError ? { status: "UNKNOWN", reason: error.reason, telemetry: browserTelemetry(budget) } : null;
}

import {
  init,
  type Arith,
  type Bool,
  type Context,
  type Model,
} from "z3-solver";
import type {
  AnySolverResult,
  AssignmentTable,
  AtLeastTwo,
  CanonicalRational,
  CovenantProblem,
  NormalizedCondition,
  NumericRange,
  ScalarValue,
  SolveOptions,
  SolverProblem,
  SolverResult,
  SolverRuleGroup,
  SolverUnknown,
  SolverUnknownReason,
  UnsupportedSolverProblem,
  VariableAssignment,
  VerificationTelemetry,
} from "../model.js";
import { makeRational } from "../rational.js";
import {
  assignmentSatisfiesSolverProblem,
  BaseCovenantSolver,
  minimizeRuleGroups,
  solverProblemConstraints,
  validateSolverProblem,
} from "../solver.js";

type CovenantZ3Context = Context<"covenant">;
type CovenantZ3Bool = Bool<"covenant">;
type CovenantZ3Arith = Arith<"covenant">;
type CovenantZ3Model = Model<"covenant">;

interface NodeBudget {
  readonly started: number;
  readonly deadline: number;
  readonly maxSteps: number;
  readonly signal: AbortSignal | undefined;
  steps: number;
}

interface Z3SatDecision {
  readonly status: "SAT";
  readonly model: AssignmentTable;
}

interface Z3UnsatDecision {
  readonly status: "UNSAT";
}

interface Z3UnknownDecision {
  readonly status: "UNKNOWN";
  readonly reason: SolverUnknownReason;
}

type Z3Decision = Z3SatDecision | Z3UnsatDecision | Z3UnknownDecision;

class NodeBudgetError extends Error {
  constructor(readonly reason: SolverUnknownReason) {
    super(reason);
  }
}

let initializedZ3: ReturnType<typeof init> | undefined;

function getZ3(): ReturnType<typeof init> {
  initializedZ3 ??= init();
  return initializedZ3;
}

function createNodeBudget(options: SolveOptions): NodeBudget {
  const started = performance.now();
  return {
    started,
    deadline: options.timeoutMs === undefined
      ? Number.POSITIVE_INFINITY
      : started + Math.max(0, options.timeoutMs),
    maxSteps: options.maxSteps ?? 100_000,
    signal: options.signal,
    steps: 0,
  };
}

function consume(budget: NodeBudget, count = 1): void {
  if (budget.signal?.aborted === true) throw new NodeBudgetError("CANCELLED");
  if (performance.now() >= budget.deadline) throw new NodeBudgetError("TIMEOUT");
  budget.steps += count;
  if (budget.steps > budget.maxSteps) throw new NodeBudgetError("RESOURCE_LIMIT");
}

function awaitWithinBudget<T>(
  promise: Promise<T>,
  budget: NodeBudget,
  interrupt?: () => void,
): Promise<T> {
  consume(budget, 0);
  return new Promise<T>((resolve, reject) => {
    let settled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const signal = budget.signal;
    const cleanup = (): void => {
      if (timer !== undefined) clearTimeout(timer);
      signal?.removeEventListener("abort", onAbort);
    };
    const fail = (reason: SolverUnknownReason): void => {
      if (settled) return;
      settled = true;
      cleanup();
      interrupt?.();
      reject(new NodeBudgetError(reason));
    };
    const onAbort = (): void => fail("CANCELLED");
    signal?.addEventListener("abort", onAbort, { once: true });
    if (Number.isFinite(budget.deadline)) {
      const remaining = budget.deadline - performance.now();
      if (remaining <= 0) {
        fail("TIMEOUT");
        return;
      }
      timer = setTimeout(() => fail("TIMEOUT"), remaining);
    }
    promise.then(
      (value) => {
        if (settled) return;
        settled = true;
        cleanup();
        resolve(value);
      },
      (error: unknown) => {
        if (settled) return;
        settled = true;
        cleanup();
        reject(error);
      },
    );
  });
}

function telemetry(budget: NodeBudget): VerificationTelemetry {
  return {
    solver: "NODE_Z3",
    elapsedMs: performance.now() - budget.started,
    clausesChecked: budget.steps,
  };
}

function symbol(...parts: readonly string[]): string {
  return parts.map((part) => `${part.length}:${part}`).join("|");
}

function rationalValue(value: CanonicalRational): { readonly numerator: bigint; readonly denominator: bigint } {
  return { numerator: value.numerator, denominator: value.denominator };
}

class ProblemEncoder {
  private readonly booleans = new Map<string, CovenantZ3Bool>();
  private readonly enums = new Map<string, ReadonlyMap<string, CovenantZ3Bool>>();
  private readonly numerics = new Map<string, CovenantZ3Arith>();
  readonly domainConstraints: readonly CovenantZ3Bool[];

  constructor(
    private readonly context: CovenantZ3Context,
    private readonly problem: SolverProblem,
    budget: NodeBudget,
  ) {
    const constraints: CovenantZ3Bool[] = [];
    for (const declaration of problem.variables) {
      consume(budget);
      if (declaration.kind === "BOOLEAN") {
        this.booleans.set(declaration.name, context.Bool.const(symbol("boolean", declaration.name)));
        continue;
      }
      if (declaration.kind === "ENUM") {
        const values = new Map<string, CovenantZ3Bool>();
        for (const value of declaration.values) {
          consume(budget);
          values.set(value, context.Bool.const(symbol("enum", declaration.name, value)));
        }
        this.enums.set(declaration.name, values);
        const alternatives = [...values.values()];
        consume(budget);
        constraints.push(context.Or(...alternatives));
        for (let left = 0; left < alternatives.length; left += 1) {
          for (let right = left + 1; right < alternatives.length; right += 1) {
            consume(budget);
            const leftValue = alternatives[left];
            const rightValue = alternatives[right];
            if (leftValue !== undefined && rightValue !== undefined) {
              constraints.push(context.Or(leftValue.not(), rightValue.not()));
            }
          }
        }
        continue;
      }
      const variable = declaration.domain === "INTEGER"
        ? context.Int.const(symbol("integer", declaration.name))
        : context.Real.const(symbol("decimal", declaration.name));
      this.numerics.set(declaration.name, variable);
      constraints.push(...this.range(variable, declaration.range ?? {}, declaration.domain));
    }
    this.domainConstraints = constraints;
  }

  condition(condition: NormalizedCondition, budget: NodeBudget): CovenantZ3Bool {
    consume(budget);
    switch (condition.kind) {
      case "TRUE":
        return this.context.Bool.val(true);
      case "FALSE":
        return this.context.Bool.val(false);
      case "ALL":
        return this.context.And(...condition.conditions.map((child) => this.condition(child, budget)));
      case "ANY":
        return this.context.Or(...condition.conditions.map((child) => this.condition(child, budget)));
      case "ATOM": {
        const { atom } = condition;
        if (atom.kind === "BOOLEAN") {
          const variable = this.booleans.get(atom.variable);
          if (variable === undefined) throw new TypeError(`Missing Boolean declaration ${atom.variable}`);
          return atom.equals ? variable : variable.not();
        }
        if (atom.kind === "ENUM") {
          const variable = this.enums.get(atom.variable)?.get(atom.value);
          if (variable === undefined) throw new TypeError(`Missing enum value ${atom.variable}.${atom.value}`);
          return atom.operator === "EQ" ? variable : variable.not();
        }
        const variable = this.numerics.get(atom.bound.variable);
        if (variable === undefined) throw new TypeError(`Missing numeric declaration ${atom.bound.variable}`);
        const bounds = this.range(variable, atom.bound, atom.bound.domain);
        return bounds.length === 0 ? this.context.Bool.val(true) : this.context.And(...bounds);
      }
    }
  }

  assignment(model: CovenantZ3Model, budget: NodeBudget): AssignmentTable {
    return this.problem.variables.map((declaration): VariableAssignment => {
      consume(budget);
      let value: ScalarValue;
      if (declaration.kind === "BOOLEAN") {
        const variable = this.booleans.get(declaration.name);
        if (variable === undefined) throw new Error(`Missing Boolean model variable ${declaration.name}`);
        const evaluated = model.eval(variable, true);
        if (!this.context.isTrue(evaluated) && !this.context.isFalse(evaluated)) {
          throw new Error(`Z3 returned a non-Boolean value for ${declaration.name}`);
        }
        value = { kind: "BOOLEAN", value: this.context.isTrue(evaluated) };
      } else if (declaration.kind === "ENUM") {
        const values = this.enums.get(declaration.name);
        const selected = declaration.values.find((candidate) => {
          const variable = values?.get(candidate);
          return variable !== undefined && this.context.isTrue(model.eval(variable, true));
        });
        if (selected === undefined) throw new Error(`Z3 returned no enum value for ${declaration.name}`);
        value = { kind: "ENUM", value: selected };
      } else {
        const variable = this.numerics.get(declaration.name);
        if (variable === undefined) throw new Error(`Missing numeric model variable ${declaration.name}`);
        const evaluated = model.eval(variable, true);
        if (declaration.domain === "INTEGER") {
          if (!this.context.isIntVal(evaluated)) throw new Error(`Z3 returned a non-integer value for ${declaration.name}`);
          value = { kind: "INTEGER", value: evaluated.value() };
        } else {
          if (!this.context.isRealVal(evaluated)) throw new Error(`Z3 returned a non-rational value for ${declaration.name}`);
          const rational = evaluated.value();
          value = { kind: "DECIMAL", value: makeRational(rational.numerator, rational.denominator) };
        }
      }
      return { variable: declaration.name, value };
    });
  }

  private range(
    variable: CovenantZ3Arith,
    range: NumericRange,
    domain: "INTEGER" | "DECIMAL",
  ): readonly CovenantZ3Bool[] {
    const constraints: CovenantZ3Bool[] = [];
    const comparable = domain === "INTEGER" ? this.context.ToReal(variable) : variable;
    if (range.lower !== undefined) {
      const value = rationalValue(range.lower.value);
      constraints.push(range.lower.inclusive ? comparable.ge(value) : comparable.gt(value));
    }
    if (range.upper !== undefined) {
      const value = rationalValue(range.upper.value);
      constraints.push(range.upper.inclusive ? comparable.le(value) : comparable.lt(value));
    }
    return constraints;
  }
}

function remainingTimeout(budget: NodeBudget): number | null {
  if (!Number.isFinite(budget.deadline)) return null;
  return Math.max(1, Math.floor(budget.deadline - performance.now()));
}

async function decide(
  context: CovenantZ3Context,
  encoder: ProblemEncoder,
  problem: SolverProblem,
  groups: readonly SolverRuleGroup[],
  budget: NodeBudget,
): Promise<Z3Decision> {
  consume(budget, encoder.domainConstraints.length);
  const solver = new context.Solver();
  solver.add(...encoder.domainConstraints);
  for (const condition of solverProblemConstraints(problem, groups)) {
    solver.add(encoder.condition(condition, budget));
  }
  const timeout = remainingTimeout(budget);
  if (timeout !== null) solver.set("timeout", timeout);
  const status = await awaitWithinBudget(solver.check(), budget, () => context.interrupt());
  consume(budget, 0);
  if (status === "unsat") return { status: "UNSAT" };
  if (status === "unknown") {
    return { status: "UNKNOWN", reason: timeout === null ? "RESOURCE_LIMIT" : "TIMEOUT" };
  }
  const z3Model = solver.model();
  consume(budget, 0);
  const model = encoder.assignment(z3Model, budget);
  consume(budget, 0);
  let replaySteps = 0;
  const replays = await assignmentSatisfiesSolverProblem(
    problem,
    model,
    groups,
    async () => {
      consume(budget);
      replaySteps += 1;
      if (replaySteps % 256 === 0) {
        await new Promise<void>((resolve) => setTimeout(resolve, 0));
        consume(budget, 0);
      }
    },
  );
  consume(budget, 0);
  if (!replays) {
    throw new Error("Z3 returned an assignment that does not replay against the SolverProblem");
  }
  return { status: "SAT", model };
}

export class NodeZ3Solver extends BaseCovenantSolver {
  solve(problem: UnsupportedSolverProblem, options?: SolveOptions): Promise<SolverUnknown>;
  solve(problem: SolverProblem<"RULES">, options?: SolveOptions): Promise<SolverResult<"RULES">>;
  solve(problem: SolverProblem<"NONE">, options?: SolveOptions): Promise<SolverResult<"NONE">>;
  async solve(problem: CovenantProblem, options: SolveOptions = {}): Promise<AnySolverResult> {
    const budget = createNodeBudget(options);
    if (problem.kind === "UNSUPPORTED") {
      return {
        status: "UNKNOWN",
        reason: options.signal?.aborted === true ? "CANCELLED" : "UNSUPPORTED_THEORY",
        telemetry: telemetry(budget),
      };
    }
    validateSolverProblem(problem);
    try {
      consume(budget, 0);
      const api = await awaitWithinBudget(getZ3(), budget);
      consume(budget, 0);
      const context = new api.Context("covenant");
      const encoder = new ProblemEncoder(context, problem, budget);
      if (problem.coreTracking === "RULES") {
        const fixed = await decide(context, encoder, problem, [], budget);
        if (fixed.status === "UNKNOWN") return { ...fixed, telemetry: telemetry(budget) };
        if (fixed.status === "UNSAT") throw new TypeError("Tracked problem fixed constraints must be satisfiable");
        for (const group of problem.ruleGroups) {
          const individual = await decide(context, encoder, problem, [group], budget);
          if (individual.status === "UNKNOWN") return { ...individual, telemetry: telemetry(budget) };
          if (individual.status === "UNSAT") {
            throw new TypeError(`Tracked rule group ${group.ruleId} is internally unsatisfiable`);
          }
        }
      }
      const result = await decide(context, encoder, problem, problem.ruleGroups, budget);
      if (result.status === "SAT") return { ...result, telemetry: telemetry(budget) };
      if (result.status === "UNKNOWN") return { ...result, telemetry: telemetry(budget) };
      if (problem.coreTracking === "NONE") {
        return { status: "UNSAT", core: null, telemetry: telemetry(budget) };
      }
      const trackedProblem = { ...problem, coreTracking: "RULES" } satisfies SolverProblem<"RULES">;
      const groups = await minimizeRuleGroups(trackedProblem, async (candidate) => {
        const candidateResult = await decide(context, encoder, trackedProblem, candidate, budget);
        if (candidateResult.status === "UNKNOWN") {
          throw new NodeBudgetError(candidateResult.reason);
        }
        return candidateResult.status;
      });
      const [firstId, secondId, ...remainingIds] = groups.map((group) => group.ruleId);
      if (firstId === undefined || secondId === undefined) {
        throw new TypeError("Tracked Unsat Core requires at least two rules");
      }
      const ruleIds: AtLeastTwo<string> = [firstId, secondId, ...remainingIds];
      return {
        status: "UNSAT",
        core: {
          queryId: problem.queryId,
          ruleIds,
          incompatibleConsequences: groups.map((group) => group.consequence),
        },
        telemetry: telemetry(budget),
      };
    } catch (error) {
      if (error instanceof NodeBudgetError) {
        return { status: "UNKNOWN", reason: error.reason, telemetry: telemetry(budget) };
      }
      throw error;
    }
  }
}

import type {
  AnySolverResult,
  AtLeastTwo,
  CovenantProblem,
  SolveOptions,
  SolverProblem,
  SolverResult,
  SolverUnknown,
  UnsupportedSolverProblem,
} from "./model.js";
import {
  BaseCovenantSolver,
  browserTelemetry,
  budgetUnknown,
  createSearchBudget,
  minimizeRuleGroups,
  searchProblem,
  validateSolverProblem,
} from "./solver.js";

export class BrowserDeterministicSolver extends BaseCovenantSolver {
  solve(problem: UnsupportedSolverProblem, options?: SolveOptions): Promise<SolverUnknown>;
  solve(problem: SolverProblem<"RULES">, options?: SolveOptions): Promise<SolverResult<"RULES">>;
  solve(problem: SolverProblem<"NONE">, options?: SolveOptions): Promise<SolverResult<"NONE">>;
  async solve(problem: CovenantProblem, options: SolveOptions = {}): Promise<AnySolverResult> {
    const budget = createSearchBudget(options);
    if (problem.kind === "UNSUPPORTED") {
      return {
        status: "UNKNOWN",
        reason: options.signal?.aborted === true ? "CANCELLED" : "UNSUPPORTED_THEORY",
        telemetry: browserTelemetry(budget),
      };
    }
    validateSolverProblem(problem);
    try {
      if (problem.coreTracking === "RULES") {
        if (searchProblem(problem, [], budget).status === "UNSAT") {
          throw new TypeError("Tracked problem fixed constraints must be satisfiable");
        }
        for (const group of problem.ruleGroups) {
          if (searchProblem(problem, [group], budget).status === "UNSAT") {
            throw new TypeError(`Tracked rule group ${group.ruleId} is internally unsatisfiable`);
          }
        }
      }
      const result = searchProblem(problem, problem.ruleGroups, budget);
      if (result.status === "SAT") return { ...result, telemetry: browserTelemetry(budget) };
      if (problem.coreTracking === "NONE") return { status: "UNSAT", core: null, telemetry: browserTelemetry(budget) };
      const trackedProblem = { ...problem, coreTracking: "RULES" } satisfies SolverProblem<"RULES">;
      const groups = await minimizeRuleGroups(trackedProblem, async (candidate) => searchProblem(trackedProblem, candidate, budget).status);
      const [firstId, secondId, ...remainingIds] = groups.map((group) => group.ruleId);
      if (firstId === undefined || secondId === undefined) throw new TypeError("Tracked Unsat Core requires at least two rules");
      const ruleIds: AtLeastTwo<string> = [firstId, secondId, ...remainingIds];
      return {
        status: "UNSAT",
        core: {
          queryId: problem.queryId,
          ruleIds,
          incompatibleConsequences: groups.map((group) => group.consequence),
        },
        telemetry: browserTelemetry(budget),
      };
    } catch (error) {
      const unknown = budgetUnknown(error, budget);
      if (unknown !== null) return unknown;
      throw error;
    }
  }
}

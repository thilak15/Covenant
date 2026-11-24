import fc from "fast-check";
import { afterAll, describe, expect, it } from "vitest";
import {
  BrowserDeterministicSolver,
  assignmentSatisfiesSolverProblem,
  stringifyCovenant,
  type AnySolverResult,
  type SolverProblem,
} from "../../src/index.js";
import { NodeZ3Solver } from "../../src/node/index.js";
import { solverCaseArbitrary } from "./arbitraries.js";
import { OPEN_PBT_SEED, PBTStatsRecorder } from "./stats-recorder.js";

const NUM_RUNS = 200;
const stats = new PBTStatsRecorder("SOLVER_EQUIVALENCE");
afterAll(async () => stats.write());

async function solve(
  problem: SolverProblem<"RULES"> | SolverProblem<"NONE">,
): Promise<readonly [AnySolverResult, AnySolverResult]> {
  const browser = new BrowserDeterministicSolver();
  const node = new NodeZ3Solver();
  if (problem.coreTracking === "RULES") {
    return Promise.all([browser.solve(problem), node.solve(problem)]);
  }
  return Promise.all([browser.solve(problem), node.solve(problem)]);
}

function problemFingerprint(problem: SolverProblem<"RULES"> | SolverProblem<"NONE">): string {
  return stringifyCovenant({
    variables: problem.variables,
    fixedConstraints: problem.fixedConstraints,
    ruleGroups: problem.ruleGroups,
    coreTracking: problem.coreTracking,
  });
}

describe("Solver Equivalence property", () => {
  it("matches status and canonical tracked cores and replays every SAT assignment", async () => {
    stats.requestRuns(NUM_RUNS);
    await fc.assert(fc.asyncProperty(solverCaseArbitrary, async ({ problem, tag }) => {
      await stats.record(tag, problemFingerprint(problem), async () => {
        const [browser, node] = await solve(problem);
        expect(node.status, tag).toBe(browser.status);
        if (browser.status === "UNSAT" && node.status === "UNSAT") {
          if (problem.coreTracking === "RULES") {
            expect(browser.core?.ruleIds).toEqual(node.core?.ruleIds);
          } else {
            expect(browser.core).toBeNull();
            expect(node.core).toBeNull();
          }
        }
        if (browser.status === "SAT") {
          await expect(assignmentSatisfiesSolverProblem(problem, browser.model)).resolves.toBe(true);
        }
        if (node.status === "SAT") {
          await expect(assignmentSatisfiesSolverProblem(problem, node.model)).resolves.toBe(true);
        }
      });
    }), { numRuns: NUM_RUNS, seed: OPEN_PBT_SEED });
  }, 120_000);
});

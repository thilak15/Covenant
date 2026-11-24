import fc from "fast-check";
import { afterAll, describe, expect, it } from "vitest";
import {
  BrowserDeterministicSolver,
  compileRule,
  documentBehaviorFingerprint,
  evaluateNormalizedCondition,
  verifyCovenant,
  type SolverProblem,
} from "../../src/index.js";
import { mutuallyExclusiveDocumentArbitrary, soundnessCaseArbitrary } from "./arbitraries.js";
import { OPEN_PBT_SEED, PBTStatsRecorder } from "./stats-recorder.js";

const NUM_RUNS = 200;
const stats = new PBTStatsRecorder("SOUNDNESS");
afterAll(async () => stats.write());

describe("Soundness property", () => {
  it("proves jointly applicable direct and consequence-to-applicability contradictions with minimal replayable cores", async () => {
    stats.requestRuns(NUM_RUNS);
    await fc.assert(fc.asyncProperty(soundnessCaseArbitrary, async ({ document, tag }) => {
      await stats.record(tag, documentBehaviorFingerprint(document), async () => {
        const solver = new BrowserDeterministicSolver();
        const report = await verifyCovenant(document, solver);
        const verdict = report.verdicts[1];
        expect(verdict.status, tag).toBe("FAIL");
        if (verdict.status !== "FAIL") return;
        const finding = verdict.findings[0];
        const { core, witness } = finding.evidence;
        expect(core.ruleIds.length).toBeGreaterThanOrEqual(2);
        expect(witness.coreRuleIds).toEqual(core.ruleIds);

        const coreRules = core.ruleIds.map((id) => {
          const rule = document.rules.find((candidate) => candidate.id === id);
          if (rule === undefined) throw new Error(`Missing generated core rule ${id}`);
          return compileRule(rule);
        });
        expect(coreRules.every((rule) => evaluateNormalizedCondition(rule.applicability, witness.assignments))).toBe(true);

        for (const removed of core.ruleIds) {
          const remaining = coreRules.filter((rule) => rule.id !== removed);
          const problem: SolverProblem<"NONE"> = {
            kind: "SUPPORTED",
            queryId: `${core.queryId}:without:${removed}`,
            variables: document.variables,
            fixedConstraints: remaining.flatMap((rule) => [
              rule.applicability,
              ...(rule.hardConsequence === null ? [] : [rule.hardConsequence]),
            ]),
            ruleGroups: [],
            coreTracking: "NONE",
          };
          const result = await solver.solve(problem);
          expect(result.status).toBe("SAT");
        }
      });
    }), { numRuns: NUM_RUNS, seed: OPEN_PBT_SEED });
  }, 60_000);

  it("never reports mutually exclusive applicability as a Consistency Contradiction", async () => {
    stats.requestRuns(NUM_RUNS);
    await fc.assert(fc.asyncProperty(mutuallyExclusiveDocumentArbitrary, async (document) => {
      await stats.record("MUTUALLY_EXCLUSIVE", documentBehaviorFingerprint(document), async () => {
        const report = await verifyCovenant(document, new BrowserDeterministicSolver());
        expect(report.verdicts[1].status).toBe("PASS");
      });
    }), { numRuns: NUM_RUNS, seed: OPEN_PBT_SEED });
  }, 60_000);
});

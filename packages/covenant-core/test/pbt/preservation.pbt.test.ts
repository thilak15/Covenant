import fc from "fast-check";
import { afterAll, describe, expect, it } from "vitest";
import {
  BrowserDeterministicSolver,
  applyChalicePatch,
  documentBehaviorFingerprint,
  ruleFingerprint,
  verifyCovenant,
} from "../../src/index.js";
import { repairDocumentArbitrary } from "./arbitraries.js";
import { OPEN_PBT_SEED, PBTStatsRecorder } from "./stats-recorder.js";

const NUM_RUNS = 200;
const stats = new PBTStatsRecorder("PRESERVATION");
afterAll(async () => stats.write());

describe("Preservation property", () => {
  it("fixes generated conflict sets while preserving every independent rule", async () => {
    stats.requestRuns(NUM_RUNS);
    await fc.assert(fc.asyncProperty(repairDocumentArbitrary, fc.boolean(), async (document, chooseB) => {
      const inputFingerprint = `${documentBehaviorFingerprint(document)}|chalice:${chooseB ? "B" : "A"}`;
      await stats.record(chooseB ? "CHALICE_B" : "CHALICE_A", inputFingerprint, async () => {
        const report = await verifyCovenant(document, new BrowserDeterministicSolver());
        const consistency = report.verdicts[1];
        expect(consistency.status).toBe("FAIL");
        if (consistency.status !== "FAIL") return;
        const finding = consistency.findings[0];
        expect(finding.resolution.kind).toBe("pair");
        if (finding.resolution.kind !== "pair") return;
        const patch = finding.resolution.patches[chooseB ? 1 : 0];
        const unrelated = ruleFingerprint(document, "R3");

        const applied = await applyChalicePatch(document, patch, new BrowserDeterministicSolver());
        expect(applied.status).toBe("APPLIED");
        if (applied.status !== "APPLIED") return;
        expect(applied.report.verdicts[1].status).toBe("PASS");
        expect(applied.proof.conflictFixed).toBe(true);
        expect(applied.proof.preservationPercent).toBe(100);
        expect(applied.proof.preservedRules).toEqual([unrelated]);
        expect(ruleFingerprint(applied.document, "R3")).toEqual(unrelated);
      });
    }), { numRuns: NUM_RUNS, seed: OPEN_PBT_SEED });
  }, 60_000);
});

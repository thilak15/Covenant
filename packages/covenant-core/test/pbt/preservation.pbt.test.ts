import fc from "fast-check";
import { describe, expect, it } from "vitest";
import {
  BrowserDeterministicSolver,
  applyChalicePatch,
  ruleFingerprint,
  verifyCovenant,
} from "../../src/index.js";
import { repairDocumentArbitrary } from "./arbitraries.js";

const NUM_RUNS = 200;

describe("Preservation property", () => {
  it("fixes generated conflict sets while preserving every independent rule", async () => {
    await fc.assert(fc.asyncProperty(repairDocumentArbitrary, fc.boolean(), async (document, chooseB) => {
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
    }), { numRuns: NUM_RUNS });
  }, 60_000);
});

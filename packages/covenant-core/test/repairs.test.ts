import { describe, expect, it } from "vitest";
import {
  BrowserDeterministicSolver,
  applyChalicePatch,
  documentBehaviorFingerprint,
  findingFingerprint,
  ruleFingerprint,
  ruleSemanticFingerprint,
  verifyCovenant,
  type AnySolverResult,
  type ChalicePair,
  type ChalicePatch,
  type CovenantDocument,
  type CovenantProblem,
  type CovenantSolver,
  type Finding,
  type Inquisitor,
  type SolveOptions,
  type SolverProblem,
  type SolverResult,
  type SolverUnknown,
  type UnsupportedSolverProblem,
  type VerificationReport,
} from "../src/index.js";
import { cursedScrolls } from "./fixtures/cursed-scrolls.js";
import {
  coveredCustomSecurityDocument,
  customRepairDocument,
  securityVariantDocuments,
  standardLivenessDocument,
  standardRepairDocument,
  standardSecurityDocument,
  standardUnambiguityDocument,
  unresolvedRepairDocument,
} from "./fixtures/repair-documents.js";

function consistencyFinding(report: VerificationReport) {
  const verdict = report.verdicts[1];
  if (verdict.status !== "FAIL") throw new Error("Expected a Consistency finding");
  const finding = verdict.findings[0];
  if (finding === undefined) throw new Error("Expected a Consistency finding");
  return finding;
}

function pairFrom(report: VerificationReport): ChalicePair {
  const finding = consistencyFinding(report);
  if (finding.resolution.kind !== "pair") throw new Error("Expected a ChalicePair");
  return finding.resolution.patches;
}

function reportFindings(report: VerificationReport): readonly Finding<Inquisitor>[] {
  const findings: Finding<Inquisitor>[] = [];
  for (const verdict of report.verdicts) {
    if (verdict.status !== "FAIL") continue;
    for (const finding of verdict.findings) findings.push(finding as Finding<Inquisitor>);
  }
  return findings;
}

function findingFingerprints(document: CovenantDocument, report: VerificationReport): readonly string[] {
  return report.verdicts.flatMap((verdict) =>
    verdict.status === "FAIL"
      ? verdict.findings.map((finding) => findingFingerprint(document, verdict.inquisitor, finding))
      : [],
  );
}

class SelectiveUnknownSolver implements CovenantSolver {
  private readonly delegate = new BrowserDeterministicSolver();

  solve(problem: UnsupportedSolverProblem, options?: SolveOptions): Promise<SolverUnknown>;
  solve(problem: SolverProblem<"RULES">, options?: SolveOptions): Promise<SolverResult<"RULES">>;
  solve(problem: SolverProblem<"NONE">, options?: SolveOptions): Promise<SolverResult<"NONE">>;
  solve(problem: CovenantProblem, options?: SolveOptions): Promise<AnySolverResult>;
  async solve(problem: CovenantProblem, options?: SolveOptions): Promise<AnySolverResult> {
    if (problem.queryId.includes(":unambiguity:R3+R4")) {
      return {
        status: "UNKNOWN",
        reason: "RESOURCE_LIMIT",
        telemetry: { solver: "BROWSER_DETERMINISTIC", elapsedMs: 0, clausesChecked: 0 },
      };
    }
    if (problem.kind === "UNSUPPORTED") return this.delegate.solve(problem, options);
    if (problem.coreTracking === "RULES") return this.delegate.solve(problem as SolverProblem<"RULES">, options);
    return this.delegate.solve(problem as SolverProblem<"NONE">, options);
  }
}

describe("verified Two Cursed Chalices", () => {
  it("applies distinct A/B repairs and proves complete preservation outside one immutable Repair Core", async () => {
    const document = standardRepairDocument();
    const solver = new BrowserDeterministicSolver();
    const before = await verifyCovenant(document, solver);
    const target = consistencyFinding(before);
    const [chaliceA, chaliceB] = pairFrom(before);

    expect(target.support).toBe("STANDARD");
    expect([chaliceA.slot, chaliceB.slot]).toEqual(["A", "B"]);
    expect(chaliceA.findingId).toBe(target.id);
    expect(chaliceB.findingId).toBe(target.id);
    expect(chaliceA.repairCore).toBe(chaliceB.repairCore);
    expect(Object.isFrozen(chaliceA.repairCore)).toBe(true);
    expect(chaliceA.repairCore.ruleIds).toEqual(["R1", "R2"]);
    expect(chaliceA.sourceRevision).toBe(document.source.revision);
    expect(chaliceB.sourceRevision).toBe(document.source.revision);
    expect(chaliceA.resultingSemanticFingerprint).not.toBe(chaliceB.resultingSemanticFingerprint);

    const unrelatedBefore = ruleFingerprint(document, "R3");
    const originalFindingFingerprints = findingFingerprints(document, before);
    for (const patch of [chaliceA, chaliceB]) {
      const result = await applyChalicePatch(document, patch, new BrowserDeterministicSolver());
      expect(result.status).toBe("APPLIED");
      if (result.status !== "APPLIED") continue;

      expect(result.proof).toEqual(patch.proof);
      expect(result.proof.conflictFixed).toBe(true);
      expect(result.proof.preservationPercent).toBe(100);
      expect(result.proof.preservedRules).toEqual([unrelatedBefore]);
      expect(ruleFingerprint(result.document, "R3")).toEqual(unrelatedBefore);
      expect(result.report.verdicts[1].status).toBe("PASS");
      const afterFingerprints = findingFingerprints(result.document, result.report);
      expect(afterFingerprints.every((fingerprint) => originalFindingFingerprints.includes(fingerprint))).toBe(true);
    }
  });

  it("produces verified pairs for standard Unambiguity, Security, and Liveness patterns", async () => {
    const cases = [
      { document: standardUnambiguityDocument(), patternId: "CONFLICTING_MODALITY_OVERLAP" },
      { document: standardSecurityDocument(), patternId: "MISSING_CWE-862" },
      ...securityVariantDocuments().map((document) => ({ document, patternId: "MISSING_CWE-862" as const })),
      { document: standardLivenessDocument(), patternId: "PRIMARY_WORKFLOW_DEADLOCK" },
    ] as const;

    for (const item of cases) {
      const report = await verifyCovenant(item.document, new BrowserDeterministicSolver());
      const finding = reportFindings(report).find((candidate) => candidate.patternId === item.patternId);
      expect(finding).toBeDefined();
      if (finding === undefined) continue;
      expect(finding.support).toBe("STANDARD");
      expect(finding.resolution.kind).toBe("pair");
      if (finding.resolution.kind !== "pair") continue;
      expect(finding.resolution.patches.map((patch) => patch.slot)).toEqual(["A", "B"]);
      const behaviorFingerprints: string[] = [];
      for (const patch of finding.resolution.patches) {
        const applied = await applyChalicePatch(item.document, patch, new BrowserDeterministicSolver());
        expect(applied.status).toBe("APPLIED");
        if (applied.status === "APPLIED") {
          behaviorFingerprints.push(documentBehaviorFingerprint(applied.document));
          const remainingIds = reportFindings(applied.report).map((candidate) => candidate.id);
          expect(remainingIds).not.toContain(finding.id);
          expect(applied.proof.preservationPercent).toBe(100);
        }
      }
      expect(new Set(behaviorFingerprints).size).toBe(2);
    }
  });

  it("returns a verified pair for every supported finding in all six Cursed Sample Scrolls", async () => {
    for (const document of cursedScrolls) {
      const report = await verifyCovenant(document, new BrowserDeterministicSolver());
      const supportedVerdicts = [report.verdicts[1], report.verdicts[3], report.verdicts[4]] as const;
      const findings: Finding<Inquisitor>[] = [];
      for (const verdict of supportedVerdicts) {
        if (verdict.status !== "FAIL") continue;
        for (const finding of verdict.findings) findings.push(finding as Finding<Inquisitor>);
      }
      expect(findings.length).toBeGreaterThan(0);
      for (const finding of findings) {
        expect(finding.support).toBe("STANDARD");
        expect(finding.resolution.kind).toBe("pair");
        if (finding.resolution.kind !== "pair") continue;
        for (const patch of finding.resolution.patches) {
          const applied = await applyChalicePatch(document, patch, new BrowserDeterministicSolver());
          expect(applied.status).toBe("APPLIED");
          if (applied.status === "APPLIED") {
            expect(reportFindings(applied.report).map((candidate) => candidate.id)).not.toContain(finding.id);
          }
        }
      }
    }
  });

  it("does not trust an edited sample solely because its document ID is preverified", async () => {
    const sample = cursedScrolls.find((document) => document.source.id === "api-security");
    if (sample === undefined) throw new Error("Missing API Security sample");
    const edited = {
      ...sample,
      source: { ...sample.source, revision: "edited-r2" },
    };
    const report = await verifyCovenant(edited, new BrowserDeterministicSolver());
    const verdict = report.verdicts[4];
    expect(verdict.status).toBe("FAIL");
    if (verdict.status !== "FAIL") return;
    const finding = verdict.findings.find((candidate) => candidate.patternId === "MISSING_CWE-862");
    expect(finding).toBeDefined();
    if (finding === undefined) return;
    expect(finding.support).toBe("CUSTOM");
    if (finding.resolution.kind === "pair") {
      for (const patch of finding.resolution.patches) {
        await expect(applyChalicePatch(edited, patch, new BrowserDeterministicSolver())).resolves.toMatchObject({ status: "APPLIED" });
      }
    } else {
      expect(["single", "manual"]).toContain(finding.resolution.kind);
    }
  });

  it("keeps a covered custom Security failure when narrowing would create a Completeness gap", async () => {
    const report = await verifyCovenant(coveredCustomSecurityDocument(), new BrowserDeterministicSolver());
    const verdict = report.verdicts[4];
    expect(verdict.status).toBe("FAIL");
    if (verdict.status !== "FAIL") return;
    const security = verdict.findings.find((finding) => finding.patternId === "MISSING_CWE-862");
    expect(security).toBeDefined();
    if (security === undefined) return;
    expect(security.support).toBe("CUSTOM");
    expect(security.resolution.kind).toBe("single");
    expect(report.certifiable).toBe(false);
  });

  it("keeps custom proof failures decisive with honest single or manual resolutions", async () => {
    const oneCandidate = await verifyCovenant(customRepairDocument(1), new BrowserDeterministicSolver());
    const noCandidates = await verifyCovenant(customRepairDocument(0), new BrowserDeterministicSolver());
    const single = consistencyFinding(oneCandidate);
    const manual = consistencyFinding(noCandidates);

    expect(single.support).toBe("CUSTOM");
    expect(single.resolution.kind).toBe("single");
    if (single.resolution.kind === "single") expect(single.resolution.patch.slot).toBeNull();
    expect(manual.support).toBe("CUSTOM");
    expect(manual.resolution.kind).toBe("manual");
    expect(oneCandidate.verdicts[1].status).toBe("FAIL");
    expect(noCandidates.verdicts[1].status).toBe("FAIL");
  });

  it("deduplicates equivalent scope facets in semantic fingerprints", () => {
    const rule = standardRepairDocument().rules[0];
    if (rule === undefined) throw new Error("Expected fixture rule");
    const facet = { variable: "Role", values: ["Admin", "Admin"] } as const;
    const once = { ...rule, scope: { ...rule.scope, actors: [facet] } };
    const repeated = { ...rule, scope: { ...rule.scope, actors: [facet, facet] } };
    expect(ruleSemanticFingerprint(repeated)).toBe(ruleSemanticFingerprint(once));
  });

  it("rejects certification when a FAIL verdict still has unresolved proof work", async () => {
    const document = unresolvedRepairDocument();
    const report = await verifyCovenant(document, new BrowserDeterministicSolver());
    const [patch] = pairFrom(report);

    await expect(applyChalicePatch(document, patch, new SelectiveUnknownSolver())).resolves.toEqual({
      status: "REJECTED",
      reason: "REVERIFICATION_UNKNOWN",
    });
  });

  it("rejects a new rule injected through an authorized rule span", async () => {
    const document = standardRepairDocument();
    const report = await verifyCovenant(document, new BrowserDeterministicSolver());
    const [patch] = pairFrom(report);
    const edit = patch.edits[0];
    const injected: ChalicePatch = {
      ...patch,
      edits: [{
        ...edit,
        replacementText: `${edit.replacementText}\nR4: THE SYSTEM SHALL AuditRecorded`,
      }],
    };

    await expect(applyChalicePatch(document, injected, new BrowserDeterministicSolver())).resolves.toEqual({
      status: "REJECTED",
      reason: "PRESERVATION_FAILED",
    });
  });

  it("rejects stale revisions and source mismatches atomically", async () => {
    const document = standardRepairDocument();
    const report = await verifyCovenant(document, new BrowserDeterministicSolver());
    const [patch] = pairFrom(report);
    const stale = { ...document, source: { ...document.source, revision: "revision-2" } };
    const mismatched = {
      ...document,
      source: {
        ...document.source,
        text: document.source.text.replace("R1:", "X1:"),
      },
    };

    await expect(applyChalicePatch(stale, patch, new BrowserDeterministicSolver())).resolves.toEqual({
      status: "REJECTED",
      reason: "STALE_REVISION",
    });
    await expect(applyChalicePatch(mismatched, patch, new BrowserDeterministicSolver())).resolves.toEqual({
      status: "REJECTED",
      reason: "SOURCE_MISMATCH",
    });
    expect(document).toEqual(standardRepairDocument());
  });
});

import { stringifyCovenant } from "@covenant/core";
import type { CovenantDocument } from "@covenant/core";

export interface TextDownload {
  readonly filename: string;
  readonly mediaType: "text/markdown" | "text/typescript";
  readonly text: string;
  readonly href: string;
}

function dataHref(text: string): string {
  return `data:text/plain;charset=utf-8,${encodeURIComponent(text)}`;
}

export function requirementsDownload(document: CovenantDocument): TextDownload {
  const text = `${document.source.text}\n`;
  return {
    filename: "requirements.md",
    mediaType: "text/markdown",
    text,
    href: dataHref(text),
  };
}

export function pbtSnippet(
  before: CovenantDocument,
  after: CovenantDocument,
  repairCoreRuleIds: readonly string[],
  targetFindingId: string,
): string {
  const beforeJson = JSON.stringify(stringifyCovenant(before));
  const afterJson = JSON.stringify(stringifyCovenant(after));
  return `import fc from "fast-check";\nimport { describe, expect, it } from "vitest";\nimport {\n  BrowserDeterministicSolver,\n  documentSemanticFingerprint,\n  parseCovenantJson,\n  ruleFingerprint,\n  validateCovenantDocument,\n  verifyCovenant,\n} from "@covenant/core";\nimport type { CovenantDocument, VerificationReport } from "@covenant/core";\n\nconst beforeRaw: unknown = parseCovenantJson(${beforeJson});\nconst afterRaw: unknown = parseCovenantJson(${afterJson});\nconst repairCore = new Set(${JSON.stringify(repairCoreRuleIds)});\nconst targetFindingId = ${JSON.stringify(targetFindingId)};\n\nfunction requireDocument(value: unknown): CovenantDocument {\n  const validation = validateCovenantDocument(value);\n  if (validation.status !== "VALID") {\n    throw new TypeError(validation.diagnostics.map(({ code }) => code).join(", "));\n  }\n  return validation.document;\n}\n\nfunction hasFinding(report: VerificationReport, findingId: string): boolean {\n  for (const verdict of report.verdicts) {\n    if (verdict.status === "FAIL" && verdict.findings.some((finding) => finding.id === findingId)) return true;\n  }\n  return false;\n}\n\nconst before = requireDocument(beforeRaw);\nconst after = requireDocument(afterRaw);\nconst preservedRuleIds = before.rules.map(({ id }) => id).filter((id) => !repairCore.has(id));\n\ndescribe("COVENANT Chalice preservation replay", () => {\n  it("proves 100% of rules outside the Repair Core remain intact", async () => {\n    const solver = new BrowserDeterministicSolver();\n    const [beforeReport, afterReport] = await Promise.all([\n      verifyCovenant(before, solver),\n      verifyCovenant(after, solver),\n    ]);\n    expect(hasFinding(afterReport, targetFindingId)).toBe(false);\n    expect(\n      hasFinding(beforeReport, targetFindingId) || documentSemanticFingerprint(before) !== documentSemanticFingerprint(after),\n    ).toBe(true);\n    expect(afterReport.verdicts.every((verdict) => verdict.status !== "UNKNOWN")).toBe(true);\n\n    fc.assert(\n      fc.property(fc.shuffledSubarray(preservedRuleIds), (selectedRuleIds) => {\n        for (const ruleId of selectedRuleIds) {\n          expect(ruleFingerprint(after, ruleId)).toEqual(ruleFingerprint(before, ruleId));\n        }\n      }),\n      { numRuns: 200 },\n    );\n  });\n});\n`;
}

export function pbtDownload(
  before: CovenantDocument,
  after: CovenantDocument,
  repairCoreRuleIds: readonly string[],
  targetFindingId: string,
): TextDownload {
  const text = pbtSnippet(before, after, repairCoreRuleIds, targetFindingId);
  return {
    filename: "covenant-preservation.property.ts",
    mediaType: "text/typescript",
    text,
    href: dataHref(text),
  };
}

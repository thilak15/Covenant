import { describe, expect, it } from "vitest";
import {
  BrowserDeterministicSolver,
  evaluateCondition,
  verifyCovenant,
  type InquisitorVerdict,
} from "../src/index.js";
import { enumIs, fixtureDocument, flag } from "./fixtures/cursed-scrolls.js";

const variables = [
  { kind: "ENUM", name: "Role", values: ["Admin", "Contractor"] },
  { kind: "BOOLEAN", name: "EmergencyOverride" },
  { kind: "BOOLEAN", name: "AccessGranted" },
] as const;

function verdict<I extends InquisitorVerdict<"CONSISTENCY">["inquisitor"]>(
  report: Awaited<ReturnType<typeof verifyCovenant>>,
  inquisitor: I,
): Extract<(typeof report.verdicts)[number], { readonly inquisitor: I }> {
  return report.verdicts.find((item) => item.inquisitor === inquisitor) as Extract<
    (typeof report.verdicts)[number],
    { readonly inquisitor: I }
  >;
}

describe("browser Consistency proof", () => {
  it("returns a source-ordered subset-minimal core and replayable applicability witness", async () => {
    const contractorOverride = {
      kind: "ALL",
      conditions: [enumIs("Role", "Contractor"), flag("EmergencyOverride")],
    } as const;
    const authored = fixtureDocument("contradiction", variables, [
      { id: "R1", activation: contractorOverride, modality: "MUST", consequence: flag("AccessGranted") },
      { id: "R2", activation: contractorOverride, modality: "MUST_NOT", consequence: flag("AccessGranted") },
      { id: "R3", activation: contractorOverride, modality: "MUST", consequence: flag("EmergencyOverride") },
    ]);
    const [r1, r2, r3] = authored.rules;
    if (r1 === undefined || r2 === undefined || r3 === undefined) throw new Error("fixture rules missing");
    const document = { ...authored, rules: [r3, r2, r1] };

    const report = await verifyCovenant(document, new BrowserDeterministicSolver());
    const consistency = verdict(report, "CONSISTENCY");
    expect(consistency.status).toBe("FAIL");
    if (consistency.status !== "FAIL") return;
    const evidence = consistency.findings[0].evidence;
    expect(evidence.core.ruleIds).toEqual(["R1", "R2"]);
    expect(evidence.core.queryId).toBe("contradiction:consistency:R1+R2");
    expect(evidence.witness.coreRuleIds).toEqual(["R1", "R2"]);
    expect(evidence.witness.assignments).toEqual([
      { variable: "Role", value: { kind: "ENUM", value: "Contractor" } },
      { variable: "EmergencyOverride", value: { kind: "BOOLEAN", value: true } },
    ]);
    for (const rule of document.rules.filter((rule) => evidence.core.ruleIds.includes(rule.id))) {
      expect(evaluateCondition(rule.activation, evidence.witness.assignments)).toBe(true);
    }
    expect(evidence.witness.triggeredConsequences.map((item) => item.ruleId)).toEqual(["R1", "R2"]);
  });

  it("does not report mutually exclusive rules as a Consistency contradiction", async () => {
    const document = fixtureDocument("exclusive", variables, [
      { id: "R1", activation: enumIs("Role", "Admin"), modality: "MUST", consequence: flag("AccessGranted") },
      { id: "R2", activation: enumIs("Role", "Contractor"), modality: "MUST_NOT", consequence: flag("AccessGranted") },
    ]);
    const report = await verifyCovenant(document, new BrowserDeterministicSolver());
    expect(verdict(report, "CONSISTENCY").status).toBe("PASS");
  });

  it("reports overlapping MAY and MUST_NOT as Unambiguity only", async () => {
    const authored = fixtureDocument("permission", variables, [
      { id: "R1", activation: flag("EmergencyOverride"), modality: "MAY", consequence: flag("AccessGranted") },
      { id: "R2", activation: flag("EmergencyOverride"), modality: "MUST_NOT", consequence: flag("AccessGranted") },
    ]);
    const document = {
      ...authored,
      rules: authored.rules.map((rule) => ({
        ...rule,
        scope: { ...rule.scope, actors: [{ variable: "Role", values: ["Contractor"] as const }] },
      })),
    };
    const report = await verifyCovenant(document, new BrowserDeterministicSolver());
    expect(verdict(report, "CONSISTENCY").status).toBe("PASS");
    const ambiguity = report.verdicts[3];
    expect(ambiguity.inquisitor).toBe("UNAMBIGUITY");
    expect(ambiguity.status).toBe("FAIL");
    if (ambiguity.status === "FAIL") {
      expect(ambiguity.findings[0].evidence.ruleIds).toEqual(["R1", "R2"]);
      const overlap = ambiguity.findings[0].evidence.overlap;
      expect(overlap.kind).toBe("ALL");
      if (overlap.kind === "ALL") {
        expect(overlap.conditions[0]).toEqual({ kind: "ENUM", variable: "Role", operator: "EQ", value: "Contractor" });
        expect(overlap.conditions[2]).toEqual({ kind: "ENUM", variable: "Role", operator: "EQ", value: "Contractor" });
      }
    }
  });

  it("compares commutative consequences by normalized meaning", async () => {
    const document = fixtureDocument("commutative-modalities", [
      { kind: "BOOLEAN", name: "A" },
      { kind: "BOOLEAN", name: "B" },
    ], [
      {
        id: "R1",
        modality: "MAY",
        consequence: { kind: "ALL", conditions: [flag("A"), flag("B")] },
      },
      {
        id: "R2",
        modality: "MUST_NOT",
        consequence: { kind: "ALL", conditions: [flag("B"), flag("A")] },
      },
    ]);
    const report = await verifyCovenant(document, new BrowserDeterministicSolver());
    expect(report.verdicts[1].status).toBe("PASS");
    expect(report.verdicts[3].status).toBe("FAIL");
    if (report.verdicts[3].status === "FAIL") {
      expect(report.verdicts[3].findings[0].evidence.ruleIds).toEqual(["R1", "R2"]);
    }
  });
});

import { describe, expect, it } from "vitest";
import {
  BrowserDeterministicSolver,
  CWE_CONTROL_IDS,
  cweControls,
  verifyCovenant,
} from "../src/index.js";
import { enumIs, fixtureDocument, flag } from "./fixtures/cursed-scrolls.js";

const solver = new BrowserDeterministicSolver();

const CONTROL_VARIABLES = [
  ["CWE-20", "CWE_20_APPLIES", "CWE_20_REQUIRED"],
  ["CWE-22", "CWE_22_APPLIES", "CWE_22_REQUIRED"],
  ["CWE-23", "CWE_23_APPLIES", "CWE_23_REQUIRED"],
  ["CWE-59", "CWE_59_APPLIES", "CWE_59_REQUIRED"],
  ["CWE-73", "CWE_73_APPLIES", "CWE_73_REQUIRED"],
  ["CWE-74", "CWE_74_APPLIES", "CWE_74_REQUIRED"],
  ["CWE-77", "CWE_77_APPLIES", "CWE_77_REQUIRED"],
  ["CWE-78", "CWE_78_APPLIES", "CWE_78_REQUIRED"],
  ["CWE-79", "CWE_79_APPLIES", "CWE_79_REQUIRED"],
  ["CWE-89", "CWE_89_APPLIES", "CWE_89_REQUIRED"],
  ["CWE-94", "CWE_94_APPLIES", "CWE_94_REQUIRED"],
  ["CWE-113", "CWE_113_APPLIES", "CWE_113_REQUIRED"],
  ["CWE-116", "CWE_116_APPLIES", "CWE_116_REQUIRED"],
  ["CWE-117", "CWE_117_APPLIES", "CWE_117_REQUIRED"],
  ["CWE-119", "CWE_119_APPLIES", "CWE_119_REQUIRED"],
  ["CWE-120", "CWE_120_APPLIES", "CWE_120_REQUIRED"],
  ["CWE-125", "CWE_125_APPLIES", "CWE_125_REQUIRED"],
  ["CWE-129", "CWE_129_APPLIES", "CWE_129_REQUIRED"],
  ["CWE-134", "CWE_134_APPLIES", "CWE_134_REQUIRED"],
  ["CWE-190", "CWE_190_APPLIES", "CWE_190_REQUIRED"],
  ["CWE-200", "CWE_200_APPLIES", "CWE_200_REQUIRED"],
  ["CWE-203", "CWE_203_APPLIES", "CWE_203_REQUIRED"],
  ["CWE-208", "CWE_208_APPLIES", "CWE_208_REQUIRED"],
  ["CWE-209", "CWE_209_APPLIES", "CWE_209_REQUIRED"],
  ["CWE-269", "CWE_269_APPLIES", "CWE_269_REQUIRED"],
  ["CWE-276", "CWE_276_APPLIES", "CWE_276_REQUIRED"],
  ["CWE-284", "CWE_284_APPLIES", "CWE_284_REQUIRED"],
  ["CWE-285", "CWE_285_APPLIES", "CWE_285_REQUIRED"],
  ["CWE-287", "CWE_287_APPLIES", "CWE_287_REQUIRED"],
  ["CWE-288", "CWE_288_APPLIES", "CWE_288_REQUIRED"],
  ["CWE-290", "CWE_290_APPLIES", "CWE_290_REQUIRED"],
  ["CWE-294", "CWE_294_APPLIES", "CWE_294_REQUIRED"],
  ["CWE-295", "CWE_295_APPLIES", "CWE_295_REQUIRED"],
  ["CWE-306", "CWE_306_APPLIES", "CWE_306_REQUIRED"],
  ["CWE-307", "CWE_307_APPLIES", "CWE_307_REQUIRED"],
  ["CWE-311", "CWE_311_APPLIES", "CWE_311_REQUIRED"],
  ["CWE-312", "CWE_312_APPLIES", "CWE_312_REQUIRED"],
  ["CWE-319", "CWE_319_APPLIES", "CWE_319_REQUIRED"],
  ["CWE-326", "CWE_326_APPLIES", "CWE_326_REQUIRED"],
  ["CWE-327", "CWE_327_APPLIES", "CWE_327_REQUIRED"],
  ["CWE-330", "CWE_330_APPLIES", "CWE_330_REQUIRED"],
  ["CWE-345", "CWE_345_APPLIES", "CWE_345_REQUIRED"],
  ["CWE-346", "CWE_346_APPLIES", "CWE_346_REQUIRED"],
  ["CWE-352", "CWE_352_APPLIES", "CWE_352_REQUIRED"],
  ["CWE-362", "CWE_362_APPLIES", "CWE_362_REQUIRED"],
  ["CWE-384", "CWE_384_APPLIES", "CWE_384_REQUIRED"],
  ["CWE-400", "CWE_400_APPLIES", "CWE_400_REQUIRED"],
  ["CWE-434", "CWE_434_APPLIES", "CWE_434_REQUIRED"],
  ["CWE-502", "CWE_502_APPLIES", "CWE_502_REQUIRED"],
  ["CWE-522", "CWE_522_APPLIES", "CWE_522_REQUIRED"],
  ["CWE-532", "CWE_532_APPLIES", "CWE_532_REQUIRED"],
  ["CWE-601", "CWE_601_APPLIES", "CWE_601_REQUIRED"],
  ["CWE-611", "CWE_611_APPLIES", "CWE_611_REQUIRED"],
  ["CWE-732", "CWE_732_APPLIES", "CWE_732_REQUIRED"],
  ["CWE-798", "CWE_798_APPLIES", "CWE_798_REQUIRED"],
  ["CWE-862", "CWE_862_APPLIES", "CWE_862_REQUIRED"],
  ["CWE-863", "CWE_863_APPLIES", "CWE_863_REQUIRED"],
  ["CWE-918", "CWE_918_APPLIES", "CWE_918_REQUIRED"],
  ["CWE-922", "CWE_922_APPLIES", "CWE_922_REQUIRED"],
  ["CWE-943", "CWE_943_APPLIES", "CWE_943_REQUIRED"],
] as const;

const CONTROL_TITLES = [
  "Improper Input Validation",
  "Improper Limitation of a Pathname to a Restricted Directory ('Path Traversal')",
  "Relative Path Traversal",
  "Improper Link Resolution Before File Access ('Link Following')",
  "External Control of File Name or Path",
  "Improper Neutralization of Special Elements in Output Used by a Downstream Component ('Injection')",
  "Improper Neutralization of Special Elements used in a Command ('Command Injection')",
  "Improper Neutralization of Special Elements used in an OS Command ('OS Command Injection')",
  "Improper Neutralization of Input During Web Page Generation ('Cross-site Scripting')",
  "Improper Neutralization of Special Elements used in an SQL Command ('SQL Injection')",
  "Improper Control of Generation of Code ('Code Injection')",
  "Improper Neutralization of CRLF Sequences in HTTP Headers ('HTTP Request/Response Splitting')",
  "Improper Encoding or Escaping of Output",
  "Improper Output Neutralization for Logs",
  "Improper Restriction of Operations within the Bounds of a Memory Buffer",
  "Buffer Copy without Checking Size of Input ('Classic Buffer Overflow')",
  "Out-of-bounds Read",
  "Improper Validation of Array Index",
  "Use of Externally-Controlled Format String",
  "Integer Overflow or Wraparound",
  "Exposure of Sensitive Information to an Unauthorized Actor",
  "Observable Discrepancy",
  "Observable Timing Discrepancy",
  "Generation of Error Message Containing Sensitive Information",
  "Improper Privilege Management",
  "Incorrect Default Permissions",
  "Improper Access Control",
  "Improper Authorization",
  "Improper Authentication",
  "Authentication Bypass Using an Alternate Path or Channel",
  "Authentication Bypass by Spoofing",
  "Authentication Bypass by Capture-replay",
  "Improper Certificate Validation",
  "Missing Authentication for Critical Function",
  "Improper Restriction of Excessive Authentication Attempts",
  "Missing Encryption of Sensitive Data",
  "Cleartext Storage of Sensitive Information",
  "Cleartext Transmission of Sensitive Information",
  "Inadequate Encryption Strength",
  "Use of a Broken or Risky Cryptographic Algorithm",
  "Use of Insufficiently Random Values",
  "Insufficient Verification of Data Authenticity",
  "Origin Validation Error",
  "Cross-Site Request Forgery (CSRF)",
  "Concurrent Execution using Shared Resource with Improper Synchronization ('Race Condition')",
  "Session Fixation",
  "Uncontrolled Resource Consumption",
  "Unrestricted Upload of File with Dangerous Type",
  "Deserialization of Untrusted Data",
  "Insufficiently Protected Credentials",
  "Insertion of Sensitive Information into Log File",
  "URL Redirection to Untrusted Site ('Open Redirect')",
  "Improper Restriction of XML External Entity Reference",
  "Incorrect Permission Assignment for Critical Resource",
  "Use of Hard-coded Credentials",
  "Missing Authorization",
  "Incorrect Authorization",
  "Server-Side Request Forgery (SSRF)",
  "Insecure Storage of Sensitive Information",
  "Improper Neutralization of Special Elements in Data Query Logic",
] as const;

describe("the ordered 60-CWE security manifest", () => {
  it("contains exact unique IDs, official titles, formal conditions, and two strategies", () => {
    expect(cweControls.map((control) => control.id)).toEqual(CWE_CONTROL_IDS);
    expect(CONTROL_VARIABLES.map(([id]) => id)).toEqual(CWE_CONTROL_IDS);
    expect(new Set(cweControls.map((control) => control.id)).size).toBe(60);
    expect(cweControls.map((control) => control.title)).toEqual(CONTROL_TITLES);
    expect(CONTROL_TITLES).toHaveLength(60);
    for (const [index, control] of cweControls.entries()) {
      const expectation = CONTROL_VARIABLES[index];
      if (expectation === undefined) throw new Error(`missing independent expectation for ${control.id}`);
      const [, applies, required] = expectation;
      expect(control.appliesWhen).toEqual({ kind: "BOOLEAN", variable: applies, equals: true });
      expect(control.requiredObligation).toEqual({ kind: "BOOLEAN", variable: required, equals: true });
      expect(control.repairStrategyIds).toHaveLength(2);
      expect(control.repairStrategyIds[0]).not.toBe(control.repairStrategyIds[1]);
      expect(control.evidenceMessage).toContain(control.id);
    }
  });

  it("proves an obligation present and returns a concrete gap for each control", async () => {
    for (const [index, control] of cweControls.entries()) {
      const expectation = CONTROL_VARIABLES[index];
      if (expectation === undefined) throw new Error(`missing independent fixture for ${control.id}`);
      const [, applies, required] = expectation;
      const names = { applies, required };
      const variables = [
        { kind: "BOOLEAN", name: names.applies },
        { kind: "BOOLEAN", name: names.required },
      ] as const;
      const present = fixtureDocument(`${control.id}-present`, variables, [{
        id: "R1",
        activation: flag(names.applies),
        modality: "MUST",
        consequence: flag(names.required),
      }]);
      const presentReport = await verifyCovenant(present, solver);
      expect(presentReport.verdicts[4].status, `${control.id} positive fixture`).toBe("PASS");

      const missing = fixtureDocument(`${control.id}-missing`, variables, [{
        id: "R1",
        activation: flag(names.applies),
        modality: "MUST_NOT",
        consequence: flag(names.required),
      }]);
      const missingReport = await verifyCovenant(missing, solver);
      const security = missingReport.verdicts[4];
      expect(security.status, `${control.id} negative fixture`).toBe("FAIL");
      if (security.status === "FAIL") {
        const finding = security.findings.find((item) => item.evidence.category === "SECURITY");
        expect(finding?.evidence.category).toBe("SECURITY");
        if (finding?.evidence.category === "SECURITY") {
          expect(finding.evidence.controlId).toBe(control.id);
          expect(finding.evidence.ruleIds).toEqual(["R1"]);
          expect(finding.evidence.assignments).toContainEqual({
            variable: names.applies,
            value: { kind: "BOOLEAN", value: true },
          });
        }
      }
    }
  });

  it("does not report a Security gap when the governed operation cannot apply", async () => {
    const names = { applies: "CWE_862_APPLIES", required: "CWE_862_REQUIRED" } as const;
    const document = fixtureDocument("disabled-operation", [
      { kind: "BOOLEAN", name: names.applies },
      { kind: "BOOLEAN", name: names.required },
    ], [{
      id: "R1",
      activation: { kind: "ALL", conditions: [flag(names.applies), { kind: "FALSE" }] },
      modality: "MUST_NOT",
      consequence: flag(names.required),
    }]);
    const report = await verifyCovenant(document, solver);
    expect(report.verdicts[4].status).toBe("PASS");
  });

  it("audits every governed operation and identifies only the noncompliant operation", async () => {
    const names = { applies: "CWE_862_APPLIES", required: "CWE_862_REQUIRED" } as const;
    const document = fixtureDocument("multiple-operations", [
      { kind: "BOOLEAN", name: names.applies },
      { kind: "BOOLEAN", name: names.required },
      { kind: "ENUM", name: "Operation", values: ["Read", "Write"] },
      { kind: "BOOLEAN", name: "Completed" },
    ], [
      {
        id: "R1",
        activation: { kind: "ALL", conditions: [flag(names.applies), enumIs("Operation", "Read")] },
        modality: "MUST",
        consequence: flag(names.required),
      },
      {
        id: "R2",
        activation: { kind: "ALL", conditions: [flag(names.applies), enumIs("Operation", "Write")] },
        modality: "MUST",
        consequence: flag("Completed"),
      },
    ]);
    const report = await verifyCovenant(document, solver);
    const verdict = report.verdicts[4];
    expect(verdict.status).toBe("FAIL");
    if (verdict.status === "FAIL") {
      const security = verdict.findings.filter((item) => item.evidence.category === "SECURITY");
      expect(security).toHaveLength(1);
      expect(security[0]?.evidence.ruleIds).toEqual(["R2"]);
      expect(security[0]?.evidence.governedSource.clauseRef).toBe("R2");
    }
  });
});

describe("primary workflow liveness", () => {
  it("reports cumulative restrictions that block a normal workflow with a trigger witness", async () => {
    const document = fixtureDocument("deadlock", [
      { kind: "BOOLEAN", name: "Start" },
      { kind: "BOOLEAN", name: "CanWork" },
      { kind: "BOOLEAN", name: "Unrelated" },
    ], [
      { id: "R1", modality: "MUST", consequence: flag("Unrelated") },
      { id: "R2", activation: flag("Start"), modality: "MUST_NOT", consequence: flag("CanWork") },
    ], [{
      id: "normal-work",
      label: "normal work",
      entry: flag("Start"),
      requiredConsequences: [flag("CanWork")],
    }]);
    const report = await verifyCovenant(document, solver);
    const verdict = report.verdicts[4];
    expect(verdict.status).toBe("FAIL");
    if (verdict.status === "FAIL") {
      const liveness = verdict.findings.find((item) => item.evidence.category === "LIVENESS");
      expect(liveness?.evidence.category).toBe("LIVENESS");
      if (liveness?.evidence.category === "LIVENESS") {
        expect(liveness.evidence.workflowId).toBe("normal-work");
        expect(liveness.evidence.ruleIds).toEqual(["R2"]);
        expect(liveness.evidence.governedSource.clauseRef).toBe("R2");
        expect(liveness.evidence.assignments).toEqual([
          { variable: "Start", value: { kind: "BOOLEAN", value: true } },
        ]);
      }
    }
  });

  it("passes when the required primary workflow remains feasible", async () => {
    const document = fixtureDocument("live", [
      { kind: "BOOLEAN", name: "Start" },
      { kind: "BOOLEAN", name: "CanWork" },
    ], [{ id: "R1", activation: flag("Start"), modality: "MUST", consequence: flag("CanWork") }], [{
      id: "normal-work",
      label: "normal work",
      entry: flag("Start"),
      requiredConsequences: [flag("CanWork")],
    }]);
    const report = await verifyCovenant(document, solver);
    expect(report.verdicts[4].status).toBe("PASS");
  });
});

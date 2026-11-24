import { describe, expect, it } from "vitest";
import {
  CWE_CONTROL_IDS,
  parseOffline,
  validateCovenantDocument,
  validateUnsatCore,
  type CovenantDocument,
} from "../src/index.js";

const text = [
  'R1: WHEN Role = "Admin" AND Retries > 2, THE SYSTEM SHALL AccessGranted',
  "R2: WHEN Role = \"Guest\", THE SYSTEM SHALL NOT AccessGranted",
].join("\n");

function sample(): CovenantDocument {
  const result = parseOffline({
    source: { id: "doc", revision: "r1", format: "EARS", text },
    declaredVariables: [
      { kind: "ENUM", name: "Role", values: ["Admin", "Guest"] },
      { kind: "BOOLEAN", name: "AccessGranted" },
      { kind: "NUMERIC", name: "Retries", domain: "INTEGER" },
    ],
    primaryWorkflows: [],
  });
  if (result.status !== "PARSED") throw new Error("fixture must parse");
  return result.document;
}

/** Deep clone that keeps bigint values, then lets a test mutate the copy. */
function mutated(change: (draft: Record<string, unknown>) => void): unknown {
  const draft = structuredClone(sample()) as unknown as Record<string, unknown>;
  change(draft);
  return draft;
}

function codes(input: unknown): string[] {
  const result = validateCovenantDocument(input);
  return result.status === "INVALID" ? result.diagnostics.map((d) => d.code) : [];
}

function ruleAt(draft: Record<string, unknown>, index: number): Record<string, unknown> {
  return (draft["rules"] as Record<string, unknown>[])[index] as Record<string, unknown>;
}

describe("validateCovenantDocument", () => {
  it("accepts a parsed document unchanged", () => {
    const document = sample();
    const result = validateCovenantDocument(document);
    expect(result.status).toBe("VALID");
    if (result.status === "VALID") expect(result.document).toEqual(document);
  });

  it("rejects non-document input", () => {
    for (const input of [null, undefined, 7, "x", [], {}, { source: {} }]) {
      expect(codes(input)).toEqual(["INVALID_DOCUMENT"]);
    }
  });

  it("rejects duplicate rule IDs and duplicate variable declarations", () => {
    expect(codes(mutated((d) => { ruleAt(d, 1)["id"] = "R1"; }))).toEqual(["DUPLICATE_RULE_ID"]);
    expect(
      codes(mutated((d) => { (d["variables"] as unknown[]).push({ kind: "BOOLEAN", name: "Role" }); })),
    ).toEqual(["DUPLICATE_VARIABLE"]);
  });

  it("rejects empty enum domains and undeclared or mismatched variables", () => {
    expect(
      codes(mutated((d) => { ((d["variables"] as Record<string, unknown>[])[0] as Record<string, unknown>)["values"] = []; })),
    ).toEqual(["EMPTY_ENUM_DOMAIN"]);
    expect(
      codes(mutated((d) => { ruleAt(d, 0)["consequence"] = { kind: "BOOLEAN", variable: "Nope", equals: true }; })),
    ).toEqual(["UNDECLARED_VARIABLE"]);
    expect(
      codes(mutated((d) => { ruleAt(d, 0)["consequence"] = { kind: "BOOLEAN", variable: "Role", equals: true }; })),
    ).toEqual(["VARIABLE_KIND_MISMATCH"]);
  });

  it("rejects non-canonical rationals", () => {
    const withBound = (numerator: bigint, denominator: bigint) =>
      mutated((d) => {
        ruleAt(d, 0)["consequence"] = {
          kind: "NUMERIC",
          bound: { variable: "Retries", domain: "INTEGER", lower: { value: { numerator, denominator }, inclusive: true } },
        };
      });
    expect(codes(withBound(2n, 4n))).toEqual(["INVALID_RATIONAL"]);
    expect(codes(withBound(1n, 0n))).toEqual(["INVALID_RATIONAL"]);
    expect(codes(withBound(1n, -2n))).toEqual(["INVALID_RATIONAL"]);
    expect(codes(withBound(0n, 3n))).toEqual(["INVALID_RATIONAL"]);
    expect(codes(withBound(5n, 1n))).toEqual([]);
  });

  it("rejects spans outside the source text or with end before start", () => {
    expect(
      codes(mutated((d) => { ((ruleAt(d, 0)["source"] as Record<string, unknown>)["end"] as Record<string, unknown>)["offset"] = 9999; })),
    ).toEqual(["INVALID_SOURCE_SPAN"]);
    expect(
      codes(mutated((d) => { ((ruleAt(d, 0)["source"] as Record<string, unknown>)["start"] as Record<string, unknown>)["offset"] = 500; })),
    ).toEqual(["INVALID_SOURCE_SPAN"]);
  });

  it("rejects unknown modalities and condition kinds", () => {
    expect(codes(mutated((d) => { ruleAt(d, 0)["modality"] = "SHOULD"; }))).toEqual(["INVALID_RULE"]);
    expect(codes(mutated((d) => { ruleAt(d, 0)["activation"] = { kind: "XOR" }; }))).toEqual(["INVALID_CONDITION"]);
  });
});

describe("validateUnsatCore", () => {
  const consequence = { ruleId: "R1", modality: "MUST", consequence: { kind: "TRUE" } };
  it("requires at least two unique rule IDs", () => {
    expect(validateUnsatCore({ queryId: "q", ruleIds: ["R1"], incompatibleConsequences: [consequence] })).toBeNull();
    expect(validateUnsatCore({ queryId: "q", ruleIds: ["R1", "R1"], incompatibleConsequences: [] })).toBeNull();
    expect(validateUnsatCore("nope")).toBeNull();
    const core = validateUnsatCore({ queryId: "q", ruleIds: ["R1", "R2"], incompatibleConsequences: [consequence] });
    expect(core?.ruleIds).toEqual(["R1", "R2"]);
    expect(validateUnsatCore({ queryId: "q", ruleIds: ["R1", "R2"], incompatibleConsequences: [{ ...consequence, ruleId: "R9" }] })).toBeNull();
    expect(validateUnsatCore({ queryId: 1, ruleIds: ["R1", "R2"], incompatibleConsequences: [] })).toBeNull();
    expect(validateUnsatCore({ queryId: "q", ruleIds: ["R1", "R2"], incompatibleConsequences: [{ ...consequence, modality: "SHOULD" }] })).toBeNull();
  });
});

describe("CWE_CONTROL_IDS", () => {
  it("lists exactly 60 unique controls", () => {
    expect(new Set(CWE_CONTROL_IDS).size).toBe(60);
    expect(CWE_CONTROL_IDS).toHaveLength(60);
  });
});

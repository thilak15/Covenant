import { describe, expect, it } from "vitest";
import {
  parseCovenantJson,
  parseOffline,
  stringifyCovenant,
  validateCovenantDocument,
  type CovenantDocument,
  type ParseResult,
  type VariableDeclaration,
} from "../src/index.js";

const variables: readonly VariableDeclaration[] = [
  { kind: "ENUM", name: "Role", values: ["Admin", "Contractor", "Guest 🔒"] },
  { kind: "ENUM", name: "Party", values: ["Vendor", "Client"] },
  { kind: "BOOLEAN", name: "EmergencyOverride" },
  { kind: "BOOLEAN", name: "AccessGranted" },
  { kind: "NUMERIC", name: "Retries", domain: "INTEGER" },
  { kind: "NUMERIC", name: "Credit", domain: "DECIMAL" },
];

function request(format: "EARS" | "CLAUSE", text: string): unknown {
  return {
    source: { id: "doc", revision: "r1", format, text },
    declaredVariables: variables,
    primaryWorkflows: [],
  };
}

function parsed(result: ParseResult): CovenantDocument {
  if (result.status !== "PARSED") {
    throw new Error(`expected PARSED, got ${JSON.stringify(result.diagnostics)}`);
  }
  return result.document;
}

const earsText = [
  'R1: WHEN Role = "Contractor" AND EmergencyOverride, THE SYSTEM SHALL AccessGranted',
  "# comment lines are skipped",
  "",
  'R2: WHEN Role = "Guest 🔒" AND Credit >= 0.50 AND Credit < 1.5e1, THE SYSTEM SHALL NOT AccessGranted.',
  "THE SYSTEM MAY Retries <= 3",
].join("\n");

describe("parseOffline", () => {
  it("parses a supported EARS document into stable rules with UTF-16 spans", () => {
    const document = parsed(parseOffline(request("EARS", earsText)));
    expect(document.rules.map((rule) => [rule.id, rule.modality])).toEqual([
      ["R1", "MUST"],
      ["R2", "MUST_NOT"],
      ["R3", "MAY"],
    ]);
    const second = document.rules[1];
    expect(second).toBeDefined();
    if (second === undefined) return;
    const slice = earsText.slice(second.source.start.offset, second.source.end.offset);
    expect(slice.startsWith("R2: WHEN")).toBe(true);
    expect(slice.endsWith("AccessGranted.")).toBe(true);
    expect(second.source.start).toMatchObject({ line: 4, column: 1 });
    expect(second.source.clauseRef).toBe("R2");
    expect(second.consequence).toEqual({ kind: "BOOLEAN", variable: "AccessGranted", equals: true });
    expect(second.scope).toEqual({ actors: [], resources: [], actions: [], context: { kind: "TRUE" } });
  });

  it("stores exact reduced rationals and serializes them as base-10 strings", () => {
    const document = parsed(parseOffline(request("EARS", earsText)));
    const json = stringifyCovenant(document.rules[1]?.activation);
    expect(json).toContain('"lower":{"value":{"numerator":"1","denominator":"2"},"inclusive":true}');
    expect(json).toContain('"upper":{"value":{"numerator":"15","denominator":"1"},"inclusive":false}');
    expect(document.rules[1]?.activation).toMatchObject({
      kind: "ALL",
      conditions: [
        { kind: "ENUM", variable: "Role", operator: "EQ", value: "Guest 🔒" },
        { kind: "NUMERIC", bound: { variable: "Credit", domain: "DECIMAL", lower: { value: { numerator: 1n, denominator: 2n } } } },
        { kind: "NUMERIC", bound: { upper: { value: { numerator: 15n, denominator: 1n }, inclusive: false } } },
      ],
    });
  });

  it("parses a structured legal clause into the same model with an actor scope", () => {
    const text = 'Clause 4.1: IF Credit > 100 THEN Vendor MUST NOT AccessGranted.';
    const document = parsed(parseOffline(request("CLAUSE", text)));
    const rule = document.rules[0];
    expect(rule).toMatchObject({ id: "C4.1", modality: "MUST_NOT" });
    expect(rule?.scope.actors).toEqual([{ variable: "Party", values: ["Vendor"] }]);
    expect(rule?.source.end.offset).toBe(text.length);
  });

  it("rejects malformed clauses with source-located diagnostics and preserves the text", () => {
    const text = 'R1: WHEN Role = "Admin", THE SYSTEM SHALL AccessGranted\nthis is not a rule';
    const result = parseOffline(request("EARS", text));
    expect(result.status).toBe("REJECTED");
    if (result.status !== "REJECTED") return;
    expect(result.source?.text).toBe(text);
    const [diagnostic] = result.diagnostics;
    expect(diagnostic.severity).toBe("ERROR");
    expect(diagnostic.location?.start).toMatchObject({ line: 2, column: 1 });
    expect(text.slice(diagnostic.location?.start.offset, diagnostic.location?.end.offset)).toBe("this is not a rule");
  });

  it("reports undeclared variables, bad enum values, and duplicate IDs as errors", () => {
    const codes = (text: string): string[] => {
      const result = parseOffline(request("EARS", text));
      return result.status === "REJECTED" ? result.diagnostics.map((d) => d.code) : [];
    };
    expect(codes("R1: WHEN Ghost, THE SYSTEM SHALL AccessGranted")).toEqual(["UNDECLARED_VARIABLE"]);
    expect(codes('R1: WHEN Role = "Nobody", THE SYSTEM SHALL AccessGranted')).toEqual(["INVALID_ENUM_VALUE"]);
    expect(codes("R1: THE SYSTEM SHALL AccessGranted\nR1: THE SYSTEM SHALL AccessGranted")).toEqual(["DUPLICATE_RULE_ID"]);
  });

  it("keeps recognized unsupported theory as a located construct without inventing a rule", () => {
    const text = [
      "R1: THE SYSTEM SHALL AccessGranted",
      "R2: WHEN Credit > Retries, THE SYSTEM SHALL AccessGranted",
      "R3: WHEN Retries * Credit > 3, THE SYSTEM SHALL AccessGranted",
    ].join("\n");
    const result = parseOffline(request("EARS", text));
    const document = parsed(result);
    expect(document.rules.map((rule) => rule.id)).toEqual(["R1"]);
    expect(document.unsupportedConstructs.map((c) => c.theory)).toEqual(["VARIABLE_ARITHMETIC", "NONLINEAR"]);
    const construct = document.unsupportedConstructs[0];
    expect(text.slice(construct?.source.start.offset, construct?.source.end.offset)).toBe(
      "R2: WHEN Credit > Retries, THE SYSTEM SHALL AccessGranted",
    );
    expect(result.diagnostics.map((d) => [d.code, d.severity])).toEqual([
      ["UNSUPPORTED_THEORY", "WARNING"],
      ["UNSUPPORTED_THEORY", "WARNING"],
    ]);
  });

  it("parses IF ... THEN EARS, boolean = literals, and keeps IDs stable across blank lines", () => {
    const text = "IF EmergencyOverride = false THEN THE SYSTEM SHALL AccessGranted.\n\n\nTHE SYSTEM SHALL NOT AccessGranted";
    const document = parsed(parseOffline(request("EARS", text)));
    expect(document.rules.map((rule) => rule.id)).toEqual(["R1", "R2"]);
    expect(document.rules[0]?.activation).toEqual({ kind: "BOOLEAN", variable: "EmergencyOverride", equals: false });
  });

  it("classifies embedded arithmetic and quantifiers as unsupported, keeping the rule ID in the locator", () => {
    const text = ["A: WHEN Credit > 5 * 2, THE SYSTEM SHALL AccessGranted", "B: WHEN Retries-1 > 5, THE SYSTEM SHALL AccessGranted", "C: WHEN EXISTS Retries, THE SYSTEM SHALL AccessGranted", "D: WHEN Retries > -1, THE SYSTEM SHALL AccessGranted"].join("\n");
    const document = parsed(parseOffline(request("EARS", text)));
    expect(document.unsupportedConstructs.map((c) => [c.source.clauseRef, c.theory])).toEqual([
      ["A", "NONLINEAR"],
      ["B", "VARIABLE_ARITHMETIC"],
      ["C", "QUANTIFIER"],
    ]);
    expect(document.rules.map((rule) => rule.id)).toEqual(["D"]);
  });

  it("round-trips through serialized JSON and revalidates", () => {
    const document = parsed(parseOffline(request("EARS", earsText)));
    const restored = parseCovenantJson(stringifyCovenant(document));
    expect(validateCovenantDocument(restored).status).toBe("VALID");
    expect(stringifyCovenant(restored)).toBe(stringifyCovenant(document));
  });

  it("handles CRLF line endings with exact spans", () => {
    const text = "R1: THE SYSTEM SHALL AccessGranted\r\nR2: THE SYSTEM SHALL NOT AccessGranted";
    const document = parsed(parseOffline(request("EARS", text)));
    const second = document.rules[1];
    expect(text.slice(second?.source.start.offset, second?.source.end.offset)).toBe("R2: THE SYSTEM SHALL NOT AccessGranted");
    expect(document.rules[0] && text.slice(document.rules[0].source.start.offset, document.rules[0].source.end.offset)).toBe("R1: THE SYSTEM SHALL AccessGranted");
  });

  it("returns byte-identical output for repeated parses", () => {
    const first = stringifyCovenant(parseOffline(request("EARS", earsText)));
    const second = stringifyCovenant(parseOffline(request("EARS", earsText)));
    expect(second).toBe(first);
  });

  it("rejects non-object and malformed requests without throwing", () => {
    for (const input of [null, 42, "text", {}, { source: { id: 1 } }, { ...(request("EARS", "") as object), declaredVariables: "x" }]) {
      const result = parseOffline(input);
      expect(result.status).toBe("REJECTED");
      expect(result.diagnostics[0].code).toBe("INVALID_INPUT");
    }
  });
});

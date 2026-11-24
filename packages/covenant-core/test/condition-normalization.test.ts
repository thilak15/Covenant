import { describe, expect, it } from "vitest";
import {
  compileRule,
  compileScope,
  normalizeCondition,
  parseRational,
  serializeRational,
  compareRationals,
  type Condition,
  type NormalizedCondition,
  type Rule,
  type RuleScope,
} from "../src/index.js";

const flag = (variable: string, equals = true): Condition => ({ kind: "BOOLEAN", variable, equals });
const atom = (condition: Condition): NormalizedCondition => {
  const normalized = normalizeCondition(condition);
  return normalized;
};
const one = { numerator: 1n, denominator: 1n };

describe("exact rationals", () => {
  it("parses decimal literals into reduced BigInt rationals without floating point", () => {
    const cases: readonly [string, string, string][] = [
      ["0.50", "1", "2"],
      ["-1.5e1", "-15", "1"],
      ["1e-3", "1", "1000"],
      ["12", "12", "1"],
      ["0.0", "0", "1"],
      ["-0", "0", "1"],
      ["123456789012345678901234567890.5", "246913578024691357802469135781", "2"],
    ];
    for (const [literal, numerator, denominator] of cases) {
      const value = parseRational(literal);
      expect(value && serializeRational(value)).toEqual({ numerator, denominator });
    }
  });

  it("rejects malformed literals and compares exactly", () => {
    for (const literal of ["", "1.", ".5", "1e", "abc", "1,5", " 1"]) expect(parseRational(literal)).toBeNull();
    const a = parseRational("0.1");
    const b = parseRational("0.10000000000000000001");
    expect(a && b && compareRationals(a, b)).toBe(-1);
    expect(a && compareRationals(a, a)).toBe(0);
  });
});

describe("normalizeCondition", () => {
  it("pushes negation to atoms using De Morgan", () => {
    const input: Condition = {
      kind: "NOT",
      condition: { kind: "ALL", conditions: [flag("A"), { kind: "ENUM", variable: "R", operator: "EQ", value: "x" }] },
    };
    expect(normalizeCondition(input)).toEqual({
      kind: "ANY",
      conditions: [
        { kind: "ATOM", atom: { kind: "BOOLEAN", variable: "A", equals: false } },
        { kind: "ATOM", atom: { kind: "ENUM", variable: "R", operator: "NEQ", value: "x" } },
      ],
    });
  });

  it("collapses double negation", () => {
    expect(normalizeCondition({ kind: "NOT", condition: { kind: "NOT", condition: flag("A") } })).toEqual(atom(flag("A")));
  });

  it("negates a numeric interval into the disjunction of its complements", () => {
    const bound = {
      variable: "x",
      domain: "INTEGER",
      lower: { value: one, inclusive: false },
      upper: { value: { numerator: 9n, denominator: 1n }, inclusive: true },
    } as const;
    expect(normalizeCondition({ kind: "NOT", condition: { kind: "NUMERIC", bound } })).toEqual({
      kind: "ANY",
      conditions: [
        { kind: "ATOM", atom: { kind: "NUMERIC", bound: { variable: "x", domain: "INTEGER", upper: { value: one, inclusive: true } } } },
        {
          kind: "ATOM",
          atom: { kind: "NUMERIC", bound: { variable: "x", domain: "INTEGER", lower: { value: { numerator: 9n, denominator: 1n }, inclusive: false } } },
        },
      ],
    });
  });

  it("negates an unbounded interval to FALSE and keeps a non-empty one as an atom", () => {
    expect(normalizeCondition({ kind: "NOT", condition: { kind: "NUMERIC", bound: { variable: "x", domain: "DECIMAL" } } })).toEqual({ kind: "FALSE" });
    expect(normalizeCondition({ kind: "NUMERIC", bound: { variable: "x", domain: "DECIMAL" } })).toEqual({ kind: "TRUE" });
  });

  it("flattens nesting, removes identities, and preserves atom order", () => {
    const input: Condition = {
      kind: "ALL",
      conditions: [flag("A"), { kind: "ALL", conditions: [{ kind: "TRUE" }, flag("B"), { kind: "ALL", conditions: [flag("C")] }] }],
    };
    expect(normalizeCondition(input)).toEqual({
      kind: "ALL",
      conditions: ["A", "B", "C"].map((name) => atom(flag(name))),
    });
    expect(normalizeCondition({ kind: "ANY", conditions: [{ kind: "FALSE" }, flag("A")] })).toEqual(atom(flag("A")));
    expect(normalizeCondition({ kind: "ALL", conditions: [flag("A"), { kind: "FALSE" }] })).toEqual({ kind: "FALSE" });
    expect(normalizeCondition({ kind: "ANY", conditions: [flag("A"), { kind: "TRUE" }] })).toEqual({ kind: "TRUE" });
  });
});

describe("compileRule", () => {
  const scope: RuleScope = {
    actors: [{ variable: "Role", values: ["Admin", "Root"] }],
    resources: [],
    actions: [{ variable: "Op", values: ["Read"] }],
    context: flag("Ctx"),
  };
  const location = { documentId: "d", clauseRef: "R1", start: { offset: 0, line: 1, column: 1 }, end: { offset: 1, line: 1, column: 2 } };
  const rule = (modality: Rule["modality"]): Rule => ({
    id: "R1",
    source: location,
    scope,
    activation: flag("Go"),
    modality,
    consequence: flag("Out"),
  });

  it("compiles scope as an implicit conjunct of activation in one expression", () => {
    expect(compileScope(scope)).toEqual({
      kind: "ALL",
      conditions: [
        { kind: "ANY", conditions: [{ kind: "ENUM", variable: "Role", operator: "EQ", value: "Admin" }, { kind: "ENUM", variable: "Role", operator: "EQ", value: "Root" }] },
        { kind: "ENUM", variable: "Op", operator: "EQ", value: "Read" },
        flag("Ctx"),
      ],
    });
    const compiled = compileRule(rule("MUST"));
    expect(compiled.applicability).toEqual(
      normalizeCondition({ kind: "ALL", conditions: [compileScope(scope), flag("Go")] }),
    );
  });

  it("gives an empty scope the TRUE identity", () => {
    const empty: RuleScope = { actors: [], resources: [], actions: [], context: { kind: "TRUE" } };
    expect(compileScope(empty)).toEqual({ kind: "TRUE" });
  });

  it("maps modality to hard consequence or permission", () => {
    const must = compileRule(rule("MUST"));
    expect(must.hardConsequence).toEqual(atom(flag("Out")));
    expect(must.permission).toBeNull();
    const mustNot = compileRule(rule("MUST_NOT"));
    expect(mustNot.hardConsequence).toEqual(atom(flag("Out", false)));
    expect(mustNot.permission).toBeNull();
    const may = compileRule(rule("MAY"));
    expect(may.hardConsequence).toBeNull();
    expect(may.permission).toEqual(atom(flag("Out")));
    expect(may.triggeredConsequence).toEqual({ ruleId: "R1", modality: "MAY", consequence: flag("Out") });
    expect(may.source).toBe(location);
  });
});

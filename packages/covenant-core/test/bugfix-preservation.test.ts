import fc, { type Arbitrary } from "fast-check";
import { describe, expect, it } from "vitest";
import {
  BrowserDeterministicSolver,
  assignmentSatisfiesSolverProblem,
  compileRule,
  makeRational,
  parseOffline,
  stringifyCovenant,
  validateCovenantDocument,
  verifyCovenant,
  type CovenantDocument,
  type NumericDomain,
  type NumericEndpoint,
  type NumericRange,
  type SolverProblem,
  type VariableDeclaration,
} from "../src/index.js";
import {
  parseOffline as parseOfflineBeforeFix,
  validateCovenantDocument as validateDocumentBeforeFix,
} from "./fixtures/legacy-parser.js";

const NUM_RUNS = 200;
const SEED = 20_261_201;
const INVERTED_CODE = "INVERTED_NUMERIC_RANGE";

interface RangeCase {
  readonly domain: NumericDomain;
  readonly range: NumericRange;
}
interface ParseCase extends RangeCase {
  readonly text: string;
}

const endpoint = (numerator: number, denominator: number, inclusive: boolean): NumericEndpoint => ({
  value: makeRational(BigInt(numerator), BigInt(denominator)),
  inclusive,
});
const domainArbitrary: Arbitrary<NumericDomain> = fc.constantFrom("INTEGER", "DECIMAL");
/** Two numerators over one shared denominator keep ordering explicit while exercising non-integer rationals. */
const orderedPair = fc.record({
  denominator: fc.integer({ min: 1, max: 8 }),
  low: fc.integer({ min: -40, max: 40 }),
  gap: fc.integer({ min: 1, max: 40 }),
});

/** Declared ranges that are inverted: lower > upper, or equal endpoints with at least one exclusive. */
const invertedRangeArbitrary: Arbitrary<RangeCase> = fc.oneof(
  fc.record({ domain: domainArbitrary, pair: orderedPair, lowerInclusive: fc.boolean(), upperInclusive: fc.boolean() }).map(
    ({ domain, pair, lowerInclusive, upperInclusive }): RangeCase => ({
      domain,
      range: {
        lower: endpoint(pair.low + pair.gap, pair.denominator, lowerInclusive),
        upper: endpoint(pair.low, pair.denominator, upperInclusive),
      },
    }),
  ),
  fc.record({
    domain: domainArbitrary,
    value: fc.integer({ min: -40, max: 40 }),
    denominator: fc.integer({ min: 1, max: 8 }),
    flags: fc.constantFrom({ lower: true, upper: false }, { lower: false, upper: true }, { lower: false, upper: false }),
  }).map(({ domain, value, denominator, flags }): RangeCase => ({
    domain,
    range: { lower: endpoint(value, denominator, flags.lower), upper: endpoint(value, denominator, flags.upper) },
  })),
);

/**
 * Declared ranges that were valid before the fix and must stay valid. INTEGER ranges always contain an
 * integer: ranges with no integer inside are a separate solver-contract gap outside this fix's scope.
 */
const validRangeArbitrary: Arbitrary<RangeCase> = fc.oneof(
  fc.record({ domain: domainArbitrary, pair: orderedPair, lowerInclusive: fc.boolean(), upperInclusive: fc.boolean() }).map(
    ({ domain, pair, lowerInclusive, upperInclusive }): RangeCase => {
      const integer = domain === "INTEGER";
      const denominator = integer ? 1 : pair.denominator;
      const gap = integer ? Math.max(pair.gap, 2) : pair.gap;
      return { domain, range: { lower: endpoint(pair.low, denominator, lowerInclusive), upper: endpoint(pair.low + gap, denominator, upperInclusive) } };
    },
  ),
  fc.record({ domain: domainArbitrary, value: fc.integer({ min: -40, max: 40 }), denominator: fc.integer({ min: 1, max: 8 }) }).map(
    ({ domain, value, denominator }): RangeCase => {
      const shared = endpoint(value, domain === "INTEGER" ? 1 : denominator, true);
      return { domain, range: { lower: shared, upper: shared } };
    },
  ),
  fc.record({ domain: domainArbitrary, value: fc.integer({ min: -40, max: 40 }), inclusive: fc.boolean() }).map(
    ({ domain, value, inclusive }): RangeCase => ({ domain, range: { lower: endpoint(value, 1, inclusive) } }),
  ),
  fc.record({ domain: domainArbitrary, value: fc.integer({ min: -40, max: 40 }), inclusive: fc.boolean() }).map(
    ({ domain, value, inclusive }): RangeCase => ({ domain, range: { upper: endpoint(value, 1, inclusive) } }),
  ),
  domainArbitrary.map((domain): RangeCase => ({ domain, range: {} })),
);

const when = fc.constantFrom("", "Role = \"Admin\"", "Role != \"Admin\"", "Granted", "Level >= 3", "Level < 0", "Role = \"Guest\" AND Level > 1", "Audit OR Level <= 5");
const consequence = fc.constantFrom("Granted", "Audit", "NOT Granted", "Level >= 2", "Level < 4", "Role = \"Admin\"");
const modality = fc.constantFrom("SHALL", "SHALL NOT", "MAY");
const textArbitrary: Arbitrary<string> = fc
  .array(fc.record({ when, consequence, modality }), { minLength: 1, maxLength: 4 })
  .map((rules) => rules.map((rule, index) => {
    const guard = rule.when === "" ? "" : `WHEN ${rule.when}, `;
    return `R${index + 1}: ${guard}THE SYSTEM ${rule.modality} ${rule.consequence}`;
  }).join("\n"));

const withText = (arbitrary: Arbitrary<RangeCase>): Arbitrary<ParseCase> =>
  fc.record({ declared: arbitrary, text: textArbitrary }).map(({ declared, text }) => ({ ...declared, text }));

function declarations({ domain, range }: RangeCase, extra: readonly unknown[] = []): readonly unknown[] {
  return [
    { kind: "ENUM", name: "Role", values: ["Admin", "Guest"] },
    { kind: "BOOLEAN", name: "Granted" },
    { kind: "BOOLEAN", name: "Audit" },
    { kind: "NUMERIC", name: "Level", domain, range },
    ...extra,
  ];
}
function request(declared: readonly unknown[], text: string): unknown {
  return { source: { id: "bugfix", revision: "r1", format: "EARS", text }, declaredVariables: declared, primaryWorkflows: [] };
}
const serialize = (value: unknown): string => stringifyCovenant(value);

function probeProblem(document: CovenantDocument): SolverProblem<"NONE"> {
  return {
    kind: "SUPPORTED",
    queryId: "bugfix-probe",
    variables: document.variables,
    fixedConstraints: document.rules.map((rule) => compileRule(rule).applicability),
    ruleGroups: [],
    coreTracking: "NONE",
  };
}

describe("Bug-fix preservation: inverted declared numeric ranges", () => {
  it("documents the defect: the pre-fix parser accepted an inverted declared range", () => {
    const declared = declarations({ domain: "INTEGER", range: { lower: endpoint(5, 1, true), upper: endpoint(1, 1, true) } });
    expect(parseOfflineBeforeFix(request(declared, "R1: THE SYSTEM SHALL Granted")).status).toBe("PARSED");
    expect(parseOffline(request(declared, "R1: THE SYSTEM SHALL Granted"))).toMatchObject({
      status: "REJECTED",
      diagnostics: [{ code: INVERTED_CODE, severity: "ERROR" }],
    });
  });

  it("(a) rejects every inverted range deterministically with a typed diagnostic", () => {
    let successful = 0;
    fc.assert(fc.property(withText(invertedRangeArbitrary), ({ text, ...declared }) => {
      const input = request(declarations(declared), text);
      // The defect exists before the fix: this input would have been accepted.
      expect(parseOfflineBeforeFix(input).status).toBe("PARSED");
      const first = parseOffline(input);
      const second = parseOffline(input);
      expect(first.status).toBe("REJECTED");
      expect(first.diagnostics.map((item) => item.code)).toEqual([INVERTED_CODE]);
      expect(first.diagnostics[0]).toMatchObject({ severity: "ERROR", location: null });
      expect(first.diagnostics[0]?.message).toContain("Level");
      expect(serialize(second)).toBe(serialize(first));
      // Direct document validation reports the same typed diagnostic.
      const document: unknown = {
        source: { id: "bugfix", revision: "r1", format: "EARS", text: "" },
        variables: declarations(declared), rules: [], primaryWorkflows: [], unsupportedConstructs: [],
      };
      const validated = validateCovenantDocument(document);
      expect(validated.status).toBe("INVALID");
      expect(validated.diagnostics.map((item) => item.code)).toEqual([INVERTED_CODE]);
      expect(validateDocumentBeforeFix(document).status).toBe("VALID");
      successful += 1;
    }), { numRuns: NUM_RUNS, seed: SEED });
    expect(successful).toBeGreaterThanOrEqual(NUM_RUNS);
  });

  it("(b) preserves ASTs, validation, verdicts, and solver outputs for every valid input", async () => {
    let successful = 0;
    await fc.assert(fc.asyncProperty(withText(validRangeArbitrary), async ({ text, ...declared }) => {
      const input = request(declarations(declared), text);
      const before = parseOfflineBeforeFix(input);
      const after = parseOffline(input);
      expect(serialize(after)).toBe(serialize(before));
      expect(after.status).toBe("PARSED");
      if (before.status !== "PARSED" || after.status !== "PARSED") return;
      expect(serialize(validateCovenantDocument(after.document))).toBe(serialize(validateDocumentBeforeFix(before.document)));
      const solver = new BrowserDeterministicSolver();
      const verdictsBefore = (await verifyCovenant(before.document, solver)).verdicts;
      const verdictsAfter = (await verifyCovenant(after.document, solver)).verdicts;
      expect(serialize(verdictsAfter)).toBe(serialize(verdictsBefore));
      const problem = probeProblem(after.document);
      const solvedBefore = await solver.solve(probeProblem(before.document));
      const solvedAfter = await solver.solve(problem);
      expect(solvedAfter.status).toBe(solvedBefore.status);
      expect(serialize({ ...solvedAfter, telemetry: null })).toBe(serialize({ ...solvedBefore, telemetry: null }));
      if (solvedAfter.status === "SAT") expect(await assignmentSatisfiesSolverProblem(problem, solvedAfter.model)).toBe(true);
      successful += 1;
    }), { numRuns: NUM_RUNS, seed: SEED });
    expect(successful).toBeGreaterThanOrEqual(NUM_RUNS);
  }, 120_000);

  it("(c) leaves unrelated rejections byte-identical before and after the fix", () => {
    const unrelated: Arbitrary<readonly unknown[]> = fc.constantFrom<readonly unknown[]>(
      [{ kind: "BOOLEAN", name: "Granted" }],
      [{ kind: "ENUM", name: "Role", values: [] }],
      [{ kind: "BOOLEAN", name: "AND" }],
    );
    fc.assert(fc.property(withText(validRangeArbitrary), unrelated, ({ text, ...declared }, extra) => {
      const input = request(declarations(declared, extra), text);
      const before = parseOfflineBeforeFix(input);
      expect(before.status).toBe("REJECTED");
      expect(serialize(parseOffline(input))).toBe(serialize(before));
    }), { numRuns: NUM_RUNS, seed: SEED });
  });
});

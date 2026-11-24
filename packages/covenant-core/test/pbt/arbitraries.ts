import fc, { type Arbitrary } from "fast-check";
import {
  makeRational,
  parseOffline,
  type Condition,
  type CovenantDocument,
  type NormalizedCondition,
  type SolverProblem,
  type VariableDeclaration,
} from "../../src/index.js";

export interface SoundnessCase {
  readonly tag: "DIRECT_CONSEQUENCE" | "CONSEQUENCE_APPLICABILITY";
  readonly document: CovenantDocument;
}

export interface SolverCase {
  readonly tag:
    | "TRACKED"
    | "BOOLEAN"
    | "ENUM"
    | "STRICT_BOUND"
    | "EQUAL_BOUND"
    | "UNBOUNDED"
    | "EMPTY_INTERSECTION"
    | "INTEGER_GAP"
    | "DECIMAL_OPEN_INTERVAL";
  readonly problem: SolverProblem<"RULES"> | SolverProblem<"NONE">;
}

const booleanVariables = [
  { kind: "BOOLEAN", name: "Gate" },
  { kind: "BOOLEAN", name: "Trigger" },
  { kind: "BOOLEAN", name: "Outcome" },
  { kind: "BOOLEAN", name: "Audit" },
] as const;

function parsedDocument(
  id: string,
  variables: readonly VariableDeclaration[],
  text: string,
): CovenantDocument {
  const parsed = parseOffline({
    source: { id, revision: "r1", format: "EARS", text },
    declaredVariables: variables,
    primaryWorkflows: [],
  });
  if (parsed.status !== "PARSED") {
    throw new Error(`Generated document did not parse: ${parsed.diagnostics.map((item) => item.code).join(", ")}`);
  }
  return parsed.document;
}

const activation = (equals: boolean): string => equals ? "Gate" : "NOT Gate";

export const soundnessCaseArbitrary: Arbitrary<SoundnessCase> = fc
  .record({ ordinal: fc.nat({ max: 1_000_000 }), gate: fc.boolean(), applicabilityConflict: fc.boolean() })
  .map(({ ordinal, gate, applicabilityConflict }) => {
    const id = `soundness-${ordinal}-${gate ? "t" : "f"}-${applicabilityConflict ? "a" : "c"}`;
    if (applicabilityConflict) {
      return {
        tag: "CONSEQUENCE_APPLICABILITY",
        document: parsedDocument(id, booleanVariables, [
          `R1: WHEN ${activation(gate)}, THE SYSTEM SHALL NOT Trigger`,
          "R2: WHEN Trigger, THE SYSTEM SHALL Outcome",
        ].join("\n")),
      };
    }
    return {
      tag: "DIRECT_CONSEQUENCE",
      document: parsedDocument(id, booleanVariables, [
        `R1: WHEN ${activation(gate)}, THE SYSTEM SHALL Outcome`,
        `R2: WHEN ${activation(gate)}, THE SYSTEM SHALL NOT Outcome`,
      ].join("\n")),
    };
  });

export const mutuallyExclusiveDocumentArbitrary: Arbitrary<CovenantDocument> = fc
  .nat({ max: 1_000_000 })
  .map((ordinal) => parsedDocument(
    `exclusive-${ordinal}`,
    [
      { kind: "ENUM", name: "Role", values: ["Admin", "Guest"] },
      { kind: "BOOLEAN", name: "Outcome" },
    ],
    [
      'R1: WHEN Role = "Admin", THE SYSTEM SHALL Outcome',
      'R2: WHEN Role = "Guest", THE SYSTEM SHALL NOT Outcome',
    ].join("\n"),
  ));

export const repairDocumentArbitrary: Arbitrary<CovenantDocument> = fc
  .record({ ordinal: fc.nat({ max: 1_000_000 }), unrelatedWhen: fc.boolean(), unrelatedValue: fc.boolean() })
  .map(({ ordinal, unrelatedWhen, unrelatedValue }) => parsedDocument(
    `preservation-${ordinal}-${unrelatedWhen ? "t" : "f"}-${unrelatedValue ? "t" : "f"}`,
    booleanVariables,
    [
      "R1: WHEN Trigger, THE SYSTEM SHALL Outcome",
      "R2: WHEN Trigger, THE SYSTEM SHALL NOT Outcome",
      `R3: WHEN ${unrelatedWhen ? "Gate" : "NOT Gate"}, THE SYSTEM SHALL ${unrelatedValue ? "Audit" : "NOT Audit"}`,
    ].join("\n"),
  ));

const boolAtom = (variable: string, equals: boolean): NormalizedCondition => ({
  kind: "ATOM",
  atom: { kind: "BOOLEAN", variable, equals },
});

const enumAtom = (operator: "EQ" | "NEQ", value: string): NormalizedCondition => ({
  kind: "ATOM",
  atom: { kind: "ENUM", variable: "Role", operator, value },
});

const numericAtom = (
  domain: "INTEGER" | "DECIMAL",
  lower?: readonly [number, boolean],
  upper?: readonly [number, boolean],
): NormalizedCondition => ({
  kind: "ATOM",
  atom: {
    kind: "NUMERIC",
    bound: {
      variable: "Value",
      domain,
      ...(lower === undefined ? {} : { lower: { value: makeRational(BigInt(lower[0]), 1n), inclusive: lower[1] } }),
      ...(upper === undefined ? {} : { upper: { value: makeRational(BigInt(upper[0]), 1n), inclusive: upper[1] } }),
    },
  },
});

function untracked(
  queryId: string,
  variables: readonly VariableDeclaration[],
  constraints: readonly NormalizedCondition[],
): SolverProblem<"NONE"> {
  return { kind: "SUPPORTED", queryId, variables, fixedConstraints: constraints, ruleGroups: [], coreTracking: "NONE" };
}

function tracked(queryId: string, polarity: boolean): SolverProblem<"RULES"> {
  const consequence = (ruleId: string, equals: boolean): Condition => ({ kind: "BOOLEAN", variable: "Flag", equals });
  return {
    kind: "SUPPORTED",
    queryId,
    variables: [{ kind: "BOOLEAN", name: "Flag" }],
    fixedConstraints: [],
    ruleGroups: [
      {
        ruleId: "R1",
        constraints: [boolAtom("Flag", polarity)],
        consequence: { ruleId: "R1", modality: "MUST", consequence: consequence("R1", polarity) },
      },
      {
        ruleId: "R2",
        constraints: [boolAtom("Flag", !polarity)],
        consequence: { ruleId: "R2", modality: "MUST_NOT", consequence: consequence("R2", polarity) },
      },
    ],
    coreTracking: "RULES",
  };
}

export const solverCaseArbitrary: Arbitrary<SolverCase> = fc
  .record({ ordinal: fc.nat({ max: 1_000_000 }), pivot: fc.integer({ min: -20, max: 20 }), polarity: fc.boolean(), variant: fc.integer({ min: 0, max: 8 }) })
  .map(({ ordinal, pivot, polarity, variant }) => {
    const queryId = `equivalence-${variant}-${ordinal}`;
    switch (variant) {
      case 0:
        return { tag: "TRACKED", problem: tracked(queryId, polarity) };
      case 1:
        return { tag: "BOOLEAN", problem: untracked(queryId, [{ kind: "BOOLEAN", name: "Flag" }], [boolAtom("Flag", polarity)]) };
      case 2:
        return { tag: "ENUM", problem: untracked(queryId, [{ kind: "ENUM", name: "Role", values: ["Admin", "Guest"] }], [enumAtom("EQ", polarity ? "Admin" : "Guest"), enumAtom("NEQ", polarity ? "Guest" : "Admin")]) };
      case 3:
        return { tag: "STRICT_BOUND", problem: untracked(queryId, [{ kind: "NUMERIC", name: "Value", domain: "INTEGER" }], [numericAtom("INTEGER", [pivot, false])]) };
      case 4:
        return { tag: "EQUAL_BOUND", problem: untracked(queryId, [{ kind: "NUMERIC", name: "Value", domain: "DECIMAL" }], [numericAtom("DECIMAL", [pivot, true], [pivot, true])]) };
      case 5:
        return { tag: "UNBOUNDED", problem: untracked(queryId, [{ kind: "NUMERIC", name: "Value", domain: "DECIMAL" }], [numericAtom("DECIMAL", undefined, [pivot, polarity])]) };
      case 6:
        return { tag: "EMPTY_INTERSECTION", problem: untracked(queryId, [{ kind: "NUMERIC", name: "Value", domain: "DECIMAL" }], [numericAtom("DECIMAL", [pivot + 1, true]), numericAtom("DECIMAL", undefined, [pivot, true])]) };
      case 7:
        return { tag: "INTEGER_GAP", problem: untracked(queryId, [{ kind: "NUMERIC", name: "Value", domain: "INTEGER" }], [numericAtom("INTEGER", [pivot, false]), numericAtom("INTEGER", undefined, [pivot + 1, false])]) };
      default:
        return { tag: "DECIMAL_OPEN_INTERVAL", problem: untracked(queryId, [{ kind: "NUMERIC", name: "Value", domain: "DECIMAL" }], [numericAtom("DECIMAL", [pivot, false]), numericAtom("DECIMAL", undefined, [pivot + 1, false])]) };
    }
  });

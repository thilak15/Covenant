import type {
  Condition,
  CovenantDocument,
  DeonticModality,
  PrimaryWorkflow,
  Rule,
  VariableDeclaration,
} from "../../src/index.js";

export const flag = (variable: string, equals = true): Condition => ({ kind: "BOOLEAN", variable, equals });
export const enumIs = (variable: string, value: string): Condition => ({ kind: "ENUM", variable, operator: "EQ", value });

export interface FixtureRule {
  readonly id: string;
  readonly activation?: Condition;
  readonly modality: DeonticModality;
  readonly consequence: Condition;
}

export function fixtureDocument(
  id: string,
  variables: readonly VariableDeclaration[],
  definitions: readonly FixtureRule[],
  primaryWorkflows: readonly PrimaryWorkflow[] = [],
): CovenantDocument {
  const text = definitions.map((rule) => `${rule.id}: THE SYSTEM ${rule.modality} condition`).join("\n") || "# empty";
  let offset = 0;
  const rules: Rule[] = definitions.map((definition, index) => {
    const sourceText = `${definition.id}: THE SYSTEM ${definition.modality} condition`;
    const start = offset;
    offset += sourceText.length + (index < definitions.length - 1 ? 1 : 0);
    return {
      id: definition.id,
      source: {
        documentId: id,
        clauseRef: definition.id,
        start: { offset: start, line: index + 1, column: 1 },
        end: { offset: start + sourceText.length, line: index + 1, column: sourceText.length + 1 },
      },
      scope: { actors: [], resources: [], actions: [], context: { kind: "TRUE" } },
      activation: definition.activation ?? { kind: "TRUE" },
      modality: definition.modality,
      consequence: definition.consequence,
    };
  });
  return {
    source: { id, revision: "r1", format: "EARS", text },
    variables,
    rules,
    primaryWorkflows,
    unsupportedConstructs: [],
  };
}

const baseVariables: readonly VariableDeclaration[] = [
  { kind: "ENUM", name: "Role", values: ["Admin", "Contractor"] },
  { kind: "BOOLEAN", name: "EmergencyOverride" },
  { kind: "BOOLEAN", name: "AccessGranted" },
];

export const cursedScrolls: readonly CovenantDocument[] = [
  fixtureDocument("rbac-emergency", baseVariables, [
    { id: "R1", activation: enumIs("Role", "Contractor"), modality: "MUST", consequence: flag("AccessGranted") },
    { id: "R2", activation: enumIs("Role", "Contractor"), modality: "MUST_NOT", consequence: flag("AccessGranted") },
  ]),
  fixtureDocument("sandbox-deadlock", [{ kind: "BOOLEAN", name: "CanWork" }], [
    { id: "R1", modality: "MUST_NOT", consequence: flag("CanWork") },
  ], [{ id: "normal-work", label: "Normal work", entry: { kind: "TRUE" }, requiredConsequences: [flag("CanWork")] }]),
  fixtureDocument("api-security", [
    { kind: "BOOLEAN", name: "CWE_862_APPLIES" },
    { kind: "BOOLEAN", name: "CWE_862_REQUIRED" },
  ], [{ id: "R1", activation: flag("CWE_862_APPLIES"), modality: "MUST", consequence: flag("CWE_862_REQUIRED", false) }]),
  fixtureDocument("liability", [{ kind: "BOOLEAN", name: "LiabilityCapped" }], [
    { id: "C1", modality: "MUST", consequence: flag("LiabilityCapped") },
    { id: "C2", modality: "MUST_NOT", consequence: flag("LiabilityCapped") },
  ]),
  fixtureDocument("freelance-ip", [{ kind: "BOOLEAN", name: "OwnsBackgroundIp" }], [
    { id: "C1", modality: "MUST", consequence: flag("OwnsBackgroundIp") },
    { id: "C2", modality: "MUST_NOT", consequence: flag("OwnsBackgroundIp") },
  ]),
  fixtureDocument("sla-force-majeure", [{ kind: "BOOLEAN", name: "CreditDue" }], [
    { id: "C1", modality: "MUST", consequence: flag("CreditDue") },
    { id: "C2", modality: "MUST_NOT", consequence: flag("CreditDue") },
  ]),
];

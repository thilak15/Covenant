import { parseOffline, type CovenantDocument, type PrimaryWorkflow, type VariableDeclaration } from "../../src/index.js";

function parseRepairDocument(
  id: string,
  variables: readonly VariableDeclaration[],
  lines: readonly string[],
  primaryWorkflows: readonly PrimaryWorkflow[] = [],
  format: "EARS" | "CLAUSE" = "EARS",
): CovenantDocument {
  const parsed = parseOffline({
    source: {
      id,
      revision: "revision-1",
      format,
      text: lines.join("\n"),
    },
    declaredVariables: variables,
    primaryWorkflows,
  });
  if (parsed.status !== "PARSED") {
    throw new Error(`Repair fixture did not parse: ${parsed.diagnostics.map((item) => item.code).join(", ")}`);
  }
  return parsed.document;
}

const variables = [
  { kind: "BOOLEAN", name: "Trigger" },
  { kind: "BOOLEAN", name: "AccessGranted" },
  { kind: "BOOLEAN", name: "AuditRecorded" },
] as const;

export function standardRepairDocument(): CovenantDocument {
  return parseRepairDocument("standard-repair", variables, [
    "R1: WHEN Trigger, THE SYSTEM SHALL AccessGranted",
    "R2: WHEN Trigger, THE SYSTEM SHALL NOT AccessGranted",
    "R3: WHEN Trigger, THE SYSTEM SHALL AuditRecorded",
  ]);
}

export function standardUnambiguityDocument(): CovenantDocument {
  return parseRepairDocument(
    "standard-unambiguity",
    [{ kind: "BOOLEAN", name: "Allowed" }],
    [
      "R1: THE SYSTEM MAY Allowed",
      "R2: THE SYSTEM SHALL NOT Allowed",
    ],
  );
}

export function standardSecurityDocument(): CovenantDocument {
  return parseRepairDocument(
    "standard-security",
    [
      { kind: "BOOLEAN", name: "CWE_862_APPLIES" },
      { kind: "BOOLEAN", name: "CWE_862_REQUIRED" },
      { kind: "BOOLEAN", name: "OperationHandled" },
    ],
    ["R1: WHEN CWE_862_APPLIES, THE SYSTEM SHALL OperationHandled"],
  );
}

export function coveredCustomSecurityDocument(): CovenantDocument {
  return parseRepairDocument(
    "covered-custom-security",
    [
      { kind: "BOOLEAN", name: "CWE_862_APPLIES" },
      { kind: "BOOLEAN", name: "CWE_862_REQUIRED" },
      { kind: "BOOLEAN", name: "OperationHandled" },
    ],
    [
      "R1: WHEN CWE_862_APPLIES, THE SYSTEM SHALL OperationHandled",
      "R2: WHEN NOT CWE_862_APPLIES, THE SYSTEM SHALL OperationHandled",
    ],
  );
}

export function securityVariantDocuments(): readonly CovenantDocument[] {
  const variables: readonly VariableDeclaration[] = [
    { kind: "BOOLEAN", name: "CWE_862_APPLIES" },
    { kind: "BOOLEAN", name: "CWE_862_REQUIRED" },
    { kind: "BOOLEAN", name: "OperationHandled" },
  ];
  return [
    parseRepairDocument("security-may", variables, ["R1: WHEN CWE_862_APPLIES, THE SYSTEM MAY OperationHandled"]),
    parseRepairDocument("security-must-not", variables, ["R1: WHEN CWE_862_APPLIES, THE SYSTEM SHALL NOT OperationHandled"]),
    parseRepairDocument(
      "security-clause",
      [{ kind: "ENUM", name: "Party", values: ["Vendor"] }, ...variables],
      ["Clause 1: IF CWE_862_APPLIES THEN Vendor MUST OperationHandled"],
      [],
      "CLAUSE",
    ),
  ];
}

export function unresolvedRepairDocument(): CovenantDocument {
  return parseRepairDocument(
    "unresolved-repair",
    [
      { kind: "BOOLEAN", name: "Trigger" },
      { kind: "BOOLEAN", name: "Outcome" },
      { kind: "BOOLEAN", name: "Audit" },
    ],
    [
      "R1: WHEN Trigger, THE SYSTEM SHALL Outcome",
      "R2: WHEN Trigger, THE SYSTEM SHALL NOT Outcome",
      "R3: THE SYSTEM MAY Audit",
      "R4: THE SYSTEM SHALL NOT Audit",
    ],
  );
}

export function customRepairDocument(availableCandidates: 0 | 1): CovenantDocument {
  const document = parseRepairDocument(
    `custom-${availableCandidates}`,
    [{ kind: "BOOLEAN", name: "Outcome" }],
    [
      "R1: THE SYSTEM SHALL Outcome",
      "R2: THE SYSTEM SHALL NOT Outcome",
    ],
  );
  return {
    ...document,
    rules: document.rules.map((rule, index) => {
      if ((availableCandidates === 1 && index === 0) || (availableCandidates === 0 && index < 2)) return {
        ...rule,
        source: { ...rule.source, end: { ...rule.source.start } },
      };
      return rule;
    }),
  };
}

export function standardLivenessDocument(): CovenantDocument {
  return parseRepairDocument(
    "standard-liveness",
    [{ kind: "BOOLEAN", name: "CanWork" }],
    ["R1: THE SYSTEM SHALL NOT CanWork"],
    [{ id: "normal-work", label: "Normal work", entry: { kind: "TRUE" }, requiredConsequences: [{ kind: "BOOLEAN", variable: "CanWork", equals: true }] }],
  );
}

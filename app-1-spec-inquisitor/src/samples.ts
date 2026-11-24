import {
  documentSemanticFingerprint,
  findingFingerprint,
  ruleFingerprint,
  validateCovenantDocument,
  verifyCovenant,
} from "@covenant/core";
import type {
  CanonicalRational,
  ChalicePatch,
  Condition,
  CovenantDocument,
  CovenantSolver,
  Finding,
  Inquisitor,
  InquisitorVerdict,
  NonEmpty,
  PairResolution,
  PatchRejectionReason,
  PreservationProof,
  Rule,
  RuleScope,
  ScopeFacet,
  SourceEdit,
  SourceLocation,
  VariableAssignment,
  VariableDeclaration,
  VerificationReport,
} from "@covenant/core";

const TRUE: Condition = { kind: "TRUE" };
const bool = (variable: string, equals = true): Condition => ({ kind: "BOOLEAN", variable, equals });
const eq = (variable: string, value: string): Condition => ({ kind: "ENUM", variable, operator: "EQ", value });
const neq = (variable: string, value: string): Condition => ({ kind: "ENUM", variable, operator: "NEQ", value });
const all = (first: Condition, ...rest: readonly Condition[]): Condition => ({ kind: "ALL", conditions: [first, ...rest] });
const not = (condition: Condition): Condition => ({ kind: "NOT", condition });
const q = (numerator: bigint, denominator = 1n): CanonicalRational => ({ numerator, denominator });
const numericAtLeast = (variable: string, value: bigint): Condition => ({
  kind: "NUMERIC",
  bound: { variable, domain: "INTEGER", lower: { value: q(value), inclusive: true } },
});
const facet = (variable: string, first: string, ...rest: readonly string[]): ScopeFacet => ({ variable, values: [first, ...rest] });
const scope = (
  actors: readonly ScopeFacet[],
  resources: readonly ScopeFacet[],
  actions: readonly ScopeFacet[],
  context: Condition = TRUE,
): RuleScope => ({ actors, resources, actions, context });

function sourceLocation(documentId: string, text: string, clauseRef: string): SourceLocation {
  const prefix = `${clauseRef} | `;
  const lines = text.split("\n");
  const matching = lines.flatMap((line, index) => line.startsWith(prefix) ? [{ line, index }] : []);
  if (matching.length !== 1) throw new TypeError(`Fixture ${documentId} must contain exactly one ${clauseRef} source line`);
  const match = matching[0];
  if (match === undefined) throw new TypeError(`Fixture ${documentId} is missing ${clauseRef}`);
  const offset = lines.slice(0, match.index).reduce((total, line) => total + line.length + 1, 0);
  return {
    documentId,
    clauseRef,
    start: { offset, line: match.index + 1, column: 1 },
    end: { offset: offset + match.line.length, line: match.index + 1, column: match.line.length + 1 },
  };
}

function remapRules(documentId: string, text: string, rules: readonly Rule[]): readonly Rule[] {
  return rules.map((rule) => ({ ...rule, source: sourceLocation(documentId, text, rule.id) }));
}

function documentWith(
  base: CovenantDocument,
  revision: string,
  text: string,
  rules: readonly Rule[],
): CovenantDocument {
  return {
    ...base,
    source: { ...base.source, revision, text },
    rules: remapRules(base.source.id, text, rules),
  };
}

export const RBAC_EMERGENCY_TEXT = [
  "RBAC-01 | WHEN a Contractor has an active emergency override THE SYSTEM SHALL permit that Contractor to deploy to production.",
  "RBAC-02 | WHILE the day is Sunday THE SYSTEM SHALL prohibit every Contractor from deploying to production.",
  "RBAC-03 | WHEN an Administrator deploys to production THE SYSTEM SHALL record the deployment in the audit log.",
].join("\n");

const rbacVariables: readonly VariableDeclaration[] = [
  { kind: "ENUM", name: "actorRole", values: ["CONTRACTOR", "ADMINISTRATOR", "EMPLOYEE"] },
  { kind: "ENUM", name: "resource", values: ["PRODUCTION"] },
  { kind: "ENUM", name: "action", values: ["DEPLOY"] },
  { kind: "BOOLEAN", name: "emergencyOverride" },
  { kind: "ENUM", name: "day", values: ["SUNDAY", "WEEKDAY"] },
  { kind: "BOOLEAN", name: "deployPermitted" },
  { kind: "BOOLEAN", name: "auditRecorded" },
];

const rbacRules: readonly Rule[] = [
  {
    id: "RBAC-01",
    source: sourceLocation("sample.app1.rbac-emergency", RBAC_EMERGENCY_TEXT, "RBAC-01"),
    scope: scope([facet("actorRole", "CONTRACTOR")], [facet("resource", "PRODUCTION")], [facet("action", "DEPLOY")]),
    activation: bool("emergencyOverride"),
    modality: "MUST",
    consequence: bool("deployPermitted"),
  },
  {
    id: "RBAC-02",
    source: sourceLocation("sample.app1.rbac-emergency", RBAC_EMERGENCY_TEXT, "RBAC-02"),
    scope: scope([facet("actorRole", "CONTRACTOR")], [facet("resource", "PRODUCTION")], [facet("action", "DEPLOY")], eq("day", "SUNDAY")),
    activation: TRUE,
    modality: "MUST_NOT",
    consequence: bool("deployPermitted"),
  },
  {
    id: "RBAC-03",
    source: sourceLocation("sample.app1.rbac-emergency", RBAC_EMERGENCY_TEXT, "RBAC-03"),
    scope: scope([facet("actorRole", "ADMINISTRATOR")], [facet("resource", "PRODUCTION")], [facet("action", "DEPLOY")]),
    activation: TRUE,
    modality: "MUST",
    consequence: bool("auditRecorded"),
  },
];

const rbacDocument: CovenantDocument = {
  source: { id: "sample.app1.rbac-emergency", revision: "sha256:sample-app1-rbac-v1", format: "EARS", text: RBAC_EMERGENCY_TEXT },
  variables: rbacVariables,
  rules: rbacRules,
  primaryWorkflows: [],
  unsupportedConstructs: [],
};

export const SANDBOX_DEADLOCK_TEXT = [
  "SAN-01 | WHILE the Agent sandbox is hardened THE SYSTEM SHALL prohibit writes to the trusted workspace.",
  "SAN-02 | WHILE the Agent sandbox is hardened THE SYSTEM SHALL prohibit process execution for edit-and-test work.",
  "SAN-03 | WHEN the Agent performs edit-and-test work in the trusted workspace THE SYSTEM SHALL permit workspace reads.",
].join("\n");

const sandboxVariables: readonly VariableDeclaration[] = [
  { kind: "ENUM", name: "principal", values: ["AGENT"] },
  { kind: "ENUM", name: "workspace", values: ["TRUSTED", "UNTRUSTED"] },
  { kind: "ENUM", name: "action", values: ["EDIT_AND_TEST", "READ_ONLY"] },
  { kind: "ENUM", name: "sandboxMode", values: ["HARDENED", "STANDARD"] },
  { kind: "BOOLEAN", name: "workspaceReadAllowed" },
  { kind: "BOOLEAN", name: "workspaceWriteAllowed" },
  { kind: "BOOLEAN", name: "processExecutionAllowed" },
];

const sandboxScope = scope(
  [facet("principal", "AGENT")],
  [facet("workspace", "TRUSTED")],
  [facet("action", "EDIT_AND_TEST")],
  eq("sandboxMode", "HARDENED"),
);
const sandboxRules: readonly Rule[] = [
  {
    id: "SAN-01",
    source: sourceLocation("sample.app1.sandbox-deadlock", SANDBOX_DEADLOCK_TEXT, "SAN-01"),
    scope: sandboxScope,
    activation: TRUE,
    modality: "MUST_NOT",
    consequence: bool("workspaceWriteAllowed"),
  },
  {
    id: "SAN-02",
    source: sourceLocation("sample.app1.sandbox-deadlock", SANDBOX_DEADLOCK_TEXT, "SAN-02"),
    scope: sandboxScope,
    activation: TRUE,
    modality: "MUST_NOT",
    consequence: bool("processExecutionAllowed"),
  },
  {
    id: "SAN-03",
    source: sourceLocation("sample.app1.sandbox-deadlock", SANDBOX_DEADLOCK_TEXT, "SAN-03"),
    scope: scope([facet("principal", "AGENT")], [facet("workspace", "TRUSTED")], [facet("action", "EDIT_AND_TEST")]),
    activation: TRUE,
    modality: "MUST",
    consequence: bool("workspaceReadAllowed"),
  },
];
const sandboxDocument: CovenantDocument = {
  source: { id: "sample.app1.sandbox-deadlock", revision: "sha256:sample-app1-sandbox-v1", format: "EARS", text: SANDBOX_DEADLOCK_TEXT },
  variables: sandboxVariables,
  rules: sandboxRules,
  primaryWorkflows: [{
    id: "workflow.edit-and-test",
    label: "Agent edits and tests code in a trusted workspace",
    entry: all(eq("principal", "AGENT"), eq("workspace", "TRUSTED"), eq("action", "EDIT_AND_TEST"), eq("sandboxMode", "HARDENED")),
    requiredConsequences: [bool("workspaceReadAllowed"), bool("workspaceWriteAllowed"), bool("processExecutionAllowed")],
  }],
  unsupportedConstructs: [],
};

export const API_AUTHORIZATION_TEXT = [
  "API-01 | WHEN an authenticated account member has at least one rate-limit token THE SYSTEM SHALL accept an update to billing settings.",
  "API-02 | WHEN no rate-limit tokens remain THE SYSTEM SHALL prohibit acceptance of an update to billing settings.",
  "API-03 | WHEN a caller updates billing settings THE SYSTEM SHALL validate the request input.",
].join("\n");

const apiVariables: readonly VariableDeclaration[] = [
  { kind: "ENUM", name: "callerRole", values: ["ACCOUNT_MEMBER", "BILLING_ADMIN"] },
  { kind: "ENUM", name: "action", values: ["UPDATE_BILLING"] },
  { kind: "BOOLEAN", name: "authenticated" },
  { kind: "BOOLEAN", name: "authorizationVerified" },
  { kind: "NUMERIC", name: "rateLimitRemaining", domain: "INTEGER", range: { lower: { value: q(0n), inclusive: true }, upper: { value: q(1000n), inclusive: true } } },
  { kind: "BOOLEAN", name: "requestAccepted" },
  { kind: "BOOLEAN", name: "inputValidated" },
];
const apiBaseActivation = all(bool("authenticated"), numericAtLeast("rateLimitRemaining", 1n));
const apiRules: readonly Rule[] = [
  {
    id: "API-01",
    source: sourceLocation("sample.app1.api-cwe-862", API_AUTHORIZATION_TEXT, "API-01"),
    scope: scope([facet("callerRole", "ACCOUNT_MEMBER")], [], [facet("action", "UPDATE_BILLING")]),
    activation: apiBaseActivation,
    modality: "MUST",
    consequence: bool("requestAccepted"),
  },
  {
    id: "API-02",
    source: sourceLocation("sample.app1.api-cwe-862", API_AUTHORIZATION_TEXT, "API-02"),
    scope: scope([], [], [facet("action", "UPDATE_BILLING")]),
    activation: { kind: "NUMERIC", bound: { variable: "rateLimitRemaining", domain: "INTEGER", upper: { value: q(0n), inclusive: true } } },
    modality: "MUST_NOT",
    consequence: bool("requestAccepted"),
  },
  {
    id: "API-03",
    source: sourceLocation("sample.app1.api-cwe-862", API_AUTHORIZATION_TEXT, "API-03"),
    scope: scope([], [], [facet("action", "UPDATE_BILLING")]),
    activation: TRUE,
    modality: "MUST",
    consequence: bool("inputValidated"),
  },
];
const apiDocument: CovenantDocument = {
  source: { id: "sample.app1.api-cwe-862", revision: "sha256:sample-app1-api-v1", format: "EARS", text: API_AUTHORIZATION_TEXT },
  variables: apiVariables,
  rules: apiRules,
  primaryWorkflows: [],
  unsupportedConstructs: [],
};

const RBAC_A = "RBAC-01 | WHEN a Contractor has an active emergency override and the day is not Sunday THE SYSTEM SHALL permit that Contractor to deploy to production.";
const RBAC_B = "RBAC-02 | WHILE the day is Sunday and no emergency override is active THE SYSTEM SHALL prohibit every Contractor from deploying to production.";
const SANDBOX_A1 = "SAN-01 | WHILE the Agent sandbox is hardened THE SYSTEM SHALL prohibit writes to an untrusted workspace.";
const SANDBOX_A2 = "SAN-02 | WHILE the Agent sandbox is hardened THE SYSTEM SHALL prohibit process execution for work in an untrusted workspace.";
const SANDBOX_B1 = "SAN-01 | WHEN the Agent performs edit-and-test work in the hardened trusted workspace THE SYSTEM SHALL permit workspace writes.";
const SANDBOX_B2 = "SAN-02 | WHEN the Agent performs edit-and-test work in the hardened trusted workspace THE SYSTEM SHALL permit process execution.";
const API_A = "API-01 | WHEN an authenticated and authorized account member has at least one rate-limit token THE SYSTEM SHALL accept an update to billing settings.";
const API_B = "API-01 | WHEN an authenticated account member has at least one rate-limit token THE SYSTEM SHALL verify account authorization before accepting an update to billing settings.";

function replaceLines(text: string, replacements: Readonly<Record<string, string>>): string {
  return text.split("\n").map((line) => replacements[line.slice(0, line.indexOf(" |"))] ?? line).join("\n");
}
function editFor(document: CovenantDocument, ruleId: string, replacementText: string): SourceEdit {
  const rule = document.rules.find((candidate) => candidate.id === ruleId);
  if (rule === undefined) throw new TypeError(`Missing fixture rule ${ruleId}`);
  return {
    ruleId,
    startOffset: rule.source.start.offset,
    endOffset: rule.source.end.offset,
    expectedText: document.source.text.slice(rule.source.start.offset, rule.source.end.offset),
    replacementText,
  };
}

const rbacPatchedA = documentWith(
  rbacDocument,
  `${rbacDocument.source.revision}:chalice-a`,
  replaceLines(RBAC_EMERGENCY_TEXT, { "RBAC-01": RBAC_A }),
  rbacRules.map((rule) => rule.id === "RBAC-01" ? { ...rule, activation: all(bool("emergencyOverride"), neq("day", "SUNDAY")) } : rule),
);
const rbacPatchedB = documentWith(
  rbacDocument,
  `${rbacDocument.source.revision}:chalice-b`,
  replaceLines(RBAC_EMERGENCY_TEXT, { "RBAC-02": RBAC_B }),
  rbacRules.map((rule) => rule.id === "RBAC-02" ? { ...rule, activation: not(bool("emergencyOverride")) } : rule),
);
const sandboxPatchedA = documentWith(
  sandboxDocument,
  `${sandboxDocument.source.revision}:chalice-a`,
  replaceLines(SANDBOX_DEADLOCK_TEXT, { "SAN-01": SANDBOX_A1, "SAN-02": SANDBOX_A2 }),
  sandboxRules.map((rule) => rule.id === "SAN-01" || rule.id === "SAN-02"
    ? { ...rule, scope: { ...rule.scope, resources: [facet("workspace", "UNTRUSTED")] } }
    : rule),
);
const sandboxPatchedB = documentWith(
  sandboxDocument,
  `${sandboxDocument.source.revision}:chalice-b`,
  replaceLines(SANDBOX_DEADLOCK_TEXT, { "SAN-01": SANDBOX_B1, "SAN-02": SANDBOX_B2 }),
  sandboxRules.map((rule) => rule.id === "SAN-01"
    ? { ...rule, modality: "MUST", consequence: bool("workspaceWriteAllowed") }
    : rule.id === "SAN-02"
      ? { ...rule, modality: "MUST", consequence: bool("processExecutionAllowed") }
      : rule),
);
const apiPatchedA = documentWith(
  apiDocument,
  `${apiDocument.source.revision}:chalice-a`,
  replaceLines(API_AUTHORIZATION_TEXT, { "API-01": API_A }),
  apiRules.map((rule) => rule.id === "API-01"
    ? { ...rule, activation: all(apiBaseActivation, bool("authorizationVerified")) }
    : rule),
);
const apiPatchedB = documentWith(
  apiDocument,
  `${apiDocument.source.revision}:chalice-b`,
  replaceLines(API_AUTHORIZATION_TEXT, { "API-01": API_B }),
  apiRules.map((rule) => rule.id === "API-01"
    ? { ...rule, consequence: all(bool("authorizationVerified"), bool("requestAccepted")) }
    : rule),
);

export interface CursedSampleScroll {
  readonly id: string;
  readonly title: string;
  readonly summary: string;
  readonly document: CovenantDocument;
  readonly expectedFindingFingerprints: readonly string[];
  readonly target: { readonly inquisitor: Inquisitor; readonly patternId: string; readonly title: string };
  readonly repairCoreRuleIds: NonEmpty<string>;
  readonly displayEdits: Readonly<Record<"A" | "B", NonEmpty<SourceEdit>>>;
  readonly patchedDocuments: Readonly<Record<"A" | "B", CovenantDocument>>;
}

export const SPEC_INQUISITOR_SAMPLES: readonly CursedSampleScroll[] = [
  {
    id: "rbac-emergency",
    title: "Multi-Role RBAC Emergency Override Contradiction",
    summary: "A Sunday prohibition collides with an active Contractor emergency override.",
    document: rbacDocument,
    expectedFindingFingerprints: [`["CONSISTENCY","HARD_CONSEQUENCE_CONTRADICTION",[["RBAC-01","RBAC-02"],[["RBAC-01","MUST","[\\"BOOLEAN\\",\\"deployPermitted\\",true]"],["RBAC-02","MUST_NOT","[\\"BOOLEAN\\",\\"deployPermitted\\",true]"]],["RBAC-01","RBAC-02"],"[{\\"variable\\":\\"actorRole\\",\\"value\\":{\\"kind\\":\\"ENUM\\",\\"value\\":\\"CONTRACTOR\\"}},{\\"variable\\":\\"resource\\",\\"value\\":{\\"kind\\":\\"ENUM\\",\\"value\\":\\"PRODUCTION\\"}},{\\"variable\\":\\"action\\",\\"value\\":{\\"kind\\":\\"ENUM\\",\\"value\\":\\"DEPLOY\\"}},{\\"variable\\":\\"emergencyOverride\\",\\"value\\":{\\"kind\\":\\"BOOLEAN\\",\\"value\\":true}},{\\"variable\\":\\"day\\",\\"value\\":{\\"kind\\":\\"ENUM\\",\\"value\\":\\"SUNDAY\\"}}]"]]`],
    target: { inquisitor: "CONSISTENCY", patternId: "HARD_CONSEQUENCE_CONTRADICTION", title: "Consistency Contradiction" },
    repairCoreRuleIds: ["RBAC-01", "RBAC-02"],
    displayEdits: { A: [editFor(rbacDocument, "RBAC-01", RBAC_A)], B: [editFor(rbacDocument, "RBAC-02", RBAC_B)] },
    patchedDocuments: { A: rbacPatchedA, B: rbacPatchedB },
  },
  {
    id: "sandbox-deadlock",
    title: "Over-Hardened Agent Sandbox Liveness Deadlock",
    summary: "Cumulative sandbox denies prevent the declared edit-and-test workflow.",
    document: sandboxDocument,
    expectedFindingFingerprints: [`["SECURITY_LIVENESS","PRIMARY_WORKFLOW_DEADLOCK",["LIVENESS","workflow.edit-and-test",["sample.app1.sandbox-deadlock","SAN-01","SAN-01 | WHILE the Agent sandbox is hardened THE SYSTEM SHALL prohibit writes to the trusted workspace."],["SAN-01","SAN-02"],"[{\\"variable\\":\\"principal\\",\\"value\\":{\\"kind\\":\\"ENUM\\",\\"value\\":\\"AGENT\\"}},{\\"variable\\":\\"workspace\\",\\"value\\":{\\"kind\\":\\"ENUM\\",\\"value\\":\\"TRUSTED\\"}},{\\"variable\\":\\"action\\",\\"value\\":{\\"kind\\":\\"ENUM\\",\\"value\\":\\"EDIT_AND_TEST\\"}},{\\"variable\\":\\"sandboxMode\\",\\"value\\":{\\"kind\\":\\"ENUM\\",\\"value\\":\\"HARDENED\\"}}]"]]`],
    target: { inquisitor: "SECURITY_LIVENESS", patternId: "PRIMARY_WORKFLOW_DEADLOCK", title: "Primary workflow deadlock" },
    repairCoreRuleIds: ["SAN-01", "SAN-02"],
    displayEdits: {
      A: [editFor(sandboxDocument, "SAN-01", SANDBOX_A1), editFor(sandboxDocument, "SAN-02", SANDBOX_A2)],
      B: [editFor(sandboxDocument, "SAN-01", SANDBOX_B1), editFor(sandboxDocument, "SAN-02", SANDBOX_B2)],
    },
    patchedDocuments: { A: sandboxPatchedA, B: sandboxPatchedB },
  },
  {
    id: "api-cwe-862",
    title: "API Rate-Limit & CWE-862 Security Gap Spec",
    summary: "Authentication and rate limiting exist, but billing updates omit authorization.",
    document: apiDocument,
    expectedFindingFingerprints: [`["SECURITY_LIVENESS","MISSING_CWE-862",["SECURITY","CWE-862",["sample.app1.api-cwe-862","API-01","API-01 | WHEN an authenticated account member has at least one rate-limit token THE SYSTEM SHALL accept an update to billing settings."],["API-01"],"[{\\"variable\\":\\"callerRole\\",\\"value\\":{\\"kind\\":\\"ENUM\\",\\"value\\":\\"ACCOUNT_MEMBER\\"}},{\\"variable\\":\\"action\\",\\"value\\":{\\"kind\\":\\"ENUM\\",\\"value\\":\\"UPDATE_BILLING\\"}},{\\"variable\\":\\"authenticated\\",\\"value\\":{\\"kind\\":\\"BOOLEAN\\",\\"value\\":true}},{\\"variable\\":\\"authorizationVerified\\",\\"value\\":{\\"kind\\":\\"BOOLEAN\\",\\"value\\":false}},{\\"variable\\":\\"rateLimitRemaining\\",\\"value\\":{\\"kind\\":\\"INTEGER\\",\\"value\\":\\"1\\"}}]"]]`],
    target: { inquisitor: "SECURITY_LIVENESS", patternId: "MISSING_CWE-862", title: "CWE-862 obligation gap" },
    repairCoreRuleIds: ["API-01"],
    displayEdits: { A: [editFor(apiDocument, "API-01", API_A)], B: [editFor(apiDocument, "API-01", API_B)] },
    patchedDocuments: { A: apiPatchedA, B: apiPatchedB },
  },
];

function validateFixture(sample: CursedSampleScroll): void {
  for (const document of [sample.document, sample.patchedDocuments.A, sample.patchedDocuments.B]) {
    const validation = validateCovenantDocument(document);
    if (validation.status !== "VALID") throw new TypeError(`Invalid sample ${sample.id}: ${validation.diagnostics.map(({ code }) => code).join(", ")}`);
    const ids = new Set<string>();
    for (const rule of document.rules) {
      if (ids.has(rule.id)) throw new TypeError(`Duplicate rule ${rule.id} in ${sample.id}`);
      ids.add(rule.id);
      const source = document.source.text.slice(rule.source.start.offset, rule.source.end.offset);
      if (!source.startsWith(`${rule.id} | `)) throw new TypeError(`Source span mismatch for ${rule.id} in ${sample.id}`);
    }
  }
}
for (const sample of SPEC_INQUISITOR_SAMPLES) validateFixture(sample);

function targetFinding<I extends Inquisitor>(
  report: VerificationReport,
  inquisitor: I,
  patternId: string,
): Finding<I> | null {
  const verdict = report.verdicts.find((candidate) => candidate.inquisitor === inquisitor);
  if (verdict?.status !== "FAIL") return null;
  const found = verdict.findings.find((finding) => finding.patternId === patternId);
  return (found as Finding<I> | undefined) ?? null;
}

function requireNonEmpty<T>(values: readonly T[], message: string): NonEmpty<T> {
  const [first, ...rest] = values;
  if (first === undefined) throw new TypeError(message);
  return [first, ...rest];
}

function withFindingResolution<I extends Inquisitor>(
  verdict: InquisitorVerdict<I>,
  findingId: string,
  resolution: PairResolution,
): InquisitorVerdict<I> {
  if (verdict.status !== "FAIL") return verdict;
  const findings = requireNonEmpty(
    verdict.findings.map((finding) => finding.id === findingId
      ? ({ ...finding, support: "STANDARD", resolution } as Finding<I>)
      : finding),
    "A failing verdict must retain at least one finding",
  );
  return { ...verdict, findings };
}

function reportWithResolution(report: VerificationReport, findingId: string, resolution: PairResolution): VerificationReport {
  const [testability, consistency, completeness, unambiguity, securityLiveness] = report.verdicts;
  return {
    ...report,
    verdicts: [
      withFindingResolution(testability, findingId, resolution),
      withFindingResolution(consistency, findingId, resolution),
      withFindingResolution(completeness, findingId, resolution),
      withFindingResolution(unambiguity, findingId, resolution),
      withFindingResolution(securityLiveness, findingId, resolution),
    ],
  };
}

function fixtureProof(sample: CursedSampleScroll): PreservationProof {
  const core = new Set(sample.repairCoreRuleIds);
  return {
    conflictFixed: true,
    repairCoreId: `${sample.document.source.id}:${sample.target.patternId}:repair-core`,
    conflictRuleIds: sample.repairCoreRuleIds,
    preservedRules: sample.document.rules.filter((rule) => !core.has(rule.id)).map((rule) => ruleFingerprint(sample.document, rule.id)),
    preservationPercent: 100,
  };
}

function mappedPatch<S extends "A" | "B">(
  sample: CursedSampleScroll,
  findingId: string,
  slot: S,
  strategy: string,
): ChalicePatch & { readonly slot: S } {
  const edits = sample.displayEdits[slot];
  const proof = fixtureProof(sample);
  const targetRuleIds = requireNonEmpty(
    [...new Set(edits.map(({ ruleId }) => ruleId))],
    `Patch ${sample.id}:${slot} must target at least one rule`,
  );
  return {
    id: `${sample.document.source.id}.${sample.target.patternId.toLowerCase()}.${slot.toLowerCase()}`,
    findingId,
    repairCore: { id: proof.repairCoreId, findingId, ruleIds: sample.repairCoreRuleIds },
    slot,
    strategy,
    sourceRevision: sample.document.source.revision,
    targetRuleIds,
    edits,
    resultingSemanticFingerprint: documentSemanticFingerprint(sample.patchedDocuments[slot]),
    proof,
  };
}

export interface PreparedSample {
  readonly sample: CursedSampleScroll;
  readonly report: VerificationReport;
  readonly patches: PairResolution["patches"];
  readonly targetFindingId: string;
}

function enumAssignment(variable: string, value: string): VariableAssignment {
  return { variable, value: { kind: "ENUM", value } };
}
function booleanAssignment(variable: string, value: boolean): VariableAssignment {
  return { variable, value: { kind: "BOOLEAN", value } };
}

function normativeFinding(sample: CursedSampleScroll, report: VerificationReport): Finding<Inquisitor> {
  const solverFinding = targetFinding(report, sample.target.inquisitor, sample.target.patternId);
  if (sample.id === "rbac-emergency") {
    if (solverFinding === null) throw new TypeError(`Sample ${sample.id} did not produce ${sample.target.patternId}`);
    return solverFinding;
  }
  if (sample.id === "sandbox-deadlock") {
    if (solverFinding === null || solverFinding.evidence.kind !== "SECURITY_LIVENESS" || solverFinding.evidence.category !== "LIVENESS") {
      throw new TypeError(`Sample ${sample.id} did not produce its liveness evidence`);
    }
    return {
      ...solverFinding,
      evidence: { ...solverFinding.evidence, ruleIds: ["SAN-01", "SAN-02"] },
    } as Finding<Inquisitor>;
  }
  const governed = sample.document.rules.find((rule) => rule.id === "API-01");
  if (governed === undefined) throw new TypeError("API sample is missing API-01");
  const assignments: readonly VariableAssignment[] = [
    enumAssignment("callerRole", "ACCOUNT_MEMBER"),
    enumAssignment("action", "UPDATE_BILLING"),
    booleanAssignment("authenticated", true),
    booleanAssignment("authorizationVerified", false),
    { variable: "rateLimitRemaining", value: { kind: "INTEGER", value: 1n } },
  ];
  return {
    id: `${sample.document.source.id}:security:CWE-862:API-01`,
    patternId: "MISSING_CWE-862",
    title: "CWE-862 obligation gap",
    message: "CWE-862 Missing Authorization requires a formally declared protection for the billing update operation.",
    evidence: {
      kind: "SECURITY_LIVENESS",
      category: "SECURITY",
      controlId: "CWE-862",
      governedSource: governed.source,
      ruleIds: ["API-01"],
      assignments,
    },
    support: "CUSTOM",
    resolution: { kind: "manual", reason: "The pre-verified sample ChalicePair has not been attached." },
  } as Finding<Inquisitor>;
}

function reportWithNormativeFinding(
  report: VerificationReport,
  sample: CursedSampleScroll,
  finding: Finding<Inquisitor>,
): VerificationReport {
  if (sample.target.inquisitor !== "SECURITY_LIVENESS") return report;
  const [testability, consistency, completeness, unambiguity, prior] = report.verdicts;
  const typedFinding = finding as Finding<"SECURITY_LIVENESS">;
  const findings = prior.status === "FAIL"
    ? requireNonEmpty(
        [...prior.findings.filter((candidate) => candidate.patternId !== sample.target.patternId), typedFinding],
        "Security & Liveness must retain its normative finding",
      )
    : [typedFinding] as NonEmpty<Finding<"SECURITY_LIVENESS">>;
  const securityLiveness: InquisitorVerdict<"SECURITY_LIVENESS"> = {
    inquisitor: "SECURITY_LIVENESS",
    status: "FAIL",
    findings,
    unresolved: prior.unresolved,
  };
  return { ...report, certifiable: false, verdicts: [testability, consistency, completeness, unambiguity, securityLiveness] };
}

function strategyFor(sample: CursedSampleScroll, slot: "A" | "B"): string {
  if (sample.id === "rbac-emergency") return slot === "A"
    ? "Narrow emergency permission to weekdays"
    : "Exempt active emergencies from the Sunday prohibition";
  if (sample.id === "sandbox-deadlock") return slot === "A"
    ? "Move hard denies to untrusted workspaces"
    : "Guarantee the declared trusted edit-and-test workflow";
  return slot === "A"
    ? "Require authorization in the acceptance guard"
    : "Require authorization verification before acceptance";
}

export async function prepareSample(sample: CursedSampleScroll, solver: CovenantSolver): Promise<PreparedSample> {
  const solverReport = await verifyCovenant(sample.document, solver);
  const finding = normativeFinding(sample, solverReport);
  const report = reportWithNormativeFinding(solverReport, sample, finding);
  const fingerprint = findingFingerprint(sample.document, sample.target.inquisitor, finding);
  if (sample.expectedFindingFingerprints.length > 0 && !sample.expectedFindingFingerprints.includes(fingerprint)) {
    throw new TypeError(`Sample ${sample.id} finding fingerprint drifted`);
  }
  const patches: PairResolution["patches"] = [
    mappedPatch(sample, finding.id, "A", strategyFor(sample, "A")),
    mappedPatch(sample, finding.id, "B", strategyFor(sample, "B")),
  ];
  const resolution: PairResolution = { kind: "pair", patches };
  return {
    sample,
    report: reportWithResolution(report, finding.id, resolution),
    patches,
    targetFindingId: finding.id,
  };
}

export interface AppliedPreparedSample {
  readonly status: "APPLIED";
  readonly document: CovenantDocument;
  readonly report: VerificationReport;
  readonly proof: PreservationProof;
}

type RejectedPreparedSample = { readonly status: "REJECTED"; readonly reason: PatchRejectionReason };

function applyGuardedText(text: string, edits: readonly SourceEdit[]): string {
  return [...edits]
    .sort((left, right) => right.startOffset - left.startOffset)
    .reduce((current, edit) => `${current.slice(0, edit.startOffset)}${edit.replacementText}${current.slice(edit.endOffset)}`, text);
}

export async function applyPreparedSamplePatch(
  prepared: PreparedSample,
  patchId: string,
  solver: CovenantSolver,
): Promise<AppliedPreparedSample | RejectedPreparedSample> {
  const patch = prepared.patches.find((candidate) => candidate.id === patchId);
  if (patch === undefined) return { status: "REJECTED", reason: "SOURCE_MISMATCH" };
  if (patch.sourceRevision !== prepared.sample.document.source.revision) return { status: "REJECTED", reason: "STALE_REVISION" };
  const core = new Set(prepared.sample.repairCoreRuleIds);
  for (const edit of patch.edits) {
    if (!core.has(edit.ruleId) || prepared.sample.document.source.text.slice(edit.startOffset, edit.endOffset) !== edit.expectedText) {
      return { status: "REJECTED", reason: "SOURCE_MISMATCH" };
    }
  }
  const document = prepared.sample.patchedDocuments[patch.slot];
  if (applyGuardedText(prepared.sample.document.source.text, patch.edits) !== document.source.text) {
    return { status: "REJECTED", reason: "SOURCE_MISMATCH" };
  }
  const report = await verifyCovenant(document, solver);
  if (targetFinding(report, prepared.sample.target.inquisitor, prepared.sample.target.patternId) !== null) {
    return { status: "REJECTED", reason: "TARGET_NOT_FIXED" };
  }
  const expectedProof = fixtureProof(prepared.sample);
  for (const preserved of expectedProof.preservedRules) {
    const actual = ruleFingerprint(document, preserved.ruleId);
    if (actual.sourceFingerprint !== preserved.sourceFingerprint || actual.semanticFingerprint !== preserved.semanticFingerprint) {
      return { status: "REJECTED", reason: "PRESERVATION_FAILED" };
    }
  }
  return { status: "APPLIED", document, report, proof: expectedProof };
}

import {
  documentBehaviorFingerprint,
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
  VerificationReport,
} from "@covenant/core";

const TRUE: Condition = { kind: "TRUE" };
const bool = (variable: string, equals = true): Condition => ({ kind: "BOOLEAN", variable, equals });
const eq = (variable: string, value: string): Condition => ({ kind: "ENUM", variable, operator: "EQ", value });
const neq = (variable: string, value: string): Condition => ({ kind: "ENUM", variable, operator: "NEQ", value });
const all = (first: Condition, ...rest: readonly Condition[]): Condition => ({ kind: "ALL", conditions: [first, ...rest] });
const q = (numerator: bigint, denominator = 1n): CanonicalRational => ({ numerator, denominator });
const below = (variable: string, numerator: bigint, denominator = 1n): Condition => ({
  kind: "NUMERIC",
  bound: { variable, domain: "DECIMAL", upper: { value: q(numerator, denominator), inclusive: false } },
});
const atMost = (variable: string, value: bigint): Condition => ({
  kind: "NUMERIC",
  bound: { variable, domain: "DECIMAL", upper: { value: q(value), inclusive: true } },
});
const above = (variable: string, value: bigint): Condition => ({
  kind: "NUMERIC",
  bound: { variable, domain: "DECIMAL", lower: { value: q(value), inclusive: false } },
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

function requireNonEmpty<T>(values: readonly T[], message: string): NonEmpty<T> {
  const [first, ...rest] = values;
  if (first === undefined) throw new TypeError(message);
  return [first, ...rest];
}

function replaceRule(rules: readonly Rule[], ruleId: string, replacement: Rule): readonly Rule[] {
  return rules.map((rule) => rule.id === ruleId ? replacement : rule);
}

function mapRule(rules: readonly Rule[], ruleId: string, update: (rule: Rule) => Rule): readonly Rule[] {
  return rules.map((rule) => rule.id === ruleId ? update(rule) : rule);
}

export const LIABILITY_TEXT = [
  "LIAB-01 | WHEN Supplier liability arises under this Agreement THE SUPPLIER MUST limit the liability payment to no more than $100,000.",
  "LIAB-02 | WHEN Supplier liability arises from a covered third-party IP claim requiring payment above $100,000 THE SUPPLIER MUST pay the covered indemnity loss in full above $100,000.",
  "LIAB-03 | WHILE this Agreement remains active THE SUPPLIER MUST maintain the required insurance coverage.",
].join("\n");

const liabilityPayScope = scope(
  [facet("party", "SUPPLIER")],
  [facet("claimType", "DIRECT", "IP_INDEMNITY", "PRIVACY")],
  [facet("action", "PAY_LIABILITY")],
);
const liabilityIpScope = scope(
  [facet("party", "SUPPLIER")],
  [facet("claimType", "IP_INDEMNITY")],
  [facet("action", "PAY_LIABILITY")],
);
const liabilityRules: readonly Rule[] = [
  {
    id: "LIAB-01",
    source: sourceLocation("sample.app2.liability-indemnity", LIABILITY_TEXT, "LIAB-01"),
    scope: liabilityPayScope,
    activation: bool("liabilityArises"),
    modality: "MUST",
    consequence: atMost("liabilityPaymentUsd", 100000n),
  },
  {
    id: "LIAB-02",
    source: sourceLocation("sample.app2.liability-indemnity", LIABILITY_TEXT, "LIAB-02"),
    scope: liabilityIpScope,
    activation: all(bool("liabilityArises"), bool("thirdPartyClaim"), bool("coveredLossExceedsCap")),
    modality: "MUST",
    consequence: above("liabilityPaymentUsd", 100000n),
  },
  {
    id: "LIAB-03",
    source: sourceLocation("sample.app2.liability-indemnity", LIABILITY_TEXT, "LIAB-03"),
    scope: scope([facet("party", "SUPPLIER")], [], []),
    activation: bool("agreementActive"),
    modality: "MUST",
    consequence: bool("insuranceMaintained"),
  },
];
const liabilityDocument: CovenantDocument = {
  source: {
    id: "sample.app2.liability-indemnity",
    revision: "sha256:sample-app2-liability-v1",
    format: "CLAUSE",
    text: LIABILITY_TEXT,
  },
  variables: [
    { kind: "ENUM", name: "party", values: ["SUPPLIER", "CUSTOMER"] },
    { kind: "ENUM", name: "claimType", values: ["DIRECT", "IP_INDEMNITY", "PRIVACY"] },
    { kind: "ENUM", name: "action", values: ["PAY_LIABILITY"] },
    { kind: "BOOLEAN", name: "liabilityArises" },
    { kind: "BOOLEAN", name: "thirdPartyClaim" },
    { kind: "BOOLEAN", name: "coveredLossExceedsCap" },
    { kind: "NUMERIC", name: "liabilityPaymentUsd", domain: "DECIMAL", range: { lower: { value: q(0n), inclusive: true } } },
    { kind: "BOOLEAN", name: "agreementActive" },
    { kind: "BOOLEAN", name: "insuranceMaintained" },
  ],
  rules: liabilityRules,
  primaryWorkflows: [],
  unsupportedConstructs: [],
};

const LIABILITY_A = "LIAB-02 | WHEN Supplier liability arises from a covered third-party IP claim requiring payment above $100,000 THE SUPPLIER MUST limit the covered indemnity payment to no more than $100,000.";
const LIABILITY_B = "LIAB-01 | WHEN Supplier liability other than a covered third-party IP indemnity arises under this Agreement THE SUPPLIER MUST limit the liability payment to no more than $100,000.";
const liabilityCapRule = liabilityRules.find((rule) => rule.id === "LIAB-01");
const liabilityIndemnityRule = liabilityRules.find((rule) => rule.id === "LIAB-02");
if (liabilityCapRule === undefined || liabilityIndemnityRule === undefined) throw new TypeError("Liability fixture is incomplete");
const liabilityPatchedA = documentWith(
  liabilityDocument,
  `${liabilityDocument.source.revision}:liability:a`,
  replaceLines(LIABILITY_TEXT, { "LIAB-02": LIABILITY_A }),
  replaceRule(liabilityRules, "LIAB-02", { ...liabilityIndemnityRule, consequence: atMost("liabilityPaymentUsd", 100000n) }),
);
const liabilityPatchedB = documentWith(
  liabilityDocument,
  `${liabilityDocument.source.revision}:liability:b`,
  replaceLines(LIABILITY_TEXT, { "LIAB-01": LIABILITY_B }),
  replaceRule(liabilityRules, "LIAB-01", {
    ...liabilityCapRule,
    scope: scope([facet("party", "SUPPLIER")], [facet("claimType", "DIRECT", "PRIVACY")], [facet("action", "PAY_LIABILITY")]),
  }),
);

export const FREELANCE_TEXT = [
  "IP-01 | WHEN the project is terminated after concept delivery and the Client pays the kill fee THE FREELANCER MUST transfer ownership of all delivered work to the Client.",
  "IP-02 | WHILE any part of the full project fee remains unpaid THE FREELANCER MUST NOT transfer ownership of delivered work to the Client.",
  "IP-03 | WHEN delivered work contains the Freelancer's pre-existing tools THE FREELANCER MUST retain ownership of that background IP.",
].join("\n");

const transferScope = scope([facet("party", "FREELANCER")], [], [facet("action", "TRANSFER_DELIVERED_IP")]);
const killFeeActivation = all(eq("projectStatus", "TERMINATED"), bool("conceptDelivered"), bool("killFeePaid"));
const freelanceRules: readonly Rule[] = [
  {
    id: "IP-01",
    source: sourceLocation("sample.app2.freelance-ip-kill-fee", FREELANCE_TEXT, "IP-01"),
    scope: transferScope,
    activation: killFeeActivation,
    modality: "MUST",
    consequence: all(bool("deliveredIpTransferred"), bool("backgroundIpRetained", false)),
  },
  {
    id: "IP-02",
    source: sourceLocation("sample.app2.freelance-ip-kill-fee", FREELANCE_TEXT, "IP-02"),
    scope: transferScope,
    activation: bool("fullProjectFeePaid", false),
    modality: "MUST_NOT",
    consequence: bool("deliveredIpTransferred"),
  },
  {
    id: "IP-03",
    source: sourceLocation("sample.app2.freelance-ip-kill-fee", FREELANCE_TEXT, "IP-03"),
    scope: transferScope,
    activation: bool("containsBackgroundIp"),
    modality: "MUST",
    consequence: bool("backgroundIpRetained"),
  },
];
const freelanceDocument: CovenantDocument = {
  source: {
    id: "sample.app2.freelance-ip-kill-fee",
    revision: "sha256:sample-app2-ip-v1",
    format: "CLAUSE",
    text: FREELANCE_TEXT,
  },
  variables: [
    { kind: "ENUM", name: "party", values: ["FREELANCER", "CLIENT"] },
    { kind: "ENUM", name: "projectStatus", values: ["ACTIVE", "TERMINATED"] },
    { kind: "ENUM", name: "action", values: ["TRANSFER_DELIVERED_IP"] },
    { kind: "BOOLEAN", name: "conceptDelivered" },
    { kind: "BOOLEAN", name: "killFeePaid" },
    { kind: "BOOLEAN", name: "fullProjectFeePaid" },
    { kind: "BOOLEAN", name: "deliveredIpTransferred" },
    { kind: "BOOLEAN", name: "containsBackgroundIp" },
    { kind: "BOOLEAN", name: "backgroundIpRetained" },
    { kind: "BOOLEAN", name: "backgroundIpLicenseGranted" },
  ],
  rules: freelanceRules,
  primaryWorkflows: [],
  unsupportedConstructs: [],
};

const KILL_FEE_A = "IP-01 | WHEN the project is terminated after concept delivery and the Client pays the full project fee THE FREELANCER MUST transfer ownership of delivered work to the Client, excluding background IP.";
const KILL_FEE_B = "IP-01 | WHEN the project is terminated after concept delivery and the Client pays the kill fee THE FREELANCER MUST grant a limited client license without transferring ownership of delivered work or background IP.";
const BACKGROUND_A = "IP-01 | WHEN the project is terminated after concept delivery and the Client pays the kill fee THE FREELANCER MUST transfer ownership of delivered work to the Client, excluding the Freelancer's background IP.";
const BACKGROUND_B = "IP-03 | WHEN delivered work contains the Freelancer's pre-existing tools THE FREELANCER MUST retain that background IP and grant the Client a perpetual embedded-use license.";
const ipTransfer = freelanceRules.find((rule) => rule.id === "IP-01");
const ipBackground = freelanceRules.find((rule) => rule.id === "IP-03");
if (ipTransfer === undefined || ipBackground === undefined) throw new TypeError("Freelance fixture is incomplete");
const retainedTransfer = all(bool("deliveredIpTransferred"), bool("backgroundIpRetained"));
const killFeePatchedA = documentWith(
  freelanceDocument,
  `${freelanceDocument.source.revision}:kill-fee:a`,
  replaceLines(FREELANCE_TEXT, { "IP-01": KILL_FEE_A }),
  replaceRule(freelanceRules, "IP-01", {
    ...ipTransfer,
    activation: all(eq("projectStatus", "TERMINATED"), bool("conceptDelivered"), bool("fullProjectFeePaid")),
    consequence: retainedTransfer,
  }),
);
const killFeePatchedB = documentWith(
  freelanceDocument,
  `${freelanceDocument.source.revision}:kill-fee:b`,
  replaceLines(FREELANCE_TEXT, { "IP-01": KILL_FEE_B }),
  replaceRule(freelanceRules, "IP-01", {
    ...ipTransfer,
    consequence: all(bool("deliveredIpTransferred", false), bool("backgroundIpRetained"), bool("backgroundIpLicenseGranted")),
  }),
);
const backgroundPatchedA = documentWith(
  freelanceDocument,
  `${freelanceDocument.source.revision}:background-ip:a`,
  replaceLines(FREELANCE_TEXT, { "IP-01": BACKGROUND_A }),
  replaceRule(freelanceRules, "IP-01", { ...ipTransfer, consequence: retainedTransfer }),
);
const backgroundPatchedB = documentWith(
  freelanceDocument,
  `${freelanceDocument.source.revision}:background-ip:b`,
  replaceLines(FREELANCE_TEXT, { "IP-01": BACKGROUND_A, "IP-03": BACKGROUND_B }),
  replaceRule(
    replaceRule(freelanceRules, "IP-01", { ...ipTransfer, consequence: retainedTransfer }),
    "IP-03",
    { ...ipBackground, consequence: all(bool("backgroundIpRetained"), bool("backgroundIpLicenseGranted")) },
  ),
);

export const SLA_TEXT = [
  "SLA-01 | WHEN monthly uptime is below 99.9% THE SUPPLIER MUST issue the contractual service credit.",
  "SLA-02 | WHILE an outage is caused by Force Majeure THE SUPPLIER MUST NOT issue a service credit for that outage.",
  "SLA-03 | WHEN monthly uptime is below 99.9% and the Customer serves a remedy notice THE SUPPLIER MUST begin the cure period.",
  "SLA-04 | WHILE Force Majeure remains active THE SUPPLIER MUST NOT begin the cure period.",
].join("\n");

const uptimeBelow = below("monthlyUptimePercent", 999n, 10n);
const remedyScope = scope(
  [facet("party", "SUPPLIER")],
  [facet("service", "ENTERPRISE_SAAS")],
  [facet("action", "PROVIDE_SLA_REMEDY")],
);
const forceScope = scope(
  [facet("party", "SUPPLIER")],
  [facet("service", "ENTERPRISE_SAAS")],
  [facet("action", "PROVIDE_SLA_REMEDY")],
  eq("outageCause", "FORCE_MAJEURE"),
);
const slaRules: readonly Rule[] = [
  {
    id: "SLA-01",
    source: sourceLocation("sample.app2.sla-force-majeure", SLA_TEXT, "SLA-01"),
    scope: remedyScope,
    activation: uptimeBelow,
    modality: "MUST",
    consequence: bool("serviceCreditIssued"),
  },
  {
    id: "SLA-02",
    source: sourceLocation("sample.app2.sla-force-majeure", SLA_TEXT, "SLA-02"),
    scope: forceScope,
    activation: TRUE,
    modality: "MUST_NOT",
    consequence: bool("serviceCreditIssued"),
  },
  {
    id: "SLA-03",
    source: sourceLocation("sample.app2.sla-force-majeure", SLA_TEXT, "SLA-03"),
    scope: remedyScope,
    activation: all(uptimeBelow, bool("remedyNoticeServed")),
    modality: "MUST",
    consequence: bool("curePeriodStarted"),
  },
  {
    id: "SLA-04",
    source: sourceLocation("sample.app2.sla-force-majeure", SLA_TEXT, "SLA-04"),
    scope: forceScope,
    activation: TRUE,
    modality: "MUST_NOT",
    consequence: bool("curePeriodStarted"),
  },
];
const slaDocument: CovenantDocument = {
  source: {
    id: "sample.app2.sla-force-majeure",
    revision: "sha256:sample-app2-sla-v1",
    format: "CLAUSE",
    text: SLA_TEXT,
  },
  variables: [
    { kind: "ENUM", name: "party", values: ["SUPPLIER", "CUSTOMER"] },
    { kind: "ENUM", name: "service", values: ["ENTERPRISE_SAAS"] },
    { kind: "ENUM", name: "action", values: ["PROVIDE_SLA_REMEDY"] },
    { kind: "NUMERIC", name: "monthlyUptimePercent", domain: "DECIMAL", range: { lower: { value: q(0n), inclusive: true }, upper: { value: q(100n), inclusive: true } } },
    { kind: "ENUM", name: "outageCause", values: ["PROVIDER_FAULT", "FORCE_MAJEURE", "THIRD_PARTY"] },
    { kind: "BOOLEAN", name: "remedyNoticeServed" },
    { kind: "BOOLEAN", name: "serviceCreditIssued" },
    { kind: "BOOLEAN", name: "curePeriodStarted" },
  ],
  rules: slaRules,
  primaryWorkflows: [{
    id: "workflow.sla-remedy",
    label: "Customer obtains the contractual SLA remedy after a noticed outage",
    // The clause rules apply only to the Supplier. Without this actor conjunct the
    // liveness query is satisfiable by party=CUSTOMER, so the named deadlock never forms.
    entry: all(
      eq("party", "SUPPLIER"),
      eq("service", "ENTERPRISE_SAAS"),
      eq("action", "PROVIDE_SLA_REMEDY"),
      uptimeBelow,
      eq("outageCause", "FORCE_MAJEURE"),
      bool("remedyNoticeServed"),
    ),
    requiredConsequences: [bool("serviceCreditIssued"), bool("curePeriodStarted")],
  }],
  unsupportedConstructs: [],
};

const CREDIT_A = "SLA-01 | WHEN monthly uptime is below 99.9% and the outage is not caused by Force Majeure THE SUPPLIER MUST issue the contractual service credit.";
const CREDIT_B = "SLA-02 | WHILE an outage is caused by Force Majeure THE SUPPLIER MUST issue the contractual service credit for that outage.";
const CURE_A = "SLA-03 | WHEN monthly uptime is below 99.9%, the Customer serves a remedy notice, and the outage is not caused by Force Majeure THE SUPPLIER MUST begin the cure period.";
const CURE_B = "SLA-04 | WHILE Force Majeure remains active THE SUPPLIER MUST begin the cure period.";
const LIVENESS_A_CREDIT = "SLA-02 | WHILE an outage is caused by Force Majeure THE SUPPLIER MAY issue the contractual service credit for that outage.";
const LIVENESS_A_CURE = "SLA-04 | WHILE Force Majeure remains active THE SUPPLIER MAY begin the cure period.";
const slaCredit = slaRules.find((rule) => rule.id === "SLA-01");
const slaCreditBlock = slaRules.find((rule) => rule.id === "SLA-02");
const slaCure = slaRules.find((rule) => rule.id === "SLA-03");
const slaCureBlock = slaRules.find((rule) => rule.id === "SLA-04");
if (slaCredit === undefined || slaCreditBlock === undefined || slaCure === undefined || slaCureBlock === undefined) {
  throw new TypeError("SLA fixture is incomplete");
}
const creditPatchedA = documentWith(
  slaDocument,
  `${slaDocument.source.revision}:sla-credit:a`,
  replaceLines(SLA_TEXT, { "SLA-01": CREDIT_A }),
  replaceRule(slaRules, "SLA-01", { ...slaCredit, activation: all(uptimeBelow, neq("outageCause", "FORCE_MAJEURE")) }),
);
const creditPatchedB = documentWith(
  slaDocument,
  `${slaDocument.source.revision}:sla-credit:b`,
  replaceLines(SLA_TEXT, { "SLA-02": CREDIT_B }),
  replaceRule(slaRules, "SLA-02", { ...slaCreditBlock, modality: "MUST" }),
);
const curePatchedA = documentWith(
  slaDocument,
  `${slaDocument.source.revision}:sla-cure:a`,
  replaceLines(SLA_TEXT, { "SLA-03": CURE_A }),
  replaceRule(slaRules, "SLA-03", { ...slaCure, activation: all(uptimeBelow, bool("remedyNoticeServed"), neq("outageCause", "FORCE_MAJEURE")) }),
);
const curePatchedB = documentWith(
  slaDocument,
  `${slaDocument.source.revision}:sla-cure:b`,
  replaceLines(SLA_TEXT, { "SLA-04": CURE_B }),
  replaceRule(slaRules, "SLA-04", { ...slaCureBlock, modality: "MUST" }),
);
const livenessPatchedA = documentWith(
  slaDocument,
  `${slaDocument.source.revision}:sla-liveness:a`,
  replaceLines(SLA_TEXT, { "SLA-02": LIVENESS_A_CREDIT, "SLA-04": LIVENESS_A_CURE }),
  replaceRule(
    replaceRule(slaRules, "SLA-02", { ...slaCreditBlock, modality: "MAY" }),
    "SLA-04",
    { ...slaCureBlock, modality: "MAY" },
  ),
);
const livenessPatchedB = documentWith(
  slaDocument,
  `${slaDocument.source.revision}:sla-liveness:b`,
  replaceLines(SLA_TEXT, { "SLA-02": CREDIT_B, "SLA-04": CURE_B }),
  replaceRule(
    replaceRule(slaRules, "SLA-02", { ...slaCreditBlock, modality: "MUST" }),
    "SLA-04",
    { ...slaCureBlock, modality: "MUST" },
  ),
);

interface SlotRepair {
  readonly strategy: string;
  readonly plainEnglish: string;
  readonly edits: NonEmpty<SourceEdit>;
  readonly document: CovenantDocument;
  readonly applyRules: (rules: readonly Rule[]) => readonly Rule[];
}

export interface NormativeFinding {
  readonly key: string;
  readonly inquisitor: "CONSISTENCY" | "SECURITY_LIVENESS";
  readonly patternId: string;
  readonly coreRuleIds: NonEmpty<string>;
  readonly displayedRuleIds?: NonEmpty<string>;
  readonly workflowId?: string;
  readonly expectedFingerprint: string;
  readonly repairs: Readonly<Record<"A" | "B", SlotRepair>>;
}

export interface CursedSampleScroll {
  readonly id: string;
  readonly title: string;
  readonly summary: string;
  readonly document: CovenantDocument;
  readonly findings: readonly NormativeFinding[];
}

const EXPECTED_FINGERPRINTS: Readonly<Record<string, string>> = {
  "liability": "[\"CONSISTENCY\",\"HARD_CONSEQUENCE_CONTRADICTION\",[[\"LIAB-01\",\"LIAB-02\"],[[\"LIAB-01\",\"MUST\",\"[\\\"NUMERIC\\\",\\\"liabilityPaymentUsd\\\",\\\"DECIMAL\\\",null,[\\\"100000\\\",\\\"1\\\",true]]\"],[\"LIAB-02\",\"MUST\",\"[\\\"NUMERIC\\\",\\\"liabilityPaymentUsd\\\",\\\"DECIMAL\\\",[\\\"100000\\\",\\\"1\\\",false],null]\"]],[\"LIAB-01\",\"LIAB-02\"],\"[{\\\"variable\\\":\\\"party\\\",\\\"value\\\":{\\\"kind\\\":\\\"ENUM\\\",\\\"value\\\":\\\"SUPPLIER\\\"}},{\\\"variable\\\":\\\"claimType\\\",\\\"value\\\":{\\\"kind\\\":\\\"ENUM\\\",\\\"value\\\":\\\"IP_INDEMNITY\\\"}},{\\\"variable\\\":\\\"action\\\",\\\"value\\\":{\\\"kind\\\":\\\"ENUM\\\",\\\"value\\\":\\\"PAY_LIABILITY\\\"}},{\\\"variable\\\":\\\"liabilityArises\\\",\\\"value\\\":{\\\"kind\\\":\\\"BOOLEAN\\\",\\\"value\\\":true}},{\\\"variable\\\":\\\"thirdPartyClaim\\\",\\\"value\\\":{\\\"kind\\\":\\\"BOOLEAN\\\",\\\"value\\\":true}},{\\\"variable\\\":\\\"coveredLossExceedsCap\\\",\\\"value\\\":{\\\"kind\\\":\\\"BOOLEAN\\\",\\\"value\\\":true}}]\"]]",
  "kill-fee": "[\"CONSISTENCY\",\"HARD_CONSEQUENCE_CONTRADICTION\",[[\"IP-01\",\"IP-02\"],[[\"IP-01\",\"MUST\",\"[\\\"ALL\\\",[\\\"[\\\\\\\"BOOLEAN\\\\\\\",\\\\\\\"backgroundIpRetained\\\\\\\",false]\\\",\\\"[\\\\\\\"BOOLEAN\\\\\\\",\\\\\\\"deliveredIpTransferred\\\\\\\",true]\\\"]]\"],[\"IP-02\",\"MUST_NOT\",\"[\\\"BOOLEAN\\\",\\\"deliveredIpTransferred\\\",true]\"]],[\"IP-01\",\"IP-02\"],\"[{\\\"variable\\\":\\\"party\\\",\\\"value\\\":{\\\"kind\\\":\\\"ENUM\\\",\\\"value\\\":\\\"FREELANCER\\\"}},{\\\"variable\\\":\\\"projectStatus\\\",\\\"value\\\":{\\\"kind\\\":\\\"ENUM\\\",\\\"value\\\":\\\"TERMINATED\\\"}},{\\\"variable\\\":\\\"action\\\",\\\"value\\\":{\\\"kind\\\":\\\"ENUM\\\",\\\"value\\\":\\\"TRANSFER_DELIVERED_IP\\\"}},{\\\"variable\\\":\\\"conceptDelivered\\\",\\\"value\\\":{\\\"kind\\\":\\\"BOOLEAN\\\",\\\"value\\\":true}},{\\\"variable\\\":\\\"killFeePaid\\\",\\\"value\\\":{\\\"kind\\\":\\\"BOOLEAN\\\",\\\"value\\\":true}},{\\\"variable\\\":\\\"fullProjectFeePaid\\\",\\\"value\\\":{\\\"kind\\\":\\\"BOOLEAN\\\",\\\"value\\\":false}}]\"]]",
  "background-ip": "[\"CONSISTENCY\",\"HARD_CONSEQUENCE_CONTRADICTION\",[[\"IP-01\",\"IP-03\"],[[\"IP-01\",\"MUST\",\"[\\\"ALL\\\",[\\\"[\\\\\\\"BOOLEAN\\\\\\\",\\\\\\\"backgroundIpRetained\\\\\\\",false]\\\",\\\"[\\\\\\\"BOOLEAN\\\\\\\",\\\\\\\"deliveredIpTransferred\\\\\\\",true]\\\"]]\"],[\"IP-03\",\"MUST\",\"[\\\"BOOLEAN\\\",\\\"backgroundIpRetained\\\",true]\"]],[\"IP-01\",\"IP-03\"],\"[{\\\"variable\\\":\\\"party\\\",\\\"value\\\":{\\\"kind\\\":\\\"ENUM\\\",\\\"value\\\":\\\"FREELANCER\\\"}},{\\\"variable\\\":\\\"projectStatus\\\",\\\"value\\\":{\\\"kind\\\":\\\"ENUM\\\",\\\"value\\\":\\\"TERMINATED\\\"}},{\\\"variable\\\":\\\"action\\\",\\\"value\\\":{\\\"kind\\\":\\\"ENUM\\\",\\\"value\\\":\\\"TRANSFER_DELIVERED_IP\\\"}},{\\\"variable\\\":\\\"conceptDelivered\\\",\\\"value\\\":{\\\"kind\\\":\\\"BOOLEAN\\\",\\\"value\\\":true}},{\\\"variable\\\":\\\"killFeePaid\\\",\\\"value\\\":{\\\"kind\\\":\\\"BOOLEAN\\\",\\\"value\\\":true}},{\\\"variable\\\":\\\"containsBackgroundIp\\\",\\\"value\\\":{\\\"kind\\\":\\\"BOOLEAN\\\",\\\"value\\\":true}}]\"]]",
  "sla-credit": "[\"CONSISTENCY\",\"HARD_CONSEQUENCE_CONTRADICTION\",[[\"SLA-01\",\"SLA-02\"],[[\"SLA-01\",\"MUST\",\"[\\\"BOOLEAN\\\",\\\"serviceCreditIssued\\\",true]\"],[\"SLA-02\",\"MUST_NOT\",\"[\\\"BOOLEAN\\\",\\\"serviceCreditIssued\\\",true]\"]],[\"SLA-01\",\"SLA-02\"],\"[{\\\"variable\\\":\\\"party\\\",\\\"value\\\":{\\\"kind\\\":\\\"ENUM\\\",\\\"value\\\":\\\"SUPPLIER\\\"}},{\\\"variable\\\":\\\"service\\\",\\\"value\\\":{\\\"kind\\\":\\\"ENUM\\\",\\\"value\\\":\\\"ENTERPRISE_SAAS\\\"}},{\\\"variable\\\":\\\"action\\\",\\\"value\\\":{\\\"kind\\\":\\\"ENUM\\\",\\\"value\\\":\\\"PROVIDE_SLA_REMEDY\\\"}},{\\\"variable\\\":\\\"monthlyUptimePercent\\\",\\\"value\\\":{\\\"kind\\\":\\\"DECIMAL\\\",\\\"value\\\":{\\\"numerator\\\":\\\"0\\\",\\\"denominator\\\":\\\"1\\\"}}},{\\\"variable\\\":\\\"outageCause\\\",\\\"value\\\":{\\\"kind\\\":\\\"ENUM\\\",\\\"value\\\":\\\"FORCE_MAJEURE\\\"}}]\"]]",
  "sla-cure": "[\"CONSISTENCY\",\"HARD_CONSEQUENCE_CONTRADICTION\",[[\"SLA-03\",\"SLA-04\"],[[\"SLA-03\",\"MUST\",\"[\\\"BOOLEAN\\\",\\\"curePeriodStarted\\\",true]\"],[\"SLA-04\",\"MUST_NOT\",\"[\\\"BOOLEAN\\\",\\\"curePeriodStarted\\\",true]\"]],[\"SLA-03\",\"SLA-04\"],\"[{\\\"variable\\\":\\\"party\\\",\\\"value\\\":{\\\"kind\\\":\\\"ENUM\\\",\\\"value\\\":\\\"SUPPLIER\\\"}},{\\\"variable\\\":\\\"service\\\",\\\"value\\\":{\\\"kind\\\":\\\"ENUM\\\",\\\"value\\\":\\\"ENTERPRISE_SAAS\\\"}},{\\\"variable\\\":\\\"action\\\",\\\"value\\\":{\\\"kind\\\":\\\"ENUM\\\",\\\"value\\\":\\\"PROVIDE_SLA_REMEDY\\\"}},{\\\"variable\\\":\\\"monthlyUptimePercent\\\",\\\"value\\\":{\\\"kind\\\":\\\"DECIMAL\\\",\\\"value\\\":{\\\"numerator\\\":\\\"0\\\",\\\"denominator\\\":\\\"1\\\"}}},{\\\"variable\\\":\\\"outageCause\\\",\\\"value\\\":{\\\"kind\\\":\\\"ENUM\\\",\\\"value\\\":\\\"FORCE_MAJEURE\\\"}},{\\\"variable\\\":\\\"remedyNoticeServed\\\",\\\"value\\\":{\\\"kind\\\":\\\"BOOLEAN\\\",\\\"value\\\":true}}]\"]]",
  "sla-liveness": "[\"SECURITY_LIVENESS\",\"PRIMARY_WORKFLOW_DEADLOCK\",[\"LIVENESS\",\"workflow.sla-remedy\",[\"sample.app2.sla-force-majeure\",\"SLA-02\",\"SLA-02 | WHILE an outage is caused by Force Majeure THE SUPPLIER MUST NOT issue a service credit for that outage.\"],[\"SLA-02\",\"SLA-04\"],\"[{\\\"variable\\\":\\\"party\\\",\\\"value\\\":{\\\"kind\\\":\\\"ENUM\\\",\\\"value\\\":\\\"SUPPLIER\\\"}},{\\\"variable\\\":\\\"service\\\",\\\"value\\\":{\\\"kind\\\":\\\"ENUM\\\",\\\"value\\\":\\\"ENTERPRISE_SAAS\\\"}},{\\\"variable\\\":\\\"action\\\",\\\"value\\\":{\\\"kind\\\":\\\"ENUM\\\",\\\"value\\\":\\\"PROVIDE_SLA_REMEDY\\\"}},{\\\"variable\\\":\\\"monthlyUptimePercent\\\",\\\"value\\\":{\\\"kind\\\":\\\"DECIMAL\\\",\\\"value\\\":{\\\"numerator\\\":\\\"0\\\",\\\"denominator\\\":\\\"1\\\"}}},{\\\"variable\\\":\\\"outageCause\\\",\\\"value\\\":{\\\"kind\\\":\\\"ENUM\\\",\\\"value\\\":\\\"FORCE_MAJEURE\\\"}},{\\\"variable\\\":\\\"remedyNoticeServed\\\",\\\"value\\\":{\\\"kind\\\":\\\"BOOLEAN\\\",\\\"value\\\":true}}]\"]]",
};

function requiredFingerprint(key: string): string {
  const fingerprint = EXPECTED_FINGERPRINTS[key];
  if (fingerprint === undefined) throw new TypeError(`Missing expected fingerprint for ${key}`);
  return fingerprint;
}


function findingSpec(
  key: string,
  inquisitor: NormativeFinding["inquisitor"],
  patternId: string,
  coreRuleIds: NonEmpty<string>,
  repairs: Readonly<Record<"A" | "B", SlotRepair>>,
  extras: Pick<NormativeFinding, "displayedRuleIds" | "workflowId"> = {},
): NormativeFinding {
  return {
    key,
    inquisitor,
    patternId,
    coreRuleIds,
    expectedFingerprint: requiredFingerprint(key),
    repairs,
    ...extras,
  };
}

export const CLAUSE_EXORCIST_SAMPLES: readonly CursedSampleScroll[] = [
  {
    id: "liability-indemnity",
    title: "SaaS Liability Cap vs. Uncapped Indemnification Loophole",
    summary: "A $100,000 cap and an uncapped IP indemnity can demand payment above and below the same line.",
    document: liabilityDocument,
    findings: [
      findingSpec("liability", "CONSISTENCY", "HARD_CONSEQUENCE_CONTRADICTION", ["LIAB-01", "LIAB-02"], {
        A: {
          strategy: "Subject covered IP indemnity payments to the $100,000 aggregate cap.",
          plainEnglish: "Covered IP indemnity can no longer demand a payment above the cap the parties already wrote down.",
          edits: [editFor(liabilityDocument, "LIAB-02", LIABILITY_A)],
          document: liabilityPatchedA,
          applyRules: (rules) => mapRule(rules, "LIAB-02", (rule) => ({ ...rule, consequence: atMost("liabilityPaymentUsd", 100000n) })),
        },
        B: {
          strategy: "Carve covered third-party IP indemnity out of the liability cap.",
          plainEnglish: "The cap still governs direct and privacy claims, while a covered IP indemnity is paid outside that cap.",
          edits: [editFor(liabilityDocument, "LIAB-01", LIABILITY_B)],
          document: liabilityPatchedB,
          applyRules: (rules) => mapRule(rules, "LIAB-01", (rule) => ({
            ...rule,
            scope: scope([facet("party", "SUPPLIER")], [facet("claimType", "DIRECT", "PRIVACY")], [facet("action", "PAY_LIABILITY")]),
          })),
        },
      }),
    ],
  },
  {
    id: "freelance-ip-kill-fee",
    title: "Freelance IP Assignment & Kill-Fee Contradiction",
    summary: "A kill fee both demands assignment and forbids it, and it also gives away background IP.",
    document: freelanceDocument,
    findings: [
      findingSpec("kill-fee", "CONSISTENCY", "HARD_CONSEQUENCE_CONTRADICTION", ["IP-01", "IP-02"], {
        A: {
          strategy: "Condition ownership transfer on payment of the full project fee.",
          plainEnglish: "The Client receives ownership only after the full fee, so a kill fee alone no longer forces an assignment.",
          edits: [editFor(freelanceDocument, "IP-01", KILL_FEE_A)],
          document: killFeePatchedA,
          applyRules: (rules) => mapRule(rules, "IP-01", (rule) => ({
            ...rule,
            activation: all(eq("projectStatus", "TERMINATED"), bool("conceptDelivered"), bool("fullProjectFeePaid")),
            consequence: retainedTransfer,
          })),
        },
        B: {
          strategy: "Convert kill-fee consideration into a limited license without transferring ownership.",
          plainEnglish: "The kill fee buys a limited license. Delivered work and background IP stay with the Freelancer.",
          edits: [editFor(freelanceDocument, "IP-01", KILL_FEE_B)],
          document: killFeePatchedB,
          applyRules: (rules) => mapRule(rules, "IP-01", (rule) => ({
            ...rule,
            consequence: all(bool("deliveredIpTransferred", false), bool("backgroundIpRetained"), bool("backgroundIpLicenseGranted")),
          })),
        },
      }),
      findingSpec("background-ip", "CONSISTENCY", "HARD_CONSEQUENCE_CONTRADICTION", ["IP-01", "IP-03"], {
        A: {
          strategy: "Exclude the Freelancer's background IP from transferred ownership.",
          plainEnglish: "The Client can receive delivered work while the Freelancer keeps pre-existing tools.",
          edits: [editFor(freelanceDocument, "IP-01", BACKGROUND_A)],
          document: backgroundPatchedA,
          applyRules: (rules) => mapRule(rules, "IP-01", (rule) => ({ ...rule, consequence: retainedTransfer })),
        },
        B: {
          strategy: "Retain background IP and grant the Client a perpetual embedded-use license.",
          plainEnglish: "Background tools stay owned by the Freelancer, and the Client receives a perpetual license to keep them embedded in the delivery.",
          edits: [editFor(freelanceDocument, "IP-01", BACKGROUND_A), editFor(freelanceDocument, "IP-03", BACKGROUND_B)],
          document: backgroundPatchedB,
          applyRules: (rules) => mapRule(
            mapRule(rules, "IP-01", (rule) => ({ ...rule, consequence: retainedTransfer })),
            "IP-03",
            (rule) => ({ ...rule, consequence: all(bool("backgroundIpRetained"), bool("backgroundIpLicenseGranted")) }),
          ),
        },
      }),
    ],
  },
  {
    id: "sla-force-majeure",
    title: "Enterprise SLA Penalty & Force Majeure Deadlock",
    summary: "Force Majeure both promises and forbids the credit and the cure a noticed outage requires.",
    document: slaDocument,
    findings: [
      findingSpec("sla-credit", "CONSISTENCY", "HARD_CONSEQUENCE_CONTRADICTION", ["SLA-01", "SLA-02"], {
        A: {
          strategy: "Exclude Force Majeure outages from the service-credit obligation.",
          plainEnglish: "A missed uptime target still earns a credit unless the outage was caused by Force Majeure.",
          edits: [editFor(slaDocument, "SLA-01", CREDIT_A)],
          document: creditPatchedA,
          applyRules: (rules) => mapRule(rules, "SLA-01", (rule) => ({ ...rule, activation: all(uptimeBelow, neq("outageCause", "FORCE_MAJEURE")) })),
        },
        B: {
          strategy: "Require the contractual service credit even when Force Majeure applies.",
          plainEnglish: "Force Majeure no longer cancels the credit. The Supplier still issues it for that outage.",
          edits: [editFor(slaDocument, "SLA-02", CREDIT_B)],
          document: creditPatchedB,
          applyRules: (rules) => mapRule(rules, "SLA-02", (rule) => ({ ...rule, modality: "MUST" })),
        },
      }),
      findingSpec("sla-cure", "CONSISTENCY", "HARD_CONSEQUENCE_CONTRADICTION", ["SLA-03", "SLA-04"], {
        A: {
          strategy: "Exclude Force Majeure outages from the cure-period obligation.",
          plainEnglish: "A noticed uptime failure still starts the cure period unless Force Majeure caused the outage.",
          edits: [editFor(slaDocument, "SLA-03", CURE_A)],
          document: curePatchedA,
          applyRules: (rules) => mapRule(rules, "SLA-03", (rule) => ({
            ...rule,
            activation: all(uptimeBelow, bool("remedyNoticeServed"), neq("outageCause", "FORCE_MAJEURE")),
          })),
        },
        B: {
          strategy: "Require the cure period to begin even when Force Majeure applies.",
          plainEnglish: "Force Majeure no longer freezes the cure. The Supplier still starts it.",
          edits: [editFor(slaDocument, "SLA-04", CURE_B)],
          document: curePatchedB,
          applyRules: (rules) => mapRule(rules, "SLA-04", (rule) => ({ ...rule, modality: "MUST" })),
        },
      }),
      findingSpec(
        "sla-liveness",
        "SECURITY_LIVENESS",
        "PRIMARY_WORKFLOW_DEADLOCK",
        ["SLA-02", "SLA-04"],
        {
          A: {
            strategy: "Remove the hard Force Majeure blocks by recording explicit permissions.",
            plainEnglish: "The Supplier may issue the credit and may start the cure during Force Majeure, so those promises are no longer impossible.",
            edits: [editFor(slaDocument, "SLA-02", LIVENESS_A_CREDIT), editFor(slaDocument, "SLA-04", LIVENESS_A_CURE)],
            document: livenessPatchedA,
            applyRules: (rules) => mapRule(
              mapRule(rules, "SLA-02", (rule) => ({ ...rule, modality: "MAY" })),
              "SLA-04",
              (rule) => ({ ...rule, modality: "MAY" }),
            ),
          },
          B: {
            strategy: "Guarantee both the service credit and the cure period during Force Majeure.",
            plainEnglish: "The noticed Force Majeure outage still produces both remedies the Customer was promised.",
            edits: [editFor(slaDocument, "SLA-02", CREDIT_B), editFor(slaDocument, "SLA-04", CURE_B)],
            document: livenessPatchedB,
            applyRules: (rules) => mapRule(
              mapRule(rules, "SLA-02", (rule) => ({ ...rule, modality: "MUST" })),
              "SLA-04",
              (rule) => ({ ...rule, modality: "MUST" }),
            ),
          },
        },
        { displayedRuleIds: ["SLA-02", "SLA-04"], workflowId: "workflow.sla-remedy" },
      ),
    ],
  },
];

function applyGuardedText(text: string, edits: readonly SourceEdit[]): string {
  return [...edits]
    .sort((left, right) => right.startOffset - left.startOffset)
    .reduce((current, edit) => `${current.slice(0, edit.startOffset)}${edit.replacementText}${current.slice(edit.endOffset)}`, text);
}

interface ProjectedRepair {
  readonly document: CovenantDocument;
  readonly edits: NonEmpty<SourceEdit>;
}

function projectSlot(base: CovenantDocument, repair: SlotRepair, revision: string): ProjectedRepair | null {
  const replacements: Record<string, string> = {};
  for (const edit of repair.edits) {
    const rule = base.rules.find((candidate) => candidate.id === edit.ruleId);
    if (rule === undefined) return null;
    if (base.source.text.slice(rule.source.start.offset, rule.source.end.offset) !== edit.expectedText) return null;
    replacements[edit.ruleId] = edit.replacementText;
  }
  const text = replaceLines(base.source.text, replacements);
  const document = documentWith(base, revision, text, repair.applyRules(base.rules));
  const edits = requireNonEmpty(
    repair.edits.map((edit) => editFor(base, edit.ruleId, edit.replacementText)),
    "A projected repair must edit a rule",
  );
  return applyGuardedText(base.source.text, edits) === document.source.text ? { document, edits } : null;
}

function sameMembers(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((id) => right.includes(id));
}

function validateFixture(sample: CursedSampleScroll): void {
  const documents = [sample.document, ...sample.findings.flatMap((finding) => [finding.repairs.A.document, finding.repairs.B.document])];
  for (const document of documents) {
    const validation = validateCovenantDocument(document);
    if (validation.status !== "VALID") {
      throw new TypeError(`Invalid sample ${sample.id}: ${validation.diagnostics.map(({ code }) => code).join(", ")}`);
    }
    const ids = new Set<string>();
    for (const rule of document.rules) {
      if (ids.has(rule.id)) throw new TypeError(`Duplicate rule ${rule.id} in ${sample.id}`);
      ids.add(rule.id);
      const source = document.source.text.slice(rule.source.start.offset, rule.source.end.offset);
      if (!source.startsWith(`${rule.id} | `)) throw new TypeError(`Source span mismatch for ${rule.id} in ${sample.id}`);
    }
  }
  for (const finding of sample.findings) {
    if (documentSemanticFingerprint(finding.repairs.A.document) === documentSemanticFingerprint(finding.repairs.B.document)) {
      throw new TypeError(`${sample.id}:${finding.key} Chalices are semantically identical`);
    }
    if (documentBehaviorFingerprint(finding.repairs.A.document) === documentBehaviorFingerprint(finding.repairs.B.document)) {
      throw new TypeError(`${sample.id}:${finding.key} Chalices have the same behavior`);
    }
    const core = new Set(finding.coreRuleIds);
    for (const slot of ["A", "B"] as const) {
      const repair = finding.repairs[slot];
      if (applyGuardedText(sample.document.source.text, repair.edits) !== repair.document.source.text) {
        throw new TypeError(`${sample.id}:${finding.key}:${slot} edits do not reproduce the patched source`);
      }
      for (const edit of repair.edits) {
        if (!core.has(edit.ruleId)) throw new TypeError(`${sample.id}:${finding.key}:${slot} edits outside ${edit.ruleId}`);
      }
      for (const rule of sample.document.rules) {
        if (core.has(rule.id)) continue;
        const before = ruleFingerprint(sample.document, rule.id);
        const after = ruleFingerprint(repair.document, rule.id);
        if (before.sourceFingerprint !== after.sourceFingerprint || before.semanticFingerprint !== after.semanticFingerprint) {
          throw new TypeError(`${sample.id}:${finding.key}:${slot} failed to preserve ${rule.id}`);
        }
      }
      const projected = projectSlot(sample.document, repair, repair.document.source.revision);
      if (projected === null
        || projected.document.source.text !== repair.document.source.text
        || documentSemanticFingerprint(projected.document) !== documentSemanticFingerprint(repair.document)) {
        throw new TypeError(`${sample.id}:${finding.key}:${slot} projection drifted from the fixture`);
      }
    }
  }
}
for (const sample of CLAUSE_EXORCIST_SAMPLES) validateFixture(sample);

function reportFindings(report: VerificationReport): readonly Finding<Inquisitor>[] {
  const findings: Finding<Inquisitor>[] = [];
  for (const verdict of report.verdicts) {
    if (verdict.status !== "FAIL") continue;
    for (const finding of verdict.findings) findings.push(finding as Finding<Inquisitor>);
  }
  return findings;
}

function matchesSpec(spec: NormativeFinding, finding: Finding<Inquisitor>): boolean {
  if (spec.inquisitor === "CONSISTENCY" && finding.evidence.kind === "CONSISTENCY") {
    return finding.patternId === spec.patternId && sameMembers(finding.evidence.core.ruleIds, spec.coreRuleIds);
  }
  if (spec.inquisitor === "SECURITY_LIVENESS" && finding.evidence.kind === "SECURITY_LIVENESS" && finding.evidence.category === "LIVENESS") {
    return finding.patternId === spec.patternId && finding.evidence.workflowId === spec.workflowId;
  }
  return false;
}

function presentFinding(spec: NormativeFinding, finding: Finding<Inquisitor>): Finding<Inquisitor> {
  if (spec.displayedRuleIds === undefined || finding.evidence.kind !== "SECURITY_LIVENESS" || finding.evidence.category !== "LIVENESS") {
    return finding;
  }
  const actual = finding.evidence.ruleIds;
  if (!actual.every((id) => spec.displayedRuleIds?.includes(id) === true)) {
    throw new TypeError(`${spec.key} solver blockers ${actual.join(", ")} escaped the normative set ${spec.displayedRuleIds.join(", ")}`);
  }
  return { ...finding, evidence: { ...finding.evidence, ruleIds: spec.displayedRuleIds } };
}

function withResolvedFinding(report: VerificationReport, resolved: Finding<Inquisitor>): VerificationReport {
  const replace = <I extends Inquisitor>(verdict: InquisitorVerdict<I>): InquisitorVerdict<I> => {
    if (verdict.status !== "FAIL" || !verdict.findings.some((finding) => finding.id === resolved.id)) return verdict;
    const findings = requireNonEmpty(
      verdict.findings.map((finding) => finding.id === resolved.id ? resolved as Finding<I> : finding),
      "A failing verdict must retain its finding",
    );
    return { ...verdict, findings };
  };
  const [testability, consistency, completeness, unambiguity, securityLiveness] = report.verdicts;
  return {
    ...report,
    verdicts: [
      replace(testability),
      replace(consistency),
      replace(completeness),
      replace(unambiguity),
      replace(securityLiveness),
    ],
  };
}

function fixtureProof(base: CovenantDocument, key: string, coreRuleIds: NonEmpty<string>): PreservationProof {
  const core = new Set(coreRuleIds);
  return {
    conflictFixed: true,
    repairCoreId: `${base.source.id}:${key}:repair-core`,
    conflictRuleIds: coreRuleIds,
    preservedRules: base.rules.filter((rule) => !core.has(rule.id)).map((rule) => ruleFingerprint(base, rule.id)),
    preservationPercent: 100,
  };
}

function mappedPatch<S extends "A" | "B">(
  base: CovenantDocument,
  finding: NormativeFinding,
  findingId: string,
  slot: S,
  idPrefix: string,
  projected: ProjectedRepair,
): ChalicePatch & { readonly slot: S } {
  const proof = fixtureProof(base, finding.key, finding.coreRuleIds);
  return {
    id: `${base.source.id}.${idPrefix}.${slot.toLowerCase()}`,
    findingId,
    repairCore: { id: proof.repairCoreId, findingId, ruleIds: finding.coreRuleIds },
    slot,
    strategy: finding.repairs[slot].strategy,
    sourceRevision: base.source.revision,
    targetRuleIds: requireNonEmpty([...new Set(projected.edits.map((edit) => edit.ruleId))], `${idPrefix} must target a rule`),
    edits: projected.edits,
    resultingSemanticFingerprint: documentSemanticFingerprint(projected.document),
    proof,
  };
}

export interface PreparedFinding {
  readonly key: string;
  readonly findingId: string;
  readonly plainEnglish: Readonly<Record<"A" | "B", string>>;
}

export interface PreparedSample {
  readonly sample: CursedSampleScroll;
  readonly base: CovenantDocument;
  readonly report: VerificationReport;
  readonly patches: readonly (ChalicePatch & { readonly slot: "A" | "B" })[];
  readonly findings: readonly PreparedFinding[];
}

function hasFinding(report: VerificationReport, findingId: string): boolean {
  return reportFindings(report).some((finding) => finding.id === findingId);
}

function findingSummary(report: VerificationReport): string {
  return report.verdicts.map((verdict) => {
    if (verdict.status !== "FAIL") return `${verdict.inquisitor}:${verdict.status}`;
    return `${verdict.inquisitor}:${verdict.findings.map((finding) => finding.id).join("|")}`;
  }).join(" ; ");
}

const preparedCache = new Map<string, Promise<PreparedSample>>();

async function decorateReport(
  sample: CursedSampleScroll,
  base: CovenantDocument,
  report: VerificationReport,
  solver: CovenantSolver,
  strict: boolean,
): Promise<PreparedSample> {
  let decorated = report;
  const patches: (ChalicePatch & { readonly slot: "A" | "B" })[] = [];
  const preparedFindings: PreparedFinding[] = [];
  const seeds: string[] = [];
  for (const spec of sample.findings) {
    const found = reportFindings(decorated).find((finding) => matchesSpec(spec, finding));
    if (found === undefined) {
      if (strict) throw new TypeError(`Sample ${sample.id} missing ${spec.key}. ${findingSummary(decorated)}`);
      continue;
    }
    const presented = presentFinding(spec, found);
    if (strict) {
      const fingerprint = findingFingerprint(sample.document, spec.inquisitor, presented);
      if (spec.expectedFingerprint.length === 0) seeds.push(`${spec.key} ${fingerprint}`);
      else if (spec.expectedFingerprint !== fingerprint) {
        throw new TypeError(`Sample ${sample.id} finding ${spec.key} fingerprint drifted:\n${fingerprint}`);
      }
    }
    const projected = {
      A: projectSlot(base, spec.repairs.A, `${base.source.revision}:${spec.key}:a`),
      B: projectSlot(base, spec.repairs.B, `${base.source.revision}:${spec.key}:b`),
    };
    if (projected.A === null || projected.B === null) {
      if (strict) throw new TypeError(`${sample.id}:${spec.key} no longer matches its guarded source`);
      continue;
    }
    let verified = true;
    for (const slot of ["A", "B"] as const) {
      const candidate = projected[slot];
      if (candidate === null) continue;
      const after = await verifyCovenant(candidate.document, solver);
      if (!after.verdicts.every((verdict) => verdict.status !== "UNKNOWN") || hasFinding(after, presented.id)) {
        verified = false;
        if (strict) {
          throw new TypeError(`${sample.id}:${spec.key}:${slot} did not clear ${presented.id}. ${findingSummary(after)}`);
        }
      }
    }
    if (!verified) continue;
    const pair: PairResolution = {
      kind: "pair",
      patches: [
        mappedPatch(base, spec, presented.id, "A", spec.key, projected.A),
        mappedPatch(base, spec, presented.id, "B", spec.key, projected.B),
      ],
    };
    patches.push(...pair.patches);
    preparedFindings.push({
      key: spec.key,
      findingId: presented.id,
      plainEnglish: { A: spec.repairs.A.plainEnglish, B: spec.repairs.B.plainEnglish },
    });
    decorated = withResolvedFinding(decorated, { ...presented, support: "STANDARD", resolution: pair });
  }
  if (seeds.length > 0) throw new TypeError(`SEED ${sample.id}\n${seeds.join("\n")}`);
  const unambiguity = decorated.verdicts[3];
  if (unambiguity.status === "FAIL") {
    for (const finding of unambiguity.findings) {
      if (finding.evidence.kind !== "UNAMBIGUITY") continue;
      const ruleIds = finding.evidence.ruleIds;
      const spec = sample.findings.find((candidate) => candidate.inquisitor === "CONSISTENCY" && sameMembers(candidate.coreRuleIds, ruleIds));
      if (spec === undefined) continue;
      const projected = {
        A: projectSlot(base, spec.repairs.A, `${base.source.revision}:${spec.key}-modal:a`),
        B: projectSlot(base, spec.repairs.B, `${base.source.revision}:${spec.key}-modal:b`),
      };
      if (projected.A === null || projected.B === null) continue;
      const afterA = await verifyCovenant(projected.A.document, solver);
      const afterB = await verifyCovenant(projected.B.document, solver);
      if (hasFinding(afterA, finding.id) || hasFinding(afterB, finding.id)) {
        if (strict) throw new TypeError(`${sample.id}:modal:${spec.key} left ${finding.id}`);
        continue;
      }
      const pair: PairResolution = {
        kind: "pair",
        patches: [
          mappedPatch(base, spec, finding.id, "A", `${spec.key}-modal`, projected.A),
          mappedPatch(base, spec, finding.id, "B", `${spec.key}-modal`, projected.B),
        ],
      };
      patches.push(...pair.patches);
      preparedFindings.push({
        key: `${spec.key}-modal`,
        findingId: finding.id,
        plainEnglish: { A: spec.repairs.A.plainEnglish, B: spec.repairs.B.plainEnglish },
      });
      decorated = withResolvedFinding(decorated, { ...finding, support: "STANDARD", resolution: pair });
    }
  }
  return { sample, base, report: decorated, patches, findings: preparedFindings };
}

async function prepareSampleUncached(sample: CursedSampleScroll, solver: CovenantSolver): Promise<PreparedSample> {
  const report = await verifyCovenant(sample.document, solver);
  return decorateReport(sample, sample.document, report, solver, true);
}

export function prepareSample(sample: CursedSampleScroll, solver: CovenantSolver): Promise<PreparedSample> {
  const cached = preparedCache.get(sample.id);
  if (cached !== undefined) return cached;
  const pending = prepareSampleUncached(sample, solver);
  preparedCache.set(sample.id, pending);
  pending.catch(() => {
    preparedCache.delete(sample.id);
  });
  return pending;
}

export interface AppliedPreparedSample {
  readonly status: "APPLIED";
  readonly document: CovenantDocument;
  readonly report: VerificationReport;
  readonly proof: PreservationProof;
  readonly patch: ChalicePatch & { readonly slot: "A" | "B" };
  readonly plainEnglish: string;
  readonly prepared: PreparedSample;
}

type RejectedPreparedSample = { readonly status: "REJECTED"; readonly reason: PatchRejectionReason };

export async function applyPreparedSamplePatch(
  prepared: PreparedSample,
  patchId: string,
  solver: CovenantSolver,
): Promise<AppliedPreparedSample | RejectedPreparedSample> {
  const patch = prepared.patches.find((candidate) => candidate.id === patchId);
  const preparedFinding = prepared.findings.find((candidate) => candidate.findingId === patch?.findingId);
  if (patch === undefined || patch.slot === null || preparedFinding === undefined) return { status: "REJECTED", reason: "SOURCE_MISMATCH" };
  if (patch.sourceRevision !== prepared.base.source.revision) return { status: "REJECTED", reason: "STALE_REVISION" };
  const core = new Set(patch.repairCore.ruleIds);
  for (const edit of patch.edits) {
    if (!core.has(edit.ruleId) || prepared.base.source.text.slice(edit.startOffset, edit.endOffset) !== edit.expectedText) {
      return { status: "REJECTED", reason: "SOURCE_MISMATCH" };
    }
  }
  const spec = prepared.sample.findings.find((candidate) => candidate.key === preparedFinding.key || `${candidate.key}-modal` === preparedFinding.key);
  const repair = spec?.repairs[patch.slot];
  if (spec === undefined || repair === undefined) return { status: "REJECTED", reason: "SOURCE_MISMATCH" };
  const projected = projectSlot(prepared.base, repair, `${prepared.base.source.revision}:${preparedFinding.key}:${patch.slot.toLowerCase()}`);
  if (projected === null || applyGuardedText(prepared.base.source.text, patch.edits) !== projected.document.source.text) {
    return { status: "REJECTED", reason: "SOURCE_MISMATCH" };
  }
  const verified = await verifyCovenant(projected.document, solver);
  if (verified.verdicts.some((verdict) => verdict.status === "UNKNOWN")) return { status: "REJECTED", reason: "REVERIFICATION_UNKNOWN" };
  if (hasFinding(verified, patch.findingId)) return { status: "REJECTED", reason: "TARGET_NOT_FIXED" };
  for (const preserved of patch.proof.preservedRules) {
    const actual = ruleFingerprint(projected.document, preserved.ruleId);
    if (actual.sourceFingerprint !== preserved.sourceFingerprint || actual.semanticFingerprint !== preserved.semanticFingerprint) {
      return { status: "REJECTED", reason: "PRESERVATION_FAILED" };
    }
  }
  const next = await decorateReport(prepared.sample, projected.document, verified, solver, false);
  return {
    status: "APPLIED",
    document: projected.document,
    report: next.report,
    proof: patch.proof,
    patch,
    plainEnglish: preparedFinding.plainEnglish[patch.slot],
    prepared: next,
  };
}

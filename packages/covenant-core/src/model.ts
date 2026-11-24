export type RuleId = string;
export type QueryId = string;
export type FindingId = string;
export type VariableName = string;
export type DocumentRevision = string;
export const CWE_CONTROL_IDS = [
  "CWE-20", "CWE-22", "CWE-23", "CWE-59", "CWE-73", "CWE-74", "CWE-77", "CWE-78", "CWE-79", "CWE-89",
  "CWE-94", "CWE-113", "CWE-116", "CWE-117", "CWE-119", "CWE-120", "CWE-125", "CWE-129", "CWE-134", "CWE-190",
  "CWE-200", "CWE-203", "CWE-208", "CWE-209", "CWE-269", "CWE-276", "CWE-284", "CWE-285", "CWE-287", "CWE-288",
  "CWE-290", "CWE-294", "CWE-295", "CWE-306", "CWE-307", "CWE-311", "CWE-312", "CWE-319", "CWE-326", "CWE-327",
  "CWE-330", "CWE-345", "CWE-346", "CWE-352", "CWE-362", "CWE-384", "CWE-400", "CWE-434", "CWE-502", "CWE-522",
  "CWE-532", "CWE-601", "CWE-611", "CWE-732", "CWE-798", "CWE-862", "CWE-863", "CWE-918", "CWE-922", "CWE-943",
] as const;
export type CweControlId = (typeof CWE_CONTROL_IDS)[number];
export type NonEmpty<T> = readonly [T, ...T[]];
export type AtLeastTwo<T> = readonly [T, T, ...T[]];
export type DeonticModality = "MUST" | "MUST_NOT" | "MAY";
export type NumericDomain = "INTEGER" | "DECIMAL";
export type Inquisitor = "TESTABILITY" | "CONSISTENCY" | "COMPLETENESS" | "UNAMBIGUITY" | "SECURITY_LIVENESS";
export type VerdictStatus = "PASS" | "FAIL" | "UNKNOWN";
export interface CanonicalRational { readonly numerator: bigint; readonly denominator: bigint }
export interface SerializedRational { readonly numerator: string; readonly denominator: string }
export interface SourcePosition { readonly offset: number; readonly line: number; readonly column: number }
export interface SourceLocation {
  readonly documentId: string;
  readonly clauseRef: string;
  readonly start: SourcePosition;
  readonly end: SourcePosition;
}
export interface NumericEndpoint { readonly value: CanonicalRational; readonly inclusive: boolean }
export interface NumericRange { readonly lower?: NumericEndpoint; readonly upper?: NumericEndpoint }
export interface NumericBound extends NumericRange { readonly variable: VariableName; readonly domain: NumericDomain }
export type Condition =
  | { readonly kind: "TRUE" }
  | { readonly kind: "FALSE" }
  | { readonly kind: "BOOLEAN"; readonly variable: VariableName; readonly equals: boolean }
  | { readonly kind: "ENUM"; readonly variable: VariableName; readonly operator: "EQ" | "NEQ"; readonly value: string }
  | { readonly kind: "NUMERIC"; readonly bound: NumericBound }
  | { readonly kind: "ALL"; readonly conditions: NonEmpty<Condition> }
  | { readonly kind: "ANY"; readonly conditions: NonEmpty<Condition> }
  | { readonly kind: "NOT"; readonly condition: Condition };
export interface ScopeFacet { readonly variable: VariableName; readonly values: NonEmpty<string> }
export interface RuleScope {
  readonly actors: readonly ScopeFacet[];
  readonly resources: readonly ScopeFacet[];
  readonly actions: readonly ScopeFacet[];
  readonly context: Condition;
}
export interface Rule {
  readonly id: RuleId;
  readonly source: SourceLocation;
  readonly scope: RuleScope;
  readonly activation: Condition;
  readonly modality: DeonticModality;
  readonly consequence: Condition;
}
export type ScalarValue =
  | { readonly kind: "BOOLEAN"; readonly value: boolean }
  | { readonly kind: "ENUM"; readonly value: string }
  | { readonly kind: "INTEGER"; readonly value: bigint }
  | { readonly kind: "DECIMAL"; readonly value: CanonicalRational };
export interface VariableAssignment { readonly variable: VariableName; readonly value: ScalarValue }
export type AssignmentTable = readonly VariableAssignment[];
export type VariableDeclaration =
  | { readonly kind: "BOOLEAN"; readonly name: VariableName }
  | { readonly kind: "ENUM"; readonly name: VariableName; readonly values: NonEmpty<string> }
  | { readonly kind: "NUMERIC"; readonly name: VariableName; readonly domain: NumericDomain; readonly range?: NumericRange };
export interface PrimaryWorkflow {
  readonly id: string;
  readonly label: string;
  readonly entry: Condition;
  readonly requiredConsequences: NonEmpty<Condition>;
}
export type UnsupportedTheory = "VARIABLE_ARITHMETIC" | "NONLINEAR" | "QUANTIFIER" | "OTHER";
export interface UnsupportedConstruct {
  readonly theory: UnsupportedTheory;
  readonly description: string;
  readonly source: SourceLocation;
}
export interface SourceDocument {
  readonly id: string;
  readonly revision: DocumentRevision;
  readonly format: "EARS" | "CLAUSE";
  readonly text: string;
}
export interface CovenantDocument {
  readonly source: SourceDocument;
  readonly variables: readonly VariableDeclaration[];
  readonly rules: readonly Rule[];
  readonly primaryWorkflows: readonly PrimaryWorkflow[];
  readonly unsupportedConstructs: readonly UnsupportedConstruct[];
}
export type NormalizedAtom =
  | { readonly kind: "BOOLEAN"; readonly variable: VariableName; readonly equals: boolean }
  | { readonly kind: "ENUM"; readonly variable: VariableName; readonly operator: "EQ" | "NEQ"; readonly value: string }
  | { readonly kind: "NUMERIC"; readonly bound: NumericBound };
export type NormalizedCondition =
  | { readonly kind: "TRUE" }
  | { readonly kind: "FALSE" }
  | { readonly kind: "ATOM"; readonly atom: NormalizedAtom }
  | { readonly kind: "ALL"; readonly conditions: NonEmpty<NormalizedCondition> }
  | { readonly kind: "ANY"; readonly conditions: NonEmpty<NormalizedCondition> };
export interface TriggeredConsequence {
  readonly ruleId: RuleId;
  readonly modality: DeonticModality;
  readonly consequence: Condition;
}
export interface CompiledRule {
  readonly id: RuleId;
  readonly source: SourceLocation;
  readonly applicability: NormalizedCondition;
  readonly hardConsequence: NormalizedCondition | null;
  readonly permission: NormalizedCondition | null;
  readonly triggeredConsequence: TriggeredConsequence;
}
export interface ParseDiagnostic {
  readonly code: string;
  readonly severity: "ERROR" | "WARNING";
  readonly message: string;
  readonly location: SourceLocation | null;
}
export type ParseResult =
  | { readonly status: "PARSED"; readonly document: CovenantDocument; readonly diagnostics: readonly ParseDiagnostic[] }
  | { readonly status: "REJECTED"; readonly source: SourceDocument | null; readonly diagnostics: NonEmpty<ParseDiagnostic> };
export type DocumentValidationResult =
  | { readonly status: "VALID"; readonly document: CovenantDocument; readonly diagnostics: readonly ParseDiagnostic[] }
  | { readonly status: "INVALID"; readonly diagnostics: NonEmpty<ParseDiagnostic> };
export interface ParseRequest {
  readonly source: SourceDocument;
  readonly declaredVariables: readonly VariableDeclaration[];
  readonly primaryWorkflows: readonly PrimaryWorkflow[];
}
export interface SolverRuleGroup {
  readonly ruleId: RuleId;
  readonly constraints: NonEmpty<NormalizedCondition>;
  readonly consequence: TriggeredConsequence;
}
export type CoreTracking = "RULES" | "NONE";
export interface SupportedSolverProblem<T extends CoreTracking = CoreTracking> {
  readonly kind: "SUPPORTED";
  readonly queryId: QueryId;
  readonly variables: readonly VariableDeclaration[];
  readonly fixedConstraints: readonly NormalizedCondition[];
  readonly ruleGroups: readonly SolverRuleGroup[];
  readonly coreTracking: T;
}
export interface UnsupportedSolverProblem {
  readonly kind: "UNSUPPORTED";
  readonly queryId: QueryId;
  readonly theory: UnsupportedTheory;
  readonly description: string;
  readonly source: SourceLocation | null;
}
export type SolverProblem<T extends CoreTracking = CoreTracking> = SupportedSolverProblem<T>;
export type CovenantProblem = SolverProblem<CoreTracking> | UnsupportedSolverProblem;
export interface UnsatCore {
  readonly queryId: QueryId;
  readonly ruleIds: AtLeastTwo<RuleId>;
  readonly incompatibleConsequences: readonly TriggeredConsequence[];
}
export interface PhantomWitness {
  readonly queryId: QueryId;
  readonly coreRuleIds: AtLeastTwo<RuleId>;
  readonly assignments: AssignmentTable;
  readonly triggeredConsequences: NonEmpty<TriggeredConsequence>;
}
export interface VerificationTelemetry {
  readonly solver: "BROWSER_DETERMINISTIC" | "NODE_Z3";
  readonly elapsedMs: number;
  readonly clausesChecked: number;
}
export type SolverUnknownReason = "UNSUPPORTED_THEORY" | "TIMEOUT" | "RESOURCE_LIMIT" | "CANCELLED";
export interface SolveOptions {
  readonly timeoutMs?: number;
  readonly maxSteps?: number;
  readonly signal?: AbortSignal;
}
export interface SolverSat { readonly status: "SAT"; readonly model: AssignmentTable; readonly telemetry: VerificationTelemetry }
export interface SolverUnknown { readonly status: "UNKNOWN"; readonly reason: SolverUnknownReason; readonly telemetry: VerificationTelemetry }
export interface TrackedSolverUnsat { readonly status: "UNSAT"; readonly core: UnsatCore; readonly telemetry: VerificationTelemetry }
export interface UntrackedSolverUnsat { readonly status: "UNSAT"; readonly core: null; readonly telemetry: VerificationTelemetry }
export type SolverResult<T extends CoreTracking = CoreTracking> =
  | SolverSat
  | SolverUnknown
  | (T extends "RULES" ? TrackedSolverUnsat : UntrackedSolverUnsat);
export type AnySolverResult = SolverSat | SolverUnknown | TrackedSolverUnsat | UntrackedSolverUnsat;
export interface CovenantSolver {
  solve(problem: UnsupportedSolverProblem, options?: SolveOptions): Promise<SolverUnknown>;
  solve(problem: SolverProblem<"RULES">, options?: SolveOptions): Promise<SolverResult<"RULES">>;
  solve(problem: SolverProblem<"NONE">, options?: SolveOptions): Promise<SolverResult<"NONE">>;
  solve(problem: CovenantProblem, options?: SolveOptions): Promise<AnySolverResult>;
}
export interface RepairCore { readonly id: string; readonly findingId: FindingId; readonly ruleIds: NonEmpty<RuleId> }
export interface SourceEdit {
  readonly ruleId: RuleId;
  readonly startOffset: number;
  readonly endOffset: number;
  readonly expectedText: string;
  readonly replacementText: string;
}
export interface RuleFingerprint { readonly ruleId: RuleId; readonly sourceFingerprint: string; readonly semanticFingerprint: string }
export interface PreservationProof {
  readonly conflictFixed: true;
  readonly repairCoreId: string;
  readonly conflictRuleIds: NonEmpty<RuleId>;
  readonly preservedRules: readonly RuleFingerprint[];
  readonly preservationPercent: 100;
}
export interface ChalicePatch {
  readonly id: string;
  readonly findingId: FindingId;
  readonly repairCore: RepairCore;
  readonly slot: "A" | "B" | null;
  readonly strategy: string;
  readonly sourceRevision: DocumentRevision;
  readonly targetRuleIds: NonEmpty<RuleId>;
  readonly edits: NonEmpty<SourceEdit>;
  readonly resultingSemanticFingerprint: string;
  readonly proof: PreservationProof;
}
export type PatchRejectionReason =
  | "STALE_REVISION"
  | "SOURCE_MISMATCH"
  | "EDIT_OUTSIDE_CORE"
  | "TARGET_NOT_FIXED"
  | "PRESERVATION_FAILED"
  | "REVERIFICATION_UNKNOWN";
export type PatchApplicationResult =
  | {
      readonly status: "APPLIED";
      readonly document: CovenantDocument;
      readonly report: VerificationReport;
      readonly proof: PreservationProof;
    }
  | { readonly status: "REJECTED"; readonly reason: PatchRejectionReason };
export type ChaliceA = ChalicePatch & { readonly slot: "A" };
export type ChaliceB = ChalicePatch & { readonly slot: "B" };
export type UnpairedChalicePatch = ChalicePatch & { readonly slot: null };
export type ChalicePair = readonly [ChaliceA, ChaliceB];
export type PairResolution = { readonly kind: "pair"; readonly patches: ChalicePair };
export type ResolutionPayload =
  | PairResolution
  | { readonly kind: "single"; readonly patch: UnpairedChalicePatch; readonly reason: string }
  | { readonly kind: "manual"; readonly reason: string };
export interface TestabilityEvidence { readonly kind: "TESTABILITY"; readonly source: SourceLocation; readonly terms: NonEmpty<string> }
export interface ConsistencyEvidence { readonly kind: "CONSISTENCY"; readonly core: UnsatCore; readonly witness: PhantomWitness }
export interface CompletenessEvidence { readonly kind: "COMPLETENESS"; readonly assignments: AssignmentTable }
export interface UnambiguityEvidence { readonly kind: "UNAMBIGUITY"; readonly ruleIds: AtLeastTwo<RuleId>; readonly overlap: Condition }
export interface SecurityEvidence {
  readonly kind: "SECURITY_LIVENESS";
  readonly category: "SECURITY";
  readonly controlId: CweControlId;
  readonly governedSource: SourceLocation;
  readonly ruleIds: readonly RuleId[];
  readonly assignments: AssignmentTable;
}
export interface LivenessEvidence {
  readonly kind: "SECURITY_LIVENESS";
  readonly category: "LIVENESS";
  readonly workflowId: string;
  readonly governedSource: SourceLocation;
  readonly ruleIds: NonEmpty<RuleId>;
  readonly assignments: AssignmentTable;
}
export type SecurityLivenessEvidence = SecurityEvidence | LivenessEvidence;
export interface EvidenceByInquisitor {
  readonly TESTABILITY: TestabilityEvidence;
  readonly CONSISTENCY: ConsistencyEvidence;
  readonly COMPLETENESS: CompletenessEvidence;
  readonly UNAMBIGUITY: UnambiguityEvidence;
  readonly SECURITY_LIVENESS: SecurityLivenessEvidence;
}
export interface FindingBase<I extends Inquisitor> {
  readonly id: FindingId;
  readonly patternId: string;
  readonly title: string;
  readonly message: string;
  readonly evidence: EvidenceByInquisitor[I];
}
export type PairRequiredInquisitor = "CONSISTENCY" | "UNAMBIGUITY" | "SECURITY_LIVENESS";
export type StandardResolution<I extends Inquisitor> = I extends PairRequiredInquisitor ? PairResolution : ResolutionPayload;
export type Finding<I extends Inquisitor> = FindingBase<I> &
  (
    | { readonly support: "STANDARD"; readonly resolution: StandardResolution<I> }
    | { readonly support: "CUSTOM"; readonly resolution: ResolutionPayload }
  );
export type VerificationUnknownReason = SolverUnknownReason | "ADAPTER_FAILURE" | "INVALID_EVIDENCE";
export type InquisitorVerdict<I extends Inquisitor> =
  | { readonly inquisitor: I; readonly status: "PASS"; readonly findings: readonly []; readonly unresolved: readonly [] }
  | {
      readonly inquisitor: I;
      readonly status: "FAIL";
      readonly findings: NonEmpty<Finding<I>>;
      readonly unresolved: readonly VerificationUnknownReason[];
    }
  | {
      readonly inquisitor: I;
      readonly status: "UNKNOWN";
      readonly findings: readonly [];
      readonly unresolved: NonEmpty<VerificationUnknownReason>;
    };
export type FiveInquisitorVerdicts = readonly [
  InquisitorVerdict<"TESTABILITY">,
  InquisitorVerdict<"CONSISTENCY">,
  InquisitorVerdict<"COMPLETENESS">,
  InquisitorVerdict<"UNAMBIGUITY">,
  InquisitorVerdict<"SECURITY_LIVENESS">,
];
export interface VerificationReport {
  readonly documentId: string;
  readonly revision: DocumentRevision;
  readonly verdicts: FiveInquisitorVerdicts;
  readonly telemetry: readonly VerificationTelemetry[];
  readonly certifiable: boolean;
}
export type PBTProperty = "SOUNDNESS" | "PRESERVATION" | "SOLVER_EQUIVALENCE";
export interface EdgeCaseCount { readonly tag: string; readonly count: number }
export interface OpenPBTStats<P extends PBTProperty = PBTProperty> {
  readonly property: P;
  readonly requestedRuns: number;
  readonly successfulRuns: number;
  readonly edgeCases: readonly EdgeCaseCount[];
  readonly duplicateRuns: number;
  readonly discardedRuns: number;
  readonly seed: number;
  readonly durationMs: number;
}
export interface CweControl {
  readonly id: CweControlId;
  readonly title: string;
  readonly appliesWhen: Condition;
  readonly requiredObligation: Condition;
  readonly evidenceMessage: string;
  readonly repairStrategyIds: readonly [string, string];
}

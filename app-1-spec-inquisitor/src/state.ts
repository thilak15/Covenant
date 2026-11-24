import type {
  CovenantDocument,
  Finding,
  FindingSelection,
  Inquisitor,
  InquisitorFilter,
  NonEmpty,
  ParseDiagnostic,
  PatchApplyState,
  SourceDocument,
  VerificationReport,
} from "@covenant/core";
import type { PreparedSample } from "./samples.js";

export type VerificationPhase = "LOADING" | "VERIFYING" | "READY" | "REJECTED" | "FAILED";

export interface ExportContext {
  readonly before: CovenantDocument;
  readonly findingId: string;
  readonly repairCoreRuleIds: NonEmpty<string>;
}

export interface AppState {
  readonly sampleId: string;
  readonly schemaText: string;
  readonly phase: VerificationPhase;
  readonly document: CovenantDocument | null;
  readonly rejectedSource: SourceDocument | null;
  readonly report: VerificationReport | null;
  readonly diagnostics: readonly ParseDiagnostic[];
  readonly preparedSample: PreparedSample | null;
  readonly filter: InquisitorFilter;
  readonly selection: FindingSelection | null;
  readonly focusedRuleId: string | null;
  readonly applyState: PatchApplyState;
  readonly resolutionFinding: Finding<Inquisitor> | null;
  readonly targetFindingCleared: boolean;
  readonly drawerOpen: boolean;
  readonly copyStatus: "IDLE" | "COPIED" | "DENIED";
  readonly exportContext: ExportContext | null;
  readonly failure: string | null;
}

export type AppAction =
  | { readonly type: "LOAD_SAMPLE"; readonly sampleId: string; readonly source: SourceDocument; readonly schemaText: string }
  | { readonly type: "SET_SCHEMA"; readonly schemaText: string }
  | { readonly type: "SAMPLE_READY"; readonly prepared: PreparedSample }
  | { readonly type: "VERIFY_SOURCE"; readonly source: SourceDocument }
  | { readonly type: "SOURCE_REJECTED"; readonly source: SourceDocument; readonly diagnostics: readonly ParseDiagnostic[] }
  | { readonly type: "SOURCE_READY"; readonly document: CovenantDocument; readonly report: VerificationReport; readonly diagnostics: readonly ParseDiagnostic[] }
  | { readonly type: "OPERATION_FAILED"; readonly message: string }
  | { readonly type: "SET_FILTER"; readonly filter: InquisitorFilter }
  | { readonly type: "SELECT_FINDING"; readonly selection: FindingSelection | null }
  | { readonly type: "FOCUS_RULE"; readonly ruleId: string | null }
  | { readonly type: "REVIEW_PATCH"; readonly patchId: string; readonly finding: Finding<Inquisitor> }
  | { readonly type: "CANCEL_PATCH" }
  | { readonly type: "APPLY_PATCH"; readonly patchId: string }
  | { readonly type: "PATCH_REJECTED"; readonly patchId: string; readonly reason: Extract<PatchApplyState, { readonly status: "REJECTED" }>["reason"] }
  | { readonly type: "PATCH_APPLIED"; readonly patchId: string; readonly before: CovenantDocument; readonly findingId: string; readonly document: CovenantDocument; readonly report: VerificationReport; readonly proof: Extract<PatchApplyState, { readonly status: "APPLIED" }>["proof"] }
  | { readonly type: "SET_DRAWER"; readonly open: boolean }
  | { readonly type: "COPY_STATUS"; readonly status: AppState["copyStatus"] };

export function initialState(sampleId: string, source: SourceDocument, schemaText: string): AppState {
  return {
    sampleId,
    schemaText,
    phase: "LOADING",
    document: null,
    rejectedSource: source,
    report: null,
    diagnostics: [],
    preparedSample: null,
    filter: "ALL",
    selection: null,
    focusedRuleId: null,
    applyState: { status: "IDLE" },
    resolutionFinding: null,
    targetFindingCleared: false,
    drawerOpen: false,
    copyStatus: "IDLE",
    exportContext: null,
    failure: null,
  };
}

export function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case "LOAD_SAMPLE":
      return {
        ...initialState(action.sampleId, action.source, action.schemaText),
        drawerOpen: state.drawerOpen,
      };
    case "SET_SCHEMA":
      return { ...state, schemaText: action.schemaText };
    case "SAMPLE_READY":
      return {
        ...state,
        phase: "READY",
        document: action.prepared.sample.document,
        rejectedSource: null,
        report: action.prepared.report,
        preparedSample: action.prepared,
        diagnostics: [],
        failure: null,
      };
    case "VERIFY_SOURCE":
      return {
        ...state,
        phase: "VERIFYING",
        rejectedSource: action.source,
        applyState: { status: "IDLE" },
        resolutionFinding: null,
        targetFindingCleared: false,
        preparedSample: null,
        exportContext: null,
        failure: null,
      };
    case "SOURCE_REJECTED":
      return {
        ...state,
        phase: "REJECTED",
        document: null,
        rejectedSource: action.source,
        report: null,
        diagnostics: action.diagnostics,
        preparedSample: null,
        selection: null,
        applyState: { status: "IDLE" },
        resolutionFinding: null,
        exportContext: null,
      };
    case "SOURCE_READY":
      return {
        ...state,
        phase: "READY",
        document: action.document,
        rejectedSource: null,
        report: action.report,
        diagnostics: action.diagnostics,
        selection: state.selection,
        exportContext: null,
        failure: null,
      };
    case "OPERATION_FAILED":
      return { ...state, phase: "FAILED", failure: action.message };
    case "SET_FILTER":
      return { ...state, filter: action.filter };
    case "SELECT_FINDING":
      return {
        ...state,
        selection: action.selection,
        resolutionFinding: null,
        applyState: { status: "IDLE" },
        targetFindingCleared: false,
        copyStatus: "IDLE",
      };
    case "FOCUS_RULE":
      return { ...state, focusedRuleId: action.ruleId };
    case "REVIEW_PATCH":
      return { ...state, resolutionFinding: action.finding, applyState: { status: "REVIEWING", patchId: action.patchId } };
    case "CANCEL_PATCH":
      return { ...state, applyState: { status: "IDLE" } };
    case "APPLY_PATCH":
      return { ...state, applyState: { status: "APPLYING", patchId: action.patchId } };
    case "PATCH_REJECTED":
      return { ...state, applyState: { status: "REJECTED", patchId: action.patchId, reason: action.reason } };
    case "PATCH_APPLIED":
      return {
        ...state,
        phase: "READY",
        document: action.document,
        report: action.report,
        rejectedSource: null,
        diagnostics: [],
        selection: null,
        preparedSample: null,
        applyState: { status: "APPLIED", patchId: action.patchId, proof: action.proof },
        targetFindingCleared: true,
        exportContext: {
          before: action.before,
          findingId: action.findingId,
          repairCoreRuleIds: action.proof.conflictRuleIds,
        },
        failure: null,
      };
    case "SET_DRAWER":
      return { ...state, drawerOpen: action.open };
    case "COPY_STATUS":
      return { ...state, copyStatus: action.status };
  }
}

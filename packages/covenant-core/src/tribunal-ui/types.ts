import type { ReactNode } from "react";
import type {
  CovenantDocument,
  FindingId,
  FiveInquisitorVerdicts,
  Inquisitor,
  NonEmpty,
  OpenPBTSnapshot,
  ParseDiagnostic,
  PatchRejectionReason,
  PhantomWitness,
  PreservationProof,
  ResolutionPayload,
  RuleId,
  SourceDocument,
  VerdictStatus,
  VerificationReport,
  VerificationTelemetry,
} from "../model.js";

export type TribunalSkin = "spec-inquisitor" | "clause-exorcist";
export type TribunalStatus = VerdictStatus;
export type InquisitorFilter = Inquisitor | "ALL";

export interface TribunalThemeProps {
  readonly skin: TribunalSkin;
  readonly children: ReactNode;
}

export interface InquisitorLanternBarProps {
  readonly verdicts: FiveInquisitorVerdicts;
  readonly selected: InquisitorFilter;
  readonly onSelect: (inquisitor: InquisitorFilter) => void;
  readonly verifying: boolean;
  readonly findingsPanelId?: string;
}

export interface FindingSelection {
  readonly inquisitor: Inquisitor;
  readonly findingId: FindingId;
}

export type InspectorSourceState =
  | {
      readonly status: "VERIFIED";
      readonly document: CovenantDocument;
      readonly report: VerificationReport;
      readonly diagnostics: readonly ParseDiagnostic[];
    }
  | {
      readonly status: "REJECTED";
      readonly source: SourceDocument;
      readonly diagnostics: NonEmpty<ParseDiagnostic>;
    };

export type SourceChangeKind = "ADDITION" | "REMOVAL" | "REPLACEMENT";

export interface SourceChangeMarker {
  readonly ruleId: RuleId;
  readonly kind: SourceChangeKind;
}

export interface SplitScrollInspectorProps {
  readonly sourceState: InspectorSourceState;
  readonly visibleInquisitor: InquisitorFilter;
  readonly selection: FindingSelection | null;
  readonly focusedRuleId: RuleId | null;
  readonly editable: boolean;
  readonly changeMarkers?: readonly SourceChangeMarker[];
  readonly onEditableChange?: (editable: boolean) => void;
  readonly onSourceChange?: (text: string) => void;
  readonly onSelectFinding: (selection: FindingSelection) => void;
  readonly onClearFinding: () => void;
  readonly onVisibleInquisitorChange: (inquisitor: InquisitorFilter) => void;
  readonly onFocusRule: (ruleId: RuleId | null) => void;
}

export type CopyEvidenceResult = "COPIED" | "DENIED";

export interface PhantomWitnessStandProps {
  readonly witness: PhantomWitness;
  readonly copyStatus: "IDLE" | CopyEvidenceResult;
  readonly onCopy: (plainText: string) => Promise<CopyEvidenceResult>;
}

export type PbtPresentationState =
  | { readonly status: "VALID"; readonly snapshot: OpenPBTSnapshot }
  | { readonly status: "INVALID"; readonly reason: string };

export type PatchApplyState =
  | { readonly status: "IDLE" }
  | { readonly status: "REVIEWING"; readonly patchId: string }
  | { readonly status: "APPLYING"; readonly patchId: string }
  | {
      readonly status: "REJECTED";
      readonly patchId: string;
      readonly reason: PatchRejectionReason;
    }
  | {
      readonly status: "APPLIED";
      readonly patchId: string;
      readonly proof: PreservationProof;
    };

export interface ChaliceResolutionPanelProps {
  readonly verdict: VerdictStatus;
  readonly resolution: ResolutionPayload;
  readonly applyState: PatchApplyState;
  readonly onReview: (patchId: string) => void;
  readonly onCancelReview: () => void;
  readonly onApply: (patchId: string) => void;
}

export interface CertificationSealProps {
  readonly report: VerificationReport;
}

export interface VerificationDrawerProps {
  readonly telemetry: readonly VerificationTelemetry[];
  readonly pbt: PbtPresentationState;
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
}

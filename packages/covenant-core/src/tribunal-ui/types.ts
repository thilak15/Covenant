import type { ReactNode } from "react";
import type {
  CovenantDocument,
  FindingId,
  FiveInquisitorVerdicts,
  Inquisitor,
  NonEmpty,
  ParseDiagnostic,
  PhantomWitness,
  RuleId,
  SourceDocument,
  VerdictStatus,
  VerificationReport,
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

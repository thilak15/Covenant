import type { ReactNode } from "react";
import type { FiveInquisitorVerdicts, Inquisitor, VerdictStatus } from "../model.js";

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

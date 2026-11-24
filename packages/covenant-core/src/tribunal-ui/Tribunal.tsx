import { motion } from "framer-motion";
import type { MotionStyle } from "framer-motion";
import {
  CircleCheckBig,
  CircleHelp,
  CircleUserRound,
  ListFilter,
  OctagonX,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { KeyboardEvent, ReactElement } from "react";
import type { FiveInquisitorVerdicts, Inquisitor, VerdictStatus } from "../model.js";
import { lanternFlareVariants, lanternItemVariants, lanternRailVariants, useTribunalReducedMotion } from "./motion.js";
import type { InquisitorLanternBarProps, TribunalThemeProps } from "./types.js";

const INQUISITOR_NAMES = {
  TESTABILITY: "Testability",
  CONSISTENCY: "Consistency",
  COMPLETENESS: "Completeness",
  UNAMBIGUITY: "Unambiguity",
  SECURITY_LIVENESS: "Security & Liveness",
} as const satisfies Readonly<Record<Inquisitor, string>>;

type LanternStyle = MotionStyle & { readonly "--cov-lantern-delay": string };

function StatusIcon({ status }: { readonly status: VerdictStatus }): ReactElement {
  const shared = { "aria-hidden": true, "data-testid": `status-icon-${status}`, size: 18, strokeWidth: 2.25 } as const;
  if (status === "PASS") return <CircleCheckBig {...shared} />;
  if (status === "FAIL") return <OctagonX {...shared} />;
  return <CircleHelp {...shared} />;
}

function aggregateAnnouncement(verdicts: FiveInquisitorVerdicts, verifying: boolean): string {
  if (verifying) return "Verification in progress. Previous results remain visible.";
  const pass = verdicts.filter((verdict) => verdict.status === "PASS").length;
  const fail = verdicts.filter((verdict) => verdict.status === "FAIL").length;
  const unknown = verdicts.filter((verdict) => verdict.status === "UNKNOWN").length;
  const findings = verdicts.reduce((total, verdict) => total + verdict.findings.length, 0);
  return `Verification complete. ${pass} PASS, ${fail} FAIL, ${unknown} UNKNOWN. ${findings} ${findings === 1 ? "finding" : "findings"}.`;
}

export function TribunalTheme({ skin, children }: TribunalThemeProps): ReactElement {
  return (
    <div className="cov-tribunal-theme" data-tribunal-skin={skin}>
      {children}
    </div>
  );
}

export function InquisitorLanternBar({
  verdicts,
  selected,
  onSelect,
  verifying,
  findingsPanelId,
}: InquisitorLanternBarProps): ReactElement {
  const reducedMotion = useTribunalReducedMotion();
  const selectedIndex = verdicts.findIndex((verdict) => verdict.inquisitor === selected);
  const [focusIndex, setFocusIndex] = useState(selectedIndex < 0 ? 0 : selectedIndex);
  const [resolving, setResolving] = useState(false);
  const wasVerifying = useRef(verifying);
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const announcement = useMemo(
    () => aggregateAnnouncement(verdicts, verifying),
    [verdicts, verifying],
  );

  useEffect(() => {
    if (selectedIndex >= 0) setFocusIndex(selectedIndex);
  }, [selectedIndex]);

  useEffect(() => {
    const verificationWasRunning = wasVerifying.current;
    wasVerifying.current = verifying;
    if (verifying) {
      setResolving(false);
    } else if (verificationWasRunning) {
      setResolving(true);
    }
  }, [verifying]);

  function moveFocus(index: number): void {
    setFocusIndex(index);
    tabRefs.current[index]?.focus();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number): void {
    let target: number | null = null;
    if (event.key === "ArrowRight") target = (index + 1) % verdicts.length;
    if (event.key === "ArrowLeft") target = (index - 1 + verdicts.length) % verdicts.length;
    if (event.key === "Home") target = 0;
    if (event.key === "End") target = verdicts.length - 1;
    if (target !== null) {
      event.preventDefault();
      moveFocus(target);
      return;
    }
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      const verdict = verdicts[index];
      if (verdict !== undefined) onSelect(verdict.inquisitor);
    }
  }

  return (
    <nav className="cov-inquisitor-bar" aria-label="Formal verification filters" aria-busy={verifying}>
      <div className="cov-inquisitor-bar__heading">
        <span className="cov-inquisitor-bar__title">The Five Hooded Inquisitors</span>
        <button
          className="cov-inquisitor-bar__all"
          type="button"
          aria-label="Show all findings"
          aria-pressed={selected === "ALL"}
          onClick={() => onSelect("ALL")}
        >
          <ListFilter aria-hidden="true" size={17} />
          All findings
        </button>
      </div>
      <motion.ol
        className="cov-inquisitor-tabs"
        role="tablist"
        aria-label="Five Hooded Inquisitors"
        data-motion={reducedMotion ? "reduced" : "full"}
        variants={lanternRailVariants(reducedMotion)}
        initial="resting"
        animate={resolving ? "resolved" : "resting"}
        data-resolving={resolving ? "true" : "false"}
      >
        {verdicts.map((verdict, index) => {
          const name = INQUISITOR_NAMES[verdict.inquisitor];
          const selectedTab = selected === verdict.inquisitor;
          const count = verdict.findings.length;
          const style: LanternStyle = {
            "--cov-lantern-delay": reducedMotion ? "0ms" : `${index * 70}ms`,
          };
          return (
            <motion.li
              className="cov-inquisitor-tabs__item"
              key={verdict.inquisitor}
              style={style}
              variants={lanternItemVariants(reducedMotion)}
            >
              <button
                ref={(element) => { tabRefs.current[index] = element; }}
                className="cov-inquisitor-tab"
                type="button"
                role="tab"
                id={`cov-inquisitor-${verdict.inquisitor.toLowerCase()}`}
                {...(findingsPanelId === undefined ? {} : { "aria-controls": findingsPanelId })}
                aria-selected={selectedTab}
                tabIndex={focusIndex === index ? 0 : -1}
                data-status={verdict.status}
                onClick={() => {
                  setFocusIndex(index);
                  onSelect(verdict.inquisitor);
                }}
                onFocus={() => setFocusIndex(index)}
                onKeyDown={(event) => handleKeyDown(event, index)}
              >
                <CircleUserRound className="cov-inquisitor-tab__hood" aria-hidden="true" size={22} strokeWidth={1.6} />
                <span className="cov-inquisitor-tab__copy">
                  <span className="cov-inquisitor-tab__name" data-testid="inquisitor-name">{name}</span>
                  <span className="cov-inquisitor-tab__finding-count">{count} {count === 1 ? "finding" : "findings"}</span>
                </span>
                <span className="cov-inquisitor-tab__verdict">
                  <StatusIcon status={verdict.status} />
                  <span data-testid="verdict-word">{verdict.status}</span>
                  <span className="cov-inquisitor-tab__lantern" aria-hidden="true">
                    <motion.span
                      className="cov-inquisitor-tab__lantern-flare"
                      variants={lanternFlareVariants(reducedMotion)}
                    />
                  </span>
                </span>
              </button>
            </motion.li>
          );
        })}
      </motion.ol>
      <p className="cov-sr-only" role="status" aria-live="polite" aria-atomic="true">{announcement}</p>
    </nav>
  );
}

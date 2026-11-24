import { motion } from "framer-motion";
import type { MotionStyle } from "framer-motion";
import {
  CircleCheckBig,
  CircleHelp,
  CircleUserRound,
  Clipboard,
  FileMinus2,
  FilePlus2,
  Link as LinkIcon,
  ListFilter,
  OctagonX,
  RefreshCcw,
  Replace,
} from "lucide-react";
import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, KeyboardEvent, PointerEvent as ReactPointerEvent, ReactElement } from "react";
import type {
  Condition,
  EvidenceByInquisitor,
  FiveInquisitorVerdicts,
  Inquisitor,
  ScalarValue,
  TriggeredConsequence,
  VerdictStatus,
  VerificationReport,
} from "../model.js";
import { lanternFlareVariants, lanternItemVariants, lanternRailVariants, tribunalDuration, tribunalEasing, useTribunalReducedMotion } from "./motion.js";
import type {
  CopyEvidenceResult,
  FindingSelection,
  InquisitorLanternBarProps,
  PhantomWitnessStandProps,
  SourceChangeKind,
  SplitScrollInspectorProps,
  TribunalThemeProps,
} from "./types.js";

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

type InspectorStyle = CSSProperties & {
  readonly "--cov-source-pane": string;
  readonly "--cov-evidence-pane": string;
};

interface PaneDragState {
  readonly pointerId: number;
  readonly startPercent: number;
}

interface EditorSelectionSnapshot {
  readonly start: number;
  readonly end: number;
  readonly direction: "forward" | "backward" | "none";
  readonly ruleId: string | null;
  readonly relativeStart: number;
  readonly relativeEnd: number;
}

interface InspectorFindingView {
  readonly selection: FindingSelection;
  readonly title: string;
  readonly message: string;
  readonly ruleIds: readonly string[];
  readonly coreRuleIds: readonly string[];
}

function domIdentity(prefix: "clause" | "finding" | "witness", value: string): string {
  const encoded = Array.from(value, (character) => character.codePointAt(0)?.toString(16).padStart(6, "0") ?? "000000").join("-");
  return `cov-${prefix}-${encoded || "empty"}`;
}

function clauseAnchor(ruleId: string): string {
  return domIdentity("clause", ruleId);
}

function findingAnchor(findingId: string): string {
  return domIdentity("finding", findingId);
}

function evidenceRuleIds(evidence: EvidenceByInquisitor[Inquisitor]): readonly string[] {
  switch (evidence.kind) {
    case "TESTABILITY": return [evidence.source.clauseRef];
    case "CONSISTENCY": return evidence.core.ruleIds;
    case "COMPLETENESS": return [];
    case "UNAMBIGUITY": return evidence.ruleIds;
    case "SECURITY_LIVENESS": return evidence.ruleIds;
  }
}

function findingViews(report: VerificationReport, filter: SplitScrollInspectorProps["visibleInquisitor"]): readonly InspectorFindingView[] {
  const views: InspectorFindingView[] = [];
  for (const verdict of report.verdicts) {
    if (filter !== "ALL" && verdict.inquisitor !== filter) continue;
    for (const finding of verdict.findings) {
      const evidence: EvidenceByInquisitor[Inquisitor] = finding.evidence;
      views.push({
        selection: { inquisitor: verdict.inquisitor, findingId: finding.id },
        title: finding.title,
        message: finding.message,
        ruleIds: evidenceRuleIds(evidence),
        coreRuleIds: evidence.kind === "CONSISTENCY" ? evidence.core.ruleIds : [],
      });
    }
  }
  return views;
}

function sameSelection(left: FindingSelection | null, right: FindingSelection): boolean {
  return left !== null && left.inquisitor === right.inquisitor && left.findingId === right.findingId;
}

function ChangeMarker({ kind }: { readonly kind: SourceChangeKind }): ReactElement {
  if (kind === "ADDITION") {
    return <span className="cov-source-change" data-change-kind={kind}><FilePlus2 aria-hidden="true" size={15} />Added</span>;
  }
  if (kind === "REMOVAL") {
    return <span className="cov-source-change" data-change-kind={kind}><FileMinus2 aria-hidden="true" size={15} />Removed</span>;
  }
  return <span className="cov-source-change" data-change-kind={kind}><Replace aria-hidden="true" size={15} />Replaced</span>;
}

export function SplitScrollInspector({
  sourceState,
  visibleInquisitor,
  selection,
  focusedRuleId,
  editable,
  changeMarkers = [],
  onSourceChange,
  onSelectFinding,
  onClearFinding,
  onVisibleInquisitorChange,
  onFocusRule,
}: SplitScrollInspectorProps): ReactElement {
  const [sourcePercent, setSourcePercent] = useState(58);
  const sourceRevisionId = useId();
  const editorRef = useRef<HTMLTextAreaElement | null>(null);
  const resultsHeadingRef = useRef<HTMLHeadingElement | null>(null);
  const editorSelectionRef = useRef<EditorSelectionSnapshot | null>(null);
  const paneDragRef = useRef<PaneDragState | null>(null);
  const reducedMotion = useTribunalReducedMotion();
  const verified = sourceState.status === "VERIFIED" ? sourceState : null;
  const source = sourceState.status === "VERIFIED" ? sourceState.document.source : sourceState.source;
  const rules = useMemo(
    () => verified === null ? [] : [...verified.document.rules].sort((left, right) => left.source.start.offset - right.source.start.offset),
    [verified],
  );
  const allViews = useMemo(
    () => verified === null ? [] : findingViews(verified.report, "ALL"),
    [verified],
  );
  const views = useMemo(
    () => visibleInquisitor === "ALL" ? allViews : allViews.filter((view) => view.selection.inquisitor === visibleInquisitor),
    [allViews, visibleInquisitor],
  );
  const selectedView = allViews.find((view) => sameSelection(selection, view.selection)) ?? null;
  const selectedCore = new Set(selectedView?.coreRuleIds ?? []);
  const markerByRule = new Map(changeMarkers.map((marker) => [marker.ruleId, marker.kind] as const));
  const style: InspectorStyle = {
    "--cov-source-pane": `${sourcePercent}fr`,
    "--cov-evidence-pane": `${100 - sourcePercent}fr`,
  };

  useLayoutEffect(() => {
    const editor = editorRef.current;
    const snapshot = editorSelectionRef.current;
    if (editor === null || snapshot === null || document.activeElement !== editor) return;
    const survivingRule = snapshot.ruleId === null ? undefined : rules.find((rule) => rule.id === snapshot.ruleId);
    let start: number;
    let end: number;
    if (survivingRule !== undefined) {
      const clauseLength = survivingRule.source.end.offset - survivingRule.source.start.offset;
      start = survivingRule.source.start.offset + Math.min(snapshot.relativeStart, clauseLength);
      end = survivingRule.source.start.offset + Math.min(snapshot.relativeEnd, clauseLength);
    } else if (rules.length > 0) {
      const nearest = rules.reduce((best, rule) =>
        Math.abs(rule.source.start.offset - snapshot.start) < Math.abs(best.source.start.offset - snapshot.start) ? rule : best,
      );
      start = nearest.source.start.offset;
      end = start;
    } else {
      start = Math.min(snapshot.start, source.text.length);
      end = Math.min(snapshot.end, source.text.length);
    }
    editor.setSelectionRange(Math.min(start, source.text.length), Math.min(end, source.text.length), snapshot.direction);
  }, [rules, source.revision, source.text]);

  function rememberEditorSelection(editor: HTMLTextAreaElement): void {
    const containingRule = rules.find((rule) =>
      rule.source.start.offset <= editor.selectionStart && editor.selectionStart <= rule.source.end.offset,
    );
    const base = containingRule?.source.start.offset ?? 0;
    editorSelectionRef.current = {
      start: editor.selectionStart,
      end: editor.selectionEnd,
      direction: editor.selectionDirection,
      ruleId: containingRule?.id ?? null,
      relativeStart: editor.selectionStart - base,
      relativeEnd: editor.selectionEnd - base,
    };
  }

  useEffect(() => {
    if (selection === null || views.some((view) => sameSelection(selection, view.selection))) return;
    onClearFinding();
    resultsHeadingRef.current?.focus();
  }, [onClearFinding, selection, views]);

  function resize(next: number): void {
    if (!Number.isFinite(next)) return;
    setSourcePercent(Math.min(70, Math.max(30, next)));
  }

  function handleResizeKey(event: KeyboardEvent<HTMLDivElement>): void {
    let next: number | null = null;
    if (event.key === "ArrowLeft") next = sourcePercent - 2;
    if (event.key === "ArrowRight") next = sourcePercent + 2;
    if (event.key === "PageDown") next = sourcePercent - 10;
    if (event.key === "PageUp") next = sourcePercent + 10;
    if (event.key === "Home") next = 58;
    if (event.key === "End") next = 70;
    if (next !== null) {
      event.preventDefault();
      resize(next);
    }
  }

  function panePercentFromPointer(event: ReactPointerEvent<HTMLDivElement>): number | null {
    const panes = event.currentTarget.parentElement?.parentElement;
    if (panes === null || panes === undefined) return null;
    const bounds = panes.getBoundingClientRect();
    if (bounds.width <= 0) return null;
    return ((event.clientX - bounds.left) / bounds.width) * 100;
  }

  function beginPaneDrag(event: ReactPointerEvent<HTMLDivElement>): void {
    event.preventDefault();
    paneDragRef.current = { pointerId: event.pointerId, startPercent: sourcePercent };
    event.currentTarget.setPointerCapture?.(event.pointerId);
  }

  function movePaneDrag(event: ReactPointerEvent<HTMLDivElement>): void {
    if (paneDragRef.current?.pointerId !== event.pointerId) return;
    const next = panePercentFromPointer(event);
    if (next !== null) resize(next);
  }

  function finishPaneDrag(event: ReactPointerEvent<HTMLDivElement>): void {
    if (paneDragRef.current?.pointerId !== event.pointerId) return;
    paneDragRef.current = null;
    event.currentTarget.releasePointerCapture?.(event.pointerId);
  }

  function cancelPaneDrag(event: ReactPointerEvent<HTMLDivElement>): void {
    const drag = paneDragRef.current;
    if (drag?.pointerId !== event.pointerId) return;
    paneDragRef.current = null;
    resize(drag.startPercent);
    event.currentTarget.releasePointerCapture?.(event.pointerId);
  }

  function losePaneCapture(): void {
    const drag = paneDragRef.current;
    if (drag === null) return;
    paneDragRef.current = null;
    resize(drag.startPercent);
  }

  function revealSource(ruleId: string): void {
    document.getElementById(clauseAnchor(ruleId))?.scrollIntoView?.({ block: "nearest" });
  }

  function revealEvidence(ruleId: string): void {
    const associated = selectedView?.ruleIds.includes(ruleId) === true
      ? selectedView
      : allViews.find((view) => view.ruleIds.includes(ruleId));
    if (associated === undefined) return;
    if (associated.selection.inquisitor !== visibleInquisitor) onVisibleInquisitorChange(associated.selection.inquisitor);
    onSelectFinding(associated.selection);
    document.getElementById(findingAnchor(associated.selection.findingId))?.scrollIntoView?.({ block: "nearest" });
  }

  const lineCount = source.text.split("\n").length;
  const ruleByStartLine = new Map(rules.map((rule) => [rule.source.start.line, rule] as const));
  const gutter = (
    <ol className="cov-source-gutter" data-testid="source-id-gutter" aria-label="Rule ID gutter">
      {Array.from({ length: lineCount }, (_, index) => index + 1).map((line) => {
        const rule = ruleByStartLine.get(line);
        if (rule === undefined) return <li key={`line-${line}`} aria-hidden="true"><span>{line}</span></li>;
        const marker = markerByRule.get(rule.id);
        return (
          <li key={rule.id} data-core-member={selectedCore.has(rule.id) ? "true" : "false"} data-linked={focusedRuleId === rule.id ? "true" : "false"}>
            <button id={clauseAnchor(rule.id)} type="button" onClick={() => revealEvidence(rule.id)} aria-label={`Reveal evidence for rule ${rule.id}`}>
              <span>Line {line}</span>
              <strong>{rule.id}</strong>
              {selectedCore.has(rule.id) ? <span>Unsat Core</span> : null}
              {marker === undefined ? null : <span>{marker === "ADDITION" ? "Added" : marker === "REMOVAL" ? "Removed" : "Replaced"}</span>}
            </button>
          </li>
        );
      })}
    </ol>
  );

  return (
    <section className="cov-split-scroll" aria-label="Split Scroll inspector" style={style} data-motion={reducedMotion ? "reduced" : "full"}>
      <header className="cov-split-scroll__header">
        <div>
          <h2>Split Scroll Inspector</h2>
        </div>
        <p data-testid="active-filter">{visibleInquisitor === "ALL" ? "All findings" : `${INQUISITOR_NAMES[visibleInquisitor]} findings`}</p>
      </header>
      <div className="cov-split-scroll__panes">
        <section className="cov-source-pane" aria-label="Authoritative source">
          <div className="cov-source-pane__meta">
            <span>Revision {source.revision}</span>
            <span>{source.format}</span>
          </div>
          {sourceState.diagnostics.length === 0 ? null : (
            <ul className="cov-source-diagnostics" aria-label="Source diagnostics">
              {sourceState.diagnostics.map((diagnostic, index) => (
                <li key={`${diagnostic.code}-${index}`} data-severity={diagnostic.severity}>
                  <strong>{diagnostic.severity}: {diagnostic.code}</strong>
                  <span>{diagnostic.message}{diagnostic.location === null ? "" : ` Line ${diagnostic.location.start.line}.`}</span>
                </li>
              ))}
            </ul>
          )}
          {editable ? (
            <div className="cov-source-editor">
              {gutter}
              <label className="cov-source-editor__field">
                <span className="cov-sr-only">Authoritative source text</span>
                <textarea
                  ref={editorRef}
                  value={source.text}
                  spellCheck="false"
                  wrap="off"
                  style={{ height: `${Math.max(360, (lineCount * 44) + 32)}px` }}
                  aria-describedby={sourceRevisionId}
                  onSelect={(event) => rememberEditorSelection(event.currentTarget)}
                  onChange={(event) => {
                    rememberEditorSelection(event.currentTarget);
                    onSourceChange?.(event.currentTarget.value);
                  }}
                />
              </label>
              <span id={sourceRevisionId} className="cov-sr-only">Source revision {source.revision}</span>
            </div>
          ) : sourceState.status === "REJECTED" ? (
            <pre className="cov-rejected-source">{source.text}</pre>
          ) : (
            <ol className="cov-source-clauses" aria-label="Formal source clauses">
              {rules.map((rule) => {
                const marker = markerByRule.get(rule.id);
                const clause = source.text.slice(rule.source.start.offset, rule.source.end.offset);
                const coreMember = selectedCore.has(rule.id);
                const linked = focusedRuleId === rule.id;
                return (
                  <motion.li
                    id={clauseAnchor(rule.id)}
                    key={rule.id}
                    data-testid={`source-rule-${rule.id}`}
                    data-rule-id={rule.id}
                    data-core-member={coreMember ? "true" : "false"}
                    data-linked={linked ? "true" : "false"}
                    {...(reducedMotion ? {} : { animate: { x: linked ? 3 : 0 } })}
                    transition={{ duration: reducedMotion ? 0 : tribunalDuration.micro, ease: tribunalEasing.control }}
                  >
                    <div className="cov-source-clause__gutter">
                      <span>Line {rule.source.start.line}</span>
                      <button type="button" onClick={() => revealEvidence(rule.id)} aria-label={`Reveal evidence for rule ${rule.id}`}>{rule.id}</button>
                    </div>
                    <code data-testid="clause-source">{clause}</code>
                    <div className="cov-source-clause__markers">
                      {coreMember ? <span className="cov-core-badge"><LinkIcon aria-hidden="true" size={14} />Unsat Core member</span> : null}
                      {marker === undefined ? null : <ChangeMarker kind={marker} />}
                    </div>
                  </motion.li>
                );
              })}
            </ol>
          )}
        </section>

        <div className="cov-pane-resizer">
          <div
            role="separator"
            tabIndex={0}
            aria-label="Resize source and evidence panes"
            aria-orientation="vertical"
            aria-valuemin={30}
            aria-valuemax={70}
            aria-valuenow={sourcePercent}
            onKeyDown={handleResizeKey}
            onPointerDown={beginPaneDrag}
            onPointerMove={movePaneDrag}
            onPointerUp={finishPaneDrag}
            onPointerCancel={cancelPaneDrag}
            onLostPointerCapture={losePaneCapture}
          />
          <button type="button" onClick={() => resize(58)} aria-label="Reset pane sizes" title="Reset pane sizes">
            <RefreshCcw aria-hidden="true" size={16} />
          </button>
        </div>

        <section className="cov-evidence-pane" aria-label="Finding evidence">
          <h3 ref={resultsHeadingRef} tabIndex={-1}>Finding evidence</h3>
          {views.length === 0 ? (
            <div className="cov-empty-findings">
              <p>No findings match this filter.</p>
              <button type="button" onClick={() => onVisibleInquisitorChange("ALL")}>Show all findings</button>
            </div>
          ) : (
            <ol className="cov-finding-list">
              {views.map((view) => {
                const selected = sameSelection(selection, view.selection);
                return (
                  <motion.li
                    id={findingAnchor(view.selection.findingId)}
                    key={`${view.selection.inquisitor}-${view.selection.findingId}`}
                    data-testid={`finding-${view.selection.findingId}`}
                    data-selected={selected ? "true" : "false"}
                    initial={false}
                    animate={{ opacity: 1 }}
                    transition={{ duration: reducedMotion ? 0 : tribunalDuration.micro, ease: tribunalEasing.settle }}
                  >
                    <button type="button" aria-pressed={selected} onClick={() => onSelectFinding(view.selection)} aria-label={`Select finding: ${view.title}`}>
                      <span>{INQUISITOR_NAMES[view.selection.inquisitor]}</span>
                      <strong>{view.title}</strong>
                    </button>
                    <p>{view.message}</p>
                    {selected && view.ruleIds.length > 0 ? (
                      <ul className="cov-evidence-rule-links" aria-label="Linked source rules">
                        {view.ruleIds.map((ruleId) => (
                          <li key={ruleId}>
                            <a
                              href={`#${clauseAnchor(ruleId)}`}
                              onMouseEnter={() => onFocusRule(ruleId)}
                              onMouseLeave={(event) => {
                                if (document.activeElement !== event.currentTarget) onFocusRule(null);
                              }}
                              onFocus={() => onFocusRule(ruleId)}
                              onBlur={() => onFocusRule(null)}
                              onClick={(event) => {
                                event.preventDefault();
                                revealSource(ruleId);
                              }}
                            >
                              <LinkIcon aria-hidden="true" size={14} />
                              <span>View source rule {ruleId}</span>
                            </a>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </motion.li>
                );
              })}
            </ol>
          )}
        </section>
      </div>
    </section>
  );
}

function finiteDecimal(numerator: bigint, initialDenominator: bigint): string | null {
  let denominator = initialDenominator;
  let twos = 0;
  let fives = 0;
  while (denominator % 2n === 0n) {
    denominator /= 2n;
    twos += 1;
  }
  while (denominator % 5n === 0n) {
    denominator /= 5n;
    fives += 1;
  }
  if (denominator !== 1n) return null;
  const places = Math.max(twos, fives);
  const scale = (2n ** BigInt(places - twos)) * (5n ** BigInt(places - fives));
  const scaled = numerator * scale;
  if (places === 0) return scaled.toString(10);
  const negative = scaled < 0n;
  const digits = (negative ? -scaled : scaled).toString(10).padStart(places + 1, "0");
  const split = digits.length - places;
  return `${negative ? "-" : ""}${digits.slice(0, split)}.${digits.slice(split)}`;
}

function exactScalar(value: ScalarValue): string {
  switch (value.kind) {
    case "BOOLEAN": return value.value ? "true" : "false";
    case "ENUM": return JSON.stringify(value.value);
    case "INTEGER": return value.value.toString(10);
    case "DECIMAL": return finiteDecimal(value.value.numerator, value.value.denominator)
      ?? `${value.value.numerator.toString(10)}/${value.value.denominator.toString(10)}`;
  }
}

function conditionPrecedence(condition: Condition): number {
  if (condition.kind === "ANY") return 1;
  if (condition.kind === "ALL") return 2;
  if (condition.kind === "NOT") return 3;
  return 4;
}

function conditionText(condition: Condition, parentPrecedence = 0): string {
  const precedence = conditionPrecedence(condition);
  let text: string;
  switch (condition.kind) {
    case "TRUE": text = "true"; break;
    case "FALSE": text = "false"; break;
    case "BOOLEAN": text = `${condition.variable} = ${condition.equals ? "true" : "false"}`; break;
    case "ENUM": text = `${condition.variable} ${condition.operator === "EQ" ? "=" : "!="} ${JSON.stringify(condition.value)}`; break;
    case "NUMERIC": {
      const parts: string[] = [];
      const lower = condition.bound.lower;
      const upper = condition.bound.upper;
      if (lower !== undefined) {
        const value = finiteDecimal(lower.value.numerator, lower.value.denominator) ?? `${lower.value.numerator}/${lower.value.denominator}`;
        parts.push(`${condition.bound.variable} ${lower.inclusive ? ">=" : ">"} ${value}`);
      }
      if (upper !== undefined) {
        const value = finiteDecimal(upper.value.numerator, upper.value.denominator) ?? `${upper.value.numerator}/${upper.value.denominator}`;
        parts.push(`${condition.bound.variable} ${upper.inclusive ? "<=" : "<"} ${value}`);
      }
      text = parts.length === 0 ? `${condition.bound.variable} is unbounded` : parts.join(" and ");
      break;
    }
    case "NOT": text = `not (${conditionText(condition.condition)})`; break;
    case "ALL": text = condition.conditions.map((child) => conditionText(child, precedence)).join(" and "); break;
    case "ANY": text = condition.conditions.map((child) => conditionText(child, precedence)).join(" or "); break;
  }
  return precedence < parentPrecedence ? `(${text})` : text;
}

function consequenceText(consequence: TriggeredConsequence): string {
  const modality = consequence.modality === "MUST_NOT" ? "MUST NOT" : consequence.modality;
  return `${consequence.ruleId} ${modality} ${conditionText(consequence.consequence)}`;
}

function witnessPlainText(witness: PhantomWitnessStandProps["witness"]): string {
  const rows = witness.assignments.map((assignment) => `${assignment.variable} = ${exactScalar(assignment.value)}`);
  return [
    `Phantom Witness — ${witness.queryId}`,
    ...rows,
    `Activates: ${witness.coreRuleIds.join(", ")}`,
    `Triggered result: ${witness.triggeredConsequences.map(consequenceText).join("; ")}.`,
  ].join("\n");
}

export function PhantomWitnessStand({ witness, copyStatus, onCopy }: PhantomWitnessStandProps): ReactElement {
  const componentId = useId();
  const [copying, setCopying] = useState(false);
  const [attemptStatus, setAttemptStatus] = useState<CopyEvidenceResult | null>(null);
  const plainText = useMemo(() => witnessPlainText(witness), [witness]);
  const activeTextRef = useRef(plainText);
  const copyAttemptRef = useRef(0);
  activeTextRef.current = plainText;
  const displayedStatus = attemptStatus ?? copyStatus;

  useLayoutEffect(() => {
    copyAttemptRef.current += 1;
    setCopying(false);
    setAttemptStatus(null);
  }, [plainText]);

  useEffect(() => {
    setAttemptStatus(copyStatus === "IDLE" ? null : copyStatus);
  }, [copyStatus]);

  async function copyEvidence(): Promise<void> {
    const copiedText = plainText;
    const attempt = copyAttemptRef.current + 1;
    copyAttemptRef.current = attempt;
    setCopying(true);
    try {
      const result = await onCopy(copiedText);
      if (copyAttemptRef.current === attempt && activeTextRef.current === copiedText) setAttemptStatus(result);
    } catch {
      if (copyAttemptRef.current === attempt && activeTextRef.current === copiedText) setAttemptStatus("DENIED");
    } finally {
      if (copyAttemptRef.current === attempt && activeTextRef.current === copiedText) setCopying(false);
    }
  }

  const triggeredResult = `Triggered result: ${witness.triggeredConsequences.map(consequenceText).join("; ")}.`;
  const witnessHeadingId = domIdentity("witness", `${witness.queryId}:${componentId}`);
  return (
    <section className="cov-witness-stand" aria-labelledby={witnessHeadingId}>
      <header>
        <div>
          <h2 id={witnessHeadingId}>Phantom Witness</h2>
          <p>Concrete assignments that activate every rule in this Unsat Core.</p>
        </div>
        <button className="cov-copy-evidence" type="button" disabled={copying} onClick={() => { void copyEvidence(); }} aria-label="Copy Phantom Witness evidence">
          <Clipboard aria-hidden="true" size={17} />
          {copying ? "Copying…" : "Copy evidence"}
        </button>
      </header>
      <div className="cov-witness-table-wrap">
        <table aria-label="Canonical Phantom Witness assignments">
          <thead><tr><th scope="col">Variable</th><th scope="col">Value</th></tr></thead>
          <tbody>
            {witness.assignments.map((assignment) => (
              <tr key={assignment.variable}><td>{assignment.variable}</td><td>{exactScalar(assignment.value)}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="cov-witness-activates" data-testid="witness-activated-rules">
        <strong>Activates:</strong>{" "}
        {witness.coreRuleIds.map((ruleId, index) => (
          <span key={ruleId}>{index === 0 ? "" : ", "}<a href={`#${clauseAnchor(ruleId)}`} aria-label={`Source rule ${ruleId}`}>{ruleId}</a></span>
        ))}
      </p>
      <p className="cov-witness-result" data-testid="witness-triggered-result"><strong>Triggered result:</strong> {triggeredResult.slice("Triggered result: ".length)}</p>
      {displayedStatus === "COPIED" ? <p className="cov-copy-status" role="status">Phantom Witness evidence copied.</p> : null}
      {displayedStatus === "DENIED" ? (
        <div className="cov-copy-recovery">
          <p role="alert">Clipboard access was denied. Select and copy the evidence below.</p>
          <label>
            <span className="cov-sr-only">Manual Phantom Witness copy text</span>
            <textarea readOnly value={plainText} onFocus={(event) => event.currentTarget.select()} />
          </label>
        </div>
      ) : null}
    </section>
  );
}

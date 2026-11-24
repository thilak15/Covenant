import {
  applyChalicePatch,
  BrowserDeterministicSolver,
  CertificationSeal,
  ChaliceResolutionPanel,
  InquisitorLanternBar,
  openPBTStatsSnapshot,
  parseCovenantJson,
  parseOffline,
  PhantomWitnessStand,
  SplitScrollInspector,
  stringifyCovenant,
  TribunalTheme,
  VerificationDrawer,
  verifyCovenant,
} from "@covenant/core";
import type {
  ChalicePatch,
  Finding,
  FindingSelection,
  Inquisitor,
  InspectorSourceState,
  NonEmpty,
  ParseDiagnostic,
  PrimaryWorkflow,
  ResolutionPayload,
  SourceDocument,
  VariableAssignment,
  VariableDeclaration,
  VerificationReport,
} from "@covenant/core";
import { useEffect, useLayoutEffect, useMemo, useReducer, useRef, useState } from "react";
import type { ReactElement } from "react";
import { legalRedline, negotiationSummary } from "./exports.js";
import {
  applyPreparedSamplePatch,
  CLAUSE_EXORCIST_SAMPLES,
  prepareSample,
} from "./samples.js";
import type { CursedSampleScroll } from "./samples.js";
import { appReducer, initialState } from "./state.js";

function sampleById(id: string): CursedSampleScroll {
  const sample = CLAUSE_EXORCIST_SAMPLES.find((candidate) => candidate.id === id);
  if (sample === undefined) throw new TypeError(`Unknown sample ${id}`);
  return sample;
}

function selectedFinding(
  report: VerificationReport | null,
  selection: FindingSelection | null,
): Finding<Inquisitor> | null {
  if (report === null || selection === null) return null;
  const verdict = report.verdicts.find((candidate) => candidate.inquisitor === selection.inquisitor);
  if (verdict?.status !== "FAIL") return null;
  return (verdict.findings.find((finding) => finding.id === selection.findingId) as Finding<Inquisitor> | undefined) ?? null;
}

function patchFromResolution(resolution: ResolutionPayload, patchId: string): ChalicePatch | null {
  if (resolution.kind === "manual") return null;
  if (resolution.kind === "single") return resolution.patch.id === patchId ? resolution.patch : null;
  return resolution.patches.find((patch) => patch.id === patchId) ?? null;
}

function scalarText(assignment: VariableAssignment): string {
  const value = assignment.value;
  switch (value.kind) {
    case "BOOLEAN": return value.value ? "true" : "false";
    case "ENUM": return value.value;
    case "INTEGER": return value.value.toString(10);
    case "DECIMAL": return `${value.value.numerator.toString(10)}/${value.value.denominator.toString(10)}`;
  }
}

function EvidenceLedger({ finding }: { readonly finding: Finding<Inquisitor> }): ReactElement | null {
  const evidence = finding.evidence;
  if (evidence.kind !== "SECURITY_LIVENESS") return null;
  const identity = evidence.category === "SECURITY"
    ? `Control ${evidence.controlId}`
    : `Workflow ${evidence.workflowId}`;
  return (
    <section className="app-evidence-ledger" aria-labelledby="active-evidence-heading">
      <div>
        <h2 id="active-evidence-heading">Formal evidence ledger</h2>
        <p>{identity}. Governed by {evidence.ruleIds.join(", ") || "the declared operation"}.</p>
      </div>
      <dl>
        {evidence.assignments.map((assignment) => (
          <div key={assignment.variable}>
            <dt>{assignment.variable}</dt>
            <dd>{scalarText(assignment)}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function asNonEmptyDiagnostics(diagnostics: readonly ParseDiagnostic[]): NonEmpty<ParseDiagnostic> {
  const [first, ...rest] = diagnostics;
  return first === undefined
    ? [{ code: "PARSER_REJECTED", severity: "ERROR", message: "The offline parser rejected this source.", location: null }]
    : [first, ...rest];
}

interface ParserSchema {
  readonly declaredVariables: readonly VariableDeclaration[];
  readonly primaryWorkflows: readonly PrimaryWorkflow[];
}

function schemaFor(sample: CursedSampleScroll): string {
  return stringifyCovenant({
    declaredVariables: sample.document.variables,
    primaryWorkflows: sample.document.primaryWorkflows,
  });
}

function parserSchema(text: string): ParserSchema | null {
  let parsed: unknown;
  try {
    parsed = parseCovenantJson(text);
  } catch {
    return null;
  }
  if (typeof parsed !== "object" || parsed === null) return null;
  const record = parsed as Readonly<Record<string, unknown>>;
  if (!Array.isArray(record["declaredVariables"]) || !Array.isArray(record["primaryWorkflows"])) return null;
  return {
    declaredVariables: record["declaredVariables"] as readonly VariableDeclaration[],
    primaryWorkflows: record["primaryWorkflows"] as readonly PrimaryWorkflow[],
  };
}

export function App(): ReactElement {
  const firstSample = CLAUSE_EXORCIST_SAMPLES[0];
  if (firstSample === undefined) throw new TypeError("Clause Exorcist requires at least one sample");
  const solver = useMemo(() => new BrowserDeterministicSolver(), []);
  const [state, dispatch] = useReducer(
    appReducer,
    initialState(firstSample.id, firstSample.document.source, schemaFor(firstSample)),
  );
  const operationSequence = useRef(0);
  const editRevision = useRef(0);
  const [sourceEditable, setSourceEditable] = useState(false);
  const activeSample = sampleById(state.sampleId);

  useLayoutEffect(() => {
    for (const item of globalThis.document.querySelectorAll<HTMLElement>(".cov-inquisitor-tabs__item")) item.setAttribute("role", "presentation");
    for (const control of globalThis.document.querySelectorAll<HTMLElement>(
      ".cov-source-gutter button[aria-label], .cov-finding-list button[aria-label], .cov-copy-evidence[aria-label], .cov-verification-drawer__trigger[aria-label]",
    )) control.removeAttribute("aria-label");
  }, [state.report, state.selection, state.drawerOpen, state.applyState]);

  useEffect(() => {
    const sequence = operationSequence.current + 1;
    operationSequence.current = sequence;
    let active = true;
    void prepareSample(activeSample, solver).then((prepared) => {
      if (active && operationSequence.current === sequence) dispatch({ type: "SAMPLE_READY", prepared });
    }).catch((error: unknown) => {
      if (active && operationSequence.current === sequence) {
        dispatch({ type: "OPERATION_FAILED", message: error instanceof Error ? error.message : "Sample verification failed." });
      }
    });
    return () => { active = false; };
  }, [activeSample, solver]);

  const activeFinding = selectedFinding(state.report, state.selection);
  const resolutionFinding = state.resolutionFinding ?? activeFinding;
  const document = state.document;
  const report = state.report;
  const redline = state.exportContext === null ? null : legalRedline(
    state.exportContext.before,
    state.exportContext.edits,
    state.exportContext.slot,
    state.exportContext.strategy,
  );
  const summary = state.exportContext === null ? null : negotiationSummary(state.exportContext);

  function chooseSample(sample: CursedSampleScroll): void {
    if (sample.id === state.sampleId) return;
    operationSequence.current += 1;
    setSourceEditable(false);
    dispatch({ type: "LOAD_SAMPLE", sampleId: sample.id, source: sample.document.source, schemaText: schemaFor(sample) });
  }

  function changeSource(text: string, schemaText = state.schemaText): void {
    const sequence = operationSequence.current + 1;
    operationSequence.current = sequence;
    const current = document?.source ?? state.rejectedSource ?? activeSample.document.source;
    editRevision.current += 1;
    const source: SourceDocument = {
      ...current,
      id: `${activeSample.document.source.id}.edited`,
      revision: `${activeSample.document.source.revision}:edit-${editRevision.current}`,
      text,
    };
    dispatch({ type: "VERIFY_SOURCE", source });
    const schema = parserSchema(schemaText);
    if (schema === null) {
      dispatch({
        type: "SOURCE_REJECTED",
        source,
        diagnostics: [{ code: "INVALID_SCHEMA", severity: "ERROR", message: "Parser declarations must be valid COVENANT JSON arrays.", location: null }],
      });
      return;
    }
    const parsed = parseOffline({
      source,
      declaredVariables: schema.declaredVariables,
      primaryWorkflows: schema.primaryWorkflows,
    });
    if (parsed.status === "REJECTED") {
      dispatch({ type: "SOURCE_REJECTED", source, diagnostics: parsed.diagnostics });
      return;
    }
    void verifyCovenant(parsed.document, solver).then((nextReport) => {
      if (operationSequence.current === sequence) {
        dispatch({ type: "SOURCE_READY", document: parsed.document, report: nextReport, diagnostics: parsed.diagnostics });
      }
    }).catch((error: unknown) => {
      if (operationSequence.current === sequence) {
        dispatch({ type: "OPERATION_FAILED", message: error instanceof Error ? error.message : "Offline verification failed." });
      }
    });
  }

  function changeSchema(schemaText: string): void {
    dispatch({ type: "SET_SCHEMA", schemaText });
    const currentText = document?.source.text ?? state.rejectedSource?.text ?? activeSample.document.source.text;
    changeSource(currentText, schemaText);
  }

  async function copyEvidence(text: string): Promise<"COPIED" | "DENIED"> {
    try {
      await navigator.clipboard.writeText(text);
      dispatch({ type: "COPY_STATUS", status: "COPIED" });
      return "COPIED";
    } catch {
      dispatch({ type: "COPY_STATUS", status: "DENIED" });
      return "DENIED";
    }
  }

  async function applyPatch(patchId: string): Promise<void> {
    if (document === null || resolutionFinding === null) return;
    const patch = patchFromResolution(resolutionFinding.resolution, patchId);
    if (patch === null) return;
    dispatch({ type: "APPLY_PATCH", patchId });
    const preparedPatch = patch.slot !== null && state.preparedSample?.patches.some((candidate) => candidate.id === patchId) === true
      ? state.preparedSample
      : null;
    if (preparedPatch !== null) {
      const result = await applyPreparedSamplePatch(preparedPatch, patchId, solver);
      if (result.status === "REJECTED") {
        dispatch({ type: "PATCH_REJECTED", patchId, reason: result.reason });
        return;
      }
      dispatch({
        type: "PATCH_APPLIED",
        patchId,
        before: document,
        findingId: resolutionFinding.id,
        document: result.document,
        report: result.report,
        proof: result.proof,
        strategy: result.patch.strategy,
        plainEnglish: result.plainEnglish,
        slot: result.patch.slot,
        edits: result.patch.edits,
        sampleTitle: activeSample.title,
        prepared: result.prepared,
      });
      return;
    }
    const result = await applyChalicePatch(document, patch, solver);
    if (result.status === "REJECTED") {
      dispatch({ type: "PATCH_REJECTED", patchId, reason: result.reason });
      return;
    }
    dispatch({
      type: "PATCH_APPLIED",
      patchId,
      before: document,
      findingId: resolutionFinding.id,
      document: result.document,
      report: result.report,
      proof: result.proof,
      strategy: patch.strategy,
      plainEnglish: patch.strategy,
      slot: patch.slot,
      edits: patch.edits,
      sampleTitle: activeSample.title,
      prepared: null,
    });
  }

  let sourceState: InspectorSourceState | null = null;
  if (document !== null && report !== null) {
    sourceState = { status: "VERIFIED", document, report, diagnostics: state.diagnostics };
  } else if (state.rejectedSource !== null && state.diagnostics.length > 0) {
    sourceState = { status: "REJECTED", source: state.rejectedSource, diagnostics: asNonEmptyDiagnostics(state.diagnostics) };
  }

  return (
    <TribunalTheme skin="clause-exorcist">
      <a className="app-skip-link" href="#tribunal-workspace">Skip to Tribunal workspace</a>
      <div className="app-shell">
        <header className="app-masthead">
          <div className="app-wordmark" aria-label="COVENANT Clause Exorcist">
            <span aria-hidden="true">C</span>
            <strong>COVENANT</strong>
          </div>
          <div className="app-masthead__copy">
            <h1>Clause Exorcist</h1>
            <p>A candlelit reading room for liability, assignment, and service-level contradictions. Entirely offline.</p>
          </div>
          <div className="app-offline-ledger">
            <span>Chancery docket</span>
            <strong>No network required</strong>
          </div>
        </header>

        <section className="app-scroll-selector" aria-labelledby="scroll-selector-title">
          <div className="app-scroll-selector__intro">
            <h2 id="scroll-selector-title">Cursed Legal Scrolls</h2>
            <p>Open a pre-verified clause folio. Marginal references stay beside the text.</p>
            <div className="app-verify-state" data-phase={state.phase} role="status">
              <span className="app-wax-rule" aria-hidden="true" />
              <strong>{state.phase === "READY" ? "Verification resolved" : state.phase === "REJECTED" ? "Parser rejected" : state.phase === "FAILED" ? "Verification failed" : "Verification in progress"}</strong>
            </div>
          </div>
          <div className="app-scroll-selector__options">
            {CLAUSE_EXORCIST_SAMPLES.map((sample) => (
              <button
                key={sample.id}
                type="button"
                aria-pressed={state.sampleId === sample.id}
                onClick={() => chooseSample(sample)}
              >
                <strong>{sample.title}</strong>
                <span>{sample.summary}</span>
              </button>
            ))}
          </div>
        </section>

        {state.failure === null ? null : <p className="app-operation-error" role="alert">{state.failure}</p>}

        {report === null ? (
          state.phase === "REJECTED" ? null : (
            <section className="app-loading" aria-label="Verification loading" aria-busy="true">
              <h2>Reading the folio against the Browser Deterministic Solver</h2>
              <p>The clauses stay on this desk. Resolving all five Inquisitors…</p>
            </section>
          )
        ) : (
          <InquisitorLanternBar
            verdicts={report.verdicts}
            selected={state.filter}
            onSelect={(filter) => dispatch({ type: "SET_FILTER", filter })}
            verifying={state.phase === "VERIFYING" || state.phase === "LOADING"}
            findingsPanelId="tribunal-workspace"
          />
        )}

        <main id="tribunal-workspace" tabIndex={-1}>
          {sourceState === null ? null : (
            <SplitScrollInspector
              sourceState={sourceState}
              visibleInquisitor={state.filter}
              selection={state.selection}
              focusedRuleId={state.focusedRuleId}
              editable={sourceEditable}
              onEditableChange={setSourceEditable}
              onSourceChange={changeSource}
              onSelectFinding={(selection) => dispatch({ type: "SELECT_FINDING", selection })}
              onClearFinding={() => dispatch({ type: "SELECT_FINDING", selection: null })}
              onVisibleInquisitorChange={(filter) => dispatch({ type: "SET_FILTER", filter })}
              onFocusRule={(ruleId) => dispatch({ type: "FOCUS_RULE", ruleId })}
            />
          )}

          <details className="app-parser-schema">
            <summary>Offline clause declarations</summary>
            <p>For a pasted clause, declare the Party enum, the other Boolean, enum, and numeric variables, and any primary workflows as COVENANT JSON.</p>
            <label>
              <span>Variable and workflow declarations</span>
              <textarea
                aria-label="Offline parser declarations JSON"
                spellCheck="false"
                value={state.schemaText}
                onChange={(event) => changeSchema(event.currentTarget.value)}
              />
            </label>
          </details>

          {activeFinding?.evidence.kind === "CONSISTENCY" ? (
            <PhantomWitnessStand
              witness={activeFinding.evidence.witness}
              copyStatus={state.copyStatus}
              onCopy={copyEvidence}
            />
          ) : null}
          {activeFinding === null ? null : <EvidenceLedger finding={activeFinding} />}

          {resolutionFinding === null ? (
            <section className="app-evidence-prompt">
              <h2>Select a finding to inspect its Resolution Payload</h2>
              <p>The proof verdict remains on the docket whether repair synthesis yields a pair, one safe patch, or manual guidance.</p>
            </section>
          ) : (
            <ChaliceResolutionPanel
              verdict="FAIL"
              resolution={resolutionFinding.resolution}
              applyState={state.applyState}
              onReview={(patchId) => dispatch({ type: "REVIEW_PATCH", patchId, finding: resolutionFinding })}
              onCancelReview={() => dispatch({ type: "CANCEL_PATCH" })}
              onApply={(patchId) => { void applyPatch(patchId); }}
            />
          )}

          {state.targetFindingCleared ? (
            <p className="app-target-cleared" role="status"><strong>Target finding cleared.</strong> Re-verification preserved every clause outside the Repair Core.</p>
          ) : null}

          {report === null ? null : <CertificationSeal report={report} />}

          <section className="app-export-bench" aria-labelledby="export-heading">
            <div>
              <h2 id="export-heading">Export the protective redline</h2>
              <p>Both papers are drawn in this browser from the verified Chalice you applied. Nothing is sent to a server.</p>
            </div>
            <div className="app-export-actions">
              {redline === null ? <p>Apply a verified Chalice to export the redline and negotiation summary.</p> : (
                <a href={redline.href} download={redline.filename}>Download protective Legal Redline</a>
              )}
              {summary === null ? null : (
                <a href={summary.href} download={summary.filename}>Download plain-English negotiation summary</a>
              )}
            </div>
          </section>
        </main>

        {report === null ? null : (
          <VerificationDrawer
            telemetry={report.telemetry}
            pbt={{ status: "VALID", snapshot: openPBTStatsSnapshot }}
            open={state.drawerOpen}
            onOpenChange={(open) => dispatch({ type: "SET_DRAWER", open })}
          />
        )}
      </div>
    </TribunalTheme>
  );
}

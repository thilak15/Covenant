import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import {
  SplitScrollInspector,
  type CovenantDocument,
  type FindingSelection,
  type InspectorSourceState,
  type ParseDiagnostic,
  type Rule,
  type SourceChangeMarker,
  type SourceDocument,
  type SourceLocation,
  type VerificationReport,
} from "../../src/index.js";
import { setReducedMotion } from "../setup-react.js";

const SOURCE_TEXT = [
  'R-01: WHEN role = "CONTRACTOR", THE SYSTEM SHALL access',
  "Editorial note outside every formal rule.",
  "R-02: WHEN emergencyOverride, THE SYSTEM SHALL NOT access",
  "R-03: THE SYSTEM SHALL audit",
].join("\n");

function locationIn(sourceText: string, ruleId: string): SourceLocation {
  const text = sourceText.split("\n").find((line) => line.startsWith(ruleId));
  if (text === undefined) throw new Error(`Missing fixture rule ${ruleId}`);
  const offset = sourceText.indexOf(text);
  const line = sourceText.slice(0, offset).split("\n").length;
  return {
    documentId: "scroll-linkage",
    clauseRef: ruleId,
    start: { offset, line, column: 1 },
    end: { offset: offset + text.length, line, column: text.length + 1 },
  };
}

const LOCATIONS = {
  "R-01": locationIn(SOURCE_TEXT, "R-01"),
  "R-02": locationIn(SOURCE_TEXT, "R-02"),
  "R-03": locationIn(SOURCE_TEXT, "R-03"),
} as const;

function rule(id: keyof typeof LOCATIONS, sourceText = SOURCE_TEXT): Rule {
  return {
    id,
    source: locationIn(sourceText, id),
    scope: { actors: [], resources: [], actions: [], context: { kind: "TRUE" } },
    activation: { kind: "TRUE" },
    modality: id === "R-02" ? "MUST_NOT" : "MUST",
    consequence: { kind: "BOOLEAN", variable: id === "R-03" ? "audit" : "access", equals: true },
  };
}

function document(revision = "revision-1", text = SOURCE_TEXT): CovenantDocument {
  return {
    source: { id: "scroll-linkage", revision, format: "EARS", text },
    variables: [
      { kind: "ENUM", name: "role", values: ["CONTRACTOR", "ADMIN"] },
      { kind: "BOOLEAN", name: "emergencyOverride" },
      { kind: "BOOLEAN", name: "access" },
      { kind: "BOOLEAN", name: "audit" },
    ],
    rules: (["R-01", "R-02", "R-03"] as const).filter((id) => text.includes(`${id}:`)).map((id) => rule(id, text)),
    primaryWorkflows: [],
    unsupportedConstructs: [],
  };
}

function report(revision = "revision-1"): VerificationReport {
  const core = {
    queryId: "Q-CONSISTENCY-1",
    ruleIds: ["R-01", "R-02"] as const,
    incompatibleConsequences: [
      { ruleId: "R-01", modality: "MUST" as const, consequence: { kind: "BOOLEAN" as const, variable: "access", equals: true } },
      { ruleId: "R-02", modality: "MUST_NOT" as const, consequence: { kind: "BOOLEAN" as const, variable: "access", equals: true } },
    ],
  };
  return {
    documentId: "scroll-linkage",
    revision,
    verdicts: [
      { inquisitor: "TESTABILITY", status: "PASS", findings: [], unresolved: [] },
      {
        inquisitor: "CONSISTENCY",
        status: "FAIL",
        findings: [{
          id: "finding-access",
          patternId: "ACCESS_COLLISION",
          title: "Access is required and prohibited",
          message: "The same request must both receive and lose access.",
          evidence: {
            kind: "CONSISTENCY",
            core,
            witness: {
              queryId: core.queryId,
              coreRuleIds: core.ruleIds,
              assignments: [
                { variable: "role", value: { kind: "ENUM", value: "CONTRACTOR" } },
                { variable: "emergencyOverride", value: { kind: "BOOLEAN", value: true } },
              ],
              triggeredConsequences: core.incompatibleConsequences as [
                (typeof core.incompatibleConsequences)[number],
                ...(typeof core.incompatibleConsequences)[number][],
              ],
            },
          },
          support: "CUSTOM",
          resolution: { kind: "manual", reason: "Review source intent." },
        }],
        unresolved: [],
      },
      { inquisitor: "COMPLETENESS", status: "PASS", findings: [], unresolved: [] },
      { inquisitor: "UNAMBIGUITY", status: "PASS", findings: [], unresolved: [] },
      { inquisitor: "SECURITY_LIVENESS", status: "PASS", findings: [], unresolved: [] },
    ],
    telemetry: [],
    certifiable: false,
  };
}

const diagnostic: ParseDiagnostic = {
  code: "SOURCE_NOTE",
  severity: "WARNING",
  message: "Editorial note is outside the formal rules.",
  location: {
    documentId: "scroll-linkage",
    clauseRef: "note",
    start: { offset: SOURCE_TEXT.indexOf("Editorial"), line: 2, column: 1 },
    end: { offset: SOURCE_TEXT.indexOf("Editorial") + 14, line: 2, column: 15 },
  },
};

function verifiedState(revision = "revision-1", text = SOURCE_TEXT): InspectorSourceState {
  return { status: "VERIFIED", document: document(revision, text), report: report(revision), diagnostics: [diagnostic] };
}

const changes: readonly SourceChangeMarker[] = [
  { ruleId: "R-01", kind: "REPLACEMENT" },
  { ruleId: "R-02", kind: "REMOVAL" },
  { ruleId: "R-03", kind: "ADDITION" },
];

function fixturePointerEvent(type: string, pointerId: number, clientX: number): Event {
  const event = new Event(type, { bubbles: true, cancelable: true });
  Object.defineProperties(event, {
    pointerId: { value: pointerId },
    clientX: { value: clientX },
  });
  return event;
}

function InspectorHarness({ sourceState = verifiedState(), editable = false }: {
  readonly sourceState?: InspectorSourceState;
  readonly editable?: boolean;
}) {
  const [selection, setSelection] = useState<FindingSelection | null>(null);
  const [focusedRuleId, setFocusedRuleId] = useState<string | null>(null);
  return (
    <SplitScrollInspector
      sourceState={sourceState}
      visibleInquisitor="CONSISTENCY"
      selection={selection}
      focusedRuleId={focusedRuleId}
      editable={editable}
      changeMarkers={changes}
      onSourceChange={vi.fn()}
      onSelectFinding={setSelection}
      onClearFinding={() => setSelection(null)}
      onVisibleInquisitorChange={vi.fn()}
      onFocusRule={setFocusedRuleId}
    />
  );
}

describe("SplitScrollInspector source/evidence linkage", () => {
  it("slices clauses from SourceLocation and highlights only the selected Consistency Unsat Core", () => {
    render(<InspectorHarness />);

    expect(screen.getByText(/Editorial note is outside the formal rules\./u)).toBeVisible();
    expect(screen.getByText("Line 1")).toBeVisible();
    expect(screen.getByText("Line 3")).toBeVisible();
    expect(screen.getByText("Line 4")).toBeVisible();
    expect(screen.queryByText("Line 2")).not.toBeInTheDocument();

    const ruleOne = screen.getByTestId("source-rule-R-01");
    const ruleTwo = screen.getByTestId("source-rule-R-02");
    const ruleThree = screen.getByTestId("source-rule-R-03");
    expect(within(ruleOne).getByTestId("clause-source")).toHaveTextContent(
      'R-01: WHEN role = "CONTRACTOR", THE SYSTEM SHALL access',
    );
    expect(within(ruleTwo).getByTestId("clause-source")).toHaveTextContent(
      "R-02: WHEN emergencyOverride, THE SYSTEM SHALL NOT access",
    );
    expect(ruleOne).toHaveAttribute("data-core-member", "false");

    fireEvent.click(screen.getByRole("button", { name: "Select finding: Access is required and prohibited" }));
    expect(screen.getByRole("button", { name: "Select finding: Access is required and prohibited" })).toHaveAttribute("aria-pressed", "true");
    expect(ruleOne).toHaveAttribute("data-core-member", "true");
    expect(ruleTwo).toHaveAttribute("data-core-member", "true");
    expect(ruleThree).toHaveAttribute("data-core-member", "false");
    expect(within(ruleOne).getByText("Unsat Core member")).toBeVisible();
    expect(within(ruleThree).queryByText("Unsat Core member")).not.toBeInTheDocument();
  });

  it("links evidence and clauses bidirectionally without stealing focus", () => {
    render(<InspectorHarness />);
    fireEvent.click(screen.getByRole("button", { name: "Select finding: Access is required and prohibited" }));

    const ruleOne = screen.getByTestId("source-rule-R-01");
    const evidenceLink = screen.getByRole("link", { name: "View source rule R-01" });
    expect(evidenceLink).toHaveAttribute("href", `#${ruleOne.id}`);
    evidenceLink.focus();
    fireEvent.focus(evidenceLink);
    expect(evidenceLink).toHaveFocus();
    expect(ruleOne).toHaveAttribute("data-linked", "true");

    fireEvent.mouseLeave(evidenceLink);
    expect(evidenceLink).toHaveFocus();
    expect(ruleOne).toHaveAttribute("data-linked", "true");
    fireEvent.blur(evidenceLink);
    expect(ruleOne).toHaveAttribute("data-linked", "false");

    evidenceLink.focus();
    fireEvent.click(evidenceLink);
    expect(evidenceLink).toHaveFocus();

    const clauseControl = within(ruleOne).getByRole("button", { name: "Reveal evidence for rule R-01" });
    clauseControl.focus();
    fireEvent.click(clauseControl);
    expect(clauseControl).toHaveFocus();
    expect(screen.getByTestId("finding-finding-access")).toHaveAttribute("data-selected", "true");
  });

  it("reveals out-of-filter findings and provides accessible empty-filter recovery", () => {
    const onSelectFinding = vi.fn<(selection: FindingSelection) => void>();
    const onClearFinding = vi.fn<() => void>();
    const onVisibleInquisitorChange = vi.fn<(inquisitor: "ALL" | FindingSelection["inquisitor"]) => void>();
    const { rerender } = render(
      <SplitScrollInspector
        sourceState={verifiedState()}
        visibleInquisitor="TESTABILITY"
        selection={null}
        focusedRuleId={null}
        editable={false}
        onSelectFinding={onSelectFinding}
        onClearFinding={onClearFinding}
        onVisibleInquisitorChange={onVisibleInquisitorChange}
        onFocusRule={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Reveal evidence for rule R-01" }));
    expect(onSelectFinding).toHaveBeenCalledWith({ inquisitor: "CONSISTENCY", findingId: "finding-access" });
    expect(onVisibleInquisitorChange).toHaveBeenCalledWith("CONSISTENCY");
    fireEvent.click(screen.getByRole("button", { name: "Show all findings" }));
    expect(onVisibleInquisitorChange).toHaveBeenLastCalledWith("ALL");

    rerender(
      <SplitScrollInspector
        sourceState={verifiedState()}
        visibleInquisitor="TESTABILITY"
        selection={{ inquisitor: "CONSISTENCY", findingId: "finding-access" }}
        focusedRuleId={null}
        editable={false}
        onSelectFinding={onSelectFinding}
        onClearFinding={onClearFinding}
        onVisibleInquisitorChange={onVisibleInquisitorChange}
        onFocusRule={vi.fn()}
      />,
    );
    expect(onClearFinding).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("heading", { name: "Finding evidence" })).toHaveFocus();
  });

  it("uses visible non-color source-change markers", () => {
    render(<InspectorHarness />);
    expect(screen.getByText("Replaced", { selector: "[data-change-kind='REPLACEMENT']" })).toBeVisible();
    expect(screen.getByText("Removed", { selector: "[data-change-kind='REMOVAL']" })).toBeVisible();
    expect(screen.getByText("Added", { selector: "[data-change-kind='ADDITION']" })).toBeVisible();
  });

  it("retains controlled filter and finding selection across re-verification", () => {
    const { rerender } = render(<InspectorHarness sourceState={verifiedState()} />);
    fireEvent.click(screen.getByRole("button", { name: "Select finding: Access is required and prohibited" }));
    expect(screen.getByTestId("finding-finding-access")).toHaveAttribute("data-selected", "true");

    rerender(<InspectorHarness sourceState={verifiedState("revision-2")} />);
    expect(screen.getByTestId("active-filter")).toHaveTextContent("Consistency findings");
    expect(screen.getByTestId("finding-finding-access")).toHaveAttribute("data-selected", "true");
    expect(screen.getByTestId("source-rule-R-01")).toHaveAttribute("data-core-member", "true");
  });

  it("bounds keyboard resizing from 30 to 70 percent and resets to the 58 percent default", () => {
    render(<InspectorHarness />);
    const separator = screen.getByRole("separator", { name: "Resize source and evidence panes" });
    expect(separator).toHaveAttribute("aria-valuenow", "58");

    for (let index = 0; index < 10; index += 1) fireEvent.keyDown(separator, { key: "PageUp" });
    expect(separator).toHaveAttribute("aria-valuenow", "70");
    fireEvent.keyDown(separator, { key: "ArrowRight" });
    expect(separator).toHaveAttribute("aria-valuenow", "70");

    for (let index = 0; index < 10; index += 1) fireEvent.keyDown(separator, { key: "PageDown" });
    expect(separator).toHaveAttribute("aria-valuenow", "30");
    fireEvent.keyDown(separator, { key: "ArrowLeft" });
    expect(separator).toHaveAttribute("aria-valuenow", "30");

    fireEvent.click(screen.getByRole("button", { name: "Reset pane sizes" }));
    expect(separator).toHaveAttribute("aria-valuenow", "58");
    fireEvent.keyDown(separator, { key: "End" });
    expect(separator).toHaveAttribute("aria-valuenow", "70");
    fireEvent.keyDown(separator, { key: "Home" });
    expect(separator).toHaveAttribute("aria-valuenow", "58");
  });

  it("supports bounded pointer resizing and restores the pre-drag size on cancellation", () => {
    render(<InspectorHarness />);
    const separator = screen.getByRole("separator", { name: "Resize source and evidence panes" });
    const panes = separator.parentElement?.parentElement;
    if (panes === null || panes === undefined) throw new Error("Missing split panes fixture");
    vi.spyOn(panes, "getBoundingClientRect").mockReturnValue(DOMRect.fromRect({ x: 0, y: 0, width: 1000, height: 600 }));

    fireEvent(separator, fixturePointerEvent("pointerdown", 4, 580));
    fireEvent(separator, fixturePointerEvent("pointermove", 4, 900));
    expect(separator).toHaveAttribute("aria-valuenow", "70");
    fireEvent(separator, fixturePointerEvent("pointercancel", 4, 900));
    expect(separator).toHaveAttribute("aria-valuenow", "58");
  });

  it("keeps editable source beside an immutable gutter and restores the nearest valid caret", () => {
    const onSourceChange = vi.fn<(text: string) => void>();
    const state = verifiedState();
    const { rerender } = render(
      <SplitScrollInspector
        sourceState={state}
        visibleInquisitor="ALL"
        selection={null}
        focusedRuleId={null}
        editable
        onSourceChange={onSourceChange}
        onSelectFinding={vi.fn()}
        onClearFinding={vi.fn()}
        onVisibleInquisitorChange={vi.fn()}
        onFocusRule={vi.fn()}
      />,
    );
    const editor = screen.getByRole("textbox", { name: "Authoritative source text" });
    expect(editor).toHaveValue(SOURCE_TEXT);
    const gutter = screen.getByTestId("source-id-gutter");
    expect(gutter).toHaveTextContent("R-01");
    expect(gutter).toHaveTextContent("R-02");
    expect(gutter.querySelectorAll(":scope > li")).toHaveLength(SOURCE_TEXT.split("\n").length);
    expect(editor.closest(".cov-source-editor")).toContainElement(gutter);

    fireEvent.change(editor, { target: { value: `${SOURCE_TEXT}\nchanged` } });
    expect(onSourceChange).toHaveBeenCalledWith(`${SOURCE_TEXT}\nchanged`);
    const r2SelectionStart = LOCATIONS["R-02"].start.offset + 8;
    const r2SelectionEnd = r2SelectionStart + 5;
    editor.focus();
    (editor as HTMLTextAreaElement).setSelectionRange(r2SelectionStart, r2SelectionEnd, "forward");
    fireEvent.select(editor);

    const shiftedText = `Preface retained after verification.\n${SOURCE_TEXT}`;
    rerender(
      <SplitScrollInspector
        sourceState={verifiedState("revision-2", shiftedText)}
        visibleInquisitor="ALL"
        selection={null}
        focusedRuleId={null}
        editable
        onSourceChange={onSourceChange}
        onSelectFinding={vi.fn()}
        onClearFinding={vi.fn()}
        onVisibleInquisitorChange={vi.fn()}
        onFocusRule={vi.fn()}
      />,
    );
    const revisedEditor = screen.getByRole("textbox", { name: "Authoritative source text" }) as HTMLTextAreaElement;
    const shiftedR2 = locationIn(shiftedText, "R-02");
    expect(revisedEditor).toHaveFocus();
    expect(revisedEditor.selectionStart).toBe(shiftedR2.start.offset + 8);
    expect(revisedEditor.selectionEnd).toBe(shiftedR2.start.offset + 13);

    const shiftedR3 = locationIn(shiftedText, "R-03");
    revisedEditor.setSelectionRange(shiftedR3.start.offset + 4, shiftedR3.start.offset + 4);
    fireEvent.select(revisedEditor);
    const withoutR3 = shiftedText.slice(0, shiftedR3.start.offset).trimEnd();
    rerender(
      <SplitScrollInspector
        sourceState={verifiedState("revision-3", withoutR3)}
        visibleInquisitor="ALL"
        selection={null}
        focusedRuleId={null}
        editable
        onSourceChange={onSourceChange}
        onSelectFinding={vi.fn()}
        onClearFinding={vi.fn()}
        onVisibleInquisitorChange={vi.fn()}
        onFocusRule={vi.fn()}
      />,
    );
    const fallbackEditor = screen.getByRole("textbox", { name: "Authoritative source text" }) as HTMLTextAreaElement;
    expect(fallbackEditor.selectionStart).toBe(locationIn(withoutR3, "R-02").start.offset);
    expect(fallbackEditor.selectionEnd).toBe(fallbackEditor.selectionStart);
  });

  it("keeps linkage visible without transforms when reduced motion is requested", () => {
    setReducedMotion(true);
    render(<InspectorHarness />);
    const inspector = screen.getByRole("region", { name: "Split Scroll inspector" });
    expect(inspector).toHaveAttribute("data-motion", "reduced");
    expect(screen.getByTestId("source-rule-R-01")).not.toHaveStyle("transform: translateX(3px)");
  });

  it("keeps source first and stacks panes without page-level narrow-screen overflow", () => {
    render(<InspectorHarness />);
    const sourcePane = screen.getByRole("region", { name: "Authoritative source" });
    const evidencePane = screen.getByRole("region", { name: "Finding evidence" });
    expect(sourcePane.compareDocumentPosition(evidencePane) & Node.DOCUMENT_POSITION_FOLLOWING).not.toBe(0);

    const css = readFileSync(join(process.cwd(), "src/tribunal-ui/tribunal.css"), "utf8");
    expect(css).toMatch(/@media \(max-width: 1023px\)[\s\S]*?\.cov-split-scroll__panes\s*\{\s*display: block;/u);
    expect(css).toMatch(/@media \(max-width: 1023px\)[\s\S]*?\.cov-pane-resizer\s*\{\s*display: none;/u);
    expect(css).toMatch(/\.cov-source-pane,[\s\S]*?\.cov-evidence-pane\s*\{\s*min-width: 0;/u);
    expect(css).toMatch(/\.cov-source-clauses code\s*\{[\s\S]*?overflow-wrap: anywhere;/u);
    expect(css).toMatch(/\.cov-source-editor\s*\{[\s\S]*?max-height: 560px;[\s\S]*?overflow: auto;/u);
    expect(css).toMatch(/\.cov-source-editor textarea,[\s\S]*?overflow-x: auto;[\s\S]*?overflow-y: hidden;/u);
    expect(css).toMatch(/@media \(forced-colors: active\)[\s\S]*?\[data-core-member="true"\]/u);
    expect(css).toContain("@media (prefers-reduced-motion: reduce)");
  });

  it("preserves rejected source and source-located diagnostics without fabricating rule links", () => {
    const source: SourceDocument = { id: "rejected", revision: "draft-4", format: "EARS", text: "not formal\nstill authoritative" };
    const rejectedLocation: SourceLocation = {
      documentId: source.id,
      clauseRef: "line-2",
      start: { offset: 11, line: 2, column: 1 },
      end: { offset: 30, line: 2, column: 20 },
    };
    const sourceState: InspectorSourceState = {
      status: "REJECTED",
      source,
      diagnostics: [{ code: "MALFORMED", severity: "ERROR", message: "Unsupported source shape.", location: rejectedLocation }],
    };
    render(
      <SplitScrollInspector
        sourceState={sourceState}
        visibleInquisitor="ALL"
        selection={null}
        focusedRuleId={null}
        editable
        onSourceChange={vi.fn()}
        onSelectFinding={vi.fn()}
        onClearFinding={vi.fn()}
        onVisibleInquisitorChange={vi.fn()}
        onFocusRule={vi.fn()}
      />,
    );
    expect(screen.getByRole("textbox", { name: "Authoritative source text" })).toHaveValue(source.text);
    expect(screen.getByText(/Unsupported source shape\./u)).toHaveTextContent("Line 2");
    expect(screen.queryByTestId(/^source-rule-/u)).not.toBeInTheDocument();
  });
});

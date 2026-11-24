import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  CertificationSeal,
  ChaliceResolutionPanel,
  InquisitorLanternBar,
  SplitScrollInspector,
  TribunalTheme,
  VerificationDrawer,
  type FiveInquisitorVerdicts,
  type InspectorSourceState,
  type OpenPBTSnapshot,
  type VerificationReport,
} from "../../src/index.js";

const passVerdicts: FiveInquisitorVerdicts = [
  { inquisitor: "TESTABILITY", status: "PASS", findings: [], unresolved: [] },
  { inquisitor: "CONSISTENCY", status: "PASS", findings: [], unresolved: [] },
  { inquisitor: "COMPLETENESS", status: "PASS", findings: [], unresolved: [] },
  { inquisitor: "UNAMBIGUITY", status: "PASS", findings: [], unresolved: [] },
  { inquisitor: "SECURITY_LIVENESS", status: "PASS", findings: [], unresolved: [] },
];

const validSnapshot: OpenPBTSnapshot = {
  suiteVersion: "resilience-v1",
  properties: [
    { property: "SOUNDNESS", requestedRuns: 200, successfulRuns: 200, edgeCases: [], duplicateRuns: 0, discardedRuns: 0, seed: 7, durationMs: 10 },
    { property: "PRESERVATION", requestedRuns: 200, successfulRuns: 200, edgeCases: [], duplicateRuns: 0, discardedRuns: 0, seed: 7, durationMs: 11 },
    { property: "SOLVER_EQUIVALENCE", requestedRuns: 200, successfulRuns: 200, edgeCases: [], duplicateRuns: 0, discardedRuns: 0, seed: 7, durationMs: 12 },
  ],
};

function allPassReport(): VerificationReport {
  return {
    documentId: "resilient-scroll",
    revision: "revision-1",
    verdicts: passVerdicts,
    telemetry: [],
    certifiable: true,
  };
}

const verifiedEmpty: InspectorSourceState = {
  status: "VERIFIED",
  document: {
    source: { id: "resilient-scroll", revision: "revision-1", format: "EARS", text: "Editorial source retained while no formal findings match." },
    variables: [],
    rules: [],
    primaryWorkflows: [],
    unsupportedConstructs: [],
  },
  report: allPassReport(),
  diagnostics: [],
};

const rejectedSource: InspectorSourceState = {
  status: "REJECTED",
  source: {
    id: "rejected-scroll",
    revision: "rejected-revision",
    format: "EARS",
    text: "R-BROKEN: source remains visible even though formalization was rejected",
  },
  diagnostics: [{
    code: "MALFORMED_RULE",
    severity: "ERROR",
    message: "The rule does not match the offline grammar.",
    location: null,
  }],
};

function emptyInspector(sourceState: InspectorSourceState, filter: "ALL" | "CONSISTENCY" = "CONSISTENCY") {
  return (
    <SplitScrollInspector
      sourceState={sourceState}
      visibleInquisitor={filter}
      selection={null}
      focusedRuleId={null}
      editable={false}
      onSelectFinding={vi.fn()}
      onClearFinding={vi.fn()}
      onVisibleInquisitorChange={vi.fn()}
      onFocusRule={vi.fn()}
    />
  );
}

describe("Tribunal resilient states", () => {
  it("keeps prior evidence visible and announces named progress while verification runs", () => {
    render(
      <InquisitorLanternBar
        verdicts={passVerdicts}
        selected="ALL"
        onSelect={vi.fn()}
        verifying
      />,
    );

    expect(screen.getAllByText("PASS")).toHaveLength(5);
    expect(screen.getByRole("navigation")).toHaveAttribute("aria-busy", "true");
    expect(screen.getByRole("status")).toHaveTextContent("Verification in progress. Previous results remain visible.");
  });

  it("explains an empty filter, preserves rejected source, and offers recovery where possible", () => {
    const onVisibleInquisitorChange = vi.fn<(filter: "ALL" | "TESTABILITY" | "CONSISTENCY" | "COMPLETENESS" | "UNAMBIGUITY" | "SECURITY_LIVENESS") => void>();
    const { rerender } = render(
      <SplitScrollInspector
        sourceState={verifiedEmpty}
        visibleInquisitor="CONSISTENCY"
        selection={null}
        focusedRuleId={null}
        editable={false}
        onSelectFinding={vi.fn()}
        onClearFinding={vi.fn()}
        onVisibleInquisitorChange={onVisibleInquisitorChange}
        onFocusRule={vi.fn()}
      />,
    );
    expect(screen.getByText("No findings match this filter.")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Show all findings" }));
    expect(onVisibleInquisitorChange).toHaveBeenCalledWith("ALL");

    rerender(emptyInspector(rejectedSource, "ALL"));
    expect(screen.getByText(/source remains visible/iu)).toBeVisible();
    expect(screen.getByText(/MALFORMED_RULE/iu)).toBeVisible();
    expect(screen.queryByRole("list", { name: "Formal source clauses" })).not.toBeInTheDocument();
  });

  it("retains independent state evidence when invalid evidence creates operational UNKNOWN", () => {
    const verdicts: FiveInquisitorVerdicts = [
      passVerdicts[0],
      { inquisitor: "CONSISTENCY", status: "UNKNOWN", findings: [], unresolved: ["INVALID_EVIDENCE"] },
      passVerdicts[2],
      passVerdicts[3],
      { inquisitor: "SECURITY_LIVENESS", status: "UNKNOWN", findings: [], unresolved: ["ADAPTER_FAILURE"] },
    ];
    const report: VerificationReport = {
      ...allPassReport(),
      verdicts,
      certifiable: false,
    };
    render(
      <TribunalTheme skin="spec-inquisitor">
        <InquisitorLanternBar verdicts={verdicts} selected="ALL" onSelect={vi.fn()} verifying={false} />
        <CertificationSeal report={report} />
      </TribunalTheme>,
    );

    expect(screen.getAllByText("PASS")).toHaveLength(3);
    expect(screen.getAllByText("UNKNOWN")).toHaveLength(2);
    expect(screen.getByText(/INVALID_EVIDENCE/iu)).toBeVisible();
    expect(screen.getByText(/ADAPTER_FAILURE/iu)).toBeVisible();
    expect(screen.queryByLabelText(/Formally certified/iu)).not.toBeInTheDocument();
  });

  it("shows invalid PBT recovery without suppressing live telemetry", () => {
    render(
      <VerificationDrawer
        telemetry={[{ solver: "BROWSER_DETERMINISTIC", elapsedMs: 2, clausesChecked: 5 }]}
        pbt={{ status: "INVALID", reason: "Checked-in snapshot failed validation." }}
        open
        onOpenChange={vi.fn()}
      />,
    );
    expect(screen.getByText("2.00 ms")).toBeVisible();
    expect(screen.getByText("5")).toBeVisible();
    expect(screen.getByRole("alert")).toHaveTextContent("Checked-in snapshot failed validation.");
    expect(screen.getByText(/browser did not run property tests/iu)).toBeVisible();
  });

  it("retains overlong repair and telemetry content inside named owning regions", () => {
    const longId = `RULE-${"VERY-LONG-".repeat(20)}END`;
    const longReason = `Manual repair required: ${"authoritative intent remains unresolved ".repeat(20)}`;
    render(
      <TribunalTheme skin="clause-exorcist">
        <ChaliceResolutionPanel
          verdict="FAIL"
          resolution={{ kind: "manual", reason: longReason }}
          applyState={{ status: "IDLE" }}
          onReview={vi.fn()}
          onCancelReview={vi.fn()}
          onApply={vi.fn()}
        />
        <VerificationDrawer
          telemetry={[{ solver: "BROWSER_DETERMINISTIC", elapsedMs: 3, clausesChecked: 9 }]}
          pbt={{
            status: "VALID",
            snapshot: {
              ...validSnapshot,
              properties: [
                { ...validSnapshot.properties[0], edgeCases: [{ tag: longId, count: 1 }] },
                validSnapshot.properties[1],
                validSnapshot.properties[2],
              ],
            },
          }}
          open
          onOpenChange={vi.fn()}
        />
      </TribunalTheme>,
    );

    expect(screen.getByText((_, element) => element?.tagName === "P" && element.textContent === longReason)).toBeVisible();
    expect(screen.getByText(`${longId}: 1`)).toBeVisible();
    expect(screen.getByRole("region", { name: "Cursed Chalice Resolution" })).toHaveClass("cov-chalice-panel");
    expect(screen.getByRole("region", { name: "Verification details" })).toHaveClass("cov-verification-drawer__details");
  });
});

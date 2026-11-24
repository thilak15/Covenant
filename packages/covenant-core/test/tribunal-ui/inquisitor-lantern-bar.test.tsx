import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  InquisitorLanternBar,
  type FiveInquisitorVerdicts,
  type SourceLocation,
} from "../../src/index.js";
import { setReducedMotion } from "../setup-react.js";

const SOURCE: SourceLocation = {
  documentId: "lantern-test",
  clauseRef: "TEST-01",
  start: { offset: 0, line: 1, column: 1 },
  end: { offset: 32, line: 1, column: 33 },
};

const verdicts: FiveInquisitorVerdicts = Object.freeze([
  Object.freeze({
    inquisitor: "TESTABILITY",
    status: "FAIL",
    findings: Object.freeze([
      Object.freeze({
        id: "finding-vague",
        patternId: "VAGUE_LANGUAGE",
        title: "Untestable language",
        message: "The rule lacks a measurable condition.",
        evidence: Object.freeze({ kind: "TESTABILITY", source: SOURCE, terms: Object.freeze(["promptly"] as const) }),
        support: "CUSTOM",
        resolution: Object.freeze({ kind: "manual", reason: "Clarify the condition manually." }),
      }),
    ] as const),
    unresolved: Object.freeze([] as const),
  }),
  Object.freeze({ inquisitor: "CONSISTENCY", status: "PASS", findings: Object.freeze([] as const), unresolved: Object.freeze([] as const) }),
  Object.freeze({ inquisitor: "COMPLETENESS", status: "UNKNOWN", findings: Object.freeze([] as const), unresolved: Object.freeze(["TIMEOUT"] as const) }),
  Object.freeze({ inquisitor: "UNAMBIGUITY", status: "PASS", findings: Object.freeze([] as const), unresolved: Object.freeze([] as const) }),
  Object.freeze({ inquisitor: "SECURITY_LIVENESS", status: "PASS", findings: Object.freeze([] as const), unresolved: Object.freeze([] as const) }),
] as const);

const formalNames = [
  "Testability",
  "Consistency",
  "Completeness",
  "Unambiguity",
  "Security & Liveness",
] as const;

function renderBar(
  onSelect = vi.fn<(inquisitor: "ALL" | FiveInquisitorVerdicts[number]["inquisitor"]) => void>(),
  selected: "ALL" | FiveInquisitorVerdicts[number]["inquisitor"] = "TESTABILITY",
  verifying = false,
) {
  return {
    onSelect,
    ...render(
      <InquisitorLanternBar
        verdicts={verdicts}
        selected={selected}
        onSelect={onSelect}
        verifying={verifying}
      />,
    ),
  };
}

describe("InquisitorLanternBar", () => {
  it("renders the invariant five verdicts in formal order with redundant status evidence", () => {
    renderBar();

    const tablist = screen.getByRole("tablist", { name: "Five Hooded Inquisitors" });
    const tabs = within(tablist).getAllByRole("tab");
    expect(tabs).toHaveLength(5);
    expect(tabs.map((tab) => within(tab).getByTestId("inquisitor-name").textContent)).toEqual(formalNames);
    expect(tabs.map((tab) => within(tab).getByTestId("verdict-word").textContent)).toEqual([
      "FAIL",
      "PASS",
      "UNKNOWN",
      "PASS",
      "PASS",
    ]);
    expect(within(tabs[0]!).getByText("1 finding")).toBeVisible();
    expect(within(tabs[1]!).getByText("0 findings")).toBeVisible();

    for (const [index, tab] of tabs.entries()) {
      const status = verdicts[index]!.status;
      const icon = within(tab).getByTestId(`status-icon-${status}`);
      expect(icon).toHaveAttribute("aria-hidden", "true");
      expect(tab).toHaveAccessibleName(expect.stringContaining(status));
    }
  });

  it("reports controlled filters without mutating the immutable verdict tuple", () => {
    const { onSelect, rerender } = renderBar();
    const frozenVerdicts = verdicts;

    fireEvent.click(screen.getByRole("tab", { name: /Consistency/iu }));
    expect(onSelect).toHaveBeenCalledWith("CONSISTENCY");
    expect(verdicts).toBe(frozenVerdicts);

    rerender(
      <InquisitorLanternBar verdicts={verdicts} selected="CONSISTENCY" onSelect={onSelect} verifying={false} />,
    );
    expect(screen.getByRole("tab", { name: /Consistency/iu })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("button", { name: "Show all findings" })).toHaveAttribute("aria-pressed", "false");

    fireEvent.click(screen.getByRole("button", { name: "Show all findings" }));
    expect(onSelect).toHaveBeenLastCalledWith("ALL");
  });

  it("associates tabs with a caller-owned findings panel only when supplied", () => {
    const unlinked = renderBar();
    for (const tab of screen.getAllByRole("tab")) expect(tab).not.toHaveAttribute("aria-controls");
    unlinked.unmount();

    const onSelect = vi.fn();
    render(
      <div>
        <InquisitorLanternBar
          verdicts={verdicts}
          selected="TESTABILITY"
          onSelect={onSelect}
          verifying={false}
          findingsPanelId="filtered-findings"
        />
        <section id="filtered-findings" role="tabpanel" aria-label="Filtered findings" />
      </div>,
    );

    for (const tab of screen.getAllByRole("tab")) {
      expect(tab).toHaveAttribute("aria-controls", "filtered-findings");
    }
    expect(screen.getByRole("tabpanel", { name: "Filtered findings" })).toBeInTheDocument();
  });

  it("starts verdict choreography only after an active verification settles", () => {
    const onSelect = vi.fn();
    const { rerender } = render(
      <InquisitorLanternBar verdicts={verdicts} selected="ALL" onSelect={onSelect} verifying={false} />,
    );
    const tablist = screen.getByRole("tablist", { name: "Five Hooded Inquisitors" });
    expect(tablist).toHaveAttribute("data-resolving", "false");

    rerender(<InquisitorLanternBar verdicts={verdicts} selected="ALL" onSelect={onSelect} verifying />);
    expect(tablist).toHaveAttribute("data-resolving", "false");

    rerender(<InquisitorLanternBar verdicts={verdicts} selected="ALL" onSelect={onSelect} verifying={false} />);
    expect(tablist).toHaveAttribute("data-resolving", "true");
    expect(tablist.querySelectorAll(".cov-inquisitor-tab__lantern-flare")).toHaveLength(5);
  });

  it("uses manual tab activation for arrows, Home, End, Enter, and Space", () => {
    const { onSelect } = renderBar();
    const tabs = screen.getAllByRole("tab");
    tabs[0]!.focus();

    fireEvent.keyDown(tabs[0]!, { key: "ArrowRight" });
    expect(tabs[1]).toHaveFocus();
    expect(onSelect).not.toHaveBeenCalled();

    fireEvent.keyDown(tabs[1]!, { key: "Enter" });
    expect(onSelect).toHaveBeenLastCalledWith("CONSISTENCY");

    fireEvent.keyDown(tabs[1]!, { key: "End" });
    expect(tabs[4]).toHaveFocus();
    fireEvent.keyDown(tabs[4]!, { key: " " });
    expect(onSelect).toHaveBeenLastCalledWith("SECURITY_LIVENESS");

    fireEvent.keyDown(tabs[4]!, { key: "Home" });
    expect(tabs[0]).toHaveFocus();
    fireEvent.keyDown(tabs[0]!, { key: "ArrowLeft" });
    expect(tabs[4]).toHaveFocus();
  });

  it("publishes one aggregate announcement while keeping prior verdicts visible", () => {
    const { rerender } = renderBar(undefined, "ALL", true);
    const liveRegions = screen.getAllByRole("status");
    expect(liveRegions).toHaveLength(1);
    expect(liveRegions[0]).toHaveTextContent("Verification in progress. Previous results remain visible.");
    expect(screen.getAllByRole("tab")).toHaveLength(5);

    rerender(<InquisitorLanternBar verdicts={verdicts} selected="ALL" onSelect={vi.fn()} verifying={false} />);
    expect(screen.getByRole("status")).toHaveTextContent(
      "Verification complete. 3 PASS, 1 FAIL, 1 UNKNOWN. 1 finding.",
    );
  });

  it("removes stagger and scale choreography when reduced motion is requested", () => {
    setReducedMotion(true);
    renderBar();

    const tablist = screen.getByRole("tablist", { name: "Five Hooded Inquisitors" });
    expect(tablist).toHaveAttribute("data-motion", "reduced");
    for (const tab of within(tablist).getAllByRole("tab")) {
      expect(tab.parentElement).toHaveStyle("--cov-lantern-delay: 0ms");
    }
  });
});

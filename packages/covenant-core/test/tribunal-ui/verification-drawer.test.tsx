import { fireEvent, render, screen, within } from "@testing-library/react";
import { useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  VerificationDrawer,
  formatOpenPBTStats,
  formatVerificationTelemetry,
  verificationDrawerVariants,
  type OpenPBTSnapshot,
  type PbtPresentationState,
  type VerificationTelemetry,
} from "../../src/index.js";
import { setReducedMotion } from "../setup-react.js";

const telemetry: readonly VerificationTelemetry[] = [
  { solver: "NODE_Z3", elapsedMs: 4.5, clausesChecked: 8 },
  { solver: "BROWSER_DETERMINISTIC", elapsedMs: 1.25, clausesChecked: 17 },
];

const snapshot: OpenPBTSnapshot = {
  suiteVersion: "2026.11.24",
  properties: [
    {
      property: "SOUNDNESS",
      requestedRuns: 200,
      successfulRuns: 200,
      edgeCases: [{ tag: "DIRECT_CONSEQUENCE", count: 125 }],
      duplicateRuns: 14,
      discardedRuns: 2,
      seed: 20_261_124,
      durationMs: 1_200,
    },
    {
      property: "PRESERVATION",
      requestedRuns: 240,
      successfulRuns: 240,
      edgeCases: [{ tag: "NON_CONFLICTING_RULE", count: 240 }],
      duplicateRuns: 20,
      discardedRuns: 4,
      seed: 20_261_124,
      durationMs: 1_500,
    },
    {
      property: "SOLVER_EQUIVALENCE",
      requestedRuns: 220,
      successfulRuns: 220,
      edgeCases: [{ tag: "EXACT_DECIMAL", count: 80 }],
      duplicateRuns: 12,
      discardedRuns: 3,
      seed: 20_261_124,
      durationMs: 1_800,
    },
  ],
};

function DrawerHarness({ pbt = { status: "VALID", snapshot } }: { readonly pbt?: PbtPresentationState }) {
  const [open, setOpen] = useState(false);
  return <VerificationDrawer telemetry={telemetry} pbt={pbt} open={open} onOpenChange={setOpen} />;
}

describe("VerificationDrawer", () => {
  beforeEach(() => setReducedMotion(true));

  it("shows a one-line latest-solve ledger while collapsed", () => {
    render(<DrawerHarness />);

    const button = screen.getByRole("button", { name: "Open verification details" });
    expect(button).toHaveAttribute("aria-expanded", "false");
    const ledger = screen.getByTestId("verification-ledger");
    expect(ledger).toHaveTextContent("Browser deterministic");
    expect(ledger).toHaveTextContent("1.25 ms");
    expect(ledger).toHaveTextContent("17");
    expect(ledger).toHaveTextContent("PBT 2026.11.24");
    expect(ledger).not.toHaveTextContent("Node Z3");
    expect(screen.queryByRole("region", { name: "Verification details" })).not.toBeInTheDocument();
  });

  it("separates exact live formatter rows from exact checked-in Node-PBT formatter rows", () => {
    render(<DrawerHarness />);
    fireEvent.click(screen.getByRole("button", { name: "Open verification details" }));

    const region = screen.getByRole("region", { name: "Verification details" });
    const live = within(region).getByRole("group", { name: "Live verification" });
    const pbt = within(region).getByRole("group", { name: "Node property-test snapshot" });
    expect(live).toBeInTheDocument();
    expect(pbt).toBeInTheDocument();

    for (const row of formatVerificationTelemetry(telemetry[1]!)) {
      expect(within(live).getAllByText(row.label).length).toBeGreaterThan(0);
      expect(within(live).getByText(row.value)).toBeInTheDocument();
    }
    for (const property of snapshot.properties) {
      for (const row of formatOpenPBTStats(property)) {
        expect(within(pbt).getAllByText(row.label).length).toBeGreaterThan(0);
        expect(within(pbt).getAllByText(row.value).length).toBeGreaterThan(0);
      }
    }
    expect(within(pbt).getByText(/ran in Node and was not executed in this browser/iu)).toBeInTheDocument();
    expect(within(live).queryByText("Successful runs")).not.toBeInTheDocument();
    expect(within(pbt).queryByText("Solver latency")).not.toBeInTheDocument();
  });

  it("closes on Escape, restores trigger focus, and remains a non-modal disclosure", () => {
    render(<DrawerHarness />);
    const trigger = screen.getByRole("button", { name: "Open verification details" });
    fireEvent.click(trigger);
    const region = screen.getByRole("region", { name: "Verification details" });
    expect(region).not.toHaveAttribute("aria-modal");

    const liveHeading = within(region).getByRole("heading", { name: "Live verification" });
    expect(liveHeading).toHaveFocus();

    const closeTrigger = screen.getByRole("button", { name: "Close verification details" });
    closeTrigger.focus();
    fireEvent.keyDown(closeTrigger, { key: "Escape" });

    expect(screen.queryByRole("region", { name: "Verification details" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Open verification details" })).toHaveFocus();
  });

  it("retains live telemetry and hides PBT values when snapshot presentation is invalid", () => {
    const pbt: PbtPresentationState = {
      status: "INVALID",
      reason: "Snapshot property order failed validation.",
    };
    render(<DrawerHarness pbt={pbt} />);

    expect(screen.getByTestId("verification-ledger")).toHaveTextContent("PBT unavailable");
    fireEvent.click(screen.getByRole("button", { name: "Open verification details" }));
    const live = screen.getByRole("group", { name: "Live verification" });
    expect(within(live).getByText("1.25 ms")).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent(pbt.reason);
    expect(screen.queryByText("Successful runs")).not.toBeInTheDocument();
  });

  it("defines finite height-and-opacity disclosure motion with static reduced-motion endpoints", () => {
    expect(verificationDrawerVariants(false)).toMatchObject({
      closed: { height: 0, opacity: 0 },
      open: { height: "auto", opacity: 1, transition: { duration: 0.24 } },
    });
    expect(verificationDrawerVariants(true)).toEqual({
      closed: { height: 0, opacity: 0, y: 0, transition: { duration: 0 } },
      open: { height: "auto", opacity: 1, y: 0, transition: { duration: 0 } },
    });
  });

  it("reports disclosure intent without owning application state", () => {
    const onOpenChange = vi.fn<(open: boolean) => void>();
    const { rerender } = render(
      <VerificationDrawer telemetry={telemetry} pbt={{ status: "VALID", snapshot }} open={false} onOpenChange={onOpenChange} />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Open verification details" }));
    expect(onOpenChange).toHaveBeenCalledWith(true);

    rerender(<VerificationDrawer telemetry={telemetry} pbt={{ status: "VALID", snapshot }} open onOpenChange={onOpenChange} />);
    fireEvent.click(screen.getByRole("button", { name: "Close verification details" }));
    expect(onOpenChange).toHaveBeenLastCalledWith(false);
  });
});

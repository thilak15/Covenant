import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import {
  PhantomWitnessStand,
  type CopyEvidenceResult,
  type PhantomWitness,
} from "../../src/index.js";

const witness: PhantomWitness = {
  queryId: "Q-RBAC-EXACT",
  coreRuleIds: ["R-01", "R-02"],
  assignments: [
    { variable: "actorRole", value: { kind: "ENUM", value: "CONTRACTOR" } },
    { variable: "emergencyOverride", value: { kind: "BOOLEAN", value: true } },
    { variable: "requestCount", value: { kind: "INTEGER", value: 9007199254740993n } },
    {
      variable: "liabilityAmount",
      value: { kind: "DECIMAL", value: { numerator: 9007199254740993n, denominator: 100n } },
    },
    {
      variable: "ownershipShare",
      value: { kind: "DECIMAL", value: { numerator: 1n, denominator: 3n } },
    },
  ],
  triggeredConsequences: [
    {
      ruleId: "R-01",
      modality: "MUST",
      consequence: { kind: "BOOLEAN", variable: "deployPermitted", equals: true },
    },
    {
      ruleId: "R-02",
      modality: "MUST_NOT",
      consequence: { kind: "BOOLEAN", variable: "deployPermitted", equals: true },
    },
  ],
};

const expectedCopy = [
  "Phantom Witness — Q-RBAC-EXACT",
  'actorRole = "CONTRACTOR"',
  "emergencyOverride = true",
  "requestCount = 9007199254740993",
  "liabilityAmount = 90071992547409.93",
  "ownershipShare = 1/3",
  "Activates: R-01, R-02",
  "Triggered result: R-01 MUST deployPermitted = true; R-02 MUST NOT deployPermitted = true.",
].join("\n");

function CopyHarness({ copy }: { readonly copy: (plainText: string) => Promise<CopyEvidenceResult> }) {
  const [copyStatus, setCopyStatus] = useState<"IDLE" | CopyEvidenceResult>("IDLE");
  return (
    <PhantomWitnessStand
      witness={witness}
      copyStatus={copyStatus}
      onCopy={async (plainText) => {
        const result = await copy(plainText);
        setCopyStatus(result);
        return result;
      }}
    />
  );
}

describe("PhantomWitnessStand", () => {
  it("renders stable canonical assignments in a semantic exact-value table", () => {
    render(<PhantomWitnessStand witness={witness} copyStatus="IDLE" onCopy={vi.fn()} />);

    const table = screen.getByRole("table", { name: "Canonical Phantom Witness assignments" });
    expect(within(table).getAllByRole("columnheader").map((cell) => cell.textContent)).toEqual(["Variable", "Value"]);
    const rows = within(table).getAllByRole("row").slice(1);
    expect(rows.map((row) => within(row).getAllByRole("cell").map((cell) => cell.textContent))).toEqual([
      ["actorRole", '"CONTRACTOR"'],
      ["emergencyOverride", "true"],
      ["requestCount", "9007199254740993"],
      ["liabilityAmount", "90071992547409.93"],
      ["ownershipShare", "1/3"],
    ]);
  });

  it("separates activated core IDs from incompatible triggered consequences", () => {
    render(<PhantomWitnessStand witness={witness} copyStatus="IDLE" onCopy={vi.fn()} />);
    const activated = screen.getByTestId("witness-activated-rules");
    const result = screen.getByTestId("witness-triggered-result");
    expect(activated).toHaveTextContent("Activates: R-01, R-02");
    const sourceLink = within(activated).getByRole("link", { name: "Source rule R-01" });
    expect(sourceLink.getAttribute("href")).toMatch(/^#cov-clause-[a-f0-9-]+$/u);
    expect(result).toHaveTextContent(
      "Triggered result: R-01 MUST deployPermitted = true; R-02 MUST NOT deployPermitted = true.",
    );
    expect(activated.compareDocumentPosition(result) & Node.DOCUMENT_POSITION_FOLLOWING).not.toBe(0);
  });

  it("uses collision-free anchors and accessible heading IDs for arbitrary domain IDs", () => {
    const punctuated: PhantomWitness = {
      ...witness,
      queryId: "query with spaces",
      coreRuleIds: ["R/A", "R?A"],
      triggeredConsequences: [
        { ruleId: "R/A", modality: "MUST", consequence: { kind: "BOOLEAN", variable: "deployPermitted", equals: true } },
        { ruleId: "R?A", modality: "MUST_NOT", consequence: { kind: "BOOLEAN", variable: "deployPermitted", equals: true } },
      ],
    };
    render(<PhantomWitnessStand witness={punctuated} copyStatus="IDLE" onCopy={vi.fn()} />);
    const region = screen.getByRole("region", { name: "Phantom Witness" });
    const links = within(region).getAllByRole("link");
    expect(links[0]?.getAttribute("href")).not.toBe(links[1]?.getAttribute("href"));
    expect(region.getAttribute("aria-labelledby")).not.toMatch(/\s/u);
  });

  it("preserves nested Boolean grouping in visible and copied consequences", async () => {
    const nested: PhantomWitness = {
      ...witness,
      triggeredConsequences: [{
        ruleId: "R-01",
        modality: "MUST",
        consequence: {
          kind: "ALL",
          conditions: [
            {
              kind: "ANY",
              conditions: [
                { kind: "BOOLEAN", variable: "a", equals: true },
                { kind: "BOOLEAN", variable: "b", equals: true },
              ],
            },
            { kind: "BOOLEAN", variable: "c", equals: true },
          ],
        },
      }],
    };
    const copy = vi.fn<(plainText: string) => Promise<CopyEvidenceResult>>().mockResolvedValue("COPIED");
    render(<PhantomWitnessStand witness={nested} copyStatus="IDLE" onCopy={copy} />);
    expect(screen.getByTestId("witness-triggered-result")).toHaveTextContent(
      "R-01 MUST (a = true or b = true) and c = true.",
    );
    fireEvent.click(screen.getByRole("button", { name: "Copy Phantom Witness evidence" }));
    await screen.findByRole("status");
    expect(copy.mock.calls[0]?.[0]).toContain("Triggered result: R-01 MUST (a = true or b = true) and c = true.");
  });

  it("copies deterministic plain-text evidence", async () => {
    const copy = vi.fn<(plainText: string) => Promise<CopyEvidenceResult>>().mockResolvedValue("COPIED");
    render(<CopyHarness copy={copy} />);
    fireEvent.click(screen.getByRole("button", { name: "Copy Phantom Witness evidence" }));

    expect(await screen.findByRole("status")).toHaveTextContent("Phantom Witness evidence copied.");
    expect(copy).toHaveBeenCalledTimes(1);
    expect(copy).toHaveBeenCalledWith(expectedCopy);
  });

  it("exposes exact manual-copy recovery when clipboard access is denied", async () => {
    const copy = vi.fn<(plainText: string) => Promise<CopyEvidenceResult>>().mockResolvedValue("DENIED");
    render(<CopyHarness copy={copy} />);
    fireEvent.click(screen.getByRole("button", { name: "Copy Phantom Witness evidence" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Clipboard access was denied. Select and copy the evidence below.",
    );
    expect(screen.getByRole("textbox", { name: "Manual Phantom Witness copy text" })).toHaveValue(expectedCopy);
    expect(screen.getByRole("button", { name: "Copy Phantom Witness evidence" })).toBeEnabled();
  });

  it("ignores a copy completion from a replaced witness", async () => {
    let resolveCopy: ((result: CopyEvidenceResult) => void) | undefined;
    const copy = vi.fn<(plainText: string) => Promise<CopyEvidenceResult>>().mockImplementation(
      () => new Promise((resolve) => { resolveCopy = resolve; }),
    );
    const { rerender } = render(<PhantomWitnessStand witness={witness} copyStatus="IDLE" onCopy={copy} />);
    fireEvent.click(screen.getByRole("button", { name: "Copy Phantom Witness evidence" }));
    expect(screen.getByRole("button", { name: "Copy Phantom Witness evidence" })).toBeDisabled();

    const replacement = { ...witness, queryId: "Q-NEW-WITNESS" };
    rerender(<PhantomWitnessStand witness={replacement} copyStatus="IDLE" onCopy={copy} />);
    expect(screen.getByRole("button", { name: "Copy Phantom Witness evidence" })).toBeEnabled();
    await act(async () => { resolveCopy?.("COPIED"); });
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(screen.getByText("Concrete assignments that activate every rule in this Unsat Core.")).toBeVisible();
  });

  it("treats a rejected clipboard promise as denial without hiding evidence", async () => {
    const copy = vi.fn<(plainText: string) => Promise<CopyEvidenceResult>>().mockRejectedValue(new Error("denied"));
    render(<PhantomWitnessStand witness={witness} copyStatus="IDLE" onCopy={copy} />);
    fireEvent.click(screen.getByRole("button", { name: "Copy Phantom Witness evidence" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Clipboard access was denied");
    expect(screen.getByRole("table", { name: "Canonical Phantom Witness assignments" })).toBeVisible();
  });
});

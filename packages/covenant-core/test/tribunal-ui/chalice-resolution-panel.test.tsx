import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  ChaliceResolutionPanel,
  patchSourceVariants,
  type ChalicePatch,
  type PatchApplyState,
  type PatchRejectionReason,
  type PreservationProof,
  type ResolutionPayload,
} from "../../src/index.js";

const proof: PreservationProof = {
  conflictFixed: true,
  repairCoreId: "finding-access:repair-core",
  conflictRuleIds: ["R-01", "R-02"],
  preservedRules: [{
    ruleId: "R-03",
    sourceFingerprint: "source-r3",
    semanticFingerprint: "semantic-r3",
  }],
  preservationPercent: 100,
};

function patch(slot: "A" | "B" | null): ChalicePatch {
  const suffix = slot ?? "single";
  return {
    id: `finding-access:chalice:${suffix}`,
    findingId: "finding-access",
    repairCore: {
      id: "finding-access:repair-core",
      findingId: "finding-access",
      ruleIds: ["R-01", "R-02"],
    },
    slot,
    strategy: slot === "B" ? "Narrow the prohibition" : "Guard the permission",
    sourceRevision: "revision-1",
    targetRuleIds: slot === "B" ? ["R-02"] : ["R-01"],
    edits: [{
      ruleId: slot === "B" ? "R-02" : "R-01",
      startOffset: slot === "B" ? 58 : 0,
      endOffset: slot === "B" ? 111 : 57,
      expectedText: slot === "B"
        ? "R-02: THE SYSTEM SHALL NOT permit production access"
        : "R-01: THE SYSTEM SHALL permit production access",
      replacementText: slot === "B"
        ? "R-02: WHEN no emergency override, THE SYSTEM SHALL NOT permit production access"
        : "R-01: WHEN not Sunday, THE SYSTEM SHALL permit production access",
    }],
    resultingSemanticFingerprint: `result-${suffix}`,
    proof,
  };
}

const chaliceA = patch("A") as ChalicePatch & { readonly slot: "A" };
const chaliceB = patch("B") as ChalicePatch & { readonly slot: "B" };
const unpaired = patch(null) as ChalicePatch & { readonly slot: null };
const pair: ResolutionPayload = { kind: "pair", patches: [chaliceA, chaliceB] };

function panel(
  resolution: ResolutionPayload,
  applyState: PatchApplyState,
  onReview = vi.fn<(patchId: string) => void>(),
  onCancelReview = vi.fn<() => void>(),
  onApply = vi.fn<(patchId: string) => void>(),
) {
  return {
    element: (
      <ChaliceResolutionPanel
        verdict="FAIL"
        resolution={resolution}
        applyState={applyState}
        onReview={onReview}
        onCancelReview={onCancelReview}
        onApply={onApply}
      />
    ),
    onReview,
    onCancelReview,
    onApply,
  };
}

describe("ChaliceResolutionPanel", () => {
  it("renders Chalice A before B as peer articles and keeps the proven verdict visible", () => {
    const view = panel(pair, { status: "IDLE" });
    render(view.element);

    expect(screen.getByText("FAIL")).toBeVisible();
    expect(screen.getByText(/repair availability does not change this verdict/iu)).toBeVisible();
    const articles = screen.getAllByRole("article");
    expect(articles).toHaveLength(2);
    expect(articles.map((article) => within(article).getByRole("heading").textContent)).toEqual([
      "Chalice A",
      "Chalice B",
    ]);
    expect(articles[0]).toHaveClass("cov-chalice-option");
    expect(articles[1]).toHaveClass("cov-chalice-option");
    expect(articles[0]).toHaveAttribute("data-chalice-slot", "A");
    expect(articles[1]).toHaveAttribute("data-chalice-slot", "B");

    const first = within(articles[0]!);
    expect(first.getByText("Guard the permission")).toBeVisible();
    expect(first.getByText("R-01")).toBeVisible();
    expect(first.getByText("revision-1")).toBeVisible();
    expect(first.getByText(/conflict fixed/iu)).toBeVisible();
    expect(first.getByText(/1 non-conflicting rule/iu)).toBeVisible();
    expect(first.getByText(/R-01: THE SYSTEM SHALL permit production access/u)).toBeVisible();
    expect(first.getByText(/R-01: WHEN not Sunday/u)).toBeVisible();
    expect(screen.queryByText("100% preserved")).not.toBeInTheDocument();
  });

  it("requires inline guarded review, locks competing actions while applying, and reveals only a returned proof", () => {
    const onReview = vi.fn<(patchId: string) => void>();
    const onCancelReview = vi.fn<() => void>();
    const onApply = vi.fn<(patchId: string) => void>();
    const initial = panel(pair, { status: "IDLE" }, onReview, onCancelReview, onApply);
    const { rerender } = render(initial.element);

    fireEvent.click(screen.getByRole("button", { name: "Review Chalice A" }));
    expect(onReview).toHaveBeenCalledWith(chaliceA.id);
    expect(onApply).not.toHaveBeenCalled();

    rerender(panel(pair, { status: "REVIEWING", patchId: chaliceA.id }, onReview, onCancelReview, onApply).element);
    const review = screen.getByRole("region", { name: "Review Chalice A guarded edits" });
    expect(within(review).getByRole("heading", { name: "Review guarded edits" })).toHaveFocus();
    const reviewedArticle = review.closest("article");
    if (reviewedArticle === null) throw new Error("Review region must remain inside its Chalice article");
    expect(within(reviewedArticle).getByText("Expected source")).toBeVisible();
    expect(within(reviewedArticle).getByText("Replacement source")).toBeVisible();
    fireEvent.click(within(review).getByRole("button", { name: "Apply Chalice A" }));
    expect(onApply).toHaveBeenCalledWith(chaliceA.id);

    rerender(panel(pair, { status: "APPLYING", patchId: chaliceA.id }, onReview, onCancelReview, onApply).element);
    expect(screen.getByRole("status")).toHaveTextContent("Applying Chalice A");
    expect(screen.getByRole("status")).toHaveFocus();
    for (const button of screen.getAllByRole("button")) expect(button).toBeDisabled();
    expect(screen.getByText("FAIL")).toBeVisible();
    expect(screen.queryByText("100% preserved")).not.toBeInTheDocument();

    rerender(panel(pair, { status: "APPLIED", patchId: chaliceA.id, proof }, onReview, onCancelReview, onApply).element);
    expect(screen.getByRole("status")).toHaveTextContent("Chalice A applied");
    expect(screen.getByRole("status")).toHaveFocus();
    expect(screen.getByText("100% preserved")).toBeVisible();
    expect(screen.getByText(/R-03/iu)).toBeVisible();
    expect(screen.getByText("FAIL")).toBeVisible();
  });

  it("returns focus to the selected Chalice action when inline review is cancelled", () => {
    const onCancelReview = vi.fn<() => void>();
    const { rerender } = render(panel(pair, { status: "REVIEWING", patchId: chaliceA.id }, vi.fn(), onCancelReview).element);
    fireEvent.click(screen.getByRole("button", { name: "Cancel review" }));
    expect(onCancelReview).toHaveBeenCalledOnce();

    rerender(panel(pair, { status: "IDLE" }, vi.fn(), onCancelReview).element);
    expect(screen.getByRole("button", { name: "Review Chalice A" })).toHaveFocus();
  });

  it("renders honest single and manual payloads without inventing a second action", () => {
    const single: ResolutionPayload = {
      kind: "single",
      patch: unpaired,
      reason: "A second rewrite would alter an unrelated rule.",
    };
    const { rerender } = render(panel(single, { status: "IDLE" }).element);

    expect(screen.getAllByRole("article")).toHaveLength(1);
    expect(screen.getByRole("heading", { name: "Verified Chalice" })).toBeVisible();
    expect(screen.getByText(single.reason)).toBeVisible();
    expect(screen.getAllByRole("button", { name: /Review/iu })).toHaveLength(1);
    expect(screen.getByText("FAIL")).toBeVisible();

    const manual: ResolutionPayload = {
      kind: "manual",
      reason: "The source intent must be resolved by its author.",
    };
    rerender(panel(manual, { status: "IDLE" }).element);
    expect(screen.getByText(manual.reason)).toBeVisible();
    expect(screen.queryByRole("article")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /apply|review/iu })).not.toBeInTheDocument();
    expect(screen.getByText("FAIL")).toBeVisible();
  });

  it("animates expected source out and replacement source in once, with static reduced-motion states", () => {
    expect(patchSourceVariants(false, "expected")).toMatchObject({
      idle: { opacity: 1, x: 0 },
      reviewing: { opacity: [1, 0.35, 1], x: [0, -4, 0], transition: { duration: 0.26 } },
    });
    expect(patchSourceVariants(false, "replacement")).toMatchObject({
      idle: { opacity: 1, x: 0 },
      reviewing: { opacity: [0.55, 1], x: [4, 0], transition: { duration: 0.26 } },
    });
    expect(patchSourceVariants(true, "replacement")).toEqual({
      idle: { opacity: 1, x: 0 },
      reviewing: { opacity: 1, x: 0, transition: { duration: 0 } },
    });
  });

  it("names every typed rejection, preserves the reviewed source, and restores focus to the rejection heading", () => {
    const reasons: readonly PatchRejectionReason[] = [
      "STALE_REVISION",
      "SOURCE_MISMATCH",
      "EDIT_OUTSIDE_CORE",
      "TARGET_NOT_FIXED",
      "PRESERVATION_FAILED",
      "REVERIFICATION_UNKNOWN",
    ];
    const view = panel(pair, { status: "REVIEWING", patchId: chaliceA.id });
    const { rerender } = render(view.element);
    const expectedSource = chaliceA.edits[0].expectedText;
    const replacementSource = chaliceA.edits[0].replacementText;

    for (const reason of reasons) {
      rerender(panel(pair, { status: "REJECTED", patchId: chaliceA.id, reason }).element);
      const heading = screen.getByRole("heading", { name: "Chalice A was not applied" });
      expect(heading).toHaveFocus();
      expect(screen.getByRole("alert")).toHaveTextContent(reason);
      expect(screen.getByText(expectedSource)).toBeVisible();
      expect(screen.getByText(replacementSource)).toBeVisible();
      expect(screen.getByText("FAIL")).toBeVisible();
      expect(screen.queryByText("100% preserved")).not.toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Review Chalice A again" })).toBeEnabled();
    }
  });
});

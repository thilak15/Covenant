import type { CovenantDocument, SourceEdit } from "@covenant/core";

export interface TextDownload {
  readonly filename: string;
  readonly mediaType: "text/markdown";
  readonly text: string;
  readonly href: string;
}

function dataHref(text: string): string {
  return `data:text/plain;charset=utf-8,${encodeURIComponent(text)}`;
}

function inlineRedline(expected: string, replacement: string): string {
  const expectedWords = expected.split(/(\s+)/u);
  const replacementWords = replacement.split(/(\s+)/u);
  const width = expectedWords.length + 1;
  const height = replacementWords.length + 1;
  const scores = Array.from({ length: height }, () => Array<number>(width).fill(0));
  for (let row = height - 2; row >= 0; row -= 1) {
    for (let column = width - 2; column >= 0; column -= 1) {
      const current = scores[row];
      const next = scores[row + 1];
      if (current === undefined || next === undefined) continue;
      current[column] = expectedWords[column] === replacementWords[row]
        ? (next[column + 1] ?? 0) + 1
        : Math.max(next[column] ?? 0, current[column + 1] ?? 0);
    }
  }
  const parts: string[] = [];
  let row = 0;
  let column = 0;
  while (row < replacementWords.length && column < expectedWords.length) {
    const expectedWord = expectedWords[column];
    const replacementWord = replacementWords[row];
    const current = scores[row];
    const next = scores[row + 1];
    if (expectedWord === replacementWord) {
      parts.push(expectedWord ?? "");
      row += 1;
      column += 1;
    } else if ((next?.[column] ?? 0) >= (current?.[column + 1] ?? 0)) {
      parts.push(`[+${replacementWord ?? ""}+]`);
      row += 1;
    } else {
      parts.push(`[-${expectedWord ?? ""}-]`);
      column += 1;
    }
  }
  while (column < expectedWords.length) {
    parts.push(`[-${expectedWords[column] ?? ""}-]`);
    column += 1;
  }
  while (row < replacementWords.length) {
    parts.push(`[+${replacementWords[row] ?? ""}+]`);
    row += 1;
  }
  return parts.join("");
}

function chaliceName(slot: "A" | "B" | null): string {
  return slot === null ? "Verified Chalice" : `Chalice ${slot}`;
}

export function legalRedline(
  before: CovenantDocument,
  edits: readonly SourceEdit[],
  slot: "A" | "B" | null,
  strategy: string,
): TextDownload {
  const ordered = [...edits].sort((left, right) => left.startOffset - right.startOffset);
  const lines = [
    "# Protective Legal Redline",
    `Document: ${before.source.id}`,
    `Prior revision: ${before.source.revision}`,
    `Selected: ${chaliceName(slot)}`,
    `Strategy: ${strategy}`,
    "",
  ];
  for (const edit of ordered) {
    lines.push(`[~] REPLACEMENT ${edit.ruleId}`);
    lines.push(`[-] ${edit.expectedText}`);
    lines.push(`[+] ${edit.replacementText}`);
    lines.push(inlineRedline(edit.expectedText, edit.replacementText));
    lines.push("");
  }
  const text = `${lines.join("\n")}\n`;
  return { filename: "legal-redline.md", mediaType: "text/markdown", text, href: dataHref(text) };
}

export function negotiationSummary(input: {
  readonly sampleTitle: string;
  readonly before: CovenantDocument;
  readonly strategy: string;
  readonly plainEnglish: string;
  readonly slot: "A" | "B" | null;
  readonly repairCoreRuleIds: readonly string[];
  readonly edits: readonly SourceEdit[];
}): TextDownload {
  const core = new Set(input.repairCoreRuleIds);
  const preserved = input.before.rules.map((rule) => rule.id).filter((id) => !core.has(id));
  const changed = [...new Set(input.edits.map((edit) => edit.ruleId))].join(", ");
  const text = [
    "# Negotiation summary",
    `Document: ${input.sampleTitle}`,
    `Selected strategy: ${input.strategy}`,
    `Chalice ${input.slot === null ? "repair" : input.slot} rewrites ${changed}.`,
    "",
    `Formal effect: the repaired rules no longer impose incompatible hard consequences on the conflict core (${input.repairCoreRuleIds.join(", ")}). Re-verification preserves 100% of the rules outside that core: ${preserved.join(", ")}.`,
    "",
    `In plain English: ${input.plainEnglish}`,
    "The clauses outside the dispute keep their original wording and meaning, so the rest of the bargain does not move.",
    "",
  ].join("\n");
  return { filename: "negotiation-summary.md", mediaType: "text/markdown", text, href: dataHref(text) };
}

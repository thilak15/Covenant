// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { App } from "./App.js";
import { CLAUSE_EXORCIST_SAMPLES } from "./samples.js";

const LIABILITY_SOURCE = [
  "LIAB-01 | WHEN Supplier liability arises under this Agreement THE SUPPLIER MUST limit the liability payment to no more than $100,000.",
  "LIAB-02 | WHEN Supplier liability arises from a covered third-party IP claim requiring payment above $100,000 THE SUPPLIER MUST pay the covered indemnity loss in full above $100,000.",
  "LIAB-03 | WHILE this Agreement remains active THE SUPPLIER MUST maintain the required insurance coverage.",
].join("\n");

const FREELANCE_SOURCE = [
  "IP-01 | WHEN the project is terminated after concept delivery and the Client pays the kill fee THE FREELANCER MUST transfer ownership of all delivered work to the Client.",
  "IP-02 | WHILE any part of the full project fee remains unpaid THE FREELANCER MUST NOT transfer ownership of delivered work to the Client.",
  "IP-03 | WHEN delivered work contains the Freelancer's pre-existing tools THE FREELANCER MUST retain ownership of that background IP.",
].join("\n");

const SLA_SOURCE = [
  "SLA-01 | WHEN monthly uptime is below 99.9% THE SUPPLIER MUST issue the contractual service credit.",
  "SLA-02 | WHILE an outage is caused by Force Majeure THE SUPPLIER MUST NOT issue a service credit for that outage.",
  "SLA-03 | WHEN monthly uptime is below 99.9% and the Customer serves a remedy notice THE SUPPLIER MUST begin the cure period.",
  "SLA-04 | WHILE Force Majeure remains active THE SUPPLIER MUST NOT begin the cure period.",
].join("\n");

interface FindingExpectation {
  readonly sampleTitle: string;
  readonly label: string;
  readonly message: RegExp;
  readonly evidence: readonly RegExp[];
  readonly replacements: Readonly<Record<"A" | "B", readonly string[]>>;
  readonly preserved: readonly string[];
}

const LIABILITY_A = "LIAB-02 | WHEN Supplier liability arises from a covered third-party IP claim requiring payment above $100,000 THE SUPPLIER MUST limit the covered indemnity payment to no more than $100,000.";
const LIABILITY_B = "LIAB-01 | WHEN Supplier liability other than a covered third-party IP indemnity arises under this Agreement THE SUPPLIER MUST limit the liability payment to no more than $100,000.";
const KILL_FEE_A = "IP-01 | WHEN the project is terminated after concept delivery and the Client pays the full project fee THE FREELANCER MUST transfer ownership of delivered work to the Client, excluding background IP.";
const KILL_FEE_B = "IP-01 | WHEN the project is terminated after concept delivery and the Client pays the kill fee THE FREELANCER MUST grant a limited client license without transferring ownership of delivered work or background IP.";
const BACKGROUND_A = "IP-01 | WHEN the project is terminated after concept delivery and the Client pays the kill fee THE FREELANCER MUST transfer ownership of delivered work to the Client, excluding the Freelancer's background IP.";
const BACKGROUND_B = "IP-03 | WHEN delivered work contains the Freelancer's pre-existing tools THE FREELANCER MUST retain that background IP and grant the Client a perpetual embedded-use license.";
const CREDIT_A = "SLA-01 | WHEN monthly uptime is below 99.9% and the outage is not caused by Force Majeure THE SUPPLIER MUST issue the contractual service credit.";
const CREDIT_B = "SLA-02 | WHILE an outage is caused by Force Majeure THE SUPPLIER MUST issue the contractual service credit for that outage.";
const CURE_A = "SLA-03 | WHEN monthly uptime is below 99.9%, the Customer serves a remedy notice, and the outage is not caused by Force Majeure THE SUPPLIER MUST begin the cure period.";
const CURE_B = "SLA-04 | WHILE Force Majeure remains active THE SUPPLIER MUST begin the cure period.";
const LIVENESS_A_CREDIT = "SLA-02 | WHILE an outage is caused by Force Majeure THE SUPPLIER MAY issue the contractual service credit for that outage.";
const LIVENESS_A_CURE = "SLA-04 | WHILE Force Majeure remains active THE SUPPLIER MAY begin the cure period.";

const FINDINGS: readonly FindingExpectation[] = [
  {
    sampleTitle: "SaaS Liability Cap vs. Uncapped Indemnification Loophole",
    label: "liability cap",
    message: /Rules LIAB-01, LIAB-02 apply together/,
    evidence: [/IP_INDEMNITY/, /coveredLossExceedsCap/, /liabilityPaymentUsd <= 100000/, /liabilityPaymentUsd > 100000/],
    replacements: { A: [LIABILITY_A], B: [LIABILITY_B] },
    preserved: ["LIAB-03"],
  },
  {
    sampleTitle: "Freelance IP Assignment & Kill-Fee Contradiction",
    label: "kill fee",
    message: /Rules IP-01, IP-02 apply together/,
    evidence: [/TERMINATED/, /killFeePaid/, /deliveredIpTransferred = true/, /deliveredIpTransferred = false|MUST NOT deliveredIpTransferred = true/],
    replacements: { A: [KILL_FEE_A], B: [KILL_FEE_B] },
    preserved: ["IP-03"],
  },
  {
    sampleTitle: "Freelance IP Assignment & Kill-Fee Contradiction",
    label: "background IP",
    message: /Rules IP-01, IP-03 apply together/,
    evidence: [/containsBackgroundIp/, /backgroundIpRetained = false/, /backgroundIpRetained = true/],
    replacements: { A: [BACKGROUND_A], B: [BACKGROUND_A, BACKGROUND_B] },
    preserved: ["IP-02"],
  },
  {
    sampleTitle: "Enterprise SLA Penalty & Force Majeure Deadlock",
    label: "service credit",
    message: /Rules SLA-01, SLA-02 apply together/,
    evidence: [/FORCE_MAJEURE/, /serviceCreditIssued = true/, /MUST NOT serviceCreditIssued = true/],
    replacements: { A: [CREDIT_A], B: [CREDIT_B] },
    preserved: ["SLA-03", "SLA-04"],
  },
  {
    sampleTitle: "Enterprise SLA Penalty & Force Majeure Deadlock",
    label: "cure period",
    message: /Rules SLA-03, SLA-04 apply together/,
    evidence: [/remedyNoticeServed/, /curePeriodStarted = true/, /MUST NOT curePeriodStarted = true/],
    replacements: { A: [CURE_A], B: [CURE_B] },
    preserved: ["SLA-01", "SLA-02"],
  },
  {
    sampleTitle: "Enterprise SLA Penalty & Force Majeure Deadlock",
    label: "remedy liveness",
    message: /Customer obtains the contractual SLA remedy after a noticed outage/,
    evidence: [/workflow\.sla-remedy/, /SLA-02/, /SLA-04/, /FORCE_MAJEURE/],
    replacements: { A: [LIVENESS_A_CREDIT, LIVENESS_A_CURE], B: [CREDIT_B, CURE_B] },
    preserved: ["SLA-01", "SLA-03"],
  },
];

const SOURCES = [LIABILITY_SOURCE, FREELANCE_SOURCE, SLA_SOURCE] as const;

beforeEach(() => {
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: (query: string): MediaQueryList => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => undefined,
      removeListener: () => undefined,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      dispatchEvent: () => true,
    }),
  });
});

afterEach(() => cleanup());

async function selectSample(user: ReturnType<typeof userEvent.setup>, title: string): Promise<HTMLTextAreaElement> {
  await user.click(screen.getByRole("button", { name: new RegExp(title, "i") }));
  await screen.findByRole("heading", { name: title });
  return await screen.findByRole("textbox", { name: "Authoritative source text" }) as HTMLTextAreaElement;
}

async function selectFinding(user: ReturnType<typeof userEvent.setup>, message: RegExp): Promise<void> {
  const lists = await screen.findAllByRole("list");
  const findings = lists.find((candidate) => candidate.classList.contains("cov-finding-list"));
  if (findings === undefined) throw new Error("Missing finding list");
  const messageNode = await within(findings).findByText(message);
  const item = messageNode.closest("li");
  if (item === null) throw new Error(`Finding message ${message.source} is not inside a list item`);
  await user.click(within(item).getByRole("button"));
}

function findingList(): HTMLElement {
  const list = document.querySelector(".cov-finding-list");
  if (!(list instanceof HTMLElement)) throw new Error("Missing finding list");
  return list;
}

function chalice(slot: "A" | "B"): HTMLElement {
  const element = document.querySelector(`[data-chalice-slot="${slot}"]`);
  if (!(element instanceof HTMLElement)) throw new Error(`Missing Chalice ${slot}`);
  return element;
}

function downloadText(link: HTMLAnchorElement): string {
  const prefix = "data:text/plain;charset=utf-8,";
  expect(link.href).toContain(prefix);
  return decodeURIComponent(link.href.slice(link.href.indexOf(prefix) + prefix.length));
}

describe("Clause Exorcist Cursed Sample Scrolls", () => {
  it("loads each exact pre-verified legal scroll and every expected finding", async () => {
    const user = userEvent.setup();
    render(<App />);
    expect(document.querySelector("[data-tribunal-skin='clause-exorcist']")).not.toBeNull();

    for (const [index, source] of SOURCES.entries()) {
      const sample = CLAUSE_EXORCIST_SAMPLES[index];
      if (sample === undefined) throw new Error(`Missing Clause Exorcist sample ${index}`);
      const editor = await selectSample(user, sample.title);
      expect(editor).toHaveValue(source);
      expect(sample.document.source.text).toBe(source);
    }

    const freelance = await selectSample(user, "Freelance IP Assignment & Kill-Fee Contradiction");
    expect(freelance).toHaveValue(FREELANCE_SOURCE);
    expect(within(findingList()).getByText(/Rules IP-01, IP-02 apply together/)).toBeVisible();
    expect(within(findingList()).getByText(/Rules IP-01, IP-03 apply together/)).toBeVisible();

    const sla = await selectSample(user, "Enterprise SLA Penalty & Force Majeure Deadlock");
    expect(sla).toHaveValue(SLA_SOURCE);
    expect(within(findingList()).getByText(/Rules SLA-01, SLA-02 apply together/)).toBeVisible();
    expect(within(findingList()).getByText(/Rules SLA-03, SLA-04 apply together/)).toBeVisible();
    expect(within(findingList()).getByText(/Customer obtains the contractual SLA remedy after a noticed outage/)).toBeVisible();

    for (const finding of FINDINGS) {
      await selectSample(user, finding.sampleTitle);
      await selectFinding(user, finding.message);
      const evidenceRoot = screen.queryByRole("region", { name: "Phantom Witness" })
        ?? screen.getByRole("region", { name: "Formal evidence ledger" });
      for (const evidence of finding.evidence) {
        expect(within(evidenceRoot).getAllByText(evidence).length).toBeGreaterThan(0);
      }
      for (const slot of ["A", "B"] as const) {
        const panel = chalice(slot);
        for (const replacement of finding.replacements[slot]) {
          expect(within(panel).getByText(replacement)).toBeVisible();
        }
      }
    }
  }, 60_000);

  it.each(FINDINGS)("applies both Chalices from clean revisions for $label", async (finding) => {
    for (const slot of ["A", "B"] as const) {
      const user = userEvent.setup();
      const rendered = render(<App />);
      await selectSample(user, finding.sampleTitle);
      await selectFinding(user, finding.message);
      const panel = chalice(slot);
      const strategy = panel.querySelector("header p")?.textContent ?? "";
      expect(strategy.length).toBeGreaterThan(0);
      await user.click(within(panel).getByRole("button", { name: `Review Chalice ${slot}` }));
      await user.click(screen.getByRole("button", { name: `Apply Chalice ${slot}` }));

      expect(await screen.findByText("100% preserved", {}, { timeout: 20_000 })).toBeVisible();
      expect(screen.getByText(new RegExp(`Preserved outside the conflict: ${finding.preserved.join(", ")}`))).toBeVisible();
      await waitFor(() => {
        expect(document.querySelector(".cov-finding-list")?.textContent ?? "").not.toMatch(finding.message);
      });
      expect(screen.getByText(/Target finding cleared/i)).toBeVisible();

      const redline = screen.getByRole("link", { name: "Download protective Legal Redline" }) as HTMLAnchorElement;
      const summary = screen.getByRole("link", { name: "Download plain-English negotiation summary" }) as HTMLAnchorElement;
      expect(redline.download).toBe("legal-redline.md");
      expect(summary.download).toBe("negotiation-summary.md");
      const redlineText = downloadText(redline);
      const summaryText = downloadText(summary);
      expect(redlineText).toContain("[-]");
      expect(redlineText).toContain("[+]");
      expect(redlineText).toContain("[~]");
      for (const replacement of finding.replacements[slot]) expect(redlineText).toContain(replacement);
      expect(summaryText).toContain(strategy);
      expect(summaryText).toContain("Formal effect");
      expect(summaryText).toMatch(/In plain English/i);
      for (const preserved of finding.preserved) expect(summaryText).toContain(preserved);
      rendered.unmount();
    }
  }, 120_000);

  it("resets finding selection and chalice review when the scroll changes", async () => {
    const user = userEvent.setup();
    render(<App />);
    await selectSample(user, FINDINGS[0]?.sampleTitle ?? "");
    await selectFinding(user, /Rules LIAB-01, LIAB-02 apply together/);
    await user.click(screen.getByRole("button", { name: "Review Chalice A" }));
    expect(screen.getByRole("button", { name: "Apply Chalice A" })).toBeInTheDocument();
    const freelance = await selectSample(user, "Freelance IP Assignment & Kill-Fee Contradiction");
    expect(freelance).toHaveValue(FREELANCE_SOURCE);
    expect(screen.queryByRole("button", { name: "Apply Chalice A" })).not.toBeInTheDocument();
    expect(screen.queryByText(/Rules LIAB-01, LIAB-02 apply together/)).not.toBeInTheDocument();
    expect(within(findingList()).getByText(/Rules IP-01, IP-02 apply together/)).toBeVisible();
  }, 30_000);

  it("parses pasted structured clauses offline and keeps rejected source located", async () => {
    const user = userEvent.setup();
    render(<App />);
    const source = await selectSample(user, "SaaS Liability Cap vs. Uncapped Indemnification Loophole");
    const schema = screen.getByRole("textbox", { name: "Offline parser declarations JSON" });
    fireEvent.change(schema, {
      target: {
        value: JSON.stringify({
          declaredVariables: [
            { kind: "ENUM", name: "Party", values: ["SUPPLIER", "CUSTOMER"] },
            { kind: "BOOLEAN", name: "agreementActive" },
            { kind: "BOOLEAN", name: "insuranceMaintained" },
          ],
          primaryWorkflows: [],
        }),
      },
    });
    const custom = "Clause INS-01: IF agreementActive THEN SUPPLIER MUST insuranceMaintained";
    fireEvent.change(source, { target: { value: custom } });
    await screen.findByText("Verification resolved");
    expect(screen.getByRole("textbox", { name: "Authoritative source text" })).toHaveValue(custom);

    fireEvent.change(source, { target: { value: "Clause INS-01: IF agreementActive THEN SUPPLIER MUST insuranceMaintained" } });
    fireEvent.change(source, { target: { value: "this is not a clause" } });
    await screen.findByText("Parser rejected");
    await new Promise((resolve) => setTimeout(resolve, 25));
    expect(screen.getByRole("textbox", { name: "Authoritative source text" })).toHaveValue("this is not a clause");
    expect(screen.getByText(/SYNTAX_ERROR/)).toBeVisible();
    expect(screen.queryByRole("navigation", { name: "Formal verification filters" })).not.toBeInTheDocument();
  }, 30_000);

  it("keeps the remaining SLA Chalices after one repair and preserves the earlier rewrite", async () => {
    const user = userEvent.setup();
    render(<App />);
    await selectSample(user, "Enterprise SLA Penalty & Force Majeure Deadlock");
    await selectFinding(user, /Rules SLA-01, SLA-02 apply together/);
    await user.click(within(chalice("A")).getByRole("button", { name: "Review Chalice A" }));
    await user.click(screen.getByRole("button", { name: "Apply Chalice A" }));
    await screen.findByText("100% preserved", {}, { timeout: 20_000 });
    await selectFinding(user, /Rules SLA-03, SLA-04 apply together/);
    expect(within(chalice("B")).getByText(CURE_B)).toBeVisible();
    await user.click(within(chalice("B")).getByRole("button", { name: "Review Chalice B" }));
    await user.click(screen.getByRole("button", { name: "Apply Chalice B" }));
    expect(await screen.findByText("100% preserved", {}, { timeout: 20_000 })).toBeVisible();
    const source = screen.getByRole("textbox", { name: "Authoritative source text" }) as HTMLTextAreaElement;
    expect(source.value).toContain(CREDIT_A);
    expect(source.value).toContain(CURE_B);
    expect(document.querySelector(".cov-finding-list")?.textContent ?? "").not.toMatch(/Rules SLA-03, SLA-04 apply together/);
  }, 40_000);

  it("applies a single verified Chalice and exports it without an A/B slot", async () => {
    const user = userEvent.setup();
    render(<App />);
    await selectSample(user, "SaaS Liability Cap vs. Uncapped Indemnification Loophole");
    const schema = screen.getByRole("textbox", { name: "Offline parser declarations JSON" });
    fireEvent.change(schema, {
      target: {
        value: JSON.stringify({
          declaredVariables: [
            { kind: "ENUM", name: "Party", values: ["SUPPLIER"] },
            { kind: "BOOLEAN", name: "CWE_862_APPLIES" },
            { kind: "BOOLEAN", name: "CWE_862_REQUIRED" },
            { kind: "BOOLEAN", name: "OperationHandled" },
          ],
          primaryWorkflows: [],
        }),
      },
    });
    const source = [
      "Clause SEC-01: IF CWE_862_APPLIES THEN SUPPLIER MUST OperationHandled",
      "Clause SEC-02: IF NOT CWE_862_APPLIES THEN SUPPLIER MUST OperationHandled",
    ].join("\n");
    fireEvent.change(screen.getByRole("textbox", { name: "Authoritative source text" }), { target: { value: source } });
    await screen.findByText("Verification resolved");
    const finding = await screen.findByRole("button", { name: /CWE-862 obligation gap/i });
    await user.click(finding);
    await user.click(screen.getByRole("button", { name: "Review Verified Chalice" }));
    await user.click(screen.getByRole("button", { name: "Apply Verified Chalice" }));
    expect(await screen.findByText("100% preserved", {}, { timeout: 20_000 })).toBeVisible();
    const redline = screen.getByRole("link", { name: "Download protective Legal Redline" }) as HTMLAnchorElement;
    expect(downloadText(redline)).toContain("Verified Chalice");
    expect(downloadText(redline)).toContain("[-]");
    expect(downloadText(redline)).toContain("[+]");
  }, 30_000);
});

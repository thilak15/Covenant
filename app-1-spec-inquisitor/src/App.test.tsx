// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { App } from "./App.js";
import { SPEC_INQUISITOR_SAMPLES } from "./samples.js";

interface SampleExpectation {
  readonly title: string;
  readonly findingTitle: string;
  readonly evidence: readonly string[];
  readonly chaliceA: string;
  readonly chaliceB: string;
}

const EXPECTATIONS: readonly SampleExpectation[] = [
  {
    title: "Multi-Role RBAC Emergency Override Contradiction",
    findingTitle: "Consistency Contradiction",
    evidence: ["RBAC-01", "RBAC-02", "emergencyOverride", "SUNDAY"],
    chaliceA: "RBAC-01 | WHEN a Contractor has an active emergency override and the day is not Sunday THE SYSTEM SHALL permit that Contractor to deploy to production.",
    chaliceB: "RBAC-02 | WHILE the day is Sunday and no emergency override is active THE SYSTEM SHALL prohibit every Contractor from deploying to production.",
  },
  {
    title: "Over-Hardened Agent Sandbox Liveness Deadlock",
    findingTitle: "Primary workflow deadlock",
    evidence: ["workflow.edit-and-test", "SAN-01", "SAN-02", "HARDENED"],
    chaliceA: "SAN-01 | WHILE the Agent sandbox is hardened THE SYSTEM SHALL prohibit writes to an untrusted workspace.",
    chaliceB: "SAN-01 | WHEN the Agent performs edit-and-test work in the hardened trusted workspace THE SYSTEM SHALL permit workspace writes.",
  },
  {
    title: "API Rate-Limit & CWE-862 Security Gap Spec",
    findingTitle: "CWE-862 obligation gap",
    evidence: ["CWE-862", "API-01", "authorizationVerified", "rateLimitRemaining"],
    chaliceA: "API-01 | WHEN an authenticated and authorized account member has at least one rate-limit token THE SYSTEM SHALL accept an update to billing settings.",
    chaliceB: "API-01 | WHEN an authenticated account member has at least one rate-limit token THE SYSTEM SHALL verify account authorization before accepting an update to billing settings.",
  },
];

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

function downloadText(link: HTMLAnchorElement): string {
  const prefix = "data:text/plain;charset=utf-8,";
  expect(link.href).toContain(prefix);
  return decodeURIComponent(link.href.slice(link.href.indexOf(prefix) + prefix.length));
}

describe("Spec Inquisitor Cursed Sample Scrolls", () => {
  it("loads each exact pre-verified AST and expected evidence without parsing", async () => {
    const user = userEvent.setup();
    render(<App />);

    for (const [index, expectation] of EXPECTATIONS.entries()) {
      const source = await selectSample(user, expectation.title);
      expect(source).toHaveValue(SPEC_INQUISITOR_SAMPLES[index]?.document.source.text);
      const finding = await screen.findByRole("button", { name: new RegExp(expectation.findingTitle, "i") });
      await user.click(finding);
      const main = screen.getByRole("main");
      for (const evidence of expectation.evidence) expect(within(main).getAllByText(new RegExp(evidence, "i")).length).toBeGreaterThan(0);
      expect(within(main).getByText(expectation.chaliceA)).toBeVisible();
      expect(within(main).getByText(expectation.chaliceB)).toBeVisible();
    }
  });

  it.each(EXPECTATIONS)("applies both verified Chalices from clean revisions for $title", async (expectation) => {
    for (const slot of ["A", "B"] as const) {
      const user = userEvent.setup();
      const rendered = render(<App />);
      await selectSample(user, expectation.title);
      const finding = await screen.findByRole("button", { name: new RegExp(expectation.findingTitle, "i") });
      await user.click(finding);
      await user.click(screen.getByRole("button", { name: `Review Chalice ${slot}` }));
      await user.click(screen.getByRole("button", { name: `Apply Chalice ${slot}` }));

      expect(await screen.findByText("100% preserved", {}, { timeout: 15_000 })).toBeVisible();
      await waitFor(() => {
        expect(screen.queryByRole("button", { name: new RegExp(expectation.findingTitle, "i") })).not.toBeInTheDocument();
      });
      expect(screen.getByText(/Target finding cleared/i)).toBeVisible();
      rendered.unmount();
    }
  }, 60_000);

  it("parses and verifies edited EARS entirely offline", async () => {
    const user = userEvent.setup();
    render(<App />);
    const expectation = EXPECTATIONS[0];
    if (expectation === undefined) throw new Error("Missing RBAC expectation");
    const source = await selectSample(user, expectation.title);
    const edited = "RBAC-01: WHEN emergencyOverride, THE SYSTEM SHALL deployPermitted";
    fireEvent.change(source, { target: { value: edited } });
    await waitFor(() => expect(source).toHaveValue(edited));
    await screen.findByText("Verification resolved");
    expect(screen.queryByText(/Parser rejected/i)).not.toBeInTheDocument();
  });

  it("accepts pasted EARS with user-declared offline vocabulary", async () => {
    const user = userEvent.setup();
    render(<App />);
    const expectation = EXPECTATIONS[0];
    if (expectation === undefined) throw new Error("Missing RBAC expectation");
    const source = await selectSample(user, expectation.title);
    const schema = screen.getByRole("textbox", { name: "Offline parser declarations JSON" });
    fireEvent.change(schema, {
      target: {
        value: JSON.stringify({
          declaredVariables: [
            { kind: "BOOLEAN", name: "CustomTrigger" },
            { kind: "BOOLEAN", name: "CustomOutcome" },
          ],
          primaryWorkflows: [],
        }),
      },
    });
    const custom = "CUSTOM-01: WHEN CustomTrigger, THE SYSTEM SHALL CustomOutcome";
    fireEvent.change(source, { target: { value: custom } });
    await screen.findByText("Verification resolved");
    expect(screen.getByRole("textbox", { name: "Authoritative source text" })).toHaveValue(custom);
  });

  it("does not let a stale successful solve replace a newer rejected edit", async () => {
    const user = userEvent.setup();
    render(<App />);
    const expectation = EXPECTATIONS[0];
    if (expectation === undefined) throw new Error("Missing RBAC expectation");
    const source = await selectSample(user, expectation.title);
    fireEvent.change(source, { target: { value: "RBAC-01: WHEN emergencyOverride, THE SYSTEM SHALL deployPermitted" } });
    fireEvent.change(source, { target: { value: "this is not EARS" } });
    await screen.findByText("Parser rejected");
    await new Promise((resolve) => setTimeout(resolve, 25));
    expect(screen.getByRole("textbox", { name: "Authoritative source text" })).toHaveValue("this is not EARS");
    expect(screen.queryByRole("navigation", { name: "Formal verification filters" })).not.toBeInTheDocument();
  });

  it("exports patched EARS and a replayable executable fast-check property", async () => {
    const user = userEvent.setup();
    render(<App />);
    const expectation = EXPECTATIONS[0];
    if (expectation === undefined) throw new Error("Missing RBAC expectation");
    await selectSample(user, expectation.title);
    await user.click(await screen.findByRole("button", { name: new RegExp(expectation.findingTitle, "i") }));
    await user.click(screen.getByRole("button", { name: "Review Chalice A" }));
    await user.click(screen.getByRole("button", { name: "Apply Chalice A" }));
    await screen.findByText("100% preserved", {}, { timeout: 15_000 });

    const requirements = screen.getByRole("link", { name: "Download patched requirements.md" }) as HTMLAnchorElement;
    const property = screen.getByRole("link", { name: "Download executable fast-check property" }) as HTMLAnchorElement;
    expect(requirements.download).toBe("requirements.md");
    expect(downloadText(requirements)).toContain(expectation.chaliceA);
    expect(property.download).toBe("covenant-preservation.property.ts");
    const snippet = downloadText(property);
    expect(snippet).toContain('import fc from "fast-check"');
    expect(snippet).toContain("fc.assert");
    expect(snippet).toContain("parseCovenantJson");
    expect(snippet).toContain("verifyCovenant");
    expect(snippet).toContain("ruleFingerprint");
    expect(snippet).toContain("RBAC-03");
    expect(snippet).toContain("100% of rules outside the Repair Core remain intact");
  }, 30_000);
});

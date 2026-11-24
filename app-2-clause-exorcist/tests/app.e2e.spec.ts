import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

const samples = [
  {
    title: "SaaS Liability Cap vs. Uncapped Indemnification Loophole",
    findings: ["Rules LIAB-01, LIAB-02 apply together"],
  },
  {
    title: "Freelance IP Assignment & Kill-Fee Contradiction",
    findings: ["Rules IP-01, IP-02 apply together", "Rules IP-01, IP-03 apply together"],
  },
  {
    title: "Enterprise SLA Penalty & Force Majeure Deadlock",
    findings: [
      "Rules SLA-01, SLA-02 apply together",
      "Rules SLA-03, SLA-04 apply together",
      "Customer obtains the contractual SLA remedy after a noticed outage",
    ],
  },
] as const;

test.describe.configure({ timeout: 180_000 });

test.beforeEach(async ({ page }) => {
  await page.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    if (url.protocol === "data:" || url.protocol === "blob:" || url.hostname === "127.0.0.1") {
      await route.continue();
      return;
    }
    await route.abort("blockedbyclient");
  });
});

async function openSample(page: Page, title: string): Promise<void> {
  const sample = page.getByRole("button", { name: title, exact: false });
  await sample.click();
  await expect(sample).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("button", { name: "Edit source" })).toBeVisible();
}

async function openFinding(page: Page, finding: string): Promise<void> {
  const item = page.locator(".cov-finding-list li", { hasText: finding });
  await expect(item).toBeVisible();
  await item.getByRole("button").click();
}

for (const sample of samples) {
  test(`${sample.title} stays offline, accessible, and applies both Chalices`, async ({ page }) => {
    await page.goto("/");
    await openSample(page, sample.title);
    await openFinding(page, sample.findings[0]);
    const accessibility = await new AxeBuilder({ page }).analyze();
    expect(accessibility.violations.filter(({ impact }) => impact === "critical" || impact === "serious")).toEqual([]);

    for (const finding of sample.findings) {
      for (const slot of ["A", "B"] as const) {
        await page.goto("/");
        await openSample(page, sample.title);
        await openFinding(page, finding);
        await page.getByRole("button", { name: `Review Chalice ${slot}` }).click();
        await page.getByRole("button", { name: `Apply Chalice ${slot}` }).click();
        await expect(page.getByText("100% preserved", { exact: true })).toBeVisible();
        await expect(page.getByText(/Target finding cleared/)).toBeVisible();
        await expect(page.locator(".cov-finding-list li", { hasText: finding })).toHaveCount(0);
      }
    }
  });
}

test("keyboard filtering and legal exports work without a backend", async ({ page }) => {
  await page.goto("/");
  await openSample(page, samples[0].title);
  const firstTab = page.getByRole("tab", { name: /Testability/ });
  await firstTab.focus();
  await page.keyboard.press("End");
  await page.keyboard.press("Enter");
  await expect(page.getByRole("tab", { name: /Security & Liveness/ })).toHaveAttribute("aria-selected", "true");
  await page.locator(".cov-inquisitor-bar__all").click();
  await openFinding(page, samples[0].findings[0]);
  await page.getByRole("button", { name: "Review Chalice A" }).click();
  await page.getByRole("button", { name: "Apply Chalice A" }).click();
  await expect(page.getByText("100% preserved", { exact: true })).toBeVisible();
  const redline = page.getByRole("link", { name: "Download protective Legal Redline" });
  const summary = page.getByRole("link", { name: "Download plain-English negotiation summary" });
  await expect(redline).toHaveAttribute("download", "legal-redline.md");
  await expect(redline).toHaveAttribute("href", /%5B~%5D|%5B-%5D|%5B%2B%5D/);
  await expect(summary).toHaveAttribute("download", "negotiation-summary.md");
  await expect(summary).toHaveAttribute("href", /In%20plain%20English/i);
});

test("captures the chancery folio at every review width", async ({ page }, testInfo) => {
  for (const sample of samples) {
    for (const width of [360, 768, 1024, 1280, 1600]) {
      await page.setViewportSize({ width, height: 1000 });
      await page.goto("/");
      await openSample(page, sample.title);
      await openFinding(page, sample.findings[0]);
      await page.screenshot({
        path: testInfo.outputPath(`clause-exorcist-${sample.title.slice(0, 12).replace(/\s+/gu, "-")}-${width}.png`),
        fullPage: true,
        animations: "disabled",
      });
      const bodyWidth = await page.locator("body").evaluate((element) => element.scrollWidth);
      expect(bodyWidth).toBeLessThanOrEqual(width);
    }
  }
});

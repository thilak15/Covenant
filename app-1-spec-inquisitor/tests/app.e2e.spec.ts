import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const samples = [
  {
    title: "Multi-Role RBAC Emergency Override Contradiction",
    finding: "Consistency Contradiction",
  },
  {
    title: "Over-Hardened Agent Sandbox Liveness Deadlock",
    finding: "Primary workflow deadlock",
  },
  {
    title: "API Rate-Limit & CWE-862 Security Gap Spec",
    finding: "CWE-862 obligation gap",
  },
] as const;

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

async function openSample(page: import("@playwright/test").Page, title: string, finding: string): Promise<void> {
  const sample = page.getByRole("button", { name: title, exact: false });
  await sample.click();
  await expect(sample).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("button", { name: "Edit source" })).toBeVisible();
  await expect(page.getByRole("button", { name: new RegExp(finding, "i") })).toBeVisible();
}

for (const sample of samples) {
  test(`${sample.title} remains offline, accessible, and applies both Chalices`, async ({ page }) => {
    for (const slot of ["A", "B"] as const) {
      await page.goto("/");
      await openSample(page, sample.title, sample.finding);
      await page.getByRole("button", { name: new RegExp(sample.finding, "i") }).click();
      const accessibility = await new AxeBuilder({ page }).analyze();
      expect(accessibility.violations.filter(({ impact }) => impact === "critical" || impact === "serious")).toEqual([]);
      await page.getByRole("button", { name: `Review Chalice ${slot}` }).click();
      await page.getByRole("button", { name: `Apply Chalice ${slot}` }).click();
      await expect(page.getByText("100% preserved", { exact: true })).toBeVisible();
      await expect(page.getByText(/Target finding cleared/)).toBeVisible();
      await expect(page.getByRole("button", { name: new RegExp(sample.finding, "i") })).toHaveCount(0);
    }
  });
}

test("keyboard filtering and UTF-8 exports work without a backend", async ({ page }) => {
  await page.goto("/");
  await openSample(page, samples[0].title, samples[0].finding);
  const firstTab = page.getByRole("tab", { name: /Testability/ });
  await firstTab.focus();
  await page.keyboard.press("End");
  await page.keyboard.press("Enter");
  await expect(page.getByRole("tab", { name: /Security & Liveness/ })).toHaveAttribute("aria-selected", "true");
  await page.locator(".cov-inquisitor-bar__all").click();
  await page.getByRole("button", { name: new RegExp(samples[0].finding, "i") }).click();
  await page.getByRole("button", { name: "Review Chalice A" }).click();
  await page.getByRole("button", { name: "Apply Chalice A" }).click();
  await expect(page.getByText("100% preserved", { exact: true })).toBeVisible();
  const requirements = page.getByRole("link", { name: "Download patched requirements.md" });
  const property = page.getByRole("link", { name: "Download executable fast-check property" });
  await expect(requirements).toHaveAttribute("download", "requirements.md");
  await expect(requirements).toHaveAttribute("href", /RBAC-01%20%7C%20WHEN/);
  await expect(property).toHaveAttribute("download", "covenant-preservation.property.ts");
  await expect(property).toHaveAttribute("href", /fast-check/);
});

test("captures the responsive source-first workbench", async ({ page }, testInfo) => {
  for (const width of [360, 768, 1024, 1280, 1600]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto("/");
    await openSample(page, samples[0].title, samples[0].finding);
    await page.getByRole("button", { name: new RegExp(samples[0].finding, "i") }).click();
    await page.screenshot({
      path: testInfo.outputPath(`spec-inquisitor-${width}.png`),
      fullPage: true,
      animations: "disabled",
    });
    const bodyWidth = await page.locator("body").evaluate((element) => element.scrollWidth);
    expect(bodyWidth).toBeLessThanOrEqual(width);
  }
});

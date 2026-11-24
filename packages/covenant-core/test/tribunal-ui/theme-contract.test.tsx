import { readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { TribunalTheme } from "../../src/index.js";

const PACKAGE_ROOT = process.cwd();
const CSS_PATH = join(PACKAGE_ROOT, "src/tribunal-ui/tribunal.css");
const PACKAGE_PATH = join(PACKAGE_ROOT, "package.json");
const FONT_DIRECTORY = join(PACKAGE_ROOT, "src/tribunal-ui/fonts");

const normativeTokens = [
  ["--cov-obsidian-950", "#090c0e"],
  ["--cov-obsidian-900", "#101518"],
  ["--cov-obsidian-800", "#182024"],
  ["--cov-obsidian-700", "#273137"],
  ["--cov-vellum-50", "#f5e9cb"],
  ["--cov-vellum-100", "#e9d6aa"],
  ["--cov-vellum-300", "#cdb37a"],
  ["--cov-vellum-ink", "#16120d"],
  ["--cov-tarnished-brass", "#b69355"],
  ["--cov-dark-brass", "#74552e"],
  ["--cov-emerald-sat", "#31c978"],
  ["--cov-emerald-deep", "#0b6b45"],
  ["--cov-blood-unsat", "#d94252"],
  ["--cov-blood-deep", "#811525"],
  ["--cov-amber-unknown", "#d49a37"],
  ["--cov-app1-grid", "#21463d"],
  ["--cov-app1-phosphor", "#79e6aa"],
  ["--cov-app2-mahogany", "#321719"],
  ["--cov-app2-wax", "#a51f32"],
  ["--cov-scrim", "rgba(9, 12, 14, 0.78)"],
  ["--cov-font-app1-display", "alegreya"],
  ["--cov-font-app2-display", "bodoni moda"],
  ["--cov-font-body", "commissioner"],
  ["--cov-font-witness", "fragment mono"],
  ["--cov-size-app1-display", "clamp(2rem, 4vw, 4.5rem)"],
  ["--cov-size-app2-display", "clamp(2rem, 4vw, 4.5rem)"],
  ["--cov-size-headline", "clamp(1.375rem, 2vw, 2rem)"],
  ["--cov-size-body", "1rem"],
  ["--cov-size-label", "0.75rem"],
  ["--cov-size-witness", "0.875rem"],
  ["--cov-radius-seal", "999px"],
  ["--cov-radius-control", "3px"],
  ["--cov-radius-panel", "6px"],
  ["--cov-radius-parchment", "10px 4px 8px 3px"],
  ["--cov-space-hairline", "1px"],
  ["--cov-space-xs", "4px"],
  ["--cov-space-sm", "8px"],
  ["--cov-space-md", "16px"],
  ["--cov-space-lg", "24px"],
  ["--cov-space-xl", "32px"],
  ["--cov-space-2xl", "48px"],
  ["--cov-space-3xl", "72px"],
  ["--cov-parchment-radius", "var(--cov-radius-parchment)"],
  ["--cov-parchment-padding", "var(--cov-space-lg)"],
  ["--cov-button-primary-padding", "12px 18px"],
  ["--cov-button-danger-padding", "12px 18px"],
  ["--cov-witness-padding", "8px 12px"],
  ["--cov-lantern-radius", "var(--cov-radius-seal)"],
  ["--cov-lantern-size", "16px"],
] as const;

function cssText(): string {
  return readFileSync(CSS_PATH, "utf8").toLowerCase();
}

function channel(value: number): number {
  const normalized = value / 255;
  return normalized <= 0.04045 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
}

function luminance(hex: string): number {
  const match = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/iu.exec(hex);
  if (match === null) throw new TypeError(`Invalid color: ${hex}`);
  const red = Number.parseInt(match[1]!, 16);
  const green = Number.parseInt(match[2]!, 16);
  const blue = Number.parseInt(match[3]!, 16);
  return (0.2126 * channel(red)) + (0.7152 * channel(green)) + (0.0722 * channel(blue));
}

function contrast(foreground: string, background: string): number {
  const light = Math.max(luminance(foreground), luminance(background));
  const dark = Math.min(luminance(foreground), luminance(background));
  return (light + 0.05) / (dark + 0.05);
}

describe("Tribunal theme contract", () => {
  it("exposes both skins through the browser-safe package root", () => {
    const { rerender } = render(
      <TribunalTheme skin="spec-inquisitor"><p>Evidence chamber</p></TribunalTheme>,
    );
    expect(screen.getByText("Evidence chamber").parentElement).toHaveAttribute("data-tribunal-skin", "spec-inquisitor");

    rerender(<TribunalTheme skin="clause-exorcist"><p>Evidence chamber</p></TribunalTheme>);
    expect(screen.getByText("Evidence chamber").parentElement).toHaveAttribute("data-tribunal-skin", "clause-exorcist");
  });

  it("maps every normative primitive to a stable custom property", () => {
    const css = cssText();
    for (const [property, value] of normativeTokens) {
      expect(css, property).toContain(`${property}: ${value}`);
    }

    for (const semantic of ["--cov-bg", "--cov-rail", "--cov-paper", "--cov-ink", "--cov-action", "--cov-pass", "--cov-fail", "--cov-unknown"]) {
      expect(css).toContain(`${semantic}:`);
    }
  });

  it("keeps approved normal-text contrast pairs at WCAG AA or better", () => {
    const pairs = [
      ["#f5e9cb", "#090c0e"],
      ["#16120d", "#f5e9cb"],
      ["#d94252", "#090c0e"],
      ["#811525", "#f5e9cb"],
      ["#31c978", "#090c0e"],
      ["#d49a37", "#090c0e"],
      ["#b69355", "#090c0e"],
    ] as const;
    for (const [foreground, background] of pairs) {
      expect(contrast(foreground, background), `${foreground} on ${background}`).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("self-hosts four WOFF2 faces without remote URLs or forbidden color language", () => {
    const css = cssText();
    expect(css).not.toMatch(/https?:|fonts\.googleapis|fonts\.gstatic/iu);
    expect(css).not.toMatch(/purple|violet|magenta|indigo/iu);
    expect(css.match(/@font-face/gu)).toHaveLength(4);
    expect(css.match(/font-display: swap/gu)).toHaveLength(4);

    for (const file of [
      "alegreya-latin.woff2",
      "bodoni-moda-latin.woff2",
      "commissioner-latin.woff2",
      "fragment-mono-latin.woff2",
    ]) {
      const path = join(FONT_DIRECTORY, file);
      expect(statSync(path).size).toBeGreaterThan(1_000);
      expect(readFileSync(path).subarray(0, 4).toString("ascii")).toBe("wOF2");
      expect(css).toContain(`url(\"./fonts/${file}\") format(\"woff2\")`);
    }
  });

  it("publishes the stable stylesheet subpath and retains CSS as a side effect", () => {
    const packageText = readFileSync(PACKAGE_PATH, "utf8");
    expect(packageText).toContain('"./tribunal.css"');
    expect(packageText).toContain('"./dist/tribunal-ui/tribunal.css"');
    expect(packageText).toContain('"**/*.css"');
  });

  it("defines responsive, visible-focus, forced-color, and reduced-motion safeguards", () => {
    const css = cssText();
    expect(css).toContain("@media (max-width: 639px)");
    expect(css).toMatch(/\.cov-inquisitor-tabs\s*\{[^}]*display: flex;[^}]*overflow-x: auto;/su);
    expect(css).not.toMatch(/\.cov-inquisitor-tab__name\s*\{[^}]*display:\s*none/su);
    expect(css).not.toMatch(/\.cov-inquisitor-tab__hood\s*\{[^}]*display:\s*none/su);
    expect(css).toContain(":focus-visible");
    expect(css).toContain("@media (forced-colors: active)");
    expect(css).toMatch(/\[aria-selected="true"\]:focus-visible\s*\{[^}]*outline-color: highlighttext;/su);
    expect(css).toContain("@media (prefers-reduced-motion: reduce)");
  });
});

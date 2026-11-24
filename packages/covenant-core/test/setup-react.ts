import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

function mediaQueryList(query: string, reducedMotion: boolean): MediaQueryList {
  return {
    matches: query === "(prefers-reduced-motion: reduce)" && reducedMotion,
    media: query,
    onchange: null,
    addListener: () => undefined,
    removeListener: () => undefined,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    dispatchEvent: () => true,
  };
}

export function setReducedMotion(reducedMotion: boolean): void {
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    writable: true,
    value: (query: string): MediaQueryList => mediaQueryList(query, reducedMotion),
  });
}

if (typeof window !== "undefined") setReducedMotion(false);

afterEach(() => {
  if (typeof window === "undefined") return;
  cleanup();
  setReducedMotion(false);
});

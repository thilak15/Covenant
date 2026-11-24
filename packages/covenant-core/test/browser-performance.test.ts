import { describe, expect, it } from "vitest";
import type { CovenantDocument, CovenantSolver, VerificationReport } from "../src/index.js";
import { cursedScrolls } from "./fixtures/cursed-scrolls.js";

const LIMIT_MS = 15;
const WARM_RUNS = 20;
const productionUrl = new URL("../dist/index.js", import.meta.url).href;

interface ProductionCore {
  readonly BrowserDeterministicSolver: new () => CovenantSolver;
  readonly verifyCovenant: (
    document: CovenantDocument,
    solver: CovenantSolver,
  ) => Promise<VerificationReport>;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null ? value as Record<string, unknown> : null;
}

async function loadProductionCore(): Promise<ProductionCore> {
  const loaded: unknown = await import(/* @vite-ignore */ productionUrl);
  const module = asRecord(loaded);
  const Solver = module?.["BrowserDeterministicSolver"];
  const verify = module?.["verifyCovenant"];
  if (typeof Solver !== "function" || typeof verify !== "function") {
    throw new Error("Build @covenant/core before running the production-artifact performance gate");
  }
  return {
    BrowserDeterministicSolver: Solver as ProductionCore["BrowserDeterministicSolver"],
    verifyCovenant: verify as ProductionCore["verifyCovenant"],
  };
}

const production = await loadProductionCore();

describe("compiled Cursed Sample Scroll performance", () => {
  it("keeps every first call and each of 20 warm calls below 15 ms", async () => {
    expect(productionUrl).toContain("/dist/index.js");
    expect(cursedScrolls).toHaveLength(6);
    for (const document of cursedScrolls) {
      const solver = new production.BrowserDeterministicSolver();
      const started = performance.now();
      await production.verifyCovenant(document, solver);
      const firstMs = performance.now() - started;
      expect(firstMs, `${document.source.id} first verification`).toBeLessThan(LIMIT_MS);

      const warmDurations: number[] = [];
      for (let run = 0; run < WARM_RUNS; run += 1) {
        const warmStarted = performance.now();
        await production.verifyCovenant(document, solver);
        warmDurations.push(performance.now() - warmStarted);
      }
      expect(warmDurations).toHaveLength(WARM_RUNS);
      warmDurations.forEach((duration, run) => {
        expect(duration, `${document.source.id} warm verification ${run + 1}`).toBeLessThan(LIMIT_MS);
      });
    }
  });
});

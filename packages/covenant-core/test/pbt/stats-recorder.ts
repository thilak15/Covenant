import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { performance } from "node:perf_hooks";
import type { OpenPBTStats, PBTProperty } from "../../src/index.js";

export const OPEN_PBT_SEED = 20_261_123;
const OUTPUT_DIRECTORY = join(process.cwd(), "node_modules", ".cache", "covenant-open-pbt-stats");

const OUTPUT_NAMES: Readonly<Record<PBTProperty, string>> = {
  SOUNDNESS: "soundness.json",
  PRESERVATION: "preservation.json",
  SOLVER_EQUIVALENCE: "solver-equivalence.json",
};

export class PBTStatsRecorder<P extends PBTProperty> {
  readonly #property: P;
  readonly #seed: number;
  readonly #startedAt = performance.now();
  readonly #edgeCases = new Map<string, number>();
  readonly #fingerprints = new Set<string>();
  #requestedRuns = 0;
  #attemptedRuns = 0;
  #successfulRuns = 0;
  #duplicateRuns = 0;

  constructor(property: P, seed: number = OPEN_PBT_SEED) {
    this.#property = property;
    this.#seed = seed;
  }

  requestRuns(count: number): void {
    if (!Number.isSafeInteger(count) || count <= 0) throw new TypeError("Requested run count must be a positive integer");
    this.#requestedRuns += count;
  }

  async record(tag: string, fingerprint: string, propertyRun: () => Promise<void> | void): Promise<void> {
    if (tag.length === 0 || fingerprint.length === 0) throw new TypeError("PBT tag and fingerprint must be non-empty");
    this.#attemptedRuns += 1;
    await propertyRun();
    this.#successfulRuns += 1;
    this.#edgeCases.set(tag, (this.#edgeCases.get(tag) ?? 0) + 1);
    if (this.#fingerprints.has(fingerprint)) this.#duplicateRuns += 1;
    else this.#fingerprints.add(fingerprint);
  }

  snapshot(): OpenPBTStats<P> {
    if (this.#requestedRuns < 200) throw new Error(`${this.#property} requested fewer than 200 successful runs`);
    if (this.#successfulRuns !== this.#requestedRuns) {
      throw new Error(`${this.#property} completed ${this.#successfulRuns} of ${this.#requestedRuns} requested successful runs`);
    }
    return {
      property: this.#property,
      requestedRuns: this.#requestedRuns,
      successfulRuns: this.#successfulRuns,
      edgeCases: [...this.#edgeCases.entries()]
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([tag, count]) => ({ tag, count })),
      duplicateRuns: this.#duplicateRuns,
      discardedRuns: this.#attemptedRuns - this.#successfulRuns,
      seed: this.#seed,
      durationMs: Math.max(0, Math.ceil(performance.now() - this.#startedAt)),
    };
  }

  async write(): Promise<void> {
    await mkdir(OUTPUT_DIRECTORY, { recursive: true });
    await writeFile(
      join(OUTPUT_DIRECTORY, OUTPUT_NAMES[this.#property]),
      `${JSON.stringify(this.snapshot(), null, 2)}\n`,
      "utf8",
    );
  }
}

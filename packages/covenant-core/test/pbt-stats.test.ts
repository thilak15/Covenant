import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import checkedInSnapshot from "../src/generated/open-pbt-stats.json" with { type: "json" };
import {
  formatOpenPBTStats,
  formatVerificationTelemetry,
  openPBTStatsSnapshot,
  validateOpenPBTSnapshot,
  type OpenPBTStats,
  type VerificationTelemetry,
} from "../src/index.js";

const completeStats: OpenPBTStats<"SOUNDNESS"> = {
  property: "SOUNDNESS",
  requestedRuns: 200,
  successfulRuns: 200,
  edgeCases: [
    { tag: "CONSEQUENCE_APPLICABILITY", count: 75 },
    { tag: "DIRECT_CONSEQUENCE", count: 125 },
  ],
  duplicateRuns: 196,
  discardedRuns: 7,
  seed: 20_261_123,
  durationMs: 1_234,
};

const liveTelemetry: VerificationTelemetry = {
  solver: "BROWSER_DETERMINISTIC",
  elapsedMs: 1.25,
  clausesChecked: 17,
};

describe("OpenPBTStats snapshot", () => {
  it("validates the checked-in unknown JSON in canonical property order", () => {
    const validated = validateOpenPBTSnapshot(checkedInSnapshot);

    expect(validated).toEqual(openPBTStatsSnapshot);
    expect(validated.properties.map(({ property }) => property)).toEqual([
      "SOUNDNESS",
      "PRESERVATION",
      "SOLVER_EQUIVALENCE",
    ]);
    for (const property of validated.properties) {
      expect(property.requestedRuns).toBeGreaterThanOrEqual(200);
      expect(property.successfulRuns).toBe(property.requestedRuns);
      expect(property.duplicateRuns).toBeLessThanOrEqual(property.successfulRuns);
      expect(property.discardedRuns).toBeGreaterThanOrEqual(0);
    }
  });

  it("rejects malformed property order and invalid run accounting", () => {
    expect(() => validateOpenPBTSnapshot({
      ...checkedInSnapshot,
      properties: [
        checkedInSnapshot.properties[1],
        checkedInSnapshot.properties[0],
        checkedInSnapshot.properties[2],
      ],
    })).toThrow(/property order/u);

    expect(() => validateOpenPBTSnapshot({
      ...checkedInSnapshot,
      properties: checkedInSnapshot.properties.map((property, index) => index === 0
        ? { ...property, successfulRuns: property.requestedRuns - 1 }
        : property),
    })).toThrow(/successfulRuns/u);

    expect(() => validateOpenPBTSnapshot({
      ...checkedInSnapshot,
      properties: checkedInSnapshot.properties.map((property, index) => index === 0
        ? { ...property, duplicateRuns: property.successfulRuns + 1 }
        : property),
    })).toThrow(/duplicateRuns/u);

    expect(() => validateOpenPBTSnapshot({
      ...checkedInSnapshot,
      properties: checkedInSnapshot.properties.map((property, index) => index === 1
        ? { ...property, seed: property.seed + 1 }
        : property),
    })).toThrow(/shared seed/u);
  });

  it("formats exact stable PBT rows including duplicates and discards", () => {
    expect(formatOpenPBTStats(completeStats)).toEqual([
      { label: "Property", value: "Soundness" },
      { label: "Successful runs", value: "200 / 200 requested" },
      { label: "Edge cases", value: "CONSEQUENCE_APPLICABILITY: 75 · DIRECT_CONSEQUENCE: 125" },
      { label: "Duplicate runs", value: "196" },
      { label: "Discarded runs", value: "7" },
      { label: "Seed", value: "20261123" },
      { label: "Suite duration", value: "1234 ms" },
    ]);
  });

  it("formats live rows separately without PBT fields or snapshot mutation", () => {
    const before = structuredClone(openPBTStatsSnapshot);

    expect(formatVerificationTelemetry(liveTelemetry)).toEqual([
      { label: "Solver", value: "Browser deterministic" },
      { label: "Solver latency", value: "1.25 ms" },
      { label: "Clauses checked", value: "17" },
    ]);
    expect(openPBTStatsSnapshot).toEqual(before);

    const serializedRows = JSON.stringify(formatVerificationTelemetry(liveTelemetry));
    expect(serializedRows).not.toMatch(/requestedRuns|successfulRuns|edgeCases|duplicateRuns|discardedRuns|seed|durationMs/u);
  });

  it("keeps browser statistics modules free from fast-check and test execution", async () => {
    const [moduleSource, rootSource] = await Promise.all([
      readFile(new URL("../src/pbt-stats.ts", import.meta.url), "utf8"),
      readFile(new URL("../src/index.ts", import.meta.url), "utf8"),
    ]);
    expect(`${moduleSource}\n${rootSource}`).not.toMatch(/fast-check|vitest|test\/pbt/u);
  });
});

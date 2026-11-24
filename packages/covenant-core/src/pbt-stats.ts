import snapshotJson from "./generated/open-pbt-stats.json" with { type: "json" };
import type {
  EdgeCaseCount,
  OpenPBTSnapshot,
  OpenPBTStats,
  PBTProperty,
  TelemetryRow,
  VerificationTelemetry,
} from "./model.js";

const PROPERTY_ORDER = ["SOUNDNESS", "PRESERVATION", "SOLVER_EQUIVALENCE"] as const;
const ROOT_KEYS = ["properties", "suiteVersion"] as const;
const STATS_KEYS = [
  "discardedRuns",
  "duplicateRuns",
  "durationMs",
  "edgeCases",
  "property",
  "requestedRuns",
  "seed",
  "successfulRuns",
] as const;
const EDGE_CASE_KEYS = ["count", "tag"] as const;

function recordFrom(value: unknown, path: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new TypeError(`${path} must be an object`);
  }
  return value as Record<string, unknown>;
}

function requireExactKeys(
  record: Readonly<Record<string, unknown>>,
  expected: readonly string[],
  path: string,
): void {
  const actual = Object.keys(record).sort();
  const canonicalExpected = [...expected].sort();
  if (actual.length !== canonicalExpected.length || actual.some((key, index) => key !== canonicalExpected[index])) {
    throw new TypeError(`${path} must contain exactly: ${canonicalExpected.join(", ")}`);
  }
}

function nonNegativeInteger(value: unknown, path: string): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) {
    throw new TypeError(`${path} must be a non-negative safe integer`);
  }
  return value;
}

function validateEdgeCases(value: unknown, successfulRuns: number, path: string): readonly EdgeCaseCount[] {
  if (!Array.isArray(value)) throw new TypeError(`${path} must be an array`);
  const tags = new Set<string>();
  const edgeCases = value.map((item, index) => {
    const itemPath = `${path}[${index}]`;
    const record = recordFrom(item, itemPath);
    requireExactKeys(record, EDGE_CASE_KEYS, itemPath);
    if (typeof record.tag !== "string" || record.tag.length === 0) {
      throw new TypeError(`${itemPath}.tag must be a non-empty string`);
    }
    if (tags.has(record.tag)) throw new TypeError(`${path} contains duplicate tag ${record.tag}`);
    tags.add(record.tag);
    const count = nonNegativeInteger(record.count, `${itemPath}.count`);
    if (count === 0 || count > successfulRuns) {
      throw new TypeError(`${itemPath}.count must be between 1 and successfulRuns`);
    }
    return Object.freeze({ tag: record.tag, count });
  });
  const sorted = [...edgeCases].sort((left, right) => left.tag.localeCompare(right.tag));
  if (edgeCases.some((edgeCase, index) => edgeCase.tag !== sorted[index]?.tag)) {
    throw new TypeError(`${path} must use stable tag order`);
  }
  return Object.freeze(edgeCases);
}

function validatePropertyStats<P extends PBTProperty>(
  value: unknown,
  expectedProperty: P,
  path: string,
): OpenPBTStats<P> {
  const record = recordFrom(value, path);
  requireExactKeys(record, STATS_KEYS, path);
  if (record.property !== expectedProperty) {
    throw new TypeError(`${path} violates required property order; expected ${expectedProperty}`);
  }
  const requestedRuns = nonNegativeInteger(record.requestedRuns, `${path}.requestedRuns`);
  if (requestedRuns < 200) throw new TypeError(`${path}.requestedRuns must be at least 200`);
  const successfulRuns = nonNegativeInteger(record.successfulRuns, `${path}.successfulRuns`);
  if (successfulRuns !== requestedRuns) {
    throw new TypeError(`${path}.successfulRuns must equal requestedRuns for a completed snapshot`);
  }
  const duplicateRuns = nonNegativeInteger(record.duplicateRuns, `${path}.duplicateRuns`);
  if (duplicateRuns > successfulRuns) {
    throw new TypeError(`${path}.duplicateRuns cannot exceed successfulRuns`);
  }
  const discardedRuns = nonNegativeInteger(record.discardedRuns, `${path}.discardedRuns`);
  const seed = record.seed;
  if (typeof seed !== "number" || !Number.isSafeInteger(seed)) {
    throw new TypeError(`${path}.seed must be a safe integer`);
  }
  const durationMs = nonNegativeInteger(record.durationMs, `${path}.durationMs`);
  const edgeCases = validateEdgeCases(record.edgeCases, successfulRuns, `${path}.edgeCases`);
  return Object.freeze({
    property: expectedProperty,
    requestedRuns,
    successfulRuns,
    edgeCases,
    duplicateRuns,
    discardedRuns,
    seed,
    durationMs,
  });
}

/** Narrows generated JSON before browser consumers receive typed PBT coverage data. */
export function validateOpenPBTSnapshot(value: unknown): OpenPBTSnapshot {
  const record = recordFrom(value, "OpenPBTSnapshot");
  requireExactKeys(record, ROOT_KEYS, "OpenPBTSnapshot");
  if (typeof record.suiteVersion !== "string" || record.suiteVersion.length === 0) {
    throw new TypeError("OpenPBTSnapshot.suiteVersion must be a non-empty string");
  }
  if (!Array.isArray(record.properties) || record.properties.length !== PROPERTY_ORDER.length) {
    throw new TypeError("OpenPBTSnapshot.properties must contain exactly three properties in property order");
  }
  const properties = [
    validatePropertyStats(record.properties[0], PROPERTY_ORDER[0], "OpenPBTSnapshot.properties[0]"),
    validatePropertyStats(record.properties[1], PROPERTY_ORDER[1], "OpenPBTSnapshot.properties[1]"),
    validatePropertyStats(record.properties[2], PROPERTY_ORDER[2], "OpenPBTSnapshot.properties[2]"),
  ] as const;
  if (properties.some(({ seed }) => seed !== properties[0].seed)) {
    throw new TypeError("OpenPBTSnapshot.properties must report one shared seed");
  }
  return Object.freeze({ suiteVersion: record.suiteVersion, properties: Object.freeze(properties) });
}

export const openPBTStatsSnapshot: OpenPBTSnapshot = validateOpenPBTSnapshot(snapshotJson);

const PROPERTY_LABELS: Readonly<Record<PBTProperty, string>> = {
  SOUNDNESS: "Soundness",
  PRESERVATION: "Preservation",
  SOLVER_EQUIVALENCE: "Solver Equivalence",
};

/** Formats only static Node-suite coverage fields. */
export function formatOpenPBTStats(stats: OpenPBTStats): readonly TelemetryRow[] {
  const edgeCases = stats.edgeCases.map(({ tag, count }) => `${tag}: ${count}`).join(" · ");
  return [
    { label: "Property", value: PROPERTY_LABELS[stats.property] },
    { label: "Successful runs", value: `${stats.successfulRuns} / ${stats.requestedRuns} requested` },
    { label: "Edge cases", value: edgeCases.length === 0 ? "None recorded" : edgeCases },
    { label: "Duplicate runs", value: String(stats.duplicateRuns) },
    { label: "Discarded runs", value: String(stats.discardedRuns) },
    { label: "Seed", value: String(stats.seed) },
    { label: "Suite duration", value: `${stats.durationMs} ms` },
  ];
}

const SOLVER_LABELS: Readonly<Record<VerificationTelemetry["solver"], string>> = {
  BROWSER_DETERMINISTIC: "Browser deterministic",
  NODE_Z3: "Node Z3",
};

/** Formats only measurements from one live solve. */
export function formatVerificationTelemetry(telemetry: VerificationTelemetry): readonly TelemetryRow[] {
  return [
    { label: "Solver", value: SOLVER_LABELS[telemetry.solver] },
    { label: "Solver latency", value: `${telemetry.elapsedMs} ms` },
    { label: "Clauses checked", value: String(telemetry.clausesChecked) },
  ];
}

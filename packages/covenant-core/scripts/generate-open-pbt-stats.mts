import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

const packageRoot = process.cwd();
const reportsDirectory = join(packageRoot, "node_modules", ".cache", "covenant-open-pbt-stats");
const outputPath = join(packageRoot, "src", "generated", "open-pbt-stats.json");
const expected = [
  ["SOUNDNESS", "soundness.json"],
  ["PRESERVATION", "preservation.json"],
  ["SOLVER_EQUIVALENCE", "solver-equivalence.json"],
] as const;
const fixedSeed = 20_261_123;
const REPORT_KEYS = [
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

type PropertyName = (typeof expected)[number][0];

interface GeneratedEdgeCase {
  readonly tag: string;
  readonly count: number;
}

interface GeneratedProperty {
  readonly property: PropertyName;
  readonly requestedRuns: number;
  readonly successfulRuns: number;
  readonly edgeCases: readonly GeneratedEdgeCase[];
  readonly duplicateRuns: number;
  readonly discardedRuns: number;
  readonly seed: number;
  readonly durationMs: number;
}

function requireRecord(value: unknown, path: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new TypeError(`${path} must be an object`);
  }
  return value as Record<string, unknown>;
}

function requireExactKeys(record: Readonly<Record<string, unknown>>, expectedKeys: readonly string[], path: string): void {
  const actual = Object.keys(record).sort();
  const required = [...expectedKeys].sort();
  if (actual.length !== required.length || actual.some((key, index) => key !== required[index])) {
    throw new TypeError(`${path} has invalid fields`);
  }
}

function requireNonNegativeInteger(value: unknown, path: string): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) {
    throw new TypeError(`${path} must be a non-negative safe integer`);
  }
  return value;
}

function validateEdgeCases(value: unknown, successfulRuns: number, path: string): readonly GeneratedEdgeCase[] {
  if (!Array.isArray(value)) throw new TypeError(`${path} must be an array`);
  const seen = new Set<string>();
  const edgeCases = value.map((item, index) => {
    const itemPath = `${path}[${index}]`;
    const record = requireRecord(item, itemPath);
    requireExactKeys(record, EDGE_CASE_KEYS, itemPath);
    if (typeof record.tag !== "string" || record.tag.length === 0 || seen.has(record.tag)) {
      throw new TypeError(`${itemPath}.tag must be non-empty and unique`);
    }
    seen.add(record.tag);
    const count = requireNonNegativeInteger(record.count, `${itemPath}.count`);
    if (count === 0 || count > successfulRuns) {
      throw new TypeError(`${itemPath}.count must be between 1 and successfulRuns`);
    }
    return { tag: record.tag, count };
  });
  const sortedTags = edgeCases.map(({ tag }) => tag).sort((left, right) => left.localeCompare(right));
  if (edgeCases.some(({ tag }, index) => tag !== sortedTags[index])) {
    throw new TypeError(`${path} must use stable tag order`);
  }
  return edgeCases;
}

function validateProperty(value: unknown, expectedProperty: PropertyName, path: string): GeneratedProperty {
  const report = requireRecord(value, path);
  requireExactKeys(report, REPORT_KEYS, path);
  if (report.property !== expectedProperty) throw new TypeError(`${path} must report ${expectedProperty}`);
  const requestedRuns = requireNonNegativeInteger(report.requestedRuns, `${path}.requestedRuns`);
  const successfulRuns = requireNonNegativeInteger(report.successfulRuns, `${path}.successfulRuns`);
  if (requestedRuns < 200 || successfulRuns !== requestedRuns) {
    throw new TypeError(`${path} must contain at least 200 requested and successful runs`);
  }
  if (report.seed !== fixedSeed) throw new TypeError(`${path} must report fixed seed ${fixedSeed}`);
  const duplicateRuns = requireNonNegativeInteger(report.duplicateRuns, `${path}.duplicateRuns`);
  if (duplicateRuns > successfulRuns) throw new TypeError(`${path}.duplicateRuns cannot exceed successfulRuns`);
  return {
    property: expectedProperty,
    requestedRuns,
    successfulRuns,
    edgeCases: validateEdgeCases(report.edgeCases, successfulRuns, `${path}.edgeCases`),
    duplicateRuns,
    discardedRuns: requireNonNegativeInteger(report.discardedRuns, `${path}.discardedRuns`),
    seed: fixedSeed,
    durationMs: requireNonNegativeInteger(report.durationMs, `${path}.durationMs`),
  };
}

async function readProperty(expectedProperty: PropertyName, fileName: string): Promise<GeneratedProperty> {
  const parsed: unknown = JSON.parse(await readFile(join(reportsDirectory, fileName), "utf8"));
  return validateProperty(parsed, expectedProperty, fileName);
}

function coverageFingerprint(property: GeneratedProperty): string {
  return JSON.stringify({
    property: property.property,
    requestedRuns: property.requestedRuns,
    successfulRuns: property.successfulRuns,
    edgeCases: property.edgeCases,
    duplicateRuns: property.duplicateRuns,
    discardedRuns: property.discardedRuns,
    seed: property.seed,
  });
}

async function preserveRecordedDurations(properties: readonly GeneratedProperty[]): Promise<readonly GeneratedProperty[]> {
  try {
    const currentValue: unknown = JSON.parse(await readFile(outputPath, "utf8"));
    const current = requireRecord(currentValue, "current snapshot");
    const currentProperties = current.properties;
    if (current.suiteVersion !== "1" || !Array.isArray(currentProperties) || currentProperties.length !== expected.length) {
      return properties;
    }
    return properties.map((property, index) => {
      const prior = validateProperty(currentProperties[index], property.property, `current properties[${index}]`);
      return coverageFingerprint(prior) === coverageFingerprint(property)
        ? { ...property, durationMs: prior.durationMs }
        : property;
    });
  } catch {
    return properties;
  }
}

const recordedProperties: GeneratedProperty[] = [];
for (const [property, fileName] of expected) {
  recordedProperties.push(await readProperty(property, fileName));
}
const properties = await preserveRecordedDurations(recordedProperties);
const snapshot = { suiteVersion: "1", properties };
await writeFile(outputPath, `${JSON.stringify(snapshot, null, 2)}\n`, "utf8");
console.log(`Generated ${outputPath} with seed ${fixedSeed}.`);

#!/usr/bin/env node
// COVENANT Z3 Formal Inquisitor: a zero-dependency MCP server (JSON-RPC 2.0 over stdio).
// Node-only by design: it is the only place besides Vitest that loads NodeZ3Solver / z3-solver.
import { createInterface } from "node:readline";
import { NodeZ3Solver } from "../../packages/covenant-core/dist/node/index.js";
import {
  applyChalicePatch,
  cweControls,
  parseCovenantJson,
  parseOffline,
  securityControlVariableNames,
  stringifyCovenant,
  verifyCovenant,
} from "../../packages/covenant-core/dist/index.js";

const SERVER_INFO = { name: "z3-covenant-power", version: "0.1.0" };
const SUPPORTED_PROTOCOLS = ["2025-06-18", "2025-03-26", "2024-11-05"];
const solver = new NodeZ3Solver();

const documentSchema = {
  request: {
    type: "object",
    description:
      "ParseRequest: { source: { id, revision, format: 'EARS' | 'CLAUSE', text }, declaredVariables: [...], primaryWorkflows: [...] }. Parsed with the deterministic offline parser.",
  },
  document: {
    type: "object",
    description: "A CovenantDocument (for example the `document` returned by verify_covenant_z3). Used instead of `request`.",
  },
};

const TOOLS = [
  {
    name: "verify_covenant_z3",
    description:
      "Verify a COVENANT spec or contract with the real Z3 solver. Returns the 5 Inquisitor verdicts, every Unsat Core, Phantom Witness and Resolution Payload (Two Cursed Chalices when available).",
    inputSchema: { type: "object", properties: documentSchema, additionalProperties: false },
  },
  {
    name: "audit_cwe_controls",
    description:
      "List the 60-CWE control manifest, or check which controls apply to a spec and whether each has an obligation gap (proved with Z3).",
    inputSchema: {
      type: "object",
      properties: {
        ...documentSchema,
        controlIds: {
          type: "array",
          items: { type: "string" },
          description: "Optional filter, for example ['CWE-862', 'CWE-306'].",
        },
      },
      additionalProperties: false,
    },
  },
  {
    name: "apply_chalice_patch_z3",
    description:
      "Apply a verified Chalice patch to a spec, re-verify the patched document with Z3 and return the Preservation Property proof (conflict set C fixed, 100% of ~C preserved) or a typed rejection reason.",
    inputSchema: {
      type: "object",
      properties: {
        ...documentSchema,
        patchId: { type: "string", description: "Id of a ChalicePatch returned by verify_covenant_z3." },
        findingId: { type: "string", description: "Finding id; use together with `slot`." },
        slot: { type: "string", enum: ["A", "B"], description: "Chalice A or B for the finding." },
        patch: { type: "object", description: "A full ChalicePatch object, instead of patchId or findingId + slot." },
      },
      additionalProperties: false,
    },
  },
];

class ToolInputError extends Error {}

function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Round-trips arguments through COVENANT's JSON codec so rational pairs and INTEGER scalars become bigint. */
function revive(value) {
  return parseCovenantJson(JSON.stringify(value));
}

function resolveDocument(args) {
  const candidate = isRecord(args.document) ? args.document : isRecord(args.request) ? args.request : isRecord(args.source) ? args : null;
  if (candidate === null) {
    throw new ToolInputError("Provide `request` (ParseRequest) or `document` (CovenantDocument).");
  }
  const revived = revive(candidate);
  if (Array.isArray(revived.rules)) return revived;
  const parsed = parseOffline(revived);
  if (parsed.status === "REJECTED") {
    throw new ToolInputError(`Parser rejected the input: ${stringifyCovenant(parsed.diagnostics)}`);
  }
  return parsed.document;
}

function resolutionsOf(report) {
  const out = [];
  for (const verdict of report.verdicts) {
    for (const finding of verdict.findings) {
      out.push({ inquisitor: verdict.inquisitor, findingId: finding.id, patternId: finding.patternId, support: finding.support, resolution: finding.resolution });
    }
  }
  return out;
}

function patchesOf(resolution) {
  if (resolution.kind === "pair") return [...resolution.patches];
  if (resolution.kind === "single") return [resolution.patch];
  return [];
}

async function verifyTool(args) {
  const document = resolveDocument(args);
  const report = await verifyCovenant(document, solver);
  const consistency = report.verdicts.find((verdict) => verdict.inquisitor === "CONSISTENCY");
  const contradictions = consistency.findings.map((finding) => ({
    findingId: finding.id,
    unsatCore: finding.evidence.core,
    phantomWitness: finding.evidence.witness,
  }));
  return {
    solver: "NodeZ3Solver",
    documentId: report.documentId,
    revision: report.revision,
    certifiable: report.certifiable,
    verdicts: report.verdicts.map((verdict) => ({ inquisitor: verdict.inquisitor, status: verdict.status })),
    inquisitors: report.verdicts,
    consistencyContradictions: contradictions,
    chalices: resolutionsOf(report),
    telemetry: report.telemetry,
    document,
  };
}

async function auditTool(args) {
  const filter = Array.isArray(args.controlIds) ? new Set(args.controlIds.map(String)) : null;
  const selected = cweControls.filter((control) => filter === null || filter.has(control.id));
  const hasSpec = isRecord(args.document) || isRecord(args.request) || isRecord(args.source);
  if (!hasSpec) {
    return {
      mode: "list",
      total: cweControls.length,
      controls: selected.map((control) => ({
        id: control.id,
        title: control.title,
        ...securityControlVariableNames(control.id),
        repairStrategyIds: control.repairStrategyIds,
      })),
    };
  }
  const document = resolveDocument(args);
  const report = await verifyCovenant(document, solver);
  const security = report.verdicts.find((verdict) => verdict.inquisitor === "SECURITY_LIVENESS");
  const gaps = security.findings.filter((finding) => finding.evidence.category === "SECURITY");
  const declared = new Set(document.variables.map((variable) => variable.name));
  const controls = selected.map((control) => {
    const names = securityControlVariableNames(control.id);
    const applicable = declared.has(names.applies) && declared.has(names.required);
    const controlGaps = gaps.filter((finding) => finding.evidence.controlId === control.id);
    return {
      id: control.id,
      title: control.title,
      status: !applicable ? "NOT_APPLICABLE" : controlGaps.length > 0 ? "GAP" : "SATISFIED",
      gaps: controlGaps.map((finding) => ({
        findingId: finding.id,
        ruleIds: finding.evidence.ruleIds,
        witness: finding.evidence.assignments,
        resolution: finding.resolution,
      })),
    };
  });
  return {
    mode: "check",
    solver: "NodeZ3Solver",
    documentId: report.documentId,
    securityLivenessStatus: security.status,
    applicable: controls.filter((control) => control.status !== "NOT_APPLICABLE").length,
    gapCount: controls.filter((control) => control.status === "GAP").length,
    controls,
    livenessDeadlocks: security.findings.filter((finding) => finding.evidence.category === "LIVENESS"),
  };
}

async function applyTool(args) {
  const document = resolveDocument(args);
  let patch;
  if (isRecord(args.patch)) {
    patch = revive(args.patch);
  } else {
    const report = await verifyCovenant(document, solver);
    const candidates = resolutionsOf(report).flatMap((entry) =>
      patchesOf(entry.resolution).map((candidate) => ({ candidate, findingId: entry.findingId })),
    );
    if (typeof args.patchId === "string") {
      patch = candidates.find((entry) => entry.candidate.id === args.patchId)?.candidate;
    } else if (typeof args.findingId === "string" && (args.slot === "A" || args.slot === "B")) {
      patch = candidates.find((entry) => entry.findingId === args.findingId && entry.candidate.slot === args.slot)?.candidate;
    } else {
      throw new ToolInputError("Provide `patch`, `patchId`, or `findingId` with `slot` (A or B).");
    }
    if (patch === undefined) {
      throw new ToolInputError(`No verified patch matches. Available patch ids: ${candidates.map((entry) => entry.candidate.id).join(", ") || "none"}.`);
    }
  }
  const result = await applyChalicePatch(document, patch, solver);
  if (result.status === "REJECTED") {
    return { solver: "NodeZ3Solver", status: "REJECTED", reason: result.reason, patchId: patch.id };
  }
  return {
    solver: "NodeZ3Solver",
    status: "APPLIED",
    patchId: patch.id,
    conflictFixed: result.proof.conflictFixed,
    preservationPercent: result.proof.preservationPercent,
    proof: result.proof,
    certifiable: result.report.certifiable,
    verdicts: result.report.verdicts.map((verdict) => ({ inquisitor: verdict.inquisitor, status: verdict.status })),
    patchedSource: result.document.source.text,
    report: result.report,
    document: result.document,
  };
}

const HANDLERS = {
  verify_covenant_z3: verifyTool,
  audit_cwe_controls: auditTool,
  apply_chalice_patch_z3: applyTool,
};

async function callTool(params) {
  const handler = isRecord(params) && typeof params.name === "string" ? HANDLERS[params.name] : undefined;
  if (handler === undefined) return { code: -32602, message: `Unknown tool: ${isRecord(params) ? String(params.name) : "<missing>"}` };
  const args = isRecord(params.arguments) ? params.arguments : {};
  try {
    const payload = await handler(args);
    return { result: { content: [{ type: "text", text: stringifyCovenant(payload) }] } };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { result: { isError: true, content: [{ type: "text", text: message }] } };
  }
}

async function handle(message) {
  const { id, method, params } = message;
  const isNotification = id === undefined || id === null;
  switch (method) {
    case "initialize": {
      const requested = isRecord(params) ? params.protocolVersion : undefined;
      return {
        result: {
          protocolVersion: SUPPORTED_PROTOCOLS.includes(requested) ? requested : SUPPORTED_PROTOCOLS[0],
          capabilities: { tools: {} },
          serverInfo: SERVER_INFO,
        },
      };
    }
    case "ping":
      return { result: {} };
    case "tools/list":
      return { result: { tools: TOOLS } };
    case "tools/call":
      return callTool(params);
    default:
      if (isNotification) return null;
      return { code: -32601, message: `Method not found: ${String(method)}` };
  }
}

function send(payload) {
  process.stdout.write(`${JSON.stringify(payload)}\n`);
}

let queue = Promise.resolve();
const lines = createInterface({ input: process.stdin, crlfDelay: Infinity });
lines.on("line", (line) => {
  if (line.trim() === "") return;
  queue = queue.then(async () => {
    let message;
    try {
      message = JSON.parse(line);
    } catch {
      send({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error" } });
      return;
    }
    if (!isRecord(message) || typeof message.method !== "string") {
      send({ jsonrpc: "2.0", id: isRecord(message) && message.id !== undefined ? message.id : null, error: { code: -32600, message: "Invalid Request" } });
      return;
    }
    const outcome = await handle(message).catch((error) => ({ code: -32603, message: error instanceof Error ? error.message : String(error) }));
    if (outcome === null || message.id === undefined || message.id === null) return;
    if ("result" in outcome) send({ jsonrpc: "2.0", id: message.id, result: outcome.result });
    else send({ jsonrpc: "2.0", id: message.id, error: { code: outcome.code, message: outcome.message } });
  });
});
lines.on("close", () => {
  // z3-solver keeps worker threads alive; exit explicitly once pending replies are flushed.
  queue.finally(() => process.exit(0));
});

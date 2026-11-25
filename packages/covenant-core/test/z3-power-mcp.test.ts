import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { createInterface } from "node:readline";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const serverPath = resolve(repositoryRoot, "powers/z3-covenant-power/server.mjs");
interface RpcResponse {
  readonly id: number;
  readonly result?: unknown;
  readonly error?: { readonly code: number; readonly message: string };
}
interface Chalice {
  readonly id: string;
  readonly slot: string | null;
}
interface VerifyPayload {
  readonly solver: string;
  readonly verdicts: readonly { readonly inquisitor: string; readonly status: string }[];
  readonly consistencyContradictions: readonly {
    readonly findingId: string;
    readonly unsatCore: { readonly ruleIds: readonly string[] };
    readonly phantomWitness: {
      readonly coreRuleIds: readonly string[];
      readonly assignments: readonly { readonly variable: string }[];
    };
  }[];
  readonly chalices: readonly {
    readonly findingId: string;
    readonly inquisitor: string;
    readonly resolution: { readonly kind: string; readonly patches?: readonly Chalice[] };
  }[];
  readonly document: unknown;
}
const contradictorySpec = {
  source: {
    id: "rbac",
    revision: "r1",
    format: "EARS",
    text: [
      'R1: WHEN Role = "Contractor" AND EmergencyOverride, THE SYSTEM SHALL AccessGranted',
      'R2: WHEN Role = "Contractor", THE SYSTEM SHALL NOT AccessGranted',
      'R3: WHEN Role = "Admin", THE SYSTEM SHALL AccessGranted',
    ].join("\n"),
  },
  declaredVariables: [
    { kind: "ENUM", name: "Role", values: ["Admin", "Contractor"] },
    { kind: "BOOLEAN", name: "EmergencyOverride" },
    { kind: "BOOLEAN", name: "AccessGranted" },
  ],
  primaryWorkflows: [],
};
let server: ChildProcessWithoutNullStreams;
const pending = new Map<number, (response: RpcResponse) => void>();
let nextId = 1;
function request(method: string, params?: unknown): Promise<RpcResponse> {
  const id = nextId++;
  return new Promise((resolveResponse) => {
    pending.set(id, resolveResponse);
    server.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", id, method, params })}\n`);
  });
}
async function callTool<T>(name: string, args: unknown): Promise<T> {
  const response = await request("tools/call", { name, arguments: args });
  expect(response.error).toBeUndefined();
  const result = response.result as { isError?: boolean; content: readonly { type: string; text: string }[] };
  expect(result.isError).not.toBe(true);
  const first = result.content[0];
  expect(first?.type).toBe("text");
  return JSON.parse(first?.text ?? "null") as T;
}
beforeAll(() => {
  server = spawn("node", [serverPath], { cwd: repositoryRoot, stdio: ["pipe", "pipe", "pipe"] });
  createInterface({ input: server.stdout }).on("line", (line) => {
    const response = JSON.parse(line) as RpcResponse;
    pending.get(response.id)?.(response);
    pending.delete(response.id);
  });
});
afterAll(() => {
  server.stdin.end();
  server.kill();
});
describe("z3-covenant-power MCP server", () => {
  it("initializes and lists the three tools", async () => {
    const init = await request("initialize", { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "vitest", version: "0" } });
    expect(init.result).toMatchObject({ serverInfo: { name: "z3-covenant-power" }, capabilities: { tools: {} } });
    server.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" })}\n`);
    const list = await request("tools/list");
    const tools = (list.result as { tools: readonly { name: string }[] }).tools.map((tool) => tool.name);
    expect(tools).toEqual(["verify_covenant_z3", "audit_cwe_controls", "apply_chalice_patch_z3"]);
  });
  it("proves a Consistency FAIL with a minimal Unsat Core, Phantom Witness and ChalicePair using real Z3", async () => {
    const payload = await callTool<VerifyPayload>("verify_covenant_z3", { request: contradictorySpec });
    expect(payload.solver).toBe("NodeZ3Solver");
    expect(payload.verdicts.find((verdict) => verdict.inquisitor === "CONSISTENCY")?.status).toBe("FAIL");
    expect(payload.consistencyContradictions).toHaveLength(1);
    const [contradiction] = payload.consistencyContradictions;
    expect(contradiction?.unsatCore.ruleIds).toEqual(["R1", "R2"]);
    expect(contradiction?.phantomWitness.coreRuleIds).toEqual(["R1", "R2"]);
    expect(contradiction?.phantomWitness.assignments.map((assignment) => assignment.variable)).toEqual(["Role", "EmergencyOverride"]);
    const resolution = payload.chalices.find((entry) => entry.findingId === contradiction?.findingId)?.resolution;
    expect(resolution?.kind).toBe("pair");
    expect(resolution?.patches?.map((patch) => patch.slot)).toEqual(["A", "B"]);
  }, 60_000);
  it("applies a Chalice with Z3 and proves 100% preservation of ~C", async () => {
    const verified = await callTool<VerifyPayload>("verify_covenant_z3", { request: contradictorySpec });
    const contradiction = verified.consistencyContradictions[0];
    const applied = await callTool<{
      status: string;
      preservationPercent: number;
      conflictFixed: boolean;
      verdicts: readonly { readonly inquisitor: string; readonly status: string }[];
    }>("apply_chalice_patch_z3", { document: verified.document, findingId: contradiction?.findingId, slot: "A" });
    expect(applied.status).toBe("APPLIED");
    expect(applied.conflictFixed).toBe(true);
    expect(applied.preservationPercent).toBe(100);
    expect(applied.verdicts.find((verdict) => verdict.inquisitor === "CONSISTENCY")?.status).toBe("PASS");
  }, 60_000);
  it("lists the 60-CWE manifest and returns tool errors without crashing", async () => {
    const listing = await callTool<{ mode: string; total: number; controls: readonly unknown[] }>("audit_cwe_controls", {});
    expect(listing).toMatchObject({ mode: "list", total: 60 });
    expect(listing.controls).toHaveLength(60);
    const failure = await request("tools/call", { name: "verify_covenant_z3", arguments: {} });
    expect((failure.result as { isError?: boolean }).isError).toBe(true);
  }, 60_000);
});

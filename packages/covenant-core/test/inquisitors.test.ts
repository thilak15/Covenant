import { describe, expect, it } from "vitest";
import {
  BrowserDeterministicSolver,
  verifyCovenant,
  type CovenantDocument,
  type CovenantProblem,
  type CovenantSolver,
  type SolveOptions,
} from "../src/index.js";
import { fixtureDocument, flag } from "./fixtures/cursed-scrolls.js";

const solver = new BrowserDeterministicSolver();

describe("the five ordered Inquisitors", () => {
  it("returns exactly the fixed order and certifies only five PASS verdicts", async () => {
    const document = fixtureDocument("certifiable", [], [
      { id: "R1", modality: "MUST", consequence: { kind: "TRUE" } },
    ]);
    const report = await verifyCovenant(document, solver);
    expect(report.verdicts.map((item) => item.inquisitor)).toEqual([
      "TESTABILITY",
      "CONSISTENCY",
      "COMPLETENESS",
      "UNAMBIGUITY",
      "SECURITY_LIVENESS",
    ]);
    expect(report.verdicts.map((item) => item.status)).toEqual(["PASS", "PASS", "PASS", "PASS", "PASS"]);
    expect(report.certifiable).toBe(true);
    expect(report.telemetry.every((item) => item.solver === "BROWSER_DETERMINISTIC")).toBe(true);
  });

  it("returns a concrete Completeness witness for an uncovered input combination", async () => {
    const document = fixtureDocument("gap", [{ kind: "BOOLEAN", name: "Handled" }], [
      { id: "R1", activation: flag("Handled"), modality: "MUST", consequence: { kind: "TRUE" } },
    ]);
    const report = await verifyCovenant(document, solver);
    const completeness = report.verdicts[2];
    expect(completeness.status).toBe("FAIL");
    if (completeness.status === "FAIL") {
      expect(completeness.findings[0].evidence.assignments).toEqual([
        { variable: "Handled", value: { kind: "BOOLEAN", value: false } },
      ]);
    }
    expect(report.certifiable).toBe(false);
  });

  it("flags an internally impossible rule as Testability, not Consistency", async () => {
    const document = fixtureDocument("impossible", [{ kind: "BOOLEAN", name: "Enabled" }], [
      { id: "R1", activation: flag("Enabled"), modality: "MUST", consequence: flag("Enabled", false) },
    ]);
    const report = await verifyCovenant(document, solver);
    expect(report.verdicts[0].status).toBe("FAIL");
    expect(report.verdicts[1].status).toBe("PASS");
    if (report.verdicts[0].status === "FAIL") {
      expect(report.verdicts[0].findings[0].patternId).toBe("INTERNALLY_IMPOSSIBLE_RULE");
    }
  });

  it("keeps a proven FAIL when unsupported theory leaves sibling checks unresolved", async () => {
    const base = fixtureDocument("precedence", [{ kind: "BOOLEAN", name: "Enabled" }], [
      { id: "R1", activation: flag("Enabled"), modality: "MUST", consequence: flag("Enabled", false) },
    ]);
    const document: CovenantDocument = {
      ...base,
      unsupportedConstructs: [{
        theory: "NONLINEAR",
        description: "unsupported product",
        source: base.rules[0]?.source ?? (() => { throw new Error("fixture rule missing"); })(),
      }],
    };
    const report = await verifyCovenant(document, solver);
    expect(report.verdicts[0].status).toBe("FAIL");
    if (report.verdicts[0].status === "FAIL") expect(report.verdicts[0].unresolved).toContain("UNSUPPORTED_THEORY");
    expect(report.certifiable).toBe(false);
  });

  it("discovers a hard consequence that conflicts with another rule's applicability", async () => {
    const document = fixtureDocument("cross-dependency", [
      { kind: "BOOLEAN", name: "Start" },
      { kind: "BOOLEAN", name: "Gate" },
      { kind: "BOOLEAN", name: "Done" },
    ], [
      { id: "R1", activation: flag("Start"), modality: "MUST", consequence: flag("Gate") },
      { id: "R2", activation: flag("Gate", false), modality: "MUST", consequence: flag("Done") },
    ]);
    const report = await verifyCovenant(document, solver);
    expect(report.verdicts[1].status).toBe("FAIL");
    if (report.verdicts[1].status === "FAIL") expect(report.verdicts[1].findings[0].evidence.core.ruleIds).toEqual(["R1", "R2"]);
  });

  it("applies one cumulative Consistency budget instead of resetting it per candidate", async () => {
    const document = fixtureDocument("budget", [
      { kind: "BOOLEAN", name: "Gate" },
      { kind: "BOOLEAN", name: "Outcome" },
    ], Array.from({ length: 12 }, (_, index) => ({
      id: `R${index + 1}`,
      activation: flag("Gate"),
      modality: index % 2 === 0 ? "MUST" as const : "MUST_NOT" as const,
      consequence: flag("Outcome"),
    })));
    const report = await verifyCovenant(document, solver, { maxSteps: 3 });
    const consistency = report.verdicts[1];
    expect(consistency.status).toBe("UNKNOWN");
    if (consistency.status === "UNKNOWN") expect(consistency.unresolved).toContain("RESOURCE_LIMIT");
    const consistencyTelemetry = report.telemetry.filter((item) => item.clausesChecked <= 3);
    expect(consistencyTelemetry.length).toBeGreaterThan(0);
  });

  it("maps solver adapter failures to UNKNOWN and blocks certification", async () => {
    class BrokenSolver implements CovenantSolver {
      solve(_problem: CovenantProblem, _options?: SolveOptions): Promise<never> {
        return Promise.reject(new Error("adapter failed"));
      }
    }
    const report = await verifyCovenant(fixtureDocument("adapter", [], [
      { id: "R1", modality: "MUST", consequence: { kind: "TRUE" } },
    ]), new BrokenSolver());
    expect(report.verdicts.some((item) => item.status === "UNKNOWN" && item.unresolved.includes("ADAPTER_FAILURE"))).toBe(true);
    expect(report.certifiable).toBe(false);
  });
});

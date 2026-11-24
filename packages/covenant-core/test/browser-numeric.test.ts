import { describe, expect, it } from "vitest";
import {
  BrowserDeterministicSolver,
  evaluateNormalizedCondition,
  makeRational,
  type NormalizedCondition,
  type SolverProblem,
  type UnsupportedSolverProblem,
  type VariableDeclaration,
} from "../src/index.js";

const value = (integer: bigint) => makeRational(integer, 1n);
const numeric = (
  variable: string,
  domain: "INTEGER" | "DECIMAL",
  lower?: readonly [bigint, boolean],
  upper?: readonly [bigint, boolean],
): NormalizedCondition => ({
  kind: "ATOM",
  atom: {
    kind: "NUMERIC",
    bound: {
      variable,
      domain,
      ...(lower === undefined ? {} : { lower: { value: value(lower[0]), inclusive: lower[1] } }),
      ...(upper === undefined ? {} : { upper: { value: value(upper[0]), inclusive: upper[1] } }),
    },
  },
});

function problem(
  variables: readonly VariableDeclaration[],
  constraints: readonly NormalizedCondition[],
): SolverProblem<"NONE"> {
  return { kind: "SUPPORTED", queryId: "numeric", variables, fixedConstraints: constraints, ruleGroups: [], coreTracking: "NONE" };
}

describe("BrowserDeterministicSolver exact decisions", () => {
  it("rejects an integer gap but satisfies the same open decimal interval exactly", async () => {
    const solver = new BrowserDeterministicSolver();
    const integer = await solver.solve(problem(
      [{ kind: "NUMERIC", name: "x", domain: "INTEGER" }],
      [numeric("x", "INTEGER", [5n, false]), numeric("x", "INTEGER", undefined, [6n, false])],
    ));
    expect(integer).toMatchObject({ status: "UNSAT", core: null });

    const decimalProblem = problem(
      [{ kind: "NUMERIC", name: "x", domain: "DECIMAL" }],
      [numeric("x", "DECIMAL", [5n, false]), numeric("x", "DECIMAL", undefined, [6n, false])],
    );
    const decimal = await solver.solve(decimalProblem);
    expect(decimal.status).toBe("SAT");
    if (decimal.status === "SAT") {
      expect(decimal.model).toEqual([{ variable: "x", value: { kind: "DECIMAL", value: makeRational(11n, 2n) } }]);
      expect(decimalProblem.fixedConstraints.every((condition) => evaluateNormalizedCondition(condition, decimal.model))).toBe(true);
    }
  });

  it("explores disjunction branches and respects declared numeric ranges", async () => {
    const disjunction: NormalizedCondition = {
      kind: "ANY",
      conditions: [numeric("x", "INTEGER", undefined, [-1n, true]), numeric("x", "INTEGER", [10n, false])],
    };
    const result = await new BrowserDeterministicSolver().solve(problem(
      [{ kind: "NUMERIC", name: "x", domain: "INTEGER", range: { lower: { value: value(0n), inclusive: true } } }],
      [disjunction],
    ));
    expect(result.status).toBe("SAT");
    if (result.status === "SAT") expect(result.model).toEqual([{ variable: "x", value: { kind: "INTEGER", value: 11n } }]);
  });

  it("solves Boolean and enum constraints deterministically", async () => {
    const constraints: readonly NormalizedCondition[] = [
      { kind: "ATOM", atom: { kind: "BOOLEAN", variable: "Enabled", equals: true } },
      { kind: "ATOM", atom: { kind: "ENUM", variable: "Role", operator: "NEQ", value: "Guest" } },
    ];
    const result = await new BrowserDeterministicSolver().solve(problem([
      { kind: "BOOLEAN", name: "Enabled" },
      { kind: "ENUM", name: "Role", values: ["Guest", "Admin"] },
    ], constraints));
    expect(result.status).toBe("SAT");
    if (result.status === "SAT") expect(result.model).toEqual([
      { variable: "Enabled", value: { kind: "BOOLEAN", value: true } },
      { variable: "Role", value: { kind: "ENUM", value: "Admin" } },
    ]);
  });

  it("minimizes complete tracked rule groups in reverse source order", async () => {
    const atom = (name: string, equals: boolean): NormalizedCondition => ({
      kind: "ATOM",
      atom: { kind: "BOOLEAN", variable: name, equals },
    });
    const groups = [
      { ruleId: "R1", constraints: [atom("x", true)], consequence: { ruleId: "R1", modality: "MUST", consequence: { kind: "BOOLEAN", variable: "x", equals: true } } },
      { ruleId: "R2", constraints: [atom("y", true)], consequence: { ruleId: "R2", modality: "MUST", consequence: { kind: "BOOLEAN", variable: "y", equals: true } } },
      { ruleId: "R3", constraints: [{ kind: "ANY", conditions: [atom("x", false), atom("y", false)] }], consequence: { ruleId: "R3", modality: "MUST_NOT", consequence: { kind: "ALL", conditions: [{ kind: "BOOLEAN", variable: "x", equals: true }, { kind: "BOOLEAN", variable: "y", equals: true }] } } },
      { ruleId: "R4", constraints: [atom("z", true)], consequence: { ruleId: "R4", modality: "MUST", consequence: { kind: "BOOLEAN", variable: "z", equals: true } } },
    ] as const;
    const tracked: SolverProblem<"RULES"> = {
      kind: "SUPPORTED",
      queryId: "tracked",
      variables: [
        { kind: "BOOLEAN", name: "x" },
        { kind: "BOOLEAN", name: "y" },
        { kind: "BOOLEAN", name: "z" },
      ],
      fixedConstraints: [],
      ruleGroups: groups,
      coreTracking: "RULES",
    };
    const result = await new BrowserDeterministicSolver().solve(tracked);
    expect(result.status).toBe("UNSAT");
    if (result.status === "UNSAT") expect(result.core?.ruleIds).toEqual(["R1", "R2", "R3"]);
  });

  it("returns typed UNKNOWN reasons for unsupported theory and exhausted budgets", async () => {
    const solver = new BrowserDeterministicSolver();
    const unsupported: UnsupportedSolverProblem = {
      kind: "UNSUPPORTED",
      queryId: "unsupported",
      theory: "NONLINEAR",
      description: "x * y",
      source: null,
    };
    await expect(solver.solve(unsupported)).resolves.toMatchObject({ status: "UNKNOWN", reason: "UNSUPPORTED_THEORY" });
    await expect(solver.solve(problem([], [{ kind: "TRUE" }]), { maxSteps: 0 })).resolves.toMatchObject({ status: "UNKNOWN", reason: "RESOURCE_LIMIT" });
    const controller = new AbortController();
    controller.abort();
    await expect(solver.solve(problem([], [{ kind: "TRUE" }]), { signal: controller.signal })).resolves.toMatchObject({ status: "UNKNOWN", reason: "CANCELLED" });
  });

  it("rejects malformed tracked and variable-mismatched problems before solving", async () => {
    const solver = new BrowserDeterministicSolver();
    const oneGroup = {
      kind: "SUPPORTED",
      queryId: "bad-core",
      variables: [{ kind: "BOOLEAN", name: "x" }],
      fixedConstraints: [],
      ruleGroups: [{
        ruleId: "R1",
        constraints: [{ kind: "ATOM", atom: { kind: "BOOLEAN", variable: "x", equals: true } }],
        consequence: { ruleId: "R1", modality: "MUST", consequence: { kind: "BOOLEAN", variable: "x", equals: true } },
      }],
      coreTracking: "RULES",
    } as const;
    await expect(solver.solve(oneGroup)).rejects.toThrow(/at least two/i);
    await expect(solver.solve(problem(
      [{ kind: "BOOLEAN", name: "x" }],
      [{ kind: "ATOM", atom: { kind: "ENUM", variable: "x", operator: "EQ", value: "A" } }],
    ))).rejects.toThrow(/declaration/i);
  });
});

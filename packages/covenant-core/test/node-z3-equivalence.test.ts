import { describe, expect, it } from "vitest";
import {
  BrowserDeterministicSolver,
  evaluateNormalizedCondition,
  makeRational,
  type AnySolverResult,
  type AssignmentTable,
  type NormalizedCondition,
  type SolverProblem,
  type UnsupportedSolverProblem,
  type VariableDeclaration,
} from "../src/index.js";
import { NodeZ3Solver } from "../src/node/index.js";

const atom = (variable: string, equals: boolean): NormalizedCondition => ({
  kind: "ATOM",
  atom: { kind: "BOOLEAN", variable, equals },
});

const numeric = (
  variable: string,
  domain: "INTEGER" | "DECIMAL",
  lower?: readonly [bigint, bigint, boolean],
  upper?: readonly [bigint, bigint, boolean],
): NormalizedCondition => ({
  kind: "ATOM",
  atom: {
    kind: "NUMERIC",
    bound: {
      variable,
      domain,
      ...(lower === undefined ? {} : {
        lower: { value: makeRational(lower[0], lower[1]), inclusive: lower[2] },
      }),
      ...(upper === undefined ? {} : {
        upper: { value: makeRational(upper[0], upper[1]), inclusive: upper[2] },
      }),
    },
  },
});

function untracked(
  queryId: string,
  variables: readonly VariableDeclaration[],
  fixedConstraints: readonly NormalizedCondition[],
): SolverProblem<"NONE"> {
  return {
    kind: "SUPPORTED",
    queryId,
    variables,
    fixedConstraints,
    ruleGroups: [],
    coreTracking: "NONE",
  };
}

const tracked: SolverProblem<"RULES"> = {
  kind: "SUPPORTED",
  queryId: "tracked-canonical-core",
  variables: [
    { kind: "BOOLEAN", name: "x" },
    { kind: "BOOLEAN", name: "y" },
    { kind: "BOOLEAN", name: "z" },
  ],
  fixedConstraints: [],
  ruleGroups: [
    {
      ruleId: "R1",
      constraints: [atom("x", true)],
      consequence: {
        ruleId: "R1",
        modality: "MUST",
        consequence: { kind: "BOOLEAN", variable: "x", equals: true },
      },
    },
    {
      ruleId: "R2",
      constraints: [atom("y", true)],
      consequence: {
        ruleId: "R2",
        modality: "MUST",
        consequence: { kind: "BOOLEAN", variable: "y", equals: true },
      },
    },
    {
      ruleId: "R3",
      constraints: [{ kind: "ANY", conditions: [atom("x", false), atom("y", false)] }],
      consequence: {
        ruleId: "R3",
        modality: "MUST_NOT",
        consequence: {
          kind: "ALL",
          conditions: [
            { kind: "BOOLEAN", variable: "x", equals: true },
            { kind: "BOOLEAN", variable: "y", equals: true },
          ],
        },
      },
    },
    {
      ruleId: "R4",
      constraints: [atom("z", true)],
      consequence: {
        ruleId: "R4",
        modality: "MUST",
        consequence: { kind: "BOOLEAN", variable: "z", equals: true },
      },
    },
  ],
  coreTracking: "RULES",
};

const decisionProblems: readonly SolverProblem<"NONE">[] = [
  untracked(
    "boolean-enum-sat",
    [
      { kind: "BOOLEAN", name: "Enabled" },
      { kind: "ENUM", name: "Role", values: ["Guest", "Admin"] },
    ],
    [
      atom("Enabled", true),
      { kind: "ATOM", atom: { kind: "ENUM", variable: "Role", operator: "NEQ", value: "Guest" } },
    ],
  ),
  untracked(
    "enum-unsat",
    [{ kind: "ENUM", name: "Role", values: ["Guest", "Admin"] }],
    [
      { kind: "ATOM", atom: { kind: "ENUM", variable: "Role", operator: "EQ", value: "Guest" } },
      { kind: "ATOM", atom: { kind: "ENUM", variable: "Role", operator: "EQ", value: "Admin" } },
    ],
  ),
  untracked(
    "integer-open-gap",
    [{ kind: "NUMERIC", name: "x", domain: "INTEGER" }],
    [numeric("x", "INTEGER", [5n, 1n, false]), numeric("x", "INTEGER", undefined, [6n, 1n, false])],
  ),
  untracked(
    "decimal-open-interval",
    [{ kind: "NUMERIC", name: "x", domain: "DECIMAL" }],
    [numeric("x", "DECIMAL", [5n, 1n, false]), numeric("x", "DECIMAL", undefined, [6n, 1n, false])],
  ),
  untracked(
    "exact-third",
    [{ kind: "NUMERIC", name: "ratio", domain: "DECIMAL" }],
    [numeric("ratio", "DECIMAL", [1n, 3n, true], [1n, 3n, true])],
  ),
];

function expectReplay(problem: SolverProblem, model: AssignmentTable): void {
  const constraints = [
    ...problem.fixedConstraints,
    ...problem.ruleGroups.flatMap((group) => group.constraints),
  ];
  expect(constraints.every((condition) => evaluateNormalizedCondition(condition, model))).toBe(true);
}

async function solveBoth(
  problem: SolverProblem<"RULES"> | SolverProblem<"NONE">,
): Promise<readonly [AnySolverResult, AnySolverResult]> {
  if (problem.coreTracking === "RULES") {
    return Promise.all([
      new BrowserDeterministicSolver().solve(problem),
      new NodeZ3Solver().solve(problem),
    ]);
  }
  return Promise.all([
    new BrowserDeterministicSolver().solve(problem),
    new NodeZ3Solver().solve(problem),
  ]);
}

describe("NodeZ3Solver equivalence", () => {
  it("honors cancellation, timeout, and encoding step budgets", async () => {
    const problem = untracked("budget", [], [{ kind: "TRUE" }]);
    const controller = new AbortController();
    controller.abort();

    await expect(new NodeZ3Solver().solve(problem, { signal: controller.signal })).resolves.toMatchObject({
      status: "UNKNOWN",
      reason: "CANCELLED",
      telemetry: { solver: "NODE_Z3" },
    });
    await expect(new NodeZ3Solver().solve(problem, { timeoutMs: 0 })).resolves.toMatchObject({
      status: "UNKNOWN",
      reason: "TIMEOUT",
      telemetry: { solver: "NODE_Z3" },
    });
    await expect(new NodeZ3Solver().solve(problem, { maxSteps: 0 })).resolves.toMatchObject({
      status: "UNKNOWN",
      reason: "RESOURCE_LIMIT",
      telemetry: { solver: "NODE_Z3" },
    });
    const modelBudgetProblem = untracked(
      "model-budget",
      [
        { kind: "BOOLEAN", name: "first" },
        { kind: "BOOLEAN", name: "second" },
      ],
      [],
    );
    await expect(new NodeZ3Solver().solve(modelBudgetProblem, { maxSteps: 2 })).resolves.toMatchObject({
      status: "UNKNOWN",
      reason: "RESOURCE_LIMIT",
      telemetry: { solver: "NODE_Z3" },
    });
    const replayBudgetProblem = untracked(
      "replay-budget",
      [{ kind: "BOOLEAN", name: "flag" }],
      [{
        kind: "ALL",
        conditions: [{ kind: "TRUE" }, { kind: "TRUE" }, { kind: "TRUE" }],
      }],
    );
    await expect(new NodeZ3Solver().solve(replayBudgetProblem, { maxSteps: 11 })).resolves.toMatchObject({
      status: "UNKNOWN",
      reason: "RESOURCE_LIMIT",
      telemetry: { solver: "NODE_Z3" },
    });

    const denseVariables: readonly VariableDeclaration[] = Array.from(
      { length: 40 },
      (_, index) => ({ kind: "BOOLEAN", name: `flag-${index}` }),
    );
    const denseReplayProblem = untracked(
      "dense-replay-budget",
      denseVariables,
      denseVariables.map((variable) => atom(variable.name, true)),
    );
    await expect(new NodeZ3Solver().solve(denseReplayProblem, { maxSteps: 400 })).resolves.toMatchObject({
      status: "SAT",
      telemetry: { solver: "NODE_Z3" },
    });
  });

  it.each(decisionProblems)("matches the browser decision for $queryId and replays SAT assignments", async (problem) => {
    const [browser, node] = await solveBoth(problem);
    expect(node.status).toBe(browser.status);
    if (browser.status === "UNSAT" && node.status === "UNSAT") {
      expect(browser.core).toBeNull();
      expect(node.core).toBeNull();
    }
    if (browser.status === "SAT") expectReplay(problem, browser.model);
    if (node.status === "SAT") expectReplay(problem, node.model);
    expect(node.telemetry.solver).toBe("NODE_Z3");
  });

  it("uses the shared reverse-source minimizer for canonical tracked core IDs", async () => {
    const [browser, node] = await solveBoth(tracked);
    expect(browser.status).toBe("UNSAT");
    expect(node.status).toBe("UNSAT");
    if (browser.status === "UNSAT" && node.status === "UNSAT") {
      expect(browser.core?.ruleIds).toEqual(["R1", "R2", "R3"]);
      expect(node.core?.ruleIds).toEqual(browser.core?.ruleIds);
    }
  });

  it("returns unsupported theory without requiring Z3 initialization", async () => {
    const unsupported: UnsupportedSolverProblem = {
      kind: "UNSUPPORTED",
      queryId: "unsupported",
      theory: "NONLINEAR",
      description: "x * y",
      source: null,
    };
    await expect(new NodeZ3Solver().solve(unsupported)).resolves.toMatchObject({
      status: "UNKNOWN",
      reason: "UNSUPPORTED_THEORY",
      telemetry: { solver: "NODE_Z3", clausesChecked: 0 },
    });
  });
});

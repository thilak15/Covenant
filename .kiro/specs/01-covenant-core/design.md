# COVENANT Core Design

## Overview

`@covenant/core` is the shared Skeleton Foundation for both static applications. It owns the deterministic offline parser, exact domain model, condition normalization, browser solver, Node Z3 adapter, five Inquisitors, contradiction evidence, repairs, preservation verification, and PBT telemetry formatting.

The accepted high-level verification seam is `verifyCovenant(document, solver)`. Both applications call this seam with `BrowserDeterministicSolver`; Node tests call the same seam with `NodeZ3Solver`. Direct solver tests exist only for conformance, numeric boundaries, minimization, and browser-versus-Z3 equivalence.

No implementation exists yet, so this design establishes the first package boundary rather than adapting an older API.

## Design goals

- Give `RuleScope` and activation `Condition` one normalized expression engine.
- Preserve exact integer and decimal semantics across browser interval reasoning and Z3 Real rationals.
- Prove common applicability before reporting a Consistency contradiction.
- Return deterministic subset-minimal rule cores and replayable Phantom Witnesses.
- Keep proof verdicts independent from repair availability.
- Keep all browser exports free from Node and Z3 imports.
- Keep feature production code below 1,200 nonblank, non-comment lines.

## Architecture

```text
unknown source input
        |
        v
  offline parser ---- pre-verified sample AST
        |                        |
        +--------> CovenantDocument
                         |
                         v
                 normalize/compile
                         |
                         v
       verifyCovenant(document, CovenantSolver)
            |                            |
            |                 +----------+-----------+
            |                 |                      |
            |       BrowserDeterministicSolver   NodeZ3Solver
            |           browser-safe             Node-only
            |
            +--> five Inquisitors
            +--> Unsat Core minimizer
            +--> Phantom Witness canonicalizer
            +--> resolution synthesis
            +--> Preservation verifier
                         |
                         v
                 VerificationReport
```

The package has two public entry points:

- `@covenant/core`: browser-safe domain types, parser, browser solver, verification seam, repairs, and telemetry formatting.
- `@covenant/core/node`: `NodeZ3Solver` only. This entry may import `z3-solver`; no module reachable from the root entry may import it.

## Module boundaries

| Module | Responsibility | Allowed production imports |
| --- | --- | --- |
| `src/model.ts` | Public domain values and result unions | None |
| `src/rational.ts` | Parse, reduce, compare, serialize, and select exact rationals | `model.ts` types only |
| `src/condition.ts` | Scope compilation, condition validation, negation normalization, fingerprints, replay | `model.ts`, `rational.ts` |
| `src/parser.ts` | Deterministic EARS and structured-clause parsing with diagnostics | `model.ts`, `rational.ts`, `condition.ts` |
| `src/solver.ts` | `CovenantSolver`, normalized problem, result contract, shared core minimizer | `model.ts`, `condition.ts` |
| `src/browser-deterministic-solver.ts` | Deterministic DPLL and exact interval implementation | `model.ts`, `rational.ts`, `condition.ts`, `solver.ts` |
| `src/inquisitors.ts` | Testability, Consistency, Completeness, Unambiguity, Security, and Liveness evidence | `model.ts`, `condition.ts`, `solver.ts` |
| `src/repairs.ts` | Chalice templates, guarded edits, distinctness, and Preservation Property checks | `model.ts`, `condition.ts` |
| `src/engine.ts` | `verifyCovenant` and `applyChalicePatch` orchestration | Browser-safe modules above |
| `src/security-controls.ts` | Stable 60-CWE obligation catalog | `model.ts` types only |
| `src/pbt-stats.ts` | Typed snapshot validation and display-row formatting | `model.ts` |
| `src/generated/open-pbt-stats.json` | Seeded Node-suite snapshot consumed by static applications | Generated data only |
| `src/index.ts` | Root browser-safe exports | Browser-safe modules only |
| `src/node/node-z3-solver.ts` | Real Z3 adapter | `model.ts`, `rational.ts`, `condition.ts`, `solver.ts`, `z3-solver` |
| `src/node/index.ts` | Node subpath exports | `node-z3-solver.ts` |

`model.ts` is the dependency root. `engine.ts` is the orchestration leaf. This direction prevents production import cycles. `src/index.ts` must never export from `src/node/`.

## Source-line budget

The hard gate counts nonblank, non-comment hand-written lines in production `.ts` and `.tsx` files under `packages/covenant-core`. Tests, generated declarations, and the generated OpenPBTStats JSON snapshot are excluded. The package-wide budget reserves space for the later shared Tribunal UI while keeping the final package below 1,200 lines:

| Area | Target maximum |
| --- | ---: |
| Domain model | 120 |
| Rational and condition normalization | 135 |
| Solver contract and browser solver | 190 |
| Inquisitors and engine | 170 |
| Parser | 65 |
| Repairs and preservation | 75 |
| Security catalog, PBT formatting, exports | 45 |
| Node Z3 adapter | 55 |
| Reserved for `src/tribunal-ui/` | 275 |
| **Planned package total** | **1,130** |
| **Contingency below the 1,200-line gate** | **69** |

These are caps, not quotas. Shared helpers remain small and purpose-specific. Tests may be extensive because they do not count against the production limit.

The implementation adds `packages/covenant-core/scripts/check-loc.mjs`. It walks `src/**/*.ts` and `src/**/*.tsx`, including `src/tribunal-ui/`, excludes `src/generated/**`, `*.d.ts`, and `*.test.*`, and uses the TypeScript scanner to count physical lines containing at least one non-comment token. The script fails at 1,200 or more lines and runs from the package `build` and root `typecheck` commands. Generated TypeScript is permitted only under `src/generated/`; generated JSON snapshots remain excluded data.

## Exact TypeScript domain contract

All public collections are readonly. Constructors and parser boundaries validate semantic invariants that TypeScript cannot express, including unique IDs, positive rational denominators, reduced fractions, nonempty enum domains, valid source spans, and at least two rules in a Consistency core.

```ts
export type RuleId = string;
export type QueryId = string;
export type FindingId = string;
export type VariableName = string;
export type DocumentRevision = string;
export const CWE_CONTROL_IDS = [
  "CWE-20", "CWE-22", "CWE-23", "CWE-59", "CWE-73", "CWE-74",
  "CWE-77", "CWE-78", "CWE-79", "CWE-89", "CWE-94", "CWE-113",
  "CWE-116", "CWE-117", "CWE-119", "CWE-120", "CWE-125", "CWE-129",
  "CWE-134", "CWE-190", "CWE-200", "CWE-203", "CWE-208", "CWE-209",
  "CWE-269", "CWE-276", "CWE-284", "CWE-285", "CWE-287", "CWE-288",
  "CWE-290", "CWE-294", "CWE-295", "CWE-306", "CWE-307", "CWE-311",
  "CWE-312", "CWE-319", "CWE-326", "CWE-327", "CWE-330", "CWE-345",
  "CWE-346", "CWE-352", "CWE-362", "CWE-384", "CWE-400", "CWE-434",
  "CWE-502", "CWE-522", "CWE-532", "CWE-601", "CWE-611", "CWE-732",
  "CWE-798", "CWE-862", "CWE-863", "CWE-918", "CWE-922", "CWE-943",
] as const;
export type CweControlId = (typeof CWE_CONTROL_IDS)[number];
export type NonEmpty<T> = readonly [T, ...T[]];
export type AtLeastTwo<T> = readonly [T, T, ...T[]];

export type DeonticModality = "MUST" | "MUST_NOT" | "MAY";
export type NumericDomain = "INTEGER" | "DECIMAL";
export type Inquisitor =
  | "TESTABILITY"
  | "CONSISTENCY"
  | "COMPLETENESS"
  | "UNAMBIGUITY"
  | "SECURITY_LIVENESS";
export type VerdictStatus = "PASS" | "FAIL" | "UNKNOWN";

export interface CanonicalRational {
  readonly numerator: bigint;
  readonly denominator: bigint;
}

export interface SerializedRational {
  readonly numerator: string;
  readonly denominator: string;
}

export interface SourcePosition {
  readonly offset: number;
  readonly line: number;
  readonly column: number;
}

export interface SourceLocation {
  readonly documentId: string;
  readonly clauseRef: string;
  readonly start: SourcePosition;
  readonly end: SourcePosition;
}

export interface NumericEndpoint {
  readonly value: CanonicalRational;
  readonly inclusive: boolean;
}

export interface NumericRange {
  readonly lower?: NumericEndpoint;
  readonly upper?: NumericEndpoint;
}

export interface NumericBound extends NumericRange {
  readonly variable: VariableName;
  readonly domain: NumericDomain;
}

export type Condition =
  | { readonly kind: "TRUE" }
  | { readonly kind: "FALSE" }
  | {
      readonly kind: "BOOLEAN";
      readonly variable: VariableName;
      readonly equals: boolean;
    }
  | {
      readonly kind: "ENUM";
      readonly variable: VariableName;
      readonly operator: "EQ" | "NEQ";
      readonly value: string;
    }
  | { readonly kind: "NUMERIC"; readonly bound: NumericBound }
  | { readonly kind: "ALL"; readonly conditions: NonEmpty<Condition> }
  | { readonly kind: "ANY"; readonly conditions: NonEmpty<Condition> }
  | { readonly kind: "NOT"; readonly condition: Condition };

export interface ScopeFacet {
  readonly variable: VariableName;
  readonly values: NonEmpty<string>;
}

export interface RuleScope {
  readonly actors: readonly ScopeFacet[];
  readonly resources: readonly ScopeFacet[];
  readonly actions: readonly ScopeFacet[];
  readonly context: Condition;
}

export interface Rule {
  readonly id: RuleId;
  readonly source: SourceLocation;
  readonly scope: RuleScope;
  readonly activation: Condition;
  readonly modality: DeonticModality;
  readonly consequence: Condition;
}

export type ScalarValue =
  | { readonly kind: "BOOLEAN"; readonly value: boolean }
  | { readonly kind: "ENUM"; readonly value: string }
  | { readonly kind: "INTEGER"; readonly value: bigint }
  | { readonly kind: "DECIMAL"; readonly value: CanonicalRational };

export interface VariableAssignment {
  readonly variable: VariableName;
  readonly value: ScalarValue;
}

export type AssignmentTable = readonly VariableAssignment[];

export type VariableDeclaration =
  | { readonly kind: "BOOLEAN"; readonly name: VariableName }
  | {
      readonly kind: "ENUM";
      readonly name: VariableName;
      readonly values: NonEmpty<string>;
    }
  | {
      readonly kind: "NUMERIC";
      readonly name: VariableName;
      readonly domain: NumericDomain;
      readonly range?: NumericRange;
    };

export interface PrimaryWorkflow {
  readonly id: string;
  readonly label: string;
  readonly entry: Condition;
  readonly requiredConsequences: NonEmpty<Condition>;
}

export type UnsupportedTheory =
  | "VARIABLE_ARITHMETIC"
  | "NONLINEAR"
  | "QUANTIFIER"
  | "OTHER";

export interface UnsupportedConstruct {
  readonly theory: UnsupportedTheory;
  readonly description: string;
  readonly source: SourceLocation;
}

export interface SourceDocument {
  readonly id: string;
  readonly revision: DocumentRevision;
  readonly format: "EARS" | "CLAUSE";
  readonly text: string;
}

export interface CovenantDocument {
  readonly source: SourceDocument;
  readonly variables: readonly VariableDeclaration[];
  readonly rules: readonly Rule[];
  readonly primaryWorkflows: readonly PrimaryWorkflow[];
  readonly unsupportedConstructs: readonly UnsupportedConstruct[];
}
```

### Source coordinate rules

- `offset` is a zero-based UTF-16 code-unit offset, matching JavaScript string slicing.
- `line` and `column` are one-based display coordinates.
- `end` is exclusive.
- `clauseRef` is stable within a document revision.
- A parser result with duplicate rule IDs, overlapping invalid spans, undeclared variables, empty enum domains, or invalid rationals is rejected before solving.

## Normalized condition contract

`Condition` preserves authoring structure. Solvers consume `NormalizedCondition`, which removes general `NOT`, flattens nested conjunctions and disjunctions, removes identities, preserves source-stable atom order, and keeps exact endpoints.

```ts
export type NormalizedAtom =
  | {
      readonly kind: "BOOLEAN";
      readonly variable: VariableName;
      readonly equals: boolean;
    }
  | {
      readonly kind: "ENUM";
      readonly variable: VariableName;
      readonly operator: "EQ" | "NEQ";
      readonly value: string;
    }
  | { readonly kind: "NUMERIC"; readonly bound: NumericBound };

export type NormalizedCondition =
  | { readonly kind: "TRUE" }
  | { readonly kind: "FALSE" }
  | { readonly kind: "ATOM"; readonly atom: NormalizedAtom }
  | {
      readonly kind: "ALL";
      readonly conditions: NonEmpty<NormalizedCondition>;
    }
  | {
      readonly kind: "ANY";
      readonly conditions: NonEmpty<NormalizedCondition>;
    };

export interface TriggeredConsequence {
  readonly ruleId: RuleId;
  readonly modality: DeonticModality;
  readonly consequence: Condition;
}

export interface CompiledRule {
  readonly id: RuleId;
  readonly source: SourceLocation;
  readonly applicability: NormalizedCondition;
  readonly hardConsequence: NormalizedCondition | null;
  readonly permission: NormalizedCondition | null;
  readonly triggeredConsequence: TriggeredConsequence;
}
```

Compilation applies these modality rules:

- `applicability = normalize(scopeCondition AND activation)`.
- `MUST` sets `hardConsequence` to the normalized consequence and `permission` to `null`.
- `MUST_NOT` sets `hardConsequence` to the normalized negation of the consequence and `permission` to `null`.
- `MAY` sets `hardConsequence` to `null` and `permission` to the normalized consequence.

The closed `Condition` union contains only the supported theory. When the parser recognizes valid syntax for variable arithmetic, nonlinear arithmetic, quantification, or another excluded theory, the compiler produces an `UnsupportedSolverProblem` carrying provenance instead of inventing a `Condition`. Both solvers return `UNKNOWN/UNSUPPORTED_THEORY` for that problem. Syntax errors remain parser rejections.

Each `ScopeFacet` compiles to an `ANY` of enum equalities for its declared values. All actor, resource, and action facets and the scope context compile into one `ALL`. Empty facet arrays contribute `TRUE`.

## Exact rational rules

`CanonicalRational` has these runtime invariants:

- `denominator > 0`.
- `gcd(abs(numerator), denominator) = 1`.
- Zero is always `0/1`.
- A base-10 literal is parsed from its sign, integer digits, fractional digits, and exponent directly into `BigInt` values.
- Neither parsing nor comparison converts through `number`.
- JSON uses `SerializedRational`; both fields are canonical base-10 integer strings.

For interval intersection:

- The greater lower endpoint wins; equal lower endpoints are inclusive only when both are inclusive.
- The lesser upper endpoint wins; equal upper endpoints are inclusive only when both are inclusive.
- A decimal interval is empty when lower is greater than upper, or when equal endpoints are not both inclusive.
- An integer interval is additionally empty when no integer remains after applying strictness and exact ceiling/floor operations.
- Negating an interval creates the normalized disjunction of its lower and upper complements.

## CovenantSolver contract

```ts
export interface SolverRuleGroup {
  readonly ruleId: RuleId;
  readonly constraints: NonEmpty<NormalizedCondition>;
  readonly consequence: TriggeredConsequence;
}

export type CoreTracking = "RULES" | "NONE";

export interface SupportedSolverProblem<
  T extends CoreTracking = CoreTracking,
> {
  readonly kind: "SUPPORTED";
  readonly queryId: QueryId;
  readonly variables: readonly VariableDeclaration[];
  readonly fixedConstraints: readonly NormalizedCondition[];
  readonly ruleGroups: readonly SolverRuleGroup[];
  readonly coreTracking: T;
}

export interface UnsupportedSolverProblem {
  readonly kind: "UNSUPPORTED";
  readonly queryId: QueryId;
  readonly theory: UnsupportedTheory;
  readonly description: string;
  readonly source: SourceLocation | null;
}

export type SolverProblem<T extends CoreTracking = CoreTracking> =
  SupportedSolverProblem<T>;

export type CovenantProblem =
  | SolverProblem<CoreTracking>
  | UnsupportedSolverProblem;

export interface UnsatCore {
  readonly queryId: QueryId;
  readonly ruleIds: AtLeastTwo<RuleId>;
  readonly incompatibleConsequences: readonly TriggeredConsequence[];
}

export interface PhantomWitness {
  readonly queryId: QueryId;
  readonly coreRuleIds: AtLeastTwo<RuleId>;
  readonly assignments: AssignmentTable;
  readonly triggeredConsequences: NonEmpty<TriggeredConsequence>;
}

export interface VerificationTelemetry {
  readonly solver: "BROWSER_DETERMINISTIC" | "NODE_Z3";
  readonly elapsedMs: number;
  readonly clausesChecked: number;
}

export type SolverUnknownReason =
  | "UNSUPPORTED_THEORY"
  | "TIMEOUT"
  | "RESOURCE_LIMIT"
  | "CANCELLED";

export interface SolveOptions {
  readonly timeoutMs?: number;
  readonly maxSteps?: number;
  readonly signal?: AbortSignal;
}

export interface SolverSat {
  readonly status: "SAT";
  readonly model: AssignmentTable;
  readonly telemetry: VerificationTelemetry;
}

export interface SolverUnknown {
  readonly status: "UNKNOWN";
  readonly reason: SolverUnknownReason;
  readonly telemetry: VerificationTelemetry;
}

export interface TrackedSolverUnsat {
  readonly status: "UNSAT";
  readonly core: UnsatCore;
  readonly telemetry: VerificationTelemetry;
}

export interface UntrackedSolverUnsat {
  readonly status: "UNSAT";
  readonly core: null;
  readonly telemetry: VerificationTelemetry;
}

export type SolverResult<T extends CoreTracking = CoreTracking> =
  | SolverSat
  | SolverUnknown
  | (T extends "RULES" ? TrackedSolverUnsat : UntrackedSolverUnsat);

export interface CovenantSolver {
  solve(
    problem: UnsupportedSolverProblem,
    options?: SolveOptions,
  ): Promise<SolverUnknown>;
  solve(
    problem: SolverProblem<"RULES">,
    options?: SolveOptions,
  ): Promise<SolverResult<"RULES">>;
  solve(
    problem: SolverProblem<"NONE">,
    options?: SolveOptions,
  ): Promise<SolverResult<"NONE">>;
  solve(
    problem: CovenantProblem,
    options?: SolveOptions,
  ): Promise<SolverSat | SolverUnknown | TrackedSolverUnsat | UntrackedSolverUnsat>;
}

export declare class BrowserDeterministicSolver implements CovenantSolver {
  solve(
    problem: UnsupportedSolverProblem,
    options?: SolveOptions,
  ): Promise<SolverUnknown>;
  solve(
    problem: SolverProblem<"RULES">,
    options?: SolveOptions,
  ): Promise<SolverResult<"RULES">>;
  solve(
    problem: SolverProblem<"NONE">,
    options?: SolveOptions,
  ): Promise<SolverResult<"NONE">>;
  solve(
    problem: CovenantProblem,
    options?: SolveOptions,
  ): Promise<SolverSat | SolverUnknown | TrackedSolverUnsat | UntrackedSolverUnsat>;
}
```

The Node-only entry point exposes the conforming adapter:

```ts
export declare class NodeZ3Solver implements CovenantSolver {
  solve(
    problem: UnsupportedSolverProblem,
    options?: SolveOptions,
  ): Promise<SolverUnknown>;
  solve(
    problem: SolverProblem<"RULES">,
    options?: SolveOptions,
  ): Promise<SolverResult<"RULES">>;
  solve(
    problem: SolverProblem<"NONE">,
    options?: SolveOptions,
  ): Promise<SolverResult<"NONE">>;
  solve(
    problem: CovenantProblem,
    options?: SolveOptions,
  ): Promise<SolverSat | SolverUnknown | TrackedSolverUnsat | UntrackedSolverUnsat>;
}
```

### SolverProblem invariants

- Variable names are unique and source ordered.
- Every atom references a declared variable of the matching kind.
- Fixed constraints remain present during core minimization.
- Every constraint emitted from one `Rule` stays inside one `SolverRuleGroup`.
- Rule groups remain source ordered.
- `coreTracking: "RULES"` requires at least two rule groups, requires fixed constraints alone to be `SAT`, requires fixed constraints plus each individual group to be `SAT`, and returns a non-null core on `UNSAT`.
- `coreTracking: "NONE"` is used for decision queries such as completeness coverage and returns `core: null` on `UNSAT`.
- Consistency contradiction queries use `coreTracking: "RULES"`.
- A returned Consistency `UnsatCore` contains at least two unique rule IDs in source order.

The verifier, rather than either solver adapter, enforces the Consistency-specific invariants before invoking the solver.

## BrowserDeterministicSolver algorithm

1. Return `UNKNOWN/UNSUPPORTED_THEORY` immediately for an `UnsupportedSolverProblem`; otherwise validate declarations before search.
2. Use stable source order for variables, atoms, rule groups, and DPLL branches.
3. Treat Boolean and enum predicates as finite-domain propositions. Enum declarations enforce exactly one declared value.
4. Carry one exact interval per numeric variable in each branch.
5. Intersect numeric bounds whenever DPLL assigns a numeric atom; backtrack immediately on an empty interval.
6. Normalize numeric complements into Boolean branches rather than representing disjoint intervals as one interval.
7. Return `UNKNOWN` when search exceeds `maxSteps`, `timeoutMs`, or cancellation.
8. Construct SAT values by replaying the final branch against the original normalized constraints.
9. Count evaluated normalized clauses and measure only solve time in `VerificationTelemetry`.

The browser benchmark uses a production build and native `performance.now()`. For each Cursed Sample Scroll it measures the first verification immediately after solver construction and 20 subsequent calls. The acceptance matrix covers current stable Chromium, Firefox, and WebKit on an Apple M1-class reference machine or faster, with developer tools closed; every individual solve must remain below 15 ms. The report records browser engine, version, hardware, first-call latency, warm-call maximum, and sample ID.

## NodeZ3Solver algorithm and isolation

- Return `UNKNOWN/UNSUPPORTED_THEORY` without initializing Z3 for an `UnsupportedSolverProblem`.
- Initialize `z3-solver` asynchronously inside `src/node/node-z3-solver.ts`.
- Encode Boolean and enum predicates with Z3 Bool values plus exactly-one constraints for enum domains.
- Encode integer variables as Z3 Int and decimal variables as Z3 Real.
- Encode each canonical rational as the exact quotient of its numerator and denominator.
- Track source rule groups, but run the shared reverse-source core minimizer so both adapters return the same canonical rule IDs instead of trusting backend-specific core choice.
- Replay every returned SAT assignment against `NormalizedCondition` before returning it.
- Allow adapter initialization or execution faults to reject the promise. `verifyCovenant` catches those faults and emits `UNKNOWN` with `ADAPTER_FAILURE` while retaining independent failures.

The package export map exposes `.` universally and exposes `./node` only under the Node export condition. Browser Vite source is scanned to reject direct `@covenant/core/node` imports. Bundle tests cover a root-entry fixture and both final application builds, and fail if any browser module graph or output contains `z3-solver`, Node built-ins, `.wasm`, `SharedArrayBuffer`, or `NodeZ3Solver`.

## Consistency verification

Candidate discovery is deterministic and complete for the supported fragment:

1. Extract variables referenced by each rule's applicability and hard consequence.
2. Build a rule graph with an edge when either rule's hard consequence shares a variable with the other rule's applicability or hard consequence. Applicability-only overlap does not create an edge.
3. Process connected components by their earliest source position.
4. Enumerate each component's rule subsets by increasing cardinality and then lexicographic source order, beginning at cardinality two.
5. Skip a superset after an already discovered subset-minimal core is contained within it; that core is already represented, and any different minimal core is enumerated as its own subset.
6. Deduplicate emitted cores by their source-ordered rule-ID sequence.
7. Return `UNKNOWN` for the Consistency Inquisitor if a configured candidate or solve budget is exhausted before all subsets are classified, unless a proven core already makes the verdict `FAIL`; in that case retain `FAIL` and record the budget reason in `unresolved`.

For each candidate subset of interacting hard rules:

1. Build the **applicability query** from variable-domain constraints and one atomic rule group per `CompiledRule.applicability`.
2. Solve applicability.
3. Stop without a Consistency finding when applicability is `UNSAT`; the rules are mutually exclusive.
4. Propagate `UNKNOWN` without claiming a contradiction when applicability cannot be decided.
5. Retain the canonical SAT assignment when applicability is `SAT`.
6. Build the **contradiction query** by adding each rule's `hardConsequence` to its existing atomic rule group.
7. Stop without a Consistency finding when the contradiction query remains `SAT`.
8. Minimize the candidate groups when the contradiction query is `UNSAT`.
9. Re-solve the minimized core's applicability and canonicalize that SAT model into the Phantom Witness.
10. Emit a Consistency `FAIL` only after both common applicability and incompatible consequences are proven.

`MAY` rules do not enter a hard contradiction query. The Unambiguity Inquisitor separately checks overlapping `MAY X` and `MUST_NOT X`.

## Unsat Core minimization

The shared minimizer is backend-independent:

1. Start with source-ordered candidate rule groups from the failing contradiction query.
2. Traverse candidates from the final source position to the first.
3. Temporarily remove the complete rule group, retaining all fixed constraints.
4. Permanently remove the group when the reduced query remains `UNSAT`.
5. Restore it when the reduced query becomes `SAT` or `UNKNOWN`.
6. Return remaining IDs in source order.
7. Recheck each member by removal before accepting the core.

The result is deterministic and subset-minimal. It is not guaranteed to have minimum cardinality. An internally impossible single rule is rejected from Consistency and routed to validation or Testability evidence.

## Phantom Witness canonicalization

A Phantom Witness is never requested from the `UNSAT` consequence query. The verifier solves the minimized core's applicability query and projects the model to variables referenced by its scopes and activations.

Variables are ordered by declaration, then name as a deterministic tie-breaker. Boolean values use `false` before `true`; enums use declared value order. Numeric candidates are tested through additional satisfiability probes in this order:

1. Included finite endpoints, ordered by absolute value and then numeric value.
2. Zero.
3. Positive integers in ascending order.
4. The midpoint of finite endpoints.
5. The nearest exact rational derived from an open endpoint.

The first candidate that preserves satisfiability is selected. After all assignments are chosen, the witness is replayed against every core applicability condition. Failure to activate every core rule invalidates the evidence and yields `UNKNOWN`, never `FAIL`.

## Inquisitor and report contract

```ts
export type ChaliceA = ChalicePatch & { readonly slot: "A" };
export type ChaliceB = ChalicePatch & { readonly slot: "B" };
export type UnpairedChalicePatch = ChalicePatch & { readonly slot: null };
export type ChalicePair = readonly [ChaliceA, ChaliceB];

export type PairResolution = {
  readonly kind: "pair";
  readonly patches: ChalicePair;
};

export type ResolutionPayload =
  | PairResolution
  | {
      readonly kind: "single";
      readonly patch: UnpairedChalicePatch;
      readonly reason: string;
    }
  | { readonly kind: "manual"; readonly reason: string };

export interface TestabilityEvidence {
  readonly kind: "TESTABILITY";
  readonly source: SourceLocation;
  readonly terms: NonEmpty<string>;
}

export interface ConsistencyEvidence {
  readonly kind: "CONSISTENCY";
  readonly core: UnsatCore;
  readonly witness: PhantomWitness;
}

export interface CompletenessEvidence {
  readonly kind: "COMPLETENESS";
  readonly assignments: AssignmentTable;
}

export interface UnambiguityEvidence {
  readonly kind: "UNAMBIGUITY";
  readonly ruleIds: AtLeastTwo<RuleId>;
  readonly overlap: Condition;
}

export interface SecurityEvidence {
  readonly kind: "SECURITY_LIVENESS";
  readonly category: "SECURITY";
  readonly controlId: CweControlId;
  readonly governedSource: SourceLocation;
  readonly ruleIds: readonly RuleId[];
  readonly assignments: AssignmentTable;
}

export interface LivenessEvidence {
  readonly kind: "SECURITY_LIVENESS";
  readonly category: "LIVENESS";
  readonly workflowId: string;
  readonly governedSource: SourceLocation;
  readonly ruleIds: NonEmpty<RuleId>;
  readonly assignments: AssignmentTable;
}

export type SecurityLivenessEvidence =
  | SecurityEvidence
  | LivenessEvidence;

export interface EvidenceByInquisitor {
  readonly TESTABILITY: TestabilityEvidence;
  readonly CONSISTENCY: ConsistencyEvidence;
  readonly COMPLETENESS: CompletenessEvidence;
  readonly UNAMBIGUITY: UnambiguityEvidence;
  readonly SECURITY_LIVENESS: SecurityLivenessEvidence;
}

export interface FindingBase<I extends Inquisitor> {
  readonly id: FindingId;
  readonly patternId: string;
  readonly title: string;
  readonly message: string;
  readonly evidence: EvidenceByInquisitor[I];
}

export type PairRequiredInquisitor =
  | "CONSISTENCY"
  | "UNAMBIGUITY"
  | "SECURITY_LIVENESS";

export type StandardResolution<I extends Inquisitor> =
  I extends PairRequiredInquisitor ? PairResolution : ResolutionPayload;

export type Finding<I extends Inquisitor> = FindingBase<I> &
  (
    | {
        readonly support: "STANDARD";
        readonly resolution: StandardResolution<I>;
      }
    | {
        readonly support: "CUSTOM";
        readonly resolution: ResolutionPayload;
      }
  );

export type VerificationUnknownReason =
  | SolverUnknownReason
  | "ADAPTER_FAILURE"
  | "INVALID_EVIDENCE";

export type InquisitorVerdict<I extends Inquisitor> =
  | {
      readonly inquisitor: I;
      readonly status: "PASS";
      readonly findings: readonly [];
      readonly unresolved: readonly [];
    }
  | {
      readonly inquisitor: I;
      readonly status: "FAIL";
      readonly findings: NonEmpty<Finding<I>>;
      readonly unresolved: readonly VerificationUnknownReason[];
    }
  | {
      readonly inquisitor: I;
      readonly status: "UNKNOWN";
      readonly findings: readonly [];
      readonly unresolved: NonEmpty<VerificationUnknownReason>;
    };

export type FiveInquisitorVerdicts = readonly [
  InquisitorVerdict<"TESTABILITY">,
  InquisitorVerdict<"CONSISTENCY">,
  InquisitorVerdict<"COMPLETENESS">,
  InquisitorVerdict<"UNAMBIGUITY">,
  InquisitorVerdict<"SECURITY_LIVENESS">,
];

export interface VerificationReport {
  readonly documentId: string;
  readonly revision: DocumentRevision;
  readonly verdicts: FiveInquisitorVerdicts;
  readonly telemetry: readonly VerificationTelemetry[];
  readonly certifiable: boolean;
}

export function verifyCovenant(
  document: CovenantDocument,
  solver: CovenantSolver,
  options?: SolveOptions,
): Promise<VerificationReport>;
```

The verdict tuple statically fixes the order as Testability, Consistency, Completeness, Unambiguity, and Security & Liveness. Aggregation precedence is `FAIL` over `UNKNOWN` over `PASS`: a property with any proven finding remains `FAIL` and records undecidable sibling checks in `unresolved`; `UNKNOWN` is allowed only when that property has no proven finding. `certifiable` is true only when all five statuses are `PASS`.

`patternId` is resolved against a checked-in standard-pattern registry. Finding constructors permit `support: "STANDARD"` only for registered IDs. The conditional `StandardResolution` type requires a `PairResolution` for standard Consistency, Unambiguity, and Security & Liveness findings; custom findings always carry one of `pair`, `single`, or `manual`. A `single` patch is statically unpaired with `slot: null`.

### Five Inquisitors

- **Testability:** deterministic lexicon and measurable-condition checks identify vague or subjective terms. Internally impossible singleton rules are routed here or to parser diagnostics.
- **Consistency:** uses the two-query proof, core minimization, and Phantom Witness process above.
- **Completeness:** solves the declared input domain conjoined with the negation of every rule applicability and fallback. A SAT model is the concrete uncovered assignment.
- **Unambiguity:** solves applicability overlap and compares modal meaning. It includes `MAY` versus `MUST_NOT` overlap without treating permission as a hard consequence.
- **Security & Liveness:** evaluates a stable 60-entry CWE obligation catalog, then checks whether cumulative restrictions make each declared `PrimaryWorkflow` impossible. Security and Liveness findings share one header verdict but retain their evidence category.

The security catalog is data-driven. Its checked-in manifest is normative: each entry contains a stable ID, official title, applicability `Condition`, required-obligation `Condition`, evidence message, and two standard repair strategy IDs. The version-one manifest contains exactly these 60 unique controls:

```text
CWE-20, CWE-22, CWE-23, CWE-59, CWE-73, CWE-74, CWE-77, CWE-78,
CWE-79, CWE-89, CWE-94, CWE-113, CWE-116, CWE-117, CWE-119,
CWE-120, CWE-125, CWE-129, CWE-134, CWE-190, CWE-200, CWE-203,
CWE-208, CWE-209, CWE-269, CWE-276, CWE-284, CWE-285, CWE-287,
CWE-288, CWE-290, CWE-294, CWE-295, CWE-306, CWE-307, CWE-311,
CWE-312, CWE-319, CWE-326, CWE-327, CWE-330, CWE-345, CWE-346,
CWE-352, CWE-362, CWE-384, CWE-400, CWE-434, CWE-502, CWE-522,
CWE-532, CWE-601, CWE-611, CWE-732, CWE-798, CWE-862, CWE-863,
CWE-918, CWE-922, CWE-943
```

```ts
export interface CweControl {
  readonly id: CweControlId;
  readonly title: string;
  readonly appliesWhen: Condition;
  readonly requiredObligation: Condition;
  readonly evidenceMessage: string;
  readonly repairStrategyIds: readonly [string, string];
}

export const cweControls: readonly CweControl[];
```

Catalog conformance tests assert the exact ID sequence, titles, unique IDs, formally evaluable applicability and obligation conditions, and one independently authored positive and negative fixture per control. This prevents an implementation from satisfying the requirement with a count-only placeholder.

A control is applicable when its `appliesWhen` condition can hold in the declared document domain for a governed operation. Its obligation is satisfied only when the governed rules entail `requiredObligation`: the query `domain AND control applicability AND governed operation applicability AND NOT(required obligation)` must be `UNSAT`. A `SAT` model is a concrete Security gap witness. An `UNKNOWN` entailment query yields unresolved Security evidence and cannot be treated as satisfied.

## Parser contract

```ts
export interface ParseDiagnostic {
  readonly code: string;
  readonly severity: "ERROR" | "WARNING";
  readonly message: string;
  readonly location: SourceLocation | null;
}

export type ParseResult =
  | {
      readonly status: "PARSED";
      readonly document: CovenantDocument;
      readonly diagnostics: readonly ParseDiagnostic[];
    }
  | {
      readonly status: "REJECTED";
      readonly source: SourceDocument | null;
      readonly diagnostics: NonEmpty<ParseDiagnostic>;
    };

export type DocumentValidationResult =
  | {
      readonly status: "VALID";
      readonly document: CovenantDocument;
      readonly diagnostics: readonly ParseDiagnostic[];
    }
  | {
      readonly status: "INVALID";
      readonly diagnostics: NonEmpty<ParseDiagnostic>;
    };

export interface ParseRequest {
  readonly source: SourceDocument;
  readonly declaredVariables: readonly VariableDeclaration[];
  readonly primaryWorkflows: readonly PrimaryWorkflow[];
}

export function parseOffline(input: unknown): ParseResult;
export function validateCovenantDocument(
  input: unknown,
): DocumentValidationResult;
```

The parser supports deterministic EARS and structured legal-clause forms. It does not call an LLM or network. Malformed or unrecognized prose remains in `SourceDocument.text` and receives diagnostics rather than fabricated rules. Syntactically recognized but unsupported theory returns `PARSED` with an `UnsupportedConstruct` carrying exact provenance; compilation converts it to `UnsupportedSolverProblem`, and verification reports `UNKNOWN/UNSUPPORTED_THEORY`. Pre-verified sample ASTs use `validateCovenantDocument` and bypass parsing.

## Chalice and preservation contract

```ts
export interface RepairCore {
  readonly id: string;
  readonly findingId: FindingId;
  readonly ruleIds: NonEmpty<RuleId>;
}

export interface SourceEdit {
  readonly ruleId: RuleId;
  readonly startOffset: number;
  readonly endOffset: number;
  readonly expectedText: string;
  readonly replacementText: string;
}

export interface RuleFingerprint {
  readonly ruleId: RuleId;
  readonly sourceFingerprint: string;
  readonly semanticFingerprint: string;
}

export interface PreservationProof {
  readonly conflictFixed: true;
  readonly repairCoreId: string;
  readonly conflictRuleIds: NonEmpty<RuleId>;
  readonly preservedRules: readonly RuleFingerprint[];
  readonly preservationPercent: 100;
}

export interface ChalicePatch {
  readonly id: string;
  readonly findingId: FindingId;
  readonly repairCore: RepairCore;
  readonly slot: "A" | "B" | null;
  readonly strategy: string;
  readonly sourceRevision: DocumentRevision;
  readonly targetRuleIds: NonEmpty<RuleId>;
  readonly edits: NonEmpty<SourceEdit>;
  readonly resultingSemanticFingerprint: string;
  readonly proof: PreservationProof;
}

export type PatchRejectionReason =
  | "STALE_REVISION"
  | "SOURCE_MISMATCH"
  | "EDIT_OUTSIDE_CORE"
  | "TARGET_NOT_FIXED"
  | "PRESERVATION_FAILED"
  | "REVERIFICATION_UNKNOWN";

export type PatchApplicationResult =
  | {
      readonly status: "APPLIED";
      readonly document: CovenantDocument;
      readonly report: VerificationReport;
      readonly proof: PreservationProof;
    }
  | {
      readonly status: "REJECTED";
      readonly reason: PatchRejectionReason;
    };

export function applyChalicePatch(
  document: CovenantDocument,
  patch: ChalicePatch,
  solver: CovenantSolver,
  options?: SolveOptions,
): Promise<PatchApplicationResult>;
```

A `RepairCore` is immutable evidence authorizing a patch. Consistency uses the original Unsat Core rule IDs. Unambiguity and Liveness use their involved rule IDs. A missing Security obligation uses the existing governed operation rule as its Repair Core and rewrites that rule to add the obligation. If custom input provides no governed rule that can be safely rewritten, its Resolution Payload is `manual`.

A `pair` is valid only when:

- Its `ChalicePair` is statically ordered as an A patch followed by a B patch.
- Both patches identify the same finding, Repair Core, and source revision.
- Every edit targets a rule ID in the Repair Core.
- Both patches remove the target finding, introduce no new finding fingerprint, and make every proof required for that repair decisive; unrelated pre-existing findings may remain.
- Their normalized post-patch semantic fingerprints differ.
- Every original rule in `~C` has the same source and semantic fingerprint before and after.

Standard Consistency, Unambiguity, Security, and Liveness templates and all six Cursed Sample Scrolls must produce `pair`. Custom input may produce `pair`, `single`, or `manual`. Resolution synthesis never mutates a `FAIL` verdict.

Fingerprints are collision-free canonical strings rather than opaque hashes. `sourceFingerprint` is the exact source slice for the rule. `semanticFingerprint` serializes only normalized scope, activation, modality, and consequence; it excludes rule ID and source coordinates, reduces rationals, removes duplicate terms, and sorts commutative `ALL`/`ANY` children and scope values by their canonical serialization. A finding fingerprint serializes its Inquisitor, pattern ID, governed source, involved rule IDs, and normalized evidence. A patch's `resultingSemanticFingerprint` is the canonical serialization of its complete post-patch rule sequence. Preservation, pair distinctness, and new-finding detection compare these strings directly.

Edits are applied from highest offset to lowest after every `expectedText` guard is checked against the declared source revision. Any failed guard rejects the complete patch without partial mutation.

## OpenPBTStats contract

```ts
export type PBTProperty =
  | "SOUNDNESS"
  | "PRESERVATION"
  | "SOLVER_EQUIVALENCE";

export interface EdgeCaseCount {
  readonly tag: string;
  readonly count: number;
}

export interface OpenPBTStats<
  P extends PBTProperty = PBTProperty,
> {
  readonly property: P;
  readonly requestedRuns: number;
  readonly successfulRuns: number;
  readonly edgeCases: readonly EdgeCaseCount[];
  readonly duplicateRuns: number;
  readonly discardedRuns: number;
  readonly seed: number;
  readonly durationMs: number;
}

export interface OpenPBTSnapshot {
  readonly suiteVersion: string;
  readonly properties: readonly [
    OpenPBTStats<"SOUNDNESS">,
    OpenPBTStats<"PRESERVATION">,
    OpenPBTStats<"SOLVER_EQUIVALENCE">,
  ];
}

export interface TelemetryRow {
  readonly label: string;
  readonly value: string;
}

export const openPBTStatsSnapshot: OpenPBTSnapshot;

export function formatOpenPBTStats(
  stats: OpenPBTStats,
): readonly TelemetryRow[];

export function formatVerificationTelemetry(
  telemetry: VerificationTelemetry,
): readonly TelemetryRow[];
```

The snapshot property order is Soundness, Preservation, Solver Equivalence. The Node suite writes the JSON snapshot from a fixed reported seed. A duplicate is a successful case whose normalized-problem fingerprint appeared earlier in the same property run. Discarded cases never increment `successfulRuns`. PBT statistics and live telemetry remain separate values even though the UI drawer displays both.

## Public exports

The package build preserves the source entry structure in `dist` and uses this export boundary:

```json
{
  "sideEffects": false,
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js"
    },
    "./node": {
      "types": "./dist/node/index.d.ts",
      "node": "./dist/node/index.js"
    }
  }
}
```

The root entry exports:

- All domain contracts from `model.ts`.
- `parseOffline` and `validateCovenantDocument`.
- `CovenantSolver`, solver problem/result types, and `BrowserDeterministicSolver`.
- `verifyCovenant` and `applyChalicePatch`.
- OpenPBTStats snapshot and both telemetry formatters.

The Node entry exports:

- `NodeZ3Solver`.
- Type-only re-exports needed to implement or call `CovenantSolver`.

The root entry does not export or dynamically reference the Node entry. Applications must consume shared parser, solver, evidence, repair, preservation, and formatter behavior rather than copying it.

## Error handling

- Parser and validation failures return source-located diagnostics and never invoke a solver.
- Unsupported but well-formed theory returns solver `UNKNOWN`.
- Time, step, and cancellation budgets return typed `UNKNOWN` reasons.
- Adapter faults are caught by `verifyCovenant`, mapped to verdict `UNKNOWN`, and block certification.
- A proven finding remains `FAIL` if resolution synthesis returns `single` or `manual`.
- Invalid witness replay becomes `INVALID_EVIDENCE` and cannot certify a contradiction.
- Stale or mismatched source edits reject atomically.
- A patch with failed or unknown re-verification never receives a Preservation Proof.

## Testing strategy

Tests assert public behavior at the highest useful seam. Most examples call `parseOffline` or `validateCovenantDocument`, then `verifyCovenant`. Solver-level tests are limited to the shared conformance contract and formal properties that require backend comparison.

### Example and conformance tests

- Parse representative EARS and structured legal clauses and assert stable ASTs and diagnostics.
- Verify each Cursed Sample Scroll through `verifyCovenant` with the browser solver.
- Assert common applicability before contradiction evidence.
- Assert mutually exclusive scopes do not produce a Consistency finding.
- Assert `MAY` versus `MUST_NOT` produces Unambiguity evidence but no hard Consistency contradiction.
- Assert reverse-source minimization produces stable subset-minimal core IDs.
- Replay every Phantom Witness against every core applicability condition.
- Verify numeric integer-versus-decimal boundary behavior with exact rationals.
- Assert custom proven findings remain `FAIL` with `single` or `manual` resolution.
- Apply each standard Chalice and assert target repair plus 100% `~C` preservation.
- Assert the 60-CWE catalog contains exactly 60 unique stable IDs.
- Assert certification requires five `PASS` verdicts and rejects `FAIL` or `UNKNOWN`.

### Property-based tests

Vitest runs all properties in Node with `fast-check`. Each property sets `numRuns` to at least 200 successful cases; precondition discards do not count toward that target. The harness records edge-case tags, normalized fingerprints, duplicates, discards, seed, and duration.

**Soundness**

- Generate two-or-more rules with jointly satisfiable scopes and activations and incompatible hard consequences.
- Include cases where one hard consequence conflicts with another rule's applicability, not only consequence-versus-consequence collisions.
- Require a Consistency `FAIL`, replayable Phantom Witness, and subset-minimal rule core.
- Remove each returned core rule and require that specific contradiction query to stop being `UNSAT`.
- Generate mutually exclusive applicability as a negative property and require no Consistency contradiction.

**Preservation**

- Generate a document containing conflict set `C` plus independent rules `~C`.
- Generate or select a verified Chalice patch for `C`.
- Require the target finding to disappear after application.
- Require every `~C` source and semantic fingerprint to remain identical.
- Require `preservationPercent` to equal the literal value `100`.

**Solver Equivalence**

- Generate only the shared supported Boolean, enum, integer, and exact decimal fragment.
- Run identical normalized problems through `BrowserDeterministicSolver` and `NodeZ3Solver`.
- Require identical `SAT`, `UNSAT`, or `UNKNOWN` status.
- Require identical canonical core rule IDs for tracked `UNSAT` problems and `core: null` for both untracked `UNSAT` results.
- Replay each SAT model independently instead of requiring identical model bytes.
- Tag strict bounds, equal bounds, unbounded intervals, empty intersections, integer gaps, decimal open intervals, duplicates, and discarded inputs.

### Non-functional gates

- Browser benchmark: first-call and warm verification of all six Cursed Sample Scrolls remain below 15 ms under the documented browser matrix and reference baseline.
- Bundle isolation: browser output contains no `z3-solver`, `.wasm`, `NodeZ3Solver`, Node built-ins, or `SharedArrayBuffer` reference.
- Type safety: strict typecheck passes and a source scan finds no explicit `any`.
- Line budget: production source remains below 1,200 nonblank, non-comment lines.
- Determinism: repeated parse, normalize, solve, minimize, witness, and formatting operations produce stable serialized output.

## Requirement traceability

| Requirements | Design seam |
| --- | --- |
| 1-3 | Domain model, rational rules, condition normalization |
| 4-6 | `CovenantSolver`, browser implementation, Node subpath |
| 7-9 | Consistency verifier, core minimizer, witness canonicalizer |
| 10 | `verifyCovenant` and five Inquisitors |
| 11 | `parseOffline` and sample validation |
| 12-13 | Resolution Payload, `applyChalicePatch`, certification |
| 14 | Node Vitest and fast-check properties |
| 15 | OpenPBTStats snapshot and telemetry formatters |
| 16 | Export map, import graph, bundle and LOC gates |

## Out of scope

- Shared React Tribunal components and visual styling.
- BYOK LLM implementation.
- Browser Z3 or any required backend.
- Minimum-cardinality core search.
- Unsupported arithmetic or unrestricted logic.
- Fabricated repairs for custom findings without a formally verified template.

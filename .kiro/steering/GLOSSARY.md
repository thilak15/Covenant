# COVENANT Domain

COVENANT formalizes natural-language rules and tests whether their obligations can coexist. Its shared language connects parsed documents, formal evidence, repairs, and verification results.

## Rules and expressions

**`Rule`**:
A document-scoped formal statement that applies one `DeonticModality` to one consequence when its `RuleScope` and activation `Condition` both hold.
_Avoid_: Clause, policy, requirement when referring to the formal node

**`RuleScope`**:
The actors, resources, actions, and context that limit where a `Rule` applies. A scope is part of rule applicability, not descriptive metadata.
_Avoid_: Metadata, label

**Activation `Condition`**:
The expression that combines with a `RuleScope` to determine whether a `Rule` applies in a concrete scenario.
_Avoid_: Precondition when it excludes scope

**Consequence**:
The Boolean, enum, or numeric condition governed by a `Rule` after that rule becomes applicable.
_Avoid_: Outcome when referring only to an observed result

**`DeonticModality`**:
The closed set `MUST`, `MUST_NOT`, and `MAY`: obligation, prohibition, and explicit permission respectively. `MAY` grants permission without requiring execution.
_Avoid_: Modal quantifier

**`Condition`**:
A finite logical expression built from Boolean facts, enum comparisons, numeric bounds, conjunction, disjunction, and negation.
_Avoid_: Expression when rule applicability is intended

**`NumericBound`**:
An exact interval restriction over one integer or decimal variable, with optional inclusive or exclusive lower and upper endpoints. An omitted endpoint leaves that side unbounded.
_Avoid_: Floating-point range

## Formal evidence

**Consistency Contradiction**:
A set of rules whose scopes and activations can hold together but whose consequences cannot all hold together. Mutually exclusive rules do not form a Consistency Contradiction.
_Avoid_: Textual conflict, overlap

**`UnsatCore`**:
A stable, rule-level, subset-minimal set of at least two rule IDs that proves one Consistency Contradiction. Removing any member makes that contradiction disappear.
_Avoid_: Minimum core, conflicting document

**`PhantomWitness`**:
A deterministic, human-readable assignment that activates every rule in an `UnsatCore` and identifies their incompatible consequences. It witnesses common applicability, not the impossible conjunction of consequences.
_Avoid_: UNSAT model, example prose

**`InquisitorVerdict`**:
A `PASS`, `FAIL`, or `UNKNOWN` result for one of the five formal verification properties, together with property-specific evidence. Repair availability never changes a mathematically proven `FAIL`.
_Avoid_: Solver result

## Repair

**`ChalicePatch`**:
One verified formal repair tied to a finding and its conflict core, with a guarded source rewrite and a distinct resulting rule model.
_Avoid_: Suggestion, unverified redline

**`ChalicePair`**:
Exactly two distinct verified `ChalicePatch` options for the same finding, conventionally identified as Chalice A and Chalice B.
_Avoid_: Patch list

**Resolution Payload**:
The repair evidence attached to a failed verdict: a `ChalicePair`, one verified patch with a reason no second patch is safe, or a reason the issue requires manual repair.
_Avoid_: Resolution status

**Preservation Property**:
The guarantee that a selected `ChalicePatch` fixes the conflict set while every rule outside that set retains its source and prior non-conflicting meaning.
_Avoid_: Successful patch

## Solving and verification

**`CovenantSolver`**:
The common decision boundary for checking normalized COVENANT problems and returning `SAT`, `UNSAT`, or `UNKNOWN` without weakening proven findings.
_Avoid_: Inquisitor, parser

**`BrowserDeterministicSolver`**:
The browser-safe COVENANT solver that deterministically combines Boolean search with exact numeric interval reasoning.
_Avoid_: Browser Z3

**`NodeZ3Solver`**:
The Node-only COVENANT solver backed by Z3 for cross-verification and MCP execution.
_Avoid_: Browser solver

**`OpenPBTStats`**:
A reproducible property-test run summary containing successful runs, tagged edge cases, normalized-input duplicates, discarded inputs, seed, and duration. Discarded inputs do not count as successful runs.
_Avoid_: Live solver telemetry

**Verification Telemetry**:
Measurements from one live verification, including solver latency and clauses checked. It is displayed beside `OpenPBTStats` but remains a separate model.
_Avoid_: PBT statistics

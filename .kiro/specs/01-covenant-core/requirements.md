# COVENANT Core Requirements

## Problem Statement

Software specifications and legal clauses can contain contradictions that only appear when several scopes, conditions, and numeric bounds interact. Text-only checks cannot prove whether those rules can trigger together, isolate the subset that causes the contradiction, produce a replayable scenario, or verify that a repair preserves unrelated rules. Browser-hosted judges also cannot depend on Z3 WASM, server infrastructure, API keys, or long-running property tests.

## Solution

`@covenant/core` will provide a deterministic offline parser, an exact typed domain model, one asynchronous `CovenantSolver` seam, a browser-safe Boolean and numeric-interval solver, a Node-only Z3 adapter, five formal Inquisitors, subset-minimal Unsat Core extraction, Phantom Witness synthesis, verified Chalice repairs, Preservation Property verification, and typed OpenPBTStats snapshots. The browser path will remain static, dependency-free at runtime, and under 15 ms for the six Cursed Sample Scrolls.

## Requirement 1: Strict typed domain model

**User Story:** As a COVENANT maintainer, I want one exact domain model, so that the parser, both solvers, both applications, and the verification suite cannot drift into incompatible representations.

### Acceptance Criteria

1.1 WHEN TypeScript checks `@covenant/core`, THE COVENANT Core SHALL compile under strict mode with `noImplicitAny`, `strictNullChecks`, `noUncheckedIndexedAccess`, and `exactOptionalPropertyTypes` enabled.

1.2 WHEN uncertain external input enters the parser boundary, THE COVENANT Core SHALL receive it as `unknown` and explicitly narrow or reject it without using explicit or implicit `any`.

1.3 WHEN the parser constructs a `Rule`, THE COVENANT Core SHALL assign a stable document-scoped rule ID, source locator, structured `RuleScope`, activation `Condition`, one `DeonticModality`, and one consequence `Condition`.

1.4 WHEN a document declares variables, THE COVENANT Core SHALL represent each variable as a Boolean, enum, integer, or exact decimal domain with deterministic declaration ordering.

1.5 WHEN a domain value is serialized, THE COVENANT Core SHALL preserve stable field names, stable ordering, and exact numeric values across browser and Node runtimes.

## Requirement 2: Rule applicability and deontic semantics

**User Story:** As a specification author, I want scopes and conditions to have one formal meaning, so that a rule cannot be considered applicable under a different expression engine than the solver uses.

### Acceptance Criteria

2.1 WHEN the compiler normalizes a `Rule`, THE COVENANT Core SHALL compile `RuleScope` as an implicit conjunct with its activation `Condition` using the same normalized expression engine.

2.2 WHEN a `MUST` rule is applicable, THE COVENANT Core SHALL require its consequence to hold.

2.3 WHEN a `MUST_NOT` rule is applicable, THE COVENANT Core SHALL require the negation of its consequence to hold.

2.4 WHEN a `MAY` rule is applicable, THE COVENANT Core SHALL record explicit permission without adding a hard satisfiability constraint that forces execution.

2.5 WHEN an applicable `MAY X` overlaps an applicable `MUST_NOT X`, THE COVENANT Core SHALL report an Unambiguity failure without reporting a Consistency contradiction solely from that pair.

## Requirement 3: Conditions and exact numeric bounds

**User Story:** As a contract or SLA author, I want money, percentages, limits, and deadlines solved exactly, so that browser floating-point behavior cannot disagree with formal Z3 results.

### Acceptance Criteria

3.1 WHEN the parser creates a `Condition`, THE COVENANT Core SHALL represent it as a closed tree of Boolean constants, Boolean facts, enum equality or inequality, `NumericBound`, conjunction, disjunction, or negation.

3.2 WHEN the compiler prepares a `Condition` for solving, THE COVENANT Core SHALL normalize negation and Boolean composition into the solver-supported normalized expression model.

3.3 WHEN the parser reads a base-10 decimal literal, THE COVENANT Core SHALL convert it to a canonical reduced rational with a `BigInt` numerator and a positive `BigInt` denominator without passing through binary floating point.

3.4 WHEN the system serializes a canonical rational, THE COVENANT Core SHALL encode its numerator and denominator as base-10 strings.

3.5 WHEN a `NumericBound` is created, THE COVENANT Core SHALL identify one `INTEGER` or `DECIMAL` variable and optional lower and upper exact-rational endpoints with independent inclusive flags.

3.6 WHEN a `NumericBound` omits an endpoint, THE COVENANT Core SHALL interpret that side as unbounded without storing an infinity sentinel.

3.7 WHEN two numeric restrictions are conjoined, THE COVENANT Core SHALL declare the intersection `UNSAT` when the lower endpoint exceeds the upper endpoint, when equal endpoints exclude either side, or when no value remains in the declared numeric domain.

3.8 WHEN integer restrictions require `x > 5` and `x < 6`, THE COVENANT Core SHALL return `UNSAT` for `x` declared as `INTEGER`.

3.9 WHEN decimal restrictions require `x > 5` and `x < 6`, THE COVENANT Core SHALL return `SAT` for `x` declared as `DECIMAL`.

3.10 WHEN a well-formed condition uses variable-to-variable arithmetic, nonlinear arithmetic, or another unsupported theory, THE COVENANT Core SHALL return `UNKNOWN` rather than approximate the result.

## Requirement 4: CovenantSolver contract

**User Story:** As an application developer, I want one solver contract, so that browser verification and Node cross-verification remain substitutable.

### Acceptance Criteria

4.1 WHEN a caller submits a normalized provenance-bearing `SolverProblem`, THE COVENANT Core SHALL expose one promise-based `CovenantSolver.solve` operation for both implementations.

4.2 WHEN a `SolverProblem` is satisfiable, THE COVENANT Core SHALL return a discriminated `SAT` result with a replayable assignment and separate verification telemetry.

4.3 WHEN a tracked `SolverProblem` is unsatisfiable, THE COVENANT Core SHALL return a discriminated `UNSAT` result with its canonical rule-level Unsat Core and separate verification telemetry.

4.4 WHEN a well-formed `SolverProblem` cannot be decided within the supported theory or configured budget, THE COVENANT Core SHALL return a discriminated `UNKNOWN` result with a typed reason.

4.5 WHEN malformed input reaches the parser or compiler, THE COVENANT Core SHALL reject it before invoking either solver.

4.6 WHEN a solver adapter throws or fails to initialize, THE COVENANT Core SHALL expose an `UNKNOWN` Inquisitor Verdict, block certification, and preserve every independently proven `FAIL`.

4.7 WHEN a rule-tracked Solver Problem is validated, THE COVENANT Core SHALL require at least two rule groups, satisfiable fixed constraints, and satisfiable fixed constraints conjoined with each individual group so every returned tracked Unsat Core contains at least two rules.

## Requirement 5: BrowserDeterministicSolver

**User Story:** As a judge using a static browser application, I want formal verification without WASM or a backend, so that every sample and supported custom rule works without setup.

### Acceptance Criteria

5.1 WHEN `BrowserDeterministicSolver` receives a supported normalized problem, THE COVENANT Core SHALL solve Boolean relations with deterministic SAT/DPLL search and numeric atoms with exact rational interval reasoning.

5.2 WHEN identical normalized problems are solved repeatedly, THE COVENANT Core SHALL return deterministic status, rule ordering, canonical core IDs, and canonical witness values.

5.3 WHEN any of the six Cursed Sample Scrolls is verified after solver construction, THE COVENANT Core SHALL complete the live browser verification path in under 15 ms.

5.4 WHEN a production browser bundle imports `@covenant/core`, THE COVENANT Core SHALL require no `SharedArrayBuffer`, COOP/COEP headers, Z3 WASM download, server dependency, API key, or browser-solver runtime dependency.

5.5 WHEN live browser verification runs, THE COVENANT Core SHALL not execute the 200-run property-based suites on the main thread.

5.6 WHEN performance verification runs, THE COVENANT Core SHALL enforce an automated Vitest gate that measures each Cursed Sample Scroll's first verification immediately after solver construction and 20 warm verification calls with `performance.now()` against the compiled `@covenant/core` production artifact at `dist/index.js`, requires every run to complete in under 15 ms, and reserves Chrome and Safari verification for manual pre-submission smoke testing on the deployed static Vite applications.

## Requirement 6: NodeZ3Solver isolation

**User Story:** As a formal verification maintainer, I want real Z3 cross-verification in Node, so that the deterministic browser solver is checked against an independent SMT implementation without contaminating browser bundles.

### Acceptance Criteria

6.1 WHEN Node code imports the Node-specific `@covenant/core` entry point, THE COVENANT Core SHALL expose a `NodeZ3Solver` backed by the real `z3-solver` package.

6.2 WHEN browser code imports the root `@covenant/core` entry point, THE COVENANT Core SHALL not expose or transitively import `NodeZ3Solver`, `z3-solver`, Node-only modules, or Z3 WASM assets.

6.3 WHEN `NodeZ3Solver` receives canonical rationals, THE COVENANT Core SHALL encode them as exact Z3 Real rationals with the same integer-versus-decimal semantics as `BrowserDeterministicSolver`.

6.4 WHEN the Node adapter returns a SAT assignment, THE COVENANT Core SHALL replay that assignment against the normalized problem before accepting it as valid evidence.

6.5 WHEN the custom Z3 MCP Power imports the Node-specific entry point, THE COVENANT Core SHALL provide the same `CovenantSolver` contract used by the Vitest equivalence suite.

6.6 WHEN either Vite application source or production bundle is inspected, THE COVENANT Core SHALL fail the boundary check if it directly imports `@covenant/core/node` or contains `z3-solver`, Node built-ins, Z3 WASM, or `NodeZ3Solver`.

## Requirement 7: Consistency proof

**User Story:** As a rule author, I want contradictions reported only when the rules can actually trigger together, so that mutually exclusive scopes do not produce false alarms.

### Acceptance Criteria

7.1 WHEN candidate rules may have incompatible hard consequences, THE COVENANT Core SHALL first solve the conjunction of every candidate rule's normalized scope and activation.

7.2 WHEN the conjunction of candidate scopes and activations is `UNSAT`, THE COVENANT Core SHALL not report those candidates as a Consistency contradiction.

7.3 WHEN the conjunction of candidate scopes and activations is `SAT`, THE COVENANT Core SHALL retain its canonical assignment as the basis for the Phantom Witness.

7.4 WHEN common applicability is `SAT`, THE COVENANT Core SHALL add each applicable `MUST` consequence and negated `MUST_NOT` consequence and solve the resulting contradiction query.

7.5 WHEN the contradiction query is `UNSAT`, THE COVENANT Core SHALL report a Consistency `FAIL` containing the canonical Unsat Core and Phantom Witness.

7.6 WHEN the contradiction query is `SAT`, THE COVENANT Core SHALL not report a Consistency contradiction for those candidates.

7.7 WHEN hard rules are prepared for candidate discovery, THE COVENANT Core SHALL build source-ordered dependency components whenever either rule's hard consequence shares a variable with the other rule's applicability or hard consequence and SHALL enumerate subsets from cardinality two upward in deterministic source order.

7.8 WHEN candidate enumeration finds a subset-minimal core, THE COVENANT Core SHALL deduplicate that core by its source-ordered rule IDs and skip supersets that cannot contribute a different minimal core.

7.9 WHEN a candidate or solve budget is exhausted before every supported candidate is classified, THE COVENANT Core SHALL return Consistency `UNKNOWN` unless an already proven contradiction requires Consistency `FAIL` with the budget reason retained as unresolved evidence.

## Requirement 8: Subset-minimal Unsat Core extraction

**User Story:** As a reviewer, I want only the rules necessary for one contradiction, so that I can understand and repair the conflict without reading unrelated material.

### Acceptance Criteria

8.1 WHEN an initial contradiction query is `UNSAT`, THE COVENANT Core SHALL minimize over complete rule constraint groups rather than individual compiled constraints.

8.2 WHEN minimizing a candidate core, THE COVENANT Core SHALL process source-ordered candidates by attempting removals in reverse source order.

8.3 WHEN core minimization finishes, THE COVENANT Core SHALL return source-ordered rule IDs for which removing any remaining rule makes that contradiction query no longer `UNSAT`.

8.4 WHEN several subset-minimal cores can prove the same contradiction, THE COVENANT Core SHALL deterministically prefer the core retained by the reverse-source-order removal procedure.

8.5 WHEN a Consistency core is emitted, THE COVENANT Core SHALL include at least two rule IDs, the contradiction-query ID, and the incompatible triggered consequences.

8.6 WHEN one rule is internally impossible without another rule, THE COVENANT Core SHALL report a parser, validation, or Testability finding instead of a singleton Consistency contradiction.

## Requirement 9: Phantom Witness synthesis

**User Story:** As a reviewer, I want a concrete replayable trigger scenario, so that the contradiction is understandable without reading solver internals.

### Acceptance Criteria

9.1 WHEN a Consistency contradiction has common `SAT` applicability, THE COVENANT Core SHALL construct the Phantom Witness from that applicability model rather than from the impossible consequence conjunction.

9.2 WHEN a Phantom Witness is returned, THE COVENANT Core SHALL assign every scope and activation variable needed to replay every rule in its Unsat Core.

9.3 WHEN a Phantom Witness is returned, THE COVENANT Core SHALL list the incompatible consequences activated by its assignments separately from the assignment table.

9.4 WHEN several satisfying Boolean or enum values exist, THE COVENANT Core SHALL select values through stable variable and declared-domain ordering.

9.5 WHEN several satisfying numeric values exist, THE COVENANT Core SHALL use satisfiability-preserving probes that prefer included finite endpoints ordered by absolute value, then zero, then positive integers in ascending order, then a finite midpoint or nearest exact rational.

9.6 WHEN a Phantom Witness is replayed against the source AST, THE COVENANT Core SHALL activate every rule identified by its Unsat Core.

## Requirement 10: Five Inquisitor verification

**User Story:** As a specification or contract author, I want one report covering all five formal properties, so that I can distinguish contradictions from vagueness, gaps, ambiguity, and unsafe deadlocks.

### Acceptance Criteria

10.1 WHEN a rule uses subjective or vague language without a measurable Boolean, enum, or numeric condition, THE COVENANT Core SHALL return a Testability `FAIL` with the source location and offending terms.

10.2 WHEN the declared input domain contains a combination not handled by any rule or fallback, THE COVENANT Core SHALL return a Completeness `FAIL` with a concrete replayable assignment.

10.3 WHEN two rules have overlapping applicability and conflicting modal interpretation without a hard Consistency contradiction, THE COVENANT Core SHALL return an Unambiguity `FAIL` with both rule IDs and the overlap condition.

10.4 WHEN a specification omits an applicable obligation from the version-one 60-CWE manifest defined in `design.md`, THE COVENANT Core SHALL return a Security `FAIL` with the stable CWE control ID and supporting rule references.

10.5 WHEN cumulative deny or security rules make a declared primary workflow impossible, THE COVENANT Core SHALL return a Liveness `FAIL` with the blocking rule IDs and a concrete workflow witness.

10.6 WHEN verification completes, THE COVENANT Core SHALL return exactly one `InquisitorVerdict` for Testability, Consistency, Completeness, Unambiguity, and Security & Liveness.

10.7 WHEN every applicable property is proven to hold, THE COVENANT Core SHALL mark its Inquisitor Verdict `PASS`.

10.8 WHEN a property has no proven finding and cannot be decided because of unsupported theory, resource limits, or adapter failure, THE COVENANT Core SHALL mark its Inquisitor Verdict `UNKNOWN` without changing other verdicts.

10.9 WHEN one check within an Inquisitor proves a finding and another check remains undecidable, THE COVENANT Core SHALL keep that Inquisitor Verdict `FAIL` and record the undecidable reason as unresolved evidence.

10.10 WHEN a CWE control applies to a governed operation, THE COVENANT Core SHALL treat the obligation as satisfied only when the declared domain, control applicability, and governed operation applicability conjoined with the negated required obligation is `UNSAT`.

## Requirement 11: Deterministic offline parser

**User Story:** As a judge or offline user, I want local EARS and clause parsing, so that core verification never depends on an LLM, network, account, or API key.

### Acceptance Criteria

11.1 WHEN a caller submits supported EARS text, THE COVENANT Core SHALL parse it deterministically into the shared typed domain model without network access.

11.2 WHEN a caller submits supported structured legal-clause text, THE COVENANT Core SHALL parse it deterministically into the same shared typed domain model without network access.

11.3 WHEN identical source text, format, and document metadata are parsed repeatedly, THE COVENANT Core SHALL return identical rule IDs, source locations, normalized values, and diagnostics.

11.4 WHEN text cannot be represented by the supported grammar, THE COVENANT Core SHALL return source-located diagnostics and preserve the original text without inventing formal meaning.

11.5 WHEN a pre-verified Cursed Sample Scroll is loaded, THE COVENANT Core SHALL accept its typed AST without requiring parser, network, or LLM latency.

11.6 WHEN the parser recognizes valid syntax for an unsupported theory, THE COVENANT Core SHALL preserve its source provenance as an Unsupported Construct and return `UNKNOWN/UNSUPPORTED_THEORY` during verification rather than rejecting it as malformed or inventing a supported `Condition`.

## Requirement 12: Chalice repair and preservation

**User Story:** As a document owner, I want safe repair options with proof that unrelated rules remain unchanged, so that resolving one conflict cannot silently create another.

### Acceptance Criteria

12.1 WHEN a standard Consistency, Unambiguity, Security, or Liveness pattern is found, THE COVENANT Core SHALL produce a `pair` Resolution Payload containing verified and distinct Chalice A and Chalice B patches.

12.2 WHEN any of the six Cursed Sample Scrolls contains a supported finding, THE COVENANT Core SHALL produce a verified `ChalicePair` for that finding.

12.3 WHEN custom input supports two distinct safe automatic repairs, THE COVENANT Core SHALL return a `pair` Resolution Payload containing verified Chalice A and Chalice B patches.

12.4 WHEN custom input supports exactly one safe automatic repair, THE COVENANT Core SHALL preserve the proven `FAIL` and return a `single` Resolution Payload containing an unpaired verified patch and the reason no second patch is safe.

12.5 WHEN custom input supports no safe automatic repair, THE COVENANT Core SHALL preserve the proven `FAIL` and return a `manual` Resolution Payload containing the reason manual repair is required.

12.6 WHEN repair synthesis cannot produce two verified strategies, THE COVENANT Core SHALL not fabricate a patch or downgrade a mathematically proven `FAIL` to `UNKNOWN`.

12.7 WHEN a Chalice patch is verified, THE COVENANT Core SHALL prove that its normalized post-patch rule model differs from every alternative patch in the same pair.

12.8 WHEN a Chalice patch is applied, THE COVENANT Core SHALL reject the edit if its source revision or expected source text no longer matches the current document.

12.9 WHEN a Chalice patch is applied successfully, THE COVENANT Core SHALL modify only rule IDs in conflict set `C`, re-run all five Inquisitors, and prove the original finding is fixed.

12.10 WHEN preservation is verified, THE COVENANT Core SHALL prove that every rule in `~C` retains identical source and semantic fingerprints and report a preservation percentage of exactly 100.

12.11 WHEN patch re-verification returns `FAIL` for the target finding or `UNKNOWN` for any required proof, THE COVENANT Core SHALL reject certification of that patch.

12.12 WHEN a `pair` Resolution Payload is created, THE COVENANT Core SHALL type it as a `ChalicePair` containing an A patch followed by a B patch for the same finding, Repair Core, and source revision.

12.13 WHEN a `single` Resolution Payload is created, THE COVENANT Core SHALL type its verified patch with `slot: null`.

12.14 WHEN a Chalice patch is created, THE COVENANT Core SHALL bind it to an immutable Repair Core containing every existing rule ID authorized for repair.

12.15 WHEN a missing Security obligation applies to an existing governed operation, THE COVENANT Core SHALL repair only that governed rule and preserve every other original rule in `~C`.

12.16 WHEN a missing Security obligation has no existing governed rule that can be safely rewritten, THE COVENANT Core SHALL preserve the Security `FAIL` and return a `manual` Resolution Payload.

12.17 WHEN source or semantic fingerprints are compared, THE COVENANT Core SHALL use collision-free canonical strings derived from the exact source slice and normalized rule meaning rather than opaque implementation-dependent hashes.

12.18 WHEN a patch is re-verified, THE COVENANT Core SHALL require the target finding to disappear, require no new finding fingerprint to appear, allow unrelated pre-existing findings to remain, and require every proof needed for the patch to be decisive.

## Requirement 13: Verdict and certification integrity

**User Story:** As a user relying on formal evidence, I want proof status separated from repair availability and operational failures, so that the UI never hides a real defect.

### Acceptance Criteria

13.1 WHEN an Inquisitor proves a property violation, THE COVENANT Core SHALL return `FAIL` with property-specific evidence regardless of its Resolution Payload.

13.2 WHEN an Inquisitor proves a property holds, THE COVENANT Core SHALL return `PASS` without attaching contradictory failure evidence.

13.3 WHEN an Inquisitor returns `UNKNOWN`, THE COVENANT Core SHALL include a typed reason and block the Crimson Wax Seal of Formal Certification.

13.4 WHEN all five Inquisitor Verdicts are `PASS`, THE COVENANT Core SHALL mark the Verification Report as certifiable.

13.5 WHEN any Inquisitor Verdict is `FAIL` or `UNKNOWN`, THE COVENANT Core SHALL mark the Verification Report as not certifiable.

## Requirement 14: Property-based verification

**User Story:** As a formal verification maintainer, I want generated cross-checks of the core properties, so that edge cases in minimization, preservation, and numeric solving are caught before deployment.

### Acceptance Criteria

14.1 WHEN the Node property-based suite runs, THE COVENANT Core SHALL use Vitest and `fast-check` with at least 200 successful runs for each of Soundness, Preservation, and Solver Equivalence.

14.2 WHEN `fast-check` discards generated inputs through preconditions, THE COVENANT Core SHALL exclude those discarded inputs from the 200 successful-run minimum.

14.3 WHEN the Soundness property generates jointly applicable rules with incompatible hard consequences, THE COVENANT Core SHALL return a Consistency `FAIL`, a replayable Phantom Witness, and a subset-minimal Unsat Core.

14.4 WHEN the Soundness property generates mutually exclusive rule applicability, THE COVENANT Core SHALL not report a Consistency contradiction for those rules.

14.5 WHEN the Soundness property removes any rule from a returned Unsat Core, THE COVENANT Core SHALL make that specific contradiction query no longer `UNSAT`.

14.6 WHEN the Preservation property applies a generated verified Chalice patch to conflict set `C`, THE COVENANT Core SHALL fix the target finding and preserve the source and semantic fingerprints of every generated rule in `~C`.

14.7 WHEN the Solver Equivalence property submits a supported rule-tracked problem to both solvers, THE COVENANT Core SHALL return identical solver status and identical canonical core rule IDs for `UNSAT` results.

14.8 WHEN either solver returns `SAT` during Solver Equivalence, THE COVENANT Core SHALL replay and validate that solver's assignment without requiring byte-identical assignments from both solvers.

14.9 WHEN an equivalence generator creates integer or decimal boundary cases, THE COVENANT Core SHALL include strict endpoints, equal endpoints, unbounded sides, empty intersections, and satisfiable open decimal intervals.

14.10 WHEN the Soundness property generates a hard consequence that conflicts with another rule's applicability while all applicability conditions remain jointly satisfiable, THE COVENANT Core SHALL discover and report the resulting Consistency contradiction.

14.11 WHEN the Solver Equivalence property submits a supported untracked decision problem to both solvers, THE COVENANT Core SHALL return identical solver status and `core: null` for both `UNSAT` results.

## Requirement 15: OpenPBTStats and live telemetry

**User Story:** As a judge, I want visible verification coverage and live latency without browser stalls, so that I can inspect both pre-deployment rigor and current solver performance.

### Acceptance Criteria

15.1 WHEN the Node property-based suite completes, THE COVENANT Core SHALL export a typed OpenPBTStats snapshot containing property name, requested runs, successful runs, tagged edge-case counts, duplicate runs, discarded runs, seed, and duration.

15.2 WHEN a successful generated input has the same normalized-input fingerprint as an earlier successful input in the same run, THE COVENANT Core SHALL count it as a duplicate run.

15.3 WHEN the static application displays property-test telemetry, THE COVENANT Core SHALL provide the exported OpenPBTStats snapshot without executing the property suite in the browser.

15.4 WHEN a live solver operation completes, THE COVENANT Core SHALL report latency in milliseconds and clauses checked through separate Verification Telemetry.

15.5 WHEN the telemetry drawer requests display rows, THE COVENANT Core SHALL format OpenPBTStats and Verification Telemetry without merging their domain models.

## Requirement 16: Package and module boundaries

**User Story:** As a maintainer of both static applications, I want a small, explicit shared package boundary, so that core logic is reused without accidentally shipping Node-only code.

### Acceptance Criteria

16.1 WHEN either application needs the parser, domain model, browser solver, verifier, repair engine, or telemetry formatter, THE COVENANT Core SHALL expose that capability from the browser-safe root `@covenant/core` entry point.

16.2 WHEN Node tests or the MCP Power need Z3, THE COVENANT Core SHALL expose `NodeZ3Solver` only from the Node-specific `@covenant/core/node` entry point.

16.3 WHERE production modules are added THE COVENANT Core SHALL keep core engine logic separate from shared Tribunal UI code through focused modules and clear dependency direction without imposing an artificial source-line cap.

16.4 WHEN package modules are analyzed, THE COVENANT Core SHALL contain no circular production imports and SHALL keep the domain model independent of parser, solver, verifier, UI, and Node-adapter modules.

16.5 WHEN either application imports shared behavior, THE COVENANT Core SHALL prevent duplication of parser, solver, Unsat Core, Phantom Witness, repair, preservation, or telemetry logic outside `@covenant/core`.

16.6 WHEN the package build and browser bundle checks run, THE COVENANT Core SHALL pass strict typechecking and prove that browser artifacts contain no `z3-solver`, Z3 WASM, or Node adapter code.

16.7 WHEN package build or root typecheck runs, THE COVENANT Core SHALL execute one deterministic TypeScript source check that reports production source size and rejects explicit `any` without failing on an artificial line threshold.

## Out of Scope

- React Tribunal components and visual design, which belong to `.kiro/specs/02-haunted-tribunal-ui/`.
- BYOK LLM provider integrations; this feature exposes only the deterministic offline parser boundary.
- Variable-to-variable arithmetic, nonlinear arithmetic, strings beyond finite enum equality, dates as a separate solver theory, arrays, quantifiers, and unrestricted first-order logic.
- Browser execution of `z3-solver`, WebAssembly solvers, worker-hosted PBT suites, backends, accounts, secrets, or paid services.
- Minimum-cardinality Unsat Core search; this feature guarantees deterministic subset-minimal cores.
- Automatic repairs outside supported repair templates; unsupported custom findings remain proven and use `single` or `manual` Resolution Payloads.

# COVENANT SMT Formalization

## Purpose

COVENANT translates EARS software requirements and legal contract clauses into formal deontic logic, then uses SMT/SAT reasoning to expose multi-variable contradictions, security and liveness traps, and financial loopholes. Formal results must remain explainable through a subset-minimal Unsat Core and a concrete Phantom Witness. Standard supported patterns and all six Cursed Sample Scrolls must also provide two verified Chalice patches; custom input may safely provide one patch or a manual-repair reason without weakening a proven finding.

## Translation pipeline

1. Load a pre-verified Cursed Sample Scroll, or accept edited or pasted text.
2. Parse with the deterministic offline EARS/Clause parser.
3. Optionally enhance arbitrary freeform prose through a user-supplied BYOK LLM translator. If no key is set or a rate limit occurs, fall back to the offline parser.
4. Compile structured rules into the typed deontic AST.
5. Encode Boolean relations and numeric comparisons or bounds for the `CovenantSolver` interface.
6. Run the five formal verification properties.
7. For a contradiction, derive the canonical subset-minimal Unsat Core and synthesize a replayable Phantom Witness.
8. Generate a verified Chalice pair for a standard supported pattern, or a typed single/manual resolution payload for custom input; applying a verified patch re-runs verification and proves preservation of every clause outside the conflict.

The three sample scrolls in each application carry pre-verified ASTs, so their primary path has 0 ms API latency and $0 cost.

## Approved deterministic source grammar

The offline parser, downstream tasks, and all six Cursed Sample Scrolls use these normative productions exactly:

```text
[ID:] [WHEN|WHILE|WHERE <cond>, | IF <cond> THEN] THE SYSTEM SHALL|SHALL NOT|MAY <cond>
Clause <ref>: [IF <cond> THEN] <Party> MUST|MUST NOT|MAY <cond>
```

Square brackets mark optional segments, pipes mark alternatives, and `<cond>`, `<ref>`, and `<Party>` are grammar placeholders. The first production is the supported EARS form; the second is the supported structured legal-clause form. Other source shapes are malformed unless the parser explicitly recognizes them as valid unsupported theory.

## Typed domain model

The shared compiler in `packages/covenant-core` uses these typed nodes and records:

- **`Rule`:** A stable document-scoped rule ID, source locator, `RuleScope`, activation `Condition`, `DeonticModality`, and one consequence `Condition`. Scope compiles as an implicit conjunct with activation through the same normalized expression engine.
- **`DeonticModality`:** Exactly `MUST` | `MUST_NOT` | `MAY`. `MUST` requires its consequence, `MUST_NOT` requires its negation, and `MAY` grants explicit permission without imposing execution.
- **`Condition`:** A closed expression tree of Boolean constants or facts, enum equality or inequality, `NumericBound`, conjunction, disjunction, and negation. Negation is normalized before solving.
- **`NumericBound`:** One `INTEGER` or `DECIMAL` variable with optional exact lower and upper rational endpoints and an inclusive flag for each endpoint.
- **`RuleScope`:** The actors, resources, actions, and contextual domain that participate in rule applicability.
- **`UnsatCore`:** The contradiction-query ID, incompatible consequences, and stable source-ordered, rule-level, subset-minimal set of at least two rule IDs.
- **`PhantomWitness`:** The canonical replayable assignment satisfying every core rule's scope and activation, plus the incompatible consequences those rules trigger.
- **`ChalicePatch`:** One verified formal repair, its guarded source rewrite, target core rule IDs, and source revision.
- **`ChalicePair`:** Exactly two distinct verified Chalice patches for the same finding.
- **`ResolutionPayload`:** A discriminated `pair`, `single`, or `manual` repair result that never changes the proof verdict.
- **`InquisitorVerdict`:** A `PASS`, `FAIL`, or `UNKNOWN` result with evidence specialized for one of the five formal verification properties. Repair availability does not alter a proven `FAIL`.
- **`OpenPBTStats`:** A typed Node-suite snapshot containing requested and successful runs, tagged edge cases, normalized-input duplicates, discarded inputs, seed, and duration.

All domain values must be statically typed under TypeScript 5 strict mode. `any` is prohibited; uncertain input enters as `unknown` and is narrowed or rejected at the parser boundary. Exact decimals use reduced `BigInt` numerator/denominator rationals internally and serialize both values as base-10 strings.

## The 5 Hooded Inquisitors

### 1. Testability

Flag vague, untestable, or subjective language when it lacks measurable conditions. Conditions should resolve to explicit Boolean facts, enum-like states, numeric comparisons, or numeric bounds that a solver and an executable test can evaluate.

### 2. Consistency

Detect an `UNSAT` contradiction across two or more interacting rules. A Consistency contradiction exists only when both formal queries succeed:

1. The conjunction of the candidate rules' scopes and activations is `SAT`; its canonical model becomes the Phantom Witness.
2. Adding the candidate rules' modal consequences makes the query `UNSAT`.

The check must account for interacting variables rather than pairwise text similarity. Rules with mutually exclusive applicability fail the first query and must never be reported as contradictory. A `MAY` and overlapping `MUST_NOT` can fail Unambiguity, but `MAY` adds no hard constraint and therefore does not create a Consistency contradiction.

### 3. Completeness

Search the declared input space for combinations that no rule or fallback state handles. A satisfying assignment for an uncovered region is evidence of a completeness gap and becomes a concrete witness.

### 4. Unambiguity

Flag overlapping `RuleScope` values or conflicting modal quantifiers on identical conditions. Report the involved rule IDs and the overlap that makes more than one interpretation possible.

### 5. Security & Liveness

Check all 60-CWE Spec Security Hardening obligations applicable to a specification, including gaps involving missing authentication, unvalidated input, injection, authorization or privilege risks such as CWE-862. Also check the **Sandbox That Blocks Normal Work** liveness property: cumulative deny or security rules must not make a legitimate primary workflow impossible. A blocked normal workflow is a liveness deadlock even when every individual restriction appears secure in isolation.

## `CovenantSolver` architecture

`packages/covenant-core` must expose one promise-based `CovenantSolver` interface over a normalized, provenance-bearing `SolverProblem`, with two conforming implementations and one discriminated result model: `SAT` with a replayable assignment, `UNSAT` with the canonical rule-level Unsat Core, or `UNKNOWN` with a typed reason. Well-formed unsupported theory returns `UNKNOWN`; malformed input is rejected at the parser or compiler boundary.

### `BrowserDeterministicSolver`

- Zero runtime dependencies
- Pure TypeScript
- SAT/DPLL Boolean solving plus exact rational numeric-interval bounds solving
- Under 15 ms for the pre-loaded verification cases inside any browser
- No live execution of the 200-run property suites
- No `SharedArrayBuffer`
- No strict COOP/COEP headers
- No WASM download lag
- Deterministic result, rule ordering, Unsat Core, and witness for identical input

This implementation avoids the browser failure trap caused by running `z3-solver` WASM directly, particularly on Safari and static hosts that cannot safely provide strict COOP/COEP isolation.

### `NodeZ3Solver`

- Real `z3-solver` adapter
- Runs only in Node.js through a Node-specific entry point such as `@covenant/core/node`
- Used by Vitest for PBT equivalence cross-verification
- Used by the custom Kiro MCP Power under `powers/z3-covenant-power/`
- Never imported into or bundled with browser JavaScript

## Unsat Core extraction

The Unsat Core Extractor must:

1. Start with source-ordered rule IDs participating in one failing contradiction query.
2. Treat every constraint emitted by one rule atomically.
3. Attempt removals in reverse source order while preserving `UNSAT`.
4. Return a subset-minimal result: removing any remaining rule makes that particular contradiction disappear.
5. Preserve source ordering in the returned IDs and contain at least two rules.
6. Return only the canonical conflicting subset, never the whole document unless every returned rule is required. Minimum-cardinality search is not required.

## Phantom Witness synthesis

The Phantom Witness is the canonical model of the satisfiable conjunction of an Unsat Core's scopes and activations. It converts that common triggering scenario into a human-readable variable table while listing the consequences that cannot coexist. For example:

| Variable | Value |
| --- | --- |
| `UserRole` | `"Contractor"` |
| `EmergencyOverride` | `true` |
| `Day` | `"Sunday"` |

**Triggered result:** `Both ALLOW and DENY triggered simultaneously`.

The witness must be replayable against the AST and activate every rule in its Unsat Core. It is not a model of the impossible consequence conjunction. Variables use stable ordering, and numeric assignments use satisfiability-preserving probes that favor finite boundaries, zero, small positive integers, and finite midpoints or nearby exact rationals over arbitrary large values.

## Two Cursed Chalices and preservation

Every standard Consistency, Unambiguity, Security, and Liveness pattern, including all six Cursed Sample Scrolls, receives a verified `ChalicePair`:

- **Chalice A:** One valid repair strategy with a source-level patch preview.
- **Chalice B:** A distinct valid repair strategy with a source-level patch preview.

Custom input uses a discriminated resolution payload: `pair` for two verified patches, `single` for one verified patch plus the reason no second safe patch exists, or `manual` for the reason no safe automatic patch exists. A proven issue remains `FAIL` regardless of this payload; the system must never fabricate a patch or downgrade the verdict to `UNKNOWN` because repair synthesis was incomplete.

Selecting a verified Chalice rewrites the source document live and immediately re-runs all applicable verification. Let `C` denote the rules in the detected conflict and `~C` denote every non-conflicting rule. The Preservation Verifier must prove:

1. The selected patch fixes `C`.
2. 100% of rules in `~C` remain intact.
3. Their meaning and prior non-conflicting behavior remain preserved through stable semantic fingerprints.
4. Re-verification does not silently accept a failed or unknown result.

## Property-based testing

Use Vitest and `fast-check` in Node, with at least 200 successful runs for each property; discarded inputs do not count toward that minimum:

1. **Soundness:** Generated jointly applicable rules with incompatible hard consequences always return `UNSAT` and a subset-minimal Unsat Core. Generated mutually exclusive rules never report a Consistency contradiction.
2. **Preservation:** A Chalice patch fixes `C` without breaking any rule in `~C`.
3. **Solver Equivalence:** `BrowserDeterministicSolver` matches `NodeZ3Solver` backed by `z3-solver` for status and canonical core IDs on supported cases; every SAT model must replay successfully.

The Node suite exports a typed `OpenPBTStats` snapshot for the verification panel containing:

- requested and successful runs
- valid edge-case counts by tag
- duplicate successful cases identified by normalized-input fingerprint
- discarded inputs
- seed and duration

The static browser applications display this snapshot but do not execute the randomized suites live. Per-solve latency in milliseconds and clauses checked belong to separate `VerificationTelemetry`, which the same drawer displays alongside the PBT snapshot.

## Domain-specific formal checks

### Software, RBAC, security, and sandbox rules

The Spec Inquisitor must support three-variable RBAC and specification interactions, all 60-CWE Spec Security Hardening obligations, and liveness checks across Agent Sandbox/IAM deny rules. It must export patched EARS `requirements.md` and an executable `fast-check` PBT snippet.

Its fixed sample corpus is:

1. Multi-Role RBAC Emergency Override Contradiction
2. Over-Hardened Agent Sandbox Liveness Deadlock
3. API Rate-Limit & CWE-862 Security Gap Spec

### Contracts, SLAs, and legal clauses

The Clause Exorcist must model financial liability, uptime credits, indemnification, IP ownership, background IP, notice, cure periods, and force majeure well enough to detect their specified contradictions and loopholes. It must export a protective Legal Redline diff and a plain-English negotiation summary.

Its fixed sample corpus is:

1. SaaS Liability Cap vs. Uncapped Indemnification Loophole
2. Freelance IP Assignment & Kill-Fee Contradiction
3. Enterprise SLA Penalty & Force Majeure Deadlock

## Locked operational constraints

- Both applications are 100% static client-side Vite applications.
- Judges need no login, Docker setup, API key, or backend.
- The offline path must continue working through January 22, 2027.
- Both applications consume the solver, parser, PBT statistics formatter, and shared Haunted Tribunal UI from `@covenant/core`; no core logic is duplicated.
- Later specifications live at `.kiro/specs/01-covenant-core/`, `.kiro/specs/02-haunted-tribunal-ui/`, and `.kiro/specs/03-bugfix-preservation/`.
- The later verification hook at `.kiro/hooks/verify-on-save.json` runs core PBT, cross-application typechecking, and an EARS audit on spec save.
- The later Power at `powers/z3-covenant-power/` contains `POWER.md` and `mcp.json` wrapping Node `z3-solver` and 60-CWE specification checks for dynamic on-demand loading.
- The later Kiro Crew integration is a three-agent pipeline: Formalizer -> Z3 Inquisitor -> Redline & PBT Synthesizer, watching `.kiro/specs/` for the Best Kiro Crew App bonus prize.

# COVENANT SMT Formalization

## Purpose

COVENANT translates EARS software requirements and legal contract clauses into formal deontic logic, then uses SMT/SAT reasoning to expose multi-variable contradictions, security and liveness traps, and financial loopholes. Formal results must remain explainable through a minimal Unsat Core, a concrete Phantom Witness, and two verified Chalice patches.

## Translation pipeline

1. Load a pre-verified Cursed Sample Scroll, or accept edited or pasted text.
2. Parse with the deterministic offline EARS/Clause parser.
3. Optionally enhance arbitrary freeform prose through a user-supplied BYOK LLM translator. If no key is set or a rate limit occurs, fall back to the offline parser.
4. Compile structured rules into the typed deontic AST.
5. Encode Boolean relations and numeric comparisons or bounds for the `CovenantSolver` interface.
6. Run the five formal verification properties.
7. For a contradiction, derive the exact minimal Unsat Core and synthesize a replayable Phantom Witness.
8. Generate Chalice A and Chalice B, patch the selected option into the source document, re-run verification, and prove preservation of every clause outside the conflict.

The three sample scrolls in each application carry pre-verified ASTs, so their primary path has 0 ms API latency and $0 cost.

## Typed deontic AST

The shared compiler in `packages/covenant-core` uses these typed nodes:

- **`Rule`:** A stable rule ID, source location or clause reference, `RuleScope`, `Condition`, `DeonticModality`, and governed outcome or obligation.
- **`DeonticModality`:** Exactly `MUST` | `MUST_NOT` | `MAY`.
- **`Condition`:** Boolean atoms and Boolean composition, plus numeric comparison and bound expressions.
- **`RuleScope`:** The actors, resources, actions, and contextual domain to which a rule applies.
- **`UnsatCore`:** The exact minimal subset of conflicting rule IDs.
- **`PhantomWitness`:** A concrete variable assignment table and the incompatible outcomes it activates.
- **`ChalicePatch`:** One concrete formal resolution and its source rewrite.
- **`InquisitorVerdict`:** The result and evidence for one of the five formal verification properties.

All nodes must be statically typed under TypeScript 5 strict mode. `any` is prohibited; uncertain input enters as `unknown` and is narrowed or rejected at the parser boundary.

## The 5 Hooded Inquisitors

### 1. Testability

Flag vague, untestable, or subjective language when it lacks measurable conditions. Conditions should resolve to explicit Boolean facts, enum-like states, numeric comparisons, or numeric bounds that a solver and an executable test can evaluate.

### 2. Consistency

Detect an `UNSAT` contradiction across two or more interacting clauses. The check must account for interacting variables rather than only pairwise text similarity. When contradictory obligations can apply under the same concrete circumstances, return `UNSAT`, the minimal Unsat Core, and a Phantom Witness that demonstrates the collision.

### 3. Completeness

Search the declared input space for combinations that no rule or fallback state handles. A satisfying assignment for an uncovered region is evidence of a completeness gap and becomes a concrete witness.

### 4. Unambiguity

Flag overlapping `RuleScope` values or conflicting modal quantifiers on identical conditions. Report the involved rule IDs and the overlap that makes more than one interpretation possible.

### 5. Security & Liveness

Check all 60-CWE Spec Security Hardening obligations applicable to a specification, including gaps involving missing authentication, unvalidated input, injection, authorization or privilege risks such as CWE-862. Also check the **Sandbox That Blocks Normal Work** liveness property: cumulative deny or security rules must not make a legitimate primary workflow impossible. A blocked normal workflow is a liveness deadlock even when every individual restriction appears secure in isolation.

## `CovenantSolver` architecture

`packages/covenant-core` must expose one clean `CovenantSolver` interface with two conforming implementations and a shared deterministic result model.

### `BrowserDeterministicSolver`

- Zero dependencies
- Pure TypeScript
- SAT/DPLL Boolean solving plus numeric-interval bounds solving
- Under 15 ms for the pre-loaded verification cases inside any browser
- No `SharedArrayBuffer`
- No strict COOP/COEP headers
- No WASM download lag
- Deterministic result, rule ordering, Unsat Core, and witness for identical input

This implementation avoids the browser failure trap caused by running `z3-solver` WASM directly, particularly on Safari and static hosts that cannot safely provide strict COOP/COEP isolation.

### `NodeZ3Solver`

- Real `z3-solver` adapter
- Runs only in Node.js
- Used by Vitest for PBT equivalence cross-verification
- Used by the custom Kiro MCP Power under `powers/z3-covenant-power/`
- Never imported into or bundled with browser JavaScript

## Unsat Core extraction

The Unsat Core Extractor must:

1. Start with the rule IDs participating in the failing formal query.
2. Remove redundant members while preserving `UNSAT`.
3. Return a subset-minimal result: removing any remaining rule makes that particular contradiction disappear.
4. Preserve stable rule-ID ordering for deterministic output.
5. Return only the exact minimal conflicting subset, never the whole document unless every returned clause is required for that minimal contradiction.

## Phantom Witness synthesis

The Phantom Witness converts a failing solver state into a human-readable, concrete variable table. For example:

| Variable | Value |
| --- | --- |
| `UserRole` | `"Contractor"` |
| `EmergencyOverride` | `true` |
| `Day` | `"Sunday"` |

**Triggered result:** `Both ALLOW and DENY triggered simultaneously`.

The witness must be replayable against the AST and activate every rule in its Unsat Core. It must not substitute vague prose for concrete values.

## Two Cursed Chalices and preservation

Every detected issue receives exactly two concrete formal resolution options:

- **Chalice A:** One valid repair strategy with a source-level patch preview.
- **Chalice B:** A distinct valid repair strategy with a source-level patch preview.

Selecting a Chalice rewrites the source document live and immediately re-runs all applicable verification. Let `C` denote the clauses in the detected conflict and `~C` denote every non-conflicting clause. The Preservation Verifier must prove:

1. The selected patch fixes `C`.
2. 100% of clauses in `~C` remain intact.
3. Their meaning and prior non-conflicting behavior remain preserved.
4. Re-verification does not silently accept a failed or unknown result.

## Property-based testing

Use Vitest and `fast-check`, with at least 200 randomized runs for each property:

1. **Soundness:** Generated mutually exclusive rules always return `UNSAT` and a minimal Unsat Core.
2. **Preservation:** A Chalice patch fixes `C` without breaking any clause in `~C`.
3. **Solver Equivalence:** `BrowserDeterministicSolver` matches `NodeZ3Solver` backed by `z3-solver` for the same generated cases.

The compact OpenPBTStats-style distribution summary in the verification panel must show:

- valid edge cases
- duplicate cases
- discarded inputs

The same verification telemetry also reports solver latency in milliseconds and the number of clauses checked.

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

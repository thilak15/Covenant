# COVENANT Core Implementation Tasks

Work the frontier in order. A task is complete only after its listed command passes. Each task starts by adding the named failing test seam, then implements only enough production behavior to make that seam and the existing suite pass.

- [x] 1. Install and prove the three-workspace monorepo
  Status: resolved

  Blocked by: None

  **What it delivers:** A reproducible pnpm install and green build/typecheck baseline for `@covenant/core`, Spec Inquisitor, and Clause Exorcist, with strict TypeScript settings, browser-safe package exports, and the production-source policy check wired into builds.

  **Exact files to touch:**
  - `package.json`
  - `pnpm-workspace.yaml`
  - `pnpm-lock.yaml`
  - `tsconfig.json`
  - `packages/covenant-core/package.json`
  - `packages/covenant-core/tsconfig.json`
  - `packages/covenant-core/tsconfig.build.json`
  - `packages/covenant-core/vitest.config.ts`
  - `packages/covenant-core/scripts/check-loc.mjs`
  - `packages/covenant-core/src/index.ts`
  - `packages/covenant-core/test/package-boundary.test.ts`
  - `app-1-spec-inquisitor/package.json`
  - `app-1-spec-inquisitor/tsconfig.json`
  - `app-1-spec-inquisitor/vite.config.ts`
  - `app-1-spec-inquisitor/index.html`
  - `app-1-spec-inquisitor/src/main.tsx`
  - `app-2-clause-exorcist/package.json`
  - `app-2-clause-exorcist/tsconfig.json`
  - `app-2-clause-exorcist/vite.config.ts`
  - `app-2-clause-exorcist/index.html`
  - `app-2-clause-exorcist/src/main.tsx`

  **Test seam to write first:** `packages/covenant-core/test/package-boundary.test.ts`. Make it fail until the workspace contains exactly the three prescribed package names, each workspace extends the root strict TypeScript configuration, the root browser entry can be imported without a Node entry, and `check-loc.mjs` reports included production source while excluding tests, declarations, and `src/generated/` and rejecting explicit `any` without an artificial line threshold.

  - [x] Configure the package manifests and root scripts so `dev`, `build`, `test`, `test:pbt`, and `typecheck` traverse the intended workspaces without requiring a backend or secret.
  - [x] Add minimal static Vite entry points for both applications so the monorepo has a green baseline before application features begin.
  - [x] Configure the Core package to emit declarations and JavaScript while keeping the source root browser-safe.
  - [x] Implement the deterministic TypeScript source check, including `src/tribunal-ui/`, excluding tests, declarations, and `src/generated/`, reporting source size, and rejecting explicit `any` without a hard line cap.
  - [x] Generate and commit the pnpm lockfile with the Node 20 and pnpm 9.15 baseline.

  **Exact pnpm verification command:** `pnpm install --frozen-lockfile && pnpm --filter @covenant/core exec vitest run test/package-boundary.test.ts && pnpm build && pnpm typecheck`

  _Requirements: 1.1, 1.2, 16.1, 16.3, 16.4, 16.6, 16.7_

- [x] 2. Parse deterministic offline rules into the strict deontic AST
  Status: resolved

  Blocked by: 1

  **What it delivers:** Public, exact TypeScript domain values plus deterministic EARS and structured legal-clause parsing. Supported text becomes stable `Rule` nodes; malformed text remains source-located; recognized unsupported theory remains explicit and later yields `UNKNOWN` rather than invented meaning.

  **Exact files to touch:**
  - `packages/covenant-core/src/model.ts`
  - `packages/covenant-core/src/rational.ts`
  - `packages/covenant-core/src/condition.ts`
  - `packages/covenant-core/src/parser.ts`
  - `packages/covenant-core/src/index.ts`
  - `packages/covenant-core/test/parser.test.ts`
  - `packages/covenant-core/test/model-validation.test.ts`
  - `packages/covenant-core/test/condition-normalization.test.ts`

  **Test seam to write first:** `packages/covenant-core/test/parser.test.ts`. Drive `parseOffline(input: unknown)` through the public root entry with one supported EARS document, one supported structured legal clause, one malformed clause, and one syntactically valid unsupported-theory clause; assert stable IDs, UTF-16 source spans, exact reduced rationals, diagnostics, and byte-identical repeated parse output.

  - [x] Define readonly `CovenantDocument`, `Rule`, `RuleScope`, activation `Condition`, `DeonticModality`, solver evidence, verdict, repair, and telemetry contracts without `any`.
  - [x] Parse decimal source literals directly into reduced `BigInt` rationals and serialize numerator and denominator as base-10 strings.
  - [x] Validate unique declarations and rule IDs, source spans, enum domains, rational invariants, and at-least-two core constraints at the external boundary.
  - [x] Compile `RuleScope AND activation`, normalize negation, flatten Boolean composition, retain deterministic atom order, and separate `MAY` permission from hard consequences.
  - [x] Parse supported EARS and legal forms offline, preserve rejected source, and carry recognized unsupported constructs with exact provenance.
  - [x] Export only the browser-safe model, validation, parser, rational, and condition APIs from `@covenant/core`.

  **Exact pnpm verification command:** `pnpm --filter @covenant/core exec vitest run test/parser.test.ts test/model-validation.test.ts test/condition-normalization.test.ts && pnpm --filter @covenant/core build && pnpm typecheck`

  _Requirements: 1.1–1.5, 2.1–2.5, 3.1–3.6, 3.10, 11.1–11.6, 16.1, 16.4_

- [x] 3. Prove Consistency with BrowserDeterministicSolver, an Unsat Core, and a Phantom Witness
  Status: resolved

  Blocked by: 2

  **What it delivers:** `verifyCovenant(document, solver)` returns all five ordered `InquisitorVerdict` values, while the browser solver proves Boolean, enum, and exact numeric problems without WASM. A Consistency `FAIL` requires common applicability plus incompatible consequences and carries a deterministic subset-minimal `UnsatCore` and replayable `PhantomWitness`.

  **Exact files to touch:**
  - `packages/covenant-core/src/model.ts`
  - `packages/covenant-core/src/rational.ts`
  - `packages/covenant-core/src/condition.ts`
  - `packages/covenant-core/src/solver.ts`
  - `packages/covenant-core/src/browser-deterministic-solver.ts`
  - `packages/covenant-core/src/security-controls.ts`
  - `packages/covenant-core/src/inquisitors.ts`
  - `packages/covenant-core/src/engine.ts`
  - `packages/covenant-core/src/index.ts`
  - `packages/covenant-core/test/browser-consistency.test.ts`
  - `packages/covenant-core/test/browser-numeric.test.ts`
  - `packages/covenant-core/test/inquisitors.test.ts`
  - `packages/covenant-core/test/security-controls.test.ts`
  - `packages/covenant-core/test/browser-performance.test.ts`
  - `packages/covenant-core/test/fixtures/cursed-scrolls.ts`

  **Test seam to write first:** `packages/covenant-core/test/browser-consistency.test.ts`. Call public `verifyCovenant` with `BrowserDeterministicSolver` for three cases: jointly applicable incompatible hard consequences must produce the expected source-ordered subset-minimal core and replayable witness; mutually exclusive applicability must not produce a Consistency finding; overlapping `MAY X` and `MUST_NOT X` must fail Unambiguity without creating a Consistency contradiction.

  - [x] Implement the promise-based `CovenantSolver` overloads, tracked and untracked `SolverProblem` validation, typed `SAT`/`UNSAT`/`UNKNOWN` results, cancellation/budget handling, and separate live telemetry.
  - [x] Implement deterministic Boolean and enum search with exact interval intersection, including strict integer gaps, satisfiable decimal open intervals, disjunction branches, and unsupported-theory `UNKNOWN`.
  - [x] Discover interacting hard-rule candidates in deterministic dependency components and prove applicability before adding modal consequences.
  - [x] Minimize complete rule groups by reverse source-order removal and recheck every retained member for subset minimality.
  - [x] Canonicalize a witness from the minimized core's satisfiable applicability query, replay it against every core rule, and list incompatible consequences separately.
  - [x] Implement Testability, Completeness, Unambiguity, and the combined Security & Liveness Inquisitors, including the exact ordered 60-CWE manifest and declared primary-workflow deadlock checks.
  - [x] Aggregate exactly five verdicts with `FAIL > UNKNOWN > PASS` precedence and certify only five `PASS` values.
  - [x] Build `@covenant/core`, then benchmark each fixture's first verification and 20 warm calls from `dist/index.js` under Vitest with `performance.now()`, keeping every run under 15 ms; defer stable Chrome and Safari timing to manual pre-submission smoke testing on the deployed static Vite applications.

  **Exact pnpm verification command:** `pnpm --filter @covenant/core build && pnpm --filter @covenant/core exec vitest run test/browser-consistency.test.ts test/browser-numeric.test.ts test/inquisitors.test.ts test/security-controls.test.ts test/browser-performance.test.ts && pnpm typecheck`

  _Requirements: 3.7–3.10, 4.1–4.7, 5.1–5.6, 7.1–7.9, 8.1–8.6, 9.1–9.6, 10.1–10.10, 13.1–13.5, 16.1, 16.4_

- [ ] 4. Cross-verify the solver contract through the Node-only Z3 adapter
  Status: open

  Blocked by: 3

  **What it delivers:** `@covenant/core/node` exposes a real `z3-solver` implementation of the same asynchronous seam. Supported browser and Z3 decisions agree, SAT assignments replay, canonical tracked cores come from the shared minimizer, and browser source and bundles contain no Node/Z3 code.

  **Exact files to touch:**
  - `pnpm-lock.yaml`
  - `packages/covenant-core/package.json`
  - `packages/covenant-core/src/solver.ts`
  - `packages/covenant-core/src/node/node-z3-solver.ts`
  - `packages/covenant-core/src/node/index.ts`
  - `packages/covenant-core/src/index.ts`
  - `packages/covenant-core/test/node-z3-equivalence.test.ts`
  - `packages/covenant-core/test/browser-bundle-boundary.test.ts`
  - `packages/covenant-core/test/fixtures/browser-entry.ts`
  - `packages/covenant-core/test/fixtures/browser-vite.config.ts`

  **Test seam to write first:** `packages/covenant-core/test/node-z3-equivalence.test.ts`. Import `BrowserDeterministicSolver` from `@covenant/core` and `NodeZ3Solver` only from `@covenant/core/node`; run the same tracked and untracked Boolean, enum, integer, and exact decimal problems through both, assert equal status and canonical core IDs, require `core: null` for untracked `UNSAT`, and replay every SAT assignment.

  - [ ] Add `z3-solver` only to the Core package's Node/test dependency graph and expose it only through the conditional `./node` export.
  - [ ] Initialize Z3 asynchronously, encode enums exactly once, preserve Int versus Real semantics, and encode rationals as exact quotients.
  - [ ] Use the shared reverse-source minimizer instead of backend-specific core selection and validate every returned SAT assignment before accepting it.
  - [ ] Preserve unsupported theory as `UNKNOWN` without initializing Z3 and map adapter faults at the verification layer without weakening independent `FAIL` verdicts.
  - [ ] Build and inspect a browser fixture, rejecting Node built-ins, `z3-solver`, `NodeZ3Solver`, `.wasm`, and `SharedArrayBuffer` in the root export graph and output.

  **Exact pnpm verification command:** `pnpm --filter @covenant/core exec vitest run test/node-z3-equivalence.test.ts test/browser-bundle-boundary.test.ts && pnpm --filter @covenant/core build && pnpm typecheck`

  _Requirements: 4.1–4.6, 6.1–6.6, 14.7–14.11, 16.2, 16.4, 16.6_

- [ ] 5. Apply verified Two Cursed Chalices and run the fast-check proof suite
  Status: open

  Blocked by: 4

  **What it delivers:** Standard Consistency, Unambiguity, Security, and Liveness findings receive two distinct verified `ChalicePatch` options. Custom findings fail safely with `pair`, `single`, or `manual`; guarded application re-verifies the target and proves 100% preservation of every rule in `~C`. Node properties exercise Soundness, Preservation, and Solver Equivalence with at least 200 successful runs each.

  **Exact files to touch:**
  - `pnpm-lock.yaml`
  - `packages/covenant-core/package.json`
  - `packages/covenant-core/src/model.ts`
  - `packages/covenant-core/src/condition.ts`
  - `packages/covenant-core/src/repairs.ts`
  - `packages/covenant-core/src/engine.ts`
  - `packages/covenant-core/src/index.ts`
  - `packages/covenant-core/test/repairs.test.ts`
  - `packages/covenant-core/test/fixtures/repair-documents.ts`
  - `packages/covenant-core/test/pbt/arbitraries.ts`
  - `packages/covenant-core/test/pbt/soundness.pbt.test.ts`
  - `packages/covenant-core/test/pbt/preservation.pbt.test.ts`
  - `packages/covenant-core/test/pbt/solver-equivalence.pbt.test.ts`

  **Test seam to write first:** `packages/covenant-core/test/repairs.test.ts`. Start from one standard contradiction with an unrelated rule, require an A/B `ChalicePair` tied to one immutable Repair Core, apply each option from a clean revision through public `applyChalicePatch`, and assert distinct resulting rule models, disappearance of the target finding, no new finding fingerprint, unchanged source and semantic fingerprints for `~C`, and literal `preservationPercent: 100`; also assert atomic stale-revision and source-mismatch rejection.

  - [ ] Define collision-free canonical source, semantic, finding, and post-patch model strings; normalize commutative conditions and exact rationals before comparison.
  - [ ] Implement standard pair templates and enforce A-then-B ordering, shared finding/core/revision identity, in-core edits only, and distinct post-patch models.
  - [ ] Return honest `single` or `manual` payloads for custom findings without changing a proven `FAIL`.
  - [ ] Validate all guards before applying edits in descending offset order, then parse, run all five Inquisitors, reject failed/unknown required proof, and prevent partial mutation.
  - [ ] Generate jointly applicable contradictions, mutually exclusive rules, consequence-to-applicability conflicts, `C` plus independent `~C`, and supported tracked/untracked solver problems.
  - [ ] Run Soundness, Preservation, and Solver Equivalence with at least 200 successful `fast-check` cases per property; discards do not count, core removals must break the same contradiction, and every SAT model must replay.

  **Exact pnpm verification command:** `pnpm --filter @covenant/core exec vitest run test/repairs.test.ts && pnpm test:pbt && pnpm typecheck`

  _Requirements: 12.1, 12.3–12.18, 13.1–13.5, 14.1–14.11, 16.1, 16.4_

- [ ] 6. Export and format reproducible OpenPBTStats separately from live telemetry
  Status: open

  Blocked by: 5

  **What it delivers:** The seeded Node property suite emits a validated, checked-in `OpenPBTSnapshot`. Browser consumers read and format that static coverage record while live solver latency and clauses checked remain a separate `VerificationTelemetry` model.

  **Exact files to touch:**
  - `packages/covenant-core/package.json`
  - `packages/covenant-core/src/model.ts`
  - `packages/covenant-core/src/pbt-stats.ts`
  - `packages/covenant-core/src/generated/open-pbt-stats.json`
  - `packages/covenant-core/src/index.ts`
  - `packages/covenant-core/scripts/generate-open-pbt-stats.mts`
  - `packages/covenant-core/test/pbt/stats-recorder.ts`
  - `packages/covenant-core/test/pbt/soundness.pbt.test.ts`
  - `packages/covenant-core/test/pbt/preservation.pbt.test.ts`
  - `packages/covenant-core/test/pbt/solver-equivalence.pbt.test.ts`
  - `packages/covenant-core/test/pbt-stats.test.ts`

  **Test seam to write first:** `packages/covenant-core/test/pbt-stats.test.ts`. Import the checked-in snapshot and both public formatters; reject malformed property order and invalid counts, assert Soundness/Preservation/Solver Equivalence ordering, stable row output, duplicate and discard accounting, and prove that formatting `VerificationTelemetry` never adds PBT fields or mutates the snapshot.

  - [ ] Record requested and successful runs, edge-case tags, normalized-input duplicates, precondition discards, seed, and duration without counting discards as successes.
  - [ ] Generate the three-property snapshot from one reported fixed seed and validate it as `unknown` before exposing typed data to browser consumers.
  - [ ] Format exact PBT display rows and live solver rows through separate functions and keep browser imports free from `fast-check` and test execution.
  - [ ] Keep the generated JSON outside the LOC count while retaining deterministic build output and root browser-safe exports.

  **Exact pnpm verification command:** `pnpm --filter @covenant/core exec vitest run test/pbt-stats.test.ts && pnpm test:pbt && pnpm --filter @covenant/core build && pnpm typecheck`

  _Requirements: 14.1, 14.2, 15.1–15.5, 16.1, 16.3, 16.6, 16.7_

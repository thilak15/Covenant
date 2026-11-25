# Bug-Fix Preservation Requirements

## Problem Statement

`parseOffline` and `validateCovenantDocument` in `packages/covenant-core/src/parser.ts` accept a declared numeric variable whose `range` is inverted: the lower endpoint is greater than the upper endpoint, or the endpoints are equal and at least one is exclusive. No value can satisfy such a range. The parser returns `PARSED` or `VALID`, and the failure appears later: `BrowserDeterministicSolver.solve` calls `validateSolverProblem`, which throws `TypeError: Numeric declaration <name> has an invalid range`. A malformed declaration therefore passes the parser boundary and crashes the verification path instead of producing a diagnostic.

## Solution

Reject an inverted declared range at the parser boundary with the typed diagnostic code `INVERTED_NUMERIC_RANGE`. Prove with a dedicated `fast-check` property suite that every inverted range is rejected deterministically, and that every input that was valid before the fix produces identical ASTs, validation results, verdicts, and solver outputs after it. This is the `C` versus `~C` preservation pattern applied to the engine itself: `C` is the set of inputs with an inverted declared range, and `~C` is every other input.

## Terms

- **Inverted range**: a declared `NumericRange` where `lower.value > upper.value`, or `lower.value = upper.value` and `lower.inclusive` or `upper.inclusive` is `false`. An omitted endpoint never makes a range inverted.
- **Pre-fix parser**: `src/parser.ts` at commit `6483654`, frozen as `packages/covenant-core/test/fixtures/legacy-parser.ts` and used only as a differential oracle by tests.
- **Valid non-buggy input**: any input outside `C` that the pre-fix parser accepted and the solver can evaluate, including declared ranges that are bounded, one-sided, unbounded, or a single inclusive point.

## Requirement 1: Reject inverted declared ranges

**User Story:** As a COVENANT maintainer, I want an inverted declared numeric range rejected at the parser boundary, so that a malformed declaration yields a diagnostic instead of a solver exception.

### Acceptance Criteria

1.1 WHEN `parseOffline` receives a numeric variable declaration whose `range` is inverted, THE COVENANT Core SHALL return `status: "REJECTED"` with exactly one `ERROR` diagnostic whose `code` is `INVERTED_NUMERIC_RANGE` for that declaration.

1.2 WHEN `validateCovenantDocument` receives a document whose numeric variable declares an inverted `range`, THE COVENANT Core SHALL return `status: "INVALID"` with a diagnostic whose `code` is `INVERTED_NUMERIC_RANGE`.

1.3 WHEN the lower and upper endpoints of a declared range are equal and both are inclusive, THE COVENANT Core SHALL accept the range as a single-point range.

1.4 WHEN a declared range omits the lower endpoint, the upper endpoint, or both, THE COVENANT Core SHALL accept the range.

1.5 IF a declared range is inverted THEN THE COVENANT Core SHALL name the offending variable in the diagnostic message.

1.6 IF a declared range is inverted THEN THE COVENANT Core SHALL reject the input before any rule text is parsed or any solver is invoked.

## Requirement 2: Deterministic diagnostics

**User Story:** As a tooling author, I want the same inverted range to produce the same diagnostic every time, so that editors and the Kiro hooks can match on a stable code.

### Acceptance Criteria

2.1 WHEN the same input containing an inverted declared range is parsed repeatedly, THE COVENANT Core SHALL return structurally identical results, including diagnostic order, codes, severities, and messages.

2.2 THE COVENANT Core SHALL expose `INVERTED_NUMERIC_RANGE` as a diagnostic `code` string on `ParseDiagnostic` without widening the type of any other field.

2.3 WHEN a declared range is inverted, THE COVENANT Core SHALL compare endpoints as exact `BigInt` rationals and SHALL NOT use floating-point arithmetic.

## Requirement 3: Preservation of valid inputs

**User Story:** As a COVENANT maintainer, I want proof that the fix changes nothing for valid input, so that the two applications and all Cursed Sample Scrolls keep their pre-verified behavior.

### Acceptance Criteria

3.1 WHEN `parseOffline` receives an input outside `C` that the pre-fix parser accepted, THE COVENANT Core SHALL return a result structurally identical to the pre-fix parser, including the AST, source locations, and diagnostics.

3.2 WHEN `validateCovenantDocument` receives a document outside `C`, THE COVENANT Core SHALL return a result structurally identical to the pre-fix validator.

3.3 WHEN `verifyCovenant` runs on a document produced from an input outside `C`, THE COVENANT Core SHALL return `InquisitorVerdict` values identical to those produced from the pre-fix parser's document.

3.4 WHEN `BrowserDeterministicSolver` solves a problem built from a document outside `C`, THE COVENANT Core SHALL return the same status, model, and Unsat Core as for the pre-fix parser's document, and every `SAT` model SHALL replay against the problem.

3.5 IF an input is rejected for a reason other than an inverted range THEN THE COVENANT Core SHALL return the same diagnostics, in the same order, as the pre-fix parser.

3.6 WHILE a variable declares no `range`, THE COVENANT Core SHALL treat it exactly as the pre-fix parser did.

## Requirement 4: Property-based proof

**User Story:** As a hackathon judge, I want a reproducible property suite for the fix, so that preservation is demonstrated rather than asserted.

### Acceptance Criteria

4.1 WHEN `packages/covenant-core/test/bugfix-preservation.test.ts` runs, THE COVENANT Core test suite SHALL execute at least 200 successful `fast-check` runs for the inverted-range rejection property.

4.2 WHEN `packages/covenant-core/test/bugfix-preservation.test.ts` runs, THE COVENANT Core test suite SHALL execute at least 200 successful `fast-check` runs for the valid-input preservation property.

4.3 WHEN the suite runs with a fixed seed, THE COVENANT Core test suite SHALL produce the same generated cases and the same outcome on every run.

4.4 WHEN the suite runs against the pre-fix parser, THE COVENANT Core test suite SHALL fail the rejection property, proving the test detects the defect.

4.5 WHERE the pre-fix behavior is needed as an oracle, THE COVENANT Core test suite SHALL import the frozen copy under `packages/covenant-core/test/fixtures/` and SHALL NOT import it from `src/`.

## Requirement 5: Package and bundle boundaries

**User Story:** As a maintainer of the Skeleton Foundation, I want the fix to respect existing boundaries, so that no browser or Node guarantee regresses.

### Acceptance Criteria

5.1 THE COVENANT Core SHALL implement the fix inside `packages/covenant-core/src/parser.ts` using only existing exports from `./rational.js` and `./condition.js`, with no new runtime dependency.

5.2 THE COVENANT Core SHALL keep `z3-solver` and the Node adapter out of the browser export graph.

5.3 WHEN `pnpm build`, `pnpm typecheck`, and `pnpm test` run from the repository root, THE COVENANT Core SHALL pass all pre-existing tests unchanged, including `check:loc` and the browser bundle boundary test.

5.4 THE COVENANT Core SHALL contain no explicit `any` in the fix or the new tests.

## Known adjacent defect (out of scope)

The solver also treats an `INTEGER` range that contains no integer, such as lower `0` exclusive and upper `1` exclusive, as invalid and throws the same `TypeError`. This differs from an inverted range because the endpoints are ordered. It is recorded here, not fixed, because this spec is scoped to inverted ranges. A follow-up spec should decide whether the parser rejects it with its own diagnostic code.

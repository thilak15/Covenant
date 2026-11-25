# Bug-Fix Preservation Design

## Overview

The fix adds one validation step to the parser's variable-declaration check and proves, with differential property tests, that nothing else changes. Vocabulary follows `GLOSSARY.md`: `NumericBound`, `Rule`, `InquisitorVerdict`, `CovenantSolver`, `BrowserDeterministicSolver`. The `C` / `~C` notation matches the Preservation Property: `C` is inputs with an inverted declared range, `~C` is everything else.

No ADR is contradicted. ADR 0002 says malformed external input is rejected at the parser or compiler boundary; this fix moves one malformed class from the solver boundary, where it threw, to the parser boundary, where it belongs.

## Root cause

`variableCodes` in `parser.ts` validated a numeric declaration's `range` with `validateEndpoints`, which checks only that each endpoint has a boolean `inclusive` flag and a canonical rational `value`. It never compared the endpoints. `validateEndpoints` is shared with `NumericBound` condition validation, where an empty interval is a legitimate, solvable `UNSAT` atom (for example `x > 5 AND x < 3`), so the check cannot be added there.

Defect trace before the fix:

1. `parseOffline` with `range: { lower: 5 inclusive, upper: 1 inclusive }` returns `PARSED`.
2. `verifyCovenant` or `BrowserDeterministicSolver.solve` calls `validateSolverProblem`.
3. `rangeIsWellFormed` finds the range empty and throws `TypeError`.

## Fix

All changes are in `packages/covenant-core/src/parser.ts`.

- `isInvertedRange(range)`: returns `true` when both endpoints are present and `compareRationals(lower.value, upper.value)` is positive, or zero with either endpoint exclusive. It runs only after `validateEndpoints` succeeds, so endpoint values are already known to be canonical rationals. Comparison is exact `BigInt` arithmetic.
- `variableFailures(raw)` replaces `variableCodes`. It returns `{ code, message }` pairs instead of bare codes so the new diagnostic can name the variable. Every pre-existing code keeps its original message text, `Invalid variable declaration (<code>)`.
- New code `INVERTED_NUMERIC_RANGE`, with message `Numeric variable "<name>" declares an inverted range: ...`.
- `parseOffline` and `validateCovenantDocument` consume `variableFailures`. Both already stop on declaration failures before parsing rules (Requirement 1.6).

Alternatives considered:

| Option | Decision |
| --- | --- |
| Add the comparison inside `validateEndpoints` | Rejected. It would also reject solvable empty `NumericBound` conditions and change solver and inquisitor behavior. |
| Catch the `TypeError` in the solver and return `UNKNOWN` | Rejected. ADR 0002 places malformed input at the parser boundary, and an `UNKNOWN` verdict would hide a defect that can be proven. |
| Also reject integer ranges with no integer | Deferred. See "Known adjacent defect" in the requirements. |

## Components

| File | Change |
| --- | --- |
| `packages/covenant-core/src/parser.ts` | `isInvertedRange`, `variableFailures`, two call-site updates. |
| `packages/covenant-core/test/bugfix-preservation.test.ts` | New. Differential and property tests. |
| `packages/covenant-core/test/fixtures/legacy-parser.ts` | New. Frozen copy of the pre-fix parser. Only the import paths differ. |

No file under `src/` other than `parser.ts` changes, and no export changes, so the browser bundle and `@covenant/core/node` boundaries are untouched.

## Data model

`ParseDiagnostic.code` is already `string`, so `INVERTED_NUMERIC_RANGE` needs no model change. The diagnostic has `severity: "ERROR"` and `location: null` because declarations have no source span.

## Error handling

An inverted range yields `REJECTED` from `parseOffline` and `INVALID` from `validateCovenantDocument`. Both are existing result variants, so callers in the applications handle them already. Other declaration failures are unchanged, and the new check is `else if` after the existing `INVALID_VARIABLE` check, so a malformed endpoint still reports `INVALID_VARIABLE` rather than a second diagnostic.

## Testing

`packages/covenant-core/test/bugfix-preservation.test.ts`, fixed seed `20261201`, 200 runs per property:

| Test | Proves |
| --- | --- |
| Defect documentation | The legacy parser returns `PARSED` and the fixed parser returns `REJECTED` for a concrete inverted range. |
| (a) Rejection | For generated inverted ranges (lower above upper, and equal endpoints with at least one exclusive, in `INTEGER` and `DECIMAL`, with non-integer rationals): the legacy parser accepts; the fixed parser returns exactly `[INVERTED_NUMERIC_RANGE]`, repeated parses serialize identically, and `validateCovenantDocument` reports the same code. |
| (b) Preservation | For generated valid ranges (bounded, single point, one-sided, unbounded) and generated rule text: the fixed and legacy parser results serialize identically; validation results match; `verifyCovenant` verdicts match; `BrowserDeterministicSolver` output matches and every `SAT` model replays. |
| (c) Other rejections | Inputs rejected for unrelated declaration errors (duplicate variable, empty enum, reserved name) produce byte-identical results before and after. |

The generators produce valid `INTEGER` ranges that always contain an integer, because the empty-integer-range case is the documented out-of-scope defect. Results are compared with `stringifyCovenant`, which serializes `BigInt` rationals exactly. Solver telemetry (latency) is excluded from comparison because it is a separate `VerificationTelemetry` model and varies by run.

Existing tests are not edited. They are the second preservation witness: the sample scrolls in both applications declare ranges such as `[0, 1000]` and `[0, 100]`, which must still pass.

Test `bugfix-preservation.test.ts` was also run against the pre-fix `parser.ts` and fails properties (a) and the defect-documentation test, confirming it detects the bug.

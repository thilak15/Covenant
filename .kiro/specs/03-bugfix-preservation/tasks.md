# Bug-Fix Preservation Tasks

Work in order. Each task lists its blocking edges and a verification command. Terms follow `GLOSSARY.md`.

- [x] 1. Freeze the pre-fix parser as a differential oracle
  Status: resolved
  Blocked by: None
  **What it delivers:** `packages/covenant-core/test/fixtures/legacy-parser.ts`, a copy of `src/parser.ts` at commit `6483654` with only its import paths changed, so tests can compare behavior before and after the fix.
  **Verify:** `pnpm --filter @covenant/core typecheck`
  _Requirements: 4.4, 4.5_

- [x] 2. Write the failing preservation test
  Status: resolved
  Blocked by: 1
  **What it delivers:** `packages/covenant-core/test/bugfix-preservation.test.ts` with fixed seed `20261201`.
  - [x] 2.1 Defect-documentation test: legacy parser returns `PARSED`, fixed parser returns `REJECTED` with `INVERTED_NUMERIC_RANGE`.
  - [x] 2.2 Property (a): 200 runs over generated inverted ranges, covering lower above upper and equal endpoints with an exclusive side, in both numeric domains.
  - [x] 2.3 Property (b): 200 runs over generated valid ranges and rule text, comparing ASTs, validation results, `InquisitorVerdict` values, and `BrowserDeterministicSolver` output before and after.
  - [x] 2.4 Property (c): unrelated declaration rejections stay byte-identical.
  **Verify:** the test fails against the pre-fix `parser.ts` for 2.1 and 2.2, and passes for all four tests after Task 3.
  _Requirements: 1.1, 1.2, 2.1, 3.1, 3.2, 3.3, 3.4, 3.5, 4.1, 4.2, 4.3_

- [x] 3. Implement the fix in the parser
  Status: resolved
  Blocked by: 2
  **What it delivers:** `isInvertedRange` and `variableFailures` in `packages/covenant-core/src/parser.ts`, producing `INVERTED_NUMERIC_RANGE` with the variable name in the message; both `parseOffline` and `validateCovenantDocument` use it.
  **Verify:** `pnpm --filter @covenant/core exec vitest run test/bugfix-preservation.test.ts`
  _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 2.2, 2.3, 5.1, 5.4_

- [x] 4. Prove the existing suite is unchanged
  Status: resolved
  Blocked by: 3
  **What it delivers:** Green `pnpm build`, `pnpm typecheck`, and `pnpm test` at the repository root, with no existing test edited, including `check:loc`, the browser bundle boundary test, and both application sample-scroll tests.
  **Verify:** `pnpm build && pnpm typecheck && pnpm test`
  _Requirements: 3.6, 5.2, 5.3_

- [ ] 5. Follow-up: integer ranges that contain no integer
  Status: open
  Blocked by: 3
  **What it delivers:** A decision, in a separate spec, on whether the parser rejects an `INTEGER` declared range with no integer (for example `(0, 1)` exclusive) with its own diagnostic code. The solver currently throws the same `TypeError` for it. Not part of this fix.
  _Requirements: none (out of scope)_

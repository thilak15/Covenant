---
status: accepted
---

# Keep proof verdicts independent from repair availability and live PBT execution

A proven defect must remain visible even when COVENANT cannot safely synthesize two repairs for arbitrary user input, and browser verification must not spend its 15 ms budget running property tests. We separate proof verdicts from resolution payloads and export reproducible Node test statistics for static UI display.

## Decision

- `InquisitorVerdict` has `PASS`, `FAIL`, or `UNKNOWN` status and a property-specific evidence variant. The Tribunal UI renders these states as emerald SAT, crimson UNSAT, and amber UNKNOWN respectively.
- A mathematically proven contradiction or other proven property violation remains `FAIL` regardless of repair generation outcome.
- Resolution evidence is a discriminated union:
  - `pair` contains a verified `ChalicePair` identified as A and B.
  - `single` contains one verified `ChalicePatch` and the reason a second safe patch could not be produced.
  - `manual` contains the reason no safe automatic patch could be produced.
- Every standard Consistency, Unambiguity, Security, and Liveness pattern, including all six Cursed Sample Scrolls, must produce a verified `pair`. Custom or unsupported input may produce `single` or `manual` without weakening its verdict.
- A `ChalicePatch` identifies its finding, core, A/B slot when paired, repair strategy, target rule IDs, source revision, and guarded edits containing expected and replacement text.
- Paired patches must produce distinct normalized rule models. A verified patch may modify only rules in the conflict core, must resolve the finding, and must preserve source and semantic fingerprints for every rule outside the core.
- Vitest and `fast-check` run Soundness, Preservation, and Solver Equivalence in Node with at least 200 successful runs per property. Discarded generated inputs do not count toward the minimum.
- `OpenPBTStats` records requested runs, successful runs, tagged edge-case counts, duplicate runs, discarded runs, seed, and duration. A duplicate is a successful generated case whose normalized-input fingerprint appeared earlier in the same run.
- The Node verification suite exports typed, reproducible `OpenPBTStats` snapshots for the static applications. Live browser verification reads these snapshots and never executes the 200-run suites on the main thread.
- Live solver latency and clauses checked belong to separate `VerificationTelemetry`; the telemetry drawer composes it with `OpenPBTStats` without merging their models.

## Consequences

The UI cannot imply that a failed proof became uncertain merely because repair synthesis was incomplete. Standard demonstrations retain the Two Cursed Chalices guarantee, while custom input can fail safely and transparently without fabricated redlines or browser test stalls.

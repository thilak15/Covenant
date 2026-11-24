---
status: accepted
---

# Use exact rationals behind one asynchronous solver seam

COVENANT must give the browser interval solver and Node Z3 adapter identical mathematical inputs without floating-point drift, while keeping Z3 out of static browser bundles. We use a normalized exact constraint model behind one asynchronous `CovenantSolver` boundary and isolate the Z3 adapter in a Node-only package entry point.

## Decision

- `Condition` is a closed discriminated expression tree containing Boolean constants, Boolean facts, enum equality or inequality, `NumericBound`, conjunction, disjunction, and negation. Negation is normalized before solving.
- A `NumericBound` names one variable and its `INTEGER` or `DECIMAL` domain. It has optional lower and upper endpoints, each with an inclusive flag; omission means that side is unbounded, and equal inclusive endpoints express equality.
- Decimal source literals are parsed as canonical reduced rationals with a `BigInt` numerator and positive `BigInt` denominator. Serialized forms use base-10 strings for both values. Browser interval reasoning and Z3 Real constraints therefore use the same exact value.
- Integer and decimal domains remain distinct. For example, `x > 5 AND x < 6` is `UNSAT` for an integer and `SAT` for a decimal.
- Version 1 excludes variable-to-variable arithmetic and nonlinear expressions. A well-formed problem outside the supported theory returns `UNKNOWN`; it is never approximated.
- Boolean search checks normalized numeric atoms through exact interval intersection. A lower endpoint above an upper endpoint, or equal endpoints with either endpoint excluded, is `UNSAT`; Boolean disjunctions retain separate interval branches.
- `CovenantSolver` exposes one promise-based solve operation over a normalized, provenance-bearing `SolverProblem`. Both implementations return the same discriminated result model:
  - `SAT` carries a replayable assignment.
  - `UNSAT` carries the canonical rule-level `UnsatCore`.
  - `UNKNOWN` carries a typed reason such as unsupported theory, timeout, or resource limit.
- Malformed external input is rejected at the parser or compiler boundary. Adapter faults are not logical results; the verification layer exposes them as `UNKNOWN` and blocks certification.
- `PhantomWitness` synthesis is a verification-layer operation above the raw contradiction query because an `UNSAT` query cannot provide a model.
- `BrowserDeterministicSolver` is a zero-runtime-dependency TypeScript implementation using deterministic Boolean search and exact interval reasoning. Its live preloaded verification path must remain under 15 ms and does not run the property-test suite.
- `NodeZ3Solver` is available only through a Node-specific entry point such as `@covenant/core/node`. The package root and browser export graph must not import it or `z3-solver` transitively.
- Solver-equivalence properties require identical status and canonical core rule IDs for supported problems. Satisfying assignments may differ between backends, but each must replay successfully; shared witness canonicalization produces the human-facing assignment.

## Consequences

All solver calls share an asynchronous shape because Z3 initialization is asynchronous. Exact rational arithmetic costs more than native floating point but prevents browser/Z3 disagreements for money, percentages, strict bounds, and interval endpoints.

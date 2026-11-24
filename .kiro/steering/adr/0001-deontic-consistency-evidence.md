---
status: accepted
---

# Define contradictions from common applicability and incompatible consequences

COVENANT must distinguish a genuine deontic contradiction from rules that can never trigger together. We define a rule as a stable document-scoped ID, source locator, structured `RuleScope`, activation `Condition`, one `DeonticModality`, and one consequence `Condition`; the scope compiles through the same normalized expression engine as an implicit conjunct, `scope AND activation`.

## Decision

- `MUST` requires the consequence whenever the rule applies.
- `MUST_NOT` requires the negation of the consequence whenever the rule applies.
- `MAY` records explicit permission without adding a hard satisfiability constraint. An overlapping `MAY X` and `MUST_NOT X` is an Unambiguity failure rather than a Consistency contradiction.
- A Consistency contradiction requires both of these proofs:
  1. The conjunction of every candidate rule's scope and activation is `SAT`. Its canonical model becomes the `PhantomWitness`.
  2. Adding every candidate rule's modal consequence makes the query `UNSAT`.
- If the first query is `UNSAT`, the rules are mutually exclusive and cannot be reported as a Consistency contradiction.
- Core minimization treats every constraint emitted by one rule atomically. An `UnsatCore` records the contradiction-query ID, incompatible consequences, and source-ordered rule IDs.
- Cores are subset-minimal, not minimum-cardinality. The minimizer starts with source-ordered candidates and attempts removals in reverse source order, deterministically preferring earlier rules when several cores are possible.
- A Consistency core contains at least two rules. An impossible individual rule is a validation or Testability finding.
- A `PhantomWitness` assigns the scope and activation variables required to replay every core rule and separately lists the incompatible triggered consequences. It is not represented as a model of the impossible consequence conjunction.
- Witness variables use stable ordering. Numeric values are chosen through satisfiability-preserving probes that prefer included finite endpoints ordered by absolute value, then zero, then positive integers in ascending order, then a finite midpoint or nearest exact rational. This prevents arbitrary large solver values from leaking into the witness card.

## Consequences

Consistency checking performs a satisfiable applicability query before the contradiction query. Witness synthesis remains valid even though an `UNSAT` consequence query has no model, and mutually exclusive clauses cannot create false contradictions.

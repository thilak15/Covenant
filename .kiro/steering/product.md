# COVENANT Product

## Submission

- **Project:** COVENANT
- **Event:** Kiroween 2026
- **Category:** Skeleton Crew
- **Judging availability:** The static applications must remain fully usable through January 22, 2027.

## Core concept and value proposition

COVENANT is a neuro-symbolic **Contradiction & Loophole Exorcist** skeleton. It translates natural-language rules, including EARS software specifications and legal contract clauses, into formal deontic logic. It uses formal SMT/SAT solving to detect subtle multi-variable logical contradictions, security and liveness traps, and financial loopholes. For every proven conflict, COVENANT extracts the subset-minimal conflicting rule set, called the **Unsat Core**, and synthesizes a concrete breaking scenario, called the **Phantom Witness**. Standard supported patterns and all six Cursed Sample Scrolls present **Two Cursed Chalices**, two verified formal resolutions. Custom input may instead receive one verified patch or a manual-repair reason without weakening its `FAIL` verdict. Selecting a Chalice patches the document in real time and proves that 100% of non-conflicting clauses remain preserved.

## Shared Skeleton Foundation

`packages/covenant-core` is the lean shared Skeleton Foundation, published to the workspaces as `@covenant/core`, with a target of fewer than 1,200 lines of code.

### Shared domain model and compiler

The compiler parses structured source clauses into typed domain nodes and records:

- `Rule`
- `DeonticModality`: `MUST` | `MUST_NOT` | `MAY`
- `Condition`, with Boolean logic, enum comparisons, and exact numeric bounds
- `NumericBound`
- `RuleScope`
- `UnsatCore`
- `PhantomWitness`
- `ChalicePatch`
- `ChalicePair`
- `ResolutionPayload`: `pair` | `single` | `manual`
- `InquisitorVerdict`
- `OpenPBTStats`

### The 5 Hooded Inquisitors

The five formal verification properties are:

1. **Testability:** Flags vague, untestable, or subjective language that lacks measurable conditions.
2. **Consistency:** Detects `UNSAT` logical contradictions across two or more interacting rules and extracts a subset-minimal Unsat Core.
3. **Completeness:** Detects unhandled input-space combinations and missing fallback states.
4. **Unambiguity:** Flags overlapping scopes or conflicting modal quantifiers on identical conditions.
5. **Security & Liveness:** Checks 60-CWE Spec Security Hardening obligations and detects the **Sandbox That Blocks Normal Work** liveness deadlock, where cumulative deny or security rules inadvertently block legitimate primary workflows.

### Conflict evidence and repair

- **Unsat Core Extractor:** Isolates a stable, rule-level, subset-minimal set of rule IDs for one contradiction. It never dumps the whole document in place of the required core.
- **Phantom Witness Synthesizer:** Solves the conjunction of the core rules' scopes and activations, then renders the canonical model as a human-readable table. Example: `UserRole = "Contractor"`, `EmergencyOverride = true`, `Day = "Sunday"` triggers `Both ALLOW and DENY simultaneously`.
- **Two Cursed Chalices Patcher and Preservation Verifier:** Produces a verified Chalice A and Chalice B for every standard supported pattern and all six Cursed Sample Scrolls. Custom input may produce a verified pair, one verified patch with a reason, or a manual-repair reason; repair availability never changes a proven `FAIL`. Selecting a patch rewrites the source document live, re-runs verification, and proves the Preservation Property: conflict set `C` is fixed while 100% of non-conflicting clauses `~C` remain intact.

### Property-based verification

COVENANT uses Vitest and `fast-check` in Node with at least 200 successful runs per property to verify:

1. **Soundness:** Generated jointly applicable rules with incompatible hard consequences always return `UNSAT` with a subset-minimal Unsat Core, while mutually exclusive rules never report a Consistency contradiction.
2. **Preservation:** Clauses in `~C` never break after a Chalice patch fixes `C`.
3. **Solver Equivalence:** The browser deterministic solver matches Node `z3-solver` results.

The verification suite exports typed `OpenPBTStats` snapshots showing valid edge cases, duplicates, and discarded inputs. The static applications display those snapshots but do not run the 200-case suites during live browser verification.

## Locked solver and deployment decisions

### Browser COOP/COEP and SharedArrayBuffer failure trap

Running `z3-solver` WASM directly in a browser requires `SharedArrayBuffer` and strict COOP/COEP headers, which break on Safari and many static hosts. Therefore, `packages/covenant-core` must expose a clean `CovenantSolver` interface with two implementations:

1. **`BrowserDeterministicSolver`:** A zero-dependency, pure-TypeScript SAT/DPLL and numeric-interval bounds solver. It must run in under 15 ms in any browser, require no COOP/COEP headers, and incur no WASM download lag.
2. **`NodeZ3Solver`:** A real `z3-solver` adapter that runs in Node.js for Vitest PBT equivalence cross-verification and inside the custom Kiro MCP Power at `powers/z3-covenant-power/`.

`z3-solver` must never be bundled into browser JavaScript.

### Judge zero-friction and January 22, 2027 uptime trap

Judges must not need a login, Docker setup, API keys, or an expiring trial backend. Both applications must deploy as 100% static, client-side Vite applications with zero login and zero crashable server dependencies. Every application includes:

1. Three pre-loaded, one-click **Cursed Sample Scrolls** with pre-verified ASTs, 0 ms API latency, $0 cost, and guaranteed operation through January 22, 2027.
2. A built-in deterministic offline EARS/Clause parser so judges can edit or paste custom text completely offline with zero API keys.
3. An optional BYOK LLM translator hook that enhances arbitrary freeform prose when a user supplies a key. It gracefully falls back to the deterministic offline parser whenever no key is set or a rate limit is reached.

### Skeleton Crew modularity

Both applications must import their solver, parser, PBT statistics formatter, and shared Haunted Tribunal UI components directly from `@covenant/core`. They must not duplicate core logic.

## Shared Haunted Gothic Tribunal UI

Shared UI code belongs in `packages/covenant-core/src/tribunal-ui/`.

### Visual direction

Use a bespoke Gothic Inquisition Tribunal: obsidian slate, aged vellum, tarnished brass, emerald SAT glow, and blood-crimson UNSAT flare. Do not use generic neon-purple SaaS cards.

### Shared interactive components

1. **The 5 Hooded Inquisitors Header Bar:** Lanterns burn emerald on `PASS`, flare crimson on `FAIL`, and glow amber on `UNKNOWN`. Each Inquisitor is clickable to filter findings.
2. **Split Scroll / Clause Inspector:** Source text appears on the left. Conflicting lines are highlighted in crimson and linked to Unsat Core IDs.
3. **The Phantom Witness Stand:** Shows the concrete breaking variable assignment as a card.
4. **The Two Cursed Chalices Resolution Panel:** Shows Chalice A and B side by side when a verified pair exists. For custom input with fewer safe repairs, it shows the verified single patch or manual-repair reason without weakening the finding. Clicking a patch applies it live and triggers re-verification.
5. **Crimson Wax Seal of Formal Certification:** Applies an animated stamp once all five Inquisitors reach `PASS`.
6. **Compact OpenPBTStats / Verification Telemetry Drawer:** Shows solver latency in milliseconds, clauses checked, and PBT coverage statistics.

## Application 1: Spec Inquisitor

- **Path:** `app-1-spec-inquisitor/`
- **Audience:** Software engineers and DevSecOps practitioners
- **Purpose:** Software Specs, RBAC, 60-CWE Security & Sandbox Liveness Auditor
- **Visual skin:** Alchemical DevSecOps Parchment & Brass Oscilloscope aesthetic
- **Domain:** `.kiro/specs/` EARS requirements, API RBAC rules, and Agent Sandbox/IAM configurations
- **Capabilities:** Catches three-variable RBAC/spec contradictions, 60-CWE Spec Security Hardening gaps such as missing authentication, unvalidated inputs, injection risks, and privilege risks, plus Sandbox That Blocks Normal Work liveness deadlocks.
- **Export action:** Exports patched EARS `requirements.md` and auto-generates an executable `fast-check` property-based test snippet.

### Pre-loaded Cursed Scrolls

1. Multi-Role RBAC Emergency Override Contradiction
2. Over-Hardened Agent Sandbox Liveness Deadlock
3. API Rate-Limit & CWE-862 Security Gap Spec

## Application 2: Clause Exorcist

- **Path:** `app-2-clause-exorcist/`
- **Audience:** Startup founders, freelancers, and Legal/Ops practitioners
- **Purpose:** SaaS Contracts, SLAs & Legal Loophole Auditor
- **Visual skin:** Candlelit Victorian Chancery & Crimson Wax Seal aesthetic
- **Domain:** SaaS vendor contracts, freelance agreements, SLA riders, and data privacy riders
- **Capabilities:** Catches hidden financial liability traps, contradictory SLA uptime credits versus uncapped indemnification loopholes, conflicting IP ownership versus background-IP clauses, and impossible notice/cure-period deadlocks.
- **Export action:** Exports a protective Legal Redline diff and a plain-English negotiation summary.

### Pre-loaded Cursed Scrolls

1. SaaS Liability Cap vs. Uncapped Indemnification Loophole
2. Freelance IP Assignment & Kill-Fee Contradiction
3. Enterprise SLA Penalty & Force Majeure Deadlock

## Kiro judging multipliers to build in later specs

- `.kiro/specs/01-covenant-core/`: Core engine EARS requirements, design, and tasks.
- `.kiro/specs/02-haunted-tribunal-ui/`: UI design system, dual-application requirements, design, and tasks.
- `.kiro/specs/03-bugfix-preservation/`: Dedicated Bug-Fix Preservation Spec demonstrating `C` versus `~C` preservation properties on a real solver edge case.
- `.kiro/hooks/verify-on-save.json`: Automatically runs core PBT tests and cross-application typechecking on save, plus an EARS audit when a spec is saved.
- `powers/z3-covenant-power/`: `POWER.md` and `mcp.json` wrapping Node `z3-solver` and 60-CWE specification checks for dynamic, on-demand loading.
- **Kiro Crew integration:** A three-agent pipeline, Formalizer -> Z3 Inquisitor -> Redline & PBT Synthesizer, watches `.kiro/specs/` for the Best Kiro Crew App bonus prize.

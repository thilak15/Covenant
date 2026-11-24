# COVENANT Tech Stack

## Locked technologies

- pnpm workspaces
- TypeScript 5 in strict mode with `noImplicitAny` and a zero-`any` code policy
- React 19
- Vite
- Tailwind CSS
- Framer Motion
- Lucide Icons
- Vitest
- `fast-check`
- `z3-solver`, restricted to Node development, testing, and MCP execution; never bundled into browser JavaScript

Use `unknown` plus explicit narrowing instead of `any`. TypeScript's compiler prevents implicit `any` through `strict` and `noImplicitAny`; when linting is introduced, it must enforce `@typescript-eslint/no-explicit-any` as an error so explicit `any` is also rejected.

## Workspace topology

`pnpm-workspace.yaml` directly maps exactly these three workspaces:

| Workspace | Responsibility |
| --- | --- |
| `packages/covenant-core` | Lean shared Skeleton Foundation, consumed as `@covenant/core`, with a target below 1,200 LOC |
| `app-1-spec-inquisitor` | Separate root application for software specifications, RBAC, 60-CWE security, and sandbox liveness auditing |
| `app-2-clause-exorcist` | Separate root application for SaaS contracts, SLAs, and legal loophole auditing |

The root `package.json` exposes `dev`, `build`, `test`, `test:pbt`, and `typecheck` scripts. Every workspace will extend the root strict TypeScript configuration when application implementation begins.

## Shared package boundary

Both applications must import all of the following directly from `@covenant/core`:

- `CovenantSolver` and the browser solver
- deterministic offline EARS/Clause parser
- PBT statistics formatter
- shared Haunted Tribunal UI components from `packages/covenant-core/src/tribunal-ui/`

Do not duplicate core solver, parser, telemetry, or shared UI logic in either application.

## Solver runtime boundary

`packages/covenant-core` exposes one promise-based `CovenantSolver` interface over normalized, provenance-bearing problems and two implementations:

- **`BrowserDeterministicSolver`:** Zero-runtime-dependency pure-TypeScript SAT/DPLL plus exact rational numeric-interval bounds solver. It must complete pre-loaded cases in under 15 ms inside any browser, with no live PBT execution, `SharedArrayBuffer`, COOP/COEP headers, or WASM download.
- **`NodeZ3Solver`:** A real `z3-solver` adapter exposed only through a Node-specific entry point such as `@covenant/core/node`. It runs in Vitest PBT solver-equivalence checks and in `powers/z3-covenant-power/`.

The browser export graph must not import `NodeZ3Solver` or `z3-solver`. Production Vite bundles must contain no Z3 WASM or Node adapter code.

## Application runtime and hosting

Both React 19 applications are 100% static, client-side Vite builds:

- zero login
- zero Docker requirement
- zero required API keys
- zero crashable server dependencies
- no COOP/COEP requirement
- no expiring trial backend
- guaranteed offline sample and parser operation through January 22, 2027

Each application ships three one-click Cursed Sample Scrolls with pre-verified ASTs for 0 ms API latency and $0 cost. A deterministic offline parser handles edited and pasted EARS requirements or legal clauses. An optional BYOK LLM translator can enhance arbitrary freeform prose, but it must fall back gracefully to the offline parser when no key is supplied or rate limiting occurs.

## UI stack and direction

React 19, Tailwind CSS, Framer Motion, and Lucide Icons implement the shared Haunted Gothic Tribunal UI. The visual system uses obsidian slate, aged vellum, tarnished brass, emerald SAT glow, and blood-crimson UNSAT flare. Generic neon-purple SaaS cards are prohibited.

Shared components live in `packages/covenant-core/src/tribunal-ui/`: the 5 Hooded Inquisitors Header Bar, Split Scroll / Clause Inspector, Phantom Witness Stand, Two Cursed Chalices Resolution Panel, Crimson Wax Seal of Formal Certification, and compact OpenPBTStats / Verification Telemetry Drawer.

## Verification stack

Vitest and `fast-check` run in Node with at least 200 successful cases per formal property; discarded inputs do not count toward that minimum:

- Soundness, including jointly applicable contradictions, subset-minimal Unsat Core behavior, and rejection of false contradictions between mutually exclusive rules
- `C` versus `~C` Chalice-patch preservation
- Browser deterministic solver versus Node `z3-solver` equivalence

The Node suite exports typed `OpenPBTStats` snapshots containing successful runs, tagged edge cases, normalized-input duplicates, discarded inputs, seed, and duration. The static applications display these snapshots without executing the randomized suites during live verification. Runtime latency and clauses checked remain separate `VerificationTelemetry`.

The later `.kiro/hooks/verify-on-save.json` hook will run core PBT tests and cross-application typechecking on save, and perform an EARS audit when a file under `.kiro/specs/` is saved.

## Repository policy

- Keep `.kiro/` and `powers/` tracked in Git.
- Keep secrets in local environment files; `.env` and `.env.local` remain ignored.
- Never place a required service, secret, account, or paid backend on the judge path.
- Preserve the Node-only boundary around `z3-solver`.

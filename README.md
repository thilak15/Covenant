# COVENANT

**Contradiction & Loophole Exorcist.** COVENANT turns natural-language rules into formal deontic logic and proves whether their obligations can coexist. For each proven conflict it returns a subset-minimal **Unsat Core**, a concrete **Phantom Witness**, and **Two Cursed Chalices**: two verified repairs. Picking a Chalice rewrites the document and proves that every non-conflicting clause is preserved.

Kiroween 2026, **Skeleton Crew** entry. One shared skeleton, `@covenant/core`, powers two static apps:

- **Spec Inquisitor** (`app-1-spec-inquisitor`): EARS requirements, RBAC, 60-CWE security gaps, and the sandbox that blocks normal work. Exports patched `requirements.md` and a `fast-check` test.
- **Clause Exorcist** (`app-2-clause-exorcist`): SaaS contracts, SLAs, IP and liability loopholes. Exports a Legal Redline diff and a plain-English negotiation summary.

Both apps are 100% client-side. There is no login, API key, Docker or backend. Each ships three one-click Cursed Sample Scrolls, and a deterministic offline parser handles pasted text.

## Quick links

| | |
| --- | --- |
| Spec Inquisitor (live) | `TODO: https://<spec-inquisitor-url>` |
| Clause Exorcist (live) | `TODO: https://<clause-exorcist-url>` |
| Demo video (YouTube) | `TODO: https://youtu.be/<video-id>` |

## Architecture

| Path | Role |
| --- | --- |
| `packages/covenant-core` | Shared `@covenant/core`: typed domain model, offline EARS/clause parser, five Inquisitors, Unsat Core and Phantom Witness, Chalice patcher and Preservation Verifier, `BrowserDeterministicSolver`, `NodeZ3Solver` (Node-only entry `@covenant/core/node`), `OpenPBTStats` formatter, and the Haunted Tribunal UI (`src/tribunal-ui/`). |
| `app-1-spec-inquisitor` | Vite + React 19 app for software specs. Imports everything from `@covenant/core`. |
| `app-2-clause-exorcist` | Vite + React 19 app for contracts. Imports everything from `@covenant/core`. |
| `.kiro/` | `steering/` (glossary, ADRs, stack, SMT formalization); `specs/` with `01-covenant-core`, `02-haunted-tribunal-ui` and `03-bugfix-preservation` (a `C` vs `~C` preservation spec on a real parser edge case); `hooks/` (verify on save, EARS audit); `crew/` (the three-agent pipeline). |
| `.kiro/crew/` | Kiro Crew pipeline: Formalizer, then Z3 Inquisitor, then Redline & PBT Synthesizer. See `covenant-crew.json` and `agents/`. |
| `powers/z3-covenant-power/` | Kiro Power with a stdio MCP server (`verify_covenant_z3`, `audit_cwe_controls`, `apply_chalice_patch_z3`) that runs real Z3 through `NodeZ3Solver`. |

### Solver boundary

The browser uses `BrowserDeterministicSolver`, a pure-TypeScript SAT/DPLL and exact-rational interval solver. It needs no WASM, `SharedArrayBuffer` or COOP/COEP headers. `z3-solver` runs only in Node: in Vitest equivalence tests and in the MCP Power. A test builds both apps and checks that no Z3 or Node adapter code reaches the browser bundles.

### Kiro features used

- **Specs and steering:** three specs plus glossary and ADRs keep terminology consistent.
- **Hooks:** `verify-on-save` runs core tests and typecheck when `packages/covenant-core/src/` changes. `ears-spec-audit` audits EARS syntax and contradictions when a `requirements.md` is saved.
- **Power:** `powers/z3-covenant-power/` gives Kiro on-demand access to real Z3 proofs.
- **Crew:** `.kiro/crew/` chains the three agents over `.kiro/specs/`.

## Run locally

Requires Node 20+ and pnpm 9.

```bash
pnpm install
pnpm build        # builds @covenant/core, then both apps
pnpm test         # all workspace tests, including the Z3 MCP integration test and bundle-isolation checks
pnpm test:pbt     # Soundness, Preservation and Solver Equivalence property tests; regenerates OpenPBTStats
pnpm typecheck
```

Run an app in development (build once first so `@covenant/core` has a `dist/`):

```bash
pnpm --filter @covenant/spec-inquisitor dev    # Spec Inquisitor
pnpm --filter @covenant/clause-exorcist dev    # Clause Exorcist
pnpm dev                                       # core watch build and both apps together
```

## Use the Z3 Power

After `pnpm build`, Kiro can load `powers/z3-covenant-power/` and call its three tools. See [`POWER.md`](powers/z3-covenant-power/POWER.md) for inputs and the recommended workflow.

## License

MIT. See [`LICENSE`](LICENSE).

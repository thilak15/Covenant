# Haunted Tribunal UI and Applications Implementation Tasks

Task numbers continue from the COVENANT Core checklist. Work the frontier in order. A task is complete only after its listed command passes. Add the named failing test seam before changing production code.

- [x] 7. Establish shared Tribunal tokens and the Five Hooded Inquisitors Lantern Bar
  Status: resolved

  Blocked by: 6

  **What it delivers:** Both applications can import one browser-safe Tribunal theme and one accessible, responsive Lantern Bar from `@covenant/core`. The two skins use the normative obsidian, vellum, brass, emerald, crimson, and amber state language, self-hosted fonts, centralized motion, and no purple or network font dependency.

  **Exact files to touch:**
  - `pnpm-lock.yaml`
  - `packages/covenant-core/package.json`
  - `packages/covenant-core/vitest.config.ts`
  - `packages/covenant-core/src/index.ts`
  - `packages/covenant-core/src/tribunal-ui/index.ts`
  - `packages/covenant-core/src/tribunal-ui/types.ts`
  - `packages/covenant-core/src/tribunal-ui/motion.ts`
  - `packages/covenant-core/src/tribunal-ui/Tribunal.tsx`
  - `packages/covenant-core/src/tribunal-ui/tribunal.css`
  - `packages/covenant-core/src/tribunal-ui/fonts/alegreya-latin.woff2`
  - `packages/covenant-core/src/tribunal-ui/fonts/bodoni-moda-latin.woff2`
  - `packages/covenant-core/src/tribunal-ui/fonts/commissioner-latin.woff2`
  - `packages/covenant-core/src/tribunal-ui/fonts/fragment-mono-latin.woff2`
  - `packages/covenant-core/test/setup-react.ts`
  - `packages/covenant-core/test/tribunal-ui/inquisitor-lantern-bar.test.tsx`
  - `packages/covenant-core/test/tribunal-ui/theme-contract.test.tsx`

  **Test seam to write first:** `packages/covenant-core/test/tribunal-ui/inquisitor-lantern-bar.test.tsx`. Render the public `InquisitorLanternBar` with the invariant five-verdict tuple, then assert formal order, full names, verdict words, counts, non-color icons, controlled filtering, tablist semantics, Arrow/Home/End navigation, Enter/Space activation, one aggregate announcement, and the reduced-motion no-stagger branch.

  - [x] Add React 19, Framer Motion, Lucide Icons, and DOM test dependencies without exposing Node-only Core modules to browser consumers.
  - [x] Map every normative `DESIGN.md` token to stable `--cov-*` properties and expose `@covenant/core/tribunal.css` with CSS retained as a side effect.
  - [x] Self-host the four subsetted WOFF2 files with documented fallback stacks and no remote font URL.
  - [x] Implement `TribunalTheme`, shared prop contracts, semantic status aliases, responsive shell rules, focus styles, forced-colors behavior, and reduced-motion variants.
  - [x] Implement the controlled Lantern Bar with exactly five tabs in formal order and preserve the immutable `VerificationReport` while filtering.
  - [x] Assert approved contrast pairs and reject purple/violet/magenta/indigo tokens or decorations.

  **Exact pnpm verification command:** `pnpm --filter @covenant/core exec vitest run test/tribunal-ui/inquisitor-lantern-bar.test.tsx test/tribunal-ui/theme-contract.test.tsx && pnpm --filter @covenant/core build && pnpm typecheck`

  _Requirements: 1.1–1.7, 2.1–2.7, 3.1–3.6, 4.1–4.6, 13.1, 13.3–13.6, 14.1, 14.4, 15.1–15.3, 15.7, 15.8, 16.3_

- [x] 8. Link the Split Scroll Inspector to the Phantom Witness Stand
  Status: resolved

  Blocked by: 7

  **What it delivers:** Reviewers can move between authoritative source clauses and formal evidence without losing focus. A selected Consistency finding highlights only its `UnsatCore`, and the Stand renders and copies an exact, stable, replayable `PhantomWitness` separately from incompatible consequences.

  **Exact files to touch:**
  - `packages/covenant-core/src/tribunal-ui/types.ts`
  - `packages/covenant-core/src/tribunal-ui/Tribunal.tsx`
  - `packages/covenant-core/src/tribunal-ui/tribunal.css`
  - `packages/covenant-core/src/tribunal-ui/index.ts`
  - `packages/covenant-core/src/index.ts`
  - `packages/covenant-core/test/tribunal-ui/source-evidence-linkage.test.tsx`
  - `packages/covenant-core/test/tribunal-ui/phantom-witness-stand.test.tsx`

  **Test seam to write first:** `packages/covenant-core/test/tribunal-ui/source-evidence-linkage.test.tsx`. Render `SplitScrollInspector` from a complete fixture report, select a Consistency finding, and assert exact source slicing, line and rule-ID gutters, core-only highlighting, bidirectional source/evidence links, hover/focus behavior without focus theft, clause activation, retained filter/selection after re-verification, and keyboard resizing bounded from 30% to 70% with reset.

  - [x] Render clause boundaries from `SourceLocation` rather than guessing from lines; preserve diagnostics and the original source when parsing is rejected.
  - [x] Link finding references to stable clause anchors and identify core membership only from `ConsistencyEvidence.core.ruleIds`.
  - [x] Provide non-color markers for core membership and additions, removals, and replacements.
  - [x] Implement editable source with a stable adjacent ID gutter and nearest-valid source-position restoration.
  - [x] Render witness assignments as a semantic exact-value table, followed by activated core IDs and incompatible triggered consequences.
  - [x] Produce deterministic plain-text copy evidence and expose clipboard denial recovery without converting rationals through `Number`.
  - [x] Stack panes below 1024px while retaining source-first DOM order and preventing page-level overflow at 320px.

  **Exact pnpm verification command:** `pnpm --filter @covenant/core exec vitest run test/tribunal-ui/source-evidence-linkage.test.tsx test/tribunal-ui/phantom-witness-stand.test.tsx && pnpm --filter @covenant/core build && pnpm typecheck`

  _Requirements: 5.1–5.7, 6.1–6.5, 13.2–13.6, 14.2–14.6, 15.1–15.8, 16.3_

- [x] 9. Complete verified Chalice, certification seal, and telemetry drawer interactions
  Status: resolved

  Blocked by: 8

  **What it delivers:** The shared evidence stack displays honest `pair`, `single`, and `manual` repairs; applies a selected patch only after inline guarded review; shows 100% preservation only from a valid proof; stamps certification only after five `PASS` verdicts; and clearly separates live solver telemetry from checked-in OpenPBTStats.

  **Exact files to touch:**
  - `packages/covenant-core/src/tribunal-ui/types.ts`
  - `packages/covenant-core/src/tribunal-ui/motion.ts`
  - `packages/covenant-core/src/tribunal-ui/Tribunal.tsx`
  - `packages/covenant-core/src/tribunal-ui/tribunal.css`
  - `packages/covenant-core/src/tribunal-ui/index.ts`
  - `packages/covenant-core/src/index.ts`
  - `packages/covenant-core/test/tribunal-ui/chalice-resolution-panel.test.tsx`
  - `packages/covenant-core/test/tribunal-ui/certification-seal.test.tsx`
  - `packages/covenant-core/test/tribunal-ui/verification-drawer.test.tsx`
  - `packages/covenant-core/test/tribunal-ui/resilient-states.test.tsx`

  **Test seam to write first:** `packages/covenant-core/test/tribunal-ui/chalice-resolution-panel.test.tsx`. Render one proven `FAIL` successively with `pair`, `single`, and `manual` payloads; assert A-before-B peer weight, inline expected/replacement review, unchanged verdict, locked competing actions during apply, valid 100% proof after success, no apply control for manual repair, and source-preserving focus recovery for every typed rejection and unresolved re-verification.

  - [x] Implement the `IDLE -> REVIEWING -> APPLYING -> APPLIED | REJECTED` patch presentation state without solving or calculating preservation inside React.
  - [x] Keep the verdict visible and independent from repair availability; render target IDs, strategy, revision, source diff, and proof text from Core values.
  - [x] Gate `CertificationSeal` on both `report.certifiable` and five `PASS` values, include revision text, and render explicit blocked reasons otherwise.
  - [x] Implement the non-modal verification disclosure with one-line collapsed ledger, separate live and Node-PBT sections, Escape focus restoration, and no browser PBT execution.
  - [x] Apply the finite motion choreography and final static reduced-motion states without looping, shimmer, flicker, or paint-heavy effects.
  - [x] Cover loading with prior evidence, empty filter, operational `UNKNOWN`, invalid evidence, rejected source, invalid PBT snapshot, overlong content, forced colors, and assistive announcements.

  **Exact pnpm verification command:** `pnpm --filter @covenant/core exec vitest run test/tribunal-ui/chalice-resolution-panel.test.tsx test/tribunal-ui/certification-seal.test.tsx test/tribunal-ui/verification-drawer.test.tsx test/tribunal-ui/resilient-states.test.tsx && pnpm --filter @covenant/core build && pnpm typecheck`

  _Requirements: 7.1–7.9, 8.1–8.5, 9.1–9.6, 13.1–13.6, 14.1–14.6, 15.1–15.8, 16.3_

- [x] 10. Ship Spec Inquisitor with three Cursed Scrolls and EARS/PBT export
  Status: resolved

  Blocked by: 9

  **What it delivers:** A static, offline Spec Inquisitor workbench lets a judge select and edit all three software Cursed Sample Scrolls, verify them with `BrowserDeterministicSolver`, inspect their expected Consistency/Security/Liveness evidence, apply either verified Chalice, and export patched EARS plus an executable `fast-check` property snippet.

  **Exact files to touch:**
  - `pnpm-lock.yaml`
  - `app-1-spec-inquisitor/package.json`
  - `app-1-spec-inquisitor/tsconfig.json`
  - `app-1-spec-inquisitor/vite.config.ts`
  - `app-1-spec-inquisitor/vitest.config.ts`
  - `app-1-spec-inquisitor/tailwind.config.ts`
  - `app-1-spec-inquisitor/postcss.config.cjs`
  - `app-1-spec-inquisitor/playwright.config.ts`
  - `app-1-spec-inquisitor/index.html`
  - `app-1-spec-inquisitor/src/vite-env.d.ts`
  - `app-1-spec-inquisitor/src/main.tsx`
  - `app-1-spec-inquisitor/src/App.tsx`
  - `app-1-spec-inquisitor/src/app.css`
  - `app-1-spec-inquisitor/src/state.ts`
  - `app-1-spec-inquisitor/src/samples.ts`
  - `app-1-spec-inquisitor/src/exports.ts`
  - `app-1-spec-inquisitor/src/App.test.tsx`
  - `app-1-spec-inquisitor/tests/app.e2e.spec.ts`

  **Test seam to write first:** `app-1-spec-inquisitor/src/App.test.tsx`. Render the application using only public `@covenant/core` APIs, select each of the three normative App 1 fixtures, assert exact source and expected finding evidence, review and apply Chalice A and B from separate clean revisions, require the target finding to disappear with 100% `~C` preservation, and assert the EARS and executable `fast-check` downloads contain the patched source and replayable formal property.

  - [x] Encode the exact pre-verified AST, source locations, expected finding fingerprints, and normative pair edits for RBAC emergency override, hardened sandbox liveness, and API rate-limit/CWE-862.
  - [x] Validate every fixture at load time; never reconstruct formal meaning from rendered text or call the parser, network, or an LLM for the sample path.
  - [x] Orchestrate immutable source, sample, verification, filter, finding, focus, patch, and drawer state through one reducer and Core's `verifyCovenant`/`applyChalicePatch` seams.
  - [x] Apply the Spec Inquisitor skin, seven/five desktop composition, finite phosphor trace, responsive source-first order, and shared component imports without duplicated formal or Tribunal logic.
  - [x] Support edited/pasted EARS through `parseOffline`, retain diagnostics and prior evidence safely, and keep operation fully client-side.
  - [x] Export UTF-8 patched `requirements.md` and a deterministic executable `fast-check` snippet through explicit user-triggered downloads.
  - [x] Exercise all three samples with outbound network blocked, keyboard navigation, automated accessibility checks, both Chalices, exports, and visual captures at 360, 768, 1024, 1280, and 1600 CSS pixels.

  **Exact pnpm verification command:** `pnpm --filter @covenant/spec-inquisitor exec vitest run src/App.test.tsx && pnpm --filter @covenant/spec-inquisitor build && pnpm --filter @covenant/spec-inquisitor exec playwright test && pnpm typecheck`

  _Requirements: 1.2–1.7, 3.1, 3.3–3.6, 10.1–10.5, 12.1, 12.3–12.6, 13.1–13.6, 14.1–14.6, 15.1–15.8, 16.1–16.7_

- [ ] 11. Ship Clause Exorcist with three Cursed Scrolls and Legal Redline export
  Status: open

  Blocked by: 10

  **What it delivers:** A static, offline Clause Exorcist reading room lets a judge select and edit all three legal Cursed Sample Scrolls, inspect every expected financial/IP/SLA contradiction and liveness finding, apply either verified Chalice, and export a protective Legal Redline plus a plain-English negotiation summary. The final repository passes all Core, UI, application, offline, and browser-boundary gates.

  **Exact files to touch:**
  - `pnpm-lock.yaml`
  - `app-2-clause-exorcist/package.json`
  - `app-2-clause-exorcist/tsconfig.json`
  - `app-2-clause-exorcist/vite.config.ts`
  - `app-2-clause-exorcist/vitest.config.ts`
  - `app-2-clause-exorcist/tailwind.config.ts`
  - `app-2-clause-exorcist/postcss.config.cjs`
  - `app-2-clause-exorcist/playwright.config.ts`
  - `app-2-clause-exorcist/index.html`
  - `app-2-clause-exorcist/src/vite-env.d.ts`
  - `app-2-clause-exorcist/src/main.tsx`
  - `app-2-clause-exorcist/src/App.tsx`
  - `app-2-clause-exorcist/src/app.css`
  - `app-2-clause-exorcist/src/state.ts`
  - `app-2-clause-exorcist/src/samples.ts`
  - `app-2-clause-exorcist/src/exports.ts`
  - `app-2-clause-exorcist/src/App.test.tsx`
  - `app-2-clause-exorcist/tests/app.e2e.spec.ts`
  - `packages/covenant-core/test/browser-bundle-boundary.test.ts`

  **Test seam to write first:** `app-2-clause-exorcist/src/App.test.tsx`. Render the application using public Core and Tribunal exports, select each normative App 2 fixture, assert exact source plus every expected core/witness or liveness finding, apply each finding's Chalice A and B from clean revisions, require 100% preservation outside its Repair Core, and assert the Legal Redline marks each replacement while the negotiation summary explains the selected strategy and formal effect in plain English.

  - [ ] Encode the exact pre-verified AST, source locations, expected finding fingerprints, and normative edits for liability versus indemnification, freelance IP/kill fee/background IP, and SLA credit/cure/Force Majeure liveness.
  - [ ] Validate fixtures and every standard pair before rendering; preserve multiple independent findings and reset stale selection/review/copy state when samples change.
  - [ ] Reuse the same reducer and shared formal/UI seams as App 1 while applying the Clause Exorcist skin, wider legal reading measure, marginal references, mahogany wells, and restrained wax treatment.
  - [ ] Support edited/pasted structured clauses through `parseOffline` without a network dependency and preserve source-located diagnostics when formalization is rejected or unsupported.
  - [ ] Export a deterministic protective redline with textual addition/removal/replacement markers and a plain-English negotiation summary tied to the selected verified patch.
  - [ ] Exercise all three samples with outbound network blocked, keyboard navigation, automated accessibility checks, all findings and both Chalices, exports, and visual captures at 360, 768, 1024, 1280, and 1600 CSS pixels.
  - [ ] Extend browser bundle inspection across both production applications and reject Z3, WASM, Node built-ins, `SharedArrayBuffer`, remote fonts, required backend endpoints, or duplicated Core solver/parser/repair code.
  - [ ] Run the complete repository build, unit/integration suite, 200-run PBT suite, typecheck, production source policy check, and both application browser suites as the release gate.

  **Exact pnpm verification command:** `pnpm --filter @covenant/clause-exorcist exec vitest run src/App.test.tsx && pnpm --filter @covenant/clause-exorcist build && pnpm --filter @covenant/clause-exorcist exec playwright test && pnpm build && pnpm test && pnpm test:pbt && pnpm typecheck`

  _Requirements: 1.2–1.7, 3.2–3.6, 11.1–11.5, 12.2–12.6, 13.1–13.6, 14.1–14.6, 15.1–15.8, 16.1–16.7_

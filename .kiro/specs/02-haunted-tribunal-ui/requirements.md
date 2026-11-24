# Haunted Tribunal UI Requirements

## Problem Statement

Formal-verification output is difficult to trust when the interface reduces it to generic cards, color-only status, or opaque solver language. COVENANT needs one shared, accessible evidence interface that preserves the distinction between proof status, repair availability, and verification telemetry while giving Spec Inquisitor and Clause Exorcist distinct identities. The static applications must remain fully usable without a login, server, API key, network font request, browser Z3, or live property-test execution.

## Solution

`@covenant/core` will export a shared React 19 Haunted Tribunal UI from `packages/covenant-core/src/tribunal-ui/`. The package will provide six evidence components, a typed theme contract, responsive composition, accessible interaction, and two application skins. Both applications will load three complete pre-verified Cursed Sample Scrolls, use `BrowserDeterministicSolver`, and render the same formal evidence without duplicating parser, solver, repair, telemetry, or shared UI behavior.

## Requirement 1: Shared Tribunal package boundary

**User Story:** As a COVENANT maintainer, I want both applications to use one shared evidence interface, so that proof behavior and terminology cannot drift between products.

### Acceptance Criteria

1.1 WHERE the Haunted Tribunal UI is implemented THE SYSTEM SHALL place shared React components, public prop types, theme tokens, and accessibility helpers under `packages/covenant-core/src/tribunal-ui/`.

1.2 WHEN either application renders verification results THE SYSTEM SHALL import the shared Tribunal components from the browser-safe `@covenant/core` entry point.

1.3 WHEN either application requires parsing, solving, evidence formatting, patch application, preservation proof, or telemetry formatting THE SYSTEM SHALL consume that behavior from `@covenant/core` without duplicating it in application source.

1.4 WHEN the browser export graph is built THE SYSTEM SHALL exclude `@covenant/core/node`, `NodeZ3Solver`, `z3-solver`, WebAssembly assets, Node built-ins, and `SharedArrayBuffer` references.

1.5 WHEN TypeScript checks the shared UI THE SYSTEM SHALL enforce strict mode and reject explicit or implicit `any`.

1.6 WHEN an application imports Tribunal components from the browser-safe package root THE SYSTEM SHALL expose every public component and prop type without requiring a Node-specific entry point.

1.7 WHEN an application imports shared Tribunal styles THE SYSTEM SHALL use the stable `@covenant/core/tribunal.css` subpath and preserve that CSS through production tree-shaking.

## Requirement 2: Normative visual tokens

**User Story:** As a user reviewing formal evidence, I want a coherent state language, so that I can distinguish proof, failure, uncertainty, and ordinary interaction immediately.

### Acceptance Criteria

2.1 WHERE either Tribunal skin is active THE SYSTEM SHALL use the exact color, typography, spacing, shape, and component tokens in `DESIGN.md`.

2.2 WHEN a verdict is `PASS` THE SYSTEM SHALL use emerald SAT together with the word `PASS` and a non-color status icon.

2.3 WHEN a verdict is `FAIL` THE SYSTEM SHALL use blood-crimson UNSAT together with the word `FAIL` and a non-color status icon.

2.4 WHEN a verdict is `UNKNOWN` THE SYSTEM SHALL use amber together with the word `UNKNOWN` and a non-color status icon.

2.5 WHEN an element does not represent formal state THE SYSTEM SHALL use obsidian, vellum, brass, ink, or a skin-specific neutral instead of a verdict color.

2.6 WHERE the Tribunal renders color THE SYSTEM SHALL contain no generic neon purple, violet, magenta, indigo, or purple-blue gradient token or decoration.

2.7 WHEN normal text is displayed THE SYSTEM SHALL meet WCAG 2.2 AA contrast against its rendered background.

## Requirement 3: Typography and offline font delivery

**User Story:** As an offline judge, I want the intended editorial and technical typography without a network dependency, so that the interface remains legible and on-brand after deployment.

### Acceptance Criteria

3.1 WHERE Spec Inquisitor renders editorial headings THE SYSTEM SHALL use self-hosted Alegreya with the fallback stack defined in `DESIGN.md`.

3.2 WHERE Clause Exorcist renders editorial headings THE SYSTEM SHALL use self-hosted Bodoni Moda with the fallback stack defined in `DESIGN.md`.

3.3 WHERE either application renders controls, findings, or explanatory prose THE SYSTEM SHALL use self-hosted Commissioner with the fallback stack defined in `DESIGN.md`.

3.4 WHERE either application renders Phantom Witness variables, exact values, rule IDs, numeric bounds, or telemetry values THE SYSTEM SHALL use self-hosted Fragment Mono with the fallback stack defined in `DESIGN.md`.

3.5 WHEN a production application loads THE SYSTEM SHALL resolve subsetted WOFF2 font assets locally without a request to Google Fonts or another font host.

3.6 WHEN a font asset fails to load THE SYSTEM SHALL preserve content, hierarchy, and control dimensions through the documented fallback stacks.

## Requirement 4: Five Hooded Inquisitors Lantern Bar

**User Story:** As a reviewer, I want all five property verdicts visible and filterable, so that I can move directly to the evidence that needs attention.

### Acceptance Criteria

4.1 WHEN a `VerificationReport` renders THE SYSTEM SHALL display exactly five Inquisitors in the order Testability, Consistency, Completeness, Unambiguity, and Security & Liveness.

4.2 WHEN an Inquisitor has a verdict THE SYSTEM SHALL display its full name, verdict word, finding count, non-color state icon, and corresponding lantern color.

4.3 WHEN a user activates an Inquisitor THE SYSTEM SHALL filter visible findings to that property without mutating the `VerificationReport`.

4.4 WHEN a user navigates the Lantern Bar with a keyboard THE SYSTEM SHALL implement tablist semantics, arrow-key movement, Home, End, Enter, and Space behavior.

4.5 WHEN verification updates multiple verdicts THE SYSTEM SHALL resolve the lanterns in formal order with the motion choreography defined in `DESIGN.md`.

4.6 IF reduced motion is requested THEN THE SYSTEM SHALL remove lantern stagger, scale overshoot, and halo animation while preserving immediate state changes and announcements.

## Requirement 5: Split Scroll Clause Inspector

**User Story:** As a document owner, I want source and formal evidence linked, so that I can see exactly which rules prove a finding.

### Acceptance Criteria

5.1 WHEN a document is loaded THE SYSTEM SHALL display authoritative source text with line numbers, stable rule IDs, clause boundaries, and source-located diagnostics.

5.2 WHEN a Consistency finding is selected THE SYSTEM SHALL highlight every rule in its subset-minimal Unsat Core with a blood-crimson edge, a tinted vellum background, and a linked core badge.

5.3 WHEN an evidence reference receives hover or keyboard focus THE SYSTEM SHALL highlight and reveal the corresponding source clause without moving keyboard focus.

5.4 WHEN a source clause is activated THE SYSTEM SHALL reveal its associated finding and evidence while preserving the clause as the focus target.

5.5 WHEN a diff is displayed THE SYSTEM SHALL identify additions, removals, and replacements through text markers and icons in addition to color.

5.6 WHEN edited source is re-verified THE SYSTEM SHALL preserve the nearest valid source position, selected finding when it still exists, and current Inquisitor filter.

5.7 WHEN a user resizes a split pane THE SYSTEM SHALL provide keyboard-operable resize controls, bounded pane sizes, and a reset-to-default action.

## Requirement 6: Phantom Witness Stand

**User Story:** As a reviewer, I want a concrete triggering assignment, so that I can replay a contradiction without interpreting solver internals.

### Acceptance Criteria

6.1 WHEN a Consistency finding provides a `PhantomWitness` THE SYSTEM SHALL render its canonical variable assignments as a two-column table in stable order.

6.2 WHEN a Phantom Witness contains exact integer or decimal values THE SYSTEM SHALL render them without binary floating-point conversion or precision loss.

6.3 WHEN a Phantom Witness renders THE SYSTEM SHALL list the activated Unsat Core rule IDs and incompatible triggered consequences separately from the assignment table.

6.4 WHEN a user invokes copy evidence THE SYSTEM SHALL copy a plain-text assignment table, activated rule IDs, and triggered-result statement.

6.5 IF Consistency evidence fails Phantom Witness validation THEN THE SYSTEM SHALL return verdict-level `UNKNOWN/INVALID_EVIDENCE`, omit the invalid Consistency finding, preserve independently proven failures, and block certification.

## Requirement 7: Cursed Chalices Resolution Panel

**User Story:** As a document owner, I want only verified repair actions, so that choosing a repair cannot weaken a proven finding or alter unrelated rules silently.

### Acceptance Criteria

7.1 WHEN a Resolution Payload is `pair` THE SYSTEM SHALL render Chalice A and Chalice B with equal visual weight, distinct strategy labels, source diffs, target rule IDs, and preservation proof summaries.

7.2 WHEN a Resolution Payload is `single` THE SYSTEM SHALL render the verified unpaired patch and the reason a second safe patch is unavailable.

7.3 WHEN a Resolution Payload is `manual` THE SYSTEM SHALL render the manual-repair reason without an automatic apply action.

7.4 WHEN repair availability changes THE SYSTEM SHALL preserve the mathematically proven Inquisitor Verdict independently from the Resolution Payload.

7.5 WHEN a user selects a Chalice THE SYSTEM SHALL show an inline guarded-edit review before applying the patch.

7.6 WHEN a user confirms a Chalice THE SYSTEM SHALL disable competing apply actions, invoke shared `applyChalicePatch`, and re-run all applicable verification.

7.7 WHEN patch application succeeds THE SYSTEM SHALL update source in place, reveal the decisive re-verification result, and display `100%` preservation only from a valid `PreservationProof`.

7.8 WHEN patch application is rejected THE SYSTEM SHALL leave source unchanged, restore available actions, and name the typed rejection reason.

7.9 IF re-verification returns `UNKNOWN` for a required proof THEN THE SYSTEM SHALL withhold patch certification and display the unresolved reason.

## Requirement 8: Crimson Wax Seal certification

**User Story:** As a reviewer, I want certification to represent a complete formal result, so that visual celebration never overstates proof.

### Acceptance Criteria

8.1 WHEN `report.certifiable` is true and all five Inquisitor Verdicts are `PASS` THE SYSTEM SHALL render the Crimson Wax Seal of Formal Certification with the document revision.

8.2 WHEN any Inquisitor Verdict is `FAIL` or `UNKNOWN` THE SYSTEM SHALL omit the certification seal and display a certification-blocked explanation.

8.3 WHEN the certification seal enters THE SYSTEM SHALL use the contact-and-settle choreography defined in `DESIGN.md` without covering editable source or evidence.

8.4 IF reduced motion is requested THEN THE SYSTEM SHALL render the final seal state without rotation, overshoot, or impact animation.

8.5 WHEN a user or assistive technology encounters the seal THE SYSTEM SHALL expose `Formally certified` and the certified document revision as text.

## Requirement 9: OpenPBTStats and Verification Telemetry drawer

**User Story:** As a judge, I want to inspect current solve performance and pre-deployment test coverage separately, so that I understand what ran live and what was verified in Node.

### Acceptance Criteria

9.1 WHEN the verification drawer is collapsed THE SYSTEM SHALL display a one-line ledger containing current solver, latency, clauses checked, and PBT snapshot version.

9.2 WHEN the verification drawer is expanded THE SYSTEM SHALL separate live `VerificationTelemetry` rows from checked-in `OpenPBTStats` rows.

9.3 WHEN `OpenPBTStats` renders THE SYSTEM SHALL display property, requested runs, successful runs, tagged edge cases, duplicate runs, discarded runs, seed, and duration.

9.4 WHEN live telemetry renders THE SYSTEM SHALL display solver identity, elapsed milliseconds, and clauses checked without merging those values into `OpenPBTStats`.

9.5 WHERE browser verification runs THE SYSTEM SHALL display the checked-in PBT snapshot without executing the randomized property suites.

9.6 WHEN the drawer opens or closes THE SYSTEM SHALL preserve keyboard focus, support Escape, and avoid covering the active source line.

## Requirement 10: Spec Inquisitor skin

**User Story:** As a software engineer or DevSecOps practitioner, I want a technical evidence workbench, so that RBAC, security, and liveness findings feel native to specification review.

### Acceptance Criteria

10.1 WHERE `app-1-spec-inquisitor` renders the shared Tribunal THE SYSTEM SHALL apply the Alchemical DevSecOps Parchment & Brass Oscilloscope skin from `DESIGN.md`.

10.2 WHEN App 1 displays source and evidence on a wide viewport THE SYSTEM SHALL prioritize a dense seven-column source region and five-column evidence region.

10.3 WHEN App 1 verifies a document THE SYSTEM SHALL use one finite left-to-right phosphor trace to connect solver progress to the five resolved verdicts.

10.4 WHERE App 1 displays custom decoration THE SYSTEM SHALL confine oscilloscope grid and phosphor treatment to telemetry, active measurements, and verification progress.

10.5 WHEN App 1 exports a repaired document THE SYSTEM SHALL offer patched EARS `requirements.md` and an executable `fast-check` property snippet.

## Requirement 11: Clause Exorcist skin

**User Story:** As a founder, freelancer, or Legal/Ops reviewer, I want a chancery reading room, so that contractual evidence remains sober, legible, and actionable.

### Acceptance Criteria

11.1 WHERE `app-2-clause-exorcist` renders the shared Tribunal THE SYSTEM SHALL apply the Candlelit Victorian Chancery & Crimson Wax Seal skin from `DESIGN.md`.

11.2 WHEN App 2 displays source text THE SYSTEM SHALL give clause numbers, marginal references, and legal-reading measure greater visual emphasis than live telemetry.

11.3 WHERE App 2 displays material depth THE SYSTEM SHALL use mahogany wells, stacked vellum, directional contact shadow, and restrained wax accents without animated flame decoration.

11.4 WHEN App 2 exports a repaired document THE SYSTEM SHALL offer a protective Legal Redline diff and a plain-English negotiation summary.

11.5 WHEN App 2 renders the certification state THE SYSTEM SHALL use the shared certification semantics without creating a skin-specific route around the five-pass requirement.

## Requirement 12: Six pre-loaded Cursed Sample Scrolls

**User Story:** As a judge, I want complete one-click examples, so that I can inspect every major evidence and repair path without authoring input or using a network.

### Acceptance Criteria

12.1 WHEN App 1 loads THE SYSTEM SHALL provide one-click access to Multi-Role RBAC Emergency Override Contradiction, Over-Hardened Agent Sandbox Liveness Deadlock, and API Rate-Limit & CWE-862 Security Gap Spec.

12.2 WHEN App 2 loads THE SYSTEM SHALL provide one-click access to SaaS Liability Cap vs. Uncapped Indemnification Loophole, Freelance IP Assignment & Kill-Fee Contradiction, and Enterprise SLA Penalty & Force Majeure Deadlock.

12.3 WHEN a Cursed Sample Scroll is selected THE SYSTEM SHALL load its exact source text and complete pre-verified formal AST from `technical-design.md` without parser, LLM, or network latency.

12.4 WHEN a Cursed Sample Scroll is verified THE SYSTEM SHALL display its expected finding, formal evidence, and a verified ChalicePair for each standard supported finding.

12.5 WHEN a Chalice is applied to a Cursed Sample Scroll THE SYSTEM SHALL re-run verification and prove preservation of every rule outside the applicable Repair Core.

12.6 WHEN a sample selection changes THE SYSTEM SHALL reset stale finding selection, patch preview, and copied-state feedback while preserving the active application skin.

## Requirement 13: Motion choreography

**User Story:** As a user following verification, I want motion to explain state changes, so that I can understand what changed without distraction or delay.

### Acceptance Criteria

13.1 WHERE shared UI motion is implemented THE SYSTEM SHALL use Framer Motion and the durations, easing curves, and sequencing rules in `DESIGN.md`.

13.2 WHEN verification begins THE SYSTEM SHALL keep source content visible and use motion only to connect progress, verdict resolution, evidence linkage, patch application, drawer state, and certification.

13.3 WHEN an interface state settles THE SYSTEM SHALL stop decorative motion rather than pulse, shimmer, flicker, or loop indefinitely.

13.4 IF `prefers-reduced-motion: reduce` is active THEN THE SYSTEM SHALL remove nonessential transforms, stagger, sweeps, rotation, parallax, and scale overshoot.

13.5 WHEN reduced motion is active THE SYSTEM SHALL preserve immediate visibility changes, focus transitions, live-region announcements, and functional scrolling.

13.6 WHEN layout animation runs THE SYSTEM SHALL prefer opacity and transforms and SHALL avoid animating large-area blur, filter, or paint-heavy properties.

## Requirement 14: Responsive operation

**User Story:** As a reviewer on any supported device, I want the same evidence and actions in a readable order, so that mobile layout does not hide formal meaning.

### Acceptance Criteria

14.1 WHEN the viewport is at least 1280px wide THE SYSTEM SHALL render the Lantern Bar above a persistent split source-and-evidence workspace.

14.2 WHEN the viewport is between 1024px and 1279px wide THE SYSTEM SHALL balance source and evidence regions and collapse secondary metadata before reducing source readability.

14.3 WHEN the viewport is below 1024px wide THE SYSTEM SHALL render one column in the documented evidence order without removing any verdict, source, witness, repair, export, or telemetry content.

14.4 WHEN the viewport is below 640px wide THE SYSTEM SHALL render the Lantern Bar as a labeled horizontally scrollable tablist and stack Chalice options vertically.

14.5 WHEN source text wraps on a narrow viewport THE SYSTEM SHALL retain a stable rule-ID gutter and SHALL not merge identifiers into clause prose.

14.6 WHEN content contains long rule IDs, decimal values, legal clauses, or translated labels THE SYSTEM SHALL wrap or scroll within its owning region without causing page-level horizontal overflow.

## Requirement 15: Accessibility and resilient states

**User Story:** As a keyboard, screen-reader, low-vision, or motion-sensitive user, I want complete access to formal evidence, so that the interface does not make proof dependent on presentation.

### Acceptance Criteria

15.1 WHEN a user navigates with a keyboard THE SYSTEM SHALL provide visible focus, logical focus order, skip navigation, and complete operation without pointer input.

15.2 WHEN verification, filtering, patch application, or certification changes state THE SYSTEM SHALL announce a concise result through an appropriate live region without repeating unchanged source text.

15.3 WHEN forced-colors mode is active THE SYSTEM SHALL preserve boundaries, selected states, verdict words, icons, and focus indicators with system colors.

15.4 WHEN data is loading THE SYSTEM SHALL retain the source document and render a named progress state without skeleton shimmer.

15.5 WHEN no findings match a filter THE SYSTEM SHALL explain the empty state and provide a clear action to show all findings.

15.6 WHEN verification fails operationally THE SYSTEM SHALL preserve independently proven findings, display typed `UNKNOWN` reasons, and block certification.

15.7 WHEN a Lucide icon is decorative THE SYSTEM SHALL hide it from assistive technology.

15.8 WHEN a Lucide icon is the only visible control label THE SYSTEM SHALL provide an accessible text name and tooltip.

## Requirement 16: Static delivery and verification quality

**User Story:** As a maintainer and event judge, I want a durable static build with tested shared behavior, so that the applications remain dependable through January 22, 2027.

### Acceptance Criteria

16.1 WHEN either application builds for production THE SYSTEM SHALL produce a static client-side Vite application that requires no login, server, Docker container, account, API key, or paid service.

16.2 WHEN the network is unavailable THE SYSTEM SHALL load both application shells, all six Cursed Sample Scrolls, self-hosted fonts, browser verification, patch application, exports, and checked-in PBT statistics.

16.3 WHEN shared component tests run THE SYSTEM SHALL cover `PASS`, `FAIL`, `UNKNOWN`, loading, empty, error, pair, single, manual, rejected-patch, reduced-motion, forced-color, keyboard, and overlong-content states.

16.4 WHEN visual regression tests run THE SYSTEM SHALL capture both skins at 360px, 768px, 1024px, 1280px, and 1600px widths.

16.5 WHEN accessibility tests run THE SYSTEM SHALL report no automated critical or serious violations for the six sample paths and all shared component states.

16.6 WHEN bundle inspection runs THE SYSTEM SHALL fail if a production asset contains `z3-solver`, `NodeZ3Solver`, `.wasm`, a remote Google Fonts URL, or a required backend endpoint.

16.7 WHEN production modules are added under `packages/covenant-core`, including `src/tribunal-ui/`, THE SYSTEM SHALL keep Tribunal UI code separate from core engine logic through focused modules and clear dependency direction without imposing an artificial source-line cap.

## Out of Scope

- Replacing the `CovenantSolver`, parser, verification, repair, or Preservation Property semantics defined by feature 01.
- Running Node Z3 or randomized property tests in either browser application.
- Building the optional BYOK LLM translator.
- Creating a login, account, backend, persistent cloud storage, or collaboration service.
- Treating decorative Gothic atmosphere as evidence or allowing skin behavior to alter formal results.

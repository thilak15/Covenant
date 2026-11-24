# Haunted Tribunal UI Technical Design

> **Repository path note:** The workspace volume is case-insensitive APFS, so `DESIGN.md` and `design.md` resolve to the same inode. The visual design system keeps the required `DESIGN.md` name; this architecture document uses `technical-design.md` to preserve both artifacts. Rename this file to `design.md` only after moving the repository to a case-sensitive volume.

## Overview

The Haunted Tribunal is a shared React 19 evidence interface over the feature-01 `VerificationReport`, `CovenantDocument`, `ResolutionPayload`, `PhantomWitness`, `OpenPBTSnapshot`, and `VerificationTelemetry` contracts. It does not parse, solve, minimize cores, synthesize repairs, or reinterpret verdicts. The applications own orchestration and pass immutable domain values and callbacks into shared presentational components.

The shared package supplies one interaction model and two theme contracts:

- `spec-inquisitor`: Alchemical DevSecOps Parchment & Brass Oscilloscope.
- `clause-exorcist`: Candlelit Victorian Chancery & Crimson Wax Seal.

`DESIGN.md` is normative for exact visual tokens and motion. This file is normative for architecture, public component contracts, state transitions, responsive behavior, accessibility, sample fixture content, and test seams.

## Design goals

- Keep source text visually and semantically connected to formal evidence.
- Preserve the feature-01 separation between an `InquisitorVerdict` and its `ResolutionPayload`.
- Expose every proof relationship through text, focus, and structure in addition to color.
- Give both applications distinct skins without forking behavior or component markup.
- Keep browser execution static, offline, and free from Node Z3 and live PBT execution.
- Fit shared Tribunal TypeScript and TSX within the 275-line reservation in the Core design.
- Make all six sample paths deterministic, editable, patchable, and visually testable.

## Architecture

```text
app shell
  ├─ sample catalog or edited source
  ├─ BrowserDeterministicSolver
  ├─ verifyCovenant / applyChalicePatch
  ├─ view-state reducer
  │    ├─ selected Inquisitor
  │    ├─ selected finding
  │    ├─ focused rule ID
  │    ├─ patch review/apply state
  │    └─ telemetry drawer state
  └─ <TribunalTheme skin="…">
       ├─ <InquisitorLanternBar />
       ├─ <SplitScrollInspector />
       ├─ <PhantomWitnessStand />
       ├─ <ChaliceResolutionPanel />
       ├─ <CertificationSeal />
       └─ <VerificationDrawer />
```

### Ownership boundaries

| Layer | Owns | Must not own |
| --- | --- | --- |
| `@covenant/core` domain | Formal values, solver, verifier, patch application, telemetry formatting | React view state or application routing |
| `src/tribunal-ui/` | Shared markup, themes, evidence rendering, accessible interactions, motion variants | Parsing, solving, evidence synthesis, patch verification |
| Application shell | Sample choice, source editing, async orchestration, exports, current view state | Duplicated Tribunal markup or formal logic |
| Skin | CSS custom-property values and restrained decorative layers | Different semantics, order, or hidden evidence |

### Module layout and line budget

```text
packages/covenant-core/src/tribunal-ui/
  index.ts                 public browser-safe exports
  types.ts                 skin and callback contracts
  Tribunal.tsx             six compact named components and shared helpers
  tribunal.css             tokens, responsive layout, forced colors, print
  motion.ts                shared Framer Motion variants
```

The feature-01 scanner counts `.ts` and `.tsx`, not CSS. `Tribunal.tsx`, `types.ts`, `motion.ts`, and `index.ts` must remain at or below the reserved 275 nonblank, non-comment TypeScript-token lines. Repeated presentation is data-driven; the applications do not copy it to evade the limit. Sample AST data belongs in application fixture modules because each corpus is application-specific.

`src/index.ts` re-exports every public Tribunal component and prop type from the browser-safe root. The package export map also exposes `@covenant/core/tribunal.css` as a stable stylesheet subpath. Package metadata lists `**/*.css` under `sideEffects` so production tree-shaking cannot discard the shared styles. A bundle fixture proves that root UI and CSS imports include no Node entry or Z3 asset.

## Public component contract

All inputs are readonly. UI callbacks report intent; the application invokes feature-01 operations and returns the result through new props. Presentation-state unions wrap existing Core values without replacing their domain models.

```ts
export type TribunalSkin = "spec-inquisitor" | "clause-exorcist";

export interface FindingSelection {
  readonly inquisitor: Inquisitor;
  readonly findingId: FindingId;
}

export type InspectorSourceState =
  | {
      readonly status: "VERIFIED";
      readonly document: CovenantDocument;
      readonly report: VerificationReport;
      readonly diagnostics: readonly ParseDiagnostic[];
    }
  | {
      readonly status: "REJECTED";
      readonly source: SourceDocument;
      readonly diagnostics: NonEmpty<ParseDiagnostic>;
    };

export type PbtPresentationState =
  | { readonly status: "VALID"; readonly snapshot: OpenPBTSnapshot }
  | { readonly status: "INVALID"; readonly reason: string };

export type CopyEvidenceResult = "COPIED" | "DENIED";

export interface TribunalThemeProps {
  readonly skin: TribunalSkin;
  readonly children: React.ReactNode;
}

export interface InquisitorLanternBarProps {
  readonly verdicts: FiveInquisitorVerdicts;
  readonly selected: Inquisitor | "ALL";
  readonly onSelect: (inquisitor: Inquisitor | "ALL") => void;
  readonly verifying: boolean;
}

export interface SplitScrollInspectorProps {
  readonly sourceState: InspectorSourceState;
  readonly visibleInquisitor: Inquisitor | "ALL";
  readonly selection: FindingSelection | null;
  readonly focusedRuleId: RuleId | null;
  readonly editable: boolean;
  readonly onSourceChange?: (text: string) => void;
  readonly onSelectFinding: (selection: FindingSelection) => void;
  readonly onFocusRule: (ruleId: RuleId | null) => void;
}

export interface PhantomWitnessStandProps {
  readonly witness: PhantomWitness;
  readonly copyStatus: "IDLE" | CopyEvidenceResult;
  readonly onCopy: (plainText: string) => Promise<CopyEvidenceResult>;
}

export type PatchApplyState =
  | { readonly status: "IDLE" }
  | { readonly status: "REVIEWING"; readonly patchId: string }
  | { readonly status: "APPLYING"; readonly patchId: string }
  | {
      readonly status: "REJECTED";
      readonly patchId: string;
      readonly reason: PatchRejectionReason;
    }
  | {
      readonly status: "APPLIED";
      readonly patchId: string;
      readonly proof: PreservationProof;
    };

export interface ChaliceResolutionPanelProps {
  readonly verdict: VerdictStatus;
  readonly resolution: ResolutionPayload;
  readonly applyState: PatchApplyState;
  readonly onReview: (patchId: string) => void;
  readonly onCancelReview: () => void;
  readonly onApply: (patchId: string) => void;
}

export interface CertificationSealProps {
  readonly report: VerificationReport;
}

export interface VerificationDrawerProps {
  readonly telemetry: readonly VerificationTelemetry[];
  readonly pbt: PbtPresentationState;
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
}
```

`TribunalTheme` writes `data-tribunal-skin` and token custom properties on one root element. Components may read that context only for presentation. No component branches on a skin to alter semantics, data, or action availability.

## View state and data flow

The application uses one reducer rather than scattered component state:

```ts
export interface TribunalViewState {
  readonly inquisitor: Inquisitor | "ALL";
  readonly findingId: FindingId | null;
  readonly focusedRuleId: RuleId | null;
  readonly patch: PatchApplyState;
  readonly drawerOpen: boolean;
  readonly verification: "IDLE" | "RUNNING" | "SETTLED" | "FAILED";
}
```

Rules:

1. A new sample resets finding, focused rule, and patch state. It retains skin and drawer preference.
2. Re-verification retains the selected Inquisitor. It retains the selected finding only if the same finding ID still exists.
3. Evidence hover may set `focusedRuleId`, but only focus or activation changes the selected finding.
4. Patch application follows `IDLE -> REVIEWING -> APPLYING -> APPLIED | REJECTED`.
5. `APPLIED` is legal only with feature-01 `status: "APPLIED"` and a valid `PreservationProof`.
6. `REJECTED` never changes displayed source.
7. A report update never turns `FAIL` into `UNKNOWN` because repair synthesis failed.

## Theme and CSS token strategy

`tribunal.css` maps every frontmatter token in `DESIGN.md` to a `--cov-*` custom property. Shared semantic aliases reference those primitives:

```css
[data-tribunal-skin] {
  --cov-bg: var(--cov-obsidian-950);
  --cov-rail: var(--cov-obsidian-900);
  --cov-paper: var(--cov-vellum-50);
  --cov-paper-muted: var(--cov-vellum-100);
  --cov-ink: var(--cov-vellum-ink);
  --cov-action: var(--cov-tarnished-brass);
  --cov-pass: var(--cov-emerald-sat);
  --cov-fail: var(--cov-blood-unsat);
  --cov-unknown: var(--cov-amber-unknown);
}
```

The App 1 skin selects Alegreya, exposes a faint oscilloscope grid only in telemetry and progress regions, and uses phosphor for measurements. The App 2 skin selects Bodoni Moda, uses mahogany evidence wells, and reserves wax for legal emphasis and certification. Skin styles cannot override `--cov-pass`, `--cov-fail`, or `--cov-unknown`.

Fonts are downloaded during development, subsetted to the Latin glyphs used by the applications, checked into each production asset graph as WOFF2, and declared with `font-display: swap`. Production CSS contains no remote `url()`.

Tailwind may compose layout utilities in application shells. The shared package ships stable class selectors and CSS custom properties so consumers do not need to scan package source or duplicate long class strings.

## Shared component design

### InquisitorLanternBar

- Renders a labeled `tablist`; each Inquisitor is a `tab` with `aria-selected` and a controlled findings panel.
- Uses the invariant tuple order from feature 01.
- Shows full names at all widths; narrow screens scroll the tablist rather than replacing names with icons.
- Announces one aggregate summary after verification settles, not five competing live-region updates.
- Clicking an already-selected tab retains the selection. A separate “All findings” control clears the filter.
- While verification runs, existing verdicts remain readable and the bar adds “Verification in progress.” It does not replace evidence with skeletons.

### SplitScrollInspector

- The source pane is an ordered clause list derived from source locations, not from newline guessing.
- Each rule row uses `data-rule-id`, a visible ID, and an anchor target. Unsat Core membership derives only from selected `ConsistencyEvidence.core.ruleIds`.
- Evidence references are actual links to rule anchors. JavaScript enhances coordinated highlight and scroll behavior.
- Editable mode uses a source editor region plus an adjacent immutable rule gutter. It preserves selection offsets where the browser permits and falls back to the nearest clause start.
- A separator with `role="separator"`, `aria-orientation="vertical"`, `aria-valuenow`, keyboard arrows, Home, End, and reset controls manages desktop pane width.
- At widths below 1024px, panes become sequential sections and the separator disappears.

### PhantomWitnessStand

- Uses a semantic table with `Variable` and `Value` headers.
- Serializes values through shared exact formatters; it never calls `Number()` for rationals.
- Lists `coreRuleIds` before incompatible triggered consequences.
- Copy output is deterministic plain text, for example:

```text
Phantom Witness — Q-RBAC-01
actorRole = "CONTRACTOR"
emergencyOverride = true
day = "SUNDAY"
Activates: RBAC-01, RBAC-02
Triggered result: deployPermitted is both required and prohibited.
```

### ChaliceResolutionPanel

- `pair` produces two peer `article` elements. DOM order is A then B.
- `single` produces one article and a visible safety explanation.
- `manual` produces an explanation and no disabled imitation of an apply button.
- Patch previews show `expectedText` and `replacementText`, target rule IDs, strategy, source revision, and current proof summary.
- Review is inline, not a modal. This keeps the patch beside its source and avoids hiding the verdict.
- Apply controls lock only during the application request. Rejection restores actions and moves focus to the rejection heading.
- The panel never computes preservation percentage. It renders the literal proof returned by feature 01.

### CertificationSeal

- Renders only for `report.certifiable && verdicts.every(status === "PASS")`.
- When blocked, renders a short list of failing and unknown Inquisitors instead of a disabled seal.
- Includes readable text, revision, and a decorative authored wax edge.
- Print CSS renders the seal and revision in high contrast and removes entrance transforms.

### VerificationDrawer

- Uses a disclosure button and a non-modal region rather than a dialog.
- The collapsed ledger shows the latest live solve plus snapshot suite version.
- Expanded groups use headings “Live verification” and “Node property-test snapshot.”
- PBT content states that the browser did not execute the suite.
- The drawer uses `position: sticky` where space permits and ordinary document flow on small screens. It must not obscure the focused clause.

## Motion choreography

Framer Motion variants are centralized in `motion.ts`:

| Motion | Duration | Sequence | Reduced motion |
| --- | ---: | --- | --- |
| Control state | 120–180ms | Direct color/opacity | Immediate |
| Evidence link | 180ms | Source edge then evidence wash | Immediate outline |
| Drawer | 240ms | Height/opacity, focus after settle | Immediate open/close |
| Patch review | 260ms | Old line out, new line in | Direct replacement |
| Five lanterns | <=420ms total | 70ms left-to-right stagger | No stagger or scale |
| App 1 trace | <=420ms | One left-to-right draw | Static resolved line |
| Certification seal | 520ms | -7°/1.35 -> contact .96 -> settle 1 | Static final seal |

Settling uses `cubic-bezier(.22,1,.36,1)`. Controls use `cubic-bezier(.4,0,.2,1)`. Motion never loops after state settles. Source and controls are visible in the initial React render before Framer Motion enhancement; no server-rendered hydration contract is assumed.

## Responsive composition

| Width | Composition |
| --- | --- |
| >=1280px | Full Lantern Bar; 7/5 source/evidence grid; sticky evidence stack; docked drawer |
| 1024–1279px | 6/6 grid; condensed metadata; same component order |
| 640–1023px | One column; source before witness and repairs; inline drawer |
| <640px | Scrollable labeled tablist; stable rule gutter; stacked Chalices; full-width actions |

The DOM reading order is always Lantern Bar, active finding summary, source, witness, resolution, export actions, telemetry. Desktop grid placement may visually align source and evidence but cannot create a different focus or reading order.

Long clauses wrap inside the paper surface. Long rule IDs and exact values scroll inside their own monospace cells. No sample or custom content may create page-level horizontal overflow at 320px CSS width.

## Accessibility

- A skip link targets the `main` Tribunal workspace; the source and evidence regions use stable labeled landmarks.
- The Lantern Bar uses manual tab activation: arrows, Home, and End move focus; Enter or Space applies the filter. If filtering removes the selected finding, focus moves to the filtered results heading and selection becomes `null`.
- The pane separator is named “Resize source and evidence panes,” exposes values from 30 to 70 percent, changes by 2 percent with arrows and 10 percent with Page Up or Page Down, and resets to 58 percent with Home. Pointer cancellation restores its pre-drag value.
- The verification disclosure returns focus to its trigger when Escape closes it. It never traps focus.
- Every verdict pairs color with a word and icon.
- Focus uses a 2px high-contrast outline plus 2px offset; it does not depend on glow.
- Status changes use one polite live region. Patch rejection and operational failure use an assertive alert because the requested action did not complete.
- Decorative hoods, cup engravings, paper fibers, traces, and wax edges are hidden from the accessibility tree.
- Forced-colors CSS preserves selected tabs, clause edges, table boundaries, and action affordances with system colors.
- Touch targets are at least 44 by 44 CSS pixels.
- Tooltips supplement accessible names and never contain required information.
- Reduced-motion mode is tested through `matchMedia` and CSS media queries.
- The source editor has an explicit label, revision state, and parse/verification feedback relationship.

## Error and edge states

| State | Rendering and recovery |
| --- | --- |
| Verification running | Keep prior report visible, label it as previous, disable patch apply, show finite progress |
| Parser rejected | Preserve source, show source-located diagnostics, omit fabricated rule links |
| Verdict `UNKNOWN` | Amber state with typed reason; keep independent `FAIL` evidence; block seal |
| Invalid Consistency evidence | Render verdict-level `UNKNOWN/INVALID_EVIDENCE`; do not retain an invalid Consistency finding; preserve independent failures |
| Empty filter | “No findings for this Inquisitor” plus Show all action |
| `single` repair | One verified patch plus second-patch safety reason |
| `manual` repair | Manual reason and no automatic action |
| Stale patch | Preserve source; show `STALE_REVISION`; return focus to review heading |
| Source mismatch | Preserve source; show expected/current mismatch without partial edits |
| PBT snapshot invalid | Hide statistics values, name snapshot validation failure, retain live telemetry |
| Font failure | Use metric-compatible fallback stack without hiding content |
| Clipboard denied | Select plain-text evidence and explain manual copy |

## Cursed Sample Scroll fixture format

The following fixtures are normative. Each source block uses LF line endings and no trailing newline. Each rule source location spans its complete `RULE-ID | clause` line. `sourceLocation` computes zero-based UTF-16 offsets and one-based line/column values from the exact text, so the AST remains complete without hand-maintained offsets.

The compact constructors below return the exact feature-01 domain types; they are notation, not a second domain model.

```ts
const TRUE: Condition = { kind: "TRUE" };
const bool = (variable: string, equals: boolean): Condition =>
  ({ kind: "BOOLEAN", variable, equals });
const eq = (variable: string, value: string): Condition =>
  ({ kind: "ENUM", variable, operator: "EQ", value });
const neq = (variable: string, value: string): Condition =>
  ({ kind: "ENUM", variable, operator: "NEQ", value });
const all = (first: Condition, ...rest: readonly Condition[]): Condition =>
  ({ kind: "ALL", conditions: [first, ...rest] });
const q = (numerator: bigint, denominator = 1n): CanonicalRational =>
  ({ numerator, denominator });
const numeric = (
  variable: string,
  domain: NumericDomain,
  lower?: readonly [CanonicalRational, boolean],
  upper?: readonly [CanonicalRational, boolean],
): Condition => ({
  kind: "NUMERIC",
  bound: {
    variable,
    domain,
    ...(lower ? { lower: { value: lower[0], inclusive: lower[1] } } : {}),
    ...(upper ? { upper: { value: upper[0], inclusive: upper[1] } } : {}),
  },
});
const facet = (variable: string, first: string, ...rest: readonly string[]): ScopeFacet =>
  ({ variable, values: [first, ...rest] });
const scope = (
  actors: readonly ScopeFacet[],
  resources: readonly ScopeFacet[],
  actions: readonly ScopeFacet[],
  context: Condition = TRUE,
): RuleScope => ({ actors, resources, actions, context });
```

Fixture modules implement `sourceLocation(documentId, text, clauseRef)` by finding the unique line that begins `${clauseRef} | `, setting `start` to that line's first UTF-16 code unit, setting `end` to the line's exclusive end, and deriving one-based line and column. Duplicate or missing references fail fixture validation. Every uppercase `*_TEXT` identifier in the ASTs below is the exact preceding source block encoded as a TypeScript template literal with LF separators and no trailing newline.

### App 1 Scroll 1: Multi-Role RBAC Emergency Override Contradiction

#### Exact source text

```text
RBAC-01 | WHEN a Contractor has an active emergency override THE SYSTEM SHALL permit that Contractor to deploy to production.
RBAC-02 | WHILE the day is Sunday THE SYSTEM SHALL prohibit every Contractor from deploying to production.
RBAC-03 | WHEN an Administrator deploys to production THE SYSTEM SHALL record the deployment in the audit log.
```

#### Complete formal AST

```ts
const rbacEmergency: CovenantDocument = {
  source: {
    id: "sample.app1.rbac-emergency",
    revision: "sha256:sample-app1-rbac-v1",
    format: "EARS",
    text: RBAC_EMERGENCY_TEXT,
  },
  variables: [
    { kind: "ENUM", name: "actorRole", values: ["CONTRACTOR", "ADMINISTRATOR", "EMPLOYEE"] },
    { kind: "ENUM", name: "resource", values: ["PRODUCTION"] },
    { kind: "ENUM", name: "action", values: ["DEPLOY"] },
    { kind: "BOOLEAN", name: "emergencyOverride" },
    { kind: "ENUM", name: "day", values: ["SUNDAY", "WEEKDAY"] },
    { kind: "BOOLEAN", name: "deployPermitted" },
    { kind: "BOOLEAN", name: "auditRecorded" },
  ],
  rules: [
    {
      id: "RBAC-01",
      source: sourceLocation("sample.app1.rbac-emergency", RBAC_EMERGENCY_TEXT, "RBAC-01"),
      scope: scope([facet("actorRole", "CONTRACTOR")], [facet("resource", "PRODUCTION")], [facet("action", "DEPLOY")]),
      activation: bool("emergencyOverride", true),
      modality: "MUST",
      consequence: bool("deployPermitted", true),
    },
    {
      id: "RBAC-02",
      source: sourceLocation("sample.app1.rbac-emergency", RBAC_EMERGENCY_TEXT, "RBAC-02"),
      scope: scope([facet("actorRole", "CONTRACTOR")], [facet("resource", "PRODUCTION")], [facet("action", "DEPLOY")], eq("day", "SUNDAY")),
      activation: TRUE,
      modality: "MUST_NOT",
      consequence: bool("deployPermitted", true),
    },
    {
      id: "RBAC-03",
      source: sourceLocation("sample.app1.rbac-emergency", RBAC_EMERGENCY_TEXT, "RBAC-03"),
      scope: scope([facet("actorRole", "ADMINISTRATOR")], [facet("resource", "PRODUCTION")], [facet("action", "DEPLOY")]),
      activation: TRUE,
      modality: "MUST",
      consequence: bool("auditRecorded", true),
    },
  ],
  primaryWorkflows: [],
  unsupportedConstructs: [],
};
```

Expected primary evidence: Consistency `FAIL`; core `RBAC-01`, `RBAC-02`; witness `actorRole=CONTRACTOR`, `resource=PRODUCTION`, `action=DEPLOY`, `emergencyOverride=true`, `day=SUNDAY`; incompatible consequence `deployPermitted=true/false`.

Verified pair intent:

- Chalice A narrows `RBAC-01` to emergency overrides on weekdays.
- Chalice B adds an active-emergency-override exception to `RBAC-02`.

### App 1 Scroll 2: Over-Hardened Agent Sandbox Liveness Deadlock

#### Exact source text

```text
SAN-01 | WHILE the Agent sandbox is hardened THE SYSTEM SHALL prohibit writes to the trusted workspace.
SAN-02 | WHILE the Agent sandbox is hardened THE SYSTEM SHALL prohibit process execution for edit-and-test work.
SAN-03 | WHEN the Agent performs edit-and-test work in the trusted workspace THE SYSTEM SHALL permit workspace reads.
```

#### Complete formal AST

```ts
const sandboxDeadlock: CovenantDocument = {
  source: {
    id: "sample.app1.sandbox-deadlock",
    revision: "sha256:sample-app1-sandbox-v1",
    format: "EARS",
    text: SANDBOX_DEADLOCK_TEXT,
  },
  variables: [
    { kind: "ENUM", name: "principal", values: ["AGENT"] },
    { kind: "ENUM", name: "workspace", values: ["TRUSTED", "UNTRUSTED"] },
    { kind: "ENUM", name: "action", values: ["EDIT_AND_TEST", "READ_ONLY"] },
    { kind: "ENUM", name: "sandboxMode", values: ["HARDENED", "STANDARD"] },
    { kind: "BOOLEAN", name: "workspaceReadAllowed" },
    { kind: "BOOLEAN", name: "workspaceWriteAllowed" },
    { kind: "BOOLEAN", name: "processExecutionAllowed" },
  ],
  rules: [
    {
      id: "SAN-01",
      source: sourceLocation("sample.app1.sandbox-deadlock", SANDBOX_DEADLOCK_TEXT, "SAN-01"),
      scope: scope([facet("principal", "AGENT")], [facet("workspace", "TRUSTED")], [facet("action", "EDIT_AND_TEST")], eq("sandboxMode", "HARDENED")),
      activation: TRUE,
      modality: "MUST_NOT",
      consequence: bool("workspaceWriteAllowed", true),
    },
    {
      id: "SAN-02",
      source: sourceLocation("sample.app1.sandbox-deadlock", SANDBOX_DEADLOCK_TEXT, "SAN-02"),
      scope: scope([facet("principal", "AGENT")], [facet("workspace", "TRUSTED")], [facet("action", "EDIT_AND_TEST")], eq("sandboxMode", "HARDENED")),
      activation: TRUE,
      modality: "MUST_NOT",
      consequence: bool("processExecutionAllowed", true),
    },
    {
      id: "SAN-03",
      source: sourceLocation("sample.app1.sandbox-deadlock", SANDBOX_DEADLOCK_TEXT, "SAN-03"),
      scope: scope([facet("principal", "AGENT")], [facet("workspace", "TRUSTED")], [facet("action", "EDIT_AND_TEST")]),
      activation: TRUE,
      modality: "MUST",
      consequence: bool("workspaceReadAllowed", true),
    },
  ],
  primaryWorkflows: [
    {
      id: "workflow.edit-and-test",
      label: "Agent edits and tests code in a trusted workspace",
      entry: all(eq("principal", "AGENT"), eq("workspace", "TRUSTED"), eq("action", "EDIT_AND_TEST"), eq("sandboxMode", "HARDENED")),
      requiredConsequences: [bool("workspaceReadAllowed", true), bool("workspaceWriteAllowed", true), bool("processExecutionAllowed", true)],
    },
  ],
  unsupportedConstructs: [],
};
```

Expected primary evidence: Security & Liveness `FAIL` in category `LIVENESS`; workflow `workflow.edit-and-test`; blocking rules `SAN-01`, `SAN-02`; witness `principal=AGENT`, `workspace=TRUSTED`, `action=EDIT_AND_TEST`, `sandboxMode=HARDENED`.

Verified pair intent:

- Chalice A allows guarded workspace writes and approved test-process execution for this trusted workflow.
- Chalice B keeps the denies but excludes the declared trusted edit-and-test workflow from their activation.

### App 1 Scroll 3: API Rate-Limit & CWE-862 Security Gap Spec

#### Exact source text

```text
API-01 | WHEN an authenticated account member has at least one rate-limit token THE SYSTEM SHALL accept an update to billing settings.
API-02 | WHEN no rate-limit tokens remain THE SYSTEM SHALL prohibit acceptance of an update to billing settings.
API-03 | WHEN a caller updates billing settings THE SYSTEM SHALL validate the request input.
```

#### Complete formal AST

```ts
const apiAuthorizationGap: CovenantDocument = {
  source: {
    id: "sample.app1.api-cwe-862",
    revision: "sha256:sample-app1-api-v1",
    format: "EARS",
    text: API_AUTHORIZATION_TEXT,
  },
  variables: [
    { kind: "ENUM", name: "callerRole", values: ["ACCOUNT_MEMBER", "BILLING_ADMIN"] },
    { kind: "ENUM", name: "action", values: ["UPDATE_BILLING"] },
    { kind: "BOOLEAN", name: "authenticated" },
    { kind: "BOOLEAN", name: "authorizationVerified" },
    { kind: "NUMERIC", name: "rateLimitRemaining", domain: "INTEGER", range: { lower: { value: q(0n), inclusive: true }, upper: { value: q(1000n), inclusive: true } } },
    { kind: "BOOLEAN", name: "requestAccepted" },
    { kind: "BOOLEAN", name: "inputValidated" },
  ],
  rules: [
    {
      id: "API-01",
      source: sourceLocation("sample.app1.api-cwe-862", API_AUTHORIZATION_TEXT, "API-01"),
      scope: scope([facet("callerRole", "ACCOUNT_MEMBER")], [], [facet("action", "UPDATE_BILLING")]),
      activation: all(bool("authenticated", true), numeric("rateLimitRemaining", "INTEGER", [q(1n), true])),
      modality: "MUST",
      consequence: bool("requestAccepted", true),
    },
    {
      id: "API-02",
      source: sourceLocation("sample.app1.api-cwe-862", API_AUTHORIZATION_TEXT, "API-02"),
      scope: scope([], [], [facet("action", "UPDATE_BILLING")]),
      activation: numeric("rateLimitRemaining", "INTEGER", undefined, [q(0n), true]),
      modality: "MUST_NOT",
      consequence: bool("requestAccepted", true),
    },
    {
      id: "API-03",
      source: sourceLocation("sample.app1.api-cwe-862", API_AUTHORIZATION_TEXT, "API-03"),
      scope: scope([], [], [facet("action", "UPDATE_BILLING")]),
      activation: TRUE,
      modality: "MUST",
      consequence: bool("inputValidated", true),
    },
  ],
  primaryWorkflows: [],
  unsupportedConstructs: [],
};
```

Expected primary evidence: Security & Liveness `FAIL` in category `SECURITY`; control `CWE-862`; governed rule `API-01`; witness `callerRole=ACCOUNT_MEMBER`, `action=UPDATE_BILLING`, `authenticated=true`, `authorizationVerified=false`, `rateLimitRemaining=1`.

Verified pair intent:

- Chalice A adds `authorizationVerified=true` to the acceptance activation guard.
- Chalice B requires authorization verification and acceptance together as the governed consequence before the update proceeds.

### App 2 Scroll 1: SaaS Liability Cap vs. Uncapped Indemnification Loophole

#### Exact source text

```text
LIAB-01 | WHEN Supplier liability arises under this Agreement THE SUPPLIER MUST limit the liability payment to no more than $100,000.
LIAB-02 | WHEN Supplier liability arises from a covered third-party IP claim requiring payment above $100,000 THE SUPPLIER MUST pay the covered indemnity loss in full above $100,000.
LIAB-03 | WHILE this Agreement remains active THE SUPPLIER MUST maintain the required insurance coverage.
```

#### Complete formal AST

```ts
const liabilityIndemnity: CovenantDocument = {
  source: {
    id: "sample.app2.liability-indemnity",
    revision: "sha256:sample-app2-liability-v1",
    format: "CLAUSE",
    text: LIABILITY_INDEMNITY_TEXT,
  },
  variables: [
    { kind: "ENUM", name: "party", values: ["SUPPLIER", "CUSTOMER"] },
    { kind: "ENUM", name: "claimType", values: ["DIRECT", "IP_INDEMNITY", "PRIVACY"] },
    { kind: "ENUM", name: "action", values: ["PAY_LIABILITY"] },
    { kind: "BOOLEAN", name: "liabilityArises" },
    { kind: "BOOLEAN", name: "thirdPartyClaim" },
    { kind: "BOOLEAN", name: "coveredLossExceedsCap" },
    { kind: "NUMERIC", name: "liabilityPaymentUsd", domain: "DECIMAL", range: { lower: { value: q(0n), inclusive: true } } },
    { kind: "BOOLEAN", name: "agreementActive" },
    { kind: "BOOLEAN", name: "insuranceMaintained" },
  ],
  rules: [
    {
      id: "LIAB-01",
      source: sourceLocation("sample.app2.liability-indemnity", LIABILITY_INDEMNITY_TEXT, "LIAB-01"),
      scope: scope([facet("party", "SUPPLIER")], [facet("claimType", "DIRECT", "IP_INDEMNITY", "PRIVACY")], [facet("action", "PAY_LIABILITY")]),
      activation: bool("liabilityArises", true),
      modality: "MUST",
      consequence: numeric("liabilityPaymentUsd", "DECIMAL", undefined, [q(100000n), true]),
    },
    {
      id: "LIAB-02",
      source: sourceLocation("sample.app2.liability-indemnity", LIABILITY_INDEMNITY_TEXT, "LIAB-02"),
      scope: scope([facet("party", "SUPPLIER")], [facet("claimType", "IP_INDEMNITY")], [facet("action", "PAY_LIABILITY")]),
      activation: all(bool("liabilityArises", true), bool("thirdPartyClaim", true), bool("coveredLossExceedsCap", true)),
      modality: "MUST",
      consequence: numeric("liabilityPaymentUsd", "DECIMAL", [q(100000n), false]),
    },
    {
      id: "LIAB-03",
      source: sourceLocation("sample.app2.liability-indemnity", LIABILITY_INDEMNITY_TEXT, "LIAB-03"),
      scope: scope([facet("party", "SUPPLIER")], [], []),
      activation: bool("agreementActive", true),
      modality: "MUST",
      consequence: bool("insuranceMaintained", true),
    },
  ],
  primaryWorkflows: [],
  unsupportedConstructs: [],
};
```

Expected primary evidence: Consistency `FAIL`; core `LIAB-01`, `LIAB-02`; witness `party=SUPPLIER`, `claimType=IP_INDEMNITY`, `action=PAY_LIABILITY`, `liabilityArises=true`, `thirdPartyClaim=true`, `coveredLossExceedsCap=true`; incompatible numeric bounds `liabilityPaymentUsd <= 100000` and `> 100000`.

Verified pair intent:

- Chalice A expressly subjects covered IP indemnity payments to the $100,000 aggregate cap.
- Chalice B expressly excludes covered IP indemnity from `LIAB-01` while retaining the cap for direct and privacy claims.

### App 2 Scroll 2: Freelance IP Assignment & Kill-Fee Contradiction

#### Exact source text

```text
IP-01 | WHEN the project is terminated after concept delivery and the Client pays the kill fee THE FREELANCER MUST transfer ownership of all delivered work to the Client.
IP-02 | WHILE any part of the full project fee remains unpaid THE FREELANCER MUST NOT transfer ownership of delivered work to the Client.
IP-03 | WHEN delivered work contains the Freelancer's pre-existing tools THE FREELANCER MUST retain ownership of that background IP.
```

#### Complete formal AST

```ts
const freelanceIpKillFee: CovenantDocument = {
  source: {
    id: "sample.app2.freelance-ip-kill-fee",
    revision: "sha256:sample-app2-ip-v1",
    format: "CLAUSE",
    text: FREELANCE_IP_TEXT,
  },
  variables: [
    { kind: "ENUM", name: "party", values: ["FREELANCER", "CLIENT"] },
    { kind: "ENUM", name: "projectStatus", values: ["ACTIVE", "TERMINATED"] },
    { kind: "ENUM", name: "action", values: ["TRANSFER_DELIVERED_IP"] },
    { kind: "BOOLEAN", name: "conceptDelivered" },
    { kind: "BOOLEAN", name: "killFeePaid" },
    { kind: "BOOLEAN", name: "fullProjectFeePaid" },
    { kind: "BOOLEAN", name: "deliveredIpTransferred" },
    { kind: "BOOLEAN", name: "containsBackgroundIp" },
    { kind: "BOOLEAN", name: "backgroundIpRetained" },
    { kind: "BOOLEAN", name: "backgroundIpLicenseGranted" },
  ],
  rules: [
    {
      id: "IP-01",
      source: sourceLocation("sample.app2.freelance-ip-kill-fee", FREELANCE_IP_TEXT, "IP-01"),
      scope: scope([facet("party", "FREELANCER")], [], [facet("action", "TRANSFER_DELIVERED_IP")]),
      activation: all(eq("projectStatus", "TERMINATED"), bool("conceptDelivered", true), bool("killFeePaid", true)),
      modality: "MUST",
      consequence: all(bool("deliveredIpTransferred", true), bool("backgroundIpRetained", false)),
    },
    {
      id: "IP-02",
      source: sourceLocation("sample.app2.freelance-ip-kill-fee", FREELANCE_IP_TEXT, "IP-02"),
      scope: scope([facet("party", "FREELANCER")], [], [facet("action", "TRANSFER_DELIVERED_IP")]),
      activation: bool("fullProjectFeePaid", false),
      modality: "MUST_NOT",
      consequence: bool("deliveredIpTransferred", true),
    },
    {
      id: "IP-03",
      source: sourceLocation("sample.app2.freelance-ip-kill-fee", FREELANCE_IP_TEXT, "IP-03"),
      scope: scope([facet("party", "FREELANCER")], [], [facet("action", "TRANSFER_DELIVERED_IP")]),
      activation: bool("containsBackgroundIp", true),
      modality: "MUST",
      consequence: bool("backgroundIpRetained", true),
    },
  ],
  primaryWorkflows: [],
  unsupportedConstructs: [],
};
```

Expected evidence:

- Consistency `FAIL`; core `IP-01`, `IP-02`; witness `party=FREELANCER`, `projectStatus=TERMINATED`, `action=TRANSFER_DELIVERED_IP`, `conceptDelivered=true`, `killFeePaid=true`, `fullProjectFeePaid=false`; incompatible consequence `deliveredIpTransferred=true/false`.
- Consistency `FAIL`; core `IP-01`, `IP-03`; witness additionally includes `containsBackgroundIp=true`; incompatible consequence `backgroundIpRetained=false/true`.

Verified pair intent:

- Kill-fee conflict: Chalice A conditions transfer on full payment; Chalice B changes kill-fee consideration to a limited client license while ownership remains with the Freelancer.
- Background-IP conflict: Chalice A excludes background IP from transferred ownership; Chalice B retains background-IP ownership while granting the Client an embedded-use license through `backgroundIpLicenseGranted=true`.

### App 2 Scroll 3: Enterprise SLA Penalty & Force Majeure Deadlock

#### Exact source text

```text
SLA-01 | WHEN monthly uptime is below 99.9% THE SUPPLIER MUST issue the contractual service credit.
SLA-02 | WHILE an outage is caused by Force Majeure THE SUPPLIER MUST NOT issue a service credit for that outage.
SLA-03 | WHEN monthly uptime is below 99.9% and the Customer serves a remedy notice THE SUPPLIER MUST begin the cure period.
SLA-04 | WHILE Force Majeure remains active THE SUPPLIER MUST NOT begin the cure period.
```

#### Complete formal AST

```ts
const slaForceMajeure: CovenantDocument = {
  source: {
    id: "sample.app2.sla-force-majeure",
    revision: "sha256:sample-app2-sla-v1",
    format: "CLAUSE",
    text: SLA_FORCE_MAJEURE_TEXT,
  },
  variables: [
    { kind: "ENUM", name: "party", values: ["SUPPLIER", "CUSTOMER"] },
    { kind: "ENUM", name: "service", values: ["ENTERPRISE_SAAS"] },
    { kind: "ENUM", name: "action", values: ["PROVIDE_SLA_REMEDY"] },
    { kind: "NUMERIC", name: "monthlyUptimePercent", domain: "DECIMAL", range: { lower: { value: q(0n), inclusive: true }, upper: { value: q(100n), inclusive: true } } },
    { kind: "ENUM", name: "outageCause", values: ["PROVIDER_FAULT", "FORCE_MAJEURE", "THIRD_PARTY"] },
    { kind: "BOOLEAN", name: "remedyNoticeServed" },
    { kind: "BOOLEAN", name: "serviceCreditIssued" },
    { kind: "BOOLEAN", name: "curePeriodStarted" },
  ],
  rules: [
    {
      id: "SLA-01",
      source: sourceLocation("sample.app2.sla-force-majeure", SLA_FORCE_MAJEURE_TEXT, "SLA-01"),
      scope: scope([facet("party", "SUPPLIER")], [facet("service", "ENTERPRISE_SAAS")], [facet("action", "PROVIDE_SLA_REMEDY")]),
      activation: numeric("monthlyUptimePercent", "DECIMAL", undefined, [q(999n, 10n), false]),
      modality: "MUST",
      consequence: bool("serviceCreditIssued", true),
    },
    {
      id: "SLA-02",
      source: sourceLocation("sample.app2.sla-force-majeure", SLA_FORCE_MAJEURE_TEXT, "SLA-02"),
      scope: scope([facet("party", "SUPPLIER")], [facet("service", "ENTERPRISE_SAAS")], [facet("action", "PROVIDE_SLA_REMEDY")], eq("outageCause", "FORCE_MAJEURE")),
      activation: TRUE,
      modality: "MUST_NOT",
      consequence: bool("serviceCreditIssued", true),
    },
    {
      id: "SLA-03",
      source: sourceLocation("sample.app2.sla-force-majeure", SLA_FORCE_MAJEURE_TEXT, "SLA-03"),
      scope: scope([facet("party", "SUPPLIER")], [facet("service", "ENTERPRISE_SAAS")], [facet("action", "PROVIDE_SLA_REMEDY")]),
      activation: all(numeric("monthlyUptimePercent", "DECIMAL", undefined, [q(999n, 10n), false]), bool("remedyNoticeServed", true)),
      modality: "MUST",
      consequence: bool("curePeriodStarted", true),
    },
    {
      id: "SLA-04",
      source: sourceLocation("sample.app2.sla-force-majeure", SLA_FORCE_MAJEURE_TEXT, "SLA-04"),
      scope: scope([facet("party", "SUPPLIER")], [facet("service", "ENTERPRISE_SAAS")], [facet("action", "PROVIDE_SLA_REMEDY")], eq("outageCause", "FORCE_MAJEURE")),
      activation: TRUE,
      modality: "MUST_NOT",
      consequence: bool("curePeriodStarted", true),
    },
  ],
  primaryWorkflows: [
    {
      id: "workflow.sla-remedy",
      label: "Customer obtains the contractual SLA remedy after a noticed outage",
      entry: all(
        eq("service", "ENTERPRISE_SAAS"),
        eq("action", "PROVIDE_SLA_REMEDY"),
        numeric("monthlyUptimePercent", "DECIMAL", undefined, [q(999n, 10n), false]),
        eq("outageCause", "FORCE_MAJEURE"),
        bool("remedyNoticeServed", true),
      ),
      requiredConsequences: [bool("serviceCreditIssued", true), bool("curePeriodStarted", true)],
    },
  ],
  unsupportedConstructs: [],
};
```

Expected evidence:

- Consistency `FAIL`; core `SLA-01`, `SLA-02`; witness includes `monthlyUptimePercent=0`, `outageCause=FORCE_MAJEURE`; incompatible consequence `serviceCreditIssued=true/false`.
- Consistency `FAIL`; core `SLA-03`, `SLA-04`; witness additionally includes `remedyNoticeServed=true`; incompatible consequence `curePeriodStarted=true/false`.
- Security & Liveness `FAIL` in category `LIVENESS`; workflow `workflow.sla-remedy`; blocking rules include `SLA-02`, `SLA-04`.

Verified pair intent for each finding:

- Credit conflict: Chalice A excludes Force Majeure from `SLA-01`; Chalice B replaces the absolute prohibition in `SLA-02` with a matching obligation to issue the contractual credit.
- Cure conflict: Chalice A excludes Force Majeure from `SLA-03`; Chalice B replaces the prohibition in `SLA-04` with a matching obligation to begin the cure period.
- Remedy liveness: Chalice A changes `SLA-02` and `SLA-04` from prohibitions to explicit `MAY` permissions, removing the hard blocks; Chalice B changes both to `MUST`, guaranteeing both required workflow consequences. The two resulting normalized models are distinct and use only declared Boolean and enum values.

## Normative Chalice fixture edits

Every sample patch uses the current sample revision, a `RepairCore` containing exactly the named rule IDs, and one `SourceEdit` per replacement below. Each edit spans the complete rule line, uses that complete original line as `expectedText`, and uses the listed complete line as `replacementText`. Patch IDs follow `<sample-id>.<finding-key>.<a|b>`. The fixture builder derives source offsets and collision-free canonical semantic fingerprints, then snapshots those exact values. Verification must reject any fixture whose target finding remains, whose A/B normalized models match, whose re-verification is indecisive, or whose rule outside the Repair Core changes.

### RBAC emergency, core `RBAC-01` + `RBAC-02`

- **A, narrow emergency permission:** `RBAC-01 | WHEN a Contractor has an active emergency override and the day is not Sunday THE SYSTEM SHALL permit that Contractor to deploy to production.`
- **B, exempt active emergencies from the prohibition:** `RBAC-02 | WHILE the day is Sunday and no emergency override is active THE SYSTEM SHALL prohibit every Contractor from deploying to production.`
- Both preserve `RBAC-03` byte-for-byte and semantically.

### Sandbox liveness, Repair Core `SAN-01` + `SAN-02`

- **A, move hard denies to untrusted workspaces:** replace `SAN-01` with `SAN-01 | WHILE the Agent sandbox is hardened THE SYSTEM SHALL prohibit writes to an untrusted workspace.` and replace `SAN-02` with `SAN-02 | WHILE the Agent sandbox is hardened THE SYSTEM SHALL prohibit process execution for work in an untrusted workspace.`
- **B, guarantee the declared trusted workflow:** replace `SAN-01` with `SAN-01 | WHEN the Agent performs edit-and-test work in the hardened trusted workspace THE SYSTEM SHALL permit workspace writes.` and replace `SAN-02` with `SAN-02 | WHEN the Agent performs edit-and-test work in the hardened trusted workspace THE SYSTEM SHALL permit process execution.`
- Both preserve `SAN-03` byte-for-byte and semantically.

### API authorization, Repair Core `API-01`

- **A, authorization guard:** `API-01 | WHEN an authenticated and authorized account member has at least one rate-limit token THE SYSTEM SHALL accept an update to billing settings.`
- **B, governed authorization obligation:** `API-01 | WHEN an authenticated account member has at least one rate-limit token THE SYSTEM SHALL verify account authorization before accepting an update to billing settings.`
- A compiles `authorizationVerified=true` into applicability. B compiles `authorizationVerified=true AND requestAccepted=true` as the consequence. Both preserve `API-02` and `API-03`.

### Liability conflict, core `LIAB-01` + `LIAB-02`

- **A, cap indemnity:** `LIAB-02 | WHEN Supplier liability arises from a covered third-party IP claim requiring payment above $100,000 THE SUPPLIER MUST limit the covered indemnity payment to no more than $100,000.`
- **B, explicit indemnity carve-out:** `LIAB-01 | WHEN Supplier liability other than a covered third-party IP indemnity arises under this Agreement THE SUPPLIER MUST limit the liability payment to no more than $100,000.`
- Both preserve `LIAB-03` byte-for-byte and semantically.

### Freelance kill-fee conflict, core `IP-01` + `IP-02`

- **A, full-payment condition:** `IP-01 | WHEN the project is terminated after concept delivery and the Client pays the full project fee THE FREELANCER MUST transfer ownership of delivered work to the Client, excluding background IP.`
- **B, limited license only:** `IP-01 | WHEN the project is terminated after concept delivery and the Client pays the kill fee THE FREELANCER MUST grant a limited client license without transferring ownership of delivered work or background IP.`
- Both preserve `IP-03` byte-for-byte and semantically.

### Freelance background-IP conflict, core `IP-01` + `IP-03`

- **A, ownership exclusion:** `IP-01 | WHEN the project is terminated after concept delivery and the Client pays the kill fee THE FREELANCER MUST transfer ownership of delivered work to the Client, excluding the Freelancer's background IP.`
- **B, retained ownership plus embedded-use license:** replace `IP-01` with the A text and replace `IP-03` with `IP-03 | WHEN delivered work contains the Freelancer's pre-existing tools THE FREELANCER MUST retain that background IP and grant the Client a perpetual embedded-use license.`
- A and B differ through `backgroundIpLicenseGranted=false/true`; both preserve `IP-02`.

### SLA credit conflict, core `SLA-01` + `SLA-02`

- **A, metric exclusion:** `SLA-01 | WHEN monthly uptime is below 99.9% and the outage is not caused by Force Majeure THE SUPPLIER MUST issue the contractual service credit.`
- **B, aligned Force Majeure remedy:** `SLA-02 | WHILE an outage is caused by Force Majeure THE SUPPLIER MUST issue the contractual service credit for that outage.`
- Both preserve `SLA-03` and `SLA-04`.

### SLA cure conflict, core `SLA-03` + `SLA-04`

- **A, notice obligation exclusion:** `SLA-03 | WHEN monthly uptime is below 99.9%, the Customer serves a remedy notice, and the outage is not caused by Force Majeure THE SUPPLIER MUST begin the cure period.`
- **B, aligned Force Majeure cure:** `SLA-04 | WHILE Force Majeure remains active THE SUPPLIER MUST begin the cure period.`
- Both preserve `SLA-01` and `SLA-02`.

### SLA remedy liveness, Repair Core `SLA-02` + `SLA-04`

- **A, remove hard blocks:** replace `SLA-02` with `SLA-02 | WHILE an outage is caused by Force Majeure THE SUPPLIER MAY issue the contractual service credit for that outage.` and replace `SLA-04` with `SLA-04 | WHILE Force Majeure remains active THE SUPPLIER MAY begin the cure period.`
- **B, guarantee the remedy:** replace `SLA-02` and `SLA-04` with the corresponding `MUST` clauses from the B repairs above.
- Both preserve `SLA-01` and `SLA-03`.

## Fixture integrity and sample loading

Each application exports a readonly catalog:

```ts
export interface CursedSampleScroll {
  readonly id: string;
  readonly title: string;
  readonly summary: string;
  readonly document: CovenantDocument;
  readonly expectedFindingFingerprints: readonly string[];
}
```

At build and test time, every fixture must pass `validateCovenantDocument`, source-location slicing, unique rule-ID checks, Phantom Witness replay, expected core checks, and both standard Chalice applications. The UI receives the validated `CovenantDocument`; it never reconstructs AST meaning from display text.

The symbolic revision strings above are stable fixture IDs in this design. Implementation may replace each with the actual canonical source SHA-256 only if all guarded patches and expected snapshots are regenerated atomically.

## Application composition

### Spec Inquisitor

The first viewport presents the Lantern Bar as a brass instrument rail, a large editable EARS source scroll, and the active evidence stack. A finite phosphor trace begins at the Verify action, crosses the rail once, and resolves into lantern states. Sample switching is adjacent to the document title; export actions remain after repair evidence. App 1 exports patched EARS source and a `fast-check` snippet generated by core-approved formatters.

### Clause Exorcist

The first viewport presents the Lantern Bar as a dark chancery docket, a wide numbered clause folio, and an evidence stack that resembles filed exhibits rather than dashboard cards. Marginal clause references remain visible while reading. The seal occupies the final report edge only after certification. App 2 exports a source redline and plain-English negotiation summary.

Both applications preserve the same DOM order, keyboard behavior, statuses, action labels, and repair safeguards.

## Testing strategy

### Shared component tests

Use Vitest, React Testing Library, and a DOM accessibility matcher layer to test:

- invariant Inquisitor order and tab keyboard behavior;
- aggregate live announcements;
- Unsat Core source highlighting and evidence links;
- exact witness rendering and copy output;
- pair, single, and manual resolution branches;
- patch review, applying, applied, and each typed rejection state;
- seal gating from all five verdicts and `report.certifiable`;
- separation of OpenPBTStats and live telemetry;
- loading with prior evidence retained, empty filters, parser rejection, operational failure, invalid PBT snapshot, and clipboard denial;
- overlong clauses, rule IDs, and exact rational values without page-level overflow;
- reduced-motion branch and focus restoration;
- forced-color semantic classes and non-color status labels.

Tests use the six normative fixtures rather than hand-written partial report objects wherever the full path matters.

### Application integration tests

For every sample:

1. Select the sample and assert exact source text.
2. Verify with `BrowserDeterministicSolver`.
3. Select each expected finding and assert source/evidence linkage.
4. Replay and copy the Phantom Witness where present.
5. Review and apply Chalice A from a clean revision.
6. Assert the target finding disappears and preservation is 100%.
7. Reload the clean fixture and repeat for Chalice B.
8. Assert unrelated rules retain source and semantic fingerprints.
9. Assert no browser network request is required.

### Responsive and visual regression tests

Capture both skins at 360, 768, 1024, 1280, and 1600 CSS pixels. The matrix includes `PASS`, `FAIL`, `UNKNOWN`, pair, single, manual, drawer-open, patch-review, rejection, overlong clause, long rational, forced-colors, and reduced-motion states. Screenshots settle motion before capture.

### Accessibility tests

Automated checks must report no critical or serious violations. Manual checks cover tablist behavior, separator keyboard controls, source-to-evidence focus, live announcements, clipboard fallback, zoom to 200%, reflow at 320 CSS pixels, forced colors, and reduced motion.

### Bundle and offline tests

Production asset inspection fails on `z3-solver`, `NodeZ3Solver`, `.wasm`, `SharedArrayBuffer`, remote font URLs, or required backend endpoints. A browser test serves each application with all outbound network blocked and exercises sample load, verification, both Chalices, export, and telemetry.

## Requirement traceability

| Requirements | Design seam |
| --- | --- |
| 1 | Ownership boundaries, module layout, public contract |
| 2–3 | `DESIGN.md`, theme tokens, self-hosted font strategy |
| 4 | `InquisitorLanternBar` |
| 5 | `SplitScrollInspector` |
| 6 | `PhantomWitnessStand` |
| 7 | `ChaliceResolutionPanel`, patch state machine |
| 8 | `CertificationSeal` |
| 9 | `VerificationDrawer` |
| 10–11 | Application composition and skin contracts |
| 12 | Six normative fixture definitions and fixture integrity |
| 13 | Central motion variants and reduced-motion branch |
| 14–15 | Responsive composition, accessibility, edge states |
| 16 | Test strategy, bundle and offline gates, line budget |

## Out of scope

- Altering feature-01 formal semantics, evidence, or solver boundaries.
- Implementing the optional BYOK translator.
- Running Z3, WebAssembly solving, or PBT suites in the browser.
- Persisting user documents to a backend.
- Adding a third skin or application-specific fork of a shared component.
- Using animation or Gothic ornament as a substitute for evidence.

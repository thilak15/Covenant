---
name: COVENANT Haunted Tribunal
description: A Gothic formal-verification chamber built from evidence, vellum, brass, and decisive state light.
colors:
  obsidian-950: "#090C0E"
  obsidian-900: "#101518"
  obsidian-800: "#182024"
  obsidian-700: "#273137"
  vellum-50: "#F5E9CB"
  vellum-100: "#E9D6AA"
  vellum-300: "#CDB37A"
  vellum-ink: "#16120D"
  tarnished-brass: "#B69355"
  dark-brass: "#74552E"
  emerald-sat: "#31C978"
  emerald-deep: "#0B6B45"
  blood-unsat: "#D94252"
  blood-deep: "#811525"
  amber-unknown: "#D49A37"
  app1-grid: "#21463D"
  app1-phosphor: "#79E6AA"
  app2-mahogany: "#321719"
  app2-wax: "#A51F32"
  scrim: "rgba(9, 12, 14, 0.78)"
typography:
  app1-display:
    fontFamily: "Alegreya, Iowan Old Style, Georgia, serif"
    fontSize: "clamp(2rem, 4vw, 4.5rem)"
    fontWeight: 650
    lineHeight: 0.96
    letterSpacing: "-0.025em"
  app2-display:
    fontFamily: "Bodoni Moda, Didot, Times New Roman, serif"
    fontSize: "clamp(2rem, 4vw, 4.5rem)"
    fontWeight: 600
    lineHeight: 0.94
    letterSpacing: "-0.03em"
  headline:
    fontFamily: "Alegreya, Iowan Old Style, Georgia, serif"
    fontSize: "clamp(1.375rem, 2vw, 2rem)"
    fontWeight: 600
    lineHeight: 1.08
  body:
    fontFamily: "Commissioner, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 430
    lineHeight: 1.55
  label:
    fontFamily: "Commissioner, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 650
    lineHeight: 1.2
    letterSpacing: "0.08em"
  witness-mono:
    fontFamily: "Fragment Mono, ui-monospace, SFMono-Regular, monospace"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.5
rounded:
  seal: "999px"
  control: "3px"
  panel: "6px"
  parchment: "10px 4px 8px 3px"
spacing:
  hairline: "1px"
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "32px"
  2xl: "48px"
  3xl: "72px"
components:
  tribunal-shell:
    backgroundColor: "{colors.obsidian-950}"
    textColor: "{colors.vellum-50}"
    typography: "{typography.body}"
  parchment-panel:
    backgroundColor: "{colors.vellum-50}"
    textColor: "{colors.vellum-ink}"
    rounded: "{rounded.parchment}"
    padding: "{spacing.lg}"
  button-primary:
    backgroundColor: "{colors.tarnished-brass}"
    textColor: "{colors.obsidian-950}"
    typography: "{typography.label}"
    rounded: "{rounded.control}"
    padding: "12px 18px"
  button-danger:
    backgroundColor: "{colors.blood-deep}"
    textColor: "{colors.vellum-50}"
    typography: "{typography.label}"
    rounded: "{rounded.control}"
    padding: "12px 18px"
  witness-row:
    backgroundColor: "{colors.obsidian-900}"
    textColor: "{colors.app1-phosphor}"
    typography: "{typography.witness-mono}"
    rounded: "{rounded.control}"
    padding: "8px 12px"
  lantern-pass:
    backgroundColor: "{colors.emerald-deep}"
    textColor: "{colors.emerald-sat}"
    rounded: "{rounded.seal}"
    size: "16px"
  lantern-fail:
    backgroundColor: "{colors.blood-deep}"
    textColor: "{colors.blood-unsat}"
    rounded: "{rounded.seal}"
    size: "16px"
  lantern-unknown:
    backgroundColor: "{colors.dark-brass}"
    textColor: "{colors.amber-unknown}"
    rounded: "{rounded.seal}"
    size: "16px"
---

# Design System: COVENANT Haunted Tribunal

## Overview

**Creative North Star: "The Evidence Chamber"**

COVENANT should feel like evidence has been carried into a dark tribunal, set under a precise lamp, and made impossible to ignore. Gothic material supplies identity, while the interaction model stays closer to disciplined code and contract review than to a theatrical game. Every ornament must clarify provenance, verdict, conflict, or repair.

Spec Inquisitor is an alchemical engineering bench where parchment meets calibrated phosphor traces. Clause Exorcist is a candlelit chancery where dense legal paper, mahogany, and wax carry institutional gravity. Both skins preserve identical component behavior, state colors, reading order, and evidence language.

**Key Characteristics:**

- Dark structural chrome around bright, readable evidence surfaces.
- Formal state colors used as signals, never ambient decoration.
- Editorial headings, crisp operational copy, and monospace assignments.
- Fine brass rules, asymmetric parchment edges, and restrained material depth.
- Dense desktop evidence views that collapse into a deliberate mobile sequence.

## Colors

Obsidian establishes the chamber, vellum carries source and repair text, brass identifies controls and boundaries, and the three status colors communicate proof state. Frontmatter values are normative.

### Primary

- **Obsidian Slate:** The obsidian steps form the application shell, raised rails, and nested evidence wells.
- **Aged Vellum:** The vellum steps carry editable source, legal clauses, diff previews, and long-form explanations.

### Secondary

- **Tarnished Brass:** Brass marks active controls, section rules, focus-adjacent trim, and selected navigation without pretending to be a proof result.
- **Blood Crimson:** The bright token marks `FAIL`, active Unsat Core lines, destructive implications, and unresolved conflict links. The deep token supports readable crimson text on vellum and wax surfaces.

### Tertiary

- **Emerald SAT:** Emerald is reserved for `PASS`, successful preservation, verified patches, and certification readiness.
- **Amber Unknown:** Amber means `UNKNOWN`, incomplete evidence, a pending solve, or blocked certification.
- **App 1 Phosphor:** Pale green belongs only to traces, live measurements, and code-adjacent witness values in Spec Inquisitor.
- **App 2 Mahogany and Wax:** Mahogany deepens Clause Exorcist containers; wax crimson belongs to seals and legal action emphasis.

### Neutral

- **Vellum Ink:** Near-black warm ink is the default on paper.
- **Obsidian 700:** The lightest structural neutral is the maximum value for inactive borders and disabled controls.
- **Scrim:** The shared scrim grounds drawers and confirmation layers without introducing glass effects.

### Normative contrast pairs

- Vellum 50 on Obsidian 950: 16.25:1.
- Vellum Ink on Vellum 50: 15.45:1.
- Blood UNSAT on Obsidian 950: 4.53:1; Blood Deep on Vellum 50: 8.42:1.
- Emerald SAT on Obsidian 950: 9.11:1.
- Amber Unknown on Obsidian 950: 7.92:1.
- Tarnished Brass on Obsidian 950: 6.81:1.

These measured sRGB ratios define approved text pairings. Tinted, translucent, or blended variants require their own contrast test.

### Named Rules

**The Verdict Monopoly Rule.** Emerald, blood crimson, and amber appear only where a state or evidence relationship earns them.

**The No Purple Rule.** No purple, violet, magenta, indigo, or neon-purple gradient may enter a token, illustration, focus ring, chart, or skin.

**The Evidence Contrast Rule.** Normal text must meet WCAG AA. Status always pairs color with an icon, word, and accessible name.

## Typography

- **App 1 Editorial Font:** Alegreya, self-hosted from Google Fonts under the OFL, with Iowan Old Style and Georgia fallbacks.
- **App 2 Editorial Font:** Bodoni Moda, self-hosted from Google Fonts under the OFL, with Didot and Times New Roman fallbacks.
- **Operational Font:** Commissioner, self-hosted from Google Fonts under the OFL, with a system sans fallback.
- **Witness Font:** Fragment Mono, self-hosted from Google Fonts under the OFL, with platform monospace fallbacks.

**Character:** The serif voices give rulings and section titles editorial gravity. Commissioner keeps controls, findings, and explanations precise at working density. Fragment Mono makes Phantom Witness variables and exact values align without turning the product into a terminal.

### Hierarchy

- **Display:** Used once per major application state or sample title; never competes with source.
- **Headline:** Used for evidence regions, finding titles, and the active Inquisitor name.
- **Title:** Commissioner at 1rem and weight 650 for panel headings and patch strategies.
- **Body:** Commissioner at the normative token with prose constrained to 72ch.
- **Label:** Uppercase only for short state, metric, or navigation labels. Actions and explanations use sentence case.
- **Witness:** Fragment Mono for variables, exact values, rule IDs, line numbers, bounds, and telemetry.

### Named Rules

**The Three Voices Rule.** Serif delivers judgment, sans supports action, and monospace carries machine-verifiable evidence.

**The Offline Type Rule.** Production bundles self-host subsetted WOFF2 files. Google Fonts network requests are prohibited on the judge path.

## Layout

The desktop shell uses a 12-column grid within a 1600px maximum canvas and 24px gutters. The Lantern Bar occupies the full top rail. The primary work area gives seven columns to source and five columns to evidence. The telemetry drawer docks to the lower edge and never covers the current source line.

At 1024px to 1279px, the split becomes 6/6 and secondary metadata collapses. Below 1024px, the interface becomes one column in this order: Lantern Bar, active finding summary, source clauses, Phantom Witness, resolution, export actions, telemetry. Below 640px, the Lantern Bar becomes a horizontally scrollable labeled tablist, Chalices stack vertically, and source lines retain a fixed rule-ID gutter.

Use a 4px base rhythm. Controls are at least 44px high. Dense evidence rows may use 8px vertical spacing, while regions use 24px to 48px separation. Parchment text never exceeds 78ch. Split panes have keyboard-operable resize handles and a reset action.

**The Source Leads Rule.** On wide screens source remains the largest continuous region. Evidence may become intense but may not displace the document being judged.

## Elevation & Depth

Depth is structural and material. Obsidian surfaces separate through tonal steps and one-pixel brass or slate rules. Vellum lifts with a tight contact shadow and a broader low-opacity ambient shadow. Lanterns emit a state halo only while changing or when selected. Frosted glass, luminous card outlines, and omnipresent glows are prohibited.

### Shadow Vocabulary

- **Obsidian rail:** `0 1px 0 rgba(182,147,85,.35), 0 12px 30px rgba(0,0,0,.34)` for the Lantern Bar and docked drawer.
- **Vellum lift:** `0 1px 0 rgba(255,255,255,.18) inset, 0 10px 28px rgba(0,0,0,.28)` for source and patch paper.
- **Lantern flare:** `0 0 0 1px currentColor, 0 0 18px currentColor` only during a verdict transition or on the active filter.
- **Seal contact:** `0 4px 0 rgba(72,8,18,.58), 0 12px 24px rgba(0,0,0,.28)` while certification settles.

**The Lamp, Not Fog Rule.** Light belongs to one active state. Screen-wide colored haze and gradients weaken hierarchy and are prohibited.

## Shapes

The shell and controls use restrained 3px to 6px corners. Parchment uses one asymmetric corner signature to suggest cut paper without torn-edge clip paths. Circular geometry is reserved for lantern apertures and certification. Brass dividers are straight, fine, and occasionally interrupted by a centered rule ID or state label.

Chalices use a simple engraved Lucide cup icon. Hooded Inquisitors use neutral silhouettes without religious, military, supremacist, or historical insignia. Wax uses an authored irregular edge mask plus the COVENANT wordmark, never a generic red circle.

**The Restrained Relic Rule.** One material cue per component is enough: paper edge, brass rule, phosphor trace, or wax impression.

## Components

### 5 Hooded Inquisitors Lantern Bar

A `tablist` of five invariant Inquisitors in formal order. Each tab combines a hood icon, full property name, verdict word, finding count, and lantern. Selecting a tab filters findings without changing the report. Status resolves left to right with 70ms stagger, one controlled halo peak, and no persistent pulse.

### Split Scroll Clause Inspector

The source pane is authoritative. Every clause has a line number, stable rule ID, source text, and optional finding marker. Unsat Core members receive a deep-crimson paper wash, 3px blood edge, and linked core badge. Hover or focus on an evidence reference highlights its clause; activation scrolls evidence into view without stealing focus. Diffs use text markers and icons in addition to color.

### Phantom Witness Stand

The Stand answers: “What concrete assignment activates every rule in this Unsat Core?” It presents a two-column variable/value table in Fragment Mono, followed by activated rule IDs and a plain-language triggered result. Values retain exact rational formatting. Copy evidence produces the deterministic table and result.

### Two Cursed Chalices Resolution Panel

A verified pair renders A and B with equal weight, distinct strategies, guarded source diffs, target rule IDs, and Preservation Property proof. `single` renders one patch plus the reason a second is unsafe. `manual` renders no false action. The original verdict remains visible. Applying a patch locks actions, updates replacement lines, re-runs verification, and reveals proof only after decisive success.

### Crimson Wax Seal of Formal Certification

The seal exists only when `report.certifiable` is true and all five verdicts are `PASS`. It rotates from -7 degrees, scales from 1.35, makes contact at .96, and settles at 1 within 520ms. The static result reads “Formally certified” with the revision. `UNKNOWN` and `FAIL` show a certification-blocked explanation instead of a ghosted seal.

### OpenPBTStats / Verification Telemetry Drawer

Collapsed, the drawer is a one-line ledger. Expanded, it separates live solver latency and clauses checked from checked-in PBT property statistics. It states that property tests ran in Node and were not executed in the browser.

### App 1 Skin: Alchemical DevSecOps Parchment & Brass Oscilloscope

App 1 uses Alegreya, a denser 7/5 workbench split, fine grid traces behind telemetry only, and phosphor values for active measurements. Brass controls resemble engraved instrument labels while source remains vellum. Verification draws one left-to-right trace and never loops.

### App 2 Skin: Candlelit Victorian Chancery & Crimson Wax Seal

App 2 uses Bodoni Moda, wider legal-reading measures, mahogany wells behind stacked papers, and wax accents around certified actions. Clause numbers and marginalia carry more weight than telemetry. Candlelight comes from warm local contrast and directional shadow, not animated flames or yellow gradients.

### Motion and interaction

Use Framer Motion only for state transitions, evidence linkage, drawer choreography, patch application, and certification. Settling uses `cubic-bezier(.22,1,.36,1)` and controls use `cubic-bezier(.4,0,.2,1)`. Micro transitions last 120–180ms, panel changes 220–320ms, verdict choreography at most 420ms, and certification at most 520ms. Prefer transforms and opacity.

`prefers-reduced-motion: reduce` removes stagger, sweep, rotation, parallax, and overshoot. It preserves immediate state visibility, focus, announcements, and functional scrolling.

## Do's and Don'ts

### Do:

- **Do** keep rule IDs, verdict words, and evidence relationships visible without hover.
- **Do** let source text and formal evidence dominate every viewport.
- **Do** use brass for structure and action, emerald for proof, crimson for proven failure, and amber for uncertainty.
- **Do** self-host the specified Google Fonts and retain system fallbacks.
- **Do** test both skins at 360px, 768px, 1024px, 1280px, and 1600px widths.
- **Do** provide keyboard, screen-reader, forced-color, reduced-motion, loading, empty, error, and overlong states.

### Don't:

- **Don't** use neon purple, violet-blue gradients, glass cards, or glowing borders as atmosphere.
- **Don't** animate lanterns continuously or make proof status feel like a game reward.
- **Don't** hide a `FAIL` because a patch is unavailable or another check is `UNKNOWN`.
- **Don't** render a Phantom Witness as prose alone.
- **Don't** place Z3, PBT execution, login, network font request, or required API on the static browser path.
- **Don't** duplicate shared component behavior or evidence formatting inside either application.

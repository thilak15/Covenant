---
inclusion: always
---
# Issue tracker: Local Markdown in `.kiro/`

Everything lives as local Markdown under `.kiro/`. Do NOT use GitHub Issues, Linear, or `.scratch/`.

## Conventions
- One feature per directory: `.kiro/specs/<feature-name>/` (e.g. `02-haunted-tribunal-ui`)
- Feature spec: `requirements.md` and `design.md` in that directory.
  - `requirements.md` uses strict Kiro EARS syntax: `WHEN <trigger> THE SYSTEM SHALL <response>`, `IF <condition> THEN THE SYSTEM SHALL <response>`, `WHILE <state> THE SYSTEM SHALL <response>`, `WHERE <feature> THE SYSTEM SHALL <response>`. Each requirement has a user story and numbered acceptance criteria.
  - `design.md` covers architecture, components, data models, error handling, testing.
- Tickets / tasks: a single `.kiro/specs/<feature-name>/tasks.md`, a checkbox list (`- [ ] 1. Title`), with sub-tasks nested and each task referencing requirements (`_Requirements: 1.2, 1.3_`). Blocking edges are written as `Blocked by: <task numbers>` under the task. This replaces the one-file-per-ticket convention.
- UI design system: `.kiro/specs/02-haunted-tribunal-ui/DESIGN.md`.
- Triage state is a `Status:` line under the task (`open`, `claimed`, `resolved`). The `triage` skill is not installed, so no label vocabulary is configured.

## When a skill says "publish to the issue tracker"
- Spec: write/update `requirements.md` and `design.md` in `.kiro/specs/<feature-name>/`.
- Tickets: write/update `tasks.md` in the same directory.

## When a skill says "fetch the relevant ticket"
Read `.kiro/specs/<feature-name>/tasks.md` and find the task by number.

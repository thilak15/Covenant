---
inclusion: always
---
# Domain Docs

Single-context layout, all under `.kiro/steering/`.

## Before exploring, read these
- `.kiro/steering/GLOSSARY.md`: domain model and terminology.
- `.kiro/steering/adr/`: ADRs (`NNNN-slug.md`, numbered from `0001`). Read those touching the area you're working in.

If these don't exist, proceed silently. `/domain-modeling` creates them lazily as terms and decisions get resolved.

## Use the glossary's vocabulary
Use terms as defined in `GLOSSARY.md` in issue titles, specs, tasks, and test names. Don't drift to synonyms it avoids.

## Flag ADR conflicts
If your output contradicts an existing ADR, say so explicitly rather than silently overriding.

## Where other artifacts live
- Specs: `.kiro/specs/<feature-name>/requirements.md` (EARS) and `design.md`
- Tasks: `.kiro/specs/<feature-name>/tasks.md`
- UI design system: `.kiro/specs/02-haunted-tribunal-ui/DESIGN.md`

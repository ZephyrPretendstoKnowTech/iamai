# Prompt files

Each file is one instruction set for Claude Code. They live in the repo so every
session can re-read exactly what it was asked, and so the request history is
versioned alongside the code.

Run one by saying, in Claude Code:

    Read docs/prompts/<file> and carry it out exactly as written. Do not start
    until you have read it in full. When finished, summarize what changed,
    list anything you could not do and why, and confirm the commit.

Run them in numeric order. Do not run the next one until the previous one has
committed.

| File | Purpose | Precondition |
|---|---|---|
| `00-scoring-split.md` | Activity vs MFA as two dimensions; strongest method; UI copy fixes | Skip if the table already shows Activity and MFA state as separate columns |
| `01-lock-data-model.md` | Every data field and document later features depend on | 00 done |
| `02-lane-b.md` | Sign-in evidence collection and the derived tables | 01 done |
| `03-app-shell.md` | Design system, navigation, footer, Readiness table features | Edit the two URL placeholders in the file first; 02 done |
| `04-ux-flow.md` | Guided stepper, Start page, navy design refresh, tenant name in header, baseline About card, readiness copy fixes | 03 done |
| `05-coverage-engine.md` | Goals, classification, population-set coverage, Coverage page | 04 done; docs/design/intents.md present |
| `06-mapping.md` | Mapping questionnaire with validation, variants, applicability, target state | 05 done |
| `07-roadmap-v1.md` | Step generation, actions, gating, progress, print, save/load plan | 06 done; docs/design/roadmap.md present |

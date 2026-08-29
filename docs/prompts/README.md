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

History: 00–13 were executed 2026-08-26/27 (08–13 in commits b067fd0…073bc8c), followed by the first audit (docs/design/audit-01.md). 00–07 were executed 2026-08-26/27. That night's review reset the
product from "engine + checklist" to an advisor (see `docs/design/roadmap.md`
§10 and the "Overnight" commits); later prompts should assume the Setup
wizard, Findings narrative, and dated Roadmap as the baseline experience.

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
| `08-design-system-v2.md` | Vibrant navy/teal tokens, shared component set, header and footer fixes | 07 done; docs/design/ux-review-01.md present |
| `09-voice-and-copy.md` | Product voice, central copy, human statement templates, no first person | 08 done |
| `10-scan-inventory.md` | Scan progress bar, inventory sub-pages, info tips, package instructions page | 09 done |
| `11-setup-polish.md` | Pickers with suggestions and multi-select, frameworks, workload cards, vendor policies, Setup→roadmap consistency | 10 done |
| `12-roadmap-pacing-print.md` | Wave scheduling and pace presets, dependency gating, classifier fixes, real print layout | 11 done |
| `13-live-review-fixes.md` | Responsive layout, one stepper status rule, one name per step, Setup section behaviour, names-not-GUIDs in actions, tenant naming convention, announcements by goal family, precise blocked reasons, single derived plan result | 12 done; docs/design/ux-review-02-live.md present |
| `14-copy-lint-terms-and-navigation.md` | Copy lint test, final terminology, timezone everywhere, baseline persistence, sticky sidebar, deep links, first-batch wait state | 13 done; docs/design/ux-review-03.md present |
| `15-inventory-fixes.md` | Role template catalogue, resolved holders, friendly licence names, shared Authenticator device column | 14 done |
| `16-setup-redesign.md` | Advanced options, answer feedback, detected service accounts, countries allowlist, workload labels, Q7 fix | 15 done |
| `17-scoring-and-findings.md` | Three-dimension scoring, group/sort controls, badges, step copy fixes | 16 done |
| `18-pacing-by-size-and-timeline.md` | Pace preset by tenant size, schedule rationale, timeline auto-hide, verification on this tenant | 17 done |
| `19-qa-sweep.md` | Button ink, question count, legend cards, findings controls; a full audit (docs/qa/audit-01.md) and its fixes; cross-page consistency test | 18 done |
| `20-hardening-and-trust.md` | Hygiene scan, error boundary, session-expiry pause, retry and lane-isolation tests, plan round-trip, accessibility, performance guard, print check, scan age, CI smoke test | 19 done |
| `23-review-06-fixes.md` | Baseline persistence root cause, loading states, portal words, no ids in prose, one population per step, Setup Q2 validation and suggestions, domains from controls, consolidation rule, ad-hoc titles, lazy panels and cards (perf-03), copy §17-§24, wide tables, dev=fail | 22 done; docs/design/ux-review-06.md present |
| `22-correctness-and-polish.md` | Exclusions by membership, one admin set, role names, baseline persistence, Below the baseline, ad-hoc goal scores and merges, 18 copy fixes, accessibility and layout, perf-02, proposed names first | 21 done; docs/design/ux-review-05.md present |
| `21-honest-metrics-and-layout.md` | Four rollout tiles over enabled users, campaign gate, 1440 container, filter bar, portalled popovers, sorting within groups, step state reasons, hide completed, proposed names, sidebar cleanup | 20 done; docs/design/ux-review-04.md present |
| `33-mvp-guidance-audit.md` | Guidance audit as an identity architect: per-step-family audit sheets (Layer B), omission audit against Microsoft Learn (Layer E), necessity audit for a ten-person business (Layer F), sequence-safety property tests (Layer C), and a Learn citation on every rule and warning | 32 done; docs/design/audit-program.md present |
| `34-trust-surfaces-and-feedback.md` | Permissions disclosure on Connect generated from the collector registry, a feedback channel in the footer, and the GitHub Pages deploy with a custom domain | 33 done |

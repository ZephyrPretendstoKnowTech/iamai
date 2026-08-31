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
| `35-home-page-and-tool-path.md` | getiamai.com becomes a home page for IAMAI as a whole and the planner moves to /rollout/; TOOL_PATH as the single build constant, a static hand-written home page with tool cards from a data file, and the redirect URIs the move needs | 34 done; the site live at getiamai.com |
| `36-foundations-inventory-lint-schema.md` | UI inventory generator, build-failing lint rules, Setup question schema | 35 done; docs/design/review-method.md and docs/qa/review-07-findings.md present |
| `37-truth-and-consistency.md` | One source per number, blocked reasons, rings, schedule bundling and tenant rhythm | 36 done |
| `38-remove-and-rewrite.md` | 22 removals, Start page rewrite, 20 copy fixes | 37 done |
| `39-layout-platform-permissions.md` | Sidebar, Scan order, tabs, light theme, responsive, Application.Read.All decision | 38 done |
| `40-truth-engine-and-schedule.md` | Why 37 did not hold: one derivation for every count, blocked reasons that are true, the ring model reaching the calendar, build stamp and cache | 39 done; the security fixes committed; docs/qa/review-08-findings.md present |
| `41-notice-periods-and-batching.md` | Notice periods by disruption, enforcement batching into change windows, band recomputation | 40 done; build stamp live; docs/qa/review-09-findings.md present |
| `42-windows-readiness-preflight.md` | Per-class observation windows, report-only readiness verdict, operator pre-flight | 41 done; docs/design/observation-and-readiness.md present |
| `43-naming-consolidation-serviceprincipals.md` | Naming explainer and detection, organisation report, safe consolidation, missing service principals | 42 done; docs/design/naming-and-consolidation.md present |
| `44-skips-recovery-drift.md` | Skipping with reasons, unskippable emergency access, printable recovery card, exclusion drift | 43 done |
| `45-demo-mode-and-remaining.md` | Sample-data demo mode, remaining review items, why-this-order | 44 done |
| `46-contracts-and-engine.md` | Contract lint from page-contracts.json, one denominator and one verdict, every step executable from a template, fixed schedule constants, detected assumptions replace Setup, Application.Read.All removed | 45 done; docs/design/target-state.md and docs/qa/page-contracts.json present |
| `47-theme-shell-connect-today.md` | Paper/ink theme from one token file with IBM Plex and a design lint, the header-only shell, Connect (four states), Today and Inventory as contract surfaces, engine refinements from the 46 walk | 46 done (7a50b70) |
| `47.1-signin-and-walk-fixes.md` | Hotfix before 48: the router leaves an MSAL auth response alone, walk fixes on Connect, Today and Inventory, the home page on the tool's tokens, the name IAMAI Planner | 47 done (37a1c61); target-state.md and page-contracts.json updated by the reviewer |
| `48-evidence-plan-step.md` | Evidence for the 22 lockout scenarios (Lane B device, app and location labels; derivations; shared devices; static rules), the Plan and the step as contract surfaces, Setup and Findings deleted | 47.1 done (d9d3213); target-state.md, page-contracts.json and lockout-scenarios.md updated by the reviewer |
| `48.1-populations-evidence-checksteps.md` | What the live Plan showed: one active denominator on every row and step, names and the evidence lines, check-step Do it as numbered actions, presentation fixes (chips, waves, header, redirect) | 48 done (08c73d3); page-contracts.json chip pattern cut to 60 chars by the reviewer |
| `49-export-reference-deletions.md` | The closing prompt: 48.1 walk fixes (guest marker, tickable done-when), Export and How IAMAI works as contract surfaces, the print rebuilt on the tokens, the reference pages and RoadmapPage and src/ui/pages and styles.css deleted, enforceAll flipped | 48.1 done (150880a) |
| `49.1-final-fixes.md` | The final-pass findings and the depth pass: no artifact carries a placeholder, print rebuilt from the Step content functions and mounted only under print, content fixes (manager notes, break-glass clause, portal wording, Recovery, answered chip), Skip and Plan-settings mechanics, two surface depths with a 4.5:1 readability floor | 49 done (4b60855); target-state.md and page-contracts.json updated by the reviewer |

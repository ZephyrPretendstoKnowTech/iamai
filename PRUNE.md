# Prune — measured on `night-1` (1dba390)

## What the repo is carrying

| | Lines / words | Verdict |
|---|---|---|
| `src/graph`, `src/coverage`, `src/validation`, `src/baseline` | 8,500 LOC | Keep. The product. |
| `src/roadmap` | 9,223 LOC (+4,526 test) | Half is the v2 engine nothing renders. |
| `src/copy` | 4,841 LOC | Strings `content.json` replaced; still imported by the engine. |
| `src/ui` | 7,181 LOC | Keep the six surfaces; `Step.tsx` (307) is imported by nothing. |
| `src/mapping` wizard trio + `copy/setup` | ~950 LOC | The Setup wizard was deleted in 46; its question machinery and copy were not. |
| `scripts/` | 3,688 LOC | inventory, lint-mutations, layout-audit, screens, render-review: harness on harness. Keep smoke + walk. |
| `Step` type | 64 fields | 20 read by nothing; ~12 more read only to be emptied on export. |
| Tests | 748 in 103 files, **145 s** | Property tests re-derive 11 fixtures (incl. 25,000-user `huge`) per test. |
| `docs/design` | 50,334 words, 32 files | Keep `target-state.md`, `content.json`. Archive the rest. |
| `docs/prompts` | 40,433 words, 59 files | Archive. |
| `docs/reports` | 25,959 words | Archive. |
| `SPEC.md` + `CLAUDE.md` | 4,754 words | Replace with the 25-line CLAUDE.md. |
| CI | test → lint-mutations → build → smoke → layout-audit | test → build → smoke. |
| `.claude/settings.json` | absent | Every Bash and edit prompts you. |

The hydra is the middle rows: every fact on screen is computed by the v2 engine *and* by
the content layer, so each fix lands on one twin while the other keeps emitting the old value.
Rebuilding on top of the old engine (prompt 46) is how it grew. Deleting the twin is the cure.

## Start over?

No. A restart re-costs the 8,500 lines that work (collectors, coverage, checks, translator)
and re-learns what 116,000 words of docs already learned. The equivalent of a restart, in
hours instead of days, is a `prune` branch that deletes ~40% of the code and 90% of the
docs and keeps the walk green. Same repo, same history, no re-consent.

## Speed (do these before running anything)

1. Drop `.claude/settings.json` (this folder) into the repo: no permission prompts.
   For the prune session itself: `claude --dangerously-skip-permissions` — it is git.
2. Replace `CLAUDE.md` with the one in this folder. Delete `SPEC.md` after moving its §2 table
   into `docs/design/target-state.md` (or just archive it; §2 is history).
3. `git mv docs/prompts docs/reports docs/qa/*.md docs/design/<all but target-state.md,
   content.json> archive/`. Claude Code stops finding and reading them.
4. Tests run once per task, before the push; `npx tsc --noEmit` (seconds) is the only
   check during work. Prompt A also makes that one run ~4× faster.
5. Run A and B in parallel worktrees (`git worktree add ../iamai-a prune-a`); they touch
   different files. Headless: `claude -p "$(cat A.md)" --dangerously-skip-permissions`.
6. No `/effort high` for deletions. No reports. Commit messages only.

## The next 3–4 hours

### A — harness and docs (parallel, ~45 min)

> Branch `prune-a` from `night-1`. (1) `git mv` `docs/prompts`, `docs/reports`,
> `docs/qa/*.md`, `docs/qa/ui-inventory.*`, `docs/qa/content-review.expected.html`, and
> every `docs/design/*` except `target-state.md` and `content.json` into `archive/` and commit it
> as-is (CLAUDE.md tells sessions not to read it).
> (2) Delete `scripts/ui-inventory.mjs`, `lint-mutations.mjs`, `layout-audit.mjs`,
> `screens.mjs`, `render-review.mjs`, their `package.json` scripts, their CI steps, and the
> `src/copy/lint.test.ts` mutation harness; CI = `npm test`, `npm run build:site`,
> `npm run smoke`. (3) Delete `src/ui/surfaces/Step.tsx`. (4) `npm test` becomes
> `node --test --test-isolation=none 'src/**/*.test.ts'`; `src/roadmap/fixtures/run.ts`
> memoises each fixture's derivation per process; the `huge` fixture runs only with
> `HUGE=1`. Target: under 40 s. (5) `npm run walk` drops the 390 pass. Commit per step; `npm test` once at
> the end, then push.

### B — decisions change the plan (parallel, ~60 min)

> Branch `prune-b` from `night-1`. (1) `applyStepDecisions(mapping, stepDecisions)` in
> `src/roadmap/decisions.ts`: emergency → `breakGlassUserIds`; exclusions group →
> `records['__globalExclusion']`; countries → `allowedCountries`; trusted network →
> `trustedLocationIds`; service accounts → `serviceAccountUserIds`; campaign →
> `highCareUserIds`; an option → `questionAnswers[stepId]`. `planData.ts` derives from the
> applied mapping. (2) Rows for the five pickers with no `pickerSource`, from functions that
> exist: `detectEmergencyAccess`, `suggestCountries`, the snapshot's named locations,
> `detectServiceAccounts`, `sharedDeviceUsers`; `groups` from the snapshot's groups;
> `Decision` falls back to the key list at `src/content/render.ts:277`. (3) One test on the
> demo fixture: save two emergency ids → the create instructions are gone; save a group →
> every policy step's exclusions line names it. Missing content keys: add them, say so in
> the commit. Commit per step; `npm test` and
> `npm run walk` once at the end, then push.

### C — delete the twins (after A and B merge, ~90 min)

> Branch `prune-c`. Evidence rule: remove the thing, run `npx tsc --noEmit`; if only its own
> tests break, delete those too. In this order, committing after each: (1) `Step` fields no
> surface reads — `whyAttribution, whyLink, stateReason, impact, safeToday, highCare,
> operatorWhatIf, score, denies, populationBasis, populationNames, populationView, verify,
> ringComms, rollbackBody, scheduledDate, alreadyInPlace, safeVerdict, ladder,
> validationBlocker` — and the v2 prose fields the file already empties (`exitCriteria,
> whatChanges, failureModes, helpDesk, ringComms`, the ring prose). (2) The modules that
> only produced them: `rings.ts` prose, `tracking.ts` prose, `template.ts`,
> `templateCheck.ts`, `ladder.ts`, `watch.ts`, `strand.ts`, `unknowns.ts`, `dangers.ts`,
> `overrun.ts`, `score.ts`, `drift.ts` — keep any function `generate.ts` still needs for a
> rendered fact. (3) `src/mapping/questions.ts`, `questionSchema.ts`, `wizardSuggest.ts`; keep
> the detection functions in `wizard.ts`. (4) `src/copy/*` with a `pages.*`/`shared.*`
> twin: `setup, steps, stepContent, ladder, pages, plan, export, today, how, connect,
> schedule, rings, progress, skip, recovery, naming, product, terms, index, scenarios2`;
> what the engine still imports moves the string into `content.json` or dies with its
> caller. (5) `timing.ts` date labels and `events.enforce.date/day/time`; rows and phases
> read one instant through `absoluteDate` in the display zone. (6) The recurring drill step
> (`DRILL_STEP_ID`); Cleanup has the drill. `npx tsc --noEmit` after each deletion;
> `npm test` and `npm run walk` once at the end, then push.

What is left after C is the product: collectors → snapshot → coverage + checks → steps
(population, status, one reason, dates) → content words → six surfaces → exports. Every
later change is one file and one hour.

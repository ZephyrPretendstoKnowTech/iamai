# 53 — Overnight run

Run at `/effort high` in a fresh session. Expected duration: the whole night. The reviewer is
asleep; you carry both roles — builder and, through the harness in Unit 0, the reviewer's
eyes. Every rule from 51 and 52 holds: you write no product prose; you do not edit
`docs/design/` or `docs/qa/page-contracts.json`; the baseline wins; decisions live in the
step; exclusions go through the group.

## Safety, first and non-negotiable

- **Branch `night-1`, never main.** Main and the live site do not change tonight. Every
  commit goes to `night-1`; the preview deploys to `getiamai.com/next/` (Unit 0). The
  reviewer merges in the morning, or doesn't.
- **No credentials, no sign-in automation.** The real tenant is walked through its saved
  plan file (`fixtures/private/getiamai.plan.json`, gitignored, loaded with "Load a plan
  file"), never through Microsoft sign-in.
- **No prose.** A screen that needs a sentence the content file lacks: log the key in the
  morning report and leave the line unrendered. Never write one, never copy an old one.
- **Stop for nothing.** There is nobody to ask. When you would have asked: decide by the
  FAQ below; if the FAQ is silent, take the reading that changes the least, log the call in
  the morning report with the reason, and continue. If the session dies, the next one resumes
  from the report's "resume plan" without re-scoping.

## Unit 0 — The harness (build this first; everything else uses it)

`npm run walk` renders every surface, for the demo and for the loaded GetIAMAI plan file,
at desktop (1280) and phone (390) widths, headless Chrome:

- captures `innerText` of `<main>` per route and per opened step (every step, one by one),
  plus a screenshot at each width, into `walk/<sha>/…`;
- diffs the text against the contract (allowed headings, summaries, buttons, forbidden
  words, budgets) — the inventory lint's rules, run over every surface and both fixtures;
- checks the invariants the reviewer checked by hand in `docs/reports/walk-51.md`: no
  `{brace}` or empty value in rendered text; no empty section; no "an account IAMAI could not
  name"; one readiness value per kind across rows, steps and Today; one population; rows and
  step bodies share titles; one short date format outside emails; absent goals never render;
  every row's step opens; every Learn link resolves to a 200; nothing overflows the viewport
  at 390;
- writes `docs/reports/walk-<sha>.md` in the same shape as `walk-51.md`, P0 / P1 / P2.

`npm run walk` is the definition of "the reviewer looked at it". Every unit below ends with
it, and a unit is done only when its findings are gone from the next walk.

## Unit 0b — Preview path

The Pages workflow builds `main` to the root and `night-1` to `/next/` in one artifact, on
push to either branch. A test asserts main's build output is byte-identical to before.

## The queue, in order

1. **Whatever remains of `walk-51.md`** (P0s, then P1s), each with the test that would have
   caught it. Emergency access first if it is not already whole.
2. **Whatever remains of 52** (frame, translator dump, deferred items, Start the plan).
3. **The floor** (target-state §13, decided): a "Microsoft recommended, not in this baseline"
   group — registration protection, the legacy-authentication block, emergency access —
   rendered when the active baseline lacks them, from Microsoft's own Conditional Access
   templates, labelled from `content.json` (keys under `pages.plan.footer.recommended*`; if
   absent, log the keys and render the group without a label rather than inventing one).
4. **The demo is the show** (54, brought forward): the demo derives through the same pinned
   baseline and goalMap as the product; fixture contradictions fixed in the fixture
   (Boardroom's method/evidence; anything the walk flags as fixture junk); the week-two
   re-scan recognises the exclusions group and removes its step; the three-minute path —
   Today → Plan → emergency access → Scan to update the plan → week two — renders clean at
   both widths.
5. **Theme**: one stored preference honoured on home, demo and app.
6. **Cleanup phase** rendered with its rows and the finish date including it, if 52 left it.
7. **Print and Export**: page 1 per §7; the calendar and plan-file round-trip tested; every
   export vocabulary-clean.
8. **Performance**: first load of the demo under 2 s on a throttled connection; the plan
   derives in under 200 ms for both fixtures; nothing re-derives on scroll.
9. **P2s from every walk report** of the night, in order of appearance.

If the queue empties: re-run the walk, fix anything new, then stop and write the report.

## FAQ — answered in advance

- *A content key I need is missing.* Log it; render nothing for that line.
- *The goalMap and coverage disagree about a step.* The goalMap decides what renders; coverage
  decides in-place. Log the disagreement.
- *A test assertion encodes the old behaviour.* Change it; record old/new/reason in the
  report. Never weaken a test to pass.
- *The contract forbids something the content file contains.* The contract is the maximum:
  do not render it; log it for the reviewer.
- *Two dates disagree.* One instant, computed once, formatted twice (short everywhere, long
  inside emails). The short form wins on screen.
- *A variable the scan cannot produce.* Suppress the line. Never gate a variable the scan can
  produce — derive it.
- *The demo and the product differ.* The product is right; the demo follows.
- *Something would take longer than an hour with no test to prove it.* Skip it, log it, next.
- *Anything about wording, layout aesthetics, or the target state.* Not tonight; log it.

## Morning report — `docs/reports/night-1.md`

Written at the end (and updated at every unit boundary, so a dead session leaves it current):

1. What is on `/next/` — one line per unit done.
2. The last walk report's remaining findings, if any.
3. Every judgment call, one line with the reason.
4. Every test assertion changed: old, new, reason.
5. Content keys the reviewer must write (path, where it renders, why it was needed).
6. Questions for the reviewer that the FAQ did not cover.
7. The resume plan, if anything is unfinished.

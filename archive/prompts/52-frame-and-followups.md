# 52 — The frame from the content file, and 51's follow-ups

Run at `/effort high` in a fresh session. Same rules as 51: you write no product prose; every
sentence comes from `docs/design/content.json` (now v1.3); you do not edit `docs/design/` or
`docs/qa/page-contracts.json`; anything you cannot build as written goes in
`docs/reports/52.md` with the case, and you continue. Stop only for: a factually wrong render,
a forbidden-file edit, or contradictory instructions. No Chrome walk. Commit per part locally,
push when Part 6 is green.

Read first: `docs/design/target-state.md` §2, §3, §4, §5, §7, §8.9, §9, §14; the contract
(`connect.signedOut` is now `built` and will be red until Part 1 lands); `content.json`
`$comment`, `pages.*`, and one step. Do not read the audit or the feedback log.

## Part 1 — The frame, from `pages.*`

- **Home page** (`home/`): generated at build time from `pages.home` — meta title and
  description, h1, intro, the Planner card (name, descriptor, `Preview` chip, body, `Open the
  planner`, `See it with sample data`), the two trust bullets, About with its three links, the
  footer line and three links. No string in `home/` that is not in the file.
- **Opener** (`connect.signedOut`, §3): h1, intro, Built for, What it catches, `Sign in with
  Microsoft`, the permissions `<details>`, the two links, then the raised open-by-default
  `IAMAI limitations` panel (intro line + five items) below the links and above the tip.
- **Connect, signed in**: the baseline lines `baselineWhat` (author, Microsoft MVP,
  ConditionalAccess.Tech as a link), `baselineGoal`, `baselineHow`; the `baselineUpdated` line
  and its `review` rows, rendered only when the author's head differs from the pin (51
  deferred this; build it now).
- **Connect, scanned**: `scanLine` + `Open the plan →` + the tip. The found list is gone.
- **Today**: `purpose` line under the h1.
- **How**: the `noAi` line under Limits.
- **Footer** everywhere: `Read-only` + the three links, dot-separated.
- Delete the generators these replace. Contract lint green for every surface it touches.

## Part 2 — The translator dump

`npm run translator-dump` writes `docs/design/translator-output.json`: `{ stepId: { steps: [portal
lines] } }` for every mapped policy step, from the pinned goalMap through `portalLines.ts`,
with the review page's example values (tenant GetIAMAI, the example groups and names in each
step's `example` block). `render-review.py` already consumes it. Policy steps' `whatToDo` in
the content file has been renamed `whatToDoReference` and is never read by the product; add a
test that no product renderer references it.

## Part 3 — 51's deferred items

From `docs/reports/51.md`: decision persistence (every picker's `Save` writes to the plan file
and re-derives; a plan-file round-trip preserves every decision); the second-pass list
derivations (every variable the report listed as undefined that the scan's existing reads can
produce — registered FIDO2 models and AAGUIDs, legacy/portal/device-code users, sync
addresses, partner tenants, method states — derived, not gated); the Cleanup phase rendered
with its five rows and the finish date including it; the licence ladder as `Not licensed`
rows per §5.

## Part 4 — Report wording

In the baseline report and `docs/reports/51.md`, a policy under the author's `Test/` folder is
"in the author's Test folder", never "removed at head" (`IAC - APP - SESSION - O365 -
Timeoutsettings` is the case in hand).

## Part 5 — `Start the plan` (last; drop if the session runs short)

Per target-state §5 and §9: until pressed, dates are proposals recomputed from today and the
header carries `startNote`; pressing writes the start date to the plan file, the header's line
one becomes `line1Started`, and later scans update statuses and evidence but never move an
anchored date. Changing the start afterwards is Plan settings. Contract already allows the
button.

## Part 6 — Gauntlet

`npm test`, `npm run smoke`, `npm run inventory` green; push; `docs/reports/52.md` with every
judgment call and every changed assertion (old/new/reason).

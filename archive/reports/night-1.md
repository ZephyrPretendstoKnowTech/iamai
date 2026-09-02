# Night-1 — morning report (prompt 53)

Branch `night-1`, never main. Every unit below ended with `npm run walk`; a unit is done only
when its findings are gone from the next walk. Updated at every unit boundary.

## 1. What is on `/next/`

- **Unit 0 — the harness.** `npm run walk` (`scripts/walk.mjs`): renders every surface of the demo
  at 1280 and 390 in headless Chrome, opens every plan row one by one (and its More), captures
  `innerText` of `<main>` and a screenshot per route and per step into `walk/<sha>/…`
  (gitignored), diffs each capture against `docs/qa/page-contracts.json` (allow lists, forbid
  lists, forbid-everywhere, page and row budgets, title and sentence lengths, the repeater rule
  from the contract's own comment), checks the walk-51 invariants (no `{brace}` or empty value;
  no empty section or empty list; no "an account IAMAI could not name"; one readiness per kind
  across rows, steps and Today; one active-people count; row and body share the title; one
  short date format outside emails; absent goals never render, on rows and in the footer; every
  row opens; every Learn link resolves; nothing overflows at 390; no console error), scans the
  private GetIAMAI plan file offline (see §6), and writes `docs/reports/walk-<sha>.md` in
  walk-51's shape. Exit 1 while a P0 remains.
- **Unit 0b — the preview path.** `deploy-pages.yml` runs on a push to `main` or `night-1`,
  builds `main` to the root and `night-1` (when the branch exists) to `/next/` — the preview's
  home at `getiamai.com/next/`, its planner at `getiamai.com/next/rollout/` — in one artifact,
  and a step diffs every root file's hash against the main-only build before the preview is laid
  beside it, so a night-1 push cannot change the live site. Verified locally: a build with
  `TOOL_PATH=next/rollout` lays the planner at `dist/next/rollout/` with base `/next/rollout/`
  and the home page's links under it.
- **Unit 1 — the walk-51 leftovers, and what the first walk found** (test:
  `src/ui/surfaces/night1.test.ts`; the walk covers the rendering):
  - item 12: `Learn →` and the CIS chip are separated (the walk read "Learn →CIS 4.3" on 13 steps).
  - item 5 leftover: the plan row's date came from the event's own local label ("9 Sept 2026")
    beside the short form; it now goes through `absoluteDate`.
  - item 2 leftovers, holes the first walk found: the Dates line rendered "Announce · Report-only
    from · Enforce" because `{datesNew}` is a shared reference whose own variables `missingVars`
    never checked — a shared reference now carries its string's holes; a policy already in
    report-only takes its Report-only date from the scan (`tracking.reportOnlyAt`); the decision
    help renders as a line (a hole drops it — the countries help read "sign-ins since."); the
    manager note's `{wanted}` fills from the baseline policy's sign-in frequency in words
    (`sessionWantedForGoal`: "4 hours"), and More's help-desk and manager lines drop on a hole.
  - §8.7: a `Who this touches` lead that ends in a colon renders only when something follows it
    (the countries step promised "who signs in from each:" over nothing); the heading renders only
    over content; `What to do` renders only with content (the shared-devices step showed an empty
    section — see §5); More never renders an empty "What could go wrong" list (when nothing
    applies, the rest stand under the heading).
  - §6.3/§6.5: a who-line that carries a list of names renders the names as a list, one per row,
    never inline (the dormant accounts read "A · date, B · date, C · date" in one paragraph).
  - the dormant accounts derive: `accountsWithState` (name · last sign-in date, or the content
    example's "no sign-in on record") from `notActiveUsers`, and a check step's `{n}` counts the
    accounts it checks (none of them are active, so the lead read "0 enabled accounts").
  - the Plan footer no longer lists not-assessed baseline policies (they are Cleanup rows, §5) or
    baseline-package problems (How IAMAI works has them) — both carried strings the
    `plan.footer` contract forbids ("not assessed", "re-export", "SDK", "Graph REST").
  - `Back to top` is removed: no contract allows the control on any surface and the inventory
    never saw it (it appears only after a screen of scrolling, which the captures never do).
  - walk-51 item 10: Today's Show list is `pages.today.show` (All, the six states the table
    uses, Admins, Guests), keyed by position to its filter; the four tiles render from
    `pages.today.tiles` — the value ("{n} · {pct} of active"), the label, the "held by …" line
    naming the step that moves the number, and the definition as the tip.
  - walk-51 item 11: the Boardroom room in the demo fixture has Authenticator approval and
    nothing stronger, so its method and its evidence agree (the fixture had given it a passkey).

- **Unit 3 — the floor** (target-state §13, decided Sep 1; test: `src/roadmap/floor.test.ts`).
  `src/roadmap/floor.ts` names the set: registration protection and the legacy-authentication
  block (emergency access is the Preparation check on every plan). A floor goal the active
  baseline lacks renders anyway, flagged `floor`, from the catalogue template — Microsoft's own
  template for the control ("Securing security info registration"; "Block legacy
  authentication") — resolved with the tenant's objects and rendered through the same portal-line
  translator as a baseline policy (`stepPortalLinesFromBody`); exclusions read as the exclusions
  group, never an account by name. The Plan renders floor rows in their own group after the
  numbered phases, before Cleanup; the group's label is `pages.plan.footer.recommended*`, which
  content.json does not carry, so the group renders unlabelled (§5). A goal the baseline holds is
  never the floor. On the pinned baseline this adds one row, Require MFA to register security
  info; the engine no longer falls back to a signature match for a goal the map does not hold
  when the map describes the loaded package — that fallback had picked the risky-users block the
  owner ruled out.

- **Unit 4 — the demo is the show.** The walk now runs the three-minute path's last stop: after
  day one it presses the header's Scan to update the plan, waits for the week-two banner, and
  walks the plan and Today again at both widths, checking that the exclusions-group step is gone.
  That found two product faults, both fixed: (1) the plan hook computed the new snapshot with the
  previous mapping for a render (the load is asynchronous), so the old exclusions step flashed on
  week two — the plan now computes only from a mapping and group members loaded for the snapshot
  on screen; (2) the plan loaded members only for the groups the tenant's policies reference, so
  the mapping's own exclusions group (created by the plan, not yet excluded by a policy) had no
  members and the checks engine kept a "Create or Correct Exclusions Group" step for a group
  already right — the plan now loads the mapping's exclusions and service-accounts groups too. A
  quick second Re-scan could also let an earlier demo load land last (day one's plan under week
  two's banner); the demo effect now discards stale loads. Fixture junk: none new beyond the
  Boardroom room (Unit 1).
- **Unit 7 — print and export** (test: `src/exportsClean.test.ts`). Every export speaks from
  the content-driven step (`src/ui/surfaces/stepExport.ts`: the content title, why, the
  translator's What to do, the done-when lines, the dates, if-it-goes-wrong): the calendar
  entry's description, the prompt pack's step text, the grounding bundle's steps (data beside the
  content lines; the engine's finding statements stay out) and the plan file, whose saved steps
  keep every number, date, status and policy body and have the v2 prose fields emptied
  (`fileStep`); a step without a content entry (a free-tier ladder rung) exports its title and
  nothing of the engine's prose, as the screen shows nothing for it. The print renders every
  step through the same `ContentStep` the screen uses, with More open, and prints the Cleanup
  phase's rows; page 1 is per §7 (in place / to do / doesn't apply, and the Not-licensed count and
  sentence). The plan-file round trip is tested in `stepDecisions.test.ts` and `startPlan.test.ts`
  (decisions) and `plan.test.ts` (steps, answers, checkpoints); the calendar in `exports.test.ts`
  and `exportsClean.test.ts`. The smoke's print check now holds the print to the `plan.step`
  forbid list (More's own headings allowed) as well as forbid-everywhere.
- **Unit 8 — performance.** The plan derives under 200 ms for every fixture, demo and GetIAMAI
  included — asserted per fixture by `properties.test.ts` (best of three, 500 ms for huge). The
  walk now measures the demo's first load on a "Fast 3G" profile (1.6 Mbit/s, 150 ms) against the
  production bundle served statically with gzip, from navigation to the first plan row: **2.7 s**
  against the 2 s target (P1, §2). The sign-in library (61 kB gzipped) and the Export, How and
  Inventory surfaces now load on demand (`src/graph/auth.ts`, `React.lazy`), which took the first
  chunk from 363 kB to 98 kB gzipped; the remaining 161 kB gzipped chunk is the engine, the
  content file, the pinned baseline and the goal catalogue, all needed for any plan. Nothing
  re-derives on scroll: the plan is a memo over the snapshot, mapping, groups and decisions, and
  the page has no scroll listener (Back to top was removed). See §6 for the levers left.

## 2. The last walk's remaining findings

`docs/reports/walk-0888887.md` (the final walk, at the last pushed build): **0 P0**, 3 P1, 37 P2
(the P2s doubled because the walk now covers week two as well as day one). Earlier walks of the
night are `walk-f3d140b.md` (the first, 166 P0), `walk-7199f2e.md`, `walk-b660c21.md` and
`walk-e817e2b.md`.

- P1: the demo's first load on a throttled connection is 2.7 s to the first plan row (Unit 8).

- P1: two Learn links in `content.json` answer 404 —
  `https://learn.microsoft.com/entra/identity/users/users-inactive` (the problematic-accounts
  step) and `https://learn.microsoft.com/entra/identity/conditional-access/policy-admin-phishing-resistant-mfa`
  (the admins phishing-resistant step). Content, not editable here.
- P2 (contract questions, see §6): the copy box and the decision are contract repeaters, so an
  email body and a picker's people rows are measured as rows against the 2-sentence / 30-word
  row budget on eight steps (day one and week two).
- P2 (the private plan file): three saved steps for goals the baseline does not hold (the file
  predates item 9; the next save drops them); the saved steps' v2 fields (rings, exit criteria,
  what-changes, failure modes, help desk, comms) carry old vocabulary that no v3 surface renders
  — the export unit decides what the file keeps.

## 3. Judgment calls

- The walk's forbid checks run over a surface's own text with code panels removed, exactly as the
  inventory does; an API path's `/{id}` on How IAMAI works is a literal, not a hole.
- A lead's trailing colon is content (its list or none-branch follows); the empty-value shapes
  the walk flags are a doubled or trailing separator, "from ·", empty brackets, a doubled comma.
- A readiness value is a "now" ("device readiness 30%", "(now 30%)"); the threshold a line names
  ("reaches 80%", "waits for 90%") is not one. The demo reads one value per kind.
- The plan-file scan checks only the fields a v3 surface renders from a saved step (title, gap,
  blocked reason, existing coverage, the proposed name); everything else in the blob is the v2
  engine's prose and is reported once, under P2.
- `Back to top` was removed rather than kept: the contract is the maximum and lists it nowhere.
- The dormant account's state uses the content example's own words ("no sign-in on record") for
  the never-signed-in branch and the plain short date for the other; no new prose.
- The in-app GetIAMAI walk is not possible tonight (§6); the demo is walked in full and the plan
  file is scanned offline.
- The first-load figure through the dev server (hundreds of unbundled modules at 150 ms each,
  no plan within 30 s) says nothing about a visitor and was discarded; the measurement builds the
  production bundle and serves it statically with gzip, as GitHub Pages does.
- The four preloaded font faces (about 90 kB) share the throttled link with the first chunk;
  changing font loading changes the first paint, which is a design call (§6), so they stay.
- The Units 4/7/8 push failed CI once in the smoke: on the runner the demo's plan was a chunk
  away when the smoke read `main.page` (the surfaces load on demand since Unit 8) and it read
  null; the smoke now waits for the plan's rows first. Green on the next push.
- The first night-1 push failed CI twice for reasons outside the product: the `github-pages`
  environment's branch policy allowed only `main`, so the preview deploy was refused — `night-1`
  was added to the policy (Settings → Environments → github-pages; reversible); and the runner's
  Chrome took longer than the smoke's 20-second wait for a page target — every harness now waits
  60 s and fails with a plain message instead of a TypeError.

## 4. Test assertions changed

- `scripts/smoke.mjs` "Unlicensed tenant: nobody is Proven without records" — old: the whole
  Today page text carries no "Proven"; new: no table state chip reads "Proven". Reason: the Show
  list now carries the content file's state names, "Proven" among them; the assertion's subject
  (no person proven without records) is unchanged.

- `src/roadmap/absentGoals.test.ts` "no fixture renders a goal the pinned goal map does not
  hold" — old: no step for any unmapped goal, registration protection among the five named; new:
  an unmapped goal renders only as the floor, flagged, and registration protection leaves the
  never-renders list. "an explicit goal map narrows the plan" — old: two goal steps; new: the two
  plus the floor's registration step, flagged. Reason: the floor (target-state §13).
- `src/roadmap/scenarioLines.test.ts` — old: `noMethodRemote` must fire on no fixture and only
  with a map holding registration; new: it fires on the fixtures again and is back in the demo
  list. Reason: the floor renders its host step.
- `src/roadmap/template.test.ts` item 12 — old: every create step is a goal the pinned map holds;
  new: or a floor goal, flagged. Reason: the floor.

- `src/roadmap/tracking.test.ts` "a v1 file loads as an equivalent v2 plan" — old: a loaded v1
  step's what-changes line is non-empty; new: the field exists (a string). Reason: the plan file
  no longer carries the v2 prose (Unit 7), so an upgrade has nothing to restore into it.
- `src/roadmap/fixtures/properties.test.ts` "the plan file round-trips with every number
  preserved" — old: the rings deep-equal; new: the rings' dates and member counts equal. Reason:
  the ring criteria prose does not travel (Unit 7); the numbers do.
- `src/roadmap/fixtures/properties.test.ts` "owner travels with the plan file" — old: the moved
  step's rings deep-equal; new: their dates equal. Reason: as above.
- `scripts/smoke.mjs` "the print document carries no forbidden placeholder" — new: the print is
  also held to the `plan.step` forbid list, minus More's own headings. Reason: Unit 7.

Added: `src/ui/surfaces/night1.test.ts` (shared-reference holes, the report-only date from the
scan, `{wanted}` in words, the dormant accounts list and count, the Show list's order, the
Boardroom room's consistency), `src/roadmap/floor.test.ts`, `src/exportsClean.test.ts`. The
inventory was regenerated after each UI change (fingerprint only; no rule waived).

## 5. Content keys the reviewer must write

- `steps[s-shared-devices].whatToDo` — the step renders no What to do: the pinned baseline holds
  no shared-devices policy, so the translator has nothing, and the step carries only
  `whatToDoReference`. Renders under the step's What to do heading once written (or once the
  floor supplies a policy).
- `steps[s-check-dormant-accounts].learn.url` and `steps[admins-phishing-resistant].learn.url`
  answer 404 (§2).
- `pages.plan.footer.recommended*` — the floor group's label ("Microsoft recommended, not in this
  baseline") and, if wanted, a line under it. Renders as the group's heading on the Plan once
  written; until then the group is unlabelled. Note the `plan` contract's headings allow only
  Plan, Preparation, Phase N and Cleanup, so the heading also needs a contract entry.

## 6. Questions for the reviewer

- **GetIAMAI cannot be walked in the app from the plan file.** `fixtures/private/getiamai.plan.json`
  carries the plan's steps, decisions, mappings and checkpoints and no tenant snapshot; the app
  regenerates every plan from the snapshot and refuses a plan file for another tenant, so
  without a sign-in (or a saved snapshot record) nothing renders. The walk scans the file's
  saved steps offline instead. If a redacted snapshot export is acceptable, the harness can walk
  it exactly like the demo.
- **Row budgets on the copy box and the decision.** The contract lists `.copy-box` and
  `.decision` as repeaters with the default 2 / 30 row budget; an email body and a picker with
  five people cannot fit. Either a `rowBudget` on `plan.step`, or those two selectors are not
  rows.
- **`Back to top`** — removed tonight; if it is wanted, the shell contract needs it.
- **The 2 s first load.** At 2.7 s on Fast 3G the levers left are design or content calls: the
  four preloaded font faces (~90 kB on the same link), the content file in the first chunk
  (~35 kB gzipped; splitting it per surface changes how it is loaded), and the goal catalogue's
  descriptions (~10 kB gzipped). None is taken tonight.
- **Cleanup rows in the exports.** The calendar, the prompt pack and the bundle export steps; the
  Cleanup rows are not steps and are not exported (they print). Whether a Cleanup row should be a
  calendar entry is open.

## 7. Resume plan

`night-1` is at the commit that carries this report; `ci` and `deploy-pages` are green on it and
the preview is at `getiamai.com/next/rollout/` (`/next/` for its home page). Main is untouched.

Queue, in order: (1) done; (2) nothing of 52 remains; (3) the floor — done; (4) the demo is the
show — done; (5) theme — done in 52; (6) Cleanup — done in 52; (7) print and export — done; (8)
performance — measured, the 2 s target is a design call (§6); (9) P2s — every P2 in the last walk
is a contract question or the private plan file's age (§2), none fixable here. The queue is empty;
the last walk is clean of P0.

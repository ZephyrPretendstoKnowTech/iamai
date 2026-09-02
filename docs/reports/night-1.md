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

## 2. The last walk's remaining findings

`docs/reports/walk-<sha>.md` for the latest sha: **0 P0**, 2 P1, 20 P2.

- P1: two Learn links in `content.json` answer 404 —
  `https://learn.microsoft.com/entra/identity/users/users-inactive` (the problematic-accounts
  step) and `https://learn.microsoft.com/entra/identity/conditional-access/policy-admin-phishing-resistant-mfa`
  (the admins phishing-resistant step). Content, not editable here.
- P2 (contract questions, see §6): the copy box and the decision are contract repeaters, so an
  email body and a picker's people rows are measured as rows against the 2-sentence / 30-word
  row budget on eight steps.
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

Added: `src/ui/surfaces/night1.test.ts` (shared-reference holes, the report-only date from the
scan, `{wanted}` in words, the dormant accounts list and count, the Show list's order, the
Boardroom room's consistency). The inventory was regenerated after each UI change (fingerprint
only; no rule waived).

## 5. Content keys the reviewer must write

- `steps[s-shared-devices].whatToDo` — the step renders no What to do: the pinned baseline holds
  no shared-devices policy, so the translator has nothing, and the step carries only
  `whatToDoReference`. Renders under the step's What to do heading once written (or once the
  floor supplies a policy).
- `steps[s-check-dormant-accounts].learn.url` and `steps[admins-phishing-resistant].learn.url`
  answer 404 (§2).

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

## 7. Resume plan

Queue, in order: (1) done — walk-51 has no open item; (2) nothing of 52 remains; (3) the floor; (4) the demo is the show; (5)
theme — done in 52; (6) Cleanup — done in 52; (7) print and export; (8) performance; (9) P2s.

# 49 — Walk fixes, Export, reference, deletions, and the contract closes

Precondition: 48.1 committed and green (150880a). Read `docs/design/target-state.md` and
`docs/qa/page-contracts.json` in full before starting. Neither is yours to edit, with the
same exception: in Part 6 you flip `status` to `built` on `export`, `recovery` and `how`,
and flip `enforceAll` to `true`. Nothing else in that file.

This is the closing prompt of the rebuild. When it is done, every surface the product
renders has a contract, every legacy page and stylesheet is gone, and an inventory
surface without a contract fails the build.

## Rules for this prompt

- Every part ends green and is its own commit.
- Move working exporters (ICS, plan file, CSVs, prompt pack, grounding bundle); do not
  rewrite them. The print layout is the one rebuild.
- Report by part, with measured counts for the three new surfaces, the contrast minima
  in both modes, and the print's first page rendered to text.

## Part 1 — The 48.1 walk leftovers

1. Names: when two people share a display name, the guest carries a `(guest)` marker —
   `Lachlan Robinette (guest)` — everywhere a name renders (rows, steps, exports).
   Fixture: the getiamai fixture already has the colliding pair; assert the marker.
2. The campaign step's what-changes line uses the step's own count ("1 person proves…"),
   not the tenant-wide unproven count.
3. The emergency-access create action includes registering a sign-in method: "…assign
   Global Administrator permanently, then register a passkey or FIDO2 key and record
   where its credential is kept."
4. Gap suffixes count active people: `covers 1 of 4 active`, never `of 13 people`. The
   agreement test covers the suffix.
5. The two recorded-by-hand facts (where the credential is kept; a sign-in alert exists)
   are tickable Done-when lines on the emergency-access step, stored in the plan file,
   read back by the checks. Ticking is the only manual state in the product; it renders
   nowhere else.
6. Wave names come from the wave's families; two tied families name both (`Sessions and
   risk`); "Advanced" is not a name.

## Part 2 — Export (target-state §7)

7. `src/ui/surfaces/Export.tsx` at `#/export`; the header's `Export` tab appears. Six
   `.export-card` rows, each a title, one line, one button:
   - `Print or save as PDF` — opens the print layout (item 8).
   - `Calendar` — `Download calendar (ICS)`; the existing generator, reading
     `planFinish` and the rings.
   - `Plan file` — `Save plan file` and `Load a plan file`; plan file v2 unchanged,
     round-trip test kept, now including the ticked Done-when lines.
   - `CSV` — `Today as CSV` plus the inventory tables (`<Tab> as CSV`).
   - `Prompts for your own assistant` — `Download every prompt`; `See the prompts`
     expands the list with `Copy prompt` per prompt.
   - `Grounding bundle` — `Download the bundle`; redacted by default; the unredacted
     checkbox with its one-line warning.
8. The print layout, rebuilt on the tokens, light forced: page 1 is the posture summary
   an MSP hands a client — tenant, scan date, baseline, in place / to do / doesn't
   apply with the goal names, the plan's one-line header; then the waves as the Plan
   shows them; then every step in full, first-open content plus More. No screen chrome.
   `document.title` set so the saved PDF is named `IAMAI Planner — <tenant> — <date>`.

## Part 3 — How IAMAI works, and the Recovery card

9. `src/ui/surfaces/How.tsx` at `#/how`: `Permissions` (the Connect table, one source),
   `What IAMAI reads` (the endpoint tables), `Every check` (the 51 rows, once),
   `Baseline packages` (the how-to, anchor `#package`), `Limits` (SPEC §5, five lines).
   Connect's two links point at `#/how` and `#/how#package`.
10. `src/ui/surfaces/Recovery.tsx` at `#/recovery`: the current content unchanged, on
    the new chrome, `Print this card`.
11. Redirects: `#/checks`, `#/reads`, `#/licensing`, `#/naming`, `#/package` → `#/how`
    (anchored where one exists). Delete the four reference pages and the Licensing
    guide's copy.

## Part 4 — Deletions

12. Delete `RoadmapPage.tsx` and every generator, component and copy module only it
    used — the journey band, planned-against-actual, History, Do this next, the tiles,
    the legend remnants, `POPULATION.andUnnamed`, `UNNAMED`'s last consumer. `#/roadmap`
    and `#/roadmap/step/<id>` redirect to `#/plan` and `#/plan/<id>`.
13. Delete `src/ui/pages/` entirely, `styles.css`, and the v2 component set 47 replaced.
    The design lint's legacy allow-list is empty; the test that asserts it empties when
    `enforceAll` is true now bites.
14. `npm run inventory` drops the legacy hard-coded walk; the contract file is the only
    walk list.
15. Docs: `docs/design/comms-and-bridges.md` loses the 5% revert-threshold text (the
    constant is fixed, not a setting); README's flow paragraph and screenshots list the
    three surfaces; grep the repo for `#/start`, `#/scan`, `#/mapping`, `#/coverage`,
    `#/roadmap`, `Setup`, `Findings` as user-facing words and fix what remains.

## Part 5 — Smoke, end to end

16. The smoke walks the whole product on the mock tenant: Connect (signed out →
    permissions open → mock sign-in → scan) → Plan (header line, next mark, open two
    steps, tick a Done-when line, edit an assumption, footer details) → Today →
    Inventory (one tab, one CSV) → Export (each button produces bytes; the plan file
    round-trips with the tick) → How → Recovery → print layout renders. Old-route
    redirects asserted.

## Part 6 — The contract closes

17. Flip `status: built` on `export`, `recovery`, `how`; flip `enforceAll: true`. From
    this commit, an inventory surface without a contract fails the build, and the
    legacy-allow-list test enforces an empty list.
18. `npm run inventory`; rule 12 green everywhere; `docs/qa/ui-inventory.md` final
    counts. `layout-audit` both modes, five widths.

## Finishing

`npm test && npm run smoke && npm run lint-mutations && npm run inventory && npm run
layout-audit`, `vite build`, commit by part, push, confirm CI green and the build stamp.
Report by part: the three surfaces' measured counts against budget, the contrast minima,
the print page 1 as text, the list of files deleted in Part 4, and anything you could
not do with why. The reviewer then walks the whole product against GetIAMAI, target-state
§12, before anything else happens; 50 (the demo rebuilt from the finished product) is
the only prompt after this.

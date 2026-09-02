# 47 — Theme, shell, Connect and Today

Precondition: 46 committed and green (7a50b70). Read `docs/design/target-state.md` and
`docs/qa/page-contracts.json` in full before starting. Both are unchanged and still not
yours to edit, with one exception granted here: in Part 6 you flip `status` from
`planned` to `built` on exactly the surfaces this prompt builds, and touch nothing else
in that file.

This prompt builds the first user-facing pages of the target state, on a new theme. The
old pages (Setup, Findings, Roadmap, the reference pages) keep working inside the new
shell under their old routes until 48 and 49 replace them; do not restyle them, do not
fix their copy. They are on borrowed time.

## Rules for this prompt

- Every part ends green and is its own commit.
- New pages are built from `src/copy` strings and the contract's exact labels. Copy
  follows the writing standard in CLAUDE.md: plain, short, no first person, no ids.
  Where target-state gives the exact line, use it.
- No new copy generator may emit a sentence the contract does not budget for. If a
  budget is short, finish, then report the measured count.
- Report by part, as for 46, plus the measured counts per built surface against its
  budget, and the contrast results from Part 1.

## Part 1 — Theme: tokens, type, primitives, design lint

The current theme is navy, neon teal, bordered cards, coloured numbers and pill chips.
It reads as a generic admin dashboard, which is the wrong signal from a tool asking for
consent to a production tenant. The product is a document people read, print and
execute from. The theme is a typographic, paper-like instrument in light mode and an
ink-on-charcoal instrument in dark mode, from one token file.

1. `src/ui/tokens.ts` (source of truth) and `src/ui/tokens.css` (generated or mirrored
   as today) are rewritten. Light is the default; dark via `[data-theme='dark']`;
   `prefers-color-scheme` decides the first visit; the header toggle persists the
   choice; print always uses light.

   Light — paper
   - `--bg` #FBF9F5 · `--bg-raised` #F4F1EA (an open step, tooltips, menus) ·
     `--bg-inset` #EDE9E0 (code, inputs)
   - `--ink` #1B1B1B · `--ink-2` #55554F · `--ink-3` #767670
   - `--rule` #E3DFD6 · `--rule-strong` #C9C4B8
   - `--accent` #0B5B57 · `--on-accent` #FBF9F5
   - `--ok` #2F6B4F · `--wait` #8A5A0B · `--stop` #9B2C2C · `--idle` #8A8A83

   Dark — ink on charcoal (neutral, never navy)
   - `--bg` #15171A · `--bg-raised` #1D2024 · `--bg-inset` #24282D
   - `--ink` #ECEAE4 · `--ink-2` #A7A59D · `--ink-3` #7A7871
   - `--rule` #2C3036 · `--rule-strong` #3D4249
   - `--accent` #5FB8B0 · `--on-accent` #0F1214
   - `--ok` #7BC9A0 · `--wait` #E0B25C · `--stop` #E28B8B · `--idle` #7A7871

   No other colours exist. No gradients, shadows, glows, blur, or opacity on text.
   The focus ring is `0 0 0 2px var(--accent)` and is the only box-shadow.
2. Type. Three families, self-hosted under `public/fonts` as Latin-subset woff2 with
   `font-display: swap`, preloaded in `index.html`: IBM Plex Serif (400, 500), IBM Plex
   Sans (400, 500), IBM Plex Mono (400). All OFL; keep the licence file beside them.
   Remove Space Grotesk. Scale: `--t-1` 12px (meta) · `--t-2` 13px (small) · `--t-3`
   14px (body) · `--t-4` 16px (h3) · `--t-5` 20px (h2) · `--t-6` 26px (h1). Serif for
   h1, h2 and wave headers at weight 400; sans for everything else; mono for policy
   names, portal paths, code and JSON. Two weights only, 400 and 500. Body line-height
   1.5, headings 1.25. Numbers everywhere use `font-variant-numeric: tabular-nums`.
   Prose measures at most 72ch; tables run full width to 1040px; the page column is
   760px with 24px padding.
3. Primitives, in `src/ui/app.css` (new; `styles.css` stays for the legacy pages until
   49) and in `src/ui/components/` as small components replacing the v2 set:
   - Button: primary (filled accent, `--on-accent`, 32px, radius 4px, weight 500) — at
     most one per view; secondary (accent text, underline); tertiary (`--ink-2` text).
   - Link: accent, underline, `text-underline-offset: 2px`.
   - Input and select: 32px, `--bg-inset`, hairline border, radius 4px.
   - Status: a 7px dot in the status colour followed by the word, `--ink-2`. The only
     place `--ok`, `--wait`, `--stop`, `--idle` may be used. No pills, no chips.
   - Table: hairline rows, header `--t-1` weight 500 `--ink-2`, tabular figures.
   - Details: caret plus summary text in `--ink`; content indents 0.
   - Info tip: a 14px outlined "i" in `--ink-3`; the tip on hover or focus in
     `--bg-raised` with a hairline; text ≤25 words.
   - Tabs: text with a 1.5px accent underline on the active one; no boxes.
   - Rows and sections separate by `--rule`; no bordered boxes; radius on anything
     other than a control is 0.
   - Motion: 120ms opacity on tooltips and menus, nothing else.
   - Print: header, navigation and buttons hidden; same tokens, light forced; the
     ring mark stays as the only decoration, recoloured to `--accent`.
4. Design lint, `src/ui/design-lint.test.ts`, scanning `src/ui/tokens.css`,
   `src/ui/app.css` and every `.css` and inline `style` under `src/ui/shell` and
   `src/ui/surfaces` (new pages live in `src/ui/surfaces/`):
   - no colour literal outside `tokens.css`;
   - no `box-shadow` except the focus ring token; no gradient, `filter`, `text-shadow`,
     or `opacity` on text;
   - `border-radius` at most 4px except 50% on `.status::before`;
   - `font-family` only via the three `--font-*` variables; `font-weight` only 400 or
     500; `font-size` only via `--t-*`;
   - `--ok`, `--wait`, `--stop`, `--idle` only inside a `.status` rule.
   `styles.css` and `src/ui/pages/**` are on a legacy allow-list the lint reads; a test
   asserts that list is empty once the contract's `enforceAll` is true (49 flips it).
   `scripts/lint-mutations.mjs` proves each of the five checks fails on an injected
   violation.
5. `npm run layout-audit` runs in both modes and passes AA contrast on every built
   surface at its five widths. Report the lowest ratio found per mode.

## Part 2 — Engine refinements from the 46 walk

6. `nobodyAffected` (`src/roadmap/timing.ts`) uses sign-in evidence for block and
   location families only; every other family counts everyone in scope. Extend the
   evidence rule to the risk family: with zero risky or medium-risk sign-ins in the
   records, a risk policy affects nobody. On GetIAMAI this folds the "Advanced" wave
   into Wave 2. Property test on the small and getiamai fixtures: no wave exists whose
   only occupants are zero-class steps.
7. The finish date. `src/derive` gains `planFinish`: the last enforcement date among
   steps not blocked by a readiness threshold, plus the count of steps that are, with
   the threshold that holds them. The header line in 48 renders it as "finishes Sep 20 ·
   3 device steps wait for device readiness". The old Roadmap headline may keep its
   current text; the print export uses the new value.
8. `policyMigrationState`: the v1.0 read returns none. Read that one field from the
   beta `authenticationMethodsPolicy` in the same collector, tolerate its absence, and
   only then let `bg.perUserMfaOff` say unknown — as a Housekeeping "could not run"
   line, never as a recommendation.
9. `data/goals.json`: the plain title "Ask for MFA every time an admin role is switched
   on" becomes "Ask for MFA when an admin role is activated". Assert every plain title
   is ≤9 words.

## Part 3 — Shell (target-state §2)

10. `src/ui/shell/AppShell.tsx` is rewritten: no sidebar, no stepper, no step statuses,
    no "Needs:" lines, no "Next:" buttons. A 48px header with a hairline: the wordmark
    (serif, links to `#/connect` when signed out, `#/plan` — `#/roadmap` until 48 —
    when scanned), the tenant name as text, tabs `Today` · `Plan` · `Export` (Export
    appears in 49), and on the right `Re-scan · scanned 24h ago` (a button; the age
    comes from `src/derive`), `Recovery card`, the theme toggle (label names the mode
    it switches to), and `Account` (a menu: `Sign out`, `Forget this tenant`). Element
    `header.app`; page content in `main.page`.
11. States (§2 table): signed out → only the wordmark and toggle, Connect is the page;
    signed in without a scan → tabs disabled with the tip "after the first scan";
    scanning → Connect in its scanning state; scanned → tabs enabled, landing on
    Plan. `Re-scan` navigates to Connect's scanning state and returns to Plan when done.
12. Routes: `#/connect`, `#/today`, `#/inventory`, `#/recovery`, and the legacy
    `#/mapping`, `#/coverage`, `#/roadmap`, `#/checks`, `#/reads`, `#/licensing`,
    `#/naming` still mount their old pages inside the new shell. Redirects: `#/start`
    and `#/baseline` → `#/connect`; `#/scan` → `#/today`. `#/plan`, `#/export`, `#/how`
    arrive in 48 and 49. `?demo=1` enters at Plan (`#/roadmap` for now).
13. The mock states from 46 (`?dev=1&mock=1&state=…`) drive the new shell and pages.

## Part 4 — Connect (target-state §3)

14. `src/ui/surfaces/Connect.tsx`, one component, four states, exactly the content in
    §3. The permissions table is generated from the collector registry (six rows,
    columns `Permission` · `What IAMAI reads` · `Without it`), inside
    `details.permissions`; the one line under it: "Plus the standard sign-in
    permissions."; then `Removing it` with the three portal steps and nothing after
    "Properties → Delete". The footer link `How IAMAI works →` points at `#/reads`
    until 49 creates `#/how`.
15. The baseline line reuses the adapter: `Baseline: Jon Hope — Defense in Depth (46
    policies) · change`; *change* opens an in-page picker with two choices (the
    default; upload a package, with `how to make one →` linking to `#/how#package` —
    `#/package` until 49). No About card, no version, no file count, no technical
    details, no load report beyond the policy count in the line itself.
16. Scan runs from this page: `Scan tenant`, one line beneath it, progress inline in
    plain words with the current lane, `Stop`; on completion the scanned state with
    `Open the plan →`. The scan runner moves out of `MfaViabilityScreen.tsx` into
    `src/ui/scan/` without behaviour change (resume, sections, diagnostics download
    under `?dev=1`).
17. Delete `StartPage.tsx`, `BaselinePage.tsx` and their copy modules once Connect
    passes its contracts. The home site's link into the tool points at `#/connect`.

## Part 5 — Today and Inventory (target-state §4)

18. `src/ui/surfaces/Today.tsx`: the one-line count over active people; four tiles
    `MFA proven` · `Registered, unproven` · `No method` · `Not active`, each with an
    info tip carrying its definition (the legend's text, cut to ≤25 words); search and
    the one `Show:` select; the table `Person` · `State` · `Strongest method` ·
    `Evidence`. State words map the six-state model: verified → Proven · likelyViable →
    Likely works · notChallenged → Never prompted · unverified → Possibly broken · none
    → No method · inactive or never signed in → Not active, with the reason as the
    evidence clause. Counts: the first three tiles are `n · % of active people`; Not
    active is the `notActiveUsers` count with no percentage. Disabled and non-person
    accounts appear only in Inventory → People. Pagination at 50, `Export CSV`, the link
    `Everything the scan read →`.
19. `src/ui/surfaces/Inventory.tsx` at `#/inventory`: the ten existing tables under
    `.tab-panel`, `← Today` link, each tab with `Export CSV`; no intro sentence, no
    per-tab footer; roles rule from 46 with `Show all roles`.
20. Delete `MfaViabilityScreen.tsx`, the legend, the rollout tiles, the filter chips
    and their copy once Today passes its contracts. The old Setup, Findings and Roadmap
    pages read the scan from App state as before.

## Part 6 — Contracts, inventory, smoke

21. Flip `status` to `built` for `shell`, `connect.signedOut`,
    `connect.signedOut.permissions`, `connect.noScan`, `connect.scanning`,
    `connect.scanned`, `today`, `inventory`, `inventory.tab`. Nothing else in the file
    changes.
22. `npm run inventory` regenerates; rule 12 is green for every built surface;
    `docs/qa/ui-inventory.md` shows the measured counts against budgets.
23. `scripts/smoke.mjs` walks the new flow on the mock tenant: Connect (signed out) →
    sign in (mock) → Scan → Today → Inventory → the legacy Roadmap, and asserts the
    same invariants it did before. Update the CI smoke test accordingly.

## Finishing

`npm test && npm run smoke && npm run lint-mutations && npm run inventory && npm run
layout-audit`, `vite build`, commit by part, push, confirm CI green and the build stamp.
Report by part, with: measured counts per built surface against budget; the lowest
contrast ratio per mode; the GetIAMAI-shaped fixture's plan length after item 6; and
anything you could not do, with why.

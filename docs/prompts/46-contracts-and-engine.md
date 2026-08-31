# 46 — Contracts, and the engine the new surfaces depend on

Precondition: 45 committed. Read `docs/design/target-state.md` and
`docs/qa/page-contracts.json` in full before starting. They define the product from here
on; SPEC.md §3 is superseded by them.

This prompt is different in kind from 00–45. It builds no user-facing page. It makes the
surface contract enforceable, and fixes the engine facts the new surfaces will render.
Prompts 47–49 then build the surfaces; 50 rebuilds the demo fixture.

## Rules for this prompt

- Do not edit `docs/design/target-state.md` or `docs/qa/page-contracts.json`. If a
  contract looks wrong, finish the work, then list the case with the measured count in
  the completion report. The reviewer changes the contract, not Claude Code.
- Do not touch `src/ui/pages/*` except where a type change forces a compile fix. Those
  pages are deleted in 47–49. No new sections, no new copy generators, no copy fixes.
- Every part ends with its tests green, and is its own commit.
- Done means green CI (CLAUDE.md), then the completion report by part: what changed, the
  exact constant values now in force, what could not be done and why.

## Part 1 — The contract lint

1. `scripts/ui-inventory.mjs` reads `docs/qa/page-contracts.json`. For every surface
   with `status: "built"` it reaches the surface as the contract says — `reach.route`,
   `reach.state`, `reach.actions` (click by selector and text, or nth), `reach.root`
   (`main.page` by default; `header.app`, `visiblePanel`, a selector), `reach.exclude`,
   `reach.eachTab` — and captures it under the contract's `name`. Surfaces with
   `status: "planned"` are skipped. Until `enforceAll` is true, the existing hard-coded
   walk still runs for the legacy pages, unchanged.
2. Mock states. `?dev=1&mock=1&state=<signedOut|noScan|scanning|scanned>` puts the
   synthetic tenant into that state (`scanned` is today's behaviour and the default).
   `scanning` freezes the progress view mid-lane so it can be captured.
3. The extractor gains: `rows` — for every element matching a `repeaters` selector, its
   sentence and word count; `forbidHits` — every contract `forbid` string found in the
   surface's text. Repeater selectors come from the contract file, not the script.
4. Rule 12 in `src/ui/inventory-lint.test.ts`, one test per check, no waivers:
   - every item in headings, tabs, tiles, columns, chips, buttons, summaries and links
     matches an entry in the surface's allow list (exact, or a `re:` pattern);
   - no `forbid` string appears in the surface's text;
   - page-level prose (outside repeaters) is within `budget.sentences` and `budget.words`;
   - every row is within `rules.rowMaxSentences` and `rules.rowMaxWords`;
   - when `enforceAll` is true, every inventory surface has a contract.
5. `scripts/lint-mutations.mjs` proves each of those five checks fails against an
   injected violation.
6. `docs/qa/ui-inventory.md` gains a section per built surface: the measured counts
   against the budget, so a reviewer can see headroom without running anything.

## Part 2 — Populations and one verdict (target-state §8.1, §8.2)

7. `src/derive/sets.ts`: add `notActiveUsers` (enabled minus active) and widen
   `isNonPerson` to accounts with sign-in blocked, and to accounts with a mailbox
   (`mail` set), no service plans and no sign-in on record. `peopleCounts` gains
   `notActive`. Readiness, rollout, the registration window, step populations and every
   readiness threshold count over `activeUsers`. Never-signed-in accounts appear in no
   denominator anywhere. Add the agreement test.
8. A Wave 0 step, `Decide on N dormant accounts`, kind `check`, listing the names, done
   when the count is 0 on re-scan (each disabled or signed in). Present only when N > 0.
9. One verdict. `src/coverage` exports one `verdict` per goal and one `gapSentence` per
   goal (the clause a partly-in-place row shows: "sessions expire every 168h, baseline
   wants 4h"). A step is `done` if and only if its goal's verdict is `inPlace`; partly
   and below-the-baseline goals are `change` steps carrying that sentence. Plan header
   and footer counts both come from `doneSteps`. Test: for every goal in every fixture,
   findings verdict and step status agree; the demo and mid fixtures currently disagree
   (Findings 6 in place, Plan 11; "Admin sessions expire quickly" partly and done).
10. Tracking: `actualStart` comes only from evidence dated after the plan was created.
    A policy that existed before the plan is `in place before the plan`, never an early
    execution. Remove the slip computation for those rows.

## Part 3 — Every step executable; ad-hoc items demoted (§6.4, §5 footer)

11. `data/goals.json`: every implementation gains `template`, a Graph
    `conditionalAccessPolicy` body with placeholders `{namePrefix}`, `{exclusionsGroup}`,
    `{breakGlass}`, `{trustedLocations}`, `{allowedCountriesLocation}`,
    `{serviceAccountsGroup}`, `{coreAdminRoles}`. The template is the goal floor as a
    policy: the control it requires, the population and apps it targets, the conditions
    it needs. Source each from the goal's `learnUrl`. Every goal also gains `shortName`
    (the control noun, ≤6 words: "Countries not allowed", "Legacy authentication").
12. One function renders Do it from a policy body — portal steps, JSON, PowerShell —
    whether the body came from a matched baseline policy or from the template. No
    hand-written step lists. Test: every goal × implementation renders Do it with at
    least one grant or session control, and every placeholder resolves from the
    assumptions or produces a Wave 0 step that creates the missing object.
13. Proposed policy names: `{prefix} - {Action} - {shortName}` in the tenant's detected
    convention (else the baseline's), never the goal sentence. Ad-hoc items get no name.
14. `adHocGoal` results are no longer goals, findings or steps. Unmatched baseline
    policies, and policies the adapter could not evaluate, are collected as
    `organisation.notAssessed` — the baseline policy's own name, its JSON, one reason —
    for the Plan footer. Nothing invents a title for them. The "Restrict access to
    Office 365" step must not exist after this part.

## Part 4 — Schedule (target-state §9)

15. `src/roadmap/constants.ts`, `rings.ts`, `timing.ts`, `schedule.ts`:
    - `RING_BANDS`: ≤50 active → no rings (report-only then enforce); ≤300 → 2 rings,
      pilot 5 (IT first), soak 5; ≤3000 → 3 rings, ring 1 at 10%, soak 5; above
      unchanged.
    - `BANDS`: small ≤50 weeks 4, mid ≤300 weeks 8, large 12. `verificationDays` is
      computed: active people without a proven method ÷ 5 per working day, min 0,
      max 20, running alongside the first soak rather than before it.
    - `ENFORCEMENT_CAP`: small 3, mid 3, large 2.
    - Enforcement days: Tuesday, Wednesday, Thursday. Never Friday, weekend, inside a
      freeze, or the last working day before one. Time: 10:00 tenant-local or one hour
      after the peak sign-in hour, as today.
    - Notice: when the records show no affected active person, 1 working day; otherwise
      2 / 5 / 10 by disruption. Announce 09:30 Monday–Thursday; remind the working day
      before. `NoticeSettings` becomes constants; the settings type loses the inputs.
    - Remove: pace override, windows-per-week override, holidays, revert-threshold input,
      per-step scheduled dates (still read from plan files v2 for compatibility, then
      ignored). Keep: plan start date, change freeze.
16. Blocked reasons (`src/copy/reasons.ts`, `validation.ts`): one binding reason per
    step, ≤12 words, in one of three shapes — `after: <step title>` · `when <measure>
    reaches <threshold> (now <value>)` · `when <n> <thing> exist (now <m>)`. The full
    list stays on the step for More. "is not sorted yet (N must-fix items)" is deleted.
17. Effort and help-desk estimates: removed from the plan and step models' rendered
    output. If the print export keeps a per-step estimate, it is capped by affected
    active people.
18. Fixture assertions (`docs/design/roadmap-v2.md` §fixtures): update the eight
    fixtures' expected lengths and the binding-constraint sentence. Assert: small
    fixtures ≤4 weeks, mid ≤8, large ≤12; the GetIAMAI-shaped fixture (4 active, 9 never
    signed in) ≤4 weeks with no registration window on the critical path.

## Part 5 — Assumptions replace Setup (§5 header)

19. `src/mapping/questionSchema.ts`: remove `frameworks`, `highCare`, and the two
    emergency-access secondaries. The remaining answers — `breakGlass`,
    `globalExclusion`, `countries`, `trustedLocations`, `serviceAccounts`, `timeZone`,
    `applicability` — each get a detected default at scan time via `suggestForWizard`
    and `applyAutoResolution`; the answer store and plan file v2 keys are unchanged.
    CIS tags stay on goals. Handle-with-care is detection only (admins, emergency access,
    service accounts, people with no method).
20. Emergency access detection: name (break, glass, emergency, bg), onmicrosoft.com
    sign-in address, Global Administrator, excluded from every policy, no licence. Two
    or more signals nominate a candidate. None → the assumption reads `none found` and
    Wave 0 carries `Create emergency access accounts`.
21. The two secondaries (passphrase written down; sign-in alert) become "done when" lines
    of the emergency-access step. Rules that read those answers treat an absent answer as
    not yet done. No rule renders "could not be checked" as a recommendation: a check
    that could not run because a read failed is one Housekeeping line, "N checks could
    not run: <what was not read>".
22. Validation output is consumed as steps and done-when lines only. The Setup validation
    block, its notes, and every "Answer it in Setup" link have no producer after this part.

## Part 6 — Reads and scopes

23. `src/graph/scopes.ts`: remove `Application.Read.All`. Also from the collector
    registry, SPEC §4, the permissions disclosure and its copy, and the decision note
    from prompt 39. The consent screen must not ask for it.
24. Authentication methods policy: on the GetIAMAI scan of Aug 29 the break-glass checks
    reported "the authentication methods policy could not be read", with a Global
    Administrator signed in. Ask Lachlan for a scan with diagnostics and find the cause:
    either the v1.0 read failed (record status and body, add the fallback or the missing
    gate) or it succeeded and `rules.ts` line ~452 treated a missing
    `policyMigrationState` as "not read". Fix the real one; the copy may only say "could
    not be read" when the read actually failed.
25. Roles (`src/roles.ts`, inventory data): a Microsoft-default role whose only holders
    are service principals is hidden by default. "Service:" capitalised at the source.

## Part 7 — Rules and docs

26. `CLAUDE.md`: add under Non-negotiables — "The surface has a maximum:
    `docs/design/target-state.md` and `docs/qa/page-contracts.json`. Never edit them;
    fix violations by removing what violates, or report the case." Replace "the Setup
    wizard's ≤9 questions" with "no questions before the plan exists; detected
    assumptions, editable on the Plan". Replace SPEC.md §3 with a pointer to the target
    state. Update README's flow paragraph.
27. Hide the "See it with sample data" entry on the tool's pages and the home card's
    demo link. `?demo=1` keeps working.

## Finishing

`npm test && npm run smoke && npm run lint-mutations && npm run inventory`, `vite
build`, commit by part, push, confirm CI green and the build stamp. Report by part.
Include the constant values now in force, the cause found in item 24, and any contract
budget you believe is wrong with the measured count — for review, not for you to change.

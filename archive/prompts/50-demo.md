# 50 — Verification leftovers, then the demo rebuilt from the finished product

Precondition: 49.1 committed and green (962a09a). Read `docs/design/target-state.md`,
`docs/qa/page-contracts.json` and `docs/design/lockout-scenarios.md` in full — the
first two were updated by the reviewer in the same commit as this prompt (the demo
paragraph in §2; the sample-data link on Connect). Neither is yours to edit.

This is the last prompt of the rebuild. It closes what the 49.1 verification found on
the live tenant, then replaces the demo fixture with one built to show the finished
product — including the week-two story — so the no-consent path is the product's best
first impression instead of its weakest.

## Rules for this prompt

- Each part ends with `tsc` and the tests it touched, and is its own commit. The full
  finishing gauntlet runs once, at the end.
- New evidence rows and populations go through the existing fixture builder
  (`src/roadmap/fixtures`), so the demo tenant is covered by the property tests like
  every other fixture.
- Write the completion report to `docs/reports/50.md` and commit it with the final
  part; the reviewer reads it from the repo.

## Part 1 — What the 49.1 verification found on GetIAMAI

1. The `.print-only` header line ("IAMAI plan for … · prepared … by …") still renders
   on screen above every page title, `display: block`. It exists only under
   `@media print`, with the rest of the print DOM.
2. Plan settings: the start-date default is next Monday, while the hint says the next
   working day. Default is the next working day. Entering Monday 31 Aug produced a
   window opening Sunday 30 Aug: window and foundation dates are computed and rendered
   in the tenant's time zone, and clamp to working days after that conversion, not
   before. Tests for a Monday, a Friday, a day before a freeze, in Denver and in Sydney.
3. The emergency-access create action carries the passkey clause on the fixture but
   not on the live tenant. Find the condition and remove it: the clause is part of the
   create action unconditionally.
4. Rows: names render on a row only when they fit — at most two names and ≤28
   characters; otherwise the count (`3 people`), with the names on the step. Gap
   suffixes on rows are one shortened clause ≤40 characters (`expires every 168h, wants
   4h`); the full sentence is on the step. Rows never wrap to a third line at 760px.
5. Blocked-by-prerequisite is a waiting state, not a fault: its mark uses `--wait`.
   `--stop` is reserved for Skipped and for a step that would lock the operator out.
6. Today's evidence never shows build numbers: "Authenticator current (seen 6.2607…)"
   becomes "Authenticator app, current".
7. The first click on `Sign in with Microsoft` after a page load does nothing; the
   second works. Bind the handler after MSAL initialises, or queue the click until it
   has; a test on the mock that the first click after load starts the flow.
8. Print page 1 is the posture summary target-state §7 describes — tenant, scan date,
   baseline, in place / to do / doesn't apply with the goal names, the plan's one-line
   header — not the old cover. `Pace`, the baseline pin hash and the pace sentence do
   not appear; pace presets no longer exist.

## Part 2 — The demo tenant

9. A new fixture spec, `demo`, in `src/roadmap/fixtures`: a plausible small business
   the audience recognises — about 40 accounts: 32 active people, 3 admins, 2 guests,
   1 Teams Room, 2 service accounts, 3 dormant accounts, a printer that sends by SMTP
   AUTH, one partner (GDAP) sign-in, a mix of MFA states (proven, likely works, never
   prompted, possibly broken, three with no method), one person on IMAP, one signing in
   from Chrome without device claims, two risky sign-ins, one person who hasn't typed a
   password in 30 days, a stale trusted location, guests with MFA trust off. Group
   members readable (the old fixture's defect). Entra ID P1 plus Intune on half the
   devices. Deterministic seed; every date relative to the day it is viewed, so it
   never goes stale.
10. Its policies are a realistic messy start: MFA for admins in report-only, legacy
    auth blocked, a duplicate MFA policy, one break-glass account excluded from most
    but not all policies, no exclusions group. The result the demo must show: a handful
    in place, several partly, most missing; a plan of about four weeks; and named
    evidence lines on the steps — at least twelve of the twenty-two scenarios fire on
    the demo, and the property tests assert which.
11. Delete `src/ui/fixtures/fixtureSnapshot.ts` and `bigFixture.ts`; the demo loads the
    `demo` fixture through the same path the mock uses.

## Part 3 — Entering and leaving

12. Connect, signed out, gains the link `See it with sample data →` (already in the
    contract) beneath `How IAMAI works →`; the home page's Planner row gains `Try it
    with sample data` beside its status. `?demo=1` still works as a direct entry.
13. The demo banner reads `Sample data — nothing here is from a real tenant · Leave
    the demo`, under the header, on every surface. The demo uses its own storage
    namespace: it never reads or writes a real tenant's scan, plan file or theme
    choice, and `Leave the demo` returns to whatever was there before.

## Part 4 — The week-two view

14. A second snapshot of the demo tenant, one week on: the second emergency-access
    account created and excluded everywhere, the exclusions group created, the
    campaign half done (three of the unproven now proven), two Wave 1 policies in
    report-only with sign-in evidence, one enforced. `Re-scan` in the demo advances to
    it — the banner reads `Sample data · week 2 · Leave the demo` — and the Plan shows
    what tracking looks like: rows moved to Report-only and Enforced, the header line
    recomputed, the campaign step's evidence lines shorter. A second `Re-scan` returns
    to day one. Nothing in the demo says "simulated"; the banner is the disclosure.
15. The Today tiles, the step evidence lines and the footer all move between the two
    snapshots from the same derivations the real tenant uses; the property tests
    assert the week-two deltas (three fewer unproven, two rows report-only, one
    enforced, the emergency-access step in place).

## Part 5 — Smoke, docs

16. The smoke walks the demo end to end: enter from Connect, Plan, two steps, Today,
    Export (print page 1 renders the posture summary), Re-scan to week two, back to
    day one, Leave the demo, and asserts real storage is untouched throughout.
17. README: a `Try it` line pointing at the sample-data entry; `docs/prompts/README.md`
    gains the 50 row.

## Finishing

Once, at the end: `npm test && npm run smoke && npm run lint-mutations && npm run
inventory && npm run layout-audit`, `vite build`, push, confirm CI green and the build
stamp. Report by part in `docs/reports/50.md`: which scenario lines fire on the demo and
on its week-two snapshot, the demo's plan header line for both, print page 1 as text,
and anything you could not do with why.

# 41 — Notice periods, enforcement batching, and the band

Precondition: 40 committed, build stamp live. Verified against build 6279055.

The Schedule now bundles messages correctly and states its rhythm honestly. Two things are
still missing from it, and both change what the plan tells a person to do.

## Part 1 — Notice periods (the advice on when to communicate)

Today the announcement, the reminder and the enforcement can land in the same week, and on
this tenant an enforcement at 12:00 precedes its own announcement at 18:00 the same day.

1. Implement the notice model from docs/design/scheduling-and-onboarding.md §2.3: working-day
   lead times by predicted disruption (none / 2 / 5 / 10), a reminder the working day before,
   and never less than 5 days when a handle-with-care user is in scope. These are settings in
   Plan settings with those defaults.
2. Order within a day is fixed and asserted: announcement, then reminder, then enforcement.
   No enforcement may precede its own announcement or reminder at any granularity, including
   the same day. Add a test over the generated calendar that fails on any inversion.
3. The step body states its own notice plainly, above the draft message: "Send this on
   Tuesday 22 September, three working days before the change." Where no notice is needed
   because evidence shows nobody is affected, say that instead.
4. The salutation and framing of each message follow its audience. A step affecting two named
   people is not "Hi everyone" (finding 8); use the audience model that already exists.

## Part 2 — Enforcement batching, and what the band means

The plan runs to 10 weeks on a 13-user tenant because the enforcement cap is applied per
step: 21 enforceable steps at 2 events a week. That is a modelling artifact. The cap exists
to limit change *days*, and several policies observed in the same window can be enforced in
one supervised change.

5. An enforcement event is a batch: a set of steps sharing an audience and a readiness state,
   observed in the same window, enforced together in one change window. The weekly cap counts
   events, not steps.
6. Batch by disruption class, not arbitrarily: zero-affected blocks together, then MFA, then
   device and session controls. A batch never mixes a zero-affected step with one that has a
   predicted blast radius.
7. Safe-today steps consume no enforcement slot and need no announcement. They are enforced
   as soon as their evidence holds.
8. Recompute the bands with batching in place. Report what the small, mid and large fixtures
   produce. If a band cannot be met because a registration campaign genuinely needs its weeks,
   the plan says which constraint sets the length, in the sentence it already writes. Do not
   reshape the band to a number that batching cannot honestly reach.
9. State the batch on each step: "Enforced together with 4 other changes on 22 September, in
   one change window."

## Part 3 — The remaining inconsistencies

10. "4 steps are now enforced" (Do this next) against "Nothing has started yet" and "Enforced
    1" (journey band). One derivation (finding 5).
11. Admin-time total and help-desk-contact total come from the same per-step estimates that
    the step cards show. 20 help-desk contacts for a tenant with 4 active users is not
    credible; state the basis or drop the figure (findings 3 and 4).
12. The colon splice in "What could go wrong" survives on the compliance-policy entry: the
    Intune-enrolment sentence is a separate fact and belongs in its own entry (finding 6).
13. One Learn link per step, once (finding 7).
14. Do this next leads with the three next actions; the watch-first item follows them
    (finding 9).

## Finishing

npm test, npm run smoke, vite build, commit by part, push, confirm CI green, then load the
live site with no cache-buster and confirm the build stamp matches. Report the band lengths
before and after batching for all three fixtures, and the constraint that sets the length in
each.

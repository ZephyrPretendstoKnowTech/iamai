# 37 — Truth and consistency

Precondition: 36 committed. Read docs/qa/review-07-findings.md. This prompt fixes section T
and section S: the places where the tool contradicts itself or ignores its own rules. Do
this before any cosmetic work; a user who catches one of these stops trusting the rest.

## Part 1 — One source for every number

1. Define, once, in one module: the trackable step set, the applicable goal set, the enabled
   user set, the active user set, and the admin set. Every surface reads from these. No page
   computes its own. (T3, T11)
2. Findings, the Plan tab, Do this next and Progress must agree on which steps are done,
   blocked, and enforced, because they read the same derived plan. Add a test that renders
   all four from one fixture and fails on any disagreement. (T1, T2)
3. Do this next and every counter derive from the snapshot and the plan, never from
   render-time state; re-rendering a tab cannot change a number. Add a test that switches
   tabs ten times and asserts the counts are stable. (T4, T5)
4. Exclude non-person accounts (shared mailboxes, resource accounts, accounts with no
   sign-in capability) from readiness populations, and say in the tile definition that they
   are excluded. (T12)
5. Report break-glass exclusion counts consistently, and say which accounts when the number
   differs between goals. (T14)

## Part 2 — Blocked reasons and state

6. One blocked-reason list per step, printed once, in one voice: "Blocked until <cause>".
   No duplicate list under Readiness, no double prefix, no question titles pasted mid-clause.
   (T7, T8)
7. Setup answers must clear the state they answer. A question answered by any means removes
   every "still unanswered" reference in the plan and in portal steps. (T6)
8. Investigate and fix every "could not be checked: an answer given in Setup could not be
   read on this scan". Report what caused it. (T10)
9. No user-facing string may contain an id. Extend the existing GUID test to cover truncated
   ids ("6744cba6…") and apply it to Do this next. (T9)
10. A goal is either in place or partly in place, never in place with a caveat that
    contradicts it. (T13)
11. Rings: confirm they are generated, then surface them in the step body (ring name,
    targeting, dates, entry and exit criteria). If they are not generated, that is the bug.
    (T15)
12. Re-check every goal's domain against its controls, and rebalance the domain set so no
    domain holds one item while another holds six. (T16)
13. Make the check-page totals and the section totals count the same thing. (T17)

## Part 3 — Schedule and communications

14. Apply the bundling rules from docs/design/comms-and-bridges.md to the calendar: one
    bulletin per audience per week, not one row per step. Fifteen announcements in one cell
    is the bug. (S1, S2)
15. Reminders are one per bulletin, and no bulletin repeats across weeks unless its steps
    do. (S2)
16. The Enforce row must show the enforcement events for that week. If a week has none, the
    week is not rendered. (S3)
17. Scheduling must use the computed tenant rhythm: announce and enforce on the days and
    hours the rhythm supports, and say which day was chosen and why. If the rhythm is
    ignored because the sample is too small, say that instead. (S4)
18. Confidence on the rhythm line: below a sample threshold, say the pattern is provisional
    and name the sample size. Do not report a weekend working day from three users without
    that caveat. (S5)

## Finishing

npm test, vite build, commit by part, push. Report: which numbers were wrong and where they
came from, what caused the Setup-answer read failure, and whether rings were generated or
missing.

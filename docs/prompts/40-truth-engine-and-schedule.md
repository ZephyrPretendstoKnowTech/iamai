# 40 — Make the numbers true, and make the schedule obey its own model

Precondition: the security fixes are committed. Read docs/qa/review-08-findings.md.

Prompt 37 asked for one source per number and a schedule that uses the tenant's rhythm.
Both were reported complete; neither holds on the live site. Before writing any code, answer
these two questions in the report and fix what they expose.

## Part 0 — Why 37 did not hold

1. Does the single-source module from prompt 37 exist, and does every surface read from it?
   List each surface (Findings summary, Findings tiles, Findings tabs, Plan header, Plan
   tiles, Do this next, Schedule, Setup header) with the function it calls for its counts. If
   any computes its own, that is the defect.
2. Does the schedule read the comms bundling rules and the tenant rhythm, or does it iterate
   steps directly? Show the call path from plan to calendar cell.
3. The tests written in 37 pass. Explain why they pass while the live pages disagree, and
   change the tests so they would have caught this: assert on rendered output for a fixture,
   not on the derivation functions in isolation.

## Part 1 — One number, one derivation (A1, A3, A4, A5, A6, A9, D1, D2)

4. Every count and denominator comes from the single derived result. Remove every local
   computation. The set of denominators is fixed and named: goals considered, goals
   applicable, enabled users, active users, trackable steps.
5. Exclude non-person accounts from every user count, everywhere, including the directory
   total. Feedback Mailbox must not appear in readiness, in "users to set up", or in the
   13-vs-12 gap.
6. "and N more" counts what it summarises. Add a test with 6 items and 4 named.
7. The plan start date is the plan's own start, never a policy creation date. A step
   satisfied before the plan began is already-in-place everywhere — summary, table, journey
   band — and never carries a slip or an "early" value (C1).
8. No projection from fewer than three executed steps. Below that, say the projection needs
   more data (A7).
9. Fix the three-way disagreement between "steps that can deny access are held", "blocked",
   and "waiting on Setup question 2" (A9). One number, one phrase.

## Part 2 — Blocked reasons that are true (B5, A8, A10, E1, E2)

10. A question answered by any means, including "Doesn't exist yet", is answered. No step may
    say "waiting on Setup question 2" while Setup reports it answered. If the answer creates a
    prerequisite step, the blocker is that step, named.
11. Repair the sentence: "Blocked until Setup question 2 is still unanswered" is two
    constructions spliced.
12. Never print a placeholder where a name belongs. If an id cannot be resolved, resolve it
    through the name-resolution endpoint the tool already calls, or omit the entry and say how
    many were omitted (A8).
13. Orphan sentences get a home or go (A10).
14. Fix the emergency-access action: two accounts are needed, so the action is to add one, not
    to pick a different one (E1).
15. Unknowns are their own category, counted separately from recommendations, in the chips and
    in the list (E2).

## Part 3 — The schedule (B1, B2, B3, B4, B6)

16. Enforcement events bundle by wave and audience: no calendar cell may contain more than
    one event per audience per day. Twenty-one events at 12:00 is the failure to test against.
17. Waves come from the ring model. A plan with 21 enforceable steps and one wave means rings
    are not applied; find why and fix it there, not in the calendar.
18. Ordering: registration window, then observation window on the policies created in Day 0,
    then the first wave. An observation window that closes before the wave it informs is
    wrong.
19. The mini-map shows every phase and window in the plan, sized by duration.
20. Wave names come from the goals they contain; a wave holding admin, guest, location and
    session goals is not "Devices".

## Part 4 — The rest

21. C2: no step is planned for the last day of the phase that must precede it.
22. C3: the "What changed since the last scan" section does not render before a checkpoint
    exists.
23. Carry-forward items in review-08 section F: colons standing in for em dashes (the lint
    needs a rewrite rule, not a ban), the Start page's three read-only repetitions, "Dated
    phases" to waves, the sidebar chevron's accessible name, the Setup header's three stacked
    sentences, and "no help-desk contacts" stated as fact when nine people need MFA set up.

## Part 5 — Build stamp and cache

24. Show the commit short hash and build date in the footer, linked to the commit.
25. Add a cache-control meta tag to the HTML entry so a returning visitor is not served a
    stale bundle after a deploy. Verify by deploying and loading without a cache-buster.

## Finishing

npm test, vite build, commit by part, push, and confirm the pushed commit's CI run is green
before reporting. Then load the live site without a cache-buster and confirm the build stamp
matches the commit you just pushed. Report the answers to Part 0 first.

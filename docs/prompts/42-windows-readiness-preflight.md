# 42 — Observation windows, the readiness verdict, and operator pre-flight

Precondition: 41 committed. Read docs/design/observation-and-readiness.md in full.

## Part 1 — Windows, and the unknowns they leave

1. Two window lengths only: 3 days where evidence already shows zero affected users, 7 days
   for everything else. No window exceeds 7 days. Replace any per-control-class table with
   this; the reasoning is in the design doc and it is deliberate.
2. The evidence bar is unchanged and still governs: days plus a sign-in from every active
   affected user, or 500 sign-ins, whichever is smaller; below 10 affected users, all of them.
   Where the days pass and the bar is not met, the step offers waiting or proceeding, and
   names the people the records could not speak for.
3. Each step states, in plain words, what its window cannot see, using the table in the design
   doc, and carries the matching question.
4. Implement assertions: the user answers a question once, from Setup or from the step, and
   the answer is stored with its date and does one of three things, stated at the time: adds
   the named people or devices to the step's carve-out, moves the step to a later wave, or
   records the exposure as accepted in the change record.
5. An unanswered question is never a blocker. It renders on the step and in the verdict as
   "the records cannot confirm this".
6. Recompute plan length with these windows plus the batching from 41 and report the effect on
   the small, mid and large fixtures.

## Part 2 — The readiness verdict

5. Build the verdict card exactly as §2 specifies, on every step in report-only: verdict,
   days and sign-ins against their bars, users covered, would-be failures by person, the
   population who have not signed in during the window, and the exit criteria ticked.
6. Grouping is by step; multiple policies for one goal produce one verdict.
7. Both outbound links on every verdict: report-only insights for that policy, and What If
   pre-filled for the first affected user. Build the URLs from the tenant and policy ids.
8. "Not enough evidence yet" is a first-class verdict and must never render as ready. Test
   with a fixture holding three days and two sign-ins.
9. The verdict feeds Do this next: a step that reaches Ready to enforce becomes the top item,
   with the evidence summarised in its line.

## Part 3 — Operator pre-flight

10. Before each enforcement event, run What If for the signed-in operator against the policies
    in that event and show go or no-go with the reason. Cache the result with the plan and
    re-run on each scan.
11. A no-go blocks the event and names what would stop the operator.

## Part 4 — Findings from review 09

12. Enforcement slots vary within the allowed window rather than every event landing at 12:00
    for eleven weeks; announcements move inside working hours (18:00 is the end of the day).
13. A week with no reminder renders the row with "none needed" rather than omitting it.
14. Two enforcement events for the same audience in one week contradicts the bundling rule
    printed above the table; either bundle them or state why they are separate.
15. The schedule rationale sentence names a reason, not a step: the trailing clause "which
    places Windows desktop sessions require token protection last" is a fragment.
16. Help-desk contact estimate and the number of announcements come from the same model.
17. The sidebar collapse control has an accessible name in both themes.
18. "4 steps are now enforced" contradicts the badge (11/31 = 10 already in place + 1
    enforced) and the journey band. One derivation.

## Finishing

npm test, npm run smoke, vite build, commit by part, push, confirm CI green, confirm the live
build stamp. Report the plan lengths for all three fixtures with per-class windows plus
batching, and which constraint sets each.

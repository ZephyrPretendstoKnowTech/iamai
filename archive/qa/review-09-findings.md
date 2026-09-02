# Review 09 — verification pass on build 6279055

Live pass on getiamai.com/rollout, both themes, after prompt 40 and the security fixes.
Numbering is referenced by prompts 41, 42 and 45; do not renumber.

## Confirmed fixed in this build

Schedule bundles messages ("Everyone: 3 changes"), one per audience per week. The rhythm line
carries an honest caveat naming the sample size. Blocked reasons read as the condition that
clears them. "Nothing has started yet" replaced the false start date. The journey band shows
"Already in place" as its own column. Build stamp live and matching HEAD. Waves named from
their contents. Both themes pass on the surfaces walked.

## Findings

| # | Finding | Fixed by |
|---|---|---|
| 1 | Enforcement precedes its own announcement on the same day: week of Sep 21 enforces Tue 12:00 and announces Tue 18:00. Week of Sep 28 reminds Tue 18:00 after enforcing Tue 12:00. | 41 |
| 2 | No notice period exists. Announce and enforce fall in the same week, sometimes the same day. The lead-time model from docs/design/scheduling-and-onboarding.md §2.3 never reaches the calendar, and no step says when to send its message. | 41 |
| 3 | "20 help-desk contacts" for a tenant with 13 users, 4 of them active. More contacts than active people. | 41 |
| 4 | "about 8 hours of admin time" against per-step estimates of 12 to 26 minutes across 20 remaining steps, which is about 6 hours. Two derivations of one figure. | 41 |
| 5 | "4 steps are now enforced" in Do this next, while the page below says "Nothing has started yet" and the journey band shows Enforced 1 with Already in place 10. The badge reads 11/31, which reconciles as 10 + 1, so the Do this next line is the wrong one. | 41, 42 |
| 6 | "What could go wrong" still splices two facts with a colon on the compliance-policy entry: the tenant-wide default sentence runs into the Intune-enrolment sentence, which is a separate fact. | 45 |
| 7 | The same Microsoft Learn URL is printed nine times in one step body, in full. | 45 |
| 8 | "Tell your people" opens "Hi everyone," on a step whose audience is two active users. The audience model exists and is not used in the salutation. | 45 |
| 9 | The Do this next card leads with the watch-first callout, pushing the three actual next actions below it. | 45 |
| 10 | Every enforcement in every week is Tue or Wed at 12:00 for eleven weeks. The slot never varies, though the rhythm data supports a range. | 42 |
| 11 | Announcements are scheduled at 18:00, the last minute of the stated 09:00 to 18:00 working window. | 42 |
| 12 | Week of Sep 21 has Announce and Enforce rows but no Remind row, while later weeks have all three. A missing row reads as an oversight rather than "none needed". | 42 |
| 13 | "Everyone: 2 changes take effect" appears twice in one Enforce row (Oct 5, Tue and Wed): two events for the same audience in one week, contradicting the bundling rule printed directly above the table. | 42 |
| 14 | The schedule rationale ends in a fragment: "…which places Windows desktop sessions require token protection last" names a step where a reason belongs. | 42 |
| 15 | The help-desk contact estimate and the number of announcements the schedule generates are unrelated figures for related things. | 42 |
| 16 | The sidebar collapse control is an unlabelled chevron in both themes. Reported fixed after review 08 on a source reading; it is not fixed on the live build. | 42 |
| 17 | Plan badge 11/31 against "4 steps are now enforced" and journey band Enforced 1. Same defect as #5, listed separately because it appears on a different surface. | 42 |

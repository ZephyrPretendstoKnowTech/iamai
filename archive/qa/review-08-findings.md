# Review 08 — verification pass and new findings

Live pass on getiamai.com/rollout with cache-busting, after prompts 36 to 39 and the
security fixes. Sections A and B are prior items that did not land. Sections C onward are new.

## A — Prompt 37 items that did not land (verified still broken)

| id | Finding |
|---|---|
| A1 | Q1 shows three "could not be checked" entries (auth methods policy, and twice "an answer given in Setup could not be read on this scan: Answer it in Setup") while the header says 7 of 7 answered. T10 was two occurrences; it is now three. |
| A2 | The break-glass Notes block survives with both "signed in Jul 24, 2026, inside the 90 day drill window" and "last signed in Jul 24, 2026". R10 was a removal. |
| A3 | "13 users in the directory… 3 of 12 enabled users" in one paragraph (T11). |
| A4 | Feedback Mailbox is still a person: in the readiness table, in "9 users to set up before enforcement", and in the 13-vs-12 gap (T12). |
| A5 | Three goal denominators: "32 goals considered, 27 apply", "6 of 27", "22% of scored goals in place" (T3). |
| A6 | Plan header says "7 of 31 steps in place"; the paragraph below says "Started Jul 24, 2026. 1 of 31 steps enforced… 6 steps were already covered before the plan began" (T1). The start date is still a policy's creation date. |
| A7 | "At the current pace, finished by Feb 1, 2029 (planned Oct 2, 2026)" — a projection from one enforced step. No insufficient-data guard. |
| A8 | Do this next: "Lachlan Robinette, an account IAMAI could not name, Dalinar Kholin". The GUID is gone; a phrase now sits where a name belongs (T9). |
| A9 | "20 steps that can deny access are held" (Do this next) vs "15 blocked" (tile) vs "18 steps waiting on Setup question 2" (Schedule) — three counts of the same thing (T2). |
| A10 | "One subject has must-fix checks outstanding, holding 20 steps that can deny access." renders as an unstyled orphan line above the Progress heading. |

## B — Schedule: bundling and rings never reached the calendar

| id | Finding |
|---|---|
| B1 | Twenty-one enforcement events on one day, all at 12:00, in a single Enforce cell. The announcement-stacking problem moved rather than being fixed. |
| B2 | The mini-map shows two segments (Day 0, Wave 1) for a five-week plan; the registration and observation windows are absent from it. |
| B3 | "1 enforcement wave" for 21 steps. One wave means the ring model is not being applied. |
| B4 | Observation window Sep 3 to Sep 10; registration window Sep 3 to Sep 17; Wave 1 starts Sep 22. The observation window closes twelve days before the wave it informs, and runs concurrently with registration rather than after it. |
| B5 | "18 steps waiting on Setup question 2" while Setup reports 7 of 7 answered and Q2 shows "Answered: Doesn't exist yet". Eleven step cards read "Blocked until Setup question 2 is still unanswered" — wrong and ungrammatical. |
| B6 | "Wave 1 · Devices" contains admin portals, guest MFA, geo blocking, privileged-role activation and session controls. |

## C — The plan table

| id | Finding |
|---|---|
| C1 | Five steps show "52 days early", "45 days early", "60 days early" against actual dates that are pre-existing policies' creation dates. The already-in-place fix reached the summary but not the table. |
| C2 | Two steps are planned for Sep 3, the day the Day 0 phase closes. |
| C3 | "What changed since the last scan" renders only to say it cannot work yet. It should not render until a checkpoint exists. |

## D — Findings

| id | Finding |
|---|---|
| D1 | "Already in place: … and 2 more" with 6 in place and 4 named. Off by one. |
| D2 | Tab counts (In place 6, Needs attention 21) are correct; the "22% of scored goals in place" tile uses a different denominator again. |

## E — Setup

| id | Finding |
|---|---|
| E1 | "only 1 emergency access account is nominated: two are needed" offers "Pick a different account above". The action is to add a second, not replace the first. |
| E2 | Q1's chips read "3 must fix / 5 recommended", but three of the five recommended entries are "could not be checked". Unknowns are counted as recommendations rather than as unknowns. |

## F — Carried forward, still open from review 07

C5 (colons standing in for em dashes), the Start page's three read-only repetitions, "Dated phases" vs waves,
the unlabelled sidebar chevron, the Setup header's three stacked sentences, "about 8 hours of admin time and
no help-desk contacts", and the absence of a build stamp.

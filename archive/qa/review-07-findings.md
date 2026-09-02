# Review 07 — full findings list

Three passes over the live site at getiamai.com/rollout with Setup answered. Every item has
an id, a verdict (**Remove** or **Fix**), and enough detail to act on without re-finding it.
Prompts 37 to 40 reference these ids.

Verdict rule: if the item does not change what the user knows or does, it is removed.

## T — Truth and consistency (fix all; highest priority)

| id | Finding |
|---|---|
| T1 | Findings says "Registering or joining a device requires MFA: no policy does this yet" while the Plan tab counts that step under Done (11) and Do this next says "2 steps are now enforced". Nothing was enforced. |
| T2 | "16 steps that can deny access are held" (Do this next) vs "Blocked (15)" (Plan chips), same screen. |
| T3 | Three counters disagree: Progress 11/31, Plan chips summing 31 with Done 11, Findings 8 of 27 goals. Define one trackable set and one goal set, label each, and use them everywhere. |
| T4 | Do this next content and counts changed between visits with no re-scan (card 3 changed; "2 steps are now enforced" appeared). Derive from the snapshot, not from render-time state. |
| T5 | Progress badge observed as 9/31, then 11/31, then 9/31 across tab switches in one session. |
| T6 | Answering Q2 with the opt-out left the plan saying "Setup question 2 is still unanswered" and portal steps still referencing "your exclusions group — Setup question 2". |
| T7 | A blocked reason pastes the question title mid-sentence: "Blocked by Setup question 2 (Exclusion group): which group holds the policy exclusions, device readiness is 0%…". |
| T8 | Blocked reasons print twice per step, once as "Blocked by…" and once as "Blocked while…" under Readiness. |
| T9 | Raw id in Do this next: "Lachlan Robinette, 6744cba6…, Dalinar Kholin". |
| T10 | Q1 findings show "could not be checked: an answer given in Setup could not be read on this scan" twice, for answers that were given. |
| T11 | User counts disagree: "13 users in the directory" and "3 of 12 enabled users" in one paragraph; a step header says "11 people · 2 active · 2 admins" while the summary says 4 active. |
| T12 | Shared mailbox ("Feedback Mailbox") counted as a person with "No method", inflating the no-MFA count. Exclude non-person accounts from readiness populations. |
| T13 | "In place: Windows desktop sessions require token protection… Covers fewer apps than the goal expects." In place or partly, not both. |
| T14 | Break-glass exclusion count reported as 1 on some goals and 2 on others with no explanation. |
| T15 | Rings do not appear anywhere in the step body: one enforcement date, no ring plan, though rings were built. Confirm they are generated and surface them. |
| T16 | Goal domains are wrong or lopsided: "Restrict access to Office 365" (a download-restriction session control) filed under Identity; Devices 6, Sessions 4, Identity 2, Guests 1, Locations 1. |
| T17 | "Every check IAMAI runs" headline says 23 must-fix, 25 recommended, 3 notes; the section tables sum to 51 rows with different per-section counts. |

## S — Schedule and communications (fix all)

| id | Finding |
|---|---|
| S1 | Week of Sep 14 shows 15 announcements in one Wednesday cell, all 09:30. Comms bundling is not applied to the calendar. |
| S2 | The same 15 items repeat as Reminders on the following Monday and again at 12:00 Tuesday: three identical lists across two weeks. |
| S3 | Announce and Remind rows populate; the Enforce row is empty for the first week. |
| S4 | The tenant rhythm line ("mostly sign in Tuesday, Friday, Saturday… quietest working hour Tuesday 12:00") is computed and then ignored: everything schedules Wednesday and Monday 09:30. |
| S5 | Saturday is reported as a working day from a 13-user sample with no confidence caveat. |

## R — Remove (no distinct purpose)

| id | Finding |
|---|---|
| R1 | "Not applicable to us" on all seven Setup questions. |
| R2 | "Nobody needs special care" (Q4) — duplicate of the option beside it. |
| R3 | "Not sure / none" (Q6) — same. |
| R4 | "Detections look right" (Q7) — duplicate concept and duplicate label. |
| R5 | The "why does this not apply" reason box and its Confirm button (exists only to serve R1). |
| R6 | "N entries" labels on every static table (Inventory tabs, Licensing, What IAMAI reads, Every check). |
| R7 | "Download diagnostics (redacted)" on the Scan page; keep it in the feedback panel only. |
| R8 | "Nothing is written; nothing leaves the browser" in the Scan subtitle (footer already says it). |
| R9 | The "Scan complete" card (repeats the banner above it). |
| R10 | Break-glass Notes block (four lines of date bookkeeping, two of which contradict each other). |
| R11 | "This week: …" line inside Do this next (verbatim repeat of card one). |
| R12 | "Watch first" as a tab; fold its single item into Do this next. |
| R13 | Progress as a separate tab; merge into the Plan header. |
| R14 | Prompt pack duplicated in sidebar Reference and the Export tab. |
| R15 | The repeated Microsoft Learn URL printed eight times in one step body. |
| R16 | "When every Done-when line holds, switch the policy from report-only to On" above the Done-when list. |
| R17 | The "IAMAI inferred… Confirm them in Setup" banner on Findings (gone once Setup gates Findings). |
| R18 | "What the last 30 days say" when its only content is that it has no content. |
| R19 | Licensing rows for capabilities no goal uses (Purview Insider Risk, Defender for Cloud Apps) and the "25 (1 assigned)" seat column. |
| R20 | Three of the four repeated read-only claims on What IAMAI reads (keep one). |
| R21 | The "Two things no tenant can be asked" explanatory panel in Q1; ask the two questions plainly after the account picker. |
| R22 | "about 10 minutes" on every Do this next card when it is a default rather than an estimate: either compute it or drop it. |

## C — Copy (fix)

| id | Finding |
|---|---|
| C1 | **Start page headline assumes a baseline the visitor does not have.** "Turn your Microsoft Entra Conditional Access baseline into a dated rollout plan…" — the reader has a tenant and a problem, not a baseline. Rewrite around the user's outcome: knowing what a change will do, who it breaks, and what order to do it in. Same for the subhead and the tool card on getiamai.com. |
| C2 | Three confirm labels for one concept: "Looks right", "This is correct", "Detections look right". |
| C3 | "Doesn't exist yet: add it to the plan" → "Doesn't exist yet". |
| C4 | Findings tab labels are prose ("Here's what's working") while every other tab is a noun. |
| C5 | "· nobody" printed as an affected-people value. |
| C6 | Setup header stacks four separate messages in one banner. |
| C7 | Baseline page never says what a baseline is, does not credit Jon Hope as a Microsoft MVP in identity and access, and does not suggest reloading periodically; the pinned date is shown without saying whether it is stale. |
| C8 | Details tab names goals by app count: "Block access to one app", "Block access to 2 apps", "Require MFA for 4 apps from specific client types" — while the reason names the app. |
| C9 | Two goals lack the "from the baseline's X" attribution the other seventeen carry. |
| C10 | The baseline author's typo is reproduced in a proposed name: "ExludeTrustedLocation". |
| C11 | A "Partly in place" finding ends with two instructions ("Check the policy's report-only insights… or re-scan after a day"). Findings state; steps instruct. |
| C12 | Step Why section is verbatim Microsoft product prose with no reference to this tenant. |
| C13 | Two "what could go wrong" entries are malformed: a colon splices two unrelated facts, and one has the wrong evidence attached to the wrong risk. |
| C14 | Portal steps say "Conditions → Locations → Include: All users" (should be All locations) and "Grant → Require: compliantDevice, domainJoinedDevice" (API casing, not portal wording). |
| C15 | The announcement addresses staff as "GetIAMAI" — the Entra display name, not a company name. |
| C16 | A check description trails into implementation detail: "…readable only on a beta Graph endpoint IAMAI does not call, so this check reads the migration state instead." |
| C17 | Every check page opens with three stacked meta-paragraphs, including one defining "Field practice" before the label appears. |
| C18 | Export tab: eleven buttons across four cards, including three copy variants under Plan file; and Change record explains its own formats in forty words when two labelled buttons already do. |
| C19 | The grounding bundle's Unredacted checkbox has no warning adjacent to it. |
| C20 | Free-tier ladder: only three of ten items link to a step; the rest are dead text. |

## L — Layout and platform (fix)

| id | Finding |
|---|---|
| L1 | Sidebar background stops partway down the page; no collapse control. |
| L2 | Scan page: the useful content starts below title, subtitle, needs line, two buttons, a banner, a summary card and a Details collapse. |
| L3 | Groups is a sub-tab inside People. Proposed tab order: Policies · Named locations · Authentication · People · Groups · Devices · Roles · Apps · Licensing · Sign-in records. |
| L4 | Continue button placement differs per page. One pattern: bottom only. |
| L5 | Light theme: the sidebar loses contrast against the page, "done" chips wash out, and the Do this next card keeps a dark-theme treatment. |
| L6 | At 700px nothing reflows: sidebar keeps full width, tables overflow, no collapse. |
| L7 | `#/roadmap/prompts` renders a step detail page instead of the Prompt pack. |
| L8 | Findings shows Group by and Sort by above the tab strip, where they appear to apply to Summary. |
| L9 | Two info icons side by side on the Findings scan line. |

## P — Permissions (decide, then act)

| id | Finding |
|---|---|
| P1 | **Application.Read.All is requested and unused.** The What IAMAI reads page says so plainly: "Not used by anything IAMAI runs today… consented for a planned service-principal inventory that has not been built." Pinned for a decision: either build the inventory that needs it, or drop the scope from the app registration and the consent screen. Until decided, the trust page must not present an unused permission as part of the set. |

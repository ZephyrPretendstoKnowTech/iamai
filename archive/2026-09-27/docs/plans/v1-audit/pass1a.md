# Pass 1A — every Tasks Remaining card

Read `docs/qa/tile-dump.json` in full: **274 step snapshots, 815 cards, 169 distinct card
texts, 45 distinct step ids**, across all eight fixtures (demo 40, demo-week2 40, small 31,
mid 38, large 33, messy 31, midflight 31, hostile 30). Every quotation below was pulled from
the dump by step id and checked against its whole snapshot (bar, lane, state, tasks) before
it was written down. Nothing was fixed; no file under `src/` or `docs/design/` was touched.

Bar applied: `docs/plans/quality-audit-2026-09-20.md` §1 — subject names a *thing*, the thing
sits under it, "N checks remaining", a four-word next check, one sentence that adds a fact,
one action naming a task. `demo/s-goal-admins-phishing-resistant` is the only non-Emergency
card in the corpus that meets it: *"Running this would turn the policy on straight away, and
the way back in to Contoso Pty Ltd is not verified yet. Finish Prepare Emergency Access
Accounts first; the instructions come back when its checks pass."*

---

## Findings

| step (fixture) | card | what it says today (quoted) | what a person gets wrong | sev | proposed fix |
|---|---|---|---|---|---|
| `s-goal-block-device-code` (small, mid, large, messy, hostile), `s-goal-inforcer-mfa` (demo-week2, small, mid, large, messy, midflight, hostile) — 17 cards | Conditional Access policy | check `"Enforced"`; completed checks `["Report-only","Ready to enforce","Enforced"]`; sentence *"This step has no policy for IAMAI to write in this plan. Scan Fixture small again to rebuild it."* | The bold line and the completed list state that the policy is live and all three stages passed, on a step where IAMAI holds no policy at all. A person ticks "device code is blocked" off their list and blocks nothing. IAMAI asserts a tenant state it cannot have read. | 4 | When `policyOf` is empty, the card must draw no stage: check = the reason ("No policy in this plan"), completed = `[]`. Never fall back to the last stage. |
| `s-check-dormant-accounts` (all 8) | Affected people | check `"No user impact"`, satisfied (green), no sentence, no action | On a step titled *Disable or Confirm Dormant Accounts* this reads as IAMAI's assurance that disabling these accounts hurts nobody. It is derived from `impact.noUserImpact` (`content.json:651`), an Impact-**column** word, reused as a card's bold check. A dormant-looking service mailbox gets disabled. | 4 | Cards must not reuse `plan.impact.*`. Either state the evidence ("No sign-ins in the records read") or draw no people card on a review step. |
| `s-goal-block-auth-transfer`, `s-goal-token-protection` (demo-week2) | Conditional Access policy | `2 checks remaining` / **Ready to enforce** / *"Continue observation and collect the missing evidence."*; and `1 check remaining` / **Enforced** / *"Continue observation and collect the missing evidence."* — both on steps whose state is `"Report-only · Blocked / Report-only"` | The heading names the stage that has *not* been reached and the sentence contradicts it. A person reading the bold line flips the policy on while the evidence is still missing. | 4 | The check must be the next thing to *do* ("Keep observing"), never the stage being aimed at. Stage belongs beside the count, not in the `h5`. |
| `s-goal-sign-in-risk` vs `s-goal-sign-in-risk-medium`, `s-goal-user-risk` vs `s-goal-user-risk-medium` (mid) | all three cards | Both pairs draw the identical row: `Conditional Access policy` / 3 checks remaining / **Report-only** / *"Finish the steps this one waits on first."*; `Prepare Emergency Access Accounts` / **Prerequisite step**; `Affected people` / **246 active people · 13 admins · 12 guests · covers 283 enabled**. Only the grey `of` line differs (`CA - Require - Sign-in risk` vs `CA - Require - Medium sign-in risk`). | Two policies with different trigger thresholds are indistinguishable on screen. `CA - Require - Password change for medium-risk users` forces a password reset on a wider population than its high-risk sibling and says nothing about that anywhere on the card. A person who understood one row assumes the other is the same. | 4 | The risk level and the grant must be on the card — subject = the policy's own name, check = what it does to whom ("Password reset on medium risk"). |
| `s-check-separate-admin-accounts` (large) | Affected people | check `"51 active people · 60 admins · covers 60 enabled"` | Sixty admins among fifty-one people. The reader cannot tell which number is the blast radius, and the one that is larger is the one that is not "people". | 4 | Reconcile the denominators, or drop the composite line for one labelled number. |
| `s-goal-intune-enrollment-reauth` (demo-week2) | Conditional Access policy | `2 checks remaining` / **Ready to enforce** / *"Review MFA before enabling Every time"* | The warning is truncated to a heading fragment sitting under "Ready to enforce". The real text — *"without an applicable MFA requirement, repeated sign-in prompts can loop"* — is three cards below on a card headed `Prerequisites`. A person enforces and loops their enrollment flow. | 4 | Promote the loop warning to the policy card's sentence; the card must not say "Ready to enforce" while a hold of this kind stands. |
| all fixtures — **88 cards** | Conditional Access policy | bold check `"Report-only"` (also `"Enforced"` ×28, `"Ready to enforce"` ×6) | "Report-only" is the exact CA vocabulary the target reader does not have. It is the single most common bold line in the product after "Prerequisite step", and it names a mode, not a check. | 3 | Say the action: "Create it switched off", "Watch it for a week", "Turn it on". Keep the mode as the secondary line. |
| `s-goal-guests-mfa` (all 8), `s-goal-inforcer-mfa` (7), `s-goal-block-device-code` (6), `s-shared-devices` (3), `s-goal-admin-portals-protected` (2) — **26 of 137** | Conditional Access policy | subject `"Conditional Access policy"`, `of: null` — the card names no policy | The category is the heading and the thing is missing. On *Require MFA for Guests* the card that is about the policy identifies no policy at all. | 3 | With no policy resolved, head the card with the baseline policy's intended name, or draw no policy card. |
| `s-goal-device-registration-mfa` (all 8 fixtures, 10 snapshots); `s-goal-admin-portals-protected` (demo, demo-week2) | whole step | `tasks: []` and bar `"Complete the next task shown for each item."` (7–8 cards on the device-registration step) | The bar instructs the person to complete a task on a step that offers none. Every card sends them elsewhere. Dead end on the step that gates device registration. | 3 | The bar must read from the projection: no task → say what the step is waiting for. |
| **64 cards** across `s-goal-register-info-protected`, `s-goal-block-legacy-auth`, `s-goal-require-managed-device`, all `s-review-baseline-*`, the risk steps | Conditional Access policy / Baseline policy | sentence *"Finish the steps this one waits on first."* | Names nothing. Two steps away the same slot does name them — `s-goal-geo-restriction`: *"Create or Correct Allowed Countries Location first: this policy names an object Contoso Pty Ltd does not have yet."* The person cannot tell whether the vague one means something different. | 3 | One sentence shape everywhere: name the steps. The data is already on the cards below. |
| `s-goal-inforcer-mfa` (demo) | Conditional Access policy | *"“Inforcer (baseline name)” (708861da-226e-4d65-a57a-24128df64524) first: this policy names an object Contoso Pty Ltd does not have yet."* | Template break: the "{steps} first:" slot was handed an object name and a GUID, so the sentence has no verb and reads as a fragment about a quoted string. | 3 | Guard the slot — an unresolved object is not a step; use the object clause on its own. |
| `s-goal-admin-portals-protected` (demo, demo-week2) | Conditional Access policy | subject `"Conditional Access policy"`, check `"Blocked"`, no sentence, no action, no `of`, no completed checks | One word. A person learns nothing; the card below already says *"This step is on hold until the baseline author resolves a contradiction. There is nothing for you to do."* | 3 | Delete the card (see below). |
| `s-prereq-allowed-countries` (hostile) | Allowed countries ×2 | Two byte-identical cards: **Not Fully Read** / *"Missing scan evidence: sign-in records"* (keys `cty.includesOperator` and `cty.seenCountriesIncluded`) | Two of the step's four cards are the same card. The person counts four problems where there is one. | 3 | Deduplicate findings that share a subject, check and sentence. |
| `s-prereq-allowed-countries` (large) | Allowed countries ×2 | Both **Needs Correction**; actions differ (*"admins have signed in from NZ, which the list leaves out"* / *"No named location matches Work Countries. Create or correct it."*) | Two cards indistinguishable above the fold. The NZ finding — the one that matters — is the one a reader skips as a repeat. | 3 | Distinguish by check, or merge into one card with two completed-check lines. |
| `s-prereq-trusted-location` (demo-week2) | Trusted network + Trusted Network | *"Trusted network / **In place** / No change needed."* beside *"Trusted Network / **Everyone is remote**"* | The same subject twice, differing only in capitals, with two states. Is the trusted network in place, or is there nobody in an office? | 3 | One subject per thing; fold the second into a completed check. |
| `s-prereq-auth-strength` (demo, demo-week2) | Authentication strength + Authentication Strength | *"**In place** / No change needed."* beside *"**Exact match found**"* | Same fault, same step. | 3 | As above. |
| `s-goal-register-info-protected` (demo, demo-week2, messy) | Prerequisites ×2 | Two cards, same heading `Prerequisites`, actions *"when 1 Temporary Access Pass policy exists (now 0)"* and *"when people without a method reaches 0 (now 7)"* | Two indistinguishable headings; both actions are lowercase subordinate clauses that instruct nothing. These strings are `plan.blocked.*`, written to follow "Blocked · ". | 3 | Head each card with its own subject ("Temporary Access Pass", "People without a method") and make the clause the note. |
| `s-goal-inforcer-mfa` (all 8) | Prerequisites | action `"after: Identify the Inforcer application"` | A dangling label in the one slot the anatomy reserves for the action. Not a sentence, not clickable, names a task that is not in the step's task list. | 3 | Same fix as the row above. |
| `s-prereq-service-accounts-group` (small, +4) | Service accounts group | state `"Skipped / Deferred"`, bar *"Complete the next task shown for each item."*, card check **Not in place**, sentence *"Put this step back if you want it on the plan again."* | The step is skipped, the bar tells them to do a task, and the card shows an outstanding problem. Three readings of one step. | 3 | A deferred step draws no open card and no task bar. |
| `s-prereq-per-user-mfa` (all 8) | Per-user MFA states | check **Not in place**; *"…disable the per-user MFA state on each account listed here."* | "Here" lists nothing — the card has no `of`, no completed checks. And "Not in place" on a step called *Finish Moving Off Per-User MFA* inverts: the states **are** in place; that is the problem. | 3 | Check = "Still enforced"; either list the accounts or point at where they are. |
| `s-check-separate-admin-accounts` (mid) | Administrator Account Evidence | satisfied (green tick), check **"14 accounts to review"**, no sentence, no action | A card marked done whose heading says fourteen things are outstanding. | 3 | Satisfied cards state what was verified, never a backlog. |
| `s-goal-guests-mfa` (all 8) | Partner or MSP access | check *"Confirm whether partners access your tenant"*; action *"Does an IT provider or MSP access your tenant? Decide whether service-provider accounts should be covered by these guest policies."* | A question with no answer control and no task on the step. The person has nowhere to record the decision, so the card never clears. | 3 | Route it to a direction step, or drop it to a note under the policy card. |
| `s-goal-block-legacy-auth` (demo) | Conditional Access policy | check **Enforced**; completed checks `Report-only, Ready to enforce, Enforced`; sentence *"Finish the steps this one waits on first."*; step state `"Needs correction / Enforced"` | "Enforced" is simultaneously the next check and a completed check, on a step that needs correction. (§2.8 records half of this; the contradicting sentence is the other half.) | 3 | `completed` must be `i < index`; the next check must not repeat as done. |
| all fixtures — **20 cards** | Affected people | check `"29 active people · 3 admins · covers 34 enabled"` (demo), `"3,972 active people · 51 admins · covers 4675 enabled"` (large) | "covers N enabled" is undefined and is always the larger number. A person plans for 29 and 34 accounts are in scope. This is the only reach figure on the card. | 3 | Say what the number is: "34 enabled accounts are in scope; 29 have signed in recently". |
| `s-goal-guests-mfa` (large, mid) | Guest Directory | 225 guest names newline-joined inside the one action, after *"Guest accounts read from the directory. Policy applicability also depends on external-user type, home organization and exclusions."* | The card is a wall. Nothing below it is readable. (§2.11 records the 2-name case; large is 225.) | 3 | Cap the list, move names to completed checks, link to the evidence dialog. |
| all fixtures — **582 of 815 cards have no sentence; 89 have neither sentence nor action** | — | e.g. `"Existing coverage" / "In place"` — subject, check, nothing else, ×26 | The anatomy's one-sentence slot is empty on 71% of cards, so the reader has only a category and two words. | 3 | Either write the sentence or drop the card. |
| `s-prereq-security-defaults` (demo, +6) | Security defaults | check **"In place"**, sentence *"No change needed."*, on the step *Turn Off Security Defaults* | "Security defaults — In place" states the opposite of what is true (they are off). The reader must invert the sentence to get the fact. | 3 | Check = "Off", or "Turned off". `messy` already says **"Still on"** for the other case; use that voice. |
| `s-goal-block-legacy-auth`, `s-goal-block-device-code`, `s-goal-device-registration-mfa` (all 8) | Mail-sending devices / Device code sign-in / Enrollment workflows | action slots hold *"A quiet sign-in history does not establish that every scheduled mail job has stopped using basic authentication."*, *"The sign-in records cover observed use; they can miss infrequent CLI, shared-device and enrollment workflows."*, *"IAMAI cannot prove unobserved enrollment workflows are safe."* | Honest, and none of them is an action. The card's last line — the one the anatomy reserves for what to do — tells the person what IAMAI cannot do. They are left to invent the next step. | 3 | Keep the caveat as the sentence; put a real action last ("Ask the owner of each scheduled mail job…"). |
| `s-goal-service-accounts-trusted-network`, `s-goal-geo-restriction`, `s-goal-block-unsupported-platforms`, `s-goal-admin-session` etc. — 28 cards | Affected people | check **"Not established"**, action *"Policy scope awaits: Define the Trusted Network; Create or Correct Service Accounts Group."* | "Policy scope awaits:" is a machine label with a semicolon list. The reader does not know whether the policy will reach nobody or everybody. | 2 | "IAMAI cannot tell who this reaches until X and Y exist." |
| `s-goal-device-registration-mfa` (messy) | Exclusions / Authentication strength | both check **"Not met"** on one step | "Not met" is a condition word, not a state of a thing, and appears twice with different meanings. | 2 | Name the state: "No group chosen", "Does not exist yet". |
| 21 cards | Threshold | check `"not measured"`, lowercase; action *"Enforcement waits for MFA readiness to reach 90%; it is not measured today."* | A lowercase heading reading as a sentence fragment; "Threshold" is a category, not a thing. | 2 | Subject = "MFA readiness"; check = "Not measured". |
| large, mid | Legacy Per-User MFA / Affected people | *"4902 accounts need a per-user state check."* and, in one line, *"3,972 active people · 51 admins · covers 4675 enabled"* | Two number formats in the same sentence. Undermines the numbers that matter. | 1 | One `formatCount` everywhere. |
| all fixtures | various | Title Case where Emergency Access is sentence case — subjects `"Legacy Per-User MFA"`, `"Administrator Account Evidence"`, `"Registration Support"`, `"Inforcer Application"`, `"Guest Directory"`, `"Allowed AVD Users"`; **checks** `"Needs Correction"` ×8, `"Not Fully Read"` ×2 | Reads as a different product from the four standard steps. (§2.10 lists the subjects; the two Title Case *check* values are new.) | 1 | One pass over `configurationFindings` labels and over the two check values. |
| `s-goal-sign-in-risk*`, `s-goal-user-risk*`, `s-goal-pim-activation-reauth` (mid) | whole step | header `lane: "Ready"`, `substatus: "Create"`, `state: "Blocked / Not deployed"` | Ready and Blocked at once, in the same header. | 2 | One authority for the header word. |
| `s-goal-sign-in-risk*`, `s-goal-user-risk*` (mid) | all cards | No card mentions that risk detections need an Entra ID P2 licence | A person on P1 follows *"Create the policy in Report-only"* and builds a policy whose condition never fires. **Not verified beyond the card text** — IAMAI may gate these steps elsewhere; the fix pass should confirm before acting. | 2 | If no licence check exists, say the requirement on the card. |
| `s-goal-guests-mfa` (demo) | Conditional Access policy | *"…Compare the existing policies with the expected pair before creating or renaming anything. See Entra for the names to check."* | "See Entra" names no blade. Every Emergency Access procedure gives a path (`Entra ID → Users → New user`). | 2 | Give the path: *Entra ID → Protection → Conditional Access → Policies*. |
| `s-prereq-trusted-location` (demo-week2, +6) | Trusted Network | satisfied, check **"Everyone is remote"**, no sentence, no action, no completed checks | Presented as an established fact about the organisation with a green tick. It is the operator's own saved answer (key `configuration:trusted-network-choice`) and the card gives no clue. | 2 | Mark recorded answers as answers: "You said: everyone is remote". |
| `s-goal-geo-restriction` (messy) | four of six cards | four cards reading **Prerequisite step** / **Waiting on your direction** | Two-thirds of the row is "go somewhere else". The one card about the policy is buried. | 2 | See pattern P4. |

---

## Cards that should not exist

1. **`Existing coverage` / `In place` (or `Enforced`) — 26 cards.** Category subject, two-word
   check, no sentence, no action, no completed checks, always beside a policy card saying the
   same thing (`s-prereq-security-defaults`, `s-goal-mfa-all-users`, `s-goal-block-legacy-auth`,
   `s-ladder-operator-passkey`). It is `foundLabel.in-place` (`content.json:1620`) drawn as a
   card. Fold into the policy card's completed checks.
2. **`Conditional Access policy` / `Blocked`** on `s-goal-admin-portals-protected` (2 cards).
   One word; the `Baseline definition` card beside it carries the whole explanation.
3. **The second and later `Prerequisite step` cards — 126 cards, up to four per step.** Subject,
   check and action all say the same thing three times (`Prepare Emergency Access Accounts` /
   **Prerequisite step** / *"Finish Prepare Emergency Access Accounts first."*). One card listing
   the waits, with one link each, replaces the row.
4. **The duplicate `Allowed countries` cards** — hostile draws the same card twice byte for byte;
   large draws two cards with the same subject and the same check.
5. **`Authentication Strength` / `Exact match found`** beside `Authentication strength` /
   `In place`; **`Trusted Network` / `Everyone is remote`** beside `Trusted network` / `In place`.
   Two cards per thing, differing by one capital.
6. **`Affected people` where the check is `Not established`** (28 cards) and the action is a
   sentence about what is not known. It is a placeholder that survives until every prerequisite
   clears; the same fact is already on the prerequisite cards.

---

## FROZEN

Findings against the four Establish Emergency Access steps and the four Direction steps.
**Recorded, never applied.**

| step (fixture) | card | what it says today (quoted) | what a person gets wrong | sev | note |
|---|---|---|---|---|---|
| `s-direction-use`, `s-direction-accounts`, `s-direction-devices`, `s-direction-locations` (all 8) — **32 cards** | Decision | subject `"Decision"`, check `"Decision"`, `of: null`, `remaining: null`, action *"Confirm and save the required decision."* | Subject and check are the same word; the card names neither the decision nor what it is about; it is identical on all four steps. Nothing distinguishes *Confirm What You Use* from *Decide Where People Sign In*. | 3 | Would need the decision's own subject, e.g. "Which Microsoft services you use". |
| `s-prereq-break-glass` (demo, small, ×6) | Emergency access account 1 | no "N checks remaining" at all, beside `Emergency access account 2` showing **1**; action is three sentences: *"IAMAI could not fully check this account. Open MFA Readiness and find it under Emergency access, where Evidence read says what could not be read. No account change is established."* | The count vanishes on the card that has a problem and stays on the one next to it, so the reader reads the unreadable account as the safer one. | 3 | |
| `s-prereq-break-glass` (demo-week2) | Emergency access account 1 / 2 | `remaining: 0` — "0 checks remaining" beside *"No account changes remain."* | Says nothing twice. | 1 | |
| `s-prereq-exclusion-group` (demo) | Policy exclusions | `5 checks remaining`; `of` lists **four** policies; completed checks list **five**, a different set including `Core - Grant - MFA for all users · Mode: On`; the one sentence is the single word *"Missing"* | The count matches neither list. "Missing" as the whole sentence says nothing about what is missing from where. | 3 | |
| `s-prereq-exclusion-group` (messy) | Emergency account membership | 114 names run into one sentence: *"Jamie Wilson, Riley Garcia, … and Sasha Brown are in the group without being an emergency account or an approved exclusion"* | Unreadable; the finding (too many members in the exclusions group — the highest-risk misconfiguration in the product) is hidden in a paragraph. | 3 | |
| `s-prereq-passkey-settings` (demo) | Existing passkeys affected | check `"Affected passkey 1"`; sentence *"YubiKey 5 NFC · cb69481e-8ff7-4039-93ec-0a2729a154a8 · Storage type could not be verified"* | The check is an ordinal label, not a check; the sentence is a metadata string with an AAGUID in it. | 2 | |
| `s-prereq-passkey-settings` (demo-week2, small, ×7) | Existing passkeys affected | `1 check remaining` / check **"Impact"** / *"Some users' registered authentication methods were not readable."* | "Impact" is a column name used as the next check. | 2 | |

**Not checked:** the Verify Emergency Access cleanup row. No step id in the dump matches it
(the 45 ids are listed in `docs/qa/tile-dump.json`); no fixture builds it, so it has no card
to audit here.

---

## Patterns — fix the class, not the card

**P1. The card's bold check is the lifecycle stage the policy is aiming at, stated as though
it has been reached.** `Report-only` ×88, `Enforced` ×28, `Ready to enforce` ×6 — 15% of all
cards. It produces every one of the severity-4 contradictions above: "Enforced" over *"no
policy for IAMAI to write"*; "Ready to enforce" over *"collect the missing evidence"*; "Enforced"
listed as both the next check and a completed check. The h5 must hold the next *action*; the
stage belongs beside the count. This one change closes six findings.

**P2. The subject is a tile kind, not a thing.** `pages.app.plan.step.tiles.*`
(`content.json:1735–1750`) is a list of categories — `Existing coverage`, `Threshold`,
`Observation`, `Exclusions`, `Affected people`, `Prerequisites`, `Baseline definition`,
`Decision` — and every one of them is drawn as a card *subject*. Add `Conditional Access policy`
(137 cards, 26 of them with nothing under it) and 60% of the corpus is headed by a category.
Emergency Access heads its cards with `bg2@demo-fixture.onmicrosoft.com` and `Core - Exclusions`.
Until the subject comes from the finding rather than the tile kind, no card on a policy step
can meet the bar. This is the same root as §2.1, one layer down.

**P3. The one-action slot holds a caveat, a fragment, or a machine label.** *"IAMAI cannot
prove unobserved enrollment workflows are safe."*; *"when people without a method reaches 0
(now 7)"*; *"after: Identify the Inforcer application"*; *"Policy scope awaits: Define the
Trusted Network; Create or Correct Service Accounts Group."*; *"Missing scan evidence: sign-in
records"*; *"admins have signed in from NZ, which the list leaves out"*. Lowercase openings,
dangling colons, semicolon lists. Honest content in the wrong slot: the reader reaches the
bottom of the card with no next move. Rule for the fix pass: the last line is always an
imperative; a caveat is a sentence, never an action.

**P4. Redundancy displaces content.** 126 `Prerequisite step` cards + 35 `Waiting on your
direction` cards = 20% of every card in the product, each repeating its subject three times
in three lines. On `messy/s-goal-geo-restriction` four of six cards are pointers; on
`demo/s-goal-guests-mfa` the one card about guests is seventh of seven. Collapse to one
"Waiting on" card per step.

**P5. Two cards per thing, differing by one capital.** `Trusted network`/`Trusted Network`,
`Authentication strength`/`Authentication Strength`, `Allowed countries location`/`Allowed
countries`, `Prerequisites`/`Prerequisites`, `Allowed countries`/`Allowed countries`. The
policy-layer card and the derive-layer finding card describe the same object and neither knows
about the other. Merge by subject before rendering; identical (subject, check, sentence) triples
must deduplicate.

**P6. Column words reused as card words.** `impact.noUserImpact` → a green "No user impact"
assurance; `impact.notEstablished` → 28 placeholder cards; `foundLabel.in-place` → 26 empty
cards; `blocked.*` (written to follow "Blocked · ") → lowercase card headings. A string written
for a table cell becomes a claim when it is set in the `h5`. Any content key shared between a
Plan column and a card should be forked.

**P7. The step header, the bar and the cards disagree.** `lane: Ready` with `state: Blocked`
(five mid steps); bar *"Complete the next task shown for each item"* with `tasks: []` (12
snapshots, including every fixture's `s-goal-device-registration-mfa`); `Skipped / Deferred`
with a task bar and an open card. One projection should produce all three.

**P8. The sentence is optional in practice.** 582 of 815 cards carry none; 89 carry neither
sentence nor action. The bar says the sentence must add a fact the subject and check do not.
A card that cannot produce one is a card that should not be drawn.

**P9. Numbers are not one format and not one denominator.** `4902` beside `3,972`; `51 active
people · 60 admins`; `covers N enabled` undefined and always larger than the people count;
`N checks remaining` present on policy cards only (§2.7) and absent on the Emergency Access
card that has a problem.

# Walk list

The owner's step-by-step walk of the Plan, 1.1 to 5.1 (steps after 5.1 are frozen until these are right). Each section is audited line by line on the owner's tenant, the owner approves items, and approved items land here. Status runs approved → fixed → verified (verified = seen on screen on the owner's tenant). Items the owner turned down are not listed.

## 1.1 Prepare Emergency Access Accounts
Audit numbers from the 1.1 walk (2026-09-23).

| # | Item | Status |
|---|---|---|
| 1 | "#" column aligned | verified |
| 2 | Completed rows keep Impact and When | verified |
| 3 | Impact is a count ("2 accounts") | verified |
| 4 | When is always a date | verified |
| 5 | Estimated finish counts every planned policy | verified |
| 6 | "Start the plan" and its date removed | verified |
| 7 | Save updates in place, keeps the open step | verified |
| 8 | The plan says what changed | verified |
| 9 | "Record any hands-on test…" removed from How to use this plan | verified |
| 10 | Suggestions left as they are; only Done/Save changed (owner) | verified |
| 11 | One reading of the unchosen state | verified |
| 12 | The signed-in account is not suggested | verified |
| 13 | One instruction, said once | verified |
| 14 | Suggestion list fits the rail | verified |
| 15 | Done/Save | verified |
| 16 | PowerShell tab removed | verified |
| 17 | JSON tab removed | verified |
| 18 | "Why IAMAI says this" removed | verified |
| 19 | Task filler removed; configure shows the full procedure | verified |
| 20 | Completion Criteria rewritten | verified |
| 22 | Completed step keeps Tasks Remaining, "No tasks remaining" and Satisfied (owner reversed the proposal) | verified |
| 23 | Rail moves on after Save | verified |
| 24 | Account cards numbered in list order | verified |

## 1.2–1.4 and the section 1 template
Audit numbers from the 1.2–1.4 walk (2026-09-23). All approved.

| # | Item | Status |
|---|---|---|
| 1 | Every rail reads milestone → bar → instruction → controls | fixed |
| 2 | 1.2's rail names what's left once a group is chosen | fixed |
| 3 | Milestone headline is words, never a date or lane word | fixed |
| 4 | Impact: 1.2 "N policies", 1.3 "N people", 1.4 "2 accounts" | fixed |
| 6 | 1.2 membership card reads the group IAMAI holds (no "Could not verify") | fixed |
| 7 | 1.2 exclusions task: plain procedure before a group is chosen | fixed |
| 8 | 1.2 PowerShell and JSON tabs removed | fixed |
| 9 | 1.2 filler lines removed; membership task is the add procedure | fixed |
| 10 | 1.2 empty card: "No group selected" plus the create pointer | fixed |
| 11 | 1.3 tasks state their values in every state; review task removed | fixed |
| 12 | 1.3 Methodology removed | fixed |
| 13 | 1.3 PowerShell and JSON tabs removed | fixed |
| 14 | 1.3 rail drawn | fixed |
| 15 | 1.3 approved models inside the rail | fixed |
| 16 | 1.4 uses the shared footer, no Close | fixed |
| 17 | 1.4 step-type label and Source checked date | fixed |
| 18 | 1.4 Configuration card removed | fixed |
| 19 | 1.4 filler lines removed | fixed |
| 20 | 1.4 PowerShell and JSON tabs removed | fixed |
| — | Rail colouring on all four steps | fixed |
| — | About, Completion Criteria and 1.4 milestone rewrites, word for word | fixed |

Item 5 (the change line reporting section 7 steps reopening) is for when the walk reaches section 7.

## 5.1 Protect Sign-in Method Registration (noted early, owner 2026-09-23; fix when the walk reaches 5.1)
| # | Item | Status |
|---|---|---|
| — | Create task never says Include: All users or Exclude: the emergency exclusions group; step 3's "Apply the IAMAI-resolved users and exclusions" names neither | noted |
| — | Name suggests "Core - Require - Security info registration (2)" while that policy already exists | noted |
| — | Filler per the standing rules: "Do not add or swap a control", step 6 (session controls), step 7's explanation after "create it", step 8 (compare and rescan) | noted |

## Check in every section with a Report-only create (owner, 2026-09-23)
Every policy's create task must state its Include (e.g. All users) and its Exclude (the emergency exclusions group) by name. A create that leaves either out gives a week of report-only on the wrong people, which makes the week useless. Check this on every create step as the walk reaches it; not fixed now.

## Section 2 Direction (2.1–2.3)
Audit numbers from the section 2 audit (2026-09-23), approved with the owner's changes: 3 and 7 dropped; 20–23 moved to the Export walk; 6, 60 and 64 delete their lines; 18 and 19 delete; 1 and 2 delete the questions outright. Build exactly these and nothing else. Words in quotes are final.

### All three steps
| # | Item | Status |
|---|---|---|
| 8 | Approve answers sits in the rail's controls slot, under the instruction (StepActionColumn), like every other step's controls | approved |
| 9 | Approve is enabled only when an answer differs from what is saved, or a card still holds an unsaved suggestion | approved |
| 10 | Approve disabled by an empty pick-list says why under it: "Pick at least one account, or choose None." / "Pick at least one location, or choose another answer." | approved |
| 11 | Card tag follows the draft: "Suggested" only while the answer is the untouched unsaved suggestion; "Approved" only while it equals the saved answer; otherwise "Not approved yet" | approved |
| 12 | "Not sure? Keep the suggestion. You can change it any time." only while a card reads Suggested; never on paper | approved |
| 13 | Every successful Approve opens the next step in order (2.1 → 2.2 → 2.3 → 3.1); today it moves on only after 2.1 | approved |
| 14 | Evidence in two shapes only. Sign-ins: "{n} people signed in to X in the last 30 days." / "No X sign-ins in the last 30 days." Accounts: "{n} accounts look like X." / "No account looks like X." No "Today:" line, no "The baseline's recommendation.", no "A default, not something the scan saw.": where the scan holds no fact the card shows no evidence line | approved |
| 15 | Each card whose answer changes the plan carries one short consequence line, "Answering {option} …" (the words are in 27, 31, 35, 44, 54, 57) | approved |
| 16 | Pick-list options read "None / Pick accounts" (2.1 mail's "Some" goes) and "Pick locations" (2.3's "Trusted locations" goes) | approved |
| 17 | Doesn't-apply footer rows caused by a Direction answer use one template: "You answered {option} to “{question}” in {step}." It replaces "you said: … is claimed", "Inforcer is confirmed not in use…", "You confirmed that SharePoint and OneDrive is not in use." and "you said: No device management; Unmanaged computers"; the hard-coded English goes | approved |
| 18 | On Hold tiles on other steps lose the note "Answer it in {step}."; the tile keeps "{step} · Waiting on your answers" | approved |
| 19 | The "Answered in {Direction step}" blocks are deleted from every step (owner rule: no Answered-in blocks) | approved |
| 24 | "Saving plan…" and "Plan could not be saved. Use Retry Saving above." move to content.json | approved |
| 25 | Impact on the three Direction steps is the number of plan steps their answers decide: "N steps" | approved |

### 2.1 Confirm What You Use
| # | Item | Status |
|---|---|---|
| 1 | Delete the device code question and the hold it puts on Block Device Code Sign-in | approved |
| 2 | Delete the "Sync from on-premises Active Directory" question | approved |
| 26 | Service evidence: "No {service} sign-ins in the last 30 days." / "{n} people signed in to {service} in the last 30 days.", from sign-in data the scan already reads, 30-day window; no engine-speak | approved |
| 27 | Service consequence: "Answering No takes {step titles} off your plan." | approved |
| 28 | Reopened card: "You answered No. {evidence}" | approved |
| 29 | A reopened card pre-fills the new suggestion, not the old answer | approved |
| 30 | Mail evidence: "{n} accounts signed in to send email in the last 30 days." / "No email-sending sign-ins in the last 30 days." | approved |
| 31 | Mail consequence: "Answering Pick accounts makes them service accounts: they leave the people counts, and Block Legacy Authentication leaves them out until each moves to a supported mail route." | approved |
| 32 | The mail picker leaves out the emergency access accounts and guests | approved |
| 33 | A suggested sender in the mail picker says why: "Signed in to send email in the last 30 days." | approved |
| 34 | Partner evidence: "{n} partner or MSP accounts signed in to your tenant in the last 30 days." / "No partner or MSP sign-ins in the last 30 days."; counts accounts, never sign-ins | approved |
| 35 | Partner consequence: "Answering Yes keeps partner and MSP technicians out of Require MFA for Guests and Block Sign-ins From Countries Not Allowed." | approved |
| 36 | A saved mail None or partner No reopens when a later scan sees use, as the services already do | approved |
| 37 | About: "IAMAI filled these in from your tenant. Approve them or correct any that are wrong: a service you don't use takes its policies off your plan, and the accounts and partners you name are kept out of the policies that would stop them." | approved |

### 2.2 Identify Service and Shared Accounts
| # | Item | Status |
|---|---|---|
| 38 | Label "Service and script accounts" | approved |
| 39 | Evidence "{n} accounts look like service accounts." / "1 account looks like a service account." / "No account looks like a service account." (the bracket goes) | approved |
| 40 | Each picked account's chip shows why it was picked: the service candidate's own detection signals; for shared devices "Teams Rooms or shared-device licence" or "signs in only from a Teams device" | approved |
| 41 | Label "Shared-device accounts"; evidence "{n} accounts look like shared-device accounts." / "1 account looks like a shared-device account." / "No account looks like a shared-device account." | approved |
| 42 | "A default, not something the scan saw." goes from both cards; the gate reads whether user rows were read, not last-sign-in times | approved |
| 43 | The people counts follow the saved shared-device answer (detection only while unanswered), as service accounts already do | approved |
| 44 | Consequences: "Answering None takes Restrict Service Accounts to the Trusted Network off your plan and counts these accounts as people." / "Answering None takes Give Shared Devices Their Own Policy off your plan and counts these accounts as people." | approved |
| 45 | Create or Correct Service Accounts Group exists only while service accounts are picked, Give Shared Devices Their Own Policy only while shared-device accounts are picked: None adds no steps and no Doesn't-apply rows | approved |
| 46 | Rail: "Approving these answers sets which accounts count as people and which get a policy of their own." | approved |
| 47 | About: "Some accounts aren't a person: a mailbox a scanner uses, a script's account, a meeting-room device. IAMAI has picked the ones it found below. Approve or correct them: they leave the people counts, and each kind gets a policy of its own." | approved |
| 48 | Emergency note: "Your emergency access accounts are already out of the people counts: {names}." | approved |

### 2.3 Decide How and Where People Sign In
| # | Item | Status |
|---|---|---|
| 4 | Delete the computers option "Hybrid joined" | approved |
| 5 | Phones: "App protection only" and "Unmanaged" become one option, "No device requirement", the suggestion | approved |
| 6 | Office note: delete "IAMAI does not read sign-in addresses, so it cannot suggest them."; suggest nothing | approved |
| 49 | Delete "The baseline's recommendation." from both device cards | approved |
| 50 | Intune line: "Intune: {consumed} of {seats} licences assigned. Each person who uses a managed computer needs one." Root fix in render.ts pluralise: a verb after a preposition is never bent | approved |
| 51 | "{n} people signed in from unregistered computers in the last 30 days." / "No sign-ins from unregistered computers in the last 30 days." | approved |
| 52 | "{n} people signed in from registered computers that aren't joined, in the last 30 days."; its second sentence and the unused key todayRegisteredNone go | approved |
| 53 | Computer options "Managed (compliant in Intune, or hybrid joined)" and "Unmanaged" | approved |
| 54 | Computers consequence: "Answering Unmanaged takes Require a Managed Device Outside the Office and Require a Fresh Sign-in for Intune Enrollment off your plan." | approved |
| 55 | Phone option "Compliant (enrolled in Intune)" | approved |
| 56 | Phones evidence: "{n} people signed in from a phone in the last 30 days." / "No phone sign-ins in the last 30 days." | approved |
| 57 | Phones consequence: "Answering Blocked from company data adds Keep Company Data Off Phones: a block policy you build, a report-only week, then a test from an iPhone and an Android phone." With Intune, also: "Answering Compliant adds phones to Require a Managed Device Outside the Office." | approved |
| 58 | Office label "Office network"; options "Pick locations", "Not in Entra yet", "Everyone works remotely" | approved |
| 59 | Office evidence names them: "{n} named locations are marked trusted: {names}." | approved |
| 60 | Office evidence when named locations were not read: the "A default…" line goes, nothing replaces it | approved |
| 61 | "Everyone works remotely" while a trusted location exists: "{names} is marked trusted in Entra; this answer doesn't use it as your office." And 5.1's "when 1 trusted location exists (now 0)" hold counts Entra's trusted locations, not the answer | approved |
| 62 | Rail: "Approving these answers sets which device policies your plan holds and which network counts as the office." | approved |
| 63 | About: "Choose how company computers and phones are managed, and which network is your office. The plan's device and location policies follow these answers." | approved |
| 64 | Partial-read lines ("In the part of the sign-in records this scan read… There may be more.") go; nothing replaces them | approved |
| 65 | 2.3's unused AI Info branch (aiGrounding.ts) is deleted | approved |


## Section 3 Prepare (3.1–3.7): APPROVED (owner, 2026-09-23), all items with these changes
- **5:** only the Windows Hello half. A Windows Hello sign-in counts as the operator's phishing-resistant sign-in; there is no every-kind-of-device requirement, and item 43's criterion follows.
- **10:** withdrawn.
- **11:** the "Affected people" and "Existing coverage" cards are deleted on EVERY step. The "In place · No change needed." cards get their facts section by section (section 3 now, item 14).
- **Everything else as written.** The intent comes first: each step reads as an expert that has already looked, names what to do, and completes when the work is done.
From the section 3 audit (seven auditors plus a synthesis, fixtures) and the live walk of 3.1–3.6 on the owner's tenant (2026-09-23). Claims marked (fixture) are checked on the live tenant before building. Nothing here is built until approved.

The 3.6 audit was cut off after its Tasks Remaining lines, and no 3.7 audit arrived. I audited the rest of 3.6 and all of 3.7 myself with the harness, on demo and mid (fixtures). Items not built in section 2 yet (#17, #19, #45, #61) are left out of this list.

### Needs your call

1. **Recommend: let the scan decide 3.2 and delete its Workflow Check.**
   - Today the rail holds "Workflow Check" (Reviewed Accounts · Outcome · Tested On · Save Check).
   - On any tenant without Entra ID P2 (Business Premium is P1), it also shows "Account or role data not fully read · eligible role assignments could not be read: not available on this licence…" and "The latest scan could not verify the relevant configuration. The recorded result is retained." There, the step can never complete.
   - Proposal: DELETE the form and that card. The step is done when no admin other than the emergency accounts has signed in to Outlook or Teams in the last 30 days. The scan already reads this.
   - This reverses the rule in separateAdmins.test.ts:46. I5 E3
2. **Recommend: give 3.2 one card and one task per admin to move, with the values filled in.**
   - Today there is one card, "Administrator accounts · Not reviewed yet", and one task that names no account, role or address.
   - Card on demo (fixture): "Quinn Ivanova (user1@demo.example.com) · Holds Global Administrator and signs in to Microsoft Teams".
   - Task "Move the role to a separate admin account" names the new UPN (adm-user1@ plus the tenant's onmicrosoft.com domain), the Other emails value, the Temporary Access Pass, and each role to assign and then remove. I4 E3
3. **Recommend: delete 3.4's support list and fix its completion bug in the same change.**
   - The list is "People Needing Help", a read-only picker whose help says "Select anyone who needs help…". It comes with "Save Support List", the card "Registration Support · Not confirmed", the row line "Waiting on you to confirm: People Needing Help" and the criterion "The people who still need help are identified and on the support list."
   - IAMAI never reads the list. Saving it turned 3.4 Completed with 10 of 30 people not ready on demo (fixture): graphConditions.ts resolves campaign-targets-passkey to not-applicable.
   - Proposal: DELETE all five, and that condition never resolves to not-applicable (BLOCKED.md S2 already says it must not).
   - On your live tenant it pre-picks Admin as needing help, although Admin registered a passkey in 3.3.
   - Deleting the list alone would complete 3.4 on every tenant's first scan. I5 E3
4. **Recommend: keep your V7 answer (the campaign targets passkeys) and make the task and META say so.**
   - Today the task says "A campaign nudges one method at a time, either Passkey (FIDO2) or Microsoft Authenticator…" and picks neither, while META targets microsoftAuthenticator.
   - Microsoft's managed campaign has nudged SMS and voice users to passkeys since Sep 1, 2026 (Learn).
   - Proposal: "Turn on the registration campaign: Entra ID → Authentication methods → Registration campaign → Edit. State: Enabled. Authentication method: Passkey. Include: All users. Exclude: {exclusions group}. Days allowed to snooze: 1. Limited number of snoozes: Disabled. Save." I4 E4
5. **Recommend: 3.3 completes when the operator signs in phishing-resistantly on every kind of device they used, with Windows Hello counting.**
   - Today the step also requires a registered passkey or FIDO2 key (generate.ts:1388). An operator with only Windows Hello never completes.
   - A passkey used on the computer, while the operator also uses an iPhone, keeps the step open under a criterion that reads as met.
   - Both cases also hold 3.4. Proposal: drop the passkey-held test (criterion in item 43). I5 E4
6. **Recommend: 3.6 completes when the scan finds the trusted location, and 2.3's office card reopens pre-filled with it, as #29 and #36 do.**
   - Today, after the answer "Not in Entra yet", creating the location exactly as the task says leaves 3.6 at Ready · Create for good. decisions.ts:320 saves that answer as unconfirmed, and completion needs a picked location. I5 E3
7. **Recommend: add a group picker to 3.7's rail, like 1.2's "Exclusions group", pre-filled with the scanned group whose members are exactly the picked accounts.**
   - 3.7 completes only against mapping.serviceAccountsGroupId, and nothing in production sets it: applyDetectedDefaults has no caller.
   - On demo (fixture), a group holding exactly svc-mailer-1 and svc-mailer-2 left 3.7 at Ready · Create. Restrict Service Accounts to the Trusted Network, and Block Legacy Authentication's turn-on, wait on this step. I5 E3
8. **Recommend: Entra and AI Info on every section 3 step, with Email kept only on 3.4.**
   - PowerShell tab on 3.1, 3.2, 3.4, 3.5, 3.6 and 3.7: it is either a GET the scan already made or a script needing -DisplayName, -IpRangesJson or -GroupId typed by hand.
   - JSON tab on 3.5, 3.6 and 3.7.
   - Email tab on 3.1, 3.2, 3.6 and 3.7: it refers to "the people listed below", "the listed accounts", "the listed named networks" or "each listed account", and lists nobody.
   - Proposal: DELETE these tabs (NON_MACHINE and NO_EMAIL, and remove the forced PowerShell tab at stepBody.ts:550 for 3.4). I3 E5
9. **Recommend: section 3's footer holds only Scan, like section 1's.**
   - "Defer this step" is on 3.1 and 3.2. Nothing waits on either, and its dialog says a deferred step "does not count as … satisfying the baseline", though neither check is part of the baseline.
   - "Doesn't apply here" is on 3.6 and 3.7, which 2.3's and 2.2's answers already decide.
   - Proposal: DELETE all four. I2 E5
10. *(Withdrawn: 1.1–1.4 end About with "Learn →", so it is the template.)*
11. **Recommend: apply the shared-card fixes below (items 12–14 and 18) to section 3 only for now.** Those cards come from shared code that also draws on 4.x, 5.1 and the frozen steps. A tool-wide fix would change steps nobody has walked yet. I2 E4

### Section 3 template (uniformity)

12. **"Affected people" card on 3.1–3.4: DELETE.**
    - Current (3.1 on getiamai (fixture)): "Satisfied · 1 ▸ Affected people · 9 accounts · 1 guest · These are the accounts this step asks you to review. Check the listed evidence before deciding what each account needs."
    - It lists no evidence and section 1 has no such card. It repeats Impact in different numbers: 3.2 on demo (fixture) shows "3 active people · 3 admins · covers 4 enabled" beside an Impact of "4 accounts". I4 E4
13. **"Existing coverage" card on Completed 3.1, 3.3 and 3.4: DELETE.**
    - Current: "Existing coverage · In place · IAMAI found an existing control that meets the assessed goal. Keep it unless a separate reviewed change is needed."
    - None of these steps has a control. When 3.4 completes through Turn On Without Them, the card adds "IAMAI could not read whether the people it covers can satisfy it: …". I4 E4
14. **Satisfied cards state their fact (template rule 6).**
    - Today they read "In place · No change needed." (3.1, 3.2, 3.3, 3.5, 3.6) or "In place · Nothing left to do." (3.4).
    - 3.1: "{n} kept · {m} disabled".
    - 3.2: "No admin signed in to Outlook or Teams in the last 30 days."
    - 3.3: "Signed in with it on {devices}, {date}."
    - 3.4: "{ready} of {total} people ready".
    - 3.5: the matched strength's name.
    - 3.6: "Head office · 203.0.113.0/24 · {n} sign-ins from it in the last 30 days".
    - 3.7: "Core - Exception - Service accounts · {n} members". I3 E3
15. **A second engine card on 3.5 and 3.6: DELETE.**
    - 3.5: "Authentication Strength · Matching strength missing · No scanned strength matches all required method combinations and restrictions. Create Modern MFA + TAP using the instructions below, then scan again." When Completed it reads "Exact match found · … IAMAI uses that existing object automatically."
    - 3.6: "Trusted Network · Confirmed locations found · Each selected location must exist as a trusted IP named location in the scan."
    - Each repeats the step's first card with different capitals. 3.6's is replaced by the fact card in item 14. I4 E5
16. **Impact is a count.**
    - 3.1 on a Completed step with nothing left: "Inactive accounts" → "no accounts".
    - 3.2: every role holder ("4 accounts" on demo (fixture)) → only the admins seen on Outlook or Teams ("2 accounts"). The zero-state label "Administrator accounts" goes.
    - 3.5: "Authentication strength" → "N policies", the plan's policies that require it.
    - 3.6: "Trusted network" → "N policies", the plan's policies that wait on it.
    - 3.7: "Service accounts" → "2 accounts" on demo (fixture). I4 E4
17. **Rail: the instruction goes in its slot, and headlines name the action.**
    - 3.1 and 3.4 take a choice but have no instruction line. 3.1's instruction is drawn under the controls, hard-coded in English: "Disable the rest in Entra, then scan again."
    - 3.1 → "Select the accounts you are keeping, then select Done. Disable the rest in Entra."
    - 3.4 → "Pick anyone not ready who can't register soon, such as someone on leave: the policies go ahead without them." This replaces the picker's own help text.
    - Headlines "Set up the authentication strength / trusted network / service accounts group" → "Create the …", as section 1's "Create an emergency account". I3 E4
18. **Badge "Ready · Review" on 3.3 and "Ready · Create" on 3.4 → "Ready".** 3.3 has nothing to review and a campaign creates nothing. The cause is planLanes.ts:445, which turns every Check step's "Create" into "Review". I3 E4
19. **One procedure in every state.**
    - When Completed or Deferred, 3.1, 3.2, 3.6 and 3.7 switch to a second, differently worded copy (content.json whatToDo.steps). For example, 3.2's copy ends "→ the role → Add assignment."
    - When Completed, 3.5 switches to two hard-coded lines (stepBody.ts:523): "An existing authentication strength already matches the baseline's method combinations and restrictions. No new strength is needed." / "Keep that strength in place. Scan again after any authentication-strength changes to verify it still matches."
    - AI Info's "What to do" reads the second copy on every step.
    - Proposal: the procedure from the step's content folder stands in every state. DELETE whatToDo.steps and the stepBody override. I4 E3
20. **Section 1's first and last task lines.**
    - Today: "Go to **Entra admin center → …**" (3.5, 3.6, 3.7), and endings "Rescan in IAMAI." / "Rescan in IAMAI and check that an expected sign-in…" / "Create the group and rescan IAMAI before changing the policies that use it." 3.1 has no closing line, and 3.3 gives a bare URL.
    - Proposal: first line "Open [Microsoft Entra admin center](https://entra.microsoft.com/) → **…**", last line "Return to IAMAI and select **Scan to update the plan**." 3.3 links "Security info" as 1.1 does. I2 E5
21. **Troubleshooting.**
    - 3.1's appears only after Completed and reads "…or the required activity data could not be read; then: Save an explicit disposition and rescan."
    - 3.5's three scenarios are about correcting a strength that already exists.
    - 3.6's "Graph returns 403" and 3.7's "Adding a member to a newly created group returns 400…", "A membership removal URI omits `/$ref`" and "Graph returns 403 for group membership" serve tabs that are going.
    - Proposal: DELETE all of these. 3.2's handover scenarios show while the step is open, not only after it completes. I2 E5
22. **Picker suggestions are just the first three rows in list order**, on 3.1's keep picker and 3.4's Turn On Without Them. No fact supports them. Proposal: no suggestions. 3.1's options show each account's last sign-in ("No sign-in on record" / "Last signed in Feb 24, 2026"). I3 E4
23. **Hard-coded English that survives the items above moves to content.json:** 3.1 "Accounts you are keeping", 3.4 "Open MFA Readiness", and 3.6 "Saved office network: {name}. Public IP ranges: {ranges}." (stepBody.ts:517). I1 E5
24. **Lines only synthetic fixtures reach: DELETE, with nothing in their place.**
    - 3.1: "Sign-in activity · Not Fully Read · Sign-in activity could not be read for 3 of 11 enabled accounts…", and its blocker.
    - 3.4: "Readiness · Not measured · None of the 34 people in scope could be judged…".
    - 3.5: "Configuration not read · The scan did not read authentication strengths…". I3 E4

### 3.1 Disable or Confirm Dormant Accounts

25. About: "IAMAI lists an account with no successful sign-in for 90 days; Microsoft calls 90 to 180 a reasonable window. A blank record is not proof of disuse: the directory keeps sign-ins only so far back, and never fills the gap in later." → "IAMAI lists each enabled account with no successful sign-in in the last 90 days." I3 E5
26. Card: "Not reviewed yet · Review each account with its owner and record the outcome." → "{n} accounts to disable or keep · Follow Disable or keep each account in Implementation Tasks." {n} counts the accounts still open: 7 on getiamai (fixture) after two are kept. I3 E3
27. Rail headline and task title: "Review each account" → "Disable or keep each account". I2 E5
28. Rail controls:
    - "Why they are kept" (text field) and "Save": DELETE, so the picker's Done saves the keeps. Today Done silently saves nothing while the field is empty, and IAMAI never reads the words.
    - "None of these are disabled yet." / "1 of these are already disabled.": DELETE. The first is always true on an open step and false once every account is disabled; the second is a grammar error. I5 E4
29. On a Completed step with nothing listed, the rail still draws an empty picker, the field, the status line and Save. Proposal: draw nothing, so it reads "Next milestone · Completed" as 1.2 does. I4 E5
30. Task list: "Accounts to review (9): Alex Morgan (user2@getiamai.example.com), Kai Brown (guest, …), …" → "Dormant accounts (9):", one account per line with the last sign-in the scan holds ("Alex Morgan (user2@getiamai.example.com) · no sign-in on record"). List only accounts still open; kept accounts stay on the list today. I4 E3
31. Task lines:
    - DELETE "Review each account IAMAI lists with its owner before changing it."
    - "An old or missing sign-in record is a reason to investigate… Record one outcome for each account:" → "For each account:". The three choices after it are numbered as if they were steps.
    - "No longer needed: disable sign-in, … Account enabled: No. Do not delete the account or remove mailbox data." → "Not needed: as at least a User Administrator, open … → Users → the account → Edit properties → Settings, clear Account enabled, and select Save."
    - "Still needed: confirm its purpose and owner, and verify legitimate use. …" → "Still needed: select it under Accounts you are keeping, then select Done."
    - DELETE "Shared mailbox or resource account: … it then stays listed under Inventory and nowhere else." I3 E4
32. Completion Criteria: "Each listed account is disabled, blocked from sign-in, or shows a successful sign-in on a later scan." → "Each listed account is disabled, signs in again, or is one you keep." DELETE "An account you keep has a confirmed owner and purpose; IAMAI lists it again while it stays inactive." Both halves are false: IAMAI checks no owner, and a kept account does not reopen the step. I4 E5
33. AI Info: "…a missing or old record can mean the account is unused, that its activity predates the retained history, or that activity data could not be read. For each account the outcomes are: keep it for a confirmed purpose and owner; …" → "…For each account: disable sign-in if nobody needs it, or keep it. This step does not delete accounts, remove licences or change mailbox data." The account list marks kept accounts "· kept". I3 E4

### 3.2 Use Separate Accounts for Admin Work

34. About: "Personal email is phished constantly, so the account that opens mail should not also hold a directory role. … before taking access off the everyday one." → "Email is phished constantly, so the account that opens mail should not also hold an admin role. Move the role to an account that does nothing else, and test it before taking the role off the everyday one." I2 E5
35. Rail headline: "Test the new admin account, then move the role." → "Move each admin role to a separate admin account". I3 E5
36. DELETE:
    - The card line "Review active and eligible administrator accounts. If they are already dedicated to admin work, record that outcome. …"
    - Task line 1 "Review the listed active and eligible administrator accounts. Record Already dedicated to admin work when that is true. …"
    - Filler in the task: "Cloud-only keeps the role clear of a compromised on-premises directory.", "The admin policies require a method that meets their authentication strength." and "This is the moment to count: Microsoft asks for fewer than five Global Administrators, …". I4 E5
37. Completion Criteria: "The reviewed privileged accounts are confirmed as dedicated to administrator work, or each recorded handover has a tested replacement…" → "No account that holds an admin role, other than the emergency access accounts, has signed in to Outlook or Teams in the last 30 days." DELETE "Mailbox licensing and past mail or Teams activity are clues for the review; their absence does not prove separation." I4 E5
38. AI Info: DELETE the Focus sentence "Historical mail or Teams events do not mean a completed migration failed." "Who this touches: 3 active people · 3 admins · covers 4 enabled" follows the new Impact. I1 E4

### 3.3 Register Your Own Passkey

39. Caption under the title: "Do this before the registration campaign, so you have done what you are about to ask others to do." DELETE; the template allows no caption. I3 E5
40. About: "Test your own strong sign-in method before the rollout depends on it. A registered passkey is only useful if you can actually use it on the device needed for admin work." → "Your account makes every change in this plan, and Require Phishing-Resistant MFA for Admins will cover it. Register a passkey and sign in with it now; Prepare Your Team for MFA starts once you have." I3 E5
41. The card and rail stay "Not registered yet" / "Register your passkey" even after a passkey is registered and used on one device.
    - Proposal: name the account ("Kai Brown (user0@getiamai.example.com)") and follow the readiness IAMAI holds.
    - No passkey: "Not registered yet" / "Register your passkey".
    - Registered, not used: "Registered, not signed in with it yet" / "Sign in with your passkey".
    - Used on one kind of device: "Signed in with it on your computer, not yet on your phone" / "Sign in with your passkey on your phone". I5 E3
42. Task lines:
    - DELETE "A passkey can only be registered within five minutes of a completed prompt, so an old tab is refused." Per Learn, Entra asks for a fresh MFA after five minutes; nothing is refused.
    - "…Either one is enough, and Microsoft recommends a security key for elevated privileges." → "Suggested: Add sign-in method → Passkey in Microsoft Authenticator. Or a key from 1.3's approved list."
    - "Sign out and sign in again with the passkey, so the record shows a phishing-resistant sign-in." → "Sign out, then sign in with the passkey on each device you use: {devices}."
    - DELETE "If the passkey is refused, open Configure Passkey Authentication and read three settings: …". 3.3 already waits on that step, and the scan checks those settings. I4 E4
43. Completion Criteria: "{operator} completed a phishing-resistant sign-in in the records." → "IAMAI sees {operator} sign in with a passkey or Windows Hello on each kind of device used in the last 30 days: {devices}." (goes with item 5). I4 E4
44. AI Info Focus: "Separate registration from observed use. State the evidence's date and limits; a method-class sign-in record may not identify the exact credential." → "Walk me through creating a passkey in Microsoft Authenticator, or registering an approved security key, and signing in with it on each device I use." I2 E5

### 3.4 Prepare Your Team for MFA

45. About: "Help people set up the sign-in methods they will need before the access policies change." → "Everyone the MFA policies cover needs a method those policies accept before they turn on: Microsoft Authenticator for most people, a passkey or security key for admins." Point the Learn link at how-to-mfa-registration-campaign; today it opens the combined-registration page. I2 E5
46. Card and headline: "Sign-in method setup · Not prepared yet · Help the selected people complete their sign-in setup." / "Help each person set up their method".
    - Card title → "{missing} of {total} people not ready" (demo (fixture): "10 of 30 people not ready").
    - Card detail names them when there are five or fewer ("Kai Brown (user0@getiamai.example.com) still needs a passkey."). Otherwise it reads "MFA Readiness lists each one and what they need." with an "Open MFA Readiness" link, which this step never draws today.
    - Headline → "{n} people still need a method". I4 E4
47. Follow-up card:
    - Heading "Follow-Up List" → "Turn On Without Them".
    - "Marked to turn on without them for now: Quinn Ivanova. The policies waiting on this step can go ahead once everyone else is ready or selected. Each person still needs a method: …" → "The policies go ahead without {names} once everyone else is ready. Give each a Temporary Access Pass when they can register."
    - On a Completed step the card folds under Satisfied; today it stays under Tasks Remaining. I3 E4
48. Task lines (1):
    - "Book ten minutes with each. Open https://aka.ms/mfasetup with them signed in." → "Anyone MFA Readiness lists with no method: book ten minutes, open https://aka.ms/mfasetup with them signed in, and register together."
    - "…use the approved Temporary Access Pass process…" → "If they can't sign in to register: Entra ID → Users → the person → Authentication methods → Add authentication method → Temporary Access Pass."
    - "Text or call only: register the new method and test it first. Retire an older method only through…" → "Anyone on text or call only: add Microsoft Authenticator beside it."
    - "Admins: a passkey or a hardware security key; either is phishing-resistant." → name them: {list:adminsNotReady}. I3 E5
49. Task lines (2):
    - "Send the email below to everyone else; send the admin note to the admins." ("below" is another tab) → first line "Send the Email tab's first message to everyone and its admin message to the admins."
    - "Have each sign in once more; the record shows it on the next scan." → "Have each sign in once with the new method."
    - DELETE "MFA Readiness lists each person's next step, grouped by what to do; start with its next check.", "A passkey campaign does not nudge guests, …" and "Scan to update the plan after each batch; the lists above shrink as people are seen." I3 E5
50. The step never says whether the campaign is on. The scan already reads the authentication methods policy, registration campaign included, but nothing uses that part. Proposal: above the campaign line, "Today: the registration campaign is {Microsoft managed | off | on, nudging {method} to {scope}}.", and drop the campaign line when it already matches. I3 E3
51. Completion Criteria: "Everyone in this step has a registered MFA method they can use." → "Everyone the MFA policies cover has a method they accept registered, or is on the Turn On Without Them list." "Every administrator has a phishing-resistant method." → "Every admin has a passkey or security key registered." I2 E5
52. Email:
    - "Subject: Prepare Your Team for MFA" (staff receive the admin's step title) → "Subject: Set Up Your Sign-in Method".
    - "We are preparing stronger sign-in requirements. Please follow the instructions below…" → "We're adding a second sign-in step for everyone. Please set up Microsoft Authenticator this week. Open https://aka.ms/mfasetup, choose Add sign-in method, pick Microsoft Authenticator and follow the prompts. Then sign out and sign in once with it. Contact IT if you get stuck."
    - The admin and follow-up messages are shortened the same way. I3 E5
53. AI Info:
    - DELETE "Devices, from Decide How Devices Are Managed, one line per person: …". It is not about MFA registration and names a step no longer on the plan.
    - DELETE "…without claiming a campaign object is required or already configured".
    - The group lines follow MFA Readiness's phishing-resistant groups, not this step's count. On getiamai (fixture), "2 people with no phishing-resistant method; set up a passkey in Microsoft Authenticator: Kai Brown, Jordan Kim" includes Jordan Kim, whom the step counts as ready. Group only the step's own not-ready people, by what each needs. I3 E3

### 3.5 Create the Baseline's Authentication Strength

54. About: "An authentication strength defines the methods a policy accepts. Creating the right one keeps related policies consistent and makes any temporary sign-in options explicit." → "Create Modern MFA + TAP, the authentication strength the baseline's policies require, so those policies can be created in your tenant." Point the Learn link at concept-authentication-strength-advanced-options, which has the create procedure. I3 E5
55. Data error: AI Info says "Select exactly: Windows Hello for Business · Passkeys (FIDO2) · Certificate-based authentication (multifactor) · Temporary Access Pass (one-time) · Temporary Access Pass (multi-use). Nothing else."
    - The Entra tab and the pin's current definition (2026-08-12) have four methods, without multi-use Temporary Access Pass. A strength built from AI Info never matches.
    - Fix at the source with item 19. The same outdated five-method list is in who.none, aiFocus ("both TAP variants" → "each allowed method"), META targetAllowedCombinations, readiness.model, email.admin-change and walkContent.mjs:137. I5 E4
56. Card line: "Create an authentication strength holding exactly the baseline's method combinations, so every policy that requires it accepts the same methods." → "Create Modern MFA + TAP with exactly the methods the task lists." I2 E5
57. Task lines:
    - "Click + New authentication strength." → "Select **New authentication strength**."
    - DELETE "Do not select any other methods." ("exactly" already says it).
    - "Review and Create." → "Select **Next**, then **Create**."
    - First line's "It takes the Security Administrator role, and it is not under Conditional Access." → "as a Security Administrator" (form in item 20). I2 E5
58. Completion Criteria: "An authentication strength named "Modern MFA + TAP" or an equivalent strength matches the baseline's required method combinations and restrictions. IAMAI detects the match automatically." → "An authentication strength in your tenant allows exactly Windows Hello for Business, Passkeys (FIDO2), Certificate-based authentication (multifactor) and Temporary Access Pass (one-time use)." The method list is filled from the baseline, so it cannot drift from the task. DELETE "Every policy already using the strength still accepts the methods its users rely on." I3 E4
59. AI Info:
    - DELETE the request body's "description": "IAMAI pinned-baseline authentication strength". The field is optional in Entra, and this would write IAMAI's internal wording into the tenant.
    - "When a Temporary Access Pass option is accepted, this strength is not the same as…" → "Because it accepts a Temporary Access Pass, it is not Microsoft's built-in Phishing-resistant MFA strength." I1 E5

### 3.6 Define the Trusted Network

60. Row: before 2.3's office question is answered, 3.6 already reads "Ready · Create · Est. Aug 31, 2026".
    - On demo (fixture) it asks for a new "Core - Trusted - Head office" beside the "Head office · 203.0.113.0/24" location the tenant already marks trusted. Meanwhile 5.1, on the same board, waits for that answer.
    - Proposal: hold 3.6 on the office answer as 5.1 is: "On Hold · Decide How and Where People Sign In · Waiting on your answers", with no date. I4 E4
61. A picked location that is not marked trusted gets the create task ("Not in place · …create the named location…"), even though 2.3's picker lists every IP location. Proposal: "Ready · Correct" with one task: "Open **{location}** in Named locations." / "Select **Mark as trusted location**, then **Save**." I3 E3
62. About: "Some policies apply differently on a trusted network. Confirming the public addresses prevents an unrelated office, VPN or shared provider address from receiving that trust." → "Some policies on your plan treat sign-ins from your office differently. This step puts the office's public IP addresses in Entra as a trusted location." Card line: "Confirm the office's public IP ranges with the network owner, then create the named location and mark it trusted." → "Create the office's IP ranges location in Entra and mark it trusted." I3 E5
63. On a Completed step, "Sign-ins From This Location · Not Fully Read · Head office: No sign-in in the recorded window names this location. Confirm its current office ranges with the network owner." sits as an open task. The step card reads "Nothing IAMAI could read here needs a change. It could not verify Sign-ins From This Location, …".
    - The scan checked every sign-in it collected, so zero is a fact.
    - Proposal: the fact moves to the Satisfied card (item 14): "No sign-ins from Head office in the last 30 days." I5 E3
64. On a Completed step with one static IP: "Address Redundancy · Needs Correction · Head office: 198.51.100.7/32 is the only address in the location". DELETE: a one-IP office is correct and common, and this shows as an open task on a Completed step. I4 E4
65. Task lines:
    - DELETE "Confirm the public IP ranges with the network owner before adding them. An address seen in sign-ins, or from a "what is my IP" check, is not approval. Do not use private LAN ranges: …"
    - "Add only the approved public ranges in CIDR notation, including VPN exits only where the network owner has approved that trust. Entra accepts only masks greater than /8, …" → "Add {ranges}." when 2.3 saved ranges (today they appear as a separate "Saved office network: …" line), otherwise "Add the office's public IP ranges in CIDR notation."
    - "Check "Mark as trusted location."" → "Select **Mark as trusted location**." I3 E4
66. Completion Criteria: "An IP named location in the tenant holds exactly the public ranges the network owner approved, and it is marked as trusted." / "The sign-ins that should match it do, without widening a range to make them." → "The office location you picked in Decide How and Where People Sign In is an IP ranges location marked trusted." I3 E5
67. AI Info:
    - "Accounts IAMAI observed: Head office · 203.0.113.0/24 · 1 sign-in matched" lists locations under the accounts label (aiGrounding.ts:224) → "Named locations IAMAI observed:".
    - DELETE "If nobody works from an office (fully remote, no VPN), you can mark this step as "Doesn't apply here.""
    - DELETE "Contoso Pty Ltd has no Conditional Access policy names to follow, so this is the documented pattern." (the same line is on 3.7). I2 E4

### 3.7 Create or Correct Service Accounts Group

68. About: "Unattended jobs may use accounts that cannot complete a person's sign-in prompt. A reviewed group makes those exceptions visible and easier to maintain." → "Block Legacy Authentication and Restrict Service Accounts to the Trusted Network wait on this group. It holds the service accounts you picked in Identify Service and Shared Accounts." I2 E5
69. Card: "Service accounts group · Not in place · Create the group and add only the accounts an application owner confirmed run unattended." → "Create Core - Exception - Service accounts with svc-mailer-1 and svc-mailer-2." (demo (fixture)). I3 E5
70. Task lines:
    - "Add only the service-account users whose application owners confirmed them: svc-mailer-1 (…), svc-mailer-2 (…). Any account named as a mail-sending device in Confirm What You Use is already on that list." → "Under **Members**, add **svc-mailer-1@demo.example.com**, **svc-mailer-2@demo.example.com**." (1.2's wording).
    - DELETE "Do not add service principals or managed identities. A policy scoped to users does not block a call made by a service principal, …". I3 E5
71. Completion Criteria: "The group holds exactly the user accounts confirmed as running unattended jobs, the mail-sending devices named in Confirm What You Use among them." → "Core - Exception - Service accounts holds exactly the accounts you picked in Identify Service and Shared Accounts." DELETE "Each member's workload owner confirmed it runs unattended and no person signs in with it." I4 E5
72. AI Info grammar: "For svc-mailer-2: these sign in with a password over a script; move each to a service principal or managed identity when you can, and until then keep it in this group." → "svc-mailer-2 signs in with a password from a script: move it to a managed identity or service principal when you can." I2 E5

### Later steps (frozen, noted only)

- 3.2: 4.3 Require Phishing-Resistant MFA for Admins carries "see Use Separate Accounts for Admin Work: {list:adminsWithWorkload}". That belongs to 4.3's own audit, and it will agree with 3.2 once item 1 lands. 5.4 and the section 7 admin-session step carry the same line: later steps.
- The Workflow Check form stays for 5.1 (its audit) and for later steps. Its "1 accounts still need a recorded outcome" and its Required Roles list showing Global Administrator twice affect those steps.
- 3.4 puts Follow-Up tiles on the policies it releases: Require MFA for Everyone, Require Phishing-Resistant MFA for Admins, 5.1 and the risk policies. Later steps.
- 3.5 puts a prerequisite tile on each policy it releases (section 4 onward). Later steps.
- The shared cards in item 11 still draw on 4.x, 5.1 and the frozen steps.


## Section 4 Turn On MFA for Everyone (4.1–4.6): APPROVED (owner, 2026-09-24), with my recommendations and these changes
- **1:** fix 4.3's completion, but do NOT state the Modern MFA + TAP weakness anywhere ("adds MORE fluff"). Delete the "Baseline Grant · Weaker than phishing-resistant MFA" card, and item 41's About has no weakness sentence.
- **L1–L3:** yes.
- **5:** option (b).
- **10:** without the Turn On Without Them part.
- **14–18, 25 and 29:** apply on every policy step, through shared code.
- **Owner's emphasis:** the content itself gets the most scrutiny. Every line must read well and give a useful instruction, or be removed.
From the section 4 audit (six auditors plus a synthesis, fixtures), with the live walk of 4.1–4.4 on the owner's tenant (2026-09-23) prepended as L1–L4.

### Found live on the owner's tenant (not visible on fixtures)
- **L1 (I5 E4). IAMAI reads the tenant's own policies as unreadable.** Graph returns them with a full strength object and empty fields (insiderRiskLevels, applicationFilter). Everything reading them turns "unknown": 4.3 and 4.4 "Readiness · Not measured · … could not be judged: method compatibility is not established", "Affected people · Not established", and 3.4 listing both people as needing help, while MFA Readiness says 2 of 2 ready. Fix built on fix/decoder (operations.ts effectOf): skip empty fields and read the strength by id. On an owner-like clone, 4.3 reads 1 of 1 admin, 3.4 reads 2 of 2, and 4.4 reads real counts. No fixture changes, because fixtures write IAMAI's own shape.
- **L2 (I4 E3). One reading of role scope.** PIM-eligible admins count for readiness but not for Affected people or the admin count. Count eligible admins everywhere.
- **L3 (I5 E4). A Completed step carries no prerequisite card.** "Verify Emergency Access · Prerequisite · To do · This step is finished, and …" shows on 4.1–4.4 on the owner's tenant. It is the same mechanism as item 2's first bullet (lanes.ts completedWithout).
- **L4. 4.4's gate counts enabled accounts that never signed in**, unlike 3.4 and MFA Readiness. It is the same root as item 10.


These readings come from fixtures (getiamai, small, mid, demo, demo-week2), not from your tenant. On the fixtures the exclusions group is called "Core - Exclusions"; on your tenant it is Breakglass Exclusion.

**Numbering:** Turn Off Security Defaults only appears when a scan has read security defaults on. Where it doesn't appear (your tenant, getiamai, demo), Finish Moving Off Per-User MFA is numbered 4.5 instead of 4.6.

**Coverage:** the 4.4 audit stopped after its row, and no audits arrived for 4.5 or 4.6. I audited the rest of 4.4 and all of 4.5 and 4.6 myself with the harness.

### Needs your call

1. **Recommend: 4.3 reads Completed once its policy is On exactly as the plan wrote it.**
   - Following the plan exactly (create, report-only week, drill, turn on) leaves 4.3 stuck at "On Hold · Not supported". It shows "Threshold · not measured", "Implementation · Unavailable", "Not supported · Not supported", Impact "Administrator Accounts" and "A later scan finds the goal in place, or you record that this step does not apply here."
   - Root cause is in generate.ts. The goal floor treats the pinned Modern MFA + TAP grant as a gap, although your R4-11 ruling says to state it, not hold on it. With no operation left there's no cohort, so readiness is never measured.
   - Fix both parts. Impact then reads "1 admin". mid and demo-week2 only reach Completed through their own policies. I5 E2
2. **Recommend: a Completed step shows no open cards.** This is the root cause of your 4.3/4.4 note. Both steps are correctly Completed because the policy is On. The problem is three kinds of card left under Tasks Remaining:
   - "Prepare Your Team for MFA · Prerequisite · To do · This step is finished, and Prepare Your Team for MFA, which the plan puts before it, is not finished yet." (stepContract.ts:2436, on 4.1–4.4). DELETE: that step's own row carries the work.
   - "Readiness · 19 of 28 people in scope · This policy is enforced, and…" (4.3, 4.4). Move it under Satisfied as "19 of 28 people have a method it accepts". On demo-week2 this card also names "Phishing-resistant MFA readiness" for 4.4, whose policy only requires plain MFA, and says "Method compatibility is not yet established for 1."
   - "Observation · No report-only period watched…" (a policy created straight On). Move it under Satisfied as "On since Aug 29, 2026, without a report-only week". That keeps the warning you asked for on 2026-09-22. I5 E4
3. **Recommend: delete 4.2's Workflow Check and let the scan complete the step.** This is why your 4.2 reads "Ready · Review" with Enforced.
   - manualWork.ts:68 keeps a matching, enforced policy open until someone saves "Outcome" and "Tested On".
   - Delete it along with everything it brings: Impact "Device Code Sign-ins", When "Review now", "Test the required workflow and record its outcome.", "Your review · Waiting on you", the three "Verify the workflow:" task lines and "Tools, shared devices and enrollment workflows that used device code have a tested alternative."
   - 5.1 has the same form. I5 E4
4. **Recommend: delete 4.1's mail Workflow Check and complete the mail half from sign-in data.**
   - When 2.1 names mail senders (small, demo, demo-week2), the rail holds "Workflow Check · Mail Job and Delivery Route · Temporary Exception Removed · Outcome · Tested On · Save Check" plus "Your review · Waiting on you".
   - 4.1 then never completes: demo-week2 reads Ready · Review in every state.
   - Proposal: the mail half is done when no named account has signed in with legacy authentication in the last 30 days. This changes a completion rule. I5 E2
5. **Recommend: stop saying the service-accounts group keeps mail senders out of 4.1, and hold the turn-on until they have moved instead.**
   - The pinned legacy policy never excludes that group. On demo, with svc-mailer-1 and svc-mailer-2 named in 2.1, the target excludes only Core - Exclusions and Core - Break glass.
   - Three places still claim or assume it does:
     - 4.1's turn-on waits on 3.7 (dependency-data.json).
     - The mail task says "Until each device moves, Create or Correct Service Accounts Group keeps these accounts out of this policy."
     - 2.x #31 says "Block Legacy Authentication leaves them out until each moves to a supported mail route."
   - Turning 4.1 on as it stands blocks those devices. Two options:
     - (a) Exclude the group whenever 2.1 names accounts. This adds to the pinned policy, so it needs your consent.
     - (b) **Recommended:** drop the 3.7 wait, delete the sentence, and have 2.x #31 read "…Block Legacy Authentication waits until each moves to a supported mail route." I5 E3
6. **Recommend: the mail question gets one wait, shown the same way everywhere.**
   - On small and mid, 4.1 reads "Ready · Decision · Waiting on your answer: Mail-sending devices · Decide now", with the card "Mail-sending devices · Not confirmed · A quiet sign-in history does not establish that every scheduled mail job has stopped using basic authentication."
   - getiamai shows the same wait as "On Hold · Waiting on your answers".
   - Proposal: an input answered on a Direction step never creates a decision lane or tile on the step it changes. That step shows 2.x #18's wait tile, and the card is deleted. I4 E3
7. **Recommend: only one step asks for each policy edit, and making it is never flagged.**
   - When the tenant's enforced legacy policy lacks the exclusions group, 1.2's "Configure Conditional Access exclusions" and 4.1's "Update the policy settings" ask for the same edit.
   - Once it's made, 4.1 reads Completed next to "New evidence · Review required · the policy itself changed by Aug 28, 2026: what was watched before this is no longer what is deployed".
   - Proposal: 1.2 keeps the task, and 4.1 waits on it. A change that brings a policy to its own target never raises Review required. I4 E3
8. **Recommend: 4.5 includes the four turn-ons in its own task.**
   - The four policies' turn-ons wait for security defaults to be off, and 4.5 waits for those four to be ready. So once someone has saved "Disabled", every turn-on task stays hidden until the next scan.
   - Meanwhile 4.5 only says "Right after saving, enable Require MFA for Everyone, … in the same change window, then test sign-in."
   - Proposal: end 4.5's task with one line per policy: "Open **{policy}**, set **Enable policy** to **On** and select **Save**." I4 E3
9. **Recommend: 4.6 reads Completed when the work is done, instead of disappearing.**
   - The step only exists while some per-user state reads Enabled or Enforced (generate.ts:1447). Once they're all disabled, the next scan drops it from the plan.
   - Proposal: record the first scan that read per-user MFA on, as 4.5 does for security defaults, and read Completed from any clean read after that. I4 E3
10. **Recommend: dormant accounts stop holding 4.4's 90% gate forever.**
    - On getiamai and small the gate counts enabled accounts nobody signs in with. It says: "“Prepare Your Team for MFA” will not move this number: none of the 9 people it is waiting on are in that step's list, because IAMAI has not seen them sign in. Until they sign in and register a method, or you decide those accounts are not in use, this number cannot reach 90%."
    - Disabling those accounts (3.1's action) cleared the gate on small.
    - Proposal: "{n} accounts haven't signed in for 90 days and have no method: {names}. Disable them in Disable or Confirm Dormant Accounts."
    - Counting an account kept in 3.1 as "Turn On Without Them" would change how the gate counts, so that part is your call. I4 E3
11. **Recommend: the report-only week reads as a wait, not a stop.**
    - Today a policy's planned week reads "On Hold · Observing" in stop red, and the next state reads "Ready · Ready to enforce".
    - Proposal: "Up Next · Report-only until Aug 31, 2026", then "Ready · Turn on".
    - These are shared lane words, so frozen steps change too. I3 E3
12. **Recommend: reuse a matching switched-off policy, and never suggest a "(2)" name.**
    - An Off "CA - Block - Legacy authentication" that already matches the target makes 4.1 propose "CA - Block - Legacy authentication (2)". 4.2–4.4 behave the same, and 5.1 is already noted.
    - Root cause: generate.ts:1049 uniqueName, and a first scan never claims a disabled policy.
    - Proposal: treat that policy as the step's own, with the task "Set the policy to Report-only". I4 E3
13. **Recommend: a stricter tenant policy counts as meeting 4.2.**
    - A policy that blocks device code and authentication transfer reads Ready · Correct, and tells the person to take authentication transfer out. That weakens a grant.
    - Seen only in a fixture variant (auditor-reported). I3 E3

### Section 4 template (uniformity)

14. **Every create names its Include and Exclude outright.** All four fail your standing check today.
    - 4.1 and 4.2: "Configure exactly this intended scope: **Users: All users** with the exclusions IAMAI resolved…"
    - 4.3: "include exactly the built-in directory roles resolved from the baseline, and apply the intended exclusions."
    - 4.4: "Apply the IAMAI-resolved assignments exactly as the settings below them read… Exclude the resolved exclusions and nobody else."
    - Proposal: "Under **Users**, include **All users** and exclude the group **Core - Exclusions**." For 4.3 the Include is "**Directory roles**: {the 46 roles}". Then one line each for Target resources (4.4 adds "exclude **Microsoft Intune Enrollment**") and Grant (4.3: "**Require authentication strength** → **Modern MFA + TAP**"). I5 E4
15. **Every correction names its values and changes only what differs.**
    - Today it says "add the exclusions group you confirmed in Configure Emergency Exclusions" and "(the includeRoles list in the JSON output)", with "make sure" lines for settings the scan already passed.
    - On 4.2 variant b, a same-name policy scoped to one group keeps that scope.
    - On 4.3 variant A, the grant-only correction never adds the missing exclusion.
    - Proposal for demo 4.4: "Under **Users → Exclude**, add the group **Core - Exclusions**." / "Under **Target resources → Exclude**, add **Microsoft Intune Enrollment**." / "Select **Save**." I5 E3
16. **One procedure layout, in section 1's words.**
    - First line: "Open [Microsoft Entra admin center](https://entra.microsoft.com/) → **Entra ID → Conditional Access → Policies → New policy**." Today it reads "Open **Entra ID > … > New policy**." or "Go to Entra admin center → (Protection →) Conditional Access". Separately, "Open the policy named X (ID: …)" → "Open **X**".
    - Add "Description: **{tag}**." after the name.
    - Last line: "Return to IAMAI and select **Scan to update the plan**."
    - DELETE on all four:
      - "Leave session controls unconfigured(; the intended target has none)."
      - everything after "Set **Enable policy: Report-only** and create it."
      - "Reopen the created policy, compare it with the intended target shown in IAMAI, then rescan." (4.3: "create, re-open, verify, and rescan")
      - "Left at **No**, the condition matches every client app…" (4.1)
      - "Two consequences to know before you create it: …" (4.2)
      - "Ticking every box instead…" (4.3)
      - "Do not substitute an authentication strength." (4.4)
      - "This policy already exists. The correction changes only…"
      - "Keep the policy's current state. If it is On, the changed rule can affect access after you save."
      - "Rescan in IAMAI to confirm the correction. Verify after the change: …"
    - I5 E4
17. **The turn-on task is two lines.**
    - Today it runs 10–13 lines: "Verify the same policy and its prerequisites…" / "Reopen the policy by its ID. Confirm…" / "Do not turn it on unless all of these are true now:" plus three conditions numbered as steps / "If any one of them is not true, leave the policy in Report-only. Then change **Enable policy** to **On** and save." / "Verify after the change: …" / "Rescan in IAMAI."
    - Proposal: "Open [Microsoft Entra admin center](https://entra.microsoft.com/) → **Entra ID → Conditional Access → Policies → {policy}**." / "Set **Enable policy** to **On** and select **Save**." I5 E4
18. **The same procedure in every state, for policy steps too.** 3.x #19 doesn't reach these code paths.
    - In report-only the task becomes "Keep the policy in Report-only while you review the evidence listed for this step. … No events in the available records does not prove there are no dependencies."
    - Once Completed it becomes "Open “{policy}” (id) — the policy IAMAI matched to this step — and check its assignments, conditions, access controls and state against Completion Criteria on this step." (stepResources.ts:210, hard-coded English). In those states the task and rail are titled with the step's own name.
    - Proposal: "Create the policy in Report-only" and "Turn the policy on" stay in every state. "Correct the policy" and "Set the policy to Report-only" appear only where they apply. The rail names the next task. I4 E3
19. **Delete the "Settings for This Action" fold.** It holds:
    - "Description: … — paste this exactly; it is how IAMAI recognises the policy it planned when it next reads the tenant."
    - "Users → Include: All users, Guest or external users → all types." Entra can't select both (portalLines.ts:132).
    - "Never exclude the emergency accounts directly; they are members of this group."
    - Leftover "Setting: …" labels.
    - I3 E4
20. **The policy card names the task, never "Blocked" or the step title.**
    - Today: "Blocked · Finish the steps this one waits on first."
    - "Blocked · Create the policy in report-only on Aug 31, 2026 (estimated); turning it on waits for MFA readiness to reach 90%." (4.3 and 4.4, while the badge says Ready · Create)
    - "Create the policy in Report-only · Create the policy in Report-only."
    - "Require MFA for Everyone · Continue observation and collect the missing evidence. Review from Sep 4, 2026."
    - "…the instruction that turns it on comes back then."
    - "…which leaves the 1 working day of notice a change this size asks for."
    - Proposal: "Create the policy in Report-only" / "Report-only until Sep 4, 2026" / "Turn the policy on · Report-only blocked no one. After Verify Emergency Access." I4 E4
21. **Delete two report-only cards:**
    - "Observation · Until Aug 31, 2026 · This is the earliest review date, not a scheduled automatic enforcement." (all four steps)
    - "Implementation · Unavailable · Running this would change what Fixture small's people have to do straight away…" on a policy that is only in Report-only (4.3, 4.4)
    - I3 E5
22. **Satisfied cards state their fact.**
    - "In place · This is in place already: nothing to create. Keep the policy as it is." becomes, for example, "On · Requires MFA for All users except Core - Exclusions" (4.4) or "On · Blocks Exchange ActiveSync and Other clients for All users except Core - Exclusions" (4.1).
    - 4.5's "In place · No change needed." becomes "Off". I3 E4
23. **A prerequisite card never contradicts itself.**
    - "Prepare Emergency Access Accounts · Prerequisite · Completed · Finish Prepare Emergency Access Accounts first." shows whenever 1.2 is open, because the emergency-access set check is filed under 1.1's id (generate.ts:1526). File it under Configure Emergency Exclusions instead.
    - Delete the note "Finish {step} first." everywhere. I4 E4
24. **Each problem gets one card, with its fix.**
    - Drift shows four cards for one change: "Review required · IAMAI does not write this change…", "New evidence · Review required…", "Review · … find out what changed on it, and why…", "Review · … IAMAI does not write that part". Proposal: one card, such as "Client apps changed · Set Client apps back to Exchange ActiveSync clients and Other clients."
    - A removed exclusion shows "Exclusions · Reaches emergency access · … fix the exclusions-group step, then scan again." plus a second card, "Baseline safety conflict · Baseline safety conflict", and no correction task. Proposal: "Emergency accounts not excluded · Add Core - Exclusions back under Users → Exclude.", with the task that does it.
    - The second card on a switched-off policy, "Implementation · Set the policy to Report-only · … not a new policy and not On: …", is deleted. I3 E3
25. **Impact is a count, never a label.**
    - Today some rows show labels: "Legacy Authentication" (4.1), "Device Code Sign-ins" (4.2), "Administrator Accounts" (4.3), "User Authentication" (4.4), "Tenant settings" (4.5).
    - Root cause: rowWho.ts IMPACT_TOPICS. Count the tracked policy's reach instead.
    - 4.3's "1 person · 1 would be stopped" becomes "1 admin". 4.5 reads "4 policies".
    - For 4.1 and 4.2, you choose between today's reach count and the number of people who used the flow in the last 30 days (see 33 and 38). I4 E3
26. **Completion Criteria is two lines, the same in every state.**
    - Today it has up to six lines that change by state:
      - "The required report-only period of 7 days is complete…"
      - "The available records show every active person…"
      - "A later scan confirms…"
      - "Verify after the change: review sign-in failures…"
      - "Representative users can satisfy MFA…"
      - "…today ready now: 0 failures in 8 days." (grammar error)
      - "Until a later scan finds the policy enabled, it is ready to enforce, not enforced."
      - "IAMAI watched no report-only period…"
      - "The scan found the assessed configuration in place."
    - Proposal: "IAMAI sees {policy} On, {what it does} for {Include} except Core - Exclusions." / "Its report-only week showed no sign-in it would have stopped." Drop the second line where the policy was found already On.
    - Keep "Verify after the change" only for policies turned on without a watched report-only week (your 2026-09-22 ruling). I4 E4
27. **Row sub-lines:**
    - "when MFA readiness reaches 90% (now 18%)" and "when admin readiness reaches 100% (now 66%)" start lower-case → "When MFA readiness reaches 90% (now 85%)" / "When every admin has a method it accepts (2 of 3)".
    - "Baseline safety conflict" → "Doesn't exclude Core - Exclusions".
    - 4.5's "Prerequisite on hold: Block Legacy Authentication" → "After Block Legacy Authentication".
    - I2 E4
28. **Row dates while a step is held:**
    - On 4.2, recording the drill moved the date later on the same day: "Est. Sep 8, 2026" became "Est. Sep 15, 2026".
    - 4.4's readiness-wait estimate moves with every scan (Est. Aug 31, then Est. Sep 7).
    - Proposal: show the later of the day the wait clears and the scheduled turn-on. I2 E3
29. **Tabs: keep Entra and AI Info; keep PowerShell and JSON only where they write** (create, correct, turn on).
    - DELETE the report-only and Completed "Invoke-IAMAIStep -Mode 'Observe'" and "$batch … read-only GET requests", and 4.5's and 4.6's GET scripts.
    - DELETE the Email tab on 4.1 ("Subject: Review Older Sign-In and Email Methods…") and 4.4 ("Subject: Stronger Sign-in Protection…", which repeats 3.4's email and still shows once Completed). I3 E4
30. **Delete Troubleshooting, as in 3.x #21:** 4.3's four scenarios, 4.4's "A user in scope cannot satisfy MFA / … Intune Enrollment / A second broad MFA policy… / Report-only shows failures…", and 4.5's "…Graph rejects the Security Defaults update". I2 E5
31. **AI Info on the four policy steps:**
    - The lead states the action with its values.
    - DELETE "No events in the available records does not prove…", "A registered method is not the same as a successful MFA sign-in, and few records do not show that everyone is ready." and "Do not infer…".
    - Focus → "Walk me through creating this policy in Report-only and turning it on after its report-only week."
    - "Excluded accounts: none: the resolved target excludes no individual accounts" → "Excluded accounts: none".
    - Show "Values shown as ‹…› are not resolved yet. Do not run this output." only when a ‹…› value is actually present.
    - "Who this touches: Policy applicability is not fully resolved…" → the count. I2 E4
32. **"Defer this step" never shows on a Completed step** (today it does on 4.1–4.4). I2 E5

### 4.1 Block Legacy Authentication

33. SOLVE: show who uses legacy authentication.
    - Today the only sentence naming them is inside the hidden Why dialog.
    - Proposal: a card "Legacy sign-ins · 3 accounts signed in with legacy authentication in the last 30 days: svc-mailer-1, svc-mailer-2, svc-mailer-3" (mid), or a Satisfied card "Nobody signed in with legacy authentication in the last 30 days." (getiamai). I4 E3
34. About: "Legacy authentication protocols cannot complete multifactor authentication… Exchange Online already refuses a password for POP, IMAP and ActiveSync… Review the clients and jobs still using one before that path closes." → "Legacy authentication can't ask for MFA, so a password alone gets through it. This policy blocks it for everyone except the emergency access accounts." I3 E5
35. A report-only week that would have blocked someone:
    - Today: "The records show 1 person this policy stopped while it was in report-only. Review them before enforcing: time elapsed alone does not complete this check." / "Continue observation and collect the missing evidence."
    - Proposal: "Report-only would have blocked Alex Morgan (user2@…). Move them to a modern mail app before you turn this on." with the title "Move the blocked accounts". I5 E3
36. Mail task:
    - Target "Devices named in the mail-sending answer" → the account names.
    - DELETE "Record each device's supported authentication and TLS options, the recipients it sends to, and a test window." and the false sentence from item 5.
    - The route line → "Move each device to SMTP AUTH with OAuth, an Exchange Online connector, or Direct Send (internal recipients only)."
    - The fold's "Exception account: 000f42a4-d8c7-…" (a raw id) → the account's name. I3 E4
37. Grammar and a hostile-only line:
    - "Also exclude the groups Core - Break glass." → "Also exclude the group Core - Break glass." ("the directory roles" has the same bug.)
    - DELETE "…no sign-in records could be read — …", which only the hostile fixture reaches. I2 E5

### 4.2 Block Device Code Sign-in

38. SOLVE: show who uses device code.
    - The card detail that repeats its own title ("Create the policy in Report-only.") → "No device-code sign-ins in the last 30 days." or "{n} people signed in with device code in the last 30 days: {names}."
    - This replaces every "does not prove it is unused" line. I4 E3
39. About: "Device-code phishing can persuade a person to approve a sign-in for someone else. Blocking this flow reduces that route of attack, but legitimate devices and tools need a checked alternative." → "Device-code phishing tricks a person into entering a code that signs an attacker in as them. Blocking device code sign-in closes that route." I3 E5
40. AI Info:
    - "It blocks Conditions → Authentication flows → Configure: Yes, then Device code flow for all users…" → "Create it in Report-only: it blocks device code sign-in for All users except Core - Exclusions, across all resources."
    - The correct lead "…differs from the intended target: conditions.canonical." → "…it doesn't exclude Core - Exclusions." I3 E4

### 4.3 Require Phishing-Resistant MFA for Admins

41. About: "Administrator access deserves stronger sign-in protection. Checking accepted methods…" → "Admin accounts can change everything in your tenant, so this policy makes every admin role sign in with a passkey, a security key, Windows Hello, a certificate or a Temporary Access Pass. That is the baseline's Modern MFA + TAP strength; the Temporary Access Pass makes it weaker than Microsoft's phishing-resistant strength."
    - DELETE the card "Baseline Grant · Weaker than phishing-resistant MFA · …": About now states it (R4-11). I3 E5
42. Threshold:
    - Today: "0% of admins ready for Modern MFA + TAP" / "66% of admins phishing-resistant" / "…it waits on “Prepare Emergency Access Accounts”, which is where to start."
    - Proposal: "0 of 1 admin has a method it accepts · Kai Brown (user0@getiamai.example.com) needs a passkey, security key or Windows Hello. Prepare Your Team for MFA gets them ready."
    - Name up to five people; beyond that, "MFA Readiness lists them." I3 E3
43. Operator card:
    - The same card is headed "Before turning on" in one state and "Prerequisites" in another, and reads "Your safe way in · when 1 safe way in for the signed-in account exists (now 0)".
    - Proposal: "Your account · No method this policy accepts · Kai Brown (user0@getiamai.example.com) holds an admin role and has no passkey or security key. Register Your Own Passkey fixes this before it turns on." I3 E4
44. Holds that are false or garbled:
    - "Stop: Prepare Your Team for MFA is not finished, and this policy is part of it." (content.json:3033; the policy is not part of that step) → "Wait for Prepare Your Team for MFA; leave this policy in Report-only until then."
    - "Running this would turn the policy on straight away…" on a report-only policy → "It turns on after Prepare Emergency Access Accounts."
    - "…the instruction being withheld is the one that turns the policy on…" on a policy that is already On → "It stays until every admin has a method it accepts (1 of 3 today)." I3 E4
45. Correction lines:
    - Grant: "…Its ID is **“Modern MFA + TAP” (004c4b41-…)**. … so review that effect before you save." → "Under **Grant**, select **Require authentication strength** → **Modern MFA + TAP**, and clear any other grant."
    - Session: "Remove session controls from this policy. Admin session duration…" → "Under **Session**, clear every control."
    - Name: "Rename the same policy (same policy ID)… Find it by its policy ID…" → "Name: **{name}**." I3 E5
46. AI Info:
    - "1 admin is not yet Ready for phishing-resistant MFA…" shows while the gate reads 100%. Build this line from the gate's own count.
    - DELETE "2 of them use the same account for mail or Teams; see Use Separate Accounts for Admin Work: …". That is 3.2's work.
    - Optional, your call: the name "CA - Require - Phishing-resistant MFA for admins" promises more than Modern MFA + TAP delivers. I3 E3

### 4.4 Require MFA for Everyone

47. About: "MFA makes a stolen password less useful. Reviewing who has a usable method—and who has actually used one—helps catch access problems before enforcement." → "A stolen password alone should never be enough to sign in. This policy asks everyone for MFA, the floor the admin and guest policies build on." I2 E5
48. Threshold detail:
    - Today: "23 of 27 people this step's policies include have a registered method those policies accept and this tenant lets them use. 2 of the 4 people without one would be counted if this tenant's Authentication methods policy allowed the methods they registered."
    - Proposal: "23 of 27 people have a method it accepts. 2 registered {method}, which your Authentication methods policy turns off."
    - The dormant-accounts half is item 10. I3 E3

### 4.5 Turn Off Security Defaults (only on tenants where a scan read security defaults on)

49. About: "Replacing Security Defaults gives you more control over access rules. The changeover needs care…" → "Security defaults and Conditional Access can't run together. Turn security defaults off on the day the four policies below turn on, so the tenant is never without MFA." I3 E5
50. Card and rail:
    - Today: "Security defaults · Still on · Security defaults and Conditional Access are not meant to run together, and the rule runs both ways: … Turn them off on that day and not before." That's about 110 words, and the rail repeats it.
    - Proposal: "Security defaults · On · Turn off the day the four policies below are ready to turn on."
    - DELETE the four cards' note "…needs to be ready to enforce first — not finished, just ready." I4 E5
51. Task:
    - DELETE "Check each policy that takes over: … must have run in report-only with no failures before you turn it on today."
    - "Entra admin center → Entra ID → Overview → Properties → Manage security defaults → Disabled (not recommended) → Save. You need at least the Conditional Access Administrator role." → "As at least a Conditional Access Administrator, open [Microsoft Entra admin center](https://entra.microsoft.com/) → **Entra ID → Overview → Properties → Manage security defaults**." / "Select **Disabled (not recommended)**, then **Save**." Then the four turn-ons from item 8.
    - Once Completed, the task switches to "…There is nothing to change on this step." / "…None of them is turned on from here.", which contradicts the open task. DELETE it (item 18). I4 E4
52. Completion Criteria: "Security defaults are off; Require MFA for Everyone, … are enforced." / "Test sign-in for representative users and admins right after the changeover." → "IAMAI reads security defaults as Disabled." I3 E5
53. Rollback advice and footer:
    - AI Info: "If it goes wrong: … Re-enabling Security Defaults may require changing active Conditional Access policies first…" → "If it goes wrong: set the policy that blocks sign-in back to Report-only. If you are locked out, sign in with an emergency access account." (Your rule: rollback advice says Report-only.)
    - The footer row on your tenant: "No scan of this plan has read security defaults on, so there is nothing to turn off." → "Security defaults are already off." I2 E5

### 4.6 Finish Moving Off Per-User MFA (4.5 where Turn Off Security Defaults isn't on the plan)

54. DELETE "Legacy Per-User MFA · Not fully read · The scan read no per-user MFA state, so every account in the directory needs a check: all 13 accounts, the emergency accounts included." and the Ready · Review confirm state it brings.
    - Every fixture reaches this only because the fixtures predate the per-user read. A real scan reads every account (collect/registry.ts:85). I3 E4
55. Two cards say the same thing:
    - "Per-user MFA states · Not in place · On the day Require MFA for Everyone enforces, and not before, disable every legacy per-user MFA state."
    - "Legacy Per-User MFA · 3 accounts Enabled or Enforced · Sam Patel, Morgan Brown, Jamie Singh"
    - Proposal: one card, "3 accounts on per-user MFA · Sam Patel, Morgan Brown, Jamie Singh". Drop "On the day … not before" once 4.4 is On; today it stays after 4.4 is Completed.
    - The badge "Ready · Create" becomes "Ready", as in 3.x #18: the step creates nothing. I4 E4
56. About: "An account left on Enforced is asked for MFA at every sign-in whatever the policy decides… Keep the existing protection until the replacement is actually enabled…" → "An account left on per-user MFA is asked for MFA at every sign-in, whatever Conditional Access decides. Turn it off for each account once Require MFA for Everyone is On." I3 E5
57. Task:
    - DELETE "Check first that every method these people use is enabled under … Authentication methods → Policies. That policy decides what they may register; it never requires MFA…"
    - Then: "As at least an Authentication Policy Administrator, open [Microsoft Entra admin center](https://entra.microsoft.com/) → **Entra ID → Users → All users → Per-user MFA**." / "Select **Sam Patel**, **Morgan Brown** and **Jamie Singh**, then **Disable MFA**." / "Delete any app password these accounts hold." / the scan line.
    - "Read each state back as Disabled" goes: the scan reads that. I4 E4
58. Completion Criteria and AI Info:
    - "…reviewed and disabled for the intended accounts after replacement protection is verified." / "Authentication-method policy migration is tracked separately; its completion does not prove…" → "IAMAI reads per-user MFA as Disabled for every account."
    - AI Info Focus → "Walk me through turning off per-user MFA for these accounts." I3 E5

### Later steps (frozen, noted only)

- The Workflow Check (POLICY_WORKFLOWS) is also on 5.1, which is next in the walk. The frozen guests MFA, device registration, Intune enrollment, PIM activation, medium user risk and service-accounts trusted-network steps have it too, so each reads Ready · Review.
- The shared code behind items 2, 7, 11, 12 and 16–28 draws on every frozen policy step. The entra.observe and entra.enforce blocks are written separately in each of about 40 packages, so items 17 and 18 have to land package by package or through one shared block.
- Every frozen policy's turn-on also waits on security defaults, but 4.5 names only four policies. Item 8 has to say what happens to the rest.
- Restrict Service Accounts to the Trusted Network also waits on 3.7: check it against item 5.
- laneBCore.ts:276 counts device-code sessions as authentication transfer (the frozen Block Authentication Transfer step).
- "see Use Separate Accounts for Admin Work: {list:adminsWithWorkload}" also appears on 5.4 and on section 7's admin-session step.
- 4.3's META.json and STEP.md still carry the old five-method list. Fix it together with 3.x #55.

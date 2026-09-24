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

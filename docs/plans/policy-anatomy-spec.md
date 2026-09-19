# One policy anatomy, and the By Area view: the spec (draft for owner review, 2026-09-19)

This is the proposal for `weekend-launch.md` Next item 5 and the step map §6. It gives every policy step the Emergency Access anatomy at once, and adds the "By Area" view (review item 23). Nothing here is built yet.

It follows the V1 standard (`v1-procedure.md` §3) and "intent over evidence".

**How to read the wording.** Text in "quotes" is what the code produces today, read from the demo fixtures on this tree (`319be111`). Text in «guillemets» is a proposed new string. Every proposed string becomes a `content.json` key.

**Scope.**
- In: the 24 steps whose content kind is `policy` (the 23 `s-goal-*` steps plus `s-shared-devices`), the Plan's view tabs, and the export, print and prompt-pack renderings of those steps.
- Out: the per-step words, which are reviewed wave by wave (waves 1–4 first). Emergency Access and Direction look the same after this build. The lane engine, the dates and the withholding rules don't change.

---

## 1. The anatomy

### What stays as it is

- **The head:** eyebrow ("Policy step"), title, the lane badge, the tenant-fact chip ("Report-only" / "Enforced"), the lifecycle track (Not deployed → Report-only → Ready to enforce → Enforced), and the policy member lines ("Core - Session - Admin session lifetime: Not deployed, watched since Aug 28, 2026").
- **The action column:** the date (or "Not scheduled"), and the step's own decision control or "Answered in <Direction step>".
- **The footer:** Defer this step, Doesn't apply here, and Scan.
- **The evidence dialog** ("Why IAMAI says this"), which is linked from the foot of Tasks Remaining, as it is on Emergency Access.

### The four sections

| Section | Replaces | Holds |
|---|---|---|
| **About this Step** | Why | The step's `why` sentence and "Learn →". Then two fact lines: «Reaches {who}.» and the source line (below). |
| **Tasks Remaining** | Readiness (tiles, the bar, the action lead) | Up to four subject tiles. Each tile shows N checks remaining, then the next check, then one action. Checks that are done go under "Completed checks · N"; tiles with nothing left go under "Satisfied · N". |
| **Implementation Tasks** | Implementation (channel tabs, the empty-state boxes) | The step's procedures, as a Task list over the channel tabs (Entra, PowerShell, JSON, AI Info, and Email where it has one). The task for the current transition leads. |
| **Completion Criteria** | Done when | The step's own end state. It's the same list whatever the state. |

### The source line: the baseline's version beside the person's choice

- About this Step always ends with the source:
  - For a baseline goal: «From the baseline: {sourcePolicy}, pinned at {pin}.» For example: «From the baseline: IAC - GLOBAL – SESSION – Admin Persistence (4 Hours), pinned at 90d9b89.»
  - For a goal that isn't in the baseline (`register-info-protected`, `azure-management-mfa`, and three others, per the pin's goal map): «From IAMAI's library; this policy is not in the baseline.»
- Wherever a Direction answer changes a setting, that line in the task's "Settings for This Action" says both: «Your choice: {answer}. Baseline: {baselineSetting}.» For example, D1 "Some" mail-sending devices on Block Legacy Authentication.

### The subject tiles

One tile per subject, in this order. A tile with no checks isn't drawn.

| Tile | Subject line under it | Its checks come from (today's pieces) |
|---|---|---|
| «Before you start» | «{n} steps and answers» | Prerequisite steps ("Prerequisite · To do", "Before enforcement"), the objects the policy needs (missing objects), Direction answers ("Waiting on your direction"), Baseline mappings, and deferred prerequisites. That's `fixTiles` `step:` / `missing:` / `direction:` / `mapping`, plus `engineTiles`. |
| «The policy» | The member's policy name, one line each (two on a pair) | The transition itself: «Created in Report-only» or «Turned on». Then settings that match the target (`check:` fixes, and Correct), the exclusions group applied and no emergency account in reach (`exclusionsTile`), no unexplained change (`review:`, review-required), and a policy IAMAI can write (`implementationTile`, unmatched pair, no operation). |
| The cohort the gate measures: «People», «Admins», «Guests» or «Devices» | The gate's measure | The readiness threshold ("Threshold", `stateTile` gate), the report-only watch ("Observation · Until {date}"), and the package gates a person confirms (`confirm` tiles). They carry the existing "Confirm" action. |
| «Exceptions» | «From your direction» | Only when a Direction answer adds one: the mail-sending accounts, device code in use, partners, or travellers. Each check reads the answer: «Answered in Confirm What You Use: Some (2 accounts).» |

**Each check has a phase.** It is either «Before Report-only» or «Before turning on». This follows the owner's rule of 2026-09-11: readiness gates enforcement, not creation.
- The next check shown is the first open check for the **current** transition.
- The count, N checks remaining, counts every open check up to Enforced.
- A turning-on check shows its phase as a small tag while the policy isn't deployed. This replaces the hard-coded English "Before enforcement" label and note in `readinessOf`.

**The one action** under the next check is one of:
- «Follow {task} in Implementation Tasks.» (This is the Emergency Access sentence, moved into content.)
- "Open {step} →" (the existing link word).
- "Answer it in {step}." (the existing Direction word).
- "Confirm" (the existing package confirmation).

### What is dropped or moved

| Today | After |
|---|---|
| "Affected people" tile (an info tile that's always satisfied) | About: «Reaches {who}.» If the reach is unknown: «Reaches: not established yet. {reason}» |
| "Guest Directory" tile | About, as the reach line. The names stay in the evidence dialog. |
| The readiness bar headline ("Ready now", "Needs correction", "Observing") | Dropped. The badge already says it. |
| The action lead under the bar (`WhatToDoLead`) | Becomes the one action on the first open tile. |
| "Implementation · Unavailable" tile | A check on «The policy»: «IAMAI can write this policy», with the reason as its detail. |
| Tiles that repeat a Direction question: "Mail-sending devices · Not confirmed", "Device code sign-in · Confirm no legitimate use" and "Partner or MSP access" | Removed. The question lives in D1 (`ANSWERED_IN`), and the policy shows the answer as a check under «Exceptions» or «Before you start». |
| Empty-state boxes: "Waiting on Readiness", "No artifact for this policy yet", "No generated implementation", "No tenant change to submit right now" | Dropped for policy steps. Every task is listed, and a task that isn't available yet says when it will be (§1, the tasks). The baseline conflict box stays. |
| The Done when lines that restate a hold: "Everything Readiness lists is cleared.", "The policy exists in {tenant} in report-only." and "The policy is enforced in {tenant}." | Dropped. Completion Criteria is the step's own `doneWhen`, in every state. |
| The literals in code: `TASK_HEAD`, "{n} checks remaining", "Completed checks · N", "Satisfied · N", "No tasks remaining", "After making changes, select Scan.", "Follow … in Implementation Tasks." | Moved to content keys, which Emergency Access reads too. Nothing visible changes. |

### The tasks (Implementation Tasks)

Each task is persistent: it's listed in every state.

| Task | When it's available | Source today |
|---|---|---|
| «Create the policy in Report-only» | When the policy is writable and not yet deployed | The package's or translator's create procedure (the Entra lines above) |
| «Correct the policy» | When settings differ from the target | The correction procedure ("Keep the policy's current state…") |
| «Review the report-only results» | While observing | The package's review block, where it has one |
| «Turn the policy on» | Ready to enforce | The enforce procedure ("Change Enable policy from Report-only to On…") |
| «Put the policy back in Report-only» | Always, once deployed | The step's existing "If it goes wrong" line |
| Folded objects and exceptions (for example, «Create the trusted network») | Per wave, as each wave folds them in | Later waves; none are added in this build |

**A task that isn't available yet** shows its title and one line, «Available when {gate}.» Its procedure isn't shown and can't be copied. That keeps today's rule that an enforce procedure is withheld until it's safe (Decision 3).

### By lifecycle state

"About" is the same in every state. So is "Completion Criteria", which is always the step's own `doneWhen`, except In place (below).

| State (today's lane) | Tasks Remaining: the next check → the action | The leading task |
|---|---|---|
| **Not deployed, free to create** (Ready · Create) | The policy: «Created in Report-only» → «Follow Create the policy in Report-only…». Turning-on checks show with their phase tag. | Create the policy in Report-only |
| **Not deployed, held** (On Hold / Up Next: a prerequisite, a missing object, a mapping) | Before you start: «{step} is complete» → "Open {step} →" | Create (it says «Available when {step} is complete.») |
| **Waiting on a Direction answer** (On Hold · Waiting on your direction) | Before you start: «Answer {question}» → "Answer it in {Direction step}." | Create (it says «Available when you answer {question}.») |
| **Report-only, observing** (On Hold · Observing / Ready · Review) | Cohort: «Watched until {date}» → «Follow Review the report-only results…» | Review the report-only results |
| **Ready to enforce** | The policy: «Turned on» → «Follow Turn the policy on…» | Turn the policy on |
| **Needs correction** (Ready · Correct) | The policy: «Matches the baseline's settings» → «Follow Correct the policy…» | Correct the policy |
| **Changed since the last scan** (review required) | The policy: «No unexplained change» → the existing "Keep the policy in Report-only, find out what changed on it and why, then rescan." | Review the report-only results |
| **Enforced by the plan** (Completed) | "No tasks remaining", with every tile under Satisfied | Put the policy back in Report-only |
| **In place, by the tenant's own policy** (Completed) | "No tasks remaining" | None. Completion Criteria reads «Met by your policy {name}.» |
| **Baseline conflict** (Resolution step) | One tile, «Baseline», with 1 check remaining: "Conflict unresolved" → "This step is on hold until the baseline author resolves a contradiction. There is nothing for you to do." The danger callout stays. | None. The existing conflict box stays. |
| **Deferred** / **Doesn't apply** | Not drawn; the footer offers the way back, as today | None |

---

## 2. Worked examples (demo)

### A. Shorten Admin Sessions: week two, Ready · Create

**Today:** Why, then Readiness (no open tiles, "Affected people · 3 active people · 3 admins" under satisfied, the bar reads "Ready now", then the action "Create the policy in Report-only."), then Implementation (Entra, PowerShell, JSON, AI Info), then Done when.

**Proposed:**
- **About this Step:** "Shorter admin browser sessions reduce how long a signed-in browser can remain useful without another authentication check. Test the experience so normal admin work remains practical. Learn →"
  - «Reaches 3 active people · 3 admins.»
  - «From the baseline: IAC - GLOBAL – SESSION – Admin Persistence (4 Hours), pinned at 90d9b89.»
- **Tasks Remaining:**
  - «The policy» · Core - Session - Admin session lifetime · «2 checks remaining»
    - Next: «Created in Report-only»
    - «Follow Create the policy in Report-only in Implementation Tasks.»
  - The second check is «Turned on» (tagged «Before turning on»).
- **Implementation Tasks:** «Create the policy in Report-only» leads, with today's Entra procedure word for word ("Name: **Core - Session - Admin session lifetime**… Session → Sign-in frequency: 4 hours. Persistent browser session: Never persistent… Set **Enable policy: Report-only**…"). «Turn the policy on» reads «Available when the report-only watch is complete.»
- **Completion Criteria:** "A scan confirms the session policy is On with the intended sign-in frequency, browser persistence, assignments and exclusions." and "Representative browser sign-ins behave as intended without interrupting normal work."

### B. Protect Sign-in Method Registration: first visit, On Hold · Waiting on your direction

**Today:** four Readiness tiles:
- "Threshold · not measured";
- "Prerequisite · To do · Define the Trusted Network";
- "Before enforcement · Prepare Emergency Access Accounts";
- "Waiting on your direction · Decide Where People Sign In From".

The bar reads "Waiting on your direction". The action column shows "Aug 31, 2026".

**Proposed:**
- **About:** today's `why` ("…The approved registration route also needs to work for remote users and account recovery. Learn →"), then:
  - «Reaches 30 active people · 3 admins.»
  - «From IAMAI's library; this policy is not in the baseline.»
- **Tasks Remaining:**
  - «Before you start» · «3 checks remaining»
    - Next: «Answer The office network» → "Answer it in Decide Where People Sign In From."
    - Completed checks: none. Still open: «Define the Trusted Network is complete» (Before Report-only), and «Prepare Emergency Access Accounts is complete» (Before turning on).
  - «The policy» · Core - Require - Security info registration · «3 checks remaining»
    - Next: «Created in Report-only».
    - Then «Registration outside the office asks for MFA; it is never blocked» (scan-checked: the grant is MFA or a strength, never Block).
    - Then «Turned on».
  - «People» · «MFA readiness» · «2 checks remaining»
    - Next: «MFA readiness reaches 90% (not measured today)», tagged «Before turning on».
    - Then «A remote person set up Windows Hello or Platform SSO» (manual evidence, confirmed with "Confirm").
- **Implementation Tasks:**
  - «Create the policy in Report-only», which reads «Available when you answer The office network.» The Entra lines that follow are today's: "Conditions > Locations: **Include: Any location; Exclude: All trusted locations**. Grant: **Require multifactor authentication**…"
  - «Set up a remote starter» (new, wave 3 words), which covers how a person with no method gets through this policy from home.
- **Completion Criteria:** today's three lines. The last becomes: "The intended registration and recovery paths work for remote users and new starters" «, including Windows Hello for Business and Platform SSO setup».

**The remote-worker rule** (owner, next item 5): the check and the task above are how this step "must allow Windows Hello and Platform SSO setup for remote workers". The Microsoft facts behind it:
- Since 6 July 2026, this user action applies during Windows Hello for Business and macOS Platform SSO setup. Source: `readme-refresh-2026-09-19.md`, citing Microsoft Learn "Control security information registration with Conditional Access". **Not rechecked in this spec.**
- A Temporary Access Pass satisfies the MFA grant for a person with no method yet. **Unchecked.** It must be checked against Learn in the wave 3 spec before the task's words are written.

### C. Require Token Protection on Windows: week two, Ready · Ready to enforce

**Today:** Readiness has no open tiles and the bar reads "Ready to enforce". The action is "Enable the reviewed policy, then verify the result." Implementation shows the enforce procedure. The rail reads "Sep 15, 2026".

**Proposed:**
- **Tasks Remaining:** «The policy» · Core - Session - Token protection · «1 check remaining»
  - Next: «Turned on»
  - «Follow Turn the policy on in Implementation Tasks.»
  - Completed checks · 2: «Created in Report-only», «Watched in Report-only: 0 failures in 7 days».
- **Implementation Tasks:** «Turn the policy on» leads, with today's text: "Verify the same policy and its prerequisites, set it to On… Change **Enable policy** from **Report-only** to **On** and save… If a required workflow fails, return this same policy to Report-only before troubleshooting." «Put the policy back in Report-only» is listed after it.
- **Completion Criteria:** "A scan confirms token protection is On for the intended Windows clients and resources, with the correct exclusions." and "Supported work apps sign in successfully with token protection."

### D. Require MFA for Everyone: week two, Completed (In place); first visit, Ready · Correct

**Week two, today:** "Existing coverage · In place", and the Implementation box reads "No implementation needed".

**Week two, proposed:**
- **Tasks Remaining:** "No tasks remaining".
- **Implementation Tasks:** no task; it shows the existing line "This is in place already: nothing to create. Keep the policy as it is."
- **Completion Criteria:** «Met by your policy Core - Grant - MFA for all users.»

**First visit, today:** "Ready · Correct" with the "Enforced" chip, and the action "Running this would change what Contoso Pty Ltd's people have to do straight away, and MFA readiness is not measured - this step waits until it reaches 90%…". The box reads "No artifact for this policy yet" and the rail "Not scheduled".

**First visit, proposed:**
- «The policy»: «Matches the baseline's settings» → «Follow Correct the policy…»
- «Correct the policy» reads «Available when MFA readiness reaches 90%, because this policy is already On.»

The lane contradiction is logged in §5, not fixed here.

---

## 3. The "By Area" view

### Where it sits
- A fourth tab after Ready, Up Next and On Hold: «By Area».
- The pinned groups (Establish Emergency Access, Decide Your Tenant's Direction) stay above the tabs, as today.

### The areas (the step map's waves, in order)

| # | Area («title») | Today's steps in it |
|---|---|---|
| 1 | «Close the Doors Nobody Should Use» | block-legacy-auth, block-device-code, block-auth-transfer, block-unsupported-platforms |
| 2 | «Protect Admins» | s-ladder-operator-passkey, s-prereq-auth-strength, admins-phishing-resistant, admin-session, pim-activation-reauth |
| 3 | «Protect Sign-up» | s-prereq-trusted-location, register-info-protected, device-registration-mfa |
| 4 | «MFA for Everyone» | s-verify-mfa, mfa-all-users, guests-mfa, s-prereq-security-defaults, s-prereq-per-user-mfa |
| 5 | «Where People Sign In From» | s-prereq-allowed-countries, geo-restriction, s-prereq-service-accounts-group, service-accounts-trusted-network, workload-identity-block (the Entra Connect sync account) |
| 6 | «Devices» | require-managed-device, intune-enrollment-reauth, s-shared-devices |
| 7 | «Risk» | sign-in-risk, sign-in-risk-medium, user-risk, user-risk-medium |
| 8 | «Sessions and Hardening» | all-users-no-persistence, token-protection |
| 9 | «The Services You Use» | inforcer-mfa and the four `s-review-baseline-*` rows (AVD ×2, SharePoint and OneDrive, Azure management) |
| 10 | «Ongoing and Cleanup» | s-check-dormant-accounts, s-check-separate-admin-accounts, and every `cleanup-*` row except the drill |
| — | «Other» | Anything not listed. Today that's `admin-portals-protected`, until the lockdown kit exists. |

- The objects sit with the first policy that needs them, which is where the step map folds them later.
- Areas 5–9 apply per Direction and licence, like their steps.

### The rows
- The same row as every other tab: the lane label chip, the title, Impact and When. They're rendered by the same `renderById`, so a row reads the same in every view.
- Within an area, rows follow the registry's order (the step map's order), not the lane order.
- Every row in the area is shown, including Completed and Deferred ones: this view answers "how far along is each area?". Search and Work type still filter.

### Headings and counts
- Each area heading has its summary: «{done} of {n} completed», counted off the rows under it.
- An area with no rows (for example, Risk without P2) isn't drawn.
- The tab has no count badge, because it would equal every row.
- The lane tabs keep their counts.

### Behaviour
- A deep link or a tile's "Open {step} →" opens the step where it is. If By Area is showing, the step opens there; the tab doesn't jump to the step's lane.
- Print and export keep the lane order. By Area is a screen view.
- The code calls it `area`, not `wave`. `schedule.ts` already uses "wave" for enforcement dates, and `waveStartOf` in `planBoard.ts` reads it.
- The registry is `src/roadmap/stepAreas.ts`: key, title key and ordered member ids, beside `stepGroups.ts`. An area is not a StepGroup, because groups set anatomy and pinning, and areas do neither.

---

## 4. Print, export and the prompt pack (V1 §3.7)

**One set of headings.** A new `pages.app.plan.anatomy.headings` holds «About this Step», «Tasks Remaining», «Questions», «Implementation Tasks» and «Completion Criteria», with the same words as today.
- `stepHeadings.ts` (both anatomies), `artifactLines.ts`, `content/render.ts` and the print all read it.
- Direction's own `direction.headings` copy is deleted: one fact, one source.

**The export view** (`ExportStep`, built in `stepExport.ts`) gains two fields:
- `remaining`: per tile, «{subject}: {n} checks remaining. Next: {check}. {action}»;
- `tasks`: the task titles and each task's Entra steps.

It loses `whatToDo` and `fix` for policy steps: their facts are now checks.

**The flat artifacts** (the calendar entry, the prompt pack's step block, the copy-for-AI) print, in order:
1. the About sentence, unlabelled as today;
2. the state;
3. «Tasks Remaining: …»;
4. «Completion Criteria: …»;
5. "If it goes wrong".

The Emergency Access steps already export their tasks like this (`emergencyAccountTasksText`); this build generalises it.

**Print** draws the step as the screen does, with "Completed checks" and "Satisfied" open.
- Every task prints. An available task prints its Entra procedure; an unavailable one prints its title and «Available when…».
- Who this touches, Dates and More print as today.

**AI Info** (`aiGrounding.ts`) states the same checks and criteria lines, under the same headings.

**The test:** for each of the four examples in §2, every line on screen under Tasks Remaining and Completion Criteria appears word for word in the export text, the print and the prompt pack.

---

## 5. Edge cases

- **A pair (Require MFA for Guests: Mixed-Guests + B2B-Guest).** «The policy» shows one subject line per member ("Policy A", "Policy B"). A check names its member. An unmatched pair is a check: «Both policies can be matched».
- **The reach is unknown.** About reads «Reaches: not established yet.» with the existing reason. No count is shown and it isn't a check (Foundation A: unknown is never zero).
- **An unread source.** The check reads «Not read in this scan», not a fail, and the step stays where it was (V1 §3.4).
- **An enforced policy whose correction waits on readiness** (demo Require MFA for Everyone). «Correct the policy» reads «Available when …, because this policy is already On.» Logged: the lane says Ready while nothing is doable today.
- **An enforced policy the engine can't rebuild** (week two Block Device Code Sign-in: "On Hold · Not supported", "Scan Contoso Pty Ltd again to rebuild it"). It's drawn as «The policy: IAMAI can write this policy» → that sentence. Logged as a probable engine bug; not fixed here.
- **A goal that isn't in the baseline.** The source line says so (§1). There's no "Your choice / Baseline" pair.
- **A licence the tenant lacks (P2 risk).** The step isn't generated, and the area isn't drawn.
- **Deferred with a date.** The footer is unchanged, and Completion Criteria stays the `doneSetAside` line.
- **A Direction answer changed after the policy was created.** An «Exceptions» check reopens only if the policy no longer matches the answer. The scan sees it (V1 §3.4).
- **Phone width.** The tiles stack one per row, as Emergency Access's do. The four tabs must fit at 375px or scroll within the strip; check this in the build.

**Found while writing this (logged, not in scope):**
- `readinessOf` hard-codes "Before enforcement" and its note in English. The anatomy replaces it.
- The week-two Protect Sign-in Method Registration reads Ready · Create, yet its "Threshold" tile draws as a warning, as if it were blocking. The phase tag fixes how it reads.
- Exports label sections "What to do" and "Done when", while Emergency Access's screen says "Tasks Remaining" and "Completion Criteria". §4 fixes this.

---

## 6. Decisions for the owner

1. **Four fixed subject tiles:** Before you start, The policy, the cohort (People / Admins / Guests / Devices) and Exceptions. *Recommend: yes.* Every policy then reads the same way.
2. **Turning-on checks are visible and counted before the policy is deployed**, tagged «Before turning on». The next check is always the current transition's. *Recommend: yes.* It's honest about the whole road without blocking creation.
3. **A task that isn't available yet** shows its title and «Available when…», with its procedure hidden. *Recommend: hide.* The other choice is a read-only preview; that weakens the withholding rule.
4. **Drop the readiness bar headline** on policy steps; the badge already says it. *Recommend: drop.*
5. **Completion Criteria doesn't change with state.** The three hold lines retire for policy steps; In place reads «Met by your policy {name}.» *Recommend: yes.*
6. **"Affected people" moves from a tile into About** as «Reaches {who}.» *Recommend: yes.* It's a fact, not a check.
7. **The baseline's version beside the choice:** the About source line with the pin, plus «Your choice… Baseline…» on each setting a Direction answer changes. *Recommend: yes.*
8. **Remove the tiles that repeat a D1 question** (mail-sending devices, device code, partners); the answer shows as a check. *Recommend: yes.*
9. **By Area** is a fourth tab with no badge. It shows Completed and Deferred rows in their area, hides empty areas, and is a screen view only. *Recommend: as written.*
10. **The area titles** in §3 (Title Case, from the step map). *Recommend: approve or rename.*
11. **The placements I made:** the Entra Connect sync policy (`workload-identity-block`) → area 5; the `s-review-baseline-*` rows → area 9; the admin portals → «Other» until the lockdown kit. *Recommend: yes.*
12. **Lanes sorted by area** (the step map §1 says "ordered by wave"): *Recommend: a separate commit after this build.* It would move every snapshot's order twice otherwise.
13. **Protect Sign-in Method Registration's remote rule** is the §2 B check and manual evidence, plus a «Set up a remote starter» task. Its words are written in wave 3, after the TAP fact is checked. *Recommend: approve the shape now.*
14. **The rollback task, «Put the policy back in Report-only»**, built from the existing "If it goes wrong" line. *Recommend: yes.*
15. **`docs/qa/page-contracts.json`** (owner-owned) needs the four headings for the policy steps. *Recommend: approve the update in the build.*

## 7. Assumptions (settled so the spec is complete)

- The anatomy is chosen by content kind `policy`, not by group membership. `stepHeadings.ts` gains a `policy` anatomy. `s-shared-devices` is included, because its kind is `policy`.
- The Task selector sits on the Entra tab, as on Emergency Access. PowerShell, JSON and AI Info show the leading task's artifact, as today.
- No new Graph read and no new permission. Every check is built from what the contract, the lane engine and the packages already hold.
- New sentences stay within 25 words (the MFA Readiness limit).
- A check's phase comes from `scheduleOf(step).transition` and the readiness gate. No new engine reading is added.
- The per-step words (every `why`, `doneWhen` and task line) are unchanged in this build, except the one line in §2 B.
- The Email channel stays a tab.

---

## 8. Build plan

Each commit runs `npm run verify -- <its tests>`. The last one adds `--prepush`. The walk isn't run (CLAUDE.md); CI runs it.

| # | Commit | Acceptance → test |
|---|---|---|
| 1 | The words: `anatomy.headings`, tile and check words, task titles, area titles and «By Area». `TASK_HEAD` and the Emergency Access literals are read from content. | Emergency Access renders byte-identically: `stepSnapshots.test.ts` shows no diff, and `stepGroups.test.ts` passes. The keys exist and read within the limit: `contentReview.test.ts`. |
| 2 | `src/roadmap/stepAreas.ts` | Every step that any of the eight fixtures generates is in exactly one area or one pinned group. The order matches §3. New `stepAreas.test.ts`. |
| 3 | The By Area tab (`planBoard.ts` `groupsByArea`, `Plan.tsx`, the tab follows the open step) | Groups, «{done} of {n} completed», no empty area, completed rows included, search and filter applied: `planBoard.test.ts`. Smoke reads four tabs: `scripts/smoke.mjs`. |
| 4 | `policyChecks.ts` (pure): subject tiles from the contract, the readiness and the blockers | One test per §1 state, on demo, demo-week2, hostile and midflight: the next check, N, the phase and the action. New `policyChecks.test.ts`. |
| 5 | `policyTasks.ts` (pure): the task list, what makes each available, and the leading task | Available or not, and the leading task, per state. An unavailable task has no copyable text. New `policyTasks.test.ts`. |
| 6 | `ContentStep` draws the policy anatomy. It reuses `EmergencySubjectReadiness` and the task-mode `Implementation`, drops the bar and empty boxes, and moves About. | Four headings on all 24 policy steps: `stepSnapshots.test.ts`, with the snapshots regenerated and the commit tagged `[snapshots]`. Emergency Access unchanged: `emergencyExports.test.ts`. |
| 7 | Completion Criteria stays stable for policies (`doneWhenOf`) | The same lines Not deployed → Enforced for each §2 step; In place reads «Met by…»: `stepContract.test.ts`. |
| 8 | About: the reach line, the source line with the pin, and «Your choice / Baseline» | The pin and source name are shown; a not-in-baseline goal says so; a D1 "Some" shows both: new `policyAnatomy.test.ts`. |
| 9 | Export, print, prompt pack and calendar (`ExportStep`, `artifactLines.ts`, `render.ts`, `aiGrounding.ts`) | Same words for the §2 examples on screen, export, print and prompt pack: new `policyExports.test.ts`. |
| 10 | Check: the demo and week two at 1280 and 375 (one decision step, one policy per state, one completed step); saving and reopening a step; then GetIAMAI in report-only with the owner | Screenshots for the owner. `weekend-launch.md` is updated. |

**Snapshots:** commits 6–8 change `headings` and `tiles` for the 24 policy steps across the eight fixtures. Only those fields should move; any other diff is a regression.

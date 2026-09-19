# Plan step organisation: groups, and bringing steps up to the Emergency Access standard

Read-only study, 2026-09-18, at 79b66fd8. Sources: `src/roadmap/{stepIds,generate,workflows,answers,decisions,manualWork}.ts`, `src/actionability/dependency-data.json` (44 steps, 152 edges, 7 conditions), `src/ui/surfaces/{planLanes,planBoard,Plan,ContentStep,stepContract}.ts(x)`, `docs/implementation-content/LIBRARY.json` (47 packages), `docs/design/content.json` (keys only), the pinned baseline and its goalMap, `docs/EMERGENCY-ACCESS-HANDOFF.md`, `docs/prompts/60-*`, `docs/content-review/BLOCKED.md`, `docs/qa/step-snapshots/demo/*`. I ran nothing: no tests, no smoke, no walk.

## Executive summary

1. The Plan can show about 60 step kinds: 4 Emergency Access, 10 tenant-setup or decision steps, 6 MFA and cutover steps, 4 account and exception follow-ups, 28 policy goals (23 are in the pinned goalMap), per-policy baseline reviews, 6 Cleanup rows and 11 free-tier ladder items.
2. The demo's Ready tab holds 19 mixed rows beside the pinned Emergency Access group: decisions, objects, reviews and policies. The organisation problem is real.
3. Emergency Access worked because each step owns one outcome and its checks, the scan verifies it, it reads the same after a re-scan, and it ends in an automatic proof. The kind of work was never the grouping rule. Copy that pattern, not just the heading.
4. Proposed: two new pinned groups next to Emergency Access. **Know Your Tenant** holds answers only and makes no Entra change. **Set Up Locations and Groups** holds the named locations and the service-accounts group, each with a scan check.
5. Proposed: an unpinned **Get Ready for MFA** group (operator passkey → authentication strength → campaign). Leave the policy steps and the account-hygiene checks ungrouped, in the lanes.
6. The biggest hidden choice-style task is **Baseline mappings**. It lives in Plan settings, not the Plan, and one unmapped source group (`sourceMapping:62d67e66`) holds the create action of 14 policy steps. It should be the first row of Know Your Tenant.
7. **Confirm the Services You Use** (`s-confirm-workloads`) is the weakest decision step. It is absent from the dependency graph (a runtime patch in `planLanes.ts`), has no `content.json` step, no package, AI Info only, and 5 test files.
8. Two things decide whether this is safe. Decision gates must be per answer, never per group. They gate `enforce`, or `create` only where the answer changes the policy body. Answer storage keys (`questionAnswers[stepId:label]`, where the option text is the stored answer) must not move when a question moves.
9. A prerequisite: Emergency Access grouping is hard-coded by id in `planBoard.ts`, `ContentStep.tsx` and `planLanes.ts`. Generalise it into one group registry before adding groups, or every new group adds another set of id branches.
10. Revisit order: Baseline mappings → Confirm Services → MFA group (operator passkey + campaign) → Trusted Network / Allowed Countries → the three exception questions → Security Defaults / per-user MFA → account hygiene → policies (a separate package track).

---

## 1. Inventory

Graph terms: **h** = hard edge, **c:x** = conditional on condition x, **create/enforce/start** = the action gated. "Common policy gates" (CPG) = `s-prereq-break-glass` (enforce, minimum met), `cleanup-drill` (enforce), `s-prereq-exclusion-group` (create), `s-prereq-security-defaults` (c:sd-enabled, enforce). **SM** = `sourceMapping:62d67e66` (create). "Runtime" = an edge the code adds outside `dependency-data.json`.

### 1a. Establish Emergency Access (the model)

| id | title | kind | asks the operator to | depends on | depended on by |
|---|---|---|---|---|---|
| s-prereq-break-glass | Prepare Emergency Access Accounts | decision + tenant setup | pick 2 accounts; make each cloud-only, `.onmicrosoft.com`, enabled, permanent GA, approved passkey | — | passkey settings, drill, hardening, all 23 graph policies (enforce) |
| s-prereq-exclusion-group | Configure Emergency Exclusions | decision + tenant setup | pick or create an assigned security group with exactly those accounts; exclude it from every policy | — | passkey settings, drill, 20 policies (create) |
| s-prereq-passkey-settings | Configure Passkey Authentication | tenant setup (auth methods) | bring the FIDO2 policy to target: registration, key restrictions, approved AAGUIDs | break-glass h, exclusion group h | drill, operator passkey, admins-phishing-resistant (enforce), register-info-protected (enforce) |
| cleanup-drill | Verify Emergency Access | verification (automatic) | sign in with each account's passkey after the configuration baseline | the three above h | operator passkey, all 23 graph policies (enforce) |
| cleanup-hardening | Harden Emergency Access | cleanup (conditional) | finish deferred resilience items | break-glass (minimum met) | — |
| cleanup-alerting | Alert on Emergency Account Sign-ins | cleanup (after rollout) | set up an alert on emergency sign-ins, record the recipient | runtime: after the policy rollout | — |

### 1b. Tenant decisions and supporting objects (candidates for the new groups)

| id | title | kind | asks the operator to | depends on | depended on by |
|---|---|---|---|---|---|
| s-prereq-source-references (not a step; Plan settings → Baseline mappings) | Baseline mappings | decision | map each unexplained baseline source object to a tenant object, or omit it | — | 14 policies via SM (create): mfa-all-users, admins-pr, admin-session, admin-portals, auth-transfer, device-code, legacy-auth, unsupported-platforms, device-registration, require-managed-device, no-persistence, token-protection, geo, SA-trusted-network |
| s-confirm-workloads | Confirm the Services You Use | decision | answer In use / Not in use / Not sure for SharePoint, AVD, Inforcer, Azure management, Intune, directory sync (scan pre-fills) | — (not in graph) | runtime `blockedBy` while "Not sure": require-managed-device, mobile-app-protection, intune-enrollment-reauth (intune); azure-management-mfa; workload-identity-block; inforcer-mfa; every `s-review-baseline-*` for that service |
| s-prereq-device-plan | Decide How Devices Are Managed | decision | choose phones (Intune / app protection only / no company data) and computers | — (only when phone or unjoined-PC sign-ins exist) | graph: require-managed-device (create); runtime: mobile-app-protection, intune-enrollment-reauth, `s-ladder-phone-access-restriction` |
| s-prereq-trusted-location | Define the Trusted Network | decision + object | pick trusted IP named locations (or "everyone is remote"); create one if missing | — | shared-devices h, register-info-protected (create), require-managed-device (create), SA-trusted-network (create) |
| s-prereq-allowed-countries | Create or Correct Allowed Countries Location | decision + object | confirm work countries and recurring travel countries; create or correct the countries location | — (only when geo applies) | geo-restriction (create), s-question-travel h |
| s-prereq-service-accounts-group | Create or Correct Service Accounts Group | decision + object | confirm which accounts are service accounts; group with exactly them | — (doesn't apply, in the footer, when none are selected) | block-legacy-auth (enforce), SA-trusted-network (create) |
| s-shared-devices | Give Shared Devices Their Own Policy | decision + policy | identify shared-device accounts; create their own block policy; record a work-task test | trusted-location h; c:shared-devices-exist on managed-device and no-persistence (created) | require-managed-device, no-persistence (c, enforce) |
| s-prereq-auth-strength | Create the Baseline's Authentication Strength | object (auth) | create a strength matching the baseline's combinations (scan finds an existing match) | — | admins-pr, device-registration, register-info, guests, sign-in-risk, user-risk, user-risk-medium, pim (all create) |

Choice-style questions embedded **in policy steps** today (`QUESTION_STEP`, `CONDITIONAL_INPUTS`):

| stored under step | question | owns condition | effect |
|---|---|---|---|
| s-goal-block-legacy-auth | Mail-sending devices (None / Temporary exception accounts) | mail-devices-incompatible-path | adds `s-question-mail-devices`; gates legacy-auth enforce |
| s-goal-block-device-code | Device code sign-in (None / Yes) | device-code-workflows-exist (decision:device-code-workflows) | gates device-code enforce |
| s-goal-guests-mfa | Partner tier + Partner or MSP access | partner-accounts-exist | adds `s-question-partner`; gates guests and geo enforce |
| s-prereq-allowed-countries | Recurring Travel Countries | travel-exceptions-allowed | adds countries; `s-question-travel` hidden for V1 |
| s-goal-sign-in-risk | First enforcement (strength vs plain MFA) | — | policy variant |
| s-verify-mfa | People Needing Help (special care) | — | campaign scope |

### 1c. MFA and authentication, cutovers

| id | title | kind | asks | depends on | depended on by |
|---|---|---|---|---|---|
| s-ladder-operator-passkey | Register Your Own Passkey | operator readiness | register a passkey and sign in with it | passkey settings h, drill h | s-verify-mfa h |
| s-verify-mfa | Prepare Your Team for MFA | campaign | run the registration campaign; confirm people needing help | operator passkey h | mfa-all-users, admins-pr, register-info, sign-in-risk ×2, user-risk ×2 (enforce) |
| s-prereq-security-defaults | Turn Off Security Defaults | cutover | disable SD once replacements are ready | mfa-all-users, admins-pr, legacy-auth (c:sd-enabled, ready-to-enforce) | enforce of all 23 graph policies (c:sd-enabled) |
| s-prereq-per-user-mfa | Finish Moving Off Per-User MFA | cutover | disable legacy per-user MFA after replacement is enforced | mfa-all-users (enforced) | — |
| s-ladder-phone-access-restriction | Keep Company Data Off Phones | policy (conditional) | restrict phone access when phones = "no company data" | runtime: device plan | — |

### 1d. Account hygiene and exception follow-ups

| id | title | kind | asks | depends on | depended on by |
|---|---|---|---|---|---|
| s-check-dormant-accounts | Disable or Confirm Dormant Accounts | per-account decision | keep (with reason) / disable / investigate each inactive account | — | — |
| s-check-separate-admin-accounts | Use Separate Accounts for Admin Work | review + manual evidence | confirm dedicated admin accounts or record a tested handover | — | — |
| s-question-mail-devices | Update How Devices Send Email | remediation | move each device to a relay; remove the exception | added by the mail-devices answer | legacy-auth (c, enforce) |
| s-question-partner | Exclude the Partner or MSP Accounts | exception | exclude the service-provider type from the guests and countries policies | added by the partner answer | geo, guests (c, enforce) |
| s-question-travel | Arrange Access Before Travel | operational exception | record trips; add or remove countries | allowed countries h | geo (c) — **hidden for V1** |
| s-review-baseline-<policy>-<hash> | Review access protection for {service} | manual review | attest an unassessed baseline policy (SharePoint, AVD ×2, Azure management in the demo) | runtime: services answer | — |

### 1e. Policy steps (create/correct a CA policy, report-only → enforce)

Every row asks the same thing: create or correct the policy from the pinned baseline, observe it in report-only, then enforce. Each also carries the common policy gates (CPG) and, where marked, SM.

| id (s-goal-…) | title | extra gates | dependents |
|---|---|---|---|
| mfa-all-users | Require MFA for Everyone | SM, s-verify-mfa (enforce) | per-user MFA, SD |
| admins-phishing-resistant | Require Phishing-Resistant MFA for Admins | SM, auth-strength, passkey settings, s-verify-mfa | SD |
| admin-portals-protected | Block the Admin Portals for Non-Admins | SM, sourceConflict admin-portals-target | — |
| admin-session | Shorten Admin Sessions | SM | — |
| block-auth-transfer | Block Authentication Transfer | SM | — |
| block-device-code | Block Device Code Sign-in | SM, decision device-code (c, enforce) | — |
| block-legacy-auth | Block Legacy Authentication | SM, SA group (enforce), mail devices (c) | SD |
| block-unsupported-platforms | Block Unsupported Device Platforms | SM | — |
| device-registration-mfa | Require MFA to Register a Device | SM, auth-strength | — |
| intune-enrollment-reauth | Require a Fresh Sign-in for Intune Enrollment | runtime: services(intune), device plan | — |
| register-info-protected | Protect Sign-in Method Registration | trusted-location, auth-strength, passkey settings, s-verify-mfa (no exclusion-group edge) | — |
| require-managed-device | Require a Managed Device Outside the Office | SM, device plan, trusted-location, shared devices (c); runtime services(intune) | shared devices |
| all-users-no-persistence | Limit How Long Sessions Last | SM, shared devices (c) | shared devices |
| token-protection | Require Token Protection on Windows | SM | — |
| geo-restriction | Block Sign-ins From Countries Not Allowed | SM, allowed countries, partner (c), travel (c) | — |
| guests-mfa | Require MFA for Guests | auth-strength, partner (c) | — |
| service-accounts-trusted-network | Restrict Service Accounts to the Trusted Network | SM, SA group, trusted-location | — |
| workload-identity-block | Restrict the Entra Connect Sync Account to Its Address | decision workload-identity-type; runtime services(workload) | — |
| sign-in-risk / -medium | Challenge High / Medium-Risk Sign-ins (P2) | s-verify-mfa (+auth-strength for high) | — |
| user-risk / -medium | Remediate High-Risk Users / Reset Passwords for Medium-Risk (P2) | auth-strength, s-verify-mfa | — |
| pim-activation-reauth | Require MFA at Every Role Activation (P2) | auth-strength | — |
| inforcer-mfa, mobile-app-protection, azure-management-mfa, unmanaged-browser (byod), block-downloads-unmanaged | (not in the dependency graph) | runtime services answer only | — |

### 1f. Cleanup rows and the free-tier ladder

- Cleanup (`cleanupPhase.ts`): drill, hardening, alerting, naming, consolidation, notAssessed. **`cleanup-notAssessed` appears superseded on CA plans.** `generate.ts:2531` passes `notAssessed: []` to the cleanup phase after `addWorkflowSteps` turns each unassessed policy into an `s-review-baseline-*` step. Its package and graph node remain.
- Free-tier ladder (`data/free-tier-ladder.json`, `s-ladder-*`): 10 items, generated only when the tenant cannot use CA. The owner decided on 2026-09-18 that P1-less tenants are not the market.

---

## 2. What Establish Emergency Access actually did

The break-out was not "put four emergency things in a box". What made it work:

1. **One outcome, four owned sub-outcomes.** Accounts ready → excluded → passkey policy correct → proven by sign-in. Each check lives in the step that owns the change (handoff rule: "Group membership belongs in Step 2").
2. **Decisions live where the object is made.** Step 1 picks the accounts and Step 2 reads them ("avoid repeating the emergency account list"). Step 2 picks the group.
3. **Everything is judged by what the scan sees, with no attestation.** pass/fail/unknown findings (`journey*Findings`). Unknown is not false. A failing check names something the admin can change in the portal.
4. **Rescan durability.** Step 4 proof resets only when the recovery outcome changes. An unread scan suspends proof without deleting it. Proof expires at 90 days.
5. **One tile standard.** Subject → N checks remaining → next check → one action → Completed checks · N → Satisfied · N.
6. **Fixed section layout.** About this Step, Tasks Remaining, (Methodology), Implementation Tasks (persistent SOPs; a task selector for Entra only), Completion Criteria.
7. **Pinned on the Plan.** The group stays above the lanes until all four read Completed, then it folds into Completed.
8. **Accepted on a real tenant**, with focused tests (`emergencyJourney`, `cleanupDone`, `emergencyPasskeyTasks`, `emergencyNextSteps`, `emergencySubjectTiles`, `cleanupExports`, …).

Items 1–4 are what make it good. Items 5–7 are how it looks on screen. A new group that copies 5–7 without 1–4 will look finished when it is not.

---

## 3. Proposed groups

**Terminology:** `stepFamily` already exists in `stepContract.ts` and means the render family (policy, supporting, mfa, in-place, decision, resolution). Calling the new groupings "families" would collide with it. Call them **groups** (or "journeys", matching `emergencyJourney.ts`).

### G1 — Establish Emergency Access (keep as is)

No membership change. Two small follow-ups:
- `cleanup-hardening` and `cleanup-alerting` stay Cleanup rows. They could be shown as "follow-ups" under the completed group (owner question).
- The four headings are TSX literals in `ContentStep.tsx` (lines 375, 404, 493, 506), not `content.json` keys. Move them into content before any other group uses them.

### G2 — Know Your Tenant (new, pinned; answers only, no Entra change)

What the owner asked for, bounded to steps whose output is **an answer that scopes the plan**.

| order | step | source | change |
|---|---|---|---|
| 1 | Map Baseline References | `s-prereq-source-references` (Plan settings) | **promote to a Plan row**, shown only while any mapping is pending. It unlocks the create action of up to 14 policies. |
| 2 | Confirm the Services You Use | `s-confirm-workloads` | keep. Add to the dependency playbook (retire the runtime patch in `planLanes.ts` lines 391–400), add a `content.json` step, author a package. |
| 3 | Identify Accounts That Are Not People | new; takes the **selection** out of `s-prereq-service-accounts-group` and `s-shared-devices` | **split**. Service and shared-device classification drives every people count (`notPeopleIds`, MFA Readiness, the campaign, dormant accounts), not just the group. Same shape as Emergency Access Step 1 → Step 2: the group step then only builds the group. |
| 4 | Decide How Devices Are Managed | `s-prereq-device-plan` | keep. Order it after Services, because Intune usage is a services answer. |
| 5 | Confirm Sign-in Exceptions | new; hosts the Mail-sending devices, Device code sign-in and Partner/MSP questions now on three policy steps | **merge the three questions**. The policy steps keep one sentence showing the saved answer and linking to it (allowed by the handoff's redirect rule). |

- **Done:** every answer saved, none left "Not sure", and no scan evidence contradicts a saved "No". This generalises the `needsReview` rule `workflows.ts` already has: "New usage detected. Your saved choice is No."
- **Verification:** the scan corroborates (usage signals, group/location reads) but cannot prove intent, so "Completed" means "answered and not contradicted". Say that in Completion Criteria.
- **Plan reading:** a pinned group under Emergency Access. Header "Know Your Tenant · 3 of 5 answered". The rows keep their own lane labels (`Ready · Decision`). The header's "Needs input" tile falls as answers land.
- **Pros:**
  - Moves decisions now spread across about 8 Ready rows into one sitting that needs no Entra change.
  - Unlocks many policy rows at once.
  - Gets people counts right early.
  - Brings the biggest hidden hold (Baseline mappings) into view.
- **Cons:**
  - The exception questions leave the policy whose consequence they explain. The operator answers "device code sign-in?" without seeing the block policy. Mitigation: each question carries a one-line consequence, and the policy shows the answer.
  - It edges back toward the Setup wizard the product moved away from. Mitigation: 5 rows maximum, each a real step with evidence, not a modal.
  - Answer storage migration (see §4).
- **Where not to go further:** do not move object-making choices (trusted network, countries, exclusions group) here. Emergency Access keeps a picker with the object it shapes, and so should G3.

### G3 — Set Up Locations and Groups (new, pinned after G2; decision + Entra object + scan check)

| order | step | change |
|---|---|---|
| 1 | Define the Trusted Network (`s-prereq-trusted-location`) | keep. Add IP-range entry: BLOCKED.md records "[IP range input] needs data flow". `networkDraftOf` already exists. |
| 2 | Create or Correct Allowed Countries Location (`s-prereq-allowed-countries`) | keep, with recurring travel countries. |
| 3 | Create or Correct Service Accounts Group (`s-prereq-service-accounts-group`) | keep the group work. Reads G2 step 3's selection, like Emergency Access Step 2 reads Step 1. Shows only when service accounts exist. |

- **Done:** each object exists exactly as decided, verified by the scan. This is already how `generate.ts` sets `satisfied`/`inPlace` for all three. Progress: "Set Up Locations and Groups · 1 of 3".
- **Alternative:** merge G2 and G3 into one "Prepare Your Tenant" group (about 8 rows) with two sub-headings. That is closer to the owner's wording ("network and location access"). The cost is one group that mixes "answer" and "change Entra" completion meanings, and a group twice the size of Emergency Access. Owner question 1.
- **Dependency note:** the exclusions group stays in Emergency Access. `s-prereq-auth-strength` goes to G4 (authentication subject, per `WORK_TYPE_IDS`).

### G4 — Get Ready for MFA (new, not pinned; a group heading in the lanes, or pinned once Emergency Access completes)

| order | step | note |
|---|---|---|
| (after G1) | Configure Passkey Authentication | stays in Emergency Access. The G4 header says "after Establish Emergency Access" instead of duplicating the row. |
| 1 | Register Your Own Passkey (`s-ladder-operator-passkey`) | the `s-ladder-` prefix is misleading, but keep the id (saved records). Rename only the prefix in code comments and docs. |
| 2 | Create the Baseline's Authentication Strength (`s-prereq-auth-strength`) | independent of 1. Gates 8 policies' create action, so it could come first. |
| 3 | Prepare Your Team for MFA (`s-verify-mfa`) | campaign plus the special-care list. Its readiness must read MFA Readiness v3 (one source). |

- **Done:** operator passkey proven by a sign-in, strength matched by the scan, campaign threshold met per MFA Readiness. Progress: "Get Ready for MFA · 2 of 3 · 64% of people ready".
- **Not in the group:** Turn Off Security Defaults and Finish Moving Off Per-User MFA. Their gates are policy milestones (ready-to-enforce, enforced), so a pinned group holding them would stay open for the whole rollout. Leave them in the lanes (work type "MFA & Authentication"). They can appear as a closing "cutover" pair once their gates open.

### Where not to group

- **Policy steps (about 23).** The lane board (Ready / Up Next / On Hold) is the organising principle, and the engine orders rows by what unlocks the most. Pinning policy groups (by `goals.json` `domain`: Identity, Admins, Legacy access, Devices, Sessions, Risk) above the lanes would duplicate the tabs and fold Ready work into collapsed groups. At most, use `domain` as a heading inside a lane or as a refinement of the Work type filter. It is already data, so no id list is needed.
- **Account hygiene** (dormant accounts, separate admin accounts). No graph dependents, and independent of each other. Grouping adds a header and no ordering. Leave them in the lanes. If the owner wants them near G2, a non-pinned "Review Accounts" heading is enough. They are not scoping answers, so they do not belong in Know Your Tenant.
- **Exception follow-ups** (`s-question-mail-devices`, `s-question-partner`). They exist because of a G2 answer but gate policy enforcement. Keep them in the lanes next to their policy.
- **Cleanup rows.** Keep them as Cleanup.

### Retire, merge, rename candidates

| candidate | action | why |
|---|---|---|
| `cleanup-notAssessed` | retire (confirm first) | emptied on CA plans (`generate.ts:2531`) and replaced by the `s-review-baseline-*` steps; a dead graph node and package |
| `s-question-travel` | retire or keep hidden | hidden for V1; its package (12 blocks) is maintained for nothing |
| free-tier ladder (10) | freeze, no investment | not the market (owner, 2026-09-18); `s-ladder-phone-access-restriction` is a P1 step with a ladder prefix |
| `s-shared-devices` | split: selection → G2 step 3; policy stays | mirrors Emergency Access Step 1 → Step 2 |
| `s-prereq-service-accounts-group` | split: selection → G2 step 3; group stays in G3 | same |
| three exception questions | merge into G2 "Confirm Sign-in Exceptions" | one sitting; owner question 2 |

---

## 4. Dependency-graph and mechanism consequences

1. **Per-answer edges, never per-group edges.** If "Know Your Tenant complete" became a prerequisite, one "Not sure" on Azure management would hold Block Legacy Authentication. Each answer keeps its own edge to the steps it changes, as the graph's `conditions` already do.
2. **Gate the right action.**
   - `create`: only where the answer changes the policy body or whether the policy applies (services, device plan, baseline mappings).
   - `enforce`: where it only adds an exception (mail devices, device code, partner). This matches today's rule in `answers.ts`: unanswered, the plan proceeds on evidence, and the step shows what the scan cannot see.
   - Never gate report-only creation on an exception answer. CLAUDE.md: "The tool helps with strictness and never requires it."
3. **New graph nodes** go through `docs/product/actionability/IAMAI-Actionability-Dependency-Playbook.md` into `dependency-data.json`:
   - `s-confirm-workloads`, with its six runtime edges moved into data.
   - Baseline mappings as a step.
   - G2 steps 3 and 5.
   - Edges from G2 step 3 to G3 step 3 and `s-shared-devices` (start).
   - Services (intune) → device plan (condition).
   - The device plan's runtime edges to mobile-app-protection and intune-enrollment-reauth, stated in data.
   - Unlock counts (`UNLOCKS`) and lane order will move. Walk, smoke and snapshots read these (`[snapshots]` commit tag).
4. **Answer storage.** `questionAnswers` is keyed `${stepId}:${label}`, and the option text is the stored answer. BLOCKED.md hits this repeatedly: device plan, device code, legacy auth, guests. Moving a question to a new step must not change its key. Decouple the storage namespace from the rendering step with one alias table like `REPAIR_STEP_ALIASES`. Also move `QUESTION_STEP`, `CONDITIONAL_INPUTS`, `DECISION_STEPS` and `unsavedInputsOf` to read from it. Saved plan files and the walk's `chooseOption` texts must keep working.
5. **One group registry.** Emergency Access is currently spread across id lists:
   - `EMERGENCY_STEP_IDS` and `partitionEmergencyItems` in `planBoard.ts`.
   - `isEmergencyTaskStep` / `isEmergencyJourneyStep` in `ContentStep.tsx`.
   - Id overrides in `planLanes.ts` for passkey settings and the exclusions group.

   Replace them with one registry before adding a group: key, words key, ordered member ids, pinned or not, and the completion rule "all members Completed". Put membership in the playbook next to `workType`/`scopeClass` so the graph and the board read one source. That is one fact with one source, and no title matching (the `planBoard.ts` header rule).
6. **Tiles.** Reuse `emergencySubjectTileOf` for subject-shaped steps: accounts (service-accounts group, dormant accounts), locations (trusted network), services (Confirm Services). The handoff says new tile designs need owner review, so reuse only.

---

## 5. Quality gap against the Emergency Access standard

Columns:
- **Authored:** a `content.json` step and an implementation package (LIBRARY status / validationResult).
- **Scan-verified:** completion comes from scan findings, not attestation.
- **Durable:** a re-scan reopens the step only on a real change, and an unread scan suspends it rather than failing it.
- **Done-when:** outcome-based and checkable.
- **Tests:** count of test files naming the id. This is a rough proxy.

| step | authored | scan-verified | durable | done-when | tests | known defects |
|---|---|---|---|---|---|---|
| Emergency Access ×4 | yes / pass or withheld | yes, per subject | yes (basis, generations, 90-day expiry) | yes | 36 / 26 / 16 / 7 + dedicated suites | live-accepted; persistence lifecycle test owed (handoff item 3) |
| Baseline mappings | settings UI only; no step, no package | answer only | per source id | none on the Plan | 3 | holds up to 14 policies' create; not visible as work |
| Confirm the Services You Use | words in `pages.app.plan.workflows` only; **no content step, no package**; AI Info only | usage signals + answer; `needsReview` on contradiction | partly (`workflowEvidenceBasis`) | "You have confirmed…" (attestation) | 5 | not in the graph; runtime patch in planLanes; snapshot shows its own title as its blocker reason ("after: Confirm the Services You Use") |
| Decide How Devices Are Managed | content + package (no Entra/JSON/PS, correct) | answer only | answer | "saved" | 12 | tile value and option wording blocked (option text is the stored answer) |
| Define the Trusted Network | yes / withheld | one finding (`trusted-network-choice`) | detection ≠ confirmation, good | yes | 11 | no IP-range entry (BLOCKED) |
| Allowed Countries | yes / withheld | exact-list match | work/travel legacy review | yes | 8 | travel sub-step hidden |
| Service Accounts Group | yes / withheld | exact membership | yes | partly attestation ("owner confirmed") | 8 | none selected → "doesn't apply" in the footer, so the classification is hard to find |
| Shared Devices | yes / withheld | picker + manual test record | manual evidence basis | manual test | 12 | classification buried in a policy step |
| Auth Strength | yes / withheld | exact match finding | yes | yes | 9 | picker does not pre-fill a scan match (U24) |
| Operator Passkey | yes / withheld; Entra + AI Info only | readiness from sign-in | via MFA Readiness | yes | 2 | thinnest test coverage of any gating step; gates the campaign and so 7 policies' enforce |
| Prepare Your Team for MFA | yes / withheld | readiness threshold | yes (043 corpus) | yes | 25 | snooze days disagree across channels (14 / 3 / bound); must align with MFA Readiness v3 |
| Security Defaults | yes / withheld | yes (`isEnabled`) | yes | yes | 8 | — |
| Per-user MFA | yes / withheld | partial ("Not fully read") | — | two-part | 4 | demo shows Ready · Review while its graph gate (MFA-for-everyone enforced) is far off. The review is allowed, but the row reads as actionable disabling; check. |
| Dormant accounts | yes / withheld | count reaches 0, or kept with a reason | per-account choices | yes | 12 | — |
| Separate admin accounts | yes / withheld | Outlook/Teams evidence | manual evidence | mixed | 5 | — |
| Exception questions (legacy auth, device code, partner) | on the policies | answer only | answer | — | 4–5 each | BLOCKED: option text = storage; partner None/Yes new shape; device-code AI Info contradicts the exclusions group |
| Policies (23) | packages mostly parts-withheld | lifecycle from scan | general 043 corpus | `doneEnd` + `doneWhen` | 11–55 | channels disagree on stage-to-report-only (auth transfer, device code, admin session); token-protection Entra contradicts the pin; first-party app ids read as missing objects |

---

## 6. Revisit order

1. **Baseline mappings → a Know Your Tenant row.** It holds the most policies (14 creates) and is invisible as work. Build it at the Emergency Access standard: a subject tile per source reference, a scan check that the mapped object exists, Completion Criteria. Needs an owner decision (question 3).
2. **Confirm the Services You Use.**
   - Put it in the graph and delete the planLanes patch.
   - Add a content step, a package and a subject tile per service.
   - Tests: the answer gates only its own goals; contradicting evidence reopens it; a re-scan with no change moves nothing.

   It is cheap, it anchors G2, and it has six runtime dependents plus the baseline reviews.
3. **Group registry + heading keys.** This is the enabling step for any new group. Emergency Access keeps behaving exactly as now; prove it with the existing emergency tests and snapshots.
4. **Get Ready for MFA: operator passkey and campaign.** Together they gate 7 policies' enforce action. Operator passkey has 2 test files. The campaign has a live content disagreement and must read MFA Readiness v3.
5. **Identify Accounts That Are Not People (split).** Fixes people counts plan-wide and the footer-only discoverability. Mirrors Emergency Access Step 1 → Step 2.
6. **Trusted Network and Allowed Countries (G3).** 4 + 2 dependents. The IP-range entry is the known gap. Both already verify by scan, so this is mostly tiles and tasks.
7. **Confirm Sign-in Exceptions (merge).** Only after the storage alias table (§4.4) exists, because every BLOCKED item on these questions is about stored option text.
8. **Security Defaults / per-user MFA cutovers.** They gate every enforcement when SD is on. Resolve per-user MFA "Not fully read" and the Ready-while-gated reading.
9. **Account hygiene.** No dependents.
10. **Policy steps.** A separate package-quality track. The channel disagreements in BLOCKED.md need owner calls first.

---

## 7. Open questions for the owner

1. **Group layout:** G2 and G3 as two groups (answers vs Entra objects), or one "Prepare Your Tenant" group with two sub-headings?
2. **Exception questions:** should Mail-sending devices, Device code sign-in and Partner/MSP access move off their policy steps into Know Your Tenant, or stay there with Know Your Tenant as a hub linking to them?
3. **Baseline mappings:** promote them from Plan settings to a Plan row while any are pending?
4. **Account selection:** split the service-account and shared-device selection into their own step, mirroring Emergency Access Step 1 → Step 2?
5. **Intune "Not in use":** should that answer retire the device decision and the Intune policies, or only defer them?
6. **Cutovers:** should Security Defaults and per-user MFA sit inside Get Ready for MFA (the group stays open until enforcement) or stay in the lanes?
7. **Pinning:** how many groups can be pinned at once, and in what order? Emergency Access then Know Your Tenant, or Know Your Tenant first because it takes minutes?
8. **Retirement:** retire `cleanup-notAssessed`, `s-question-travel`, and the free-tier ladder?
9. **Tiles:** may the Emergency Access subject tile be reused for services, source references, locations and account lists? A new design would need your review.
10. **Headings:** adopt About this Step / Tasks Remaining / Implementation Tasks / Completion Criteria for grouped steps only, or for every step?
11. **Emergency follow-ups:** show Alert on Emergency Account Sign-ins and Harden Emergency Access as follow-ups under the completed Emergency Access group, or leave them in Cleanup?

Not verified in this study: live rendering of any proposal; whether `sourceMapping:62d67e66` still holds 14 steps on the current demo (the graph says so, and memory from 2026-09-08 said 13 of 17); whether `cleanup-notAssessed` renders on any non-CA path.

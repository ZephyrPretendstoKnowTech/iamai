# Step redundancy analysis (read-only audit, 2026-09-19)

Answering the owner's question before the wider UI rollout:

> "each individual step should be evaluated for redundancy BEFORE you create it.
> For example, I thought the Trusted Network step was part of the info about your
> tenant group 2. Make sure we aren't saying 'Wait, why are there two steps that
> do the same thing but are built entirely separate?'"

**Short answer: the instinct is right.** The Trusted Network step *is* the doing
of a Direction question, and today it does not say so — it still shows a tile
that reads "Choose your office networks", which is the question D4 already asks.
It is not the only one. Eight more pairs behave the same way, five registry
members can never be generated at all, and two steps ship with **word-for-word
identical Completion Criteria** in two different groups.

Nothing in this document was changed. No code, no content, no commit.

## Method

Read: `src/roadmap/stepGroups.ts` (the registry), the generators
(`generate.ts`, `direction.ts`, `workflows.ts`, `ladder.ts`, `blockerSteps.ts`,
`manualWork.ts`, `cleanupPhase.ts`, `cleanup.ts`), the answer plumbing
(`answers.ts`, `directionAnswers.ts`, `decisions.ts`), the step words in
`docs/design/content.json` (`steps[]`, `cleanup`, `pages.app.plan.direction`),
the goal catalogue (`data/goals.json`), the pinned goal map
(`baselines/jhope188-conditionalaccesspolicies.pinned.json`), and the rendered
readings in `docs/qa/step-snapshots/demo` and `…/demo-week2`.

**67 step identities analysed:** 56 registry-listed members + the
`s-review-baseline-*` family (one per unassessed baseline policy; 4 on the demo)
+ 9 free-tier ladder rungs + `s-blocker-pilot-group`.

"What a person sees today" is quoted from the demo snapshot of that step unless
another fixture is named.

---

## 1. Every step the plan can generate

Group keys: **EA** Establish Emergency Access (pinned) · **DIR** Decide Your
Tenant's Direction (pinned) · **CD** Close the Doors · **PA** Protect Your
Administrators · **MFA** Turn On MFA for Everyone · **LOC** Control Where People
Sign In From · **DEV** Require Healthy Devices · **RISK** Respond to Risk and
Limit Sessions · **ONG** Ongoing Checks and Cleanup (catch-all) · **—** in no
listed group (falls to ONG).

| # | Id | Title | Grp | Asks | Checks in tenant | Produces | Completed by |
|---|---|---|---|---|---|---|---|
| 1 | `s-prereq-break-glass` | Prepare Emergency Access Accounts | EA | Which accounts are the emergency accounts | `bg.*` rules: cloud-only, onmicrosoft.com, permanent GA, approved passkey | `breakGlassUserIds` | Every must-fix `bg.*` check passes on scan |
| 2 | `s-prereq-exclusion-group` | Configure Emergency Exclusions | EA | Which group is the exclusions group | Group config, membership, exclusion on every On/Report-only policy | The exclusions group id | Scan verifies group + required policy exclusions |
| 3 | `s-prereq-passkey-settings` | Configure Passkey Authentication | EA | Approved passkey models | FIDO2 method policy, key restrictions, AAGUIDs, TAP | The Fido2/TAP method configuration | `passkeyReadingOf` reads `inPlace` |
| 4 | `cleanup-drill` | Verify Emergency Access | EA | — | A qualifying passkey sign-in per emergency account ≤90d, after the final config | A recovery test record | Every selected account has a qualifying sign-in |
| 5 | `s-direction-use` | Confirm What You Use | DIR | AVD · SharePoint/OneDrive off-network · Azure management · Inforcer · Entra Connect sync · **mail-sending devices** · **device code** · **partner/MSP** · external methods | 30-day sign-ins, SP activity, role assignments, auth-methods policy | `workflowAnswers`, `facetOverrides`, and answers written to `s-goal-block-legacy-auth`, `s-goal-block-device-code`, `s-goal-guests-mfa` | Every answer approved |
| 6 | `s-direction-accounts` | Identify Service and Shared Accounts | DIR | **Service accounts** · **shared device accounts** | `detectServiceAccounts`, `sharedDeviceUsers` | `serviceAccountUserIds`, `sharedDeviceUserIds` | Every answer approved |
| 7 | `s-direction-devices` | Decide How People and Devices Sign In | DIR | Computers · phones · device exceptions | Unjoined-computer and phone sign-ins (shown as "Today:") | `questionAnswers['s-prereq-device-plan:…']` | Every answer approved |
| 8 | `s-direction-locations` | Decide Where People Sign In From | DIR | **Office network** · **work countries** · **travel** | Trusted IP named locations, 30-day country spread | `trustedLocationIds`, `allowedCountries`, travel answer | Every answer approved |
| 9 | `s-goal-block-legacy-auth` | Block Legacy Authentication | CD | Mail-sending devices (now: link to D1) | Policy On, clientAppTypes, grant, exclusions | The CA policy | Policy matches target **and** the mail-devices answer is saved |
| 10 | `s-question-mail-devices` | Update How Devices Send Email | CD | — | Legacy-auth policies reaching the named accounts | A manual record (route, test, exception removed) | `completeManualEvidence` — manual only |
| 11 | `s-goal-block-device-code` | Block Device Code Sign-in | CD | Device code sign-in (now: link to D1) | Policy On + auth-flow condition | The CA policy | Policy matches **and** the device-code answer is saved |
| 12 | `s-goal-block-auth-transfer` | Block Authentication Transfer | CD | — | Policy On + auth-flow condition | The CA policy | Scan confirms policy On, assignments/exclusions intact |
| 13 | `s-goal-block-unsupported-platforms` | Block Unsupported Device Platforms | CD | — | Policy On + platform condition | The CA policy | Scan confirms policy On |
| 14 | `s-ladder-operator-passkey` | Register Your Own Passkey | PA | — | Operator's registered methods + a phishing-resistant sign-in | Nothing in the tenant IAMAI writes | Operator has a phishing-resistant sign-in in the records |
| 15 | `s-prereq-auth-strength` | Create the Baseline's Authentication Strength | PA | — | `unmatchedStrengths` against the baseline's required combinations | A custom authentication strength | A scanned strength matches the required combinations |
| 16 | `s-goal-admins-phishing-resistant` | Require Phishing-Resistant MFA for Admins | PA | — | Policy + admin readiness threshold | The CA policy | Policy enforced + admins can meet it |
| 17 | `s-goal-admin-session` | Shorten Admin Sessions | PA | — | Session policy: sign-in frequency, persistent browser | The CA policy | *"A scan confirms the session policy is On with the intended sign-in frequency, browser persistence, assignments and exclusions."* |
| 18 | `s-goal-pim-activation-reauth` | Require MFA at Every Role Activation | PA | — | Policy + authentication context wired to role settings | The CA policy | Policy + a recorded role-activation test |
| 19 | `s-goal-azure-management-mfa` | Require MFA for Azure Management | PA | — | — | — | **Never generated with the pinned baseline** (not in the goal map) |
| 20 | `s-goal-register-info-protected` | Protect Sign-in Method Registration | MFA | — | Policy; TAP policy exists; trusted location exists; people without a method | The CA policy (floor template if absent from baseline) | Policy enforced + registration/recovery paths work |
| 21 | `s-goal-device-registration-mfa` | Require MFA to Register a Device | MFA | — | Policy + `deviceRegistrationPolicy` legacy MFA setting | The CA policy | Policy + legacy device-registration MFA is No + workflow test |
| 22 | `s-verify-mfa` | Prepare Your Team for MFA | MFA | Who needs help registering | Per-person MFA readiness (30-day evidence) | `specialCareConfirmed` | Everyone has a suitable method; the help list is confirmed |
| 23 | `s-prereq-security-defaults` | Turn Off Security Defaults | MFA | — | `securityDefaults.isEnabled` | Security defaults off | Security defaults off **and** three named policies enforced |
| 24 | `s-goal-mfa-all-users` | Require MFA for Everyone | MFA | — | Policy + 90% readiness gate | The CA policy | Policy enforced + representative users can satisfy MFA |
| 25 | `s-goal-guests-mfa` | Require MFA for Guests | MFA | Partner/MSP access (now: link to D1) | Policy + cross-tenant access settings | The CA policy | Policy + the partner answer is saved |
| 26 | `s-question-partner` | Exclude the Partner or MSP Accounts | MFA | — | Guests/geo policies' Service-provider exclusion | A manual record (provider access path) | Both policies exclude Service provider on next scan + manual record |
| 27 | `s-prereq-per-user-mfa` | Finish Moving Off Per-User MFA | MFA | — | `perUserMfa` state per account, migration state | Per-user MFA disabled | No account Enabled/Enforced (auto-satisfied when the scan reads 0) |
| 28 | `s-prereq-trusted-location` | Define the Trusted Network | LOC | Which locations are yours (now: link to D4) | IP named locations, trusted flag, `trustedLocationIds` | A trusted IP named location | A trusted IP location exists and matches the picked ids |
| 29 | `s-prereq-allowed-countries` | Create or Correct Allowed Countries Location | LOC | Work countries, recurring travel (now: link to D4) | Countries named location matching `allowedCountries` | A countries named location | Location exists with exactly the confirmed countries |
| 30 | `s-goal-geo-restriction` | Block Sign-ins From Countries Not Allowed | LOC | — | Policy + location reference | The CA policy | Policy enforced + blocked sign-ins reviewed |
| 31 | `s-question-travel` | Arrange Access Before Travel | LOC | — | Policies with a location condition | A trip log | **Never generated** (`answeredCarveOuts` never pushes it) |
| 32 | `s-prereq-service-accounts-group` | Create or Correct Service Accounts Group | LOC | Which accounts are service accounts (now: link to D2) | Group membership == `serviceAccountUserIds` | The service accounts group | Group holds exactly the confirmed accounts |
| 33 | `s-goal-service-accounts-trusted-network` | Restrict Service Accounts to the Trusted Network | LOC | — | Policy + the named network it references | The CA policy | Policy + a recorded service-job test from the network |
| 34 | `s-goal-workload-identity-block` | Restrict the Entra Connect Sync Account to Its Address | LOC | — | Workload-identity policy + the sync identity | The CA policy | Policy + the sync workflow succeeds |
| 35 | `s-prereq-device-plan` | Decide How Devices Are Managed | DEV | Phones · Computers (+ legacy "Block phones") | — | `questionAnswers['s-prereq-device-plan:…']` | **Never generated** (D3 replaced it; only its storage keys survive) |
| 36 | `s-goal-require-managed-device` | Require a Managed Device Outside the Office | DEV | — | Policy + device-compliance threshold + trusted location | The CA policy | Policy enforced + work access succeeds outside trusted locations |
| 37 | `s-goal-intune-enrollment-reauth` | Require a Fresh Sign-in for Intune Enrollment | DEV | — | Policy + enrollment workflow test | The CA policy | Policy + enrollment paths work |
| 38 | `s-ladder-phone-access-restriction` | Keep Company Data Off Phones | DEV | — | Phone-platform block policies | A CA restriction for iOS/Android | Manual record: restriction enforced and tested |
| 39 | `s-goal-mobile-app-protection` | Require App Protection on Phones | DEV | — | — | — | **Never generated with the pinned baseline** |
| 40 | `s-goal-unmanaged-browser` | Limit Unmanaged Devices in the Browser | DEV | — | — | — | **Not a generatable id at all** (see finding 4) |
| 41 | `s-shared-devices` | Give Shared Devices Their Own Policy | DEV | Which accounts are shared devices (now: link to D2) | Policies reaching the shared accounts; trusted location | A CA block policy for shared devices | Manual record: the device completes its task from the approved network |
| 42 | `s-goal-sign-in-risk` | Challenge High-Risk Sign-ins | RISK | First enforcement (strength vs plain MFA) | Policy + risky sign-in review | The CA policy | Policy + affected people can satisfy the requirement |
| 43 | `s-goal-user-risk` | Remediate High-Risk Users | RISK | — | Policy + recovery prerequisites (writeback) | The CA policy | Policy + users can complete the password change |
| 44 | `s-goal-sign-in-risk-medium` | Challenge Medium-Risk Sign-ins | RISK | — | Policy On + intended MFA controls | The CA policy | Scan confirms the medium-risk policy is On |
| 45 | `s-goal-user-risk-medium` | Reset Passwords for Medium-Risk Users | RISK | — | Policy + recovery prerequisites | The CA policy | Policy + a recorded recovery-workflow test |
| 46 | `s-goal-all-users-no-persistence` | Limit How Long Sessions Last | RISK | — | Session policy: sign-in frequency, persistent browser | The CA policy | *"A scan confirms the session policy is On with the intended sign-in frequency, browser persistence, assignments and exclusions."* |
| 47 | `s-goal-token-protection` | Require Token Protection on Windows | RISK | — | Policy + Windows client scope | The CA policy | Scan confirms token protection On |
| 48 | `s-goal-admin-portals-protected` | Block the Admin Portals for Non-Admins | ONG | — | Policy (baseline defines it two ways → conflict) | The CA policy | Policy enforced |
| 49 | `s-goal-inforcer-mfa` | Require MFA for Inforcer Access | ONG | — | Policy + the Inforcer application id | The CA policy | Policy + the intended user can reach Inforcer with MFA |
| 50 | `s-check-dormant-accounts` | Disable or Confirm Dormant Accounts | ONG | Per account: disable or keep (with a reason) | `notActiveUsers` (no sign-in) | `dormantAccountChoices` | Every listed account disabled, active again, or kept with a reason |
| 51 | `s-check-separate-admin-accounts` | Use Separate Accounts for Admin Work | ONG | Reviewed accounts, replacement account, roles, outcome | Role holders with Outlook/Teams activity; active + eligible roles | A manual handover record | Manual record complete + everyday account has no privileged roles |
| 52 | `cleanup-alerting` | Alert on Emergency Account Sign-ins | ONG | Recipient, outcome | — (records only) | An alert rule (outside Entra) | A recorded successful alert test |
| 53 | `cleanup-hardening` | Harden Emergency Access | ONG | — | The deferred `bg.*` recommendations | — | Every deferred recommendation passes on a scan |
| 54 | `cleanup-consolidation` | Review Overlapping Policies | ONG | Retain both / which to retire | Overlapping + superseded policy names | A retirement decision record | Each overlap reviewed and verified on rescan |
| 55 | `cleanup-naming` | Align Policy Names | ONG | Approve the proposed names | Outliers against the tenant convention | Renamed policies | The reviewed policies use the approved names |
| 56 | `cleanup-notAssessed` | Review Baseline Policies IAMAI Did Not Assess | ONG | — | — | — | **Never generated** (`generate.ts:2528` passes `notAssessed: []`) |
| 57 | `s-review-baseline-*` | Review the baseline's *<policy>* | ONG (prefix) | Manual attestation | The source policy JSON + its mapped references | A manual review record | Attestation matching the current basis; set aside if its D1 service is No |
| 58 | `s-ladder-security-defaults` | *(free tier)* Turn security defaults **on** | — | — | `securityDefaults.isEnabled` | Security defaults on | Scan reports enabled |
| 59 | `s-ladder-legacy-auth-inventory` | *(free tier)* Legacy client inventory | — | Reviewed accounts, owners, plans | 30-day legacy sign-ins | A manual inventory record | No successful legacy sign-in, or each has a recorded plan |
| 60 | `s-ladder-app-passwords` | *(free tier)* Remove app passwords | — | Reviewed accounts | Per-user MFA state | A manual record | App passwords removed, creation disabled |
| 61 | `s-ladder-per-user-mfa-cleanup` | *(free tier)* Per-user MFA cleanup | — | — | Per-user MFA states | — | Superseded by #27 via `COVERED_BY_STEP` |
| 62 | `s-ladder-admin-accounts-separate` | *(free tier)* Separate admin accounts | — | Same fields as #51 | Active + eligible roles | A manual handover record | Same Completion Criteria as #51, word for word |
| 63 | `s-ladder-global-admin-count` | *(free tier)* Global Administrator count | — | Purpose of each assignment | Active + eligible GA holders | A manual record | Each assignment has a recorded purpose |
| 64 | `s-ladder-guest-review` | *(free tier)* Guest review | — | Retain / revoke per guest | Guest accounts + invitation state | A manual record | Each guest has a purpose or a completed removal |
| 65 | `s-ladder-stale-accounts` | *(free tier)* Stale accounts | — | Per account | 90-day sign-in absence | `dormantAccountChoices` (shared with #50) | No enabled account 90 days idle, or recorded as kept |
| 66 | `s-ladder-authenticator-over-sms` | *(free tier)* Authenticator over SMS | — | Reviewed accounts, test | SMS/Voice method states + replacement registrations | A manual record | SMS/Voice off + everyone registered a replacement |
| 67 | `s-blocker-pilot-group` | *(validation)* Pilot group | — | — | `pilotGroup` must-fix rules | — | Every must-fix check passes (no other subject reaches `blockerSteps`) |

---

## 2. Findings, ranked by how confusing they are to a real admin

### Finding 1 — Two steps with identical Completion Criteria, in two different groups
**`s-goal-admin-session` (Shorten Admin Sessions, Protect Your Administrators #4)
and `s-goal-all-users-no-persistence` (Limit How Long Sessions Last, Respond to
Risk and Limit Sessions #5).**

**Evidence.** `docs/design/content.json`, step `admin-session` and step
`session-lifetime` (reached by `CONTENT_ALIAS['all-users-no-persistence'] =
'session-lifetime'` in `src/content/stepTitle.ts`). Their `doneWhen` arrays are
byte-identical:

> "A scan confirms the session policy is On with the intended sign-in frequency,
> browser persistence, assignments and exclusions."
> "Representative browser sign-ins behave as intended without interrupting normal
> work."

**What a person sees today.** Both are on the demo, both "Up Next", both with the
same two prerequisite tiles ("Prepare Emergency Access Accounts", "Configure
Emergency Exclusions"), 40 rows apart, under two different headings. Opening
either one shows the same Completion Criteria. Nothing on the screen says one is
admins-only and the other is everyone — the only distinguishing words are in
*About this Step*, which is below the fold on a phone.

**Recommendation — LINK (and fix the words).** They are genuinely two policies in
the pinned baseline (`admin-session` scopes to core admins with a 12-hour
sign-in frequency; `all-users-no-persistence` scopes to all users with
persistent-browser-never only), so do not merge. But the Completion Criteria must
name their scope: *"…for the core administrator roles…"* vs *"…for all users…"*.
Each should also say the other exists, because an admin covered by both gets the
stricter of the two. This is the single most likely "why are there two of these?"
moment in the product.

---

### Finding 2 — The trusted network is asked in D4 and asked again on its own step
**`s-direction-locations` (D4, question `officeNetwork`) and
`s-prereq-trusted-location` (Define the Trusted Network, LOC #1).** This is the
owner's own example, and it is real.

**Evidence.**
- D4 asks, `content.json` `pages.app.plan.direction.questions.officeNetwork`:
  label **"The office network"**, options **"Trusted locations"** /
  **"Everyone works remotely"**, with a location picker.
- The answer is stored under the old step's key:
  `directionAnswers.ts:89` — `officeNetwork: { storedAs: 'trustedLocationIds,
  wizardAnswered.trustedLocations' }`, written back by `legacyDecisionsOf` as a
  decision on `PREREQ_STEP_ID.trustedLocation`.
- `direction.ts:279` `ANSWERED_IN[s-prereq-trusted-location] = ['officeNetwork']`,
  so `ContentStep.tsx:484` swaps the step's decision control for the read-only
  "Answered in Decide Where People Sign In From" panel. **That part is correct.**
- But `generate.ts:1027` still builds a `configurationFindings` tile on the same
  step whose value, when the question is unanswered, is literally
  `'Choose your office networks'`, with the detail *"Select your office networks
  or confirm that everyone is remote."*

**What a person sees today.** `docs/qa/step-snapshots/demo/s-prereq-trusted-location.json`:

> `"badge": "Ready · Create"`, `"tiles": [{ "label": "Trusted Network", "state":
> "Choose your office networks" }]`

beside `docs/qa/step-snapshots/demo/s-direction-locations.json`:

> `"badge": "Ready · Decision"`, `"bar": "Needs a decision"`

So on first visit the plan shows a pinned step asking you to choose your office
network, **and** a second step in a lane below telling you to choose your office
networks. The second one is also the only step of the two that draws the old
heading set — `"headings": ["Why", "Readiness", "Implementation", "Done when"]`
against D4's `["About this Step", "Questions", "Completion Criteria"]` — which
is what makes it read as "built entirely separate".

This is already logged as loose end 10 in `weekend-launch.md`.

**Recommendation — LINK, and correct the tile.** Keep the step: creating a
trusted IP named location in Entra is real work that D4 cannot do (D4 can only
*pick from* locations that already exist). But:
1. The tile's unanswered value must become the wait, not a second question:
   `"Trusted Network: Answered in Decide Where People Sign In From"`, or drop the
   tile entirely while the answer is unsaved and let the step read On Hold ·
   Waiting on your direction like every other Direction-dependent step.
2. There is an ordering defect underneath: D4's picker can only offer trusted IP
   named locations the scan already found (`direction.ts:174`), so on a tenant
   with none the only honest D4 answer is "Everyone works remotely" — and then
   the step that would have created one never gets a reason to run. The step
   should be the **first task of the D4 answer**, not a separate row the answer
   can silently switch off.

---

### Finding 3 — The same wait is said twice, in two different vocabularies, on the same step
**Nine policy steps carry both a `Prerequisite · To do` tile *and* a
`Waiting on your direction` tile for the same underlying fact.**

**Evidence.** `docs/qa/step-snapshots/demo/s-goal-service-accounts-trusted-network.json`:

> `"tiles": [ {"Affected people": "Not established"},
> {"Prerequisite · To do": "Define the Trusted Network"},
> {"Prerequisite · To do": "Create or Correct Service Accounts Group"},
> {"Prerequisite · To do": "Prepare Emergency Access Accounts"},
> {"Waiting on your direction": "Identify Service and Shared Accounts"},
> {"Waiting on your direction": "Decide Where People Sign In From"} ]`

Six tiles; four of them are two facts said twice. "Create or Correct Service
Accounts Group" and "Waiting on your direction: Identify Service and Shared
Accounts" are the *same* blocker — the group cannot exist until D2 names its
members (`generate.ts:1077`: the group step is only generated once
`serviceAccountUserIds.length > 0 || wizardAnswered.serviceAccounts`). Likewise
"Define the Trusted Network" and "Waiting on your direction: Decide Where People
Sign In From".

`s-goal-register-info-protected` is worse — it states the trusted network **three
times**:

> `{"Prerequisite · To do": "Define the Trusted Network"}`,
> `{"Prerequisites": "when 1 trusted location exist (now 0)"}`,
> `{"Waiting on your direction": "Decide Where People Sign In From"}`

**Recommendation — MERGE the readings, in `ui/surfaces/planLanes.ts` /
`stepContract.ts`.** One fact, one tile. Where a prerequisite step is itself held
by a Direction answer, the policy should show only the nearest cause — the
prerequisite step — and let *that* step show the Direction wait. The numeric
gate ("when 1 trusted location exist (now 0)") is the same sentence as the
prerequisite step's name and should not be a separate tile at all.

---

### Finding 4 — Five registry members can never be generated
**`s-prereq-device-plan`, `s-question-travel`, `s-goal-unmanaged-browser`,
`s-goal-mobile-app-protection`, `s-goal-azure-management-mfa`** (plus
`cleanup-notAssessed`, finding 8).

**Evidence.**
- `s-prereq-device-plan` — `generate.ts:1135-1137` replaced it with D3 and says
  so in a comment; no `prereq('s-prereq-device-plan')` push survives. Its
  content entry still exists with a full decision block (`"label": "Phones",
  "options": ["Enroll phones in Intune", "Protect company apps only", "Keep
  company data off phones"]`, question `"Computers"`). Only its *answer keys*
  live on, as D3's storage (`directionAnswers.ts:86-87`).
- `s-question-travel` — `answers.ts:194-201` `answeredCarveOuts` pushes only
  `partner` and `mailDevices`; the travel branch is commented "Operational trip
  management is hidden for V1". `v1-step-inventory.md` already recorded it as
  "**Never**".
- `s-goal-unmanaged-browser` — **not a real id.** `stepIdForGoal` builds
  `s-goal-<goalId>`, and there is no goal `unmanaged-browser`. The two real goals
  are `byod-session-controls` and `block-downloads-unmanaged`, both of which
  `CONTENT_ALIAS` points at the single content entry `unmanaged-browser`
  (`stepTitle.ts:17-18`). `grep` finds `s-goal-unmanaged-browser` in exactly one
  source file: `stepGroups.ts:131`.
- `s-goal-mobile-app-protection`, `s-goal-azure-management-mfa` — neither goal is
  in the pinned goal map (`baselines/jhope188-conditionalaccesspolicies.pinned.json`
  maps 23 goals; these two are not among them), and neither is a floor goal
  (`floor.ts:18` — only `register-info-protected` and `block-legacy-auth`). A
  goal absent from the baseline and not on the floor produces no step.

**What a person sees today.** Nothing — which is the point. None of the five
appears in any of the eight fixture snapshot sets. But `policy-groups-proposal.md`
presents all five to the owner as real steps to redline, so the group sizes in
that document are wrong: "Require Healthy Devices" is a 7-step group of which
**4 can appear** with the pinned baseline.

**Recommendation — DELETE from the registry** (all five), and delete the
`s-prereq-device-plan` and `s-question-travel` content entries once their
answer-storage keys are moved onto the Direction step ids. Latent duplicate to
watch: if `byod-session-controls` and `block-downloads-unmanaged` ever both
become applicable, the plan generates **two steps with the same title, the same
`why` and the same Completion Criteria**, and both fall into the "Ongoing Checks
and Cleanup" catch-all because neither id is listed anywhere. Decide now which
of the two is the step and alias the other, exactly as `per-user-mfa-cleanup` is
aliased today.

---

### Finding 5 — `s-question-partner` is nothing but a pointer at two other steps' Implementation Tasks
**`s-question-partner` (Exclude the Partner or MSP Accounts, MFA #7).**

**Evidence.** Its entire `whatToDo` in `content.json`:

> "Require MFA for Guests and Block Sign-ins From Countries Not Allowed carry
> your chosen Service provider exclusion in their Implementation instructions.
> Follow each policy step's current action; do not recreate a policy that is
> already in place."
> "Delegated administration (GDAP) and ordinary guest (B2B) access are separate
> paths. Review inbound MFA trust for ordinary B2B collaboration on its own
> merits; do not turn it on as a fix for delegated administration."

Its `doneWhen`: *"Both policies exclude the Service provider type on the next
scan, where you chose to exclude service providers."* — a fact about two other
steps. It creates no object, writes no tenant change, and is generated only when
`serviceProvidersExcluded(mapping)` is true (`answers.ts:198`). The question it
is named for now lives in D1 (`partner`), and `s-goal-guests-mfa` already shows
"Answered in Confirm What You Use".

**What a person sees today.** It does not appear in any fixture (it needs an
answered "Yes" to the partner question). When it does appear, an admin gets a
step whose first instruction is "go and read two other steps".

**Recommendation — FOLD into `s-goal-guests-mfa` and `s-goal-geo-restriction`.**
Its one non-redundant contribution is the GDAP-vs-B2B warning, which belongs in
the guests policy's help-desk block, and the manual "Provider Access Path"
evidence field (`manualWork.ts:58`), which belongs on the guests step as a task.
Delete the step.

---

### Finding 6 — `s-question-mail-devices` is a subset of Block Legacy Authentication's tasks
Confirms the close-doors report's flag (`close-doors-spec.md` §3, §8.4).

**Evidence.** The step is generated only when the Block-Legacy-Auth answer names
accounts (`answers.ts:199`). Its second instruction reads:

> "Until each device moves, Create or Correct Service Accounts Group keeps these
> accounts out of Block Legacy Authentication."

and its `doneWhen`:

> "Every listed device sends through its approved replacement route, and its old
> account exception has been removed."

That is the removal of an exception the Block Legacy Authentication policy
carries. It has content `kind: "check"`, so — per `close-doors-spec.md` §7 — it
draws the *default* headings ("Why / Readiness / Implementation / Done when")
beside four policy steps drawing the Emergency Access anatomy, in the same
group. The spec also records that the group heads "4 steps" and numbers its rows
1, 3, 4, 5 because this member is not generated.

**Recommendation — FOLD into `s-goal-block-legacy-auth`** as a second
Implementation Task ("Move each exception device to a supported route"), keeping
its manual evidence fields (`Mail Job and Delivery Route`, `Temporary Exception
Removed`). One step, two tasks, one outcome: nothing signs in over a legacy
protocol and no temporary exception is left. This also removes the anatomy
mismatch inside the group.

---

### Finding 7 — D1's mail-devices answer silently rewrites D2's service-accounts answer
**`s-direction-use` (mailDevices) and `s-direction-accounts` (serviceAccounts)
write the same list.**

**Evidence.** `src/roadmap/decisions.ts:315-319`:

```
const devices = mailDevicesOf(next).filter((id) => !next.serviceAccountUserIds.includes(id))
if (devices.length > 0) {
  next.serviceAccountUserIds = [...next.serviceAccountUserIds, ...devices]
  next.serviceAccountRejectedIds = next.serviceAccountRejectedIds.filter((id) => !devices.includes(id))
}
```

So approving D1 can add accounts to `serviceAccountUserIds` — the exact list D2
asks a person to curate — and can *un-reject* an account the person previously
rejected in D2. `s-prereq-service-accounts-group`'s Completion Criteria is *"The
group exists with exactly the confirmed accounts."*, and those accounts are now
partly a side effect of a different Direction step.

**What a person sees today.** Not visible at all. A person approves D1, returns
to D2, and the account count has changed with no explanation; then the group step
asks them to add a member they never picked.

**Recommendation — LINK, visibly.** D2's `serviceAccounts` question must show a
note like the existing `alreadySetAside` one ("The Emergency Access accounts are
already set aside: …") — e.g. *"Mail-sending devices you named in Confirm What
You Use are included: …"*. And `s-prereq-service-accounts-group`'s member list
should mark which members came from which answer. Alternatively (cleaner) stop
merging the two lists and give the mail-device exceptions their own group, since
they are temporary by definition and the service-accounts group is not.

---

### Finding 8 — `cleanup-notAssessed` and the `s-review-baseline-*` rows are the same list
**`cleanup-notAssessed` (Review Baseline Policies IAMAI Did Not Assess, ONG #9)
and the `s-review-baseline-*` family (ONG, by prefix).**

**Evidence.** Both are fed from `input.coverage.organisation.notAssessed`:
`generate.ts:2472` `addWorkflowSteps(steps, input.coverage.organisation.notAssessed, …)`
builds one step per policy, and `cleanup.ts:50` would build the single cleanup
row from the same array. The conflict is already resolved in code — but by
blanking the input, at `generate.ts:2528`:

```
organisation: { ...input.coverage.organisation, notAssessed: [] },
```

and `cleanupPhaseFor` has exactly one caller, so the row is **unreachable**.

**What a person sees today.** Four individual review rows on the demo
(`s-review-baseline-iac-app-block-avd-…`, `…-avd-exclude-allowedavdusers-…`,
`…-sharepoint-onedrive-…`, `…-windowsazuread-baselinescopes-…`), each *"On Hold ·
Waiting on your direction: Confirm What You Use"*. No cleanup row.

**Recommendation — DELETE `cleanup-notAssessed`** from `stepGroups.ts`, from
`cleanup.ts`'s `ORDER` and `CleanupKind`, and from `content.json`'s `cleanup`
block; `v1-step-map.md` §5 already says "Retire". Today the truth lives in two
places and one of them is disabled by passing it an empty array — exactly the
"if a fact has two sources, delete one" rule in CLAUDE.md.

---

### Finding 9 — `s-check-separate-admin-accounts` and `s-ladder-admin-accounts-separate` are one step with two ids
**And the same is true of `s-check-dormant-accounts` / `s-ladder-stale-accounts`.**

**Evidence.**
- The two admin-separation entries in `content.json` have **identical** `doneWhen`
  arrays, word for word:
  > "The reviewed privileged accounts are confirmed as dedicated to administrator
  > work, or each recorded handover has a tested replacement with the required
  > roles and the everyday account no longer has privileged roles."
  > "Mailbox licensing and past mail or Teams activity are clues for the review;
  > their absence does not prove separation."
- `manualWork.ts:48` puts both in one set —
  `const ADMIN_SEPARATION = new Set(['s-ladder-admin-accounts-separate', 's-check-separate-admin-accounts'])`
  — and every branch that follows treats them identically.
- `generate.ts:2475` does the same for the dormant pair:
  `steps.filter(s => ['s-check-dormant-accounts', 's-ladder-stale-accounts'].includes(s.id))`.
- The correct pattern already exists two lines away: `ladder.ts:36`
  `COVERED_BY_STEP = { 'per-user-mfa-cleanup': 's-prereq-per-user-mfa' }` makes
  the ladder rung *defer* to the real step instead of duplicating it, and
  `manualWork.ts:257` aliases their saved confirmations.

They never appear together (the ladder is free-tier only), so no admin sees both
— but every change to the words or the evidence has to be made twice, and one of
the two will drift.

**Recommendation — MERGE via the existing mechanism.** Add
`'admin-accounts-separate': 's-check-separate-admin-accounts'` and
`'stale-accounts': 's-check-dormant-accounts'` to `COVERED_BY_STEP`, then delete
the two ladder content entries and the `ADMIN_SEPARATION` / dormant id sets.
`v1-step-map.md` §5 retires the ladder for V1 anyway, which makes this free.

---

### Finding 10 — The three `s-question-*` steps no longer ask a question
**`s-question-mail-devices`, `s-question-partner`, `s-question-travel`.**

**Evidence.** All three questions moved to D1/D4 (`ANSWERED_IN`,
`direction.ts:278-286`; `DIRECTION_QUESTIONS`, `directionAnswers.ts:78-92`). What
is left is follow-up work (findings 5 and 6) or nothing (finding 4). The id
prefix `s-question-` now means the opposite of what it says, and it is the prefix
an engineer greps for when looking for where a question is asked.

**Recommendation — rename or delete.** Deleting `s-question-partner` (finding 5),
folding `s-question-mail-devices` (finding 6) and deleting `s-question-travel`
(finding 4) empties the prefix entirely. Do that rather than renaming.

---

### Finding 11 — Four risk steps that are two decisions
**`s-goal-sign-in-risk` / `s-goal-sign-in-risk-medium`, and `s-goal-user-risk` /
`s-goal-user-risk-medium`** (RISK #1–#4).

**Evidence.** The medium entries' own `why` concedes the resemblance:
`sign-in-risk-medium` — *"It provides a separate response from the High-risk rule
without changing ordinary sign-ins that are outside its scope."*;
`user-risk-medium` — *"It complements the separate High-risk control; it does not
replace that protection."* Both pairs share the same object type, the same
portal path, and the same manual evidence shape (`user-risk` and
`user-risk-medium` both take the `configurationVerified` "Recovery Prerequisites
Verified" checkbox, `manualWork.ts:62`). Only the `mid` fixture generates all
four, and there they sit as four consecutive rows.

**Recommendation — KEEP, but say why there are two.** The pinned baseline
defines four separate policies and the pinned baseline wins; merging them would
misrepresent the tenant. The resemblance is *not* superficial, though, so each
step's *About this Step* should name its sibling in one sentence and the
consolidation Cleanup row must never propose retiring the High policy because a
Medium one exists — a rule `content.json` `cleanup.consolidation` already states
("Never remove High-risk coverage because a Medium-only policy exists") and which
should be repeated on the steps themselves.

---

### Finding 12 — Two "restrict a non-person account to a network" steps, adjacent
**`s-goal-service-accounts-trusted-network` (LOC #6) and
`s-goal-workload-identity-block` (Restrict the Entra Connect Sync Account to Its
Address, LOC #7).**

**Evidence.** Adjacent rows under one heading, both named "Restrict … to …", both
producing a location-conditioned CA policy. They are genuinely different objects
— one targets user-based service accounts, the other a workload identity, and
`workload-identity-block`'s applicability is the D1 `workload` (Entra Connect)
answer while the other depends on D2's `serviceAccounts` and D4's `officeNetwork`
(`direction.ts:317`).

**Recommendation — KEEP.** The resemblance is superficial: different identity
type, different Direction dependency, different licence surface. But renaming one
would cost nothing — "Restrict the Entra Connect Sync Account" reads as a sibling
of "Restrict Service Accounts" only because both start with "Restrict".

---

### Finding 13 — Two "registration" steps whose titles are easy to swap
**`s-goal-register-info-protected` (Protect Sign-in Method Registration) and
`s-goal-device-registration-mfa` (Require MFA to Register a Device).**

**Recommendation — KEEP.** Genuinely different: one protects the security-info
registration user action, the other the device register/join user action, and
they carry different prerequisites (a TAP policy and a trusted location vs the
legacy `deviceRegistrationPolicy` setting). The resemblance is the word
"register". No change beyond leaving them in different groups, which the registry
already does.

---

### Finding 14 — The TAP policy is produced by one step and demanded by another that does not name it
**`s-prereq-passkey-settings` (EA #3) and `s-goal-register-info-protected` (MFA #1).**

**Evidence.** `s-prereq-passkey-settings`'s sixth instruction:
> "Temporary Access Pass → Enable: On for the people who may need a pass to
> register their first passkey…"

`s-goal-register-info-protected` on the demo:
> `{"label": "Prerequisites", "state": "when 1 Temporary Access Pass policy exist (now 0)"}`

Same object, no link between them. The registration step's gate does not say
which step turns TAP on.

**Recommendation — LINK.** The registration step's TAP gate should name
Configure Passkey Authentication the way its trusted-location gate names Define
the Trusted Network (it already renders a `Prerequisite · To do` tile for that
one). One-line change to the gate's binding; no merge — TAP genuinely belongs to
the passkey foundation, which is frozen.

---

### Finding 15 — Prerequisite/object steps draw a different anatomy from policy steps
Not a duplication, but it is the mechanism that makes duplicates *look* like
different products, so it belongs here.

**Evidence.** `docs/qa/step-snapshots/demo`:
- `s-prereq-trusted-location`, `s-prereq-service-accounts-group`,
  `s-prereq-allowed-countries` — `"headings": ["Why", "Readiness",
  "Implementation", "Done when"]`
- every `s-goal-*` and `s-shared-devices` — `"headings": ["About this Step",
  "Tasks Remaining", "Implementation Tasks", "Completion Criteria"]`
- the four Direction steps — `["About this Step", "Questions", "Completion Criteria"]`

Three anatomies on one board. `stepGroups.ts` `anatomy: null` on every
non-pinned group means each member falls back to its own defaults, by design
("Grouping a step is a statement about where it sits on the board, not about
what its interior draws"). The consequence is that the object steps — the exact
steps findings 2 and 3 are about — are the ones that look foreign.

**Recommendation — set `anatomy: 'task'` on the seven non-pinned groups**, which
is what the owner's rule ("ZERO lack of uniformity among UI that SHOULD be
identical", `weekend-launch.md`) already requires. That is a one-file edit and it
removes the strongest visual cue that these steps were built separately.

---

## 3. What to do, in one list

| # | Steps | Action |
|---|---|---|
| 1 | `s-goal-admin-session` + `s-goal-all-users-no-persistence` | **LINK** — scope the two identical Completion Criteria |
| 2 | `s-prereq-trusted-location` ← D4 | **LINK** — replace the "Choose your office networks" tile with the Direction wait; make it D4's first task |
| 3 | 9 policy steps | **MERGE the tile readings** — one cause, one tile |
| 4 | `s-prereq-device-plan`, `s-question-travel`, `s-goal-unmanaged-browser`, `s-goal-mobile-app-protection`, `s-goal-azure-management-mfa` | **DELETE** from the registry; alias `byod-session-controls`/`block-downloads-unmanaged` to one id |
| 5 | `s-question-partner` | **FOLD** into `s-goal-guests-mfa` + `s-goal-geo-restriction`, delete |
| 6 | `s-question-mail-devices` | **FOLD** into `s-goal-block-legacy-auth` as a second task, delete |
| 7 | D1 mailDevices → D2 serviceAccounts | **LINK** — show the merge, or stop merging |
| 8 | `cleanup-notAssessed` | **DELETE** — unreachable duplicate of `s-review-baseline-*` |
| 9 | `s-ladder-admin-accounts-separate`, `s-ladder-stale-accounts` | **MERGE** via `COVERED_BY_STEP` |
| 10 | the `s-question-` prefix | **DELETE** — emptied by 4, 5 and 6 |
| 11 | the four risk steps | **KEEP** — baseline defines four; name the sibling |
| 12 | `s-goal-workload-identity-block` | **KEEP** — different identity type |
| 13 | the two registration steps | **KEEP** — superficial resemblance |
| 14 | `s-prereq-passkey-settings` → `s-goal-register-info-protected` | **LINK** — name the step that turns TAP on |
| 15 | the seven non-pinned groups | **Set `anatomy: 'task'`** — one anatomy |

Net effect if 4, 5, 6, 8 and 9 are taken: **eleven step identities removed**, no
outcome lost, and the `s-question-` prefix gone. Group 6 (Control Where People
Sign In From) goes from 7 listed to 6; group 7 (Require Healthy Devices) from 7
listed to 4 — which is what it actually draws today.

## 4. Two things this audit did not settle

1. **Does the trusted network belong inside D4?** Finding 2 recommends LINK
   because creating an IP named location is real Entra work. The owner's instinct
   was MERGE. The deciding question is whether the *creation* task should live
   inside a pinned decision step that otherwise changes nothing in Entra — the
   Direction group's whole contract is "answers only; nothing is changed in
   Entra" (`direction.ts:2-3`). Merging would break that contract. The same
   question applies to `s-prereq-allowed-countries` and
   `s-prereq-service-accounts-group`.
2. **`s-goal-admin-portals-protected`.** `v1-step-map.md` §5 moves it to the
   lockdown kit; `policy-groups-proposal.md` open question 1 asks whether it and
   `s-goal-inforcer-mfa` should leave the catch-all. It renders on every fixture
   today as "On Hold · the baseline defines this policy two ways". Not a
   redundancy, but it is the other step in the "why is this here?" category.

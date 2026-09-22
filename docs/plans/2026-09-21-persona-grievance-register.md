# Persona grievance register

Produced 2026-09-21 from the ground-zero persona audit: five independent agents,
five different tenants, none allowed to read a prior round's artefacts or `src/**`.
Ratings were Jordan 4, Sam 4, Marcus 6, Nadia 6, Priya 6 — mean **5.2**.

Their reports are at `docs/qa/night/personas/gz-<persona>-REPORT.md`, each naming
the probe file that produced every quote. Probes run as
`node docs/qa/night/personas/<file>.ts` from the repo root.

---

## Definition of success

**A person completes the plan when they have decided, for every step, what they
will and will not adopt.** A baseline is a base line to build from. A step that
ends "not for us" is a success. A step that ends "IAMAI is still thinking about
it" is a failure.

Not one of the five personas completed under that definition. Every one ended by
running out of things the product would let them do.

Per run, count:

| Bucket | Meaning | Target |
|---|---|---|
| **Decided** | adopted, adopted-with-changes, or explicitly declined | everything |
| **Stranded** | wanted to act, product offered no action | **zero** |
| **Declined for cause** | could have acted, wouldn't — caught the product wrong | zero |
| **Theirs to do** | waiting on real-world work the product correctly says is theirs | not a defect |

Ratings are a summary, not the metric. Drive **Stranded** to zero.

## Guard rail

The fix for a gate is never to lower the threshold. It is to name what moves it
and to let the person explicitly decline it. A decision may narrow scope or
defer; it never weakens a grant.

These must survive every batch — all five personas praised them:

- the refusal to create a policy On: *"a policy created On applies to everyone it
  covers from the moment you save, before anyone has seen who it would have
  stopped — the failure this plan exists to prevent"*
- the failure gate that shut on 400 seeded failures: *"Time elapsed alone does
  not complete this check."* Fix its silence, never its logic.
- the withheld enforce instruction
- steps that correctly say the work is the person's: *"No step of this plan
  enrols a device for you"*

## How a batch closes

1. Every item's acceptance is visible on screen through its named probe.
2. A unit test asserts it. Pick test files by the rendered **text**, not the
   module edited: `grep -rln "<the new phrase>" src --include=*.test.ts`.
3. `npm run verify -- <named .test.ts files>`.
4. Committed, pushed, CI green.

Full ground-zero re-audit after batch 2 and after batch 4 — same five personas on
the same five tenants for regression, plus one new persona for fresh eyes.
Targeted probe re-runs every batch.

## Severity

1–5, 5 worst. Nadia's report numbers her severities inverted; her items are
recorded here at the weight her own point deductions imply, not her digits.

---

# Batch 1 — A gate that stops you does not say what would move it

**Root cause.** The engine knows what holds a step and what would release it.
The board renders one word. Every persona hit this; it is the direct cause of
every Stranded count in the audit.

Includes the owner-approved, half-built **option A** (`stash@{0}`).

| ID | Sev | Personas | Step / where | The defect | Acceptance |
|---|---|---|---|---|---|
| G1.1 | 5 | Marcus | `s-goal-admin-portals-protected` | *"Method compatibility is not yet established for 70. The step that moves this number is \"Prepare Your Team for MFA\"."* — byte-identical across nine scans over three weeks; all 284 active people already hold a registered method. Three policies stranded, no other action offered. | The gate names a remedy that, when done, moves the number — or says why it cannot and offers decline. |
| G1.2 ✅ | 5 | Nadia | `s-goal-mfa-all-users` / `s-verify-mfa` | Gate reads 18%, names `s-verify-mfa` as the remedy; that step scopes to the two people who *are* the 18% and then reads *"Nothing left to do."* The nine people who would move it are named on no screen. | The remedy step's scope equals the gate's denominator. The missing people are listed. |
| G1.3 ✅ | 4 | Priya | `s-goal-token-protection` + 11 others | *"Observation · Report-only · Review the available records and the remaining evidence requirements. Time elapsed alone does not complete this check."* Milestone `Not scheduled`. The remaining requirements are listed nowhere — checked across tiles, findings, Done-when, tasks and all four channels. | The gate names the missing evidence and the source that would supply it. |
| G1.4 ✅ | 3 | Sam | report-only gate under failures | Same sentence fires correctly on 400 seeded failures, and never says **400** or names one person. | The refusal states the count and how to see who. |
| G1.5 ❌ | — | Jordan | board, `midflight` | **Does not reproduce as a product defect. Withdrawn 2026-09-21.** It is 13 steps citing it, not 3. The step is held short of `done` because `approvedPasskey` reads `null`, and that is fixture data: midflight ships its break-glass accounts with `authMethods: [{kind:"fido2"}]` — no `id`, `aaGuid` or `passkeyType`, a record real Entra never returns — and `compatiblePasskeyMethodIds` treats a method with no id as unreadable. Given a complete method record the step goes `done` and all 13 citations clear. My own first probe also had the order wrong: `prepareEmergencyAccess` iterates `mapping.breakGlassUserIds`, so it is a no-op before the selection is saved. | None on the product. See G-F1. |
| G-F1 | 3 | (found 2026-09-21) | `src/roadmap/fixtures` midflight | The shipped fixture gives break-glass accounts a method record real Entra never returns, which dead-ends the one gate holding 13 steps. It made a persona report a product defect that is not there, and cost an audit round a wall it should never have hit. Fixture data, not product. | The fixture's emergency accounts carry `id`, `aaGuid` and `passkeyType` — or the audit records why they do not. |
| G1.6 | 3 | Jordan | board | Counts identical at 2026-08-29, 09-05 and 09-19 with no statement that nothing further will change. | A board with no available action says so and offers the decline path. |
| G1.7 ✅ | 3 | Marcus, Nadia, Sam, Priya | `s-check-dormant-accounts`, `s-prereq-service-accounts-group` | **Blocked on an owner decision — investigated 2026-09-21.** Reproduced: on `mid` the `ai` channel carries 60 account names and the `portal`, `ps` and `email` channels carry none, while portal says *"Review each account IAMAI lists with its owner before changing it."* The model Marcus named is real — `s-shared-devices` portal renders `Shared-device account IDs: "Jamie Haddad" (000004ff-…)` from the binding `{{policy.target.includeUsers}}` with `[omit this line when unavailable]`. But the dormant package has **two** portal blocks: `entra.disable`, authored per-account against `{{account.current.displayName}}`, and `entra.dormant`, the generic review block that actually renders and has no binding for the candidate set. There is no list-valued binding for "the accounts this step is about". See G-F2 for what turned up underneath. | Owner picks an option below. |
| G-F2 ⚠️ PROVEN | 4 | (found 2026-09-21) | `docs/implementation-content/s-check-dormant-accounts`, binding layer | The package declares `account.current.id`, `account.current.displayName` and `account.decision.disposition` as **required** bindings. Grepping `src/**` for any producer of an `account.*` binding key returns nothing — the namespace appears to have no producer at all, while `policy.*` does. The compiled `entra.disable` block still carries its `{{account.current.…}}` templates. If that namespace is genuinely unproduced, the per-account half of this package can never project on any tenant, and the generic block is the only thing readers ever see. Not asserted as proven: a dynamic producer would not match the grep. | Establish whether `account.*` has a producer. If not, that is the finding, and it is larger than G1.7. |
| G-F2 | 4 | (found 2026-09-21) | `docs/implementation-content/s-check-dormant-accounts`, binding layer | The package declares `account.current.id`, `account.current.displayName` and `account.decision.disposition` as **required** bindings. Grepping `src/**` for any producer of an `account.*` binding key returns nothing — the namespace appears to have no producer at all, while `policy.*` does. The compiled `entra.disable` block still carries its `{{account.current.…}}` templates. If that namespace is genuinely unproduced, the per-account half of this package can never project on any tenant, and the generic block is the only thing readers ever see. Not asserted as proven: a dynamic producer would not match the grep. | Establish whether `account.*` has a producer. If not, that is the finding, and it is larger than G1.7. |
| G1.8 ✅ | 4 | (option A) | `planBoard.ts`, `stepContract.ts`, `StepSections.tsx`, `Plan.tsx`, `app.css` | A held row says only "On Hold". On one plan, fifteen rows waited on an unanswered question and eleven on one named step; every one said "On Hold". Half-built in `stash@{0}`: `waitingForOf(r, titleOf)` and `waitingFor` on `LaneView` are done. | The row says what it waits for, at desktop **and** mobile widths. |
| G1.9 ✅ | 2 | (found 2026-09-21) | `Plan.tsx` | `holdGroupOf` is computed onto every board item and read by nothing. Machinery to group held rows by what holds them, wired to the item, then stops. | Either it feeds G1.8's grouping or it is deleted. |
| G1.10 | 2 | (found 2026-09-21, building G1.8) | Plan row, When column | With the reason line landed, a held row now reads `After Configure Passkey Authentication` under its title and `After prerequisites` in the When column beside it — the same fact twice, the adjacent one vaguer. Observed at both widths on the demo tenant. Recorded as an observation for the re-audit to judge, not asserted as a defect: When answers *when*, the reason answers *what blocks it*. | The re-audit says whether a persona reads it as noise. |

**Batch 1 notes.** `src/ui/accessibility.test.ts` asserts
`row.includes('plan-row-reason') === false`, citing RUN-CONTEXT-B decision 10,
whose premise ("the lane label is the row's reason") stopped being true in
`8f440021`. The owner resolved this in favour of the reason line — **update the
guard with the new decision, do not route around it.** `laneLabelOf` appends the
lane tail only on `Ready`; `compactLane` in `StepSections.tsx` strips
`On Hold · After `. The When column is fixed 125px and cannot take it.
`planAnatomy.test.ts`'s mock `laneOf()` builds a `LaneView` literal and needs the
new field. Safe: the walk reads `.step-title` and `.when`; smoke reads `.lane`,
`.when`, `.plan-row-number`, `.next-mark` — a new sibling span inside
`.plan-row-title` disturbs none.

---

# Batch 2 — The product states what it did not measure (acute)

**Root cause.** An unread source and a measured zero render identically. This is
the screen that decides which policies exist, and every persona was told
*"Not sure? Keep the suggestion. You can change it any time."*

The product already owns the honest phrasing — Priya found it two questions away:
*"evidence": "A default, not something the scan saw."* and *"…IAMAI does not read
sign-in addresses, so it cannot suggest them."* The fix is to hold every evidence
line to that standard.

| ID | Sev | Personas | Step / where | The defect | Acceptance |
|---|---|---|---|---|---|
| G2.1 ✅ | 5 | Sam | `s-direction-devices` → `computers` | *"Today: 3 people signed in from computers that aren't joined."* Hand count **2,339**. The only quantity in that tenant equal to 3 is the number of distinct device-trust *values*. At 3 this is a Tuesday afternoon; at 2,339 it is a quarter of work. Re-verified by me: quote and derivation both reproduce. | The figure counts people and matches a hand count. |
| G2.2 ✅ | 5 | Priya | `s-direction-use` → `service:azureManagement`, `service:inforcer` | *"No Azure management sign-ins in the last 30 days."* over a tenant whose sign-in source reads `insufficient`, `coveredWindow: null`. Answering "no" **removes a policy from the plan**. | No observation is asserted over a source that returned nothing. Unread reads as unread. |
| G2.3 ✅ | 3 | Marcus | `s-direction-devices` → `computers` | Evidence is *"The baseline's recommendation."* — no tenant evidence at all — on the question that set an 80% managed-device gate, in a tenant with 41 of 300 Intune seats consumed. The step never mentions the seats. | A question with cost consequences shows the tenant's own position. |
| G2.4 ✅ | 3 | Nadia | `s-direction-locations` | *"The office network: Everyone works remotely. 1 named location is marked trusted."* The evidence offered for "everyone works remotely" is that a trusted location exists. The row carries no "(Suggested)" marker while its neighbours do; underlying suggestion is `{"value":"office","picked":[...]}`. | Evidence supports the answer it sits under; the marker is consistent. |
| G2.5 ✅ | 4 | Sam | `s-prereq-allowed-countries` | Tile: *"Allowed countries · Needs Correction · admins have signed in from NZ, which the list leaves out"* (exactly **1** admin, not plural). Task two lines below: *"Select these Work Countries: **AU**."* The instruction builds the list the tile says is wrong, with no count on either. 161 people affected. | Tile and task agree; counts stated; plurals match. |
| G2.6 ✅ | 4 | Priya | `s-goal-mfa-all-users` | Step reads `Existing coverage · In place`, milestone **Completed**, board headline *"Every user satisfies MFA on every app"* — on a tenant where MFA readiness is unreadable (403). Its own `why` promises *"Reviewing who has a usable method—and who has actually used one"*; it reviewed neither and said nothing. | Completed is not rendered over an unreadable population without disclosure. |

---

# Batch 3 — Dead ends with no exit

**Root cause.** A step reaches a state the plan cannot leave, and the printed
remedy does nothing. Merges three prior-round defects that have survived three
rounds unfixed.

| ID | Sev | Personas | Step / where | The defect | Acceptance |
|---|---|---|---|---|---|
| G3.1 ⚠️ PART | Jordan, Priya | `s-goal-block-device-code` | *"Not supported · This step has no policy for IAMAI to write in this plan. Scan Fixture midflight again to rebuild it."* Done-when: *"A scan rebuilds this step with a policy IAMAI can write."* Jordan scanned three times, byte-identical, then stopped. He isolated the trigger: `fidelity=exact` → normal step; `fidelity=enforced` → dead end. Turning the policy on is what kills the step and nothing says so. Priya hit the same step id with the policy already `enabled`. | Creating a policy On never strands its step; if a state is unrecoverable the text says what actually recovers it. |
| G3.2 | 4 | Jordan | `s-goal-block-device-code` | *"Not as asked · Core - Block - Device code flow is deployed, but not as this step asked … re-run this step's instructions"* while the same render says `Blocked / Not deployed`. Step 1 of those instructions: *"New policy. Name: Core - Block - Device code flow (2)"*. | A disabled policy carrying IAMAI's own plan tag is recognised as "switched off, turn it on", never duplicated. |
| G3.3 | 4 | (prior R3-1) | 44 policy packages | IAMAI matches a policy carrying its own plan tag that is `disabled`, then instructs a duplicate "… (2)". Reproduces on the shipped `midflight` fixture. Needs a `packageStateOf` state meaning "this exists and is switched off, turn it on", plus a block in all 44 packages. | Same as G3.2 — one fix. |
| G3.4 | 3 | (prior R3-2) | pre-existing enforced policies | A policy the tenant enforced before IAMAI arrived ends at "Review now" with completion criteria requiring a report-only period that can never have happened. Unfinishable rows. | Criteria that cannot have happened are not required; the row can be completed or declined. |
| G3.5 | 2 | Nadia | `s-goal-token-protection` | Post-enforcement `Ready · Correct` asks to select three resources the policy already holds; its own record says `"differsIn": []`, `"correction": {"safe": true}`, and the update body is byte-identical to current `conditions.applications`. The correction arrives only *after* enforcement. | A correction with `differsIn: []` is not raised. |
| G3.6 | 3 | Marcus, Sam, Priya | `s-goal-block-device-code`, `s-goal-pim-activation-reauth`, `s-goal-intune-enrollment-reauth`, `s-goal-user-risk-medium` | `LANE: Ready / STATE: Ready / Enforced / MILESTONE: Review now` with `READINESS TILES: (none)` and `WHAT IAMAI FOUND: (none)`, and a Done-when mixing IAMAI's checks with the person's, with no indication which remain. Sam and Priya hit the same step id independently. | An enforced step states what is outstanding and whose it is. |
| G3.7 | 2 | (prior R3-7) | policies over dormant people | A policy whose named people are all dormant reads "No user impact". | Impact distinguishes "nobody" from "nobody active". |

---

# Batch 4 — The actionable text contradicts the status text

**Root cause.** The guard exists as a tile and a lane word and is missing from
the numbered task — which is the only part anyone follows at 6pm on a change
night.

| ID | Sev | Personas | Step / where | The defect | Acceptance |
|---|---|---|---|---|---|
| G4.1 ✅ | 5 | Sam | `s-goal-block-legacy-auth` + the enforce checklist | *"Do not turn it on unless all of these are true now:"* lists three conditions; **"security defaults are off" is not one of them** — on a policy the security-defaults step names as one of its four replacements. The product states the invariant in its own voice: *"That is why nothing in this plan enforces before this step."* Then breaks it. | The checklist carries every precondition the plan's own invariant names. |
| G4.2 ✅ | 5 | Sam | whole board | Enforced 8 policies with `securityDefaults: [{"isEnabled": true}]`. All 33 steps swept: no warning anywhere. Board reads `Completed`; tile reads *"CA - Block - Legacy authentication is in place. IAMAI watched it get there."* The product says this state cannot be undone. | Enforcing into a state the product calls unsupported is refused or prominently disclosed. |
| G4.3 | 4 | Nadia | enforce checklist | Requires *"Emergency access is prepared and tested."* The drill is `{"kind":"drill","day":"2026-09-10…","done":null}` and `cleanup-drill` is not a step on the board. Eight policies enforced having never tested it. *(Caveat: she drives the step renderer, so scope this to the enforce step unless the Plan page already surfaces it.)* | A precondition the checklist names is reachable as a step. |
| G4.4 | 4 | Priya | `s-goal-token-protection`, `ai` channel | *"…only when all of this is true now: the required report-only period is complete, with no failures on this policy in the sign-in records"* — indistinguishable from safe when there are **no records**. The one way this product gets someone locked out. | "No failures" and "no records" are distinguishable in the text. |
| G4.5 ✅ | 5 | Marcus | `s-goal-all-users-no-persistence` vs `s-goal-token-protection` | *"Prerequisite · To do"* genuinely blocks on one step and genuinely does not on the other. He completed a policy over 283 accounts with the prerequisite open and the shared-device account inside it — the account `s-shared-devices` exists to take out. | One phrase, one meaning. |
| G4.6 | 4 | Marcus, Sam | board vs step, 5 steps | Lane `On Hold`, state `Ready to enforce`, tile `Prerequisite · Waiting`, task `Turn the policy on` — all on one screen. Marcus and Sam hit the identical rendering on different tenants. Working from the board alone, half of what is ready looks like nothing to do. | Board lane and step state never disagree. |
| G4.7 | 2 | Marcus | `s-goal-sign-in-risk` | `MILESTONE: Sep 30, 2026` beside *"today ready now: 0 failures in 8 days"* and *"Turn the policy on"*. | The milestone date reflects the step's own readiness. |
| G4.8 | 2 | Marcus | board at `emergency-access-prepared` | `s-ladder-operator-passkey` sits above `s-prereq-passkey-settings` while its tile says *"Finish Configure Passkey Authentication first."* | A step does not sort above its own prerequisite. |
| G4.9 | 2 | Priya | `s-goal-block-legacy-auth` | `done` but sits in `Ready · Decision` with milestone `Not scheduled`. | Status, lane and milestone agree. |

---

# Batch 5 — All-clears over empty data, and the copy-paste block

**Root cause.** Two shapes. (a) A verification tile is true only because there
was nothing to check, or contradicts the data one line away. (b) The one block
designed to be copied renders before the facts that shape it are known.

| ID | Sev | Personas | Step / where | The defect | Acceptance |
|---|---|---|---|---|---|
| G5.1 | 5 | Marcus | `s-prereq-passkey-settings` | Tile: *"Existing passkeys affected · Could not verify"*. Task four lines below: *"No existing passkey is affected by the planned settings."* He then enforced attestation and a four-AAGUID allow-list. **33 accounts hold passkeys with `aaGuid=(none) attestation=(none)`.** For a person who does what he is told, an unhedged wrong sentence is the worst defect a tool can have. | No all-clear is asserted under a `Could not verify` tile. |
| G5.2 | 5 | Jordan | 7 of 9 policy steps, e.g. `s-goal-admin-session` | Before an emergency selection is saved, the copy-paste block renders complete with *"Users → Include: All users."* and no exclusions line. After saving, the same step renders *"Users → Include: Directory roles → Global Administrator, Privileged Role Administrator … Users → Exclude → Groups: Core - Exclusions."* The scope was wrong, not merely incomplete. Pasting it gives all 62 people a session policy with no break-glass exclusion. | The block renders the correct scope or is withheld until it can. |
| G5.3 ✅ | 4 | Jordan, Sam | `s-prereq-break-glass` | *"Prepared passkeys · Could not verify · Every emergency account relies on fido2 alone. Missing scan evidence: registered sign-in methods."* while `sources.registrationDetails` is `ok` and both accounts carry `methodsRegistered: ["fido2SecurityKey"]`. Holds the gate on three policies. **Correct on Priya's 403 tenant** — the fix is to condition it on the source's actual status. | The sentence appears only when the source really is unread. |
| G5.4 | 3 | Sam | `s-prereq-exclusion-group` | *"Policy exclusions · Required references present"* and *"Every policy that must exclude **Core - Exclusions** already does. To add it to another policy:"* — with `caPolicies.rows: []`. Vacuous truth rendered as verification. Sentence ends in a colon with nothing after it. | Verification over an empty set says the set is empty. |
| G5.5 | 3 | Priya | `s-prereq-exclusion-group` | *"Emergency account membership · Membership verified"*, Done-when *"The scan verifies the selected group's configuration, membership and required policy exclusions."*, step **Completed** — on a snapshot whose `groups` is `{}` and `meMemberOf` has 0 rows. | Same as G5.4. |
| G5.6 | 3 | Marcus, Nadia, Sam | `s-goal-require-managed-device` | *"N% of people on a compliant device"* counts compliant-**Windows** owners. Marcus: 32% printed, 39.4% true. Sam: 29% printed, arithmetically consistent as Windows-only, verbally wrong, and prints no `N of M` where every MFA gate does. Nadia: 50% printed, matching no count she can make. Every instance errs optimistic, and enrolling phones would not move the number. | The sentence describes the population it counts, and prints `N of M`. |
| G5.7 | 3 | Sam, Nadia | `s-prereq-trusted-location`, `s-prereq-allowed-countries` | *"Fixture <X>'s own policy names do not agree on one shape, so this is the documented pattern."* — on tenants with **zero** CA policies. Two personas, two steps, one sentence template. | The clause requires policies that exist and actually disagree. |
| G5.8 | 3 | Nadia | `s-check-separate-admin-accounts` | *"Fix before continuing"* on a blocker whose only unreadable source is `pimEligibility`, reason **"needs Entra ID P2"**, on a tenant with `entraP2: {enabled: false}`. The words licence, premium and P2 appear nowhere on the step. | A licence blocker names the licence. |
| G5.9 | 3 | Priya | `s-goal-admin-portals-protected` | Prescribes *"…needs Entra ID P1; once both are in place, scan again"* on a tenant where `entraP1` and `entraP2` are both enabled. | Licence prerequisites check what the tenant holds. |
| G5.10 | 3 | Priya | `s-goal-admins-phishing-resistant`, `s-goal-register-info-protected` | An unread count and a measured zero print identically: *"It is not measured yet: 0 of 39 people…"* reads the same as the post-grant measured *"0 of 2 people…"*. | Unmeasured never renders as a number. |
| G5.11 | 3 | Sam | board | Two guest counts on one screen (`197 guests` vs `Guest Directory · 225 guests`) and two admin counts (`51` vs `60`). Both derivable; neither explained. | Differing denominators on one screen state why they differ. |
| G5.12 | 3 | Sam | headline population | `4,169 active people` → `4,167` on clock +1 day, then frozen through +10. Not a sliding window. | The population is stable or its movement is explained. |
| G5.13 | 2 | Marcus | `s-goal-device-registration-mfa` | Three unexplained totals on one step: *"246 active people"*, *"covers 283 enabled"*, *"209 of 279 people"*. | Same as G5.11. |
| G5.14 | 3 | Priya | every policy step | *"covers 40 enabled"* when 42 are enabled; the 2 subtracted sit in a group whose membership is unreadable. A measured coverage figure that is an assumption. | Coverage over unreadable membership is disclosed. |
| G5.15 | 3 | Nadia | `s-check-dormant-accounts` | *"9 accounts"* dormant where 11 of 13 have no sign-in record. The two omitted are the emergency accounts — almost certainly right, never stated, so a hand count gets 11 and concludes the scan missed two. | A count that excludes a class says so. |
| G5.16 | 4 | Jordan | `s-prereq-exclusion-group` | Task list: *"Select **bg1@…**, **bg2@…**, choose **Remove**, then confirm."* The consequence — *"Removing the rest puts each of them back inside every policy this group is excluded from, and 3 of those are On today…"* — is in portal paragraph 4. Jordan got lucky because the accounts were named "Break-glass"; named `svc-admin-01` he locks himself out. | The consequence sits with the instruction, not four paragraphs away. |
| G5.17 | 4 | Jordan | 8 steps, one scan | *"New evidence · not deployed at the last scan and enforced by Aug 29, 2026: it went live without a report-only period IAMAI could watch…"* survives exactly one scan (8 → 0 the next day) and never reaches the board word. Five steps showed `Completed` while that line was live. | The record of an unobserved enforcement persists and reaches the board. |
| G5.18 | 3 | Jordan | `s-prereq-break-glass` on `midflight` | On an inherited tenant `FOUND:` is **empty** — no mention of six IAMAI-tagged policies, two unused break-glass accounts, or one disabled duplicate left by a predecessor. | An inherited tenant's findings say what was inherited. |
| G5.19 | 3 | Nadia | `s-prereq-passkey-settings` | *"Passkey registration · Review required"* and *"Passkey protections · Needs correction"* with no detail; What-to-do reads *"Fix before continuing: Passkey protections: Needs correction. "* ending in a trailing separator with nothing after it. Every other tile carried a reason. | Every verdict tile carries its reason. |
| G5.20 | 2 | Nadia | `s-prereq-break-glass` | One screen: tile *"…No phishing-resistant method registered"*; `ai` channel *"No account preparation action is currently projected."*; portal *"No selected account currently needs configuration."* Plus *"also registered by Break-glass 2"* with no first party on screen. | Channels on one step agree. |
| G5.21 | 3 | Marcus | `s-prereq-passkey-settings` | *"**Replacement registration, only if needed:** where no compatible alternative is registered, continue with the steps below to register a replacement."* The next and last line is *"Return to IAMAI and select **Scan to update the plan**"*. Persists after Completed. | An instruction pointing at following steps has following steps. |
| G5.22 ⚠️ | 3 | Marcus | `s-prereq-break-glass` at `done` | **Reproduces exactly, but the design is deliberate — owner decision.** At `done`/`Completed` the step still prints three task blocks of 8, 9 and 10 imperative lines, two of them led by a line saying nothing needs doing. `emergencyAccountTasks.ts` keeps them on purpose: "with none needing any, every change stays available as a reference." The defect is that reference material is written as commands. | A presentational change only. Do not delete the procedures. |
| G5.23 | 3 | Marcus | `s-goal-require-managed-device` | Findings line is a subject-less fragment: *"New evidence · not what the plan asked for in device platforms, and IAMAI does not write that part: a person corrects it in the Entra admin center, then scans again"*. | Findings lines are sentences. |
| G5.24 | 2 | Nadia | `s-ladder-operator-passkey` vs `s-check-dormant-accounts` | *"Done when: Kai Brown completed a phishing-resistant sign-in in the records."* Both `user0` (her, GA) and `user3` (a guest) display as **Kai Brown**. No UPN, no id, no marker. She read it as her guest needing a passkey. | A person is identified unambiguously where a duplicate display name exists. |
| G5.25 | 2 | Priya | `s-goal-guests-mfa` | A guest's name (`Sasha Singh`) escapes the card structure onto its own line; the step reads `Ready / Enforced` while carrying a `Not supported` tile. | Names render inside their card. |
| G5.26 | 2 | Priya | `s-prereq-allowed-countries` | Duplicate identical tile: *"Allowed countries · Not Fully Read · Missing scan evidence: sign-in records"* rendered twice. | Tiles deduplicate. |
| G5.27 | 2 | Priya | `s-prereq-trusted-location` | Completed against a Done-when its own answer contradicts, with a disclosed unexplained trusted location (`Head office`) left on the table. | — |
| G5.28 | 2 | Marcus | `s-goal-require-managed-device` and 2 others | *"Implementation · Unavailable … The instructions come back when it does."* What is withheld is the **enforce** instruction; portal prose, a `-Mode 'Create'` body and the AI brief still render. **Filed by Marcus at severity 4 on the grounds that an `Enforce` script was present — that does not reproduce** (the `Enforce` he saw is an entry in the shared function's `ValidateSet`; the invocation is `-Mode 'Observe'`). The real defect is the imprecise sentence. | The sentence says which instruction is withheld. |
| G5.29 ✅ | 2 | (found 2026-09-21) | `src/ui/app.css` | The Plan row breaks below 940px independently of anything above: the grid drops to three columns and the who/when zones reflow into the 28px and 110px tracks. Measured — the "who" cell is 28px wide with "2 people" in it. | The row holds at mobile widths. |

---

# Not defects — do not "fix" these

| What | Who | Why it stays |
|---|---|---|
| Review steps left open | Marcus | *"Those are genuinely mine to do, and the product was straight about that."* He deducted nothing. |
| The failure gate closing on 400 failures | Sam | He gave back **+0.5** for it. Fix the silence (G1.4), never the logic. |
| Refusal to create a policy On | all five | The single most-praised sentence in the audit. |
| Withholding the enforce instruction | Nadia, Priya | Verified: it genuinely holds. Only the wording is imprecise (G5.28). |
| PowerShell guard refusing to enforce a non-canonical policy | Nadia | *"Refusing enforcement: policy is not Report-only immediately before enforcement."* |
| Honesty about unread sources where it is done well | Priya | *"…access denied (403). It is read with the Directory.Read.All permission; once that is granted, scan again."* This is the standard batch 2 raises everything else to. |

---

# Harness caveats carried forward

- `enrolMfa()` is a no-op on `hostile` (no person's methods are readable) and on
  `getiamai` (`activePeopleIds` returns 4 of 13). Priya could not test the "team
  registers a method" path at all; Nadia registered by hand instead — which the
  plan never asks for, and which took her from 8 enforced policies to 12.
- The personas drive the step renderer, not the Plan page. Findings about what
  the Plan page does or does not surface (G4.3) are scoped accordingly.
- `docs/qa/night/` is gitignored. The harness core is being committed separately
  so this loop survives a clone; the scratch probes are not.

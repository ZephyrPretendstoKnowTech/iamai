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
| G1.1 ❌ | — | Marcus | `s-goal-admin-portals-protected` | **Not a product defect. Proven 2026-09-22, and the cause is the harness.** The sentence was byte-identical across nine scans because nothing the persona did could move it: `enrolMfa` set `isMfaCapable` and `isMfaRegistered` and left `methodsRegistered` **empty**, and `methodReadiness.ts` answers an empty `methodsRegistered` as `no` whatever the flags say — correctly, because Entra never returns that pair. Measured on `mid`: 35 rows marked registered with no methods, and the gate frozen at 75% / 209 of 279 through three enrolments. With the registration row filled the same three enrolments move it to **86% / 241 of 279**. The route sentence is arithmetically true there (58 of the 70 short people are inside the campaign, 15 needed), which is what the earlier pass had established. Harness fixed; see G-F3. | None on the product. |
| G1.2 ✅ | 5 | Nadia | `s-goal-mfa-all-users` / `s-verify-mfa` | Gate reads 18%, names `s-verify-mfa` as the remedy; that step scopes to the two people who *are* the 18% and then reads *"Nothing left to do."* The nine people who would move it are named on no screen. | The remedy step's scope equals the gate's denominator. The missing people are listed. |
| G1.3 ✅ | 4 | Priya | `s-goal-token-protection` + 11 others | *"Observation · Report-only · Review the available records and the remaining evidence requirements. Time elapsed alone does not complete this check."* Milestone `Not scheduled`. The remaining requirements are listed nowhere — checked across tiles, findings, Done-when, tasks and all four channels. | The gate names the missing evidence and the source that would supply it. |
| G1.4 ✅ | 3 | Sam | report-only gate under failures | Same sentence fires correctly on 400 seeded failures, and never says **400** or names one person. | The refusal states the count and how to see who. |
| G1.5 ❌ | — | Jordan | board, `midflight` | **Does not reproduce as a product defect. Withdrawn 2026-09-21.** It is 13 steps citing it, not 3. The step is held short of `done` because `approvedPasskey` reads `null`, and that is fixture data: midflight ships its break-glass accounts with `authMethods: [{kind:"fido2"}]` — no `id`, `aaGuid` or `passkeyType`, a record real Entra never returns — and `compatiblePasskeyMethodIds` treats a method with no id as unreadable. Given a complete method record the step goes `done` and all 13 citations clear. My own first probe also had the order wrong: `prepareEmergencyAccess` iterates `mapping.breakGlassUserIds`, so it is a no-op before the selection is saved. | None on the product. See G-F1. |
| G-F1 | 3 | (found 2026-09-21) | `src/roadmap/fixtures` midflight | The shipped fixture gives break-glass accounts a method record real Entra never returns, which dead-ends the one gate holding 13 steps. It made a persona report a product defect that is not there, and cost an audit round a wall it should never have hit. Fixture data, not product. | The fixture's emergency accounts carry `id`, `aaGuid` and `passkeyType` — or the audit records why they do not. |
| G-F3 ✅ | 3 | (found 2026-09-22) | `docs/qa/night/personas/harness.ts` | `enrolMfa` wrote a method record no real tenant produces — registered flags with an empty `methodsRegistered` — so the one action a persona has for moving MFA readiness moved nothing, and produced a severity-5 report against the product. Same class as G-F1. Fixed: the copy now carries the donor's registration row, and the readiness number moves. | Done. |
| G-F4 ✅ | 3 | (found 2026-09-22) | `docs/qa/night/personas/harness.ts` | `lanes()` said "every step in the order the board shows it" and returned the plan order. The board draws three tabs and orders rows inside each by their group's registry position, so a persona read a step above its own prerequisite that the page has never drawn that way. Third harness-shaped finding this round. Fixed: it walks the real tabs and groups and names both. | Done. |
| G1.6 ✅ | 3 | Jordan | board | *"Nothing in this lane."* over an empty Ready tab is true and is not an answer. Where Ready is empty and rows remain elsewhere the board now says how much is waiting, that this tab lists it, and that **"Doesn't apply here"** on a step is the reader's way to take one off the plan — which is on every step and nothing pointed at. A board with work to offer, another tab, and a plan with nothing left at all all read as before. | Done. |
| G1.7 ✅ | 3 | Marcus, Nadia, Sam, Priya | `s-check-dormant-accounts`, `s-prereq-service-accounts-group` | **Blocked on an owner decision — investigated 2026-09-21.** Reproduced: on `mid` the `ai` channel carries 60 account names and the `portal`, `ps` and `email` channels carry none, while portal says *"Review each account IAMAI lists with its owner before changing it."* The model Marcus named is real — `s-shared-devices` portal renders `Shared-device account IDs: "Jamie Haddad" (000004ff-…)` from the binding `{{policy.target.includeUsers}}` with `[omit this line when unavailable]`. But the dormant package has **two** portal blocks: `entra.disable`, authored per-account against `{{account.current.displayName}}`, and `entra.dormant`, the generic review block that actually renders and has no binding for the candidate set. There is no list-valued binding for "the accounts this step is about". See G-F2 for what turned up underneath. | Owner picks an option below. |
| G-F2 ✅ PROVEN | 4 | (found 2026-09-21) | `docs/implementation-content`, binding layer | **Proven 2026-09-22, and it is not one package.** Over **1,234 step bindings** — every shipped fixture in four foundation states — the product emits **52** distinct binding keys, and **41 of 42** packages require at least one that is not among them. `account.*` has no producer at all, so the dormant package's per-account blocks project nowhere and the generic review block is all a reader has ever seen. `policy.current.semanticMismatches` alone is required by twenty packages. **Not fixed**: 63 producers is a piece of work, and each is a decision about what the product can honestly say. `bindingProducers.test.ts` pins the set so it can only shrink. | Proven and pinned. The 63 producers are the owner's call. |
| G1.8 ✅ | 4 | (option A) | `planBoard.ts`, `stepContract.ts`, `StepSections.tsx`, `Plan.tsx`, `app.css` | A held row says only "On Hold". On one plan, fifteen rows waited on an unanswered question and eleven on one named step; every one said "On Hold". Half-built in `stash@{0}`: `waitingForOf(r, titleOf)` and `waitingFor` on `LaneView` are done. | The row says what it waits for, at desktop **and** mobile widths. |
| G1.9 ✅ | 2 | (found 2026-09-21) | `Plan.tsx` | `holdGroupOf` is computed onto every board item and read by nothing. Machinery to group held rows by what holds them, wired to the item, then stops. | Either it feeds G1.8's grouping or it is deleted. |
| G1.10 ✅ | 2 | (found 2026-09-21, building G1.8) | Plan row, When column | Judged rather than left open: the When column answers *when* and the reason line answers *what blocks it*, and with the reason line now carrying a specific step name the two read as complementary rather than duplicated. Recorded as no change needed. | — |

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
| G3.1 ✅ | 5 | Jordan, Priya | `s-goal-block-device-code` | Closed from both ends. The **disabled tagged policy** reached it one way (G3.2/G3.3): the step now names the policy it already owns instead of instructing a duplicate. The **goal the tenant already delivers** reached the same sentence a second way: `satisfiedBy` names the policy doing it, so "no policy for IAMAI to write ... scan again to rebuild it" was false twice over and its remedy a no-op. It now names the policy and points at what is actually open. | Done. |
| G3.2 ✅ PART | 4 | Jordan | `s-goal-block-device-code` | **The duplicate is gone.** `uniqueName` took the step's own tagged policy as a name to avoid and proposed `… (2)` beside it; build that and two policies carry the tag for one step, which the step can never finish from. It now excludes policies this plan tagged for this same step, and a new finding — **"Left switched off"** — names the policy and says IAMAI does not turn one on. Still open underneath: accepting the disabled policy as the step's own and offering to enable it (G3.3). | Done for the duplicate and the silence. |
| G3.3 ⚠️ | 4 | (prior R3-1) | 44 policy packages | **Half done.** The duplicate name and the silence are fixed (G3.2). What remains is the offer: recognising a disabled tagged policy as the step's own and handing over the change that turns it on. `claimedPolicy` refuses a disabled policy deliberately — it enforces nothing — so this needs a `packageStateOf` state that does not exist plus a block in all 44 policy packages. | The step offers to enable the policy it already owns. |
| G3.4 ✅ | 3 | (prior R3-2) | pre-existing enforced policies | Reproduced and measured: **fourteen rows across five shipped tenants** whose goal is already enforced by a policy the step names, all carrying the completion *"A scan rebuilds this step with a policy IAMAI can write."* No scan can meet it, so the rows could be neither finished nor declined. The completion now names the policy delivering the goal, says nothing here waits on a scan, and points at the two things that do finish it — clearing what the card lists, or recording that the step does not apply. | Done. |
| G3.5 ❌ | — | Nadia | `s-goal-token-protection` | **Could not reproduce. Withdrawn 2026-09-21.** The reporter filed this at lower confidence herself. Driving her tenant through the same journey, the step reaches `Ready / Enforced` and not `Ready · Correct`, and its `differsIn` is `[]` with no correction offered. The six update operations that "change nothing" on that tenant all carry the body `{"state":"enabled"}` — enforce operations, which are legitimate and must not be filtered. No phantom correction was found. | None. Re-check if a later round reproduces the `Ready · Correct` state. |
| G3.6 ✅ | 3 | Marcus, Sam, Priya | `s-goal-block-device-code`, `s-goal-pim-activation-reauth`, `s-goal-intune-enrollment-reauth`, `s-goal-user-risk-medium` | `LANE: Ready / STATE: Ready / Enforced / MILESTONE: Review now` with `READINESS TILES: (none)` and `WHAT IAMAI FOUND: (none)`, and a Done-when mixing IAMAI's checks with the person's, with no indication which remain. Sam and Priya hit the same step id independently. | An enforced step states what is outstanding and whose it is. |
| G3.7 ✅ | 2 | (prior R3-7) | policies over dormant people | Swept across all five audit tenants: no step renders "No user impact". Either fixed earlier or never reachable on these tenants. | — |

---

# Batch 4 — The actionable text contradicts the status text

**Root cause.** The guard exists as a tile and a lane word and is missing from
the numbered task — which is the only part anyone follows at 6pm on a change
night.

| ID | Sev | Personas | Step / where | The defect | Acceptance |
|---|---|---|---|---|---|
| G4.1 ✅ | 5 | Sam | `s-goal-block-legacy-auth` + the enforce checklist | *"Do not turn it on unless all of these are true now:"* lists three conditions; **"security defaults are off" is not one of them** — on a policy the security-defaults step names as one of its four replacements. The product states the invariant in its own voice: *"That is why nothing in this plan enforces before this step."* Then breaks it. | The checklist carries every precondition the plan's own invariant names. |
| G4.2 ✅ | 5 | Sam | whole board | Enforced 8 policies with `securityDefaults: [{"isEnabled": true}]`. All 33 steps swept: no warning anywhere. Board reads `Completed`; tile reads *"CA - Block - Legacy authentication is in place. IAMAI watched it get there."* The product says this state cannot be undone. | Enforcing into a state the product calls unsupported is refused or prominently disclosed. |
| G4.3 ⛔ | 4 | Nadia | enforce checklist | **Diagnosed, not fixed — needs plumbing.** The condition "Emergency access is prepared and tested." is real, and the drill IS reachable: it is a Cleanup ROW (`roadmap/cleanupPhase.ts`, kind `drill`), deliberately not a plan step, so the reporter's own caveat was right — a cross-reference gap, not a missing feature. Fixing it properly means naming the drill as an outstanding condition in the spliced enforce checklist, and `StepVarContext` carries no cleanup or drill state at all; adding it touches the context type, `Plan.tsx`, `ContentStep` and every caller. Not done at that size for a discoverability gap. | The checklist names the drill as outstanding when it is — which needs cleanup state in the step context. |
| G4.4 ✅ | 4 | Priya | `s-goal-token-protection`, `ai` channel | *"…only when all of this is true now: the required report-only period is complete, with no failures on this policy in the sign-in records"* — indistinguishable from safe when there are **no records**. The one way this product gets someone locked out. | "No failures" and "no records" are distinguishable in the text. |
| G4.5 ✅ | 5 | Marcus | `s-goal-all-users-no-persistence` vs `s-goal-token-protection` | *"Prerequisite · To do"* genuinely blocks on one step and genuinely does not on the other. He completed a policy over 283 accounts with the prerequisite open and the shared-device account inside it — the account `s-shared-devices` exists to take out. | One phrase, one meaning. |
| G4.6 ✅ | 4 | Marcus, Sam | board vs step, 5 steps | Lane `On Hold`, state `Ready to enforce`, tile `Prerequisite · Waiting`, task `Turn the policy on` — all on one screen. Marcus and Sam hit the identical rendering on different tenants. Working from the board alone, half of what is ready looks like nothing to do. | Board lane and step state never disagree. |
| G4.7 ✅ | 2 | Marcus | `s-goal-sign-in-risk` | Every part of it was right and together they read as a contradiction: the evidence is earned, and the plan places the change after the notice the people affected are owed (`events.announce`, `noticeDays`). The milestone now says **which wait is left** instead of pairing an instruction in the present with a date in the future. The date does not move — the notice is real, and shortening it is not IAMAI's call. | Done. A test holds the sentence to the same day the row's When column shows. |
| G4.8 ❌ | — | Marcus | board at `emergency-access-prepared` | **Not a product defect. Checked 2026-09-22, and the cause is the harness.** `lanes()` documented itself as "every step in the order the board shows it" and returned `r.steps` in **plan** order. On the board at that exact stage the two rows are in different tabs, `s-prereq-passkey-settings` first on Ready and `s-ladder-operator-passkey` on Up Next, and no rendering puts the ladder above its prerequisite. Harness fixed to walk the real tabs and groups; see G-F4. | None on the product. |
| G4.9 ✅ | 2 | Priya | `s-goal-block-legacy-auth` | All three readings were right: the policy is enforced and reads "In place", and the lane engine keeps it out of Completed because a conditional input has no saved answer (U28). The answer — **Mail-sending devices** — was named in none of the three. The row's reason line now says it, and only where nothing else holds the row. | Done. |

---

# Batch 5 — All-clears over empty data, and the copy-paste block

**Root cause.** Two shapes. (a) A verification tile is true only because there
was nothing to check, or contradicts the data one line away. (b) The one block
designed to be copied renders before the facts that shape it are known.

| ID | Sev | Personas | Step / where | The defect | Acceptance |
|---|---|---|---|---|---|
| G5.1 ✅ | 5 | Marcus | `s-prereq-passkey-settings` | Tile: *"Existing passkeys affected · Could not verify"*. Task four lines below: *"No existing passkey is affected by the planned settings."* He then enforced attestation and a four-AAGUID allow-list. **33 accounts hold passkeys with `aaGuid=(none) attestation=(none)`.** For a person who does what he is told, an unhedged wrong sentence is the worst defect a tool can have. | No all-clear is asserted under a `Could not verify` tile. |
| G5.2 ✅ | 5 | Jordan | 7 of 9 policy steps, e.g. `s-goal-admin-session` | Before an emergency selection is saved, the copy-paste block renders complete with *"Users → Include: All users."* and no exclusions line. After saving, the same step renders *"Users → Include: Directory roles → Global Administrator, Privileged Role Administrator … Users → Exclude → Groups: Core - Exclusions."* The scope was wrong, not merely incomplete. Pasting it gives all 62 people a session policy with no break-glass exclusion. | The block renders the correct scope or is withheld until it can. |
| G5.3 ✅ | 4 | Jordan, Sam | `s-prereq-break-glass` | *"Prepared passkeys · Could not verify · Every emergency account relies on fido2 alone. Missing scan evidence: registered sign-in methods."* while `sources.registrationDetails` is `ok` and both accounts carry `methodsRegistered: ["fido2SecurityKey"]`. Holds the gate on three policies. **Correct on Priya's 403 tenant** — the fix is to condition it on the source's actual status. | The sentence appears only when the source really is unread. |
| G5.4 ✅ | 3 | Sam | `s-prereq-exclusion-group` | The tile read "Policy exclusions · Required references present" over a tenant with **zero** Conditional Access policies, beside a portal line "Every policy that must exclude Core - Exclusions already does." Both vacuously true over an empty set, both reading as verification. The rule now passes with its own sentence — no policy reaches the emergency accounts yet — and the tile reads **"Nothing to exclude yet"**. A tenant with policies is unchanged. | Done. |
| G5.5 ✅ | 3 | Priya | `s-prereq-exclusion-group` | **Guard in place; the claim was true on the reported tenant.** Checked 2026-09-22 on Priya's own tenant (`hostile` + P2): the exclusions group `Core - Exclusions` holds both break-glass accounts and the membership reading is a successful one — the sources that refused are `registrationDetails`, `devices` and `signInEvidence`, none of which feed it. So "Membership verified" was accurate there. The guard added earlier stands and is the part worth keeping: the tile cannot say "Membership verified" where no membership check ran, and says **"Not checked yet"** instead. | Done, with the reported case measured and not reproduced. |
| G5.6 ✅ | 3 | Marcus, Nadia, Sam | `s-goal-require-managed-device` | *"N% of people on a compliant device"* counts compliant-**Windows** owners. Marcus: 32% printed, 39.4% true. Sam: 29% printed, arithmetically consistent as Windows-only, verbally wrong, and prints no `N of M` where every MFA gate does. Nadia: 50% printed, matching no count she can make. Every instance errs optimistic, and enrolling phones would not move the number. | The sentence describes the population it counts, and prints `N of M`. |
| G5.7 ✅ | 3 | Sam, Nadia | `s-prereq-trusted-location`, `s-prereq-allowed-countries` | *"Fixture <X>'s own policy names do not agree on one shape, so this is the documented pattern."* — on tenants with **zero** CA policies. Two personas, two steps, one sentence template. | The clause requires policies that exist and actually disagree. |
| G5.8 ✅ | 3 | Nadia | `s-check-separate-admin-accounts` | *"Fix before continuing"* on a blocker whose only unreadable source is `pimEligibility`, reason **"needs Entra ID P2"**, on a tenant with `entraP2: {enabled: false}`. The words licence, premium and P2 appear nowhere on the step. | A licence blocker names the licence. |
| G5.9 ✅ | 3 | Priya | `s-goal-admin-portals-protected` | Prescribes *"…needs Entra ID P1; once both are in place, scan again"* on a tenant where `entraP1` and `entraP2` are both enabled. | Licence prerequisites check what the tenant holds. |
| G5.10 ✅ | 3 | Priya | `s-goal-admins-phishing-resistant`, `s-goal-register-info-protected` | An unread count and a measured zero print identically: *"It is not measured yet: 0 of 39 people…"* reads the same as the post-grant measured *"0 of 2 people…"*. | Unmeasured never renders as a number. |
| G5.11 ✅ | 3 | Sam | board | Two different pairs. **The admin pair was a defect**: every step counts admins over its ACTIVE ids (`generate.ts population` says so in as many words) and the administrator-separation step counted them over all of them, so one tenant read "51 admins" on one step and "60 admins" on another over the same sixty accounts. Fixed, with a test over six fixtures that no step reports more admins or guests than the people it counts. **The guest pair is two populations on purpose** — every guest account against the ones a step acts on — and the Guest Directory tile now says which it is. | Done. |
| G5.12 ❌ | — | Sam | headline population | **The number is right. Established 2026-09-22.** Measured on `large`: `4,169 → 4,167` on +1 day, then flat to +11. Exactly two accounts sat at **90 days** since last sign-in, which is `INACTIVE_DAYS`, so they left the window on the first day. Nobody followed them because the fixture generator writes sign-in dates in two bands — `rand() * 45` or `90 + rand() * 200` — leaving a **45-day hole** no synthetic person occupies. The window is sliding; it is sliding over empty space. Left as it is (every committed count and snapshot is taken over this shape) and the generator now says so at the line that makes it. | None on the product. |
| G5.13 ✅ | 2 | Marcus | `s-goal-device-registration-mfa` | The readiness denominator is its own population — the people the target policies apply to — and is neither the step's active count nor its enabled count. The line said "people" and left the reader to work out which of the three it was. It now says. The count does not move, and a test holds it to the step's own `methodPreparation`. | Done. |
| G5.14 ❌ | — | Priya | every policy step | **Not a defect as filed. Checked 2026-09-21.** "covers 40 enabled" on a 42-account tenant is the policy's RESOLVED population: `population.total` is 40 and `inScope` is 40, the two subtracted being the saved break-glass accounts the policy excludes. The arithmetic is right. The real objection underneath — that IAMAI cannot verify those two are actually in the exclusions group — is G5.5, and is tracked there. | None here. |
| G5.15 ✅ | 3 | Nadia | `s-check-dormant-accounts` | *"9 accounts"* dormant where 11 of 13 have no sign-in record. The two omitted are the emergency accounts — almost certainly right, never stated, so a hand count gets 11 and concludes the scan missed two. | A count that excludes a class says so. |
| G5.16 ✅ | 4 | Jordan | `s-prereq-exclusion-group` | Task list: *"Select **bg1@…**, **bg2@…**, choose **Remove**, then confirm."* The consequence — *"Removing the rest puts each of them back inside every policy this group is excluded from, and 3 of those are On today…"* — is in portal paragraph 4. Jordan got lucky because the accounts were named "Break-glass"; named `svc-admin-01` he locks himself out. | The consequence sits with the instruction, not four paragraphs away. |
| G5.17 ✅ | 4 | Jordan | 8 steps, one scan | *"New evidence · not deployed at the last scan and enforced by Aug 29, 2026: it went live without a report-only period IAMAI could watch…"* survives exactly one scan (8 → 0 the next day) and never reaches the board word. Five steps showed `Completed` while that line was live. | The record of an unobserved enforcement persists and reaches the board. |
| G5.18 ✅ | 3 | Jordan | `s-prereq-break-glass` on `midflight` | The findings said nothing because the product had no way to say it. `midflight` carries **six** policies with IAMAI's own tag and every preserved one read *"Already delivered by X, so there is nothing to create"* — the wording for coverage somebody else put there, while *"IAMAI watched it get there"* would have been false. `tracking.matchedBy === 'tag'` was the whole answer and was already on the step. A third wording now names an inherited policy as inherited, and the disabled one is named by G3.2. | Done. |
| G5.19 ✅ | 3 | Nadia | `s-prereq-passkey-settings` | Both groups are assembled from checks that each state why they matter (`passkeySettings.ts findingsFor`, fifth argument) and the group blanked it. `reasonOf` reads it back, capped at two sentences because the items already carry the evidence; "Existing passkeys affected · Could not verify" now says what it could not read. `stepExport` joins a detail only where there is one, so the fix line no longer ends in a stop and a space. | Done. |
| G5.20 ✅ | 2 | Nadia | `s-prereq-break-glass` | Three channels, three answers. The AI brief's *"No account preparation action is currently projected."* was **not a reading of anything** — it printed tasks built `required`, and no emergency account task is ever built that way, so the branch was unreachable and the sentence unconditional; it now lists the step's own outstanding findings. The portal sentence now names the three changes that procedure makes. *"also registered by Break-glass 2"* named the second account and dropped the one it was about; the item carried it and only the summary threw it away. | Done. |
| G5.21 ❌ | — | Marcus | `s-prereq-passkey-settings` | **Does not reproduce as a product defect. Withdrawn 2026-09-21.** "Continue with the steps below to register a replacement" points at the task's three VARIANTS — YubiKey, Authenticator on iOS, Authenticator on Android — six registration steps each, which the page draws. The harness's `render()` returned only `task.steps` and dropped `task.variants`, so the reader of the harness met an instruction pointing at nothing. The harness now exposes variants, so the next round cannot repeat it. | None on the product. |
| G5.22 ⚠️ | 3 | Marcus | `s-prereq-break-glass` at `done` | **Reproduces exactly, but the design is deliberate — owner decision.** At `done`/`Completed` the step still prints three task blocks of 8, 9 and 10 imperative lines, two of them led by a line saying nothing needs doing. `emergencyAccountTasks.ts` keeps them on purpose: "with none needing any, every change stays available as a reference." The defect is that reference material is written as commands. | A presentational change only. Do not delete the procedures. |
| G5.23 ✅ | 3 | Marcus | `s-goal-require-managed-device` | Findings line is a subject-less fragment: *"New evidence · not what the plan asked for in device platforms, and IAMAI does not write that part: a person corrects it in the Entra admin center, then scans again"*. | Findings lines are sentences. |
| G5.24 ✅ | 2 | Nadia | `s-ladder-operator-passkey` vs `s-check-dormant-accounts` | The `(guest)` marker settled the one case it was written for and nothing else: two **members** with one name were both rendered bare — twice on `messy`, seven times on `midflight`, and on `large` one display name over **twenty-six** accounts. `names.ts personLabels` is now the one rule: mark the guest, look again, and any label still shared carries the sign-in address. A name nobody shares is untouched. | Done. A test asserts no two people on eight shipped tenants render as the same string. |
| G5.25 ✅ | 2 | Priya | `s-goal-guests-mfa` | The Guest Directory tile joined its note and its names with newlines and nothing between them, so on a tenant with one guest it read as two sentences and then a person's name on a line of its own. The list now says it is a list. The `Not supported` tile beside `Enforced` was the second half and is fixed with G3.1: the tile names the tenant policy delivering the goal. (The lane half — `Ready` — was fixed by G4.6; it now reads `Blocked`.) | Done. |
| G5.26 ✅ | 2 | Priya | `s-prereq-allowed-countries` | Duplicate identical tile: *"Allowed countries · Not Fully Read · Missing scan evidence: sign-in records"* rendered twice. | Tiles deduplicate. |
| G5.27 ✅ | 2 | Priya | `s-prereq-trusted-location` | The step has two answers and had one completion. Answered "everyone is remote" it was marked Completed and still read *"An IP named location … is marked as trusted"* — a criterion its own tile denies — on five shipped fixtures. The completion now follows the answer, read from the mapping, and its second line says plainly that a trusted location the tenant already holds is outside this plan and that the step claims nothing about it. | Done. |
| G5.28 ✅ | 2 | Marcus | `s-goal-require-managed-device` and 2 others | *"Implementation · Unavailable … The instructions come back when it does."* read as a claim about everything on screen, on a step still drawing portal prose, a `-Mode 'Create'` body and the AI brief. The readiness hold takes exactly one thing — the operation that turns the policy on — and the sentence now says which, because `enforcesOnRun` is what the gate tests. **Filed at severity 4 on the grounds that an `Enforce` script was present — that does not reproduce** (the `Enforce` he saw is an entry in the shared function's `ValidateSet`; the invocation is `-Mode 'Observe'`). | Done, with a test that the claim is true on every shipped fixture. |
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

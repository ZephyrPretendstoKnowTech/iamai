# IAMAI Dependency and Actionability Playbook (v3)

**Authority.** This is the reference design artifact for IAMAI's dependency-driven Plan reorganization. It answers four questions: what technically depends on what; which exact action or milestone each prerequisite gates; which lane a step belongs in given current tenant and step state; and what to show first inside Ready and Up Next. It is written so Claude Code can implement it later without inventing product rules.

**Scope.** Documentation and modelling only. No IAMAI runtime change is authorised by this document. The 46 visible package steps are preserved; everything finer than a visible step (actions, milestones, blockers) is dependency-model structure.

**Snapshot.** 2026-09-11 project state. 46 visible steps plus runtime-generated Plan rows. Technical dependency research from v1/v2 is preserved; each edge changed since v1 is explained in Appendix B.

**Status of the data.** The edge table (§10) is authored from the library manifest binding families plus agreed corrections. Rows tagged `V#` are unverified against the pinned target or first-party Microsoft documentation and must clear Appendix A before the table is frozen. No field in this document was filled from tenant data, a weighting source, an observation duration, or an unresolved owner decision; where such a value is needed it is left empty and flagged.

---

## 1. Core principles

1. **Dependencies drive; phases describe.** A phase or forecast date may say when IAMAI expects work to happen. It never grants or denies actionability.
2. **Two questions per step, never one.** "Can the operator start the technical work?" and "is it safe to enforce?" are gated separately. Readiness gates enforcement; construction gates creation. Neither is a blanket rule for the other.
3. **Construction rule.** If the intended pinned object requires a tenant object or reference (group, named location, authentication strength, authentication context, service principal) to construct its canonical Report-only configuration, that reference is a start-work prerequisite. IAMAI does not describe a known-incomplete temporary variant unless the product explicitly supports that state.
4. **Lane = state of the next action, plus whether durable work has started.** Not the step's whole lifecycle.
5. **Work type and actionability are orthogonal.** Preparation, Cleanup, Microsoft-recommended, Decision, Prerequisite, Policy are provenance/work types. Any of them can be in any lane.
6. **Nothing is invented.** No security scores, observation durations, tenant counts, baseline IDs, source-object meanings, owner decisions, new visible steps, or unverified platform behaviour. Unknowns are recorded as typed unknowns.
7. **Store direct edges; compute the rest.** Transitive blockers and unlock counts are derived under the invariant in §9.3.

---

## 2. Actionability lanes

Three primary lanes. Completed and Deferred are secondary views (`Show completed`, `Show deferred`), not equal-weight tabs.

### Ready — current work

A step is Ready if **either** its next safe action can be performed now, **or** durable work has already started and is progressing normally. Ready answers "what can I work on now, or what is already underway?"

Substatuses (one per step, shown with the lane):

| substatus | meaning |
|---|---|
| `Create` | nothing exists yet; the canonical object can be created now |
| `Correct` | the object exists but drifts from the pinned target; correction can be made now |
| `Needs decision` | an owner decision whose inputs are all present |
| `Observing` | started (object exists, typically Report-only); next progression waits on an evidence predicate or on a healthy prerequisite |
| `Ready to enforce` | started; evidence predicate satisfied; enforcement gates satisfied |

### Up Next — healthy queued work that has not started

A step is Up Next when the work has not started, its next safe action is not available yet, every unresolved prerequisite on the path is itself Ready, Observing, or Up Next, and no abnormal blocker exists. Depth of a healthy chain is a **sorting** concern inside Up Next (§14), never a reason for On Hold. Presented with its nearest blocker: `Up Next · After Emergency Access`.

### On Hold — normal progression requires intervention

A step is On Hold when an applicable abnormal blocker prevents normal progress: source or baseline conflict, unresolved required tenant fact, blocked owner decision, missing license/capability, unsafe baseline target, a prerequisite that is itself On Hold, an applicable hard prerequisite that is Deferred, a missing object that no plan step produces, or a technical state IAMAI cannot safely resolve. On Hold is never a generic waiting bucket; every On Hold step names its blocker (§15).

### Completed (secondary)

Terminal intended outcome reached. **Derived on every scan**, never stored; a regressed tenant re-derives out of Completed.

### Deferred (secondary)

Owner explicitly excluded or deferred the step. User-facing term is Deferred; the internal state name may differ. Foundation steps cannot be deferred (existing product rule). Deferral propagates to dependents per §8.3.

---

## 3. Started — the load-bearing definition

A step is **started** only when durable evidence shows the underlying work has begun. Opening, viewing, expanding, or interacting with a Plan row does not start it.

Durable started evidence:

- the target object exists in the tenant (pre-existing configuration counts; IAMAI need not have created it);
- the Conditional Access policy exists, in any state including Report-only;
- an existing object or policy is being corrected (drift detected against the pinned target);
- a required decision has been recorded (the decision step is then Completed, and its dependents may become started through their own objects);
- a workflow has durable tenant or product state showing work has begun.

Not started: nothing exists; only a decision is pending; only a plan row has been viewed.

**Invariant — started work does not move back to Up Next.** A started step leaves Ready only when it completes, an abnormal blocker appears (→ On Hold), or the owner defers it. A Report-only policy waiting on a healthy prerequisite or on evidence before enforcement is `Ready · Observing`, not Up Next.

---

## 4. Lane derivation algorithm

Evaluate in this order; the first match wins. Every healthy step resolves deterministically.

```
1. Terminal intended outcome reached (re-derived this scan)         → Completed
2. Explicitly owner-deferred                                          → Deferred
3. Evaluate applicable abnormal blockers (§15) on the step's
   NEXT ACTION. Any blocker preventing normal progress                → On Hold
      (includes: prerequisite On Hold; applicable hard prerequisite
       Deferred; blocked decision; source/baseline conflict; missing
       license/capability; unresolved required fact; missing object
       no plan step produces)
4. Determine whether durable work has STARTED (§3)
5. Started and progressing normally                                   → Ready
      substatus: Correct | Observing | Ready to enforce
6. Not started, next safe action executable now                       → Ready
      substatus: Create | Needs decision
7. Not started, dependency chain progressing normally
   (all unresolved prerequisites Ready / Observing / Up Next)         → Up Next
      reason: nearest unresolved prerequisite
```

Next-action determination (used by steps 3, 5, 6):

- Policy steps: `create` (object absent) → `correct` (object present, drift) → `observe` (object present as pinned, evidence predicate open) → `enforce` (predicate satisfied) → terminal.
- Foundation objects and cleanup/cutover steps: `start` → `correct` (if drift) → `complete`.
- Decision steps: `decide` → recorded (Completed).

Decision rule: a decision with all required inputs present is `Ready · Needs decision`; a dependent waiting only on it is Up Next. A decision that cannot yet be made (missing evidence, unresolved source truth, missing capability) is On Hold and so are its dependents. Distinguish *actionable* from *blocked* decisions; a decision is not inherently a hold.

Conditional edges participate in steps 3, 6, and 7 only when their condition is applicable (§8).

---

## 5. Action and milestone dependency model

Dependencies are not `Step A depends on Step B`. They are:

`<step>:<action> ← <prerequisite> @ <required milestone> [condition]`

with a prerequisite kind, an edge kind (hard/conditional), a source, and a verification status.

**Actions** a gate can point at (gated side):

| action | applies to | meaning |
|---|---|---|
| `create` | policy, object | initial creation/configuration in its canonical form (policies: Report-only) |
| `correct` | policy, object | bring an existing object to the pinned target |
| `observe` | policy | enter or continue observation (rarely gated separately; usually the evidence predicate lives here) |
| `enforce` | policy | set On / intended terminal configuration |
| `start` / `complete` | foundation object, cleanup, cutover | begin / finish |
| `decide` | decision | record the owner answer |

**Milestones** a prerequisite can be required at (prerequisite side): `created` (object exists in any state), `complete` (object/decision/cleanup finished), `ready-to-enforce` (policy created, predicate satisfied, enforcement gates clear), `enforced`, `resolved` (blocker/decision), and the named Emergency Access milestones in §9.1.

The visible product keeps one Plan step; the graph reasons over these actions and milestones internally.

---

## 6. Prerequisite kinds

| kind | what it is | how it resolves |
|---|---|---|
| `step` | another IAMAI step at a required milestone | that step reaching the milestone |
| `fact` | tenant-readable configuration or capability | scan evidence |
| `decision` | owner answer | recorded in Plan settings / step |
| `evidence` | observed tenant behaviour (sign-in samples, compliance reporting, method coverage) | scan evidence meeting the step's predicate |
| `license/platform` | licensing or a capability outside Entra CA (Intune, Defender for Cloud Apps, PIM, P2, Workload ID Premium) | scan fact or owner confirmation |
| `time/evidence-window` | elapsed observation where a control genuinely requires it | clock, as one component of an evidence predicate, never the universal model |
| `sourceConflict` / `baselineSafetyConflict` | the pinned source is internally contradictory, ambiguous, or unsafe as authored | source mapping / author correction; never silently fixed by IAMAI |
| `sourceMapping` | an unresolved source group or named-location reference in a pinned policy | Baseline mappings in Plan settings (§18.1) |
| `suspendedPrerequisite` | derived: an applicable hard prerequisite is Deferred | owner un-defers or the condition becomes not applicable |

Every non-step prerequisite carries an ID so it can be shown once as a readiness tile (§16) and grouped in On Hold (§15).

---

## 7. Observation and evidence rule

Observation is a Ready substatus, not a lane. A started policy whose next progression needs evidence to mature is `Ready · Observing`.

An observation requirement is an **evidence predicate**, control-specific, possibly with a time component. Components in use across the library: elapsed observation time (only where a control genuinely requires it), sufficient sign-in samples, no unexpected failures, compatibility confirmation, readiness threshold, human validation, pilot-scope validation where Report-only is not evaluated for the policy's scope (user-action policies; Appendix A V9), and PIM's pilot-role validation where Report-only is not meaningful at all.

No universal Report-only duration exists in this document. The runtime's default time component is 7 days of observation (3 where nobody is affected); a package may override it per step with the META field `observation.minDays` (null = the default), and the evidence gate carries that number as its time part (A1a, decision 5).

---

## 8. Conditional dependency rules

Every real conditional dependency is an edge with a condition predicate. None is maintained only in prose.

| condition | owned by | meaning |
|---|---|---|
| `mail-devices-incompatible-path` | `s-question-mail-devices` | mail-sending devices/apps use an authentication or submission path the intended legacy-auth protection would block |
| `partner-accounts-exist` | `s-question-partner` | partner/MSP identities need a carve-out in the affected scope |
| `travel-exceptions-allowed` | `s-question-travel` | the organisation permits temporary travel exceptions |
| `shared-devices-exist` | `s-shared-devices` | confirmed shared identities/devices |
| `sd-enabled` | `s-prereq-security-defaults` | Security Defaults currently enabled |
| `campaign-targets-passkey` | `s-verify-mfa` | the registration campaign targets passkeys rather than Authenticator only |

### 8.1 Resolution
- applicable → prerequisite participates as a normal edge;
- not applicable → edge satisfied/removed;
- unresolved → classify by the condition's own blocker kind (usually `evidence` or `decision`, evaluated by the decision rule in §4). Never silently satisfy an unresolved condition.

### 8.2 Answering "no" completes the owning step
A question step whose condition resolves not-applicable reaches its terminal outcome and is Completed; it does not create permanent work.

### 8.3 Deferred prerequisite propagation
- Hard applicable edge, prerequisite Deferred → dependent On Hold, blocker `suspendedPrerequisite` (user-facing: "Waiting on a deferred step").
- Conditional edge: not applicable → satisfied; applicable and prerequisite Deferred → dependent On Hold; applicability unresolved → resolve by the condition's blocker.
- A required missing or deferred prerequisite never makes the dependent Ready.

### 8.4 Missing objects
A missing object that a plan step produces is a healthy prerequisite (Up Next territory). A missing object that **no plan step produces** (an unmapped source group, a named location the baseline references but the library never creates) is an abnormal blocker (`sourceMapping` or `fact`) → On Hold.

---

## 9. Emergency Access and safety rules

### 9.1 Milestones
- `emergency-access.minimum-satisfied` — the safety minimum the Emergency Access step requires before its own scan completes. **May gate downstream rollout.**
- `emergency-access.hardening-complete` — deferrable resilience work, closed by the runtime row `cleanup-hardening`. **Never a generic rollout prerequisite.** Only an independently proven per-control requirement may reference it, recorded explicitly with its source.

Do not require the whole Emergency Access step to be complete when minimum safety is satisfied. No new visible step is created for this.

### 9.2 Where emergency-access proof enters the graph
Every policy that references the exclusions group inherits `minimum-satisfied` through `s-prereq-exclusion-group:start ← s-prereq-break-glass@minimum-satisfied`. Direct break-glass edges on policy steps are therefore not recorded (Appendix B).

### 9.3 Transitive inference invariant
Only direct causal edges are stored. Transitive blockers, chains, and unlock counts are computed. A direct edge may be omitted as redundant **only** when the indirect path proves the same or a stronger prerequisite milestone for the same gated action under the same or a broader condition. A weaker intermediate milestone cannot imply a stronger prerequisite: `minimum → exclusions:create → policy:create` establishes minimum, never hardening.

### 9.4 High-lockout controls and baseline safety conflicts
For a restrictive control whose canonical scope reaches the emergency identities, verification distinguishes:

1. the pinned target contains the exclusion → `create ← s-prereq-exclusion-group@complete` (construction rule);
2. the pinned target does not → record `baselineSafetyConflict` on `enforce`, raise with the baseline author, never silently correct the source, never omit the relationship.

Report-only creation may proceed under (2); enforcement is held. The document records both dependency edges and source/baseline defects. Affected steps and allowed outcomes are in Appendix A V2.

### 9.5 Security Defaults
A coordinated cutover, never a day-one prerequisite. Encoded both directions as conditional edges on `sd-enabled` (§10.1): replacement CA preparation → Security Defaults disablement; Security Defaults disablement → CA enforcement. Whether Report-only creation is permitted while Security Defaults remains enabled is unconfirmed in first-party documentation; the gate stays on `enforce` until Appendix A V3 clears, and is moved to `create` if Microsoft blocks Report-only creation.

### 9.6 Workload identity
Identity type is resolved before licensing or CA semantics are inferred. The Entra Connect synchronisation account is a user account holding the Directory Synchronization Accounts role; Cloud Sync uses a service principal. Only a service-principal target is a workload-identity CA policy requiring Workload ID Premium. The dependency is conditional on identity type (Appendix A V10).
## 10. Canonical dependency edge table

This table is the authority. §11's per-step entries, the spine in §12.0, and the unlock index in §12 are views over it. Do not hand-maintain relationships in two places.

Only direct causal edges appear. `status` = `ok` (carried from v1 package bindings or first-party documentation, no open question) or `V#` (open item in Appendix A).

Condition names used: `sd-enabled` (Security Defaults currently enabled in the tenant), `mail-devices-incompatible-path` (mail-sending devices/apps use an authentication or submission path the intended legacy-auth protection would block), `partner-accounts-exist` (partner/MSP identities need a carve-out), `travel-exceptions-allowed` (the organization permits temporary travel exceptions), `shared-devices-exist` (confirmed shared identities/devices).

### 10.0 Step index (static fields)

`baseline_order` was removed (Appendix A V6, owner answer): the source author's listing order is incidental and is not a tie-break. `iamai_order` is an empty owner-authored field reserved for a later product-authored ordering; it is not populated and no values are proposed. `scope_class` and `effort_kind` are static classifications used by §13–§14; runtime affected population is never recorded here. `generated` says whether `dependency-data.json` carries the step: `yes`, or `no — <reason>` for a goal the pinned baseline does not hold (A1a, decision 7); every edge naming a `no` step is skipped by the build, on either side. Ids are the runtime's own (`s-goal-all-users-no-persistence`, `cleanup-hardening`; decision 8).

| step_id | title | work_type | scope_class | effort_kind | iamai_order | generated |
|---|---|---|---|---|---|---|
| `s-check-dormant-accounts` | Disable or Confirm Dormant Accounts | identity hygiene | all-users | portal | | yes |
| `s-check-separate-admin-accounts` | Use Separate Accounts for Admin Work | privileged identity hygiene | admins | portal | | yes |
| `s-prereq-device-plan` | Decide How Devices Are Managed | owner decision | decision | decision | | yes |
| `cleanup-notAssessed` | Review Baseline Policies IAMAI Did Not Assess | source review / cleanup | n/a | portal | | yes |
| `s-prereq-break-glass` | Create or Correct Emergency Access Accounts | foundation safety | admins | portal | | yes |
| `s-prereq-exclusion-group` | Create or Correct Exclusions Group | foundation object | n/a | portal | | yes |
| `cleanup-drill` | Run the Emergency Access Drill | rollout proof / cleanup | admins | operational | | yes |
| `s-prereq-passkey-settings` | Set Up Passkeys to Match the Baseline | authentication-method foundation | all-users | portal | | yes |
| `s-ladder-operator-passkey` | Register Your Own Passkey | operator readiness | admins | portal | | yes |
| `s-prereq-auth-strength` | Create the Baseline's Authentication Strength | foundation object | n/a | portal | | yes |
| `s-verify-mfa` | Create and Enforce the MFA Registration Campaign | readiness / registration | all-users | portal | | yes |
| `s-prereq-trusted-location` | Define the Trusted Network | foundation object | n/a | portal | | yes |
| `s-prereq-allowed-countries` | Create or Correct Allowed Countries Location | foundation object | n/a | portal | | yes |
| `s-prereq-service-accounts-group` | Create or Correct Service Accounts Group | foundation object | service-accounts | portal | | yes |
| `s-question-mail-devices` | Set Up an SMTP Relay for Mail-Sending Devices | conditional remediation | devices | external-platform | | yes |
| `s-question-partner` | Exclude the Partner or MSP Accounts | owner decision / exception design | guests | decision | | yes |
| `s-question-travel` | Add a Travel Notice and Exclusion | operational exception workflow | all-users | operational | | yes |
| `s-shared-devices` | Give Shared Devices Their Own Policy | supporting policy / exception design | devices | portal | | yes |
| `s-goal-mfa-all-users` | Require MFA for Everyone | CA policy | all-users | portal | | yes |
| `s-goal-admins-phishing-resistant` | Require Phishing-Resistant MFA for Admins | CA policy | admins | portal | | yes |
| `s-goal-azure-management-mfa` | Require MFA for Azure Management | CA policy | admins | portal | | no — not in pinned baseline |
| `s-goal-admin-session` | Shorten Admin Sessions | CA policy | admins | portal | | yes |
| `s-goal-admin-portals-protected` | Block the Admin Portals for Non-Admins | CA policy | all-users | portal | | yes |
| `s-goal-block-auth-transfer` | Block Authentication Transfer | CA policy | all-users | portal | | yes |
| `s-goal-block-device-code` | Block Device Code Sign-in | CA policy | all-users | portal | | yes |
| `s-goal-block-legacy-auth` | Block Legacy Authentication | CA policy | all-users | portal | | yes |
| `s-goal-block-unsupported-platforms` | Block Unsupported Device Platforms | CA policy | devices | portal | | yes |
| `s-goal-device-registration-mfa` | Require MFA to Register a Device | CA user-action policy | devices | portal | | yes |
| `s-goal-intune-enrollment-reauth` | Require a Fresh Sign-in for Intune Enrollment | CA policy | devices | portal | | yes |
| `s-goal-register-info-protected` | Protect Sign-in Method Registration | CA user-action policy | all-users | portal | | yes |
| `s-goal-require-managed-device` | Require a Managed Device Outside the Office | CA + Intune composite | all-users | external-platform | | yes |
| `s-goal-mobile-app-protection` | Require App Protection on Phones | CA + Intune composite | devices | external-platform | | no — not in pinned baseline |
| `s-goal-all-users-no-persistence` | Limit How Long Sessions Last | CA policy pair | all-users | portal | | yes |
| `s-goal-token-protection` | Require Token Protection on Windows | CA session control | devices | portal | | yes |
| `s-goal-unmanaged-browser` | Limit Unmanaged Devices in the Browser | CA / Defender for Cloud Apps composite | all-users | external-platform | | no — not in pinned baseline |
| `s-goal-geo-restriction` | Block Sign-ins From Countries Not Allowed | CA policy | all-users | portal | | yes |
| `s-goal-guests-mfa` | Require MFA for Guests | CA policy pair | guests | portal | | yes |
| `s-goal-service-accounts-trusted-network` | Restrict Service Accounts to the Trusted Network | CA policy | service-accounts | portal | | yes |
| `s-goal-workload-identity-block` | Restrict the Entra Connect Sync Account to Its Address | identity-type-dependent | workload-identity (pending) | portal | | yes |
| `s-goal-sign-in-risk` | Challenge High-Risk Sign-ins | Identity Protection CA | all-users | portal | | yes |
| `s-goal-sign-in-risk-medium` | Challenge Medium-Risk Sign-ins | Identity Protection CA | all-users | portal | | yes |
| `s-goal-user-risk` | Remediate High-Risk Users | Identity Protection CA | all-users | portal | | yes |
| `s-goal-user-risk-medium` | Reset Passwords for Medium-Risk Users | Identity Protection CA | all-users | portal | | yes |
| `s-goal-pim-activation-reauth` | Require MFA at Every Role Activation | CA + PIM composite | admins | portal | | yes |
| `s-prereq-security-defaults` | Turn Off Security Defaults | cutover | all-users | portal | | yes |
| `s-prereq-per-user-mfa` | Finish Moving Off Per-User MFA | cutover / legacy cleanup | all-users | portal | | yes |
| `cleanup-hardening` | Harden Emergency Access | conditional cleanup row produced when resilience hardening is deferred from the Emergency Access step | n/a | portal | | yes |

### 10.1 Foundation, cutover, and question steps

| gated_action | prerequisite | prerequisite_kind | milestone | condition | edge_kind | source | status |
|---|---|---|---|---|---|---|---|
| `s-prereq-exclusion-group:start` | `s-prereq-break-glass` | step | `minimum-satisfied` | — | hard | package | ok |
| `cleanup-drill:start` | `s-prereq-break-glass` | step | `minimum-satisfied` | — | hard | package | ok |
| `cleanup-hardening:start` | `s-prereq-break-glass` | step | `minimum-satisfied` | — | hard | audit | ok |
| `s-ladder-operator-passkey:start` | `s-prereq-passkey-settings` | step | `complete` | — | hard | package | ok |
| `s-verify-mfa:start` | `s-prereq-passkey-settings` | step | `complete` | — | hard | owner | ok |
| `s-question-travel:start` | `s-prereq-allowed-countries` | step | `complete` | — | hard | package | ok |
| `s-shared-devices:start` | `s-prereq-trusted-location` | step | `complete` | — | hard | package | ok |
| `s-shared-devices:complete` | `s-goal-require-managed-device` | step | `created` | `shared-devices-exist` | conditional | v2 | ok |
| `s-shared-devices:complete` | `s-goal-all-users-no-persistence` | step | `created` | `shared-devices-exist` | conditional | v2 | ok |
| `s-prereq-per-user-mfa:start` | `s-goal-mfa-all-users` | step | `enforced` | — | hard | ms-doc | ok |
| `s-prereq-security-defaults:start` | `s-goal-mfa-all-users` | step | `ready-to-enforce` | `sd-enabled` | conditional | ms-doc | ok |
| `s-prereq-security-defaults:start` | `s-goal-admins-phishing-resistant` | step | `ready-to-enforce` | `sd-enabled` | conditional | ms-doc | ok |
| `s-prereq-security-defaults:start` | `s-goal-block-legacy-auth` | step | `ready-to-enforce` | `sd-enabled` | conditional | ms-doc | ok |
| `s-prereq-security-defaults:start` | `s-goal-azure-management-mfa` | step | `ready-to-enforce` | `sd-enabled` | conditional | ms-doc | ok |
| `<every CA policy step in §11 E–H>:enforce` | `s-prereq-security-defaults` | step | `complete` | `sd-enabled` | conditional | ms-doc | ok |

### 10.2 Broad and privileged Conditional Access controls

| gated_action | prerequisite | prerequisite_kind | milestone | condition | edge_kind | source | status |
|---|---|---|---|---|---|---|---|
| `s-goal-mfa-all-users:create` | `s-prereq-exclusion-group` | step | `complete` | — | hard | package | ok |
| `s-goal-mfa-all-users:enforce` | `s-verify-mfa` | step | `complete` | — | hard | package | ok |
| `s-goal-admins-phishing-resistant:create` | `s-prereq-auth-strength` | step | `complete` | — | hard | package | ok |
| `s-goal-admins-phishing-resistant:create` | `s-prereq-exclusion-group` | step | `complete` | — | hard | pinned | ok |
| `s-goal-admins-phishing-resistant:enforce` | `s-prereq-passkey-settings` | step | `complete` | — | hard | package | ok |
| `s-goal-admins-phishing-resistant:enforce` | `s-verify-mfa` | step | `complete` | — | hard | package | ok |
| `s-goal-azure-management-mfa:create` | `s-prereq-service-accounts-group` | step | `complete` | — | hard | package | ok |
| `s-goal-azure-management-mfa:enforce` | `s-prereq-exclusion-group` | step | `complete` | — | hard | package | ok |
| `s-goal-admin-session:create` | `s-prereq-exclusion-group` | step | `complete` | — | hard | pinned | ok |
| `s-goal-admin-portals-protected:create` | `sourceConflict:admin-portals-target` | sourceConflict | `resolved` | — | hard | audit | ok |
| `s-goal-admin-portals-protected:create` | `s-prereq-exclusion-group` | step | `complete` | — | hard | pinned | ok |
| `s-goal-block-auth-transfer:create` | `s-prereq-exclusion-group` | step | `complete` | — | hard | pinned | ok |
| `s-goal-block-device-code:create` | `s-prereq-exclusion-group` | step | `complete` | — | hard | pinned | ok |
| `s-goal-block-legacy-auth:create` | `s-prereq-exclusion-group` | step | `complete` | — | hard | pinned | ok |
| `s-goal-block-legacy-auth:enforce` | `s-prereq-service-accounts-group` | step | `complete` | — | hard | package | ok |
| `s-goal-block-legacy-auth:enforce` | `s-question-mail-devices` | step | `complete` | `mail-devices-incompatible-path` | conditional | v2 | ok |
| `s-goal-block-unsupported-platforms:create` | `s-prereq-exclusion-group` | step | `complete` | — | hard | pinned | ok |

### 10.3 Device, registration, session, and access-path controls

| gated_action | prerequisite | prerequisite_kind | milestone | condition | edge_kind | source | status |
|---|---|---|---|---|---|---|---|
| `s-goal-device-registration-mfa:create` | `s-prereq-auth-strength` | step | `complete` | — | hard | package | ok |
| `s-goal-device-registration-mfa:create` | `s-prereq-exclusion-group` | step | `complete` | — | hard | package | ok |
| `s-goal-intune-enrollment-reauth:create` | `s-prereq-exclusion-group` | step | `complete` | — | hard | package | ok |
| `s-goal-register-info-protected:create` | `s-prereq-trusted-location` | step | `complete` | — | hard | package | ok |
| `s-goal-register-info-protected:create` | `s-prereq-auth-strength` | step | `complete` | — | hard | package | ok |
| `s-goal-register-info-protected:enforce` | `s-prereq-passkey-settings` | step | `complete` | — | hard | package | ok |
| `s-goal-register-info-protected:enforce` | `s-verify-mfa` | step | `complete` | — | hard | package | ok |
| `s-goal-require-managed-device:create` | `s-prereq-device-plan` | step | `complete` | — | hard | package | ok |
| `s-goal-require-managed-device:create` | `s-prereq-trusted-location` | step | `complete` | — | hard | package | ok |
| `s-goal-require-managed-device:create` | `s-prereq-exclusion-group` | step | `complete` | — | hard | pinned | ok |
| `s-goal-require-managed-device:enforce` | `s-shared-devices` | step | `complete` | `shared-devices-exist` | conditional | package | ok |
| `s-goal-mobile-app-protection:create` | `s-prereq-device-plan` | step | `complete` | — | hard | package | ok |
| `s-goal-all-users-no-persistence:create` | `s-prereq-exclusion-group` | step | `complete` | — | hard | package | ok |
| `s-goal-all-users-no-persistence:enforce` | `s-shared-devices` | step | `complete` | `shared-devices-exist` | conditional | v2 | ok |
| `s-goal-unmanaged-browser:enforce` | `baselineSafetyConflict:unmanaged-browser-emergency-exclusion` | baselineSafetyConflict | `resolved` | — | hard | pinned | ok |
| `s-goal-token-protection:create` | `s-prereq-exclusion-group` | step | `complete` | — | hard | package | ok |

`s-goal-unmanaged-browser` has no step-prerequisite edges; its blockers are all non-step (see §11). Emergency-access relationships (V2, resolved by S0 from `pinned-refs.tsv`): `s-goal-require-managed-device` — the pinned object (660ab461) excludes the exclusions group, so `create ← s-prereq-exclusion-group@complete` is added above; `s-goal-unmanaged-browser` — no pinned object implements the goal (no `goalMap` entry, composite package with no member), so the pinned target does not exclude the emergency identities and a `baselineSafetyConflict` is recorded on `enforce` and raised with the baseline author; `s-goal-register-info-protected` and `s-goal-mobile-app-protection` — no pinned member in evidence (`memberStableId` null / composite with no member), outcome none.

### 10.4 Location, guest, service-account, and workload controls

| gated_action | prerequisite | prerequisite_kind | milestone | condition | edge_kind | source | status |
|---|---|---|---|---|---|---|---|
| `s-goal-geo-restriction:create` | `s-prereq-allowed-countries` | step | `complete` | — | hard | package | ok |
| `s-goal-geo-restriction:create` | `s-prereq-exclusion-group` | step | `complete` | — | hard | pinned | ok |
| `s-goal-geo-restriction:enforce` | `s-question-partner` | step | `complete` | `partner-accounts-exist` | conditional | v2 | ok |
| `s-goal-geo-restriction:enforce` | `s-question-travel` | step | `complete` | `travel-exceptions-allowed` | conditional | v2 | ok |
| `s-goal-guests-mfa:create` | `s-prereq-auth-strength` | step | `complete` | — | hard | package | ok |
| `s-goal-guests-mfa:enforce` | `s-question-partner` | step | `complete` | `partner-accounts-exist` | conditional | package | ok |
| `s-goal-service-accounts-trusted-network:create` | `s-prereq-service-accounts-group` | step | `complete` | — | hard | package | ok |
| `s-goal-service-accounts-trusted-network:create` | `s-prereq-trusted-location` | step | `complete` | — | hard | package | ok |
| `s-goal-workload-identity-block:create` | `decision:workload-identity-type` | decision | `resolved` | — | hard | audit | ok |

### 10.5 Identity Protection and privileged activation controls

| gated_action | prerequisite | prerequisite_kind | milestone | condition | edge_kind | source | status |
|---|---|---|---|---|---|---|---|
| `s-goal-sign-in-risk:create` | `s-prereq-auth-strength` | step | `complete` | — | hard | package | ok |
| `s-goal-sign-in-risk:create` | `s-prereq-exclusion-group` | step | `complete` | — | hard | pinned | ok |
| `s-goal-sign-in-risk:enforce` | `s-verify-mfa` | step | `complete` | — | hard | package | ok |
| `s-goal-sign-in-risk-medium:create` | `s-prereq-exclusion-group` | step | `complete` | — | hard | pinned | ok |
| `s-goal-sign-in-risk-medium:enforce` | `s-verify-mfa` | step | `complete` | — | hard | manifest | ok |
| `s-goal-user-risk:create` | `s-prereq-auth-strength` | step | `complete` | — | hard | package | ok |
| `s-goal-user-risk:enforce` | `s-prereq-exclusion-group` | step | `complete` | — | hard | package | ok |
| `s-goal-user-risk:enforce` | `s-verify-mfa` | step | `complete` | — | hard | package | ok |
| `s-goal-user-risk-medium:create` | `s-prereq-auth-strength` | step | `complete` | — | hard | pinned | ok |
| `s-goal-user-risk-medium:create` | `s-prereq-exclusion-group` | step | `complete` | — | hard | pinned | ok |
| `s-goal-user-risk-medium:enforce` | `s-verify-mfa` | step | `complete` | — | hard | package | ok |
| `s-goal-pim-activation-reauth:create` | `s-prereq-auth-strength` | step | `complete` | — | hard | package | ok |
| `s-goal-pim-activation-reauth:create` | `s-prereq-exclusion-group` | step | `complete` | — | hard | pinned | ok |

### 10.6 Edges removed from v1

- All 18 direct `s-prereq-break-glass` enforcement edges on policy steps. Each is implied by `s-prereq-exclusion-group:start ← s-prereq-break-glass@minimum-satisfied` plus the policy's own exclusions-group edge (§9.2). Removing them also fixes the v1 inconsistency where four steps carried both edges and `s-goal-all-users-no-persistence` carried only one.
- `s-prereq-auth-strength:enforce ← s-prereq-passkey-settings`. A strength object has no enforce state; method readiness is already gated on the policies that consume the strength.

### 10.7 Source-mapping blockers (from V11)

Each row is scoped to the `exclude` role: the pinned object excludes `62d67e66` and includes it nowhere (§18.1). A `correct` on the same step carries the same blocker. `1267ac22` is a named location included only by a policy that implements no goal, so it produces no row.

| gated_action | prerequisite | prerequisite_kind | milestone | condition | edge_kind | source | status |
|---|---|---|---|---|---|---|---|
| `s-goal-mfa-all-users:create` | `sourceMapping:62d67e66` | sourceMapping | `resolved` | — | hard | pinned | ok |
| `s-goal-admins-phishing-resistant:create` | `sourceMapping:62d67e66` | sourceMapping | `resolved` | — | hard | pinned | ok |
| `s-goal-admin-portals-protected:create` | `sourceMapping:62d67e66` | sourceMapping | `resolved` | — | hard | pinned | ok |
| `s-goal-admin-session:create` | `sourceMapping:62d67e66` | sourceMapping | `resolved` | — | hard | pinned | ok |
| `s-goal-block-auth-transfer:create` | `sourceMapping:62d67e66` | sourceMapping | `resolved` | — | hard | pinned | ok |
| `s-goal-block-device-code:create` | `sourceMapping:62d67e66` | sourceMapping | `resolved` | — | hard | pinned | ok |
| `s-goal-block-legacy-auth:create` | `sourceMapping:62d67e66` | sourceMapping | `resolved` | — | hard | pinned | ok |
| `s-goal-block-unsupported-platforms:create` | `sourceMapping:62d67e66` | sourceMapping | `resolved` | — | hard | pinned | ok |
| `s-goal-geo-restriction:create` | `sourceMapping:62d67e66` | sourceMapping | `resolved` | — | hard | pinned | ok |
| `s-goal-service-accounts-trusted-network:create` | `sourceMapping:62d67e66` | sourceMapping | `resolved` | — | hard | pinned | ok |
| `s-goal-all-users-no-persistence:create` | `sourceMapping:62d67e66` | sourceMapping | `resolved` | — | hard | pinned | ok |
| `s-goal-require-managed-device:create` | `sourceMapping:62d67e66` | sourceMapping | `resolved` | — | hard | pinned | ok |
| `s-goal-device-registration-mfa:create` | `sourceMapping:62d67e66` | sourceMapping | `resolved` | — | hard | pinned | ok |
| `s-goal-token-protection:create` | `sourceMapping:62d67e66` | sourceMapping | `resolved` | — | hard | pinned | ok |

---

## 11. Per-control dependency details (46 visible steps)

Per-step context that is not in the edge table: work type, static ordering fields, typed non-step blockers, the observation predicate for policy steps, and rationale. Inbound and outbound edges are **not** repeated here; look the step ID up in §10.

Field values: `scope_class` ∈ admins · all-users · guests · service-accounts · workload-identity · devices · decision · n/a. `effort_kind` ∈ portal (operator performs work in Entra/Intune) · decision (owner answer) · external-platform (work outside Entra CA) · operational (recurring/ongoing).

Observation predicates are written as the kind of evidence required, never as a number of days. Where Microsoft does not evaluate Report-only for the policy's scope, the predicate says so.

### A. Decisions, identity hygiene, and source truth

#### `s-check-dormant-accounts` — Disable or Confirm Dormant Accounts
- Work type: identity hygiene · scope_class: all-users · effort_kind: portal · actions: start → complete
- Non-step blockers: `evidence:` sufficient sign-in/activity evidence per flagged account; `decision:` owner disposition per account.
- Rationale: no technical dependency on CA. Do early to reduce identities before rollout; never a gate for unrelated controls.

#### `s-check-separate-admin-accounts` — Use Separate Accounts for Admin Work
- Work type: privileged identity hygiene · scope_class: admins · effort_kind: portal · actions: start → complete
- Non-step blockers: `fact:` privileged humans and current role assignments identifiable; `decision:` which daily/admin identities are separated.
- Rationale: operationally important before privileged-policy enforcement; not a technical prerequisite to create policies.

#### `s-prereq-device-plan` — Decide How Devices Are Managed
- Work type: owner decision · scope_class: decision · effort_kind: decision · actions: start → complete
- Non-step blockers: `decision:` how phones/computers are managed and how unmanaged phones are handled.
- Rationale: feeds managed-device and app-protection targets. Ready as soon as the owner can answer (§4 decision rule).

#### `cleanup-notAssessed` — Review Baseline Policies IAMAI Did Not Assess
- Work type: source review / cleanup · scope_class: n/a · effort_kind: portal · actions: start → complete
- Non-step blockers: `fact:` current pinned baseline source bundle and unassessed-member list available.
- Rationale: independent review. Gates nothing unless a reviewed member is later mapped to an assessed control.

### B. Emergency access and common exclusion foundation

#### `s-prereq-break-glass` — Create or Correct Emergency Access Accounts
- Work type: foundation safety · scope_class: admins · effort_kind: portal · actions: start → complete
- Milestones: `minimum-satisfied` (what this step requires before its own scan completes); `hardening-complete` (closed by `cleanup-hardening`).
- Non-step blockers: `fact:` at least two cloud-only accounts with permanent active Global Administrator; `evidence:` sign-in validated; `decision:` custody and method posture where the baseline leaves it open.
- Rationale: account creation does not depend on the exclusions group; the group is downstream. Any package binding implying the reverse must not become dependency truth. Cannot be deferred.

#### `s-prereq-exclusion-group` — Create or Correct Exclusions Group
- Work type: foundation object · scope_class: n/a · effort_kind: portal · actions: start → complete
- Non-step blockers: `fact:` emergency account member IDs known; `decision:` any other owner-approved exclusions.
- Rationale: the single object through which all policy exclusions flow (existing product rule). It is the one place emergency-access proof enters the policy graph (§9.2).

#### `cleanup-drill` — Run the Emergency Access Drill
- Work type: rollout proof / cleanup · scope_class: admins · effort_kind: operational · actions: start → complete
- Non-step blockers: `evidence:` accounts usable with intended method; `fact:` monitoring path exists if the drill also validates alerting.
- Rationale: the recurring drill gates nothing. Enforcement-time emergency proof belongs to `minimum-satisfied`, not to this row.

### C. Authentication-method and MFA readiness foundation

#### `s-prereq-passkey-settings` — Set Up Passkeys to Match the Baseline
- Work type: authentication-method foundation · scope_class: all-users · effort_kind: portal · actions: start → complete
- Non-step blockers: `decision:` target FIDO2/passkey profile or AAGUID posture where the baseline requires one; `fact:` Authentication Policy Administrator or equivalent.
- Rationale: enables registration work and phishing-resistant enforcement.

#### `s-ladder-operator-passkey` — Register Your Own Passkey
- Work type: operator readiness · scope_class: admins · effort_kind: portal · actions: start → complete
- Non-step blockers: `fact:` operator in scope for the passkey method with a supported registration path/device.
- Rationale: lets the operator test phishing-resistant flows early; gates nothing.

#### `s-prereq-auth-strength` — Create the Baseline's Authentication Strength
- Work type: foundation object · scope_class: n/a · effort_kind: portal · actions: start → complete
- Non-step blockers: `fact:` pinned baseline defines the method combinations; `license/platform:` tenant licensed for the consuming CA use.
- Rationale: the object can be created before users have methods registered. Method readiness gates the consuming policies, not this object (v1 passkey→strength edge removed).

#### `s-verify-mfa` — Create and Enforce the MFA Registration Campaign
- Work type: readiness / registration · scope_class: all-users · effort_kind: portal · actions: start → complete
- Non-step blockers: `fact:` for an Authenticator campaign, Authenticator enabled for targeted users with Any or Push mode; for a passkey campaign, FIDO2/passkeys and self-service setup enabled; `fact:` users in scope for the targeted method.
- Rationale: runs in parallel with Report-only deployment. It is an enforcement-readiness gate for MFA/strength controls, never a prerequisite to author their Report-only policies. The passkey-settings edge is hard: the campaign is always passkey-targeted (owner answer V7, §18.2).

### D. Network, location, service-account, and exception foundation

#### `s-prereq-trusted-location` — Define the Trusted Network
- Work type: foundation object · scope_class: n/a · effort_kind: portal · actions: start → complete
- Non-step blockers: `fact:` stable public egress IP ranges known and owned; `decision:` trusted marking matches intended semantics.

#### `s-prereq-allowed-countries` — Create or Correct Allowed Countries Location
- Work type: foundation object · scope_class: n/a · effort_kind: portal · actions: start → complete
- Non-step blockers: `decision:` allowed countries/regions and whether unknown areas are included.

#### `s-prereq-service-accounts-group` — Create or Correct Service Accounts Group
- Work type: foundation object · scope_class: service-accounts · effort_kind: portal · actions: start → complete
- Non-step blockers: `decision:` which identities are service accounts; `decision:` which workloads move to managed identities or another auth path.

#### `s-question-mail-devices` — Set Up an SMTP Relay for Mail-Sending Devices
- Work type: conditional remediation · scope_class: devices · effort_kind: external-platform · actions: start → complete
- Condition it owns: `mail-devices-incompatible-path`.
- Non-step blockers: `evidence:` mail-sending devices inventoried and their submission path known; `decision:` relay/authentication route; `fact:` accepted-domain/connector/static-IP or certificate details for the chosen route.
- Rationale: gates legacy-auth enforcement only when devices actually use a path the protection would block. Microsoft's SMTP AUTH Basic retirement timeline is a moving target (refined again January 2026); the condition is written semantically so it does not embed a date.

#### `s-question-partner` — Exclude the Partner or MSP Accounts
- Work type: owner decision / exception design · scope_class: guests · effort_kind: decision · actions: start → complete
- Condition it owns: `partner-accounts-exist`.
- Non-step blockers: `fact:` partner/MSP accounts, access model, tenant identity, affected policies identified.
- Rationale: "no special exclusion needed" resolves the condition to not-applicable rather than creating permanent work. Currently a conditional enforcement prerequisite for guests-MFA and geo-restriction; no admin-scoped pinned object reaches partner identities (V5 resolved, Appendix A findings).

#### `s-question-travel` — Add a Travel Notice and Exclusion
- Work type: operational exception workflow · scope_class: all-users · effort_kind: operational · actions: start → complete
- Condition it owns: `travel-exceptions-allowed`.
- Non-step blockers: `decision:` whether temporary travel exceptions are permitted; per exception, `fact:` traveller, destinations, dates.
- Rationale: never blocks geo-policy creation. Conditionally gates geo enforcement.

#### `s-shared-devices` — Give Shared Devices Their Own Policy
- Work type: supporting policy / exception design · scope_class: devices · effort_kind: portal · actions: start → complete
- Condition it owns: `shared-devices-exist`.
- Non-step blockers: `evidence:` shared identities/devices confirmed.
- Rationale: the dedicated policy can be designed once the trusted location exists; its **completion** depends on the people-policy objects it patches existing (edges to `require-managed-device@created` and `session-lifetime@created`, V8). This is an object-existence dependency, not an enforcement-phase dependency, and it is why start and complete are separate nodes.

### E. Broad and privileged Conditional Access controls

#### `s-goal-mfa-all-users` — Require MFA for Everyone
- Work type: CA policy · scope_class: all-users · effort_kind: portal · actions: create → observe → enforce
- Non-step blockers: `evidence:` MFA-method coverage sufficient before enforcement.
- Observation predicate: Report-only results reviewed; failure population understood; readiness threshold met (threshold is a product decision, not set here).
- Rationale: create early. Security Defaults is a cutover relationship (§10.1), never a reason to postpone creation.

#### `s-goal-admins-phishing-resistant` — Require Phishing-Resistant MFA for Admins
- Work type: CA policy · scope_class: admins · effort_kind: portal · actions: create → observe → enforce
- Non-step blockers: `evidence:` every admin in scope holds a method satisfying the target strength; `fact:` baseline source-reference mappings resolve.
- Observation predicate: Report-only shows no in-scope admin lacking a qualifying method.

#### `s-goal-azure-management-mfa` — Require MFA for Azure Management
- Work type: CA policy · scope_class: admins · effort_kind: portal · actions: create → observe → enforce
- Non-step blockers: `fact:` Azure-management resource target resolves; `fact:` service-account exclusions resolve.
- Observation predicate: Report-only shows no unexpected service-account or automation impact.

#### `s-goal-admin-session` — Shorten Admin Sessions
- Work type: CA policy · scope_class: admins · effort_kind: portal · actions: create → observe → enforce
- Non-step blockers: `fact:` target roles/conditions/session controls resolve.
- Observation predicate: Report-only impact reviewed.

#### `s-goal-admin-portals-protected` — Block the Admin Portals for Non-Admins
- Work type: CA policy · scope_class: all-users · effort_kind: portal · actions: create → observe → enforce
- Non-step blockers: `sourceConflict:admin-portals-target` — README intent vs exported policy target. This is the true create blocker today; do not infer the target.
- Observation predicate: Report-only impact reviewed once the target is resolved.

#### `s-goal-block-auth-transfer` — Block Authentication Transfer
- Work type: CA policy · scope_class: all-users · effort_kind: portal · actions: create → observe → enforce
- Non-step blockers: `evidence:` legitimate authentication-transfer workflows identified.
- Observation predicate: Report-only shows only expected sign-ins affected.

#### `s-goal-block-device-code` — Block Device Code Sign-in
- Work type: CA policy · scope_class: all-users · effort_kind: portal · actions: create → observe → enforce
- Non-step blockers: `evidence:` legitimate device-code workflows identified or remediated.
- Observation predicate: Report-only shows no justified device-code workflow remaining.

#### `s-goal-block-legacy-auth` — Block Legacy Authentication
- Work type: CA policy · scope_class: all-users · effort_kind: portal · actions: create → observe → enforce
- Non-step blockers: `evidence:` legacy-auth-dependent service accounts and mail-sending devices remediated or explicitly excepted.
- Observation predicate: Report-only shows no unremediated legacy-auth dependency.

#### `s-goal-block-unsupported-platforms` — Block Unsupported Device Platforms
- Work type: CA policy · scope_class: devices · effort_kind: portal · actions: create → observe → enforce
- Non-step blockers: `evidence:` observed unsupported-platform sign-ins understood.
- Observation predicate: Report-only impact reviewed. No dependency on device-management completion to create.

### F. Device, registration, session, and access-path controls

#### `s-goal-device-registration-mfa` — Require MFA to Register a Device
- Work type: CA user-action policy · scope_class: devices · effort_kind: portal · actions: create → observe → enforce
- Non-step blockers: `fact:` the Entra device setting "Require Multifactor Authentication to register or join devices" is No when CA owns this action; `fact:` target authentication strength resolves to the tenant object.
- Observation predicate: pilot scope plus human validation; no Observing evidence path. Microsoft's Report-only overview (Appendix C, V9) states policies are evaluated in report-only mode except for items in the User Actions scope, so the register-or-join action yields no Report-only evidence.

#### `s-goal-intune-enrollment-reauth` — Require a Fresh Sign-in for Intune Enrollment
- Work type: CA policy · scope_class: devices · effort_kind: portal · actions: create → observe → enforce
- Non-step blockers: `fact:` Microsoft Intune Enrollment resource exists and resolves.
- Observation predicate: Report-only impact reviewed. No MFA-grant prerequisite; the target uses session reauthentication (previous "MFA grant exists" rule is incorrect).

#### `s-goal-register-info-protected` — Protect Sign-in Method Registration
- Work type: CA user-action policy · scope_class: all-users · effort_kind: portal · actions: create → observe → enforce
- Non-step blockers: `fact:` combined security-information registration enabled; `decision:` policy.target.mode authoring; `fact:` Temporary Access Pass or another bootstrap path for users who cannot yet satisfy the requirement; `sourceConflict:` current package authoring needs correction against Microsoft's current pattern (Register security information, any location excluding trusted, MFA/strength grant).
- Observation predicate: pilot scope plus human validation; no Observing evidence path (Appendix C, V9: User Actions scope is not evaluated in report-only mode).
- Emergency-access relationship: none (V2 — no pinned member in evidence; `memberStableId` is null).

#### `s-goal-require-managed-device` — Require a Managed Device Outside the Office
- Work type: CA + Intune composite · scope_class: all-users · effort_kind: external-platform · actions: create → observe → enforce
- Non-step blockers: `license/platform:` Intune/Entra licensing; `fact:` compliance policies exist and are assigned; `evidence:` at least one device reporting compliant.
- Observation predicate: Report-only shows compliant-device coverage for the population outside the trusted network.
- Emergency-access relationship: `create ← s-prereq-exclusion-group@complete` (V2 — the pinned object 660ab461 excludes the exclusions group; §10.3).

#### `s-goal-mobile-app-protection` — Require App Protection on Phones
- Work type: CA + Intune composite · scope_class: devices · effort_kind: external-platform · actions: create → observe → enforce
- Non-step blockers: `license/platform:` Intune app protection policy exists and is assigned to the users/apps the CA policy requires; `fact:` supported apps/platforms and broker/device-registration requirements met.
- Observation predicate: Report-only shows in-scope mobile sign-ins satisfying the APP requirement.
- Emergency-access relationship: none (V2 — composite package with no pinned member in evidence).

#### `s-goal-all-users-no-persistence` — Limit How Long Sessions Last
- Work type: CA policy pair · scope_class: all-users · effort_kind: portal · actions: create → observe → enforce
- Non-step blockers: `fact:` both policy members have stable semantic identity (the unmanaged member currently lacks a stable baseline ID — a projection problem, not a tenant prerequisite); `fact:` direct user exclusions resolve.
- Observation predicate: Report-only impact reviewed.

#### `s-goal-token-protection` — Require Token Protection on Windows
- Work type: CA session control · scope_class: devices · effort_kind: portal · actions: create → observe → enforce
- Non-step blockers: `fact:` target Windows devices and resources supported for token protection.
- Observation predicate: interactive and non-interactive Report-only evidence shows client compatibility. Evidence, not a duration, is the gate.

#### `s-goal-unmanaged-browser` — Limit Unmanaged Devices in the Browser
- Work type: CA / Defender for Cloud Apps composite · scope_class: all-users · effort_kind: external-platform · actions: create → observe → enforce
- Non-step blockers: `license/platform:` Defender for Cloud Apps plus Entra ID P1 for Conditional Access App Control; `fact:` SharePoint unmanaged-device mode/current configuration resolves; `fact:` paired session-control members and app onboarding exist.
- Observation predicate: Report-only plus MDA session evidence reviewed.
- Rationale: an external-platform family; must not rank Ready merely because ordinary CA prerequisites are met. Emergency-access relationship: `baselineSafetyConflict:unmanaged-browser-emergency-exclusion` on `enforce` (V2 — no pinned object implements this goal, so no emergency exclusion is authored; raised with the baseline author; §10.3).

### G. Location, guest, service-account, and workload controls

#### `s-goal-geo-restriction` — Block Sign-ins From Countries Not Allowed
- Work type: CA policy · scope_class: all-users · effort_kind: portal · actions: create → observe → enforce
- Non-step blockers: `fact:` baseline source-reference mappings resolve.
- Observation predicate: Report-only shows no legitimate sign-ins from blocked locations, or those are covered by partner/travel handling.
- Rationale: Allowed Countries is the hard construction dependency; partner and travel are conditional enforcement dependencies (§10.4).

#### `s-goal-guests-mfa` — Require MFA for Guests
- Work type: CA policy pair · scope_class: guests · effort_kind: portal · actions: create → observe → enforce
- Non-step blockers: `fact:` cross-tenant inbound MFA trust reviewed (changes where guests satisfy MFA); `evidence:` guest populations can satisfy the requirement.
- Observation predicate: Report-only shows guests satisfying the requirement or explicitly excepted.

#### `s-goal-service-accounts-trusted-network` — Restrict Service Accounts to the Trusted Network
- Work type: CA policy · scope_class: service-accounts · effort_kind: portal · actions: create → observe → enforce
- Non-step blockers: `evidence:` confirmed membership and trusted IP ranges match actual workflows.
- Observation predicate: Report-only shows no service-account sign-ins outside the trusted network that are legitimate.
- Rationale: clean two-object construction dependency.

#### `s-goal-workload-identity-block` — Restrict the Entra Connect Sync Account to Its Address
- Work type: identity-type-dependent · scope_class: workload-identity (pending) · effort_kind: portal · actions: create → observe → enforce
- Non-step blockers: `decision:workload-identity-type` — **resolve the target identity type first.** The Entra Connect connector account is a user account holding the Directory Synchronization Accounts role; Cloud Sync uses a service principal. Only a service-principal target is a workload-identity CA policy and only that requires `license/platform:` Workload ID Premium. A user-account target is an ordinary user-scoped location policy. Licensing follows identity resolution, not the reverse. `fact:` sync server egress IP range and its named location exist.
- Observation predicate: Report-only (or, for service principals, the workload-identity Report-only path) shows only the sync identity's expected source.

### H. Identity Protection and privileged activation controls

#### `s-goal-sign-in-risk` — Challenge High-Risk Sign-ins
- Work type: Identity Protection CA · scope_class: all-users · effort_kind: portal · actions: create → observe → enforce
- Non-step blockers: `license/platform:` Entra ID P2; `decision:` first enforcement mode.
- Observation predicate: risk and MFA evidence reviewed in Report-only.

#### `s-goal-sign-in-risk-medium` — Challenge Medium-Risk Sign-ins
- Work type: Identity Protection CA · scope_class: all-users · effort_kind: portal · actions: create → observe → enforce
- Non-step blockers: `license/platform:` Entra ID P2. Coordination with the high-risk policy is a design concern, not a graph edge.
- Observation predicate: as high-risk. V4 resolved: the pinned object (180ab5a3) grants built-in `mfa` with no authentication strength, so no `create ← s-prereq-auth-strength` edge; registration readiness gates enforcement (`enforce ← s-verify-mfa`, §10.5), as for the high-risk pair.

#### `s-goal-user-risk` — Remediate High-Risk Users
- Work type: Identity Protection CA · scope_class: all-users · effort_kind: portal · actions: create → observe → enforce
- Non-step blockers: `license/platform:` Entra ID P2; `fact:` remediation/password-change path appropriate for hybrid users; `evidence:` active risk investigated before broad enablement.
- Observation predicate: Report-only shows the remediation path works for the affected population.

#### `s-goal-user-risk-medium` — Reset Passwords for Medium-Risk Users
- Work type: Identity Protection CA · scope_class: all-users · effort_kind: portal · actions: create → observe → enforce
- Non-step blockers: `license/platform:` Entra ID P2; `fact:` SSPR/password writeback configured if the target requires password change for hybrid users.
- Observation predicate: as user-risk. V4 resolved: the pinned object (7475b373) references the baseline authentication strength (42de22a7), so `create ← s-prereq-auth-strength` is added (§10.5); registration readiness already gates enforcement.

#### `s-goal-pim-activation-reauth` — Require MFA at Every Role Activation
- Work type: CA + PIM composite · scope_class: admins · effort_kind: portal · actions: create → enforce (see note)
- Non-step blockers: `license/platform:` PIM licensed; `fact:` role-management policy IDs resolve; `fact:` authentication context exists.
- Observation predicate: **Report-only is not meaningful here.** The authentication-context policy must be enabled before the context is assigned in PIM role settings; a Report-only policy does not emit the claim. Internal chain: auth strength → authentication context → enabled CA policy → PIM role settings. This is a real technical sequence, not a scheduling preference; the observe action is replaced by pilot-role validation.

### I. Cutover and legacy-state cleanup

#### `s-prereq-security-defaults` — Turn Off Security Defaults
- Work type: cutover · scope_class: all-users · effort_kind: portal · actions: start → complete
- Condition it owns: `sd-enabled`.
- Non-step blockers: `fact:` Security Defaults currently enabled (if not, the step resolves not-applicable).
- Rationale: a coordinated cutover, never a day-one prerequisite. Its start is gated on the four replacement policies reaching ready-to-enforce; every CA policy's enforce is gated on it while Security Defaults is on (V3 resolved: Report-only creation is not restricted by first-party documentation, so the gate stays on enforce).

#### `s-prereq-per-user-mfa` — Finish Moving Off Per-User MFA
- Work type: cutover / legacy cleanup · scope_class: all-users · effort_kind: portal · actions: start → complete
- Non-step blockers: none beyond the graph edge.
- Rationale: Microsoft's order is CA MFA enforced first, then disable per-user MFA. Downstream cutover, not an early prerequisite.

### Runtime-generated Plan rows (not in the 46-package manifest)

#### `cleanup-hardening` — Harden Emergency Access
- Role: conditional cleanup row produced when resilience hardening is deferred from the Emergency Access step · effort_kind: portal
- Closes: `emergency-access.hardening-complete`. Gates nothing (§9.1).

---
## 12. Inverse dependency and unlock index (derived — regenerate from §10; do not hand-edit)

### 12.0 Dependency spine (derived)

```text
Emergency Access @minimum-satisfied
        ↓
Dedicated Exclusions Group ───────────────→ every policy whose pinned object references it
        ↓ (hardening, deferrable)
Harden Emergency Access (runtime row; gates nothing)

Passkey / Auth Method Settings ─→ Registration Campaign ─→ MFA-readiness enforcement gates
Authentication Strength ──────────→ phishing-resistant / risk / registration / device-reg / guest / PIM creates

Trusted Network ─────┬→ Service accounts restricted to trusted network
                     ├→ Managed-device-outside-office
                     ├→ Sign-in-method registration location rule
                     └→ Shared-devices policy

Allowed Countries ───┬→ Geographic block
                     └→ Travel exception workflow ─(conditional)→ Geographic block enforce

Service Accounts Group ─┬→ Service-account trusted-network policy
                        ├→ Azure-management MFA
                        └→ Legacy-auth enforce

Device Management Decision ─┬→ Managed-device policy ─→ Shared-devices completion ─(conditional)→ Managed-device enforce
                            └→ App-protection policy

Replacement CA (MFA all / admin PR-MFA / legacy-auth / Azure mgmt) @ready-to-enforce
        ─(conditional: Security Defaults enabled)→ Turn Off Security Defaults ─→ every CA policy enforce

Require MFA for Everyone @enforced ─→ Disable legacy per-user MFA

Baseline mapping for 62d67e66 (Plan settings) ─→ 14 policy creates whose pinned object excludes it (§10.7)
```

### 12.1 Unlock counts by step

Computed over action nodes, counting distinct downstream steps. **Excludes** the Security Defaults cutover edges, which when `sd-enabled` add the full policy set to `s-prereq-security-defaults` and to its four inputs and would swamp every other number. Regenerated by S0 (2026-09-11) from the frozen §10 (Appendix A cleared) and by A1a (2026-09-12) after the three goals the pinned baseline does not hold left the data (§10.0 `generated`); conditional edges are counted; non-step prerequisites (`sourceConflict`, `decision`, `sourceMapping`, `baselineSafetyConflict`) have no row.

| step | direct unlocks | transitive unlocks | direct dependents |
|---|---|---|---|
| `s-prereq-break-glass` | 3 | 24 | exclusion-group (@minimum-satisfied), cleanup-drill (@minimum-satisfied), cleanup-hardening (@minimum-satisfied) |
| `s-prereq-exclusion-group` | 19 | 21 | 19 policies (18 create, 1 enforce) |
| `s-prereq-passkey-settings` | 4 | 10 | operator-passkey, verify-mfa, admins-phishing-resistant, register-info-protected |
| `s-prereq-auth-strength` | 8 | 8 | admins-phishing-resistant, device-registration-mfa, register-info-protected, guests-mfa, sign-in-risk, user-risk, user-risk-medium, pim-activation-reauth |
| `s-verify-mfa` | 7 | 8 | mfa-all-users, admins-phishing-resistant, register-info-protected, sign-in-risk, sign-in-risk-medium, user-risk, user-risk-medium |
| `s-prereq-trusted-location` | 4 | 5 | shared-devices, register-info-protected, require-managed-device, service-accounts-trusted-network |
| `s-prereq-device-plan` | 1 | 3 | require-managed-device |
| `s-prereq-service-accounts-group` | 2 | 2 | block-legacy-auth, service-accounts-trusted-network |
| `s-prereq-allowed-countries` | 2 | 2 | travel, geo-restriction |
| `s-question-partner` | 2 | 2 | geo-restriction (conditional), guests-mfa (conditional) |
| `s-shared-devices` | 2 | 2 | require-managed-device (conditional), all-users-no-persistence (conditional) |
| `s-goal-require-managed-device` | 1 | 2 | shared-devices (conditional, @created) |
| `s-goal-all-users-no-persistence` | 1 | 2 | shared-devices (conditional, @created) |
| `s-question-mail-devices` | 1 | 1 | block-legacy-auth (conditional) |
| `s-question-travel` | 1 | 1 | geo-restriction (conditional) |
| `s-goal-mfa-all-users` | 1 | 1 | per-user-mfa (@enforced) |
| `s-prereq-security-defaults` | 0 (every CA policy step in §11 E–H when `sd-enabled`) | 0 (same when `sd-enabled`) | every CA policy enforce |
| all other steps | 0 | 0 | — |

Rules applied: counts use the dependency graph over action nodes; direct and transitive are distinguished; only logically applicable edges count; the same downstream step is never counted twice; action/milestone semantics are respected. §13 uses the transitive column **only among steps that are themselves Ready**, so a prerequisite that is not yet Ready is never recommended first. The direct-count column shows why: the Exclusions Group has more direct dependents (20) than Emergency Access (3), but Emergency Access is required first and owns everything the group unlocks. Recommending the group ahead of the accounts is the mistake this rule prevents.

### 12.2 Inverse index

The per-prerequisite "what does this unlock" list is the transpose of §10 and is generated, not maintained by hand. The direct-dependents column above is the human-readable summary.

---

---

## 13. Sorting within Ready

The lane says where work belongs; priority says what appears first. Deterministic; no invented weights.

**First: work with an action available now** (substatus Create, Correct, Needs decision, Ready to enforce), ordered by:

1. actionable decisions and prerequisites that unlock downstream controls (any step with transitive unlocks > 0 and substatus Needs decision or Create/Correct);
2. transitive unlock count, descending (§12.1) — computed only among steps that are themselves Ready;
3. creates and corrections that start useful observation sooner (policy `create`/`correct` before other work of equal unlock value);
4. enforcement actions ready now (`Ready to enforce`);
5. stable step ID.

**Then: started, healthy work** (substatus Observing), ordered by 5. Observing sits below actionable work so that ten observing policies never hide the next thing an admin can actually do.

`scope_class` and `effort_kind` are recorded (§10.0) but not used as sort keys in this version; see §19.

---

## 14. Sorting within Up Next

Up Next prioritises proximity. Healthy queue depth is a sorting concern here, never a reason for On Hold.

1. fewest healthy dependency layers remaining — the minimum number of not-yet-completed steps that must complete before the step's next action becomes executable (transitive, de-duplicated);
2. nearest blocker closest to completion, by the blocker's own substatus ordinal: `Ready to enforce` > `Observing` > `Correct` > `Create` > `Needs decision` > Up Next;
3. transitive downstream unlock value of the step itself, descending;
4. stable step ID.

Each Up Next row carries its nearest unresolved prerequisite as the reason (`After Emergency Access`), which also allows grouping by that prerequisite.

---

## 15. On Hold blocker taxonomy

Every On Hold step names exactly one primary blocker (the first matching in this order when several apply) and may list secondary blockers as readiness tiles (§16).

| blocker kind | user-facing label | typical resolver | group label |
|---|---|---|---|
| `baselineSafetyConflict` | Baseline target is unsafe as authored | baseline author / Baseline mappings | "waiting on baseline correction" |
| `sourceConflict` | Baseline source is ambiguous or contradictory | Baseline mappings / author | "waiting on source resolution" |
| `sourceMapping` | Baseline references an unmapped group or location | Plan settings → Baseline mappings | "waiting on source mapping" |
| `license/platform` (missing) | Required license or capability missing | owner / licensing | "waiting on licensing" |
| `decision` (blocked) | Decision cannot be made yet | resolve the decision's own blocker | "waiting on <decision>" |
| `fact` (unresolved, required) | Required tenant fact not in evidence | scan / owner confirmation | "waiting on tenant evidence" |
| `fact` (missing object no step produces) | Required object does not exist and no plan step creates it | Baseline mappings or manual creation | "waiting on missing object" |
| `step` On Hold | Prerequisite is On Hold | resolve the prerequisite's blocker | "waiting on <prerequisite>" |
| `suspendedPrerequisite` | Prerequisite was deferred | owner un-defers or condition becomes not applicable | "waiting on a deferred step" |
| unsupported safe implementation | IAMAI cannot safely describe the required action | product change | "needs product support" |

Blocker grouping ("4 steps waiting on Emergency Access", "3 steps waiting on source mapping") is presentation over this taxonomy; lane derivation stays deterministic and per-step.

---

## 16. Readiness and implementation presentation implications (record only; not implemented)

### 16.1 One prerequisite presentation
Unresolved prerequisites of the opened step's next action are shown once, in the step's Readiness area, as tiles: up to four across, wrapping as needed; each tile expandable for explanation and evidence; each linking to the prerequisite step or resolver where one exists. As prerequisites resolve, their tiles leave the unresolved view; when all are satisfied, Readiness collapses to a compact success treatment, with satisfied evidence still expandable rather than deleted. The same blockers are never duplicated across Readiness, Needs attention, Fix before continuing, Planned work, or any second prerequisite list.

### 16.2 State selects implementation instructions
State determines which implementation instructions are relevant; it does not hide useful instructions merely because the object does not exist yet.

| state | show |
|---|---|
| Missing | how to create it |
| Partial / drift | how to correct it |
| Report-only / Observing | observation and validation guidance |
| Ready to enforce | the enforcement action |
| On Hold | planning instructions may remain visible; no falsely executable Copy |

An unavailable channel whose only output is an error ("JSON could not be projected safely") is not implementation content and is not presented as such.

---

## 17. Worked lane examples

Each example gives next action · applicable blockers · started? · lane · substatus/reason · why. Steps and edges are real; tenant states are hypothetical.

**1. Prerequisite Ready, dependent not started.** `s-prereq-allowed-countries` object absent, decision inputs present → its next action `start` executable → `Ready · Create`. `s-goal-geo-restriction`: next action `create` ← allowed-countries@complete unsatisfied; no blockers; not started → **Up Next · After Allowed Countries**. Healthy chain, one layer.

**2. Prerequisite Observing, dependent not started.** `s-goal-mfa-all-users` exists in Report-only, exclusions group complete, evidence maturing → **Ready · Observing**. `s-prereq-per-user-mfa`: next action `start` ← mfa-all-users@enforced; not started; chain healthy → **Up Next · After Require MFA for Everyone**.

**3. Prerequisite Up Next several layers away.** No emergency accounts exist → `s-prereq-break-glass` **Ready · Create**. `s-prereq-exclusion-group` ← break-glass@minimum → **Up Next · After Emergency Access** (1 layer). `s-goal-token-protection`: `create` ← exclusion-group@complete → **Up Next · After Exclusions Group**, sorted below the group (2 layers). Not On Hold; depth is ordering.

**4. Prerequisite On Hold.** `s-prereq-service-accounts-group` cannot be completed because the "which identities are service accounts" decision lacks inventory evidence → decision blocked → group **On Hold · waiting on tenant evidence**. `s-goal-azure-management-mfa`: `create` ← group@complete; the group is On Hold → **On Hold · Prerequisite is On Hold (Service Accounts Group)**.

**5. Prerequisite Deferred.** Owner defers `s-question-travel`; scan evidence says `travel-exceptions-allowed` is applicable. `s-goal-geo-restriction` exists in Report-only (started). Step 3 runs before started-check: applicable hard edge to a Deferred prerequisite → **On Hold · Prerequisite was deferred (Travel)**. Started work leaves Ready only for an abnormal blocker; this is one.

**6. Conditional prerequisite not applicable.** `s-question-mail-devices` answered "no devices on an incompatible path" → condition not applicable → the step reaches its terminal outcome → **Completed**. `s-goal-block-legacy-auth:enforce ← mail-devices [mail-devices-incompatible-path]` is satisfied and disappears from Readiness.

**7. Actionable owner decision.** `s-prereq-device-plan` inputs present → **Ready · Needs decision**. `s-goal-require-managed-device`: `create` ← device-plan@complete, trusted-location@complete (complete); not started → **Up Next · After Device Management Decision**.

**8. Blocked owner decision.** `s-goal-workload-identity-block`: `create` ← decision:workload-identity-type; the sync identity's type is not in scan evidence → decision blocked → **On Hold · Decision cannot be made yet (identity type)**. Licensing is not evaluated until the identity type resolves.

**9. Policy already Report-only and healthy.** `s-goal-block-device-code` exists in Report-only matching the pinned object; exclusions group complete; evidence predicate open → started, no blocker → **Ready · Observing**.

**10. Report-only policy with an abnormal new blocker.** `s-goal-block-legacy-auth` in Report-only; a scan now shows mail devices on an incompatible path (condition applicable) and `s-question-mail-devices` is Deferred → **On Hold · Prerequisite was deferred (Mail devices)**. It does not return to Up Next.

**11. Existing object with correctable drift.** `s-prereq-trusted-location` exists but its IP ranges differ from the pinned target → started (existing configuration counts) → next action `correct` executable → **Ready · Correct**.

**12. Completed prerequisite.** `s-prereq-exclusion-group` complete and correct. `s-goal-intune-enrollment-reauth`: `create` ← exclusion-group@complete satisfied; Intune Enrollment resource resolves; not started → **Ready · Create**.

**13. Baseline/source safety conflict.** Appendix A V2 finds the pinned `s-goal-require-managed-device` object does not exclude emergency identities → `baselineSafetyConflict` recorded on `enforce`. While the next action is `create`/`observe` the conflict is not on that action → **Ready · Create**, then **Ready · Observing**. Once the evidence predicate is satisfied the next action becomes `enforce`, which carries the conflict → **On Hold · Baseline target is unsafe as authored**. IAMAI never patches the exclusion in on its own.

**14. Unresolved source-group mapping.** A pinned policy references source group `62d67e66` in its exclusions. Its `create` requires that reference to construct the canonical object → `sourceMapping` blocker → **On Hold · Baseline references an unmapped group**, resolver Plan settings → Baseline mappings. The same reference used only as an include would block the same action; the tile states the role (include / exclude / both).

**15. Multiple prerequisites with mixed states.** `s-goal-sign-in-risk`: `create` ← auth-strength@complete (Completed); `enforce` ← exclusion-group@complete (Ready · Create), verify-mfa@complete (Ready, in progress); `license/platform:` P2 present. Not started; next action `create`; all `create` gates satisfied → **Ready · Create**. The enforce-side prerequisites appear as readiness tiles but do not affect the current lane. If P2 were absent → **On Hold · Required license missing**.

---

## 18. Known source conflicts and unresolved decisions

### 18.1 Source reference handling
Unresolved source group and named-location references in pinned policies are modelled as `sourceMapping` blockers on the specific actions that need them, resolved through Plan settings → Baseline mappings. The visible "Decide What the Baseline's Unidentified Groups Stand For" row and any "Group 1 … Group N" labelling are not the user's operational roadmap in the future model. For each reference the record must state: reference ID, affected policies, role (include / exclude / both), and current status. Current references (from `pinned-refs.tsv` and `interpretation.json`, S0 2026-09-11):
- `62d67e66` — group, `decisionRequired`, role **exclude** everywhere, included by no policy. Affected primary steps (14, all `create`): `s-goal-mfa-all-users` (a66e8427), `s-goal-admins-phishing-resistant` (f893f39f), `s-goal-admin-portals-protected` (fafaa50c), `s-goal-admin-session` (04b969aa), `s-goal-block-auth-transfer` (fa005ec2), `s-goal-block-device-code` (8b42eda3), `s-goal-block-legacy-auth` (9eab445f), `s-goal-block-unsupported-platforms` (9e21fa64), `s-goal-geo-restriction` (f3f4ad30), `s-goal-service-accounts-trusted-network` (99eabebd), `s-goal-all-users-no-persistence` (ea9459a9), `s-goal-require-managed-device` (660ab461), `s-goal-device-registration-mfa` (aeb49474), `s-goal-token-protection` (8bb25c6a). Also excluded by 9 pinned policies that implement no goal (1f960ec9, 1d3a7677, 9bc2ad69, b13dd393, 30a1edce, a53c4c2b, 1eaf943a, 2dd84b12, 8417ec17), which are Cleanup material and get no row. Status: unresolved; rows in §10.7.
- `1267ac22` — named location ("IAC - Blocked Countries"), `decisionRequired`, role **include** in one policy only, `IAC - GLOBAL – BLOCK – Countries not Allowed - NoExclusions` (1eaf943a), which implements no goal. Affected primary steps: none. Status: unresolved; no `sourceMapping` row.
- Other `decisionRequired` references exist in `interpretation.json` (`e663a7ce`, `9ee031a3`, `902993ed`, `5628ad67`, `2d25c298`, `cc7f9bb7`, `8d0564e5`, `1178bb5d`, `5f96c57d`, `0de51b52`); V11 names only the two above, so they are recorded in BLOCKED.md as deferred rather than mapped here.

### 18.2 Unresolved product/source decisions (do not silently resolve)
- **Admin Portals** — README intent vs exported policy target: `sourceConflict:admin-portals-target` on `create`.
- **Protect Sign-in Method Registration** — final target semantics and `policy.target.mode` authoring: `sourceConflict` on `create`; observation is pilot scope plus human validation (V9 resolved).
- **`name.canonical` policy** — unresolved naming rule; affects projection/identity, not tenant dependencies; recorded as open.
- **Email audience authoring** — unresolved; recorded as open; no dependency edge inferred.
- **Workload identity** — identity type: `decision:workload-identity-type`.
- **Session Lifetime** — unmanaged member lacks a stable baseline ID; projection problem, not a tenant prerequisite.
- **Unmanaged Browser** — Defender for Cloud Apps / SharePoint external prerequisites.
- **Security Defaults** — Report-only behaviour while enabled: V3 resolved as permitted (no first-party sentence forbids creating a Report-only policy while Security Defaults is enabled; Microsoft requires disabling Security Defaults to implement replacement policies). The `sd-enabled` gate stays on `enforce`.
- **Registration campaign method (owner, V7)** — the pinned baseline's campaign is Authenticator-only; IAMAI's product choice is that the registration campaign is always passkey (phishing-resistant) targeted. This is a known, deliberate product deviation from the baseline for `s-verify-mfa` only; it changes no pinned policy object. Consequence: `s-verify-mfa:start ← s-prereq-passkey-settings@complete` is hard.
- **SMTP AUTH Basic** — Microsoft refined the retirement timeline in January 2026 (unchanged through December 2026; disabled by default for existing tenants at end of December 2026; unavailable for new tenants after; final removal date to be announced in the second half of 2027). The mail-devices condition is semantic and embeds no date.

### 18.3 Non-edges — work IAMAI must not serialise
- Dormant-account review and separate-admin hygiene gate no CA policy creation.
- Registration readiness gates enforcement of MFA/strength policies, never their Report-only creation.
- Emergency-access exclusions gate **enforced** restrictive CA; Report-only cannot lock anyone out. Construction may still require the exclusions group as an object (§1.3).
- Mail-device, partner, travel, and shared-device handling gate only the policies whose scope needs them, only when applicable.
- Emergency Access hardening gates nothing.
- A phase number or forecast date is never a dependency.

---

## 19. Deferred future sophistication (not in scope now)

- Weighting inside Ready by impact/population (runtime affected population), safety importance, and effort, once an authoritative source for those exists. `scope_class` and `effort_kind` are recorded in §10.0 for that purpose and are unused today.
- "Do X first — unlocks N controls" presentation driven by §12.1, restricted to steps that are Ready.
- Blocker-grouped Up Next and On Hold views with counts (§15).
- Timeline/phase as a descriptive projection with forecast dates derived from the graph and cadence; never as permission.
- Suggested date per Ready step; an admin may act earlier whenever prerequisites are satisfied.
- Evidence-predicate library per control type, replacing per-step prose predicates.

---

## 20. Implementation invariants

1. Lanes are computed from the edge table and typed blockers; never stored, never hand-set (except Deferred, which is owner intent).
2. Completed is re-derived every scan.
3. Started work never regresses to Up Next.
4. A step is On Hold only with a named blocker from §15.
5. Healthy dependency depth is never On Hold.
6. An unresolved condition is never silently satisfied.
7. A Deferred applicable hard prerequisite always propagates On Hold.
8. Start-work and enforcement gates are distinct on every policy; the construction rule decides start-work.
9. `emergency-access.hardening-complete` gates nothing generic.
10. Transitive reduction preserves gated action, milestone, and condition (§9.3).
11. Unlock-based recommendations consider only Ready steps.
12. Work type never determines lane.
13. No source ambiguity is discarded; it is carried as a typed blocker on the affected action.
14. The visible step set is unchanged (46 + runtime rows); actions and milestones are internal.
15. Nothing in §10 changes without a source, and V-tagged rows do not drive product behaviour until cleared.

---

## Appendix A. Verification queue — must clear before the edge table is frozen

Verify against the current pinned target (`pinned.json`) and current first-party Microsoft documentation. Apply only the listed outcomes.

| id | check | allowed outcomes |
|---|---|---|
| **V1** | For each of the 14 policies whose exclusions-group edge is on `enforce`: does the pinned object reference the exclusions group? | References it → move the edge to `create` (construction rule). Does not → leave on `enforce`. |
| **V2** | Emergency-access relationship for `require-managed-device`, `unmanaged-browser`, `register-info-protected`, `mobile-app-protection`. | First two: pinned object excludes emergency identities → add `create ← s-prereq-exclusion-group@complete`; it does not → record `baselineSafetyConflict` on `enforce` and raise with the baseline author. "No relationship" is not permitted for these two. Last two: any of the three outcomes, including none. |
| **V3** | Does Entra permit creating a CA policy in Report-only while Security Defaults is enabled? Portal wording says Security Defaults must be disabled before *enabling* a policy; no first-party sentence found for Report-only creation. | Permitted → keep the `sd-enabled` gate on `enforce`. Not permitted → move it to `create`. |
| **V4** | `sign-in-risk-medium`, `user-risk-medium`: do the pinned objects use the baseline authentication strength (→ `create ← auth-strength`)? Does registration readiness gate sign-in-risk-medium enforcement as it does the high-risk pair? | Add or confirm absence per object. |
| **V5** | Which admin-scoped policies need partner/MSP carve-outs. | Add conditional `enforce ← s-question-partner [partner-accounts-exist]` where the pinned scope reaches partner identities; otherwise none. |
| **V6** | Does the pinned baseline carry a meaningful stable ordering? | Populate `baseline_order` either way; if alphabetical/export artefact, note in §13 that it is a tie-break only. |
| **V7** | Is the baseline's registration campaign passkey-targeted? | Yes → `s-verify-mfa:start ← passkey-settings` becomes hard. Authenticator-only → conditional as written. |
| **V8** | Which people policies `s-shared-devices` patches on completion. | Confirm `require-managed-device` and `session-lifetime`; add/remove `@created` rows. |
| **V9** | Report-only evaluation for user-action scope (`device-registration-mfa`, `register-info-protected`). Microsoft's Report-only overview says user-action items are not evaluated; v1 claimed support for register-or-join. | Supported → normal predicate. Not supported → predicate is pilot scope plus human validation; no Observing evidence path. |
| **V10** | `workload-identity-block` semantics after identity-type resolution. | Service principal → workload-identity CA, Workload ID Premium stays. User account → user-scoped location policy, drop Workload ID Premium, keep named-location fact. |
| **V11** | Affected-policy map for each unresolved source reference (`62d67e66`, `1267ac22`) and the role each plays (include / exclude / both). | Populate §18.1 and add `sourceMapping` rows to §10 for each affected `create` (or `correct`). |

Findings (S0, 2026-09-11, against `pinned-refs.tsv` at pin 90d9b890 and `docs/implementation-content/LIBRARY.json`):

- **V1** — cleared. 12 of the 14 pinned objects exclude the exclusions group (b63c3682), so their edge moved to `create`: admins-phishing-resistant, admin-session, admin-portals-protected, block-auth-transfer, block-device-code, block-legacy-auth, block-unsupported-platforms, geo-restriction, sign-in-risk, sign-in-risk-medium, user-risk-medium, pim-activation-reauth. Left on `enforce`: `s-goal-user-risk` (544cd9ef excludes only 5628ad67 and 8d0564e5, not the exclusions group) and `s-goal-azure-management-mfa` (no pinned object implements the goal; `goalMap` has no entry and the package declares no member).
- **V2** — cleared. require-managed-device: 660ab461 excludes the exclusions group → `create ← s-prereq-exclusion-group@complete`. unmanaged-browser: no pinned object → `baselineSafetyConflict:unmanaged-browser-emergency-exclusion` on `enforce`, raised with the author. register-info-protected and mobile-app-protection: no pinned member in evidence → none.
- **V3** — cleared, permitted. Neither page (Appendix C) contains a sentence restricting the creation of a Report-only policy while Security Defaults is enabled; the Security Defaults page requires disabling it to implement replacement policies. Gate stays on `enforce`.
- **V4** — cleared. sign-in-risk-medium (180ab5a3): built-in `mfa`, no authentication strength → no strength edge; `enforce ← s-verify-mfa` added (the manifest binds `evidence.mfaReadiness`). user-risk-medium (7475b373): references strength 42de22a7 → `create ← s-prereq-auth-strength` added; the manifest notes its v1.0 authoring pairs `passwordChange` with built-in `mfa` and does not reproduce the strength (flagged for library review), but the pinned object wins.
- **V5** — cleared, none added. The manifest binds partner decisions only to `s-goal-geo-restriction` and `s-goal-guests-mfa`, both already edged; the pinned guests member (f25f94e0) includes `serviceProvider`. No admin-scoped pinned object reaches partner identities: admins-phishing-resistant and admin-session are role-scoped, admin-portals (fafaa50c) already excludes `serviceProvider`, pim (a6b3b754) and azure-management have no partner scope.
- **V6** — applied per owner answer: `baseline_order` removed from §10.0, §13, §14; empty `iamai_order` added to §10.0.
- **V7** — applied per owner answer: edge hard, source owner; deviation recorded in §18.2.
- **V8** — confirmed as written. The package's `peoplePolicies.resolvedPatches` binding patches every plan policy that prompts a person (runtime-derived, `promptsPeople`), of which require-managed-device and session-lifetime are the baseline-known pair; the two `@created` rows stand. Generalising to the full runtime set is deferred (BLOCKED.md, Choices).
- **V9** — cleared, not supported. Predicate for device-registration-mfa and register-info-protected is pilot scope plus human validation; no Observing evidence path.
- **V10** — cleared. The pinned object targets a service principal (`clientApplications.includeServicePrincipals`, users None) and the package resolves one Cloud Sync provisioning service principal, so the service-principal branch applies: workload-identity CA, Workload ID Premium stays. `decision:workload-identity-type` remains on `create` because the tenant may run a Connect connector account instead (Appendix C).
- **V11** — cleared. Map in §18.1; 14 `sourceMapping:62d67e66` rows in §10.7; `1267ac22` affects no primary step.

---

## Appendix B. Edge changes since v1 (with reasons)

- **Removed: 18 direct `s-prereq-break-glass` enforcement edges on policy steps.** Each is implied by `s-prereq-exclusion-group:start ← s-prereq-break-glass@minimum-satisfied` plus the policy's own exclusions-group edge, under the §9.3 invariant. Also removes the v1 inconsistency where four steps carried both edges and `s-goal-all-users-no-persistence` carried neither.
- **Removed: `s-prereq-auth-strength:enforce ← s-prereq-passkey-settings`.** A strength object has no enforce state; method readiness is gated on the consuming policies (`admins-phishing-resistant`, `register-info-protected`).
- **Added: Security Defaults cutover edges both directions, conditional on `sd-enabled`.** v1 showed the relationship in the spine but encoded no edges.
- **Added: `s-goal-block-legacy-auth:enforce ← s-question-mail-devices [mail-devices-incompatible-path]`, `s-goal-geo-restriction:enforce ← s-question-partner [partner-accounts-exist]`, `s-goal-geo-restriction:enforce ← s-question-travel [travel-exceptions-allowed]`.** v1 carried these only in prose.
- **Added (V8): `s-shared-devices:complete ← s-goal-require-managed-device@created`, `← s-goal-all-users-no-persistence@created` [shared-devices-exist].** v1 stated the object-existence dependency in prose; it is why start and complete are separate nodes.
- **Made conditional (V7): `s-verify-mfa:start ← s-prereq-passkey-settings [campaign-targets-passkey]`.** v1 hard; an Authenticator-only campaign does not need passkey settings. Returned to hard by S0 on the owner's answer (campaign always passkey-targeted, §18.2).
- **Flagged (V1): 14 exclusions-group `enforce` edges** may move to `create` under the construction rule. Resolved by S0: 12 moved, 2 stay (Appendix A findings).
- **Held (V2): emergency-access relationships** for four high-lockout controls, with the two-outcome rule. Resolved by S0 (Appendix A findings).
- **Reclassified: `runtime-source-reference-decision`** from a gating runtime row to per-policy `sourceMapping` blockers (rows in §10.7, V11).
- **Superseded rule (v2 → v3):** "a prerequisite that is itself Up Next makes the dependent On Hold" is withdrawn. Healthy depth is Up Next ordering (§14).
- **Superseded lanes (v2 → v3):** the six-lane model (Ready / Observing / Up Next / On Hold / Suspended / Implemented) is replaced by three primary lanes with Observing as a Ready substatus, Completed and Deferred as secondary views.

---

## Appendix C. Source basis and technical anchors

Assembled from the IAMAI implementation-content library manifest and required binding families, current Plan/audit findings, and first-party Microsoft documentation. Verify currency at implementation time.

- Manage emergency access admin accounts — exclusion from enforced restrictive CA; Report-only does not block access.
- Plan your Conditional Access deployment / templates — create and test in Report-only before enabling; template policies default to Report-only.
- What is Conditional Access report-only mode — evaluates most policies but not items in the User Actions scope (V9). Fetched 2026-09-11: https://learn.microsoft.com/entra/identity/conditional-access/concept-conditional-access-report-only (page updated 2026-06-01): "Administrators can evaluate Conditional Access policies in report-only mode, except for items included in the 'User Actions' scope." The page contains no sentence about Security Defaults (V3).
- Require MFA for device registration — register-or-join user action; legacy device-registration MFA toggle set to No when CA owns the control.
- Control security information registration with Conditional Access — Register security information action, trusted-location exclusion, authentication strength, Temporary Access Pass bootstrap.
- Registration campaign for passkeys / Microsoft Authenticator — targeted method must be enabled; passkey self-service setup for passkey campaigns.
- Require compliant devices with Intune — compliance policies must exist and devices report before a compliant-device requirement works.
- Require approved client apps or app protection policy — Intune APP, licensing, supported apps/platforms, broker/device registration.
- Token Protection deployment — supported devices/apps/resources; Report-only compatibility observation.
- Microsoft Entra ID Protection risk-based policies — Entra ID P2; remediation/MFA prerequisites.
- Configure Microsoft Entra role settings in PIM — authentication-context CA policy must exist and be enabled before assignment.
- Conditional Access for workload identities — single-tenant service principals; Workload ID Premium. Microsoft Entra Connect accounts and permissions — connector account is a user with the Directory Synchronization Accounts role.
- Security defaults — enabled Security Defaults and enabled CA policies cannot coexist; disable Security Defaults when migrating to replacement CA. Fetched 2026-09-11: https://learn.microsoft.com/entra/fundamentals/security-defaults (page updated 2026-07-01): "Organizations that choose to implement Conditional Access policies that replace security defaults must disable security defaults." and "After administrators disable security defaults, organizations should immediately enable Conditional Access policies to protect their organization." No sentence addresses creating a Report-only policy while Security Defaults is enabled (V3: permitted; gate stays on `enforce`).
- Turn off per-user MFA — require MFA with Conditional Access first, then disable per-user MFA.
- Block access by location — named location must exist before a location policy can reference it.
- Authentication strength for external users — cross-tenant MFA trust affects how guests satisfy a strength requirement.
- Updated Exchange Online SMTP AUTH Basic Authentication Deprecation Timeline (Exchange Team, January 2026).

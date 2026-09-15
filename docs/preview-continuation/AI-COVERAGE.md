# AI Info coverage

This maps where AI Info comes from at runtime, which paths the sample tenants exercise, and which registered states no sample reaches. It is representative testing, not exhaustive semantic verification of every package state.

## One grounding mechanism

Every AI Info the Plan draws comes from `src/ui/surfaces/stepBody.ts`:

| Path | Chosen when | AI Info text |
|---|---|---|
| **Package** | `implementationPackageFor(step)` returns an active package | The package's AI block for its state (`project.ts`), then **IAMAI FACTS FOR THIS STEP** (`aiGrounding.ts`) |
| **Planning preview** | The package authors the work but it cannot run yet | The same package block with readable stand-ins, then the same facts |
| **Engine fallback** | No active package; for example a package set aside by the semantic re-pin review | The facts alone (`aiGroundingText`), built on the same `stepContext` the prompt pack uses |

**The facts section contains:**
- the step's context: why it matters, where it stands, who it reaches, what to do, what holds it, dates and windows, Done when, and rollback;
- the scan's findings;
- tracked policies and existing tenant policies;
- for policy steps, the current tenant policy (name, id, state), the fields that differ, the exclusions a correction removes, and the intended target, from the package bindings IAMAI holds;
- the people and accounts the step names, under the step's own words, with ids where the step holds them.

**Rules the facts follow:**
- A line the package already says is not repeated.
- A fact IAMAI does not hold is left out.
- A package AI block with no words of its own stays empty, so the facts never create a channel.

**Aliases:** content aliases (`src/content/stepTitle.ts`) decide which content entry a plan step reads. Examples: `all-users-no-persistence` → `session-lifetime`; `byod-session-controls` and `block-downloads-unmanaged` → `unmanaged-browser`. Package ids resolve through `implementationPackageFor`.

**Copy and export:**
- The AI Info Copy control copies the drawn artifact text, so copied and on-screen AI Info are identical.
- The prompt pack's step block is `stepContext`. The AI Info facts contain every line of it (`aiGrounding.test.ts`).
- The Export page has no per-step AI Info artifact, so nothing else needs to share it.

## Exercised across the seven sample tenants

The seven tenants are `demo`, `demo-week2`, `small`, `mid`, `large`, `messy` and `midflight`: 183 step views.

In the tables below:
- **facts** means AI Info was drawn and carries the facts section.
- **unavailable** means the Plan draws no AI Info in that state, which is unchanged by this batch. It happens for in-place, some blocked and decision states, and steps whose current action is not implementation.
- **own-only** (drawn without facts) was counted at 0.

| Package | States reached (AI Info) | AI states registered but not reached |
|---|---|---|
| s-check-dormant-accounts | missing (facts) | needsDecision, disableConfirmed, keepConfirmed, verificationRequired, blocked |
| s-check-separate-admin-accounts | missing (facts) | actionRequired, credentialProofRequired, roleCutoverRequired, verificationRequired, blocked |
| s-goal-admin-session | blocked, missing (facts) | partial, reportOnly, readyToEnforce, needsDecision, sourceConflict, notLicensed |
| s-goal-admins-phishing-resistant | missing (facts); blocked, inPlace (unavailable) | partial, reportOnly, readyToEnforce, needsDecision, sourceConflict, notLicensed |
| s-goal-block-auth-transfer | missing (facts); blocked (facts or unavailable) | partial, reportOnly, readyToEnforce, needsDecision, sourceConflict, notLicensed |
| s-goal-block-device-code | blocked, missing (facts); inPlace (unavailable) | partial, reportOnly, readyToEnforce, needsDecision, sourceConflict, notLicensed |
| s-goal-block-legacy-auth | blocked (facts); inPlace (unavailable) | missing, partial, reportOnly, readyToEnforce, needsDecision, sourceConflict, notLicensed |
| s-goal-block-unsupported-platforms | blocked, missing (facts) | partial, reportOnly, readyToEnforce, needsDecision, sourceConflict, notLicensed |
| s-goal-device-registration-mfa | blocked, missing (facts) | partial, reportOnly, readyToEnforce |
| s-goal-geo-restriction | blocked (facts) | missing, partial, reportOnly, readyToEnforce, needsDecision, sourceConflict, notLicensed |
| s-goal-guests-mfa | blocked (facts); inPlace (unavailable) | missing, partial, partnerTrustRequired, reportOnly, readyToEnforce, needsDecision, sourceConflict, notLicensed |
| s-goal-intune-enrollment-reauth | missing, blocked (facts) | resourceMissing, partial, reportOnly, readyToEnforce |
| s-goal-mfa-all-users | blocked (facts); inPlace (unavailable) | missing, partial, reportOnly, readyToEnforce, needsDecision, sourceConflict, notLicensed |
| s-goal-pim-activation-reauth | missing (facts) | contextMissing, partial, reportOnly, readyToEnforce, pimSettingsPending, verificationPending |
| s-goal-register-info-protected | missing, blocked (facts) | partial, reportOnly, readyToEnforce, needsDecision, sourceConflict, notLicensed |
| s-goal-require-managed-device | blocked (facts or unavailable) | missing, partial, reportOnly, readyToEnforce, needsDecision, sourceConflict, notLicensed |
| s-goal-service-accounts-trusted-network | blocked (facts) | prerequisiteRequired, missing, partial, reportOnly, readyToEnforce |
| s-goal-session-lifetime | blocked, missing (facts) | partial, reportOnly, readyToEnforce |
| s-goal-sign-in-risk | missing (facts) | partial, reportOnly, readyToEnforce |
| s-goal-sign-in-risk-medium | missing (facts) | partial, reportOnly, readyToEnforce |
| s-goal-token-protection | blocked, missing (facts) | partial, reportOnly, readyToEnforce |
| s-goal-user-risk | missing (facts) | prerequisiteRequired, partial, reportOnly, readyToEnforce |
| s-goal-user-risk-medium | missing (facts) | prerequisiteRequired, partial, reportOnly, readyToEnforce |
| s-ladder-operator-passkey | missing (unavailable) | register, verificationRequired, blocked |
| s-prereq-allowed-countries | missing (facts) | needsDecision, verificationRequired, blocked |
| s-prereq-break-glass | missing (facts); inPlace (unavailable) | needsDecision, verificationRequired, blocked |
| s-prereq-device-plan | needsDecision (unavailable) | decided, blocked, inPlace |
| s-prereq-exclusion-group | missing (facts); inPlace (unavailable) | needsDecision, groupMissing, verificationRequired, blocked |
| s-prereq-passkey-settings | missing (facts) | needsDecision, missingOrPartial, verificationRequired, blocked |
| s-prereq-per-user-mfa | missing (unavailable) | blocked, migrationRequired, readyToDisablePerUser, verificationRequired |
| s-prereq-security-defaults | missing (unavailable) | blocked, readyToDisable, verificationRequired |
| s-prereq-service-accounts-group | missing (facts) | needsDecision, notApplicable, groupMissing, verificationRequired, blocked |
| s-prereq-trusted-location | inPlace (unavailable) | needsDecision, notApplicable, missing, verificationRequired, blocked |
| s-shared-devices | missing (facts) | needsDecision, partial, reportOnly, readyToEnforce, blocked |
| s-verify-mfa | missing (facts) | setupRequired, campaignRunning, holdoutReview, ready, blocked |

**Registered packages no sample plan reaches (9):**
- s-goal-admin-portals-protected (its step runs on the engine fallback: the package is set aside by review)
- s-goal-azure-management-mfa
- s-goal-mobile-app-protection
- s-goal-unmanaged-browser
- s-goal-workload-identity-block
- s-prereq-auth-strength
- s-question-mail-devices
- s-question-partner
- s-question-travel

**Engine fallback in the samples:**
- `s-goal-admin-portals-protected` and `s-blocker-allowed-countries`.
- Blocked states draw facts, or no AI Info where the step's current action is not implementation.
- Ready states draw none.

## Tested contrasts (`aiGrounding.test.ts`)

| Case | State | What is asserted |
|---|---|---|
| Dormant Accounts, `demo` (3 accounts) vs `messy` (14) | missing | Every account's name, last sign-in and id is in the briefing. The two tenants' lists differ. No policy target on a check. |
| Block Legacy Authentication, `demo` | blocked (enforced policy owed a correction) | Current policy name and id, state Enforced, the differing field, the exclusion the correction removes, the blocker and no Ready wording. No line of the package's own words is repeated. |
| Intune enrollment, `demo-week2` | report-only observation, held | The window's dates, the evidence so far, Report-only state, resolved exclusions ("none" for accounts), and no invented findings. |
| Trusted location, `demo` | in place | No AI Info is drawn, so nothing is presented as a briefing. |
| Dormant Accounts and Intune enrollment | missing, observation | Every prompt-pack step line is carried, and a second opening draws identical text. |

**Separately (`resolvedEmptyExclusions.test.ts`, projection level):**
- Session lifetime's exclusions are tested as resolved empty, resolved non-empty and unresolved.
- In the raw sample plans above, the session step holds on an unmapped baseline reference.
- The curated content-matrix variants (`demo+curated`, `demo-week2+curated`, `demo-week2+curated+ready`) do reach a settled target with a resolved empty list. There the create moved from a preview held on `policy.target.excludeUsers` to executable, with all four channels (`../logs/fg/k-matrix-1.diff`).
- The rendered scripts for empty and non-empty sets parse under PowerShell 7 and 5.1.

## Genuinely unexercised
- **Partial, report-only and ready-to-enforce AI Info:** no sample reaches these for most policy packages. The grounding code path is shared, but those package blocks' own words were not read against a live-shaped plan in this batch.
- **The nine unreached packages above,** and the question and ladder packages' decision states.

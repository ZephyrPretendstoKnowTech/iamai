# Require MFA at Every Role Activation

## Goal
Require the baseline's strong authentication at privileged-role activation through a dedicated authentication context, a Conditional Access policy with sign-in frequency **Every time**, and PIM role settings that invoke that context.

## Why this exists
An already-authenticated but hijacked session should not be able to activate an eligible privileged role without satisfying a fresh, stronger authentication requirement. The control is composite: the authentication context names the protected action, Conditional Access defines what must be satisfied, and PIM invokes that context during activation.

## Applies when
Use this step when IAMAI has eligible PIM role scope to configure, the required PIM/Conditional Access licensing is available, and IAMAI has resolved the authentication context, target authentication strength, exclusions, CA policy identity/state, and role-management-policy IDs needed for the current state.

## Do not show implementation when
Do not render actionable implementation for `inPlace`, `blocked`, `needsDecision`, `sourceConflict`, or `notLicensed`. Do not update PIM role settings until the authentication-context Conditional Access policy is canonical **and enabled**. Do not update a CA policy or PIM role policy by display name.

## Prerequisites
- Microsoft Entra PIM licensing and Conditional Access licensing for the affected users/workload are available.
- IAMAI has resolved the dedicated authentication-context ID/name.
- IAMAI has resolved the tenant authentication strength that corresponds to the retained baseline requirement; source-tenant strength IDs are not portable.
- Emergency/global exclusion handling is resolved.
- IAMAI has the stable tenant CA policy ID for update states.
- IAMAI has the stable role-management-policy IDs for the PIM roles that require this setting.

## Owner decisions
No new owner decision is introduced. The current baseline pin `8461e0f2fd10167bf034e7c20ed8ea293827d890` remains authoritative. Its PIM CA member is stable ID `a6b3b754-9079-48f0-abb2-9e79b2f41095`, targets authentication context `c1`, uses the baseline's tenant-resolved authentication-strength placeholder, and sets sign-in frequency to Every time.

## Current-state inputs
IAMAI may use eligible roles/holders, current PIM role settings, authentication-context state/ID, current CA policy, canonical exclusions, resolved authentication strength, activation evidence, and blockers already available to the product. Unknown activation evidence remains Unknown.

## Target state
1. **Authentication context:** the IAMAI-resolved context ID exists, has the intended display name/description, and is published (`isAvailable = true`).
2. **Conditional Access:** All users with canonical exclusions; Target resources = the dedicated authentication context; Client apps = All; no unrelated risk/location/platform/device/authentication-flow condition; Grant = the resolved baseline authentication strength; Session sign-in frequency = Every time with primary and secondary authentication; lifecycle is Report-only during validation and then On.
3. **PIM role settings:** each IAMAI-selected role-management policy has `AuthenticationContext_EndUser_Assignment` enabled with `claimValue` equal to the dedicated authentication-context ID.

Microsoft's current PIM guidance requires the matching CA policy to be created **and enabled before** PIM is configured to require that context. This package therefore stages CA enablement before the PIM role-setting mutation.

## Security-significant fields
Authentication-context ID/publication state; CA users/exclusions, authentication-context target, client-app scope, authentication strength, any other conditions/grants/session controls, lifecycle; the exact PIM role-management-policy IDs; authentication-context rule enabled state and claim value.

## Preserve
- Use the same dedicated authentication context across the CA policy and selected PIM role settings.
- Update the CA policy by stable tenant policy ID.
- Update each PIM role policy by stable role-management-policy ID and the Microsoft-defined rule ID `AuthenticationContext_EndUser_Assignment`.
- Preserve unrelated PIM rules by PATCHing only the authentication-context rule.
- Preserve unrelated CA settings when not part of an IAMAI-classified mismatch.

## Do not do
- Do not point PIM at the context while its matching CA policy is Report-only or disabled. Microsoft states the backup MFA mechanism is not triggered in that situation.
- Do not scope the activation CA policy to directory roles as a substitute for the authentication context; the user may not hold the active role until activation succeeds.
- Do not bake the baseline author's authentication-strength object ID into tenant writes; use IAMAI's resolved tenant strength ID.
- Do not combine built-in MFA and an authentication-strength grant when the canonical target is the resolved strength.
- Do not modify unrelated PIM approval, duration, justification, notification, or enablement rules.
- Do not promise a literal new prompt for every click: Microsoft applies a 10-minute reauthentication window across eligible role/group/resource activations.

## State variants
- **Context missing:** create/publish only the dedicated authentication context, then rescan.
- **Missing:** with the context resolved, create the CA policy in Report-only.
- **Partial:** correct only IAMAI-classified context/CA mismatches and keep/return the CA policy to Report-only while correcting.
- **Report-only:** validate the canonical CA policy and authentication context; do **not** yet point PIM at it.
- **Ready to enforce:** enable the canonical CA policy first and verify it remains resolvable.
- **PIM settings pending:** notify privileged administrators, then PATCH only the authentication-context rule on each selected PIM role-management policy.
- **Verification pending:** perform a controlled eligible-role activation and verify the PIM rule/CA result, then rescan.
- **In place:** no implementation action.

## Verification
Read back the authentication context and CA policy. Verify the context is available; CA targets only that context with the resolved strength and Every time sign-in frequency; and CA is enabled before PIM configuration. For each selected role-management policy, GET `AuthenticationContext_EndUser_Assignment` and verify it is enabled with the expected claim value. Perform a controlled activation with an eligible test/admin account and confirm the expected authentication-context flow.

## Rollback / safe recovery
If PIM activation fails after role settings are changed, first PATCH the affected PIM authentication-context rule back to its **captured pre-change values**. Do not guess that disabling/blanking is equivalent to the prior configuration. Then return the dedicated CA policy to Report-only if needed while investigating. Never delete the authentication context or alter unrelated PIM rules as the first rollback action.

## Limitations / unknowns
- Microsoft documents a **10-minute reauthentication window**: after one successful reauthentication, another eligible activation within that window might not prompt again. `Every time` is the configured policy intent, not a literal prompt-per-activation guarantee.
- Authentication context protects the activation event. After activation, it does not by itself constrain where/how the now-active role is used.
- Report-only is intentionally not wired into PIM role settings because Microsoft's backup MFA does not apply when the matching context policy exists but is Report-only/disabled.
- Activation evidence that IAMAI has not observed remains Unknown.

## Source verification
Checked 2026-09-10 against current first-party Microsoft PIM guidance and Graph v1.0 documentation for authentication-context create/update, CA authentication-context targeting, Every time sign-in frequency, role-management-policy authentication-context rule update/readback, required permissions, and the 10-minute reauthentication window.

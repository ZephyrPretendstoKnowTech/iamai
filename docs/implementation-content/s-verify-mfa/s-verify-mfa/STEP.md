# Create and Enforce the MFA Registration Campaign

## Goal
Move active people toward a working MFA method before Conditional Access enforcement, with extra handling for people who have no method and admins who still need phishing-resistant authentication.

## Why this exists
An MFA policy is safe only when the people it reaches can answer the challenge. Registration inventory alone is not proof: IAMAI also tracks whether a method has been seen working and separates people who need hands-on help.

## Applies when
The baseline's MFA rollout is not yet ready and IAMAI has active-person readiness evidence to drive enrollment work.

## Do not show implementation when
Do not start or reconfigure the tenant registration campaign when passkey/authentication-method prerequisites are unresolved, campaign scope is ambiguous, or IAMAI lacks the required readiness population.

## Prerequisites
- Authentication-method settings are ready enough for the intended user workflow.
- Emergency, service, and shared-device accounts are classified outside the active-person campaign population as appropriate.
- IAMAI has the current active-person readiness ledger.
- Help desk has a Temporary Access Pass/recovery workflow for people with no usable method.
- Admins have a path to passkey/security-key registration before phishing-resistant admin enforcement.

## Owner decisions
This package preserves IAMAI's existing campaign design: the tenant registration campaign targets **Microsoft Authenticator**. Microsoft now also supports passkey campaigns, but switching IAMAI's campaign target is a product/owner change and is not inferred here.

## Current-state inputs
Active-person count, readiness percentage, rung/special-care lists, admins needing phishing-resistant methods, current registration-campaign settings, enrollment deadline, and enforcement date.

## Target state
The registration campaign is Enabled for all users using the `all_users` target and `microsoftAuthenticator`, with the IAMAI-specified snooze duration and limited-snooze enforcement. Human enrollment work moves people off the lower readiness rungs; admins additionally register/prove a passkey or security key.

## Security-significant fields
Campaign state, target method, included/excluded targets, snooze behavior, active-person population, recovery/TAP workflow, and admin phishing-resistant readiness.

## Preserve
Preserve explicitly approved campaign exclusions and the IAMAI readiness definition. Do not reinterpret registered-only users as proven.

## Do not do
- Do not silently switch the registration campaign from Authenticator to passkeys because Microsoft now supports that option.
- Do not run both Authenticator and passkey campaigns simultaneously; Microsoft supports one targeted method at a time.
- Do not add service/shared/emergency accounts to a human campaign merely because `all_users` exists in the tenant-level API; exclusions must reflect the IAMAI-resolved product population where required.
- Do not remove someone's only recovery method without a proven replacement.
- Do not mark an admin ready for phishing-resistant enforcement from an Authenticator push registration alone.
- Do not treat Microsoft-managed campaign defaults as identical across tenants during the September 2026 rollout.

## State variants
Setup required; Campaign running; Holdout review; Ready; In place; Blocked.

## Verification
Re-read the authentication methods policy, confirm the campaign target/settings, rescan IAMAI after each enrollment batch, and use the MFA Readiness proof state—not campaign configuration alone—to decide whether rollout gates are satisfied.

## Rollback / safe recovery
Return the campaign to its previous settings if the nudge causes an unexpected registration flow. Do not roll back Conditional Access protections or broaden user exclusions merely to stop campaign prompts.

## Limitations / unknowns
The machine artifact configures the tenant registration campaign only. It cannot register a user's passkey/Authenticator, complete a biometric/security-key ceremony, issue human approvals, or prove a successful sign-in. Microsoft is rolling out revised registration-campaign behavior through the end of September 2026, so the tenant UI may not yet match the newest article exactly.

## Source verification
Microsoft registration-campaign and Graph v1.0 documentation rechecked September 10, 2026. Current Graph supports Authenticator and FIDO2/passkey targets; IAMAI's current supporting-step contract remains Authenticator-targeted.

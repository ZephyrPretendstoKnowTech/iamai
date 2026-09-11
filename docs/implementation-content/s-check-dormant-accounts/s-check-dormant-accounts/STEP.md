# Disable or Confirm Dormant Accounts

## Goal
Resolve every IAMAI-identified dormant-account candidate before Conditional Access enforcement so unused identities do not remain unnecessary attack paths and active-person counts are not distorted.

## Why this exists
Microsoft recommends investigating inactive accounts because unused identities are a security risk. IAMAI uses inactivity evidence only to identify candidates. It must not turn a time window or missing sign-in timestamp into an automatic disable decision.

## Applies when
IAMAI has an enabled user account whose activity evidence meets the product's dormant-candidate rule. Microsoft notes that many organizations use 90–180 days as a reasonable investigation window, but legitimate absence such as leave or vacation must be considered.

## Do not show implementation when
Do not show a disable action until an owner, manager, or authorized tenant administrator explicitly confirms the exact stable account should be disabled. If activity evidence is unreadable or licensing prevents the needed sign-in evidence, show the uncertainty instead.

## Prerequisites
- Exact stable user object ID.
- IAMAI's current enabled/disabled state.
- Available sign-in evidence, especially `lastSuccessfulSignInDateTime`.
- Explicit per-account disposition: disable or keep/in-use.
- Appropriate administrator authorization for the target account.

## Owner decisions
The owner disposition is authoritative. IAMAI may nominate an account for review, but names, age, no-license state, or an empty sign-in field are not decisions.

## Current-state inputs
User ID, display name/UPN, `accountEnabled`, last successful sign-in, last interactive attempt where available, current owner/manager context, and the saved disposition.

## Target state
Each candidate is either:
- explicitly confirmed as still needed, with no tenant mutation; or
- explicitly confirmed dormant and set to `accountEnabled: false`.

This step does not delete the account, remove licenses, alter mailbox contents, revoke sessions, or remove group/application access unless another approved workflow separately requires those actions.

## Security-significant fields
Stable user identity, current account-enabled state, sign-in evidence, and owner disposition.

## Preserve
Preserve the user object, licenses, groups, mailbox, application assignments, authentication methods, roles, and every unrelated property. Disable only the exact confirmed user.

## Do not do
- Do not bulk-disable every account older than a threshold.
- Do not treat `lastSignInDateTime` as proof of successful use; it includes failed interactive attempts.
- Prefer `lastSuccessfulSignInDateTime` when deciding whether the account was actually accessed.
- Do not assume a blank timestamp means the account is safe to disable.
- Do not delete the user as part of this step.
- Do not silently revoke sessions; immediate incident/offboarding response is a separate workflow.
- Do not re-enable a user merely because IAMAI later sees no recent sign-in.

## State variants
- **Needs decision:** show evidence and request a per-account disposition; no implementation.
- **Disable confirmed:** show the single-account disable action.
- **Keep confirmed:** record the decision; no tenant mutation.
- **Verification required:** verify `accountEnabled` on the same stable ID and rescan.
- **In place / blocked:** no actionable implementation.

## Verification
Read the exact user by stable ID. If disposition is disable, verify `accountEnabled` is false. If disposition is keep, verify IAMAI has retained the owner decision and does not continue to offer disable as though the decision were unknown. Rescan after any tenant mutation.

## Rollback / safe recovery
If the wrong confirmed user was disabled, re-enable only that same stable object after validating identity and authorization. Do not recreate the account or modify unrelated access.

## Limitations / unknowns
`signInActivity` requires suitable licensing and permissions; Microsoft notes the sign-in timestamp can lag and a blank value can mean the account never signed in or activity predates retained history. Human investigation remains required.

## Source verification
Verified against current Microsoft first-party documentation on September 10, 2026:
- How to detect and investigate inactive user accounts: https://learn.microsoft.com/en-us/entra/identity/monitoring-health/howto-manage-inactive-user-accounts
- signInActivity resource: https://learn.microsoft.com/en-us/graph/api/resources/signinactivity?view=graph-rest-1.0
- Update user: https://learn.microsoft.com/en-us/graph/api/user-update?view=graph-rest-1.0
- Revoke user access in an emergency: https://learn.microsoft.com/en-us/entra/identity/users/users-revoke-access

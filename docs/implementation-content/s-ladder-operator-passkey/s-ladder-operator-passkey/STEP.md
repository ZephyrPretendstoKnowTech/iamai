# Register Your Own Passkey

## Goal
Ensure the administrator operating IAMAI has a usable phishing-resistant sign-in method and prove it works before stronger admin Conditional Access controls depend on it.

## Why this exists
The operator is likely to be affected early by the admin policy rollout. Registration is not complete until the credential is actually used successfully.

## Applies when
The operator has no proven passkey/security-key sign-in that satisfies the downstream admin requirement.

## Do not show implementation when
Do not pretend Graph or PowerShell can register a credential for the user. Hide the registration action if passkey/FIDO2 tenant settings are not ready or IAMAI reports a blocker.

## Prerequisites
The passkey-settings prerequisite is complete enough to permit the chosen authenticator. The operator can complete an interactive sign-in and has access to the intended Authenticator device or hardware key.

## Owner decisions
None added here. Use the already-approved method policy/hardware choices; this step does not choose a key model or change tenant policy.

## Current-state inputs
Operator identity, registered methods, and proof/evidence already known by IAMAI.

## Target state
The operator has a passkey in Microsoft Authenticator or a FIDO2 security key registered to their account and a subsequent phishing-resistant sign-in is visible in tenant evidence.

## Security-significant fields
Correct user account, authenticator ownership/custody, successful phishing-resistant proof, and absence of shared-device registration.

## Preserve
Keep existing valid authentication methods unless a separate approved remediation says otherwise.

## Do not do
- Do not register the passkey on a shared phone or shared workstation profile.
- Do not share one hardware security key between emergency accounts or operators.
- Do not mark the step complete from registration alone when no successful proof exists.
- Do not create tenant configuration from this step.

## State variants
Register; Verification required; In place; Blocked.

## Verification
Sign out, sign in using the new passkey/security key, then rescan IAMAI and confirm a phishing-resistant success is recorded for the operator.

## Rollback / safe recovery
If the new credential fails, use another already-approved sign-in method, keep the failed credential out of critical dependency paths, and correct registration/settings before enforcing the admin policy.

## Limitations / unknowns
IAMAI cannot perform or prove the physical/biometric interaction itself. A method record without a successful sign-in is not proof that the operator can use it.

## Source verification
Microsoft first-party passkey registration guidance rechecked September 10, 2026.

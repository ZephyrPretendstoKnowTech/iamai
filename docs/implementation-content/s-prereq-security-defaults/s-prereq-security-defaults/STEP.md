# Turn Off Security Defaults

## Goal
Disable Microsoft Entra Security Defaults only at the controlled point where IAMAI's replacement Conditional Access protections are ready to take over.

## Why this exists
Security Defaults is an all-or-nothing baseline. The pinned IAMAI plan needs Conditional Access customization, so Microsoft requires Security Defaults to be disabled when those replacement policies are implemented.

## Applies when
Security Defaults is currently enabled and the tenant is licensed/configured for the required replacement Conditional Access path.

## Do not show implementation when
Hide the disable action until IAMAI's replacement-protection gates are complete. A Report-only policy is evidence, not active replacement protection.

## Prerequisites
The replacement MFA, legacy-authentication, admin protection, emergency-access, and other IAMAI-required cutover policies must be in their prescribed ready/enforcement state. Use IAMAI's dependency truth; do not invent a generic checklist.

## Target state
Security Defaults `isEnabled=false`, with replacement Conditional Access protections enabled in the same controlled cutover window.

## Security-significant fields
Only `isEnabled` on the singleton Security Defaults enforcement policy, plus the external dependency that replacement protection is ready.

## Preserve
Do not change any other tenant setting in this step.

## Do not do
- Do not disable Security Defaults early just to allow Report-only Conditional Access authoring.
- Do not leave a gap with neither Security Defaults nor replacement MFA/legacy-auth protections active.
- Do not treat re-enabling Security Defaults as an unconditional rollback while conflicting Conditional Access policies remain active.
- Do not auto-execute this cutover.

## State variants
Blocked; Ready to disable; Verification required; In place.

## Verification
Immediately read the singleton policy back, confirm `isEnabled=false`, confirm the replacement CA protection is active, then rescan IAMAI.

## Rollback / safe recovery
If access breaks, use emergency access and correct/return the failing Conditional Access policy to Report-only. Re-enable Security Defaults only as part of a coordinated rollback in which conflicting replacement policies are also safely handled.

## Source verification
Verified against Microsoft first-party documentation on September 10, 2026.

# Configure Passkey Authentication

## Goal
Configure the tenant authentication-method policies so the IAMAI baseline can use device-bound, attested passkeys (Microsoft Authenticator or a security key), Microsoft Authenticator, and Temporary Access Pass, naming before the change everyone whose synced passkey stops working.

## Why this exists
Phishing-resistant Conditional Access controls fail if the required authentication methods cannot be registered or used. Microsoft changed the FIDO2 administration model in 2026: passkey profiles are now the preferred configuration surface.

## Applies when
The tenant's passkey/FIDO2, Microsoft Authenticator, or Temporary Access Pass policy differs from the IAMAI-resolved target.

## Do not show implementation when
If passkey profiles are not already enabled, do not perform the profile opt-in until an owner approves it. Microsoft documents that the opt-in cannot be reversed.

## Prerequisites
- Current FIDO2/passkey configuration and whether profiles are already enabled.
- Every registered passkey's type (device-bound or synced), so the people whose synced passkey stops working are named first.
- The IAMAI-resolved desired passkey profile configuration.
- Desired Microsoft Authenticator and TAP configurations.
- Authentication Policy Administrator (or equivalent custom role) and `Policy.ReadWrite.AuthenticationMethod` for Graph writes.

## Owner decisions
Only the passkey-profile opt-in is a new irreversible platform transition that needs explicit approval when not already in use. The passkey type and attestation are decided (owner, 2026-10-03): device-bound and attested for every user, with no AAGUID key restrictions added. A tenant's own key restrictions are kept as they are.

## Target state
The resolved FIDO2/passkey configuration, Microsoft Authenticator configuration, and TAP configuration are applied exactly. Passkey profiles are used when approved/already enabled. Every applicable profile allows device-bound passkeys only, with attestation enforced; the tenant's own key restrictions are unchanged. Synced passkeys are not allowed.

## Security-significant fields
FIDO2 state/targets/self-service registration, passkey profile type, attestation enforcement, key restrictions/AAGUIDs, Microsoft Authenticator state/targets, TAP state/targets/lifetime/use-once behavior.

## Preserve
When modifying FIDO2/passkey policy, preserve every profile, target and key restriction the tenant has. Never reconstruct an allow list from memory or a partial display list.

## Do not do
- Do not opt into passkey profiles without owner approval when profiles are not already enabled.
- Do not use deprecated global FIDO2 attestation/key-restriction fields as the long-term target when profiles are available and approved.
- Do not remove an AAGUID that backs a currently approved key; Microsoft warns that key restrictions affect authentication as well as registration.
- Do not assume synced passkeys satisfy the same attestation policy as device-bound passkeys; synced passkeys do not support attestation.
- Do not invent AAGUIDs or hardware models.

## State variants
Needs decision; Missing/Partial; Verification required; In place; Blocked.

## Verification
Read all three authentication-method configurations back, compare them to IAMAI's canonical resolved target, then perform an actual registration/sign-in proof in the later human/campaign steps. Configuration alone is not proof a person can use the method.

## Rollback / safe recovery
Restore only a known prior complete configuration captured before the change. For a passkey that stopped working, register a device-bound replacement rather than allowing synced passkeys again tenant-wide.

## Source verification
Verified against Microsoft first-party documentation on September 10, 2026. Current Microsoft documentation states passkey-profile opt-in is irreversible and the older global FIDO2 attestation/key-restriction properties are deprecated for removal in October 2027.

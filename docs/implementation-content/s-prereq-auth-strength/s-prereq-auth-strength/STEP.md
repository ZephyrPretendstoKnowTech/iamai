# Create the Baseline's Authentication Strength

## Goal
Create or correct the tenant-local custom authentication strength that downstream IAMAI Conditional Access policies use for the pinned baseline.

## Why this exists
Several pinned-baseline policies require one reusable custom strength. The portable baseline definition is its allowed method combinations, not the source tenant's custom-object GUID.

## Applies when
IAMAI needs the pinned custom strength and has either no semantic match or one safely resolved tenant-local custom strength to correct.

## Do not show implementation when
Do not mutate anything when the resolver is ambiguous, the object is built-in, source identity is unresolved, or IAMAI reports a blocker/source conflict.

## Prerequisites
- Microsoft Entra ID P1 or greater for Conditional Access.
- IAMAI has a canonical target display name.
- Existing-object corrections use the tenant's stable authentication-strength ID.
- Before changing allowed combinations on an existing strength, inspect its Conditional Access usage because the shared change can affect every policy that references it.

## Owner decisions
The current pin remains authoritative. Do not substitute a newer preferred strength design.

## Current-state inputs
Target display name; resolved existing strength ID/name/combinations; semantic mismatches; existing Conditional Access usage; blockers.

## Target state
Custom authentication strength with exactly these five allowed combinations:
- Windows Hello for Business
- Passkeys (FIDO2)
- Certificate-based authentication, multifactor
- Temporary Access Pass, one-time
- Temporary Access Pass, multi-use

Graph values: `windowsHelloForBusiness, fido2, x509CertificateMultiFactor, temporaryAccessPassOneTime, temporaryAccessPassMultiUse`.

The strength satisfies MFA. No source-tenant custom strength ID is portable into the client tenant.

## Security-significant fields
Display name/description, allowed combinations, custom-vs-built-in object identity, and every Conditional Access policy that references the strength.

## Preserve
Preserve the same resolved tenant-local custom object by stable ID during correction. Preserve dependent policies; this step changes only the strength.

## Do not do
- Do not paste Jon Hope's custom authentication-strength GUID into another tenant.
- Do not update a built-in strength.
- Do not create a duplicate if an equivalent custom strength already exists and IAMAI has resolved it.
- Do not add weaker combinations outside the pinned five.
- Do not change allowed combinations without checking usage first.

## State variants
Missing/Create; Partial/Correct; Verification required; In place; Blocked; Source conflict.

## Verification
Read the tenant-local strength by stable ID and confirm custom policy type, target name, and exactly the five allowed combinations. Review usage and rescan IAMAI.

## Rollback / safe recovery
For an allowed-combination correction, use Microsoft's updateAllowedCombinations result/previous values as the rollback reference. Do not delete a strength that is referenced by Conditional Access.

## Limitations / unknowns
Combination configuration details such as AAGUID restrictions are not part of this baseline strength unless IAMAI explicitly supplies them from the pinned baseline. Passkey registration restrictions belong to the passkey-settings prerequisite, not this strength.

## Source verification
Microsoft first-party documentation rechecked September 10, 2026. Graph v1.0 supports create, read, metadata update, usage inspection, and the updateAllowedCombinations action.

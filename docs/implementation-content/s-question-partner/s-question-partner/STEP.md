# Exclude the Partner or MSP Accounts

## Goal
Preserve an owner-approved MSP/CSP delegated-administration path without turning named partner technicians into permanent Conditional Access exceptions.

## Why this exists
Conditional Access can target or exclude the **Service provider** external-user type. That is the correct scope for GDAP/CSP service-provider access; individual technician accounts change over time and must not become a hand-maintained exception list.

## Applies when
The owner has confirmed that an MSP/CSP uses delegated service-provider access and wants that access preserved while the pinned baseline policies are deployed.

## Do not show implementation when
Do not change policy scope from a guessed partner relationship, a display name, or generic guest activity. Do not proceed until the owner decision and affected stable policy identities are resolved.

## Prerequisites
- The partner/MSP relationship is owner-confirmed.
- IAMAI knows whether the access model is GDAP/service-provider access, B2B collaboration, or something else.
- IAMAI has complete resolved desired conditions for every Conditional Access policy that needs the Service provider exclusion.
- Policy updates use stable policy IDs; display names are for readability only.

## Owner decisions
The owner decides whether service-provider delegated access should remain available. That decision is not inferred from sign-in telemetry.

## Current-state inputs
Partner decision, access model, current delegated-access evidence, and the complete IAMAI-resolved policy patches produced by the canonical downstream policy definitions.

## Target state
For an approved GDAP/service-provider relationship, every affected Conditional Access policy excludes **Guest or external users > Service provider users** exactly where IAMAI's canonical target calls for it. No named partner user is excluded directly.

For ordinary B2B collaboration, do not reuse the GDAP rule automatically. B2B cross-tenant trust is a separate owner/security decision and is not silently enabled by this package.

## Security-significant fields
External-user type, affected policy IDs, complete user-condition objects, partner access model, and any existing narrower/broader external-user exclusions.

## Preserve
Preserve every other canonical include/exclude assignment and every unrelated policy condition/control. Apply only complete IAMAI-resolved desired conditions.

## Do not do
- Do not exclude named MSP technicians one by one.
- Do not exclude all guests merely to preserve an MSP.
- Do not enable inbound cross-tenant MFA trust just to make GDAP work. Microsoft documents that GDAP home-tenant MFA is always required and trusted, and ordinary inbound trust settings do not apply to GDAP sign-ins.
- Do not manually edit or remove the service-provider cross-tenant objects created for a GDAP relationship; manage the GDAP relationship through the supported Microsoft 365/Partner Center flow.
- Do not reconstruct a policy's nested users object from partial data.

## State variants
Needs decision; Apply required; Verification required; In place; Not applicable; Blocked.

## Verification
Re-read each affected policy by stable ID and confirm the Service provider external-user type is excluded where required. Then test the delegated admin path and rescan IAMAI.

## Rollback / safe recovery
Restore the prior complete IAMAI-resolved conditions object on the same policy ID. If the business intends to remove partner access entirely, remove/revise the GDAP relationship through the supported relationship-management surface rather than corrupting service-provider policy objects.

## Limitations / unknowns
GDAP and ordinary B2B collaboration are different access models. A B2B trust decision may legitimately use cross-tenant MFA/device trust, but this package does not assume that a GDAP relationship is B2B or vice versa.

## Source verification
Microsoft Conditional Access, GDAP, External ID, and Graph v1.0 documentation rechecked September 10, 2026. Current Microsoft documentation explicitly states that inbound MFA trust settings do not apply to GDAP sign-ins.

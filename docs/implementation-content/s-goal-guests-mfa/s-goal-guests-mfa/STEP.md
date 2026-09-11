# Require MFA for Guests

## Goal
Implement the retained baseline's two-policy guest/external-user MFA design without crediting internal-user coverage, flattening the guest-type split, or inventing cross-tenant trust.

## Why this exists
External identities authenticate under different home/resource-tenant and identity-provider conditions. The pinned baseline deliberately uses two guest policy members with different grants.

## Applies when
Guest or external identities are in scope and the tenant has the required Conditional Access licensing. The stronger member also requires the tenant-local baseline authentication strength.

## Do not show implementation when
Hide implementation while partner/service-provider decisions needed by the resolved users objects are unsaved, the custom strength is unresolved, the step is blocked/source-conflicted/not licensed, or both policies are already in place.

## Prerequisites
- Canonical exclusions are resolved.
- The tenant-local `Modern MFA + TAP` strength exists.
- Saved partner/MSP decisions from the partner step are available before changing Service provider scope.
- Ordinary B2B inbound MFA trust is changed only for owner-approved partner tenants and never as a GDAP workaround.
- Both policy updates use stable tenant IDs.

## Owner decisions
The package consumes the saved partner-tier/service-provider decisions. It does not decide whether a partner tenant's MFA should be trusted.

## Current-state inputs
Both resolved tenant policy IDs/states, complete canonical users objects for each member, tenant-local strength ID, partner/service-provider decisions, optional resolved cross-tenant inbound-trust patches, and report-only evidence.

## Target state
The retained pin maps this goal to two source members:

1. **Strong guest member** — source ID `f25f94e0-98b6-41be-b9d6-68cb781004a4`:
   - All resources; all client apps; no extra risk/location/platform/device/flow/action/context conditions.
   - Included guest/external types in the source: `internalGuest`, `b2bCollaborationMember`, `b2bDirectConnectUser`, `serviceProvider`, across all external tenants, subject to saved partner/MSP overlays in the tenant-resolved users object.
   - Grant: tenant-local `Modern MFA + TAP` authentication strength.
   - No session controls.

2. **Mixed guest member** — source ID `e0fabad3-bd0f-42e4-a901-51ef7ab8889c`:
   - All resources; all client apps; no extra conditions.
   - Included source types: `b2bCollaborationGuest`, `otherExternalUser`, across all external tenants, subject to canonical overlays.
   - Grant: built-in `mfa`.
   - No session controls.

Both are deployed Report-only first in a client tenant.

## Security-significant fields
Guest/external user types, external tenant selection, service-provider handling, canonical exclusions, target resources, grant type/strength, cross-tenant inbound MFA trust, and pair lifecycle.

## Preserve
Preserve the two-member split and the saved partner decision. Preserve each stable tenant policy identity during corrections. Preserve unrelated cross-tenant trust fields when `isMfaAccepted` is changed.

## Do not do
- Do not satisfy this goal with an internal All-users policy alone; guest coverage is classified independently.
- Do not collapse the two pinned members into one guessed guest policy.
- Do not copy Jon's custom strength GUID into another tenant.
- Do not trust MFA from a partner tenant without an owner-approved partner-tier decision.
- Do not change ordinary cross-tenant MFA trust for GDAP; Microsoft documents that GDAP MFA is required in the home tenant and always trusted in the resource tenant.
- Do not enable one half of the pair while the other is non-canonical; enforce the pair only after both are ready.

## State variants
Missing; Partial; Partner trust required; Report-only; Ready to enforce; In place; Blocked; Needs decision; Source conflict; Not licensed.

## Verification
Re-read both policies by stable tenant IDs, verify each guest-type/users object and its correct grant, verify any partner-specific inbound trust independently, then validate representative guest sign-ins during Report-only before enforcing the pair.

## Rollback / safe recovery
If guest access breaks after enforcement, return both pair members to Report-only, inspect the exact external identity type/home tenant and Conditional Access result, correct the canonical users/trust decision, and retest. Do not add a named guest exclusion as a shortcut.

## Limitations / unknowns
Authentication strength support varies by external identity provider. Microsoft documents that email OTP, SAML/WS-Fed, Google federation, and Microsoft personal-account users cannot use authentication-strength policies the same way as external Microsoft Entra users; the retained baseline's second built-in-MFA member must remain separate.

## Source verification
Both pinned guest members and current Microsoft External ID / Conditional Access / Graph v1.0 documentation rechecked September 10, 2026.

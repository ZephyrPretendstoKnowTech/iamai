# Block Sign-ins From Countries Not Allowed

## Goal
Block interactive user sign-ins from countries outside the owner-approved operating set, while preserving only the travel, partner, emergency-access, and service-account handling already resolved by IAMAI.

## Why this exists
A location boundary materially reduces where stolen credentials can be used, but a country policy is only safe when the allowed-country object and legitimate travel/partner paths are explicit.

## Applies when
Conditional Access is licensed, the canonical allowed-countries named location exists, and travel/partner/service-account decisions required by the target are resolved.

## Do not show implementation when
Hide implementation while the allowed-countries location, canonical exclusions, or a required owner decision is unresolved; when licensing is absent; during a source conflict; or when the policy is already canonical and in place.

## Prerequisites
- `location.allowedCountries.id` resolves to IAMAI's canonical named location.
- Emergency/global exclusions and service-account handling are resolved.
- Partner/service-provider treatment comes from the saved owner decision; this package never chooses it.
- Travel exceptions are represented by dated changes to the allowed-country object, not named-user bypasses.
- Corrections use the stable tenant policy ID.

## Target state
Pinned member `f3f4ad30-86a8-4e29-8ec9-4efab1a459f5` defines the destination: All users; All resources; all client apps; locations include `All` and exclude the canonical allowed-countries location; Block access with OR; no session controls. New client deployment starts Report-only even though the source member is currently enabled.

## Security-significant fields
Population/exclusions, All-resources scope, client apps, allowed-countries location ID, block grant, absence of extra conditions/session controls, and lifecycle.

## Preserve
Preserve owner-approved country membership and already-resolved service-account/partner overlays. Source-tenant group/location GUIDs are not portable.

## Do not do
- Do not create a user exclusion for travel.
- Do not infer a country from IP history and silently add it to the allowed list.
- Do not copy Jon's named-location GUID into another tenant.
- Do not use `AllTrusted` as a substitute for the owner-approved country set.
- Do not change an enabled policy's access semantics in place; stage it to Report-only first.

## State variants
Missing; Partial; Report-only; Ready to enforce; In place; Blocked; Needs decision; Source conflict; Not licensed.

## Verification
Confirm the named location has the owner-approved country set, review sign-ins that Report-only says would be blocked, explicitly review legitimate travel/VPN/mobile-border cases, then re-read the policy by stable ID and compare every canonical field.

## Rollback / safe recovery
Move the same policy back to Report-only. Correct the dated country/travel record or canonical target; do not add a permanent named-user bypass.

## Source verification
Pinned member plus current Microsoft block-by-location, named-location, and Graph v1.0 documentation rechecked September 10, 2026.

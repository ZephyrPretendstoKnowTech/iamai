# Block Sign-ins From Countries Not Allowed

Two tasks, in the order the portal needs them (roadmap-flow Stage 3): the countries location first — its blocks carry the `location/` prefix and its META is `tasks[0]` — then the policy.

# Task 1 — Create or Correct Allowed Countries Location

## Goal
Create one canonical country-based named location containing exactly the owner-approved operating countries used by downstream geographic Conditional Access.

## Why this exists
A geographic block is only as safe as the allowed-country list it excludes. Historical sign-ins can reveal countries to review, but they cannot authorize a country or prove future travel needs.

## Applies when
The selected baseline uses a geographic Conditional Access control and the owner has approved the countries where legitimate work may occur.

## Do not show implementation when
Hide create/correct actions while the country set or canonical named-location identity is unresolved.

## Prerequisites
- Owner-approved ISO country/region set.
- Current country named locations and stable IDs.
- Canonical target display name.
- Sign-in geography may be shown as evidence, never as automatic inclusion.
- A travel/remote-work process for temporary exceptions where required.

## Owner decisions
The owner chooses the legitimate operating countries. IAMAI may suggest review based on observed sign-ins but must not infer approval.

## Current-state inputs
Approved country codes, current named-location ID/name/type, current country codes, current `countryLookupMethod`, current `includeUnknownCountriesAndRegions`, observed sign-in countries, and travel decision.

## Target state
One `#microsoft.graph.countryNamedLocation` with:
- the canonical display name;
- exactly the approved ISO country/region codes;
- `countryLookupMethod: clientIpAddress`;
- `includeUnknownCountriesAndRegions: false`.

The location is an allow-list input for later policy work; it is not itself a trusted-network object.

## Security-significant fields
Stable named-location ID, derived type, country set, lookup method, and unknown-country behavior.

## Preserve
Preserve the stable ID of an already-selected canonical location and all downstream policy references to it. Correct writable fields in place where supported.

## Do not do
- Do not derive the approved list solely from past sign-ins.
- Do not silently add the operator's current country.
- Do not include unknown countries/regions.
- Do not mark this as the trusted office network.
- Do not replace a stable object just because its display name is imperfect.
- Do not assume a different `countryLookupMethod` is safely writable through Graph v1.0; current update documentation does not list that property. Treat a lookup-method mismatch as a migration/replacement review rather than inventing a PATCH.

## State variants
- **Needs decision:** show observed geography and collect the owner-approved set.
- **Missing:** create the canonical country named location.
- **Partial:** correct only writable mismatches; a lookup-method mismatch is review-gated.
- **Verification required:** read the same object back and compare exact semantics.
- **In place / blocked:** no actionable implementation.

## Verification
Verify stable ID, type, exact country set, `clientIpAddress` lookup, and unknown countries disabled. Rescan before downstream geographic policy creation/enforcement.

## Rollback / safe recovery
If an in-place country-list correction is wrong, restore the previously recorded country set on the same stable object. Do not delete/recreate while policies reference it.

## Limitations / unknowns
Country-by-IP location is based on the sign-in IP mapping. VPNs, mobile networks, and unknown IP geolocation can produce results that differ from physical location.

## Source verification
Verified against current Microsoft first-party documentation on September 20, 2026 (docs/plans/where-people-sign-in-spec.md section 4):
- countryNamedLocation: https://learn.microsoft.com/graph/api/resources/countrynamedlocation?view=graph-rest-1.0
- Create namedLocation: https://learn.microsoft.com/graph/api/conditionalaccessroot-post-namedlocations?view=graph-rest-1.0
- Update countryNamedLocation: https://learn.microsoft.com/graph/api/countrynamedlocation-update?view=graph-rest-1.0
- Conditional Access network signals: https://learn.microsoft.com/entra/identity/conditional-access/concept-assignment-network

# Task 2 — Block Sign-ins From Countries Not Allowed

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
Pinned member plus current Microsoft block-by-location, named-location, and Graph v1.0 documentation rechecked September 20, 2026 (docs/plans/where-people-sign-in-spec.md section 5).

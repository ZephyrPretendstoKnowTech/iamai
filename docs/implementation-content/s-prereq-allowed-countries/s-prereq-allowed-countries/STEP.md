# Create or Correct Allowed Countries Location

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
Verified against current Microsoft first-party documentation on September 10, 2026:
- countryNamedLocation: https://learn.microsoft.com/en-us/graph/api/resources/countrynamedlocation?view=graph-rest-1.0
- Create namedLocation: https://learn.microsoft.com/en-us/graph/api/conditionalaccessroot-post-namedlocations?view=graph-rest-1.0
- Update countryNamedLocation: https://learn.microsoft.com/en-us/graph/api/countrynamedlocation-update?view=graph-rest-1.0
- Conditional Access network signals: https://learn.microsoft.com/en-us/entra/identity/conditional-access/concept-assignment-network

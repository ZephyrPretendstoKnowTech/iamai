# Add a Travel Notice and Exclusion

## Goal
Provide a controlled temporary path for legitimate travel without creating a person-specific Conditional Access escape hatch.

## Why this exists
A geographic block can stop a legitimate traveler outside the normal allowed countries. IAMAI handles that by temporarily changing the canonical allowed-countries named location for approved dates, then removing the temporary country when the trip ends.

## Applies when
The owner has already chosen occasional/regular travel handling and a real trip requires temporary geographic access.

## Do not show implementation when
Do not change the countries list until traveler, destination country/countries, dates, and approval are known. Do not proceed when the canonical allowed-countries location is unresolved.

## Prerequisites
- Canonical allowed-countries named location exists and is resolved.
- Traveler and exact approved destination country/countries are known.
- Start/end dates are recorded.
- Appropriate business/security approval is recorded.

## Owner decisions
Approval of each trip and destination is a human decision. This package does not infer travel from sign-in telemetry.

## Current-state inputs
Traveler, approved countries, travel dates, approver, current allowed-country set, and trip-log reference.

## Target state
For the approved travel window only, the canonical allowed-countries location contains the approved destination country/countries. At trip end, the temporary countries are removed unless they are independently part of the permanent owner-approved list.

## Security-significant fields
Canonical named-location identity, exact country set, approval, effective dates, and removal/reversion proof.

## Preserve
Preserve all permanently approved countries. Preserve the same named-location object; do not create a separate traveler policy or user exclusion.

## Do not do
- Do not exclude the traveler from Conditional Access.
- Do not add a country without an explicit trip and approval.
- Do not leave a temporary country indefinitely after the trip.
- Do not create a second allowed-countries location for the same policy unless a later owner-approved design explicitly requires it.
- Do not promise GPS precision; Conditional Access location is based on network/IP-derived location.

## State variants
Approval required; Approved/pending apply; Active trip; Revert due; In place; Blocked.

## Verification
Before departure, confirm the canonical country location contains the destination. At trip end, confirm the temporary country is removed and rescan IAMAI.

## Rollback / safe recovery
If the change was wrong, restore the previous approved country set on the same named location. Do not solve a travel block with a broad user exclusion.

## Limitations / unknowns
IP-to-country mapping, VPN exits, and carrier egress can make observed location differ from physical location. The help-desk workflow should capture the actual blocked sign-in and network path rather than broadening access blindly.

## Source verification
Microsoft Conditional Access location guidance rechecked September 10, 2026.

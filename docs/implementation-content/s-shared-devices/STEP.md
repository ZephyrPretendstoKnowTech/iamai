# Give Shared Devices Their Own Policy

## Goal
Give the owner-confirmed shared-device/resource accounts a dedicated Conditional Access path that blocks them outside the approved trusted network, while removing those accounts from policies that require person-interactive actions.

## Why this exists
Teams Rooms, panels, and similar userless devices cannot reliably complete user-interactive MFA or registration prompts. Microsoft recommends grouping resource accounts, excluding them from ordinary user Conditional Access policies, and applying device-specific controls instead.

## Applies when
The owner has confirmed one or more shared-device resource accounts and IAMAI has a stable trusted-network named-location ID.

## Do not show implementation when
Do not create exclusions from candidate naming or device evidence alone. Do not proceed when the trusted-network decision is unresolved or unreadable.

## Prerequisites
- Owner-confirmed shared-device account object IDs.
- A stable trusted-network named-location ID.
- Current Conditional Access policies that IAMAI has already identified as person-interactive and requiring these accounts to be excluded.
- Emergency-access exclusions remain preserved.

## Owner decisions
The owner confirms which accounts truly belong to shared devices. IAMAI does not infer membership from display names alone.

## Current-state inputs
Current dedicated policy identity/state, confirmed account IDs, trusted-location ID, current people-policy exclusions, and device sign-in evidence.

## Target state
A report-only Conditional Access policy initially targets only the confirmed shared-device accounts, All resources, Any location except the canonical trusted network, and Blocks access. The same accounts are excluded from person-interactive policies using each policy's stable ID and complete IAMAI-resolved desired conditions.

## Security-significant fields
User population, target resources, location boundary, Block grant, emergency exclusions, person-policy exclusions, lifecycle state.

## Preserve
Preserve stable policy identities and every unrelated canonical condition/control. Preserve emergency-access exclusions. Correct person-policy exclusions only from complete IAMAI-resolved desired conditions.

## Do not do
- Do not require user-interactive MFA or authentication-method registration from Teams Rooms resource accounts.
- Do not create a broad tenant-wide device exception.
- Do not substitute display names for stable user/policy/location IDs.
- Do not turn the dedicated block policy on before its trusted-location path has been proven.
- Do not silently add Microsoft-recommended compliance/device-model controls that are not part of this IAMAI step; those are separate design choices.

## State variants
Needs decision; Missing; Partial; Report-only; Ready to enforce; In place; Blocked.

## Verification
Confirm each shared device can sign in from the intended network, is blocked by simulation/report-only evaluation outside it, and receives no person-interactive prompt from other policies. Rescan IAMAI.

## Rollback / safe recovery
Return the dedicated policy to Report-only by stable ID. Revert only the specific resolved exclusion patch that caused a device failure; never broaden exclusions globally.

## Limitations / unknowns
This package does not create Intune compliance policies or prove every Teams device model supports the same CA conditions. Microsoft documents those as device-specific considerations.

## Source verification
Verified against current Microsoft first-party documentation on September 10, 2026.

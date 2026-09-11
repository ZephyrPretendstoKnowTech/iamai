# Protect Sign-in Method Registration

## Goal
Protect the Register security information user action so a stolen password cannot be used to add an attacker-controlled sign-in method, while preserving IAMAI's trusted-network design and documented no-trusted-network fallback.

## Why this exists
Authentication-method registration is a persistence path. A compromised account must not be able to register a new method under weaker conditions than the tenant intentionally allows.

## Applies when
Conditional Access is available and IAMAI has resolved the registration mode from the trusted-network prerequisite.

## Do not show implementation when
Hide implementation while the trusted-network result/mode is unresolved, canonical exclusions are unresolved, licensing is missing, the step is source-conflicted, or the canonical policy is already in place.

## Prerequisites
- Emergency access/canonical exclusions are resolved.
- `policy.target.mode` is resolved by IAMAI; the package never chooses it.
- For `blockOutsideTrusted`, a trusted named location exists and is verified.
- For `requireMfaEverywhere`, IAMAI has explicitly resolved that the trusted-network prerequisite does not apply.
- Updates use the stable tenant policy ID.

## Owner decisions
This package consumes the already-resolved trusted-network applicability. It does not manufacture an office/VPN location or choose a weaker fallback.

## Current-state inputs
Current policy ID/state, semantic mismatches, trusted-network result, canonical target conditions/grant, remote registration evidence, and Windows Hello/macOS Platform SSO credential-registration impact where applicable.

## Target state
IAMAI's canonical source semantics define two valid resolved implementations:
- **Trusted network exists:** target `Register security information`; include Any location; exclude All trusted locations; block access outside trusted locations.
- **Trusted network explicitly does not apply:** target the same user action and require MFA using IAMAI's resolved target rather than creating a block that would make registration impossible everywhere.

All variants use canonical emergency exclusions and start Report-only when newly created. No dedicated source-member GUID is surfaced by the retained goal map, so none is invented here.

## Security-significant fields
Population/exclusions, user action, location condition, resolved grant, session controls, lifecycle, and the July 2026 credential-registration expansion.

## Preserve
Preserve the IAMAI-resolved mode and stable tenant policy identity. Preserve Report-only validation before enforcement.

## Do not do
- Do not invent a baseline member GUID.
- Do not block every location when the trusted-network prerequisite is explicitly not applicable.
- Do not silently switch from block-outside-trusted to an authentication-strength design merely because Microsoft examples evolved.
- Do not exclude a user to solve a registration problem; fix the trusted location or bootstrap method.
- Do not ignore Windows Hello for Business or macOS Platform SSO registration impact after July 6, 2026.

## State variants
Missing; Partial; Report-only; Ready to enforce; In place; Blocked; Needs decision; Source conflict; Not licensed.

## Verification
Re-read the policy by stable tenant ID, compare full conditions/grant/session to the resolved target, validate representative registration flows in Report-only, and include WHfB/macOS Platform SSO registration where those workflows exist.

## Rollback / safe recovery
Return the same policy to Report-only if legitimate registration is blocked, correct the trusted-location/bootstrap issue, and retest. Do not add a permanent named-user bypass.

## Limitations / unknowns
The retained projection does not expose a dedicated stable baseline member ID for this goal. The canonical IAMAI step and goal semantics are explicit enough to author safely, but runtime correction identity must come from the resolved tenant policy.

## Source verification
IAMAI canonical source semantics plus current Microsoft Conditional Access/combined-registration/Graph v1.0 documentation rechecked September 10, 2026.

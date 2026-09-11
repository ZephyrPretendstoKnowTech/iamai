# Require MFA for Everyone

## Goal
Require multifactor authentication for the pinned baseline's intended all-user scope while preserving the baseline's deliberate Intune Enrollment exception and the tenant's canonical emergency/service exclusions.

## Why this exists
A password alone must not be sufficient for ordinary access. This is the broad MFA floor beneath stronger admin, risk, registration, and device controls.

## Applies when
The tenant has Conditional Access licensing, emergency access and canonical exclusions are resolved, and IAMAI has a complete tenant-resolved target policy.

## Do not show implementation when
Hide implementation while the step is blocked, needs an owner decision, is source-conflicted, is not licensed, or is already in place.

## Prerequisites
- Emergency access and exclusions are resolved.
- The MFA registration/readiness workflow has reached the product's safe rollout gate or the owner has explicitly accepted the documented holdout handling.
- IAMAI can supply the complete target `conditions` object; no exclusion is inferred from a name.
- Updates use the stable tenant policy ID.

## Owner decisions
This package consumes saved owner decisions about canonical exclusions and rollout timing. It does not create new exceptions.

## Current-state inputs
Current matching policy ID/state, semantic mismatches, canonical exclusion identities, MFA readiness/proof, and report-only evidence.

## Target state
Pinned member `a66e8427-e5e7-4072-bfd1-7e99db7a7dc4` defines the destination:
- Users: All users, with IAMAI-resolved canonical exclusions.
- Resources: All resources, excluding Microsoft Intune Enrollment (`d4ebce55-015a-49b5-a083-c84d1797ae8c`).
- Client apps: all.
- No risk, platform, location, device, authentication-flow, user-action, or authentication-context condition.
- Grant: built-in `mfa`, operator OR.
- Session controls: none.
- New tenant policy: Report-only first; enforce only after the observation/readiness gate passes.

## Security-significant fields
Population, exclusions, resource exclusion, client app scope, absence of extra conditions, MFA grant, session controls, and lifecycle state.

## Preserve
Preserve the retained baseline semantics even where current Microsoft generic guidance differs. Preserve tenant-resolved canonical exclusions and use the existing stable policy identity for corrections.

## Do not do
- Do not remove the Intune Enrollment exclusion simply because Microsoft's generic MFA template now recommends no app exclusions; the retained baseline owns this package and has a separate enrollment step.
- Do not replace built-in MFA with an authentication strength unless the baseline is deliberately re-pinned.
- Do not add named-user exceptions for holdouts.
- Do not create a duplicate policy to avoid correcting the resolved one.
- Do not enforce directly from Missing or Partial.

## State variants
Missing; Partial; Report-only; Ready to enforce; In place; Blocked; Needs decision; Source conflict; Not licensed.

## Verification
Re-read the same policy by stable tenant ID. Confirm conditions, grant, and session controls exactly match the tenant-resolved target and that Report-only evidence is acceptable before enabling it.

## Rollback / safe recovery
If enforcement causes unexpected access failure, return the same policy to Report-only (or Off only when necessary for recovery), investigate the exact sign-in result, correct the underlying readiness/exclusion issue, and rescan IAMAI. Do not create a bypass policy.

## Limitations / unknowns
Current Microsoft generic guidance recommends a no-app-exclusion policy using the built-in Multifactor authentication strength. That is not silently substituted for the retained pin in this package.

## Source verification
Pinned baseline member and current Microsoft Conditional Access / Graph v1.0 documentation rechecked September 10, 2026.

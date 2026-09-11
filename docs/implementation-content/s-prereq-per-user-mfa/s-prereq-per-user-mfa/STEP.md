# Finish Moving Off Per-User MFA

## Goal
Move the remaining users off legacy per-user MFA state only after the tenant's authentication-method policy and Conditional Access replacement MFA path are ready.

## Why this exists
Per-user MFA and policy-based MFA can produce overlapping behavior and legacy exceptions. Microsoft recommends policy-based authentication controls for modern tenants; IAMAI must not remove the old protection before its replacement is active.

## Applies when
One or more users still have per-user MFA state `enabled` or `enforced`.

## Do not show implementation when
Hide disable actions while replacement MFA is not ready or while required authentication methods are not migrated/enabled for the affected population.

## Prerequisites
- Unified Authentication methods policy has been reviewed/migrated for methods people actually use.
- Replacement Conditional Access MFA is ready/active according to IAMAI's plan state.
- Exact user object IDs with per-user MFA Enabled/Enforced are known.

## Target state
Authentication-method settings are governed by the unified policy, replacement MFA is active, and each resolved user's per-user MFA state is `disabled`.

## Security-significant fields
Per-user MFA state for each stable user ID and the external replacement-MFA readiness gate.

## Preserve
Do not modify registered authentication methods, passwords, user enablement, Conditional Access policy contents, or session tokens in this step.

## Do not do
- Do not bulk-disable per-user MFA from guessed/display-name identities.
- Do not disable it before replacement MFA protection is ready.
- Do not use AzureAD or MSOnline.
- Do not present the beta API as a production-stable v1.0 contract.

## State variants
Blocked; Migration required; Ready to disable per-user MFA; Verification required; In place.

## Verification
Read each affected user's per-user MFA state back as `disabled`, verify replacement MFA remains active, and rescan IAMAI.

## Rollback / safe recovery
If the replacement path is not working, restore policy protection first. Re-enable a specific user's per-user MFA only as a deliberate emergency rollback and only after understanding its legacy-client impact.

## Source verification
Verified against Microsoft first-party documentation on September 10, 2026. The machine path is explicitly beta-scoped because Microsoft currently documents per-user MFA updates only through the beta authentication requirements surface.

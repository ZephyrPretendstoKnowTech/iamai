# Block the Admin Portals for Non-Admins

## Goal
Eventually block Microsoft administrative portals for non-admin users, but only after the pinned baseline supplies one unambiguous, safe administrator scope.

## Why this exists
A standard user generally does not need administrative portals. However, a block policy is lockout-sensitive and cannot be safely implemented from contradictory source definitions.

## Applies when
This package currently applies only as a **source-resolution record**. It becomes an actionable Conditional Access package only after a reviewed baseline resolves the contradiction.

## Do not show implementation when
Always hide Entra, JSON, and PowerShell implementation while this retained source conflict exists.

## Prerequisites
A reviewed baseline must explicitly settle which administrators, roles, groups, users, and external/service-provider identities are excluded from the block.

## Owner decisions
No owner decision is substituted for a baseline correction here. The retained decision is to keep this contradiction non-actionable.

## Current-state inputs
Pinned source member `fafaa50c-0b61-4ac6-a589-f9a1120b2f9e` and the product/baseline documentation that describes a non-admin scope.

## Target state
**Unresolved.** The exported member targets All users and excludes no administrator by role, user, or dedicated admin group, while the documented intent says the block is for non-admins. Both cannot be true.

## Security-significant fields
Administrator population, exclusions, targeted admin portal resources, external/service-provider exclusions, block grant, and lifecycle.

## Preserve
Preserve the source conflict as visible evidence. Preserve the rest of the plan; this one unresolved goal does not authorize changes to adjacent policies.

## Do not do
- Do not deploy the exported All-users block as though it were a non-admin policy.
- Do not invent an administrator exclusion list from IAMAI's current admin population.
- Do not redesign the policy from Microsoft's generic admin-portal guidance and call it baseline fidelity.
- Do not create JSON or PowerShell automation while the source is contradictory.

## State variants
Source conflict only (plus blocked presentation where the product routes it there).

## Verification
Verification for this package is source verification: confirm a future reviewed baseline member resolves the scope contradiction. Only then should the step be re-authored into normal Create/Correct/Observe/Enforce projections.

## Rollback / safe recovery
No tenant mutation exists in this package, so there is nothing to roll back.

## Limitations / unknowns
Microsoft documentation proves that Microsoft Admin Portals can be targeted and that Conditional Access can target/exclude users, groups, roles, and external user types. It does not decide which interpretation Jon's baseline intended.

## Source verification
Pinned conflict and current Microsoft Conditional Access targeting documentation rechecked September 10, 2026. The conflict remains intentionally unresolved.

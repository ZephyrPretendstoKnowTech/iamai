# Create or Correct Exclusions Group

## Goal
Create or correct the single owner-confirmed security group IAMAI uses to carry emergency-access exclusions consistently across the Conditional Access policies that would otherwise block or restrict those accounts.

## Why this exists
A stable group gives IAMAI one auditable exclusion identity instead of scattering emergency user IDs across policies. Microsoft recommends a dedicated emergency-access security group and excluding it from Conditional Access policies that block or restrict sign-in.

## Applies when
This supporting step applies after emergency identities are owner-confirmed and before lockout-sensitive policies are enabled. It can create a missing group, correct direct membership, and add the group to policy exclusions that IAMAI has already identified as requiring it.

## Do not show implementation when
Do not emit actions while the owner has not confirmed the canonical group, emergency-account membership is unresolved, group membership could not be read, policy identity is unresolved, or IAMAI cannot determine which policy needs the exclusion. Do not substitute a candidate group by name.

## Prerequisites
- Owner-confirmed emergency access account IDs.
- Owner-confirmed or IAMAI-canonical exclusions-group identity/name.
- Assigned-membership security group semantics; no dynamic membership.
- Stable IDs for every policy IAMAI says must exclude the group.
- Current full Conditional Access `conditions` object for each policy correction so unrelated conditions are preserved.
- Delegated administrator permissions appropriate to groups and Conditional Access.

## Owner decisions
This package consumes the saved canonical exclusions-group choice and saved emergency-account choices. It does not decide which group candidate is canonical and does not add convenience members. Additional non-emergency exclusions require their own explicit product/owner authority; they must not be inferred here.

## Current-state inputs
Canonical group stable ID/name if it exists; intended direct member IDs; current direct members; group type/mail/security properties; policies that IAMAI says materially require this exclusion; each stable policy ID; each policy's current full conditions; and any unreadable/missing evidence.

## Target state
- One canonical Microsoft Entra security group.
- Assigned membership, not Dynamic Membership.
- `securityEnabled: true`, `mailEnabled: false`, no Microsoft 365 `Unified` group type.
- Direct membership exactly matches the owner-confirmed emergency account set for this emergency-exclusion contract unless IAMAI explicitly supplies additional approved members under separate authority.
- Every Conditional Access policy that will block or restrict emergency sign-in when enabled contains the canonical group ID in `conditions.users.excludeGroups`.
- No individual emergency user IDs are added as substitute policy exclusions.
- Existing unrelated policy conditions, grants, session controls, state, application scope, and other canonical exclusions are preserved.

## Security-significant fields
Group stable identity; group type; membership mode; direct members; policy stable IDs; `users.excludeGroups`; preservation of every unrelated policy condition; and absence of unapproved extra members are security-significant.

## Preserve
Preserve the stable group ID when an existing canonical group is safely correctable. Preserve approved members and remove only members IAMAI has explicitly determined are outside the canonical desired membership. Preserve all existing policy fields not required for the exclusion correction. When patching `conditions`, start from the full current conditions object and change only `users.excludeGroups`.

## Do not do
- Do not select a group from a name match or heuristic.
- Do not create a second group when the owner-confirmed stable group exists.
- Do not make the group dynamic.
- Do not add normal administrators, service accounts, travelers, partners, or other identities unless IAMAI supplies explicit separate authority.
- Do not exclude emergency users individually from policies as a shortcut.
- Do not replace an entire Conditional Access policy with a generic template just to add one exclusion.
- Do not delete or overwrite unrelated exclusions.
- When removing a member through Graph, always use `/groups/{group-id}/members/{member-id}/$ref`; omitting `/$ref` can delete the directory object if the caller has sufficient permissions.
- Do not claim Report-only currently locks out emergency access; current Microsoft guidance says it does not. The exclusion must be correct before a blocking/restrictive policy is enabled.

## State variants
- **Needs decision / unreadable:** no implementation.
- **Group missing:** create the assigned security group with the owner-confirmed members; then rescan to obtain the stable group ID before editing policies.
- **Membership partial:** add missing approved emergency members or remove only explicitly identified unexpected members.
- **Policy exclusion partial:** add the canonical group ID to only the policy/policies IAMAI identifies, using a full current `conditions` object as the safe mutation boundary.
- **Verify:** read the group and each affected policy back, compare stable IDs, then rescan.
- **In place:** no implementation actions.

## Verification
1. Read the exact group by stable ID.
2. Verify security group / assigned membership semantics and that it is not mail-enabled.
3. Compare direct member IDs to the canonical owner-confirmed member set.
4. For each IAMAI-identified policy, read the exact policy by stable ID and confirm `conditions.users.excludeGroups` contains the canonical group ID.
5. Confirm the correction did not alter unrelated conditions, grant controls, session controls, lifecycle state, application scope, or other exclusions.
6. Rescan IAMAI and ensure downstream lockout-sensitive steps no longer report the missing canonical exclusion.

## Rollback / safe recovery
If a wrong member was added, remove only that membership reference with the `/$ref` endpoint. If a wrong member was removed, re-add the exact stable ID. If the wrong policy was patched, restore its prior full `conditions` object from the pre-change read-back. Do not delete the canonical group as a rollback for a membership or policy mistake.

## Limitations / unknowns
Creating a new group and immediately patching policies in the same opaque bundle is intentionally avoided: the new stable group ID must be read back and become IAMAI tenant truth first. Policy updates require the current full conditions object because replacing nested Conditional Access structures with an incomplete object can erase security-significant settings. Group membership must remain owner-authoritative.

## Source verification
Verified against current Microsoft first-party documentation on September 10, 2026:
- Manage emergency access accounts in Microsoft Entra ID: https://learn.microsoft.com/en-us/entra/identity/role-based-access-control/security-emergency-access
- Create group: https://learn.microsoft.com/en-us/graph/api/group-post-groups?view=graph-rest-1.0
- Add group members: https://learn.microsoft.com/en-us/graph/api/group-post-members?view=graph-rest-1.0
- Remove group member: https://learn.microsoft.com/en-us/graph/api/group-delete-members?view=graph-rest-1.0
- Update Conditional Access policy: https://learn.microsoft.com/en-us/graph/api/conditionalaccesspolicy-update?view=graph-rest-1.0
- Conditional Access users/groups and exclusions: https://learn.microsoft.com/en-us/entra/identity/conditional-access/concept-conditional-access-users-groups

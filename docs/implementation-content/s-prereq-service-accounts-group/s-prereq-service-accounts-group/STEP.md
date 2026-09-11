# Create or Correct Service Accounts Group

## Goal
Create one canonical assigned security group containing exactly the owner-confirmed non-human Microsoft Entra user accounts that downstream baseline policies treat as service accounts.

## Why this exists
An unattended account cannot answer an MFA or interactive recovery prompt. At the same time, broadly excluding accounts because their names look like services creates a high-value bypass. The membership decision therefore must be explicit.

## Applies when
IAMAI has candidate user-based service accounts or the selected baseline needs a canonical service-account population. If the owner confirms no user-based service accounts exist, the step may be not applicable.

## Do not show implementation when
Do not create/correct membership until each included user identity is owner-confirmed as non-human. Candidate names, no-license state, or non-interactive sign-ins are evidence, not authority.

## Prerequisites
- Owner-confirmed user object IDs for service accounts.
- Current canonical group identity, if any.
- Application/workload owner context.
- Sign-in/workload evidence sufficient to distinguish unattended use from a person.
- A migration note for password/ROPC user accounts where modernization is feasible.

## Owner decisions
The owner confirms which user objects are truly service accounts. IAMAI does not promote a candidate automatically.

## Current-state inputs
Candidate and confirmed service-account IDs, current group ID/type/direct members, workload/sign-in evidence, ROPC evidence, and migration notes.

## Target state
One non-mail-enabled, assigned security group with exactly the owner-confirmed service-account user IDs as direct members.

Where practical, user-based service accounts should have a separate modernization path toward managed identities (Azure-hosted) or service principals; this package does not perform that migration.

## Security-significant fields
Stable group ID, group type, and exact direct user membership.

## Preserve
Preserve group stable identity, unrelated user properties, and downstream policy semantics. Membership corrections must not alter the service accounts themselves.

## Do not do
- Do not classify from display name alone.
- Do not add a human-operated shared/admin account because it resembles a service identity.
- Do not automatically exempt the group from every Conditional Access policy; downstream steps own their exact scopes.
- Do not delete user accounts during group cleanup.
- Do not use dynamic membership for this canonical owner-approved set.
- When removing a member with Graph, use the `/$ref` form so the directory object itself is not deleted.

## State variants
- **Needs decision:** owner confirms candidate identities; no tenant mutation.
- **Not applicable:** no user-based service accounts are confirmed; no group is created solely for symmetry.
- **Group missing:** create the canonical assigned security group with the confirmed users.
- **Partial:** add/remove only explicitly resolved direct members; incompatible group type returns to safe identity resolution.
- **Verification required:** verify exact membership and rescan.
- **In place / blocked:** no actionable implementation.

## Verification
Verify the stable group is a non-mail-enabled security group with assigned membership. Direct members must equal the confirmed user-ID set. Rescan so downstream policy steps consume the same stable group.

## Rollback / safe recovery
Undo only the mistaken membership reference on the same group. Never delete a user. If the selected canonical group is fundamentally the wrong type, resolve a replacement/migration before changing downstream references.

## Limitations / unknowns
This step manages a population of user-based service accounts; it does not convert them to managed identities/service principals or prove application compatibility with that migration.

## Source verification
Verified against current Microsoft first-party documentation on September 10, 2026:
- Securing cloud-based service accounts: https://learn.microsoft.com/en-us/entra/architecture/secure-service-accounts
- Create group: https://learn.microsoft.com/en-us/graph/api/group-post-groups?view=graph-rest-1.0
- Add members: https://learn.microsoft.com/en-us/graph/api/group-post-members?view=graph-rest-1.0
- Remove member: https://learn.microsoft.com/en-us/graph/api/group-delete-members?view=graph-rest-1.0
- Groups overview: https://learn.microsoft.com/en-us/graph/api/resources/groups-overview?view=graph-rest-1.0

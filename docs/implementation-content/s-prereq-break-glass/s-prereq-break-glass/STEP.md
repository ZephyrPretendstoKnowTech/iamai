# Create or Correct Emergency Access Accounts

## Goal
Establish at least two owner-confirmed emergency access accounts that can recover the Microsoft Entra tenant when normal administrator access or Conditional Access fails, without making those accounts dependent on a person, federation, device compliance, or just-in-time role activation.

## Why this exists
A lockout-sensitive Conditional Access rollout needs a recovery path that still works when the normal identity path does not. Microsoft currently recommends two or more cloud-only emergency access accounts, phishing-resistant authentication, permanent active Global Administrator assignment, secure credential custody, monitoring, and validation at least every 90 days.

## Applies when
This supporting step applies before IAMAI allows lockout-sensitive Conditional Access policies to advance. Implementation may be shown only after the owner has confirmed which accounts are the tenant's emergency access accounts.

## Do not show implementation when
Do not emit actionable implementation while the emergency-account choice is unresolved, tenant evidence is unreadable, or IAMAI cannot identify the canonical exclusions group needed by downstream policies. Do not treat candidate detection, account naming, role membership, or historical sign-in evidence as owner confirmation.

## Prerequisites
- Owner-confirmed emergency account identities, with two or more accounts required by the IAMAI product contract and current Microsoft guidance.
- A tenant `*.onmicrosoft.com` domain for cloud-only identities.
- A canonical exclusions group resolved by IAMAI before machine membership actions are offered.
- An authorized administrator able to create/correct users and assign directory roles.
- An organization-approved phishing-resistant method for each account. Microsoft currently recommends passkey (FIDO2); certificate-based authentication is also supported when the organization already operates PKI.
- A secure custody process available to multiple authorized administrators and independent of the tenant being recovered.
- Monitoring and a recurring drill process are required operational controls, but their implementation is not silently manufactured inside this package.

## Owner decisions
This package consumes, but does not create, the saved owner choice of emergency access accounts. It does not decide which detected candidates are emergency accounts, which people may use their credentials, or which physical storage locations are acceptable.

## Current-state inputs
Owner-confirmed emergency account object IDs and UPNs; account enabled/cloud-only state; current Global Administrator assignment; authentication-method evidence; canonical exclusions-group ID and membership; Conditional Access policies that will block or restrict sign-in when enabled; credential-custody evidence; monitoring evidence; and most recent drill evidence.

## Target state
- Two or more dedicated emergency access accounts.
- Cloud-only identities using the tenant's `*.onmicrosoft.com` domain and not sourced from federation or on-premises synchronization.
- Accounts enabled and not tied to normal day-to-day use.
- Global Administrator assigned active and permanent, not merely PIM-eligible.
- Phishing-resistant authentication registered using an organization-approved emergency method that is independent from normal administrator authentication dependencies.
- No employee-personal device or personal recovery detail is required to use the emergency account.
- Credentials/keys are stored securely in separate locations accessible to authorized administrators.
- Each account is a member of the single IAMAI-resolved emergency/exclusions group.
- Before any blocking/restrictive Conditional Access policy is enabled, that group is excluded from the policy. Microsoft does not require emergency-account exclusions from a policy that remains Report-only because Report-only does not block.
- Monitoring exists for emergency-account use, and functionality is validated at least every 90 days.

## Security-significant fields
Emergency-account identity; cloud-only source; `onmicrosoft.com` UPN; enabled state; permanent active Global Administrator role; phishing-resistant method; exclusions-group membership; effective exclusion from blocking/restrictive Conditional Access policies; credential independence/custody; monitoring; and recent functional proof are security-significant.

## Preserve
Preserve stable user object IDs for existing accounts, the owner-confirmed account set, unrelated user properties that do not violate the emergency-account contract, the canonical exclusions-group identity, and all unrelated Conditional Access policy semantics. Account correction must not create duplicates merely to fix a field that is safely correctable in place.

## Do not do
- Do not choose emergency accounts from heuristics or names.
- Do not use a normal employee account as the recovery identity.
- Do not make the account dependent on federation, on-premises sync, an employee phone, or PIM activation.
- Do not register a personal Authenticator device as the only emergency authentication path.
- Do not share one FIDO2 security key between multiple emergency accounts when the approved design requires distinct credentials.
- Do not store passwords, PINs, private keys, recovery secrets, or safe combinations in IAMAI package files, plan exports, AI Info, Email, or JSON bindings.
- Do not exclude individual emergency users directly from each policy when the canonical exclusions group is the product's approved mechanism.
- Do not broaden Conditional Access exclusions beyond the owner-confirmed emergency group.
- Do not claim the emergency path is proven merely because the account object, role, or group membership exists.

## State variants
- **Needs decision:** show the owner-selection requirement only; no implementation.
- **Missing / create or correct:** create/correct the human-visible account setup in Entra. Machine output is intentionally partial and covers only deterministic role assignment and exclusions-group membership for an already-resolved account object.
- **Partial:** show only the failed emergency checks that IAMAI can identify: identity/source, enabled state, role assignment, exclusions membership, authentication method, custody, monitoring, or proof.
- **Verify / prove:** validate deterministic object state, then require a real sign-in/admin-task drill and monitoring confirmation.
- **In place:** no implementation actions.

## Verification
For every owner-confirmed account:
1. Verify the exact stable user ID resolves to the expected UPN.
2. Verify the account is enabled, cloud-only, and uses the tenant's `onmicrosoft.com` domain.
3. Verify a tenant-scoped Global Administrator role assignment is active and permanent.
4. Verify membership in the canonical exclusions group.
5. Before enabling any blocking/restrictive Conditional Access policy, verify that policy excludes the canonical group.
6. Confirm a phishing-resistant emergency authentication method is registered and available without an employee-personal dependency.
7. Confirm credential custody and monitoring outside IAMAI.
8. Perform the real emergency access drill and record the proof date. A configuration read-back is not a substitute for the drill.

## Rollback / safe recovery
If deterministic role or group changes were applied to the wrong stable user ID, stop and restore only the incorrect role/membership change after confirming the intended emergency identity. Do not disable or delete a suspected emergency account during rollback. If a Conditional Access change causes lockout, use a verified emergency account to return the offending policy to Report-only or Off, then investigate before re-enabling.

## Limitations / unknowns
JSON and PowerShell are intentionally partial for this step because credential creation, FIDO2/CBA registration, physical custody, authorization of human users, and functional sign-in proof require human interaction. IAMAI must not persist emergency secrets. Current Microsoft guidance says Report-only policies do not need emergency-account exclusions; IAMAI should still ensure the exclusion is present before those policies are enabled.

## Source verification
Verified against current Microsoft first-party documentation on September 10, 2026:
- Manage emergency access accounts in Microsoft Entra ID: https://learn.microsoft.com/en-us/entra/identity/role-based-access-control/security-emergency-access
- Create unifiedRoleAssignment: https://learn.microsoft.com/en-us/graph/api/rbacapplication-post-roleassignments?view=graph-rest-1.0
- List unifiedRoleAssignments: https://learn.microsoft.com/en-us/graph/api/rbacapplication-list-roleassignments?view=graph-rest-1.0
- Add group members: https://learn.microsoft.com/en-us/graph/api/group-post-members?view=graph-rest-1.0
- Conditional Access users/groups and exclusions: https://learn.microsoft.com/en-us/entra/identity/conditional-access/concept-conditional-access-users-groups

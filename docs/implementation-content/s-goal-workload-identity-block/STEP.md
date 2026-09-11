# Restrict the Entra Connect Sync Account to Its Address

## Goal
When Microsoft Entra Cloud Sync is present, restrict its IAMAI-resolved provisioning service principal so token requests are blocked outside the approved sync-server public IP location.

## Why this exists
A workload identity cannot complete MFA like a person. Microsoft supports Conditional Access for eligible single-tenant service principals and specifically supports blocking them outside known public IP ranges. For Cloud Sync, tying the provisioning service principal to the server's approved public address reduces the usefulness of a stolen workload credential from another network.

## Applies when
This step applies only when IAMAI has established that Entra Cloud Sync exists and has resolved the correct provisioning service principal. It does not apply to classic Microsoft Entra Connect Sync when that workflow is represented by a user account rather than the Cloud Sync service principal targeted by this baseline step.

## Do not show implementation when
Do not show policy implementation when Cloud Sync is Not applicable, the Workload ID Premium requirement is not met, the service principal is unresolved, the approved sync-server public address is unresolved, the prerequisite named location has no stable tenant ID yet, or IAMAI classifies the step Blocked, Needs decision, or Source conflict.

If the prerequisite named location is missing, show only the named-location creation projection. After it is created, rescan IAMAI before showing policy creation.

## Prerequisites
- **IAMAI-confirmed:** Cloud Sync applicability, the correct tenant service-principal Object ID when resolved, current policy/location identities when present, and classified semantic mismatches.
- **Human validation still required:** the server public IP/CIDR set used for the named location must be the approved stable egress address for the Cloud Sync agent workflow. Do not promote an observed address to an approved address without the existing IAMAI decision/evidence path.
- **External prerequisite object:** the IP named location must exist and have a stable tenant ID before the workload policy can be created.
- **Microsoft requirement:** Microsoft Entra Workload ID Premium is required to create or modify Conditional Access policies scoped to service principals.

## Owner decisions
The current Jon Hope pin remains authoritative. Do not broaden this Cloud Sync-specific step to all service principals merely because a generic workload-identity baseline pattern exists.

The pinned source member has no stable policy ID, so its baseline membership is identified by its retained source name. Any update in a real tenant still requires the stable tenant policy ID resolved by IAMAI; display name is never the update identity.

## Current-state inputs
IAMAI may use only facts it already has: Cloud Sync presence, resolved provisioning service-principal Object ID, approved server IP/CIDR evidence, resolved named-location ID/name, current workload policy ID/name/state, semantic mismatches, service-principal sign-in evidence, and blockers. Missing evidence remains Unknown.

## Target state
The step has two canonical objects in sequence.

**1. Sync-server IP named location**
- Type: Microsoft Entra IP named location.
- Display name: IAMAI-resolved target name.
- IP ranges: the complete approved server public CIDR set supplied by IAMAI.
- The package does not invent or require a trusted/untrusted flag because the policy directly excludes this named-location ID.

**2. Workload Conditional Access policy**
- Workload identity: directly include exactly the IAMAI-resolved Entra Cloud Sync provisioning service principal **Object ID from Enterprise applications**.
- Target resources: All resources.
- Client app types: `all` for retained baseline fidelity.
- Locations: include `All`; exclude only the resolved sync-server named-location ID.
- No user/group population, platform, device, authentication-flow, or user/sign-in/service-principal risk condition in this location-only retained target.
- Grant: Block access.
- Session controls: none.
- Lifecycle: Report-only first; Enabled only after the service-principal sign-in evidence confirms the expected source address and no required Cloud Sync operation is unexpectedly affected.

## Security-significant fields
Cloud Sync applicability, service-principal stable Object ID, approved IP ranges, named-location stable ID, direct workload assignment, All-resources target, location include/exclude boundary, Block grant, and lifecycle are security-significant. An incorrect public IP can stop synchronization after enforcement.

## Preserve
- Update the existing tenant policy and named location by stable IDs supplied by IAMAI.
- Preserve unrelated named-location properties when correcting only `ipRanges`.
- When updating `ipRanges`, send the complete desired range collection because Microsoft documents that omitted ranges are removed.
- Preserve the Cloud Sync-specific scope; do not generalize to `ServicePrincipalsInMyTenant`.

## Do not do
- Do not use the App registrations Object ID; Microsoft requires the service principal Object ID from Enterprise applications for Conditional Access workload targeting.
- Do not target a group containing the service principal; Microsoft states Conditional Access assigned to such a group is not enforced for the service principal.
- Do not target managed identities, Microsoft applications, or third-party multitenant SaaS identities with this step.
- Do not use an observed public IP as an approved production address without the required validation/decision.
- Do not create the workload policy before the named location exists and its stable ID is known.
- Do not create duplicate policies or locations to work around an update problem.

## State variants
- **Not applicable:** no action when IAMAI has established that this Cloud Sync workload does not exist.
- **Location missing:** create only the approved IP named location, then rescan.
- **Missing:** with the resolved named-location ID available, create the workload policy in Report-only.
- **Partial:** correct only the IAMAI-classified location/policy mismatch modules. Keep/return the policy to Report-only while material scope is being corrected.
- **Report-only:** validate service-principal sign-in source and policy result.
- **Ready to enforce:** change only policy lifecycle to On, then verify Cloud Sync continues from the approved address.
- **In place:** no implementation action.
- **Blocked / Needs decision / Source conflict / Not licensed:** no actionable implementation.

## Verification
For the named location, read it back by stable ID and compare the complete IP range set with the approved canonical set.

For the policy, read it back by stable policy ID and verify direct inclusion of the expected service principal Object ID, All resources, `clientAppTypes = all`, include Any location, exclude the exact named-location ID, Block grant, no unrelated conditions/session controls, and expected lifecycle.

In Report-only, use **Entra ID > Monitoring & health > Sign-in logs > Service principal sign-ins** and inspect the Report-only Conditional Access result. Confirm normal Cloud Sync token requests originate from the approved server address before enforcement.

After enforcement, verify a fresh Cloud Sync operation succeeds from the approved address and rescan IAMAI.

## Rollback / safe recovery
If synchronization fails after enforcement, return the same stable policy to Report-only first. Check the current server egress address against the named location. If the approved address legitimately changed, update the same named location with the complete approved IP-range set, verify it, and only then reconsider enforcement. Do not delete the policy/location or broaden the allowed location as the first response.

## Limitations / unknowns
- A server public IP can change independently of IAMAI's prior scan. Unknown or unstable egress blocks enforcement readiness.
- Report-only can show expected workload policy effects in service-principal sign-in records, but it does not prove a future network address will remain unchanged.
- The pinned raw source member uses source-tenant object IDs that are not portable; this package intentionally replaces them with tenant bindings.
- Current first-party workload documentation includes beta sample JSON, but the required `clientApplications` and named-location condition shapes are available in Microsoft Graph v1.0; this package therefore uses v1.0.

## Source verification
Checked 2026-09-10 against current first-party Microsoft documentation:
- Conditional Access for workload identities: eligible service principals, Workload ID Premium, direct workload assignment, location-based Block policy, Report-only, service-principal sign-in logs, and Enterprise applications Object ID requirement.
- Microsoft Graph v1.0 `conditionalAccessClientApplications`: direct service-principal include/exclude fields.
- Microsoft Graph v1.0 named-location APIs: IP named-location create/update/list and CIDR requirements; updating `ipRanges` requires the complete desired collection.
- Shared Conditional Access v1.0 create/update and `Invoke-MgGraphRequest` primitives already verified for this authoring run.

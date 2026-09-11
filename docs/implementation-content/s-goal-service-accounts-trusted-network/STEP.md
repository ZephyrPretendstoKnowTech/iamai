# Restrict Service Accounts to the Trusted Network

## Goal
Restrict confirmed **user-based service accounts** to the tenant's approved trusted network so a stolen service-account password cannot be used successfully from arbitrary locations.

## Why this exists
User-based service accounts often cannot satisfy interactive MFA and are therefore intentionally excluded from broader user policies. This compensating control limits those credentials to approved network egress instead of leaving them usable from anywhere.

## Applies when
IAMAI has a confirmed service-accounts group containing user-based service accounts, an owner-confirmed trusted named location, and this retained baseline goal is missing, partial, Report-only, or ready to enforce.

## Do not show implementation when
Do not emit actionable implementation when the service-account group or trusted location is unresolved, identity types are not validated, required service workflows/sign-in origins are unknown, or IAMAI marks the step In place, Blocked, Needs decision, Source conflict, or Not licensed.

## Prerequisites
- The canonical service-accounts group is owner-confirmed and its stable ID is available.
- Members intended for this policy are **user objects used as service accounts**.
- Service principals are handled through Conditional Access for workload identities, not this user/group policy.
- Managed identities are not represented as user accounts here.
- The trusted named location ID(s) are owner-confirmed and represent the actual public egress used by the approved service workflows.
- Review recent service-account source locations and workflow owners before enforcement. Historical sign-ins may inform the review but must not invent or approve a trusted network.
- Emergency/global exclusions remain exactly the IAMAI-resolved canonical exclusions.

## Owner decisions
No new owner decision is authored. The current Jon Hope pin remains authoritative. Do not create a trusted location from observed IP history, add vendor/home/cloud networks automatically, or reclassify a service principal as a user account.

## Current-state inputs
Stable service-accounts group ID and confirmed user members; exact tenant-resolved exclusions; trusted named-location ID(s)/display names; current matching policy stable ID and semantic mismatches; service-account sign-in source locations; identity-type validation; workflow-owner validation; current lifecycle/blockers.

## Target state
- Users: Include only the canonical service-accounts group.
- Exclusions: exact IAMAI-resolved canonical exclusion groups.
- Target resources: All resources.
- Client apps: All.
- Network/location: Include Any network/location (`All`); exclude the exact IAMAI-resolved trusted named location ID(s).
- No sign-in risk, user risk, platform, device/filter, authentication-flow, or workload-risk conditions.
- Grant: Block access, operator OR.
- Session controls: none.
- Lifecycle: Report-only before enforcement, then On.

## Security-significant fields
Service-account group identity, identity type of the members, exclusions, trusted-location identity, All-resources target, location condition direction, block grant, workflow source locations, and lifecycle are security-significant.

## Preserve
Preserve stable policy identity, confirmed service-account group identity, exact canonical exclusions, approved trusted location IDs, and unrelated tenant objects.

## Do not do
- Do not target service principals through the user/group assignment and claim they are protected; user-scoped Conditional Access does not block service-principal calls.
- Do not add observed IP addresses to a trusted location without owner approval.
- Do not use private RFC1918 addresses as if Conditional Access sees them; network evaluation uses the public address seen by Microsoft.
- Do not broaden the excluded trusted locations beyond the IAMAI-resolved approved set.
- Do not enforce until every required service workflow has a confirmed approved source network.
- Do not create a duplicate policy when a stable tenant policy ID exists.

## State variants
- **Prerequisite required:** resolve group identity, member identity types, trusted location, or workflow source validation only.
- **Missing:** create the user-based service-account block policy in Report-only.
- **Partial:** correct only IAMAI-classified mismatches by stable policy ID.
- **Report-only:** verify shape and compare observed service-account source locations with approved network locations.
- **Ready to enforce:** enable only after workflow/source validation.
- **In place / blocked / needs decision / source conflict / not licensed:** no actionable implementation.

## Verification
Read back by stable policy ID. Verify the exact include group, canonical exclusions, All resources, client apps All, Locations = All minus the approved trusted location ID(s), no other effective conditions, Block grant with OR, no session controls, and intended lifecycle. Separately confirm every member is a user-based service account and all required workflow egress locations are approved.

## Rollback / safe recovery
Set the same stable policy back to Report-only. If a service stops, identify the actual source egress and owner before changing network trust. Do not permanently broaden the trusted network as an emergency shortcut.

## Limitations / unknowns
This is a compensating control for legacy user-based service accounts, not the preferred identity model. Microsoft recommends managed identities where possible and service principals otherwise. Service-principal Conditional Access requires workload-identity targeting, and managed identities are outside this user-scoped policy.

## Source verification
Workbook Order 44 is `s-goal-service-accounts-trusted-network`. Retained goal identity maps to stable policy ID `99eabebd-877c-4800-aa15-d389b8767760`. Available source evidence shows a Report-only policy targeting a service-accounts group, All resources, All client apps, Any location minus a trusted named location, and Block access. Current Microsoft documentation confirms the user-vs-workload identity boundary and named-location/public-egress behavior.

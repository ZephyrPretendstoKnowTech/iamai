# Require MFA for Azure Management

## Goal
Require MFA for human access to the Azure management plane while preserving the baseline's canonical exclusions discipline and keeping automation identities out of interactive-user MFA design.

## Why this exists
Windows Azure Service Management API covers highly privileged Azure management surfaces such as Azure portal, Azure PowerShell, and Azure CLI. A leaked user credential should not be sufficient to manage subscriptions/resources.

## Applies when
Conditional Access is licensed, Azure management is relevant to the tenant, the canonical exclusions and service-accounts group are resolved, and any user-based automation has an owner-approved migration/handling path.

## Do not show implementation when
Hide implementation while the service-account/exclusion objects or required automation decision are unresolved, when licensing is absent, during a source conflict, or when IAMAI already establishes the goal is in place.

## Pinned target state
The retained `azure-management-mfa` goal template defines: All users; canonical exclusions plus the resolved service-accounts group; target only **Windows Azure Service Management API** (`797f4846-ba00-4fd7-ba43-dac1f8f63013`); all client apps; Grant **Require multifactor authentication** (`mfa`) with OR; no session controls. New deployment starts Report-only. The retained goalMap does not provide a stable source policy member for this goal, so no GUID is invented.

## Current Microsoft behavior
Microsoft's current Azure-management Conditional Access guidance still targets Windows Azure Service Management API and recommends MFA for human users. Microsoft-managed Conditional Access may also enforce Azure-management MFA in some tenants; IAMAI must treat actual tenant coverage as evidence, not mutate a Microsoft-managed policy or assume that it replaces the pinned exclusions/service-account design.

Microsoft separately recommends replacing user accounts used in scripts/code with managed identities or workload identities. This package does not create an automation identity and does not exempt a human account merely because a script uses it.

## Security-significant fields
Population/exclusions, service-account-group exclusion, exact Azure management application ID, all client apps, built-in MFA grant, null session controls, and lifecycle.

## Preserve
Preserve the tenant's canonical emergency/global exclusions and service-account group. The application ID above is Microsoft-fixed; group/policy object IDs are tenant-specific.

## Do not do
- Do not target `All resources` in place of the Azure management service unless IAMAI's canonical target explicitly changes.
- Do not exclude a human administrator because an automation workflow also uses that identity.
- Do not copy a source-tenant policy/group ID.
- Do not mutate Microsoft-managed Conditional Access policy as if it were IAMAI's target object.
- Do not correct an enabled custom policy's access semantics before staging it to Report-only.

## State variants
Missing; Partial; Report-only; Ready to enforce; In place; Blocked; Needs decision; Source conflict; Not licensed.

## Verification
Review Azure portal/CLI/PowerShell Report-only impact; identify any user-based scripts; confirm service-account handling; then re-read the exact custom policy by stable tenant ID and verify the single Azure-management resource, population/exclusions, MFA grant, null session controls, and state.

## Rollback / safe recovery
Move the same custom policy back to Report-only. Fix the automation identity/workflow separately rather than granting a permanent human-user bypass.

## Source verification
Pinned goal template plus current Microsoft Azure-management MFA, Microsoft-managed Conditional Access, Graph policy, and Graph grant-control documentation rechecked September 10, 2026.

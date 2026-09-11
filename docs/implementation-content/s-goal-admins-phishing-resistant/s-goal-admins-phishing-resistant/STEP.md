# Require Phishing-Resistant MFA for Admins

## Goal
Require the retained baseline's strong authentication control for the exact pinned built-in administrator-role population without mixing session controls or weaker fallback grants into the policy.

## Why this exists
Privileged accounts are high-value targets. A phishable approval or code is not the same protection as the baseline's passwordless/FIDO2/certificate/TAP combinations.

## Applies when
The tenant has Conditional Access licensing, the baseline custom authentication strength exists in the tenant, canonical exclusions are resolved, and affected administrators have a supported method ready.

## Do not show implementation when
Hide implementation while the strength prerequisite is unresolved, admins are not ready, the step is blocked/needs a decision/source-conflicted/not licensed, or the policy is already in place.

## Prerequisites
- `s-prereq-auth-strength` has resolved a tenant-local strength with exactly the retained baseline combinations.
- The custom strength is referenced by tenant ID, never Jon's source-tenant strength GUID.
- Emergency access/canonical exclusions are resolved.
- Affected admins have a supported authentication method and report-only evidence is reviewed before enforcement.

## Owner decisions
This package consumes approved exclusions and rollout timing. It does not narrow the baseline role set or add user exceptions.

## Current-state inputs
Resolved tenant policy ID/state, exact pinned role conditions, tenant-resolved custom strength ID, admin readiness, and semantic mismatches.

## Target state
Pinned member `f893f39f-2ab3-4f1e-a8e1-9a2b9589a9ce` defines the destination:
- Users: the exact pinned set of built-in directory role template IDs, with canonical tenant exclusions.
- Resources: All resources.
- Client apps: all.
- No risk, platform, location, device, flow, action, or authentication-context condition.
- Grant: tenant-resolved custom `Modern MFA + TAP` strength whose combinations are Windows Hello for Business, FIDO2, multifactor certificate, TAP one-time, and TAP multi-use.
- Session controls: none. Admin session lifetime remains a separate baseline policy.
- Safe deployment to a client tenant still begins in Report-only even though the source baseline member is currently enabled.

## Security-significant fields
Role template IDs, exclusions, resource/client scope, custom strength identity/semantics, absence of extra conditions, absence of session controls, and lifecycle.

## Preserve
Preserve the exact pinned role set and custom-strength semantics. Preserve the same tenant policy ID during corrections.

## Do not do
- Do not replace the retained custom strength with Microsoft's generic built-in Phishing-resistant MFA strength without a baseline re-pin.
- Do not copy source strength ID `42de22a7-5339-4a58-b560-28565d53b14d` into another tenant.
- Do not add session frequency here; it belongs to separate session policies.
- Do not assume custom roles or administrative-unit-scoped roles are covered by role targeting.
- Do not enforce before every affected administrator has a usable accepted method.

## State variants
Missing; Partial; Report-only; Ready to enforce; In place; Blocked; Needs decision; Source conflict; Not licensed.

## Verification
Re-read the same policy by stable tenant ID, verify the exact role condition and custom strength, and confirm affected admins complete accepted strong authentication during the observation period.

## Rollback / safe recovery
If enforcement blocks an intended administrator, return this same policy to Report-only, use emergency access if necessary, fix the administrator's credential/readiness or true canonical scope, and rescan. Do not add the administrator as a permanent exclusion.

## Limitations / unknowns
Microsoft documents that Conditional Access role targeting reaches built-in directory roles, not custom roles or administrative-unit-scoped roles. Those require a separately designed scope if the product ever chooses to cover them; this package does not invent one.

## Source verification
Pinned baseline member and current Microsoft Conditional Access / authentication-strength / Graph v1.0 documentation rechecked September 10, 2026.

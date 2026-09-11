# Shorten Admin Sessions

## Goal
Reduce privileged browser-session lifetime to the pinned four-hour value and prevent persistent browser sessions without adding MFA or other grant controls to this session-only policy.

## Why this exists
A stolen privileged browser session is valuable for as long as it remains valid. The baseline limits that window independently from the admin authentication-strength policy.

## Applies when
Conditional Access is licensed and IAMAI has resolved the exact built-in directory-role population and emergency exclusions for this target.

## Do not show implementation when
Hide implementation while the role population/exclusions or licensing are unresolved, when a source conflict exists, or when the policy is already canonical and in place.

## Prerequisites
- `policy.target.includeRoles` is IAMAI's exact resolved role-ID set; do not rebuild it from a model-maintained role list.
- Emergency/canonical exclusions are resolved.
- Corrections use the stable tenant policy ID.

## Target state
Pinned member `04b969aa-3e98-4e0f-8b32-2319b199b56a` (`IAC - GLOBAL – SESSION – Admin Persistence (4 Hours)`) defines: exact resolved admin directory-role scope; All resources; Browser client; no grant controls; sign-in frequency every 4 hours using primary-and-secondary authentication; persistent browser = Never; no risk/location/platform/device/user-action condition. New deployments start Report-only.

## Security-significant fields
Role scope, exclusions, Browser client, All resources, four-hour sign-in frequency, primary-and-secondary authentication type, Never persistent, null grant, and lifecycle.

## Preserve
For an existing matched policy, preserve its exact resolved role/exclusion population unless IAMAI classifies that scope itself as a mismatch. The source currently covers the broad built-in directory-role set; do not silently narrow it to a shorter “core admin” list.

## Do not do
- Do not add an MFA grant; admin authentication strength is a separate baseline goal.
- Do not replace four hours with the generic twelve-hour catalogue floor.
- Do not target all client apps when the pinned member is Browser-only.
- Do not confuse sign-in frequency with token lifetime or continuous access evaluation.
- Do not alter an enabled policy's access semantics in place.

## State variants
Missing; Partial; Report-only; Ready to enforce; In place; Blocked; Needs decision; Source conflict; Not licensed.

## Verification
Re-read the policy, confirm exact role/exclusion scope and four-hour/never-persistent session controls, then validate real privileged browser behavior during Report-only/controlled testing. Confirm prompts occur at the intended interval without an accidental MFA/grant addition.

## Rollback / safe recovery
Move the same policy to Report-only if session behavior is disruptive, correct the canonical session object, and retest. Do not weaken unrelated MFA policies.

## Source verification
Pinned member plus current Microsoft adaptive-session-lifetime and Graph v1.0 documentation rechecked September 10, 2026.

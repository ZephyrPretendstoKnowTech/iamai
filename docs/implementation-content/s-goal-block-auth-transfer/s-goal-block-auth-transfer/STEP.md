# Block Authentication Transfer

## Goal
Block authentication-transfer sessions as defined by the retained baseline so authentication claims are not moved from a signed-in PC to a mobile device through the transfer flow.

## Why this exists
Authentication transfer can move authentication claims by QR-based cross-device flow. The baseline chooses to block that transfer path and require users to sign in directly on the target device instead.

## Applies when
Conditional Access is licensed and the canonical policy scope/exclusions are resolved.

## Do not show implementation when
Hide implementation while exclusions/licensing/source resolution are incomplete or the policy is already canonical and in place.

## Prerequisites
- Emergency/canonical exclusions resolved.
- Authentication-transfer usage/report-only evidence reviewed.
- Stable tenant policy ID used for corrections.

## Owner decisions
None are created here. If the organization intentionally wants authentication transfer, that is a baseline-deviation decision outside this package; do not silently weaken the target.

## Current-state inputs
Current policy ID/state, canonical users/exclusions, authentication-transfer activity including Original transfer method where available, and report-only results.

## Target state
Pinned member `fa005ec2-4940-49c8-b4e7-b58e66ef481c`:
- All users with IAMAI-resolved canonical exclusions.
- All resources.
- Client apps: all.
- Authentication flow: `authenticationTransfer` only.
- No other risk/location/platform/device/action/context condition.
- Grant: Block, OR.
- Session controls: none.
- Report-only before enforcement.

## Security-significant fields
Authentication-flow selection, population/exclusions, resources, client apps, block grant, and lifecycle.

## Preserve
Preserve the pinned flow condition and stable tenant policy identity. Source-tenant exclusion IDs are never copied into another tenant.

## Do not do
- Do not replace this with a device-compliance policy; device claims and authentication transfer are separate concerns.
- Do not add an exception merely because users prefer the QR shortcut.
- Do not correct an enabled policy's access semantics in place; stage the same policy to Report-only first.
- Do not assume an MFA-completed source-device session means the target device should bypass its own device controls.

## State variants
Missing; Partial; Report-only; Ready to enforce; In place; Blocked; Needs decision; Source conflict; Not licensed.

## Verification
Review authentication-transfer sign-ins and Original transfer method, confirm representative mobile users can sign in directly when the transfer is blocked, then re-read the policy and verify exact canonical fields before enabling.

## Rollback / safe recovery
If enforcement causes an unexpected business-impacting workflow, return the same policy to Report-only, validate the exact transfer event and alternative direct sign-in, then decide whether the baseline itself needs review. Do not add an ad-hoc user exclusion.

## Limitations / unknowns
Microsoft still labels authentication transfer preview in 2026. Support varies by Microsoft app/version, so report-only evidence remains important.

## Source verification
Pinned member plus current Microsoft authentication-transfer/authentication-flow/Graph v1.0 documentation rechecked September 10, 2026.

# Block Device Code Sign-in

## Goal
Block device-code authentication as defined by the retained baseline after proving the tenant is not relying on a legitimate device-code workflow.

## Why this exists
Device code flow is useful for input-constrained scenarios but is also a phishing path. The baseline blocks it broadly rather than allowing an undocumented exception.

## Applies when
Conditional Access is licensed, canonical exclusions are resolved, and IAMAI has no unresolved legitimate device-code dependency.

## Do not show implementation when
Hide or block implementation when legitimate device-code use is unresolved, licensing/exclusions are unresolved, the source is conflicted, or the policy is already canonical and in place.

## Prerequisites
- Review both current **Authentication protocol = Device code flow** activity and **Original transfer method = Device code flow** where available.
- Check Teams/shared-device registration and reprovisioning workflows where relevant.
- Emergency/canonical exclusions resolved.
- Stable tenant policy ID used for corrections.

## Owner decisions
If a legitimate workflow still requires device code, this package does not silently add an exception. Remediate the dependency or explicitly resolve a baseline deviation through the product's owner-decision path.

## Current-state inputs
Current policy ID/state, device-code sign-in evidence, protocol-tracked evidence, affected users/devices, canonical exclusions, and report-only results.

## Target state
Pinned member `8b42eda3-6917-4ab4-afb2-e32c37520f9b`:
- All users with IAMAI-resolved canonical exclusions.
- All resources.
- Client apps: all.
- Authentication flow: `deviceCodeFlow` only.
- No other risk/location/platform/device/action/context condition.
- Grant: Block, OR.
- Session controls: none.
- New client deployment begins Report-only; the source member itself is enabled.

## Security-significant fields
Authentication-flow selection, All-resources scope, population/exclusions, block grant, Device Registration Service impact, Teams/shared-device dependencies, and lifecycle.

## Preserve
Preserve the pinned device-code flow condition and stable policy identity. Preserve Report-only validation before enforcement.

## Do not do
- Do not auto-add a Teams-device or Device Registration Service exception that is not in the retained baseline.
- Do not dismiss protocol-tracked sessions merely because the current event no longer says Device code flow.
- Do not correct an enabled policy's access semantics in place; stage it to Report-only first.
- Do not enforce while a legitimate device-code dependency remains unresolved.

## State variants
Missing; Partial; Report-only; Ready to enforce; In place; Blocked; Needs decision; Source conflict; Not licensed.

## Verification
Use direct protocol plus Original transfer method evidence, validate any Teams/device-registration scenarios in Report-only, then re-read the policy and confirm exact canonical semantics before enforcement.

## Rollback / safe recovery
If a legitimate flow breaks, return the same policy to Report-only and resolve the dependency. Do not create a broad persistent exception under pressure.

## Limitations / unknowns
Microsoft's 2026 guidance explicitly documents Teams-device and Device Registration Service dependencies. Tenant evidence, not assumption, determines whether the baseline can be enforced unchanged.

## Source verification
Pinned member plus current Microsoft authentication-flow/Teams-device/Graph v1.0 documentation rechecked September 10, 2026.

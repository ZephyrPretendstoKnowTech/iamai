# Block Legacy Authentication

## Goal
Block the legacy client paths in the retained baseline while preserving explicit service/device remediation decisions and emergency access.

## Why this exists
Legacy authentication can bypass modern MFA controls. The retained policy targets Exchange ActiveSync and Other clients and blocks them across all resources.

## Applies when
Conditional Access is licensed, canonical exclusions are resolved, and any mail-sending/service-account dependency identified by IAMAI has an explicit disposition.

## Do not show implementation when
Hide implementation while service/mail-device decisions are unresolved, canonical exclusions are unresolved, licensing is missing, the source is conflicted, or the policy is already canonical and in place.

## Prerequisites
- Emergency access/exclusions resolved.
- Service-account and mail-device decisions consumed from their prerequisite steps.
- Legacy sign-in evidence reviewed.
- Stable tenant policy ID used for corrections.

## Owner decisions
The package consumes owner-confirmed service-account/mail-device outcomes. It does not infer that a quiet sign-in log means no device exists.

## Current-state inputs
Current policy ID/state, canonical users/exclusions, legacy sign-in evidence, confirmed service accounts/devices, and report-only results.

## Target state
Pinned member `9eab445f-7f21-479a-85c9-29769512067e`:
- All resources.
- Client apps exactly `exchangeActiveSync` and `other`.
- All users with IAMAI-resolved canonical exclusions/approved service overlays.
- No risk, location, platform, device, authentication-flow, user-action, or authentication-context condition.
- Grant: Block, OR.
- Session controls: none.
- New client deployment begins Report-only; the source member itself is enabled.

## Security-significant fields
Client-app scope, population/exclusions, service-device exceptions, All-resources scope, block grant, and lifecycle.

## Preserve
Preserve the pinned legacy-client condition and stable tenant policy identity. Preserve only owner-confirmed service/device overlays resolved by IAMAI.

## Do not do
- Do not widen the client-app condition beyond the retained baseline.
- Do not remove service/device exclusions before their remediation path is complete.
- Do not infer a printer/scanner is absent because it produced no recent interactive sign-in evidence.
- Do not correct an enabled policy's access semantics in place; stage the same policy to Report-only first.

## State variants
Missing; Partial; Report-only; Ready to enforce; In place; Blocked; Needs decision; Source conflict; Not licensed.

## Verification
Review Report-only results and sign-in logs for legacy client use, validate approved service/device dependencies, then re-read the exact policy and compare its complete canonical target before enabling.

## Rollback / safe recovery
If a legitimate client breaks, return the same policy to Report-only and remediate the application/device. Do not create an undocumented user exclusion.

## Limitations / unknowns
A quiet log does not prove there are no infrequently used devices or applications. Physical/operational inventory remains relevant.

## Source verification
Pinned member plus current Microsoft legacy-auth and Graph v1.0 documentation rechecked September 10, 2026.

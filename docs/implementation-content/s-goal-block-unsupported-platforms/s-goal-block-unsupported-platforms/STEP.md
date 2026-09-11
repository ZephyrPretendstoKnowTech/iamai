# Block Unsupported Device Platforms

## Goal
Block sign-ins from device platforms outside the pinned supported set while preserving approved supported-device workflows.

## Why this exists
Device-platform rules close a gap around Linux and unidentified/unsupported clients, but the platform signal is derived from the user agent and is not a substitute for device compliance or app protection.

## Applies when
Conditional Access is licensed and IAMAI has resolved the canonical exclusions and any device-plan decision that materially changes which platforms the tenant supports.

## Do not show implementation when
Hide implementation while required platform/device-plan decisions or exclusions are unresolved, when licensing is absent, during a source conflict, or when the policy is already canonical and in place.

## Target state
Pinned member `9e21fa64-8d9a-4e62-81da-9abce8859a0c` (`IAC - GLOBAL - BLOCK - Unsupported Device Platforms`) defines the destination: All users; canonical tenant exclusions; All resources; all client apps; device platforms Include `Any device`/`all`, Exclude Android, iOS, Windows, and macOS; Block access with OR; no session controls. New client deployments start Report-only even though the retained source member is currently enabled.

## Security-significant fields
Population/exclusions, All-resources scope, all client apps, the exact platform include/exclude set, block grant, absence of extra conditions/session controls, and lifecycle.

## Current Microsoft behavior
Microsoft documents this pattern as **Block unknown or unsupported device platform** and warns that platform detection is based on user-agent strings. Use this as a companion to device compliance/app-protection controls, not as proof that the client platform cannot be spoofed.

## Preserve
Preserve the exact IAMAI-resolved supported-platform decision. Source-tenant exclusion-group IDs are not portable.

## Do not do
- Do not silently exclude Linux because a Linux sign-in is observed.
- Do not add a named-user bypass for an unsupported device.
- Do not treat a quiet sign-in window as proof that the policy is safe to enforce.
- Do not change access-affecting semantics while an existing policy is On; stage it to Report-only first.

## State variants
Missing; Partial; Report-only; Ready to enforce; In place; Blocked; Needs decision; Source conflict; Not licensed.

## Verification
Review Report-only results for every unsupported/unidentified platform event, confirm each legitimate workflow has an owner-approved supported path, re-read the exact policy by stable ID, and compare all canonical conditions/grant/session fields before enforcement.

## Rollback / safe recovery
Move the same stable policy back to Report-only. Resolve the platform/workflow decision instead of adding an emergency bypass to the policy.

## Source verification
Pinned source plus current Microsoft Conditional Access unsupported-platform, Graph platform, and Graph grant-control documentation rechecked September 10, 2026.

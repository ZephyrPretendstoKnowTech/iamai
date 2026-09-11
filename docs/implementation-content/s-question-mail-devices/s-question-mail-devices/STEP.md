# Set Up an SMTP Relay for Mail-Sending Devices

## Goal
Remove mail-sending printers, scanners, appliances, and applications from password-dependent legacy authentication before the baseline blocks legacy sign-ins.

## Why this exists
A device that sends by SMTP AUTH with a username/password can stop when legacy authentication is blocked. The safe replacement depends on device capability: SMTP AUTH with OAuth may fit a modern app/device; Exchange Online SMTP relay may fit an on-premises source with a certificate or static public IP; other documented options can be better for different workloads.

## Applies when
IAMAI has an owner-confirmed mail-sending device/application that still depends on an interactive/service account or legacy SMTP path.

## Do not show implementation when
Do not create a connector until the mail route is chosen and the relay prerequisites are proven. Do not infer a public IP, certificate name, accepted domain, sender address, or device capability.

## Prerequisites
- Device/application owner identified.
- Current sending method and authentication mode known.
- Required recipients known (internal only vs internet recipients).
- If relay is chosen: MX endpoint, TCP 25 reachability, accepted sender domain, and either a suitable TLS certificate (preferred) or a static unshared public IPv4 address.
- If SMTP AUTH is retained: the device/app supports OAuth and TLS 1.2 or later.

## Owner decisions
Choose the supported route for each device/application from actual capability and delivery needs. This package does not force every device into the same mail path.

## Current-state inputs
Device list, current protocol/authentication, recipient scope, network egress, accepted domains, certificate/static-IP availability, and any current inbound connectors.

## Target state
Every listed device/application sends successfully using a supported modern route without depending on a user password that needs the service-account Conditional Access exception. After proven cutover, remove the obsolete service account from the service-accounts group in that group's canonical step.

## Security-significant fields
Mail route, sender identity/domain, connector identity, certificate or source IP, TLS, recipient scope, and the legacy service account being retired.

## Preserve
Preserve existing working connectors until a replacement is tested. Reuse an existing suitable connector rather than create a duplicate.

## Do not do
- Do not put device passwords into scripts, JSON, email, or IAMAI exports.
- Do not create an open relay.
- Do not use a dynamic/shared public IP as relay identity.
- Do not assume Direct Send can reach external recipients.
- Do not keep a device in the service-account exception group after its password-based dependency is actually removed.
- Do not treat SMTP AUTH Basic as a durable design merely because Microsoft's revised timeline leaves it unchanged through December 2026.

## State variants
Route decision required; Migration required; Relay connector ready; Verification required; In place; Blocked.

## Verification
Send a test message through the chosen route to the required recipient types, inspect message trace/device logs, confirm the old credential is no longer used, then remove the old account from the service-account exception path only after proof.

## Rollback / safe recovery
Keep the previous route available until the new route is proven. If relay fails, disable/remove only the new connector or revert device settings; do not weaken tenant-wide authentication policy as the rollback.

## Limitations / unknowns
Device configuration is vendor-specific. This package can inspect/create a deterministic Exchange Online connector slice, but it cannot configure the printer/application itself or implement OAuth inside third-party firmware.

## Source verification
Microsoft Exchange Online device-mail, SMTP AUTH, connector, and PowerShell documentation rechecked September 10, 2026. Microsoft revised the SMTP AUTH Basic timeline in January 2026: behavior remains unchanged until December 2026, but OAuth is the supported modernization direction.

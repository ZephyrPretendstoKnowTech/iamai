# Require Token Protection on Windows

## Goal
Require token protection for the retained Windows native-client resource set so a stolen sign-in token cannot simply be replayed from another device.

## Why this exists
Token protection binds supported sign-in session tokens to the device that acquired them. Microsoft documents that compatible Windows native applications can use this control, while unsupported clients or unsupported device-registration types can be blocked instead of silently falling back. That makes compatibility evidence part of enforcement readiness, not an afterthought.

## Applies when
This step applies when IAMAI's pinned-baseline resolver selects the token-protection policy for the tenant and Conditional Access is available. The retained target applies to Windows, Mobile apps and desktop clients, and the five pinned resources: Exchange Online, SharePoint Online, Microsoft Teams Services, Azure Virtual Desktop, and Windows 365.

## Do not show implementation when
Do not show actionable implementation when IAMAI classifies the step as In place, Blocked, Needs decision, Source conflict, or Not licensed. Do not emit Create when IAMAI has already resolved the existing tenant policy.

## Prerequisites
- **IAMAI-confirmed:** the canonical policy name, canonical exclusion-group set, current policy identity when present, and semantic mismatch set.
- **External prerequisite / existing Plan dependency:** service/shared-account handling must already be represented by the tenant's approved exclusions rather than invented in this package.
- **Human validation still required before enforcement:** review normal Windows native-client use plus known unsupported device-registration/client paths that IAMAI cannot prove from its current evidence.
- **Microsoft requirement:** Microsoft Entra ID P1 or equivalent Conditional Access entitlement.

## Owner decisions
The current Jon Hope pin remains authoritative. Do not re-pin or add a newer resource merely because current Microsoft deployment guidance has expanded.

The retained baseline includes exactly five resources. Current Microsoft guidance conditionally adds Windows Cloud Login when Windows App is deployed; that is a documented baseline-versus-current-guidance difference, not authorization for this package to change the approved target.

## Current-state inputs
IAMAI may use only facts it already has: the resolved policy ID/name/state, canonical exclusions, semantic mismatches, Windows registration/device evidence, token-protection compatibility/sign-in evidence if already collected, affected-user count, and existing blockers. Missing optional evidence stays Unknown and must not trigger a new tenant read merely to render this package.

## Target state
The canonical policy is:
- Users: All users.
- Exclusions: the complete IAMAI-resolved canonical exclusion group set for this policy, including approved exception groups where applicable.
- Resources: exactly:
  - `00000002-0000-0ff1-ce00-000000000000` — Office 365 Exchange Online;
  - `00000003-0000-0ff1-ce00-000000000000` — Office 365 SharePoint Online;
  - `cc15fd57-2c6c-4117-a88c-83b1d56b4bbe` — Microsoft Teams Services;
  - `9cdead84-a844-4324-93f2-b2e6bb768d07` — Azure Virtual Desktop;
  - `0af06dc6-e4b5-4f28-818e-e78e62d137a5` — Windows 365.
- Device platform: Windows only.
- Client apps: Mobile apps and desktop clients only.
- Device filter: Exclude devices matching `device.systemLabels -contains "CloudPC" -and device.trustType -eq "AzureAD"`.
- No risk, location, user-action, or authentication-flow condition.
- No grant control.
- Session: Require token protection for sign-in sessions (`secureSignInSession.isEnabled = true`).
- Lifecycle: Report-only while compatibility is being evaluated; Enabled only after readiness is satisfied.

## Security-significant fields
Population, exclusions, exact resource set, Windows platform, native-client scope, device filter, absence of unrelated conditions/grants, token-protection session control, and lifecycle state are security-significant. A change in any of those fields can change who is affected, what resources are protected, or whether unsupported clients are blocked.

## Preserve
For corrections, update the IAMAI-resolved policy by stable tenant policy ID. Preserve unrelated root properties unless the safe PATCH boundary requires a complete canonical containing object. Preserve approved exclusions and do not invent new service/shared-device exceptions from Microsoft examples.

## Do not do
- Do not target the Office 365 application suite; Microsoft warns that this can cause unintended failures for token protection.
- Do not include Browser in the client-app condition for this retained Windows native-client policy.
- Do not silently add Windows Cloud Login or other newer resources to the retained five-resource baseline.
- Do not remove the retained CloudPC device filter merely because current Microsoft documentation shows a slightly different example expression.
- Do not create a duplicate when an existing policy has been resolved.
- Do not use display name as update identity.
- Do not claim compatibility is proven merely because the policy is in Report-only.

## State variants
- **Missing:** create the canonical policy in Report-only.
- **Partial:** render only correction modules for the actual IAMAI mismatch set; keep/return the policy to Report-only while correcting.
- **Report-only:** review interactive and non-interactive sign-in evidence, especially Token Protection - Sign In Session status and known unsupported device/client paths.
- **Ready to enforce:** change only lifecycle to On, then run a controlled validation.
- **In place:** no implementation action.
- **Blocked / Needs decision / Source conflict / Not licensed:** no actionable implementation.

## Verification
Read the exact policy back by stable ID and verify the canonical population, exclusions, resource set, Windows platform, client-app type, device filter, absence of unrelated grant/conditions, token-protection session control, and expected lifecycle.

Before enforcement, review both interactive and non-interactive sign-ins long enough to cover normal application use. Microsoft documents `tokenProtectionStatusDetails` and status codes such as 1002, 1003, 1006, and 1008 to identify missing device state, unsupported registration/device state, unsupported OS, or a client that is not integrated with the platform broker.

After enforcement, perform a controlled supported-client test and rescan IAMAI.

## Rollback / safe recovery
If enforcement disrupts a required workflow, return the same stable policy to Report-only first. Diagnose the unsupported client/device path and correct only the approved exclusion/filter or workflow. Do not delete the policy, broaden exclusions, or create a second competing policy as the first recovery step.

## Limitations / unknowns
- Current Microsoft Graph v1.0 `conditionalAccessSessionControls` does not expose `secureSignInSession`; the beta schema does. Therefore only this package's JSON/PowerShell policy mutation uses an explicit Graph beta exception. Microsoft warns beta APIs are subject to change and unsupported for production applications.
- Current Microsoft guidance conditionally includes Windows Cloud Login with Windows App, but the retained baseline does not. This package preserves the current owner-approved pin.
- IAMAI must not infer that unobserved applications or registration methods are compatible. Absence of evidence remains Unknown.

## Source verification
Checked 2026-09-10 against current first-party Microsoft documentation:
- Token Protection Deployment Guide - Windows: supported applications/resources, limitations, device filters, Report-only rollout, sign-in-log validation, portal configuration.
- Microsoft Graph v1.0 `conditionalAccessSessionControls`: does not list `secureSignInSession`.
- Microsoft Graph beta `conditionalAccessSessionControls` and `secureSignInSessionControl`: expose the token-protection session-control property and shape.
- Microsoft Graph beta Conditional Access create/update: required only for the isolated token-protection mutation surface; current permission and role requirements remain `Policy.Read.All` + `Policy.ReadWrite.ConditionalAccess`, with Conditional Access Administrator or Security Administrator supported.

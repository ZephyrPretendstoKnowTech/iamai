# Require a Fresh Sign-in for Intune Enrollment

## Goal
Require a fresh interactive reauthentication every time a **user-driven Microsoft Intune enrollment** evaluates this policy, so an existing borrowed session cannot silently enroll a device as trusted.

## Why this exists
Device enrollment changes the tenant's trust relationship with a device. The retained baseline therefore targets the Microsoft Intune Enrollment application and applies **Sign-in frequency → Every time**. This step is a session-control step; the retained source member does **not** add an MFA grant. MFA for device registration/join is handled separately by IAMAI's device-registration step.

## Applies when
Use this step when Intune enrollment is in scope, Conditional Access is licensed, the Microsoft Intune Enrollment resource exists or can be prepared, and IAMAI has the canonical exclusions and current policy identity/state needed for the selected projection.

## Do not show implementation when
Do not render actionable implementation for `inPlace`, `blocked`, `needsDecision`, `sourceConflict`, or `notLicensed`. Do not update a policy by display name. If the Microsoft Intune Enrollment service principal is absent, prepare that resource first; do not create a CA policy with a guessed resource ID.

## Prerequisites
- Microsoft Entra Conditional Access licensing is available to the in-scope users; the enrollment workflow itself also requires the relevant Intune capability/licensing.
- The Microsoft Intune Enrollment enterprise application/service principal for app ID `d4ebce55-015a-49b5-a083-c84d1797ae8c` exists. Microsoft documents that new tenants might need an administrator to create this service principal.
- IAMAI has resolved the canonical exclusions and stable tenant policy ID for update states.
- Enrollment workflows that matter to the tenant are identified well enough to distinguish user-driven enrollment from userless/self-deploying flows.

## Owner decisions
No new owner decision is introduced. The current baseline pin `8461e0f2fd10167bf034e7c20ed8ea293827d890` remains authoritative. The retained source member is `IAC - APP - SESSION - IntuneEnrollment-SIFEveryTime`; the available pinned mapping does not surface a stable source policy ID, so none is invented.

## Current-state inputs
IAMAI may use recent enrollers/enrollments, current CA policy, canonical exclusions, the Intune Enrollment resource/service-principal state, device-management decisions, enrollment-workflow evidence, and blockers already available to the product. Missing workflow evidence remains Unknown.

## Target state
- Users: All users, with IAMAI-resolved canonical exclusions.
- Target resources: Microsoft Intune Enrollment only (`d4ebce55-015a-49b5-a083-c84d1797ae8c`).
- Client apps: All.
- No unrelated sign-in risk, user risk, service-principal risk, location, platform, device/filter, authentication-flow, or user-action condition.
- Grant controls: none. Do not silently add `mfa`, compliant-device, or other grant controls to this retained baseline step.
- Session: Sign-in frequency enabled, `frequencyInterval = everyTime`, `authenticationType = primaryAndSecondaryAuthentication`; no persistent-browser or other noncanonical session control.
- Lifecycle: Report-only for validation, then On after readiness.

## Security-significant fields
Population/exclusions, target application, client-app type, absence of unrelated conditions, absence of grant controls, Every-time sign-in frequency, and lifecycle state are security-significant. The Microsoft Intune Enrollment app ID is Microsoft-owned and cross-tenant; the tenant service-principal object ID is not a substitute for the application ID in the CA target.

## Preserve
Preserve the IAMAI-resolved canonical exclusions, the exact Microsoft Intune Enrollment target, and unrelated tenant configuration outside this policy. Preserve separate device-registration MFA behavior; do not collapse the two steps into one policy without an owner/baseline decision.

## Do not do
- Do not add a compliant-device/device-based grant to Microsoft Intune Enrollment; Microsoft explicitly warns against device-based access rules for this enrollment target.
- Do not silently convert this retained session-only policy into Microsoft's separate MFA-at-enrollment recipe.
- Do not target the Microsoft Intune admin-center application when the intent is enrollment; use Microsoft Intune Enrollment.
- Do not assume self-deploying/userless Autopilot produces the same reauthentication evidence as user-driven enrollment.
- Do not treat Report-only as proof that the user experienced a fresh prompt; it does not enforce the session control.

## State variants
- **Resource missing:** create/confirm the Microsoft Intune Enrollment service principal, then rescan IAMAI.
- **Missing:** create the canonical CA policy in Report-only.
- **Partial:** correct only IAMAI-classified mismatches.
- **Report-only:** verify canonical configuration and review enrollment applicability/evidence; keep user experience proof Unknown until enforcement testing.
- **Ready to enforce:** turn the same stable policy On, perform controlled user-driven enrollment, and rescan.
- **In place / blocked / needs decision / source conflict / not licensed:** no actionable implementation viewer.

## Verification
Read back the exact tenant policy by stable ID. Verify All users + canonical exclusions, target app `d4ebce55-015a-49b5-a083-c84d1797ae8c`, client apps All, no noncanonical conditions, no grant controls, Every-time sign-in frequency, and expected lifecycle. Before enforcement, verify relevant enrollment workflows. After enforcement, perform a controlled **user-driven** enrollment and confirm a fresh reauthentication occurs; separately confirm required userless/self-deploying workflows still function.

## Rollback / safe recovery
Set the same policy back to Report-only by stable tenant policy ID. If a newly created Microsoft Intune Enrollment service principal is proven to have been created solely for this step and must be removed, treat that as a separate application-administration rollback with explicit evidence; do not delete enterprise applications automatically as part of the CA rollback.

## Limitations / unknowns
Every-time reauthentication can create sign-in loops if combined with incompatible authentication requirements. Microsoft also documents enrollment-flow/platform-specific behavior, so IAMAI must not infer successful enrollment from policy shape alone. Report-only cannot prove the prompt occurred. Unknown enrollment paths remain Unknown.

## Source verification
Current Microsoft documentation confirms that Microsoft Intune Enrollment controls the enrollment workflow, app ID `d4ebce55-015a-49b5-a083-c84d1797ae8c` may require a service principal to be created in new tenants, Every time is supported for Intune enrollment, and Conditional Access policy writes are available through Graph v1.0. Source URLs are recorded in `META.json`.

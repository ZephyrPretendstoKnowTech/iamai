# Require MFA to Register a Device

## Goal
Require the pinned baseline's MFA authentication strength when an in-scope user registers or joins a device in Microsoft Entra ID.

## Why this exists
A password alone must not be enough to register an attacker-controlled device as a tenant device. Jon Hope's retained pinned member for this goal targets the Microsoft Entra **Register or join devices** user action and requires an authentication strength that allows only Windows Hello for Business, FIDO2 security keys, certificate-based MFA and a one-time Temporary Access Pass. IAMAI resolves this tenant's own strength for that requirement.

## Applies when
Show implementation only when IAMAI classifies this step as `missing`, `partial`, `reportOnly`, or `readyToEnforce` and all state-specific blockers are cleared.

## Do not show implementation when
Do not show actionable implementation when the step is `inPlace`, `blocked`, `needsDecision`, `sourceConflict`, or `notLicensed`.

Do not offer enforcement while a known device-registration or enrollment workflow remains unresolved. Do not offer the authentication-strength implementation when affected users rely on external authentication methods that have not been reconciled with Microsoft's documented incompatibility.

## Prerequisites

### IAMAI-confirmed
- Conditional Access licensing eligibility is represented by the step state; `notLicensed` exposes no mutation.
- IAMAI has a canonical target policy name for Create.
- IAMAI has the complete canonical target exclusion set for this policy.
- For any existing policy mutation, IAMAI has the stable resolved policy ID.

### Human validation still required
- Before enforcement, verify **Entra ID > Devices > Overview > Device settings > Require multifactor authentication to register or join devices with Microsoft Entra** is set to **No**. Microsoft documents that the Conditional Access user-action policy is not properly enforced otherwise.
- Validate the tenant's actual device-registration and enrollment workflows before enforcement. Windows Configuration Designer bulk enrollment uses a `package_{GUID}` account and Microsoft documents that MFA is unsupported for that flow unless the tenant deliberately handles the exception.
- If affected users use external authentication methods, resolve that workflow before enforcement. Microsoft currently documents external authentication methods as incompatible with authentication strength for this policy pattern.

### Owner decision required only if encountered
If a required enrollment workflow cannot satisfy the pinned target and no already-approved exclusion covers it, do not invent a new exclusion. The exception or workflow change is an owner/security decision.

## Owner decisions
- The build pins Jon Hope's baseline at `90d9b890c4b9af2ac4bc02d97c06bf8900064b4c`, and this package is authored against it. It was re-authored on 2026-09-11 from `8461e0f2fd10167bf034e7c20ed8ea293827d890`, where the member required the built-in Multifactor authentication strength.
- The member now requires the author's custom strength. Its ID belongs to the author's tenant, so the package binds IAMAI's resolved tenant strength (`authStrength.target.id`, named by `authStrength.target.displayName`) and never names the source ID. Where the tenant has no strength for the requirement, the preparation step that creates one comes first.
- The re-pinned member excludes one more source group. IAMAI asks the owner what it stands for, and `policy.target.excludeGroups` carries the answer.

## Current-state inputs
IAMAI may supply only existing facts it already knows:
- `policy.target.displayName`
- `policy.target.excludeGroups`
- `authStrength.target.id`
- `authStrength.target.displayName`
- `policy.current.id`
- `policy.current.displayName`
- `policy.current.state`
- `policy.current.semanticMismatches`
- `people.affected.count`
- `evidence.deviceRegistration`
- `evidence.enrollmentWorkflows`
- `dependencies.blockers`

Human checks above remain human checks; this package does not create new tenant reads for them.

## Target state
The canonical Conditional Access policy is:
- Population: **All users**.
- Exclusions: exactly IAMAI's canonical resolved exclusion set for this pinned member.
- Target resources: no cloud applications; **User actions > Register or join devices** only.
- Graph user-action value: `urn:user:registerdevice`.
- Client app types in Graph: `all`, because `clientAppTypes` is a required condition-set field. This is not an instruction to configure the unavailable Client apps condition in the portal.
- Sign-in risk: none.
- User risk: none.
- Locations: none.
- Device platforms: none.
- Device filters/device state: none.
- Authentication flows: none.
- Grant: **Grant access > Require authentication strength >** this tenant's strength for the requirement (`authStrength.target.displayName`).
- Authentication strength ID: IAMAI's resolved `authStrength.target.id`.
- Session controls: none.
- Create/correct lifecycle: **Report-only**.
- Enforced lifecycle: **On** only after enrollment validation and the mandatory legacy device-MFA setting check.

## Security-significant fields
The following must agree across Entra, Graph JSON, and PowerShell:
- `conditions.users.includeUsers = ["All"]`
- `conditions.users.excludeGroups =` IAMAI's canonical target exclusion IDs
- `conditions.applications.includeApplications = []`
- `conditions.applications.excludeApplications = []`
- `conditions.applications.includeUserActions = ["urn:user:registerdevice"]`
- `conditions.clientAppTypes = ["all"]`
- `conditions.signInRiskLevels = []`
- `conditions.userRiskLevels = []`
- no location, platform, device/filter, authentication-flow, or other noncanonical condition
- `grantControls.operator = "OR"`
- `grantControls.authenticationStrength.id =` IAMAI's resolved tenant strength ID
- no simultaneous `mfa` built-in grant
- no session controls
- `state = "enabledForReportingButNotEnforced"` before enforcement; `state = "enabled"` only for the Enforce transition

### Graph correction boundary
Condition-related mismatches share one canonical `json.correct.conditions` block in `CONTENT.md`. That block sends the complete canonical `conditions` object, including explicit null/empty values for noncanonical optional conditions, so IAMAI does not depend on partial nested-object update behavior to remove an unsupported condition. Grant and lifecycle corrections use separate, smaller PATCH bodies.

## Preserve
- Preserve the same resolved Conditional Access policy object by stable ID during correction and enforcement.
- Preserve the complete IAMAI-resolved canonical exclusion set.
- Preserve unrelated root-level policy properties that IAMAI is not intentionally changing during a PATCH.
- Preserve already-correct fields in the Entra correction view; show only the detected mismatch modules.

## Do not do
- Do not create a second policy when IAMAI has a safe correction target.
- Do not update an existing policy by display name alone.
- Do not add a location restriction because the historical pinned display name says "trusted location"; the retained pinned object has no location condition. Current Microsoft documentation specifically marks Client apps, Filters for devices, and Device state conditions unavailable for this User Action; other conditions remain absent here because they are not part of the retained pinned target.
- Do not add Client apps, device-state, or device-filter conditions to this User Action policy.
- Do not configure both the MFA built-in grant and authentication strength in the same policy.
- Do not substitute the built-in Multifactor authentication strength, or any strength that allows password-based methods, for the resolved tenant strength.
- Do not treat an empty Report-only log as evidence that device registration is safe to enforce.
- Do not create a guessed exclusion for Windows bulk enrollment or another enrollment workflow.
- Do not delete the existing policy as a troubleshooting first step.

## State variants

### Missing / Create
Create one canonical policy in **Report-only**. Use the resolved policy name and resolved exclusion IDs. Do not change the tenant-wide device-registration MFA setting merely to create the Report-only policy.

### Partial / Correct
IAMAI composes only detected semantic correction modules:
- `users.include-all`
- `users.exclusions-canonical`
- `target.register-or-join-devices`
- `conditions.remove-noncanonical`
- `grant.authentication-strength`
- `lifecycle.report-only`

For Graph/PowerShell, the first four modules share the full canonical conditions mutation because that is the safe API boundary; the Entra blocks remain atomic so the administrator sees only the work that is actually wrong.

### Report-only / Observe
Do not recreate the policy. Verify the resolved policy object by stable ID and finish the human workflow checks. Microsoft explicitly excludes User Actions from Report-only evaluation, so Report-only itself does not prove this control's effect.

### Ready to enforce
Before changing the lifecycle state:
1. Complete the enrollment-workflow validation.
2. Resolve any external-authentication-method incompatibility affecting the population.
3. Set the tenant-wide legacy device-registration MFA toggle to **No** if it is not already No.
4. Change only the resolved policy's lifecycle from Report-only to **On**.
5. Perform a controlled device registration/join test and rescan IAMAI.

## Verification
After Create or Correct:
- Read the Conditional Access policy back by stable ID.
- Confirm the canonical user scope, exclusions, `urn:user:registerdevice` target, absence of noncanonical conditions, the resolved tenant authentication strength ID, no session controls, and Report-only lifecycle.
- Rescan IAMAI and confirm the same policy ID is now classified at the expected next state.

During Report-only:
- Verify configuration correctness by object read-back.
- Use actual device-registration/enrollment workflow evidence; do not substitute Report-only logs for User Action proof.

After Enforce:
- Confirm the policy state is `enabled` by stable-ID read-back.
- Confirm the legacy tenant-wide device-registration MFA toggle is **No**.
- Test a controlled, in-scope device registration or join with a user capable of the required MFA strength.
- Test each identified enrollment workflow that could be affected.
- Rescan IAMAI and verify the same policy ID reaches `inPlace` only when its canonical semantics are present.

## Rollback / safe recovery
If device registration or an enrollment workflow fails unexpectedly after enforcement:
1. Change the same policy back to **Report-only** by stable ID.
2. If the tenant-wide legacy device-registration MFA setting was changed from **Yes** to **No** as part of this rollout, restore its prior value while the Conditional Access policy is non-enforcing, unless doing so would conflict with an already-approved tenant change.
3. Re-test the failing workflow in the last known safe state.
4. Identify whether the failure is authentication-strength capability, a bulk-enrollment `package_{GUID}` flow, external authentication, or a different tenant-specific dependency.
5. Resolve that specific issue; do not weaken the pinned target or create a duplicate policy.

## Limitations / unknowns
- IAMAI's supplied workbook inputs do not establish the current value of the tenant-wide legacy device-registration MFA setting; it remains a human pre-enforcement check.
- IAMAI cannot infer unobserved enrollment workflows from silence. Missing evidence is `Unknown`, not proof of non-use.
- Report-only does not evaluate Conditional Access policies scoped to User Actions.
- Windows Configuration Designer bulk enrollment cannot satisfy MFA in its `package_{GUID}` flow as normally configured; an exception/workflow decision may be required when the tenant uses it.
- External authentication methods are currently documented as incompatible with authentication strength for this policy pattern.
- Windows Hello for Business and device-bound passkeys cannot be used to satisfy this User Action at the point where the device must first be registered.

## Source verification
Microsoft sources were rechecked on 2026-09-10. The package was re-authored against the build's pin on 2026-09-11; the Microsoft behaviour it relies on did not change with the pin. The primary administrator reference is **Require multifactor authentication for device registration**. Supporting sources cover User Action limitations, Report-only behavior, device settings, Windows bulk enrollment, Conditional Access licensing, Microsoft Graph v1.0 policy/condition/grant schemas and create/update/read endpoints, authentication strengths, Graph PowerShell, and authentication-strength troubleshooting. See `META.json` for the complete source log and user-facing reference classifications.

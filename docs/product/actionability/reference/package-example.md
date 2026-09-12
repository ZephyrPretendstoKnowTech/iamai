# Package example: `s-goal-device-registration-mfa`

A worked example of one implementation-content package, taken verbatim from the repository on 2026-09-12 (HEAD `4cde3e6`): its source files, its manifest entry, what the compiler made of it, and the `pages.plan` words the Plan page and an opened step show around it.

## Sources

- `docs/implementation-content/s-goal-device-registration-mfa/CONTENT.md`
- `docs/implementation-content/s-goal-device-registration-mfa/META.json`
- `docs/implementation-content/s-goal-device-registration-mfa/STEP.md`
- `docs/implementation-content/LIBRARY.json`
- `src/content/implementation/registry.generated.json`
- `docs/design/content.json`  (the `pages.plan` subtree only)
- `src/content/content.ts`
- `src/ui/surfaces/Plan.tsx`
- `src/ui/surfaces/PlanFooter.tsx`
- `src/ui/surfaces/planBoard.ts`
- `src/ui/surfaces/planRows.ts`
- `src/ui/surfaces/planLanes.ts`
- `src/ui/surfaces/ContentStep.tsx`
- `src/ui/surfaces/StepSections.tsx`
- `src/ui/surfaces/stepContract.ts`
- `src/ui/surfaces/stepPackage.ts`
- `src/ui/surfaces/CleanupStep.tsx`
- `src/ui/surfaces/cleanupExport.ts`
- `src/ui/surfaces/rowWhen.ts`
- `src/ui/surfaces/rowWho.ts`
- `src/ui/surfaces/baselineMappings.ts`
- `src/ui/surfaces/BaselineMappings.tsx`
- `src/ui/surfaces/PrintPlan.tsx`
- `src/derive/planHeader.ts`
- `src/derive/whoLine.ts`
- `src/derive/notLicensed.ts`
- `src/copy/reasons.ts`
- `src/roadmap/answers.ts`
- `src/content/render.ts`
- `src/content/content.test.ts`
- `docs/product/actionability/pinned-refs.tsv`  (searched only, to confirm where the member id comes from)
- `baselines/jhope188-conditionalaccesspolicies.pinned.json`  (searched only, same purpose)

### About the identifiers

Nothing was redacted. The package holds two GUIDs, and neither comes from a customer tenant:

- `00000000-0000-0000-0000-000000000002` is Microsoft's built-in "Multifactor authentication" authentication strength.
- `aeb49474-5250-4b65-8b0a-56c47127ee0f` is the stable id of a policy in the pinned public baseline (Jon Hope's repository, pin `90d9b890`). The repo already commits it in `baselines/jhope188-conditionalaccesspolicies.pinned.json` and `docs/product/actionability/pinned-refs.tsv`.

The package has no UPNs, email addresses or tenant domains. The one tenant-specific id the member uses, the author's custom authentication strength, is not in the package. It binds `authStrength.target.id` instead.

## 1. Package source

The directory `docs/implementation-content/s-goal-device-registration-mfa/` holds 3 files. None contains a triple backtick, so each is fenced with three backticks.

### `docs/implementation-content/s-goal-device-registration-mfa/CONTENT.md`

```markdown
# IAMAI Compact Content — Require MFA to Register a Device

This file is authored source. Render/extract only blocks selected by `META.json`. Do not select content by Markdown heading text.

@@IAMAI-BEGIN {"id":"entra.create","channel":"entra","states":["missing"],"format":"markdown","kind":"template"}
# Create the policy in Report-only

IAMAI will supply the resolved policy name and canonical exclusion set.

1. Go to **Microsoft Entra admin center > Entra ID > Conditional Access > Policies**.
2. Select **New policy** and enter the IAMAI-resolved policy name.
3. Under **Users or workload identities**, include **All users** and exclude exactly the IAMAI-resolved canonical exclusions.
4. Under **Target resources**, select **User actions > Register or join devices**. Do not select cloud applications.
5. Under **Grant**, select **Grant access > Require authentication strength > {{authStrength.target.displayName}}**, the authentication strength IAMAI resolved for this policy. Select it by that name; do not select a similar or weaker strength in its place.
6. Leave noncanonical conditions unset. Microsoft makes **Client apps**, **Filters for devices**, and **Device state** unavailable for this User Action; the pinned member also sets no device-platform, location, risk, or authentication-flow conditions.
7. Set **Enable policy** to **Report-only**.
8. Create the policy.
9. Rescan IAMAI. Do not treat Report-only as rollout proof for this User Action; complete the enrollment-workflow checks before enforcement.

Done when IAMAI rescans the newly created policy and finds the canonical scope, exclusions, the resolved authentication strength, and Report-only lifecycle.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"entra.correct.open","channel":"entra","states":["partial"],"format":"markdown","kind":"template","moduleRole":"sharedBefore"}
# Correct this policy

Open the exact Conditional Access policy IAMAI identified. Use its stable policy identity; do not find an update target by fuzzy display-name matching.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"entra.correct.users.include-all","channel":"entra","states":["partial"],"format":"markdown","kind":"template","moduleRole":"mismatch"}
# Correct the included population

Under **Users or workload identities > Include**, set the population to **All users**. Leave the IAMAI-resolved canonical exclusions unchanged.

Done when IAMAI reads the same policy ID and finds **All users** included.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"entra.correct.users.exclusions-canonical","channel":"entra","states":["partial"],"format":"markdown","kind":"template","moduleRole":"mismatch"}
# Correct the exclusions

Under **Users or workload identities > Exclude**, make the exclusion set match IAMAI's canonical resolved exclusions exactly. Leave the **Register or join devices** target and already-correct grant unchanged.

Do not add a new enrollment exception unless IAMAI already has an owner-approved canonical exclusion for it.

Done when IAMAI reads the same policy ID and finds the canonical exclusion set.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"entra.correct.target.register-or-join-devices","channel":"entra","states":["partial"],"format":"markdown","kind":"template","moduleRole":"mismatch"}
# Correct the target

Under **Target resources**, select **User actions > Register or join devices** and remove any cloud-application target from this policy. Preserve the canonical user scope, exclusions, and already-correct grant.

Done when IAMAI reads the same policy ID and finds only the **Register or join devices** User Action target.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"entra.correct.conditions.remove-noncanonical","channel":"entra","states":["partial"],"format":"markdown","kind":"template","moduleRole":"mismatch"}
# Remove noncanonical conditions

Remove only the condition(s) IAMAI identified as noncanonical for this User Action, such as location, device platform, device filter/device state, Client apps, risk, or authentication-flow conditions. Leave the canonical User Action, population/exclusions, and already-correct grant unchanged.

Microsoft does not make Client apps, Filters for devices, or Device state conditions available for **Register or join devices**. Do not replace a removed condition with another condition to recreate the same restriction.

Done when IAMAI reads the same policy ID and no longer finds the noncanonical condition.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"entra.correct.grant.authentication-strength","channel":"entra","states":["partial"],"format":"markdown","kind":"template","moduleRole":"mismatch"}
# Correct the grant

Under **Grant**, select **Grant access > Require authentication strength > {{authStrength.target.displayName}}**. Remove a simultaneous **Require multifactor authentication** built-in grant if present. Leave the canonical User Action, population, and exclusions unchanged.

**{{authStrength.target.displayName}}** is the authentication strength IAMAI resolved for this policy. Do not select a different or weaker strength in its place.

Done when IAMAI reads the same policy ID and finds the resolved authentication strength.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"entra.correct.lifecycle.report-only","channel":"entra","states":["partial"],"format":"markdown","kind":"template","moduleRole":"mismatch"}
# Return the policy to Report-only

Set **Enable policy** to **Report-only** before applying semantic corrections. Do not leave a semantically incorrect policy enforcing while its scope or grant is being corrected.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"entra.correct.save-verify","channel":"entra","states":["partial"],"format":"markdown","kind":"template","moduleRole":"sharedAfter"}
# Save and verify

Keep the policy **Report-only** while corrections are being made. Save, then rescan IAMAI.

Done when IAMAI reads the same policy ID and the selected semantic mismatch(es) are cleared.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"entra.observe","channel":"entra","states":["reportOnly"],"format":"markdown","kind":"template"}
# Validate before enforcement

The resolved policy is already in **Report-only**. Do not recreate it.

1. Use IAMAI's current evidence to identify known device-registration and enrollment workflows that still need validation.
2. Use IAMAI's MFA Readiness evidence to identify affected users who cannot currently satisfy MFA; do not expect Report-only User Action telemetry to prove this.
3. Validate known enrollment workflows directly where practical, including Windows Configuration Designer bulk enrollment when it is used.
4. Record any workflow that needs an approved exclusion or a different enrollment method as unresolved; do not invent the exception here.
5. Rescan IAMAI after the evidence or owner decision changes.

Microsoft does **not** evaluate User Action policies in Report-only mode. An empty or quiet Report-only result does not prove this policy is safe to enforce.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"entra.enforce","channel":"entra","states":["readyToEnforce"],"format":"markdown","kind":"template"}
# Enforce the resolved policy

Before this transition, enrollment-workflow validation must be complete and any external-authentication-method incompatibility must be resolved.

1. Go to **Microsoft Entra admin center > Entra ID > Devices > Overview > Device settings**.
2. Confirm **Require multifactor authentication to register or join devices with Microsoft Entra** is **No**. If it is Yes, set it to No as part of this controlled enforcement change.
3. Go to **Entra ID > Conditional Access > Policies** and open the exact IAMAI-resolved policy.
4. Set **Enable policy** from **Report-only** to **On**. Do not change scope, exclusions, User Action, or grant.
5. Save the policy.
6. Perform the controlled device registration/join test and the identified enrollment-workflow tests.
7. Rescan IAMAI.

If a required enrollment workflow fails, return the same policy to **Report-only** and restore the prior tenant-wide device-registration MFA setting if this rollout changed it from Yes to No.

Done when the same policy ID is On, the legacy device-registration MFA toggle is No, controlled registration succeeds with the required MFA strength, required enrollment workflows pass, and IAMAI rescans the policy as in place.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"json.create","channel":"json","states":["missing"],"format":"json-template","kind":"deployableAfterBinding","method":"POST","endpoint":"/identity/conditionalAccess/policies"}
{
  "displayName": {{json:policy.target.displayName}},
  "state": "enabledForReportingButNotEnforced",
  "conditions": {
    "users": {
      "includeUsers": ["All"],
      "excludeUsers": [],
      "includeGroups": [],
      "excludeGroups": {{json:policy.target.excludeGroups}},
      "includeRoles": [],
      "excludeRoles": []
    },
    "applications": {
      "includeApplications": [],
      "excludeApplications": [],
      "includeUserActions": ["urn:user:registerdevice"]
    },
    "clientAppTypes": ["all"],
    "signInRiskLevels": [],
    "userRiskLevels": [],
    "servicePrincipalRiskLevels": []
  },
  "grantControls": {
    "operator": "OR",
    "builtInControls": [],
    "customAuthenticationFactors": [],
    "termsOfUse": [],
    "authenticationStrength": {
      "id": {{json:authStrength.target.id}}
    }
  }
}
@@IAMAI-END

@@IAMAI-BEGIN {"id":"json.correct.conditions","channel":"json","states":["partial"],"format":"json-template","kind":"deployableAfterBinding","method":"PATCH","endpoint":"/identity/conditionalAccess/policies/{policy.current.id}"}
{
  "conditions": {
    "users": {
      "includeUsers": ["All"],
      "excludeUsers": [],
      "includeGroups": [],
      "excludeGroups": {{json:policy.target.excludeGroups}},
      "includeRoles": [],
      "excludeRoles": []
    },
    "applications": {
      "includeApplications": [],
      "excludeApplications": [],
      "includeUserActions": ["urn:user:registerdevice"],
      "applicationFilter": null
    },
    "clientAppTypes": ["all"],
    "signInRiskLevels": [],
    "userRiskLevels": [],
    "servicePrincipalRiskLevels": [],
    "locations": null,
    "platforms": null,
    "devices": null,
    "authenticationFlows": null,
    "insiderRiskLevels": null
  }
}
@@IAMAI-END

@@IAMAI-BEGIN {"id":"json.correct.grant","channel":"json","states":["partial"],"format":"json-template","kind":"deployableAfterBinding","method":"PATCH","endpoint":"/identity/conditionalAccess/policies/{policy.current.id}"}
{
  "grantControls": {
    "operator": "OR",
    "builtInControls": [],
    "customAuthenticationFactors": [],
    "termsOfUse": [],
    "authenticationStrength": {
      "id": {{json:authStrength.target.id}}
    }
  }
}
@@IAMAI-END

@@IAMAI-BEGIN {"id":"json.correct.report-only","channel":"json","states":["partial"],"format":"json","kind":"deployableAfterBinding","method":"PATCH","endpoint":"/identity/conditionalAccess/policies/{policy.current.id}"}
{
  "state": "enabledForReportingButNotEnforced"
}
@@IAMAI-END

@@IAMAI-BEGIN {"id":"json.enforce","channel":"json","states":["readyToEnforce"],"format":"json","kind":"deployableAfterBinding","method":"PATCH","endpoint":"/identity/conditionalAccess/policies/{policy.current.id}"}
{
  "state": "enabled"
}
@@IAMAI-END

@@IAMAI-BEGIN {"id":"powershell.run","channel":"powershell","states":["missing","partial","reportOnly","readyToEnforce"],"format":"powershell","kind":"deployableAfterBinding","invocation":{"modeParameter":"Mode","correctionsParameter":"Corrections","parameters":{"PolicyDisplayName":{"binding":"policy.target.displayName","modes":["Create"]},"PolicyId":{"binding":"policy.current.id","modes":["Correct","Verify","Enforce"]},"ExcludeGroupIds":{"binding":"policy.target.excludeGroups","modes":["Create","Correct","Verify","Enforce"]},"AuthenticationStrengthId":{"binding":"authStrength.target.id","modes":["Create","Correct","Verify","Enforce"]},"LegacyDeviceMfaToggleConfirmedNo":{"switch":true,"prerequisite":"legacy-device-mfa-toggle","modes":["Enforce"]},"EnrollmentWorkflowsValidated":{"switch":true,"prerequisite":"enrollment-workflows","modes":["Enforce"]},"ExternalAuthenticationCompatibilityResolved":{"switch":true,"prerequisite":"external-auth-methods","modes":["Enforce"]}}}}
# IAMAI compact implementation script — Require MFA to Register a Device
# Required module: Microsoft.Graph.Authentication
# Create/Correct/Enforce delegated scopes: Policy.Read.All, Policy.ReadWrite.ConditionalAccess
# Verify delegated scope: Policy.Read.All
# Mutation role: Conditional Access Administrator or Security Administrator

[CmdletBinding()]
param(
    [Parameter(Mandatory)]
    [ValidateSet('Create','Correct','Verify','Enforce')]
    [string] $Mode,

    [string] $PolicyDisplayName,
    [ValidatePattern('^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$')]
    [string] $PolicyId,
    [string[]] $ExcludeGroupIds,
    [ValidatePattern('^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$')]
    [string] $AuthenticationStrengthId,

    [ValidateSet('Conditions','Grant','ReportOnly')]
    [string[]] $Corrections,

    [switch] $LegacyDeviceMfaToggleConfirmedNo,
    [switch] $EnrollmentWorkflowsValidated,
    [switch] $ExternalAuthenticationCompatibilityResolved
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
if ([string]::IsNullOrWhiteSpace($AuthenticationStrengthId)) { throw 'IAMAI must supply the resolved authentication strength ID.' }
$StrengthId = $AuthenticationStrengthId
$BaseUri = 'https://graph.microsoft.com/v1.0/identity/conditionalAccess/policies'
$GuidPattern = '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'

function Assert-ExcludeIds {
    param([string[]] $Ids)
    if (-not $Ids -or $Ids.Count -lt 1) { throw 'IAMAI must supply the complete canonical exclusion group ID set.' }
    $invalid = @($Ids | Where-Object { $_ -notmatch $GuidPattern })
    if ($invalid.Count -gt 0) { throw 'One or more exclusion group IDs are invalid.' }
}

function Connect-IAMAIContext {
    param([string[]] $Scopes)
    Import-Module Microsoft.Graph.Authentication -ErrorAction Stop
    $context = Get-MgContext
    $missing = if ($context) { @($Scopes | Where-Object { $_ -notin @($context.Scopes) }) } else { @($Scopes) }
    if (-not $context -or $missing.Count -gt 0) {
        Connect-MgGraph -Scopes $Scopes -NoWelcome
    }
}

function Get-PolicyById {
    param([string] $Id)
    if (-not $Id) { throw 'This mode requires the IAMAI-resolved stable policy ID.' }
    $p = Invoke-MgGraphRequest -Method GET -Uri "$BaseUri/$Id"
    if (-not $p.id -or $p.id -ne $Id) { throw 'Stable-ID policy read-back failed.' }
    return $p
}

function Assert-CanonicalPolicy {
    param(
        $Policy,
        [string[]] $ExpectedExcludeGroupIds,
        [ValidateSet('enabledForReportingButNotEnforced','enabled')]
        [string] $ExpectedState
    )
    Assert-ExcludeIds $ExpectedExcludeGroupIds
    $errors = [System.Collections.Generic.List[string]]::new()
    if ($Policy.state -ne $ExpectedState) { $errors.Add("Policy state is '$($Policy.state)', expected '$ExpectedState'.") }
    if (@($Policy.conditions.users.includeUsers).Count -ne 1 -or @($Policy.conditions.users.includeUsers)[0] -ne 'All') { $errors.Add('Included users are not exactly All.') }
    if ((@($Policy.conditions.users.excludeGroups | Sort-Object) -join '|') -ne (@($ExpectedExcludeGroupIds | Sort-Object) -join '|')) { $errors.Add('Exclusion group set differs from IAMAI canonical target.') }
    if (@($Policy.conditions.applications.includeUserActions).Count -ne 1 -or @($Policy.conditions.applications.includeUserActions)[0] -ne 'urn:user:registerdevice') { $errors.Add('User Action is not urn:user:registerdevice.') }
    if (@($Policy.conditions.applications.includeApplications).Count -ne 0 -or @($Policy.conditions.applications.excludeApplications).Count -ne 0) { $errors.Add('Cloud application scope is present.') }
    if (@($Policy.conditions.clientAppTypes).Count -ne 1 -or @($Policy.conditions.clientAppTypes)[0] -ne 'all') { $errors.Add('clientAppTypes differs from canonical Graph representation.') }
    if (@($Policy.conditions.signInRiskLevels).Count -ne 0 -or @($Policy.conditions.userRiskLevels).Count -ne 0 -or @($Policy.conditions.servicePrincipalRiskLevels).Count -ne 0) { $errors.Add('A noncanonical risk condition is present.') }
    foreach ($name in @('locations','platforms','devices','authenticationFlows','insiderRiskLevels')) {
        if ($null -ne $Policy.conditions.$name) { $errors.Add("Noncanonical condition is present: $name") }
    }
    if ($Policy.grantControls.authenticationStrength.id -ne $StrengthId) { $errors.Add('Authentication strength differs from the IAMAI-resolved strength.') }
    if (@($Policy.grantControls.builtInControls).Count -ne 0) { $errors.Add('A built-in grant is present in addition to authentication strength.') }
    if ($null -ne $Policy.sessionControls) { $errors.Add('Session controls are present.') }
    if ($errors.Count -gt 0) {
        $errors | ForEach-Object { Write-Error $_ }
        throw 'Canonical policy verification failed.'
    }
}

switch ($Mode) {
    'Create' {
        if ([string]::IsNullOrWhiteSpace($PolicyDisplayName)) { throw 'Create requires PolicyDisplayName.' }
        Assert-ExcludeIds $ExcludeGroupIds
        Connect-IAMAIContext @('Policy.Read.All','Policy.ReadWrite.ConditionalAccess')

        $escapedName = $PolicyDisplayName.Replace("'", "''")
        $encodedFilter = [uri]::EscapeDataString("displayName eq '$escapedName'")
        $matches = @((Invoke-MgGraphRequest -Method GET -Uri "$BaseUri?`$filter=$encodedFilter").value)
        if ($matches.Count -gt 0) { throw 'A Conditional Access policy already has this exact display name. Rescan IAMAI; do not create a duplicate.' }

        $body = @{
            displayName = $PolicyDisplayName
            state = 'enabledForReportingButNotEnforced'
            conditions = @{
                users = @{ includeUsers=@('All'); excludeUsers=@(); includeGroups=@(); excludeGroups=@($ExcludeGroupIds); includeRoles=@(); excludeRoles=@() }
                applications = @{ includeApplications=@(); excludeApplications=@(); includeUserActions=@('urn:user:registerdevice') }
                clientAppTypes=@('all'); signInRiskLevels=@(); userRiskLevels=@(); servicePrincipalRiskLevels=@()
            }
            grantControls = @{ operator='OR'; builtInControls=@(); customAuthenticationFactors=@(); termsOfUse=@(); authenticationStrength=@{id=$StrengthId} }
        }
        $created = Invoke-MgGraphRequest -Method POST -Uri $BaseUri -Body ($body | ConvertTo-Json -Depth 20) -ContentType 'application/json'
        if (-not $created.id) { throw 'Microsoft Graph did not return a policy ID.' }
        $after = Get-PolicyById $created.id
        Assert-CanonicalPolicy -Policy $after -ExpectedExcludeGroupIds $ExcludeGroupIds -ExpectedState 'enabledForReportingButNotEnforced'
        Write-Host "Created policy ID $($created.id) in Report-only. Rescan IAMAI."
    }

    'Correct' {
        if (-not $Corrections -or $Corrections.Count -lt 1) { throw 'Correct requires at least one Corrections value.' }
        if ($Corrections -contains 'Conditions') { Assert-ExcludeIds $ExcludeGroupIds }
        Connect-IAMAIContext @('Policy.Read.All','Policy.ReadWrite.ConditionalAccess')
        $current = Get-PolicyById $PolicyId
        $body = @{}

        if ($Corrections -contains 'Conditions') {
            $body.conditions = @{
                users = @{ includeUsers=@('All'); excludeUsers=@(); includeGroups=@(); excludeGroups=@($ExcludeGroupIds); includeRoles=@(); excludeRoles=@() }
                applications = @{ includeApplications=@(); excludeApplications=@(); includeUserActions=@('urn:user:registerdevice'); applicationFilter=$null }
                clientAppTypes=@('all'); signInRiskLevels=@(); userRiskLevels=@(); servicePrincipalRiskLevels=@()
                locations=$null; platforms=$null; devices=$null; authenticationFlows=$null; insiderRiskLevels=$null
            }
        }
        if ($Corrections -contains 'Grant') {
            $body.grantControls = @{ operator='OR'; builtInControls=@(); customAuthenticationFactors=@(); termsOfUse=@(); authenticationStrength=@{id=$StrengthId} }
        }
        if ($Corrections -contains 'ReportOnly') {
            $body.state = 'enabledForReportingButNotEnforced'
        }

        Invoke-MgGraphRequest -Method PATCH -Uri "$BaseUri/$PolicyId" -Body ($body | ConvertTo-Json -Depth 20) -ContentType 'application/json' | Out-Null
        $after = Get-PolicyById $PolicyId
        if ($Corrections -contains 'Conditions') {
            if (@($after.conditions.users.includeUsers).Count -ne 1 -or @($after.conditions.users.includeUsers)[0] -ne 'All') { throw 'Verification failed: All users is not canonical.' }
            if ((@($after.conditions.users.excludeGroups | Sort-Object) -join '|') -ne (@($ExcludeGroupIds | Sort-Object) -join '|')) { throw 'Verification failed: exclusions differ from canonical target.' }
            if (@($after.conditions.applications.includeUserActions).Count -ne 1 -or @($after.conditions.applications.includeUserActions)[0] -ne 'urn:user:registerdevice') { throw 'Verification failed: User Action target differs.' }
        }
        if ($Corrections -contains 'Grant' -and $after.grantControls.authenticationStrength.id -ne $StrengthId) { throw 'Verification failed: authentication strength differs.' }
        if ($Corrections -contains 'ReportOnly' -and $after.state -ne 'enabledForReportingButNotEnforced') { throw 'Verification failed: policy is not Report-only.' }
        Write-Host "Correction verified on policy ID $PolicyId. Rescan IAMAI."
    }

    'Verify' {
        Assert-ExcludeIds $ExcludeGroupIds
        Connect-IAMAIContext @('Policy.Read.All')
        $p = Get-PolicyById $PolicyId
        Assert-CanonicalPolicy -Policy $p -ExpectedExcludeGroupIds $ExcludeGroupIds -ExpectedState 'enabledForReportingButNotEnforced'
        Write-Host 'Canonical Report-only configuration verified. User Actions are not evaluated by Report-only; complete direct workflow validation before enforcement.'
    }

    'Enforce' {
        if (-not $LegacyDeviceMfaToggleConfirmedNo) { throw 'Enforcement stopped: confirm the legacy device-registration MFA toggle is No.' }
        if (-not $EnrollmentWorkflowsValidated) { throw 'Enforcement stopped: enrollment workflows are not validated.' }
        if (-not $ExternalAuthenticationCompatibilityResolved) { throw 'Enforcement stopped: external-authentication-method compatibility is unresolved.' }
        Assert-ExcludeIds $ExcludeGroupIds
        Connect-IAMAIContext @('Policy.Read.All','Policy.ReadWrite.ConditionalAccess')
        $current = Get-PolicyById $PolicyId
        Assert-CanonicalPolicy -Policy $current -ExpectedExcludeGroupIds $ExcludeGroupIds -ExpectedState 'enabledForReportingButNotEnforced'
        Invoke-MgGraphRequest -Method PATCH -Uri "$BaseUri/$PolicyId" -Body (@{state='enabled'} | ConvertTo-Json) -ContentType 'application/json' | Out-Null
        $after = Get-PolicyById $PolicyId
        Assert-CanonicalPolicy -Policy $after -ExpectedExcludeGroupIds $ExcludeGroupIds -ExpectedState 'enabled'
        Write-Host "Policy ID $PolicyId is enabled. Perform controlled registration/enrollment tests and rescan IAMAI."
    }
}
@@IAMAI-END

@@IAMAI-BEGIN {"id":"ai.create","channel":"aiInfo","states":["missing"],"format":"markdown","kind":"template"}
ROLE
You are helping implement one IAMAI Plan step. Do not redesign the baseline or infer new tenant facts.

GOAL
Create the Conditional Access policy that requires the pinned MFA authentication strength for Microsoft Entra device registration/join, initially in Report-only.

AUTHORITY
- IAMAI tenant/product facts and saved owner decisions own tenant-specific truth.
- The baseline IAMAI plans from owns the destination for this step.
- The authentication strength this policy requires, as IAMAI resolved it for this tenant, is {{authStrength.target.displayName}} (`{{authStrength.target.id}}`). Do not substitute a different or weaker strength.
- Current Microsoft documentation owns current portal/API behavior.

TENANT CONTEXT
- Tenant: {{tenant.displayName}} [omit this line when unavailable]
- Target policy name: {{policy.target.displayName}}
- Canonical exclusions: {{policy.target.excludeGroups}}
- Affected people count: {{people.affected.count}} [omit when unavailable]

TARGET STATE
All users; IAMAI-resolved canonical exclusions; User Action `urn:user:registerdevice`; no cloud-app, location, platform, device/filter, risk, or authentication-flow condition; the resolved authentication strength {{authStrength.target.displayName}}; no session controls; Report-only.

PREREQUISITES
The target name and exclusions above are the ones IAMAI resolved for this tenant. This text is complete only when every one of them is filled in; an exclusion still waiting on an answer about the baseline's own groups is not resolved yet, and the policy is not created until it is. Do not ask the administrator to rediscover resolved values. Enforcement has separate human checks for the legacy device-registration MFA setting and enrollment workflows.

IMPLEMENTATION OPTIONS
Use only the Entra steps, the JSON request or the PowerShell script in Create mode that IAMAI shows for this step. Do not create a duplicate if a matching policy is discovered; rescan IAMAI instead.

DO NOT CHANGE
Do not add device state/filter, Client apps, location, or cloud-application scope. Do not change the resolved authentication strength.

VERIFICATION
Read back the created policy, confirm Report-only canonical semantics, then rescan IAMAI. Do not treat Report-only as proof for this User Action.

ROLLBACK / SAFE RECOVERY
If creation is wrong, keep the policy non-enforcing and correct the same object; do not turn it On while mismatches remain.

KNOWN UNKNOWNS
Report-only does not evaluate User Actions. Enrollment workflows that IAMAI has not observed remain unknown.

MICROSOFT REFERENCES
- Require multifactor authentication for device registration: https://learn.microsoft.com/en-us/entra/identity/conditional-access/policy-all-users-device-registration
- Conditional Access target resources: https://learn.microsoft.com/en-us/entra/identity/conditional-access/concept-conditional-access-cloud-apps
- Analyze Conditional Access policy impact: https://learn.microsoft.com/en-us/entra/identity/conditional-access/concept-conditional-access-report-only

YOUR ROLE
Return conclusions, checks, assumptions, evidence, and the smallest safe next action. If current Microsoft documentation conflicts with a supplied implementation detail, explain the conflict before recommending a change; do not silently replace IAMAI's approved target.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"ai.correct","channel":"aiInfo","states":["partial"],"format":"markdown","kind":"template"}
ROLE
Help correct only the semantic mismatch(es) IAMAI supplied for this exact policy. Do not reconfigure fields IAMAI already says are correct.

GOAL
Move the existing resolved policy to the canonical Report-only target without creating a duplicate.

AUTHORITY
- IAMAI tenant/product facts and saved owner decisions own tenant-specific truth.
- The baseline IAMAI plans from owns the destination for this step.
- The authentication strength this policy requires, as IAMAI resolved it for this tenant, is {{authStrength.target.displayName}} (`{{authStrength.target.id}}`). Do not substitute a different or weaker strength.
- Current Microsoft documentation owns current portal/API behavior.

TENANT CONTEXT
- Current policy ID: {{policy.current.id}}
- Current policy name: {{policy.current.displayName}} [omit when unavailable]
- Current state: {{policy.current.state}} [omit when unavailable]
- IAMAI mismatches: {{policy.current.semanticMismatches}}
- Canonical exclusions: {{policy.target.excludeGroups}}

TARGET STATE
All users; canonical exclusions; only `urn:user:registerdevice`; no noncanonical conditions; the resolved authentication strength {{authStrength.target.displayName}}; Report-only until enforcement readiness is proven.

IMPLEMENTATION OPTIONS
Use only the correction module(s) mapped by IAMAI to the supplied semantic mismatches. Condition-related Graph/PowerShell corrections intentionally reconstruct the full canonical conditions object; grant and lifecycle corrections use separate PATCH boundaries.

DO NOT CHANGE
Use `policy.current.id` as update identity. Do not create another policy, broaden exclusions, add unsupported device/location/client conditions, or substitute a weaker authentication strength.

VERIFICATION
Read the same policy ID back, verify the corrected semantic field(s), and rescan IAMAI.

ROLLBACK / SAFE RECOVERY
If a correction creates unexpected risk, return the same policy to Report-only before further changes.

MICROSOFT REFERENCES
- Update conditionalAccessPolicy: https://learn.microsoft.com/en-us/graph/api/conditionalaccesspolicy-update?view=graph-rest-1.0
- Conditional Access target resources: https://learn.microsoft.com/en-us/entra/identity/conditional-access/concept-conditional-access-cloud-apps

YOUR ROLE
Explain only the supplied mismatch(es), the safe correction, verification, and any blocker. Do not infer additional defects from raw tenant data.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"ai.observe","channel":"aiInfo","states":["reportOnly"],"format":"markdown","kind":"template"}
ROLE
Help validate this already-Report-only policy for enforcement readiness. Do not repeat Create or Correct unless IAMAI supplies a new mismatch.

GOAL
Collect the evidence that still matters because Microsoft does not evaluate User Action policies in Report-only.

AUTHORITY
- IAMAI tenant/product facts and saved owner decisions own tenant-specific truth.
- The baseline IAMAI plans from owns the destination for this step.
- The authentication strength this policy requires, as IAMAI resolved it for this tenant, is {{authStrength.target.displayName}} (`{{authStrength.target.id}}`). Do not substitute a different or weaker strength.
- Current Microsoft documentation owns current portal/API behavior.

TENANT CONTEXT
- Policy ID: {{policy.current.id}}
- Current device-registration evidence: {{evidence.deviceRegistration}} [omit when unavailable]
- Enrollment-workflow evidence: {{evidence.enrollmentWorkflows}} [omit when unavailable]
- Current blockers: {{dependencies.blockers}} [omit when unavailable]

CURRENT STATE
The policy is Report-only. Its configuration can be verified by object read-back, but Report-only logs do not prove the Register or join devices User Action.

PREREQUISITES
Identify and validate actual registration/enrollment workflows. If Windows Configuration Designer bulk enrollment is used, account for Microsoft's package_{GUID} MFA limitation through an already-approved exception or a deliberate workflow decision.

DO NOT CHANGE
Do not turn the policy On solely because report-only logs are quiet. Do not invent exclusions for an unvalidated workflow.

VERIFICATION
Use controlled workflow tests and IAMAI evidence; rescan after evidence changes.

MICROSOFT REFERENCES
- Analyze Conditional Access policy impact: https://learn.microsoft.com/en-us/entra/identity/conditional-access/concept-conditional-access-report-only
- Bulk enrollment for Windows devices: https://learn.microsoft.com/en-us/intune/intune-service/enrollment/windows-bulk-enroll

YOUR ROLE
Separate confirmed evidence from unknowns, identify the remaining human workflow validation, and state what would make enforcement safe.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"ai.enforce","channel":"aiInfo","states":["readyToEnforce"],"format":"markdown","kind":"template"}
ROLE
Help perform the final enforcement transition for the exact IAMAI-resolved policy. Do not redesign or broaden the policy.

GOAL
Change only the verified policy lifecycle from Report-only to On after all human enforcement gates pass.

AUTHORITY
- IAMAI tenant/product facts and saved owner decisions own tenant-specific truth.
- The baseline IAMAI plans from owns the destination for this step.
- The authentication strength this policy requires, as IAMAI resolved it for this tenant, is {{authStrength.target.displayName}} (`{{authStrength.target.id}}`). Do not substitute a different or weaker strength.
- Current Microsoft documentation owns current portal/API behavior.

TENANT CONTEXT
- Policy ID: {{policy.current.id}}
- Canonical exclusions: {{policy.target.excludeGroups}}
- Enrollment-workflow evidence: {{evidence.enrollmentWorkflows}} [omit when unavailable]

PREREQUISITES
- Enrollment workflows are validated or have owner-approved resolution.
- External-authentication-method compatibility is resolved for affected users.
- Human verification confirms the tenant-wide device-registration MFA toggle is No.

IMPLEMENTATION OPTIONS
Use only the Entra steps, the JSON request or the PowerShell script in Enforce mode that IAMAI shows for this step. The policy mutation is only `state: enabled`.

DO NOT CHANGE
Do not change users, exclusions, User Action, conditions, or grant during enforcement.

VERIFICATION
Read back the same stable policy ID, perform a controlled device registration/join test plus required enrollment workflow tests, and rescan IAMAI.

ROLLBACK / SAFE RECOVERY
If registration/enrollment fails unexpectedly, return the same policy to Report-only. If this rollout changed the legacy device-registration MFA toggle from Yes to No, restore its prior value while the CA policy is non-enforcing, then isolate the failure.

MICROSOFT REFERENCES
- Require multifactor authentication for device registration: https://learn.microsoft.com/en-us/entra/identity/conditional-access/policy-all-users-device-registration
- Manage device identities using the Microsoft Entra admin center: https://learn.microsoft.com/en-us/entra/identity/devices/manage-device-identities
- Troubleshoot Conditional Access authentication strengths: https://learn.microsoft.com/en-us/entra/identity/authentication/troubleshoot-authentication-strengths

YOUR ROLE
Give the smallest safe enforcement sequence, controlled validation, and recovery action. Do not recommend a different baseline strength or a duplicate policy.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"email.users.pre-enforcement","channel":"email","states":["readyToEnforce"],"format":"markdown","kind":"template","audience":"affected-users","communicationTrigger":"before-enforcement","purpose":"pre-change-notice"}
Subject: MFA will be required when adding or joining a device

Hi,

We’re preparing a security change for device registration. When you add or join a device to our organization, Microsoft may ask you to complete multifactor authentication before the device can be registered.

For most people, there is nothing to do ahead of time. If you are asked to verify your identity during device setup, follow the Microsoft sign-in prompt using your normal approved MFA method.

If you are setting up devices through a special enrollment or provisioning process, follow the instructions from IT instead of changing the setup yourself.

If device setup fails after the change, contact your normal IT support channel and tell them you were registering or joining a device.

Thanks,  
IT
@@IAMAI-END

@@IAMAI-BEGIN {"id":"readiness.model","channel":"readiness","states":["missing","partial","reportOnly","readyToEnforce","inPlace","blocked","needsDecision","sourceConflict","notLicensed"],"format":"json","kind":"sourceOnly"}
{
  "version": "1.0",
  "stepId": "s-goal-device-registration-mfa",
  "tiles": [
    {
      "id": "readiness.exclusions",
      "gate": "Exclusions",
      "gateKey": "exclusions",
      "sourceType": "tenant-evidence",
      "requiredInput": "policy.target.excludeGroups",
      "rules": [
        {
          "if": { "present": "policy.target.excludeGroups" },
          "when": "canonical exclusion set is resolved and nonempty",
          "result": "Ready",
          "line": "IAMAI has the canonical exclusions this policy must preserve."
        },
        {
          "if": { "absent": "policy.target.excludeGroups" },
          "when": "canonical exclusion set is unresolved",
          "result": "Blocked",
          "line": "Resolve the policy exclusions before creating or correcting it."
        }
      ]
    },
    {
      "id": "readiness.authentication-strength",
      "gate": "Authentication strength",
      "sourceType": "baseline-requirement",
      "rules": [
        {
          "if": { "present": "authStrength.target.id" },
          "when": "IAMAI resolved the strength this policy requires",
          "result": "Ready",
          "line": "IAMAI resolved the authentication strength this policy requires for this tenant."
        },
        {
          "if": { "absent": "authStrength.target.id" },
          "when": "no strength is resolved yet",
          "result": "Blocked",
          "line": "This tenant has no authentication strength for this policy's requirement yet. Create it before this policy."
        }
      ]
    },
    {
      "id": "readiness.enrollment-workflows",
      "gate": "Enrollment workflows",
      "sourceType": "tenant-evidence",
      "optionalInput": "evidence.enrollmentWorkflows",
      "confirms": ["enrollment-workflows"],
      "rules": [
        {
          "if": { "confirmed": "enrollment-workflows" },
          "when": "all known affected workflows have validated resolution",
          "result": "Ready",
          "line": "Known device-registration and enrollment workflows are validated."
        },
        {
          "if": { "present": "evidence.enrollmentWorkflows" },
          "when": "a known workflow is unvalidated or incompatible",
          "result": "Review required",
          "line": "Validate the identified registration/enrollment workflow before enforcement."
        },
        {
          "if": { "absent": "evidence.enrollmentWorkflows" },
          "when": "IAMAI has no usable workflow evidence",
          "result": "Unknown",
          "line": "IAMAI cannot prove unobserved enrollment workflows are safe."
        }
      ]
    },
    {
      "id": "readiness.enforcement-settings",
      "gate": "Enforcement checks",
      "sourceType": "microsoft-rule",
      "confirms": ["legacy-device-mfa-toggle", "external-auth-methods"],
      "rules": [
        {
          "if": { "all": [{ "state": ["missing", "partial", "reportOnly", "readyToEnforce"] }, { "not": { "all": [{ "confirmed": "legacy-device-mfa-toggle" }, { "confirmed": "external-auth-methods" }] } }] },
          "when": "state is missing, partial, or reportOnly",
          "result": "Review required",
          "line": "Before enforcement, confirm the legacy device-registration MFA toggle is No and resolve external-authentication-method compatibility."
        },
        {
          "if": { "all": [{ "confirmed": "legacy-device-mfa-toggle" }, { "confirmed": "external-auth-methods" }] },
          "when": "human enforcement checks are recorded complete by the existing workflow",
          "result": "Ready",
          "line": "Mandatory pre-enforcement checks are complete."
        }
      ]
    }
  ],
  "conclusions": {
    "safeToCreateOrCorrect": "Ready to create or correct in Report-only when canonical exclusions and stable identity requirements are resolved.",
    "safeToObserve": "Continue direct workflow validation; Report-only does not evaluate this User Action.",
    "safeToEnforce": "Enforce only after enrollment workflows pass, external-authentication compatibility is resolved, and the legacy device-registration MFA toggle is confirmed No."
  },
  "conclusionByState": {
    "missing": "safeToCreateOrCorrect",
    "partial": "safeToCreateOrCorrect",
    "reportOnly": "safeToObserve",
    "readyToEnforce": "safeToEnforce"
  },
  "whyIamAISaysThis": {
    "id": "why-iamai-says-this",
    "sections": {
      "currentConclusion": "Render the conclusion for the current state only.",
      "confirmed": [
        "Use tenant evidence for the resolved exclusions and the current policy, and the pinned member's required authentication strength, resolved to this tenant's own strength."
      ],
      "stillNeedsAttention": [
        "Render unresolved enrollment-workflow evidence and the mandatory human pre-enforcement checks only when applicable."
      ],
      "unknownCannotProve": [
        "Report-only cannot prove User Action impact; unobserved enrollment workflows remain unknown."
      ],
      "whyItMatters": "Enforcement can block device registration or break enrollment flows that cannot satisfy MFA.",
      "nextSafeAction": "Use the state-specific projection in META.json.",
      "readyWhen": "All state-specific blockers and human enforcement gates required for the next transition are complete.",
      "microsoftReferences": [
        "ms-device-registration",
        "ms-report-only",
        "ms-bulk-enrollment"
      ]
    }
  }
}
@@IAMAI-END

@@IAMAI-BEGIN {"id":"troubleshooting.model","channel":"troubleshooting","states":["missing","partial","reportOnly","readyToEnforce","inPlace"],"format":"json","kind":"sourceOnly"}
{
  "version": "1.0",
  "stepId": "s-goal-device-registration-mfa",
  "scenarios": [
    {
      "id": "policy-save-unsupported-condition",
      "classification": "documented",
      "title": "Policy won't save or the intended condition is unavailable",
      "channels": [
        "entra",
        "json",
        "powershell"
      ],
      "states": [
        "missing",
        "partial"
      ],
      "symptom": "The portal does not offer a condition for this User Action, or the policy/request cannot represent the intended combination.",
      "likelyCauses": [
        "Client apps, Filters for devices, or Device state was added to a Register or join devices User Action policy."
      ],
      "check": [
        "Compare the policy to the canonical User Action target and identify any noncanonical Client apps/device condition."
      ],
      "fix": [
        "Remove only the unsupported/noncanonical condition from the same resolved policy and keep the canonical User Action plus MFA authentication strength."
      ],
      "doNot": [
        "Do not create a duplicate policy or move the requirement to a different cloud-app target as a workaround."
      ],
      "then": [
        "Read the same policy ID back and rescan IAMAI."
      ],
      "sources": [
        "ms-target-resources"
      ]
    },
    {
      "id": "graph-permission-403",
      "classification": "documented",
      "title": "PowerShell or Graph returns 403",
      "channels": [
        "json",
        "powershell"
      ],
      "states": [
        "missing",
        "partial",
        "readyToEnforce"
      ],
      "symptom": "The Graph create or update request is forbidden.",
      "likelyCauses": [
        "The Graph session lacks Policy.Read.All plus Policy.ReadWrite.ConditionalAccess, or the delegated administrator lacks a supported role."
      ],
      "check": [
        "Inspect the Graph consented scopes and confirm the signed-in administrator is a Conditional Access Administrator or Security Administrator."
      ],
      "fix": [
        "Reconnect with only the documented Conditional Access permissions and use an account with the required role."
      ],
      "doNot": [
        "Do not grant broad directory write permissions merely to bypass the 403."
      ],
      "then": [
        "Retry the same stable-ID operation; do not create another policy."
      ],
      "sources": [
        "ms-graph-create",
        "ms-graph-update",
        "ms-powershell-request"
      ]
    },
    {
      "id": "authentication-strength-cannot-satisfy",
      "classification": "documented",
      "title": "A user cannot complete device registration after enforcement",
      "channels": [
        "entra",
        "aiInfo",
        "troubleshooting"
      ],
      "states": [
        "readyToEnforce",
        "inPlace"
      ],
      "symptom": "An in-scope user is blocked or cannot present an acceptable method during device registration/join.",
      "likelyCauses": [
        "The user has no registered and enabled method that satisfies the required authentication strength.",
        "The flow depends on an external authentication method, which Microsoft currently documents as incompatible with authentication strength in this policy pattern."
      ],
      "check": [
        "Check the enforced authentication strength, enabled authentication-method policy, and the user\u2019s registered methods. Determine whether an external authentication method is part of the affected flow."
      ],
      "fix": [
        "Return the policy to Report-only if the rollout is blocking required work; then fix the user/method or external-authentication compatibility without changing the pinned strength."
      ],
      "doNot": [
        "Do not weaken the baseline grant solely to make an uninvestigated workflow pass."
      ],
      "then": [
        "Repeat the controlled registration test and rescan IAMAI."
      ],
      "sources": [
        "ms-device-registration",
        "ms-auth-strength-troubleshoot"
      ]
    },
    {
      "id": "wcd-bulk-enrollment-mfa",
      "classification": "documented",
      "title": "Windows bulk enrollment stops working after enforcement",
      "channels": [
        "entra",
        "aiInfo",
        "troubleshooting"
      ],
      "states": [
        "reportOnly",
        "readyToEnforce",
        "inPlace"
      ],
      "symptom": "Windows Configuration Designer bulk enrollment cannot retrieve/use its bulk enrollment flow after MFA enforcement.",
      "likelyCauses": [
        "WCD uses a package_{GUID} account and Microsoft documents MFA as unsupported for this scenario."
      ],
      "check": [
        "Confirm whether the failing path is Windows Configuration Designer bulk enrollment and identify its approved package account/workflow handling."
      ],
      "fix": [
        "Return the CA policy to Report-only if required for recovery. Use the tenant\u2019s owner-approved exclusion/workflow resolution; if none exists, stop and obtain that decision."
      ],
      "doNot": [
        "Do not invent or silently add a package account exclusion."
      ],
      "then": [
        "Re-test the bulk enrollment workflow before re-enforcement."
      ],
      "sources": [
        "ms-bulk-enrollment"
      ]
    },
    {
      "id": "legacy-device-mfa-toggle-conflict",
      "classification": "documented",
      "title": "The policy is On but device registration enforcement is inconsistent",
      "channels": [
        "entra",
        "aiInfo",
        "troubleshooting"
      ],
      "states": [
        "readyToEnforce",
        "inPlace"
      ],
      "symptom": "The Register or join devices Conditional Access policy is enabled but behavior is not consistent with the expected CA enforcement.",
      "likelyCauses": [
        "The tenant-wide Require multifactor authentication to register or join devices with Microsoft Entra setting is still Yes."
      ],
      "check": [
        "Open Entra ID > Devices > Overview > Device settings and inspect the tenant-wide device-registration MFA setting."
      ],
      "fix": [
        "For this Conditional Access implementation, set that tenant-wide setting to No, then test the controlled registration path again."
      ],
      "then": [
        "Confirm policy state by stable ID, repeat the controlled test, and rescan IAMAI."
      ],
      "sources": [
        "ms-device-registration",
        "ms-device-settings"
      ]
    },
    {
      "id": "report-only-no-user-action-evidence",
      "classification": "documented",
      "title": "Report-only shows no useful result for device registration",
      "channels": [
        "entra",
        "aiInfo",
        "troubleshooting"
      ],
      "states": [
        "reportOnly"
      ],
      "symptom": "The administrator expects Report-only logs to show whether Register or join devices would be blocked, but useful User Action evaluation is absent.",
      "likelyCauses": [
        "Microsoft does not evaluate policies scoped to User Actions in Report-only mode."
      ],
      "check": [
        "Confirm the policy is scoped to Register or join devices and verify its configuration by stable-ID read-back instead of relying on Report-only evaluation."
      ],
      "fix": [
        "Use controlled workflow validation and existing tenant evidence to establish readiness; leave the policy Report-only until those checks are complete."
      ],
      "then": [
        "Record the workflow evidence and rescan IAMAI."
      ],
      "sources": [
        "ms-report-only"
      ]
    },
    {
      "id": "iamai-still-partial",
      "classification": "derived",
      "title": "IAMAI still says the policy is missing or partial",
      "channels": [
        "entra",
        "json",
        "powershell",
        "aiInfo"
      ],
      "states": [
        "missing",
        "partial",
        "reportOnly"
      ],
      "symptom": "The administrator believes the policy was implemented, but IAMAI still classifies the step as Missing or Partial.",
      "likelyCauses": [
        "A security-significant field still differs: All users, canonical exclusions, User Action target, a noncanonical condition, authentication strength, or lifecycle.",
        "A duplicate policy was created instead of correcting the stable resolved object."
      ],
      "check": [
        "Read the resolved policy by stable ID and compare only the security-significant fields in STEP.md to IAMAI\u2019s semantic mismatches."
      ],
      "fix": [
        "Apply the smallest applicable correction module to the same stable policy ID; remove the mismatch rather than creating another policy."
      ],
      "doNot": [
        "Do not delete the resolved policy or create a second policy just to change IAMAI classification."
      ],
      "then": [
        "Read back the same ID and rescan IAMAI."
      ],
      "sources": [
        "ms-graph-get",
        "ms-graph-update"
      ]
    }
  ]
}
@@IAMAI-END
```

### `docs/implementation-content/s-goal-device-registration-mfa/META.json`

```json
{
  "schemaVersion": "2.5-compact",
  "stepId": "s-goal-device-registration-mfa",
  "title": "Require MFA to Register a Device",
  "baseline": "jon-hope-pinned",
  "relationship": "baseline-goal",
  "packagePath": "docs/implementation-content/s-goal-device-registration-mfa/",
  "sourceFiles": [
    "META.json",
    "STEP.md",
    "CONTENT.md"
  ],
  "contentFile": "CONTENT.md",
  "blockProtocol": "iamai-block-v1",
  "authoringScope": "additive-source-only",
  "outputs": {
    "entra": true,
    "json": true,
    "powershell": true,
    "aiInfo": true,
    "email": true,
    "readiness": true,
    "troubleshooting": true
  },
  "baselineAuthority": {
    "pinCommit": "90d9b890c4b9af2ac4bc02d97c06bf8900064b4c",
    "reviewedMembers": {"aeb49474-5250-4b65-8b0a-56c47127ee0f":"75f2c295"},
    "memberStableId": "aeb49474-5250-4b65-8b0a-56c47127ee0f",
    "reauthored": {
      "on": "2026-09-11",
      "from": "8461e0f2fd10167bf034e7c20ed8ea293827d890",
      "changes": [
        "grantControls: the member requires the author's custom authentication strength allowing only windowsHelloForBusiness, fido2, x509CertificateMultiFactor and temporaryAccessPassOneTime, where it required the built-in Multifactor authentication strength",
        "conditions.users.excludeGroups: one more source group, which IAMAI resolves through the owner's answer for the baseline's unidentified groups",
        "displayName: renamed by the author"
      ]
    },
    "authenticationStrength": {
      "requirement": [
        "windowsHelloForBusiness",
        "fido2",
        "x509CertificateMultiFactor",
        "temporaryAccessPassOneTime"
      ],
      "binding": "authStrength.target.id",
      "sourceIdentity": "The author's strength ID belongs to the author's tenant. IAMAI binds this tenant's own strength for the requirement and the package never names the source ID."
    },
    "userAction": "urn:user:registerdevice",
    "initialState": "enabledForReportingButNotEnforced"
  },
  "requiredBindings": [
    "policy.target.displayName",
    "policy.target.excludeGroups",
    "authStrength.target.id",
    "authStrength.target.displayName",
    "policy.current.id",
    "policy.current.semanticMismatches"
  ],
  "optionalBindings": [
    "tenant.displayName",
    "policy.current.displayName",
    "policy.current.state",
    "people.affected.count",
    "evidence.deviceRegistration",
    "evidence.enrollmentWorkflows",
    "dependencies.blockers",
    "tenant.deviceRegistration.multiFactorAuthConfiguration"
  ],
  "projection": {
    "missing": {
      "requires": [
        "policy.target.displayName",
        "policy.target.excludeGroups",
        "authStrength.target.id"
      ],
      "entra": [
        "entra.create"
      ],
      "json": [
        "json.create"
      ],
      "powershell": [
        {
          "block": "powershell.run",
          "mode": "Create"
        }
      ],
      "aiInfo": [
        "ai.create"
      ],
      "email": []
    },
    "partial": {
      "mode": "composeByMismatch",
      "mismatchBinding": "policy.current.semanticMismatches",
      "requires": [
        "policy.current.id",
        "policy.current.semanticMismatches",
        "policy.target.excludeGroups"
      ],
      "sharedBefore": {
        "entra": [
          "entra.correct.open"
        ]
      },
      "mismatches": {
        "users.include-all": {
          "appliesWhen": "included population is not exactly All users",
          "facts": [
            "conditions.users.includeUsers",
            "conditions.users.includeGroups",
            "conditions.users.includeRoles",
            "conditions.users.includeGuestsOrExternalUsers"
          ],
          "entra": [
            "entra.correct.users.include-all"
          ],
          "json": [
            "json.correct.conditions"
          ],
          "powershell": [
            {
              "block": "powershell.run",
              "mode": "Correct",
              "corrections": [
                "Conditions"
              ]
            }
          ]
        },
        "users.exclusions-canonical": {
          "appliesWhen": "exclusion set differs from IAMAI's canonical target",
          "facts": [
            "conditions.users.excludeUsers",
            "conditions.users.excludeGroups",
            "conditions.users.excludeRoles",
            "conditions.users.excludeGuestsOrExternalUsers"
          ],
          "entra": [
            "entra.correct.users.exclusions-canonical"
          ],
          "json": [
            "json.correct.conditions"
          ],
          "powershell": [
            {
              "block": "powershell.run",
              "mode": "Correct",
              "corrections": [
                "Conditions"
              ]
            }
          ]
        },
        "target.register-or-join-devices": {
          "appliesWhen": "target resource/user action differs from Register or join devices only",
          "facts": [
            "conditions.applications"
          ],
          "entra": [
            "entra.correct.target.register-or-join-devices"
          ],
          "json": [
            "json.correct.conditions"
          ],
          "powershell": [
            {
              "block": "powershell.run",
              "mode": "Correct",
              "corrections": [
                "Conditions"
              ]
            }
          ]
        },
        "conditions.remove-noncanonical": {
          "appliesWhen": "one or more noncanonical conditions are present",
          "facts": [
            "conditions.clientAppTypes",
            "conditions.locations",
            "conditions.platforms",
            "conditions.devices",
            "conditions.signInRiskLevels",
            "conditions.userRiskLevels",
            "conditions.servicePrincipalRiskLevels",
            "conditions.authenticationFlows",
            "conditions.insiderRiskLevels",
            "conditions.clientApplications"
          ],
          "entra": [
            "entra.correct.conditions.remove-noncanonical"
          ],
          "json": [
            "json.correct.conditions"
          ],
          "powershell": [
            {
              "block": "powershell.run",
              "mode": "Correct",
              "corrections": [
                "Conditions"
              ]
            }
          ]
        },
        "grant.authentication-strength": {
          "appliesWhen": "grant or authentication strength differs from the pinned member's requirement, resolved to this tenant's own strength",
          "facts": [
            "grantControls"
          ],
          "entra": [
            "entra.correct.grant.authentication-strength"
          ],
          "json": [
            "json.correct.grant"
          ],
          "powershell": [
            {
              "block": "powershell.run",
              "mode": "Correct",
              "corrections": [
                "Grant"
              ]
            }
          ]
        },
        "lifecycle.report-only": {
          "appliesWhen": "a semantically incorrect policy is not in Report-only while being corrected",
          "select": {
            "equals": [
              "policy.current.state",
              "enabled"
            ]
          },
          "alongside": true,
          "entra": [
            "entra.correct.lifecycle.report-only"
          ],
          "json": [
            "json.correct.report-only"
          ],
          "powershell": [
            {
              "block": "powershell.run",
              "mode": "Correct",
              "corrections": [
                "ReportOnly"
              ]
            }
          ]
        }
      },
      "sharedAfter": {
        "entra": [
          "entra.correct.save-verify"
        ]
      },
      "aiInfo": [
        "ai.correct"
      ],
      "email": []
    },
    "reportOnly": {
      "requires": [
        "policy.current.id",
        "policy.target.excludeGroups"
      ],
      "entra": [
        "entra.observe"
      ],
      "json": [],
      "powershell": [
        {
          "block": "powershell.run",
          "mode": "Verify"
        }
      ],
      "aiInfo": [
        "ai.observe"
      ],
      "email": []
    },
    "readyToEnforce": {
      "requires": [
        "policy.current.id",
        "policy.target.excludeGroups"
      ],
      "entra": [
        "entra.enforce"
      ],
      "json": [
        "json.enforce"
      ],
      "powershell": [
        {
          "block": "powershell.run",
          "mode": "Enforce"
        }
      ],
      "aiInfo": [
        "ai.enforce"
      ],
      "email": [
        "email.users.pre-enforcement"
      ]
    },
    "inPlace": {
      "entra": [],
      "json": [],
      "powershell": [],
      "aiInfo": [],
      "email": []
    },
    "blocked": {
      "entra": [],
      "json": [],
      "powershell": [],
      "aiInfo": [],
      "email": []
    },
    "needsDecision": {
      "entra": [],
      "json": [],
      "powershell": [],
      "aiInfo": [],
      "email": []
    },
    "sourceConflict": {
      "entra": [],
      "json": [],
      "powershell": [],
      "aiInfo": [],
      "email": []
    },
    "notLicensed": {
      "entra": [],
      "json": [],
      "powershell": [],
      "aiInfo": [],
      "email": []
    }
  },
  "supportBlocks": {
    "readiness": [
      "readiness.model"
    ],
    "troubleshooting": [
      "troubleshooting.model"
    ]
  },
  "email": {
    "block": "email.users.pre-enforcement",
    "audience": "affected-users",
    "applicableStates": [
      "readyToEnforce"
    ],
    "communicationTrigger": "before-enforcement",
    "purpose": "pre-change-notice"
  },
  "prerequisites": [
    {
      "id": "canonical-exclusions",
      "class": "IAMAI-confirmed",
      "binding": "policy.target.excludeGroups"
    },
    {
      "id": "stable-policy-id",
      "class": "IAMAI-confirmed-for-existing-object-states",
      "binding": "policy.current.id"
    },
    {
      "id": "legacy-device-mfa-toggle",
      "class": "human-validation",
      "requiredBefore": "readyToEnforce->inPlace",
      "evidence": {
        "equals": [
          "tenant.deviceRegistration.multiFactorAuthConfiguration",
          "notRequired"
        ]
      },
      "invalidatedBy": [
        "policy.current.id"
      ]
    },
    {
      "id": "enrollment-workflows",
      "class": "human-validation",
      "requiredBefore": "readyToEnforce->inPlace",
      "invalidatedBy": [
        "policy.current.id",
        "policy.target.excludeGroups"
      ]
    },
    {
      "id": "external-auth-methods",
      "class": "human-validation",
      "requiredBefore": "readyToEnforce->inPlace",
      "invalidatedBy": [
        "policy.current.id"
      ]
    }
  ],
  "sharedTechnicalPrimitives": [
    "ca.graph.policy-v1",
    "graph.powershell.invoke-v1",
    "ca.license-p1"
  ],
  "verifiedSources": [
    {
      "id": "ms-device-registration",
      "authority": "Microsoft Learn",
      "title": "Require multifactor authentication for device registration",
      "url": "https://learn.microsoft.com/en-us/entra/identity/conditional-access/policy-all-users-device-registration",
      "purpose": "Primary portal procedure, built-in MFA authentication strength, external-auth-method warning, legacy device-setting warning.",
      "checkedOn": "2026-09-10",
      "userFacing": true,
      "priority": "primary",
      "audience": [
        "step",
        "entra",
        "aiInfo",
        "troubleshooting"
      ]
    },
    {
      "id": "ms-target-resources",
      "authority": "Microsoft Learn",
      "title": "Conditional Access: Target resources",
      "url": "https://learn.microsoft.com/en-us/entra/identity/conditional-access/concept-conditional-access-cloud-apps",
      "purpose": "User Action limitations: only MFA/auth strength access controls; Client apps, device filters, and Device state unavailable; WHfB/device-bound passkeys unsupported for first registration.",
      "checkedOn": "2026-09-10",
      "userFacing": true,
      "priority": "technical",
      "audience": [
        "step",
        "entra",
        "troubleshooting"
      ]
    },
    {
      "id": "ms-report-only",
      "authority": "Microsoft Learn",
      "title": "Analyze Conditional Access Policy Impact",
      "url": "https://learn.microsoft.com/en-us/entra/identity/conditional-access/concept-conditional-access-report-only",
      "purpose": "Report-only excludes User Actions from evaluation.",
      "checkedOn": "2026-09-10",
      "userFacing": true,
      "priority": "troubleshooting",
      "audience": [
        "step",
        "entra",
        "aiInfo",
        "troubleshooting"
      ]
    },
    {
      "id": "ms-device-settings",
      "authority": "Microsoft Learn",
      "title": "Manage devices in Microsoft Entra ID using the Microsoft Entra admin center",
      "url": "https://learn.microsoft.com/en-us/entra/identity/devices/manage-device-identities",
      "purpose": "Legacy device-registration MFA tenant setting must be No when Conditional Access user action is used.",
      "checkedOn": "2026-09-10",
      "userFacing": false,
      "priority": "technical",
      "audience": [
        "step",
        "entra",
        "troubleshooting"
      ]
    },
    {
      "id": "ms-bulk-enrollment",
      "authority": "Microsoft Learn",
      "title": "Bulk enrollment for Windows devices",
      "url": "https://learn.microsoft.com/en-us/intune/intune-service/enrollment/windows-bulk-enroll",
      "purpose": "Windows Configuration Designer package_{GUID} bulk enrollment cannot satisfy MFA and needs deliberate workflow handling.",
      "checkedOn": "2026-09-10",
      "userFacing": true,
      "priority": "troubleshooting",
      "audience": [
        "step",
        "entra",
        "aiInfo",
        "troubleshooting"
      ]
    },
    {
      "id": "ms-ca-licensing",
      "authority": "Microsoft Learn",
      "title": "Microsoft Entra licensing",
      "url": "https://learn.microsoft.com/en-us/entra/fundamentals/licensing",
      "purpose": "Conditional Access requires Entra ID P1; Business Premium includes Conditional Access rights.",
      "checkedOn": "2026-09-10",
      "userFacing": false,
      "priority": "researchOnly",
      "audience": [
        "step"
      ]
    },
    {
      "id": "ms-ca-condition-set",
      "authority": "Microsoft Graph",
      "title": "conditionalAccessConditionSet resource type",
      "url": "https://learn.microsoft.com/en-us/graph/api/resources/conditionalaccessconditionset?view=graph-rest-1.0",
      "purpose": "Graph v1.0 required condition-set properties and supported clientAppTypes enum.",
      "checkedOn": "2026-09-10",
      "userFacing": false,
      "priority": "technical",
      "audience": [
        "json",
        "powershell"
      ]
    },
    {
      "id": "ms-ca-grant-controls",
      "authority": "Microsoft Graph",
      "title": "conditionalAccessGrantControls resource type",
      "url": "https://learn.microsoft.com/en-us/graph/api/resources/conditionalaccessgrantcontrols?view=graph-rest-1.0",
      "purpose": "Graph v1.0 grant-controls shape and authenticationStrength relationship.",
      "checkedOn": "2026-09-10",
      "userFacing": false,
      "priority": "technical",
      "audience": [
        "json",
        "powershell"
      ]
    },
    {
      "id": "ms-ca-policy",
      "authority": "Microsoft Graph",
      "title": "conditionalAccessPolicy resource type",
      "url": "https://learn.microsoft.com/en-us/graph/api/resources/conditionalaccesspolicy?view=graph-rest-1.0",
      "purpose": "Graph v1.0 policy properties and lifecycle enum.",
      "checkedOn": "2026-09-10",
      "userFacing": false,
      "priority": "technical",
      "audience": [
        "json",
        "powershell"
      ]
    },
    {
      "id": "ms-graph-create",
      "authority": "Microsoft Graph",
      "title": "Create conditionalAccessPolicy",
      "url": "https://learn.microsoft.com/en-us/graph/api/conditionalaccessroot-post-policies?view=graph-rest-1.0",
      "purpose": "POST endpoint, least delegated permissions, supported admin roles.",
      "checkedOn": "2026-09-10",
      "userFacing": true,
      "priority": "technical",
      "audience": [
        "json",
        "powershell",
        "troubleshooting"
      ]
    },
    {
      "id": "ms-graph-update",
      "authority": "Microsoft Graph",
      "title": "Update conditionalAccessPolicy",
      "url": "https://learn.microsoft.com/en-us/graph/api/conditionalaccesspolicy-update?view=graph-rest-1.0",
      "purpose": "PATCH endpoint, permissions, roles, omitted-root-property preservation.",
      "checkedOn": "2026-09-10",
      "userFacing": true,
      "priority": "technical",
      "audience": [
        "json",
        "powershell",
        "troubleshooting"
      ]
    },
    {
      "id": "ms-auth-strength-list",
      "authority": "Microsoft Graph",
      "title": "List authenticationStrengthPolicies",
      "url": "https://learn.microsoft.com/en-us/graph/api/authenticationstrengthroot-list-policies?view=graph-rest-1.0",
      "purpose": "Confirms built-in Multifactor authentication ID 00000000-0000-0000-0000-000000000002 and requirementsSatisfied=mfa.",
      "checkedOn": "2026-09-10",
      "userFacing": false,
      "priority": "technical",
      "audience": [
        "json",
        "powershell"
      ]
    },
    {
      "id": "ms-powershell-request",
      "authority": "Microsoft Learn",
      "title": "Invoke-MgGraphRequest",
      "url": "https://learn.microsoft.com/en-us/powershell/module/microsoft.graph.authentication/invoke-mggraphrequest?view=graph-powershell-1.0",
      "purpose": "Supported Microsoft.Graph.Authentication REST request cmdlet; Body required for POST/PATCH.",
      "checkedOn": "2026-09-10",
      "userFacing": true,
      "priority": "technical",
      "audience": [
        "powershell",
        "troubleshooting"
      ]
    },
    {
      "id": "ms-graph-get",
      "authority": "Microsoft Graph",
      "title": "Get conditionalAccessPolicy",
      "url": "https://learn.microsoft.com/en-us/graph/api/conditionalaccesspolicy-get?view=graph-rest-1.0",
      "purpose": "Stable-ID read-back endpoint and Policy.Read.All read permission.",
      "checkedOn": "2026-09-10",
      "userFacing": false,
      "priority": "technical",
      "audience": [
        "json",
        "powershell",
        "troubleshooting"
      ]
    },
    {
      "id": "ms-auth-strength-troubleshoot",
      "authority": "Microsoft Learn",
      "title": "Troubleshoot Conditional Access authentication strengths",
      "url": "https://learn.microsoft.com/en-us/entra/identity/authentication/troubleshoot-authentication-strengths",
      "purpose": "User method must be registered and enabled to satisfy the required authentication strength; supports rollout troubleshooting.",
      "checkedOn": "2026-09-10",
      "userFacing": true,
      "priority": "troubleshooting",
      "audience": [
        "aiInfo",
        "troubleshooting"
      ]
    }
  ],
  "validation": {
    "jsonTemplateConvention": "{{json:<binding>}} is whole-value JSON substitution; mask to null only for authoring syntax lint.",
    "powershellParser": "not-run-in-authoring-environment-no-pwsh",
    "liveTenantExecution": false
  },
  "unresolvedIssues": [],
  "verificationStatus": "self-verified"
}
```

### `docs/implementation-content/s-goal-device-registration-mfa/STEP.md`

```markdown
# Require MFA to Register a Device

## Goal
Require the pinned baseline's MFA authentication strength when an in-scope user registers or joins a device in Microsoft Entra ID.

## Why this exists
A password alone must not be enough to register an attacker-controlled device as a tenant device. The member of Jon Hope's baseline pinned at `90d9b890` for this goal targets the Microsoft Entra **Register or join devices** user action and requires an authentication strength that allows only Windows Hello for Business, FIDO2 security keys, certificate-based MFA and a one-time Temporary Access Pass. IAMAI resolves this tenant's own strength for that requirement.

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
- Do not add a location restriction because an earlier display name of this member mentioned a trusted location; the pinned member has no location condition. Current Microsoft documentation specifically marks Client apps, Filters for devices, and Device state conditions unavailable for this User Action; other conditions remain absent here because the pinned member sets none.
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
```

### `docs/implementation-content/LIBRARY.json` — this package's entry

This is the element of the top-level `packages` array whose `stepId` is `s-goal-device-registration-mfa` (lines 503–544 of the file). It is copied as written; only the trailing comma after the closing brace is dropped. Other LIBRARY.json sections (`bindings[].requiredBy` / `optionalBy` / `packages` and similar) name this step id too. They are cross-references, not the package entry, and are not copied here.

```json
    {
      "stepId": "s-goal-device-registration-mfa",
      "title": "Require MFA to Register a Device",
      "packagePath": "docs/implementation-content/s-goal-device-registration-mfa/",
      "relationship": "baseline-goal",
      "status": "SELF-VERIFIED",
      "validationResult": "pass",
      "sourceFiles": 3,
      "contentBlocks": 24,
      "outputs": {
        "entra": true,
        "json": true,
        "powershell": true,
        "aiInfo": true,
        "email": true,
        "readiness": true,
        "troubleshooting": true
      },
      "statesSupported": [
        "missing",
        "partial",
        "reportOnly",
        "readyToEnforce",
        "inPlace",
        "blocked",
        "needsDecision",
        "sourceConflict",
        "notLicensed"
      ],
      "correctionModules": 6,
      "requiredBindings": 6,
      "optionalBindings": 8,
      "verifiedSourceCount": 15,
      "packageSpecificMicrosoftSources": 15,
      "sharedPrimitivesReused": 3,
      "betaDependencies": 0,
      "unresolvedIssues": 0,
      "strictValidationErrors": 0,
      "registered": true,
      "provenance": "baseline-member",
      "review": "current"
    }
```

## 2. Compiled registry entry

`src/content/implementation/registry.generated.json` holds this package under three top-level maps, each keyed by the step id. The file itself says it is generated by `scripts/compile-implementation-content.mjs --registry` and must not be edited by hand. Each entry below was extracted with node and pretty-printed with two-space indentation.

### `packages["s-goal-device-registration-mfa"]`

The compiled package, with keys `meta` and `blocks`.

```json
{
  "meta": {
    "stepId": "s-goal-device-registration-mfa",
    "title": "Require MFA to Register a Device",
    "relationship": "baseline-goal",
    "contentFile": "CONTENT.md",
    "requiredBindings": [
      "policy.target.displayName",
      "policy.target.excludeGroups",
      "authStrength.target.id",
      "authStrength.target.displayName",
      "policy.current.id",
      "policy.current.semanticMismatches"
    ],
    "optionalBindings": [
      "tenant.displayName",
      "policy.current.displayName",
      "policy.current.state",
      "people.affected.count",
      "evidence.deviceRegistration",
      "evidence.enrollmentWorkflows",
      "dependencies.blockers",
      "tenant.deviceRegistration.multiFactorAuthConfiguration"
    ],
    "projection": {
      "missing": {
        "requires": [
          "policy.target.displayName",
          "policy.target.excludeGroups",
          "authStrength.target.id"
        ],
        "entra": [
          "entra.create"
        ],
        "json": [
          "json.create"
        ],
        "powershell": [
          {
            "block": "powershell.run",
            "mode": "Create"
          }
        ],
        "aiInfo": [
          "ai.create"
        ],
        "email": []
      },
      "partial": {
        "mode": "composeByMismatch",
        "mismatchBinding": "policy.current.semanticMismatches",
        "requires": [
          "policy.current.id",
          "policy.current.semanticMismatches",
          "policy.target.excludeGroups"
        ],
        "sharedBefore": {
          "entra": [
            "entra.correct.open"
          ]
        },
        "mismatches": {
          "users.include-all": {
            "appliesWhen": "included population is not exactly All users",
            "facts": [
              "conditions.users.includeUsers",
              "conditions.users.includeGroups",
              "conditions.users.includeRoles",
              "conditions.users.includeGuestsOrExternalUsers"
            ],
            "entra": [
              "entra.correct.users.include-all"
            ],
            "json": [
              "json.correct.conditions"
            ],
            "powershell": [
              {
                "block": "powershell.run",
                "mode": "Correct",
                "corrections": [
                  "Conditions"
                ]
              }
            ]
          },
          "users.exclusions-canonical": {
            "appliesWhen": "exclusion set differs from IAMAI's canonical target",
            "facts": [
              "conditions.users.excludeUsers",
              "conditions.users.excludeGroups",
              "conditions.users.excludeRoles",
              "conditions.users.excludeGuestsOrExternalUsers"
            ],
            "entra": [
              "entra.correct.users.exclusions-canonical"
            ],
            "json": [
              "json.correct.conditions"
            ],
            "powershell": [
              {
                "block": "powershell.run",
                "mode": "Correct",
                "corrections": [
                  "Conditions"
                ]
              }
            ]
          },
          "target.register-or-join-devices": {
            "appliesWhen": "target resource/user action differs from Register or join devices only",
            "facts": [
              "conditions.applications"
            ],
            "entra": [
              "entra.correct.target.register-or-join-devices"
            ],
            "json": [
              "json.correct.conditions"
            ],
            "powershell": [
              {
                "block": "powershell.run",
                "mode": "Correct",
                "corrections": [
                  "Conditions"
                ]
              }
            ]
          },
          "conditions.remove-noncanonical": {
            "appliesWhen": "one or more noncanonical conditions are present",
            "facts": [
              "conditions.clientAppTypes",
              "conditions.locations",
              "conditions.platforms",
              "conditions.devices",
              "conditions.signInRiskLevels",
              "conditions.userRiskLevels",
              "conditions.servicePrincipalRiskLevels",
              "conditions.authenticationFlows",
              "conditions.insiderRiskLevels",
              "conditions.clientApplications"
            ],
            "entra": [
              "entra.correct.conditions.remove-noncanonical"
            ],
            "json": [
              "json.correct.conditions"
            ],
            "powershell": [
              {
                "block": "powershell.run",
                "mode": "Correct",
                "corrections": [
                  "Conditions"
                ]
              }
            ]
          },
          "grant.authentication-strength": {
            "appliesWhen": "grant or authentication strength differs from the pinned member's requirement, resolved to this tenant's own strength",
            "facts": [
              "grantControls"
            ],
            "entra": [
              "entra.correct.grant.authentication-strength"
            ],
            "json": [
              "json.correct.grant"
            ],
            "powershell": [
              {
                "block": "powershell.run",
                "mode": "Correct",
                "corrections": [
                  "Grant"
                ]
              }
            ]
          },
          "lifecycle.report-only": {
            "appliesWhen": "a semantically incorrect policy is not in Report-only while being corrected",
            "select": {
              "equals": [
                "policy.current.state",
                "enabled"
              ]
            },
            "alongside": true,
            "entra": [
              "entra.correct.lifecycle.report-only"
            ],
            "json": [
              "json.correct.report-only"
            ],
            "powershell": [
              {
                "block": "powershell.run",
                "mode": "Correct",
                "corrections": [
                  "ReportOnly"
                ]
              }
            ]
          }
        },
        "sharedAfter": {
          "entra": [
            "entra.correct.save-verify"
          ]
        },
        "aiInfo": [
          "ai.correct"
        ],
        "email": []
      },
      "reportOnly": {
        "requires": [
          "policy.current.id",
          "policy.target.excludeGroups"
        ],
        "entra": [
          "entra.observe"
        ],
        "json": [],
        "powershell": [
          {
            "block": "powershell.run",
            "mode": "Verify"
          }
        ],
        "aiInfo": [
          "ai.observe"
        ],
        "email": []
      },
      "readyToEnforce": {
        "requires": [
          "policy.current.id",
          "policy.target.excludeGroups"
        ],
        "entra": [
          "entra.enforce"
        ],
        "json": [
          "json.enforce"
        ],
        "powershell": [
          {
            "block": "powershell.run",
            "mode": "Enforce"
          }
        ],
        "aiInfo": [
          "ai.enforce"
        ],
        "email": [
          "email.users.pre-enforcement"
        ]
      },
      "inPlace": {
        "entra": [],
        "json": [],
        "powershell": [],
        "aiInfo": [],
        "email": []
      },
      "blocked": {
        "entra": [],
        "json": [],
        "powershell": [],
        "aiInfo": [],
        "email": []
      },
      "needsDecision": {
        "entra": [],
        "json": [],
        "powershell": [],
        "aiInfo": [],
        "email": []
      },
      "sourceConflict": {
        "entra": [],
        "json": [],
        "powershell": [],
        "aiInfo": [],
        "email": []
      },
      "notLicensed": {
        "entra": [],
        "json": [],
        "powershell": [],
        "aiInfo": [],
        "email": []
      }
    },
    "supportBlocks": {
      "readiness": [
        "readiness.model"
      ],
      "troubleshooting": [
        "troubleshooting.model"
      ]
    },
    "verifiedSources": [
      {
        "id": "ms-device-registration",
        "authority": "Microsoft Learn",
        "title": "Require multifactor authentication for device registration",
        "url": "https://learn.microsoft.com/en-us/entra/identity/conditional-access/policy-all-users-device-registration",
        "purpose": "Primary portal procedure, built-in MFA authentication strength, external-auth-method warning, legacy device-setting warning.",
        "checkedOn": "2026-09-10",
        "userFacing": true,
        "priority": "primary",
        "audience": [
          "step",
          "entra",
          "aiInfo",
          "troubleshooting"
        ]
      },
      {
        "id": "ms-target-resources",
        "authority": "Microsoft Learn",
        "title": "Conditional Access: Target resources",
        "url": "https://learn.microsoft.com/en-us/entra/identity/conditional-access/concept-conditional-access-cloud-apps",
        "purpose": "User Action limitations: only MFA/auth strength access controls; Client apps, device filters, and Device state unavailable; WHfB/device-bound passkeys unsupported for first registration.",
        "checkedOn": "2026-09-10",
        "userFacing": true,
        "priority": "technical",
        "audience": [
          "step",
          "entra",
          "troubleshooting"
        ]
      },
      {
        "id": "ms-report-only",
        "authority": "Microsoft Learn",
        "title": "Analyze Conditional Access Policy Impact",
        "url": "https://learn.microsoft.com/en-us/entra/identity/conditional-access/concept-conditional-access-report-only",
        "purpose": "Report-only excludes User Actions from evaluation.",
        "checkedOn": "2026-09-10",
        "userFacing": true,
        "priority": "troubleshooting",
        "audience": [
          "step",
          "entra",
          "aiInfo",
          "troubleshooting"
        ]
      },
      {
        "id": "ms-device-settings",
        "authority": "Microsoft Learn",
        "title": "Manage devices in Microsoft Entra ID using the Microsoft Entra admin center",
        "url": "https://learn.microsoft.com/en-us/entra/identity/devices/manage-device-identities",
        "purpose": "Legacy device-registration MFA tenant setting must be No when Conditional Access user action is used.",
        "checkedOn": "2026-09-10",
        "userFacing": false,
        "priority": "technical",
        "audience": [
          "step",
          "entra",
          "troubleshooting"
        ]
      },
      {
        "id": "ms-bulk-enrollment",
        "authority": "Microsoft Learn",
        "title": "Bulk enrollment for Windows devices",
        "url": "https://learn.microsoft.com/en-us/intune/intune-service/enrollment/windows-bulk-enroll",
        "purpose": "Windows Configuration Designer package_{GUID} bulk enrollment cannot satisfy MFA and needs deliberate workflow handling.",
        "checkedOn": "2026-09-10",
        "userFacing": true,
        "priority": "troubleshooting",
        "audience": [
          "step",
          "entra",
          "aiInfo",
          "troubleshooting"
        ]
      },
      {
        "id": "ms-ca-licensing",
        "authority": "Microsoft Learn",
        "title": "Microsoft Entra licensing",
        "url": "https://learn.microsoft.com/en-us/entra/fundamentals/licensing",
        "purpose": "Conditional Access requires Entra ID P1; Business Premium includes Conditional Access rights.",
        "checkedOn": "2026-09-10",
        "userFacing": false,
        "priority": "researchOnly",
        "audience": [
          "step"
        ]
      },
      {
        "id": "ms-ca-condition-set",
        "authority": "Microsoft Graph",
        "title": "conditionalAccessConditionSet resource type",
        "url": "https://learn.microsoft.com/en-us/graph/api/resources/conditionalaccessconditionset?view=graph-rest-1.0",
        "purpose": "Graph v1.0 required condition-set properties and supported clientAppTypes enum.",
        "checkedOn": "2026-09-10",
        "userFacing": false,
        "priority": "technical",
        "audience": [
          "json",
          "powershell"
        ]
      },
      {
        "id": "ms-ca-grant-controls",
        "authority": "Microsoft Graph",
        "title": "conditionalAccessGrantControls resource type",
        "url": "https://learn.microsoft.com/en-us/graph/api/resources/conditionalaccessgrantcontrols?view=graph-rest-1.0",
        "purpose": "Graph v1.0 grant-controls shape and authenticationStrength relationship.",
        "checkedOn": "2026-09-10",
        "userFacing": false,
        "priority": "technical",
        "audience": [
          "json",
          "powershell"
        ]
      },
      {
        "id": "ms-ca-policy",
        "authority": "Microsoft Graph",
        "title": "conditionalAccessPolicy resource type",
        "url": "https://learn.microsoft.com/en-us/graph/api/resources/conditionalaccesspolicy?view=graph-rest-1.0",
        "purpose": "Graph v1.0 policy properties and lifecycle enum.",
        "checkedOn": "2026-09-10",
        "userFacing": false,
        "priority": "technical",
        "audience": [
          "json",
          "powershell"
        ]
      },
      {
        "id": "ms-graph-create",
        "authority": "Microsoft Graph",
        "title": "Create conditionalAccessPolicy",
        "url": "https://learn.microsoft.com/en-us/graph/api/conditionalaccessroot-post-policies?view=graph-rest-1.0",
        "purpose": "POST endpoint, least delegated permissions, supported admin roles.",
        "checkedOn": "2026-09-10",
        "userFacing": true,
        "priority": "technical",
        "audience": [
          "json",
          "powershell",
          "troubleshooting"
        ]
      },
      {
        "id": "ms-graph-update",
        "authority": "Microsoft Graph",
        "title": "Update conditionalAccessPolicy",
        "url": "https://learn.microsoft.com/en-us/graph/api/conditionalaccesspolicy-update?view=graph-rest-1.0",
        "purpose": "PATCH endpoint, permissions, roles, omitted-root-property preservation.",
        "checkedOn": "2026-09-10",
        "userFacing": true,
        "priority": "technical",
        "audience": [
          "json",
          "powershell",
          "troubleshooting"
        ]
      },
      {
        "id": "ms-auth-strength-list",
        "authority": "Microsoft Graph",
        "title": "List authenticationStrengthPolicies",
        "url": "https://learn.microsoft.com/en-us/graph/api/authenticationstrengthroot-list-policies?view=graph-rest-1.0",
        "purpose": "Confirms built-in Multifactor authentication ID 00000000-0000-0000-0000-000000000002 and requirementsSatisfied=mfa.",
        "checkedOn": "2026-09-10",
        "userFacing": false,
        "priority": "technical",
        "audience": [
          "json",
          "powershell"
        ]
      },
      {
        "id": "ms-powershell-request",
        "authority": "Microsoft Learn",
        "title": "Invoke-MgGraphRequest",
        "url": "https://learn.microsoft.com/en-us/powershell/module/microsoft.graph.authentication/invoke-mggraphrequest?view=graph-powershell-1.0",
        "purpose": "Supported Microsoft.Graph.Authentication REST request cmdlet; Body required for POST/PATCH.",
        "checkedOn": "2026-09-10",
        "userFacing": true,
        "priority": "technical",
        "audience": [
          "powershell",
          "troubleshooting"
        ]
      },
      {
        "id": "ms-graph-get",
        "authority": "Microsoft Graph",
        "title": "Get conditionalAccessPolicy",
        "url": "https://learn.microsoft.com/en-us/graph/api/conditionalaccesspolicy-get?view=graph-rest-1.0",
        "purpose": "Stable-ID read-back endpoint and Policy.Read.All read permission.",
        "checkedOn": "2026-09-10",
        "userFacing": false,
        "priority": "technical",
        "audience": [
          "json",
          "powershell",
          "troubleshooting"
        ]
      },
      {
        "id": "ms-auth-strength-troubleshoot",
        "authority": "Microsoft Learn",
        "title": "Troubleshoot Conditional Access authentication strengths",
        "url": "https://learn.microsoft.com/en-us/entra/identity/authentication/troubleshoot-authentication-strengths",
        "purpose": "User method must be registered and enabled to satisfy the required authentication strength; supports rollout troubleshooting.",
        "checkedOn": "2026-09-10",
        "userFacing": true,
        "priority": "troubleshooting",
        "audience": [
          "aiInfo",
          "troubleshooting"
        ]
      }
    ],
    "prerequisites": [
      {
        "id": "canonical-exclusions",
        "class": "IAMAI-confirmed",
        "binding": "policy.target.excludeGroups"
      },
      {
        "id": "stable-policy-id",
        "class": "IAMAI-confirmed-for-existing-object-states",
        "binding": "policy.current.id"
      },
      {
        "id": "legacy-device-mfa-toggle",
        "class": "human-validation",
        "requiredBefore": "readyToEnforce->inPlace",
        "evidence": {
          "equals": [
            "tenant.deviceRegistration.multiFactorAuthConfiguration",
            "notRequired"
          ]
        },
        "invalidatedBy": [
          "policy.current.id"
        ]
      },
      {
        "id": "enrollment-workflows",
        "class": "human-validation",
        "requiredBefore": "readyToEnforce->inPlace",
        "invalidatedBy": [
          "policy.current.id",
          "policy.target.excludeGroups"
        ]
      },
      {
        "id": "external-auth-methods",
        "class": "human-validation",
        "requiredBefore": "readyToEnforce->inPlace",
        "invalidatedBy": [
          "policy.current.id"
        ]
      }
    ],
    "baselineAuthority": {
      "pinCommit": "90d9b890c4b9af2ac4bc02d97c06bf8900064b4c",
      "reviewedMembers": {
        "aeb49474-5250-4b65-8b0a-56c47127ee0f": "75f2c295"
      },
      "memberStableId": "aeb49474-5250-4b65-8b0a-56c47127ee0f",
      "reauthored": {
        "on": "2026-09-11",
        "from": "8461e0f2fd10167bf034e7c20ed8ea293827d890",
        "changes": [
          "grantControls: the member requires the author's custom authentication strength allowing only windowsHelloForBusiness, fido2, x509CertificateMultiFactor and temporaryAccessPassOneTime, where it required the built-in Multifactor authentication strength",
          "conditions.users.excludeGroups: one more source group, which IAMAI resolves through the owner's answer for the baseline's unidentified groups",
          "displayName: renamed by the author"
        ]
      },
      "authenticationStrength": {
        "requirement": [
          "windowsHelloForBusiness",
          "fido2",
          "x509CertificateMultiFactor",
          "temporaryAccessPassOneTime"
        ],
        "binding": "authStrength.target.id",
        "sourceIdentity": "The author's strength ID belongs to the author's tenant. IAMAI binds this tenant's own strength for the requirement and the package never names the source ID."
      },
      "userAction": "urn:user:registerdevice",
      "initialState": "enabledForReportingButNotEnforced"
    },
    "email": {
      "block": "email.users.pre-enforcement",
      "audience": "affected-users",
      "applicableStates": [
        "readyToEnforce"
      ],
      "communicationTrigger": "before-enforcement",
      "purpose": "pre-change-notice"
    }
  },
  "blocks": {
    "entra.create": {
      "meta": {
        "id": "entra.create",
        "channel": "entra",
        "states": [
          "missing"
        ],
        "format": "markdown",
        "kind": "template"
      },
      "text": "# Create the policy in Report-only\n\nIAMAI will supply the resolved policy name and canonical exclusion set.\n\n1. Go to **Microsoft Entra admin center > Entra ID > Conditional Access > Policies**.\n2. Select **New policy** and enter the IAMAI-resolved policy name.\n3. Under **Users or workload identities**, include **All users** and exclude exactly the IAMAI-resolved canonical exclusions.\n4. Under **Target resources**, select **User actions > Register or join devices**. Do not select cloud applications.\n5. Under **Grant**, select **Grant access > Require authentication strength > {{authStrength.target.displayName}}**, the authentication strength IAMAI resolved for this policy. Select it by that name; do not select a similar or weaker strength in its place.\n6. Leave noncanonical conditions unset. Microsoft makes **Client apps**, **Filters for devices**, and **Device state** unavailable for this User Action; the pinned member also sets no device-platform, location, risk, or authentication-flow conditions.\n7. Set **Enable policy** to **Report-only**.\n8. Create the policy.\n9. Rescan IAMAI. Do not treat Report-only as rollout proof for this User Action; complete the enrollment-workflow checks before enforcement.\n\nDone when IAMAI rescans the newly created policy and finds the canonical scope, exclusions, the resolved authentication strength, and Report-only lifecycle.\n"
    },
    "entra.correct.open": {
      "meta": {
        "id": "entra.correct.open",
        "channel": "entra",
        "states": [
          "partial"
        ],
        "format": "markdown",
        "kind": "template",
        "moduleRole": "sharedBefore"
      },
      "text": "# Correct this policy\n\nOpen the exact Conditional Access policy IAMAI identified. Use its stable policy identity; do not find an update target by fuzzy display-name matching.\n"
    },
    "entra.correct.users.include-all": {
      "meta": {
        "id": "entra.correct.users.include-all",
        "channel": "entra",
        "states": [
          "partial"
        ],
        "format": "markdown",
        "kind": "template",
        "moduleRole": "mismatch"
      },
      "text": "# Correct the included population\n\nUnder **Users or workload identities > Include**, set the population to **All users**. Leave the IAMAI-resolved canonical exclusions unchanged.\n\nDone when IAMAI reads the same policy ID and finds **All users** included.\n"
    },
    "entra.correct.users.exclusions-canonical": {
      "meta": {
        "id": "entra.correct.users.exclusions-canonical",
        "channel": "entra",
        "states": [
          "partial"
        ],
        "format": "markdown",
        "kind": "template",
        "moduleRole": "mismatch"
      },
      "text": "# Correct the exclusions\n\nUnder **Users or workload identities > Exclude**, make the exclusion set match IAMAI's canonical resolved exclusions exactly. Leave the **Register or join devices** target and already-correct grant unchanged.\n\nDo not add a new enrollment exception unless IAMAI already has an owner-approved canonical exclusion for it.\n\nDone when IAMAI reads the same policy ID and finds the canonical exclusion set.\n"
    },
    "entra.correct.target.register-or-join-devices": {
      "meta": {
        "id": "entra.correct.target.register-or-join-devices",
        "channel": "entra",
        "states": [
          "partial"
        ],
        "format": "markdown",
        "kind": "template",
        "moduleRole": "mismatch"
      },
      "text": "# Correct the target\n\nUnder **Target resources**, select **User actions > Register or join devices** and remove any cloud-application target from this policy. Preserve the canonical user scope, exclusions, and already-correct grant.\n\nDone when IAMAI reads the same policy ID and finds only the **Register or join devices** User Action target.\n"
    },
    "entra.correct.conditions.remove-noncanonical": {
      "meta": {
        "id": "entra.correct.conditions.remove-noncanonical",
        "channel": "entra",
        "states": [
          "partial"
        ],
        "format": "markdown",
        "kind": "template",
        "moduleRole": "mismatch"
      },
      "text": "# Remove noncanonical conditions\n\nRemove only the condition(s) IAMAI identified as noncanonical for this User Action, such as location, device platform, device filter/device state, Client apps, risk, or authentication-flow conditions. Leave the canonical User Action, population/exclusions, and already-correct grant unchanged.\n\nMicrosoft does not make Client apps, Filters for devices, or Device state conditions available for **Register or join devices**. Do not replace a removed condition with another condition to recreate the same restriction.\n\nDone when IAMAI reads the same policy ID and no longer finds the noncanonical condition.\n"
    },
    "entra.correct.grant.authentication-strength": {
      "meta": {
        "id": "entra.correct.grant.authentication-strength",
        "channel": "entra",
        "states": [
          "partial"
        ],
        "format": "markdown",
        "kind": "template",
        "moduleRole": "mismatch"
      },
      "text": "# Correct the grant\n\nUnder **Grant**, select **Grant access > Require authentication strength > {{authStrength.target.displayName}}**. Remove a simultaneous **Require multifactor authentication** built-in grant if present. Leave the canonical User Action, population, and exclusions unchanged.\n\n**{{authStrength.target.displayName}}** is the authentication strength IAMAI resolved for this policy. Do not select a different or weaker strength in its place.\n\nDone when IAMAI reads the same policy ID and finds the resolved authentication strength.\n"
    },
    "entra.correct.lifecycle.report-only": {
      "meta": {
        "id": "entra.correct.lifecycle.report-only",
        "channel": "entra",
        "states": [
          "partial"
        ],
        "format": "markdown",
        "kind": "template",
        "moduleRole": "mismatch"
      },
      "text": "# Return the policy to Report-only\n\nSet **Enable policy** to **Report-only** before applying semantic corrections. Do not leave a semantically incorrect policy enforcing while its scope or grant is being corrected.\n"
    },
    "entra.correct.save-verify": {
      "meta": {
        "id": "entra.correct.save-verify",
        "channel": "entra",
        "states": [
          "partial"
        ],
        "format": "markdown",
        "kind": "template",
        "moduleRole": "sharedAfter"
      },
      "text": "# Save and verify\n\nKeep the policy **Report-only** while corrections are being made. Save, then rescan IAMAI.\n\nDone when IAMAI reads the same policy ID and the selected semantic mismatch(es) are cleared.\n"
    },
    "entra.observe": {
      "meta": {
        "id": "entra.observe",
        "channel": "entra",
        "states": [
          "reportOnly"
        ],
        "format": "markdown",
        "kind": "template"
      },
      "text": "# Validate before enforcement\n\nThe resolved policy is already in **Report-only**. Do not recreate it.\n\n1. Use IAMAI's current evidence to identify known device-registration and enrollment workflows that still need validation.\n2. Use IAMAI's MFA Readiness evidence to identify affected users who cannot currently satisfy MFA; do not expect Report-only User Action telemetry to prove this.\n3. Validate known enrollment workflows directly where practical, including Windows Configuration Designer bulk enrollment when it is used.\n4. Record any workflow that needs an approved exclusion or a different enrollment method as unresolved; do not invent the exception here.\n5. Rescan IAMAI after the evidence or owner decision changes.\n\nMicrosoft does **not** evaluate User Action policies in Report-only mode. An empty or quiet Report-only result does not prove this policy is safe to enforce.\n"
    },
    "entra.enforce": {
      "meta": {
        "id": "entra.enforce",
        "channel": "entra",
        "states": [
          "readyToEnforce"
        ],
        "format": "markdown",
        "kind": "template"
      },
      "text": "# Enforce the resolved policy\n\nBefore this transition, enrollment-workflow validation must be complete and any external-authentication-method incompatibility must be resolved.\n\n1. Go to **Microsoft Entra admin center > Entra ID > Devices > Overview > Device settings**.\n2. Confirm **Require multifactor authentication to register or join devices with Microsoft Entra** is **No**. If it is Yes, set it to No as part of this controlled enforcement change.\n3. Go to **Entra ID > Conditional Access > Policies** and open the exact IAMAI-resolved policy.\n4. Set **Enable policy** from **Report-only** to **On**. Do not change scope, exclusions, User Action, or grant.\n5. Save the policy.\n6. Perform the controlled device registration/join test and the identified enrollment-workflow tests.\n7. Rescan IAMAI.\n\nIf a required enrollment workflow fails, return the same policy to **Report-only** and restore the prior tenant-wide device-registration MFA setting if this rollout changed it from Yes to No.\n\nDone when the same policy ID is On, the legacy device-registration MFA toggle is No, controlled registration succeeds with the required MFA strength, required enrollment workflows pass, and IAMAI rescans the policy as in place.\n"
    },
    "json.create": {
      "meta": {
        "id": "json.create",
        "channel": "json",
        "states": [
          "missing"
        ],
        "format": "json-template",
        "kind": "deployableAfterBinding",
        "method": "POST",
        "endpoint": "/identity/conditionalAccess/policies"
      },
      "text": "{\n  \"displayName\": {{json:policy.target.displayName}},\n  \"state\": \"enabledForReportingButNotEnforced\",\n  \"conditions\": {\n    \"users\": {\n      \"includeUsers\": [\"All\"],\n      \"excludeUsers\": [],\n      \"includeGroups\": [],\n      \"excludeGroups\": {{json:policy.target.excludeGroups}},\n      \"includeRoles\": [],\n      \"excludeRoles\": []\n    },\n    \"applications\": {\n      \"includeApplications\": [],\n      \"excludeApplications\": [],\n      \"includeUserActions\": [\"urn:user:registerdevice\"]\n    },\n    \"clientAppTypes\": [\"all\"],\n    \"signInRiskLevels\": [],\n    \"userRiskLevels\": [],\n    \"servicePrincipalRiskLevels\": []\n  },\n  \"grantControls\": {\n    \"operator\": \"OR\",\n    \"builtInControls\": [],\n    \"customAuthenticationFactors\": [],\n    \"termsOfUse\": [],\n    \"authenticationStrength\": {\n      \"id\": {{json:authStrength.target.id}}\n    }\n  }\n}\n"
    },
    "json.correct.conditions": {
      "meta": {
        "id": "json.correct.conditions",
        "channel": "json",
        "states": [
          "partial"
        ],
        "format": "json-template",
        "kind": "deployableAfterBinding",
        "method": "PATCH",
        "endpoint": "/identity/conditionalAccess/policies/{policy.current.id}"
      },
      "text": "{\n  \"conditions\": {\n    \"users\": {\n      \"includeUsers\": [\"All\"],\n      \"excludeUsers\": [],\n      \"includeGroups\": [],\n      \"excludeGroups\": {{json:policy.target.excludeGroups}},\n      \"includeRoles\": [],\n      \"excludeRoles\": []\n    },\n    \"applications\": {\n      \"includeApplications\": [],\n      \"excludeApplications\": [],\n      \"includeUserActions\": [\"urn:user:registerdevice\"],\n      \"applicationFilter\": null\n    },\n    \"clientAppTypes\": [\"all\"],\n    \"signInRiskLevels\": [],\n    \"userRiskLevels\": [],\n    \"servicePrincipalRiskLevels\": [],\n    \"locations\": null,\n    \"platforms\": null,\n    \"devices\": null,\n    \"authenticationFlows\": null,\n    \"insiderRiskLevels\": null\n  }\n}\n"
    },
    "json.correct.grant": {
      "meta": {
        "id": "json.correct.grant",
        "channel": "json",
        "states": [
          "partial"
        ],
        "format": "json-template",
        "kind": "deployableAfterBinding",
        "method": "PATCH",
        "endpoint": "/identity/conditionalAccess/policies/{policy.current.id}"
      },
      "text": "{\n  \"grantControls\": {\n    \"operator\": \"OR\",\n    \"builtInControls\": [],\n    \"customAuthenticationFactors\": [],\n    \"termsOfUse\": [],\n    \"authenticationStrength\": {\n      \"id\": {{json:authStrength.target.id}}\n    }\n  }\n}\n"
    },
    "json.correct.report-only": {
      "meta": {
        "id": "json.correct.report-only",
        "channel": "json",
        "states": [
          "partial"
        ],
        "format": "json",
        "kind": "deployableAfterBinding",
        "method": "PATCH",
        "endpoint": "/identity/conditionalAccess/policies/{policy.current.id}"
      },
      "text": "{\n  \"state\": \"enabledForReportingButNotEnforced\"\n}\n"
    },
    "json.enforce": {
      "meta": {
        "id": "json.enforce",
        "channel": "json",
        "states": [
          "readyToEnforce"
        ],
        "format": "json",
        "kind": "deployableAfterBinding",
        "method": "PATCH",
        "endpoint": "/identity/conditionalAccess/policies/{policy.current.id}"
      },
      "text": "{\n  \"state\": \"enabled\"\n}\n"
    },
    "powershell.run": {
      "meta": {
        "id": "powershell.run",
        "channel": "powershell",
        "states": [
          "missing",
          "partial",
          "reportOnly",
          "readyToEnforce"
        ],
        "format": "powershell",
        "kind": "deployableAfterBinding",
        "invocation": {
          "modeParameter": "Mode",
          "correctionsParameter": "Corrections",
          "parameters": {
            "PolicyDisplayName": {
              "binding": "policy.target.displayName",
              "modes": [
                "Create"
              ]
            },
            "PolicyId": {
              "binding": "policy.current.id",
              "modes": [
                "Correct",
                "Verify",
                "Enforce"
              ]
            },
            "ExcludeGroupIds": {
              "binding": "policy.target.excludeGroups",
              "modes": [
                "Create",
                "Correct",
                "Verify",
                "Enforce"
              ]
            },
            "AuthenticationStrengthId": {
              "binding": "authStrength.target.id",
              "modes": [
                "Create",
                "Correct",
                "Verify",
                "Enforce"
              ]
            },
            "LegacyDeviceMfaToggleConfirmedNo": {
              "switch": true,
              "prerequisite": "legacy-device-mfa-toggle",
              "modes": [
                "Enforce"
              ]
            },
            "EnrollmentWorkflowsValidated": {
              "switch": true,
              "prerequisite": "enrollment-workflows",
              "modes": [
                "Enforce"
              ]
            },
            "ExternalAuthenticationCompatibilityResolved": {
              "switch": true,
              "prerequisite": "external-auth-methods",
              "modes": [
                "Enforce"
              ]
            }
          }
        }
      },
      "text": "# IAMAI compact implementation script — Require MFA to Register a Device\n# Required module: Microsoft.Graph.Authentication\n# Create/Correct/Enforce delegated scopes: Policy.Read.All, Policy.ReadWrite.ConditionalAccess\n# Verify delegated scope: Policy.Read.All\n# Mutation role: Conditional Access Administrator or Security Administrator\n\n[CmdletBinding()]\nparam(\n    [Parameter(Mandatory)]\n    [ValidateSet('Create','Correct','Verify','Enforce')]\n    [string] $Mode,\n\n    [string] $PolicyDisplayName,\n    [ValidatePattern('^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$')]\n    [string] $PolicyId,\n    [string[]] $ExcludeGroupIds,\n    [ValidatePattern('^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$')]\n    [string] $AuthenticationStrengthId,\n\n    [ValidateSet('Conditions','Grant','ReportOnly')]\n    [string[]] $Corrections,\n\n    [switch] $LegacyDeviceMfaToggleConfirmedNo,\n    [switch] $EnrollmentWorkflowsValidated,\n    [switch] $ExternalAuthenticationCompatibilityResolved\n)\n\nSet-StrictMode -Version Latest\n$ErrorActionPreference = 'Stop'\nif ([string]::IsNullOrWhiteSpace($AuthenticationStrengthId)) { throw 'IAMAI must supply the resolved authentication strength ID.' }\n$StrengthId = $AuthenticationStrengthId\n$BaseUri = 'https://graph.microsoft.com/v1.0/identity/conditionalAccess/policies'\n$GuidPattern = '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'\n\nfunction Assert-ExcludeIds {\n    param([string[]] $Ids)\n    if (-not $Ids -or $Ids.Count -lt 1) { throw 'IAMAI must supply the complete canonical exclusion group ID set.' }\n    $invalid = @($Ids | Where-Object { $_ -notmatch $GuidPattern })\n    if ($invalid.Count -gt 0) { throw 'One or more exclusion group IDs are invalid.' }\n}\n\nfunction Connect-IAMAIContext {\n    param([string[]] $Scopes)\n    Import-Module Microsoft.Graph.Authentication -ErrorAction Stop\n    $context = Get-MgContext\n    $missing = if ($context) { @($Scopes | Where-Object { $_ -notin @($context.Scopes) }) } else { @($Scopes) }\n    if (-not $context -or $missing.Count -gt 0) {\n        Connect-MgGraph -Scopes $Scopes -NoWelcome\n    }\n}\n\nfunction Get-PolicyById {\n    param([string] $Id)\n    if (-not $Id) { throw 'This mode requires the IAMAI-resolved stable policy ID.' }\n    $p = Invoke-MgGraphRequest -Method GET -Uri \"$BaseUri/$Id\"\n    if (-not $p.id -or $p.id -ne $Id) { throw 'Stable-ID policy read-back failed.' }\n    return $p\n}\n\nfunction Assert-CanonicalPolicy {\n    param(\n        $Policy,\n        [string[]] $ExpectedExcludeGroupIds,\n        [ValidateSet('enabledForReportingButNotEnforced','enabled')]\n        [string] $ExpectedState\n    )\n    Assert-ExcludeIds $ExpectedExcludeGroupIds\n    $errors = [System.Collections.Generic.List[string]]::new()\n    if ($Policy.state -ne $ExpectedState) { $errors.Add(\"Policy state is '$($Policy.state)', expected '$ExpectedState'.\") }\n    if (@($Policy.conditions.users.includeUsers).Count -ne 1 -or @($Policy.conditions.users.includeUsers)[0] -ne 'All') { $errors.Add('Included users are not exactly All.') }\n    if ((@($Policy.conditions.users.excludeGroups | Sort-Object) -join '|') -ne (@($ExpectedExcludeGroupIds | Sort-Object) -join '|')) { $errors.Add('Exclusion group set differs from IAMAI canonical target.') }\n    if (@($Policy.conditions.applications.includeUserActions).Count -ne 1 -or @($Policy.conditions.applications.includeUserActions)[0] -ne 'urn:user:registerdevice') { $errors.Add('User Action is not urn:user:registerdevice.') }\n    if (@($Policy.conditions.applications.includeApplications).Count -ne 0 -or @($Policy.conditions.applications.excludeApplications).Count -ne 0) { $errors.Add('Cloud application scope is present.') }\n    if (@($Policy.conditions.clientAppTypes).Count -ne 1 -or @($Policy.conditions.clientAppTypes)[0] -ne 'all') { $errors.Add('clientAppTypes differs from canonical Graph representation.') }\n    if (@($Policy.conditions.signInRiskLevels).Count -ne 0 -or @($Policy.conditions.userRiskLevels).Count -ne 0 -or @($Policy.conditions.servicePrincipalRiskLevels).Count -ne 0) { $errors.Add('A noncanonical risk condition is present.') }\n    foreach ($name in @('locations','platforms','devices','authenticationFlows','insiderRiskLevels')) {\n        if ($null -ne $Policy.conditions.$name) { $errors.Add(\"Noncanonical condition is present: $name\") }\n    }\n    if ($Policy.grantControls.authenticationStrength.id -ne $StrengthId) { $errors.Add('Authentication strength differs from the IAMAI-resolved strength.') }\n    if (@($Policy.grantControls.builtInControls).Count -ne 0) { $errors.Add('A built-in grant is present in addition to authentication strength.') }\n    if ($null -ne $Policy.sessionControls) { $errors.Add('Session controls are present.') }\n    if ($errors.Count -gt 0) {\n        $errors | ForEach-Object { Write-Error $_ }\n        throw 'Canonical policy verification failed.'\n    }\n}\n\nswitch ($Mode) {\n    'Create' {\n        if ([string]::IsNullOrWhiteSpace($PolicyDisplayName)) { throw 'Create requires PolicyDisplayName.' }\n        Assert-ExcludeIds $ExcludeGroupIds\n        Connect-IAMAIContext @('Policy.Read.All','Policy.ReadWrite.ConditionalAccess')\n\n        $escapedName = $PolicyDisplayName.Replace(\"'\", \"''\")\n        $encodedFilter = [uri]::EscapeDataString(\"displayName eq '$escapedName'\")\n        $matches = @((Invoke-MgGraphRequest -Method GET -Uri \"$BaseUri?`$filter=$encodedFilter\").value)\n        if ($matches.Count -gt 0) { throw 'A Conditional Access policy already has this exact display name. Rescan IAMAI; do not create a duplicate.' }\n\n        $body = @{\n            displayName = $PolicyDisplayName\n            state = 'enabledForReportingButNotEnforced'\n            conditions = @{\n                users = @{ includeUsers=@('All'); excludeUsers=@(); includeGroups=@(); excludeGroups=@($ExcludeGroupIds); includeRoles=@(); excludeRoles=@() }\n                applications = @{ includeApplications=@(); excludeApplications=@(); includeUserActions=@('urn:user:registerdevice') }\n                clientAppTypes=@('all'); signInRiskLevels=@(); userRiskLevels=@(); servicePrincipalRiskLevels=@()\n            }\n            grantControls = @{ operator='OR'; builtInControls=@(); customAuthenticationFactors=@(); termsOfUse=@(); authenticationStrength=@{id=$StrengthId} }\n        }\n        $created = Invoke-MgGraphRequest -Method POST -Uri $BaseUri -Body ($body | ConvertTo-Json -Depth 20) -ContentType 'application/json'\n        if (-not $created.id) { throw 'Microsoft Graph did not return a policy ID.' }\n        $after = Get-PolicyById $created.id\n        Assert-CanonicalPolicy -Policy $after -ExpectedExcludeGroupIds $ExcludeGroupIds -ExpectedState 'enabledForReportingButNotEnforced'\n        Write-Host \"Created policy ID $($created.id) in Report-only. Rescan IAMAI.\"\n    }\n\n    'Correct' {\n        if (-not $Corrections -or $Corrections.Count -lt 1) { throw 'Correct requires at least one Corrections value.' }\n        if ($Corrections -contains 'Conditions') { Assert-ExcludeIds $ExcludeGroupIds }\n        Connect-IAMAIContext @('Policy.Read.All','Policy.ReadWrite.ConditionalAccess')\n        $current = Get-PolicyById $PolicyId\n        $body = @{}\n\n        if ($Corrections -contains 'Conditions') {\n            $body.conditions = @{\n                users = @{ includeUsers=@('All'); excludeUsers=@(); includeGroups=@(); excludeGroups=@($ExcludeGroupIds); includeRoles=@(); excludeRoles=@() }\n                applications = @{ includeApplications=@(); excludeApplications=@(); includeUserActions=@('urn:user:registerdevice'); applicationFilter=$null }\n                clientAppTypes=@('all'); signInRiskLevels=@(); userRiskLevels=@(); servicePrincipalRiskLevels=@()\n                locations=$null; platforms=$null; devices=$null; authenticationFlows=$null; insiderRiskLevels=$null\n            }\n        }\n        if ($Corrections -contains 'Grant') {\n            $body.grantControls = @{ operator='OR'; builtInControls=@(); customAuthenticationFactors=@(); termsOfUse=@(); authenticationStrength=@{id=$StrengthId} }\n        }\n        if ($Corrections -contains 'ReportOnly') {\n            $body.state = 'enabledForReportingButNotEnforced'\n        }\n\n        Invoke-MgGraphRequest -Method PATCH -Uri \"$BaseUri/$PolicyId\" -Body ($body | ConvertTo-Json -Depth 20) -ContentType 'application/json' | Out-Null\n        $after = Get-PolicyById $PolicyId\n        if ($Corrections -contains 'Conditions') {\n            if (@($after.conditions.users.includeUsers).Count -ne 1 -or @($after.conditions.users.includeUsers)[0] -ne 'All') { throw 'Verification failed: All users is not canonical.' }\n            if ((@($after.conditions.users.excludeGroups | Sort-Object) -join '|') -ne (@($ExcludeGroupIds | Sort-Object) -join '|')) { throw 'Verification failed: exclusions differ from canonical target.' }\n            if (@($after.conditions.applications.includeUserActions).Count -ne 1 -or @($after.conditions.applications.includeUserActions)[0] -ne 'urn:user:registerdevice') { throw 'Verification failed: User Action target differs.' }\n        }\n        if ($Corrections -contains 'Grant' -and $after.grantControls.authenticationStrength.id -ne $StrengthId) { throw 'Verification failed: authentication strength differs.' }\n        if ($Corrections -contains 'ReportOnly' -and $after.state -ne 'enabledForReportingButNotEnforced') { throw 'Verification failed: policy is not Report-only.' }\n        Write-Host \"Correction verified on policy ID $PolicyId. Rescan IAMAI.\"\n    }\n\n    'Verify' {\n        Assert-ExcludeIds $ExcludeGroupIds\n        Connect-IAMAIContext @('Policy.Read.All')\n        $p = Get-PolicyById $PolicyId\n        Assert-CanonicalPolicy -Policy $p -ExpectedExcludeGroupIds $ExcludeGroupIds -ExpectedState 'enabledForReportingButNotEnforced'\n        Write-Host 'Canonical Report-only configuration verified. User Actions are not evaluated by Report-only; complete direct workflow validation before enforcement.'\n    }\n\n    'Enforce' {\n        if (-not $LegacyDeviceMfaToggleConfirmedNo) { throw 'Enforcement stopped: confirm the legacy device-registration MFA toggle is No.' }\n        if (-not $EnrollmentWorkflowsValidated) { throw 'Enforcement stopped: enrollment workflows are not validated.' }\n        if (-not $ExternalAuthenticationCompatibilityResolved) { throw 'Enforcement stopped: external-authentication-method compatibility is unresolved.' }\n        Assert-ExcludeIds $ExcludeGroupIds\n        Connect-IAMAIContext @('Policy.Read.All','Policy.ReadWrite.ConditionalAccess')\n        $current = Get-PolicyById $PolicyId\n        Assert-CanonicalPolicy -Policy $current -ExpectedExcludeGroupIds $ExcludeGroupIds -ExpectedState 'enabledForReportingButNotEnforced'\n        Invoke-MgGraphRequest -Method PATCH -Uri \"$BaseUri/$PolicyId\" -Body (@{state='enabled'} | ConvertTo-Json) -ContentType 'application/json' | Out-Null\n        $after = Get-PolicyById $PolicyId\n        Assert-CanonicalPolicy -Policy $after -ExpectedExcludeGroupIds $ExcludeGroupIds -ExpectedState 'enabled'\n        Write-Host \"Policy ID $PolicyId is enabled. Perform controlled registration/enrollment tests and rescan IAMAI.\"\n    }\n}\n"
    },
    "ai.create": {
      "meta": {
        "id": "ai.create",
        "channel": "aiInfo",
        "states": [
          "missing"
        ],
        "format": "markdown",
        "kind": "template"
      },
      "text": "ROLE\nYou are helping implement one IAMAI Plan step. Do not redesign the baseline or infer new tenant facts.\n\nGOAL\nCreate the Conditional Access policy that requires the pinned MFA authentication strength for Microsoft Entra device registration/join, initially in Report-only.\n\nAUTHORITY\n- IAMAI tenant/product facts and saved owner decisions own tenant-specific truth.\n- The baseline IAMAI plans from owns the destination for this step.\n- The authentication strength this policy requires, as IAMAI resolved it for this tenant, is {{authStrength.target.displayName}} (`{{authStrength.target.id}}`). Do not substitute a different or weaker strength.\n- Current Microsoft documentation owns current portal/API behavior.\n\nTENANT CONTEXT\n- Tenant: {{tenant.displayName}} [omit this line when unavailable]\n- Target policy name: {{policy.target.displayName}}\n- Canonical exclusions: {{policy.target.excludeGroups}}\n- Affected people count: {{people.affected.count}} [omit when unavailable]\n\nTARGET STATE\nAll users; IAMAI-resolved canonical exclusions; User Action `urn:user:registerdevice`; no cloud-app, location, platform, device/filter, risk, or authentication-flow condition; the resolved authentication strength {{authStrength.target.displayName}}; no session controls; Report-only.\n\nPREREQUISITES\nThe target name and exclusions above are the ones IAMAI resolved for this tenant. This text is complete only when every one of them is filled in; an exclusion still waiting on an answer about the baseline's own groups is not resolved yet, and the policy is not created until it is. Do not ask the administrator to rediscover resolved values. Enforcement has separate human checks for the legacy device-registration MFA setting and enrollment workflows.\n\nIMPLEMENTATION OPTIONS\nUse only the Entra steps, the JSON request or the PowerShell script in Create mode that IAMAI shows for this step. Do not create a duplicate if a matching policy is discovered; rescan IAMAI instead.\n\nDO NOT CHANGE\nDo not add device state/filter, Client apps, location, or cloud-application scope. Do not change the resolved authentication strength.\n\nVERIFICATION\nRead back the created policy, confirm Report-only canonical semantics, then rescan IAMAI. Do not treat Report-only as proof for this User Action.\n\nROLLBACK / SAFE RECOVERY\nIf creation is wrong, keep the policy non-enforcing and correct the same object; do not turn it On while mismatches remain.\n\nKNOWN UNKNOWNS\nReport-only does not evaluate User Actions. Enrollment workflows that IAMAI has not observed remain unknown.\n\nMICROSOFT REFERENCES\n- Require multifactor authentication for device registration: https://learn.microsoft.com/en-us/entra/identity/conditional-access/policy-all-users-device-registration\n- Conditional Access target resources: https://learn.microsoft.com/en-us/entra/identity/conditional-access/concept-conditional-access-cloud-apps\n- Analyze Conditional Access policy impact: https://learn.microsoft.com/en-us/entra/identity/conditional-access/concept-conditional-access-report-only\n\nYOUR ROLE\nReturn conclusions, checks, assumptions, evidence, and the smallest safe next action. If current Microsoft documentation conflicts with a supplied implementation detail, explain the conflict before recommending a change; do not silently replace IAMAI's approved target.\n"
    },
    "ai.correct": {
      "meta": {
        "id": "ai.correct",
        "channel": "aiInfo",
        "states": [
          "partial"
        ],
        "format": "markdown",
        "kind": "template"
      },
      "text": "ROLE\nHelp correct only the semantic mismatch(es) IAMAI supplied for this exact policy. Do not reconfigure fields IAMAI already says are correct.\n\nGOAL\nMove the existing resolved policy to the canonical Report-only target without creating a duplicate.\n\nAUTHORITY\n- IAMAI tenant/product facts and saved owner decisions own tenant-specific truth.\n- The baseline IAMAI plans from owns the destination for this step.\n- The authentication strength this policy requires, as IAMAI resolved it for this tenant, is {{authStrength.target.displayName}} (`{{authStrength.target.id}}`). Do not substitute a different or weaker strength.\n- Current Microsoft documentation owns current portal/API behavior.\n\nTENANT CONTEXT\n- Current policy ID: {{policy.current.id}}\n- Current policy name: {{policy.current.displayName}} [omit when unavailable]\n- Current state: {{policy.current.state}} [omit when unavailable]\n- IAMAI mismatches: {{policy.current.semanticMismatches}}\n- Canonical exclusions: {{policy.target.excludeGroups}}\n\nTARGET STATE\nAll users; canonical exclusions; only `urn:user:registerdevice`; no noncanonical conditions; the resolved authentication strength {{authStrength.target.displayName}}; Report-only until enforcement readiness is proven.\n\nIMPLEMENTATION OPTIONS\nUse only the correction module(s) mapped by IAMAI to the supplied semantic mismatches. Condition-related Graph/PowerShell corrections intentionally reconstruct the full canonical conditions object; grant and lifecycle corrections use separate PATCH boundaries.\n\nDO NOT CHANGE\nUse `policy.current.id` as update identity. Do not create another policy, broaden exclusions, add unsupported device/location/client conditions, or substitute a weaker authentication strength.\n\nVERIFICATION\nRead the same policy ID back, verify the corrected semantic field(s), and rescan IAMAI.\n\nROLLBACK / SAFE RECOVERY\nIf a correction creates unexpected risk, return the same policy to Report-only before further changes.\n\nMICROSOFT REFERENCES\n- Update conditionalAccessPolicy: https://learn.microsoft.com/en-us/graph/api/conditionalaccesspolicy-update?view=graph-rest-1.0\n- Conditional Access target resources: https://learn.microsoft.com/en-us/entra/identity/conditional-access/concept-conditional-access-cloud-apps\n\nYOUR ROLE\nExplain only the supplied mismatch(es), the safe correction, verification, and any blocker. Do not infer additional defects from raw tenant data.\n"
    },
    "ai.observe": {
      "meta": {
        "id": "ai.observe",
        "channel": "aiInfo",
        "states": [
          "reportOnly"
        ],
        "format": "markdown",
        "kind": "template"
      },
      "text": "ROLE\nHelp validate this already-Report-only policy for enforcement readiness. Do not repeat Create or Correct unless IAMAI supplies a new mismatch.\n\nGOAL\nCollect the evidence that still matters because Microsoft does not evaluate User Action policies in Report-only.\n\nAUTHORITY\n- IAMAI tenant/product facts and saved owner decisions own tenant-specific truth.\n- The baseline IAMAI plans from owns the destination for this step.\n- The authentication strength this policy requires, as IAMAI resolved it for this tenant, is {{authStrength.target.displayName}} (`{{authStrength.target.id}}`). Do not substitute a different or weaker strength.\n- Current Microsoft documentation owns current portal/API behavior.\n\nTENANT CONTEXT\n- Policy ID: {{policy.current.id}}\n- Current device-registration evidence: {{evidence.deviceRegistration}} [omit when unavailable]\n- Enrollment-workflow evidence: {{evidence.enrollmentWorkflows}} [omit when unavailable]\n- Current blockers: {{dependencies.blockers}} [omit when unavailable]\n\nCURRENT STATE\nThe policy is Report-only. Its configuration can be verified by object read-back, but Report-only logs do not prove the Register or join devices User Action.\n\nPREREQUISITES\nIdentify and validate actual registration/enrollment workflows. If Windows Configuration Designer bulk enrollment is used, account for Microsoft's package_{GUID} MFA limitation through an already-approved exception or a deliberate workflow decision.\n\nDO NOT CHANGE\nDo not turn the policy On solely because report-only logs are quiet. Do not invent exclusions for an unvalidated workflow.\n\nVERIFICATION\nUse controlled workflow tests and IAMAI evidence; rescan after evidence changes.\n\nMICROSOFT REFERENCES\n- Analyze Conditional Access policy impact: https://learn.microsoft.com/en-us/entra/identity/conditional-access/concept-conditional-access-report-only\n- Bulk enrollment for Windows devices: https://learn.microsoft.com/en-us/intune/intune-service/enrollment/windows-bulk-enroll\n\nYOUR ROLE\nSeparate confirmed evidence from unknowns, identify the remaining human workflow validation, and state what would make enforcement safe.\n"
    },
    "ai.enforce": {
      "meta": {
        "id": "ai.enforce",
        "channel": "aiInfo",
        "states": [
          "readyToEnforce"
        ],
        "format": "markdown",
        "kind": "template"
      },
      "text": "ROLE\nHelp perform the final enforcement transition for the exact IAMAI-resolved policy. Do not redesign or broaden the policy.\n\nGOAL\nChange only the verified policy lifecycle from Report-only to On after all human enforcement gates pass.\n\nAUTHORITY\n- IAMAI tenant/product facts and saved owner decisions own tenant-specific truth.\n- The baseline IAMAI plans from owns the destination for this step.\n- The authentication strength this policy requires, as IAMAI resolved it for this tenant, is {{authStrength.target.displayName}} (`{{authStrength.target.id}}`). Do not substitute a different or weaker strength.\n- Current Microsoft documentation owns current portal/API behavior.\n\nTENANT CONTEXT\n- Policy ID: {{policy.current.id}}\n- Canonical exclusions: {{policy.target.excludeGroups}}\n- Enrollment-workflow evidence: {{evidence.enrollmentWorkflows}} [omit when unavailable]\n\nPREREQUISITES\n- Enrollment workflows are validated or have owner-approved resolution.\n- External-authentication-method compatibility is resolved for affected users.\n- Human verification confirms the tenant-wide device-registration MFA toggle is No.\n\nIMPLEMENTATION OPTIONS\nUse only the Entra steps, the JSON request or the PowerShell script in Enforce mode that IAMAI shows for this step. The policy mutation is only `state: enabled`.\n\nDO NOT CHANGE\nDo not change users, exclusions, User Action, conditions, or grant during enforcement.\n\nVERIFICATION\nRead back the same stable policy ID, perform a controlled device registration/join test plus required enrollment workflow tests, and rescan IAMAI.\n\nROLLBACK / SAFE RECOVERY\nIf registration/enrollment fails unexpectedly, return the same policy to Report-only. If this rollout changed the legacy device-registration MFA toggle from Yes to No, restore its prior value while the CA policy is non-enforcing, then isolate the failure.\n\nMICROSOFT REFERENCES\n- Require multifactor authentication for device registration: https://learn.microsoft.com/en-us/entra/identity/conditional-access/policy-all-users-device-registration\n- Manage device identities using the Microsoft Entra admin center: https://learn.microsoft.com/en-us/entra/identity/devices/manage-device-identities\n- Troubleshoot Conditional Access authentication strengths: https://learn.microsoft.com/en-us/entra/identity/authentication/troubleshoot-authentication-strengths\n\nYOUR ROLE\nGive the smallest safe enforcement sequence, controlled validation, and recovery action. Do not recommend a different baseline strength or a duplicate policy.\n"
    },
    "email.users.pre-enforcement": {
      "meta": {
        "id": "email.users.pre-enforcement",
        "channel": "email",
        "states": [
          "readyToEnforce"
        ],
        "format": "markdown",
        "kind": "template",
        "audience": "affected-users",
        "communicationTrigger": "before-enforcement",
        "purpose": "pre-change-notice"
      },
      "text": "Subject: MFA will be required when adding or joining a device\n\nHi,\n\nWe’re preparing a security change for device registration. When you add or join a device to our organization, Microsoft may ask you to complete multifactor authentication before the device can be registered.\n\nFor most people, there is nothing to do ahead of time. If you are asked to verify your identity during device setup, follow the Microsoft sign-in prompt using your normal approved MFA method.\n\nIf you are setting up devices through a special enrollment or provisioning process, follow the instructions from IT instead of changing the setup yourself.\n\nIf device setup fails after the change, contact your normal IT support channel and tell them you were registering or joining a device.\n\nThanks,  \nIT\n"
    },
    "readiness.model": {
      "meta": {
        "id": "readiness.model",
        "channel": "readiness",
        "states": [
          "missing",
          "partial",
          "reportOnly",
          "readyToEnforce",
          "inPlace",
          "blocked",
          "needsDecision",
          "sourceConflict",
          "notLicensed"
        ],
        "format": "json",
        "kind": "sourceOnly"
      },
      "text": "{\n  \"version\": \"1.0\",\n  \"stepId\": \"s-goal-device-registration-mfa\",\n  \"tiles\": [\n    {\n      \"id\": \"readiness.exclusions\",\n      \"gate\": \"Exclusions\",\n      \"gateKey\": \"exclusions\",\n      \"sourceType\": \"tenant-evidence\",\n      \"requiredInput\": \"policy.target.excludeGroups\",\n      \"rules\": [\n        {\n          \"if\": {\n            \"present\": \"policy.target.excludeGroups\"\n          },\n          \"when\": \"canonical exclusion set is resolved and nonempty\",\n          \"result\": \"Ready\",\n          \"line\": \"IAMAI has the canonical exclusions this policy must preserve.\"\n        },\n        {\n          \"if\": {\n            \"absent\": \"policy.target.excludeGroups\"\n          },\n          \"when\": \"canonical exclusion set is unresolved\",\n          \"result\": \"Blocked\",\n          \"line\": \"Resolve the policy exclusions before creating or correcting it.\"\n        }\n      ]\n    },\n    {\n      \"id\": \"readiness.authentication-strength\",\n      \"gate\": \"Authentication strength\",\n      \"sourceType\": \"baseline-requirement\",\n      \"rules\": [\n        {\n          \"if\": {\n            \"present\": \"authStrength.target.id\"\n          },\n          \"when\": \"IAMAI resolved the strength this policy requires\",\n          \"result\": \"Ready\",\n          \"line\": \"IAMAI resolved the authentication strength this policy requires for this tenant.\"\n        },\n        {\n          \"if\": {\n            \"absent\": \"authStrength.target.id\"\n          },\n          \"when\": \"no strength is resolved yet\",\n          \"result\": \"Blocked\",\n          \"line\": \"This tenant has no authentication strength for this policy's requirement yet. Create it before this policy.\"\n        }\n      ]\n    },\n    {\n      \"id\": \"readiness.enrollment-workflows\",\n      \"gate\": \"Enrollment workflows\",\n      \"sourceType\": \"tenant-evidence\",\n      \"optionalInput\": \"evidence.enrollmentWorkflows\",\n      \"confirms\": [\n        \"enrollment-workflows\"\n      ],\n      \"rules\": [\n        {\n          \"if\": {\n            \"confirmed\": \"enrollment-workflows\"\n          },\n          \"when\": \"all known affected workflows have validated resolution\",\n          \"result\": \"Ready\",\n          \"line\": \"Known device-registration and enrollment workflows are validated.\"\n        },\n        {\n          \"if\": {\n            \"present\": \"evidence.enrollmentWorkflows\"\n          },\n          \"when\": \"a known workflow is unvalidated or incompatible\",\n          \"result\": \"Review required\",\n          \"line\": \"Validate the identified registration/enrollment workflow before enforcement.\"\n        },\n        {\n          \"if\": {\n            \"absent\": \"evidence.enrollmentWorkflows\"\n          },\n          \"when\": \"IAMAI has no usable workflow evidence\",\n          \"result\": \"Unknown\",\n          \"line\": \"IAMAI cannot prove unobserved enrollment workflows are safe.\"\n        }\n      ]\n    },\n    {\n      \"id\": \"readiness.enforcement-settings\",\n      \"gate\": \"Enforcement checks\",\n      \"sourceType\": \"microsoft-rule\",\n      \"confirms\": [\n        \"legacy-device-mfa-toggle\",\n        \"external-auth-methods\"\n      ],\n      \"rules\": [\n        {\n          \"if\": {\n            \"all\": [\n              {\n                \"state\": [\n                  \"missing\",\n                  \"partial\",\n                  \"reportOnly\",\n                  \"readyToEnforce\"\n                ]\n              },\n              {\n                \"not\": {\n                  \"all\": [\n                    {\n                      \"confirmed\": \"legacy-device-mfa-toggle\"\n                    },\n                    {\n                      \"confirmed\": \"external-auth-methods\"\n                    }\n                  ]\n                }\n              }\n            ]\n          },\n          \"when\": \"state is missing, partial, or reportOnly\",\n          \"result\": \"Review required\",\n          \"line\": \"Before enforcement, confirm the legacy device-registration MFA toggle is No and resolve external-authentication-method compatibility.\"\n        },\n        {\n          \"if\": {\n            \"all\": [\n              {\n                \"confirmed\": \"legacy-device-mfa-toggle\"\n              },\n              {\n                \"confirmed\": \"external-auth-methods\"\n              }\n            ]\n          },\n          \"when\": \"human enforcement checks are recorded complete by the existing workflow\",\n          \"result\": \"Ready\",\n          \"line\": \"Mandatory pre-enforcement checks are complete.\"\n        }\n      ]\n    }\n  ],\n  \"conclusions\": {\n    \"safeToCreateOrCorrect\": \"Ready to create or correct in Report-only when canonical exclusions and stable identity requirements are resolved.\",\n    \"safeToObserve\": \"Continue direct workflow validation; Report-only does not evaluate this User Action.\",\n    \"safeToEnforce\": \"Enforce only after enrollment workflows pass, external-authentication compatibility is resolved, and the legacy device-registration MFA toggle is confirmed No.\"\n  },\n  \"conclusionByState\": {\n    \"missing\": \"safeToCreateOrCorrect\",\n    \"partial\": \"safeToCreateOrCorrect\",\n    \"reportOnly\": \"safeToObserve\",\n    \"readyToEnforce\": \"safeToEnforce\"\n  },\n  \"whyIamAISaysThis\": {\n    \"id\": \"why-iamai-says-this\",\n    \"sections\": {\n      \"currentConclusion\": \"Render the conclusion for the current state only.\",\n      \"confirmed\": [\n        \"Use tenant evidence for the resolved exclusions and the current policy, and the pinned member's required authentication strength, resolved to this tenant's own strength.\"\n      ],\n      \"stillNeedsAttention\": [\n        \"Render unresolved enrollment-workflow evidence and the mandatory human pre-enforcement checks only when applicable.\"\n      ],\n      \"unknownCannotProve\": [\n        \"Report-only cannot prove User Action impact; unobserved enrollment workflows remain unknown.\"\n      ],\n      \"whyItMatters\": \"Enforcement can block device registration or break enrollment flows that cannot satisfy MFA.\",\n      \"nextSafeAction\": \"Use the state-specific projection in META.json.\",\n      \"readyWhen\": \"All state-specific blockers and human enforcement gates required for the next transition are complete.\",\n      \"microsoftReferences\": [\n        \"ms-device-registration\",\n        \"ms-report-only\",\n        \"ms-bulk-enrollment\"\n      ]\n    }\n  }\n}\n"
    },
    "troubleshooting.model": {
      "meta": {
        "id": "troubleshooting.model",
        "channel": "troubleshooting",
        "states": [
          "missing",
          "partial",
          "reportOnly",
          "readyToEnforce",
          "inPlace"
        ],
        "format": "json",
        "kind": "sourceOnly"
      },
      "text": "{\n  \"version\": \"1.0\",\n  \"stepId\": \"s-goal-device-registration-mfa\",\n  \"scenarios\": [\n    {\n      \"id\": \"policy-save-unsupported-condition\",\n      \"classification\": \"documented\",\n      \"title\": \"Policy won't save or the intended condition is unavailable\",\n      \"channels\": [\n        \"entra\",\n        \"json\",\n        \"powershell\"\n      ],\n      \"states\": [\n        \"missing\",\n        \"partial\"\n      ],\n      \"symptom\": \"The portal does not offer a condition for this User Action, or the policy/request cannot represent the intended combination.\",\n      \"likelyCauses\": [\n        \"Client apps, Filters for devices, or Device state was added to a Register or join devices User Action policy.\"\n      ],\n      \"check\": [\n        \"Compare the policy to the canonical User Action target and identify any noncanonical Client apps/device condition.\"\n      ],\n      \"fix\": [\n        \"Remove only the unsupported/noncanonical condition from the same resolved policy and keep the canonical User Action plus MFA authentication strength.\"\n      ],\n      \"doNot\": [\n        \"Do not create a duplicate policy or move the requirement to a different cloud-app target as a workaround.\"\n      ],\n      \"then\": [\n        \"Read the same policy ID back and rescan IAMAI.\"\n      ],\n      \"sources\": [\n        \"ms-target-resources\"\n      ]\n    },\n    {\n      \"id\": \"graph-permission-403\",\n      \"classification\": \"documented\",\n      \"title\": \"PowerShell or Graph returns 403\",\n      \"channels\": [\n        \"json\",\n        \"powershell\"\n      ],\n      \"states\": [\n        \"missing\",\n        \"partial\",\n        \"readyToEnforce\"\n      ],\n      \"symptom\": \"The Graph create or update request is forbidden.\",\n      \"likelyCauses\": [\n        \"The Graph session lacks Policy.Read.All plus Policy.ReadWrite.ConditionalAccess, or the delegated administrator lacks a supported role.\"\n      ],\n      \"check\": [\n        \"Inspect the Graph consented scopes and confirm the signed-in administrator is a Conditional Access Administrator or Security Administrator.\"\n      ],\n      \"fix\": [\n        \"Reconnect with only the documented Conditional Access permissions and use an account with the required role.\"\n      ],\n      \"doNot\": [\n        \"Do not grant broad directory write permissions merely to bypass the 403.\"\n      ],\n      \"then\": [\n        \"Retry the same stable-ID operation; do not create another policy.\"\n      ],\n      \"sources\": [\n        \"ms-graph-create\",\n        \"ms-graph-update\",\n        \"ms-powershell-request\"\n      ]\n    },\n    {\n      \"id\": \"authentication-strength-cannot-satisfy\",\n      \"classification\": \"documented\",\n      \"title\": \"A user cannot complete device registration after enforcement\",\n      \"channels\": [\n        \"entra\",\n        \"aiInfo\",\n        \"troubleshooting\"\n      ],\n      \"states\": [\n        \"readyToEnforce\",\n        \"inPlace\"\n      ],\n      \"symptom\": \"An in-scope user is blocked or cannot present an acceptable method during device registration/join.\",\n      \"likelyCauses\": [\n        \"The user has no registered and enabled method that satisfies the required authentication strength.\",\n        \"The flow depends on an external authentication method, which Microsoft currently documents as incompatible with authentication strength in this policy pattern.\"\n      ],\n      \"check\": [\n        \"Check the enforced authentication strength, enabled authentication-method policy, and the user’s registered methods. Determine whether an external authentication method is part of the affected flow.\"\n      ],\n      \"fix\": [\n        \"Return the policy to Report-only if the rollout is blocking required work; then fix the user/method or external-authentication compatibility without changing the pinned strength.\"\n      ],\n      \"doNot\": [\n        \"Do not weaken the baseline grant solely to make an uninvestigated workflow pass.\"\n      ],\n      \"then\": [\n        \"Repeat the controlled registration test and rescan IAMAI.\"\n      ],\n      \"sources\": [\n        \"ms-device-registration\",\n        \"ms-auth-strength-troubleshoot\"\n      ]\n    },\n    {\n      \"id\": \"wcd-bulk-enrollment-mfa\",\n      \"classification\": \"documented\",\n      \"title\": \"Windows bulk enrollment stops working after enforcement\",\n      \"channels\": [\n        \"entra\",\n        \"aiInfo\",\n        \"troubleshooting\"\n      ],\n      \"states\": [\n        \"reportOnly\",\n        \"readyToEnforce\",\n        \"inPlace\"\n      ],\n      \"symptom\": \"Windows Configuration Designer bulk enrollment cannot retrieve/use its bulk enrollment flow after MFA enforcement.\",\n      \"likelyCauses\": [\n        \"WCD uses a package_{GUID} account and Microsoft documents MFA as unsupported for this scenario.\"\n      ],\n      \"check\": [\n        \"Confirm whether the failing path is Windows Configuration Designer bulk enrollment and identify its approved package account/workflow handling.\"\n      ],\n      \"fix\": [\n        \"Return the CA policy to Report-only if required for recovery. Use the tenant’s owner-approved exclusion/workflow resolution; if none exists, stop and obtain that decision.\"\n      ],\n      \"doNot\": [\n        \"Do not invent or silently add a package account exclusion.\"\n      ],\n      \"then\": [\n        \"Re-test the bulk enrollment workflow before re-enforcement.\"\n      ],\n      \"sources\": [\n        \"ms-bulk-enrollment\"\n      ]\n    },\n    {\n      \"id\": \"legacy-device-mfa-toggle-conflict\",\n      \"classification\": \"documented\",\n      \"title\": \"The policy is On but device registration enforcement is inconsistent\",\n      \"channels\": [\n        \"entra\",\n        \"aiInfo\",\n        \"troubleshooting\"\n      ],\n      \"states\": [\n        \"readyToEnforce\",\n        \"inPlace\"\n      ],\n      \"symptom\": \"The Register or join devices Conditional Access policy is enabled but behavior is not consistent with the expected CA enforcement.\",\n      \"likelyCauses\": [\n        \"The tenant-wide Require multifactor authentication to register or join devices with Microsoft Entra setting is still Yes.\"\n      ],\n      \"check\": [\n        \"Open Entra ID > Devices > Overview > Device settings and inspect the tenant-wide device-registration MFA setting.\"\n      ],\n      \"fix\": [\n        \"For this Conditional Access implementation, set that tenant-wide setting to No, then test the controlled registration path again.\"\n      ],\n      \"then\": [\n        \"Confirm policy state by stable ID, repeat the controlled test, and rescan IAMAI.\"\n      ],\n      \"sources\": [\n        \"ms-device-registration\",\n        \"ms-device-settings\"\n      ]\n    },\n    {\n      \"id\": \"report-only-no-user-action-evidence\",\n      \"classification\": \"documented\",\n      \"title\": \"Report-only shows no useful result for device registration\",\n      \"channels\": [\n        \"entra\",\n        \"aiInfo\",\n        \"troubleshooting\"\n      ],\n      \"states\": [\n        \"reportOnly\"\n      ],\n      \"symptom\": \"The administrator expects Report-only logs to show whether Register or join devices would be blocked, but useful User Action evaluation is absent.\",\n      \"likelyCauses\": [\n        \"Microsoft does not evaluate policies scoped to User Actions in Report-only mode.\"\n      ],\n      \"check\": [\n        \"Confirm the policy is scoped to Register or join devices and verify its configuration by stable-ID read-back instead of relying on Report-only evaluation.\"\n      ],\n      \"fix\": [\n        \"Use controlled workflow validation and existing tenant evidence to establish readiness; leave the policy Report-only until those checks are complete.\"\n      ],\n      \"then\": [\n        \"Record the workflow evidence and rescan IAMAI.\"\n      ],\n      \"sources\": [\n        \"ms-report-only\"\n      ]\n    },\n    {\n      \"id\": \"iamai-still-partial\",\n      \"classification\": \"derived\",\n      \"title\": \"IAMAI still says the policy is missing or partial\",\n      \"channels\": [\n        \"entra\",\n        \"json\",\n        \"powershell\",\n        \"aiInfo\"\n      ],\n      \"states\": [\n        \"missing\",\n        \"partial\",\n        \"reportOnly\"\n      ],\n      \"symptom\": \"The administrator believes the policy was implemented, but IAMAI still classifies the step as Missing or Partial.\",\n      \"likelyCauses\": [\n        \"A security-significant field still differs: All users, canonical exclusions, User Action target, a noncanonical condition, authentication strength, or lifecycle.\",\n        \"A duplicate policy was created instead of correcting the stable resolved object.\"\n      ],\n      \"check\": [\n        \"Read the resolved policy by stable ID and compare only the security-significant fields in STEP.md to IAMAI’s semantic mismatches.\"\n      ],\n      \"fix\": [\n        \"Apply the smallest applicable correction module to the same stable policy ID; remove the mismatch rather than creating another policy.\"\n      ],\n      \"doNot\": [\n        \"Do not delete the resolved policy or create a second policy just to change IAMAI classification.\"\n      ],\n      \"then\": [\n        \"Read back the same ID and rescan IAMAI.\"\n      ],\n      \"sources\": [\n        \"ms-graph-get\",\n        \"ms-graph-update\"\n      ]\n    }\n  ]\n}\n"
    }
  }
}
```

### `reviews["s-goal-device-registration-mfa"]`

The baseline review of this package's member against the pin.

```json
{
  "status": "current",
  "reviewedPin": "90d9b890c4b9af2ac4bc02d97c06bf8900064b4c",
  "pinned": "90d9b890c4b9af2ac4bc02d97c06bf8900064b4c",
  "unchanged": [
    "aeb49474-5250-4b65-8b0a-56c47127ee0f"
  ],
  "changed": [],
  "removed": [],
  "added": [],
  "identityFallback": [],
  "renamed": [],
  "matchedByTarget": []
}
```

### `provenance["s-goal-device-registration-mfa"]`

```json
"baseline-member"
```

## 3. Plan strings

How the code reaches these words:

- `src/content/content.ts` imports `docs/design/content.json` and exports `pages = content.pages`.
- No Plan-page or opened-step file reads `pages.plan` as a whole. Each file casts `pages.plan` to the typed slice it needs, for example `PP = pages.plan as unknown as PlanPage` in Plan.tsx, `WHEN` in planBoard.ts, `F` in PlanFooter.tsx, `BLOCKED` in copy/reasons.ts, `IMPACT` in derive/whoLine.ts, `PLAN` in rowWhen.ts and `MAPPING_WORDS` in baselineMappings.ts.
- `src/content/render.ts` (the design-review renderer) reads `pages.plan` more broadly. It is not part of the Plan page.
- `planRows.ts`, `planLanes.ts`, `stepPackage.ts` and `StepSections.tsx` import no `pages` words at all.
- `ContentStep.tsx`, `CleanupStep.tsx` and `stepContract.ts` take most of an opened step's words from `pages.app` (the `app` export, e.g. `app.plan.stepContract`), `shared.engine` and `steps[]`, not from `pages.plan`. Those keys are outside this table.

The table lists all 104 leaf strings under `pages.plan`, in file order. The "Read by" column names the src/ file that reads each one, with its path to the Plan page or opened step where there is one. Keys with no reader are marked "(no reference found in src/)". Keys read only by the design-review renderer or a test say so.

| Key | Value | Read by |
|---|---|---|
| `pages.plan.h1` | Plan | src/ui/surfaces/Plan.tsx |
| `pages.plan.line1` | {steps} steps · {inPlace} in place · finishes {finish} · {weeks} | src/derive/planHeader.ts `headerLine1` → src/ui/surfaces/PrintPlan.tsx (also src/content/render.ts); Plan.tsx does not call `headerLine1` |
| `pages.plan.line1CannotFinish` | {steps} steps · {inPlace} in place · cannot finish until {blocker} | src/derive/planHeader.ts `headerLine1` → src/ui/surfaces/PrintPlan.tsx (also src/content/render.ts); Plan.tsx does not call `headerLine1` |
| `pages.plan.lengthTip` | The plan is {weeks} because {constraint}. | src/ui/surfaces/Plan.tsx (header length tip); also src/content/render.ts |
| `pages.plan.lengthTipEstimate` | Once nothing is held, the plan is about {weeks} because {constraint}. | src/ui/surfaces/Plan.tsx (header length tip) |
| `pages.plan.next` | next | src/ui/surfaces/Plan.tsx |
| `pages.plan.now` | now | src/ui/surfaces/rowWhen.ts; src/ui/surfaces/planBoard.ts (`genericNow`) |
| `pages.plan.readyOn` | ready {date} | src/ui/surfaces/rowWhen.ts (`PLAN`), imported by src/ui/surfaces/planBoard.ts → src/ui/surfaces/Plan.tsx |
| `pages.plan.readyNow` | ready now | src/ui/surfaces/rowWhen.ts (`PLAN`), imported by src/ui/surfaces/planBoard.ts → src/ui/surfaces/Plan.tsx |
| `pages.plan.heldForEvidence` | held until the records clear | src/ui/surfaces/rowWhen.ts (`PLAN`), imported by src/ui/surfaces/planBoard.ts → src/ui/surfaces/Plan.tsx |
| `pages.plan.heldForReview` | held until reviewed | src/ui/surfaces/rowWhen.ts (`PLAN`), imported by src/ui/surfaces/planBoard.ts → src/ui/surfaces/Plan.tsx |
| `pages.plan.satisfiedBy` | Satisfied by {policies} — no change needed | src/ui/surfaces/rowWhen.ts (`PLAN`), imported by src/ui/surfaces/planBoard.ts → src/ui/surfaces/Plan.tsx |
| `pages.plan.satisfiedTogether` | Satisfied by {policies} together — no change needed | src/ui/surfaces/rowWhen.ts (`PLAN`), imported by src/ui/surfaces/planBoard.ts → src/ui/surfaces/Plan.tsx |
| `pages.plan.impact.$comment` | The Impact column's words that are not a count (derive/whoLine.ts IMPACT). Unknown is never zero. | (no reference found in src/) — an annotation for authors |
| `pages.plan.impact.notEstablished` | Not established | src/derive/whoLine.ts `IMPACT` → src/ui/surfaces/rowWho.ts → src/ui/surfaces/Plan.tsx |
| `pages.plan.impact.noUserImpact` | No user impact | src/derive/whoLine.ts (`IMPACT`, `populationLine` → src/ui/surfaces/stepContract.ts); src/ui/surfaces/rowWho.ts → src/ui/surfaces/Plan.tsx |
| `pages.plan.impact.configurationOnly` | Configuration only | src/derive/whoLine.ts `IMPACT` → src/ui/surfaces/Plan.tsx; src/ui/surfaces/rowWho.ts |
| `pages.plan.when.$comment` | The board's When column where a row carries no date or reason of its own (planBoard.ts boardWhen): never blank (owner, 2026-09-11). | (no reference found in src/) — an annotation for authors |
| `pages.plan.when.complete` | Complete | src/ui/surfaces/planBoard.ts (`WHEN`) |
| `pages.plan.when.notScheduled` | Not scheduled | src/ui/surfaces/planBoard.ts (`WHEN`); src/ui/surfaces/cleanupExport.ts → src/ui/surfaces/CleanupStep.tsx |
| `pages.plan.when.after` | After {step} | src/ui/surfaces/planBoard.ts (`WHEN`); src/ui/surfaces/stepContract.ts (`whenWords`) |
| `pages.plan.when.afterPrerequisites` | After prerequisites | src/ui/surfaces/planBoard.ts (`WHEN`); src/ui/surfaces/stepContract.ts (`whenWords`) |
| `pages.plan.progress.$comment` | The Plan header's progress tiles (Plan.tsx), which replaced the generated status sentence (owner, 2026-09-11). | (no reference found in src/) — an annotation for authors |
| `pages.plan.progress.label` | Plan progress | src/ui/surfaces/Plan.tsx (header progress tiles) |
| `pages.plan.progress.steps` | Steps | src/ui/surfaces/Plan.tsx (header progress tiles) |
| `pages.plan.progress.inPlace` | In place | src/ui/surfaces/Plan.tsx (header progress tiles) |
| `pages.plan.progress.waiting` | Waiting | src/ui/surfaces/Plan.tsx (header progress tiles) |
| `pages.plan.progress.remaining` | Remaining | src/ui/surfaces/Plan.tsx (header progress tiles) |
| `pages.plan.progress.started` | Started {date} | src/ui/surfaces/Plan.tsx (header progress tiles) |
| `pages.plan.howTo.link` | How to use this plan → | src/ui/surfaces/Plan.tsx (How to use this plan) |
| `pages.plan.howTo.items[0]` | Preparation comes first: it makes the groups, accounts and answers later steps rely on. | src/ui/surfaces/Plan.tsx (How to use this plan) |
| `pages.plan.howTo.items[1]` | Work is scheduled onto eligible workdays, from the plan start and the first deployment day. | src/ui/surfaces/Plan.tsx (How to use this plan) |
| `pages.plan.howTo.items[2]` | A step that waits on another step is held until that step is done. | src/ui/surfaces/Plan.tsx (How to use this plan) |
| `pages.plan.howTo.items[3]` | Open a step to review its readiness, its implementation and when it is done. | src/ui/surfaces/Plan.tsx (How to use this plan) |
| `pages.plan.howTo.items[4]` | Plan settings sets the start, the first deployment and the change freeze. | src/ui/surfaces/Plan.tsx (How to use this plan) |
| `pages.plan.settingsLink` | Plan settings | src/ui/surfaces/Plan.tsx |
| `pages.plan.settings.h3` | Plan settings | src/ui/surfaces/Plan.tsx (Plan settings panel) |
| `pages.plan.settings.start` | Start date | src/ui/surfaces/Plan.tsx (Plan settings panel) |
| `pages.plan.settings.planStarts` | Plan starts | src/ui/surfaces/Plan.tsx (Plan settings panel) |
| `pages.plan.settings.firstDeployment` | First deployment | src/ui/surfaces/Plan.tsx (Plan settings panel) |
| `pages.plan.settings.firstDeploymentNote` | Preparation begins on the start date; policies are first created, in report-only, on the first deployment day. | src/ui/surfaces/Plan.tsx (Plan settings panel) |
| `pages.plan.settings.workdays` | Eligible workdays | src/ui/surfaces/Plan.tsx (Plan settings panel) |
| `pages.plan.settings.workdaysWeek` | Monday to Friday | src/ui/surfaces/Plan.tsx (Plan settings panel) |
| `pages.plan.settings.workdaysWith` | Monday to Friday and {days} | src/ui/surfaces/Plan.tsx (Plan settings panel) |
| `pages.plan.settings.freeze` | Change freeze | src/ui/surfaces/Plan.tsx (Plan settings panel) |
| `pages.plan.settings.freezeFrom` | from | src/ui/surfaces/Plan.tsx (Plan settings panel) |
| `pages.plan.settings.freezeTo` | to | src/ui/surfaces/Plan.tsx (Plan settings panel) |
| `pages.plan.settings.freezeNote` | No step enforces inside the freeze or on the last working day before it. | src/ui/surfaces/Plan.tsx (Plan settings panel) |
| `pages.plan.settings.timezone` | Time zone | src/ui/surfaces/Plan.tsx (Plan settings panel) |
| `pages.plan.settings.signature` | Emails signed as | src/ui/surfaces/Plan.tsx (Plan settings panel) |
| `pages.plan.settings.close` | Close | src/ui/surfaces/Plan.tsx (Plan settings panel) |
| `pages.plan.settings.mappings.h4` | Baseline mappings | src/ui/surfaces/baselineMappings.ts `MAPPING_WORDS` (→ src/ui/surfaces/BaselineMappings.tsx, rendered inside Plan settings) |
| `pages.plan.settings.mappings.intro` | The baseline names groups and locations of its author's own without saying what they are. For each one, pick the object in this tenant that stands in for it, or leave it out. Either answer can be changed here; until a reference has one, the policies that name it are on hold. | src/ui/surfaces/baselineMappings.ts `MAPPING_WORDS` (→ src/ui/surfaces/BaselineMappings.tsx, rendered inside Plan settings) |
| `pages.plan.settings.mappings.empty` | Every group and location the plan's policies name has an answer. | src/ui/surfaces/baselineMappings.ts `MAPPING_WORDS` (→ src/ui/surfaces/BaselineMappings.tsx, rendered inside Plan settings) |
| `pages.plan.settings.mappings.groupLabel` | Group {id} | src/ui/surfaces/baselineMappings.ts `MAPPING_WORDS` (→ src/ui/surfaces/BaselineMappings.tsx, rendered inside Plan settings) |
| `pages.plan.settings.mappings.locationLabel` | Named location {id} | src/ui/surfaces/baselineMappings.ts `MAPPING_WORDS` (→ src/ui/surfaces/BaselineMappings.tsx, rendered inside Plan settings) |
| `pages.plan.settings.mappings.status.pending` | Unmapped | src/ui/surfaces/baselineMappings.ts `MAPPING_WORDS` (→ src/ui/surfaces/BaselineMappings.tsx, rendered inside Plan settings) via `w.status[r.answer]` |
| `pages.plan.settings.mappings.status.mapped` | Mapped | src/ui/surfaces/baselineMappings.ts `MAPPING_WORDS` (→ src/ui/surfaces/BaselineMappings.tsx, rendered inside Plan settings) via `w.status[r.answer]` |
| `pages.plan.settings.mappings.status.omitted` | Left out | src/ui/surfaces/baselineMappings.ts `MAPPING_WORDS` (→ src/ui/surfaces/BaselineMappings.tsx, rendered inside Plan settings) via `w.status[r.answer]` |
| `pages.plan.settings.mappings.role.exclude` | Excluded from its policies | src/ui/surfaces/baselineMappings.ts `MAPPING_WORDS` (→ src/ui/surfaces/BaselineMappings.tsx, rendered inside Plan settings) via `w.role[role]` |
| `pages.plan.settings.mappings.role.include` | Included in its policies | src/ui/surfaces/baselineMappings.ts `MAPPING_WORDS` (→ src/ui/surfaces/BaselineMappings.tsx, rendered inside Plan settings) via `w.role[role]` |
| `pages.plan.settings.mappings.role.both` | Included in some of its policies, excluded from others | src/ui/surfaces/baselineMappings.ts `MAPPING_WORDS` (→ src/ui/surfaces/BaselineMappings.tsx, rendered inside Plan settings) via `w.role[role]` |
| `pages.plan.settings.mappings.usedBy` | Named in {policies}. | src/ui/surfaces/baselineMappings.ts `MAPPING_WORDS` (→ src/ui/surfaces/BaselineMappings.tsx, rendered inside Plan settings) |
| `pages.plan.settings.mappings.roleExclude` | The baseline leaves it out of {n} of its {total} policies: an exception to who they reach. | src/ui/surfaces/baselineMappings.ts `MAPPING_WORDS` (→ src/ui/surfaces/BaselineMappings.tsx, rendered inside Plan settings) via ``w[`role${suffix}`]`` |
| `pages.plan.settings.mappings.roleInclude` | The baseline names it as who {n} of its {total} policies reach. | src/ui/surfaces/baselineMappings.ts `MAPPING_WORDS` (→ src/ui/surfaces/BaselineMappings.tsx, rendered inside Plan settings) via ``w[`role${suffix}`]`` |
| `pages.plan.settings.mappings.roleBoth` | The baseline names it in {n} of its {total} policies: as who some of them reach, and as an exception to others. | src/ui/surfaces/baselineMappings.ts `MAPPING_WORDS` (→ src/ui/surfaces/BaselineMappings.tsx, rendered inside Plan settings) via ``w[`role${suffix}`]`` |
| `pages.plan.settings.mappings.omitExclude` | Leaving it out makes these policies in this tenant without this exception: the people it spared stay in scope, unless another exclusion in this tenant covers them. | src/ui/surfaces/baselineMappings.ts `MAPPING_WORDS` (→ src/ui/surfaces/BaselineMappings.tsx, rendered inside Plan settings) via ``w[`omit${suffix}`]`` |
| `pages.plan.settings.mappings.omitInclude` | Leaving it out makes these policies in this tenant without this group among who they reach: the people it stood for are not covered by them. | src/ui/surfaces/baselineMappings.ts `MAPPING_WORDS` (→ src/ui/surfaces/BaselineMappings.tsx, rendered inside Plan settings) via ``w[`omit${suffix}`]`` |
| `pages.plan.settings.mappings.omitBoth` | Leaving it out makes these policies in this tenant without it: where it was an exception the people it spared stay in scope, and where it said who a policy reaches those people are not covered. | src/ui/surfaces/baselineMappings.ts `MAPPING_WORDS` (→ src/ui/surfaces/BaselineMappings.tsx, rendered inside Plan settings) via ``w[`omit${suffix}`]`` |
| `pages.plan.settings.mappings.answered` | Your answer: {answer} | src/ui/surfaces/baselineMappings.ts `MAPPING_WORDS` (→ src/ui/surfaces/BaselineMappings.tsx, rendered inside Plan settings) |
| `pages.plan.settings.mappings.unanswered` | Not answered yet: the policies that name it are on hold. | src/ui/surfaces/baselineMappings.ts `MAPPING_WORDS` (→ src/ui/surfaces/BaselineMappings.tsx, rendered inside Plan settings) |
| `pages.plan.settings.mappings.clear` | Clear this answer | src/ui/surfaces/baselineMappings.ts `MAPPING_WORDS` (→ src/ui/surfaces/BaselineMappings.tsx, rendered inside Plan settings) |
| `pages.plan.settings.mappings.sourceId` | The baseline's identifier for it | src/ui/surfaces/baselineMappings.ts `MAPPING_WORDS` (→ src/ui/surfaces/BaselineMappings.tsx, rendered inside Plan settings) |
| `pages.plan.settings.mappings.options[0]` | None needed here: leave it out | src/ui/surfaces/baselineMappings.ts `MAPPING_WORDS` (→ src/ui/surfaces/BaselineMappings.tsx, rendered inside Plan settings) (`w.options`); src/roadmap/answers.ts (→ src/ui/surfaces/ContentStep.tsx) |
| `pages.plan.settings.mappings.options[1]` | Use this tenant's own: {object} | src/ui/surfaces/baselineMappings.ts `MAPPING_WORDS` (→ src/ui/surfaces/BaselineMappings.tsx, rendered inside Plan settings) (`w.options`); src/roadmap/answers.ts (→ src/ui/surfaces/ContentStep.tsx) |
| `pages.plan.settings.mappings.save` | Save | src/ui/surfaces/baselineMappings.ts `MAPPING_WORDS` (→ src/ui/surfaces/BaselineMappings.tsx, rendered inside Plan settings) |
| `pages.plan.blocked.after` | after: {stepTitle} | src/copy/reasons.ts (`BLOCKED`) → src/ui/surfaces/planBoard.ts, src/ui/surfaces/stepContract.ts (`BLOCKED_REASON`), and roadmap reason builders |
| `pages.plan.blocked.readiness` | when {measure} reaches {threshold} (now {value}) | src/copy/reasons.ts (`BLOCKED`) → src/ui/surfaces/planBoard.ts, src/ui/surfaces/stepContract.ts (`BLOCKED_REASON`), and roadmap reason builders |
| `pages.plan.blocked.count` | when {n} {thing} exist (now {have}) | src/copy/reasons.ts (`BLOCKED`) → src/ui/surfaces/planBoard.ts, src/ui/surfaces/stepContract.ts (`BLOCKED_REASON`), and roadmap reason builders |
| `pages.plan.blocked.baseline` | the baseline defines this policy two ways | src/copy/reasons.ts (`BLOCKED`) → src/ui/surfaces/planBoard.ts, src/ui/surfaces/stepContract.ts (`BLOCKED_REASON`), and roadmap reason builders |
| `pages.plan.blocked.exclusionsGroup` | until you choose the exclusions group | src/copy/reasons.ts (`BLOCKED`) → src/ui/surfaces/planBoard.ts, src/ui/surfaces/stepContract.ts (`BLOCKED_REASON`), and roadmap reason builders |
| `pages.plan.blocked.devicePlan` | until phones and computers are decided | src/copy/reasons.ts (`BLOCKED`) → src/ui/surfaces/planBoard.ts, src/ui/surfaces/stepContract.ts (`BLOCKED_REASON`), and roadmap reason builders |
| `pages.plan.blocked.unsettled` | until the groups the source policy leaves out are identified | src/copy/reasons.ts (`BLOCKED`) → src/ui/surfaces/planBoard.ts, src/ui/surfaces/stepContract.ts (`BLOCKED_REASON`), and roadmap reason builders |
| `pages.plan.blocked.sourceMapping` | Baseline references an unmapped group | src/copy/reasons.ts (`BLOCKED`) → src/ui/surfaces/planBoard.ts, src/ui/surfaces/stepContract.ts (`BLOCKED_REASON`), and roadmap reason builders |
| `pages.plan.blocked.pairUnmatched` | until both policies of the pair can be matched | src/copy/reasons.ts (`BLOCKED`) → src/ui/surfaces/planBoard.ts, src/ui/surfaces/stepContract.ts (`BLOCKED_REASON`), and roadmap reason builders |
| `pages.plan.blocked.noOperation` | until a scan rebuilds this step | src/copy/reasons.ts (`BLOCKED`) → src/ui/surfaces/planBoard.ts, src/ui/surfaces/stepContract.ts (`BLOCKED_REASON`), and roadmap reason builders |
| `pages.plan.blocked.emergency` | until emergency access is provably out of scope | src/copy/reasons.ts (`BLOCKED`) → src/ui/surfaces/planBoard.ts, src/ui/surfaces/stepContract.ts (`BLOCKED_REASON`), and roadmap reason builders |
| `pages.plan.gapSuffix.admin-session` | sessions expire {current}, the baseline wants {wanted} | src/content/render.ts only (the design review renderer) — not read by the Plan page or an opened step |
| `pages.plan.gapSuffix.guests-mfa` | requires MFA, the baseline wants {wanted} | (no reference found in src/) outside a test — listed only in src/content/content.test.ts |
| `pages.plan.gapSuffix.generic` | {current}, the baseline wants {wanted} | (no reference found in src/) |
| `pages.plan.footer.inPlace` | Already in place ({n}) | src/content/render.ts only (the design review renderer) — not read by the Plan page or an opened step (PlanFooter.tsx declares it in `FooterWords` but never reads it) |
| `pages.plan.footer.doesntApply` | Doesn't apply here ({n}) | src/ui/surfaces/PlanFooter.tsx (`F`) |
| `pages.plan.footer.doesntApplyRow` | {stepTitle}: you said: {reason} | src/ui/surfaces/PlanFooter.tsx (`F`) |
| `pages.plan.footer.notLicensed` | Not licensed ({n}) | src/derive/notLicensed.ts → src/ui/surfaces/PlanFooter.tsx, src/ui/surfaces/PrintPlan.tsx |
| `pages.plan.footer.notLicensedRow` | {stepTitle}: needs a licence this tenant does not hold: {licence} | src/derive/notLicensed.ts → src/ui/surfaces/PlanFooter.tsx, src/ui/surfaces/PrintPlan.tsx |
| `pages.plan.footer.notLicensedNote` | Nothing in the plan waits on these. | src/derive/notLicensed.ts → src/ui/surfaces/PlanFooter.tsx, src/ui/surfaces/PrintPlan.tsx |
| `pages.plan.footer.notLicensedDevices` | {steps}: need an Intune Plan 1 licence this tenant does not hold; no device policy is offered and nothing asks how devices are managed | src/derive/notLicensed.ts → src/ui/surfaces/PlanFooter.tsx, src/ui/surfaces/PrintPlan.tsx |
| `pages.plan.footer.housekeeping` | Housekeeping ({n}) | src/ui/surfaces/PlanFooter.tsx (`F`) |
| `pages.plan.footer.notInBaseline` | {policy}: not in the baseline · {verdict} | src/ui/surfaces/PlanFooter.tsx (`F`) |
| `pages.plan.footer.notInBaselineKeep` | fine to keep | src/ui/surfaces/PlanFooter.tsx (`F`) |
| `pages.plan.footer.notInBaselineReview` | review | (no reference found in src/) |
| `pages.plan.footer.rename` | {policy}: off the tenant's naming convention · proposed {proposed} | src/content/render.ts only (the design review renderer) — not read by the Plan page or an opened step |
| `pages.plan.startControl` | Start the plan | src/derive/planHeader.ts `startControl()` → src/ui/surfaces/Plan.tsx |
| `pages.plan.line1Started` | {steps} steps · {done} done · started {start} · finishes {finish} | src/derive/planHeader.ts `headerLine1` → src/ui/surfaces/PrintPlan.tsx (also src/content/render.ts); Plan.tsx does not call `headerLine1` |

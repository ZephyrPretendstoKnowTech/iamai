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
6. Leave noncanonical conditions unset. Microsoft makes **Client apps**, **Filters for devices**, and **Device state** unavailable for this User Action; the retained pinned target also has no device-platform, location, risk, or authentication-flow conditions.
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
IAMAI already resolved the target name and exclusions. Do not ask the administrator to rediscover them. Enforcement has separate human checks for the legacy device-registration MFA setting and enrollment workflows.

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
        "Use tenant evidence for resolved exclusions/current policy and the retained pinned baseline for the MFA strength."
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

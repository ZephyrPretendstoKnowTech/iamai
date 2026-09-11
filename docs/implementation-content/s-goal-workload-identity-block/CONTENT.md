# IAMAI renderable content — Restrict the Entra Connect Sync Account to Its Address

@@IAMAI-BEGIN {"id":"entra.location.create","channel":"entra","states":["locationMissing"],"format":"markdown","kind":"template"}
Create only the prerequisite named location in this state.

1. In Microsoft Entra admin center, go to **Entra ID > Conditional Access > Named locations**.
2. Create an **IP ranges location** named **{{location.syncServer.displayName}}**.
3. Enter the complete IAMAI-approved Cloud Sync server public IP/CIDR set.
4. Do not invent a broader subnet or add other office/trusted addresses.
5. Save the named location.
6. Rescan IAMAI so the new named location has a stable tenant ID before the workload policy is created.

Microsoft reference: https://learn.microsoft.com/en-us/graph/api/conditionalaccessroot-post-namedlocations?view=graph-rest-1.0
@@IAMAI-END

@@IAMAI-BEGIN {"id":"entra.policy.create","channel":"entra","states":["missing"],"format":"markdown","kind":"template"}
The approved sync-server named location is already resolved. Create only the workload policy.

1. Go to **Entra ID > Conditional Access > Policies > New policy**.
2. Name the policy **{{policy.target.displayName}}**.
3. Under **Users or workload identities**, choose **Workload identities**.
4. Under **Include > Select service principals**, select the exact Entra Cloud Sync provisioning service principal that IAMAI resolved. Use the service principal **Object ID from Enterprise applications**, not the App registrations Object ID.
5. Under **Target resources > Resources**, include **All resources**.
6. Under **Conditions > Locations**, include **Any location** and exclude the IAMAI-resolved sync-server named location.
7. Under **Grant**, select **Block access**.
8. Set **Enable policy** to **Report-only**, then create it.
9. Rescan IAMAI and proceed to service-principal sign-in validation before enforcement.

Microsoft reference: https://learn.microsoft.com/en-us/entra/identity/conditional-access/workload-identity
@@IAMAI-END

@@IAMAI-BEGIN {"id":"entra.correct.open","channel":"entra","states":["partial"],"format":"markdown","kind":"template"}
Open the IAMAI-resolved named location and/or workload Conditional Access policy by their stable tenant IDs. Do not create replacements.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"entra.correct.ensure-report-only","channel":"entra","states":["partial"],"format":"markdown","kind":"template"}
Before changing the approved named-location ranges or any security-significant workload-policy field, make sure the existing workload policy is **Report-only**. If it is On, return that same policy to Report-only first.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"entra.correct.location.ip-ranges","channel":"entra","states":["partial"],"format":"markdown","kind":"template"}
If the workload policy is currently On and the location range is wrong, return the workload policy to Report-only before changing the allowed address.

Open the resolved IP named location and replace its IP ranges with the **complete** IAMAI-approved Cloud Sync server range set. Microsoft documents that omitted ranges are removed during an `ipRanges` update, so do not submit only the newly changed address.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"entra.correct.policy.service-principal","channel":"entra","states":["partial"],"format":"markdown","kind":"template"}
Under **Users or workload identities > Workload identities**, directly include only the IAMAI-resolved Cloud Sync provisioning service principal. Do not substitute a group, managed identity, App registrations Object ID, or all service principals.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"entra.correct.policy.all-resources","channel":"entra","states":["partial"],"format":"markdown","kind":"template"}
Under **Target resources > Resources**, set Include to **All resources**. Remove narrower or unrelated resource assignments from this retained target.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"entra.correct.policy.location-boundary","channel":"entra","states":["partial"],"format":"markdown","kind":"template"}
Under **Conditions > Locations**, include **Any location** and exclude only the IAMAI-resolved sync-server named location. Do not replace it with **All trusted locations** or a broader office-location set.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"entra.correct.policy.client-apps","channel":"entra","states":["partial"],"format":"markdown","kind":"template"}
Make the policy's retained client-app representation match `all`. Do not add a narrower user/client application condition that changes workload applicability.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"entra.correct.policy.remove-noncanonical","channel":"entra","states":["partial"],"format":"markdown","kind":"template"}
Remove user/group, device, platform, authentication-flow, and risk conditions that IAMAI has classified as noncanonical for this location-only Cloud Sync workload policy. Preserve the direct workload identity and location boundary.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"entra.correct.policy.grant-block","channel":"entra","states":["partial"],"format":"markdown","kind":"template"}
Under **Grant**, select **Block access** as the only grant control.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"entra.correct.policy.report-only","channel":"entra","states":["partial"],"format":"markdown","kind":"template"}
Set **Enable policy** to **Report-only** while correcting or revalidating a material workload/location mismatch.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"entra.correct.save-verify","channel":"entra","states":["partial"],"format":"markdown","kind":"template"}
Save the same object(s), read them back, and rescan IAMAI. Do not enforce until the named location and workload policy both match the canonical target and service-principal sign-in evidence is ready.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"entra.observe","channel":"entra","states":["reportOnly"],"format":"markdown","kind":"template"}
The workload policy is already in Report-only. Do not recreate it.

1. Go to **Entra ID > Monitoring & health > Sign-in logs > Service principal sign-ins**.
2. Review Cloud Sync provisioning service-principal events that represent normal synchronization activity.
3. Open the **Report-only** Conditional Access result and confirm the policy is evaluated as expected.
4. Compare the observed source IP with the approved sync-server named-location range.
5. If the source address is missing, unstable, or outside the approved range, do not enforce yet.
6. Rescan IAMAI when the evidence or named location changes.

Microsoft reference: https://learn.microsoft.com/en-us/entra/identity/conditional-access/workload-identity
@@IAMAI-END

@@IAMAI-BEGIN {"id":"entra.enforce","channel":"entra","states":["readyToEnforce"],"format":"markdown","kind":"template"}
IAMAI has reached the enforcement state; do not rebuild the location or policy.

1. Confirm the Cloud Sync server's current public egress address still matches the approved named location.
2. Open the exact IAMAI-resolved workload policy.
3. Change **Enable policy** from **Report-only** to **On** and save.
4. Trigger or observe a fresh Cloud Sync operation from the approved server and verify it succeeds.
5. If synchronization fails, return this same policy to Report-only before changing the named location.
6. Rescan IAMAI.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"json.location.create","channel":"json","states":["locationMissing"],"format":"json-template","kind":"deployableAfterBinding","method":"POST","endpoint":"https://graph.microsoft.com/v1.0/identity/conditionalAccess/namedLocations"}
{
  "@odata.type": "#microsoft.graph.ipNamedLocation",
  "displayName": {{json:location.syncServer.displayName}},
  "ipRanges": {{json:location.syncServer.ipRanges}}
}
@@IAMAI-END

@@IAMAI-BEGIN {"id":"json.policy.create","channel":"json","states":["missing"],"format":"json-template","kind":"deployableAfterBinding","method":"POST","endpoint":"https://graph.microsoft.com/v1.0/identity/conditionalAccess/policies"}
{
  "displayName": {{json:policy.target.displayName}},
  "state": "enabledForReportingButNotEnforced",
  "conditions": {
    "clientAppTypes": ["all"],
    "applications": {
      "includeApplications": ["All"],
      "excludeApplications": []
    },
    "clientApplications": {
      "includeServicePrincipals": [{{json:workload.cloudSync.servicePrincipalId}}],
      "excludeServicePrincipals": []
    },
    "locations": {
      "includeLocations": ["All"],
      "excludeLocations": [{{json:location.syncServer.id}}]
    },
    "signInRiskLevels": [],
    "userRiskLevels": [],
    "servicePrincipalRiskLevels": []
  },
  "grantControls": {
    "operator": "OR",
    "builtInControls": ["block"],
    "customAuthenticationFactors": [],
    "termsOfUse": []
  },
  "sessionControls": null
}
@@IAMAI-END

@@IAMAI-BEGIN {"id":"json.correct.location","channel":"json","states":["partial"],"format":"json-template","kind":"deployableAfterBinding","method":"PATCH","endpoint":"https://graph.microsoft.com/v1.0/identity/conditionalAccess/namedLocations/{location.current.id}"}
{
  "@odata.type": "#microsoft.graph.ipNamedLocation",
  "ipRanges": {{json:location.syncServer.ipRanges}}
}
@@IAMAI-END

@@IAMAI-BEGIN {"id":"json.correct.policy-conditions","channel":"json","states":["partial"],"format":"json-template","kind":"deployableAfterBinding","method":"PATCH","endpoint":"https://graph.microsoft.com/v1.0/identity/conditionalAccess/policies/{policy.current.id}"}
{
  "conditions": {
    "clientAppTypes": ["all"],
    "applications": {
      "includeApplications": ["All"],
      "excludeApplications": [],
      "includeUserActions": [],
      "applicationFilter": null
    },
    "clientApplications": {
      "includeServicePrincipals": [{{json:workload.cloudSync.servicePrincipalId}}],
      "excludeServicePrincipals": [],
      "servicePrincipalFilter": null
    },
    "locations": {
      "includeLocations": ["All"],
      "excludeLocations": [{{json:location.syncServer.id}}]
    },
    "signInRiskLevels": [],
    "userRiskLevels": [],
    "servicePrincipalRiskLevels": [],
    "users": null,
    "platforms": null,
    "devices": null,
    "authenticationFlows": null,
    "insiderRiskLevels": null
  }
}
@@IAMAI-END

@@IAMAI-BEGIN {"id":"json.correct.policy-grant","channel":"json","states":["partial"],"format":"json","kind":"deployableAfterBinding","method":"PATCH","endpoint":"https://graph.microsoft.com/v1.0/identity/conditionalAccess/policies/{policy.current.id}"}
{
  "grantControls": {
    "operator": "OR",
    "builtInControls": ["block"],
    "customAuthenticationFactors": [],
    "termsOfUse": []
  }
}
@@IAMAI-END

@@IAMAI-BEGIN {"id":"json.correct.report-only","channel":"json","states":["partial"],"format":"json","kind":"deployableAfterBinding","method":"PATCH","endpoint":"https://graph.microsoft.com/v1.0/identity/conditionalAccess/policies/{policy.current.id}"}
{
  "state": "enabledForReportingButNotEnforced"
}
@@IAMAI-END

@@IAMAI-BEGIN {"id":"json.enforce","channel":"json","states":["readyToEnforce"],"format":"json","kind":"deployableAfterBinding","method":"PATCH","endpoint":"https://graph.microsoft.com/v1.0/identity/conditionalAccess/policies/{policy.current.id}"}
{
  "state": "enabled"
}
@@IAMAI-END

@@IAMAI-BEGIN {"id":"powershell.run","channel":"powershell","states":["locationMissing","missing","partial","reportOnly","readyToEnforce"],"format":"powershell","kind":"deployableAfterBinding"}
# IAMAI compact implementation script — Restrict the Entra Connect Sync Account to Its Address
# Required module: Microsoft.Graph.Authentication
# Create/Correct/Enforce delegated scopes: Policy.Read.All, Policy.ReadWrite.ConditionalAccess
# Verify delegated scope: Policy.Read.All
# Mutation role: Conditional Access Administrator or Security Administrator

[CmdletBinding()]
param(
    [Parameter(Mandatory)]
    [ValidateSet('CreateLocation','CreatePolicy','Correct','Verify','Enforce')]
    [string] $Mode,

    [string] $LocationDisplayName,
    [object[]] $IpRanges,
    [ValidatePattern('^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$')]
    [string] $LocationId,

    [string] $PolicyDisplayName,
    [ValidatePattern('^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$')]
    [string] $PolicyId,
    [ValidatePattern('^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$')]
    [string] $ServicePrincipalId,

    [ValidateSet('Location','PolicyConditions','PolicyGrant','ReportOnly')]
    [string[]] $Corrections,

    [switch] $CurrentEgressAddressConfirmed,
    [switch] $ReportOnlyEvidenceReviewed
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$PolicyBase = 'https://graph.microsoft.com/v1.0/identity/conditionalAccess/policies'
$LocationBase = 'https://graph.microsoft.com/v1.0/identity/conditionalAccess/namedLocations'
$GuidPattern = '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'

function Connect-IAMAIContext {
    param([string[]] $Scopes)
    Import-Module Microsoft.Graph.Authentication -ErrorAction Stop
    $context = Get-MgContext
    $missing = if ($context) { @($Scopes | Where-Object { $_ -notin @($context.Scopes) }) } else { @($Scopes) }
    if (-not $context -or $missing.Count -gt 0) { Connect-MgGraph -Scopes $Scopes -NoWelcome }
}

function Assert-GuidValue {
    param([string] $Value,[string] $Label)
    if (-not $Value -or $Value -notmatch $GuidPattern) { throw "$Label must be the IAMAI-resolved stable GUID." }
}

function Assert-IpRanges {
    param([object[]] $Ranges)
    if (-not $Ranges -or $Ranges.Count -lt 1) { throw 'The complete approved sync-server IP range set is required.' }
    foreach ($range in $Ranges) {
        $type = $range.'@odata.type'
        $cidr = $range.cidrAddress
        if ($type -notin @('#microsoft.graph.iPv4CidrRange','#microsoft.graph.iPv6CidrRange') -or [string]::IsNullOrWhiteSpace([string]$cidr)) {
            throw 'Each IP range must contain a supported @odata.type and cidrAddress.'
        }
    }
}

function Get-PolicyById {
    param([string] $Id)
    Assert-GuidValue $Id 'PolicyId'
    $p = Invoke-MgGraphRequest -Method GET -Uri "$PolicyBase/$Id"
    if (-not $p.id -or $p.id -ne $Id) { throw 'Stable-ID policy read-back failed.' }
    return $p
}

function Get-LocationById {
    param([string] $Id)
    Assert-GuidValue $Id 'LocationId'
    $l = Invoke-MgGraphRequest -Method GET -Uri "$LocationBase/$Id"
    if (-not $l.id -or $l.id -ne $Id) { throw 'Stable-ID named-location read-back failed.' }
    return $l
}

function New-CanonicalPolicyConditions {
    param([string] $SpId,[string] $AllowedLocationId)
    Assert-GuidValue $SpId 'ServicePrincipalId'
    Assert-GuidValue $AllowedLocationId 'LocationId'
    return @{
        clientAppTypes=@('all')
        applications=@{ includeApplications=@('All'); excludeApplications=@(); includeUserActions=@(); applicationFilter=$null }
        clientApplications=@{ includeServicePrincipals=@($SpId); excludeServicePrincipals=@(); servicePrincipalFilter=$null }
        locations=@{ includeLocations=@('All'); excludeLocations=@($AllowedLocationId) }
        signInRiskLevels=@(); userRiskLevels=@(); servicePrincipalRiskLevels=@(); users=$null; platforms=$null; devices=$null; authenticationFlows=$null; insiderRiskLevels=$null
    }
}

function Assert-CanonicalPolicy {
    param($Policy,[string] $SpId,[string] $AllowedLocationId,[string] $ExpectedState)
    $errors = [System.Collections.Generic.List[string]]::new()
    if ($Policy.state -ne $ExpectedState) { $errors.Add("Policy state is '$($Policy.state)', expected '$ExpectedState'.") }
    if (@($Policy.conditions.clientApplications.includeServicePrincipals).Count -ne 1 -or @($Policy.conditions.clientApplications.includeServicePrincipals)[0] -ne $SpId) { $errors.Add('Workload policy does not directly target the expected service principal.') }
    if (@($Policy.conditions.applications.includeApplications).Count -ne 1 -or @($Policy.conditions.applications.includeApplications)[0] -ne 'All') { $errors.Add('Target resources are not All.') }
    if (@($Policy.conditions.clientAppTypes).Count -ne 1 -or @($Policy.conditions.clientAppTypes)[0] -ne 'all') { $errors.Add('clientAppTypes differs from retained target.') }
    if (@($Policy.conditions.locations.includeLocations).Count -ne 1 -or @($Policy.conditions.locations.includeLocations)[0] -ne 'All') { $errors.Add('Location include scope is not Any location.') }
    if (@($Policy.conditions.locations.excludeLocations).Count -ne 1 -or @($Policy.conditions.locations.excludeLocations)[0] -ne $AllowedLocationId) { $errors.Add('Allowed named-location exclusion differs from IAMAI target.') }
    if (@($Policy.grantControls.builtInControls).Count -ne 1 -or @($Policy.grantControls.builtInControls)[0] -ne 'block') { $errors.Add('Grant is not Block access.') }
    if ($null -ne $Policy.sessionControls) { $errors.Add('Session controls are noncanonical.') }
    foreach ($name in @('users','platforms','devices','authenticationFlows','insiderRiskLevels')) { if ($null -ne $Policy.conditions.$name) { $errors.Add("Noncanonical condition is present: $name") } }
    if (@($Policy.conditions.signInRiskLevels).Count -ne 0 -or @($Policy.conditions.userRiskLevels).Count -ne 0 -or @($Policy.conditions.servicePrincipalRiskLevels).Count -ne 0) { $errors.Add('A noncanonical risk condition is present.') }
    if ($errors.Count -gt 0) { $errors | ForEach-Object { Write-Error $_ }; throw 'Canonical workload policy verification failed.' }
}

switch ($Mode) {
    'CreateLocation' {
        if ([string]::IsNullOrWhiteSpace($LocationDisplayName)) { throw 'CreateLocation requires LocationDisplayName.' }
        Assert-IpRanges $IpRanges
        Connect-IAMAIContext @('Policy.Read.All','Policy.ReadWrite.ConditionalAccess')
        $escapedName = $LocationDisplayName.Replace("'", "''")
        $encodedFilter = [uri]::EscapeDataString("displayName eq '$escapedName'")
        $matches = @((Invoke-MgGraphRequest -Method GET -Uri "$LocationBase?`$filter=$encodedFilter").value)
        if ($matches.Count -gt 0) { throw 'A named location already has this exact display name. Rescan IAMAI; do not create a duplicate.' }
        $body = @{ '@odata.type'='#microsoft.graph.ipNamedLocation'; displayName=$LocationDisplayName; ipRanges=@($IpRanges) }
        $created = Invoke-MgGraphRequest -Method POST -Uri $LocationBase -Body ($body | ConvertTo-Json -Depth 20) -ContentType 'application/json'
        if (-not $created.id) { throw 'Microsoft Graph did not return a named-location ID.' }
        Write-Host "Created named location ID $($created.id). Rescan IAMAI before creating the workload policy."
    }
    'CreatePolicy' {
        if ([string]::IsNullOrWhiteSpace($PolicyDisplayName)) { throw 'CreatePolicy requires PolicyDisplayName.' }
        Assert-GuidValue $LocationId 'LocationId'
        Assert-GuidValue $ServicePrincipalId 'ServicePrincipalId'
        Connect-IAMAIContext @('Policy.Read.All','Policy.ReadWrite.ConditionalAccess')
        [void](Get-LocationById $LocationId)
        $escapedName = $PolicyDisplayName.Replace("'", "''")
        $encodedFilter = [uri]::EscapeDataString("displayName eq '$escapedName'")
        $matches = @((Invoke-MgGraphRequest -Method GET -Uri "$PolicyBase?`$filter=$encodedFilter").value)
        if ($matches.Count -gt 0) { throw 'A Conditional Access policy already has this exact display name. Rescan IAMAI; do not create a duplicate.' }
        $body = @{
            displayName=$PolicyDisplayName
            state='enabledForReportingButNotEnforced'
            conditions=(New-CanonicalPolicyConditions $ServicePrincipalId $LocationId)
            grantControls=@{ operator='OR'; builtInControls=@('block'); customAuthenticationFactors=@(); termsOfUse=@() }
            sessionControls=$null
        }
        $created = Invoke-MgGraphRequest -Method POST -Uri $PolicyBase -Body ($body | ConvertTo-Json -Depth 20) -ContentType 'application/json'
        if (-not $created.id) { throw 'Microsoft Graph did not return a policy ID.' }
        $after = Get-PolicyById $created.id
        Assert-CanonicalPolicy $after $ServicePrincipalId $LocationId 'enabledForReportingButNotEnforced'
        Write-Host "Created workload policy ID $($created.id) in Report-only. Rescan IAMAI."
    }
    'Correct' {
        if (-not $Corrections -or $Corrections.Count -lt 1) { throw 'Correct requires at least one Corrections value.' }
        Connect-IAMAIContext @('Policy.Read.All','Policy.ReadWrite.ConditionalAccess')

        if ($Corrections -contains 'ReportOnly') {
            [void](Get-PolicyById $PolicyId)
            Invoke-MgGraphRequest -Method PATCH -Uri "$PolicyBase/$PolicyId" -Body (@{state='enabledForReportingButNotEnforced'} | ConvertTo-Json) -ContentType 'application/json' | Out-Null
        }

        if ($Corrections -contains 'Location') {
            Assert-IpRanges $IpRanges
            [void](Get-LocationById $LocationId)
            $policy = if ($PolicyId) { Get-PolicyById $PolicyId } else { $null }
            if ($policy -and $policy.state -eq 'enabled') { throw 'Return the workload policy to Report-only before changing its allowed named-location IP ranges.' }
            $body = @{ '@odata.type'='#microsoft.graph.ipNamedLocation'; ipRanges=@($IpRanges) }
            Invoke-MgGraphRequest -Method PATCH -Uri "$LocationBase/$LocationId" -Body ($body | ConvertTo-Json -Depth 20) -ContentType 'application/json' | Out-Null
        }

        if ($Corrections -contains 'PolicyConditions' -or $Corrections -contains 'PolicyGrant') {
            $policy = Get-PolicyById $PolicyId
            if ($policy.state -eq 'enabled' -and $Corrections -notcontains 'ReportOnly') { throw 'A material policy correction requires the policy to be returned to Report-only first.' }
            $body = @{}
            if ($Corrections -contains 'PolicyConditions') { $body.conditions = New-CanonicalPolicyConditions $ServicePrincipalId $LocationId }
            if ($Corrections -contains 'PolicyGrant') { $body.grantControls = @{ operator='OR'; builtInControls=@('block'); customAuthenticationFactors=@(); termsOfUse=@() } }
            Invoke-MgGraphRequest -Method PATCH -Uri "$PolicyBase/$PolicyId" -Body ($body | ConvertTo-Json -Depth 20) -ContentType 'application/json' | Out-Null
        }
        Write-Host 'Correction applied to the existing object(s). Rescan IAMAI before enforcing.'
    }
    'Verify' {
        Assert-GuidValue $LocationId 'LocationId'
        Assert-GuidValue $ServicePrincipalId 'ServicePrincipalId'
        Connect-IAMAIContext @('Policy.Read.All')
        [void](Get-LocationById $LocationId)
        $p = Get-PolicyById $PolicyId
        Assert-CanonicalPolicy $p $ServicePrincipalId $LocationId $p.state
        if ($p.state -notin @('enabledForReportingButNotEnforced','enabled')) { throw "Unexpected lifecycle state '$($p.state)'." }
        Write-Host 'Canonical workload policy shape verified. Enforcement still depends on current egress and Report-only evidence.'
    }
    'Enforce' {
        Assert-GuidValue $LocationId 'LocationId'
        Assert-GuidValue $ServicePrincipalId 'ServicePrincipalId'
        if (-not $CurrentEgressAddressConfirmed) { throw 'Enforce requires CurrentEgressAddressConfirmed.' }
        if (-not $ReportOnlyEvidenceReviewed) { throw 'Enforce requires ReportOnlyEvidenceReviewed.' }
        Connect-IAMAIContext @('Policy.Read.All','Policy.ReadWrite.ConditionalAccess')
        [void](Get-LocationById $LocationId)
        $p = Get-PolicyById $PolicyId
        Assert-CanonicalPolicy $p $ServicePrincipalId $LocationId 'enabledForReportingButNotEnforced'
        Invoke-MgGraphRequest -Method PATCH -Uri "$PolicyBase/$PolicyId" -Body (@{state='enabled'} | ConvertTo-Json) -ContentType 'application/json' | Out-Null
        $after = Get-PolicyById $PolicyId
        Assert-CanonicalPolicy $after $ServicePrincipalId $LocationId 'enabled'
        Write-Host 'Workload policy enabled. Verify a fresh Cloud Sync operation and rescan IAMAI.'
    }
}
@@IAMAI-END

@@IAMAI-BEGIN {"id":"ai.location-create","channel":"aiInfo","states":["locationMissing"],"format":"markdown","kind":"template"}
**Contains tenant context. Review before sharing with an external AI service.**

ROLE
Help implement only the missing named-location prerequisite for this IAMAI step.

GOAL
Create the approved Cloud Sync server IP named location, then stop for an IAMAI rescan.

TENANT CONTEXT
Location name: {{location.syncServer.displayName}}
Approved IP ranges: {{location.syncServer.ipRanges}}

DO NOT CHANGE
Do not create the workload policy yet, broaden the range, or invent a trusted-location flag. The policy needs the new location's stable tenant ID after rescan.

YOUR ROLE
Return only the smallest safe named-location creation action and verification.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"ai.create","channel":"aiInfo","states":["missing"],"format":"markdown","kind":"template"}
**Contains tenant context. Review before sharing with an external AI service.**

ROLE
Help create the Cloud Sync workload Conditional Access policy after IAMAI has resolved the prerequisite named location.

GOAL
Block the resolved Cloud Sync provisioning service principal outside the approved sync-server location, starting in Report-only.

TENANT CONTEXT
Policy name: {{policy.target.displayName}}
Cloud Sync service principal Object ID: {{workload.cloudSync.servicePrincipalId}}
Approved named-location ID: {{location.syncServer.id}}

MICROSOFT RULES
Target the service principal directly as a workload identity. Use the Enterprise applications Object ID, target All resources, include Any location, exclude the approved location, and Block access. Workload ID Premium is required to create/modify this policy.

DO NOT CHANGE
Do not target all service principals, a group containing the service principal, a managed identity, or the App registrations Object ID.

YOUR ROLE
Return only the Create-in-Report-only action and read-back verification.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"ai.correct","channel":"aiInfo","states":["partial"],"format":"markdown","kind":"template"}
**Contains tenant context. Review before sharing with an external AI service.**

ROLE
Help correct only the IAMAI-classified mismatch(es) on the existing Cloud Sync workload policy.

CURRENT STATE
Policy ID: {{policy.current.id}}
Policy mismatches: {{policy.current.semanticMismatches}}

TARGET STATE
Approved IP range set; direct Cloud Sync service-principal assignment; All resources; Any location excluding the exact named location; Block grant; Report-only during material correction.

DO NOT CHANGE
Do not create duplicate objects. If the named-location IP ranges change, supply the complete approved range set. If the workload policy is On, return it to Report-only before changing the allowed address or material policy scope.

YOUR ROLE
Apply only the supplied mismatch modules to the same stable objects and stop for IAMAI rescan.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"ai.observe","channel":"aiInfo","states":["reportOnly"],"format":"markdown","kind":"template"}
**Contains tenant context. Review before sharing with an external AI service.**

ROLE
Help decide whether this Cloud Sync workload policy is ready to enforce. Do not repeat creation steps.

EVIDENCE IAMAI HAS
Cloud Sync activity: {{evidence.cloudSyncActivity}}
Observed sync addresses: {{evidence.syncAddresses}}

MICROSOFT RULES
Review **Service principal sign-ins** and the policy's Report-only result. The service principal must be directly targeted. Enforcement outside the excluded named location blocks token requests.

KNOWN UNKNOWNS
A previously observed public IP does not prove the server's egress address is stable or still current.

YOUR ROLE
Identify the remaining evidence needed to confirm the approved address represents normal Cloud Sync operation.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"ai.enforce","channel":"aiInfo","states":["readyToEnforce"],"format":"markdown","kind":"template"}
**Contains tenant context. Review before sharing with an external AI service.**

ROLE
Help perform only the final enforcement transition for the already-correct Cloud Sync workload policy.

CURRENT STATE
IAMAI has classified the step Ready to enforce.

IMPLEMENTATION
Confirm the current server egress is still inside the approved named location, change the existing workload policy from Report-only to On, and verify a fresh Cloud Sync operation succeeds.

ROLLBACK / SAFE RECOVERY
If synchronization fails, return the same policy to Report-only first. Check current egress versus the same named location before changing any range.

YOUR ROLE
Keep the action limited to enforcement, operational verification, and safe rollback.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"email.admins.pre-enforcement","channel":"email","states":["readyToEnforce"],"format":"markdown","kind":"template","audience":"identity-infrastructure-administrators","trigger":"before-enforcement","purpose":"pre-change-operations-notice","recommendation":"optional"}
Subject: Cloud Sync Conditional Access enforcement

We are moving the Cloud Sync workload Conditional Access policy from Report-only to On. After the change, the Cloud Sync provisioning service principal will be blocked when it requests tokens from outside the approved sync-server public IP location.

Please avoid changing the Cloud Sync server's public egress path during the rollout window. If synchronization stops, capture the time and current public egress address and return the policy to Report-only before changing the named location.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"readiness.model","channel":"readiness","states":["notApplicable","locationMissing","missing","partial","reportOnly","readyToEnforce","inPlace","blocked","needsDecision","sourceConflict","notLicensed"],"format":"json","kind":"referenceOnly"}
{
  "tiles": [
    {
      "id": "workload-identity",
      "gate": "Cloud Sync workload identity",
      "resultSource": "tenant-evidence",
      "readyWhen": "IAMAI has resolved the exact Cloud Sync provisioning service principal Object ID.",
      "notApplicableWhen": "IAMAI has established that Cloud Sync is not present.",
      "line": "The policy must target the Enterprise applications service principal directly."
    },
    {
      "id": "approved-address",
      "gate": "Approved sync-server address",
      "resultSource": "tenant-and-human-evidence",
      "readyWhen": "The complete stable egress CIDR set is approved and the named location matches it.",
      "unknownWhen": "The observed public IP is unapproved, unstable, or unavailable.",
      "line": "A wrong allowed address can stop Cloud Sync after enforcement."
    },
    {
      "id": "workload-license",
      "gate": "Workload ID Premium",
      "resultSource": "tenant-evidence",
      "readyWhen": "The tenant has the licensing required to create or modify service-principal Conditional Access.",
      "blockedWhen": "The required workload license is unavailable.",
      "line": "Existing workload policies can continue without the license, but Microsoft says they cannot be modified."
    },
    {
      "id": "report-only-evidence",
      "gate": "Cloud Sync sign-in evidence",
      "resultSource": "tenant-evidence",
      "readyWhen": "Normal service-principal sign-ins originate from the approved location and the Report-only result is expected.",
      "unknownWhen": "Normal synchronization activity has not been represented.",
      "line": "Use service-principal sign-ins to validate the location boundary before enforcement."
    }
  ],
  "safeNow": "If the location is missing, create only that prerequisite and rescan. If it exists and the policy is missing, create the policy in Report-only.",
  "safeToEnforce": "Only after the service principal, approved address, license, and Report-only evidence gates are Ready.",
  "whyIamaiSaysThis": {
    "confirmed": ["The retained baseline is Cloud Sync-specific and location-based."],
    "stillNeedsAttention": ["Current egress and normal Cloud Sync sign-in evidence must match the approved named location before enforcement."],
    "unknown": ["A prior address observation does not prove future egress stability."],
    "whyItMatters": "Microsoft documents that a location-based workload policy blocks service-principal token requests outside the allowed range.",
    "nextSafeAction": "Complete only the next missing prerequisite or remain in Report-only until source-address evidence is ready.",
    "readyWhen": "All four readiness gates are satisfied.",
    "microsoftReferences": ["ms-workload-identity-ca", "ms-ip-named-location-update"]
  }
}
@@IAMAI-END

@@IAMAI-BEGIN {"id":"troubleshooting.model","channel":"troubleshooting","states":["locationMissing","missing","partial","reportOnly","readyToEnforce","inPlace"],"format":"json","kind":"referenceOnly"}
{
  "scenarios": [
    {
      "id": "wrong-service-principal-id",
      "classification": "documented",
      "title": "The workload policy does not apply to Cloud Sync",
      "channels": ["entra", "json", "powershell", "aiInfo"],
      "states": ["missing", "partial", "reportOnly"],
      "symptom": "Cloud Sync service-principal sign-ins do not show the expected policy evaluation.",
      "likelyCauses": ["The App registrations Object ID was used instead of the Enterprise applications service principal Object ID, or the service principal was not directly targeted."],
      "check": ["Open Enterprise applications, locate the Cloud Sync provisioning service principal, and compare its Object ID with the policy's direct workload include."],
      "fix": ["Correct the same policy to the IAMAI-resolved service principal Object ID and validate again in Report-only."],
      "doNot": ["Do not target a group containing the service principal or broaden the policy to all service principals."],
      "then": ["Review a fresh service-principal sign-in and rescan IAMAI."],
      "sources": ["ms-workload-identity-ca", "ms-ca-client-applications"]
    },
    {
      "id": "workload-license-missing",
      "classification": "documented",
      "title": "The workload policy cannot be created or changed",
      "channels": ["entra", "json", "powershell"],
      "states": ["missing", "partial"],
      "symptom": "Microsoft Entra does not allow the service-principal Conditional Access policy to be created or modified.",
      "likelyCauses": ["The tenant does not have the required Microsoft Entra Workload ID Premium entitlement."],
      "check": ["Verify the tenant's Workload ID Premium entitlement before retrying the policy mutation."],
      "fix": ["Resolve the licensing prerequisite; keep the step non-actionable until the tenant is licensed."],
      "doNot": ["Do not replace the workload policy with an ordinary user Conditional Access policy."],
      "then": ["Rescan IAMAI after licensing is available."],
      "sources": ["ms-workload-identity-ca", "ms-workload-license-faq"]
    },
    {
      "id": "named-location-wrong-address",
      "classification": "derived",
      "title": "Cloud Sync would be outside the allowed location",
      "channels": ["entra", "json", "powershell", "aiInfo"],
      "states": ["partial", "reportOnly", "readyToEnforce"],
      "symptom": "Observed Cloud Sync service-principal sign-ins originate outside the configured sync-server named location.",
      "likelyCauses": ["The server's public egress changed, the approved range is wrong/stale, or a different agent path is being used."],
      "check": ["Compare the current observed service-principal source IP with the complete approved named-location range set."],
      "fix": ["Stay/return to Report-only. Validate the correct stable egress address, then update the same named location with the complete approved range set."],
      "doNot": ["Do not broaden the allowed location to an office-wide range merely to make the sign-in pass."],
      "then": ["Review a new service-principal sign-in before enforcement."],
      "sources": ["ms-workload-identity-ca", "ms-ip-named-location-update"]
    },
    {
      "id": "named-location-range-lost",
      "classification": "documented",
      "title": "A named-location IP range disappeared after correction",
      "channels": ["json", "powershell", "entra"],
      "states": ["partial"],
      "symptom": "An existing approved IP range is missing after the named location was updated.",
      "likelyCauses": ["The PATCH supplied only the newly changed range instead of the complete desired ipRanges collection."],
      "check": ["Read the same named location by stable ID and compare every returned CIDR with IAMAI's complete canonical range set."],
      "fix": ["With the workload policy in Report-only, PATCH the same location with the complete approved ipRanges collection."],
      "doNot": ["Do not create a second named location to recover the omitted range."],
      "then": ["Read back the same location and rescan IAMAI."],
      "sources": ["ms-ip-named-location-update"]
    },
    {
      "id": "cloud-sync-blocked-after-enforcement",
      "classification": "documented",
      "title": "Cloud Sync stops after the policy is enabled",
      "channels": ["entra", "powershell", "aiInfo", "email"],
      "states": ["readyToEnforce", "inPlace"],
      "symptom": "Cloud Sync token requests fail after the location-based workload policy is turned On.",
      "likelyCauses": ["The request originated outside the excluded approved location, or the wrong service principal/location was targeted."],
      "check": ["Return to the Service principal sign-in record, review the Conditional Access result, source IP, service principal Object ID, and named-location membership."],
      "fix": ["Return the same policy to Report-only first; then correct the approved address or object identity only after verifying the actual mismatch."],
      "doNot": ["Do not disable unrelated Conditional Access controls or add a broad location exclusion."],
      "then": ["Verify a fresh Cloud Sync operation in Report-only before re-enforcement."],
      "sources": ["ms-workload-identity-ca"]
    },
    {
      "id": "graph-403",
      "classification": "documented",
      "title": "JSON or PowerShell returns 403",
      "channels": ["json", "powershell"],
      "states": ["locationMissing", "missing", "partial", "readyToEnforce"],
      "symptom": "Microsoft Graph rejects the named-location or workload-policy mutation with an authorization error.",
      "likelyCauses": ["The session lacks Policy.Read.All and Policy.ReadWrite.ConditionalAccess, the signed-in user lacks a supported admin role, or the workload license prerequisite is missing for the policy operation."],
      "check": ["Inspect granted Graph scopes, the signed-in administrator role, and Workload ID Premium status."],
      "fix": ["Grant only the documented required permission/role or resolve licensing, then retry the same stable object operation."],
      "doNot": ["Do not switch to AzureAD/MSOnline or grant broad Global Administrator solely as a workaround."],
      "then": ["Read back the same object and rescan IAMAI."],
      "sources": ["ms-named-location-create", "ms-ip-named-location-update", "ms-workload-identity-ca"]
    },
    {
      "id": "iamai-still-partial",
      "classification": "derived",
      "title": "IAMAI still says the Cloud Sync restriction is Partial",
      "channels": ["entra", "json", "powershell", "aiInfo"],
      "states": ["partial", "reportOnly"],
      "symptom": "The administrator changed the location/policy, but IAMAI still reports a mismatch.",
      "likelyCauses": ["A security-significant field still differs, an incomplete named-location range set was submitted, or a different tenant object was edited."],
      "check": ["Compare the IAMAI mismatch IDs and stable location/policy IDs with the exact objects changed."],
      "fix": ["Apply only the remaining correction module to the same stable object and rescan."],
      "doNot": ["Do not create duplicate policies or named locations to make the classifier find a matching object."],
      "then": ["Confirm all mismatches clear before enforcement."],
      "sources": ["ms-workload-identity-ca", "ms-ip-named-location-update"]
    }
  ]
}
@@IAMAI-END

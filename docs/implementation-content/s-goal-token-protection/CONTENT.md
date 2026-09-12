# IAMAI renderable content — Require Token Protection on Windows

@@IAMAI-BEGIN {"id":"entra.create","channel":"entra","states":["missing"],"format":"markdown","kind":"template"}
IAMAI will use the canonical policy name and approved exclusions already resolved for this tenant.

1. In Microsoft Entra admin center, go to **Entra ID > Conditional Access > Policies > New policy**.
2. Name the policy **{{policy.target.displayName}}**.
3. Under **Users or workload identities**, include **All users** and exclude the IAMAI-resolved canonical exception groups.
4. Under **Target resources > Resources > Select resources**, select only **Office 365 Exchange Online**, **Office 365 SharePoint Online**, **Microsoft Teams Services**, **Azure Virtual Desktop**, and **Windows 365**. Do not select the Office 365 application suite.
5. Under **Conditions > Device platforms**, include **Windows** only.
6. Under **Conditions > Client apps**, select only **Mobile apps and desktop clients**. Leave Browser unselected.
7. Under **Conditions > Filter for devices**, configure **Exclude filtered devices from policy** with `device.systemLabels -contains "CloudPC" -and device.trustType -eq "AzureAD"`.
8. Under **Access controls > Session**, select **Require token protection for sign-in sessions**.
9. Set **Enable policy** to **Report-only**, then create it.
10. Rescan IAMAI before considering enforcement.

Microsoft reference: https://learn.microsoft.com/en-us/entra/identity/conditional-access/deployment-guide-token-protection-windows
@@IAMAI-END

@@IAMAI-BEGIN {"id":"entra.correct.open","channel":"entra","states":["partial"],"format":"markdown","kind":"template"}
Open the IAMAI-resolved existing Conditional Access policy **{{policy.current.displayName}}** by its stable tenant policy identity. Do not create a replacement.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"entra.correct.users.include-all","channel":"entra","states":["partial"],"format":"markdown","kind":"template"}
Under **Users or workload identities > Include**, set the population to **All users**. Preserve the canonical exclusions.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"entra.correct.users.exclusions-canonical","channel":"entra","states":["partial"],"format":"markdown","kind":"template"}
Under **Users or workload identities > Exclude**, make the exclusion set match IAMAI's canonical target exactly. Do not add a new exception merely because an unsupported client appears; resolve that workflow deliberately first.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"entra.correct.target.resources-pinned","channel":"entra","states":["partial"],"format":"markdown","kind":"template"}
Under **Target resources > Resources**, select exactly Exchange Online, SharePoint Online, Microsoft Teams Services, Azure Virtual Desktop, and Windows 365. Remove noncanonical resource targets. Do not replace this set with the Office 365 application suite.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"entra.correct.conditions.windows-platform","channel":"entra","states":["partial"],"format":"markdown","kind":"template"}
Under **Conditions > Device platforms**, include **Windows** only.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"entra.correct.conditions.mobile-desktop-clients","channel":"entra","states":["partial"],"format":"markdown","kind":"template"}
Under **Conditions > Client apps**, select only **Mobile apps and desktop clients**. Remove Browser or other noncanonical client-app selections.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"entra.correct.conditions.cloudpc-device-filter","channel":"entra","states":["partial"],"format":"markdown","kind":"template"}
Under **Conditions > Filter for devices**, set the filter to **Exclude filtered devices from policy** using `device.systemLabels -contains "CloudPC" -and device.trustType -eq "AzureAD"`.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"entra.correct.conditions.remove-noncanonical","channel":"entra","states":["partial"],"format":"markdown","kind":"template"}
Remove risk, location, user-action, authentication-flow, or other conditions that IAMAI has classified as noncanonical for this retained token-protection policy. Leave the Windows platform, Mobile apps and desktop clients, and retained CloudPC device filter in place.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"entra.correct.grant.none","channel":"entra","states":["partial"],"format":"markdown","kind":"template"}
Under **Access controls > Grant**, remove the noncanonical grant requirement. This retained policy is a session-control policy; its canonical grant control is empty.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"entra.correct.session.token-protection","channel":"entra","states":["partial"],"format":"markdown","kind":"template"}
Under **Access controls > Session**, enable **Require token protection for sign-in sessions**. Leave unrelated session controls off unless another approved policy owns them.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"entra.correct.lifecycle.report-only","channel":"entra","states":["partial"],"format":"markdown","kind":"template"}
Set **Enable policy** to **Report-only** while correcting or revalidating this policy.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"entra.correct.save-verify","channel":"entra","states":["partial"],"format":"markdown","kind":"template"}
Save the same policy, read its settings back, and rescan IAMAI. Continue to observation only after IAMAI no longer reports the corrected semantic mismatch(es).
@@IAMAI-END

@@IAMAI-BEGIN {"id":"entra.observe","channel":"entra","states":["reportOnly"],"format":"markdown","kind":"template"}
The policy is already in Report-only. Do not recreate it.

1. Go to **Entra ID > Monitoring & health > Sign-in logs** and review both interactive and non-interactive sign-ins that exercise the targeted Windows native applications.
2. Open relevant events and review the **Report-only** Conditional Access result for this policy.
3. Under **Basic Info**, inspect **Token Protection - Sign In Session**. Review Bound/Unbound results and status codes, especially 1002, 1003, 1006, and 1008.
4. Confirm normal supported app use has been represented. Microsoft recommends analyzing long enough to cover normal application use; do not invent a fixed observation duration.
5. Resolve required unsupported clients, shared/service-device workflows, or unsupported registration types before enforcement.
6. Rescan IAMAI when the evidence or configuration changes.

Microsoft reference: https://learn.microsoft.com/en-us/entra/identity/conditional-access/deployment-guide-token-protection-windows
@@IAMAI-END

@@IAMAI-BEGIN {"id":"entra.enforce","channel":"entra","states":["readyToEnforce"],"format":"markdown","kind":"template"}
IAMAI has reached the enforcement state; do not rebuild the policy.

1. Open the exact IAMAI-resolved policy.
2. Confirm the compatibility review still reflects the Windows clients and device workflows that matter now.
3. Change **Enable policy** from **Report-only** to **On** and save.
4. Test a supported Windows registered-device/native-client path and a deliberately selected exception path if one exists.
5. If a required workflow fails, return this same policy to Report-only before troubleshooting.
6. Rescan IAMAI.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"json.create","channel":"json","states":["missing"],"format":"json-template","kind":"deployableAfterBinding","method":"POST","endpoint":"https://graph.microsoft.com/beta/identity/conditionalAccess/policies","apiStability":"beta-exception"}
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
      "includeApplications": [
        "00000002-0000-0ff1-ce00-000000000000",
        "00000003-0000-0ff1-ce00-000000000000",
        "0af06dc6-e4b5-4f28-818e-e78e62d137a5",
        "9cdead84-a844-4324-93f2-b2e6bb768d07",
        "cc15fd57-2c6c-4117-a88c-83b1d56b4bbe"
      ],
      "excludeApplications": []
    },
    "clientAppTypes": ["mobileAppsAndDesktopClients"],
    "platforms": {
      "includePlatforms": ["windows"],
      "excludePlatforms": []
    },
    "devices": {
      "deviceFilter": {
        "mode": "exclude",
        "rule": "device.systemLabels -contains \"CloudPC\" -and device.trustType -eq \"AzureAD\""
      }
    },
    "signInRiskLevels": [],
    "userRiskLevels": [],
    "servicePrincipalRiskLevels": []
  },
  "grantControls": null,
  "sessionControls": {
    "secureSignInSession": {
      "isEnabled": true
    }
  }
}
@@IAMAI-END

@@IAMAI-BEGIN {"id":"json.correct.conditions","channel":"json","states":["partial"],"format":"json-template","kind":"deployableAfterBinding","method":"PATCH","endpoint":"https://graph.microsoft.com/beta/identity/conditionalAccess/policies/{policy.current.id}","apiStability":"beta-exception"}
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
      "includeApplications": [
        "00000002-0000-0ff1-ce00-000000000000",
        "00000003-0000-0ff1-ce00-000000000000",
        "0af06dc6-e4b5-4f28-818e-e78e62d137a5",
        "9cdead84-a844-4324-93f2-b2e6bb768d07",
        "cc15fd57-2c6c-4117-a88c-83b1d56b4bbe"
      ],
      "excludeApplications": [],
      "includeUserActions": [],
      "applicationFilter": null
    },
    "clientAppTypes": ["mobileAppsAndDesktopClients"],
    "platforms": {
      "includePlatforms": ["windows"],
      "excludePlatforms": []
    },
    "devices": {
      "deviceFilter": {
        "mode": "exclude",
        "rule": "device.systemLabels -contains \"CloudPC\" -and device.trustType -eq \"AzureAD\""
      }
    },
    "signInRiskLevels": [],
    "userRiskLevels": [],
    "servicePrincipalRiskLevels": [],
    "locations": null,
    "authenticationFlows": null,
    "insiderRiskLevels": null
  }
}
@@IAMAI-END

@@IAMAI-BEGIN {"id":"json.correct.grant-none","channel":"json","states":["partial"],"format":"json","kind":"deployableAfterBinding","method":"PATCH","endpoint":"https://graph.microsoft.com/beta/identity/conditionalAccess/policies/{policy.current.id}","apiStability":"beta-exception"}
{
  "grantControls": null
}
@@IAMAI-END

@@IAMAI-BEGIN {"id":"json.correct.session","channel":"json","states":["partial"],"format":"json","kind":"deployableAfterBinding","method":"PATCH","endpoint":"https://graph.microsoft.com/beta/identity/conditionalAccess/policies/{policy.current.id}","apiStability":"beta-exception"}
{
  "sessionControls": {
    "secureSignInSession": {
      "isEnabled": true
    }
  }
}
@@IAMAI-END

@@IAMAI-BEGIN {"id":"json.correct.report-only","channel":"json","states":["partial"],"format":"json","kind":"deployableAfterBinding","method":"PATCH","endpoint":"https://graph.microsoft.com/beta/identity/conditionalAccess/policies/{policy.current.id}","apiStability":"beta-exception"}
{
  "state": "enabledForReportingButNotEnforced"
}
@@IAMAI-END

@@IAMAI-BEGIN {"id":"json.enforce","channel":"json","states":["readyToEnforce"],"format":"json","kind":"deployableAfterBinding","method":"PATCH","endpoint":"https://graph.microsoft.com/beta/identity/conditionalAccess/policies/{policy.current.id}","apiStability":"beta-exception"}
{
  "state": "enabled"
}
@@IAMAI-END

@@IAMAI-BEGIN {"id":"powershell.run","channel":"powershell","states":["missing","partial","reportOnly","readyToEnforce"],"format":"powershell","kind":"deployableAfterBinding","apiStability":"beta-exception","invocation":{"modeParameter":"Mode","correctionsParameter":"Corrections","parameters":{"PolicyDisplayName":{"binding":"policy.target.displayName","modes":["Create"]},"PolicyId":{"binding":"policy.current.id","modes":["Correct","Verify"]},"ExcludeGroupIds":{"binding":"policy.target.excludeGroups","modes":["Create","Correct","Verify"]}},"withheldModes":{"Enforce":"the script enforces only with -CompatibilityEvidenceReviewed and -UnsupportedDeviceFlowsResolved, an attestation this package declares no prerequisite for, so IAMAI cannot pass it"}}}
# IAMAI compact implementation script — Require Token Protection on Windows
# Token Protection's secureSignInSession field is currently a Graph beta-only session-control property.
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

    [ValidateSet('Conditions','GrantNone','Session','ReportOnly')]
    [string[]] $Corrections,

    [switch] $CompatibilityEvidenceReviewed,
    [switch] $UnsupportedDeviceFlowsResolved
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$BaseUri = 'https://graph.microsoft.com/beta/identity/conditionalAccess/policies'
$GuidPattern = '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
$ResourceIds = @(
    '00000002-0000-0ff1-ce00-000000000000',
    '00000003-0000-0ff1-ce00-000000000000',
    '0af06dc6-e4b5-4f28-818e-e78e62d137a5',
    '9cdead84-a844-4324-93f2-b2e6bb768d07',
    'cc15fd57-2c6c-4117-a88c-83b1d56b4bbe'
)
$DeviceFilterRule = 'device.systemLabels -contains "CloudPC" -and device.trustType -eq "AzureAD"'

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
    if (-not $context -or $missing.Count -gt 0) { Connect-MgGraph -Scopes $Scopes -NoWelcome }
}

function Get-PolicyById {
    param([string] $Id)
    if (-not $Id) { throw 'This mode requires the IAMAI-resolved stable policy ID.' }
    $p = Invoke-MgGraphRequest -Method GET -Uri "$BaseUri/$Id"
    if (-not $p.id -or $p.id -ne $Id) { throw 'Stable-ID policy read-back failed.' }
    return $p
}

function New-CanonicalConditions {
    param([string[]] $Excluded)
    Assert-ExcludeIds $Excluded
    return @{
        users = @{ includeUsers=@('All'); excludeUsers=@(); includeGroups=@(); excludeGroups=@($Excluded); includeRoles=@(); excludeRoles=@() }
        applications = @{ includeApplications=@($ResourceIds); excludeApplications=@(); includeUserActions=@(); applicationFilter=$null }
        clientAppTypes = @('mobileAppsAndDesktopClients')
        platforms = @{ includePlatforms=@('windows'); excludePlatforms=@() }
        devices = @{ deviceFilter=@{ mode='exclude'; rule=$DeviceFilterRule } }
        signInRiskLevels=@(); userRiskLevels=@(); servicePrincipalRiskLevels=@(); locations=$null; authenticationFlows=$null; insiderRiskLevels=$null
    }
}

function Assert-CanonicalPolicy {
    param($Policy,[string[]] $ExpectedExcludeGroupIds,[string] $ExpectedState)
    Assert-ExcludeIds $ExpectedExcludeGroupIds
    $errors = [System.Collections.Generic.List[string]]::new()
    if ($Policy.state -ne $ExpectedState) { $errors.Add("Policy state is '$($Policy.state)', expected '$ExpectedState'.") }
    if (@($Policy.conditions.users.includeUsers).Count -ne 1 -or @($Policy.conditions.users.includeUsers)[0] -ne 'All') { $errors.Add('Included users are not exactly All.') }
    if ((@($Policy.conditions.users.excludeGroups | Sort-Object) -join '|') -ne (@($ExpectedExcludeGroupIds | Sort-Object) -join '|')) { $errors.Add('Exclusion group set differs from IAMAI canonical target.') }
    if ((@($Policy.conditions.applications.includeApplications | Sort-Object) -join '|') -ne (@($ResourceIds | Sort-Object) -join '|')) { $errors.Add('Target resource set differs from the retained baseline.') }
    if (@($Policy.conditions.applications.excludeApplications).Count -ne 0) { $errors.Add('A noncanonical application exclusion is present.') }
    if (@($Policy.conditions.clientAppTypes).Count -ne 1 -or @($Policy.conditions.clientAppTypes)[0] -ne 'mobileAppsAndDesktopClients') { $errors.Add('Client-app scope is not Mobile apps and desktop clients only.') }
    if (@($Policy.conditions.platforms.includePlatforms).Count -ne 1 -or @($Policy.conditions.platforms.includePlatforms)[0] -ne 'windows') { $errors.Add('Platform scope is not Windows only.') }
    if ($Policy.conditions.devices.deviceFilter.mode -ne 'exclude' -or $Policy.conditions.devices.deviceFilter.rule -ne $DeviceFilterRule) { $errors.Add('Device filter differs from the retained baseline.') }
    foreach ($name in @('locations','authenticationFlows','insiderRiskLevels')) { if ($null -ne $Policy.conditions.$name) { $errors.Add("Noncanonical condition is present: $name") } }
    if (@($Policy.conditions.signInRiskLevels).Count -ne 0 -or @($Policy.conditions.userRiskLevels).Count -ne 0 -or @($Policy.conditions.servicePrincipalRiskLevels).Count -ne 0) { $errors.Add('A noncanonical risk condition is present.') }
    if ($null -ne $Policy.grantControls) { $errors.Add('Grant controls should be empty for this session-control policy.') }
    if (-not $Policy.sessionControls.secureSignInSession.isEnabled) { $errors.Add('Token protection session control is not enabled.') }
    if ($errors.Count -gt 0) { $errors | ForEach-Object { Write-Error $_ }; throw 'Canonical policy verification failed.' }
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
            displayName=$PolicyDisplayName
            state='enabledForReportingButNotEnforced'
            conditions=(New-CanonicalConditions $ExcludeGroupIds)
            grantControls=$null
            sessionControls=@{ secureSignInSession=@{ isEnabled=$true } }
        }
        $created = Invoke-MgGraphRequest -Method POST -Uri $BaseUri -Body ($body | ConvertTo-Json -Depth 20) -ContentType 'application/json'
        if (-not $created.id) { throw 'Microsoft Graph did not return a policy ID.' }
        $after = Get-PolicyById $created.id
        Assert-CanonicalPolicy $after $ExcludeGroupIds 'enabledForReportingButNotEnforced'
        Write-Host "Created policy ID $($created.id) in Report-only. Rescan IAMAI."
    }
    'Correct' {
        if (-not $Corrections -or $Corrections.Count -lt 1) { throw 'Correct requires at least one Corrections value.' }
        if ($Corrections -contains 'Conditions') { Assert-ExcludeIds $ExcludeGroupIds }
        Connect-IAMAIContext @('Policy.Read.All','Policy.ReadWrite.ConditionalAccess')
        [void](Get-PolicyById $PolicyId)
        $body = @{}
        if ($Corrections -contains 'Conditions') { $body.conditions = New-CanonicalConditions $ExcludeGroupIds }
        if ($Corrections -contains 'GrantNone') { $body.grantControls = $null }
        if ($Corrections -contains 'Session') { $body.sessionControls = @{ secureSignInSession=@{ isEnabled=$true } } }
        if ($Corrections -contains 'ReportOnly') { $body.state = 'enabledForReportingButNotEnforced' }
        Invoke-MgGraphRequest -Method PATCH -Uri "$BaseUri/$PolicyId" -Body ($body | ConvertTo-Json -Depth 20) -ContentType 'application/json' | Out-Null
        Write-Host 'Correction applied to the same stable policy. Rescan IAMAI before enforcing.'
    }
    'Verify' {
        Assert-ExcludeIds $ExcludeGroupIds
        Connect-IAMAIContext @('Policy.Read.All')
        $p = Get-PolicyById $PolicyId
        Assert-CanonicalPolicy $p $ExcludeGroupIds $p.state
        if ($p.state -notin @('enabledForReportingButNotEnforced','enabled')) { throw "Unexpected lifecycle state '$($p.state)'." }
        Write-Host 'Canonical policy shape verified. Readiness still depends on compatibility evidence before enforcement.'
    }
    'Enforce' {
        Assert-ExcludeIds $ExcludeGroupIds
        if (-not $CompatibilityEvidenceReviewed) { throw 'Enforce requires CompatibilityEvidenceReviewed.' }
        if (-not $UnsupportedDeviceFlowsResolved) { throw 'Enforce requires UnsupportedDeviceFlowsResolved.' }
        Connect-IAMAIContext @('Policy.Read.All','Policy.ReadWrite.ConditionalAccess')
        $p = Get-PolicyById $PolicyId
        Assert-CanonicalPolicy $p $ExcludeGroupIds 'enabledForReportingButNotEnforced'
        Invoke-MgGraphRequest -Method PATCH -Uri "$BaseUri/$PolicyId" -Body (@{state='enabled'} | ConvertTo-Json) -ContentType 'application/json' | Out-Null
        $after = Get-PolicyById $PolicyId
        Assert-CanonicalPolicy $after $ExcludeGroupIds 'enabled'
        Write-Host 'Token protection policy enabled. Perform the controlled validation and rescan IAMAI.'
    }
}
@@IAMAI-END

@@IAMAI-BEGIN {"id":"ai.create","channel":"aiInfo","states":["missing"],"format":"markdown","kind":"template"}
**Contains tenant context. Review before sharing with an external AI service.**

ROLE
You are helping implement one IAMAI Plan step. Do not redesign the baseline or infer tenant facts.

GOAL
Create the retained Windows Token Protection Conditional Access policy in Report-only.

AUTHORITY
IAMAI owns tenant-specific truth. Jon Hope's retained pin owns the target. Current Microsoft documentation owns supported behavior. The JSON/PowerShell mutation uses Graph beta only because `secureSignInSession` is not exposed in the current v1.0 session-controls schema.

TENANT CONTEXT
Target policy: {{policy.target.displayName}}
Canonical exclusions: {{policy.target.excludeGroups}}

TARGET STATE
All users; canonical exclusions; exactly the retained Exchange Online, SharePoint Online, Teams Services, Azure Virtual Desktop and Windows 365 resources; Windows; Mobile apps and desktop clients; retained CloudPC exclusion filter; no grant; Token Protection session control; Report-only.

DO NOT CHANGE
Do not substitute the Office 365 suite, add Browser, add Windows Cloud Login, remove the retained device filter, or invent exception groups.

VERIFICATION
Read back the created policy, then use interactive and non-interactive sign-in evidence before recommending enforcement.

YOUR ROLE
Return the smallest safe Create action and call out the beta API limitation without changing the approved target.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"ai.correct","channel":"aiInfo","states":["partial"],"format":"markdown","kind":"template"}
**Contains tenant context. Review before sharing with an external AI service.**

ROLE
Help correct the existing IAMAI-resolved Token Protection policy. Do not recreate it.

CURRENT STATE
Policy: {{policy.current.displayName}}
Stable policy ID: {{policy.current.id}}
IAMAI semantic mismatches: {{policy.current.semanticMismatches}}

TARGET STATE
Retain the pinned five-resource Windows native-client policy, canonical exclusions, retained CloudPC filter, no grant, Token Protection session control, and Report-only while correcting.

IMPLEMENTATION OPTIONS
Correct only the supplied semantic mismatch modules. Multiple condition mismatches can share the canonical conditions PATCH boundary; deduplicate that mutation.

DO NOT CHANGE
Do not broaden resources, users, clients, exceptions, or platform scope beyond the retained baseline. Use the stable policy ID for updates.

YOUR ROLE
Explain only the actual mismatches and the smallest safe correction for the same policy.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"ai.observe","channel":"aiInfo","states":["reportOnly"],"format":"markdown","kind":"template"}
**Contains tenant context. Review before sharing with an external AI service.**

ROLE
Help evaluate whether the existing Token Protection policy is ready to enforce. Do not repeat creation steps.

CURRENT STATE
The policy is in Report-only.

EVIDENCE IAMAI HAS
Windows registration evidence: {{evidence.windowsRegistration}}
Token Protection compatibility evidence: {{evidence.tokenProtectionCompatibility}}

MICROSOFT RULES
Review both interactive and non-interactive sign-ins. `tokenProtectionStatusDetails` can show Bound/Unbound plus status codes such as 1002, 1003, 1006 and 1008. Unsupported clients or registration types may be blocked when enforcement begins.

KNOWN UNKNOWNS
Anything IAMAI has not observed remains Unknown. Microsoft does not prescribe one fixed observation duration; cover normal application use.

YOUR ROLE
Identify what evidence still blocks enforcement and the smallest safe next validation action.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"ai.enforce","channel":"aiInfo","states":["readyToEnforce"],"format":"markdown","kind":"template"}
**Contains tenant context. Review before sharing with an external AI service.**

ROLE
Help perform the final enforcement transition for the already-correct Token Protection policy.

CURRENT STATE
IAMAI has classified the step Ready to enforce.

IMPLEMENTATION
Change only the existing policy lifecycle from Report-only to On. Then run a controlled supported Windows native-client validation and rescan IAMAI.

ROLLBACK / SAFE RECOVERY
If a required workflow fails, return the same stable policy to Report-only first. Diagnose the unsupported client/device path before changing exclusions or filters.

YOUR ROLE
Keep the action limited to enforcement and validation; do not rebuild or redesign the policy.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"email.users.pre-enforcement","channel":"email","states":["readyToEnforce"],"format":"markdown","kind":"template","audience":"affected-windows-users","trigger":"before-enforcement","purpose":"pre-change-notice","recommendation":"recommended"}
Subject: A security change is coming to Microsoft 365 on Windows

We're enabling an additional sign-in protection for supported Microsoft 365 apps on Windows. It binds supported sign-in tokens to the computer that received them, which makes a copied token much harder to reuse from another device.

For most people using current Microsoft apps on a registered work or school device, there should be no visible change. If your Windows device is not registered correctly or an older/unsupported app is being used, you might be asked to sign in again or see access blocked.

If that happens, contact your normal IT support channel and include the app you were using and the time of the sign-in attempt.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"readiness.model","channel":"readiness","states":["missing","partial","reportOnly","readyToEnforce","inPlace","blocked","needsDecision","sourceConflict","notLicensed"],"format":"json","kind":"referenceOnly"}
{
  "tiles": [
    {
      "id": "exceptions",
      "gate": "Approved exceptions",
      "resultSource": "tenant-evidence",
      "readyWhen": "IAMAI has resolved the complete canonical exclusions for this policy.",
      "blockedWhen": "A required service/shared-device exception is unresolved.",
      "line": "Use only the approved exclusion set; do not create ad-hoc exceptions during rollout."
    },
    {
      "id": "windows-registration",
      "gate": "Windows device registration",
      "resultSource": "tenant-or-human-evidence",
      "readyWhen": "Required Windows users use supported, appropriately registered devices.",
      "unknownWhen": "IAMAI cannot prove the registration path for all affected use.",
      "line": "Unsupported or stale device registration can produce unbound token requests."
    },
    {
      "id": "compatibility",
      "gate": "App and client compatibility",
      "resultSource": "tenant-or-human-evidence",
      "readyWhen": "Normal supported app use is represented and required incompatible clients/workflows are resolved.",
      "unknownWhen": "Compatibility evidence does not cover normal application use.",
      "line": "Token protection blocks unsupported protected flows instead of downgrading them."
    },
    {
      "id": "report-only-evidence",
      "gate": "Report-only evidence",
      "resultSource": "tenant-evidence",
      "readyWhen": "Interactive and non-interactive sign-ins show the expected policy result with no unresolved required workflow.",
      "unknownWhen": "The observation window has not represented normal use.",
      "line": "Review Token Protection - Sign In Session status before enforcement."
    }
  ],
  "safeNow": "Create or correct the retained policy in Report-only when canonical bindings are available.",
  "safeToEnforce": "Only after exception, registration, compatibility, and Report-only evidence gates are Ready.",
  "whyIamaiSaysThis": {
    "confirmed": ["Baseline target and policy shape come from the retained pin."],
    "stillNeedsAttention": ["Compatibility and unsupported-device workflows remain human/evidence gates when IAMAI cannot prove them."],
    "unknown": ["Unobserved clients or registration methods remain Unknown."],
    "whyItMatters": "Microsoft documents that unsupported clients and device-registration types can be blocked by Token Protection.",
    "nextSafeAction": "Stay in Report-only until normal app use has been represented and required exceptions are resolved.",
    "readyWhen": "The readiness gates above are all satisfied.",
    "microsoftReferences": ["ms-token-protection-windows", "ms-ca-session-controls-beta"]
  }
}
@@IAMAI-END

@@IAMAI-BEGIN {"id":"troubleshooting.model","channel":"troubleshooting","states":["missing","partial","reportOnly","readyToEnforce","inPlace"],"format":"json","kind":"referenceOnly"}
{
  "scenarios": [
    {
      "id": "token-unbound-no-device-state",
      "classification": "documented",
      "title": "Token Protection shows status 1002",
      "channels": ["entra", "aiInfo"],
      "states": ["reportOnly", "readyToEnforce", "inPlace"],
      "symptom": "The sign-in is Unbound with Token Protection status code 1002.",
      "likelyCauses": ["The request has no Microsoft Entra device state."],
      "check": ["Open the sign-in event and inspect Token Protection - Sign In Session and the device details."],
      "fix": ["Use the approved supported device-registration path for the affected device before enforcement or retry."],
      "doNot": ["Do not broadly exempt the user or disable Token Protection as the first response."],
      "then": ["Repeat the supported-client sign-in and review the new event."],
      "sources": ["ms-token-protection-windows"]
    },
    {
      "id": "token-unbound-registration-type",
      "classification": "documented",
      "title": "Token Protection shows status 1003",
      "channels": ["entra", "aiInfo"],
      "states": ["reportOnly", "readyToEnforce", "inPlace"],
      "symptom": "The request is Unbound with status code 1003.",
      "likelyCauses": ["The device registration state does not satisfy Token Protection, including a documented unsupported registration type or registration without fresh credentials."],
      "check": ["Identify the device's registration/deployment method and compare it with Microsoft's unsupported-registration list."],
      "fix": ["Use the already-approved filter/exception or correct the deployment path; return the policy to Report-only if a required workflow is affected."],
      "doNot": ["Do not invent a new broad device-filter exception from one failed request."],
      "then": ["Retest and confirm the request is Bound or deliberately excluded."],
      "sources": ["ms-token-protection-windows"]
    },
    {
      "id": "unsupported-client",
      "classification": "documented",
      "title": "A Windows app is blocked after enforcement",
      "channels": ["entra", "aiInfo", "email"],
      "states": ["readyToEnforce", "inPlace"],
      "symptom": "A required Windows client can no longer reach a protected resource after Token Protection is enabled.",
      "likelyCauses": ["The client is not using a supported protected-token flow, is not current, or is not integrated with WAM."],
      "check": ["Identify the exact app/version and inspect Token Protection status; code 1008 points to a client not integrated with the platform broker."],
      "fix": ["Move to a supported/current client or return the policy to Report-only while the workflow is resolved."],
      "doNot": ["Do not replace the policy with the Office 365 app suite or disable the control tenant-wide without isolating the failing workflow."],
      "then": ["Retest the exact workflow and rescan IAMAI."],
      "sources": ["ms-token-protection-windows"]
    },
    {
      "id": "unsupported-shared-device",
      "classification": "documented",
      "title": "A Teams Room or Surface Hub stops signing in",
      "channels": ["entra", "aiInfo"],
      "states": ["readyToEnforce", "inPlace"],
      "symptom": "A Windows-based Teams Room or Surface Hub is blocked after the policy is enabled.",
      "likelyCauses": ["Microsoft lists these Windows client devices as unsupported for Token Protection."],
      "check": ["Confirm the device type and whether the tenant's approved shared-device policy/exclusion should own it."],
      "fix": ["Return this policy to Report-only if service is disrupted, then apply only the already-approved shared-device handling."],
      "doNot": ["Do not create an unreviewed user/group exception solely to make the device work."],
      "then": ["Retest the device under its approved policy path."],
      "sources": ["ms-token-protection-windows"]
    },
    {
      "id": "browser-selected",
      "classification": "documented",
      "title": "Teams Web or another browser app is unexpectedly blocked",
      "channels": ["entra", "json", "powershell"],
      "states": ["missing", "partial", "readyToEnforce", "inPlace"],
      "symptom": "Browser-based use is affected even though this retained step is for Windows native clients.",
      "likelyCauses": ["Browser was selected, or the Client apps condition was left broader than Mobile apps and desktop clients."],
      "check": ["Inspect Conditions > Client apps and compare with the canonical policy."],
      "fix": ["Correct the same policy to Mobile apps and desktop clients only and return to Report-only for validation."],
      "doNot": ["Do not add more application exclusions to compensate for an incorrect client-app condition."],
      "then": ["Rescan IAMAI and retest the browser/native-client boundary."],
      "sources": ["ms-token-protection-windows"]
    },
    {
      "id": "office365-suite-selected",
      "classification": "documented",
      "title": "Unrelated Microsoft 365 apps fail after rollout",
      "channels": ["entra", "json", "powershell"],
      "states": ["missing", "partial", "readyToEnforce", "inPlace"],
      "symptom": "Apps outside the retained resource set are affected.",
      "likelyCauses": ["The Office 365 application suite was selected instead of the supported individual resources."],
      "check": ["Inspect Target resources and compare the exact resource IDs with the retained set."],
      "fix": ["Correct the same policy to the five retained resources and validate in Report-only."],
      "doNot": ["Do not keep the broad suite and chase failures with individual exclusions."],
      "then": ["Rescan IAMAI and repeat normal-use validation."],
      "sources": ["ms-token-protection-windows"]
    },
    {
      "id": "graph-beta-rejected",
      "classification": "derived",
      "title": "JSON or PowerShell rejects secureSignInSession",
      "channels": ["json", "powershell"],
      "states": ["missing", "partial", "reportOnly", "readyToEnforce"],
      "symptom": "A Graph request rejects or omits the Token Protection session-control property.",
      "likelyCauses": ["The request used Graph v1.0 even though secureSignInSession is currently exposed only in the beta session-controls schema, or the beta contract changed."],
      "check": ["Confirm the request URI is the package's explicit beta endpoint and recheck Microsoft's beta session-controls schema."],
      "fix": ["Use only the documented package beta exception; if Microsoft changed the beta contract, stop machine mutation and use the portal path until the package is reverified."],
      "doNot": ["Do not switch the whole IAMAI library to beta or guess a replacement property."],
      "then": ["Reverify the package against current Microsoft documentation before retrying."],
      "sources": ["ms-ca-session-controls-v1", "ms-ca-session-controls-beta", "ms-secure-sign-in-session-beta"]
    },
    {
      "id": "iamai-still-partial",
      "classification": "derived",
      "title": "IAMAI still says Token Protection is Partial",
      "channels": ["entra", "json", "powershell", "aiInfo"],
      "states": ["partial", "reportOnly"],
      "symptom": "The administrator changed the policy, but IAMAI still reports one or more mismatches.",
      "likelyCauses": ["A security-significant field still differs from the retained baseline or a different policy object was edited."],
      "check": ["Compare the IAMAI mismatch IDs and stable policy ID with the exact object changed."],
      "fix": ["Apply only the remaining correction module to the same stable policy and rescan."],
      "doNot": ["Do not create a duplicate policy or use display-name matching as update identity."],
      "then": ["Confirm the mismatch clears before moving toward enforcement."],
      "sources": ["ms-token-protection-windows", "ms-graph-ca-update-beta"]
    }
  ]
}
@@IAMAI-END

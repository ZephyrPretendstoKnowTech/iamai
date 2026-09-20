# IAMAI renderable content — Require Token Protection on Windows

@@IAMAI-BEGIN {"id":"entra.create","channel":"entra","states":["missing"],"format":"markdown","kind":"template"}
Create this policy in Report-only. It will not enforce its access rule until you enable it. Token protection applies only to the resources, platform and client apps selected below. It does not cover browser sessions, other platforms or any other resource — those are not protected by this policy and are not blocked by it either.

1. In Microsoft Entra admin center, go to **Entra ID > Conditional Access > Policies > New policy**.
2. Name the policy **{{policy.target.displayName}}**.
3. Under **Users or workload identities**, include **All users** and exclude the resolved exclusion groups.
4. Under **Target resources > Resources > Select resources**, select only **Office 365 Exchange Online**, **Office 365 SharePoint Online**, **Microsoft Teams Services**, **Azure Virtual Desktop**, and **Windows 365**. Do not select the Office 365 application suite.
5. Under **Conditions > Device platforms**, set **Configure** to **Yes**, then include **Windows** only. Left at **No** the policy applies to all device platforms.
6. Under **Conditions > Client apps**, set **Configure** to **Yes**, then select only **Mobile apps and desktop clients**. Leave Browser unselected. Microsoft's own warning: not configuring this condition, or leaving Browser selected, can block web apps that sign in through the browser, Teams on the web among them.
7. Under **Conditions > Filter for devices**, configure **Exclude filtered devices from policy** with `device.systemLabels -contains "CloudPC" -and device.trustType -eq "AzureAD"`.
8. Under **Access controls > Session**, select **Require token protection for sign-in sessions**.
9. Set **Enable policy** to **Report-only**, then create it.
10. Rescan IAMAI before considering enforcement.

Microsoft reference: https://learn.microsoft.com/en-us/entra/identity/conditional-access/deployment-guide-token-protection-windows
@@IAMAI-END

@@IAMAI-BEGIN {"id":"entra.correct.open","channel":"entra","states":["partial"],"format":"markdown","kind":"template"}
This change removes {{policy.current.removedExclusions}} from the policy's exclusions. If the policy is On, it applies to them as soon as you save. [omit this line when unavailable]

Open the existing Conditional Access policy **{{policy.current.displayName}}** by its policy ID. Do not create a replacement.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"entra.correct.users.include-all","channel":"entra","states":["partial"],"format":"markdown","kind":"template"}
Under **Users or workload identities > Include**, set the population to **All users**. Keep the intended exclusions.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"entra.correct.users.exclusions-canonical","channel":"entra","states":["partial"],"format":"markdown","kind":"template"}
Under **Users or workload identities > Exclude**, make the exclusion set match the intended exclusions exactly. Do not add a new exception merely because an unsupported client appears; resolve that workflow deliberately first.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"entra.correct.target.resources-pinned","channel":"entra","states":["partial"],"format":"markdown","kind":"template"}
Under **Target resources > Resources**, select exactly Exchange Online, SharePoint Online, Microsoft Teams Services, Azure Virtual Desktop, and Windows 365. Remove any other resource target. Do not replace this set with the Office 365 application suite.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"entra.correct.conditions.windows-platform","channel":"entra","states":["partial"],"format":"markdown","kind":"template"}
Under **Conditions > Device platforms**, set **Configure** to **Yes**, then include **Windows** only. Left at **No** the policy applies to all device platforms.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"entra.correct.conditions.mobile-desktop-clients","channel":"entra","states":["partial"],"format":"markdown","kind":"template"}
Under **Conditions > Client apps**, set **Configure** to **Yes**, then select only **Mobile apps and desktop clients**. Remove Browser or any other client-app selection: at **No**, or with Browser selected, web apps that sign in through the browser are blocked.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"entra.correct.conditions.cloudpc-device-filter","channel":"entra","states":["partial"],"format":"markdown","kind":"template"}
Under **Conditions > Filter for devices**, set the filter to **Exclude filtered devices from policy** using `device.systemLabels -contains "CloudPC" -and device.trustType -eq "AzureAD"`.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"entra.correct.conditions.remove-noncanonical","channel":"entra","states":["partial"],"format":"markdown","kind":"template"}
Remove the risk, location, user-action, authentication-flow, or other conditions that IAMAI identified as differences for this token protection policy. Leave the Windows platform, Mobile apps and desktop clients, and the baseline CloudPC device filter in place.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"entra.correct.grant.none","channel":"entra","states":["partial"],"format":"markdown","kind":"template"}
Under **Access controls > Grant**, remove the grant requirement. This policy uses only a session control; its intended grant is empty.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"entra.correct.session.token-protection","channel":"entra","states":["partial"],"format":"markdown","kind":"template"}
Under **Access controls > Session**, enable **Require token protection for sign-in sessions**. Leave unrelated session controls off unless another approved policy owns them.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"entra.correct.lifecycle.report-only","channel":"entra","states":["partial"],"format":"markdown","kind":"template"}
Set **Enable policy** to **Report-only** while correcting or revalidating this policy.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"entra.correct.save-verify","channel":"entra","states":["partial"],"format":"markdown","kind":"template"}
Save the same policy, read its settings back, and rescan IAMAI. Continue to observation only after IAMAI no longer reports the corrected difference(s).

Keep the policy's current state. If it is On, the changed rule can affect access after you save.

@@IAMAI-END

@@IAMAI-BEGIN {"id":"entra.observe","channel":"entra","states":["reportOnly"],"format":"markdown","kind":"template"}
Keep the policy in Report-only while you review the evidence listed for this step. Do not recreate it.

1. Go to **Entra ID > Monitoring & health > Sign-in logs** and review both interactive and non-interactive sign-ins that exercise the targeted Windows native applications.
2. Open relevant events and review the **Report-only** Conditional Access result for this policy.
3. Under **Basic Info**, inspect **Token Protection - Sign In Session**. Review Bound/Unbound results and status codes, especially 1002, 1003, 1006, and 1008.
4. Confirm normal supported app use has been represented. Microsoft recommends analyzing long enough to cover normal application use; do not invent a fixed observation duration.
5. Resolve required unsupported clients, shared/service-device workflows, or unsupported registration types before enforcement.
6. Rescan IAMAI when the evidence or configuration changes.

Microsoft reference: https://learn.microsoft.com/en-us/entra/identity/conditional-access/deployment-guide-token-protection-windows
@@IAMAI-END

@@IAMAI-BEGIN {"id":"entra.enforce","channel":"entra","states":["readyToEnforce"],"format":"markdown","kind":"template"}
Verify the same policy and its prerequisites, set it to On, then complete the checks below and rescan. Do not rebuild the policy.

1. Open the policy IAMAI resolved.
2. Confirm the compatibility review still reflects the Windows clients and device workflows that matter now.
3. Change **Enable policy** from **Report-only** to **On** and save.
4. Verify after the change: a supported Windows native client on a registered device still reaches the targeted resources, and any deliberately selected exception path still works.
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
# This change removes {{policy.current.removedExclusions}} from the policy's exclusions. If the policy is On, it applies to them as soon as the correction is saved. [omit this line when unavailable]
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

STATE
This state creates the Windows token protection Conditional Access policy in Report-only.

TENANT CONTEXT
Target policy: {{policy.target.displayName}}
Resolved exclusions: {{policy.target.excludeGroups}}

INTENDED POLICY
All users; the resolved exclusions; exactly the baseline Exchange Online, SharePoint Online, Teams Services, Azure Virtual Desktop and Windows 365 resources; Windows; Mobile apps and desktop clients; the baseline CloudPC exclusion filter; no grant; Require token protection for sign-in sessions; Report-only.

SCOPE LIMIT
Token protection applies only to supported Windows native clients for these resources. It does not protect browser sessions, other platforms, or every token, and it does not block them either: what falls outside this policy is simply not evaluated by it. Microsoft's own advice is to cover that gap with a policy that blocks unknown platforms and one that requires a managed device, which are separate steps in this plan.

API NOTE
The JSON and PowerShell outputs use Microsoft Graph beta only because `secureSignInSession` is not exposed in the current v1.0 session-controls schema.

DO NOT CHANGE
Do not substitute the Office 365 suite, add Browser, add Windows Cloud Login, remove the device filter, or invent exception groups.

VERIFICATION
Read back the created policy, then use interactive and non-interactive sign-in evidence before recommending enforcement.

NEXT STEP
Explain the create action and the beta API limitation without changing the intended settings.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"ai.correct","channel":"aiInfo","states":["partial"],"format":"markdown","kind":"template"}
This state corrects the existing token protection policy. Correct only the differences IAMAI found, on the same policy ID.

Token protection makes supported sign-in session tokens harder to reuse on another device. In this policy it applies only to Exchange Online, SharePoint Online, Microsoft Teams Services, Azure Virtual Desktop and Windows 365, for Windows mobile apps and desktop clients, with Microsoft Entra joined Cloud PCs excluded by the device filter. It does not cover browser sessions, other platforms, or every token.

Keep the intended resources, Windows platform, client-app scope, CloudPC filter and resolved exclusions. The JSON and PowerShell outputs use Microsoft Graph beta because `secureSignInSession` is not exposed in the v1.0 session-controls schema.

Keep the policy's current state. If it is On, the changed rule can affect access after you save.

This change removes {{policy.current.removedExclusions}} from the policy's exclusions. If the policy is On, it applies to them as soon as you save. [omit this line when unavailable]
@@IAMAI-END

@@IAMAI-BEGIN {"id":"ai.observe","channel":"aiInfo","states":["reportOnly"],"format":"markdown","kind":"template"}

STATE
The policy is in Report-only. Do not recreate it.

EVIDENCE IAMAI HAS
Windows registration evidence: {{evidence.windowsRegistration}}
Token Protection compatibility evidence: {{evidence.tokenProtectionCompatibility}}

MICROSOFT RULES
Review both interactive and non-interactive sign-ins. `tokenProtectionStatusDetails` can show Bound/Unbound plus status codes such as 1002, 1003, 1006 and 1008. Unsupported clients or registration types may be blocked when enforcement begins.

OBSERVATION PERIOD
Microsoft does not prescribe one fixed observation duration; the evidence should cover normal application use.

NEXT STEP
Explain which compatibility evidence still blocks enforcement, for interactive and non-interactive sign-ins, and which Windows client or device workflows still need testing.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"ai.enforce","channel":"aiInfo","states":["readyToEnforce"],"format":"markdown","kind":"template"}

STATE
IAMAI shows this step Ready to enforce.

IMPLEMENTATION
Change only the existing policy's state from Report-only to On. Then run a controlled validation with supported Windows native clients and rescan IAMAI.

SCOPE LIMIT
Token protection applies only to the listed resources on supported Windows native clients. It does not protect browser sessions.

ROLLBACK / SAFE RECOVERY
If a required workflow fails, return the same policy to Report-only first. Diagnose the unsupported client/device path before changing exclusions or filters.

NEXT STEP
Explain the enforcement change and the client tests to run afterwards. The change is limited to the policy state.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"email.users.pre-enforcement","channel":"email","states":["readyToEnforce"],"format":"markdown","kind":"template","audience":"affected-windows-users","trigger":"before-enforcement","purpose":"pre-change-notice","recommendation":"recommended"}
Subject: Planned change: Require Token Protection on Windows

We are preparing extra sign-in protection for supported apps on Windows. If an app is blocked after the change, contact IT with the app, device and time of the attempt.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"readiness.model","channel":"readiness","states":["missing","partial","reportOnly","readyToEnforce","inPlace","blocked","needsDecision","sourceConflict","notLicensed"],"format":"json","kind":"referenceOnly"}
{
  "tiles": [
    {
      "id": "exceptions",
      "gate": "Approved exceptions",
      "resultSource": "tenant-evidence",
      "readyWhen": "IAMAI has resolved the complete intended exclusions for this policy.",
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
      "line": "Review supported Windows clients and token-protection evidence for normal interactive and background use."
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
  "safeNow": "Create the policy in Report-only, or correct the existing policy, when the resolved values are available.",
  "safeToEnforce": "Only after exception, registration, compatibility, and Report-only evidence gates are Ready.",
  "whyIamaiSaysThis": {
    "confirmed": ["Baseline target and policy settings come from the baseline."],
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
      "likelyCauses": ["Browser was selected, or the Client apps condition was left unconfigured, which reaches every client app."],
      "check": ["Inspect Conditions > Client apps: Configure must be Yes with Mobile apps and desktop clients the only selection."],
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

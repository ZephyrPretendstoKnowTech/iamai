# IAMAI content blocks — Limit How Long Sessions Last

Do not parse headings for execution. Select blocks only by `META.json` block IDs.

@@IAMAI-BEGIN {"id":"entra.create-set","channel":"entra","states":["missing"],"format":"markdown","kind":"template"}
Create this policy in Report-only. It will not enforce its access rule until you enable it. The baseline has one session policy for this step: the browser policy below.

Before this policy: turn off **Remember multifactor authentication on trusted devices** (Entra ID → Users → Per-user MFA → service settings). Microsoft says to disable it before using sign-in frequency; the two together prompt people at times neither setting intends, and it is a tenant-wide setting, so turning it off once covers this policy and Shorten Admin Sessions.

Entra admin center → Entra ID → Conditional Access → Policies → New policy.
1. Name: `{{policies.session.browser.target.displayName}}`.
2. Users: Include **All users**. Exclude the resolved exclusion groups, and only the individual accounts the resolved target names.
   Individual accounts the resolved target excludes: {{policy.target.excludeUsersSummary}}. [omit this line when unavailable]
3. Target resources: **All resources**.
4. Conditions → Client apps: set **Configure** to **Yes**, then **Browser** only. Left at **No** the condition reaches every client app, and the interval would apply to desktop and mobile apps as well.
5. Grant: no grant requirement.
6. Session: Sign-in frequency → Periodic reauthentication, set to the interval in the intended target shown on this step; Persistent browser session → **Never persistent**.
7. Enable policy: **Report-only**.

Save once. Rescan IAMAI so it records the new policy ID.
@@IAMAI-END
@@IAMAI-BEGIN {"id":"entra.correct.open","channel":"entra","states":["partial"],"format":"markdown","kind":"template"}
Open the policy IAMAI identified. Confirm its policy ID matches the one IAMAI shows before saving.
@@IAMAI-END
@@IAMAI-BEGIN {"id":"entra.correct.browser.missing","channel":"entra","states":["partial"],"format":"markdown","kind":"template"}
Create this policy in Report-only. It will not enforce its access rule until you enable it. Use the create steps for this step: Users All users, excluding the resolved exclusion groups and only the individual accounts the resolved target names; Target resources All resources; Client apps set through Configure: Yes, then Browser; no grant; Sign-in frequency set to the interval in the intended target (Periodic reauthentication); Persistent browser session Never persistent.
Individual accounts the resolved target excludes: {{policy.target.excludeUsersSummary}}. [omit this line when unavailable]
@@IAMAI-END
@@IAMAI-BEGIN {"id":"entra.correct.browser.conditions","channel":"entra","states":["partial"],"format":"markdown","kind":"template"}
For the browser policy, set Users to All users, excluding the resolved exclusion groups and only the individual accounts the resolved target names; Target resources to All resources; and Client apps through Configure: Yes, then Browser only, because at No the condition reaches every client app. Remove any risk, location, platform, device-filter, authentication-flow, application-exclusion, or other condition.
Individual accounts the resolved target excludes: {{policy.target.excludeUsersSummary}}. [omit this line when unavailable]
@@IAMAI-END
@@IAMAI-BEGIN {"id":"entra.correct.browser.session","channel":"entra","states":["partial"],"format":"markdown","kind":"template"}
For the browser policy, set Sign-in frequency to the interval in the intended target (Periodic reauthentication) and Persistent browser session to Never persistent. Remove any other session control. Do not add a grant requirement.
@@IAMAI-END
@@IAMAI-BEGIN {"id":"entra.correct.browser.grant-none","channel":"entra","states":["partial"],"format":"markdown","kind":"template"}
For the browser policy, remove any Grant requirement. This step is session-control-only; do not add MFA, authentication strength, device grant, or Block.
@@IAMAI-END
@@IAMAI-BEGIN {"id":"entra.correct.browser.lifecycle","channel":"entra","states":["partial"],"format":"markdown","kind":"template"}
Set the browser component to Report-only while material corrections are being validated.
@@IAMAI-END
@@IAMAI-BEGIN {"id":"entra.correct.unmanaged.missing","channel":"entra","states":["partial"],"format":"markdown","kind":"template"}
Create only the missing unmanaged-device component using the Policy B procedure from this package. Do not recreate the browser component.
@@IAMAI-END
@@IAMAI-BEGIN {"id":"entra.correct.unmanaged.conditions","channel":"entra","states":["partial"],"format":"markdown","kind":"template"}
For the unmanaged-device component, set Users to All users with IAMAI's canonical group/shared-device exclusions; Target resources to All resources; Client apps to All; and Filter for devices to Exclude `device.isCompliant -eq True`. Remove noncanonical risk, location, platform, authentication-flow, application-exclusion, or other conditions.
@@IAMAI-END
@@IAMAI-BEGIN {"id":"entra.correct.unmanaged.session","channel":"entra","states":["partial"],"format":"markdown","kind":"template"}
For the unmanaged-device component, set Sign-in frequency to 9 hours (Periodic reauthentication) and Persistent browser session to Never persistent. Remove other noncanonical v1.0 session controls. Do not add a grant requirement.
@@IAMAI-END
@@IAMAI-BEGIN {"id":"entra.correct.unmanaged.grant-none","channel":"entra","states":["partial"],"format":"markdown","kind":"template"}
For the unmanaged-device component, remove any Grant requirement. This step is session-control-only; do not add MFA, authentication strength, device grant, or Block.
@@IAMAI-END
@@IAMAI-BEGIN {"id":"entra.correct.unmanaged.lifecycle","channel":"entra","states":["partial"],"format":"markdown","kind":"template"}
Set the unmanaged-device component to Report-only while material corrections are being validated.
@@IAMAI-END
@@IAMAI-BEGIN {"id":"entra.correct.save-verify","channel":"entra","states":["partial"],"format":"markdown","kind":"template"}
Save only the selected correction(s), read the policy back by its policy ID, and rescan IAMAI.

Keep each policy's current state. If it is On, the changed rule can affect access after you save.

This change removes {{policies.session.browser.current.removedExclusions}} from the exclusions of {{policies.session.browser.current.displayName}}. If that policy is On, it applies to them as soon as you save. [omit this line when unavailable]
This change removes {{policies.session.unmanaged.current.removedExclusions}} from the exclusions of {{policies.session.unmanaged.current.displayName}}. If that policy is On, it applies to them as soon as you save. [omit this line when unavailable]
@@IAMAI-END
@@IAMAI-BEGIN {"id":"entra.observe","channel":"entra","states":["reportOnly"],"format":"markdown","kind":"template"}
Keep the policy in Report-only while you review the evidence listed for this step. Use Conditional Access What If, sign-in logs and controlled browser tests to confirm the policy applies to browser sign-ins with the intended target's sign-in frequency and Never persistent. Confirm the policy's exclusions still match the resolved target. Shared-device accounts are excluded only where that target lists them. Base the review on tenant records and tests, not on configuration alone.
@@IAMAI-END
@@IAMAI-BEGIN {"id":"entra.enforce","channel":"entra","states":["readyToEnforce"],"format":"markdown","kind":"template"}
Verify the same policy and its prerequisites, set it to On, then complete the checks below and rescan.

Open the browser policy by its policy ID. Confirm it still matches the intended settings and that readiness has no blocker. Change it from Report-only to **On** in a controlled change window.

Verify after the change: test representative sign-ins in managed and unmanaged browsers, including any account the resolved target excludes. Included accounts are asked to reauthenticate at the intended target's frequency and are not offered a persistent browser session; excluded accounts are not affected. Then rescan IAMAI.
@@IAMAI-END
@@IAMAI-BEGIN {"id":"json.browser.create","channel":"json","states":["missing","partial"],"format":"json-template","kind":"deployableAfterBinding","method":"POST","endpoint":"https://graph.microsoft.com/v1.0/identity/conditionalAccess/policies"}
{
  "displayName":"{{policies.session.browser.target.displayName}}",
  "state":"enabledForReportingButNotEnforced",
  "conditions":{
  "users": {"includeUsers":["All"],"excludeUsers":{{json:policy.target.excludeUsers}},"includeGroups":[],"excludeGroups":{{json:policy.target.excludeGroups}},"includeRoles":[],"excludeRoles":[]},
  "applications": {"includeApplications":["All"],"excludeApplications":[],"includeUserActions":[],"includeAuthenticationContextClassReferences":[],"applicationFilter":null},
  "clientAppTypes":["browser"],
  "signInRiskLevels":[],"userRiskLevels":[],"servicePrincipalRiskLevels":[],
  "locations":null,"platforms":null,"devices":null,"authenticationFlows":null,"insiderRiskLevels":null
},
  "grantControls":null,
  "sessionControls":{"signInFrequency":{"isEnabled":true,"frequencyInterval":"timeBased","authenticationType":"primaryAndSecondaryAuthentication","type":"hours","value":12},"persistentBrowser":{"isEnabled":true,"mode":"never"},"applicationEnforcedRestrictions":null,"cloudAppSecurity":null,"disableResilienceDefaults":null}
}
@@IAMAI-END
@@IAMAI-BEGIN {"id":"json.unmanaged.create","channel":"json","states":["missing","partial"],"format":"json-template","kind":"deployableAfterBinding","method":"POST","endpoint":"https://graph.microsoft.com/v1.0/identity/conditionalAccess/policies"}
{
  "displayName":"{{policies.session.unmanaged.target.displayName}}",
  "state":"enabledForReportingButNotEnforced",
  "conditions":{
  "users": {"includeUsers":["All"],"excludeUsers":{{json:policy.target.excludeUsers}},"includeGroups":[],"excludeGroups":{{json:policy.target.excludeGroups}},"includeRoles":[],"excludeRoles":[]},
  "applications": {"includeApplications":["All"],"excludeApplications":[],"includeUserActions":[],"includeAuthenticationContextClassReferences":[],"applicationFilter":null},
  "clientAppTypes":["all"],
  "signInRiskLevels":[],"userRiskLevels":[],"servicePrincipalRiskLevels":[],
  "locations":null,"platforms":null,
  "devices":{"deviceFilter":{"mode":"exclude","rule":"device.isCompliant -eq True"}},
  "authenticationFlows":null,"insiderRiskLevels":null
},
  "grantControls":null,
  "sessionControls":{"signInFrequency":{"isEnabled":true,"frequencyInterval":"timeBased","authenticationType":"primaryAndSecondaryAuthentication","type":"hours","value":9},"persistentBrowser":{"isEnabled":true,"mode":"never"},"applicationEnforcedRestrictions":null,"cloudAppSecurity":null,"disableResilienceDefaults":null}
}
@@IAMAI-END
@@IAMAI-BEGIN {"id":"json.browser.conditions","channel":"json","states":["partial"],"format":"json-template","kind":"deployableAfterBinding","method":"PATCH","endpoint":"https://graph.microsoft.com/v1.0/identity/conditionalAccess/policies/{policies.session.browser.current.id}"}
{"conditions":{
  "users": {"includeUsers":["All"],"excludeUsers":{{json:policy.target.excludeUsers}},"includeGroups":[],"excludeGroups":{{json:policy.target.excludeGroups}},"includeRoles":[],"excludeRoles":[]},
  "applications": {"includeApplications":["All"],"excludeApplications":[],"includeUserActions":[],"includeAuthenticationContextClassReferences":[],"applicationFilter":null},
  "clientAppTypes":["browser"],
  "signInRiskLevels":[],"userRiskLevels":[],"servicePrincipalRiskLevels":[],
  "locations":null,"platforms":null,"devices":null,"authenticationFlows":null,"insiderRiskLevels":null
}}
@@IAMAI-END
@@IAMAI-BEGIN {"id":"json.unmanaged.conditions","channel":"json","states":["partial"],"format":"json-template","kind":"deployableAfterBinding","method":"PATCH","endpoint":"https://graph.microsoft.com/v1.0/identity/conditionalAccess/policies/{policies.session.unmanaged.current.id}"}
{"conditions":{
  "users": {"includeUsers":["All"],"excludeUsers":{{json:policy.target.excludeUsers}},"includeGroups":[],"excludeGroups":{{json:policy.target.excludeGroups}},"includeRoles":[],"excludeRoles":[]},
  "applications": {"includeApplications":["All"],"excludeApplications":[],"includeUserActions":[],"includeAuthenticationContextClassReferences":[],"applicationFilter":null},
  "clientAppTypes":["all"],
  "signInRiskLevels":[],"userRiskLevels":[],"servicePrincipalRiskLevels":[],
  "locations":null,"platforms":null,
  "devices":{"deviceFilter":{"mode":"exclude","rule":"device.isCompliant -eq True"}},
  "authenticationFlows":null,"insiderRiskLevels":null
}}
@@IAMAI-END
@@IAMAI-BEGIN {"id":"json.browser.session","channel":"json","states":["partial"],"format":"json","kind":"deployableAfterBinding","method":"PATCH","endpoint":"https://graph.microsoft.com/v1.0/identity/conditionalAccess/policies/{policies.session.browser.current.id}"}
{"sessionControls":{"signInFrequency":{"isEnabled":true,"frequencyInterval":"timeBased","authenticationType":"primaryAndSecondaryAuthentication","type":"hours","value":12},"persistentBrowser":{"isEnabled":true,"mode":"never"},"applicationEnforcedRestrictions":null,"cloudAppSecurity":null,"disableResilienceDefaults":null}}
@@IAMAI-END
@@IAMAI-BEGIN {"id":"json.browser.grant-none","channel":"json","states":["partial"],"format":"json","kind":"deployableAfterBinding","method":"PATCH","endpoint":"https://graph.microsoft.com/v1.0/identity/conditionalAccess/policies/{policies.session.browser.current.id}"}
{"grantControls":null}
@@IAMAI-END
@@IAMAI-BEGIN {"id":"json.unmanaged.session","channel":"json","states":["partial"],"format":"json","kind":"deployableAfterBinding","method":"PATCH","endpoint":"https://graph.microsoft.com/v1.0/identity/conditionalAccess/policies/{policies.session.unmanaged.current.id}"}
{"sessionControls":{"signInFrequency":{"isEnabled":true,"frequencyInterval":"timeBased","authenticationType":"primaryAndSecondaryAuthentication","type":"hours","value":9},"persistentBrowser":{"isEnabled":true,"mode":"never"},"applicationEnforcedRestrictions":null,"cloudAppSecurity":null,"disableResilienceDefaults":null}}
@@IAMAI-END
@@IAMAI-BEGIN {"id":"json.unmanaged.grant-none","channel":"json","states":["partial"],"format":"json","kind":"deployableAfterBinding","method":"PATCH","endpoint":"https://graph.microsoft.com/v1.0/identity/conditionalAccess/policies/{policies.session.unmanaged.current.id}"}
{"grantControls":null}
@@IAMAI-END
@@IAMAI-BEGIN {"id":"json.browser.report-only","channel":"json","states":["partial"],"format":"json","kind":"deployableAfterBinding","method":"PATCH","endpoint":"https://graph.microsoft.com/v1.0/identity/conditionalAccess/policies/{policies.session.browser.current.id}"}
{"state":"enabledForReportingButNotEnforced"}
@@IAMAI-END
@@IAMAI-BEGIN {"id":"json.unmanaged.report-only","channel":"json","states":["partial"],"format":"json","kind":"deployableAfterBinding","method":"PATCH","endpoint":"https://graph.microsoft.com/v1.0/identity/conditionalAccess/policies/{policies.session.unmanaged.current.id}"}
{"state":"enabledForReportingButNotEnforced"}
@@IAMAI-END
@@IAMAI-BEGIN {"id":"json.browser.enforce","channel":"json","states":["readyToEnforce"],"format":"json","kind":"deployableAfterBinding","method":"PATCH","endpoint":"https://graph.microsoft.com/v1.0/identity/conditionalAccess/policies/{policies.session.browser.current.id}"}
{"state":"enabled"}
@@IAMAI-END
@@IAMAI-BEGIN {"id":"json.unmanaged.enforce","channel":"json","states":["readyToEnforce"],"format":"json","kind":"deployableAfterBinding","method":"PATCH","endpoint":"https://graph.microsoft.com/v1.0/identity/conditionalAccess/policies/{policies.session.unmanaged.current.id}"}
{"state":"enabled"}
@@IAMAI-END
@@IAMAI-BEGIN {"id":"powershell.run","channel":"powershell","states":["missing","partial","reportOnly","readyToEnforce"],"format":"powershell","kind":"deployableAfterBinding","invocation":{"modeParameter":"Mode","parameters":{"BrowserPolicyDisplayName":{"binding":"policies.session.browser.target.displayName","modes":["Create","CreateBrowser"]},"UnmanagedPolicyDisplayName":{"binding":"policies.session.unmanaged.target.displayName","modes":["Create","CreateUnmanaged"]},"BrowserPolicyId":{"binding":"policies.session.browser.current.id","modes":["CorrectBrowserConditions","CorrectBrowserSession","CorrectBrowserGrant","ReportOnlyBrowser","Verify","VerifyBrowser"]},"UnmanagedPolicyId":{"binding":"policies.session.unmanaged.current.id","modes":["CorrectUnmanagedConditions","CorrectUnmanagedSession","CorrectUnmanagedGrant","ReportOnlyUnmanaged","Verify"]},"ExcludeGroupIds":{"binding":"policy.target.excludeGroups","modes":["Create","CreateBrowser","CreateUnmanaged","CorrectBrowserConditions","CorrectUnmanagedConditions","Verify","VerifyBrowser"]},"ExcludeUserIds":{"binding":"policy.target.excludeUsers","modes":["Create","CreateBrowser","CreateUnmanaged","CorrectBrowserConditions","CorrectUnmanagedConditions","Verify","VerifyBrowser"]}},"withheldModes":{"Create":"Create also writes the unmanaged-device companion, and the pinned baseline has no unmanaged-device session policy to name it; CreateBrowser writes the browser policy alone","Enforce":"the script enforces only with -ReadinessApproved, an attestation this package declares no prerequisite for, so IAMAI cannot pass it; Enforce also turns on the unmanaged-device companion, which the pinned baseline has no policy for"}}}
# This change removes {{policies.session.browser.current.removedExclusions}} from the exclusions of {{policies.session.browser.current.displayName}}. If that policy is On, it applies to them as soon as the correction is saved. [omit this line when unavailable]
# This change removes {{policies.session.unmanaged.current.removedExclusions}} from the exclusions of {{policies.session.unmanaged.current.displayName}}. If that policy is On, it applies to them as soon as the correction is saved. [omit this line when unavailable]
# IAMAI compact implementation script — Limit How Long Sessions Last
# Module: Microsoft.Graph.Authentication
[CmdletBinding()]
param(
  [Parameter(Mandatory)]
  [ValidateSet('Create','CreateBrowser','CreateUnmanaged','CorrectBrowserConditions','CorrectBrowserSession','CorrectBrowserGrant','ReportOnlyBrowser','CorrectUnmanagedConditions','CorrectUnmanagedSession','CorrectUnmanagedGrant','ReportOnlyUnmanaged','Verify','VerifyBrowser','Enforce')]
  [string] $Mode,
  [string] $BrowserPolicyDisplayName,
  [string] $UnmanagedPolicyDisplayName,
  [ValidatePattern('^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$')]
  [string] $BrowserPolicyId,
  [ValidatePattern('^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$')]
  [string] $UnmanagedPolicyId,
  [string[]] $ExcludeGroupIds = @(),
  [string[]] $ExcludeUserIds = @(),
  [switch] $ReadinessApproved
)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$Base = 'https://graph.microsoft.com/v1.0/identity/conditionalAccess/policies'
$Guid = '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'

function Assert-Ids([string[]] $Ids) {
  $bad = @($Ids | Where-Object { $_ -notmatch $Guid })
  if ($bad.Count -gt 0) { throw 'A supplied tenant object ID is invalid.' }
}
function Same-Set($A,$B) { return ((@($A | Sort-Object) -join '|') -eq (@($B | Sort-Object) -join '|')) }
function Connect-CA([bool] $Write) {
  Import-Module Microsoft.Graph.Authentication -ErrorAction Stop
  $scopes = @('Policy.Read.All')
  if ($Write) { $scopes += 'Policy.ReadWrite.ConditionalAccess' }
  $ctx = Get-MgContext
  $missing = if ($ctx) { @($scopes | Where-Object { $_ -notin @($ctx.Scopes) }) } else { $scopes }
  if (-not $ctx -or $missing.Count -gt 0) { Connect-MgGraph -Scopes $scopes -NoWelcome }
}
function Get-Policy([string] $Id) {
  if ($Id -notmatch $Guid) { throw 'A stable IAMAI policy ID is required.' }
  $p = Invoke-MgGraphRequest -Method GET -Uri "$Base/$Id"
  if ($p.id -ne $Id) { throw 'Stable-ID readback failed.' }
  return $p
}
function New-Users {
  Assert-Ids $ExcludeGroupIds; Assert-Ids $ExcludeUserIds
  return @{includeUsers=@('All');excludeUsers=@($ExcludeUserIds);includeGroups=@();excludeGroups=@($ExcludeGroupIds);includeRoles=@();excludeRoles=@()}
}
function New-BrowserConditions {
  return @{users=(New-Users);applications=@{includeApplications=@('All');excludeApplications=@();includeUserActions=@();includeAuthenticationContextClassReferences=@();applicationFilter=$null};clientAppTypes=@('browser');signInRiskLevels=@();userRiskLevels=@();servicePrincipalRiskLevels=@();locations=$null;platforms=$null;devices=$null;authenticationFlows=$null;insiderRiskLevels=$null}
}
function New-UnmanagedConditions {
  return @{users=(New-Users);applications=@{includeApplications=@('All');excludeApplications=@();includeUserActions=@();includeAuthenticationContextClassReferences=@();applicationFilter=$null};clientAppTypes=@('all');signInRiskLevels=@();userRiskLevels=@();servicePrincipalRiskLevels=@();locations=$null;platforms=$null;devices=@{deviceFilter=@{mode='exclude';rule='device.isCompliant -eq True'}};authenticationFlows=$null;insiderRiskLevels=$null}
}
function New-Session([int] $Hours) {
  return @{signInFrequency=@{isEnabled=$true;frequencyInterval='timeBased';authenticationType='primaryAndSecondaryAuthentication';type='hours';value=$Hours};persistentBrowser=@{isEnabled=$true;mode='never'};applicationEnforcedRestrictions=$null;cloudAppSecurity=$null;disableResilienceDefaults=$null}
}
function Assert-NoNameCollision([string] $Name) {
  $escaped = $Name.Replace("'","''")
  $filter = [uri]::EscapeDataString("displayName eq '$escaped'")
  $matches = @((Invoke-MgGraphRequest -Method GET -Uri "$Base?`$filter=$filter").value)
  if ($matches.Count -gt 0) { throw "Policy '$Name' already exists. Rescan IAMAI; do not create a duplicate." }
}
function New-One([string] $Name,[hashtable] $Conditions,[int] $Hours) {
  if ([string]::IsNullOrWhiteSpace($Name)) { throw 'Target display name required.' }
  Assert-NoNameCollision $Name
  $body = @{displayName=$Name;state='enabledForReportingButNotEnforced';conditions=$Conditions;grantControls=$null;sessionControls=(New-Session $Hours)}
  $created = Invoke-MgGraphRequest -Method POST -Uri $Base -Body ($body | ConvertTo-Json -Depth 20) -ContentType 'application/json'
  if (-not $created.id) { throw 'Graph returned no policy ID.' }
  return $created.id
}
function Patch-One([string] $Id,[hashtable] $Body) {
  [void](Get-Policy $Id)
  Invoke-MgGraphRequest -Method PATCH -Uri "$Base/$Id" -Body ($Body | ConvertTo-Json -Depth 20) -ContentType 'application/json' | Out-Null
}
function Assert-Canonical($Policy,[ValidateSet('Browser','Unmanaged')][string] $Kind) {
  Assert-Ids $ExcludeGroupIds; Assert-Ids $ExcludeUserIds
  $errors = [System.Collections.Generic.List[string]]::new()
  if (@($Policy.conditions.users.includeUsers).Count -ne 1 -or @($Policy.conditions.users.includeUsers)[0] -ne 'All') { $errors.Add('includeUsers is not exactly All.') }
  if (-not (Same-Set @($Policy.conditions.users.excludeGroups) @($ExcludeGroupIds))) { $errors.Add('excludeGroups differs from IAMAI canonical target.') }
  if (-not (Same-Set @($Policy.conditions.users.excludeUsers) @($ExcludeUserIds))) { $errors.Add('excludeUsers/shared-device set differs from IAMAI canonical target.') }
  if (@($Policy.conditions.applications.includeApplications).Count -ne 1 -or @($Policy.conditions.applications.includeApplications)[0] -ne 'All') { $errors.Add('Target resources is not exactly All resources.') }
  if (@($Policy.conditions.applications.excludeApplications).Count -ne 0 -or @($Policy.conditions.applications.includeUserActions).Count -ne 0 -or @($Policy.conditions.applications.includeAuthenticationContextClassReferences).Count -ne 0) { $errors.Add('A noncanonical application/user-action/authentication-context target exists.') }
  $wantClient = if ($Kind -eq 'Browser') { 'browser' } else { 'all' }
  if (@($Policy.conditions.clientAppTypes).Count -ne 1 -or @($Policy.conditions.clientAppTypes)[0] -ne $wantClient) { $errors.Add("clientAppTypes differs for $Kind.") }
  if (@($Policy.conditions.signInRiskLevels).Count -ne 0 -or @($Policy.conditions.userRiskLevels).Count -ne 0 -or @($Policy.conditions.servicePrincipalRiskLevels).Count -ne 0) { $errors.Add('A noncanonical risk condition exists.') }
  foreach ($field in @('locations','platforms','authenticationFlows','insiderRiskLevels')) { if ($null -ne $Policy.conditions.$field) { $errors.Add("Noncanonical condition exists: $field") } }
  if ($Kind -eq 'Browser') {
    if ($null -ne $Policy.conditions.devices) { $errors.Add('Browser component has a noncanonical device condition.') }
  } else {
    if ($Policy.conditions.devices.deviceFilter.mode -ne 'exclude' -or $Policy.conditions.devices.deviceFilter.rule -ne 'device.isCompliant -eq True') { $errors.Add('Unmanaged component device filter differs from canonical target.') }
  }
  if ($null -ne $Policy.grantControls) { $errors.Add('A grant control is present; this step is session-control-only.') }
  $hours = if ($Kind -eq 'Browser') { 12 } else { 9 }
  $sif = $Policy.sessionControls.signInFrequency
  if (-not $sif.isEnabled -or $sif.frequencyInterval -ne 'timeBased' -or $sif.authenticationType -ne 'primaryAndSecondaryAuthentication' -or $sif.type -ne 'hours' -or $sif.value -ne $hours) { $errors.Add("$Kind sign-in frequency differs from canonical $hours hours.") }
  $pb = $Policy.sessionControls.persistentBrowser
  if (-not $pb.isEnabled -or $pb.mode -ne 'never') { $errors.Add('Persistent browser is not Never.') }
  foreach ($field in @('applicationEnforcedRestrictions','cloudAppSecurity','disableResilienceDefaults')) { if ($null -ne $Policy.sessionControls.$field) { $errors.Add("Noncanonical v1.0 session control exists: $field") } }
  if ($errors.Count -gt 0) { $errors | ForEach-Object { Write-Error $_ }; throw "$Kind policy verification failed." }
}

switch ($Mode) {
  'Create' {
    Connect-CA $true
    $browserId = New-One $BrowserPolicyDisplayName (New-BrowserConditions) 12
    try { $unmanagedId = New-One $UnmanagedPolicyDisplayName (New-UnmanagedConditions) 9 }
    catch { Write-Warning "Browser policy $browserId was created in Report-only but companion creation failed. Rescan IAMAI; do not create a duplicate."; throw }
    Write-Host "Created browser $browserId and unmanaged $unmanagedId in Report-only. Rescan IAMAI."
  }
  'CreateBrowser' { Connect-CA $true; Write-Host "Created browser policy $(New-One $BrowserPolicyDisplayName (New-BrowserConditions) 12) in Report-only. Rescan IAMAI." }
  'CreateUnmanaged' { Connect-CA $true; Write-Host "Created unmanaged policy $(New-One $UnmanagedPolicyDisplayName (New-UnmanagedConditions) 9) in Report-only. Rescan IAMAI." }
  'CorrectBrowserConditions' { Connect-CA $true; Patch-One $BrowserPolicyId @{conditions=(New-BrowserConditions)} }
  'CorrectBrowserSession' { Connect-CA $true; Patch-One $BrowserPolicyId @{sessionControls=(New-Session 12)} }
  'CorrectBrowserGrant' { Connect-CA $true; Patch-One $BrowserPolicyId @{grantControls=$null} }
  'ReportOnlyBrowser' { Connect-CA $true; Patch-One $BrowserPolicyId @{state='enabledForReportingButNotEnforced'} }
  'CorrectUnmanagedConditions' { Connect-CA $true; Patch-One $UnmanagedPolicyId @{conditions=(New-UnmanagedConditions)} }
  'CorrectUnmanagedSession' { Connect-CA $true; Patch-One $UnmanagedPolicyId @{sessionControls=(New-Session 9)} }
  'CorrectUnmanagedGrant' { Connect-CA $true; Patch-One $UnmanagedPolicyId @{grantControls=$null} }
  'ReportOnlyUnmanaged' { Connect-CA $true; Patch-One $UnmanagedPolicyId @{state='enabledForReportingButNotEnforced'} }
  'Verify' {
    Connect-CA $false
    $a=Get-Policy $BrowserPolicyId; $b=Get-Policy $UnmanagedPolicyId
    Assert-Canonical $a 'Browser'; Assert-Canonical $b 'Unmanaged'
    if ($a.state -notin @('enabledForReportingButNotEnforced','enabled') -or $b.state -notin @('enabledForReportingButNotEnforced','enabled')) { throw 'Unexpected lifecycle state.' }
    Write-Host 'Canonical two-policy shapes verified. Readiness remains a separate decision.'
  }
  'VerifyBrowser' {
    Connect-CA $false
    $a=Get-Policy $BrowserPolicyId
    Assert-Canonical $a 'Browser'
    if ($a.state -notin @('enabledForReportingButNotEnforced','enabled')) { throw 'Unexpected lifecycle state.' }
    Write-Host 'Canonical browser policy shape verified. Readiness remains a separate decision.'
  }
  'Enforce' {
    if (-not $ReadinessApproved) { throw 'Enforce requires ReadinessApproved.' }
    Connect-CA $true
    $a=Get-Policy $BrowserPolicyId; $b=Get-Policy $UnmanagedPolicyId
    Assert-Canonical $a 'Browser'; Assert-Canonical $b 'Unmanaged'
    if ($a.state -ne 'enabledForReportingButNotEnforced' -or $b.state -ne 'enabledForReportingButNotEnforced') { throw 'Both policies must be Report-only immediately before enforcement.' }
    Patch-One $BrowserPolicyId @{state='enabled'}
    try { Patch-One $UnmanagedPolicyId @{state='enabled'} }
    catch { Patch-One $BrowserPolicyId @{state='enabledForReportingButNotEnforced'}; throw }
    $afterA=Get-Policy $BrowserPolicyId; $afterB=Get-Policy $UnmanagedPolicyId
    if ($afterA.state -ne 'enabled' -or $afterB.state -ne 'enabled') { throw 'Post-enforcement lifecycle readback failed.' }
    Write-Host 'Both session policies enabled. Test representative paths and rescan IAMAI.'
  }
}
@@IAMAI-END
@@IAMAI-BEGIN {"id":"ai.create","channel":"aiInfo","states":["missing"],"format":"markdown","kind":"template"}

STATE
This state creates the browser session policy in Report-only. The baseline has one session policy for this step; there is no second policy to create, correct or enable.

TENANT CONTEXT
- Tenant: {{tenant.displayName}} [omit if unavailable]
- Affected people: {{people.affected.count}} [omit if unavailable]
- Existing blockers: {{dependencies.blockers}} [omit if unavailable]

INTENDED POLICY
All users, excluding the resolved exclusion groups and only the individual accounts the resolved target names; All resources; Client apps set through Configure: Yes, then Browser; Sign-in frequency as the intended target sets it (periodic reauthentication); Persistent browser session Never persistent; no grant.
Individual accounts the resolved target excludes: {{policy.target.excludeUsersSummary}}. [omit this line when unavailable]

CAUTIONS
Shared-device accounts are excluded only where this policy's resolved target lists them. This policy controls browser sign-in sessions; closing a browser does not necessarily end every application session. Do not add a companion policy, conditions or exclusions that the baseline does not contain.
@@IAMAI-END
@@IAMAI-BEGIN {"id":"ai.correct","channel":"aiInfo","states":["partial"],"format":"markdown","kind":"template"}

STATE
This state corrects the existing browser session policy. Correct only the differences IAMAI found, on the same policy ID. The baseline has one session policy for this step.

TENANT CONTEXT
- Tenant: {{tenant.displayName}} [omit if unavailable]
- Affected people: {{people.affected.count}} [omit if unavailable]
- Existing blockers: {{dependencies.blockers}} [omit if unavailable]

INTENDED POLICY
All users, excluding the resolved exclusion groups and only the individual accounts the resolved target names; All resources; Client apps set through Configure: Yes, then Browser; Sign-in frequency as the intended target sets it (periodic reauthentication); Persistent browser session Never persistent; no grant.
Individual accounts the resolved target excludes: {{policy.target.excludeUsersSummary}}. [omit this line when unavailable]

CAUTIONS
Shared-device accounts are excluded only where this policy's resolved target lists them. Do not add a companion policy, conditions or exclusions that the baseline does not contain.

Keep the policy's current state. If it is On, the changed rule can affect access after you save.

This change removes {{policies.session.browser.current.removedExclusions}} from the exclusions of {{policies.session.browser.current.displayName}}. If that policy is On, it applies to them as soon as you save. [omit this line when unavailable]
This change removes {{policies.session.unmanaged.current.removedExclusions}} from the exclusions of {{policies.session.unmanaged.current.displayName}}. If that policy is On, it applies to them as soon as you save. [omit this line when unavailable]
@@IAMAI-END
@@IAMAI-BEGIN {"id":"ai.observe","channel":"aiInfo","states":["reportOnly"],"format":"markdown","kind":"template"}

STATE
The browser session policy is in Report-only. The baseline has one session policy for this step.

TENANT CONTEXT
- Tenant: {{tenant.displayName}} [omit if unavailable]
- Affected people: {{people.affected.count}} [omit if unavailable]
- Existing blockers: {{dependencies.blockers}} [omit if unavailable]

INTENDED POLICY
All users, excluding the resolved exclusion groups and only the individual accounts the resolved target names; All resources; Client apps set through Configure: Yes, then Browser; Sign-in frequency as the intended target sets it (periodic reauthentication); Persistent browser session Never persistent; no grant.
Individual accounts the resolved target excludes: {{policy.target.excludeUsersSummary}}. [omit this line when unavailable]

CAUTIONS
Shared-device accounts are excluded only where this policy's resolved target lists them. Configuration alone does not show the sign-in experience.

NEXT STEP
Explain which What If results, sign-in records and browser tests are still needed before enforcement.
@@IAMAI-END
@@IAMAI-BEGIN {"id":"ai.enforce","channel":"aiInfo","states":["readyToEnforce"],"format":"markdown","kind":"template"}

STATE
This state enables the reviewed browser session policy. The only change is its state from Report-only to On. The baseline has one session policy for this step.

TENANT CONTEXT
- Tenant: {{tenant.displayName}} [omit if unavailable]
- Affected people: {{people.affected.count}} [omit if unavailable]
- Existing blockers: {{dependencies.blockers}} [omit if unavailable]

INTENDED POLICY
All users, excluding the resolved exclusion groups and only the individual accounts the resolved target names; All resources; Client apps set through Configure: Yes, then Browser; Sign-in frequency as the intended target sets it (periodic reauthentication); Persistent browser session Never persistent; no grant.
Individual accounts the resolved target excludes: {{policy.target.excludeUsersSummary}}. [omit this line when unavailable]

CAUTIONS
Shared-device accounts are excluded only where this policy's resolved target lists them. This policy controls browser sign-in sessions; closing a browser does not necessarily end every application session.

NEXT STEP
Explain the change and the browser tests to run afterwards, in managed and unmanaged browsers, including any account the resolved target excludes.
@@IAMAI-END
@@IAMAI-BEGIN {"id":"email.users.pre-enforcement","channel":"email","states":["readyToEnforce"],"format":"markdown","kind":"template","audience":"all-users","trigger":"before-enforcement","purpose":"pre-change-notice","recommendation":"recommended"}
Subject: Planned change: Limit How Long Sessions Last

Hi everyone,

We plan to change browser sign-in to the new frequency and disable persistent browser sign-in. You may need to sign in again more often. Contact IT if repeated prompts interrupt work.

Thanks,
IT
@@IAMAI-END
@@IAMAI-BEGIN {"id":"readiness.model","channel":"readiness","states":["missing","partial","reportOnly","readyToEnforce","inPlace","blocked","needsDecision","sourceConflict","notLicensed"],"format":"json","kind":"referenceOnly"}
{
  "schemaVersion": "1.0",
  "stepId": "s-goal-session-lifetime",
  "tiles": [
    {
      "id": "policy-pair",
      "label": "Browser policy",
      "gate": "The browser policy resolves to the intended tenant policy or an approved create operation.",
      "results": [
        "Ready",
        "Review required",
        "Unknown",
        "Blocked"
      ],
      "why": "The baseline has one session policy for this step, and IAMAI compares the tenant's browser policy with it."
    },
    {
      "id": "shared-devices",
      "label": "Excluded accounts",
      "gate": "The individual accounts the target excludes are resolved: the exact set, or none where the target excludes nobody.",
      "results": [
        "Ready",
        "Review required",
        "Unknown",
        "Blocked"
      ],
      "why": "Check the intended target's frequency and the exact resolved exclusions. Shared-device accounts are excluded only if the target actually names them."
    },
    {
      "id": "unmanaged-boundary",
      "label": "Browser scope",
      "gate": "The policy targets browser sign-ins only, as the baseline does.",
      "results": [
        "Ready",
        "Review required",
        "Unknown",
        "Blocked"
      ],
      "why": "A browser session control is not an all-device policy; apps outside the browser are not limited by this step."
    },
    {
      "id": "enforcement",
      "label": "Safe to enforce",
      "gate": "The browser policy matches the intended settings, is in Report-only, and controlled validation shows no unresolved blocker.",
      "results": [
        "Ready",
        "Review required",
        "Unknown",
        "Blocked"
      ],
      "why": "Configuration correctness and safe enforcement are separate conclusions."
    }
  ],
  "whyIAMAI": {
    "configurationEvidence": [
      "Conditional Access policy objects and resolved exclusions"
    ],
    "behaviorEvidence": [
      "What If, sign-in records, and controlled tests when available"
    ],
    "unknownRule": "No evidence is not success; leave the result Unknown."
  }
}
@@IAMAI-END
@@IAMAI-BEGIN {"id":"troubleshooting.model","channel":"troubleshooting","states":["missing","partial","reportOnly","readyToEnforce","inPlace"],"format":"json","kind":"referenceOnly"}
{
  "schemaVersion": "1.0",
  "stepId": "s-goal-session-lifetime",
  "scenarios": [
    {
      "id": "unexpected-frequent-prompts",
      "classification": "documented",
      "states": [
        "reportOnly",
        "readyToEnforce",
        "inPlace"
      ],
      "channels": [
        "entra",
        "powershell"
      ],
      "symptom": "Users are prompted more often than the configured interval suggests.",
      "check": [
        "Review all applicable Conditional Access session policies; another more restrictive sign-in-frequency policy can affect the session."
      ],
      "fix": [
        "Correct the unintended overlapping policy rather than weakening this policy without evidence."
      ],
      "doNot": [
        "Do not assume the displayed policy is the only session control applying."
      ],
      "then": "Retest and rescan IAMAI.",
      "sourceIds": [
        "ms-session-lifetime-concept"
      ]
    },
    {
      "id": "shared-device-signout",
      "classification": "derived",
      "states": [
        "reportOnly",
        "readyToEnforce",
        "inPlace"
      ],
      "channels": [
        "entra",
        "powershell"
      ],
      "symptom": "A room/shared device starts cycling through sign-in prompts or signs out.",
      "check": [
        "Confirm its account is in IAMAI\u2019s resolved exclusions on the browser policy, and whether the resolved target names it at all."
      ],
      "fix": [
        "Correct the browser policy to the resolved exclusion set, then retest."
      ],
      "doNot": [
        "Do not broadly exclude ordinary users or disable all session controls."
      ],
      "then": "Return the browser policy to Report-only if service remains disrupted.",
      "sourceIds": [
        "ms-session-lifetime-config"
      ]
    },
    {
      "id": "persistent-browser-not-working",
      "classification": "documented",
      "states": [
        "reportOnly",
        "readyToEnforce",
        "inPlace"
      ],
      "channels": [
        "entra",
        "json",
        "powershell"
      ],
      "symptom": "Never persistent does not behave as expected.",
      "check": [
        "Verify the policy targets All resources and persistentBrowser is enabled with mode never."
      ],
      "fix": [
        "Restore the canonical All-resources target and session control."
      ],
      "doNot": [
        "Do not narrow the app/resource target for a persistent-browser policy."
      ],
      "then": "Retest in a fresh browser session.",
      "sourceIds": [
        "ms-ca-session-controls-v1",
        "ms-persistent-browser-v1"
      ]
    },
    {
      "id": "wrong-unmanaged-scope",
      "classification": "derived",
      "states": [
        "partial",
        "reportOnly",
        "readyToEnforce"
      ],
      "channels": [
        "entra",
        "json",
        "powershell"
      ],
      "symptom": "The session control appears to affect apps outside the browser, or misses browser sign-ins.",
      "check": [
        "Verify Client apps is Browser only, with no device filter the pinned baseline does not have."
      ],
      "fix": [
        "Correct the browser policy conditions by stable ID."
      ],
      "doNot": [
        "Do not add a device filter or an app list the pinned baseline does not contain."
      ],
      "then": "Use What If/tenant evidence and rescan.",
      "sourceIds": [
        "ms-ca-device-filter-v1",
        "ms-session-lifetime-config"
      ]
    }
  ]
}
@@IAMAI-END

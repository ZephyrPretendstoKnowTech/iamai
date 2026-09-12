# IAMAI content blocks — Limit How Long Sessions Last

Do not parse headings for execution. Select blocks only by `META.json` block IDs.

@@IAMAI-BEGIN {"id":"entra.create-set","channel":"entra","states":["missing"],"format":"markdown","kind":"template"}
Create two separate Conditional Access policies. For each: Entra admin center → Entra ID → Conditional Access → Policies → New policy.

**Policy A — browser**
1. Name: `{{policies.session.browser.target.displayName}}`.
2. Users: Include **All users**. Exclude IAMAI's canonical groups and the resolved shared-device accounts.
3. Target resources: **All resources**.
4. Conditions → Client apps: **Browser**.
5. Grant: no grant requirement.
6. Session: Sign-in frequency → Periodic reauthentication → **12 hours**; Persistent browser session → **Never persistent**.
7. Enable policy: **Report-only**.

**Policy B — unmanaged device**
1. Name: `{{policies.session.unmanaged.target.displayName}}`.
2. Users: same canonical groups/shared-device exclusions.
3. Target resources: **All resources**.
4. Conditions → Filter for devices: Configure Yes → Exclude filtered devices → `device.isCompliant -eq True`.
5. Grant: no grant requirement.
6. Session: Sign-in frequency → Periodic reauthentication → **9 hours**; Persistent browser session → **Never persistent**.
7. Enable policy: **Report-only**.

Save each once. Rescan IAMAI so each tenant object gets a stable ID.
@@IAMAI-END
@@IAMAI-BEGIN {"id":"entra.correct.open","channel":"entra","states":["partial"],"format":"markdown","kind":"template"}
Open only the component policy IAMAI identified. Confirm the stable policy identity shown by IAMAI before saving. Keep or return a materially incorrect policy to **Report-only** while correcting it.
@@IAMAI-END
@@IAMAI-BEGIN {"id":"entra.correct.browser.missing","channel":"entra","states":["partial"],"format":"markdown","kind":"template"}
Create only the missing browser component using the Policy A procedure from this package. Do not recreate the unmanaged component.
@@IAMAI-END
@@IAMAI-BEGIN {"id":"entra.correct.browser.conditions","channel":"entra","states":["partial"],"format":"markdown","kind":"template"}
For the browser component, set Users to All users with IAMAI's canonical group/shared-device exclusions, Target resources to All resources, and Client apps to Browser. Remove noncanonical risk, location, platform, device-filter, authentication-flow, application-exclusion, or other conditions.
@@IAMAI-END
@@IAMAI-BEGIN {"id":"entra.correct.browser.session","channel":"entra","states":["partial"],"format":"markdown","kind":"template"}
For the browser component, set Sign-in frequency to 12 hours (Periodic reauthentication) and Persistent browser session to Never persistent. Remove other noncanonical v1.0 session controls. Do not add a grant requirement.
@@IAMAI-END
@@IAMAI-BEGIN {"id":"entra.correct.browser.grant-none","channel":"entra","states":["partial"],"format":"markdown","kind":"template"}
For the browser component, remove any Grant requirement. This step is session-control-only; do not add MFA, authentication strength, device grant, or Block.
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
Save only the selected correction(s), read the affected policy back, and rescan IAMAI. Do not enable either component until the two-policy set is canonical and readiness passes.
@@IAMAI-END
@@IAMAI-BEGIN {"id":"entra.observe","channel":"entra","states":["reportOnly"],"format":"markdown","kind":"template"}
Leave both component policies in Report-only. Use Conditional Access What If and sign-in logs plus controlled browser tests. Verify the browser policy applies to browser sign-ins and the unmanaged-device policy is limited by its compliance filter. Confirm shared-device accounts remain excluded. Observation evidence must come from actual tenant records/tests; do not infer success from configuration alone.
@@IAMAI-END
@@IAMAI-BEGIN {"id":"entra.enforce","channel":"entra","states":["readyToEnforce"],"format":"markdown","kind":"template"}
Open both IAMAI-resolved component policies by stable identity. Confirm each still matches the canonical target and that readiness has no blocker. Change Policy A and Policy B from Report-only to **On** in the same controlled change window. Test managed, unmanaged, and shared-device paths, then rescan IAMAI.
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
@@IAMAI-BEGIN {"id":"powershell.run","channel":"powershell","states":["missing","partial","reportOnly","readyToEnforce"],"format":"powershell","kind":"deployableAfterBinding","invocation":{"modeParameter":"Mode","parameters":{"BrowserPolicyDisplayName":{"binding":"policies.session.browser.target.displayName","modes":["Create","CreateBrowser"]},"UnmanagedPolicyDisplayName":{"binding":"policies.session.unmanaged.target.displayName","modes":["Create","CreateUnmanaged"]},"BrowserPolicyId":{"binding":"policies.session.browser.current.id","modes":["CorrectBrowserConditions","CorrectBrowserSession","CorrectBrowserGrant","ReportOnlyBrowser","Verify"]},"UnmanagedPolicyId":{"binding":"policies.session.unmanaged.current.id","modes":["CorrectUnmanagedConditions","CorrectUnmanagedSession","CorrectUnmanagedGrant","ReportOnlyUnmanaged","Verify"]},"ExcludeGroupIds":{"binding":"policy.target.excludeGroups","modes":["Create","CreateBrowser","CreateUnmanaged","CorrectBrowserConditions","CorrectUnmanagedConditions","Verify"]},"ExcludeUserIds":{"binding":"policy.target.excludeUsers","modes":["Create","CreateBrowser","CreateUnmanaged","CorrectBrowserConditions","CorrectUnmanagedConditions","Verify"]}},"withheldModes":{"Enforce":"the script enforces only with -ReadinessApproved, an attestation this package declares no prerequisite for, so IAMAI cannot pass it"}}}
# IAMAI compact implementation script — Limit How Long Sessions Last
# Module: Microsoft.Graph.Authentication
[CmdletBinding()]
param(
  [Parameter(Mandatory)]
  [ValidateSet('Create','CreateBrowser','CreateUnmanaged','CorrectBrowserConditions','CorrectBrowserSession','CorrectBrowserGrant','ReportOnlyBrowser','CorrectUnmanagedConditions','CorrectUnmanagedSession','CorrectUnmanagedGrant','ReportOnlyUnmanaged','Verify','Enforce')]
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
**Contains tenant context. Review before sharing with an external AI service.**

ROLE
Help implement the IAMAI step **Limit How Long Sessions Last**. Create the intentional two-policy session set in Report-only.

AUTHORITY
The retained IAMAI baseline and package own the destination. Current Microsoft documentation owns current product/API behavior. Do not redesign the two-policy set or infer tenant facts.

TENANT CONTEXT
- Tenant: {{tenant.displayName}} [omit if unavailable]
- Affected people: {{people.affected.count}} [omit if unavailable]
- Existing blockers: {{dependencies.blockers}} [omit if unavailable]

TARGET
Policy A: All users; canonical group/shared-device exclusions; All resources; Browser; 12-hour periodic sign-in frequency; Never persistent; no grant. Policy B: same population/resources; All client apps; exclude compliant devices with `device.isCompliant -eq True`; 9-hour frequency; Never persistent; no grant.

RULES
Use stable tenant policy IDs for updates. Unknown evidence remains Unknown. Do not collapse the two policies. Do not add new conditions or exclusions. Return conclusions, checks, assumptions, evidence, and the smallest safe next action.
@@IAMAI-END
@@IAMAI-BEGIN {"id":"ai.correct","channel":"aiInfo","states":["partial"],"format":"markdown","kind":"template"}
**Contains tenant context. Review before sharing with an external AI service.**

ROLE
Help implement the IAMAI step **Limit How Long Sessions Last**. Correct only IAMAI-classified mismatches on the affected component policies.

AUTHORITY
The retained IAMAI baseline and package own the destination. Current Microsoft documentation owns current product/API behavior. Do not redesign the two-policy set or infer tenant facts.

TENANT CONTEXT
- Tenant: {{tenant.displayName}} [omit if unavailable]
- Affected people: {{people.affected.count}} [omit if unavailable]
- Existing blockers: {{dependencies.blockers}} [omit if unavailable]

TARGET
Policy A: All users; canonical group/shared-device exclusions; All resources; Browser; 12-hour periodic sign-in frequency; Never persistent; no grant. Policy B: same population/resources; All client apps; exclude compliant devices with `device.isCompliant -eq True`; 9-hour frequency; Never persistent; no grant.

RULES
Use stable tenant policy IDs for updates. Unknown evidence remains Unknown. Do not collapse the two policies. Do not add new conditions or exclusions. Return conclusions, checks, assumptions, evidence, and the smallest safe next action.
@@IAMAI-END
@@IAMAI-BEGIN {"id":"ai.observe","channel":"aiInfo","states":["reportOnly"],"format":"markdown","kind":"template"}
**Contains tenant context. Review before sharing with an external AI service.**

ROLE
Help implement the IAMAI step **Limit How Long Sessions Last**. Review the canonical two-policy set in Report-only without inventing successful observation.

AUTHORITY
The retained IAMAI baseline and package own the destination. Current Microsoft documentation owns current product/API behavior. Do not redesign the two-policy set or infer tenant facts.

TENANT CONTEXT
- Tenant: {{tenant.displayName}} [omit if unavailable]
- Affected people: {{people.affected.count}} [omit if unavailable]
- Existing blockers: {{dependencies.blockers}} [omit if unavailable]

TARGET
Policy A: All users; canonical group/shared-device exclusions; All resources; Browser; 12-hour periodic sign-in frequency; Never persistent; no grant. Policy B: same population/resources; All client apps; exclude compliant devices with `device.isCompliant -eq True`; 9-hour frequency; Never persistent; no grant.

RULES
Use stable tenant policy IDs for updates. Unknown evidence remains Unknown. Do not collapse the two policies. Do not add new conditions or exclusions. Return conclusions, checks, assumptions, evidence, and the smallest safe next action.
@@IAMAI-END
@@IAMAI-BEGIN {"id":"ai.enforce","channel":"aiInfo","states":["readyToEnforce"],"format":"markdown","kind":"template"}
**Contains tenant context. Review before sharing with an external AI service.**

ROLE
Help implement the IAMAI step **Limit How Long Sessions Last**. Enable both canonical components only after readiness is satisfied.

AUTHORITY
The retained IAMAI baseline and package own the destination. Current Microsoft documentation owns current product/API behavior. Do not redesign the two-policy set or infer tenant facts.

TENANT CONTEXT
- Tenant: {{tenant.displayName}} [omit if unavailable]
- Affected people: {{people.affected.count}} [omit if unavailable]
- Existing blockers: {{dependencies.blockers}} [omit if unavailable]

TARGET
Policy A: All users; canonical group/shared-device exclusions; All resources; Browser; 12-hour periodic sign-in frequency; Never persistent; no grant. Policy B: same population/resources; All client apps; exclude compliant devices with `device.isCompliant -eq True`; 9-hour frequency; Never persistent; no grant.

RULES
Use stable tenant policy IDs for updates. Unknown evidence remains Unknown. Do not collapse the two policies. Do not add new conditions or exclusions. Return conclusions, checks, assumptions, evidence, and the smallest safe next action.
@@IAMAI-END
@@IAMAI-BEGIN {"id":"email.users.pre-enforcement","channel":"email","states":["readyToEnforce"],"format":"markdown","kind":"template","audience":"all-users-and-unmanaged-device-users","trigger":"before-enforcement","purpose":"pre-change-notice","recommendation":"recommended"}
Subject: Sign-in sessions will refresh more often

Hi everyone,

We're updating sign-in session settings for {{tenant.displayName}}. Browser sessions will no longer stay permanently signed in, and you may be asked to sign in again about once during a working day. On devices that aren't managed/compliant, reauthentication can occur more frequently.

If you use a shared room, panel, or shared-device account, IT has separately checked those accounts before this change. If you see repeated prompts that prevent normal work, contact the help desk and include the app and device you were using.

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
      "label": "Two-policy set",
      "gate": "Both component policies resolve to canonical tenant objects or approved create operations.",
      "results": [
        "Ready",
        "Review required",
        "Unknown",
        "Blocked"
      ],
      "why": "IAMAI compares each component independently; one matching policy does not substitute for the other."
    },
    {
      "id": "shared-devices",
      "label": "Shared devices",
      "gate": "The complete shared-device account exclusion set is resolved.",
      "results": [
        "Ready",
        "Review required",
        "Unknown",
        "Blocked"
      ],
      "why": "Session-frequency controls can repeatedly sign out unattended/shared devices if they are accidentally included."
    },
    {
      "id": "unmanaged-boundary",
      "label": "Unmanaged-device boundary",
      "gate": "The compliance filter and available device evidence support the intended unmanaged-device scope.",
      "results": [
        "Ready",
        "Review required",
        "Unknown",
        "Blocked"
      ],
      "why": "The 9-hour companion must not be treated as an all-device policy."
    },
    {
      "id": "enforcement",
      "label": "Safe to enforce",
      "gate": "Both policies are canonical, Report-only, and controlled validation shows no unresolved blocker.",
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
      "symptom": "Users are prompted more often than the configured 12/9-hour values suggest.",
      "check": [
        "Review all applicable Conditional Access session policies; another more restrictive sign-in-frequency policy can affect the session."
      ],
      "fix": [
        "Correct the unintended overlapping policy rather than weakening this pair without evidence."
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
        "Confirm its account is in IAMAI\u2019s resolved shared-device exclusions on both policies."
      ],
      "fix": [
        "Correct the same policies to the approved exclusion set, then retest."
      ],
      "doNot": [
        "Do not broadly exclude ordinary users or disable all session controls."
      ],
      "then": "Return both policies to Report-only if service remains disrupted.",
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
      "symptom": "The 9-hour companion appears to affect compliant devices or misses unmanaged devices.",
      "check": [
        "Verify deviceFilter mode exclude and exact rule `device.isCompliant -eq True`."
      ],
      "fix": [
        "Correct the unmanaged component conditions by stable ID."
      ],
      "doNot": [
        "Do not replace the filter with a guessed device list."
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

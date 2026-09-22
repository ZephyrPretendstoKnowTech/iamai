# IAMAI content blocks — Require MFA at Every Role Activation

Do not parse headings for execution. Select blocks only by `META.json` block IDs.

@@IAMAI-BEGIN {"id":"entra.context.prepare","channel":"entra","states":["contextMissing","missing"],"format":"markdown","kind":"template"}
Entra admin center → Entra ID → Conditional Access → Authentication context. Create or update the IAMAI-resolved context ID/name `{{authContext.target.id}}` / `{{authContext.target.displayName}}`, set description to `Fresh strong authentication for privileged role activation.`, and publish it. Do not choose a different context ID merely because it is free.
@@IAMAI-END
@@IAMAI-BEGIN {"id":"entra.policy.create","channel":"entra","states":["missing"],"format":"markdown","kind":"template"}
Create this policy in Report-only. It will not enforce its access rule until you enable it. PIM role settings are not changed in this step.

Entra admin center → Entra ID → Conditional Access → Policies → New policy.
1. Name: `{{policy.target.displayName}}`.
2. Users: Include All users; exclude the resolved exclusion groups. Never scope this policy to directory roles: at activation the person does not hold the role yet, so a role-scoped policy would not apply.
3. Target resources → Authentication context: `{{authContext.target.displayName}}` (`{{authContext.target.id}}`).
4. Conditions: no additional risk, location, platform, device, or authentication-flow condition.
5. Grant: Grant access → Require authentication strength → IAMAI-resolved target strength.
6. Session → Sign-in frequency → **Every time**.
7. Enable policy: **Report-only**. Do not choose **On** here: a policy created On applies to everyone it covers from the moment you save, before anyone has seen who it would have stopped — the failure this plan exists to prevent. The script for this step can only create in Report-only.
Save, read back, and rescan IAMAI. Do not configure PIM role settings yet.
@@IAMAI-END
@@IAMAI-BEGIN {"id":"entra.correct.open","channel":"entra","states":["partial"],"format":"markdown","kind":"template"}
This change removes {{policy.current.removedExclusions}} from the policy's exclusions. If the policy is On, it applies to them as soon as you save. [omit this line when unavailable]

Open the authentication context or Conditional Access policy IAMAI identified for this difference. For a policy correction, confirm the policy ID before saving and keep its current state.
@@IAMAI-END
@@IAMAI-BEGIN {"id":"entra.correct.context","channel":"entra","states":["partial"],"format":"markdown","kind":"template"}
Set the resolved authentication context to the intended name/description and Published/available state. Keep its context ID unchanged.
@@IAMAI-END
@@IAMAI-BEGIN {"id":"entra.correct.policy.users","channel":"entra","states":["partial"],"format":"markdown","kind":"template"}
Set Users to All users with only the resolved exclusion groups. Do not scope this activation policy to directory roles as a substitute for the authentication context.
@@IAMAI-END
@@IAMAI-BEGIN {"id":"entra.correct.policy.context","channel":"entra","states":["partial"],"format":"markdown","kind":"template"}
Set Target resources to the single IAMAI-resolved authentication context `{{authContext.target.displayName}}` (`{{authContext.target.id}}`). Remove any other application, user-action or authentication-context target.
@@IAMAI-END
@@IAMAI-BEGIN {"id":"entra.correct.policy.strength","channel":"entra","states":["partial"],"format":"markdown","kind":"template"}
Under Grant, require the IAMAI-resolved baseline authentication strength. Do not substitute generic MFA and do not combine built-in MFA with the authentication-strength grant.
@@IAMAI-END
@@IAMAI-BEGIN {"id":"entra.correct.policy.session","channel":"entra","states":["partial"],"format":"markdown","kind":"template"}
Under Session, enable Sign-in frequency = **Every time** using primary and secondary authentication. Remove any other session control.
@@IAMAI-END
@@IAMAI-BEGIN {"id":"entra.correct.policy.remove-noncanonical","channel":"entra","states":["partial"],"format":"markdown","kind":"template"}
Remove the risk, location, platform, device, authentication-flow, application, user-action, or other conditions IAMAI identified as differences. Keep the dedicated authentication-context target.
@@IAMAI-END
@@IAMAI-BEGIN {"id":"entra.correct.policy.report-only","channel":"entra","states":["partial"],"format":"markdown","kind":"template"}
Set the CA policy to Report-only while material corrections are being validated. Do not point PIM at this context in this state.
@@IAMAI-END
@@IAMAI-BEGIN {"id":"entra.correct.save-verify","channel":"entra","states":["partial"],"format":"markdown","kind":"template"}
Save only the selected correction(s), read back the same policy ID, and rescan IAMAI. Leave PIM role settings unchanged until the policy matches the intended settings and is On.

Keep the policy's current state. If it is On, the changed rule can affect access after you save.

@@IAMAI-END
@@IAMAI-BEGIN {"id":"entra.observe","channel":"entra","states":["reportOnly"],"format":"markdown","kind":"template"}
Keep the policy in Report-only while you review the evidence listed for this step: its authentication context target, authentication strength, exclusions, and Every time session control. Use Conditional Access What If where useful. Do not configure the PIM role authentication-context rule yet: Microsoft's current guidance says the backup MFA mechanism is not triggered when the matching Conditional Access policy is Report-only.
@@IAMAI-END
@@IAMAI-BEGIN {"id":"entra.enable-ca","channel":"entra","states":["readyToEnforce"],"format":"markdown","kind":"template"}
Verify the same policy and its prerequisites, set it to On, then complete the checks below and rescan.

Open the dedicated policy by its policy ID. Confirm the authentication context is published, the authentication strength and exclusions are resolved, and no readiness blocker remains.

Do not turn it on unless all of these are true now:

- The required report-only period is complete, with no failures on this policy in the sign-in records.
- The policy is still Report-only and its settings still match the intended target, exclusions included — the script for this step refuses to enforce a policy that is not.
- Emergency access is prepared and tested.

If any one of them is not true, leave the policy in Report-only. Change the policy from Report-only to **On**.

Verify after the change: the policy reads back On. Update PIM role settings only after this check succeeds. The policy applies only when a sign-in requests this authentication context, such as a PIM activation configured to require it.
@@IAMAI-END
@@IAMAI-BEGIN {"id":"entra.pim.configure","channel":"entra","states":["pimSettingsPending"],"format":"markdown","kind":"template"}
With the matching Conditional Access policy verified **On**: Entra admin center → ID Governance → Privileged Identity Management → Microsoft Entra roles → Roles. For each IAMAI-selected role, open **Role settings** → **Edit** and enable **On activation, require Microsoft Entra Conditional Access authentication context**, selecting `{{authContext.target.displayName}}`, then **Update**. Change no unrelated approval, duration, justification, notification, or other activation settings. This requirement applies when the role is activated; it does not control how the role is used after activation.
@@IAMAI-END
@@IAMAI-BEGIN {"id":"entra.verify-activation","channel":"entra","states":["verificationPending"],"format":"markdown","kind":"template"}
Verify after the change: use a controlled eligible admin or test account to activate one selected role. Confirm activation invokes the expected Conditional Access requirement, then confirm the role activated. Microsoft can reuse a recent reauthentication for another activation within its documented 10-minute window, so a second activation soon afterward may not prompt again. Rescan IAMAI.
@@IAMAI-END
@@IAMAI-BEGIN {"id":"json.context.upsert","channel":"json","states":["contextMissing","partial"],"format":"json-template","kind":"deployableAfterBinding","method":"PATCH","endpoint":"https://graph.microsoft.com/v1.0/identity/conditionalAccess/authenticationContextClassReferences/{authContext.target.id}"}
{"displayName":"{{authContext.target.displayName}}","description":"Fresh strong authentication for privileged role activation.","isAvailable":true}
@@IAMAI-END
@@IAMAI-BEGIN {"id":"json.policy.create","channel":"json","states":["missing"],"format":"json-template","kind":"deployableAfterBinding","method":"POST","endpoint":"https://graph.microsoft.com/v1.0/identity/conditionalAccess/policies"}
{"displayName":"{{policy.target.displayName}}","state":"enabledForReportingButNotEnforced","conditions":{"users":{"includeUsers":["All"],"excludeUsers":[],"includeGroups":[],"excludeGroups":{{json:policy.target.excludeGroups}},"includeRoles":[],"excludeRoles":[]},"applications":{"includeApplications":[],"excludeApplications":[],"includeUserActions":[],"includeAuthenticationContextClassReferences":["{{authContext.target.id}}"],"applicationFilter":null},"clientAppTypes":["all"],"signInRiskLevels":[],"userRiskLevels":[],"servicePrincipalRiskLevels":[],"locations":null,"platforms":null,"devices":null,"authenticationFlows":null,"insiderRiskLevels":null},"grantControls":{"operator":"OR","builtInControls":[],"customAuthenticationFactors":[],"termsOfUse":[],"authenticationStrength":{"id":"{{authStrength.target.id}}"}},"sessionControls":{"signInFrequency":{"isEnabled":true,"frequencyInterval":"everyTime","authenticationType":"primaryAndSecondaryAuthentication","type":null,"value":null},"persistentBrowser":null,"applicationEnforcedRestrictions":null,"cloudAppSecurity":null,"disableResilienceDefaults":null}}
@@IAMAI-END
@@IAMAI-BEGIN {"id":"json.policy.conditions","channel":"json","states":["partial"],"format":"json-template","kind":"deployableAfterBinding","method":"PATCH","endpoint":"https://graph.microsoft.com/v1.0/identity/conditionalAccess/policies/{policy.current.id}"}
{"conditions":{"users":{"includeUsers":["All"],"excludeUsers":[],"includeGroups":[],"excludeGroups":{{json:policy.target.excludeGroups}},"includeRoles":[],"excludeRoles":[]},"applications":{"includeApplications":[],"excludeApplications":[],"includeUserActions":[],"includeAuthenticationContextClassReferences":["{{authContext.target.id}}"],"applicationFilter":null},"clientAppTypes":["all"],"signInRiskLevels":[],"userRiskLevels":[],"servicePrincipalRiskLevels":[],"locations":null,"platforms":null,"devices":null,"authenticationFlows":null,"insiderRiskLevels":null}}
@@IAMAI-END
@@IAMAI-BEGIN {"id":"json.policy.grant","channel":"json","states":["partial"],"format":"json-template","kind":"deployableAfterBinding","method":"PATCH","endpoint":"https://graph.microsoft.com/v1.0/identity/conditionalAccess/policies/{policy.current.id}"}
{"grantControls":{"operator":"OR","builtInControls":[],"customAuthenticationFactors":[],"termsOfUse":[],"authenticationStrength":{"id":"{{authStrength.target.id}}"}}}
@@IAMAI-END
@@IAMAI-BEGIN {"id":"json.policy.session","channel":"json","states":["partial"],"format":"json","kind":"deployableAfterBinding","method":"PATCH","endpoint":"https://graph.microsoft.com/v1.0/identity/conditionalAccess/policies/{policy.current.id}"}
{"sessionControls":{"signInFrequency":{"isEnabled":true,"frequencyInterval":"everyTime","authenticationType":"primaryAndSecondaryAuthentication","type":null,"value":null},"persistentBrowser":null,"applicationEnforcedRestrictions":null,"cloudAppSecurity":null,"disableResilienceDefaults":null}}
@@IAMAI-END
@@IAMAI-BEGIN {"id":"json.policy.report-only","channel":"json","states":["partial"],"format":"json","kind":"deployableAfterBinding","method":"PATCH","endpoint":"https://graph.microsoft.com/v1.0/identity/conditionalAccess/policies/{policy.current.id}"}
{"state":"enabledForReportingButNotEnforced"}
@@IAMAI-END
@@IAMAI-BEGIN {"id":"json.policy.enforce","channel":"json","states":["readyToEnforce"],"format":"json","kind":"deployableAfterBinding","method":"PATCH","endpoint":"https://graph.microsoft.com/v1.0/identity/conditionalAccess/policies/{policy.current.id}"}
{"state":"enabled"}
@@IAMAI-END
@@IAMAI-BEGIN {"id":"json.pim.auth-context-rule","channel":"json","states":["pimSettingsPending"],"format":"json-template","kind":"deployableAfterBinding","method":"PATCH","endpoint":"https://graph.microsoft.com/v1.0/policies/roleManagementPolicies/{roleManagementPolicyId}/rules/AuthenticationContext_EndUser_Assignment","repeatForBinding":"pim.roleManagementPolicyIds"}
{"@odata.type":"#microsoft.graph.unifiedRoleManagementPolicyAuthenticationContextRule","id":"AuthenticationContext_EndUser_Assignment","isEnabled":true,"claimValue":"{{authContext.target.id}}"}
@@IAMAI-END
@@IAMAI-BEGIN {"id":"powershell.run","channel":"powershell","states":["contextMissing","missing","partial","reportOnly","readyToEnforce","pimSettingsPending","verificationPending"],"format":"powershell","kind":"deployableAfterBinding","invocation":{"modeParameter":"Mode","parameters":{"AuthenticationContextId":{"binding":"authContext.target.id","modes":["PrepareContext","Create","CorrectConditions","CorrectGrant","Verify","ConfigurePIM","VerifyPIM"]},"AuthenticationContextDisplayName":{"binding":"authContext.target.displayName","modes":["PrepareContext","Verify","ConfigurePIM"]},"AuthenticationStrengthId":{"binding":"authStrength.target.id","modes":["Create","CorrectConditions","CorrectGrant","Verify","ConfigurePIM"]},"ExcludeGroupIds":{"binding":"policy.target.excludeGroups","modes":["Create","CorrectConditions","CorrectGrant","Verify","ConfigurePIM"]},"PolicyDisplayName":{"binding":"policy.target.displayName","modes":["Create"]},"PolicyId":{"binding":"policy.current.id","modes":["CorrectConditions","CorrectGrant","CorrectSession","ReportOnly","Verify","ConfigurePIM"]},"RoleManagementPolicyIds":{"binding":"pim.roleManagementPolicyIds","modes":["ConfigurePIM","VerifyPIM"]}},"withheldModes":{"EnforceCA":"the script enforces only with -ReadinessApproved, an attestation this package declares no prerequisite for, so IAMAI cannot pass it"}}}
# This change removes {{policy.current.removedExclusions}} from the policy's exclusions. If the policy is On, it applies to them as soon as the correction is saved. [omit this line when unavailable]
# IAMAI compact implementation script — Require MFA at Every Role Activation
# Module: Microsoft.Graph.Authentication
[CmdletBinding()]
param(
  [Parameter(Mandatory)]
  [ValidateSet('PrepareContext','Create','CorrectConditions','CorrectGrant','CorrectSession','ReportOnly','Verify','EnforceCA','ConfigurePIM','VerifyPIM')]
  [string] $Mode,
  [ValidatePattern('^c[1-9][0-9]?$')]
  [string] $AuthenticationContextId,
  [string] $AuthenticationContextDisplayName,
  [ValidatePattern('^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$')]
  [string] $AuthenticationStrengthId,
  [string] $PolicyDisplayName,
  [ValidatePattern('^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$')]
  [string] $PolicyId,
  [string[]] $ExcludeGroupIds = @(),
  [string[]] $RoleManagementPolicyIds = @(),
  [switch] $ReadinessApproved
)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$CaBase = 'https://graph.microsoft.com/v1.0/identity/conditionalAccess/policies'
$ContextBase = 'https://graph.microsoft.com/v1.0/identity/conditionalAccess/authenticationContextClassReferences'
$Guid = '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
$RuleId = 'AuthenticationContext_EndUser_Assignment'
$ContextDescription = 'Fresh strong authentication for privileged role activation.'

function Connect-Scopes([string[]] $Scopes) {
  Import-Module Microsoft.Graph.Authentication -ErrorAction Stop
  $ctx=Get-MgContext
  $missing = if ($ctx) { @($Scopes | Where-Object { $_ -notin @($ctx.Scopes) }) } else { $Scopes }
  if (-not $ctx -or $missing.Count -gt 0) { Connect-MgGraph -Scopes $Scopes -NoWelcome }
}
function Assert-Inputs {
  if ($AuthenticationContextId -notmatch '^c[1-9][0-9]?$') { throw 'IAMAI-resolved authentication-context ID is required.' }
  if ($AuthenticationStrengthId -notmatch $Guid) { throw 'IAMAI-resolved authentication-strength ID is required.' }
  if ($ExcludeGroupIds.Count -lt 1) { throw 'IAMAI must provide the complete canonical exclusion-group set.' }
  if (@($ExcludeGroupIds | Where-Object { $_ -notmatch $Guid }).Count -gt 0) { throw 'Invalid exclusion group ID.' }
}
function Same-Set($A,$B) { return ((@($A | Sort-Object) -join '|') -eq (@($B | Sort-Object) -join '|')) }
function New-ContextBody {
  if ([string]::IsNullOrWhiteSpace($AuthenticationContextDisplayName)) { throw 'Authentication-context display name is required.' }
  return @{displayName=$AuthenticationContextDisplayName;description=$ContextDescription;isAvailable=$true}
}
function New-Conditions {
  Assert-Inputs
  return @{users=@{includeUsers=@('All');excludeUsers=@();includeGroups=@();excludeGroups=@($ExcludeGroupIds);includeRoles=@();excludeRoles=@()};applications=@{includeApplications=@();excludeApplications=@();includeUserActions=@();includeAuthenticationContextClassReferences=@($AuthenticationContextId);applicationFilter=$null};clientAppTypes=@('all');signInRiskLevels=@();userRiskLevels=@();servicePrincipalRiskLevels=@();locations=$null;platforms=$null;devices=$null;authenticationFlows=$null;insiderRiskLevels=$null}
}
function New-Grant { Assert-Inputs; return @{operator='OR';builtInControls=@();customAuthenticationFactors=@();termsOfUse=@();authenticationStrength=@{id=$AuthenticationStrengthId}} }
function New-Session { return @{signInFrequency=@{isEnabled=$true;frequencyInterval='everyTime';authenticationType='primaryAndSecondaryAuthentication';type=$null;value=$null};persistentBrowser=$null;applicationEnforcedRestrictions=$null;cloudAppSecurity=$null;disableResilienceDefaults=$null} }
function Get-Context {
  $c=Invoke-MgGraphRequest -Method GET -Uri "$ContextBase/$AuthenticationContextId"
  if ($c.id -ne $AuthenticationContextId) { throw 'Authentication-context stable-ID readback failed.' }
  return $c
}
function Get-Policy {
  if ($PolicyId -notmatch $Guid) { throw 'Stable IAMAI CA policy ID required.' }
  $p=Invoke-MgGraphRequest -Method GET -Uri "$CaBase/$PolicyId"
  if ($p.id -ne $PolicyId) { throw 'Stable-ID policy readback failed.' }
  return $p
}
function Patch-Policy([hashtable] $Body) {
  [void](Get-Policy)
  Invoke-MgGraphRequest -Method PATCH -Uri "$CaBase/$PolicyId" -Body ($Body | ConvertTo-Json -Depth 20) -ContentType 'application/json' | Out-Null
}
function Assert-CaCanonical($p) {
  Assert-Inputs
  $errors=[System.Collections.Generic.List[string]]::new()
  if (@($p.conditions.users.includeUsers).Count -ne 1 -or @($p.conditions.users.includeUsers)[0] -ne 'All') { $errors.Add('includeUsers is not exactly All.') }
  if (-not (Same-Set @($p.conditions.users.excludeGroups) @($ExcludeGroupIds))) { $errors.Add('excludeGroups differs from IAMAI canonical target.') }
  if (@($p.conditions.users.excludeUsers).Count -ne 0 -or @($p.conditions.users.includeGroups).Count -ne 0 -or @($p.conditions.users.includeRoles).Count -ne 0 -or @($p.conditions.users.excludeRoles).Count -ne 0) { $errors.Add('A noncanonical user/group/role scope exists.') }
  $apps=$p.conditions.applications
  if (@($apps.includeAuthenticationContextClassReferences).Count -ne 1 -or @($apps.includeAuthenticationContextClassReferences)[0] -ne $AuthenticationContextId) { $errors.Add('Authentication-context target mismatch.') }
  if (@($apps.includeApplications).Count -ne 0 -or @($apps.excludeApplications).Count -ne 0 -or @($apps.includeUserActions).Count -ne 0) { $errors.Add('A noncanonical app or user-action target exists.') }
  if (@($p.conditions.clientAppTypes).Count -ne 1 -or @($p.conditions.clientAppTypes)[0] -ne 'all') { $errors.Add('clientAppTypes is not exactly all.') }
  if (@($p.conditions.signInRiskLevels).Count -ne 0 -or @($p.conditions.userRiskLevels).Count -ne 0 -or @($p.conditions.servicePrincipalRiskLevels).Count -ne 0) { $errors.Add('A noncanonical risk condition exists.') }
  foreach ($field in @('locations','platforms','devices','authenticationFlows','insiderRiskLevels')) { if ($null -ne $p.conditions.$field) { $errors.Add("Noncanonical condition exists: $field") } }
  $g=$p.grantControls
  if ($g.operator -ne 'OR' -or @($g.builtInControls).Count -ne 0 -or @($g.customAuthenticationFactors).Count -ne 0 -or @($g.termsOfUse).Count -ne 0 -or $g.authenticationStrength.id -ne $AuthenticationStrengthId) { $errors.Add('Grant controls differ from the resolved authentication-strength target.') }
  $s=$p.sessionControls.signInFrequency
  if (-not $s.isEnabled -or $s.frequencyInterval -ne 'everyTime' -or $s.authenticationType -ne 'primaryAndSecondaryAuthentication' -or $null -ne $s.type -or $null -ne $s.value) { $errors.Add('Every-time sign-in-frequency control differs from canonical target.') }
  foreach ($field in @('persistentBrowser','applicationEnforcedRestrictions','cloudAppSecurity','disableResilienceDefaults')) { if ($null -ne $p.sessionControls.$field) { $errors.Add("Noncanonical session control exists: $field") } }
  if ($errors.Count -gt 0) { $errors | ForEach-Object { Write-Error $_ }; throw 'Canonical CA verification failed.' }
}
function Assert-ContextCanonical($c) {
  if (-not $c.isAvailable) { throw 'Authentication context is not published.' }
  if ($c.displayName -ne $AuthenticationContextDisplayName) { throw 'Authentication-context display name mismatch.' }
  if ($c.description -ne $ContextDescription) { throw 'Authentication-context description mismatch.' }
}

switch ($Mode) {
  'PrepareContext' {
    Connect-Scopes @('AuthenticationContext.ReadWrite.All')
    Invoke-MgGraphRequest -Method PATCH -Uri "$ContextBase/$AuthenticationContextId" -Body ((New-ContextBody) | ConvertTo-Json) -ContentType 'application/json' | Out-Null
    Assert-ContextCanonical (Get-Context)
    Write-Host 'Authentication context prepared/published. Rescan IAMAI.'
  }
  'Create' {
    Connect-Scopes @('Policy.Read.All','Policy.ReadWrite.ConditionalAccess')
    Assert-Inputs
    if ([string]::IsNullOrWhiteSpace($PolicyDisplayName)) { throw 'PolicyDisplayName required.' }
    $escaped=$PolicyDisplayName.Replace("'","''"); $filter=[uri]::EscapeDataString("displayName eq '$escaped'")
    if (@((Invoke-MgGraphRequest -Method GET -Uri "$CaBase?`$filter=$filter").value).Count -gt 0) { throw 'Exact display-name collision. Rescan IAMAI; do not create a duplicate.' }
    $body=@{displayName=$PolicyDisplayName;state='enabledForReportingButNotEnforced';conditions=(New-Conditions);grantControls=(New-Grant);sessionControls=(New-Session)}
    $created=Invoke-MgGraphRequest -Method POST -Uri $CaBase -Body ($body | ConvertTo-Json -Depth 20) -ContentType 'application/json'
    if (-not $created.id) { throw 'Graph returned no policy ID.' }
    Write-Host "Created CA policy $($created.id) in Report-only. Do not configure PIM yet; rescan IAMAI."
  }
  'CorrectConditions' { Connect-Scopes @('Policy.Read.All','Policy.ReadWrite.ConditionalAccess'); Patch-Policy @{conditions=(New-Conditions)} }
  'CorrectGrant' { Connect-Scopes @('Policy.Read.All','Policy.ReadWrite.ConditionalAccess'); Patch-Policy @{grantControls=(New-Grant)} }
  'CorrectSession' { Connect-Scopes @('Policy.Read.All','Policy.ReadWrite.ConditionalAccess'); Patch-Policy @{sessionControls=(New-Session)} }
  'ReportOnly' { Connect-Scopes @('Policy.Read.All','Policy.ReadWrite.ConditionalAccess'); Patch-Policy @{state='enabledForReportingButNotEnforced'} }
  'Verify' {
    Connect-Scopes @('Policy.Read.All','AuthenticationContext.Read.All')
    Assert-ContextCanonical (Get-Context)
    $p=Get-Policy; Assert-CaCanonical $p
    if ($p.state -notin @('enabledForReportingButNotEnforced','enabled')) { throw 'Unexpected CA lifecycle state.' }
    Write-Host 'Context and canonical CA shape verified. PIM remains unchanged until CA is enabled.'
  }
  'EnforceCA' {
    if (-not $ReadinessApproved) { throw 'EnforceCA requires ReadinessApproved.' }
    Connect-Scopes @('Policy.Read.All','Policy.ReadWrite.ConditionalAccess','AuthenticationContext.Read.All')
    Assert-ContextCanonical (Get-Context)
    $p=Get-Policy; Assert-CaCanonical $p
    if ($p.state -ne 'enabledForReportingButNotEnforced') { throw 'CA policy must be Report-only immediately before enablement.' }
    Patch-Policy @{state='enabled'}
    $after=Get-Policy; Assert-CaCanonical $after
    if ($after.state -ne 'enabled') { throw 'CA enablement readback failed.' }
    Write-Host 'CA policy is On. Only now may PIM role settings be pointed at this context.'
  }
  'ConfigurePIM' {
    if ($RoleManagementPolicyIds.Count -lt 1) { throw 'No IAMAI-resolved role-management-policy IDs supplied.' }
    Connect-Scopes @('Policy.Read.All','AuthenticationContext.Read.All','RoleManagementPolicy.ReadWrite.Directory')
    Assert-ContextCanonical (Get-Context)
    $p=Get-Policy; Assert-CaCanonical $p
    if ($p.state -ne 'enabled') { throw 'PIM configuration is blocked until the matching CA policy is On.' }
    foreach ($rid in $RoleManagementPolicyIds) {
      if ([string]::IsNullOrWhiteSpace($rid)) { throw 'Blank role-management-policy ID.' }
      $uri="https://graph.microsoft.com/v1.0/policies/roleManagementPolicies/$rid/rules/$RuleId"
      $before=Invoke-MgGraphRequest -Method GET -Uri $uri
      Write-Host "PRECHANGE $rid enabled=$($before.isEnabled) claimValue=$($before.claimValue)"
      if ($before.isEnabled -and $before.claimValue -eq $AuthenticationContextId) { Write-Host "Already canonical: $rid"; continue }
      $body=@{'@odata.type'='#microsoft.graph.unifiedRoleManagementPolicyAuthenticationContextRule';id=$RuleId;isEnabled=$true;claimValue=$AuthenticationContextId}
      Invoke-MgGraphRequest -Method PATCH -Uri $uri -Body ($body | ConvertTo-Json) -ContentType 'application/json' | Out-Null
      $after=Invoke-MgGraphRequest -Method GET -Uri $uri
      if (-not $after.isEnabled -or $after.claimValue -ne $AuthenticationContextId) { throw "PIM rule readback failed: $rid" }
    }
    Write-Host 'PIM authentication-context rules are canonical. Preserve PRECHANGE values for rollback and perform controlled activation.'
  }
  'VerifyPIM' {
    if ($RoleManagementPolicyIds.Count -lt 1) { throw 'No role-management-policy IDs supplied.' }
    Connect-Scopes @('RoleManagementPolicy.Read.Directory')
    foreach ($rid in $RoleManagementPolicyIds) {
      $r=Invoke-MgGraphRequest -Method GET -Uri "https://graph.microsoft.com/v1.0/policies/roleManagementPolicies/$rid/rules/$RuleId"
      if (-not $r.isEnabled -or $r.claimValue -ne $AuthenticationContextId) { throw "PIM authentication-context rule mismatch: $rid" }
    }
    Write-Host 'PIM rule values verified. A controlled activation is still required for behavior evidence.'
  }
}
@@IAMAI-END
@@IAMAI-BEGIN {"id":"ai.context","channel":"aiInfo","states":["contextMissing"],"format":"markdown","kind":"template"}

STATE
The dedicated authentication context is missing or not published. This state prepares and publishes that context only; the Conditional Access policy and PIM role settings come later.

TENANT CONTEXT
- Tenant: {{tenant.displayName}} [omit if unavailable]
- Authentication context: {{authContext.target.displayName}} / {{authContext.target.id}}
- Authentication strength: {{authStrength.target.displayName}} [omit if unavailable]
- Blockers: {{dependencies.blockers}} [omit if unavailable]

SETUP ORDER
Authentication context → Conditional Access policy in Report-only → validate → policy On → only then PIM role settings → controlled activation. Microsoft says PIM's backup MFA is not triggered when the matching context policy is Report-only or disabled.

LIMITS
`Every time` still has Microsoft's documented 10-minute reauthentication window across activations, so a second activation soon afterward may not prompt again. The context applies at role activation; it does not control use of the role after activation.

NEXT STEP
Explain how to create or update and publish the context with the resolved ID and name, then rescan IAMAI.
@@IAMAI-END
@@IAMAI-BEGIN {"id":"ai.create","channel":"aiInfo","states":["missing"],"format":"markdown","kind":"template"}

STATE
This state creates the dedicated Conditional Access policy in Report-only. PIM role settings are not changed yet.

TENANT CONTEXT
- Tenant: {{tenant.displayName}} [omit if unavailable]
- Authentication context: {{authContext.target.displayName}} / {{authContext.target.id}}
- Authentication strength: {{authStrength.target.displayName}} [omit if unavailable]
- Blockers: {{dependencies.blockers}} [omit if unavailable]

SETUP ORDER
Authentication context → Conditional Access policy in Report-only → validate → policy On → only then PIM role settings → controlled activation. Microsoft says PIM's backup MFA is not triggered when the matching context policy is Report-only or disabled.

LIMITS
`Every time` still has Microsoft's documented 10-minute reauthentication window across activations, so a second activation soon afterward may not prompt again. The context applies at role activation; it does not control use of the role after activation.

NEXT STEP
Explain the create action: the authentication context target, the resolved authentication strength, the exclusions and the Every time session control.
@@IAMAI-END
@@IAMAI-BEGIN {"id":"ai.correct","channel":"aiInfo","states":["partial"],"format":"markdown","kind":"template"}

STATE
This state corrects the authentication context or the dedicated Conditional Access policy where IAMAI found differences. Correct only those differences, on the same policy ID.

TENANT CONTEXT
- Tenant: {{tenant.displayName}} [omit if unavailable]
- Authentication context: {{authContext.target.displayName}} / {{authContext.target.id}}
- Authentication strength: {{authStrength.target.displayName}} [omit if unavailable]
- Blockers: {{dependencies.blockers}} [omit if unavailable]

SETUP ORDER
Authentication context → Conditional Access policy in Report-only → validate → policy On → only then PIM role settings → controlled activation. Microsoft says PIM's backup MFA is not triggered when the matching context policy is Report-only or disabled.

LIMITS
`Every time` still has Microsoft's documented 10-minute reauthentication window across activations, so a second activation soon afterward may not prompt again. The context applies at role activation; it does not control use of the role after activation.

NEXT STEP
Explain each difference and its correction.

Keep the policy's current state. If it is On, the changed rule can affect access after you save.

This change removes {{policy.current.removedExclusions}} from the policy's exclusions. If the policy is On, it applies to them as soon as you save. [omit this line when unavailable]
@@IAMAI-END
@@IAMAI-BEGIN {"id":"ai.observe","channel":"aiInfo","states":["reportOnly"],"format":"markdown","kind":"template"}

STATE
The dedicated Conditional Access policy is in Report-only. PIM role settings must not point at the context yet.

TENANT CONTEXT
- Tenant: {{tenant.displayName}} [omit if unavailable]
- Authentication context: {{authContext.target.displayName}} / {{authContext.target.id}}
- Authentication strength: {{authStrength.target.displayName}} [omit if unavailable]
- Blockers: {{dependencies.blockers}} [omit if unavailable]

SETUP ORDER
Authentication context → Conditional Access policy in Report-only → validate → policy On → only then PIM role settings → controlled activation. Microsoft says PIM's backup MFA is not triggered when the matching context policy is Report-only or disabled.

LIMITS
`Every time` still has Microsoft's documented 10-minute reauthentication window across activations, so a second activation soon afterward may not prompt again. The context applies at role activation; it does not control use of the role after activation.

NEXT STEP
Explain which configuration checks remain before the policy is turned On.
@@IAMAI-END
@@IAMAI-BEGIN {"id":"ai.enforce-ca","channel":"aiInfo","states":["readyToEnforce"],"format":"markdown","kind":"template"}

STATE
This state turns the dedicated Conditional Access policy On. PIM role settings change only after the policy reads back On.

TENANT CONTEXT
- Tenant: {{tenant.displayName}} [omit if unavailable]
- Authentication context: {{authContext.target.displayName}} / {{authContext.target.id}}
- Authentication strength: {{authStrength.target.displayName}} [omit if unavailable]
- Blockers: {{dependencies.blockers}} [omit if unavailable]

SETUP ORDER
Authentication context → Conditional Access policy in Report-only → validate → policy On → only then PIM role settings → controlled activation. Microsoft says PIM's backup MFA is not triggered when the matching context policy is Report-only or disabled.

LIMITS
`Every time` still has Microsoft's documented 10-minute reauthentication window across activations, so a second activation soon afterward may not prompt again. The context applies at role activation; it does not control use of the role after activation.

NEXT STEP
Explain the enable step and the read-back check that must succeed before PIM is configured.
@@IAMAI-END
@@IAMAI-BEGIN {"id":"ai.configure-pim","channel":"aiInfo","states":["pimSettingsPending"],"format":"markdown","kind":"template"}

STATE
The dedicated Conditional Access policy is On. This state updates only the authentication-context rule in the selected PIM role settings; other role settings stay unchanged.

TENANT CONTEXT
- Tenant: {{tenant.displayName}} [omit if unavailable]
- Authentication context: {{authContext.target.displayName}} / {{authContext.target.id}}
- Authentication strength: {{authStrength.target.displayName}} [omit if unavailable]
- Blockers: {{dependencies.blockers}} [omit if unavailable]

SETUP ORDER
Authentication context → Conditional Access policy in Report-only → validate → policy On → only then PIM role settings → controlled activation. Microsoft says PIM's backup MFA is not triggered when the matching context policy is Report-only or disabled.

LIMITS
`Every time` still has Microsoft's documented 10-minute reauthentication window across activations, so a second activation soon afterward may not prompt again. The context applies at role activation; it does not control use of the role after activation.

NEXT STEP
Explain the PIM change and the controlled activation test that follows.
@@IAMAI-END
@@IAMAI-BEGIN {"id":"ai.verify","channel":"aiInfo","states":["verificationPending"],"format":"markdown","kind":"template"}

STATE
The selected PIM role settings require the context. This state verifies the PIM rules and a controlled role activation.

TENANT CONTEXT
- Tenant: {{tenant.displayName}} [omit if unavailable]
- Authentication context: {{authContext.target.displayName}} / {{authContext.target.id}}
- Authentication strength: {{authStrength.target.displayName}} [omit if unavailable]
- Blockers: {{dependencies.blockers}} [omit if unavailable]

SETUP ORDER
Authentication context → Conditional Access policy in Report-only → validate → policy On → only then PIM role settings → controlled activation. Microsoft says PIM's backup MFA is not triggered when the matching context policy is Report-only or disabled.

LIMITS
`Every time` still has Microsoft's documented 10-minute reauthentication window across activations, so a second activation soon afterward may not prompt again. The context applies at role activation; it does not control use of the role after activation.

NEXT STEP
Explain how to run the controlled activation and read its result. Configuration checks alone do not show the activation experience.
@@IAMAI-END
@@IAMAI-BEGIN {"id":"email.admins.pre-activation-change","channel":"email","states":["pimSettingsPending"],"format":"markdown","kind":"template","audience":"privileged-administrators","trigger":"before-pim-role-setting-activation","purpose":"pre-change-notice","recommendation":"recommended"}
Subject: Planned change: Require MFA at Every Role Activation

Admins,

We plan to require the approved authentication method when you activate an eligible admin role. You may need to authenticate again; a recent successful check may be reused for another activation.

Thanks,
IT
@@IAMAI-END
@@IAMAI-BEGIN {"id":"readiness.model","channel":"readiness","states":["contextMissing","missing","partial","reportOnly","readyToEnforce","pimSettingsPending","verificationPending","inPlace","blocked","needsDecision","sourceConflict","notLicensed"],"format":"json","kind":"referenceOnly"}
{
  "schemaVersion": "1.0",
  "stepId": "s-goal-pim-activation-reauth",
  "tiles": [
    {
      "id": "context",
      "label": "Authentication context",
      "gate": "Dedicated context ID/name are resolved and the context is published.",
      "results": [
        "Ready",
        "Review required",
        "Unknown",
        "Blocked"
      ],
      "why": "PIM and CA must reference the same stable context claim."
    },
    {
      "id": "strength",
      "label": "Authentication strength",
      "gate": "IAMAI resolved the tenant strength that matches the retained baseline and eligible admins can satisfy it.",
      "results": [
        "Ready",
        "Review required",
        "Unknown",
        "Blocked"
      ],
      "why": "A source-tenant strength ID is not portable; method readiness cannot be inferred from the source object alone."
    },
    {
      "id": "ca",
      "label": "Conditional Access",
      "gate": "The dedicated policy matches the intended settings; it is Report-only while validating and On before PIM is wired to the context.",
      "results": [
        "Ready",
        "Review required",
        "Unknown",
        "Blocked"
      ],
      "why": "Microsoft\u2019s PIM backup MFA does not apply when the matching policy is Report-only or disabled. Verify the enabled policy before attaching the context to PIM. A controlled activation test is separate from configuration checks."
    },
    {
      "id": "pim",
      "label": "PIM role settings",
      "gate": "Stable role-management-policy IDs are resolved and only their authentication-context rules are targeted.",
      "results": [
        "Ready",
        "Review required",
        "Unknown",
        "Blocked"
      ],
      "why": "Unrelated PIM approval/duration/notification rules must not change."
    },
    {
      "id": "activation",
      "label": "Activation test",
      "gate": "A controlled eligible-role activation succeeds under the context and is verified after configuration.",
      "results": [
        "Ready",
        "Review required",
        "Unknown",
        "Blocked"
      ],
      "why": "Configuration correctness does not prove activation behavior. Microsoft\u2019s 10-minute window is expected behavior."
    }
  ],
  "whyIAMAI": {
    "configurationEvidence": [
      "Authentication context, CA policy, PIM authentication-context rules"
    ],
    "behaviorEvidence": [
      "Controlled role activation and available activation/sign-in evidence"
    ],
    "unknownRule": "No observed activation is not proof of success."
  }
}
@@IAMAI-END
@@IAMAI-BEGIN {"id":"troubleshooting.model","channel":"troubleshooting","states":["contextMissing","missing","partial","reportOnly","readyToEnforce","pimSettingsPending","verificationPending","inPlace"],"format":"json","kind":"referenceOnly"}
{
  "schemaVersion": "1.0",
  "stepId": "s-goal-pim-activation-reauth",
  "scenarios": [
    {
      "id": "activation-no-context-prompt",
      "classification": "documented",
      "states": [
        "pimSettingsPending",
        "verificationPending",
        "inPlace"
      ],
      "channels": [
        "entra",
        "powershell"
      ],
      "symptom": "PIM activation does not invoke the expected authentication-context requirement.",
      "check": [
        "Confirm the PIM authentication-context rule is enabled with the correct claimValue and the matching CA policy is On, not Report-only/disabled."
      ],
      "fix": [
        "Restore the exact context claim on the affected PIM rule and ensure the dedicated CA policy is enabled/canonical."
      ],
      "doNot": [
        "Do not assume backup MFA will protect a context whose matching CA policy is Report-only or disabled."
      ],
      "then": "Perform one controlled activation.",
      "sourceIds": [
        "ms-pim-role-settings",
        "ms-pim-rule-get-v1"
      ]
    },
    {
      "id": "second-activation-no-new-prompt",
      "classification": "documented",
      "states": [
        "verificationPending",
        "inPlace"
      ],
      "channels": [
        "entra"
      ],
      "symptom": "A second eligible-role activation shortly after the first does not show another authentication prompt.",
      "check": [
        "Determine whether the second activation occurred within Microsoft\u2019s documented 10-minute reauthentication window."
      ],
      "fix": [
        "No correction if the prior authentication satisfied the context and the activation is inside the documented window."
      ],
      "doNot": [
        "Do not weaken or duplicate the CA policy to force prompt spam."
      ],
      "then": "Test outside the window only if a distinct prompt is required for verification.",
      "sourceIds": [
        "ms-pim-role-settings"
      ]
    },
    {
      "id": "role-activation-loop",
      "classification": "documented",
      "states": [
        "pimSettingsPending",
        "verificationPending",
        "inPlace"
      ],
      "channels": [
        "entra",
        "aiInfo"
      ],
      "symptom": "An eligible admin cannot satisfy the activation requirement.",
      "check": [
        "Verify the user can satisfy the resolved authentication strength and is not unexpectedly excluded/blocked by another CA policy."
      ],
      "fix": [
        "Resolve the user\u2019s approved authentication method/readiness or the conflicting policy before retrying."
      ],
      "doNot": [
        "Do not substitute generic MFA for the retained target strength without an owner/source decision."
      ],
      "then": "Retest one controlled activation.",
      "sourceIds": [
        "ms-pim-role-settings",
        "ms-ca-target-auth-context"
      ]
    },
    {
      "id": "pim-graph-403",
      "classification": "documented",
      "states": [
        "pimSettingsPending",
        "verificationPending"
      ],
      "channels": [
        "powershell",
        "json"
      ],
      "symptom": "Graph returns 403 when reading/updating the PIM role rule.",
      "check": [
        "Confirm delegated RoleManagementPolicy.ReadWrite.Directory for write and that the operator holds Privileged Role Administrator."
      ],
      "fix": [
        "Reconnect with the required permission/role through the approved admin account."
      ],
      "doNot": [
        "Do not switch to Global Administrator merely as a first troubleshooting step."
      ],
      "then": "Retry the same stable role-policy/rule endpoint.",
      "sourceIds": [
        "ms-pim-rule-update-v1",
        "ms-pim-rule-get-v1"
      ]
    },
    {
      "id": "auth-context-graph-fails",
      "classification": "documented",
      "states": [
        "contextMissing",
        "partial"
      ],
      "channels": [
        "powershell",
        "json"
      ],
      "symptom": "Authentication-context create/update fails.",
      "check": [
        "Confirm AuthenticationContext.ReadWrite.All and a supported Conditional Access/Security Administrator role; Microsoft notes a known permissions issue may require additional consent."
      ],
      "fix": [
        "Correct permissions/consent, then retry the same context ID."
      ],
      "doNot": [
        "Do not create a different context ID to evade the error."
      ],
      "then": "Read back the context and rescan IAMAI.",
      "sourceIds": [
        "ms-auth-context-update-v1"
      ]
    }
  ]
}
@@IAMAI-END

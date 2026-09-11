# IAMAI content blocks — Require MFA at Every Role Activation

Do not parse headings for execution. Select blocks only by `META.json` block IDs.

@@IAMAI-BEGIN {"id":"entra.context.prepare","channel":"entra","states":["contextMissing"],"format":"markdown","kind":"template"}
Entra admin center → Entra ID → Conditional Access → Authentication context. Create or update the IAMAI-resolved context ID/name `{{authContext.target.id}}` / `{{authContext.target.displayName}}`, set description to `Fresh strong authentication for privileged role activation.`, and publish it. Do not choose a different context ID merely because it is free.
@@IAMAI-END
@@IAMAI-BEGIN {"id":"entra.policy.create","channel":"entra","states":["missing"],"format":"markdown","kind":"template"}
Entra admin center → Entra ID → Conditional Access → Policies → New policy.
1. Name: `{{policy.target.displayName}}`.
2. Users: Include All users; exclude IAMAI's canonical exclusion groups.
3. Target resources → Authentication context: `{{authContext.target.displayName}}` (`{{authContext.target.id}}`).
4. Conditions: no additional risk, location, platform, device, or authentication-flow condition.
5. Grant: Grant access → Require authentication strength → IAMAI-resolved target strength.
6. Session → Sign-in frequency → **Every time**.
7. Enable policy: **Report-only**.
Save, read back, and rescan IAMAI. Do not configure PIM role settings yet.
@@IAMAI-END
@@IAMAI-BEGIN {"id":"entra.correct.open","channel":"entra","states":["partial"],"format":"markdown","kind":"template"}
Open the IAMAI-resolved authentication context or Conditional Access policy identified by the mismatch. For CA corrections, confirm the stable tenant policy ID before saving and keep/return it to Report-only while material mismatches remain.
@@IAMAI-END
@@IAMAI-BEGIN {"id":"entra.correct.context","channel":"entra","states":["partial"],"format":"markdown","kind":"template"}
Set the resolved authentication context to the intended name/description and Published/available state. Keep its stable context ID unchanged.
@@IAMAI-END
@@IAMAI-BEGIN {"id":"entra.correct.policy.users","channel":"entra","states":["partial"],"format":"markdown","kind":"template"}
Set CA Users to All users with only IAMAI's canonical exclusion groups. Do not scope this activation policy to directory roles as a substitute for the authentication context.
@@IAMAI-END
@@IAMAI-BEGIN {"id":"entra.correct.policy.context","channel":"entra","states":["partial"],"format":"markdown","kind":"template"}
Set Target resources to the single IAMAI-resolved authentication context `{{authContext.target.displayName}}` (`{{authContext.target.id}}`). Remove noncanonical application/user-action/authentication-context targets.
@@IAMAI-END
@@IAMAI-BEGIN {"id":"entra.correct.policy.strength","channel":"entra","states":["partial"],"format":"markdown","kind":"template"}
Under Grant, require the IAMAI-resolved baseline authentication strength. Do not substitute generic MFA and do not combine built-in MFA with the authentication-strength grant.
@@IAMAI-END
@@IAMAI-BEGIN {"id":"entra.correct.policy.session","channel":"entra","states":["partial"],"format":"markdown","kind":"template"}
Under Session, enable Sign-in frequency = **Every time** using primary and secondary authentication. Remove other noncanonical v1.0 session controls.
@@IAMAI-END
@@IAMAI-BEGIN {"id":"entra.correct.policy.remove-noncanonical","channel":"entra","states":["partial"],"format":"markdown","kind":"template"}
Remove noncanonical risk, location, platform, device, authentication-flow, application, user-action, or other security-significant conditions. Preserve the dedicated authentication-context target.
@@IAMAI-END
@@IAMAI-BEGIN {"id":"entra.correct.policy.report-only","channel":"entra","states":["partial"],"format":"markdown","kind":"template"}
Set the CA policy to Report-only while material corrections are being validated. Do not point PIM at this context in this state.
@@IAMAI-END
@@IAMAI-BEGIN {"id":"entra.correct.save-verify","channel":"entra","states":["partial"],"format":"markdown","kind":"template"}
Save only the selected correction(s), read back by stable ID, and rescan IAMAI. PIM role settings remain unchanged until the CA policy is canonical and On.
@@IAMAI-END
@@IAMAI-BEGIN {"id":"entra.observe","channel":"entra","states":["reportOnly"],"format":"markdown","kind":"template"}
Leave the CA policy in Report-only while reviewing its exact context target, strength, exclusions, and Every time session control. Use Conditional Access What If where useful. Do not configure the PIM role authentication-context rule yet: Microsoft's current guidance says the backup MFA mechanism is not triggered when the matching CA policy is Report-only.
@@IAMAI-END
@@IAMAI-BEGIN {"id":"entra.enable-ca","channel":"entra","states":["readyToEnforce"],"format":"markdown","kind":"template"}
Open the canonical dedicated CA policy by stable ID. Confirm the authentication context is published, the strength/exclusions are resolved, and no readiness blocker remains. Change the CA policy from Report-only to **On** and read it back. Do not update PIM role settings unless this verification succeeds.
@@IAMAI-END
@@IAMAI-BEGIN {"id":"entra.pim.configure","channel":"entra","states":["pimSettingsPending"],"format":"markdown","kind":"template"}
With the matching CA policy verified **On**: Entra ID → Identity governance → Privileged Identity Management → Microsoft Entra roles → Role settings. For each IAMAI-selected role, edit Activation settings and enable **On activation, require Microsoft Entra Conditional Access authentication context**, selecting `{{authContext.target.displayName}}`. Change no unrelated approval, duration, justification, notification, or other activation settings.
@@IAMAI-END
@@IAMAI-BEGIN {"id":"entra.verify-activation","channel":"entra","states":["verificationPending"],"format":"markdown","kind":"template"}
Use a controlled eligible admin/test account to activate one selected role. Confirm the authentication-context flow invokes the expected Conditional Access requirement, then verify the role activated successfully. Remember Microsoft's 10-minute reauthentication window can allow a second activation soon afterward without another prompt. Rescan IAMAI.
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
@@IAMAI-BEGIN {"id":"powershell.run","channel":"powershell","states":["contextMissing","missing","partial","reportOnly","readyToEnforce","pimSettingsPending","verificationPending"],"format":"powershell","kind":"deployableAfterBinding"}
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
**Contains tenant context. Review before sharing with an external AI service.**

ROLE
Help implement the IAMAI step **Require MFA at Every Role Activation**. Prepare/publish only the dedicated authentication context.

AUTHORITY
The retained IAMAI baseline/package owns the desired semantics. Current Microsoft documentation owns current PIM/Conditional Access behavior. Do not invent tenant objects, eligible roles, evidence, or owner decisions.

TENANT CONTEXT
- Tenant: {{tenant.displayName}} [omit if unavailable]
- Authentication context: {{authContext.target.displayName}} / {{authContext.target.id}}
- Authentication strength: {{authStrength.target.displayName}} [omit if unavailable]
- Blockers: {{dependencies.blockers}} [omit if unavailable]

SAFETY ORDER
Authentication context → CA policy Report-only → validate → CA policy On → only then PIM role settings → controlled activation. Microsoft says PIM's backup MFA is not triggered when the matching context CA policy is Report-only/disabled.

LIMIT
`Every time` still has Microsoft's documented 10-minute reauthentication window across activations. Do not claim a literal prompt for every activation.

Return conclusions, checks, assumptions, evidence, and the smallest safe next action.
@@IAMAI-END
@@IAMAI-BEGIN {"id":"ai.create","channel":"aiInfo","states":["missing"],"format":"markdown","kind":"template"}
**Contains tenant context. Review before sharing with an external AI service.**

ROLE
Help implement the IAMAI step **Require MFA at Every Role Activation**. Create the dedicated CA policy in Report-only; do not change PIM yet.

AUTHORITY
The retained IAMAI baseline/package owns the desired semantics. Current Microsoft documentation owns current PIM/Conditional Access behavior. Do not invent tenant objects, eligible roles, evidence, or owner decisions.

TENANT CONTEXT
- Tenant: {{tenant.displayName}} [omit if unavailable]
- Authentication context: {{authContext.target.displayName}} / {{authContext.target.id}}
- Authentication strength: {{authStrength.target.displayName}} [omit if unavailable]
- Blockers: {{dependencies.blockers}} [omit if unavailable]

SAFETY ORDER
Authentication context → CA policy Report-only → validate → CA policy On → only then PIM role settings → controlled activation. Microsoft says PIM's backup MFA is not triggered when the matching context CA policy is Report-only/disabled.

LIMIT
`Every time` still has Microsoft's documented 10-minute reauthentication window across activations. Do not claim a literal prompt for every activation.

Return conclusions, checks, assumptions, evidence, and the smallest safe next action.
@@IAMAI-END
@@IAMAI-BEGIN {"id":"ai.correct","channel":"aiInfo","states":["partial"],"format":"markdown","kind":"template"}
**Contains tenant context. Review before sharing with an external AI service.**

ROLE
Help implement the IAMAI step **Require MFA at Every Role Activation**. Correct only IAMAI-classified context/CA mismatches.

AUTHORITY
The retained IAMAI baseline/package owns the desired semantics. Current Microsoft documentation owns current PIM/Conditional Access behavior. Do not invent tenant objects, eligible roles, evidence, or owner decisions.

TENANT CONTEXT
- Tenant: {{tenant.displayName}} [omit if unavailable]
- Authentication context: {{authContext.target.displayName}} / {{authContext.target.id}}
- Authentication strength: {{authStrength.target.displayName}} [omit if unavailable]
- Blockers: {{dependencies.blockers}} [omit if unavailable]

SAFETY ORDER
Authentication context → CA policy Report-only → validate → CA policy On → only then PIM role settings → controlled activation. Microsoft says PIM's backup MFA is not triggered when the matching context CA policy is Report-only/disabled.

LIMIT
`Every time` still has Microsoft's documented 10-minute reauthentication window across activations. Do not claim a literal prompt for every activation.

Return conclusions, checks, assumptions, evidence, and the smallest safe next action.
@@IAMAI-END
@@IAMAI-BEGIN {"id":"ai.observe","channel":"aiInfo","states":["reportOnly"],"format":"markdown","kind":"template"}
**Contains tenant context. Review before sharing with an external AI service.**

ROLE
Help implement the IAMAI step **Require MFA at Every Role Activation**. Validate the Report-only CA/context configuration without wiring PIM to it.

AUTHORITY
The retained IAMAI baseline/package owns the desired semantics. Current Microsoft documentation owns current PIM/Conditional Access behavior. Do not invent tenant objects, eligible roles, evidence, or owner decisions.

TENANT CONTEXT
- Tenant: {{tenant.displayName}} [omit if unavailable]
- Authentication context: {{authContext.target.displayName}} / {{authContext.target.id}}
- Authentication strength: {{authStrength.target.displayName}} [omit if unavailable]
- Blockers: {{dependencies.blockers}} [omit if unavailable]

SAFETY ORDER
Authentication context → CA policy Report-only → validate → CA policy On → only then PIM role settings → controlled activation. Microsoft says PIM's backup MFA is not triggered when the matching context CA policy is Report-only/disabled.

LIMIT
`Every time` still has Microsoft's documented 10-minute reauthentication window across activations. Do not claim a literal prompt for every activation.

Return conclusions, checks, assumptions, evidence, and the smallest safe next action.
@@IAMAI-END
@@IAMAI-BEGIN {"id":"ai.enforce-ca","channel":"aiInfo","states":["readyToEnforce"],"format":"markdown","kind":"template"}
**Contains tenant context. Review before sharing with an external AI service.**

ROLE
Help implement the IAMAI step **Require MFA at Every Role Activation**. Enable the canonical CA policy first.

AUTHORITY
The retained IAMAI baseline/package owns the desired semantics. Current Microsoft documentation owns current PIM/Conditional Access behavior. Do not invent tenant objects, eligible roles, evidence, or owner decisions.

TENANT CONTEXT
- Tenant: {{tenant.displayName}} [omit if unavailable]
- Authentication context: {{authContext.target.displayName}} / {{authContext.target.id}}
- Authentication strength: {{authStrength.target.displayName}} [omit if unavailable]
- Blockers: {{dependencies.blockers}} [omit if unavailable]

SAFETY ORDER
Authentication context → CA policy Report-only → validate → CA policy On → only then PIM role settings → controlled activation. Microsoft says PIM's backup MFA is not triggered when the matching context CA policy is Report-only/disabled.

LIMIT
`Every time` still has Microsoft's documented 10-minute reauthentication window across activations. Do not claim a literal prompt for every activation.

Return conclusions, checks, assumptions, evidence, and the smallest safe next action.
@@IAMAI-END
@@IAMAI-BEGIN {"id":"ai.configure-pim","channel":"aiInfo","states":["pimSettingsPending"],"format":"markdown","kind":"template"}
**Contains tenant context. Review before sharing with an external AI service.**

ROLE
Help implement the IAMAI step **Require MFA at Every Role Activation**. With CA confirmed On, update only the selected PIM authentication-context rules.

AUTHORITY
The retained IAMAI baseline/package owns the desired semantics. Current Microsoft documentation owns current PIM/Conditional Access behavior. Do not invent tenant objects, eligible roles, evidence, or owner decisions.

TENANT CONTEXT
- Tenant: {{tenant.displayName}} [omit if unavailable]
- Authentication context: {{authContext.target.displayName}} / {{authContext.target.id}}
- Authentication strength: {{authStrength.target.displayName}} [omit if unavailable]
- Blockers: {{dependencies.blockers}} [omit if unavailable]

SAFETY ORDER
Authentication context → CA policy Report-only → validate → CA policy On → only then PIM role settings → controlled activation. Microsoft says PIM's backup MFA is not triggered when the matching context CA policy is Report-only/disabled.

LIMIT
`Every time` still has Microsoft's documented 10-minute reauthentication window across activations. Do not claim a literal prompt for every activation.

Return conclusions, checks, assumptions, evidence, and the smallest safe next action.
@@IAMAI-END
@@IAMAI-BEGIN {"id":"ai.verify","channel":"aiInfo","states":["verificationPending"],"format":"markdown","kind":"template"}
**Contains tenant context. Review before sharing with an external AI service.**

ROLE
Help implement the IAMAI step **Require MFA at Every Role Activation**. Verify PIM rules and controlled role activation behavior.

AUTHORITY
The retained IAMAI baseline/package owns the desired semantics. Current Microsoft documentation owns current PIM/Conditional Access behavior. Do not invent tenant objects, eligible roles, evidence, or owner decisions.

TENANT CONTEXT
- Tenant: {{tenant.displayName}} [omit if unavailable]
- Authentication context: {{authContext.target.displayName}} / {{authContext.target.id}}
- Authentication strength: {{authStrength.target.displayName}} [omit if unavailable]
- Blockers: {{dependencies.blockers}} [omit if unavailable]

SAFETY ORDER
Authentication context → CA policy Report-only → validate → CA policy On → only then PIM role settings → controlled activation. Microsoft says PIM's backup MFA is not triggered when the matching context CA policy is Report-only/disabled.

LIMIT
`Every time` still has Microsoft's documented 10-minute reauthentication window across activations. Do not claim a literal prompt for every activation.

Return conclusions, checks, assumptions, evidence, and the smallest safe next action.
@@IAMAI-END
@@IAMAI-BEGIN {"id":"email.admins.pre-activation-change","channel":"email","states":["pimSettingsPending"],"format":"markdown","kind":"template","audience":"privileged-administrators","trigger":"before-pim-role-setting-activation","purpose":"pre-change-notice","recommendation":"recommended"}
Subject: Admin role activation will require fresh strong authentication

Admins,

We're updating privileged-role activation in {{tenant.displayName}}. When you activate an eligible role, PIM will invoke a dedicated Conditional Access authentication context and require the approved strong authentication method for that context.

You may be asked to authenticate again even if you're already signed in. Microsoft can reuse a successful reauthentication for another eligible activation within a short window, so a second activation might not always show another prompt.

If activation cannot be completed, contact the identity/help-desk team before retrying repeatedly.

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
      "gate": "Dedicated CA policy is canonical; it is Report-only while validating and On before PIM is wired to the context.",
      "results": [
        "Ready",
        "Review required",
        "Unknown",
        "Blocked"
      ],
      "why": "Microsoft\u2019s PIM backup MFA does not apply when the matching context CA policy exists but is Report-only/disabled."
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

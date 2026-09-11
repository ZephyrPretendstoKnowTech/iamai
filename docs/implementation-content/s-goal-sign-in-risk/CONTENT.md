@@IAMAI-BEGIN {"id":"ai.decision","channel":"aiInfo","states":["needsDecision"],"format":"markdown","kind":"template"}
**Contains tenant context. Review before sharing with an external AI service.**

IAMAI has two already-defined First-enforcement options for **Challenge High-Risk Sign-ins**: `baselineStrength` and `plainMfa`. The saved owner selection is not present in the supplied authority. Do not choose one, generate mutation JSON, or recommend a default. Explain what evidence would differ between the two options and wait for the existing saved decision to be supplied to the renderer.
@@IAMAI-END
@@IAMAI-BEGIN {"id":"entra.create.baseline-strength","channel":"entra","states":["missing"],"format":"markdown","kind":"template"}
1. Entra admin center → Entra ID → Conditional Access → Policies → New policy.
2. Name: **{{policy.target.displayName}}**.
3. Users → Include All users; Exclude IAMAI canonical exclusions: **{{policy.target.excludeGroups}}**.
4. Target resources → All resources.
5. Conditions → Sign-in risk → High.
6. Grant → Grant access → Require authentication strength → **{{authStrength.target.displayName}}**.
7. Session → Sign-in frequency → Every time.
8. Enable policy → Report-only. Create, read back, and rescan IAMAI.
@@IAMAI-END
@@IAMAI-BEGIN {"id":"entra.create.plain-mfa","channel":"entra","states":["missing"],"format":"markdown","kind":"template"}
1. Entra admin center → Entra ID → Conditional Access → Policies → New policy.
2. Name: **{{policy.target.displayName}}**.
3. Users → Include All users; Exclude IAMAI canonical exclusions: **{{policy.target.excludeGroups}}**.
4. Target resources → All resources.
5. Conditions → Sign-in risk → High.
6. Grant → Grant access → Require multifactor authentication.
7. Session → Sign-in frequency → Every time.
8. Enable policy → Report-only. This is the saved initial rollout rung, not the final baseline strength. Create, read back, and rescan IAMAI.
@@IAMAI-END
@@IAMAI-BEGIN {"id":"entra.correct.open","channel":"entra","states":["partial"],"format":"markdown","kind":"template"}
Open the exact IAMAI-resolved Conditional Access policy by stable tenant ID. Do not locate an update target solely by display name.
@@IAMAI-END
@@IAMAI-BEGIN {"id":"entra.correct.users","channel":"entra","states":["partial"],"format":"markdown","kind":"template"}
Set Users to All users with exactly the IAMAI-resolved canonical exclusions. Preserve the selected grant, High-risk condition, and Every-time session if already canonical.
@@IAMAI-END
@@IAMAI-BEGIN {"id":"entra.correct.target","channel":"entra","states":["partial"],"format":"markdown","kind":"template"}
Set Target resources to All resources. Preserve the High-risk condition and selected grant if already canonical.
@@IAMAI-END
@@IAMAI-BEGIN {"id":"entra.correct.risk","channel":"entra","states":["partial"],"format":"markdown","kind":"template"}
Conditions → Sign-in risk → High only for this step. Do not add Medium here; IAMAI authors Medium risk separately.
@@IAMAI-END
@@IAMAI-BEGIN {"id":"entra.correct.conditions","channel":"entra","states":["partial"],"format":"markdown","kind":"template"}
Remove IAMAI-classified noncanonical user-risk, service-principal-risk, location, platform, device/filter, authentication-flow, or user-action conditions. Keep client apps All.
@@IAMAI-END
@@IAMAI-BEGIN {"id":"entra.correct.grant.baseline-strength","channel":"entra","states":["partial"],"format":"markdown","kind":"template"}
Grant → Require authentication strength → **{{authStrength.target.displayName}}**. Remove conflicting MFA/built-in grants from this policy. This module applies only when saved First-enforcement mode is `baselineStrength`.
@@IAMAI-END
@@IAMAI-BEGIN {"id":"entra.correct.grant.plain-mfa","channel":"entra","states":["partial"],"format":"markdown","kind":"template"}
Grant → Require multifactor authentication for the initial rollout. Remove a stronger/different grant only because the saved First-enforcement mode is `plainMfa`; do not treat this as the final baseline destination.
@@IAMAI-END
@@IAMAI-BEGIN {"id":"entra.correct.session","channel":"entra","states":["partial"],"format":"markdown","kind":"template"}
Session → Sign-in frequency → Every time. Remove noncanonical session controls detected for this step.
@@IAMAI-END
@@IAMAI-BEGIN {"id":"entra.correct.lifecycle","channel":"entra","states":["partial"],"format":"markdown","kind":"template"}
Set Enable policy to Report-only while configuration/readiness is being validated.
@@IAMAI-END
@@IAMAI-BEGIN {"id":"entra.correct.save-verify","channel":"entra","states":["partial"],"format":"markdown","kind":"template"}
Save only the selected correction modules, read back the same stable policy, and rescan IAMAI. The grant must match the saved First-enforcement mode.
@@IAMAI-END
@@IAMAI-BEGIN {"id":"entra.observe","channel":"entra","states":["reportOnly"],"format":"markdown","kind":"template"}
Leave the selected canonical policy in Report-only. Review ID Protection risky sign-ins and the affected population's ability to satisfy the selected grant. Do not infer safety from zero recent risky events. When evidence/readiness changes, rescan IAMAI.
@@IAMAI-END
@@IAMAI-BEGIN {"id":"entra.enforce.baseline-strength","channel":"entra","states":["readyToEnforce"],"format":"markdown","kind":"template"}
1. Confirm the same stable policy is canonical and Report-only.
2. Confirm affected users can satisfy **{{authStrength.target.displayName}}** using the exact allowed combinations IAMAI resolved.
3. Change Enable policy to On and save.
4. Review resulting risky-sign-in behavior when legitimate evidence exists; do not manufacture a risky event.
5. Rescan IAMAI. If impact is unsafe, return this policy to Report-only.
@@IAMAI-END
@@IAMAI-BEGIN {"id":"entra.enforce.plain-mfa","channel":"entra","states":["readyToEnforce"],"format":"markdown","kind":"template"}
1. Confirm the same stable policy is canonical and Report-only and the saved First-enforcement mode is `plainMfa`.
2. Confirm affected users are MFA-registered.
3. Change Enable policy to On and save.
4. Review resulting risky-sign-in behavior when legitimate evidence exists.
5. Rescan IAMAI. The retained baseline strength is still the later destination; do not raise it until IAMAI/owner readiness says to do so.
@@IAMAI-END
@@IAMAI-BEGIN {"id":"json.create.baseline-strength","channel":"json","states":["missing"],"format":"json-template","kind":"deployableAfterBinding","method":"POST","endpoint":"https://graph.microsoft.com/v1.0/identity/conditionalAccess/policies"}
{"displayName":{{json:policy.target.displayName}},"state":"enabledForReportingButNotEnforced","conditions":{"users":{"includeUsers":["All"],"excludeUsers":[],"includeGroups":[],"excludeGroups":{{json:policy.target.excludeGroups}},"includeRoles":[],"excludeRoles":[]},"applications":{"includeApplications":["All"],"excludeApplications":[],"includeUserActions":[],"includeAuthenticationContextClassReferences":[]},"clientAppTypes":["all"],"signInRiskLevels":["high"],"userRiskLevels":[],"servicePrincipalRiskLevels":[]},"grantControls":{"operator":"OR","builtInControls":[],"customAuthenticationFactors":[],"termsOfUse":[],"authenticationStrength":{"id":{{json:authStrength.target.id}}}},"sessionControls":{"signInFrequency":{"isEnabled":true,"frequencyInterval":"everyTime","authenticationType":"primaryAndSecondaryAuthentication"}}}
@@IAMAI-END
@@IAMAI-BEGIN {"id":"json.create.plain-mfa","channel":"json","states":["missing"],"format":"json-template","kind":"deployableAfterBinding","method":"POST","endpoint":"https://graph.microsoft.com/v1.0/identity/conditionalAccess/policies"}
{"displayName":{{json:policy.target.displayName}},"state":"enabledForReportingButNotEnforced","conditions":{"users":{"includeUsers":["All"],"excludeUsers":[],"includeGroups":[],"excludeGroups":{{json:policy.target.excludeGroups}},"includeRoles":[],"excludeRoles":[]},"applications":{"includeApplications":["All"],"excludeApplications":[],"includeUserActions":[],"includeAuthenticationContextClassReferences":[]},"clientAppTypes":["all"],"signInRiskLevels":["high"],"userRiskLevels":[],"servicePrincipalRiskLevels":[]},"grantControls":{"operator":"OR","builtInControls":["mfa"],"customAuthenticationFactors":[],"termsOfUse":[]},"sessionControls":{"signInFrequency":{"isEnabled":true,"frequencyInterval":"everyTime","authenticationType":"primaryAndSecondaryAuthentication"}}}
@@IAMAI-END
@@IAMAI-BEGIN {"id":"json.correct.conditions","channel":"json","states":["partial"],"format":"json-template","kind":"deployableAfterBinding","method":"PATCH","endpoint":"https://graph.microsoft.com/v1.0/identity/conditionalAccess/policies/{policy.current.id}"}
{"conditions":{"users":{"includeUsers":["All"],"excludeUsers":[],"includeGroups":[],"excludeGroups":{{json:policy.target.excludeGroups}},"includeRoles":[],"excludeRoles":[]},"applications":{"includeApplications":["All"],"excludeApplications":[],"includeUserActions":[],"includeAuthenticationContextClassReferences":[]},"clientAppTypes":["all"],"signInRiskLevels":["high"],"userRiskLevels":[],"servicePrincipalRiskLevels":[]}}
@@IAMAI-END
@@IAMAI-BEGIN {"id":"json.correct.grant.baseline-strength","channel":"json","states":["partial"],"format":"json-template","kind":"deployableAfterBinding","method":"PATCH","endpoint":"https://graph.microsoft.com/v1.0/identity/conditionalAccess/policies/{policy.current.id}"}
{"grantControls":{"operator":"OR","builtInControls":[],"customAuthenticationFactors":[],"termsOfUse":[],"authenticationStrength":{"id":{{json:authStrength.target.id}}}}}
@@IAMAI-END
@@IAMAI-BEGIN {"id":"json.correct.grant.plain-mfa","channel":"json","states":["partial"],"format":"json","kind":"deployableAfterBinding","method":"PATCH","endpoint":"https://graph.microsoft.com/v1.0/identity/conditionalAccess/policies/{policy.current.id}"}
{"grantControls":{"operator":"OR","builtInControls":["mfa"],"customAuthenticationFactors":[],"termsOfUse":[],"authenticationStrength":null}}
@@IAMAI-END
@@IAMAI-BEGIN {"id":"json.correct.session","channel":"json","states":["partial"],"format":"json","kind":"deployableAfterBinding","method":"PATCH","endpoint":"https://graph.microsoft.com/v1.0/identity/conditionalAccess/policies/{policy.current.id}"}
{"sessionControls":{"signInFrequency":{"isEnabled":true,"frequencyInterval":"everyTime","authenticationType":"primaryAndSecondaryAuthentication"}}}
@@IAMAI-END
@@IAMAI-BEGIN {"id":"json.correct.report-only","channel":"json","states":["partial"],"format":"json","kind":"deployableAfterBinding","method":"PATCH","endpoint":"https://graph.microsoft.com/v1.0/identity/conditionalAccess/policies/{policy.current.id}"}
{"state":"enabledForReportingButNotEnforced"}
@@IAMAI-END
@@IAMAI-BEGIN {"id":"json.enforce","channel":"json","states":["readyToEnforce"],"format":"json","kind":"deployableAfterBinding","method":"PATCH","endpoint":"https://graph.microsoft.com/v1.0/identity/conditionalAccess/policies/{policy.current.id}"}
{"state":"enabled"}
@@IAMAI-END
@@IAMAI-BEGIN {"id":"powershell.run","channel":"powershell","states":["missing","partial","reportOnly","readyToEnforce"],"format":"powershell","kind":"deployableAfterBinding"}
# IAMAI compact implementation script — Challenge High-Risk Sign-ins
[CmdletBinding()]
param(
 [Parameter(Mandatory)][ValidateSet('Create','CorrectConditions','CorrectGrant','CorrectSession','ReportOnly','Verify','Enforce')][string]$Mode,
 [Parameter(Mandatory)][ValidateSet('baselineStrength','plainMfa')][string]$FirstEnforcementMode,
 [string]$PolicyDisplayName,
 [ValidatePattern('^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$')][string]$PolicyId,
 [string[]]$ExcludeGroupIds=@(),
 [ValidatePattern('^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$')][string]$AuthenticationStrengthId,
 [switch]$ReadinessApproved
)
Set-StrictMode -Version Latest
$ErrorActionPreference='Stop'
$Base='https://graph.microsoft.com/v1.0/identity/conditionalAccess/policies'
$Guid='^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
function Connect-CA([bool]$Write){Import-Module Microsoft.Graph.Authentication -ErrorAction Stop;$s=@('Policy.Read.All');if($Write){$s+='Policy.ReadWrite.ConditionalAccess'};$c=Get-MgContext;$m=if($c){@($s|?{$_ -notin @($c.Scopes)})}else{$s};if(-not$c-or$m.Count){Connect-MgGraph -Scopes $s -NoWelcome}}
function Assert-Inputs{if(@($ExcludeGroupIds|?{$_ -notmatch $Guid}).Count){throw 'Invalid exclusion ID.'};if($FirstEnforcementMode-eq'baselineStrength' -and $AuthenticationStrengthId -notmatch $Guid){throw 'baselineStrength mode requires the IAMAI-resolved tenant authentication-strength ID.'}}
function Get-Policy{if($PolicyId -notmatch $Guid){throw 'Stable IAMAI policy ID required.'};$p=Invoke-MgGraphRequest -Method GET -Uri "$Base/$PolicyId";if($p.id-ne$PolicyId){throw 'Stable-ID readback failed.'};$p}
function Same-Set([string[]]$A,[string[]]$B){(@($A|Sort-Object)-join '|') -eq (@($B|Sort-Object)-join '|')}
function Conditions{Assert-Inputs;@{users=@{includeUsers=@('All');excludeUsers=@();includeGroups=@();excludeGroups=@($ExcludeGroupIds);includeRoles=@();excludeRoles=@()};applications=@{includeApplications=@('All');excludeApplications=@();includeUserActions=@();includeAuthenticationContextClassReferences=@()};clientAppTypes=@('all');signInRiskLevels=@('high');userRiskLevels=@();servicePrincipalRiskLevels=@();locations=$null;platforms=$null;devices=$null;authenticationFlows=$null;insiderRiskLevels=$null}}
function Grant{Assert-Inputs;if($FirstEnforcementMode-eq'baselineStrength'){@{operator='OR';builtInControls=@();customAuthenticationFactors=@();termsOfUse=@();authenticationStrength=@{id=$AuthenticationStrengthId}}}else{@{operator='OR';builtInControls=@('mfa');customAuthenticationFactors=@();termsOfUse=@();authenticationStrength=$null}}}
function Session{@{signInFrequency=@{isEnabled=$true;frequencyInterval='everyTime';authenticationType='primaryAndSecondaryAuthentication'};persistentBrowser=$null;applicationEnforcedRestrictions=$null;cloudAppSecurity=$null;disableResilienceDefaults=$null}}
function Patch([hashtable]$Body){[void](Get-Policy);Invoke-MgGraphRequest -Method PATCH -Uri "$Base/$PolicyId" -Body($Body|ConvertTo-Json -Depth 20)-ContentType 'application/json'|Out-Null}
function Assert-Canonical($p){Assert-Inputs;if(@($p.conditions.users.includeUsers).Count-ne1-or$p.conditions.users.includeUsers[0]-ne'All'){throw 'includeUsers mismatch'};if(-not (Same-Set @($p.conditions.users.excludeGroups) @($ExcludeGroupIds))){throw 'excludeGroups mismatch'};if(@($p.conditions.applications.includeApplications).Count-ne1-or$p.conditions.applications.includeApplications[0]-ne'All'){throw 'All-resources target mismatch'};if(@($p.conditions.signInRiskLevels).Count-ne1-or$p.conditions.signInRiskLevels[0]-ne'high'){throw 'Sign-in risk must be High only'};$s=$p.sessionControls.signInFrequency;if(-not$s.isEnabled-or$s.frequencyInterval-ne'everyTime'-or$s.authenticationType-ne'primaryAndSecondaryAuthentication'){throw 'Every-time session mismatch'};$g=$p.grantControls;if($FirstEnforcementMode-eq'baselineStrength'){if($g.operator-ne'OR'-or@($g.builtInControls).Count-ne0-or$g.authenticationStrength.id-ne$AuthenticationStrengthId){throw 'Baseline-strength grant mismatch'}}else{if($g.operator-ne'OR'-or@($g.builtInControls).Count-ne1-or$g.builtInControls[0]-ne'mfa'-or$null-ne$g.authenticationStrength){throw 'Plain-MFA grant mismatch'}}}
switch($Mode){
 'Create'{Connect-CA $true;Assert-Inputs;if([string]::IsNullOrWhiteSpace($PolicyDisplayName)){throw 'PolicyDisplayName required.'};$e=$PolicyDisplayName.Replace("'","''");$f=[uri]::EscapeDataString("displayName eq '$e'");if(@((Invoke-MgGraphRequest -Method GET -Uri "$Base?`$filter=$f").value).Count){throw 'Exact display-name collision. Rescan IAMAI; do not create a duplicate.'};$b=@{displayName=$PolicyDisplayName;state='enabledForReportingButNotEnforced';conditions=(Conditions);grantControls=(Grant);sessionControls=(Session)};$r=Invoke-MgGraphRequest -Method POST -Uri $Base -Body($b|ConvertTo-Json -Depth 20)-ContentType 'application/json';Write-Host "Created $($r.id) in Report-only using FirstEnforcementMode=$FirstEnforcementMode. Rescan IAMAI."}
 'CorrectConditions'{Connect-CA $true;Patch @{conditions=(Conditions)}}
 'CorrectGrant'{Connect-CA $true;Patch @{grantControls=(Grant)}}
 'CorrectSession'{Connect-CA $true;Patch @{sessionControls=(Session)}}
 'ReportOnly'{Connect-CA $true;Patch @{state='enabledForReportingButNotEnforced'}}
 'Verify'{Connect-CA $false;$p=Get-Policy;Assert-Canonical $p;Write-Host "Canonical selected rollout shape verified; lifecycle=$($p.state)."}
 'Enforce'{if(-not$ReadinessApproved){throw 'Enforce requires ReadinessApproved.'};Connect-CA $true;$p=Get-Policy;Assert-Canonical $p;if($p.state-ne'enabledForReportingButNotEnforced'){throw 'Policy must be canonical and Report-only immediately before enforcement.'};Patch @{state='enabled'};$a=Get-Policy;Assert-Canonical $a;if($a.state-ne'enabled'){throw 'Enablement readback failed.'};Write-Host "High-risk sign-in policy enabled with FirstEnforcementMode=$FirstEnforcementMode. Review legitimate risk evidence and rescan IAMAI."}
}
@@IAMAI-END
@@IAMAI-BEGIN {"id":"ai.create.baseline-strength","channel":"aiInfo","states":["missing"],"format":"markdown","kind":"template"}
**Contains tenant context. Review before sharing with an external AI service.**

ROLE
Help implement IAMAI step **Challenge High-Risk Sign-ins**. Create the High-risk policy in Report-only using the saved `baselineStrength` first-enforcement mode and the exact IAMAI-resolved authentication strength.

TENANT CONTEXT
- Tenant: {{tenant.displayName}} [omit if unavailable]
- Current lifecycle: {{policy.current.state}} [omit if unavailable]
- Risk evidence: {{evidence.riskySignIns}} [omit if unavailable]
- MFA readiness: {{evidence.mfaReadiness}} [omit if unavailable]
- Baseline strength: {{authStrength.target.displayName}} [omit if unavailable]
- Push-only count: {{people.pushOnly.count}} [omit if unavailable]
- Blockers: {{dependencies.blockers}} [omit if unavailable]

CANONICAL COMMON SHAPE
All users + canonical exclusions; All resources; sign-in risk High only; client apps All; Sign-in frequency Every time; Report-only before On.

DO NOT
Do not broaden to Medium here. Do not guess the First-enforcement mode. Do not claim a risky sign-in occurred when evidence is absent.
@@IAMAI-END
@@IAMAI-BEGIN {"id":"ai.create.plain-mfa","channel":"aiInfo","states":["missing"],"format":"markdown","kind":"template"}
**Contains tenant context. Review before sharing with an external AI service.**

ROLE
Help implement IAMAI step **Challenge High-Risk Sign-ins**. Create the High-risk policy in Report-only using the saved `plainMfa` first-enforcement mode. Treat plain MFA as temporary rollout state, not the final baseline destination.

TENANT CONTEXT
- Tenant: {{tenant.displayName}} [omit if unavailable]
- Current lifecycle: {{policy.current.state}} [omit if unavailable]
- Risk evidence: {{evidence.riskySignIns}} [omit if unavailable]
- MFA readiness: {{evidence.mfaReadiness}} [omit if unavailable]
- Baseline strength: {{authStrength.target.displayName}} [omit if unavailable]
- Push-only count: {{people.pushOnly.count}} [omit if unavailable]
- Blockers: {{dependencies.blockers}} [omit if unavailable]

CANONICAL COMMON SHAPE
All users + canonical exclusions; All resources; sign-in risk High only; client apps All; Sign-in frequency Every time; Report-only before On.

DO NOT
Do not broaden to Medium here. Do not guess the First-enforcement mode. Do not claim a risky sign-in occurred when evidence is absent.
@@IAMAI-END
@@IAMAI-BEGIN {"id":"ai.correct","channel":"aiInfo","states":["partial"],"format":"markdown","kind":"template"}
**Contains tenant context. Review before sharing with an external AI service.**

ROLE
Help implement IAMAI step **Challenge High-Risk Sign-ins**. Correct only IAMAI-classified mismatches, and make the grant agree with the saved First-enforcement mode.

TENANT CONTEXT
- Tenant: {{tenant.displayName}} [omit if unavailable]
- Current lifecycle: {{policy.current.state}} [omit if unavailable]
- Risk evidence: {{evidence.riskySignIns}} [omit if unavailable]
- MFA readiness: {{evidence.mfaReadiness}} [omit if unavailable]
- Baseline strength: {{authStrength.target.displayName}} [omit if unavailable]
- Push-only count: {{people.pushOnly.count}} [omit if unavailable]
- Blockers: {{dependencies.blockers}} [omit if unavailable]

CANONICAL COMMON SHAPE
All users + canonical exclusions; All resources; sign-in risk High only; client apps All; Sign-in frequency Every time; Report-only before On.

DO NOT
Do not broaden to Medium here. Do not guess the First-enforcement mode. Do not claim a risky sign-in occurred when evidence is absent.
@@IAMAI-END
@@IAMAI-BEGIN {"id":"ai.observe","channel":"aiInfo","states":["reportOnly"],"format":"markdown","kind":"template"}
**Contains tenant context. Review before sharing with an external AI service.**

ROLE
Help implement IAMAI step **Challenge High-Risk Sign-ins**. Review the selected canonical policy and current risk/readiness evidence without inventing risk events or safety.

TENANT CONTEXT
- Tenant: {{tenant.displayName}} [omit if unavailable]
- Current lifecycle: {{policy.current.state}} [omit if unavailable]
- Risk evidence: {{evidence.riskySignIns}} [omit if unavailable]
- MFA readiness: {{evidence.mfaReadiness}} [omit if unavailable]
- Baseline strength: {{authStrength.target.displayName}} [omit if unavailable]
- Push-only count: {{people.pushOnly.count}} [omit if unavailable]
- Blockers: {{dependencies.blockers}} [omit if unavailable]

CANONICAL COMMON SHAPE
All users + canonical exclusions; All resources; sign-in risk High only; client apps All; Sign-in frequency Every time; Report-only before On.

DO NOT
Do not broaden to Medium here. Do not guess the First-enforcement mode. Do not claim a risky sign-in occurred when evidence is absent.
@@IAMAI-END
@@IAMAI-BEGIN {"id":"ai.enforce.baseline-strength","channel":"aiInfo","states":["readyToEnforce"],"format":"markdown","kind":"template"}
**Contains tenant context. Review before sharing with an external AI service.**

ROLE
Help implement IAMAI step **Challenge High-Risk Sign-ins**. Enable the canonical policy only when the exact baseline-strength method readiness is acceptable.

TENANT CONTEXT
- Tenant: {{tenant.displayName}} [omit if unavailable]
- Current lifecycle: {{policy.current.state}} [omit if unavailable]
- Risk evidence: {{evidence.riskySignIns}} [omit if unavailable]
- MFA readiness: {{evidence.mfaReadiness}} [omit if unavailable]
- Baseline strength: {{authStrength.target.displayName}} [omit if unavailable]
- Push-only count: {{people.pushOnly.count}} [omit if unavailable]
- Blockers: {{dependencies.blockers}} [omit if unavailable]

CANONICAL COMMON SHAPE
All users + canonical exclusions; All resources; sign-in risk High only; client apps All; Sign-in frequency Every time; Report-only before On.

DO NOT
Do not broaden to Medium here. Do not guess the First-enforcement mode. Do not claim a risky sign-in occurred when evidence is absent.
@@IAMAI-END
@@IAMAI-BEGIN {"id":"ai.enforce.plain-mfa","channel":"aiInfo","states":["readyToEnforce"],"format":"markdown","kind":"template"}
**Contains tenant context. Review before sharing with an external AI service.**

ROLE
Help implement IAMAI step **Challenge High-Risk Sign-ins**. Enable the canonical policy using the saved plain-MFA initial rollout mode; do not automatically raise to the baseline strength.

TENANT CONTEXT
- Tenant: {{tenant.displayName}} [omit if unavailable]
- Current lifecycle: {{policy.current.state}} [omit if unavailable]
- Risk evidence: {{evidence.riskySignIns}} [omit if unavailable]
- MFA readiness: {{evidence.mfaReadiness}} [omit if unavailable]
- Baseline strength: {{authStrength.target.displayName}} [omit if unavailable]
- Push-only count: {{people.pushOnly.count}} [omit if unavailable]
- Blockers: {{dependencies.blockers}} [omit if unavailable]

CANONICAL COMMON SHAPE
All users + canonical exclusions; All resources; sign-in risk High only; client apps All; Sign-in frequency Every time; Report-only before On.

DO NOT
Do not broaden to Medium here. Do not guess the First-enforcement mode. Do not claim a risky sign-in occurred when evidence is absent.
@@IAMAI-END
@@IAMAI-BEGIN {"id":"email.users.baseline-strength","channel":"email","states":["readyToEnforce"],"format":"markdown","kind":"template"}
Subject: Strong verification for high-risk sign-ins

Hi,

We are enabling additional protection for sign-ins Microsoft identifies as high risk. Most sign-ins are unaffected. If a sign-in is rated high risk, you will be asked to verify again using **{{authStrength.target.displayName}}** before access continues.

If you cannot complete the required verification or believe the sign-in was yours, contact IT/help desk rather than repeatedly approving prompts.

Thanks,
IT
@@IAMAI-END
@@IAMAI-BEGIN {"id":"email.users.plain-mfa","channel":"email","states":["readyToEnforce"],"format":"markdown","kind":"template"}
Subject: Extra verification for high-risk sign-ins

Hi,

We are enabling additional protection for sign-ins Microsoft identifies as high risk. Most sign-ins are unaffected. If a sign-in is rated high risk, you will be asked to complete multifactor authentication again before access continues.

If you did not initiate the sign-in, deny the request and contact IT. If you cannot complete the verification for a legitimate sign-in, contact the help desk.

Thanks,
IT
@@IAMAI-END
@@IAMAI-BEGIN {"id":"readiness.model","channel":"readiness","states":["needsDecision","missing","partial","reportOnly","readyToEnforce"],"format":"json-template","kind":"referenceOnly"}
{"tiles":[{"id":"decision","label":"First enforcement","gate":"Safe to configure","result":"{{decision.signInRisk.firstEnforcementMode}}","line":"The saved rollout choice must be known; IAMAI does not default it.","evidenceSource":"saved owner/product decision"},{"id":"license","label":"Risk licensing","gate":"Safe to configure","result":"IAMAI tenant truth","line":"Risk-based Conditional Access requires P2/qualifying ID Protection capability for in-scope users.","evidenceSource":"tenant licensing"},{"id":"method-readiness","label":"Selected grant readiness","gate":"Safe to enforce","result":"{{evidence.mfaReadiness}}","line":"Users must be able to satisfy the selected initial grant; exact strength combinations matter in baselineStrength mode.","evidenceSource":"IAMAI MFA readiness"},{"id":"risk-evidence","label":"Risk evidence","gate":"Validation context","result":"{{evidence.riskySignIns}}","line":"Recent risky sign-ins inform rollout, but zero events does not prove future safety.","evidenceSource":"ID Protection / sign-in evidence"},{"id":"exclusions","label":"Exclusions","gate":"Safe to enforce","result":"IAMAI-resolved","line":"Canonical emergency/global exclusions remain explicit and stable.","evidenceSource":"IAMAI canonical tenant truth"}],"whyIamaiSaysThis":"IAMAI keeps the saved rollout decision separate from the final baseline destination. It can verify policy shape before enforcement, but risk occurrence and successful self-remediation depend on future sign-in events and the user's actual authentication methods."}
@@IAMAI-END
@@IAMAI-BEGIN {"id":"troubleshooting.model","channel":"troubleshooting","states":["needsDecision","missing","partial","reportOnly","readyToEnforce","inPlace"],"format":"json","kind":"referenceOnly"}
{"scenarios":[{"id":"decision-missing","states":["needsDecision"],"classification":"derived","symptom":"IAMAI cannot emit create/correct/enforce artifacts because the First-enforcement choice is unavailable.","check":"Retrieve the existing saved choice: baselineStrength or plainMfa.","fix":"Supply the saved decision to the renderer; do not choose a default during implementation.","then":"Render the matching variant only.","sources":[]},{"id":"user-cannot-satisfy-strength","states":["reportOnly","readyToEnforce","inPlace"],"classification":"documented","symptom":"A legitimate high-risk sign-in cannot satisfy the required baseline authentication strength.","check":"Compare the user's registered/allowed methods with the exact allowed combinations of the resolved strength.","fix":"Complete the approved registration/recovery path or return the policy to Report-only while readiness is corrected.","doNot":"Do not silently weaken the grant unless the saved owner decision is plainMfa.","then":"Retest only after method readiness changes.","sources":["ms-auth-strength","ms-risk-policy"]},{"id":"mfa-not-registered","states":["readyToEnforce","inPlace"],"classification":"documented","symptom":"A user cannot self-remediate a risky sign-in because MFA is not registered.","check":"Confirm the affected user has a method satisfying the selected initial grant.","fix":"Register/restore an approved method before relying on self-remediation.","then":"Review the risk event again.","sources":["ms-risk-policy"]},{"id":"travel-or-vpn-risk","states":["inPlace"],"classification":"fieldObservation","symptom":"A legitimate traveler/VPN user receives high-risk verification.","check":"Inspect Risky sign-ins details, location, device, app, and detection context.","fix":"If verified legitimate, follow the approved risk-review process; do not globally weaken the policy from one event.","then":"Confirm/dismiss the risk using the organization's approved process.","sources":["ms-risk-reports"]},{"id":"wrong-risk-scope","states":["partial"],"classification":"derived","symptom":"This step also targets Medium sign-in risk.","check":"Read signInRiskLevels on the exact stable policy.","fix":"Correct this step to High only; IAMAI authors Medium risk separately.","then":"Rescan IAMAI.","sources":["ms-ca-condition-v1"]},{"id":"legacy-risk-policy","states":["missing","partial"],"classification":"documented","symptom":"Implementation is being attempted in legacy ID Protection risk policies instead of Conditional Access.","check":"Confirm the control is a Conditional Access policy.","fix":"Use Conditional Access; Microsoft retires legacy risk policies on October 1, 2026.","then":"Validate the CA policy in Report-only.","sources":["ms-risk-concept"]},{"id":"graph-403","states":["missing","partial","readyToEnforce"],"classification":"documented","symptom":"Graph/PowerShell returns 403 when creating or updating the policy.","check":"Verify Policy.Read.All + Policy.ReadWrite.ConditionalAccess and a supported Conditional Access/Security Administrator role.","fix":"Reconnect with the least required permission/role.","then":"Retry the same bounded operation.","sources":["ms-ca-create-v1"]}]}
@@IAMAI-END

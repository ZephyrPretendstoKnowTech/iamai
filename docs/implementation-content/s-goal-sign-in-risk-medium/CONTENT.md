@@IAMAI-BEGIN {"id":"entra.create","channel":"entra","states":["missing"],"format":"markdown","kind":"template"}
In Microsoft Entra admin center, go to **Entra ID > Conditional Access > Policies > New policy**.
1. Name: {{policy.target.displayName}}.
2. Users: Include **All users** and add only IAMAI-resolved canonical exclusions.
3. Target resources: **All resources**.
4. Conditions > Sign-in risk: **Medium** only.
5. Grant: **Grant access > Require multifactor authentication**.
6. Do not add session controls for this retained baseline member.
7. Enable policy: **Report-only**.
8. Create and rescan IAMAI.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"entra.correct.open","channel":"entra","states":["partial"],"format":"markdown","kind":"template"}
Open the exact existing policy identified by IAMAI stable ID {{policy.current.id}}. Do not select the update target by display name alone.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"entra.correct.users","channel":"entra","states":["partial"],"format":"markdown","kind":"template"}
Users: Include **All users** and restore only IAMAI-resolved canonical exclusions.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"entra.correct.target","channel":"entra","states":["partial"],"format":"markdown","kind":"template"}
Target resources: set **All resources** and remove noncanonical app exclusions.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"entra.correct.risk","channel":"entra","states":["partial"],"format":"markdown","kind":"template"}
Conditions > Sign-in risk: set **Medium** only. Remove High/Low from this member; High remains a separate IAMAI step.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"entra.correct.conditions","channel":"entra","states":["partial"],"format":"markdown","kind":"template"}
Remove noncanonical user-risk, location, platform, device/filter, authentication-flow, or workload-risk conditions. Keep client apps All.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"entra.correct.grant","channel":"entra","states":["partial"],"format":"markdown","kind":"template"}
Grant: **Require multifactor authentication** only, with operator OR. Do not substitute a custom authentication strength in this retained member.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"entra.correct.session","channel":"entra","states":["partial"],"format":"markdown","kind":"template"}
Session: remove session controls from this retained Medium-risk member. Do not add Every-time reauthentication unless baseline/owner authority changes.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"entra.correct.lifecycle","channel":"entra","states":["partial"],"format":"markdown","kind":"template"}
Set **Enable policy = Report-only** while correcting it unless IAMAI is explicitly projecting the later Enforce action.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"entra.correct.save-verify","channel":"entra","states":["partial"],"format":"markdown","kind":"template"}
Save the bounded correction, read the policy back by stable ID, and rescan IAMAI.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"entra.observe","channel":"entra","states":["reportOnly"],"format":"markdown","kind":"template"}
Leave the policy in Report-only. Verify the retained Medium-only/MFA/no-session shape, review Medium-risk sign-ins and MFA readiness, and confirm the separate High-risk policy has not been absorbed or duplicated.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"entra.enforce","channel":"entra","states":["readyToEnforce"],"format":"markdown","kind":"template"}
Immediately before enforcement, re-read the stable policy and confirm Medium-only risk, All resources, canonical exclusions, built-in MFA, no session controls, and acceptable readiness. Change only **Enable policy** from Report-only to **On**, read back the state, and monitor legitimate MFA failures. Roll back the same stable policy to Report-only if needed.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"json.create","channel":"json","states":["missing"],"format":"json-template","kind":"deployableAfterBinding","method":"POST","endpoint":"https://graph.microsoft.com/v1.0/identity/conditionalAccess/policies"}
{"displayName":{{json:policy.target.displayName}},"state":"enabledForReportingButNotEnforced","conditions":{"users":{"includeUsers":["All"],"excludeGroups":{{json:policy.target.excludeGroups}}},"applications":{"includeApplications":["All"],"excludeApplications":[]},"clientAppTypes":["all"],"signInRiskLevels":["medium"]},"grantControls":{"operator":"OR","builtInControls":["mfa"],"customAuthenticationFactors":[],"termsOfUse":[]},"sessionControls":null}
@@IAMAI-END

@@IAMAI-BEGIN {"id":"json.correct.conditions","channel":"json","states":["partial"],"format":"json-template","kind":"deployableAfterBinding","method":"PATCH","endpoint":"https://graph.microsoft.com/v1.0/identity/conditionalAccess/policies/{policy.current.id}"}
{"conditions":{"users":{"includeUsers":["All"],"excludeUsers":[],"includeGroups":[],"excludeGroups":{{json:policy.target.excludeGroups}},"includeRoles":[],"excludeRoles":[]},"applications":{"includeApplications":["All"],"excludeApplications":[],"includeUserActions":[],"includeAuthenticationContextClassReferences":[]},"clientAppTypes":["all"],"signInRiskLevels":["medium"],"userRiskLevels":[],"servicePrincipalRiskLevels":[],"locations":null,"platforms":null,"devices":null,"authenticationFlows":null,"insiderRiskLevels":null}}
@@IAMAI-END

@@IAMAI-BEGIN {"id":"json.correct.grant","channel":"json","states":["partial"],"format":"json","kind":"deployableAfterBinding","method":"PATCH","endpoint":"https://graph.microsoft.com/v1.0/identity/conditionalAccess/policies/{policy.current.id}"}
{"grantControls":{"operator":"OR","builtInControls":["mfa"],"customAuthenticationFactors":[],"termsOfUse":[],"authenticationStrength":null}}
@@IAMAI-END

@@IAMAI-BEGIN {"id":"json.correct.session","channel":"json","states":["partial"],"format":"json","kind":"deployableAfterBinding","method":"PATCH","endpoint":"https://graph.microsoft.com/v1.0/identity/conditionalAccess/policies/{policy.current.id}"}
{"sessionControls":null}
@@IAMAI-END

@@IAMAI-BEGIN {"id":"json.correct.report-only","channel":"json","states":["partial"],"format":"json","kind":"deployableAfterBinding","method":"PATCH","endpoint":"https://graph.microsoft.com/v1.0/identity/conditionalAccess/policies/{policy.current.id}"}
{"state":"enabledForReportingButNotEnforced"}
@@IAMAI-END

@@IAMAI-BEGIN {"id":"json.enforce","channel":"json","states":["readyToEnforce"],"format":"json","kind":"deployableAfterBinding","method":"PATCH","endpoint":"https://graph.microsoft.com/v1.0/identity/conditionalAccess/policies/{policy.current.id}"}
{"state":"enabled"}
@@IAMAI-END

@@IAMAI-BEGIN {"id":"powershell.run","channel":"powershell","states":["missing","partial","reportOnly","readyToEnforce"],"format":"powershell","kind":"deployableAfterBinding","invocation":{"modeParameter":"Mode","parameters":{"PolicyDisplayName":{"binding":"policy.target.displayName","modes":["Create"]},"PolicyId":{"binding":"policy.current.id","modes":["CorrectConditions","CorrectGrant","CorrectSession","ReportOnly","Verify"]},"ExcludeGroupIds":{"binding":"policy.target.excludeGroups","modes":["Create","CorrectConditions","Verify"]}},"withheldModes":{"Enforce":"the script enforces only with -ReadinessApproved, an attestation this package declares no prerequisite for, so IAMAI cannot pass it"}}}
# IAMAI compact implementation script — Challenge Medium-Risk Sign-ins
[CmdletBinding()]
param(
 [Parameter(Mandatory)][ValidateSet('Create','CorrectConditions','CorrectGrant','CorrectSession','ReportOnly','Verify','Enforce')][string]$Mode,
 [string]$PolicyDisplayName,
 [ValidatePattern('^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$')][string]$PolicyId,
 [string[]]$ExcludeGroupIds=@(),
 [switch]$ReadinessApproved
)
Set-StrictMode -Version Latest
$ErrorActionPreference='Stop'
$Base='https://graph.microsoft.com/v1.0/identity/conditionalAccess/policies'
$Guid='^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
function Connect-CA([bool]$Write){Import-Module Microsoft.Graph.Authentication -ErrorAction Stop;$s=@('Policy.Read.All');if($Write){$s+='Policy.ReadWrite.ConditionalAccess'};$c=Get-MgContext;$m=if($c){@($s|Where-Object{$_ -notin @($c.Scopes)})}else{$s};if((-not $c)-or$m.Count){Connect-MgGraph -Scopes $s -NoWelcome}}
function Assert-Inputs{if(@($ExcludeGroupIds|Where-Object{$_ -notmatch $Guid}).Count){throw 'Invalid exclusion ID.'}}
function Get-Policy{if($PolicyId -notmatch $Guid){throw 'Stable IAMAI policy ID required.'};$p=Invoke-MgGraphRequest -Method GET -Uri "$Base/$PolicyId";if($p.id-ne$PolicyId){throw 'Stable-ID readback failed.'};$p}
function Same-Set([string[]]$A,[string[]]$B){(@($A|Sort-Object)-join '|') -eq (@($B|Sort-Object)-join '|')}
function Conditions{Assert-Inputs;@{users=@{includeUsers=@('All');excludeUsers=@();includeGroups=@();excludeGroups=@($ExcludeGroupIds);includeRoles=@();excludeRoles=@()};applications=@{includeApplications=@('All');excludeApplications=@();includeUserActions=@();includeAuthenticationContextClassReferences=@()};clientAppTypes=@('all');signInRiskLevels=@('medium');userRiskLevels=@();servicePrincipalRiskLevels=@();locations=$null;platforms=$null;devices=$null;authenticationFlows=$null;insiderRiskLevels=$null}}
function Grant{@{operator='OR';builtInControls=@('mfa');customAuthenticationFactors=@();termsOfUse=@();authenticationStrength=$null}}
function Patch([hashtable]$Body){[void](Get-Policy);Invoke-MgGraphRequest -Method PATCH -Uri "$Base/$PolicyId" -Body($Body|ConvertTo-Json -Depth 20)-ContentType 'application/json'|Out-Null}
function Assert-Canonical($p){Assert-Inputs;if(@($p.conditions.users.includeUsers).Count-ne1-or$p.conditions.users.includeUsers[0]-ne'All'){throw 'includeUsers mismatch'};if(-not(Same-Set @($p.conditions.users.excludeGroups) @($ExcludeGroupIds))){throw 'excludeGroups mismatch'};if(@($p.conditions.applications.includeApplications).Count-ne1-or$p.conditions.applications.includeApplications[0]-ne'All'-or@($p.conditions.applications.excludeApplications).Count){throw 'All-resources target mismatch'};if(@($p.conditions.signInRiskLevels).Count-ne1-or$p.conditions.signInRiskLevels[0]-ne'medium'){throw 'Sign-in risk must be Medium only'};if(@($p.conditions.userRiskLevels).Count){throw 'User risk must be empty'};$g=$p.grantControls;if($g.operator-ne'OR'-or@($g.builtInControls).Count-ne1-or$g.builtInControls[0]-ne'mfa'-or$null-ne$g.authenticationStrength){throw 'Built-in MFA grant mismatch'};if($null-ne$p.sessionControls){$effective=@($p.sessionControls.PSObject.Properties|Where-Object{$null-ne$_.Value});if($effective.Count){throw 'Retained medium-risk member has no session controls'}}}
switch($Mode){
 'Create'{Connect-CA $true;Assert-Inputs;if([string]::IsNullOrWhiteSpace($PolicyDisplayName)){throw 'PolicyDisplayName required.'};$e=$PolicyDisplayName.Replace("'","''");$f=[uri]::EscapeDataString("displayName eq '$e'");if(@((Invoke-MgGraphRequest -Method GET -Uri "${Base}?`$filter=$f").value).Count){throw 'Exact display-name collision. Rescan IAMAI; do not create a duplicate.'};$b=@{displayName=$PolicyDisplayName;state='enabledForReportingButNotEnforced';conditions=(Conditions);grantControls=(Grant);sessionControls=$null};$r=Invoke-MgGraphRequest -Method POST -Uri $Base -Body($b|ConvertTo-Json -Depth 20)-ContentType 'application/json';Write-Host "Created $($r.id) in Report-only. Rescan IAMAI."}
 'CorrectConditions'{Connect-CA $true;Patch @{conditions=(Conditions)}}
 'CorrectGrant'{Connect-CA $true;Patch @{grantControls=(Grant)}}
 'CorrectSession'{Connect-CA $true;Patch @{sessionControls=$null}}
 'ReportOnly'{Connect-CA $true;Patch @{state='enabledForReportingButNotEnforced'}}
 'Verify'{Connect-CA $false;$p=Get-Policy;Assert-Canonical $p;Write-Host "Canonical medium-risk shape verified; lifecycle=$($p.state)."}
 'Enforce'{if(-not$ReadinessApproved){throw 'Enforce requires ReadinessApproved.'};Connect-CA $true;$p=Get-Policy;Assert-Canonical $p;if($p.state-ne'enabledForReportingButNotEnforced'){throw 'Policy must be canonical and Report-only immediately before enforcement.'};Patch @{state='enabled'};$a=Get-Policy;Assert-Canonical $a;if($a.state-ne'enabled'){throw 'Enablement readback failed.'};Write-Host 'Medium-risk sign-in policy enabled. Monitor MFA failures and rescan IAMAI.'}
}
@@IAMAI-END

@@IAMAI-BEGIN {"id":"ai.create","channel":"aiInfo","states":["missing"],"format":"markdown","kind":"template"}
**Contains tenant context. Review before sharing with an external AI service.**

Review IAMAI's proposed Medium-risk sign-in Conditional Access policy for {{tenant.displayName}}. The retained target is Medium only, All resources, built-in MFA, canonical exclusions, no session controls, and Report-only lifecycle. Check for contradiction with the separate High-risk policy; do not merge risk levels or redesign the baseline.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"ai.correct","channel":"aiInfo","states":["partial"],"format":"markdown","kind":"template"}
**Contains tenant context. Review before sharing with an external AI service.**

Review only these IAMAI-classified mismatches for the Medium-risk policy: {{policy.current.semanticMismatches}}. Preserve the stable policy identity, Medium-only threshold, built-in MFA grant, and no-session target. Do not add Every-time reauthentication merely because current Microsoft generic guidance recommends it.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"ai.observe","channel":"aiInfo","states":["reportOnly"],"format":"markdown","kind":"template"}
**Contains tenant context. Review before sharing with an external AI service.**

Assess readiness for the retained Medium-risk policy using only IAMAI-provided evidence: Medium-risk sign-ins {{evidence.mediumRiskSignIns}}, MFA readiness {{evidence.mfaReadiness}}, and High-risk policy context {{evidence.highRiskPolicy}}. Confirm the two policies complement rather than overlap. Unknown remains Unknown.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"ai.enforce","channel":"aiInfo","states":["readyToEnforce"],"format":"markdown","kind":"template"}
**Contains tenant context. Review before sharing with an external AI service.**

Perform a final pre-enforcement review for Challenge Medium-Risk Sign-ins. Confirm the exact stable policy is canonical and Report-only, risk is Medium only, grant is built-in MFA, session controls are absent, exclusions are canonical, and the High-risk policy remains separate. The only mutation should be lifecycle to On.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"email.users.pre-enforcement","channel":"email","states":["readyToEnforce"],"format":"markdown","kind":"template"}
Subject: Extra MFA prompts for unusual sign-ins

Microsoft Entra will begin requiring MFA when a sign-in is rated medium risk. Most sign-ins will not be affected. Travel, unfamiliar devices, or other unusual activity can cause an extra verification prompt. If you did not initiate the sign-in or cannot complete MFA, contact the help desk.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"readiness.model","channel":"readiness","states":["missing","partial","reportOnly","readyToEnforce"],"format":"json-template","kind":"referenceOnly"}
{"tiles":[{"id":"license","label":"Risk licensing","gate":"Safe to configure","result":"IAMAI tenant truth","line":"Medium sign-in risk requires P2/qualifying ID Protection capability.","evidenceSource":"tenant licensing"},{"id":"mfa","label":"MFA readiness","gate":"Safe to enforce","result":"{{evidence.mfaReadiness}}","line":"In-scope users need a registered MFA method to self-remediate a risky sign-in.","evidenceSource":"IAMAI authentication evidence"},{"id":"medium-evidence","label":"Medium-risk evidence","gate":"Validation context","result":"{{evidence.mediumRiskSignIns}}","line":"Recent Medium-risk events inform rollout; zero events does not prove future safety.","evidenceSource":"ID Protection / sign-in evidence"},{"id":"high-separation","label":"High-risk separation","gate":"Safe to enforce","result":"{{evidence.highRiskPolicy}}","line":"This policy must remain Medium only and complement the separate High-risk step.","evidenceSource":"IAMAI current policy evidence"},{"id":"exclusions","label":"Exclusions","gate":"Safe to enforce","result":"IAMAI-resolved","line":"Canonical emergency/global exclusions remain explicit and stable.","evidenceSource":"IAMAI canonical tenant truth"}],"whyIamaiSaysThis":"IAMAI preserves the pinned baseline's Medium-only policy instead of merging it with the High-risk rung. Current Microsoft guidance recommends Every-time reauthentication, but the retained member has no session control, so readiness does not invent one."}
@@IAMAI-END

@@IAMAI-BEGIN {"id":"troubleshooting.model","channel":"troubleshooting","states":["missing","partial","reportOnly","readyToEnforce","inPlace"],"format":"json","kind":"referenceOnly"}
{"scenarios":[{"id":"mfa-not-registered","states":["readyToEnforce","inPlace"],"classification":"documented","symptom":"A legitimate Medium-risk sign-in cannot complete MFA self-remediation.","check":"Confirm the user has a registered MFA method.","fix":"Restore/register an approved MFA method before relying on the policy.","then":"Retest only after method readiness changes.","sources":["ms-risk-policy"]},{"id":"high-medium-overlap","states":["partial","reportOnly","readyToEnforce"],"classification":"derived","symptom":"The Medium policy also contains High risk, or the High policy also contains Medium.","check":"Read signInRiskLevels on both stable policies.","fix":"Restore this member to Medium only and keep High in the separate High-risk step.","then":"Rescan IAMAI and verify both members independently.","sources":["ms-ca-condition-v1"]},{"id":"unexpected-session","states":["partial","reportOnly"],"classification":"derived","symptom":"The Medium-risk member has Sign-in frequency or another session control.","check":"Read sessionControls on the stable policy.","fix":"Remove the noncanonical session control for the retained baseline member.","doNot":"Do not preserve it solely because current Microsoft generic guidance recommends Every time.","then":"Rescan IAMAI.","sources":["ms-risk-policy"]},{"id":"travel-prompts","states":["inPlace"],"classification":"fieldObservation","symptom":"A legitimate traveler or unfamiliar-device sign-in receives an MFA prompt.","check":"Review sign-in risk details and verify whether the sign-in belongs to the user.","fix":"If legitimate, follow the approved risk-review process; do not weaken the policy globally from one event.","then":"Confirm the risk is remediated/dismissed according to the organization's process.","sources":["ms-risk-concept"]},{"id":"legacy-risk-policy","states":["missing","partial"],"classification":"documented","symptom":"Implementation is being attempted in the legacy ID Protection sign-in-risk policy.","check":"Confirm the control is a Conditional Access policy.","fix":"Use Conditional Access; legacy risk policies retire October 1, 2026.","then":"Validate the CA policy in Report-only.","sources":["ms-risk-policy"]},{"id":"graph-403","states":["missing","partial","readyToEnforce"],"classification":"documented","symptom":"Graph/PowerShell returns 403.","check":"Verify Policy.Read.All + Policy.ReadWrite.ConditionalAccess and a supported Conditional Access/Security Administrator role.","fix":"Reconnect with the least required permission/role.","then":"Retry the same bounded operation.","sources":["ms-ca-create-v1"]}]}
@@IAMAI-END

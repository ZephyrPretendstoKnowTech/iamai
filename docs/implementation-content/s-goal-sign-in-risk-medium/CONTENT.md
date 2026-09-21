@@IAMAI-BEGIN {"id":"entra.create","channel":"entra","states":["missing"],"format":"markdown","kind":"template"}
1. Go to Entra admin center → Conditional Access → Policies → New policy.
2. Name: {{policy.target.displayName}}.
3. Users → Include: All users. Exclude → Groups: add the exclusions group you confirmed in Configure Emergency Exclusions.
4. Target resources: All resources.
5. Conditions → Sign-in risk: set **Configure** to **Yes**, then check Medium only. Left at **No** the policy carries no risk condition, and its grant applies to every sign-in.
6. Conditions → Client apps: leave **Configure** at **No**. This policy is meant to reach every client app, which is what an unconfigured condition does; ticking every box writes the four named client types instead.
7. Grant → Grant access → Require multifactor authentication.
8. Session: leave empty (no session controls).
9. Enable policy: Report-only. Do not choose **On** here: a policy created On applies to everyone it covers from the moment you save, before anyone has seen who it would have stopped — the failure this plan exists to prevent. The script for this step can only create in Report-only.
10. Create. Rescan in IAMAI.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"entra.correct.open","channel":"entra","states":["partial"],"format":"markdown","kind":"template"}
This change removes {{policy.current.removedExclusions}} from the policy's exclusions. If the policy is On, it applies to them as soon as you save. [omit this line when unavailable]

Open the existing policy with ID {{policy.current.id}}. Find it by this policy ID, not by display name alone.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"entra.correct.users","channel":"entra","states":["partial"],"format":"markdown","kind":"template"}
Users: Include **All users**. Exclude only the resolved exclusion groups, and remove any other excluded users, groups or roles.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"entra.correct.target","channel":"entra","states":["partial"],"format":"markdown","kind":"template"}
Target resources: set **All resources** and remove any resource exclusions.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"entra.correct.risk","channel":"entra","states":["partial"],"format":"markdown","kind":"template"}
Conditions > Sign-in risk: set **Configure** to **Yes**, then **Medium** only, because at **No** the policy has no risk condition and its grant reaches every sign-in. Remove High and Low from this policy; High sign-in risk is covered by a separate IAMAI step.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"entra.correct.conditions","channel":"entra","states":["partial"],"format":"markdown","kind":"template"}
Remove any user risk, network or location, device platform, device filter, authentication flow, insider risk or service principal risk condition. Leave **Client apps** unconfigured: the target is every client app, and that is what an unconfigured condition reaches. Ticking every box writes the four named client types instead, which IAMAI then reads as a difference that never resolves.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"entra.correct.grant","channel":"entra","states":["partial"],"format":"markdown","kind":"template"}
Grant: **Require multifactor authentication** only. Remove any authentication strength or other grant control from this policy.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"entra.correct.session","channel":"entra","states":["partial"],"format":"markdown","kind":"template"}
Session: remove all session controls from this policy. The baseline's Medium-risk policy has no session control, so do not add Every time sign-in frequency here.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"entra.correct.lifecycle","channel":"entra","states":["partial"],"format":"markdown","kind":"template"}
Set **Enable policy = Report-only** while correcting it unless IAMAI is explicitly projecting the later Enforce action.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"entra.correct.save-verify","channel":"entra","states":["partial"],"format":"markdown","kind":"template"}
Save the correction, reopen the policy by the same policy ID to check the saved settings, and rescan in IAMAI.

Keep the policy's current state. If it is On, the changed rule can affect access after you save.

@@IAMAI-END

@@IAMAI-BEGIN {"id":"entra.observe","channel":"entra","states":["reportOnly"],"format":"markdown","kind":"template"}
Keep the policy in Report-only while you review the evidence listed for this step. Check that it still targets Medium sign-in risk only, requires built-in MFA and has no session controls. Review available Medium-risk sign-ins and whether affected users have usable MFA methods; no recent Medium-risk sign-ins does not show the policy is ready. Keep the separate High-risk policy in place, and check that neither policy also covers the other's risk level.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"entra.enforce","channel":"entra","states":["readyToEnforce"],"format":"markdown","kind":"template"}
Verify the same policy and its prerequisites: Medium sign-in risk only, All users with the intended exclusions, All resources, built-in MFA, no session controls, and reviewed MFA readiness. Do not turn it on unless all of this is true now. The required report-only period is complete, with no failures on this policy in the sign-in records. The policy is still Report-only and its settings still match the intended target, exclusions included — the script for this step refuses to enforce a policy that is not. Emergency access is prepared and tested. If any one of them is not true, leave the policy in Report-only. Change only **Enable policy** from Report-only to **On**, then reopen the policy to check the state. Verify after the change: legitimate users whose sign-in is rated Medium risk can complete MFA. If legitimate sign-ins fail, set the same policy back to Report-only while you investigate. Rescan in IAMAI.
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
# This change removes {{policy.current.removedExclusions}} from the policy's exclusions. If the policy is On, it applies to them as soon as the correction is saved. [omit this line when unavailable]
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
This state creates a policy that requires built-in MFA when Microsoft Entra ID Protection rates a sign-in Medium risk. Microsoft sets the risk level from its detections, so do not assume that a particular event, such as an unfamiliar location, always produces a Medium rating. Sign-in risk conditions require Microsoft Entra ID P2.

The policy has no session controls, and High sign-in risk is covered by a separate policy. It is created in Report-only, which records what would happen without prompting anyone. Moving to enforcement depends on reviewing the available Medium-risk sign-ins and MFA readiness, not only on time passing.

The exclusions group is excluded, so accounts in that group, such as emergency access accounts, are not subject to this policy.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"ai.correct","channel":"aiInfo","states":["partial"],"format":"markdown","kind":"template"}

Differences IAMAI found on the Medium-risk policy: {{policy.current.semanticMismatches}}. The correction updates the same policy ID toward the intended target: All users with the intended exclusions, All resources, Medium sign-in risk only, built-in MFA and no session controls. Microsoft's current general guidance recommends Every time sign-in frequency for risk policies, but this baseline's Medium-risk policy has none, so adding it would change the baseline.

Keep the policy's current state. If it is On, the changed rule can affect access after you save.

This change removes {{policy.current.removedExclusions}} from the policy's exclusions. If the policy is On, it applies to them as soon as you save. [omit this line when unavailable]
@@IAMAI-END

@@IAMAI-BEGIN {"id":"ai.observe","channel":"aiInfo","states":["reportOnly"],"format":"markdown","kind":"template"}

The Medium-risk policy is in Report-only. Medium-risk sign-ins: {{evidence.mediumRiskSignIns}}. MFA readiness: {{evidence.mfaReadiness}}. High-risk policy: {{evidence.highRiskPolicy}}. This policy should cover Medium sign-in risk only, and the separate High-risk policy High only. A registered MFA method is not proof that a person can complete MFA now, and no recent Medium-risk sign-ins does not show future readiness.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"ai.enforce","channel":"aiInfo","states":["readyToEnforce"],"format":"markdown","kind":"template"}

The Medium-risk policy is ready to enforce. Before it is set On, the same policy ID should still be Report-only with Medium sign-in risk only, All users with the intended exclusions, All resources, built-in MFA and no session controls, and the High-risk policy should remain separate. The enforcement operation changes only the policy state. After enforcement, a user who cannot complete MFA during a Medium-risk sign-in cannot complete that sign-in.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"email.users.pre-enforcement","channel":"email","states":["readyToEnforce"],"format":"markdown","kind":"template"}
Subject: Planned change: Challenge Medium-Risk Sign-ins

A sign-in rated medium risk may need MFA after this change. If you did not start the sign-in, do not approve it. Contact IT support if you cannot complete a legitimate sign-in.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"readiness.model","channel":"readiness","states":["missing","partial","reportOnly","readyToEnforce"],"format":"json-template","kind":"referenceOnly"}
{"tiles":[{"id":"license","label":"Risk licensing","gate":"Safe to configure","result":"IAMAI tenant truth","line":"Sign-in risk conditions require Microsoft Entra ID P2.","evidenceSource":"tenant licensing"},{"id":"mfa","label":"MFA readiness","gate":"Safe to enforce","result":"{{evidence.mfaReadiness}}","line":"Check usable MFA methods and review available Medium-risk sign-ins. Keep High-risk coverage separate.","evidenceSource":"IAMAI authentication evidence"},{"id":"medium-evidence","label":"Medium-risk evidence","gate":"Validation context","result":"{{evidence.mediumRiskSignIns}}","line":"Recent Medium-risk events inform rollout; zero events does not prove future safety.","evidenceSource":"ID Protection / sign-in evidence"},{"id":"high-separation","label":"High-risk separation","gate":"Safe to enforce","result":"{{evidence.highRiskPolicy}}","line":"This policy must remain Medium only and complement the separate High-risk step.","evidenceSource":"IAMAI current policy evidence"},{"id":"exclusions","label":"Exclusions","gate":"Safe to enforce","result":"IAMAI-resolved","line":"The required group is resolved. Verify that the policy references it and that its membership is still correct.","evidenceSource":"IAMAI canonical tenant truth"}],"whyIamaiSaysThis":"IAMAI keeps the baseline's Medium-only policy separate from the High-risk policy. Microsoft's current guidance recommends Every time sign-in frequency, but the baseline's Medium-risk policy has no session control, so this step does not add one."}
@@IAMAI-END

@@IAMAI-BEGIN {"id":"troubleshooting.model","channel":"troubleshooting","states":["missing","partial","reportOnly","readyToEnforce","inPlace"],"format":"json","kind":"referenceOnly"}
{"scenarios":[{"id":"mfa-not-registered","states":["readyToEnforce","inPlace"],"classification":"documented","symptom":"A legitimate Medium-risk sign-in cannot complete MFA self-remediation.","check":"Confirm the user has a registered MFA method.","fix":"Restore/register an approved MFA method before relying on the policy.","then":"Retest only after method readiness changes.","sources":["ms-risk-policy"]},{"id":"high-medium-overlap","states":["partial","reportOnly","readyToEnforce"],"classification":"derived","symptom":"The Medium policy also contains High risk, or the High policy also contains Medium.","check":"Read signInRiskLevels on both stable policies.","fix":"Restore this member to Medium only and keep High in the separate High-risk step.","then":"Rescan IAMAI and verify both members independently.","sources":["ms-ca-condition-v1"]},{"id":"unexpected-session","states":["partial","reportOnly"],"classification":"derived","symptom":"The Medium-risk member has Sign-in frequency or another session control.","check":"Read sessionControls on the stable policy.","fix":"Remove the session control; the baseline's Medium-risk policy has none.","doNot":"Do not preserve it solely because current Microsoft generic guidance recommends Every time.","then":"Rescan IAMAI.","sources":["ms-risk-policy"]},{"id":"travel-prompts","states":["inPlace"],"classification":"fieldObservation","symptom":"A legitimate traveler or unfamiliar-device sign-in receives an MFA prompt.","check":"Review sign-in risk details and verify whether the sign-in belongs to the user.","fix":"If legitimate, follow the approved risk-review process; do not weaken the policy globally from one event.","then":"Confirm the risk is remediated/dismissed according to the organization's process.","sources":["ms-risk-concept"]},{"id":"legacy-risk-policy","states":["missing","partial"],"classification":"documented","symptom":"Implementation is being attempted in the legacy ID Protection sign-in-risk policy.","check":"Confirm the control is a Conditional Access policy.","fix":"Use Conditional Access; legacy risk policies retire October 1, 2026.","then":"Validate the CA policy in Report-only.","sources":["ms-risk-policy"]},{"id":"graph-403","states":["missing","partial","readyToEnforce"],"classification":"documented","symptom":"Graph/PowerShell returns 403.","check":"Verify Policy.Read.All + Policy.ReadWrite.ConditionalAccess and a supported Conditional Access/Security Administrator role.","fix":"Reconnect with the least required permission/role.","then":"Retry the same bounded operation.","sources":["ms-ca-create-v1"]}]}
@@IAMAI-END

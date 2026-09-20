@@IAMAI-BEGIN {"id":"entra.create","channel":"entra","states":["missing"],"format":"markdown","kind":"template"}
1. Go to Entra admin center → Conditional Access → Policies → New policy.
2. Name: {{policy.target.displayName}}.
3. Users → Include: All users. Exclude → Groups: add the exclusions group.
4. Target resources: All resources.
5. Conditions → Sign-in risk: set **Configure** to **Yes**, then check High only (not Medium). Left at **No** the policy carries no risk condition, and its grant applies to every sign-in.
6. Conditions → Client apps: leave **Configure** at **No**. This policy is meant to reach every client app, which is what an unconfigured condition does; ticking every box writes the four named client types instead.
7. Grant: {{policy.target.grantWords}}. Use only the controls listed here.
8. Session → Sign-in frequency: Every time.
9. Enable policy: Report-only.
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
Conditions > Sign-in risk: set **Configure** to **Yes**, then **High** only, because at **No** the policy has no risk condition and its grant reaches every sign-in. Remove Medium and Low from this policy; Medium sign-in risk is covered by a separate IAMAI step.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"entra.correct.conditions","channel":"entra","states":["partial"],"format":"markdown","kind":"template"}
Remove any user risk, network or location, device platform, device filter, authentication flow, insider risk or service principal risk condition. Leave **Client apps** unconfigured: the target is every client app, and that is what an unconfigured condition reaches. Ticking every box writes the four named client types instead, which IAMAI then reads as a difference that never resolves.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"entra.correct.grant","channel":"entra","states":["partial"],"format":"markdown","kind":"template"}
Grant: {{policy.target.grantWords}}. Remove controls that are not listed in this resolved grant. The JSON and PowerShell apply the same saved choice.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"entra.correct.session","channel":"entra","states":["partial"],"format":"markdown","kind":"template"}
Session: set **Sign-in frequency > Every time**. Remove any other session control from this policy.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"entra.correct.lifecycle","channel":"entra","states":["partial"],"format":"markdown","kind":"template"}
Keep the policy's current state. If it is On, the changed rule can affect access after you save.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"entra.correct.save-verify","channel":"entra","states":["partial"],"format":"markdown","kind":"template"}
Save the correction, reopen the policy by the same policy ID to check the saved settings, and rescan in IAMAI.

Keep the policy's current state. If it is On, the changed rule can affect access after you save.

@@IAMAI-END

@@IAMAI-BEGIN {"id":"entra.observe","channel":"entra","states":["reportOnly"],"format":"markdown","kind":"template"}
Keep the policy in Report-only while you review the evidence listed for this step. Check that it still targets High sign-in risk only through **Configure: Yes**, uses the selected grant ({{policy.target.grantWords}}) and Every time sign-in frequency. Review available High-risk sign-ins and whether affected users can satisfy that grant; a registered MFA method does not always satisfy an authentication strength, and somebody with no accepted method registered is blocked rather than prompted, because this policy also stops them registering during a risky sign-in. Some risk is worked out after the sign-in rather than during it, so a report-only window can gain results later. No recent risk events does not prove future readiness, and do not try to create a risky sign-in to test the policy. Keep the separate Medium-risk policy unchanged.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"entra.enforce","channel":"entra","states":["readyToEnforce"],"format":"markdown","kind":"template"}
Verify the same policy and its prerequisites: High sign-in risk only, All users with the intended exclusions, All resources, the selected grant ({{policy.target.grantWords}}), Every time sign-in frequency, and reviewed method readiness. Change only **Enable policy** from Report-only to **On**, then reopen the policy to check the state. Verify after the change: review legitimate sign-ins that cannot satisfy the selected grant. If legitimate users are blocked, set the same policy back to Report-only while method readiness is fixed. Rescan in IAMAI.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"json.create","channel":"json","states":["missing"],"format":"json-template","kind":"deployableAfterBinding","method":"POST","endpoint":"https://graph.microsoft.com/v1.0/identity/conditionalAccess/policies"}
{"displayName":{{json:policy.target.displayName}},"state":"enabledForReportingButNotEnforced","conditions":{"users":{"includeUsers":["All"],"excludeGroups":{{json:policy.target.excludeGroups}}},"applications":{"includeApplications":["All"],"excludeApplications":[]},"clientAppTypes":["all"],"signInRiskLevels":["high"]},"grantControls":{{json:policy.target.grantControls}},"sessionControls":{"signInFrequency":{"isEnabled":true,"frequencyInterval":"everyTime","authenticationType":"primaryAndSecondaryAuthentication"}}}
@@IAMAI-END

@@IAMAI-BEGIN {"id":"json.correct.conditions","channel":"json","states":["partial"],"format":"json-template","kind":"deployableAfterBinding","method":"PATCH","endpoint":"https://graph.microsoft.com/v1.0/identity/conditionalAccess/policies/{policy.current.id}"}
{"conditions":{"users":{"includeUsers":["All"],"excludeUsers":[],"includeGroups":[],"excludeGroups":{{json:policy.target.excludeGroups}},"includeRoles":[],"excludeRoles":[]},"applications":{"includeApplications":["All"],"excludeApplications":[],"includeUserActions":[],"includeAuthenticationContextClassReferences":[]},"clientAppTypes":["all"],"signInRiskLevels":["high"],"userRiskLevels":[],"servicePrincipalRiskLevels":[],"locations":null,"platforms":null,"devices":null,"authenticationFlows":null,"insiderRiskLevels":null}}
@@IAMAI-END

@@IAMAI-BEGIN {"id":"json.correct.grant","channel":"json","states":["partial"],"format":"json-template","kind":"deployableAfterBinding","method":"PATCH","endpoint":"https://graph.microsoft.com/v1.0/identity/conditionalAccess/policies/{policy.current.id}"}
{"grantControls":{{json:policy.target.grantControls}}}
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

@@IAMAI-BEGIN {"id":"powershell.run","channel":"powershell","states":["missing","partial","reportOnly","readyToEnforce"],"format":"powershell","kind":"deployableAfterBinding","invocation":{"modeParameter":"Mode","parameters":{"PolicyDisplayName":{"binding":"policy.target.displayName","modes":["Create"]},"PolicyId":{"binding":"policy.current.id","modes":["CorrectConditions","CorrectGrant","CorrectSession","ReportOnly","Verify"]},"ExcludeGroupIds":{"binding":"policy.target.excludeGroups","modes":["Create","CorrectConditions","Verify"]},"GrantControlsJson":{"binding":"policy.target.grantJson","modes":["Create","CorrectGrant","Verify"]}},"withheldModes":{"Enforce":"the script enforces only with -ReadinessApproved, an attestation this package declares no prerequisite for, so IAMAI cannot pass it"}}}
# This change removes {{policy.current.removedExclusions}} from the policy's exclusions. If the policy is On, it applies to them as soon as the correction is saved. [omit this line when unavailable]
# IAMAI compact implementation script — Challenge High-Risk Sign-ins
[CmdletBinding()]
param(
 [Parameter(Mandatory)][ValidateSet('Create','CorrectConditions','CorrectGrant','CorrectSession','ReportOnly','Verify','Enforce')][string]$Mode,
 [string]$PolicyDisplayName,
 [ValidatePattern('^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$')][string]$PolicyId,
 [string[]]$ExcludeGroupIds=@(),
 [string]$GrantControlsJson,
 [switch]$ReadinessApproved
)
Set-StrictMode -Version Latest
$ErrorActionPreference='Stop'
$Base='https://graph.microsoft.com/v1.0/identity/conditionalAccess/policies'
$Guid='^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
function Connect-CA([bool]$Write){Import-Module Microsoft.Graph.Authentication -ErrorAction Stop;$s=@('Policy.Read.All');if($Write){$s+='Policy.ReadWrite.ConditionalAccess'};$c=Get-MgContext;$m=if($c){@($s|Where-Object{$_ -notin @($c.Scopes)})}else{$s};if((-not $c)-or$m.Count){Connect-MgGraph -Scopes $s -NoWelcome}}
function Assert-Inputs{if(@($ExcludeGroupIds|Where-Object{$_ -notmatch $Guid}).Count){throw 'Invalid exclusion ID.'}}
function Grant {
 if([string]::IsNullOrWhiteSpace($GrantControlsJson)){throw 'The resolved grant is required. Rescan IAMAI.'}
 $g=$GrantControlsJson|ConvertFrom-Json
 $strength=$g.PSObject.Properties['authenticationStrength']
 $custom=$g.PSObject.Properties['customAuthenticationFactors'];$terms=$g.PSObject.Properties['termsOfUse']
 if($g.operator-ne'OR'-or($custom-and@($custom.Value).Count)-or($terms-and@($terms.Value).Count)){throw 'Unexpected grant. Review the saved choice in IAMAI.'}
 $controls=@($g.builtInControls)
 if($strength-and$null-ne$strength.Value){
  if($controls.Count-ne0-or$strength.Value.id-notmatch$Guid){throw 'A resolved authentication-strength ID is required.'}
 }elseif($controls.Count-ne1-or$controls[0]-ne'mfa'){throw 'The saved first-enforcement grant must require MFA.'}
 return $g
}
function Get-Policy{if($PolicyId -notmatch $Guid){throw 'Stable IAMAI policy ID required.'};$p=Invoke-MgGraphRequest -Method GET -Uri "$Base/$PolicyId";if($p.id-ne$PolicyId){throw 'Stable-ID readback failed.'};$p}
function Same-Set([string[]]$A,[string[]]$B){(@($A|Sort-Object)-join '|') -eq (@($B|Sort-Object)-join '|')}
function Conditions{Assert-Inputs;@{users=@{includeUsers=@('All');excludeUsers=@();includeGroups=@();excludeGroups=@($ExcludeGroupIds);includeRoles=@();excludeRoles=@()};applications=@{includeApplications=@('All');excludeApplications=@();includeUserActions=@();includeAuthenticationContextClassReferences=@()};clientAppTypes=@('all');signInRiskLevels=@('high');userRiskLevels=@();servicePrincipalRiskLevels=@();locations=$null;platforms=$null;devices=$null;authenticationFlows=$null;insiderRiskLevels=$null}}
function Session{@{signInFrequency=@{isEnabled=$true;frequencyInterval='everyTime';authenticationType='primaryAndSecondaryAuthentication'};persistentBrowser=$null;applicationEnforcedRestrictions=$null;cloudAppSecurity=$null;disableResilienceDefaults=$null}}
function Patch([hashtable]$Body){[void](Get-Policy);Invoke-MgGraphRequest -Method PATCH -Uri "$Base/$PolicyId" -Body($Body|ConvertTo-Json -Depth 20)-ContentType 'application/json'|Out-Null}
function Assert-Canonical($p){Assert-Inputs;[void](Grant);if(@($p.conditions.users.includeUsers).Count-ne1-or$p.conditions.users.includeUsers[0]-ne'All'){throw 'includeUsers mismatch'};if(-not(Same-Set @($p.conditions.users.excludeGroups) @($ExcludeGroupIds))){throw 'excludeGroups mismatch'};if(@($p.conditions.applications.includeApplications).Count-ne1-or$p.conditions.applications.includeApplications[0]-ne'All'-or@($p.conditions.applications.excludeApplications).Count){throw 'All-resources target mismatch'};if(@($p.conditions.signInRiskLevels).Count-ne1-or$p.conditions.signInRiskLevels[0]-ne'high'){throw 'Sign-in risk must be High only'};if(@($p.conditions.userRiskLevels).Count){throw 'User risk must be empty'};$g=$p.grantControls;$expected=Grant;$actualStrength=$g.PSObject.Properties['authenticationStrength'];$expectedStrength=$expected.PSObject.Properties['authenticationStrength'];if($g.operator-ne$expected.operator-or-not(Same-Set @($g.builtInControls) @($expected.builtInControls))){throw 'Saved grant mismatch'};if($expectedStrength-and$null-ne$expectedStrength.Value){if(-not$actualStrength-or$null-eq$actualStrength.Value-or$actualStrength.Value.id-ne$expectedStrength.Value.id){throw 'Authentication-strength grant mismatch'}}elseif($actualStrength-and$null-ne$actualStrength.Value){throw 'Unexpected authentication strength'};$f=$p.sessionControls.signInFrequency;if($null-eq$f-or-not$f.isEnabled-or$f.frequencyInterval-ne'everyTime'-or$f.authenticationType-ne'primaryAndSecondaryAuthentication'){throw 'Every-time session mismatch'}}
switch($Mode){
 'Create'{Connect-CA $true;Assert-Inputs;[void](Grant);if([string]::IsNullOrWhiteSpace($PolicyDisplayName)){throw 'PolicyDisplayName required.'};$e=$PolicyDisplayName.Replace("'","''");$f=[uri]::EscapeDataString("displayName eq '$e'");if(@((Invoke-MgGraphRequest -Method GET -Uri "${Base}?`$filter=$f").value).Count){throw 'Exact display-name collision. Rescan IAMAI; do not create a duplicate.'};$b=@{displayName=$PolicyDisplayName;state='enabledForReportingButNotEnforced';conditions=(Conditions);grantControls=(Grant);sessionControls=(Session)};$r=Invoke-MgGraphRequest -Method POST -Uri $Base -Body($b|ConvertTo-Json -Depth 20)-ContentType 'application/json';Write-Host "Created $($r.id) in Report-only. Rescan IAMAI."}
 'CorrectConditions'{Connect-CA $true;Patch @{conditions=(Conditions)}}
 'CorrectGrant'{Connect-CA $true;Patch @{grantControls=(Grant)}}
 'CorrectSession'{Connect-CA $true;Patch @{sessionControls=(Session)}}
 'ReportOnly'{Connect-CA $true;Patch @{state='enabledForReportingButNotEnforced'}}
 'Verify'{Connect-CA $false;$p=Get-Policy;Assert-Canonical $p;Write-Host "Canonical high-risk shape verified; lifecycle=$($p.state)."}
 'Enforce'{if(-not$ReadinessApproved){throw 'Enforce requires ReadinessApproved.'};Connect-CA $true;$p=Get-Policy;Assert-Canonical $p;if($p.state-ne'enabledForReportingButNotEnforced'){throw 'Policy must be canonical and Report-only immediately before enforcement.'};Patch @{state='enabled'};$a=Get-Policy;Assert-Canonical $a;if($a.state-ne'enabled'){throw 'Enablement readback failed.'};Write-Host 'High-risk sign-in policy enabled. Review legitimate risk evidence and rescan IAMAI.'}
}
@@IAMAI-END

@@IAMAI-BEGIN {"id":"ai.create","channel":"aiInfo","states":["missing"],"format":"markdown","kind":"template"}
This state creates a policy that applies when Microsoft Entra ID Protection rates a sign-in High risk. Microsoft sets the risk level from its detections, so do not assume a particular detection always produces a High rating. Sign-in risk conditions require Microsoft Entra ID P2.

Selected grant: {{policy.target.grantWords}}. Every time sign-in frequency also applies. When an authentication strength is selected, explain its accepted methods rather than calling every strength phishing-resistant.
Accepted method combinations: {{authStrength.target.allowedCombinations}} [omit this line when unavailable]

The outputs follow the saved first-enforcement choice. If that choice is built-in MFA, explain that the baseline authentication strength remains a later hardening goal; do not describe it as already applied.

Every time sign-in frequency asks for fresh authentication each time the policy applies instead of relying on an earlier sign-in. It reduces reliance on an existing session but does not guarantee that an attacker cannot use one.

The Medium-risk policy stays separate and uses built-in MFA. The exclusions group is excluded, so accounts in that group, such as emergency access accounts, are not subject to this policy.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"ai.correct","channel":"aiInfo","states":["partial"],"format":"markdown","kind":"template"}

Differences IAMAI found on the High-risk policy: {{policy.current.semanticMismatches}}. The correction updates the same policy ID toward the intended target: All users with the intended exclusions, All resources, High sign-in risk only, the selected grant ({{policy.target.grantWords}}) and Every time sign-in frequency. The correction output follows the saved first-enforcement choice. If built-in MFA is selected, the baseline authentication strength remains a later hardening goal.

Keep the policy's current state. If it is On, the changed rule can affect access after you save.

This change removes {{policy.current.removedExclusions}} from the policy's exclusions. If the policy is On, it applies to them as soon as you save. [omit this line when unavailable]
@@IAMAI-END

@@IAMAI-BEGIN {"id":"ai.observe","channel":"aiInfo","states":["reportOnly"],"format":"markdown","kind":"template"}

The High-risk policy is in Report-only. Risky sign-ins: {{evidence.riskySignIns}}. Method readiness: {{evidence.mfaReadiness}}. Readiness depends on affected users being able to satisfy the selected grant; a registered MFA method does not always satisfy an authentication strength. No recent risk events does not prove future readiness, and a risky sign-in should not be manufactured to test the policy. The High and Medium policies should each cover only their own risk level.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"ai.enforce","channel":"aiInfo","states":["readyToEnforce"],"format":"markdown","kind":"template"}

The High-risk policy is ready to enforce. Before it is set On, the same policy ID should still be Report-only with High sign-in risk only, All users with the intended exclusions, All resources, the selected grant ({{policy.target.grantWords}}) and Every time sign-in frequency, and the Medium-risk policy should remain separate. The enforcement operation changes only the policy state. Verify that the saved first-enforcement choice still matches these settings before enforcement.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"email.users.pre-enforcement","channel":"email","states":["readyToEnforce"],"format":"markdown","kind":"template"}
Subject: Action needed: Challenge High-Risk Sign-ins

Hi,

We are preparing extra verification for sign-ins Microsoft rates high risk. Please make sure you can use the method IT has approved and contact IT support if you cannot complete a legitimate sign-in.

Thanks,
IT
@@IAMAI-END

@@IAMAI-BEGIN {"id":"readiness.model","channel":"readiness","states":["missing","partial","reportOnly","readyToEnforce"],"format":"json-template","kind":"referenceOnly"}
{"tiles":[{"id":"license","label":"Risk licensing","gate":"Safe to configure","result":"IAMAI tenant truth","line":"Sign-in risk conditions require Microsoft Entra ID P2 for in-scope users.","evidenceSource":"tenant licensing"},{"id":"method-readiness","label":"Selected method readiness","gate":"Safe to enforce","result":"{{evidence.mfaReadiness}}","line":"Check the selected first-enforcement requirement and affected users' ability to satisfy it. No recent risk events does not prove future readiness.","evidenceSource":"IAMAI MFA readiness"},{"id":"risk-evidence","label":"Risk evidence","gate":"Validation context","result":"{{evidence.riskySignIns}}","line":"Recent risky sign-ins inform rollout, but zero events does not prove future safety.","evidenceSource":"ID Protection / sign-in evidence"},{"id":"exclusions","label":"Exclusions","gate":"Safe to enforce","result":"IAMAI-resolved","line":"The required group is resolved. Verify that the policy references it and that its membership is still correct.","evidenceSource":"IAMAI canonical tenant truth"}],"whyIamaiSaysThis":"IAMAI keeps the baseline's High-only policy, with the selected grant and Every time sign-in frequency, separate from the Medium-risk policy. The scan can check the policy settings before enforcement, but whether risk occurs and users can remediate it depends on future sign-ins and each user's methods."}
@@IAMAI-END

@@IAMAI-BEGIN {"id":"troubleshooting.model","channel":"troubleshooting","states":["missing","partial","reportOnly","readyToEnforce","inPlace"],"format":"json","kind":"referenceOnly"}
{"scenarios":[{"id":"user-cannot-satisfy-strength","states":["reportOnly","readyToEnforce","inPlace"],"classification":"documented","symptom":"A legitimate high-risk sign-in cannot satisfy the selected grant.","check":"Compare the user's usable methods with the selected grant. If it uses an authentication strength, check that strength's exact allowed combinations.","fix":"Complete the approved registration/recovery path or return the policy to Report-only while readiness is corrected.","doNot":"Do not change the saved grant to work around one unexplained failure.","then":"Retest only after method readiness changes.","sources":["ms-auth-strength","ms-risk-policy"]},{"id":"mfa-not-registered","states":["readyToEnforce","inPlace"],"classification":"documented","symptom":"A user cannot self-remediate a risky sign-in because no qualifying method is registered.","check":"Confirm the affected user has a method satisfying the selected grant.","fix":"Register/restore an approved method before relying on self-remediation.","then":"Review the risk event again.","sources":["ms-risk-policy"]},{"id":"travel-or-vpn-risk","states":["inPlace"],"classification":"fieldObservation","symptom":"A legitimate traveler/VPN user receives high-risk verification.","check":"Inspect Risky sign-ins details, location, device, app, and detection context.","fix":"If verified legitimate, follow the approved risk-review process; do not globally weaken the policy from one event.","then":"Confirm/dismiss the risk using the organization's approved process.","sources":["ms-risk-reports"]},{"id":"wrong-risk-scope","states":["partial"],"classification":"derived","symptom":"This step also targets Medium sign-in risk.","check":"Read signInRiskLevels on the exact stable policy.","fix":"Correct this step to High only; IAMAI authors Medium risk separately.","then":"Rescan IAMAI.","sources":["ms-ca-condition-v1"]},{"id":"legacy-risk-policy","states":["missing","partial"],"classification":"documented","symptom":"Implementation is being attempted in legacy ID Protection risk policies instead of Conditional Access.","check":"Confirm the control is a Conditional Access policy.","fix":"Use Conditional Access; Microsoft retires legacy risk policies on October 1, 2026.","then":"Validate the CA policy in Report-only.","sources":["ms-risk-concept"]},{"id":"graph-403","states":["missing","partial","readyToEnforce"],"classification":"documented","symptom":"Graph/PowerShell returns 403 when creating or updating the policy.","check":"Verify Policy.Read.All + Policy.ReadWrite.ConditionalAccess and a supported Conditional Access/Security Administrator role.","fix":"Reconnect with the least required permission/role.","then":"Retry the same bounded operation.","sources":["ms-ca-create-v1"]}]}
@@IAMAI-END

@@IAMAI-BEGIN {"id":"entra.create","channel":"entra","states":["missing"],"format":"markdown","kind":"template"}
1. Go to Entra admin center → Conditional Access → Policies → New policy.
2. Name: {{policy.target.displayName}}.
3. Users → Include: All users. Exclude → Groups: add the exclusions group.
4. Target resources: All resources.
5. Conditions → Sign-in risk: check High only (not Medium).
6. Grant → Grant access → Require authentication strength → select "{{authStrength.target.displayName}}" (the strength you created in the Authentication Strength step).
7. Session → Sign-in frequency: Every time.
8. Enable policy: Report-only.
9. Create. Rescan in IAMAI.
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
Conditions > Sign-in risk: set **High** only. Remove Medium/Low from this member; Medium remains a separate IAMAI step.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"entra.correct.conditions","channel":"entra","states":["partial"],"format":"markdown","kind":"template"}
Remove noncanonical user-risk, location, platform, device/filter, authentication-flow, or workload-risk conditions. Keep client apps All.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"entra.correct.grant","channel":"entra","states":["partial"],"format":"markdown","kind":"template"}
Grant: **Require authentication strength > {{authStrength.target.displayName}}** only, with operator OR. Remove built-in MFA or other grants from this retained member; do not weaken it to plain MFA.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"entra.correct.session","channel":"entra","states":["partial"],"format":"markdown","kind":"template"}
Session: set **Sign-in frequency > Every time**. Remove other noncanonical session controls from this retained High-risk member.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"entra.correct.lifecycle","channel":"entra","states":["partial"],"format":"markdown","kind":"template"}
Set **Enable policy = Report-only** while correcting it unless IAMAI is explicitly projecting the later Enforce action.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"entra.correct.save-verify","channel":"entra","states":["partial"],"format":"markdown","kind":"template"}
Save the bounded correction, read the policy back by stable ID, and rescan IAMAI.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"entra.observe","channel":"entra","states":["reportOnly"],"format":"markdown","kind":"template"}
Leave the policy in Report-only. Verify the retained High-only/authentication-strength/Every-time shape, review High-risk sign-ins and whether affected users can satisfy the strength, and confirm the separate Medium-risk policy has not been absorbed or duplicated. Do not infer safety from zero recent risky events.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"entra.enforce","channel":"entra","states":["readyToEnforce"],"format":"markdown","kind":"template"}
Immediately before enforcement, re-read the stable policy and confirm High-only risk, All resources, canonical exclusions, the **{{authStrength.target.displayName}}** grant, Every-time sign-in frequency, and acceptable readiness. Change only **Enable policy** from Report-only to **On**, read back the state, and monitor legitimate sign-ins that cannot satisfy the strength. Roll back the same stable policy to Report-only if needed.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"json.create","channel":"json","states":["missing"],"format":"json-template","kind":"deployableAfterBinding","method":"POST","endpoint":"https://graph.microsoft.com/v1.0/identity/conditionalAccess/policies"}
{"displayName":{{json:policy.target.displayName}},"state":"enabledForReportingButNotEnforced","conditions":{"users":{"includeUsers":["All"],"excludeGroups":{{json:policy.target.excludeGroups}}},"applications":{"includeApplications":["All"],"excludeApplications":[]},"clientAppTypes":["all"],"signInRiskLevels":["high"]},"grantControls":{"operator":"OR","builtInControls":[],"customAuthenticationFactors":[],"termsOfUse":[],"authenticationStrength":{"id":{{json:authStrength.target.id}}}},"sessionControls":{"signInFrequency":{"isEnabled":true,"frequencyInterval":"everyTime","authenticationType":"primaryAndSecondaryAuthentication"}}}
@@IAMAI-END

@@IAMAI-BEGIN {"id":"json.correct.conditions","channel":"json","states":["partial"],"format":"json-template","kind":"deployableAfterBinding","method":"PATCH","endpoint":"https://graph.microsoft.com/v1.0/identity/conditionalAccess/policies/{policy.current.id}"}
{"conditions":{"users":{"includeUsers":["All"],"excludeUsers":[],"includeGroups":[],"excludeGroups":{{json:policy.target.excludeGroups}},"includeRoles":[],"excludeRoles":[]},"applications":{"includeApplications":["All"],"excludeApplications":[],"includeUserActions":[],"includeAuthenticationContextClassReferences":[]},"clientAppTypes":["all"],"signInRiskLevels":["high"],"userRiskLevels":[],"servicePrincipalRiskLevels":[],"locations":null,"platforms":null,"devices":null,"authenticationFlows":null,"insiderRiskLevels":null}}
@@IAMAI-END

@@IAMAI-BEGIN {"id":"json.correct.grant","channel":"json","states":["partial"],"format":"json-template","kind":"deployableAfterBinding","method":"PATCH","endpoint":"https://graph.microsoft.com/v1.0/identity/conditionalAccess/policies/{policy.current.id}"}
{"grantControls":{"operator":"OR","builtInControls":[],"customAuthenticationFactors":[],"termsOfUse":[],"authenticationStrength":{"id":{{json:authStrength.target.id}}}}}
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

@@IAMAI-BEGIN {"id":"powershell.run","channel":"powershell","states":["missing","partial","reportOnly","readyToEnforce"],"format":"powershell","kind":"deployableAfterBinding","invocation":{"modeParameter":"Mode","parameters":{"PolicyDisplayName":{"binding":"policy.target.displayName","modes":["Create"]},"PolicyId":{"binding":"policy.current.id","modes":["CorrectConditions","CorrectGrant","CorrectSession","ReportOnly","Verify"]},"ExcludeGroupIds":{"binding":"policy.target.excludeGroups","modes":["Create","CorrectConditions","Verify"]},"AuthenticationStrengthId":{"binding":"authStrength.target.id","modes":["Create","CorrectGrant","Verify"]}},"withheldModes":{"Enforce":"the script enforces only with -ReadinessApproved, an attestation this package declares no prerequisite for, so IAMAI cannot pass it"}}}
# IAMAI compact implementation script — Challenge High-Risk Sign-ins
[CmdletBinding()]
param(
 [Parameter(Mandatory)][ValidateSet('Create','CorrectConditions','CorrectGrant','CorrectSession','ReportOnly','Verify','Enforce')][string]$Mode,
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
function Connect-CA([bool]$Write){Import-Module Microsoft.Graph.Authentication -ErrorAction Stop;$s=@('Policy.Read.All');if($Write){$s+='Policy.ReadWrite.ConditionalAccess'};$c=Get-MgContext;$m=if($c){@($s|Where-Object{$_ -notin @($c.Scopes)})}else{$s};if((-not $c)-or$m.Count){Connect-MgGraph -Scopes $s -NoWelcome}}
function Assert-Inputs{if(@($ExcludeGroupIds|Where-Object{$_ -notmatch $Guid}).Count){throw 'Invalid exclusion ID.'}}
function Assert-Strength{if($AuthenticationStrengthId -notmatch $Guid){throw 'The IAMAI-resolved tenant authentication-strength ID is required.'}}
function Get-Policy{if($PolicyId -notmatch $Guid){throw 'Stable IAMAI policy ID required.'};$p=Invoke-MgGraphRequest -Method GET -Uri "$Base/$PolicyId";if($p.id-ne$PolicyId){throw 'Stable-ID readback failed.'};$p}
function Same-Set([string[]]$A,[string[]]$B){(@($A|Sort-Object)-join '|') -eq (@($B|Sort-Object)-join '|')}
function Conditions{Assert-Inputs;@{users=@{includeUsers=@('All');excludeUsers=@();includeGroups=@();excludeGroups=@($ExcludeGroupIds);includeRoles=@();excludeRoles=@()};applications=@{includeApplications=@('All');excludeApplications=@();includeUserActions=@();includeAuthenticationContextClassReferences=@()};clientAppTypes=@('all');signInRiskLevels=@('high');userRiskLevels=@();servicePrincipalRiskLevels=@();locations=$null;platforms=$null;devices=$null;authenticationFlows=$null;insiderRiskLevels=$null}}
function Grant{Assert-Strength;@{operator='OR';builtInControls=@();customAuthenticationFactors=@();termsOfUse=@();authenticationStrength=@{id=$AuthenticationStrengthId}}}
function Session{@{signInFrequency=@{isEnabled=$true;frequencyInterval='everyTime';authenticationType='primaryAndSecondaryAuthentication'};persistentBrowser=$null;applicationEnforcedRestrictions=$null;cloudAppSecurity=$null;disableResilienceDefaults=$null}}
function Patch([hashtable]$Body){[void](Get-Policy);Invoke-MgGraphRequest -Method PATCH -Uri "$Base/$PolicyId" -Body($Body|ConvertTo-Json -Depth 20)-ContentType 'application/json'|Out-Null}
function Assert-Canonical($p){Assert-Inputs;Assert-Strength;if(@($p.conditions.users.includeUsers).Count-ne1-or$p.conditions.users.includeUsers[0]-ne'All'){throw 'includeUsers mismatch'};if(-not(Same-Set @($p.conditions.users.excludeGroups) @($ExcludeGroupIds))){throw 'excludeGroups mismatch'};if(@($p.conditions.applications.includeApplications).Count-ne1-or$p.conditions.applications.includeApplications[0]-ne'All'-or@($p.conditions.applications.excludeApplications).Count){throw 'All-resources target mismatch'};if(@($p.conditions.signInRiskLevels).Count-ne1-or$p.conditions.signInRiskLevels[0]-ne'high'){throw 'Sign-in risk must be High only'};if(@($p.conditions.userRiskLevels).Count){throw 'User risk must be empty'};$g=$p.grantControls;if($g.operator-ne'OR'-or@($g.builtInControls).Count-ne0-or$null-eq$g.authenticationStrength-or$g.authenticationStrength.id-ne$AuthenticationStrengthId){throw 'Authentication-strength grant mismatch'};$f=$p.sessionControls.signInFrequency;if($null-eq$f-or-not$f.isEnabled-or$f.frequencyInterval-ne'everyTime'-or$f.authenticationType-ne'primaryAndSecondaryAuthentication'){throw 'Every-time session mismatch'}}
switch($Mode){
 'Create'{Connect-CA $true;Assert-Inputs;Assert-Strength;if([string]::IsNullOrWhiteSpace($PolicyDisplayName)){throw 'PolicyDisplayName required.'};$e=$PolicyDisplayName.Replace("'","''");$f=[uri]::EscapeDataString("displayName eq '$e'");if(@((Invoke-MgGraphRequest -Method GET -Uri "${Base}?`$filter=$f").value).Count){throw 'Exact display-name collision. Rescan IAMAI; do not create a duplicate.'};$b=@{displayName=$PolicyDisplayName;state='enabledForReportingButNotEnforced';conditions=(Conditions);grantControls=(Grant);sessionControls=(Session)};$r=Invoke-MgGraphRequest -Method POST -Uri $Base -Body($b|ConvertTo-Json -Depth 20)-ContentType 'application/json';Write-Host "Created $($r.id) in Report-only. Rescan IAMAI."}
 'CorrectConditions'{Connect-CA $true;Patch @{conditions=(Conditions)}}
 'CorrectGrant'{Connect-CA $true;Patch @{grantControls=(Grant)}}
 'CorrectSession'{Connect-CA $true;Patch @{sessionControls=(Session)}}
 'ReportOnly'{Connect-CA $true;Patch @{state='enabledForReportingButNotEnforced'}}
 'Verify'{Connect-CA $false;$p=Get-Policy;Assert-Canonical $p;Write-Host "Canonical high-risk shape verified; lifecycle=$($p.state)."}
 'Enforce'{if(-not$ReadinessApproved){throw 'Enforce requires ReadinessApproved.'};Connect-CA $true;$p=Get-Policy;Assert-Canonical $p;if($p.state-ne'enabledForReportingButNotEnforced'){throw 'Policy must be canonical and Report-only immediately before enforcement.'};Patch @{state='enabled'};$a=Get-Policy;Assert-Canonical $a;if($a.state-ne'enabled'){throw 'Enablement readback failed.'};Write-Host 'High-risk sign-in policy enabled. Review legitimate risk evidence and rescan IAMAI.'}
}
@@IAMAI-END

@@IAMAI-BEGIN {"id":"ai.create","channel":"aiInfo","states":["missing"],"format":"markdown","kind":"template"}
This policy responds to high-risk sign-ins detected by Microsoft Entra ID Protection. High risk means Microsoft is fairly confident the sign-in is compromised — for example, credentials confirmed in a breach database, or traffic from a known attack infrastructure.

Unlike the medium-risk policy (which requires standard MFA), this one requires the authentication strength "{{authStrength.target.displayName}}" — only phishing-resistant methods. The reasoning: if the risk is high, a phished code or push approval might be exactly how the attacker got in.

The "Every time" sign-in frequency forces re-authentication on every high-risk sign-in, even if the user has a valid session. This ensures the attacker can't ride an existing session.

The exclusions group ensures emergency access accounts are not blocked during a high-risk event.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"ai.correct","channel":"aiInfo","states":["partial"],"format":"markdown","kind":"template"}
**Contains tenant context. Review before sharing with an external AI service.**

Review only these IAMAI-classified mismatches for the High-risk policy: {{policy.current.semanticMismatches}}. Preserve the stable policy identity, High-only threshold, the authentication-strength grant, and Every-time sign-in frequency. Do not weaken the grant to plain MFA.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"ai.observe","channel":"aiInfo","states":["reportOnly"],"format":"markdown","kind":"template"}
**Contains tenant context. Review before sharing with an external AI service.**

Assess readiness for the retained High-risk policy using only IAMAI-provided evidence: risky sign-ins {{evidence.riskySignIns}} and MFA readiness {{evidence.mfaReadiness}}. Confirm affected users can satisfy the baseline authentication strength and that the High and Medium policies complement rather than overlap. Unknown remains Unknown.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"ai.enforce","channel":"aiInfo","states":["readyToEnforce"],"format":"markdown","kind":"template"}
**Contains tenant context. Review before sharing with an external AI service.**

Perform a final pre-enforcement review for Challenge High-Risk Sign-ins. Confirm the exact stable policy is canonical and Report-only, risk is High only, the grant is the {{authStrength.target.displayName}} authentication strength, sign-in frequency is Every time, exclusions are canonical, and the Medium-risk policy remains separate. The only mutation should be lifecycle to On.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"email.users.pre-enforcement","channel":"email","states":["readyToEnforce"],"format":"markdown","kind":"template"}
Subject: Strong verification for high-risk sign-ins

Hi,

We are enabling additional protection for sign-ins Microsoft identifies as high risk. Most sign-ins are unaffected. If a sign-in is rated high risk, you will be asked to verify again using **{{authStrength.target.displayName}}** before access continues.

If you cannot complete the required verification or believe the sign-in was yours, contact IT/help desk rather than repeatedly approving prompts.

Thanks,
IT
@@IAMAI-END

@@IAMAI-BEGIN {"id":"readiness.model","channel":"readiness","states":["missing","partial","reportOnly","readyToEnforce"],"format":"json-template","kind":"referenceOnly"}
{"tiles":[{"id":"license","label":"Risk licensing","gate":"Safe to configure","result":"IAMAI tenant truth","line":"Risk-based Conditional Access requires P2/qualifying ID Protection capability for in-scope users.","evidenceSource":"tenant licensing"},{"id":"method-readiness","label":"Authentication strength readiness","gate":"Safe to enforce","result":"{{evidence.mfaReadiness}}","line":"Users must be able to satisfy the exact allowed combinations of the baseline authentication strength.","evidenceSource":"IAMAI MFA readiness"},{"id":"risk-evidence","label":"Risk evidence","gate":"Validation context","result":"{{evidence.riskySignIns}}","line":"Recent risky sign-ins inform rollout, but zero events does not prove future safety.","evidenceSource":"ID Protection / sign-in evidence"},{"id":"exclusions","label":"Exclusions","gate":"Safe to enforce","result":"IAMAI-resolved","line":"Canonical emergency/global exclusions remain explicit and stable.","evidenceSource":"IAMAI canonical tenant truth"}],"whyIamaiSaysThis":"IAMAI preserves the pinned baseline's High-only policy, with its authentication-strength grant and Every-time sign-in frequency, separate from the Medium-risk rung. It can verify policy shape before enforcement, but risk occurrence and successful self-remediation depend on future sign-in events and the user's actual authentication methods."}
@@IAMAI-END

@@IAMAI-BEGIN {"id":"troubleshooting.model","channel":"troubleshooting","states":["missing","partial","reportOnly","readyToEnforce","inPlace"],"format":"json","kind":"referenceOnly"}
{"scenarios":[{"id":"user-cannot-satisfy-strength","states":["reportOnly","readyToEnforce","inPlace"],"classification":"documented","symptom":"A legitimate high-risk sign-in cannot satisfy the required baseline authentication strength.","check":"Compare the user's registered/allowed methods with the exact allowed combinations of the resolved strength.","fix":"Complete the approved registration/recovery path or return the policy to Report-only while readiness is corrected.","doNot":"Do not weaken the grant to plain MFA.","then":"Retest only after method readiness changes.","sources":["ms-auth-strength","ms-risk-policy"]},{"id":"mfa-not-registered","states":["readyToEnforce","inPlace"],"classification":"documented","symptom":"A user cannot self-remediate a risky sign-in because no qualifying method is registered.","check":"Confirm the affected user has a method satisfying the baseline authentication strength.","fix":"Register/restore an approved method before relying on self-remediation.","then":"Review the risk event again.","sources":["ms-risk-policy"]},{"id":"travel-or-vpn-risk","states":["inPlace"],"classification":"fieldObservation","symptom":"A legitimate traveler/VPN user receives high-risk verification.","check":"Inspect Risky sign-ins details, location, device, app, and detection context.","fix":"If verified legitimate, follow the approved risk-review process; do not globally weaken the policy from one event.","then":"Confirm/dismiss the risk using the organization's approved process.","sources":["ms-risk-reports"]},{"id":"wrong-risk-scope","states":["partial"],"classification":"derived","symptom":"This step also targets Medium sign-in risk.","check":"Read signInRiskLevels on the exact stable policy.","fix":"Correct this step to High only; IAMAI authors Medium risk separately.","then":"Rescan IAMAI.","sources":["ms-ca-condition-v1"]},{"id":"legacy-risk-policy","states":["missing","partial"],"classification":"documented","symptom":"Implementation is being attempted in legacy ID Protection risk policies instead of Conditional Access.","check":"Confirm the control is a Conditional Access policy.","fix":"Use Conditional Access; Microsoft retires legacy risk policies on October 1, 2026.","then":"Validate the CA policy in Report-only.","sources":["ms-risk-concept"]},{"id":"graph-403","states":["missing","partial","readyToEnforce"],"classification":"documented","symptom":"Graph/PowerShell returns 403 when creating or updating the policy.","check":"Verify Policy.Read.All + Policy.ReadWrite.ConditionalAccess and a supported Conditional Access/Security Administrator role.","fix":"Reconnect with the least required permission/role.","then":"Retry the same bounded operation.","sources":["ms-ca-create-v1"]}]}
@@IAMAI-END

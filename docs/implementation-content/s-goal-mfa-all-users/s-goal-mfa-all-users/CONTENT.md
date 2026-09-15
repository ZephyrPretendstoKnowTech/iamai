@@IAMAI-BEGIN {"id":"entra.create","channel":"entra","states":["missing"],"format":"markdown","kind":"template"}
1. Open **Entra ID > Conditional Access > Policies > New policy**.
2. Name: **{{policy.target.displayName}}**.
3. Apply the IAMAI-resolved assignments from the target: **Users → Include: All users**, excluding the resolved exclusions. Target resources: **All resources**, excluding **Microsoft Intune Enrollment**. Leave the other conditions unconfigured; client apps remains All.
4. Grant: **Require multifactor authentication**. Do not substitute an authentication strength.
5. Leave session controls unconfigured.
6. Set **Enable policy: Report-only** and create it. It will not enforce its access rule until you enable it.
7. Re-open the created policy, compare it to the IAMAI target, then rescan.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"entra.correct-open","channel":"entra","states":["partial"],"format":"markdown","kind":"template"}
This change removes {{policy.current.removedExclusions}} from the policy's exclusions. If the policy is On, it applies to them as soon as you save. [omit this line when unavailable]

This policy already exists. The correction changes only the settings IAMAI found different from the intended target, on the same policy.

1. Go to Entra admin center → Conditional Access → Policies.
2. Open the policy named {{policy.current.displayName}} (or find it by ID in Plan settings).
@@IAMAI-END

@@IAMAI-BEGIN {"id":"entra.correct-conditions","channel":"entra","states":["partial"],"format":"markdown","kind":"template"}
3. Users → Include: All users. Exclude: the exclusions IAMAI resolved, including the exclusions group you confirmed in the Exclusions Group step.
4. Target resources → Include: All resources. Exclude: Microsoft Intune Enrollment. A separate step sets the requirement for Intune enrollment.
5. Conditions: leave user risk, sign-in risk, device platforms, locations and authentication flows unconfigured. Client apps remains All.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"entra.correct-grant","channel":"entra","states":["partial"],"format":"markdown","kind":"template"}
Keep the policy's current state. If it is On, the changed rule can affect access after you save. Under **Grant**, select **Require multifactor authentication** and clear any other control, including an authentication strength. Change this policy only. Stronger method requirements belong to the separate policies that select an authentication strength.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"entra.correct-session","channel":"entra","states":["partial"],"format":"markdown","kind":"template"}
Under **Session**, clear every control; the intended target has none. Session lifetime and other session controls belong to separate baseline steps.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"entra.correct-name","channel":"entra","states":["partial"],"format":"markdown","kind":"template"}
Rename the same policy to **{{policy.target.displayName}}**. The display name does not identify the policy for updates; IAMAI uses the same policy ID.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"entra.correct-verify","channel":"entra","states":["partial"],"format":"markdown","kind":"template"}
6. Save. Keep the policy's current state. If it is On, the changed rule can affect access after you save.
7. Rescan in IAMAI to confirm the correction. Verify after the change: an ordinary user in scope can complete MFA, and emergency access still works.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"entra.observe","channel":"entra","states":["reportOnly"],"format":"markdown","kind":"template"}
Keep the policy in **Report-only** while you review the evidence listed for this step. In the report-only results, separate people who could not satisfy MFA from accounts excluded as intended. A registered method and a successful MFA sign-in are different evidence. Keep the policy unchanged until IAMAI marks it ready to enforce.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"entra.enforce","channel":"entra","states":["readyToEnforce"],"format":"markdown","kind":"template"}
Re-open the policy by the same policy ID, confirm it is still Report-only and matches the intended target, then change **Enable policy** to **On** and save. Verify after the change: an ordinary user in scope can complete MFA, and emergency access still works. Then rescan IAMAI.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"json.target-policy","channel":"json","states":["missing"],"format":"json-template","kind":"template","method":"POST","endpoint":"https://graph.microsoft.com/v1.0/identity/conditionalAccess/policies"}
{"displayName":{{json:policy.target.displayName}},"state":"enabledForReportingButNotEnforced","conditions":{{json:policy.target.conditions}},"grantControls":{"operator":"OR","builtInControls":["mfa"],"customAuthenticationFactors":[],"termsOfUse":[]},"sessionControls":null}
@@IAMAI-END

@@IAMAI-BEGIN {"id":"json.correct-conditions","channel":"json","states":["partial"],"format":"json-template","kind":"template","method":"PATCH","endpoint":"https://graph.microsoft.com/v1.0/identity/conditionalAccess/policies/{policy.current.id}"}
{"conditions":{{json:policy.target.conditions}}}
@@IAMAI-END

@@IAMAI-BEGIN {"id":"json.correct-grant","channel":"json","states":["partial"],"format":"json","kind":"template","method":"PATCH","endpoint":"https://graph.microsoft.com/v1.0/identity/conditionalAccess/policies/{policy.current.id}"}
{"grantControls":{"operator":"OR","builtInControls":["mfa"],"customAuthenticationFactors":[],"termsOfUse":[]}}
@@IAMAI-END

@@IAMAI-BEGIN {"id":"json.correct-session","channel":"json","states":["partial"],"format":"json","kind":"template","method":"PATCH","endpoint":"https://graph.microsoft.com/v1.0/identity/conditionalAccess/policies/{policy.current.id}"}
{"sessionControls":null}
@@IAMAI-END

@@IAMAI-BEGIN {"id":"json.correct-name","channel":"json","states":["partial"],"format":"json-template","kind":"template","method":"PATCH","endpoint":"https://graph.microsoft.com/v1.0/identity/conditionalAccess/policies/{policy.current.id}"}
{"displayName":{{json:policy.target.displayName}}}
@@IAMAI-END

@@IAMAI-BEGIN {"id":"json.enforce","channel":"json","states":["readyToEnforce"],"format":"json","kind":"template","method":"PATCH","endpoint":"https://graph.microsoft.com/v1.0/identity/conditionalAccess/policies/{policy.current.id}"}
{"state":"enabled"}
@@IAMAI-END

@@IAMAI-BEGIN {"id":"powershell.run","channel":"powershell","states":["missing","partial","reportOnly","readyToEnforce"],"format":"powershell","kind":"deployableAfterBinding","invocation":{"modeParameter":"Mode","parameters":{"TargetPolicyJson":{"binding":"policy.target.json","modes":["Create","CorrectConditions","CorrectGrant","CorrectSession","CorrectName","Observe","Enforce"]},"PolicyId":{"binding":"policy.current.id","modes":["CorrectConditions","CorrectGrant","CorrectSession","CorrectName","Observe","Enforce"]}}}}
# This change removes {{policy.current.removedExclusions}} from the policy's exclusions. If the policy is On, it applies to them as soon as the correction is saved. [omit this line when unavailable]
param(
 [Parameter(Mandatory=$true)][ValidateSet('Create','CorrectConditions','CorrectGrant','CorrectSession','CorrectName','Observe','Enforce','Verify')][string]$Mode,
 [Parameter(Mandatory=$true)][string]$TargetPolicyJson,
 [string]$PolicyId
)
$ErrorActionPreference='Stop'
Connect-MgGraph -Scopes 'Policy.Read.All','Policy.ReadWrite.ConditionalAccess' -NoWelcome
$G='https://graph.microsoft.com/v1.0'
function GuidOk([string]$v,[string]$n){$g=[guid]::Empty;if(-not [guid]::TryParse($v,[ref]$g)){throw "$n must be a GUID."}}
function IG($m,$u,$b=$null){if($null -eq $b){return Invoke-MgGraphRequest -Method $m -Uri $u -OutputType PSObject};Invoke-MgGraphRequest -Method $m -Uri $u -Body ($b|ConvertTo-Json -Depth 80) -ContentType 'application/json' -OutputType PSObject}
function Project($actual,$target){
 if($null -eq $target){return $actual}
 if($target -is [string] -or $target -is [bool] -or $target -is [int] -or $target -is [long] -or $target -is [double]){return $actual}
 if($target -is [System.Collections.IEnumerable] -and -not ($target -is [string])){return @($actual)}
 $h=[ordered]@{}
 foreach($p in $target.PSObject.Properties){$h[$p.Name]=Project $actual.($p.Name) $p.Value}
 return [pscustomobject]$h
}
function Norm($v){
 if($null -eq $v){return $null}
 if($v -is [string] -or $v -is [bool] -or $v -is [int] -or $v -is [long] -or $v -is [double]){return $v}
 if($v -is [System.Collections.IEnumerable] -and -not ($v -is [string])){
   $a=@($v|ForEach-Object { Norm $_ })
   return @($a|Sort-Object { $_|ConvertTo-Json -Depth 80 -Compress })
 }
 $h=[ordered]@{}
 foreach($p in ($v.PSObject.Properties.Name|Sort-Object)){$h[$p]=Norm $v.$p}
 return [pscustomobject]$h
}
function Same($actual,$target){
 $a=Norm (Project $actual $target);$t=Norm $target
 return (($a|ConvertTo-Json -Depth 80 -Compress) -eq ($t|ConvertTo-Json -Depth 80 -Compress))
}
$target=$TargetPolicyJson|ConvertFrom-Json
if(-not $target.displayName -or $null -eq $target.conditions -or $null -eq $target.grantControls){throw 'TargetPolicyJson is incomplete.'}
if($Mode -eq 'Create'){
 $body=[ordered]@{displayName=$target.displayName;state='enabledForReportingButNotEnforced';conditions=$target.conditions;grantControls=$target.grantControls;sessionControls=$target.sessionControls}
 $created=IG POST "$G/identity/conditionalAccess/policies" $body
 $PolicyId=[string]$created.id
 Write-Host "Created $PolicyId in Report-only."
}else{GuidOk $PolicyId 'PolicyId'}
$uri="$G/identity/conditionalAccess/policies/$PolicyId"
if($Mode -eq 'CorrectConditions'){IG PATCH $uri @{conditions=$target.conditions}|Out-Null}
if($Mode -eq 'CorrectGrant'){IG PATCH $uri @{grantControls=$target.grantControls}|Out-Null}
if($Mode -eq 'CorrectSession'){IG PATCH $uri @{sessionControls=$target.sessionControls}|Out-Null}
if($Mode -eq 'CorrectName'){IG PATCH $uri @{displayName=$target.displayName}|Out-Null}
if($Mode -eq 'Enforce'){
 $pre=IG GET $uri
 if([string]$pre.state -ne 'enabledForReportingButNotEnforced'){throw 'Refusing enforcement: policy is not Report-only immediately before enforcement.'}
 if(-not (Same $pre.conditions $target.conditions)){throw 'Refusing enforcement: conditions do not match canonical target.'}
 if(-not (Same $pre.grantControls $target.grantControls)){throw 'Refusing enforcement: grant controls do not match canonical target.'}
 if(-not (Same $pre.sessionControls $target.sessionControls)){throw 'Refusing enforcement: session controls do not match canonical target.'}
 IG PATCH $uri @{state='enabled'}|Out-Null
}
$actual=IG GET $uri
[pscustomobject]@{
 PolicyId=$actual.id; DisplayName=$actual.displayName; State=$actual.state;
 NameCanonical=([string]$actual.displayName -eq [string]$target.displayName);
 ConditionsCanonical=(Same $actual.conditions $target.conditions);
 GrantCanonical=(Same $actual.grantControls $target.grantControls);
 SessionCanonical=(Same $actual.sessionControls $target.sessionControls)
}
@@IAMAI-END

@@IAMAI-BEGIN {"id":"ai.create","channel":"aiInfo","states":["missing"],"format":"markdown","kind":"template"}
**Contains tenant context. Review before sharing with an external AI service.**

State: the MFA-for-everyone policy does not exist in {{tenant.displayName}} yet. The next action creates it in Report-only: All users with the exclusions IAMAI resolved, All resources except Microsoft Intune Enrollment, no additional conditions, Grant: Require multifactor authentication, and no session controls. It does not prompt anyone until it is enabled.

This policy uses the built-in Require multifactor authentication grant, not an authentication strength. A separate step sets the requirement for Intune enrollment.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"ai.correct","channel":"aiInfo","states":["partial"],"format":"markdown","kind":"template"}
This policy requires multifactor authentication for the users it covers. It uses the built-in Require multifactor authentication grant, not an authentication strength. Stronger method requirements belong to the separate policies that select an authentication strength.

The policy already exists on your tenant. The correction changes only the settings IAMAI found different from the intended target:
— Users: All users, excluding the exclusions IAMAI resolved, including the exclusions group.
— Target resources: All resources, excluding Microsoft Intune Enrollment. A separate step sets the requirement for Intune enrollment.
— Conditions: no location, device platform or risk conditions; client apps remains All.
— Grant: Require multifactor authentication. Session controls: none.

An existing MFA claim may satisfy the policy, so people are not necessarily prompted at every sign-in. Whether each person has a usable method is shown on MFA Readiness; the MFA Registration Campaign step helps people register one.

Keep the policy's current state. If it is On, the changed rule can affect access after you save.

This change removes {{policy.current.removedExclusions}} from the policy's exclusions. If the policy is On, it applies to them as soon as you save. [omit this line when unavailable]
@@IAMAI-END

@@IAMAI-BEGIN {"id":"ai.observe","channel":"aiInfo","states":["reportOnly"],"format":"markdown","kind":"template"}
**Contains tenant context. Review before sharing with an external AI service.**

State: the MFA-for-everyone policy is in Report-only in {{tenant.displayName}}; it does not prompt anyone yet. Report-only evidence: {{evidence.reportOnly}}.

Separate people who could not satisfy MFA from accounts excluded as intended. A registered method is not the same as a successful MFA sign-in, and few records do not show that everyone is ready.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"ai.enforce","channel":"aiInfo","states":["readyToEnforce"],"format":"markdown","kind":"template"}
**Contains tenant context. Review before sharing with an external AI service.**

State: the MFA-for-everyone policy is in Report-only in {{tenant.displayName}} and the next action is to enable it. Before setting it to On, the same policy ID should still be Report-only and match the intended target: All resources except Microsoft Intune Enrollment, Require multifactor authentication, no session controls. After enabling, test an ordinary user in scope and emergency access.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"ai.blocked","channel":"aiInfo","states":["blocked","needsDecision","sourceConflict"],"format":"markdown","kind":"template"}
**Contains tenant context. Review before sharing with an external AI service.**

State: the MFA-for-everyone step cannot proceed yet. Known blockers or decisions: {{dependencies.blockers}}. These must be resolved before the policy is created or changed; an added exclusion does not resolve them.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"ai.not-licensed","channel":"aiInfo","states":["notLicensed"],"format":"markdown","kind":"template"}
**Contains tenant context. Review before sharing with an external AI service.**

State: this Conditional Access policy needs Microsoft Entra licensing that this scan did not confirm. No implementation is offered until licensing is resolved. The licensing gap does not change the baseline goal.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"email.rollout","channel":"email","states":["missing"],"format":"markdown","kind":"template"}
Subject: Action needed: Require MFA for Everyone

We are preparing an MFA requirement for work sign-ins. Please check that you can use your approved sign-in method and contact IT if you need help before the change.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"email.enforce","channel":"email","states":["readyToEnforce"],"format":"markdown","kind":"template","audience":"help-desk"}
Subject: Prepare support: MFA for work sign-ins

We are preparing an MFA requirement for work sign-ins. Please help affected staff test their approved methods, record any legitimate access problems, and confirm recovery support before enforcement.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"readiness.model","channel":"readiness","states":["missing","partial","reportOnly","readyToEnforce"],"format":"json-template","kind":"template"}
{"tiles":[{"id":"scope","label":"Affected people","result":{{json:people.affected.count}},"line":"All users are targeted except the resolved exclusions. This is the population IAMAI resolved for this policy, not a prediction that every account will be prompted."},{"id":"readiness","label":"MFA readiness","result":{{json:evidence.mfaReadiness}},"line":"Review people without a usable method or observed MFA use. Check the policy's actual exclusions and resource scope."},{"id":"state","label":"Policy state","result":{{json:policy.current.state}},"line":"A missing or differing policy must reach the intended settings in Report-only before enforcement."}],"baselineNote":"The baseline excludes Microsoft Intune Enrollment and uses the built-in Require multifactor authentication grant."}
@@IAMAI-END

@@IAMAI-BEGIN {"id":"troubleshooting.model","channel":"troubleshooting","states":["missing","partial","reportOnly","readyToEnforce","inPlace"],"format":"json","kind":"referenceOnly"}
{"scenarios":[{"id":"ordinary-user-cannot-mfa","classification":"documented","symptom":"A user in scope cannot satisfy MFA.","check":"Confirm the user's registered methods/readiness and the Conditional Access result before changing policy scope.","fix":"Use the approved registration/recovery path; do not add a permanent user exclusion.","then":"Retest and rescan IAMAI.","sources":["ms-mfa-all"]},{"id":"intune-enrollment-was-reincluded","classification":"derived","symptom":"The broad MFA policy now also targets Microsoft Intune Enrollment.","check":"Compare application exclusions to the retained baseline member.","fix":"Restore the baseline Intune Enrollment exclusion on the same policy ID; a separate step sets the requirement for Intune enrollment.","then":"Re-read and rescan.","sources":["ms-ca-update"]},{"id":"duplicate-mfa-policy","classification":"derived","symptom":"A second broad MFA policy was created instead of correcting the resolved one.","check":"Compare stable policy identities and effective scope.","fix":"Return to the IAMAI-resolved policy identity; do not delete anything until overlap is reviewed.","then":"Resolve duplication deliberately and rescan.","sources":["ms-ca-policy"]},{"id":"report-only-failures","classification":"documented","symptom":"Report-only shows failures that would block users.","check":"Inspect affected sign-ins and distinguish missing MFA capability from expected exclusions.","fix":"Resolve the person's MFA readiness or the missing prerequisite; do not enforce until the evidence requirement is met.","then":"Continue observation and rescan.","sources":["ms-mfa-all"]}]}
@@IAMAI-END

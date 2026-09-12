@@IAMAI-BEGIN {"id":"entra.create","channel":"entra","states":["missing"],"format":"markdown","kind":"template"}
1. Open **Entra ID > Conditional Access > Policies > New policy**.
2. Name: **{{policy.target.displayName}}**.
3. Apply the exact IAMAI-resolved assignments and conditions from the target. The resource scope is **All resources except Microsoft Intune Enrollment**.
4. Grant: **Require multifactor authentication**. Do not substitute an authentication strength.
5. Leave session controls unconfigured.
6. Set **Enable policy: Report-only** and create it.
7. Re-open the created policy, compare it to the IAMAI target, then rescan.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"entra.correct-open","channel":"entra","states":["partial"],"format":"markdown","kind":"template"}
Open the exact resolved Conditional Access policy by stable tenant ID **{{policy.current.id}}**. Apply only the mismatch modules IAMAI selected; do not create a replacement policy.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"entra.correct-conditions","channel":"entra","states":["partial"],"format":"markdown","kind":"template"}
Replace only the policy assignments/conditions with the complete IAMAI-resolved canonical target. Preserve the same policy ID. This includes All users, canonical exclusions, All resources with Microsoft Intune Enrollment excluded, all client apps, and no extra risk/location/platform/device/flow/action/context conditions.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"entra.correct-grant","channel":"entra","states":["partial"],"format":"markdown","kind":"template"}
Under **Grant**, select **Require multifactor authentication** with OR semantics. Remove a non-canonical authentication strength or other grant control from this policy only; do not change unrelated policies.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"entra.correct-session","channel":"entra","states":["partial"],"format":"markdown","kind":"template"}
Remove session controls from this policy. Session lifetime and other session controls are owned by separate baseline steps.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"entra.correct-name","channel":"entra","states":["partial"],"format":"markdown","kind":"template"}
Rename the same resolved policy to **{{policy.target.displayName}}**. Do not use the display name as update identity.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"entra.correct-verify","channel":"entra","states":["partial"],"format":"markdown","kind":"template"}
Save, re-open the same policy by stable ID, verify only the corrected fields plus lifecycle state, and rescan IAMAI. If other mismatches remain, leave them for their selected modules.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"entra.observe","channel":"entra","states":["reportOnly"],"format":"markdown","kind":"template"}
Leave the policy in **Report-only**. Review the Conditional Access report-only result for affected sign-ins, separate genuine MFA/readiness failures from expected exclusions, and keep the policy unchanged until IAMAI marks it ready to enforce.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"entra.enforce","channel":"entra","states":["readyToEnforce"],"format":"markdown","kind":"template"}
Re-open the exact resolved policy, confirm it is still Report-only and canonical, then change **Enable policy** to **On**. Test an ordinary user sign-in plus emergency access, then rescan IAMAI.
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

@@IAMAI-BEGIN {"id":"powershell.run","channel":"powershell","states":["missing","partial","reportOnly","readyToEnforce"],"format":"powershell","kind":"template"}
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

Review the proposed MFA-for-everyone target for {{tenant.displayName}}. Confirm it preserves the retained baseline's Intune Enrollment exclusion, canonical tenant exclusions, built-in MFA grant, no extra conditions, no session controls, and Report-only first. Do not redesign the baseline.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"ai.correct","channel":"aiInfo","states":["partial"],"format":"markdown","kind":"template"}
**Contains tenant context. Review before sharing with an external AI service.**

The resolved policy {{policy.current.id}} has these semantic mismatches: {{policy.current.semanticMismatches}}. Explain only the smallest corrections required to reach the pinned MFA-for-everyone target; do not add exclusions or change the baseline grant.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"ai.observe","channel":"aiInfo","states":["reportOnly"],"format":"markdown","kind":"template"}
**Contains tenant context. Review before sharing with an external AI service.**

Assess this Report-only evidence for {{tenant.displayName}} without proposing enforcement unless the known MFA/readiness failures are acceptably resolved: {{evidence.reportOnly}}.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"ai.enforce","channel":"aiInfo","states":["readyToEnforce"],"format":"markdown","kind":"template"}
**Contains tenant context. Review before sharing with an external AI service.**

Confirm the final pre-enforcement checks for the canonical MFA-for-everyone policy in {{tenant.displayName}}. Treat the stable tenant policy ID as update identity and keep the retained baseline semantics unchanged.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"ai.blocked","channel":"aiInfo","states":["blocked","needsDecision","sourceConflict"],"format":"markdown","kind":"template"}
**Contains tenant context. Review before sharing with an external AI service.**

Explain why implementation is not actionable yet. Use only these known blockers/decisions: {{dependencies.blockers}}. Do not invent a workaround or exception.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"ai.not-licensed","channel":"aiInfo","states":["notLicensed"],"format":"markdown","kind":"template"}
**Contains tenant context. Review before sharing with an external AI service.**

Explain that this Conditional Access implementation requires appropriate Microsoft Entra licensing and should remain non-actionable until licensing is resolved. Do not suggest weakening the baseline to force an implementation.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"email.rollout","channel":"email","states":["missing"],"format":"markdown","kind":"template"}
Subject: MFA rollout entering report-only validation

We are preparing the tenant-wide MFA policy in Report-only first. No enforcement change is being made yet. Please make sure anyone who still needs help registering or proving an MFA method uses the established support path before enforcement.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"email.enforce","channel":"email","states":["readyToEnforce"],"format":"markdown","kind":"template","audience":"help-desk"}
Subject: MFA enforcement is ready

The tenant-wide MFA policy has completed its validation stage and is ready to be enabled. After enforcement, ordinary sign-ins will require MFA. If someone cannot complete the prompt, use the documented registration/recovery workflow rather than adding a permanent exclusion.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"readiness.model","channel":"readiness","states":["missing","partial","reportOnly","readyToEnforce"],"format":"json-template","kind":"template"}
{"tiles":[{"id":"scope","label":"Affected people","result":{{json:people.affected.count}},"line":"All users are targeted except canonical tenant exclusions."},{"id":"readiness","label":"MFA readiness","result":{{json:evidence.mfaReadiness}},"line":"Readiness and proof drive rollout safety; they do not rewrite the baseline."},{"id":"state","label":"Policy state","result":{{json:policy.current.state}},"line":"Missing/Partial must reach canonical Report-only before enforcement."}],"baselineNote":"Retained pin excludes Microsoft Intune Enrollment and uses built-in MFA."}
@@IAMAI-END

@@IAMAI-BEGIN {"id":"troubleshooting.model","channel":"troubleshooting","states":["missing","partial","reportOnly","readyToEnforce","inPlace"],"format":"json","kind":"referenceOnly"}
{"scenarios":[{"id":"ordinary-user-cannot-mfa","classification":"documented","symptom":"A user in scope cannot satisfy MFA.","check":"Confirm the user's registered methods/readiness and the Conditional Access result before changing policy scope.","fix":"Use the approved registration/recovery path; do not add a permanent user exclusion.","then":"Retest and rescan IAMAI.","sources":["ms-mfa-all"]},{"id":"intune-enrollment-was-reincluded","classification":"derived","symptom":"The broad MFA policy now also targets Microsoft Intune Enrollment.","check":"Compare application exclusions to the retained baseline member.","fix":"Restore the pinned Intune Enrollment exclusion on the same policy ID; the separate enrollment step owns that flow.","then":"Re-read and rescan.","sources":["ms-ca-update"]},{"id":"duplicate-mfa-policy","classification":"derived","symptom":"A second broad MFA policy was created instead of correcting the resolved one.","check":"Compare stable policy identities and effective scope.","fix":"Return to the IAMAI-resolved policy identity; do not delete anything until overlap is reviewed.","then":"Resolve duplication deliberately and rescan.","sources":["ms-ca-policy"]},{"id":"report-only-failures","classification":"documented","symptom":"Report-only shows failures that would block users.","check":"Inspect affected sign-ins and distinguish missing MFA capability from expected exclusions.","fix":"Remediate readiness or the true canonical prerequisite; do not enforce until the evidence gate is satisfied.","then":"Continue observation and rescan.","sources":["ms-mfa-all"]}]}
@@IAMAI-END

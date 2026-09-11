@@IAMAI-BEGIN {"id":"entra.create","channel":"entra","states":["missing"],"format":"markdown","kind":"template"}
1. Open **Entra ID > Conditional Access > Policies > New policy**.
2. Name: **{{policy.target.displayName}}**.
3. Under **Users**, apply the exact IAMAI-resolved pinned built-in role set and canonical exclusions.
4. Target **All resources** and **all client apps**; configure no additional conditions.
5. Grant **Require authentication strength** and select the tenant-resolved baseline custom strength.
6. Leave session controls unconfigured.
7. Set **Enable policy: Report-only**, create, re-open, verify, and rescan.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"entra.correct-open","channel":"entra","states":["partial"],"format":"markdown","kind":"template"}
Open the exact resolved admin policy by stable tenant ID **{{policy.current.id}}**. Apply only selected mismatch modules.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"entra.correct-conditions","channel":"entra","states":["partial"],"format":"markdown","kind":"template"}
Replace only the policy assignments/conditions with the complete IAMAI-resolved target: exact pinned built-in directory roles, canonical exclusions, All resources, all client apps, and no extra conditions.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"entra.correct-grant","channel":"entra","states":["partial"],"format":"markdown","kind":"template"}
Set Grant to **Require authentication strength** and select the tenant-local baseline custom strength. Its ID is **{{authStrength.target.id}}**. Remove a non-canonical built-in MFA or different strength only from this policy.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"entra.correct-session","channel":"entra","states":["partial"],"format":"markdown","kind":"template"}
Remove session controls from this policy. Admin session duration and persistence are implemented by separate baseline steps.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"entra.correct-name","channel":"entra","states":["partial"],"format":"markdown","kind":"template"}
Rename the same stable policy to **{{policy.target.displayName}}**; never locate/update by display name alone.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"entra.correct-verify","channel":"entra","states":["partial"],"format":"markdown","kind":"template"}
Save and re-read the same policy by stable ID. Verify only the selected corrections plus lifecycle, then rescan IAMAI.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"entra.observe","channel":"entra","states":["reportOnly"],"format":"markdown","kind":"template"}
Leave the policy in Report-only and review sign-ins for every affected administrator. Any admin who cannot satisfy the baseline custom strength is a readiness blocker, not a reason to weaken the grant.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"entra.enforce","channel":"entra","states":["readyToEnforce"],"format":"markdown","kind":"template"}
Confirm the same policy remains canonical and Report-only, confirm affected admins have working accepted methods, then set **Enable policy: On**. Validate an intended admin plus emergency access and rescan.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"json.target-policy","channel":"json","states":["missing"],"format":"json-template","kind":"template"}
{"displayName":{{json:policy.target.displayName}},"state":"enabledForReportingButNotEnforced","conditions":{{json:policy.target.conditions}},"grantControls":{"operator":"OR","builtInControls":[],"customAuthenticationFactors":[],"termsOfUse":[],"authenticationStrength":{"id":{{json:authStrength.target.id}}}},"sessionControls":null}
@@IAMAI-END

@@IAMAI-BEGIN {"id":"json.correct-conditions","channel":"json","states":["partial"],"format":"json-template","kind":"template"}
{"conditions":{{json:policy.target.conditions}}}
@@IAMAI-END

@@IAMAI-BEGIN {"id":"json.correct-grant","channel":"json","states":["partial"],"format":"json-template","kind":"template"}
{"grantControls":{"operator":"OR","builtInControls":[],"customAuthenticationFactors":[],"termsOfUse":[],"authenticationStrength":{"id":{{json:authStrength.target.id}}}}}
@@IAMAI-END

@@IAMAI-BEGIN {"id":"json.correct-session","channel":"json","states":["partial"],"format":"json","kind":"template"}
{"sessionControls":null}
@@IAMAI-END

@@IAMAI-BEGIN {"id":"json.correct-name","channel":"json","states":["partial"],"format":"json-template","kind":"template"}
{"displayName":{{json:policy.target.displayName}}}
@@IAMAI-END

@@IAMAI-BEGIN {"id":"json.enforce","channel":"json","states":["readyToEnforce"],"format":"json","kind":"template"}
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

Review the proposed administrator policy for {{tenant.displayName}} against the retained pin. Confirm the exact role scope, tenant-local custom strength, no session controls, and Report-only-first rollout. Do not substitute Microsoft's generic built-in strength.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"ai.correct","channel":"aiInfo","states":["partial"],"format":"markdown","kind":"template"}
**Contains tenant context. Review before sharing with an external AI service.**

The resolved admin policy {{policy.current.id}} has these mismatches: {{policy.current.semanticMismatches}}. Explain only the smallest corrections needed to restore the pinned role scope/custom strength with no extra session controls.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"ai.observe","channel":"aiInfo","states":["reportOnly"],"format":"markdown","kind":"template"}
**Contains tenant context. Review before sharing with an external AI service.**

Review administrator Report-only results and readiness. Admins not ready: {{admins.notReady}}. Evidence: {{evidence.reportOnly}}. Treat credential readiness as the fix; do not weaken policy scope.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"ai.enforce","channel":"aiInfo","states":["readyToEnforce"],"format":"markdown","kind":"template"}
**Contains tenant context. Review before sharing with an external AI service.**

Confirm the final enforcement gate for {{tenant.displayName}}: stable policy identity, exact pinned built-in role set, tenant-local baseline strength, no extra conditions/session controls, and all affected admins ready.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"ai.blocked","channel":"aiInfo","states":["blocked","needsDecision","sourceConflict"],"format":"markdown","kind":"template"}
**Contains tenant context. Review before sharing with an external AI service.**

Explain why administrator phishing-resistant enforcement is not actionable yet using only: {{dependencies.blockers}}. Do not invent role exclusions or a weaker grant.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"ai.not-licensed","channel":"aiInfo","states":["notLicensed"],"format":"markdown","kind":"template"}
**Contains tenant context. Review before sharing with an external AI service.**

Explain the licensing prerequisite for Conditional Access/authentication-strength enforcement and keep the step non-actionable until licensing is resolved.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"email.rollout","channel":"email","states":["missing"],"format":"markdown","kind":"template"}
Subject: Admin strong-auth validation is starting

We are placing the administrator strong-auth policy in Report-only first. Before enforcement, every administrator in scope must have a working passkey/security key, Windows Hello for Business, supported certificate, or approved Temporary Access Pass path that satisfies the baseline strength.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"email.enforce","channel":"email","states":["readyToEnforce"],"format":"markdown","kind":"template"}
Subject: Administrator strong authentication is ready to enforce

The administrator policy has completed validation and is ready to be enabled. Admin sign-ins in scope will need one of the baseline's accepted strong methods. If an admin is blocked, use the documented recovery/readiness path rather than adding a permanent exception.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"readiness.model","channel":"readiness","states":["missing","partial","reportOnly","readyToEnforce"],"format":"json-template","kind":"template"}
{"tiles":[{"id":"admins","label":"Admins in scope","result":{{json:admins.affected.count}},"line":"Scope comes from the exact pinned built-in role template set."},{"id":"notReady","label":"Admins not ready","result":{{json:admins.notReady}},"line":"Credential readiness gates enforcement; it does not weaken the grant."},{"id":"state","label":"Policy state","result":{{json:policy.current.state}},"line":"Client rollout is Report-only first."}],"baselineStrength":"Modern MFA + TAP, resolved by tenant-local strength ID and exact allowed combinations."}
@@IAMAI-END

@@IAMAI-BEGIN {"id":"troubleshooting.model","channel":"troubleshooting","states":["missing","partial","reportOnly","readyToEnforce","inPlace"],"format":"json","kind":"referenceOnly"}
{"scenarios":[{"id":"admin-cannot-satisfy-strength","classification":"documented","symptom":"An intended administrator would be blocked by the strong-auth policy.","check":"Confirm the user has a method accepted by the baseline custom strength and can complete a strong sign-in.","fix":"Register/prove an accepted credential or use the approved TAP bootstrap path; do not add a permanent exclusion.","then":"Retest in Report-only and rescan.","sources":["ms-admin-phish"]},{"id":"wrong-strength-id","classification":"derived","symptom":"The policy references Jon's source-tenant strength ID or another tenant's ID.","check":"Resolve the local strength by exact baseline combinations and inspect the policy relationship.","fix":"Patch the same policy to the tenant-local strength ID.","then":"Re-read and rescan.","sources":["ms-auth-strength","ms-ca-update"]},{"id":"custom-role-not-covered","classification":"documented","symptom":"A privileged user with a custom or administrative-unit-scoped role is not affected by this role-targeted policy.","check":"Inspect the role type; Conditional Access directory-role assignment targets built-in roles.","fix":"Do not pretend this baseline member covers unsupported role types; surface the gap for separate product design if required.","then":"Keep the pinned policy unchanged.","sources":["ms-admin-phish","ms-ca-users"]},{"id":"session-control-crept-in","classification":"derived","symptom":"The admin strong-auth policy also carries sign-in frequency or persistence controls.","check":"Compare sessionControls to the pinned member.","fix":"Remove session controls from this policy; separate session steps own them.","then":"Re-read and rescan.","sources":["ms-ca-update"]}]}
@@IAMAI-END

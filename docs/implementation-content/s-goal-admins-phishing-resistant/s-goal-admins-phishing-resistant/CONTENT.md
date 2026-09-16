@@IAMAI-BEGIN {"id":"entra.create","channel":"entra","states":["missing"],"format":"markdown","kind":"template"}
1. Open **Entra ID > Conditional Access > Policies > New policy**.
2. Name: **{{policy.target.displayName}}**.
3. Under **Users**, include exactly the built-in directory roles resolved from the baseline, and apply the intended exclusions.
4. Target **All resources** and **all client apps**; configure no additional conditions.
5. Grant **Require authentication strength** and select the custom authentication strength resolved for this tenant.
6. Leave session controls unconfigured.
7. Set **Enable policy: Report-only**, create, re-open, verify, and rescan.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"entra.correct-open","channel":"entra","states":["partial"],"format":"markdown","kind":"template"}
This change removes {{policy.current.removedExclusions}} from the policy's exclusions. If the policy is On, it applies to them as soon as you save. [omit this line when unavailable]

This policy already exists. Correct only the settings below, which IAMAI found different from the baseline.

1. Go to Entra admin center → Conditional Access → Policies.
2. Open the policy named {{policy.current.displayName}} (ID: {{policy.current.id}}).
@@IAMAI-END

@@IAMAI-BEGIN {"id":"entra.correct-conditions","channel":"entra","states":["partial"],"format":"markdown","kind":"template"}
3. Users → Include → Directory roles: select exactly the built-in roles in the resolved target (the includeRoles list in the JSON output) and clear any role it does not list. Custom roles and administrative-unit-scoped role assignments are not covered by this selection.
4. Users → Exclude → Groups: add the exclusions group you confirmed in the Exclusions Group step. Remove any exclusion the resolved target does not list.
5. Target resources: All resources. Client apps: All. Remove any other condition.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"entra.correct-grant","channel":"entra","states":["partial"],"format":"markdown","kind":"template"}
Set Grant to **Require authentication strength** and select the custom strength resolved for this tenant. Its ID is **{{authStrength.target.id}}**. Remove built-in MFA or any other strength from this policy's grant. This strength also accepts a Temporary Access Pass; Microsoft's built-in Phishing-resistant MFA strength does not. Replacing that built-in strength with this one lets administrators sign in with a Temporary Access Pass where they could not before, so review that effect before you save.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"entra.correct-session","channel":"entra","states":["partial"],"format":"markdown","kind":"template"}
Remove session controls from this policy. Admin session duration and persistence are implemented by separate baseline steps.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"entra.correct-name","channel":"entra","states":["partial"],"format":"markdown","kind":"template"}
Rename the same policy (same policy ID) to **{{policy.target.displayName}}**. Find it by its policy ID, not by display name alone.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"entra.correct-verify","channel":"entra","states":["partial"],"format":"markdown","kind":"template"}
6. Save. Keep the policy's current state. If it is On, the changed rule can affect access after you save.
7. Rescan in IAMAI.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"entra.observe","channel":"entra","states":["reportOnly"],"format":"markdown","kind":"template"}
Keep the policy in Report-only while you review the evidence listed for this step. Review Report-only sign-in results for each affected administrator and check that each one can use a method the custom strength accepts. An admin who cannot is a readiness issue to fix, not a reason to weaken the grant. A Temporary Access Pass also satisfies this strength, but it is temporary: an admin relying on one still needs a lasting accepted method.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"entra.enforce","channel":"entra","states":["readyToEnforce"],"format":"markdown","kind":"template"}
Verify the same policy and its prerequisites: it is still Report-only, its roles, exclusions, grant and session settings match the intended target, and affected admins have working accepted methods. Then set **Enable policy: On**. Verify after the change: an affected admin can sign in with an accepted method, and an emergency access account can still sign in. Rescan in IAMAI.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"json.target-policy","channel":"json","states":["missing"],"format":"json-template","kind":"template","method":"POST","endpoint":"https://graph.microsoft.com/v1.0/identity/conditionalAccess/policies"}
{"displayName":{{json:policy.target.displayName}},"state":"enabledForReportingButNotEnforced","conditions":{{json:policy.target.conditions}},"grantControls":{"operator":"OR","builtInControls":[],"customAuthenticationFactors":[],"termsOfUse":[],"authenticationStrength":{"id":{{json:authStrength.target.id}}}},"sessionControls":null}
@@IAMAI-END

@@IAMAI-BEGIN {"id":"json.correct-conditions","channel":"json","states":["partial"],"format":"json-template","kind":"template","method":"PATCH","endpoint":"https://graph.microsoft.com/v1.0/identity/conditionalAccess/policies/{policy.current.id}"}
{"conditions":{{json:policy.target.conditions}}}
@@IAMAI-END

@@IAMAI-BEGIN {"id":"json.correct-grant","channel":"json","states":["partial"],"format":"json-template","kind":"template","method":"PATCH","endpoint":"https://graph.microsoft.com/v1.0/identity/conditionalAccess/policies/{policy.current.id}"}
{"grantControls":{"operator":"OR","builtInControls":[],"customAuthenticationFactors":[],"termsOfUse":[],"authenticationStrength":{"id":{{json:authStrength.target.id}}}}}
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

This state creates the administrator policy for {{tenant.displayName}} in Report-only. It targets the exact built-in directory roles in the baseline, with the intended exclusions, All resources and all client apps. It requires the tenant's custom authentication strength and has no session controls.

That strength accepts Windows Hello for Business, passkeys and FIDO2 security keys, certificate-based multifactor authentication and Temporary Access Pass. Passkeys and security keys reduce phishing risk, but the accepted set as a whole is not exclusively phishing-resistant because it includes Temporary Access Pass. Microsoft's generic administrator template uses the built-in Phishing-resistant MFA strength; this baseline keeps the custom strength.

Directory-role targeting does not reach custom roles or administrative-unit-scoped role assignments.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"ai.correct","channel":"aiInfo","states":["partial"],"format":"markdown","kind":"template"}
This policy requires administrators in the baseline's built-in directory roles to satisfy the tenant's custom authentication strength. That strength accepts Windows Hello for Business, passkeys and FIDO2 security keys, certificate-based multifactor authentication and Temporary Access Pass. Passkeys and security keys reduce phishing risk but do not make phishing impossible, and the accepted set is not exclusively phishing-resistant because it includes Temporary Access Pass. Microsoft's built-in Phishing-resistant MFA strength does not accept a Temporary Access Pass.

Unlike the "MFA for Everyone" policy, which accepts any registered MFA method, this policy limits which methods count. Whether admins have an accepted method registered is shown on MFA Readiness, and the Prepare Your Team for MFA step helps them register one. The policy has no session controls, so it does not by itself require a new prompt at every sign-in.

The correction changes only the settings IAMAI found different from the baseline: the role list and exclusions, grant, session controls or name.

Keep the policy's current state. If it is On, the changed rule can affect access after you save. An admin newly included by the corrected role list will then need an accepted method to sign in.

This change removes {{policy.current.removedExclusions}} from the policy's exclusions. If the policy is On, it applies to them as soon as you save. [omit this line when unavailable]
@@IAMAI-END

@@IAMAI-BEGIN {"id":"ai.observe","channel":"aiInfo","states":["reportOnly"],"format":"markdown","kind":"template"}

The administrator policy is in Report-only. Admins not ready: {{admins.notReady}}. Report-only evidence: {{evidence.reportOnly}}. An admin who cannot satisfy the strength needs an accepted method registered and tested; removing roles or weakening the grant would change the baseline. A Temporary Access Pass satisfies the strength but is temporary, so a sign-in with one does not show that the admin has a lasting accepted method.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"ai.enforce","channel":"aiInfo","states":["readyToEnforce"],"format":"markdown","kind":"template"}

The administrator policy for {{tenant.displayName}} is ready to enforce. Before it is set On, the same policy ID should still be Report-only with the exact baseline built-in role list, the tenant's custom strength, no extra conditions and no session controls, and each affected admin should have a working accepted method. After enforcement, an admin sign-in with an accepted method and an emergency access sign-in still need to be verified.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"ai.blocked","channel":"aiInfo","states":["blocked","needsDecision","sourceConflict"],"format":"markdown","kind":"template"}

The administrator authentication-strength policy cannot proceed yet. Blockers: {{dependencies.blockers}}. Resolving them should not add role exclusions or weaken the grant.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"ai.not-licensed","channel":"aiInfo","states":["notLicensed"],"format":"markdown","kind":"template"}

IAMAI did not find the licensing this step needs. Conditional Access and authentication strengths require Microsoft Entra ID P1 or higher. No policy change is available until licensing is resolved.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"email.rollout","channel":"email","states":["missing"],"format":"markdown","kind":"template","audience":"administrators-in-scope"}
Subject: Action needed: Require Phishing-Resistant MFA for Admins

We are preparing stronger authentication for admin access. Please test the approved method for your admin account and tell IT about any device or recovery issue before the change.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"email.enforce","channel":"email","states":["readyToEnforce"],"format":"markdown","kind":"template","audience":"administrators-in-scope"}
Subject: Action needed: Require Phishing-Resistant MFA for Admins

We are preparing stronger authentication for admin access. Please test the approved method for your admin account and tell IT about any device or recovery issue before the change.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"readiness.model","channel":"readiness","states":["missing","partial","reportOnly","readyToEnforce"],"format":"json-template","kind":"template"}
{"tiles":[{"id":"admins","label":"Admins in scope","result":{{json:admins.affected.count}},"line":"Review the selected built-in roles and each affected admin's ability to use an accepted method. The target strength also permits Temporary Access Pass."},{"id":"notReady","label":"Admins not ready","result":{{json:admins.notReady}},"line":"Check that each affected admin can satisfy the selected authentication strength."},{"id":"state","label":"Policy state","result":{{json:policy.current.state}},"line":"Client rollout is Report-only first."}],"baselineStrength":"Modern MFA + TAP, resolved by tenant-local strength ID and exact allowed combinations."}
@@IAMAI-END

@@IAMAI-BEGIN {"id":"troubleshooting.model","channel":"troubleshooting","states":["missing","partial","reportOnly","readyToEnforce","inPlace"],"format":"json","kind":"referenceOnly"}
{"scenarios":[{"id":"admin-cannot-satisfy-strength","classification":"documented","symptom":"An intended administrator would be blocked by the strong-auth policy.","check":"Confirm the user has a method accepted by the baseline custom strength and can complete a strong sign-in.","fix":"Register/prove an accepted credential or use the approved TAP bootstrap path; do not add a permanent exclusion.","then":"Retest in Report-only and rescan.","sources":["ms-admin-phish"]},{"id":"wrong-strength-id","classification":"derived","symptom":"The policy references the baseline source tenant's strength ID or another tenant's ID.","check":"Resolve the local strength by exact baseline combinations and inspect the policy relationship.","fix":"Patch the same policy to the tenant-local strength ID.","then":"Re-read and rescan.","sources":["ms-auth-strength","ms-ca-update"]},{"id":"custom-role-not-covered","classification":"documented","symptom":"A privileged user with a custom or administrative-unit-scoped role is not affected by this role-targeted policy.","check":"Inspect the role type; Conditional Access directory-role assignment targets built-in roles.","fix":"This policy does not cover those role types. Record the gap and address it with a separate reviewed control if needed.","then":"Keep the baseline policy unchanged.","sources":["ms-admin-phish","ms-ca-users"]},{"id":"session-control-crept-in","classification":"derived","symptom":"The admin strong-auth policy also carries sign-in frequency or persistence controls.","check":"Compare sessionControls with the baseline member.","fix":"Remove session controls from this policy; separate session steps own them.","then":"Re-read and rescan.","sources":["ms-ca-update"]}]}
@@IAMAI-END

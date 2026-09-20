@@IAMAI-BEGIN {"id":"entra.create","channel":"entra","states":["missing"],"format":"markdown","kind":"template"}
1. Open **Entra ID > Conditional Access > Policies > New policy**.
2. Name: **{{policy.target.displayName}}**.
3. Apply the intended conditions IAMAI resolved for this tenant: **Users: All users** with the resolved exclusions; **Target resources: All resources**; **Network** (older portal: **Conditions > Locations**): set **Configure** to **Yes**, then include **Any network or location** and exclude the approved countries named location. Left at **No** the network condition is not configured, and Microsoft's rule is that a policy applies to all locations by default. Do not use IDs from another tenant, and do not widen or narrow the population. The location list applies to everyone the policy covers.
4. Grant: **Block access**. Leave session controls unconfigured.
5. Set **Enable policy: Report-only** and create it. It will not enforce its access rule until you enable it.
6. Reopen the policy, compare its settings with the intended target shown in IAMAI, and rescan.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"entra.correct-conditions","channel":"entra","states":["partial"],"format":"markdown","kind":"template"}
Open the existing policy with ID **{{policy.current.id}}**; do not create a replacement policy. Keep the policy's current state. If it is On, the changed rule can affect access after you save. Set its conditions to the intended target: **Users: All users** with the resolved exclusions; **Target resources: All resources**; **Network** (older portal: **Conditions > Locations**): set **Configure** to **Yes**, then include **Any network or location** and exclude the approved countries named location. The location list applies to everyone the policy covers.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"entra.correct-grant","channel":"entra","states":["partial"],"format":"markdown","kind":"template"}
Open **{{policy.current.id}}**. Keep the policy's current state. If it is On, the changed rule can affect access after you save. Set Grant to **Block access**, as the intended target specifies, and remove any other grant control.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"entra.correct-session","channel":"entra","states":["partial"],"format":"markdown","kind":"template"}
Open **{{policy.current.id}}**. Keep the policy's current state. If it is On, the changed rule can affect access after you save. Remove all session controls; the intended target for this policy has none.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"entra.correct-name","channel":"entra","states":["partial"],"format":"markdown","kind":"template"}
Rename the same policy to **{{policy.target.displayName}}** only when the name is the difference. IAMAI matches the policy by its ID, not its display name.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"entra.correct-verify","channel":"entra","states":["partial"],"format":"markdown","kind":"template"}
Save. Reopen the same policy ID, compare its settings with the intended target, and rescan. The policy keeps the state it had.

This change removes {{policy.current.removedExclusions}} from the policy's exclusions. If the policy is On, it applies to them as soon as you save. [omit this line when unavailable]
@@IAMAI-END

@@IAMAI-BEGIN {"id":"entra.observe","channel":"entra","states":["reportOnly"],"format":"markdown","kind":"template"}
Keep the policy in Report-only while you review the evidence listed for this step. Review the sign-ins the policy would block, including VPN, proxy and mobile-network routes, and check saved travel and partner decisions. Country is worked out from the sign-in's network address, not the person's physical location. No would-be blocks in the available records does not prove there are no legitimate sign-ins from other countries.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"entra.enforce","channel":"entra","states":["readyToEnforce"],"format":"markdown","kind":"template"}
Verify the same policy and its prerequisites, set it to On, then complete the checks below and rescan.

- Reopen the policy by its ID. Confirm it is still **Report-only**, its settings match the intended target, and any approved travel is in the approved countries named location.
- Change **Enable policy** to **On** and save.
- Verify after the change: a sign-in from an approved country still works, and emergency access still works.
- Rescan in IAMAI.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"json.target-policy","channel":"json","states":["missing"],"format":"json-template","kind":"template","method":"POST","endpoint":"https://graph.microsoft.com/v1.0/identity/conditionalAccess/policies"}
{"displayName":{{json:policy.target.displayName}},"state":"enabledForReportingButNotEnforced","conditions":{{json:policy.target.conditions}},"grantControls":{{json:policy.target.grantControls}},"sessionControls":{{json:policy.target.sessionControls}}}
@@IAMAI-END

@@IAMAI-BEGIN {"id":"json.correct-conditions","channel":"json","states":["partial"],"format":"json-template","kind":"template","method":"PATCH","endpoint":"https://graph.microsoft.com/v1.0/identity/conditionalAccess/policies/{policy.current.id}"}
{"conditions":{{json:policy.target.conditions}}}
@@IAMAI-END

@@IAMAI-BEGIN {"id":"json.correct-grant","channel":"json","states":["partial"],"format":"json-template","kind":"template","method":"PATCH","endpoint":"https://graph.microsoft.com/v1.0/identity/conditionalAccess/policies/{policy.current.id}"}
{"grantControls":{{json:policy.target.grantControls}}}
@@IAMAI-END

@@IAMAI-BEGIN {"id":"json.correct-session","channel":"json","states":["partial"],"format":"json-template","kind":"template","method":"PATCH","endpoint":"https://graph.microsoft.com/v1.0/identity/conditionalAccess/policies/{policy.current.id}"}
{"sessionControls":{{json:policy.target.sessionControls}}}
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
function IG($m,$u,$b=$null){if($null -eq $b){return Invoke-MgGraphRequest -Method $m -Uri $u -OutputType PSObject};return Invoke-MgGraphRequest -Method $m -Uri $u -Body ($b|ConvertTo-Json -Depth 80) -ContentType 'application/json' -OutputType PSObject}
function Project($actual,$target){
 if($null -eq $target){return $actual}
 if($target -is [string] -or $target -is [bool] -or $target -is [int] -or $target -is [long] -or $target -is [double]){return $actual}
 if($target -is [System.Collections.IEnumerable] -and -not ($target -is [string])){return @($actual)}
 $h=[ordered]@{}; foreach($p in $target.PSObject.Properties){$h[$p.Name]=Project $actual.($p.Name) $p.Value}; return [pscustomobject]$h
}
function Norm($v){
 if($null -eq $v){return $null}
 if($v -is [string] -or $v -is [bool] -or $v -is [int] -or $v -is [long] -or $v -is [double]){return $v}
 if($v -is [System.Collections.IEnumerable] -and -not ($v -is [string])){$a=@($v|ForEach-Object {Norm $_});return @($a|Sort-Object {$_|ConvertTo-Json -Depth 80 -Compress})}
 $h=[ordered]@{};foreach($p in ($v.PSObject.Properties.Name|Sort-Object)){$h[$p]=Norm $v.$p};return [pscustomobject]$h
}
function Same($actual,$target){$a=Norm (Project $actual $target);$t=Norm $target;return (($a|ConvertTo-Json -Depth 80 -Compress) -eq ($t|ConvertTo-Json -Depth 80 -Compress))}
$target=$TargetPolicyJson|ConvertFrom-Json
if(-not $target.displayName -or $null -eq $target.conditions){throw 'TargetPolicyJson is incomplete.'}
if($Mode -eq 'Create'){
 $body=[ordered]@{displayName=$target.displayName;state='enabledForReportingButNotEnforced';conditions=$target.conditions;grantControls=$target.grantControls;sessionControls=$target.sessionControls}
 $created=IG POST "$G/identity/conditionalAccess/policies" $body; $PolicyId=[string]$created.id; Write-Host "Created $PolicyId in Report-only."
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
[pscustomobject]@{PolicyId=$actual.id;DisplayName=$actual.displayName;State=$actual.state;NameCanonical=([string]$actual.displayName -eq [string]$target.displayName);ConditionsCanonical=(Same $actual.conditions $target.conditions);GrantCanonical=(Same $actual.grantControls $target.grantControls);SessionCanonical=(Same $actual.sessionControls $target.sessionControls)}
@@IAMAI-END

@@IAMAI-BEGIN {"id":"ai.create","channel":"aiInfo","states":["missing"],"format":"markdown","kind":"template"}

IAMAI did not find **Block Sign-ins From Countries Not Allowed** in {{tenant.displayName}}. The next action is to create it in Report-only. It blocks sign-ins to all resources from any location except the approved countries named location, for all users except the resolved exclusions. Country is inferred from the sign-in's IP address, so VPN, proxy and mobile-network routes can place a legitimate sign-in in another country. Travel is handled by a dated change to the approved countries list, not by excluding a person.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"ai.correct","channel":"aiInfo","states":["partial"],"format":"markdown","kind":"template"}

IAMAI found policy {{policy.current.id}} for **Block Sign-ins From Countries Not Allowed**, but it differs from the intended target: {{policy.current.semanticMismatches}}. The next action is to correct those settings on the same policy ID, not to create a replacement. The intended target blocks sign-ins from any location except the approved countries named location, for all users except the resolved exclusions. Keep the policy's current state. If it is On, the changed rule can affect access after you save.

This change removes {{policy.current.removedExclusions}} from the policy's exclusions. If the policy is On, it applies to them as soon as you save. [omit this line when unavailable]
@@IAMAI-END

@@IAMAI-BEGIN {"id":"ai.observe","channel":"aiInfo","states":["reportOnly"],"format":"markdown","kind":"template"}

**Block Sign-ins From Countries Not Allowed** is in Report-only in {{tenant.displayName}}. Report-only evidence: {{evidence.reportOnly}}. Would-be blocks can include legitimate travel, VPN exits and mobile networks that appear in another country. No would-be blocks in the available records does not prove there are no legitimate sign-ins from other countries.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"ai.enforce","channel":"aiInfo","states":["readyToEnforce"],"format":"markdown","kind":"template"}

**Block Sign-ins From Countries Not Allowed** is in Report-only in {{tenant.displayName}}, and the next action is enforcement. Before setting it to On, confirm the same policy ID still matches the intended target, would-be blocks from the observation period have been reviewed, approved travel is in the approved countries list, and emergency access remains available. Once On, sign-ins from outside the approved countries are blocked for everyone the policy covers.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"ai.blocked","channel":"aiInfo","states":["blocked","needsDecision","sourceConflict"],"format":"markdown","kind":"template"}

**Block Sign-ins From Countries Not Allowed** cannot proceed yet. Known blockers and decisions: {{dependencies.blockers}}. Resolve these before creating or changing the policy.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"ai.not-licensed","channel":"aiInfo","states":["notLicensed"],"format":"markdown","kind":"template"}

State: **Block Sign-ins From Countries Not Allowed** needs the Microsoft Entra ID P1 or higher licensing Conditional Access policies require, and this scan did not confirm it for {{tenant.displayName}}. A product bundle name alone does not confirm the service plans this step needs. No implementation is offered until licensing is resolved; the licensing gap does not change the baseline goal.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"email.rollout","channel":"email","states":["missing"],"format":"markdown","kind":"template","audience":"affected-users"}
Subject: Action needed: Block Sign-ins From Countries Not Allowed

Hi,

Please notify IT before working from a country not already approved. Include your dates and any VPN you expect to use so we can check access before departure.

{{signature}}
@@IAMAI-END

@@IAMAI-BEGIN {"id":"email.enforce","channel":"email","states":["readyToEnforce"],"format":"markdown","kind":"template","audience":"affected-users"}
Subject: Action needed: Block Sign-ins From Countries Not Allowed

Hi,

Please notify IT before working from a country not already approved. Include your dates and any VPN you expect to use so we can check access before departure.

{{signature}}
@@IAMAI-END

@@IAMAI-BEGIN {"id":"readiness.model","channel":"readiness","states":["missing","partial","reportOnly","readyToEnforce","inPlace","blocked","needsDecision"],"format":"markdown","kind":"template"}
Review sign-ins outside the approved list, including VPN and mobile-network locations, before enforcement. Ready only when the approved countries named location exists, the intended exclusions and any partner decision are resolved, and each legitimate sign-in the policy would block has been addressed, for example by an approved country or a dated travel change.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"troubleshooting.model","channel":"troubleshooting","states":["missing","partial","reportOnly","readyToEnforce","inPlace"],"format":"markdown","kind":"template"}
For an unexpected block, inspect the sign-in's IP address, the country it resolved to, and any VPN, proxy or mobile-network route first. Country-by-IP does not prove where the person is. If the travel is legitimate, update the approved countries named location for the approved trip dates and remove the change when the trip ends; it does not expire on its own. Never add a named-user policy exclusion.
@@IAMAI-END

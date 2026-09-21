@@IAMAI-BEGIN {"id":"entra.create","channel":"entra","states":["missing"],"format":"markdown","kind":"template"}
1. Open **Entra ID > Conditional Access > Policies > New policy**.
2. Name: **{{policy.target.displayName}}**.
3. Configure this intended scope: **Target resources > User actions > Register security information**. Apply the IAMAI-resolved users and exclusions, and set Conditions only as IAMAI resolved them.
   Conditions > Locations: set **Configure** to **Yes**, then **{{policy.target.locationWords}}**. Left at **No**, the condition matches every location, including the network you meant to leave out. [omit this line when unavailable]
4. Grant: **{{policy.target.grantWords}}**, exactly as IAMAI resolved the target. Do not add or swap a control.
5. Leave session controls unconfigured; the intended target has none.
6. Set **Enable policy: Report-only** and create it. It will not enforce its access rule until you enable it. Do not choose **On** here: a policy created On applies to everyone it covers from the moment you save, before anyone has seen who it would have stopped — the failure this plan exists to prevent. The script for this step can only create in Report-only.
7. Re-open the created policy, compare it with the IAMAI target, then rescan.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"entra.correct-conditions","channel":"entra","states":["partial"],"format":"markdown","kind":"template"}
Open the policy with ID **{{policy.current.id}}**. Keep the policy's current state. If it is On, the changed rule can affect access after you save. Set the users and conditions to the intended target: **Target resources > User actions > Register security information**, the IAMAI-resolved users and exclusions, and the location rule below. Correct this policy rather than creating a replacement.
Conditions > Locations: set **Configure** to **Yes**, then **{{policy.target.locationWords}}**. Left at **No**, the condition matches every location, including the network you meant to leave out. [omit this line when unavailable]
@@IAMAI-END

@@IAMAI-BEGIN {"id":"entra.correct-grant","channel":"entra","states":["partial"],"format":"markdown","kind":"template"}
Open the policy with ID **{{policy.current.id}}**. Keep the policy's current state. If it is On, the changed rule can affect access after you save. Replace the complete Grant controls with the intended grant IAMAI resolved, and clear any other control. Do not keep a different control because it already exists; this step follows the resolved baseline target.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"entra.correct-session","channel":"entra","states":["partial"],"format":"markdown","kind":"template"}
Open the policy with ID **{{policy.current.id}}**. Keep the policy's current state. If it is On, the changed rule can affect access after you save. Under **Session**, clear every control; the intended target has none. Session behavior belongs to separate baseline steps.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"entra.correct-name","channel":"entra","states":["partial"],"format":"markdown","kind":"template"}
Rename the same policy to **{{policy.target.displayName}}**. The display name does not identify the policy for updates; IAMAI uses the same policy ID.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"entra.correct-verify","channel":"entra","states":["partial"],"format":"markdown","kind":"template"}
Re-open the same policy by its ID, verify the corrected fields against the intended target, and rescan IAMAI. Keep the policy's current state. If it is On, the changed rule can affect access after you save. Verify after the change: a controlled test account can register a method through the intended route; reading the settings back does not show how registration behaves.

This change removes {{policy.current.removedExclusions}} from the policy's exclusions. If the policy is On, it applies to them as soon as you save. [omit this line when unavailable]
@@IAMAI-END

@@IAMAI-BEGIN {"id":"entra.observe","channel":"entra","states":["reportOnly"],"format":"markdown","kind":"template"}
Keep the policy in **Report-only** while you review the evidence listed for this step. Check its settings by reading the policy back by the same policy ID; that confirms the configuration, not the registration experience. Report-only results may not show sign-in method registration attempts, so validate the actual registration steps with a controlled test account before enforcement. With a trusted-network block, test registration through the allowed route; with the MFA fallback, test that users can satisfy MFA or use the approved recovery process. Include Windows Hello for Business and macOS Platform SSO registration where the tenant uses them.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"entra.enforce","channel":"entra","states":["readyToEnforce"],"format":"markdown","kind":"template"}
Re-open the policy by the same policy ID. Confirm it is still **Report-only**, its conditions, grant and session controls match the intended target, and the controlled registration test is done. Do not turn it on unless all of this is true now. The required report-only period is complete, with no failures on this policy in the sign-in records. The policy is still Report-only and its settings still match the intended target, exclusions included — the script for this step refuses to enforce a policy that is not. Emergency access is prepared and tested. If any one of them is not true, leave the policy in Report-only. Change **Enable policy** to **On** and save. Verify after the change: a test account can register a method through the intended route, the approved recovery process still works, and emergency access still works. Then rescan IAMAI.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"json.target-policy","channel":"json","states":["missing"],"format":"json-template","kind":"template","method":"POST","endpoint":"https://graph.microsoft.com/v1.0/identity/conditionalAccess/policies"}
{"displayName":{{json:policy.target.displayName}},"state":"enabledForReportingButNotEnforced","conditions":{{json:policy.target.conditions}},"grantControls":{{json:policy.target.grantControls}},"sessionControls":null}
@@IAMAI-END

@@IAMAI-BEGIN {"id":"json.correct-conditions","channel":"json","states":["partial"],"format":"json-template","kind":"template","method":"PATCH","endpoint":"https://graph.microsoft.com/v1.0/identity/conditionalAccess/policies/{policy.current.id}"}
{"conditions":{{json:policy.target.conditions}}}
@@IAMAI-END

@@IAMAI-BEGIN {"id":"json.correct-grant","channel":"json","states":["partial"],"format":"json-template","kind":"template","method":"PATCH","endpoint":"https://graph.microsoft.com/v1.0/identity/conditionalAccess/policies/{policy.current.id}"}
{"grantControls":{{json:policy.target.grantControls}}}
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

State: **Protect Sign-in Method Registration** does not exist in {{tenant.displayName}} yet. The next action creates it in Report-only for the Register security information user action, with the IAMAI-resolved users, exclusions, location rule and grant. It does not enforce until it is enabled.

Where the tenant has a trusted network, the baseline blocks registration outside trusted locations. Where no trusted network applies, the fallback requires MFA for registration instead of blocking it. Report-only results may not show registration attempts, so the registration workflow needs a controlled test.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"ai.correct","channel":"aiInfo","states":["partial"],"format":"markdown","kind":"template"}

State: policy {{policy.current.id}} exists, but these settings differ from the intended target for **Protect Sign-in Method Registration**: {{policy.current.semanticMismatches}}. The correction changes only those settings, on the same policy ID.

Keep the policy's current state. If it is On, the changed rule can affect access after you save.

This change removes {{policy.current.removedExclusions}} from the policy's exclusions. If the policy is On, it applies to them as soon as you save. [omit this line when unavailable]
@@IAMAI-END

@@IAMAI-BEGIN {"id":"ai.observe","channel":"aiInfo","states":["reportOnly"],"format":"markdown","kind":"template"}

State: **Protect Sign-in Method Registration** is in Report-only in {{tenant.displayName}}. Report-only evidence: {{evidence.reportOnly}}.

Report-only results may not show registration attempts: treat a settings read-back as a check of the configuration and a controlled registration test as the check of the workflow, and say which of the two the available evidence supports.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"ai.enforce","channel":"aiInfo","states":["readyToEnforce"],"format":"markdown","kind":"template"}

State: **Protect Sign-in Method Registration** is in Report-only in {{tenant.displayName}} and the next action is to enable it. Before setting it to On, the same policy ID should still be Report-only, its settings should match the intended target, and a controlled registration test should have used the intended route. From July 6, 2026, Microsoft also applies this user action during Windows Hello for Business and macOS Platform SSO credential registration; include those workflows where the tenant uses them.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"ai.blocked","channel":"aiInfo","states":["blocked","needsDecision","sourceConflict"],"format":"markdown","kind":"template"}

State: **Protect Sign-in Method Registration** cannot proceed yet. Known blockers or decisions: {{dependencies.blockers}}. These must be resolved before the policy is created or changed; an added exclusion does not resolve them.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"ai.not-licensed","channel":"aiInfo","states":["notLicensed"],"format":"markdown","kind":"template"}

State: **Protect Sign-in Method Registration** needs Microsoft Entra Conditional Access licensing that this scan did not confirm. No implementation is offered until licensing is resolved. The licensing gap does not change the baseline goal.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"email.rollout","channel":"email","states":["missing"],"format":"markdown","kind":"template","audience":"affected-users"}
Subject: Planned change: Protect Sign-in Method Registration

Hi,

We are preparing a change to how sign-in methods are registered. Contact IT before registering from an unfamiliar location or if you no longer have a working sign-in method.

{{signature}}
@@IAMAI-END

@@IAMAI-BEGIN {"id":"email.enforce","channel":"email","states":["readyToEnforce"],"format":"markdown","kind":"template","audience":"affected-users"}
Subject: Planned change: Protect Sign-in Method Registration

Hi,

We are preparing a change to how sign-in methods are registered. Contact IT before registering from an unfamiliar location or if you no longer have a working sign-in method.

{{signature}}
@@IAMAI-END

@@IAMAI-BEGIN {"id":"readiness.model","channel":"readiness","states":["missing","partial","reportOnly","readyToEnforce","inPlace","blocked","needsDecision"],"format":"markdown","kind":"template"}
Check the resolved location rule and grant. Verify settings separately from a controlled registration test. Include affected Windows Hello for Business and macOS Platform SSO registration workflows, which this user action covers from July 6, 2026.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"troubleshooting.model","channel":"troubleshooting","states":["missing","partial","reportOnly","readyToEnforce","inPlace"],"format":"markdown","kind":"template"}
If registration fails, inspect Conditional Access results for the **Register security information** user action, the network/trusted-location match, and the bootstrap method used. For WHfB/macOS Platform SSO failures, remember that these credential-registration flows became subject to registration-targeting CA policies beginning July 6, 2026.
@@IAMAI-END

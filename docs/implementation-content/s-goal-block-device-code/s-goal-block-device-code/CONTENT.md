@@IAMAI-BEGIN {"id":"entra.create","channel":"entra","states":["missing"],"format":"markdown","kind":"template"}
1. Open **Entra ID > Conditional Access > Policies > New policy**.
2. Name: **{{policy.target.displayName}}**.
3. Configure exactly this intended scope: **Users: All users** with the exclusions IAMAI resolved; **Target resources: All resources**; **Conditions > Authentication flows**: set **Configure** to **Yes**, then select **Device code flow**. **Client apps** remains All; Authentication flows is not inside Client apps.
   Two consequences to know before you create it: a session that used this flow stays tracked, so later requests in it are blocked too and a device can be signed out; and because the target is **All resources**, the policy also reaches **Device Registration Service**, which you exclude if this tenant registers devices by device code.
4. Grant/access control: **Block access**.
5. Leave session controls unconfigured; the intended target has none.
6. Set **Enable policy: Report-only** and create it. It will not enforce its access rule until you enable it. Do not choose **On** here: a policy created On applies to everyone it covers from the moment you save, before anyone has seen who it would have stopped — the failure this plan exists to prevent. The script for this step can only create in Report-only.
7. Reopen the created policy, compare it with the intended target shown in IAMAI, then rescan.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"entra.correct-conditions","channel":"entra","states":["partial"],"format":"markdown","kind":"template"}
This policy already exists. The correction sets its conditions to the intended target, including the exclusions group.

1. Go to Entra admin center → Conditional Access → Policies.
2. Open the policy named {{policy.current.displayName}} (ID: {{policy.current.id}}).
3. Users → Exclude → Groups → add the exclusions group you confirmed in Configure Emergency Exclusions.
4. Check the other settings and set any that differ from the baseline: Target resources = All resources. Conditions → Authentication flows → Configure: Yes, then Device code flow. Client apps remains All. Grant → Block access.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"entra.correct-grant","channel":"entra","states":["partial"],"format":"markdown","kind":"template"}
Open **{{policy.current.id}}**. Keep the policy's current state. If it is On, the changed rule can affect access after you save. Set Grant to **Block access**, as the intended target specifies. Do not keep a different grant control because it already exists; this step follows the baseline target.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"entra.correct-session","channel":"entra","states":["partial"],"format":"markdown","kind":"template"}
Open **{{policy.current.id}}**. Keep the policy's current state. If it is On, the changed rule can affect access after you save. Remove all session controls from this policy; the intended target has none, and session behavior belongs to separate baseline steps.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"entra.correct-name","channel":"entra","states":["partial"],"format":"markdown","kind":"template"}
Rename the same policy to **{{policy.target.displayName}}**. IAMAI matches the policy by its ID, not its display name.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"entra.correct-verify","channel":"entra","states":["partial"],"format":"markdown","kind":"template"}
5. Save. Leave **Enable policy** as it is. If the policy is On, the changed rule can affect access after you save.
   This change removes {{policy.current.removedExclusions}} from the policy's exclusions. If the policy is On, it applies to them as soon as you save. [omit this line when unavailable]
6. Rescan in IAMAI to confirm the correction.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"entra.observe","channel":"entra","states":["reportOnly"],"format":"markdown","kind":"template"}
Keep the policy in Report-only while you review the evidence listed for this step. Review device-code use, including command-line tools, shared and meeting-room devices, and enrollment workflows. On each sign-in, check both **Authentication protocol** and **Original transfer method**: a session that began with device code can still be tracked after the original event. Microsoft documents that an authentication-flows policy targeting All resources also applies to Device Registration Service, and some Teams devices depend on device code flow.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"entra.enforce","channel":"entra","states":["readyToEnforce"],"format":"markdown","kind":"template"}
Verify the same policy and its prerequisites, set it to On, then complete the checks below and rescan.

- Reopen the policy by its ID. Confirm it is still **Report-only**, its conditions, grant and session controls match the intended target, and required device-code workflows have a tested alternative or separately approved handling.
- Do not turn it on unless all of these are true now:
  The required report-only period is complete, with no failures on this policy in the sign-in records.
  The policy is still Report-only and its settings still match the intended target, exclusions included — the script for this step refuses to enforce a policy that is not.
  Emergency access is prepared and tested.
  If any one of them is not true, leave the policy in Report-only.
- Change **Enable policy** to **On** and save.
- Verify after the change: required tools and devices sign in through their alternative path, and emergency access still works.
- Rescan in IAMAI.
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
 $body=[ordered]@{displayName=$target.displayName;description=$target.description;state='enabledForReportingButNotEnforced';conditions=$target.conditions;grantControls=$target.grantControls;sessionControls=$target.sessionControls}
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

IAMAI did not find **Block Device Code Sign-in** in {{tenant.displayName}}.
Create it in Report-only: it blocks device code sign-in for All users except {{exclusions.group.displayName}}, across all resources.
Because it targets All resources, it also applies to Device Registration Service, and some Teams devices, command-line tools and enrollment workflows use device code legitimately.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"ai.correct","channel":"aiInfo","states":["partial"],"format":"markdown","kind":"template"}

IAMAI found {{policy.current.displayName}} for **Block Device Code Sign-in**, and {{policy.current.difference}}.
Correct it on the same policy: it blocks device code sign-in for All users except {{exclusions.group.displayName}}, across all resources.
Keep the policy's current state. If it is On, the changed rule can affect access after you save.

This change removes {{policy.current.removedExclusions}} from the policy's exclusions. If the policy is On, it applies to them as soon as you save. [omit this line when unavailable]
@@IAMAI-END

@@IAMAI-BEGIN {"id":"ai.observe","channel":"aiInfo","states":["reportOnly"],"format":"markdown","kind":"template"}

**Block Device Code Sign-in** is in Report-only in {{tenant.displayName}}. Report-only evidence: {{evidence.reportOnly}}. Review both direct device-code sign-ins and sessions tracked by Original transfer method, including tools, shared devices, Teams devices and enrollment workflows.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"ai.enforce","channel":"aiInfo","states":["readyToEnforce"],"format":"markdown","kind":"template"}

**Block Device Code Sign-in** is in Report-only in {{tenant.displayName}}, and the next action is enforcement. Before setting it to On, confirm the same policy ID still matches the intended target, direct and transferred device-code activity has been reviewed, Teams-device and Device Registration Service impact is understood, and required workflows have a tested alternative or separately approved handling. Once On, device code sign-in is blocked for everyone the policy covers.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"ai.blocked","channel":"aiInfo","states":["blocked","needsDecision","sourceConflict"],"format":"markdown","kind":"template"}

**Block Device Code Sign-in** cannot proceed yet. Known blockers and decisions: {{dependencies.blockers}}. Resolve these before creating or changing the policy.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"ai.not-licensed","channel":"aiInfo","states":["notLicensed"],"format":"markdown","kind":"template"}

State: **Block Device Code Sign-in** needs the Microsoft Entra ID P1 or higher licensing Conditional Access policies require, and this scan did not confirm it for {{tenant.displayName}}. A product bundle name alone does not confirm the service plans this step needs. No implementation is offered until licensing is resolved; the licensing gap does not change the baseline goal.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"email.rollout","channel":"email","states":["missing"],"format":"markdown","kind":"template","audience":"technical-owners"}
Subject: Action needed: Block Device Code Sign-in

Hi,

If you use a tool or device that asks you to enter a code on another device to sign in, please tell IT before the change. We will check whether it needs an alternative sign-in method.

{{signature}}
@@IAMAI-END

@@IAMAI-BEGIN {"id":"email.enforce","channel":"email","states":["readyToEnforce"],"format":"markdown","kind":"template","audience":"technical-owners"}
Subject: Action needed: Block Device Code Sign-in

Hi,

If you use a tool or device that asks you to enter a code on another device to sign in, please tell IT before the change. We will check whether it needs an alternative sign-in method.

{{signature}}
@@IAMAI-END

@@IAMAI-BEGIN {"id":"readiness.model","channel":"readiness","states":["missing","partial","reportOnly","readyToEnforce","inPlace","blocked","needsDecision"],"format":"markdown","kind":"template"}
Review device-code use, including tools, shared devices and enrollment workflows, before enforcement. Ready only when direct device-code activity and protocol-tracked activity have been reviewed, Teams, shared-device and device-registration dependencies are understood, the intended exclusions are resolved, and no legitimate workflow remains unresolved.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"troubleshooting.model","channel":"troubleshooting","states":["missing","partial","reportOnly","readyToEnforce","inPlace"],"format":"markdown","kind":"template"}
For an unexpected block, inspect both **Authentication protocol** and **Original transfer method**. A session can remain protocol-tracked after the original device-code event. Check Teams device registration/reprovisioning and Device Registration Service impact before changing policy scope.
@@IAMAI-END

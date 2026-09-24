@@IAMAI-BEGIN {"id":"entra.create","channel":"entra","states":["missing"],"format":"markdown","kind":"template"}
1. Open **Entra ID > Conditional Access > Policies > New policy**.
2. Name: **{{policy.target.displayName}}**.
3. Configure exactly this intended scope: **Users: All users** with the exclusions IAMAI resolved; **Target resources: All resources**; **Conditions > Client apps**: set **Configure** to **Yes**, then check only **Exchange ActiveSync clients** and **Other clients**. Left at **No**, the condition matches every client app, modern ones included.
4. Grant/access control: **Block access**.
5. Leave session controls unconfigured; the intended target has none.
6. Set **Enable policy: Report-only** and create it. It will not enforce its access rule until you enable it. Do not choose **On** here: a policy created On applies to everyone it covers from the moment you save, before anyone has seen who it would have stopped — the failure this plan exists to prevent. The script for this step can only create in Report-only.
7. Reopen the created policy, compare it with the intended target shown in IAMAI, then rescan.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"entra.correct-conditions","channel":"entra","states":["partial"],"format":"markdown","kind":"template"}
1. In Entra admin center → Protection → Conditional Access → Policies, open the existing legacy authentication blocking policy with ID **{{policy.current.id}}**.
2. Keep the policy's current state. If it is On, the changed rule can affect access after you save.
3. Under Conditions → Client apps, make sure "Configure" is set to "Yes" and only "Exchange ActiveSync clients" and "Other clients" are checked. Left at "No", the condition matches every client app.
4. Under Users → Include, make sure "All users" is selected. Under Target resources, make sure "All resources" is selected.
5. Under Users → Exclude, make sure the exclusions IAMAI resolved are listed, including the exclusions group from the Configure Emergency Exclusions step.
6. Under Grant, make sure "Block access" is selected.
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
7. Leave **Enable policy** as it is and click Save.
   This change removes {{policy.current.removedExclusions}} from the policy's exclusions. If the policy is On, it applies to them as soon as you save. [omit this line when unavailable]
8. Rescan in IAMAI.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"entra.observe","channel":"entra","states":["reportOnly"],"format":"markdown","kind":"template"}
Keep the policy in Report-only while you review the evidence listed for this step. Review sign-ins from Exchange ActiveSync clients and Other clients, and ask owners about infrequent jobs such as scanners, printers and scheduled scripts. No events in the available records does not prove there are no dependencies. An app's name alone does not show whether it uses legacy authentication; check the client app recorded on each sign-in.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"entra.enforce","channel":"entra","states":["readyToEnforce"],"format":"markdown","kind":"template"}
Verify the same policy and its prerequisites, set it to On, then complete the checks below and rescan.

- Reopen the policy by its ID. Confirm it is still **Report-only**, its conditions, grant and session controls match the intended target, and known legacy dependencies have a supported path.
- Do not turn it on unless all of these are true now:
  The required report-only period is complete, with no failures on this policy in the sign-in records.
  The policy is still Report-only and its settings still match the intended target, exclusions included — the script for this step refuses to enforce a policy that is not.
  Emergency access is prepared and tested.
  If any one of them is not true, leave the policy in Report-only.
- Change **Enable policy** to **On** and save.
- Verify after the change: required applications and devices sign in through their supported path, and emergency access still works.
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

IAMAI did not find **Block Legacy Authentication** in {{tenant.displayName}}. The next action is to create it in Report-only. It blocks sign-ins to all resources from the client-app categories Exchange ActiveSync clients and Other clients, for all users except the resolved exclusions, with no session controls. A mail app or protocol name alone does not show which category a sign-in falls into; the client app recorded on the sign-in does.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"ai.correct","channel":"aiInfo","states":["partial"],"format":"markdown","kind":"template"}
Policy {{policy.current.id}} for **Block Legacy Authentication** differs from the intended target: {{policy.current.semanticMismatches}}. The next action is to correct those settings on the same policy. The intended target blocks Exchange ActiveSync clients and Other clients for all users except the resolved exclusions, across all resources, with no session controls. Keep the policy's current state. If it is On, the changed rule can affect access after you save.

This change removes {{policy.current.removedExclusions}} from the policy's exclusions. If the policy is On, it applies to them as soon as you save. [omit this line when unavailable]
@@IAMAI-END

@@IAMAI-BEGIN {"id":"ai.observe","channel":"aiInfo","states":["reportOnly"],"format":"markdown","kind":"template"}

**Block Legacy Authentication** is in Report-only in {{tenant.displayName}}. Report-only evidence: {{evidence.reportOnly}}. Would-be blocks can include mail clients, printers, scanners and scheduled jobs that still use older authentication. No events in the available records does not prove there are no dependencies, because some jobs run infrequently.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"ai.enforce","channel":"aiInfo","states":["readyToEnforce"],"format":"markdown","kind":"template"}

**Block Legacy Authentication** is in Report-only in {{tenant.displayName}}, and the next action is enforcement. Before setting it to On, confirm the same policy ID still matches the intended target, legacy sign-ins from the observation period have been reviewed, owners of infrequent jobs have been asked, and required applications and devices have a supported sign-in path. Once On, Exchange ActiveSync clients and Other clients are blocked for everyone the policy covers.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"ai.blocked","channel":"aiInfo","states":["blocked","needsDecision","sourceConflict"],"format":"markdown","kind":"template"}

**Block Legacy Authentication** cannot proceed yet. Known blockers and decisions: {{dependencies.blockers}}. Resolve these before creating or changing the policy.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"ai.not-licensed","channel":"aiInfo","states":["notLicensed"],"format":"markdown","kind":"template"}

State: **Block Legacy Authentication** needs the Microsoft Entra ID P1 or higher licensing Conditional Access policies require, and this scan did not confirm it for {{tenant.displayName}}. A product bundle name alone does not confirm the service plans this step needs. No implementation is offered until licensing is resolved; the licensing gap does not change the baseline goal.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"email.rollout","channel":"email","states":["missing"],"format":"markdown","kind":"template","audience":"affected-users"}
Subject: Action needed: Block Legacy Authentication

Hi,

Please tell IT about older mail clients, printers or applications that still use an account password to connect. We will check a supported replacement before blocking the old sign-in path.

{{signature}}
@@IAMAI-END

@@IAMAI-BEGIN {"id":"email.enforce","channel":"email","states":["readyToEnforce"],"format":"markdown","kind":"template","audience":"affected-users"}
Subject: Action needed: Block Legacy Authentication

Hi,

Please tell IT about older mail clients, printers or applications that still use an account password to connect. We will check a supported replacement before blocking the old sign-in path.

{{signature}}
@@IAMAI-END

@@IAMAI-BEGIN {"id":"readiness.model","channel":"readiness","states":["missing","partial","reportOnly","readyToEnforce","inPlace","blocked","needsDecision"],"format":"markdown","kind":"template"}
Review observed use and ask owners about infrequent jobs. Ready only when the intended exclusions and the service-account and mail-device decisions are resolved, recent legacy use has been reviewed, and Report-only results show no unexplained legitimate dependency.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"troubleshooting.model","channel":"troubleshooting","states":["missing","partial","reportOnly","readyToEnforce","inPlace"],"format":"markdown","kind":"template"}
For a block, inspect the client app and protocol recorded on the sign-in and the account involved. Determine whether it is a person, a service account or a mail-sending device. Fix the authentication path first; only the intended exclusions IAMAI resolved belong in the policy.
@@IAMAI-END

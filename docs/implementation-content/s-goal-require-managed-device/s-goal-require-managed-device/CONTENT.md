@@IAMAI-BEGIN {"id":"entra.intune-prerequisite","channel":"entra","states":["missing","partial","reportOnly"],"format":"markdown","kind":"template"}
In **Intune admin center → Devices → Compliance → Compliance policy settings**, set **Mark devices with no compliance policy assigned as** to **Not compliant**. In the compliance policies assigned to the intended users and devices, review **Actions for noncompliance** and the **Mark device noncompliant** action. Apply the baseline's 3-day grace period where applicable. The Conditional Access policy accepts a compliant device **or** a Microsoft Entra hybrid joined device; registration alone does not satisfy either control.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"entra.create","channel":"entra","states":["missing"],"format":"markdown","kind":"template"}
1. Go to Entra admin center → Conditional Access → Policies → New policy.
2. Name: {{policy.target.displayName}}.
3. Users → Include: All users. Exclude → Groups: add the exclusions group, plus any other exclusions IAMAI resolved from the saved device plan.
4. Target resources: All resources.
5. Conditions → Locations: Include → Any location. Exclude → the resolved trusted locations (the network you defined in the Trusted Network step).
6. Grant → Grant access → select Require device to be marked as compliant and Require Microsoft Entra hybrid joined device → For multiple controls: Require one of the selected controls.
7. Session: leave empty.
8. Enable policy: Report-only. It will not enforce its access rule until you enable it.
9. Create. Rescan in IAMAI.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"entra.correct-conditions","channel":"entra","states":["partial"],"format":"markdown","kind":"template"}
Open the policy with ID **{{policy.current.id}}**. Keep the policy's current state. If it is On, the changed rule can affect access after you save. Set the users and conditions to the intended target: Users → Include: All users, excluding the exclusions group and any other exclusions IAMAI resolved from the saved device plan. Target resources: All resources. Locations → Include: Any location; Exclude: the resolved trusted locations. Correct this policy rather than creating a replacement.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"entra.correct-grant","channel":"entra","states":["partial"],"format":"markdown","kind":"template"}
Open the policy with ID **{{policy.current.id}}**. Keep the policy's current state. If it is On, the changed rule can affect access after you save. Under **Grant**, select **Require device to be marked as compliant** and **Require Microsoft Entra hybrid joined device**, with **Require one of the selected controls**. Clear any other control.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"entra.correct-session","channel":"entra","states":["partial"],"format":"markdown","kind":"template"}
Open the policy with ID **{{policy.current.id}}**. Keep the policy's current state. If it is On, the changed rule can affect access after you save. Set **Session** to the intended target and clear any control it does not include; the baseline sets no session controls.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"entra.correct-name","channel":"entra","states":["partial"],"format":"markdown","kind":"template"}
Rename the same policy to **{{policy.target.displayName}}** only when the name is the difference. The display name does not identify the policy for updates; IAMAI uses the same policy ID.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"entra.correct-verify","channel":"entra","states":["partial"],"format":"markdown","kind":"template"}
Re-open the same policy by its ID, compare the corrected settings with IAMAI's intended target, and rescan. Keep the policy's current state. If it is On, the changed rule can affect access after you save. Verify after the change: a compliant work device on the selected platforms can still sign in from outside the trusted locations. Hybrid join alone does not satisfy a compliance requirement.

This change removes {{policy.current.removedExclusions}} from the policy's exclusions. If the policy is On, it applies to them as soon as you save. [omit this line when unavailable]
@@IAMAI-END

@@IAMAI-BEGIN {"id":"entra.observe","channel":"entra","states":["reportOnly"],"format":"markdown","kind":"template"}
Keep the policy in **Report-only** while you review the evidence listed for this step. Review report-only results for sign-ins from outside the trusted locations. Where a managed device's sign-in is missing device information, investigate the app, browser and device state before changing exclusions. Test real browser, server and enrollment workflows. A quiet report is not proof that every device path will work.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"entra.enforce","channel":"entra","states":["readyToEnforce"],"format":"markdown","kind":"template"}
Re-open the policy by the same policy ID. Confirm it is still Report-only, its settings match the intended target, and IAMAI shows the Intune prerequisite as satisfied. Change **Enable policy** to **On** and save. Verify after the change: compliant and hybrid-joined work devices in the saved scope can sign in from outside the trusted locations, and emergency access still works. Then rescan IAMAI.
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

State: **Require a Managed Device Outside the Office** does not exist in {{tenant.displayName}} yet. The next action creates it in Report-only: All users with the exclusions resolved from the saved device plan, All resources, Any location except the resolved trusted locations, and Grant: Require device to be marked as compliant OR Require Microsoft Entra hybrid joined device. Either device state satisfies the grant. It does not block anything until it is enabled.

The Intune prerequisite comes first: devices with no compliance policy assigned are to be marked Not compliant.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"ai.correct","channel":"aiInfo","states":["partial"],"format":"markdown","kind":"template"}

State: policy {{policy.current.id}} exists, but these settings differ from the intended target for **Require a Managed Device Outside the Office**: {{policy.current.semanticMismatches}}. The correction changes only those settings, on the same policy ID. The intended grant stays Require device to be marked as compliant OR Require Microsoft Entra hybrid joined device.

Keep the policy's current state. If it is On, the changed rule can affect access after you save.

This change removes {{policy.current.removedExclusions}} from the policy's exclusions. If the policy is On, it applies to them as soon as you save. [omit this line when unavailable]
@@IAMAI-END

@@IAMAI-BEGIN {"id":"ai.observe","channel":"aiInfo","states":["reportOnly"],"format":"markdown","kind":"template"}

State: **Require a Managed Device Outside the Office** is in Report-only in {{tenant.displayName}}. It records what it would block but blocks nothing yet. Report-only evidence: {{evidence.reportOnly}}.

A sign-in with no device information is different from a noncompliant device: the device may be managed while the app or browser does not send its device state. Few or no failures do not show that every required device path will work.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"ai.enforce","channel":"aiInfo","states":["readyToEnforce"],"format":"markdown","kind":"template"}

State: **Require a Managed Device Outside the Office** is in Report-only in {{tenant.displayName}} and the next action is to enable it. Before setting it to On, the same policy ID should still be Report-only, its settings should match the intended target, the Intune prerequisite should be satisfied, and the report-only evidence should have been reviewed. After enabling, test the required compliant and hybrid-joined device paths outside the trusted locations, and emergency access.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"ai.blocked","channel":"aiInfo","states":["blocked","needsDecision","sourceConflict"],"format":"markdown","kind":"template"}

State: **Require a Managed Device Outside the Office** cannot proceed yet. Known blockers or decisions: {{dependencies.blockers}}. These must be resolved, including any unsaved device-plan choice, before the policy is created or changed.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"ai.not-licensed","channel":"aiInfo","states":["notLicensed"],"format":"markdown","kind":"template"}

State: **Require a Managed Device Outside the Office** needs licensing that this scan did not confirm for {{tenant.displayName}}. No implementation is offered until licensing is resolved. The licensing gap does not change the baseline goal.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"email.rollout","channel":"email","states":["missing"],"format":"markdown","kind":"template","audience":"affected-users"}
Subject: Planned change: Require a Managed Device Outside the Office

Hi,

Outside the approved trusted network, work access will need a device that meets the selected device requirements. Contact IT if your work device is blocked so we can check its status and sign-in details.

{{signature}}
@@IAMAI-END

@@IAMAI-BEGIN {"id":"email.enforce","channel":"email","states":["readyToEnforce"],"format":"markdown","kind":"template","audience":"affected-users"}
Subject: Planned change: Require a Managed Device Outside the Office

Hi,

Outside the approved trusted network, work access will need a device that meets the selected device requirements. Contact IT if your work device is blocked so we can check its status and sign-in details.

{{signature}}
@@IAMAI-END

@@IAMAI-BEGIN {"id":"readiness.model","channel":"readiness","states":["missing","partial","reportOnly","readyToEnforce","inPlace","blocked","needsDecision"],"format":"markdown","kind":"template"}
Check the saved platform scope, compliance requirements and hybrid-join path. Investigate missing device claims before changing exclusions. The grant stays compliantDevice OR domainJoinedDevice.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"troubleshooting.model","channel":"troubleshooting","states":["missing","partial","reportOnly","readyToEnforce","inPlace"],"format":"markdown","kind":"template"}
For a blocked work device, inspect Intune policy assignment, compliance reason/check-in, browser/device account claims, and hybrid-join status before touching CA exclusions. For servers/Autopilot or personal-device impact, compare the event to the saved device-plan scope and intended target.
@@IAMAI-END

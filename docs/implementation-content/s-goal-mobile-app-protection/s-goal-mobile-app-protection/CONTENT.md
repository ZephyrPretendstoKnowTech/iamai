@@IAMAI-BEGIN {"id":"entra.intune-prerequisite","channel":"entra","states":["configurePrerequisite"],"format":"markdown","kind":"template"}
1. In **Microsoft Intune admin center > Apps > Protection**, inspect the tenant's existing App Protection policies.
2. Verify, or create, the App Protection policy for **iOS/iPadOS** and separately for **Android**. Keep IAMAI's intended app and user assignments; require a PIN and block Save As to unmanaged locations, as the baseline describes.
3. Use this tenant's own groups, and do not widen the baseline's App Protection settings.
4. Rescan IAMAI. Prerequisite state IAMAI reports: `{{intune.appProtection.prerequisiteState}}`.
5. Enforce the Conditional Access policy only after IAMAI shows this prerequisite as satisfied. Conditional Access requires app protection; it does not create these Intune policies.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"entra.create","channel":"entra","states":["missing"],"format":"markdown","kind":"template"}
1. Open **Entra ID > Conditional Access > Policies > New policy**.
2. Name: **{{policy.target.displayName}}**.
3. Users → Include: All users. Exclude: the IAMAI-resolved exclusions. Do not copy IDs from another tenant or widen or narrow the population.
4. Target resources: All resources. Conditions → Device platforms → Configure: Yes, then Include: Android and iOS. Left at No it applies to all device platforms.
5. Grant → Grant access → **Require app protection policy**, with no other control. Leave session controls as the target sets them; the baseline sets none.
6. Set **Enable policy: Report-only** and create it. It will not enforce its access rule until you enable it. Do not choose **On** here: a policy created On applies to everyone it covers from the moment you save, before anyone has seen who it would have stopped — the failure this plan exists to prevent. The script for this step can only create in Report-only.
7. Re-open the policy, compare its users, resources, platforms, grant and session settings with IAMAI, and rescan.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"entra.correct-conditions","channel":"entra","states":["partial"],"format":"markdown","kind":"template"}
Open the policy with ID **{{policy.current.id}}**. Keep the policy's current state. If it is On, the changed rule can affect access after you save. Set the users and conditions to the intended target: Users → Include: All users, with the IAMAI-resolved exclusions. Target resources: All resources. Device platforms → Configure: Yes, then Include: Android and iOS; left at No it applies to all device platforms. Correct this policy rather than creating a replacement.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"entra.correct-grant","channel":"entra","states":["partial"],"format":"markdown","kind":"template"}
Open the policy with ID **{{policy.current.id}}**. Keep the policy's current state. If it is On, the changed rule can affect access after you save. Under **Grant**, select **Require app protection policy** and clear any other control.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"entra.correct-session","channel":"entra","states":["partial"],"format":"markdown","kind":"template"}
Open the policy with ID **{{policy.current.id}}**. Keep the policy's current state. If it is On, the changed rule can affect access after you save. Set **Session** to the intended target and clear any control it does not include; the baseline sets no session controls.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"entra.correct-name","channel":"entra","states":["partial"],"format":"markdown","kind":"template"}
Rename the same policy to **{{policy.target.displayName}}** only when the name is the difference. The display name does not identify the policy for updates; IAMAI uses the same policy ID.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"entra.correct-verify","channel":"entra","states":["partial"],"format":"markdown","kind":"template"}
Re-open the same policy by its ID, compare the corrected settings with IAMAI's intended target, and rescan. Keep the policy's current state. If it is On, the changed rule can affect access after you save. Verify after the change: a test user can open work data in a supported app on iOS/iPadOS and on Android.

This change removes {{policy.current.removedExclusions}} from the policy's exclusions. If the policy is On, it applies to them as soon as you save. [omit this line when unavailable]
@@IAMAI-END

@@IAMAI-BEGIN {"id":"entra.observe","channel":"entra","states":["reportOnly"],"format":"markdown","kind":"template"}
Keep the policy in **Report-only** while you review the evidence listed for this step. Review report-only results for iOS/iPadOS and Android sign-ins, and verify separately that the Intune App Protection policies apply to the intended users. A report-only failure for the app protection grant is not by itself proof that the enabled policy will block that sign-in. Test supported apps, and any required broker app setup, with a controlled account before enforcement. A quiet report is not proof.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"entra.enforce","channel":"entra","states":["readyToEnforce"],"format":"markdown","kind":"template"}
Re-open the policy by the same policy ID. Confirm it is still Report-only, its settings match the intended target, and IAMAI shows the Intune App Protection prerequisite as satisfied.

Do not turn it on unless all of these are true now:

- The required report-only period is complete, with no failures on this policy in the sign-in records.
- The policy is still Report-only and its settings still match the intended target, exclusions included — the script for this step refuses to enforce a policy that is not.
- Emergency access is prepared and tested.

If any one of them is not true, leave the policy in Report-only. Change **Enable policy** to **On** and save. Verify after the change: a test user can open work data in the supported apps on iOS/iPadOS and Android, and emergency access still works. Then rescan IAMAI.
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

@@IAMAI-BEGIN {"id":"powershell.run","channel":"powershell","states":["missing","partial","reportOnly","readyToEnforce"],"format":"powershell","kind":"deployableAfterBinding","invocation":{"modeParameter":"Mode","parameters":{"TargetPolicyJson":{"binding":"policy.target.json","modes":["Create","CorrectConditions","CorrectGrant","CorrectSession","CorrectName","Observe","Enforce"]},"PolicyId":{"binding":"policy.current.id","modes":["CorrectConditions","CorrectGrant","CorrectSession","CorrectName","Observe","Enforce"]}},"withheldModes":{"Enforce":"Enforce runs only with -ReadinessApproved, and this package declares no prerequisite IAMAI can check to pass it."}}}
# This change removes {{policy.current.removedExclusions}} from the policy's exclusions. If the policy is On, it applies to them as soon as the correction is saved. [omit this line when unavailable]
param(
 [Parameter(Mandatory=$true)][ValidateSet('Create','CorrectConditions','CorrectGrant','CorrectSession','CorrectName','Observe','Enforce','Verify')][string]$Mode,
 [Parameter(Mandatory=$true)][string]$TargetPolicyJson,
 [string]$PolicyId,
 [switch]$ReadinessApproved
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
 if(-not $ReadinessApproved){throw 'Refusing enforcement: readiness approval was not supplied.'}
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

State: **Require App Protection on Phones** does not exist in {{tenant.displayName}} yet. The next action creates it in Report-only: All users with the IAMAI-resolved exclusions, All resources, device platforms Android and iOS, and Grant: Require app protection policy. It does not block anything until it is enabled.

Conditional Access requires app protection; it does not create the Intune App Protection policies, which must exist and be assigned for both platforms. A report-only failure for this grant is not by itself proof that the enabled policy will block the sign-in.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"ai.correct","channel":"aiInfo","states":["partial"],"format":"markdown","kind":"template"}

State: policy {{policy.current.id}} exists, but these settings differ from the intended target for **Require App Protection on Phones**: {{policy.current.semanticMismatches}}. The correction changes only those settings, on the same policy ID. Conditional Access requires app protection; the Intune App Protection policies are configured separately.

Keep the policy's current state. If it is On, the changed rule can affect access after you save.

This change removes {{policy.current.removedExclusions}} from the policy's exclusions. If the policy is On, it applies to them as soon as you save. [omit this line when unavailable]
@@IAMAI-END

@@IAMAI-BEGIN {"id":"ai.observe","channel":"aiInfo","states":["reportOnly"],"format":"markdown","kind":"template"}

State: **Require App Protection on Phones** is in Report-only in {{tenant.displayName}}. It records what it would block but blocks nothing yet. Report-only evidence: {{evidence.reportOnly}}.

A report-only failure for the app protection grant is not by itself proof that the enabled policy will block the sign-in, and few or no failures do not show that every supported app works. Supported apps and any required broker setup need a controlled test on both platforms.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"ai.enforce","channel":"aiInfo","states":["readyToEnforce"],"format":"markdown","kind":"template"}

State: **Require App Protection on Phones** is in Report-only in {{tenant.displayName}} and the next action is to enable it. Before setting it to On, the same policy ID should still be Report-only, its settings should match the intended target, the Intune App Protection prerequisite should be satisfied, and the report-only evidence should have been reviewed. After enabling, test the supported apps on iOS/iPadOS and Android, and emergency access.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"ai.blocked","channel":"aiInfo","states":["blocked","needsDecision","sourceConflict"],"format":"markdown","kind":"template"}

State: **Require App Protection on Phones** cannot proceed yet. Known blockers or decisions: {{dependencies.blockers}}. These must be resolved before the policy is created or changed.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"ai.not-licensed","channel":"aiInfo","states":["notLicensed"],"format":"markdown","kind":"template"}

State: **Require App Protection on Phones** needs licensing that this scan did not confirm for {{tenant.displayName}}. A product bundle name alone does not confirm the service plans this step needs. No implementation is offered until licensing is resolved; the licensing gap does not change the baseline goal.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"email.rollout","channel":"email","states":["missing"],"format":"markdown","kind":"template","audience":"affected-users"}
Subject: Planned change: Require App Protection on Phones

Hi,

We are preparing to require approved protected apps for work data on phones and tablets. IT will confirm which apps to use and help if a supported app is blocked.

{{signature}}
@@IAMAI-END

@@IAMAI-BEGIN {"id":"email.enforce","channel":"email","states":["readyToEnforce"],"format":"markdown","kind":"template","audience":"affected-users"}
Subject: Planned change: Require App Protection on Phones

Hi,

We are preparing to require approved protected apps for work data on phones and tablets. IT will confirm which apps to use and help if a supported app is blocked.

{{signature}}
@@IAMAI-END

@@IAMAI-BEGIN {"id":"readiness.model","channel":"readiness","states":["missing","partial","reportOnly","readyToEnforce","inPlace","blocked","needsDecision"],"format":"markdown","kind":"template"}
Check iOS/iPadOS and Android assignments, licensing and actual supported-app behavior before enforcement. The Conditional Access grant is `compliantApplication` on Android and iOS with the intended scope.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"troubleshooting.model","channel":"troubleshooting","states":["missing","partial","reportOnly","readyToEnforce","inPlace"],"format":"markdown","kind":"template"}
If a supported mobile app is blocked, first check the App Protection policy assignment, app support, Entra device registration/broker state, and platform. If a native/unsupported app is blocked, move the user to the supported protected app rather than adding a Conditional Access exclusion.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"ai.prerequisite","channel":"aiInfo","states":["configurePrerequisite"],"format":"markdown","kind":"template"}

State: **Require App Protection on Phones** in {{tenant.displayName}} is waiting on its Intune App Protection prerequisite. Current prerequisite state: {{intune.appProtection.prerequisiteState}}.

The iOS/iPadOS and Android App Protection policies must cover the intended apps and users, require a PIN and block Save As to unmanaged locations, as the baseline describes. Conditional Access requires app protection; it does not create these Intune policies.
@@IAMAI-END

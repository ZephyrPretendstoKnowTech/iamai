@@IAMAI-BEGIN {"id":"entra.sharepoint-prerequisite","channel":"entra","states":["configurePrerequisite"],"format":"markdown","kind":"template"}
1. In **SharePoint admin center > Policies > Access control > Unmanaged devices**, choose **Allow limited, web-only access** and Save.
2. Microsoft documents that saving this setting can disable Conditional Access policies previously created from this page and create a new policy for all users, without carrying over earlier customizations.
3. **Stop here.** Let the setting propagate, rescan in IAMAI, and use the policy IDs from the new scan before changing either Conditional Access policy. This SharePoint setting does not configure Exchange mailbox restrictions.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"entra.create-set","channel":"entra","states":["missing"],"format":"markdown","kind":"template"}
After the SharePoint setting has changed **and IAMAI has rescanned**, create each policy in Report-only. It will not enforce its access rule until you enable it. Leave Grant unconfigured on both.

- **{{policies.unmanagedBrowser.a.target.displayName}}** (Policy A): Target resources: Office 365; Client apps: Browser; apply the device condition shown in the intended target; Session: **Use app enforced restrictions**.
- **{{policies.unmanagedBrowser.b.target.displayName}}** (Policy B), only when Defender for Cloud Apps is licensed (`license.defenderCloudApps` is true): Target resources: Office 365; apply the device filter and the other conditions shown in the intended target; Session: **Use Conditional Access App Control** with **Block downloads**.

If Defender for Cloud Apps is not licensed, do not create Policy B; the step is not complete without it. Test each affected service separately after enforcement: the SharePoint setting does not configure Exchange mailbox restrictions.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"entra.correct-set","channel":"entra","states":["partial"],"format":"markdown","kind":"template"}
Open each affected policy using its policy ID from the latest scan. Do not reuse an ID recorded before a SharePoint access-control change. For each policy with a difference, set its name, conditions and session controls to that policy's intended target, and clear any Grant controls. The correction applies all these fields to that member; it does not change the policy's state.

Keep the policy's current state. If it is On, the changed rule can affect access after you save.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"entra.observe","channel":"entra","states":["reportOnly"],"format":"markdown","kind":"template"}
Keep both applicable policies in Report-only while you review the evidence listed for this step. Check the SharePoint unmanaged-device setting separately. Review each policy's report-only results on its own; Policy B depends on Defender for Cloud Apps and cannot be judged from Policy A. Session restrictions are not applied in Report-only, so these results do not prove that download restrictions work.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"entra.enforce","channel":"entra","states":["readyToEnforce"],"format":"markdown","kind":"template"}
Verify each policy and its prerequisites, set it to On, then complete the checks below and rescan.

- Reopen each applicable policy using its ID from the latest scan. Confirm it is still **Report-only**, its conditions and session controls match the intended target, Grant is unconfigured, the SharePoint setting is in place and, for Policy B, Defender for Cloud Apps is licensed.
- Set one policy to **On** at a time.
- Verify after each change: from an unmanaged test device, open SharePoint and Outlook on the web in a browser and confirm the intended download, print and sync limits. Test each service separately; the SharePoint setting does not configure Exchange mailbox restrictions.
- Rescan in IAMAI after the changes.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"entra.not-licensed","channel":"entra","states":["notLicensed"],"format":"markdown","kind":"template"}
This step is marked not licensed. Configure the SharePoint setting and Policy A only where this step shows them as actionable. Policy B uses Conditional Access App Control (`cloudAppSecurity: blockDownloads`) and stays unavailable until the Defender for Cloud Apps license is in place. The step is not complete while Policy B is unavailable.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"json.policy-a","channel":"json","states":["missing","notLicensed"],"format":"json-template","kind":"template"}
{"displayName":{{json:policies.unmanagedBrowser.a.target.displayName}},"state":"enabledForReportingButNotEnforced","conditions":{{json:policies.unmanagedBrowser.a.target.conditions}},"grantControls":null,"sessionControls":{{json:policies.unmanagedBrowser.a.target.sessionControls}}}
@@IAMAI-END

@@IAMAI-BEGIN {"id":"json.policy-b","channel":"json","states":["missing"],"format":"json-template","kind":"template"}
{"displayName":{{json:policies.unmanagedBrowser.b.target.displayName}},"state":"enabledForReportingButNotEnforced","conditions":{{json:policies.unmanagedBrowser.b.target.conditions}},"grantControls":null,"sessionControls":{{json:policies.unmanagedBrowser.b.target.sessionControls}}}
@@IAMAI-END

@@IAMAI-BEGIN {"id":"json.policy-a-conditions","channel":"json","states":["partial"],"format":"json-template","kind":"template"}
{"displayName":{{json:policies.unmanagedBrowser.a.target.displayName}},"conditions":{{json:policies.unmanagedBrowser.a.target.conditions}},"grantControls":null}
@@IAMAI-END

@@IAMAI-BEGIN {"id":"json.policy-a-session","channel":"json","states":["partial"],"format":"json-template","kind":"template"}
{"sessionControls":{{json:policies.unmanagedBrowser.a.target.sessionControls}}}
@@IAMAI-END

@@IAMAI-BEGIN {"id":"json.policy-b-conditions","channel":"json","states":["partial"],"format":"json-template","kind":"template"}
{"displayName":{{json:policies.unmanagedBrowser.b.target.displayName}},"conditions":{{json:policies.unmanagedBrowser.b.target.conditions}},"grantControls":null}
@@IAMAI-END

@@IAMAI-BEGIN {"id":"json.policy-b-session","channel":"json","states":["partial"],"format":"json-template","kind":"template"}
{"sessionControls":{{json:policies.unmanagedBrowser.b.target.sessionControls}}}
@@IAMAI-END

@@IAMAI-BEGIN {"id":"json.enforce","channel":"json","states":["readyToEnforce"],"format":"json","kind":"template"}
{"state":"enabled"}
@@IAMAI-END

@@IAMAI-BEGIN {"id":"powershell.composite","channel":"powershell","states":["configurePrerequisite","missing","partial","reportOnly","readyToEnforce","notLicensed"],"format":"powershell","kind":"template"}
param(
 [Parameter(Mandatory=$true)][ValidateSet('ConfigureSharePoint','CreateA','CreateB','CorrectA','CorrectB','Observe','EnforceA','EnforceB','Verify')][string]$Mode,
 [string]$SharePointAdminUrl,
 [string]$PolicyAJson,
 [string]$PolicyBJson,
 [string]$PolicyAId,
 [string]$PolicyBId,
 [Parameter(Mandatory=$true)][bool]$DefenderCloudAppsLicensed
)
$ErrorActionPreference='Stop'
function GuidOk([string]$v,[string]$n){$g=[guid]::Empty;if(-not [guid]::TryParse($v,[ref]$g)){throw "$n must be a GUID."}}
function IG($m,$u,$b=$null){if($null -eq $b){return Invoke-MgGraphRequest -Method $m -Uri $u -OutputType PSObject};return Invoke-MgGraphRequest -Method $m -Uri $u -Body ($b|ConvertTo-Json -Depth 80) -ContentType 'application/json' -OutputType PSObject}
function Project($actual,$target){
 if($null -eq $target){return $actual}
 if($target -is [string] -or $target -is [bool] -or $target -is [int] -or $target -is [long] -or $target -is [double]){return $actual}
 if($target -is [System.Collections.IEnumerable] -and -not ($target -is [string])){return @($actual)}
 $h=[ordered]@{};foreach($p in $target.PSObject.Properties){$h[$p.Name]=Project $actual.($p.Name) $p.Value};return [pscustomobject]$h
}
function Norm($v){
 if($null -eq $v){return $null}
 if($v -is [string] -or $v -is [bool] -or $v -is [int] -or $v -is [long] -or $v -is [double]){return $v}
 if($v -is [System.Collections.IEnumerable] -and -not ($v -is [string])){$x=@($v|ForEach-Object {Norm $_});return @($x|Sort-Object {$_|ConvertTo-Json -Depth 80 -Compress})}
 $h=[ordered]@{};foreach($p in ($v.PSObject.Properties.Name|Sort-Object)){$h[$p]=Norm $v.$p};return [pscustomobject]$h
}
function Same($a,$b){return (((Norm (Project $a $b))|ConvertTo-Json -Depth 80 -Compress) -eq ((Norm $b)|ConvertTo-Json -Depth 80 -Compress))}
if($Mode -eq 'ConfigureSharePoint'){
 if([string]::IsNullOrWhiteSpace($SharePointAdminUrl)){throw 'SharePointAdminUrl is required.'}
 Import-Module Microsoft.Online.SharePoint.PowerShell -ErrorAction Stop
 Connect-SPOService -Url $SharePointAdminUrl
 $before=Get-SPOTenant
 if([string]$before.ConditionalAccessPolicy -ne 'AllowLimitedAccess'){Set-SPOTenant -ConditionalAccessPolicy AllowLimitedAccess}
 $after=Get-SPOTenant
 [pscustomobject]@{ConditionalAccessPolicy=$after.ConditionalAccessPolicy;MandatoryNextAction='STOP. Allow propagation, rescan IAMAI, and re-resolve CA stable IDs before any CA mutation.'}
 return
}
Connect-MgGraph -Scopes 'Policy.Read.All','Policy.ReadWrite.ConditionalAccess' -NoWelcome
$G='https://graph.microsoft.com/v1.0'
$a=if($PolicyAJson){$PolicyAJson|ConvertFrom-Json}else{$null};$b=if($PolicyBJson){$PolicyBJson|ConvertFrom-Json}else{$null}
function Target([string]$which){if($which -eq 'A'){if($null -eq $a){throw 'PolicyAJson is required.'};return $a};if(-not $DefenderCloudAppsLicensed){throw 'Policy B is not actionable without the resolved Defender for Cloud Apps dependency.'};if($null -eq $b){throw 'PolicyBJson is required.'};return $b}
function IdFor([string]$which){$id=if($which -eq 'A'){$PolicyAId}else{$PolicyBId};GuidOk $id "Policy${which}Id";return $id}
function Create([string]$which){$t=Target $which;$body=[ordered]@{displayName=$t.displayName;state='enabledForReportingButNotEnforced';conditions=$t.conditions;grantControls=$null;sessionControls=$t.sessionControls};$x=IG POST "$G/identity/conditionalAccess/policies" $body;Write-Host "Created Policy $which $($x.id) in Report-only."}
function Correct([string]$which){$t=Target $which;$id=IdFor $which;$u="$G/identity/conditionalAccess/policies/$id";IG PATCH $u @{displayName=$t.displayName;conditions=$t.conditions;grantControls=$null;sessionControls=$t.sessionControls}|Out-Null}
function Enforce([string]$which){$t=Target $which;$id=IdFor $which;$u="$G/identity/conditionalAccess/policies/$id";$x=IG GET $u;if([string]$x.state -ne 'enabledForReportingButNotEnforced'){throw 'Refusing enforcement: policy is not Report-only.'};if(-not (Same $x.conditions $t.conditions)){throw 'Conditions mismatch.'};if($null -ne $x.grantControls){throw 'Grant must remain null.'};if(-not (Same $x.sessionControls $t.sessionControls)){throw 'Session controls mismatch.'};IG PATCH $u @{state='enabled'}|Out-Null}
switch($Mode){'CreateA'{Create 'A'}'CreateB'{Create 'B'}'CorrectA'{Correct 'A'}'CorrectB'{Correct 'B'}'EnforceA'{Enforce 'A'}'EnforceB'{Enforce 'B'}}
$out=@()
foreach($w in @('A','B')){$id=if($w -eq 'A'){$PolicyAId}else{$PolicyBId};if($id){GuidOk $id "Policy${w}Id";$x=IG GET "$G/identity/conditionalAccess/policies/$id";$out+=[pscustomobject]@{Policy=$w;Id=$x.id;State=$x.state;DisplayName=$x.displayName;GrantIsNull=($null -eq $x.grantControls)}}}
$out
@@IAMAI-END

@@IAMAI-BEGIN {"id":"ai.prerequisite","channel":"aiInfo","states":["configurePrerequisite"],"format":"markdown","kind":"template"}
**Contains tenant context. Review before sharing with an external AI service.**

The next action for **Limit Unmanaged Devices in the Browser** in {{tenant.displayName}} is the SharePoint unmanaged-device setting, before either Conditional Access policy is created or changed. Current SharePoint mode: {{sharepoint.unmanagedDevices.currentMode}}. Intended mode: `AllowLimitedAccess` (Allow limited, web-only access). Microsoft documents that saving this setting in the SharePoint admin center can disable Conditional Access policies previously created from that page and create a new one without earlier customizations, so let the change propagate and rescan in IAMAI before using any policy ID. The SharePoint setting does not configure Exchange mailbox restrictions.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"ai.create","channel":"aiInfo","states":["missing"],"format":"markdown","kind":"template"}
**Contains tenant context. Review before sharing with an external AI service.**

**Limit Unmanaged Devices in the Browser** needs two Conditional Access policies in {{tenant.displayName}}, each created in Report-only after the SharePoint setting (`AllowLimitedAccess`) is in place and IAMAI has rescanned. Policy A limits Office 365 browser sessions with app enforced restrictions (`applicationEnforcedRestrictions`). Policy B uses Conditional Access App Control with Block downloads (`cloudAppSecurity: blockDownloads`) and applies only when Defender for Cloud Apps is licensed. Neither policy sets a grant control. The policy IDs come from the tenant scan; the baseline does not supply them.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"ai.correct","channel":"aiInfo","states":["partial"],"format":"markdown","kind":"template"}
**Contains tenant context. Review before sharing with an external AI service.**

The unmanaged-browser policies in {{tenant.displayName}} differ from the intended target: {{policies.unmanagedBrowser.semanticMismatches}}. The next action is to correct each differing policy using its ID from the latest scan, because a SharePoint access-control change can replace earlier policies. The SharePoint setting is changed in SharePoint, not in the Conditional Access policy.

Keep the policy's current state. If it is On, the changed rule can affect access after you save.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"ai.observe","channel":"aiInfo","states":["reportOnly"],"format":"markdown","kind":"template"}
**Contains tenant context. Review before sharing with an external AI service.**

Both unmanaged-browser policies are in Report-only in {{tenant.displayName}}. Report-only evidence: {{evidence.reportOnly}}. These results show where each policy would apply; session restrictions are not applied in Report-only, so they do not show whether download, print or sync limits work. Policy A and Policy B have separate evidence, and the SharePoint setting is checked separately.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"ai.enforce","channel":"aiInfo","states":["readyToEnforce"],"format":"markdown","kind":"template"}
**Contains tenant context. Review before sharing with an external AI service.**

The unmanaged-browser policies in {{tenant.displayName}} are ready for enforcement. Before setting each policy to On, confirm by its current ID that it still matches the intended target, Grant is unconfigured, the SharePoint setting is in place and, for Policy B, Defender for Cloud Apps is licensed. Enable one policy at a time. Browser restrictions can only be tested once a policy is On; test SharePoint and Exchange separately from an unmanaged device.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"ai.blocked","channel":"aiInfo","states":["blocked","needsDecision","sourceConflict"],"format":"markdown","kind":"template"}
**Contains tenant context. Review before sharing with an external AI service.**

**Limit Unmanaged Devices in the Browser** cannot proceed yet. Known blockers and decisions: {{dependencies.blockers}}. The step covers the SharePoint unmanaged-device setting and two Conditional Access policies, and Policy B also depends on Defender for Cloud Apps licensing.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"ai.not-licensed","channel":"aiInfo","states":["notLicensed"],"format":"markdown","kind":"template"}
**Contains tenant context. Review before sharing with an external AI service.**

Defender for Cloud Apps licensed (`license.defenderCloudApps`): {{license.defenderCloudApps}}. Policy B, which uses Conditional Access App Control with Block downloads, is unavailable without that license. The SharePoint setting and Policy A may still be actionable, but Policy A alone does not complete this step.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"email.rollout","channel":"email","states":["missing"],"format":"markdown","kind":"template","audience":"affected-users"}
Subject: Planned change: Limit Unmanaged Devices in the Browser

Hi,

We are preparing limited browser access on unmanaged devices. Some download, print or sync actions may be unavailable. Use an approved managed device when you need the full work experience.

{{signature}}
@@IAMAI-END

@@IAMAI-BEGIN {"id":"email.enforce","channel":"email","states":["readyToEnforce"],"format":"markdown","kind":"template","audience":"affected-users"}
Subject: Planned change: Limit Unmanaged Devices in the Browser

Hi,

We are preparing limited browser access on unmanaged devices. Some download, print or sync actions may be unavailable. Use an approved managed device when you need the full work experience.

{{signature}}
@@IAMAI-END

@@IAMAI-BEGIN {"id":"readiness.model","channel":"readiness","states":["configurePrerequisite","missing","partial","reportOnly","readyToEnforce","inPlace","blocked","needsDecision","notLicensed"],"format":"markdown","kind":"template"}
Check SharePoint separately, then each applicable policy and its licensing. A policy setting alone does not prove download restrictions work. Ready only when the SharePoint unmanaged-device setting is confirmed after propagation, IAMAI has rescanned after any SharePoint change, each applicable policy matches its intended target under its current policy ID, and Policy B's Defender for Cloud Apps license is confirmed. Without that license Policy B remains unresolved and the step is not complete. Controlled browser tests after enforcement confirm the restrictions for each service.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"troubleshooting.model","channel":"troubleshooting","states":["configurePrerequisite","missing","partial","reportOnly","readyToEnforce","inPlace","notLicensed"],"format":"markdown","kind":"template"}
If access behavior or policy IDs change after the SharePoint setting, stop and rescan before changing Conditional Access. For unexpected restrictions, separate SharePoint tenant behavior, Policy A app enforced restrictions, Policy B Defender for Cloud Apps session control, device-filter claims, and browser or platform support. Exchange Online restrictions are not set by the SharePoint setting. Do not troubleshoot by adding user exclusions first.
@@IAMAI-END

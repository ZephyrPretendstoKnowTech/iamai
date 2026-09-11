@@IAMAI-BEGIN {"id":"entra.sharepoint-prerequisite","channel":"entra","states":["configurePrerequisite"],"format":"markdown","kind":"template"}
1. In **SharePoint admin center > Policies > Access control > Unmanaged devices**, choose **Allow limited, web-only access** and Save.
2. Microsoft documents that this action can disable previous CA policies created from this page and create a new all-users policy without carrying customizations.
3. **Stop here.** Allow the setting to propagate, rescan IAMAI, and re-resolve both CA policy IDs before any CA mutation.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"entra.create-set","channel":"entra","states":["missing"],"format":"markdown","kind":"template"}
After the SharePoint prerequisite has been changed **and IAMAI has rescanned**, create Policy A from `policies.unmanagedBrowser.a.target.*` in Report-only. If `license.defenderCloudApps` is true, create Policy B from `policies.unmanagedBrowser.b.target.*` in Report-only. Grant controls remain unconfigured on both. If the Defender dependency is false, do not create Policy B and do not mark the full step complete.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"entra.correct-set","channel":"entra","states":["partial"],"format":"markdown","kind":"template"}
Open each affected policy by its **post-rescan stable tenant ID**. Stage any enabled policy to Report-only before access-affecting correction. Replace only the mismatched complete conditions/session object with IAMAI's canonical target. Do not reuse an ID captured before a SharePoint access-control change.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"entra.observe","channel":"entra","states":["reportOnly"],"format":"markdown","kind":"template"}
Leave both applicable policies in Report-only. Verify the SharePoint tenant mode independently, review Report-only results, and perform an unmanaged-browser test. Policy A and Policy B are separate CA objects with separate evidence; Defender-dependent Policy B cannot be assumed from Policy A.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"entra.enforce","channel":"entra","states":["readyToEnforce"],"format":"markdown","kind":"template"}
Re-read both applicable policies by stable post-rescan ID and verify canonical conditions, null grants, correct session controls, SharePoint prerequisite, and Defender licensing for Policy B. Enable one policy at a time with validation between changes. Rescan afterward.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"entra.not-licensed","channel":"entra","states":["notLicensed"],"format":"markdown","kind":"template"}
Configure/validate Policy A and the SharePoint prerequisite only to the extent IAMAI marks them actionable. Policy B uses Conditional Access App Control / `cloudAppSecurity: blockDownloads` and remains explicitly **Not licensed/blocked** until the Defender for Cloud Apps dependency is resolved. Do not relabel the whole two-policy target complete.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"json.policy-a","channel":"json","states":["missing","notLicensed"],"format":"json-template","kind":"template"}
{"displayName":{{json:policies.unmanagedBrowser.a.target.displayName}},"state":"enabledForReportingButNotEnforced","conditions":{{json:policies.unmanagedBrowser.a.target.conditions}},"grantControls":null,"sessionControls":{{json:policies.unmanagedBrowser.a.target.sessionControls}}}
@@IAMAI-END

@@IAMAI-BEGIN {"id":"json.policy-b","channel":"json","states":["missing"],"format":"json-template","kind":"template"}
{"displayName":{{json:policies.unmanagedBrowser.b.target.displayName}},"state":"enabledForReportingButNotEnforced","conditions":{{json:policies.unmanagedBrowser.b.target.conditions}},"grantControls":null,"sessionControls":{{json:policies.unmanagedBrowser.b.target.sessionControls}}}
@@IAMAI-END

@@IAMAI-BEGIN {"id":"json.policy-a-conditions","channel":"json","states":["partial"],"format":"json-template","kind":"template"}
{"conditions":{{json:policies.unmanagedBrowser.a.target.conditions}}}
@@IAMAI-END

@@IAMAI-BEGIN {"id":"json.policy-a-session","channel":"json","states":["partial"],"format":"json-template","kind":"template"}
{"sessionControls":{{json:policies.unmanagedBrowser.a.target.sessionControls}}}
@@IAMAI-END

@@IAMAI-BEGIN {"id":"json.policy-b-conditions","channel":"json","states":["partial"],"format":"json-template","kind":"template"}
{"conditions":{{json:policies.unmanagedBrowser.b.target.conditions}}}
@@IAMAI-END

@@IAMAI-BEGIN {"id":"json.policy-b-session","channel":"json","states":["partial"],"format":"json-template","kind":"template"}
{"sessionControls":{{json:policies.unmanagedBrowser.b.target.sessionControls}}}
@@IAMAI-END

@@IAMAI-BEGIN {"id":"json.enforce","channel":"json","states":["readyToEnforce"],"format":"json","kind":"template"}
{"state":"enabled"}
@@IAMAI-END

@@IAMAI-BEGIN {"id":"powershell.composite","channel":"powershell","states":["configurePrerequisite","missing","partial","reportOnly","readyToEnforce","notLicensed"],"format":"powershell","kind":"template"}
param(
 [Parameter(Mandatory=$true)][ValidateSet('ConfigureSharePoint','CreateA','CreateB','StageA','StageB','CorrectA','CorrectB','Observe','EnforceA','EnforceB','Verify')][string]$Mode,
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
function Stage([string]$which){$id=IdFor $which;$u="$G/identity/conditionalAccess/policies/$id";$x=IG GET $u;if([string]$x.state -eq 'enabled'){IG PATCH $u @{state='enabledForReportingButNotEnforced'}|Out-Null}}
function Correct([string]$which){$t=Target $which;$id=IdFor $which;$u="$G/identity/conditionalAccess/policies/$id";$x=IG GET $u;if([string]$x.state -eq 'enabled'){throw 'Refusing correction while policy is On. Stage first.'};IG PATCH $u @{displayName=$t.displayName;conditions=$t.conditions;grantControls=$null;sessionControls=$t.sessionControls}|Out-Null}
function Enforce([string]$which){$t=Target $which;$id=IdFor $which;$u="$G/identity/conditionalAccess/policies/$id";$x=IG GET $u;if([string]$x.state -ne 'enabledForReportingButNotEnforced'){throw 'Refusing enforcement: policy is not Report-only.'};if(-not (Same $x.conditions $t.conditions)){throw 'Conditions mismatch.'};if($null -ne $x.grantControls){throw 'Grant must remain null.'};if(-not (Same $x.sessionControls $t.sessionControls)){throw 'Session controls mismatch.'};IG PATCH $u @{state='enabled'}|Out-Null}
switch($Mode){'CreateA'{Create 'A'}'CreateB'{Create 'B'}'StageA'{Stage 'A'}'StageB'{Stage 'B'}'CorrectA'{Correct 'A'}'CorrectB'{Correct 'B'}'EnforceA'{Enforce 'A'}'EnforceB'{Enforce 'B'}}
$out=@()
foreach($w in @('A','B')){$id=if($w -eq 'A'){$PolicyAId}else{$PolicyBId};if($id){GuidOk $id "Policy${w}Id";$x=IG GET "$G/identity/conditionalAccess/policies/$id";$out+=[pscustomobject]@{Policy=$w;Id=$x.id;State=$x.state;DisplayName=$x.displayName;GrantIsNull=($null -eq $x.grantControls)}}
$out
@@IAMAI-END

@@IAMAI-BEGIN {"id":"ai.prerequisite","channel":"aiInfo","states":["configurePrerequisite"],"format":"markdown","kind":"template"}
**Contains tenant context. Review before sharing with an external AI service.**

Review the SharePoint unmanaged-device prerequisite for {{tenant.displayName}}. Current mode: {{sharepoint.unmanagedDevices.currentMode}}. Explain the documented CA side effect and require a fresh IAMAI rescan before any stable CA policy ID is reused.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"ai.create","channel":"aiInfo","states":["missing"],"format":"markdown","kind":"template"}
**Contains tenant context. Review before sharing with an external AI service.**

Review the two-policy **Limit Unmanaged Devices in the Browser** target for {{tenant.displayName}}. Confirm SharePoint `AllowLimitedAccess` was configured and rescanned first; confirm Policy A uses application-enforced restrictions; confirm Policy B uses `cloudAppSecurity:blockDownloads` only when Defender for Cloud Apps is actually licensed. Do not invent source policy IDs.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"ai.correct","channel":"aiInfo","states":["partial"],"format":"markdown","kind":"template"}
**Contains tenant context. Review before sharing with an external AI service.**

These unmanaged-browser mismatches remain: {{policies.unmanagedBrowser.semanticMismatches}}. Recommend corrections only against post-rescan stable tenant IDs and keep SharePoint configuration outside CA JSON.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"ai.observe","channel":"aiInfo","states":["reportOnly"],"format":"markdown","kind":"template"}
**Contains tenant context. Review before sharing with an external AI service.**

Assess the unmanaged-browser Report-only evidence in {{tenant.displayName}}: {{evidence.reportOnly}}. Confirm the SharePoint tenant mode separately and evaluate both applicable CA policies independently.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"ai.enforce","channel":"aiInfo","states":["readyToEnforce"],"format":"markdown","kind":"template"}
**Contains tenant context. Review before sharing with an external AI service.**

Perform final pre-enforcement review of both applicable unmanaged-browser policies. Verify stable post-rescan IDs, canonical filters/session controls, null grants, SharePoint prerequisite, and the Defender dependency for Policy B.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"ai.blocked","channel":"aiInfo","states":["blocked","needsDecision","sourceConflict"],"format":"markdown","kind":"template"}
**Contains tenant context. Review before sharing with an external AI service.**

Explain why **Limit Unmanaged Devices in the Browser** is not actionable using only: {{dependencies.blockers}}. Do not invent stable member IDs, license state, or a substitute device policy.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"ai.not-licensed","channel":"aiInfo","states":["notLicensed"],"format":"markdown","kind":"template"}
**Contains tenant context. Review before sharing with an external AI service.**

`license.defenderCloudApps` is {{license.defenderCloudApps}}. Explain exactly which part of the two-policy target remains unavailable. Do not claim Policy A alone satisfies the full merged baseline step.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"email.rollout","channel":"email","states":["missing"],"format":"markdown","kind":"template"}
Subject: Unmanaged-browser restrictions entering validation

Hi,

We are validating limited browser access for {{tenant.displayName}} on unmanaged computers. The goal is to keep browser access available while preventing protected files from being freely downloaded, printed, or synced to unmanaged devices.

{{signature}}
@@IAMAI-END

@@IAMAI-BEGIN {"id":"email.enforce","channel":"email","states":["readyToEnforce"],"format":"markdown","kind":"template"}
Subject: Unmanaged-browser restrictions ready to enforce

Hi,

Unmanaged-browser restrictions for {{tenant.displayName}} are ready to enforce after service and Report-only validation. On a personal/unmanaged computer, use the browser-limited experience or a managed device for full file access.

{{signature}}
@@IAMAI-END

@@IAMAI-BEGIN {"id":"readiness.model","channel":"readiness","states":["configurePrerequisite","missing","partial","reportOnly","readyToEnforce","inPlace","blocked","needsDecision","notLicensed"],"format":"markdown","kind":"template"}
Ready only when SharePoint unmanaged-device mode is verified after propagation, IAMAI has rescanned after any SharePoint change, both applicable CA policies are canonical by current stable ID, unmanaged-browser behavior is tested, and Policy B licensing is explicitly satisfied or explicitly remains not licensed without falsely completing the step.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"troubleshooting.model","channel":"troubleshooting","states":["configurePrerequisite","missing","partial","reportOnly","readyToEnforce","inPlace","notLicensed"],"format":"markdown","kind":"template"}
If access behavior or IDs change after the SharePoint setting, stop and rescan before touching CA. For unexpected restrictions, separate SharePoint tenant behavior, Policy A application-enforced restrictions, Policy B Defender session control, device-filter claims, and browser/platform support. Do not troubleshoot by adding user exclusions first.
@@IAMAI-END

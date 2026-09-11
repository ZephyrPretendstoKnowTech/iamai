@@IAMAI-BEGIN {"id":"entra.create","channel":"entra","states":["missing"],"format":"markdown","kind":"template"}
1. Open **Entra ID > Conditional Access > Policies > New policy**.
2. Name: **{{policy.target.displayName}}**.
3. Configure exactly this canonical scope: **Target resources > User actions > Register security information**. Apply the exact IAMAI-resolved Users/exclusions and Location mode. `blockOutsideTrusted` means Any location with All trusted locations excluded; the no-trusted-network fallback uses the resolved MFA target instead.
4. Grant/access control: Use **{{policy.target.mode}}** exactly as resolved by IAMAI and match the canonical grant. Do not improvise a third mode.
5. Leave session controls unconfigured; this package's canonical `sessionControls` target is null.
6. Set **Enable policy: Report-only** and create it.
7. Re-open the created policy, compare it with the IAMAI target, then rescan.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"entra.correct-conditions","channel":"entra","states":["partial"],"format":"markdown","kind":"template"}
Open the exact resolved policy by stable tenant ID **{{policy.current.id}}**. If it is **On**, move that same policy to **Report-only** before changing any access-affecting assignment or condition. Replace the complete `conditions` object with the IAMAI-resolved canonical target; do not create a replacement policy.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"entra.correct-grant","channel":"entra","states":["partial"],"format":"markdown","kind":"template"}
Open **{{policy.current.id}}**. If it is **On**, move it to **Report-only** first. Replace the complete Grant controls with the IAMAI-resolved canonical grant. Do not preserve a stronger/weaker control merely because it already exists; this step follows the resolved baseline target.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"entra.correct-session","channel":"entra","states":["partial"],"format":"markdown","kind":"template"}
Open **{{policy.current.id}}**. If it is **On**, move it to **Report-only** first. Remove non-canonical session controls from this policy; session behavior belongs to separate baseline goals unless explicitly present in the resolved target.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"entra.correct-name","channel":"entra","states":["partial"],"format":"markdown","kind":"template"}
Rename the same resolved policy to **{{policy.target.displayName}}**. Display name is never update identity; the stable tenant policy ID remains authoritative.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"entra.correct-verify","channel":"entra","states":["partial"],"format":"markdown","kind":"template"}
Re-open the same policy by stable ID, verify the corrected fields against the canonical target, and rescan IAMAI. Any policy staged to Report-only stays there until a separate Ready-to-enforce state is reached.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"entra.observe","channel":"entra","states":["reportOnly"],"format":"markdown","kind":"template"}
Leave the policy in **Report-only**. Review Conditional Access report-only results and the step-specific evidence. Do not infer safety from a quiet dashboard; investigate relevant sign-ins and known dependencies before enforcement.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"entra.enforce","channel":"entra","states":["readyToEnforce"],"format":"markdown","kind":"template"}
Re-open the exact policy by stable tenant ID. Confirm it is still **Report-only**, the conditions/grant/session controls are canonical, and the step-specific evidence is clear. Change **Enable policy** to **On**, test the expected sign-in path plus emergency access, then rescan IAMAI.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"json.target-policy","channel":"json","states":["missing"],"format":"json-template","kind":"template"}
{"displayName":{{json:policy.target.displayName}},"state":"enabledForReportingButNotEnforced","conditions":{{json:policy.target.conditions}},"grantControls":{{json:policy.target.grantControls}},"sessionControls":null}
@@IAMAI-END

@@IAMAI-BEGIN {"id":"json.correct-conditions","channel":"json","states":["partial"],"format":"json-template","kind":"template"}
{"conditions":{{json:policy.target.conditions}}}
@@IAMAI-END

@@IAMAI-BEGIN {"id":"json.correct-grant","channel":"json","states":["partial"],"format":"json-template","kind":"template"}
{"grantControls":{{json:policy.target.grantControls}}}
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
 [Parameter(Mandatory=$true)][ValidateSet('Create','StageForCorrection','CorrectConditions','CorrectGrant','CorrectSession','CorrectName','Observe','Enforce','Verify')][string]$Mode,
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
if($Mode -eq 'StageForCorrection'){
 $pre=IG GET $uri
 if([string]$pre.state -eq 'enabled'){IG PATCH $uri @{state='enabledForReportingButNotEnforced'}|Out-Null; Write-Host 'Moved policy to Report-only before semantic correction.'}
}
if($Mode -in @('CorrectConditions','CorrectGrant','CorrectSession')){
 $pre=IG GET $uri
 if([string]$pre.state -eq 'enabled'){throw 'Refusing access-affecting correction while policy is On. Run StageForCorrection first, then correct and revalidate.'}
}
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

Review the proposed **Protect Sign-in Method Registration** implementation for {{tenant.displayName}}. Confirm the canonical target is complete, tenant-resolved, Report-only first, and contains no invented exclusions or source-tenant IDs.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"ai.correct","channel":"aiInfo","states":["partial"],"format":"markdown","kind":"template"}
**Contains tenant context. Review before sharing with an external AI service.**

Policy {{policy.current.id}} has these mismatches for **Protect Sign-in Method Registration**: {{policy.current.semanticMismatches}}. Explain only the smallest API-safe corrections. If an access-affecting change is needed while the policy is On, stage the same policy to Report-only first.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"ai.observe","channel":"aiInfo","states":["reportOnly"],"format":"markdown","kind":"template"}
**Contains tenant context. Review before sharing with an external AI service.**

Assess the Report-only evidence for **Protect Sign-in Method Registration** in {{tenant.displayName}}: {{evidence.reportOnly}}. Do not recommend enforcement unless the step-specific dependencies are actually clear.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"ai.enforce","channel":"aiInfo","states":["readyToEnforce"],"format":"markdown","kind":"template"}
**Contains tenant context. Review before sharing with an external AI service.**

Perform a final pre-enforcement review for **Protect Sign-in Method Registration** in {{tenant.displayName}}. Confirm the stable tenant policy is still Report-only, canonical, and safe to enable; do not redesign the baseline.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"ai.blocked","channel":"aiInfo","states":["blocked","needsDecision","sourceConflict"],"format":"markdown","kind":"template"}
**Contains tenant context. Review before sharing with an external AI service.**

Explain why **Protect Sign-in Method Registration** is not actionable yet using only these known blockers/decisions: {{dependencies.blockers}}. Do not invent a bypass, new exclusion, or source resolution.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"ai.not-licensed","channel":"aiInfo","states":["notLicensed"],"format":"markdown","kind":"template"}
**Contains tenant context. Review before sharing with an external AI service.**

Explain that **Protect Sign-in Method Registration** requires the applicable Microsoft Entra Conditional Access licensing. Keep implementation non-actionable until licensing is resolved; do not weaken the goal.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"email.rollout","channel":"email","states":["missing"],"format":"markdown","kind":"template"}
Subject: Sign-in method registration policy entering validation

Hi,

We are validating a policy that protects how sign-in methods are registered in {{tenant.displayName}}. Depending on the tenant's resolved trusted-network design, method registration may require the trusted network or an MFA bootstrap path. We will validate the actual registration workflows in Report-only before enforcement.

{{signature}}
@@IAMAI-END

@@IAMAI-BEGIN {"id":"email.enforce","channel":"email","states":["readyToEnforce"],"format":"markdown","kind":"template"}
Subject: Sign-in method registration protection enforcement

Hi,

The sign-in method registration protection for {{tenant.displayName}} is ready to enforce after Report-only validation. If a legitimate registration is blocked, contact IT rather than adding a user exclusion.

{{signature}}
@@IAMAI-END

@@IAMAI-BEGIN {"id":"readiness.model","channel":"readiness","states":["missing","partial","reportOnly","readyToEnforce","inPlace","blocked","needsDecision"],"format":"markdown","kind":"template"}
Ready only when IAMAI has resolved `{{policy.target.mode}}`, canonical exclusions and any trusted location are valid, report-only registration evidence is understood, and affected Windows Hello for Business/macOS Platform SSO registration workflows have been considered after the July 6, 2026 platform change.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"troubleshooting.model","channel":"troubleshooting","states":["missing","partial","reportOnly","readyToEnforce","inPlace"],"format":"markdown","kind":"template"}
If registration fails, inspect Conditional Access results for the **Register security information** user action, the network/trusted-location match, and the bootstrap method used. For WHfB/macOS Platform SSO failures, remember that these credential-registration flows became subject to registration-targeting CA policies beginning July 6, 2026.
@@IAMAI-END

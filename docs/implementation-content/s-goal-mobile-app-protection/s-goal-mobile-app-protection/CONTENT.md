@@IAMAI-BEGIN {"id":"entra.intune-prerequisite","channel":"entra","states":["configurePrerequisite"],"format":"markdown","kind":"template"}
1. In **Microsoft Intune admin center > Apps > Protection**, inspect the tenant's existing App Protection policies.
2. Verify/create the source-required policy coverage separately for **iOS/iPadOS** and **Android**. Preserve IAMAI's intended Microsoft-app/user assignment; require the source-described PIN and block save-as to unmanaged locations.
3. Do not invent tenant group IDs or silently broaden the APP baseline.
4. Record the real resulting APP state in `{{intune.appProtection.prerequisiteState}}`, then rescan IAMAI.
5. Do not proceed to CA enforcement until IAMAI classifies this prerequisite as satisfied.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"entra.create","channel":"entra","states":["missing"],"format":"markdown","kind":"template"}
1. Open **Entra ID > Conditional Access > Policies > New policy**.
2. Name: **{{policy.target.displayName}}**.
3. Apply the IAMAI-resolved canonical conditions exactly; do not substitute source-tenant IDs or broaden/narrow the population.
4. Configure the canonical grant and session controls exactly as described in STEP.md.
5. Set **Enable policy: Report-only** and create it.
6. Re-open the policy, compare all security-significant fields with IAMAI, and rescan.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"entra.correct-conditions","channel":"entra","states":["partial"],"format":"markdown","kind":"template"}
Open the exact policy by stable tenant ID **{{policy.current.id}}**. If it is On, move that same policy to **Report-only** first. Replace the complete Conditions object with IAMAI's canonical target; do not create a replacement policy.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"entra.correct-grant","channel":"entra","states":["partial"],"format":"markdown","kind":"template"}
Open **{{policy.current.id}}**. If it is On, move it to **Report-only** first. Replace Grant controls with the canonical target, including an intentional `None`/unconfigured grant when STEP.md says this is a session-only policy.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"entra.correct-session","channel":"entra","states":["partial"],"format":"markdown","kind":"template"}
Open **{{policy.current.id}}**. If it is On, move it to **Report-only** first. Replace Session controls with the complete canonical target; remove non-canonical controls rather than leaving accidental extras.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"entra.correct-name","channel":"entra","states":["partial"],"format":"markdown","kind":"template"}
Rename the same stable policy to **{{policy.target.displayName}}** only when name is the mismatch. Display name is never update identity.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"entra.correct-verify","channel":"entra","states":["partial"],"format":"markdown","kind":"template"}
Re-open the same policy by stable ID, compare the corrected object to IAMAI's canonical target, and rescan. A policy staged to Report-only stays there until Ready to enforce.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"entra.observe","channel":"entra","states":["reportOnly"],"format":"markdown","kind":"template"}
Leave the policy in **Report-only**. Review the report-only results plus the step-specific evidence described in STEP.md. Do not treat a quiet dashboard as proof. Confirm the Intune APP prerequisite independently. Do not interpret Report-only failure for the app-protection grant as automatic proof that the enabled flow will fail.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"entra.enforce","channel":"entra","states":["readyToEnforce"],"format":"markdown","kind":"template"}
Re-open the exact policy by stable tenant ID. Confirm it is still Report-only, every security-significant field is canonical, prerequisites are verified, and emergency access remains viable. Change **Enable policy** to **On**, test expected and emergency paths, then rescan IAMAI.
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

@@IAMAI-BEGIN {"id":"powershell.run","channel":"powershell","states":["missing","partial","reportOnly","readyToEnforce"],"format":"powershell","kind":"template"}
param(
 [Parameter(Mandatory=$true)][ValidateSet('Create','StageForCorrection','CorrectConditions','CorrectGrant','CorrectSession','CorrectName','Observe','Enforce','Verify')][string]$Mode,
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
if($Mode -eq 'StageForCorrection'){$pre=IG GET $uri;if([string]$pre.state -eq 'enabled'){IG PATCH $uri @{state='enabledForReportingButNotEnforced'}|Out-Null;Write-Host 'Moved policy to Report-only before semantic correction.'}}
if($Mode -in @('CorrectConditions','CorrectGrant','CorrectSession')){$pre=IG GET $uri;if([string]$pre.state -eq 'enabled'){throw 'Refusing access-affecting correction while policy is On. Run StageForCorrection first.'}}
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
**Contains tenant context. Review before sharing with an external AI service.**

Review the proposed **Require App Protection on Phones** implementation for {{tenant.displayName}}. Confirm the canonical target matches the pinned IAMAI destination, is fully tenant-resolved, starts Report-only, and contains no invented IDs or decisions. Confirm the Intune APP prerequisite independently. Do not interpret Report-only failure for the app-protection grant as automatic proof that the enabled flow will fail.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"ai.correct","channel":"aiInfo","states":["partial"],"format":"markdown","kind":"template"}
**Contains tenant context. Review before sharing with an external AI service.**

Policy {{policy.current.id}} has these mismatches for **Require App Protection on Phones**: {{policy.current.semanticMismatches}}. Recommend only the smallest API-safe corrections to reach the canonical target. Stage an enabled policy to Report-only before access-affecting correction.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"ai.observe","channel":"aiInfo","states":["reportOnly"],"format":"markdown","kind":"template"}
**Contains tenant context. Review before sharing with an external AI service.**

Assess Report-only evidence for **Require App Protection on Phones** in {{tenant.displayName}}: {{evidence.reportOnly}}. Use the exact readiness conditions in STEP.md and do not recommend enforcement merely because no failures appeared.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"ai.enforce","channel":"aiInfo","states":["readyToEnforce"],"format":"markdown","kind":"template"}
**Contains tenant context. Review before sharing with an external AI service.**

Perform the final pre-enforcement review for **Require App Protection on Phones** in {{tenant.displayName}}. Confirm stable identity, canonical conditions/grant/session, prerequisite evidence, Report-only observation, and emergency-access safety.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"ai.blocked","channel":"aiInfo","states":["blocked","needsDecision","sourceConflict"],"format":"markdown","kind":"template"}
**Contains tenant context. Review before sharing with an external AI service.**

Explain why **Require App Protection on Phones** is not actionable using only these known blockers/decisions: {{dependencies.blockers}}. Do not invent an exception, owner choice, or alternate baseline.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"ai.not-licensed","channel":"aiInfo","states":["notLicensed"],"format":"markdown","kind":"template"}
**Contains tenant context. Review before sharing with an external AI service.**

Explain the licensing blocker for **Require App Protection on Phones** in {{tenant.displayName}} using IAMAI's known license facts. Do not weaken the baseline to avoid the requirement.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"email.rollout","channel":"email","states":["missing"],"format":"markdown","kind":"template","audience":"affected-users"}
Subject: Protected mobile apps entering validation

Hi,

We are validating protected mobile-app access for {{tenant.displayName}}. Company mail and files on phones will need to open in apps covered by the organization’s Intune App Protection policies. Native or unsupported apps may need to be replaced with the supported Microsoft app.

{{signature}}
@@IAMAI-END

@@IAMAI-BEGIN {"id":"email.enforce","channel":"email","states":["readyToEnforce"],"format":"markdown","kind":"template","audience":"affected-users"}
Subject: Protected mobile apps ready to enforce

Hi,

Mobile app protection for {{tenant.displayName}} is ready to enforce after Intune and Report-only validation. Use the supported protected Microsoft apps for company data on Android and iPhone/iPad. Contact IT if a supported app is unexpectedly blocked.

{{signature}}
@@IAMAI-END

@@IAMAI-BEGIN {"id":"readiness.model","channel":"readiness","states":["missing","partial","reportOnly","readyToEnforce","inPlace","blocked","needsDecision"],"format":"markdown","kind":"template"}
Ready only when the real iOS/iPadOS and Android Intune APP prerequisite is satisfied, the CA policy uses `compliantApplication` on Android+iOS with canonical scope, supported mobile-app/broker workflows have been tested, and Report-only evidence is reviewed.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"troubleshooting.model","channel":"troubleshooting","states":["missing","partial","reportOnly","readyToEnforce","inPlace"],"format":"markdown","kind":"template"}
If a supported mobile app is blocked, first check APP assignment, app support, Entra device registration/broker state, and platform. If a native/unsupported app is blocked, move the user to the supported protected app rather than adding a CA bypass.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"ai.prerequisite","channel":"aiInfo","states":["configurePrerequisite"],"format":"markdown","kind":"template"}
**Contains tenant context. Review before sharing with an external AI service.**

Review the Intune App Protection prerequisite for **Require App Protection on Phones** in {{tenant.displayName}}. Current prerequisite state: {{intune.appProtection.prerequisiteState}}. Confirm iOS/iPadOS and Android policy coverage matches the pinned source-described behavior without inventing policy IDs, assignments, or extra settings.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"entra.create-pair","channel":"entra","states":["missing"],"format":"markdown","kind":"template"}
Create the two IAMAI-resolved guest policies separately, both **Report-only**:

1. **{{policies.guests.strong.target.displayName}}** — use the complete resolved strong-member users object, All resources, all client apps, no extra conditions, and the tenant-local baseline authentication strength.
2. **{{policies.guests.mixed.target.displayName}}** — use the complete resolved mixed-member users object, All resources, all client apps, no extra conditions, and built-in MFA.

If one creation fails, leave the one already created in Report-only. Do not enable either policy until both are canonical and validated.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"entra.correct-pair","channel":"entra","states":["partial"],"format":"markdown","kind":"template"}
Open the exact resolved pair by stable tenant IDs: strong **{{policies.guests.strong.current.id}}**, mixed **{{policies.guests.mixed.current.id}}**. Correct only the member(s) IAMAI identifies as mismatched, using their complete tenant-resolved users objects. Preserve the two-member split and their different grants; do not merge them.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"entra.partner-trust","channel":"entra","states":["partnerTrustRequired"],"format":"markdown","kind":"template"}
For each **owner-approved ordinary B2B partner tenant** in the resolved trust patch set, open **External Identities > Cross-tenant access settings > Organizational settings > [partner] > Inbound access > Trust settings** and enable **Trust multifactor authentication from Microsoft Entra tenants** only as approved. Preserve existing device trust choices. Do not apply this step to GDAP/service-provider sign-ins.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"entra.observe","channel":"entra","states":["reportOnly"],"format":"markdown","kind":"template"}
Review Report-only results for both guest policies. Test representative external identity types/home tenants. Confirm stronger-tier users can satisfy the tenant-local strength and mixed-tier users can satisfy MFA. Keep both policies Report-only until the pair is ready.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"entra.enforce-pair","channel":"entra","states":["readyToEnforce"],"format":"markdown","kind":"template"}
Re-open both exact policies, confirm both are canonical and Report-only and any required partner trust is already correct, then enable both in one controlled change window. Validate representative guest access and rescan IAMAI.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"json.target-pair","channel":"json","states":["missing","partial"],"format":"json-template","kind":"template"}
{"kind":"conditionalAccessPolicyPair","policies":[{"role":"strong","displayName":{{json:policies.guests.strong.target.displayName}},"state":"enabledForReportingButNotEnforced","conditions":{"applications":{"includeApplications":["All"],"excludeApplications":[],"includeUserActions":[],"includeAuthenticationContextClassReferences":[]},"clientAppTypes":["all"],"servicePrincipalRiskLevels":[],"signInRiskLevels":[],"userRiskLevels":[],"users":{{json:policies.guests.strong.target.users}}},"grantControls":{"operator":"OR","builtInControls":[],"customAuthenticationFactors":[],"termsOfUse":[],"authenticationStrength":{"id":{{json:authStrength.target.id}}}},"sessionControls":null},{"role":"mixed","displayName":{{json:policies.guests.mixed.target.displayName}},"state":"enabledForReportingButNotEnforced","conditions":{"applications":{"includeApplications":["All"],"excludeApplications":[],"includeUserActions":[],"includeAuthenticationContextClassReferences":[]},"clientAppTypes":["all"],"servicePrincipalRiskLevels":[],"signInRiskLevels":[],"userRiskLevels":[],"users":{{json:policies.guests.mixed.target.users}}},"grantControls":{"operator":"OR","builtInControls":["mfa"],"customAuthenticationFactors":[],"termsOfUse":[]},"sessionControls":null}]}
@@IAMAI-END

@@IAMAI-BEGIN {"id":"json.partner-trust","channel":"json","states":["partnerTrustRequired"],"format":"json-template","kind":"template"}
{"kind":"resolvedCrossTenantInboundTrustPatchSet","partners":{{json:partnerTrust.resolvedPatches}},"rule":"Each item must contain tenantId and the complete resolved inboundTrust object so existing compliant-device/hybrid-join trust values are preserved. Do not use this for GDAP."}
@@IAMAI-END

@@IAMAI-BEGIN {"id":"json.enforce-pair","channel":"json","states":["readyToEnforce"],"format":"json","kind":"template"}
{"state":"enabled","applyTo":"both canonical guest policy IDs in one controlled change window"}
@@IAMAI-END

@@IAMAI-BEGIN {"id":"powershell.run","channel":"powershell","states":["missing","partial","partnerTrustRequired","reportOnly","readyToEnforce"],"format":"powershell","kind":"template"}
param(
 [Parameter(Mandatory=$true)][ValidateSet('CreateMissing','CorrectPair','ApplyPartnerTrust','Observe','EnforcePair','Verify')][string]$Mode,
 [Parameter(Mandatory=$true)][string]$TargetPoliciesJson,
 [string]$StrongPolicyId,
 [string]$MixedPolicyId,
 [string]$PartnerTrustJson='[]'
)
$ErrorActionPreference='Stop'
$scopes=@('Policy.Read.All','Policy.ReadWrite.ConditionalAccess')
if($Mode -eq 'ApplyPartnerTrust'){$scopes += 'Policy.ReadWrite.CrossTenantAccess'}
Connect-MgGraph -Scopes $scopes -NoWelcome
$G='https://graph.microsoft.com/v1.0'
function GuidOk([string]$v,[string]$n){$g=[guid]::Empty;if(-not [guid]::TryParse($v,[ref]$g)){throw "$n must be a GUID."}}
function IG($m,$u,$b=$null){if($null -eq $b){return Invoke-MgGraphRequest -Method $m -Uri $u -OutputType PSObject};Invoke-MgGraphRequest -Method $m -Uri $u -Body ($b|ConvertTo-Json -Depth 80) -ContentType 'application/json' -OutputType PSObject}
function Project($actual,$target){if($null -eq $target){return $actual};if($target -is [string] -or $target -is [bool] -or $target -is [int] -or $target -is [long] -or $target -is [double]){return $actual};if($target -is [System.Collections.IEnumerable] -and -not ($target -is [string])){return @($actual)};$h=[ordered]@{};foreach($p in $target.PSObject.Properties){$h[$p.Name]=Project $actual.($p.Name) $p.Value};return [pscustomobject]$h}
function Norm($v){if($null -eq $v){return $null};if($v -is [string] -or $v -is [bool] -or $v -is [int] -or $v -is [long] -or $v -is [double]){return $v};if($v -is [System.Collections.IEnumerable] -and -not ($v -is [string])){$a=@($v|%{Norm $_});return @($a|Sort-Object {$_|ConvertTo-Json -Depth 80 -Compress})};$h=[ordered]@{};foreach($p in ($v.PSObject.Properties.Name|Sort-Object)){$h[$p]=Norm $v.$p};return [pscustomobject]$h}
function Same($a,$t){return (((Norm (Project $a $t))|ConvertTo-Json -Depth 80 -Compress) -eq ((Norm $t)|ConvertTo-Json -Depth 80 -Compress))}
$targets=@($TargetPoliciesJson|ConvertFrom-Json)
if($targets.Count -ne 2){throw 'TargetPoliciesJson must contain exactly two canonical guest policy targets.'}
$strong=$targets|Where-Object role -eq 'strong';$mixed=$targets|Where-Object role -eq 'mixed'
if($null -eq $strong -or $null -eq $mixed){throw 'Targets must contain role=strong and role=mixed.'}
if($Mode -eq 'ApplyPartnerTrust'){
 $patches=@($PartnerTrustJson|ConvertFrom-Json)
 foreach($p in $patches){GuidOk ([string]$p.tenantId) 'Partner tenant id';if($null -eq $p.inboundTrust){throw 'Each partner trust patch must include the complete resolved inboundTrust object.'};$u="$G/policies/crossTenantAccessPolicy/partners/$($p.tenantId)";try{$cur=IG GET $u;IG PATCH $u @{inboundTrust=$p.inboundTrust}|Out-Null}catch{throw "Could not update existing partner-specific cross-tenant configuration for $($p.tenantId). Create/relationship state must be resolved before this package patches trust: $($_.Exception.Message)"};$after=IG GET $u;[pscustomobject]@{PartnerTenant=$p.tenantId;InboundTrust=$after.inboundTrust}}
 exit 0
}
$ids=@{strong=$StrongPolicyId;mixed=$MixedPolicyId}
if($Mode -eq 'CreateMissing'){
 foreach($t in @($strong,$mixed)){
  $id=[string]$ids[$t.role]
  if([string]::IsNullOrWhiteSpace($id)){
   $body=[ordered]@{displayName=$t.displayName;state='enabledForReportingButNotEnforced';conditions=$t.conditions;grantControls=$t.grantControls;sessionControls=$t.sessionControls}
   $c=IG POST "$G/identity/conditionalAccess/policies" $body
   $ids[$t.role]=[string]$c.id
   Write-Host "Created $($t.role) guest policy $($c.id) in Report-only."
  }
 }
}
foreach($role in @('strong','mixed')){GuidOk ([string]$ids[$role]) "$role policy id"}
if($Mode -eq 'CorrectPair'){
 foreach($t in @($strong,$mixed)){
   $id=[string]$ids[$t.role]
   IG PATCH "$G/identity/conditionalAccess/policies/$id" @{displayName=$t.displayName;conditions=$t.conditions;grantControls=$t.grantControls;sessionControls=$t.sessionControls}|Out-Null
 }
}
if($Mode -eq 'EnforcePair'){
 $changed=@()
 try{
  foreach($t in @($strong,$mixed)){
   $id=[string]$ids[$t.role];$a=IG GET "$G/identity/conditionalAccess/policies/$id"
   if([string]$a.state -ne 'enabledForReportingButNotEnforced'){throw "$($t.role) policy is not Report-only."}
   if(-not (Same $a.conditions $t.conditions) -or -not (Same $a.grantControls $t.grantControls) -or -not (Same $a.sessionControls $t.sessionControls)){throw "$($t.role) policy is not canonical."}
  }
  foreach($t in @($strong,$mixed)){$id=[string]$ids[$t.role];IG PATCH "$G/identity/conditionalAccess/policies/$id" @{state='enabled'}|Out-Null;$changed+=$id}
 }catch{
  foreach($id in $changed){try{IG PATCH "$G/identity/conditionalAccess/policies/$id" @{state='enabledForReportingButNotEnforced'}|Out-Null}catch{Write-Warning "Rollback to Report-only failed for $id"}}
  throw
 }
}
foreach($t in @($strong,$mixed)){
 $id=[string]$ids[$t.role];$a=IG GET "$G/identity/conditionalAccess/policies/$id"
 [pscustomobject]@{Role=$t.role;PolicyId=$a.id;DisplayName=$a.displayName;State=$a.state;ConditionsCanonical=(Same $a.conditions $t.conditions);GrantCanonical=(Same $a.grantControls $t.grantControls);SessionCanonical=(Same $a.sessionControls $t.sessionControls)}
}
@@IAMAI-END

@@IAMAI-BEGIN {"id":"ai.create","channel":"aiInfo","states":["missing"],"format":"markdown","kind":"template"}
**Contains tenant context. Review before sharing with an external AI service.**

Review the two guest policy targets for {{tenant.displayName}}. Confirm the pinned external-user type split, canonical partner/service-provider overlays, tenant-local strength on the strong member, built-in MFA on the mixed member, and Report-only-first deployment. Do not collapse the pair.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"ai.correct","channel":"aiInfo","states":["partial"],"format":"markdown","kind":"template"}
**Contains tenant context. Review before sharing with an external AI service.**

Guest policy mismatches: {{policies.guests.semanticMismatches}}. Explain the smallest corrections to the exact strong/mixed policy identities without changing the saved partner/service-provider decision or merging the policies.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"ai.partner-trust","channel":"aiInfo","states":["partnerTrustRequired"],"format":"markdown","kind":"template"}
**Contains tenant context. Review before sharing with an external AI service.**

Review these owner-approved ordinary-B2B inbound MFA trust patches: {{partnerTrust.resolvedPatches}}. Confirm they preserve existing device-trust values and are not being applied to GDAP/service-provider access.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"ai.observe","channel":"aiInfo","states":["reportOnly"],"format":"markdown","kind":"template"}
**Contains tenant context. Review before sharing with an external AI service.**

Review Report-only guest evidence for both policy members: {{evidence.reportOnly}}. Distinguish external identity type/home-tenant behavior from policy misconfiguration before recommending enforcement.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"ai.enforce","channel":"aiInfo","states":["readyToEnforce"],"format":"markdown","kind":"template"}
**Contains tenant context. Review before sharing with an external AI service.**

Confirm both guest policy members in {{tenant.displayName}} are canonical, Report-only, and validated across representative guest types, with any ordinary-B2B inbound MFA trust already owner-approved and correct.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"ai.blocked","channel":"aiInfo","states":["blocked","needsDecision","sourceConflict"],"format":"markdown","kind":"template"}
**Contains tenant context. Review before sharing with an external AI service.**

Explain why guest MFA is not actionable yet using only these blockers/decisions: {{dependencies.blockers}}. Do not invent partner trust, service-provider exclusions, or external tenant IDs.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"ai.not-licensed","channel":"aiInfo","states":["notLicensed"],"format":"markdown","kind":"template"}
**Contains tenant context. Review before sharing with an external AI service.**

Explain the Conditional Access licensing prerequisite and leave the guest MFA package non-actionable until licensing is resolved.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"email.rollout","channel":"email","states":["missing"],"format":"markdown","kind":"template"}
Subject: Guest MFA validation is starting

We are preparing guest and external-user MFA policies in Report-only first. External users may see different authentication behavior depending on their home tenant and identity type. No enforcement change is being made until representative guest access is validated.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"email.partner-trust","channel":"email","states":["partnerTrustRequired"],"format":"markdown","kind":"template"}
Subject: Confirm partner MFA trust change

We are ready to trust MFA claims from the specifically approved partner tenant for ordinary B2B access. This change does not create a blanket external-user exception and does not apply to GDAP. Existing device-trust settings will be preserved.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"email.enforce","channel":"email","states":["readyToEnforce"],"format":"markdown","kind":"template"}
Subject: Guest MFA policies are ready to enforce

The guest MFA policy pair has completed validation and is ready to be enabled. After enforcement, external users in scope must satisfy the MFA requirement appropriate to their guest policy path. Support should troubleshoot the external identity/home-tenant path rather than add permanent guest exclusions.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"readiness.model","channel":"readiness","states":["missing","partial","partnerTrustRequired","reportOnly","readyToEnforce"],"format":"json-template","kind":"template"}
{"tiles":[{"id":"guests","label":"Guest/external users","result":{{json:guests.affected.count}},"line":"Guest coverage is measured independently from internal All-users coverage."},{"id":"partnerTier","label":"Partner tier","result":{{json:guests.partnerTierSummary}},"line":"Saved partner decisions drive any trust/Service provider overlay."},{"id":"serviceProvider","label":"Service provider handling","result":{{json:guests.serviceProviderDecision}},"line":"GDAP and ordinary B2B trust are not interchangeable."},{"id":"states","label":"Policy pair state","result":{{json:policyPair.current.states}},"line":"Both members must be canonical before either is enforced."}],"baselineMembers":["f25f94e0-98b6-41be-b9d6-68cb781004a4","e0fabad3-bd0f-42e4-a901-51ef7ab8889c"]}
@@IAMAI-END

@@IAMAI-BEGIN {"id":"troubleshooting.model","channel":"troubleshooting","states":["missing","partial","partnerTrustRequired","reportOnly","readyToEnforce","inPlace"],"format":"json","kind":"referenceOnly"}
{"scenarios":[{"id":"guest-strength-not-supported","classification":"documented","symptom":"An external user cannot satisfy the authentication-strength guest member.","check":"Identify the external identity provider/type and whether authentication strength is supported for that path.","fix":"Do not weaken the strong member ad hoc. Confirm the user belongs in the correct pinned guest member and use the canonical mixed-MFA path only where the baseline assigns that type.","then":"Retest and rescan.","sources":["ms-guest-strength","ms-external-ca"]},{"id":"partner-mfa-double-prompt","classification":"documented","symptom":"An ordinary B2B partner user is prompted for MFA again in the resource tenant despite completing MFA at home.","check":"Confirm the partner-specific inbound trust decision and isMfaAccepted state.","fix":"If and only if the owner-approved partner tier requires it, correct the partner-specific inbound MFA trust while preserving other trust fields.","then":"Retest the B2B sign-in.","sources":["ms-cross-tenant","ms-cross-tenant-update"]},{"id":"gdap-trust-confusion","classification":"documented","symptom":"Someone proposes enabling ordinary inbound MFA trust to fix a GDAP technician sign-in.","check":"Confirm the sign-in is GDAP/service-provider access.","fix":"Do not change ordinary inbound trust for GDAP; Microsoft states GDAP MFA is always required in the home tenant and always trusted in the resource tenant.","then":"Troubleshoot the provider tenant/GDAP relationship instead.","sources":["ms-cross-tenant"]},{"id":"guest-pair-collapsed","classification":"derived","symptom":"One broad guest policy has replaced the two retained baseline members.","check":"Compare stable goal-map members and their distinct grants/user-type scopes.","fix":"Restore the two canonical policy members in Report-only; do not delete the broad replacement until overlap is reviewed.","then":"Validate the pair and rescan.","sources":["ms-external-users-graph","ms-ca-update"]}]}
@@IAMAI-END

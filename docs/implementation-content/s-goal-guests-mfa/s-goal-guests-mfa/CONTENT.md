@@IAMAI-BEGIN {"id":"entra.create-pair","channel":"entra","states":["missing"],"format":"markdown","kind":"template"}
Create the two guest policies separately, both in **Report-only**. They will not enforce their access rules until you enable them. Do not choose **On** here: a policy created On applies to everyone it covers from the moment you save, before anyone has seen who it would have stopped — the failure this plan exists to prevent. The script for this step can only create in Report-only. The policies cover different external-user types; use each policy's resolved users and exclusions.

1. **{{policies.guests.strong.target.displayName}}** — use this policy's resolved users and exclusions, All resources, all client apps, no extra conditions, and the authentication strength resolved for this tenant.
2. **{{policies.guests.mixed.target.displayName}}** — use this policy's resolved users and exclusions, All resources, all client apps, no extra conditions, and built-in MFA (**Require multifactor authentication**).

If one creation fails, leave the policy already created in Report-only. Do not enable either policy until both match their intended targets and have been validated.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"entra.correct-pair","channel":"entra","states":["partial"],"format":"markdown","kind":"template"}
This step manages two separate Conditional Access policies. The policies cover different external-user types. Apply each policy's resolved users and exclusions; the split is not simply trusted partners versus everyone else.

**Policy 1: {{policies.guests.strong.current.displayName}}** requires the authentication strength in the resolved target.

**Policy 2: {{policies.guests.mixed.current.displayName}}** requires built-in multifactor authentication.

Correct every setting that differs from each policy's resolved target, not only its exclusions. The JSON output for this correction shows each policy's complete target.

1. Go to Entra admin center → Conditional Access → Policies.
2. Open {{policies.guests.strong.current.displayName}} (use the policy name and ID shown on this step).
3. Name: set it to **{{policies.guests.strong.target.displayName}}**.
4. Users → Include → Guest or external users: select exactly the external-user types and external Microsoft Entra organizations in this policy's resolved target. Users → Exclude: match the resolved target's excluded guest types, users, groups and roles, including the exclusions group. Remove any exclusion the target does not list.
5. Target resources: All resources. Client apps: All. Remove any other condition.
6. Grant: **Grant access → Require authentication strength**, and select the authentication strength in the resolved target. Remove any other grant control.
7. Session: remove any session control the resolved target does not include.
8. Save. Leave **Enable policy** as it is: if the policy is On, the changed rule can affect access after you save.
   This change removes {{policies.guests.strong.current.removedExclusions}} from the exclusions of {{policies.guests.strong.current.displayName}}. If that policy is On, it applies to them as soon as you save. [omit this line when unavailable]
9. Open {{policies.guests.mixed.current.displayName}} (use the policy name and ID shown on this step).
10. Name: set it to **{{policies.guests.mixed.target.displayName}}**.
11. Users → Include → Guest or external users: select exactly the external-user types and external Microsoft Entra organizations in this policy's resolved target. Users → Exclude: match the resolved target's excluded guest types, users, groups and roles, including the exclusions group. Remove any exclusion the target does not list.
12. Target resources: All resources. Client apps: All. Remove any other condition.
13. Grant: **Grant access → Require multifactor authentication**. Remove any authentication strength or other grant control.
14. Session: remove any session control the resolved target does not include.
15. Save. Leave **Enable policy** as it is: if the policy is On, the changed rule can affect access after you save.
    This change removes {{policies.guests.mixed.current.removedExclusions}} from the exclusions of {{policies.guests.mixed.current.displayName}}. If that policy is On, it applies to them as soon as you save. [omit this line when unavailable]
16. Rescan in IAMAI.

Do not merge these two policies into one. Each covers different external-user types with a different MFA requirement.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"entra.partner-trust","channel":"entra","states":["partnerTrustRequired"],"format":"markdown","kind":"template"}
For each **approved ordinary B2B partner tenant** in the resolved trust list, open **External Identities > Cross-tenant access settings > Organizational settings > [partner] > Inbound access > Trust settings** and enable **Trust multifactor authentication from Microsoft Entra tenants** only as approved. Keep existing device trust choices. Do not apply this to GDAP or service-provider sign-ins. Verify after the change: reopen each partner's trust settings, check that device trust is unchanged, and test a representative partner sign-in.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"entra.observe","channel":"entra","states":["reportOnly"],"format":"markdown","kind":"template"}
Keep both policies in Report-only while you review the evidence listed for this step. Review Report-only results for both policies, and test representative guest access for each external-user type and home organization in scope. Guests covered by the strength policy need a method that strength accepts; guests covered by the MFA policy need to complete MFA. One successful guest sign-in does not prove that other identity providers or home organizations work.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"entra.enforce-pair","channel":"entra","states":["readyToEnforce"],"format":"markdown","kind":"template"}
Reopen both policies by their policy IDs. Verify each still matches its intended target, both are Report-only, and any approved partner trust is already in place.

Do not turn either on unless all of these are true now:

- The required report-only period is complete, with no failures on these policies in the sign-in records.
- Each policy is still Report-only and its settings still match the intended target, exclusions included — the script for this step refuses to enforce a policy that is not.
- Emergency access is prepared and tested.

If any one of them is not true, leave both in Report-only. Enable both in the same planned change window. Verify after the change: representative guests on both policy paths can sign in. Then rescan in IAMAI.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"json.create-pair","channel":"json","states":["missing"],"format":"json-template","kind":"deployableAfterBinding","method":"POST","endpoint":"https://graph.microsoft.com/v1.0/$batch"}
{"requests":[{"id":"strong","method":"POST","url":"/identity/conditionalAccess/policies","headers":{"Content-Type":"application/json"},"body":{"displayName":{{json:policies.guests.strong.target.displayName}},"state":"enabledForReportingButNotEnforced","conditions":{{json:policies.guests.strong.target.conditions}},"grantControls":{{json:policies.guests.strong.target.grantControls}},"sessionControls":{{json:policies.guests.strong.target.sessionControls}}}},{"id":"mixed","method":"POST","url":"/identity/conditionalAccess/policies","headers":{"Content-Type":"application/json"},"body":{"displayName":{{json:policies.guests.mixed.target.displayName}},"state":"enabledForReportingButNotEnforced","conditions":{{json:policies.guests.mixed.target.conditions}},"grantControls":{{json:policies.guests.mixed.target.grantControls}},"sessionControls":{{json:policies.guests.mixed.target.sessionControls}}}}]}
@@IAMAI-END

@@IAMAI-BEGIN {"id":"json.partner-trust","channel":"json","states":["partnerTrustRequired"],"format":"json-template","kind":"template"}
{"kind":"resolvedCrossTenantInboundTrustPatchSet","partners":{{json:partnerTrust.resolvedPatches}},"rule":"Each item must contain tenantId and the complete resolved inboundTrust object so existing compliant-device/hybrid-join trust values are preserved. Do not use this for GDAP."}
@@IAMAI-END

@@IAMAI-BEGIN {"id":"json.correct-pair","channel":"json","states":["partial"],"format":"json-template","kind":"deployableAfterBinding","method":"POST","endpoint":"https://graph.microsoft.com/v1.0/$batch"}
{"requests":[{"id":"strong","method":"PATCH","url":"/identity/conditionalAccess/policies/{policies.guests.strong.current.id}","headers":{"Content-Type":"application/json"},"body":{"displayName":{{json:policies.guests.strong.target.displayName}},"conditions":{{json:policies.guests.strong.target.conditions}},"grantControls":{{json:policies.guests.strong.target.grantControls}},"sessionControls":{{json:policies.guests.strong.target.sessionControls}}}},{"id":"mixed","method":"PATCH","url":"/identity/conditionalAccess/policies/{policies.guests.mixed.current.id}","headers":{"Content-Type":"application/json"},"body":{"displayName":{{json:policies.guests.mixed.target.displayName}},"conditions":{{json:policies.guests.mixed.target.conditions}},"grantControls":{{json:policies.guests.mixed.target.grantControls}},"sessionControls":{{json:policies.guests.mixed.target.sessionControls}}}}]}
@@IAMAI-END

@@IAMAI-BEGIN {"id":"json.enforce-pair","channel":"json","states":["readyToEnforce"],"format":"json-template","kind":"deployableAfterBinding","method":"POST","endpoint":"https://graph.microsoft.com/v1.0/$batch"}
{"requests":[{"id":"strong","method":"PATCH","url":"/identity/conditionalAccess/policies/{policies.guests.strong.current.id}","headers":{"Content-Type":"application/json"},"body":{"state":"enabled"}},{"id":"mixed","method":"PATCH","url":"/identity/conditionalAccess/policies/{policies.guests.mixed.current.id}","headers":{"Content-Type":"application/json"},"body":{"state":"enabled"}}]}
@@IAMAI-END

@@IAMAI-BEGIN {"id":"powershell.run","channel":"powershell","states":["missing","partial","partnerTrustRequired","reportOnly","readyToEnforce"],"format":"powershell","kind":"deployableAfterBinding","invocation":{"modeParameter":"Mode","parameters":{"TargetPoliciesJson":{"binding":"policies.guests.targets.json","modes":["CreateMissing","CorrectPair","Observe","EnforcePair","Verify"]},"StrongPolicyId":{"binding":"policies.guests.strong.current.id","modes":["CorrectPair","Observe","EnforcePair","Verify"]},"MixedPolicyId":{"binding":"policies.guests.mixed.current.id","modes":["CorrectPair","Observe","EnforcePair","Verify"]}},"withheldModes":{"ApplyPartnerTrust":"ApplyPartnerTrust reads the owner-approved partner trust patches as JSON text, and IAMAI holds them as objects, not as the JSON text the parameter takes."}}}
# This change removes {{policies.guests.strong.current.removedExclusions}} from the exclusions of {{policies.guests.strong.current.displayName}}. If that policy is On, it applies to them as soon as the correction is saved. [omit this line when unavailable]
# This change removes {{policies.guests.mixed.current.removedExclusions}} from the exclusions of {{policies.guests.mixed.current.displayName}}. If that policy is On, it applies to them as soon as the correction is saved. [omit this line when unavailable]
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

This state creates two guest MFA policies for {{tenant.displayName}}, both in Report-only. They cover different external-user types from the baseline, adjusted only through saved partner or service-provider decisions: one requires the tenant's resolved authentication strength and the other requires built-in MFA. The split is by external-user type, not simply trusted partners versus everyone else. Microsoft does not accept authentication strengths for every external identity provider, so check which guests each policy covers. Inbound MFA trust for B2B partners and GDAP service-provider access are handled differently. The JSON output creates both policies in one Graph batch, which can create one policy and fail on the other.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"ai.correct","channel":"aiInfo","states":["partial"],"format":"markdown","kind":"template"}

Differences IAMAI found on the guest policies: {{policies.guests.semanticMismatches}}. The correction updates each policy by its own policy ID to its complete resolved target: name, users and exclusions, conditions, grant and session controls. It keeps the saved partner and service-provider decisions and keeps the two policies separate. The JSON output sends both updates in one Graph batch; one policy can update while the other fails. Keep each policy's current state. If a policy is On, the changed rule can affect access after you save.

This change removes {{policies.guests.strong.current.removedExclusions}} from the exclusions of {{policies.guests.strong.current.displayName}}. If that policy is On, it applies to them as soon as you save. [omit this line when unavailable]
This change removes {{policies.guests.mixed.current.removedExclusions}} from the exclusions of {{policies.guests.mixed.current.displayName}}. If that policy is On, it applies to them as soon as you save. [omit this line when unavailable]
@@IAMAI-END

@@IAMAI-BEGIN {"id":"ai.partner-trust","channel":"aiInfo","states":["partnerTrustRequired"],"format":"markdown","kind":"template"}

This state applies approved inbound MFA trust for specific ordinary B2B partner tenants: {{partnerTrust.resolvedPatches}}. Each change keeps that partner's existing device trust settings. GDAP service-provider access is handled differently and is not changed here.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"ai.observe","channel":"aiInfo","states":["reportOnly"],"format":"markdown","kind":"template"}

Both guest policies are in Report-only. Evidence: {{evidence.reportOnly}}. A guest's result can depend on their external-user type, home organization and identity provider as well as on the policy settings. One successful guest sign-in does not prove that other identity providers or home organizations will work.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"ai.enforce","channel":"aiInfo","states":["readyToEnforce"],"format":"markdown","kind":"template"}

Both guest policies in {{tenant.displayName}} are ready to enforce. Before they are set On, each should still match its intended target and be Report-only, representative guest access should be tested on both policy paths, and any approved partner MFA trust should already be in place. The JSON output enables both in one Graph batch; one policy can be enabled while the other fails, so both results need checking.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"ai.blocked","channel":"aiInfo","states":["blocked","needsDecision","sourceConflict"],"format":"markdown","kind":"template"}

Guest MFA cannot proceed yet. Blockers and pending decisions: {{dependencies.blockers}}. Partner trust, service-provider exclusions and external tenant IDs come only from saved decisions and the scan.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"ai.not-licensed","channel":"aiInfo","states":["notLicensed"],"format":"markdown","kind":"template"}

IAMAI did not find the licensing this step needs. Conditional Access requires Microsoft Entra ID P1 or higher. No guest policy change is available until licensing is resolved.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"email.rollout","channel":"email","states":["missing"],"format":"markdown","kind":"template","audience":"client-contact","trigger":"before-report-only","purpose":"set expectations for guest MFA"}
Subject: Action needed: Require MFA for Guests

We are preparing MFA checks for guest access. Please tell IT about the guest accounts and partner organizations that need access so we can test the relevant sign-in paths before the change.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"email.partner-trust","channel":"email","states":["partnerTrustRequired"],"format":"markdown","kind":"template","audience":"client-contact"}
Subject: Action needed: Require MFA for Guests

We plan to trust MFA completed in the approved partner organization's Microsoft Entra tenant for ordinary B2B access. Please confirm that this partner trust is approved. The change does not create a general exception for external users, does not apply to GDAP, and keeps existing device trust settings.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"email.enforce","channel":"email","states":["readyToEnforce"],"format":"markdown","kind":"template","audience":"help-desk"}
Subject: Prepare support: Guest MFA

We are preparing MFA checks for guest access. Please coordinate representative sign-in tests with the affected partner organizations, record any trust or method problems, and confirm the support contact before enforcement.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"readiness.model","channel":"readiness","states":["missing","partial","partnerTrustRequired","reportOnly","readyToEnforce"],"format":"json-template","kind":"template"}
{"tiles":[{"id":"guests","label":"Guest/external users","result":{{json:guests.affected.count}},"line":"Check each policy's external-user types, accepted methods and any separately approved partner trust. Review representative guest access for both paths."},{"id":"partnerTier","label":"Partner tier","result":{{json:guests.partnerTierSummary}},"line":"Saved partner decisions set any partner MFA trust and service-provider handling."},{"id":"serviceProvider","label":"Service provider handling","result":{{json:guests.serviceProviderDecision}},"line":"GDAP and ordinary B2B trust are not interchangeable."},{"id":"states","label":"Policy pair state","result":{{json:policyPair.current.states}},"line":"Both policies must match their intended targets before either is enforced."}],"baselineMembers":["f25f94e0-98b6-41be-b9d6-68cb781004a4","e0fabad3-bd0f-42e4-a901-51ef7ab8889c"]}
@@IAMAI-END

@@IAMAI-BEGIN {"id":"troubleshooting.model","channel":"troubleshooting","states":["missing","partial","partnerTrustRequired","reportOnly","readyToEnforce","inPlace"],"format":"json","kind":"referenceOnly"}
{"scenarios":[{"id":"guest-strength-not-supported","classification":"documented","symptom":"An external user cannot satisfy the authentication-strength guest member.","check":"Identify the external identity provider/type and whether authentication strength is supported for that path.","fix":"Do not weaken the strength policy for one user. Confirm which guest policy covers the user's external-user type, and use the built-in MFA policy only where the baseline assigns that type.","then":"Retest and rescan.","sources":["ms-guest-strength","ms-external-ca"]},{"id":"partner-mfa-double-prompt","classification":"documented","symptom":"An ordinary B2B partner user is prompted for MFA again in the resource tenant despite completing MFA at home.","check":"Confirm the partner-specific inbound trust decision and isMfaAccepted state.","fix":"If and only if the owner-approved partner tier requires it, correct the partner-specific inbound MFA trust while preserving other trust fields.","then":"Retest the B2B sign-in.","sources":["ms-cross-tenant","ms-cross-tenant-update"]},{"id":"gdap-trust-confusion","classification":"documented","symptom":"Someone proposes enabling ordinary inbound MFA trust to fix a GDAP technician sign-in.","check":"Confirm the sign-in is GDAP/service-provider access.","fix":"Do not change ordinary inbound trust for GDAP; Microsoft states GDAP MFA is always required in the home tenant and always trusted in the resource tenant.","then":"Troubleshoot the provider tenant/GDAP relationship instead.","sources":["ms-cross-tenant"]},{"id":"guest-pair-collapsed","classification":"derived","symptom":"One broad guest policy has replaced the two retained baseline members.","check":"Compare stable goal-map members and their distinct grants/user-type scopes.","fix":"Restore the two baseline guest policies in Report-only; do not delete the broad replacement until overlap is reviewed.","then":"Validate the pair and rescan.","sources":["ms-external-users-graph","ms-ca-update"]}]}
@@IAMAI-END

@@IAMAI-BEGIN {"id":"entra.prerequisites","channel":"entra","states":["prerequisiteRequired"],"format":"markdown","kind":"template"}
Before configuring or enforcing this policy, confirm:
1. Microsoft Entra ID P2 / qualifying ID Protection licensing.
2. In-scope users have MFA registered.
3. Password writeback works for synchronized users in scope.
4. Guest and external users (all types) stay excluded from this policy.
5. This policy covers Medium user risk only. Keep the separate High-risk control unless a reviewed replacement preserves that coverage.
Do not treat SSPR as the mechanism used by the Conditional Access secure-password-change flow.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"entra.create","channel":"entra","states":["missing"],"format":"markdown","kind":"template"}
Create this policy in Report-only. It will not enforce its access rule until you enable it. This policy covers Medium user risk only. Keep the separate High-risk control unless a reviewed replacement preserves that coverage.
1. Entra admin center → Entra ID → Conditional Access → Policies → New policy.
2. Name: `{{policy.target.displayName}}`.
3. Users: Include **All users**. Exclude the resolved groups: `{{policy.target.excludeGroups}}`. Also exclude **Guest or external users — all types / all external tenants**.
4. Target resources: **All resources**.
5. Conditions → User risk: **Medium** only.
6. Do not configure sign-in risk, platform, network/location, device, client-app restriction, authentication-flow, or workload-risk conditions.
7. Grant: **Grant access** → Require multifactor authentication **and** Require password change → **Require all selected controls**.
8. Session: not configured.
9. Enable policy: **Report-only**.
10. Create, read back, and rescan IAMAI.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"entra.correct.open","channel":"entra","states":["partial"],"format":"markdown","kind":"template"}
Open the existing policy with policy ID `{{policy.current.id}}`. Correct only the differences IAMAI selected.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"entra.correct.users","channel":"entra","states":["partial"],"format":"markdown","kind":"template"}
Set Users to All users; exclude exactly `{{policy.target.excludeGroups}}`; exclude Guest or external users for all guest/external types and all external tenants. Do not infer new exclusions.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"entra.correct.target","channel":"entra","states":["partial"],"format":"markdown","kind":"template"}
Set Target resources to All resources with no application exclusions. Keep client apps All.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"entra.correct.risk","channel":"entra","states":["partial"],"format":"markdown","kind":"template"}
Set Conditions → User risk to Medium only. Remove sign-in risk and any other condition IAMAI identified as a difference.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"entra.correct.conditions","channel":"entra","states":["partial"],"format":"markdown","kind":"template"}
Set the conditions to the intended set: All users with the resolved group exclusions and all guest/external types excluded; All resources; client apps All; user risk Medium only; no other condition.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"entra.correct.grant","channel":"entra","states":["partial"],"format":"markdown","kind":"template"}
Set Grant to Require multifactor authentication **and** Require password change, Require all selected controls. Remove Require risk remediation and any authentication strength from this grant; password change is paired only with Require multifactor authentication.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"entra.correct.session","channel":"entra","states":["partial"],"format":"markdown","kind":"template"}
Remove all session controls. The intended Medium-risk password-change policy has none.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"entra.correct.lifecycle","channel":"entra","states":["partial"],"format":"markdown","kind":"template"}
If correction work should return to observation, set Enable policy to Report-only. Do not toggle a healthy policy's lifecycle unless IAMAI selected this mismatch.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"entra.correct.save-verify","channel":"entra","states":["partial"],"format":"markdown","kind":"template"}
Save once after the selected corrections, read back the same policy ID, and rescan IAMAI. Do not create a duplicate policy.

Keep the policy's current state. If it is On, the changed rule can affect access after you save.

This change removes {{policy.current.removedExclusions}} from the policy's exclusions. If the policy is On, it applies to them as soon as you save. [omit this line when unavailable]
@@IAMAI-END

@@IAMAI-BEGIN {"id":"entra.observe","channel":"entra","states":["reportOnly"],"format":"markdown","kind":"template"}
Keep the policy in Report-only while you review the evidence listed for this step. Confirm the configuration matches the intended settings, review current Medium-risk users, and confirm MFA registration and password writeback for synchronized users, then rescan. Confirm the separate High-risk policy is still in place. Quiet logs do not prove that a future risky user can complete MFA and password change.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"entra.overlap-review","channel":"entra","states":["reportOnly","readyToEnforce"],"format":"markdown","kind":"template"}
This policy covers Medium user risk only. Keep the separate High-risk control unless a reviewed replacement preserves that coverage. Do **not** disable the High-risk policy because this policy is in Report-only or On.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"entra.enforce","channel":"entra","states":["readyToEnforce"],"format":"markdown","kind":"template"}
Verify the same policy and its prerequisites, set it to On, then complete the checks below and rescan.
1. Open policy ID `{{policy.current.id}}` and confirm it still matches the intended settings and is Report-only.
2. Change only Enable policy from Report-only to **On**. Leave users, exclusions, conditions and grant unchanged, and leave the High-risk policy unchanged.
3. Read back the policy and rescan IAMAI.

Verify after the change: the policy reads back On with Medium user risk only, All resources, the resolved group exclusions, all guest/external types excluded, and Require multifactor authentication and Require password change (all selected). The separate High-risk policy is still enabled. Users in scope have MFA registered, and password writeback works for synchronized users.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"json.create","channel":"json","states":["missing"],"format":"json-template","kind":"template","method":"POST","endpoint":"https://graph.microsoft.com/v1.0/identity/conditionalAccess/policies"}
{
  "displayName": {{json:policy.target.displayName}},
  "state": "enabledForReportingButNotEnforced",
  "conditions": {
    "users": {
      "includeUsers": ["All"],
      "excludeUsers": [],
      "includeGroups": [],
      "excludeGroups": {{json:policy.target.excludeGroups}},
      "includeRoles": [],
      "excludeRoles": [],
      "excludeGuestsOrExternalUsers": {
        "guestOrExternalUserTypes": "internalGuest,b2bCollaborationGuest,b2bCollaborationMember,b2bDirectConnectUser,otherExternalUser,serviceProvider",
        "externalTenants": {
          "@odata.type": "#microsoft.graph.conditionalAccessAllExternalTenants",
          "membershipKind": "all"
        }
      }
    },
    "applications": {
      "includeApplications": ["All"],
      "excludeApplications": [],
      "includeUserActions": [],
      "includeAuthenticationContextClassReferences": []
    },
    "clientAppTypes": ["all"],
    "userRiskLevels": ["medium"],
    "signInRiskLevels": [],
    "servicePrincipalRiskLevels": []
  },
  "grantControls": {
    "operator": "AND",
    "builtInControls": ["mfa", "passwordChange"],
    "customAuthenticationFactors": [],
    "termsOfUse": []
  },
  "sessionControls": null
}
@@IAMAI-END

@@IAMAI-BEGIN {"id":"json.correct.conditions","channel":"json","states":["partial"],"format":"json-template","kind":"template","method":"PATCH","endpoint":"https://graph.microsoft.com/v1.0/identity/conditionalAccess/policies/{policy.current.id}"}
{
  "conditions": {
    "users": {
      "includeUsers": ["All"],
      "excludeUsers": [],
      "includeGroups": [],
      "excludeGroups": {{json:policy.target.excludeGroups}},
      "includeRoles": [],
      "excludeRoles": [],
      "excludeGuestsOrExternalUsers": {
        "guestOrExternalUserTypes": "internalGuest,b2bCollaborationGuest,b2bCollaborationMember,b2bDirectConnectUser,otherExternalUser,serviceProvider",
        "externalTenants": {
          "@odata.type": "#microsoft.graph.conditionalAccessAllExternalTenants",
          "membershipKind": "all"
        }
      }
    },
    "applications": {
      "includeApplications": ["All"],
      "excludeApplications": [],
      "includeUserActions": [],
      "includeAuthenticationContextClassReferences": []
    },
    "clientAppTypes": ["all"],
    "userRiskLevels": ["medium"],
    "signInRiskLevels": [],
    "servicePrincipalRiskLevels": []
  }
}
@@IAMAI-END

@@IAMAI-BEGIN {"id":"json.correct.grant","channel":"json","states":["partial"],"format":"json","kind":"template","method":"PATCH","endpoint":"https://graph.microsoft.com/v1.0/identity/conditionalAccess/policies/{policy.current.id}"}
{"grantControls":{"operator":"AND","builtInControls":["mfa","passwordChange"],"customAuthenticationFactors":[],"termsOfUse":[]}}
@@IAMAI-END

@@IAMAI-BEGIN {"id":"json.correct.session","channel":"json","states":["partial"],"format":"json","kind":"template","method":"PATCH","endpoint":"https://graph.microsoft.com/v1.0/identity/conditionalAccess/policies/{policy.current.id}"}
{"sessionControls":null}
@@IAMAI-END

@@IAMAI-BEGIN {"id":"json.correct.report-only","channel":"json","states":["partial"],"format":"json","kind":"template","method":"PATCH","endpoint":"https://graph.microsoft.com/v1.0/identity/conditionalAccess/policies/{policy.current.id}"}
{"state":"enabledForReportingButNotEnforced"}
@@IAMAI-END

@@IAMAI-BEGIN {"id":"json.enforce","channel":"json","states":["readyToEnforce"],"format":"json","kind":"template","method":"PATCH","endpoint":"https://graph.microsoft.com/v1.0/identity/conditionalAccess/policies/{policy.current.id}"}
{"state":"enabled"}
@@IAMAI-END

@@IAMAI-BEGIN {"id":"powershell.run","channel":"powershell","states":["missing","partial","reportOnly","readyToEnforce"],"format":"powershell","kind":"deployableAfterBinding","invocation":{"modeParameter":"Mode","parameters":{"PolicyId":{"binding":"policy.current.id","modes":["CorrectConditions","CorrectGrant","CorrectSession","Verify","Enforce"]},"DisplayName":{"binding":"policy.target.displayName","modes":["Create"]},"ExcludeGroups":{"binding":"policy.target.excludeGroups","modes":["Create","CorrectConditions"]}},"withheldModes":{"Enforce":"Enforce runs only with -MfaRegistrationValidated, and with -HybridPasswordWritebackValidated where hybrid users are in scope, and this package declares no prerequisite IAMAI can check to pass them."}}}
# This change removes {{policy.current.removedExclusions}} from the policy's exclusions. If the policy is On, it applies to them as soon as the correction is saved. [omit this line when unavailable]
param(
  [Parameter(Mandatory=$true)][ValidateSet('Create','CorrectConditions','CorrectGrant','CorrectSession','ReportOnly','Verify','Enforce')][string]$Mode,
  [string]$PolicyId,
  [string]$DisplayName,
  [string[]]$ExcludeGroups=@(),
  [switch]$MfaRegistrationValidated,
  [switch]$HybridUsersInScope,
  [switch]$HybridPasswordWritebackValidated
)
$ErrorActionPreference='Stop'
$Graph='https://graph.microsoft.com/v1.0'
function NeedWrite { if((Get-MgContext).Scopes -notcontains 'Policy.ReadWrite.ConditionalAccess'){ Connect-MgGraph -Scopes 'Policy.Read.All','Policy.ReadWrite.ConditionalAccess' -NoWelcome } }
function NeedRead { if(-not (Get-MgContext)){ Connect-MgGraph -Scopes 'Policy.Read.All' -NoWelcome } }
function InvokeCA([string]$Method,[string]$Uri,$Body=$null){
  $p=@{Method=$Method;Uri=$Uri;OutputType='PSObject'}
  if($null-ne$Body){$p.Body=($Body|ConvertTo-Json -Depth 30 -Compress);$p.ContentType='application/json'}
  Invoke-MgGraphRequest @p
}
function Exclusions { @($ExcludeGroups) }
function Conditions {
  @{
    users=@{
      includeUsers=@('All');excludeUsers=@();includeGroups=@();excludeGroups=@(Exclusions);includeRoles=@();excludeRoles=@();
      excludeGuestsOrExternalUsers=@{
        guestOrExternalUserTypes='internalGuest,b2bCollaborationGuest,b2bCollaborationMember,b2bDirectConnectUser,otherExternalUser,serviceProvider';
        externalTenants=@{'@odata.type'='#microsoft.graph.conditionalAccessAllExternalTenants';membershipKind='all'}
      }
    };
    applications=@{includeApplications=@('All');excludeApplications=@();includeUserActions=@();includeAuthenticationContextClassReferences=@()};
    clientAppTypes=@('all');userRiskLevels=@('medium');signInRiskLevels=@();servicePrincipalRiskLevels=@()
  }
}
function Grant { @{operator='AND';builtInControls=@('mfa','passwordChange');customAuthenticationFactors=@();termsOfUse=@()} }
function GetPolicy {
  if($PolicyId -notmatch '^[0-9a-fA-F-]{36}$'){throw 'A stable policy GUID is required for read/update.'}
  InvokeCA GET "$Graph/identity/conditionalAccess/policies/$PolicyId"
}
function AssertCanonical($p){
  if(@($p.conditions.userRiskLevels).Count-ne1 -or $p.conditions.userRiskLevels[0]-ne'medium'){throw 'User risk is not Medium-only.'}
  if(-not (@($p.conditions.applications.includeApplications)-contains 'All')){throw 'Target is not All resources.'}
  $g=@($p.grantControls.builtInControls)
  if(-not($g-contains'mfa' -and $g-contains'passwordChange') -or $p.grantControls.operator-ne'AND'){throw 'Grant is not MFA + passwordChange with AND.'}
  if($null-ne$p.sessionControls){throw 'Noncanonical session controls remain.'}
}
NeedRead
switch($Mode){
  'Create' {
    NeedWrite
    if([string]::IsNullOrWhiteSpace($DisplayName) -or $DisplayName -like '{{*'){throw 'Resolved display name required.'}
    $escaped=$DisplayName.Replace("'","''")
    $q=[uri]::EscapeDataString("displayName eq '$escaped'")
    $existing=InvokeCA GET "$Graph/identity/conditionalAccess/policies?`$filter=$q"
    if(@($existing.value).Count -gt 0){throw 'A policy with this display name already exists. Resolve identity; do not duplicate.'}
    $body=@{displayName=$DisplayName;state='enabledForReportingButNotEnforced';conditions=(Conditions);grantControls=(Grant);sessionControls=$null}
    $created=InvokeCA POST "$Graph/identity/conditionalAccess/policies" $body
    $created
  }
  'CorrectConditions' { NeedWrite; InvokeCA PATCH "$Graph/identity/conditionalAccess/policies/$PolicyId" @{conditions=(Conditions)} | Out-Null }
  'CorrectGrant' { NeedWrite; InvokeCA PATCH "$Graph/identity/conditionalAccess/policies/$PolicyId" @{grantControls=(Grant)} | Out-Null }
  'CorrectSession' { NeedWrite; InvokeCA PATCH "$Graph/identity/conditionalAccess/policies/$PolicyId" @{sessionControls=$null} | Out-Null }
  'ReportOnly' { NeedWrite; InvokeCA PATCH "$Graph/identity/conditionalAccess/policies/$PolicyId" @{state='enabledForReportingButNotEnforced'} | Out-Null }
  'Verify' { $p=GetPolicy; AssertCanonical $p; $p }
  'Enforce' {
    if(-not$MfaRegistrationValidated){throw 'Confirm MFA registration readiness before enforcement.'}
    if($HybridUsersInScope -and (-not$HybridPasswordWritebackValidated)){throw 'Hybrid users are in scope; validate password writeback before enforcement.'}
    NeedWrite
    $p=GetPolicy; AssertCanonical $p
    if($p.state-ne'enabledForReportingButNotEnforced'){throw 'Policy must be canonical and Report-only immediately before enforcement.'}
    InvokeCA PATCH "$Graph/identity/conditionalAccess/policies/$PolicyId" @{state='enabled'} | Out-Null
    $a=GetPolicy; AssertCanonical $a
    if($a.state-ne'enabled'){throw 'Enablement readback failed.'}
    $a
  }
}
@@IAMAI-END

@@IAMAI-BEGIN {"id":"ai.prerequisites","channel":"aiInfo","states":["prerequisiteRequired"],"format":"markdown","kind":"template"}
**Contains tenant context. Review before sharing with an external AI service.**

This state for Reset Passwords for Medium-Risk Users in {{tenant.displayName}} is waiting on prerequisites: MFA registration for users in scope, password writeback for synchronized users, the guest/external exclusion, review of current risky users, and confirmation that the separate High-risk policy stays in place. SSPR is not the mechanism for the Conditional Access secure password change; do not treat SSPR alone as a blocker.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"ai.create","channel":"aiInfo","states":["missing"],"format":"markdown","kind":"template"}
**Contains tenant context. Review before sharing with an external AI service.**

This state creates the Medium user-risk password-change policy in Report-only. Intended settings: All users, excluding the resolved groups and all guest/external user types; All resources; Medium user risk only; Require multifactor authentication and Require password change, with all selected controls required; no session controls.

This policy covers Medium user risk only. Keep the separate High-risk control unless a reviewed replacement preserves that coverage. Do not add Require risk remediation to this grant, and do not retire the High-risk policy as part of this step.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"ai.correct","channel":"aiInfo","states":["partial"],"format":"markdown","kind":"template"}
**Contains tenant context. Review before sharing with an external AI service.**

This state corrects the existing Medium user-risk policy. Differences IAMAI found: {{policy.current.semanticMismatches}}. Correct the same policy ID; do not create a new policy. The intended grant is built-in MFA and password change with AND, as Microsoft Graph v1.0 requires. Do not add exclusions or unrelated conditions.

This policy covers Medium user risk only. Keep the separate High-risk control unless a reviewed replacement preserves that coverage.

Keep the policy's current state. If it is On, the changed rule can affect access after you save.

This change removes {{policy.current.removedExclusions}} from the policy's exclusions. If the policy is On, it applies to them as soon as you save. [omit this line when unavailable]
@@IAMAI-END

@@IAMAI-BEGIN {"id":"ai.observe","channel":"aiInfo","states":["reportOnly"],"format":"markdown","kind":"template"}
**Contains tenant context. Review before sharing with an external AI service.**

The Medium user-risk policy is in Report-only. IAMAI evidence: Medium-risk users {{evidence.atRiskUsers}}; MFA registration {{evidence.mfaRegistration}}; password writeback {{evidence.hybridWriteback}}; High-risk policy {{evidence.highRiskPolicy}}; risk investigation {{evidence.riskInvestigation}}.

NEXT STEP: explain which of these still block enforcement. Report-only results do not show whether a future risky user can complete MFA and password change.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"ai.enforce","channel":"aiInfo","states":["readyToEnforce"],"format":"markdown","kind":"template"}
**Contains tenant context. Review before sharing with an external AI service.**

This state enables the reviewed Medium user-risk policy. The only change is this policy's state from Report-only to On; users, exclusions, conditions and grant stay as they are. Before enabling, check that the same policy ID still matches the intended settings, that MFA registration and password writeback prerequisites are met, and that the separate High-risk policy remains enabled. This policy covers Medium user risk only and does not replace High-risk coverage.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"email.users.pre-enforcement","channel":"email","states":["readyToEnforce"],"format":"markdown","kind":"template"}
Subject: Planned change: Reset Passwords for Medium-Risk Users

If your account is rated medium risk, you may need to complete MFA and securely change your password. Contact IT if the process fails.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"readiness.model","channel":"readiness","states":["prerequisiteRequired","missing","partial","reportOnly","readyToEnforce"],"format":"json-template","kind":"referenceOnly"}
{"tiles":[{"id":"license","label":"Risk licensing","gate":"Safe to configure","result":"IAMAI tenant truth","line":"Medium user-risk Conditional Access requires P2/qualifying ID Protection capability.","evidenceSource":"tenant licensing"},{"id":"mfa","label":"MFA registration","gate":"Safe to enforce","result":"{{evidence.mfaRegistration}}","line":"Check MFA, applicable password writeback and external-user exclusions. Verify High-risk protection remains in place.","evidenceSource":"IAMAI authentication evidence"},{"id":"hybrid","label":"Hybrid writeback","gate":"Safe to enforce","result":"{{evidence.hybridWriteback}}","line":"Synchronized users need working password writeback.","evidenceSource":"IAMAI hybrid evidence"},{"id":"high-overlap","label":"High-risk coverage","gate":"Safe to enforce","result":"{{evidence.highRiskPolicy}}","line":"This policy covers Medium user risk only. Keep the separate High-risk control unless a reviewed replacement preserves that coverage.","evidenceSource":"IAMAI policy truth"},{"id":"risk-review","label":"Current risk reviewed","gate":"Safe to enforce","result":"{{evidence.riskInvestigation}}","line":"Known risky-user evidence should be reviewed before broad enforcement.","evidenceSource":"ID Protection / IAMAI evidence"}],"whyIamaiSaysThis":"IAMAI can verify policy shape and known prerequisites. It does not infer that Medium-only scope replaces High-risk coverage, and SSPR is not treated as the Conditional Access secure-password-change mechanism."}
@@IAMAI-END

@@IAMAI-BEGIN {"id":"troubleshooting.model","channel":"troubleshooting","states":["prerequisiteRequired","missing","partial","reportOnly","readyToEnforce","inPlace"],"format":"json","kind":"referenceOnly"}
{"scenarios":[{"id":"mfa-not-registered","classification":"documented","symptom":"A risky user cannot complete secure password change.","check":"Confirm the user had an MFA method registered before the risk event.","fix":"Restore/register an approved MFA method through the organization's recovery process.","then":"Retry only after readiness changes.","sources":["ms-ca-grant","ms-risk-policy"]},{"id":"hybrid-writeback","classification":"documented","symptom":"A synchronized user's secure password change fails or doesn't update on-premises.","check":"Verify password writeback is enabled and healthy.","fix":"Correct writeback before enforcing this path.","then":"Retest the secure password-change flow.","sources":["ms-risk-policy"]},{"id":"sspr-confusion","classification":"documented","symptom":"Deployment is blocked only because SSPR isn't enabled.","check":"Determine whether the real blocker is MFA registration or hybrid writeback.","fix":"Do not treat SSPR as the Conditional Access secure-password-change flow.","then":"Re-evaluate actual prerequisites.","sources":["ms-ca-grant"]},{"id":"high-policy-retired","classification":"derived","symptom":"The separate High-risk policy is proposed for disablement just because Medium is enabled.","check":"Verify whether IAMAI has explicit overlap authority proving High-risk coverage remains.","fix":"Keep the High-risk policy unchanged unless that authority exists.","then":"Rescan and review overlap deliberately.","sources":["ms-risk-policy"]},{"id":"graph-grant-rejected","classification":"documented","symptom":"Graph rejects the password-change grant.","check":"Confirm builtInControls contains mfa and passwordChange with operator AND and no riskRemediation/authenticationStrength companion.","fix":"Use the supported bounded grant.","then":"Read back the stable policy.","sources":["ms-ca-grant-v1"]},{"id":"wrong-scope","classification":"documented","symptom":"The policy includes application exclusions or unrelated conditions.","check":"Password-change policy scope must remain All resources with only users/groups, applications, and userRisk conditions.","fix":"Return to the canonical bounded conditions object.","then":"Rescan IAMAI.","sources":["ms-ca-grant"]},{"id":"graph-403","classification":"documented","symptom":"Graph/PowerShell returns 403.","check":"Verify Policy.Read.All + Policy.ReadWrite.ConditionalAccess and an appropriate Conditional Access/Security Administrator role.","fix":"Reconnect with least required permissions.","then":"Retry the same bounded operation.","sources":["ms-ca-create-v1"]}]}
@@IAMAI-END

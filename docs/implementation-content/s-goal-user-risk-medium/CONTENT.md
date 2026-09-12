@@IAMAI-BEGIN {"id":"entra.prerequisites","channel":"entra","states":["prerequisiteRequired"],"format":"markdown","kind":"template"}
Before configuring or enforcing this policy, confirm:
1. Microsoft Entra ID P2 / qualifying ID Protection licensing.
2. In-scope users have MFA registered.
3. Password writeback works for synchronized users in scope.
4. Guest/external users remain outside this retained remediation scope.
5. The separate High-user-risk control will not be removed unless IAMAI explicitly proves equivalent High-risk coverage.
Do not treat SSPR as the mechanism used by the Conditional Access secure-password-change flow.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"entra.create","channel":"entra","states":["missing"],"format":"markdown","kind":"template"}
Create the Conditional Access policy in **Report-only**:
1. Entra admin center → Entra ID → Conditional Access → Policies → New policy.
2. Name: `{{policy.target.displayName}}`.
3. Users: Include **All users**. Exclude IAMAI's canonical groups: `{{policy.target.excludeGroups}}`. Also exclude **Guest or external users — all types / all external tenants**.
4. Target resources: **All resources**.
5. Conditions → User risk: **Medium** only.
6. Do not configure sign-in risk, platform, network/location, device, client-app restriction, authentication-flow, or workload-risk conditions.
7. Grant: **Grant access** → Require multifactor authentication **and** Require password change → **Require all selected controls**.
8. Session: not configured.
9. Enable policy: **Report-only**.
10. Create, read back, and rescan IAMAI.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"entra.correct.open","channel":"entra","states":["partial"],"format":"markdown","kind":"template"}
Open the exact existing policy by IAMAI's stable tenant policy ID `{{policy.current.id}}`. Correct only the mismatch modules IAMAI selected.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"entra.correct.users","channel":"entra","states":["partial"],"format":"markdown","kind":"template"}
Set Users to All users; exclude exactly `{{policy.target.excludeGroups}}`; exclude Guest or external users for all guest/external types and all external tenants. Do not infer new exclusions.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"entra.correct.target","channel":"entra","states":["partial"],"format":"markdown","kind":"template"}
Set Target resources to All resources with no application exclusions. Keep client apps All.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"entra.correct.risk","channel":"entra","states":["partial"],"format":"markdown","kind":"template"}
Set Conditions → User risk to Medium only. Remove sign-in risk and other noncanonical conditions selected by IAMAI.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"entra.correct.conditions","channel":"entra","states":["partial"],"format":"markdown","kind":"template"}
Replace the conditions object with the canonical bounded condition set: All users + resolved exclusions + all guest/external types excluded; All resources; client apps All; user risk Medium only; no other effective condition.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"entra.correct.grant","channel":"entra","states":["partial"],"format":"markdown","kind":"template"}
Set Grant to Require multifactor authentication **and** Require password change, Require all selected controls. Remove riskRemediation/authenticationStrength from this passwordChange grant.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"entra.correct.session","channel":"entra","states":["partial"],"format":"markdown","kind":"template"}
Remove noncanonical session controls. The supported target for this retained Medium password-change step has no session controls.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"entra.correct.lifecycle","channel":"entra","states":["partial"],"format":"markdown","kind":"template"}
If correction work should return to observation, set Enable policy to Report-only. Do not toggle a healthy policy's lifecycle unless IAMAI selected this mismatch.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"entra.correct.save-verify","channel":"entra","states":["partial"],"format":"markdown","kind":"template"}
Save once after the selected corrections, read back the same stable policy ID, and rescan IAMAI. Do not create a duplicate policy.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"entra.observe","channel":"entra","states":["reportOnly"],"format":"markdown","kind":"template"}
Leave the policy in Report-only. Verify exact configuration, review current Medium-risk users, confirm MFA registration and hybrid writeback readiness, then rescan. Quiet logs do not prove a future risky user can complete remediation.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"entra.overlap-review","channel":"entra","states":["reportOnly","readyToEnforce"],"format":"markdown","kind":"template"}
Review the separate High-user-risk policy as an independent control. Do **not** disable it automatically. Consolidation is allowed only when IAMAI explicitly supplies an owner-approved/canonical operation proving High-risk coverage remains equivalent or stronger.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"entra.enforce","channel":"entra","states":["readyToEnforce"],"format":"markdown","kind":"template"}
Open policy ID `{{policy.current.id}}`, re-verify the canonical configuration and prerequisites, then change only Enable policy from Report-only to **On**. Read back and rescan IAMAI. Leave the High-user-risk control unchanged.
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

@@IAMAI-BEGIN {"id":"powershell.run","channel":"powershell","states":["missing","partial","reportOnly","readyToEnforce"],"format":"powershell","kind":"template"}
param(
  [Parameter(Mandatory=$true)][ValidateSet('Create','CorrectConditions','CorrectGrant','CorrectSession','ReportOnly','Verify','Enforce')][string]$Mode,
  [string]$PolicyId = '{{policy.current.id}}',
  [string]$DisplayName = '{{policy.target.displayName}}',
  [string]$ExcludeGroupsJson = '{{policy.target.excludeGroups}}',
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
function Exclusions {
  $v=$ExcludeGroupsJson | ConvertFrom-Json
  if($null-eq$v){ @() } elseif($v -is [array]){ @($v) } else { @($v) }
}
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

Review only IAMAI-provided prerequisites for Reset Passwords for Medium-Risk Users in {{tenant.displayName}}. Confirm MFA registration, hybrid password writeback, guest/external handling, active-risk investigation, and High-risk overlap. Do not treat SSPR as the secure Conditional Access password-change mechanism. Unknown remains Unknown.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"ai.create","channel":"aiInfo","states":["missing"],"format":"markdown","kind":"template"}
**Contains tenant context. Review before sharing with an external AI service.**

Review IAMAI's proposed Medium user-risk password-change policy. Target: All users minus canonical exclusions and all guest/external users; All resources; Medium user risk only; MFA + passwordChange with AND; no session controls; Report-only. Check for contradictions only. Do not add riskRemediation or retire the High-risk policy.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"ai.correct","channel":"aiInfo","states":["partial"],"format":"markdown","kind":"template"}
**Contains tenant context. Review before sharing with an external AI service.**

Review only these IAMAI-classified mismatches: {{policy.current.semanticMismatches}}. Preserve stable policy identity. Current v1.0 authoring uses built-in MFA + passwordChange with AND. Do not invent exclusions, add unrelated conditions, or disable the separate High-risk policy.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"ai.observe","channel":"aiInfo","states":["reportOnly"],"format":"markdown","kind":"template"}
**Contains tenant context. Review before sharing with an external AI service.**

Assess Report-only readiness using only IAMAI evidence: Medium-risk users {{evidence.atRiskUsers}}, MFA registration {{evidence.mfaRegistration}}, hybrid writeback {{evidence.hybridWriteback}}, High-risk policy {{evidence.highRiskPolicy}}, investigation {{evidence.riskInvestigation}}. State remaining blockers; do not infer future remediation success.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"ai.enforce","channel":"aiInfo","states":["readyToEnforce"],"format":"markdown","kind":"template"}
**Contains tenant context. Review before sharing with an external AI service.**

Perform a final pre-enforcement review. Confirm the exact stable Medium-risk policy is canonical and Report-only, MFA/writeback prerequisites are satisfied, and the High-risk control remains protected. The only requested mutation is this policy's lifecycle to On.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"email.users.pre-enforcement","channel":"email","states":["readyToEnforce"],"format":"markdown","kind":"template"}
Subject: You may be asked to verify your identity and change your password

Microsoft Entra will begin responding when an account is rated at medium user risk. Most people will see no change. If your account is flagged, you may be asked to complete MFA and securely change your password before continuing. If you cannot complete the prompt, contact the help desk rather than repeatedly retrying.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"readiness.model","channel":"readiness","states":["prerequisiteRequired","missing","partial","reportOnly","readyToEnforce"],"format":"json-template","kind":"referenceOnly"}
{"tiles":[{"id":"license","label":"Risk licensing","gate":"Safe to configure","result":"IAMAI tenant truth","line":"Medium user-risk Conditional Access requires P2/qualifying ID Protection capability.","evidenceSource":"tenant licensing"},{"id":"mfa","label":"MFA registration","gate":"Safe to enforce","result":"{{evidence.mfaRegistration}}","line":"Users must have MFA registered before secure risk password change can complete.","evidenceSource":"IAMAI authentication evidence"},{"id":"hybrid","label":"Hybrid writeback","gate":"Safe to enforce","result":"{{evidence.hybridWriteback}}","line":"Synchronized users need working password writeback.","evidenceSource":"IAMAI hybrid evidence"},{"id":"high-overlap","label":"High-risk coverage","gate":"Safe to enforce","result":"{{evidence.highRiskPolicy}}","line":"Enforcing Medium does not authorize automatic removal of the separate High-risk control.","evidenceSource":"IAMAI policy truth"},{"id":"risk-review","label":"Current risk reviewed","gate":"Safe to enforce","result":"{{evidence.riskInvestigation}}","line":"Known risky-user evidence should be reviewed before broad enforcement.","evidenceSource":"ID Protection / IAMAI evidence"}],"whyIamaiSaysThis":"IAMAI can verify policy shape and known prerequisites. It does not infer that Medium-only scope replaces High-risk coverage, and SSPR is not treated as the Conditional Access secure-password-change mechanism."}
@@IAMAI-END

@@IAMAI-BEGIN {"id":"troubleshooting.model","channel":"troubleshooting","states":["prerequisiteRequired","missing","partial","reportOnly","readyToEnforce","inPlace"],"format":"json","kind":"referenceOnly"}
{"scenarios":[{"id":"mfa-not-registered","classification":"documented","symptom":"A risky user cannot complete secure password change.","check":"Confirm the user had an MFA method registered before the risk event.","fix":"Restore/register an approved MFA method through the organization's recovery process.","then":"Retry only after readiness changes.","sources":["ms-ca-grant","ms-risk-policy"]},{"id":"hybrid-writeback","classification":"documented","symptom":"A synchronized user's secure password change fails or doesn't update on-premises.","check":"Verify password writeback is enabled and healthy.","fix":"Correct writeback before enforcing this path.","then":"Retest the secure password-change flow.","sources":["ms-risk-policy"]},{"id":"sspr-confusion","classification":"documented","symptom":"Deployment is blocked only because SSPR isn't enabled.","check":"Determine whether the real blocker is MFA registration or hybrid writeback.","fix":"Do not treat SSPR as the Conditional Access secure-password-change flow.","then":"Re-evaluate actual prerequisites.","sources":["ms-ca-grant"]},{"id":"high-policy-retired","classification":"derived","symptom":"The separate High-risk policy is proposed for disablement just because Medium is enabled.","check":"Verify whether IAMAI has explicit overlap authority proving High-risk coverage remains.","fix":"Keep the High-risk policy unchanged unless that authority exists.","then":"Rescan and review overlap deliberately.","sources":["ms-risk-policy"]},{"id":"graph-grant-rejected","classification":"documented","symptom":"Graph rejects the password-change grant.","check":"Confirm builtInControls contains mfa and passwordChange with operator AND and no riskRemediation/authenticationStrength companion.","fix":"Use the supported bounded grant.","then":"Read back the stable policy.","sources":["ms-ca-grant-v1"]},{"id":"wrong-scope","classification":"documented","symptom":"The policy includes application exclusions or unrelated conditions.","check":"Password-change policy scope must remain All resources with only users/groups, applications, and userRisk conditions.","fix":"Return to the canonical bounded conditions object.","then":"Rescan IAMAI.","sources":["ms-ca-grant"]},{"id":"graph-403","classification":"documented","symptom":"Graph/PowerShell returns 403.","check":"Verify Policy.Read.All + Policy.ReadWrite.ConditionalAccess and an appropriate Conditional Access/Security Administrator role.","fix":"Reconnect with least required permissions.","then":"Retry the same bounded operation.","sources":["ms-ca-create-v1"]}]}
@@IAMAI-END

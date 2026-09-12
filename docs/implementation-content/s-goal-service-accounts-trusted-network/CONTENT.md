@@IAMAI-BEGIN {"id":"entra.prerequisites","channel":"entra","states":["prerequisiteRequired"],"format":"markdown","kind":"template"}
Resolve these before implementation:
1. Confirm the canonical service-accounts group and its stable ID.
2. Confirm each intended member is a **user-based** service account; route service principals to workload-identity controls instead.
3. Confirm the approved trusted named location ID(s). Do not infer them from sign-in history.
4. Validate every required service workflow's actual public egress/source network with its owner.
5. Confirm canonical exclusions.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"entra.create","channel":"entra","states":["missing"],"format":"markdown","kind":"template"}
Create the Conditional Access policy in **Report-only**:
1. Entra admin center → Entra ID → Conditional Access → Policies → New policy.
2. Name: `{{policy.target.displayName}}`.
3. Users: Include Groups → canonical service-accounts group `{{serviceAccounts.group.displayName}}` / ID `{{serviceAccounts.group.id}}`. Exclude exactly `{{policy.target.excludeGroups}}`.
4. Target resources: All resources.
5. Conditions → Network: Include Any network/location; Exclude the IAMAI-resolved trusted location(s): `{{trustedLocations.displayNames}}`.
6. Client apps: All. Configure no other conditions.
7. Grant: Block access.
8. Session: not configured.
9. Enable policy: Report-only.
10. Create, read back, and rescan IAMAI.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"entra.correct.open","channel":"entra","states":["partial"],"format":"markdown","kind":"template"}
Open the exact existing policy by stable tenant policy ID `{{policy.current.id}}`. Apply only IAMAI-selected mismatch modules.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"entra.correct.users","channel":"entra","states":["partial"],"format":"markdown","kind":"template"}
Include only service-accounts group ID `{{serviceAccounts.group.id}}`. Exclude exactly `{{policy.target.excludeGroups}}`. Do not add/remove members here; group membership is separate tenant truth.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"entra.correct.target","channel":"entra","states":["partial"],"format":"markdown","kind":"template"}
Set Target resources to All resources and client apps to All. Remove application exclusions or narrower target conditions only when IAMAI selected this mismatch.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"entra.correct.network","channel":"entra","states":["partial"],"format":"markdown","kind":"template"}
Set Network/Locations to Include Any network/location and Exclude only IAMAI-resolved trusted location ID(s) `{{trustedLocations.ids}}`. Confirm direction carefully: the policy **blocks outside** those exclusions.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"entra.correct.conditions","channel":"entra","states":["partial"],"format":"markdown","kind":"template"}
Replace the conditions object with the canonical bounded condition set: include the canonical service-accounts group, exact exclusions, All resources, client apps All, Any location minus approved trusted location IDs, and no other effective condition.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"entra.correct.grant","channel":"entra","states":["partial"],"format":"markdown","kind":"template"}
Set Grant to Block access. Remove other grant requirements. Operator remains OR.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"entra.correct.session","channel":"entra","states":["partial"],"format":"markdown","kind":"template"}
Remove noncanonical session controls. This block policy uses no session controls.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"entra.correct.lifecycle","channel":"entra","states":["partial"],"format":"markdown","kind":"template"}
When IAMAI selected lifecycle correction, set the policy to Report-only. Do not change lifecycle for a healthy policy merely because another mismatch is being corrected.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"entra.correct.save-verify","channel":"entra","states":["partial"],"format":"markdown","kind":"template"}
Save the selected corrections, read back the same stable policy ID, and rescan IAMAI. Do not create a duplicate.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"entra.observe","channel":"entra","states":["reportOnly"],"format":"markdown","kind":"template"}
Leave the policy in Report-only. Verify exact scope and compare service-account sign-in/source-location evidence with the approved trusted named location(s). Require workflow-owner validation for any source not already approved.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"entra.enforce","channel":"entra","states":["readyToEnforce"],"format":"markdown","kind":"template"}
Immediately before enforcement, re-verify the stable policy, user-based identity types, approved trusted location IDs, and workflow/source-location validation. Then change only Enable policy from Report-only to On. Read back and rescan IAMAI.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"json.create","channel":"json","states":["missing"],"format":"json-template","kind":"template","method":"POST","endpoint":"https://graph.microsoft.com/v1.0/identity/conditionalAccess/policies"}
{
  "displayName": {{json:policy.target.displayName}},
  "state": "enabledForReportingButNotEnforced",
  "conditions": {
    "users": {
      "includeUsers": [],
      "excludeUsers": [],
      "includeGroups": [{{json:serviceAccounts.group.id}}],
      "excludeGroups": {{json:policy.target.excludeGroups}},
      "includeRoles": [],
      "excludeRoles": []
    },
    "applications": {
      "includeApplications": ["All"],
      "excludeApplications": [],
      "includeUserActions": [],
      "includeAuthenticationContextClassReferences": []
    },
    "clientAppTypes": ["all"],
    "locations": {
      "includeLocations": ["All"],
      "excludeLocations": {{json:trustedLocations.ids}}
    },
    "userRiskLevels": [],
    "signInRiskLevels": [],
    "servicePrincipalRiskLevels": []
  },
  "grantControls": {
    "operator": "OR",
    "builtInControls": ["block"],
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
      "includeUsers": [],
      "excludeUsers": [],
      "includeGroups": [{{json:serviceAccounts.group.id}}],
      "excludeGroups": {{json:policy.target.excludeGroups}},
      "includeRoles": [],
      "excludeRoles": []
    },
    "applications": {
      "includeApplications": ["All"],
      "excludeApplications": [],
      "includeUserActions": [],
      "includeAuthenticationContextClassReferences": []
    },
    "clientAppTypes": ["all"],
    "locations": {
      "includeLocations": ["All"],
      "excludeLocations": {{json:trustedLocations.ids}}
    },
    "userRiskLevels": [],
    "signInRiskLevels": [],
    "servicePrincipalRiskLevels": []
  }
}
@@IAMAI-END

@@IAMAI-BEGIN {"id":"json.correct.grant","channel":"json","states":["partial"],"format":"json","kind":"template","method":"PATCH","endpoint":"https://graph.microsoft.com/v1.0/identity/conditionalAccess/policies/{policy.current.id}"}
{"grantControls":{"operator":"OR","builtInControls":["block"],"customAuthenticationFactors":[],"termsOfUse":[]}}
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
  [string]$PolicyId='{{policy.current.id}}',
  [string]$DisplayName='{{policy.target.displayName}}',
  [string]$ServiceAccountsGroupId='{{serviceAccounts.group.id}}',
  [string]$ExcludeGroupsJson='{{policy.target.excludeGroups}}',
  [string]$TrustedLocationsJson='{{trustedLocations.ids}}',
  [switch]$IdentityTypesValidated,
  [switch]$WorkflowSourcesValidated
)
$ErrorActionPreference='Stop'
$Graph='https://graph.microsoft.com/v1.0'
function NeedRead { if(-not(Get-MgContext)){Connect-MgGraph -Scopes 'Policy.Read.All' -NoWelcome} }
function NeedWrite { if((Get-MgContext).Scopes -notcontains 'Policy.ReadWrite.ConditionalAccess'){Connect-MgGraph -Scopes 'Policy.Read.All','Policy.ReadWrite.ConditionalAccess' -NoWelcome} }
function InvokeCA([string]$Method,[string]$Uri,$Body=$null){
  $p=@{Method=$Method;Uri=$Uri;OutputType='PSObject'}
  if($null-ne$Body){$p.Body=($Body|ConvertTo-Json -Depth 30 -Compress);$p.ContentType='application/json'}
  Invoke-MgGraphRequest @p
}
function ParseArray([string]$Json){
  $v=$Json|ConvertFrom-Json
  if($null-eq$v){@()}elseif($v-is[array]){@($v)}else{@($v)}
}
function Conditions {
  if($ServiceAccountsGroupId -notmatch '^[0-9a-fA-F-]{36}$'){throw 'Resolved service-accounts group GUID required.'}
  $loc=@(ParseArray $TrustedLocationsJson)
  if($loc.Count-lt1){throw 'At least one resolved trusted named-location ID is required.'}
  @{
    users=@{includeUsers=@();excludeUsers=@();includeGroups=@($ServiceAccountsGroupId);excludeGroups=@(ParseArray $ExcludeGroupsJson);includeRoles=@();excludeRoles=@()};
    applications=@{includeApplications=@('All');excludeApplications=@();includeUserActions=@();includeAuthenticationContextClassReferences=@()};
    clientAppTypes=@('all');locations=@{includeLocations=@('All');excludeLocations=$loc};
    userRiskLevels=@();signInRiskLevels=@();servicePrincipalRiskLevels=@()
  }
}
function Grant {@{operator='OR';builtInControls=@('block');customAuthenticationFactors=@();termsOfUse=@()}}
function GetPolicy{
  if($PolicyId-notmatch'^[0-9a-fA-F-]{36}$'){throw 'Stable policy GUID required.'}
  InvokeCA GET "$Graph/identity/conditionalAccess/policies/$PolicyId"
}
function AssertCanonical($p){
  if(@($p.conditions.users.includeGroups).Count-ne1 -or $p.conditions.users.includeGroups[0]-ne$ServiceAccountsGroupId){throw 'Wrong service-accounts include group.'}
  if(-not(@($p.conditions.applications.includeApplications)-contains'All')){throw 'Target is not All resources.'}
  if(-not(@($p.conditions.locations.includeLocations)-contains'All')){throw 'Network include is not Any/All.'}
  $want=@(ParseArray $TrustedLocationsJson)|Sort-Object
  $got=@($p.conditions.locations.excludeLocations)|Sort-Object
  if(($want -join ',')-ne($got -join ',')){throw 'Trusted-location exclusions differ from canonical IDs.'}
  if(-not(@($p.grantControls.builtInControls)-contains'block')){throw 'Grant is not Block.'}
  if($null-ne$p.sessionControls){throw 'Noncanonical session controls remain.'}
}
NeedRead
switch($Mode){
  'Create'{
    NeedWrite
    if([string]::IsNullOrWhiteSpace($DisplayName)-or$DisplayName-like'{{*'){throw'Resolved display name required.'}
    $escaped=$DisplayName.Replace("'","''");$q=[uri]::EscapeDataString("displayName eq '$escaped'")
    $existing=InvokeCA GET "$Graph/identity/conditionalAccess/policies?`$filter=$q"
    if(@($existing.value).Count-gt0){throw'Policy display-name collision. Resolve identity; do not duplicate.'}
    InvokeCA POST "$Graph/identity/conditionalAccess/policies" @{displayName=$DisplayName;state='enabledForReportingButNotEnforced';conditions=(Conditions);grantControls=(Grant);sessionControls=$null}
  }
  'CorrectConditions'{NeedWrite;InvokeCA PATCH "$Graph/identity/conditionalAccess/policies/$PolicyId" @{conditions=(Conditions)}|Out-Null}
  'CorrectGrant'{NeedWrite;InvokeCA PATCH "$Graph/identity/conditionalAccess/policies/$PolicyId" @{grantControls=(Grant)}|Out-Null}
  'CorrectSession'{NeedWrite;InvokeCA PATCH "$Graph/identity/conditionalAccess/policies/$PolicyId" @{sessionControls=$null}|Out-Null}
  'ReportOnly'{NeedWrite;InvokeCA PATCH "$Graph/identity/conditionalAccess/policies/$PolicyId" @{state='enabledForReportingButNotEnforced'}|Out-Null}
  'Verify'{$p=GetPolicy;AssertCanonical$p;$p}
  'Enforce'{
    if(-not$IdentityTypesValidated){throw'Validate that targeted members are user-based service accounts before enforcement.'}
    if(-not$WorkflowSourcesValidated){throw'Validate required service workflow source networks before enforcement.'}
    NeedWrite
    $p=GetPolicy;AssertCanonical$p
    if($p.state-ne'enabledForReportingButNotEnforced'){throw'Policy must be canonical and Report-only immediately before enforcement.'}
    InvokeCA PATCH "$Graph/identity/conditionalAccess/policies/$PolicyId" @{state='enabled'}|Out-Null
    $a=GetPolicy;AssertCanonical$a
    if($a.state-ne'enabled'){throw'Enablement readback failed.'}
    $a
  }
}
@@IAMAI-END

@@IAMAI-BEGIN {"id":"ai.prerequisites","channel":"aiInfo","states":["prerequisiteRequired"],"format":"markdown","kind":"template"}
**Contains tenant context. Review before sharing with an external AI service.**

Review only IAMAI-provided prerequisites for Restrict Service Accounts to the Trusted Network in {{tenant.displayName}}. Confirm canonical group identity, user-vs-service-principal identity types, approved trusted location IDs, source-location evidence, and workflow-owner validation. Do not infer trusted IPs from history.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"ai.create","channel":"aiInfo","states":["missing"],"format":"markdown","kind":"template"}
**Contains tenant context. Review before sharing with an external AI service.**

Review IAMAI's proposed user-based service-account block policy. Target: canonical service-accounts group only; exact canonical exclusions; All resources; Any network except approved trusted location IDs; Block; Report-only. Confirm the package does not claim to protect service-principal calls.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"ai.correct","channel":"aiInfo","states":["partial"],"format":"markdown","kind":"template"}
**Contains tenant context. Review before sharing with an external AI service.**

Review only these IAMAI-classified mismatches: {{policy.current.semanticMismatches}}. Preserve stable policy identity, canonical group identity, and approved trusted location IDs. Do not broaden network trust or convert service-principal handling into a user policy.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"ai.observe","channel":"aiInfo","states":["reportOnly"],"format":"markdown","kind":"template"}
**Contains tenant context. Review before sharing with an external AI service.**

Assess enforcement readiness using IAMAI evidence: identity types {{evidence.identityTypes}}, source locations {{evidence.sourceLocations}}, workflow validation {{evidence.workflowValidation}}, service-account members {{serviceAccounts.members}}. Flag any required workflow observed outside approved trusted locations. Unknown remains Unknown.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"ai.enforce","channel":"aiInfo","states":["readyToEnforce"],"format":"markdown","kind":"template"}
**Contains tenant context. Review before sharing with an external AI service.**

Perform a final pre-enforcement review. Confirm the exact stable policy is canonical and Report-only, every targeted member is a user-based service account, and every required workflow has an approved trusted source network. The only requested mutation is lifecycle to On.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"email.owners.pre-enforcement","channel":"email","states":["readyToEnforce"],"format":"markdown","kind":"template"}
Subject: Service-account sign-ins will be restricted to approved networks

We are enabling a Conditional Access policy that blocks the listed user-based service accounts when they sign in from outside the approved trusted network. Please confirm any scheduled jobs, vendor-hosted processes, cloud services, or remote workflows that use these accounts are running from an approved source before enforcement. If a service stops afterward, contact IT with the service/account name and source environment; do not move the credential to another host as a workaround.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"readiness.model","channel":"readiness","states":["prerequisiteRequired","missing","partial","reportOnly","readyToEnforce"],"format":"json-template","kind":"referenceOnly"}
{"tiles":[{"id":"group","label":"Service-account group","gate":"Safe to configure","result":"{{serviceAccounts.group.displayName}}","line":"IAMAI must have the confirmed canonical group and stable ID.","evidenceSource":"IAMAI tenant truth"},{"id":"identity-types","label":"Identity types","gate":"Safe to enforce","result":"{{evidence.identityTypes}}","line":"This policy protects user-based service accounts, not service principals or managed identities.","evidenceSource":"IAMAI directory evidence"},{"id":"trusted-network","label":"Trusted network","gate":"Safe to configure","result":"{{trustedLocations.displayNames}}","line":"Only owner-approved named-location IDs may be excluded from the block.","evidenceSource":"IAMAI named-location truth"},{"id":"sources","label":"Workflow source locations","gate":"Safe to enforce","result":"{{evidence.sourceLocations}}","line":"Every required service workflow must originate from an approved trusted public egress.","evidenceSource":"IAMAI sign-in evidence + owner validation"},{"id":"workflow","label":"Workflow owners validated","gate":"Safe to enforce","result":"{{evidence.workflowValidation}}","line":"Service/application owners must confirm jobs will survive enforcement.","evidenceSource":"human validation"}],"whyIamaiSaysThis":"A Report-only block can show likely impact, but it cannot prove every scheduled or infrequent service workflow has been seen. Identity type and owner-validated source networks remain enforcement gates."}
@@IAMAI-END

@@IAMAI-BEGIN {"id":"troubleshooting.model","channel":"troubleshooting","states":["prerequisiteRequired","missing","partial","reportOnly","readyToEnforce","inPlace"],"format":"json","kind":"referenceOnly"}
{"scenarios":[{"id":"service-stopped","classification":"derived","symptom":"A scheduled job or application stopped after enforcement.","check":"Identify the user-based service account and the workflow's actual public egress IP/network.","fix":"Return the policy to Report-only if needed, then validate whether that source should be an approved named location. Do not auto-trust it.","then":"Rescan and re-approve before enforcement.","sources":["ms-ca-network"]},{"id":"service-principal-unaffected","classification":"documented","symptom":"A service principal continues to authenticate from an untrusted network.","check":"Confirm the identity is a service principal rather than a user-based service account.","fix":"Use Conditional Access for workload identities or migrate to a managed identity where appropriate.","then":"Do not claim this user/group policy protects that principal.","sources":["ms-workload-ca","ms-secure-service-accounts"]},{"id":"private-ip","classification":"documented","symptom":"A trusted location was built from 10.x/172.16-31.x/192.168.x addresses and policy behavior is wrong.","check":"Determine the public egress address Microsoft sees.","fix":"Use owner-approved public IP/CIDR named-location data.","then":"Retest in Report-only.","sources":["ms-ca-network"]},{"id":"new-vendor-egress","classification":"derived","symptom":"A vendor-hosted workflow appears outside the approved network.","check":"Confirm the workflow owner, purpose, and stable source range.","fix":"Do not auto-add the IP; obtain owner approval or move the workload to an approved identity/network.","then":"Update tenant truth and rescan.","sources":["ms-secure-service-accounts"]},{"id":"wrong-direction","classification":"derived","symptom":"Service accounts are blocked on the trusted network or allowed everywhere else.","check":"Verify Locations = Include All, Exclude approved trusted named locations, Grant = Block.","fix":"Correct the bounded conditions/grant by stable policy ID.","then":"Read back and rescan.","sources":["ms-ca-network","ms-ca-locations-v1"]},{"id":"empty-wrong-group","classification":"derived","symptom":"The expected service accounts are not affected.","check":"Verify the canonical group ID and membership plus member identity types.","fix":"Correct tenant group membership/identity classification through the owning step; do not substitute another group in this policy package.","then":"Rescan IAMAI.","sources":["ms-ca-users"]},{"id":"graph-403","classification":"documented","symptom":"Graph/PowerShell returns 403.","check":"Verify Policy.Read.All + Policy.ReadWrite.ConditionalAccess and an appropriate Conditional Access/Security Administrator role.","fix":"Reconnect with least required permissions.","then":"Retry the same bounded operation.","sources":["ms-ca-create-v1"]}]}
@@IAMAI-END

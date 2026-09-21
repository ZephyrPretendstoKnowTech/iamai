@@IAMAI-BEGIN {"id":"entra.prerequisites","channel":"entra","states":["prerequisiteRequired"],"format":"markdown","kind":"template"}
Resolve these before implementation:
1. Confirm the service-accounts group and its object ID.
2. Confirm each intended member is a **user-based** service account. A call made by a service principal is not blocked by a policy scoped to users, and a policy assigned to a group is not enforced for a service principal inside it; covering one takes Conditional Access for workload identities.
3. Confirm the approved trusted named location ID(s). Do not infer them from sign-in history.
4. Confirm each required job's public source network with its owner, including scheduled, infrequent and vendor-hosted jobs.
5. Confirm the intended exclusions.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"entra.create","channel":"entra","states":["missing"],"format":"markdown","kind":"template"}
Create this policy in Report-only. It will not enforce its access rule until you enable it.
1. Entra admin center → Entra ID → Conditional Access → Policies → New policy.
2. Name: `{{policy.target.displayName}}`.
3. Users: Include Groups → service-accounts group `{{serviceAccounts.group.displayName}}` / ID `{{serviceAccounts.group.id}}`. Exclude exactly `{{policy.target.excludeGroups}}`.
4. Target resources: All resources.
5. Conditions → **Network** (older portal: **Locations**): set **Configure** to **Yes**, then Include **Any network or location**; Exclude the approved trusted location(s): `{{trustedLocations.displayNames}}`. Left at **No** the network condition is not configured, and Microsoft's rule is that a policy applies to all locations by default.
6. Client apps: All. Configure no other conditions.
7. Grant: Block access.
8. Session: not configured.
9. Enable policy: Report-only. Do not choose **On** here: a policy created On applies to everyone it covers from the moment you save, before anyone has seen who it would have stopped — the failure this plan exists to prevent. The script for this step can only create in Report-only.
10. Create, reopen the policy to check the settings, and rescan in IAMAI.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"entra.correct.open","channel":"entra","states":["partial"],"format":"markdown","kind":"template"}
This change removes {{policy.current.removedExclusions}} from the policy's exclusions. If the policy is On, it applies to them as soon as you save. [omit this line when unavailable]

Open the existing policy with ID `{{policy.current.id}}`. Correct only the settings listed below.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"entra.correct.users","channel":"entra","states":["partial"],"format":"markdown","kind":"template"}
Include only the service-accounts group ID `{{serviceAccounts.group.id}}`, and remove any other included or excluded users and roles. Exclude exactly `{{policy.target.excludeGroups}}`. Group membership is managed separately; do not add or remove members here.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"entra.correct.target","channel":"entra","states":["partial"],"format":"markdown","kind":"template"}
Set Target resources to All resources, with no resource exclusions, and client apps to All.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"entra.correct.network","channel":"entra","states":["partial"],"format":"markdown","kind":"template"}
Conditions → Network: set **Configure** to **Yes**, then Include **Any network or location** and exclude only the approved trusted location ID(s) `{{trustedLocations.ids}}`. Check the direction: the policy blocks sign-ins from everywhere except those excluded locations.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"entra.correct.conditions","channel":"entra","states":["partial"],"format":"markdown","kind":"template"}
Set the conditions to the intended target: include the service-accounts group, the resolved exclusions, All resources, client apps All, Any network or location except the approved trusted location IDs, and no other condition.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"entra.correct.grant","channel":"entra","states":["partial"],"format":"markdown","kind":"template"}
Set Grant to Block access. Remove other grant requirements. Operator remains OR.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"entra.correct.session","channel":"entra","states":["partial"],"format":"markdown","kind":"template"}
Remove all session controls. This block policy uses none.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"entra.correct.lifecycle","channel":"entra","states":["partial"],"format":"markdown","kind":"template"}
When IAMAI selected lifecycle correction, set the policy to Report-only. Do not change lifecycle for a healthy policy merely because another mismatch is being corrected.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"entra.correct.save-verify","channel":"entra","states":["partial"],"format":"markdown","kind":"template"}
Save the corrections, reopen the same policy by its ID to check the saved settings, and rescan in IAMAI. Do not create a duplicate policy.

Keep the policy's current state. If it is On, the changed rule can affect access after you save.

@@IAMAI-END

@@IAMAI-BEGIN {"id":"entra.observe","channel":"entra","states":["reportOnly"],"format":"markdown","kind":"template"}
Keep the policy in Report-only while you review the evidence listed for this step. Check that it targets only the service-accounts group, and compare the accounts' sign-in locations with the approved trusted locations. Review scheduled and infrequent jobs with their owners: a job that did not run during the review does not appear in the results. A source network is not approved just because it appears in sign-in history.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"entra.enforce","channel":"entra","states":["readyToEnforce"],"format":"markdown","kind":"template"}
Verify the same policy and its prerequisites: the targeted members are user-based service accounts, the trusted location IDs are approved, and job owners have confirmed each required job's source network.

Do not turn it on unless all of these are true now:

- The required report-only period is complete, with no failures on this policy in the sign-in records.
- The policy is still Report-only and its settings still match the intended target, exclusions included — the script for this step refuses to enforce a policy that is not.
- Emergency access is prepared and tested.

If any one of them is not true, leave the policy in Report-only. Change only **Enable policy** from Report-only to **On**, then reopen the policy to check the state. Verify after the change: the service accounts' jobs still run normally. Rescan in IAMAI.
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

@@IAMAI-BEGIN {"id":"powershell.run","channel":"powershell","states":["missing","partial","reportOnly","readyToEnforce"],"format":"powershell","kind":"deployableAfterBinding","invocation":{"modeParameter":"Mode","parameters":{"PolicyId":{"binding":"policy.current.id","modes":["CorrectConditions","CorrectGrant","CorrectSession","Verify","Enforce"]},"DisplayName":{"binding":"policy.target.displayName","modes":["Create"]},"ServiceAccountsGroupId":{"binding":"serviceAccounts.group.id","modes":["Create","CorrectConditions","Verify","Enforce"]},"ExcludeGroups":{"binding":"policy.target.excludeGroups","modes":["Create","CorrectConditions"]},"TrustedLocations":{"binding":"trustedLocations.ids","modes":["Create","CorrectConditions","Verify","Enforce"]}},"withheldModes":{"Enforce":"Enforce runs only with -IdentityTypesValidated and -WorkflowSourcesValidated, and this package declares no prerequisite IAMAI can check to pass them."}}}
# This change removes {{policy.current.removedExclusions}} from the policy's exclusions. If the policy is On, it applies to them as soon as the correction is saved. [omit this line when unavailable]
param(
  [Parameter(Mandatory=$true)][ValidateSet('Create','CorrectConditions','CorrectGrant','CorrectSession','ReportOnly','Verify','Enforce')][string]$Mode,
  [string]$PolicyId,
  [string]$DisplayName,
  [string]$ServiceAccountsGroupId,
  [string[]]$ExcludeGroups=@(),
  [string[]]$TrustedLocations=@(),
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
function Conditions {
  if($ServiceAccountsGroupId -notmatch '^[0-9a-fA-F-]{36}$'){throw 'Resolved service-accounts group GUID required.'}
  $loc=@($TrustedLocations)
  if($loc.Count-lt1){throw 'At least one resolved trusted named-location ID is required.'}
  @{
    users=@{includeUsers=@();excludeUsers=@();includeGroups=@($ServiceAccountsGroupId);excludeGroups=@($ExcludeGroups);includeRoles=@();excludeRoles=@()};
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
  $want=@($TrustedLocations)|Sort-Object
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

Restrict Service Accounts to the Trusted Network in {{tenant.displayName}} is waiting on prerequisites: the confirmed service-accounts group and its ID, confirmation that members are user-based service accounts rather than service principals or managed identities, approved trusted named location IDs, and job owners' confirmation of each required job's public source network. Sign-in history shows where accounts signed in; it does not approve a network.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"ai.create","channel":"aiInfo","states":["missing"],"format":"markdown","kind":"template"}

This state creates a block policy for user-based service accounts in Report-only. It targets only the service-accounts group, with the resolved exclusions, All resources and all client apps, and blocks sign-ins from any location except the approved trusted locations. It does not cover service principals or managed identities. Limiting where these accounts can sign in reduces where a stolen password can be used; it does not replace moving these jobs to managed identities or service principals.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"ai.correct","channel":"aiInfo","states":["partial"],"format":"markdown","kind":"template"}

Differences IAMAI found: {{policy.current.semanticMismatches}}. The correction updates the same policy ID and keeps the service-accounts group and the approved trusted location IDs. It does not add trusted networks or extend this user policy to service principals.

Keep the policy's current state. If it is On, the changed rule can affect access after you save.

This change removes {{policy.current.removedExclusions}} from the policy's exclusions. If the policy is On, it applies to them as soon as you save. [omit this line when unavailable]
@@IAMAI-END

@@IAMAI-BEGIN {"id":"ai.observe","channel":"aiInfo","states":["reportOnly"],"format":"markdown","kind":"template"}

The policy is in Report-only. Identity types: {{evidence.identityTypes}}. Source locations: {{evidence.sourceLocations}}. Job owner confirmation: {{evidence.workflowValidation}}. Service-account members: {{serviceAccounts.members}}. A required job seen outside the approved trusted locations would be blocked after enforcement. Jobs that did not run during the review period do not appear in this evidence.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"ai.enforce","channel":"aiInfo","states":["readyToEnforce"],"format":"markdown","kind":"template"}

The policy is ready to enforce. Before it is set On, the same policy ID should still be Report-only and match its intended target, every targeted member should be a user-based service account, and every required job should run from an approved trusted network. The enforcement operation changes only the policy state. After enforcement, the jobs need to be checked for normal operation.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"email.owners.pre-enforcement","channel":"email","states":["readyToEnforce"],"format":"markdown","kind":"template"}
Subject: Action needed: Restrict Service Accounts to the Trusted Network

Please confirm where the listed service accounts run, including scheduled jobs, hosted services and remote processes. IT will check those sources before restricting sign-in.

Service accounts: {{serviceAccounts.members}} [omit this line when unavailable]
@@IAMAI-END

@@IAMAI-BEGIN {"id":"readiness.model","channel":"readiness","states":["prerequisiteRequired","missing","partial","reportOnly","readyToEnforce"],"format":"json-template","kind":"referenceOnly"}
{"tiles":[{"id":"group","label":"Service-account group","gate":"Safe to configure","result":"{{serviceAccounts.group.displayName}}","line":"The service-accounts group and its ID must be confirmed.","evidenceSource":"IAMAI tenant truth"},{"id":"identity-types","label":"Identity types","gate":"Safe to enforce","result":"{{evidence.identityTypes}}","line":"This policy protects user-based service accounts, not service principals or managed identities.","evidenceSource":"IAMAI directory evidence"},{"id":"trusted-network","label":"Trusted network","gate":"Safe to configure","result":"{{trustedLocations.displayNames}}","line":"Only owner-approved named-location IDs may be excluded from the block.","evidenceSource":"IAMAI named-location truth"},{"id":"sources","label":"Workflow source locations","gate":"Safe to enforce","result":"{{evidence.sourceLocations}}","line":"Confirm the group and every required job's public egress. This user policy does not cover service principals or managed identities.","evidenceSource":"IAMAI sign-in evidence + owner validation"},{"id":"workflow","label":"Workflow owners validated","gate":"Safe to enforce","result":"{{evidence.workflowValidation}}","line":"Job owners must confirm that each required job runs from an approved network.","evidenceSource":"human validation"}],"whyIamaiSaysThis":"A Report-only block can show likely impact, but it cannot prove every scheduled or infrequent service workflow has been seen. Identity type and owner-validated source networks remain enforcement gates."}
@@IAMAI-END

@@IAMAI-BEGIN {"id":"troubleshooting.model","channel":"troubleshooting","states":["prerequisiteRequired","missing","partial","reportOnly","readyToEnforce","inPlace"],"format":"json","kind":"referenceOnly"}
{"scenarios":[{"id":"service-stopped","classification":"derived","symptom":"A scheduled job or application stopped after enforcement.","check":"Identify the user-based service account and the workflow's actual public egress IP/network.","fix":"Return the policy to Report-only if needed, then validate whether that source should be an approved named location. Do not auto-trust it.","then":"Rescan and re-approve before enforcement.","sources":["ms-ca-network"]},{"id":"service-principal-unaffected","classification":"documented","symptom":"A service principal continues to authenticate from an untrusted network.","check":"Confirm the identity is a service principal rather than a user-based service account.","fix":"Use Conditional Access for workload identities or migrate to a managed identity where appropriate.","then":"Do not claim this user/group policy protects that principal.","sources":["ms-workload-ca","ms-secure-service-accounts"]},{"id":"private-ip","classification":"documented","symptom":"A trusted location was built from 10.x/172.16-31.x/192.168.x addresses and policy behavior is wrong.","check":"Determine the public egress address Microsoft sees.","fix":"Use owner-approved public IP/CIDR named-location data.","then":"Retest in Report-only.","sources":["ms-ca-network"]},{"id":"new-vendor-egress","classification":"derived","symptom":"A vendor-hosted workflow appears outside the approved network.","check":"Confirm the workflow owner, purpose, and stable source range.","fix":"Do not auto-add the IP; obtain owner approval or move the workload to an approved identity/network.","then":"Update the approved locations and rescan.","sources":["ms-secure-service-accounts"]},{"id":"wrong-direction","classification":"derived","symptom":"Service accounts are blocked on the trusted network or allowed everywhere else.","check":"Verify Locations = Include All, Exclude approved trusted named locations, Grant = Block.","fix":"Correct the conditions and grant on the same policy ID.","then":"Read back and rescan.","sources":["ms-ca-network","ms-ca-locations-v1"]},{"id":"empty-wrong-group","classification":"derived","symptom":"The expected service accounts are not affected.","check":"Verify the service-accounts group ID, its membership and member identity types.","fix":"Correct tenant group membership/identity classification through the owning step; do not substitute another group in this policy package.","then":"Rescan IAMAI.","sources":["ms-ca-users"]},{"id":"graph-403","classification":"documented","symptom":"Graph/PowerShell returns 403.","check":"Verify Policy.Read.All + Policy.ReadWrite.ConditionalAccess and an appropriate Conditional Access/Security Administrator role.","fix":"Reconnect with least required permissions.","then":"Retry the same bounded operation.","sources":["ms-ca-create-v1"]}]}
@@IAMAI-END

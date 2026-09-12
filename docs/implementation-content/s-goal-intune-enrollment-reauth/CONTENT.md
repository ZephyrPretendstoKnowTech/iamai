@@IAMAI-BEGIN {"id":"entra.prepare.resource","channel":"entra","states":["resourceMissing"],"format":"markdown","kind":"template"}
Microsoft Entra admin center → Enterprise applications. Confirm **Microsoft Intune Enrollment** exists for application ID `d4ebce55-015a-49b5-a083-c84d1797ae8c`. If it is absent, create the service principal using the supported Microsoft Graph/Application Administrator path in this package, then rescan IAMAI before creating the CA policy. Do not substitute the Microsoft Intune admin-center app.
@@IAMAI-END
@@IAMAI-BEGIN {"id":"entra.create","channel":"entra","states":["missing"],"format":"markdown","kind":"template"}
1. Microsoft Entra admin center → Entra ID → Conditional Access → Policies → New policy.
2. Name: **{{policy.target.displayName}}**.
3. Users → Include: **All users**. Exclude the IAMAI-resolved canonical exclusions: **{{policy.target.excludeGroups}}**.
4. Target resources → Resources → Select resources → **Microsoft Intune Enrollment**.
5. Leave unrelated Conditions unconfigured. Client apps remains All.
6. Do not add a Grant control for this retained baseline member.
7. Session → Sign-in frequency → **Every time**.
8. Enable policy → **Report-only**. Create, read back, and rescan IAMAI.
@@IAMAI-END
@@IAMAI-BEGIN {"id":"entra.correct.open","channel":"entra","states":["partial"],"format":"markdown","kind":"template"}
Open the exact IAMAI-resolved tenant Conditional Access policy by stable identity. Display name is context only; do not use it as update identity.
@@IAMAI-END
@@IAMAI-BEGIN {"id":"entra.correct.users","channel":"entra","states":["partial"],"format":"markdown","kind":"template"}
Under Users, set Include to All users and make Exclude exactly the IAMAI-resolved canonical exclusions. Preserve the Intune Enrollment target and Every-time session control if IAMAI says they are already correct.
@@IAMAI-END
@@IAMAI-BEGIN {"id":"entra.correct.target","channel":"entra","states":["partial"],"format":"markdown","kind":"template"}
Under Target resources, select Microsoft Intune Enrollment only. Remove any incorrect resource target. Preserve population/exclusions and the Every-time session control if already canonical.
@@IAMAI-END
@@IAMAI-BEGIN {"id":"entra.correct.conditions","channel":"entra","states":["partial"],"format":"markdown","kind":"template"}
Remove IAMAI-classified noncanonical risk, location, platform, device/filter, authentication-flow, or user-action conditions. Client apps remains All. Do not add device-based enrollment restrictions.
@@IAMAI-END
@@IAMAI-BEGIN {"id":"entra.correct.grant","channel":"entra","states":["partial"],"format":"markdown","kind":"template"}
Remove the IAMAI-classified noncanonical Grant control so this retained baseline member has no grantControls. Do not change another policy that separately requires MFA for device registration/join.
@@IAMAI-END
@@IAMAI-BEGIN {"id":"entra.correct.session","channel":"entra","states":["partial"],"format":"markdown","kind":"template"}
Session → Sign-in frequency → Every time. Remove IAMAI-classified noncanonical session controls. Preserve all canonical assignments/conditions.
@@IAMAI-END
@@IAMAI-BEGIN {"id":"entra.correct.lifecycle","channel":"entra","states":["partial"],"format":"markdown","kind":"template"}
Set Enable policy to Report-only while corrections are being validated.
@@IAMAI-END
@@IAMAI-BEGIN {"id":"entra.correct.save-verify","channel":"entra","states":["partial"],"format":"markdown","kind":"template"}
Save only the selected corrections, read back the same stable policy, then rescan IAMAI. Do not apply correction modules for fields IAMAI already classifies as canonical.
@@IAMAI-END
@@IAMAI-BEGIN {"id":"entra.observe","channel":"entra","states":["reportOnly"],"format":"markdown","kind":"template"}
Leave the canonical policy in Report-only. Review that the intended user-driven enrollment paths actually target Microsoft Intune Enrollment and note any userless/self-deploying paths separately. Report-only can show policy applicability, but it cannot prove a fresh reauthentication prompt occurred. Rescan when evidence changes.
@@IAMAI-END
@@IAMAI-BEGIN {"id":"entra.enforce","channel":"entra","states":["readyToEnforce"],"format":"markdown","kind":"template"}
1. Open the exact stable policy and confirm it is still canonical and Report-only.
2. Confirm the required user-driven and userless/self-deploying enrollment workflows have been reviewed.
3. Change Enable policy to On and save.
4. Perform a controlled user-driven Intune enrollment and confirm fresh reauthentication occurs.
5. Verify required userless/self-deploying flows still work, then rescan IAMAI.
6. If enrollment fails unexpectedly, return this same policy to Report-only.
@@IAMAI-END
@@IAMAI-BEGIN {"id":"json.prepare.resource","channel":"json","states":["resourceMissing"],"format":"json","kind":"deployableAfterBinding","method":"POST","endpoint":"https://graph.microsoft.com/v1.0/servicePrincipals"}
{"appId":"d4ebce55-015a-49b5-a083-c84d1797ae8c"}
@@IAMAI-END
@@IAMAI-BEGIN {"id":"json.create","channel":"json","states":["missing"],"format":"json-template","kind":"deployableAfterBinding","method":"POST","endpoint":"https://graph.microsoft.com/v1.0/identity/conditionalAccess/policies"}
{"displayName":{{json:policy.target.displayName}},"state":"enabledForReportingButNotEnforced","conditions":{"users":{"includeUsers":["All"],"excludeUsers":[],"includeGroups":[],"excludeGroups":{{json:policy.target.excludeGroups}},"includeRoles":[],"excludeRoles":[]},"applications":{"includeApplications":["d4ebce55-015a-49b5-a083-c84d1797ae8c"],"excludeApplications":[],"includeUserActions":[],"includeAuthenticationContextClassReferences":[]},"clientAppTypes":["all"],"signInRiskLevels":[],"userRiskLevels":[],"servicePrincipalRiskLevels":[]},"sessionControls":{"signInFrequency":{"isEnabled":true,"frequencyInterval":"everyTime","authenticationType":"primaryAndSecondaryAuthentication"}}}
@@IAMAI-END
@@IAMAI-BEGIN {"id":"json.correct.conditions","channel":"json","states":["partial"],"format":"json-template","kind":"deployableAfterBinding","method":"PATCH","endpoint":"https://graph.microsoft.com/v1.0/identity/conditionalAccess/policies/{policy.current.id}"}
{"conditions":{"users":{"includeUsers":["All"],"excludeUsers":[],"includeGroups":[],"excludeGroups":{{json:policy.target.excludeGroups}},"includeRoles":[],"excludeRoles":[]},"applications":{"includeApplications":["d4ebce55-015a-49b5-a083-c84d1797ae8c"],"excludeApplications":[],"includeUserActions":[],"includeAuthenticationContextClassReferences":[]},"clientAppTypes":["all"],"signInRiskLevels":[],"userRiskLevels":[],"servicePrincipalRiskLevels":[]}}
@@IAMAI-END
@@IAMAI-BEGIN {"id":"json.correct.grant","channel":"json","states":["partial"],"format":"json","kind":"deployableAfterBinding","method":"PATCH","endpoint":"https://graph.microsoft.com/v1.0/identity/conditionalAccess/policies/{policy.current.id}"}
{"grantControls":null}
@@IAMAI-END
@@IAMAI-BEGIN {"id":"json.correct.session","channel":"json","states":["partial"],"format":"json","kind":"deployableAfterBinding","method":"PATCH","endpoint":"https://graph.microsoft.com/v1.0/identity/conditionalAccess/policies/{policy.current.id}"}
{"sessionControls":{"signInFrequency":{"isEnabled":true,"frequencyInterval":"everyTime","authenticationType":"primaryAndSecondaryAuthentication"}}}
@@IAMAI-END
@@IAMAI-BEGIN {"id":"json.correct.report-only","channel":"json","states":["partial"],"format":"json","kind":"deployableAfterBinding","method":"PATCH","endpoint":"https://graph.microsoft.com/v1.0/identity/conditionalAccess/policies/{policy.current.id}"}
{"state":"enabledForReportingButNotEnforced"}
@@IAMAI-END
@@IAMAI-BEGIN {"id":"json.enforce","channel":"json","states":["readyToEnforce"],"format":"json","kind":"deployableAfterBinding","method":"PATCH","endpoint":"https://graph.microsoft.com/v1.0/identity/conditionalAccess/policies/{policy.current.id}"}
{"state":"enabled"}
@@IAMAI-END
@@IAMAI-BEGIN {"id":"powershell.run","channel":"powershell","states":["resourceMissing","missing","partial","reportOnly","readyToEnforce"],"format":"powershell","kind":"deployableAfterBinding","invocation":{"modeParameter":"Mode","parameters":{"PolicyDisplayName":{"binding":"policy.target.displayName","modes":["Create"]},"PolicyId":{"binding":"policy.current.id","modes":["CorrectConditions","CorrectGrant","CorrectSession","ReportOnly","Verify"]},"ExcludeGroupIds":{"binding":"policy.target.excludeGroups","modes":["Create","CorrectConditions","Verify"]}},"withheldModes":{"Enforce":"the script enforces only with -ReadinessApproved and -EnrollmentWorkflowsValidated, an attestation this package declares no prerequisite for, so IAMAI cannot pass it"}}}
# IAMAI compact implementation script — Require a Fresh Sign-in for Intune Enrollment
[CmdletBinding()]
param(
 [Parameter(Mandatory)][ValidateSet('PrepareResource','Create','CorrectConditions','CorrectGrant','CorrectSession','ReportOnly','Verify','Enforce')][string]$Mode,
 [string]$PolicyDisplayName,
 [ValidatePattern('^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$')][string]$PolicyId,
 [string[]]$ExcludeGroupIds=@(),
 [switch]$ReadinessApproved,
 [switch]$EnrollmentWorkflowsValidated
)
Set-StrictMode -Version Latest
$ErrorActionPreference='Stop'
$CaBase='https://graph.microsoft.com/v1.0/identity/conditionalAccess/policies'
$SpBase='https://graph.microsoft.com/v1.0/servicePrincipals'
$AppId='d4ebce55-015a-49b5-a083-c84d1797ae8c'
$Guid='^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
function Connect-Scopes([string[]]$Scopes){Import-Module Microsoft.Graph.Authentication -ErrorAction Stop;$c=Get-MgContext;$missing=if($c){@($Scopes|?{$_ -notin @($c.Scopes)})}else{$Scopes};if(-not$c-or$missing.Count){Connect-MgGraph -Scopes $Scopes -NoWelcome}}
function Assert-Ids{param([string[]]$Ids);$bad=@($Ids|?{$_ -notmatch $Guid});if($bad.Count){throw 'Invalid exclusion object ID.'}}
function Get-IntuneSp{ $f=[uri]::EscapeDataString("appId eq '$AppId'"); @((Invoke-MgGraphRequest -Method GET -Uri "$SpBase?`$filter=$f").value) }
function Get-Policy{if($PolicyId -notmatch $Guid){throw 'Stable IAMAI policy ID required.'};$p=Invoke-MgGraphRequest -Method GET -Uri "$CaBase/$PolicyId";if($p.id-ne$PolicyId){throw 'Stable-ID readback failed.'};$p}
function Conditions{Assert-Ids $ExcludeGroupIds;@{users=@{includeUsers=@('All');excludeUsers=@();includeGroups=@();excludeGroups=@($ExcludeGroupIds);includeRoles=@();excludeRoles=@()};applications=@{includeApplications=@($AppId);excludeApplications=@();includeUserActions=@();includeAuthenticationContextClassReferences=@()};clientAppTypes=@('all');signInRiskLevels=@();userRiskLevels=@();servicePrincipalRiskLevels=@();locations=$null;platforms=$null;devices=$null;authenticationFlows=$null;insiderRiskLevels=$null}}
function Session{@{signInFrequency=@{isEnabled=$true;frequencyInterval='everyTime';authenticationType='primaryAndSecondaryAuthentication'};persistentBrowser=$null;applicationEnforcedRestrictions=$null;cloudAppSecurity=$null;disableResilienceDefaults=$null}}
function Patch([hashtable]$Body){[void](Get-Policy);Invoke-MgGraphRequest -Method PATCH -Uri "$CaBase/$PolicyId" -Body($Body|ConvertTo-Json -Depth 20)-ContentType 'application/json'|Out-Null}
function Assert-Canonical($p){if(@($p.conditions.users.includeUsers).Count-ne1-or$p.conditions.users.includeUsers[0]-ne'All'){throw 'includeUsers mismatch'};if((@($p.conditions.users.excludeGroups)|Sort-Object)-join',' -ne (@($ExcludeGroupIds)|Sort-Object)-join','){throw 'excludeGroups mismatch'};if(@($p.conditions.applications.includeApplications).Count-ne1-or$p.conditions.applications.includeApplications[0]-ne$AppId){throw 'Intune Enrollment target mismatch'};if(@($p.conditions.clientAppTypes).Count-ne1-or$p.conditions.clientAppTypes[0]-ne'all'){throw 'clientAppTypes mismatch'};if($null-ne$p.grantControls){throw 'Noncanonical grantControls exist'};$s=$p.sessionControls.signInFrequency;if(-not$s.isEnabled-or$s.frequencyInterval-ne'everyTime'-or$s.authenticationType-ne'primaryAndSecondaryAuthentication'){throw 'Every-time session control mismatch'}}
switch($Mode){
 'PrepareResource'{Connect-Scopes @('Application.Read.All','Application.ReadWrite.All');$sp=Get-IntuneSp;if($sp.Count-gt1){throw 'Multiple Intune Enrollment service principals found; stop and review.'};if($sp.Count-eq0){$created=Invoke-MgGraphRequest -Method POST -Uri $SpBase -Body(@{appId=$AppId}|ConvertTo-Json)-ContentType 'application/json';Write-Host "Created Microsoft Intune Enrollment service principal $($created.id). Rescan IAMAI."}else{Write-Host "Microsoft Intune Enrollment service principal already exists: $($sp[0].id)."}}
 'Create'{Connect-Scopes @('Policy.Read.All','Policy.ReadWrite.ConditionalAccess','Application.Read.All');if((Get-IntuneSp).Count-ne1){throw 'Microsoft Intune Enrollment service principal must exist before policy creation.'};if([string]::IsNullOrWhiteSpace($PolicyDisplayName)){throw 'PolicyDisplayName required.'};$e=$PolicyDisplayName.Replace("'","''");$f=[uri]::EscapeDataString("displayName eq '$e'");if(@((Invoke-MgGraphRequest -Method GET -Uri "$CaBase?`$filter=$f").value).Count){throw 'Exact display-name collision. Rescan IAMAI; do not create a duplicate.'};$b=@{displayName=$PolicyDisplayName;state='enabledForReportingButNotEnforced';conditions=(Conditions);sessionControls=(Session)};$r=Invoke-MgGraphRequest -Method POST -Uri $CaBase -Body($b|ConvertTo-Json -Depth 20)-ContentType 'application/json';Write-Host "Created $($r.id) in Report-only. Rescan IAMAI."}
 'CorrectConditions'{Connect-Scopes @('Policy.Read.All','Policy.ReadWrite.ConditionalAccess');Patch @{conditions=(Conditions)}}
 'CorrectGrant'{Connect-Scopes @('Policy.Read.All','Policy.ReadWrite.ConditionalAccess');Patch @{grantControls=$null}}
 'CorrectSession'{Connect-Scopes @('Policy.Read.All','Policy.ReadWrite.ConditionalAccess');Patch @{sessionControls=(Session)}}
 'ReportOnly'{Connect-Scopes @('Policy.Read.All','Policy.ReadWrite.ConditionalAccess');Patch @{state='enabledForReportingButNotEnforced'}}
 'Verify'{Connect-Scopes @('Policy.Read.All');$p=Get-Policy;Assert-Canonical $p;Write-Host "Canonical policy verified; lifecycle=$($p.state). User prompt behavior still requires enforcement testing."}
 'Enforce'{if(-not$ReadinessApproved-or-not$EnrollmentWorkflowsValidated){throw 'Enforce requires ReadinessApproved and EnrollmentWorkflowsValidated.'};Connect-Scopes @('Policy.Read.All','Policy.ReadWrite.ConditionalAccess');$p=Get-Policy;Assert-Canonical $p;if($p.state-ne'enabledForReportingButNotEnforced'){throw 'Policy must be canonical and Report-only immediately before enforcement.'};Patch @{state='enabled'};$a=Get-Policy;Assert-Canonical $a;if($a.state-ne'enabled'){throw 'Enablement readback failed.'};Write-Host 'Policy enabled. Perform controlled user-driven enrollment and rescan IAMAI.'}
}
@@IAMAI-END
@@IAMAI-BEGIN {"id":"ai.prepare","channel":"aiInfo","states":["resourceMissing"],"format":"markdown","kind":"template"}
**Contains tenant context. Review before sharing with an external AI service.**

ROLE
Help implement IAMAI step **Require a Fresh Sign-in for Intune Enrollment**. Prepare the Microsoft Intune Enrollment service principal only when IAMAI says it is missing.

AUTHORITY
IAMAI tenant facts and saved decisions own tenant truth. The retained baseline owns the destination. Current Microsoft documentation owns portal/API behavior. Do not add MFA or device-compliance grants merely because Microsoft's separate enrollment-MFA recipe exists.

TENANT CONTEXT
- Tenant: {{tenant.displayName}} [omit if unavailable]
- Policy: {{policy.target.displayName}} [omit if unavailable]
- Current policy state: {{policy.current.state}} [omit if unavailable]
- Enrollment evidence: {{evidence.intuneEnrollments}} [omit if unavailable]
- Workflow evidence: {{evidence.enrollmentWorkflows}} [omit if unavailable]
- Blockers: {{dependencies.blockers}} [omit if unavailable]

TARGET
All users + canonical exclusions; Microsoft Intune Enrollment app `d4ebce55-015a-49b5-a083-c84d1797ae8c`; client apps All; no unrelated conditions; no grant controls; sign-in frequency Every time; Report-only before On.

SAFETY
Use stable policy ID for updates. Keep unknown workflow behavior Unknown. Return checks/evidence and the smallest safe next action.
@@IAMAI-END
@@IAMAI-BEGIN {"id":"ai.create","channel":"aiInfo","states":["missing"],"format":"markdown","kind":"template"}
**Contains tenant context. Review before sharing with an external AI service.**

ROLE
Help implement IAMAI step **Require a Fresh Sign-in for Intune Enrollment**. Create only the canonical session policy in Report-only.

AUTHORITY
IAMAI tenant facts and saved decisions own tenant truth. The retained baseline owns the destination. Current Microsoft documentation owns portal/API behavior. Do not add MFA or device-compliance grants merely because Microsoft's separate enrollment-MFA recipe exists.

TENANT CONTEXT
- Tenant: {{tenant.displayName}} [omit if unavailable]
- Policy: {{policy.target.displayName}} [omit if unavailable]
- Current policy state: {{policy.current.state}} [omit if unavailable]
- Enrollment evidence: {{evidence.intuneEnrollments}} [omit if unavailable]
- Workflow evidence: {{evidence.enrollmentWorkflows}} [omit if unavailable]
- Blockers: {{dependencies.blockers}} [omit if unavailable]

TARGET
All users + canonical exclusions; Microsoft Intune Enrollment app `d4ebce55-015a-49b5-a083-c84d1797ae8c`; client apps All; no unrelated conditions; no grant controls; sign-in frequency Every time; Report-only before On.

SAFETY
Use stable policy ID for updates. Keep unknown workflow behavior Unknown. Return checks/evidence and the smallest safe next action.
@@IAMAI-END
@@IAMAI-BEGIN {"id":"ai.correct","channel":"aiInfo","states":["partial"],"format":"markdown","kind":"template"}
**Contains tenant context. Review before sharing with an external AI service.**

ROLE
Help implement IAMAI step **Require a Fresh Sign-in for Intune Enrollment**. Correct only IAMAI-classified mismatches on the existing policy.

AUTHORITY
IAMAI tenant facts and saved decisions own tenant truth. The retained baseline owns the destination. Current Microsoft documentation owns portal/API behavior. Do not add MFA or device-compliance grants merely because Microsoft's separate enrollment-MFA recipe exists.

TENANT CONTEXT
- Tenant: {{tenant.displayName}} [omit if unavailable]
- Policy: {{policy.target.displayName}} [omit if unavailable]
- Current policy state: {{policy.current.state}} [omit if unavailable]
- Enrollment evidence: {{evidence.intuneEnrollments}} [omit if unavailable]
- Workflow evidence: {{evidence.enrollmentWorkflows}} [omit if unavailable]
- Blockers: {{dependencies.blockers}} [omit if unavailable]

TARGET
All users + canonical exclusions; Microsoft Intune Enrollment app `d4ebce55-015a-49b5-a083-c84d1797ae8c`; client apps All; no unrelated conditions; no grant controls; sign-in frequency Every time; Report-only before On.

SAFETY
Use stable policy ID for updates. Keep unknown workflow behavior Unknown. Return checks/evidence and the smallest safe next action.
@@IAMAI-END
@@IAMAI-BEGIN {"id":"ai.observe","channel":"aiInfo","states":["reportOnly"],"format":"markdown","kind":"template"}
**Contains tenant context. Review before sharing with an external AI service.**

ROLE
Help implement IAMAI step **Require a Fresh Sign-in for Intune Enrollment**. Validate applicability/evidence while the policy remains non-enforcing.

AUTHORITY
IAMAI tenant facts and saved decisions own tenant truth. The retained baseline owns the destination. Current Microsoft documentation owns portal/API behavior. Do not add MFA or device-compliance grants merely because Microsoft's separate enrollment-MFA recipe exists.

TENANT CONTEXT
- Tenant: {{tenant.displayName}} [omit if unavailable]
- Policy: {{policy.target.displayName}} [omit if unavailable]
- Current policy state: {{policy.current.state}} [omit if unavailable]
- Enrollment evidence: {{evidence.intuneEnrollments}} [omit if unavailable]
- Workflow evidence: {{evidence.enrollmentWorkflows}} [omit if unavailable]
- Blockers: {{dependencies.blockers}} [omit if unavailable]

TARGET
All users + canonical exclusions; Microsoft Intune Enrollment app `d4ebce55-015a-49b5-a083-c84d1797ae8c`; client apps All; no unrelated conditions; no grant controls; sign-in frequency Every time; Report-only before On.

SAFETY
Use stable policy ID for updates. Keep unknown workflow behavior Unknown. Return checks/evidence and the smallest safe next action.
@@IAMAI-END
@@IAMAI-BEGIN {"id":"ai.enforce","channel":"aiInfo","states":["readyToEnforce"],"format":"markdown","kind":"template"}
**Contains tenant context. Review before sharing with an external AI service.**

ROLE
Help implement IAMAI step **Require a Fresh Sign-in for Intune Enrollment**. Enable only after workflow readiness, then test user-driven enrollment.

AUTHORITY
IAMAI tenant facts and saved decisions own tenant truth. The retained baseline owns the destination. Current Microsoft documentation owns portal/API behavior. Do not add MFA or device-compliance grants merely because Microsoft's separate enrollment-MFA recipe exists.

TENANT CONTEXT
- Tenant: {{tenant.displayName}} [omit if unavailable]
- Policy: {{policy.target.displayName}} [omit if unavailable]
- Current policy state: {{policy.current.state}} [omit if unavailable]
- Enrollment evidence: {{evidence.intuneEnrollments}} [omit if unavailable]
- Workflow evidence: {{evidence.enrollmentWorkflows}} [omit if unavailable]
- Blockers: {{dependencies.blockers}} [omit if unavailable]

TARGET
All users + canonical exclusions; Microsoft Intune Enrollment app `d4ebce55-015a-49b5-a083-c84d1797ae8c`; client apps All; no unrelated conditions; no grant controls; sign-in frequency Every time; Report-only before On.

SAFETY
Use stable policy ID for updates. Keep unknown workflow behavior Unknown. Return checks/evidence and the smallest safe next action.
@@IAMAI-END
@@IAMAI-BEGIN {"id":"email.users.pre-enforcement","channel":"email","states":["readyToEnforce"],"format":"markdown","kind":"template"}
Subject: Fresh sign-in during device enrollment

Hi,

We are changing device enrollment so user-driven Intune enrollment asks for a fresh sign-in instead of relying on an older session. This applies when you enroll a work device; normal day-to-day sign-ins are not being changed by this policy.

If you are setting up a device and enrollment asks you to sign in again, complete the prompt and continue. If enrollment loops or stops, contact IT/device support and tell them which enrollment method you were using.

Thanks,
IT
@@IAMAI-END
@@IAMAI-BEGIN {"id":"readiness.model","channel":"readiness","states":["resourceMissing","missing","partial","reportOnly","readyToEnforce"],"format":"json-template","kind":"referenceOnly"}
{"tiles":[{"id":"resource","label":"Intune Enrollment resource","gate":"Safe to configure","result":"{{resource.intuneEnrollment.exists}}","line":"Microsoft Intune Enrollment must exist before the CA policy can target it.","evidenceSource":"tenant configuration"},{"id":"exclusions","label":"Exclusions","gate":"Safe to configure","result":"IAMAI-resolved","line":"Use the canonical exclusion set; do not rediscover or broaden it during implementation.","evidenceSource":"IAMAI canonical tenant truth"},{"id":"workflows","label":"Enrollment workflows","gate":"Safe to enforce","result":"{{evidence.enrollmentWorkflows}}","line":"User-driven and userless/self-deploying enrollment paths must be distinguished before enforcement.","evidenceSource":"tenant evidence / human validation"},{"id":"prompt-proof","label":"Fresh sign-in proof","gate":"Post-enforcement proof","result":"Unknown until tested","line":"Report-only cannot prove the user saw the fresh reauthentication prompt.","evidenceSource":"controlled enrollment test"}],"whyIamaiSaysThis":"IAMAI separates canonical configuration from behavioral proof. Configuration can be verified before enforcement; the actual fresh-prompt experience requires a controlled user-driven enrollment after the policy is On."}
@@IAMAI-END
@@IAMAI-BEGIN {"id":"troubleshooting.model","channel":"troubleshooting","states":["resourceMissing","missing","partial","reportOnly","readyToEnforce","inPlace"],"format":"json","kind":"referenceOnly"}
{"scenarios":[{"id":"resource-not-found","states":["resourceMissing","missing"],"classification":"documented","symptom":"Microsoft Intune Enrollment cannot be selected or Graph cannot target it.","check":"Confirm a service principal exists for appId d4ebce55-015a-49b5-a083-c84d1797ae8c.","fix":"Create the Microsoft Intune Enrollment service principal through the supported Entra/Graph application-admin path, then rescan IAMAI.","doNot":"Do not substitute the Microsoft Intune admin-center application.","then":"Retry only after IAMAI resolves the resource.","sources":["ms-intune-enrollment-mfa","ms-sp-create-v1"]},{"id":"enrollment-loop","states":["readyToEnforce","inPlace"],"classification":"documented","symptom":"Enrollment repeatedly asks for authentication or cannot complete.","check":"Review overlapping CA policies, especially additional MFA/device grants and Every-time sign-in frequency.","fix":"Return this policy to Report-only while the overlap is resolved.","doNot":"Do not weaken unrelated security controls without identifying the conflicting policy.","then":"Retest the same enrollment path.","sources":["ms-session-lifetime"]},{"id":"wrong-intune-app","states":["partial"],"classification":"documented","symptom":"The policy affects Intune admin-center access instead of enrollment.","check":"Verify Target resources is Microsoft Intune Enrollment, not Microsoft Intune.","fix":"Correct the target application only.","then":"Read back and rescan.","sources":["ms-intune-ca-scenarios"]},{"id":"device-grant-added","states":["partial"],"classification":"documented","symptom":"Enrollment is blocked by a compliant-device/device-based requirement.","check":"Inspect Grant controls and other overlapping policies for device-based access rules on Microsoft Intune Enrollment.","fix":"Remove the noncanonical grant from this retained step and resolve any separate overlapping policy deliberately.","doNot":"Do not require a device to already be compliant in order to enroll it through this step.","then":"Return to Report-only and retest.","sources":["ms-intune-enrollment-mfa"]},{"id":"selfdeploy-no-prompt","states":["reportOnly","readyToEnforce","inPlace"],"classification":"documented","symptom":"A self-deploying Autopilot flow does not show the fresh user sign-in prompt.","check":"Confirm the deployment mode is self-deploying/userless.","fix":"Treat that as a different workflow; validate that it still completes rather than expecting user-driven prompt evidence.","then":"Use a user-driven enrollment to prove the fresh prompt.","sources":["ms-autopilot-selfdeploy"]},{"id":"graph-403","states":["resourceMissing","missing","partial","readyToEnforce"],"classification":"documented","symptom":"Graph/PowerShell returns 403.","check":"For CA writes verify Policy.Read.All + Policy.ReadWrite.ConditionalAccess and an allowed CA role. For service-principal creation verify Application.ReadWrite.All and an allowed application-admin role.","fix":"Reconnect with the least required scope/role for the selected operation.","then":"Retry the same bounded operation.","sources":["ms-ca-create-v1","ms-sp-create-v1"]}]}
@@IAMAI-END

@@IAMAI-BEGIN {"id":"entra.prepare.resource","channel":"entra","states":["resourceMissing"],"format":"markdown","kind":"template"}
Microsoft Entra admin center → Enterprise applications. Confirm **Microsoft Intune Enrollment** exists for application ID `d4ebce55-015a-49b5-a083-c84d1797ae8c`. If it is absent, create the service principal using the supported Microsoft Graph/Application Administrator path in this package, then rescan IAMAI before creating the CA policy. Do not substitute the Microsoft Intune admin-center app.
@@IAMAI-END
@@IAMAI-BEGIN {"id":"entra.create","channel":"entra","states":["missing"],"format":"markdown","kind":"template"}
Create this policy in Report-only. It will not enforce its access rule until you enable it. This policy targets Microsoft Intune Enrollment only and sets Sign-in frequency to Every time. It does not add MFA or make the device compliant. Microsoft names Intune enrollment as one of the actions Every time is for, and it asks for the sign-in again whenever the session is evaluated.

1. Go to Entra admin center → Conditional Access → Policies → New policy.
2. Name: {{policy.target.displayName}}.
3. Users → Include: All users. Exclude → Groups: add the exclusions group.
4. Target resources → Select resources → Microsoft Intune Enrollment (not "All resources" — this policy targets only the enrollment flow).
5. Conditions: leave every condition unconfigured, **Client apps** included. At **Configure: No** the client-apps condition reaches every client app, which is the target here; selecting the four boxes instead writes a narrower policy that IAMAI reads as a difference that never resolves.
6. Grant: do not add a grant control. This policy only sets a session control, not an MFA requirement. Microsoft's own enrollment recipe adds one; the pinned baseline does not, and IAMAI follows the baseline.
7. Session → Sign-in frequency: Every time.
8. Enable policy: Report-only. Do not choose **On** here: a policy created On applies to everyone it covers from the moment you save, before anyone has seen who it would have stopped — the failure this plan exists to prevent. The script for this step can only create in Report-only.
9. Create. Rescan in IAMAI.
@@IAMAI-END
@@IAMAI-BEGIN {"id":"entra.correct.open","channel":"entra","states":["partial"],"format":"markdown","kind":"template"}
This change removes {{policy.current.removedExclusions}} from the policy's exclusions. If the policy is On, it applies to them as soon as you save. [omit this line when unavailable]

Open the existing Conditional Access policy IAMAI resolved, using its policy ID. The display name is context only; do not use it to find the policy to update.
@@IAMAI-END
@@IAMAI-BEGIN {"id":"entra.correct.users","channel":"entra","states":["partial"],"format":"markdown","kind":"template"}
Under Users, set Include to All users and make Exclude exactly the resolved exclusions. Leave the Intune Enrollment target and Every time session control unchanged if IAMAI found no difference there.
@@IAMAI-END
@@IAMAI-BEGIN {"id":"entra.correct.target","channel":"entra","states":["partial"],"format":"markdown","kind":"template"}
Under Target resources, select Microsoft Intune Enrollment only. Remove any other resource target. Leave users, exclusions and the Every time session control unchanged if IAMAI found no difference there.
@@IAMAI-END
@@IAMAI-BEGIN {"id":"entra.correct.conditions","channel":"entra","states":["partial"],"format":"markdown","kind":"template"}
Remove the risk, location, platform, device/filter, authentication-flow, or user-action conditions IAMAI identified as differences. Leave **Client apps** at **Configure: No**, which reaches every client app. Do not add a device-based enrollment restriction: Microsoft says not to, because a device cannot already be compliant while it is being enrolled.
@@IAMAI-END
@@IAMAI-BEGIN {"id":"entra.correct.grant","channel":"entra","states":["partial"],"format":"markdown","kind":"template"}
Remove the Grant control IAMAI identified so this policy has no grant; it sets only a session control. Do not change another policy that separately requires MFA for device registration/join.
@@IAMAI-END
@@IAMAI-BEGIN {"id":"entra.correct.session","channel":"entra","states":["partial"],"format":"markdown","kind":"template"}
Session → Sign-in frequency → Every time. Remove other session controls IAMAI identified as differences. Leave the intended assignments and conditions unchanged.
@@IAMAI-END
@@IAMAI-BEGIN {"id":"entra.correct.lifecycle","channel":"entra","states":["partial"],"format":"markdown","kind":"template"}
Set Enable policy to Report-only while corrections are being validated.
@@IAMAI-END
@@IAMAI-BEGIN {"id":"entra.correct.save-verify","channel":"entra","states":["partial"],"format":"markdown","kind":"template"}
Save only the selected corrections, read back the same policy ID, then rescan IAMAI. Do not change fields where IAMAI found no difference.

Keep the policy's current state. If it is On, the changed rule can affect access after you save.

@@IAMAI-END
@@IAMAI-BEGIN {"id":"entra.observe","channel":"entra","states":["reportOnly"],"format":"markdown","kind":"template"}
Keep the policy in Report-only while you review the evidence listed for this step. Check that the user-driven enrollment paths you use reach Microsoft Intune Enrollment, and review userless/self-deploying paths separately. Report-only can show policy applicability, but it cannot prove a fresh reauthentication prompt occurred. Rescan when evidence changes.
@@IAMAI-END
@@IAMAI-BEGIN {"id":"entra.enforce","channel":"entra","states":["readyToEnforce"],"format":"markdown","kind":"template"}
Verify the same policy and its prerequisites, set it to On, then complete the checks below and rescan.
1. Open the same policy ID and confirm it still matches the intended settings and is Report-only.
2. Confirm the required user-driven and userless/self-deploying enrollment workflows have been reviewed.
3.

Do not turn it on unless all of these are true now:

- The required report-only period is complete, with no failures on this policy in the sign-in records.
- The policy is still Report-only and its settings still match the intended target, exclusions included — the script for this step refuses to enforce a policy that is not.
- Emergency access is prepared and tested.

If any one of them is not true, leave the policy in Report-only. Change Enable policy to On and save.
4. Verify after the change: complete a controlled user-driven Intune enrollment and confirm it asks for fresh authentication.
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
# This change removes {{policy.current.removedExclusions}} from the policy's exclusions. If the policy is On, it applies to them as soon as the correction is saved. [omit this line when unavailable]
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

STATE
IAMAI did not find the Microsoft Intune Enrollment service principal (application ID `d4ebce55-015a-49b5-a083-c84d1797ae8c`). The Conditional Access policy cannot target it until it exists. Do not substitute the Microsoft Intune admin-center application.

TENANT CONTEXT
- Tenant: {{tenant.displayName}} [omit if unavailable]
- Policy: {{policy.target.displayName}} [omit if unavailable]
- Current policy state: {{policy.current.state}} [omit if unavailable]
- Enrollment evidence: {{evidence.intuneEnrollments}} [omit if unavailable]
- Workflow evidence: {{evidence.enrollmentWorkflows}} [omit if unavailable]
- Blockers: {{dependencies.blockers}} [omit if unavailable]

INTENDED POLICY
All users with the resolved exclusions; Microsoft Intune Enrollment app `d4ebce55-015a-49b5-a083-c84d1797ae8c` only; client apps All; no other conditions; no grant; Sign-in frequency Every time; Report-only before On. This session-only policy does not add MFA or make a device compliant. Do not add MFA or device-compliance grants because Microsoft's separate enrollment-MFA guidance exists.

NEXT STEP
Explain how to confirm or create the service principal, then rescan IAMAI.
@@IAMAI-END
@@IAMAI-BEGIN {"id":"ai.create","channel":"aiInfo","states":["missing"],"format":"markdown","kind":"template"}
This state creates the policy in Report-only.

The target is Microsoft Intune Enrollment only (application ID `d4ebce55-015a-49b5-a083-c84d1797ae8c`), not All resources. Users: All users; the exclusions group keeps emergency access accounts outside the policy.

Grant stays unconfigured. Session → Sign-in frequency is Every time, a session-only control. It does not add MFA or make a device compliant.

MFA must come from other applicable controls. The all-user MFA policy excludes the Intune Enrollment resource, so it does not supply MFA there.
@@IAMAI-END
@@IAMAI-BEGIN {"id":"ai.correct","channel":"aiInfo","states":["partial"],"format":"markdown","kind":"template"}

STATE
This state corrects the existing policy. Correct only the differences IAMAI found, on the same policy ID.

TENANT CONTEXT
- Tenant: {{tenant.displayName}} [omit if unavailable]
- Policy: {{policy.target.displayName}} [omit if unavailable]
- Current policy state: {{policy.current.state}} [omit if unavailable]
- Enrollment evidence: {{evidence.intuneEnrollments}} [omit if unavailable]
- Workflow evidence: {{evidence.enrollmentWorkflows}} [omit if unavailable]
- Blockers: {{dependencies.blockers}} [omit if unavailable]

INTENDED POLICY
All users with the resolved exclusions; Microsoft Intune Enrollment app `d4ebce55-015a-49b5-a083-c84d1797ae8c` only; client apps All; no other conditions; no grant; Sign-in frequency Every time. This session-only policy does not add MFA or make a device compliant. Do not add MFA or device-compliance grants because Microsoft's separate enrollment-MFA guidance exists.

Keep the policy's current state. If it is On, the changed rule can affect access after you save.

This change removes {{policy.current.removedExclusions}} from the policy's exclusions. If the policy is On, it applies to them as soon as you save. [omit this line when unavailable]
@@IAMAI-END
@@IAMAI-BEGIN {"id":"ai.observe","channel":"aiInfo","states":["reportOnly"],"format":"markdown","kind":"template"}

STATE
The policy is in Report-only. Report-only can show whether the policy applies to enrollment sign-ins, but it cannot prove that a fresh reauthentication prompt occurred.

TENANT CONTEXT
- Tenant: {{tenant.displayName}} [omit if unavailable]
- Policy: {{policy.target.displayName}} [omit if unavailable]
- Current policy state: {{policy.current.state}} [omit if unavailable]
- Enrollment evidence: {{evidence.intuneEnrollments}} [omit if unavailable]
- Workflow evidence: {{evidence.enrollmentWorkflows}} [omit if unavailable]
- Blockers: {{dependencies.blockers}} [omit if unavailable]

INTENDED POLICY
All users with the resolved exclusions; Microsoft Intune Enrollment app `d4ebce55-015a-49b5-a083-c84d1797ae8c` only; client apps All; no other conditions; no grant; Sign-in frequency Every time. This session-only policy does not add MFA or make a device compliant.

NEXT STEP
Explain which user-driven and userless/self-deploying enrollment paths still need review, and what evidence is still missing.
@@IAMAI-END
@@IAMAI-BEGIN {"id":"ai.enforce","channel":"aiInfo","states":["readyToEnforce"],"format":"markdown","kind":"template"}

STATE
This state turns the reviewed policy On. The only change is the policy state from Report-only to On.

TENANT CONTEXT
- Tenant: {{tenant.displayName}} [omit if unavailable]
- Policy: {{policy.target.displayName}} [omit if unavailable]
- Current policy state: {{policy.current.state}} [omit if unavailable]
- Enrollment evidence: {{evidence.intuneEnrollments}} [omit if unavailable]
- Workflow evidence: {{evidence.enrollmentWorkflows}} [omit if unavailable]
- Blockers: {{dependencies.blockers}} [omit if unavailable]

INTENDED POLICY
All users with the resolved exclusions; Microsoft Intune Enrollment app `d4ebce55-015a-49b5-a083-c84d1797ae8c` only; client apps All; no other conditions; no grant; Sign-in frequency Every time. This session-only policy does not add MFA or make a device compliant.

NEXT STEP
Explain the change and the tests afterwards: a controlled user-driven enrollment that asks for fresh authentication, and the userless/self-deploying flows that must still complete. If enrollment fails unexpectedly, the same policy returns to Report-only.
@@IAMAI-END
@@IAMAI-BEGIN {"id":"email.users.pre-enforcement","channel":"email","states":["readyToEnforce"],"format":"markdown","kind":"template"}
Subject: Planned change: Require a Fresh Sign-in for Intune Enrollment

Hi,

During user-driven work-device enrollment, you may be asked to authenticate again. Continue through the approved setup process and contact IT if it loops or stops.

Thanks,
IT
@@IAMAI-END
@@IAMAI-BEGIN {"id":"readiness.model","channel":"readiness","states":["resourceMissing","missing","partial","reportOnly","readyToEnforce"],"format":"json-template","kind":"referenceOnly"}
{"tiles":[{"id":"resource","label":"Intune Enrollment resource","gate":"Safe to configure","result":"{{resource.intuneEnrollment.exists}}","line":"Microsoft Intune Enrollment must exist before the CA policy can target it.","evidenceSource":"tenant configuration"},{"id":"exclusions","label":"Exclusions","gate":"Safe to configure","result":"IAMAI-resolved","line":"Use the resolved exclusion set; do not rediscover or broaden it during implementation.","evidenceSource":"IAMAI canonical tenant truth"},{"id":"workflows","label":"Enrollment workflows","gate":"Safe to enforce","result":"{{evidence.enrollmentWorkflows}}","line":"Review user-driven and userless enrollment separately. A session setting does not prove that a prompt occurred.","evidenceSource":"tenant evidence / human validation"}]}
@@IAMAI-END
@@IAMAI-BEGIN {"id":"troubleshooting.model","channel":"troubleshooting","states":["resourceMissing","missing","partial","reportOnly","readyToEnforce","inPlace"],"format":"json","kind":"referenceOnly"}
{"scenarios":[{"id":"resource-not-found","states":["resourceMissing","missing"],"classification":"documented","symptom":"Microsoft Intune Enrollment cannot be selected or Graph cannot target it.","check":"Confirm a service principal exists for appId d4ebce55-015a-49b5-a083-c84d1797ae8c.","fix":"Create the Microsoft Intune Enrollment service principal through the supported Entra/Graph application-admin path, then rescan IAMAI.","doNot":"Do not substitute the Microsoft Intune admin-center application.","then":"Retry only after IAMAI resolves the resource.","sources":["ms-intune-enrollment-mfa","ms-sp-create-v1"]},{"id":"enrollment-loop","states":["readyToEnforce","inPlace"],"classification":"documented","symptom":"Enrollment repeatedly asks for authentication or cannot complete.","check":"Review overlapping CA policies, especially additional MFA/device grants and Every-time sign-in frequency.","fix":"Return this policy to Report-only while the overlap is resolved.","doNot":"Do not weaken unrelated security controls without identifying the conflicting policy.","then":"Retest the same enrollment path.","sources":["ms-session-lifetime"]},{"id":"wrong-intune-app","states":["partial"],"classification":"documented","symptom":"The policy affects Intune admin-center access instead of enrollment.","check":"Verify Target resources is Microsoft Intune Enrollment, not Microsoft Intune.","fix":"Correct the target application only.","then":"Read back and rescan.","sources":["ms-intune-ca-scenarios"]},{"id":"device-grant-added","states":["partial"],"classification":"documented","symptom":"Enrollment is blocked by a compliant-device/device-based requirement.","check":"Inspect Grant controls and other overlapping policies for device-based access rules on Microsoft Intune Enrollment.","fix":"Remove the noncanonical grant from this retained step and resolve any separate overlapping policy deliberately.","doNot":"Do not require a device to already be compliant in order to enroll it through this step.","then":"Return to Report-only and retest.","sources":["ms-intune-enrollment-mfa"]},{"id":"selfdeploy-no-prompt","states":["reportOnly","readyToEnforce","inPlace"],"classification":"documented","symptom":"A self-deploying Autopilot flow does not show the fresh user sign-in prompt.","check":"Confirm the deployment mode is self-deploying/userless.","fix":"Treat that as a different workflow; validate that it still completes rather than expecting user-driven prompt evidence.","then":"Use a user-driven enrollment to prove the fresh prompt.","sources":["ms-autopilot-selfdeploy"]},{"id":"graph-403","states":["resourceMissing","missing","partial","readyToEnforce"],"classification":"documented","symptom":"Graph/PowerShell returns 403.","check":"For CA writes verify Policy.Read.All + Policy.ReadWrite.ConditionalAccess and an allowed CA role. For service-principal creation verify Application.ReadWrite.All and an allowed application-admin role.","fix":"Reconnect with the least required scope/role for the selected operation.","then":"Retry the same bounded operation.","sources":["ms-ca-create-v1","ms-sp-create-v1"]}]}
@@IAMAI-END

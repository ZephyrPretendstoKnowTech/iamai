@@IAMAI-BEGIN {"id":"entra.prerequisites","channel":"entra","states":["prerequisiteRequired"],"format":"markdown","kind":"template"}
Before enforcement, resolve only the prerequisite that IAMAI says is unmet:
- MFA registration: make sure each in-scope user has a registered method that can satisfy {{authStrength.target.displayName}}.
- Hybrid password users: confirm password writeback is enabled and working before relying on secure password change.
- Guest/external users: Require risk remediation is not supported. Use the existing approved IAMAI scope/exclusion decision; do not invent a new exclusion here.
- Active risk: investigate/remediate current risky users before turning on a new broad policy.
SSPR may remain available for recovery, but do not treat SSPR enablement as the CA remediation prerequisite by itself.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"entra.create","channel":"entra","states":["missing"],"format":"markdown","kind":"template"}
In Microsoft Entra admin center, go to **Entra ID > Conditional Access > Policies > New policy**.
1. Name: {{policy.target.displayName}}.
2. Users: Include **All users**. Add only the IAMAI-resolved exclusions.
3. Target resources: **All resources**; do not exclude applications.
4. Conditions > User risk: **High** only.
5. Grant: **Grant access > Require risk remediation**. When Entra adds authentication strength, select **{{authStrength.target.displayName}}**. Keep the relationship as AND.
6. Session: confirm **Sign-in frequency = Every time**.
7. Enable policy: **Report-only**.
8. Create, then rescan IAMAI. Do not turn it On in this create action.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"entra.correct.open","channel":"entra","states":["partial"],"format":"markdown","kind":"template"}
Open the exact existing policy identified by IAMAI stable ID {{policy.current.id}}. Do not locate an update target by display name alone.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"entra.correct.users","channel":"entra","states":["partial"],"format":"markdown","kind":"template"}
Users: Include **All users** and restore only the IAMAI-resolved canonical exclusions. Preserve no additional user/group exclusion unless IAMAI classifies it as canonical.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"entra.correct.target","channel":"entra","states":["partial"],"format":"markdown","kind":"template"}
Target resources: set **All resources** and remove application exclusions. Risk remediation should not be scoped to a subset of apps.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"entra.correct.risk","channel":"entra","states":["partial"],"format":"markdown","kind":"template"}
Conditions > User risk: set **High** only. Do not add Sign-in risk to this policy.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"entra.correct.conditions","channel":"entra","states":["partial"],"format":"markdown","kind":"template"}
Remove noncanonical effective location, platform, device/filter, authentication-flow, workload-risk, or sign-in-risk conditions. Keep the retained user-risk policy limited to its user, application, and High user-risk scope.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"entra.correct.grant","channel":"entra","states":["partial"],"format":"markdown","kind":"template"}
Grant: select **Require risk remediation** with authentication strength **{{authStrength.target.displayName}}**. Do not combine `riskRemediation` with `passwordChange` or a separate MFA grant. Keep operator AND.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"entra.correct.session","channel":"entra","states":["partial"],"format":"markdown","kind":"template"}
Session: set **Sign-in frequency = Every time**. This is mandatory with current Require risk remediation behavior and is part of the retained member.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"entra.correct.lifecycle","channel":"entra","states":["partial"],"format":"markdown","kind":"template"}
Set **Enable policy = Report-only** while correcting the policy unless IAMAI is explicitly projecting the later Enforce action.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"entra.correct.save-verify","channel":"entra","states":["partial"],"format":"markdown","kind":"template"}
Save the bounded correction, read the policy back by stable ID, and rescan IAMAI. Do not combine unrelated mismatch fixes.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"entra.observe","channel":"entra","states":["reportOnly"],"format":"markdown","kind":"template"}
Leave the policy in **Report-only**. Verify the exact canonical shape by stable ID, investigate any currently risky users, and confirm MFA registration plus hybrid password-writeback readiness for the actual in-scope population. Confirm guest/external users are not depending on Require risk remediation. Report-only evidence informs impact; it does not prove a future remediation path will succeed.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"entra.enforce","channel":"entra","states":["readyToEnforce"],"format":"markdown","kind":"template"}
Immediately before enforcement, re-read the exact policy by stable ID and confirm: canonical High user-risk scope, All resources, IAMAI-resolved exclusions, Require risk remediation + {{authStrength.target.displayName}}, Every-time sign-in frequency, MFA registration readiness, hybrid writeback where applicable, guest/external handling, and no unresolved active-risk blocker. Then change only **Enable policy** from **Report-only** to **On**. Read back the state and monitor remediation/sign-in failures. If legitimate remediation fails, return the same policy to Report-only.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"json.create","channel":"json","states":["missing"],"format":"json-template","kind":"deployableAfterBinding","method":"POST","endpoint":"https://graph.microsoft.com/v1.0/identity/conditionalAccess/policies"}
{"displayName":{{json:policy.target.displayName}},"state":"enabledForReportingButNotEnforced","conditions":{"users":{"includeUsers":["All"],"excludeGroups":{{json:policy.target.excludeGroups}}},"applications":{"includeApplications":["All"],"excludeApplications":[]},"clientAppTypes":["all"],"userRiskLevels":["high"]},"grantControls":{"operator":"AND","builtInControls":["riskRemediation"],"authenticationStrength":{"id":{{json:authStrength.target.id}}},"customAuthenticationFactors":[],"termsOfUse":[]},"sessionControls":{"signInFrequency":{"isEnabled":true,"frequencyInterval":"everyTime","authenticationType":"primaryAndSecondaryAuthentication"}}}
@@IAMAI-END

@@IAMAI-BEGIN {"id":"json.correct.conditions","channel":"json","states":["partial"],"format":"json-template","kind":"deployableAfterBinding","method":"PATCH","endpoint":"https://graph.microsoft.com/v1.0/identity/conditionalAccess/policies/{policy.current.id}"}
{"conditions":{"users":{"includeUsers":["All"],"excludeUsers":[],"includeGroups":[],"excludeGroups":{{json:policy.target.excludeGroups}},"includeRoles":[],"excludeRoles":[]},"applications":{"includeApplications":["All"],"excludeApplications":[],"includeUserActions":[],"includeAuthenticationContextClassReferences":[]},"clientAppTypes":["all"],"userRiskLevels":["high"],"signInRiskLevels":[],"servicePrincipalRiskLevels":[],"locations":null,"platforms":null,"devices":null,"authenticationFlows":null,"insiderRiskLevels":null}}
@@IAMAI-END

@@IAMAI-BEGIN {"id":"json.correct.grant","channel":"json","states":["partial"],"format":"json-template","kind":"deployableAfterBinding","method":"PATCH","endpoint":"https://graph.microsoft.com/v1.0/identity/conditionalAccess/policies/{policy.current.id}"}
{"grantControls":{"operator":"AND","builtInControls":["riskRemediation"],"authenticationStrength":{"id":{{json:authStrength.target.id}}},"customAuthenticationFactors":[],"termsOfUse":[]}}
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

@@IAMAI-BEGIN {"id":"powershell.run","channel":"powershell","states":["missing","partial","reportOnly","readyToEnforce"],"format":"powershell","kind":"deployableAfterBinding","invocation":{"modeParameter":"Mode","parameters":{"PolicyDisplayName":{"binding":"policy.target.displayName","modes":["Create"]},"PolicyId":{"binding":"policy.current.id","modes":["CorrectConditions","CorrectGrant","CorrectSession","ReportOnly","Verify"]},"ExcludeGroupIds":{"binding":"policy.target.excludeGroups","modes":["Create","CorrectConditions","CorrectGrant","Verify"]},"AuthenticationStrengthId":{"binding":"authStrength.target.id","modes":["Create","CorrectConditions","CorrectGrant","Verify"]}},"withheldModes":{"Enforce":"the script enforces only with -ReadinessApproved and -MfaRegistrationValidated and -GuestExternalScopeValidated, an attestation this package declares no prerequisite for, so IAMAI cannot pass it, and -HybridUsersInScope is a tenant fact IAMAI does not bind"}}}
# IAMAI compact implementation script — Remediate High-Risk Users
[CmdletBinding()]
param(
 [Parameter(Mandatory)][ValidateSet('Create','CorrectConditions','CorrectGrant','CorrectSession','ReportOnly','Verify','Enforce')][string]$Mode,
 [string]$PolicyDisplayName,
 [ValidatePattern('^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$')][string]$PolicyId,
 [string[]]$ExcludeGroupIds=@(),
 [ValidatePattern('^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$')][string]$AuthenticationStrengthId,
 [switch]$ReadinessApproved,
 [switch]$MfaRegistrationValidated,
 [switch]$GuestExternalScopeValidated,
 [switch]$HybridUsersInScope,
 [switch]$HybridPasswordWritebackValidated
)
Set-StrictMode -Version Latest
$ErrorActionPreference='Stop'
$Base='https://graph.microsoft.com/v1.0/identity/conditionalAccess/policies'
$Guid='^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
function Connect-CA([bool]$Write){Import-Module Microsoft.Graph.Authentication -ErrorAction Stop;$s=@('Policy.Read.All');if($Write){$s+='Policy.ReadWrite.ConditionalAccess'};$c=Get-MgContext;$m=if($c){@($s|Where-Object{$_ -notin @($c.Scopes)})}else{$s};if((-not $c)-or$m.Count){Connect-MgGraph -Scopes $s -NoWelcome}}
function Assert-Inputs{if(@($ExcludeGroupIds|Where-Object{$_ -notmatch $Guid}).Count){throw 'Invalid exclusion ID.'};if($AuthenticationStrengthId -notmatch $Guid){throw 'IAMAI-resolved authentication-strength ID is required.'}}
function Get-Policy{if($PolicyId -notmatch $Guid){throw 'Stable IAMAI policy ID required.'};$p=Invoke-MgGraphRequest -Method GET -Uri "$Base/$PolicyId";if($p.id-ne$PolicyId){throw 'Stable-ID readback failed.'};$p}
function Same-Set([string[]]$A,[string[]]$B){(@($A|Sort-Object)-join '|') -eq (@($B|Sort-Object)-join '|')}
function Conditions{Assert-Inputs;@{users=@{includeUsers=@('All');excludeUsers=@();includeGroups=@();excludeGroups=@($ExcludeGroupIds);includeRoles=@();excludeRoles=@()};applications=@{includeApplications=@('All');excludeApplications=@();includeUserActions=@();includeAuthenticationContextClassReferences=@()};clientAppTypes=@('all');userRiskLevels=@('high');signInRiskLevels=@();servicePrincipalRiskLevels=@();locations=$null;platforms=$null;devices=$null;authenticationFlows=$null;insiderRiskLevels=$null}}
function Grant{Assert-Inputs;@{operator='AND';builtInControls=@('riskRemediation');customAuthenticationFactors=@();termsOfUse=@();authenticationStrength=@{id=$AuthenticationStrengthId}}}
function Session{@{signInFrequency=@{isEnabled=$true;frequencyInterval='everyTime';authenticationType='primaryAndSecondaryAuthentication'};persistentBrowser=$null;applicationEnforcedRestrictions=$null;cloudAppSecurity=$null;disableResilienceDefaults=$null}}
function Patch([hashtable]$Body){[void](Get-Policy);Invoke-MgGraphRequest -Method PATCH -Uri "$Base/$PolicyId" -Body($Body|ConvertTo-Json -Depth 20)-ContentType 'application/json'|Out-Null}
function Assert-Canonical($p){Assert-Inputs;if(@($p.conditions.users.includeUsers).Count-ne1-or$p.conditions.users.includeUsers[0]-ne'All'){throw 'includeUsers mismatch'};if(-not(Same-Set @($p.conditions.users.excludeGroups) @($ExcludeGroupIds))){throw 'excludeGroups mismatch'};if(@($p.conditions.applications.includeApplications).Count-ne1-or$p.conditions.applications.includeApplications[0]-ne'All'-or@($p.conditions.applications.excludeApplications).Count){throw 'All-resources target mismatch'};if(@($p.conditions.userRiskLevels).Count-ne1-or$p.conditions.userRiskLevels[0]-ne'high'){throw 'User risk must be High only'};$g=$p.grantControls;if($g.operator-ne'AND'-or@($g.builtInControls).Count-ne1-or$g.builtInControls[0]-ne'riskRemediation'-or$g.authenticationStrength.id-ne$AuthenticationStrengthId){throw 'Risk-remediation grant mismatch'};$s=$p.sessionControls.signInFrequency;if(-not$s.isEnabled-or$s.frequencyInterval-ne'everyTime'-or$s.authenticationType-ne'primaryAndSecondaryAuthentication'){throw 'Every-time session mismatch'}}
switch($Mode){
 'Create'{Connect-CA $true;Assert-Inputs;if([string]::IsNullOrWhiteSpace($PolicyDisplayName)){throw 'PolicyDisplayName required.'};$e=$PolicyDisplayName.Replace("'","''");$f=[uri]::EscapeDataString("displayName eq '$e'");if(@((Invoke-MgGraphRequest -Method GET -Uri "${Base}?`$filter=$f").value).Count){throw 'Exact display-name collision. Rescan IAMAI; do not create a duplicate.'};$b=@{displayName=$PolicyDisplayName;state='enabledForReportingButNotEnforced';conditions=(Conditions);grantControls=(Grant);sessionControls=(Session)};$r=Invoke-MgGraphRequest -Method POST -Uri $Base -Body($b|ConvertTo-Json -Depth 20)-ContentType 'application/json';Write-Host "Created $($r.id) in Report-only. Rescan IAMAI."}
 'CorrectConditions'{Connect-CA $true;Patch @{conditions=(Conditions)}}
 'CorrectGrant'{Connect-CA $true;Patch @{grantControls=(Grant)}}
 'CorrectSession'{Connect-CA $true;Patch @{sessionControls=(Session)}}
 'ReportOnly'{Connect-CA $true;Patch @{state='enabledForReportingButNotEnforced'}}
 'Verify'{Connect-CA $false;$p=Get-Policy;Assert-Canonical $p;Write-Host "Canonical high-user-risk shape verified; lifecycle=$($p.state)."}
 'Enforce'{if(-not$ReadinessApproved){throw 'Enforce requires ReadinessApproved.'};if(-not$MfaRegistrationValidated){throw 'Confirm MFA registration for the in-scope population before enforcement.'};if(-not$GuestExternalScopeValidated){throw 'Confirm guest/external handling before enforcement.'};if($HybridUsersInScope-and(-not$HybridPasswordWritebackValidated)){throw 'Hybrid users are in scope; password writeback must be validated before enforcement.'};Connect-CA $true;$p=Get-Policy;Assert-Canonical $p;if($p.state-ne'enabledForReportingButNotEnforced'){throw 'Policy must be canonical and Report-only immediately before enforcement.'};Patch @{state='enabled'};$a=Get-Policy;Assert-Canonical $a;if($a.state-ne'enabled'){throw 'Enablement readback failed.'};Write-Host 'High-user-risk remediation policy enabled. Review risk-remediation failures and rescan IAMAI.'}
}
@@IAMAI-END

@@IAMAI-BEGIN {"id":"ai.prerequisites","channel":"aiInfo","states":["prerequisiteRequired"],"format":"markdown","kind":"template"}
**Contains tenant context. Review before sharing with an external AI service.**

Review only the unmet prerequisites for IAMAI step Remediate High-Risk Users in {{tenant.displayName}}. Do not reinterpret raw tenant data. Confirm from the supplied IAMAI facts whether MFA registration, hybrid password writeback, guest/external scope, or active-risk investigation blocks enforcement. Do not require SSPR solely because password change can occur during risk remediation. Return: blocker, evidence, safe next action, Microsoft-source rationale.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"ai.create","channel":"aiInfo","states":["missing"],"format":"markdown","kind":"template"}
**Contains tenant context. Review before sharing with an external AI service.**

Review IAMAI's proposed creation of the High user-risk Conditional Access policy for {{tenant.displayName}}. The target is All resources, High user risk only, Require risk remediation + {{authStrength.target.displayName}}, Every-time sign-in frequency, IAMAI-resolved exclusions, and Report-only lifecycle. Check for contradictions only; do not redesign the policy or invent tenant facts.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"ai.correct","channel":"aiInfo","states":["partial"],"format":"markdown","kind":"template"}
**Contains tenant context. Review before sharing with an external AI service.**

Review only these IAMAI-classified mismatches for the existing High user-risk policy: {{policy.current.semanticMismatches}}. Compare them to the canonical step. Preserve stable policy identity and unrelated settings outside the selected correction boundary. Do not replace riskRemediation with passwordChange/MFA or invent exclusions.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"ai.observe","channel":"aiInfo","states":["reportOnly"],"format":"markdown","kind":"template"}
**Contains tenant context. Review before sharing with an external AI service.**

Assess whether the Report-only High user-risk policy is ready for enforcement using only IAMAI-provided evidence: at-risk users {{evidence.atRiskUsers}}, MFA registration {{evidence.mfaRegistration}}, hybrid writeback {{evidence.hybridWriteback}}, guest/external scope {{evidence.guestExternalScope}}, and risk investigation {{evidence.riskInvestigation}}. Unknown must remain Unknown.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"ai.enforce","channel":"aiInfo","states":["readyToEnforce"],"format":"markdown","kind":"template"}
**Contains tenant context. Review before sharing with an external AI service.**

Perform a final pre-enforcement review of IAMAI step Remediate High-Risk Users. Confirm the exact stable policy is canonical and Report-only, prerequisites are explicitly satisfied, and the only requested mutation is lifecycle to On. If any prerequisite is Unknown or Blocked, say do not enforce.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"email.users.pre-enforcement","channel":"email","states":["readyToEnforce"],"format":"markdown","kind":"template"}
Subject: Extra verification may appear if Microsoft detects account risk

Microsoft Entra will begin automatically responding when an account is rated high risk. Most people will see no change. If Microsoft detects a serious risk on your account, you may be asked to verify your identity again and, for password-based accounts, securely change your password. If you cannot complete the prompt, contact the help desk rather than retrying repeatedly.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"readiness.model","channel":"readiness","states":["prerequisiteRequired","missing","partial","reportOnly","readyToEnforce"],"format":"json-template","kind":"referenceOnly"}
{"tiles":[{"id":"license","label":"Risk licensing","gate":"Safe to configure","result":"IAMAI tenant truth","line":"High user-risk Conditional Access requires P2/qualifying ID Protection capability.","evidenceSource":"tenant licensing"},{"id":"mfa","label":"MFA registration","gate":"Safe to enforce","result":"{{evidence.mfaRegistration}}","line":"In-scope users must already have MFA registered before relying on self-remediation.","evidenceSource":"IAMAI authentication evidence"},{"id":"hybrid","label":"Hybrid writeback","gate":"Safe to enforce","result":"{{evidence.hybridWriteback}}","line":"Required when synchronized password users in scope must complete secure password change.","evidenceSource":"IAMAI hybrid/writeback evidence"},{"id":"guests","label":"Guest / external scope","gate":"Safe to enforce","result":"{{evidence.guestExternalScope}}","line":"Require risk remediation is not supported for guest/external users; scope must be deliberate.","evidenceSource":"IAMAI population evidence"},{"id":"active-risk","label":"Active risk reviewed","gate":"Safe to enforce","result":"{{evidence.riskInvestigation}}","line":"Current risky users should be investigated/remediated before broad enablement.","evidenceSource":"ID Protection / IAMAI evidence"}],"whyIamaiSaysThis":"IAMAI can verify the policy shape and known prerequisites. It cannot promise that a future risk event will use a particular remediation branch. SSPR is a separate recovery mechanism and is not treated as a universal gate for Require risk remediation."}
@@IAMAI-END

@@IAMAI-BEGIN {"id":"troubleshooting.model","channel":"troubleshooting","states":["prerequisiteRequired","missing","partial","reportOnly","readyToEnforce","inPlace"],"format":"json","kind":"referenceOnly"}
{"scenarios":[{"id":"mfa-not-registered","states":["prerequisiteRequired","readyToEnforce","inPlace"],"classification":"documented","symptom":"A high-risk user is blocked instead of completing self-remediation.","check":"Confirm the user registered an MFA method before the risk event.","fix":"Restore/register an approved MFA method using the organization's recovery process before relying on self-remediation.","then":"Retest only after registration readiness changes.","sources":["ms-risk-policy"]},{"id":"hybrid-password-change-fails","states":["prerequisiteRequired","readyToEnforce","inPlace"],"classification":"documented","symptom":"A synchronized user reaches secure password change but the password cannot be written back on-premises.","check":"Verify the user is hybrid and password writeback is enabled/healthy.","fix":"Correct password writeback before re-enabling enforcement for that affected path.","then":"Validate writeback and the risk-remediation flow.","sources":["ms-risk-policy","ms-writeback"]},{"id":"sspr-confusion","states":["prerequisiteRequired","reportOnly","readyToEnforce"],"classification":"documented","symptom":"Deployment is blocked only because SSPR is not enabled.","check":"Determine whether the blocker is actually MFA registration or hybrid password writeback.","fix":"Do not treat SSPR as the Conditional Access risk-remediation password-change mechanism; keep SSPR as recovery if desired.","then":"Re-evaluate the actual prerequisites.","sources":["ms-risk-remediation"]},{"id":"guest-external","states":["prerequisiteRequired","readyToEnforce","inPlace"],"classification":"documented","symptom":"A guest or external user is expected to self-remediate through Require risk remediation.","check":"Confirm whether guest/external identities are in the effective policy population.","fix":"Use the existing approved IAMAI scope/exclusion decision; do not invent an exclusion in this package.","then":"Enforce only when the unsupported population is handled deliberately.","sources":["ms-risk-concept"]},{"id":"graph-400-grant","states":["missing","partial"],"classification":"documented","symptom":"Graph rejects the risk-remediation grant/body.","check":"Confirm riskRemediation is paired with authenticationStrength using AND, not passwordChange or a separate MFA grant; keep the policy centered on users, applications, and userRiskLevels.","fix":"Send the canonical bounded body.","then":"Read back the stable policy and rescan IAMAI.","sources":["ms-ca-grant-v1"]},{"id":"strength-not-satisfied","states":["reportOnly","readyToEnforce","inPlace"],"classification":"documented","symptom":"A legitimate user cannot satisfy the selected authentication strength during remediation.","check":"Compare registered methods with the exact allowed combinations of the IAMAI-resolved strength.","fix":"Use the approved method-registration/recovery path or return the policy to Report-only while readiness is corrected.","then":"Retest after method readiness changes.","sources":["ms-user-risk-policy"]},{"id":"legacy-risk-policy","states":["missing","partial"],"classification":"documented","symptom":"Implementation is being attempted in the legacy ID Protection user-risk policy.","check":"Confirm the control is a Conditional Access policy.","fix":"Use Conditional Access; legacy risk policies retire October 1, 2026.","then":"Validate the CA policy in Report-only.","sources":["ms-risk-policy"]},{"id":"graph-403","states":["missing","partial","readyToEnforce"],"classification":"documented","symptom":"Graph/PowerShell returns 403.","check":"Verify Policy.Read.All + Policy.ReadWrite.ConditionalAccess and a supported Conditional Access/Security Administrator role.","fix":"Reconnect with the least required permission/role.","then":"Retry the same bounded operation.","sources":["ms-ca-create-v1"]}]}
@@IAMAI-END

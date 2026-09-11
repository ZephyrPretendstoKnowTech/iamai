@@IAMAI-BEGIN {"id":"entra.create","channel":"entra","states":["missing"],"format":"markdown","kind":"template"}
1. Open **Entra ID > Conditional Access > Policies > New policy**.
2. Name it **{{policy.target.displayName}}**.
3. Users: include only the owner-confirmed shared-device accounts represented by IAMAI's stable IDs.
4. Preserve the canonical emergency-access exclusion group: {{policy.target.excludeGroups}}.
5. Target resources: **All resources**.
6. Locations: Include **Any location**; Exclude the canonical trusted-network location with stable ID `{{policy.target.trustedLocationId}}`.
7. Grant: **Block access**.
8. Enable policy: **Report-only**. Create it, then rescan before any enforcement.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"entra.correct.open","channel":"entra","states":["partial"],"format":"markdown","kind":"template"}
Open the exact resolved shared-device policy by its stable identity. Correct only the mismatch(es) IAMAI identified.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"entra.correct.population","channel":"entra","states":["partial"],"format":"markdown","kind":"template"}
Set the included population to the owner-confirmed shared-device accounts only. Preserve the canonical emergency-access exclusion.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"entra.correct.apps","channel":"entra","states":["partial"],"format":"markdown","kind":"template"}
Set Target resources to **All resources**. Leave the remaining canonical conditions unchanged.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"entra.correct.location","channel":"entra","states":["partial"],"format":"markdown","kind":"template"}
Set Locations to Include **Any location** and Exclude the trusted-network location with ID `{{policy.target.trustedLocationId}}`.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"entra.correct.grant","channel":"entra","states":["partial"],"format":"markdown","kind":"template"}
Set Grant to **Block access** only. Do not add an interactive MFA grant.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"entra.correct.lifecycle","channel":"entra","states":["partial"],"format":"markdown","kind":"template"}
Return the dedicated policy to **Report-only** while material corrections are being validated.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"entra.people-exclusions","channel":"entra","states":["missing","partial"],"format":"markdown","kind":"template"}
For each person-interactive policy IAMAI identifies, open that exact policy by stable ID and apply only IAMAI's complete resolved Users/conditions patch so these confirmed shared-device accounts are excluded without losing other exclusions.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"entra.verify","channel":"entra","states":["partial"],"format":"markdown","kind":"template"}
Save, re-open the same stable object(s), verify the intended scope, then rescan IAMAI.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"entra.observe","channel":"entra","states":["reportOnly"],"format":"markdown","kind":"template"}
Review sign-in and Report-only results for each shared-device account from its normal device/network. Confirm person-interactive policies no longer interrupt the resource account. Keep this policy Report-only until normal operating behavior is represented.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"entra.enforce","channel":"entra","states":["readyToEnforce"],"format":"markdown","kind":"template"}
Open the exact dedicated policy by stable ID, re-confirm the trusted-network location still represents the device egress, change **Enable policy** from Report-only to **On**, save, test a real shared device, and rescan IAMAI.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"json.create","channel":"json","states":["missing"],"format":"json-template","kind":"template"}
{"displayName":"{{policy.target.displayName}}","state":"enabledForReportingButNotEnforced","conditions":{"users":{"includeUsers":{{json:policy.target.includeUsers}},"excludeGroups":{{json:policy.target.excludeGroups}}},"applications":{"includeApplications":["All"]},"clientAppTypes":["all"],"locations":{"includeLocations":["All"],"excludeLocations":["{{policy.target.trustedLocationId}}"]}},"grantControls":{"operator":"OR","builtInControls":["block"]},"sessionControls":null}
@@IAMAI-END

@@IAMAI-BEGIN {"id":"json.correct.conditions","channel":"json","states":["partial"],"format":"json-template","kind":"template"}
{"conditions":{"users":{"includeUsers":{{json:policy.target.includeUsers}},"excludeGroups":{{json:policy.target.excludeGroups}}},"applications":{"includeApplications":["All"]},"clientAppTypes":["all"],"locations":{"includeLocations":["All"],"excludeLocations":["{{policy.target.trustedLocationId}}"]}}}
@@IAMAI-END

@@IAMAI-BEGIN {"id":"json.correct.grant","channel":"json","states":["partial"],"format":"json","kind":"template"}
{"grantControls":{"operator":"OR","builtInControls":["block"]},"sessionControls":null}
@@IAMAI-END

@@IAMAI-BEGIN {"id":"json.report-only","channel":"json","states":["partial"],"format":"json","kind":"template"}
{"state":"enabledForReportingButNotEnforced"}
@@IAMAI-END

@@IAMAI-BEGIN {"id":"json.enforce","channel":"json","states":["readyToEnforce"],"format":"json","kind":"template"}
{"state":"enabled"}
@@IAMAI-END

@@IAMAI-BEGIN {"id":"json.people-patches","channel":"json","states":["missing","partial"],"format":"json-template","kind":"referenceOnly"}
{"kind":"iamaiResolvedConditionalAccessPatchSet","policies":{{json:peoplePolicies.resolvedPatches}},"rule":"Each item must carry the stable policy id and a complete IAMAI-resolved desired conditions object; do not reconstruct exclusions from display names."}
@@IAMAI-END

@@IAMAI-BEGIN {"id":"powershell.run","channel":"powershell","states":["missing","partial","reportOnly","readyToEnforce"],"format":"powershell","kind":"template"}
param(
 [Parameter(Mandatory=$true)][ValidateSet('Create','CorrectConditions','CorrectGrant','ReportOnly','PeopleExclusions','Verify','Enforce')][string]$Mode,
 [string]$PolicyId,
 [string]$DisplayName,
 [string[]]$IncludeUsers=@(),
 [string[]]$ExcludeGroups=@(),
 [string]$TrustedLocationId,
 [string]$PeoplePolicyPatchesJson='[]',
 [switch]$TrustedLocationReconfirmed,
 [switch]$ReportOnlyEvidenceReviewed
)
$ErrorActionPreference='Stop'; $G='https://graph.microsoft.com/v1.0'
function GuidOk([string]$v,[string]$n){$g=[guid]::Empty;if(-not [guid]::TryParse($v,[ref]$g)){throw "$n must be a GUID."}}
function IG($m,$u,$b=$null){if($null -eq $b){return Invoke-MgGraphRequest -Method $m -Uri $u -OutputType PSObject};Invoke-MgGraphRequest -Method $m -Uri $u -Body ($b|ConvertTo-Json -Depth 40) -ContentType 'application/json' -OutputType PSObject}
function Conditions(){@{users=@{includeUsers=@($IncludeUsers);excludeGroups=@($ExcludeGroups)};applications=@{includeApplications=@('All')};clientAppTypes=@('all');locations=@{includeLocations=@('All');excludeLocations=@($TrustedLocationId)}}}
if($Mode -ne 'PeopleExclusions'){
 if($Mode -ne 'Create'){GuidOk $PolicyId 'PolicyId'}
 if($Mode -in @('Create','CorrectConditions')){if($IncludeUsers.Count -eq 0){throw 'Owner-confirmed shared-device IDs are required.'};foreach($x in $IncludeUsers){GuidOk $x 'IncludeUser'};GuidOk $TrustedLocationId 'TrustedLocationId'}
}
switch($Mode){
 'Create'{if([string]::IsNullOrWhiteSpace($DisplayName)){throw 'DisplayName required.'};$f=[uri]::EscapeDataString("displayName eq '$($DisplayName.Replace("'","''"))'");$x=IG GET "$G/identity/conditionalAccess/policies?`$filter=$f";if(@($x.value).Count){throw 'Display name collision: resolve stable identity; do not duplicate.'};$b=@{displayName=$DisplayName;state='enabledForReportingButNotEnforced';conditions=(Conditions);grantControls=@{operator='OR';builtInControls=@('block')};sessionControls=$null};$c=IG POST "$G/identity/conditionalAccess/policies" $b;[pscustomobject]@{PolicyId=$c.id;Next='Rescan IAMAI'}}
 'CorrectConditions'{IG PATCH "$G/identity/conditionalAccess/policies/$PolicyId" @{conditions=(Conditions)}|Out-Null}
 'CorrectGrant'{IG PATCH "$G/identity/conditionalAccess/policies/$PolicyId" @{grantControls=@{operator='OR';builtInControls=@('block')};sessionControls=$null}|Out-Null}
 'ReportOnly'{IG PATCH "$G/identity/conditionalAccess/policies/$PolicyId" @{state='enabledForReportingButNotEnforced'}|Out-Null}
 'PeopleExclusions'{foreach($p in @($PeoplePolicyPatchesJson|ConvertFrom-Json)){GuidOk $p.id 'People policy id';if($null -eq $p.conditions){throw 'Every people-policy patch must carry complete resolved conditions.'};IG PATCH "$G/identity/conditionalAccess/policies/$($p.id)" @{conditions=$p.conditions}|Out-Null}}
 'Verify'{IG GET "$G/identity/conditionalAccess/policies/$PolicyId"}
 'Enforce'{if(-not $TrustedLocationReconfirmed -or -not $ReportOnlyEvidenceReviewed){throw 'Reconfirm location and review report-only evidence before enforcement.'};IG PATCH "$G/identity/conditionalAccess/policies/$PolicyId" @{state='enabled'}|Out-Null;IG GET "$G/identity/conditionalAccess/policies/$PolicyId"}
}
@@IAMAI-END

@@IAMAI-BEGIN {"id":"ai.decision","channel":"aiInfo","states":["needsDecision"],"format":"markdown","kind":"template"}
**Contains tenant context. Review before sharing with an external AI service.**

Review the proposed shared-device accounts for {{tenant.displayName}}: {{shared.confirmedAccounts}}. Distinguish actual resource accounts from people and require owner confirmation before any exclusions.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"ai.create","channel":"aiInfo","states":["missing"],"format":"markdown","kind":"template"}
**Contains tenant context. Review before sharing with an external AI service.**

Review the dedicated shared-device policy for {{tenant.displayName}}. Confirm it is scoped only to confirmed resource accounts and the canonical trusted-network ID, starts Report-only, and does not add user-interactive MFA.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"ai.correct","channel":"aiInfo","states":["partial"],"format":"markdown","kind":"template"}
**Contains tenant context. Review before sharing with an external AI service.**

Review only these detected semantic mismatches: {{policy.current.semanticMismatches}}. Preserve stable IDs and existing canonical exclusions.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"ai.observe","channel":"aiInfo","states":["reportOnly"],"format":"markdown","kind":"template"}
**Contains tenant context. Review before sharing with an external AI service.**

Review shared-device sign-in evidence {{shared.deviceEvidence}} and identify any user-interactive policy still interrupting the device. Do not recommend broader exclusions.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"ai.enforce","channel":"aiInfo","states":["readyToEnforce"],"format":"markdown","kind":"template"}
**Contains tenant context. Review before sharing with an external AI service.**

Assess whether report-only evidence supports enabling the exact shared-device policy. Require re-confirmation of the trusted-network egress before On.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"ai.blocked","channel":"aiInfo","states":["blocked"],"format":"markdown","kind":"template"}
**Contains tenant context. Review before sharing with an external AI service.**

Explain the blocker without inventing implementation: {{dependencies.blockers}}.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"email.confirm","channel":"email","states":["needsDecision"],"format":"markdown","kind":"template"}
Subject: Confirm shared-device accounts before Conditional Access changes

Please confirm which listed accounts are assigned to Teams Rooms, panels, shared phones, or other userless devices. IAMAI will not exempt an account from person policies from its name alone.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"email.change","channel":"email","states":["readyToEnforce"],"format":"markdown","kind":"template"}
Subject: Shared-device Conditional Access change

We are enabling the dedicated shared-device Conditional Access policy after report-only validation. If a room or shared device stops signing in, record the device, account, time, and network rather than changing broad exclusions.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"readiness.model","channel":"readiness","states":["needsDecision","missing","partial","reportOnly","readyToEnforce"],"format":"json-template","kind":"referenceOnly"}
{"tiles":[{"id":"accounts","label":"Confirmed shared devices","result":"{{shared.confirmedAccounts}}","line":"Only owner-confirmed resource accounts are in scope."},{"id":"location","label":"Trusted network","result":"{{policy.target.trustedLocationId}}","line":"The dedicated block policy depends on this stable named-location ID."},{"id":"evidence","label":"Device evidence","result":"{{shared.deviceEvidence}}","line":"Validate normal sign-in and absence of person-interactive prompts before enforcement."}],"whyIamaiSaysThis":"Shared-device resource accounts need a dedicated path; broad MFA/registration prompts can block userless devices."}
@@IAMAI-END

@@IAMAI-BEGIN {"id":"troubleshooting.model","channel":"troubleshooting","states":["missing","partial","reportOnly","readyToEnforce","inPlace"],"format":"json","kind":"referenceOnly"}
{"scenarios":[{"id":"interactive-mfa-prompt","classification":"documented","symptom":"A Teams Room or shared device is prompted for user-interactive MFA or registration.","check":"Identify which Conditional Access policy applied to the resource account.","fix":"Exclude only the confirmed resource account from that person-interactive policy using its stable identity; keep the dedicated shared-device policy.","then":"Retest and rescan.","sources":["ms-teams-ca"]},{"id":"trusted-location-miss","classification":"derived","symptom":"A known room device is blocked after the dedicated policy is enabled.","check":"Compare its current public egress IP to the canonical trusted named location.","fix":"Correct the trusted-network object if the owner-approved egress changed; otherwise return this policy to Report-only while diagnosing.","then":"Retest from the device.","sources":["ms-teams-ca"]},{"id":"scope-too-broad","classification":"derived","symptom":"A normal user is affected by the shared-device policy.","check":"Read back includeUsers and compare with owner-confirmed resource-account IDs.","fix":"Correct the included population on the same stable policy.","then":"Rescan IAMAI.","sources":["ms-ca-update"]}]}
@@IAMAI-END

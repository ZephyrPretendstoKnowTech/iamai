@@IAMAI-BEGIN {"id":"entra.create","channel":"entra","states":["missing"],"format":"markdown","kind":"template"}
1. Open **Entra ID > Conditional Access > Policies > New policy**.
2. Name it **{{policy.target.displayName}}**.
3. Users → Include: only the owner-confirmed shared-device accounts, by the IDs IAMAI shows.
4. Users → Exclude → Groups: the emergency access exclusions group {{policy.target.excludeGroups}}.
5. Target resources: **All resources**.
6. Conditions → Locations: set **Configure** to **Yes**, then Include **Any location** and Exclude the trusted-network location with ID `{{policy.target.trustedLocationId}}`. Left at **No** the policy applies in every location, the office included, and Block access there stops the device completely.
7. Grant: **Block access**. Do not add an interactive control: a room account has no second device to approve one with.
8. Enable policy: **Report-only**. It will not enforce its access rule until you enable it. Do not choose **On** here: a policy created On applies to everyone it covers from the moment you save, before anyone has seen who it would have stopped — the failure this plan exists to prevent. The script for this step can only create in Report-only. Create it, then rescan before any enforcement.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"entra.correct.open","channel":"entra","states":["partial"],"format":"markdown","kind":"template"}
Open the shared-device policy by the same policy ID IAMAI shows. Correct only the differences IAMAI identified.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"entra.correct.population","channel":"entra","states":["partial"],"format":"markdown","kind":"template"}
Set Users → Include to the owner-confirmed shared-device accounts only. Keep the emergency access exclusions group excluded.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"entra.correct.apps","channel":"entra","states":["partial"],"format":"markdown","kind":"template"}
Set Target resources to **All resources**. Leave the other intended conditions unchanged.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"entra.correct.location","channel":"entra","states":["partial"],"format":"markdown","kind":"template"}
Under **Conditions → Locations**, set **Configure** to **Yes**, then Include **Any location** and Exclude the trusted-network location with ID `{{policy.target.trustedLocationId}}`. Left at **No** the policy applies in every location, the office included, and Block access there stops the device completely.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"entra.correct.grant","channel":"entra","states":["partial"],"format":"markdown","kind":"template"}
Set Grant to **Block access** only. Do not add an interactive MFA grant.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"entra.correct.lifecycle","channel":"entra","states":["partial"],"format":"markdown","kind":"template"}
Return the dedicated policy to **Report-only** while material corrections are being validated.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"entra.people-exclusions","channel":"entra","states":["missing","partial"],"format":"markdown","kind":"template"}
This is a separate change from the dedicated policy. For each person-interactive policy IAMAI lists, open that policy by its ID and apply IAMAI's resolved users and conditions, so the confirmed shared-device accounts are excluded and the policy's other exclusions stay in place. Keep each policy's current state. If it is On, the changed rule can affect access after you save.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"entra.verify","channel":"entra","states":["partial"],"format":"markdown","kind":"template"}
Save, re-open the same policies by ID, verify the intended scope, then rescan IAMAI. Verify after the change: a real shared device still signs in from the approved network.

Keep the policy's current state. If it is On, the changed rule can affect access after you save.

This change removes {{policy.current.removedExclusions}} from the policy's exclusions. If the policy is On, it applies to them as soon as you save. [omit this line when unavailable]
@@IAMAI-END

@@IAMAI-BEGIN {"id":"entra.observe","channel":"entra","states":["reportOnly"],"format":"markdown","kind":"template"}
Keep the policy in Report-only while you review the evidence listed for this step. Review sign-in and report-only results for each shared-device account from its normal device and network, and confirm the person-interactive policies no longer prompt the resource account. Continue until the records cover the devices' normal activity.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"entra.enforce","channel":"entra","states":["readyToEnforce"],"format":"markdown","kind":"template"}
Open the dedicated policy by the same policy ID and re-confirm that the trusted-network location still matches the public IP addresses the devices use.

Do not turn it on unless all of these are true now:

- The required report-only period is complete, with no failures on this policy in the sign-in records.
- The policy is still Report-only and its settings still match the intended target, exclusions included — the script for this step refuses to enforce a policy that is not.
- Emergency access is prepared and tested.

If any one of them is not true, leave the policy in Report-only. Change **Enable policy** from Report-only to **On** and save. Verify after the change: a real shared device signs in from the approved network. Then rescan IAMAI.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"json.create","channel":"json","states":["missing"],"format":"json-template","kind":"template","method":"POST","endpoint":"https://graph.microsoft.com/v1.0/identity/conditionalAccess/policies"}
{"displayName":"{{policy.target.displayName}}","state":"enabledForReportingButNotEnforced","conditions":{"users":{"includeUsers":{{json:policy.target.includeUsers}},"excludeGroups":{{json:policy.target.excludeGroups}}},"applications":{"includeApplications":["All"]},"clientAppTypes":["all"],"locations":{"includeLocations":["All"],"excludeLocations":["{{policy.target.trustedLocationId}}"]}},"grantControls":{"operator":"OR","builtInControls":["block"]},"sessionControls":null}
@@IAMAI-END

@@IAMAI-BEGIN {"id":"json.correct.conditions","channel":"json","states":["partial"],"format":"json-template","kind":"template","method":"PATCH","endpoint":"https://graph.microsoft.com/v1.0/identity/conditionalAccess/policies/{policy.current.id}"}
{"conditions":{"users":{"includeUsers":{{json:policy.target.includeUsers}},"excludeGroups":{{json:policy.target.excludeGroups}}},"applications":{"includeApplications":["All"]},"clientAppTypes":["all"],"locations":{"includeLocations":["All"],"excludeLocations":["{{policy.target.trustedLocationId}}"]}}}
@@IAMAI-END

@@IAMAI-BEGIN {"id":"json.correct.grant","channel":"json","states":["partial"],"format":"json","kind":"template","method":"PATCH","endpoint":"https://graph.microsoft.com/v1.0/identity/conditionalAccess/policies/{policy.current.id}"}
{"grantControls":{"operator":"OR","builtInControls":["block"]},"sessionControls":null}
@@IAMAI-END

@@IAMAI-BEGIN {"id":"json.report-only","channel":"json","states":["partial"],"format":"json","kind":"template","method":"PATCH","endpoint":"https://graph.microsoft.com/v1.0/identity/conditionalAccess/policies/{policy.current.id}"}
{"state":"enabledForReportingButNotEnforced"}
@@IAMAI-END

@@IAMAI-BEGIN {"id":"json.enforce","channel":"json","states":["readyToEnforce"],"format":"json","kind":"template","method":"PATCH","endpoint":"https://graph.microsoft.com/v1.0/identity/conditionalAccess/policies/{policy.current.id}"}
{"state":"enabled"}
@@IAMAI-END

@@IAMAI-BEGIN {"id":"json.people-patches","channel":"json","states":["missing","partial"],"format":"json-template","kind":"referenceOnly"}
{"kind":"iamaiResolvedConditionalAccessPatchSet","policies":{{json:peoplePolicies.resolvedPatches}},"rule":"Each item must carry the stable policy id and a complete IAMAI-resolved desired conditions object; do not reconstruct exclusions from display names."}
@@IAMAI-END

@@IAMAI-BEGIN {"id":"powershell.run","channel":"powershell","states":["missing","partial","reportOnly","readyToEnforce"],"format":"powershell","kind":"deployableAfterBinding","invocation":{"modeParameter":"Mode","parameters":{"PolicyId":{"binding":"policy.current.id","modes":["CorrectConditions","CorrectGrant","Verify","Enforce"]},"DisplayName":{"binding":"policy.target.displayName","modes":["Create"]},"IncludeUsers":{"binding":"policy.target.includeUsers","modes":["Create","CorrectConditions"]},"ExcludeGroups":{"binding":"policy.target.excludeGroups","modes":["Create","CorrectConditions"]},"TrustedLocationId":{"binding":"policy.target.trustedLocationId","modes":["Create","CorrectConditions"]}},"withheldModes":{"Enforce":"Enforce runs only with -TrustedLocationReconfirmed and -ReportOnlyEvidenceReviewed, and this package declares no prerequisite IAMAI can check to pass them.","PeopleExclusions":"PeopleExclusions reads the resolved people-policy patches as JSON text, and IAMAI holds them as objects, not as the JSON text the parameter takes."}}}
# This change removes {{policy.current.removedExclusions}} from the policy's exclusions. If the policy is On, it applies to them as soon as the correction is saved. [omit this line when unavailable]
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

State: the owner needs to confirm which accounts belong to shared devices in {{tenant.displayName}}. Proposed accounts: {{shared.confirmedAccounts}}. An account name alone does not show that it is a room or shared-device account rather than a person; each account and its normal network need owner confirmation before any policy excludes it.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"ai.create","channel":"aiInfo","states":["missing"],"format":"markdown","kind":"template"}

IAMAI has not automatically assessed a dedicated shared-device policy in {{tenant.displayName}}. Inspect existing policies first. If a new dedicated policy is needed, create it in Report-only: only the confirmed shared-device accounts, the exclusions group excluded, All resources, Any location except the trusted-network location, and Block access. It adds no MFA or other prompt a person would have to answer.

The PowerShell Create writes this one policy only. Excluding these accounts from the person-interactive policies is a separate step, made in Entra for each policy IAMAI identifies.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"ai.correct","channel":"aiInfo","states":["partial"],"format":"markdown","kind":"template"}

State: the dedicated shared-device policy exists, but these settings differ from the intended target: {{policy.current.semanticMismatches}}. The correction changes only those settings, on the same policy ID, and keeps the exclusions group excluded. Excluding the accounts from person-interactive policies is a separate change on each of those policies.

Keep the policy's current state. If it is On, the changed rule can affect access after you save.

This change removes {{policy.current.removedExclusions}} from the policy's exclusions. If the policy is On, it applies to them as soon as you save. [omit this line when unavailable]
@@IAMAI-END

@@IAMAI-BEGIN {"id":"ai.observe","channel":"aiInfo","states":["reportOnly"],"format":"markdown","kind":"template"}

State: the dedicated shared-device policy is in Report-only. Shared-device sign-in evidence: {{shared.deviceEvidence}}. Look for any person-interactive policy that still prompts a shared device, and for sign-ins from outside the trusted network. A prompt is fixed by excluding only the confirmed account from that policy, not by widening exclusions.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"ai.enforce","channel":"aiInfo","states":["readyToEnforce"],"format":"markdown","kind":"template"}

State: the dedicated shared-device policy is in Report-only and the next action is to enable it. Before setting it to On, the trusted-network location must be re-confirmed against the public IP addresses the devices use, and the report-only evidence should cover normal device activity. After enabling, test a real shared device.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"ai.blocked","channel":"aiInfo","states":["blocked"],"format":"markdown","kind":"template"}

State: this step cannot proceed yet. Known blockers: {{dependencies.blockers}}.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"email.confirm","channel":"email","states":["needsDecision"],"format":"markdown","kind":"template"}
Subject: Action needed: Give Shared Devices Their Own Policy

Please confirm the listed room or shared-device accounts and their normal network. Tell IT about remote or unusual use before the change.

Accounts: {{shared.confirmedAccounts}} [omit this line when unavailable]
@@IAMAI-END

@@IAMAI-BEGIN {"id":"email.change","channel":"email","states":["readyToEnforce"],"format":"markdown","kind":"template","audience":"help-desk"}
Subject: Planned change: Give Shared Devices Their Own Policy

We plan to turn on the dedicated shared-device Conditional Access policy after its report-only review. If a room or shared device stops signing in, record the device, account, time, and network rather than changing broad exclusions.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"readiness.model","channel":"readiness","states":["needsDecision","missing","partial","reportOnly","readyToEnforce"],"format":"json-template","kind":"referenceOnly"}
{"tiles":[{"id":"accounts","label":"Confirmed shared devices","result":"{{shared.confirmedAccounts}}","line":"Confirm the resource accounts, their approved network and the policies that would ask them for a person-specific action."},{"id":"location","label":"Trusted network","result":"{{policy.target.trustedLocationId}}","line":"The dedicated block policy depends on this named location ID."},{"id":"evidence","label":"Device evidence","result":"{{shared.deviceEvidence}}","line":"Review normal sign-ins and check that no person-interactive policy prompts these accounts before enforcement."}],"whyIamaiSaysThis":"Room systems and other shared devices can stop working when a policy expects a person to answer a prompt."}
@@IAMAI-END

@@IAMAI-BEGIN {"id":"troubleshooting.model","channel":"troubleshooting","states":["missing","partial","reportOnly","readyToEnforce","inPlace"],"format":"json","kind":"referenceOnly"}
{"scenarios":[{"id":"interactive-mfa-prompt","classification":"documented","symptom":"A Teams Room or shared device is prompted for user-interactive MFA or registration.","check":"Identify which Conditional Access policy applied to the resource account.","fix":"Exclude only the confirmed resource account from that person-interactive policy using its object ID; keep the dedicated shared-device policy.","then":"Retest and rescan.","sources":["ms-teams-ca"]},{"id":"trusted-location-miss","classification":"derived","symptom":"A known room device is blocked after the dedicated policy is enabled.","check":"Compare its current public IP address to the intended trusted named location.","fix":"Correct the trusted-network object if the owner-approved egress changed; otherwise return this policy to Report-only while diagnosing.","then":"Retest from the device.","sources":["ms-teams-ca"]},{"id":"scope-too-broad","classification":"derived","symptom":"A normal user is affected by the shared-device policy.","check":"Read back includeUsers and compare with owner-confirmed resource-account IDs.","fix":"Correct the included population on the same policy ID.","then":"Rescan IAMAI.","sources":["ms-ca-update"]}]}
@@IAMAI-END

@@IAMAI-BEGIN {"id":"entra.manual-review","channel":"entra","states":["missing","blocked"],"format":"markdown","kind":"referenceOnly"}
Review the dedicated access policy for the shared-device accounts listed on this step, then test each required work task from the approved network. Record the tested accounts, task, date and outcome below.

Proposed policy name: **{{policy.target.displayName}}**. [omit this line when unavailable]
Shared-device account IDs: {{policy.target.includeUsers}}. [omit this line when unavailable]

1. Confirm each account belongs to a room system or shared device and identify its owner. Missing interactive sign-ins alone do not identify a shared-device account.
2. Agree the public office or VPN network ranges with the network owner. Confirm the named location in Define the Trusted Network. If no network can be trusted, resolve the device's access design before creating a location-based exception.
3. In Entra admin center → Conditional Access → Policies, inspect any existing policy for these accounts before creating another. For a new dedicated policy, include only the confirmed shared-device accounts and target All resources. Under **Conditions → Locations** set **Configure** to **Yes**, then include Any location and exclude only the approved trusted location; left at **No** the policy applies in the office too, and Block access there stops the device completely. Grant: Block access. Start in Report-only.
4. Review the other policies that apply to these accounts. Microsoft's own guidance is to keep these accounts out of the policies written for people: they have no second device to approve a prompt, and on Teams devices a sign-in frequency signs them out and an authentication strength refuses them. Add only the exceptions the device needs for supported operation; do not place shared devices in the emergency-access exclusions group.
5. Test the device's actual tasks, including scheduled jobs. Review report-only results before enabling the dedicated policy. Confirm that approved access works and access from an unapproved network is blocked.
6. Rescan after the changes, then record the completed review below. A later change to the listed accounts, policies or named locations reopens the review.
@@IAMAI-END

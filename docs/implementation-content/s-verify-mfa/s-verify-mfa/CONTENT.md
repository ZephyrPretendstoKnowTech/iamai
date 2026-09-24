@@IAMAI-BEGIN {"id":"entra.configure","channel":"entra","states":["setupRequired"],"format":"markdown","kind":"template"}
1. Open **Entra ID > Authentication methods > Registration campaign > Edit**.
2. Set State to **Enabled** to choose the method yourself. Left at **Microsoft managed**, Microsoft runs the campaign: it targets passkeys where the included people are enabled for them, Microsoft Authenticator where they are not, and it reaches everyone who can do MFA rather than only the people on a text message or a voice call.
3. Authentication method: **Passkey**.
4. Target: **All users**, then apply only IAMAI-resolved exclusions if the tenant campaign should omit non-person populations.
5. **Days allowed to snooze**: **1**.
6. **Limited number of snoozes**: **Disabled**.
7. Save, reopen the campaign and verify the target before announcing the rollout. Then rescan IAMAI.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"entra.holdouts","channel":"entra","states":["holdoutReview"],"format":"markdown","kind":"template"}
Review every remaining holdout individually after the enrollment date. Confirm employment and account status, recovery method, and whether the person has been contacted, then record an explicit outcome for each person. The elapsed date is not proof of readiness. Do not add a Conditional Access exclusion merely because enrollment was not completed.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"entra.verify-ready","channel":"entra","states":["ready"],"format":"markdown","kind":"template"}
Reopen the campaign and confirm it still targets the intended method with the intended snooze settings. Then use IAMAI's current MFA Readiness evidence, not the campaign setting, to confirm the readiness checks are met. Campaign settings do not show that people can sign in.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"json.configure","channel":"json","states":["setupRequired"],"format":"json-template","kind":"template"}
{"registrationEnforcement":{"authenticationMethodsRegistrationCampaign":{"snoozeDurationInDays":{{json:campaign.snoozeDurationInDays}},"enforceRegistrationAfterAllowedSnoozes":false,"state":"enabled","excludeTargets":{{json:campaign.excludeTargets}},"includeTargets":[{"id":"all_users","targetType":"group","targetedAuthenticationMethod":"fido2"}]}}}
@@IAMAI-END

@@IAMAI-BEGIN {"id":"powershell.run","channel":"powershell","states":["setupRequired","campaignRunning","ready"],"format":"powershell","kind":"template"}
param(
 [Parameter(Mandatory=$true)][ValidateSet('Configure','Verify')][string]$Mode,
 [ValidateRange(0,14)][int]$SnoozeDurationInDays=1,
 [string]$ExcludeTargetsJson='[]'
)
$ErrorActionPreference='Stop'
Connect-MgGraph -Scopes 'Policy.ReadWrite.AuthenticationMethod','Policy.Read.AuthenticationMethod' -NoWelcome
$G='https://graph.microsoft.com/v1.0'
function IG($m,$u,$b=$null){if($null -eq $b){return Invoke-MgGraphRequest -Method $m -Uri $u -OutputType PSObject};Invoke-MgGraphRequest -Method $m -Uri $u -Body ($b|ConvertTo-Json -Depth 30) -ContentType 'application/json' -OutputType PSObject}
if($Mode -eq 'Configure'){
 $exclude=@($ExcludeTargetsJson|ConvertFrom-Json)
 $campaign=@{snoozeDurationInDays=$SnoozeDurationInDays;enforceRegistrationAfterAllowedSnoozes=$false;state='enabled';excludeTargets=$exclude;includeTargets=@(@{id='all_users';targetType='group';targetedAuthenticationMethod='fido2'})}
 IG PATCH "$G/policies/authenticationMethodsPolicy" @{registrationEnforcement=@{authenticationMethodsRegistrationCampaign=$campaign}} | Out-Null
}
$p=IG GET "$G/policies/authenticationMethodsPolicy"
$p.registrationEnforcement.authenticationMethodsRegistrationCampaign
@@IAMAI-END

@@IAMAI-BEGIN {"id":"ai.configure","channel":"aiInfo","states":["setupRequired"],"format":"markdown","kind":"template"}

The registration campaign for {{tenant.displayName}} needs to be configured. Intended campaign: State Enabled; method Passkey; target All users; exclusions {{campaign.excludeTargets}}; snooze duration {{campaign.snoozeDurationInDays}} day(s), with unlimited snoozes. Microsoft is changing campaign behavior in a rollout expected to finish by the end of September 2026, so the portal may show different controls. Prompts depend on each user's eligibility and the snooze settings.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"ai.running","channel":"aiInfo","states":["campaignRunning"],"format":"markdown","kind":"template"}

The campaign is running and enrollment work is in progress. Active people: {{readiness.activeCount}}. MFA readiness: {{readiness.percent}}. People who need hands-on help: {{readiness.specialCare}}. Admins who still need a passkey or security key: {{readiness.adminsNeedingPasskey}}. A registered method and a successful sign-in with it are different evidence. An older method is retired only through the approved method-policy change, after checking recovery needs.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"ai.holdouts","channel":"aiInfo","states":["holdoutReview"],"format":"markdown","kind":"template"}

The enrollment date has passed and some active people still lack a proven method. Each needs an individual review outcome covering account status, recovery method and whether they have been contacted. A Conditional Access exclusion is not the default resolution, and the elapsed date is not proof of readiness.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"ai.ready","channel":"aiInfo","states":["ready"],"format":"markdown","kind":"template"}

The remaining work is to confirm that the campaign is still configured as planned and that MFA Readiness evidence meets the step's checks. These are separate: campaign settings do not prove that each person can sign in with their method.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"ai.blocked","channel":"aiInfo","states":["blocked"],"format":"markdown","kind":"template"}

This step is blocked. Blockers IAMAI recorded: {{dependencies.blockers}}.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"readiness.model","channel":"readiness","states":["setupRequired","campaignRunning","holdoutReview","ready"],"format":"json-template","kind":"referenceOnly"}
{"tiles":[{"id":"active","label":"Active people","result":{{json:readiness.activeCount}},"line":"Campaign work is driven by the active-person population."},{"id":"readiness","label":"MFA readiness","result":{{json:readiness.percent}},"line":"Work through missing methods, unproven methods and unreadable evidence separately. Campaign settings do not prove that people are ready."},{"id":"special","label":"Special care","result":{{json:readiness.specialCare}},"line":"People with no method or recovery risk need hands-on work."},{"id":"admins","label":"Admins needing passkey","result":{{json:readiness.adminsNeedingPasskey}},"line":"Authenticator campaign success does not replace phishing-resistant admin readiness."}],"whyIamaiSaysThis":"The campaign helps people register; MFA Readiness evidence, not the campaign settings, shows whether they are ready."}
@@IAMAI-END


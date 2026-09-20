@@IAMAI-BEGIN {"id":"entra.campaign","channel":"entra","states":["missing"],"format":"markdown","kind":"template"}
1. Go to Entra admin center → Entra ID → Authentication methods → Registration campaign → Edit.
2. State: Enabled.
3. Target: All users, keeping any existing exclusions.
4. Authentication method: **Passkey (FIDO2)** or **Microsoft Authenticator**. A campaign nudges one of them at a time. A passkey campaign does not reach guests, who cannot register a passkey in this tenant; an Authenticator campaign does.
5. **Days allowed to snooze**: the value your organization approved, between 0 and 14; IAMAI does not hold one. With **Limited number of snoozes** enabled, a person may skip the prompt three times and must then register.
6. Save, reopen the settings and rescan.

A person sees the prompt after an interactive sign-in that completed MFA here. It is skipped where they arrive by single sign-on, and an Authenticator campaign does not prompt on a mobile device.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"ai.walkthrough","channel":"aiInfo","states":["missing"],"format":"markdown","kind":"template"}
After enabling the campaign, help each special-care person register in person:

1. Book 10 minutes with each person listed under "People who need special care."
2. Open aka.ms/mfasetup with them signed in.
3. If they have no method at all: issue a Temporary Access Pass first (Entra admin center → Users → [user] → Authentication methods → Add → Temporary Access Pass). This gives them a time-limited passcode to sign in and register.
4. If they only have text message or phone call: register the replacement method with them. Test the replacement method first. Retire an older method only through the approved method-policy change, after checking recovery needs.
5. Admins: register a passkey or a hardware security key — either counts as phishing-resistant.
6. Have each person sign in once more using the new method. IAMAI looks for that sign-in record on the next scan.

Track progress on the MFA Readiness page — it shows who still needs setup and who still needs a verified sign-in.

[MFA Readiness →](#/readiness)
@@IAMAI-END

@@IAMAI-BEGIN {"id":"entra.configure","channel":"entra","states":["setupRequired"],"format":"markdown","kind":"template"}
1. Open **Entra ID > Authentication methods > Registration campaign > Edit**.
2. Set State to **Enabled** to choose the method yourself. Left at **Microsoft managed**, Microsoft runs the campaign: it targets passkeys where the included people are enabled for them, Microsoft Authenticator where they are not, and it reaches everyone who can do MFA rather than only the people on a text message or a voice call.
3. Authentication method: **Microsoft Authenticator**, or **Passkey (FIDO2)** where this tenant's people can register one. Only one at a time.
   For an Authenticator campaign, check **Entra ID > Authentication methods > Policies > Microsoft Authenticator** first: with **Authentication mode** set to **Passwordless**, nobody is eligible and the campaign nudges no one. It must be **Any** or **Push**.
4. Target: **All users**, then apply only IAMAI-resolved exclusions if the tenant campaign should omit non-person populations.
5. **Days allowed to snooze**: the value your organization approved, between 0 and 14; IAMAI does not hold one.
6. Keep **Limited number of snoozes** enabled, so a person may skip the prompt three times and must then register, where the tenant's current rollout exposes that control.
7. Save, reopen the campaign and verify the target before announcing the rollout. Then rescan IAMAI.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"entra.run-workflow","channel":"entra","states":["campaignRunning"],"format":"markdown","kind":"template"}
1. Work the current special-care list: {{readiness.specialCare}}.
2. For a person with no usable method, use the approved Temporary Access Pass/recovery workflow and register a supported method with them.
3. For a registered-but-unproven person, have them sign in with the intended method so the next scan can record a successful use.
4. For admins still below the phishing-resistant target {{readiness.adminsNeedingPasskey}}, register and test a passkey/security key; Authenticator push alone does not satisfy that admin requirement.
5. Test the replacement method first. Retire an older method only through the approved method-policy change, after checking recovery needs.
6. Rescan IAMAI after each batch. Do not reconfigure the campaign just because the readiness list changed.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"entra.holdouts","channel":"entra","states":["holdoutReview"],"format":"markdown","kind":"template"}
Review every remaining holdout individually after the enrollment date. Confirm employment and account status, recovery method, and whether the person has been contacted, then record an explicit outcome for each person. The elapsed date is not proof of readiness. Do not add a Conditional Access exclusion merely because enrollment was not completed.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"entra.verify-ready","channel":"entra","states":["ready"],"format":"markdown","kind":"template"}
Reopen the campaign and confirm it still targets the intended method with the intended snooze settings. Then use IAMAI's current MFA Readiness evidence, not the campaign setting, to confirm the readiness checks are met. Campaign settings do not show that people can sign in.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"json.configure","channel":"json","states":["setupRequired"],"format":"json-template","kind":"template"}
{"registrationEnforcement":{"authenticationMethodsRegistrationCampaign":{"snoozeDurationInDays":{{json:campaign.snoozeDurationInDays}},"enforceRegistrationAfterAllowedSnoozes":true,"state":"enabled","excludeTargets":{{json:campaign.excludeTargets}},"includeTargets":[{"id":"all_users","targetType":"group","targetedAuthenticationMethod":"microsoftAuthenticator"}]}}}
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
 $campaign=@{snoozeDurationInDays=$SnoozeDurationInDays;enforceRegistrationAfterAllowedSnoozes=$true;state='enabled';excludeTargets=$exclude;includeTargets=@(@{id='all_users';targetType='group';targetedAuthenticationMethod='microsoftAuthenticator'})}
 IG PATCH "$G/policies/authenticationMethodsPolicy" @{registrationEnforcement=@{authenticationMethodsRegistrationCampaign=$campaign}} | Out-Null
}
$p=IG GET "$G/policies/authenticationMethodsPolicy"
$p.registrationEnforcement.authenticationMethodsRegistrationCampaign
@@IAMAI-END

@@IAMAI-BEGIN {"id":"ai.configure","channel":"aiInfo","states":["setupRequired"],"format":"markdown","kind":"template"}

The registration campaign for {{tenant.displayName}} needs to be configured. Intended campaign: State Enabled (not Microsoft managed); method Microsoft Authenticator; target All users; exclusions {{campaign.excludeTargets}}; snooze duration {{campaign.snoozeDurationInDays}} day(s), with registration required after the allowed snoozes where the tenant exposes that control. Switching the method to passkeys would change the saved plan and needs an owner decision. Microsoft is changing campaign behavior in a rollout expected to finish by the end of September 2026, so the portal may show different controls. Prompts depend on each user's eligibility and the snooze settings.
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

@@IAMAI-BEGIN {"id":"email.everyone","channel":"email","states":["setupRequired"],"format":"markdown","kind":"template","audience":"all-users"}
Subject: Action needed: Prepare Your Team for MFA

Please complete the sign-in method setup requested by IT, then sign in once using that method. Contact IT if you cannot register or no longer have access to your existing method.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"email.admins","channel":"email","states":["setupRequired"],"format":"markdown","kind":"template","audience":"administrators"}
Subject: Action needed: Prepare Your Team for MFA

Admin sign-ins need a stronger method than the general setup request. If IT has asked you to, register a passkey or hardware security key for your admin sign-in, then sign in once using it. Contact IT if you cannot register or no longer have access to your existing method.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"email.holdout","channel":"email","states":["holdoutReview"],"format":"markdown","kind":"template","audience":"rollout-administrators"}
Subject: Action needed: Prepare Your Team for MFA

The enrollment date has passed and some active people still have not shown a successful sign-in with a registered method. Please review each remaining account for its status, contact and recovery needs, and manager follow-up. A policy exclusion is not the default resolution.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"readiness.model","channel":"readiness","states":["setupRequired","campaignRunning","holdoutReview","ready"],"format":"json-template","kind":"referenceOnly"}
{"tiles":[{"id":"active","label":"Active people","result":{{json:readiness.activeCount}},"line":"Campaign work is driven by the active-person population."},{"id":"readiness","label":"MFA readiness","result":{{json:readiness.percent}},"line":"Work through missing methods, unproven methods and unreadable evidence separately. Campaign settings do not prove that people are ready."},{"id":"special","label":"Special care","result":{{json:readiness.specialCare}},"line":"People with no method or recovery risk need hands-on work."},{"id":"admins","label":"Admins needing passkey","result":{{json:readiness.adminsNeedingPasskey}},"line":"Authenticator campaign success does not replace phishing-resistant admin readiness."}],"whyIamaiSaysThis":"The campaign helps people register; MFA Readiness evidence, not the campaign settings, shows whether they are ready."}
@@IAMAI-END

@@IAMAI-BEGIN {"id":"troubleshooting.model","channel":"troubleshooting","states":["setupRequired","campaignRunning","holdoutReview","ready"],"format":"json","kind":"referenceOnly"}
{"scenarios":[{"id":"campaign-target-changed","classification":"documented","symptom":"The campaign begins nudging for passkeys instead of the planned Microsoft Authenticator campaign.","check":"Check whether the campaign is Microsoft managed and whether passkey (FIDO2) is enabled for included users.","fix":"To keep the planned campaign, set it to Enabled with Microsoft Authenticator explicitly; do not rely on changing Microsoft-managed defaults.","then":"Re-read the authentication methods policy.","sources":["ms-registration-campaign"]},{"id":"user-not-nudged","classification":"documented","symptom":"An included user does not see a registration nudge.","check":"Confirm they completed Entra MFA, are eligible for the targeted method, and aren't blocked from security-info registration by Conditional Access or another flow.","fix":"Resolve the eligibility/registration-path issue rather than adding a broad exclusion.","then":"Retry a qualifying sign-in.","sources":["ms-registration-campaign"]},{"id":"registered-not-proven","classification":"derived","symptom":"The campaign says configured but IAMAI still lists a person as not proven.","check":"Confirm a later sign-in record shows the method actually used successfully.","fix":"Have the person complete a real MFA sign-in with the registered method.","then":"Rescan IAMAI.","sources":["ms-combined-registration"]},{"id":"graph-property-rollout","classification":"documented","symptom":"The tenant UI/API behavior differs from the newest campaign documentation during September 2026.","check":"Confirm the tenant's currently exposed campaign controls and API response.","fix":"Preserve the intended Authenticator target and safe snooze behavior using only controls the tenant currently supports; do not switch target methods to make the request pass.","then":"Re-read effective settings and record the platform variance.","sources":["ms-registration-campaign","ms-authmethods-update"]}]}
@@IAMAI-END

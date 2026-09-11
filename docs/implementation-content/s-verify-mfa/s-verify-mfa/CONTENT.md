@@IAMAI-BEGIN {"id":"entra.configure","channel":"entra","states":["setupRequired"],"format":"markdown","kind":"template"}
1. Open **Entra ID > Authentication methods > Registration campaign > Edit**.
2. Set State to **Enabled** (not Microsoft managed, because IAMAI is preserving an explicit Authenticator-targeted campaign).
3. Authentication method: **Microsoft Authenticator**.
4. Target: **All users**, then apply only IAMAI-resolved exclusions if the tenant campaign should omit non-person populations.
5. Set the IAMAI-resolved snooze duration to **{{campaign.snoozeDurationInDays}} day(s)**.
6. Keep **Limited number of snoozes** enabled so registration is required after the allowed snoozes, where the tenant's current rollout exposes that control.
7. Save, re-open the campaign, and verify the effective target before communicating the rollout.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"entra.run-workflow","channel":"entra","states":["campaignRunning"],"format":"markdown","kind":"template"}
1. Work the current special-care list: {{readiness.specialCare}}.
2. For a person with no usable method, use the approved Temporary Access Pass/recovery workflow and register a supported method with them.
3. For a registered-but-unproven person, have them complete a real MFA sign-in so IAMAI can observe proof.
4. For admins still below the phishing-resistant target {{readiness.adminsNeedingPasskey}}, register and prove a passkey/security key; Authenticator push alone does not satisfy that admin requirement.
5. Rescan IAMAI after each batch. Do not reconfigure the campaign just because the readiness list changed.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"entra.holdouts","channel":"entra","states":["holdoutReview"],"format":"markdown","kind":"template"}
Review every remaining holdout individually after the enrollment deadline. Confirm employment/account status, recovery method, and whether the person has been contacted. Do not add a Conditional Access exclusion merely because enrollment was not completed.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"entra.verify-ready","channel":"entra","states":["ready"],"format":"markdown","kind":"template"}
Re-open the campaign and confirm it remains on the intended Authenticator target. Then use IAMAI's current MFA Readiness evidence—not the campaign setting—to confirm the rollout gate is met.
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
**Contains tenant context. Review before sharing with an external AI service.**

Review the proposed registration campaign for {{tenant.displayName}}. Preserve the explicit Microsoft Authenticator target, all-user campaign target, current exclusions {{campaign.excludeTargets}}, and IAMAI snooze duration {{campaign.snoozeDurationInDays}}. Do not switch to passkeys without a product/owner decision.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"ai.running","channel":"aiInfo","states":["campaignRunning"],"format":"markdown","kind":"template"}
**Contains tenant context. Review before sharing with an external AI service.**

Summarize the current enrollment work from IAMAI readiness: {{readiness.activeCount}} active people, {{readiness.percent}} readiness, special care {{readiness.specialCare}}, admins needing passkey/security key {{readiness.adminsNeedingPasskey}}. Do not infer proof from registration alone.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"ai.holdouts","channel":"aiInfo","states":["holdoutReview"],"format":"markdown","kind":"template"}
**Contains tenant context. Review before sharing with an external AI service.**

Review remaining holdouts one by one. Recommend account-status/recovery/contact actions, not Conditional Access exclusions.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"ai.ready","channel":"aiInfo","states":["ready"],"format":"markdown","kind":"template"}
**Contains tenant context. Review before sharing with an external AI service.**

Check that the campaign configuration and IAMAI readiness evidence are being treated separately. Campaign configuration is not proof that each person can authenticate.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"ai.blocked","channel":"aiInfo","states":["blocked"],"format":"markdown","kind":"template"}
**Contains tenant context. Review before sharing with an external AI service.**

Explain the blocker without inventing a user method, readiness result, or campaign setting: {{dependencies.blockers}}.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"email.everyone","channel":"email","states":["setupRequired"],"format":"markdown","kind":"template"}
Subject: Set up Microsoft Authenticator before MFA enforcement

From {{campaign.mfaEnforceDate}}, sign-ins to {{tenant.displayName}} will require MFA. Please complete the Microsoft Authenticator setup when prompted. If you cannot register or no longer have access to your existing method, contact IT before the enforcement date so we can use the approved recovery process.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"email.admins","channel":"email","states":["setupRequired"],"format":"markdown","kind":"template"}
Subject: Admin sign-in requires a passkey or security key

The general campaign will help with Microsoft Authenticator, but admin sign-ins have a stronger requirement. If IAMAI lists you as needing action, register and prove a passkey or hardware security key before the admin-policy enforcement date.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"email.holdout","channel":"email","states":["holdoutReview"],"format":"markdown","kind":"template"}
Subject: MFA enrollment holdout review

The enrollment deadline has passed and one or more active people still lack proven readiness. Review each remaining account for status, contact/recovery needs, and manager follow-up. Do not create a policy exclusion as the default resolution.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"readiness.model","channel":"readiness","states":["setupRequired","campaignRunning","holdoutReview","ready"],"format":"json-template","kind":"referenceOnly"}
{"tiles":[{"id":"active","label":"Active people","result":{{json:readiness.activeCount}},"line":"Campaign work is driven by the active-person population."},{"id":"readiness","label":"MFA readiness","result":{{json:readiness.percent}},"line":"Registered-only is not the same as proven."},{"id":"special","label":"Special care","result":{{json:readiness.specialCare}},"line":"People with no method or recovery risk need hands-on work."},{"id":"admins","label":"Admins needing passkey","result":{{json:readiness.adminsNeedingPasskey}},"line":"Authenticator campaign success does not replace phishing-resistant admin readiness."}],"whyIamaiSaysThis":"The campaign is a rollout tool; IAMAI's proof ledger is the readiness authority."}
@@IAMAI-END

@@IAMAI-BEGIN {"id":"troubleshooting.model","channel":"troubleshooting","states":["setupRequired","campaignRunning","holdoutReview","ready"],"format":"json","kind":"referenceOnly"}
{"scenarios":[{"id":"campaign-target-changed","classification":"documented","symptom":"The campaign begins nudging for passkeys instead of the IAMAI Authenticator rollout.","check":"Check whether the campaign is Microsoft managed and whether passkey (FIDO2) is enabled for included users.","fix":"If preserving the IAMAI contract, set the campaign to Enabled with Microsoft Authenticator explicitly; do not rely on changing Microsoft-managed defaults.","then":"Re-read the authentication methods policy.","sources":["ms-registration-campaign"]},{"id":"user-not-nudged","classification":"documented","symptom":"An included user does not see a registration nudge.","check":"Confirm they completed Entra MFA, are eligible for the targeted method, and aren't blocked from security-info registration by Conditional Access or another flow.","fix":"Resolve the eligibility/registration-path issue rather than adding a broad exclusion.","then":"Retry a qualifying sign-in.","sources":["ms-registration-campaign"]},{"id":"registered-not-proven","classification":"derived","symptom":"The campaign says configured but IAMAI still lists a person as not proven.","check":"Confirm a later sign-in record shows the method actually used successfully.","fix":"Have the person complete a real MFA sign-in with the registered method.","then":"Rescan IAMAI.","sources":["ms-combined-registration"]},{"id":"graph-property-rollout","classification":"documented","symptom":"The tenant UI/API behavior differs from the newest campaign documentation during September 2026.","check":"Confirm the tenant's currently exposed campaign controls and API response.","fix":"Preserve the intended Authenticator target and safe snooze behavior using only controls the tenant currently supports; do not switch target methods to make the request pass.","then":"Re-read effective settings and record the platform variance.","sources":["ms-registration-campaign","ms-authmethods-update"]}]}
@@IAMAI-END

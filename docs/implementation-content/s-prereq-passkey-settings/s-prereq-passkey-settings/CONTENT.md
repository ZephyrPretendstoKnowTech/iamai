@@IAMAI-BEGIN {"id":"entra.profile-decision","channel":"entra","states":["needsDecision"],"format":"markdown","kind":"template"}
Microsoft now uses **passkey profiles** under **Entra ID > Security > Authentication methods > Policies > Passkey (FIDO2)**. If this tenant has not opted in, show the owner the current configuration and record approval before selecting the profile opt-in banner. Microsoft states that once enabled, passkey profiles cannot be disabled again.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"entra.configure-fido2","channel":"entra","states":["missingOrPartial"],"format":"markdown","kind":"template"}
Enable Microsoft Authenticator passkeys while preserving the tenant's existing approved hardware-key access and profile assignments. Review any conflicting restrictions before saving. A registered key is not automatically approved, and configuration checks do not replace an emergency sign-in test.

Settings IAMAI read: {{passkey.current.summary}} [omit this line when unavailable]

Resolved change: {{passkey.target.summary}} [omit this line when unavailable]

{{passkey.review.detail}} [omit this line when unavailable]

1. Go to Entra admin center → Security → Authentication methods → Policies → Passkey (FIDO2).
2. Compare the page with the settings IAMAI read. If anything differs, stop and rescan before saving.
3. Apply the resolved change. Keep every existing allowed model, target group and exclusion: removing an allowed model stops that model's existing keys from signing in.
4. Enforcing attestation applies to new registrations only. A passkey already registered without attestation can still sign in, but an authenticator that cannot provide attestation cannot register afterwards.
5. Save, reopen the page to confirm the saved settings, then rescan.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"entra.configure-authenticator","channel":"entra","states":["missingOrPartial"],"format":"markdown","kind":"template"}
Then check the supporting methods:

6. Open Microsoft Authenticator in the same Authentication methods list.
7. Set Enable to Yes. Target: All users, keeping any existing exclusions.
8. Save.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"entra.configure-tap","channel":"entra","states":["missingOrPartial"],"format":"markdown","kind":"template"}
9. Open Temporary Access Pass in the same list.
10. Set Enable to Yes for the people who may need a pass to register their first passkey. IAMAI holds no Temporary Access Pass target, so keep the tenant's current lifetime and one-time-use settings unless your security team has approved different values.
11. Save.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"entra.verify","channel":"entra","states":["verificationRequired"],"format":"markdown","kind":"template"}
Reopen Passkey (FIDO2), Microsoft Authenticator and Temporary Access Pass. Compare them with the resolved change, then rescan. A matching configuration is not proof that people can register or sign in: that evidence comes from the registration campaign and an emergency access sign-in test.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"json.fido2","channel":"json","states":["missingOrPartial"],"format":"json-template","kind":"template","method":"PATCH","endpoint":"https://graph.microsoft.com/v1.0/policies/authenticationMethodsPolicy/authenticationMethodConfigurations/fido2"}
{{json:passkey.target.fido2Configuration}}
@@IAMAI-END

@@IAMAI-BEGIN {"id":"json.authenticator","channel":"json","states":["missingOrPartial"],"format":"json-template","kind":"template"}
{{json:authenticator.target.configuration}}
@@IAMAI-END

@@IAMAI-BEGIN {"id":"json.tap","channel":"json","states":["missingOrPartial"],"format":"json-template","kind":"template"}
{{json:tap.target.configuration}}
@@IAMAI-END

@@IAMAI-BEGIN {"id":"powershell.run","channel":"powershell","states":["missingOrPartial","verificationRequired"],"format":"powershell","kind":"deployableAfterBinding","invocation":{"modeParameter":"Mode","parameters":{},"withheldModes":{"Apply":"Apply also writes the Microsoft Authenticator and Temporary Access Pass configurations, and IAMAI holds no target for either; the JSON request sets Passkey (FIDO2) alone."}}}
param([Parameter(Mandatory=$true)][ValidateSet('Apply','Verify')][string]$Mode,[string]$Fido2Json,[string]$ScannedFido2Json,[string]$AuthenticatorJson,[string]$TapJson,[switch]$ProfileOptInApproved)
$ErrorActionPreference='Stop';$G='https://graph.microsoft.com/v1.0/policies/authenticationMethodsPolicy/authenticationMethodConfigurations'
function IG($m,$u,$b=$null){if($null -eq $b){return Invoke-MgGraphRequest -Method $m -Uri $u -OutputType PSObject};Invoke-MgGraphRequest -Method $m -Uri $u -Body ($b|ConvertTo-Json -Depth 50) -ContentType 'application/json' -OutputType PSObject}
if($Mode -eq 'Apply'){
 foreach($pair in @(@('fido2',$Fido2Json),@('scanned fido2',$ScannedFido2Json),@('microsoftAuthenticator',$AuthenticatorJson),@('temporaryAccessPass',$TapJson))){
   if([string]::IsNullOrWhiteSpace($pair[1])){throw "Complete resolved JSON required for $($pair[0])."}
 }
 $f=$Fido2Json|ConvertFrom-Json
 if($null -ne $f.passkeyProfiles -and -not $ProfileOptInApproved){throw 'Passkey profile use requires recorded owner approval when this is the tenant opt-in transition.'}
 # Never overwrite a change made since the scan: every field the update sends must still read as IAMAI scanned it.
 $now=IG GET "$G/fido2";$was=$ScannedFido2Json|ConvertFrom-Json
 foreach($k in @('state','isAttestationEnforced','isSelfServiceRegistrationAllowed','keyRestrictions','includeTargets','excludeTargets')){
   if((ConvertTo-Json -InputObject $now.$k -Depth 20 -Compress) -ne (ConvertTo-Json -InputObject $was.$k -Depth 20 -Compress)){throw "Passkey (FIDO2) $k changed since the scan. Rescan IAMAI before applying."}
 }
 IG PATCH "$G/fido2" $f|Out-Null
 IG PATCH "$G/microsoftAuthenticator" ($AuthenticatorJson|ConvertFrom-Json)|Out-Null
 IG PATCH "$G/temporaryAccessPass" ($TapJson|ConvertFrom-Json)|Out-Null
}
[pscustomobject]@{Fido2=(IG GET "$G/fido2");MicrosoftAuthenticator=(IG GET "$G/microsoftAuthenticator");TemporaryAccessPass=(IG GET "$G/temporaryAccessPass")}
@@IAMAI-END

@@IAMAI-BEGIN {"id":"ai.decision","channel":"aiInfo","states":["needsDecision"],"format":"markdown","kind":"template"}
**Contains tenant context. Review before sharing with an external AI service.**

Explain the irreversible passkey-profile opt-in to the owner using current tenant summary {{passkey.current.summary}}. Do not turn Microsoft's current recommendation into an owner decision.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"ai.apply","channel":"aiInfo","states":["missingOrPartial"],"format":"markdown","kind":"template"}
**Contains tenant context. Review before sharing with an external AI service.**

Enable Microsoft Authenticator passkeys while preserving the tenant's existing approved hardware-key access and profile assignments. Review any conflicting restrictions before saving. A registered key is not automatically approved, and configuration checks do not replace an emergency sign-in test.

Settings IAMAI read: {{passkey.current.summary}} [omit this line when unavailable]

Resolved change: {{passkey.target.summary}} [omit this line when unavailable]

{{passkey.review.detail}} [omit this line when unavailable]

Explain which existing allowed models the change retains, which Microsoft Authenticator models it adds, and any restriction that conflicts. Existing allowed models are retained configuration, not proof that every registered key was approved. A key restriction applies at sign-in as well as registration; attestation applies to new registrations. Temporary Access Pass settings are not part of IAMAI's resolved change. Do not suggest converting an unrestricted policy into an allow list, opting in to passkey profiles, or enabling synced passkeys.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"ai.verify","channel":"aiInfo","states":["verificationRequired"],"format":"markdown","kind":"template"}
**Contains tenant context. Review before sharing with an external AI service.**

Compare the read-back Passkey (FIDO2) settings with the resolved change: existing allowed models, groups and exclusions retained, and Microsoft Authenticator allowed. A matching configuration does not show that anyone can sign in; the registration campaign and an emergency access sign-in test provide that evidence.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"ai.blocked","channel":"aiInfo","states":["blocked"],"format":"markdown","kind":"template"}
**Contains tenant context. Review before sharing with an external AI service.**

Explain why authentication-method policy configuration cannot proceed: {{dependencies.blockers}}.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"readiness.model","channel":"readiness","states":["needsDecision","missingOrPartial","verificationRequired"],"format":"json-template","kind":"referenceOnly"}
{"tiles":[{"id":"current","label":"Passkey policy","result":"{{passkey.current.summary}}","line":"Configuration comes from the tenant's latest scan."},{"id":"profiles","label":"Passkey profiles","result":"{{passkey.target.profileSummary}}","line":"IAMAI does not read passkey profile settings. A profile-based policy is reviewed in the Entra admin center, never overwritten."},{"id":"aaguids","label":"Allowed passkey models","result":"{{passkey.target.allowedAaguids}}","line":"Existing allowed models are retained; removing one stops its keys from signing in."}],"whyIamaiSaysThis":"Authentication-method policy must enable the methods later Conditional Access steps require, but configuration is not the same as proven user readiness."}
@@IAMAI-END

@@IAMAI-BEGIN {"id":"troubleshooting.model","channel":"troubleshooting","states":["needsDecision","missingOrPartial","verificationRequired","inPlace"],"format":"json","kind":"referenceOnly"}
{"scenarios":[{"id":"profile-opt-in-unapproved","classification":"documented","symptom":"The tenant has not enabled passkey profiles and the implementation would opt in.","check":"Confirm whether an owner approved the irreversible transition.","fix":"Do not opt in until approved; keep the step in Needs decision.","then":"Record the decision and render the appropriate implementation.","sources":["ms-passkey"]},{"id":"key-stops-working","classification":"documented","symptom":"An existing FIDO2/passkey credential stops authenticating after key restrictions change.","check":"Compare its AAGUID with the allowed profile AAGUIDs.","fix":"Restore the missing approved AAGUID to the correct profile; do not disable restrictions tenant-wide.","then":"Test that exact credential and rescan.","sources":["ms-passkey"]},{"id":"synced-attestation-conflict","classification":"documented","symptom":"A synced passkey cannot satisfy the configured attestation requirement.","check":"Check the profile passkey type and attestation settings.","fix":"Use a resolved profile appropriate to the approved passkey type; do not weaken an attested device-bound profile silently.","then":"Retest registration.","sources":["ms-passkey"]},{"id":"graph-403","classification":"documented","symptom":"Graph rejects an authentication-method policy update.","check":"Verify Policy.ReadWrite.AuthenticationMethod and Authentication Policy Administrator (or equivalent custom role).","fix":"Reconnect with the supported permission/role and retry only the intended configuration.","then":"Read all three method policies back.","sources":["ms-fido-update","ms-authenticator-update","ms-tap-update"]}]}
@@IAMAI-END

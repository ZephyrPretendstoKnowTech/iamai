@@IAMAI-BEGIN {"id":"entra.profile-decision","channel":"entra","states":["needsDecision"],"format":"markdown","kind":"template"}
Microsoft now uses **passkey profiles** under **Entra ID > Security > Authentication methods > Policies > Passkey (FIDO2)**. If this tenant has not opted in, show the owner the current configuration and record approval before selecting the profile opt-in banner. Microsoft states that once enabled, passkey profiles cannot be disabled again.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"entra.configure-fido2","channel":"entra","states":["missingOrPartial"],"format":"markdown","kind":"template"}
1. Go to **Entra ID > Security > Authentication methods > Policies > Passkey (FIDO2)**.
2. If profiles are not enabled, proceed only when `passkey.profileOptInApproved` is true.
3. Apply IAMAI's resolved FIDO2/passkey target exactly: {{passkey.target.profileSummary}}.
4. Confirm every required existing/approved AAGUID remains present: {{passkey.target.allowedAaguids}}.
5. Save. Do not add synced passkeys unless they are part of the resolved target.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"entra.configure-authenticator","channel":"entra","states":["missingOrPartial"],"format":"markdown","kind":"template"}
Open **Microsoft Authenticator** in Authentication methods and apply IAMAI's resolved target configuration. Preserve its exact include/exclude targets; this step does not infer them.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"entra.configure-tap","channel":"entra","states":["missingOrPartial"],"format":"markdown","kind":"template"}
Open **Temporary Access Pass** in Authentication methods and apply IAMAI's resolved target configuration, including target population, lifetime bounds/default, and one-time behavior.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"entra.verify","channel":"entra","states":["verificationRequired"],"format":"markdown","kind":"template"}
Re-open Passkey (FIDO2), Microsoft Authenticator, and Temporary Access Pass. Compare the full configuration to IAMAI's canonical target, then rescan. Registration/sign-in proof occurs in later human/campaign steps.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"json.fido2","channel":"json","states":["missingOrPartial"],"format":"json-template","kind":"template"}
{{json:passkey.target.fido2Configuration}}
@@IAMAI-END

@@IAMAI-BEGIN {"id":"json.authenticator","channel":"json","states":["missingOrPartial"],"format":"json-template","kind":"template"}
{{json:authenticator.target.configuration}}
@@IAMAI-END

@@IAMAI-BEGIN {"id":"json.tap","channel":"json","states":["missingOrPartial"],"format":"json-template","kind":"template"}
{{json:tap.target.configuration}}
@@IAMAI-END

@@IAMAI-BEGIN {"id":"powershell.run","channel":"powershell","states":["missingOrPartial","verificationRequired"],"format":"powershell","kind":"template"}
param([Parameter(Mandatory=$true)][ValidateSet('Apply','Verify')][string]$Mode,[string]$Fido2Json,[string]$AuthenticatorJson,[string]$TapJson,[switch]$ProfileOptInApproved)
$ErrorActionPreference='Stop';$G='https://graph.microsoft.com/v1.0/policies/authenticationMethodsPolicy/authenticationMethodConfigurations'
function IG($m,$u,$b=$null){if($null -eq $b){return Invoke-MgGraphRequest -Method $m -Uri $u -OutputType PSObject};Invoke-MgGraphRequest -Method $m -Uri $u -Body ($b|ConvertTo-Json -Depth 50) -ContentType 'application/json' -OutputType PSObject}
if($Mode -eq 'Apply'){
 foreach($pair in @(@('fido2',$Fido2Json),@('microsoftAuthenticator',$AuthenticatorJson),@('temporaryAccessPass',$TapJson))){
   if([string]::IsNullOrWhiteSpace($pair[1])){throw "Complete resolved JSON required for $($pair[0])."}
 }
 $f=$Fido2Json|ConvertFrom-Json
 if($null -ne $f.passkeyProfiles -and -not $ProfileOptInApproved){throw 'Passkey profile use requires recorded owner approval when this is the tenant opt-in transition.'}
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

Compare the current tenant configuration with the resolved passkey/Auth/TAP target. Verify the AAGUID list preserves approved registered hardware: {{passkey.current.registeredAaguids}}.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"ai.verify","channel":"aiInfo","states":["verificationRequired"],"format":"markdown","kind":"template"}
**Contains tenant context. Review before sharing with an external AI service.**

Check the read-back configuration for drift. Do not claim readiness for a person until registration/sign-in proof exists.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"ai.blocked","channel":"aiInfo","states":["blocked"],"format":"markdown","kind":"template"}
**Contains tenant context. Review before sharing with an external AI service.**

Explain why authentication-method policy configuration cannot proceed: {{dependencies.blockers}}.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"readiness.model","channel":"readiness","states":["needsDecision","missingOrPartial","verificationRequired"],"format":"json-template","kind":"referenceOnly"}
{"tiles":[{"id":"current","label":"Passkey policy","result":"{{passkey.current.summary}}","line":"Configuration truth comes from the tenant."},{"id":"profiles","label":"Target passkey profile","result":"{{passkey.target.profileSummary}}","line":"Profile opt-in is irreversible when not already enabled."},{"id":"aaguids","label":"Approved AAGUIDs","result":"{{passkey.target.allowedAaguids}}","line":"Removing an allowed authenticator can stop existing keys from signing in."}],"whyIamaiSaysThis":"Authentication-method policy must enable the methods later Conditional Access steps require, but configuration is not the same as proven user readiness."}
@@IAMAI-END

@@IAMAI-BEGIN {"id":"troubleshooting.model","channel":"troubleshooting","states":["needsDecision","missingOrPartial","verificationRequired","inPlace"],"format":"json","kind":"referenceOnly"}
{"scenarios":[{"id":"profile-opt-in-unapproved","classification":"documented","symptom":"The tenant has not enabled passkey profiles and the implementation would opt in.","check":"Confirm whether an owner approved the irreversible transition.","fix":"Do not opt in until approved; keep the step in Needs decision.","then":"Record the decision and render the appropriate implementation.","sources":["ms-passkey"]},{"id":"key-stops-working","classification":"documented","symptom":"An existing FIDO2/passkey credential stops authenticating after key restrictions change.","check":"Compare its AAGUID with the allowed profile AAGUIDs.","fix":"Restore the missing approved AAGUID to the correct profile; do not disable restrictions tenant-wide.","then":"Test that exact credential and rescan.","sources":["ms-passkey"]},{"id":"synced-attestation-conflict","classification":"documented","symptom":"A synced passkey cannot satisfy the configured attestation requirement.","check":"Check the profile passkey type and attestation settings.","fix":"Use a resolved profile appropriate to the approved passkey type; do not weaken an attested device-bound profile silently.","then":"Retest registration.","sources":["ms-passkey"]},{"id":"graph-403","classification":"documented","symptom":"Graph rejects an authentication-method policy update.","check":"Verify Policy.ReadWrite.AuthenticationMethod and Authentication Policy Administrator (or equivalent custom role).","fix":"Reconnect with the supported permission/role and retry only the intended configuration.","then":"Read all three method policies back.","sources":["ms-fido-update","ms-authenticator-update","ms-tap-update"]}]}
@@IAMAI-END

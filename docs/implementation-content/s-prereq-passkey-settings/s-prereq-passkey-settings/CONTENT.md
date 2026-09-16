@@IAMAI-BEGIN {"id":"entra.profile-decision","channel":"entra","states":["needsDecision"],"format":"markdown","kind":"template"}
Microsoft now uses **passkey profiles** under **Entra ID > Security > Authentication methods > Policies > Passkey (FIDO2)**. If this tenant has not opted in, show the owner the current configuration and record approval before selecting the profile opt-in banner. Microsoft states that once enabled, passkey profiles cannot be disabled again.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"entra.configure-fido2","channel":"entra","states":["missing","partial","needsDecision","blocked"],"format":"markdown","kind":"template"}
1. Open Entra admin center → Entra ID → Security → Authentication methods → Policies → Passkey (FIDO2).
2. Before tightening restrictions, check Prepare Emergency Access Accounts for incompatible keys. Register and test an approved replacement while existing access still works; keep the old method until the replacement succeeds.
3. Enable the method for the intended users. Keep the existing target groups and exclusions. Under Configure, enable self-service setup.
4. If profiles are already enabled, open each applicable profile under Configure. Select device-bound passkeys, require attestation, enable key restrictions and choose Allow. For legacy settings, set attestation and key restrictions on the Configure tab, with Allow as the restriction type.
5. Add the model IDs below to that allowed AAGUID list. They are IAMAI defaults, not a hardware-brand requirement specified by Jon's imported baseline.

{{passkey.target.modelList}}

6. An AAGUID identifies a model family, not an individual key. Other versions of the same brand can have different IDs. Keep existing approved recovery models; additional models are a tenant customization of IAMAI's defaults. Find a registered key's AAGUID in the user's Authentication methods details, or verify it against the manufacturer's information and Microsoft's hardware catalog.
7. For profiles, check Enable and Target to confirm assignments. A user can use any applicable profile, so check that another assigned profile does not permit an unintended authenticator.
8. Save, reopen the settings and scan again. Complete the account-specific sign-in and recovery check in Verify Emergency Access.

Settings read: {{passkey.current.summary}} [omit this line when unavailable]
Resolved change: {{passkey.target.summary}} [omit this line when unavailable]
{{passkey.review.detail}} [omit this line when unavailable]
@@IAMAI-END

@@IAMAI-BEGIN {"id":"entra.configure-authenticator","channel":"entra","states":["missing","partial"],"format":"markdown","kind":"template"}
Then check the supporting methods:

6. Open Microsoft Authenticator in the same Authentication methods list.
7. Set Enable to Yes. Target: All users, keeping any existing exclusions.
8. Save.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"entra.configure-tap","channel":"entra","states":["missing","partial"],"format":"markdown","kind":"template"}
9. Open Temporary Access Pass in the same list.
10. Set Enable to Yes for the people who may need a pass to register their first passkey. IAMAI holds no Temporary Access Pass target, so keep the tenant's current lifetime and one-time-use settings unless your security team has approved different values.
11. Save.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"entra.verify","channel":"entra","states":["inPlace"],"format":"markdown","kind":"template"}
Reopen Passkey (FIDO2) and compare its settings and applicable profiles with the intended configuration. Scan again to verify the settings. Complete the account-specific sign-in and recovery check in Verify Emergency Access.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"json.fido2","channel":"json","states":["missing","partial"],"format":"json-template","kind":"template","method":"PATCH","endpoint":"https://graph.microsoft.com/v1.0/policies/authenticationMethodsPolicy/authenticationMethodConfigurations/fido2"}
{{json:passkey.target.fido2Configuration}}
@@IAMAI-END

@@IAMAI-BEGIN {"id":"json.authenticator","channel":"json","states":["missing","partial"],"format":"json-template","kind":"template"}
{{json:authenticator.target.configuration}}
@@IAMAI-END

@@IAMAI-BEGIN {"id":"json.tap","channel":"json","states":["missing","partial"],"format":"json-template","kind":"template"}
{{json:tap.target.configuration}}
@@IAMAI-END

@@IAMAI-BEGIN {"id":"powershell.run","channel":"powershell","states":["missing","partial","inPlace"],"format":"powershell","kind":"deployableAfterBinding","invocation":{"modeParameter":"Mode","parameters":{"Fido2Json":{"binding":"passkey.target.fido2Configuration","modes":["Apply"]},"ScannedFido2Json":{"binding":"passkey.current.fido2Configuration","modes":["Apply"]}}}}
param([Parameter(Mandatory=$true)][ValidateSet('Apply','Verify')][string]$Mode,[string]$Fido2Json,[string]$ScannedFido2Json)
$ErrorActionPreference='Stop'
$uri='https://graph.microsoft.com/v1.0/policies/authenticationMethodsPolicy/authenticationMethodConfigurations/fido2'
$now=Invoke-MgGraphRequest -Method GET -Uri $uri -OutputType PSObject
if($Mode -eq 'Apply'){
 if([string]::IsNullOrWhiteSpace($Fido2Json) -or [string]::IsNullOrWhiteSpace($ScannedFido2Json)){throw 'The target and scanned FIDO2 settings are required.'}
 $target=$Fido2Json|ConvertFrom-Json
 $scanned=$ScannedFido2Json|ConvertFrom-Json
 foreach($property in $target.PSObject.Properties){
  $key=$property.Name
  if($key -in @('id','@odata.type')){continue}
  if((ConvertTo-Json -InputObject $now.$key -Depth 30 -Compress) -ne (ConvertTo-Json -InputObject $scanned.$key -Depth 30 -Compress)){throw "Passkey setting $key changed since the scan. Scan again before applying."}
 }
 Invoke-MgGraphRequest -Method PATCH -Uri $uri -Body ($target|ConvertTo-Json -Depth 40) -ContentType 'application/json' | Out-Null
}
Invoke-MgGraphRequest -Method GET -Uri $uri -OutputType PSObject | ConvertTo-Json -Depth 40
@@IAMAI-END

@@IAMAI-BEGIN {"id":"ai.decision","channel":"aiInfo","states":["needsDecision"],"format":"markdown","kind":"template"}

Explain the irreversible passkey-profile opt-in to the owner using current tenant summary {{passkey.current.summary}}. Do not turn Microsoft's current recommendation into an owner decision.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"ai.apply","channel":"aiInfo","states":["missing","partial"],"format":"markdown","kind":"template"}
Explain the concrete Passkey (FIDO2) findings and how to configure attested device-bound passkeys in Microsoft Authenticator or an approved hardware key. Use the actual applicable profiles, assignments, restrictions and existing recovery credentials. Explain Entra registration, attestation and device compliance as different properties. Do not claim the device is Intune-enrolled merely because a passkey is registered.

Settings read: {{passkey.current.summary}} [omit this line when unavailable]
Resolved change: {{passkey.target.summary}} [omit this line when unavailable]
{{passkey.review.detail}} [omit this line when unavailable]
@@IAMAI-END

@@IAMAI-BEGIN {"id":"ai.verify","channel":"aiInfo","states":["inPlace"],"format":"markdown","kind":"template"}
Explain the read-back Passkey (FIDO2) findings and any remaining account-specific compatibility issue. Distinguish a matching method policy from an actual successful recovery sign-in.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"ai.blocked","channel":"aiInfo","states":["blocked"],"format":"markdown","kind":"template"}

Explain why authentication-method policy configuration cannot proceed: {{dependencies.blockers}}.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"readiness.model","channel":"readiness","states":["needsDecision","missing","partial","inPlace"],"format":"json-template","kind":"referenceOnly"}
{"tiles":[]}
@@IAMAI-END

@@IAMAI-BEGIN {"id":"troubleshooting.model","channel":"troubleshooting","states":["needsDecision","missing","partial","inPlace","inPlace"],"format":"json","kind":"referenceOnly"}
{"scenarios":[{"id":"profile-opt-in-unapproved","classification":"documented","symptom":"The tenant has not enabled passkey profiles and the implementation would opt in.","check":"Confirm whether an owner approved the irreversible transition.","fix":"Do not opt in until approved; keep the step in Needs decision.","then":"Record the decision and render the appropriate implementation.","sources":["ms-passkey"]},{"id":"key-stops-working","classification":"documented","symptom":"An existing FIDO2/passkey credential stops authenticating after key restrictions change.","check":"Compare its AAGUID with the allowed profile AAGUIDs.","fix":"Restore the missing approved AAGUID to the correct profile; do not disable restrictions tenant-wide.","then":"Test that exact credential and rescan.","sources":["ms-passkey"]},{"id":"synced-attestation-conflict","classification":"documented","symptom":"A synced passkey cannot satisfy the configured attestation requirement.","check":"Check the profile passkey type and attestation settings.","fix":"Use a resolved profile appropriate to the approved passkey type; do not weaken an attested device-bound profile silently.","then":"Retest registration.","sources":["ms-passkey"]},{"id":"graph-403","classification":"documented","symptom":"Graph rejects an authentication-method policy update.","check":"Verify Policy.ReadWrite.AuthenticationMethod and Authentication Policy Administrator (or equivalent custom role).","fix":"Reconnect with the supported permission/role and retry only the intended configuration.","then":"Read the FIDO2 method policy back.","sources":["ms-fido-update","ms-authenticator-update","ms-tap-update"]}]}
@@IAMAI-END

@@IAMAI-BEGIN {"id":"entra.create","channel":"entra","states":["missing"],"format":"markdown","kind":"template"}
1. Go to **Entra admin center → Entra ID → Conditional Access → Named locations → + Countries location**.
2. Name it **{{location.target.displayName}}**.
3. Use **Determine location by IP address**.
4. Select exactly the owner-approved countries supplied by IAMAI.
5. Leave **Include unknown countries/regions** off.
6. Create the location, then rescan IAMAI so its stable ID becomes tenant truth.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"entra.correct.open","channel":"entra","states":["partial"],"format":"markdown","kind":"template"}
Open the exact IAMAI-resolved named location by stable ID **{{location.current.id}}**. Correct only the reported mismatch.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"entra.correct.countries","channel":"entra","states":["partial"],"format":"markdown","kind":"template"}
Replace the country selection with the exact owner-approved set. Do not preserve extra countries merely because they appeared in historical sign-ins.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"entra.correct.unknown","channel":"entra","states":["partial"],"format":"markdown","kind":"template"}
Turn **Include unknown countries/regions** off. Unknown mapping must remain outside the approved-country list.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"entra.correct.name","channel":"entra","states":["partial"],"format":"markdown","kind":"template"}
Rename the same stable named-location object to **{{location.target.displayName}}**. Do not create a duplicate solely for naming.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"entra.correct.lookup","channel":"entra","states":["partial"],"format":"markdown","kind":"template"}
The selected location does not use IAMAI's canonical IP-based country lookup. Current Graph v1.0 update documentation does not list `countryLookupMethod` as writable. Do not invent an API patch or delete a referenced object. Resolve a safe replacement/migration plan, update downstream references deliberately, then rescan.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"entra.verify","channel":"entra","states":["partial","verificationRequired"],"format":"markdown","kind":"template"}
Verify the exact stable location is a Countries location, contains exactly the approved country set, determines country by IP address, and does not include unknown countries/regions. Then rescan IAMAI.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"json.create","channel":"json","states":["missing"],"format":"json-template","kind":"template"}
{"@odata.type":"#microsoft.graph.countryNamedLocation","displayName":{{json:location.target.displayName}},"countriesAndRegions":{{json:location.target.countryCodes}},"countryLookupMethod":"clientIpAddress","includeUnknownCountriesAndRegions":false}
@@IAMAI-END

@@IAMAI-BEGIN {"id":"json.patch","channel":"json","states":["partial"],"format":"json-template","kind":"template"}
{"@odata.type":"#microsoft.graph.countryNamedLocation","displayName":{{json:location.target.displayName}},"countriesAndRegions":{{json:location.target.countryCodes}},"includeUnknownCountriesAndRegions":false}
@@IAMAI-END

@@IAMAI-BEGIN {"id":"powershell.run","channel":"powershell","states":["missing","partial","verificationRequired"],"format":"powershell","kind":"template"}
param(
 [Parameter(Mandatory=$true)][ValidateSet('Create','Correct','Verify')][string]$Mode,
 [Parameter(Mandatory=$true)][string]$DisplayName,
 [Parameter(Mandatory=$true)][string[]]$CountryCodes,
 [Parameter(Mandatory=$false)][string]$LocationId
)
$ErrorActionPreference='Stop'; $Graph='https://graph.microsoft.com/v1.0'
function Assert-Guid([string]$v,[string]$n){$g=[guid]::Empty;if(-not [guid]::TryParse($v,[ref]$g)){throw "$n must be a GUID."}}
function IG([string]$m,[string]$u,$b=$null){if($null -eq $b){return Invoke-MgGraphRequest -Method $m -Uri $u -OutputType PSObject};Invoke-MgGraphRequest -Method $m -Uri $u -Body ($b|ConvertTo-Json -Depth 20) -ContentType 'application/json' -OutputType PSObject}
$codes=@($CountryCodes|ForEach-Object{$_.Trim().ToUpperInvariant()}|Sort-Object -Unique)
if($codes.Count -eq 0 -or @($codes|Where-Object{$_ -notmatch '^[A-Z]{2}$'}).Count){throw 'CountryCodes must be non-empty two-letter codes.'}
$body=@{'@odata.type'='#microsoft.graph.countryNamedLocation';displayName=$DisplayName;countriesAndRegions=$codes;includeUnknownCountriesAndRegions=$false}
switch($Mode){
 'Create' {
   $all=IG GET "$Graph/identity/conditionalAccess/namedLocations"
   if(@($all.value|Where-Object{$_.displayName -eq $DisplayName}).Count){throw 'A named location with this display name already exists. Resolve stable identity; do not duplicate.'}
   $create=$body.Clone(); $create.countryLookupMethod='clientIpAddress'
   $created=IG POST "$Graph/identity/conditionalAccess/namedLocations" $create
   [pscustomobject]@{CreatedId=$created.id;NextSafeAction='Rescan IAMAI before downstream policy work.'}
 }
 'Correct' {
   Assert-Guid $LocationId 'LocationId'
   $cur=IG GET "$Graph/identity/conditionalAccess/namedLocations/$LocationId"
   if($cur.'@odata.type' -ne '#microsoft.graph.countryNamedLocation'){throw 'Stable ID is not a countryNamedLocation.'}
   if($cur.countryLookupMethod -ne 'clientIpAddress'){throw 'Lookup-method mismatch is not corrected by this v1.0 patch. Resolve replacement/migration first.'}
   IG PATCH "$Graph/identity/conditionalAccess/namedLocations/$LocationId" $body | Out-Null
 }
 'Verify' {
   Assert-Guid $LocationId 'LocationId'
   $cur=IG GET "$Graph/identity/conditionalAccess/namedLocations/$LocationId"
   if($cur.'@odata.type' -ne '#microsoft.graph.countryNamedLocation'){throw 'Wrong named-location type.'}
   if($cur.countryLookupMethod -ne 'clientIpAddress'){throw 'Wrong country lookup method.'}
   if($cur.includeUnknownCountriesAndRegions -ne $false){throw 'Unknown countries are included.'}
   $actual=@($cur.countriesAndRegions|Sort-Object -Unique)
   if(Compare-Object $codes $actual){throw 'Country set does not match the approved target.'}
   $cur
 }
}
@@IAMAI-END

@@IAMAI-BEGIN {"id":"ai.decision","channel":"aiInfo","states":["needsDecision"],"format":"markdown","kind":"template"}
**Contains tenant context. Review before sharing with an external AI service.**

Help review the country decision for {{tenant.displayName}}. Observed sign-in countries: {{evidence.signInCountries}}. Do not convert observation into approval. Identify missing travel/remote-work context and keep the action blocked until the owner-approved country set is explicit.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"ai.create","channel":"aiInfo","states":["missing"],"format":"markdown","kind":"template"}
**Contains tenant context. Review before sharing with an external AI service.**

Review creation of one IP-based country named location called {{location.target.displayName}} using the explicit owner-approved country set. Unknown countries remain excluded. Require a rescan after creation so the stable ID is used downstream.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"ai.correct","channel":"aiInfo","states":["partial"],"format":"markdown","kind":"template"}
**Contains tenant context. Review before sharing with an external AI service.**

Compare stable location {{location.current.id}} with the canonical target. Correct only name/country/unknown-country mismatches that are safely writable. If `countryLookupMethod` is not `clientIpAddress`, flag migration review rather than inventing a v1.0 PATCH.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"ai.verify","channel":"aiInfo","states":["verificationRequired"],"format":"markdown","kind":"template"}
**Contains tenant context. Review before sharing with an external AI service.**

Verify exact country set, stable ID, IP lookup, and unknown-country behavior before the geographic policy consumes this object.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"ai.blocked","channel":"aiInfo","states":["blocked"],"format":"markdown","kind":"template"}
**Contains tenant context. Review before sharing with an external AI service.**

Explain the unresolved prerequisite: {{dependencies.blockers}}. Do not create a country location from observed sign-ins alone.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"email.users.travel-confirmation","channel":"email","states":["needsDecision"],"format":"markdown","kind":"template","audience":"client-contact"}
Subject: Confirm countries where staff need to sign in

We are preparing the approved-country list used by the tenant's geographic sign-in controls. Please confirm every country where staff legitimately work or travel. Historical sign-ins are being used only as review evidence; they will not automatically add a country. Temporary travel should follow the agreed travel-notice process before the downstream blocking policy is enforced.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"readiness.review","channel":"readiness","states":["needsDecision"],"format":"json-template","kind":"referenceOnly"}
{"tiles":[{"id":"observed","label":"Observed countries","result":"{{evidence.signInCountries}}","line":"Observed geography is evidence for review, not automatic approval."},{"id":"decision","label":"Approved country set","result":"not saved","line":"An owner decision is required before IAMAI creates or changes the location."}],"whyIamaiSaysThis":"Geographic blocking cannot safely derive its allow-list from history alone."}
@@IAMAI-END

@@IAMAI-BEGIN {"id":"readiness.model","channel":"readiness","states":["missing","partial","verificationRequired"],"format":"json-template","kind":"referenceOnly"}
{"tiles":[{"id":"decision","label":"Approved countries","result":"{{location.target.countryCodes}}","line":"The saved owner-approved set defines the target."},{"id":"identity","label":"Named location","result":"{{location.current.id}}","line":"Downstream policy references must use one stable object."},{"id":"lookup","label":"Country lookup","result":"{{location.current.lookupMethod}}","line":"IAMAI's canonical location uses client IP."}],"whyIamaiSaysThis":"Geographic blocking is only safe when the allow-list is deliberate and the downstream policy references the exact reviewed object."}
@@IAMAI-END


@@IAMAI-BEGIN {"id":"troubleshooting.model","channel":"troubleshooting","states":["missing","partial","verificationRequired","inPlace"],"format":"json","kind":"referenceOnly"}
{"scenarios":[{"id":"duplicate-name","classification":"derived","symptom":"Create finds a country location with the proposed name.","check":"Resolve whether it is the canonical stable object.","fix":"Do not duplicate; bind the correct stable ID or return to owner resolution.","then":"Correct that object if appropriate.","sources":["ms-location-create"]},{"id":"wrong-lookup","classification":"documented","symptom":"The current country location uses Authenticator GPS instead of client IP.","check":"Read countryLookupMethod.","fix":"Do not invent an update property not documented by the v1.0 update API; plan safe replacement/reference migration.","then":"Rescan after the canonical object is resolved.","sources":["ms-country-resource","ms-country-update"]},{"id":"country-mismatch","classification":"derived","symptom":"The location includes an unapproved country or omits an approved one.","check":"Compare exact ISO country-code sets.","fix":"PATCH the same stable object with the approved set and unknown countries off.","then":"Read back and rescan.","sources":["ms-country-update"]},{"id":"graph-403","classification":"documented","symptom":"Graph returns 403.","check":"Verify Policy.Read.All + Policy.ReadWrite.ConditionalAccess and Security Administrator or Conditional Access Administrator.","fix":"Reconnect with supported authorization.","then":"Retry the same stable object.","sources":["ms-country-update"]}]}
@@IAMAI-END

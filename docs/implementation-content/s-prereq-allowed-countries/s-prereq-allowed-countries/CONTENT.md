@@IAMAI-BEGIN {"id":"entra.create","channel":"entra","states":["missing"],"format":"markdown","kind":"template"}
1. Go to **Entra admin center → Entra ID → Conditional Access → Named locations → + Countries location**.
2. Name it **{{location.target.displayName}}**.
3. Use **Determine location by IP address**. Entra resolves the sign-in's IPv4 or IPv6 address to a country using a mapping table Microsoft updates periodically. The other option, **Determine location by GPS coordinates**, asks each person's Microsoft Authenticator app for a location every hour, and someone who does not share it can be blocked.
4. Select these Work Countries: **{{location.target.countryCodes}}**.
5. Leave **Include unknown countries/regions** off, so an address that maps to no country stays outside this list.
6. There is no trusted mark on a countries location; trust belongs to the IP ranges location Define the Trusted Network creates.
7. Create the location, then rescan IAMAI so the policies that need it can reference its object ID.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"entra.correct.open","channel":"entra","states":["partial"],"format":"markdown","kind":"template"}
Open the named location IAMAI resolved, ID **{{location.current.id}}**. Before changing it, check the Conditional Access policies that use it: a change applies to them as soon as you save, including policies that are already On. Correct only the difference IAMAI reports.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"entra.correct.countries","channel":"entra","states":["partial"],"format":"markdown","kind":"template"}
Set Work Countries to exactly **{{location.target.countryCodes}}**. Recurring travel destinations remain separate.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"entra.correct.unknown","channel":"entra","states":["partial"],"format":"markdown","kind":"template"}
Turn **Include unknown countries/regions** off, so sign-ins whose country cannot be determined stay outside the approved list.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"entra.correct.name","channel":"entra","states":["partial"],"format":"markdown","kind":"template"}
Rename the same named location (same ID) to **{{location.target.displayName}}**. Do not create a duplicate solely for naming.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"entra.correct.lookup","channel":"entra","states":["partial"],"format":"markdown","kind":"template"}
The selected location does not determine country by IP address, which the intended location uses. The Microsoft Graph v1.0 update documentation does not list `countryLookupMethod` as writable, so IAMAI offers no API change for this difference. Do not delete a location that policies still reference. If the lookup method cannot be changed, plan a replacement location that uses IP-based lookup, update the policies that reference the old one, then rescan.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"entra.verify","channel":"entra","states":["partial","verificationRequired"],"format":"markdown","kind":"template"}
Verify that the same named location (same ID) is a Countries location, determines location by IP address, contains exactly the approved countries and does not include unknown countries/regions. Then rescan IAMAI.
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

The allowed-country list for {{tenant.displayName}} is waiting for an owner decision. Countries seen in sign-ins: {{evidence.signInCountries}}. Sign-in history and the operator's current location help the review but do not approve a country. Regular remote work, planned travel and network routes may be missing from this history. The named location is not created or changed until the approved list is saved.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"ai.create","channel":"aiInfo","states":["missing"],"format":"markdown","kind":"template"}

The named location does not exist yet. The planned change creates one Countries named location called {{location.target.displayName}} that determines location by IP address, contains only the approved countries and leaves unknown countries/regions out. A rescan after creation lets the policies that need it reference its object ID.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"ai.correct","channel":"aiInfo","states":["partial"],"format":"markdown","kind":"template"}

Named location {{location.current.id}} exists but differs from the intended settings. Its name, country list and unknown-countries setting can be corrected on the same object. A different lookup method (`countryLookupMethod` other than `clientIpAddress`) is not writable through the Graph v1.0 update, so it needs a replacement location and an update to the policies that reference it. A change to this location applies to every policy that uses it as soon as it is saved, including policies that are already On.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"ai.verify","channel":"aiInfo","states":["verificationRequired"],"format":"markdown","kind":"template"}

This step is waiting to confirm the named location before the country policy uses it: the same ID, exactly the approved countries, IP-based lookup and unknown countries/regions left out.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"ai.blocked","channel":"aiInfo","states":["blocked"],"format":"markdown","kind":"template"}

This prerequisite is blocked. Blockers IAMAI recorded: {{dependencies.blockers}}. Countries observed in sign-ins are not enough to create the location.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"email.users.travel-confirmation","channel":"email","states":["needsDecision"],"format":"markdown","kind":"template","audience":"client-contact"}
Subject: Action needed: Create or Correct Allowed Countries Location

Please confirm the countries where staff need access, including regular remote work and planned travel. We will review sign-in history alongside your answer.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"readiness.review","channel":"readiness","states":["needsDecision"],"format":"json-template","kind":"referenceOnly"}
{"tiles":[{"id":"observed","label":"Observed countries","result":"{{evidence.signInCountries}}","line":"Observed geography is evidence for review, not automatic approval."},{"id":"decision","label":"Approved country set","result":"not saved","line":"An owner decision is required before the location is created or changed."}],"whyIamaiSaysThis":"Geographic blocking cannot safely derive its allow-list from history alone."}
@@IAMAI-END

@@IAMAI-BEGIN {"id":"readiness.model","channel":"readiness","states":["missing","partial","verificationRequired"],"format":"json-template","kind":"referenceOnly"}
{"tiles":[{"id":"decision","label":"Approved countries","result":"{{location.target.countryCodes}}","line":"Use the saved business decision. Sign-in history helps review the list but does not approve a country."},{"id":"identity","label":"Named location","result":"{{location.current.id}}","line":"The country policy must reference this one named location."},{"id":"lookup","label":"Country lookup","result":"{{location.current.lookupMethod}}","line":"The intended location determines country by IP address."}],"whyIamaiSaysThis":"Geographic blocking is only safe when the allow-list is deliberate and the country policy references the reviewed named location."}
@@IAMAI-END


@@IAMAI-BEGIN {"id":"troubleshooting.model","channel":"troubleshooting","states":["missing","partial","verificationRequired","inPlace"],"format":"json","kind":"referenceOnly"}
{"scenarios":[{"id":"duplicate-name","classification":"derived","symptom":"Create finds a country location with the proposed name.","check":"Check whether it is the intended named location.","fix":"Do not duplicate; use the intended location's ID or return to owner review.","then":"Correct that object if appropriate.","sources":["ms-location-create"]},{"id":"wrong-lookup","classification":"documented","symptom":"The current country location uses Authenticator GPS instead of client IP.","check":"Read countryLookupMethod.","fix":"Do not invent an update property not documented by the v1.0 update API; plan a replacement location and update the policies that reference it.","then":"Rescan after the intended location is resolved.","sources":["ms-country-resource","ms-country-update"]},{"id":"country-mismatch","classification":"derived","symptom":"The location includes an unapproved country or omits an approved one.","check":"Compare exact ISO country-code sets.","fix":"PATCH the same named location with the approved set and unknown countries off.","then":"Read back and rescan.","sources":["ms-country-update"]},{"id":"graph-403","classification":"documented","symptom":"Graph returns 403.","check":"Verify Policy.Read.All + Policy.ReadWrite.ConditionalAccess and Security Administrator or Conditional Access Administrator.","fix":"Reconnect with supported authorization.","then":"Retry against the same named location.","sources":["ms-country-update"]}]}
@@IAMAI-END

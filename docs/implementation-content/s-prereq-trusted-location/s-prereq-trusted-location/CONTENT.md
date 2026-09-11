@@IAMAI-BEGIN {"id":"entra.create","channel":"entra","states":["missing"],"format":"markdown","kind":"template"}
1. Go to **Entra admin center → Entra ID → Conditional Access → Named locations → + IP ranges location**.
2. Name it **{{location.target.displayName}}**.
3. Add exactly the owner/network-confirmed public IPv4 and IPv6 CIDRs supplied by IAMAI.
4. Select **Mark as trusted location**.
5. Create it.
6. Rescan IAMAI before downstream policies consume the location ID.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"entra.correct.open","channel":"entra","states":["partial"],"format":"markdown","kind":"template"}
Open stable named-location ID **{{location.current.id}}**. Correct only the mismatch IAMAI reports.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"entra.correct.ranges","channel":"entra","states":["partial"],"format":"markdown","kind":"template"}
Replace the IP-range list with exactly the confirmed target CIDRs. Preserve every confirmed range that should remain; remove only ranges the owner/network evidence says no longer belong.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"entra.correct.trusted","channel":"entra","states":["partial"],"format":"markdown","kind":"template"}
Set **Mark as trusted location** on for this exact object. Do not mark any other named location trusted.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"entra.correct.name","channel":"entra","states":["partial"],"format":"markdown","kind":"template"}
Rename the same stable object to **{{location.target.displayName}}**. Do not create a duplicate.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"entra.verify","channel":"entra","states":["partial","verificationRequired"],"format":"markdown","kind":"template"}
Verify the same stable object is an IP named location, contains exactly the confirmed public CIDRs, and is marked trusted. Rescan IAMAI; if expected sign-ins do not match, investigate egress reality rather than widening the range.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"json.create","channel":"json","states":["missing"],"format":"json-template","kind":"template"}
{"@odata.type":"#microsoft.graph.ipNamedLocation","displayName":{{json:location.target.displayName}},"isTrusted":true,"ipRanges":{{json:location.target.ipRanges}}}
@@IAMAI-END

@@IAMAI-BEGIN {"id":"json.patch","channel":"json","states":["partial"],"format":"json-template","kind":"template"}
{"@odata.type":"#microsoft.graph.ipNamedLocation","displayName":{{json:location.target.displayName}},"isTrusted":true,"ipRanges":{{json:location.target.ipRanges}}}
@@IAMAI-END

@@IAMAI-BEGIN {"id":"powershell.run","channel":"powershell","states":["missing","partial","verificationRequired"],"format":"powershell","kind":"template"}
param(
 [Parameter(Mandatory=$true)][ValidateSet('Create','Correct','Verify')][string]$Mode,
 [Parameter(Mandatory=$true)][string]$DisplayName,
 [Parameter(Mandatory=$true)][string]$IpRangesJson,
 [Parameter(Mandatory=$false)][string]$LocationId
)
$ErrorActionPreference='Stop';$Graph='https://graph.microsoft.com/v1.0'
function Assert-Guid([string]$v,[string]$n){$g=[guid]::Empty;if(-not [guid]::TryParse($v,[ref]$g)){throw "$n must be a GUID."}}
function IG([string]$m,[string]$u,$b=$null){if($null -eq $b){return Invoke-MgGraphRequest -Method $m -Uri $u -OutputType PSObject};Invoke-MgGraphRequest -Method $m -Uri $u -Body ($b|ConvertTo-Json -Depth 30) -ContentType 'application/json' -OutputType PSObject}
$ranges=@(ConvertFrom-Json $IpRangesJson)
if($ranges.Count -eq 0){throw 'At least one confirmed public CIDR is required.'}
foreach($r in $ranges){if(-not $r.'@odata.type' -or -not $r.cidrAddress){throw 'Each range needs @odata.type and cidrAddress.'};if($r.cidrAddress -eq '0.0.0.0/0'){throw '0.0.0.0/0 is never accepted by IAMAI.'}}
$body=@{'@odata.type'='#microsoft.graph.ipNamedLocation';displayName=$DisplayName;isTrusted=$true;ipRanges=$ranges}
switch($Mode){
 'Create' {
   $all=IG GET "$Graph/identity/conditionalAccess/namedLocations"
   if(@($all.value|Where-Object{$_.displayName -eq $DisplayName}).Count){throw 'Named location already exists by display name. Resolve stable identity; do not duplicate.'}
   $created=IG POST "$Graph/identity/conditionalAccess/namedLocations" $body
   [pscustomobject]@{CreatedId=$created.id;NextSafeAction='Rescan IAMAI before downstream policy work.'}
 }
 'Correct' {
   Assert-Guid $LocationId 'LocationId'
   $cur=IG GET "$Graph/identity/conditionalAccess/namedLocations/$LocationId"
   if($cur.'@odata.type' -ne '#microsoft.graph.ipNamedLocation'){throw 'Stable ID is not an ipNamedLocation.'}
   IG PATCH "$Graph/identity/conditionalAccess/namedLocations/$LocationId" $body | Out-Null
 }
 'Verify' {
   Assert-Guid $LocationId 'LocationId'
   $cur=IG GET "$Graph/identity/conditionalAccess/namedLocations/$LocationId"
   if($cur.'@odata.type' -ne '#microsoft.graph.ipNamedLocation'){throw 'Wrong named-location type.'}
   if($cur.isTrusted -ne $true){throw 'Location is not marked trusted.'}
   $want=@($ranges|ForEach-Object{$_.cidrAddress}|Sort-Object -Unique)
   $have=@($cur.ipRanges|ForEach-Object{$_.cidrAddress}|Sort-Object -Unique)
   if(Compare-Object $want $have){throw 'IP range set does not match target.'}
   $cur
 }
}
@@IAMAI-END

@@IAMAI-BEGIN {"id":"ai.decision","channel":"aiInfo","states":["needsDecision"],"format":"markdown","kind":"template"}
**Contains tenant context. Review before sharing with an external AI service.**

Review trusted-network evidence for {{tenant.displayName}}. Observed sign-in IP summary: {{evidence.signInIpSummary}}. Treat it only as evidence. Identify which public egress CIDRs still need network-owner confirmation and do not propose broader ranges.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"ai.not-applicable","channel":"aiInfo","states":["notApplicable"],"format":"markdown","kind":"template"}
**Contains tenant context. Review before sharing with an external AI service.**

The owner has stated there is no office/VPN network that should be treated as trusted. Confirm downstream policies therefore should not depend on an invented location; do not create one from historical IPs.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"ai.create","channel":"aiInfo","states":["missing"],"format":"markdown","kind":"template"}
**Contains tenant context. Review before sharing with an external AI service.**

Review creation of {{location.target.displayName}} from the confirmed public CIDRs only. It must be an IP named location with `isTrusted=true`; require a rescan for the new stable ID.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"ai.correct","channel":"aiInfo","states":["partial"],"format":"markdown","kind":"template"}
**Contains tenant context. Review before sharing with an external AI service.**

Compare {{location.current.id}} to the confirmed target. Correct only name/ranges/trusted status. Because Graph replaces the `ipRanges` collection, ensure every range that must remain is present in the submitted set.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"ai.verify","channel":"aiInfo","states":["verificationRequired"],"format":"markdown","kind":"template"}
**Contains tenant context. Review before sharing with an external AI service.**

Verify stable ID, exact CIDR set and trusted flag. If sign-in evidence no longer matches, investigate public egress changes rather than widening trust.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"ai.blocked","channel":"aiInfo","states":["blocked"],"format":"markdown","kind":"template"}
**Contains tenant context. Review before sharing with an external AI service.**

Explain the unresolved trusted-network prerequisite: {{dependencies.blockers}}. Never guess public ranges.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"email.network.confirm","channel":"email","states":["needsDecision"],"format":"markdown","kind":"template"}
Subject: Confirm public network ranges for Conditional Access

Please confirm the public IPv4/IPv6 CIDR ranges that represent the office or VPN exits we are allowed to treat as trusted. Do not send private LAN ranges such as 10.x/172.16–31.x/192.168.x. If the public address is dynamic, note that as well so we do not create a trust boundary that silently goes stale.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"readiness.review","channel":"readiness","states":["needsDecision"],"format":"json-template","kind":"referenceOnly"}
{"tiles":[{"id":"observed","label":"Observed sign-in IPs","result":"{{evidence.signInIpSummary}}","line":"Observed addresses are evidence only."},{"id":"decision","label":"Confirmed public CIDRs","result":"not saved","line":"Network-owner confirmation is required before anything is trusted."}],"whyIamaiSaysThis":"A trusted network is a security boundary; IAMAI must not infer it from traffic."}
@@IAMAI-END

@@IAMAI-BEGIN {"id":"readiness.model","channel":"readiness","states":["missing","partial","verificationRequired"],"format":"json-template","kind":"referenceOnly"}
{"tiles":[{"id":"ranges","label":"Confirmed public CIDRs","result":"{{location.target.ipRanges}}","line":"Only owner/network-confirmed public egress belongs in trust."},{"id":"identity","label":"Named location","result":"{{location.current.id}}","line":"Downstream policy references must use one stable object."},{"id":"trusted","label":"Trusted flag","result":"{{location.current.isTrusted}}","line":"Trust changes policy and risk interpretation, so it must be explicit."}],"whyIamaiSaysThis":"A trusted network is a security boundary; broad or inferred IP space weakens every policy that consumes it."}
@@IAMAI-END


@@IAMAI-BEGIN {"id":"troubleshooting.model","channel":"troubleshooting","states":["missing","partial","verificationRequired","inPlace"],"format":"json","kind":"referenceOnly"}
{"scenarios":[{"id":"private-ip","classification":"documented","symptom":"A proposed range is a private intranet address rather than public egress.","check":"Compare with the public address Microsoft Entra sees at sign-in.","fix":"Use only the confirmed public egress CIDR.","then":"Rescan evidence after correction.","sources":["ms-network"]},{"id":"range-replaced","classification":"documented","symptom":"An update accidentally drops an existing valid range.","check":"Compare the submitted ipRanges collection with the pre-change and target sets.","fix":"PATCH the same object with the complete intended collection.","then":"Read back exact ranges.","sources":["ms-ip-update"]},{"id":"dynamic-egress","classification":"derived","symptom":"The trusted location stops matching office sign-ins.","check":"Confirm whether the ISP/VPN public egress changed.","fix":"Update to the newly confirmed CIDR; do not broaden to cover guessed future addresses.","then":"Verify sign-in evidence and rescan.","sources":["ms-network"]},{"id":"graph-403","classification":"documented","symptom":"Graph returns 403.","check":"Verify Policy.Read.All + Policy.ReadWrite.ConditionalAccess and Security Administrator or Conditional Access Administrator.","fix":"Reconnect with supported authorization.","then":"Retry the same stable object.","sources":["ms-ip-update"]}]}
@@IAMAI-END

@@IAMAI-BEGIN {"id":"entra.create","channel":"entra","states":["missing"],"format":"markdown","kind":"template"}
1. Open [Microsoft Entra admin center](https://entra.microsoft.com/) → **Entra ID → Conditional Access → Named locations → IP ranges location**.
2. Name: {{location.target.displayName}}.
3. Add {{location.target.ipRangesText}}.
4. Select **Mark as trusted location**.
5. Select **Create**.
6. Return to IAMAI and select **Scan to update the plan**.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"entra.correct.open","channel":"entra","states":["partial"],"format":"markdown","kind":"template"}
Open the named location with ID **{{location.current.id}}**. Correct only the difference IAMAI reports. A change to a trusted location applies to the policies that use it as soon as you save, including policies that are already On.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"entra.correct.ranges","channel":"entra","states":["partial"],"format":"markdown","kind":"template"}
Replace the IP range list with exactly the approved public ranges. Keep every approved range that should remain; remove only ranges the network owner says no longer belong. Do not add a range because it appears in sign-in records.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"entra.correct.trusted","channel":"entra","states":["partial"],"format":"markdown","kind":"template"}
1. Open [Microsoft Entra admin center](https://entra.microsoft.com/) → **Entra ID → Conditional Access**.
2. Open **{{location.correct.displayName}}** in Named locations.
3. Select **Mark as trusted location**, then **Save**.
4. Return to IAMAI and select **Scan to update the plan**.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"entra.correct.name","channel":"entra","states":["partial"],"format":"markdown","kind":"template"}
Rename the same named location (same ID) to **{{location.target.displayName}}**. Do not create a duplicate.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"entra.verify","channel":"entra","states":["partial","verificationRequired"],"format":"markdown","kind":"template"}
Verify that the same named location (same ID) is an IP ranges location, contains exactly the approved public ranges and is marked trusted. Rescan IAMAI.

Verify after the change: an expected sign-in from the approved network matches this location. If it does not, investigate how the network's traffic reaches the internet instead of widening the range.
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

The trusted network for {{tenant.displayName}} is not approved yet. Observed sign-in IP summary: {{evidence.signInIpSummary}}. These addresses are review evidence, not approval: an unrelated office, a VPN or a shared provider address can appear in sign-ins. The network owner needs to confirm the exact public ranges, who controls them and whether they can change. A range broader than the approved ones would extend trust to other networks.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"ai.not-applicable","channel":"aiInfo","states":["notApplicable"],"format":"markdown","kind":"template"}

The owner recorded that no office or VPN network should be treated as trusted. No trusted location is planned for this tenant, and none should be created from historical sign-in addresses.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"ai.create","channel":"aiInfo","states":["missing"],"format":"markdown","kind":"template"}
A trusted location tells Microsoft Entra that sign-ins from these public IP addresses come from a network the organization controls. Some baseline policies apply differently inside a trusted network.

Add only public IPv4 and IPv6 ranges the network owner approves, including VPN exits only where that trust is approved. An address seen in sign-ins is not automatically trusted: an unrelated office, a VPN or a shared provider address can appear there too.

Don't add home IP addresses. They change, and the organization does not control them.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"ai.correct","channel":"aiInfo","states":["partial"],"format":"markdown","kind":"template"}

Named location {{location.current.id}} exists but differs from the intended settings in its name, IP ranges or trusted flag. Graph replaces the whole `ipRanges` collection on update, so the submitted set must include every approved range that should remain. A change applies to the policies that use this location as soon as it is saved.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"ai.verify","channel":"aiInfo","states":["verificationRequired"],"format":"markdown","kind":"template"}

This step is waiting to confirm that the same named location (same ID) contains exactly the approved ranges and is marked trusted. If expected sign-ins no longer match, the network's public address may have changed; the fix is a newly approved range, not a wider one.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"ai.blocked","channel":"aiInfo","states":["blocked"],"format":"markdown","kind":"template"}

The trusted-network prerequisite is blocked. Blockers IAMAI recorded: {{dependencies.blockers}}. Public ranges come only from the network owner's approval.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"email.network.confirm","channel":"email","states":["needsDecision"],"format":"markdown","kind":"template","audience":"network-owner"}
Subject: Action needed: Define the Trusted Network

Please confirm the public IP ranges we may treat as trusted, who controls them, and whether they can change. Include VPN exits only where the organization approves that trust.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"readiness.review","channel":"readiness","states":["needsDecision"],"format":"json-template","kind":"referenceOnly"}
{"tiles":[{"id":"observed","label":"Observed sign-in IPs","result":"{{evidence.signInIpSummary}}","line":"Observed addresses are evidence only."},{"id":"decision","label":"Confirmed public CIDRs","result":"not saved","line":"Network-owner confirmation is required before anything is trusted."}],"whyIamaiSaysThis":"A trusted network is a security boundary; IAMAI must not infer it from traffic."}
@@IAMAI-END

@@IAMAI-BEGIN {"id":"readiness.model","channel":"readiness","states":["missing","partial","verificationRequired"],"format":"json-template","kind":"referenceOnly"}
{"tiles":[{"id":"ranges","label":"Confirmed public CIDRs","result":"{{location.target.ipRanges}}","line":"Use only public IP ranges approved by the network owner. An observed address is not automatically trusted."},{"id":"identity","label":"Named location","result":"{{location.current.id}}","line":"Policies that use the trusted network must reference this one named location."},{"id":"trusted","label":"Trusted flag","result":"{{location.current.isTrusted}}","line":"Trust changes policy and risk interpretation, so it must be explicit."}],"whyIamaiSaysThis":"A trusted network is a security boundary; broad or inferred IP space weakens every policy that uses it."}
@@IAMAI-END


@@IAMAI-BEGIN {"id":"troubleshooting.model","channel":"troubleshooting","states":["missing","partial","verificationRequired","inPlace"],"format":"json","kind":"referenceOnly"}
{"scenarios":[{"id":"private-ip","classification":"documented","symptom":"A proposed range is a private intranet address rather than public egress.","check":"Compare with the public address Microsoft Entra sees at sign-in.","fix":"Use only the confirmed public egress CIDR.","then":"Rescan evidence after correction.","sources":["ms-network"]},{"id":"range-replaced","classification":"documented","symptom":"An update accidentally drops an existing valid range.","check":"Compare the submitted ipRanges collection with the pre-change and target sets.","fix":"PATCH the same object with the complete intended collection.","then":"Read back exact ranges.","sources":["ms-ip-update"]},{"id":"dynamic-egress","classification":"derived","symptom":"The trusted location stops matching office sign-ins.","check":"Confirm whether the ISP/VPN public egress changed.","fix":"Update to the newly confirmed CIDR; do not broaden to cover guessed future addresses.","then":"Verify sign-in evidence and rescan.","sources":["ms-network"]}]}
@@IAMAI-END

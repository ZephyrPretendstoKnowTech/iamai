@@IAMAI-BEGIN {"id":"entra.create","channel":"entra","states":["groupMissing"],"format":"markdown","kind":"template"}
1. Go to **Entra admin center → Entra ID → Groups → All groups → New group**.
2. Group type: **Security**.
3. Membership type: **Assigned**.
4. Name: **{{group.target.displayName}}**.
5. Add exactly the owner-confirmed service-account users supplied by IAMAI.
6. Create the group and rescan IAMAI before downstream policy work.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"entra.correct.open","channel":"entra","states":["partial"],"format":"markdown","kind":"template"}
Open the exact canonical service-accounts group by stable ID **{{group.current.id}}**. Correct only the mismatch IAMAI reports.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"entra.correct.add","channel":"entra","states":["partial"],"format":"markdown","kind":"template"}
Add only the owner-confirmed service-account user IAMAI identifies as missing. Verify stable user ID before saving.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"entra.correct.remove","channel":"entra","states":["partial"],"format":"markdown","kind":"template"}
Remove only the direct member IAMAI explicitly identifies as outside the owner-confirmed service-account set. Do not delete or disable the user.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"entra.correct.type","channel":"entra","states":["partial"],"format":"markdown","kind":"template"}
The selected canonical object is not an assigned, non-mail-enabled security group. Do not silently convert or replace it. Return to canonical identity resolution, create/select the correct group, then rescan before downstream policies reference it.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"entra.verify","channel":"entra","states":["partial","verificationRequired"],"format":"markdown","kind":"template"}
Verify the stable group is an assigned, non-mail-enabled security group and its direct user members exactly match the owner-confirmed set. Then rescan IAMAI.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"json.create","channel":"json","states":["groupMissing"],"format":"json-template","kind":"template"}
{"displayName":{{json:group.target.displayName}},"description":"IAMAI canonical user-based service accounts group","groupTypes":[],"mailEnabled":false,"mailNickname":{{json:group.target.mailNickname}},"securityEnabled":true,"members@odata.bind":{{json:group.target.memberODataBindings}}}
@@IAMAI-END

@@IAMAI-BEGIN {"id":"json.member.add","channel":"json","states":["partial"],"format":"json-template","kind":"template"}
{"@odata.id":"https://graph.microsoft.com/v1.0/directoryObjects/{{group.target.memberId}}"}
@@IAMAI-END

@@IAMAI-BEGIN {"id":"json.member.remove","channel":"json","states":["partial"],"format":"json","kind":"referenceOnly"}
{"method":"DELETE","uri":"/groups/{group-id}/members/{member-id}/$ref","body":null}
@@IAMAI-END

@@IAMAI-BEGIN {"id":"powershell.run","channel":"powershell","states":["groupMissing","partial","verificationRequired"],"format":"powershell","kind":"template"}
param(
 [Parameter(Mandatory=$true)][ValidateSet('CreateGroup','AddMember','RemoveMember','VerifyGroup')][string]$Mode,
 [Parameter(Mandatory=$false)][string]$GroupId,
 [Parameter(Mandatory=$false)][string]$DisplayName,
 [Parameter(Mandatory=$false)][string]$MailNickname,
 [Parameter(Mandatory=$false)][string[]]$DesiredMemberIds=@(),
 [Parameter(Mandatory=$false)][string]$MemberId
)
$ErrorActionPreference='Stop';$Graph='https://graph.microsoft.com/v1.0'
function Assert-Guid([string]$v,[string]$n){$g=[guid]::Empty;if(-not [guid]::TryParse($v,[ref]$g)){throw "$n must be a GUID."}}
function IG([string]$m,[string]$u,$b=$null){if($null -eq $b){return Invoke-MgGraphRequest -Method $m -Uri $u -OutputType PSObject};Invoke-MgGraphRequest -Method $m -Uri $u -Body ($b|ConvertTo-Json -Depth 20) -ContentType 'application/json' -OutputType PSObject}
function Members([string]$gid){$r=IG GET "$Graph/groups/$gid?`$expand=members(`$select=id,displayName,userPrincipalName)";return @($r.members)}
switch($Mode){
 'CreateGroup' {
   if([string]::IsNullOrWhiteSpace($DisplayName)-or [string]::IsNullOrWhiteSpace($MailNickname)){throw 'DisplayName and MailNickname are required.'}
   if($DesiredMemberIds.Count -eq 0){throw 'At least one owner-confirmed service-account user ID is required; otherwise mark the step not applicable.'}
   foreach($id in $DesiredMemberIds){Assert-Guid $id 'DesiredMemberId'}
   $escaped=$DisplayName.Replace("'","''");$f=[uri]::EscapeDataString("displayName eq '$escaped'")
   $existing=IG GET "$Graph/groups?`$filter=$f&`$select=id,displayName"
   if(@($existing.value).Count){throw 'A group with this display name already exists. Resolve stable identity; do not duplicate.'}
   $refs=@($DesiredMemberIds|ForEach-Object{"$Graph/users/$_"})
   $body=@{displayName=$DisplayName;description='IAMAI canonical user-based service accounts group';groupTypes=@();mailEnabled=$false;mailNickname=$MailNickname;securityEnabled=$true;'members@odata.bind'=$refs}
   $created=IG POST "$Graph/groups" $body
   [pscustomobject]@{CreatedGroupId=$created.id;NextSafeAction='Rescan IAMAI before downstream policy changes.'}
 }
 'AddMember' {
   Assert-Guid $GroupId 'GroupId';Assert-Guid $MemberId 'MemberId'
   $body=@{'@odata.id'="$Graph/directoryObjects/$MemberId"}
   try{IG POST "$Graph/groups/$GroupId/members/`$ref" $body|Out-Null}catch{if($_.Exception.Message -notmatch '400'){throw}}
   if($MemberId -notin @(Members $GroupId|ForEach-Object{$_.id})){throw 'Membership add read-back failed; a newly created group may still be replicating.'}
 }
 'RemoveMember' {
   Assert-Guid $GroupId 'GroupId';Assert-Guid $MemberId 'MemberId'
   IG DELETE "$Graph/groups/$GroupId/members/$MemberId/`$ref"|Out-Null
   if($MemberId -in @(Members $GroupId|ForEach-Object{$_.id})){throw 'Membership removal read-back failed.'}
 }
 'VerifyGroup' {
   Assert-Guid $GroupId 'GroupId'
   $g=IG GET "$Graph/groups/$GroupId?`$select=id,displayName,groupTypes,mailEnabled,securityEnabled"
   if($g.mailEnabled -ne $false -or $g.securityEnabled -ne $true -or @($g.groupTypes).Count -ne 0){throw 'Group is not an assigned non-mail-enabled security group.'}
   $have=@(Members $GroupId|ForEach-Object{$_.id}|Sort-Object -Unique)
   $want=@($DesiredMemberIds|Sort-Object -Unique)
   if(Compare-Object $want $have){throw 'Direct membership does not match owner-confirmed target.'}
   [pscustomobject]@{Group=$g;MemberIds=$have}
 }
}
@@IAMAI-END

@@IAMAI-BEGIN {"id":"ai.decision","channel":"aiInfo","states":["needsDecision"],"format":"markdown","kind":"template"}
**Contains tenant context. Review before sharing with an external AI service.**

Review these candidate service accounts for {{tenant.displayName}}: {{service.candidates}}. Do not classify by name alone. Separate human-interactive evidence from unattended workload evidence and identify the application owner confirmation still required.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"ai.not-applicable","channel":"aiInfo","states":["notApplicable"],"format":"markdown","kind":"template"}
**Contains tenant context. Review before sharing with an external AI service.**

The owner has confirmed there are no user-based service accounts requiring this canonical group. Confirm IAMAI should not create an empty exception group merely for symmetry.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"ai.create","channel":"aiInfo","states":["groupMissing"],"format":"markdown","kind":"template"}
**Contains tenant context. Review before sharing with an external AI service.**

Review creation of one assigned security group named {{group.target.displayName}} with only owner-confirmed user-based service accounts. Require a rescan for stable identity before downstream policies consume it.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"ai.correct","channel":"aiInfo","states":["partial"],"format":"markdown","kind":"template"}
**Contains tenant context. Review before sharing with an external AI service.**

Compare current direct members {{group.current.members}} with confirmed service accounts {{service.confirmedAccounts}}. Add/remove only resolved membership references; never delete or disable the underlying users.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"ai.verify","channel":"aiInfo","states":["verificationRequired"],"format":"markdown","kind":"template"}
**Contains tenant context. Review before sharing with an external AI service.**

Verify exact stable group identity and direct user membership. Note any password/ROPC accounts that should later migrate to managed identity or service principal: {{service.migrationNotes}}.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"ai.blocked","channel":"aiInfo","states":["blocked"],"format":"markdown","kind":"template"}
**Contains tenant context. Review before sharing with an external AI service.**

Explain why service-account membership cannot safely proceed: {{dependencies.blockers}}. Candidate detection is not owner confirmation.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"email.owners.confirm","channel":"email","states":["needsDecision"],"format":"markdown","kind":"template","audience":"application-owners"}
Subject: Confirm service accounts before Conditional Access changes

IAMAI found accounts that may be used by unattended applications or services. Please confirm which of these are genuinely non-human accounts and what workload each one runs. Accounts will not be placed into the service-account exception group from naming or sign-in patterns alone. Where possible, note whether the workload can move to a managed identity or service principal.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"readiness.review","channel":"readiness","states":["needsDecision"],"format":"json-template","kind":"referenceOnly"}
{"tiles":[{"id":"candidates","label":"Candidates","result":"{{service.candidates}}","line":"Candidate detection is not membership authority."},{"id":"decision","label":"Confirmed service accounts","result":"not saved","line":"Application/workload owners must confirm non-human use before exclusion membership."}],"whyIamaiSaysThis":"Service-account exceptions are too powerful to derive from account names or sign-in patterns."}
@@IAMAI-END

@@IAMAI-BEGIN {"id":"readiness.model","channel":"readiness","states":["groupMissing","partial","verificationRequired"],"format":"json-template","kind":"referenceOnly"}
{"tiles":[{"id":"decision","label":"Confirmed service accounts","result":"{{service.confirmedAccounts}}","line":"Owner confirmation defines membership."},{"id":"identity","label":"Canonical group","result":"{{group.current.id}}","line":"Downstream policies must reference one stable group."},{"id":"members","label":"Current members","result":"{{group.current.members}}","line":"Direct membership must equal the confirmed set."}],"whyIamaiSaysThis":"Service-account exclusions are high-value bypasses, so candidate heuristics never become membership automatically."}
@@IAMAI-END


@@IAMAI-BEGIN {"id":"troubleshooting.model","channel":"troubleshooting","states":["needsDecision","groupMissing","partial","verificationRequired","inPlace"],"format":"json","kind":"referenceOnly"}
{"scenarios":[{"id":"candidate-not-authority","classification":"derived","symptom":"An account is proposed for the group only because its name starts with svc or it lacks interactive sign-ins.","check":"Find workload owner and confirm no person signs in as that identity.","fix":"Keep it out until owner-confirmed.","then":"Save the decision and rescan.","sources":["ms-service"]},{"id":"new-group-replication","classification":"documented","symptom":"Adding a member to a newly created group returns 400 that the referenced object does not exist.","check":"Confirm the group/user IDs are correct and the group was just created.","fix":"Retry after directory replication; do not create a duplicate group.","then":"Read membership back.","sources":["ms-group-add"]},{"id":"dangerous-delete-shape","classification":"documented","symptom":"A membership removal URI omits `/$ref`.","check":"Inspect the exact request path.","fix":"Use DELETE `/groups/{group-id}/members/{member-id}/$ref`.","then":"Verify the user still exists and only membership changed.","sources":["ms-group-remove"]},{"id":"group-type-wrong","classification":"documented","symptom":"The selected group is dynamic or mail-enabled.","check":"Inspect groupTypes, mailEnabled, securityEnabled.","fix":"Resolve the approved assigned security-group identity; do not silently convert a materially different object.","then":"Rescan before downstream use.","sources":["ms-group-overview"]},{"id":"graph-403","classification":"documented","symptom":"Graph returns 403 for group membership.","check":"Verify GroupMember.ReadWrite.All and a supported group-management role; creation in delegated context uses Group.ReadWrite.All.","fix":"Reconnect with the permissions required for the intended operation.","then":"Retry only the bounded group action.","sources":["ms-group-create","ms-group-add"]}]}
@@IAMAI-END

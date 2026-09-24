@@IAMAI-BEGIN {"id":"entra.create","channel":"entra","states":["groupMissing"],"format":"markdown","kind":"template"}
1. Open [Microsoft Entra admin center](https://entra.microsoft.com/) → **Entra ID → Groups → All groups → New group**.
2. Group type: **Security**.
3. Membership type: **Assigned**.
4. Name: **{{group.target.displayName}}**.
5. Under **Members**, add {{serviceAccounts.memberUpns}}.
6. Select **Create**.
7. Return to IAMAI and select **Scan to update the plan**.
8. Under **Service accounts group**, select **{{group.target.displayName}}**, then **Save**.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"entra.correct.open","channel":"entra","states":["partial"],"format":"markdown","kind":"template"}
Open [Microsoft Entra admin center](https://entra.microsoft.com/) → **Entra ID → Groups → All groups → {{group.current.displayName}} → Members**.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"entra.correct.add","channel":"entra","states":["partial"],"format":"markdown","kind":"template"}
Select **Add members**, add {{serviceAccounts.missingUpns}}, and select **Select**.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"entra.correct.remove","channel":"entra","states":["partial"],"format":"markdown","kind":"template"}
Select {{serviceAccounts.extraUpns}}, then **Remove**.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"entra.correct.type","channel":"entra","states":["partial"],"format":"markdown","kind":"template"}
The selected group is not an assigned, non-mail-enabled security group. Do not convert or replace it without review. Resolve which group is intended, create or select an assigned security group, then rescan before any policy references it.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"entra.verify","channel":"entra","states":["partial","verificationRequired"],"format":"markdown","kind":"template"}
Return to IAMAI and select **Scan to update the plan**.
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

Candidate service accounts for {{tenant.displayName}}: {{service.candidates}}. These are candidates only: a name or sign-in pattern does not confirm that an account runs an unattended job. Each needs its application owner to confirm the workload it supports and that no person signs in with it. This group is for user-based service accounts; service principals and managed identities are separate identities and do not belong in it.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"ai.not-applicable","channel":"aiInfo","states":["notApplicable"],"format":"markdown","kind":"template"}

The owner recorded that no user-based service accounts need this group. No empty exception group is planned.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"ai.create","channel":"aiInfo","states":["groupMissing"],"format":"markdown","kind":"template"}

The service accounts group is one assigned security group holding exactly the service accounts picked in Identify Service and Shared Accounts. The policies that wait on it reference it once it is saved on this step.

{{service.ropcAccount}} signs in with a password from a script: move it to a managed identity or service principal when you can. [omit this line when unavailable]
{{service.ropcAccounts}} sign in with a password from a script: move each to a managed identity or service principal when you can. [omit this line when unavailable]
@@IAMAI-END

@@IAMAI-BEGIN {"id":"ai.correct","channel":"aiInfo","states":["partial"],"format":"markdown","kind":"template"}

The group exists but differs from the intended settings. Current direct members: {{group.current.members}}. Confirmed service accounts: {{service.confirmedAccounts}}. A correction adds or removes group membership only; it does not delete or disable any user. A removed member is no longer excluded by the policies that exclude this group.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"ai.verify","channel":"aiInfo","states":["verificationRequired"],"format":"markdown","kind":"template"}

This step is waiting to confirm that the same group holds exactly the confirmed service-account users as direct members. Notes on password-based (ROPC) accounts that could later move to a managed identity or service principal: {{service.migrationNotes}}. Those moves are later work, not part of this step.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"ai.blocked","channel":"aiInfo","states":["blocked"],"format":"markdown","kind":"template"}

This step is blocked. Blockers IAMAI recorded: {{dependencies.blockers}}. A candidate account is not a confirmed member until its owner confirms it.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"email.owners.confirm","channel":"email","states":["needsDecision"],"format":"markdown","kind":"template","audience":"application-owners"}
Subject: Action needed: Create or Correct Service Accounts Group

Please confirm which listed accounts run unattended jobs, the workload each supports, and its owner. Flag any account also used by a person.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"readiness.review","channel":"readiness","states":["needsDecision"],"format":"json-template","kind":"referenceOnly"}
{"tiles":[{"id":"candidates","label":"Candidates","result":"{{service.candidates}}","line":"A candidate is not a confirmed member."},{"id":"decision","label":"Confirmed service accounts","result":"not saved","line":"Confirm each account's workload and owner before adding it. This group is for user-based service accounts."}],"whyIamaiSaysThis":"Service-account exceptions are too powerful to derive from account names or sign-in patterns."}
@@IAMAI-END

@@IAMAI-BEGIN {"id":"readiness.model","channel":"readiness","states":["groupMissing","partial","verificationRequired"],"format":"json-template","kind":"referenceOnly"}
{"tiles":[{"id":"decision","label":"Confirmed service accounts","result":"{{service.confirmedAccounts}}","line":"Owner confirmation defines membership."},{"id":"identity","label":"Service accounts group","result":"{{group.current.id}}","line":"Policies that exclude service accounts must reference this one group."},{"id":"members","label":"Current members","result":"{{group.current.members}}","line":"Direct membership must equal the confirmed set."}],"whyIamaiSaysThis":"Members of this group are excluded from some policies, so a candidate becomes a member only after its owner confirms it."}
@@IAMAI-END


@@IAMAI-BEGIN {"id":"troubleshooting.model","channel":"troubleshooting","states":["needsDecision","groupMissing","partial","verificationRequired","inPlace"],"format":"json","kind":"referenceOnly"}
{"scenarios":[{"id":"candidate-not-authority","classification":"derived","symptom":"An account is proposed for the group only because its name starts with svc or it lacks interactive sign-ins.","check":"Find workload owner and confirm no person signs in as that identity.","fix":"Keep it out until owner-confirmed.","then":"Save the decision and rescan.","sources":["ms-service"]},{"id":"group-type-wrong","classification":"documented","symptom":"The selected group is dynamic or mail-enabled.","check":"Inspect groupTypes, mailEnabled, securityEnabled.","fix":"Resolve the approved assigned security-group identity; do not silently convert a materially different object.","then":"Rescan before downstream use.","sources":["ms-group-overview"]}]}
@@IAMAI-END

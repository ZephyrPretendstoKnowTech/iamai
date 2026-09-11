@@IAMAI-BEGIN {"id":"entra.create-group","channel":"entra","states":["groupMissing"],"format":"markdown","kind":"template"}
Create only the owner-confirmed canonical exclusions group.

1. Go to **Entra admin center → Entra ID → Groups → All groups → New group**.
2. Group type: **Security**.
3. Membership type: **Assigned**. Do not use Dynamic User or Dynamic Device.
4. Name: **{{group.target.displayName}}**.
5. Add only the owner-confirmed emergency access accounts supplied by IAMAI.
6. Create the group.
7. Rescan IAMAI before changing Conditional Access policies so the newly created stable group ID becomes tenant truth.

Do not create a second similarly named group as a shortcut.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"entra.correct.open-group","channel":"entra","states":["partial"],"format":"markdown","kind":"template"}
Open the exact canonical exclusions group by stable identity. Correct only the mismatch IAMAI reports. Do not switch to a different candidate group by name.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"entra.correct.type","channel":"entra","states":["partial"],"format":"markdown","kind":"template"}
The canonical emergency exclusions object must be an assigned, non-mail-enabled security group. If the selected object is dynamic or an incompatible group type, do not silently convert or replace it. Return to owner resolution if a new canonical group must be chosen/created, then rescan.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"entra.correct.add-member","channel":"entra","states":["partial"],"format":"markdown","kind":"template"}
Under **Members**, add only the IAMAI-resolved owner-confirmed emergency account that is missing. Verify the account's stable object identity before saving.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"entra.correct.remove-member","channel":"entra","states":["partial"],"format":"markdown","kind":"template"}
Under **Members**, remove only the member IAMAI explicitly identifies as outside the canonical owner-confirmed emergency set. Do not remove an account merely because its display name looks unusual.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"entra.correct.policy-exclusion","channel":"entra","states":["partial"],"format":"markdown","kind":"template"}
Open the exact Conditional Access policy IAMAI identifies. Under **Users or workload identities → Exclude → Users and groups**, add the canonical exclusions group. Preserve every other assignment, condition, grant, session control, lifecycle state, application scope, and existing approved exclusion. Do not add individual emergency user IDs as substitutes.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"entra.correct.verify-rescan","channel":"entra","states":["partial"],"format":"markdown","kind":"template"}
Read the group/policy state back, confirm the bounded change only, then rescan IAMAI. If the group was newly created, do not patch policies until IAMAI has learned its stable ID.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"entra.verify","channel":"entra","states":["verificationRequired"],"format":"markdown","kind":"template"}
Verify:
1. The exact canonical group is an assigned security group and is not mail-enabled.
2. Direct membership matches the owner-confirmed emergency account set.
3. Every IAMAI-identified blocking/restrictive Conditional Access policy contains the exact group ID under Users/Groups exclusions before it is enabled.
4. No unrelated member or policy exclusion changed.
5. Report-only policies are not described as currently blocking; the safety gate is that the exclusion must be correct before enforcement.
6. Rescan IAMAI.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"json.group.create","channel":"json","states":["groupMissing"],"format":"json-template","kind":"template"}
{"displayName":{{json:group.target.displayName}},"description":"IAMAI canonical emergency access exclusion group","groupTypes":[],"mailEnabled":false,"mailNickname":{{json:group.target.mailNickname}},"securityEnabled":true,"members@odata.bind":{{json:group.target.memberODataBindings}}}
@@IAMAI-END

@@IAMAI-BEGIN {"id":"json.member.add","channel":"json","states":["partial"],"format":"json-template","kind":"template"}
{"@odata.id":"https://graph.microsoft.com/v1.0/directoryObjects/{{group.target.memberId}}"}
@@IAMAI-END

@@IAMAI-BEGIN {"id":"json.member.remove","channel":"json","states":["partial"],"format":"json-template","kind":"referenceOnly"}
{"method":"DELETE","uri":"https://graph.microsoft.com/v1.0/groups/{{group.current.id}}/members/{{group.target.memberId}}/$ref","body":null}
@@IAMAI-END

@@IAMAI-BEGIN {"id":"json.policy.patch-conditions","channel":"json","states":["partial"],"format":"json-template","kind":"template"}
{"conditions":{{json:policy.target.conditionsWithExclusion}}}
@@IAMAI-END

@@IAMAI-BEGIN {"id":"powershell.run","channel":"powershell","states":["groupMissing","partial","verificationRequired"],"format":"powershell","kind":"template"}
param(
  [Parameter(Mandatory=$true)]
  [ValidateSet('CreateGroup','AddMember','RemoveMember','AddPolicyExclusion','VerifyGroup')]
  [string]$Mode,

  [string]$GroupId,
  [string]$DisplayName,
  [string]$MailNickname,
  [string[]]$DesiredMemberIds = @(),
  [string]$MemberId,
  [string]$PolicyId
)

$ErrorActionPreference = 'Stop'
$Graph = 'https://graph.microsoft.com/v1.0'

function Invoke-Graph {
  param([string]$Method,[string]$Uri,[object]$Body=$null)
  if ($null -eq $Body) {
    return Invoke-MgGraphRequest -Method $Method -Uri $Uri -OutputType PSObject
  }
  $json = $Body | ConvertTo-Json -Depth 30
  return Invoke-MgGraphRequest -Method $Method -Uri $Uri -Body $json -ContentType 'application/json' -OutputType PSObject
}

function Assert-Guid([string]$Value,[string]$Name) {
  $g = [guid]::Empty
  if (-not [guid]::TryParse($Value,[ref]$g)) { throw "$Name must be a resolved GUID." }
}

function Get-MemberIds([string]$Id) {
  $ids = @()
  $uri = "$Graph/groups/$Id/members?`$select=id&`$top=999"
  while ($uri) {
    $r = Invoke-Graph GET $uri
    $ids += @($r.value | ForEach-Object { $_.id })
    $uri = $r.'@odata.nextLink'
  }
  return @($ids)
}

function Has-Member([string]$Id,[string]$TargetMemberId) {
  return $TargetMemberId -in @(Get-MemberIds $Id)
}

function Verify-Group([string]$Id) {
  Assert-Guid $Id 'GroupId'
  $g = Invoke-Graph GET "$Graph/groups/$Id?`$select=id,displayName,groupTypes,mailEnabled,securityEnabled,membershipRule,membershipRuleProcessingState"
  if ($g.securityEnabled -ne $true -or $g.mailEnabled -ne $false) { throw 'Canonical exclusions object is not a plain security group.' }
  if (@($g.groupTypes) -contains 'DynamicMembership' -or -not [string]::IsNullOrWhiteSpace($g.membershipRule)) { throw 'Canonical exclusions group must use assigned membership.' }
  if (@($g.groupTypes) -contains 'Unified') { throw 'Canonical exclusions group must not be a Microsoft 365 group.' }

  if ($DesiredMemberIds.Count -gt 0) {
    $actual = @(Get-MemberIds $Id | Sort-Object -Unique)
    $desired = @($DesiredMemberIds | Sort-Object -Unique)
    $missing = @($desired | Where-Object { $_ -notin $actual })
    $extra = @($actual | Where-Object { $_ -notin $desired })
    if ($missing.Count -or $extra.Count) { throw "Membership differs from canonical set. Missing=$($missing.Count); Extra=$($extra.Count)." }
  }
  return $g
}

# Delegated execution:
# Group creation/correction: Group.ReadWrite.All and/or GroupMember.ReadWrite.All as applicable.
# Conditional Access patch/read: Policy.Read.All + Policy.ReadWrite.ConditionalAccess and an appropriate CA/Security Administrator role.
# Never omit /$ref from a group-member DELETE.

switch ($Mode) {
  'CreateGroup' {
    if ([string]::IsNullOrWhiteSpace($DisplayName) -or [string]::IsNullOrWhiteSpace($MailNickname)) { throw 'Resolved DisplayName and MailNickname are required.' }
    if ($DesiredMemberIds.Count -eq 0) { throw 'Owner-confirmed emergency member IDs are required.' }

    $escaped = $DisplayName.Replace("'","''")
    $filter = [uri]::EscapeDataString("displayName eq '$escaped'")
    $existing = Invoke-Graph GET "$Graph/groups?`$filter=$filter&`$select=id,displayName"
    if (@($existing.value).Count -gt 0) { throw 'A group with this display name already exists. Resolve stable identity; do not duplicate.' }

    $memberRefs = @($DesiredMemberIds | ForEach-Object {
      Assert-Guid $_ 'DesiredMemberId'
      "$Graph/users/$_"
    })
    $body = @{
      displayName = $DisplayName
      description = 'IAMAI canonical emergency access exclusion group'
      groupTypes = @()
      mailEnabled = $false
      mailNickname = $MailNickname
      securityEnabled = $true
      'members@odata.bind' = $memberRefs
    }
    $created = Invoke-Graph POST "$Graph/groups" $body
    [pscustomobject]@{
      CreatedGroupId = $created.id
      NextSafeAction = 'Rescan IAMAI before patching Conditional Access policies.'
    }
  }

  'AddMember' {
    Assert-Guid $GroupId 'GroupId'
    Assert-Guid $MemberId 'MemberId'
    Verify-Group $GroupId | Out-Null
    if (-not (Has-Member $GroupId $MemberId)) {
      $body = @{ '@odata.id' = "$Graph/directoryObjects/$MemberId" }
      Invoke-Graph POST "$Graph/groups/$GroupId/members/`$ref" $body | Out-Null
    }
    if (-not (Has-Member $GroupId $MemberId)) { throw 'Group membership add read-back failed.' }
  }

  'RemoveMember' {
    Assert-Guid $GroupId 'GroupId'
    Assert-Guid $MemberId 'MemberId'
    Verify-Group $GroupId | Out-Null
    if (Has-Member $GroupId $MemberId) {
      Invoke-Graph DELETE "$Graph/groups/$GroupId/members/$MemberId/`$ref" | Out-Null
    }
    if (Has-Member $GroupId $MemberId) { throw 'Group membership removal read-back failed.' }
  }

  'AddPolicyExclusion' {
    Assert-Guid $GroupId 'GroupId'
    Assert-Guid $PolicyId 'PolicyId'
    $p = Invoke-Graph GET "$Graph/identity/conditionalAccess/policies/$PolicyId"
    if ($null -eq $p.conditions -or $null -eq $p.conditions.users) { throw 'Policy conditions/users are unreadable.' }

    $conditions = $p.conditions
    $exclude = @($conditions.users.excludeGroups)
    if ($GroupId -notin $exclude) {
      $conditions.users.excludeGroups = @($exclude + $GroupId | Sort-Object -Unique)
      Invoke-Graph PATCH "$Graph/identity/conditionalAccess/policies/$PolicyId" @{ conditions = $conditions } | Out-Null
    }
    $after = Invoke-Graph GET "$Graph/identity/conditionalAccess/policies/$PolicyId"
    if ($GroupId -notin @($after.conditions.users.excludeGroups)) { throw 'Policy exclusion read-back failed.' }
  }

  'VerifyGroup' {
    Verify-Group $GroupId
  }
}
@@IAMAI-END

@@IAMAI-BEGIN {"id":"ai.create","channel":"aiInfo","states":["groupMissing"],"format":"markdown","kind":"template"}
**Contains tenant context. Review before sharing with an external AI service.**

Review IAMAI's proposed canonical exclusions group for {{tenant.displayName}}. It must be one assigned, non-mail-enabled security group with only the owner-confirmed emergency members. After creation, require a rescan before policy patching so the stable group ID becomes tenant truth. Do not choose an alternate candidate or broaden membership.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"ai.correct","channel":"aiInfo","states":["partial"],"format":"markdown","kind":"template"}
**Contains tenant context. Review before sharing with an external AI service.**

Review only the IAMAI-resolved exclusion mismatch. Group: {{group.current.id}}. Current members: {{group.current.members}}. Policy needing exclusion: {{policy.current.displayName}} ({{policy.current.id}}). Preserve all unrelated policy semantics. If removing a member through Graph, the request must end in `/$ref`; never delete the directory object itself.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"ai.verify","channel":"aiInfo","states":["verificationRequired"],"format":"markdown","kind":"template"}
**Contains tenant context. Review before sharing with an external AI service.**

Verify the canonical group and affected policies after the bounded change. Group type evidence: {{group.evidence.type}}. Missing policy exclusions: {{policy.evidence.missingExclusions}}. Confirm stable IDs, exact canonical membership, and preservation of unrelated policy conditions. Report-only is not current lockout; enforcement remains gated until the exclusion is present.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"ai.blocked","channel":"aiInfo","states":["needsDecision","blocked"],"format":"markdown","kind":"template"}
**Contains tenant context. Review before sharing with an external AI service.**

Explain why IAMAI cannot safely act on the exclusions group in {{tenant.displayName}}: {{dependencies.blockers}}. Candidate groups and unreadable membership are not authority. Do not create, replace, remove members, or patch policies until the canonical stable identity and owner-confirmed member set are known.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"email.admins.exclusion-change","channel":"email","states":["verificationRequired"],"format":"markdown","kind":"template"}
Subject: Emergency access exclusion boundary updated

The tenant's canonical emergency-access exclusions group or its Conditional Access references were updated. Please verify that only the approved emergency accounts are members and that the intended blocking/restrictive policies exclude the group before enforcement. No credentials or recovery secrets should be shared in this message.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"readiness.model","channel":"readiness","states":["needsDecision","groupMissing","partial","verificationRequired"],"format":"json-template","kind":"referenceOnly"}
{"tiles":[{"id":"identity","label":"Canonical group","gate":"Safe to change","result":"{{group.current.id}}","line":"One stable owner-confirmed exclusions group must be resolved before corrections use it.","evidenceSource":"IAMAI group identity"},{"id":"type","label":"Assigned security group","gate":"Safe to use","result":"{{group.evidence.type}}","line":"Dynamic or mail-enabled group semantics are not the emergency exclusion contract.","evidenceSource":"IAMAI group facts"},{"id":"members","label":"Emergency members","gate":"Safe to enforce","result":"{{group.current.members}}","line":"Direct membership must match the owner-confirmed emergency account set.","evidenceSource":"IAMAI membership facts"},{"id":"policies","label":"Policy exclusions","gate":"Safe to enforce","result":"{{policy.evidence.missingExclusions}}","line":"Every identified blocking/restrictive policy must exclude the canonical group before it is enabled.","evidenceSource":"IAMAI policy facts"}],"whyIamaiSaysThis":"The exclusions group is a security boundary: stable identity, exact membership, and exact policy references must all agree before lockout-sensitive enforcement."}
@@IAMAI-END

@@IAMAI-BEGIN {"id":"troubleshooting.model","channel":"troubleshooting","states":["groupMissing","partial","verificationRequired","inPlace"],"format":"json","kind":"referenceOnly"}
{"scenarios":[{"id":"duplicate-name","classification":"derived","symptom":"Create finds a group with the proposed display name.","check":"Resolve whether that stable group is the owner-confirmed canonical group.","fix":"Do not create a duplicate by name; return to identity resolution.","then":"Resume after the stable group ID is known.","sources":["ms-group-create"]},{"id":"dynamic-group","classification":"documented","symptom":"The selected group uses DynamicMembership.","check":"Inspect groupTypes and membershipRule.","fix":"Do not use dynamic membership for the canonical emergency exclusions contract; resolve/create the approved assigned security group.","then":"Rescan before policy changes.","sources":["ms-group-create","ms-emergency"]},{"id":"unexpected-member","classification":"derived","symptom":"A non-approved account is excluded from all policies through group membership.","check":"Compare direct member IDs with the saved canonical emergency set.","fix":"Remove only the explicitly resolved unexpected membership reference.","then":"Verify the group and rescan.","sources":["ms-group-remove"]},{"id":"dangerous-delete-shape","classification":"documented","symptom":"A removal request omits `/$ref`.","check":"Inspect the Graph URI before execution.","fix":"Use DELETE `/groups/{group-id}/members/{member-id}/$ref` exactly.","then":"Verify the directory object still exists and group membership is correct.","sources":["ms-group-remove"]},{"id":"policy-patch-too-broad","classification":"derived","symptom":"Adding one exclusion would replace other policy conditions.","check":"Compare the proposed PATCH body to the complete current `conditions` object.","fix":"Use the full current conditions as the mutation boundary and change only `users.excludeGroups`.","then":"Read the same policy back and compare unrelated fields.","sources":["ms-ca-update"]},{"id":"report-only-lockout-claim","classification":"documented","symptom":"IAMAI says a missing exclusion is already blocking an emergency account while the policy is Report-only.","check":"Confirm lifecycle state.","fix":"Correct the wording/readiness state; ensure the exclusion is present before enabling the policy.","then":"Re-evaluate at enforcement readiness.","sources":["ms-emergency"]},{"id":"graph-403","classification":"documented","symptom":"Graph or PowerShell returns 403.","check":"Verify group permissions for group operations and Policy.Read.All + Policy.ReadWrite.ConditionalAccess plus supported CA/Security admin role for policy updates.","fix":"Reconnect with only the permissions required for the intended operation.","then":"Retry the same bounded action.","sources":["ms-group-create","ms-group-add","ms-ca-update"]}]}
@@IAMAI-END

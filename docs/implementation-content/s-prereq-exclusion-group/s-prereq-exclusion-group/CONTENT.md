@@IAMAI-BEGIN {"id":"entra.create-group","channel":"entra","states":["groupMissing"],"format":"markdown","kind":"template"}
If confirming an existing group (like "Breakglass Exclusion"):
Click Save above. IAMAI records the group's ID for the plan; saving does not change any policy. Each policy that must exclude the group is corrected separately.

If creating a new group:
1. Go to Entra admin center → Groups → All groups → New group.
2. Group type: Security.
3. Membership type: Assigned (not Dynamic).
4. Name: Core - Exclusions (or your preferred name).
5. Members: add only the emergency access accounts you selected in the Emergency Access step.
6. Create.
7. Rescan in IAMAI so it picks up the new group's ID. Then add the group to each policy IAMAI identifies.

Important: this group should contain only emergency access accounts. Do not add regular users or service accounts; they would be excluded from every policy that excludes this group.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"entra.correct.open-group","channel":"entra","states":["partial"],"format":"markdown","kind":"template"}
Open the confirmed exclusions group by its object ID. Correct only the difference IAMAI reports. Do not switch to a different group because of its name.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"entra.correct.type","channel":"entra","states":["partial"],"format":"markdown","kind":"template"}
The exclusions group must be an assigned, non-mail-enabled security group. If the selected group is dynamic or another group type, do not convert or replace it here. Ask the owner to choose or create the right group, confirm it in this step, then rescan.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"entra.correct.add-member","channel":"entra","states":["partial"],"format":"markdown","kind":"template"}
Under **Members**, add only the missing emergency account IAMAI identifies from the owner-confirmed set. Check the account's object ID before saving.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"entra.correct.remove-member","channel":"entra","states":["partial"],"format":"markdown","kind":"template"}
Under **Members**, remove only the member IAMAI identifies as outside the owner-confirmed emergency account set. Do not remove an account only because its display name looks unusual.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"entra.correct.policy-exclusion","channel":"entra","states":["partial"],"format":"markdown","kind":"template"}
Open the Conditional Access policy IAMAI identifies. Under **Users or workload identities → Exclude → Users and groups**, add the confirmed exclusions group. Keep every other assignment, condition, grant, session control, resource scope and approved exclusion. Keep the policy's current state. If it is On, the changed rule can affect access after you save. Do not add individual emergency accounts instead of the group.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"entra.correct.verify-rescan","channel":"entra","states":["partial"],"format":"markdown","kind":"template"}
Read the group and policy back, confirm that only the intended change was made, then rescan IAMAI. If the group was newly created, do not change policies until IAMAI has picked up its object ID.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"entra.verify","channel":"entra","states":["verificationRequired"],"format":"markdown","kind":"template"}
Verify after the change:
1. The confirmed group is an assigned security group and is not mail-enabled.
2. Direct membership matches the owner-confirmed emergency account set.
3. Every blocking or restrictive Conditional Access policy IAMAI identifies excludes the group's ID under Users → Exclude before that policy is enabled.
4. No unrelated member or policy exclusion changed.
5. A Report-only policy does not block sign-ins yet; its exclusion must be correct before it is enabled.
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

State: no confirmed exclusions group exists in {{tenant.displayName}} yet. The next action creates one assigned, non-mail-enabled security group containing only the owner-confirmed emergency access accounts, or confirms an existing group that already meets that description.

Creating or selecting the group does not change any policy. After creation, a rescan gives IAMAI the group's object ID; each policy that must exclude the group is then updated separately.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"ai.correct","channel":"aiInfo","states":["partial"],"format":"markdown","kind":"template"}

State: the exclusions group or a policy's reference to it differs from the intended result. Group: {{group.current.id}}. Current members: {{group.current.members}}. Policy needing the exclusion: {{policy.current.displayName}} ({{policy.current.id}}). The correction changes only that difference and keeps the policy's other settings and approved exclusions. If removing a member through Graph, the request must end in `/$ref`; never delete the directory object itself.

Keep the policy's current state. If it is On, the changed rule can affect access after you save.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"ai.verify","channel":"aiInfo","states":["verificationRequired"],"format":"markdown","kind":"template"}

State: the exclusions group and the policies that should exclude it need verification. Group type evidence: {{group.evidence.type}}. Policies still missing the exclusion: {{policy.evidence.missingExclusions}}.

Check the group's object ID, that its direct members are exactly the owner-confirmed emergency accounts, and that each policy's other conditions are unchanged. A Report-only policy does not block sign-ins yet; its exclusion must be present before it is enabled.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"ai.blocked","channel":"aiInfo","states":["needsDecision","blocked"],"format":"markdown","kind":"template"}

State: IAMAI cannot act on the exclusions group in {{tenant.displayName}} yet. Known blockers or decisions: {{dependencies.blockers}}. A group with a likely name, or one whose membership could not be read, is not a confirmed exclusions group. No group or policy change is offered until the group's object ID and the owner-confirmed emergency accounts are known.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"email.admins.exclusion-change","channel":"email","states":["verificationRequired"],"format":"markdown","kind":"template","audience":"administrators"}
Subject: Action needed: Create or Correct Exclusions Group

We plan to update the emergency access group or its policy references. Please check that only the selected emergency accounts are members and that the required policies exclude the group. No credentials or recovery secrets should be shared in this message.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"readiness.model","channel":"readiness","states":["needsDecision","groupMissing","partial","verificationRequired"],"format":"json-template","kind":"referenceOnly"}
{"tiles":[{"id":"identity","label":"Canonical group","gate":"Safe to change","result":"{{group.current.id}}","line":"One owner-confirmed exclusions group must be identified by its object ID before corrections use it.","evidenceSource":"IAMAI group identity"},{"id":"type","label":"Assigned security group","gate":"Safe to use","result":"{{group.evidence.type}}","line":"The exclusions group must be an assigned security group that is not mail-enabled.","evidenceSource":"IAMAI group facts"},{"id":"members","label":"Emergency members","gate":"Safe to enforce","result":"{{group.current.members}}","line":"Direct membership must match the owner-confirmed emergency account set.","evidenceSource":"IAMAI membership facts"},{"id":"policies","label":"Policy exclusions","gate":"Safe to enforce","result":"{{policy.evidence.missingExclusions}}","line":"Confirm the group, check its direct members, and review which policies actually exclude it. Selecting a group does not update those policies.","evidenceSource":"IAMAI policy facts"}],"whyIamaiSaysThis":"One reviewed group keeps emergency access exclusions consistent. Its object ID, its direct members and each policy's reference to it must all be correct before a policy that could lock people out is enabled."}
@@IAMAI-END

@@IAMAI-BEGIN {"id":"troubleshooting.model","channel":"troubleshooting","states":["groupMissing","partial","verificationRequired","inPlace"],"format":"json","kind":"referenceOnly"}
{"scenarios":[{"id":"duplicate-name","classification":"derived","symptom":"Create finds a group with the proposed display name.","check":"Check whether that group is the owner-confirmed exclusions group.","fix":"Do not create a duplicate by name; confirm which group is the exclusions group first.","then":"Resume after the stable group ID is known.","sources":["ms-group-create"]},{"id":"dynamic-group","classification":"documented","symptom":"The selected group uses DynamicMembership.","check":"Inspect groupTypes and membershipRule.","fix":"Do not use dynamic membership for the exclusions group; select or create the approved assigned security group.","then":"Rescan before policy changes.","sources":["ms-group-create","ms-emergency"]},{"id":"unexpected-member","classification":"derived","symptom":"A non-approved account is excluded, through group membership, from every policy that excludes this group.","check":"Compare direct member IDs with the saved emergency account set.","fix":"Remove only the explicitly resolved unexpected membership reference.","then":"Verify the group and rescan.","sources":["ms-group-remove"]},{"id":"dangerous-delete-shape","classification":"documented","symptom":"A removal request omits `/$ref`.","check":"Inspect the Graph URI before execution.","fix":"Use DELETE `/groups/{group-id}/members/{member-id}/$ref` exactly.","then":"Verify the directory object still exists and group membership is correct.","sources":["ms-group-remove"]},{"id":"policy-patch-too-broad","classification":"derived","symptom":"Adding one exclusion would replace other policy conditions.","check":"Compare the proposed PATCH body to the complete current `conditions` object.","fix":"Use the full current conditions as the mutation boundary and change only `users.excludeGroups`.","then":"Read the same policy back and compare unrelated fields.","sources":["ms-ca-update"]},{"id":"report-only-lockout-claim","classification":"documented","symptom":"IAMAI says a missing exclusion is already blocking an emergency account while the policy is Report-only.","check":"Confirm lifecycle state.","fix":"Correct the wording/readiness state; ensure the exclusion is present before enabling the policy.","then":"Re-evaluate at enforcement readiness.","sources":["ms-emergency"]},{"id":"graph-403","classification":"documented","symptom":"Graph or PowerShell returns 403.","check":"Verify group permissions for group operations and Policy.Read.All + Policy.ReadWrite.ConditionalAccess plus supported CA/Security admin role for policy updates.","fix":"Reconnect with only the permissions required for the intended operation.","then":"Retry the same bounded action.","sources":["ms-group-create","ms-group-add","ms-ca-update"]}]}
@@IAMAI-END

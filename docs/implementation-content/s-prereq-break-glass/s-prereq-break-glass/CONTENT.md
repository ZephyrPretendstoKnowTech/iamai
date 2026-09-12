@@IAMAI-BEGIN {"id":"entra.create-or-correct","channel":"entra","states":["missing"],"format":"markdown","kind":"template"}
Use the owner-confirmed emergency account identities only.

1. In **Entra admin center → Entra ID → Users**, create or open the dedicated emergency account.
2. For a new account, use the tenant's `*.onmicrosoft.com` domain and keep it cloud-only. Do not source it from federation or on-premises synchronization.
3. Confirm the account is enabled and dedicated to emergency recovery rather than normal daily work.
4. Assign **Global Administrator** as an active permanent assignment, not merely eligible through PIM.
5. Register the organization-approved emergency phishing-resistant method. Microsoft currently recommends Passkey (FIDO2); CBA is also supported where PKI already exists. Do not bind the account to an employee-personal device.
6. Put the account in the single IAMAI-resolved emergency/exclusions group.
7. Repeat for every owner-confirmed emergency account; maintain at least two.
8. Store credentials/keys outside IAMAI in the approved secure custody process.
9. Confirm monitoring exists for emergency-account use.
10. Run the real validation drill before treating the recovery path as proven.

Machine JSON/PowerShell for this step is deliberately partial: it can ensure the permanent role and group membership for a resolved stable user ID, but it does not create, register, or store credentials.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"entra.correct.open","channel":"entra","states":["partial"],"format":"markdown","kind":"template"}
Open the exact owner-confirmed emergency account by stable identity. Correct only the check IAMAI marked as failing. Preserve the account's other confirmed emergency-access properties.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"entra.correct.identity","channel":"entra","states":["partial"],"format":"markdown","kind":"template"}
The emergency identity is not cloud-only on the tenant's `onmicrosoft.com` domain. Do not convert a normal employee or synchronized identity into the escape hatch by guesswork. Create/choose the dedicated cloud-only emergency identity through the owner-confirmed workflow, then rescan before assigning it recovery authority.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"entra.correct.enabled","channel":"entra","states":["partial"],"format":"markdown","kind":"template"}
Set **Account enabled** to **Yes** for the exact emergency account only after confirming it is still an authorized recovery identity. Do not bulk-enable disabled accounts.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"entra.correct.role","channel":"entra","states":["partial"],"format":"markdown","kind":"template"}
Under **Roles and administrators**, ensure the exact emergency account has **Global Administrator** as an active permanent assignment. Do not leave the recovery account merely PIM-eligible; activation itself can be unavailable during the incident.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"entra.correct.exclusion-membership","channel":"entra","states":["partial"],"format":"markdown","kind":"template"}
Add the exact emergency account to the IAMAI-resolved canonical exclusions group. Do not add unrelated administrators, service accounts, or convenience exclusions. Downstream policy exclusions are corrected by **Create or Correct Exclusions Group**.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"entra.correct.auth","channel":"entra","states":["partial"],"format":"markdown","kind":"template"}
Register the approved phishing-resistant emergency method. Prefer a dedicated Passkey (FIDO2) security key under current Microsoft guidance, or CBA where PKI already exists. The method must not depend on an employee's personal phone or normal administrator authentication path.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"entra.correct.custody","channel":"entra","states":["partial"],"format":"markdown","kind":"template"}
Correct credential custody outside IAMAI. Authorized administrators must be able to reach the emergency credentials even when the tenant, normal password manager sign-in path, or a single physical location is unavailable. Do not paste secrets into IAMAI, AI Info, Email, or plan exports.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"entra.correct.monitoring","channel":"entra","states":["partial"],"format":"markdown","kind":"template"}
Establish the organization's approved monitoring for every emergency-account sign-in and audit activity. This package records readiness only; it does not manufacture a separate monitoring implementation that is outside the current workbook row.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"entra.correct.rescan","channel":"entra","states":["partial"],"format":"markdown","kind":"template"}
After the bounded correction, rescan IAMAI. Do not mark the emergency path proven until the real drill also succeeds.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"entra.verify-human","channel":"entra","states":["partial","verificationRequired"],"format":"markdown","kind":"template"}
Verify the deterministic state first, then perform a controlled real drill:

1. Confirm the exact account can sign in using the emergency authentication method from the organization's designated secure workstation/client environment.
2. Confirm it can perform an administrative action appropriate to proving Global Administrator access.
3. Confirm monitoring/alerting records the planned use.
4. Confirm no personal MFA/SSPR detail or employee device became a hidden dependency.
5. Record the validation date outside any secret-bearing record.
6. Repeat at least every 90 days and after material staffing/subscription changes.

A Graph read-back of the user, role, and group is not a substitute for this human proof.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"json.role-assignment","channel":"json","states":["missing","partial"],"format":"json-template","kind":"template"}
{"@odata.type":"#microsoft.graph.unifiedRoleAssignment","principalId":{{json:emergency.target.userId}},"roleDefinitionId":"62e90394-69f5-4237-9190-012177145e10","directoryScopeId":"/"}
@@IAMAI-END

@@IAMAI-BEGIN {"id":"json.group-membership","channel":"json","states":["missing","partial"],"format":"json-template","kind":"template"}
{"@odata.id":"https://graph.microsoft.com/v1.0/directoryObjects/{{emergency.target.userId}}"}
@@IAMAI-END

@@IAMAI-BEGIN {"id":"powershell.run","channel":"powershell","states":["missing","partial","verificationRequired"],"format":"powershell","kind":"template"}
param(
  [Parameter(Mandatory=$true)]
  [ValidateSet('EnsureDeterministic','EnsureRole','EnsureGroupMembership','VerifyDeterministic')]
  [string]$Mode,

  [Parameter(Mandatory=$true)]
  [ValidatePattern('^[0-9a-fA-F-]{36}$')]
  [string]$UserId,

  [Parameter(Mandatory=$true)]
  [ValidatePattern('^[0-9a-fA-F-]{36}$')]
  [string]$ExclusionsGroupId,

  [Parameter(Mandatory=$true)]
  [string]$ExpectedUpn
)

$ErrorActionPreference = 'Stop'
$Graph = 'https://graph.microsoft.com/v1.0'
$GlobalAdminRoleId = '62e90394-69f5-4237-9190-012177145e10'

function Invoke-Graph {
  param([string]$Method,[string]$Uri,[object]$Body=$null)
  if ($null -eq $Body) {
    return Invoke-MgGraphRequest -Method $Method -Uri $Uri -OutputType PSObject
  }
  $json = $Body | ConvertTo-Json -Depth 20
  return Invoke-MgGraphRequest -Method $Method -Uri $Uri -Body $json -ContentType 'application/json' -OutputType PSObject
}

function Assert-UserIdentity {
  $u = Invoke-Graph GET "$Graph/users/$UserId?`$select=id,userPrincipalName,accountEnabled,onPremisesSyncEnabled"
  if ($u.id -ne $UserId) { throw 'Stable user identity mismatch.' }
  if ($u.userPrincipalName -ne $ExpectedUpn) { throw 'UPN does not match the owner-confirmed emergency account.' }
  if ($u.accountEnabled -ne $true) { throw 'Emergency account is disabled.' }
  if ($u.onPremisesSyncEnabled -eq $true) { throw 'Emergency account is synchronized; expected cloud-only.' }
  if ($u.userPrincipalName -notmatch '\.onmicrosoft\.com$') { throw 'Emergency account is not using an onmicrosoft.com UPN.' }
  return $u
}

function Has-GlobalAdmin {
  $filter = [uri]::EscapeDataString("roleDefinitionId eq '$GlobalAdminRoleId'")
  $r = Invoke-Graph GET "$Graph/roleManagement/directory/roleAssignments?`$filter=$filter"
  return @($r.value | Where-Object { $_.principalId -eq $UserId -and $_.directoryScopeId -eq '/' }).Count -gt 0
}

function Ensure-GlobalAdmin {
  if (-not (Has-GlobalAdmin)) {
    $body = @{
      '@odata.type' = '#microsoft.graph.unifiedRoleAssignment'
      principalId = $UserId
      roleDefinitionId = $GlobalAdminRoleId
      directoryScopeId = '/'
    }
    Invoke-Graph POST "$Graph/roleManagement/directory/roleAssignments" $body | Out-Null
  }
}

function Has-GroupMembership {
  $uri = "$Graph/groups/$ExclusionsGroupId/members?`$select=id&`$top=999"
  while ($uri) {
    $m = Invoke-Graph GET $uri
    if (@($m.value | Where-Object { $_.id -eq $UserId }).Count -gt 0) { return $true }
    $uri = $m.'@odata.nextLink'
  }
  return $false
}

function Ensure-GroupMembership {
  if (-not (Has-GroupMembership)) {
    $body = @{ '@odata.id' = "$Graph/directoryObjects/$UserId" }
    Invoke-Graph POST "$Graph/groups/$ExclusionsGroupId/members/`$ref" $body | Out-Null
  }
}

function Verify-Deterministic {
  Assert-UserIdentity | Out-Null
  if (-not (Has-GlobalAdmin)) { throw 'Permanent active Global Administrator assignment not found.' }
  if (-not (Has-GroupMembership)) { throw 'Canonical exclusions-group membership not found.' }
  [pscustomobject]@{
    UserId = $UserId
    Upn = $ExpectedUpn
    GlobalAdministratorActive = $true
    ExclusionsGroupMember = $true
    HumanProofStillRequired = $true
  }
}

# Delegated execution. Connect separately with least privileges appropriate to the selected mode:
# User.Read.All, RoleManagement.ReadWrite.Directory, GroupMember.ReadWrite.All.
# This script deliberately does not create users, handle passwords, register authentication methods,
# or claim the emergency sign-in drill has succeeded.

switch ($Mode) {
  'EnsureDeterministic' {
    Assert-UserIdentity | Out-Null
    Ensure-GlobalAdmin
    Ensure-GroupMembership
    Verify-Deterministic
  }
  'EnsureRole' {
    Assert-UserIdentity | Out-Null
    Ensure-GlobalAdmin
    if (-not (Has-GlobalAdmin)) { throw 'Permanent active Global Administrator assignment read-back failed.' }
    [pscustomobject]@{ UserId = $UserId; GlobalAdministratorActive = $true; HumanProofStillRequired = $true }
  }
  'EnsureGroupMembership' {
    Assert-UserIdentity | Out-Null
    Ensure-GroupMembership
    if (-not (Has-GroupMembership)) { throw 'Canonical exclusions-group membership read-back failed.' }
    [pscustomobject]@{ UserId = $UserId; ExclusionsGroupMember = $true; HumanProofStillRequired = $true }
  }
  'VerifyDeterministic' {
    Verify-Deterministic
  }
}
@@IAMAI-END

@@IAMAI-BEGIN {"id":"ai.decision","channel":"aiInfo","states":["needsDecision"],"format":"markdown","kind":"template"}
**Contains tenant context. Review before sharing with an external AI service.**

IAMAI has candidate emergency-access evidence for {{tenant.displayName}}, but the owner has not confirmed the emergency identities. Explain what evidence is known and what remains a human choice. Do not nominate or select an account, do not propose machine actions, and do not treat a normal administrator as emergency access.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"ai.implement","channel":"aiInfo","states":["missing"],"format":"markdown","kind":"template"}
**Contains tenant context. Review before sharing with an external AI service.**

Review the owner-confirmed emergency account {{emergency.target.upn}} (stable ID {{emergency.target.userId}}) for {{tenant.displayName}}. Target: cloud-only onmicrosoft.com identity, enabled, permanent active Global Administrator, phishing-resistant emergency authentication, canonical exclusions-group membership, independent secure custody, monitoring, and real drill proof. Machine actions may only ensure the deterministic role and group membership. Never request or expose credentials.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"ai.correct","channel":"aiInfo","states":["partial"],"format":"markdown","kind":"template"}
**Contains tenant context. Review before sharing with an external AI service.**

Review only IAMAI-provided failing emergency-access evidence for {{emergency.target.upn}}. Preserve the stable user identity and owner-confirmed account set. Separate deterministic Entra corrections from human authentication/custody/proof work. Do not invent a second account, owner decision, credential, or exclusion.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"ai.verify","channel":"aiInfo","states":["verificationRequired"],"format":"markdown","kind":"template"}
**Contains tenant context. Review before sharing with an external AI service.**

Assess whether deterministic emergency-account state is ready for a human drill. Known account state: {{emergency.evidence.accountState}}. Role: {{emergency.evidence.roleState}}. Authentication evidence: {{emergency.evidence.authMethods}}. Custody: {{emergency.evidence.custody}}. Monitoring: {{emergency.evidence.monitoring}}. Last drill: {{emergency.evidence.lastDrill}}. Unknown stays Unknown. Do not claim recovery is proven until the real sign-in/admin-task validation succeeds.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"ai.blocked","channel":"aiInfo","states":["blocked"],"format":"markdown","kind":"template"}
**Contains tenant context. Review before sharing with an external AI service.**

Explain the IAMAI-supplied blockers for emergency access in {{tenant.displayName}}: {{dependencies.blockers}}. Do not provide implementation that bypasses an unresolved owner choice, unreadable evidence, or missing canonical exclusions-group identity.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"email.admins.drill","channel":"email","states":["verificationRequired"],"format":"markdown","kind":"template","audience":"authorized-emergency-administrators"}
Subject: Planned emergency access validation

We are validating the tenant's emergency access process. Authorized administrators should confirm they can retrieve the approved emergency credentials, use the designated secure workstation/client path, complete a controlled sign-in and administrative check, and verify the monitoring alert. Do not send passwords, key PINs, recovery codes, safe combinations, or other secrets by email. Record only the validation result and date after the drill.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"readiness.model","channel":"readiness","states":["needsDecision","missing","partial","verificationRequired"],"format":"json-template","kind":"referenceOnly"}
{"tiles":[{"id":"identity","label":"Emergency identity","gate":"Safe to continue","result":"{{emergency.evidence.accountState}}","line":"Owner-confirmed, cloud-only onmicrosoft.com emergency identities must exist and remain enabled.","evidenceSource":"IAMAI user/account facts"},{"id":"authority","label":"Recovery authority","gate":"Safe to continue","result":"{{emergency.evidence.roleState}}","line":"Each emergency account needs permanent active Global Administrator authority.","evidenceSource":"IAMAI role facts"},{"id":"auth","label":"Independent strong auth","gate":"Safe to prove","result":"{{emergency.evidence.authMethods}}","line":"Emergency authentication must be phishing-resistant and independent of normal administrator dependencies.","evidenceSource":"IAMAI authentication evidence"},{"id":"custody","label":"Credential custody","gate":"Safe to prove","result":"{{emergency.evidence.custody}}","line":"Authorized administrators must be able to reach credentials without depending on the tenant being recovered.","evidenceSource":"owner-confirmed operational evidence"},{"id":"proof","label":"Recovery proof","gate":"Safe for lockout-sensitive rollout","result":"{{emergency.evidence.lastDrill}}","line":"A real sign-in/admin-task drill and monitoring check is required at least every 90 days.","evidenceSource":"recorded drill evidence"}],"whyIamaiSaysThis":"Object configuration can prove identity, role and membership, but only a controlled drill proves that the emergency path actually works when needed."}
@@IAMAI-END

@@IAMAI-BEGIN {"id":"troubleshooting.model","channel":"troubleshooting","states":["missing","partial","verificationRequired","inPlace"],"format":"json","kind":"referenceOnly"}
{"scenarios":[{"id":"candidate-treated-as-decision","classification":"derived","symptom":"IAMAI is about to configure an emergency account that the owner never confirmed.","check":"Verify the stable user ID is in the saved owner-confirmed emergency set.","fix":"Return to Needs decision; do not apply role or exclusion changes.","then":"Resume only after the owner choice is saved.","sources":["ms-emergency"]},{"id":"synced-or-federated","classification":"documented","symptom":"The proposed emergency account depends on on-premises sync or federation.","check":"Inspect the account source and UPN.","fix":"Use the owner-approved dedicated cloud-only onmicrosoft.com emergency identity.","then":"Rescan and re-verify role/membership.","sources":["ms-emergency"]},{"id":"eligible-not-active","classification":"documented","symptom":"The account is only eligible for Global Administrator.","check":"Inspect active role assignments, not only eligibility.","fix":"Assign Global Administrator active permanent for the emergency account.","then":"Read back the role assignment.","sources":["ms-emergency","ms-role-create"]},{"id":"personal-auth-dependency","classification":"documented","symptom":"Emergency authentication depends on an employee phone or normal admin method.","check":"Review the registered emergency authentication method and custody.","fix":"Register the approved independent phishing-resistant method.","then":"Perform a controlled drill.","sources":["ms-emergency"]},{"id":"missing-group-membership","classification":"derived","symptom":"The owner-confirmed emergency user is not in the canonical exclusions group.","check":"Compare the stable user ID to direct group membership.","fix":"Add that user to the resolved group only.","then":"Run the exclusions-group step and rescan.","sources":["ms-group-add","ms-emergency"]},{"id":"report-only-confusion","classification":"documented","symptom":"A policy is flagged unsafe solely because an emergency exclusion is absent while the policy is still Report-only.","check":"Confirm the policy is truly Report-only and therefore cannot block.","fix":"Do not claim current lockout. Ensure the canonical exclusion is added before the policy is enabled.","then":"Recheck at Ready to enforce.","sources":["ms-emergency"]},{"id":"object-state-passes-drill-fails","classification":"derived","symptom":"User, role and group checks pass but the emergency sign-in fails.","check":"Test the real credential, secure client path, monitoring, and any enforced policy still reaching the account.","fix":"Return lockout-sensitive rollout to held state and correct the actual dependency.","then":"Repeat the drill before advancing.","sources":["ms-emergency"]}]}
@@IAMAI-END

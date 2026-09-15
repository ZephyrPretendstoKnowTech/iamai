@@IAMAI-BEGIN {"id":"entra.create-or-correct","channel":"entra","states":["missing"],"format":"markdown","kind":"template"}
Use the emergency accounts you selected.

1. In **Entra admin center → Entra ID → Users**, create or open the dedicated emergency account.
2. For a new account, use the tenant's `*.onmicrosoft.com` domain and keep it cloud-only. Do not source it from federation or on-premises synchronization.
3. Confirm the account is enabled and used only for emergency access, not for normal daily work.
4. Assign **Global Administrator** as an active permanent assignment, not merely eligible through PIM.
5. Register an approved phishing-resistant method that does not depend on normal administrator sign-in. Microsoft recommends a passkey (FIDO2); certificate-based authentication is also supported where PKI already exists. Do not bind the account to an employee's personal device.
6. Add the account to the exclusions group you chose in the Create or Correct Exclusions Group step, and verify that it is a member.
7. Repeat for each selected emergency account. Keep at least two, as Microsoft recommends.
8. Store credentials and recovery keys where authorized staff can retrieve them without this tenant (for example, a safe or an independent vault). Do not store them in IAMAI.
9. Confirm monitoring exists for emergency-account use.
10. Verify after the change: run a controlled drill for each account that tests sign-in and administrative access. A passing configuration check does not prove the recovery path works.

The JSON and PowerShell outputs perform only the permanent Global Administrator assignment and exclusions-group membership for a selected account's user ID. They do not create accounts, register methods or store credentials. Complete the sign-in and other manual checks separately.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"entra.correct.open","channel":"entra","states":["partial"],"format":"markdown","kind":"template"}
Open the selected emergency account by its user ID. Correct only the checks IAMAI marked as failing, and keep the account's other emergency-access settings.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"entra.correct.identity","channel":"entra","states":["partial"],"format":"markdown","kind":"template"}
The emergency account is not cloud-only on the tenant's `onmicrosoft.com` domain. Do not repurpose a normal employee account or a synchronized account. Create or choose a dedicated cloud-only account on the `onmicrosoft.com` domain, select it as an emergency account in IAMAI, and rescan before assigning it Global Administrator.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"entra.correct.enabled","channel":"entra","states":["partial"],"format":"markdown","kind":"template"}
Set **Account enabled** to **Yes** for this emergency account only after confirming it is still an authorized emergency account. Do not bulk-enable disabled accounts.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"entra.correct.role","channel":"entra","states":["partial"],"format":"markdown","kind":"template"}
Under **Roles and administrators**, ensure the exact emergency account has **Global Administrator** as an active permanent assignment. Do not leave the recovery account merely PIM-eligible; activation itself can be unavailable during the incident.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"entra.correct.exclusion-membership","channel":"entra","states":["partial"],"format":"markdown","kind":"template"}
Add this emergency account to the resolved exclusions group. Do not add unrelated administrators, service accounts or convenience exclusions. Policy exclusions themselves are corrected in **Create or Correct Exclusions Group**.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"entra.correct.auth","channel":"entra","states":["partial"],"format":"markdown","kind":"template"}
Before registering a new passkey, open Configure Passkey Authentication. Confirm that this account is included, is not in an excluded group, and that the hardware model is allowed by its applicable policy or profile. Keep existing working recovery credentials. Attestation affects new registration; model restrictions can affect existing sign-ins. Certificate-based recovery does not require FIDO2 configuration.

Register an approved phishing-resistant method for this account. Microsoft recommends a dedicated passkey (FIDO2) security key, or certificate-based authentication where PKI already exists. The method must not depend on an employee's personal phone or the normal administrator sign-in path.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"entra.correct.custody","channel":"entra","states":["partial"],"format":"markdown","kind":"template"}
Correct credential custody outside IAMAI. Authorized staff must be able to retrieve the emergency credentials without this tenant, the normal password manager sign-in path or a single physical location. Do not paste secrets into IAMAI, AI Info, Email or plan exports.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"entra.correct.monitoring","channel":"entra","states":["partial"],"format":"markdown","kind":"template"}
Set up your organization's approved alerting for every emergency-account sign-in and audit activity. IAMAI does not configure monitoring. Verify after the change: a planned test sign-in produces the alert.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"entra.correct.rescan","channel":"entra","states":["partial"],"format":"markdown","kind":"template"}
After the correction, rescan in IAMAI. A passing configuration check does not prove recovery works; record a successful drill separately.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"entra.verify-human","channel":"entra","states":["partial","verificationRequired"],"format":"markdown","kind":"template"}
Check the account configuration first, then run a controlled drill for each selected account:

1. Confirm the account can sign in with its emergency authentication method from the designated secure workstation or client environment.
2. Confirm it can perform an administrative action that shows Global Administrator access.
3. Confirm monitoring or alerting records the planned use.
4. Confirm no personal MFA or SSPR detail, or employee device, has become a hidden dependency.
5. Record the drill result and date outside any record that holds secrets.
6. Repeat at least every 90 days and after material staffing or subscription changes.

A configuration read-back of the user, role and group does not replace this drill.
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

IAMAI found possible emergency access accounts for {{tenant.displayName}}, but no emergency accounts have been selected and saved yet. The next step is that selection, which belongs to the tenant's administrators. A normal daily administrator account is not an emergency access account, and no account change applies until the selection is saved.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"ai.implement","channel":"aiInfo","states":["missing"],"format":"markdown","kind":"template"}
**Contains tenant context. Review before sharing with an external AI service.**

Selected emergency accounts for {{tenant.displayName}}: {{emergency.target.accountsSummary}}. Check each account separately.

Account configuration: cloud-only on the tenant's onmicrosoft.com domain, enabled, permanent active Global Administrator, an approved phishing-resistant method that does not depend on normal administrator sign-in, and membership of the exclusions group. Credential custody, monitoring and a successful recovery drill are separate evidence; a configuration check does not prove recovery works.

The JSON and PowerShell outputs only add the role assignment and group membership. They do not create accounts, register methods or handle credentials. Credentials do not belong in this conversation.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"ai.correct","channel":"aiInfo","states":["partial"],"format":"markdown","kind":"template"}
**Contains tenant context. Review before sharing with an external AI service.**

Emergency account {{emergency.target.upn}} failed one or more checks. Correct that account by its user ID and keep the selected set of emergency accounts. Configuration corrections (cloud-only identity, enabled state, role, exclusions-group membership) are separate from method registration, credential custody, monitoring and the recovery drill, which need action outside IAMAI. No additional account, credential or exclusion is part of this correction.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"ai.verify","channel":"aiInfo","states":["verificationRequired"],"format":"markdown","kind":"template"}
**Contains tenant context. Review before sharing with an external AI service.**

This state needs a controlled recovery drill. Account state: {{emergency.evidence.accountState}}. Role: {{emergency.evidence.roleState}}. Authentication methods: {{emergency.evidence.authMethods}}. Credential custody: {{emergency.evidence.custody}}. Monitoring: {{emergency.evidence.monitoring}}. Last drill: {{emergency.evidence.lastDrill}}. Passing configuration checks do not prove recovery works. Only a successful sign-in and administrative-access drill, with the alert delivered, shows that the emergency path works.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"ai.blocked","channel":"aiInfo","states":["blocked"],"format":"markdown","kind":"template"}
**Contains tenant context. Review before sharing with an external AI service.**

Emergency access work for {{tenant.displayName}} is blocked: {{dependencies.blockers}}. Account changes wait until these are resolved, for example an unsaved account selection, evidence IAMAI could not read, or an exclusions group that is not yet resolved.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"email.admins.drill","channel":"email","states":["verificationRequired"],"format":"markdown","kind":"template","audience":"authorized-emergency-administrators"}
Subject: Action needed: Create or Correct Emergency Access Accounts

Please arrange a controlled emergency access drill. Confirm credential access, sign-in, administrative access and alert delivery for each selected account. Record the result and date; do not send credentials.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"readiness.model","channel":"readiness","states":["needsDecision","missing","partial","verificationRequired"],"format":"json-template","kind":"referenceOnly"}
{"tiles":[{"id":"identity","label":"Emergency identity","gate":"Safe to continue","result":"{{emergency.evidence.accountState}}","line":"Each selected emergency account must be cloud-only on the onmicrosoft.com domain and enabled.","evidenceSource":"IAMAI user/account facts"},{"id":"authority","label":"Recovery authority","gate":"Safe to continue","result":"{{emergency.evidence.roleState}}","line":"Each emergency account needs permanent active Global Administrator authority.","evidenceSource":"IAMAI role facts"},{"id":"auth","label":"Independent strong auth","gate":"Safe to prove","result":"{{emergency.evidence.authMethods}}","line":"Each account needs an approved phishing-resistant method that does not depend on normal administrator sign-in.","evidenceSource":"IAMAI authentication evidence"},{"id":"custody","label":"Credential custody","gate":"Safe to prove","result":"{{emergency.evidence.custody}}","line":"Authorized administrators must be able to reach credentials without depending on the tenant being recovered.","evidenceSource":"owner-confirmed operational evidence"},{"id":"proof","label":"Recovery proof","gate":"Safe for lockout-sensitive rollout","result":"{{emergency.evidence.lastDrill}}","line":"Check each selected account separately. A successful configuration check does not replace a sign-in and administrative-access drill. Microsoft recommends a drill at least every 90 days.","evidenceSource":"recorded drill evidence"}],"whyIamaiSaysThis":"The scan can check identity, role and group membership. Only a controlled drill shows that the emergency path works when needed."}
@@IAMAI-END

@@IAMAI-BEGIN {"id":"troubleshooting.model","channel":"troubleshooting","states":["missing","partial","verificationRequired","inPlace"],"format":"json","kind":"referenceOnly"}
{"scenarios":[{"id":"candidate-treated-as-decision","classification":"derived","symptom":"IAMAI is about to configure an emergency account that the owner never confirmed.","check":"Verify the stable user ID is in the saved owner-confirmed emergency set.","fix":"Return to Needs decision; do not apply role or exclusion changes.","then":"Resume only after the owner choice is saved.","sources":["ms-emergency"]},{"id":"synced-or-federated","classification":"documented","symptom":"The proposed emergency account depends on on-premises sync or federation.","check":"Inspect the account source and UPN.","fix":"Use the owner-approved dedicated cloud-only onmicrosoft.com emergency identity.","then":"Rescan and re-verify role/membership.","sources":["ms-emergency"]},{"id":"eligible-not-active","classification":"documented","symptom":"The account is only eligible for Global Administrator.","check":"Inspect active role assignments, not only eligibility.","fix":"Assign Global Administrator active permanent for the emergency account.","then":"Read back the role assignment.","sources":["ms-emergency","ms-role-create"]},{"id":"personal-auth-dependency","classification":"documented","symptom":"Emergency authentication depends on an employee phone or normal admin method.","check":"Review the registered emergency authentication method and custody.","fix":"Register the approved independent phishing-resistant method.","then":"Perform a controlled drill.","sources":["ms-emergency"]},{"id":"missing-group-membership","classification":"derived","symptom":"The selected emergency account is not in the resolved exclusions group.","check":"Compare the stable user ID to direct group membership.","fix":"Add that user to the resolved group only.","then":"Run the exclusions-group step and rescan.","sources":["ms-group-add","ms-emergency"]},{"id":"report-only-confusion","classification":"documented","symptom":"A policy is flagged unsafe solely because an emergency exclusion is absent while the policy is still Report-only.","check":"Confirm the policy is truly Report-only and therefore cannot block.","fix":"Do not claim current lockout. Ensure the exclusion is in place before the policy is enabled.","then":"Recheck at Ready to enforce.","sources":["ms-emergency"]},{"id":"object-state-passes-drill-fails","classification":"derived","symptom":"User, role and group checks pass but the emergency sign-in fails.","check":"Test the real credential, secure client path, monitoring, and any enforced policy still reaching the account.","fix":"Return lockout-sensitive rollout to held state and correct the actual dependency.","then":"Repeat the drill before advancing.","sources":["ms-emergency"]}]}
@@IAMAI-END

@@IAMAI-BEGIN {"id":"ai.separate","channel":"aiInfo","states":["missing"],"format":"markdown","kind":"template"}

IAMAI lists people who hold a directory role on an account that also has mail or Teams sign-ins. The planned sequence for each person: create a separate cloud-only admin account with no mailbox to read but an email address that reaches the person; register an approved phishing-resistant method on it, such as a passkey or security key; add the same role to it, keeping a Privileged Identity Management role eligible rather than permanent; test sign-in and the required administrative task; then remove the role from the everyday account. Mail, Teams and files stay on the everyday account. Removing the old role before the new account is tested can lock the administrator out.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"entra.create-and-stage","channel":"entra","states":["actionRequired"],"format":"markdown","kind":"template"}
Review {{admin.peopleToSeparate}}. Record Already dedicated to admin work for existing dedicated accounts. Where a handover is needed:
1. Create one dedicated **cloud-only** admin account using the tenant's existing naming convention {{admin.namingConvention}}. Keep it unlicensed unless a separate administrative workload genuinely requires a license.
2. Do not assign ordinary mail/Teams/files productivity use to the admin account. Give it an email address that reaches the person, so role approvals and service notices still arrive.
3. Inventory the everyday account's current directory role assignments and distinguish direct active assignments from PIM eligibility/activation.
4. Reproduce only the intended role assignment on the new admin account under the **same governance model**. Do not turn PIM eligibility into a permanent assignment.
5. Keep the old role assignment until the new account's approved sign-in and required administrative task both work.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"entra.register-and-prove","channel":"entra","states":["credentialProofRequired"],"format":"markdown","kind":"template"}
Register an approved phishing-resistant method on the dedicated admin account, such as a passkey or hardware security key. Sign out, then sign in to the admin account with that method. Keep the old role assignment until this sign-in succeeds and the admin account can complete the required administrative task.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"entra.cutover","channel":"entra","states":["roleCutoverRequired"],"format":"markdown","kind":"template"}
1. Verify the dedicated admin account has the intended role and can perform the required administrative task.
2. Remove that role from the everyday account using the same role-governance surface that owns the assignment.
3. Keep mail, Teams, files, and routine browsing on the everyday account.
4. Check the role assignments on both accounts again and rescan IAMAI.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"entra.verify","channel":"entra","states":["verificationRequired"],"format":"markdown","kind":"template"}
Confirm the dedicated admin account holds the intended role under the same governance model (direct or PIM eligible), and the everyday account no longer holds the migrated role. Rescan IAMAI.

Verify after the change: the administrator can sign in to the admin account with its registered method and complete the required task, and mail, Teams and files stay on the everyday account.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"powershell.run","channel":"powershell","states":["actionRequired","roleCutoverRequired","verificationRequired"],"format":"powershell","kind":"template"}
param(
 [Parameter(Mandatory=$true)][ValidateSet('StageDirectAssignments','ReviewAssignments')][string]$Mode,
 [Parameter(Mandatory=$true)][string]$SourcePrincipalId,
 [Parameter(Mandatory=$true)][string]$TargetAdminPrincipalId
)
$ErrorActionPreference='Stop'
Connect-MgGraph -Scopes 'RoleManagement.ReadWrite.Directory','Directory.Read.All' -NoWelcome
$G='https://graph.microsoft.com/v1.0'
function GuidOk([string]$v,[string]$n){$g=[guid]::Empty;if(-not [guid]::TryParse($v,[ref]$g)){throw "$n must be a GUID."}}
function IG($m,$u,$b=$null){if($null -eq $b){return Invoke-MgGraphRequest -Method $m -Uri $u -OutputType PSObject};Invoke-MgGraphRequest -Method $m -Uri $u -Body ($b|ConvertTo-Json -Depth 20) -ContentType 'application/json' -OutputType PSObject}
GuidOk $SourcePrincipalId 'SourcePrincipalId'; GuidOk $TargetAdminPrincipalId 'TargetAdminPrincipalId'
$src=IG GET "$G/roleManagement/directory/roleAssignments?`$filter=principalId%20eq%20'$SourcePrincipalId'"
if($Mode -eq 'StageDirectAssignments'){
 if(@($src.value).Count -eq 0){throw 'No direct active directory role assignments found. PIM/eligible roles require the PIM workflow; this script will not convert them.'}
 foreach($a in @($src.value)){
   $existing=IG GET "$G/roleManagement/directory/roleAssignments?`$filter=principalId%20eq%20'$TargetAdminPrincipalId'%20and%20roleDefinitionId%20eq%20'$($a.roleDefinitionId)'%20and%20directoryScopeId%20eq%20'$([uri]::EscapeDataString($a.directoryScopeId))'"
   if(@($existing.value).Count -eq 0){IG POST "$G/roleManagement/directory/roleAssignments" @{principalId=$TargetAdminPrincipalId;roleDefinitionId=$a.roleDefinitionId;directoryScopeId=$a.directoryScopeId}|Out-Null}
 }
 Write-Host 'Direct assignments staged on target. OLD assignments were NOT removed. Register/prove the target credential and validate access before cutover.'
}
[pscustomobject]@{Source=@((IG GET "$G/roleManagement/directory/roleAssignments?`$filter=principalId%20eq%20'$SourcePrincipalId'").value);Target=@((IG GET "$G/roleManagement/directory/roleAssignments?`$filter=principalId%20eq%20'$TargetAdminPrincipalId'").value)}
@@IAMAI-END

@@IAMAI-BEGIN {"id":"ai.stage","channel":"aiInfo","states":["actionRequired"],"format":"markdown","kind":"template"}

Tenant: {{tenant.displayName}}. Administrators who need a separate admin account: {{admin.peopleToSeparate}}. Direct active role assignments: {{admin.directRoleAssignments}}. PIM assignments: {{admin.pimAssignments}}.

This state stages the new admin account. Add only the intended roles, under the same governance model: a PIM-eligible role stays eligible and is not converted to permanent access. The old assignment stays in place until the new account's sign-in and required administrative task have been tested. The PowerShell output for this state copies direct active assignments only and removes nothing; PIM roles use the PIM workflow.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"ai.prove","channel":"aiInfo","states":["credentialProofRequired"],"format":"markdown","kind":"template"}

The new admin account needs a tested sign-in before any old role assignment is removed: a successful sign-in with an approved phishing-resistant method, such as a passkey or security key, and a check that the account can complete the required administrative task.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"ai.cutover","channel":"aiInfo","states":["roleCutoverRequired"],"format":"markdown","kind":"template"}

This state moves the role off the everyday account. First confirm the dedicated admin account holds the intended role and can complete the required administrative task. Then remove the role from the everyday account through the surface that owns the assignment: direct role assignment or PIM. The PowerShell output for this state reads both accounts' role assignments; it does not remove anything.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"ai.verify","channel":"aiInfo","states":["verificationRequired"],"format":"markdown","kind":"template"}

This step is waiting to confirm the separation: the dedicated admin account holds the intended role, the everyday account no longer holds it, and mail, Teams and files stay on the everyday account.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"ai.blocked","channel":"aiInfo","states":["blocked"],"format":"markdown","kind":"template"}

This step is blocked. Blockers IAMAI recorded: {{dependencies.blockers}}. Resolve them before creating an admin account or changing role assignments.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"email.admin","channel":"email","states":["actionRequired"],"format":"markdown","kind":"template","audience":"affected-administrators"}
Subject: Planned change: Use Separate Accounts for Admin Work

We plan to move admin work to a separate account. We will test its sign-in and permissions before removing the role from your everyday account.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"readiness.model","channel":"readiness","states":["actionRequired","credentialProofRequired","roleCutoverRequired","verificationRequired"],"format":"json-template","kind":"referenceOnly"}
{"tiles":[{"id":"people","label":"Admins using daily accounts","result":{{json:admin.peopleToSeparate}},"line":"These people have privileged and productivity use on the same account."},{"id":"direct","label":"Direct role assignments","result":{{json:admin.directRoleAssignments}},"line":"Keep the old role assignment until the new account's approved sign-in and required admin task both work."},{"id":"pim","label":"PIM assignments","result":{{json:admin.pimAssignments}},"line":"Keep PIM roles eligible on the new account; do not convert them to permanent assignments."}],"whyIamaiSaysThis":"Microsoft recommends separating privileged administration from high-exposure productivity workflows."}
@@IAMAI-END

@@IAMAI-BEGIN {"id":"troubleshooting.model","channel":"troubleshooting","states":["missing","actionRequired","credentialProofRequired","roleCutoverRequired","verificationRequired","inPlace"],"format":"json","kind":"referenceOnly"}
{"scenarios":[{"id":"new-admin-cannot-sign-in","classification":"derived","symptom":"The dedicated admin account has a role but cannot complete the required phishing-resistant sign-in.","check":"Confirm passkey/security-key registration and applicable Conditional Access prerequisites.","fix":"Keep the old role assignment while correcting the new account's sign-in path; do not weaken the admin policy.","then":"Prove the new sign-in before cutover.","sources":["ms-privileged-accounts"]},{"id":"pim-became-permanent","classification":"derived","symptom":"A PIM-eligible role was recreated as a permanent direct assignment on the new account.","check":"Compare assignment governance on the old and new principals.","fix":"Restore the intended PIM eligibility/activation model and remove the unintended permanent path only after safe access is confirmed.","then":"Re-review role governance.","sources":["ms-zero-trust-privileged"]},{"id":"daily-account-still-privileged","classification":"derived","symptom":"The dedicated account works, but the everyday account still holds the migrated directory role.","check":"Read role assignments for both accounts by object ID.","fix":"After the new admin path is proven, remove the old assignment using the correct direct/PIM governance surface.","then":"Rescan IAMAI and watch subsequent admin sign-ins.","sources":["ms-identity-best-practices"]}]}
@@IAMAI-END

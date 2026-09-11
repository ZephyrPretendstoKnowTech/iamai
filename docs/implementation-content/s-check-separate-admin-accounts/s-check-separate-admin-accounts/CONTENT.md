@@IAMAI-BEGIN {"id":"entra.create-and-stage","channel":"entra","states":["actionRequired"],"format":"markdown","kind":"template"}
For each affected person in {{admin.peopleToSeparate}}:
1. Create one dedicated **cloud-only** admin account using the tenant's existing naming convention {{admin.namingConvention}}. Keep it unlicensed unless a separate administrative workload genuinely requires a license.
2. Do not assign ordinary mail/Teams/files productivity use to the admin account.
3. Inventory the everyday account's current directory role assignments and distinguish direct active assignments from PIM eligibility/activation.
4. Reproduce only the intended role assignment on the new admin account under the **same governance model**. Do not turn PIM eligibility into a permanent assignment.
5. Keep the old role assignment until the new account has a proven phishing-resistant sign-in and the role works.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"entra.register-and-prove","channel":"entra","states":["credentialProofRequired"],"format":"markdown","kind":"template"}
Register a passkey or hardware security key on the dedicated admin account, then sign out and complete a real admin-account sign-in using it. Do not remove the old role assignment until this proof succeeds.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"entra.cutover","channel":"entra","states":["roleCutoverRequired"],"format":"markdown","kind":"template"}
1. Verify the dedicated admin account has the intended role and can perform the required administrative task.
2. Remove that role from the everyday account using the same role-governance surface that owns the assignment.
3. Keep mail, Teams, files, and routine browsing on the everyday account.
4. Re-read both principals' role assignments and rescan IAMAI.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"entra.verify","channel":"entra","states":["verificationRequired"],"format":"markdown","kind":"template"}
Confirm the dedicated admin account owns the intended privileged assignment and has phishing-resistant proof; confirm the daily-driver account no longer owns the migrated role and continues to carry only productivity access.
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
**Contains tenant context. Review before sharing with an external AI service.**

For {{tenant.displayName}}, review the affected administrators {{admin.peopleToSeparate}}. Preserve least privilege and distinguish direct active role assignments {{admin.directRoleAssignments}} from PIM assignments {{admin.pimAssignments}}. Do not convert PIM eligibility into permanent access.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"ai.prove","channel":"aiInfo","states":["credentialProofRequired"],"format":"markdown","kind":"template"}
**Contains tenant context. Review before sharing with an external AI service.**

Explain the proof still required on the new dedicated admin account before any old role assignment is removed. Require a successful phishing-resistant sign-in.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"ai.cutover","channel":"aiInfo","states":["roleCutoverRequired"],"format":"markdown","kind":"template"}
**Contains tenant context. Review before sharing with an external AI service.**

Review the role cutover sequence. The new admin account must be tested first; the daily-driver role is removed only after equivalent intended access is proven.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"ai.verify","channel":"aiInfo","states":["verificationRequired"],"format":"markdown","kind":"template"}
**Contains tenant context. Review before sharing with an external AI service.**

Verify separation: dedicated admin account holds intended role; everyday account no longer holds it; privileged and productivity workflows are distinct.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"ai.blocked","channel":"aiInfo","states":["blocked"],"format":"markdown","kind":"template"}
**Contains tenant context. Review before sharing with an external AI service.**

Explain the blocker without inventing an admin account, role assignment, or governance model: {{dependencies.blockers}}.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"email.admin","channel":"email","states":["actionRequired"],"format":"markdown","kind":"template"}
Subject: Separate admin account setup

We are moving privileged work to a dedicated admin account while leaving mail, Teams, files, and normal browsing on your everyday account. We will add and test the new admin path first, including a passkey/security key sign-in, before removing the role from your everyday account.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"readiness.model","channel":"readiness","states":["actionRequired","credentialProofRequired","roleCutoverRequired","verificationRequired"],"format":"json-template","kind":"referenceOnly"}
{"tiles":[{"id":"people","label":"Admins using daily accounts","result":{{json:admin.peopleToSeparate}},"line":"These people have privileged and productivity use on the same account."},{"id":"direct","label":"Direct role assignments","result":{{json:admin.directRoleAssignments}},"line":"Direct active assignments can be staged without changing their role definition/scope."},{"id":"pim","label":"PIM assignments","result":{{json:admin.pimAssignments}},"line":"PIM governance must stay PIM; do not convert it to permanent access."}],"whyIamaiSaysThis":"Microsoft recommends separating privileged administration from high-exposure productivity workflows."}
@@IAMAI-END

@@IAMAI-BEGIN {"id":"troubleshooting.model","channel":"troubleshooting","states":["actionRequired","credentialProofRequired","roleCutoverRequired","verificationRequired","inPlace"],"format":"json","kind":"referenceOnly"}
{"scenarios":[{"id":"new-admin-cannot-sign-in","classification":"derived","symptom":"The dedicated admin account has a role but cannot complete the required phishing-resistant sign-in.","check":"Confirm passkey/security-key registration and applicable Conditional Access prerequisites.","fix":"Keep the old role assignment while correcting the new account's sign-in path; do not weaken the admin policy.","then":"Prove the new sign-in before cutover.","sources":["ms-privileged-accounts"]},{"id":"pim-became-permanent","classification":"derived","symptom":"A PIM-eligible role was recreated as a permanent direct assignment on the new account.","check":"Compare assignment governance on the old and new principals.","fix":"Restore the intended PIM eligibility/activation model and remove the unintended permanent path only after safe access is confirmed.","then":"Re-review role governance.","sources":["ms-zero-trust-privileged"]},{"id":"daily-account-still-privileged","classification":"derived","symptom":"The dedicated account works, but the everyday account still holds the migrated directory role.","check":"Read role assignments for both stable principal IDs.","fix":"After the new admin path is proven, remove the old assignment using the correct direct/PIM governance surface.","then":"Rescan IAMAI and watch subsequent admin sign-ins.","sources":["ms-identity-best-practices"]}]}
@@IAMAI-END

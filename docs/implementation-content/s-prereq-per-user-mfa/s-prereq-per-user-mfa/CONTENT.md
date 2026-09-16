@@IAMAI-BEGIN {"id":"entra.migrate","channel":"entra","states":["migrationRequired"],"format":"markdown","kind":"template"}
1. Go to **Entra ID > Authentication methods > Policies** and open the migration guidance/status.
2. Audit the methods currently allowed by legacy MFA/SSPR settings and enable the required equivalents in the unified Authentication methods policy for the intended users/groups.
3. Move the migration state through Microsoft's supported migration workflow only after method coverage is preserved.
4. Method migration controls which methods people can use; it does not replace the per-user MFA requirement. Do not disable per-user MFA until a replacement Conditional Access policy that requires MFA is enabled and covers these accounts.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"entra.disable","channel":"entra","states":["readyToDisablePerUser"],"format":"markdown","kind":"template"}
1. Verify the replacement Conditional Access policy is enabled and covers these accounts: {{dependencies.replacementMfaSummary}}.
2. Open the per-user MFA management experience and select only these accounts: {{mfa.perUser.accounts}}.
3. Set their per-user MFA state to **Disabled**.
4. This does **not** remove MFA; the enabled Conditional Access policy now requires it.
5. Read the states back and rescan IAMAI.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"entra.verify","channel":"entra","states":["verificationRequired"],"format":"markdown","kind":"template"}
Confirm every selected account now reads back per-user MFA **Disabled**. Verify after the change: the replacement Conditional Access policy is still enabled for these accounts, and a test sign-in still requires MFA with a method the person can use. Then rescan IAMAI.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"powershell.run","channel":"powershell","states":["readyToDisablePerUser","verificationRequired"],"format":"powershell","kind":"template"}
param([Parameter(Mandatory=$true)][ValidateSet('Disable','Verify')][string]$Mode,[Parameter(Mandatory=$true)][string[]]$UserIds,[switch]$ReplacementMfaReady)
$ErrorActionPreference='Stop';$B='https://graph.microsoft.com/beta'
function G([string]$x){$g=[guid]::Empty;if(-not [guid]::TryParse($x,[ref]$g)){throw "UserId must be GUID: $x"}}
function IG($m,$u,$b=$null){if($null -eq $b){return Invoke-MgGraphRequest -Method $m -Uri $u -OutputType PSObject};Invoke-MgGraphRequest -Method $m -Uri $u -Body ($b|ConvertTo-Json -Depth 10) -ContentType 'application/json' -OutputType PSObject}
foreach($id in $UserIds){G $id}
if($Mode -eq 'Disable'){
 if(-not $ReplacementMfaReady){throw 'Replacement policy-based MFA must be verified before disabling per-user MFA.'}
 foreach($id in $UserIds){IG PATCH "$B/users/$id/authentication/requirements" @{perUserMfaState='disabled'}|Out-Null}
}
$rows=foreach($id in $UserIds){$s=IG GET "$B/users/$id/authentication/requirements";[pscustomobject]@{UserId=$id;PerUserMfaState=$s.perUserMfaState}}
if($Mode -eq 'Disable' -and @($rows|Where-Object{$_.PerUserMfaState -ne 'disabled'}).Count){throw 'At least one user did not read back as disabled.'}
$rows
@@IAMAI-END

@@IAMAI-BEGIN {"id":"ai.blocked","channel":"aiInfo","states":["blocked"],"format":"markdown","kind":"template"}

Per-user MFA stays in place for now: {{dependencies.blockers}}. Keep it until a replacement Conditional Access policy that requires MFA is enabled for the affected accounts.

NEXT STEP: Explain what must be completed before per-user MFA can be retired.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"ai.migrate","channel":"aiInfo","states":["migrationRequired"],"format":"markdown","kind":"template"}

The Authentication methods policy migration still needs work. Migration state: {{mfa.methodsMigrationState}}. Method coverage: {{mfa.methodsCoverage}}. This migration decides which methods people can register and use; it does not require MFA and does not replace per-user MFA. Per-user MFA stays in place during this state.

NEXT STEP: Explain which methods allowed by the legacy MFA and SSPR settings still need an equivalent in the Authentication methods policy.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"ai.disable","channel":"aiInfo","states":["readyToDisablePerUser"],"format":"markdown","kind":"template"}

Per-user MFA can now be disabled for these accounts: {{mfa.perUser.accounts}}. Replacement MFA: {{dependencies.replacementMfaSummary}}. Disabling the per-user setting removes only the old requirement. These accounts stay protected only if the replacement Conditional Access policy is enabled and covers each of them.

NEXT STEP: Explain how to confirm that coverage for each listed account, then how to disable per-user MFA and read the state back.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"ai.verify","channel":"aiInfo","states":["verificationRequired"],"format":"markdown","kind":"template"}

This step is waiting for verification. Accounts: {{mfa.perUser.accounts}}. Each should read back per-user MFA Disabled and remain covered by the enabled replacement Conditional Access policy.

NEXT STEP: Explain how to check each account's per-user MFA state, the replacement policy's coverage, and a test sign-in.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"email.cutover","channel":"email","states":["readyToDisablePerUser"],"format":"markdown","kind":"template","audience":"affected-users"}
Subject: Planned change: Finish Moving Off Per-User MFA

We are moving your MFA requirement from the older per-user setting to Conditional Access. MFA will remain required. If a sign-in prompt does not work as expected, contact IT support with the app and the time it happened.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"readiness.model","channel":"readiness","states":["blocked","migrationRequired","readyToDisablePerUser","verificationRequired"],"format":"json-template","kind":"referenceOnly"}
{"tiles":[{"id":"accounts","label":"Per-user MFA accounts","result":"{{mfa.perUser.accounts}}","line":"Only the listed accounts are changed."},{"id":"migration","label":"Authentication methods migration","result":"{{mfa.methodsMigrationState}}","line":"Method coverage must survive the transition."},{"id":"replacement","label":"Replacement MFA","result":"{{dependencies.replacementMfaSummary}}","line":"Verify active replacement protection for these accounts before disabling their per-user MFA setting."}],"whyIamaiSaysThis":"Removing per-user MFA before a replacement Conditional Access policy is enabled for the same accounts can leave them without an MFA requirement."}
@@IAMAI-END

@@IAMAI-BEGIN {"id":"troubleshooting.model","channel":"troubleshooting","states":["migrationRequired","readyToDisablePerUser","verificationRequired","inPlace"],"format":"json","kind":"referenceOnly"}
{"scenarios":[{"id":"user-still-enabled","classification":"documented","symptom":"A user still reports Enabled or Enforced after the change.","check":"Read `/users/{id}/authentication/requirements` on Graph beta using the same user ID.","fix":"Retry only that user's bounded update after confirming the replacement MFA policy remains enabled for the account.","then":"Read the state back and rescan.","sources":["ms-beta-update"]},{"id":"beta-contract","classification":"documented","symptom":"The beta authentication requirements call changes or fails after an SDK/module update.","check":"Re-check current Microsoft beta documentation before using automation.","fix":"Use the Entra portal as the safe supported admin path if the beta machine contract is no longer valid.","then":"Do not substitute deprecated AzureAD/MSOnline tooling.","sources":["ms-beta-update","ms-entra-ps"]},{"id":"mfa-gap","classification":"derived","symptom":"A user can sign in without the intended MFA after per-user MFA was disabled.","check":"Inspect the replacement Conditional Access policy result and affected user scope.","fix":"Correct the replacement MFA scope immediately; use targeted rollback only if needed.","then":"Rescan IAMAI.","sources":["ms-userstates"]}]}
@@IAMAI-END

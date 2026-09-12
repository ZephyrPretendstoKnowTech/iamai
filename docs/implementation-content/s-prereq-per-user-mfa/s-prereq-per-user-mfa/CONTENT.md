@@IAMAI-BEGIN {"id":"entra.migrate","channel":"entra","states":["migrationRequired"],"format":"markdown","kind":"template"}
1. Go to **Entra ID > Authentication methods > Policies** and open the migration guidance/status.
2. Audit the methods currently allowed by legacy MFA/SSPR settings and enable the required equivalents in the unified Authentication methods policy for the intended users/groups.
3. Move the migration state through Microsoft's supported migration workflow only after method coverage is preserved.
4. Do not disable per-user MFA yet unless IAMAI separately shows replacement policy-based MFA ready.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"entra.disable","channel":"entra","states":["readyToDisablePerUser"],"format":"markdown","kind":"template"}
1. Reconfirm replacement MFA protection: {{dependencies.replacementMfaSummary}}.
2. Open the per-user MFA management experience and select only these resolved accounts: {{mfa.perUser.accounts}}.
3. Set their per-user MFA state to **Disabled**.
4. This does **not** mean MFA is removed; Conditional Access / policy-based MFA is now the authority.
5. Re-read the states and rescan IAMAI.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"entra.verify","channel":"entra","states":["verificationRequired"],"format":"markdown","kind":"template"}
Verify every resolved account now reports per-user MFA **Disabled**, then confirm policy-based MFA still applies as designed.
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
**Contains tenant context. Review before sharing with an external AI service.**

Explain why per-user MFA cannot be retired yet: {{dependencies.blockers}}.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"ai.migrate","channel":"aiInfo","states":["migrationRequired"],"format":"markdown","kind":"template"}
**Contains tenant context. Review before sharing with an external AI service.**

Review the Authentication methods migration state {{mfa.methodsMigrationState}} and current method coverage {{mfa.methodsCoverage}}. Identify method-policy gaps only; do not disable per-user MFA yet.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"ai.disable","channel":"aiInfo","states":["readyToDisablePerUser"],"format":"markdown","kind":"template"}
**Contains tenant context. Review before sharing with an external AI service.**

Review the exact accounts {{mfa.perUser.accounts}} and replacement MFA summary {{dependencies.replacementMfaSummary}}. Confirm the action removes only legacy per-user state, not MFA protection.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"ai.verify","channel":"aiInfo","states":["verificationRequired"],"format":"markdown","kind":"template"}
**Contains tenant context. Review before sharing with an external AI service.**

Verify the resolved users are disabled for per-user MFA and the replacement policy-based MFA path still protects them.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"email.cutover","channel":"email","states":["readyToDisablePerUser"],"format":"markdown","kind":"template","audience":"affected-users"}
Subject: MFA policy transition

Your MFA requirement is moving from the older per-user setting to the tenant's Conditional Access / Authentication methods policy. MFA is not being removed. If you are prompted unexpectedly, contact the help desk with the application and time of the prompt.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"readiness.model","channel":"readiness","states":["blocked","migrationRequired","readyToDisablePerUser","verificationRequired"],"format":"json-template","kind":"referenceOnly"}
{"tiles":[{"id":"accounts","label":"Per-user MFA accounts","result":"{{mfa.perUser.accounts}}","line":"Only exact resolved users are changed."},{"id":"migration","label":"Authentication methods migration","result":"{{mfa.methodsMigrationState}}","line":"Method coverage must survive the transition."},{"id":"replacement","label":"Replacement MFA","result":"{{dependencies.replacementMfaSummary}}","line":"Legacy state is disabled only after policy-based MFA is ready."}],"whyIamaiSaysThis":"Removing legacy per-user MFA before its replacement is ready can create an MFA protection gap."}
@@IAMAI-END

@@IAMAI-BEGIN {"id":"troubleshooting.model","channel":"troubleshooting","states":["migrationRequired","readyToDisablePerUser","verificationRequired","inPlace"],"format":"json","kind":"referenceOnly"}
{"scenarios":[{"id":"user-still-enabled","classification":"documented","symptom":"A user still reports Enabled or Enforced after the change.","check":"Read `/users/{id}/authentication/requirements` on Graph beta using the same stable user ID.","fix":"Retry only that user's bounded update after confirming replacement MFA remains ready.","then":"Read the state back and rescan.","sources":["ms-beta-update"]},{"id":"beta-contract","classification":"documented","symptom":"The beta authentication requirements call changes or fails after an SDK/module update.","check":"Re-check current Microsoft beta documentation before using automation.","fix":"Use the Entra portal as the safe supported admin path if the beta machine contract is no longer valid.","then":"Do not substitute deprecated AzureAD/MSOnline tooling.","sources":["ms-beta-update","ms-entra-ps"]},{"id":"mfa-gap","classification":"derived","symptom":"A user can sign in without the intended MFA after per-user MFA was disabled.","check":"Inspect the replacement Conditional Access policy result and affected user scope.","fix":"Correct the replacement MFA scope immediately; use targeted rollback only if needed.","then":"Rescan IAMAI.","sources":["ms-userstates"]}]}
@@IAMAI-END

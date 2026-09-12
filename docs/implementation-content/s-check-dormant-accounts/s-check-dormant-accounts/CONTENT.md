@@IAMAI-BEGIN {"id":"entra.disable","channel":"entra","states":["disableConfirmed"],"format":"markdown","kind":"template"}
Disable only the explicitly approved dormant account.

1. Open **Entra admin center → Entra ID → Users → All users**.
2. Open the exact account IAMAI resolved: **{{account.current.displayName}}**.
3. Reconfirm the saved disposition is **disable** and the stable object ID is **{{account.current.id}}**.
4. Under **Account status**, edit the account and clear **Account enabled**.
5. Save.
6. Do not delete the user, remove licenses, alter mailbox content, or revoke sessions as part of this step.
7. Rescan IAMAI.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"entra.verify","channel":"entra","states":["verificationRequired"],"format":"markdown","kind":"template"}
Open the same stable user object and confirm **Account enabled** is off. If IAMAI still shows the account as enabled, wait for directory read-back and rescan; do not create or disable another account as a workaround.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"powershell.run","channel":"powershell","states":["disableConfirmed","verificationRequired"],"format":"powershell","kind":"template"}
param(
  [Parameter(Mandatory=$true)][ValidateSet('Disable','VerifyDisabled','ReEnable')][string]$Mode,
  [Parameter(Mandatory=$true)][string]$UserId,
  [Parameter(Mandatory=$false)][ValidateSet('disable','keep')][string]$Disposition
)
$ErrorActionPreference='Stop'
$Graph='https://graph.microsoft.com/v1.0'
function Assert-Guid([string]$Value,[string]$Name){ $g=[guid]::Empty; if(-not [guid]::TryParse($Value,[ref]$g)){ throw "$Name must be a GUID." } }
function Invoke-Graph([string]$Method,[string]$Uri,$Body=$null){
  if($null -eq $Body){ return Invoke-MgGraphRequest -Method $Method -Uri $Uri -OutputType PSObject }
  return Invoke-MgGraphRequest -Method $Method -Uri $Uri -Body ($Body|ConvertTo-Json -Depth 20) -ContentType 'application/json' -OutputType PSObject
}
Assert-Guid $UserId 'UserId'
switch($Mode){
  'Disable' {
    if($Disposition -ne 'disable'){ throw 'Explicit disposition=disable is required. Detection is not authorization.' }
    $before=Invoke-Graph GET "$Graph/users/$UserId?`$select=id,displayName,userPrincipalName,accountEnabled"
    if($before.id -ne $UserId){ throw 'Stable user identity read-back failed.' }
    if($before.accountEnabled -ne $false){ Invoke-Graph PATCH "$Graph/users/$UserId" @{accountEnabled=$false} | Out-Null }
    $after=Invoke-Graph GET "$Graph/users/$UserId?`$select=id,accountEnabled"
    if($after.accountEnabled -ne $false){ throw 'Disable read-back failed.' }
  }
  'VerifyDisabled' {
    $u=Invoke-Graph GET "$Graph/users/$UserId?`$select=id,displayName,userPrincipalName,accountEnabled"
    if($u.accountEnabled -ne $false){ throw 'The account is still enabled.' }
    $u
  }
  'ReEnable' {
    Invoke-Graph PATCH "$Graph/users/$UserId" @{accountEnabled=$true} | Out-Null
    $u=Invoke-Graph GET "$Graph/users/$UserId?`$select=id,accountEnabled"
    if($u.accountEnabled -ne $true){ throw 'Re-enable read-back failed.' }
  }
}
@@IAMAI-END

@@IAMAI-BEGIN {"id":"ai.review","channel":"aiInfo","states":["needsDecision"],"format":"markdown","kind":"template"}
**Contains tenant context. Review before sharing with an external AI service.**

Assess this dormant-account candidate without deciding for the owner. Account: {{account.current.displayName}} ({{account.current.id}}). Activity: {{account.evidence.activitySummary}}. Separate evidence from unknowns and identify what a manager/account owner must confirm before disabling it.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"ai.disable","channel":"aiInfo","states":["disableConfirmed"],"format":"markdown","kind":"template"}
**Contains tenant context. Review before sharing with an external AI service.**

The saved owner disposition for {{account.current.displayName}} is {{account.decision.disposition}}. Review the bounded action: set `accountEnabled=false` on stable ID {{account.current.id}} only. Do not propose deletion, license removal, mailbox changes, or bulk cleanup.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"ai.keep","channel":"aiInfo","states":["keepConfirmed"],"format":"markdown","kind":"template"}
**Contains tenant context. Review before sharing with an external AI service.**

The owner has confirmed {{account.current.displayName}} is still needed. Explain why IAMAI should preserve that disposition and avoid presenting a disable action solely because old activity evidence still matches the dormant-candidate rule.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"ai.verify","channel":"aiInfo","states":["verificationRequired"],"format":"markdown","kind":"template"}
**Contains tenant context. Review before sharing with an external AI service.**

Verify the same stable account after the bounded change. Account-enabled evidence: {{account.current.accountEnabled}}. Confirm no unrelated user properties were intentionally changed and recommend a rescan.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"ai.blocked","channel":"aiInfo","states":["blocked"],"format":"markdown","kind":"template"}
**Contains tenant context. Review before sharing with an external AI service.**

Explain why IAMAI cannot safely resolve this dormant-account candidate: {{dependencies.blockers}}. Do not infer a disable decision from missing sign-in data.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"email.owner.confirm","channel":"email","states":["needsDecision"],"format":"markdown","kind":"template","audience":"account-owner"}
Subject: Confirm whether this account is still needed

IAMAI identified {{account.current.displayName}} as an account that may no longer be in use. Before any change is made, please confirm whether this account is still required. If it is needed, tell us what it is used for. If it is no longer needed, confirm that its sign-in can be disabled. No account will be deleted as part of this step.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"readiness.review","channel":"readiness","states":["needsDecision"],"format":"json-template","kind":"referenceOnly"}
{"tiles":[{"id":"identity","label":"Account","result":"{{account.current.displayName}}","line":"Stable user ID {{account.current.id}} identifies the candidate."},{"id":"activity","label":"Activity evidence","result":"{{account.evidence.activitySummary}}","line":"Activity identifies a review candidate; it does not authorize disabling."}],"whyIamaiSaysThis":"A dormant candidate remains a human decision until an authorized owner confirms its disposition."}
@@IAMAI-END

@@IAMAI-BEGIN {"id":"readiness.model","channel":"readiness","states":["disableConfirmed","verificationRequired"],"format":"json-template","kind":"referenceOnly"}
{"tiles":[{"id":"identity","label":"Account","result":"{{account.current.displayName}}","line":"Stable user ID {{account.current.id}} remains the mutation identity."},{"id":"decision","label":"Owner disposition","result":"{{account.decision.disposition}}","line":"Disable is allowed only after an explicit per-account decision."},{"id":"state","label":"Account enabled","result":"{{account.current.accountEnabled}}","line":"Verification must read back the same user object."}],"whyIamaiSaysThis":"The only tenant mutation in this step is the explicitly approved account-enabled change."}
@@IAMAI-END


@@IAMAI-BEGIN {"id":"troubleshooting.model","channel":"troubleshooting","states":["needsDecision","disableConfirmed","verificationRequired","inPlace"],"format":"json","kind":"referenceOnly"}
{"scenarios":[{"id":"blank-signin","classification":"documented","symptom":"The account has no last sign-in timestamp.","check":"Determine whether the account never signed in, activity predates retained history, or the required activity data could not be read.","fix":"Keep the account in review; obtain owner context before any disable action.","then":"Save an explicit disposition and rescan.","sources":["ms-inactive","ms-signinactivity"]},{"id":"failed-attempt-newer","classification":"documented","symptom":"lastSignInDateTime is recent but actual use is unclear.","check":"Compare with lastSuccessfulSignInDateTime; lastSignInDateTime includes failed interactive attempts.","fix":"Use successful access plus owner context for the decision.","then":"Do not change the account until disposition is explicit.","sources":["ms-signinactivity"]},{"id":"wrong-user-risk","classification":"derived","symptom":"The proposed action targets a display name rather than the saved stable ID.","check":"Resolve the exact user ID and UPN.","fix":"Abort the mutation and target only the saved stable ID.","then":"Re-read the user before retrying.","sources":["ms-user-update"]},{"id":"graph-403","classification":"documented","symptom":"PowerShell returns 403 while changing accountEnabled.","check":"Verify User.EnableDisableAccount.All plus User.Read.All and an administrator role appropriate to the target user.","fix":"Reconnect with the required authorization; do not broaden the operation.","then":"Retry the same single-user action.","sources":["ms-user-update"]}]}
@@IAMAI-END

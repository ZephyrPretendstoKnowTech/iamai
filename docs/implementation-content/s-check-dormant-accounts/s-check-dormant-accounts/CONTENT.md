@@IAMAI-BEGIN {"id":"entra.dormant","channel":"entra","states":["missing"],"format":"markdown","kind":"template"}
Review each account IAMAI lists with its owner before changing it. An old or missing sign-in record is a reason to investigate, not proof that the account is unused: the directory keeps sign-ins only so far back, and never fills the gap in later. Record one outcome for each account:
1. No longer needed: disable sign-in, as at least a User Administrator. Entra admin center → Entra ID → Users → the account → Edit properties → Account enabled: No. Do not delete the account or remove mailbox data.
2. Still needed: confirm its purpose and owner, and verify legitimate use. Once the owner signs in, the directory's record can take a day to catch up, so scan again after that.
3. Shared mailbox or resource account: confirm whether direct sign-in should be blocked. If so, block sign-in the same way; it then stays listed under Inventory and nowhere else.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"ai.dormant","channel":"aiInfo","states":["missing"],"format":"markdown","kind":"template"}

IAMAI lists enabled accounts with no successful sign-in recorded in the last 90 days, or none on record. It reads the directory's last successful sign-in together with the sign-in records it collected; a failed attempt is not use. They are review candidates: a missing or old record can mean the account is unused, that its activity predates the retained history, or that activity data could not be read. For each account the outcomes are: keep it for a confirmed purpose and owner; disable sign-in once the owner confirms it is no longer needed; or block direct sign-in for a shared mailbox or resource account that should never sign in. This step does not delete accounts, remove licences or change mailbox data.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"entra.disable","channel":"entra","states":["disableConfirmed"],"format":"markdown","kind":"template"}
Disable sign-in only for the account whose owner approved it.

1. Open **Entra admin center → Entra ID → Users → All users**, as at least a User Administrator.
2. Open the exact account IAMAI resolved: **{{account.current.displayName}}**.
3. Reconfirm the saved disposition is **disable** and the object ID is **{{account.current.id}}**.
4. Under **Account status**, edit the account and clear **Account enabled**.
5. Save.
6. Do not delete the user, remove licenses, alter mailbox content, or revoke sessions as part of this step.
7. Rescan IAMAI.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"entra.verify","channel":"entra","states":["verificationRequired"],"format":"markdown","kind":"template"}
Open the same user (object ID unchanged) and confirm **Account enabled** is off. If IAMAI still shows the account as enabled, allow time for the directory change to appear and rescan; do not create or disable another account as a workaround.

Verify after the change: the owner confirms that nothing still relying on this account has lost access.
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

This account is a dormant-account candidate waiting for its owner's decision. Account: {{account.current.displayName}} ({{account.current.id}}). Recorded activity: {{account.evidence.activitySummary}}. An old or missing sign-in record is not proof that the account is unused. Before anything changes, the owner must confirm its purpose, or confirm that its sign-in can be disabled.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"ai.disable","channel":"aiInfo","states":["disableConfirmed"],"format":"markdown","kind":"template"}

The owner's saved decision for {{account.current.displayName}} is {{account.decision.disposition}}. The planned change is one setting on one account: Account enabled off (`accountEnabled=false`) on object ID {{account.current.id}}. It does not delete the account, remove licences, change mailbox data or clean up other accounts.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"ai.keep","channel":"aiInfo","states":["keepConfirmed"],"format":"markdown","kind":"template"}

The owner confirmed that {{account.current.displayName}} is still needed. That keep decision stands even if the account's activity still matches the dormant-account rule. It records a confirmed purpose; it is not evidence of a recent successful sign-in. No disable action is planned for this account.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"ai.verify","channel":"aiInfo","states":["verificationRequired"],"format":"markdown","kind":"template"}

This step is waiting to confirm that sign-in is disabled on the same account. Account enabled, as last read: {{account.current.accountEnabled}}. Only the Account enabled setting should have changed. Verify after the change: the owner confirms that nothing still relying on this account has lost access.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"ai.blocked","channel":"aiInfo","states":["blocked"],"format":"markdown","kind":"template"}

IAMAI cannot resolve this dormant-account candidate yet. Blockers: {{dependencies.blockers}}. Missing sign-in data does not support disabling the account.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"email.owner.confirm","channel":"email","states":["needsDecision"],"format":"markdown","kind":"template","audience":"account-owner"}
Subject: Action needed: Disable or Confirm Dormant Accounts

Please confirm whether {{account.current.displayName}} is still needed and what it is used for. If it is no longer needed, confirm that we can disable sign-in. This review does not delete the account or its mailbox.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"readiness.review","channel":"readiness","states":["needsDecision"],"format":"json-template","kind":"referenceOnly"}
{"tiles":[{"id":"identity","label":"Account","result":"{{account.current.displayName}}","line":"User object ID {{account.current.id}} identifies the candidate."},{"id":"activity","label":"Activity evidence","result":"{{account.evidence.activitySummary}}","line":"Confirm the account's purpose and owner before disabling sign-in. Missing activity remains unknown."}],"whyIamaiSaysThis":"This account stays a review candidate until its owner confirms whether to keep it or disable sign-in."}
@@IAMAI-END

@@IAMAI-BEGIN {"id":"readiness.model","channel":"readiness","states":["disableConfirmed","verificationRequired"],"format":"json-template","kind":"referenceOnly"}
{"tiles":[{"id":"identity","label":"Account","result":"{{account.current.displayName}}","line":"The change applies only to user object ID {{account.current.id}}."},{"id":"decision","label":"Owner disposition","result":"{{account.decision.disposition}}","line":"Disabling sign-in is allowed only after an explicit decision for this account."},{"id":"state","label":"Account enabled","result":"{{account.current.accountEnabled}}","line":"Verification reads back the same user object."}],"whyIamaiSaysThis":"The only tenant change in this step is turning off Account enabled for an account whose owner approved it."}
@@IAMAI-END


@@IAMAI-BEGIN {"id":"troubleshooting.model","channel":"troubleshooting","states":["needsDecision","disableConfirmed","verificationRequired","inPlace"],"format":"json","kind":"referenceOnly"}
{"scenarios":[{"id":"blank-signin","classification":"documented","symptom":"The account has no last sign-in timestamp.","check":"Determine whether the account never signed in, activity predates retained history, or the required activity data could not be read.","fix":"Keep the account in review; obtain owner context before any disable action.","then":"Save an explicit disposition and rescan.","sources":["ms-inactive","ms-signinactivity"]},{"id":"failed-attempt-newer","classification":"documented","symptom":"lastSignInDateTime is recent but actual use is unclear.","check":"Compare with lastSuccessfulSignInDateTime; lastSignInDateTime includes failed interactive attempts.","fix":"Use successful access plus owner context for the decision.","then":"Do not change the account until disposition is explicit.","sources":["ms-signinactivity"]},{"id":"wrong-user-risk","classification":"derived","symptom":"The proposed action targets a display name rather than the saved object ID.","check":"Resolve the exact user ID and UPN.","fix":"Stop the change and target only the saved object ID.","then":"Re-read the user before retrying.","sources":["ms-user-update"]},{"id":"graph-403","classification":"documented","symptom":"PowerShell returns 403 while changing accountEnabled.","check":"Verify User.EnableDisableAccount.All plus User.Read.All and an administrator role appropriate to the target user.","fix":"Reconnect with the required authorization; do not broaden the operation.","then":"Retry the same single-user action.","sources":["ms-user-update"]}]}
@@IAMAI-END

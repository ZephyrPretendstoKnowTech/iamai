@@IAMAI-BEGIN {"id":"entra.disable","channel":"entra","states":["readyToDisable"],"format":"markdown","kind":"template"}
1. Confirm IAMAI shows the replacement protections ready for this cutover: {{dependencies.replacementProtectionSummary}}.
2. Go to **Entra ID > Overview > Properties > Manage security defaults**.
3. Set **Security defaults** to **Disabled** and Save.
4. Immediately complete the paired Conditional Access enforcement actions prescribed by the plan; do not leave the tenant between protection models.
5. Rescan IAMAI.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"entra.verify","channel":"entra","states":["verificationRequired"],"format":"markdown","kind":"template"}
Re-open **Manage security defaults** and confirm it is Disabled. Then verify the replacement Conditional Access policies are active and rescan.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"json.disable","channel":"json","states":["readyToDisable"],"format":"json","kind":"template"}
{"isEnabled":false}
@@IAMAI-END

@@IAMAI-BEGIN {"id":"powershell.run","channel":"powershell","states":["readyToDisable","verificationRequired"],"format":"powershell","kind":"template"}
param([Parameter(Mandatory=$true)][ValidateSet('Disable','Verify')][string]$Mode,[switch]$ReplacementProtectionReady)
$ErrorActionPreference='Stop'
if($Mode -eq 'Disable'){
 if(-not $ReplacementProtectionReady){throw 'Replacement Conditional Access protection must be verified before disabling Security Defaults.'}
 Update-MgPolicyIdentitySecurityDefaultEnforcementPolicy -BodyParameter @{isEnabled=$false}
}
Get-MgPolicyIdentitySecurityDefaultEnforcementPolicy
@@IAMAI-END

@@IAMAI-BEGIN {"id":"ai.blocked","channel":"aiInfo","states":["blocked"],"format":"markdown","kind":"template"}
**Contains tenant context. Review before sharing with an external AI service.**

Explain why this cutover is held: {{dependencies.blockers}}. Do not suggest disabling Security Defaults while replacement protection is incomplete.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"ai.disable","channel":"aiInfo","states":["readyToDisable"],"format":"markdown","kind":"template"}
**Contains tenant context. Review before sharing with an external AI service.**

Review the same-day cutover for {{tenant.displayName}}. Replacement protection summary: {{dependencies.replacementProtectionSummary}}. Identify any gap where MFA or legacy-auth blocking would be absent.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"ai.verify","channel":"aiInfo","states":["verificationRequired"],"format":"markdown","kind":"template"}
**Contains tenant context. Review before sharing with an external AI service.**

Verify that Security Defaults is off and replacement Conditional Access protection remains active. Cutover checks: {{evidence.cutoverChecks}}.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"email.cutover","channel":"email","states":["readyToDisable"],"format":"markdown","kind":"template"}
Subject: Microsoft Entra protection cutover

Security Defaults is being replaced with the validated Conditional Access policy set in one controlled change window. If sign-in issues appear, record the affected account, application, time, and policy result; do not disable tenant-wide protection without the rollback owner.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"readiness.model","channel":"readiness","states":["blocked","readyToDisable","verificationRequired"],"format":"json-template","kind":"referenceOnly"}
{"tiles":[{"id":"current","label":"Security Defaults","result":"{{securityDefaults.current.isEnabled}}","line":"This singleton setting is the object changed by this step."},{"id":"replacement","label":"Replacement protection","result":"{{dependencies.replacementProtectionSummary}}","line":"Disable only when replacement protections are ready for the same cutover."}],"whyIamaiSaysThis":"Microsoft recommends no gap between disabling Security Defaults and enabling the replacement Conditional Access protections."}
@@IAMAI-END

@@IAMAI-BEGIN {"id":"troubleshooting.model","channel":"troubleshooting","states":["readyToDisable","verificationRequired","inPlace"],"format":"json","kind":"referenceOnly"}
{"scenarios":[{"id":"protection-gap","classification":"documented","symptom":"Security Defaults is off but replacement Conditional Access protection is not active.","check":"Verify the Security Defaults singleton and the intended replacement policies immediately.","fix":"Complete the approved replacement cutover or use the coordinated rollback; do not leave both protection models inactive.","then":"Rescan IAMAI.","sources":["ms-sd"]},{"id":"graph-403","classification":"documented","symptom":"Graph rejects the Security Defaults update.","check":"Verify Policy.Read.All plus Policy.ReadWrite.ConditionalAccess for write and an appropriate admin role.","fix":"Reconnect with supported permissions/role and retry only the singleton patch.","then":"Read the singleton back.","sources":["ms-sd-graph"]}]}
@@IAMAI-END

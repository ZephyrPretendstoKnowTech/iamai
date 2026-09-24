@@IAMAI-BEGIN {"id":"entra.disable","channel":"entra","states":["readyToDisable"],"format":"markdown","kind":"template"}
1. Confirm the replacement policies are ready to enable in the same change window: {{dependencies.replacementProtectionSummary}}.
2. Go to **Entra ID > Overview > Properties > Manage security defaults**. You need at least the **Conditional Access Administrator** role.
3. Set **Security defaults** to **Disabled (not recommended)** and Save. Once Conditional Access policies exist you cannot turn security defaults back on.
4. Immediately enable the planned replacement Conditional Access policies. Do not leave the tenant between the two protection models: security defaults required MFA, blocked legacy authentication and blocked device code sign-in, and each of those needs its own policy On.
5. Verify after the change: each replacement policy is On with its planned settings, and test sign-ins still work.
6. Rescan IAMAI.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"entra.verify","channel":"entra","states":["verificationRequired"],"format":"markdown","kind":"template"}
Re-open **Manage security defaults** and confirm it reads **Disabled (not recommended)**. Verify after the change: each replacement Conditional Access policy is On with its planned settings, and test sign-ins still work. Then rescan IAMAI.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"json.disable","channel":"json","states":["readyToDisable"],"format":"json","kind":"template"}
{"isEnabled":false}
@@IAMAI-END

@@IAMAI-BEGIN {"id":"powershell.run","channel":"powershell","states":["readyToDisable"],"format":"powershell","kind":"template"}
param([Parameter(Mandatory=$true)][ValidateSet('Disable','Verify')][string]$Mode,[switch]$ReplacementProtectionReady)
$ErrorActionPreference='Stop'
if($Mode -eq 'Disable'){
 if(-not $ReplacementProtectionReady){throw 'Replacement Conditional Access protection must be verified before disabling Security Defaults.'}
 Update-MgPolicyIdentitySecurityDefaultEnforcementPolicy -BodyParameter @{isEnabled=$false}
}
Get-MgPolicyIdentitySecurityDefaultEnforcementPolicy
@@IAMAI-END

@@IAMAI-BEGIN {"id":"ai.blocked","channel":"aiInfo","states":["blocked"],"format":"markdown","kind":"template"}

This changeover is on hold: {{dependencies.blockers}}. Keep Security Defaults enabled until the replacement policies can be enabled immediately after it is turned off, in the same change window.

NEXT STEP: Explain what must be completed before the changeover can start.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"ai.disable","channel":"aiInfo","states":["readyToDisable"],"format":"markdown","kind":"template"}

The changeover from Security Defaults to the planned Conditional Access policies is available for {{tenant.displayName}}, in one change window. Replacement protection: {{dependencies.replacementProtectionSummary}}. Turning off Security Defaults removes its protections straight away, so the replacement policies must be enabled immediately afterwards.

NEXT STEP: Explain the order of the change, and point out any account or sign-in path that would be left without MFA or legacy-authentication blocking.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"ai.verify","channel":"aiInfo","states":["verificationRequired"],"format":"markdown","kind":"template"}

This step is waiting for verification of the changeover. Cutover checks: {{evidence.cutoverChecks}}.

NEXT STEP: Explain how to confirm that Security Defaults reads back as Disabled, that each replacement policy is On with its planned settings, and that test sign-ins still work.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"email.cutover","channel":"email","states":["readyToDisable"],"format":"markdown","kind":"template","audience":"help-desk"}
Subject: Action needed: Turn Off Security Defaults

We plan to replace Security Defaults with the reviewed access policies in one change window. Please be available to help verify sign-in and investigate any unexpected interruption. If a sign-in problem appears, record the affected account, application, time and policy result, and contact the change owner before turning off any tenant-wide protection.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"readiness.model","channel":"readiness","states":["blocked","readyToDisable","verificationRequired"],"format":"json-template","kind":"referenceOnly"}
{"tiles":[{"id":"current","label":"Security Defaults","result":"{{securityDefaults.current.isEnabled}}","line":"This tenant-wide setting is the one this step changes."},{"id":"replacement","label":"Replacement protection","result":"{{dependencies.replacementProtectionSummary}}","line":"Prepare and review the replacement policies before the changeover. Confirm them enabled immediately after Security Defaults is disabled."}],"whyIamaiSaysThis":"Microsoft recommends no gap between disabling Security Defaults and enabling the replacement Conditional Access protections."}
@@IAMAI-END

@@IAMAI-BEGIN {"id":"troubleshooting.model","channel":"troubleshooting","states":["readyToDisable","verificationRequired","inPlace"],"format":"json","kind":"referenceOnly"}
{"scenarios":[{"id":"protection-gap","classification":"documented","symptom":"Security Defaults is off but replacement Conditional Access protection is not active.","check":"Verify the Security Defaults singleton and the intended replacement policies immediately.","fix":"Complete the approved replacement cutover or use the coordinated rollback; do not leave both protection models inactive.","then":"Rescan IAMAI.","sources":["ms-sd"]},{"id":"graph-403","classification":"documented","symptom":"Graph rejects the Security Defaults update.","check":"Verify Policy.Read.All plus Policy.ReadWrite.ConditionalAccess for write and an appropriate admin role.","fix":"Reconnect with supported permissions/role and retry only the singleton patch.","then":"Read the singleton back.","sources":["ms-sd-graph"]}]}
@@IAMAI-END

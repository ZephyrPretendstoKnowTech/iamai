@@IAMAI-BEGIN {"id":"entra.create","channel":"entra","states":["missing"],"format":"markdown","kind":"template"}
1. Go to Entra admin center → Authentication methods → Authentication strengths.
2. Click + New authentication strength.
3. Name: {{strength.target.displayName}}.
4. Select exactly these five methods:
   — Windows Hello for Business
   — Passkeys (FIDO2)
   — Certificate-based authentication (multifactor)
   — Temporary Access Pass (one-time use)
   — Temporary Access Pass (multi-use)
5. Do not select any other methods.
6. Review and Create.
7. Rescan in IAMAI.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"entra.correct.open","channel":"entra","states":["partial"],"format":"markdown","kind":"template"}
Open the custom authentication strength IAMAI resolved: **{{strength.current.displayName}}** (`{{strength.current.id}}`). Review its Conditional Access usage first. This strength is shared: a change applies to every policy that uses it as soon as you save, including policies that are already On.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"entra.correct.metadata","channel":"entra","states":["partial"],"format":"markdown","kind":"template"}
Change the display name to **{{strength.target.displayName}}** only when IAMAI reports a name difference. Leave the allowed combinations unchanged.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"entra.correct.combinations","channel":"entra","states":["partial"],"format":"markdown","kind":"template"}
1. Review **Usage** for the resolved strength so you know which Conditional Access policies will be affected, including any that are already On.
2. Edit allowed methods to exactly the baseline's five: Windows Hello for Business; Passkeys (FIDO2); CBA multifactor; TAP one-time; TAP multi-use.
3. Do not add any other method.
4. Save and re-read the same strength.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"entra.verify","channel":"entra","states":["partial","verificationRequired"],"format":"markdown","kind":"template"}
Verify that the same strength (same object ID) is a custom strength named **{{strength.target.displayName}}** and allows exactly the baseline's five combinations. Rescan IAMAI.

Verify after the change: review each Conditional Access policy that uses this strength and confirm the people it covers can still satisfy one of the five combinations.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"json.create","channel":"json","states":["missing"],"format":"json-template","kind":"template"}
{
  "displayName": {{json:strength.target.displayName}},
  "description": "IAMAI pinned-baseline authentication strength",
  "allowedCombinations": ["windowsHelloForBusiness","fido2","x509CertificateMultiFactor","temporaryAccessPassOneTime","temporaryAccessPassMultiUse"]
}
@@IAMAI-END

@@IAMAI-BEGIN {"id":"json.correct.metadata","channel":"json","states":["partial"],"format":"json-template","kind":"template"}
{"displayName":{{json:strength.target.displayName}},"description":"IAMAI pinned-baseline authentication strength"}
@@IAMAI-END

@@IAMAI-BEGIN {"id":"json.correct.combinations","channel":"json","states":["partial"],"format":"json","kind":"template"}
{"allowedCombinations":["windowsHelloForBusiness","fido2","x509CertificateMultiFactor","temporaryAccessPassOneTime","temporaryAccessPassMultiUse"]}
@@IAMAI-END

@@IAMAI-BEGIN {"id":"powershell.run","channel":"powershell","states":["missing","partial","verificationRequired"],"format":"powershell","kind":"template"}
param(
 [ValidateSet('Create','CorrectMetadata','CorrectCombinations','Verify')][string]$Mode,
 [string]$StrengthId,
 [string]$DisplayName
)
$ErrorActionPreference='Stop'
Connect-MgGraph -Scopes 'Policy.ReadWrite.ConditionalAccess','Policy.Read.All' -NoWelcome
$G='https://graph.microsoft.com/v1.0'
$Desired=@('windowsHelloForBusiness','fido2','x509CertificateMultiFactor','temporaryAccessPassOneTime','temporaryAccessPassMultiUse')
function IG([string]$Method,[string]$Uri,$Body=$null){
 $p=@{Method=$Method;Uri=$Uri}; if($null-ne $Body){$p.Body=($Body|ConvertTo-Json -Depth 20);$p.ContentType='application/json'}
 Invoke-MgGraphRequest @p
}
function ReadStrength([string]$Id){IG 'GET' "$G/policies/authenticationStrengthPolicies/$Id"}
switch($Mode){
 'Create'{if([string]::IsNullOrWhiteSpace($DisplayName)){throw 'DisplayName required'};IG 'POST' "$G/policies/authenticationStrengthPolicies" @{displayName=$DisplayName;description='IAMAI pinned-baseline authentication strength';allowedCombinations=$Desired}}
 'CorrectMetadata'{if(-not $StrengthId){throw 'StrengthId required'};IG 'PATCH' "$G/policies/authenticationStrengthPolicies/$StrengthId" @{displayName=$DisplayName;description='IAMAI pinned-baseline authentication strength'}|Out-Null;ReadStrength $StrengthId}
 'CorrectCombinations'{if(-not $StrengthId){throw 'StrengthId required'};$s=ReadStrength $StrengthId;if($s.policyType -ne 'custom'){throw 'Built-in strengths cannot be modified'};IG 'GET' "$G/policies/authenticationStrengthPolicies/$StrengthId/usage"|Out-Host;IG 'POST' "$G/policies/authenticationStrengthPolicies/$StrengthId/updateAllowedCombinations" @{allowedCombinations=$Desired}|Out-Host;ReadStrength $StrengthId}
 'Verify'{if(-not $StrengthId){throw 'StrengthId required'};$s=ReadStrength $StrengthId;$a=@($s.allowedCombinations|Sort-Object);$d=@($Desired|Sort-Object);if(($a -join '|') -ne ($d -join '|')){throw 'Allowed combinations do not match the pinned target'};$s}
}
@@IAMAI-END

@@IAMAI-BEGIN {"id":"ai.create","channel":"aiInfo","states":["missing"],"format":"markdown","kind":"template"}

An authentication strength is a named set of sign-in methods that a Conditional Access policy can require. The grant "Require multifactor authentication" accepts any second factor the tenant allows, including phone call and text message. This custom strength accepts only five combinations:
— Windows Hello for Business: a biometric or PIN bound to the device
— Passkeys (FIDO2): a security key or a passkey in Microsoft Authenticator
— Certificate-based authentication (multifactor): a smart card or certificate
— Temporary Access Pass (one-time use)
— Temporary Access Pass (multi-use)

The first three are phishing-resistant. A Temporary Access Pass is a time-limited passcode an administrator issues, for example so a person with no usable method can sign in and register one. Because both Temporary Access Pass options are accepted, this strength is not the same as Microsoft's built-in Phishing-resistant MFA strength.

Phone call, text message and Authenticator push notifications are not accepted.

Several baseline policies use this strength. Create it once in this tenant; those policies reference it by its object ID.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"ai.correct","channel":"aiInfo","states":["partial"],"format":"markdown","kind":"template"}

A custom authentication strength exists but differs from the intended one. Differences IAMAI detected: {{strength.current.semanticMismatches}}. Policies that use it: {{strength.current.usage}}. The intended strength allows Windows Hello for Business, Passkeys (FIDO2), multifactor certificate authentication, Temporary Access Pass one-time and Temporary Access Pass multi-use. A change to this shared strength applies to every policy that uses it as soon as it is saved, including policies that are already On.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"ai.verify","channel":"aiInfo","states":["verificationRequired"],"format":"markdown","kind":"template"}

This step is waiting to confirm the authentication strength. The intended result is one custom strength in this tenant that allows exactly Windows Hello for Business, Passkeys (FIDO2), multifactor certificate authentication, Temporary Access Pass one-time and Temporary Access Pass multi-use. Any additional method would apply to every policy that uses this strength.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"ai.blocked","channel":"aiInfo","states":["blocked"],"format":"markdown","kind":"template"}

This prerequisite is blocked. Blockers IAMAI recorded: {{dependencies.blockers}}. Resolve them before creating or changing an authentication strength.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"ai.source-conflict","channel":"aiInfo","states":["sourceConflict"],"format":"markdown","kind":"template"}

IAMAI found a conflict about which authentication strength this step should use: the source descriptions disagree, or more than one tenant strength could be the intended one. None of the candidates counts as selected until the conflict is resolved. Built-in authentication strengths cannot be edited; a correction applies only to a custom strength.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"email.admin-change","channel":"email","states":["partial"],"format":"markdown","kind":"template"}
Subject: Action needed: Create the Baseline's Authentication Strength

Please review the policies using this authentication strength before we change its accepted methods. The target includes Temporary Access Pass as well as phishing-resistant methods.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"readiness.model","channel":"readiness","states":["missing","partial","verificationRequired"],"format":"json-template","kind":"referenceOnly"}
{"tiles":[{"id":"target","label":"Target strength","result":{{json:strength.target.displayName}},"line":"Baseline: Windows Hello for Business, Passkeys (FIDO2), multifactor certificate, TAP one-time, TAP multi-use."},{"id":"usage","label":"Current usage","result":{{json:strength.current.usage}},"line":"Check the five allowed combinations and every policy already using this strength before changing it."}],"whyIamaiSaysThis":"The policies that require this strength need one custom strength in this tenant with the baseline's combinations; the source tenant's object ID cannot be reused."}
@@IAMAI-END

@@IAMAI-BEGIN {"id":"troubleshooting.model","channel":"troubleshooting","states":["missing","partial","verificationRequired"],"format":"json","kind":"referenceOnly"}
{"scenarios":[{"id":"built-in-selected","classification":"documented","symptom":"The resolved object is a built-in authentication strength.","check":"Read policyType on the resolved strength.","fix":"Do not modify it; resolve or create a tenant-local custom strength instead.","then":"Rescan IAMAI.","sources":["ms-strength-update"]},{"id":"dependent-policies","classification":"documented","symptom":"Changing combinations reports Conditional Access references.","check":"Review the usage result and every returned policy reference.","fix":"Change only the baseline combinations in a controlled window; use previousCombinations for rollback if required.","then":"Re-read the strength and dependent policies.","sources":["ms-strength-combos","ms-strength-usage"]},{"id":"duplicate-strength","classification":"derived","symptom":"More than one custom strength appears equivalent.","check":"Compare object IDs and exact allowed combinations.","fix":"Do not create or change a strength until the intended object is resolved.","then":"Rescan after resolution.","sources":["ms-strength-create"]}]}
@@IAMAI-END

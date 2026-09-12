@@IAMAI-BEGIN {"id":"entra.create","channel":"entra","states":["missing"],"format":"markdown","kind":"template"}
1. Open **Entra ID > Authentication methods > Authentication strengths**.
2. Select **New authentication strength**.
3. Name it **{{strength.target.displayName}}**.
4. Select exactly: Windows Hello for Business; Passkeys (FIDO2); Certificate-based authentication (multifactor); Temporary Access Pass (one-time); Temporary Access Pass (multi-use).
5. Review and Create.
6. Read the created object back and rescan IAMAI.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"entra.correct.open","channel":"entra","states":["partial"],"format":"markdown","kind":"template"}
Open the IAMAI-resolved custom authentication strength by stable object identity: **{{strength.current.displayName}}** (`{{strength.current.id}}`). Review current Conditional Access usage before changing the shared object.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"entra.correct.metadata","channel":"entra","states":["partial"],"format":"markdown","kind":"template"}
Correct the display name to **{{strength.target.displayName}}** only when IAMAI reports the metadata mismatch. Preserve allowed combinations.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"entra.correct.combinations","channel":"entra","states":["partial"],"format":"markdown","kind":"template"}
1. Review **Usage** for the resolved strength so you know which Conditional Access policies will be affected.
2. Edit allowed methods to exactly the pinned five: Windows Hello for Business; Passkeys (FIDO2); CBA multifactor; TAP one-time; TAP multi-use.
3. Do not add any other method.
4. Save and re-read the same strength.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"entra.verify","channel":"entra","states":["partial","verificationRequired"],"format":"markdown","kind":"template"}
Verify the same tenant-local strength is custom, named **{{strength.target.displayName}}**, and allows exactly the pinned five combinations. Review its Conditional Access usage and rescan IAMAI.
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
**Contains tenant context. Review before sharing with an external AI service.**

Review the proposed authentication strength for {{tenant.displayName}}. Confirm it contains exactly the pinned five allowed combinations and does not reuse a source-tenant custom strength ID.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"ai.correct","channel":"aiInfo","states":["partial"],"format":"markdown","kind":"template"}
**Contains tenant context. Review before sharing with an external AI service.**

Review only these detected strength mismatches: {{strength.current.semanticMismatches}}. Consider current usage {{strength.current.usage}} before recommending a shared-object change.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"ai.verify","channel":"aiInfo","states":["verificationRequired"],"format":"markdown","kind":"template"}
**Contains tenant context. Review before sharing with an external AI service.**

Verify the resolved strength semantics and dependent usage. Do not broaden the allowed methods.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"ai.blocked","channel":"aiInfo","states":["blocked"],"format":"markdown","kind":"template"}
**Contains tenant context. Review before sharing with an external AI service.**

Explain why this prerequisite is blocked without inventing a strength or tenant object: {{dependencies.blockers}}.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"ai.source-conflict","channel":"aiInfo","states":["sourceConflict"],"format":"markdown","kind":"template"}
**Contains tenant context. Review before sharing with an external AI service.**

Explain the source/resolution conflict. Do not choose among ambiguous tenant strengths or mutate a built-in strength.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"email.admin-change","channel":"email","states":["partial"],"format":"markdown","kind":"template"}
Subject: Authentication strength change review

We are correcting the shared authentication strength used by Conditional Access. The change can affect every policy that references this object, so we are reviewing current usage first and will change only the pinned allowed methods.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"readiness.model","channel":"readiness","states":["missing","partial","verificationRequired"],"format":"json-template","kind":"referenceOnly"}
{"tiles":[{"id":"target","label":"Target strength","result":{{json:strength.target.displayName}},"line":"Pinned baseline: WHfB, FIDO2, multifactor certificate, TAP one-time, TAP multi-use."},{"id":"usage","label":"Current usage","result":{{json:strength.current.usage}},"line":"A shared strength change can affect every referencing Conditional Access policy."}],"whyIamaiSaysThis":"Downstream policies need one tenant-local custom strength with the pinned combinations; the source tenant GUID is not portable."}
@@IAMAI-END

@@IAMAI-BEGIN {"id":"troubleshooting.model","channel":"troubleshooting","states":["missing","partial","verificationRequired"],"format":"json","kind":"referenceOnly"}
{"scenarios":[{"id":"built-in-selected","classification":"documented","symptom":"The resolved object is a built-in authentication strength.","check":"Read policyType on the resolved strength.","fix":"Do not modify it; resolve or create a tenant-local custom strength instead.","then":"Rescan IAMAI.","sources":["ms-strength-update"]},{"id":"dependent-policies","classification":"documented","symptom":"Changing combinations reports Conditional Access references.","check":"Review the usage result and every returned policy reference.","fix":"Change only the pinned combinations in a controlled window; use previousCombinations for rollback if required.","then":"Re-read the strength and dependent policies.","sources":["ms-strength-combos","ms-strength-usage"]},{"id":"duplicate-strength","classification":"derived","symptom":"More than one custom strength appears equivalent.","check":"Compare stable IDs and exact allowed combinations.","fix":"Do not create or mutate until IAMAI/owner resolves the canonical object.","then":"Rescan after resolution.","sources":["ms-strength-create"]}]}
@@IAMAI-END

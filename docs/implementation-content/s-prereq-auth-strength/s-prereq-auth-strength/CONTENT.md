@@IAMAI-BEGIN {"id":"entra.create","channel":"entra","states":["missing"],"format":"markdown","kind":"template"}
1. Open [Microsoft Entra admin center](https://entra.microsoft.com/) → **Entra ID → Authentication methods → Authentication strengths** as a Security Administrator.
2. Select **New authentication strength**.
3. Name: {{strength.target.displayName}}.
4. Select exactly these methods: {{strength.target.methodNames}}.
5. Select **Next**, then **Create**.
6. Return to IAMAI and select **Scan to update the plan**.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"entra.correct.open","channel":"entra","states":["partial"],"format":"markdown","kind":"template"}
Open the custom authentication strength IAMAI resolved: **{{strength.current.displayName}}** (`{{strength.current.id}}`). Review its Conditional Access usage first. This strength is shared: a change applies to every policy that uses it as soon as you save, including policies that are already On.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"entra.correct.metadata","channel":"entra","states":["partial"],"format":"markdown","kind":"template"}
Change the display name to **{{strength.target.displayName}}** only when IAMAI reports a name difference. Leave the allowed combinations unchanged.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"entra.correct.combinations","channel":"entra","states":["partial"],"format":"markdown","kind":"template"}
1. Review **Usage** for the resolved strength so you know which Conditional Access policies will be affected, including any that are already On.
2. Edit allowed methods to exactly {{strength.target.methodNames}}.
3. Do not add any other method.
4. Save and re-read the same strength.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"entra.verify","channel":"entra","states":["partial","verificationRequired"],"format":"markdown","kind":"template"}
Verify that the same strength (same object ID) is a custom strength named **{{strength.target.displayName}}** and allows exactly these combinations: {{strength.target.methodNames}}. Rescan IAMAI.

Verify after the change: review each Conditional Access policy that uses this strength and confirm the people it covers can still satisfy one of the required combinations.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"json.create","channel":"json","states":["missing"],"format":"json-template","kind":"template","method":"POST","endpoint":"https://graph.microsoft.com/v1.0/identity/conditionalAccess/authenticationStrength/policies"}
{
  "displayName": {{json:strength.target.displayName}},
  "allowedCombinations": {{json:strength.target.allowedCombinations}}
}
@@IAMAI-END

@@IAMAI-BEGIN {"id":"json.correct.metadata","channel":"json","states":["partial"],"format":"json-template","kind":"template"}
{"displayName":{{json:strength.target.displayName}}}
@@IAMAI-END

@@IAMAI-BEGIN {"id":"json.correct.combinations","channel":"json","states":["partial"],"format":"json-template","kind":"template"}
{"allowedCombinations":{{json:strength.target.allowedCombinations}}}
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
$Desired=@(ConvertFrom-Json -InputObject '{{json:strength.target.allowedCombinations}}')
function IG([string]$Method,[string]$Uri,$Body=$null){
 $p=@{Method=$Method;Uri=$Uri}; if($null-ne $Body){$p.Body=($Body|ConvertTo-Json -Depth 20);$p.ContentType='application/json'}
 Invoke-MgGraphRequest @p
}
function ReadStrength([string]$Id){IG 'GET' "$G/policies/authenticationStrengthPolicies/$Id"}
switch($Mode){
 'Create'{if([string]::IsNullOrWhiteSpace($DisplayName)){throw 'DisplayName required'};IG 'POST' "$G/policies/authenticationStrengthPolicies" @{displayName=$DisplayName;allowedCombinations=$Desired}}
 'CorrectMetadata'{if(-not $StrengthId){throw 'StrengthId required'};IG 'PATCH' "$G/policies/authenticationStrengthPolicies/$StrengthId" @{displayName=$DisplayName}|Out-Null;ReadStrength $StrengthId}
 'CorrectCombinations'{if(-not $StrengthId){throw 'StrengthId required'};$s=ReadStrength $StrengthId;if($s.policyType -ne 'custom'){throw 'Built-in strengths cannot be modified'};IG 'GET' "$G/policies/authenticationStrengthPolicies/$StrengthId/usage"|Out-Host;IG 'POST' "$G/policies/authenticationStrengthPolicies/$StrengthId/updateAllowedCombinations" @{allowedCombinations=$Desired}|Out-Host;ReadStrength $StrengthId}
 'Verify'{if(-not $StrengthId){throw 'StrengthId required'};$s=ReadStrength $StrengthId;$a=@($s.allowedCombinations|Sort-Object);$d=@($Desired|Sort-Object);if(($a -join '|') -ne ($d -join '|')){throw 'Allowed combinations do not match the pinned target'};$s}
}
@@IAMAI-END

@@IAMAI-BEGIN {"id":"ai.create","channel":"aiInfo","states":["missing"],"format":"markdown","kind":"template"}

An authentication strength is a named set of sign-in methods that a Conditional Access policy can require. The grant "Require multifactor authentication" accepts any second factor the tenant allows, including phone call and text message. This custom strength accepts exactly: {{strength.target.methodNames}}.

Windows Hello for Business, FIDO2 and multifactor certificate authentication are phishing-resistant. A Temporary Access Pass is a time-limited passcode an administrator issues, for example so a person with no usable method can sign in and register one.

Phone call, text message and Authenticator push notifications are not accepted.

Several baseline policies use this strength. Create it once in this tenant; those policies reference it by its object ID.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"ai.correct","channel":"aiInfo","states":["partial"],"format":"markdown","kind":"template"}

A custom authentication strength exists but differs from the intended one. Differences IAMAI detected: {{strength.current.semanticMismatches}}. Policies that use it: {{strength.current.usage}}. The intended strength allows {{strength.target.methodNames}}. A change to this shared strength applies to every policy that uses it as soon as it is saved, including policies that are already On.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"ai.verify","channel":"aiInfo","states":["verificationRequired"],"format":"markdown","kind":"template"}

This step is waiting to confirm the authentication strength. The intended result is one custom strength in this tenant that allows exactly {{strength.target.methodNames}}. Any additional method would apply to every policy that uses this strength.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"ai.blocked","channel":"aiInfo","states":["blocked"],"format":"markdown","kind":"template"}

This prerequisite is blocked. Blockers IAMAI recorded: {{dependencies.blockers}}. Resolve them before creating or changing an authentication strength.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"ai.source-conflict","channel":"aiInfo","states":["sourceConflict"],"format":"markdown","kind":"template"}

IAMAI found a conflict about which authentication strength this step should use: the source descriptions disagree, or more than one tenant strength could be the intended one. None of the candidates counts as selected until the conflict is resolved. Built-in authentication strengths cannot be edited; a correction applies only to a custom strength.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"email.admin-change","channel":"email","states":["partial"],"format":"markdown","kind":"template"}
Subject: Action needed: Create the Baseline's Authentication Strength

Please review the policies using this authentication strength before we change its accepted methods. The target allows exactly {{strength.target.methodNames}}.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"readiness.model","channel":"readiness","states":["missing","partial","verificationRequired"],"format":"json-template","kind":"referenceOnly"}
{"tiles":[{"id":"target","label":"Target strength","result":{{json:strength.target.displayName}},"line":"Baseline: {{strength.target.methodNames}}."},{"id":"usage","label":"Current usage","result":{{json:strength.current.usage}},"line":"Check the allowed combinations and every policy already using this strength before changing it."}],"whyIamaiSaysThis":"The policies that require this strength need one custom strength in this tenant with the baseline's combinations; the source tenant's object ID cannot be reused."}
@@IAMAI-END

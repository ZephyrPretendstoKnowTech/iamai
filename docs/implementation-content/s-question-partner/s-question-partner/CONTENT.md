@@IAMAI-BEGIN {"id":"entra.apply-service-provider-exclusion","channel":"entra","states":["applyRequired"],"format":"markdown","kind":"template"}
1. Confirm the saved partner decision: **{{partner.decisionSummary}}**. Access model: **{{partner.accessModel}}**.
2. For each IAMAI-resolved affected policy {{partner.affectedPolicyNames}}, open the exact policy by its stable identity.
3. Under **Users > Exclude > Guest or external users**, select **Service provider users** only when the canonical target for that policy calls for it.
4. Preserve every other include/exclude assignment and every unrelated condition/control.
5. Save, re-open the same policy, and confirm the Service provider exclusion is present.
6. Do **not** enable cross-tenant MFA trust as a GDAP workaround; GDAP MFA is handled in the provider's home tenant.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"entra.verify","channel":"entra","states":["verificationRequired"],"format":"markdown","kind":"template"}
Re-open every affected policy by stable ID and confirm its external-user exclusion matches the IAMAI-resolved target. Then validate the delegated admin sign-in path without adding named-user exclusions and rescan IAMAI.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"json.policy-patches","channel":"json","states":["applyRequired"],"format":"json-template","kind":"referenceOnly"}
{"kind":"iamaiResolvedConditionalAccessPatchSet","policies":{{json:policyPatches.resolved}},"rule":"Each item must contain the stable Conditional Access policy id and the complete IAMAI-resolved desired conditions object. The package never reconstructs nested user scope from names or partial data."}
@@IAMAI-END

@@IAMAI-BEGIN {"id":"powershell.run","channel":"powershell","states":["applyRequired","verificationRequired"],"format":"powershell","kind":"template"}
param(
 [Parameter(Mandatory=$true)][ValidateSet('ApplyPolicyPatches','VerifyPolicyPatches')][string]$Mode,
 [Parameter(Mandatory=$true)][string]$PolicyPatchesJson
)
$ErrorActionPreference='Stop'
Connect-MgGraph -Scopes 'Policy.Read.All','Policy.ReadWrite.ConditionalAccess' -NoWelcome
$G='https://graph.microsoft.com/v1.0'
function GuidOk([string]$v,[string]$n){$g=[guid]::Empty;if(-not [guid]::TryParse($v,[ref]$g)){throw "$n must be a GUID."}}
function IG($m,$u,$b=$null){if($null -eq $b){return Invoke-MgGraphRequest -Method $m -Uri $u -OutputType PSObject};Invoke-MgGraphRequest -Method $m -Uri $u -Body ($b|ConvertTo-Json -Depth 50) -ContentType 'application/json' -OutputType PSObject}
$patches=@($PolicyPatchesJson|ConvertFrom-Json)
if($patches.Count -eq 0){throw 'No IAMAI-resolved policy patches supplied.'}
foreach($p in $patches){
 GuidOk ([string]$p.id) 'Policy id'
 if($null -eq $p.conditions){throw "Policy $($p.id) is missing complete resolved conditions."}
 if($Mode -eq 'ApplyPolicyPatches'){IG PATCH "$G/identity/conditionalAccess/policies/$($p.id)" @{conditions=$p.conditions}|Out-Null}
 $actual=IG GET "$G/identity/conditionalAccess/policies/$($p.id)"
 [pscustomobject]@{PolicyId=$actual.id;DisplayName=$actual.displayName;ExternalExclusion=$actual.conditions.users.excludeGuestsOrExternalUsers}
}
@@IAMAI-END

@@IAMAI-BEGIN {"id":"ai.decision","channel":"aiInfo","states":["needsDecision"],"format":"markdown","kind":"template"}
**Contains tenant context. Review before sharing with an external AI service.**

Explain the partner-access decision still required for {{tenant.displayName}} using only this evidence: {{partner.currentEvidence}}. Distinguish GDAP/service-provider access from ordinary B2B; do not choose for the owner.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"ai.apply","channel":"aiInfo","states":["applyRequired"],"format":"markdown","kind":"template"}
**Contains tenant context. Review before sharing with an external AI service.**

Review the IAMAI-resolved policy patch set for {{tenant.displayName}}. Confirm that service-provider access is preserved by the Service provider external-user type and not by named-user exclusions.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"ai.verify","channel":"aiInfo","states":["verificationRequired"],"format":"markdown","kind":"template"}
**Contains tenant context. Review before sharing with an external AI service.**

Verify that the affected Conditional Access policies now carry the intended Service provider exclusion and that no broader guest or named-user exception was introduced.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"ai.not-applicable","channel":"aiInfo","states":["notApplicable"],"format":"markdown","kind":"template"}
**Contains tenant context. Review before sharing with an external AI service.**

Explain why this partner/MSP step does not apply. Do not invent a delegated relationship or external-user exception.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"ai.blocked","channel":"aiInfo","states":["blocked"],"format":"markdown","kind":"template"}
**Contains tenant context. Review before sharing with an external AI service.**

Explain the blocker without inventing partner identity or policy scope: {{dependencies.blockers}}.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"email.decision","channel":"email","states":["needsDecision"],"format":"markdown","kind":"template","audience":"client-contact"}
Subject: Confirm MSP delegated-access handling

Please confirm whether the MSP/CSP should retain delegated access while the Conditional Access baseline is deployed. IAMAI will use the Service provider external-user type for approved GDAP access; it will not maintain a list of individual technician exclusions.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"email.change","channel":"email","states":["applyRequired"],"format":"markdown","kind":"template"}
Subject: Conditional Access partner-scope change

We are updating the resolved Conditional Access policy scope so approved service-provider delegated access continues without exempting named technicians. After the change, we will validate the delegated sign-in path and re-read the exact policies.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"readiness.model","channel":"readiness","states":["needsDecision","applyRequired","verificationRequired"],"format":"json-template","kind":"referenceOnly"}
{"tiles":[{"id":"model","label":"Partner access model","result":{{json:partner.accessModel}},"line":"GDAP/service-provider access and ordinary B2B are not interchangeable."},{"id":"decision","label":"Owner decision","result":{{json:partner.decisionSummary}},"line":"A saved decision is required before exclusions change."},{"id":"policies","label":"Affected policies","result":{{json:partner.affectedPolicyNames}},"line":"Updates use stable policy IDs and complete resolved conditions."}],"whyIamaiSaysThis":"Service-provider access is preserved by a specific external-user type, not by permanent exceptions for changing technician accounts."}
@@IAMAI-END

@@IAMAI-BEGIN {"id":"troubleshooting.model","channel":"troubleshooting","states":["applyRequired","verificationRequired","inPlace"],"format":"json","kind":"referenceOnly"}
{"scenarios":[{"id":"gdap-user-blocked","classification":"documented","symptom":"A GDAP technician is blocked by a Conditional Access policy in the customer tenant.","check":"Confirm the sign-in is using GDAP/service-provider access and inspect the policy's Guest or external user scope for Service provider users.","fix":"Correct only the canonical Service provider exclusion on the affected policy; do not exclude the technician by name.","then":"Retest delegated access and rescan IAMAI.","sources":["ms-ca-users","ms-gdap-intro"]},{"id":"gdap-mfa-trust-confusion","classification":"documented","symptom":"Someone proposes enabling inbound cross-tenant MFA trust to fix GDAP MFA.","check":"Confirm the sign-in is actually GDAP.","fix":"Do not change ordinary inbound MFA trust for GDAP; Microsoft states GDAP MFA is required in the home tenant and always trusted in the resource tenant.","then":"Resolve MFA registration in the provider tenant or the GDAP relationship itself.","sources":["ms-cross-tenant-trust"]},{"id":"broad-external-exclusion","classification":"derived","symptom":"A policy now excludes more external-user types than the approved service-provider exception.","check":"Compare the full users conditions to the IAMAI-resolved target.","fix":"Restore the complete canonical conditions on the same stable policy ID.","then":"Re-read and rescan.","sources":["ms-ca-guests-graph","ms-ca-update"]}]}
@@IAMAI-END

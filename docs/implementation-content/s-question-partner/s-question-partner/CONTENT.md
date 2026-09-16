@@IAMAI-BEGIN {"id":"entra.apply-service-provider-exclusion","channel":"entra","states":["applyRequired"],"format":"markdown","kind":"template"}
1. Confirm the saved partner decision: **{{partner.decisionSummary}}**. Access model: **{{partner.accessModel}}**.
2. For each affected policy IAMAI resolved ({{partner.affectedPolicyNames}}), open the policy with the same policy ID.
3. Under **Users > Exclude > Guest or external users**, select **Service provider users** only where the intended target for that policy requires it.
4. Preserve every other include/exclude assignment and every unrelated condition/control.
5. Save, re-open the same policy, and confirm the Service provider exclusion is present.
6. Do **not** enable cross-tenant MFA trust as a GDAP workaround; GDAP MFA is handled in the provider's home tenant. Review ordinary B2B trust settings separately.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"entra.verify","channel":"entra","states":["verificationRequired"],"format":"markdown","kind":"template"}
Re-open every affected policy by the same policy ID and confirm its external-user exclusion matches the intended target. Verify after the change: an approved delegated administrator can still sign in and reach this tenant, with no named-user exclusion added. Then rescan IAMAI.
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

{{tenant.displayName}} has not saved how partner or MSP access should be handled. Evidence: {{partner.currentEvidence}}.

Delegated administration through GDAP signs in as the Service provider users external-user type, and its MFA is completed in the provider's home tenant. Ordinary B2B collaboration uses other external-user types and the tenant's cross-tenant access settings. A partner's name alone does not show which model applies.

NEXT STEP: Explain the options for keeping approved partner access working and what the owner must confirm before any exclusion or trust setting changes. Do not choose for the owner.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"ai.apply","channel":"aiInfo","states":["applyRequired"],"format":"markdown","kind":"template"}

The partner decision is saved for {{tenant.displayName}}: {{partner.decisionSummary}}. Access model: {{partner.accessModel}}.

Affected policies: {{partner.affectedPolicyNames}} [omit this line when unavailable]

Approved delegated access is kept by excluding the Service provider users type only where each policy's intended target requires it, not by excluding named technicians. Other assignments and conditions stay unchanged. Do not enable cross-tenant MFA trust as a GDAP workaround.

NEXT STEP: Explain the change to each affected policy and how to test the delegated access path afterwards.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"ai.verify","channel":"aiInfo","states":["verificationRequired"],"format":"markdown","kind":"template"}

This step is waiting for verification of the partner exclusions.

NEXT STEP: Explain how to confirm that each affected policy has the intended Service provider users exclusion and no broader guest or named-user exception, and how to test the approved delegated access path.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"ai.not-applicable","channel":"aiInfo","states":["notApplicable"],"format":"markdown","kind":"template"}

IAMAI treats this partner or MSP step as not applicable. Do not assume a delegated relationship or suggest an external-user exception that the facts do not show.

NEXT STEP: Explain why no partner change is needed now and what would make the step apply later.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"ai.blocked","channel":"aiInfo","states":["blocked"],"format":"markdown","kind":"template"}

This partner step is on hold: {{dependencies.blockers}}. Do not assume a partner identity or policy scope that the facts do not show.

NEXT STEP: Explain what must be resolved before the partner decision or policy change can continue.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"email.decision","channel":"email","states":["needsDecision","blocked","missing"],"format":"markdown","kind":"template","audience":"client-contact","communicationTrigger":"before choosing and testing the implementation route"}
Subject: Action needed: Exclude the Partner or MSP Accounts

Please confirm how your team administers this tenant and which access must continue during the rollout. We will check the policy scope and test that path with you.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"email.change","channel":"email","states":["applyRequired"],"format":"markdown","kind":"template","audience":"client-contact"}
Subject: Planned change: Exclude the Partner or MSP Accounts

We plan to update the affected Conditional Access policies so approved delegated access from your service provider continues, without exempting individual technicians. After the change, we will re-read each policy and test the delegated sign-in path with you.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"readiness.model","channel":"readiness","states":["needsDecision","applyRequired","verificationRequired"],"format":"json-template","kind":"referenceOnly"}
{"tiles":[{"id":"model","label":"Partner access model","result":{{json:partner.accessModel}},"line":"Confirm whether the relationship uses delegated administration or ordinary B2B collaboration before changing exclusions or trust."},{"id":"decision","label":"Owner decision","result":{{json:partner.decisionSummary}},"line":"A saved decision is required before exclusions change."},{"id":"policies","label":"Affected policies","result":{{json:partner.affectedPolicyNames}},"line":"Updates use the same policy IDs and the complete intended conditions."}],"whyIamaiSaysThis":"Service-provider access is preserved by a specific external-user type, not by permanent exceptions for changing technician accounts."}
@@IAMAI-END

@@IAMAI-BEGIN {"id":"troubleshooting.model","channel":"troubleshooting","states":["applyRequired","verificationRequired","inPlace"],"format":"json","kind":"referenceOnly"}
{"scenarios":[{"id":"gdap-user-blocked","classification":"documented","symptom":"A GDAP technician is blocked by a Conditional Access policy in the customer tenant.","check":"Confirm the sign-in is using GDAP/service-provider access and inspect the policy's Guest or external user scope for Service provider users.","fix":"Correct only the intended Service provider exclusion on the affected policy; do not exclude the technician by name.","then":"Retest delegated access and rescan IAMAI.","sources":["ms-ca-users","ms-gdap-intro"]},{"id":"gdap-mfa-trust-confusion","classification":"documented","symptom":"Someone proposes enabling inbound cross-tenant MFA trust to fix GDAP MFA.","check":"Confirm the sign-in is actually GDAP.","fix":"Do not change ordinary inbound MFA trust for GDAP; Microsoft states GDAP MFA is required in the home tenant and always trusted in the resource tenant.","then":"Resolve MFA registration in the provider tenant or the GDAP relationship itself.","sources":["ms-cross-tenant-trust"]},{"id":"broad-external-exclusion","classification":"derived","symptom":"A policy now excludes more external-user types than the approved service-provider exception.","check":"Compare the full users conditions to the IAMAI-resolved target.","fix":"Restore the complete intended conditions on the same policy ID.","then":"Re-read and rescan.","sources":["ms-ca-guests-graph","ms-ca-update"]}]}
@@IAMAI-END

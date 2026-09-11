@@IAMAI-BEGIN {"id":"ai.source-conflict","channel":"aiInfo","states":["sourceConflict","blocked"],"format":"markdown","kind":"template"}
**Contains tenant context. Review before sharing with an external AI service.**

Explain this source conflict without proposing an implementation: {{sourceConflict.summary}}. Evidence: {{sourceConflict.evidence}}. The retained exported member targets All users without an administrator exclusion, while the documented intent says non-admin users. Do not choose a side or invent a role list.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"readiness.conflict","channel":"readiness","states":["sourceConflict","blocked"],"format":"json-template","kind":"template"}
{"tiles":[{"id":"status","label":"Baseline status","result":"Source conflict","line":{{json:sourceConflict.summary}}},{"id":"tenant","label":"Tenant impact","result":{{json:tenant.displayName}},"line":"No tenant change is authorized by this step while the source remains contradictory."}],"nextSafeAction":"Wait for a reviewed baseline that explicitly resolves administrator scope."}
@@IAMAI-END

@@IAMAI-BEGIN {"id":"troubleshooting.conflict","channel":"troubleshooting","states":["sourceConflict","blocked"],"format":"json","kind":"referenceOnly"}
{"scenarios":[{"id":"tempted-to-deploy-export","classification":"derived","symptom":"The exported baseline policy is available, so an operator proposes deploying it despite the source conflict.","check":"Compare the exported All-users scope with the documented non-admin intent.","fix":"Do not deploy or synthesize automation. Keep the step source-conflicted until the baseline is reviewed.","then":"Re-author only from the resolved baseline member.","sources":["ms-admin-portals-resource","ms-ca-users"]},{"id":"tempted-to-invent-admin-exclusions","classification":"derived","symptom":"An operator proposes excluding whatever accounts IAMAI currently labels Admin.","check":"Confirm that no reviewed baseline source defines that as the intended exclusion semantics.","fix":"Do not convert current tenant observations into baseline author intent.","then":"Wait for source resolution.","sources":["ms-ca-users"]}]}
@@IAMAI-END

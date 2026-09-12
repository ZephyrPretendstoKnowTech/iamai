@@IAMAI-BEGIN {"id":"ai.decision-context","channel":"aiInfo","states":["needsDecision"],"format":"markdown","kind":"template"}
**Contains tenant context. Review before sharing with an external AI service.**

For {{tenant.displayName}}, explain the device-management choices using only this evidence: {{device.evidence.summary}}. Phones: {{device.phones.summary}}. Computers: {{device.computers.summary}}. Intune context: {{device.intune.summary}}. Do not choose for the owner. Explain how each choice changes downstream scope: {{dependencies.downstreamSteps}}.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"ai.decision-recorded","channel":"aiInfo","states":["decided"],"format":"markdown","kind":"template"}
**Contains tenant context. Review before sharing with an external AI service.**

Summarize the already-saved owner device decision and its downstream consequences. Do not reinterpret the decision from newer scan evidence.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"ai.blocked","channel":"aiInfo","states":["blocked"],"format":"markdown","kind":"template"}
**Contains tenant context. Review before sharing with an external AI service.**

Explain why IAMAI cannot currently present/consume the device decision. Do not manufacture a default posture.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"email.decision-request","channel":"email","states":["needsDecision"],"format":"markdown","kind":"template","audience":"client-contact"}
Subject: Device-management decision needed for the IAMAI plan

IAMAI needs a business decision before it can scope the device controls. For phones, choose whether they will be enrolled in Intune, protected only inside supported apps, or not allowed to hold company data. For computers, choose Intune enrollment, Microsoft Entra hybrid join as the accepted managed state, or no management requirement. We will use the saved choice to build the downstream policy; we will not infer it from current device inventory.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"readiness.model","channel":"readiness","states":["needsDecision","decided"],"format":"json-template","kind":"referenceOnly"}
{"tiles":[{"id":"evidence","label":"Observed device evidence","result":{{json:device.evidence.summary}},"line":"Evidence informs the decision but does not make it."},{"id":"phones","label":"Phones","result":{{json:device.phones.summary}},"line":"Choose enrollment, app-only protection, or no company data."},{"id":"computers","label":"Computers","result":{{json:device.computers.summary}},"line":"Choose Intune enrollment, hybrid join, or not managed."}],"whyIamaiSaysThis":"Downstream Conditional Access can require only the device posture the owner has explicitly chosen and the tenant can support."}
@@IAMAI-END

@@IAMAI-BEGIN {"id":"troubleshooting.model","channel":"troubleshooting","states":["needsDecision","decided"],"format":"json","kind":"referenceOnly"}
{"scenarios":[{"id":"evidence-treated-as-decision","classification":"derived","symptom":"A downstream policy scope changed after a scan even though the owner did not change the device decision.","check":"Compare the saved device decision with the new evidence snapshot.","fix":"Restore the saved decision as authority; use scan evidence only to report readiness/gaps.","then":"Rebuild the plan.","sources":["ms-intune-enrollment"]},{"id":"compliance-before-compliance-policy","classification":"documented","symptom":"A plan proposes Require compliant device before usable compliance posture exists.","check":"Confirm Intune compliance policy and at least one compliant device exist for the intended scope.","fix":"Complete the prerequisite posture before enabling the downstream CA control.","then":"Re-evaluate readiness.","sources":["ms-ca-device-compliance"]}]}
@@IAMAI-END

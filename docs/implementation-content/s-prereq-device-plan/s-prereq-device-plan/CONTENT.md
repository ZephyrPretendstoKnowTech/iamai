@@IAMAI-BEGIN {"id":"ai.decision-context","channel":"aiInfo","states":["needsDecision"],"format":"markdown","kind":"template"}
**Contains tenant context. Review before sharing with an external AI service.**

{{tenant.displayName}} has not yet saved how phones and computers should access company data. Device evidence: {{device.evidence.summary}} Phones: {{device.phones.summary}} Computers: {{device.computers.summary}} Intune context: {{device.intune.summary}} Downstream steps that use this choice: {{dependencies.downstreamSteps}}.

The phone options are Intune enrollment, app protection without enrollment, or no company data on phones. The computer options are Intune enrollment, Microsoft Entra hybrid join, or no management requirement. The evidence informs the choice but does not make it, and there is no default.

NEXT STEP: Explain what each option means for the people and devices in this evidence, and how it changes the downstream device-policy scope.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"ai.decision-recorded","channel":"aiInfo","states":["decided"],"format":"markdown","kind":"template"}
**Contains tenant context. Review before sharing with an external AI service.**

The phone and computer choices are saved. Newer scan evidence does not change them; only a new saved choice does. The saved choice sets the scope of the downstream device policies. It does not enroll devices, configure Intune or show that devices meet the chosen requirement.

Downstream steps: {{dependencies.downstreamSteps}} [omit this line when unavailable]

NEXT STEP: Explain what the saved choices mean for the downstream device steps, and which device setup and validation tasks remain.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"ai.blocked","channel":"aiInfo","states":["blocked"],"format":"markdown","kind":"template"}
**Contains tenant context. Review before sharing with an external AI service.**

IAMAI cannot currently show or use the device decision for this plan. Without a saved choice the downstream device policies have no scope to use, so do not suggest a default phone or computer choice to fill the gap.

NEXT STEP: Explain what is holding the decision and what must be resolved before the owner can save it.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"email.decision-request","channel":"email","states":["needsDecision"],"format":"markdown","kind":"template","audience":"client-contact"}
Subject: Action needed: Decide How Devices Are Managed

Please choose how phones and computers should access company data. For phones, the options are enrollment in Intune, protection only inside supported apps, or no company data on phones. For computers, the options are enrollment in Intune, Microsoft Entra hybrid join, or no management requirement. We will use the saved choice when preparing the device policies.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"readiness.model","channel":"readiness","states":["needsDecision","decided"],"format":"json-template","kind":"referenceOnly"}
{"tiles":[{"id":"evidence","label":"Observed device evidence","result":{{json:device.evidence.summary}},"line":"Save a choice for phones and computers. Current inventory informs the choice; it does not make it for you."},{"id":"phones","label":"Phones","result":{{json:device.phones.summary}},"line":"Choose enrollment, app-only protection, or no company data."},{"id":"computers","label":"Computers","result":{{json:device.computers.summary}},"line":"Choose Intune enrollment, hybrid join, or not managed."}],"whyIamaiSaysThis":"Downstream Conditional Access can require only the device posture the owner has explicitly chosen and the tenant can support."}
@@IAMAI-END

@@IAMAI-BEGIN {"id":"troubleshooting.model","channel":"troubleshooting","states":["needsDecision","decided"],"format":"json","kind":"referenceOnly"}
{"scenarios":[{"id":"evidence-treated-as-decision","classification":"derived","symptom":"A downstream policy scope changed after a scan even though the owner did not change the device decision.","check":"Compare the saved device decision with the new evidence snapshot.","fix":"Restore the saved decision as authority; use scan evidence only to report readiness/gaps.","then":"Rebuild the plan.","sources":["ms-intune-enrollment"]},{"id":"compliance-before-compliance-policy","classification":"documented","symptom":"A plan proposes Require compliant device before usable compliance posture exists.","check":"Confirm Intune compliance policy and at least one compliant device exist for the intended scope.","fix":"Complete the prerequisite posture before enabling the downstream CA control.","then":"Re-evaluate readiness.","sources":["ms-ca-device-compliance"]}]}
@@IAMAI-END

@@IAMAI-BEGIN {"id":"entra.review","channel":"entra","states":["reviewRequired"],"format":"markdown","kind":"template"}
Review **one unassessed source policy at a time**.

Pinned source: `8461e0f2fd10167bf034e7c20ed8ea293827d890`

Policies IAMAI currently cannot assess:
{{baseline.unassessedPolicies.summary}}

For each policy:
1. Open the exact pinned source artifact supplied by IAMAI. Do not start from a generic template or from a similarly named tenant policy.
2. Read the source policy end to end. Treat every field IAMAI marked unsupported or unassessed as security-significant.
3. Decide whether the policy applies to this tenant using known tenant/licensing/business context. If the answer is not established, leave the row open.
4. If it does **not** apply, use IAMAI's "Does not apply here" control and record a specific operator reason.
5. If it **does** apply, reproduce the source semantics manually in Entra Conditional Access. Resolve only IAMAI-confirmed tenant placeholders/references. Do not copy author-tenant object IDs into the target tenant.
6. Start the new Conditional Access policy in **Report-only** when that policy type supports Report-only. Do not turn it On from this cleanup workflow.
7. Compare the tenant policy side-by-side with the pinned source. Confirm no population, exclusion, target, filter, authentication context, workload/agent selector, grant, session control, or other source field was dropped.
8. Validate with the Microsoft-supported tools that apply to that policy, record the human disposition, then rescan IAMAI.

This is a manual source-fidelity procedure. IAMAI does not claim equivalence for these rows.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"json.source","channel":"json","states":["reviewRequired"],"format":"json-template","kind":"sourceOnly"}
{
  "artifactType": "iamai-pinned-baseline-source-review",
  "baseline": "jon-hope-pinned",
  "pinCommit": "8461e0f2fd10167bf034e7c20ed8ea293827d890",
  "deployable": false,
  "instructions": "Reference only. Do not POST this bundle. Review and reproduce each applicable policy from its exact pinned source semantics.",
  "policies": {{json:baseline.unassessedPolicies.sourceBundle}}
}
@@IAMAI-END

@@IAMAI-BEGIN {"id":"ai.review","channel":"aiInfo","states":["reviewRequired"],"format":"markdown","kind":"template"}
**Contains tenant context. Review before sharing with an external AI service.**

ROLE
Act as a second reviewer for IAMAI's unassessed pinned-baseline policies. Do not redesign the baseline or infer tenant facts.

AUTHORITY
- IAMAI tenant/product truth and saved operator decisions own tenant-specific facts.
- Jon Hope retained pin `8461e0f2fd10167bf034e7c20ed8ea293827d890` owns the source policy semantics.
- Current Microsoft documentation owns current portal behavior and supported validation tools.

SOURCE POLICIES
{{baseline.unassessedPolicies.summary}}

SOURCE BUNDLE
Use the exact source-only bundle supplied alongside this prompt. Do not replace it with a web copy or newer upstream revision.

TASK
For each policy, identify what the exact source requires, which fields IAMAI cannot assess, what tenant facts are needed to decide applicability, and any source-to-portal translation risk. If information is missing, say Unknown. Never claim equivalence merely because the policy name or major grant looks similar.

DO NOT
Do not invent object IDs, exclusions, filters, contexts, workload identities, agent identities, applicability decisions, or deployment state. Do not generate an automatic bulk deployment for this cleanup set.

OUTPUT
Return a per-policy review: applies / does not apply / unknown, evidence supporting that conclusion, fields requiring human verification, and the exact final comparison checks before any applicable policy leaves Report-only.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"email.review-request","channel":"email","states":["reviewRequired"],"format":"markdown","kind":"template"}
Subject: Review required for baseline policies IAMAI cannot assess automatically

IAMAI found baseline Conditional Access policies whose full semantics it cannot safely compare automatically. Please review the listed policies against our actual tenant requirements and record one outcome for each: applies, does not apply with a reason, or still unknown. Where a policy applies, IT will reproduce it from the retained pinned source in Report-only and validate it before any enforcement decision. No automatic bulk deployment is being used for these policies.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"readiness.model","channel":"readiness","states":["reviewRequired"],"format":"json-template","kind":"referenceOnly"}
{
  "tiles": [
    {
      "id": "source",
      "label": "Pinned source available",
      "gate": "Required",
      "result": "pin 8461e0f2fd10167bf034e7c20ed8ea293827d890",
      "line": "Every review must use the exact retained source artifact.",
      "evidenceSource": "IAMAI baseline package"
    },
    {
      "id": "inventory",
      "label": "Unassessed policies",
      "gate": "Must disposition each",
      "result": "{{baseline.unassessedPolicies.count}}",
      "line": "A row remains open until an operator records applies, does not apply with reason, or unknown.",
      "evidenceSource": "IAMAI baseline inventory"
    },
    {
      "id": "decisions",
      "label": "Recorded review decisions",
      "gate": "Completion",
      "result": "{{review.decisions.summary}}",
      "line": "No package-authored default chooses applicability.",
      "evidenceSource": "saved operator decisions"
    }
  ],
  "whyIamaiSaysThis": "These policies are in Cleanup precisely because IAMAI cannot safely prove their equivalence. Completion is a human source-review result, not a classifier result."
}
@@IAMAI-END

@@IAMAI-BEGIN {"id":"troubleshooting.model","channel":"troubleshooting","states":["reviewRequired","complete"],"format":"json","kind":"referenceOnly"}
{
  "scenarios": [
    {
      "id": "source-missing",
      "classification": "derived",
      "symptom": "An unassessed policy is listed but its exact pinned source artifact is unavailable.",
      "check": "Verify the retained baseline package and pin provenance.",
      "fix": "Stop the review for that policy. Restore access to the exact pinned source; do not recreate it from memory or a newer upstream revision.",
      "then": "Resume review only when source provenance is intact.",
      "sources": ["jon-pinned-source"]
    },
    {
      "id": "field-not-understood",
      "classification": "derived",
      "symptom": "A source field cannot be confidently mapped to current Entra behavior.",
      "check": "Identify the exact source field and current Microsoft documentation for that feature.",
      "fix": "Leave the row open as Unknown. Do not omit the field or approximate it.",
      "then": "Escalate for human review or future classifier support.",
      "sources": ["ms-ca-report-only"]
    },
    {
      "id": "author-tenant-id",
      "classification": "derived",
      "symptom": "The source JSON contains an object ID that does not exist in the target tenant.",
      "check": "Determine whether the source value is a tenant-specific reference or a stable Microsoft first-party identifier.",
      "fix": "Resolve only through IAMAI-confirmed tenant binding/owner evidence. Never copy an author-tenant ID blindly.",
      "then": "Recompare the full source semantics.",
      "sources": ["jon-pinned-source"]
    },
    {
      "id": "report-only-looks-clean",
      "classification": "documented",
      "symptom": "Report-only or What If looks clean and the reviewer wants to mark the policy equivalent without checking unsupported fields.",
      "check": "Confirm every source field was manually reviewed.",
      "fix": "Keep the row unassessed until source semantics and applicability are explicitly dispositioned.",
      "then": "Use Report-only/What If only as supporting validation.",
      "sources": ["ms-ca-report-only","ms-ca-what-if"]
    }
  ]
}
@@IAMAI-END

@@IAMAI-BEGIN {"id":"manual.run","channel":"manual","states":["due"],"format":"markdown","kind":"template"}
Run the drill **one confirmed emergency account at a time**:

Emergency accounts:
{{emergencyAccounts.summary}}

1. Use the approved designated secure workstation or Privileged Access Workstation. Open a private/InPrivate browser session.
2. Retrieve that account's credential/authentication device through the approved offline custody process. Do not copy the secret into notes, scripts, chat, or AI.
3. Sign in interactively with the emergency account.
4. Confirm the expected privileged role is usable by opening the intended Entra administrative surface and performing a minimal **non-destructive read/check**.
5. Do not change policy, roles, credentials, or exclusions merely to prove access.
6. Sign out and close the private browser session.
7. Review the account's sign-in and relevant audit evidence. Confirm the activity is the drill you just performed.
8. If emergency-account alerting is configured, confirm the expected notification reached the monitored destination. If no alert path is configured, record that separately; do not invent an alert result.
9. Repeat for every confirmed emergency account.
10. Only after **all** accounts pass, record the drill date/result in IAMAI. Repeat at least every 90 days.

If any account fails, do not mark the drill Done and do not proceed with dependent lockout-sensitive enforcement.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"manual.recover","channel":"manual","states":["failed"],"format":"markdown","kind":"template"}
The emergency-access drill failed. Treat the escape hatch as **unproven**.

1. Identify the exact failed account and failure point: credential/authentication, sign-in, Conditional Access, privileged role/access, secure-workstation path, log evidence, or configured alert delivery.
2. Stop dependent lockout-sensitive Conditional Access enforcement until the failure is resolved.
3. Correct the defect in the owning emergency-account, exclusion, role, credential-custody, or monitoring workflow. Do not add a broad exclusion or weaken unrelated policies as a shortcut.
4. Repeat the complete drill for the repaired account.
5. Before recording a new proof date, rerun/confirm the drill for every confirmed emergency account so the recorded state represents the full escape hatch.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"ai.run","channel":"aiInfo","states":["due"],"format":"markdown","kind":"template"}
**Contains tenant context. Review before sharing with an external AI service.**

ROLE
Help the operator validate the emergency-access drill procedure without receiving or handling credentials.

TENANT CONTEXT
Confirmed emergency accounts: {{emergencyAccounts.summary}}
Last recorded drill: {{emergencyAccounts.lastDrill}}
Monitoring status: {{monitoring.status}}
Configured alert path: {{monitoring.alertPath}}

GOAL
Confirm the drill proves real interactive sign-in, expected privileged access, a minimal non-destructive administrative action, sign-in/audit evidence, and configured alert delivery when alerting exists.

DO NOT
Do not request passwords, security-key secrets, certificates, TAPs, recovery material, or screenshots containing credentials. Do not propose weakening Conditional Access or adding exclusions to make the test pass.

YOUR ROLE
Review the operator's non-secret observations, identify any missing proof step, classify failures by stage, and state whether the evidence supports recording a successful drill date. Unknown stays Unknown.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"ai.failure","channel":"aiInfo","states":["failed"],"format":"markdown","kind":"template"}
**Contains tenant context. Review before sharing with an external AI service.**

ROLE
Help diagnose a failed emergency-access drill from non-secret evidence only.

ACCOUNTS
{{emergencyAccounts.summary}}

FAILURE
{{drill.failureReason}}

TASK
Separate the failure into credential/authentication, sign-in, Conditional Access, privileged role/access, secure-workstation path, log evidence, or configured-alert delivery. Identify the owning remediation step and the smallest safe correction. Do not accept a workaround that weakens unrelated controls.

DO NOT
Do not request or process emergency credentials, private keys, recovery codes, or other secret material.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"email.admins.failure","channel":"email","states":["failed"],"format":"markdown","kind":"template"}
Subject: Emergency access drill failed — remediation required before enforcement

The emergency-access validation did not complete successfully. Until the failed account/path is corrected and the drill passes again, please treat emergency access as unproven and pause dependent lockout-sensitive Conditional Access enforcement. IT will remediate the specific failure and repeat the full validation. Do not change or broaden exclusions as a temporary workaround unless that change is separately reviewed and approved.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"readiness.model","channel":"readiness","states":["due","failed","current"],"format":"json-template","kind":"referenceOnly"}
{
  "tiles": [
    {
      "id": "accounts",
      "label": "Confirmed emergency accounts",
      "gate": "Every account must pass",
      "result": "{{emergencyAccounts.summary}}",
      "line": "The recorded drill represents the full escape hatch only when every confirmed account passes.",
      "evidenceSource": "IAMAI owner-confirmed tenant truth"
    },
    {
      "id": "last-proof",
      "label": "Last successful drill",
      "gate": "Current for 90 days",
      "result": "{{emergencyAccounts.lastProof}}",
      "line": "A drill older than 90 days is due again.",
      "evidenceSource": "IAMAI recorded operational proof"
    },
    {
      "id": "monitoring",
      "label": "Monitoring / alert path",
      "gate": "Verify when configured",
      "result": "{{monitoring.status}}",
      "line": "Review sign-in/audit evidence for every drill; confirm alert delivery when an alert path exists.",
      "evidenceSource": "tenant monitoring configuration + human observation"
    }
  ],
  "whyIamaiSaysThis": "Emergency access is an operational escape hatch. A configuration scan cannot prove that the credential custody, real sign-in, privileged access, and human response path work together."
}
@@IAMAI-END

@@IAMAI-BEGIN {"id":"troubleshooting.model","channel":"troubleshooting","states":["due","failed","current"],"format":"json","kind":"referenceOnly"}
{
  "scenarios": [
    {
      "id": "credential-fails",
      "classification": "derived",
      "symptom": "The confirmed emergency account cannot authenticate.",
      "check": "Verify the approved offline credential/authentication-device custody and account status without exposing secret material.",
      "fix": "Repair the owning emergency-account credential/authentication path under the emergency-access procedure.",
      "then": "Repeat the drill; do not mark proof current until all accounts pass.",
      "sources": ["ms-emergency-access"]
    },
    {
      "id": "conditional-access-block",
      "classification": "documented",
      "symptom": "The emergency account is blocked by a restrictive Conditional Access policy.",
      "check": "Review the sign-in event and the policy scope/exclusions.",
      "fix": "Correct the owning exclusion/policy defect through the normal reviewed workflow. Do not add a broad ad hoc exclusion.",
      "then": "Repeat the drill before dependent enforcement.",
      "sources": ["ms-emergency-access"]
    },
    {
      "id": "role-missing",
      "classification": "documented",
      "symptom": "Sign-in succeeds but expected emergency administrative access is unavailable.",
      "check": "Verify the emergency account's intended permanent privileged role assignment.",
      "fix": "Correct the emergency-account role configuration through its owning prerequisite.",
      "then": "Repeat the non-destructive admin-access check.",
      "sources": ["ms-emergency-access"]
    },
    {
      "id": "alert-not-received",
      "classification": "documented",
      "symptom": "A configured emergency-account alert did not reach the monitored destination.",
      "check": "Confirm the sign-in/audit event exists and inspect the configured monitoring/notification path.",
      "fix": "Repair the monitoring path separately; do not falsify the drill result.",
      "then": "Retest alert delivery.",
      "sources": ["ms-emergency-access"]
    },
    {
      "id": "recent-signin-not-a-drill",
      "classification": "derived",
      "symptom": "Logs show recent emergency-account activity but no recorded validation procedure.",
      "check": "Determine whether the event was an intentional drill or emergency use and whether administrative access was actually validated.",
      "fix": "Do not infer completion. Run and record the full controlled drill if proof is absent.",
      "then": "Store the explicit proof date/result.",
      "sources": ["ms-emergency-access"]
    }
  ]
}
@@IAMAI-END

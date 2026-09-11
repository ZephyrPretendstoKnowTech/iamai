@@IAMAI-BEGIN {"id":"entra.register","channel":"entra","states":["register"],"format":"markdown","kind":"template"}
1. Sign in as **{{operator.displayName}}** on a device you control.
2. Open **Security info** (`https://aka.ms/mfasetup`) and choose **Add sign-in method > Passkey**.
3. Register either the already-approved Microsoft Authenticator passkey or a FIDO2 security key. Do not change tenant passkey policy here.
4. Finish the authenticator's local PIN/biometric/security-key interaction.
5. Leave existing recovery methods intact unless another IAMAI step explicitly removes them.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"entra.prove","channel":"entra","states":["verificationRequired"],"format":"markdown","kind":"template"}
1. Sign out completely.
2. Start a new sign-in as **{{operator.displayName}}** and deliberately use the registered passkey/security key.
3. Confirm the sign-in succeeds.
4. Rescan IAMAI so the operator's phishing-resistant proof can be evaluated from tenant evidence.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"ai.register","channel":"aiInfo","states":["register"],"format":"markdown","kind":"template"}
**Contains tenant context. Review before sharing with an external AI service.**

Review the operator's current methods: {{operator.current.methods}}. Explain which already-approved passkey path can be registered without changing tenant policy. Do not claim a credential can be registered non-interactively.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"ai.verify","channel":"aiInfo","states":["verificationRequired"],"format":"markdown","kind":"template"}
**Contains tenant context. Review before sharing with an external AI service.**

Review the operator proof state: {{operator.current.proof}}. Distinguish "registered" from a successful phishing-resistant sign-in.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"ai.blocked","channel":"aiInfo","states":["blocked"],"format":"markdown","kind":"template"}
**Contains tenant context. Review before sharing with an external AI service.**

Explain the blocker: {{dependencies.blockers}}. Do not recommend bypassing passkey policy or adding Conditional Access exclusions.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"readiness.model","channel":"readiness","states":["register","verificationRequired"],"format":"json-template","kind":"referenceOnly"}
{"tiles":[{"id":"operator","label":"Operator","result":{{json:operator.displayName}},"line":"The administrator making the rollout needs a phishing-resistant method before admin enforcement."},{"id":"methods","label":"Registered methods","result":{{json:operator.current.methods}},"line":"Registration alone is not proof."},{"id":"proof","label":"Phishing-resistant proof","result":{{json:operator.current.proof}},"line":"Complete one successful passkey/security-key sign-in and rescan."}],"whyIamaiSaysThis":"The operator must be able to satisfy the stronger admin policy before it becomes an enforcement dependency."}
@@IAMAI-END

@@IAMAI-BEGIN {"id":"troubleshooting.model","channel":"troubleshooting","states":["register","verificationRequired"],"format":"json","kind":"referenceOnly"}
{"scenarios":[{"id":"passkey-option-missing","classification":"derived","symptom":"Passkey is not available as an Add sign-in method option.","check":"Confirm the tenant passkey settings prerequisite is complete and targets this account.","fix":"Correct the passkey-settings prerequisite; do not add an admin-policy exclusion.","then":"Retry registration.","sources":["ms-authenticator-passkey","ms-security-key-passkey"]},{"id":"registered-not-proven","classification":"derived","symptom":"The method is registered but IAMAI still does not mark the operator ready.","check":"Look for a successful phishing-resistant sign-in after registration.","fix":"Sign out and perform a new sign-in using the passkey/security key.","then":"Rescan IAMAI.","sources":["ms-authenticator-passkey","ms-security-key-passkey"]}]}
@@IAMAI-END

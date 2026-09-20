@@IAMAI-BEGIN {"id":"entra.register","channel":"entra","states":["register"],"format":"markdown","kind":"template"}
1. Sign in as **{{operator.displayName}}** on a device you control, at **Security info** (`https://mysignins.microsoft.com/security-info`), and complete multifactor authentication there.
2. Register within five minutes of that check: Microsoft requires an MFA completed in the last five minutes before a passkey (FIDO2) can be registered, so an old browser tab is refused.
3. Choose the method by its own menu entry: **Add sign-in method > Passkey** registers a FIDO2 security key; **Add sign-in method > Passkey in Microsoft Authenticator** registers one in the app. Microsoft recommends a security key for users with elevated privileges. Do not change tenant passkey policy here.
4. Finish the authenticator's local PIN, biometric or security-key interaction. A passkey in Authenticator also needs a screen lock on the phone and Authenticator enabled as the device's passkey provider.
5. Leave existing recovery methods intact unless another IAMAI step explicitly removes them.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"entra.prove","channel":"entra","states":["verificationRequired"],"format":"markdown","kind":"template"}
1. Sign out completely.
2. Start a new sign-in as **{{operator.displayName}}** and deliberately use the registered passkey/security key.
3. Confirm the sign-in succeeds. If it fails, check the error shown, the passkey method policy for your account and support on the device you used, then retry.
4. Rescan IAMAI so the phishing-resistant sign-in can be checked in the tenant's sign-in records.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"ai.register","channel":"aiInfo","states":["register"],"format":"markdown","kind":"template"}

This step starts with registering an approved passkey or security key for {{operator.displayName}}. Current registered methods: {{operator.current.methods}}.

Registration is an interactive action the operator completes in Security info; it cannot be done for them by script, and it does not change the tenant's passkey policy. Keep existing recovery methods while testing. A registered method still needs a successful sign-in before this step is complete.

NEXT STEP: Explain which approved path the operator can register now (a passkey in Microsoft Authenticator or a FIDO2 security key) and the sign-in test that follows.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"ai.verify","channel":"aiInfo","states":["verificationRequired"],"format":"markdown","kind":"template"}

IAMAI has not yet seen the successful phishing-resistant sign-in this step needs for {{operator.displayName}}. Sign-in evidence: {{operator.current.proof}}. Registration alone does not complete the step, and the evidence covers only the sign-in records in this scan.

NEXT STEP: Explain how to sign out and sign in again deliberately with the passkey or security key, what to check if it fails (the error, the method policy, device support), and when to rescan.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"ai.blocked","channel":"aiInfo","states":["blocked"],"format":"markdown","kind":"template"}

This step is on hold: {{dependencies.blockers}}. Resolve the blocker rather than bypassing the passkey method policy or adding a Conditional Access exclusion for the operator.

NEXT STEP: Explain what must be resolved before the operator can register and test a passkey or security key.
@@IAMAI-END

@@IAMAI-BEGIN {"id":"readiness.model","channel":"readiness","states":["register","verificationRequired"],"format":"json-template","kind":"referenceOnly"}
{"tiles":[{"id":"operator","label":"Operator","result":{{json:operator.displayName}},"line":"The administrator making the rollout needs a phishing-resistant method before admin enforcement."},{"id":"methods","label":"Registered methods","result":{{json:operator.current.methods}},"line":"Registration alone is not proof."},{"id":"proof","label":"Phishing-resistant proof","result":{{json:operator.current.proof}},"line":"Register an approved passkey or security key, then complete a successful sign-in with it and rescan."}],"whyIamaiSaysThis":"The operator must be able to satisfy the stronger admin policy before it becomes an enforcement dependency."}
@@IAMAI-END

@@IAMAI-BEGIN {"id":"troubleshooting.model","channel":"troubleshooting","states":["register","verificationRequired"],"format":"json","kind":"referenceOnly"}
{"scenarios":[{"id":"passkey-option-missing","classification":"documented","symptom":"Passkey is not available as an Add sign-in method option, or registration is refused.","check":"Check three settings on the tenant's Passkey (FIDO2) method policy: Allow self-service set up, which blocks Security info registration when it is No; enforced attestation, which blocks a passkey created in Authenticator through the browser flow; and any key restriction that excludes the authenticator used. Then check that the MFA completed for this session is less than five minutes old.","fix":"Correct the passkey-settings prerequisite or repeat the MFA; do not add an admin-policy exclusion.","then":"Retry registration.","sources":["ms-passkey-enable","ms-authenticator-passkey","ms-security-key-passkey"]},{"id":"registered-not-proven","classification":"derived","symptom":"The method is registered but IAMAI still does not mark the operator ready.","check":"Look for a successful phishing-resistant sign-in after registration.","fix":"Sign out and perform a new sign-in using the passkey/security key.","then":"Rescan IAMAI.","sources":["ms-authenticator-passkey","ms-security-key-passkey"]}]}
@@IAMAI-END

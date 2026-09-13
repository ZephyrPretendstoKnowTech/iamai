# Content Review — Segments

Each segment applies 5 content specs. Read the spec file, grep for each CURRENT string, apply the TARGET replacement, build, test, commit. Follow RUN-CONTEXT.md for rules and failure protocol.

---

## S0 — Prerequisite steps

Apply these specs in order:

1. `docs/content-review/specs/content-spec-break-glass.md`
2. `docs/content-review/specs/content-spec-exclusions-group.md`
3. `docs/content-review/specs/content-spec-device-plan.md`
4. `docs/content-review/specs/content-spec-passkey-settings.md`
5. `docs/content-review/specs/content-spec-auth-strength.md`

Commit each spec individually. End with tree green.

---

## S1 — MFA and authentication policy steps

Apply these specs in order:

1. `docs/content-review/specs/content-spec-mfa-everyone.md`
2. `docs/content-review/specs/content-spec-guests-mfa.md`
3. `docs/content-review/specs/content-spec-phishing-resistant.md`
4. `docs/content-review/specs/content-spec-auth-transfer.md`
5. `docs/content-review/specs/content-spec-device-code.md`

Commit each spec individually. End with tree green.

---

## S2 — Session and admin policy steps

Apply these specs in order:

1. `docs/content-review/specs/content-spec-admin-session.md`
2. `docs/content-review/specs/content-spec-admin-portals.md`
3. `docs/content-review/specs/content-spec-token-protection.md`
4. `docs/content-review/specs/content-spec-block-legacy-auth.md`
5. `docs/content-review/specs/content-spec-trusted-network.md`

Commit each spec individually. End with tree green.

---

## S3 — Risk, device, and campaign steps

Apply these specs in order:

1. `docs/content-review/specs/content-spec-sign-in-risk-medium.md`
2. `docs/content-review/specs/content-spec-sign-in-risk-high.md`
3. `docs/content-review/specs/content-spec-managed-device.md`
4. `docs/content-review/specs/content-spec-intune-enrollment.md`
5. `docs/content-review/specs/content-spec-campaign.md`

Commit each spec individually. End with tree green.

---

## S4 — Remaining new-policy steps

Apply these specs in order:

1. `docs/content-review/specs/content-spec-pim-activation-reauth.md`
2. `docs/content-review/specs/content-spec-register-info-protected.md`
3. `docs/content-review/specs/content-spec-all-users-no-persistence.md`
4. `docs/content-review/specs/content-spec-block-unsupported-platforms.md`
5. `docs/content-review/specs/content-spec-geo-restriction.md`

Commit each spec individually. End with tree green.

---

## S5 — Final steps and cleanup

Apply these specs in order:

1. `docs/content-review/specs/content-spec-user-risk-medium.md`
2. `docs/content-review/specs/content-spec-notAssessed.md`
3. `docs/content-review/specs/content-spec-rename-policies.md`
4. `docs/content-review/specs/content-spec-separate-accounts.md`
5. `docs/content-review/specs/content-spec-allowed-countries.md`

Commit each spec individually. End with tree green.

After all five specs: review `docs/content-review/BLOCKED.md`. If any items are recorded, summarize them at the end of the log.

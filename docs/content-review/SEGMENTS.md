# Content Review — Segments

Phase 1 (S0–S1): Universal fixes — shared renderer logic and cross-cutting content patterns.
Phase 2 (S2–S7): Per-step content specs — 5 specs per segment, 30 total.

Read RUN-CONTEXT.md before starting any segment.

---

## S0 — Universal renderer fixes (R1–R9) and UI polish (U-P1 to U-P3)

Read `docs/content-review/specs/UNIVERSAL-CONTENT-CHANGES.md`. Apply every item in the "Renderer fixes" section and every item in the "UI polish" section, in order:

1. **R1** — Milestone shows lane substatus instead of date → show "—" when no date is scheduled
2. **R2** — Readiness bar filler text in second location → suppress known filler phrases
3. **R3** — Prerequisite tile label "READY" → "IN PROGRESS" / "COMPLETED" / "WAITING"
4. **R4** — Tile icon inconsistency → consistent "!" / "✓" / neutral rules
5. **R5** — Readiness tile clear text → "No blockers. Ready to proceed."
6. **R6** — Action column heading — add bold label above inputs
7. **R7** — Action column background extends to bottom
8. **R8** — Enforced policy substatus: Correct wins over Decision
9. **R9** — "No implementation needed" must not appear on steps with drift
10. **U-P1** — Header tile date formatting (CSS fix)
11. **U-P2** — Projected finish timeline calibration (scheduler logic — apply if straightforward, BLOCKED.md if complex)
12. **U-P3** — Sign-in session persistence (MSAL token cache — apply if straightforward, BLOCKED.md if complex)
13. **D1** — Remove orphaned "shared-device exception" from Managed Device Done When
14. **D2** — Implementation channels must never be hidden — no exceptions, ever
15. **D3** — Add Defer button to cleanup steps
16. **D4** — Emergency Access tile icon: ✓ when minimum is met, even with open hardening
17. **D5** — Auto-expand blocking ("!") tiles only, with height cap so the page doesn't scroll forever

Commit each item individually: `content: R1 — milestone lane substatus fix`. Build must pass after each.

---

## S1 — Universal content patterns (C1–C5)

Read `docs/content-review/specs/UNIVERSAL-CONTENT-CHANGES.md`. Apply every item in the "Content patterns" section:

1. **C1** — Internal IAMAI terms → plain English. Use the find/replace table. Grep `src/` and `docs/` for every "Find" term and replace every hit. Do not skip any.
2. **C2** — Readiness explanation exclusion-group sentence. Find the source (template or per-file), replace everywhere.
3. **C3** — Threshold tile collapsed context suffixes ("33%" → "33% MFA-ready"). Fix the tile summary generator.
4. **C4** — Long tile labels → short labels. Fix the label source.
5. **C5** — Dropdown/radio option labels need explanation suffixes. Fix every option source.

Commit each pattern individually: `content: C1 — internal IAMAI terms sweep`. Build must pass after each.

---

## S2 — Prerequisite steps (per-step specs)

Apply these specs in order:

1. `docs/content-review/specs/content-spec-break-glass.md`
2. `docs/content-review/specs/content-spec-exclusions-group.md`
3. `docs/content-review/specs/content-spec-device-plan.md`
4. `docs/content-review/specs/content-spec-passkey-settings.md`
5. `docs/content-review/specs/content-spec-auth-strength.md`

Commit each spec individually. End with tree green.

---

## S3 — MFA and authentication policy steps

Apply these specs in order:

1. `docs/content-review/specs/content-spec-mfa-everyone.md`
2. `docs/content-review/specs/content-spec-guests-mfa.md`
3. `docs/content-review/specs/content-spec-phishing-resistant.md`
4. `docs/content-review/specs/content-spec-auth-transfer.md`
5. `docs/content-review/specs/content-spec-device-code.md`

Commit each spec individually. End with tree green.

---

## S4 — Session and admin policy steps

Apply these specs in order:

1. `docs/content-review/specs/content-spec-admin-session.md`
2. `docs/content-review/specs/content-spec-admin-portals.md`
3. `docs/content-review/specs/content-spec-token-protection.md`
4. `docs/content-review/specs/content-spec-block-legacy-auth.md`
5. `docs/content-review/specs/content-spec-trusted-network.md`

Commit each spec individually. End with tree green.

---

## S5 — Risk, device, and campaign steps

Apply these specs in order:

1. `docs/content-review/specs/content-spec-sign-in-risk-medium.md`
2. `docs/content-review/specs/content-spec-sign-in-risk-high.md`
3. `docs/content-review/specs/content-spec-managed-device.md`
4. `docs/content-review/specs/content-spec-intune-enrollment.md`
5. `docs/content-review/specs/content-spec-campaign.md`

Commit each spec individually. End with tree green.

---

## S6 — Remaining new-policy steps

Apply these specs in order:

1. `docs/content-review/specs/content-spec-pim-activation-reauth.md`
2. `docs/content-review/specs/content-spec-register-info-protected.md`
3. `docs/content-review/specs/content-spec-all-users-no-persistence.md`
4. `docs/content-review/specs/content-spec-block-unsupported-platforms.md`
5. `docs/content-review/specs/content-spec-geo-restriction.md`

Commit each spec individually. End with tree green.

---

## S7 — Final steps and cleanup

Apply these specs in order:

1. `docs/content-review/specs/content-spec-user-risk-medium.md`
2. `docs/content-review/specs/content-spec-notAssessed.md`
3. `docs/content-review/specs/content-spec-rename-policies.md`
4. `docs/content-review/specs/content-spec-separate-accounts.md`
5. `docs/content-review/specs/content-spec-allowed-countries.md`

Commit each spec individually. End with tree green.

After all five specs: review `docs/content-review/BLOCKED.md`. If any items are recorded, summarize them at the end of the log.

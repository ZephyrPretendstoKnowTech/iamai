# 06 — Mapping step

Precondition: 05-coverage-engine.md is committed. Read SPEC.md §3.3 and docs/design/plan-file.md (mappings with provenance).

1. Build the Mapping page from the baseline package's references, grouped by inferred role (adapter `groupSignatures` and reference kinds): break-glass accounts (users referenced directly), global exclusion group, other exclusion groups, persona/pilot groups, named locations, custom authentication strengths, service principals, placeholders (named tokens).
2. Each question shows: what the baseline uses it for (policy names, include/exclude, the author's evidence text), an auto-suggestion from the tenant with confidence (from tenant group signatures, group display names containing emergency/breakglass/exclusion, `isTrusted` locations, strengths with identical allowedCombinations), a picker over the tenant's objects (typeahead over groups/users/locations/strengths with display name and member count), and "Doesn't exist yet — add a Phase 0 step".
3. Validation runs on every pick and shows results inline:
   - Break-glass account: cloud-only (onPremisesSyncEnabled false), enabled, permanent active Global Administrator (not eligible-only), excluded from every policy including report-only and Microsoft-managed ones, MFA-capable with a phishing-resistant method preferred (SMS-only flagged), last successful sign-in date, not a member of any dynamic group whose rule could include it, at least two break-glass accounts in total, and the shared-device check: its Authenticator displayName matching another user's.
   - Exclusion group: member count, admins among members, dynamic rule if any, used consistently across policies.
   - Trusted location: no 0.0.0.0/0, no ranges wider than /16, isTrusted set.
   - Custom strength: allowedCombinations shown; if the baseline's strength has no combinations, offer the built-in equivalents.
   - Passkey pilot group: FIDO2/passkey method enabled and targeted to it in the auth-methods policy, TAP enabled and targeted, the Azure Credential Configuration Endpoint service principal present.
4. Variant sets: one card per set with the policies side by side and a choice.
5. Applicability: one card per facet with the auto-detected answer and evidence ("AVD service principal present, 0 sign-ins in 30 days"), an override switch, and a reason field when overriding to off.
6. Target state: a list of baseline policies with "include in plan" on by default; turning one off requires a reason and shows as "not in scope for this tenant" in Coverage and Roadmap — never as risk accepted.
7. Persist everything as the mappings object in plan-file.md with provenance (auto / confirmed / overridden) and validation results with timestamps; Coverage re-runs on change and drops its "assumed" banner once every reference is confirmed.
8. Progress indicator "12 of 48 mapped" and "Next: Coverage".

Tests for each validation rule with authored fixtures. Commit and push.

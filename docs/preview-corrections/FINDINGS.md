# Deduplicated corrective findings

Audit reference build c65d9f426d3b744ad911ebee01ba99ca8276a688. Current source may already differ. Evidence references under references/ are non-authoritative context; superseded feature-removal proposals must not be followed.

## C01 — Wrong policy target and contradictory changes [critical, S1]
Live all-user MFA step selected Core - Allow - MFA for Admins, although Core - Allow - MFA for Internal Users existed. The Entra procedure changed All users and generic MFA while leaving On; JSON was conditions-only. Admin and session goals referenced the same admin policy. Existing Copy was disabled behind unresolved mapping in the Codex audit; the later Claude audit describes usable/copyable previews. Neither audit applied changes. A simplified synthetic collision fixture did NOT reproduce the live issue; do not assert the fallback finder is proven root cause.

Acceptance: reconstruct the shape with synthetic policies, exclusions and confirmation states; assert the correct identity/ownership across all-user/admin/session goals, then repeat with names changed and input order reversed. No name-based hardcode or duplicate-policy creation workaround. If exact live reproduction is unavailable, show the narrower invariant established and report the remaining gap. Verify intended conditions/grant/session/state across rendered channels, not just the resolver return value.

## C02 — Conflicting lifecycle and protection-reduction advice [critical, S1/S3]
Admin strength recommendation contains TAP whereas current admin policy uses built-in phishing-resistant MFA. Baseline may intentionally allow bootstrap: accurately identify and explain the difference; do not strip TAP or change baseline intent globally. Legacy/token/user-risk instructions stage existing On policies in report-only. Other Entra channels say leave On while their scripts refuse correction until staging. A report-only switch disables existing enforcement; it is not automatically a safe migration.

Acceptance: current baseline/interpretation establishes exact intended action; channels agree on lifecycle and any grant change. A conditions-only repair must not smuggle in a grant change. Correct known unintended weakening, identify deliberate baseline exceptions in existing prose. No blanket lifecycle string replacement. If strategy remains unresolved, preserve product and record critical BLOCKED for morning review.

## C03 — Malformed Graph success becomes empty evidence [critical, S2]
Mocked 200 bodies not-json, {}, and unexpected object each returned [] from graphPaged. Parser catches errors to {}, pagination defaults missing value to []. Downstream harm depends on endpoint.

Acceptance: malformed/missing collection shape is explicitly an error/unknown/partial; legitimate value:[] remains empty success. Cover valid pagination, malformed later page, non-array value, cancellation/retries and legitimate scalar count endpoints without breaking them. Verify collection status propagation through one scan fixture. No live Graph calls.

## C04 — Historical proof with unknown chronology [critical, S2]
personReadiness accepts a current method class with unknown creation date as compatible with any old proof. Synthetic replacement key with legacy-shaped creationDateTime lost its timestamp and reused 2024 proof in 2026. Current Microsoft FIDO2 resource uses createdDateTime, while list-method example used creationDateTime. Live payload shape was not captured. Do not claim current schema is universally wrong. History also retains old platforms/proof indefinitely; that broader policy is not tonight's redesign.

Acceptance: safely normalize supported variants; unknown chronology does not assert replacement-key continuity. Cover same credential with known provenance, replacement, missing dates, known later date, unknown inventory and existing retained evidence. Preserve useful historical display. No arbitrary expiry period. If exact target-strength eligibility is beyond current model, record scope limitation rather than inventing a new eligibility engine.

## C05 — Missing content and unresolved bindings [critical for exposed instructions, S3]
Detailed Claude audit: unavailable content on 26/32 steps; Email26, JSON12, PowerShell10, Entra3, AI3. Codex: 43/44 packages have at least one component diagnostic; NOT 43 whole broken steps. Passkey setup is Ready yet implementation unavailable. Library authored against older pin; do not repin or disable validators.

Acceptance: identify common projection/metadata/binding causes. Repair critical complete-data cases first. Distinguish genuinely unresolved tenant prerequisites from compiler failures. Missing inputs must keep honest existing prerequisite behavior; never substitute fake IDs. Keep all tabs/features. Enumerate remaining failures by package/state/channel with causes, not just global counts. No empty string/error suppression masquerading as success.

## C06 — Invalid JSON and incomplete PowerShell [critical, S3]
Conditions placeholder string instead of object; excludeGroups placeholder string instead of array; mandatory TargetPolicyJson lacks a usable supplied artifact; unresolved IDs fail GUID checks. Scripts not executed by auditors.

Acceptance: complete synthetic inputs yield typed valid Graph bodies and scripts with available required inputs; incomplete inputs are accurately distinguished. Parse JSON, assert semantic equality to intended operation, and inspect generated PowerShell using parser/mocked requests where supported. Do not execute against Graph. Existing full target versus PATCH body distinctions must be explicit within current views. No broad new UI.

## C07 — Misleading existing text [high, S4]
Ready while prerequisites remain, IN PROGRESS for unstarted work, registered-method count confused with proof percentage, nothing enforced despite On policies, STEP.md/internal bindings in technician instructions, nonexistent crosslinks. Preserve unknown impact when unresolvable; explain why. Do not change planning thresholds/schedules or state architecture just to improve copy.

Acceptance: repair source of wording; evidence/labels agree in supplied states. No global canonical→desired or Entra ID→Protection replacement. Specific plain-language portal steps based on current primary sources. Do not promise no lockouts or always-available emergency access. Minor spacing and labels only after critical work.

## C08 — First-use loading [high, S4]
Claude audits report demo→production Plan hang, direct route ~20 seconds or no rows after30, background Plan stuck >2min. In-app navigation fast. Not independently reproduced in Codex audit.

Acceptance: reproduce local fixture/demo route state; determine actual async/cache/worker/auth dependency. Verify cold direct Plan, reload, demo→non-demo and background→foreground with synthetic data. Avoid increasing timeouts to conceal failure or changing token persistence/session architecture. If login-dependent reproduction requires real credentials, do not use them; record partial verification.

## C09 — Beta notice and trust wording [agreed addition, S4]
Add exact Connect notice in RUN-CONTEXT. Correct existing absolute data-handling statements only where supported by actual source (fetch vs retention, exports, hosting/beacon). No new legal policy page, analytics system, pricing feature or consent flow tonight. No quantified baseline adoption claim without evidence. Owner's beta disclosure is a clear launch expectation, not a replacement for C01–C06.

## Out of scope
No hiding/removing tabs; no feature flags; no new gate/approval architecture; no multi-tenant platform; no new export formats; no baseline rewrite/upgrade; no broad performance rewrite; no audit-count-driven cosmetic spree; no IP/legal acquisition project. List worthwhile deferred items in morning report.

## Primary references
- https://learn.microsoft.com/en-us/entra/identity/conditional-access/howto-conditional-access-insights-reporting
- https://learn.microsoft.com/en-us/entra/identity/conditional-access/concept-conditional-access-report-only
- https://learn.microsoft.com/en-us/entra/identity/authentication/concept-authentication-strengths
- https://learn.microsoft.com/en-us/graph/api/authentication-list-methods?view=graph-rest-1.0
- https://learn.microsoft.com/en-us/graph/api/resources/fido2authenticationmethod?view=graph-rest-1.0
Read the relevant current page if a correction depends on it. A live link alone is not semantic validation.

# IAMAI findings register

Audited build: `c65d9f426d3b744ad911ebee01ba99ca8276a688`, September 13–14, 2026. Read-only audit; no proposed change was implemented. “Proven” applies to the stated reproduction, not every downstream consequence. High severity means potential security/operational harm if acted upon, not an observed tenant compromise. No Critical-severity compromise was established.

## F01 — Correction target and channels disagree

**Area:** Policy semantics / implementation. **Status:** Fail. **Severity:** High. **Confidence:** Proven. **Impact:** Security, Correctness, Trust, UX. **Priority:** P0. **Investor consequence:** Deal breaker.

**Evidence:** In the live plan, Require MFA for Everyone selected the existing admin MFA policy despite a separate internal-users policy in inventory. Its Entra instructions set All users and generic MFA, leaving On. Its JSON described conditions only. Its PowerShell required full TargetPolicyJson and offered separate modes. The same admin policy also appeared under admin protection/session goals. Copy remained disabled behind unresolved prerequisites. [Authored correction](https://github.com/ZephyrPretendstoKnowTech/iamai/blob/c65d9f426d3b744ad911ebee01ba99ca8276a688/docs/implementation-content/s-goal-mfa-all-users/s-goal-mfa-all-users/CONTENT.md#L18); [candidate selection](https://github.com/ZephyrPretendstoKnowTech/iamai/blob/c65d9f426d3b744ad911ebee01ba99ca8276a688/src/roadmap/generate.ts#L1453).

**Why it matters:** Different technicians can follow different channels and produce different access controls. Reusing one object for incompatible goals can make later steps undo earlier work. Post-confirmation execution behavior was not tested; a simplified synthetic fixture did not reproduce the live selection.

**Recommendation:** Resolve one explicitly owned policy operation with before/after semantics. Detect cross-goal collisions, require review of ambiguous identity, and derive every channel from the same exact delta. Add this live shape to an independently judged fixture corpus.

## F02 — Baseline correction can reduce existing protection

**Area:** Migration safety / baseline interpretation. **Status:** Fail. **Severity:** High. **Confidence:** Proven. **Impact:** Security, Correctness, Trust. **Priority:** P0. **Investor consequence:** Deal breaker.

**Evidence:** The live admin correction recommends Modern MFA + TAP in place of an existing built-in phishing-resistant strength. The custom definition allows both one-time and reusable TAP. The legacy-authentication correction directs the operator to move the existing On policy into report-only; the template's StageForCorrection performs that change. Other paths tell the operator to leave the altered policy On. Microsoft excludes TAP from its phishing-resistant strength and confirms On → report-only stops enforcement. [Strength definitions](https://learn.microsoft.com/en-us/azure/active-directory/authentication/concept-authentication-strengths), [report-only consequence](https://learn.microsoft.com/en-us/entra/identity/conditional-access/howto-conditional-access-insights-reporting).

**Why it matters:** “Match baseline” is not synonymous with “improve security.” One approach broadens allowed methods; another can remove an existing barrier during migration. Neither resulted in a tenant change in this audit.

**Recommendation:** Preserve stronger existing controls unless an explicit reviewed exception is needed. Model bootstrap exceptions separately. Require a migration strategy that accounts for existing enforcement and overlapping policies; show any reduction of protection as a first-class decision.

## F03 — Malformed successful Graph responses become empty collections

**Area:** Collection / uncertainty. **Status:** Fail. **Severity:** High. **Confidence:** Proven. **Impact:** Correctness, Reliability, Security. **Priority:** P0. **Investor consequence:** Material concern.

**Evidence:** With fetch mocked locally, a 200 response containing invalid JSON, `{}`, or an unexpected object each returned `[]` from graphPaged without an error. graphRequest catches parsing failure into `{}`, and pagination defaults a missing value array to empty. [HTTP handling](https://github.com/ZephyrPretendstoKnowTech/iamai/blob/c65d9f426d3b744ad911ebee01ba99ca8276a688/src/graph/collect/http.ts#L132).

**Why it matters:** Missing evidence can look like an empty tenant section. Downstream impact depends on the endpoint; a synthetic collection result is not proof that every empty section is promoted to a safe recommendation.

**Recommendation:** Validate response schema and pagination completeness. Mark malformed/truncated collections unknown or partial, preserve last-known evidence distinctly, and prevent safety conclusions that require the missing section.

## F04 — Missing credential timestamps permit historical proof to overstate readiness

**Area:** MFA truth model. **Status:** Fail. **Severity:** High. **Confidence:** Proven. **Impact:** Correctness, Security, Trust. **Priority:** P0. **Investor consequence:** Material concern.

**Evidence:** A synthetic new FIDO2 key with a legacy-shaped `creationDateTime` lost that field in mapping. With no recognized creation date, proof retained from 2024 produced Ready in September 2026; adding the known newer `createdDateTime` changed the result to Needs proof. Source accepts a proof if any current method of the same class has a null date or predates it. History has no expiry. Microsoft's current resource uses `createdDateTime`, while its list example uses `creationDateTime`; live response shape was not captured. [Readiness predicate](https://github.com/ZephyrPretendstoKnowTech/iamai/blob/c65d9f426d3b744ad911ebee01ba99ca8276a688/src/scoring/phishingResistant.ts#L320), [current Graph resource](https://learn.microsoft.com/en-us/graph/api/resources/fido2authenticationmethod?view=graph-rest-1.0).

**Why it matters:** Unknown chronology is treated as permission to associate old proof with current credentials. Class/platform evidence also does not establish eligibility under every restricted authentication strength. Ever-seen platforms can overblock retired-device users.

**Recommendation:** Normalize documented/legacy variants, record evidence provenance, and treat unknown credential continuity conservatively. Separate historical proof, current capability and exact target-strength eligibility. Provide an explicit freshness policy and reviewed retirement of obsolete platforms.

## F05 — Lane/readiness language overstates what can be done now

**Area:** Actionability / UX. **Status:** Fail. **Severity:** Medium. **Confidence:** Proven. **Impact:** UX, Correctness, Trust, Adoption. **Priority:** P1. **Investor consequence:** Material concern.

**Evidence:** Ready · Correct appeared with incomplete exclusions and disabled Copy. MFA plan copy reported 33% with a qualifying method when all three active users had passkeys and the difference was proof. The schedule tooltip said nothing was enforced despite eight On policies in inventory. Source reuses personReadiness for generic MFA/admin/guest gates and deliberately places some started corrections in Ready despite healthy unresolved prerequisites. [Lanes](https://github.com/ZephyrPretendstoKnowTech/iamai/blob/c65d9f426d3b744ad911ebee01ba99ca8276a688/src/actionability/lanes.ts#L422), [readiness](https://github.com/ZephyrPretendstoKnowTech/iamai/blob/c65d9f426d3b744ad911ebee01ba99ca8276a688/src/roadmap/readiness.ts).

**Why it matters:** Operators cannot reliably distinguish safe immediate work from a future preview. Existing protection, project completion, possession and proof are separate facts.

**Recommendation:** Derive one actionable label from the actual permitted next operation. Name the measured gate precisely and separate tenant enforcement from plan completion and schedule assumptions.

## F06 — Critical content is unavailable or exposes unresolved authoring concepts

**Area:** Content runtime / runbooks. **Status:** Fail. **Severity:** High. **Confidence:** Proven. **Impact:** Reliability, UX, Maintainability, Adoption. **Priority:** P1. **Investor consequence:** Material concern.

**Evidence:** Ready passkey setup displayed withheld/unavailable implementation. Legacy Email was unavailable. Held platform/country instructions referred to STEP.md; registration exposed blockOutsideTrusted and a placeholder. Compiler found at least one withheld component/diagnostic in 43 of 44 registered packages. Most diagnostics concern partial components, not whole-package failure. The library was authored against an older baseline pin. [Integration documentation](https://github.com/ZephyrPretendstoKnowTech/iamai/blob/c65d9f426d3b744ad911ebee01ba99ca8276a688/src/content/implementation/README.md).

**Why it matters:** A junior cannot complete important advertised work, and a “Source checked” date can imply more assurance than the resolved procedure deserves.

**Recommendation:** Declare supported state/channel coverage and fail release on missing critical executable content. Remove unresolved authoring language from operator surfaces. Make Done When verify target semantics and observed prerequisites, not simply On state.

## F07 — Absolute privacy and safety wording exceeds verified guarantees

**Area:** Trust / data minimization. **Status:** Fail. **Severity:** High. **Confidence:** High. **Impact:** Trust, Security, Adoption. **Priority:** P0. **Investor consequence:** Material concern.

**Evidence:** How says authentication values are never read, but per-user methods are fetched before selected fields are retained. The public site says tenant data never leaves the browser/host sees nothing, while exports and hosting metadata exist and a third-party beacon executes on the page. No tenant exfiltration was observed. [Collector](https://github.com/ZephyrPretendstoKnowTech/iamai/blob/c65d9f426d3b744ad911ebee01ba99ca8276a688/src/graph/collect/collectors.ts#L310), [Microsoft method API](https://learn.microsoft.com/en-us/graph/api/authentication-list-methods?view=graph-rest-1.0).

**Why it matters:** Security approval relies on accurate distinctions between receiving, retaining, using and sharing. Browser-only is not isolation from all same-origin code.

**Recommendation:** Publish precise data flows and field retention; distinguish exports/metadata and third-party execution. Minimize method collection and consider removing analytics from authenticated pages. Replace absolute safety claims with verified boundaries.

## F08 — Authenticated-page hardening/custody needs further assurance

**Area:** Browser security. **Status:** Weak. **Severity:** Medium. **Confidence:** High. **Impact:** Security, Trust. **Priority:** P1. **Investor consequence:** Material concern.

**Evidence:** Public headers included HSTS and nosniff but no framing protection in HTTP CSP/X-Frame-Options. Meta CSP exists; it allows the Cloudflare script. Browser IndexedDB is tenant-keyed, while sessionStorage holds MSAL state. Active framing/XSS and storage deletion were not tested. [CSP](https://github.com/ZephyrPretendstoKnowTech/iamai/blob/c65d9f426d3b744ad911ebee01ba99ca8276a688/scripts/csp.ts), [security description](https://github.com/ZephyrPretendstoKnowTech/iamai/blob/c65d9f426d3b744ad911ebee01ba99ca8276a688/SECURITY.md).

**Why it matters:** Sensitive read access remains exposed to browser/session compromise and trusted script supply chain. Missing hardening is not a demonstrated exploit.

**Recommendation:** Serve an effective frame-ancestors policy, inventory every authenticated-origin script, test hostile inputs/imports in isolation, and validate tenant switching/deletion in disposable profiles. Describe browser custody clearly.

## F09 — Strong internal tests do not yet establish independent semantic truth

**Area:** Quality / release assurance. **Status:** Weak. **Severity:** High. **Confidence:** High. **Impact:** Correctness, Reliability, Maintainability. **Priority:** P1. **Investor consequence:** Material concern.

**Evidence:** 2,549 local passes, 1 Chrome-target startup failure and 3 skips; typecheck/build passed. Live content and channel failures remained. New malformed-response and historical-proof probes exposed permissive behaviors. Deployment includes exact-SHA walk/test/build; the audit did not verify private branch protection or all browser walks. [Deployment](https://github.com/ZephyrPretendstoKnowTech/iamai/blob/c65d9f426d3b744ad911ebee01ba99ca8276a688/.github/workflows/deploy-pages.yml).

**Why it matters:** Tests may validate consistency with authored expectations without independent agreement with safe Microsoft behavior.

**Recommendation:** Add expert-adjudicated adversarial before/after cases, parse channels into semantics, and test full supported state coverage. Track critical false advice separately from snapshot churn and cosmetic checks.

## F10 — Native platform capabilities weaken baseline-only differentiation

**Area:** Competition / strategy. **Status:** Weak. **Severity:** High. **Confidence:** High. **Impact:** Competitive, Revenue. **Priority:** Strategic. **Investor consequence:** Thesis weakening.

**Evidence:** Current Microsoft documentation includes baseline monitoring, snapshots and drift reporting; common Entra P1/P2 licenses include configuration-monitoring capacity. CIPP already offers multi-tenant CA operations, ID translation and standards. [Microsoft licensing](https://learn.microsoft.com/en-us/entra/fundamentals/licensing), [CIPP CA](https://docs.cipp.app/user-documentation/tenant/conditional/list-policies).

**Why it matters:** Inventory/baseline comparison is under price pressure. A nicer front end alone is unlikely to support durable margins.

**Recommendation:** Prove paid safe-rollout productivity and evidence quality; integrate native configuration management rather than recreating its breadth.

## F11 — Baseline redistribution rights and provenance wording are unresolved

**Area:** Legal/IP / baseline. **Status:** Unknown. **Severity:** High. **Confidence:** High. **Impact:** Legal/IP, Trust, Operations. **Priority:** P1. **Investor consequence:** Material concern.

**Evidence:** Root IAMAI code is MIT. The retrieved pinned external baseline tree had no license/copying/notice path. Rights may exist separately and were not supplied. The shipped loader imports a policy snapshot, while index attribution says fetched live/not redistributed. [Loader](https://github.com/ZephyrPretendstoKnowTech/iamai/blob/c65d9f426d3b744ad911ebee01ba99ca8276a688/src/baseline/pinned.ts), [index](https://github.com/ZephyrPretendstoKnowTech/iamai/blob/c65d9f426d3b744ad911ebee01ba99ca8276a688/baselines/jhope188-conditionalaccesspolicies.index.json).

**Why it matters:** Public availability and schema conversion do not establish commercial rights. No infringement is alleged.

**Recommendation:** Obtain explicit applicable rights and attribution terms, correct provenance text, inventory dependencies/assets, and verify contributor assignments before closing an acquisition.

## F12 — Founder-independent operation is unproven

**Area:** Acquirability / operations. **Status:** Unknown. **Severity:** Medium. **Confidence:** High. **Impact:** Operations, Maintainability, Legal/IP. **Priority:** P1. **Investor consequence:** Material concern.

**Evidence:** README describes a single maintainer and no tagged releases. There is substantial setup/design/deployment documentation and exact-SHA publishing. Private account ownership, support handover, recovery and second-maintainer execution were not verified. [README](https://github.com/ZephyrPretendstoKnowTech/iamai/blob/c65d9f426d3b744ad911ebee01ba99ca8276a688/README.md).

**Why it matters:** A buyer cannot assume control of domain, hosting, registration and incident handling from source availability alone.

**Recommendation:** Run a second-engineer build/release/rollback and baseline-update drill, establish release artifacts and recovery ownership, and transfer documented operational rights.

## F13 — Recurring MSP economics and adoption remain hypotheses

**Area:** Commercial / workflow. **Status:** Unknown. **Severity:** High. **Confidence:** High. **Impact:** Revenue, Adoption, Competitive. **Priority:** P1. **Investor consequence:** Thesis weakening.

**Evidence:** No financials, customer contracts, retention, measured savings or support costs were supplied. The observed product is a browser-local engagement tool without demonstrated shared multi-tenant operation. The report's ROI table is explicitly hypothetical.

**Why it matters:** Tenant count alone does not create recurring usage, and required senior review can erase apparent savings.

**Recommendation:** Charge for bounded pilot engagements; measure all labor and support against a manual control; test repeat purchasing before a broad platform build.

## F14 — Scale and peripheral workflow safety are not demonstrated by the small live scan

**Area:** Scale / coverage. **Status:** Unknown. **Severity:** Medium. **Confidence:** High. **Impact:** Reliability, Operations, Adoption. **Priority:** P2. **Investor consequence:** Material concern.

**Evidence:** The live tenant had four users and 321 sign-ins. The collector batches per-user method reads. Microsoft advises registration reports for population audits. PIM/Intune and unobserved business workflows are not all established by the inspected scan. Production build warns about a large main chunk.

**Why it matters:** A successful small scan does not establish a performance envelope, full licensing compliance, or safe enrollment/guest/device workflows.

**Recommendation:** Define supported scale and evidence coverage, target detailed reads where needed, load-test synthetic/authorized tenants, and label owner-attested prerequisites distinctly from observed facts.

## F15 — Defensive architecture provides a useful foundation

**Area:** Security / semantics. **Status:** Pass. **Severity:** Informational. **Confidence:** High. **Impact:** Security, Correctness, Maintainability. **Priority:** Preserve. **Investor consequence:** None.

**Evidence:** Inspected browser app requests delegated read scopes; POSTs are read semantics; no automatic tenant write path was found. Live unmapped groups stayed held. The contradictory admin-portal baseline was explicitly refused. Source includes tenant-keyed storage, stable object handling, pinned baseline, centralized export disposition, structural redaction, CSV formula tests and immutable deployment checkout.

**Why it matters:** IAMAI has substantive engineering assets, not merely a styled checklist. These reduce the cost of fixing the trust gaps.

**Recommendation:** Preserve these properties while consolidating the operation contract. Do not solve workflow friction by adding broad unattended write authority.

## Register interpretation

F01–F04 are the most important correctness/safety findings. F07 concerns accurate claims rather than an observed disclosure. F08 is a hardening/assurance gap. F10 and F13 are investment risks, not software defects. F11–F12 require private diligence. No finding authorizes a change to IAMAI or its tenant.

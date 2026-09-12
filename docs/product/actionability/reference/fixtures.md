# Fixture tenants: policies, readings, and lane counts

## Sources

- `docs/product/actionability/RUN-CONTEXT.md` (code map: FIXTURES, OWNER, PLANROW, PINNED, RUNTIME-ROWS)
- `docs/product/actionability/IAMAI-Actionability-Dependency-Playbook.md` (§11 runtime rows, §17 worked examples)
- `src/roadmap/fixtures/index.ts` (`FIXTURE_SPECS`, `buildFixture`, `fixture`, `curatedFixture`, `asCuratedBaseline`, `syntheticBaseline`, `withBreakGlassCarveOut`, `noExclusionsAnswer`, `strengthMissing`, `HUGE`)
- `src/roadmap/fixtures/run.ts` (`runFixture`)
- `src/roadmap/fixtures/records.ts`, `src/roadmap/fixtures/scenarioRows.ts`, `src/roadmap/fixtures/transitions.ts`, `src/roadmap/fixtures/semantics.ts` (exports only)
- `src/ui/demo.ts` (`demoTenant`, `nextDemoRecord`), `src/ui/demoFacts.ts`, `src/ui/demoMode.ts` (`DEMO_TENANT_ID`, imported)
- `src/ui/App.tsx` (demo seeding and the MOCK branch)
- `src/testing/uiSnapshot.ts`, `src/testing/bigFixture.ts`, `src/testing/gapsFixture.ts`, `src/testing/pilotFixture.ts`, `src/testing/authorUpdate.ts`, `src/testing/transient.ts`
- `src/ui/surfaces/Plan.tsx`, `src/ui/surfaces/planData.ts`, `src/ui/surfaces/planLanes.ts`, `src/ui/surfaces/planBoard.ts`, `src/ui/surfaces/planState.ts`, `src/ui/surfaces/CleanupStep.tsx`, `src/ui/surfaces/cleanupExport.ts`, `src/ui/surfaces/pickerRows.ts`
- `src/coverage/coverage.ts`, `src/coverage/types.ts`
- `src/roadmap/tracking.ts` (`matchMembers`, `driftOutcomeOf`, `observationsOf`), `src/roadmap/types.ts` (`MemberTracking`, `StepTracking`), `src/roadmap/lifecycle.ts`, `src/roadmap/generate.ts` (`planIdFor`, `findTaggedPolicies`, goal-map default), `src/roadmap/progress.ts`, `src/roadmap/cleanupDone.ts`
- `src/content/implementation/drift.ts`
- `src/graph/collect/onDemand.ts` (`readGroup`), `src/graph/collect/presence.ts`
- `src/mapping/store.ts`, `src/mapping/safetyChoice.ts`, `src/mapping/emergencyChoice.ts`, `src/derive/planStart.ts`, `src/ui/baseline.ts`
- `baselines/jhope188-conditionalaccesspolicies.pinned.json`, `baselines/jhope188-conditionalaccesspolicies.index.json`, `baselines/jhope188-conditionalaccesspolicies.interpretation.json`
- Tests cited: `src/ui/surfaces/planLanes.test.ts`, `src/ui/surfaces/planBoard.test.ts`, `src/roadmap/sourceReferences.test.ts`

Build: HEAD `4cde3e6`, computed 2026-09-12, Node v24.20.0.

---

## How to read the tables

**Which baseline each fixture uses.** Only `demo` and `demo-week2` use the pinned package: `pinnedPackage()`, commit 90d9b890, 38 policies, 22 goals in `goalMap`. Every other roadmap fixture uses `syntheticBaseline(seed)`, an 8-policy stand-in (`fixtures/index.ts`). The MOCK tenants use `fixtureBaseline()`, a single legacy-auth policy (`testing/uiSnapshot.ts`). All of them still produce the pinned step list, because `generateRoadmap` uses `input.goalMap ?? PINNED_GOAL_MAP` (`generate.ts`). So "against the pinned baseline" applies literally only to the two demo tenants. Everywhere else, the step ids are the pinned map's and the policy contents come from that fixture's own baseline.

**Reading column.** Each word below comes from a value the code computes. No judgement is added.

| Word | Code reading |
|---|---|
| **enforced** | A step's `tracking.members[]` entry has this policy as `policyId`, the member's `lifecycle` is `enforced`, and the step is `done` with condition `healthy` (In place). Coverage marks the policy `satisfier` and the goal `inPlace`. |
| **report-only** | The member's `lifecycle` is `report-only` or `ready-to-enforce`. |
| **missing** | A pinned-map policy step whose `state.lifecycle` is `not-deployed`: no tenant policy was matched to it. This also covers a tagged policy that matches a step but is `disabled`, where the member's lifecycle is `not-deployed`. |
| **drifted** | The lane engine's own drift flag, `observe(step).drift` in `planLanes.ts`: the step is not done, and either its condition is `review-required` or it is `adjust` against a policy that exists. `driftOutcomeOf(step)` from `tracking.ts` is shown with it (`correctable` / `review-required` / `on-hold`), as is the member's `reviewRequired` where it is true. |
| **coverage only** | No step tracks this policy as a member. `computeCoverage` still counts it as a candidate for the goals listed, with its `contribution` (`strong`/`weak`/`reportOnly`/`disabled`) and the goal's `verdict`. |
| **not read** | No step member and no coverage candidate. |

`src/content/implementation/drift.ts` (DriftStatus `current`/`reviewNeeded`/`held`) is **not** a tenant-policy reading. It compares an implementation package's reviewed members with the build's pin, so it does not appear in any policy table.

**Match mechanism** (`MemberTracking.matchedBy`):
- `operation-target`: the step's own update targets the policy.
- `fingerprint`: the goal's coverage fingerprint.
- `step-tag`: `[IAMAI:<planId>:<stepId>]` in the description.
- `owned`: the plan record from the last scan.

---

## Demo tenants (the product's sample; pinned baseline)

### demo · Initial

- **File:export:** `src/roadmap/fixtures/index.ts` → `fixture('demo')` (spec `{ name: 'demo', users: 34, admins: 3, licence: 'p1', policies: 5, serviceAccounts: 2, hybrid: true, intuneShare: 0.5, demo: true }`). The app loads it through `src/ui/demo.ts` → `demoTenant(false)`, which rewrites the tenant id to `DEMO_TENANT_ID`, shifts every date to now, and retags plan tags to `planIdFor(DEMO_TENANT_ID)`.
- **What it models:** "Contoso Pty Ltd", a small business on Entra ID P1 with Intune and a hybrid directory, on day one.
  - **Policies:** the tenant's policies carve out the break-glass group rather than the confirmed exclusions group ("Core - Exclusions"). The MFA policy excludes the first emergency account by name instead of the group.
  - **Emergency access:** the credential-storage and sign-in-monitoring answers are unconfirmed. The technician's saved decision picks the two break-glass accounts.
  - **People:**
    - three active people with no MFA method;
    - five registered but unproven;
    - one Windows Hello-only person;
    - one person whose methods could not be read;
    - one person whose passkey an earlier scan saw (`mfaHistory`);
    - two guests;
    - a directory-sync role holder.
  - **Accounts:** a Teams Room shared-device account ("Boardroom"), a dormant "MFP Reception" printer, and two `svc-mailer` legacy-auth service accounts.

| Policy | State | How IAMAI reads it |
|---|---|---|
| Core - Grant - MFA for all users | enabled | **enforced, drifted.** Member of `s-goal-mfa-all-users` (`adjust`, status `blocked`, condition `blocked`); lifecycle enforced; lane drift true; `driftOutcomeOf` = `on-hold`; matched by `operation-target`. Coverage: `mfa-all-users` and `guests-mfa` strong, verdict `partly`. |
| Core - Block - Legacy authentication | enabled | **enforced, drifted.** `s-goal-block-legacy-auth` adjust/blocked; on-hold; operation-target. Coverage: `block-legacy-auth` strong, `partly`. |
| Core - Block - Device code flow | enabled | **enforced, drifted.** `s-goal-block-device-code` adjust/blocked; on-hold; operation-target. Coverage: `block-device-code` strong, `partly`. |
| Core - Grant - Admins phishing-resistant | enabledForReportingButNotEnforced | **report-only, drifted.** `s-goal-admins-phishing-resistant` adjust / `in-report-only` / condition `blocked`; on-hold; operation-target. Coverage: `mfa-all-users` and `admins-phishing-resistant` reportOnly, `partly`. |
| Core - Grant - Guests MFA | enabled | **Coverage only.** `mfa-all-users` and `guests-mfa` strong, `partly`. No step tracks it: the pinned `guests-mfa` goal maps to two policies, and `s-goal-guests-mfa` stays `not-deployed`, On Hold · `unsupported:unmatched-pair`. |

**Pinned goals with no deployed policy (missing):** 12 policy steps are `not-deployed`:
`s-goal-register-info-protected`, `s-goal-block-auth-transfer`, `s-goal-service-accounts-trusted-network`, `s-goal-admin-session`, `s-goal-guests-mfa`, `s-goal-geo-restriction`, `s-goal-block-unsupported-platforms`, `s-goal-require-managed-device`, `s-goal-device-registration-mfa`, `s-goal-intune-enrollment-reauth`, `s-goal-all-users-no-persistence`, `s-goal-token-protection`.

Goal verdicts across the 27 coverage goal results (the pinned `goalMap` holds 22 goals): partly 5, missing 15, licenceLimited 5, notApplicable 2. Seven pinned policies are not assessed (`coverage.organisation.notAssessed`). The plan has 27 steps, 17 of them policy steps.

### demo · Follow-up (week two)

- **File:export:** `src/roadmap/fixtures/index.ts` → `fixture('demo-week2')` (same spec plus `week2: true`; same seed, so it is the same tenant). The app loads it through `src/ui/demo.ts` → `demoTenant(true)`.
- **What it models:** the demo one week on.
  - **Policy changes:**
    - the admins phishing-resistant policy is now enabled;
    - every policy carves out the confirmed exclusions group;
    - the MFA policy excludes the group rather than an account;
    - three plan-created, plan-tagged policies sit in report-only: token protection (7 days, every person, no failures), authentication transfer (2 days, 24 people) and, since A4, the Intune enrollment sign-in frequency (3 days, 20 people) — the one the product demo shows as Ready · Observing, because its goal names no source group the baseline has not settled.
  - **Readiness:** three of the unproven people now hold a proven passkey.
  - **Emergency access:** the emergency-access answers are confirmed, and the drill is recorded as a Cleanup checkpoint.
  - **Seeded decisions:**
    - allowed countries adds NZ;
    - the partner question excludes service providers;
    - the mail-sending printer joins the service-accounts group (legacy auth).

| Policy | State | How IAMAI reads it: Plan page, Follow-up entered directly |
|---|---|---|
| Core - Grant - MFA for all users | enabled | **enforced.** Members of `s-goal-mfa-all-users` and `s-goal-guests-mfa`: lifecycle enforced, step `create` / `done` / `healthy`, matched by `fingerprint`. Coverage: satisfier, `inPlace` for both goals. |
| Core - Block - Legacy authentication | enabled | **enforced.** `s-goal-block-legacy-auth` done/healthy; fingerprint; satisfier `inPlace`. |
| Core - Block - Device code flow | enabled | **enforced.** `s-goal-block-device-code` done/healthy; fingerprint; satisfier `inPlace`. |
| Core - Grant - Admins phishing-resistant | enabled | **enforced.** `s-goal-admins-phishing-resistant` done/healthy; fingerprint; satisfier `inPlace`. |
| Core - Grant - Guests MFA | enabled | **Coverage only.** `mfa-all-users` and `guests-mfa` strong satisfier, `inPlace`. |
| Core - Session - Token protection | enabledForReportingButNotEnforced | **report-only, undrifted.** Plan-tagged. `s-goal-token-protection` adjust / `in-report-only` / `healthy`; the only operation turns it on, so the lane adapter reads no drift (A4); `driftOutcomeOf` = `on-hold`; operation-target. Coverage: `token-protection` reportOnly, `partly`. Lane: On Hold · `sourceMapping:62d67e66`. |
| Core - Block - Authentication transfer | enabledForReportingButNotEnforced | **report-only, undrifted.** Plan-tagged. `s-goal-block-auth-transfer` adjust / in-report-only / healthy; no drift (A4); on-hold; operation-target. Coverage: `block-auth-transfer` reportOnly, `partly`. Lane: On Hold · `sourceMapping:62d67e66`. |
| Core - Session - Intune enrollment sign-in frequency | enabledForReportingButNotEnforced | **report-only, undrifted, evidence maturing (A4).** Plan-tagged; 3 days in report-only, 18 of 30 active people seen, no failures. `s-goal-intune-enrollment-reauth` adjust / in-report-only / blocked (the device decision and the session-loop readiness item are enforcement gates); tag. Coverage: `intune-enrollment-reauth` reportOnly, `partly`. Lane: **Ready · Observing**, reason the open observation gate. Milestone: observe (no date; held on the readiness gate). |

**Visiting Initial first, then Scan again.** This models the record that the Initial visit persisted, carried forward by `nextDemoRecord`. The four enforced policies (MFA for all users, Legacy authentication, Device code flow, Admins phishing-resistant) then read **enforced · review required**: the member's `reviewRequired` is true, it is matched by `owned`, and the step condition is `review-required` with status still `done`. The `s-goal-guests-mfa` member stays fingerprint/healthy. Nothing else changes.

**Pinned goals with no deployed policy (missing):** 8 policy steps are `not-deployed`:
`s-goal-register-info-protected`, `s-goal-service-accounts-trusted-network`, `s-goal-admin-session`, `s-goal-geo-restriction`, `s-goal-block-unsupported-platforms`, `s-goal-require-managed-device`, `s-goal-device-registration-mfa`, `s-goal-all-users-no-persistence`.

Goal verdicts: inPlace 5, missing 12, partly 3, licenceLimited 5, notApplicable 2 (A4: the Intune enrollment goal moved from missing to partly). Seven pinned policies are not assessed. The Plan page has 30 steps. `runFixture` has 27, because it does not apply the seeded week-two answers that add `s-question-partner`, `s-question-mail-devices` and `s-question-travel`.

`src/ui/demoFacts.ts` runs `runFixture` over the shifted Initial snapshot for the signed-out Scan tile's facts. It computes no lanes.

---

## Roadmap property-test fixtures (`src/roadmap/fixtures/index.ts`, synthetic baseline)

Every one is `fixture(name)`, built by `buildFixture(spec)` from `FIXTURE_SPECS`. All carry:
- two break-glass accounts;
- an answered exclusions group named "Core - Exclusions", which the policies carve out;
- confirmed emergency answers (except `hostile`).

`huge` is built only with `HUGE=1`. The Plan page never loads these fixtures; their chain is `runFixture`, the property tests' wiring.

Template policies, in order:
1. MFA for all users
2. Legacy authentication
3. Device code flow (`disabled` on midflight)
4. Admins phishing-resistant (report-only)
5. Guests MFA
6. Compliant device for Office (report-only)

Extra `n` (n ≥ 6) is `Core - Extra n - <template n%6>`, report-only when `n%4 == 0` and enabled otherwise.

### micro
- **Spec:** 8 users, 1 admin, licence `none`, 0 policies, security defaults on.
- **Models:** an unlicensed micro-tenant. Of the 27 coverage goal results, 22 read `licenceLimited` and 5 `notApplicable`, so the plan has no policy steps, only `s-ladder-*` foundation rows.
- **Policies:** none. **Missing:** 0 policy steps; the goals are licence-limited, not missing.

### small
- **Spec:** 28 users, 2 admins, P1, 3 policies.

| Policy | State | Reading |
|---|---|---|
| Core - Grant - MFA for all users | enabled | **enforced.** `s-goal-mfa-all-users` and `s-goal-guests-mfa` done/healthy, fingerprint. |
| Core - Block - Legacy authentication | enabled | **enforced.** `s-goal-block-legacy-auth`, fingerprint. |
| Core - Block - Device code flow | enabled | **enforced.** `s-goal-block-device-code`, fingerprint. |

**Missing (10):** `s-goal-register-info-protected`, `s-goal-block-auth-transfer`, `s-goal-admin-session`, `s-goal-admins-phishing-resistant`, `s-goal-admin-portals-protected`, `s-goal-geo-restriction`, `s-goal-block-unsupported-platforms`, `s-goal-device-registration-mfa`, `s-goal-all-users-no-persistence`, `s-goal-token-protection`.

### getiamai
- **Spec:** 11 users (9 never signed in), 1 admin, P1, 0 policies.
- **Models:** the GetIAMAI live-walk shape:
  - a guest shares a member's display name;
  - a service principal ("Contoso Backup Runner") holds Global Administrator;
  - two active people are registered with no MFA proof;
  - both break-glass accounts share one Authenticator device.
- **Policies:** none.
- **Missing (14):** `s-goal-block-auth-transfer`, `s-goal-block-legacy-auth`, `s-goal-register-info-protected`, `s-goal-block-device-code`, `s-goal-mfa-all-users`, `s-goal-admin-session`, `s-goal-admin-portals-protected`, `s-goal-admins-phishing-resistant`, `s-goal-guests-mfa`, `s-goal-geo-restriction`, `s-goal-block-unsupported-platforms`, `s-goal-device-registration-mfa`, `s-goal-all-users-no-persistence`, `s-goal-token-protection`.

### mid
- **Spec:** 280 users, 14 admins, mixed P1/P2, 11 policies, 3 service accounts.
- **Models:** a directory-sync role holder and a shared-device SKU on the reserved account.

| Policy | State | Reading |
|---|---|---|
| Core - Grant - MFA for all users | enabled | **enforced.** `s-goal-mfa-all-users` and `s-goal-guests-mfa`, fingerprint. |
| Core - Block - Legacy authentication | enabled | **enforced.** `s-goal-block-legacy-auth`. |
| Core - Block - Device code flow | enabled | **enforced.** `s-goal-block-device-code`. |
| Core - Grant - Admins phishing-resistant | enabledForReportingButNotEnforced | **Coverage only.** `mfa-all-users` and `admins-phishing-resistant` reportOnly; both goals `inPlace` through Extra 9. |
| Core - Grant - Guests MFA | enabled | **Coverage only.** Strong satisfier, `inPlace`. |
| Core - Grant - Compliant device for Office | enabledForReportingButNotEnforced | **Not read.** |
| Core - Extra 6 - Grant - MFA for all users | enabled | **Coverage only.** Strong satisfier, `inPlace`. |
| Core - Extra 7 - Block - Legacy authentication | enabled | **Coverage only.** Strong satisfier, `inPlace`. |
| Core - Extra 8 - Block - Device code flow | enabledForReportingButNotEnforced | **Coverage only.** reportOnly, `inPlace`. |
| Core - Extra 9 - Grant - Admins phishing-resistant | enabled | **enforced.** `s-goal-admins-phishing-resistant` done/healthy, fingerprint. |
| Core - Extra 10 - Grant - Guests MFA | enabled | **Coverage only.** Strong satisfier, `inPlace`. |

**Missing (15):** `s-goal-register-info-protected`, `s-goal-block-auth-transfer`, `s-goal-service-accounts-trusted-network`, `s-goal-admin-session`, `s-goal-admin-portals-protected`, `s-goal-pim-activation-reauth`, `s-goal-geo-restriction`, `s-goal-block-unsupported-platforms`, `s-goal-device-registration-mfa`, `s-goal-all-users-no-persistence`, `s-goal-sign-in-risk`, `s-goal-sign-in-risk-medium`, `s-goal-user-risk`, `s-goal-user-risk-medium`, `s-goal-token-protection`.

### large
- **Spec:** 4,900 users, 60 admins, P1, 40 policies, hybrid, Intune share 0.55.

| Policy (count) | State | Reading |
|---|---|---|
| Core - Grant - MFA for all users | enabled | **enforced.** `s-goal-mfa-all-users` and `s-goal-guests-mfa`, fingerprint. |
| Core - Block - Legacy authentication | enabled | **enforced.** `s-goal-block-legacy-auth`. |
| Core - Block - Device code flow | enabled | **enforced.** `s-goal-block-device-code`. |
| Core - Grant - Admins phishing-resistant | enabledForReportingButNotEnforced | **Coverage only.** reportOnly, `inPlace`. |
| Core - Grant - Compliant device for Office | enabledForReportingButNotEnforced | **report-only, drifted.** `s-goal-require-managed-device` adjust / in-report-only / condition `blocked`; `on-hold`; operation-target. Coverage: `require-managed-device` reportOnly, `partly`. |
| Core - Extra 9 - Grant - Admins phishing-resistant | enabled | **enforced.** `s-goal-admins-phishing-resistant`, fingerprint. |
| Guests MFA + Extra 6, 18, 30 (MFA) + Extra 10, 22, 34 (Guests) — 7 | enabled | **Coverage only.** Strong satisfier, `inPlace`. |
| Extra 12, 24, 36 (MFA) + Extra 16, 28 (Guests) — 5 | enabledForReportingButNotEnforced | **Coverage only.** reportOnly, `inPlace`. |
| Extra 7, 13, 19, 25, 31, 37 (Legacy) — 6 | enabled | **Coverage only.** Strong satisfier, `inPlace`. |
| Extra 8, 20, 32 (Device code) — 3 | enabledForReportingButNotEnforced | **Coverage only.** reportOnly, `inPlace`. |
| Extra 14, 26, 38 (Device code) — 3 | enabled | **Coverage only.** Strong satisfier, `inPlace`. |
| Extra 15, 21, 27, 33, 39 (Admins) — 5 | enabled | **Coverage only.** Strong satisfier, `inPlace`. |
| Extra 11, 17, 23, 29, 35 (Compliant device) — 5 | enabled | **Coverage only.** `require-managed-device` strong, `partly`. |

**Missing (10):** `s-goal-register-info-protected`, `s-goal-block-auth-transfer`, `s-goal-admin-session`, `s-goal-admin-portals-protected`, `s-goal-geo-restriction`, `s-goal-block-unsupported-platforms`, `s-goal-device-registration-mfa`, `s-goal-intune-enrollment-reauth`, `s-goal-all-users-no-persistence`, `s-goal-token-protection`.

### huge (built only with `HUGE=1`)
- **Spec:** 25,000 users, 300 admins, P2, 120 policies, multi-geo.
- **Policies:** Extras 6–119, grouped by the same rule as `large`.

| Policy (count) | State | Reading |
|---|---|---|
| MFA for all users / Legacy authentication / Device code flow (templates) | enabled | **enforced** (same steps as `large`). |
| Core - Grant - Admins phishing-resistant | enabledForReportingButNotEnforced | **Coverage only.** reportOnly, `inPlace`. |
| Core - Grant - Compliant device for Office | enabledForReportingButNotEnforced | **Not read.** |
| Core - Extra 9 - Grant - Admins phishing-resistant | enabled | **enforced.** `s-goal-admins-phishing-resistant`. |
| Guests MFA + enabled MFA/Guests extras (n%6 ∈ {0,4}, n%4 ≠ 0) — 21 | enabled | **Coverage only.** Strong satisfier, `inPlace`. |
| MFA/Guests extras with n%4 = 0 — 18 | enabledForReportingButNotEnforced | **Coverage only.** reportOnly, `inPlace`. |
| Legacy extras (n%6 = 1) — 19 | enabled | **Coverage only.** Satisfier, `inPlace`. |
| Device code extras with n%4 = 0 — 10 | enabledForReportingButNotEnforced | **Coverage only.** reportOnly, `inPlace`. |
| Device code extras, other — 9 | enabled | **Coverage only.** Satisfier, `inPlace`. |
| Admins extras except 9 (n%6 = 3) — 18 | enabled | **Coverage only.** Satisfier, `inPlace`. |
| Compliant device extras (n%6 = 5) — 19 | enabled | **Not read.** |

**Missing (14):** `s-goal-register-info-protected`, `s-goal-block-auth-transfer`, `s-goal-admin-session`, `s-goal-admin-portals-protected`, `s-goal-pim-activation-reauth`, `s-goal-geo-restriction`, `s-goal-block-unsupported-platforms`, `s-goal-device-registration-mfa`, `s-goal-all-users-no-persistence`, `s-goal-sign-in-risk`, `s-goal-sign-in-risk-medium`, `s-goal-user-risk`, `s-goal-user-risk-medium`, `s-goal-token-protection`.

### messy
- **Spec:** 120 users, 6 admins, P1, 6 policies + 24 disabled + 6 report-only (36 in total). Security defaults on; per-user MFA in `preMigration`; SMS-only break-glass; exclusion group of 400.
- **Models:** the consolidation warning (above 40 policies with the goal map's additions), a legacy mess, and an unsafe emergency setup.

| Policy (count) | State | Reading |
|---|---|---|
| Core - Grant - MFA for all users | enabled | **enforced.** `s-goal-mfa-all-users` and `s-goal-guests-mfa`, fingerprint. |
| Core - Block - Legacy authentication | enabled | **enforced.** `s-goal-block-legacy-auth`. |
| Core - Block - Device code flow | enabled | **enforced.** `s-goal-block-device-code`. |
| Core - Grant - Admins phishing-resistant | enabledForReportingButNotEnforced | **report-only, drifted.** `s-goal-admins-phishing-resistant` adjust / in-report-only / `blocked`; `on-hold`. Coverage: `admins-phishing-resistant` reportOnly, `partly`. |
| Core - Grant - Guests MFA | enabled | **Coverage only.** `guests-mfa` strong satisfier, `inPlace`. |
| Core - Grant - Compliant device for Office; Test - Report only 5 — 2 | enabledForReportingButNotEnforced | **Not read.** |
| Old - Disabled 0, 4, 6, 10, 12, 16, 18, 22 — 8 | disabled | **Coverage only.** `mfa-all-users` and `guests-mfa` disabled contribution. |
| Old - Disabled 1, 7, 13, 19 — 4 | disabled | **Coverage only.** `block-legacy-auth` disabled. |
| Old - Disabled 2, 8, 14, 20 — 4 | disabled | **Coverage only.** `block-device-code` disabled. |
| Old - Disabled 3, 9, 15, 21 — 4 | disabled | **Coverage only.** `mfa-all-users` / `admins-phishing-resistant` disabled. |
| Old - Disabled 5, 11, 17, 23 — 4 | disabled | **Not read.** |
| Test - Report only 0, 4 — 2 | enabledForReportingButNotEnforced | **Coverage only.** `mfa-all-users` / `guests-mfa` reportOnly. |
| Test - Report only 1 | enabledForReportingButNotEnforced | **Coverage only.** `block-legacy-auth` reportOnly. |
| Test - Report only 2 | enabledForReportingButNotEnforced | **Coverage only.** `block-device-code` reportOnly. |
| Test - Report only 3 | enabledForReportingButNotEnforced | **Coverage only.** `mfa-all-users` / `admins-phishing-resistant` reportOnly. |

**Missing (9):** `s-goal-register-info-protected`, `s-goal-block-auth-transfer`, `s-goal-admin-portals-protected`, `s-goal-admin-session`, `s-goal-geo-restriction`, `s-goal-block-unsupported-platforms`, `s-goal-device-registration-mfa`, `s-goal-all-users-no-persistence`, `s-goal-token-protection`.

### midflight
- **Spec:** 60 users, 3 admins, P1, 6 policies.
- **Models:** a plan already partway through. Every policy carries the plan tag `[IAMAI:plan-midflight:<step id>]`; the plan predates the policies (`planCreatedAt` 60 days ago); device code flow was left `disabled`.

| Policy | State | Reading |
|---|---|---|
| Core - Grant - MFA for all users | enabled | **enforced.** `s-goal-mfa-all-users` done/healthy, matched by `step-tag`. |
| Core - Block - Legacy authentication | enabled | **enforced.** `s-goal-block-legacy-auth`, step-tag. |
| Core - Block - Device code flow | disabled | **missing.** `s-goal-block-device-code` member lifecycle `not-deployed`; step create/blocked/blocked; `driftOutcomeOf` = `correctable`; step-tag. Coverage: disabled, verdict `missing`. |
| Core - Grant - Admins phishing-resistant | enabledForReportingButNotEnforced | **report-only, drifted.** `s-goal-admins-phishing-resistant` adjust / in-report-only / `blocked`; `on-hold`; operation-target. |
| Core - Grant - Guests MFA | enabled | **enforced.** `s-goal-guests-mfa`, step-tag. |
| Core - Grant - Compliant device for Office | enabledForReportingButNotEnforced | **Not read.** The tag names a step this plan does not carry. |

**Missing (10):** `s-goal-register-info-protected`, `s-goal-block-auth-transfer`, `s-goal-block-device-code`, `s-goal-admin-session`, `s-goal-admin-portals-protected`, `s-goal-geo-restriction`, `s-goal-block-unsupported-platforms`, `s-goal-device-registration-mfa`, `s-goal-all-users-no-persistence`, `s-goal-token-protection`.

### hostile
- **Spec:** 40 users, 2 admins, P1, 3 policies, `hostile: true`.
- **Models:** a scan that read almost nothing:
  - the registration report and devices were refused (403);
  - no sign-in records;
  - every person's methods `unknown`;
  - no scenario evidence;
  - emergency answers both `false`.

| Policy | State | Reading |
|---|---|---|
| Core - Grant - MFA for all users | enabled | **enforced.** `s-goal-mfa-all-users` and `s-goal-guests-mfa`, fingerprint. |
| Core - Block - Legacy authentication | enabled | **enforced.** `s-goal-block-legacy-auth`. |
| Core - Block - Device code flow | enabled | **enforced.** `s-goal-block-device-code`. |

**Missing (10):** same list as `small`.

### Fixture variants (not separate tenants)

- `curatedFixture(name)` / `allCuratedFixtures()`: the same tenant on `asCuratedBaseline`. The interpretation file's `unknown` source groups are read as `authorEnvironment`. Lane counts for these are in the table below.
- `withBreakGlassCarveOut(f)`: the policies carve out the break-glass group instead of the chosen group. Not computed.
- `noExclusionsAnswer(f)`: the exclusions-group record is removed. Not computed.
- `strengthMissing(snapshot)`: no custom authentication strength. Not computed.
- `src/roadmap/fixtures/transitions.ts` (`advance`, `rescan`, `transitions()`) and `src/roadmap/fixtures/semantics.ts` (`corpus()`, `unansweredSafetyCase`, `collidingNamesCase`, `reviewHeldCase`, `setAsideCase`): derived from the named fixtures above. Not enumerated or computed here.
- `src/roadmap/fixtures/records.ts` and `scenarioRows.ts`: builders (report-only records, sign-in rows), not tenants.

---

## MOCK tenants (dev-only; `App.tsx` MOCK branch; `fixtureBaseline()`)

### mock (`state=scanned`)
- **File:export:** `src/testing/uiSnapshot.ts` → `fixtureSnapshot()`, with `fixtureBaseline()`, `FIXTURE_EXCLUSIONS_GROUP` (`g-exclusions`) and `FIXTURE_EMERGENCY_ACCOUNTS`.
- **Models:** five people, three CA policies, one custom strength, one report-only result; the gallery and contract walk tenant. App seeds the exclusions record, its group cache, and the emergency-account decision.

| Policy | State | Reading |
|---|---|---|
| CA001 - Require MFA for all users | enabled | **enforced, drifted.** Members of `s-goal-mfa-all-users` and `s-goal-guests-mfa` (adjust/blocked/blocked); lane drift; `on-hold`; operation-target. Coverage: strong, `partly`. |
| CA002 - Block legacy authentication | enabledForReportingButNotEnforced | **report-only, drifted.** `s-goal-block-legacy-auth` adjust / in-report-only / blocked; `on-hold`. Coverage: reportOnly, `partly`. Lane: On Hold · `sourceMapping:11111111`. |
| CA003 - Admins phishing-resistant | disabled | **Coverage only, missing.** `admins-phishing-resistant`, `admin-session` and `all-users-no-persistence` disabled; each verdict `missing`. |

**Missing (11):** `s-goal-register-info-protected`, `s-goal-block-auth-transfer`, `s-goal-block-device-code`, `s-goal-admin-session`, `s-goal-admins-phishing-resistant`, `s-goal-admin-portals-protected`, `s-goal-geo-restriction`, `s-goal-block-unsupported-platforms`, `s-goal-device-registration-mfa`, `s-goal-all-users-no-persistence`, `s-goal-token-protection`.

### mock `?big=1`
- **File:export:** `src/testing/bigFixture.ts` → `bigFixtureSnapshot()`.
- **Models:** a performance guard with 5,000 users, 60 policies (CA001–CA003 as above, then CA004–CA060 over 200 groups), and ~40,000 sign-ins. None of the 125 groups the policies name is in the group cache, so each reads `unknown`.

| Policy (count) | State | Reading |
|---|---|---|
| CA001 - Require MFA for all users | enabled | **enforced, drifted.** Member of `s-goal-guests-mfa` only; `on-hold`. Coverage: `mfa-all-users` strong, verdict `unknown`; `guests-mfa` `partly`. |
| CA002 - Block legacy authentication | enabledForReportingButNotEnforced | **report-only, drifted.** As in mock. |
| CA003 - Admins phishing-resistant | disabled | **Coverage only, missing.** As in mock. |
| 25 (CA005, CA007, CA009, CA011, …) | enabled | **Not read.** Listed in `organisation.notInBaseline`. |
| 9 (CA006, CA014, CA018, CA026, …) | enabled | **Coverage only.** `mfa-all-users` strong, `unknown`. |
| 10 (CA008, CA012, CA020, CA024, …) | enabledForReportingButNotEnforced | **Coverage only.** `mfa-all-users` reportOnly, `unknown`. |
| 5 (CA004, CA016, CA028, CA040, …) | enabledForReportingButNotEnforced | **Not read.** |
| 3 (CA010, CA034, CA046) | enabled | **Not read.** |
| 3 (CA013, CA031, CA049) | disabled | **Not read.** In `notInBaseline`. |
| 2 (CA022, CA058) | disabled | **Not read.** |

**Missing (11):** same list as mock.

### mock URL variants (same `fixtureSnapshot()`, mutated in `App.tsx`)
- `?policies=0`: no policies. **Missing (14):** the `getiamai` list.
- `?denied=1`: `caPolicies`, `roleAssignments` and `namedLocations` refused (0 rows); sign-ins refused. **Missing (14):** the same list.
- `?licence=free`: no capabilities, no sign-ins, no registration report. The three policies are **not read**: every goal is `licenceLimited` (22) or `notApplicable` (5), so there are no policy steps.

### gaps
- **File:export:** `src/testing/gapsFixture.ts` → `gapsSnapshot()`: the mock scan without its `caPolicies` section and with sign-in records refused.
- **Not a Plan input.** `?state=gaps` keeps `lastScan` as `fixtureSnapshot()`, and `gapsSnapshot()` feeds only Connect's `coreGaps`/`unreadSources`. The Plan under `?state=gaps` is the mock tenant's. Policies: none (section absent).

### pilotFixture
- **File:export:** `src/testing/pilotFixture.ts` → `pilotStepAt`, `pilotBindings`, `pilotRuntime`, `PILOT_IDS`.
- **Not a tenant.** It moves one real fixture step (`s-goal-device-registration-mfa`) into a synthetic runtime state (`missing` / `reportOnly` / `readyToEnforce`) and supplies bindings for the implementation-content pilot harness. It has no CA policy list and no plan.

### Other `src/testing/*.ts`
- `authorUpdate.ts` (`mockAuthorUpdate`): a baseline author-update mock. No tenant.
- `transient.ts`: an external-probe helper. No tenant.

---

## Expected lane counts on the current build

**Build:** HEAD `4cde3e6` · computed 2026-09-12 · Node v24.20.0. The scratch script lives outside the repo and is not committed. **Recomputed for A1a (2026-09-12)** on the runFixture rows only; the Plan-page and MOCK rows are derived from the same per-row moves and marked as such. What moved, and why (A1a): `s-goal-all-users-no-persistence` is an engine row (decision 8: the graph carries the runtime id), so it leaves the fallback path; a missing object whose maker step the plan carries is a healthy step edge, never a `missingObject` hold (A1 §8.4; the legacy `prerequisite` hold maps to a step edge); the legacy device-decision wait on `s-goal-intune-enrollment-reauth` is a step edge on its create, so it queues behind `s-prereq-device-plan`; a started policy waiting on a maker stays Ready (§3).

**How each chain was computed**

- **Demo, Plan page:** the call chain `App.tsx` demo seeding → `usePlanData` computed memo (`planData.ts`) → `Plan.tsx` Cleanup rows + `laneReadings`.
  - **Store reads replaced.** IndexedDB reads were swapped for what App.tsx writes:
    - the mapping via `loadMappingState`'s merge + `migrateEmergencySelection`;
    - the group cache from `demoTenant().groups` (cache `asOf` equals the snapshot's, so `readGroup` returns it; no demo group was left uncached);
    - the plan record from `nextDemoRecord` with no stored row, i.e. a first visit: `planCreatedAt` and `observations` are null on first render.
  - **Pipeline:** `appliedMapping` → `computeCoverage` → `generateRoadmap` (`operatorUserId: null`, start `proposedStart('Australia/Sydney')`) → `applySkips` → `applyProgress` → `settleForecast` → `annotateStateReasons`.
  - **Lanes:** Cleanup rows as Plan.tsx filters them (`cleanupEntry(kind) !== null`, `cleanupComplete(row, applied.breakGlassAnswers)`), then `laneReadings(steps, cleanupRows)`. The lane adapter reads no date (`planLanes.test.ts`), so the counts do not depend on the day of the run.
- **Roadmap fixtures:** `runFixture(fixture(name))` (the property tests' chain), then the same Cleanup-row and `laneReadings` step. "Curated" is `runFixture(curatedFixture(name))`.
- **MOCK:** the same Plan-page chain with `fixtureBaseline()`, App.tsx's seeded mapping and `g-exclusions` cache, and no plan record. Groups not in the cache read `unknown`, since no token exists in the mock (`readGroup` → `presenceOfError` → `unknown`).

**Columns.**
- **Ready / Up Next / On Hold** are the three tab badges (`focusCounts().lanes`).
- **Completed** and **Deferred** are the rows hidden until **Show completed** / **Show deferred** is pressed; these are the counts those buttons show.
- **Needs attention** is the focus count (`planStateOf(...).attention`). It is not a lane.

| Tenant / chain | Ready | Up Next | On Hold | Completed (Show completed) | Deferred (Show deferred) | Needs attention |
|---|---:|---:|---:|---:|---:|---:|
| demo Initial · Plan page, first visit | 11 | 3 | 15 | 1 | 0 | 3 |
| demo Follow-up · Plan page, entered directly (A4: derived, not recomputed) | 12 | 1 | 10 | 10 | 0 | 1 |
| demo Follow-up · Plan page, after Initial then Scan again (A4: derived, not recomputed) | 12 | 1 | 10 | 10 | 0 | 5 |
| `fixture('demo')` · runFixture | 11 | 3 | 15 | 1 | 0 | 19 |
| `curatedFixture('demo')` · runFixture | 15 | 12 | 2 | 1 | 0 | — |
| `fixture('demo-week2')` · runFixture (A4: recomputed 2026-09-12) | 10 | 0 | 10 | 10 | 0 | 12 |
| `curatedFixture('demo-week2')` · runFixture | 15 | 4 | 1 | 10 | 0 | — |
| micro (plain = curated) | 7 | 0 | 0 | 7 | 0 | 0 |
| small (plain = curated) | 15 | 1 | 0 | 7 | 0 | 8 |
| getiamai (plain = curated) | 18 | 1 | 0 | 3 | 0 | 8 |
| mid (plain = curated) | 21 | 2 | 1 | 8 | 0 | 11 |
| large (plain = curated) | 18 | 2 | 0 | 8 | 0 | 10 |
| huge, `HUGE=1` (plain = curated; A1a: derived, not recomputed) | 19 | 2 | 0 | 8 | 0 | 10 |
| messy (plain = curated) | 9 | 10 | 0 | 6 | 0 | 12 |
| midflight (plain = curated) | 15 | 1 | 0 | 6 | 0 | 8 |
| hostile (plain = curated) | 15 | 2 | 0 | 6 | 0 | 9 |
| mock (`state=scanned`) · Plan page (A1a: not recomputed; `s-goal-all-users-no-persistence` now an engine row in Up Next) | 7 | 12 | 1 | 1 | 0 | 2 |
| mock `?big=1` · Plan page (A1a: not recomputed) | 7 | 12 | 1 | 1 | 0 | 2 |
| mock `?policies=0` · Plan page (A1a: not recomputed) | 16 | 2 | 1 | 2 | 0 | 1 |
| mock `?denied=1` · Plan page (A1a: not recomputed) | 6 | 12 | 4 | 0 | 0 | 1 |
| mock `?licence=free` · Plan page (A1a: not recomputed) | 10 | 0 | 0 | 3 | 0 | 0 |
| gapsSnapshot (reference only; never on the Plan; A1a: not recomputed) | 7 | 13 | 1 | 1 | 0 | 1 |
| pilotFixture | not computed (not a tenant: one step transformer, no snapshot) | | | | | |

No fixture has a skipped step, so Deferred is 0 everywhere.

### Lane membership: demo tenants (Plan page)

**Initial**
- **Ready (11):**
  - `s-prereq-break-glass` · Create
  - `s-verify-mfa` · Create
  - `s-prereq-device-plan` · Needs decision
  - `s-prereq-service-accounts-group` · Create
  - `s-prereq-allowed-countries` · Create
  - `s-shared-devices` · Create
  - `s-goal-register-info-protected` · Create
  - `cleanup-notAssessed` · Create
  - `s-check-dormant-accounts` · Create
  - `s-check-separate-admin-accounts` · Create
  - `cleanup-alerting` · Create (runtime-only fallback)
- **Up Next (3):**
  - `s-prereq-exclusion-group` (after `s-prereq-break-glass`)
  - `cleanup-drill` (after `s-prereq-break-glass`)
  - `s-goal-intune-enrollment-reauth` (after `s-prereq-device-plan`; A1a — the legacy device-decision wait is a step edge on its create)
- **On Hold (15):**
  - `s-goal-admin-portals-protected` · sourceConflict (the pinned admin-portals policy; id withheld)
  - `s-goal-guests-mfa` · unsupported:unmatched-pair
  - `s-goal-device-registration-mfa` and `s-goal-require-managed-device` · sourceMapping:2d25c298
  - `s-goal-admin-session`, `s-goal-admins-phishing-resistant`, `s-goal-block-auth-transfer`, `s-goal-block-device-code`, `s-goal-block-legacy-auth`, `s-goal-block-unsupported-platforms`, `s-goal-geo-restriction`, `s-goal-mfa-all-users`, `s-goal-service-accounts-trusted-network`, `s-goal-token-protection` · sourceMapping:62d67e66
  - `s-goal-all-users-no-persistence` · sourceMapping:62d67e66 (an engine row since A1a, decision 8)
- **Completed (1):** `s-prereq-trusted-location`

**Follow-up (entered directly; the same lanes after Initial then Scan again)**
- **Ready (12; A4):**
  - `s-goal-intune-enrollment-reauth` · Observing (A4: the plan-created policy is in report-only, undrifted, its window open)
  - `s-verify-mfa` · Create
  - `s-prereq-device-plan` · Needs decision
  - `s-prereq-service-accounts-group` · Create
  - `s-prereq-allowed-countries` · Create
  - `s-question-partner` · Needs decision
  - `s-shared-devices` · Create
  - `s-question-mail-devices` · Create
  - `s-goal-register-info-protected` · Create
  - `cleanup-notAssessed` · Create
  - `s-check-dormant-accounts` · Create
  - `s-check-separate-admin-accounts` · Create
- **Up Next (1; A4):** `s-question-travel` (after `s-prereq-allowed-countries`)
- **On Hold (10):**
  - `s-goal-admin-portals-protected` · sourceConflict
  - `s-goal-device-registration-mfa` and `s-goal-require-managed-device` · sourceMapping:2d25c298
  - `s-goal-admin-session`, `s-goal-block-auth-transfer`, `s-goal-block-unsupported-platforms`, `s-goal-geo-restriction`, `s-goal-service-accounts-trusted-network`, `s-goal-token-protection` · sourceMapping:62d67e66
  - `s-goal-all-users-no-persistence` · sourceMapping:62d67e66 (an engine row since A1a)
- **Completed (10):** `s-prereq-break-glass`, `s-prereq-exclusion-group`, `cleanup-drill`, `s-prereq-trusted-location`, `s-goal-mfa-all-users`, `s-goal-admins-phishing-resistant`, `s-goal-block-device-code`, `s-goal-block-legacy-auth`, `s-goal-guests-mfa`, `cleanup-alerting`

`runFixture` on `demo-week2` (10/0/10/10 since A4) lacks the three `s-question-*` rows that the seeded week-two answers create. That accounts for the difference from the Plan page (12/1/10/10, derived).

### Other fixtures: Up Next and On Hold (A1a)

- **small, getiamai, midflight, large, huge:** Up Next = `s-goal-geo-restriction` (after `s-prereq-allowed-countries`); `s-goal-all-users-no-persistence` is Ready · Create (an engine row). `large` (and huge) also queue `s-goal-intune-enrollment-reauth` after `s-prereq-device-plan`. On Hold is empty.
- **hostile:** Up Next adds `cleanup-drill` (after `s-prereq-break-glass`). On Hold is empty.
- **mid:**
  - On Hold: `s-goal-service-accounts-trusted-network` · sourceMapping:00000014 (synthetic baseline).
  - Up Next: `s-goal-geo-restriction` (after `s-prereq-allowed-countries`) and `s-goal-token-protection` (after `s-prereq-service-accounts-group`, the maker of the object its body names; §8.4).
- **messy:**
  - On Hold: empty. `s-goal-admins-phishing-resistant` (an existing policy waiting on `s-prereq-exclusion-group`) is Ready · Correct with the group as a healthy prerequisite (§3: started work stays Ready).
  - Up Next (10): `s-goal-admin-portals-protected`, `s-goal-admin-session`, `s-goal-all-users-no-persistence`, `s-goal-block-auth-transfer`, `s-goal-block-unsupported-platforms`, `s-goal-device-registration-mfa`, `s-goal-register-info-protected` and `s-goal-token-protection` (each after `s-prereq-exclusion-group`); `s-goal-geo-restriction` (after `s-prereq-allowed-countries`); `s-prereq-security-defaults` (after `s-goal-admins-phishing-resistant`).
- **mock, mock `?big=1`:** (not recomputed in A1a)
  - On Hold: `s-goal-block-legacy-auth` · sourceMapping:11111111.
  - Up Next (12): `s-prereq-exclusion-group` and `cleanup-drill` (after `s-prereq-break-glass`), nine policy creates after `s-prereq-exclusion-group`, and `s-goal-all-users-no-persistence` (now read by the engine, after `s-prereq-exclusion-group`).
- **micro, mock `?licence=free`:** all rows are Ready or Completed. Most rows are runtime-only `s-ladder-*` fallbacks.

**Rows the lane adapter reads from the Plan's own state** (`fromEngine: false`: the dependency graph does not know them), seen across these runs:
- `cleanup-alerting`, `cleanup-consolidation`, `cleanup-naming`
- `s-blocker-allowed-countries`
- `s-ladder-app-passwords`, `s-ladder-guest-review`, `s-ladder-legacy-auth-inventory`, `s-ladder-stale-accounts`, `s-ladder-admin-accounts-separate`, `s-ladder-authenticator-over-sms`, `s-ladder-break-glass-accounts`, `s-ladder-global-admin-count`, `s-ladder-per-user-mfa-cleanup`, `s-ladder-security-defaults`

`s-prereq-source-references` is a row on none of them.

### Unit tests that touch these lanes

**No unit test asserts absolute lane counts for any fixture.** The tests below assert properties of the lanes; every computed run above agrees with them.

- `src/ui/surfaces/planBoard.test.ts`, "the counts are counted off the board": for `demo` and `getiamai` via `runFixture`, each tab's badge equals its rows, and Ready > 0. **Agrees** (11 and 17).
- `src/ui/surfaces/planLanes.test.ts`, "every row lands in exactly one lane…":
  - done → Completed, skipped → Deferred;
  - a finished `cleanup-alerting` → Completed, and `cleanup-drill` is open work.

  This runs over demo, demo-week2, small, mid, messy, midflight, curated getiamai and every curated fixture. **Agrees:** no skips, Deferred 0. The test injects its own two Cleanup rows, so its row set differs from Plan.tsx's.
- `src/ui/surfaces/planLanes.test.ts`, "the graph's non-step prerequisites…": on demo, admin-portals is `baseline-conflict`, the `sourceMapping:62d67e66` prerequisite is `resolved` globally, and nothing is deferred. **Agrees.**
- `src/ui/surfaces/planLanes.test.ts`, "a row the graph does not know…": `s-prereq-source-references` has no reading, `s-goal-all-users-no-persistence` is an engine row (A1a), and micro's `s-ladder-*` rows are runtime-only. **Agrees.**
- `src/ui/surfaces/planLanesHolds.test.ts` (A1a): one test per legacy `HoldKind`, each on a `small` policy step shaped to carry that hold alone, asserting the engine counterpart (conflict → `sourceConflict`, decision → Needs decision, review → Correct, unavailable → `unsupported`, readiness → an evidence gate on enforce with the threshold text, prerequisite → a step edge on enforce / create or a `fact`, evidence → the observation gate).
- `src/roadmap/sourceReferences.test.ts`, "S4: the unidentified-groups row is gone from every plan": demo, demo-week2, small, mid, messy, midflight, curated demo and curated demo-week2. **Agrees.**
- `src/roadmap/sourceReferences.test.ts`, "S4: each policy naming an unmapped reference is On Hold with the reason": demo and demo-week2 via runFixture, reason `sourceMapping` (or `sourceConflict` where the baseline conflicts). **Agrees:** 13 of demo's 15 On Hold rows are sourceMapping holds and one is the admin-portals sourceConflict. The 15th, `s-goal-guests-mfa`, is held by `unsupported:unmatched-pair`, which that test does not cover.
- `src/ui/surfaces/planLanes.test.ts`, "a step the plan cannot act on is never Ready": **Agrees.** Every pending-mapping, conflict or unmatched-pair step above is On Hold.

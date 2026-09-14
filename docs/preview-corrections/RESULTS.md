# Correction ledger

Starting source SHA: c65d9f426d3b744ad911ebee01ba99ca8276a688 (audited); candidate HEAD at S0 start f2d8806 = c65d9f4 + specs-only docs commit
Baseline pin: baselines/jhope188-conditionalaccesspolicies.pinned.json commit 90d9b890c4b9af2ac4bc02d97c06bf8900064b4c (Jon Hope, unchanged)
Candidate branch: preview-corrections
Initial tests/build: see S0 notes below

| ID | Implementation status | Independent review | Evidence / scenario / command | Commit / next action |
|---|---|---|---|---|
| C01 | REPRODUCED → FIXED (identity: target/tracking selection) — see S1 notes for the narrower invariant and remaining gaps | NOT VERIFIED | S1 probe `node docs/preview-corrections/probes/s1-c01.ts` (demo tenant + role/phishing-resistant, All-users-minus-guests MFA, role session-only policies). Before (`logs/s1/c01-before*.txt`): all-users step claimed the ADMIN policy (as listed) or the GUESTS policy (reversed); admins-phishing-resistant claimed the SESSION-only policy in every order. After: all-users → All-users policy, admins → admin grant policy, session → session policy in every order/name variant. Test `node --test src/roadmap/policyIdentity.test.ts` 7/7 pass | S1 commit (see git log "C01"); sections/grant coupling follow-up below |
| C02 | PENDING | NOT VERIFIED | Report-only staging text located (case-insensitive `report-only`/`enabledForReportingButNotEnforced` counts in CONTENT.md): token-protection 31, block-legacy-auth 18, block-device-code 15, user-risk 14, mfa-all-users 13. Several JSON full-target blocks hard-code `"state":"enabledForReportingButNotEnforced"` (e.g. block-device-code CONTENT.md:46, azure-management-mfa :39). Lifecycle intent vs baseline not yet read | S1/S3: read baseline interpretation per step before any lifecycle edit |
| C03 | REPRODUCED | NOT VERIFIED | Probe `node docs/preview-corrections/probes/s0-repro.ts` (mocked fetch): `{"value":[]}`→[] (correct); `not-json`, `{}`, `{"foo":1}`, `{"value":{"id":"x"}}` all →[] (defect); page 1 valid + nextLink, page 2 `not-json` → returns page-1 rows only, no error (defect). Path: http.ts:137-144 parse failure → `{}`; http.ts:166 non-array/missing `value` → `[]`. Scalar count bodies go through http.ts:141 `typeof parsed === 'number'` — must be preserved | S2 |
| C04 | REPRODUCED | NOT VERIFIED | Same probe, personReadiness with retained 2024 passkey proof: replacement key with no creation date → `ready`, proof 2024 retained (defect); replacement created 2026 → `needsProof` (correct); key created 2023 → `ready` (correct). Paths: collectors.ts:287 keeps only `createdDateTime` (no `creationDateTime` read anywhere in non-test src); phishingResistant.ts:321 `d === null \|\| d <= p.at` treats unknown date as compatible | S2 |
| C05 | PENDING (library baseline captured) | NOT VERIFIED | `node scripts/compile-implementation-content.mjs --validate-library --json <logs>/library-validation.json` exit 0: 46 packages, 1 passes production validation (s-goal-device-registration-mfa), 45 fail. Largest families: 34 pkgs readiness tile result not machine (126 errors); 26 pkgs troubleshooting stage not runtime (185); 14 name.canonical owner decision; 11 support model prose; 8 script mode withheld; 6 non-policy object correction; 5 Email without audience/trigger. 44 authored against a pin other than 90d9b890; semantic re-pin review 43 current, 1 reviewNeeded (s-goal-admin-portals-protected). This is production-validation failure, not the same metric as the audits' runtime "unavailable" counts; per-step runtime channel matrix not yet produced | S3: runtime package/state/channel matrix |
| C06 | PENDING | NOT VERIFIED | Authored JSON uses typed `{{json:policy.target.*}}` bindings (e.g. intune-enrollment-reauth CONTENT.md:57 `excludeGroups` binding); no literal quoted placeholder strings in CONTENT.md. protocol.ts:199 `maskJsonTemplate` masks to `null` for validation only. Runtime fill is project.ts:120-135 `bindText`: a `{{json:x}}` binding emits `JSON.stringify(value)` (null allowed); a missing required binding refuses the block, never prints the token. So an audited placeholder string in `conditions`/`excludeGroups` must come from the binding VALUE supplied to bindText, not the template. Value source not located in S0; not reproduced | S3: trace binding values (library.ts / stepPackage.ts) for incomplete tenant inputs |
| C07 | PENDING | NOT VERIFIED | Not attempted in S0 | S4 |
| C08 | PENDING | NOT VERIFIED | Not attempted in S0 | S4 |
| C09 | PENDING | NOT VERIFIED | Not attempted in S0 | S4 |

Append segment notes and exact check results. Never convert a timeout, empty output, skipped test, or reverted patch into success.

Launcher source SHA: c65d9f426d3b744ad911ebee01ba99ca8276a688

## S0 — baseline and reproduction (2026-09-13 21:13–21:20 MDT)

Initial state: HEAD f2d8806 (parent c65d9f4), working tree clean, `git stash list` empty, no preserved unfinished diff. No remote (`git remote -v` empty); core.hooksPath → ../empty-hooks. node_modules absent.

Environment: Windows 11, Git Bash; node v24.20.0, npm 11.19.0, git 2.54.0.windows.1, TypeScript 7.0.2 (npx tsc), vite 8 (lockfile).

Instructions/side effects inspected: CLAUDE.md (read-only product, `npx tsc --noEmit` while working, `npm test` once; walk reserved for closing segment). `npm test` = `node --test --test-isolation=none "src/**/*.test.ts"`; the only network test (learnLinks.test.ts:25) skips unless `EXTERNAL_HEALTH === '1'`, so it was left unset (EXTERNAL_HEALTH=0 not needed). `npm run build` = `vite build`: writes ignored dist/ and regenerates tracked home/theme.css + home/index.html (scripts/build-home.ts:360-361) — regenerated output was byte-identical (git status unchanged). smoke/walk not run (browser harness, reserved for S4/R2).

| Check | Command | Exit | Result |
|---|---|---|---|
| Install | `npm ci --ignore-scripts --no-audit --no-fund` | 0 | added 29 packages; lockfile unchanged |
| Typecheck | `npx tsc --noEmit` | 0 | no errors |
| Unit tests | `npm test` | 0 | 2553 tests · 2551 pass · 0 fail · 0 cancelled · 2 skipped (Learn-link external health; HUGE=1 25k-user fixture) · 191 s |
| Build | `npm run build` | 0 | built in 795 ms; one warning "Some chunks are larger than 500 kB after minification" (pre-existing, not a failure) |
| Library validation | `node scripts/compile-implementation-content.mjs --validate-library --json <logs>` | 0 | 46 packages · 1 pass · 45 fail (report only; see C05) |
| Repro probe | `node docs/preview-corrections/probes/s0-repro.ts` | 0 | C03, C04 reproduced (see table) |

Logs are outside the clone: ../logs/s0/{tsc,test,build,library-validation,probe-c03-c04}.*

Harness added: docs/preview-corrections/probes/s0-repro.ts — mocked fetch + synthetic readiness inputs only. It deliberately lives outside the test glob so a reproduced, not-yet-fixed defect does not turn `npm test` red; S2 should convert its cases into narrow regression tests alongside the fix.

C09 baseline: no "Public beta" notice in src (feedback@getiamai.com already exists in src/feedback.ts; not referenced from Connect.tsx). Not reproduced further.

Not done in S0: C01 synthetic reproduction (candidate paths only), C02 baseline-intent reading, C05 runtime package/state/channel matrix, C06 runtime placeholder path, C07/C08 reproduction. No application code changed.


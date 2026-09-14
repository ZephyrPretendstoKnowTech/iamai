# Correction ledger

Starting source SHA: c65d9f426d3b744ad911ebee01ba99ca8276a688 (audited); candidate HEAD at S0 start f2d8806 = c65d9f4 + specs-only docs commit
Baseline pin: baselines/jhope188-conditionalaccesspolicies.pinned.json commit 90d9b890c4b9af2ac4bc02d97c06bf8900064b4c (Jon Hope, unchanged)
Candidate branch: preview-corrections
Initial tests/build: see S0 notes below

| ID | Implementation status | Independent review | Evidence / scenario / command | Commit / next action |
|---|---|---|---|---|
| C01 | REPRODUCED → FIXED (identity: target/tracking selection) — see S1 notes for the narrower invariant and remaining gaps | NOT VERIFIED | S1 probe `node docs/preview-corrections/probes/s1-c01.ts` (demo tenant + role/phishing-resistant, All-users-minus-guests MFA, role session-only policies). Before (`logs/s1/c01-before*.txt`): all-users step claimed the ADMIN policy (as listed) or the GUESTS policy (reversed); admins-phishing-resistant claimed the SESSION-only policy in every order. After: all-users → All-users policy, admins → admin grant policy, session → session policy in every order/name variant. Second probe `s1-c01-noown.ts` (`logs/s1/c01-noown*.txt`): where the tenant's ONLY MFA policy is admin-role-scoped, the all-users step rewrote it to `includeUsers:["All"]` while the admins step wrote a grant onto the same object — fixed: no cross-goal target fallback (the step creates the goal's own policy); tracking fingerprint falls back only to a policy the classifier counted as delivering the goal. `policyIdentity.test.ts` 9/9; drift+identity 29/29 | Commits d594c63 (ownScope + target/fingerprint), 76320e8 (no cross-goal fallback, sections), c8f5542 (meetsFloor guard, inventory). Remaining gaps: BLOCKED.md S1 21:50 entry |
| C02 | REPRODUCED; engine grant-smuggling FIXED; lifecycle strategy BLOCKED (critical, owner decision) and TAP explanation open — see BLOCKED.md 21:35 entries | NOT VERIFIED | S1 channel probe `node docs/preview-corrections/probes/s1-c01-channels.ts` with `NOEX=1`: before, the admins correction of a policy whose only shortfall was the exclusions group carried `grantControls` replacing built-in phishing-resistant strength `…0004` with the baseline's custom strength (reason came from the session-only policy's "weaker-control"); admin-session listed "Grant controls — → —" for a sign-in-frequency raise (`logs/s1/c01-channels.txt`). After: Users-only / Session-only (`logs/s1/c01-channels-after.txt`); asserted in policyIdentity.test.ts. Earlier S0 notes: | Report-only staging text located (case-insensitive `report-only`/`enabledForReportingButNotEnforced` counts in CONTENT.md): token-protection 31, block-legacy-auth 18, block-device-code 15, user-risk 14, mfa-all-users 13. Several JSON full-target blocks hard-code `"state":"enabledForReportingButNotEnforced"` (e.g. block-device-code CONTENT.md:46, azure-management-mfa :39). S1 read lifecycle intent: the interpretation file carries none; pinned author states recorded in BLOCKED.md 21:35 | Engine: 76320e8, c8f5542. Next: owner decision on staging vs in-place correction of On policies, then S3 aligns Entra/JSON/PowerShell per package; S3/S4 names the TAP difference in existing prose |
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

## S1 — policy identity and correction semantics (2026-09-13 21:19–21:50 MDT)

Start: HEAD d4c88c7, tree clean, no stash, no preserved unfinished diff. Logs: ../logs/s1/.

### Expected behaviour (written before the fix, independent of the engine)
- The all-users MFA goal corrects and tracks the tenant's All-users policy (guests excluded or not), never a policy assigned only to directory roles or only to guests.
- The phishing-resistant admins goal corrects the admin-role policy that carries a grant, never a role-scoped session-only policy.
- The admin-session goal corrects the session policy.
- None of this changes when the scan lists the policies in reverse or when their names are swapped or neutral.
- A correction whose shortfall is the policy's users (exclusions group) or state writes no grant or session change; a tenant's built-in phishing-resistant strength is not swapped for the baseline's TAP-inclusive custom strength by a reason that belongs to another policy.
- A goal with no policy of its own never rewrites another goal's policy.

### Reproduced (before)
- `s1-c01.ts` (`c01-before*.txt`): all-users step claimed the admin-role policy (as listed) or the guests policy (reversed); admins step claimed the session-only policy in every order. Root cause: coverage.ts `ownScope` was always true for an all-users goal; generate.ts adjust target and tracking.ts fingerprint took the first candidate per tier in scan order, and `weak` outranked the admin grant policy.
- `s1-c01-channels.ts NOEX=1` (`c01-channels.txt`): admins correction of a policy short only of the exclusions group carried `grantControls` → baseline custom strength (reason came from the session policy); admin-session listed "Grant controls — → —" for a sign-in-frequency raise.
- `s1-c01-noown.ts` (`c01-noown.txt`): tenant whose only MFA policy is admin-role-scoped — all-users step PATCHed it to `includeUsers:["All"]` while the admins step wrote a grant onto the same object.
- `s1-c01-render.ts` (report-only admin variant, before c8f5542): the TAP swap persisted for a report-only admin policy meeting the floor.

### Fixed (commits)
- d594c63 — coverage.ts `ownScope`: all-users goal excludes role-only/guest-only assignments; any goal excludes a policy lacking the goal's kind of control (`carriesFloorControl`). generate.ts/tracking.ts prefer own-scope candidates.
- 76320e8 — generate.ts: no cross-goal target fallback (no own policy → existing create path); tracking.ts fingerprint falls back only to a policy in `satisfaction.policyIds`. `changedSections`: raised session floor → `sessionControls`. Strong existing policy: no grant/session/state sections from other candidates' reasons.
- c8f5542 — coverage records `meetsFloor`; the guard also covers report-only candidates meeting the floor (state kept for report-only).

### Rendered channels (after), synthetic prerequisites met — `s1-c01-render.ts` (`c01-render.txt`, `c01-render-after.txt`), listed and reversed
- all-users: portal opens the All-users policy, "Users → Include: All users, Guest or external users → all types … Exclude → Groups: Core - Exclusions"; JSON `{"conditions":{"users":…}}` only; PowerShell carries that policy id only, no grant/session.
- admin-session: portal opens the session policy, sign-in frequency 4 h + never persistent; JSON `sessionControls` only; PowerShell carries the session policy id only.
- admins (report-only, built-in strength): no operation (`no-operation`, next `observe`), the existing shape for a report-only policy with nothing to correct; before c8f5542 it offered the TAP swap.
- With the baseline's unsettled source groups unanswered (non-curated demo-week2), all channels stay withheld (`missing` decision tokens) — honest prerequisite behaviour, unchanged.

### Test expectation changes (explained)
- foundationA.test.ts "a deployed policy broader than the goal it delivers is tracked over the policy": premise relied on the guests step tracking the All-users policy by scan order although the tenant has its own guests policy (which policyTruth.test.ts:452 requires the step to name). Now builds that premise explicitly (guests policy removed); every assertion unchanged.
- tracking.drift.test.ts A1: asserted `foreign === 1` ("the regeneration wrote its update against the admins policy") — the defect itself — and then the hold. Now asserts directly that no update and no tracking targets a policy another goal's satisfaction claims; the hold assertions remain for any member that still points at one. The step is now an honest create for the goal's own policy (see BLOCKED 21:50 gap 3).
- planVariants.test.ts INVENTORY: one new shape, `small+unanswered/s-goal-guests-mfa` `no-found` (no shape lost). Its only candidate is the all-users MFA policy, which does not deliver the guests goal there; it remains found on the all-users step. Named test in policyIdentity.test.ts.

### Checks (S1)
| Check | Command | Exit | Result |
|---|---|---|---|
| Typecheck | `npx tsc --noEmit` (after each change; last `tsc-8.txt`) | 0 | no errors |
| Identity tests | `node --test --test-isolation=none src/roadmap/policyIdentity.test.ts src/ui/surfaces/planVariants.test.ts` | 0 | 27 pass · 0 fail |
| Focused suites | policyIdentity, tracking.drift, foundationA/B/C, policyTruth, guestsCoverage, coverage, tracking, resolvePolicy, roadmap, operations, changedFields, adminPortalConflict, baselineConflictPlan (`focused-6.txt`) | 0 | 322 pass · 0 fail |
| Full suite #1 (at 76320e8, before the A1 test edit was loaded) | `npm test` (`full-test-1.txt`) | 1 | 2562 tests · 2558 pass · 2 fail (A1 stale premise — since changed; planVariants inventory — since explained and updated) · 2 skipped |
| Build (at 76320e8) | `npm run build` (`build.txt`) | 0 | built in 347 ms; pre-existing chunk-size warning; tracked home/ output unchanged |
| Full suite #2 (source = c8f5542) | `npm test` (`full-test-2.txt`) | 0 | 2564 tests · 2562 pass · 0 fail · 0 cancelled · 2 skipped (Learn-link external health; HUGE=1 fixture — same as S0) · 189 s |
| Build #2 (at c8f5542) | `npm run build` (`build-2.txt`) | 0 | built in 316 ms; tracked home/ output unchanged |

### Not done / open
- C01 remaining gaps and the report-only below-floor duplicate: BLOCKED.md S1 21:50.
- C02 lifecycle staging strategy (critical, owner decision) and TAP explanation in prose: BLOCKED.md S1 21:35. No authored content changed in S1.
- `entra.correct-grant` selection for a strong built-in-strength admin policy in the runtime package: NOT VERIFIED (S3).


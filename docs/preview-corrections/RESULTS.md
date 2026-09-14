# Correction ledger

Starting source SHA: c65d9f426d3b744ad911ebee01ba99ca8276a688 (audited); candidate HEAD at S0 start f2d8806 = c65d9f4 + specs-only docs commit
Baseline pin: baselines/jhope188-conditionalaccesspolicies.pinned.json commit 90d9b890c4b9af2ac4bc02d97c06bf8900064b4c (Jon Hope, unchanged)
Candidate branch: preview-corrections
Initial tests/build: see S0 notes below

| ID | Implementation status | Independent review | Evidence / scenario / command | Commit / next action |
|---|---|---|---|---|
| C01 | REPRODUCED → FIXED (identity: target/tracking selection) — see S1 notes for the narrower invariant and remaining gaps | R1 FAILED — group-assigned admins policy corrected by the all-users step by scan order (critical, REVIEW-1 F2); drifted own policy gets an executable duplicate create, A1 assertion vacuous (high, F1); role and roles+group shapes hold | S1 probe `node docs/preview-corrections/probes/s1-c01.ts` (demo tenant + role/phishing-resistant, All-users-minus-guests MFA, role session-only policies). Before (`logs/s1/c01-before*.txt`): all-users step claimed the ADMIN policy (as listed) or the GUESTS policy (reversed); admins-phishing-resistant claimed the SESSION-only policy in every order. After: all-users → All-users policy, admins → admin grant policy, session → session policy in every order/name variant. Second probe `s1-c01-noown.ts` (`logs/s1/c01-noown*.txt`): where the tenant's ONLY MFA policy is admin-role-scoped, the all-users step rewrote it to `includeUsers:["All"]` while the admins step wrote a grant onto the same object — fixed: no cross-goal target fallback (the step creates the goal's own policy); tracking fingerprint falls back only to a policy the classifier counted as delivering the goal. `policyIdentity.test.ts` 9/9; drift+identity 29/29 | Commits d594c63 (ownScope + target/fingerprint), 76320e8 (no cross-goal fallback, sections), c8f5542 (meetsFloor guard, inventory). Remaining gaps: BLOCKED.md S1 21:50 entry |
| C02 | REPRODUCED; engine grant-smuggling FIXED (S1); rendered Entra grant-smuggling FIXED for all-users/admins (S3); TAP difference named in the admins grant correction (S3); lifecycle strategy BLOCKED (critical, owner decision) — see BLOCKED.md 21:35 entries and S3 notes | R1 FAILED — lifecycle still BLOCKED (critical); grant-smuggling fix VERIFIED for all-users/admins in Entra/JSON/PowerShell; Intune Enrollment exclusion channel disagreement (high, pre-existing, F3) | S1 channel probe `node docs/preview-corrections/probes/s1-c01-channels.ts` with `NOEX=1`: before, the admins correction of a policy whose only shortfall was the exclusions group carried `grantControls` replacing built-in phishing-resistant strength `…0004` with the baseline's custom strength (reason came from the session-only policy's "weaker-control"); admin-session listed "Grant controls — → —" for a sign-in-frequency raise (`logs/s1/c01-channels.txt`). After: Users-only / Session-only (`logs/s1/c01-channels-after.txt`); asserted in policyIdentity.test.ts. Earlier S0 notes: | Report-only staging text located (case-insensitive `report-only`/`enabledForReportingButNotEnforced` counts in CONTENT.md): token-protection 31, block-legacy-auth 18, block-device-code 15, user-risk 14, mfa-all-users 13. Several JSON full-target blocks hard-code `"state":"enabledForReportingButNotEnforced"` (e.g. block-device-code CONTENT.md:46, azure-management-mfa :39). S1 read lifecycle intent: the interpretation file carries none; pinned author states recorded in BLOCKED.md 21:35 | Engine: 76320e8, c8f5542. S3 d0a5f73: the rendered admins conditions correction no longer tells the technician to set the TAP-inclusive custom strength while its JSON PATCHes conditions only (all-users: no longer sets plain MFA); `channelParity.test.ts`. Next: owner decision on staging vs in-place correction of On policies, then align the ten staging packages' Entra/PowerShell (BLOCKED S3) |
| C03 | REPRODUCED → FIXED (see S2 notes for scope not proven) | R1 VERIFIED for response-shape handling (s0-repro re-run, tests); required check foundationB.test.ts:73 still FAILS at HEAD; readGroup and worker end-to-end NOT VERIFIED | S0 probe before: malformed 200 bodies → `[]`. After (`logs/s2/probe-after.txt`): `value:[]` → `[]`; `not-json`, `{}`, `{"foo":1}`, non-array `value`, malformed later page → `GraphResponseShapeError`. `src/graph/collect/responseShape.test.ts` (valid empty, 8 malformed bodies, valid + malformed later page, `$count` 42/0, empty 200 body, non-JSON 404 keeps status, 503→malformed not re-retried, abort before request and during body read, broken body read, config section `error`/httpStatus 200, Lane B page without value → not `ok`, `$batch` without responses/missing user → `unknown`) | S2 commit (see S2 notes). Next: R1 review |
| C04 | REPRODUCED → FIXED (narrower rule; see S2 notes) | R1 VERIFIED (narrow rule; certificate/registration-report consequence awaits owner acceptance) | S0 probe after (`logs/s2/probe-after.txt`): replacement key, date unknown → `needsProof`, proof [] (was `ready` with 2024 proof); created 2026 → `needsProof`; created 2023 → `ready` retained. `src/scoring/proofChronology.test.ts` 7 tests: undated replacement (with/without id), same id seen before proof (stands) / first seen after proof (does not), known earlier/later/unparseable date, this scan's proof for undated credential, registration-report inventory, history retains old proof and credential after an undated replacement, both date spellings through `collectMethodsForUsers` | S2 commit (see S2 notes). Next: R1 review |
| C05 | REPRODUCED at runtime (S3 package/state/channel matrix); FIXED: blank tabs (12 renders) and the shared JSON/script causes under C06; passkey setup BLOCKED (critical, all tabs unavailable) — see S3 notes and BLOCKED S3 | R1 FAILED — matrix reproduced (490 / 0 mistyped / 0 empty / 143 uncalled); passkey setup still held (critical BLOCKED) | S3: `node docs/preview-corrections/probes/s3-matrix.ts curated all` renders every package step through `stepBodyOf` (what the Implementation region draws) for every fixture except huge, on its own and the curated baseline, plus curated demo-week2 with prerequisites met and with the exclusions question unanswered: 490 renders; per package/state/channel with causes in the S3 notes (`logs/s3/matrix-summary.txt`). `src/ui/surfaces/emptyArtifact.test.ts`. S0 baseline: `node scripts/compile-implementation-content.mjs --validate-library --json <logs>/library-validation.json` exit 0: 46 packages, 1 passes production validation (s-goal-device-registration-mfa), 45 fail. Largest families: 34 pkgs readiness tile result not machine (126 errors); 26 pkgs troubleshooting stage not runtime (185); 14 name.canonical owner decision; 11 support model prose; 8 script mode withheld; 6 non-policy object correction; 5 Email without audience/trigger. 44 authored against a pin other than 90d9b890; semantic re-pin review 43 current, 1 reviewNeeded (s-goal-admin-portals-protected). This is production-validation failure, not the same metric as the audits' runtime "unavailable" counts; per-step runtime channel matrix not yet produced | d0a5f73, 6e3682f, 889ba71. Next: owner decisions in BLOCKED S3 (passkey setup, staging scripts); R1 |
| C06 | REPRODUCED → FIXED for preview JSON typing (every package) and for the all-users/admins scripts; the other policy packages' scripts remain uncallable templates, BLOCKED on the C02 lifecycle decision | R1 VERIFIED for preview JSON typing and all-users/admins scripts (8 rendered scripts parse, 0 errors); FAILED overall — 143 uncalled templates (BLOCKED) | S3 cause 1 (JSON): project.ts `build` bound a planning preview's unresolved `{{json:x}}` stand-in with `JSON.stringify`, so previews showed `"conditions":"‹policy conditions›"` and `"excludeGroups":"‹exclusions group›"`. Matrix before: 113 mistyped values (46 conditions, 27 grantControls, 22 sessionControls, 18 users.excludeGroups); after: 0, and the 66 preview bodies with a value still to resolve are visibly templates (`"conditions":‹policy conditions›`, not parseable; Copy was already disabled). Complete inputs: a typed request body equal to the bound target, merged bodies still one request (`channelParity.test.ts`). S3 cause 2 (PowerShell): `kind: template` scripts whose mandatory `-TargetPolicyJson` nothing supplies — 161 renders before, 143 after; all-users/admins now `Invoke-IAMAIStep -Mode <mode> -TargetPolicyJson '<resolved target>'` plus `-PolicyId '<id>'` except Create, in missing/partial/reportOnly/readyToEnforce (`logs/s3/ps-render.txt`), withheld alone when the target is incomplete. PowerShell syntax parse NOT VERIFIED (local parser run denied this session). S0 notes: Authored JSON uses typed `{{json:policy.target.*}}` bindings (e.g. intune-enrollment-reauth CONTENT.md:57 `excludeGroups` binding); no literal quoted placeholder strings in CONTENT.md. protocol.ts:199 `maskJsonTemplate` masks to `null` for validation only. Runtime fill is project.ts:120-135 `bindText`: a `{{json:x}}` binding emits `JSON.stringify(value)` (null allowed); a missing required binding refuses the block, never prints the token. So an audited placeholder string in `conditions`/`excludeGroups` must come from the binding VALUE supplied to bindText, not the template. Value source not located in S0; not reproduced | d0a5f73, 6e3682f. Next: C02 owner decision for the staging scripts (BLOCKED S3); R1/R2 PowerShell syntax parse |
| C07 | REPRODUCED in source/render evidence → FIXED for four defects (partial-state opener calls a report-only policy enforced; admin-session AI text claims an exclusions change on a session correction; admins AI text states a fixed "0% threshold … none of your admins" registration fact and calls the TAP strength phishing-resistant only; the plan-length reason says "nothing is enforced yet" when only the plan has no enforcement step left); "Prerequisite · In progress" for an unstarted prerequisite located but not changed (owner wording + snapshots); the rest DEFERRED or BLOCKED — see S4 notes and BLOCKED S4 22:45/22:48 | R1 FAILED (partial) — S4 fixes present; all-users AI correction still says "already enforced" and "33% threshold" (high, F4); Connect intro "without locking anyone out" (F5) | S3 render evidence (`entra.correct-open` on a report-only correction; `ai.correct` on a session correction, BLOCKED S3 22:25) and source: no binding, META field or roadmap threshold stands behind "0% threshold" (`grep -i threshold` over the admins package and src/roadmap). Registry regenerated by the compiler (`registry.generated.json` only). `mfaAuthContentSpecs.test.ts`, `sessionAdminContentSpecs.test.ts` (expectations updated, explained in S4 notes); content/implementation suites 119/119 | c85f773, f3ea04d, 18d227a. Next: owner lifecycle decision (BLOCKED C02) before the STEP.md/staging lines; owner wording for a Ready-lane prerequisite; R1 |
| C08 | NOT REPRODUCED with local synthetic data (dev server and production bundle); login-dependent path not exercised — see S4 notes | R1 NOT VERIFIED (not re-run) | `probes/s4-browser.mjs` (vite dev, `logs/s4/browser2.txt`): demo cold direct `#/plan` 340 ms to the Plan tile (smoke's `main.page .plan-progress-tile`), reload 24 ms, dev-mock tenant cold 332 ms / reload 22 ms, demo → mock 233 ms, frozen 5 s during load then resumed 2 ms, demo → non-demo lands on Connect; `probes/s4-preview.mjs` (vite preview of `npm run build`, `logs/s4/preview.txt`): demo cold 233 ms, reload 1 ms, frozen/resumed 2 ms, demo → non-demo `#/connect`; 0 page exceptions; Microsoft/Graph/GitHub requests blocked in the browser | No code change. Next: R2 or owner run with a real session, which this pass may not use |
| C09 | FIXED (notice) | R1 VERIFIED (limited: copy, placement, mailto, tests, 1 of 12 S4 screenshots; browser not re-run) | Exact copy in `pages.connect.notice`, drawn by Connect.tsx `BetaNotice` through the existing `Callout` (warning tone) before the signed-in/signed-out branch; mailto `feedback@getiamai.com`; no control, dialog or stored state. `betaNotice.test.ts` 3/3; focused Connect/content/CSS suites 114/114 (orphan-key test included: the notice renders on the wording review page). Browser (`logs/s4/browser2/*.png`, 12 runs): signed out, dev-mock signed in, demo × light/dark (`data-theme` applied) × 1280/375 px — present once, above the first flow control, correct href, no horizontal overflow. Data-handling wording on Connect reviewed ("It is read-only and runs in this browser", "It writes nothing"): consistent with read-only scopes (publicTrust.test.ts); not changed | c755c62. Next: R1/R2 |

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

## S2 — collection and readiness truth (2026-09-13 21:50 MDT – see closing check times)

Start: HEAD 9f1e8a9, tree clean, no stash, no preserved unfinished diff. Logs: ../logs/s2/. Mocked fetch and synthetic inputs only; no Graph, no tenant.

### Expected behaviour (written before the fix)
- C03: a 2xx body that is not Graph JSON (not JSON; JSON null/array/string; failed body read) is a failed read. A collection page without a `value` array — first or later page — fails the read; `value: []` stays an empty success. A bare-number `$count` body (including 0) stays a count. A non-2xx keeps its status/error class. A cancellation stays an AbortError. Retries are unchanged (a malformed success is not a new retry trigger). A section whose read is malformed is `error` (or Lane B `partial`/`error`), never `ok` with no rows.
- C04: `createdDateTime` or `creationDateTime` gives a method's creation date. Proof stands for a credential created at or before it. With no readable date the chronology is unknown and retained proof is not carried onto a possibly-replaced credential. Same credential with known provenance, known later date, unknown inventory and retained evidence each behave as their facts allow. The history is not deleted and nothing expires.

### Reproduced (before) — S0 probe, re-run unchanged at S2 start
See the C03/C04 table rows (S0 evidence).

### Fixed (commit e6a73a3)
- http.ts `graphRequest`: `GraphResponseShapeError` (status 200 etc.) for a success body that is not JSON, not an object/number, or whose read threw without the caller's signal aborting (abort rethrown). Empty body still `{}`. `graphPaged`: page without `value` array, or a non-string nextLink, throws — also after earlier pages (onPage has already seen them; the read still fails).
- laneBCore.ts `runLaneB`: a sign-in page without `value` throws into the existing catch → `partial` (enough coverage) or `error`, not `history exhausted`/`ok`.
- onDemand.ts `readGroup`: a `$count` body without a number, or a sampled member page without `value`, throws into the existing catch → members `unknown`, count null (was count 0 → `complete` empty membership).
- collectors.ts `collectMethodsForUsers`: `$batch` without `responses`, or missing a user → those users `unknown` (was: absent). `mapMethod`: `creationDateTime` fallback.
- phishingResistant.ts `personReadiness`: undated/unparseable credential → proof stands only if in this scan's sign-in records, or an earlier scan saw the same credential id with `firstSeen` ≤ proof. Dates compared as parsed instants, not strings.

### Primary documentation read (S2, 2026-09-13)
- graph/api/resources/fido2authenticationmethod (v1.0, updated 2026-06-03): property `createdDateTime` (DateTimeOffset, inherited from authenticationMethod).
- graph/api/authentication-list-methods (v1.0, updated 2026-06-19): example response shows `creationDateTime` on the fido2AuthenticationMethod object and `createdDateTime` on the windowsHelloForBusinessAuthenticationMethod object.
- So both spellings appear in current primary docs; the live payload shape is still not captured. The collector prefers `createdDateTime` and falls back to `creationDateTime`; neither is claimed universally wrong.

### Scope not proven / limitations (honest)
- Propagation was verified at the collector/section boundary (`collectConfigSection` → `error`, `runLaneB` → not `ok`, methods → `unknown`), not by a full worker scan (worker.ts needs a Worker/IndexedDB environment); worker.ts's existing `section()` catch maps any thrown error to `error`, unchanged.
- A malformed later users page still leaves earlier pages' methods in `authMethods` while `users` is `error` — pre-existing for any mid-paging failure (e.g. 5xx past ceiling); not changed.
- `readGroup` change has no unit test: it imports msal.ts (browser MSAL) and cannot run under node without new test infrastructure. NOT VERIFIED by test; typecheck only.
- Not changed: `resolveNames`/`resolveObjects`/`searchGroups` (`value ?? []` → names stay unknown / no suggestions, display-only) and `organization.ts` (display name → null). Single-object config reads with an empty 200 body still yield `{}` as before.
- C04 in-window allowance: an undated credential still accepts proof from this scan's own sign-in window, so a replacement registered inside the window with no date is not detected. Retained (older-than-window) proof is where the audited defect was, and that no longer stands. Consequence to review: a registration-report-only inventory, and any certificate (method rows never list certificates, so never dated), no longer keeps retained proof from earlier scans; this scan's proof still counts. Such a person moves from Ready to Needs proof only when their sole proof is retained. No expiry was added; `mfaHistory` keeps the proof, and it stands again when chronology is known.
- Same-id continuity uses `firstSeen` (the scan that first saw the id), so a credential first seen after its only retained proof is treated as unknown chronology — conservative, may under-count Ready.
- Target-strength eligibility (e.g. which passkey/FIDO2 subtypes a custom strength admits) is beyond the current readiness model; not attempted.

### Test expectation changes
None. Existing tests unchanged; two new test files.

### Checks (S2)
| Check | Command | Exit | Result |
|---|---|---|---|
| Typecheck | `npx tsc --noEmit` (`tsc-1.txt`) | 0 | no errors |
| C04 focused | `node --test --test-isolation=none src/scoring/proofChronology.test.ts src/scoring/phishingResistant.test.ts` (`c04-tests-1.txt`) | 0 | 24 pass · 0 fail |
| C03 focused #1 | responseShape, http, resilience, collectors, laneBCore, scanGaps (`c03-tests-1.txt`) | 1 | 36 pass · 1 fail — test harness defect: stub built `new Response('', {status: 204})`, which throws (null-body status), so the request looked like a timeout. Test step changed to an empty 200 body; product code unchanged |
| C03 focused #2 | same (`c03-tests-2.txt`) | 0 | 37 pass · 0 fail |
| Probe after | `node docs/preview-corrections/probes/s0-repro.ts` (`probe-after.txt`) | 0 | see C03/C04 rows |
| Build | `npm run build` (`build-1.txt`) | 0 | built in 334 ms; pre-existing chunk-size warning; tracked home/ unchanged |

## S3 — content runtime and channel parity (2026-09-13 22:00 MDT – see closing check times)

Start: HEAD e6a73a3. Preserved diff inspected: S2's complete ledger and BLOCKED entry, uncommitted (a finished S2 checkpoint, not a half-applied patch) — committed unchanged as 64915b9. No stash. Logs: ../logs/s3/. Synthetic fixtures and bindings only; no Graph, no tenant, no PowerShell executed.

### Method
- Compile: the registry rebuilt into the logs was byte-identical to the tracked one (`registry-before.*`); withheld parts per package `withheld.txt`. Compile-time withholds are overwhelmingly readiness tiles and troubleshooting scenarios written as prose (≈400), 14 unselectable `name.canonical` modules and 8 script modes withheld by their invocation — not the audited unavailable tabs, which are runtime holds.
- Runtime: `probes/s3-matrix.ts` renders every package step through `stepBodyOf` and type-checks what the JSON and PowerShell tabs carry. `probes/s3-c01-packaged.ts` renders S1's C01 tenant through the package channels the viewer draws (S1 verified the engine's stepJson/stepPowerShell, which a packaged step does not show). `probes/s3-ps-render.ts` writes the two converted packages' scripts per state.

### Expected behaviour (written before the fix)
- Every channel of one correction changes the same fields: a conditions-only correction instructs no grant change in any tab.
- A planning preview (not copyable) never shows a typed-wrong Graph body; complete inputs give a typed request equal to the resolved target.
- A script offered as the step's implementation runs with values the page holds, or is held/previewed with what it lacks.
- A tab with no content is the unavailable tab, never blank. Incomplete inputs keep the existing prerequisite/preview behaviour; nothing is invented.

### Reproduced (before)
1. C02 in the rendered Entra tab (`c01-packaged-noex.txt`, admin policy On, short of the exclusions group and roles): JSON `PATCH {"conditions":…}` only, but Entra line 6 "Grant → Require authentication strength: Modern MFA + TAP"; the all-users correction's line 6 "Grant: Require multifactor authentication" (would replace a stronger grant). Source: each package's `entra.correct-conditions` block. The engine channels S1 checked were already right.
2. C06 JSON: 113 mistyped preview values (C06 row).
3. C06 PowerShell: 161 renders of uncallable script templates. Converting all-users/admins to the existing invocation exposed invocation.ts `scriptParameters` reading `$true` in `[Parameter(Mandatory=$true)]` as a parameter named `true` (and missing the real parameter's Mandatory), so the validator refused the declaration.
4. C05 blank tabs: 12 renders drew AI Info with no text (block-auth-transfer report-only and preview, admins preview, require-managed-device preview): the only line names a value the runtime never binds (`evidence.reportOnly`, `admins.notReady`), drops, and the viewer strips the shared warning (`matrix-all-after2.txt`).
5. C05 passkey setup: `missing → packageFault` in all 20 renders, every tab unavailable (BLOCKED S3).

### Fixed (commits)
- d0a5f73 — all-users/admins `entra.correct-conditions`: grant line removed, shared verify lines renumbered; admins `entra.correct-grant` names the difference: the custom strength also accepts a Temporary Access Pass, Microsoft's built-in Phishing-resistant MFA strength does not. project.ts: a JSON block's unresolved `{{json:x}}` stand-in is a token while the body parses and merges, then put back bare. Registry regenerated.
- 6e3682f — stepPackage.ts `policy.target.json` (name + conditions + grant + session of the resolved whole target, only when all four are bound); all-users/admins `powershell.run` → `deployableAfterBinding` (TargetPolicyJson in every projected mode, PolicyId in all but Create), binding declared optional in META; content.json preview label; invocation.ts skips `$true/$false/$null`; stepBody.ts draws a package artifact with empty text as the unavailable tab. Registry and LIBRARY.json regenerated by the compiler; no other package's withheld parts changed (`registry-before.txt` vs `registry-after3.txt`: counts identical).
- 889ba71 — `emptyArtifact.test.ts`.

### Verified after
- `c01-packaged-noex-after.txt`: all-users Entra 1–5 then 6–7 (save, rescan), no grant; admins Entra 1–5, 6–7, no grant; JSON unchanged; reversed order identical.
- `matrix-all-after3.txt` vs before: every render's state, drawn mode and tab set identical, except the 12 blank AI tabs now unavailable; mistyped JSON values 113 → 0; empty tabs 0; uncalled templates 161 → 143 (all-users/admins 0).

### Package/state/channel matrix after (490 renders; P Entra, S PowerShell, J JSON, A AI Info, E Email; PowerShell/JSON are drawn on policy steps only, stepBody `machine`)
| Package | State → drawn (renders) | Tabs with content | What is missing, and the cause the render shows |
|---|---|---|---|
| s-prereq-passkey-settings | missing → held packageFault (20) | none | BLOCKED S3: required Authenticator/TAP configuration bindings have no source; JSON blocks carry no request; JSON is the only value-bearing channel, so its hold holds all |
| s-goal-mfa-all-users | inPlace (15); missing → executable (2); blocked → preview (3) | P S J A | E: compile-withheld (Email without audience/trigger); preview: values still to resolve |
| s-goal-admins-phishing-resistant | inPlace (7); missing → executable (6); blocked → preview (7) | executable P S J A E; preview P S | preview (report-only policy): no JSON/Email for that state; AI line needs never-bound `admins.notReady`/`evidence.reportOnly` |
| s-goal-admin-session | blocked → preview (18); missing → executable (2) | P S J A E | S: uncallable template (staging modes, BLOCKED S3) |
| s-goal-block-auth-transfer | blocked → preview (18); reportOnly → executable (2) | preview P S J A E; report-only P S | report-only: AI line needs never-bound `evidence.reportOnly`; S template (BLOCKED S3) |
| s-goal-block-device-code / s-goal-block-legacy-auth | inPlace → blocked (13 / 15); partial → executable (1 / 1); blocked → preview (6 / 4) | partial P S J A | S template (BLOCKED S3) |
| s-goal-block-unsupported-platforms / s-goal-geo-restriction | blocked → preview (18 / 20); missing → executable (2 / 0) | P S J A E | S template (BLOCKED S3) |
| s-goal-register-info-protected | missing → executable (17); blocked → preview (3) | S J A E | P degraded: required `policy.target.mode`, which IAMAI never binds (stepPackage.ts: no meaning it can supply); S template |
| s-goal-require-managed-device | missing → executable (3); blocked → preview (5) | S J A E | P degraded: `intune.compliance.prerequisiteState` unbound; S template |
| s-goal-guests-mfa | inPlace → blocked (15); blocked → preview (5) | preview P S A | S: pair template `-TargetPoliciesJson` (not converted) |
| s-goal-device-registration-mfa | missing → executable (15); blocked → preview (5) | P S J A | — (the one package passing strict validation) |
| s-goal-intune-enrollment-reauth | missing → executable (2); blocked → preview (6) | P S J A | preview: no JSON |
| s-goal-all-users-no-persistence (session-lifetime package) | blocked → preview (18); missing → preview (2) | P S A | required `policies.session.unmanaged.target.displayName`, `policy.target.excludeUsers` unresolved |
| s-goal-token-protection | readyToEnforce → executable (2); blocked → preview (18) | P J A E | S: Enforce withheld by its invocation (attestation) |
| s-goal-service-accounts-trusted-network | blocked → preview (8) | P S J A | S template with stand-ins |
| s-goal-sign-in-risk, -medium, s-goal-user-risk, -medium, s-goal-pim-activation-reauth | blocked → preview (2 each) | P S J A | preview only in these fixtures; user-risk-medium S template; PIM JSON keeps quoted stand-ins in string fields (type-correct) |
| s-prereq-allowed-countries | missing → executable (20) | P A | (J not drawn on a non-policy step) `json.create` has no request |
| s-prereq-break-glass | missing → executable (16); inPlace (4) | P A | (J not drawn) needs exactly one `emergency.target.userId` |
| s-prereq-exclusion-group / s-prereq-service-accounts-group | preview (5 / 8); inPlace (15 / 0) | P A | group name, mail nickname, member bindings unresolved (honest prerequisite) |
| s-shared-devices | missing → executable (8) | S A | P degraded: needs exactly one trusted location (`trustedLocationId`), exclusions group; S template |
| s-ladder-operator-passkey, s-prereq-per-user-mfa, s-prereq-security-defaults | missing → engine (12 / 2 / 2) | none | package authors no projection for the runtime state (`noProjection`) and the step has no engine channels: every tab unavailable |
| s-check-dormant-accounts, s-check-separate-admin-accounts, s-verify-mfa | missing → executable (22 / 12 / 21) | P A | — |
| s-prereq-device-plan; s-prereq-trusted-location | needsDecision (8); inPlace (20) | none | no action by state |

### Scope not proven / open (details in BLOCKED S3)
- Ten staging packages' scripts (143 renders with guests, shared devices, service accounts, user-risk-medium) stay uncallable: callable would operationalise the open lifecycle decision.
- Passkey setup held in every fixture; unholding without registered-AAGUID evidence risks locking out existing security keys.
- all-users correction removing a guest exclusion is not reported in `changedFields` (engine), so Entra understates it.
- PowerShell syntax parse not run (denied). Wording found for S4 recorded in BLOCKED S3.
- Session corrections preview in every render: the package's `unmanaged` member has no pinned source, and a legitimately empty `excludeUsers` reads as unresolved (`present`); not changed because loosening empty lists globally would also bind an empty `excludeGroups` (`probes/s3-session.ts`, BLOCKED S3 22:30).
- register-info-protected Entra create needs `policy.target.mode`, IAMAI's own mode with no binding source; not invented (BLOCKED S3 22:30).
- Not attempted in S3: Email/AI template repairs beyond the blank-tab cause (no common cause found other than never-bound optional evidence values such as `evidence.reportOnly`), the guests pair script, and prerequisite-step JSON request metadata (not drawn on non-policy steps).

### Test expectation changes
- `src/ui/surfaces/mfaAuthContentSpecs.test.ts` (all-users :50, admins :131): each pinned the Entra procedure of a conditions correction including its grant line ("Grant: Grant access → Require multifactor authentication.", "Grant → … Require authentication strength: Modern MFA + TAP …") and the verify list starting at 7. That line is the C02 defect fixed in d0a5f73 (the JSON and PowerShell of the same correction change conditions only). The grant item is removed and the verify list starts at 6; every other assertion in both tests is unchanged, and `channelParity.test.ts` asserts the grant module still appears when the grant differs.
- `pilot.test.ts:353` asserts stepBody's `produced` source shape; a first edit put a comment inside that expression and failed it — the code was reshaped to the asserted form, the assertion is unchanged.

### Checks (S3)
| Check | Command | Exit | Result |
|---|---|---|---|
| Registry (start) | `node scripts/compile-implementation-content.mjs --registry ../logs/s3/registry-before.json` | 0 | byte-identical to tracked registry |
| Typecheck | `npx tsc --noEmit` (`tsc-1` … `tsc-4`) | 0 | no errors |
| Focused #1 | channelParity, library, implementationChannels, planUsability, pilot, correctionProjection, runtimeContract, highRiskChannels, bindingInventory (`focused-1.txt`) | 0 | 93 pass · 0 fail |
| Focused #2 | `src/content/implementation/*.test.ts` + implementationChannels, planUsability (`focused-2.txt`) | 1 | 123 pass · 1 fail: library.test.ts:86 admins `missing` lost PowerShell — the invocation was refused (the `$true` parser bug, fixed) |
| Focused #3 | same + planVariants (`focused-3.txt`) | 1 | 142 pass · 1 fail: pilot.test.ts:353 source shape (code reshaped, test unchanged) |
| Focused #4 | same (`focused-4.txt`) | 0 | 143 pass · 0 fail |
| Empty tab | `node --test src/ui/surfaces/emptyArtifact.test.ts` (`empty-artifact-test.txt`) | 0 | 1 pass (premise asserted) |
| Matrix | `node docs/preview-corrections/probes/s3-matrix.ts curated all` (`matrix-all-before/after2/after3.txt`) | 0 | 490 renders each |
| PowerShell render | `node docs/preview-corrections/probes/s3-ps-render.ts ../logs/s3/ps` (`ps-render.txt`) | 0 | 8 scripts + incomplete-target and preview cases |
| PowerShell parse | Windows PowerShell 5.1 `Parser::ParseFile` (syntax only) | — | NOT RUN: permission denied in this session |
| Full suite (HEAD 889ba71, 22:22–22:25) | `npm test` (`full-test.txt`) | 1 | 2591 tests · 2586 pass · 3 fail · 0 cancelled · 2 skipped (Learn-link external health; HUGE=1 — same as S0). Failures: mfaAuthContentSpecs.test.ts :50 and :131 (the pinned grant line, explained above, updated); foundationB.test.ts:73 "nothing but lifecycle.ts assigns a status" — `src/graph/collect/http.ts: now 3 assignments, was 2`, from S2's e6a73a3 (`GraphResponseShapeError` sets `this.status`), not S3 code; not fixed in this S3-only session (BLOCKED S3) |
| Build (889ba71) | `npm run build` (`build.txt`) | 0 | built in 325 ms; pre-existing chunk-size warning; `git status` afterwards showed only the ledger files modified (tracked home/ unchanged) |
| Re-run after expectation update | `node --test --test-isolation=none src/ui/surfaces/mfaAuthContentSpecs.test.ts src/roadmap/foundationB.test.ts src/content/implementation/channelParity.test.ts` (`rerun-failed.txt`) | 1 | 77 tests · 76 pass · 1 fail (foundationB.test.ts:73, the S2 item above). Full suite not re-run after this test-only change |
| Typecheck (final) | `npx tsc --noEmit` (`tsc-5.txt`) | 0 | no errors |

## S4 — entry journey, notice and targeted language (2026-09-13 22:30–22:47 MDT)

Start: HEAD ad1f830, working tree clean, `git stash list` empty — no preserved unfinished diff. Logs: ../logs/s4/. Local dev server / local production preview and a local headless Chromium (Playwright's installed chromium-1243, no new dependency) with Microsoft, Graph and GitHub hosts blocked in the browser; synthetic demo and dev-mock (`?dev=1&mock=1`) tenants only. No sign-in, no Graph, no tenant.

### Expected behaviour (written before the change)
- C09: Connect shows the RUN-CONTEXT notice once, in the existing callout, above the sign-in and scan controls, before sign-in and after it (demo included), readable in both themes and at phone width; the address is a mailto link; nothing to accept and nothing recorded.
- C07: a sentence in a channel is true in every state the block renders for; a fixed statement about the tenant needs a value behind it.
- C08: from a cold load, a reload, demo → non-demo and a page suspended during load, the Plan draws without a hang when its data is local.

### Order and commits
1. c755c62 — C09 notice first: `pages.connect.notice` (new content key: title, body with `{feedback}`), `Words.notice` (connectView.ts), Connect.tsx `BetaNotice` (Callout `warning`, before the state branch), app.css `.surface.connect > .callout { margin-top: 20px }`, render.ts draws it on the wording review page (so the orphan-key test holds without an allowlist entry), `betaNotice.test.ts`.
2. c85f773 — C07: partial-state opener "This policy already exists and is enforced." → "This policy already exists." in all-users, admins, admin-session, block-auth-transfer, block-device-code (the block renders for report-only corrections too); admin-session `ai.correct` no longer says the correction adds the exclusions group on a session correction.
3. f3ea04d — C07/C02: admins `ai.correct` drops "The 0% threshold means none of your admins currently have a qualifying method registered" (no source) for a pointer to MFA Readiness, and names the TAP difference ("also a Temporary Access Pass. Microsoft's built-in Phishing-resistant MFA strength does not accept a Temporary Access Pass."); `probes/s4-browser.mjs`.
4. 18d227a — C07: `critical.verificationOnly` "… and nothing is enforced yet" → "… and no enforcement is left to schedule" (it renders when no enforcement step is placed in the plan, schedule.ts:969-971; the tenant's policies may already be On). Existing key; no test or snapshot pinned it.
Registry regenerated with `node scripts/compile-implementation-content.mjs --registry src/content/implementation/registry.generated.json` after each content change (only the changed sentences differ).

### C08 reproduction attempt (details in RESULTS C08, BLOCKED S4)
Not reproduced on the dev server or the production bundle. First probe run used `main.page .step` and timed out on pages that had drawn (dev-mock page text shows "Steps 23 · Completed 1"); the selector was replaced by smoke's Plan check (`.plan-progress-tile`) and the run repeated — the first run's C08 lines are a probe defect, not evidence. Background → foreground is approximated by `Page.setWebLifecycleState` frozen/active in headless; a real hidden tab's timer throttling was not emulated.

### Test expectation changes (explained)
- `mfaAuthContentSpecs.test.ts` (all-users :74, admins :149, block-auth-transfer :176, block-device-code :210) and `sessionAdminContentSpecs.test.ts:52` pinned the opener "This policy already exists and is enforced." — the C07 defect for a report-only policy; now pinned to "This policy already exists." with the rest of each sentence unchanged.
- `sessionAdminContentSpecs.test.ts:68` pinned the admin-session AI sentence claiming an exclusions change; now pins the corrected sentence (dots escaped).
- `mfaAuthContentSpecs.test.ts:165-166` pinned the admins strength sentence and the "0% threshold" sentence; now pins the corrected sentences and adds `doesNotMatch(/0% threshold|none of your admins/)`. No assertion removed or loosened otherwise.

### Checks (S4)
| Check | Command | Exit | Result |
|---|---|---|---|
| Typecheck | `npx tsc --noEmit` (`tsc-1.txt` after the notice; `tsc-2.txt` final) | 0 | no errors |
| Notice + Connect/content/CSS | `node --test --test-isolation=none` betaNotice, connectAnatomy, publicTrust, content, primitives, design-lint, responsive, accessibility, connectView, feedback (`focused-1.txt`) | 0 | 114 pass · 0 fail |
| Content after C07 #1 | `src/content/implementation/*.test.ts` + mfaAuthContentSpecs, implementationChannels, planUsability, pilot, emptyArtifact (`focused-2.txt`); session + mfa specs (`focused-3.txt`) | 0 / 0 | 133 pass · 0 fail; 10 pass · 0 fail |
| Content after C07 #2 | `src/content/implementation/*.test.ts` + mfaAuthContentSpecs, sessionAdminContentSpecs, implementationChannels, pilot (`focused-4.txt`) | 0 | 119 pass · 0 fail |
| Registry | compiler `--registry` (`registry.txt`, `registry-2.txt`) | 0 | 44 packages |
| Plan-length wording | `node --test --test-isolation=none src/content/content.test.ts src/roadmap/schedule.test.ts src/roadmap/scheduleClamp.test.ts src/roadmap/stepSchedule.test.ts` (`focused-5.txt`) | 0 | 35 pass · 0 fail (orphan-key test included) |
| Browser, dev | `CHROME=… node docs/preview-corrections/probes/s4-browser.mjs ../logs/s4/browser2` (`browser2.txt`, `browser2/*.png`) | 0 | 12 notice runs as RESULTS C09; C08 timings as RESULTS C08; 0 page exceptions; 62 blocked external requests |
| Build | `npm run build` (`build.txt`) | 0 | built in 316 ms; pre-existing chunk-size warning; `git status` clean afterwards (tracked home/ unchanged) |
| Browser, production preview | `CHROME=… node docs/preview-corrections/probes/s4-preview.mjs` (`preview.txt`) | 0 | demo cold 233 ms, reload 1 ms, frozen/resumed 2 ms, demo → non-demo `#/connect`; 0 exceptions |
| Full suite | not run in S4 (RUN-CONTEXT: full checks in S0/R2); the S3 failure foundationB.test.ts:73 (BLOCKED S3 22:27) is untouched and still expected to fail | — | NOT RUN |

### Not done / open (BLOCKED S4)
- C07: 24 STEP.md references (18 tied to the C02 lifecycle decision); "Prerequisite · In progress" for an unstarted prerequisite located at planBoard.ts:280 but not changed (R3 wording decision, ~100 snapshot pins; BLOCKED S4 22:48); Ready-with-prerequisites not reproduced; the "Consolidate Overlapping Policies" crosslink exists in source as a Cleanup row title (render not checked); register-info-protected `blockOutsideTrusted` and admin-session staging lines unchanged (BLOCKED S3).
- C08: login-dependent loading (real MSAL session, sequential `readGroup` reads) not exercisable without credentials.
- C09: data-handling statements beyond Connect's own copy (home page, How, exports) not re-reviewed in S4; publicTrust.test.ts already holds the hosting/beacon wording.


## R1 — fresh adversarial review (2026-09-13 22:48 MDT –; checkpoint 23:00)

Start: HEAD 144b6ce, working tree clean, `git stash list` empty — no preserved unfinished diff. No application code changed. Logs: ../logs/r1/. Synthetic fixtures, mocked fetch and local parsing only; no Graph, no tenant, no browser sign-in. Full review, reproductions and expected outcomes: REVIEW-1.md (F1–F5, per-C-ID verdict table). Review column of the ledger table updated per C-ID.

### Checks (R1)
| Check | Command | Exit | Result |
|---|---|---|---|
| Scope diff | `git diff --stat/--name-status c65d9f4 HEAD` | 0 | 38 files outside docs/preview-corrections; no deletions/renames; no package, lockfile, baseline, CI, scripts, tsconfig/vite or instruction-file changes; no snapshot changes |
| Focused critical suites | policyIdentity, tracking.drift, foundationA, foundationB, responseShape, proofChronology, phishingResistant, channelParity, betaNotice, emptyArtifact, mfaAuthContentSpecs, sessionAdminContentSpecs, planVariants (`focused-1.txt`) | 1 | 214 tests · 213 pass · 1 fail (foundationB.test.ts:73, http.ts status-assignment guard, from S2) · 0 skipped |
| C01 group/role/mixed identity | `SHAPE=groups\|roles\|mixed node docs/preview-corrections/probes/r1-c01-groups.ts` (+`DUMP=1`) (`c01-groups-2.txt`, `c01-groups-dump.txt`) | 0 | roles, mixed: correct in both orders; groups: all-users step updates the admins-group phishing-resistant policy to All users when listed first (F2) |
| A1 drift | `node docs/preview-corrections/probes/r1-a1-drift.ts` (`a1-drift.txt`) | 0 | executable `create-report-only` beside the drifted own policy (F1) |
| Packaged channels | `NOEX=1 node docs/preview-corrections/probes/s3-c01-packaged.ts` (`s3-c01-packaged-noex.txt`) | 0 | no grant in all-users/admins conditions corrections; Intune Enrollment disagreement (F3); AI text (F4) |
| C03/C04 repro | `node docs/preview-corrections/probes/s0-repro.ts` (`s0-repro.txt`) | 0 | as RESULTS C03/C04 "after" |
| Matrix | `node docs/preview-corrections/probes/s3-matrix.ts curated all` (`matrix.txt`) | 0 | 490 renders · 0 mistyped · 0 empty · 143 uncalled templates |
| PowerShell syntax | Windows PowerShell 5.1 `[System.Management.Automation.Language.Parser]::ParseFile` on `logs/s3/ps/*.ps1` (parse only, not executed) (`ps-parse.txt`) | 0 | 8 files · 0 parse errors |
| Full suite / typecheck / build / browser | — | — | NOT RUN in R1 (R2) |

# Final report: continuation cycle 5, fresh review

**Status: CONTINUE.** Not ready for owner review. This does not authorize publication, merge or deployment. No push, deploy, tenant action, script execution or external write was made.

## Identity
| Item | Value |
|---|---|
| Reviewed HEAD | `c3b3f4135e011f99582d9f831fa2f0a77a42612c` (branch preview-continuation) |
| Cycle 5 commits | e0163b0 (cycle 4 ledger and review docs), 8332f82, 311b8a9, c4cb5a6, d6d1e30 (code), f1e121f, 4e4eb8d, 1d30b22, c3b3f41 (docs) |
| Code state | HEAD's code is d6d1e30; `git diff --stat d6d1e30 HEAD` touches RESULTS.md and BLOCKED.md only. Source/test diff `2997bb3..HEAD`: 10 files, +513/−44; package content: guests CONTENT/META, user-risk-medium and service-accounts CONTENT, shared-devices META, registry, LIBRARY.json, one content.json value label |
| Dirty tree at review start | none (`git status --porcelain` empty); stash empty |
| Dirty source/test entries | none |
| Reviewer edits | this report and REVIEW-STATUS.json only; nothing committed |
| Logs | `../logs/review5/`, outside the clone |
| Reviewer copies | `../rv-src-c3b3f41` (plain `git archive` of HEAD, no node_modules; acceptance harness byte-identical by `cmp`). `../rv5-src-e0163b0` (`git archive e0163b02` plus HEAD's seven cycle 5 test files); its `node_modules` is a **directory junction** to the clone's, so remove the junction itself and never follow it |
| Reviewer probes | `../logs/review5/rv5-n1-ro.template.ts` (with `-head`/`-e0163b0` variants), `rv5-ps-render.ts`, `rv5-ps-render-2.ts`, `rv5-guests-partly.ts`, `rv5-guests-json.ts` (with an `-e0163b0` variant). Reruns: `s5-lone-group-admins.ts`, `r2-hold-export.ts`, `s3-matrix.ts`, `../logs/review1/rv-edge.ts` |

## Checks run by the reviewer (exact code state)
| Check | Command / state | Result |
|---|---|---|
| Typecheck | `npx tsc --noEmit` in the clone at HEAD | exit 0, no output (`tsc.txt`) |
| Full suite | `npm test` (`node --test --test-isolation=none "src/**/*.test.ts"`, package.json unchanged since adae27d) in the clean clone at HEAD, 11:16–11:19 | exit 0: **2744 tests · 2742 pass · 0 fail · 0 cancelled · 2 skipped** (Learn-link external health; HUGE=1). Same totals as the fixer's `c5/full-4.txt` (`full.txt`) |
| Non-vacuity | HEAD's seven cycle 5 test files run against `../rv5-src-e0163b0` (pre-cycle-5 source) | exit 1: **20 of 36 fail**, exactly the cycle 5 assertions: the correctionProjection pin, the N1 packageState test, the heldCorrectionExport screen test, riskNetworkInvocation 8/8, guestsPairInvocation 4/4, the guestsPairBinding positive case (its two controls pass), sharedDevicesPeopleJson 4/4 (`nonvacuity.txt`) |
| Build | `npm run build` before the walk | see Walk row (`walk.txt`) |
| Acceptance | `run-acceptance.mjs ../rv-src-c3b3f41` | **28 PASS · 0 FAIL · 0 HARNESS_ERROR** (`acceptance/results.json`, `results.md`) |
| Matrix | `s3-matrix.ts curated all` at HEAD | exit 0, **0 diff lines** against the fixer's `c5/matrix-5.txt`. Counts: uncalled-template 0, packageFault 0, executable 236, preview 125; the session-lifetime unmanaged `missing=` is still on 15 rows (`matrix.txt`, `matrix-vs-fixer.diff`) |
| PowerShell parse | reviewer render (`rv5-ps-render*.ts`) + `Parser::ParseFile`, parse only, nothing executed | **13 files, 0 errors**: user-risk-medium Create/CorrectConditions/CorrectGrant/Verify; service-accounts the same four; guests CreateMissing/CorrectPair/Observe/EnforcePair. Each has exactly one call after the body, and no `{{` survives. Enforce is withheld for both single-policy packages (`ps-render.txt`, `ps-render-2.txt`, `ps-parse.txt`, `ps-parse-2.txt`) |
| C01 original | `s5-lone-group-admins.ts`; `r2-hold-export.ts` SHAPE=lone/tie/all × REV 0/1 | Lone group-admins: `create-report-only`, no update, tracking null, export "Ready · Create", no admins id. Tie: executable update of "Policy B" in both orders. All: `correct` not executable, action line only (`s5-lone.txt`, `hold-export-*.txt`) |
| Removed exclusions | `rv-edge.ts` at HEAD | staffExclOtherApp / staffGuestExcl are executable `correct`, and the portal/export line names the removal. The viewer's AI Info does not name it (`rv-edge.txt`) |
| Walk | `npm run build`, then `TEMP=../cache/tmp node --import ../logs/c1/netblock.mjs scripts/walk.mjs` in the clone. Preload re-read: Node fetch and Chrome resolution reach only localhost | build exit 0 (chunk-size warning only, as before); walk exit 0, 11:20–11:25: **0 P0, 495 P1, 50 P2**, "show-ready on this walk (no P0)"; throttled first load 4.7 s (P1, as before). Report `docs/reports/walk-c3b3f41.md` (gitignored) is identical to the fixer's `walk-d6d1e30.md` below the header after stripping digits, apart from the capture directory name (`walk.txt`, `walk-report-diff.txt`) |
| Scope | `git diff --stat adae27d HEAD` over package.json, lockfile, .github, vite/tsconfig, data, baselines, src/feedback.ts, scripts, page-contracts | Only walk.mjs and page-contracts.json, both from cycle 1 (disclosed then); cycle 5 touches neither. content.json still carries `mailto:feedback@getiamai.com` (:977–978) |
| Test edits | `git diff e0163b0 HEAD -- '*.test.ts'` | No `.skip`/`.only`/todo added. One assert line removed: correctionProjection's `'partial'` pin, replaced by `'blocked'` plus a premise and a planned assertion, with an in-place comment. highRiskChannels.test.ts is a comment change only |

## Queue verdicts (review 4 queue)

### 1. N1, held correction handed over on screen: FIXED
- stepPackage.ts `waitsOnEmergencyAccess` (a step blocker on a `GATING_SUBJECTS` step, or `action.escapeHatch`) now blocks the "correction owed → partial" branch. The U19 add-only branch above it is unchanged, and `plannedPackageStateOf` still plans the correction as `partial`.
- **Reviewer probe** (`rv5-n1-ro-head.txt` vs `rv5-n1-ro-e0163b0.txt`): a correction that removes an exclusion, gated on break-glass or on the exclusions group, for an enforced or a report-only policy:
  - e0163b0: `partial` while `nextSafeAction` was `{correct, executable:false, blockedBy:"blocked"}`. The screen contradicted the action.
  - HEAD: `blocked`, planned `partial`, `nextSafeAction` unchanged.
  - Ungated controls stay `partial` and executable in both.
- Matrix: only the two curated demo rows changed (fixer's `matrix-1.diff`; the reviewer's matrix is identical).
- **Browser:** the fixer's correction of review 4 is right. `src/ui/demoFacts.ts:19` builds the browser demo on `fixture('demo')` (plain), so the walk never drew the curated N1 shape. Review 4's reading of the step-09 capture as an executable hand-over was inaccurate for the browser; the defect was real on the curated fixture and on answered mappings.
- **Observation (low):** the guard also holds a report-only policy's non-U19 correction. That now agrees with `nextSafeAction`, which already held it at e0163b0, so it is not a new hold on the step. But the in-code comment "every correction but U19's can lock someone out" is not true of a report-only policy. The report-only gated case is not pinned by a test.

### 2. Commit hygiene: FIXED
- e0163b0 committed the cycle 4 ledger and review, and RESULTS records the correction.
- The review started on a clean tree, as RESULTS' end-of-cycle note says.

### 3. Uncalled or withheld scripts: FIXED (matrix `uncalled-template` 13 → 0)
- **user-risk-medium, service-accounts-trusted-network (311b8a9):**
  - `deployableAfterBinding` with declared invocations; `[string[]]` parameters replace the JSON text and the `'{{binding}}'` defaults; `withheldModes.Enforce` carries its reason.
  - The reviewer read every mode's body against its bound parameters. user-risk-medium's `AssertCanonical` never reads exclusions, and service-accounts' Verify passes the group and trusted locations its `AssertCanonical` reads.
  - Create passes no policy id, and no call writes state outside Create (report-only).
- **Guests pair (c4cb5a6):**
  - `policies.guests.targets.json` is bound only when every member resolved whole.
  - `CreateMissing` passes no ids, so the script would create both members. The reviewer checked that this cannot duplicate: a set with one member present reads `partial` (stepPackage.ts:250, `partlyDeployed`), which calls CorrectPair. With the new member's id unbound, the script is withheld (`rv5-guests-partly.txt`: `degraded powershell(policies.guests.strong.current.id)`).
  - ApplyPartnerTrust is withheld with its reason. EnforcePair has no attestation switch; it re-reads both policies as canonical and report-only before enabling, as the mfa-all-users precedent does.
- **Observation (not a defect):** with `policy.target.excludeGroups` bound to `[]`, the service-accounts script, Create included, is held as a missing binding (`ps-render.txt`). Plans always carry the exclusions group, and the binding was referenced before cycle 5 too.

### 4. getiamai guests-mfa single resolution: fixer's reading SUPPORTED
- fixtures/index.ts:723–725 builds non-demo fixtures on `syntheticBaseline(seed)`, so a single stand-in resolution binds neither pinned member.
- Matrix rows: getiamai and getiamai+curated `missing · executable · portal:- ps:- json:- ai:+`.
- The reviewer did not re-read the pinned goal map's member ids.

### 5. Removed exclusions in the viewer's Entra/AI Info tabs and script/JSON: REMAINS (not started)
- Evidence: `rv-edge.txt` at HEAD (above).
- Cycle 5 widened where it matters. user-risk-medium and service-accounts `CorrectConditions`, and guests `CorrectPair`, are now called scripts. Each PATCHes whole `conditions`/`users` objects, so a tenant exclusion the target lacks is removed by a drawn, copyable call that does not name it.
- The step's portal/export lines still name removals (ebb9633).

### 6. shared-devices: JSON FIXED; script note and dangling Enforce reference REMAIN
- d6d1e30 removes the requestless `json.people-patches` from both projections (non-vacuity 4/4). `entra.people-exclusions` stays.
- The called PowerShell Create is still silent about the people-policy exclusions, and `readyToEnforce` still names the withheld Enforce run (lint error).

### 7. Board Ready vs blocked (7): REMAINS
Not rerun by the reviewer: no lane code changed since the fixer's d6d1e30 run (`export-lane-2.txt`: 7/7; rv-parity identical to cycle 4).

### 8. Package gaps: REMAIN
- session-lifetime unmanaged displayName and `excludeUsers` (15 matrix rows).
- register-info-protected `policy.target.mode`.
- pim-activation-reauth authContext/strength, and the pim grant+session floor test.

### 9. Low items: REMAIN
Export "before" line under a hold (reassessed by the fixer as prose parity; agreed); unprojected lifecycle/ReportOnly/Location leftovers (the three packages changed this cycle still carry a `ReportOnly` mode); same-name create; passkey profiles; worker Lane B/P1 and scoring of a missing methods entry; real-login latency not claimed.

## New findings
- **R5-1 (low-medium, pre-existing): the guests pair JSON is never drawn.**
  - `json.target-pair` (missing, partial) and `json.enforce-pair` (readyToEnforce) are `template` JSON blocks with no request.
  - With every pair value bound, the JSON channel is `invalid` ("a JSON body with no request") in those three states, at HEAD and identically at e0163b0 (`rv5-guests-json.txt`, `rv5-guests-json-e0163b0.txt`).
  - Entra, PowerShell and AI Info are still drawn. stepBody.ts:317–328 shows `packageFault` only when the whole projection is held, so the JSON tab is simply absent.
  - `json.enforce-pair`'s body `{"state":"enabled","applyTo":"both canonical guest policy IDs…"}` is not a Graph request body.
  - No fixture reaches this state (queue 4), so the matrix cannot show it. Same class as shared-devices' `json.people-patches`.
- **R5-2 (low): N1 comment and missing pin for report-only** (queue 1 observation).

## Missing tests
- N1 guard for a report-only policy under an emergency-access wait (behaviour verified by probe, unpinned).
- Guests pair with one member present: script withheld on the new member's id (probe only).
- Guests pair rendered end to end from a fixture that resolves both pinned members (fixer disclosed; unit and keyed-step tests only).
- Removed-exclusion disclosure in the called scripts and viewer tabs (queue 5, not started).

## Scope and feature preservation
- **Tabs and channels:** matrix identical to the fixer's. Cycle 5 moved 17 rows against cycle 4 (2 N1, 10 invocation, 5 guests) and 8 shared-devices degraded lists, all classified in RESULTS. No drawn channel was removed except where a value is unbound: getiamai guests PowerShell, as Entra and JSON already were.
- **Enabled-policy state:** no new correction call writes state. user-risk-medium and service-accounts Correct* PATCH conditions, grant or session only; guests CorrectPair writes name, conditions, grant and session, never state; Create writes report-only.
- **Safety:** under an emergency-access wait, only U19 add-only corrections stay executable.
- **Notice and baseline:** the Connect beta notice and `feedback@getiamai.com` link are unchanged; the Jon Hope baseline is untouched.
- **Tests:** narrow, disclosed pin change; no suppression.

## Genuine owner choices
None. Every remaining item is routine under RUN-CONTEXT: missing disclosure, missing binding, requestless JSON blocks, a stale comment, missing tests.

## Queue for the next fixer (in order)
1. **Removed exclusions in executable channels (medium, now wider).**
   - Bind `PolicyOperation.removes` (e.g. `policy.current.removedExclusions`, names) into each correction module's Entra save block and AI Info.
   - Say it beside the called CorrectConditions/CorrectPair scripts (user-risk-medium, service-accounts, guests pair, and every other `policy.target.json` correction).
   - Pin it with rv-edge's staffGuestExcl and staffExclOtherApp shapes.
2. **shared-devices (medium/low).** A Create-path Entra/AI line saying the people-policy exclusions are the separate Entra step; drop the withheld Enforce run from `readyToEnforce` or record the lint error's reason.
3. **Guests pair JSON (R5-1).** Take the requestless `json.target-pair`/`json.enforce-pair` out of the projections (as d6d1e30 did), or give per-member requests. Pin it with a both-members-bound projection.
4. **Board Ready vs blocked, 7 (medium).** For the 4 report-only watches, decide whether the action line names what the watch waits on.
5. **Package gaps.** session-lifetime unmanaged displayName/`excludeUsers`; register-info-protected `policy.target.mode`; pim-activation-reauth authContext/strength; the pim grant+session floor test.
6. **N1 follow-ups (low).**
   - Correct the stepPackage.ts comment for report-only policies, and pin the report-only gated case.
   - Check whether `nextSafeAction` should release a report-only policy's correction under an emergency wait (§18.3 "exclusions gate enforced CA, never report-only"). If so, change screen and action together.
   - Pin the partly-deployed guests pair's withheld script.
7. **Low.** Unprojected lifecycle/ReportOnly/Location leftovers; same-name create; passkey profiles; worker Lane B/P1 and scoring of a missing methods entry.
8. **Verification after changes.** Full suite, typecheck, build, matrix, PowerShell parse of changed scripts, acceptance 28/28, and a walk that completes and writes its report at the committed state.

## Walk
- Reviewer walk at HEAD (code = d6d1e30): **0 P0, 495 P1, 50 P2**, the same findings as the fixer's c4cb5a6 and d6d1e30 walks and review 4's 2997bb3 walk.
- The walk draws the plain demo (`demoFacts.ts:19`), so it does not exercise N1, the guests pair or the new invocations. For those, the evidence is the matrix, the probes and the tests above.

## Working tree after review
- ` M docs/preview-continuation/FINAL-REPORT.md` and ` M docs/preview-continuation/REVIEW-STATUS.json` (this review, uncommitted as REVIEW.md requires). HEAD is still `c3b3f413…`; stash empty.
- Gitignored outputs written: `dist/`, `docs/reports/walk-c3b3f41.md`, `walk/c3b3f41/`.
- Outside the clone: `../logs/review5/`, `../rv-src-c3b3f41/`, `../rv5-src-e0163b0/` (node_modules junction; see Identity).

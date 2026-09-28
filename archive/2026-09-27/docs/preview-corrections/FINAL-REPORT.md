# Final report — IAMAI corrective pass (R2)

**Verdict: NOT READY.** It does not authorize a merge, publication or deployment. **NO PUSH · NO DEPLOY · NO TENANT CHANGE**: nothing was pushed, deployed, consented, exported from a real tenant or sent anywhere. The owner reviews this before any merge or publication.

## Identity
| Item | Value |
|---|---|
| Audited source | c65d9f426d3b744ad911ebee01ba99ca8276a688 |
| Candidate code reviewed | e567436ae2c275e1a4f28611e53cbf495d66ab4a (the last application-code commit is 03e6340; later commits are docs and probes) |
| Candidate branch / final SHA | preview-corrections; the commit carrying this report (see `git log -1`), on top of faa1d80 (R2 checkpoint) |
| Baseline pin | baselines/jhope188-conditionalaccesspolicies.pinned.json @ 90d9b890, unchanged |
| Working tree | clean at R2 start and after the build; `git stash list` empty; no preserved unfinished diff; no remote |
| Evidence | ledger RESULTS.md (R2 section), BLOCKED.md, REVIEW-1.md; logs in ../logs/r2/ (outside the clone) |

## Why NOT READY
Any one of these is enough under SEGMENTS R2:
1. **Critical unsafe instruction, C01.** Take a tenant whose only all-users MFA candidate is a group-assigned admins policy that requires Microsoft's built-in phishing-resistant strength. The all-users step becomes an executable `correct` that PATCHes that policy to `includeUsers:["All"], includeGroups:[]`. That applies phishing-resistant MFA to everyone and erases the admins scope. R2 reproduced it in both scan orders in every channel that carries a target: Entra "Users → Include: All users", JSON, PowerShell with that policy's id, and an export that reads "Ready · Correct". (`s5-lone-group-admins.ts`; `SHAPE=lone REV=0|1 r2-hold-export.ts`; BLOCKED S5 23:30.)
2. **Critical BLOCKED owner decisions, still open.**
   - **C02 lifecycle:** how an existing On policy is corrected. The rendered admin-session Entra text says "If it is On, move it to Report-only first" and then "Save. Do not change the policy state (leave it On)".
   - **C05 passkey setup:** every tab unavailable in all 20 renders.
   - **C06:** 143 renders of uncallable staging script templates.
3. **Required check failing: the walk exits 1 with 23 P0s.** CI runs the walk before deploy, and a P0 fails that job. One P0 is the guests pair script's `$changed=@()`, flagged as an empty value. Its package is unchanged since c65d9f4, but no walk baseline exists to show whether the walk flagged it before this pass. The other 22 come from the notice. The owner-mandated Connect notice carries `feedback@getiamai.com`. Two existing rules forbid that address on Connect: walk.mjs:784 ("appears on the error page and How's Limits only") and the `forbid` lists of docs/qa/page-contracts.json for `connect.signedOut` and `connect.signedIn`. Neither file has changed since c65d9f4. Every Connect fixture raises two P0s. The owner decision (RUN-CONTEXT: mailto on Connect) and the test contract disagree. Only the owner can settle it: editing test infrastructure is outside this pass.
4. **Unverified key fixes.** The login-dependent loading path (C08), `readGroup` shape checks and worker end-to-end propagation (C03) are NOT VERIFIED.

## Checks run in R2 (synthetic only)
| Check | Command | Exit | Result |
|---|---|---|---|
| Typecheck | `npx tsc --noEmit` | 0 | no errors |
| Unit tests | `npm test` (194 s) | 0 | 2596 tests · 2594 pass · 0 fail · 0 cancelled · 2 skipped (Learn-link external health; HUGE=1 fixture — the same two as S0) |
| Production build | `npm run build` | 0 | pre-existing chunk-size warning; tracked home/ unchanged |
| Walk | `node --import ../logs/r2/netblock.mjs scripts/walk.mjs`, Playwright chromium-1243 (23:33:56–23:37:53; report docs/reports/walk-e567436.md and captures walk/e567436/, both gitignored) | **1** | **not show-ready: 23 P0**, 506 P1, 50 P2; 41 Learn links not checkable offline (P2). P0s: 22 are the notice's feedback address on Connect (2 per Connect fixture, 11 fixtures, signed in and signed out). 1 is mock-operator step "Require MFA for Guests": "an empty value in the rendered text ("()")". That value is `$changed=@()`, a PowerShell empty-array literal in the guests pair script. The authored package and its registry text are unchanged since c65d9f4. Whether the walk flagged it at c65d9f4 was not established: no walk baseline exists, because S0 did not run the walk. P1 1 is the throttled first load (4.6 s); the other P1s are mostly contract allow-list mismatches for labels, tabs and buttons. With no baseline, the P1 count cannot be compared |
| Browser journeys | `probes/s4-browser.mjs` (vite dev), `probes/s4-preview.mjs` (vite preview of the build); Microsoft/Graph/GitHub blocked | 0 / 0 | C09: 12 runs, see C09. C08: demo cold direct `#/plan` 339 ms, reload 12 ms, mock cold 340 ms, demo→mock 227 ms, frozen 5 s then resumed 3 ms, demo→non-demo lands on Connect; preview cold 251 ms, reload 0 ms, resumed 3 ms; 0 page exceptions |
| Matrix | `probes/s3-matrix.ts curated all` | 0 | 490 renders · 0 mistyped JSON values · 0 empty tabs · 143 uncalled script templates · 20 passkey `packageFault` · 66 non-copyable preview bodies with visible stand-ins; identical to R1 and S5 apart from the timing trailer |
| PowerShell syntax | Windows PowerShell 5.1.26100 `Parser::ParseFile` on the 8 rendered all-users/admins scripts (parse only, not executed) | 0 | 0 parse errors |
| Identity, channels, C03/C04 | r1-c01-groups(-ready), s5-f2-hold, s5-lone-group-admins, r1-a1-drift, s3-c01-packaged NOEX=1, s0-repro, r2-hold-export | 0 | per C-ID below |

The walk ran with a local preload (outside the clone) that blocks every non-localhost host for Chrome and for Node's fetch. So its Learn-link probes are reported as "could not be checked" P2s rather than network results, and the MSAL authority warm-up fails fast. No test infrastructure was edited.

## Feature preservation
- The `c65d9f4..HEAD` diff touches 44 files outside docs/preview-corrections: no deletions or renames, and no change to package.json, lockfile, baselines, .github, scripts, vite/tsconfig, CLAUDE.md or docs/qa (so no snapshot rewrites).
- The matrix draws the same tab sets as R1 and S5. The only tab-level change since audit is that 12 formerly blank AI tabs now draw as the unavailable tab (S3). No tab, channel, export or validator was removed. The notice adds no dialog, checkbox, input or navigation item.
- Test changes: no `.skip/.todo/.only` added. Removed assertions appear only where a pinned defective sentence was replaced (mfaAuthContentSpecs, sessionAdminContentSpecs) and in **tracking.drift.test.ts A1**, whose replacement hold assertions never run for the drift scenario (R1-F1, still open). foundationB's allowance 2→3 is explained (S5).
- **Result: no feature removal found. One weakened assertion remains (A1).**

## Per-finding verdicts (R2)
| ID | Verdict | Evidence (R2-run) | Remaining |
|---|---|---|---|
| C01 | **FAILED** | Role-assigned and roles+group shapes: all-users → internal, admins → admin, session → session in both orders. R1-F2 tie of two group-assigned policies: step held (`observe`, not executable, no operations, untracked) in both orders; contract and export carry the "does not guess" copy. **Lone group-admins policy: executable rewrite to All users (critical)** | Critical lone case; R1-F1 duplicate executable create beside a drifted all-users policy (high); held-step viewer disagreement (R2-N1, high); ties among candidates that reach the whole population still take the first listed (S1 gap 2) |
| C02 | **FAILED** | All-users/admins conditions corrections carry no grant in Entra, JSON or PowerShell; the admins TAP difference is named (VERIFIED sub-claim) | Lifecycle BLOCKED (critical); R1-F3: Entra and AI say Intune Enrollment is excluded, but JSON, PowerShell and the export do not carry it (high) |
| C03 | **VERIFIED** for graphRequest/graphPaged/Lane B/`$batch` shapes; foundationB:73 green in the full suite | `s0-repro.ts`: `value:[]` → `[]`; not-json, `{}`, unexpected object, non-array value, malformed later page → `GraphResponseShapeError` | `readGroup` (no test) and worker end-to-end NOT VERIFIED |
| C04 | **VERIFIED** (narrow rule) | `s0-repro.ts`: undated replacement → needsProof; created 2026 → needsProof; same key created 2023 → ready with retained proof; proofChronology tests in the full suite | Owner acceptance: certificate or registration-report-only inventories no longer keep retained proof; an undated in-window replacement goes undetected |
| C05 | **FAILED** | Matrix as above; blank AI tabs → unavailable tab | Passkey setup held in every render (critical BLOCKED); session-lifetime always preview; register-info-protected Entra degraded; 3 packages render every tab unavailable for their state |
| C06 | **VERIFIED** for preview JSON typing and the all-users/admins scripts (8 parse, values bound); **FAILED** overall | Matrix 0 mistyped; PowerShell parse 0 errors | 143 uncalled templates in ten staging packages plus guests pair, shared devices, service accounts, user-risk-medium (critical BLOCKED on C02) |
| C07 | **FAILED** (partial) | S4 fixes and R1-F4 present in the packaged render ("The policy already exists on your tenant"; no "33% threshold") | R1-F5 "without locking anyone out" on Connect, directly above the notice (medium, pinned by a test and the walk); "Prerequisite · In progress" for unstarted work; 24 STEP.md references in technician text |
| C08 | **NOT REPRODUCED** (synthetic) | Browser journeys above; the walk's throttled Fast-3G production first load took 4580 ms (walk P1 threshold 2 s; not measured at c65d9f4, so not known to be a regression) | Login-dependent sequential `readGroup` path NOT VERIFIED (needs a real session) |
| C09 | **VERIFIED** (behaviour) · **required walk check FAILS** | 12 runs (signed out, dev-mock signed in, demo × light/dark × 1280/375): present once, above the first control, exact copy, `mailto:feedback@getiamai.com`, 0 dialogs, 0 inputs, no horizontal overflow; screenshots inspected (signed-out light 375, signed-in dark 1280) | Walk P0 contract conflict (Why NOT READY, item 3) |

## New in R2
- **R2-N1 (high, C01/C05 channel disagreement on a held step).** In the R1-F2 tie shape (`SHAPE=tie r2-hold-export.ts`, `FULL=1`), the Plan contract and the export say IAMAI holds and does not guess. The Implementation region, however, draws a create procedure as a non-copyable preview: "Open … New policy", "Name: ‹policy name›", "Grant: Require multifactor authentication", "Set Enable policy: Report-only and create it", with a JSON create template. Its note says "This is the work once the prerequisites are resolved … Values still to resolve: policy name, complete target policy, policy ID and policy conditions". That blames prerequisites and offers a duplicate-policy procedure the hold rules out. Nothing is copyable or executable. Expected: the Implementation region states the ambiguity hold, or nothing that contradicts it.
- **R2-N2 (part of the lone critical case).** The export for the lone shape opens with "Create the policy in report-only." and then gives update lines for the existing "Policy A".
- **R2-N3 (required check).** The walk P0 contract conflict on the notice's feedback address (above).

## Remaining defects, ranked
1. Critical: C01 lone group-assigned admins policy rewritten to All users (executable, every channel, export).
2. Critical, owner decision: C02 lifecycle for On policies; C06 staging-package scripts (143 renders); C05 passkey setup (all tabs unavailable).
3. Required check: the walk exits 1 with 23 P0s. 22 are the notice's feedback address, forbidden by walk.mjs:784 and the page-contracts.json `connect.signedOut`/`connect.signedIn` forbid lists (owner decision needed). 1 is the guests script's `$changed=@()` read as an empty value (origin not established).
4. High: R1-F1 executable duplicate `create-report-only` beside a drifted untracked all-users policy, with the A1 test assertion vacuous; R1-F3 Intune Enrollment exclusion disagreement (viewer Entra/AI vs JSON/PowerShell/export); R2-N1 held-step preview contradicting the hold.
5. Medium: R1-F5 "without locking anyone out"; register-info-protected `policy.target.mode`; session-lifetime unmanaged member; all-users correction that drops a guest exclusion without reporting it in `changedFields`.
6. Lower or owner acceptance: "Prerequisite · In progress" label; STEP.md references; C04 retained-proof consequence; throttled first load 4.6 s (walk P1); admins-group policy not recognised by the admins goal, which proposes a create beside it (pre-existing classification).

## Missing evidence
- A real MSAL session for C08 (not permitted).
- A live method payload to settle `createdDateTime` vs `creationDateTime`.
- Graph PATCH semantics for complex `conditions.users` (guest and Intune exclusions) from a primary source.
- `readGroup` without MSAL.
- Worker end-to-end scan.
- Rendered Step Contract text on a fixture for every hold kind.
- Export parity for packages beyond all-users (only the all-users step was compared).

## Changed files (c65d9f4..HEAD, outside docs/preview-corrections)
- **Engine:** src/coverage/coverage.ts, src/coverage/types.ts, src/roadmap/generate.ts, src/roadmap/tracking.ts, src/roadmap/types.ts, src/roadmap/stateReason.ts, src/copy/reasons.ts.
- **Collection and readiness:** src/graph/collect/http.ts, collectors.ts, laneBCore.ts, onDemand.ts; src/scoring/phishingResistant.ts.
- **Content runtime:** src/content/implementation/invocation.ts, project.ts, registry.generated.json; src/content/render.ts; src/ui/surfaces/stepBody.ts, stepPackage.ts, stepContract.ts, stepExport.ts.
- **Connect:** src/ui/surfaces/Connect.tsx, src/ui/scan/connectView.ts, src/ui/app.css.
- **Words:** docs/design/content.json.
- **Authored packages:** docs/implementation-content/LIBRARY.json; CONTENT.md for admin-session, admins-phishing-resistant, block-auth-transfer, block-device-code, mfa-all-users; META.json for admins-phishing-resistant, mfa-all-users.
- **Tests (new):** channelParity, responseShape, policyIdentity, proofChronology, betaNotice, emptyArtifact.
- **Tests (changed):** content, foundationA, foundationB, tracking.drift, mfaAuthContentSpecs, planVariants, sessionAdminContentSpecs.

## Preserved unfinished work
None. Every session's work is committed on preview-corrections; no stash, no dirty tree. R2 changed no application code. Its commits add only RESULTS.md, this report and `probes/r2-hold-export.ts`.

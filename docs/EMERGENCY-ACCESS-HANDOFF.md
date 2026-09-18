# IAMAI: Fable / Opus execution handoff

Updated 2026-09-18. Read this first. This handoff describes the current repository and the decisions that should survive the next work. Earlier execution reports occasionally claimed more coverage than was actually demonstrated; prefer source, focused tests and this document over those claims.

## Release and checkout

- Repository: https://github.com/ZephyrPretendstoKnowTech/iamai
- Local working copy: `C:/Users/Owner/Documents/Codex/2026-09-13/files-pasted-by-the-user-iamai/work/continuation-20260914-061243/tenant100-candidate`
- Reviewed base: `ecc180307823f33db8e4d6f41d542fd0aadc4319`.
- This document ships with the automatic emergency verification release. Use `git log -1` and `git status --short` to identify the checkout you actually have.
- The local feature branch is `feat/emergency-access-journey`; production is remote `main`.
- Untracked `work/` logs and `graphify-out/` are local review artifacts, not release inputs. Do not blindly add them.
- Production: https://getiamai.com/planner/
- Registered local authentication callback: `http://localhost:5173/planner/`. A preview on another port can run demo mode but must not assume its callback is registered.
- App is read-only against Entra. Never change tenant policies or credentials to make a test pass without explicit owner authorization.

## Product and source map

IAMAI is a browser-only Microsoft Entra rollout planner. React/Vite renders a plan derived from a collected tenant snapshot, saved selections/decisions, the pinned baseline and evidence. Microsoft authentication uses MSAL; local persistence uses IndexedDB. Do not store access tokens or raw credential material in exports.

| Concern | Start here |
| --- | --- |
| Graph collection and snapshot fields | `src/graph/collect/{worker,laneB,laneBCore,types,onDemand}.ts` |
| GA and identity evidence | `src/validation/rules.ts`, collector role reads |
| Step 1's five preparation checks | `src/roadmap/emergencyAccountPreparation.ts` |
| Passkey current/target policy | `src/roadmap/passkeySettings.ts` |
| Applicable profiles and credential compatibility | `src/roadmap/passkeyCompatibility.ts` |
| Shared findings for the four steps | `src/roadmap/emergencyJourney.ts` |
| Automatic baseline, invalidation, retained proof | `src/roadmap/cleanupDone.ts` |
| Completion, scheduling and downstream gates | `src/roadmap/{cleanupPhase,generate}.ts` |
| On-demand reads, reconciliation, persistence | `src/ui/surfaces/planData.ts` |
| Step layout and readiness | `src/ui/surfaces/{Plan,ContentStep,CleanupStep,emergencyReadiness}.tsx/ts` |
| Entra SOP/task projections | `src/ui/surfaces/emergency{Account,Group,Passkey,Verification}Tasks.ts` |
| Whole-step exports | `src/ui/surfaces/cleanupExport.ts` and export builders |
| Authored step copy | `docs/design/content.json` |
| Read-only advanced route diagnostic | `src/ui/emergencyDiagnosticDev.ts`, `work/emergency-access-diagnostic-core.ts` |
| Deployment | `.github/workflows/deploy-pages.yml` |

Trace data through collection → normalization → evaluator → readiness/task projection → completion/export. Do not fix an evidence bug by making a UI warning disappear.

## Major earlier changes

These commits provide useful bounded historical context; there is no need to reread the entire conversation or every historical plan.

- `8f440021`, `4185693a`: reviewed V1 guidance/evidence workflows.
- `78684666`, `b61e740b`: reuse scan-local work/name resolution and measured large-tenant timing.
- `96645f16`, `74353fb9`, `edaf106f`, `12d366eb`: customer/admin walkthrough, presentation and deployment-audit corrections.
- `c1cacf21`, `d4821b75`, `cff043a2`, `5028374a`: connected four-step emergency journey, persistent SOP tasks, account tiles, exact evidence checks and compact advanced options.
- `bb385cd0`, `a0284f8a`: main deploys independently of the full CI suite.
- `e54f1590`: live-tenant GA permanence and unrestricted passkey-profile comparison fixes.
- `ecc18030`: reopening a saved plan restores its default baseline.

The current release replaces the manual Step 4 workflow with automatic post-configuration verification and fixes its evidence lifecycle. No other product area is intentionally redesigned.

## Approved interaction and writing rules

- Headings: **About this Step**, **Tasks Remaining**, optional **Methodology**, **Implementation Tasks**, **Completion Criteria**.
- Methodology is exceptional. Do not introduce another Methodology section without owner approval.
- Readiness should expose the next action, with minimal relevant facts. Satisfied findings are collapsed under the satisfied caret.
- Each account may be at a different stage. Show its highest-priority remaining action and completed checks; do not dump every account property.
- Keep a check in the step that owns the change. Group membership belongs in Step 2, not as a forward-step blocker in Step 1.
- A simple sentence can direct users to the existing selector, implementation task or scan button. Do not add redundant redirects/popups/buttons.
- Entra instructions are concise click-by-click SOPs. Rationale belongs in About/Methodology/reference content.
- All useful implementation tasks remain available, including when their checks pass.
- Entra alone has the task/method selector. PowerShell, JSON and AI Info stay whole-step artifacts.
- No Copy all tasks menu. Copy the current task.
- Additional AAGUIDs is a small, collapsed power-user control near the bottom.
- Do not add warnings, attestations, confirmation controls or new readiness tiles merely for consistency. New tile designs need the owner's review.
- Recommendations beyond the minimum should remain suggestions unless the owner explicitly approves a requirement.
- Unknown is not false or true. A collection gap is IAMAI's responsibility to diagnose.

## Establish Emergency Access: current ownership

### Step 1 — Prepare Emergency Access Accounts

Route: `s-prereq-break-glass`.

Two account tiles, with account selection in the sidebar. The five preparation checks are:
1. Cloud-only identity.
2. Tenant initial `.onmicrosoft.com` sign-in address.
3. Enabled.
4. Permanent active Global Administrator.
5. Approved passkey compatible with current and intended configuration.

There is no separate recent-sign-in completion check here; final post-change proof belongs in Step 4. SOPs cover account creation, configuring an existing account and passkey setup. Suggested account names belong only in account creation. Storage is a concise SOP instruction, not an attestation gate.

### Step 2 — Configure Emergency Exclusions

Route: `s-prereq-exclusion-group`.

A saved group must be an assigned security group, not dynamic/mail-enabled/licensed. Direct membership must match the selected emergency accounts; missing and unexpected accounts are named. Policies requiring the exclusions group are listed with mode and identity. Group suggestions appear when the selector is engaged; a detected group is not saved intent.

Four persistent tasks: create a group, choose existing, manage members and configure CA exclusions. Avoid repeating the emergency account list in the sidebar.

Advanced owner/PIM/entitlement and other self-service coverage is not proven universally. Business Premium/P1 is a supported baseline; missing P2 licensing does not prove that a leftover workflow is absent.

### Step 3 — Configure Passkey Authentication

Route: `s-prereq-passkey-settings`.

Four persistent tasks: review settings, configure registration, prepare affected keys, configure protections. Current-to-intended facts use the same target builder as artifacts. Model names retain exact AAGUIDs. Array and comma-separated storage values display readable labels. Registration-time attestation and runtime compatibility are separate concepts; do not invent a storage dropdown change when only AAGUID restrictions remain.

### Step 4 — Verify Emergency Access

Route: `cleanup-drill`.

- No Start verification, event picker, manual pass/fail/date or Save verification controls.
- After complete correct account/group/policy/passkey evidence, record a per-account baseline.
- The baseline time is captured when the on-demand group acquisition completes, after the worker snapshot—not during React rendering.
- A later scan can pass an account only from a successful interactive Entra admin-center/Graph event with fresh successful passkey authentication after the baseline, correct resource tenant and complete compliant candidate inventory.
- Completed accounts move to Satisfied; remaining accounts stay actionable.
- Proof expires 90 days after the event.
- Unread evidence suspends current success while retaining history.
- Confirmed account changes invalidate that account. Confirmed shared recovery changes affect both.
- Schema-1 manual records are history only. Schema-2 records retain bounded proof/generation/evidence identity.
- Persistent SOPs: **Verify emergency sign-in** and **Troubleshoot emergency sign-in**. Emergency recovery procedure remains available.

**Exact-key limit:** Entra logs do not reliably expose the physical credential ID. The implemented assurance is: a fresh FIDO2/passkey event occurred and every potentially usable registered passkey is known and compliant. Do not claim IAMAI identified which physical key was touched, its custody, or that the user opened a specific policy blade.

## Evidence lifecycle corrections in this release

- Final Step 3 policy correctness is required; merely possessing a compatible key cannot establish a baseline.
- One account becoming disabled/unread no longer destroys the other account's generation.
- Failed current sign-in evidence cannot use a cached event as current green.
- Display/model names and unrelated group-targeted policy changes are removed from configuration identity.
- Directory audits are paged over a requested 90-day lookback using existing AuditLog.Read.All; relevant observed mutations reset proof.
- Audit source health is separate from sign-in source health. Audit failure suspends recovery only and does not poison MFA Readiness or unrelated sign-in analysis.
- Old snapshots without audit source evidence need a fresh scan.
- Required on-demand group reads must complete before the initial baseline; events during that acquisition are rejected.
- Step 3 review no longer references nonexistent intended-value facts.

## What remains / next bounded execution plan

Do these in order. No UI redesign or added permissions is authorized by this handoff.

1. **Real Step 4 acceptance (owner action).** Use the same connected plan, finish genuine Steps 1–3 differences, scan to establish the baseline, sign in privately with each emergency account's prepared passkey, sign out, wait 5–10 minutes and scan again. Confirm A-only then both-account completion, refresh persistence, exports and downstream gates. Never impersonate an emergency account or change tenant settings automatically.
2. **Step 2 governance evidence.** Run the existing read-only diagnostic under current consent. Record HTTP/result status for group owners, PIM eligibility/assignments and entitlement routes. Report readable, denied, unsupported or not collected. Do not equate licensing with absence or mark unread routes safe.
3. **Close validation gaps.** Add a focused test of the actual plan persistence lifecycle with delayed group reads, tenant switch/sign-out and storage failure/retry. Current pure reconciliation tests are not a React/IndexedDB lifecycle test.
4. **Bounded audit hardening.** Measure the directory-audit read on the real tenant. It currently requests a tenant-wide 90-day lookback and projects a small record; it does not guarantee 90 days of provider retention. Do not claim no unobserved mutation. Relevance is conservative: broad account/group audit updates may reset proof even if a property was cosmetic. Improve this only with observed provider fields plus tests; do not suppress security changes to reduce noise.
5. **Presentation follow-up, only after owner review.** Step 4's configuration tile can still grow tall with many genuine prerequisite failures; Step 3 can repeat prerequisite rows alongside passing registration details. Capture a real example and propose a bounded simplification before changing tile design.
6. Once these results are understood, move to the requested MFA Readiness review using the same evidence and presentation rules.

## Verification and release procedure

Latest focused command (74 passed, 0 failed):
```powershell
node --test --test-isolation=none src/graph/collect/laneBCore.test.ts src/roadmap/cleanupDone.test.ts src/roadmap/emergencyJourney.test.ts src/ui/surfaces/emergencyPasskeyTasks.test.ts src/ui/surfaces/emergencyNextSteps.test.ts src/ui/surfaces/cleanupExports.test.ts src/roadmap/cleanupPhase.test.ts src/ui/emergencyDiagnosticDev.test.ts
npx tsc --noEmit
npm run build:site
git diff --check
```

Production preview audited all four routes. Step 4 SOP switching and hiding Task on PowerShell passed. Narrow Step 4 viewport had no horizontal overflow. These checks do not constitute a real owner-operated passkey event.

Push the reviewed commit to main without force. deploy-pages checks out that exact SHA, installs locked dependencies, builds and deploys Pages. Main deployment does not wait for the full PR CI suite. Verify the deployment's head SHA and fetch the served planner entry/assets; pushing alone is not deployment confirmation.

Do not treat the earlier “62 passed” report as proof of every R1–R8 integration objective. Tests passed, but the prior report overstated acquisition timing and left live/persistence checks incomplete. This handoff explicitly preserves those boundaries.

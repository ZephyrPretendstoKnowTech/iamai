# IAMAI: Fable / Opus execution handoff

Updated 2026-09-18. Read this first. This handoff describes the current repository and the decisions that should survive the next work. Earlier execution reports occasionally claimed more coverage than was actually demonstrated; prefer source, focused tests and this document over those claims.

## Release and checkout

- Repository: https://github.com/ZephyrPretendstoKnowTech/iamai
- Local working copy: `C:/Dev/IAMAI`, on `main`; production is remote `main`.
- This document ships with the automatic emergency verification release. Use `git log -1` and `git status --short` to identify the checkout you actually have.
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
- The baseline is recorded when the on-demand group acquisition completes on the first scan where everything is correct (`configurationCheckedThrough`). Its start (`configurationObservedAt`) is the last relevant change in the directory audit log before then — the accounts, the exclusions group, any Conditional Access policy, the passkey policy — or the start of the 30-day audit window. A late-arriving audit entry inside that window moves the start forward on a later scan (new generation; earlier proof retired). A baseline recorded at scan time by the earlier rule, with no proof, moves back to the last change.
- A scan passes an account from any successful, interactive sign-in with a fresh passkey authentication in the tenant after the baseline start, with a complete compliant candidate inventory. Where it signed in is not checked: Step 2 already proves the accounts are excluded from every policy. The tile asks for a passkey sign-in since the most recent change and lists the baseline start and the last sign-in seen, one line each. The start reads "Last change: {date}" only when it is a change IAMAI read in the audit log (`configurationChangeObserved`); the start of the audit window is not a change, and reads "No change seen since: {date}"; a reason is added only for a sign-in after the change that still did not count (`recoveryWaitingLine`, owner 2026-09-23).
- Completed accounts move to Satisfied; remaining accounts stay actionable.
- Proof expires 90 days after the event.
- Unread evidence suspends current success while retaining history.
- Confirmed account changes invalidate that account. Confirmed shared recovery changes affect both.
- Schema-1 manual records are history only. Schema-2 records retain bounded proof/generation/evidence identity.
- Persistent SOPs: **Verify emergency sign-in** and **Troubleshoot emergency sign-in**. Opening Conditional Access is optional in the verify SOP; IAMAI cannot see it. Emergency recovery procedure remains available.

**Exact-key limit:** Entra logs do not reliably expose the physical credential ID. The implemented assurance is: a fresh FIDO2/passkey event occurred and every potentially usable registered passkey is known and compliant. Do not claim IAMAI identified which physical key was touched, its custody, or that the user opened a specific policy blade.

## Evidence lifecycle corrections in this release

- Final Step 3 policy correctness is required; merely possessing a compatible key cannot establish a baseline.
- One account becoming disabled/unread no longer destroys the other account's generation.
- Failed current sign-in evidence cannot use a cached event as current green.
- Display/model names and unrelated group-targeted policy changes are removed from configuration identity.
- Directory audits are paged over a 30-day lookback (Entra's P1/P2 retention; Graph rejects an earlier `activityDateTime` with a 400, which had suspended every Step 4 verification) using existing AuditLog.Read.All; relevant observed mutations reset proof.
- Audit source health is separate from sign-in source health. Audit failure suspends recovery only and does not poison MFA Readiness or unrelated sign-in analysis.
- Old snapshots without audit source evidence need a fresh scan.
- Required on-demand group reads must complete before the initial baseline; events during that acquisition are rejected.
- Step 3 review no longer references nonexistent intended-value facts.

## Prompt 60 corrections (2026-09-18)

- **Order-sensitive passkey comparison (fixed).** `keyRestrictions.aaGuids`, profile assignments and `passkeyTypes` are unordered sets, and Graph returns their members in any order. `emergencyPasskeyTasks.ts` compared them with `JSON.stringify`, so the live tenant's four approved models in Graph order rendered as an Approved models change against the same four sorted. The Step 3 reading compared `passkeyProfiles` the same way (`passkeySettings.ts` `matches`). Both now use one `samePasskeyValue`: array entries (and the `passkeyTypes` comma string) are lower-cased, trimmed, de-duplicated and sorted before comparison, as `recoveryAccountBasis` does for approved models. Extra tenant models beyond `requiredModels()` produce no row by themselves. Fields compared, the target builder and display formatting are unchanged.
- **Tasks Remaining tile standard.** Steps 2–4 render the Step 1 account tile (`emergencyReadiness.ts` `emergencySubjectTileOf`, `ContentStep.tsx` `EmergencySubjectReadiness`): subject label, the subject(s) of the next check, **N checks remaining**, the one next check (fail before unknown) and what is wrong, one action (the owning step's link or "Follow <task> in Implementation Tasks"), then **Completed checks · N**; satisfied subjects under **Satisfied · N**. No finding lists, change lists or model lists in a tile. Print keeps the source findings. Implementation Tasks draw only their steps on screen: the Task selector names the task (the title is screen-reader only) and no fact block precedes the steps; values sit in the step that uses them. The approved-model list sits beside Add additional AAGUIDs.
- **Step 1 passkey task** drops its AAGUID lines and names only the selected accounts whose approved-passkey check fails. **Step 3 protections task** navigates first and applies each differing value inline; the Microsoft Authenticator provider entry is used where all its models are required, other models are entered by AAGUID, each Add AAGUID entry ends in its own Save. Methodology keeps only why the settings matter and how the checks differ.
- **Dedicated-account signal** (`bg.notPersonal`) is also a note on Step 1's account tiles. It gates nothing and still renders in Step 4.
- **Passkey storage is judged by outcome (owner decision).** Graph can keep a profile's `passkeyTypes` as `deviceBound,synced` while the portal shows Device-bound, and no portal action changes it (live GetIAMAI). Synced passkeys cannot be attested, so with attestation enforced only device-bound passkeys register: storage passes, and no Passkey types step is proposed. Existing credentials stay judged per account. Rule for every emergency check: a failing check must name something the admin can see and change in the portal.
- **Step 4 proof resets only when the recovery outcome changes (owner decision).** The basis keeps only policies that still apply to the account after its exclusions, and the account's usable approved passkeys (`recoveryPasskeyCandidateSet`), not the tenant-wide passkey object. Audit events reset proof only for the emergency accounts and the exclusions group; nothing else should touch them. Routine Conditional Access rollout no longer resets proof. A policy change reverted between two scans is not caught; the next scan verifies the actual state.

## What remains / next bounded execution plan

Do these in order. No UI redesign or added permissions is authorized by this handoff.

1. **Real Step 4 acceptance: performed 2026-09-18 on the GetIAMAI tenant.** Steps 1–3 read Completed; after the configuration start the owner signed in privately with each emergency account's passkey, and the next scan verified both accounts ("Passkey sign-in verified", Verification Results Passed, Step 4 Completed). Still to observe on a real tenant: proof expiry at 90 days, reset on a real account or group change, refresh persistence, exports and downstream gates after completion.
2. **Step 2 governance evidence.** Run the existing read-only diagnostic under current consent. It is reachable only in a DEV build with `?dev=1` (`App.tsx` `DevSpikes`, not emitted in production), so run it against a local dev server at the registered callback `http://localhost:5173/planner/?dev=1` signed in to the real tenant, not against production. Record HTTP/result status for group owners, PIM eligibility/assignments and entitlement routes. Report readable, denied, unsupported or not collected. Do not equate licensing with absence or mark unread routes safe.
3. **Close validation gaps.** Add a focused test of the actual plan persistence lifecycle with delayed group reads, tenant switch/sign-out and storage failure/retry. Current pure reconciliation tests are not a React/IndexedDB lifecycle test.
4. **Bounded audit hardening.** Measure the directory-audit read on the real tenant. It requests a tenant-wide 30-day lookback, Entra's retention, and projects a small record. A gap of more than 30 days between scans leaves changes in between unobserved; the basis comparison still catches a change that persists. Do not claim no unobserved mutation. Relevance is conservative: broad account/group audit updates may reset proof even if a property was cosmetic. Improve this only with observed provider fields plus tests; do not suppress security changes to reduce noise.
5. **Presentation follow-up, only after owner review.** Prompt 60 applied the Step 1 tile standard to Steps 2–4 (Step 4's Configuration tile shows one finding per subject; Step 3 states a prerequisite once). Any further tile change still needs the owner's review.
6. Once these results are understood, move to the requested MFA Readiness review using the same evidence and presentation rules.
7. **YubiKey 5 AAGUIDs (later; owner: keep the defaults for now).** A YubiKey reports a different AAGUID per firmware generation (5.1, 5.2/5.4, 5.7.1, 5.7.4, 5.8), connector (USB, NFC, Lightning) and profile (consumer/enterprise), and firmware cannot be upgraded. The two defaults (`19083c3d…`, `a25342c0…`) cover only USB and NFC keys on firmware 5.7.1 consumer profile. Older, newer and 5Ci keys would read as not approved and, under an allow list, cannot register or sign in. Sources: Microsoft Learn "Microsoft Entra ID attestation for FIDO2 security key vendors" (FIDO MDS 275); Yubico firmware overview ("Once programmed, YubiKeys cannot be updated"). Yubico's own AAGUID article did not render; firmware per AAGUID came from MDS `authenticatorVersion` via a third-party mirror. If addressed: one "YubiKey 5 Series" default covering Yubico's published 5-series AAGUIDs, confirmed against Yubico's list, and never a suggestion to add custom models.
8. **Windows Hello model names.** `PASSKEY_DEFAULT_MODELS` has no Windows Hello entry, so a tenant that allow-lists a Windows Hello AAGUID renders it as `AAGUID 9ddd1817-…` / an unnamed existing model. Do not add Windows Hello to the default set without an owner decision: the portal warns attestation is not supported for Windows Hello passkeys.

## Verification and release procedure

Focused command (every emergency-access test file; all pass as of 2026-09-19):
```powershell
node --test --test-isolation=none src/graph/collect/laneBCore.test.ts src/roadmap/cleanupDone.test.ts src/roadmap/emergencyJourney.test.ts src/ui/surfaces/emergencyPasskeyTasks.test.ts src/ui/surfaces/emergencyNextSteps.test.ts src/ui/surfaces/cleanupExports.test.ts src/roadmap/cleanupPhase.test.ts src/ui/emergencyDiagnosticDev.test.ts src/ui/surfaces/emergencyGroupTasks.test.ts src/ui/surfaces/emergencyGateCreate.test.ts src/ui/surfaces/emergencySubjectTiles.test.ts src/ui/surfaces/emergencyAccountTasks.test.ts src/ui/surfaces/emergencyInstructions.test.ts src/ui/surfaces/emergencyAccounts.test.ts src/ui/surfaces/emergencyImplementationPowerShell.test.ts
npx tsc --noEmit
npm run build:site
git diff --check
```

Production preview audited all four routes. Step 4 SOP switching and hiding Task on PowerShell passed. Narrow Step 4 viewport had no horizontal overflow. These checks do not constitute a real owner-operated passkey event.

Push the reviewed commit to main without force. deploy-pages checks out that exact SHA, installs locked dependencies, builds and deploys Pages. Main deployment does not wait for the full PR CI suite. Verify the deployment's head SHA and fetch the served planner entry/assets; pushing alone is not deployment confirmation.

Do not treat the earlier “62 passed” report as proof of every R1–R8 integration objective. Tests passed, but the prior report overstated acquisition timing and left live/persistence checks incomplete. This handoff explicitly preserves those boundaries.

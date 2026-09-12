# Steps inventory: the 46 package steps and the rows the runtime adds

Recorded at HEAD `4cde3e6` on 2026-09-12. This file is derived from the code and data listed below. Nothing here is authority. Where the code does not settle a fact, the entry says "not found".

## Sources

- `docs/implementation-content/LIBRARY.json` (packages, coverage)
- `docs/implementation-content/<step>/META.json` and `docs/implementation-content/<step>/<step>/META.json`: the 46 package META files. 14 sit at the first path and 32 at the nested second path.
- `src/content/implementation/registry.generated.json` (queried with node)
- `docs/product/actionability/IAMAI-Actionability-Dependency-Playbook.md` §10.0 (lines 233–286) and the §11 heading
- `docs/product/actionability/RUN-CONTEXT.md` (RUNTIME-ROWS, MANIFEST, FIXTURES entries)
- `docs/product/actionability/BLOCKED.md` (S3 task 1 entry, grep only)
- `src/actionability/dependency-data.json`
- `src/roadmap/stepIds.ts`, `src/roadmap/generate.ts` (`prereq`, dormant / separate-admin / shared-devices / device-plan / carve-outs / security defaults / per-user MFA / ladder / validation blockers / goal loop / `s-verify-mfa` / `deferredHardeningLines` → `cleanupPhaseFor`)
- `src/roadmap/cleanup.ts`, `src/roadmap/cleanupPhase.ts`, `src/roadmap/cleanupDone.ts`
- `src/roadmap/ladder.ts`, `data/free-tier-ladder.json`
- `src/roadmap/blockerSteps.ts`, `src/validation/rules.ts` (`RuleSubject`), `src/copy/validation.ts` (`SUBJECT_PLAIN`)
- `src/roadmap/answers.ts` (`answeredCarveOuts`, `CARVE_OUT_STEP_ID`), `src/roadmap/sourceMappings.ts` (`BASELINE_MAPPINGS_KEY`)
- `src/roadmap/goalMap.ts` (`PINNED_GOAL_MAP`), `src/validation/emergencyTiers.ts` (`hardeningDeferred`)
- `src/content/stepTitle.ts` (`contentTitle`, `CONTENT_ALIAS`), `src/content/content.ts`, `docs/design/content.json` (`steps[].id/kind/title` and `cleanup.<kind>.title`, queried with node, never read whole)
- `src/ui/demo.ts`, `src/ui/demoMode.ts`, `src/ui/App.tsx` (demo load), `src/ui/surfaces/planData.ts` (the Plan's generation chain), `src/ui/surfaces/pickerRows.ts` (`appliedMapping`), `src/roadmap/progress.ts`
- `src/ui/surfaces/Plan.tsx` (Cleanup row ids `cleanup-<kind>`, row title `contentTitle` / `cleanupEntry(kind).title`, `workTypeOf`), `src/ui/surfaces/cleanupExport.ts`, `src/ui/surfaces/planBoard.ts` (`WORK_TYPE_IDS`, `workTypeOf`), `src/ui/surfaces/planLanes.ts`
- `src/roadmap/fixtures/index.ts`, `run.ts`, `records.ts`, `scenarioRows.ts`, `transitions.ts`, `semantics.ts`
- `src/testing/bigFixture.ts`, `gapsFixture.ts`, `pilotFixture.ts` (plus `uiSnapshot.ts`, grep only)

## Method

- **Counts.** LIBRARY.json declares `expectedPackageCount: 46` and `packageCount: 46`, and lists 46 packages. The folder has 46 package directories and 46 META.json files. The count of 46 is confirmed. `registry.generated.json` compiles 44 of them. The two left out are `cleanup-drill` and `cleanup-notAssessed`, both with `registered: false` in LIBRARY.
- **Titles.**
  - A Plan row's title is `contentTitle(step)`. It uses the content.json step found by step id, then by goal id, then through `CONTENT_ALIAS`. Failing those it uses the step's `plainTitle`, then its `title`.
  - A Cleanup row's title is `cleanupEntry(kind).title`, which is content.json `cleanup.<kind>.title` (read at Plan.tsx:224).
  - For every package, the LIBRARY title, META title, registry title and content.json title are identical. The §10.0 title and the dependency-data title are also identical.
  - The titles of runtime rows come from the generated steps.
- **Work type.** Four readings are shown for each row:
  - the content.json `kind`;
  - the engine `Step.kind` seen in generated plans (`prerequisite`, `check`, `create`, `adjust`, `verify`), or the Cleanup kind;
  - the LIBRARY `relationship`;
  - the Plan board's `workTypeOf`: `ca`, `mfa`, `setup` or `resolution`.

  The §10.0 `work_type` appears in the playbook column.
- **Demo plans.** A scratch script followed `App.tsx` → `demo.ts` → `planData.ts` → `Plan.tsx` for each demo snapshot:
  - `demoTenant(week2)` loads the tenant.
  - `nextDemoRecord` is called with no stored row, so the fixture seed is used.
  - The saved record is read with `decisionsOf` and applied with `appliedMapping`.
  - The groups are the demo's seeded groups that the policies reference, plus the exclusions and service-accounts groups. Directory evidence is `partial`.
  - Coverage uses the pinned package and `PINNED_GOAL_MAP`. Then come `generateRoadmap` (with `operatorUserId: null`), `applySkips`, `applyProgress`, `settleForecast` and `annotateStateReasons`.
  - Cleanup rows get the id `cleanup-<kind>` and are then read through `laneReadings`.

  Dates are shifted to the run day (2026-09-12). The Initial seed decides `s-prereq-break-glass`. The Follow-up seed decides `s-prereq-break-glass`, `s-prereq-allowed-countries`, `s-goal-guests-mfa` and `s-goal-block-legacy-auth`, and those decisions add the three `s-question-*` rows. Neither seed has skips.
  - Lane notation is `Lane · substatus`.
  - "(fallback)" means the dependency graph does not know the id, so the lane comes from `planState` (`fromEngine: false`).
  - Completed rows are only visible with Show completed.
  - The `readGroup` IndexedDB read is approximated from the fixture's group map.
- **Fixtures.** `runFixture(fixture(name))` was run for all 11 `FIXTURE_SPECS`, with `huge` run under `HUGE=1`. `runFixture(curatedFixture(name))` was also run for each; every curated twin produced the same step-id set as its plain fixture, so twins are not listed. The corpus extras in `semantics.ts` were run too, as was `transitions()`. A step "is exercised" when its id is in the run's `steps` or, for Cleanup, in `schedule.cleanup.rows`, including rows with `doesntApply`. None had `doesntApply` in these runs. Literal id references were found by grep over `src/roadmap/fixtures/` and `src/testing/`.
  - **Abbreviations.**
    - **all 11**: micro, small, getiamai, mid, large, huge, messy, midflight, hostile, demo, demo-week2.
    - **all but micro**: the other 10.
    - **C-mid**: the three `semantics.ts` corpus cases built on curated mid (`unansweredSafetyCase`, `collidingNamesCase`, `setAsideCase`).
    - **C-dw2**: `reviewHeldCase`, the second scan of curated demo-week2.
    - **T n/19**: the number of the 19 `transitions()` whose A, B or control scan contains the id. The transitions are built on curated `small` and `demo-week2`.
    - **P**: `pilotFixture.ts` names the id.
  - `bigFixture.ts`, `gapsFixture.ts` and `uiSnapshot.ts` build snapshots only, are not run through the plan generator, and name no step id.
  - `records.ts` and `scenarioRows.ts` are helpers and name no step id.

## Inventory

### Package steps (46)

| step id | title | work type | in playbook §10.0 | demo plan: Initial / Follow-up | fixtures that exercise it |
|---|---|---|---|---|---|
| `cleanup-drill` | Run the Emergency Access Drill | Cleanup row, kind `drill` · no content step · pkg `rollout-proof` · board n/a | yes (rollout proof / cleanup) | Initial: yes, Up Next / Follow-up: yes, Completed | all 11; C-mid; C-dw2; T 19/19 |
| `cleanup-notAssessed` | Review Baseline Policies IAMAI Did Not Assess | Cleanup row, kind `notAssessed` · pkg `baseline-source-review` · board n/a | yes (source review / cleanup) | yes, Ready · Create / yes, Ready · Create | demo, demo-week2; C-dw2; T 13/19 |
| `s-check-dormant-accounts` | Disable or Confirm Dormant Accounts | content `check` · engine `check` · pkg `remediation-prerequisite` · board `resolution` | yes (identity hygiene) | yes, Ready · Create / yes, Ready · Create | all 11; C-mid; C-dw2; T 19/19 |
| `s-check-separate-admin-accounts` | Use Separate Accounts for Admin Work | content `check` · engine `check` · pkg `prerequisite` · board `resolution` | yes (privileged identity hygiene) | yes, Ready · Create / yes, Ready · Create | small, mid, large, huge, demo, demo-week2; C-mid; C-dw2; T 19/19 |
| `s-goal-admin-portals-protected` | Block the Admin Portals for Non-Admins | content `policy` · engine `create` · pkg `baseline-goal` · board `ca` | yes (CA policy) | yes, On Hold / yes, On Hold | all but micro; C-mid; C-dw2; T 19/19 |
| `s-goal-admin-session` | Shorten Admin Sessions | content `policy` · engine `create` · pkg `baseline-goal` · board `ca` | yes (CA policy) | yes, On Hold / yes, On Hold | all but micro; C-mid; C-dw2; T 19/19 |
| `s-goal-admins-phishing-resistant` | Require Phishing-Resistant MFA for Admins | content `policy` · engine `create`/`adjust` · pkg `baseline-goal` · board `ca` | yes (CA policy) | yes, On Hold (adjust) / yes, Completed (create) | all but micro; C-mid; C-dw2; T 19/19 |
| `s-goal-azure-management-mfa` | Require MFA for Azure Management | content `policy` · engine: never generated · pkg `baseline-goal` · board `ca` | yes (CA policy) | no / no | none. The goal is not in `PINNED_GOAL_MAP` and reads `not-applicable` in every fixture. |
| `s-goal-block-auth-transfer` | Block Authentication Transfer | content `policy` · engine `create`/`adjust` · pkg `baseline-goal` · board `ca` | yes (CA policy) | yes, On Hold (create) / yes, On Hold (adjust) | all but micro; C-mid; C-dw2; T 19/19 |
| `s-goal-block-device-code` | Block Device Code Sign-in | content `policy` · engine `create`/`adjust` · pkg `baseline-goal` · board `ca` | yes (CA policy) | yes, On Hold (adjust) / yes, Completed (create) | all but micro; C-mid; C-dw2; T 19/19 |
| `s-goal-block-legacy-auth` | Block Legacy Authentication | content `policy` · engine `create`/`adjust` · pkg `baseline-goal` · board `ca` | yes (CA policy) | yes, On Hold (adjust) / yes, Completed (create) | all but micro; C-mid; C-dw2; T 19/19 |
| `s-goal-block-unsupported-platforms` | Block Unsupported Device Platforms | content `policy` · engine `create` · pkg `baseline-goal` · board `ca` | yes (CA policy) | yes, On Hold / yes, On Hold | all but micro; C-mid; C-dw2; T 19/19 |
| `s-goal-device-registration-mfa` | Require MFA to Register a Device | content `policy` · engine `create` · pkg `baseline-goal` · board `ca` | yes (CA user-action policy) | yes, On Hold / yes, On Hold | all but micro; C-mid; C-dw2; T 19/19; P (`PILOT_STEP_ID`) |
| `s-goal-geo-restriction` | Block Sign-ins From Countries Not Allowed | content `policy` · engine `create` · pkg `baseline-goal` · board `ca` | yes (CA policy) | yes, On Hold / yes, On Hold | all but micro; C-mid; C-dw2; T 19/19 |
| `s-goal-guests-mfa` | Require MFA for Guests | content `policy` · engine `create`/`adjust` · pkg `baseline-goal` · board `ca` | yes (CA policy pair) | yes, On Hold (adjust) / yes, Completed (create) | all but micro; C-mid; C-dw2; T 19/19 |
| `s-goal-intune-enrollment-reauth` | Require a Fresh Sign-in for Intune Enrollment | content `policy` · engine `create` · pkg `baseline-goal` · board `ca` | yes (CA policy) | yes, Up Next / yes, Ready · Create | large, demo, demo-week2; C-dw2; T 13/19 |
| `s-goal-mfa-all-users` | Require MFA for Everyone | content `policy` · engine `create`/`adjust` · pkg `baseline-goal` · board `ca` | yes (CA policy) | yes, On Hold (adjust) / yes, Completed (create) | all but micro; C-mid; C-dw2; T 19/19 |
| `s-goal-mobile-app-protection` | Require App Protection on Phones | content `policy` · engine: never generated · pkg `baseline-goal-composite` · board `ca` | yes (CA + Intune composite) | no / no | none. The goal is not in `PINNED_GOAL_MAP`: it reads `absent` in large, demo and demo-week2 and `not-applicable` elsewhere, and the goal loop skips a non-floor goal the baseline does not hold. |
| `s-goal-pim-activation-reauth` | Require MFA at Every Role Activation | content `policy` · engine `create` · pkg `baseline-goal` · board `ca` | yes (CA + PIM composite) | no / no (`licence-limited` in the demo) | mid, huge; C-mid; T 0/19 |
| `s-goal-register-info-protected` | Protect Sign-in Method Registration | content `policy` · engine `create` · pkg `baseline-goal` · board `ca` | yes (CA user-action policy) | yes, Ready · Create / yes, Ready · Create | all but micro; C-mid; C-dw2; T 19/19 |
| `s-goal-require-managed-device` | Require a Managed Device Outside the Office | content `policy` · engine `create`/`adjust` · pkg `baseline-goal-composite-prerequisite` · board `ca` | yes (CA + Intune composite) | yes, On Hold / yes, On Hold | large, demo, demo-week2; C-dw2; T 13/19 |
| `s-goal-service-accounts-trusted-network` | Restrict Service Accounts to the Trusted Network | content `policy` · engine `create` · pkg `baseline-goal` · board `ca` | yes (CA policy) | yes, On Hold / yes, On Hold | mid, demo, demo-week2; C-mid; C-dw2; T 13/19 |
| `s-goal-session-lifetime` | Limit How Long Sessions Last | content `policy` (content id `session-lifetime`) · engine: never generated under this id · pkg `baseline-goal` · board `ca` | yes (CA policy pair) | not under this id. The row is `s-goal-all-users-no-persistence` (runtime table). | none under this id. `s-goal-all-users-no-persistence` covers all but micro. |
| `s-goal-sign-in-risk` | Challenge High-Risk Sign-ins | content `policy` · engine `create` · pkg `baseline-goal` · board `ca` | yes (Identity Protection CA) | no / no (`licence-limited` in the demo) | mid, huge; C-mid; T 0/19 |
| `s-goal-sign-in-risk-medium` | Challenge Medium-Risk Sign-ins | content `policy` · engine `create` · pkg `baseline-goal` · board `ca` | yes (Identity Protection CA) | no / no | mid, huge; C-mid; T 0/19 |
| `s-goal-token-protection` | Require Token Protection on Windows | content `policy` · engine `create`/`adjust` · pkg `baseline-goal` · board `ca` | yes (CA session control) | yes, On Hold (create) / yes, On Hold (adjust) | all but micro; C-mid; C-dw2; T 19/19 |
| `s-goal-unmanaged-browser` | Limit Unmanaged Devices in the Browser | content `policy` · engine: never generated · pkg `baseline-goal-composite` · board `ca` | yes (CA / Defender for Cloud Apps composite) | no / no | none. No goal `unmanaged-browser` exists in `PINNED_GOAL_MAP`. `CONTENT_ALIAS` maps goals `byod-session-controls` and `block-downloads-unmanaged` to it, and both read `absent` or `licence-limited` and are not in the map. |
| `s-goal-user-risk` | Remediate High-Risk Users | content `policy` · engine `create` · pkg `baseline-goal` · board `ca` | yes (Identity Protection CA) | no / no | mid, huge; C-mid; T 0/19 |
| `s-goal-user-risk-medium` | Reset Passwords for Medium-Risk Users | content `policy` · engine `create` · pkg `baseline-goal` · board `ca` | yes (Identity Protection CA) | no / no | mid, huge; C-mid; T 0/19 |
| `s-goal-workload-identity-block` | Restrict the Entra Connect Sync Account to Its Address | content `policy` · engine: never generated · pkg `baseline-goal-composite` · board `ca` | yes (identity-type-dependent) | no / no | none. The goal is in `PINNED_GOAL_MAP` but reads `not-applicable` in every fixture. |
| `s-ladder-operator-passkey` | Register Your Own Passkey | content `check` · engine: never generated · pkg `prerequisite` · board `mfa` (`WORK_TYPE_IDS`) | yes (operator readiness) | no / no | none. No code in `generate.ts` or `ladder.ts` creates this id, and it is not a `free-tier-ladder.json` item. |
| `s-prereq-allowed-countries` | Create or Correct Allowed Countries Location | content `object` · engine `prerequisite` · pkg `prerequisite` · board `setup` | yes (foundation object) | yes, Ready · Create / yes, Ready · Create | all but micro; C-mid; C-dw2; T 19/19 |
| `s-prereq-auth-strength` | Create the Baseline's Authentication Strength | content `object` · engine `prerequisite` · pkg `prerequisite` · board `mfa` | yes (foundation object) | no / no | No fixture as built. `strengthMissing()` (fixtures/index.ts) over demo or demo-week2 produces it, reading Ready · Create; over small or mid it does not. T 2/19. |
| `s-prereq-break-glass` | Create or Correct Emergency Access Accounts | content `blocker` · engine `prerequisite` · pkg `prerequisite` · board `setup` | yes (foundation safety) | yes, Ready · Create / yes, Completed | all but micro; C-mid; C-dw2; T 19/19 |
| `s-prereq-device-plan` | Decide How Devices Are Managed | content `check` · engine `check` · pkg `prerequisite` · board `resolution` | yes (owner decision) | yes, Ready · Needs decision / yes, Ready · Needs decision | large, demo, demo-week2; C-dw2; T 13/19 |
| `s-prereq-exclusion-group` | Create or Correct Exclusions Group | content `blocker` · engine `prerequisite` · pkg `prerequisite` · board `setup` | yes (foundation object) | yes, Up Next / yes, Completed | all but micro; C-mid; C-dw2; T 19/19 |
| `s-prereq-passkey-settings` | Set Up Passkeys to Match the Baseline | content `object` · engine: never generated · pkg `prerequisite` · board `mfa` (`WORK_TYPE_IDS`) | yes (authentication-method foundation) | no / no | none. No code in `generate.ts` creates this id. |
| `s-prereq-per-user-mfa` | Finish Moving Off Per-User MFA | content `object` · engine `prerequisite` · pkg `prerequisite` · board `mfa` | yes (cutover / legacy cleanup) | no / no | messy |
| `s-prereq-security-defaults` | Turn Off Security Defaults | content `object` · engine `prerequisite` · pkg `prerequisite` · board `setup` | yes (cutover) | no / no | messy |
| `s-prereq-service-accounts-group` | Create or Correct Service Accounts Group | content `object` · engine `prerequisite` · pkg `prerequisite` · board `setup` | yes (foundation object) | yes, Ready · Create / yes, Ready · Create | mid, demo, demo-week2; C-mid; C-dw2; T 13/19 |
| `s-prereq-trusted-location` | Define the Trusted Network | content `object` · engine `prerequisite` · pkg `prerequisite` · board `setup` | yes (foundation object) | yes, Completed / yes, Completed | all but micro; C-mid; C-dw2; T 19/19 |
| `s-question-mail-devices` | Set Up an SMTP Relay for Mail-Sending Devices | content `check` · engine `prerequisite` (carve-out, `answeredCarveOuts`) · pkg `prerequisite` · board `resolution` | yes (conditional remediation) | Initial: no / Follow-up: yes, Ready · Create | None. No fixture mapping carries the answer; only the demo Follow-up's seeded decisions add it. |
| `s-question-partner` | Exclude the Partner or MSP Accounts | content `check` · engine `prerequisite` (carve-out) · pkg `prerequisite` · board `resolution` | yes (owner decision / exception design) | Initial: no / Follow-up: yes, Ready · Needs decision | None. Only the demo Follow-up adds it. |
| `s-question-travel` | Add a Travel Notice and Exclusion | content `check` · engine `prerequisite` (carve-out) · pkg `prerequisite` · board `resolution` | yes (operational exception workflow) | Initial: no / Follow-up: yes, Up Next | None. Only the demo Follow-up adds it. |
| `s-shared-devices` | Give Shared Devices Their Own Policy | content `policy` · engine `prerequisite` · pkg `prerequisite` · board `ca` | yes (supporting policy / exception design) | yes, Ready · Create / yes, Ready · Create | mid, demo, demo-week2; C-mid; C-dw2; T 13/19 |
| `s-verify-mfa` | Create and Enforce the MFA Registration Campaign | content `campaign` · engine `verify` · pkg `prerequisite` · board `mfa` | yes (readiness / registration) | yes, Ready · Create / yes, Ready · Create | all 11; C-mid; C-dw2; T 19/19 |

### Runtime-generated rows (no package)

| step id | title | work type | in playbook §10.0 | demo plan: Initial / Follow-up | fixtures that exercise it |
|---|---|---|---|---|---|
| `cleanup-alerting` | Alert on Emergency Account Sign-ins | Cleanup row, kind `alerting` (`cleanup.ts`, present when emergency accounts are confirmed) | no | yes, Ready · Create (fallback) / yes, Completed (fallback) | all 11; C-mid; C-dw2; T 19/19 |
| `cleanup-hardening` | Harden Emergency Access | Cleanup row, kind `hardening`, fed by `deferredHardeningLines()` when `hardeningDeferral` covers the emergency step's hardening results | Yes, under a different id: `cleanup-harden-emergency-access` (conditional cleanup row). `dependency-data.json` uses that id, so the engine never matches this row; per `planLanes.ts` it would take the fallback lane. | no / no (the demo seeds no deferral) | No fixture as built. A `hardeningDeferral` override whose `basis` is the emergency step's `emergency.basis` produces it in small, getiamai, mid, large, messy, midflight, hostile and demo. micro has no emergency step, and demo-week2 has no hardening to defer. |
| `cleanup-naming` | Rename Policies Off the Naming Convention | Cleanup row, kind `naming` | no | no / no | messy |
| `cleanup-consolidation` | Consolidate Overlapping Policies | Cleanup row, kind `consolidation` | no | no / no | mid, large, huge; C-mid; T 0/19 |
| `s-goal-all-users-no-persistence` | Limit How Long Sessions Last (content `session-lifetime` via `CONTENT_ALIAS`) | content `policy` · engine `create` · board `ca`. A goal step: `idFor('goal', 'all-users-no-persistence')` from the `PINNED_GOAL_MAP` key. Its package is `s-goal-session-lifetime`. | No under this id. The index row is `s-goal-session-lifetime`, which the graph carries, so this row takes the fallback lane. | yes, On Hold (fallback) / yes, On Hold (fallback) | all but micro; C-mid; C-dw2; T 19/19 |
| `s-ladder-security-defaults` | Enable security defaults (`plainTitle` from `free-tier-ladder.json`; its content step has no title) | content `ladder` · engine `prerequisite` · board `resolution`. Free-tier ladder, only when Conditional Access is unavailable. | no | no / no | micro |
| `s-ladder-break-glass-accounts` | Create and validate break-glass accounts | content `ladder` · engine `prerequisite` · board `resolution`. Replaced by `s-prereq-break-glass` when that step exists. | no | no / no | micro |
| `s-ladder-legacy-auth-inventory` | Inventory legacy authentication usage | content `ladder` · engine `prerequisite` · board `resolution` | no | no / no | micro |
| `s-ladder-app-passwords` | Eliminate app passwords | content `ladder` · engine `prerequisite` · board `mfa` | no | no / no | micro |
| `s-ladder-per-user-mfa-cleanup` | Reconcile per-user MFA states | content `ladder` · engine `prerequisite` · board `mfa`. Replaced by `s-prereq-per-user-mfa` when that step exists. | no | no / no | micro |
| `s-ladder-admin-accounts-separate` | Separate admin accounts from daily-driver accounts | content `ladder` · engine `prerequisite` · board `resolution` | no | no / no | micro |
| `s-ladder-global-admin-count` | Reduce Global Administrator count | content `ladder` · engine `prerequisite` · board `resolution` | no | no / no | micro |
| `s-ladder-guest-review` | Review guest accounts and external state | content `ladder` · engine `prerequisite` · board `resolution` | no | no / no | micro |
| `s-ladder-stale-accounts` | Disable dormant and never-signed-in accounts | content `ladder` · engine `prerequisite` · board `resolution` | no | no / no | micro |
| `s-ladder-authenticator-over-sms` | Move users from SMS/voice to Authenticator | content `ladder` · engine `prerequisite` · board `mfa` | no | no / no | micro |
| `s-blocker-allowed-countries` | Fix the allowed-countries list before it is used (`SUBJECT_PLAIN`) | content `blocker` · engine `prerequisite` (action `check`) · board `setup`. `blockerSteps()` creates it when the allowedCountries report has blocking checks. | no | no / no | large, hostile |
| `s-blocker-trusted-location` | Fix the trusted location before it is used (`SUBJECT_PLAIN`) | content `blocker` · engine `prerequisite` (action `check`) · board `setup` | no | no / no | none in these runs |
| `s-blocker-service-account` | Check the service accounts (`SUBJECT_PLAIN`) | content `blocker` · engine `prerequisite` (action `check`) · board `setup` | no | no / no | none in these runs |

Ids the code names but never generates as a Plan row:

- `s-blocker-pilot-group` and `s-blocker-auth-strength` have content.json entries, and `s-blocker-auth-strength` is in `WORK_TYPE_IDS`. But `generate.ts` builds validation reports only for breakGlass, exclusionGroup, trustedLocation, allowedCountries and serviceAccount. The breakGlass and exclusionGroup ids resolve to the `s-prereq-*` steps, so no pilotGroup or authStrength blocker step is ever produced.
- `s-prereq-source-references` is not a row. It survives only as `BASELINE_MAPPINGS_KEY` (`sourceMappings.ts`), the decision key for Plan settings → Baseline mappings. A pending mapping is a `sourceMapping` blocker on the policies it holds.

## Cross-checks

- **§10.0 ids with no package and no runtime row.**
  - `runtime-source-reference-decision`: no row under any id. The runtime row it described was removed, and only the `BASELINE_MAPPINGS_KEY` decision key remains.
  - `cleanup-harden-emergency-access`: no row with this id. The code's row is `cleanup-hardening`.
- **dependency-data.json ids not in LIBRARY.json.**
  - Steps: `runtime-source-reference-decision` and `cleanup-harden-emergency-access`, 48 steps against 46 packages.
  - Edges: `cleanup-harden-emergency-access` is the only non-package id used as an edge step or prerequisite.
  - Every LIBRARY id is in dependency-data.json.
- **Package ids that never become a generated row in any fixture or demo plan.** `s-goal-azure-management-mfa`, `s-goal-mobile-app-protection`, `s-goal-unmanaged-browser`, `s-goal-workload-identity-block`, `s-goal-session-lifetime` (generated as `s-goal-all-users-no-persistence`), `s-prereq-passkey-settings` and `s-ladder-operator-passkey`. Also `s-prereq-auth-strength` and the three `s-question-*` steps appear only under a variant input or the demo Follow-up seed.
- **Runtime rows the graph does not know.** These take the fallback lane: `cleanup-alerting`, `cleanup-hardening`, `cleanup-naming`, `cleanup-consolidation`, `s-goal-all-users-no-persistence`, every `s-ladder-*` and every `s-blocker-*`. BLOCKED.md S3 task 1 already records the first five.
- **META location.** 32 of the 46 META.json files are nested at `docs/implementation-content/<step>/<step>/META.json`, while LIBRARY `packagePath` gives `docs/implementation-content/<step>/`.
- **Registry.** 44 packages are compiled, since the two `cleanup-*` packages are `registered: false`.

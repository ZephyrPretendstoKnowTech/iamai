# The Plan's steps as they are (2026-09-19, at 7e99ffb4)

A reference for the V1 step map (`v1-step-map.md`). This is what the code does today, cited by file.

## How the list is built

1. `generateRoadmap` (`src/roadmap/generate.ts`) builds the steps.
2. `addWorkflowSteps` (`workflows.ts`) adds Confirm the Services You Use (`s-confirm-workloads`), plus one review row for each baseline policy IAMAI doesn't assess (`s-review-baseline-*`).
3. `usePlanData` (`src/ui/surfaces/planData.ts`) calls both. Then `customerPlanSteps` drops `admin-portals-protected`.
4. Cleanup rows come from `cleanupRows` (`src/roadmap/cleanup.ts`), with ids `cleanup-<kind>`.
5. `laneReadings` (`planLanes.ts`) puts each row in a lane:
   - tabs: Ready, Up Next, On Hold;
   - toggles: Completed, Deferred.

   A step marked "Doesn't apply" gets no row.

## What makes each step appear

"With CA" means the tenant has Entra ID P1, so Conditional Access is available.

| Step | Appears when |
|---|---|
| Emergency: `s-prereq-break-glass`, `s-prereq-exclusion-group`, `s-prereq-passkey-settings`, `cleanup-drill` | Always with CA |
| `s-prereq-trusted-location` | Always with CA |
| `s-prereq-auth-strength` | The baseline needs a custom strength |
| `s-prereq-allowed-countries` | The geo goal is present and licensed |
| `s-prereq-service-accounts-group` | Service accounts are picked, or the question was answered |
| `s-check-dormant-accounts`, `s-check-separate-admin-accounts` | Always with CA |
| `s-shared-devices` | Shared devices are detected, saved or confirmed |
| `s-prereq-device-plan` | **Only when phone or unjoined-computer sign-ins are seen** (this hides on evidence) |
| `s-ladder-operator-passkey` | The scan found no passkey for the signed-in person |
| `s-question-partner`, `s-question-mail-devices` | Their answer says yes |
| `s-question-travel` | **Never** (`answers.ts:196`) |
| `s-prereq-security-defaults`, `s-prereq-per-user-mfa` | Always with CA |
| `s-goal-*` (about 23) | One per coverage result, when applicable and licensed. `admin-portals-protected` is hidden |
| `s-goal-inforcer-mfa` | Inforcer is confirmed not in use |
| `s-verify-mfa` | The MFA-for-everyone goal is present |
| `s-ladder-*` | Only without P1 |
| `s-blocker-*` | Never in practice |
| `s-confirm-workloads` | There's at least one service to ask about. Pinned to the top of Ready |
| `s-review-baseline-*` | One per unassessed baseline policy. Set aside on "no"; blocked on "unsure" |
| `cleanup-alerting`, `-hardening`, `-naming`, `-consolidation`, `-notAssessed` | There's something to list |

## Questions asked today

Answers are saved in two places:
- `stepDecisions[stepId]` and `questionAnswers['<stepId>:<label>']`, applied by `applyStepDecisions` (`decisions.ts`);
- pickers in `pickerRows.ts`.

| Question | Where it lives | What reads it | Scan pre-suggests? |
|---|---|---|---|
| Emergency accounts, exclusions group, hardening deferral | Establish Emergency Access (frozen) | The emergency gate, exclusions on every policy | Nominated, never applied |
| Work countries, recurring travel | `s-prereq-allowed-countries` | The geo policy's location | Suggested |
| Trusted network | `s-prereq-trusted-location` | The trusted-location placeholder | Not applied |
| Service accounts | `s-prereq-service-accounts-group` | The group, the service-accounts policy, applicability | **Applied** |
| Shared devices | `s-shared-devices` | That step; excluded from people | Detection until saved |
| Device plan (phones, app protection, computers) | `s-prereq-device-plan` (`DeviceDecision`) | Readiness scope, platform exclusions, setting device steps aside | No |
| Partner or MSP, mail-sending devices, device code | Questions on guests-MFA, legacy-auth and device-code | Exclusions, service accounts, the enforcement hold | Pre-fill code not found |
| First enforcement (risk) | On sign-in risk | Changes the grant | No |
| People needing help | `s-verify-mfa` | The campaign | **Applied** |
| Services you use | `s-confirm-workloads` (`WorkflowDecision`) | Makes goals not applicable, blocks on "unsure", sets reviews aside | **Yes**, from sign-ins |
| Dormant accounts | `s-check-dormant-accounts` | Completion | No |
| Approved passkey models | `PasskeyModelDecision` | Passkey checks | No |
| Baseline mappings | `stepDecisions['s-prereq-source-references']` | Every policy naming the reference | **No UI mounted** (`Plan.tsx:46,725`) |

## Emergency Access is hard-coded here

The places a group registry has to replace:
- `planBoard.ts:391-402, 470`
- `Plan.tsx:244-257, 387-389`
- `ContentStep.tsx` (`isEmergencyTaskStep` / `isEmergencyJourneyStep`, and the four headings)
- `CleanupStep.tsx:114-189`
- `stepBody.ts:314-326, 384-395`
- `stepContract.ts:1384-1411`
- `stepPackage.ts:661,685`
- `stepResources.ts`
- `emergencyImplementation.ts`
- `planLanes.ts:405-431`
- `blockerSteps.ts:55`: a **different** id set, used by `generate.ts:802`
- `decisions.ts:149-150`
- `cleanup.ts:42-45`

## Baseline references

`interpretation.json` holds 12 `unknown` references.

1. `assumedAbsentSourceGroups` (`sourceMappings.ts`) auto-omits every exclude-only group except 5628ad67 and the AVD one. That covers 62d67e66.
2. `resolvePolicy.ts` marks the rest pending.
3. `planLanes.ts` turns each pending one into a `sourceMapping:<id>` blocker, which puts the policy On Hold.
4. The graph's `sourceMapping:62d67e66` edges are always treated as resolved.

## Estimated dates in the past

The dates are anchored to `startDate`, which is fixed permanently when the person presses Start (`planData.ts:507`). Neither `buildSchedule` (`schedule.ts`) nor `stepScheduleOf` pulls overdue work forward to today, so unfinished preparation keeps its original day. A report-only window also keeps showing its `readyOn` date until a later scan closes it.

# Frozen Foundations A/B/C/D

This file is an overnight-review boundary, not a replacement specification. The source tests remain executable authority.

## Foundation A — policy-operation authority

The open policy operation is the only authority for whether IAMAI may offer an implementation. Goal/readiness/floor/step-population logic does not independently decide consequences. Reading is exact or explicitly unknown; unknown is conservative, never silently safe/zero/shortened. Emergency and exclusion safety gates cannot be bypassed by presentation or lifecycle state.

Primary executable references:
- `src/roadmap/foundationA.test.ts`
- `src/roadmap/operations.ts`
- `src/roadmap/resolvePolicy.ts`

## Foundation B — lifecycle, condition and observation

`Step.state` is authority; `Step.status` is a projection. Lifecycle and condition are separate axes. Lifecycle is one of not-deployed/report-only/ready-to-enforce/enforced where applicable. Condition independently represents states such as healthy, review-required, blocked, needs-decision, and baseline-conflict. History/first-seen/observation facts are never invented. A rename can preserve observation identity; a semantic rewrite restarts it.

Primary executable references:
- `src/roadmap/foundationB.test.ts`
- `src/roadmap/lifecycle.ts`
- `src/roadmap/observation.ts`

## Foundation C — safety-sensitive decisions

Detected, recommended, operator-confirmed, and actionable are four distinct facts. A recommendation is never confirmation. A saved confirmation is actionable only while the current scan proves the object exists. A policy merely naming a group does not prove directory presence. Absence is claimed only from complete evidence. Only a confirmed, currently present object ID may reach policy operations.

Primary executable references:
- `src/roadmap/foundationC.test.ts`
- `src/mapping/safetyChoice.ts`

## Foundation D — Step Contract / presentation boundary

Every Plan step is rendered from the shared Step Contract view-model. The view-model consumes A/B/C and does not re-decide them. Render order is: title → state (stage · condition) → policy members when a pair → leading lines → Why → What IAMAI found → Who this touches → What to do → Fix before continuing → Dates → Done when → If it goes wrong / locked out → Tell your people → More.

`contract.implementation` equals Foundation A's `implementationOffered(step)`. Delivered goals preserve rather than redeploy. A baseline conflict offers no implementation and no tenant-side “fix”. Multi-policy goals retain per-policy member state. Unknown reach never becomes zero/nobody.

Primary executable references:
- `src/ui/surfaces/stepContract.ts`
- `src/ui/surfaces/StepSections.tsx`
- `src/ui/surfaces/stepContract.test.ts`

## Frozen means frozen

For the overnight queue, the runner treats these files as protected authority and will reject a task commit that changes any of them:

- `src/roadmap/foundationA.test.ts`
- `src/roadmap/operations.ts`
- `src/roadmap/resolvePolicy.ts`
- `src/roadmap/foundationB.test.ts`
- `src/roadmap/lifecycle.ts`
- `src/roadmap/observation.ts`
- `src/roadmap/foundationC.test.ts`
- `src/mapping/safetyChoice.ts`
- `src/ui/surfaces/stepContract.ts`
- `src/ui/surfaces/StepSections.tsx`
- `src/ui/surfaces/stepContract.test.ts`

The overnight queue may add downstream regression coverage or repair consumers that demonstrably violate these contracts. It must not move authority to a different module, collapse axes, invent a new safety state, replace the Step Contract hierarchy, or alter a frozen authority to make a task easier. If a task appears to require such a product-contract change, stop that task as `MANUAL_DECISION_REQUIRED` and continue independent work.

The baseline pin is also human-owned tonight. Both `baselines/jhope188-conditionalaccesspolicies.index.json` (source/commit) and `baselines/jhope188-conditionalaccesspolicies.pinned.json` are protected from automated task commits.

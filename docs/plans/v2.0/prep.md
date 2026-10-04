# v2.0 prep: more than one baseline (draft, 2026-10-04)

Timeline (owner): v1.1 tomorrow, v1.5 next week, v2.0 the week after with a second curated
baseline. v3.0 lets people add or configure their own.

## Where things stand
- **What is already baseline-independent:**
  - the goal catalogue (`data/goals.json`);
  - goal identity, which matches policies by structure (`src/coverage/goalIdentity.ts`);
  - the interpretation format, which is per baseline by design.
- **What ties the app to Jon is wiring, not data.**
  - Generic modules import `baselines/jhope188-*.json` directly.
  - Many callers fall back silently to Jon's map and policies (`PINNED_GOAL_MAP`,
    `pinnedSource()`).
  - The plan record does not say which baseline it was made from.

### Blockers for a second curated baseline (verified)
1. `ui/baseline.ts` `restoreBaseline`: every non-upload origin reloads Jon's pin, so a tenant
   that chose baseline B gets Jon's back after a reload. The author-update check and the
   baseline review are Jon's only.
2. `roadmap/goalMap.ts` `pinnedSource`: the "pinned baseline wins" stand-in is always Jon's
   policies (`generate.ts`, `coverage.ts`).
3. Silent `?? PINNED_GOAL_MAP` defaults in `coverage.ts`, `generate.ts`, `planData.ts`,
   `Connect.tsx` and `baselineScope.ts`: a caller that forgets the map gets Jon's.
4. `ui/surfaces/stepPortal.ts`: Jon's policy names and strengths reach another baseline's step
   text (`pairBaselineNames`, `strengthForGoal`, `sessionWanted*`).
5. `roadmap/direction.ts` `partnerStrength` quotes Jon's strength.
6. Credit and dates:
   - `planData.ts` `baselineAuthor` credits Jon for any baseline;
   - the Connect card (`content.json` `baseline.what`) names Jon;
   - Connect's "read at" date is Jon's.
7. **The plan record is keyed by tenant only** (IndexedDB `plan`, `planIdFor`). Switching
   baseline would carry skips, accepted deviations, observations and answers onto another
   baseline's policies. Loading a plan file is already guarded (`sameBaselineSource`).
8. **The implementation packages are bound to Jon's members.**
   - `META.baselineAuthority` holds Jon's member ids, his pin and his policy names.
   - Drift is computed against Jon's pin only.
   - Under another baseline, multi-member packages drop out.
9. **Jon-only features:** the Lockdown Kit (Jon's three ids) and the author corrections (by
   Jon's names). They don't break another baseline, but it can't declare its own.

## Prep order
Phase A (items 1–5): no change in output for Jon's plan, so every step snapshot stays
byte-identical as the acceptance. It sits on its own branch, off `v1.1`, so v1.1 is not
touched.

| # | Item | Size |
|---|---|---|
| 1 | **The baseline registry.** One `baselines/<id>/` folder per baseline (pinned, index, interpretation, plus a new `annotations.json`), and `src/baseline/registry.ts` giving a `BaselineDefinition` by id. Every direct `jhope188` import goes through it. The label and the card's words live in the baseline's index only. A test fails if any `src/` file imports `baselines/*` directly. | M |
| 2 | **An id on every baseline.** `BaselineResult` and the stored origin carry `{kind:'curated', id, commit}`. `restoreBaseline`, the update check and the review take the id. Old `kind:'github'` records are read as Jon's; no database version change. | M |
| 3 | **No silent defaults.** The goal map is required; `pinnedSource` takes the active definition. The fixtures pass their map explicitly. | M |
| 4 | **The active baseline everywhere.** `stepPortal`, `partnerStrength`, `baselineAuthor`, and the Connect card and date read the active baseline, not `PINNED`. | S |
| 5 | **Annotations out of code.** Into Jon's `annotations.json`: the footer reasons (`notInPlan.ts` REASONS), the hidden agent policy and the service-account patterns (`workflows.ts`), the lockdown switches, the author corrections, and the companion rules (`companions.ts`). Generic code keeps only the mechanism. | S |
| 6 | **The plan says which baseline it was made from.** `baselineId` and commit go in the plan record and the plan file. Switching baseline behaves as the owner decides (below). | M |
| 7 | **Content split.** Implementation packages become goal-generic text plus per-baseline member bindings, with drift per baseline. `content.json` step text that assumes Jon's pairs (guests, unmanaged browser) and Jon's values ("Modern MFA + TAP", "4 hours") moves to variables. | L |
| 8 | **Scripts.** `pin-baseline.ts <id> <commit>`; compile-implementation-content, walk and translator-dump loop over the registry. | S |
| 9 | **Tests.** A second small curated fixture baseline, a baseline dimension on step snapshots, and registry lookups instead of direct JSON imports (about 16 test files). | M |

Phase B, in the v2.0 week: pin the second baseline, item 7's content for its policies, and
item 6.

v3.0 builds on the same pieces:
- the registry and `annotations.json` become the format a person fills in;
- the upload path (`loadUploadedBaseline`, switched off on Connect today) reads it, together
  with an interpretation step for the person's own groups and locations.

## The second baseline: recommended, Joey Verlinden's Conditional Access Baseline
<https://github.com/j0eyv/ConditionalAccessBaseline>
- **Why this one:**
  - **Licence:** MIT ("Copyright (c) 2025 j0eyv"). It can be pinned and redistributed with
    the notice kept.
  - **Format:** Graph JSON, one file per policy (IntuneManagement exports), plus
    `MigrationTable.json`, which maps the author's object ids to names. That suits the
    interpretation step IAMAI already runs.
  - **Maintenance:** 36 policies, seven dated releases since April 2024 (latest 2026.6.1,
    2026-06-11), commits in August 2026, and issues answered.
  - **It differs from Jon's.** It is persona-based (Global, Admins, Internals, ServiceAccounts,
    Guests, Agents), each policy has its own exclude group, and there is a break-glass group.
- **To settle when pinning:**
  - Six policies (CA002, CA100, CA105, CA201, CA400, CA501) carry a Microsoft built-in
    `templateId`. Against the owner rule, keep or leave out?
  - Joey's tenant id and object ids become placeholders before anything is committed (the
    tenant guard would refuse them anyway).
  - 31 policies are exported On, and his allowed countries default to BE/LU/NL. IAMAI's
    report-only-first rollout and its countries question already govern both.
- **Fallback:** Kenneth van Surksum's 2025.10 baseline. It has Graph JSON, report-only
  defaults and a third, category-based philosophy, but no licence, so it needs his written
  permission first.
- **Not a policy source:**
  - Claus Jespersen's framework is Microsoft-owned guidance, which fails the rule's spirit.
  - DCToolbox is unlicensed, unmaintained, and Jon's naming comes from it.
  - **CISA ScubaGear (CC0)** could later tag each step with the controls it meets
    ("meets MS.AAD.3.1"). Optional, and a check layer only.
  - CIS is CC BY-NC-SA, so it may only be cited by control number.

## Owner decisions
- [ ] **Jon's licence.** Jon's repository has no LICENSE file, so all rights are reserved
  unless he has said otherwise. The repo records no permission. Ask Jon for written permission
  or an MIT licence on his repository before v2.0 puts a second author beside him.
- [ ] The second baseline: Joey Verlinden (recommended).
- [ ] Joey's six template-derived policies: keep them as his curated choice, or leave them out.
- [ ] What switching baseline does to a tenant's plan: start fresh (the old plan saved to a
  plan file first), or keep one plan per tenant and baseline (an IndexedDB version change).
- [ ] Phase A on its own branch, off `v1.1`, so tomorrow's release is untouched.

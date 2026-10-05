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

Phase B, once a second baseline is chosen: pin it, item 7's content for its policies, and
item 6.

v3.0 builds on the same pieces:
- the registry and `annotations.json` become the format a person fills in;
- the upload path (`loadUploadedBaseline`, switched off on Connect today) reads it, together
  with an interpretation step for the person's own groups and locations.

## Other baselines: research only (owner, 2026-10-04)
Jon's baseline comes first; a second one is a later decision. Until then this is a list of
options, not a choice. `docs/plans/v2.0/baseline-options.md` holds the research: MVP and
community authors, licence, format, maintenance and philosophy.

## Owner decisions
- [x] **Jon's baseline:** used with his explicit permission; the owner holds the record (2026-09-08).
- [x] No second baseline chosen yet; research only (2026-10-04).
- [x] Phase A on its own branch, `v2.0-prep`, off `v1.1` (2026-10-04).
- [x] Switching baseline: keep one plan per tenant and baseline, one baseline deploying at a
  time (owner, 2026-10-04).

### Keeping both plans (proposal)
- **Tenant facts stay shared.** The Direction answers, emergency accounts, service accounts
  and office network describe the tenant, whichever baseline reads them.
- **Plan records are per baseline.** Skips, accepted deviations, observations, completion
  and source-reference answers are each keyed by the baseline they were made against.
- **No database version change.** The `plan` record stays keyed by tenant, and holds one
  plan per baseline inside it. A record in today's shape is read as Jon's.
- **One baseline deploys at a time.** Two baselines' creates would put overlapping policies
  in one tenant (two "MFA for everyone"), so the other plan is for comparing. The policy tag
  on what IAMAI creates carries the baseline, so neither plan claims the other's policies.

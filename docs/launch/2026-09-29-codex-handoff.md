# Hand-off to Codex, 2026-09-29

The owner asked for speed over checks on this run. `main` = `round-5` was deployed on
2026-09-29 before this audit, and the history was rewritten that day (ids below are the new ones). Base 89eb7a84 (CI green there before the rewrite).

## What changed (`git log 89eb7a84..HEAD`, merges left out)
- 29e91d9e Re-pin Jon Hope's baseline to 8af3b118 and settle the groups his README names:
  `baselines/jhope188-conditionalaccesspolicies.{pinned,index,interpretation}.json`,
  `data/first-party-apps.json` (+ Microsoft Rights Management Services 00000012-…),
  `docs/baselines/jhope188-conditionalaccesspolicies/8af3b118….md`.
- a2215d7c A workload-identity policy takes no exclusions group (Jon's EntraConnectIDSync):
  `src/roadmap/resolvePolicy.ts`.
- 2999b448 The not-in-plan footer reads the goal map in use, one reason per policy:
  `src/derive/notInPlan.ts`, `src/ui/surfaces/planData.ts`, `docs/design/content.json`.
- 4b4dc7c2 Require MFA for Guests builds exactly Jon's two guest policies:
  `src/roadmap/generate.ts`, `tracking.ts`, `types.ts`, `src/ui/surfaces/stepContract.ts`.
- 1fbbdda3 WindowsAzureAD-BaselineScopes enters the plan as Require Phishing-Resistant MFA
  for Basic Sign-ins (`s-goal-directory-baseline-scopes-mfa`): `data/goals.json`,
  `src/coverage/goalIdentity.ts`, `src/roadmap/constants.ts`, `generate.ts`, `holds`,
  `stepGroups.ts`, `docs/design/content.json`.
- a66ef419 Require MFA for Everyone matches Jon's AllUsers (compared and renamed, his Intune
  Enrollment pairing never held): `src/coverage/coverage.ts`, `src/derive/population.ts`,
  `src/roadmap/{cleanupPhase,generate,operations,tracking}.ts`, fixtures, `content.json`.
- 3cf60f51 Tests follow the guest step building both of Jon's guest policies (tests only).
- 189df280 Integration: a guest half already holding what its update writes is idle:
  `src/roadmap/generate.ts` plus tests.
- 58f77398 [snapshots] Step snapshots after the four merges.
- 99e6c209 [snapshots] 3.8 lists every policy the plan creates, including a create beside
  an update in a mixed step, and draws one card per created policy:
  `src/roadmap/reportOnlyBatch.ts` (`createdBodiesOf`, `batchable`, `batchMemberOf`),
  `src/ui/surfaces/reportOnlyStep.ts`, a stepGroups order test.

## Owner decisions this run follows (2026-09-29, binding)
- Match Jon Hope's baseline exactly; follow Jon over IAMAI's interpretations; exceptions
  only where necessary. No users yet, so breaking changes are fine.
- Require MFA for Everyone = Jon's AllUsers, including its Intune Enrollment and RMS
  exclusions. IAMAI's session-loop hold is removed.
- Guests = Jon's two policies (Mixed-Guests + B2B-Guest). The tenant's own guest policy is
  left as existing coverage and never edited.
- WindowsAzureAD-BaselineScopes is a step in Extend MFA, directly after Require MFA to
  Register a Device, created Report-only and gated on strength readiness.
- AVD AllowedAVDUsers stays hidden. Medium-Risk Users stays Jon's JSON (password change +
  strength).
- Every policy the plan creates is listed in 3.8 Create the Policies in Report-only; an
  in-place correction of an existing policy stays its own step's task (2026-09-26 rule).

## Plan order checked (getiamai fixture, owner-like)
Prepare ends with 3.7 Create the Policies in Report-only (3.8 where the service-accounts
group step is present); section 5 reads Protect Sign-in Method Registration, Require MFA to
Register a Device, Require Phishing-Resistant MFA for Basic Sign-ins, Require MFA for
Guests, Require MFA for Inforcer Access. MFA for Everyone stays 4.4. No misplacement found.

## NOT verified
No full suite, no browser smoke, no adversarial review, no CI. Audit first:
1. The 3.8 list for a real mixed guest step (tenant has Mixed-Guests, not B2B-Guest). No
   fixture builds one; the test fabricates it. Check the step's lifecycle once B2B-Guest is
   in Report-only (does the policy step open in its report-only week?), and that a held
   enforcing update beside the create does not hide the create (`policyResult` reads the
   step as a whole: `readiness-unmet` would drop the whole step from 3.8).
2. 3.8 cards are now one per created policy (keys `batch:<step>`, `batch:<step>#2`), but the
   rail milestone and `impactCount` still count steps. The tasks list is still per step, and
   a mixed step's task is its whole procedure (update + create).
3. The guest pair: completion, the partner answer, the tenant's own guest policy never edited.
4. MFA for Everyone: ownership, rename, the RMS/Intune exclusions after the re-pin.
5. BaselineScopes: the readiness gate and its portal route.
6. The getiamai fixture runs on a synthetic baseline: its guest create is named
   "IAC - GLOBAL - GRANT - MFA - AllUsers (2)". Check it is the synthetic package's name,
   not a wrong source pick.

## Tests run this step
`npm run verify -- src/roadmap/reportOnlyBatch.test.ts src/ui/surfaces/reportOnlyStep.test.ts
src/roadmap/stepGroups.test.ts src/testing/stepSnapshots.test.ts`: typecheck + 22 tests pass.

## Verify, then ship
- `npm run verify -- --release` (local full preflight), and/or `gh workflow run ci --ref round-5`.
- `main` is already live (fda21751 and later); fix on a branch and push `git push origin round-5:main`.
- Since then: fda21751 the create task points to the PowerShell or JSON tab for Windows Azure Active Directory (not in the portal picker); 5dc04a07 the identity test reads the owner's name from the Home bio; ecb545ad the project no longer denies force-push.

**Create early, turn on in order: how IAMAI gates policy creation today**

## Recommendation
The engine already works this way: once the two first sections are done, every policy that can be written is Ready · Create at the same time and dated for the same day. Only the Plan's drawn order makes it look sequential. Section position gates nothing.

- **v1.0:** say it in one sentence, inside the Plan how-to rewrite the flow proposal already schedules.
- **v1.1:** everything else — the combined create script, a Create tile, the certificate warning, and any change to the foundation gate.
- Do not relax the Emergency Access → Direction gate.

## 1. How creation is gated today (turn-on is gated separately)

**The foundation gate**
- Until Emergency Access and Direction are settled, every open policy step waits undated. The owner set this on 2026-09-19 (`src/roadmap/foundations.ts:6-10`, `85-128`).
- While Direction is open, the wait is a decision blocker on all policies (`foundations.ts:100-106`). Otherwise it is a step wait on the emergency member.
- Review rows, baseline conflicts and enforced policies are exempt (`foundations.ts:91-104`).

**Graph create edges** (`src/actionability/dependency-data.json`, 153 edges in total)
- There are 48 create edges. **None of them points from one policy to another.**
- 32 of them wait on objects:
  - exclusions group: 18
  - authentication strength: 8
  - trusted location: 3
  - device plan: 1
  - allowed-countries location: 1
  - service accounts group: 1
- The other 16 are 14 baseline mappings, 1 source conflict (admin portals) and 1 decision (workload identity).
- All ordering lives on the 87 enforce edges: security defaults off ×23, emergency accounts ×23, drill ×23, the MFA campaign ×7, and a few others.

**Evidence and readiness gate only enforcement**
- "an unstarted policy's create never waits on it" (`src/actionability/lanes.ts:14-17`). The lane goes to Ready · Create once no prerequisite is left (`lanes.ts:519-522`).
- A readiness hold keeps the report-only create on day 0 (`src/roadmap/stepSchedule.ts:139-143`, `165-168`). Owner decision 2026-09-11, restated at `src/ui/surfaces/rowWhen.ts:56`.

**Direction answers gate per policy**
- `GOAL_DEPENDS` (`src/roadmap/direction.ts:406-414`) ties legacy auth, device code, guests, countries, the service-accounts network policy, security-info registration and the device goals to specific answers.

**Section position gates nothing**
- "Membership is the whole of what an entry decides — nothing here says when a step is ready" (`src/roadmap/stepGroups.ts:115-117`). Lanes come from the engine, not from groups (`src/ui/surfaces/planLanes.ts:329-345`).

**The scheduler already dates every create on day 0**
- "Every policy in the plan is created in report-only on one day, together, and observation starts there" (`src/roadmap/schedule.ts:571-584`; assignment at `schedule.ts:660`).

## 2. getiamai (curated, Emergency Access settled, Direction approved)
Probes were run through `runFixture` and `boardReadingsOf`, then deleted. Nothing tracked was written.

- **14 policy steps: 13 are Ready · Create at once. 1 is Up Next.**
- The one waiting is `s-goal-geo-restriction`. It waits only on `s-prereq-allowed-countries`, which is itself Ready · Create. So the countries policy can be created in the same sitting as the location.
- Every Ready row's date column reads the same day (the plan start, Aug 31 in the fixture). The countries row reads blank.
- Turn-on order:
  - Sep 8: auth transfer, legacy auth, device code, unsupported platforms
  - Sep 15: admin session, session length, token protection
  - Six MFA and admin policies (MFA for all users, admin portals, admin phishing-resistant, guests, device registration, security-info registration) wait on the MFA campaign.
  - The whole plan is 3 weeks.
- **Before settling:** 15 policy steps, 0 Ready (10 wait on the break-glass step, 5 on Direction).
- **Emergency Access only:** all 15 wait on Direction, although 9 depend on no Direction answer.

Other fixtures, settled (Ready · Create out of policy steps):

| Fixture | Ready · Create |
|---|---|
| demo | 8/17 |
| demo-week2 | 5/17 |
| small | 8/15 |
| mid | 12/20 |
| large | 9/16 |
| midflight | 8/14 |
| messy | 0/14 (9 are Up Next behind the exclusions group, which the helper leaves uncorrected) |

Plan lengths are 3, 3, 3, 5, 12, 1 and 3 weeks.

## 3. Risks of creating everything early in report-only
The quote limits I work under allow one short quote, so the Microsoft points below are paraphrased, each with its URL.

- **Compliant-device policies prompt for certificates.** Report-only compliance checks can repeatedly ask macOS, iOS and Android users to pick a certificate. Microsoft says to "exclude the Mac, iOS, and Android device platforms from report-only policies" (https://learn.microsoft.com/en-us/entra/identity/conditional-access/concept-conditional-access-report-only).
  - **This happens today, whether or not we build anything.** On demo, `s-goal-require-managed-device` is Ready · Create, dated day 0, and scoped to all platforms with only android and iOS excluded. macOS stays in scope because of the phones answer (`src/roadmap/deviations.ts:66-80`).
  - The warning text exists as `shared.certificatePrompt` (`docs/design/content.json:98`), but no step renders it.
- **User Action policies collect nothing.** Report-only does not evaluate User Actions (same URL). So security-info registration and device registration gain no sign-in data from being created early. IAMAI already judges them on configuration (`src/roadmap/evidenceStrategy.ts:7-14`).
- **Log volume and retention.**
  - Log Analytics cost varies with tenant size and the number of policies. A sign-in event averages about 11.5 KB (https://learn.microsoft.com/entra/identity/monitoring-health/concept-log-monitoring-integration-options-considerations#cost-considerations). This only costs money if logs are streamed.
  - Entra keeps sign-ins for 30 days on P1/P2 (https://learn.microsoft.com/entra/identity/monitoring-health/reference-reports-data-retention). Creating more than about 30 days before turn-on buys nothing in Entra's own log.
  - IAMAI's window is 7 days (`src/roadmap/constants.ts:50`).
- **Objects that don't exist yet.** Microsoft's countries procedure creates the named location first, then selects it in the policy (https://learn.microsoft.com/en-us/entra/identity/conditional-access/policy-block-by-location). IAMAI writes object ids into policy bodies, and the 32 object create edges above already enforce this.
- **Direction answers change scope, and a correction throws away the early data.**
  - Five goals exclude `{serviceAccountsGroup}` (`data/goals.json:471`, `683`, `912`, `1289`, `1428`): legacy auth, countries, managed device, Azure management and token protection. `GOAL_DEPENDS` lists that dependency for none of them.
  - A change to scope or grant is material and restarts the report-only window. Only cosmetic fields are ignored (`src/roadmap/observation.ts:230`, `246-253`).
  - So a policy created before Direction and corrected afterwards loses its early evidence. That is the real case for keeping the owner's whole-Direction gate.
- **Policy limit.** Microsoft caps a tenant at 240 policies, and report-only counts (https://learn.microsoft.com/entra/identity/users/directory-service-limits-restrictions). IAMAI adds 14–20. `src/` has no check against the cap. The risk is only near-cap tenants; the huge fixture has 120 existing policies.
- **Precedent in favour.** Microsoft-managed policies arrive in report-only and are turned on at least 30 days later (https://learn.microsoft.com/entra/identity/conditional-access/managed-policies#how-microsoft-managed-policies-work).

## 4. A "create every Ready policy" script bundle
**It does not exist.** The Export page says machine artifacts are per step (`src/ui/surfaces/Export.tsx:284-286`).

**It is feasible, but not cheap.** On getiamai, the 13 Ready · Create PowerShell tabs have these properties:
- 12 set `enabledForReportingButNotEnforced`.
- They come in two shapes: 10 are library `Invoke-IAMAIStep` scripts; admin portals and guests use the fallback `powershellFor` (`src/ui/surfaces/stepPowerShell.ts:14`).
- Session length (`s-goal-all-users-no-persistence`) only has a read-only inspection script. It cannot be bundled.
- Each script connects on its own.
- **The library Create mode POSTs without checking for an existing policy** (template in `src/content/implementation/registry.generated.json`). If the bundle stops halfway, which the scripts' `-ErrorAction Stop` makes likely, re-running it creates duplicates. The same happens with a bundle built from a stale scan.

Building it means: an Export card that runs `stepBodyOf` for each Ready · Create step; an idempotency check (GET by plan tag); a list of the portal-only steps; the redaction guard; and a PowerShell mock test like `src/content/implementation/pimCreateScript.test.ts`. **Estimate: 3–5 hours with tests. That is v1.1.**

## 5. What to present, what not to create early, and build times
**v1.0 (about 10 minutes of extra work)**
- The proposal's Stage 1 already rewrites `pages.plan.howTo` from "Start with Ready" to "start at the top of All work" (`docs/plans/roadmap-flow/v1-proposal-full.md:422` at fdc1ffcf, current text at `docs/design/content.json:859`).
- **That rewrite is exactly what would make section order read as a gate.** Put the create-early sentence in the same edit, for example: "When sections 1–2 are done, create every Ready · Create policy in report-only that day; turning each on follows the sections and dates."
- On its own this is a content edit plus one test: 20–30 minutes including verify. But the how-to sits behind a collapsed toggle (`src/ui/surfaces/Plan.tsx:397-405`).

**v1.1**
- A visible "N ready to create in report-only" tile or line: 45–90 minutes with tests.
- The script bundle: 3–5 hours.
- Wiring `shared.certificatePrompt` onto the managed-device step: 30–60 minutes, because that step is package-driven.
  - The certificate prompt already reaches users today. This needs your decision: note only, or hold that create until enrolment.
  - Excluding Mac during report-only and adding it back at turn-on would restart the window, so it is not a fix.

**Do not create early**
- Anything before Emergency Access is settled, because 18 policies need the exclusions group id. The engine already holds these.
- Anything before Direction is approved (scope, the service-accounts exclusions, and window resets). Already held.
- The countries policy before a work country is saved and the location exists. That is minutes of work, not a section barrier.
- Require a compliant device while Macs are unenrolled.
- User Action policies can be created any time, but "for the sign-in data" does not apply to them.

**Relaxing the foundation gate to per-answer** would free 9 of 15 getiamai creates during Direction. It contradicts the 2026-09-19 decision and misses the service-accounts exclusions above. Not for v1.0.

Probes were deleted and the worktree `C:\Dev\IAMAI-q-flow` is clean. No full suite, smoke or walk was run.
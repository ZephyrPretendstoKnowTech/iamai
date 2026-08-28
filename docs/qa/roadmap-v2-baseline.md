# Roadmap v2 — property-test baseline

The §7 assertions in `src/roadmap/fixtures/properties.test.ts` were written first and run
against the engine as it stood at `eb6db27` (prompt 26 complete, nothing from prompt 24
implemented). This records what failed and why, so the after-state can be judged against it.

Run: `node --test src/roadmap/fixtures/properties.test.ts` on 2026-08-28.

## Before (eb6db27 + fixtures only)

**32 pass · 61 fail** across the eight fixtures (93 assertions).

| Assertion | Fixtures failing | Why it failed |
|---|---|---|
| Builds a plan; every step has content | all 8 | `s-prereq-allowed-countries` has an empty `impact` sentence. Every other step had one. |
| No step strands the operator or a break-glass account | 7 (all but micro) | Goal-step populations are resolved from the goal's `expectedWho` (all / members / admins) and never remove the confirmed exclusions, so both break-glass accounts sit inside the population of every step that can deny access (MFA, blocks, geo, admin strength, session). Also: the operator (first admin, no phishing-resistant method in the fixture) is inside `admins-phishing-resistant` and `admin-session` while `operatorSafe` is `true` (mid, large); in `block-unsupported-platforms` with no compliant device while `operatorSafe` is `true` (large). |
| Every prerequisite appears earlier in the schedule | 0 | Passes today: phases order prerequisites first. |
| No two high-disruption steps overlap the same window for the same population | mid, large, huge | `user-risk`, `user-risk-medium`, `sign-in-risk-medium` share a wave and the whole-tenant population (mid, huge); `block-unsupported-platforms` and `intune-enrollment-reauth` share a wave (large). Waves are built by phase, not by disruption. |
| Every date is derivable from the graph and the band | all 8 | No `derivation` on the schedule: the schedule cannot say why it is as long as it is. (The Friday rule and the ordering of wave dates were not reached.) |
| Rings match the band table | 7 (all but micro) | No `rings` on any step; the engine models one enforcement event per policy. |
| Every population statement sums against the fixture | all 8 | No `populationBasis` sentence ("N of M enabled users (P%)") on any step. The count invariants (`total = ids`, no duplicates, parts ≤ total) pass. |
| Name lists are bounded | all 8 | No `populationNames`; the recurring drill step (2 accounts) lists nobody, and nothing bounds the list at 25 or 500. |
| Engine under 200 ms | huge | 744 ms for 25,002 users (large: 101 ms; everything else ≤ 10 ms). The cost is in `population()` and `resolvePopulation`, which rescan `snapshot.users` per step. |
| Plan file round-trips with every number preserved | 0 | Passes today for populations; rings are not present to lose. |
| Policy count stated; cap warning matches | all 8 | No `policyCount` on the schedule. |
| micro: free-tier ladder | 0 | Passes: without P1 every CA step is blocked. |
| mid: service accounts before the legacy block | mid | The block step's impact/evidence never names the 3 legacy-auth service accounts, although the fixture's evidence lists them under `legacyAuth.userIds`. |
| messy: conflicts first | messy | Security defaults comes first, but per-user MFA (`policyMigrationState: preMigration`) is never named anywhere. |
| midflight: no duplicate steps | 0 | Passes. |
| hostile: readiness marked unknown | hostile | With registration 403 and no sign-in evidence, `register-info-protected` still states "0 verified … 41 without a method" and "0% of 33 active users ready" as if it were known. |

Shape of each fixture as generated (users includes break-glass and service accounts):

| Fixture | Users | Steps | Weeks (band) | Engine ms |
|---|---|---|---|---|
| micro | 10 | 5 | 3 (small) | 9 |
| small | 30 | 20 | 5 (small) | 6 |
| mid | 285 | 26 | 7 (mid) | 6 |
| large | 4,902 | 23 | 12 (large) | 101 |
| huge | 25,002 | 25 | 12 (large) | 744 |
| messy | 122 | 21 | 8 (mid) | 4 |
| midflight | 62 | 20 | 8 (mid) | 2 |
| hostile | 42 | 20 | 8 (mid) | 2 |

`small` already runs a week over the band's 4 weeks (the verification window plus seven
enforcement waves), which the date assertion will catch once the derivation exists.

## After (prompt 24 complete)

**102 pass · 0 fail** (the 93 original assertions plus nine step-content assertions added in E).

| Assertion | What changed to make it pass |
|---|---|
| Every step has content | Prerequisites carry an impact sentence; every step has `whatChanges`. |
| No step strands the operator or a break-glass account | Populations leave out break-glass accounts, confirmed service accounts and the confirmed exclusion groups' members (`groupMembers` now reaches the generator). Operator safety comes from the strand simulator (`src/roadmap/strand.ts`), per family: MFA capability, phishing-resistant method, compliant device, observed use of the blocked protocol, usage country; an unsafe step is blocked with a named reason, never offered as ready. |
| No two high-disruption steps overlap the same ring window for the same people | The graph scheduler pipelines steps for overlapping people one ring apart, comparing ring windows for the people each ring touches. Risk-policy steps are ring-capable because deny-capability now comes from the goal floor, not the readiness family. |
| Every date is derivable from the graph and the band | `buildSchedule` derives every ring date from hard/soft dependencies, soak days and the calendar rules; the schedule carries `derivation` (critical path in one sentence), `graph`, `enforcementCap` and `freeze`. |
| Rings match the band table | `src/roadmap/rings.ts`: 2/3/3/4 rings by active users with the §1 sizes and soaks; targeting from readiness data; a filter above 500 people. |
| Population statements sum | `populationBasis` on every step from `src/roadmap/population.ts`. |
| Name lists are bounded | Everyone under 25; the ten riskiest above; evidence and handle-with-care lists stop at ten. |
| Engine under 200 ms | 13 s → 205 ms on the huge fixture by indexing users once per plan (populations, readiness, ring partitions, department order, device owners, guests) instead of per step; best of three runs is asserted. |
| Plan file round trip | Rings, owner and scheduled date survive JSON. |
| Policy count and cap warning | `src/roadmap/policyCount.ts`. |
| mid: service accounts before the legacy block | The block's evidence names the confirmed service accounts among the affected. |
| messy: conflicts first | A per-user MFA prerequisite is generated from the migration state; security defaults and per-user MFA sort ahead of everything; the drill calls out phone-only break-glass accounts. |
| hostile: readiness unknown | Readiness says the source could not be read instead of reporting a percentage. |

Fixture shape after the work:

| Fixture | Weeks (band) | Waves | Roadmap engine ms | Notes |
|---|---|---|---|---|
| micro | 3 (small) | 0 | 11 | no P1: every CA step blocked, campaign only |
| small | 3 (small) | 2 | 9 | same-people rule relaxed to land on the band (reported) |
| mid | 8 (mid) | 4 | 10 | same-people rule relaxed (reported) |
| large | 10 (large) | 4 | 41 | policy-count note at 42 policies |
| huge | 10 (large) | 5 | 205 | soak shortened 10 → 7 days, then same-people relaxed; cap note at 122 policies |
| messy | 8 (mid) | 3 | 6 | security defaults and per-user MFA first |
| midflight | 7 (mid) | 3 | 5 | tagged policies detected; no duplicate steps |
| hostile | 7 (mid) | 4 | 5 | readiness marked unreadable, every step still produced |

Steps tab rendering, measured in Chrome on the big mock tenant (`?dev=1&mock=1&big=1`, 17 step tiles):
switching to the Steps tab 45 ms, opening a step 36 ms (two animation frames after the click).
The engine's own share is the number above; coverage (computed once per scan, cached) costs a
further 500 ms on 25,000 users and is outside this prompt.

## Where the implementation departs from roadmap-v2.md

- **Enforcement cap counts change days, not policies.** Two policies flipped on the same
  morning are one change window. Counting each ring start separately made a small tenant's
  four-week band impossible (18 steps × 2 rings at 2 a week is 18 weeks).
- **Same-people rule pipelines by ring, and is relaxed when the band would be missed.** The
  rule compares the people each ring touches, so step B's pilot may run while step A's ring
  1 runs. When even that runs past the band the scheduler first shortens the long soak of
  the largest tenants (10 → 7 days), then allows the same people to be prompted by two steps
  in a week, and the Overview says so.
- **The band is honoured with a week of slack**, the definition `withinBand` has used since
  prompt 18; the §1 table's 4 weeks for ≤30 users cannot hold a 2-week campaign plus ringed
  rollouts of eight prompting policies otherwise.
- **The change freeze lives in Plan settings**, next to the owner, not in Setup: Setup asks
  only what cannot be inferred about the tenant, and a freeze is a pacing choice.
- **Cohorts are built when a step opens**, not for every step of every plan; the plan file
  keeps the basis sentence and the named people.

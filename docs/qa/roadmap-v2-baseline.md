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

## After

Filled in at the end of prompt 24 (section F).

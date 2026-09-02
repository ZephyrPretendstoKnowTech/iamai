# Synthetic tenant fixtures

`src/roadmap/fixtures/index.ts` builds the eight tenants roadmap-v2.md §7 describes. Each
is generated, never stored: a `Spec` (size, licence, policy count, quirks) goes through a
seeded builder and comes out as a `Fixture` — a `TenantSnapshot`, a synthetic
`BaselinePackage`, Setup answers (`MappingState`), cached group memberships, the plan id,
the operator's id, and the expectations the §7 table sets for that shape.

## Why generated

- Deterministic: the seed is the fixture name, so `buildFixture` returns the same tenant on
  every run and every machine. A failing assertion names the same step every time.
- Small in the repo: 25,000 users cost a spec line, not a 40 MB JSON file.
- Free of real identifiers: every GUID comes from a hash of the seed and an index, every
  name from two short word lists, every UPN from `<fixture>.example.com`. Nothing here was
  ever in a tenant, so nothing here can leak one.

## The builder

`buildFixture(spec)`:

1. **People.** `users` members with the first `admins` holding Global Administrator, about
   5% guests, a `department` from a fixed list (the first three admins are always IT so a
   ring can find them), sign-in recency skewed 85/15 between recent and dormant, and
   registered methods in four tiers (none 12%, SMS 13%, Authenticator 60%, Authenticator +
   passkey 15%). Two break-glass accounts (FIDO2, or SMS-only when `breakGlassSmsOnly`) and
   optional `svc-mailer-N` service accounts that only ever use IMAP4.
2. **Evidence.** Sign-in evidence for everyone active in the last 30 days, with a recent MFA
   success for about two thirds of them; legacy-auth usage attributed to the service
   accounts; a single app in the sign-in summary. `hostile` drops every evidence source and
   marks registration and devices as 403.
3. **Config.** Conditional Access policies drawn from six templates (MFA for all, legacy
   block, device-code block, admin phishing-resistant, guest MFA, compliant device), with
   disabled and report-only extras for `messy`; one trusted named location; the built-in
   phishing-resistant strength; the authentication methods policy (`preMigration` when
   per-user MFA is still on); security defaults; role assignments; subscribed SKUs matching
   the licence; an organisation row.
4. **Devices.** For a share of members (`intuneShare`, default 60%): two thirds compliant,
   hybrid-joined every other one when `hybrid`.
5. **Setup answers.** Break-glass ids, service-account ids, allowed countries, the display
   time zone, the exclusion group resolved as `Core - Exclusions`, and every wizard question
   marked answered.
6. **Groups.** The break-glass group and the exclusion group with their members (400 extra
   members when `exclusionGroupSize` says so).

`midflight` tags its policies with `[IAMAI:plan-midflight:<stepId>]` for the step each goal
would produce, with one of them (`block-device-code`) later disabled, so progress detection
and regression handling have something real to find.

`syntheticBaseline(seed)` returns eight baseline policies, one per catalogue family (MFA
all, legacy block, device code, admin strength, guest MFA, compliant device, country block,
session), plus the group and named-location references and a high-confidence exclusion
signature — enough for every family to produce a step without shipping anyone's policies.

## Running one

```ts
import { fixture } from './src/roadmap/fixtures/index.ts'
import { runFixture } from './src/roadmap/fixtures/run.ts'
const { steps, schedule, ms } = runFixture(fixture('mid'))
```

`runFixture` wires coverage, viability, questions, names and the roadmap generator exactly
as the Roadmap page does, then annotates state reasons and applies progress, and reports
the engine time.

## Expectations per fixture

| Fixture | rings | weeks ≤ | names listed | policy-cap warning |
|---|---|---|---|---|
| micro | 1 | 4 | yes | no |
| small | 2 | 4 | yes | no |
| mid | 3 | 8 | no | no |
| large | 4 | 12 | no | yes |
| huge | 4 | 12 | no | yes |
| messy | 3 | 8 | no | no |
| midflight | 3 | 8 | no | no |
| hostile | 3 | 8 | no | no |

The property tests live in `src/roadmap/fixtures/properties.test.ts`; their first run is
recorded in `docs/qa/roadmap-v2-baseline.md`.

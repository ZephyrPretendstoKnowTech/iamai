# IAMAI — Specification (v0.1, 2026-08-25)

Read-only, browser-only Microsoft Entra Conditional Access **rollout planner**.
It does not report "what's wrong" for its own sake; it produces the journey from a
tenant's current state to a chosen baseline without lockouts.

## 1. Positioning

- Sibling to Jon Hope's CA Policy Analyzer (https://jhope188.github.io/ca-policy-analyzer/),
  not a competitor. His tool scores posture and lists missing template policies.
  IAMAI starts where that stops: intent coverage, reference resolution with
  validation, predicted impact from sign-in history, and a phased roadmap.
- The unit of value is the **plan**: ordered steps, each with prerequisites,
  affected population, how-to, pilot, report-only exit criteria, rollback, comms.
- Language rule: "predicted impact, confirmed in report-only." Never "guaranteed no lockout."

## 2. Hard decisions (do not relitigate without Lachlan)

| Decision | Value |
|---|---|
| Write access | **None.** Read-only delegated Graph, forever in v1. No policy creation, no report-only creation. |
| Runtime | Static SPA. No server, no telemetry, no CDN dependencies (bundle everything). "Review the code, then connect." |
| Consent | **One** admin-consent screen with the full read scope set. No staged consent, no opt-out checkbox. |
| Baseline v1 | Jon Hope's repo `Jhope188/ConditionalAccessPolicies` as the shipped default, loaded live from GitHub at a pinned commit. Upload of a package is the second path. Custom repo URL later. |
| Diff priority | 1) actual security gaps (intent coverage, exclusion-aware) 2) naming/organization as a secondary report. |
| Output | In-browser roadmap. Print → PDF via a dedicated print document. "Save plan" writes a JSON plan file (v1) that re-imports, carrying Setup answers, pace and start date; the self-contained HTML wrapper is planned. |
| Persistence | None server-side. Plan file + IndexedDB cache. |
| Old project | `ZephyrPretendstoKnowTech/iamai` (installer-based) is being retired: salvage, then make private. Nothing from it is a dependency here. |

## 3. Flow

The flow, the surfaces and their maximum are defined in `docs/design/target-state.md`
(Connect → Today → Plan → a step; assumptions detected at scan time and edited on the Plan;
nothing asked before the plan exists) and measured by `docs/qa/page-contracts.json`.
Neither file is edited to make a violation pass. The engine rules the flow rests on are in
the same document: one denominator (§8.1), one verdict (§8.2), the schedule rules (§9).
The mechanics below this heading — baseline sources, MSAL, intent coverage, replay,
re-scan — remain as decided in §2 and §4–§12.

## 4. Graph scopes (delegated, read-only) and gates

`Policy.Read.All Directory.Read.All AuditLog.Read.All RoleManagement.Read.Directory UserAuthenticationMethod.Read.All Reports.Read.All openid profile offline_access`

The table below is **generated from the collector registry**
(`src/graph/collect/registry.ts`) by `node scripts/spec-scopes.ts` — edit the
registry, then regenerate; do not hand-edit rows. **Least role** is the
lowest-privilege Entra role that grants the scope for a delegated read
(`src/graph/collect/roles.ts`); a delegated call succeeds only where the
consent and the signed-in account's role agree, so consent alone is never
enough. Global Reader grants every row and writes nothing, which makes it the
single ask; a 403 names the role rather than repeating Graph's wording. Lanes are defined in
`docs/design/collection.md` §2 (0 = config on every load, A = aggregates,
B = sign-in evidence, on-demand = after baseline selection).

| Lane | Need | Endpoint | API | Scopes | Least role | Gate |
|---|---|---|---|---|---|---|
| 0 | The tenant policy set the diff and roadmap work from; Microsoft-managed policies are flagged. | `/identity/conditionalAccess/policies` | v1.0 | Policy.Read.All | Security Reader | none |
| 0 | Trusted-location validation and location-based intents. | `/identity/conditionalAccess/namedLocations` | v1.0 | Policy.Read.All | Security Reader | none |
| 0 | Resolve strength references in policies, incl. custom strengths. | `/policies/authenticationStrengthPolicies` | v1.0 | Policy.Read.All | Security Reader | none |
| 0 | Method availability, registrationEnforcement, policyMigrationState (read from beta when v1.0 returns none). | `/policies/authenticationMethodsPolicy` | v1.0 | Policy.Read.All | Security Reader | none |
| 0 | Whether security defaults are on (mutually exclusive with CA). | `/policies/identitySecurityDefaultsEnforcementPolicy` | v1.0 | Policy.Read.All | Security Reader | none |
| 0 | Guest/B2B posture affecting external-user intents. | `/policies/crossTenantAccessPolicy` | v1.0 | Policy.Read.All | Security Reader | none |
| 0 | Active admin roles per user for admin-targeting intents; role names for display. | `/roleManagement/directory/roleAssignments?$expand=roleDefinition($select=id,displayName)` | v1.0 | RoleManagement.Read.Directory | Global Reader | none |
| 0 | Eligible vs permanent roles; eligible is out of CA role scope until activated. | `/roleManagement/directory/roleEligibilitySchedules` | v1.0 | RoleManagement.Read.Directory | Global Reader | Entra ID P2 |
| 0 | Tenant licence capabilities and seat coverage. | `/subscribedSkus` | v1.0 | Directory.Read.All | Directory Readers | none |
| 0 | Tenant name and verified domains for the plan-file header. | `/organization` | v1.0 | Directory.Read.All | Directory Readers | none |
| 0 | Operator identity recorded in the plan file. | `/me` | v1.0 | Directory.Read.All | Directory Readers | none |
| 0 | Warn when the operator sits inside groups a plan step targets. | `/me/memberOf` | v1.0 | Directory.Read.All | Directory Readers | none |
| A | Per-user registered method types (no phone numbers) for MFA viability. | `/reports/authenticationMethods/userRegistrationDetails` | v1.0 | AuditLog.Read.All | Reports Reader | Entra ID P1/P2 |
| A | User inventory with activity, licence plans, and org attributes. | `/users` | v1.0 | Directory.Read.All AuditLog.Read.All | Directory Readers + Reports Reader | signInActivity needs Entra ID P1/P2 (degrades to a plain user list) |
| A | Compliance/trust state with registered owners for device intents. | `/devices` | v1.0 | Directory.Read.All | Directory Readers | none |
| A | Workload identity usage for later phases. | `/reports/servicePrincipalSignInActivities` | beta | Reports.Read.All | Reports Reader | attempt and map the 403 (documented scope: Reports.Read.All) |
| A | Registered method detail (values stripped; never phone numbers). | `/users/{id}/authentication/methods ($batch of 20)` | v1.0 | UserAuthenticationMethod.Read.All | Global Reader | inner 403 marks that user unknown |
| A | Aggregated per-app usage for app-scoping decisions. | `/reports/applicationSignInDetailedSummary` | beta | Reports.Read.All | Reports Reader | attempt and map the 403 |
| B | Interactive sign-in evidence for the replay engine and MFA verification. | `/auditLogs/signIns` | beta | AuditLog.Read.All | Reports Reader | Entra ID P1/P2; only the preview endpoint returns the fields needed; read newest-first and cut off in the browser |
| on-demand | Group name, dynamic rule, affected-population counts and exclusion-group sanity checks. | `/groups/{id} ($select=id,displayName,membershipRule) + /groups/{id}/transitiveMembers (+ $count)` | v1.0 | Directory.Read.All | Directory Readers | runs only for groups the chosen baseline references; count-and-sample above 20k |
| on-demand | Find the tenant group a baseline reference maps to. | `/groups?$filter=startswith(displayName,â€¦)` | v1.0 | Directory.Read.All | Directory Readers | runs only while the operator types in a Setup picker |
| on-demand | Show display names instead of raw identifiers, everywhere. | `/directoryObjects/getByIds` | v1.0 | Directory.Read.All | Directory Readers | runs only for ids the UI would otherwise show raw |

Planned but not yet in the registry: CA templates (beta), What If
(`/identity/conditionalAccess/evaluate`), `/servicePrincipals` (under
`Directory.Read.All`, which is already consented), and device-code /
auth-transfer detection via beta sign-in fields (`authenticationProtocol`,
`originalTransferMethod`) — each gets a registry row when its collector lands.

Not requested in v1: Intune scopes (Entra device objects suffice), `Agreement.Read.All` (add only if a baseline references Terms of Use), `Application.Read.All` (removed 2026-08-30, prompt 46 item 23: nothing called it and the service-principal inventory does not need it — docs/design/application-read-decision.md; tenants that consented earlier keep a stale grant until an admin reviews it, and the app registration's configured permissions should drop it too). `UserAuthenticationMethod.Read.All` was originally excluded (phone numbers) but added 2026-08-26 by Lachlan's decision; tenants consented before that date will see one incremental consent prompt.

Degradation rule: a 403 or licence error disables a **section** with a plain reason; it never fails the scan.

## 5. Known limits (product copy must reflect these)

- The replay engine approximates Microsoft's evaluation (resource mapping, FOCI, PRT state, device filters, CAE are not reproduced). Report-only is the truth source.
- No P1 → no impact analysis; the roadmap for that tenant is "licence + security defaults → CA."
- Sign-in history shows behaviour under current policy; it cannot see who would register MFA when prompted.
- No server → no scheduled re-scans, alerts, or cross-device state.
- SPA refresh tokens live 24h; MSAL then attempts silent iframe SSO (fails under third-party-cookie blocking) and falls back to redirect. The plan file must never depend on the session.

## 6. Baseline adapter (built — `src/baseline/`)

Pure, synchronous, no DOM/network. Proven against Jon's repo at commit `ceccdc2` (155 files → 46 usable policies, 2 unusable, 1 variant pair, 36 author Intent docs) both from a local clone and via live raw fetch (155 files in ~2 s).

What it does, in order:
1. **Discovery** — skip `Test/` folders; parse leniently (BOM, arrays, Graph `value` envelopes, per-file errors); precedence `Updated/Policies` > `Updated/Documentation` > `Policies|CA|root` > other.
2. **Normalize** — PascalCase Graph PowerShell SDK dumps and camelCase REST exports → Graph v1.0 camelCase; drop `@odata.*`, `AdditionalProperties`, expanded nulls, empty objects; keep empty arrays.
3. **Dedupe** — by policy id, then by display name, then **generation fallback**: the newest generation (`Updated/`) is authoritative; an older generation contributes only families (name minus tenant tag and parentheticals) and intents the newest lacks. This is what "Updated + fallback" means.
4. **Warnings** — policies that target nothing (e.g. agent-identity policies exported by an SDK that dropped the conditions) are kept but flagged unusable.
5. **References** — every identifier with kind, portability (`stable` roles/built-in strengths; `verify` first-party app IDs whose SP may be missing; `tenantSpecific` groups/users/locations/custom strengths/SPs), and uses. Non-GUID tokens (e.g. `CA-GlobalExclusions-GroupId-ReplaceMe`) are surfaced as named placeholders.
6. **Group signatures** — role inferred from usage (global exclusion, broad exclusion, service accounts, device exclusion, location exception, admin persona, passkey pilot, app persona) with confidence and evidence text for the questionnaire.
7. **Variants** — same-intent policies (ignoring exclusions and which locations) are grouped as "choose one"; identical bodies as duplicates.
8. **Docs** — `## Intent` sections from per-policy READMEs, matched to policies by name.

Source `state` is the author's lab state. Consumers treat every baseline policy as **intended enforced** unless a manifest says otherwise.

Findings about the default source to hand to Jon when ready: one file with a JSON syntax error; agent-identity policies exported without conditions; two custom auth strengths with no `allowedCombinations`; named locations and group names absent. Three exports would make the repo self-sufficient: `namedLocations.json`, `authenticationStrengths.json`, `lookup.json` (id → displayName/type). The repo has no LICENSE file: fetch live, do not bundle policy content, and get his okay before quoting Intent text in the UI.

## 7. Package format (upload path) — "what is sufficient"

- Required: `conditionalAccessPolicy` JSON (v1.0 or beta, any casing, any state), one per file or an array.
- Recommended: `namedLocations.json` and authentication strengths JSON (read today).
- Planned, not yet read by the app: `lookup.json` (id → displayName/type), `manifest.json` (placeholder roles, variant sets, phases, author/version), the package validator, and "Export as baseline package".
- Every baseline source must supply the About fields (`author`, `authorUrl`, `repoUrl`, `description`, `goal`, `tiers` on its index/manifest); sources without them show "no description provided".
- Best path: connect a reference tenant with the same read-only flow → "Export as baseline package" (emits lookup + manifest). How-to page lists the Graph/PowerShell one-liners for manual exports and the accepted tool outputs (idPowerToys, CA Policy Copier, DCToolbox, CIPP templates, Jon's/Kenneth's/Joey's repos).
- Vendor-specific and other unmatched baseline policies: a baseline policy no catalogue goal matches is never a goal, a finding or a step (prompt 46 item 14, target-state §5). It is listed as not assessed — the baseline's own policy name, its JSON, one reason — in the Plan footer's Housekeeping line, and nothing invents a title for it. The earlier ad-hoc goal path and its vendor detection (`data/vendor-apps.json`) are retired (2026-08-30).

## 8. Tool deployment

- Vite + TypeScript + React. `@azure/msal-browser` (auth-code + PKCE, redirect). Graph via fetch + `$batch`. Web Worker for the engine. IndexedDB (idb) cache. Print stylesheet. No CDN imports.
- Hosting: GitHub Pages first (public repo, same trust model as Jon's). Azure Static Web Apps if a custom domain needs it. Redirect URIs must match exactly (`http://localhost:5173` for dev, the prod URL).
- App registration in the **GetIAMAI** tenant: multi-tenant (`AzureADMultipleOrgs`), SPA platform, scopes in §4, no secrets. Set publisher domain; pursue verified publisher (Partner Center / MPN ID) so consent doesn't show "unverified."
- CI: build + deploy, CodeQL, pinned deps, versioned releases carrying the plan-file schema version.
- Test tenants: GetIAMAI (P1/P2/Intune present) plus one large tenant for the sign-in sizing spike.

## 9. Week-1 spikes (find out now, not halfway)

1. Sign-in pull from the browser: page size, `$select` support, filter operators, throttling, wall-clock on a real tenant.
2. Which needed fields are beta-only; whether v1.0 alone is viable.
3. Device → owner join at scale (`/devices?$expand=registeredOwners` vs `$batch`).
4. What If from a delegated SPA token, including report-only policies in results.
5. `/identity/conditionalAccess/templates` (beta) as a secondary default.
6. GDAP partner sign-in through the SPA.
7. Verified-publisher lead time.

## 10. Repo layout (target)

```
src/baseline/        adapter (done)         src/graph/    MSAL + Graph client + batch
src/coverage/        policy → goals (intents.md)   src/roadmap/  steps, waves, print   (sign-in replay engine / What If: not built)
src/mapping/         reference resolution   src/roadmap/  phases, steps, plan file
src/scoring/         MFA viability (done)   src/licensing/ capability derivation
src/ui/              React                  baselines/    pinned indexes (paths only)
scripts/             analyze-local, build-index, spec-scopes, refresh-first-party-apps
data/                first-party apps, service plans, licence catalog
```

Design documents: `docs/design/collection.md` (collection service, §10 MFA
viability scoring), `docs/design/plan-file.md` (plan file schema and
checkpoints), `docs/design/diagnostics.md` (redacted diagnostics bundle),
`docs/design/intents.md` (policy → intent compilation and coverage),
`docs/design/roadmap.md` (step generation, gating, and plan progress),
`docs/design/ux-review-01.md` (UX review and binding UX rules),
`docs/design/ux-review-02-live.md` (live UX review; prompt 13 fixes).
Spike findings: `docs/spikes/01-signin-logs.md`. Request history:
`docs/prompts/`.

## 11. Roadmap-stage features (deferred, data already collected)

Each feature names the snapshot/checkpoint field it depends on — all of which
the collection service and plan file already carry, so these are UI/logic
work only, no new Graph reads.

| Feature | What it does | Depends on |
|---|---|---|
| Change record (built: Export tab, Markdown and CSV) | A record of what changed and when, generated from the activity log: useful for a client update or the operator's own notes; never a change-board form | `Step` + `Checkpoint.tenantPolicies[].laneB` result counts + Lane B per-policy affected user ids |
| Pilot cohort builder | Proposes a pilot group: active, MFA state Verified or Likely viable, spread across departments, exactly one admin, never a break-glass account; outputs UPNs | §10 per-user table (`activity`, `mfa`, `isAdmin`), `UserRow.department`, break-glass mapping ids |
| Drift and exclusion-creep detection | Diffs consecutive checkpoints: policy state changes, exclusion-group member-count growth, coverage regressions | `Checkpoint.tenantPolicies`, `Checkpoint.exclusionGroups`, `Checkpoint.coverage` |
| Microsoft-managed auto-enable dates | Places Microsoft's announced auto-enable dates for Microsoft-managed policies on the roadmap timeline | `TenantSnapshot.microsoftManagedPolicyIds` + policy `state` |
| Recurring break-glass drill step — **built** (`s-recurring-break-glass-drill`, 90-day interval) | Inserts a recurring "test break-glass sign-in" step when the accounts' last sign-in is older than the drill interval | `Checkpoint.breakGlass[].lastSignIn` |

## 11b. Adjacent value (planned, comms-and-bridges.md §3)

Built in prompt 29: the post-enforcement watch (§3.1), the calendar export with the runbook in
the invite body (§3.3), and the effort and call-volume estimate (§3.4). Planned, in the
order of value per unit of work:

| Feature | One line |
|---|---|
| Client-facing report | A brandable HTML export written for the client: found, doing, when, what they must do, progress. No JSON, no portal paths. |
| Break-glass drill procedure | A dated, printable procedure for the recurring drill: who tests, from where, what to verify, where the credential is sealed. |
| Baseline update watch | On load, compare the pinned commit with the source's latest and show the diff; adopting an update is a deliberate act. |
| Offline after scan | Verify and state that everything after the scan works with no network. |
| Plain-language check on comms | A readability measure on every announcement, flagging sentences above about grade 9. |
| Multi-language comms | The short, structured templates in the two or three languages a client base needs. |

The approval sheet is not planned: see 11a.

## 11a. Enterprise tier (deferred)

The user IAMAI is for is one person doing IAM with no change process and nobody to approve
anything (docs/prompts/30-simplify-solo-operator.md). Anything that asks them to govern,
assign or maintain state waits for an enterprise tier:

| Feature | Rationale |
|---|---|
| Per-step owner and approver fields | Reserved in the plan schema (`Step.owner`, unused); a solo operator is the owner of everything, so the field is only friction. |
| Approval sheet (printable sign-off page) | Needs a client or a board that signs; the solo operator has neither. |
| Change-board framing of the change record | The record stays a plain log of what changed and when. |
| Communications plan as a commitment table | Presented as "what will be sent and when, ready to copy", never as a client agreement. |

## 11c. Validation rule set (built — `src/validation/`)

Every object the plan depends on is checked in one registry
(`src/validation/rules.ts`), never inline per question: the break-glass set was
incomplete twice and regressed silently once, which is what the registry
prevents. A rule has a stable id, a subject, a severity, the snapshot data it
needs, and one test each for pass, fail and unknown.

- `unknown` is first class. A rule whose data was not collected (no licence, a
  403, a group over the member cap) says so instead of passing silently, and
  **an unknown on a must-fix rule holds the plan exactly as a failure does**.
- **Must fix** holds every step that can deny access, for the two subjects a
  recovery depends on (emergency access, the exclusions group), and generates a
  Phase 0 step ordered before everything else, holding each blocker as a
  checklist with its portal path and what clears it. **Recommended** never
  blocks; where a subject has recommendations and no blockers they attach to the
  step that already covers the same object. **Notes** are informational.
- Subjects: emergency access (10 must-fix, 8 recommended, 3 notes), the
  exclusions group, trusted named location, allowed countries, pilot group,
  service accounts, authentication strength.
- `bg.credentialStorage` and `bg.signInMonitoring` are the only checks a scan
  cannot answer; both are asked once alongside the emergency accounts in Setup
  and recorded in the plan file.
- `bg.notPersonal` reads department, job title, office and the signed-in
  operator. Manager is deliberately not collected: it would need an `$expand`
  on the `/users` page for every account in the tenant, which the other signals
  already cover.
- `loc.seenInSignIns` can only pass or report that it cannot tell: IAMAI keeps
  no addresses from sign-in records, so a stale range cannot be proved.
- The registry renders itself at `#/checks` ("Every check IAMAI runs"), which is
  both the documentation and the proof; `src/validation/rules.test.ts` asserts
  the full set of ids and severities by subject, so a refactor that drops or
  downgrades a rule fails the build.

## 12. Licensing principle

The tool **hardens what the tenant has**. Intents are security goals with
per-tier implementations (free / P1 / P2 / add-on); coverage is scored against
the **best implementation the tenant's licence allows**. Nothing is ever
locked, upsold, or marked "accepted risk" because of licence tier — a free
tenant gets a complete plan for a free tenant.

Mechanics:

- Tenant capabilities (`entraP1`, `entraP2`, `intune`, `workloadIdPremium`,
  `globalSecureAccess`, `defenderForCloudApps`, `purviewInsiderRisk`) derive
  from `subscribedSkus` service plans with enabled seat counts and consumed
  units (`data/service-plans.json`, refreshed by
  `scripts/refresh-service-plans.ts`; derivation in
  `src/licensing/capabilities.ts`, unit-tested against free / P1-only / P2 /
  mixed-seats / trial / disabled-plan fixtures).
- Per-user capabilities derive from `assignedPlans` entries with
  `capabilityStatus` Enabled — mixed tenants (fewer P2 seats than users) are
  first-class.
- Collectors consult capabilities **before** calling licence-gated endpoints
  and report "not available on this licence" as a section-disable; they never
  burn a request to discover a licence gap the SKU data already shows.
- Higher-tier implementations appear only in a separate **educational
  catalog** (the Licensing guide: goals from `data/goals.json` grouped by
  tier, each reference-only goal with the one line it would unlock, licence
  detection in `src/licensing/capabilities.ts`), never inline as "you can't
  have this".
- `data/free-tier-ladder.json` holds the curated ~10 free-tier hardening items
  (security defaults, per-user MFA states, legacy-auth app passwords, etc.),
  the plan spine for tenants with no paid Entra at all.
- Without `entraP1` the ladder **is the plan**: `src/roadmap/ladder.ts` turns
  each item into a phase 0 step in ladder order, with copy in
  `src/copy/ladder.ts`, a per-tenant impact from what a free licence can read
  (security defaults, the authentication methods policy, role assignments,
  guests, licence assignment), exact portal instructions, its own verification
  and rollback, and `ladder: true` so it is never described as groundwork for a
  policy. A rung reads Done only where the tenant proves it, and names that
  evidence; where Graph does not expose the setting (app passwords, per-user
  MFA state) the step says so rather than guessing. A phase 0 step that already
  covers a rung (break-glass, per-user MFA) takes the rung's place and its
  position.
- The same gate removes what only a policy would use: without Conditional
  Access, IAMAI never asks for an exclusion group, a trusted location or an
  allowed-countries location, and never asks for security defaults to be turned
  **off** (nothing could take their place).
- Dev override: `?dev=1&licence=free|p1|p2` simulates a licence profile for UI
  and gating tests; `?dev=1&denied=1` simulates a sign-in whose role Graph
  refuses, so the role advice on the Scan page can be walked.

## Testing decision: the smoke test mocks at the snapshot boundary

The CI smoke test (`scripts/smoke.mjs`, `?dev=1&mock=1`) loads the synthetic
tenant snapshot and baseline instead of answering raw Graph requests from a
fixture. Answering every collector endpoint with Graph-shaped JSON would mean a
second fixture format kept consistent with `src/ui/pages/fixtureSnapshot.ts`;
the walk, the numbers and the console check are the same either way. Revisit
only if the collectors change shape (deferred D6, decided 2026-08-28).

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
| Output | In-browser roadmap. Print → PDF via print stylesheet. "Save plan" = single self-contained HTML with embedded JSON state; the same file re-imports. |
| Persistence | None server-side. Plan file + IndexedDB cache. |
| Old project | `ZephyrPretendstoKnowTech/iamai` (installer-based) is being retired: salvage, then make private. Nothing from it is a dependency here. |

## 3. Flow

1. **Choose baseline** — default: Jon's repo (pinned SHA, live fetch, bundled index). Alt: upload package (folder/zip of Graph `conditionalAccessPolicy` JSON, any casing). Later: any public GitHub repo URL (same conventions as Jon's analyzer: root, `Policies/`, `policies/`, `CA/`, `Updated/` preferred).
2. **Connect tenant** — MSAL redirect flow, authority `organizations`, optional tenant-ID field (GDAP / guest scenarios). Admin consent creates an enterprise app in the customer tenant; removal = delete that enterprise app. Say so on the sign-in page.
3. **Resolve references** — three layers:
   - Declared roles the baseline expects (from manifest if present; otherwise inferred by usage signature — see §6).
   - Guided mapping with auto-suggestions: users excluded from most enabled policies → break-glass; groups named emergency/breakglass; named locations with `isTrusted`.
   - Validation of each pick. Break-glass: cloud-only, enabled, permanent GA (not eligible-only), excluded from every policy incl. report-only and Microsoft-managed, methods registered (FIDO2 good / SMS-only flag), last sign-in, not swept in by dynamic groups, ≥2 accounts. Passkey pilot group: FIDO2 method enabled+targeted, TAP enabled+targeted, Azure Credential Configuration Endpoint SP present. Trusted locations: no 0.0.0.0/0. Exclusion group membership sanity. Compliance pilot group: members have compliant devices.
   - Every "doesn't exist" answer becomes a Phase 0 step with a how-to. Mapping is stored in the plan file.
4. **Diff (intent coverage)** — compile each baseline policy to intents (scope + condition + control). Compute tenant coverage of each intent from the effective union of enabled policies minus exclusions, ignoring names. Per intent: enforced / partial (narrower scope, broad exclusions, report-only) / absent, with statements like "no policy named X, but Y + Z cover it, except group G (40 members) is excluded from both." Naming/consolidation report is separate. Count against the CA policy limit.
5. **Impact** — replay the last 7–30 days of interactive sign-ins against each missing/drifted policy in a Web Worker. Split findings: **hard blocks** (legacy auth, device code, geo, unsupported platform, no compliant device, phishing-resistant required with no capable method) vs **soft interruptions** (MFA registration, TAP needed). Session controls are reported as friction, not risk. What If (`POST /identity/conditionalAccess/evaluate`) is run for the consenting admin and break-glass accounts against the *existing* policy set every phase.
6. **Roadmap** — phases from dependencies: 0 prerequisites → foundation blocks → MFA → admin hardening → device → sessions/P2/workload. Each step: why, auto-checked prereqs, affected population with drill-down export, portal path + exact JSON in `enabledForReportingButNotEnforced`, pilot group, report-only exit criteria, rollback, user-comms template. Policies get a stable fingerprint (intent hash) so tracking survives renames.
7. **Re-scan** — cheap config scan on every load; sign-in replay cached with an "as of" timestamp, re-run on request or when stale. Reads `appliedConditionalAccessPolicies` results (`reportOnlyFailure`, `reportOnlyInterrupted`) to move each planned policy through planned → report-only observed → enforced.

## 4. Graph scopes (delegated, read-only) and gates

`Policy.Read.All Directory.Read.All Application.Read.All AuditLog.Read.All RoleManagement.Read.Directory UserAuthenticationMethod.Read.All Reports.Read.All openid profile offline_access`

| Need | Endpoint | Gate |
|---|---|---|
| CA policies, named locations, auth-methods policy, auth strengths, security defaults, cross-tenant access, CA templates (beta), What If | `/identity/conditionalAccess/*`, `/policies/*` | none |
| Users, groups (transitive counts), devices (`isCompliant`, `isManaged`, `trustType`), roles, `subscribedSkus`, service principals | `/users`, `/groups/{id}/transitiveMembers/$count`, `/devices`, `/roleManagement/directory/roleAssignments`, `/servicePrincipals` | none |
| Sign-in logs | `/auditLogs/signIns` | Entra ID **P1/P2** required; user must be Security Reader / Reports Reader / Global Reader / GA; 7–30 day retention; filters limited to eq/ge/le/startswith (no negation); pull interactive only, page through in a worker, cap by window/sampling for 10k+ users |
| MFA/passkey registration per user | `/reports/authenticationMethods/userRegistrationDetails` | P1/P2; gives method **types**, no phone numbers |
| Break-glass last used | `/users?$select=signInActivity` | P1/P2 |
| PIM eligible vs permanent | `/roleManagement/directory/roleEligibilitySchedules` | P2, Global Reader+ |
| Per-user registered auth methods (v1.0; response can include phone numbers — never persist them) | `/me/authentication/methods`, `/users/{id}/authentication/methods` | none; delegated needs admin consent |
| App sign-in summaries (aggregated usage reports) | `/reports/applicationSignInDetailedSummary`, `/reports/servicePrincipalSignInActivities` | **beta only**; `Reports.Read.All` (added 2026-08-26; SP activities responded without it once in spike 1 — do not rely on that) |
| SP sign-ins, device-code / auth-transfer detection | `signInEventTypes`, `authenticationProtocol`, `originalTransferMethod` | **beta only** — degrade cleanly per check |

Not requested in v1: Intune scopes (Entra device objects suffice), `Agreement.Read.All` (add only if a baseline references Terms of Use). `UserAuthenticationMethod.Read.All` was originally excluded (phone numbers) but added 2026-08-26 by Lachlan's decision; tenants consented before that date will see one incremental consent prompt.

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
- Strongly recommended: `namedLocations.json`; `lookup.json` (id → displayName/type for every referenced group/user/SP).
- Optional: `manifest.json` — placeholder roles, variant sets, phases, author/version.
- Validator: schema, unresolved references, licence-dependent controls, policy count.
- Best path: connect a reference tenant with the same read-only flow → "Export as baseline package" (emits lookup + manifest). How-to page lists the Graph/PowerShell one-liners for manual exports and the accepted tool outputs (idPowerToys, CA Policy Copier, DCToolbox, CIPP templates, Jon's/Kenneth's/Joey's repos).

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
src/intents/         policy → intents       src/engine/   sign-in replay (worker)
src/mapping/         reference resolution   src/roadmap/  phases, steps, plan file
src/ui/              React                  baselines/    pinned indexes (paths only)
scripts/             analyze-local, build-index
```

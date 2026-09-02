# Design: Graph collection service

**Status:** implemented (prompts 01–02, 10). Where this document and `src/graph/collect/` differ, the code is current: A2 selects 13 user fields; the collection states emitted are `normal | slow | done`; resume is newest-gap-first with no backward extension; the "extend collection" affordance is not built.
**Basis:** `docs/spikes/01-signin-logs.md` (findings referenced as F1–F9).

Named constants used throughout (single source of truth at implementation time):

| Constant | Value | Used for |
|---|---|---|
| `TIME_BUDGET_MS` | 600 000 (10 min) | Lane B wall-clock budget, retry waits included |
| `ROW_MEMORY_CEILING` | 50 000 | Lane B row cap — a **memory ceiling only**, not a quality target |
| `MIN_COVERAGE_HOURS` | 24 | below this, sign-in evidence is **insufficient**, not "partial" |
| `SLOW_THRESHOLD_MS` | 15 000 | entering the "Graph is slow" UX state |
| `PAGE_ABORT_MS` | 125 000 | Lane B per-page abort (Graph's own gateway 504s at ~120 s; F3) |
| `LANE_A_ABORT_MS` | 30 000 | per-request abort, Lanes 0/A |
| `LANE_A_CONCURRENCY` | 4 | Lanes 0/A |
| `LANE_B_CONCURRENCY` | 1 | Lane B is strictly serialized (F3) |
| `RETRY_MAX_429` | 4 | attempts per logical request |
| `RETRY_MAX_5XX` | 3 | attempts per logical request |
| `BACKOFF_BASE_MS` | 10 000 | 5xx exponential backoff base |
| `JITTER_FRACTION` | 0.2 | added to every retry wait |

## 1. Problem

One scan needs three kinds of data with very different service behaviour:

- **Config** — the CA policy set and its satellites. Cheap, needed by everything.
- **Aggregate tables** — registration details, users, devices, SP/app activity,
  per-user auth methods. Sub-second to low-seconds, reliable (F8).
- **Sign-in evidence** — the raw interactive sign-in window for the replay
  engine. Served by a store that is slow, throttled, and hostile to server-side
  filtering (F2, F3, F7); only unfiltered/lambda newest-first paging returned
  data reliably, and only on **beta**.

The service runs these as three lanes with different concurrency, retry, and UX
rules, so the sick endpoint can never make the healthy ones look broken.

## 2. Lanes and ordering

### Lane 0 — config reads (first, concurrency 4)

The cheap config scan SPEC §3.7 requires on every load: CA policies, named
locations, authentication strengths, auth-methods policy, security defaults,
cross-tenant access, **role assignments, PIM eligibility
(`roleEligibilitySchedules`, P2-gated — attempt and map the failure), and
`subscribedSkus`**. These unblock the diff engine and the UI shell; they run
before and independently of everything below.

**On-demand, not in any lane:** group transitive counts and service-principal
lookups run only after baseline selection, driven by the references the chosen
baseline actually uses — there is no point resolving groups for a baseline the
user hasn't picked.

### Lane A — aggregates (concurrency 4)

Run in parallel, rendering each section as its result lands:

| Order | Data | Endpoint | Notes |
|---|---|---|---|
| A1 | Registration details | v1.0 `/reports/authenticationMethods/userRegistrationDetails`, `$top=999` paged | 301 ms whole-tenant in spike (F8) |
| A2 | Users + signInActivity | v1.0 `/users?$select=id,userType,usageLocation,signInActivity&$top=999` paged | pages stream into A5 |
| A3 | Devices | v1.0 `/devices` with `$expand=registeredOwners($select=id)` paged | device→owner join in one pass — spiked 2026-08-26: 200 in 187 ms, owner expanded (1-device tenant; page-size clamp untested, §13) |
| A4 | SP activity | beta `/reports/servicePrincipalSignInActivities` | **attempt the call**; a 403 maps to `section-disabled` with the scope Graph names (F9). No scope pre-check — it once answered without `Reports.Read.All`, and Graph's own 403 is fast and precise |
| A5 | Auth methods | v1.0 `$batch`, 20 `/users/{id}/authentication/methods` per call | **streams**: a batch is dispatched per A2 page as it arrives, not after A2 completes. An inner-batch 403 marks that **user's methods "unknown"** — it never fails the section (12/12 inner 200s in spike, F8, but guests/roles may differ) |
| A6 | App sign-in summary | beta `/reports/applicationSignInDetailedSummary` | 78 rows in 2.2 s once `Reports.Read.All` present (F9); same rule as A4 — attempt and map the 403, no pre-check |

Lane A has no dependency on Lane B. Fully rendered aggregates with sign-in
evidence still loading is the *expected* intermediate state.

### Lane B — sign-in evidence (concurrency 1, strictly serialized)

All calls go to **beta** `/auditLogs/signIns` (see §7). One strategy, no probe:

1. Unfiltered newest-first paging with the
   `signInEventTypes/any(t: t eq 'interactiveUser')` lambda — the only filter
   that has ever returned data (F7) — `$top=200` (honoured exactly, F5), with
   **no `$select`**: `mfaDetail` and `authenticationDetails` are rejected in
   `$select` with 400 "Unsupported Query" (confirmed live 2026-08-26), and the
   full entity carries them; the worker strips to the stored subset
   client-side. Stop client-side when a page's oldest `createdDateTime` falls
   before the window start (proven in the paging test: full ~29-day history,
   224 rows, 81.8 s, 2 pages).
2. All slicing — per-user, legacy-auth existence, geo — happens **client-side**
   over the pulled window. No server-side property filters, ever (F7).

The date-filtered "optimistic probe" from the previous draft is **removed from
the scan** — it is guaranteed waste on every tenant profile observed so far.
It survives only as a **diagnostics button** (§9).

## 3. Budget, coverage, and partial results

Lane B stops at whichever comes first:

- `TIME_BUDGET_MS` — wall-clock including retry waits.
- `ROW_MEMORY_CEILING` — a memory bound, nothing more; hitting it is reported
  as "stopped at memory ceiling", never as "collection complete".
- Natural completion — nextLink exhausted or window cutoff reached.

Every result is labelled by the **window actually covered**: "sign-ins from
`<oldest fetched>` to `<newest fetched>` (N rows)". Newest-first paging means a
truncated pull is always the most recent slice; the label says "covers the last
X days of the requested Y".

**Coverage below `MIN_COVERAGE_HOURS` (24 h) is "insufficient", not partial.**
Insufficient evidence disables **only sign-in-derived findings** (impact
predictions, §10 evidence rules, existence checks) with the reason — it never
touches what Lanes 0/A support: readiness predictions, registration analysis,
config diffs, and prerequisite checks all stay live. At or above the threshold,
results are usable-partial and downstream consumers scale their claims to the
covered window. Product copy stays "predicted impact, confirmed in
report-only."

Partials are first-class: cached, usable (if sufficient), resumable (§12).

## 4. TenantSnapshot and the data boundary

The worker's output is a single versioned `TenantSnapshot`. Shape (sketch, not
final code):

```
TenantSnapshot {
  schemaVersion: number
  tenantId: string
  asOf: string                     // ISO — when this snapshot was assembled
  sources: {
    [source in
      'config' | 'registrationDetails' | 'users' | 'devices' |
      'spActivity' | 'authMethods' | 'appSignInSummary' | 'signInEvidence']: {
      status: 'ok' | 'partial' | 'insufficient' | 'disabled' | 'error' | 'pending'
      coveredWindow: { from: string, to: string } | null   // null where not windowed
      reason: string | null        // plain language, required unless status 'ok'
      asOf: string                 // when THIS source last completed/updated
    }
  }
  // derived tables only — see boundary rule below
}
```

Lane B's derived tables (extended 2026-08-26, data-model lock item 8):

- **Per-user evidence** — `signInCount`, `lastSignIn`, `lastMfaSuccess`
  (`{at, method}`), as consumed by §10.
- **Per-policy applied results** — for every policy id seen in
  `appliedConditionalAccessPolicies` across the covered window: counts of
  `reportOnlyFailure`, `reportOnlyInterrupted`, `reportOnlySuccess`,
  enforced `failure` and `success`, plus the affected user ids per result
  class. This is what moves a plan step planned → report-only observed →
  enforced (SPEC §3.7) and what checkpoints record.
- **Currently-failing cohort** — users whose most recent sign-in in the window
  has `conditionalAccessStatus = failure`, with the failing policy ids: the
  "blocked today" population, surfaced before any plan step is taken.

**Boundary rule: the UI receives derived tables only, never raw sign-in rows.**
Raw rows live in the worker and the IndexedDB cache exclusively. What crosses
the worker boundary is aggregations keyed by stable ids (per-user counters,
per-policy populations, existence flags, coverage metadata). This keeps the
main thread small, makes the privacy story auditable at one boundary, and
means a UI bug can never leak a row it never had.

## 5. Worker, tokens, locks, aborts, progress events

- The whole service runs in a **Web Worker**; the UI thread only exchanges
  messages.
- **Token hand-off:** MSAL stays on the main thread. The worker receives an
  access token by message at lane start; on any **401** it pauses the lane,
  requests a fresh token from the main thread (message round-trip through
  MSAL's silent flow), and resumes. The worker never sees refresh tokens and
  never talks to MSAL directly.
- **One `AbortController` per lane.** Cancelling a scan (or one lane) aborts
  that lane's in-flight request and stops its loop without touching the other
  lanes.
- **`navigator.locks` per tenant** (`iamai-scan-<tenantId>`): a second tab
  attempting a scan of the same tenant waits or observes rather than doubling
  load on a store that punishes even sequential calls (F3).

Progress events (names indicative): `section-started` / `section-data` /
`section-done` / `section-disabled` (plain-language reason; F9 shows the 403
names the missing scope), `signin-page` (row count, latency, oldest timestamp
→ live "covered back to `<date>`"), `collection-state`
(`normal` | `slow` | `throttled` | `insufficient` | `done` | `stopped`),
`token-needed`, `error` (terminal only; almost nothing is terminal).

## 6. Retry, timeout, and throttle policy

Grounded in observed behaviour: 429s with `Retry-After: 30` on sequential
requests (F3), 504s at Graph's ~120 s gateway limit, clean fast 403s.

- **429:** wait `Retry-After` (default 30 s) + jitter (`JITTER_FRACTION`), then
  retry; max `RETRY_MAX_429` attempts.
- **504 / network error:** exponential backoff from `BACKOFF_BASE_MS`, same
  jitter, max `RETRY_MAX_5XX` attempts.
- **Aborts:** `PAGE_ABORT_MS` (125 s) for Lane B pages — above Graph's own
  gateway ceiling so we always receive the server's verdict when there is one;
  `LANE_A_ABORT_MS` (30 s) for Lanes 0/A.
- **403 / licence:** never retried — straight to `section-disabled`.
- **400 Unsupported Query:** never retried; loud in dev, section failure in prod.
- Retry waits count against `TIME_BUDGET_MS`, so throttled tenants converge to
  a labelled partial instead of spinning.

## 7. API version: beta-only evidence, v1.0 fallback cost

Sign-in evidence collection is **beta-only** (SPEC §4 updated): the interactive
lambda and `authenticationRequirement` do not exist on v1.0 (F1), and v1.0
never returned data reliably in the spike while beta went 3/3.

If beta were ever unavailable, a v1.0 unfiltered pull is shape-compatible for
the core replay fields but **loses the checks that depend on
`mfaDetail`, `authenticationDetails`, `authenticationProtocol`, and
`originalTransferMethod`** — i.e. MFA-method evidence quality, per-sign-in auth
step detail, device-code flow detection, and auth-transfer detection. Those
sections degrade with a plain reason; the scan does not fail.

## 8. UX states

- **Collecting** — normal; sections fill in as Lanes 0/A land.
- **"Graph is slow — still collecting sign-in evidence"** — entered when a
  Lane B request exceeds `SLOW_THRESHOLD_MS` or any retry begins. Shows the
  live covered-back-to date and remaining budget. Aggregates stay usable.
- **Partial (budget/ceiling hit)** — banner with the covered window and an
  "extend collection" affordance (§12).
- **Insufficient** — coverage under `MIN_COVERAGE_HOURS`; sign-in-derived
  findings disabled with the reason, Lanes 0/A readiness findings stay live (§3).
- **Section disabled** — per-section plain reason; the scan never fails (SPEC §4).
- **Done** — with `asOf` for cache/re-scan logic.

## 9. Diagnostics

A dev/diagnostics panel keeps the tools that are wrong for the scan but right
for humans: the date-filtered probe (removed from the scan path in §2), raw
per-endpoint latency probes, and the spike harness buttons. Nothing here runs
automatically.

## 10. MFA viability scoring

A pure, synchronous function evaluated once per user over the `TenantSnapshot`
sources. No I/O, no DOM. Runs in the worker; the UI receives the results table.
The principle it encodes: **a registered method is a claim; evidence is proof;
absence of evidence is planned as if the method may be dead.**

Scoring is two independent dimensions per user (revised 2026-08-26):

- **activity**: `active` | `dormant` (no successful sign-in in `INACTIVE_DAYS`)
  | `neverSignedIn` (carries the account `createdDateTime` so the roadmap can
  separate stale pre-provisioned accounts from fresh ones).
- **mfa**: `none` | `verified` | `likelyViable` | `notChallenged` |
  `unverified`. There is no `inactive` MFA state — dormant and never-signed-in
  users still get an MFA state from metadata, but the evidence rules
  (`verified`, `notChallenged`) apply **only to active users**.

### 10.1 Constants

| Constant | Value | Meaning |
|---|---|---|
| `INACTIVE_DAYS` | 90 | no successful sign-in this long → user is planned separately, never counted as an MFA hit |
| `RECENT_REGISTRATION_DAYS` | 30 | a method registered this recently is a positive signal |
| `WHFB_DEVICE_ACTIVE_DAYS` | 30 | a Windows Hello method whose bound device signed in this recently is a positive signal |
| `STALE_METHOD_DAYS` | 180 | a method older than this with no other signal is a stale-method reason |
| `AUTHENTICATOR_VERSION_LAG` | 3 | minor releases behind the tenant's newest observed Authenticator version, same platform → stale device |

### 10.2 Inputs (per user)

```
MfaViabilityInput {
  userId: string
  registration: {                       // A1 userRegistrationDetails row, or null if absent
    isMfaCapable: boolean
    isMfaRegistered: boolean
    isPasswordlessCapable: boolean
    methodsRegistered: string[]
    defaultMfaMethod: string | null
    userPreferredMethodForSecondaryAuthentication: string | null
    isAdmin: boolean
    userType: 'member' | 'guest'
  } | null
  methods: AuthMethodSummary[] | 'unknown'   // A5; 'unknown' on inner-batch 403/error
  lastSuccessfulSignIn: string | null         // A2 signInActivity.lastSuccessfulSignInDateTime,
                                              // falling back to lastSignInDateTime
  accountCreated: string | null               // A2 user createdDateTime
  evidence: {                                 // Lane B derived table entry for this user
    status: 'ok' | 'partial' | 'insufficient' | 'disabled' | 'pending'
    covered: { from: string, to: string } | null
    lastMfaSuccess: { at: string, method: string } | null   // from mfaDetail / authenticationDetails
  }
  tenant: {
    now: string
    newestAuthenticatorVersionByPlatform: Record<string, string>  // see 10.5
  }
}

AuthMethodSummary {
  kind: 'microsoftAuthenticator' | 'passkey' | 'fido2' | 'windowsHelloForBusiness'
      | 'phone' | 'softwareOath' | 'temporaryAccessPass' | 'email' | 'password' | 'other'
  createdDateTime?: string
  displayName?: string          // Authenticator: device name; FIDO2/passkey: key name
  phoneAppVersion?: string      // Authenticator only
  deviceTag?: string            // Authenticator only
  platform?: string             // derived, see 10.5
  model?: string                // FIDO2 / passkey
  deviceLastSignIn?: string     // Windows Hello: bound device approximateLastSignInDateTime
  phoneType?: 'mobile' | 'alternateMobile' | 'office'
  isUsable?: boolean            // TAP only
}
```

Method *values* (phone numbers, email addresses) are never part of the input;
A5 strips them before they leave the fetch layer (§11).

### 10.3 Output

```
MfaViability {
  userId: string
  activity: 'active' | 'dormant' | 'neverSignedIn'
  accountCreated?: string                 // carried when activity is 'neverSignedIn'
  mfa: 'none' | 'verified' | 'likelyViable' | 'notChallenged' | 'unverified'
  mfaCapable: boolean
  isAdmin: boolean
  strongestMethod: MethodTier
  methodTiers: MethodTier[]               // tiers present, strongest first
  reasons: string[]                       // plain language, at least one for every MFA state except 'verified'
  evidence?: { at: string, method: string }
  signals: {
    recentRegistration?: string           // method kind that qualified
    authenticatorVersion?: { seen: string, newest: string, releasesBehind: number }
    whfbDeviceActive?: string             // ISO of the device sign-in
    smsVoiceOnly?: boolean
    methodsUnknown?: boolean
    observableInWindow?: boolean          // lastSuccessfulSignIn falls inside evidence.covered
  }
}
```

`MethodTier` is derived from `userRegistrationDetails.methodsRegistered`,
strongest first — `email` and `securityQuestion` are not MFA:

| Tier | methodsRegistered values |
|---|---|
| `phishingResistant` | `passKeyDeviceBound*`, `fido2SecurityKey`, `windowsHelloForBusiness`, `x509Certificate` |
| `passwordless` | `microsoftAuthenticatorPasswordless` |
| `push` | `microsoftAuthenticatorPush` |
| `otp` | `softwareOneTimePasscode`, `hardwareOneTimePasscode` |
| `smsVoice` | `mobilePhone`, `alternateMobilePhone`, `officePhone` |
| `none` | nothing MFA-capable registered |

### 10.4 Evaluation order — first match wins

MFA-capable method kinds: `microsoftAuthenticator`, `passkey`, `fido2`,
`windowsHelloForBusiness`, `phone`, `softwareOath`. `email`, `password`,
`other` are not. `temporaryAccessPass` is transitional and does not make a
user capable.

Evidence is usable only when `evidence.status` is `ok` or `partial`.
`observableInWindow` = `lastSuccessfulSignIn` is within `evidence.covered`.

**Activity** is derived first: `neverSignedIn` when `lastSuccessfulSignIn` is
null (carry `accountCreated`); `dormant` when older than `INACTIVE_DAYS`;
`active` otherwise.

**MFA state** — first match wins:

| # | State | Rule |
|---|---|---|
| 1 | **verified** | Active users only. Evidence usable and `lastMfaSuccess` present. Record method and date. Evidence beats every metadata weakness (an SMS-only user who completed MFA yesterday is verified). |
| 2 | **none** | `registration.isMfaCapable` is false AND (methods is `'unknown'` OR contains no MFA-capable kind). A usable TAP adds the reason "TAP issued — registration pending" but does not change the state. |
| 3 | **likelyViable** | Any one positive signal: (a) an Authenticator method whose `phoneAppVersion` is within `AUTHENTICATOR_VERSION_LAG` minor releases of the tenant's newest for the same platform; (b) any MFA-capable method with `createdDateTime` within `RECENT_REGISTRATION_DAYS`; (c) a Windows Hello method with `deviceLastSignIn` within `WHFB_DEVICE_ACTIVE_DAYS`. Record which. |
| 4 | **notChallenged** | Active users only. Evidence usable, `observableInWindow` true, and no `lastMfaSuccess`. The user was active in the window and nothing required MFA of them. |
| 5 | **unverified** | Everything else that is MFA-capable. Reasons, all that apply: "Authenticator version stale (seen X, newest Y, Z releases behind)"; "method registered N days ago, no usage signal" when older than `STALE_METHOD_DAYS`; "SMS/voice only" when the only MFA-capable kinds are `phone`; "FIDO2/passkey with no usage signal"; "methods unavailable for this user" when `'unknown'`; "not observable — last sign-in outside evidence window" when evidence exists but `observableInWindow` is false; "no sign-in evidence collected" when evidence status is `insufficient`, `disabled`, or `pending`. |

Rules 1 and 4 are skipped entirely when evidence is not usable or the user is
not active; the user falls through to metadata (rules 2, 3, 5).

### 10.5 Tenant Authenticator version baseline

Computed once per snapshot from every Authenticator method in A5:

- `platform` is derived per method from `deviceTag` when it identifies an OS;
  otherwise from the `phoneAppVersion` numbering scheme (iOS and Android
  Authenticator use distinct version lines); otherwise `'unknown'`.
  **Confirm the derivation against the tenant's real methods before locking
  it** — this is the one heuristic in the section written without spike data.
- `newestAuthenticatorVersionByPlatform[platform]` = max version, comparing
  `major.minor.patch` numerically.
- `releasesBehind` = newest.minor − seen.minor when majors are equal; a lower
  major counts as stale regardless of minor.
- A platform with a single observed device has no baseline; rule 4(a) is not
  applicable and rule 4(b) (registration age) decides.

Why relative rather than a version table: a phone that stops checking in
freezes at its last reported version, so lag against the tenant's own newest
device is the signal, and it needs no maintained list of current releases.

**Confirmation note (2026-08-26, against this tenant's 19 real methods — 12
password, 4 Authenticator, 2 FIDO2, 1 TAP):** all 4 Authenticator methods
derived a platform (all Android). Findings that adjust expectations:
`deviceTag` identified an OS on only 1 of 4 (`"Android"`); the other 3 carried
the generic `"SoftwareTokenActivated"`, so the **version-scheme rule is the
workhorse**, not the deviceTag rule. The date-based-minor heuristic
(minor ≥ 1000 → Android) matched on all 4, corroborated 4/4 by displayName
keywords (`SM-`, `samsung`) and by the one authoritative deviceTag. The iOS
side of the scheme is **unconfirmed** — the tenant has no iOS Authenticator —
re-verify when one appears. Baseline computed correctly: `android →
6.2607.4697` from 4 devices, with a 6.2606 device sitting 1 minor behind.
Separate caveat for §10.4: `createdDateTime` was **null on 3 of 4**
Authenticator methods, so rule 4(b) (recent registration) and the stale-method
reason will often be unavailable for Authenticator on real tenants — the
version signal and evidence matter more than planned.

### 10.6 Tenant-level derivations (from the per-user table)

- Counts per MFA state (and per state for admins — admin rows sort first
  everywhere) plus counts per activity state.
- `challengedRate` = users with `lastMfaSuccess` ÷ users `observableInWindow`.
  A low rate with many `notChallenged` is the "nobody has been prompted in
  years" tenant, and is a tenant-level finding for the roadmap.
- `verificationPhaseSize` = **active** users with MFA state `unverified`,
  `none`, or `notChallenged`. Dormant and never-signed-in users are planned
  separately (cleanup/first-sign-in phases), not verified.
- These derivations, not the per-user rows' raw inputs, are what the roadmap
  consumes.

### 10.7 Test cases (required in the implementation)

`now` = 2026-08-26. Evidence `covered` = last 30 days unless stated.

| # | Input summary | Expected state | Expected reason / signal |
|---|---|---|---|
| T1 | Authenticator registered 2022-03, `phoneAppVersion` 8 minor releases behind tenant newest (same platform); active user; evidence ok, no `lastMfaSuccess`; last sign-in inside window | **notChallenged** | observable in window, never challenged (rule 5 precedes 6) |
| T2 | Same as T1 but evidence `insufficient` | **unverified** | Authenticator version stale; no sign-in evidence collected |
| T3 | Authenticator registered 6 days ago; no evidence | **likelyViable** | recentRegistration = microsoftAuthenticator |
| T4 | FIDO2 key only, registered 2024-01; evidence ok; last sign-in 45 days ago (outside covered window) | **unverified** | FIDO2/passkey with no usage signal; not observable |
| T5 | SMS only; evidence ok; `lastMfaSuccess` yesterday, method "Text message" | **verified** | evidence beats method weakness |
| T6 | SMS only; evidence ok; last sign-in inside window; no MFA success | **notChallenged** | — |
| T7 | SMS only; evidence disabled | **unverified** | SMS/voice only; no sign-in evidence collected |
| T8 | No methods; `isMfaCapable` false; usable TAP present | **none** | TAP issued — registration pending |
| T9 | No successful sign-in for 200 days; Authenticator up to date | activity **dormant**, mfa **likelyViable** | MFA is still computed for dormant users; evidence rules simply don't apply |
| T10 | Methods `'unknown'` (inner 403); `isMfaCapable` true; evidence pending | **unverified** | methods unavailable; no sign-in evidence collected |
| T11 | Windows Hello, bound device signed in 3 days ago; no evidence | **likelyViable** | whfbDeviceActive |
| T12 | Authenticator is the only device on its platform (no baseline), registered 400 days ago; evidence ok; last sign-in outside window | **unverified** | method registered N days ago, no usage signal; not observable |
| T13 | Guest user, Authenticator current, `lastMfaSuccess` in window | **verified** | userType does not change scoring; guest handling is a roadmap concern |
| T14 | Admin (`isAdmin`) with state unverified | **unverified** | appears first in tenant-level ordering; verification phase counts active users only |
| T15 | `lastSuccessfulSignIn` null | activity **neverSignedIn** | carries account `createdDateTime` |
| T16 | `methodsRegistered` = passkey + push + mobilePhone + email | strongestMethod **phishingResistant** | tiers [phishingResistant, push, smsVoice]; email is not MFA |
| T17 | `methodsRegistered` = softwareOneTimePasscode + officePhone | strongestMethod **otp** | tiers [otp, smsVoice], carried on the scored row |

## 11. Cache and privacy

- The IndexedDB cache holds tenant-derived data (raw sign-in rows, snapshots)
  **on this device only** — nothing leaves the browser (SPEC §2). It exists so
  re-scans are cheap and partials are resumable.
- Anything exported by the dev spike harness is UPN/GUID-redacted before it
  touches disk, and `docs/spikes/raw/` is gitignored (CLAUDE.md rule).
- **"Forget this tenant"**: a first-class action that deletes every IndexedDB
  entry for the tenant (cache, snapshots, resume state) and clears the MSAL
  account. The sign-in page already tells admins how to revoke the app; this is
  the matching local-side guarantee. Plan files the user saved are theirs and
  are not touched.

## 12. Resume semantics

Resume is **newest-gap-first**: a later run first fills the gap between the
cached window's `to` and now (newest-first, same cutoff logic), then — budget
permitting — extends the window backwards past the cached `from`. The cache
merge is by sign-in id; the covered-window label always reflects the merged
contiguous span, and a non-contiguous cache (gap fill hit the budget) reports
only the newest contiguous span as covered.

## 13. Open questions

1. A3 devices spike ran 2026-08-26 19:09 UTC: 200 in 187 ms, 1 device with
   owner expanded, one page — the join works and is cheap. Whether `$expand`
   clamps the effective page size below `$top=999` is untestable on a 1-device
   tenant; re-check on the large tenant, with `$batch` owner joins as the
   fallback if it clamps.
2. §10 content — awaiting the review's specification.
3. Large-tenant validation of `TIME_BUDGET_MS` / `ROW_MEMORY_CEILING` and the
   date-filter pathology (SPEC §8 sizing tenant) remains outstanding.

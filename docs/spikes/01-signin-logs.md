# Spike 1 — sign-in log pull from the browser

**Date:** 2026-08-26 (runs at 17:57–17:58 UTC, 18:01–18:10 UTC, 18:22–18:27 UTC, 18:36–18:38 UTC)
**Tenant:** GetIAMAI test tenant (small: 7 interactive sign-ins in the trailing 7 days)
**Method:** dev harness in the SPA (`src/graph/spikes/spike1.ts`), delegated token from the
full §4 scope set, sequential `fetch` calls against `/auditLogs/signIns`. Raw JSON in
`docs/spikes/raw/` (gitignored, local-only; the harness redacts UPNs/GUIDs in
everything it writes to disk).

## What was asked (SPEC §9, spike 1)

Page size, `$select` support, filter operators, throttling, wall-clock for pulling
sign-in logs from the browser.

## Runs

### Retest run (17:57 UTC) — v1.0 only

| # | Query | Status | Wall-clock | Result |
|---|---|---|---|---|
| 1 | `$filter=createdDateTime ge <7d>`, `$top=50` | 200 | **66.2 s** | 7 items, no nextLink |
| 2 | `$filter=signInEventTypes/any(t: t eq 'interactiveUser')`, `$top=50` | 400 | 48 ms | `Could not find a property named 'signInEventTypes' on type 'microsoft.graph.signIn'` |
| 3 | Both filters, `$top=50` | 400 | 50 ms | same error |
| 4 | Both filters + 14-field `$select`, `$top=50` | 400 | 49 ms | `Could not find a property named 'authenticationRequirement'` (in `$select`) |
| 5 | Same at `$top=100` / `$top=200` | 400 | ~50 ms | same error |
| 6 | Follow nextLink ×3 | — | — | never ran; base query 400'd |

### Follow-up run (18:01 UTC) — v1.0-valid `$select`, plus beta

| # | Query | Status | Wall-clock | Result |
|---|---|---|---|---|
| A | v1.0 `$filter=createdDateTime ge <7d>`, `$top=50` (repeat of retest #1) | **504** | 120.2 s | gateway timeout |
| B1 | + 13-field `$select` (no `authenticationRequirement`), `$top=50` | **429** | 76.1 s | `Retry-After: 30` |
| B2 | same, `$top=100` | **504** | 120.1 s | gateway timeout |
| B3 | same, `$top=200` | **429** | 66.7 s | `Retry-After: 30` |
| C1 | **beta**, `signInEventTypes` lambda only (no date filter), `$top=50` | **200** | **11.8 s** | 50 items, **nextLink present**, full ~75-property beta entity |
| C2 | **beta**, date filter + lambda + full 14-field `$select`, `$top=50` | **504** | 120.1 s | gateway timeout |

### Paging test (18:22 UTC) — nextLink follow, no date filter

| Run | Page | Status | Wall-clock | Items | Oldest `createdDateTime` |
|---|---|---|---|---|---|
| v1.0, no filter, `$top=200` | 1 | **429** | 60.8 s | — | `Retry-After: 30` (waited, retried) |
| | retry | **504** | 120.0 s | — | stopped |
| beta, `interactiveUser` lambda + full 14-field `$select`, `$top=200` | 1 | 200 | **72.3 s** | **200** | 2026-07-30 |
| | 2 | 200 | **9.3 s** | 24 | 2026-07-28 (nextLink exhausted) |

The beta run pulled the tenant's **entire interactive history — 224 sign-ins spanning
~29 days — in 81.8 s over 2 pages**, with the first page carrying almost all the cost.
`$top=200` was honoured exactly, the full `$select` (including
`authenticationRequirement`) was accepted, and per-page oldest timestamps confirm the
newest-first ordering a client-side window cutoff needs.

### Extended run (18:36 UTC) — property filters, reports, `$batch`

Serialized (concurrency 1), 30 s abort per request, 429s would have been retried
honouring `Retry-After` (none occurred). Tenant has 12 users.

| Case | Query | Status | Wall-clock | Result |
|---|---|---|---|---|
| a | beta signIns `authenticationRequirement eq 'multiFactorAuthentication'`, `$top=200` + `$select` | **400** | 391 ms | `Unsupported Query` — property is not filterable at all |
| b | beta signIns `userId eq '<me>'`, `$top=50` | **timeout** | 30 s | aborted |
| c1 | beta signIns `clientAppUsed eq 'IMAP4'`, `$top=50` | **timeout** | 31 s | aborted |
| c2 | beta signIns `location/countryOrRegion eq 'US'`, `$top=50` | **timeout** | 31 s | aborted |
| d | v1.0 `userRegistrationDetails`, `$top=999` paged | 200 | **301 ms** | 12 items, 1 page |
| e | v1.0 `/users` + `signInActivity`, `$top=999` paged | 200 | **577 ms** | 12 items, 1 page |
| f1 | beta `servicePrincipalSignInActivities`, first page | 200 | 3.2 s | 4 items — worked **without** `Reports.Read.All` |
| f2 | beta `applicationSignInDetailedSummary`, first page | **403** | 117 ms | `Authentication_MSGraphPermissionMissing: … Reports.Read.All` |
| g | v1.0 `$batch` × 12 `/users/{id}/authentication/methods` | 200 | **835 ms** | all 12 inner 200s, 19 methods total |

Request IDs for a support case: `986b0081…` (66 s success), `b8cf8c38…` (504),
`51339a0e…` (429), `da9b7621…` (504), `160ca5d3…` (429), `cec70776…` (beta success),
`d3c4e598…` (beta 504).

## Findings

1. **`signInEventTypes` and `authenticationRequirement` are beta-only.** v1.0 rejects
   both with instant 400s (they are not properties of the v1.0 `signIn` entity). This
   confirms the §4 gate table. On v1.0 the interactive filter is also unnecessary:
   v1.0 `/auditLogs/signIns` returns interactive sign-ins only by default (the retest's
   one successful page contained `isInteractive` items and matched the tenant's
   interactive count).
2. **The `createdDateTime ge` filter is the pathology, not page size or `$select`.**
   Every date-filtered request across both runs and both API versions either took
   66+ s, hit a 120 s gateway 504, or was throttled 429 — including sequential,
   single-flight requests. The only fast, successful query (beta C1, 11.8 s for 50
   items + nextLink) was the only one *without* a date filter. Working hypothesis:
   the date predicate forces a store scan, while the default newest-first ordering
   streams. **Engine consequence: pull without a date filter, page newest-first, and
   cut off client-side once `createdDateTime` falls out of the window.** The paging
   test proved the strategy on beta (full history in 81.8 s). One caveat: the
   *unfiltered v1.0* run also failed (429 then 504) — but it ran minutes after the
   probe barrage had drained the throttle budget, so per-endpoint health needs a
   clean-slate retest. Across all three runs the scoreboard is: date-filtered
   0/7 fast successes (any version), unfiltered beta 3/3 successes, unfiltered
   v1.0 0/2 under throttle residue.
3. **Throttling is store-level and aggressive.** 429s arrived on sequential requests
   after 66–76 s of server time, with `Retry-After: 30`. Every Graph call in the
   product needs 429 handling with `Retry-After` honoured — not just the paging loop —
   plus 504-as-retryable with backoff. A client-side timeout above ~120 s is pointless;
   Graph's own gateway gives up there.
4. **`$select` validation is all-or-nothing.** One unknown property fails the whole
   request with a 400 naming only the *first* offender. Beta accepted the full
   14-field `$select` (paging test, 200s); whether it shrinks payload/latency
   measurably is still unmeasured. The beta no-`$select` response carried the full
   ~75-property entity including `authenticationProtocol`, `originalTransferMethod`,
   `mfaDetail`, `authenticationDetails`, and `appliedConditionalAccessPolicies`.
5. **Page size:** beta honoured `$top=50` and `$top=200` exactly, with correct
   nextLink semantics (200 + 24 items, then exhausted).
6. **Wall-clock for a real pull is dominated by server behaviour, not payload.**
   7 rows took 66 s when date-filtered; 50 full-entity rows took 11.8 s unfiltered.
7. **No server-side filter on signIns is usable — filter client-side.** The extended
   run generalises finding 2: *every* property `eq` filter tried (`userId`,
   `clientAppUsed`, `location/countryOrRegion`) hit the 30 s abort, and
   `authenticationRequirement` is rejected outright (`Unsupported Query`, 400 in
   0.4 s). The only filter that has ever returned data is the beta
   `signInEventTypes` lambda. Existence checks (legacy auth, geo) and per-user
   slices must be computed client-side from the one unfiltered pull.
8. **Everything outside `/auditLogs/signIns` is fast and healthy** on the same tenant
   in the same minutes: `userRegistrationDetails` 301 ms, `/users` with
   `signInActivity` 577 ms, `$batch` of 12 `authentication/methods` calls 835 ms with
   12/12 inner 200s. The pathology is specific to the sign-in log store, not the
   tenant, token, or client.
9. **Licence/permission gates behave as designed for degradation.**
   `applicationSignInDetailedSummary` fails fast with a clean 403 naming
   `Reports.Read.All` (117 ms) — exactly what the §4 section-disable rule needs.
   Surprise: `servicePrincipalSignInActivities` returned data (4 SPs, 3.2 s)
   *without* `Reports.Read.All`, despite documentation saying it is required — do not
   rely on this; treat it as gated and degrade cleanly. After `Reports.Read.All` was
   added to the app (18:50 UTC), `applicationSignInDetailedSummary` returned 200 in
   2.2 s with 78 aggregated rows (`appId`, `appDisplayName`,
   `aggregatedEventDateTime`, `signInCount`, `status`).

## Implications for the impact engine (§5 replay)

- Fetch strategy: no `$filter` at all (except possibly the beta `signInEventTypes`
  lambda); newest-first paging with client-side window cutoff, run in the worker,
  resumable across 429/504 with `Retry-After`/backoff. All slicing — per-user,
  legacy-auth existence, geo — happens client-side on the pulled window.
- Registration details, `/users` joins, and per-user auth methods are cheap;
  `$batch` (20 per call) is the right shape for per-user method pulls at scale.
- v1.0 has every field the core replay needs (interactive-only by default,
  `appliedConditionalAccessPolicies`, `status`, `deviceDetail`, `location`), but in
  these runs only **beta** actually delivered data reliably (3/3 unfiltered successes
  vs 0/2 for v1.0, the latter under throttle residue). Decide v1.0-vs-beta for the
  pull after the clean-slate retest below; beta stays required regardless for the
  already-gated checks (`signInEventTypes`, `authenticationProtocol`,
  `originalTransferMethod`, `authenticationRequirement`), degrading cleanly per §4.
- Section-disable rule holds: a 403/licence error is detectable instantly, but
  slowness/504s need a distinct UX state ("still pulling, Graph is slow") rather than
  an error, or scans will look broken on tenants like this one.

## Open questions

- Is the date-filter pathology tenant-specific (tiny/cold reporting store) or general?
  Re-run on the large tenant earmarked for the sizing spike (§8).
- Unfiltered **v1.0** on a clean throttle budget: healthy or not? (Its only test ran
  right after the probe barrage.) This decides whether the core replay can stay on
  v1.0 or the pull itself moves to beta with clean degradation.
- Does a valid `$select` reduce latency or payload measurably?
- Would the timed-out property filters (b, c) succeed with a longer budget (they were
  cut at 30 s; earlier date-filtered calls ran 66–120 s before failing server-side)?
  Product-irrelevant either way — 30 s+ per existence check is unusable — but it
  distinguishes "slow" from "broken" for a support case.
- The original broader probe set (`$top` sweep, operator matrix incl. `ne`/`not`,
  `startswith`) was superseded by the retest before it ever ran; the operator matrix
  beyond `ge`/lambda is still unmeasured.

## Appendix — how to reproduce

Dev server → sign in → "Dev spikes" buttons. Each run auto-saves raw JSON to
`docs/spikes/raw/` via a dev-only Vite middleware (never part of the shipped bundle).
That directory is gitignored and stays local; UPNs and GUIDs are redacted before
anything is written to disk.

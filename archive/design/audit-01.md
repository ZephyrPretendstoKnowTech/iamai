# Audit 01 — full-project bug hunt, 2026-08-27

Five parallel read-only reviews (coverage engine, roadmap engine, mapping and
collection, UI and copy, docs-vs-code) produced ~100 findings. Each was
verified against the code before acting. This file records what was fixed in
the audit commit and what is deliberately deferred, so nothing silently drops.

## Fixed

### Collection and mapping
- Concurrent 401s during a long scan shared one token refresh; earlier callers no longer hang.
- A section's `partial` state (e.g. users without sign-in activity on a non-P1 tenant) is no longer overwritten by `ok`.
- A failed `/subscribedSkus` read no longer becomes a false "not licensed" verdict; licence-gated sections are attempted and a real 403 disables them.
- `Exchange ActiveSync` (Graph's spelling) is counted as legacy authentication.
- `Retry-After` honoured up to 300 s; sleep abort listeners are removed.
- Fatal worker messages are redacted before leaving the worker.
- MSAL redirect URI is the page origin (dev and published builds).
- Role assignments expand `roleDefinition` so custom roles show by name.
- Registry/SPEC §4: `/me` rows list the scope actually consented; the on-demand group row names the `/groups/{id}` read.
- Setup auto-resolutions carry provenance `auto` and are recomputed on every answer instead of freezing at the first one; group tokens never bind to user references.
- A baseline without style choices no longer leaves the required "variants" question unanswerable (progress, "confirmed", and the Setup callout can complete).
- Break-glass validation reports policies whose excluding groups were not read as "could not be verified" instead of a hard fail.
- Suggestion name patterns are word-bounded ("Rebecca-Lee", "Editor", "Customer Service" no longer match); extra-care suggestions look for executive titles, not emergency accounts.

### Coverage engine
- The legacy-auth block requires a policy narrowed to legacy client apps; a geo or device-code block no longer counts as it.
- A strong enabled policy with nobody in scope (no guests, no active admins) is "in place", not "missing".
- Floor raising only raises authentication floors (never password-change, device or app-protection floors).
- Sign-in frequency "every time" satisfies every session floor and is described correctly.
- Ad-hoc goals expect their own audience (admin roles → admins, guest tokens → guests); plain MFA and the built-in MFA strength count as the same bar.
- More than three directly-excluded users are no longer all assumed to be break-glass.
- "N accounts excluded as break-glass" counts only break-glass exclusions; role and guest exclusions are described as such.
- A report-only candidate that is too weak still counts its users as targeted (not "never targeted"); a disabled candidate's unreadable group cannot make a goal "unknown".
- Workload goals get a real partial statement; report-only observation never fabricates zero days or zero failures.
- Policies matching a not-applicable or licence-limited goal are not listed as "not in the baseline"; Microsoft-managed policies are excluded from naming statistics.
- One facet table (`applicability.ts`) serves detection and ad-hoc inference; `appsIdsInclude` is case-insensitive.

### Roadmap engine
- Empty populations no longer block a step at "0% readiness".
- Unresolved references block by the question that owns them (locations included), on adjust steps too; several Setup questions can block one step and the sentence lists them all; the setup step is only referenced when it exists.
- Adjust steps edit the tenant's policy: its name, id and current state, portal path "open … → Save", PowerShell PATCH.
- Days observed count from the tagged policy's creation, not the whole window.
- Non-block steps no longer claim "no sign-ins matched" before anything was measured; the operator sentence claims a count only where the goal was measured.
- The break-glass drill is re-evaluated every scan (a saved "done" cannot pin it); drift re-opens a step only on absent/partial, with a dated note.
- Readiness-blocked MFA/guest steps depend on the verification campaign, so the scheduler places them after it; day 0 takes real days when foundation work exists; device readiness uses the same population on both sides of the ratio.
- Handle-with-care steps sort last within their phase; standard pace waves are 4 days as documented.
- Blocked copy names the readiness family in plain words; the Overview's "remain" excludes skipped steps.

### UI
- "Confirm skip" persists (the skip was regenerated away before it was saved).
- A saved scan that loads after the Scan page mounts is adopted; the stepper reflects saved Setup answers after a reload without visiting Setup.
- The Findings summary and print cover name the loaded baseline, not always the pinned one.
- Clickable stat tiles no longer nest a button inside a button; sortable headers and expandable rows are keyboard-operable; tabs carry ARIA ids; "Load plan" is a real button.
- Zero branches: danger areas with no high-severity item, empty admin/device populations, an all-verified verification campaign.
- No raw enums: workload names in the Inventory, policy states in Findings housekeeping, sign-in record statuses on Scan; table footers say "entries".
- Every page ends with a Next action: Roadmap (re-scan), Start (Get started at the bottom), blocked Findings (none until a scan exists); Connect's need is met only when signed in; the Package page has one exit.
- "See the step in the Roadmap" only for goals that have a step; Setup shows a loading line instead of a broken sentence while answers load.
- Setup persistence happens once per committed state (not inside the updater); the group search discards stale responses; stable findings callback.
- Pace and start date travel with the plan file and restore on load.
- Print includes proposed names, Learn links, care notes, operator note, evidence lines, announcements, blocked reasons and adjust-step JSON.
- Dev-only modules load lazily and `#/components` is a route only in development.
- Dead copy keys removed; InfoTips added for registration statistics, seat shortfall and wave progress.

### Docs
SPEC §2/§3/§4/§7/§10/§11, CLAUDE.md product voice, collection.md, intents.md, roadmap.md §11, components.md, prompts/README history — each now states where the code is the source of truth.

## Deferred (design decisions, not bugs to patch quietly)
- Guest *types* (`guestOrExternalUserTypes`) are captured but not applied when resolving populations — the user record has no guest-type field.
- Role-assignable groups: role assignments to groups are not expanded to their members (break-glass held via a group reads "not a Global Administrator").
- Ad-hoc goals match exactly; a strictly stronger tenant policy (AND vs OR, shorter frequency) reads as "missing".
- Every catalogue goal is scored whether or not the loaded baseline includes it; role exclusions are never "expected"; an all-users phishing-resistant policy does not satisfy the admin-scoped goals.
- Statuses only move forward; a deleted or failing tagged policy does not regress `in-report-only` / `ready-to-enforce`.
- Lane B partial runs after a first cache write are not cached; no backward window extension.
- No service-principal inventory (vendor detection and the passkey-pilot ACCE check are proxies); no What-If; no tenant-ID input; no policy-limit count; no zip upload; no lookup/manifest package files.
- Page numbers in the printed plan come from the browser's print footer (CSS page counters are not supported in Chromium margin boxes).
- Tabs render every panel (needed for print); `#/components` and dev spikes are development-only by route and lazy import, not by a build flag.

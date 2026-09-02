# UX review 03 — decisions from feedback rounds 3 and the second live pass

Source: Lachlan's 25-item list, the Copilot restructuring of it, and a live pass on the post-08–13 build (Aug 28). Where the two prompt files differed, this doc is the decision. Prompts 14–18 implement it.

## A. Decisions on the open questions

### A1. Runtime AI for the roadmap — no
The roadmap is composed from facts: goals × tier × population × readiness × evidence × Setup answers. Where it feels thin, the gap is a missing goal in the catalogue or a missing copy branch, both fixable as data. A runtime model would break the two promises the tool is built on (nothing leaves the browser; every claim traceable to a record) and would make the same tenant get different plans on different days. AI belongs at build time: Claude Code expands the catalogue, templates, and copy. A later, optional "explain this step with your own model" feature with a user-supplied key and an explicit data warning is possible; not now.

### A2. "Screenshot" a tenant as the baseline — later, and safer than a disclaimer
This is "use a connected reference tenant as the baseline", already in SPEC §7. Instead of a disclaimer that its strength can't be verified, verify it: score the reference tenant against the default baseline first and show "this reference covers 18 of 27 goals" on the picker. Build after polish.

### A3. Timeline length — pace follows tenant size, auto-detected, overridable
Bands by active users: small (≤30): 4 weeks. Mid (31–300): 8 weeks. Large (>300): 12 weeks (90 days). The driver is not policy creation, which is a day, but getting MFA methods registered and proven on the right devices: a registration and verification window of 2 weeks (small), 4 weeks (mid), or 6 weeks (large) sits inside each band, then a 7-day observation window, then enforcement waves. The plan is evidence-driven: when a re-scan shows verification complete early, the remaining waves pull forward and the end date shortens; the band is the expected length, not a minimum. The Overview must say why ("4 weeks: a 2-week registration and verification window, 7-day observation, 4 enforcement waves").

### A4. Setup question 6 (countries) — replaced, not kept
Nobody should choose between two policy styles. Default: allowlist style (block everything except the allowed countries). Pre-fill the allowed list from countries seen in sign-in records (distinct users per country) plus users' usageLocation; the question becomes "Countries where your people sign in — add any we missed". If no location data exists, say so and fall back to usageLocation. The allowed-countries named location becomes a Phase 0 step.

### A5. Setup question 5 (service accounts) — detect first, confirm only if found
Detection from data already collected: no MFA method, never interactive sign-in or only legacy-protocol sign-ins, name patterns (svc, service, printer, scanner, copier, smtp, relay, fax, kiosk, noreply, automation), Exchange-only licence, no manager or department. Show the candidates with the evidence and ask to confirm; skip the question entirely when nothing is found.

### A6. Shared Authenticator device across accounts
Entra's device object has one owner (Kaladin); Authenticator registrations carry a device name (SM-S918U), which is a model code, not a unique id. So: Inventory → Devices shows the Entra owner and a second column "Authenticator registrations with this device name" listing every account (Breakglass, Lachlan, Kaladin); the Setup validation lists all matches, not just the operator; both label it "same device name, likely the same phone" (medium confidence).

### A7. Scoring — yes, three dimensions, one priority
Per goal: Security value (1–5, catalogue, raised when the tenant shows exposure, e.g. legacy auth in use), Implementation effort (1–5: prerequisites, new objects, readiness gap), Disruption risk (1–5: affected active users × control severity, reduced by readiness and evidence, scaled by tenant size). Priority = value × (6 − disruption); effort breaks ties. Findings and Roadmap can group by Domain (Identity, Admins, Devices, Sessions, Guests, Locations, Risk) and sort by any dimension. Badges show all three at a glance.

### A8. Terminology — final labels, pending Lachlan's confirmation
MFA state: Verified · Looks healthy · Never prompted · Possibly broken · No method.
Activity: Active · Inactive 90+ days · Never signed in.
Method tier: Phishing-resistant · Passwordless · App notification · One-time code · Text or call.
Step kinds: New policy · Change · Prerequisite · Verify · Enforce · Recurring.
These replace "Likely viable", "Not challenged", "Unverified", "Dormant", "Push", "OTP", "SMS/voice". Internal enum values do not change.

## B. The baseline load report, in plain English (what each line meant)
- "46 policies ready to compare" — usable policies in the baseline. Keep, as "46 policies".
- "2 can't be used yet (exported without targets)" — the author's export lost the people those two apply to; they are agent-identity policies. Not the user's problem; hide from the report, keep in Technical details for the author.
- "1 choice you'll make in Mapping (two styles)" — replaced by A4; remove.
- "48 things to map" — groups, locations, strengths the baseline references that only exist in the author's tenant. Setup asks about the few that matter and matches the rest. Show as "Setup will ask N questions", nothing else.
- "1 file failed to parse", "duplicates collapsed" — author-side issues; Technical details only.

## C. Confirmed on the live pass (post-13 build)
- Roles: unresolved role names ("eb1d8c34…", "d65e02d2…") and truncated holder ids; a step's portal instructions said "an object not in this tenant" thirty times for role template ids. Fix: a bundled catalogue of all built-in role templates; resolve holders to user, group, or service principal names; hide roles with no holders.
- Licensing shows SKU codes (SPE_E5, SPB, FLOW_FREE).
- "Exclude groups: your exclusions group — Setup question 2" printed twice (two baseline groups map to one answer); a Change step on an existing tenant policy should show the tenant's current exclusions, not the baseline's.
- "Blocked by: Blocked until … ; Blocked while …" double prefix.
- Announcement on an admin-session change talks about passkeys (template keyed to goal family, not to the step's actual change).
- Baseline is not remembered across reloads; Roadmap then says "load a baseline." (lowercase, dead end).
- Sign-in record counter reads 0 until the first page arrives (the first page takes about a minute); needs a waiting state, not a counting fix.
- Remaining raw ISO timestamps in the scan details and readiness banner.

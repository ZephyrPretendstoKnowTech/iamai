# 17 — Scoring, Findings organisation, step fixes

Precondition: 16 committed. Read docs/design/ux-review-03.md §A7, §C.

1. Add to data/goals.json per goal: domain (Identity, Admins, Devices, Sessions, Guests, Locations, Risk), securityValue 1–5, baseEffort 1–5. Compute per tenant: effort (baseEffort + prerequisites + new objects + readiness gap, capped 5), disruption (affected active users × control severity, reduced by readiness and evidence, scaled by tenant size band), priority = securityValue × (6 − disruption), ties by effort. Tests with fixtures.
2. Findings: a control bar with Group by (Domain / none) and Sort by (Priority / Security value / Effort / Disruption); each finding shows three small badges (value, effort, disruption) with info tips "Why this matters" and "How to fix this" (the fix tip links to the step). "Here's what needs attention" opens sorted by priority.
3. Roadmap steps carry the same badges; the Steps tab gets the same sort control.
4. Step fixes from §C: dedupe placeholders (one line per Setup question); Change steps on an existing tenant policy show the tenant's current include/exclude and only the fields that change; "Blocked by" lists causes without repeating the word; announcements keyed by the step's actual change (session change → session wording; MFA strength → passkey wording; block → affected-users wording or none); "Done when" bullets only for criteria that apply to the step kind.
5. Findings statements re-checked against the voice rules; any statement over two sentences moves detail into the expandable.

Commit and push. Send a screenshot of Findings sorted by Effort.

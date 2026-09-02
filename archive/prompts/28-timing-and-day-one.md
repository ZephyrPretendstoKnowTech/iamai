# 28 — Change timing, the fast path, and the day-one user

Precondition: 27 committed. Read docs/design/scheduling-and-onboarding.md in full; section numbers below refer to it.

## Part 1 — Say what this is (§1)

1. Apply every item in §1: page title, meta description, wordmark tagline, Start headline and first body sentence, "What you'll need" first line, favicon and OpenGraph, print cover. Never imply Microsoft endorsement.

## Part 2 — Tenant rhythm and timing (§2.1, §2.2, §2.3)

2. Compute the working pattern from sign-in timestamps in the tenant time zone: sign-ins per weekday and hour, peak hour, quietest working hour, weekend activity, and a flat-24-hour detection with a fallback note. Pure function over the snapshot, unit-tested with fixtures for an office-hours tenant, a 24/7 tenant, and a tenant with too little evidence.
3. Every step carries three scheduled events: announce, remind, enforce, each with day, date, local time, and a one-line reason drawn from the rules table in §2.2. Timing defaults come from the table; the tenant's rhythm overrides the peak-hour and weekend assumptions.
4. Notice periods by disruption per §2.3, as editable settings in Plan settings with those defaults. A handle-with-care user in scope forces the minimum to 5 working days and an individual contact first.
5. Never schedule an enforcement on a Friday, the last working day before a configured holiday, or inside the change freeze.

## Part 3 — The fast path (§2.4, §2.5)

6. Implement the Safe today test exactly as specified, including the evidence sufficiency conditions. A step that passes may be enforced out of wave order with no announcement, and says so in the words given.
7. Every step shows a one-line verdict at the top: "Safe to enforce today" or "Not yet: <single specific reason>".
8. Roadmap gains a "Safe today" filter and the tile count on the Progress tab links to it.
9. Tests: a fixture where evidence is thin must never produce Safe today; a fixture with 30 days of dense evidence and zero would-be blocks must produce it.

## Part 4 — Presentation (§2.6, §3.5)

10. Schedule tab gains a week view: days across, three rows (announce, remind, enforce), one table per plan week, with out-of-hours events flagged.
11. A "This week" card above the Roadmap tabs, three items maximum, with dates and times, derived from the schedule and the readiness work outstanding.

## Part 5 — The day-one user (§3.1 to §3.4)

12. Plain-language titles for every goal with the technical name as subtitle, using the table in §3.1 and the same pattern for the rest. Search matches both; print shows both; Inventory keeps technical names first.
13. Term component with hover and tap definitions, applied to the minimum set in §3.2. Definitions live in src/copy/definitions.ts. No separate glossary page.
14. "What to tell your manager" per step: three sentences, plain business language, copyable.
15. Licence awareness in the Roadmap header per §3.4, with unavailable steps grouped at the end and excluded from completion counts.

## Finishing

Run npm test and vite build. Commit by part. Push. Send screenshots of: the Start page, a step card showing the three dates and the verdict line, the Schedule week view, the This week card, and a term definition on hover.

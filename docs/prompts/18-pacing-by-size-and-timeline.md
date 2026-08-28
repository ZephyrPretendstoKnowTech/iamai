# 18 — Pace by tenant size, timeline, rationale

Precondition: 17 committed. Read docs/design/ux-review-03.md §A3.

1. Tenant size band from active users: small ≤30 (4 weeks), mid 31–300 (8 weeks), large >300 (12 weeks). Each band sets the registration-and-verification window (2 / 4 / 6 weeks), the observation window (7 days), and wave spacing so the expected total matches the band. The Overview shows the band, the expected length, and lets the user override the band. Re-scans that show verification complete early pull the remaining waves forward; the end date is recomputed on every scan.
2. The Overview states the schedule rationale in one sentence generated from the plan: "<n> weeks: <k> verification campaign(s), <d>-day observation window, <w> enforcement waves, <b> steps waiting on Setup". If the plan exceeds the band's expected range, say which steps extend it.
3. Timeline: only waves that contain steps; completed steps hidden by default with a "show completed" toggle; each wave lists its steps as links to #/roadmap/step/<id>; dates from the wave, relative and absolute.
4. Verify on this tenant: with Setup complete, 12 active users places it in the small band, so the plan should land at about 4 weeks with the registration window shown as the reason. If it does not, record why in docs/design/roadmap.md §10 and fix the scheduler rather than the band.
5. Print layout reflects the timeline changes.

Commit and push. Send a screenshot of the Overview and Timeline.

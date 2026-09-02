# 27 — Correctness pass, exports, and visual identity

Precondition: 26 committed. Read docs/design/ux-review-07.md. Sections A to E are fixes; section F is the design direction and is implemented in Part 5.

## Part 1 — Correctness (§A)

1. Distinguish "already in place" from "executed" (§1). A step satisfied by a policy whose evidence predates the plan's creation is `alreadyInPlace`: it is not counted as enforced by the plan, does not set the plan start date, and never reports a slip. The Progress headline reads "N steps were already covered before the plan began" separately from executed steps. Add tests using the midflight fixture and a fixture whose policies all predate the plan.
2. One denominator (§2): define the trackable step set once, label it, and use it in the tab badge, the headline, and the journey band. Test for agreement.
3. Phase ordering (§3): Foundations first, then low-impact blocks, MFA, admin hardening, guests and locations, devices, sessions, advanced. Assert ordering in the scheduler tests.
4. Chips reflect their content (§4, §5, §24): the worst finding sets the chip; the count matches the number of findings shown; a question with nothing to check reads "nothing to check", not "checks passed".
5. One threshold per fact (§6): the break-glass drill verdict and the Setup finding come from the same function.
6. Setup summary must not contradict the plan (§7): when the plan creates an object, say so.
7. Dates on done steps (§8, §9, §10): show the real event date, label the scan that noticed it, replace "created outside the plan" with "this policy already existed and covers this step", and mention already-covered steps in the summary.

## Part 2 — Presentation of data (§B)

8. Journey tiles wrap to two lines or show counts with names on hover; no ellipsis-only columns.
9. Label the week-by-week chart (axis, legend, values on hover) or remove it. Decide and say which.
10. Hide empty columns; one convention for absent values ("not started" or "—", not both).
11. Export tab: the print action belongs in the document card; name the change-record format and say what it contains.

## Part 3 — Copy (§C)

Apply §17 to §23 as written. All strings in src/copy; lint passes.

## Part 4 — Layout, exports (§D, §E)

12. Section anchors or default-collapsed lower sections on Progress; test the journey band at 1024 and 768; Plan tab matches Schedule's card grid; mini-map segments scale by duration; hover states on journey tiles; one badge pattern.
13. Print: verify Roadmap and Findings end to end. Grid collapses to one column, cover page, page breaks between waves, no dark backgrounds. Save both PDFs under docs/screens/27/.
14. Change record: one row per step with step, kind, goal, population, planned date, actual date, evidence, rollback; offered as CSV and Markdown.
15. Plan file: human-readable header block (tool version, tenant name, baseline pin, generated date, a one-line description of the format).

## Part 5 — Visual identity (§F)

16. **Ring motif.** Design a concentric-ring glyph (inline SVG, two or three arcs, accent colour) and use it as the logo mark beside the wordmark, as the favicon, on the print cover, and as the progress indicator on step tiles (a segmented circle, one arc per ring, filled by ring completion). Replace the journey band's six columns with concentric arcs only if it tests clearly at 1024px; otherwise keep columns and use the ring on tiles only.
17. **Typography.** Self-host one display face for headings and large numerals (Space Grotesk or similar; no CDN, subset to Latin), keep the system sans for body text, tabular figures everywhere numbers appear. Update the type scale in tokens.
18. **Motion**, three places only, all respecting `prefers-reduced-motion`: page and tab transitions (150 ms cross-fade plus 8 px rise); state changes after a re-scan (ring fills, row flashes once); scan data arrival (sections fade in, progress bar eases). Nothing else animates.
19. **Colour story.** Past (done, already in place) in settled slate-green; present (ready, soaking, in report-only) in the teal accent at full strength; future (planned, blocked by schedule) in a cooler muted blue. Danger and warning colours are reserved for real risk. Apply consistently to tiles, journey band, mini-map, chips, and print.
20. **Empty states**: line-art illustrations, one accent colour, for "no plan yet", "nothing needs attention", "no danger areas", and "no scan yet". No stock art, no emoji.
21. **Print cover**: ring motif, tenant name, baseline name and version, plan dates, generated date, and the read-only statement.

Run npm test and vite build. Commit by part. Push. Send screenshots of Progress, Schedule, and a step tile at 1400px in both themes, plus the two PDFs.

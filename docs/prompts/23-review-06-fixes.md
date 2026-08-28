# 23 — Review 06 fixes

Precondition: 22 committed. Read docs/design/ux-review-06.md. Item numbers below refer to it.

## Part 1 — Correctness and trust

1. Loading states for every long action (§1, §2): baseline load (disabled button, "reading N of 155 files", concurrency guard), sign-in ("Opening the Microsoft sign-in…"), re-scan, and plan load. No action that takes more than 300ms may look inert.
2. Baseline persistence (§3): persist the loaded baseline with the scan and restore it on load. Until a baseline is loaded, Findings and Roadmap must not render results: show the prerequisite and nothing else. Remove the "goal catalogue" fallback comparison from the user-facing path.
3. Never print an id where a name belongs (§4): a step that creates a group names it with a proposed name in the tenant convention; add a test that fails if any user-facing string in the roadmap matches a GUID pattern.
4. Portal step vocabulary (§5): map every condition and value to the portal's own words ("All client apps", "iOS", "macOS", "Windows"); no raw API values.
5. Links, never raw URLs, in prose (§6): the Microsoft Learn reference renders as a named link on its own line.
6. One population per step (§7): compute active, admin, and guest counts once per step from the same set, and use them in the header, readiness line, and blocked reasons. Add a test asserting agreement.
7. Setup question 2 validation (§8) and suggestions on focus (§9): show member count, admins among members, dynamic-rule flag, and whether the group is excluded consistently across policies; open the picker with ranked suggestions before typing.
8. Domain and wave from controls, not app scope (§10): "Restrict access to Office 365" and similar session controls belong to Sessions and to the sessions wave. Re-check every goal's domain and phase against its controls.
9. Consolidation advice (§11): only when two enabled policies share the same population and the same controls. Persona-split policies are correct and must never be flagged.
10. Ad-hoc goal titles (§12): resolve app ids to names for the title; pluralise correctly; merge duplicate titles.
11. Preserve case in naming housekeeping (§13); name the excluded account in "Excluded directly" (§14).
12. Move the Findings Group by and Sort by controls inside the two tab panels that use them (§15).
13. Performance (§16): profile Findings and Roadmap with this tenant, record in docs/qa/perf-03.md, and remove blocking work over 200ms (memoise coverage and plan derivation, virtualise the step list, defer off-screen tab panels). This is the top item in Part 1: the pages currently freeze the renderer for seconds.

## Part 2 — Copy

Apply §17 to §24 exactly as written; strings in src/copy; copy lint passes.

## Part 3 — Interaction and accessibility

Apply §25 to §31. Add a ?dev=fail flag (§34) that forces one collector to 403 and one to 429 so the disabled and slow states are demonstrable, and note the D6 decision in SPEC.md (§35). Raise the container cap to 1600px for pages whose main content is a table (§28, §32), leaving prose pages at 1440px.

## Finishing

Run npm test and vite build. Save a plan, reload it, and confirm every number matches the screen (§33); record the result. Commit in chunks by part, listing pages touched, and push. Report the perf figures before and after, and anything in the review you disagree with.

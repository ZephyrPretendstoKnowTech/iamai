# 22 — Correctness first, then polish

Precondition: 21 committed. Read docs/design/ux-review-05.md in full. Item numbers below refer to it. Part 1 is the priority: those defects make the tool's output wrong. Do Part 1 completely, run the app against the tenant, and confirm coverage returns to a sensible number before starting Part 2.

## Part 1 — Correctness

1. Expected exclusions by membership (§1). A group is an expected exclusion when every member is a confirmed break-glass account, or when the user maps it in Setup. This is computed from membership, never from which question was answered. Setup question 2 must auto-suggest such groups, ranked first, with the evidence line ("only member is Breakglass, your confirmed emergency access account"). Answering Setup must never lower coverage for an exclusion the answers justify: add a regression test that runs coverage before and after applying the tenant's real Setup answers and fails if any goal moves from in-place to partly.
2. Re-verify the cascade (§2, §3): with item 1 fixed, goals delivered by existing enabled policies must read "In place", the plan must not propose creating policies that already exist, and "Fix first" must list only real gaps.
3. One admin population (§4). Compute the admin set once (active role assignments over the admin catalogue), and use it for Findings, step populations, readiness percentages, and blocked reasons. Add a test asserting the same count in all four places for a fixture.
4. Sign-in evidence per user (§5). When records exist but none match the user or policy, say so explicitly; reserve "no sign-in records are available" for when the evidence source itself is unavailable or insufficient.
5. Role lists (§6, §7). Portal steps collapse role includes to "All N directory roles" with a "show list" disclosure. Resolve role ids through the directory-role objects returned by the scan as well as the bundled template catalogue; unresolved entries render as "Unknown role" once, with the count, never as truncated ids.
6. Baseline persistence (§8). Persist the baseline selection alongside the scan, restore both on load, and show which baseline is loaded in the header area of Findings and Roadmap.
7. Goal counts (§9). Report "N goals in this baseline, M apply to this tenant" and use M consistently in Findings; the difference is shown under Details with the reason each goal does not apply.
8. Goal-versus-baseline distinction (§10). Statements separate "the goal is not met" from "the goal is met but the baseline sets a higher bar", with different wording and different status chips (Partly in place versus Below the baseline).
9. Ad-hoc goals (§11, §12). Every goal, including ad-hoc, gets a generated plain title from its facts, a domain, and the three scores. Merge goals with identical intent fingerprints before display, keeping both source policy names in the detail.
10. Explain the activity-versus-window difference (§13) in the tooltips of both numbers.
11. Re-check "steps waiting on Setup" (§14) once item 1 lands; if any remain, the blocked reason names the question.

## Part 2 — Copy

Apply §15 to §32 exactly as written. All new strings go in src/copy; the copy lint must pass.

## Part 3 — Layout, interaction, accessibility

Apply §33 to §45. Item §42 (main-thread blocking) is the one to profile first: measure the time to interactive on the Roadmap and Findings pages with the current tenant, record it in docs/qa/perf-02.md, and split or virtualise whatever exceeds 500ms of continuous main-thread work.

## Part 4 — Value and trust

Apply §46 to §51, and after Part 1 is complete, print the plan to PDF and save a plan file, then re-load it, and confirm every number matches the screen. Save the PDF under docs/screens/22/.

## Finishing

Run npm test and vite build. Commit in chunks by part, listing pages touched. Push. Then report: the coverage numbers before and after Part 1, the perf figures, and anything in ux-review-05.md you disagree with, with your reasoning.

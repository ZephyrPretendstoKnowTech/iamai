# 12 — Roadmap pacing, dependencies, classifier, print

Precondition: 11 committed. Read docs/design/roadmap.md and docs/design/ux-review-01.md §2 items 5–12.

## A. Pacing model (replaces serial phases)
1. Schedule in waves, not phases-in-series. Day 0: every "New policy" step is created in report-only in one batch (report-only affects nobody). One shared observation window (OBSERVATION_DAYS = 7) runs for all of them at once. Enforcement then happens in waves that follow the phase order: wave 1 low-impact blocks, wave 2 MFA (only if verification is complete), wave 3 admins, wave 4 guests and locations, wave 5 devices, wave 6 sessions, wave 7 advanced. Steps already Done consume no time and appear as done on day 0. Blocked steps are scheduled after their blocker resolves, never inside a wave they can't join.
2. Pace presets on the Overview: Fast (2 weeks: 5-day observation, one wave every 2 days), Standard (3–4 weeks: 7-day observation, one wave every 3–4 days), Cautious (6–8 weeks: 14-day observation, weekly waves). Standard is default. The verification campaign, when needed, extends wave 2 by VERIFICATION_DAYS per preset.
3. Overview copy per prompt 09 §7; Timeline tab shows waves with dates and the steps in each; per-step dates come from the wave.

## B. Dependencies and Setup consistency
4. A step is Blocked only by a named cause: a prerequisite step, a Setup question, a readiness threshold, or evidence. The blocker is shown by name with a link. Registration-protection depends on the trusted location (or the MFA path); geo-restriction depends on the countries choice; device steps depend on the compliance readiness threshold.
5. Setup answers drive steps as specified in prompt 11 §8.

## C. Classifier and catalogue
6. Add goals to data/goals.json: all-users session persistence (session floor from the baseline policy), PIM activation reauthentication (authentication context + sign-in frequency every time), Intune enrollment sign-in frequency every time, block downloads on unmanaged devices (app-enforced restrictions + device filter), medium-risk sign-ins (signInRisk medium → MFA), medium-risk users (userRisk medium → password change). Assign phases.
7. Tighten matching: session goals only match candidates that carry the relevant session control; ad-hoc goals require an exact match on apps, user actions, and grant/session controls; "consider consolidating" appears only when the goal's own signature is matched by more than two enabled policies.
8. Remove "Phase 8: From this baseline". Any remaining ad-hoc goal gets a generated plain-language title from its facts (e.g. "Require MFA for the Inforcer app") and is placed in the phase its facts imply (grant MFA → phase 2 or 3, session → 6, block → 1 or 4).

## D. Print
9. A dedicated print layout, not the screen layout with overrides: cover page (tenant name, baseline, plan dates, generated on); contents; summary page (the Overview numbers and the wave timeline as a table); one section per wave with every step fully expanded (title, kind, status, why, who is affected with counts, readiness, the exact change in words, portal steps, exit criteria, rollback); appendix with the JSON for every New-policy step in monospace; page breaks between waves; light theme; no navigation, footer, or buttons; running header with tenant and date, page numbers. Verify by printing to PDF and attaching it to the commit under docs/screens/12/.

Commit and push. Send the PDF and a screenshot of the Timeline tab.

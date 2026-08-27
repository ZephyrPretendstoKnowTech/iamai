# 13 — Live review fixes

Precondition: 12 committed. Read docs/design/ux-review-02-live.md; item numbers below refer to it.

1. Responsive main column: max-width 1100px, wrapping, no horizontal overflow at any width from 360px up; verify at 360, 768, 1024, 1280. (item 1)
2. Stepper status rules, implemented once and used by the sidebar and page headers: Start done after first visit; Connect done when signed in; Baseline done when loaded; Scan done when the snapshot exists; Setup not-started / needs-attention (required missing) / done; Findings and Roadmap show "provisional" until Setup is done, then done. Tests. (item 2)
3. One name per step everywhere visible: Start, Connect, Baseline, Scan, Setup, Findings, Roadmap. Buttons say "Next: Setup", "Next: Findings". Routes unchanged. (item 3)
4. Setup sections stay open after an answer; collapsed headers show a count chip of open validation findings; every validation finding ends with an action link (plan step or portal path). (items 4, 5)
5. Reference rendering in roadmap actions: mapped objects render by tenant display name; unmapped ones render as "<role> — Setup question N" placeholders; GUIDs never appear in portal steps, JSON preview labels, or PowerShell comments (the JSON body itself keeps real ids for mapped objects and a clearly marked placeholder token for unmapped ones). (item 6)
6. Proposed policy names follow the tenant's detected naming convention from the organisation report (prefix and separator), with the baseline's original name shown beneath as "from baseline". Fix the typo pass-through by never using baseline names as tenant names. (item 7)
7. Operator self-check copy replaced with the evidence sentence from the review; the What-If result, when available, is shown as its own line. (item 8)
8. Announcement templates keyed by goal family in src/copy/announcements.ts; steps with zero affected users in evidence show "No announcement needed — nobody is affected" instead of a template. (item 9)
9. Blocked reasons name their cause precisely: "Blocked until Setup questions 2 and 6 are answered", "Blocked until 'Create a trusted named location' is done". (item 10)
10. Evidence line copy per item 11; scan completion copy per item 13; print header date via the dates rule (item 14).
11. A single derived plan result feeds every Roadmap tab; add a test that Overview counts equal Steps-tab counts for a fixture plan. (item 12)

Commit and push. Send screenshots of Setup question 1 after an answer, a New-policy step's portal steps, and the sidebar at 768px width.

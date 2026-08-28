# 19 — QA sweep: find the lurking breakage, then fix it

Precondition: 18 committed. This prompt is different from the others: the first half is an audit that produces a report, the second half fixes what the audit finds.

## A. Known defects (fix these regardless of what the audit finds)

1. Button hover hides the label. Some buttons (for example "Next: Baseline") lose their text on hover: the hover rule changes background without changing text colour, or sets colour to the background token. Fix in the Button component so every variant keeps AA contrast in default, hover, active, focus, and disabled states, in both themes. Add a test that asserts computed text and background differ for every variant and state.
2. Question count mismatch. The Baseline page says Setup will ask 9 questions; Setup renders 8. The count must be derived from the same function that builds the question list, not a constant, and must reflect conditional questions (service accounts appears only when candidates exist) and the required/optional split: "Setup will ask N questions (M required)".
3. Legend has no meaningful dividers. Rebuild as three labelled cards or columns with a heading rule per group (MFA state, Activity, Method tier), each term on its own row with its definition, and the same chip styling used in the table.
4. Findings grouping and sorting. Default Group by = Domain. Sorting must apply within each group when grouping is on, and the control must show the active sort. Fix the state handling so both controls are independent, persist the choice for the session, and add tests for group-on/sort-changed.

## B. Audit (produce docs/qa/audit-01.md, then fix)

Walk the whole app as a user would and record every defect found, with page, what happened, and what should happen. Cover:

- Every link and button on every page: does it go where the label says, and is the target rendered? Especially Findings to Roadmap step links, Setup validation action links, "Next:" buttons, inventory row links, and the What IAMAI reads links.
- Every empty and error state: no baseline loaded, no scan yet, scan failed, section disabled by licence or permission, zero users in a table, zero findings in a group, insufficient sign-in evidence, plan with no steps. Each must explain what to do next, in the product voice.
- Every number rendered anywhere: does it agree with the same number elsewhere? Build a small consistency test over one fixture snapshot asserting cross-page agreement (user counts, goal counts, step counts, percentages).
- Text overflow, truncation, and wrapping at 360, 768, 1024, 1440 widths; long tenant names, long policy names, long UPNs.
- Keyboard: tab order, focus visibility, Escape closing pickers and popovers, Enter activating primary actions.
- Copy lint violations that entered since prompt 14, plus any remaining ISO timestamps, GUIDs, or developer vocabulary in user-facing strings.
- Console errors and React warnings during a full pass; fix all of them.
- Dark and light theme parity on every page.

Fix everything found. Where a fix is larger than this prompt's scope, add it to docs/qa/deferred.md with a one-line reason instead of half-doing it.

Commit in logical chunks. Push. Leave docs/qa/audit-01.md in the repo as the record.

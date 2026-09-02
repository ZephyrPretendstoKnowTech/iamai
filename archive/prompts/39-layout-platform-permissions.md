# 39 — Layout, platform, and the permission decision

Precondition: 38 committed. Read docs/qa/review-07-findings.md sections L and P.

## Part 1 — Layout

1. L1: sidebar fills the viewport height, scrolls independently, and has a collapse control
   that persists.
2. L2: Scan page order becomes status line, then tabs, then content. The completion summary
   and Details move to the bottom, collapsed. Nothing above the tabs but one line and the
   primary action.
3. L3: Groups becomes its own tab. Order: Policies · Named locations · Authentication ·
   People · Groups · Devices · Roles · Apps · Licensing · Sign-in records.
4. L4: one continue pattern, bottom of the page only, on every step page.
5. L8: Group by and Sort by live inside the two tab panels that use them.
6. L9: one info icon per line.

## Part 2 — Platform

7. L5: light theme audit. Every surface, chip, card and border checked against the light
   palette; the sidebar, the "done" chips and the Do this next card are known failures. Add
   a contrast test covering both themes for text, chips, and card borders.
8. L6: responsive behaviour at 360, 700, 1024, 1440 and 1920. The sidebar collapses below
   1024; tables scroll within their container rather than the page; the schedule grid
   switches to a list below 1024. Add a layout test at each width.
9. L7: fix the Prompt pack route so `#/roadmap/prompts` renders the Prompt pack.

## Part 3 — The Application.Read.All decision

10. Investigate and report, do not change the scope yet:
    - What the planned service-principal inventory (SPEC §4) would add, and which findings or
      steps would improve with it.
    - Whether the same information is already available from the service-principal sign-in
      activity and app sign-in summary the tool already reads.
    - What removing the scope would cost: any surface that would degrade, and whether the
      consent screen becomes materially shorter.
    Write the answer to `docs/design/application-read-decision.md` with a recommendation.
11. Until the decision is made, the What IAMAI reads page must not list an unused permission
    as part of the working set: either move it to a clearly separate "requested, not yet
    used" line with the reason, or remove the scope. Do not leave it inside the table of
    permissions the tool relies on.

## Finishing

npm test, vite build, screenshots of every page in both themes at 700 and 1440 under
docs/screens/39, commit by part, push. Report the light-theme failures found and the
recommendation on Application.Read.All.

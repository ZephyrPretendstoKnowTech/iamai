# 26 — Roadmap presentation, Timeline layout, Setup regressions

Precondition: 23 committed. Run before 24 and 25: the layout work here is what those two build on, and the Setup regressions are trust bugs.

## Part 1 — Setup regressions and rules

1. **Break-glass validation regressed.** Answering question 1 with a single account now collapses to "Answered" with no findings. The checks that ran in earlier builds must run again and must be visible in the collapsed summary as a count and expanded in full: fewer than two accounts, cloud-only, permanent Global Administrator (not eligible-only), excluded from every policy including report-only and Microsoft-managed, MFA method strength (SMS-only flagged, phishing-resistant preferred), last successful sign-in, membership of any dynamic group that could sweep it in, and any other account registered with the same Authenticator device name. Each finding ends with an action link. Add a test with a single SMS-only break-glass account asserting that all applicable findings render.
2. **Every relevant question is required.** Remove the optional/advanced split for questions that apply to this tenant. Each question is answerable in one of three ways and none may be skipped: an answer, an explicit "not applicable to us" (which records a reason), or "doesn't exist yet: add it to the plan". Questions that do not apply to the tenant are not shown at all. The progress line reads "6 of 6 answered".
3. **Question 5 (service accounts).** If detection finds no candidates, do not show the question; record "no service accounts detected" in the plan and say so once in the Setup summary. If candidates exist, the question is required.
4. **Question 6 (time zone).** Pre-select the browser's zone and show a "This is correct" confirm button exactly like the countries question. Selecting a different zone also answers it. The answered chip updates either way.
5. Re-check every other question for the same pattern: a pre-filled default must always have a one-click confirm.

## Part 2 — Roadmap Overview redesign

The page currently stacks a bold paragraph, a bullet list, four tiles, two more paragraphs, a date field, a pace selector, four buttons, a note, and a second button. Restructure into three bands with generous space between them, max width 1100px for prose and 1600px for the tab content.

6. **Band 1: the headline.** One line, large: "8 of 32 steps in place · finishes Oct 10, 2026". Beneath it, one sentence naming the constraint that sets the length ("5 weeks, because MFA registration for 9 people takes two of them"). Nothing else.
7. **Band 2: four stat tiles** in one row (Steps done, Weeks, Ready today, Blocked), each clickable to the Steps tab pre-filtered to that set. Keep the info tips. Remove the "Safe today" wording in favour of "Ready today" and make sure a zero reads as a state, not a failure.
8. **Band 3: two columns.** Left, "What needs attention before you start": the danger-area count and the blocked count as two compact callouts, each with a link and a one-line summary, replacing the two loose paragraphs. Right, a bordered "Plan settings" card holding start date, pace with the detected band explained, and the owner field. The thirteen-item overrun list moves into a disclosure ("13 steps run past the campaign — show").
9. **Actions move to a single row at the bottom of the page**, right-aligned: Save plan, Load plan, Copy as Markdown, Print. Delete the duplicate "Re-scan to update progress" button; the header already has Re-scan. Delete "This is the last step" (the stepper says so).

## Part 3 — Timeline redesign

The vertical list works but reads as a wall. Keep time vertical; make each phase a card.

10. **Mini-map at the top**: a single horizontal bar spanning the plan, segmented by phase, with today marked and each segment coloured by completion. Clicking a segment scrolls to that phase.
11. **Each phase becomes a card** with a header row: name, date range, a small progress ring or "8 of 11", and a chevron to collapse. Windows (registration, observation) render as slimmer cards with a distinct treatment so they read as waiting periods, not work.
12. **Steps inside a card render as a responsive grid**, three per row at 1400px and above, two at 1000px, one below. Each cell is a compact tile: status chip, kind chip, title, and the one-line state reason. The whole tile is the link.
13. Completed phases collapse by default with a "8 done" summary; "Hide completed" stays as the global control.
14. Empty phases are not rendered.

## Part 4 — Consistency

15. Apply the same card-and-grid treatment to the Steps tab so the two tabs feel like one product: phase headers, three-across tiles, expand in place for detail.
16. Check both themes and the four breakpoints; no horizontal scrolling at any width; screenshots of Overview, Timeline, and Steps at 1400px and 768px saved under docs/screens/26/.

Run npm test and vite build, commit by part, push, and send the screenshots.

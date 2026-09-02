# UX review 07 — after prompts 24 to 26

Live pass on GetIAMAI: sign-out and back in, baseline reload, Setup, Findings, Roadmap
(Progress, Plan, Danger areas, Schedule, Export), both themes. The ring model, the
Schedule card grid, the Progress map, and the Export tab are all in and the Schedule tab
in particular now looks like a product. 34 items follow, then the design direction.

## A. Correctness

1. **Pre-existing policies are being reported as executed plan steps.** Progress says
"Started Jul 24, 2026. 8 of 28 steps enforced", and the table shows "Guests satisfy MFA:
planned Sep 16, actual Aug 1, 46 days early" and "Admin sessions: 32 days early". Those
dates are the `createdDateTime` of policies that existed long before the plan. A step that
was already satisfied when the plan was generated is **"already in place"**, not "enforced
early", and it must not set the plan's start date. Only steps whose evidence post-dates the
plan's creation count as executed. The start date is the plan's start, or the first real
execution, never a policy's birthday.

2. **Two different totals on one page.** The tab badge says 9/32, the Progress headline
says 8 of 28, and the journey band columns sum to 28. Pick one denominator, define it
("32 steps, of which 28 are trackable"), and use it everywhere.

3. **Wave order is wrong on the Schedule mini-map**: Day 0 · Wave 1 Admin hardening ·
Wave 2 MFA for everyone · Wave 3 Foundations. Foundations cannot be third, and admin
hardening should follow MFA. Assert phase ordering in the scheduler tests.

4. **Setup question 2 says "checks passed" while listing two problems** ("1 member holds
active admin roles: exclusion removes their protection", "excluded from 8 of 10 enabled
policies: inconsistent use"). Either those are findings, or they are not. The chip must
reflect the worst finding, as question 1's does.

5. **Question 1's chip says "3 to fix" and lists five findings.** Count what is shown.

6. **The break-glass drill step says "Done: all accounts recently drilled"** while Setup
lists "last successful sign-in Jul 24, 2026" as a finding on the same account. One
threshold, one verdict.

7. **The Setup summary contradicts the plan**: "No named locations exist yet, so there is
nothing to mark trusted", yet the plan contains both "Create a trusted named location" and
"Create the allowed-countries named location". Say instead that the plan creates them.

8. **Done steps carry two dates that read as contradictory**: "Done Aug 28, 2026: policy
enforced on Jul 24, 2026". The Done date is the scan that noticed. Show the real date and
label the other ("noticed by IAMAI on Aug 28").

9. **"Created outside the plan, matched by what it does"** appears on eight steps and is
correct, but the phrasing implies the user did something wrong. "This policy already
existed and covers this step" is the same fact without the accusation.

10. Progress says "0 slipped by more than a week" and the table shows two steps "32 days
early" and "46 days early". Early is not slip, but the summary should mention it: "2 steps
were already covered before the plan began."

## B. Data that should not be shown as-is

11. The journey band truncates every step to about 30 characters ("Security-info
registration requires a t…", "Medium-risk users must change their…"), producing a column of
ellipses. Tiles should wrap to two lines, or the band should show counts with names on
hover.

12. "Planned against actual, week by week" renders unlabelled bars with no axis, no legend,
and no values. Either label it or drop it; an unexplained chart in a security tool reads as
decoration.

13. The per-step table's "Why" column is empty for every row. Hide a column with no data.

14. "not started" appears in the Actual column for 19 rows; "—" in Slip. Use one convention
for absent values.

15. The Export tab's third card ("The plan as a document") has a description but no button;
the Print action lives in the first card. Move it.

16. The change-record download is offered without saying what format it is. Name it
("Markdown, one file") and say what it contains in one line.

## C. Copy

17. "The dated plan from here to the baseline, with the danger areas named" is jargon in the
first line of the page. "Your plan: what to change, in what order, and what to watch."

18. The Progress headline runs three sentences into one paragraph. Split: the state, then
the projection.

19. "17 steps prompt the same people in the same week as another step; keeping them apart
would run past the size band" is the most important sentence on the page and the least
readable. Rewrite: "17 steps would prompt the same people twice in one week. Spacing them
out would push the plan past 3 weeks, so they stay together."

20. "9 of 12" on a phase header with no unit. "9 of 12 steps done".

21. "17 policies are created in report-only in one batch: nobody is affected" is true but
sits above tiles that say Done and Ready, which contradicts "created". Say "the new
policies start in report-only, where they affect nobody".

22. Danger areas is a good name for a security context and an odd one everywhere else.
Consider "Watch first" or "Before you start".

23. Setup's intro "A handful of questions about the tenant" undersells a screen that
produces validation findings. "Seven questions. The answers shape the plan and the checks."

24. "Checks passed" and "3 to fix" as chips need a third state for "checked, nothing to
check" so an empty result does not read as a pass.

## D. Layout and interaction

25. The Progress tab is a single long scroll with five sections and no anchors; add a small
section nav or collapse the lower two by default.

26. The journey band's six columns collapse badly below 1200px (unverified, but the fixed
six-column layout will not fit); test at 1024 and 768.

27. Schedule tiles are three across and read well; the Plan tab should match exactly, and
currently does not.

28. The mini-map segments are equal width regardless of duration, so a 14-day window looks
the same as a 2-day wave. Scale segments by duration.

29. No hover state on the journey tiles despite them being links.

30. Tab badges use three different shapes ("9/32 steps done", "2", "3w"). One pattern.

## E. Exports

31. Verify the PDF end to end with the new tabs: cover, the Progress summary, Schedule by
wave, every step expanded, the JSON appendix, page breaks between waves, no dark
backgrounds, no clipped tiles. The three-across grid must become one or two columns in
print.

32. The change record should be one row per step with: step, kind, goal, population,
planned date, actual date, evidence, rollback. That is the artifact a change board wants,
and it should open cleanly in Excel as well as Markdown — offer CSV alongside.

33. The plan file should contain a human-readable header comment block (tool version,
tenant name, baseline pin, generated date) so someone opening the JSON in a text editor
understands it without documentation.

34. Print the Findings page too: it is the document people will forward, and it has never
been checked in print.

## F. Making it distinctive

The app currently looks like a competent dark dashboard: correct, generic. Four moves that
would make it recognisably itself, in order of impact per unit of work.

**1. A visual signature: the ring.** The product's core idea is staged rollout. Make the
ring the visual motif everywhere: a small concentric-ring glyph as the logo mark beside the
IAMAI wordmark; ring progress indicators (a segmented circle, one arc per ring) on every
step tile instead of a status chip alone; the journey band as concentric arcs rather than
six columns. One shape, used consistently, is what makes a tool look designed rather than
assembled.

**2. Typography with a point of view.** The current stack is the system sans everywhere.
Pair a distinctive display face for headings and numbers with the system sans for body:
something with character but neutral enough for enterprise (for example, a grotesque like
Inter Display or Space Grotesk for headings, and keep tabular figures for all numerals).
Numbers are the product; give them a face. Self-host the font, no CDN.

**3. Motion that carries meaning, not decoration.** Three places only:
- Page and tab transitions: a 150 ms cross-fade with an 8 px upward slide, respecting
  `prefers-reduced-motion`.
- Progress and state changes: when a step moves from Ready to Done after a re-scan, animate
  the ring filling and flash the row once. The user's work should be visibly acknowledged.
- Data arrival during a scan: sections fade in as they land rather than appearing abruptly,
  and the progress bar eases rather than jumping.
Nothing else moves. No parallax, no hover lifts, no bouncing.

**4. A deliberate colour story.** Right now teal is the accent and status colours are
generic. Give the plan a temperature: past (done) in a settled slate-green, present (ready,
soaking) in the teal accent at full strength, future (planned, blocked) in a cooler muted
blue. Then the journey band, the mini-map, the tiles, and the print layout all read the same
way at a glance, and colour carries meaning instead of decoration. Status colours (danger,
warning) stay reserved for actual risk, never for "planned".

Two smaller touches worth the effort: a hand-drawn-feeling empty state illustration for
"no plan yet" and "nothing needs attention" (line art, one accent colour, no stock art), and
a printed cover page with the ring motif and the tenant name that makes the PDF look
authored rather than exported.

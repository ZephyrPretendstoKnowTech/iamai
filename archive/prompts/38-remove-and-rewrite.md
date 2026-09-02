# 38 — Remove what does not earn its place, and rewrite what does

Precondition: 37 committed. Read docs/qa/review-07-findings.md sections R and C.

Simplicity is the standard: if an element does not change what the user knows or does, it
goes. Removing is the default; rewriting is for things with a real job.

## Part 1 — Removals

Remove R1 to R22 exactly as listed. Notes on the ones with consequences:

1. R1 to R5: the opt-out disappears from every question. Questions 1 and 2 have no opt-out
   at all. Where an alternative is legitimate, there is exactly one, labelled "Doesn't exist
   yet". The reason box and Confirm button go with it.
2. R12 and R13: Roadmap tabs become **Plan · Schedule · Export**. Watch-first items move to
   the top of Do this next. Progress becomes the Plan tab's header line.
3. R14: Prompt pack exists once, on the Export tab. Remove the sidebar entry and fix the
   route so the remaining link works (L7).
4. R19: the Licensing table lists only capabilities a goal uses. Drop the seat column unless
   seat coverage changes a recommendation, in which case say how.
5. R22: either compute the time estimate per step or remove it from Do this next.

## Part 2 — The Start page and the tool card

6. Rewrite the Start headline and subhead (C1). The visitor has a tenant and a fear, not a
   baseline. The headline should say what they get: knowing what a Conditional Access change
   will do, who it will lock out, and what order to make changes in. The word "baseline"
   may appear later on the page, once it has been explained, not in the headline.
7. Rewrite the tool card on getiamai.com to match, and the meta description with it.
8. Every claim on the Start page must be checkable and appear once. Remove the duplicate
   read-only statements (R20 applies to the reads page; check Start for the same pattern).

## Part 3 — Copy fixes

Apply C2 to C20 as written. Notes:

9. C7 (Baseline page): two sentences on what a baseline is, before anything else. Credit Jon
   Hope as a Microsoft MVP in identity and access with a link. Say when this copy was
   captured, and recommend reloading it every month or so to pick up changes.
10. C10: never print a baseline author's name as a proposed tenant name; the proposal is
    generated from the goal, and the source name appears once, in smaller text, as
    provenance.
11. C12: the Why section says why this matters **for this tenant**: the goal, the risk it
    closes, and the number of people it touches here. Product prose from Microsoft is not a
    Why.
12. C13: fix the two malformed "what could go wrong" entries and add a test that each entry
    has exactly one risk, one piece of tenant evidence, and one source.
13. C14: portal wording, always. Map every control name to the portal's own label.
14. C15: the announcement uses the organisation's display name from /organization, and says
    plainly if that name looks like a tenant identifier rather than a company name.
15. C18 and C19: Export becomes four cards with one primary action each; the unredacted
    warning sits directly above the checkbox that enables it.
16. C20: every free-tier ladder item links to its step, or the ladder says why it cannot.

## Finishing

Regenerate the UI inventory. The copy lint must pass. npm test, vite build, commit by part,
push. Report the number of strings removed and the pages with the largest reduction.

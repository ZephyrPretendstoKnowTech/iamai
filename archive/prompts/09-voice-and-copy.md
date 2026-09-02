# 09 — Voice and copy

Precondition: 08 committed. Read docs/design/ux-review-01.md §1 first; those rules are binding.

1. Create `src/copy/` with every user-facing string in one place (page copy, tile definitions, chip labels, statement templates, step titles). Components and pages import from it; no string literals in JSX except punctuation.
2. Rewrite all copy to the voice rules: IAMAI as subject or imperative; no first person; no reassurance adjectives; developer vocabulary removed; one caveat per page maximum.
3. Start page rewrite: headline stays; subhead "IAMAI reads your tenant's policies, people, and sign-in records, compares them with a proven baseline, and produces a dated plan: who each step touches, what could go wrong, and the exact change to make." Remove the promise about emails. "How it works" card copy in the same voice.
4. Statement templates (Findings) become human sentences with the mechanics moved to the detail view. Required shapes, with explicit branches for n=0, n=1, 100%, and 0%:
   - In place: "<Goal>. Delivered by <policy A> and <policy B>." + " <N> account(s) excluded as break-glass." only when N>0.
   - Partial, control: "<Goal> — the current policy requires <what it requires>; the baseline expects <floor>. <N> of <M> <people> affected."
   - Partial, scope: "<Goal> applies to <N> of <M> <people>. Not covered: <reason list, each with count>."
   - Partial, session: "<Goal> — sessions currently <what they do>; the baseline expects <floor>. <N> of <M> affected."
   - Missing: "<Goal>. No policy does this yet. The baseline's policy for it: <name>."
   - Report-only: "<Goal> is in report-only via <policy> (<days> days, <failures> would-be failures)."
5. Summary paragraph generator (Findings → Summary) rewritten as a function with conditional sentences; unit-test the 0% / 100% / n=1 branches; the contradiction seen in review must be impossible.
6. Step titles: imperative, no "Create:"/"Adjust:" prefix; the kind renders as a Chip (New policy / Change / Prerequisite / Verify / Enforce / Recurring). Step summary lines in the same voice ("4 admins affected; nobody new is targeted").
7. Roadmap overview: "<Tenant>: 11 of 31 steps already in place. 20 remain. With a <preset> pace, the plan finishes by <date> (<n> weeks)."
8. Dates: relative + absolute everywhere ("in 9 days · Sep 10, 2026"); never raw ISO.
9. Legend and InfoTip definitions for every state, tile, and chip, written for a novice, stored in `src/copy/definitions.ts`.

Commit and push. Report any string you could not move into src/copy and why.

# 36 — Foundations: the inventory, the lint rules, and the Setup schema

Replaces the earlier draft of prompt 36. The layout, removal and Baseline-page work that
draft carried now lives in prompts 38 and 39; this prompt keeps only what those depend on.

Precondition: 35 committed. Read docs/design/review-method.md; it defines why these three
things exist. Read docs/qa/review-07-findings.md for the findings the lint rules must catch.

Work Part 1 first and show the inventory before changing anything else.

## Part 1 — The UI inventory

1. Write a script that generates `docs/qa/ui-inventory.md`: for every page, its headings,
   body sentences, button labels, link text, chip labels, tab labels, table column headers,
   stat tile labels, option labels, empty states, and info-tip definitions. Include word
   counts per page and per section.
2. Add two cross-page tables to the same file: every action label with the pages it appears
   on, and every negative or opt-out option with the pages it appears on. These are what make
   duplicate concepts visible without a reviewer having to remember.
3. Run it and commit the output. Report the duplicate and near-duplicate labels it finds
   before changing anything. Expected in the current build: three confirm labels for one
   concept, seven copies of one opt-out, two continue patterns.
4. Regenerating the inventory becomes part of every prompt that touches the UI.

## Part 2 — Lint rules that fail the build

Each rule is a test. Seed the deny-lists from review-07-findings.md and extend them whenever
a review finds a new instance of the same class.

5. Two distinct option labels whose normalised meaning matches (a curated synonym map seeded
   with: looks right / this is correct / detections look right; not applicable / nobody needs
   / not sure or none).
6. More than one primary button rendered on a page.
7. A row-count label on a table that is not paginated.
8. Any user-facing sentence over 25 words.
9. Any user-facing string containing a GUID or a truncated id (extend to the "6744cba6…"
   form).
10. Filler phrases, seeded with: "Before anything else", "It's worth noting", "in the
    evidence window", "inside the N-day drill window", and any second occurrence of
    "nothing leaves the browser" outside the footer.
11. The same factual claim repeated more than once on a page (exact-sentence match).

Report any rule that cannot be implemented reliably, with the reason, rather than
implementing a version that passes on everything.

## Part 3 — Setup questions become data

12. Define the question schema: `id`, `type` (pick-objects · confirm-default ·
    multi-select-confirm · toggle-grid), `optOut` (`none` | `doesNotExistYet`), `min` and
    `max` selections, `validationSubject`, and the copy keys for title, why-this-matters, and
    helper text. A question cannot define its own affordances.
13. Exactly one confirm affordance and one label across the whole app, used by every
    `confirm-default` question.
14. Questions 1 and 2 declare `optOut: none`. No question may declare more than one opt-out.
15. Convert all seven questions to this schema without changing their behaviour yet; the
    behaviour changes land in 38.
16. Add a test that fails if any question declares an affordance outside the schema, or a
    second opt-out, or a confirm label other than the shared one.

## Finishing

npm test, vite build, commit by part, push. Report: the duplicate labels found in Part 1, the
count of violations each lint rule catches on the current build, and any rule you could not
implement.

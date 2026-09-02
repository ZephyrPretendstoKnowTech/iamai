# 11 — Setup step polish and mapping consistency

Precondition: 10 committed.

1. Pickers use the shared Picker component. Empty-state suggestions ranked: (a) objects the tenant's own policy signatures infer for the question (break-glass, global exclusion, service accounts), (b) display names or UPNs matching break-glass|breakglass|emergency|admin|it-|it_|svc|service|exclusion|ca- (case-insensitive), (c) for accounts, cloud-only Global Administrators. Show a "why suggested" line under each. Multi-select with chips; list stays open; Done button.
2. Each question is a section with a numbered heading, a one-line purpose, the picker, validation results inline as Callouts, and a secondary action "Doesn't exist yet — add it to the plan" styled as a quiet button, not a chip.
3. Question 3 (extra care) keeps its behaviour; copy in the app voice.
4. Frameworks: nothing pre-selected; add "Not sure / none" which is mutually exclusive with the others.
5. Workloads (question 9): a grid of cards, one per workload, with icon, name, the evidence line ("SharePoint — sign-ins seen in the last 30 days"), and a toggle; a "Detections look right" primary action confirms all.
6. Progress line: "5 of 9 answered · 2 required remaining" and the required ones listed by name.
7. Vendor-specific baseline policies: add `vendor` to the goal/policy metadata for anything referencing a third-party app (start with Inforcer, detected by the app id in Jon's policies); they are not-applicable unless that app's service principal exists in the tenant, shown under Details → "Doesn't apply" with the vendor named. Add to SPEC.md §7 a note that vendor-specific policies in the default baseline are pending review with the baseline author.
8. Consistency with the roadmap: Setup answers are inputs to step generation. If break-glass accounts are selected and valid, no "create break-glass" step exists and the drill step depends on those accounts' last sign-in; if a required answer is missing, dependent steps are Blocked with the question named ("Blocked until Setup question 6 — choose a countries policy style"). Add tests.
9. Persist answers to the plan file with provenance as designed; re-opening Setup shows current answers.

Commit and push. Send screenshots of questions 1, 6, and 9.

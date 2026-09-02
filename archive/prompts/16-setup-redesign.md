# 16 — Setup redesign

Precondition: 15 committed. Read docs/design/ux-review-03.md §A4, §A5, §A6.

1. Layout: required questions first; optional questions under a collapsed "Advanced options" section. Progress line names required questions still open.
2. Answer feedback: choosing an opt-out or completing a pick collapses the question to a one-line "Answered: <choice>" summary chip with an Edit link and a green check; a toast confirms. Same for question 9. Fix question 7 (timezone): the select must not render a full-screen overlay; the Answered state updates on change.
3. Question 5 → "Service accounts": run the detection from §A5; if candidates exist, show them with evidence lines and Confirm / Not a service account per row; if none, the question does not appear. Confirmed accounts become the service-accounts group mapping (or a Phase 0 step to create the group).
4. Question 6 → "Countries": remove the style choice. Show countries seen in sign-in records with distinct-user counts, plus usageLocation countries, pre-selected; the user adds or removes; if no location data, say so and pre-select usageLocation countries only. Generates the allowed-countries named location as a Phase 0 step and the allowlist-style geo policy in the plan. Delete the "NoExclusions" variant from consideration.
5. Question 9 → "Workloads": two labels, "Detected" (with evidence) and "Marked in use by you" when toggled on without evidence; toggling off a detected workload asks for a reason. Card grid stays.
6. Question 1 validation: list every account sharing an Authenticator device name (§A6), and give each finding an action link (plan step or portal path).
7. Every question has an "Explain this" info tip and a "Why this matters" line; no paragraph longer than two sentences above a picker.

Commit and push. Send screenshots of the full Setup page with Advanced options collapsed and of question 6.

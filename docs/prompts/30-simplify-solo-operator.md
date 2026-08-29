# 30 — Simplify for the solo operator: "Do this next" and the automatic log

Precondition: 28 committed. Run this BEFORE 29, and amend 29 as described in Part 4.

The user this tool is for is one person, often the only person doing IAM, with no change
process and nobody to approve anything. Anything that asks them to govern, assign, or
maintain state will drive avoidance. Everything below either removes that or replaces it
with something the tool derives on its own.

## Part 0 — The rule

Add to CLAUDE.md under the UX rules:

- IAMAI never asks the user to maintain state it can detect. No manual status, no
  checkboxes, no "mark as done".
- IAMAI never asks for information that only matters to an organisation with a formal
  process: owners, approvers, sign-off, change numbers, CAB dates. If a feature needs one
  of those, it is enterprise-tier and waits.
- Any artifact for other people (client, manager, help desk) is generated on demand, never
  a field the user has to fill in first.

## Part 1 — Remove the scaffolding

1. Remove the per-step owner field from the plan model, the UI, and the plan file schema
   (keep the field reserved in the schema with a comment, so a later enterprise tier can
   use it; do not render or ask for it).
2. Remove the approval sheet from the planned exports and from SPEC. Record it in SPEC
   under a new "Enterprise tier (deferred)" section with one line of rationale.
3. Reframe the change record: it is "a record of what changed and when", useful for a
   client update or the operator's own notes. Remove change-board framing from its
   description and from the Export tab copy.
4. Notice periods stay as suggested dates, never as commitments. Wording: "Suggested: tell
   people on Tuesday, two working days before" rather than anything implying an agreement.
5. Effort estimates are reframed from quoting to fitting: "about 10 minutes" so the user
   knows what fits in the time they have. Remove any language about billing or quoting.

## Part 2 — "Do this next" becomes the front door

6. New default view on the Roadmap, above the tabs, replacing "This week" as the primary
   surface: **Do this next**. One to three items, never more. Each item shows:
   - the plain-language title,
   - one line on why it is next ("nothing blocks it, nobody is affected, 10 minutes"),
   - who it touches, in one phrase,
   - a single primary action (open the step),
   - and the estimated time.
7. Selection rules, in order: (a) unblocked prerequisites that other steps wait on, (b)
   Safe-today steps with zero affected users, (c) the readiness work that unblocks the most
   steps (for example, setting up MFA for the three people who lack it), (d) the highest
   value-to-disruption step that is Ready. Never show a blocked step here.
8. When there is nothing to do because everything is waiting on an observation window or a
   notice period, say exactly that with the date it changes: "Nothing to do until Sep 16,
   when the observation window ends."
9. After a re-scan, if any item was completed, the card leads with that: "Legacy protocols
   blocked is now enforced. Next: …".

## Part 3 — The automatic log

10. Maintain an **activity log** derived entirely from scans, never from user input. Each
    entry: date and time, what changed, which step it belongs to, and how it was detected
    (description tag or intent match). Entries cover: policy created, moved to report-only,
    enforced, modified, disabled, deleted; group or named location created that a step
    needed; readiness milestones (a user gained a method, device coverage crossed a
    threshold); break-glass drill observed; baseline updated; scan run.
11. Store the log in the plan file, append-only, with a cap of the most recent 500 entries
    plus a rolled-up summary of anything older.
12. Surface it as a "History" section on the Progress tab: a reverse-chronological list,
    filterable to "changes I made" versus "everything the scan noticed", with a CSV and
    Markdown export. No editing, no adding entries by hand.
13. The log is what the client update and the change record are generated from, so the user
    never writes either.
14. Tests: applying a fixture's changes across two scans produces the expected entries in
    order; an unplanned change (a policy modified outside the plan) is logged and marked
    unplanned; the log survives a plan file round trip.

## Part 4 — Amendments to prompt 29

15. In 29, drop the approval sheet from the adjacent-value list (it is deferred by Part 1).
16. In 29, the calendar export keeps the runbook body but drops any owner or approver
    fields.
17. In 29, the communications plan is presented as "what will be sent and when, ready to
    copy", not as a commitment table for a client agreement.

## Finishing

Run npm test and vite build. Commit by part. Push. Send screenshots of "Do this next" in
three states (work available, nothing to do until a date, and just-completed), and the
History section.

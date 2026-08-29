# 29 — Communications plan, AI bridges, adjacent value

Precondition: 28 committed. Read docs/design/comms-and-bridges.md. Section numbers refer to it.

## Part 1 — Communications (§1)

1. Compute an audience for every step from its population: everyone, segment (department, licence tier, persona group), named (fewer than 10 affected, listed individually), admins, helpdesk, none. A step may carry more than one.
2. Bundle messages: one bulletin per audience per week covering every step enforcing that week, in date order, with a lead paragraph, one short block per change, one "what to do" list, one contact line. High-disruption steps may claim their own message and the bulletin references it. Named audiences are never bundled into broadcasts and use the earliest notice period among the steps affecting them. Weeks with no qualifying step produce no bulletin. Reminders are one per bulletin.
3. Warn on the Schedule tab when the same audience would receive more than three messages in a month, and name the change that could move.
4. Add a communications plan table (Schedule tab and print pack): date, time, audience, channel, subject, steps covered.
5. Channels are copy-out only: email, Teams or Slack short form, help-desk note, portal notice. IAMAI sends nothing.
6. Recipient lists for segment and named audiences: copyable list plus CSV, with a line stating the data stays in the browser until the user exports it.
7. Tests: twelve steps in one week for the same audience produce one bulletin; a high-disruption step produces its own plus a reference; a week with only named-audience steps produces no broadcast.

## Part 2 — AI bridges (§2)

8. Add "Copy as prompt" beside Copy on: announcement, reminder, help-desk note, what to tell your manager, change record, executive summary, and the whole plan. Prompt shape per §2.1, with the facts embedded and an explicit "do not invent facts" instruction.
9. Add a Prompt pack page listing the prompts in §2.2, each pre-filled from the current plan, each copyable, plus a download of all of them as one Markdown file.
10. Add a grounding bundle download: plan, findings, and tenant profile as one JSON, redacted by default (no UPNs, display names, or tenant id), with a header block explaining the file. A toggle produces the unredacted version behind a plain warning.
11. Keep the no-AI statement accurate: IAMAI runs no models; these are prompts for the user's own tools. Say that on the Prompt pack page.

## Part 3 — Adjacent value (§3)

Implement items 1, 3, and 4 in this prompt; record the rest in SPEC.md as planned.

12. Post-enforcement watch: after a step is enforced, each scan compares sign-in failures carrying that policy against the days before enforcement, by user; the card shows the count, the concentration, and a revert threshold set when the step was scheduled (default: more than 5% of the affected population failing). Include it in the step's done-when and in the change record.
13. Calendar export: ICS invites for each enforcement window, with the portal path, done-when criteria, rollback, and watch threshold in the invite body.
14. Effort and call-volume estimate: admin minutes per step and an estimated help-desk contact count from the affected population and control type; totals on the Roadmap header and in the change record. State the basis of the estimate in one line.

## Finishing

Run npm test and vite build. Commit by part. Push. Send screenshots of the communications plan table, a bundled bulletin, the Prompt pack page, and a step showing the post-enforcement watch.

# 44 — Skipping steps, the recovery card, and exclusion drift

Precondition: 43 committed.

## Part 1 — Skipping a step

The plan is advice, not a contract. A person who cannot do something, or has decided not to,
must be able to say so and keep a coherent plan. What the tool owes them is an honest account
of what they are giving up, not an obstacle.

1. Every step gains **Skip this step**, except those in Part 1.6.
2. Skipping asks for a reason from a short list plus free text: not applicable to this tenant,
   the business declined, no licence, deferred to a later phase, another control covers it,
   other. The reason is stored in the plan and appears in the change record.
3. Before confirming, the panel states in plain words what the tenant is left exposed to,
   drawn from the goal's own risk text, and how many people remain affected by the gap. One
   short paragraph, no scare language, no persuasion beyond the fact.
4. A skipped step is not deleted. It shows as **Skipped** with its reason, is excluded from
   the plan's completion counts and from the schedule, and stays visible so the decision is
   auditable.
5. Skipping a step that others depend on names those steps and asks whether to skip them too.
   Skipping a prerequisite without its dependents leaves those dependents blocked, and the
   blocked reason says the prerequisite was skipped.
6. **Cannot be skipped:** any step that establishes or repairs emergency access. Break-glass
   account nomination, its must-fix validation items, and the exclusion group that keeps those
   accounts outside every policy. The Skip control is absent on these, and the reason given in
   one sentence: these are what make every other change reversible.
7. A high-risk skip (a goal with security value 4 or 5) is confirmed twice: the panel, then a
   typed confirmation of the goal's short name. No dark patterns, no shaming copy.
8. Un-skipping is one click and restores the step to its computed state.
9. Findings shows skipped goals in their own group with their reasons, never inside "needs
   attention", and the coverage percentage states that N goals were skipped.

## Part 2 — The recovery card

The audience is one person with no colleague to call. If a change goes wrong on a Friday, the
worst moment to be reading a plan is the moment they need it.

10. A single printable page, reachable from the Roadmap header and the Export tab, holding:
    the emergency access accounts by name and sign-in address (never the credential), where
    the credential is recorded per the Setup answer, the exact portal path to disable a
    Conditional Access policy, the exact path to set one back to report-only, what to do if
    the portal itself is blocked, and the tenant id and domain.
11. It renders and prints without a scan being fresh, and works from a saved plan file.
12. It carries the date it was generated and a line saying to reprint it after any change to
    emergency access.

## Part 3 — Exclusion drift

13. Every checkpoint records the member count of every group used as an exclusion in any
    policy. On any scan after the first, report growth: "Core - Exclusion - Break-glass has
    grown from 2 members to 9 since 14 September."
14. Growth beyond the number of nominated emergency access accounts is a finding, not a note,
    and names the members added if the group is small enough to name.
15. The same treatment for a policy's own direct exclusions.

## Finishing

npm test, npm run smoke, vite build, commit by part, push, confirm CI green and the build
stamp. Report which steps the tool refuses to skip and why, and confirm the recovery card
prints on one page.

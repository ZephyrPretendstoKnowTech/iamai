# 05 — Coverage engine and Coverage page

Precondition: 04-ux-flow.md is committed. Read docs/design/intents.md in full before starting; it is the specification. Do not improvise where it is explicit.

1. Create `data/goals.json` with the v1 catalogue from intents.md §4 (all 20 goals, P1/P2 `ca` implementations only for now; leave `free` implementations as empty arrays), `data/core-admin-roles.json` (the 14 template ids: Global Administrator, Privileged Role Administrator, Privileged Authentication Administrator, Security Administrator, Conditional Access Administrator, Exchange Administrator, SharePoint Administrator, User Administrator, Authentication Administrator, Application Administrator, Cloud Application Administrator, Helpdesk Administrator, Billing Administrator, Password Administrator), and `data/builtin-strengths.json` (the three built-in strengths with allowedCombinations).
2. `src/coverage/facts.ts` — `policyFacts(policy, strengths)` per intents.md §2, reusing `policyTraits` where it overlaps. Strength tier derivation per the table.
3. `src/coverage/strength.ts` — the control lattice and `satisfiesFloor(grant, session, floor)` per §3 including the AND/OR rule.
4. `src/coverage/classify.ts` — signature evaluation for every goal against facts; ad-hoc goal construction for unmatched baseline policies; floor raising per §5.
5. `src/coverage/population.ts` — resolve PopulationSpec and policy who/whoNot to user-id sets from the snapshot (members, guests by type, active role assignments, on-demand group members with the over-cap estimate path, direct users).
6. `src/coverage/coverage.ts` — the algorithm in §7, producing per goal: status, enforced/weak/reportOnly sets, reasons with ids, candidate policies with their contribution, and the statement per §8. Names in statements come from the snapshot; ids never appear.
7. `src/coverage/applicability.ts` — facets per §9 with auto-detection from service principals plus app sign-in summary / SP activity; overrides read from mapping (stub until prompt 06) defaulting to auto.
8. `src/coverage/organisation.ts` — the secondary report per §10.
9. Tenant group signatures: run the adapter's `groupSignatures` over the tenant's own policies to infer break-glass/global-exclusion groups and directly-excluded break-glass users; use these as the provisional "expected exclusions" until Mapping confirms them, and label them "assumed — confirm in Mapping".
10. All of the above is pure and Node-testable; implement the 14 test cases in intents.md §12 with authored fixtures.
11. Coverage page: summary bar (enforced / partial / absent / not-applicable / licence-limited counts, and a percentage over scored goals); one row per goal grouped by phase with the status chip and the statement; expandable detail showing candidate policies and their contribution, the reason groups with counts, and the affected users (name + UPN) behind each reason; a "Not in the baseline" section and the organisation report; the "assumed — confirm in Mapping" banner when mapping is incomplete; "Next: Roadmap" button.
12. Run it against the current tenant and compare with intents.md §11; where the result differs, decide whether the engine or the worked example is wrong, fix the engine if it's the engine, and record the outcome in docs/design/intents.md under a new "§13 First run" section.

Commit and push.

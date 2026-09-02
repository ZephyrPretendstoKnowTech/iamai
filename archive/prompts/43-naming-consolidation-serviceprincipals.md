# 43 — Naming, the organisation report, safe consolidation, and missing service principals

Precondition: 42 committed. Read docs/design/naming-and-consolidation.md in full.

## Part 1 — The naming explainer

1. Add a reference page, "Naming policies and groups", carrying §1 verbatim in structure:
   why a name matters, the policy pattern, the group pattern, the named-location pattern, and
   one worked example of each drawn from this tenant.
2. Every proposed name anywhere in the app links to it.

## Part 2 — Convention detection

3. Extend the existing prefix inference to detect separator, segment order and casing.
   Express every proposed policy, group and location name in the tenant's own convention.
   Below 60% agreement, propose the documented pattern and say it is a proposal.
4. Every object the plan asks the user to create carries a proposed name: policies, the
   exclusion group, pilot groups, named locations, authentication strengths.

## Part 3 — The organisation report

5. Build the section in §3 under Findings → Details. It never mixes with security findings and
   never affects the coverage score.
6. Consolidation candidates are found only where population and controls genuinely match.
   Persona-split policies are correct and must not be flagged; the existing rule stands.
7. Each item states what, why it matters in this tenant, and the exact change.

## Part 4 — Safe consolidation

8. Where consolidation is proposed, the step is the six-stage procedure in §4, not a rename
   and not a delete. Stage 3's comparison is computed from sign-in evidence and its result
   stated.
9. Renames are a separate, low-risk step type and say plainly that renaming changes no
   evaluation.
10. The tool never proposes deleting a policy. The final stage is disable, with a 30-day wait
    before deletion, and deletion is the user's decision.

## Part 5 — Missing service principals

11. Detect baseline references to first-party applications whose service principal is absent
    from the tenant. Today these silently match nothing.
12. For each, the step carries the two one-line commands from §5, separately copyable, with
    the one-sentence explanation and the note that the user runs it, not IAMAI.
13. If a needed action cannot be expressed in one line, give the portal path instead. No
    multi-line scripts anywhere.
14. Add a test that every generated command is a single line and uses only the documented
    Graph module cmdlets.

## Finishing

npm test, npm run smoke, vite build, commit by part, push, confirm CI green and the live build
stamp. Report how many consolidation candidates, naming mismatches and missing service
principals the golden tenant produces.

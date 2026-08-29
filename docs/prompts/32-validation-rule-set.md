# 32 — The validation rule set

Precondition: 31 committed and its blockers resolved. Read docs/design/validation-rules.md in full.

The break-glass checks have been incomplete twice and silently regressed once. This prompt
replaces the inline checks with a registry so that cannot happen again, completes the rule
sets, and makes blockers gate the plan.

## Part 1 — The registry

1. Create `src/validation/rules.ts` with the ValidationRule model in §1. Rules are pure,
   individually testable, and declare the snapshot data they need. `unknown` is a first-class
   result and an unknown on a blocker rule blocks.
2. Move every existing inline check into the registry with a stable id. No validation logic
   lives outside it.
3. Generate a reference page from the registry (route `#/checks`, linked from Reference)
   listing every rule: subject, severity, what it checks, and why it matters.

## Part 2 — Complete the rule sets

4. Implement every break-glass rule in §3, blockers, warnings, and notes, exactly as listed.
   The two new blockers that do not exist today are `bg.role.permanentGa` (permanently
   assigned active Global Administrator, not eligible-only) and `bg.initialDomain` (UPN on
   the tenant's `*.onmicrosoft.com` initial domain, read from `/organization` verified
   domains). `bg.notPersonal` and `bg.notInDynamicScope` are also new.
5. Implement the other subjects in §4: exclusion group, trusted named location,
   allowed-countries location, pilot group, service accounts, authentication strength.
6. `bg.credentialStorage` and `bg.signInMonitoring` cannot be detected. Ask each once in
   Setup, record the answer in the plan, and generate a Phase 0 step when the answer is no.

## Part 3 — Blockers gate the plan

7. Every subject with an unresolved blocker generates a Phase 0 step titled plainly, holding
   every blocker as a checklist with a portal path and the criteria that clear it.
8. No step that can deny access is Ready while break-glass or the exclusion group has an
   unresolved blocker. The blocked reason names the subject and the count.
9. "Do this next" and the Progress summary lead with blockers when any exist.
10. Setup findings are grouped Must fix / Recommended / Notes; chip counts match what is
    shown.

## Part 4 — Tests

11. One unit test per rule covering pass, fail, and unknown.
12. A worst-state fixture per subject asserting every blocker fires with the right text.
13. A plan-level test: with any break-glass blocker present, no deny-capable step is Ready.
14. A registry regression test asserting the full set of rule ids by subject, so a refactor
    that drops a rule fails the build.

## Finishing

Run npm test and vite build. Commit by part. Push. Report: the rule count by subject and
severity, what the golden tenant now shows for break-glass, and which steps are gated as a
result.

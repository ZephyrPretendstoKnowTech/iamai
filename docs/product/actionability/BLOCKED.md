# BLOCKED — Plan Actionability + Trust Correction

Format: `segment · task · root cause · what was tried · smallest next step`

## Blocked / deferred

- S0 · task 1 (code map, A3) · the audit findings file containing A1–A6 is not in the repository · searched docs/, docs/audit, docs/audits, root *.md and untracked files for A1…A6 markers; nearest in-repo material is `docs/audit/042-product-truth-decision-integrity.md`, `docs/audits/guidance-audit-01.md`, `docs/audits/steps/*.md`; the per-item findings exist only in the session memory file `iamai-audit-2026-09-11-plan-library.md` outside the repo · owner drops the audit findings file into `docs/product/actionability/` and updates the A3 line in RUN-CONTEXT.md; until then S1 and the §10 pre-enforcement classification treat A3 items as deferred.
- S0 · task 4 (V11 scope) · `interpretation.json` holds ten further `decisionRequired` references (`e663a7ce`, `9ee031a3`, `902993ed`, `5628ad67`, `2d25c298`, `cc7f9bb7`, `8d0564e5`, `1178bb5d`, `5f96c57d`, `0de51b52`) that V11 does not name · not mapped, per "apply only the listed outcomes" · owner decides whether each becomes a `sourceMapping` row (same rule as §10.7) or stays Cleanup material; the runtime today already holds a policy on any unexplained excluded group.

## Choices

- S0 · V8 · the shared-devices package patches every plan policy that prompts a person (runtime-derived from `promptsPeople` in `src/roadmap/strand.ts`, listed in `src/ui/surfaces/stepVars.ts`), not a fixed pair · chose the smallest reversible reading: the two `@created` rows (require-managed-device, session-lifetime) are confirmed as the baseline-known pair and no rows were added for the other prompting policies · S2 may derive the completion dependency from the runtime set instead of the two static rows if the lane engine needs it; that is an engine choice, not a table edit.
- S0 · V1 (`s-goal-azure-management-mfa`) · no pinned object implements the goal (`goalMap` has no entry; the nearest-named pinned policy `IAC - GLOBAL - GRANT - MFA - WindowsAzureAD-BaselineScopes` targets Windows Azure AD, not Azure management) · left the exclusions-group edge on `enforce` as the "does not reference it" outcome · none required.
- S0 · V2 (`s-goal-unmanaged-browser`) · no pinned object implements the goal, so the "pinned target does not exclude the emergency identities" branch was taken and a `baselineSafetyConflict:unmanaged-browser-emergency-exclusion` was recorded on `enforce` · raise with the baseline author; if the author supplies an object that excludes the exclusions group, the row becomes `create ← s-prereq-exclusion-group@complete`.
- S0 · pinned-refs.tsv · added a trailing `goal` column from `pinned.json` `goalMap` beyond the seven fields the segment names, so V1/V2/V4/V11 could be read from one file · none required.

## Chrome checks

- (none in S0)

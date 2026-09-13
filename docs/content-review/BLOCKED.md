
- runner · S0 · exit 1 with uncommitted changes · stashed as 'auto-stash after S0 (exit 1)'
  - S0 rerun (2026-09-13): the stash holds only the content-review specs and runner files, since committed in d703e15/0b65580; nothing to apply. Left in place, not dropped.

- R8 · renderer fix not needed at the lane engine; the reported case needs the real tenant's step state · lanes.ts already returns Ready · Correct before the unsaved-input Decision whenever drift is observed (unit test added). No fixture reproduces "enforced + drift + unanswered input → Decision": all 20 enforced Ready · Decision steps across the eight fixtures (Block Legacy Auth, Block Device Code, Guests MFA) read "Satisfied by … — no change needed", with no drift. The screenshot's drift is one the engine does not count: most likely the exclusions-group correction waiting on confirmation (see R9). Counting it would change what planLanes.ts `observe()` treats as drift, which is data flow (RUN-CONTEXT rule 4).

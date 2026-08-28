# Deferred from QA audits

Items found in an audit that are larger than the prompt that found them. Each
has a one-line reason; none is a shortcut accepted as good enough.

| # | Found in | Item | Reason deferred |
|---|---|---|---|
| D1 | audit-01 | Fixture user "Jordan Kim (guest)" shows the guest chip next to a name that already says "(guest)". | The synthetic tenant's display name contains the word; real tenants do not. Renaming the fixture user changes screenshots in `docs/screens/`. |
| D2 | audit-01 | Findings "Why not fully" reasons are engine strings ("never included by any candidate policy", "matching but disabled: …"). | The reasons are built inside `coverage.ts` with policy names interpolated; moving them to `src/copy` with the 0/1/all branches is a copy-model change across coverage and its tests. |
| D3 | audit-01 | Roadmap "If it goes wrong" on a verification campaign says "objects created can be deleted", the generic fallback. | Rollback text is per step kind; a verify step needs its own sentence and a test for each kind. |
| D4 | audit-01 | Inventory People "Type" column shows `member` / `guest` in lower case. | Comes from the raw `userType`; a shared user-type label belongs with the Chip work in Prompt 20. |
| D5 | audit-01 | Live-only states (scan running, scan failed, licence- or permission-disabled sections) were reviewed in code, not on screen. | Needs a connected tenant; roadmap.md §10. |
| D6 | prompt 20 §10 | The smoke test mocks at the snapshot boundary (`?dev=1&mock=1` loads the synthetic tenant and baseline) rather than answering raw Graph requests from a fixture. | Answering every collector endpoint with Graph-shaped JSON means a second fixture format that must be kept consistent with `fixtureSnapshot.ts`; the walk, the numbers and the console check are the same either way. Worth doing when the collectors change shape. |

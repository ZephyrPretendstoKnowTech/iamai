# 20 — Hardening and trust items

Precondition: 19 committed. These are items IAMAI needs before anyone outside this project uses it.

1. Repo hygiene: confirm docs/spikes/raw/ is gitignored and absent from the working tree; scan the whole repo (including history-visible files in the current tree) for tenant identifiers (UPNs, tenant GUIDs, user object ids) in committed files and replace with placeholders; report anything found rather than rewriting history unasked.
2. Error boundary and crash recovery: a React error boundary per page that shows a plain message, a "Download diagnostics (redacted)" button, and a "Start over" action that clears in-memory state but not the saved plan. No white screens.
3. Token expiry mid-scan: when MSAL cannot refresh silently, pause the scan, show "Your Microsoft session expired. Sign in again to continue.", and resume from the cached partial rather than restarting. Test with a forced 401.
4. Graph resilience: verify the retry policy end to end by injecting 429 with Retry-After and 504 in a test harness; assert the scan converges to a labelled partial rather than spinning, and that Lane A failures never abort Lane B or vice versa.
5. Plan file round-trip: save a plan, clear all local data ("Forget this tenant"), reload the plan, and confirm every step, mapping answer, and checkpoint restores; assert schema version handling for an older file. Add a test.
6. Accessibility pass: every interactive element has an accessible name; tables have headers associated; colour is never the only signal (status chips carry text); the app is usable at 200% zoom. Fix what fails.
7. Performance guard: generate a synthetic snapshot of 5,000 users, 40,000 sign-in records, 60 policies, and 200 groups; render Findings, Roadmap, and the People inventory against it. Record timings in docs/qa/perf-01.md and fix anything over 2 seconds to interactive (virtualise long tables if needed).
8. Print check: print each of Findings and Roadmap to PDF at the end and confirm no clipped columns, no dark backgrounds, and correct page breaks. Save the PDFs under docs/screens/20/.
9. Data freshness: show the scan age on every page that depends on it, and warn when it is older than 7 days with a Re-scan link.
10. First-run smoke test in CI: a headless test that loads the app, mocks Graph responses from a fixture, walks Start to Roadmap, and asserts the key numbers. This is the regression net for every future prompt.

Commit and push. Report anything from item 1 that needs Lachlan's decision.

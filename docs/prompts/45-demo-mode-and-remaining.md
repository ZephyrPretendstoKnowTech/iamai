# 45 — Demo mode, and the remaining review items

Precondition: 44 committed.

## Part 1 — Demo mode

The tool asks a stranger to connect a production tenant before it has shown them anything.
That is the largest single obstacle to somebody trying it, and to sharing it.

1. A **See it with sample data** action on the Start page, beside Get started. It loads a
   built-in fixture tenant and walks the whole flow — scan, setup answers, findings, roadmap,
   schedule, exports — with no sign-in and no Graph call.
2. The fixture is the `mid` tenant already used in tests, so demo mode exercises real code
   paths rather than screenshots. Sample names are obviously fictional.
3. A persistent banner while in demo mode: "Sample data. Nothing here is from a real tenant."
   Leaving demo mode is one click and clears its state.
4. Demo mode never writes to the same IndexedDB keys as a real tenant, and Forget this tenant
   is unaffected by it.
5. Every export is available in demo mode and every file is watermarked as sample data.

## Part 2 — Remaining items from review 09

6. The Do this next card leads with the three next actions; the watch-first item follows them.
7. One Microsoft Learn link per step, printed once.
8. The colon splice in "What could go wrong" on the compliance-policy entry: the Intune
   enrolment sentence is a separate fact and gets its own entry.
9. Message salutations follow the audience: a step affecting two named people is not
   "Hi everyone".
10. The admin-time total and the per-step estimates come from one derivation.

## Part 3 — Why this order

11. Each step gains a one-line answer to "why now": the dependency or readiness fact that puts
    it where it is. Where a step waits on another, name it and link it.
12. The Plan tab gains a compact dependency view: for the selected step, what it waits on and
    what waits on it. Two lists, no diagram.

## Finishing

npm test, npm run smoke, vite build, commit by part, push, confirm CI green and the build
stamp. Send a screenshot of demo mode on the Start page and one of the roadmap in demo mode.

# CLAUDE.md — working rules for this repo

Read `SPEC.md` first. It holds every product decision; do not re-decide anything in its §2 table.

## Non-negotiables
- Read-only. Never add a Graph write scope or any call that mutates a tenant, even behind a flag.
- No server, no telemetry, no CDN imports. Everything ships in the bundle. The trust story is "review the code, then connect."
- One admin-consent screen with the full read scope set from `SPEC.md` §4. No staged consent.
- Product copy says "predicted impact, confirmed in report-only." Never promise no lockouts.
- Baseline `state` from any source is lab state; treat every baseline policy as intended-enforced.
- Never bundle policy content from third-party baseline repos; ship path indexes (`baselines/*.index.json`) and fetch raw files at a pinned commit.
- Any Graph 403 or licence error disables a section with a plain reason; it never fails the scan.
- Never commit tenant-derived data. Diagnostic and spike outputs go under gitignored `docs/spikes/raw/`; findings docs use redacted identifiers (no UPNs, user object IDs, or tenant GUIDs). The spike harness redacts UPNs/GUIDs in anything it writes to disk.

## Stack
Vite + TypeScript + React, `@azure/msal-browser`, Web Worker for the replay engine, IndexedDB via `idb`.
`tsconfig` uses `erasableSyntaxOnly` so Node can run `.ts` directly; keep it that way (no enums, no parameter properties).

## Commands
- `npm test` — Node's built-in runner over `src/**/*.test.ts`
- `npm run analyze -- <path-to-cloned-baseline-repo>` — run the adapter on real data
- `npm run build-index -- <clone> <owner> <repo> "<label>" > baselines/<owner>-<repo>.index.json`

## Product rules (2026-08-27)
- IAMAI speaks as an advisor, never as a checklist — in the third person or the imperative (the UX rules below override the earlier first-person voice).
- Names, never IDs, anywhere a human reads (`src/names.ts`); an id in parentheses only when it matters.
- Ask the operator only what cannot be inferred (the Setup wizard's ≤9 questions); auto-resolve the rest.
- Handle-with-care users are never excluded — changes apply, with extra caution, verification gating, and named callouts.
- Every step: per-tenant impact, a Learn link or exact instructions, the danger areas by name.

## UX rules (binding)

- Voice: IAMAI is the subject or the sentence is imperative. Never first person. No reassurance adjectives. See docs/design/ux-review-01.md §1.
- No developer vocabulary in user-facing copy: no lane names, snapshot, beta, rows, ms, GUIDs, raw ISO dates.
- Every number a user sees has an InfoTip definition in src/copy/definitions.ts.
- Every page ends with a Next action or says why it can't.
- Generated sentences have explicit branches for 0, 1, all, and none. A contradiction is a failing test.
- Use the shared components in src/ui/components; do not write bespoke CSS for something a component covers.
- Before committing any UI change, list the pages touched in the commit message.

## Conventions
- Pure logic (adapter, intents, engine) has no DOM or network imports so it runs in Node tests and in the worker.
- Tests use small authored fixtures, never copied third-party policy files.
- When adding a Graph call, record its scope, licence gate, and beta/v1.0 status in `SPEC.md` §4.

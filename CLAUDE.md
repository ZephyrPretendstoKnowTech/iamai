# CLAUDE.md — working rules for this repo

Read `SPEC.md` first. It holds every product decision; do not re-decide anything in its §2 table.

## Non-negotiables
- Read-only. Never add a Graph write scope or any call that mutates a tenant, even behind a flag.
- No server, no telemetry, no CDN imports. Everything ships in the bundle. The trust story is "review the code, then connect."
- One admin-consent screen with the full read scope set from `SPEC.md` §4. No staged consent.
- Product copy says "predicted impact, confirmed in report-only." Never promise no lockouts.
- Baseline `state` from any source is lab state; treat every baseline policy as intended-enforced.
- Never bundle policy content from third-party baseline repos; ship path indexes (`baselines/*.index.json`) and fetch raw files at a pinned commit. Exception (owner-authorised, prompt 51): `baselines/*.pinned.json` is a derived snapshot in IAMAI's own schema — normalised, placeholders resolved, author-specific exclusions stripped — written by the dev-only `scripts/pin-baseline.ts`; it is committed and read by the runtime and tests, and is what the supply-chain rule protects.
- Any Graph 403 or licence error disables a section with a plain reason; it never fails the scan.
- Never commit tenant-derived data. Diagnostic and spike outputs go under gitignored `docs/spikes/raw/`; findings docs use redacted identifiers (no UPNs, user object IDs, or tenant GUIDs). The spike harness redacts UPNs/GUIDs in anything it writes to disk.
- The surface has a maximum: `docs/design/target-state.md` and `docs/qa/page-contracts.json`. Never edit them; fix violations by removing what violates, or report the case.

## Stack
Vite + TypeScript + React, `@azure/msal-browser`, Web Worker for the replay engine, IndexedDB via `idb`.
`tsconfig` uses `erasableSyntaxOnly` so Node can run `.ts` directly; keep it that way (no enums, no parameter properties).

## Commands
- `npm test` — Node's built-in runner over `src/**/*.test.ts`
- `npm run inventory` — regenerate `docs/qa/ui-inventory.*` (required after any UI or copy change)
- `npm run lint-mutations` — prove every UI lint rule still fails against an injected violation
- `npm run layout-audit` — contrast in both themes, reflow at five widths
- `npm run smoke` — headless walk of the whole app against the synthetic tenant
- `npm run analyze -- <path-to-cloned-baseline-repo>` — run the adapter on real data
- `npm run build-index -- <clone> <owner> <repo> "<label>" > baselines/<owner>-<repo>.index.json`

## Done means green CI (hard rule)

A prompt is not finished when the tests pass locally, and not when the commit is
pushed. It is finished when the pushed commit's CI run has concluded **success**.

Before reporting any prompt complete:

```
gh run watch $(gh run list --limit 1 --json databaseId --jq '.[0].databaseId') --exit-status
```

or, equivalently, check `gh run list --limit 2` and confirm both `ci` and
`deploy-pages` are `success` for the pushed SHA. A red run is reported to the
user in the same message as the work, never left for them to find.

Why this is a rule and not advice: prompts 36 to 39 shipped on seven
consecutive red runs across both workflows, because "npm test passes here" was
treated as done. The failure was a fingerprint that hashed raw file bytes and so
disagreed with git about whether a CRLF file had changed — invisible locally,
fatal on Linux, and exactly the class of bug that only CI can catch. Local
verification cannot substitute for the run on the machine that actually
publishes.

`deploy-pages` runs `npm test` before it builds, so a failing test blocks the
deploy as well as the build. Both must be green.

`npm test` is not the whole suite. CI also runs `npm run smoke`, which drives the
built app in a browser, and it is the only check that sees rendered output. A
copy rewrite that npm test accepts can still fail there, because smoke matches
on what the page says. Run `npm test && npm run smoke` before pushing, not
`npm test` alone.

## Product rules (2026-08-27)
- IAMAI speaks as an advisor, never as a checklist — in the third person or the imperative (the UX rules below override the earlier first-person voice).
- Names, never IDs, anywhere a human reads (`src/names.ts`); an id in parentheses only when it matters.
- Ask the operator only what cannot be inferred: no questions before the plan exists; detected assumptions, editable on the Plan. Auto-resolve the rest.
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
- IAMAI never asks the user to maintain state it can detect. No manual status, no checkboxes, no "mark as done".
- IAMAI never asks for information that only matters to an organisation with a formal process: owners, approvers, sign-off, change numbers, CAB dates. If a feature needs one of those, it is enterprise-tier and waits.
- Any artifact for other people (client, manager, help desk) is generated on demand, never a field the user has to fill in first.

## Conventions
- Pure logic (adapter, intents, engine) has no DOM or network imports so it runs in Node tests and in the worker.
- Tests use small authored fixtures, never copied third-party policy files.
- When adding a Graph call, record its scope, licence gate, and beta/v1.0 status in `SPEC.md` §4.

## Standing orders (all sessions)
- You write no product prose. Every sentence comes from docs/design/content.json; a missing string is logged, never written.
- docs/design/ and docs/qa/page-contracts.json are the reviewer's; never edit them. The contract is the maximum a surface may render.
- The baseline wins: policy steps render from the pinned baseline through the translator; the catalogue keeps intent only.
- Exclusions go through the exclusions group, never the emergency accounts by name.
- Resume from the latest docs/reports/<prompt>.md; never re-scope work the report already scoped.
- Do not end a turn at a checkpoint. End only when the prompt's done-gate is green, a stop condition applies, or the session dies (then commit WIP with a note in the report).

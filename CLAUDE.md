# CLAUDE.md

IAMAI: a browser-only, read-only Microsoft Entra Conditional Access rollout planner. Three
surfaces (Today, Plan, Export) plus Connect, How, Inventory. Words come from
`docs/design/content.json`; the plan comes from the tenant snapshot + `MappingState`.

## Rules that cannot move
- Read-only: no Graph write scope, no call that mutates a tenant. No server, no telemetry, no CDN.
- Never commit tenant-derived data (UPNs, object ids, tenant GUIDs).
- Exclusions go through the exclusions group, never an emergency account by name.
- The pinned baseline wins: policy steps render from `baselines/*.pinned.json` through the translator.

## How to work
- Before editing: open the files the task names, once. No repository survey, no reading tests or archive/. Grep only for a symbol a named file references.
- One root cause per session. Fix it at the source; if a fact has two sources, delete one.
- Words: reuse a `content.json` key. Missing key → add it, say so in the commit message.
- While working: `npx tsc --noEmit` only. Tests once, before the push: `npm test`.
  Never run the walk (`npm run walk`), read a walk report, or add a walk invariant: CI runs
  the walk on every push to main (a job before deploy-pages; a P0 fails the job). A unit test
  per item is the acceptance. CI runs smoke.
- Commit per change, plain message. No reports.
- Done means: the acceptance is visible on screen, a unit test asserts it, pushed, CI green
  (CI runs the walk).
- The tool helps with strictness and never requires it. A decision may narrow scope or defer;
  it never weakens a grant. The baseline's version is always shown beside the person's choice.
- Do not read `archive/`. Do not read `content.json` whole; grep the key you need.
- Stop only for a contradiction or a write scope. Otherwise decide and continue.

## Stack
Vite + TypeScript + React, `@azure/msal-browser`, `idb`. `erasableSyntaxOnly`: no enums,
no parameter properties, so Node runs `.ts` directly.

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
- One root cause per session. Fix it at the source; if a fact has two sources, delete one.
- Words: reuse a `content.json` key. Missing key → add it, say so in the commit message.
- While working: `npx tsc --noEmit` only. Tests once, before the push: `npm test`.
  The walk (`npm run walk`) once, at the end of the task. CI runs smoke.
- Commit per change, plain message. No reports.
- Done = pushed and CI green (`gh run list --limit 2`).
- Do not read `archive/`. Do not read `content.json` whole; grep the key you need.
- Stop only for a contradiction or a write scope. Otherwise decide and continue.

## Stack
Vite + TypeScript + React, `@azure/msal-browser`, `idb`. `erasableSyntaxOnly`: no enums,
no parameter properties, so Node runs `.ts` directly.

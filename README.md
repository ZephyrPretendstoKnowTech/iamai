# IAMAI Planner

**Home:** https://getiamai.com · **The planner:** https://getiamai.com/rollout/

**A read-only, browser-only rollout planner for Microsoft Entra Conditional Access.**

Point it at a tenant and it reads the real policies, people, devices, licences, and recent
sign-ins, compares them with a proven baseline *by what policies do, not what they're called*,
and hands you a dated plan: who each step touches, what could go wrong (by name), the exact
change to make in the portal / as JSON / in PowerShell, and the announcement to send first.

Predicted impact, confirmed in report-only. Never "risk accepted".

## What it never does

- **Never writes to your tenant.** Read-only delegated Graph scopes only; there is no code path that creates, edits, or deletes anything — not even a report-only policy.
- **Never leaves your browser.** No server, no telemetry, no CDN. Everything ships in the bundle; tenant data lives in your browser's IndexedDB and "Forget this tenant" deletes it.
- **Never needs an account with us.** The source is public so anyone can verify all of the above.

## The journey

Connect → Today → Plan

1. **Connect** — one admin-consent sign-in. Consent creates an enterprise app; deleting it removes all access. The default baseline is Jon Hope's Conditional Access baseline, fetched live from GitHub at a pinned commit (only a path index is bundled); or upload your own package.
2. **Today** — the scan: configuration, users, devices, registration details, licences, and 30 days of interactive sign-ins, pulled in a Web Worker with honest coverage labels. The last scan is kept locally so nobody re-scans just to look around.
3. **Plan** — dated waves from a start date you pick. Nothing is asked first: the emergency-access accounts, the exclusions group, the sign-in countries, trusted locations, service accounts and the time zone are detected from the scan and shown as assumptions you can edit on the Plan; whatever is missing becomes the plan's first steps. Every step says its gap, who it touches, when it lands, and how to do it in the portal, as JSON, or in PowerShell; the plan file saves, loads, prints, and pastes into a ticket as Markdown.

The surface's maximum is written down in `docs/design/target-state.md` and measured by
`docs/qa/page-contracts.json`.

## Run it

```
npm install
npm run dev        # http://localhost:5173 (the registered redirect URI)
npm test           # Node's built-in runner over src/**/*.test.ts
npm run build      # static bundle in dist/
```

Other scripts: `npm run analyze -- <clone>` runs the baseline adapter on a local repo clone;
`npm run build-index -- <clone> <owner> <repo> "<label>"` builds a baseline path index;
`node scripts/spec-scopes.ts` regenerates the Graph-scope table in `SPEC.md` from the
collector registry.

## Read first

- `SPEC.md` — every product decision, Graph scopes and gates, known limits.
- `CLAUDE.md` — working rules and product rules for contributors.
- `docs/design/` — collection service, intents/coverage engine, roadmap, plan file, diagnostics.
- `docs/spikes/01-signin-logs.md` — what Graph's sign-in log store actually does under load.

## Baseline attribution

The default baseline is [Jon Hope's ConditionalAccessPolicies](https://github.com/Jhope188/ConditionalAccessPolicies).
IAMAI never bundles his policy content; it fetches raw files at a pinned commit and quotes
his Intent text with attribution.

## Something wrong or unclear?

This tool is only useful if it is accurate. If something looks wrong, tell me:
**feedback@getiamai.com**, or open an issue on this repository. There is a
"Something wrong or unclear?" link in the footer of every page that prefills the
message with the page, the version and the browser, and, only if you tick the
box, a summary of the scan in counts with no names and no tenant id.

# IAMAI

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

Start → Connect → Baseline → Scan → Setup → Findings → Roadmap

1. **Connect** — one admin-consent sign-in. Consent creates an enterprise app; deleting it removes all access.
2. **Baseline** — the default is Jon Hope's Conditional Access baseline, fetched live from GitHub at a pinned commit (only a path index is bundled). Or upload your own package.
3. **Scan** — configuration, users, devices, registration details, licences, and 30 days of interactive sign-ins, pulled in a Web Worker with honest coverage labels. The last scan is kept locally so nobody re-scans just to look around.
4. **Setup** — five to nine plain-language questions (emergency access, exclusion group, handle-with-care users, trusted locations…). Everything else the baseline references is resolved automatically.
5. **Findings** — the advisor's narrative: what's in place, what needs attention, and why.
6. **Roadmap** — dated phases from a start date you pick, the "safe today" wins, danger areas with named people and exact Entra paths, per-step impact, comms drafts, and a plan file you can save, load, print, or paste into a ticket as Markdown.

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

# CLAUDE.md

IAMAI: a browser-only, read-only Microsoft Entra Conditional Access rollout planner. Three
surfaces (Plan, MFA Readiness, Export) plus Connect, How, Inventory. Plan is the hero; MFA
Readiness is the person-level diagnostic that replaced Today (task 012, `#/readiness`). Words
come from `docs/design/content.json`; the plan comes from the tenant snapshot + `MappingState`.

## Rules that cannot move
- Read-only: no Graph write scope, no call that mutates a tenant. No server, no telemetry, no CDN.
- Never commit tenant-derived data (UPNs, object ids, tenant GUIDs).
- Exclusions go through the exclusions group, never an emergency account by name.
- The pinned baseline wins: policy steps render from `baselines/*.pinned.json` through the translator.
- Design authority runs: product truth → the approved HTML packs in `docs/design/approved/`
  (Home, Connect, Plan, MFA Readiness; `manifest.json` holds their hashes) → the brand skin in
  `docs/design/brand-decisions.md`. The packs own anatomy, never copy or technical truth.
  Production does not implement them yet; `docs/design/authority-reconciliation.md` says why,
  and the mockups under `docs/design/` are superseded records of what was built.

## How to work
- Before editing: open the files the task names, once. No repository survey, no reading tests or archive/. Grep only for a symbol a named file references.
- One root cause per session. Fix it at the source; if a fact has two sources, delete one.
- Words: reuse a `content.json` key. Missing key → add it, say so in the commit message.
- Batch related fixes and record an observable acceptance check for each.
- While working: `npm run verify -- <relevant .test.ts files>` runs type checking and focused tests.
  Before a routine push, `npm run verify -- --prepush <relevant .test.ts files>` adds the site build
  and overlaps those focused tests with browser smoke. Name every test file that covers the change.
  Check a decision, policy and completed step at desktop/mobile widths when shared UI changes.
  Test saving, completion and reopening when those transitions change; compare screen/export where applicable.
  CI runs the full suite once per PR update. Do not repeat a full local suite on unchanged code.
  Use `npm run verify -- --release` only when a local full preflight is necessary.
  Review the final diff against the requested scope and state any unverified outcome explicitly.
  Never run the walk (`npm run walk`) casually or add a walk invariant: a unit test per item
  is the acceptance, and the walk is a discovery tool, not a gate. It runs NOWHERE automatically
  — `ci.yml` has three jobs (checks, browser, ci) and no walk — so nothing but a deliberate
  local run exercises it. CI runs the full suite, the build and smoke.
- Commit per change, plain message. No reports.
- Done means: the acceptance is visible on screen, a unit test asserts it, pushed, CI green.
  deploy-pages waits for ci and publishes only the commit it passed on, so red CI means the
  live site is unchanged. Never push to main with the required check bypassed: that is the
  one thing that puts unvalidated code in front of people.
- Before pushing, run `npm run verify -- --prepush <the test files the change touches>`
  (typecheck, tenant guard, those tests, the build and browser smoke). Focused runs alone
  cannot catch a break in a file you did not think to name — that is what CI is for, and it
  is why the deploy waits for it. `--release` runs the full suite locally where you need it.
- The tool helps with strictness and never requires it. A decision may narrow scope or defer;
  it never weakens a grant. The baseline's version is always shown beside the person's choice.
- Do not read `archive/`. Do not read `content.json` whole; grep the key you need.
- Stop only for a contradiction or a write scope. Otherwise decide and continue.

## Stack
Vite + TypeScript + React, `@azure/msal-browser`, `idb`. `erasableSyntaxOnly`: no enums,
no parameter properties, so Node runs `.ts` directly.

# 00 — Recon

Factual inventory for the security audit. No judgements, no findings. Every line
here is something a specialist lane can start from. Compiled 2026-08-30 at commit
`50c30cc`, working tree clean.

## 1. Stack, build, deploy

| Thing | Value | Source |
|---|---|---|
| Runtime | Static SPA, no server, no backend, no database | `SPEC.md:3-5` |
| Framework | React 19.2.8, `react-dom` 19.2.8 | `package.json` deps |
| Build | Vite 8.2.2, `@vitejs/plugin-react` 6.1.0 | `package.json` devDeps |
| Language | TypeScript 7.0.2, `erasableSyntaxOnly` (Node runs `.ts` directly) | `CLAUDE.md`, `tsconfig.json` |
| Auth | `@azure/msal-browser` 5.19.0 | `package.json` |
| Storage | `idb` 8.0.3 over IndexedDB | `package.json`, `src/graph/collect/cache.ts:6` |
| Direct deps | 4 runtime, 6 dev. Lock: `lockfileVersion 3`, 74 entries | `package-lock.json` |
| Host | GitHub Pages, `getiamai.com` apex + `/rollout/` subpath | `SPEC.md`, `vite.config.ts` |

Workflows, both in `.github/workflows/`:

- `ci.yml` — `on: push: branches: ['**']` and `pull_request`. Steps: checkout,
  setup-node 24, `npm ci`, `npm test`, `npm run lint-mutations`, `npm run build`,
  `npm run smoke`, `npm run layout-audit`. No `permissions:` block declared.
- `deploy-pages.yml` — `on: push: branches: [main]`, `workflow_dispatch`.
  `permissions: contents: read, pages: write, id-token: write`
  (`deploy-pages.yml:18-21`). Concurrency group `pages`.

Neither uses `pull_request_target`. No `index.html` meta tag for
Content-Security-Policy or Referrer-Policy — grep for `csp|content-security|referrer`
over `index.html` and `home/index.html` returns nothing. GitHub Pages serves no
custom response headers, so there is no header-based CSP either.

## 2. Entrypoints

**Routes** — hash routing, resolved in `src/ui/shell/AppShell.tsx:68-81`
(`useHashRoute`). Valid set built from `STEPS` + `REFERENCE` plus three literals
(`AppShell.tsx:60-65`): `start, connect, baseline, scan, mapping, coverage,
roadmap, licensing, reads, checks, inventory, baseline/package, roadmap/prompts,
components` (last is `import.meta.env.DEV` only). Unknown hash falls back to
`start`. Deep link `#/roadmap/step/<id>` parsed by `STEP_LINK`
(`AppShell.tsx:66`, `useHashStepId` at `:89-101`) — the id is
`decodeURIComponent`'d and used to select and scroll to a step.

**Worker** — one, `src/graph/collect/worker.ts`, created at
`src/graph/collect/runScan.ts:26` via `new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' })`.
Inbound message types handled: `start`, `token`, `cancel` (`runScan.ts:33,54,78`;
handler in `worker.ts`). Outbound messages pass through a redacting wrapper at
`worker.ts:51` (`ctx.postMessage({ ...m, reason: redactIdentifiers(m.reason) })`).

**File upload** — baseline package upload, `src/ui/pages/BaselinePage.tsx:121`
(`<input type="file" accept=".json" multiple>` → `loadUpload`). Plan file import,
`src/ui/pages/RoadmapPage.tsx` (`fileInput` → `loadPlan`).

**Clipboard** — `navigator.clipboard.writeText` via `copy()` in
`src/ui/pages/RoadmapPage.tsx`; `copyPrompt` for copy-as-prompt.

**Downloads** — `downloadFile` at `src/ui/format.ts:38-39`
(`URL.createObjectURL(new Blob(...))`). Callers: `DataTable.tsx:66` (CSV),
`ErrorBoundary.tsx:37`, `MfaViabilityScreen.tsx:190` (diagnostics),
`RoadmapPage.tsx` (plan file, change record ×2, grounding bundle, prompt pack,
history, ICS).

**mailto** — `src/feedback.ts:59-61`, `mailtoHref` → `window.location.href`
assignment at `src/ui/FeedbackPanel.tsx:49`.

## 3. Outbound destinations

| Destination | Constructed at | Notes |
|---|---|---|
| `https://graph.microsoft.com/{v1.0,beta}/…` | `src/graph/collect/http.ts:83` (`fetch(url, …)`); URLs built by `collectors.ts`, `laneB.ts`, `onDemand.ts` | The only production data fetch |
| `https://raw.githubusercontent.com/{owner}/{repo}/{commit}/{path}` | `src/baseline/github.ts:34` | Baseline policy files, pinned commit |
| `https://login.microsoftonline.com/organizations` | `src/graph/msal.ts:14` (authority) | MSAL redirect |
| `/__spike/save?name=…` | `src/graph/spikes/spike1.ts:194` | **Dev only** — guarded `if (!import.meta.env.DEV) return` at `:193` |
| `mailto:` | `src/feedback.ts:61` | User-initiated |

Direct `fetch` calls outside `http.ts` all live under `src/graph/spikes/`
(`authMethods.ts:39`, `platformCheck.ts:83,92`, `reportsCheck.ts:37`,
`spike1.ts:40,150,265,350,412`, `spike1Extended.ts:55`). Whether those ship in the
production bundle is a lane-2 question. No `XMLHttpRequest`, `sendBeacon`,
`WebSocket`, `<script src>`, `<link rel=stylesheet>` to a remote origin, `@import`,
or remote font/image reference found in `src/`.

## 4. Token: obtain, store, pass, log

- Obtained: `getGraphToken(mode)` in `src/graph/msal.ts:56+`, from
  `msal.acquireTokenSilent` with redirect/popup fallback.
- MSAL cache: **`sessionStorage`** (`src/graph/msal.ts:18`).
- Client id `13f55900-…` hardcoded (`msal.ts:13`); authority `organizations`
  (`msal.ts:14`); `redirectUri: window.location.origin + (import.meta.env.BASE_URL ?? '/')`
  (`msal.ts:16`) — **derived from origin**, not hardcoded.
- Passed to the worker as a plain string in a `postMessage`
  (`runScan.ts:54` `{ type: 'start', token, … }`, refresh at `:33`).
- Used as `Authorization: Bearer` in `http.ts` and each spike file.
- Token-refresh gate: `src/graph/collect/tokenGate.ts`, `SessionExpiredError`.

## 5. Client-side persistence

IndexedDB database `iamai`, version 7 (`src/graph/collect/cache.ts:75-95`). Object
stores and key paths:

| Store | keyPath | Holds |
|---|---|---|
| `signin-rows` | `['tenantId','id']` | Raw sign-in evidence rows |
| `evidence-meta` | `tenantId` | Coverage window, counts |
| `group-members` | `['tenantId','groupId']` | Transitive member ids, display name, membershipRule |
| `mapping` | `tenantId` | Setup answers |
| `plan` | `tenantId` | Steps, statuses, history, checkpoints, log |
| `snapshot` | `tenantId` | Whole tenant scan |
| `baseline` | `tenantId` | Loaded baseline package/origin |

Every store is keyed by `tenantId`. Other client storage:

- `sessionStorage`: MSAL cache; `iamai.findings.controls`
  (`src/ui/pages/CoveragePage.tsx:73-83`).
- `localStorage`: `iamai-visited-start` (`App.tsx:60,69`), `iamai-theme`
  (`AppShell.tsx:110,118`), `iamai.nav.collapsed` (`Stepper.tsx:38,45`).

"Forget this tenant" — implementation and completeness is a lane-3 question.

## 6. Untrusted text → HTML / URL / query / filename / clipboard

Listed, not judged.

**Untrusted sources.** (a) Tenant data: user/group/device/policy/named-location
display names, UPNs, `membershipRule`, `appDisplayName`, role names. (b) Baseline:
policy JSON and README "Intent" prose from `raw.githubusercontent.com`, plus any
uploaded package. (c) User input: Setup pickers and the group search box, uploaded
files, the plan file.

| Sink | Site |
|---|---|
| Graph `$filter` | `src/graph/collect/onDemand.ts:91` — `startswith(displayName,'${q}')`, `q` from the picker, quotes doubled at `:86` |
| Graph path segment | `onDemand.ts:114,128,135` — `/groups/${groupId}` |
| Graph `$select`/`$expand` | `collectors.ts:150,160,169,177` (`baseSelect`/`select` variables), `registry.ts:40` |
| Graph `$filter` lambda | `laneB.ts:24` — `${lambda}` |
| Baseline URL path | `src/baseline/github.ts:34` — `${encoded}` |
| Filename | `MfaViabilityScreen.tsx:190`, `RoadmapPage.tsx` (`iamai-*-${snapshot.tenantId.slice(0,8)}`) |
| Clipboard | `RoadmapPage.tsx` `copy()` / `copyPrompt()` |
| mailto body | `src/feedback.ts:59-61` |
| Blob download | `src/ui/format.ts:38-39` |
| `href` from tenant/baseline data | `RoadmapPage.tsx:1868` (`step.learn.url`), `:1859` (`step.whyAttribution.url`), `:1948` (`m.citation.url`), `:1360` (`d.link.url`), `BaselinePage.tsx:140` (`index.authorUrl`), `:159` (`index.repoUrl`) |

Grep for `dangerouslySetInnerHTML` and `innerHTML` over `src/` returns **no hits**;
confirming that, and finding any other markup path, is lane 4.

## 7. Directory layout

| Module | One line |
|---|---|
| `src/baseline/` | Fetch, parse and normalise baseline packages; GitHub URL construction |
| `src/copy/` | All user-facing strings, by page/feature |
| `src/coverage/` | Intent compilation, goal classification, coverage scoring |
| `src/derive/` | The canonical counted sets (steps, goals, people) |
| `src/graph/` | MSAL, scopes, the collector registry, HTTP, the scan worker, dev spikes |
| `src/licensing/` | Capability and seat detection from assigned plans |
| `src/mapping/` | The Setup wizard: questions, schema, suggestions, persistence |
| `src/roadmap/` | Plan generation, scheduling, rings, comms, exports, prompts |
| `src/scoring/` | MFA viability and priority scoring |
| `src/ui/` | React shell, pages, shared components, print document |
| `src/validation/` | The rule registry that gates the plan |
| `src/redact.ts` | `redactIdentifiers` — regex over UPN-shaped strings and GUIDs |
| `src/fingerprint.ts` | Source fingerprint for the UI inventory |
| `scripts/` | Inventory generator, smoke walk, lint mutations, layout audit, screenshots |

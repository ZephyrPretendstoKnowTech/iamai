# Pre-share audit (prompt 31)

Run on 2026-08-28 against `main` at `da18f50` and the fixes in the commits that follow it.
Every check below names its result and what changed. Automated checks run in CI on every
push (`npm test`, `npm run build`, `npm run smoke`). What could not be exercised without a
live tenant or a live Pages deploy is listed in `pre-share-blockers.md`.

## Part 1 — Nothing leaves the browser

| # | Check | Result | Evidence / what changed |
|---|---|---|---|
| 1 | No source file references a network destination outside `graph.microsoft.com`, `login.microsoftonline.com`, `raw.githubusercontent.com` | **Pass** | `src/network.test.ts`: every host in `src/**` and `index.html` is either a request host on that list or a link a person clicks (Learn, the portal, aka.ms, GitHub, LinkedIn); fetch/import/script/link/img/font/beacon/socket destinations must be on the request list; the collector registry and MSAL authority are checked explicitly; the styles self-host every font (`public/fonts`, no `@import`). Fails the build on a violation. |
| 2 | Built bundle: no remote `<script src>` or `@import`, no source maps | **Pass** | `dist/index.html` has one `<script type="module" src="/assets/…">`; no `sourceMappingURL` in any built JS; the only remote hosts inside the bundle are Learn/portal/aka.ms link strings and MSAL's own authority table (`login.microsoftonline.{com,de,us}`, `login.chinacloudapi.cn`, `login.windows-ppe.net`, `download.microsoft.com`, `169.254.169.254`), which the library holds for sovereign clouds and IMDS and never contacts under our configuration (authority is fixed to `login.microsoftonline.com/organizations`). |
| 3 | Every page after Scan works with the network blocked | **Pass on the mock; not exercised live** | The mock walk (`?dev=1&mock=1`) performs no network requests at all after load (the fixture stands in for Graph), and Findings, Roadmap (every tab), print and the exports all render from IndexedDB and memory. A live check with the network cut after a real scan is in the blockers file. |
| 4 | Redaction on every export path | **Pass** | `src/exports.test.ts` runs each export over the `small` fixture, which carries sign-in names, display names, a tenant id, an IP range and device names: diagnostics (`redactIdentifiers`) remove every sign-in name and id with stable placeholders; the redacted grounding bundle contains none of the five kinds; the change record, activity log (CSV and Markdown) and calendar carry no sign-in names or tenant id; the population CSV carries sign-in names by design (it is the mail-merge list) and the page says the data stays in the browser until exported. |
| 5 | Unredacted bundle behind an explicit action with a warning naming the contents | **Pass** | Export tab: a checkbox labelled "Unredacted" reveals a warning ("contains people's names and sign-in names… has left this browser"), and the file's own header repeats it. Tested in `exports.test.ts`. |

## Part 2 — Secrets, storage, the repo

| # | Check | Result | Evidence / what changed |
|---|---|---|---|
| 6 | No tenant-derived data in committed files | **Pass** | `git grep` for sign-in name patterns finds only `example.com`, `example.test` and `noreply@`; GUIDs found are Microsoft's well-known role template ids and first-party app ids in `data/*.json` and the fixture generator's deterministic ids; no IP ranges outside the documentation ranges (203.0.113.0/24 in fixtures); device names are `DEVICE-n`; screenshots come from the mock tenant (Contoso, Alex Morgan). `docs/spikes/raw/` is ignored. |
| 7 | No secret, certificate or token; the client id is the only Entra identifier | **Pass** | The only identifier is the SPA client id in `src/graph/msal.ts`; the authorization-code flow with PKCE has no secret. Stated in `SECURITY.md`. |
| 8 | Forget this tenant clears every store | **Pass** | `forgetTenant` deletes `signin-rows`, `group-members`, `evidence-meta`, `mapping`, `plan`, `snapshot`, `baseline` for the tenant, then signs out (MSAL's session-storage cache clears). Smoke now scans, forgets, and asserts zero rows for the tenant across every store and no MSAL keys in session storage. Fixed: sign-out in the dev mock threw `uninitialized_public_client_application`; `signOut` now returns to Start when MSAL was never initialised. |
| 9 | `SECURITY.md` | **Added** | What is read (with the registry as the source of truth), what is stored and where, what is never done, revoking via the enterprise app, reporting, the public client id. |
| 10 | `LICENSE` and baseline attribution | **Pass** | MIT licence present. The Baseline page names the source repository, author and pinned commit; policy files are fetched live from `raw.githubusercontent.com` at that commit (`src/baseline/github.ts`), never redistributed; only path indexes ship. |

## Part 3 — Honesty

| Claim (where) | Evidence |
|---|---|
| "No changes to the tenant: the app holds read-only permissions only." (Start) | `GRAPH_SCOPES` in `src/graph/msal.ts` are all `.Read`; no write scope anywhere; `network.test.ts` guards the destinations. |
| "Nothing leaves the browser. There is no server." (Start, footer) | Static bundle; the only server-side code is a dev-only Vite middleware (`apply: 'serve'`) for spike capture; `network.test.ts`. |
| "No account required with anyone." (Start) | No sign-up, no backend; sign-in is to the user's own Entra tenant. |
| "IAMAI runs entirely in the browser and only reads. The source is public." (Start, Connect) | Repository link in the footer; MIT. |
| "Entra ID P1 for sign-in records. IAMAI works without it, with less evidence." (Start) | Registry gates `registrationDetails` and sign-in logs on `entraP1`; the unlicensed walk in smoke shows the plan generating with sections disabled and a plain reason. |
| "Admin consent creates an enterprise app named IAMAI… delete that enterprise app: nothing else is left behind." (Connect) | Delegated consent only; `SECURITY.md` revocation section. |
| "Everything IAMAI requests from Microsoft Graph, generated from the same list the code runs from." (What IAMAI reads) | The page renders `COLLECTOR_REGISTRY` directly. |
| "IAMAI runs no models and sends nothing anywhere. These are prompts for your own assistant." (Prompt pack) | No model calls exist; every bridge is a clipboard copy or a download; `network.test.ts`. |
| "Conditional Access rollout planner for Microsoft Entra ID and Microsoft 365" (tagline, title) | Wording is "for Microsoft Entra", never "Microsoft's"; no endorsement is implied anywhere (checked: Start, Connect, footer, print cover). |
| Numbers agree across Progress, Findings and the Roadmap header | `src/ui/consistency.test.ts`: user counts, goal counts, MFA-ready share, question count, and now the comms plan (every bulletin step is a trackable step, bundled once per week) and the activity log (step entries point at existing steps; the scan entry counts the snapshot's users and policies). |
| Nothing is done, safe or verified without evidence | `consistency.test.ts`: every done step names its evidence (a delivering policy, tracking, or a dated history note); every safe-today step carries the evidence sentence; ready-to-enforce is backed by report-only results. |

Dev-only vocabulary ("beta", "rows") flagged by the page audit comes from the dev spikes
panel that renders only with `?dev=1`; the copy lint over `src/copy` is clean.

## Part 4 — First-run and failure paths

| # | Check | Result |
|---|---|---|
| 15 | Clean-profile walk, Start to Roadmap, print, save and reload | On the mock tenant: Roadmap renders 99 ms after navigation, Findings 0 ms (already computed), DOMContentLoaded 89 ms; print produced `docs/screens/27/roadmap.pdf`; save and reload of the plan file is covered by `plan.test.ts` and `tracking.test.ts` (v1 → v2). A clean-profile walk against a real tenant is in the blockers file. |
| 16 | `?dev=1&fail=1` | The worker forces one 403 and one 429; the disabled section carries "insufficient privileges" and the slow state shows; smoke asserts no page throws across the walk. |
| 17 | Unlicensed tenant (`?licence=free`) | Smoke: Findings renders from configuration and directory data and says "21 goals need a licence tier this tenant does not have"; Scan says "Sign-in records: not available on this licence (needs Entra ID P1 or P2)… nothing can be Verified without usable records"; the Roadmap header says "With this tenant's Entra ID Free, 2 of 23 steps are available now"; nothing crashes. **Fixed since:** the free-tier ladder is now the plan for a tenant with no Entra ID P1 (`src/roadmap/ladder.ts`, SPEC §12): ten phase 0 steps in ladder order, each with a per-tenant impact, exact portal instructions, its own verification and rollback, and a status the tenant proves. The mock free plan goes from 2 steps to 12, and the Conditional Access prerequisites that nothing could use are no longer asked for. |
| 18 | Non-admin or Global Reader sign-in | Not exercisable on the mock. By code: every collector treats a 403 as a section disable with the reason from Graph ("insufficient privileges"), never a crash; the Scan page shows each disabled section with its reason. **Fixed since:** `src/graph/collect/roles.ts` maps every registry scope to the roles that grant it; the Scan page names the role per refused section, says Global Reader grants everything IAMAI reads and writes nothing, and no longer labels a refused section "not available on this licence". Walked on the mock with `?dev=1&denied=1`; a live check with a Global Reader and a non-admin account stays in the blockers file. |
| 19 | Zero Conditional Access policies (`?policies=0`) | Smoke: Findings renders; the Roadmap renders with Do this next; the policy count reads "no Conditional Access policies in the tenant today"; the plan lists every goal as a create step in phase order rather than a wall of "missing". |

## Part 5 — Accessibility and performance

| # | Check | Result |
|---|---|---|
| 20 | Keyboard walk | Roadmap: 80 controls reached by Tab in order, no trap; Escape closes the InfoTip; focus is visible (outline via `:focus-visible`). |
| 21 | Labels and headers | Start and Roadmap: zero interactive elements without an accessible name; every table has header cells; every SVG is `aria-hidden` or labelled. **Fixed:** the Progress, Schedule, comms, change and week tables gained `scope="col"` / `scope="row"`; external links gained `rel="noopener noreferrer"`. Status is carried by text beside colour (chips, verdict lines). |
| 22 | Both themes at 360, 768, 1024, 1440, 1920 | No horizontal overflow on any Roadmap tab or on Findings at any width in either theme. Screenshots at 360 and 1440 in both themes of Start, Findings, Roadmap Progress and Roadmap Plan under `docs/screens/31/`. Contrast: the token pairs are held to WCAG AA by `tokens.test.ts`. |
| 23 | Longest main-thread task on the big mock (5,000 users, 60 policies) | Findings 65 ms · Roadmap Progress 149 ms · Roadmap Plan 0 ms (already rendered) · Inventory People 55 ms. All under 200 ms. The `large` fixture's roadmap engine runs in about 40 ms in the property tests; the huge fixture (25,000 users) about 200 ms. |

## Part 6 — Deployment readiness

| # | Check | Result |
|---|---|---|
| 24 | Subpath build | `BASE_PATH=/iamai/ vite build` rewrites the script, stylesheet and the self-hosted font to `/iamai/…`; routing is hash-based; the baseline index is bundled and policy files fetch from `raw.githubusercontent.com` by absolute URL; MSAL's redirect URI is now `origin + BASE_URL`. The Pages workflow (`.github/workflows/deploy-pages.yml`) builds from a clean checkout with `BASE_PATH=/<repo>/`. **Not yet exercised live:** see the blockers file. |
| 25 | `docs/RELEASE-CHECKLIST.md` | Added: redirect URI, publisher domain, public repo, the scrub, Pages, first-run screenshots, baseline pin. |

## What changed after the audit (blocker work)

- **The free-tier ladder is the plan without Entra ID P1** (`src/roadmap/ladder.ts`,
  `src/copy/ladder.ts`, `src/roadmap/stepDefaults.ts`, `src/roadmap/ladder.test.ts`,
  SPEC §12). Rungs carry `ladder: true`, read "Hardening step", verify themselves in the
  portal screen the instructions name, and roll back in that same screen. The
  Conditional-Access-only prerequisites are gated off on a free tenant, including the
  "turn security defaults off" step, which was the wrong advice when nothing can take
  their place.
- **A 403 names the role** (`src/graph/collect/roles.ts`, `src/copy/access.ts`,
  `src/graph/collect/roles.test.ts`). Registry rows gained `sourceKey`; SPEC §4 and the
  "What IAMAI reads" page gained a Least role column, generated from the same map;
  `SECURITY.md` gained the role ask. A refused section is no longer described as a
  licence limit.
- Smoke gained the unlicensed-ladder walk and the `?denied=1` walk. Screenshots under
  `docs/screens/blockers/`.

## What changed in this audit

- `src/network.test.ts`, `src/exports.test.ts` (new), `src/roadmap/changeRecord.ts` (the change record as a pure module), agreement and evidence tests in `src/ui/consistency.test.ts`.
- Smoke: unlicensed, zero-policy and forget-this-tenant walks.
- `signOut` no longer throws in the dev mock; `rel="noopener noreferrer"` on external links; `scope` on table headers.
- `SECURITY.md`, `docs/RELEASE-CHECKLIST.md`, `.github/workflows/deploy-pages.yml`; Vite `base` and MSAL redirect follow `BASE_PATH`.
- Dev switches for the audit walks: `?licence=free`, `?policies=0` on the mock tenant.

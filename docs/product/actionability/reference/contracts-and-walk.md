# Page contracts, the walk, the smoke, and how CI runs them

Reference extracted from source on 2026-09-12 (HEAD `4cde3e6`). Line numbers are file:line at that commit. Nothing here was produced by running the walk, the smoke or the build; no walk report was read.

## Sources

- `docs/qa/page-contracts.json`
- `scripts/walk.mjs`
- `scripts/walkContent.mjs`
- `scripts/walkContent.d.mts`
- `src/content/contentChecks.ts` (imported by the walk: `RE`, `staticFindings`, `beforeLines`, `headerTabsLine`, `readinessStatTitles`, `readinessAllWord`, `textAt`)
- `scripts/smoke.mjs`
- `package.json` (`walk`, `smoke`, `test`, `test:external`, `build:site` scripts)
- `.github/workflows/ci.yml`
- `.github/workflows/deploy-pages.yml`
- `.github/workflows/external-health.yml`
- Consumers of the contract file located by grep only: `src/ui/accessibility.test.ts`, `src/ui/design-lint.test.ts`, `src/content/contentChecks.test.ts`, `src/content/content.test.ts`, `src/roadmap/floor.test.ts`, `src/ui/surfaces/tabs.test.ts`, `src/exportsClean.test.ts`, `src/fingerprint.ts`
- For the contradiction check (grep only): `docs/product/actionability/RUN-CONTEXT.md`, `docs/product/actionability/IAMAI-Actionability-Dependency-Playbook.md`, `docs/product/actionability/BLOCKED.md`

---

## 1. Page contracts

### 1.1 The file and who reads it

`docs/qa/page-contracts.json` is version 3 (`"version": 3`, line 3). Its `$comment` (line 2) says it measures rendered **strings**, not visual anatomy: headings, tabs, tiles, columns, chips, buttons, summaries, links and prose budgets. An `allow` entry is an exact string, or a regex when it starts with `re:`. `forbid` and `forbidEverywhere` entries are case-sensitive substrings.

| Consumer | What it reads | Where |
|---|---|---|
| `scripts/walk.mjs` (CI, deploy-pages `walk` job) | `rules`, `repeaters`, `forbidEverywhere`, and for each surface it diffs: `allow.{headings,tabs,buttons,summaries,links,chips}`, `forbid`, `budget`, `rowBudget`, `reach.exclude`. Also the `plan`, `plan.step` forbid lists for the offline plan-file scan | walk.mjs:59-63, 365-389, 509-510, 1537-1551, 1612-1615, 1789 |
| `scripts/walkContent.mjs` `contentFindings` (called by the walk and by `contentChecks.test.ts`) | `forbidEverywhere`; `forbid` of `plan.step` and `plan.step.more`, applied to content.json strings | walkContent.mjs:226-235, 310 |
| `scripts/smoke.mjs` (CI `ci` job, and external-health) | `forbidEverywhere`; `plan.step` `forbid`; `plan.step.more` `allow.headings` (to exempt More headings from the print check) | smoke.mjs:34-42 |
| `src/ui/accessibility.test.ts` (`npm test`) | `shell.allow.tabs` equals the header tabs; every surface's `allow` lists carry no retired "Today" | accessibility.test.ts:34, 274-283 |
| `src/ui/design-lint.test.ts` | `enforceAll` (only as a gate on a legacy allow list being empty) | design-lint.test.ts:53, 305 |
| `src/content/content.test.ts` | `forbidEverywhere`; `plan.step` + `plan.step.more` `forbid` over content | content.test.ts:17-51 |
| `src/roadmap/floor.test.ts` | `plan.allow.headings` | floor.test.ts:271-293 |
| `src/ui/surfaces/tabs.test.ts` | `forbidEverywhere` | tabs.test.ts:95 |
| `src/exportsClean.test.ts` | `forbidEverywhere`; `plan.step` `forbid` | exportsClean.test.ts:21-23 |
| `src/fingerprint.ts` | the file as a fingerprinted input (`FINGERPRINTED_FILES`) | fingerprint.ts:32 |

### 1.2 How the walk turns an entry into a severity

`diffContract(label, c, d)` at walk.mjs:368-389. `d` is the in-page extractor's capture (walk.mjs:274-347).

| Contract key | Assertion as the walk applies it | Severity | walk.mjs |
|---|---|---|---|
| `allow.headings` | every visible `h1,h2,h3,h4` (not `.step-title`) matches an entry | P1 | 284, 370-372 |
| `allow.tabs` | every visible `[role=tab], .tab` matches | P1 | 287, 370-372 |
| `allow.buttons` | every visible `button, a.btn, a.button-like, [role=button]` (not `.infotip-btn`, not a tab, not `th` or inside `th`, not inside `.setup-question, .workload-card, .picker, .decision`, not inside a repeater) matches | P1 | 295-296, 370-372 |
| `allow.links` | every visible `a[href]` (not `.btn`, not a tab, not in a repeater) matches | P1 | 297, 370-372 |
| `allow.chips` | every visible `.chip` (not in a repeater, not in `.picker`) matches | P1 | 298, 370-372 |
| `allow.summaries` | every `summary` not skipped matches | P1 | 299, 370-372 |
| `allow.tiles`, `allow.columns` | **not read by the walk** | none | 370 (kinds list omits them) |
| `forbid` | substring absent from the root's `textContent` (minus `reach.exclude`, `.devtools, .print-only, [hidden]`) | **P0** | 315-318, 375 |
| `forbidEverywhere` | substring absent from prose text (root minus `.devtools, .print-only, [hidden], pre, code, .mono, .code-block`) | **P0** | 319-321, 376 |
| `budget.sentences` / `budget.words` | page prose outside repeaters (`p, li, .sub, .reason, .advisor, .muted, .callout` leaf blocks, minus text already claimed as a heading/button/link/chip/tab/summary) within budget | P1 | 301-325, 377 |
| `rowBudget` (else `rules.rowMaxSentences` 2 / `rules.rowMaxWords` 30) | each visible repeater element within budget | P1; P2 "(contract question)" when the repeater is `.copy-box` or `.decision` | 378-386 |
| `rules.stepTitleMaxWords` (9) | each `.step-title` at most 9 words | P1 | 285, 387 |
| `rules.sentenceMaxWords` (25) | each page-prose sentence at most 25 words | P1 | 325, 388 |
| `rules.blockedReasonMaxWords` (12) | offline plan-file scan only: `blockedReason` at most 12 words | P1 | 1822 |
| `rules.tipMaxSentences`, `rules.tipMaxWords` | **not read by any script** | none | — |
| `repeaters` | `.plan-row, tr, .phase, .export-card, .found, .decision, .names, .copy-box, .tip, .ring`: controls inside are rows, not allow-list items | (structure) | 62, 290-291, 304-314 |
| `reach.exclude` | removed before the diff | (structure) | 510, 1538, 1550 |
| `reach.route`, `reach.state`, `reach.actions`, `reach.root`, `reach.mock`, `reach.eachTab`, `status`, `name`, `mockStates`, `enforceAll` | **not read by the walk**; the walk picks its own route, root and clicks (see §2.1) | none | — |

Global lists (page-contracts.json:5-31, 960-976):

| Key | Value |
|---|---|
| `rules` | sentenceMaxWords 25 · rowMaxSentences 2 · rowMaxWords 30 · blockedReasonMaxWords 12 · stepTitleMaxWords 9 · tipMaxSentences 2 · tipMaxWords 25 |
| `repeaters` | `.plan-row`, `tr`, `.phase`, `.export-card`, `.found`, `.decision`, `.names`, `.copy-box`, `.tip`, `.ring` |
| `mockStates` | `signedOut`, `noScan`, `scanning`, `scanned` |
| `enforceAll` | `true` |
| `forbidEverywhere` (P0 in walk prose; smoke checks step tabs, print, downloads) | `__IAMAI` · `Setup question` · `Setup has no answer` · `urn:user:` · `Assumes` · `assume` · `Assume` · `Recovery card` · `undefined` · `**` · `handle-with-care` · `168h` · `(p2)` · `Wave ` · `wave ` |

### 1.3 The Plan page

Severity column is what the walk assigns (§1.2); "not diffed" means no script compares the DOM against that entry.

#### `plan` (page-contracts.json:458-552) — diffed by the walk against `main.page` on `/plan`, excluding `.step, details > *:not(summary)`

| Key | Asserts | Selector / text | Severity |
|---|---|---|---|
| reach | route `/plan`, state `scanned`, exclude `.step, details > *:not(summary)` | only `exclude` is read | — |
| allow.headings | only these headings | `Plan` · `Preparation` · `re:^Phase \d+$` · `Cleanup` · `Microsoft recommended, not in this baseline` · `Waiting on something else` · `Complete` | P1 per miss |
| allow.tabs | only these tabs | `Roadmap` · `Status` · `Work type` | P1 |
| allow.tiles | none | `[]` | not diffed |
| allow.columns | only these columns | `State` · `Step` · `Impact` · `When` | not diffed |
| allow.chips | only these chips (outside rows) | `In place` · `Ready` · `Blocked` · `Scheduled` · `Report-only` · `Ready to enforce` · `Needs decision` · `Needs attention` · `Enforced` · `Skipped` · `Doesn't apply` | P1 |
| allow.buttons | only these buttons | `Start the plan` · `re:^Needs attention\s*\d+$` · `re:^Up next\s*\d+$` · `re:^Show completed\s*\d+$` · `+` · `−` | P1 |
| allow.summaries | only these | `re:^Doesn't apply here \(\d+\)$` · `re:^Not licensed \(\d+\)$` · `re:^Housekeeping \(\d+\)$` | P1 |
| allow.links | only these | `Plan settings` · `re:^(Passkey or security key, proven\|Authenticator app, proven\|Windows Hello only\|Set up, not proven\|Nothing set up)\s*\d+$` · `How to use this plan →` | P1 |
| budget | page prose ≤ 6 sentences / 90 words | — | P1 |
| rowBudget | (absent) rules default 2 sentences / 30 words per repeater | — | P1 (P2 for `.copy-box`, `.decision`) |
| forbid | none of these substrings on the surface | `Assumes` · `scanned` · `Before anything else` · `Housekeeping (0)` · `(0)` · `Do this next` · `What needs attention before you start` · `Nothing has started yet` · `The journey` · `Planned against actual` · `History` · `Safe today` · `Why not fully` · `Recovery card` · `help-desk contacts` · `hours of admin time` · `an account IAMAI could not name` · `Setup` · `Readiness table` · `time zone` · `168h` · `Wave` · `wave` · `Sessions ·` · `Devices ·` | P0 each; also P0 in the offline plan-file scan (walk.mjs:1789, 1801) |

#### `plan.settings` (page-contracts.json:553-594) — not diffed by any script

| Key | Asserts | Selector / text | Severity |
|---|---|---|---|
| reach | click `a` "Plan settings", root `.plan-settings` | — | not read |
| allow.headings | `Plan settings` | — | not diffed |
| allow.buttons | `Close` | — | not diffed |
| other allow lists | empty | — | not diffed |
| budget | 4 sentences / 60 words | — | not read |
| forbid | `Pace` · `Change windows` · `Notice` · `Holidays` · `Revert threshold` · `fromto` | — | not read |

The smoke only asserts the popover opens: `Plan: Plan settings opens the popover` (smoke.mjs:591, `.plan-settings`).

#### `plan.footer` (page-contracts.json:595-656) — diffed by the walk against `main.page .plan-footer` with every `details` opened (walk.mjs:1605, 1612-1615), no exclude

| Key | Asserts | Selector / text | Severity |
|---|---|---|---|
| reach | click summaries `Doesn't apply here`, `Not licensed`, `Housekeeping`; root `.plan-footer` | walk opens all `.plan-footer details` itself | root matches; actions not read |
| allow.summaries | `re:^Doesn't apply here \(\d+\)$` · `re:^Not licensed \(\d+\)$` · `re:^Housekeeping \(\d+\)$` | — | P1 |
| allow.links | `re:^.{3,60}$` | — | P1 |
| allow.headings/tabs/tiles/columns/chips/buttons | empty: any heading, tab, chip or button in the footer outside a repeater is a miss | — | P1 (tiles/columns not diffed) |
| budget | 16 sentences / 260 words | — | P1 |
| rowBudget | 2 sentences / 40 words | — | P1 (P2 for `.copy-box`, `.decision`) |
| forbid | `Could not be evaluated` · `How this tenant is organised` · `Renaming a policy changes no evaluation` · `**` · `(p2)` · `not assessed` · `re-export` · `SDK` · `Graph REST` · `needs a licence tier` · `unlock` · `upgrade` | — | P0 |

### 1.4 An opened step

#### `plan.step` (page-contracts.json:657-775) — diffed by the walk for **every** opened row (not only `nth: 1`), against `main.page .step-body` (the contract's `reach.root` is `.step`; the walk reads `.step-body`, so the `.step-head` and `.step-footer` outside the body are not diffed), excluding `details > *:not(summary)` (walk.mjs:1537-1540). Each What-to-do tab is clicked and re-checked for `forbidEverywhere` only (walk.mjs:1546-1552).

| Key | Asserts | Selector / text | Severity |
|---|---|---|---|
| reach | click `.plan-row` nth 1, root `.step`, exclude `details > *:not(summary)` | only `exclude` is read | — |
| allow.headings | `Why` · `Readiness` · `Do not deploy this policy from the current baseline` · `Fix before continuing` · `Hardening recommendations` · `What to do` · `Implementation` · `Done when` | — | P1 |
| allow.tabs | `Entra` · `PowerShell` · `JSON` · `AI Info` | — | P1 |
| allow.chips | `In place` · `Ready` · `Blocked` · `Scheduled` · `Report-only` · `Ready to enforce` · `Needs decision` · `Needs attention` · `Enforced` · `Skipped` · `Doesn't apply` · `re:^(Not deployed\|Report-only\|Ready to enforce\|Enforced) · (Blocked\|Review required\|Needs decision\|Baseline conflict)$` · `re:^CIS \d+(\.\d+)?$` | — | P1; separately any chip matching `/^CIS\b/` is **P0** (walk.mjs:1542) even though the contract allows it |
| allow.buttons | `Why IAMAI says this →` · `Export CSV` · `Scan to update the plan` · `Exclude from rollout` · `Doesn't apply here` · `Put this step back` | — | P1 (the step footer holding the last four is outside `.step-body`; see smoke.mjs:565 for the footer) |
| allow.summaries | empty | — | P1 per summary |
| allow.links | `Learn →` · `re:^.{3,60} →$` | — | P1 |
| allow.tiles / columns | empty | — | not diffed |
| budget | 40 sentences / 620 words | — | P1 |
| rowBudget | (absent) 2 / 30 | — | P1 (P2 `.copy-box`, `.decision`) |
| forbid | `Do it` · `Exit criteria` · `Recovery card` · `Nothing changes for anyone` · `nobody notices` · `An object or an answer` · `This is groundwork` · `Nothing destructive here` · `Nothing to undo` · `confirm it on the plan` · `picked in Setup` · `Setup` · `created by the step above` · `re-download after that step` · `undefined` · `Report-only from —` · `e.g. "` · `the ring's` · `this ring` · `soak` · `handle-with-care` · `168h` · `Learn →CIS` · `What the last 30 days say` · `Why now` · `Waiting on this` · `Answer this` · `Scheduled date` · `unknown here` · `What could go wrong` · `Ring plan` · `help-desk contact` · `minutes of admin time` · `Proposed name:` · `an account IAMAI could not name` · `Readiness table` · `could not be checked` · `Worth fixing too` · `Add a second account above` · `no people · 0 active` · `IAMAI can't see` · `New policy, report-only first` · `Change:` · `wave` · `Exclude users` · `Exclude: the emergency access accounts` · `never eligible` · `Determine location by:` | — | P0 in the DOM diff; P0 over content.json strings (walkContent.mjs:233, skipping `whatToDoReference`, `pages.*`, `shared.engine.*`); P0 in the offline plan-file scan; smoke asserts it on the print (smoke.mjs:642) minus More's allowed headings; `exportsClean.test.ts` and `content.test.ts` read it too |

#### `plan.step.more` (page-contracts.json:776-846) — never diffed against the DOM

| Key | Asserts | Selector / text | Severity |
|---|---|---|---|
| reach | click `.plan-row` nth 1, then summary `More`; root `.step-body details.more` | — | not read |
| allow.headings | `Named, for the record` · `What could go wrong` · `Also possible` · `Prerequisites` · `What waits on this` · `If it goes wrong` · `If a change locks you out` · `Tell your people` · `For the help desk` · `For your manager` · `What IAMAI can't see` | read by the smoke only to remove these from the print forbid list (smoke.mjs:41-42) | not diffed |
| allow.chips | `applies here` | — | not diffed |
| allow.buttons | `Copy as prompt` · `Copy` · `Skip this step` | — | not diffed |
| allow.summaries | `More` | — | not diffed |
| allow.links | `Learn →` · `re:^.{3,60} →$` | — | not diffed |
| budget | 120 sentences / 2000 words | — | not read |
| forbid | `Exit criteria` · `Answer this` · `unknown here` · `the ring's` · `this ring` · `soak` · `handle-with-care` · `This puts an object in place` · `closes a gap the baseline names` · `is done` · `Recovery card` · `wave` | — | P0 over content.json strings only (walkContent.mjs:228-233); `content.test.ts` reads it; no DOM check |

### 1.5 The other surfaces, and whether anything diffs them

| Surface id | Lines | Diffed by the walk? |
|---|---|---|
| `shell` | 33-77 | No. `accessibility.test.ts` compares `allow.tabs` with the header tabs. Its `forbid` (`Recovery card`, `Re-scan`, `Scan to update the plan`, `scanned`, `Wave`) is not read; the walk has its own header check (walk.mjs:523) |
| `connect.signedOut` | 78-137 | Yes, on `/connect` for fixtures whose `mock` is `signedOut`, `consent`, `personal`, `cancelled` (walk.mjs:509) |
| `connect.signedOut.permissions` | 138-182 | No |
| `connect.signedIn` | 183-246 | Yes, on every other `/connect` fixture (walk.mjs:468, 509) |
| `error` | 247-280 | Yes, route `error` on `mock-crash` |
| `readiness` | 281-374 | Yes |
| `inventory` | 375-413 | Yes, exclude `.tab-panel` |
| `inventory.tab` | 414-457 | No (`eachTab` / `visiblePanel` not implemented) |
| `export` | 847-897 | Yes |
| `how` | 898-958 | Yes |

---

## 2. Walk checks (`scripts/walk.mjs`)

`npm run walk` = `node scripts/walk.mjs` (package.json:21). Every finding goes through `add(level, text)` (walk.mjs:110-117). It is de-duplicated by `level:text`, and a P0 is also printed to the job log as `walk: P0 <text>`. Exit code: 1 if any P0 (walk.mjs:2255), 2 if no Chrome (104), the dev server did not start (142), or Chrome exposed no page target (165). An uncaught exception also ends the process non-zero. A P1 or P2 never changes the exit code.

Outputs: `walk/<sha>/<fixture>/<width>/<route>.txt|.png`, `step-NN-<title>.txt|.png`, `connect-tiles.json`, `connect-permissions.*`, `plan-footer.txt`, `walk/<sha>/findings.json`, and `docs/reports/walk-<sha>.md` (walk.mjs:56-57, 2236-2238). The P1s are grouped by label prefix into the log, five per group (2242-2251).

### 2.1 Harness: tenants, fixtures, viewports

| Item | Value | walk.mjs |
|---|---|---|
| Dev server | `node_modules/vite/bin/vite.js --port $WALK_PORT` (default 5203), waits up to 120 × 200 ms for `/<TOOL_PATH>/` | 46, 130-143 |
| Chrome | `$CHROME`, else Windows, Linux or macOS paths; `--headless=new --window-size=1280,1400`, CDP port `$WALK_CDP_PORT` (default 9448), fresh profile `iamai-walk-profile` | 91-105, 146-166 |
| Widths | `WIDTHS = [1280]` for every app fixture. `Emulation.setDeviceMetricsOverride` width 1280, height 1400, `mobile: width < 600` | 48, 199, 495-496 |
| Home widths | 1280, then 768 and 390 (the home page only) | 1864, 2034 |
| Resource buffer | `performance.setResourceTimingBufferSize(20000)` on every new document | 196 |
| Settle | two identical `main.page` innerText reads 250 ms apart (max 40) | 209-217 |
| Lanes | `LANES = ['Ready', 'Up Next', 'On Hold']`, clicked through `main.page .plan-controls [role=tab]` with the `.tab-badge` text removed | 244-248 |
| Reveal toggles | presses `Show completed`, then `Show deferred`, one at a time, 200 ms apart (`main.page .plan-controls .focus`, only when `aria-pressed` is not `true`) | 229-236 |
| Row read | `.plan-row` → `.step-title`, `.status`, `.when`, `.plan-row-reason`, in `.plan-footer`, in `#plan-group-complete`, in complete/deferred (aside), `data-wave === '0'`. Day-0 = wave0 or the reason matches `/^when .+ reaches \d+%/`. Aside rows are read under the first lane only | 250-263 |
| Plan file | `$WALK_PLAN_FILE` or `fixtures/private/getiamai.plan.json`, scanned offline if present | 58, 1785 |
| Redaction | GUID → `<guid>`, e-mail → `<upn>` on plan-file quotes | 122-125 |

Fixtures, in walk order (walk.mjs:2131-2163). `base` is `http://localhost:<PORT>/<TOOL_PATH>/` plus the query shown.

| Fixture | Query | Routes | `mock` / flags |
|---|---|---|---|
| `demo` | `?demo=1` | `plan, readiness, export, how, connect, inventory` (default, 499) | — (Initial scan) |
| `demo-week2` | `?demo=1` | `plan, readiness` | `week2: true`: `ensureWeek2` presses the banner button `Follow-up scan` (`.demo-banner .demo-snapshots button`) and re-navigates (451-465) |
| `mock-roles` | `?dev=1&mock=1&roles=none` | `connect` | `roles` |
| `mock-gaps` | `?dev=1&mock=1&state=gaps` | `connect` | `gaps` |
| `mock-free` | `?dev=1&mock=1&licence=free` | `connect` | `free` |
| `mock-scanning` | `?dev=1&mock=1&state=scanning` | `connect` | `scanning` |
| `mock-ready` | `?dev=1&mock=1&state=noScan` | `connect` | `ready` |
| `mock-crash` | `?dev=1&mock=1&crash=1` | `error` | `crash` |
| `mock-operator` | `?dev=1&mock=1&operatorDormant=1` | `readiness, plan` | `operator` |
| `mock-author` | `?demo=1&author=1` | `connect` | `author` (named `mock-` so the `demo`-prefixed plan checks skip it) |
| `mock-signedout` | `?dev=1&mock=1&state=signedOut` | `connect` | `signedOut` |
| `mock-auth-consent` | `…&state=signedOut&auth=consent` | `connect` | `consent` |
| `mock-auth-personal` | `…&state=signedOut&auth=personal` | `connect` | `personal` |
| `mock-auth-cancelled` | `…&state=signedOut&auth=cancelled` | `connect` | `cancelled` |

Before the fixtures, the throttled production-bundle block runs (walk.mjs:2061-2130; §2.9). It walks home from it. After the fixtures come the plan-file scan, content findings, static findings, cross-surface invariants, console errors and Learn links (2165-2197).

Allow-lists and constants the walk uses:

| Name | Contents | walk.mjs |
|---|---|---|
| `FORBIDDEN_PHRASES` | `an account IAMAI could not name` · `an unnamed account` · `168h` · `undefined` · `[object Object]` · `NaN` | 82 |
| `ABSENT_STEP_IDS` / `ABSENT_TITLES` / `ABSENT_GOAL_NAMES` | content steps absent from the pinned baseline (`absentStepIds()` minus floor goals), their titles, their catalogue names in `data/goals.json` | 78-81 |
| `CLEANUP_TITLES` | titles of `cleanup` content entries (exempt from the done-row date check) | 71 |
| `CARVE_OUT_IDS` | `s-question-travel`, `s-question-partner`, `s-question-mail-devices` | 84 |
| `BEFORE_LINES` | `beforeLines()` over `device-registration-mfa`, `require-managed-device`, `user-risk`, `user-risk-medium`, `unmanaged-browser` (contentChecks.ts:116-125) | 89 |
| `PINNED_COUNT`, `PINNED_SHORT` | policy count and first 7 characters of `commit` in `baselines/jhope188-conditionalaccesspolicies.pinned.json` | 65-67 |
| `READY_WORD`, `HEADER_TABS`, `ALL_ACCOUNTS` | `pages.readiness.show.ready`; the five `pages.app.shell.tabs.*` joined by ` · `; `pages.readiness.show.all` | 41-44 |
| Console error allow-list | errors matching `/favicon\|microsoftonline\|net::\|ERR_\|mock crash \(\?crash=1\)/` are ignored | 2186 |
| Text invariants (`checkText`) | `HOLE` `/\{[a-zA-Z0-9_:]+\}/` (with `/{id}` stripped), `EMPTY_VALUE`, `EMPTIED_VALUE`, `LONG_DATE`, `ODD_SHORT_DATE` | 350-363, 407-417 |

### 2.2 Checks on every route capture, every fixture (walk.mjs:499-615)

Label: `<fixture> @1280 /<route>`.

| Check (message) | Sev | Reads | walk.mjs |
|---|---|---|---|
| Plan route waits for a row | — | `main.page .plan-row` count > 0 (15 s) | 504 |
| `nothing rendered in main` | P0 | extractor over `main.page` returns null | 510-513 |
| Contract diff (§1.2) against `connect.signedOut` / `connect.signedIn` / `readiness` / `plan` / `export` / `how` / `inventory` / `error` | P0/P1/P2 | — | 509, 515 |
| `unfilled variable {x} in the rendered text` | P0 | `HOLE` over `main.page` innerText | 408-409 |
| `an empty value in the rendered text ("…")` | P0 | `EMPTY_VALUE` = `/(·\s*·)\|(\(\s*\))\|(,\s*,)\|(\bfrom\s+until\b)\|(\bfrom\s*·)\|(·\s*$)\|(^\s*·)/m` | 358, 410-411 |
| `a variable rendered as nothing ("…")` | P0 | `EMPTIED_VALUE` = `/\b(From\|from\|the next\|after\|by\|before\|on\|until\|within) (,\|\.\|days\b\|hours\b)\|\s\.(\s\|$)/` | 363, 412-413 |
| `forbidden phrase "…"` | P0 | `FORBIDDEN_PHRASES` | 414 |
| `the long date form "…" outside an email` | P1 | `LONG_DATE` = weekday, month day | 350, 415 |
| `a second date format "…" beside the short form` | P1 | `ODD_SHORT_DATE` = `/\b\d{1,2} (Jan…Dec)[a-z]* \d{4}\b/` | 351, 416 |
| Readiness and population collection (for §2.8) | — | `/\b(MFA\|admin\|device\|guest)\s+readiness\s+(\d{1,3})%/gi`, `…reaches \d{1,3}%\s*\(now\s+(\d{1,3})%\)`, bare `readiness N%` → mfa; `/\b(\d+) active people\b/` | 433-438, 517 |
| `the header carries a scan control or the scan's age: "…"` | P0 | `header.app` innerText vs `/scanned\|Scan to update the plan\|Re-scan/` | 522-523 |
| `the page says scanned; only Connect shows when the tenant was scanned` | P0 | route ≠ connect and `/\bscanned\b/i` in main text | 524 |
| `the Plan's header carries a line that left: "…"` | P0 | plan: `main.page p.line` vs `/Today shows where each person stands\|from the scan\|\bscanned\b/` | 525-530 |
| `no theme control in the header` | P0 | `header.app .right button` text ending `theme` | 533-534 |
| `the header's X control has a button face (…); text` | P0 | computed `borderTopWidth` must be `0px`, background `rgba(0, 0, 0, 0)` or `transparent`, `paddingLeft` `0px` | 535 |
| `the demo chunk loaded outside demo mode` / `did not load in demo mode` | P0 | resource entries matching `/src/ui/demo.ts`, `/src/ui/demoFacts.ts`, `/assets/demo-*.js` vs `[?&]demo=1` in base | 539-541 |
| `no Start date field on an unstarted plan` | P0 | plan, not week2: `main.page .plan-start label.rows input[type=date]` absent and no `/\bStarted [A-Z][a-z]{2} \d/` | 545-548 |
| `the Start date proposes X; today in Z is Y (a weekend: …)` | P0 | input value vs today in `mapping.displayTimeZone` (IndexedDB `iamai`, filtered to demo or non-demo tenant); Saturday +2, Sunday +1 | 550-555 |
| `the proposed start was written to the plan record (…)` | P0 | IndexedDB `plan` store rows with `startDate` | 556-557 |
| `the Start date label is not a spaced row (…)` | P0 | label `display: flex`, `columnGap` ≥ 8 | 558 |
| `the Start date input is not styled like Plan settings' inputs (…)` | P0 | input `paddingTop` `0px`, `borderBottomWidth` `1px` | 559 |
| `the page overflows the viewport by Npx (…)` | P1 (both branches P1) | `scrollWidth - clientWidth` > 0; first `main.page *` past the edge | 610-614 |
| `the page renders N tips; it keeps one` | P0 | export: `main.page .page-tip` ≠ 1 | 1070-1071 |
| `the page renders N tips; the final reference has none` | P0 | readiness: `.page-tip` ≠ 0 | 1073 |
| `the Plan still renders a page tip` | P0 | plan: `.page-tip` ≠ 0 | 1074 |
| `the MFA readiness ladder renders on the Plan; …` | P0 | plan: `main.page .rung-tiles` > 0 | 1081-1082 |
| `the old readiness strip still renders` | P0 | plan: `main.page .readiness, main.page .readiness-people` | 1083 |
| `a note under the start date still renders` | P0 | plan: `/Clear the date\|Starting locks the dates/` | 1084 |

### 2.3 Route-specific checks: error, preload, operator, MFA Readiness, Inventory, Export

| Surface / fixture | Check (message) | Sev | Reads | walk.mjs |
|---|---|---|---|---|
| error (`mock-crash`) | `no error page for a surface that throws while drawing` | P0 | `main.page section.error-page` | 567-568 |
| error | `the error page's title reads "…"` | P0 | `h1, h2` = `This page hit an error` | 570 |
| error | `the error page's lead reads "…"; Nothing in the tenant changed. (with its full stop)` | P0 | first `p` = `Nothing in the tenant changed.` | 571 |
| error | `the error page still says Setup or Start step` | P0 | `/\bSetup\b\|Start step/` | 572 |
| error | `the error page's buttons read …` | P0 | `button, a.btn` with weight classes = `Reload (primary) · Download diagnostics (redacted) (secondary) · Start over (tertiary)` | 573-574 |
| error | `the error page lacks "Send the diagnostics to feedback@getiamai.com"` | P0 | a `p` equal to that string | 575 |
| error | `Reload did not reload the page` | P0 | click `Reload`; navigation type `reload` within 8 s | 576-578 |
| connect (`mock-ready`) | `a chunk load failure did not reload the page` | P0 | dispatch `vite:preloadError` after clearing `sessionStorage['iamai.preloadReloaded']`; navigation type `reload` and `window.__stillHere` undefined | 584-587 |
| connect (`mock-ready`) | `a second chunk load failure in the session reloaded again (…)` | P0 | second event is not `defaultPrevented` and `__stillHere === 2` after 1.5 s | 589-592 |
| readiness (`mock-operator`) | `MFA Readiness has no row for the signed-in account` | P0 | `#/readiness/notActive`, `table.datatable tbody tr` containing `Alex Morgan` (synthetic mock account) | 597-602 |
| readiness (`mock-operator`) | `MFA Readiness reads the signed-in account's stale directory sign-in as "…"; not active, like anyone else's` | P0 | 5th `td` vs `/not active/i` | 604 |
| readiness (`mock-operator`) | `the signed-in account's evidence reads "…"; the population never depends on who is signed in` | P0 | 4th `td` contains `signed in now` | 605 |
| readiness | `the readiness summary line is missing` | P0 | `RE.readinessSummary` `/(\d+) of (\d+) (?:is\|are) Ready\./`, or `RE.readinessSummaryNone` `/No active people to count/` | 627-629 |
| readiness | `the counts read […]; […]` | P0 | `.readiness-summary .summary-stat` → `.stat-k` titles must equal `readinessStatTitles()` (3) | 630-632 |
| readiness | `Ready and the three counts sum to N and the summary counts M active people` | P0 | summary ready + `.stat-n` values = active | 634-637 |
| readiness | `"<title>" counts N and the worklist filtered to it shows M rows` | P0 | click each stat; `table.datatable tbody tr` count | 640-647 |
| readiness | `the toolbar has no "<word>" filter` | P0 | `.toolbar .btn` text = `READY_WORD` / `ALL_ACCOUNTS` | 649-653 |
| readiness | `"<word>" shows N rows and the page counts M` | P0 | rows after Ready (= ready) and All (= active) | 655-657 |
| readiness | `the Plan gate strip does not say how many must be Ready` | P0 | active > 0 and no `/(\d+) of (\d+) must be Ready/` | 660-661 |
| readiness | `the Plan gate counts N people and the summary M` | P0 | gate total ≠ active | 662 |
| readiness | `the gate says N more with R of G Ready` | P0 | `/(\d+) more · /` ≠ max(0, G − ready) | 663-664 |
| readiness | `the passkey strip counts N people and the summary M` | P0 | `/(\d+) of (\d+) (?:has\|have) a passkey/` total ≠ active | 666-667 |
| readiness | `"Show N without" shows M rows` | P0 | click `.progress-strip a` with `without`; rows ≠ N | 668-674 |
| readiness | `the footer names an account kind at zero ("…")` | P0 | `.footer-note .ledger` vs `/\b0 (not active\|emergency\|service\|shared\|sign-in disabled)/` | 680-681 |
| inventory | `the policies table has no Exclusions column` | P0 | `main.page th` includes `Exclusions` | 685-686 |
| inventory | `the Exclusions column names no excluded group` | P0 | text contains `Core - Break glass` (synthetic demo group) | 687 |
| plan | (records `planHeaderCounts`) | — | `/Steps\s*(\d+)\s*In place\s*(\d+)/` | 690-693 |
| export | `Print or save as PDF renders no cover` | P0 | stub `window.print`; click `Print or save as PDF`; `.print-plan .print-statement` within 8 s | 1090-1094 |
| export | `the print cover's statement carries no step count ("…")` | P0 | `/(\d+) steps · (\d+) (?:in place\|done)/` | 1096-1098 |
| export | `the print cover counts N steps and the Plan header M (Cleanup is in the header's count)` | P0 | vs `planHeaderCounts.steps` | 1099 |
| export | `the print does not list Cleanup` | P0 | textContent of `.print-plan h1,h2,h3,p,li,td,dd` vs `/\bCleanup\b/` | 1101-1102 |
| export | `checkText` over the print (`… (print)`, emails allowed: no long-date P1) | P0/P1 | same as §2.2 | 1103 |

### 2.4 Connect (every fixture whose routes include `connect`; walk.mjs:700-1068)

Capture: `main.page .connect-flow .connect-step` (tiles 1-3, number from `.n`) and `main.page .connect-destination` (tile 4). Each tile gives `h2` text, `h2 .state`, class, buttons (`button, a.btn` not in `.picker`, weight from `btn-primary|secondary|tertiary`), and paragraphs (`.connect-step-body > p, .connect-destination-copy > p`) (712-715). `signedOut` = mock in `signedOut, consent, personal, cancelled`; `inDemo` = `[?&]demo=1` in base. `expectBtn` reports `<what> has no /re/ button` or `<what>'s X is W; the mockup makes it W'` (737-741).

Every Connect check is P0.

**Structure and page-wide**

| Message | Reads | walk.mjs |
|---|---|---|
| `Connect renders N flow panels; the approved design is one contiguous flow` | `.connect-flow` count ≠ 1 | 717-718 |
| `the flow holds N steps numbered …; three, 1 to 3` | `.n` = `123` | 719 |
| `Connect renders no Plan destination panel below the flow` | `.connect-destination` | 720 |
| `the Plan destination is inside the flow; …` | `.connect-flow .connect-destination` | 721 |
| `action(s) outside the step's action zone: …` | `.connect-step-body button, .connect-step-body a.btn` (not `.picker`) | 723-724 |
| `the design pack's mockup state switch shipped to production` | `.state-switch` | 726 |
| `Connect has no status strip above the flow` / `N status strips; one` / `the status strip carries no state title; …` / `the status strip's dot is not decoration (aria-hidden)` | `.connect-status`, its `strong`, `.dot[aria-hidden="true"]` = 1 | 728-734 |
| `the heading reads "…"; Strengthen identity security without guessing what will break.` | `main.page h1` | 743-744 |
| `the line under the heading is missing or changed` | `/IAMAI reads a Microsoft Entra tenant, compares it with a reviewed identity-security baseline, and writes a dated plan to help you close the gaps without locking anyone out\. It is read-only and runs in this browser\./` | 745 |
| `"Connect a tenant" still renders` | text | 746 |
| `the heading or its line names Conditional Access before …` | `h1` + `p.lede` vs `/Conditional Access/` | 749-750 |
| `bare link(s) on Connect: …` | `.connect-step a[href]:not(.btn):not(.lnk)`, same for `.connect-destination` | 752-753 |
| `a role other than Global Reader is named on screen` | `/Security Reader\|Reports Reader\|Directory Readers/` | 754 |
| `the "everything the scan found" line still renders` | `/Everything the scan found is inside the plan/` | 755 |
| `the footer How link still renders` | `.footer-link` | 756 |
| `Built for or What it catches still renders on Connect; …` | `/Built for\|What it catches/` | 757 |
| `the feedback address renders on Connect; …` | `/feedback@getiamai\.com/` | 758 |
| `the brand links to X; #/connect` | `header.app a.wordmark` href | 760-761 |
| `the header still shows the tenant tab` | `header.app .tenant` | 762 |
| `the header tabs read …; <HEADER_TABS>` | not signed out: `header.app nav a` joined ` · ` | 763-766 |
| `Connect says "scanned"; …` | `/\bscanned\b/i` | 1045 |
| `N stages are current; one at a time (…)` | class `current` on flow steps > 1 | 1049-1051 |
| `a settled stage sits after the current one: …` | `settled` index > `current` index | 1052-1053 |
| `the current stage carries no word marking it; …` | `.connect-step.current .next` exactly one, non-empty | 1054-1057 |
| `Connect links to MFA Readiness (…); the destination after a scan is the Plan` | `a[href*="#/readiness"]` | 1059-1060 |
| `the last good plan is gone after a scan with gaps` | gaps: navigate `#/plan`, `.plan-row` within 10 s | 1062-1067 |

**Tile 1 (account / sign-in)**. `READER` = `/Global Reader is the least privilege that reads everything IAMAI needs; a Global Administrator account works too, but sign in with less if you can\. It writes nothing\./`. `CONSENT` = `/The first sign-in in a tenant needs an account that can grant consent \(a Global Administrator, once\); every sign-in after that can be Global Reader\./` (767-768).

| Case | Message | Reads | walk.mjs |
|---|---|---|---|
| demo, signed in | `tile 1 does not read Sample tenant with the sample tenant as its state` | `/^Sample tenant/` + `.state` | 776-777 |
| demo | `tile 1 does not say the sample is not connected to Microsoft` | `/IAMAI is not connected to Microsoft\./` | 778 |
| demo | `tile 1 keeps the Global Reader line in the demo, …` | `READER` present | 779 |
| demo | expectBtn `Leave the demo` secondary | — | 780 |
| demo | `tile 1 offers /^Sign out$/ …` or `/^Sign in with another account$/ … in the demo` | buttons | 781 |
| demo | `the header offers the Account menu in the demo` | `header.app button` `Account` | 782 |
| real signed in | `tile 1 does not read Signed in with the tenant as its state` | `/^Signed in /` + state | 784-785 |
| real signed in | `tile 1 lacks the Global Reader line as the mockup words it` / `tile 1 lacks the consent sentence` | `READER`, `CONSENT` | 786-787 |
| real signed in | expectBtn `Sign in with another account` secondary; `Sign out` tertiary | — | 788-789 |
| signed out | `tile 1 reads "…"; Sign in · <state>` | `/^Sign in /` and state: signedOut `no tenant connected`; consent `Microsoft asked for admin approval`; personal `that is a personal Microsoft account`; cancelled `sign-in was cancelled` | 792-793 |
| signed out | `tile 1's badge does not carry the <cls> colour` / `tile 1 carries a state colour (…) in the <mock> state` | consent `wait`, personal `stop`, others no `done\|wait\|stop` | 794-795 |
| signedOut | `the sign-in tile lacks the Global Reader line with the consent sentence` | `READER` and `CONSENT` | 796-797 |
| consent / personal | `the <mock> state's paragraph reads […]` | consent: `/^This is the first sign-in for contoso\.com, and consent has to be granted once by a Global Administrator\. Sign in with that account this one time, or send them this link; after that, Global Reader is enough\.$/`; personal: `/^someone@outlook\.com is a personal account\. IAMAI reads a Microsoft Entra tenant, so it needs a work or school account that belongs to one\.$/` | 792, 798-799 |
| consent / personal | `the <mock> state keeps the Global Reader paragraph; …` | `READER` present | 800 |
| cancelled | `the cancelled state carries a paragraph: …; the state line only` | any non-empty paragraph | 801 |
| signed out | expectBtn primary `Sign in with Microsoft` (personal: `Sign in with a work or school account`); secondary `Try it with sample data`; `tile 1 has N buttons; two` | — | 802-804 |
| signedOut | `tile 1 has no permissions collapsible` | click `summary` `/What IAMAI asks for, and how to remove it/` | 807-808 |
| signedOut | `the permissions collapsible did not open` | `details.permissions` | 810-811 |
| signedOut | `the consent lead reads "…"` / `the consent lead counts N and M rows follow` | first `p` `/^Microsoft's consent screen will list these (\d+), in this order:$/` vs `.tile-rows li` | 813-815 |
| signedOut | `N consent rows; every requested scope, in Microsoft's wording` | rows < 5 | 816 |
| signedOut | `the first consent row reads "…"` | `/^Read all users' basic profiles \/ Read directory data/` | 817 |
| signedOut | `the permissions collapsible still renders a table` | `table` in details | 818 |
| signedOut | `the collapsible does not end with the removal line: "…"` | last `p` `/^Remove it any time: Entra admin center → Enterprise applications → IAMAI Planner → Delete\. Nothing it read leaves this browser unless you export it\.$/` | 819 |

**Tile 2 (Baseline)**

| Message | Reads | walk.mjs |
|---|---|---|
| `the baseline step's state reads "…"; selected` | `h2 .state` = `selected` | 830 |
| `the baseline step nests no baseline card` / `the baseline card names no package` | `.connect-step .baseline-card`, `.baseline-name` | 831-834 |
| `the baseline card reads "…"; the pinned package holds N policies` | signed out or demo: `.baseline-source` = `^<PINNED_COUNT> policies · pinned version$` | 836 |
| `the baseline card's source line carries a credential claim: "…"` | `/Microsoft MVP\s*$\|verified\|certified\|MVP badge/i` | 839 |
| `the baseline step draws no source-and-version disclosure` | signed out or demo: `details` whose summary contains `Source and version` | 844-845 |
| `the source-and-version disclosure links nothing a reader can open: …` | first `a` href starts `https://github.com/` | 847 |
| `the source-and-version disclosure reads "…"; the pinned package is at <sha7>` | text contains `PINNED_SHORT` | 848 |
| `tile 2 has no author-update review` | `mock-author`: `details` with summary `/Updated by its author/` | 858-859 |
| `the review summary reads "…"` | `/^Updated by its author on .+ · 4 policies changed · review$/` | 861 |
| `the review lists N rows; one per changed policy (4)` | `:scope > ul.diff > li` = 4 | 862 |
| `the review says it is incomplete, although the mock reads every file: "…"` | `p.quiet` empty | 863 |
| `a review row's change word is "…"` | `.tag` ∈ `added, removed, changed, renamed, renamed and changed, not reviewed` | 864-866 |
| `a review row does not name its policy: "…"` | `.policy` length ≥ 4 and no word `policy` | 867 |
| `the steps under "…" read […]; "changes <step>" lines or "no step changes"` | `.steps li` all `/^changes .{5,}$/`, or exactly `no step changes` | 868-869 |
| `a review row reads "policy": […]` | `/\bpolicy\b/` in steps | 870 |
| `no review row names a step that changes, …` / `no review row reads "no step changes", …` | across rows | 872-873 |
| `N rows read "renamed and changed"; a renamed, modified policy is one row` | exactly 1 | 875-876 |
| `the renamed row does not say what it was called` / `… does not name its authentication-strength change` / `… does not name its added exclusion` / `the renamed policy lost the step it stands behind` | `.was` `/^was .{5,}$/`; `.deltas li` `/^Authentication strength: now .{3,}$/`, `/^Excluded groups: \d+ added$/`; a `changes ` step | 878-881 |
| `tile 2 lacks the approved baseline sentences` | `/built and maintained by Jon Hope/` and `/Its aim is layered protection/` | 885 |
| expectBtn `Change baseline` secondary | — | 886 |

**Tile 3 (Scan)**. Expected state: signed out `sample`; otherwise by mock `roles→role`, `gaps→gaps`, `free→complete`, `scanning→scanning`, `ready→ready`, else `complete` (892-893). `SCAN_STATES`: complete `/^Scan complete · .+$/`; gaps `/^Scan finished with gaps · no plan built$/`; role `/^Scan not started · this account can't read the tenant$/`; scanning `/^Scan .+ · \d+(m \d+)?s$/`; ready `/^Scan not started$/`; sample `/^Scan after sign-in · about a minute for a small tenant$/`.

| Message | Reads | walk.mjs |
|---|---|---|
| `tile 3 reads "…"; Scan in the <want> state` | exactly one `SCAN_STATES` match, equal to want | 895-896 |
| `tile 3 still reads What happens next` | text | 897 |
| `tile 3 still carries a Reads / Compares / Writes beat ("…")` | `policies, people, sign-in records and licences` · `what each baseline policy is for` · `a dated plan for the difference` | 898 |
| `tile 3 still carries the read-only line` | `/Read-only\. It holds no permission/` | 899 |
| `tile 3 has no IAMAI limitations collapsible` | `details` with summary `IAMAI limitations` | 900-901 |
| `the limitations collapsible sits in tile N; tile 3` / `the limitations list has N lines; five` / `the limitations' last line reads "…"` | `.n` = 3; `li` = 5; last `p` = `Permissions, every check it runs, and its limits in full: How IAMAI works →` | 903-905 |
| `the scan step carries counts in the <want> state: …` | `.connect-step .meta-counts li` present when not complete | 910-911 |
| `the scan counts read …; active people · baseline policies · plan steps` / `a scan count is not a number: …` | labels joined; `b` values numeric | 912-915 |
| `tile 3's number badge does not carry the <want> state colour (class X); …` / `tile 3 in the <want> state carries a state colour (…)` | complete `done`, gaps `wait`, role `stop`, others none | 916-918 |
| `tile 3 in the <want> state carries the <k> state's /re/` | other states' markers: complete `/complete · /`, `/^Scan again$/`; gaps `/no plan built/`, `/Ask whoever administers/`; role `/holds none of the roles that read/`, `/Everything IAMAI needs, read-only/`; scanning `/^Stop$/`; ready `/About ten minutes/`, `/^Scan tenant$/`; sample `/about a minute for a small tenant/` (Scan again allowed in gaps) | 919-924 |
| `tile 3 carries the Plan tile's /re/` | `/Open the plan →/`, `/Open the last full plan/`, `/What the sample tenant produced/`, `/Open the sample plan/`, `/\d+ people \d+ policies/`, `/from the scan/` | 925 |
| complete: expectBtn `Scan again` secondary; `the complete Scan tile has N buttons; Scan again alone` | — | 926-929 |
| gaps: `the policies section row is not marked not read` / `the sign-in records row is not marked not read` | `.tile-rows li` `/^Conditional Access policies not read$/`, `/^Sign-in records not read$/` | 931-933 |
| gaps: `the gaps tile lacks the one ask for Global Reader` | `/Ask whoever administers the tenant for Global Reader; it reads every section and writes nothing\./` | 934 |
| gaps: `the gaps tile lacks Microsoft's Global Reader link` | `.connect-step a.lnk` text `Microsoft: Global Reader`, href `/global-reader/` | 935 |
| gaps: expectBtn `Sign in with another account` primary, `Scan again` secondary; `the gaps tile has N buttons; …` (2) | — | 936-938 |
| gaps: `the scan with gaps left N snapshot record(s) in the store; it is never stored` | IndexedDB `snapshot` count ≠ 0 | 939-940 |
| role: `the role tile does not name the account and the three sections` | `/holds none of the roles that read Conditional Access policies, people and sign-in records\./` | 943 |
| role: `the role tile's rows read …; one row asking for Global Reader` | one `.tile-rows li` `/^Everything IAMAI needs, read-only ask for Global Reader$/` | 944-945 |
| role: expectBtn `Sign in with another account` primary; `the role tile has N buttons; …` (1); `the scan started although the token lacks the roles` (`main.page .progress`) | — | 946-948 |
| scanning: `the scanning tile has no bar` / `… renders the bar's caption beside the state line; …` | `.connect-step .progress`; `.progress-caption` | 952-953 |
| scanning: `the scanning line reads "…"; the section being read · elapsed` | `/^Scan reading [a-z][^·]* · \d+(m \d+)?s$/` | 954 |
| scanning: `the scanning tile repeats the lane or the elapsed time in a paragraph` | paragraphs `/elapsed\|reading/i` | 955 |
| scanning: expectBtn `Stop` tertiary; buttons = 1 | — | 956-957 |
| ready: expectBtn `Scan tenant` primary; buttons = 1; `the ready tile lacks the ten-minute line` (`/About ten minutes\. Reads the tenant into this browser; nothing is sent anywhere\./`) | — | 959-963 |
| sample: `the signed-out Scan tile has N buttons; none` | — | 964 |

**Tile 4 (Plan destination)**. Expected: signed out `sample`; complete → `ready`; gaps → `last`; otherwise `waiting`. `PLAN_STATES`: ready `/^Plan ready · (\d+ steps, \d+ done · )?from the scan .+$/`; last `/^Plan last full plan · [A-Z][a-z]{2} \d+$/`; waiting and sample `/^Plan after the scan$/` (972-974).

| Message | Reads | walk.mjs |
|---|---|---|
| `tile 4 reads "…"; Plan in the <state> state` | `PLAN_STATES` | 976 |
| `the ready Plan destination is not marked ready (…)` / `the <state> Plan destination carries the ready treatment (…)` | class `ready` | 980-981 |
| `tile 4 in the <state> state carries the <k> state's /re/` | ready `/^Open the plan →$/`, `/\d+ people \d+ policies/`, `/from the scan/`; last `/^Open the last full plan/`, `/last full plan/`; sample `/What the sample tenant produced/`, `/already in place/`, `/^Open the sample plan$/` | 982-986 |
| `tile 4 carries the Scan tile's /re/` | `/^Scan again$/`, `/^Scan tenant$/`, `/^Stop$/`, `/^Sign in with another account$/`, `/\bReads\b/`, `/IAMAI limitations/`, `/not read$/` | 987 |
| ready: `the Plan tile never counted its steps in its state line` | `/ready · \d+ steps, \d+ done · from the scan /` within 20 s | 993-994 |
| ready: `the Plan tile's state reads "…"; ready · N steps, N done · from the scan <age>` / `more done than steps: "…"` | `.connect-destination h2 .state` | 995-998 |
| ready: `the Plan destination still renders a facts row` | `.connect-destination .facts` | 999 |
| ready: `the readiness ladder is back on the Plan tile; …` | `.rung-tiles, .rung-tile` | 1000-1002 |
| ready: `the Plan tile carries a drop line or a window: "…"` | `/\d+ → \d+\|\d+ → [A-Z][a-z]{2} \d+/` | 1003 |
| ready: `the Plan header could not be read for the count check: "…"` / `the Plan tile counts N steps, N done; the Plan header N · N` | navigates `#/plan`, `.plan-progress` `/Steps\s*(\d+)\s*In place\s*(\d+)/` vs tile counts | 1007-1016 |
| ready: expectBtn `Open the plan →` primary; buttons = 1 | — | 1017-1018 |
| ready: `the Scan tile's state does not read complete · N ago: "…"` / `the Plan tile reads "…"; ready · N steps, N done · from the scan <age>, the Scan tile's age` | tile 3 `/^complete · (.+)$/`; tile 4 state ends in the same age | 1019-1021 |
| ready: `the scan's age line renders N times; once, as the Scan tile's state` | `/\bcomplete · [^\n]+/g` count = 1 | 1023-1024 |
| last: expectBtn `/^Open the last full plan \([A-Z][a-z]{2} \d+\)$/` tertiary; buttons = 1; `the Plan tile's date and its button disagree`; `the last-full-plan tile carries facts from a scan that built no plan` (`/\d+ people/`) | — | 1026-1032 |
| waiting: `the waiting Plan tile carries buttons or facts: …` | any button or `/\d+ people/` | 1033 |
| sample: `the sample tile's facts read …; active people · steps · already in place · to finish (or estimated rollout)` | `.connect-destination .facts li` labels `/^active people · steps · already in place · (to finish\|estimated rollout)$/` | 1035-1037 |
| sample: `the sample tile's facts are not computed numbers: …` / `more already in place than steps: …` | first three `^\d+$` and > 0; fourth `/^\d+ weeks?$/`; in place ≤ steps | 1038-1039 |
| sample: `the sample tile lacks its lead`; expectBtn `Open the sample plan` secondary; buttons = 1 | `/What the sample tenant produced:/` | 1040-1042 |

### 2.5 Plan: every row opened, one by one (plan route only; walk.mjs:1108-1577)

After `revealCompleted()` and `readRows()`, each row not in `.plan-footer` and not in `#plan-group-complete` is opened. For each row: navigate `#/plan`, `ensureWeek2`, reveal, `showLane(rowLane[i])`. Find the row by `.step-title` text first, recorded index second; click; wait for `main.page .step-body` (4 s); settle; open every `.step-body details`. Read `.step-body` innerText. If `.step .readiness-bar .inline-link` exists, click it and append `.step dialog[open] .dialog-content` innerText, then close with `.dialog-head button` (1144-1180). Label: `<fixture> @1280 step "<title>"`.

Derived flags: `cannotWriteYet` is true when the body matches `/ first: this policy names an object /`, `/the baseline names a group of its author's, and IAMAI does not yet know /`, `/leaves out a group IAMAI cannot identify/`, `/in place already: nothing to create/` or `/the way back in to .+ is not verified yet/` (1192-1205). `enforcementHeld` is true when it matches `/enforcement waits for \d{1,3}%/` (1212).

**All fixtures**

| Message | Sev | Reads | walk.mjs |
|---|---|---|---|
| `the row is not on the Plan` | P0 | by title or index within 15 s | 1155-1159 |
| `the row does not open` | P0 | `.step-body` within 4 s | 1161-1165 |
| `a Report-only row reads "…" in its date column; it must say where it stands against its gates (…)` | P0 | status `Report-only`, not cannotWriteYet or enforcementHeld; `.when` vs `RE.rowWhen` `/^(ready now\|held until the records clear\|ready \S.*\d{4})$/` | 1223-1224 |
| `the Done when of a Report-only step lacks the time gate with its date` | P0 | `RE.gateTime` `/Time: in report-only since .+, the window clos(es\|ed) \S.*\d{4}\./` | 1225 |
| `the Done when of a Report-only step lacks the evidence gate with today's numbers` | P0 | `RE.gateEvidence` (contentChecks.ts:73-74) | 1229 |
| `the row reads ready now but the step's Done when does not say so` | P0 | `RE.gateReadyNow` `/ready now: 0 failures in \d+ days/` | 1230 |
| `the row is held until the records clear and the step's Done when does not say the window has closed` | P0 | `RE.gateWindowClosed` `/the window closed \S.*\d{4}\./` | 1233 |
| `the row says N and the step's lead says M (one population per step)` | P0 | row `.who` via `countOf(names)` vs the line after `Who this touches` | 1236-1241 |
| `the row says "…" and the opened step says "…"` | P0 | `.step .step-head .step-title` | 1247, 1252 |
| `checkText` invariants on the step body | P0/P1 | §2.2 | 1253 |
| `the step still renders a tip` | P0 | `.step-body .page-tip` | 1259 |
| `a count of one reads "…"` | P0 | `/(?<![\d,.])\b1 (people\|admins\|guests\|users\|accounts\|persons)\b\|(?<![\d,.])\b1 (?:of them\|person\|admin\|guest\|user\|account) (hold\|have\|use\|are\|were\|sign\|need\|do)\b/` | 1283-1284 |
| `the before line "…" is not on the step above the portal lines` / `… renders after the portal lines` | P0 | `BEFORE_LINES` for this title, unless cannotWriteYet or `.implementation-section[data-implementation="package"]`; first 6 words of each line (variables stripped) found before `Conditional Access → Policies → New policy` | 1525-1534 |
| `plan.step` contract diff (§1.4) | P0/P1/P2 | extractor over `.step-body` | 1537-1540 |
| `a CIS chip "…" on the step (frameworks are not a chip)` | P0 | chip `/^CIS\b/` | 1542 |
| `the "<h>" section is empty` | P0 | `h3, h4` followed only by `.actions`, empty lists, a heading, or nothing | 327-333, 1543 |
| `N empty list(s) rendered` | P0 | visible `ul, ol` without `li` | 345, 1544 |
| `the lead "…" has nothing listed under it` | P1 | visible `p` ending `:` not followed by `ul, ol, .names-group, .picker, .decision, p, div` (or followed by a `p` not starting `No `/`Nobody `/`None `) | 335-344, 1545 |
| `forbidden-everywhere string "…" in a What-to-do tab` | P0 | click each `.step-body [role=tab]`; prose text | 1546-1552 |
| `no Learn link on the opened step` | P0 | body has a `Why` line and no `.step-body a[href^="http"]` (links are collected for §2.8) | 1555-1557 |
| `the opened step overflows the viewport by Npx` | P1 | `scrollWidth - clientWidth` | 1558-1559 |

Values recorded, not checked here: `campaignGroups` from the `MFA Registration Campaign` body (`/^(\d+) (?:people\|person) with no sign-in method;/m`, `…with no phishing-resistant method;`, `…with a phishing-resistant method not yet proven`, and whether `Require MFA for Everyone`'s row reads `In place` or `Enforced`) (1263-1281). `exclusionBody` is the body of a title matching `/Exclusions Group/i` (1248). `escapeHeld` is the set of titles where cannotWriteYet (1205).

**Demo fixtures only (`fx.name` starts `demo`; week2 = `demo-week2`)**

| Step title | Message | Sev | Reads | walk.mjs |
|---|---|---|---|---|
| `/Allowed Countries Location/` | `the travellers answer (Regularly: add: NZ) did not put New Zealand on the allowed list` (week2) | P0 | `/New Zealand/` | 1294-1295 |
| same | `the travellers question's effect line is missing although its answer applied` (week2) / `… shows before any answer` (day 1) | P0 | `/on the allowed list now/` | 1296-1297 |
| `/^Require MFA for Guests$/` or `/Countries Not Allowed/` | `the partner answer (exclude service providers) is not on the policy's What to do` (week2, writable) | P0 | `/Service provider users/` | 1299-1300 |
| same | `the service-provider exclusion is not shown beside the baseline's version` (week2, writable) / `a deviation from the baseline shows before any answer` (day 1) | P0 | `/the baseline's version/` | 1301-1302 |
| `/^Block Legacy Authentication$/` | `the mail-sending devices answer's effect line is missing …` (week2) / `… shows before any answer` (day 1) | P0 | `/in the service-accounts group now/` | 1304-1306 |
| `/Service Accounts Group/` | `the mail-sending printer named on the legacy block is not in the service-accounts group's list` (week2) / `the printer is a service account before anyone named it` (day 1) | P0 | `/MFP Reception/` (synthetic device) | 1308-1310 |
| `/^Use Separate Accounts for Admin Work$/` | `the step lists N admin(s) with mail or Teams sign-ins; the demo has two` | P0 | lines `/^.+ · (Outlook\|Microsoft Teams)/gm` ≥ 2 | 1314-1316 |
| same | `the step offers no rollout exception` | P0 | `.step .step-footer button` text `Exclude from rollout` | 1317 |
| `/^Require Phishing-Resistant MFA for Admins$/` (writable) | `the step assumes separate admin accounts instead of naming the people and the step` | P0 | `/see Use Separate Accounts for Admin Work/` | 1319 |
| same (writable) | `the step does not say how many admins are not yet Ready for phishing-resistant MFA today` / `the line says N admins and names M` | P0 | `/^(\d+) admins? (?:is\|are) not yet Ready for phishing-resistant MFA; get each Ready before .+:\s*$/m`, then name lines up to `/^(Roles held\|Today:\|No session control\|\d+ of them\|Contoso)/` | 1322-1331 |
| same | `the row says N would be stopped and the step says only M admins are not yet Ready` / `… and the step names no admin who is not Ready` | P0 | row `.who` `/· (\d+) would be stopped$/` vs body count | 1423-1432 |
| `/Decide How Devices Are Managed/` | `the step does not say the decision is open (phones out until decided)` | P0 | `/phones are out of/i` | 1333-1334 |
| same | `the phones answer's effect line shows before any answer` | P0 | `/Phones leave the compliant-device policy/` | 1335 |
| same (week2) | `the device decision cannot be made on the step (phones option …, computers option …, Save …)` | P0 | click `label` `Protect company apps only`, `label` `Hybrid join is sufficient`, `.step-body .decision` `Save` | 1336-1341 |
| same (week2) | `the decided step did not join the Complete group as In place` | P0 | `#plan-group-complete .plan-row .step-title` within 8 s | 1345-1347 |
| same (week2) | `the phones answer's effect line does not show on the decided step` | P0 | `#plan-group-complete .step-body` `/Phones leave the compliant-device policy/`. Resets device readiness and re-reads the rows (`i -= 1`) | 1348-1357, 1560-1576 |
| `/Require a Managed Device/` | `the device decision (phones protected by their apps) did not scope phones out of the compliant-device policy` (week2, writable) | P0 | `/Device platforms → Include: Any device; Exclude: Android, iOS/` | 1360-1361 |
| same | `the platform deviation is not shown beside the baseline's version` (week2, writable) / `a platform condition shows before the device decision` (day 1) | P0 | `/the baseline's version/`, `/Device platforms/` | 1362-1363 |
| `/^Register Your Own Passkey$/` | `step 12 asks for a key and a passkey; either is enough` | P0 | `/or a hardware security key/` absent | 1445 |
| `/^Block the Admin Portals for Non-Admins$/` | `the step does not name the person without a directory role who signed in to Azure` | P0 | `/^1 person without a directory role signed in to Azure since /m` | 1451 |
| `/^Restrict Service Accounts to the Trusted Network$/` | `the portal lines do not name the service-accounts group` / `… do not exclude the trusted network` (writable) | P0 | `/Users → Include: Groups: \S/`, `/Conditions → Locations → Include: Any location; Exclude: \S/` | 1452-1454 |
| same | `an object id on the step` | P0 | GUID regex | 1455 |
| `/^Block Unsupported Device Platforms$/` | `the step does not name the sign-in that carried no platform` | P0 | `/carried no platform \(Outlook Mobile\)/` | 1472 |
| `/MFA Registration Campaign/` | `the campaign asks admins for a key as well as a passkey; either is enough` (inside the email check) | P0 | body `/passkey or a hardware security key/` | 1411 |
| `/Emergency Access Accounts/` | `an emergency account signed in inside the drill window with no drill recorded, and the step does not ask who signed in and why` (day 1) / `the sign-in is a recorded drill in week two, and the step still asks who and why` (week2) | P0 | `/signed in \d+ days ago, not a recorded drill: confirm who signed in and why/` | 1497-1499 |
| any | (records `sawExistingCoverage`) | — | `/already covers this with/` | 1500 |
| `/Emergency Access Drill/` | `the drill was recorded, and the row does not read done <date>` (week2) | P0 | `.plan-row .when` `/^done \S.*\d{4}$/` within 8 s | 1504-1506 |
| same (day 1) | `no Done control on the Cleanup row` / `Done did not put "done <date>" on the row` | P0 | click `.step-body .decision` `Done` | 1507-1511 |
| `/Did Not Assess/` | `the not-assessed row takes no per-policy note (input …, Save …)` | P0 | `.step-body .decision input[type=text]` ← `not used here`; `Save` | 1513-1516 |
| same | `the note did not render as "<policy>: does not apply: <reason>"` | P0 | `/: does not apply: not used here/` | 1517 |

**E-mail and manager checks, queued per step and run against the printed plan** (§2.6)

| Step title | Message | Sev | Reads (email = `.copy-box p`; more = `details.more` textContent in `.print-plan article.step`) | walk.mjs |
|---|---|---|---|---|
| `/^Shorten Admin Sessions$/` (writable, not enforcementHeld) | `the admin email does not say how long sessions last (expire after {wantedLong})` | P0 | email `/expire after (\d+ hours\|an hour\|a day\|a week\|\d+ days) and never persist/` | 1371-1375 |
| `/MFA Registration Campaign/` | `the campaign email does not say the window in days (…)` | P0 | when campaign dated: `/over the next \d+ days/i` | 1399-1403 |
| same | `the campaign email does not date the day Require MFA for Everyone enforces ({mfaEnforceLong})` | P0 | when dated and not the passkey version: `^From <Weekday>, <Month> <d>, signing in` (m) | 1407-1409 |
| same | `the passkey email names a policy without its date` | P0 | passkey version (`/You already confirm sign-ins/`) with `/requires a passkey/` but no `^From <long date>, .+ requires a passkey\.$` | 1410 |
| same | `Require MFA for Everyone is in place, and the campaign email is not the passkey version` | P0 | `mfaInPlace` and (no `You already confirm sign-ins` or has `will ask you to confirm with the Microsoft Authenticator app`) | 1417 |
| same | `the campaign carries no device line per person after the device decision` (week2) / `the campaign carries device lines before the device decision` (day 1) | P0 | `/ · phone(?![a-z])/` in more or body | 1479-1485 |
| same | `the campaign's email carries no device sentence after the device decision` | P0 | week2, email written: `/nothing to enroll/` | 1483-1484 |
| `/Require a Managed Device/` | `the managed-device email does not say what a personal device can do (…)` | P0 | writable and not held: `/Personal devices are blocked\./` | 1438-1440 |
| same | `it has no enforcement day (…) and still announces a change` | P0 | cannotWriteYet or enforcementHeld, and email non-empty | 1442 |
| `/^Block (Device Code Sign-in\|Authentication Transfer)$/` (writable) | `nobody on the demo used this, and the manager line does not say so` | P0 | more `/Nobody here used it since /` | 1457-1467 |
| `/^Block Unsupported Device Platforms$/` | `one demo sign-in carried no platform, and the manager line says nobody did` | P0 | more `/Nobody here/` | 1468-1471 |

"Campaign dated" means `Require MFA for Everyone`'s `.when` matches `/^[A-Z][a-z]{2} \d{1,2}, \d{4}$/` and is not day-0, or MFA is in place and any row is so dated (1383-1396).

### 2.6 Plan: the printed plan, the footer, the started plan (walk.mjs:1578-1660)

| Message | Sev | Reads | walk.mjs |
|---|---|---|---|
| `<fixture> @1280: the printed plan does not render, so the step emails cannot be read` | P0 | when any e-mail check is queued: `#/export`, stub `window.print`, click `Print or save as PDF`, `.print-plan .print-statement` within 8 s | 1581-1589 |
| queued e-mail/manager checks run (§2.5) | P0 | `.print-plan article.step` keyed by `.step-head .step-title` | 1590-1598 |
| `plan.footer` contract diff (§1.3), label `<fixture> @1280 /plan footer` | P0/P1/P2 | extractor over `main.page .plan-footer`, every `details` opened, completed revealed | 1601-1615 |
| `checkText` on the footer | P0/P1 | `.plan-footer` innerText | 1616-1618 |
| `/plan footer: "…" is a goal the baseline does not hold` | P0 | footer `.step-title` in `ABSENT_TITLES` or `ABSENT_GOAL_NAMES`; any footer row text containing an absent goal name | 1619-1620 |
| `/plan: N done step row(s) read "…" on "…"; a done row reads Complete` | P0 | rows whose `.status` is `In place` or `Enforced`, `.when` ≠ `Complete`, title not a Cleanup title | 1625-1632 |
| `/plan started: no Start the plan control` | P0 | `demo` only: click `button` `/^Start the plan$/` | 1637-1640 |
| `/plan started: the plan does not read Started <date> after Start the plan` | P0 | `main.page .plan-started` `/Started \S.*\d{4}/` within 8 s | 1650-1651 |
| `/plan started: the Start date field is still shown on a started plan` | P0 | `label.rows input[type=date]` | 1652-1653 |
| `/plan started: the start note is still shown on a started plan` | P0 | `/Starting locks the dates/` or `/Clear the date to start/` | 1654-1655 |
| `/plan started: "Started <date>" appears N times; once, under the progress tiles` | P0 | `/Started \S+ \d{1,2}, \d{4}/g` count ≠ 1 | 1656-1657 |
| `checkText` on the started page | P0/P1 | main text | 1658 |

### 2.7 Checks once each fixture is walked (walk.mjs:1663-1780)

| Message | Sev | Condition / reads | walk.mjs |
|---|---|---|---|
| `…: the campaign lists N people needing setup and MFA Readiness counts M` | P0 | campaign `noMethod + needsSetup` ≠ readiness `needsSetup` count | 1665-1667 |
| `…: the campaign lists N people needing proof and MFA Readiness counts M` | P0 | campaign `needsProof` ≠ readiness `needsProof` | 1668 |
| `<fixture>: plan row "…" is a goal the baseline does not hold` | P0 | any row title in `ABSENT_TITLES` / `ABSENT_GOAL_NAMES` (every fixture that walked the plan) | 1670 |
| `<fixture>: the exclusions-group step is missing; it is on every plan` | P0 | demo: no title `/Exclusions Group/i` | 1674 |
| `<fixture>: Block Unsupported Device Platforms is held by device readiness; …` | P0 | demo: reason or when contains `/device readiness/i` | 1682 |
| `<fixture>: Shorten Admin Sessions is held by admin readiness; …` | P0 | demo: `/admin readiness/i` | 1683 |
| `<fixture>: the baseline's service-accounts block is not a row, although the demo has service accounts` | P0 | demo: no `/^Restrict Service Accounts to the Trusted Network$/` | 1685 |
| `<fixture>: no Preparation row asks for separate admin accounts, …` | P0 | demo: no `/^Use Separate Accounts for Admin Work$/` | 1688 |
| `<fixture>: a step found existing coverage but Cleanup has no Consolidate Overlapping Policies row` / `Cleanup has a Consolidate Overlapping Policies row but no step found existing coverage` | P0 | demo: `sawExistingCoverage` ≠ a row matching `/Consolidate Overlapping Policies/` | 1690 |
| `<fixture>: the campaign email dates a policy the plan is holding behind the way back in` | P0 | day-1 passkey email names `Require Phishing-Resistant MFA for Admins requires a passkey` while that title is in `escapeHeld` | 1691-1695 |
| `<fixture>: the passkey email does not name the first policy that needs a passkey` | P0 | not held, not named, and the admins row exists | 1696-1698 |
| `<fixture>: the exclusions-group step still offers to create the group in week two, …` | P0 | week2: exclusion body `/No exclusions group recognised\|New group/` | 1700 |
| `<fixture>: no plan row reads Report-only; the demo has a policy in report-only` | P0 | demo: no status `Report-only` or `/^Report-only · /` | 1716-1719 |
| `<fixture>: no Report-only row reads ready <date> on week one` | P0 | day 1, writable report-only rows exist, none `/^ready \S.*\d{4}$/` | 1720 |
| `<fixture>: no plan row reads Ready to enforce in week two (…)` | P0 | week2: no `Ready to enforce` row while a writable report-only row reads `ready now` | 1725-1730 |
| `<fixture>: the Ready to enforce row "…" reads "…" in its date column; it must read the day the enforcement lands` | P0 | writable `Ready to enforce` row `.when` not `/^\S.*\d{4}$/` | 1731-1732 |
| `<fixture>: the Ready to enforce row "…" carries no evidence on its reason line; …` | P0 | reason (as first read) lacks `/ready now: 0 failures in \d+ days/` | 1733 |
| `<fixture>: the admins row reads "…" in week two; the tenant turned its own policy on, so it reads In place` | P0 | week2: `Require Phishing-Resistant MFA for Admins` status ≠ `In place` | 1745-1746 |
| `<fixture>: N row(s) read Enforced in week two ("…"); …` | P0 | week2: any status `Enforced` | 1747-1748 |
| `<fixture>: no Preparation row decides how devices are managed, …` | P0 | demo: no `/Decide How Devices Are Managed/` | 1757 |
| `<fixture>: "…" waits on the device decision; only the device steps do` | P0 | reason names the decision on a title not matching `/Require a Managed Device/`, `/Intune Enrollment/`, `/App Protection/` | 1759-1760 |
| `<fixture>: <re> does not wait on the device decision while it is open` | P0 | week2: device step neither `Held` / `after: <other>` nor naming the decision (first read) | 1763-1770 |
| `<fixture>: <re> still waits on the device decision after it was made` | P0 | week2: rows re-read after the loop still name the decision | 1771 |
| `content.json has no step <id>: an answered question's step has no words` | P0 | carve-out id missing from content | 1774-1776 |
| `<fixture>: the answered question's step "…" is not on the plan` (week2) / `"…" is on the plan before its question was answered` (day 1) | P0 | carve-out title in rows | 1777-1778 |

### 2.8 After all fixtures: plan file, content, static, cross-surface, console, Learn (walk.mjs:1785-1830, 2165-2197)

| Group | Message | Sev | Reads | File:line |
|---|---|---|---|---|
| Plan file (only if the file exists) | `GetIAMAI plan file, <id> <path>: unfilled variable {x}` | P0 | `HOLE` in rendered fields `title, plainTitle, gap, gapShort, blockedReason, deliveredBy, naming.proposed` | walk.mjs:1796-1800, 1817-1818 |
| Plan file | `GetIAMAI plan file, <id> <path>: forbidden string "…" (redacted quote)` | P0 | `forbidEverywhere` ∪ `plan.step.forbid` ∪ `plan.forbid` ∪ `FORBIDDEN_PHRASES` | walk.mjs:1789, 1801 |
| Plan file | `GetIAMAI plan file, <id>: title "…" is over 9 words` | P1 | `plainTitle` or `title` | walk.mjs:1821 |
| Plan file | `GetIAMAI plan file, <id>: blocked reason over 12 words` | P1 | `blockedReason` | walk.mjs:1822 |
| Plan file | `GetIAMAI plan file, <id>: a saved step for <goal>, a goal the baseline does not hold; …` | P2 | `goalId` ∈ `ABSENT_STEP_IDS` | walk.mjs:1826 |
| Plan file | `GetIAMAI plan file: the saved steps' v2 fields (…) carry old vocabulary (…); …` | P2 | the forbid set over v2 fields `whatChanges … cantSee` (skipping `json`, `powershell`, `rollbackBody`) | walk.mjs:1807-1828 |
| Content (`contentFindings`, over `docs/design/content.json`) | `content <id>: learn.cis is still present (C1: no CIS chip)` | P0 | `steps[].learn.cis` | walkContent.mjs:210 |
| Content | `content <id>: no Learn link (C2)` / `content cleanup.<k>: no Learn link (C2)` | P0 | `learn.url` | walkContent.mjs:213-214 |
| Content | `content <path>: a hard date "…" (C3: …)` | P0 | `HARD_DATE` (month + day or year, or a bare 19xx/20xx year) over steps, cleanup, shared, pages, phases; `example` and `$comment` keys skipped | walkContent.mjs:16-19, 217-219 |
| Content | `content <path>: a preview claim "…" (C3)` | P0 | `/\bpreview\b/i`, except the exact string `Preview` | walkContent.mjs:220 |
| Content | `content <path>: forbidden-everywhere string "…"` | P0 | contract `forbidEverywhere` | walkContent.mjs:230 |
| Content | `content <path>: forbidden string "…" (plan.step / plan.step.more forbid)` | P0 | contract step forbids; skips `whatToDoReference`, `pages*`, `shared.engine*` | walkContent.mjs:228-233 |
| Content | `content <path>: "<tick>" (C5: no tick vocabulary)` | P0 | `/\b(un)?tick(ed\|s\|ing)?\b/i` | walkContent.mjs:21, 238-241 |
| Content (C6, needs pinned baseline) | `content <id>: the condition line reads "…" but the baseline's policy carries <field> … (C6)` | P0 | `sign-in-risk`, `sign-in-risk-medium` (`signInRiskLevels`), `user-risk`, `user-risk-medium` (`userRiskLevels`): the `Conditions → <kind> risk →` line in `whatToDoReference` | walkContent.mjs:245-256 |
| Content (C6) | `content require-managed-device: the baseline's policy has no platform condition and the evidence does not say so (C6)` / `… excludes trusted locations and the title "…" does not say so (C6)` | P0 | `who` `/no platform condition/`; title `/Outside the Office/` | walkContent.mjs:257-262 |
| Content (C6) | `content user-risk: the baseline's policy includes guests, … (C6)` | P0 | `who` `/Guests rated high risk are blocked, not remediated/` | walkContent.mjs:263-265 |
| Content (C6) | `content workload-identity-block: the baseline's policy targets a service principal … (C6)` / `… classic Entra Connect's user account is not named as outside this policy (C6)` | P0 | `/Cloud Sync's provisioning service principal/`, `/Classic Entra Connect syncs with a user account/` | walkContent.mjs:266-271 |
| Content acceptance table | `content <label>: missing (<item>)` / `content <label><path>: does not say … (<item>)` / `content <label><path>: still says … (<item>)` | P0 | each `ACCEPTANCE` entry's `must` / `mustNot` under `step` / `cleanup` / root `path` | walkContent.mjs:40-181, 275-285 |
| Static (`staticFindings`) | `content <path>: missing or empty; a surface authority the walk reads has moved` / `… not a non-empty array of strings; …` | P0 | `AUTHORITIES`: `pages.app.shell.tabs.{connect,plan,readiness,export,how}`, `pages.readiness.summary`, `.summaryNone`, `.states.ready.title`, `.states.{needsProof,needsSetup,unknown}.stat`, `shared.policyDoneWhenTracked[]`, `shared.engine.tracking.{windowCloses,windowClosed,readyNow,evidenceToday,evidenceTodayUnread}` | contentChecks.ts:41-62, 166-175 |
| Static | `content pages.app.shell.tabs: the header line reads "…"; 5 tabs are named` | P0 | `headerTabsLine()` | contentChecks.ts:178-179 |
| Static | `content pages.readiness.states: the summary counts read …; three distinct titles are named` | P0 | `readinessStatTitles()` | contentChecks.ts:182-185 |
| Static | `content pages.readiness.summary: with <a count of one / above one> it reads "…", which the readiness check cannot read` / `… the sentence does not change with the count; …` / `content pages.readiness.summaryNone: reads "…", …` | P0 | `fillText` + `RE.readinessSummary` / `RE.readinessSummaryNone` | contentChecks.ts:189-201 |
| Static | `content shared.policyDoneWhenTracked[0] with <label>: …` / `content shared.engine.tracking.windowClosed: …` / `content shared.engine.tracking.readyNow: …` / `content shared.policyDoneWhenTracked[1] with <label>: …` | P0 | `RE.gateTime`, `RE.gateWindowClosed`, `RE.gateReadyNow`, `RE.gateEvidence` on filled templates | contentChecks.ts:204-225 |
| Static | `pluraliser: "…" with {…} reads "…", not "…"` / `content <id>: no who.lead; …` / `pluraliser: <id> who.lead with …` | P0 | `PLURALISER`, and `PLURALISED_CONTENT` (`admins-phishing-resistant`, `s-check-separate-admin-accounts`) | contentChecks.ts:130-147, 228-240 |
| Static | `content <id>: no whatToDo.before line; …` | P0 | `BEFORE_STEP_IDS` | contentChecks.ts:243-245 |
| Cross-surface | `<fixture>: <kind> readiness reads N% and M% across rows, steps and MFA Readiness (one readiness per kind)` | P0 | collected values per fixture per kind (mfa, admin, device, guest) | walk.mjs:2183 |
| Cross-surface | `<fixture>: the active-people count reads N and M across surfaces (one population)` | P0 | `/\b(\d+) active people\b/` values per fixture (step bodies excluded) | walk.mjs:2184 |
| Console | `demo: console error: …` (labelled `demo` for every fixture) | P0 | `Runtime.exceptionThrown` and `console.error`, minus the allow-list in §2.1 | walk.mjs:171-181, 2186 |
| Learn links | `Learn link <href> answers 404` | P0 | every `.step-body a[href^="http"]` seen plus every content `learn.url`; `probe` = HEAD, then GET, 12 s timeout | walk.mjs:2190-2197, walkContent.mjs:290-302 |
| Learn links | `Learn link <href> answers <status>` | P1 | status ≥ 400, not 404 | walk.mjs:2196 |
| Learn links | `Learn link <href> could not be checked from here (…)` | P2 | fetch error or timeout | walk.mjs:2194 |

### 2.9 Production bundle, throttled first load, and the home page (walk.mjs:2061-2130, 1847-2052)

These run **before** the fixture loop. If `dist/<TOOL_PATH>/index.html` is missing, the walk runs `npx vite build` itself (2065-2073). It serves `dist/` with gzip on `WALK_PORT + 1`, then runs `node scripts/assemble-site.mjs` for the home page (2115-2119).

| Message | Sev | Reads | walk.mjs |
|---|---|---|---|
| `demo: the production bundle could not be built here, so the throttled first load was not measured` | P2 | build failed | 2074 |
| `demo: the first load did not show a plan row within 30 s on a throttled connection (production bundle)` | P1 | 150 ms latency, 1.6 Mbit/s down, 750 kbit/s up; `?demo=1#/plan` until `.plan-row` | 2099-2103, 2126 |
| `demo: the first load took N s to the first plan row on a throttled connection (production bundle; over 2 s)` | P1 | > 2000 ms | 2127 |
| `production bundle, demo: the demo chunk (demo-*.js) did not load in demo mode` | P0 | resource `/assets/demo-*.js` | 2108-2109 |
| `production bundle, signed out: the demo chunk loaded outside demo mode (…)` | P0 | `#/connect` without demo; `/assets/demo(Facts)?-*.js` | 2110-2113 |
| `home: the site could not be assembled here (…), so the home page was not walked` | P2 | `dist/index.html` missing | 2120 |

Home page (label `home @1280 /`, static server root `/`). Expected words come from `pages.home`, `pages.app.shell`, `pages.footer.links`. Every check is P0.

| Message | Reads | walk.mjs |
|---|---|---|
| `checkText` invariants | main text | 1871 |
| `the retired opener still renders: "…"` | `RETIRED_OPENER` (scripts/build-home.ts) in body text | 1873 |
| `a Built for block renders; …` | `/Built for/` | 1874 |
| `N element(s) of the retired tool-card composition …` | `main.page .card, .pill, .grid, .tool-name, details, .panel, .panel-key` | 1879-1880 |
| `N boxed element(s) in the page body; the two hero actions and nothing else` | elements with bottom, left and right border ≠ 0 must be exactly 2 | 1881-1882 |
| `no header` / `the wordmark is "…" → …; <brand> → /` | `header.app a.wordmark` text = `HOME.brand`, href `/` | 1885-1888 |
| `the public header's links are …; …` | `nav.links a` = `HOME.navHow` → `/<TOOL_PATH>/#/how`, `HOME.navSource`, `HOME.open` → `/<TOOL_PATH>/#/connect` | 1889-1896 |
| `the signed-in navigation renders in the public header` | `.tabs, [aria-current]` in header | 1897 |
| `no hero` / `the hero eyebrow reads …` / `the headline reads …` / `the site line reads …` / `the hero's meta row reads …` | `.hero p.eyebrow`, `h1`, `p.site-line`, `p.meta span` vs `HOME.eyebrow`, `h1`, `siteLine`, `heroMeta` | 1901-1907 |
| `the hero display renders at Npx; the approved pack sets 50` | `h1` font-size rounded = 50 | 1909 |
| `the hero names Conditional Access before …` | eyebrow + h1 + line | 1911-1912 |
| `the hero's actions are …; …` | `.actions a.btn` = `HOME.open` primary → connect, `HOME.demo` secondary → `/<TOOL_PATH>/?demo=1#/plan` | 1913-1917 |
| `the links into the planner are …; …` | all `a[href^="/<TOOL_PATH>/"]` in order: header how, header connect, hero connect, hero demo, rail (`.side`) connect | 1922-1932 |
| `the sections read …; …` | `section.band` `aria-labelledby` / `p.eyebrow` / `h2` = work, catches, trust, about (labels and headings from `pages.home`) | 1934-1943 |
| `the headings are …; H1 then four H2` | `h1, h2, h3` tag list | 1945-1946 |
| `the beats read …; …, from pages.home.work` | `.steps .step` `b` / `span` vs `HOME.work` | 1949-1952 |
| `the approved two-column product section and its side rail do not render` / `the product section is X with N column(s); …` / `the side rail is not narrower than …` / `the side rail has no border …` | `.product` grid with 2 columns; first child wider than `aside.side`; `borderLeftWidth` ≠ 0 | 1953-1959 |
| `no baseline rail` / `the baseline rail does not name <fact>` / `… does not explain what a baseline is …` / `… claims a Microsoft endorsement: …` | rail text includes `Defense in Depth`, `Jon Hope`, `Microsoft MVP`; `HOME.baseline` starts `A baseline is `; no `/Microsoft(-\| )(approved\|certified\|endorsed\|recommended\|official)\|endorse\|certifie/i` | 1962-1968 |
| `the examples list N row(s) that differ from pages.home.catches` / `N examples; a few, not a wall` | `.catches .catch` vs `HOME.catches`; ≤ 6 | 1970-1972 |
| `no trust row` / `the trust row has N claims; M` / `… does not say IAMAI is read-only …` / `… does not say the tenant's data stays in the browser` / `… does not link the public source` / `… trades a specific claim for a slogan` / `… makes a guarantee nothing in the product backs` / `the hosting sentence is How's, …` | `.trust > span`; `/create, change or delete\|read-only/i`; `/browser/`; link `/github\.com/`; not `/privacy first\|secure by design\|your data is safe/i`; not `/ISO ?27001\|SOC ?2\|GDPR compliant\|HIPAA\|certified\|uptime\|SLA\|trusted by/i`; not `/Cloudflare/` | 1974-1985 |
| `no About section` / `About reads "…"; pages.home.about` / `About carries N link(s); …` | `section.band[aria-labelledby="about-heading"] .about p`; no `a` | 1988-1993 |
| `N form control(s) on a page that collects nothing` | `form, input, textarea, select` | 1995-1996 |
| `no footer` / `the footer opens with "…"; …` / `the footer's links differ from pages.footer` / `the footer's name and links are not at the two ends (…)` | `footer.app` first child = brand; links = `pages.footer.links` minus the getiamai.com home link; `justify-content: space-between` | 1999-2005 |
| `no theme control in the header with the app's labels` / `the header's X control has a button face (…); text` | `header.app .right button` | 2007-2009 |
| `the theme control does not switch the theme (…)` / `the page and the section rule do not repaint …` / `the primary button has no fill` / `the theme control's label reads "…" in the X theme` / `the theme control does not switch back` | click `#theme` twice; `data-theme`, body background, `section.band` border colour, `a.btn-primary` background, label | 2010-2023 |
| `string(s) on the page that are not in content.json: …` | every body text node (not script/style, not `·` or `\|`) ∈ `pages.home` leaves ∪ footer texts ∪ theme labels | 2025-2028 |
| `pages.home string not on the page: "…"` | every `pages.home` leaf except `metaTitle` / `metaDescription` | 2029 |
| `home @<w> /: the page is Npx wider than the viewport` | widths 768 and 390: overflow > 1 | 2034-2041 |
| `home @<w> /: no way into the product is on screen` | visible `a[href^="/<TOOL_PATH>/#/connect"]` | 2042 |
| `home @<w> /: the product section is still N columns; …` / `the rail's border did not move from its left to its top (…)` / `a catch is still N columns; …` | width ≤ 760 (390 only; 768 is above 760): 1 column, left border 0 and top ≠ 0, `.catch` 1 column | 2043-2047 |

---

## 3. Smoke checks (`scripts/smoke.mjs`)

`npm run smoke` = `node scripts/smoke.mjs` (package.json:18).

- Harness: vite on `$SMOKE_PORT` (default 5199), Chrome headless `--window-size=1440,1000`, CDP `$SMOKE_CDP_PORT` (default 9444), fresh profile `iamai-smoke-profile`. The base URL is `http://localhost:<PORT>/?dev=1&mock=1`, the synthetic mock tenant, with no `TOOL_PATH` (smoke.mjs:54-56, 108-161). No viewport override: the window size is 1440 × 1000.
- Each check prints `ok  <name>` or `FAIL <name>  (detail)`. There are no severities: every failed check is a failure. `skip <name>` is used only for the external sign-in check when `EXTERNAL_HEALTH` ≠ `1` (smoke.mjs:73-88, 845-864).
- Exit codes: 0 all pass; 1 any FAIL (`smoke: N check(s) failed` then `  FAIL <name>` lines); 2 harness (`smoke: harness — …`) (smoke.mjs:14-20, 69-70, 124-129, 155-160, 1320-1329). An exception inside the run becomes the failed check `walk completed` (1312-1313).
- Injected on every new document: first-frame hash recorder; resource buffer 20000; `window.__dl` download capture (anchor `.click()` with `download`); `window.__alerts`; `window.print` stub (fires `beforeprint`, counts `__printed`); `navigator.clipboard.writeText` → `window.__copied` (smoke.mjs:235-251).
- Contract lists used: `FORBID_EVERYWHERE`, `STEP_FORBID` (`plan.step.forbid`), `PRINT_FORBID` = `forbidEverywhere` + step forbids minus `plan.step.more.allow.headings` (smoke.mjs:34-42). Content keys used: `pages.readiness.columns`, `pages.readiness.states.{needsProof,needsSetup,unknown}.stat` (50-52). `SUMMARY_LINE` = `/(\d+) of (\d+) (?:is|are) Ready\./` (46).

| # | Check name (as printed) | Reads (selector / text) | smoke.mjs |
|---|---|---|---|
| 1 | Sign-in: an auth response in the fragment is intact when the first frame renders | navigate `#code=abc&client_info=def&state=ghi`; `window.__firstFrameHash` equals it | 252-256 |
| 2 | Sign-in: once auth has settled the page lands on Plan | `location.hash === '#/plan'` | 257 |
| 3 | Connect (signed out): the demo chunk is not loaded outside demo mode | `&state=signedOut#/connect`; wait for 3 `.connect-flow .connect-step` + 1 `.connect-destination`; no resource `/src/ui/demo.ts` or `/src/ui/demoFacts.ts` | 261-263 |
| 4 | Connect (signed out): the sample facts are on the page without it | `/\d+\s*steps/` and `/already in place/` | 264-265 |
| 5 | Preload failure: the page reloads once | `vite:preloadError`; navigation `reload` and `__stillHere` undefined | 267-268 |
| 6 | Preload failure: a second failure in the session does not reload again | event not `defaultPrevented`; `__stillHere === 2` after 1.5 s | 269-272 |
| 7 | Connect (signed out): the heading, the sign-in tile with the consent sentence, Sign in with Microsoft and Try it with sample data | `/Strengthen identity security without guessing what will break/`, `/Sign in\s+no tenant connected/`, `/every sign-in after that can be Global Reader/`, `/Sign in with Microsoft/`, `/Try it with sample data/`; not `/Built for\|What it catches\|Connect a tenant/` | 275-278 |
| 8 | Connect: the permissions disclosure opens and lists the scopes | click `a, button, summary` `/What IAMAI asks for/`; `/Read your organization's policies/` | 281-286 |
| 9 | Connect: one consent row per tenant scope in Microsoft's wording, no table, no sign-in scopes | `details.permissions .tile-rows li` = 6; no `table`; no `/openid/` | 288 |
| 10 | Connect: the collapsible ends with the removal line | `/Remove it any time: Entra admin center → Enterprise applications → IAMAI Planner → Delete\./`; not `/leaves nothing behind/` | 289 |
| 11 | Connect: no requested scope sits unused | not `/Requested, not yet used/`, `/Application\.Read\.All/`, `/Used for/` | 292 |
| 12 | Connect: the tiles read at the page column, not the measure | `.connect-flow` width ≥ 700 | 294 |
| 13 | Connect (no scan): Scan tenant and the ten-minute line | `&state=noScan`; `/Scan tenant/`, `/About ten minutes\. Reads the tenant into this browser; nothing is sent anywhere\./` | 296-299 |
| 14 | Connect (no scan): nothing about a plan yet | not `/Open the plan/` | 300 |
| 15 | Connect (scanning): the lane in plain words with the elapsed time, and Stop | `&state=scanning`; `/reading people · \d+s/`, `/Stop/`, not `/Scan tenant/` | 301-304 |
| 16 | Connect (scanning): the header tabs are disabled | `header.app nav a[aria-disabled="true"]` = 3 | 305 |
| 17 | Connect: tile 1 names the tenant, the account and its role | `#/connect` (scanned); `/Signed in\s+Contoso Pty Ltd/`, `/alex@example\.com · Global Administrator/` (synthetic mock) | 307-311 |
| 18 | Connect: tile 2 carries the baseline and its policy count | `/Baseline\s+selected/`, `/synthetic baseline/`, `/1 polic(y\|ies) · uploaded package/` | 312 |
| 19 | Connect (scanned): the Plan stage is the destination, one way on, no readiness diagnostic in front of it | `/Plan\s+ready/` within 20 s; `.connect-destination` text has `Open the plan →`, `Built from this scan`, no `/MFA Readiness/i`; no `.connect-destination .facts, .rung-tile`; no `a[href*="#/readiness"]` | 314-325 |
| 20 | Connect (scanned): the finished stages settle, at most one is current, and a current one carries the Next marker | `.connect-step` classes; ≤ 1 current, ≥ 1 settled, settled before current; `.connect-step.current .next` non-empty | 328-336 |
| 21 | Connect (scanned): the scan's age once as Scan complete · N ago, Plan ready · from the scan with the same age, and no scanned line | `/Scan\s+complete · ([^\n]+)/`; `complete · ` exactly once; `from the scan <age>`; no `scanned` | 338-343 |
| 22 | Connect (scanned): the plan state counts the steps and how many are done | `/ready · \d+ steps, \d+ done · from the scan/` within 20 s | 344 |
| 23 | Connect: Global Reader is the only role IAMAI names | not `/Security Reader\|Reports Reader/` | 345 |
| 24 | Connect (scanned): Change baseline opens the picker with two choices | click `/^Change baseline$/`; `/Upload a package/`, `/How to make one →/` | 346 |
| 25 | MFA Readiness: the summary renders | `#/readiness`; `.readiness-summary .summary-stat` = 3 | 348-349 |
| 26 | MFA Readiness: the heading and its one opening sentence | `/MFA Readiness/`, `/See who can meet phishing-resistant MFA/` | 351 |
| 27 | MFA Readiness: the summary says how many active people are Ready | `SUMMARY_LINE` | 353-355 |
| 28 | MFA Readiness: one summary panel — the answer and three counts that are buttons — and no second boxed count | `.readiness-summary.panel`, one `:scope > .summary-main`, three `:scope > button.summary-stat`; no `.group-tile, .group-counts` | 356-359 |
| 29 | MFA Readiness: Need proof, Need setup and Unknown beside Ready, summing to the active people | `.stat-k` titles = `STAT_TITLES`; ready + `.stat-n` sum = active | 360-364 |
| 30 | MFA Readiness: no ladder and no rung badge on the page | `.ladder, .ladder-row, .rung-tile, .rung-badge` = 0 | 365 |
| 31 | MFA Readiness: one strip for the Plan gate and the passkey rollout | `.progress-strip .progress-item` = 2; `/Plan gate/`, `/\d+ of \d+ must be Ready/`, `/Passkey rollout/`, `/\d+ of \d+ (?:has\|have) a passkey/` | 366-369 |
| 32 | MFA Readiness: no legend, no banner, no rollout tiles, no filter chips | not `/Legend/`, `/To set up before enforcement/`, `/Sign-in records: complete/`; `.filter-bar, .legend-card, .tiles` = 0 | 370 |
| 33 | MFA Readiness: the toolbar — a search box, then the filters as pills, Needs action pressed by default, and no dropdown | no `select`; `.toolbar input[type=search]`; `.toolbar .btn.pill[aria-pressed]` ≥ 5; pressed pill text `Needs action`; `/No passkey/` | 371-378 |
| 34 | MFA Readiness: the link to every account and policy the scan read | `/Every account and policy the scan read →/` | 379 |
| 35 | MFA Readiness: a count's hash filters the worklist to exactly the rows it counts, and the count says it is pressed | `#/readiness/needsSetup`; second `.summary-stat` `aria-pressed="true"`; `table.datatable tbody tr` = its `n` | 381-386 |
| 36 | The old Today hash reaches MFA Readiness | `#/today` → `#/readiness` | 388-389 |
| 37 | MFA Readiness: the worklist has the six zones in order — Person, Role, Methods, Proof, Readiness, Action — and the role is a word | `#/readiness/all`; `table.datatable thead th` = `pages.readiness.columns`; `td .role` non-empty | 390-400 |
| 38 | MFA Readiness: the table has no inner scroll | `.datatable-wrap` `maxHeight` = `none` | 401 |
| 39 | MFA Readiness: the approved table panel, with the head as an uppercase key on the inset surface | wrap border-top 1px, radius ≥ 12; `th` uppercase, static, non-transparent background | 404-407 |
| 40 | MFA Readiness: no detail open until a person is chosen | `dialog[open]` = 0 | 410 |
| 41 | MFA Readiness: a person's action opens the detail for them, with Why and Next and nothing else | click the first `tbody tr button.row-action`; `dialog.readiness-detail[open]` text `/why/i`, `/next/i`; `.detail-block` = 2 | 414-422 |
| 42 | MFA Readiness: no raw identifier in the detail | no GUID | 423 |
| 43 | MFA Readiness: Close puts the detail away | click `Close`; `dialog[open]` = 0 | 424-426 |
| 44 | Inventory: policies table renders | `#/inventory`; `table tbody tr` ≥ 3 | 430-431 |
| 45 | Inventory: the heading, the ← MFA Readiness link, and no intro sentence | `/Everything the scan read/`, `/← MFA Readiness/`, not `/as found: no analysis/` | 433 |
| 46 | Inventory: the ten tabs | `main.page [role=tab]` = 10 | 434 |
| 47 | Inventory: the page uses its own operational column | `main.page` width ≥ 1040 | 444 |
| 48 | Inventory: the head is the packs' inset band inside a panel, not the legacy sticky one | `.datatable-wrap.panel table.datatable th`: static, uppercase, wrap border ≠ 0, non-transparent background | 445-450 |
| 49 | How IAMAI works: the reference page renders with its sections | `#/how` until `HOW_DRAWN` (`/Every check IAMAI runs/` and `/Field practice/`); `How IAMAI works`, `Permissions`, `What IAMAI reads`, `Every check IAMAI runs`, `Baseline packages`, `Limits` | 451-457 |
| 50 | How: the old reference routes redirect here | `#/checks` → `#/how` | 458 |
| 51 | Start redirects to Connect | `#/start` → `#/connect` | 463-464 |
| 52 | Baseline redirects to Connect | `#/baseline` → `#/connect` | 465-466 |
| 53 | Scan redirects to MFA Readiness | `#/scan` → `#/readiness` | 467-468 |
| 54 | Roadmap redirects to Plan | `#/roadmap` → `#/plan` | 469-470 |
| 55 | What IAMAI reads redirects to How | `#/reads` → `#/how` | 471-472 |
| 56 | Licensing redirects to How | `#/licensing` → `#/how` | 473-474 |
| 57 | Plan renders at #/plan | hash `#/plan` and `.plan-progress-tile` | 475-477 |
| 58 | Plan: the header shows progress tiles for steps, in place, waiting and remaining | `.plan-progress-tile` `dt=dd` joined = `/^Steps=\d+, In place=\d+, Waiting=\d+, Remaining=\d+$/` | 481-483 |
| 59 | Plan: no second header line; the tenant and the scan age live on Connect alone | not `/Today shows where each person stands/`, not `/scanned\|Built from what IAMAI found on\|from the scan/` | 485 |
| 60 | Plan: no MFA readiness ladder above the board | `.rung-tiles, .rung-tile, .strip-head` = 0 | 489 |
| 61 | Plan: the Start date proposes today in the display zone | `.plan-start label.rows input[type=date]` value = today in `mapping.displayTimeZone` (weekend → Monday) | 491-497 |
| 62 | Plan: the Start date field is a spaced row in Plan settings' control style | label flex, gap ≥ 8; input padding-top 0px, border-bottom 1px | 498 |
| 63 | Plan: groups render as sections with a next mark | `.plan-group` ≥ 1, `.plan-row` ≥ 3, text `/next/` | 503 |
| 64 | Plan: the four zones are named over the rows | first `.plan-column-head` children = `State\|Step\|Impact\|When` | 504 |
| 65 | Plan: the three lanes are tabs with Ready selected | `.plan-controls [role=tab]` = `Ready:true Up Next:false On Hold:false` | 523 |
| 66 | Plan: every row carries a Lane · substatus label | across lanes, `.plan-row .lane` ≥ 3, all `/^(Ready\|Up Next\|On Hold) · \S/` | 525-526 |
| 67 | Plan: the focus controls are pressable toggles with live counts | `.plan-controls .focus` = `/^Needs attention=\d+\/false \| Show completed=\d+\/false \| Show deferred=\d+\/false$/` | 529 |
| 68 | Plan: Work type is a filter beside the toggles, never a lane | `.plan-controls .work-type select` options = `All work\|Conditional Access\|MFA & Authentication\|Tenant setup\|Resolution & decisions` | 530 |
| 69 | Plan: one row is marked next, and it is in the Ready lane | `.plan-row .next-mark` = 1 | 533-534 |
| 70 | Plan: ready work outnumbers the next step, so the marker is not a synonym for ready | rows with `.status` `Ready` > next marks | 535-536 |
| 71 | Plan: the board drops the generic now from supporting rows | no `.plan-row .when` = `now` | 540 |
| 72 | Plan: a Blocked row reads what it waits on or Held, or its date beside what it comes after | Blocked rows: when `Held`, `Not scheduled`, `/^After /`, `/reaches\|held\|ready/i`, or `/\d{4}$/` with reason `/^(after: \|when )/` | 545-549 |
| 73 | Plan: no row leaves When or Impact blank | `.when` and `.who` non-empty | 551-552 |
| 74 | Plan: opening a row shows the content-driven step | click the first `.plan-row`; `/Why/`, `/Readiness/`, `/Done when/` | 553 |
| 75 | Plan: the step title is nine words at most | every `.step-title` ≤ 9 words | 554 |
| 76 | Plan: the opened step is a frame attached under the row that opened it | `.step` is `ARTICLE` with `:scope > .step-head`, `.step-body > .step-main`; previous sibling `plan-row\|true` | 557-560 |
| 77 | Plan: the opened step ends in the frame's own footer, under both columns | `:scope > .step-footer` follows `:scope > .step-body` | 564 |
| 78 | Plan: the footer offers the rollout exception and the scan, and nothing else | `.step > .step-footer button` includes `Scan to update the plan`; all ∈ {`Scan to update the plan`, `Exclude from rollout`, `Doesn't apply here`, `Put this step back`}; none disabled | 565 |
| 79 | Plan: the opened step draws Readiness and the Next milestone rail | `.readiness-strip .readiness-tile` 1-3; `.readiness-bar`; `.step-side` `/Next milestone/i` with one `.side-block` | 567 |
| 80 | Plan: the step head states the lifecycle and condition once | `.step .step-state` = 0; `.step .step-head .status` present | 570 |
| 81 | Plan: the implementation control matches the channels that exist | `.implementation-section`: a preview (`data-preview="true"`) has no `[aria-label="Copy implementation"]`; `.tabs.impl-tabs` has ≥ 2 tabs and no `.implementation-empty`, else `.implementation-empty` present | 575 |
| 82 | Plan: the one app header stays put when the plan scrolls | one `header.app`, `position: sticky`, top 0 after scrolling to 800 | 577-580 |
| 83 | Step: the What-to-do tabs carry no forbidden placeholder | (only if a row with `.step-body .tabs .tab` is found) click `JSON`, `PowerShell`, `Entra`; `.step` textContent vs `forbidEverywhere` | 584-590 |
| 84 | Plan: Plan settings opens the popover | click `/^Plan settings$/`; `.plan-settings` | 591 |
| 85 | Plan: the footer names its groups | `.plan-footer summary` contains `Already in place`, `Doesn't apply here`, `Not licensed` or `Housekeeping` (≥ 1) | 592 |
| 86 | Plan: one status word per row | `.plan-row .chip.status` ≥ 3 | 593 |
| 87 | Plan: a step held on its own sign-in requirement links to MFA Readiness | open rows until `a[href^="#/readiness/step/"]`; its `p` `/cannot meet its sign-in requirement/` | 598-600 |
| 88 | MFA Readiness: opened from a step, it says which step and filters to its people | (if link found) navigate the href; `/Filtered to the \d+ (people\|person)\b/`; rows = the leading count | 601-609 |
| 89 | MFA Readiness: and offers the way back to that step | `/← Back to the step/` | 610 |
| 90 | MFA Readiness: a Plan filter does not change the tenant-wide counts | `SUMMARY_LINE` active count unchanged | 612-613 |
| 91 | Plan: no v2 vocabulary on the surface | Plan text not `/Do it\|Exit criteria\|Assumes\|Recovery card\|Before anything else\|handle-with-care/`, not `/ Wave /` | 617 |
| 92 | Export: six cards render | `#/export`; `.export-card` = 6 | 625-627 |
| 93-96 | Export: "Download calendar (ICS)" / "MFA Readiness as CSV" / "Download every prompt" / "Download the bundle" produces bytes | exact-label click; `window.__dl` grows with size > 0 | 628-634 |
| 97 | Export: Print or save as PDF prints the document | click; `__printed ≥ 1` | 635-637 |
| 98 | Export: the print document renders its cover | `.print-plan .print-cover h1` `/Conditional Access rollout plan/` | 638 |
| 99 | Export: the print document carries no forbidden placeholder or step vocabulary | `.print-plan` textContent vs `PRINT_FORBID` | 640-642 |
| 100 | Export: the print renders the step body, not the old fields | `/Who this touches/`; not `/Proposed name:\|What the last 30 days say/` | 644 |
| 101 | Export: the print DOM is gone once printing ends | `afterprint`; `.print-plan` null | 646-648 |
| 102 | Export: Save plan file produces bytes | `__dl` grows, size > 0 | 649-652 |
| 103 | Export: the saved plan carries its steps | blob text `/"steps"\s*:/` | 653-654 |
| 104 | Export: the plan file round-trips (parses back with its steps) | `JSON.parse`; `steps.length ≥ 3` | 659-660 |
| 105 | Export: Load a plan file runs the import path | `input[type=file]` change; an alert, or hash `#/plan` | 661-665 |
| 106 | Export: no downloaded artifact carries a forbidden placeholder | every `__dl` blob vs `forbidEverywhere`; `urn:user:` allowed in `.json` | 671-674 |
| 107 | Header: the five destinations in order and the controls, no tenant tab (the tenant is on Connect) | `header.app` innerText: no `Contoso Pty Ltd`; `nav a` = `Connect · Plan · MFA Readiness · Export · How`; no `Recovery card`; `/Account/` | 677-689 |
| 108 | Name: the wordmark is IAMAI and the tab title carries the wordmark and descriptor | header `/^IAMAI(?!\s+Planner)/`; `document.title === 'IAMAI — Microsoft Entra Planner'` | 694 |
| 109 | Header: no scan control and no scan age on any page | not `/Scan to update the plan\|scanned\|Re-scan/` | 695 |
| 110 | Header: the theme and Account controls are text, not button faces | `header.app .right button` ≥ 2, border 0px, background `rgba(0, 0, 0, 0)`, padding-left 0px | 696 |
| 111 | Header: no sidebar, no stepper | `.stepper, .body-grid, .topbar` = 0 | 697 |
| 112 | Header: the theme control names the mode it switches to | `/Light theme\|Dark theme/` | 698 |
| 113 | Header (no scan): the three tabs that read a scan wait for one, and Connect and How stay live | `&state=noScan#/plan`; `nav a[aria-disabled="true"]` = `Plan · MFA Readiness · Export`, first title `after the first scan`; others `Connect · How` | 699-709 |
| 114 | Header (signed out): only the wordmark and the theme control | `&state=signedOut#/connect`; header `/IAMAI/`, not `/MFA Readiness\|Account\|Recovery/` | 710-713 |
| 115 | Unlicensed tenant: the plan renders from configuration and directory data | `&licence=free#/plan`; `/[0-9]+ steps/` | 716-718 |
| 116 | Unlicensed tenant: the plan footer names what is not licensed | `/Not licensed \(\d+\)/` | 719-720 |
| 117 | Unlicensed tenant: MFA Readiness says why there are no sign-in records | `&licence=free#/readiness`; `/no sign-in records \(needs Entra ID P1 or P2\)/` | 721-724 |
| 118 | Unlicensed tenant: nobody is Proven without records | no `td .status, td .chip` = `Proven` | 727 |
| 119 | Unlicensed tenant: the plan still generates | `&licence=free#/plan`; `/[0-9]+ steps/` | 728-730 |
| 120 | Unlicensed tenant: the ladder steps are the plan | ≥ 2 of `data/free-tier-ladder.json` `items[].name` in text | 733-734 |
| 121 | Unlicensed tenant: nothing asks for objects a policy would reference | not `/Create a trusted named location\|Create the exclusions group/` | 736 |
| 122 | Unlicensed tenant: a step opens in place | click the first `.plan-row`; `.step-body` | 737-741 |
| 123-124 | Zero policies: the plan renders (asserted twice, identical) | `&policies=0#/plan`; `/[0-9]+ steps/` | 742-747 |
| 125 | Scan with gaps: the tile says so and builds no plan | `&state=gaps#/connect`; `/finished with gaps · no plan built/` | 751-753 |
| 126 | Scan with gaps: the unread sections are rows marked not read | `/Conditional Access policies\s*not read/`, `/Sign-in records\s*not read/` | 755 |
| 127 | Scan with gaps: the one ask is Global Reader, read-only | `/Ask whoever administers the tenant for Global Reader; it reads every section and writes nothing\./`; no Security or Reports Reader | 756 |
| 128 | Scan with gaps: the last full plan stays open | `/Open the last full plan \([A-Z][a-z]{2} \d+\)/`; not `/Open the plan →/` | 757 |
| 129 | No page threw | console errors minus `/authmethods\|Not signed in\|favicon/` = 0 | 759 |
| 130 | Forget: stores hold rows for the tenant before forgetting | IndexedDB `iamai`, first `plan` key; rows with that `tenantId` > 0 | 762-767 |
| 131 | Forget: the Account menu opens | click `/^Account$/` in `header.app` | 768 |
| 132 | Forget: the button is there | click `/^Forget this tenant/` in `header.app` | 770 |
| 133 | Forget: every store is empty for the tenant afterwards | rows = 0 | 772-773 |
| 134 | Forget: Connect shows the not-scanned state, still signed in | `/Signed in/`, `/Scan tenant/`, not `/Open the plan/` | 775-776 |
| 135 | Checks: the reference page lists the registry by subject | `#/checks` until `HOW_DRAWN`; `/Every check IAMAI runs/`, `/Emergency access accounts/`, `/The exclusions group/` | 779-782 |
| 136 | Checks: the severities render | `/Must fix/`, `/Recommended/`, `/Note/` | 783 |
| 137 | Checks: a break-glass rule is on the page in plain language | `/Global Administrator is assigned permanently and active/` | 784 |
| 138 | Checks: every rule names a source | `/Source/i`, `/Microsoft: manage emergency access accounts/` | 786 |
| 139 | Checks: field practice is labelled rather than dressed up as Microsoft | `/Field practice/` | 787 |
| 140-141 | Accessibility (light) / (dark): every control has a name a screen reader can announce | `#/plan`, `data-theme` set; `Accessibility.getFullAXTree`; roles `button, link, checkbox, textbox, combobox, switch, tab`, not ignored, with an empty name → none | 793-803 |
| 142 | No console errors or exceptions across the walk | `consoleErrors.length === 0` (no allow-list) | 805 |
| 143 | Sign-in: the warming button is clickable so an early click is not lost (item 7) | fresh navigate `&state=signedOut#/connect`; `.connect .connect-step-actions button` not disabled | 818-838 |
| 144 | Sign-in: the first click after load lands on the button, not lost to the warm (item 7) | click `/Sign in with Microsoft/` found | 844 |
| 145 | Sign-in (external): the click starts the flow via the real authority metadata fetch (item 7) | only with `EXTERNAL_HEALTH=1`: `sessionStorage` keys `/msal\|login\.windows\|microsoftonline/` > 0; up to `MAX_ATTEMPTS` passes, probing `https://login.microsoftonline.com/organizations/v2.0/.well-known/openid-configuration`, retried only when transient. Otherwise printed as `skip` | 845-864 |
| 146 | Demo: Connect offers the sample-data entry (item 12) | `/Try it with sample data/` | 878-881 |
| 147 | Demo: entering lands on the plan under the sample-data banner | click it; hash `#/plan` and `/Sample data/` | 884-885 |
| 148 | Demo: the banner says nothing is from a real tenant and offers to leave | `/Sample data . nothing here is from a real tenant/`, `/Leave the demo/` | 889 |
| 149 | Demo: the plan header shows progress tiles for steps, in place, waiting and remaining | as #58 | 888, 893 |
| 150 | Demo: the demo chunk loads in demo mode | resource `/src/ui/demo.ts` | 894 |
| 151 | Demo: the header carries the sample-data banner, not the org name | header not `Contoso Pty Ltd`; body `/Sample data/` | 895 |
| 152 | Demo: a readiness-held step reads its reason in the date column, or on its reason line beside its creation day | across lanes, `.when / .plan-row-reason` joined matches `/when [A-Za-z ]*readiness reaches \d+% \(now \d+%\)/` | 900-902 |
| 153 | Demo: two steps open and show their detail | click rows until 2 open `.step-body` | 905-916 |
| 154 | Demo: a picker decision is saved | open row `/Service Accounts Group/` in any lane; click `.step-body .decision` `Save` | 947-956 |
| 155 | Demo: a step is skipped | row `/Block the Admin Portals/`; (`Put this step back` if needed) `.step .step-footer` `Exclude from rollout`; dialog `textarea` ← `Not needed for this tenant`; `.dialog-actions-row` `Exclude from rollout`; press `Show deferred`; row shows `Skipped` | 959-979 |
| 156 | Demo: the plan start is set | `Plan settings`; `input[type=date]` ← `2026-10-05`; `Close` | 981-989 |
| 157 | Demo: the record holds the decision, the skip and the start | IndexedDB `plan` get `demo-sample-tenant`: `"stepDecisions":{`, `"s-prereq-service-accounts-group":`, skips has `s-goal-admin-portals-protected`, `"startDate":"2026-10-05` | 990-998 |
| 158 | Demo: Save plan file carries the tenant id, the decision, the skip and the start | Export `Save plan file` blob: `"id": "demo-sample-tenant"`, both ids, `2026-10-05` | 1018-1027 |
| 159 | Demo: Load a plan file takes the saved file back, with no tenant refusal | file input change; hash `#/plan` within 6 s; no new alert | 1028-1036 |
| 160 | Demo: the loaded plan re-renders with the same decisions, start date and skips | wait for progress tiles = before; record after === record before | 1037-1049 |
| 161 | Demo: the loaded plan renders the same rows as before the save | Ready lane, both toggles pressed; `main.page` innerText identical | 1013-1016, 1044-1050 |
| 162 | Demo: MFA Readiness renders over the sample people | `table.datatable tbody tr` ≥ 4 | 1053-1054 |
| 163 | Demo: print page 1 renders the posture summary | `.print-plan .print-cover` has `Conditional Access rollout plan`, `Tenant`, `Scanned`, `Baseline`, `In place (`, `To do (`, `Doesn't apply (` | 1057-1065 |
| 164 | Demo: the banner names the snapshot on screen and the sample starts on the initial scan | `.demo-banner .demo-snapshots button[aria-pressed="true"]` = `Initial scan` | 1079-1080 |
| 165 | Demo: Connect tile 1 is the sample tenant, not a Microsoft sign-in, and offers no Microsoft action | `/Sample tenant/`, `/IAMAI is not connected to Microsoft\./`; not `/Sign out\|Sign in with another account/`; header not `/Account/` | 1110-1117 |
| 166 | Demo: Connect offers Scan again | `.connect-step button` `Scan again` clicked | 1103-1107, 1118 |
| 167 | Demo: Scan again advances to the follow-up snapshot | pressed snapshot `Follow-up scan` | 1119 |
| 168 | Demo: the week-two plan differs in its rows from day one | plan body differs (polled up to 5 s) | 1124-1131 |
| 169 | Demo: week two raises the header in-place count | `/In place\s*(\d+)\s*Waiting/` week2 > day 1 | 1132-1136 |
| 170 | Demo: a held policy prepared in report-only offers JSON, and Copy copies the preview exactly and it parses | row `Require a Fresh Sign-in for Intune Enrollment`; `.implementation-section [role=tab]` `JSON`; `.impl-preview .preview-text` = `window.__copied` last (whitespace-normalised); `JSON.parse(...).displayName` is a string; no `/guid-\d{4}\|REDACTED/` | 1140-1160 |
| 171 | Demo: a second Scan again stays on the follow-up snapshot | pressed = `Follow-up scan` | 1164-1165 |
| 172 | Demo: the banner selector returns to the initial scan and the plan re-derives from it | click `.demo-banner` `/^Initial scan$/`; pressed `Initial scan`; `.plan-row` > 0 | 1167-1172 |
| 173 | Demo: the initial scan comes back as it was left, with none of the follow-up scan's inputs | rows (`.plan-row` textContent joined ` ~ `) and plan record equal the day-1 values (polled 5 s) | 1181-1197 |
| 174 | Demo: Leave returns to Connect with the banner gone | click `/Leave the demo/`; hash `#/connect`; no `/Sample data/` | 1200-1201 |
| 175 | Demo: no real tenant storage was touched by the demo | IndexedDB rows whose `tenantId` does not start `demo-sample-tenant`: identical before and after | 872-873, 1203-1208 |
| 176 | Demo: no console errors during the demo walk | errors since entering, minus `/authmethods\|favicon\|microsoftonline\|net::\|ERR_/` | 1209-1213 |
| 177 | Session: both tenants have records on this device before either action | seed 7 rows for `smoke-second-tenant` (`signin-rows, evidence-meta, group-members, mapping, plan, snapshot, baseline`); mock tenant rows > 0 and other = 7 | 1219-1259 |
| 178 | Sign out: the app is signed out and Connect asks for a sign-in again | `header.app .menu button.text-control` → `.menu-list button` `Sign out`; hash `#/connect`, `/Sign in with Microsoft/` | 1236-1246, 1264-1267 |
| 179 | Sign out: the header no longer offers the Account menu | no `.menu button.text-control` | 1268 |
| 180 | Sign out: nothing this device stored was deleted, so a full local store is not a sign-in | all `store:tenantId` rows identical | 1269-1273 |
| 181 | Sign out: the tenant is gone from the header | header not `/Contoso Pty Ltd/` | 1274 |
| 182 | Sign in again: the tenant that was signed out of comes back with its own plan | `#/plan` rows > 0 and signed in | 1277-1279 |
| 183 | Forget this tenant: the page returns to Connect | menu `Forget this tenant`; hash `#/connect` | 1283-1288 |
| 184 | Forget this tenant: every record this device held for it is gone | mock tenant rows = 0 | 1289 |
| 185 | Forget this tenant: the other tenant's records are untouched | other tenant rows identical | 1290-1294 |
| 186 | Forget this tenant: the operator is still signed in, which is what holds it apart from Sign out | Account menu present | 1295 |
| 187 | Forget this tenant: Connect shows the tenant not scanned, and no plan is drawn from the forgotten scan | `.connect-step` > 0; no `/Open the plan/` | 1296-1300 |
| 188 | Error page: a surface that throws while drawing shows it | `&crash=1#/plan`; `section.error-page` | 1305-1306 |
| 189 | Error page: the title, the lead with its full stop, no Setup, no Start step | `h2` = `This page hit an error`; first `p` = `Nothing in the tenant changed.`; no `/\bSetup\b\|Start step/` | 1307-1308 |
| 190 | Error page: Reload (primary), Download diagnostics (redacted) (secondary), Start over (tertiary), and where to send them | `button` weights = `Reload:primary \| Download diagnostics (redacted):secondary \| Start over:tertiary`; `p` `Send the diagnostics to feedback@getiamai.com` | 1309 |
| 191 | Error page: Reload reloads the page | click `Reload`; navigation type `reload` | 1310-1311 |
| — | walk completed | only on an uncaught exception (always FAIL) | 1312-1313 |

The smoke does not read `page-contracts.json` allow lists or budgets. It hardcodes its own strings, apart from the three forbid-derived lists above.

---

## 4. How CI runs them

### 4.1 Workflows, jobs, order

| Workflow | Trigger | Job (name) | Steps in order | What fails it | Gates |
|---|---|---|---|---|---|
| `ci` (`.github/workflows/ci.yml`) | `push` to any branch (`'**'`), `pull_request` | `ci` (the required status check, ci.yml:28-30), ubuntu-latest, Node 24, 15 min | Commit under test → Install (`npm ci`) → Typecheck (`npx tsc --noEmit`) → Unit tests (`npm test`) → Build (`npm run build:site`) → **Smoke** (`npm run smoke`, `CHROME=/usr/bin/google-chrome`, `EXTERNAL_HEALTH` unset) → on failure: "What failed" summary, then upload logs `ci-failure-<run>-<attempt>` (7 days) | Any step non-zero; each teed step uses `set -o pipefail`. Smoke exit 1 (a FAIL) or 2 (harness) both fail the step; the summary tells them apart by `^smoke: harness` (ci.yml:114-126) | Required check on `main` (comment ci.yml:28). **Does not run the walk.** Not a dependency of deploy-pages |
| `deploy-pages` (`.github/workflows/deploy-pages.yml`) | `push` to `main`; `workflow_dispatch` | `walk`, ubuntu-latest, 30 min, checks out `${{ github.sha }}`, no concurrency group | Commit under test → `npm ci` → **`npm run walk`** (`CHROME=/usr/bin/google-chrome`) → on failure "What failed" (reads `walk/<sha7>/findings.json`, prints `WALK_RESULT:` and each `P0: …`) → always copy `docs/reports/walk-<sha7>.md` into `walk/` → always upload artifact `walk-<sha>` (`walk/`) | `npm run walk` non-zero: exit 1 = at least one P0; exit 2 = no Chrome, dev server, or page target; or any uncaught error. P1/P2 never fail it | — |
| | | `build` (`needs: walk`, `if: github.ref == 'refs/heads/main'`) | checkout `${{ github.sha }}` → guard HEAD equals `github.sha` (`BUILD_RESULT` exit 1) → `npm ci` → `npm test` → `npm run build:site` → on failure "What failed" → `upload-pages-artifact` (`dist`) | walk failed or skipped; SHA guard; `npm test`; build | — |
| | | `deploy` (`needs: build`, same `if`, `concurrency: pages`, cancel-in-progress) | `actions/deploy-pages@v4` | build failed or skipped | Publishes getiamai.com |
| `external-health` (`.github/workflows/external-health.yml`) | `push` to `main`, daily `cron 20 7 * * *`, `workflow_dispatch` (not PRs) | `external-health`, 20 min, concurrency `external-health-<ref>` cancel-in-progress | `npm ci` → `npm run test:external` (`EXTERNAL_HEALTH=1`; `src/content/learnLinks.test.ts`) → `if: always()` `npm run smoke` (`EXTERNAL_HEALTH=1`, so smoke check #145 is asserted, not skipped) → Summary → upload `external-health-<sha>` (30 days) | Either step failing | Not required, gates nothing (comment external-health.yml:3-5) |

Order on a push to `main`: `ci`, `deploy-pages` and `external-health` start independently. Inside `deploy-pages` the order is `walk` → `build` → `deploy`. The walk and the smoke never run in the same job. The smoke is in `ci` (and external-health); the walk only in `deploy-pages`.

### 4.2 Contract entries no script reads

No script and no unit test reads these (grep of `scripts/**` and `src/**`):

- `rules.tipMaxSentences`, `rules.tipMaxWords`
- `mockStates`
- every surface's `status`, `name`, and `reach.route`, `reach.state`, `reach.actions`, `reach.root`, `reach.mock`, `reach.eachTab` (only `reach.exclude` is read)
- `allow.tiles` and `allow.columns` on every surface (the walk's diff kinds omit them, walk.mjs:370)
- `forbid` of `shell`, `connect.signedOut.permissions`, `inventory.tab`, `plan.settings`
- `budget` / `rowBudget` of `connect.signedOut.permissions`, `inventory.tab`, `plan.settings`, `plan.step.more`
- `allow.*` of `connect.signedOut.permissions`, `inventory.tab`, `plan.settings`, and `plan.step.more` apart from its headings (smoke) — no DOM diff
- `shell` allow lists other than `tabs` (tests only scan them for "Today")
- `enforceAll`'s stated meaning ("any inventory surface without a contract fails"): no script builds an inventory of surfaces. `design-lint.test.ts` reads the flag only to gate a legacy allow-list assertion. The inventory script the `$comment` implies is not in `scripts/`

### 4.3 Discrepancies visible in the source

- The contract's `plan.step` root is `.step`. The walk diffs `.step-body`, so the step head and footer are never contract-diffed (walk.mjs:1538).
- `plan.step` allows `re:^CIS \d+(\.\d+)?$` chips, while the walk raises a P0 on any `CIS` chip (walk.mjs:1542).
- The walk's header comment says "desktop width (1280)". The home page is also walked at 768 and 390 (walk.mjs:2034).
- The overflow check is P1 on both branches (`width < 600 ? 'P1' : 'P1'`, walk.mjs:613).
- The console-error finding is labelled `demo:` for every fixture (walk.mjs:2186).
- The walk builds the site itself (`npx vite build`, `node scripts/assemble-site.mjs`) when `dist/` is absent, which it always is in the `walk` job (walk.mjs:2065-2119).
- The walk probes every Learn link over the network in the deploy gate, and a 404 is a P0 that blocks the deploy (walk.mjs:2190-2196). The workflow comments say third-party checks do not gate the deploy (external-health.yml:3-5, deploy-pages.yml:156-158); only outages (P2) and non-404 errors (P1) are non-blocking.
- The smoke asserts `Zero policies: the plan renders` twice in a row (smoke.mjs:742-747).
- The smoke's header comment lists "Recovery", which it no longer walks (smoke.mjs:3).
- `docs/qa/page-contracts.json` `$comment` says a surface's `status` other than `built` is not measured. Nothing reads `status`, and all 15 surfaces are `built`.


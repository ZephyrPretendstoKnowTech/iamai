# QA audit 01 (prompt 19)

Date: 2026-08-28. Branch `night-run-1`. Method: every route walked in headless
Chrome (CLI, DevTools protocol) at 360, 768, 1024 and 1440 px in both themes,
plus the dev gallery with the synthetic tenant (Scan, Setup, Findings, Roadmap,
Inventory and every tab of each). Each page ran an in-page check for horizontal
overflow, clipped text, dead or unknown links, unnamed controls, raw ISO dates,
GUIDs, developer vocabulary, focus rings, heading order and console output.
Keyboard behaviour was driven with real key events. A live tenant was not
connected for this audit; states that need one (scan running, scan failed,
section disabled by licence or permission) were reviewed in code.

Status key: **fixed** in this prompt; **deferred** with a reason in
`deferred.md`; **as designed** with the reason here.

## Part A, known defects

| # | Page | What happened | What should happen | Status |
|---|---|---|---|---|
| A1 | Every page with a button | On hover a `LinkButton` ("Next: Baseline") lost its label: the global `a:hover` colour outranked `.btn-primary`, so text and background were both `--accent-hover`. | Every variant keeps AA contrast in default, hover, active, focus and disabled, both themes. | fixed: `buttonColours()` in `tokens.ts` is the state table, `styles.css` restates ink on every state, `tokens.test.ts` asserts text ≠ background and ≥ 4.5:1 for every variant × state × theme. Quiet hover ink darkens to `--accent-hover` (plain accent on the soft background was 4.18:1 in light). |
| A2 | Baseline, Setup | Baseline said "Setup will ask 9 questions"; Setup rendered 8 (service accounts is hidden without candidates). | One function decides both. | fixed: `wizardQuestionCounts()` in `wizard.ts`; Baseline now reads the scan and confirmed answers and says "Setup will ask N questions (M required)" with branches for none, all, some. |
| A3 | Scan | Legend was one run of terms with no dividers. | Three labelled cards with a heading rule, one term per row, the table's chips. | fixed. |
| A4 | Findings | Group by defaulted to None; sort and group state were entangled. | Default Domain; sort applies within groups; controls independent; choice persists for the session. | fixed: `arrangeGoals()` in `scoring/arrange.ts` (tests for group-on/sort-changed), session storage for the two controls. |

## Part B, audit findings

### Links and buttons

| # | Page | What happened | What should happen | Status |
|---|---|---|---|---|
| B1 | Every page | The tab had no icon; the browser requested `/favicon.ico` and logged a 404 on every load. | An icon, no 404. | fixed: inline SVG favicon in `index.html`. |
| B2 | Inventory (no tenant connected) | The route rendered the Scan page's empty state under the heading "Scan". | Its own heading and reason. | fixed. |
| B3 | Roadmap step | The Microsoft Learn line repeated the step's "Why" sentence after the link, and CIS chips ran straight on from it. | Link, then the chips. | fixed. |
| B4 | Findings, Roadmap | Every hash link on every route resolved to a rendered route (Findings → Roadmap step, Setup validation links, "Next:" buttons, inventory rows, What IAMAI reads). External links open in a new tab with `rel="noreferrer"`. | | as designed |

### Empty and error states

| # | State | What happened | Status |
|---|---|---|---|
| B5 | Scan, Setup, Findings, Roadmap, Licensing without a tenant | Each says what it needs and links to the step that provides it ("Needs: Run a scan in the Scan step · Load a baseline in the Baseline step"). | as designed |
| B6 | Zero users in a table | "No users match these filters." with a Clear filters button; empty inventory tables say "No entries". | as designed |
| B7 | Zero findings in a group | Empty domains are omitted rather than shown as empty headings (`arrangeGoals` test). "Here's what's working" with nothing in place says so in the product voice. | as designed |
| B8 | Insufficient sign-in evidence, section disabled by licence or permission | Readiness callout carries the reason and the licence; the roadmap evidence line says "no sign-in evidence collected". Reviewed in code; not exercised live. | as designed |
| B9 | Roadmap step already enforced by an existing policy | "What the last 30 days say" read "Sign-in records measure this once the policy exists in report-only", and the operator line said no records were available, on a step marked Done. | fixed: an already-enforced goal says so and drops the operator note. |
| B10 | Plan with no steps | Not reachable with a loaded baseline (every scored goal produces a step, asserted by the consistency test). | as designed |

### Numbers

| # | Where | Finding | Status |
|---|---|---|---|
| B11 | Scan, Findings, Roadmap, Inventory, Baseline, Setup | `src/ui/consistency.test.ts` runs the pages' own functions over the synthetic tenant and asserts: readiness rows = MFA tiles = activity tiles = users; in place + partly + missing + could not tell = scored goals; Roadmap steps already in place = Findings goals in place; the MFA-ready percentage on Findings equals the all-users step's readiness; the Baseline question promise equals the Setup list. | fixed (test added) |
| B12 | Roadmap overview | "the plan finishes in … (5 weeks)" sat next to "Small band, detected · expected 4 weeks". Two different numbers both read as the plan length. | fixed: the preset now reads "this pace usually takes 4 weeks". |
| B13 | Findings summary | "every user satisfies mfa on every app": goal names were lower-cased whole, so acronyms lost their case. | fixed: `lowerFirst()` keeps acronyms. |
| B14 | Findings, Policies involved | "CA002: Report-only; report-only" and "CA003: Off; switched off": the contribution restated the state. | fixed: only "delivers" or "applies but too weak" is added to the state. |

### Text, wrapping, widths

| # | Finding | Status |
|---|---|---|
| B15 | No page scrolled horizontally at 360, 768, 1024 or 1440; no element extended past the viewport outside a scrolling table; no clipped text. Long tenant names, policy names and UPNs wrap (the guest UPN `…#EXT#@…` breaks inside the cell). | as designed |
| B16 | Start page section headings were `h3` under the `h1`, skipping a level. | fixed: `h2`/`h3`, sized as before. |
| B17 | Gallery only: `h2` → `h4` inside the Section wrapper. Dev build only. | as designed |

### Keyboard

| # | Finding | Status |
|---|---|---|
| B18 | Picker: Escape did not close the list. A `type="search"` input clears itself on Escape and fires `onChange`, which reopened the list. | fixed: Escape keeps the text and closes the list (verified with real key events). |
| B19 | InfoTip: Enter opens, Escape closes; focus ring visible on every focusable element sampled; Tab order follows the DOM (header, stepper, page). ArrowDown + Enter picks in the Picker. | as designed |

### Copy

| # | Where | Finding | Status |
|---|---|---|---|
| B20 | Start headline | "…a rollout plan that won't lock anyone out." promises no lockouts, which CLAUDE.md forbids. | fixed, and a `lockout-promise` lint rule stops it returning. Setup Q1 "can never lock the whole tenant out" reworded too. |
| B21 | Roadmap overview, step impact | "free security, zero interruption" / "Zero sign-ins … free security": reassurance. | fixed: "predicted to interrupt no one" / "No sign-in in the last 30 days would have been affected." |
| B22 | Scan reasons column, Legend | "no usage signal", "evidence window", "not observable", "TAP issued", em dashes. | fixed: plain phrases ("passkey registered but never seen in a sign-in", "last sign-in is older than the collected sign-in records", "Temporary Access Pass issued"). |
| B23 | What IAMAI reads | Registry text shown to reviewers said "beta-only in practice (spike 1)" and "instead of GUIDs". | fixed. The API column still shows `v1.0` / `beta` because that is the literal Graph version a reviewer verifies against. |
| B24 | Inventory | Raw Graph enumerations: method ids (`MicrosoftAuthenticator`, `Fido2`, `Sms`), strength combinations (`x509CertificateMultiFactor`), migration state (`migrationComplete`), device trust type (`AzureAd`, `Workplace`), protocols (`ropc`, `deviceCode`, `none`). | fixed: friendly-name maps in `copy/inventory.ts`; unknown values fall back to the id. |
| B25 | Goal catalogue | Three tldr strings used " - " as a dash. | fixed in `data/goals.json`. |
| B26 | Announcement drafts | "We will follow up personally…" is first person. | as designed: the text is the operator's own email to staff, signed "IT". |
| B27 | Findings, Why not fully | "never included by any candidate policy", "matching but disabled:" | deferred (D2) |

### Console and themes

| # | Finding | Status |
|---|---|---|
| B28 | No React warnings or exceptions on any route, width or theme, including every gallery tab. The only console error was the favicon 404 (B1). | fixed |
| B29 | Light and dark rendered every page with the same layout; the theme toggle persists. | as designed |

## Not exercised

A live tenant was not connected during this audit, so scan-in-progress,
scan-failed and licence-/permission-disabled sections were reviewed in code
only. Screenshots for the walk are not committed (they include the synthetic
tenant only, but the audit is the record).

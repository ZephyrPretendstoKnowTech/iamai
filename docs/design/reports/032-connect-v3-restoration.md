# Task 032 — Connect v3 restoration

Production **Connect** rebuilt to the approved Connect anatomy, on real product state.

Every label below is one of `CANONICAL REQUIREMENT`, `PRODUCTION SEMANTIC REQUIREMENT`,
`LANDED REPO FACT`, `ENGINEERING IMPLEMENTATION`, `OWNER DECISION` or `UNRESOLVED`. An
implementation choice is not an owner decision because it landed, and nothing here claims
approval — approval is the independent reviewer's.

**The governing rule, unchanged:** production technical code owns semantic truth; the approved
HTML owns application anatomy and interaction structure; the brand authority owns the skin;
task 031's primitives are a mechanism. Where this document and the canonical file disagree,
the file wins.

---

## 1 — source and environment

| | |
|---|---|
| Task start HEAD | `962d40e55ee26f1a2d623e462d98d65f47f03d8c` |
| Branch | `main` (worked directly on `main`, no branch, no PR, no worktree) |
| Working tree at start | clean |
| Upstream authority | `docs/design/reports/030-theme-typography-shell-foundation.md` §C3, `docs/design/reports/031-shared-approved-design-primitives.md` |
| Design-authority manifest | `docs/design/approved/manifest.json` (version 2, **unchanged**) |
| New guard | `src/ui/surfaces/connectAnatomy.test.ts` |

---

## 2 — canonical hash verification

`LANDED REPO FACT`. Verified before editing and again after.

| Surface | Path | SHA-256 | Verdict |
|---|---|---|---|
| Connect | `docs/design/approved/connect-v3.html` | `903808b07210209a22d1a4f380b9e79dad95bd0e740a0fce0bb3745d265ee48b` | match, bytes unchanged |

The file's `<title>` still reads *IAMAI Connect Design Pack v1* while the manifest and the
owner's file name say v3. That is recorded in the manifest as `declaredTitleNote` and was **not**
edited: the bytes and the hash are the identity.

`src/ui/design-authority.test.ts` owns the hash contract for all four packs and against the
committed git blob. The new task-032 guard re-verifies the Connect hash for one reason only:
every assertion in that file is derived from the pack's bytes at test time, so it first proves
the bytes it read are the approved ones.

---

## 3 — the Connect implementation and state authorities inspected

`LANDED REPO FACT`. The real current paths, found before editing rather than assumed.

| What | Path |
|---|---|
| The surface | `src/ui/surfaces/Connect.tsx` |
| Its view model (all four stages, both states) | `src/ui/scan/connectView.ts` |
| Its CSS | `src/ui/app.css` (the Connect section) |
| Sign-in / token / roles | `src/graph/auth.ts`, `src/graph/authError.ts`, `src/graph/collect/tokenRoles.ts` |
| The one place an action is defined | `src/ui/actions.ts` (`signIn`, `signInAnother`, `signOut`, `chooseBaseline`, `scan`, `stopScan`) |
| The scan in flight | `src/ui/session.ts`, `src/ui/scan/ScanProgress.tsx` |
| Baseline load / pin / restore | `src/ui/baseline.ts`, `src/baseline/pinned.ts`, `baselines/*.index.json` |
| The plan and its mapping | `src/ui/surfaces/planData.ts` |
| The counts | `src/derive/facts.ts` (`facts` for the active people, `stepFacts` for the steps) |
| Demo mode | `src/ui/demoMode.ts`, `virtual:demo-facts` |
| Tests protecting the above | `connectView.test.ts`, `connectSignedOut.test.ts`, `publicTrust.test.ts`, `demo.test.ts`, `design-lint.test.ts`, `primitives.test.ts`, `accessibility.test.ts`, `scripts/walk.mjs`, `scripts/smoke.mjs`, `docs/qa/page-contracts.json` |

---

## 4 — before-edit rendered evidence and the structural differences it showed

`LANDED REPO FACT`. Rendered with `scripts/render-design.mjs` at 1280 / 768 / 390, both themes,
before any production edit:

```text
docs/design/approved/rendered/connect/{1280,768,390}.png   canonical
docs/screens/032/before/connect-{light,dark}-{1280,768,390}.png   production (Demo)
```

| | canonical | production, before |
|---|---|---|
| Page heading | eyebrow → serif h1 40px, lead capped | no eyebrow; h1 at the shared 26px ramp default |
| Status strip | one bordered strip above the flow | **absent** |
| Flow containers | **one** 14px-radius panel with a shadow | **four** independently bordered cards stacked with 10px gaps |
| Step row | `46px minmax(0,1fr) auto` — number, content, action | number absolutely positioned in a 56px left pad; one column |
| Action placement | the row's third track, right-aligned | a `div.actions` stacked under the copy |
| Baseline presentation | nested `.baseline-card` (name, source line, credential pill, explaining copy) + a source/version `<details>` | three loose paragraphs; the name and count were the step's heading state |
| Scan metadata | a three-count `.meta` row + a limitations `<details>` | the limitations `<details>` only; no counts at all |
| Plan-ready destination | a **separate** tinted `.ready` panel below the flow, copy left, `Open Plan →` right | a fourth card inside the same stack |
| Density | 18/20px step padding on one panel | 16/20/16/56 padding per card, plus inter-card margins |
| Responsive | one 760 breakpoint: h1 33, strip stacks, step → `36px 1fr`, actions to column 2, `.ready` one column | no Connect breakpoint; the shell's 700 header wrap only |

---

## 5 — what was restored

### 5.1 The page frame — `CANONICAL REQUIREMENT`

`.eyebrow` (the shared task-031 role) → `h1.display` at `--d-3` (the pack's 40px) → the lead at
`--measure-lead`. The 1040px route width was already correct from task 030 and was re-verified
in the pack (`min(1040px, calc(100% - 40px))`) rather than taken from prose. **No second app
shell**: the header, theme control, account controls and current-route semantics are untouched.

### 5.2 The status strip — `CANONICAL REQUIREMENT` + `PRODUCTION SEMANTIC REQUIREMENT`

One strip above the flow, in the pack's grammar: indicator, state title, quiet line.

`ENGINEERING IMPLEMENTATION` — it is a **projection**, not a calculation. `connectStatus()`
(`src/ui/scan/connectView.ts`) takes the same `done` array `stages()` already takes and the
stages' own title / state / tone, and returns one of two things:

- nothing left to do → *Ready to plan* / *Tenant, baseline and scan are ready.*
- otherwise → *Next: &lt;stage&gt;* over **that stage's own state line**, verbatim.

So the strip cannot disagree with the step it points at, and no readiness exists here that the
stages did not already compute. The dot is `aria-hidden`; the title carries the state in words.

`CANONICAL REQUIREMENT (declined)` — the pack's two-button state switch is mockup scaffolding.
It did **not** ship, and `connectAnatomy.test.ts` fails two ways on it: if production grows one,
and if the pack stops having one for the guard to guard against.

### 5.3 One contiguous staged flow — `CANONICAL REQUIREMENT`

`.connect-flow` is one panel; `.connect-step` are its rows, separated by the shared
`.row-group` hairline (task 031's D8a), with no background or border of their own. The real
sequence is unchanged and is production's: **Microsoft tenant → Baseline → Tenant scan**. No
stage was added and none was removed.

### 5.4 Step row anatomy — `CANONICAL REQUIREMENT`

`grid-template-columns: 46px minmax(0, 1fr) auto`. The step's buttons are the third track. A
message an action produced (a sign-in error, a scan failure) stays in the content column: it is
a sentence, and a sentence in an `auto` track is a column one word wide. An empty action zone
collapses (`:empty { display: none }`) rather than holding the row open.

`PRODUCTION SEMANTIC REQUIREMENT` — done / current / ahead come from `stages()`, which reads
whether each stage is finished. The current step keeps its task-016 **Next** word, so the
progression reads without the accent.

### 5.5 The baseline step — `CANONICAL REQUIREMENT` + `PRODUCTION SEMANTIC REQUIREMENT`

The pack's nested card, filled only from the loaded package:

- name → `BaselineResult.source`;
- source line → `{policyCount} policies · pinned version | uploaded package`, from the package
  and `origin.kind`;
- explaining copy → the existing approved `what` and `goal` sentences, unchanged;
- `Source and version` `<details>` → the existing `pinned` sentence, which used to be a loose
  third paragraph.

The step's heading state became the **step's** state word (`selected` / `loading …` /
`none loaded`) because the pack moves the name and the size into the card.
`pages.connect.baseline.state` was deleted rather than left dead.

Baseline selection, loading, pinning, interpretation and the author-update review are
**unchanged**; `chooseBaseline()` is still the only thing that makes a package the tenant's.

### 5.6 The scan step — `CANONICAL REQUIREMENT` + `PRODUCTION SEMANTIC REQUIREMENT`

The pack's compact count row, and only when a complete scan has produced a computed plan:

| slot | authority |
|---|---|
| active people | `facts(snapshot, mapping).active` — `derive/facts.ts`, the one denominator Today, the Plan and Connect already share |
| baseline policies | the loaded package's `policies.length` |
| plan steps | `stepFacts(...)` — the same count the Plan header and the destination show |

Each is a **second rendering** of a count, never a second count. Absent in every other scan
state, and absent while the plan is still computing: a partial or unfinished scan can never
render as a complete one. No Graph endpoint, permission, collection order, validation, evidence
classification, retry or partial/failure semantic was touched.

### 5.7 The Plan-ready destination — `CANONICAL REQUIREMENT` + `PRODUCTION SEMANTIC REQUIREMENT`

`.connect-destination` is the pack's separate panel below the flow: copy left, the one way on
in the right track, the sample tenant's fact row where production has one.

`ENGINEERING IMPLEMENTATION` — the pack draws only the ready state. Production has three more
that are real (the last full plan after a scan with gaps, waiting for the scan, and the sample
before sign-in), so the brand-tinted treatment is a **modifier** gated on `tile.kind === 'ready'`
and every other state keeps the plain panel. A destination that always looked ready would be a
readiness claim made in CSS.

The gate itself is unchanged: `Open the plan →` still comes only from `planTile({kind:'ready'})`,
which still requires `scanInput.kind === 'complete'` and a stored scan.

---

## 6 — task-031 primitives consumed, and the one boundary moved

`LANDED REPO FACT`.

| Primitive | Used how |
|---|---|
| `.eyebrow` | the pack's `Setup` label above the h1, and nothing else |
| `.row-group > * + *` | the hairline between flow steps — the separator is shared, the grid is not |
| `.display` + `--display-size` | Connect takes `--d-3` (h1 40), `--d-7` (h1 33 at ≤760), `--d-13` (destination h2 25). This is exactly the move task 031 designed the knob for; no new size was invented |
| `--shadow-panel` | the flow panel, which the pack lifts the same way the Plan lifts an opened step |

**Extended: none as a shared role.** Connect's `46px minmax(0,1fr) auto` step grid is the
surface's own, which is what task 031's §7 deferred to packs 032–038.

`ENGINEERING IMPLEMENTATION` — one task-031 *test* moved, and its meaning got stricter, not
looser. `primitives.test.ts` asserted the four packs' row grids appear **nowhere** in
`app.css`. That was written before any restoration pack landed and app.css is where a surface's
CSS lives in this product, so as written it would have failed pack 032 through 038 by
construction. It now asserts the thing it always meant: not in the shared-roles block, and only
ever on the selector of the surface that owns it (`46px minmax` must be on a `.connect-*` rule).

`ENGINEERING IMPLEMENTATION` — four `design-lint` allowances were renamed with the class
(`.step-tile` → `.connect-step` / `.connect-flow` / `.connect-destination` / `.connect-status`),
and two gained a second canonical citation: the panel shadow (the pack sets
`box-shadow` on `.flow`) and the full-round badge (the pack sets `border-radius:999px` on
`.num`). No lint rule was weakened; `.pill` still carries no colour and `.status` is still the
one place a state colour is chosen.

---

## 7 — what was explicitly NOT changed

`PRODUCTION SEMANTIC REQUIREMENT`. Proven by the diff and by the suites re-running green.

- **Authentication / session.** `src/graph/auth.ts`, `authError.ts`, `msal.ts`, `ui/actions.ts`
  and `ui/session.ts` are **not in the diff**. Sign-in initiation, the warming-button queue,
  the redirect handling, token acquisition, the three MSAL error states, sign-out, forget, the
  tenant turn and tenant isolation are byte-identical. Every Connect control still calls the one
  canonical action (`publicTrust.test.ts` re-runs green).
- **Delegated permissions and consent.** `src/copy/permissions.ts` and `GRAPH_SCOPES` untouched;
  the consent disclosure is still generated from the scopes, and smoke re-verified six rows in
  Microsoft's wording with the removal line.
- **Baseline.** `src/ui/baseline.ts`, `src/baseline/`, `baselines/*` untouched. The pin, its
  commit, the interpretation records and the author-update review are unchanged.
- **Scan.** `src/graph/collect/*` untouched. Endpoints, permissions, collection order,
  validation, evidence classification, retry and partial/failed meaning are unchanged.
- **Plan / Foundations.** `src/roadmap/`, `src/coverage/`, `src/mapping/`, `src/derive/` are not
  in the diff. Connect *reads* `derive/facts.ts`; it computes nothing.
- **Demo.** `src/ui/demoMode.ts`, `src/ui/demo.ts` and the fixtures are untouched. Demo renders
  the production Connect components; its only differences remain its data and the two Microsoft
  actions the sample tenant has nothing to act on (task 026).

---

## 8 — copy

`PRODUCTION SEMANTIC REQUIREMENT`. Production wording was preferred everywhere it still fits.
Every sentence on the restored page is an existing approved sentence except the strings the new
regions could not exist without:

| New key | Value | Why |
|---|---|---|
| `pages.connect.eyebrow` | `Setup` | the pack's eyebrow above the h1 |
| `pages.connect.status.ready` / `.readyText` | `Ready to plan` / `Tenant, baseline and scan are ready.` | the strip's one terminal state |
| `pages.connect.status.next` | `Next: {stage}` | the strip's other state; the stage name and its quiet line are the stage's own |
| `pages.connect.baseline.selected` | `selected` | the step's state word, once the name moved into the card |
| `pages.connect.baseline.count` | `{policyCount} policies` | the card's size line (bends to the count via `pluralise`) |
| `pages.connect.baseline.versionPinned` / `.versionUploaded` | `pinned version` / `uploaded package` | which version this is, from `origin.kind` |
| `pages.connect.baseline.sourceSummary` | `Source and version` | the pack's disclosure label |
| `pages.connect.scan.meta.*` | `active people` / `baseline policies` / `plan steps` | the three count names |

Deleted: `pages.connect.baseline.state` — dead once the name and count moved into the card.

The pack's own copy was **not** taken where production disagrees. Notably the pack's signed-out
strip says *Connect a tenant*, which task 016 removed and `page-contracts.json` forbids; the
strip says *Next: Sign in* over the sign-in step's real state line instead.

**Nothing was invented to fill a region.** No `Built by Jon Hope`, no tagline, no verification
badge, no MVP credential pill, no release state, no fake counts. `connectAnatomy.test.ts`
asserts each of those by name.

---

## 9 — the one canonical element deliberately left unfilled

`ENGINEERING IMPLEMENTATION`, recorded here rather than left implicit.

The pack draws a `.cred` pill reading **Microsoft MVP** beside the baseline's name. Production
does not render it. The reasoning:

1. It is a claim about **one** package's author, not a property of the region. An uploaded
   package has no such author, so a pill in that slot would be false for every baseline but one.
2. Production has never rendered a credential badge, and a badge reads as a verification IAMAI
   is not in a position to make.
3. The fact itself is not suppressed: *"built and maintained by Jon Hope, a Microsoft MVP, at
   ConditionalAccess.Tech"* is existing approved copy and still renders, inside the card, where
   production already said it.

The pack's own source line content (*Jon Hope · 38 policies · reviewed version*) **is** restored
— as `38 policies · pinned version`, with the author already in the package's name. Part G of
the task contract authorises exactly this: *"If it does not [have a truthful compact label],
preserve the structure without inventing content."*

---

## 10 — responsive

`CANONICAL REQUIREMENT`, re-read from the pack's CSS rather than from task 030's prose. One
breakpoint, 760:

| | pack | production |
|---|---|---|
| h1 | 40 → 33 | `--d-3` → `--d-7` (the same two values, on the ramp) |
| status strip | stacks | stacks |
| step | `46px 1fr auto` → `36px 1fr` | same, with `minmax(0, 1fr)` so a long tenant object wraps |
| actions | `grid-column: 2`, left-aligned | same — the action moves **under its own step's copy**, never detaching |
| destination | one column | one column |
| nav / account | hidden | **not** hidden here |

`ENGINEERING IMPLEMENTATION` — the header is the shared shell's and collapses at the shell's own
700 (task 030). The pack's `.nav{display:none}` is the mockup's header, not IAMAI's, and the
task contract forbids a Connect-only mobile navigation. Connect adds no header rule of its own;
`connectAnatomy.test.ts` asserts it does not.

At 390 the result is composed rather than squeezed: one column, the action under its step, the
destination stacked, and no horizontal overflow at any of the three widths in either theme.

---

## 11 — accessibility

`src/ui/accessibility.test.ts` and `src/ui/tokens.test.ts` re-run green.

- **Headings stay logical.** `h1` (page) → `h2` (each step, and the destination). No level skipped.
- **State is never colour alone.** Every tone class sits beside a word: the step's `.state` line,
  the current step's **Next** marker, and the strip's state title. The strip's dot is
  `aria-hidden` decoration.
- **Locked means disabled.** The baseline control held during a scan is still
  `disabled={locked}`. The pack's `.locked{opacity:.55}` was **not** taken: production's steps
  ahead of the current one stay usable (the baseline can be changed before a tenant is
  connected), and fading a live control is a contrast regression, not a lock.
- **Native disclosures.** Permissions, limitations, source-and-version and the author review are
  all `<details>`/`<summary>`. No pseudo-content is the only label for anything.
- **Keyboard order follows the visual order.** Within a step the source order is number → copy →
  action, which is the reading order at 1280 and the stacking order at 390.
- **Long tenant objects.** The content track is `minmax(0, 1fr)` and `.connect-step-body` takes
  `min-width: 0`, so a UPN wraps inside its column instead of widening the row. Verified at 390.
- **Focus is not lost.** No action's DOM identity changed; a step's button moved container but
  is still the same control rendered by the same branch.
- **Reduced motion / forced colours.** No motion was added; no focus or forced-colours rule was
  touched.

---

## 12 — visual evidence

```text
docs/design/approved/rendered/connect/{1280,768,390}.png          canonical (unchanged)
docs/screens/032/before/connect-{light,dark}-{1280,768,390}.png   production, before (Demo)
docs/screens/032/after/connect-{light,dark}-{1280,768,390}.png    production, after (Demo)
docs/screens/032/after/connect-signedout-{light,dark}-{1280,768,390}.png   production, after (signed out)
docs/screens/032/after/{plan,readiness,export,home}-*.png         the other surfaces, after
```

`ENGINEERING IMPLEMENTATION` — `scripts/render-design.mjs` gained one shot,
`connect-signedout`, which loads the planner **without** `?demo=1`. Every other production shot
runs the demo, so before this a restoration pack could only compare its Demo rendering with the
canonical; the pack's second flow is the signed-out one. No tenant is read — the app is simply
not signed in.

---

## 13 — remaining differences from the canonical, and their authority

| Difference | Authority |
|---|---|
| Dark canvas, Inter and Georgia in the pack; Mineral Teal / Deep Mineral and IBM Plex in production | brand skin (task 029/030). The packs own anatomy, not typeface or colour |
| No `Microsoft MVP` credential pill | §9 above; task contract Part G |
| Nav and account not hidden at ≤760 | shared shell authority; no Connect-only navigation (Part J) |
| A step ahead of the current one is not dimmed to 55% | production's ahead steps are interactive; fading a live control is an accessibility regression (Part F, Part M) |
| The destination panel has no eyebrow | its `h2` already carries *Plan* plus the real state; an eyebrow would repeat the heading |
| The destination renders in four states, tinted in one | production has three real states the pack does not draw (Part I) |
| The pack's sample values (`GetIAMAI`, `18 / 38 / 27`, `8 minutes ago`) | the pack is not a data authority; every value on screen is the tenant's or the sample's |
| Step title 16px where the pack sets 15 | production's interface scale has no 15; `--t-4` is the nearest role and the hierarchy is identical |

`ENGINEERING IMPLEMENTATION`, one bounded note. The strip reads the baseline stage through
`baselineStrings()`, which asks the same `baselineTile()` the step asks but knows only what the
parent knows — so during the single frame in which the pinned package is auto-loading, the strip
says *none loaded* while the step says *loading …*. The package is bundled (no network), the
window is one render, and every later change keeps the previous baseline while the new one loads,
so the stage is never the current one during a swap. Lifting `busy` out of `BaselineTile` to close
a one-frame gap was judged worse than the gap; if a future pack needs the strip to track a slow
load, that lift is the fix.

---

## 14 — validation

| Command | Result |
|---|---|
| `node --test src/ui/surfaces/connectAnatomy.test.ts` | 11/11 pass |
| `node --test src/ui/scan/connectView.test.ts src/ui/scan/connectSignedOut.test.ts` | 16/16 pass |
| `npx tsc --noEmit` | clean |
| `npm test` | 1887 tests, 0 fail |
| `npm run build:site` | clean |
| `npm run smoke` | every check passed |
| `git diff --check` | clean |

`npm run walk` was not run locally: the `deploy-pages` workflow owns the walk. Its Connect
checks were moved with the surface — same questions, new selectors, plus five new P0s (one flow
panel, three steps in it, the destination outside it, no action stacked under a step's copy, no
mockup state switch, one status strip with a state title). `docs/qa/page-contracts.json` gained
the `Source and version` summary and a raised prose budget for the strip, the eyebrow, the card's
source line and the scan counts.

---

## 15 — unresolved owner decisions

`UNRESOLVED` — **none.** Every choice above resolved against the canonical file, current
production semantics, task 030/031 landed evidence, or the approved brand authority. The one
genuinely subjective call — leaving the credential pill unfilled — is recorded in §9 with the
authority that permits it, and is reversible in one component if the owner decides a credential
badge is wanted.

# Task 033 — Plan collapsed roadmap

The Plan's roadmap rows, restored to the anatomy the owner approved in
`docs/design/approved/plan-step-v1.html`, on the facts production already
computes. This task owns the **row**. The expanded step under it — the attached
frame, the lifecycle track, the head layout, the main/right-rail grid, the
findings and actions — is packs 034 and 035, and §11 says exactly what was left
for them and why.

Every label below is one of `CANONICAL REQUIREMENT`, `PRODUCTION SEMANTIC
REQUIREMENT`, `LANDED REPO FACT`, `ENGINEERING IMPLEMENTATION`, `OWNER DECISION`
or `UNRESOLVED`. An implementation choice is not an owner decision merely
because it landed.

**The governing rule, unchanged:** production technical code owns semantic
truth; the canonical HTML owns application anatomy and interaction structure;
the brand authority owns the skin; tasks 030/031 supply landed capability where
it genuinely fits. Where this document and the canonical file disagree, the file
wins.

---

## 1 — source and environment

| | |
|---|---|
| Task start HEAD | `664fc3fb09bbd8baa5cabac1894ed889f1e1c9f6` |
| Branch | `main` (worked directly on `main`, no branch, no PR, no worktree) |
| Working tree at start | clean |
| Upstream authority | `docs/design/reports/030-…md`, `031-…md`, `032-…md` |
| Design-authority manifest | `docs/design/approved/manifest.json` (version 2, **unchanged**) |
| New guard | `src/ui/surfaces/planAnatomy.test.ts` |

---

## 2 — canonical hash verification

`LANDED REPO FACT`.

| | |
|---|---|
| Path | `docs/design/approved/plan-step-v1.html` |
| Expected SHA-256 | `1f1bda574fc76d0cc48c7d2e7a5d26abe34d8ee0aa5fab4888282cd9955ad4ec` |
| Measured SHA-256 | `1f1bda574fc76d0cc48c7d2e7a5d26abe34d8ee0aa5fab4888282cd9955ad4ec` |
| Verdict | match — **task 033 changed none of its bytes** |

The file was read in full and **rendered**, not paraphrased from task-030 prose.
`src/ui/design-authority.test.ts` owns the hash contract across all four packs
and against the committed git blob; `planAnatomy.test.ts` re-verifies only that
*its own* evidence came from the approved bytes.

---

## 3 — the implementation paths, as they actually are today

Identified before editing rather than assumed from history:

| Concern | Authority on `main` |
|---|---|
| The one row markup | `src/ui/surfaces/StepSections.tsx` → `PlanRow` |
| Row styling | `src/ui/app.css` (`.plan-row`, `.phase`, `.next-mark`) |
| The Plan surface | `src/ui/surfaces/Plan.tsx` (`Row`, `CleanupRow`) |
| Which rows each group draws | `src/ui/surfaces/planRows.ts` (`phaseRows`, `undatedRows`, `floorRows`) |
| The footer's rows | `src/ui/surfaces/PlanFooter.tsx` (renders the same `PlanRow`) |
| The printed plan | `src/ui/surfaces/PrintPlan.tsx` (reads the same row rules) |

`LANDED REPO FACT` — `src/ui/surfaces/stepContract.test.ts` contract 12 already
proves `PlanRow` is the **only** place `plan-row` markup exists, for a step, a
Cleanup item and a footer row alike. So restoring one component restored every
roadmap row on the surface, and no second row shape could drift from it.

### Semantic authorities inspected and left alone

`roadmap/types.ts` (`Step`, `Step.state`), `roadmap/lifecycle.ts`
(`projectStatus`, `heldForReview`), `roadmap/operations.ts` (`isPreserved`,
`unavailableReason`), `derive/phases.ts` (`inWave`), `derive/finish.ts`,
`derive/readyWhen.ts`, `derive/whoLine.ts`, `derive/population.ts`,
`surfaces/statusWord.ts`, `surfaces/rowWhen.ts`, `surfaces/rowWho.ts`,
`content/stepTitle.ts`. **None was modified.**

---

## 4 — before-edit rendered evidence, and what it showed

`scripts/render-design.mjs --production --out docs/screens/033/before`, at
1280 / 768 / 390 in both themes, over the demo fixture (which is what the
renderer's Plan shot loads, so the Plan and the Demo Plan are the same plate —
see §10). The canonical row was rendered separately at the same three widths by
extracting the pack's five `.roadmap-row` samples read-only into a scratch
harness under the pack's own stylesheet.

| Dimension | Canonical | Production before | Verdict |
|---|---|---|---|
| Row layout | four-track grid `126 / 1fr / 240 / 125`, gap 18 | one wrapping flex line, `gap: 4px 12px` | **different** |
| Density | `min-height: 64px`, inset `0 17px` | `padding: 10px 6px`, ~38px tall | **different** |
| State zone | dot + word, own track | dot + word, `flex: 0 0 7.5rem` | equivalent |
| Title | bold, quiet subtitle **under it** | bold, `flex: 1 1 8rem` | partly |
| Quiet reason | inside the title zone | **full-width line under the whole row**, starting at the row's left edge under the *state* column | **different** |
| Metadata | dedicated 240px right-aligned track | inline at the end of the flex line, no track | **different** |
| Timing | dedicated 125px right-aligned track | `margin-left: auto`, no track | **different** |
| Row-to-row rhythm | — | hairline separators inside a group panel | kept (§7) |
| Responsive | `≤940` → `110px 1fr`, metadata/timing move below and left-align | no row rule; a 640 tweak to the status track only | **different** |
| Long object text | — | `min-width: 0` on the title only | partly |

The load-bearing defect was the reason line. `rowReason` carries the one fact
that decides whether an operator opens a row now or later — *"after: Create or
Correct Emergency Access Accounts"*, *"the baseline defines this policy two
ways"* — and it rendered as a full-width line beneath the row, left-aligned
under the **state** column rather than under the title it explains. Fifteen
blocked rows in the demo plan each read as a state, a title, and then an
orphaned sentence beginning in the wrong column.

---

## 5 — row field → production authority

`PRODUCTION SEMANTIC REQUIREMENT`. Every zone is handed a fact by the module
that already owns it. **No zone computes anything**, and no zone was filled by
inventing a value for an empty canonical slot.

| Canonical zone | Production class | Value from | Owns |
|---|---|---|---|
| `.row-status` | `.plan-row-status` → `<Status>` | `statusOf(step)` | the one projection of `Step.state` |
| `.row-title strong` | `.step-title` | `contentTitle(step)` | the content entry's title |
| `.row-title span` | `.plan-row-reason` | `rowReason(step)` | the one binding reason |
| `.row-meta` | `.who` | `rowWho(step, nameOf)` | the population's who-line + the goal's gap clause |
| `.row-date` | `.when` | `rowWhen(step, waveStart)` | the next thing that happens to this step |
| (no canonical slot) | `.next-mark` | `isNext` on the Plan | the first step ready to be worked on |

`PRODUCTION SEMANTIC REQUIREMENT` — **truthful omission over a filled grid.**
Where a step has no reason (`rowReason` returns null) or no date (`rowWhen`
returns `''` on a done step, or on a policy the plan cannot write yet) the zone
renders empty. Nothing was substituted. The canonical sample's *"No blocking
issues"* and *"Start Sep 22"* are the mockup's content, not a schema production
must satisfy.

`PRODUCTION SEMANTIC REQUIREMENT` — **lifecycle and condition stay two facts.**
`statusOf` reads `step.status` (Foundation B's projected lifecycle) and, on a
blocked step, `step.state.condition` separately, and reads `state.inPlace`
alongside `state.lifecycle` for the Enforced-vs-In-place distinction. The row
was not simplified by merging them into one display enum; `planAnatomy.test.ts`
asserts all six of those outcomes directly, and asserts the row markup contains
no `step.`, `state.lifecycle`, `state.condition`, `blockers`, `Date.` or
`toLocale` at all.

---

## 6 — the restored row anatomy

`CANONICAL REQUIREMENT`, every number re-read out of the pack's own CSS and
confirmed against the rendered row before implementing:

```css
.roadmap-row{
  display:grid;grid-template-columns:126px 1fr 240px 125px;gap:18px;align-items:center;
  min-height:64px;padding:0 17px;border:1px solid var(--line);border-radius:10px 10px 0 0
}
.row-title strong{display:block;margin-bottom:2px}
.row-title span,.row-meta,.row-date{color:var(--muted);font-size:12px}
.row-meta,.row-date{text-align:right}
```

Production now declares the same four tracks at the same measurements, with the
quiet level on the same three zones (`--t-1` is 12px; `--ink-3` is the derived
quiet level task 030 correction 1 established and `tokens.test.ts` measures as
AA on every surface in both themes).

`ENGINEERING IMPLEMENTATION` — the `1fr` track is `minmax(0, 1fr)`. A bare `1fr`
has an `auto` minimum, so a long policy, group or app name would widen the grid
rather than wrap inside its column. This is the same targeted long-object
handling task 032 used for the Connect step, and it is a correctness difference,
not a style one.

`ENGINEERING IMPLEMENTATION` — the row's `padding: 0 17px` replaced the group
panel's horizontal padding rather than adding to it (`.phase` is now
`padding: 4px 0 8px`, and its `h2` carries the 17px so the heading and the
titles under it start on one line). Otherwise the row would sit 33px inside the
panel border and its hover surface would leave a gutter. The pack's 17px is the
inset from the border a reader actually sees, and in production that border is
the panel's.

### The row is not a card

`CANONICAL REQUIREMENT`, read carefully. The pack draws `.roadmap-row` **five
times and never as a list** — every instance is a single open row immediately
followed by `<article class="step">`, which is why the row carries a border and
a `10px 10px 0 0` radius: it is the head of the step attached beneath it, and
`.step` is `border-top:0`.

`ENGINEERING IMPLEMENTATION` — so the pack's border and radius are applied as
the **open** row's rule (`.plan-row[aria-expanded='true']`), and a list of
collapsed rows keeps the group panel with the hairline separator task 031 proved
shared across four canonical rules on three surfaces (`D8a`). Extrapolating the
open-row box to every row would have blanket-cardified the roadmap — thirty
nested boxes inside a panel — which the task contract prohibits and which the
pack gives no evidence for. The pack is silent on how a *list* of collapsed rows
is bordered; the separator is the reading that leaves the row one structured
item rather than a stack of cards.

### The join for pack 034

`ENGINEERING IMPLEMENTATION` — the open row squares off its bottom edge and
keeps its inset surface, and that is keyed off `[aria-expanded='true']` — the
accessibility state itself — so the affordance cannot say the row is open while
the row says it is closed. That is the attachment point 034 needs and nothing
more: no frame, no track, no rail was drawn.

---

## 7 — ordering and grouping, explicitly preserved

`PRODUCTION SEMANTIC REQUIREMENT`. **No ordering, visibility or grouping code
was touched.** `planRows.ts` is byte-identical; `Plan.tsx` changed only in the
props it passes `PlanRow` (§8). The groups the Plan draws — the numbered phases
from `c.schedule.waves`, the undated held group, the floor's own group, Cleanup,
and the footer — are the same groups in the same order over the same steps. The
row count in the after plates is the row count in the before plates.

`planAnatomy.test.ts` asserts the Plan still builds its rows through
`floorRows`, `undatedRows` and `phaseRows`, and that the row component contains
no `.sort(`, `.filter(` or `.slice(` of its own.

---

## 8 — what actually changed

`src/ui/surfaces/StepSections.tsx` — `PlanRow`'s markup, four zones instead of a
wrapping line, with the reason moved inside the title zone and the `next` marker
moved from before the title to beside it. Its props, and every fact it renders,
are unchanged.

```diff
-<span className="plan-row-main">
-  <Status …>{word}</Status>
-  {nextLabel && <span className="next-mark" …>}
-  <span className="step-title">{title}</span>
-  <span className="who">{who}</span>
-  <span className="when…">{when}</span>
-</span>
-{reason && <span className="plan-row-reason">{reason}</span>}
+<span className="plan-row-status"><Status …>{word}</Status></span>
+<span className="plan-row-title">
+  <span className="step-title">{title}</span>
+  {nextLabel && <span className="next-mark" …>}
+  {reason && <span className="plan-row-reason">{reason}</span>}
+</span>
+<span className="who">{who}</span>
+<span className="when…">{when}</span>
```

`src/ui/app.css` — `.plan-row` becomes the four-track grid; `.phase` hands its
horizontal inset to the row; `.next-mark` gains the spacing it needs beside the
title; the `≤940` block is added and the `640` status tweak it replaces is
removed.

`src/ui/design-lint.test.ts` — rule 3 now accepts an asymmetric radius **only
when every corner of it is one of the three shape tokens**. The rule exists to
stop a raw px value, and `var(--radius) var(--radius) 0 0` introduces none. This
is a generalisation of the existing rule rather than a named exception for the
Plan, so the 4/8/12 hierarchy is still the one authority.

`src/ui/accessibility.test.ts` — the row's structural assertions and the narrow
layout assertion moved with the surface, as they must.

`ENGINEERING IMPLEMENTATION` — every class name the walk and the smoke read
(`.plan-row`, `.step-title`, `.status`, `.who`, `.when`, `.plan-row-reason`,
`.next-mark`, `.phase`) was kept. `.plan-row-main` was retired because the row
is a grid and no longer has a single inner line; `.plan-row-status` and
`.plan-row-title` are the pack's `.row-status` and `.row-title` under
production's naming. No walk or smoke selector reads `.plan-row-main`.

**No copy changed anywhere.** Not one string in `docs/design/content.json` was
added, edited or removed.

---

## 9 — accessibility

`src/ui/accessibility.test.ts` re-runs green, with two assertions moved and two
added.

- **State is a word, never a colour alone.** The row still renders `<Status>`
  with `{word}`; `planAnatomy.test.ts` walks all nine states a step can project
  and asserts each produces a non-empty word on one of the four known tones.
- **The disclosure is unchanged.** `role="button"`, `aria-expanded={open}`,
  `tabIndex={0}`, Enter and Space with `preventDefault` — the same element, the
  same handlers. Opening a row still changes nothing but `open`.
- **Reading order after reflow.** At `≤940` the four children fall into two
  tracks in DOM order — state, title, who, when — so the visual order and the
  reading order stay the same. Nothing is `display: none` at any width, and
  `planAnatomy.test.ts` asserts that: a zone that vanished at 390 would be a
  fact the mobile reader never gets.
- **Focus, forced colours, reduced motion.** Untouched. No motion was added; the
  row has no transition.
- **Long identifiers.** `minmax(0, 1fr)` and `min-width: 0` on the title zone
  keep a long policy or group name wrapping inside its column. No global
  word-break was introduced, so ordinary prose elsewhere is unaffected.
- **No nested-invalid interaction.** The row contains no other control; the
  buttons a step offers are inside the step body, not the row.

---

## 10 — Demo

`PRODUCTION SEMANTIC REQUIREMENT`. Demo reuses the production Plan surface and
the production `PlanRow`; there is no Demo-only roadmap and none was added. The
renderer's Plan shot loads `?demo=1#/plan`, so the "production Plan" and "Demo
Plan" plates in §12 are the same rendered surface over the sample tenant.
`src/ui/demo.test.ts` and the smoke's demo block (including *"no real tenant
storage was touched by the demo"*) pass unchanged.

---

## 11 — deferred, and why

| Deferred | Owner | Why not here |
|---|---|---|
| The attached expanded frame (`.step`, its border, radius and shadow) | 034 | The row now provides the join; the frame is 034's whole subject |
| The lifecycle track (`.track`, `.stage`, `.track-labels`) | 034 | A four-stage progress bar is expanded-step anatomy, and a half-built one would have to be unpicked |
| The expanded head layout (`.step-head`, `.step-head-top`) | 034 | — |
| The main/right-rail grid and the rail's metric blocks (`.step-body`, `.step-side`) | 034 | — |
| Findings, instruction, action tabs, the left-edge callout (`.finding`, `.instruction`, `.action-tab`, `.callout`) | 035 | Task 031 already assigned each of these to 035 |
| The remaining Plan variants | 036 | — |
| Sticky Plan topbar (`manifest.observed.stickyTopbar`) | 034/039 | Shared shell behaviour, not the row |
| The Plan's display size (serif 42) | 036/039 | Task 031: the `.display` mechanism landed, no surface's size did |

`planAnatomy.test.ts` fails two ways on this list: if production implements any
of 034's selectors early, and if the pack stops drawing them (which would make
the deferral stale).

`LANDED REPO FACT`, **noted for 034, not fixed here.** The screen's undated held
group renders as an unlabelled panel, while `PrintPlan.tsx` names the same row
set *"Waiting on something else"* from `pages.app.print.held.heading`. It is a
grouping-presentation gap and the copy for it already exists, but the canonical
pack contains no grouped roadmap and so resolves nothing about group headings,
and the Plan's allowed headings are a closed list in
`docs/qa/page-contracts.json` that only the walk can validate. Out of this
task's scope; recorded so it is not lost.

---

## 12 — visual evidence

```text
docs/design/approved/rendered/plan/{1280,768,390}.png   canonical, unchanged
docs/screens/033/before/plan-{light,dark}-{1280,768,390}.png
docs/screens/033/after/plan-{light,dark}-{1280,768,390}.png
```

Both production sets were shot with `scripts/render-design.mjs --production`,
which writes every governed surface, so they also carry the regression proof:

**Of the 36 plates, exactly the 6 Plan plates differ. The other 30 —
Connect, Connect signed-out, MFA Readiness, Home and Export, in both themes at
all three widths — are byte-identical before and after.** Task 032's Connect
restoration is untouched, and nothing leaked out of the Plan.

### Remaining differences, classified

| Difference | Class |
|---|---|
| Four-zone grid, density, inset, quiet level, right-aligned metadata and timing, title-over-reason | `CONFORMANT` |
| `≤940` collapse to `110px / 1fr` with metadata and timing below and left-aligned | `CONFORMANT` |
| `minmax(0, 1fr)` instead of `1fr` | `TECHNICAL-TRUTH DIFFERENCE` — real tenant object names are longer than the mockup's |
| Row content is production's facts, not the mockup's sample values; empty zones where production has no truthful value | `TECHNICAL-TRUTH DIFFERENCE` |
| Collapsed rows separated by a hairline inside the group panel, not individually bordered | `CONFORMANT` — the pack draws the box only on the open row (§6) |
| Vertical padding added to the row below 940 | `ACCESSIBILITY-REQUIRED DIFFERENCE` — the pack's 64px minimum stops being the row's height once the metadata wraps to three lines, and the text would otherwise meet the border |
| `.status` stays at `--t-2` (13px) where the pack's `.row-status` is 12px | `CONFORMANT`-adjacent, deliberate — `Status` is the shared dot-and-word primitive task 031 classified `EXISTING_SHARED_PRIMITIVE_KEEP`; a Plan-only override would fork it from Connect and MFA for 1px |
| The expanded step below the row is still the old composition | `DEFERRED TO 034` / `DEFERRED TO 035` |
| Serif display size, sticky topbar | `DEFERRED TO 036` |
| Unlabelled held group on screen | `DEFERRED TO 034` (§11) |

Nothing is classified `UNRESOLVED` or `DEFECT`.

---

## 13 — validation

| Check | Result |
|---|---|
| `npx tsc --noEmit` | clean |
| `npm test` | 1910 tests, **1908 pass, 0 fail**, 2 skipped |
| `npm run build:site` | built |
| `npm run smoke` | every check passed |
| `src/ui/surfaces/planAnatomy.test.ts` (new) | 12 pass |
| `src/ui/design-authority.test.ts` (canonical integrity) | pass — no pack byte changed |
| `src/ui/tokens.test.ts` (brand + AA) | pass |
| `src/ui/design-lint.test.ts` (030 foundation) | pass |
| `src/ui/primitives.test.ts` (031 primitives) | pass |
| `src/ui/surfaces/connectAnatomy.test.ts` (032 regression) | pass |
| `src/ui/accessibility.test.ts` (017/030) | pass |
| Rendered evidence, canonical + production + demo, 1280/768/390, both themes | captured (§12) |
| `git diff --check` | clean |
| Final tracked status | clean |

`npm run walk` was **not** run locally: the `deploy-pages` workflow owns it.

---

## 14 — owner decisions

`UNRESOLVED` — none. Nothing in this task required a product or design choice
that the canonical HTML, production semantics, the landed 030/031/032 work and
the approved brand did not already resolve. Every judgment recorded above is an
`ENGINEERING IMPLEMENTATION` and is labelled as one.

No decision here was promoted to owner approval: not the class names, not the
component boundary, not the separator-versus-card reading, not the radius-lint
generalisation, not the transitional markup that pack 034 will attach to.

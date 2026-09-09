# Task 034 — Plan expanded frame

The opened Plan step, restored to the frame the owner approved in
`docs/design/approved/plan-step-v1.html`: attached under the row that opened it,
with the pack's head, its four-stage lifecycle track, and its main column beside
the step's own right rail. This task owns the **frame**. The detailed content of
the opened step — the three-up findings grid, the action strip over the
instruction block, the attention panels, the rest of the rail's side blocks — is
pack 035, and §10 says exactly what was left for it.

Every claim below is labelled `CANONICAL REQUIREMENT`, `PRODUCTION SEMANTIC
REQUIREMENT`, `LANDED REPO FACT`, `ENGINEERING IMPLEMENTATION` or `UNRESOLVED`.
An implementation choice is not an owner decision because it landed.

**The governing rule, unchanged:** production code owns semantic truth; the
canonical HTML owns application anatomy and interaction structure; the brand
authority owns the skin. Where this document and the canonical file disagree,
the file wins.

---

## 1 — source and environment

| | |
|---|---|
| Task start HEAD | `57b9f84f0b624167f982e30751a06eb233159bc0` |
| Branch | `main` (worked directly on `main`, no branch, no PR, no worktree) |
| Working tree at start | clean |
| Upstream authority | `docs/design/reports/030-…md`, `031-…md`, `032-…md`, `033-…md` |
| Design-authority manifest | `docs/design/approved/manifest.json` — **unchanged** |

---

## 2 — canonical hash verification

`LANDED REPO FACT`.

| | |
|---|---|
| Path | `docs/design/approved/plan-step-v1.html` |
| Expected SHA-256 | `1f1bda574fc76d0cc48c7d2e7a5d26abe34d8ee0aa5fab4888282cd9955ad4ec` |
| Measured SHA-256 | `1f1bda574fc76d0cc48c7d2e7a5d26abe34d8ee0aa5fab4888282cd9955ad4ec` |
| Verdict | match — **task 034 changed none of its bytes** |

The file was read in full and rendered. `src/ui/design-authority.test.ts` owns
the hash contract across all four packs and against the committed git blob.

---

## 3 — before-edit rendered evidence, and the differences it showed

`scripts/render-design.mjs --production --out docs/screens/034/before`, at
1280 / 768 / 390 in both themes. The renderer could not previously shoot an
**opened** step at all — its Plan shot is the collapsed roadmap — so a
`plan-step` shot was added that opens a row the way an operator does
(`ENGINEERING IMPLEMENTATION`; §11).

| Dimension | Canonical | Production before | Verdict |
|---|---|---|---|
| Attachment | row and step are one unit: the row is the top edge, the step carries `border-top:0` and rounds only its lower corners | an indented block under the row, marked by a 2px left rule | **different** |
| Frame | `.step` is a bordered panel on `--panel` with `box-shadow:var(--shadow)` | no frame at all | **different** |
| Head | eyebrow · title · supporting line, badge held top-right, `.step-head` with its own bottom rule | a `<p class="line">` repeating the row's title, then three quiet lines | **different** |
| Title | `<h3>` inside `.step-head` | a `<span class="step-title">` — not a heading; the sections below were the first headings | **different** |
| Lifecycle track | four stages with labels and a caption | none | **absent** |
| Body | `minmax(0,1fr) 290px` — main column and right rail | one column | **different** |
| Right rail | `.step-side` on the second surface, divided by the frame's rule | none | **absent** |
| ≤940 | body collapses to one column, rail moves below with a top rule | no rule | **absent** |
| ≤650 | head stacks, insets narrow, labels shrink | no rule | **absent** |
| Topbar | `position:sticky;top:0` | not sticky on any route | **different** |

---

## 4 — the frame, and how it attaches

`CANONICAL REQUIREMENT`, read out of the pack's own CSS:

```text
.roadmap-row{... border-radius:10px 10px 0 0; background:#12171c}
.step{border:1px solid var(--line);border-top:0;border-radius:0 0 12px 12px;
      background:var(--panel);box-shadow:var(--shadow);overflow:hidden}
```

`LANDED REPO FACT` — production already had the two roles this needs. Task 031
proved `.panel` (surface + border + panel radius) and `.panel-key` (the one
key-panel shadow, which the design lint allows on exactly that class) shared by
two packs. So the opened step is `<article className="step panel panel-key">`
and `.step` declares only what is *its own*: the missing top border, the two
lower corners, and the inset.

`ENGINEERING IMPLEMENTATION` — **the 8px inset.** The pack draws the row and the
step standing on the page. Production draws its rows full-bleed on a group panel
(`.phase`, prompt 49.1 item 12), so a frame at the panel's full width would put
its side borders hard against the panel's own and read as a doubled hairline.
The opened unit is therefore inset 8px inside the panel, and the open row's own
inset is reduced from 17px to 9px by the same amount, so the state, the title,
the who and the when stay on exactly the line the collapsed rows above and below
set. The head and the main column carry 19px rather than the pack's 27px for the
same reason: 19 + 8 is the pack's inset from the panel edge.

`ENGINEERING IMPLEMENTATION` — **the corner value.** The pack rounds the row
`10px` and the step `12px`. The brand's shape hierarchy has three radii
(4 / 8 / 12, `docs/brand/brand-manifest.json` `ui.radiusPx`) and the design lint
admits no raw px. Both outer corners take `--radius-control` (8px). What
`planAnatomy.test.ts` asserts is the *shape* — the two corners the step does not
share are rounded and the two it does are square — not the number.

`PRODUCTION SEMANTIC REQUIREMENT` — the join is keyed off `aria-expanded` on the
row, which is the accessibility state itself, so the frame cannot be attached to
a row that says it is closed.

---

## 5 — the head, and what fills each zone

`PRODUCTION SEMANTIC REQUIREMENT`. Every zone is handed a fact by the module
that already owns it. **No zone computes anything.**

| Canonical zone | Production | Value from | Notes |
|---|---|---|---|
| `.eyebrow` | `.eyebrow` (task 031's shared role) | `stepContract.kind[cs.kind]` | new content, §9 |
| `.step-head h3` | `<h3 className="step-title">` | `contentTitle(step)` — the same resolver the row reads | |
| `.step-sub` | `.step-sub` | the step's `changeLine` and `partner` lines | relocated, not written |
| `.badge` | `<Status pill>` | `contract.state.word` / `.tone` (`statusWord.ts`) | |
| `.track-caption` | `<StepState>` | `contract.state.stage`, `.conditionLabel`, `contract.milestone.line` | unchanged component, moved |
| `.track` | `<LifecycleTrack>` | `contract.track` | §6 |

`PRODUCTION SEMANTIC REQUIREMENT` — **the title is now a heading, and the
sections nest under it.** The opened step's title was a `<span>`; the contract's
sections were `<h3>`, which made a step's *first* heading "Why". The title is an
`<h3>` and the sections are `<h4>`, so the step's structure is what a screen
reader walks. `scripts/walk.mjs`'s empty-section check moved with the surface
(`h3` → `h3, h4`, minus `.step-title`, which is not a section heading).

`PRODUCTION SEMANTIC REQUIREMENT` — **no subtitle was invented.** `.step-sub`
renders the step's own `changeLine` and `partner` lines and nothing else. No
step in `content.json` currently sets `changeLine`, so on most steps the zone is
simply absent — truthful omission, the same rule task 033 applied to the row's
empty zones. The canonical sample's "Stop access from device platforms the
organization does not support." is the mockup's content, not a schema production
must satisfy. A real per-step purpose line is pack 035's to decide.

---

## 6 — the lifecycle track

`CANONICAL REQUIREMENT` — four stages, `repeat(4,1fr)`, labelled `Not deployed ·
Report-only · Ready to enforce · Enforced`, with the step's own stage marked.

`PRODUCTION SEMANTIC REQUIREMENT` — the track is a **projection**, and it lives
in the contract (`stepContract.ts` `stepTrack`), not in React:

```ts
const LIFECYCLE_ORDER: Lifecycle[] = ['not-deployed', 'report-only', 'ready-to-enforce', 'enforced']
if (s.lifecycle === null || s.setAside || s.inPlace) return []
```

* A stage is `reached` **only** because the lifecycle Foundation B recorded is
  ordinally past it. That is a restatement of one recorded fact, not a second
  reading of it and not manufactured history: a policy in report-only has, by
  definition of the ordered lifecycle, been deployed.
* The **condition moves nothing.** `Report-only · Review required` sits at
  exactly the stage `Report-only · Healthy` sits at. `planAnatomy.test.ts`
  asserts the two are identical track-wise.
* **No rollout is drawn where there was none.** A goal the tenant already
  satisfies (`inPlace`) was never on this plan's lifecycle, so marking its
  stages reached would claim a rollout that did not happen; a set-aside step has
  left the lifecycle; a step with no policy has none. All three render no track,
  which is also what the pack's "Already in place" and "Needs resolution"
  variants do.
* **No completion percentage.** The pack draws the current stage as a partly
  filled bar (`linear-gradient(...62%...)`). The design lint forbids gradients,
  so the fill is a nested span at a **fixed** width. It is the pack's static
  treatment; nothing measures it and nothing reads it back.

`PRODUCTION SEMANTIC REQUIREMENT` — **the stage is never colour alone.** The
pack draws four bars and a separate parallel grid of labels. Production draws
one list of four items, each a bar over *its own* label, so the label belongs to
the stage a screen reader is on; the current stage carries `aria-current="step"`
and takes the body ink, and the bars are `aria-hidden`.

`ENGINEERING IMPLEMENTATION` — the one-list-instead-of-two-grids translation,
the class names, and the fixed fill width.

---

## 7 — the main column and the step's own rail

`CANONICAL REQUIREMENT` — `.step-body{display:grid;grid-template-columns:
minmax(0,1fr) 290px}`, `.step-side` on the second surface with a left rule;
at ≤940 one column with the rail moved below under a top rule.

`LANDED REPO FACT` — production had **no rail content at all**. §5 of the task
contract allows relocating existing supporting facts into the frame and forbids
inventing metrics to populate it. So the rail carries two blocks, both read
straight off the contract, and no block renders without its fact:

| Block | From | Absent when |
|---|---|---|
| **Next milestone** — the date as the metric, what it waits on under it | `contract.milestone.at` / `.gatedBy` / `.label` (Foundation B) | Foundation B has neither a date nor a gate |
| **Implementation** — whether the three channels are offered | `contract.implementation.offered` (Foundation A, `implementationOffered`) | the step delivers no policy |

`PRODUCTION SEMANTIC REQUIREMENT` — the Implementation block states
*availability*, never a second reason. Why an implementation is withheld is the
step's What to do and is said once, in the main column.

`ENGINEERING IMPLEMENTATION` — **`has-rail`.** A step whose contract has nothing
for the rail must not leave a 290px column standing empty, so the two-track grid
is a class the step sets from one predicate (`hasRail`) that the rail itself
also reads. Cleanup rows — which are not policies, have no lifecycle and no
milestone — get the same frame and head with no track and no rail: the frame is
one, the step activates less of it.

`PRODUCTION SEMANTIC REQUIREMENT` — **one rail, one place in the DOM.** There is
no second copy for a second layout, so reading order and rendered order cannot
diverge, and nothing is hidden at the narrow width — the rail moves.

---

## 8 — the sticky Plan topbar

`CANONICAL REQUIREMENT` — `.topbar{position:sticky;top:0;z-index:30}`.

`LANDED REPO FACT` — task 030 built this as a capability rather than a rule:
`.shell.shell-sticky header.app` with `scroll-margin-top` for in-page anchors,
deliberately unactivated, because a header that sticks changes where every
anchor lands.

`ENGINEERING IMPLEMENTATION` — the Plan route turns it on
(`const sticky = planActive`). No route whose own authority does not ask for it
becomes sticky, no second navigation header was built, and the smoke test now
asserts there is exactly one `header.app`, that it computes to `position:
sticky`, and that its top stays at 0 after the Plan is scrolled 800px.

---

## 9 — new content, and why each string exists

`CANONICAL REQUIREMENT`s that production had no words for. All under
`pages.app.plan.stepContract`; nothing was copied from the mockup.

| Key | Value | Why |
|---|---|---|
| `kind.*` | Policy step · Preparation step · Check step · Campaign step · Hardening step | the pack's eyebrow ("Policy step", "Resolution step"). One label per `steps[].kind`, so the eyebrow names what production already calls the step rather than a second taxonomy. A kind with no entry shows no eyebrow. |
| `trackLabel` | Rollout lifecycle | the accessible name of the stage list |
| `railMilestone` | Next milestone | the pack's own side-block label |
| `railImplementation` | Implementation | the pack's own side-block label (variant 5) |
| `implementationReady` / `implementationNone` | Portal steps, JSON and PowerShell / Nothing to submit yet | the two states of the Implementation block |

`ENGINEERING IMPLEMENTATION` — the exact wording. Nothing here is a technical
claim the engine did not already make.

---

## 10 — deferred, and why

| Deferred | Owner | Why not here |
|---|---|---|
| The three-up findings grid (`.finding`) | 035 | Task 031 already assigned it to 035 |
| The action tab strip over the instruction block (`.action-tab`, `.instruction`) | 035 | production's `TabList` renders the same three channels; restyling it is content anatomy |
| Attention panels (`.attention`, the Plan's left-edge `.callout`) | 035 | — |
| `More` as a two-column disclosure (`.more-grid`, `.more-card`) | 035 | — |
| The rail's remaining side blocks (a Readiness list, an existing-implementation block) | 035 | production has no truthful source for them yet; inventing one to fill the rail is exactly what §5 forbids |
| A real per-step subtitle for `.step-sub` | 035 | no step sets `changeLine`; the zone exists and is empty rather than filled with the Why paragraph twice |
| Section order inside the main column | 035 | the frame moved the sections; it did not reorder them |
| The remaining canonical variants end to end | 036 | — |
| The Plan's serif display size (42) | 036/039 | task 031 landed the `.display` mechanism, no surface's size |
| The unlabelled undated-held group on screen | 035/036 | carried forward from task 033 §11, unchanged and not lost |

`planAnatomy.test.ts` fails two ways on this list: if production implements a
deferred selector early, and if the pack stops drawing what production claims to
have restored.

---

## 11 — visual evidence

```text
docs/design/approved/rendered/plan/{1280,768,390}.png   canonical, unchanged
docs/screens/034/before/*.png     full production run before
docs/screens/034/after/*.png      full production run after
```

Both sets are full runs of `scripts/render-design.mjs --production`, so they
carry the regression proof as well as the acceptance evidence. New in the after
set: `plan-step-lifecycle-*`, which opens the first row that is actually on the
rollout lifecycle, so one plate carries the frame, the head, the track and the
rail together.

**Of the 42 plates shot in both runs, the 10 that differ are all Plan plates.**
Connect, Connect signed-out, MFA Readiness, Home and Export — 30 plates in both
themes at all three widths — are byte-identical, and so are the two 390-wide
collapsed Plan plates. Task 032's Connect restoration
is untouched.

`LANDED REPO FACT` — four of those ten are the **collapsed** Plan
(`plan-{light,dark}-{1280,768}`), which this task did not otherwise change. A
per-pixel diff puts every differing pixel in rows y=18–31 — the header's text
band — and nowhere else. That is the sticky topbar: `position:sticky` with a
`z-index` makes the header its own stacking context, which re-rasterises its
text. No layout moved. `plan-*-390` is unchanged in both themes.

### Remaining differences, classified

| Difference | Class |
|---|---|
| Attached frame, head anatomy, four-stage track, main/rail body, ≤940 and ≤650 collapses, sticky topbar | `CONFORMANT` |
| 8px inset on the opened unit and the matching 9px row padding | `CONTAINMENT DIFFERENCE` — the pack's row stands on the page, production's stands on a group panel (§4) |
| `--radius-control` (8px) where the pack draws 10/12 | `BRAND-TOKEN TRANSLATION` — the shape hierarchy is the one authority (task 030) |
| A fixed-width nested fill instead of a `linear-gradient` for the current stage | `LINT-REQUIRED DIFFERENCE` — design lint 2 forbids gradients; the rendered relationship is the same |
| One list of bar-over-label instead of two parallel grids | `ACCESSIBILITY-REQUIRED DIFFERENCE` — the label belongs to the stage it names |
| Stage labels wrap at 390 rather than dropping to 8px | `ACCESSIBILITY-REQUIRED DIFFERENCE` — four legible labels over four bars |
| Rail carries two blocks, not the pack's sample metrics | `TECHNICAL-TRUTH DIFFERENCE` — production has these two facts and no others (§7) |
| No `.step-sub` on most steps; no track on In place / set-aside steps | `TECHNICAL-TRUTH DIFFERENCE` — truthful omission |
| Findings, action tabs, attention panels, `More` grid, rail side blocks | `DEFERRED TO 035` |
| Serif display size | `DEFERRED TO 036/039` |

Nothing is classified `UNRESOLVED` or `DEFECT`.

---

## 12 — accessibility

| Protection | State |
|---|---|
| `:focus-visible` ring, forced-colours outlines, reduced motion | unchanged; `src/ui/accessibility.test.ts` green |
| Semantic headings | **improved** — the step title is a heading and its sections nest under it |
| Non-colour-only state | the badge is a word, the stage list is four words, the current stage carries `aria-current="step"` and the body ink |
| Pseudo-element labels | none added; every label in the frame is real text |
| DOM order after the rail collapses | the rail is one element in one place; it moves, it is not duplicated or hidden |
| Long tenant objects | `min-width: 0` on the head's lead, the main column and the rail, so a policy or group name wraps inside its column; no global `overflow-wrap: anywhere` |
| One application header | asserted in `accessibility.test.ts`, `planAnatomy.test.ts` and the smoke test |

`accessibility.test.ts`'s "no surface builds an application header of its own"
was made precise rather than weakened: `<header>` is also a sectioning element,
and an `<article>` may head itself. The rule now forbids a second
`header.app` — the application banner — and additionally requires any sectioning
header in a surface to name the section it heads.

---

## 13 — Demo

`LANDED REPO FACT`. The Demo runs the same `Plan` → `PlanRow` → `ContentStep`
components over a synthetic snapshot; there is no Demo-only step body and none
was added. The rendered evidence in §11 is shot at `?demo=1`, so the Demo plates
*are* the production plates. Demo isolation is unchanged and `src/ui/demo.test.ts`
and the smoke Demo walk are green.

---

## 14 — validation

| Check | Result |
|---|---|
| `npx tsc --noEmit` | clean |
| `npm test` | 1916 tests, **1914 pass, 0 fail**, 2 skipped |
| `npm run build:site` | built |
| `npm run smoke` | every check passed, including the two new Plan checks |
| `src/ui/surfaces/planAnatomy.test.ts` | 18 pass (7 new for 034) |
| `src/ui/design-authority.test.ts` (028 integrity) | pass — no pack byte changed |
| `src/ui/tokens.test.ts` (029/030 brand + AA) | pass |
| `src/ui/design-lint.test.ts` (030 foundation) | pass |
| `src/ui/primitives.test.ts` (031 primitives) | pass |
| `src/ui/surfaces/connectAnatomy.test.ts` (032 regression) | pass |
| `src/ui/accessibility.test.ts` (017/030) | pass |
| Rendered evidence, production + demo, 1280/768/390, both themes | captured (§11) |
| `git diff --check` | clean |

`npm run walk` was **not** run locally: the `deploy-pages` workflow owns it. The
two walk-facing changes that move with this surface are recorded above — the
empty-section selector, and `docs/qa/page-contracts.json` (the `plan.step` root
follows the frame, and the two status words the Plan can render that were never
listed are now listed).

---

## 15 — owner decisions

`UNRESOLVED` — none. Nothing in this task required a product or design choice
that the canonical HTML, production semantics, the landed 030–033 work and the
approved brand did not already resolve. Every judgment recorded above is an
`ENGINEERING IMPLEMENTATION` and is labelled as one.

No decision here was promoted to owner approval: not the inset, not the corner
token, not the class names, not the rail's two blocks, not the eyebrow wording,
not the one-list track, not the sticky activation.

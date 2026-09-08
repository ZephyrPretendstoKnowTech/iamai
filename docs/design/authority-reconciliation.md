# Design authority reconciliation

Task 028, 2026-09-08. Forensic record of how IAMAI's visual authority drifted, and the one
authority chain that replaces it.

This is documentation, not a verdict on anyone. Every claim below cites a file, a commit, or
the absence of one.

Task 028 changed no page layout, no CSS declaration, no token, no font and no copy.
Production is expected to remain visually non-conformant until packs 030+.

---

## 1. The authority chain

```text
production technical/content truth
  ↑ outranks
approved HTML application architecture
  ↑ outranks
approved brand skin
```

Truth outranks the picture. The picture outranks the skin. A picture never authorises a
semantic rewrite: if an approved design appears to require a different technical meaning,
the design adapts, or the bounded sub-item stops and reports.

### The four current application authorities

| Surface | Canonical path | SHA-256 |
|---|---|---|
| Home | `docs/design/approved/home-v2.html` | `88b9a3a5907e78ad83f7c31dca00b86a2bdd741b9b4efca575254567d6e55a50` |
| Connect | `docs/design/approved/connect-v3.html` | `903808b07210209a22d1a4f380b9e79dad95bd0e740a0fce0bb3745d265ee48b` |
| Plan | `docs/design/approved/plan-step-v1.html` | `1f1bda574fc76d0cc48c7d2e7a5d26abe34d8ee0aa5fab4888282cd9955ad4ec` |
| MFA Readiness | `docs/design/approved/mfa-readiness-v2.html` | `12d8bdfbd09f82de66b732037d74da8217a79fca5cd78f12ce673eecbfc76512` |

The machine copy is `docs/design/approved/manifest.json`; `src/ui/design-authority.test.ts`
fails when a byte, a hash or a record drifts.

The packs own page anatomy, composition, information hierarchy, major component placement,
widths and density, typography roles and scale hierarchy, spacing rhythm, visual grouping,
disclosure structure, table/row treatment, status and control presentation, the interaction
model, and responsive behaviour.

The packs do **not** own product copy (`docs/design/content.json` stays the copy authority)
and do **not** own technical truth.

The Plan pack's owner file name was `plan-step-design-pack(1).html`. The `(1)` is upload
provenance only. The canonical name drops it, and the integrity guard asserts the canonical
path never contains it, so no future task has two "current" Plan packs to choose between.

### The brand skin

Recorded in full in `docs/design/brand-decisions.md`: light **Mineral Teal**, dark **Deep
Mineral**, IBM Plex Serif/Sans/Mono in the display/interface/technical roles, **Guided Route
— Variant 2** as the logo direction, brand teal held separate from semantic success,
restrained stroked icons, a 4/8/12px shape hierarchy that is not a mandate to cardify,
functional 120–180ms / 180–240ms motion with reduced-motion respected, and evidence-grid
texture on marketing surfaces only.

Brand may repaint the approved anatomy. Brand may not rearrange it. Pack 029 owns the assets
and the token change.

### Generated branding previews are not page design

Any application-page preview generated during the branding exploration is **brand and colour
framing only**, and is non-authoritative for layout, architecture, component placement,
information hierarchy, product copy, workflow, interaction design and responsive behaviour.

`manifest.json` deliberately records no path for a preview: a preview is never an entry in
`surfaces`, and `generatedPreviews` sets every authority flag false. For the four governed
surfaces the approved HTML reigns in every non-branding aspect.

---

## 2. What the evidence actually shows

### Finding 1 — no approved pack has ever existed in this repository

```console
$ git log --all --oneline --name-only --diff-filter=A | grep -iE "design-pack|approved/"
(no output)
```

Every HTML ever committed under `docs/`:

```text
docs/design/connect-mockup.html
docs/design/home-mockup.html
docs/design/mockups/connect-v2.html
docs/design/mockups/plan-top-v2.html
docs/design/mockups/today-v2.html
```

`docs/design/approved/` did not exist before this task. The string
`plan-step-design-pack` appears nowhere in any tracked file at `50cdc51`.

Task 028 is the first time the owner-approved bytes have been in the repository at all.

### Finding 2 — each task that named a pack shipped a prose fallback instead

The runner's contract store (`.overnight/contracts/`, untracked working-directory evidence)
shows the same construction in all three tasks that claimed a pack as authority:

- **011 Plan** — "The owner-approved Plan authority is the September 2026 **IAMAI Plan Step
  Design Pack** … `plan-step-design-pack(1).html`. If the exact HTML design reference is
  present in the repository, inspect it before editing. … **The required design behavior is
  binding even if the HTML file is not present locally**", followed by a twelve-point prose
  list.
- **012 MFA Readiness** — "If that exact HTML is available in the repository, inspect it
  before implementation. **If it is not available locally, the binding design contract is
  below**", followed by an eight-point "Required visual structure" list.
- **016 Home/Connect** — "The owner approved these HTML directions: `iamai-connect-design-
  pack-v3.html`, `iamai-home-design-pack-v2.html`. **If exact copies are present in the
  repository, inspect them before editing**", followed by a prose hierarchy.

The conditional was never satisfied, because of Finding 1. In every case the prose fallback
became the operative contract, and the prose carried semantics and section order well while
carrying almost no visual anatomy — no widths, no density, no grid, no rail, no spacing.

The twelve points in 011 are a good illustration: lifecycle separated from condition,
information order, prerequisites, `More` depth, representations of one resolved action,
state never by colour alone. All of that landed. None of it is anatomy.

### Finding 3 — the older mockups were present, so they kept being cited

The artifacts that *were* on disk became the de-facto reference, because tests, lint, the
walk and smoke could name a real path:

| Added | Commit | Artifact |
|---|---|---|
| 2026-09-03 | `ea4fe66` | `docs/design/mockups/today-v2.html` |
| 2026-09-03 | `da74f08` | `docs/design/connect-mockup.html` |
| 2026-09-03 | `e32ddcd` / `9d0fb09` | `docs/design/home-mockup.html` |

At `50cdc51` these five superseded mockups are cited by name in roughly two dozen tracked
places, including `src/ui/app.css`, `src/ui/design-lint.test.ts`, `scripts/walk.mjs`,
`scripts/smoke.mjs`, `src/derive/ladder.ts`, `src/ui/tokens.ts` and several surface tests.

This is the drift mechanism in one sentence: **authority by availability.** A present but
superseded mockup outranked an absent but approved pack, every time.

### Finding 4 — the shared shell and tokens make the approved anatomy unreachable

Even a task that had held the packs could not have rendered them through the current shell.

| | Approved pack | Production at `50cdc51` |
|---|---|---|
| Home | `width:min(1040px, …)` | `--page: 760px` (`home/home.css:126`) |
| Connect | `width:min(1040px, …)` | `--page: 760px` |
| MFA Readiness | `width:min(1200px, …)` | `--table: 1040px` via `.page-wide` |
| Plan | `width:min(1240px, …)` | `--page: 760px`, tables to `1040px` |

`LAYOUT` in `src/ui/tokens.ts:96` also fixes `radiusPx: 4` ("Radius on a control; everything
else is square") and `motionMs: 120`. Design rule 3 in `src/ui/design-lint.test.ts` allows at
most 4px, plus a named exception list — 8px on a `.wave` or `.export-card` panel, 50% on
`.status::before`, a 999px picker chip — and no 12px anywhere. The approved brand asks for a
4/8/12 hierarchy and two motion bands, so the shape system is an exception list where the
brand wants a hierarchy.

So the packs' widths, density and shape hierarchy were structurally out of reach of any
single-surface task. This is a real, mechanical, contributing cause — not a matter of care.

### Finding 5 — Home is the one place the claim is literally wrong

Task 016 (`09f7874`, 2026-09-07) rewrote `home/home.css`, `scripts/build-home.ts`,
`src/home.test.ts` and `home/index.html`, and stamped them "the owner-approved Home v2
direction, task 016". It added no HTML pack (`git show --stat 09f7874` touches only
`docs/design/content.json` under `docs/`).

`home/home.css:1–9` then described the result as:

> One column … No cards, no grid of tiles, no pill: the hierarchy is type, space and a
> hairline.

The approved Home pack (`docs/design/approved/home-v2.html`) is a 1040px page whose product section is
`grid-template-columns: minmax(0,1.5fr) minmax(280px,.8fr)` with a bordered `.side` rail,
and whose `.catch` rows are a 160px/1fr two-column grid collapsing at 760px. Production
`home/home.css` contains no `display:grid`, no `grid-template-columns` and no side rail.

The phrase "the owner-approved Home v2 direction" therefore pointed at a one-column page the
owner had not approved, in four tracked places (`home/home.css`, `scripts/build-home.ts`,
`src/home.test.ts`, `scripts/walk.mjs`). Task 028 corrects the wording only; the page is
untouched.

### Finding 6 — what already conforms

Not everything drifted.

- **Typography families already match.** `FONTS` in `src/ui/tokens.ts:77` is IBM Plex Serif,
  Sans and Mono, in the display/interface/technical roles the brand decision names.
- **The semantic-colour separation already exists** as a lint rule: design rule 5 keeps
  `--ok`, `--wait`, `--stop` and `--idle` out of anything but a `.status` rule.
- **MFA Readiness section order matches the pack.** The pack is heading → summary with three
  `.summary-stat` counts → `.callout` → `.toolbar` → table of person/role/proof/action rows,
  which is the eight-point list 012 wrote down and built.
- **Connect's four numbered steps match the pack's sequence.** The pack's anatomy is a
  vertical flow of `.step done` / `.step current` / `.step locked` under a `.status-bar`;
  production renders four numbered tiles. The progression is right; the flow, the lock
  states and the status bar are the unimplemented part.

---

## 3. Classification

| Artifact | Classification | Note |
|---|---|---|
| `docs/design/approved/home-v2.html` | `CURRENT_AUTHORITY` | Home anatomy |
| `docs/design/approved/connect-v3.html` | `CURRENT_AUTHORITY` | Connect anatomy |
| `docs/design/approved/plan-step-v1.html` | `CURRENT_AUTHORITY` | Plan anatomy; source name `plan-step-design-pack(1).html` |
| `docs/design/approved/mfa-readiness-v2.html` | `CURRENT_AUTHORITY` | MFA Readiness anatomy |
| `docs/design/brand-decisions.md` | `CURRENT_AUTHORITY` | brand skin only |
| `docs/design/approved/manifest.json` | `CURRENT_AUTHORITY` | machine copy of the chain |
| `docs/design/home-mockup.html` | `SUPERSEDED` | by the Home pack |
| `docs/design/connect-mockup.html` | `SUPERSEDED` | by the Connect pack |
| `docs/design/mockups/connect-v2.html` | `SUPERSEDED` | by the Connect pack |
| `docs/design/mockups/plan-top-v2.html` | `SUPERSEDED` | by the Plan pack |
| `docs/design/mockups/today-v2.html` | `SUPERSEDED` | by the MFA Readiness pack; also `HISTORICAL_ONLY` for the retired Today surface |
| `iamai-plan-page-design-pack-v1.html` | `HISTORICAL_ONLY` | discarded experiment named by 011; never in this repository |
| `docs/design/target-state.md` | `SUPERSEDED` for visual anatomy on the four governed surfaces; `CURRENT_AUTHORITY` for product structure and for surfaces no pack governs | mixed document; see §4 |
| `docs/qa/page-contracts.json` | `CURRENT_AUTHORITY` | content/inventory budgets of the current implementation, never visual anatomy |
| `src/ui/design-lint.test.ts` | `CURRENT_AUTHORITY` | protects the token system production actually has |
| `src/ui/tokens.ts` | `CURRENT_AUTHORITY` for what production is; `SUPERSEDED` as brand direction | families already conform; palette, radius and motion do not |
| `home/home.css`, `scripts/build-home.ts`, `src/home.test.ts`, `scripts/walk.mjs` home section | `IMPLEMENTATION_REFERENCE_NOT_AUTHORITY` | describe the built page, not the owner's target |
| `archive/design/**` | `HISTORICAL_ONLY` | not read; not authority |
| generated branding application previews | not authority | brand/colour framing only; no repository path recorded |

Superseded mockups are kept on disk on purpose. They are the record of what was built and
why, and several tests legitimately cite them for facts that did not change (the ladder's
rung badge, the Connect error states). What changed is their **rank**: a superseded mockup
never outranks the pack for its surface.

---

## 4. Surface by surface

### Home — `SUPERSEDED` implementation, evidenced cause: correct artifact never committed, plus a false current-authority claim

The approved pack is a 1040px editorial page: hero with eyebrow/serif h1/lede/two actions/meta
row, then a two-column product section (steps list plus a bordered side rail), a two-column
`.catch` list, a `.trust` row, About, footer, with defined 760px and 560px breakpoints.

Production is a single 760px column of five rule-separated sections. The section *inventory*
is close; the *anatomy* is not. Task 016 built the prose and labelled it owner-approved.

Restoration pending.

### Connect — `SUPERSEDED` implementation, evidenced cause: correct artifact never committed; progression landed, flow anatomy did not

The approved pack is a 1040px page with a `.status-bar`, a `.flow` of numbered steps in
`done` / `current` / `locked` states, and a `.ready` section. Production renders four
numbered tiles (`src/ui/app.css:1399`), citing `docs/design/connect-mockup.html`.

The four-stage progression (tenant → baseline → scan → plan) is correct and was the part 016
carried in prose. The lock/gating presentation and the status bar are unimplemented.

Restoration pending.

### Plan — `SUPERSEDED` implementation, evidenced cause: correct artifact never committed; semantics consumed, anatomy not

The Plan pack is largely an editorial design document — `h2` sections on what constitutes a
step, lifecycle versus condition, detected versus confirmed, the data contract, and "Five
reference cases, one visual system" — with rendered specimens between them. That shape
explains the outcome precisely: task 011 correctly absorbed the pack's *product semantics*
(Foundations B and D descend from it) while its *visual system* — a 1240px page,
`.row-status`/`.row-title`/`.row-meta`/`.row-date` collapsed rows, `.action-tabs`, a
`.more-grid`, a collapsing `.side-block` right rail, `badge good/warn/danger/violet` —
never reached the repository.

The violet/admin badge in the pack is the same concept as the approved brand's semantic
violet, which is corroborating evidence that the pack and the brand decision are one
coherent direction.

Restoration pending. **Plan step meaning, state and order are not reopened by this.**

### MFA Readiness — closest to conformant, evidenced cause: correct artifact never committed, but the prose paraphrase was faithful

The pack is a 1200px page: summary block with a headline and three `.summary-stat` counts,
`.callout`, `.toolbar`, then one table of `.row`s carrying person / role / proof / action.
That is what 012 wrote down and what production builds, at 1040px rather than 1200px.

Partially conformant. Width, density and row treatment remain to be checked against the pack.

---

## 5. Cause — what the evidence supports and what it does not

**Supported.**

1. **Correct artifact identified, never committed** (Findings 1 and 2). The primary cause, as
   far as the repository can carry it. The packs were named accurately in three contracts and
   were never committed, so each contract's "if present in the repository" condition was
   unsatisfied and the prose fallback became the operative contract every time. Whether the
   bytes reached a session by some other route is `UNKNOWN` (§7.1); what the tracked history
   shows is that no implementation could read a pack from the path its contract named, and
   none did.
2. **Older artifact operative by availability** (Finding 3). The five committed mockups were
   the only design files any test, lint or walk check could name.
3. **Shared shell and tokens prevented conformance** (Finding 4). A 760px page column and a
   4px radius ceiling put the packs' anatomy structurally out of reach of a single-surface
   task.
4. **Review standard accepted conceptual similarity** (Finding 2). Two contracts made the
   prose "binding even if the HTML file is not present", so review could only measure prose
   compliance. No rendered comparison against a pack exists anywhere in history.
5. **Partially implemented where the contract carried it in prose** (Findings 5, 6 and §4).
   Semantics and section order landed; anatomy did not.

**Not supported.**

- **Later regression.** No commit reverts a conformant surface toward the older direction.
  Each surface has been non-conformant since it was built.
- **Wrong artifact supplied to an implementer.** No commit or contract points at a substituted
  pack. Repository history cannot show what any session was handed either way, so what an
  implementer did or did not hold stays `UNKNOWN` (§7.1). What is proven is narrower: no pack
  was ever committed, so no tracked implementation read one from its contract's named path.

---

## 6. Rendered-evidence contract for packs 029+

> Passing code and tests cannot by themselves prove design conformance. A visual restoration
> task must produce rendered evidence comparing the current implementation with the canonical
> approved HTML.

This is the direct lesson of Finding 2: three tasks passed CI while their surface's anatomy
was never compared with anything.

### Required widths

```text
1280px
768px
390px
```

### The mechanism already exists — reuse it

`scripts/walk.mjs` is a headless-Chrome CDP harness that already renders every surface of the
demo and writes a screenshot and a text capture per surface to `walk/<sha>/`. It is run by
the `deploy-pages` workflow, never in a session.

- `scripts/walk.mjs:45` — `const WIDTHS = [1280]`. A restoration task widens this to
  `[1280, 768, 390]`.
- `scripts/walk.mjs:190` — `setWidth(width)` already drives
  `Emulation.setDeviceMetricsOverride` and already sets `mobile: width < 600`, so the 390px
  case is supported by the harness as written.
- The overflow check at `scripts/walk.mjs:548` already branches on `width < 600`.

No new browser or screenshot dependency is needed. A restoration task widens `WIDTHS`, moves
its surface checks with the surface (the walk's checks live beside the surface they read),
and attaches the rendered captures as its conformance evidence beside the pack.

Task 028 deliberately does not widen `WIDTHS` itself: every check that reads a width would
have to be re-verified at three, and that work belongs to the task that needs the evidence.

### Demo

Demo renders through production components. A restoration task compares Demo to *production*
behaviour, not to a second design. There is no demo-specific visual target and a branding
preview is not demo architecture.

---

## 7. Unresolved — marked `UNKNOWN`, not guessed

1. `UNKNOWN` — whether the four packs were ever delivered to an implementation session in a
   form it could read byte-exactly. The repository proves they were never committed; it
   cannot show what was or was not attached to a session. The three contracts' "if present in
   the repository" phrasing is consistent with the packs having been referenced from memory of
   an out-of-band review, but that is inference, not evidence.
2. `UNKNOWN` — whether any reviewer held the packs while reviewing 011, 012 or 016. No
   rendered comparison artifact exists in history either way.
3. `UNKNOWN` — the file names, count and provenance of the generated branding application
   previews. None is in the repository. Their non-authority is settled by rule regardless, so
   this does not need resolving before packs 029+.
4. `UNKNOWN` — whether `iamai-plan-page-design-pack-v1.html`, the experiment 011 recorded as
   discarded, differs from the approved Plan pack in ways worth knowing. It has never been in
   this repository and is not needed: the approved Plan pack's bytes are now here.

---

## 8. What task 028 did not do

No page JSX, no CSS declaration, no token value, no font, no theme colour, no logo or favicon
asset, no animation, no product copy, no baseline, no demo fixture, no Plan/MFA/Graph/session
semantics. `docs/design/content.json` was read-only.

No test or lint rule was skipped, disabled, loosened or deleted. `src/ui/design-lint.test.ts`
still enforces the token system production actually has — which is the honest state, because
production has not been restored yet.

Current production is still visually non-conformant with the approved packs. That is the
expected outcome of an authority task, and it is now written down instead of assumed.

---

## 9. Task 030 — the authority recovery pass

Task 030 opened all four canonical files and reconciled every design and brand record tasks
028 and 029 created against what those files actually say. The bytes were unchanged: all four
hashes still match the owner's values, and `src/ui/design-authority.test.ts` now proves the
working tree equals the committed blob as well as the recorded hash.

### 9.1 Corrections made

| # | Prior assumption | Why it was wrong | Evidence | Corrected to |
|---|---|---|---|---|
| 1 | Each surface's authority path was the owner's upload name (`iamai-home-design-pack-v2.html` and the other three) | Commit `dbf69c0` added byte-identical short-named copies, so every surface had **two** current files with one hash and the manifest could only point at one. "The authority is whatever file happens to be present" is the exact failure task 028 exists to stop | `sha256sum docs/design/approved/*.html` returned eight files and four distinct hashes | The short names are canonical; the four long-named copies are deleted; `ownerApprovedSourceName` keeps the upload name as provenance; a test fails if either copy returns |
| 2 | `renderedEvidence.mechanism = scripts/walk.mjs`, `widths = [1280, 768, 390]` | The walk renders the built application at 1280 only (`WIDTHS = [1280]`) and cannot render an approved pack at all. The evidence contract named a tool that could not produce the evidence | `scripts/walk.mjs:45` | `scripts/render-design.mjs`, which renders the canonical HTML itself at all three widths; the walk's actual single width is recorded beside it |
| 3 | The design lint enforced "what production is": a 4px radius ceiling with a growing named exception list, and every `font-size` one of `--t-1 … --t-6` (26px maximum) | The approved packs set display headings at 38-50px and the brand sets the wordmark at 700. The lint did not merely describe the unbuilt state, it made the approved state unreachable, while still admitting raw px wherever the exception list grew | `home-v2.html` `h1{font:700 50px…}`; `plan-step-v1.html` `42px`; `connect-v3.html` `40px`; `mfa-readiness-v2.html` `38px` | Three shape tokens (4/8/12) and no raw px; the display ramp `--d-1 … --d-15`, every value read out of a pack; a weight above 500 only through a named brand role |
| 4 | `brand-manifest.json` `production.paletteApplied / typographyApplied / shellLogoApplied = false`; `typography.appliedToProduction = false` | True when task 029 wrote them, false after task 030 applied all three | `src/ui/tokens.ts`, `src/ui/app.css`, `src/ui/shell/AppShell.tsx` | All four true, with `pageCompositionRestored: false` added so the honest half stays recorded |
| 5 | `brand-decisions.md`: "Production does not implement this palette yet … the tokens are still the paper/ink direction"; and "Production sets one radius token, 4px … There is no 12px" | Both were accurate records of tasks 028/029 and are now stale | `src/ui/tokens.css` | Rewritten to say what is applied and what is still pending |
| 6 | `main.page { overflow-wrap: anywhere }` protected the page from long tenant strings | `anywhere` also lets a flex or grid track shrink below its longest word, so ordinary prose is squeezed into broken words in a narrow track. No approved pack sets it — none of the four contains `overflow-wrap`, `word-break` or `anywhere` at all | `grep overflow-wrap docs/design/approved/*.html` → no match | `break-word` on the page; `anywhere` plus `min-width: 0` on the roles that carry a UPN, an object id, a policy or group name, a Graph path, a URL or code |
| 7 | The shell's lockup was `[ring mark] IAMAI Planner`, and the ring was both the logo and the step progress indicator | The approved brand lockup is the Guided Route mark beside the wordmark **IAMAI** with no descriptor, and all four packs render the header brand as `IAMAI`. A progress indicator that is also the logo means a change to either moves the other | `brand-manifest.json` `logo.coreLockup = "mark + IAMAI"`, `descriptorUnderWordmark: false`; the four packs' `.brand` markup | `src/ui/components/Mark.tsx` renders the master's geometry; `IAMAI Planner` stays the registered application name and the tab title, which is what it actually is |

### 9.2 Verified as correct, and left alone

The palette values in both themes; the IBM Plex decision and the three roles; Guided Route
Variant 2; `tagline = null` and the six forbidden lines; the font provenance and the OFL
copy; the brand-versus-application authority hierarchy and its three-step precedence; every
logo asset and its derivation from the one master; all four design hashes; the rule that a
generated branding preview is authority for nothing — task 030 re-read every design and brand
record from 028 and 029 and found no preview recorded as architecture anywhere.

`docs/design/target-state.md`'s task-028 scope header is correct and unchanged. The mockups
under `docs/design/` remain `SUPERSEDED` records. The quotation of task 016's prompt in §4
keeps the upload file names because it is a verbatim historical quotation.

### 9.3 One gap found in task 029, closed by task 030's first correction

`brand-manifest.json` approves the display role as IBM Plex **Serif 700**. Task 029 staged
IBM Plex **Sans** SemiBold and Bold in `public/fonts` for the wordmark, and no serif face
above Medium; task 030 first shipped `ROLE_WEIGHTS.display = 500` — the heaviest face the
repository held — while the manifest said typography was applied to production. Recording a
compromise is not the same as being allowed to keep it, and an approved weight nothing sets
is a manifest that cannot be trusted about the weights it does set.

Correction 1 staged Serif SemiBold and Bold from `@ibm/plex-serif@1.1.0`, normalised Regular
and Medium onto the same release, and set the display role to the approved 700.
`src/ui/tokens.test.ts` reads each role's weight out of the manifest and fails if it has no
staged, declared face, so the runtime and the authority cannot part again.

### 9.4 What task 030 did not do

No page composition. Home, Connect, Plan and MFA Readiness do not wear the anatomy of their
packs, and every record still says `restoration-pending` and
`productionAssumedConformant: false`. No baseline, no tenant evidence, no lifecycle or
condition semantics, no MFA proof or rung truth, no emergency-access semantics, no canonical
operation, no Graph permission or collection, no session behaviour, no demo truth, and no
change to accurate production copy other than adding the brand wordmark string beside the
product name it was standing in for.

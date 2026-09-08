# Task 030 — theme, typography, shell foundation, and authority recovery

The handoff artifact for Pack 031. Everything an author needs to write the next pack without
guessing what task 030 did, and without re-deriving the approved design from prose.

**The governing rule, unchanged:** prompts define scope and safety; the canonical HTML
defines the visual result. Every number in §2 and §3 below was read out of the approved files
themselves. Where this document and a canonical file disagree, the file wins.

---

## C1 — source, environment, authorities

| | |
|---|---|
| Task start HEAD | `dbf69c0462183d519a80ccba00145abd9c4f57c9` |
| Branch | `main` (worked directly on `main`, no branch, no PR) |
| Remote | `https://github.com/ZephyrPretendstoKnowTech/iamai` |
| Design-authority manifest | `docs/design/approved/manifest.json` (version 2) |
| Brand manifest | `docs/brand/brand-manifest.json` (version 1, `production` block updated) |
| Forensic record | `docs/design/authority-reconciliation.md` §9 (added by this task) |
| Design-authority guard | `src/ui/design-authority.test.ts` |
| Brand-integrity guard | `src/brand/brand.test.ts` |
| Foundation guard | `src/ui/foundation.test.ts` (new) |

The task's own final commit SHA is deliberately not embedded here — a committed file cannot
carry the hash of the commit that contains it. The runner's handoff carries it.

---

## C2 — canonical design authority

All four files exist on `main` and every hash matches the owner's value exactly. Task 030
changed none of their bytes; `src/ui/design-authority.test.ts` proves the working tree equals
both the recorded hash and the committed git blob.

| Surface | Canonical path | SHA-256 | Original upload name | Desktop width (read from the file) | Breakpoints (read from the file) |
|---|---|---|---|---|---|
| Home | `docs/design/approved/home-v2.html` | `88b9a3a5907e78ad83f7c31dca00b86a2bdd741b9b4efca575254567d6e55a50` | `iamai-home-design-pack-v2.html` | `min(1040px, 100% - 40px)` | 760, 560 |
| Connect | `docs/design/approved/connect-v3.html` | `903808b07210209a22d1a4f380b9e79dad95bd0e740a0fce0bb3745d265ee48b` | `iamai-connect-design-pack-v3.html` | `min(1040px, 100% - 40px)` | 760 |
| Plan | `docs/design/approved/plan-step-v1.html` | `1f1bda574fc76d0cc48c7d2e7a5d26abe34d8ee0aa5fab4888282cd9955ad4ec` | `plan-step-design-pack(1).html` | `min(1240px, 100% - 44px)` | 940, 650 |
| MFA Readiness | `docs/design/approved/mfa-readiness-v2.html` | `12d8bdfbd09f82de66b732037d74da8217a79fca5cd78f12ce673eecbfc76512` | `iamai-mfa-readiness-design-pack-v2.html` | `min(1200px, 100% - 40px)` | 900, 620 |

Declared `<title>` values, verbatim: `IAMAI Home Design Pack v2`, `IAMAI Connect Design Pack
v1`, `IAMAI Plan Step Design Pack`, `IAMAI MFA Readiness Design Pack v2`. **Connect's title
element says v1 while the owner's file name and the manifest say v3.** The bytes and the hash
are the identity; a stale title inside an approved file is not a reason to edit the file. It
is recorded in the manifest as `declaredTitleNote`.

All four packs are dark-canvas mockups drawn in Inter + Georgia. That is pre-brand type: the
brand skin (task 029, IBM Plex + Mineral Teal / Deep Mineral) repaints them. The packs own the
**anatomy**; they do not own the typeface or the colour.

---

## C3 — extracted visual contract

Secondary to the HTML. Useful for prompt authoring; not a substitute for opening the file.

### Home — `home-v2.html`

- `.wrap` is `min(1040px, calc(100% - 40px))`, one column, sections separated by
  `border-top: 1px solid` — no card wall.
- Header: `[mark] IAMAI` left; three text links right (`How it works`, `GitHub`,
  `Open IAMAI →`, the last in the accent). Bottom hairline. 17px vertical padding.
- Hero: `padding: 76px 0 58px`, `max-width: 900px`. Eyebrow (11px uppercase, `.11em`
  tracking, 750 weight) → `h1` **serif 700 50px/1.05**, `max-width: 900px` → lead
  **18px**, `max-width: 790px` → two CTAs (`.btn.primary` first) → a 12px meta row of three
  claims (Read-only / Runs in your browser / Source is public).
- Product section: `grid-template-columns: minmax(0,1.5fr) minmax(280px,.8fr)`, `gap: 36px`,
  `align-items: start`. Left: eyebrow, `h3` serif 700 25px, a paragraph capped at 650px, then
  `.steps` — three `78px 1fr` rows separated by hairlines (Reads / Compares / Plans). Right:
  `.side`, `padding-left: 24px`, `border-left: 1px solid` — label, name, paragraph, link.
- Catches: `.catches` capped at 860px; each `.catch` is a `160px 1fr` grid with a hairline.
- Trust: a flex row of three `strong`-led claims, `gap: 28px`, 13px.
- About: one paragraph capped at 760px. Footer: name left, three links right, 11px.
- Section headings `h2` are serif 700 **29px**.
- ≤760: `h1` 39px, product collapses to one column, `.side` loses its left border and gains a
  top one, `.catch` becomes one column. ≤560: gutters 24px, first header link hides, hero
  padding drops, `h1` 34px, lead 16px.

### Connect — `connect-v3.html`

- `.page` is `min(1040px, calc(100% - 40px))`.
- Topbar: brand left, five nav items (`Connect Plan "MFA Readiness" Export How`) centre with
  the current one on a filled chip, `Account` right, bottom hairline.
- `h1` **serif 700 40px/1.08**, `max-width: 800px`; `.lead` 16px capped at 780px.
- **Status strip** above the flow: one bordered 10px-radius bar — a state dot, a bold state
  title, a quiet sentence, and (in the pack only) a mockup state switch on the right.
- **One contiguous flow, not three cards.** `.flow` is a single 14px-radius bordered panel
  with a shadow; each `.step` is a `46px minmax(0,1fr) auto` grid separated by a top hairline,
  `padding: 18px 20px`, `align-items: start`. The numbered `.num` is a 32px circle whose
  border and colour carry done / current / locked; `.step.locked` is `opacity: .55`.
- The action column is the third grid track, right-aligned, in the same row as the step —
  never below it.
- Step 2 nests a `.baseline-card` (name, source line, an MVP credential pill, an explaining
  paragraph capped at 760px) plus a `<details>` for source and version. Step 3 carries a meta
  row of three counts and a `<details>` for scan limitations.
- **Plan-ready destination:** a separate `.ready` panel below the flow, brand-tinted border
  and background, `grid-template-columns: minmax(0,1fr) auto` — eyebrow, `h2` serif 700 25px,
  a paragraph, a three-count meta row, and `Open Plan →` in the right track.
- ≤760: nav and account hide, `h1` 33px, the status bar stacks, the step grid drops to
  `36px 1fr` with the actions moving under the copy in column 2, `.ready` becomes one column.

### Plan — `plan-step-v1.html`

- `.page` and `.topbar-inner` are `min(1240px, calc(100% - 44px))`.
- **The topbar is sticky**: `position: sticky; top: 0; z-index: 30`, translucent background
  with `backdrop-filter: blur(14px)`, bottom hairline.
- Hero `h1` **serif 700 42px/1.1** capped at 860px; lead 17px capped at 840px. Section `h2`
  serif 700 **27px**; `.section-lead` 15px capped at 860px.
- **Collapsed roadmap row:** `grid-template-columns: 126px 1fr 240px 125px`, `gap: 18px`,
  `min-height: 64px`, `padding: 0 17px`, `border-radius: 10px 10px 0 0`. Status dot + word,
  then title over a quiet subtitle, then a right-aligned meta column, then a right-aligned
  date column.
- **The expanded step is attached to its row, not floating:** `.step` has `border-top: 0` and
  `border-radius: 0 0 12px 12px`, with the panel shadow `0 18px 45px rgba(0,0,0,.24)`.
- Step head: eyebrow → `h3` **21px** (interface face, not serif) → a subtitle capped at 760px,
  with a state badge in the top-right of a `space-between` row.
- **Lifecycle track:** a four-column bar of 6px stages (`Not deployed / Report-only / Ready to
  enforce / Enforced`) with a caption above it whose `Next:` is bold, and 10px labels beneath.
  A partly-done stage is a hard-stop gradient, not an animation.
- **Body:** `grid-template-columns: minmax(0,1fr) 290px`. Main column `padding: 4px 27px 26px`,
  sections separated by hairlines. Right rail `.step-side` has a left border, the secondary
  surface, `padding: 20px 18px`, and stacks `.side-block`s (uppercase 10px label, an 18px
  metric, an 11px sub, a dotted list).
- Section order in the main column: Why → What IAMAI found → Who this touches → What to do →
  Done when → More. **Findings** are a `repeat(3,1fr)` grid of bordered cards, each an
  uppercase 10px key over a bold line over a 12px sentence. **What to do** is a tab strip
  (Portal / JSON / PowerShell) over a bordered instruction block. **More** is a `<details>`
  opening a two-column grid of small cards.
- An attention block is a bordered tinted panel with a coloured head; a `.callout` is a 3px
  left border with `border-radius: 0 8px 8px 0`.
- Tables: `.table-wrap` scrolls, `table` has `min-width: 760px`, `th` is uppercase 11px on the
  secondary surface. Code is 12px mono on the code surface; `pre` is `white-space: pre-wrap`.
- ≤940: two/three-column grids collapse, the roadmap row becomes `110px 1fr` with the meta and
  date left-aligned, the body becomes one column and the rail moves below with a top border,
  findings collapse, `h1` 34px. ≤650: gutters 24px, nav hides, `h1` 30px, step padding 18px,
  the head stacks, track labels 8px.

### MFA Readiness — `mfa-readiness-v2.html`

- `.page` is `min(1200px, calc(100% - 40px))`. Topbar: brand, nav with `MFA Readiness` active,
  a right meta pair (tenant · scan age).
- `h1` **serif 700 38px/1.08**; `.intro` 16px capped at 760px.
- **The summary and the counts are one integrated panel**, not four tiles:
  `grid-template-columns: minmax(0,1.8fr) repeat(3, minmax(120px,.65fr))`, one 12px-radius
  border, `overflow: hidden`, each stat separated by a left hairline. The main cell carries an
  eyebrow, a **serif 700 24px** headline sentence, and a 13px sub. Each stat is a **serif 700
  28px** number over a 12px name over an 11px hint.
- A single callout under it: a bordered, attention-tinted `space-between` row.
- Toolbar: a search input (`min-width: 260px`, `flex: 1`) then pill filters, `flex-wrap: wrap`.
- **The person table is an explicit six-zone grid**, head and row sharing
  `minmax(210px,1.5fr) 100px minmax(150px,1fr) minmax(130px,.9fr) 150px 135px`, `gap: 14px`:
  Person (name over UPN) · Role · Strongest method · Proof · Readiness · Action. The head is
  uppercase 10px on the secondary surface; rows are separated by top hairlines. Readiness is a
  pill with a coloured dot **and a word**. The admin role is the admin colour.
- A footer note row closes the table.
- ≤900: the summary becomes `1fr 1fr` with the main cell spanning both; **the table head hides
  and each row becomes one column, every cell labelled by a `::before`** (Person / Role /
  Strongest method / Proof / Readiness / Action). ≤620: gutters 24px, nav and meta hide,
  `h1` 31px, the summary becomes one column, the callout stacks.

> Note for pack 037: production's table is a real `<table>` whose labels are DOM structure,
> because `::before` pseudo-content is not read by a screen reader
> (`src/ui/accessibility.test.ts`). The pack's stacked-row *shape* is the target; its
> `::before` *mechanism* is not. Product truth outranks the picture.

---

## C4 — 028 / 029 reconciliation

The full table with evidence is `docs/design/authority-reconciliation.md` §9. Summary:

**WRONG — corrected now**

1. Both manifests pointed at the owner's upload file names, and commit `dbf69c0` had added
   byte-identical short-named copies — two current files per surface. The short names are now
   canonical, the four long-named copies are deleted, the upload names survive as
   `ownerApprovedSourceName`, and a test fails if either copy returns.
2. `renderedEvidence.mechanism` named `scripts/walk.mjs` for three widths; the walk renders
   the built application at 1280 only and cannot render a pack at all. Replaced by
   `scripts/render-design.mjs`, with the walk's real single width recorded beside it.
3. The design lint's 26px font ceiling and 4px radius ceiling made the approved design
   unreachable. Replaced by the three shape tokens and the approved display ramp — stricter,
   not looser: no raw px radius and no raw 600/700 weight now passes.
4. `brand-manifest.json`'s `production` flags and `typography.appliedToProduction` were false;
   task 030 applied all of them. Now true, with `pageCompositionRestored: false` added.
5. `brand-decisions.md`'s "production is still the paper/ink direction" and "there is no 12px"
   paragraphs were correct records of 028/029 and are now stale. Rewritten.
6. `main.page { overflow-wrap: anywhere }`. See C6.
7. The shell lockup was `[ring mark] IAMAI Planner` and the ring mark doubled as the step
   progress indicator. See C6.

**CORRECT — preserved**

Both palettes value for value; the IBM Plex decision and its three roles; Guided Route Variant
2; `tagline = null` and the six forbidden lines; font provenance and the OFL copy; the
brand-vs-application hierarchy and its three-step precedence; every logo asset and its
derivation from the one master; all four design hashes; the rule that a generated branding
preview is authority for nothing.

**Checked specifically, and clean:** every design and brand record from 028 and 029 was
re-read for a generated branding preview recorded as architecture. There is none. Neither
manifest records a preview path, both carry an all-false authority block, and both are
asserted by test.

**HISTORICAL — retained with its label:** `authority-reconciliation.md` §4 quotes task 016's
prompt verbatim, including the upload file names. A quotation is not a path reference.
`docs/design/target-state.md`'s 028 scope header, and the `SUPERSEDED` mockups under
`docs/design/`, are unchanged and still correct.

**UNKNOWN — not guessed:** the four items in §7 of the reconciliation stand. Nothing task 030
saw resolved or contradicted them.

**One gap found in 029, closed by correction 1:** the brand approves IBM Plex **Serif 700**
for display, and 029 staged only Serif Regular and Medium (its Sans 600/700 were for the
wordmark). Task 030 first shipped `ROLE_WEIGHTS.display = 500`, the heaviest staged face,
while `typography.appliedToProduction` said true — a manifest claiming a weight production
did not set. The correction staged Serif SemiBold and Bold from `@ibm/plex-serif@1.1.0`,
normalised Regular and Medium onto the same release so one family is not typeset from two,
set the display role to the approved 700, and preloads the seven faces a first paint uses.
`src/ui/tokens.test.ts` now reads each role's weight out of the brand manifest and fails if
that weight has no staged, declared face, so the runtime and the authority cannot disagree
again.

---

## C5 — the repository's visual architecture, as discovered

| Concern | Actual source of truth |
|---|---|
| Tokens (colour, type, length, shape, motion) | `src/ui/tokens.ts` |
| Generated theme CSS | `src/ui/tokens.css`, written by `scripts/gen-tokens.mjs`, guarded by `src/ui/tokens.test.ts` |
| Home's copy of the same tokens | `home/theme.css`, written by `scripts/build-home.ts` (font URLs rewritten through `{{TOOL_PATH}}`), guarded by `src/home.test.ts` |
| Font loading | `@font-face` inside the generated token sheets; faces in `public/fonts` (OFL); provenance `docs/brand/font-provenance.md`. No CDN, ever |
| Global app CSS | `src/ui/app.css` (single sheet; no CSS modules, no framework) |
| Home CSS / build path | `home/home.css` + `scripts/build-home.ts` → `home/index.html`; assembled by `scripts/assemble-site.mjs` to `dist/` (home at `/`, planner at `/planner/`) |
| App shell / header / nav | `src/ui/shell/AppShell.tsx`; routes `src/ui/shell/routes.ts` |
| Route width policy | `data-route` on `main.page` (AppShell) + `main.page[data-route=…]` in `app.css`; values in `tokens.ts` `ROUTE_WIDTHS` |
| Theme switcher | `useTheme()` in `AppShell.tsx`; key `iamai-theme`, shared with the home page's inline script |
| Print CSS | two `@media print` blocks in `src/ui/app.css` (the shell suppression, and the `.print-plan` document), plus the print palette override in `tokens.css` |
| Brand assets | one master `src/brand/logo/iamai-guided-route-master.svg`; everything else derived by `scripts/gen-brand.mjs` / `scripts/brandDerive.ts`, guarded by `src/brand/brand.test.ts` |
| Rendered evidence | `scripts/render-design.mjs` (new, all three widths, canonical + production); `scripts/walk.mjs` renders the built app at 1280 in CI only |
| Design lint | `src/ui/design-lint.test.ts` |
| Page contracts | `docs/qa/page-contracts.json` (rendered **strings**, not anatomy), read by the walk and `src/ui/accessibility.test.ts` |

Historical constraints named in the task brief, verified against `main` before editing: the
26px display cap (real — `TYPE['t-6']`), the 760px generic page and the 1040px wide allow-list
(real — `LAYOUT.pagePx` / `tablePx` and a boolean `page-wide` class), `--radius-card: 0` and
`--shadow-1: none` (real, in the legacy bridge), and `main.page { overflow-wrap: anywhere }`
(real). The "old owner-approved comments" were already corrected by task 028.

---

## C6 — the foundation task 030 built

**Light and dark runtime tokens.** `src/ui/tokens.ts` → `src/ui/tokens.css`. The seventeen
canonical roles carry `docs/brand/brand-manifest.json` values byte for byte
(`canvas surface secondarySurface line strongLine primaryText secondaryText mutedText
brandPrimary brandSecondary brandSoft brandSoftText success attention danger admin
codeSurface`), light = **Mineral Teal**, dark = **Deep Mineral**. `src/brand/brand.test.ts`
fails if the token file and the brand manifest disagree.

`brandPrimary ≠ success` in both themes and is asserted twice (`tokens.test.ts`,
`brand.test.ts`). There is no generic `green`.

**Derived tokens, and why each exists.** Nine values production needs that the brand manifest
deliberately does not carry, all in `tokens.ts` and all measured by `tokens.test.ts`:
`onBrand` (ink on the brand colour), `idle` (the dormant state), `unproven` (the MFA ladder's
rung 2, retained from the shipped palette because rung truth is frozen), and six `*Text`
variants. The canonical value is the fill, dot, border and badge; the `*Text` value is the
same colour as small text, darkened in **light mode only** by the smallest step that reaches
WCAG AA on canvas, surface, secondary surface and code surface. Without this, the approved
`attention` `#B7791F` measures 3.04:1 as a status word — production paints status *words*, not
only dots. Dark needs no variant; every canonical state colour is already AA there. The
canonical manifest was not changed.

**Compatibility aliases.** The names the pages already read (`--bg --ink --accent --ok --wait
--stop --rule …`) are `var()` references to a canonical or derived value. None carries a
colour of its own — one system with two names. Pack 040 migrates the pages and deletes the
block.

**IBM Plex.** `@font-face` in the generated sheets; **nine** local `woff2` faces (Serif
400/500/600/700, Sans 400/500/600/700, Mono 400). Sans 600/700 were staged by 029 and are now
declared, which is what the wordmark needs; Serif 600/700 were staged by correction 1 (§C4,
§C10), which is what the display role needs. Roles: `--weight-display` **700** — the brand's
approved display weight, in a real IBM Plex Serif Bold — `--weight-body` 400,
`--weight-strong` 600, `--weight-wordmark` 700. Correction 2 (§C11) settled the one family
that still asked for a face it does not have: Mono ships its 400 only, and the two rules that
paired `var(--font-mono)` with a literal 500 now set 400.

**Typography capability.** The 26px ceiling is gone. `--t-micro` 10 · `--t-0` 11 · `--t-1` 12 ·
`--t-2` 13 · `--t-3` 14 · `--t-4` 16 · `--t-lead` 17 · `--t-lead-lg` 18 · `--t-5` 20 ·
`--t-6` 26 is the interface scale. The display ramp is every serif display size the four packs
actually set:

| Token | px | Where it came from |
|---|---|---|
| `--d-1` | 50 | Home `h1` |
| `--d-2` | 42 | Plan `h1` |
| `--d-3` | 40 | Connect `h1` |
| `--d-4` | 39 | Home `h1` ≤760 |
| `--d-5` | 38 | MFA Readiness `h1` |
| `--d-6` | 34 | Home `h1` ≤560; Plan `h1` ≤940 |
| `--d-7` | 33 | Connect `h1` ≤760 |
| `--d-8` | 31 | MFA `h1` ≤620 |
| `--d-9` | 30 | Plan `h1` ≤650 |
| `--d-10` | 29 | Home section `h2` |
| `--d-11` | 28 | MFA summary count |
| `--d-12` | 27 | Plan section `h2` |
| `--d-13` | 25 | Home `h3`; Connect "plan ready" `h2` |
| `--d-14` | 24 | MFA summary headline |
| `--d-15` | 21 | the opened Plan step's title (interface face) |

The role class is `.display` in `app.css`: a pack sets `--display-size: var(--d-2)` on its
heading rather than writing a px value into a surface stylesheet.

**Route width.** `AppShell` puts `data-route` on `main.page`; `app.css` gives each surface its
column; the values are `ROUTE_WIDTHS` in `tokens.ts`. Resolved desktop widths:

| Route | Token | Content column | Rendered `max-width` |
|---|---|---|---|
| home | `--w-home` | **1040px** | `calc(1040px + 2 × 24px)` in `home/home.css` |
| connect | `--w-connect` | **1040px** | `calc(var(--w-connect) + 2 * var(--pad))` |
| plan | `--w-plan` | **1240px** | `calc(var(--w-plan) + 2 * var(--pad))` |
| readiness | `--w-readiness` | **1200px** | `calc(var(--w-readiness) + 2 * var(--pad))` |
| export, and any route with no pack | `--page` | **760px** | the prose page |
| inventory, how | `--table` | **1040px** | the wide table cap, until pack 040 |

This replaced a boolean `page-wide` class that could only say "the wide one".

**Prose measure.** `--measure: 72ch` (inside the 68–76ch band) for body prose, unchanged.
`--measure-lead: 790px` for a lead paragraph under a display heading — the approved packs cap
theirs between 710 and 840. Connect's prose moved from `max-width: none` (which meant the old
760px page) to `--measure-lead`, so widening the page to 1040 did not widen a sentence to 1040.

**Logo.** `src/brand/logo/mark.ts` is generated from the master by `scripts/gen-brand.mjs`
(added to `derived()`, so `brand.test.ts` re-derives and fails on drift).
`src/ui/components/Mark.tsx` renders it as `BrandMark`. The shell and the print cover use it;
`RingMark` is deleted and `RingProgress` — a step's progress indicator, not a logo — stays.
The lockup is `[mark 20px] IAMAI`, IBM Plex Sans 700, 6px gap (the brand's 0.28 of a 20px
mark), `letter-spacing: 0.005em`, no tagline and no descriptor. `IAMAI Planner` remains the
registered Entra application name, the consent and removal copy, and the tab title.

**Surface, radius, shadow.** Four depths: `--canvas`, `--surface`, `--secondary-surface`,
`--code-surface`. Three radii: `--radius` 4 (compact row), `--radius-control` 8,
`--radius-panel` 12. Role classes `.panel`, `.panel-key`, `.surface-inset`, `.surface-code`.
`--shadow-panel` is `0 10px 30px rgba(29,37,40,.08)` light and `0 18px 45px rgba(0,0,0,.32)`
dark — one restrained key-panel shadow, allowed by the lint only on `.panel-key`; dark leans on
surface tone and border. Nothing was blanket-cardified.

**Overflow.** `main.page` is `overflow-wrap: break-word`, not `anywhere`. Both break a word too
long for its column; only `anywhere` also lets a flex or grid track shrink below its longest
word, which squeezes ordinary prose into broken words in a narrow track. The strings that
genuinely are unbreakable carry `anywhere` plus `min-width: 0` themselves — `.tenant-object`
(a new role for UPNs, object ids, group / app / service-principal names), `.policy-name`,
`.portal-path`, `code`, `kbd`, `.mono`, and `main.page a[href]` for long URLs and Graph paths.
Table cells get `min-width: 0` so the break can happen. No approved pack uses `overflow-wrap`
at all.

**Print.** The `@media print` palette override in the token sheet still forces the light
palette over both themes, now Mineral Teal; the print document keeps `max-width: none`, no
shell chrome, and the brand mark in the brand colour. State is never colour-only in print
because it is a word (`src/ui/accessibility.test.ts`). Nothing about Export or the print
document's content changed.

**Accessibility.** Task 017's protections are intact and re-run green: `:focus-visible` leaves
a ring on every probed control reset, the forced-colours fallback outlines survive,
`prefers-reduced-motion` still kills transitions, `aria-current` plus an accent underline mark
the current tab, the theme control is a named button, and every state carries a word. New:
every derived text colour is proven AA on all four text surfaces, and the prose no longer
breaks mid-word.

**Sticky shell.** The Plan pack's sticky topbar is available as `.shell.shell-sticky
header.app` (position/top/z-index) with `scroll-margin-top` for in-page anchors. It is a
capability, not an activation: a header that sticks changes where every anchor lands, so the
Plan packs turn it on together with the anatomy that expects it. There is still exactly one
`header.app` in the product — no second Plan-only navigation shell.

---

## C7 — rendered evidence

`node scripts/render-design.mjs [--canonical] [--production] [--list]`. Local Chrome over CDP —
the same browser the walk, the smoke test and the brand generator already drive. No framework,
no network. Deterministic: fixed viewport width, device scale 1, fonts awaited, full document
height clipped to 4000px, deterministic file names.

**The canonical packs (the derived reference; the HTML above it is the authority):**

```text
docs/design/approved/rendered/home/1280.png            768.png   390.png
docs/design/approved/rendered/connect/1280.png         768.png   390.png
docs/design/approved/rendered/plan/1280.png            768.png   390.png
docs/design/approved/rendered/mfa-readiness/1280.png   768.png   390.png
```

All twelve are committed (1.9 MB total), matching the repository's existing convention of
committing visual evidence under `docs/screens/`.

**The current build, light and dark, at all three widths:**

```text
docs/screens/30/connect-{light,dark}-{1280,768,390}.png
docs/screens/30/plan-{light,dark}-{1280,768,390}.png
docs/screens/30/readiness-{light,dark}-{1280,768,390}.png
docs/screens/30/home-{light,dark}-{1280,768,390}.png
```

Judged against task-030 responsibilities only: IBM Plex loads in all three roles; the Mineral
Teal and Deep Mineral palettes are correct in both themes; the Guided Route mark is crisp at
20px; the nav is `Connect · Plan · MFA Readiness · Export · How` with the current tab marked;
Plan renders at 1240 and MFA Readiness at 1200 while their prose stays at the measure; gutters
are sane at every width; no shell overflow and no mid-word prose wrapping; the theme toggle
works; focus is visible; contrast is sane in both themes.

**Expected and not a failure:** the page interiors are still the pre-restoration composition —
Connect is four stacked bordered tiles rather than one contiguous flow, Plan is phase panels
of collapsed rows with no expanded-step frame, MFA Readiness has no integrated summary panel,
and Home is one column with no side rail. Packs 032–038 own all of that. The foundation does
not prevent any of it.

---

## C8 — remaining visual debt, by pack

| Pack | Owes |
|---|---|
| **031** shared primitives | Row / badge / pill / finding card / callout / instruction block / tab strip / metric block / stacked disclosure, on the tokens this task created. Decide where `.display` is applied. |
| **032** Connect | The status strip; **one contiguous flow panel** replacing four stacked tiles; the `46px / 1fr / auto` step grid with the action column in-row; numbered circles carrying done/current/locked; the nested baseline card with its credential pill; the separate brand-tinted "plan ready" destination. |
| **033** Plan collapsed | The `126px / 1fr / 240px / 125px` roadmap row at 64px min-height with `10px 10px 0 0`; the ≤940 collapse to `110px 1fr`. |
| **034** Plan expanded frame | The step attached to its row (`border-top: 0`, `0 0 12px 12px`, `.panel-key`); the head; the four-stage lifecycle track with its caption and labels; the `minmax(0,1fr) 290px` body and the bordered right rail. Decide whether to activate `.shell-sticky`. |
| **035** Plan expanded content | Section order and the three-up findings grid; the Portal/JSON/PowerShell strip over the instruction block; attention blocks; `More` as a two-column disclosure; the rail's side blocks. |
| **036** Plan variants | The five canonical cases rendering more or less of one system, against real lifecycle and condition truth. |
| **037** MFA Readiness | The integrated summary panel (`1.8fr + 3 stats`, serif counts); the callout; search + pill filters; the explicit six-zone table; the ≤900 stacked row — **as DOM structure, not `::before`**. |
| **038** Home | 1040px composition: hero scale and CTA pair; the `1.5fr / .8fr` product section with the bordered side rail; the `78px 1fr` steps; the `160px 1fr` catches; the trust row; the About block; the ≤760 and ≤560 collapses. Home has its own build path (`scripts/build-home.ts`). |
| **039** responsive conformance | Every surface at 1280 / 768 / 390 against its pack's own breakpoints — which are **not** the same three numbers (760/560, 760, 940/650, 900/620). |
| **040** cross-product convergence | Export, How and Inventory, which no pack governs and which still read at `--table`; retiring the legacy alias block in `tokens.css`; migrating the pages off `--bg` / `--ink` / `--accent`. |
| **041** final audit | Rendered comparison of all four surfaces against their packs; confirm no page-contract, lint or accessibility rule was weakened along the way. |

Also outstanding, small: IBM Plex Mono ships one face (400). The brand approves 400–500 for
the technical role, so a pack that restores a technical surface may want Mono Medium — which
means normalising `IBMPlexMono-Regular-Latin1.woff2` onto `@ibm/plex-mono@1.1.0` at the same
time, so the family is not typeset from two releases (`docs/brand/font-provenance.md`). That
is a metric change to every code block and identifier, which is why it belongs to that pack
and not to this foundation.

---

## C10 — correction 1

Three findings against the shipped foundation, all corrected at their source.

**1 — the muted ink was painting small text (MAJOR).** `--ink-3` aliased to `--muted-text`,
which is `#7B8584` on the light canvas: 3.46:1, a component colour by design and below AA as
text. Fifteen rules set text in it — a Plan row's reason, its who and when lines, a step
tile's quiet note, the Home section labels and notes, Connect's quiet text — so the light
theme's third reading level was, in production, unreadable-adjacent supporting content, and
every restoration pack would have inherited it.

The fix keeps the canonical role and adds the missing one. `mutedText` stays the owner's
value and stays a component colour (icons, dividers, the idle dot). A derived `quietText`
joins the existing derived text variants: `#626A6A` in light, mutedText darkened by the
smallest step that is AA on all four text surfaces (4.62:1 at worst); in dark the muted ink
is already 5.46:1, so `quietText` is the canonical value rather than a second one — the same
rule the state colours follow. `--ink-3` resolves to it.

The guard is new and reads the real stylesheets: `resolveColourVar()` in `tokens.ts` walks a
custom property through the alias chain to the palette role a browser would compute, and
`tokens.test.ts` takes every `color: var(...)` declared in `src/ui/app.css` and
`home/home.css` and asserts AA on all four text surfaces in both themes. Reverted to
`--muted-text` it fails with `src/ui/app.css:167: --ink-3 → mutedText on light canvas =
3.46`. The pair tests prove a role is legible; this proves the pages paint with a legible
role, which is the fact that was wrong.

**2 — the display weight was not the approved one (MAJOR).** See C4. Serif SemiBold and Bold
staged, the Serif family normalised onto one release, `ROLE_WEIGHTS.display = 700`, preloads
corrected, and `tokens.test.ts` now reads each role's approved weight out of
`brand-manifest.json` and refuses a weight with no staged, declared face.

**3 — two brand records disagreed about the current state (FUNCTIONAL).** The manifest said
palette, typography and shell logo were applied; `iamai-brand-contract.md` §12 still said all
three were the restoration pack's to do and that `tokens.ts` held the paper/ink palette, and
`ui.radiusNote` still said pack 030 *would* introduce the radius hierarchy it had already
introduced. §12 is now the current state with an applied-by column, and task 029's state is
kept below it under an explicit historical label rather than deleted. `brand.test.ts` reads
the contract's table and fails when a row disagrees with the manifest flag it names, so the
two records cannot drift apart again.

**Evidence regenerated:** `docs/screens/30` (production plates) — the palette is unchanged,
so what moved is the serif weight and the quiet text level. The canonical plates under
`docs/design/approved/rendered` are renders of the approved HTML and are untouched.

---

## C11 — correction 2

Two findings, both about the same thing said in two places: a weight requested without a face
behind it.

**1 — requested weights were still rendering through substitution (MAJOR).** Correction 1
proved the four *named* roles resolve to staged faces. It did not read what the stylesheets
actually ask for, and two rules — `.step-tile .n` and `.rung-badge` — paired
`font-family: var(--font-mono)` with a literal `font-weight: 500`. IBM Plex Mono ships one
staged face, so those numerals rendered in a substituted 400 or a synthesised medium. In the
brand visual reference the same shape appeared the other way round: `iamai-brand-system.html`
set its Serif 600 and 700 specimens against `@font-face` rules that declared only 400 and 500,
so the page a later pack reads the approved display weight off was showing the browser's
guess at it.

Fixed at both sources, and each with the guard that was missing rather than a note.
Production sets those two Mono numerals at 400: the brand approves 400–500 for the technical
role, but staging Mono Medium means normalising Mono Regular onto the same release (§C8), and
that metric change belongs to a technical-surface pack, not to a correction.
`src/ui/tokens.test.ts` now reads every rule in `src/ui/app.css` and `home/home.css` that
names a Plex family beside a weight and fails when that pair has no face in `FONT_FILES` —
the request, not the role. The brand system declares Serif 600 and 700, and
`src/brand/brand.test.ts` fails when the page sets a weight it does not declare.

**2 — the report and the brand contract carried pre-correction typography state
(FUNCTIONAL).** §C6 still said seven faces and `--weight-display` 500 while §C4 and §C10 of
the same file said nine and 700; §C8 still listed the staging of Serif SemiBold/Bold as
outstanding; `iamai-brand-contract.md` §3 still closed with 029's "did not switch production
typography over"; the brand system's caption still said Serif 600/700 are not shipped. An
engineer opening task 031 could have read any of them as current. All four now state the
corrected end state, and 029's state is kept only where it is explicitly labelled as history
(§C4, contract §12).

---

## C9 — validation

| Check | Result |
|---|---|
| `src/ui/design-authority.test.ts` (028 integrity, extended) | pass — four files, four hashes, no second copy, bytes equal the committed blob |
| `src/brand/brand.test.ts` (029 integrity, extended) | pass — palette, master, derived assets, no tagline, no font CDN, tokens agree with the brand manifest |
| `src/ui/tokens.test.ts` | pass — both palettes AA, derived text AA on all four surfaces, every `color:` the two stylesheets declare AA in both themes, every role weight in a staged face, ramp, widths, shape |
| `src/ui/design-lint.test.ts` | pass — all eight rules, three of them stricter than before |
| `src/ui/foundation.test.ts` (new) | pass — typography, widths, lockup, nav, theme, shape, print, renderer, honest manifests |
| `src/ui/accessibility.test.ts` (017) | pass |
| `npx tsc --noEmit` | clean |
| `npm test` | pass |
| `npm run build:site` | pass |
| `npm run smoke` | pass |
| `node scripts/render-design.mjs` | 12 canonical + 24 production plates |
| `git diff --check` | clean |
| `git status --short` | clean after commit |

The walk runs in CI on push (`deploy-pages`), never in a session.

# Task 031 — shared approved-design primitives

The layer between task 030's foundation and the surface restorations in packs 032–038: the
low-level visual grammar that **more than one** approved pack declares, so that no two packs
re-derive the same five declarations, and so that a pattern only one pack draws stays that
pack's.

Every label below is one of `CANONICAL REQUIREMENT`, `LANDED REPO FACT`,
`ENGINEERING IMPLEMENTATION`, `OWNER DECISION` or `UNRESOLVED`. An implementation choice is
not an owner decision merely because it landed.

**The governing rule, unchanged:** prompts define scope and safety; the canonical HTML defines
the visual result; production code defines semantic truth; branding supplies the skin. Where
this document and a canonical file disagree, the file wins.

---

## 1 — source and environment

| | |
|---|---|
| Task start HEAD | `a067921d151e323f877e08f32db511ee95df44b1` |
| Branch | `main` (worked directly on `main`, no branch, no PR, no worktree) |
| Working tree at start | clean |
| Upstream authority | `docs/design/reports/030-theme-typography-shell-foundation.md` |
| Design-authority manifest | `docs/design/approved/manifest.json` (version 2, unchanged) |
| New guard | `src/ui/primitives.test.ts` |

---

## 2 — canonical hash verification

`LANDED REPO FACT`. All four files present on `main`; every hash equals the value in the task
contract and in `docs/design/approved/manifest.json`. **Task 031 changed none of their bytes.**

| Surface | Path | SHA-256 | Verdict |
|---|---|---|---|
| Home | `docs/design/approved/home-v2.html` | `88b9a3a5…d6e55a50` | match |
| Connect | `docs/design/approved/connect-v3.html` | `903808b0…d265ee48` | match |
| Plan | `docs/design/approved/plan-step-v1.html` | `1f1bda57…d9955ad4` | match |
| MFA Readiness | `docs/design/approved/mfa-readiness-v2.html` | `12d8bdfb…c76512` | match |

`src/ui/design-authority.test.ts` already proves the hashes, the absence of a second
upload-named copy, that the working tree equals the committed git blob, and that a generated
branding preview is authority for nothing. Task 031 did not add a second copy of that check —
it re-ran it green. `src/ui/primitives.test.ts` reads the same four files for a different
question: whether a pattern is actually shared.

---

## 3 — candidate primitive inventory

Read out of the four canonical files and out of `src/ui/app.css` /
`src/ui/components/` on `main` before editing. "Occurrences" are rules in the canonical CSS,
not impressions.

| Candidate | Canonical occurrences | Production today | Same visual role? | Same behaviour? | Level | Decision |
|---|---|---|---|---|---|---|
| **D1a** eyebrow / micro-label | Home, Connect, Plan, MFA — **4/4, byte-identical** | none | yes | n/a (static) | CSS role | `SHARED_CSS_ROLE` |
| **D1b** field-key label | Plan `.side-label`, Plan `.finding .k`, MFA `.table-head` | none | yes | n/a | CSS role | `SHARED_CSS_ROLE` |
| **D1c** status pill (shape) | Plan `.badge`, MFA `.status` — identical geometry | `.chip`/`.status` flat | yes (shape) | **no** (different enums) | CSS role, geometry only | `SHARED_CSS_ROLE` |
| **D1d** dot + word | Connect `.state`+`.dot`, Plan `.row-status .dot` | `Status.tsx` + `.status::before` | yes | yes | React + CSS | `EXISTING_SHARED_PRIMITIVE_KEEP` |
| **D1e** `Chip` status colours | — | 6-value enum, **no styles at all** | — | — | — | `SEMANTIC_COMPONENT_DO_NOT_VISUALIZE_GLOBALLY` |
| **D1f** filter pill | MFA `.filter` | `FilterChip` / `.chip-select` | yes | yes | React | `EXISTING_SHARED_PRIMITIVE_KEEP` |
| **D2a** attention panel | Plan `.attention`, MFA `.callout` | `Callout.tsx`, **no CSS rule** | yes | yes | CSS role | `SHARED_CSS_ROLE` |
| **D2b** left-edge callout strip | Plan `.callout` only | none | — | — | — | `SURFACE_SPECIFIC_DEFER` → 035 |
| **D3a** metric block | Plan `.metric` (sans 18), MFA `.summary-stat .n` (serif 28) | `Tile.tsx` | **no** | no | — | `SURFACE_SPECIFIC_DEFER` → 035 / 037 |
| **D4** panel / inset / code | Plan `.card`, `.instruction`; MFA `.table-wrap`, `.summary` | `.panel`, `.panel-key`, `.surface-inset`, `.surface-code` (030) | yes | yes | CSS role | `EXISTING_SHARED_PRIMITIVE_KEEP` |
| **D5** tab / segmented strip | Plan `.action-tabs` (+ a mockup-only variant switcher) | `Tabs.tsx` / `TabList` with full ARIA | one surface | — | React | `EXISTING_SHARED_PRIMITIVE_KEEP`; visual → 035 |
| **D6** instruction / code block | Plan `.instruction` only | `pre`, `code`, `.surface-code` | one surface | — | — | `SURFACE_SPECIFIC_DEFER` → 035 |
| **D7** finding card | Plan `.finding` only | none | one surface | — | — | `SURFACE_SPECIFIC_DEFER` → 035 |
| **D8a** row separator hairline | Home `.step` + `.catch`, Connect `.step`, MFA `.row` — **4 rules, 3 surfaces** | `.surface .rows > *` | yes | yes | CSS role | `SHARED_CSS_ROLE` |
| **D8b** row column grid | four packs, **four different grids** | per-surface | **no** | no | — | `SURFACE_SPECIFIC_DEFER` → 032–038 |
| **D9** disclosure | Connect source/limits, Plan `.more` | native `details`/`summary` styling + `ExpandCard` | yes | yes | existing | `EXISTING_SHARED_PRIMITIVE_KEEP` |
| **E** `.display` role | every pack h1 + section h2 serif | role existed with **zero consumers** | — | — | CSS role | refined (see §6) |

### Classification notes

`CANONICAL REQUIREMENT` — **D1a is the strongest evidence in the task.** All four packs declare
`.eyebrow` with the same five values, byte for byte:
`color:var(--muted);font-size:11px;text-transform:uppercase;letter-spacing:.11em;font-weight:750`.
Without a shared role, five packs write it five times.

`CANONICAL REQUIREMENT` — **D2 is a name collision, not a shared component.** The Plan's
`.attention` and MFA's `.callout` are the same object (1px tone border over a tone tint at a
control radius). The Plan *also* has a `.callout` that is a 3px left-edge strip — a different
anatomy that no second surface uses. Sharing by name would have merged them; the panel is
shared and the strip is deferred to 035.

`ENGINEERING IMPLEMENTATION` — **D1c is shape without meaning.** Plan `.badge` and MFA
`.status` are geometrically identical (`999px`, `5px 8px`, `11px`, `gap:7px`, 7px dot) and
semantically unrelated: one is a rollout lifecycle badge, the other a person's readiness. So
`.pill` carries geometry and no colour, and `.status` remains the only place a state colour is
chosen (design lint rule 5). This is why D1c is a CSS role and not a `StatusBadge` component.

`ENGINEERING IMPLEMENTATION` — **D1e was deliberately not visualised.** `Chip`'s six-value enum
(`done ready blocked in-progress warning neutral`) has no CSS behind it at all: `.chip-done`
and the rest are dead classes, so the prop is inert at ~15 call sites on How and Inventory.
Giving each value a colour would mean inventing a status colour semantics for surfaces **no
canonical pack governs**, mixing rule severity, policy state and plain metadata into one visual
scale. Deferred to pack 040, which owns Export/How/Inventory. Nothing is lost today: every one
of those chips already carries its meaning as a word.

---

## 4 — shared CSS roles added

All in `src/ui/app.css` under `shared approved-design roles (task 031)`, on task 030's tokens.
No new token, no new theme, no colour or length literal.

| Role | Canonical evidence | Production translation |
|---|---|---|
| `.eyebrow` | 4/4 packs, identical | `--t-0` (11px), `--weight-strong`, `.11em`, uppercase, `--ink-3` |
| `.key-label` | Plan ×2, MFA ×1 | `--t-micro` (10px), `--weight-strong`, `.08em`, uppercase, `--ink-3` |
| `.pill` | Plan `.badge`, MFA `.status` | `999px`, `4px 9px`, `--t-0`, `gap:7px`, 1px `--rule`, **no colour** |
| `.callout` (+ 4 tones, `.callout-body`) | Plan `.attention`, MFA `.callout` | 1px tone border, `--*-soft` tint, `--radius-control`, body ink |
| `.row-group > * + *` | Home ×2, Connect, MFA | `border-top: 1px solid var(--rule)` — separator only, **no grid** |

### Two translations worth naming

`ENGINEERING IMPLEMENTATION` — the packs are dark **Inter** mockups; they own anatomy, not the
typeface or the colour (task 030's rule, not a new one). So the packs' `font-weight:750` lands
as the brand's named `--weight-strong` (IBM Plex Sans 600, a real staged face), and their
hard-coded muted ink lands as `--ink-3`.

`LANDED REPO FACT` — `--ink-3` rather than `--muted-text` because at 10–11px these roles are
**text** and must pass AA; `--muted-text` is a component colour at 3.46:1 on the light canvas.
That is task 030 correction 1, applied rather than re-litigated. `src/ui/tokens.test.ts`
measures both new roles as AA on all four text surfaces in both themes.

---

## 5 — shared React components

**Added: none.** `ENGINEERING IMPLEMENTATION` — every candidate that warranted a component
already had one (`Status`, `Chip`, `FilterChip`, `Tabs`/`TabList`, `Tile`, `Callout`,
`ExpandCard`, `DataTable`). Building a parallel set would have created the second system this
task exists to prevent.

**Changed: one, minimally.** `src/ui/components/Callout.tsx` rendered an inner
`<div className="row" style={{ alignItems: 'flex-start', flexWrap: 'nowrap' }}>`. `.row` is
declared by **no stylesheet in the product** and is used nowhere else, so both inline styles
were inert and the icon stacked above its own sentence. The phantom class and the two inline
styles are gone; the layout is now part of the `.callout` role. No prop, no behaviour and no
copy changed.

### The defect this closed

`LANDED REPO FACT` — `Callout` had **five call sites and no CSS rule**: the storage-blocked
warning (`App.tsx`), two scan warnings (`ScanProgress.tsx`), the Export grounding warning
(`Export.tsx`) and the MFA plan-context notice (`MfaReadiness.tsx`). Every one rendered as
plain body text beside a bare glyph. The most consequential is the Export bundle's privacy
warning — *"The unredacted file contains people's names and sign-in names. Once you upload it
to another tool it has left this browser."* — which is now the canonical attention panel. See
§9 for the before/after plates.

---

## 6 — the display role

`CANONICAL REQUIREMENT` — the packs resolve which headings are editorial, and they also resolve
which are **not**:

- every page `h1` is serif 700 — Home 50, Plan 42, Connect 40, MFA 38;
- every section `h2` is serif 700 — Home 29, Plan 27; and the section-level heading beside it
  (Home `.product h3`, Connect `.ready h2`) at 25;
- MFA's summary headline (24) and its counts (28) are serif;
- the **opened Plan step's `h3` is 21px in the interface face, not serif**.

`LANDED REPO FACT` — production already assigns exactly those roles: `h1`/`h2` serif at the
display weight, `h3`/`h4` sans. What it has not taken is the packs' **sizes**, because each
surface sets its own and that is page composition.

`ENGINEERING IMPLEMENTATION` — so the decision task 030 left open ("decide where `.display` is
applied") resolves as: **the role mechanism is applied; no surface's size is.** `.display` had
zero consumers and duplicated the three declarations `h1`/`h2` already carried. They are now
one declaration with `--display-size` as the single knob; `h1` sets it to `--t-6` and
`h2`/`.wave-title` to `--t-5` — the sizes production is built at today. `.display` keeps the
ramp default and the tighter `--lh-display`, and outranks the heading rule, so a heading moved
onto the ramp is leaded for the size it became. A restoration pack now moves a surface by
setting one variable.

**Nothing rendered changed:** all 24 pre-existing plates are byte-identical before and after
(§9).

`UNRESOLVED` — none. Applying a pack's actual display size is packs 032–038's, by design.

Noted for pack 035, not changed: `--d-15` (21px) sits in the *display* ramp but is the Plan
step title's **interface** size. `src/ui/tokens.ts` already says so in a comment, and
`src/ui/primitives.test.ts` now asserts the canonical file still sets it in the interface face,
so a later pack cannot quietly serif it.

---

## 7 — surface-specific candidates intentionally deferred

Each is drawn by exactly **one** pack. `src/ui/primitives.test.ts` fails two ways on each: if
it becomes a global role in `app.css`, and if the pack that owns it stops drawing it.

| Deferred | Owner |
|---|---|
| Plan finding card (`.finding`, three-up grid) | 035 |
| Plan instruction block (`.instruction`) | 035 |
| Plan Portal/JSON/PowerShell strip (`.action-tab`) | 035 |
| Plan left-edge callout strip | 035 |
| Plan roadmap row grid (`.roadmap-row`), lifecycle stage (`.stage`) | 033 / 034 |
| MFA summary stat (`.summary-stat`), filter pill (`.filter`) | 037 |
| All four row column grids | 032–038 |
| `Chip` status colour semantics | 040 |
| IBM Plex Mono Medium | a technical-surface pack (kept at 400, per contract D6) |

---

## 8 — accessibility

`src/ui/accessibility.test.ts` (task 017) and `src/ui/tokens.test.ts` re-run green.

- `:focus-visible` ring and the forced-colours outline fallback: untouched, passing.
- `prefers-reduced-motion`: untouched. No motion was added; `.pill` and `.callout` have no
  transition.
- Native disclosure semantics: untouched. No `details`/`summary` or table semantics were
  replaced with visual-only divs.
- **State is not colour-only.** `.pill` carries no colour at all, and the test asserts it. The
  callout's tone is border + tint + icon while the title and body stay at full body-ink
  contrast, so the notice reads without colour. `Status` still renders its word, asserted.
- **Small text is AA.** `.eyebrow` (11px) and `.key-label` (10px) use `--ink-3`, the derived
  quiet level, measured AA on canvas, surface, secondary surface and code surface in both
  themes by the existing guard.
- **Long tenant objects stay targeted.** `.callout-body` takes `min-width: 0` so a UPN inside a
  notice wraps within the panel instead of widening its column. Verified at 390 (§9).
- The `role="alert"` on a danger callout is unchanged.

---

## 9 — visual evidence

Renderer: `scripts/render-design.mjs`, at 1280 / 768 / 390, both themes.

```text
docs/design/approved/rendered/<surface>/{1280,768,390}.png   canonical, unchanged
docs/screens/031/<surface>-{light,dark}-{1280,768,390}.png   production, after
docs/screens/031/before-export/export-*.png                  production, before
```

**Regression proof.** Production was rendered at the base SHA and again after the change, at
all three widths in both themes. Of the 24 plates for Connect, Plan, MFA Readiness and Home,
**all 24 are byte-identical** — the display-role fold changed no rendered heading, and the new
roles have no consumer on those surfaces yet.

**The one intended difference** is Export, the only surface that renders a `Callout`
unconditionally. Its six plates differ, and only in the grounding-bundle privacy warning:
before, plain prose beside an orphaned ⚠; after, the canonical attention panel — amber border,
amber tint, icon inline with its sentence. Correct in light and dark, and contained within its
card at 390 with no overflow.

Two changes to the renderer, both mechanical:

1. `--out <dir>`, defaulting to the existing `docs/screens/30`. Without it a later pack
   overwrites the evidence its predecessor's report cites.
2. Export added to the production shot list — a renderer that cannot show a shared primitive
   cannot be the evidence for it.

`LANDED REPO FACT` — this task's plates are at `docs/screens/**031**`, not `31`:
`docs/screens/21`–`45` are the **original prompt series'** screenshots and are still tracked,
and `docs/screens/31` holds prompt 31's sixteen. A restoration pack writes to its zero-padded
number; the trap is recorded in the renderer's header, because 39 and 41–45 are occupied too.

---

## 10 — validation

| Check | Result |
|---|---|
| `src/ui/primitives.test.ts` (new, 10 tests) | pass |
| `src/ui/design-authority.test.ts` (028 integrity) | pass |
| `src/brand/brand.test.ts` (029 integrity) | pass |
| `src/ui/foundation.test.ts` (030 foundation) | pass |
| `src/ui/tokens.test.ts` | pass — including AA for both new text roles |
| `src/ui/design-lint.test.ts` | pass — all rules, one exception widened with its evidence |
| `src/ui/accessibility.test.ts` (017) | pass |
| `npx tsc --noEmit` | clean |
| `npm test` | pass — 1885 pass, 0 fail, 2 skipped (pre-existing) |
| `npm run build:site` | pass |
| `npm run smoke` | pass |
| `node scripts/render-design.mjs --production` | 30 plates |
| `git diff --check` | clean |

The walk runs in CI on push (`deploy-pages`), never in a session.

### The one lint change

`design 3` allowed `border-radius: 999px` only on `.chip-select` / `.chip-remove`. It now also
allows it on `.pill`, because both the Plan pack's `.badge` and the MFA pack's `.status` are
`999px` — a full round is not a value on the 4/8/12 shape hierarchy. The rule is not weakened:
every other radius must still be one of the three shape tokens, and the exception names its
canonical evidence.

### Are the new tests truthful?

They were checked by mutation, not just by passing. Introducing brand teal as the success tone,
giving `.pill` a state colour, and promoting the Plan-only `.finding` to a global role each
failed exactly one test — the right one.

---

## 11 — what this task did not do

No technical truth was touched: not tenant evidence, the baseline or its interpretation, CA
policy calculation, lifecycle or condition, the detected/recommended/confirmed/actionable
distinction, emergency access, canonical operations, Step Contract meaning, Plan ordering, MFA
proof/rung/population truth, session/sign-out/forget, demo fixture isolation, or Export
semantics. The four canonical HTML files and the Guided Route SVG are byte-unchanged.

No page-specific approved composition was pulled forward — Connect's contiguous flow, the
Plan's roadmap grid and expanded-step frame, MFA's integrated summary and six-zone table, and
Home's hero and side rail are all still packs 032–038's.

**No MFA rung or readiness presentation decision was made.** Task 031 changed no rung
calculation, no proof calculation, no population membership and no readiness label, and took no
view on whether a 0–5 rung should be primary, secondary, hidden or badged. That remains later
work.

No generated-preview copy, tagline or author attribution was introduced; a test asserts it.

## 12 — unresolved decisions

None. No `MANUAL_DECISION_REQUIRED` arose: every choice above was resolved by the canonical
HTML, by landed production semantics, or by task 030's established translation rule. The
choices that are genuinely subjective — each surface's display size, the `Chip` status colour
semantics, MFA rung presentation — were deferred to the pack that owns them rather than
guessed.

# IAMAI brand contract

Task 029. This is the durable record of the finished IAMAI brand: one logo, one palette,
one set of typographic roles, and the rules that keep them apart from the things they are
not allowed to move.

The machine copy of every value here is `docs/brand/brand-manifest.json`, and the visual
reference is `docs/brand/iamai-brand-system.html`. Where a sentence here and a value there
disagree, the value wins; `src/brand/brand.test.ts` fails when either drifts.

---

## 1. Authority and precedence

Brand is a skin over an anatomy.

1. **Production technical and content truth.** The engine, the pinned baseline, Graph,
   lifecycle, MFA proof, and the copy in `docs/design/content.json`. Brand never edits a
   fact.
2. **Approved HTML application architecture.** The four owner-approved packs recorded by
   task 028 in `docs/design/approved/manifest.json`:

   | Surface | File | SHA-256 |
   |---|---|---|
   | Home | [`docs/design/approved/anatomy/home-v2.html`](../design/approved/anatomy/home-v2.html) | `88b9a3a5907e78ad83f7c31dca00b86a2bdd741b9b4efca575254567d6e55a50` |
   | Connect | [`docs/design/approved/anatomy/connect-v3.html`](../design/approved/anatomy/connect-v3.html) | `903808b07210209a22d1a4f380b9e79dad95bd0e740a0fce0bb3745d265ee48b` |
   | Plan + step | [`docs/design/approved/anatomy/plan-step-v1.html`](../design/approved/anatomy/plan-step-v1.html) | `1f1bda574fc76d0cc48c7d2e7a5d26abe34d8ee0aa5fab4888282cd9955ad4ec` |
   | MFA Readiness | [`docs/design/approved/anatomy/mfa-readiness-v2.html`](../design/approved/anatomy/mfa-readiness-v2.html) | `12d8bdfbd09f82de66b732037d74da8217a79fca5cd78f12ce673eecbfc76512` |

3. **This brand skin.**

> The approved Home, Connect, Plan and MFA Readiness HTML packs own application
> architecture, composition, hierarchy, major placement, disclosure, table and row anatomy
> and responsive behaviour. Branding changes only the compatible visual skin and identity.

**Brand may change** the palette, the type family within an approved role, the logo, the
icons, radius and surface treatment where compatible, hover/press/focus appearance, and
restrained motion.

**Brand may not change** page anatomy, major composition, workflow, information hierarchy,
major component placement, disclosure structure, table and row architecture, responsive
behaviour, technical truth, or accurate production copy.

Nothing in this document, and nothing in `iamai-brand-system.html`, is an application
design authority. This file describes a skin.

### Generated branding application previews

> Application previews from branding exploration are not design authorities. Home, Connect,
> Plan, and MFA Readiness architecture is governed by the canonical approved HTML files.

Application-page previews produced while exploring the brand — a "Plan page in the new
colours", a "Connect page in the new colours" — are **colour and brand framing only**. They
are non-authoritative for layout, architecture, component placement, information hierarchy,
copy, workflow, interaction and responsive behaviour. `brand-manifest.json` records no path
for one, exactly as `docs/design/approved/manifest.json` records none: a preview is never an
entry in `surfaces`, and nothing may promote one.

---

## 2. Palette

Two themes. Every value is exact; an approximation is a different colour.

### Light — Mineral Teal

| Role | Value |
|---|---|
| canvas | `#F7F4EE` |
| surface | `#FFFDF9` |
| secondary surface | `#F0ECE5` |
| line | `#D8D3C9` |
| strong line | `#C1BCB3` |
| primary text | `#1D2528` |
| secondary text | `#4E5B5D` |
| muted text | `#7B8584` |
| brand teal | `#0C6A64` |
| secondary teal | `#18847A` |
| soft teal | `#DDEFEA` |
| teal on soft | `#07534F` |
| success | `#2C7A5A` |
| attention | `#B7791F` |
| danger | `#B04A4A` |
| admin / violet | `#6658A4` |
| code surface | `#EEEAE3` |

### Dark — Blue Slate

| Role | Value |
|---|---|
| canvas | `#0D1117` |
| surface | `#151C25` |
| secondary surface | `#111821` |
| line | `#2B3745` |
| strong line | `#39495A` |
| primary text | `#F2F5F7` |
| secondary text | `#C7D0D8` |
| muted text | `#8F9AA6` |
| brand teal | `#58C8BC` |
| secondary teal | `#78D9CE` |
| soft teal | `#173A3D` |
| teal on soft | `#DFFFF9` |
| success | `#79D7A6` |
| attention | `#E3B35B` |
| danger | `#E88A8A` |
| admin / violet | `#B9A7FF` |
| code surface | `#0A0F15` |

### Semantic separation — the rule that is easy to get wrong

**Brand teal is not success green.** Teal says *this is IAMAI*: identity, navigation,
selection, the interactive emphasis, the focus ring. Green says *the tenant is in a good
state*: proven, in place, healthy. Attention says a decision or a date is missing, danger
says something would break or is blocked, and violet says administrator scope.

A surface that paints a brand action in the success colour tells the reader something untrue
about their tenant. The two families must never be collapsed because both look green-ish.

A logo asset carries a brand colour, a monochrome value, or the app-icon pair. A logo is
never drawn in a semantic colour.

---

## 3. Typography

Three families, self-hosted. No Google Fonts, no third-party font CDN, no runtime request
to anyone: the product reads a tenant, and the page it reads it on must not phone home.
Provenance and licensing are recorded in [`font-provenance.md`](font-provenance.md).

| Role | Family | Weight |
|---|---|---|
| display, H1, major editorial heading | IBM Plex Serif | 700 |
| H2 / H3 editorial heading | IBM Plex Serif | 600–700 |
| body, interface | IBM Plex Sans | 400 |
| strong body, label, control | IBM Plex Sans | 600 |
| wordmark | IBM Plex Sans | 700 |
| technical: identifiers, JSON, PowerShell, Graph paths, code | IBM Plex Mono | 400–500 |

The *scale* — which size a heading takes on a page — belongs to the approved packs, not to
this file. Brand chooses the family and weight inside a role; it does not decide which role
a piece of the page occupies.

Italic faces are deliberately not part of the system: nothing in the product's voice needs
one, and every face shipped is a face downloaded.

Task 029 made the wordmark face available locally without switching production over. Task 030
switched it over: `src/ui/tokens.ts` sets the three families and the four role weights above,
and its correction staged IBM Plex Serif SemiBold and Bold so the display role is a real 700
rather than a synthesised one. Every weight production requests has a staged face, and
`src/ui/tokens.test.ts` fails if one does not. IBM Plex Mono ships its 400 only, so production
sets the technical role at 400; a pack that restores a technical surface may add Medium.

Typography does not compose a page; it supplies the roles a page composes with. Task 030 set
the interface scale and the display ramp, and packs 031–040 applied the ramp surface by
surface — each surface takes the rung its approved pack sets, and the three surfaces no pack
governs take the smallest page rung (task 040). §12 records what is switched on.

---

## 4. The mark — Threshold

The approved logo family is **Threshold**, variant 1, version 2. The master is
[`src/brand/logo/iamai-threshold-master.svg`](../../src/brand/logo/iamai-threshold-master.svg),
a byte-for-byte copy of the owner-approved geometry authority
[`docs/design/approved/reference/iamai-threshold-master.svg`](../design/approved/reference/iamai-threshold-master.svg)
(`sha256 0bd2591af69fbe39138134a5af12f979ba91be2735afa59b6e190e8a51551775`).

Version 1 was Guided Route — variant 2: a rounded window with a route, an origin node, a
waypoint and a destination arrow travelling through it. The owner replaced it. The record of
what it was lives in this file's history, not beside its replacement, because two marks
described as current is exactly how the wrong one gets drawn.

### Intent

```text
two panels  →  an opening between them  →  a threshold to cross
```

A doorway a tenant walks through, not a journey drawn on a map. It draws no letter and no
device.

### Topology

1. two flat filled panels, and nothing else;
2. equal panel widths — 31 units each, on a `0 0 100 100` grid;
3. an opening 38 units wide, between inner edges `x31` and `x69`;
4. the left panel slopes toward the opening: `y22` at the outer edge, `y30` at the inner;
5. the right panel is **five points**, and the fifth — `x35,y30` — is a leftward lintel
   overhang above the opening;
6. a tall outer rise on the right, from `y0` at the outer edge down to the outer bottoms at
   `y100`.

Nothing else. No stroke, no midpoint dot, no route line, no rounded frame, no shield, no
padlock, no sparkle, no gradient, no shadow.

**The critical rule.** The right panel is the five points
`(35,30) → (100,0) → (100,100) → (69,90) → (69,30)`. Removing the `(35,30)` point, or
starting that polygon at `(69,30)`, destroys the approved mark. It is the difference between
a threshold with a lintel and two unrelated slabs, and it is the one change that would still
pass every softer check — so `src/brand/brand.test.ts` counts those points.

### Master rules

`viewBox="0 0 100 100"`, two `<path>` elements, `fill="currentColor"`, no stroke. No
`<image>`, `<script>`, `<foreignObject>`, `<text>`, `<tspan>`, gradient, filter, embedded
font or external reference. It must stay readable at 16px, and it must work printed in one
colour.

The master carries a `<title>` and a `<desc>`. They name the mark for anyone who opens the
file on its own; they are not a wordmark and not a tagline, and `scripts/brandDerive.ts`
strips them from the geometry the interface draws, because that mark is `aria-hidden` beside
the live wordmark.

### The approved geometry

```svg
<svg xmlns="http://www.w3.org/2000/svg"
     viewBox="0 0 100 100"
     fill="currentColor"
     preserveAspectRatio="xMidYMid meet"
     shape-rendering="geometricPrecision">
  <title>IAMAI Threshold</title>
  <desc>Two equal-width doorway panels form an open threshold. The left panel slopes toward the opening. The right panel has a leftward upper lintel overhang, a tall outer rise, and a matching outward-descending lower edge.</desc>
  <path d="M0 22 L31 30 L31 90 L0 100 Z"/>
  <path d="M35 30 L100 0 L100 100 L69 90 L69 30 Z"/>
</svg>
```

Where prose here and this SVG disagree, the SVG wins — and where this copy and
`docs/design/approved/reference/iamai-threshold-master.svg` disagree, the approved reference
wins. The mark is installed, never redrawn: an approximation drawn by eye is the failure this
whole section exists to stop.

---

## 5. Assets and how they are made

Only the master is drawn by hand. Every other asset is written from it by
`node scripts/gen-brand.mjs`, with the derivation in `scripts/brandDerive.ts`;
`src/brand/brand.test.ts` re-derives and fails on drift. A second hand-drawn mark would be a
second authority, and the two would part company the first time one was corrected.

| Asset | Path | Colour |
|---|---|---|
| master | `src/brand/logo/iamai-threshold-master.svg` | `currentColor` |
| light theme mark | `src/brand/logo/iamai-mark-light.svg` | `#0C6A64` |
| dark theme mark | `src/brand/logo/iamai-mark-dark.svg` | `#58C8BC` |
| monochrome ink | `src/brand/logo/iamai-mark-mono-ink.svg` | `#1D2528` |
| monochrome light | `src/brand/logo/iamai-mark-mono-light.svg` | `#FFFDF9` |
| favicon / app icon | `public/brand/favicon.svg` | `#FFFDF9` on `#0C6A64` |
| 32px raster favicon | `public/brand/favicon-32.png` | as above |

### Usage

- On a light surface use the light mark; on a dark surface use the dark mark. In a themed
  interface prefer the master with `currentColor` and let the theme supply the value.
- **Monochrome**: ink on light, light on dark, at full strength. Never a tinted, screened or
  50%-opacity mark; the opening between the panels is the first thing to close up.
- **Minimum size**: 16px for the standalone mark. Below that use the app icon.
- **Header size**: 20–28px.
- **Clear space**: at least 0.35 × the mark's height on every side of the mark or the
  lockup. Nothing sits inside it.
- Do not rotate, shear, outline, add a shadow or glow, re-colour one panel, place the mark
  on a busy photograph, or redraw it. Scale it.
- The app icon is a treatment of this logo, not another logo: the same geometry, scaled to
  0.86 and drawn light on a rounded brand field so it survives browser chrome at 16px.

---

## 6. The lockup

The core lockup is exactly:

```text
[Threshold mark]  IAMAI
```

There is **no tagline**. `brand-manifest.json` records `tagline: null`. The lines produced
while generating brand concepts — `PLAN PROGRESS ACHIEVE`, `FROM HERE TO WHAT'S NEXT`,
`IDENTITY ROADMAP`, `PLAN WITH EVIDENCE`, `GUIDED PROGRESSION`,
`PEOPLE + AI + A BRIGHTER TOMORROW` — are not approved copy, are not part of the mark, and
must not appear in a logo asset's name or contents. A descriptor may join the lockup only if
a later task approves it as product or marketing copy, and never as a line under the
wordmark.

| Measure | Value |
|---|---|
| mark | 1.0× (the unit) |
| gap, mark to word | 0.25–0.32× |
| clear space around the lockup | ≥ 0.35× |
| minimum standalone mark | 16px |
| header mark | 20–28px |
| wordmark | IBM Plex Sans 700, letter-spacing 0.005em |
| alignment | the wordmark's optical centre on the mark's centre; cap height reads ≈ 0.5× the mark |

**Compose the lockup; do not export it.** A static lockup SVG that carries `<text>` renders
in whatever face the reader happens to have, so it is not self-contained and is not a
canonical asset. The product's header, and any other digital use, places the mark asset
beside the live text `IAMAI` in the locally loaded IBM Plex Sans. If a flattened lockup is
ever needed for a third party, it is generated with outlined glyphs, dated, and recorded as
a derived export — never as the master.

---

## 7. Icon language

Restrained geometric strokes: roughly 1.75–2px at ordinary interface icon sizes, round caps
and joins, no fill except where a node or a state dot is the point. Icons are drawn on a
consistent grid and inherit `currentColor`. The product's set is
`src/ui/components/Icon.tsx` (20px grid, 1.5px stroke today); a restoration pack brings its
weight into this band.

No emoji, no pictorial illustration, no duotone, no icon that states a tenant fact the page
does not.

## 8. Shape

| Element | Radius |
|---|---|
| compact row | 4px |
| control | 8px |
| deliberate grouped or key panel | 12px |

A hierarchy, **not** a licence to cardify every section. Most of IAMAI is rows and rules on a
flat surface, and it should stay that way; 12px is for the small number of panels that are
genuinely a grouped object. Task 030 applied all three
(`src/ui/tokens.ts` `LAYOUT.radiusPx` / `radiusControlPx` / `radiusPanelPx`), and
`src/ui/design-lint.test.ts` rule 3 admits a radius only through one of them.

## 9. Motion

| Element | Duration |
|---|---|
| small control: hover, press, focus, checkbox, tab | 120–180ms |
| disclosure: step expansion, panel open, row reveal | 180–240ms |

Motion is functional and tactile. It carries continuity — where a thing came from, what just
changed — and never spectacle. No looping decoration, no attention-seeking pulse, no
parallax, no animated logo.

**Reduced motion is not an afterthought.** Under `prefers-reduced-motion: reduce` every
transition above collapses to none or to an opacity change of at most 60ms. Nothing that
conveys state may depend on the animation having played.

## 10. Texture

A subtle evidence-grid may appear on marketing and brand surfaces. It never appears behind
dense operational data: a plan is read, not admired.

---

## 11. Voice

A guardrail for later copy, not a licence to rewrite what is already accurate.
`docs/design/content.json` remains the copy authority, and task 029 changed no product copy.

IAMAI is:

- informative, not chatty;
- evidence first — the number, then what it means;
- short operational verbs;
- confident only where the evidence supports confidence;
- explicit about what it does not know;
- professional.

IAMAI is not salesy, not fear-based, and never narrates itself as an AI assistant. It does
not say "I". It says what it read and what follows from it.

---

## 12. What is switched on, and by which task

This section is the current state. Task 029 owned the assets and this contract; task 030 —
the theme, typography and shell foundation — applied the palette, the type system and the
shell lockup. `docs/brand/brand-manifest.json` `production` carries the same four flags in
machine-readable form, and `src/brand/brand.test.ts` fails when the two disagree.

| | | Applied by |
|---|---|---|
| favicon / app icon | wired, both the home page and the planner | 029 |
| wordmark face available locally | yes | 029 |
| palette applied to production | yes — `src/ui/tokens.ts` holds Mineral Teal and Blue Slate, §2's values byte for byte | 030 |
| typography applied to production | yes — three families, the interface scale, the display ramp, and every role weight in a real staged face | 030 |
| shell header logo | yes — the mark asset beside the live text `IAMAI` in `src/ui/shell/AppShell.tsx` | 030 |
| page composition restored | yes — Connect (032), Plan (033–036), MFA Readiness (037) and Home (038) wear their approved anatomy, and Export, How and Inventory were converged onto the same grammar (040) | 031–040 |

**Historical, for a reader of the task-029 record:** at the end of 029 none of the last four
rows was true. `src/ui/tokens.ts` still held the paper/ink palette that shipped, the two
staged Sans faces were not declared to any browser, and the shell carried no mark. 029
deliberately stopped there, so that the palette, the typography and the anatomy would change
together against the approved packs rather than in three separate half-states.

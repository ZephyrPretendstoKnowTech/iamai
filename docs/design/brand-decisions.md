# IAMAI brand decisions

Owner-approved, September 2026 (task 028). This file is the durable record of the brand
skin. It is the source Pack 029 builds the final assets from.

Brand is a skin over an anatomy. The anatomy is owned by the four approved HTML packs in
`docs/design/approved/` (`manifest.json` names them and holds their hashes). This file
says what the skin may repaint and what it may never move.

**Production implements this palette as of task 030.** Task 028 recorded the decisions and
changed no production colour; task 029 turned them into the finished assets and the brand
contract (`docs/brand/`) and wired the favicon; task 030 applied the palette, the three type
families, the shape hierarchy and the shell lockup, and `src/ui/tokens.ts` now carries the
seventeen roles below with the values in `docs/brand/brand-manifest.json`
(`src/brand/brand.test.ts` fails when the two disagree).

What task 030 did **not** do is the anatomy: Home, Connect, Plan and MFA Readiness still do
not wear the composition of their approved packs, and
`docs/design/approved/manifest.json` still records every one of them as
`restoration-pending`. Packs 031-038 own that
(`docs/design/reports/030-theme-typography-shell-foundation.md`).

---

## 1. Palette

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
| primary brand teal | `#0C6A64` |
| secondary teal | `#18847A` |
| soft teal | `#DDEFEA` |
| teal-on-soft text | `#07534F` |
| semantic success | `#2C7A5A` |
| semantic attention | `#B7791F` |
| semantic danger | `#B04A4A` |
| semantic violet / admin | `#6658A4` |
| technical / code surface | `#EEEAE3` |

### Dark — Deep Mineral

| Role | Value |
|---|---|
| canvas | `#0E1516` |
| surface | `#151F20` |
| secondary surface | `#111A1B` |
| line | `#2A3737` |
| strong line | `#3B4B4A` |
| primary text | `#F0F4F2` |
| secondary text | `#C4CECA` |
| muted text | `#879693` |
| primary brand teal | `#59C7B7` |
| secondary teal | `#7AD9CB` |
| soft teal | `#173B37` |
| teal-on-soft text | `#D9FFF8` |
| semantic success | `#79D7A6` |
| semantic attention | `#E3B35B` |
| semantic danger | `#E88A8A` |
| semantic violet / admin | `#B9A7FF` |
| technical / code surface | `#0A1112` |

### The rule that is easy to get wrong

**Brand teal is not success green.** They are different concepts and must stay different
values. A teal control is IAMAI's; a green state means the tenant is in a good state. A
surface that paints a brand action in the success colour is telling the reader something
untrue about their tenant.

---

## 2. Typography

| Role | Family |
|---|---|
| display, headings, editorial emphasis | **IBM Plex Serif** |
| interface, body, navigation, controls | **IBM Plex Sans** |
| technical identifiers, JSON, PowerShell, Graph paths, code | **IBM Plex Mono** |

Production already ships these three families (`FONTS` in `src/ui/tokens.ts`), so the
family decision is already conformant. The **scale hierarchy** belongs to the approved
packs, not to this file: brand may change the family within a role, not which role a piece
of the page occupies.

---

## 3. Logo

**Guided Route — Variant 2** is the approved direction.

- clean rounded route/window geometry;
- a clear origin/start node near the lower-left;
- a guided rising route with a midpoint/waypoint;
- the route resolves toward an upper-right arrow/destination;
- the core lockup is the mark plus the wordmark `IAMAI`.

Generated filler lines — `PLAN PROGRESS ACHIEVE`, `From here to what's next`, or any other
AI-generated tagline — are **not** part of the core mark. A descriptor becomes part of the
lockup only if a later task approves it as product or marketing copy.

Do not substitute: shields, padlocks, brains, sparkles, literal AI glyphs, GPS pins, folded
maps, globes, or generic cyber-neon.

---

## 4. UI language

- **Iconography**: restrained stroked geometric, roughly 1.75–2px, rounded joins and caps
  where appropriate.
- **Shape hierarchy**: roughly 4px for compact rows, 8px for controls, 12px for deliberate
  grouped or key panels. This is a hierarchy, **not** a licence to cardify every section.
  (Task 030 made this the production hierarchy: `LAYOUT.radiusPx`, `radiusControlPx` and
  `radiusPanelPx` in `src/ui/tokens.ts` render `--radius`, `--radius-control` and
  `--radius-panel`, and design rule 3 in `src/ui/design-lint.test.ts` now requires a radius
  to be one of those three rather than allowing a raw px value under a growing exception
  list. The two remaining exceptions are shapes rather than sizes: 50% on a circle, 999px on
  a pill.)
- **Motion**: tactile and functional. Roughly 120–180ms for controls, 180–240ms for
  disclosure and step expansion. Motion carries state continuity and progress, never
  spectacle. Respect `prefers-reduced-motion`. No looping decorative animation.
  (Production currently has one duration, 120ms — `LAYOUT.motionMs`.)
- **Texture**: a subtle evidence-grid may be used on suitable marketing or brand surfaces
  only. Never as background noise behind dense operational content.

---

## 5. Precedence — what brand may and may not do

### Brand may change

- colour tokens;
- the actual type family within an approved role;
- logo, wordmark and favicon assets;
- icon style;
- radii, shadow and surface treatment where compatible with the approved anatomy;
- hover, press and focus appearance;
- restrained motion and transition behaviour;
- marketing-only texture.

### Brand may not override

- approved page anatomy;
- approved major layout;
- approved section relationships;
- approved information hierarchy;
- approved disclosure architecture;
- approved responsive behaviour;
- production technical truth;
- accurate product copy (`docs/design/content.json`).

> Branding may alter the colour, font, radius, hover state, or icon on an approved button.
> It may not move that button into a different workflow stage, or replace the approved
> Connect flow with unrelated tiles.

---

## 6. Generated branding previews are not page design

Application-page previews produced while exploring the brand are **brand and colour framing
only**. They are non-authoritative for page layout, architecture, component placement,
information hierarchy, product copy, workflow, interaction design and responsive behaviour.

For Home, Connect, Plan and MFA Readiness the four approved HTML packs reign in every
non-branding aspect. A preview never reinterprets a pack, and `manifest.json` records no
path for one: a preview is never an entry in `surfaces`.

---

## 7. Demo

Demo renders through production components (`src/ui/demoFacts.ts` supplies facts, not a
second interface). Demo therefore inherits the corrected presentation when production is
restored. There is no demo-specific visual design, and a branding preview is not demo
architecture.

---

The finished brand — the master mark, the derived assets, the exact values in machine-readable
form, and the visual reference — is `docs/brand/iamai-brand-contract.md`,
`docs/brand/brand-manifest.json` and `docs/brand/iamai-brand-system.html` (task 029).

See `docs/design/authority-reconciliation.md` for the forensic record of how the visual
authority drifted, and `docs/design/approved/manifest.json` for the machine-readable
authority chain.

// Design tokens: the source of truth for every colour, face, size and length
// the interface uses. src/ui/tokens.css is GENERATED from this file
// (`node scripts/gen-tokens.mjs`); tokens.test.ts fails when the two drift, and
// the design lint (design-lint.test.ts) fails on any colour literal anywhere
// else. home/theme.css is the same render with the font URLs rewritten
// (scripts/build-home.ts), so the home page and the planner cannot part.
//
// Task 030 replaced the paper/ink palette that shipped with the owner-approved
// brand: Mineral Teal in light, and in dark the palette the owner has since
// replaced with Blue Slate — exactly as recorded in
// docs/brand/brand-manifest.json (task 029). The seventeen semantic roles below
// carry the manifest's values byte for byte; brand.test.ts fails when a value
// here and a value there disagree. The light palette is untouched by the dark
// replacement: Mineral Teal is approved as it stands, and a dark repaint is not
// a reason to rebalance it.
//
// Two groups of names live in this file, and the difference matters:
//
//   1. CANONICAL. The seventeen roles the owner approved (canvas … codeSurface).
//      A value here is the manifest's value. Nothing may edit one without an
//      owner brand decision.
//   2. DERIVED. A small, bounded set production needs and the brand manifest
//      deliberately does not carry: the ink that sits ON the brand colour, the
//      two production-only ladder states, the AA-safe text variant of the
//      muted ink and of each state colour, and the soft tint of each state
//      (SOFT_TINTS). The canonical value is the fill, the dot, the border and
//      the badge; the derived value is the same colour as small text, darkened
//      in light mode only as far as WCAG AA requires. tokens.test.ts measures
//      every one of them against every surface, and against every `color:` the
//      two stylesheets actually declare, so a derived value cannot quietly stop
//      being legible.
//
// There used to be a third group. Task 030 kept the names the pages already
// read (--bg, --ink, --accent, --ok …) as `var()` references to a canonical or
// derived value, so the brand palette could land without rewriting every
// stylesheet in the same commit; each alias carried no colour of its own. Task
// 040 migrated all 329 of those references onto the canonical names and deleted
// the block, which is what it was always for. `src/ui/convergence.test.ts`
// fails if one comes back, so the product now has one name per colour.
//
// The type scale is likewise two things. `t-*` is the interface scale
// production is built on. `d-*` is the display ramp read out of the four
// approved packs in docs/design/approved/ — every serif display size those
// files actually set, so a restoration pack expresses the approved page with a
// token instead of a one-off. Task 030 creates the capability; packs 031+
// apply it.

export type Palette = {
  // ---- canonical: docs/brand/brand-manifest.json palette.<theme> ----
  /** The page. */
  canvas: string
  /** A panel, a menu, an open step. */
  surface: string
  /** A quieter panel inside a panel: a table head, an inset block. */
  secondarySurface: string
  line: string
  strongLine: string
  primaryText: string
  secondaryText: string
  /**
   * Icons, dividers, a state dot and the idle fill: a component colour, 3:1 and
   * below AA as text by design. Nothing sets a WORD in it — `quietText` is the
   * third reading level.
   */
  mutedText: string
  /** Brand identity, navigation, selected, interactive emphasis, focus. Never a tenant state. */
  brandPrimary: string
  /** Brand emphasis: hover, a secondary graphic. See brandSecondaryText for small text. */
  brandSecondary: string
  /** The brand at a tint, for a chip or a soft panel. */
  brandSoft: string
  /** Text on brandSoft. */
  brandSoftText: string
  /** Proven / in place / healthy. */
  success: string
  /** Needs a decision, a date or a check. */
  attention: string
  /** Would break something, or is blocked. */
  danger: string
  /** Administrator scope and privileged population. */
  admin: string
  /** Code, JSON, PowerShell, a Graph path. */
  codeSurface: string

  // ---- derived: production roles the brand manifest does not carry ----
  /** Text on brandPrimary. The light surface in light mode, the dark canvas in dark. */
  onBrand: string
  /**
   * The third reading level, AA on every text surface: a Plan row's reason, the
   * affected-user and date lines, a tile's quiet note, a section label. It is
   * `mutedText` as small TEXT — darkened in light mode only as far as AA needs,
   * because a reason nobody can read is not a quieter reason, it is a lost one.
   */
  quietText: string
  /** Not started, dormant, nothing to say. The muted ink, named for the state. */
  idle: string
  /** Set up, not proven: the MFA ladder's rung 2, between attention and danger. */
  unproven: string
  /** The state colours as small text, AA on canvas, surface, secondarySurface and codeSurface. */
  successText: string
  attentionText: string
  dangerText: string
  adminText: string
  unprovenText: string
  brandSecondaryText: string
}

/** Mineral Teal. The default; print always uses it. */
export const LIGHT: Palette = {
  canvas: '#F7F4EE',
  surface: '#FFFDF9',
  secondarySurface: '#F0ECE5',
  line: '#D8D3C9',
  strongLine: '#C1BCB3',
  primaryText: '#1D2528',
  secondaryText: '#4E5B5D',
  mutedText: '#7B8584',
  brandPrimary: '#0C6A64',
  brandSecondary: '#18847A',
  brandSoft: '#DDEFEA',
  brandSoftText: '#07534F',
  success: '#2C7A5A',
  attention: '#B7791F',
  danger: '#B04A4A',
  admin: '#6658A4',
  codeSurface: '#EEEAE3',

  onBrand: '#FFFDF9',
  // mutedText darkened to the smallest step that is AA on all four text
  // surfaces (4.62:1 at its worst, on the code surface).
  quietText: '#626A6A',
  idle: '#7B8584',
  unproven: '#9E5014',
  // Each darkened from its canonical value by the smallest step that reaches
  // AA on all four text surfaces; the measured ratios are in tokens.test.ts.
  successText: '#2A7456',
  attentionText: '#895B17',
  dangerText: '#A74646',
  adminText: '#6658A4',
  unprovenText: '#9E5014',
  brandSecondaryText: '#147068',
}

/** Blue Slate. */
export const DARK: Palette = {
  canvas: '#0D1117',
  surface: '#151C25',
  secondarySurface: '#111821',
  line: '#2B3745',
  strongLine: '#39495A',
  primaryText: '#F2F5F7',
  secondaryText: '#C7D0D8',
  mutedText: '#8F9AA6',
  brandPrimary: '#58C8BC',
  brandSecondary: '#78D9CE',
  brandSoft: '#173A3D',
  brandSoftText: '#DFFFF9',
  success: '#79D7A6',
  attention: '#E3B35B',
  danger: '#E88A8A',
  admin: '#B9A7FF',
  codeSurface: '#0A0F15',

  onBrand: '#0D1117',
  // On the dark canvas the muted ink is already 5.99:1 at its worst, so the
  // quiet text level is the canonical value rather than a second one.
  quietText: '#8F9AA6',
  idle: '#8F9AA6',
  unproven: '#C98A2E',
  // On a dark canvas every canonical state colour is already AA as text, so a
  // derived variant would be a second value for no reason.
  successText: '#79D7A6',
  attentionText: '#E3B35B',
  dangerText: '#E88A8A',
  adminText: '#B9A7FF',
  unprovenText: '#C98A2E',
  brandSecondaryText: '#78D9CE',
}

/** The canonical seventeen, in the order docs/brand/brand-manifest.json lists them. */
export const BRAND_ROLES = [
  'canvas',
  'surface',
  'secondarySurface',
  'line',
  'strongLine',
  'primaryText',
  'secondaryText',
  'mutedText',
  'brandPrimary',
  'brandSecondary',
  'brandSoft',
  'brandSoftText',
  'success',
  'attention',
  'danger',
  'admin',
  'codeSurface',
] as const

/** The derived roles, and why each one exists. Documented here because they are not the owner's. */
export const DERIVED_ROLES = {
  onBrand: 'text on brandPrimary',
  quietText: 'the muted ink as small text: AA, where mutedText is a component colour',
  idle: 'the dormant state; the muted ink under a state name',
  unproven: 'MFA ladder rung 2: set up, not proven',
  successText: 'success as small text',
  attentionText: 'attention as small text',
  dangerText: 'danger as small text',
  adminText: 'admin as small text',
  unprovenText: 'unproven as small text',
  brandSecondaryText: 'brandSecondary as small text',
} as const

/** The four backgrounds text is set on; every derived text role is AA on all of them. */
export const TEXT_SURFACES = ['canvas', 'surface', 'secondarySurface', 'codeSurface'] as const

/**
 * Three families, self-hosted Latin subsets under public/fonts (OFL). No
 * runtime request to a font CDN, ever: docs/brand/font-provenance.md.
 */
export const FONTS = {
  serif: "'IBM Plex Serif', Georgia, 'Times New Roman', serif",
  sans: "'IBM Plex Sans', system-ui, -apple-system, 'Segoe UI', Roboto, Arial, sans-serif",
  mono: "'IBM Plex Mono', ui-monospace, 'Cascadia Mono', Consolas, Menlo, monospace",
} as const

export const FONT_FILES = [
  { family: 'IBM Plex Serif', weight: 400, file: 'IBMPlexSerif-Regular-Latin1.woff2' },
  { family: 'IBM Plex Serif', weight: 500, file: 'IBMPlexSerif-Medium-Latin1.woff2' },
  { family: 'IBM Plex Serif', weight: 600, file: 'IBMPlexSerif-SemiBold-Latin1.woff2' },
  { family: 'IBM Plex Serif', weight: 700, file: 'IBMPlexSerif-Bold-Latin1.woff2' },
  { family: 'IBM Plex Sans', weight: 400, file: 'IBMPlexSans-Regular-Latin1.woff2' },
  { family: 'IBM Plex Sans', weight: 500, file: 'IBMPlexSans-Medium-Latin1.woff2' },
  { family: 'IBM Plex Sans', weight: 600, file: 'IBMPlexSans-SemiBold-Latin1.woff2' },
  { family: 'IBM Plex Sans', weight: 700, file: 'IBMPlexSans-Bold-Latin1.woff2' },
  { family: 'IBM Plex Mono', weight: 400, file: 'IBMPlexMono-Regular-Latin1.woff2' },
] as const

/**
 * The weights production may set. 600 and 700 arrived with task 030: the brand
 * sets the wordmark and a strong label in IBM Plex Sans, and a display heading
 * in IBM Plex Serif Bold.
 *
 * Every weight here has a real staged face in FONT_FILES. A weight without a
 * face is a browser-synthesised fake, which is not the approved brand and is
 * what `tokens.test.ts` refuses.
 */
export const WEIGHTS = [400, 500, 600, 700] as const

/** The weight a role is set in. Each one is the brand manifest's approved weight, and each has a staged face. */
export const ROLE_WEIGHTS = {
  /** Display / editorial heading, IBM Plex Serif 700 (docs/brand/brand-manifest.json typography.roles). */
  display: 700,
  /** Body, IBM Plex Sans. */
  body: 400,
  /** Strong body, label, control, IBM Plex Sans. */
  strong: 600,
  /** Wordmark, IBM Plex Sans. */
  wordmark: 700,
} as const

/** The interface scale, in px: micro · meta · small · body · h3 · lead · lead-lg · h2 · h1. */
export const TYPE = {
  /** An uppercase micro-label: a column head, a track label, a finding key. */
  't-micro': 10,
  /** An eyebrow, a hint under a count. */
  't-0': 11,
  't-1': 12,
  't-2': 13,
  't-3': 14,
  't-4': 16,
  /** A lead paragraph under a display heading. */
  't-lead': 17,
  /** The home page's lead. */
  't-lead-lg': 18,
  't-5': 20,
  't-6': 26,
} as const

/**
 * The display ramp, in px. Every value is a serif display size set by one of
 * the four approved packs in docs/design/approved/, read out of the file: the
 * ramp is the approved ramp, so a restoration pack never has to invent a size
 * or reach past the old 26px ceiling with a one-off.
 */
export const DISPLAY = {
  /** Home h1. */
  'd-1': 50,
  /** Plan h1. */
  'd-2': 42,
  /** Connect h1. */
  'd-3': 40,
  /** Home h1 at ≤760. */
  'd-4': 39,
  /** MFA Readiness h1. */
  'd-5': 38,
  /** Home h1 at ≤560; Plan h1 at ≤940. */
  'd-6': 34,
  /** Connect h1 at ≤760. */
  'd-7': 33,
  /** MFA Readiness h1 at ≤620. */
  'd-8': 31,
  /** Plan h1 at ≤650. */
  'd-9': 30,
  /** Home section h2. */
  'd-10': 29,
  /** MFA Readiness summary count. */
  'd-11': 28,
  /** Plan section h2. */
  'd-12': 27,
  /** Home h3; Connect "plan ready" h2. */
  'd-13': 25,
  /** MFA Readiness summary headline. */
  'd-14': 24,
  /** The opened Plan step's title (set in the interface face, not the display one). */
  'd-15': 21,
} as const

export const LINE_HEIGHT = { body: 1.5, heading: 1.25, display: 1.1 } as const

/**
 * The width of a surface's content column, in px, read out of its approved
 * pack. `default` is the prose page every other route keeps.
 *
 * A wide operational page is not a licence to set a paragraph 1240px wide:
 * `measureCh` and `leadPx` below are the reading measures, and they do not
 * change when the page does.
 */
export const ROUTE_WIDTHS = {
  /** docs/design/approved/anatomy/home-v2.html — min(1040px, 100% - 40px). */
  home: 1040,
  /** docs/design/approved/anatomy/connect-v3.html — min(1040px, 100% - 40px). */
  connect: 1040,
  /** docs/design/approved/anatomy/plan-step-v1.html — min(1240px, 100% - 44px). */
  plan: 1240,
  /** docs/design/approved/anatomy/mfa-readiness-v2.html — min(1200px, 100% - 40px). */
  readiness: 1200,
  // The three surfaces no approved pack governs. Task 030 left them on the
  // generic prose page and the generic table cap; task 040 gives each one a
  // route width chosen from its CONTENT ROLE, which is what this record is for.
  // These three are ENGINEERING choices, not owner decisions, and no authority
  // fixes them — but each reuses a width the product already resolves rather
  // than introducing a new number, so the surfaces converge on the system
  // instead of on four more measurements.
  /**
   * Export: prose plus wide artifact rows whose actions sit beside the words.
   * The product's existing "wider than a sentence" column, which is also what
   * Home and Connect resolve to, so Export reads as their sibling. Prose on it
   * stays capped at `--measure` / `--measure-lead`.
   */
  export: 1040,
  /** How: reference prose over six-column generated tables. The same column, for the same reason. */
  how: 1040,
  /**
   * Inventory: the densest table in the product (ten columns of tenant objects
   * on the People tab). It takes the widest column the product already uses —
   * the Plan pack's 1240 — because at 1040 half the cells wrap to two lines,
   * and an operational table is the one place the extra column is the point.
   */
  inventory: 1240,
  /** Anything else: the prose page, unchanged. */
  default: 760,
} as const

export const LAYOUT = {
  /** Body prose measure. */
  measureCh: 72,
  /** A lead paragraph under a display heading: the approved packs cap theirs between 710 and 840. */
  leadPx: 790,
  /** The default page column. */
  pagePx: ROUTE_WIDTHS.default,
  /** Tables run full width to this. */
  tablePx: 1040,
  paddingPx: 24,
  headerPx: 48,
  controlPx: 32,
  /** The shape hierarchy (docs/brand/brand-manifest.json ui.radiusPx): a compact row, a control, a key panel. */
  radiusPx: 4,
  radiusControlPx: 8,
  radiusPanelPx: 12,
  /** Tooltips and menus fade in. */
  motionMs: 120,
  /** A disclosure opens a little slower (the brand's second motion band). */
  motionDisclosureMs: 200,
} as const

/**
 * The one panel shadow, per theme. Restrained on purpose: the approved Plan
 * step lifts an opened step off the page, and nothing else in the product
 * casts a shadow except the focus ring. Dark leans on surface tone and border,
 * so its shadow is depth under a panel rather than a glow.
 */
export const PANEL_SHADOW = {
  light: '0 10px 30px rgba(29, 37, 40, 0.08)',
  dark: '0 18px 45px rgba(0, 0, 0, 0.32)',
} as const

export const FOCUS_RING = '0 0 0 2px var(--brand-primary)'

// ---- WCAG contrast helpers (pure) ----

function channel(v: number): number {
  const c = v / 255
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
}

export function luminance(hex: string): number {
  const h = hex.replace('#', '')
  const r = parseInt(h.slice(0, 2), 16)
  const g = parseInt(h.slice(2, 4), 16)
  const b = parseInt(h.slice(4, 6), 16)
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)
}

export function contrastRatio(fg: string, bg: string): number {
  const l1 = luminance(fg)
  const l2 = luminance(bg)
  const [hi, lo] = l1 > l2 ? [l1, l2] : [l2, l1]
  return (hi + 0.05) / (lo + 0.05)
}

// ---- tokens.css, rendered from the values above ----

const VAR_NAMES: Record<keyof Palette, string> = {
  canvas: '--canvas',
  surface: '--surface',
  secondarySurface: '--secondary-surface',
  line: '--line',
  strongLine: '--strong-line',
  primaryText: '--primary-text',
  secondaryText: '--secondary-text',
  mutedText: '--muted-text',
  brandPrimary: '--brand-primary',
  brandSecondary: '--brand-secondary',
  brandSoft: '--brand-soft',
  brandSoftText: '--brand-soft-text',
  success: '--success',
  attention: '--attention',
  danger: '--danger',
  admin: '--admin',
  codeSurface: '--code-surface',
  onBrand: '--on-brand',
  quietText: '--quiet-text',
  idle: '--idle',
  unproven: '--unproven',
  successText: '--success-text',
  attentionText: '--attention-text',
  dangerText: '--danger-text',
  adminText: '--admin-text',
  unprovenText: '--unproven-text',
  brandSecondaryText: '--brand-secondary-text',
}

/**
 * The soft tint of a semantic role: the fill behind a notice whose meaning is
 * carried by its border, its icon and its words. One formula, four roles, so a
 * tinted panel cannot end up mixing a different amount of a different colour on
 * each surface that draws one.
 *
 * The value is composed rather than named, which is why it is not in `Palette`:
 * the brand manifest approves `brandSoft` as a FILL a person reads text on, and
 * these are 12% washes of the state colours behind body ink. The text on top
 * stays `--primary-text` in every one of them (`.callout` in app.css), so the
 * tint never has to carry contrast.
 *
 * Until task 040 these four lived in the legacy compatibility block as
 * `--accent-soft`, `--success-soft`, `--warning-soft` and `--danger-soft` —
 * real values hiding among the aliases. The values did not change; only the
 * layer and the names did, so each is now named for the role it tints.
 */
export const SOFT_TINTS: Record<string, string> = {
  '--brand-tint': '--brand-primary',
  '--success-tint': '--success',
  '--attention-tint': '--attention',
  '--danger-tint': '--danger',
}

/** The MFA readiness ladder's colour per rung (derive/ladder.ts), each an alias of a palette colour so it follows the theme. */
export const RUNG_COLOURS: Record<string, string> = {
  '--rung-5': '--success-text',
  '--rung-4': '--brand-primary',
  '--rung-3': '--attention-text',
  '--rung-2': '--unproven-text',
  '--rung-1': '--danger-text',
  '--rung-0': '--idle',
}

/**
 * The palette role a CSS custom property resolves to, following the ladder's
 * rung names to the value a browser would compute. Returns null for a name that
 * is not a colour at all (`--pad`, `--t-3`) or that is composed rather than
 * named (a `color-mix()` soft tint).
 *
 * It exists so a test can read a `color:` out of a stylesheet and measure the
 * contrast of what the browser actually paints, instead of trusting that the
 * name it found points somewhere legible. Task 040 deleted the legacy alias
 * layer this also used to follow; the rung names remain because a rung is a
 * product meaning that maps to a palette role, not a second name for one.
 */
export function resolveColourVar(name: string): keyof Palette | null {
  const seen = new Set<string>()
  let at = name
  for (;;) {
    if (seen.has(at)) return null
    seen.add(at)
    const role = (Object.keys(VAR_NAMES) as (keyof Palette)[]).find((k) => VAR_NAMES[k] === at)
    if (role) return role
    const next = RUNG_COLOURS[at]
    if (!next) return null
    at = next
  }
}

function paletteBlock(p: Palette, indent = '  '): string {
  return (Object.keys(VAR_NAMES) as (keyof Palette)[]).map((k) => `${indent}${VAR_NAMES[k]}: ${p[k].toLowerCase()};`).join('\n')
}

function shadowLine(theme: keyof typeof PANEL_SHADOW, indent = '  '): string {
  return `${indent}--shadow-panel: ${PANEL_SHADOW[theme]};`
}

function themeBlock(p: Palette, theme: keyof typeof PANEL_SHADOW, indent = '  '): string {
  return `${paletteBlock(p, indent)}\n${shadowLine(theme, indent)}`
}

/**
 * The whole of tokens.css. Light is the default, dark via [data-theme='dark'],
 * prefers-color-scheme decides a first visit before the toggle has stored a
 * choice, print always uses light.
 */
export function renderTokensCss(): string {
  const faces = FONT_FILES.map(
    (f) => `@font-face {
  font-family: '${f.family}';
  src: url('/fonts/${f.file}') format('woff2');
  font-weight: ${f.weight};
  font-style: normal;
  font-display: swap;
}`,
  ).join('\n')
  const scale = (Object.entries(TYPE) as [string, number][]).map(([k, v]) => `  --${k}: ${v}px;`).join('\n')
  const display = (Object.entries(DISPLAY) as [string, number][]).map(([k, v]) => `  --${k}: ${v}px;`).join('\n')
  const widths = (Object.entries(ROUTE_WIDTHS) as [string, number][])
    .filter(([k]) => k !== 'default')
    .map(([k, v]) => `  --w-${k}: ${v}px;`)
    .join('\n')
  const tints = Object.entries(SOFT_TINTS)
    .map(([name, role]) => `  ${name}: color-mix(in srgb, var(${role}) 12%, var(--canvas));`)
    .join('\n')
  return `/* GENERATED from src/ui/tokens.ts by scripts/gen-tokens.mjs. Do not edit by hand:
   tokens.test.ts fails when this file and tokens.ts disagree. */

${faces}

:root {
  --font-serif: ${FONTS.serif};
  --font-sans: ${FONTS.sans};
  --font-mono: ${FONTS.mono};

  --weight-display: ${ROLE_WEIGHTS.display};
  --weight-body: ${ROLE_WEIGHTS.body};
  --weight-strong: ${ROLE_WEIGHTS.strong};
  --weight-wordmark: ${ROLE_WEIGHTS.wordmark};

${scale}
  --lh-body: ${LINE_HEIGHT.body};
  --lh-heading: ${LINE_HEIGHT.heading};
  --lh-display: ${LINE_HEIGHT.display};

  /* the display ramp, read out of the four approved packs */
${display}

  --measure: ${LAYOUT.measureCh}ch;
  --measure-lead: ${LAYOUT.leadPx}px;
  --page: ${LAYOUT.pagePx}px;
  --table: ${LAYOUT.tablePx}px;

  /* the content column each approved surface sets */
${widths}

  --pad: ${LAYOUT.paddingPx}px;
  --header: ${LAYOUT.headerPx}px;
  --control: ${LAYOUT.controlPx}px;
  --radius: ${LAYOUT.radiusPx}px;
  --radius-control: ${LAYOUT.radiusControlPx}px;
  --radius-panel: ${LAYOUT.radiusPanelPx}px;
  --motion: ${LAYOUT.motionMs}ms;
  --motion-disclosure: ${LAYOUT.motionDisclosureMs}ms;
  --focus-ring: ${FOCUS_RING};

  /* light: Mineral Teal */
${themeBlock(LIGHT, 'light')}

  /* the MFA readiness ladder: a colour per rung, from the palette */
${Object.entries(RUNG_COLOURS)
  .map(([k, v]) => `  ${k}: var(${v});`)
  .join('\n')}
}

@media (prefers-color-scheme: dark) {
  :root:not([data-theme]) {
${themeBlock(DARK, 'dark', '    ')}
  }
}

:root[data-theme='dark'] {
${themeBlock(DARK, 'dark')}
}

@media print {
  :root,
  :root[data-theme='dark'] {
${themeBlock(LIGHT, 'light', '    ')}
  }
}

/* The soft tint of each semantic role: one formula, four roles. Composed from
   the theme's own values, so it follows light, dark and print with them. */
:root {
${tints}
}
`
}

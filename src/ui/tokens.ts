// Design tokens v3 (prompt 47 Part 1): the source of truth for every colour,
// face, size and length the interface uses. src/ui/tokens.css is GENERATED
// from this file (`node scripts/gen-tokens.mjs`); tokens.test.ts fails when
// the two drift, and the design lint (design-lint.test.ts) fails on any colour
// literal anywhere else.
//
// The product is a document people read, print and execute from: paper in
// light mode, ink on charcoal in dark mode. No gradients, shadows, glows,
// blur or opacity on text. The focus ring is the only box-shadow. Pure.

export type Palette = {
  /** The page. */
  bg: string
  /** An open step, tooltips, menus. */
  bgRaised: string
  /** Code, inputs. */
  bgInset: string
  ink: string
  ink2: string
  /** Icons and the idle state only: below AA for text on either page (4.4:1 light, 4.1:1 dark). */
  ink3: string
  rule: string
  ruleStrong: string
  accent: string
  onAccent: string
  ok: string
  wait: string
  stop: string
  idle: string
}

/** Paper. The default; print always uses it. */
export const LIGHT: Palette = {
  bg: '#FBF9F5',
  bgRaised: '#F4F1EA',
  bgInset: '#EDE9E0',
  ink: '#1B1B1B',
  ink2: '#55554F',
  ink3: '#767670',
  rule: '#E3DFD6',
  ruleStrong: '#C9C4B8',
  accent: '#0B5B57',
  onAccent: '#FBF9F5',
  ok: '#2F6B4F',
  wait: '#8A5A0B',
  stop: '#9B2C2C',
  idle: '#8A8A83',
}

/** Ink on charcoal. Neutral, never navy. */
export const DARK: Palette = {
  bg: '#15171A',
  bgRaised: '#1D2024',
  bgInset: '#24282D',
  ink: '#ECEAE4',
  ink2: '#A7A59D',
  ink3: '#7A7871',
  rule: '#2C3036',
  ruleStrong: '#3D4249',
  accent: '#5FB8B0',
  onAccent: '#0F1214',
  ok: '#7BC9A0',
  wait: '#E0B25C',
  stop: '#E28B8B',
  idle: '#7A7871',
}

/** Three families, self-hosted Latin subsets under public/fonts (OFL). Two weights: 400 and 500. */
export const FONTS = {
  serif: "'IBM Plex Serif', Georgia, 'Times New Roman', serif",
  sans: "'IBM Plex Sans', system-ui, -apple-system, 'Segoe UI', Roboto, Arial, sans-serif",
  mono: "'IBM Plex Mono', ui-monospace, 'Cascadia Mono', Consolas, Menlo, monospace",
} as const

export const FONT_FILES = [
  { family: 'IBM Plex Serif', weight: 400, file: 'IBMPlexSerif-Regular-Latin1.woff2' },
  { family: 'IBM Plex Serif', weight: 500, file: 'IBMPlexSerif-Medium-Latin1.woff2' },
  { family: 'IBM Plex Sans', weight: 400, file: 'IBMPlexSans-Regular-Latin1.woff2' },
  { family: 'IBM Plex Sans', weight: 500, file: 'IBMPlexSans-Medium-Latin1.woff2' },
  { family: 'IBM Plex Mono', weight: 400, file: 'IBMPlexMono-Regular-Latin1.woff2' },
] as const

/** The scale, in px: meta · small · body · h3 · h2 · h1. */
export const TYPE = { 't-1': 12, 't-2': 13, 't-3': 14, 't-4': 16, 't-5': 20, 't-6': 26 } as const
export const LINE_HEIGHT = { body: 1.5, heading: 1.25 } as const
export const WEIGHTS = [400, 500] as const

export const LAYOUT = {
  /** Prose measure. */
  measureCh: 72,
  /** The page column. */
  pagePx: 760,
  /** Tables run full width to this. */
  tablePx: 1040,
  paddingPx: 24,
  headerPx: 48,
  controlPx: 32,
  /** Radius on a control; everything else is square. */
  radiusPx: 4,
  /** Tooltips and menus fade in; nothing else moves. */
  motionMs: 120,
} as const

export const FOCUS_RING = '0 0 0 2px var(--accent)'

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
  bg: '--bg',
  bgRaised: '--bg-raised',
  bgInset: '--bg-inset',
  ink: '--ink',
  ink2: '--ink-2',
  ink3: '--ink-3',
  rule: '--rule',
  ruleStrong: '--rule-strong',
  accent: '--accent',
  onAccent: '--on-accent',
  ok: '--ok',
  wait: '--wait',
  stop: '--stop',
  idle: '--idle',
}

function paletteBlock(p: Palette, indent = '  '): string {
  return (Object.keys(VAR_NAMES) as (keyof Palette)[]).map((k) => `${indent}${VAR_NAMES[k]}: ${p[k].toLowerCase()};`).join('\n')
}

/**
 * The whole of tokens.css. Light is the default, dark via [data-theme='dark'],
 * prefers-color-scheme decides a first visit before the toggle has stored a
 * choice, print always uses light. The legacy bridge at the end maps the v2
 * names styles.css still reads onto the v3 palette; it goes with styles.css in
 * prompt 49.
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
  return `/* GENERATED from src/ui/tokens.ts by scripts/gen-tokens.mjs. Do not edit by hand:
   tokens.test.ts fails when this file and tokens.ts disagree. */

${faces}

:root {
  --font-serif: ${FONTS.serif};
  --font-sans: ${FONTS.sans};
  --font-mono: ${FONTS.mono};

${scale}
  --lh-body: ${LINE_HEIGHT.body};
  --lh-heading: ${LINE_HEIGHT.heading};

  --measure: ${LAYOUT.measureCh}ch;
  --page: ${LAYOUT.pagePx}px;
  --table: ${LAYOUT.tablePx}px;
  --pad: ${LAYOUT.paddingPx}px;
  --header: ${LAYOUT.headerPx}px;
  --control: ${LAYOUT.controlPx}px;
  --radius: ${LAYOUT.radiusPx}px;
  --motion: ${LAYOUT.motionMs}ms;
  --focus-ring: ${FOCUS_RING};

  /* light: paper */
${paletteBlock(LIGHT)}
}

@media (prefers-color-scheme: dark) {
  :root:not([data-theme]) {
${paletteBlock(DARK, '    ')}
  }
}

:root[data-theme='dark'] {
${paletteBlock(DARK)}
}

@media print {
  :root,
  :root[data-theme='dark'] {
${paletteBlock(LIGHT, '    ')}
  }
}

/* Legacy bridge: the v2 names styles.css and src/ui/pages still read, mapped
   onto the v3 palette so the old pages keep working inside the new shell until
   prompt 49 deletes them together with this block. No new colour is introduced
   here; the soft backgrounds are the palette mixed with the page. */
:root {
  --font-display: var(--font-serif);
  --text-xl: var(--t-6);
  --text-lg: var(--t-5);
  --text-md: var(--t-4);
  --text-base: var(--t-3);
  --text-sm: var(--t-2);
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-5: 24px;
  --space-6: 32px;
  --space-7: 48px;
  --radius-card: 0;
  --radius-input: var(--radius);
  --radius-chip: var(--radius);
  --max-content: var(--table);
  --max-content-wide: var(--table);
  --gutter: var(--pad);
  --shadow-1: none;
  --motion-rise: var(--motion);
  --surface: var(--bg-raised);
  --raised: var(--bg-inset);
  --border: var(--rule-strong);
  --border-control: var(--rule-strong);
  --text: var(--ink);
  --muted: var(--ink-2);
  --accent-hover: var(--accent);
  --accent-ink: var(--on-accent);
  --success: var(--ok);
  --warning: var(--wait);
  --danger: var(--stop);
  --info: var(--accent);
  --focus: var(--accent);
  --accent-soft: color-mix(in srgb, var(--accent) 12%, var(--bg));
  --success-soft: color-mix(in srgb, var(--ok) 12%, var(--bg));
  --warning-soft: color-mix(in srgb, var(--wait) 12%, var(--bg));
  --danger-soft: color-mix(in srgb, var(--stop) 12%, var(--bg));
  --info-soft: color-mix(in srgb, var(--accent) 12%, var(--bg));
  --past: var(--ink-2);
  --past-soft: color-mix(in srgb, var(--ink-2) 12%, var(--bg));
  --present: var(--accent);
  --present-soft: var(--accent-soft);
  --future: var(--accent);
  --future-soft: var(--accent-soft);
}
`
}

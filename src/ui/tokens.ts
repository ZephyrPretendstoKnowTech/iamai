// Design tokens v2 (prompt 08, ux-review-01 §4) — the source of truth. The
// CSS custom properties in tokens.css mirror these values; the contrast test
// reads this file so both themes stay WCAG AA.

export type Palette = {
  bg: string
  surface: string
  raised: string
  border: string
  text: string
  muted: string
  accent: string
  accentHover: string
  accentInk: string
  success: string
  warning: string
  danger: string
  info: string
  focus: string
  /** Alpha of the *-soft overlays (tokens.css). */
  softAlpha: number
}

export const DARK: Palette = {
  bg: '#0A1220',
  surface: '#0F182B',
  raised: '#152038',
  border: '#22304A',
  text: '#E6EDF7',
  muted: '#8FA3BF',
  accent: '#2DD4BF',
  accentHover: '#5EEAD4',
  accentInk: '#04221E',
  success: '#22C55E',
  warning: '#F5B301',
  danger: '#F04E4E',
  info: '#60A5FA',
  focus: 'rgba(94, 234, 212, 0.6)',
  softAlpha: 0.12,
}

// Light status colours are the dark ones darkened ~10% for contrast on white.
export const LIGHT: Palette = {
  bg: '#F6F8FB',
  surface: '#FFFFFF',
  raised: '#F1F5F9',
  border: '#DCE3EE',
  text: '#0F172A',
  muted: '#5B6B82',
  // Prompt 08 lists #0F9F8F, which gives 3.3:1 against white ink — below the
  // AA text floor the same prompt requires. Darkened until white ink passes.
  accent: '#0B7F72',
  accentHover: '#095F55',
  accentInk: '#FFFFFF',
  success: '#15803D',
  warning: '#B45309',
  danger: '#C62828',
  info: '#1D4ED8',
  focus: 'rgba(15, 159, 143, 0.6)',
  softAlpha: 0.1,
}

export const TYPE = { xl: 30, lg: 22, md: 17, base: 15, sm: 13 } as const
export const SPACE = [4, 8, 12, 16, 24, 32, 48] as const
export const RADIUS = { card: 12, input: 8, chip: 999 } as const
export const MAX_CONTENT_WIDTH = 1100

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

// ---- Button states (prompt 19 §A1) ----
// Every variant keeps its own ink in every state; styles.css mirrors this
// table with explicit `color` on the hover/active/focus rules so the global
// `a:hover` colour can never win on a LinkButton. The soft backgrounds are
// the accent at softAlpha over the surface, composited here so the test sees
// real colours.

export type ButtonVariant = 'primary' | 'secondary' | 'quiet'
export type ButtonState = 'default' | 'hover' | 'active' | 'focus' | 'disabled'
export const BUTTON_VARIANTS: ButtonVariant[] = ['primary', 'secondary', 'quiet']
export const BUTTON_STATES: ButtonState[] = ['default', 'hover', 'active', 'focus', 'disabled']

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '')
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]
}

/** Composite `top` at `alpha` over `under`; both opaque hex. */
export function blend(top: string, alpha: number, under: string): string {
  const t = hexToRgb(top)
  const u = hexToRgb(under)
  const mix = t.map((c, i) => Math.round(c * alpha + u[i] * (1 - alpha)))
  return '#' + mix.map((c) => c.toString(16).padStart(2, '0')).join('').toUpperCase()
}

export function buttonColours(p: Palette, variant: ButtonVariant, state: ButtonState): { text: string; background: string } {
  const hovered = state === 'hover' || state === 'active'
  if (variant === 'primary') return { text: p.accentInk, background: hovered ? p.accentHover : p.accent }
  if (variant === 'quiet') {
    // The soft overlay lightens the surface just enough that the plain accent
    // drops under 4.5:1 in the light theme; hovered ink darkens to match.
    return hovered ? { text: p.accentHover, background: blend(p.accent, p.softAlpha, p.surface) } : { text: p.accent, background: p.surface }
  }
  return { text: p.text, background: p.surface }
}

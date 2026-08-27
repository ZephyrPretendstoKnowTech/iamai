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

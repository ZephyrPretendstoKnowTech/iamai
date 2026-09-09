// Every IAMAI brand asset is derived from one file (task 029).
//
// src/brand/logo/iamai-threshold-master.svg is the master Threshold mark:
// vector geometry, one colour source (`currentColor`), no text, no raster, no
// gradient, no external reference. Everything else in the brand — the theme
// marks, the monochrome marks, the favicon/app icon and the raster derived
// from it — is written from that file by `node scripts/gen-brand.mjs`.
// src/brand/brand.test.ts re-derives here and fails when a committed asset
// differs, the way tokens.test.ts holds tokens.css to tokens.ts.
//
// Deriving rather than hand-drawing is the point: a second hand-drawn mark is
// a second authority, and the two drift the moment one of them is corrected.
// The master here is a byte-for-byte copy of the owner-approved reference
// master, docs/design/approved/reference/iamai-threshold-master.svg — the mark
// is installed, never redrawn.

/** The master. The only file in the brand a person edits by hand. */
export const MASTER = 'src/brand/logo/iamai-threshold-master.svg'

/**
 * The brand values a logo asset may carry, from docs/brand/brand-manifest.json
 * (light `brandPrimary`, dark `brandPrimary`, light `primaryText`, light
 * `surface`). Semantic colours are never a logo colour: the mark is brand, not
 * a tenant state.
 */
export const MARK_COLORS = {
  light: '#0C6A64',
  dark: '#58C8BC',
  monoInk: '#1D2528',
  monoLight: '#FFFDF9',
} as const

/**
 * The app-icon field, and the mark drawn on it. `radius` and `scale` are
 * fractions of the master's own grid, so the icon follows the master rather
 * than pinning a number that was only ever true on the 64 grid.
 */
export const APP_ICON = { field: '#0C6A64', mark: '#FFFDF9', radiusRatio: 14 / 64, scale: 0.86 } as const

/** Line endings are not identity: git may hand back CRLF on Windows. */
export const normalise = (svg: string): string => svg.replace(/\r\n/g, '\n')

/** The grid the master is drawn on, read out of the master rather than assumed. */
export function viewBox(master: string): string {
  const m = normalise(master).match(/viewBox="([^"]+)"/)
  if (!m) throw new Error(`${MASTER} has no viewBox`)
  return m[1]
}

/** The width and height of that grid. */
export function grid(master: string): { width: number; height: number } {
  const [, , w, h] = viewBox(master).split(/\s+/).map(Number)
  return { width: w, height: h }
}

/**
 * The master's drawable geometry: no <svg> wrapper, and no <title>/<desc>.
 * The accessible name belongs to the master FILE, which a person may open on
 * its own; the interface draws this geometry inside an `aria-hidden` mark
 * beside the live wordmark, where a title element would only be a tooltip.
 */
export function geometry(master: string): string {
  return normalise(master)
    .replace(/^[\s\S]*?<svg[^>]*>\n?/, '')
    .replace(/<\/svg>\s*$/, '')
    .replace(/[ \t]*<(title|desc)\b[\s\S]*?<\/\1>\n?/g, '')
    .replace(/\s+$/, '')
}

/** The master in one fixed colour: the same geometry, no `currentColor` to inherit. */
export function tinted(master: string, hex: string): string {
  return normalise(master).replace(/currentColor/g, hex)
}

/**
 * The favicon/app icon: the same mark, drawn light on a rounded brand field.
 * A transparent single-colour mark disappears into browser chrome at 16px;
 * the field is a treatment of this logo, never a second logo, so the geometry
 * comes from the master and only the colour and the scale change.
 */
export function appIcon(master: string): string {
  const { width, height } = grid(master)
  const inner = geometry(master)
    .split('\n')
    .map((line) => (line.trim() === '' ? line : `  ${line}`))
    .join('\n')
  const rx = Math.round(width * APP_ICON.radiusRatio)
  const cx = width / 2
  const cy = height / 2
  // The colour sits on the group rather than on each shape: the master's own
  // colour source is the `fill="currentColor"` on its <svg> element, which the
  // geometry above does not carry, so the icon has to supply one itself.
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox(master)}">`,
    `  <rect width="${width}" height="${height}" rx="${rx}" fill="${APP_ICON.field}"/>`,
    `  <g fill="${APP_ICON.mark}" transform="translate(${cx} ${cy}) scale(${APP_ICON.scale}) translate(-${cx} -${cy})">`,
    inner,
    '  </g>',
    '</svg>',
    '',
  ].join('\n')
}

/**
 * The master's geometry as a module the interface imports, so the application
 * shell draws the master rather than a second mark of its own. The lockup is
 * composed at use — this geometry beside the live text IAMAI in IBM Plex Sans —
 * because an exported lockup carrying <text> renders in the wrong face wherever
 * the font is not installed (docs/brand/brand-manifest.json logo.wordmark).
 */
export function markModule(master: string): string {
  return `// GENERATED from ${MASTER} by scripts/gen-brand.mjs. Do not edit by hand:
// src/brand/brand.test.ts re-derives this file from the master and fails on drift.
//
// The Threshold mark's geometry, one \`currentColor\` so it takes the theme.
// src/ui/components/Mark.tsx is the only thing that renders it.
export const MARK_VIEWBOX = '${viewBox(master)}'
export const MARK_GEOMETRY = ${JSON.stringify(geometry(master))}
`
}

/** Every committed asset that is a function of the master, and the function. */
export function derived(master: string): { path: string; content: string }[] {
  return [
    { path: 'src/brand/logo/iamai-mark-light.svg', content: tinted(master, MARK_COLORS.light) },
    { path: 'src/brand/logo/iamai-mark-dark.svg', content: tinted(master, MARK_COLORS.dark) },
    { path: 'src/brand/logo/iamai-mark-mono-ink.svg', content: tinted(master, MARK_COLORS.monoInk) },
    { path: 'src/brand/logo/iamai-mark-mono-light.svg', content: tinted(master, MARK_COLORS.monoLight) },
    { path: 'public/brand/favicon.svg', content: appIcon(master) },
    { path: 'src/brand/logo/mark.ts', content: markModule(master) },
  ]
}

/** The raster derived from the favicon, and the size the file must be. */
export const RASTER = { from: 'public/brand/favicon.svg', path: 'public/brand/favicon-32.png', size: 32 } as const

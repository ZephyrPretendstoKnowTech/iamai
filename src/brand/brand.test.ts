// The brand-integrity guard (task 029).
//
// The brand is a small number of exact facts — one master mark, two palettes,
// three type families, no tagline — and every one of them is the kind of fact
// that decays quietly. A hex drifts by one digit in a restyle; a derived asset
// is hand-edited and the master is not; a generated strapline becomes a
// tagline because nobody said it could not; a font is switched to a CDN for
// convenience and the product starts telling Google who is reading a tenant.
//
// So this file asserts the values rather than the vibe. It re-derives every
// asset from the master the way tokens.test.ts re-renders tokens.css, holds
// docs/brand/brand-manifest.json to the owner's palette written out here, and
// holds the brand to task 028's application-design authority instead of
// letting a brand document quietly become a page design.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { APP_ICON, MARK_COLORS, MASTER, RASTER, derived, geometry, normalise } from '../../scripts/brandDerive.ts'
import { BRAND_ROLES, DARK as TOKENS_DARK, LIGHT as TOKENS_LIGHT } from '../ui/tokens.ts'

const MANIFEST = 'docs/brand/brand-manifest.json'
const CONTRACT = 'docs/brand/iamai-brand-contract.md'
const SYSTEM = 'docs/brand/iamai-brand-system.html'
const PROVENANCE = 'docs/brand/font-provenance.md'
/** The owner-approved geometry the production master is a copy of. */
const APPROVED_MASTER = 'docs/design/approved/reference/iamai-threshold-master.svg'

const read = (p: string) => normalise(readFileSync(p, 'utf8'))
const manifest = () => JSON.parse(readFileSync(MANIFEST, 'utf8')) as Manifest
const master = () => read(MASTER)

type Hexes = Record<string, string>
type Manifest = {
  schema: string
  version: number
  brand: { name: string; tagline: null; forbiddenTaglines: string[] }
  logo: {
    family: string
    variant: number
    version: number
    coreLockup: string
    topology: string[]
    master: string
    wordmark: { text: string; family: string; weight: number; minimumMarkPx: number; descriptorUnderWordmark: boolean }
    assets: Record<string, string>
    assetColors: Record<string, string>
    approvedReferenceMasterSha256: string
    geometry: {
      viewBox: string
      leftPanelPath: string
      rightPanelPath: string
      columnWidth: number
      doorwayInnerLeftX: number
      doorwayInnerRightX: number
      doorwayWidth: number
      lintelTipX: number
    }
  }
  palette: { light: Hexes; dark: Hexes }
  semantics: { brandPrimaryIsSuccess: boolean }
  typography: { families: Record<string, string>; roles: { role: string; family: string; weight: number | number[] }[]; remoteFontCdn: boolean; appliedToProduction: boolean }
  applicationDesignAuthority: { surfaces: { surface: string; path: string; sha256: string }[]; precedence: string[] }
  generatedBrandApplicationPreviews: Record<string, unknown>
  ui: { radiusPx: Record<string, number>; motionMs: Record<string, number[]> }
  documents: Record<string, string>
  production: Record<string, boolean | string>
}

/**
 * The owner's palette, written out here rather than read from the manifest: a
 * guard that took its expectations from the file it guards would pass on any
 * self-consistent rewrite. Light is Mineral Teal, unchanged since task 029.
 * Dark is Blue Slate, which replaced Deep Mineral; the current approved
 * appearance is docs/design/approved/reference/.
 */
const LIGHT: Hexes = {
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
}
const DARK: Hexes = {
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
}

/** Task 028's four approved application authorities, by name and by bytes. */
const APPROVED = [
  { surface: 'home', path: 'docs/design/approved/anatomy/home-v2.html', sha256: '88b9a3a5907e78ad83f7c31dca00b86a2bdd741b9b4efca575254567d6e55a50' },
  { surface: 'connect', path: 'docs/design/approved/anatomy/connect-v3.html', sha256: '903808b07210209a22d1a4f380b9e79dad95bd0e740a0fce0bb3745d265ee48b' },
  { surface: 'plan', path: 'docs/design/approved/anatomy/plan-step-v1.html', sha256: '43de0a7cb9eae37ddf08eeebd829dcd13ed00200ca42e412cbbbfb875df6ae39' },
  { surface: 'mfa-readiness', path: 'docs/design/approved/anatomy/mfa-readiness-v2.html', sha256: '12d8bdfbd09f82de66b732037d74da8217a79fca5cd78f12ce673eecbfc76512' },
] as const

/** Lines generated while exploring the brand. None of them is IAMAI's. */
const NOT_TAGLINES = [
  'PLAN PROGRESS ACHIEVE',
  "FROM HERE TO WHAT'S NEXT",
  'IDENTITY ROADMAP',
  'PLAN WITH EVIDENCE',
  'GUIDED PROGRESSION',
  'PEOPLE + AI + A BRIGHTER TOMORROW',
]

// ---------------------------------------------------------------- the master

test('brand: the master mark is where the manifest says, on the 100 grid, and is the approved bytes', () => {
  assert.ok(existsSync(MASTER), `${MASTER} is missing: the brand has no master`)
  assert.equal(manifest().logo.master, MASTER)
  assert.match(master(), /viewBox="0 0 100 100"/, 'the master is drawn on a 0 0 100 100 grid')
  // The mark is INSTALLED from the owner's approved reference, never redrawn:
  // an approximation drawn by eye is the one failure this whole file exists to
  // stop, and it is exactly what a prose description of a logo invites.
  assert.equal(read(MASTER), read(APPROVED_MASTER), `${MASTER} is not byte-for-byte ${APPROVED_MASTER}`)
  const sha = createHash('sha256').update(readFileSync(APPROVED_MASTER)).digest('hex')
  assert.equal(manifest().logo.approvedReferenceMasterSha256, sha, 'the manifest records a different hash for the approved master')
})

test('brand: the master carries nothing but vector geometry', () => {
  const svg = master()
  for (const [what, re] of [
    ['a raster image', /<image\b/i],
    ['a script', /<script\b/i],
    ['a foreignObject', /<foreignObject\b/i],
    ['a gradient', /<(linear|radial)Gradient\b/i],
    ['a filter', /<filter\b|filter\s*=/i],
    ['a mask or clip path', /<(mask|clipPath)\b/i],
    ['an embedded font', /@font-face|<style\b/i],
    ['a style attribute', /\sstyle=/i],
  ] as const) {
    assert.doesNotMatch(svg, re, `the master must not contain ${what}`)
  }
  // No external resource of any kind: no href, no url(), no xlink.
  assert.doesNotMatch(svg, /\shref=|xlink:href|url\(/i, 'the master must not reference anything outside itself')
  // http(s) may appear only in the SVG namespace declaration.
  assert.deepEqual(
    [...svg.matchAll(/https?:\/\/[^\s"']+/g)].map((m) => m[0]),
    ['http://www.w3.org/2000/svg'],
    'the only URL in the master is its namespace',
  )
})

test('brand: the master carries no wordmark and no tagline', () => {
  const svg = master()
  for (const re of [/<text\b/i, /<tspan\b/i]) {
    assert.doesNotMatch(svg, re, 'the mark is geometry; the wordmark is live text set beside it')
  }
  // <title> and <desc> name the file for anyone who opens it on its own. They
  // are not a wordmark and not a tagline, and they never reach the interface:
  // scripts/brandDerive.ts strips them from the geometry the shell draws.
  assert.doesNotMatch(geometry(svg), /<title\b|<desc\b/i, 'the drawn geometry carries no metadata element')
  const words = svg.replace(/<(title|desc)\b[\s\S]*?<\/\1>/g, '').replace(/<[^>]*>/g, '').trim()
  assert.equal(words, '', 'the master renders no text of its own')
})

test('brand: the master is one colour source, and that source is themeable', () => {
  const svg = master()
  assert.match(svg, /currentColor/, 'the master inherits its colour')
  const literals = [...svg.matchAll(/#[0-9a-f]{3,8}\b/gi)].map((m) => m[0])
  assert.deepEqual(literals, [], 'the master hard-codes no colour; the derivatives carry the values')
})

test('brand: the mark still has its topology — two equal panels and the lintel overhang', () => {
  // Optical refinement is expected and allowed; a redesign is not. If this
  // fails because the mark genuinely changed family or shape, the manifest's
  // logo.version has to move with it.
  const svg = master()
  assert.equal([...svg.matchAll(/<path\b/g)].length, 2, 'two doorway panels: two paths')
  assert.equal([...svg.matchAll(/<circle\b|<rect\b|<line\b|<polygon\b/g)].length, 0, 'no dot, no route line, no frame')
  assert.doesNotMatch(svg, /stroke/i, 'two flat filled shapes; nothing is stroked')

  const { logo } = manifest()
  assert.equal(logo.family, 'Threshold')
  assert.equal(logo.variant, 1)
  assert.equal(logo.version, 2, 'the mark changed family, so the version moved with it')
  assert.equal(logo.topology.length, 6, 'the six-part topology the contract names')

  // The exact geometry. The right panel's five points ARE the mark: dropping
  // the x35,y30 lintel tip, or starting that polygon at x69,y30, is a different
  // logo that would still pass every softer check above.
  const g = logo.geometry
  const paths = [...svg.matchAll(/ d="([^"]+)"/g)].map((m) => m[1])
  assert.deepEqual(paths, [g.leftPanelPath, g.rightPanelPath], 'the master draws the recorded paths, in order')
  assert.equal(g.leftPanelPath, 'M0 22 L31 30 L31 90 L0 100 Z')
  assert.equal(g.rightPanelPath, 'M35 30 L100 0 L100 100 L69 90 L69 30 Z')
  assert.equal(g.viewBox, '0 0 100 100')
  const points = (d: string) => (d.match(/[ML]\s*-?[\d.]+\s+-?[\d.]+/g) ?? []).length
  assert.equal(points(g.rightPanelPath), 5, 'the right panel is five points, and the fifth is the lintel')
  assert.equal(points(g.leftPanelPath), 4)
  // Both columns are the same width, and the opening between them is the rest.
  assert.equal(g.doorwayInnerLeftX, g.columnWidth, 'the left column is columnWidth wide')
  assert.equal(100 - g.doorwayInnerRightX, g.columnWidth, 'the right column is the same width')
  assert.equal(g.doorwayWidth, g.doorwayInnerRightX - g.doorwayInnerLeftX)
  assert.ok(g.lintelTipX < g.doorwayInnerRightX, 'the lintel tip overhangs leftward, into the opening')
  assert.equal(g.lintelTipX, 35)
})

// ------------------------------------------------------------- the derivatives

test('brand: every derived asset is exactly what the master derives to', () => {
  for (const { path, content } of derived(master())) {
    assert.ok(existsSync(path), `${path} is missing: run node scripts/gen-brand.mjs`)
    assert.equal(
      read(path),
      content,
      `${path} is not what the master derives to. It was hand-edited, or the master moved without ` +
        'the assets: run node scripts/gen-brand.mjs.',
    )
  }
})

test('brand: the light, dark and monochrome marks carry the right values', () => {
  const wanted = {
    'src/brand/logo/iamai-mark-light.svg': MARK_COLORS.light,
    'src/brand/logo/iamai-mark-dark.svg': MARK_COLORS.dark,
    'src/brand/logo/iamai-mark-mono-ink.svg': MARK_COLORS.monoInk,
    'src/brand/logo/iamai-mark-mono-light.svg': MARK_COLORS.monoLight,
  }
  assert.equal(MARK_COLORS.light, LIGHT.brandPrimary, 'the light mark is the light brand teal')
  assert.equal(MARK_COLORS.dark, DARK.brandPrimary, 'the dark mark is the dark brand teal')
  assert.equal(MARK_COLORS.monoInk, LIGHT.primaryText)
  assert.equal(MARK_COLORS.monoLight, LIGHT.surface)
  for (const [path, hex] of Object.entries(wanted)) {
    const svg = read(path)
    assert.doesNotMatch(svg, /currentColor/, `${path} is a fixed-colour asset`)
    assert.deepEqual([...new Set([...svg.matchAll(/#[0-9A-Fa-f]{6}/g)].map((m) => m[0]))], [hex], `${path} is one colour`)
  }
  // A logo is never painted in a state colour: a mark in success green would
  // say the tenant is healthy.
  const semantic = [LIGHT.success, LIGHT.attention, LIGHT.danger, LIGHT.admin, DARK.success, DARK.attention, DARK.danger, DARK.admin]
  for (const hex of Object.values(MARK_COLORS)) assert.ok(!semantic.includes(hex), `${hex} is a semantic colour, not a logo colour`)
})

test('brand: the favicon is the same logo on a brand field, with no text', () => {
  const svg = read('public/brand/favicon.svg')
  assert.match(svg, /viewBox="0 0 100 100"/)
  assert.match(svg, new RegExp(`fill="${APP_ICON.field}"`), 'the app-icon field is the brand teal')
  assert.match(svg, new RegExp(`fill="${APP_ICON.mark}"`), 'the mark is drawn light on the field')
  assert.doesNotMatch(svg, /<text\b|<tspan\b/i, 'no text on the icon')
  assert.doesNotMatch(svg, /Gradient\b/i, 'no gradient on the icon')
  // Same geometry as the master: the app icon is a treatment, not a second logo.
  for (const d of [...master().matchAll(/ d="([^"]+)"/g)].map((m) => m[1])) {
    assert.ok(svg.includes(d), 'the favicon draws the master geometry')
  }
})

test('brand: the raster favicon is a 32x32 PNG', () => {
  // The SVG is the authority. Chrome draws the PNG, so its bytes depend on the
  // Chrome that drew it and are not re-derived here; the size is the invariant.
  const png = readFileSync(RASTER.path)
  assert.deepEqual([...png.subarray(0, 8)], [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 'a PNG')
  assert.equal(png.readUInt32BE(16), RASTER.size, 'width')
  assert.equal(png.readUInt32BE(20), RASTER.size, 'height')
})

test('brand: no logo asset carries a generated tagline, in its name or its bytes', () => {
  const files = [...readdirSync('src/brand/logo').map((n) => `src/brand/logo/${n}`), ...readdirSync('public/brand').map((n) => `public/brand/${n}`)]
  for (const file of files) {
    const name = file.toLowerCase()
    for (const line of NOT_TAGLINES) {
      const slug = line.toLowerCase().replace(/[^a-z]+/g, '-')
      assert.ok(!name.includes(slug), `${file}: a generated line is not part of the logo`)
    }
    if (!/\.svg$/.test(file)) continue
    const text = read(file)
    for (const line of NOT_TAGLINES) assert.ok(!text.toUpperCase().includes(line), `${file} carries ${line}`)
  }
})

// ---------------------------------------------------------------- the manifest

test('brand: the manifest carries the owner palette exactly, in both themes', () => {
  const { palette } = manifest()
  for (const [theme, wanted] of [['light', LIGHT], ['dark', DARK]] as const) {
    for (const [role, hex] of Object.entries(wanted)) {
      assert.equal(palette[theme][role], hex, `${theme}.${role} drifted from the owner's value`)
    }
    // No extra role smuggled in beside the seventeen, plus the theme's name.
    assert.deepEqual(
      Object.keys(palette[theme]).filter((k) => k !== 'name').sort(),
      Object.keys(wanted).sort(),
      `${theme} has a role the owner did not approve`,
    )
  }
  assert.equal(palette.light.name, 'Mineral Teal')
  assert.equal(palette.dark.name, 'Blue Slate')
})

test('brand: the palette agrees with the current approved visual reference', () => {
  // Two records of one decision; if they can disagree, one of them is wrong.
  // docs/design/brand-decisions.md was the second record until the design
  // folder was cleaned. The current approved appearance is the comparison
  // reference pack, which declares the dark roles as CSS values.
  const ref = read('docs/design/approved/reference/iamai-home-approved-comparison-reference.html').toUpperCase()
  for (const [role, hex] of Object.entries(DARK)) {
    assert.ok(ref.includes(hex.toUpperCase()), `dark ${role} ${hex} is not in the approved visual reference`)
  }
  const refManifest = JSON.parse(read('docs/design/approved/reference/REFERENCE-MANIFEST.json')) as {
    authority: { lightTheme: string; darkTheme: string }
  }
  assert.equal(refManifest.authority.lightTheme, 'Mineral Teal', 'the light theme is unchanged')
  assert.equal(refManifest.authority.darkTheme, 'Blue Slate')
})

test('brand: production paints the owner palette, value for value', () => {
  // Task 029 recorded the palette and task 030 applied it. Two records of one
  // decision: if src/ui/tokens.ts and the manifest can disagree, the interface
  // is wearing a colour nobody approved.
  const { palette } = manifest()
  for (const [theme, tokens] of [['light', TOKENS_LIGHT], ['dark', TOKENS_DARK]] as const) {
    for (const role of BRAND_ROLES) {
      assert.equal(
        (tokens as Record<string, string>)[role].toUpperCase(),
        palette[theme][role].toUpperCase(),
        `${theme}.${role}: src/ui/tokens.ts and ${MANIFEST} disagree`,
      )
    }
  }
  assert.equal(manifest().production.paletteApplied, true, 'the manifest must say the palette is applied once it is')
})

test('brand: the interface is set in the three approved families, from this origin', () => {
  const tokensCss = read('src/ui/tokens.css')
  for (const family of ['IBM Plex Serif', 'IBM Plex Sans', 'IBM Plex Mono']) {
    assert.ok(tokensCss.includes(`font-family: '${family}'`), `${family} has no @font-face`)
  }
  // The wordmark's weight has a real face; nothing is synthesised for it.
  assert.match(tokensCss, /IBMPlexSans-Bold-Latin1\.woff2/)
  assert.match(tokensCss, /IBMPlexSans-SemiBold-Latin1\.woff2/)
  assert.equal(manifest().typography.appliedToProduction, true)
})

test('brand: brand teal is not success green', () => {
  const { palette, semantics } = manifest()
  assert.equal(semantics.brandPrimaryIsSuccess, false)
  for (const theme of ['light', 'dark'] as const) {
    assert.notEqual(palette[theme].brandPrimary, palette[theme].success, `${theme}: brand and success must stay different values`)
    assert.notEqual(palette[theme].brandSecondary, palette[theme].success)
  }
})

test('brand: there is no tagline', () => {
  const m = manifest()
  assert.equal(m.brand.tagline, null, 'tagline is null; a descriptor is a later approval, not a default')
  assert.equal(m.brand.name, 'IAMAI')
  assert.equal(m.logo.coreLockup, 'mark + IAMAI')
  assert.equal(m.logo.wordmark.text, 'IAMAI')
  assert.equal(m.logo.wordmark.descriptorUnderWordmark, false)
  assert.deepEqual([...m.brand.forbiddenTaglines].sort(), [...NOT_TAGLINES].sort())
})

test('brand: the wordmark role and the type roles are named, not implied', () => {
  const { typography, logo } = manifest()
  assert.deepEqual(typography.families, {
    display: 'IBM Plex Serif',
    interface: 'IBM Plex Sans',
    technical: 'IBM Plex Mono',
  })
  assert.equal(logo.wordmark.family, 'IBM Plex Sans')
  assert.ok(logo.wordmark.weight >= 700, 'the wordmark is set in 700 or heavier')
  assert.equal(logo.wordmark.minimumMarkPx, 16)
  for (const role of ['display / H1 / major editorial heading', 'body / interface', 'wordmark', 'technical / identifier / JSON / PowerShell / Graph path']) {
    assert.ok(typography.roles.some((r) => r.role === role), `the type roles must name "${role}"`)
  }
  assert.equal(typography.remoteFontCdn, false)
  // The face the wordmark needs has to actually be in the repository.
  assert.ok(existsSync('public/fonts/IBMPlexSans-Bold-Latin1.woff2'), 'the wordmark weight is available locally')
  assert.ok(existsSync('public/fonts/OFL.txt'), 'the licence ships with the faces')
  assert.ok(read(PROVENANCE).includes('SIL Open Font License'), 'the provenance record names the licence')
})

test('brand: the contract’s current-state table says what the manifest’s production flags say', () => {
  // Two records of one fact drift, and a reader following the older one rebuilds
  // against a state that no longer exists: after task 030 the manifest said the
  // palette and the type were applied while the contract still said they were
  // the restoration pack's to do. The rows below carry the flag's name, so the
  // table cannot answer differently from the flag.
  const rows = new Map<string, string>()
  for (const m of read(CONTRACT).matchAll(/^\|\s*([a-z][^|]*?)\s*\|\s*(yes|no)\b[^|]*\|/gm)) rows.set(m[1].trim(), m[2])
  const flags = manifest().production as unknown as Record<string, boolean>
  for (const [row, flag] of [
    ['palette applied to production', 'paletteApplied'],
    ['typography applied to production', 'typographyApplied'],
    ['shell header logo', 'shellLogoApplied'],
    ['page composition restored', 'pageCompositionRestored'],
  ] as const) {
    const said = rows.get(row)
    assert.ok(said, `the contract's current-state table has no "${row}" row`)
    assert.equal(said === 'yes', flags[flag], `the contract says ${said} for "${row}"; the manifest's ${flag} is ${flags[flag]}`)
  }
  assert.equal(manifest().typography.appliedToProduction, flags.typographyApplied)
})

test('brand: the provenance record’s SHA-256 table is the bytes actually staged', () => {
  // The record exists so a reader can re-verify a face against IBM's published
  // package. A hash that drifted from the file it names proves nothing.
  const rows = [...read(PROVENANCE).matchAll(/\| `(IBMPlex[A-Za-z0-9-]+\.woff2)` \|[^|]*\|[^|]*\| `([0-9a-f]{64})` \|/g)]
  const staged = readdirSync('public/fonts').filter((f) => f.endsWith('.woff2'))
  assert.deepEqual(
    rows.map((m) => m[1]).sort(),
    [...staged].sort(),
    'the provenance table and public/fonts name different faces',
  )
  for (const [, file, sha] of rows) {
    assert.equal(createHash('sha256').update(readFileSync(`public/fonts/${file}`)).digest('hex'), sha, `${file}: the recorded SHA-256 drifted`)
  }
})

test('brand: the shape and motion bands are the approved ones', () => {
  const { ui } = manifest()
  assert.deepEqual(ui.radiusPx, { compactRow: 4, control: 8, keyPanel: 12 })
  assert.deepEqual(ui.motionMs, { control: [120, 180], disclosure: [180, 240] })
})

// ------------------------------------------------- the application authorities

test('brand: the four approved application authorities are named, hashed and untouched', () => {
  const recorded = manifest().applicationDesignAuthority.surfaces
  assert.equal(recorded.length, APPROVED.length)
  for (const { surface, path, sha256 } of APPROVED) {
    const record = recorded.find((s) => s.surface === surface)
    assert.ok(record, `the brand manifest does not name the ${surface} authority`)
    assert.equal(record.path, path, `${surface}: the brand manifest points somewhere else`)
    assert.equal(record.sha256, sha256, `${surface}: the brand manifest's hash drifted`)
    assert.equal(
      createHash('sha256').update(readFileSync(path)).digest('hex'),
      sha256,
      `${path} is not the owner-approved file any more: branding may repaint an approved pack, never edit it`,
    )
  }
  assert.deepEqual(manifest().applicationDesignAuthority.precedence, [
    'production technical/content truth',
    'approved HTML application architecture',
    'approved brand skin',
  ])
})

test('brand: a generated branding preview is authority for nothing', () => {
  const previews = manifest().generatedBrandApplicationPreviews
  assert.equal(previews.authoritative, false)
  for (const [key, value] of Object.entries(previews)) {
    if (/[Aa]uthority$/.test(key)) assert.equal(value, false, `generatedBrandApplicationPreviews.${key} must be false`)
  }
  for (const flag of ['applicationLayoutAuthority', 'architectureAuthority', 'informationHierarchyAuthority', 'copyAuthority', 'workflowAuthority', 'responsiveAuthority']) {
    assert.equal(previews[flag], false, `generatedBrandApplicationPreviews.${flag} is missing or true`)
  }
  assert.deepEqual(previews.supersedes, [], 'a preview supersedes nothing')
  // And the same sentence, in as many words, in the documents a person reads.
  for (const doc of [CONTRACT, SYSTEM]) {
    assert.match(
      read(doc).replace(/\s+/g, ' '),
      /Application previews from branding exploration are not design authorities\./,
      `${doc} must say a branding preview is not an application design authority`,
    )
  }
})

test('brand: the brand system shows the four authorities rather than redrawing them', () => {
  const html = read(SYSTEM)
  for (const { path, sha256 } of APPROVED) {
    assert.ok(html.includes(path), `the brand system must reference ${path}`)
    assert.ok(html.includes(sha256), `the brand system must carry ${path}'s hash`)
    // Linked, not embedded: the relative href a reader can open.
    assert.ok(html.includes(`href="../${path.replace(/^docs\//, '')}"`), `the brand system must link ${path}`)
  }
  assert.match(
    html,
    /Application previews from branding exploration are not design authorities\./,
    'the brand system must say so in the page, not only in the source',
  )
  // It is a brand reference, not a page design: it must not carry an application preview.
  assert.doesNotMatch(html, /<iframe\b/i, 'an embedded application page would be a second authority')
})

test('brand: the brand system draws the master, not a redrawn copy of it', () => {
  const html = read(SYSTEM)
  for (const d of [...master().matchAll(/ d="([^"]+)"/g)].map((m) => m[1])) {
    assert.ok(html.includes(d), `the brand system draws a path the master does not: ${d}`)
  }
  for (const c of [...master().matchAll(/<circle[^>]*\/>/g)].map((m) => m[0].replace(/\s+/g, ' '))) {
    assert.ok(html.replace(/\s+/g, ' ').includes(c), `the brand system draws a node the master does not: ${c}`)
  }
})

test('brand: every document the manifest names exists', () => {
  for (const [name, path] of Object.entries(manifest().documents)) {
    assert.ok(existsSync(path), `documents.${name} points at ${path}, which does not exist`)
  }
  for (const [name, path] of Object.entries(manifest().logo.assets)) {
    assert.ok(existsSync(path), `logo.assets.${name} points at ${path}, which does not exist`)
  }
})

// --------------------------------------------------------------- what is served

test('brand: the served pages ask for the brand icon, and it is published', () => {
  for (const doc of ['index.html', 'home/index.html']) {
    const html = read(doc)
    assert.match(html, /rel="icon" type="image\/svg\+xml" href="\/brand\/favicon\.svg"/, `${doc} must use the brand icon`)
    assert.doesNotMatch(html, /rel="icon"[^>]*data:image/, `${doc} must not carry an inline placeholder icon`)
  }
  // home/index.html is generated: the generator has to be the one that says it.
  assert.match(read('scripts/build-home.ts'), /\/brand\/favicon\.svg/, 'the home generator writes the brand icon')
  // and scripts/assemble-site.mjs has to publish public/brand at the site root.
  assert.match(read('scripts/assemble-site.mjs'), /'public', 'brand'/, 'the site assembly must publish the brand icons')
})

test('brand: nothing served asks a third party for a font', () => {
  const REMOTE = /fonts\.googleapis\.com|fonts\.gstatic\.com|use\.typekit\.net|cdn\.jsdelivr\.net|unpkg\.com|cdnjs\.cloudflare\.com/i
  const TEXT = /\.(html|css|ts|tsx|mjs|json|md|svg)$/
  const walk = (dir: string, out: string[] = []): string[] => {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry).replace(/\\/g, '/')
      if (statSync(full).isDirectory()) walk(full, out)
      else if (TEXT.test(entry)) out.push(full)
    }
    return out
  }
  // What the site serves, plus this task's own documents. The superseded
  // mockups under docs/design/ still carry a Google Fonts link; they are
  // records of what was drawn, nothing loads them, and nothing ships them.
  const files = ['index.html', ...walk('home'), ...walk('src'), ...walk('public'), ...walk('docs/brand')]
  for (const file of files) {
    assert.doesNotMatch(readFileSync(file, 'utf8'), REMOTE, `${file} fetches a font from a third party`)
  }
})

test('brand: every weight the brand system sets is a face it declares and the repository stages', () => {
  // The visual reference is where a later pack reads the brand from. It set its
  // Serif 600 and 700 specimens against @font-face rules that declared only 400
  // and 500, so the "approved" display weights on the page were whatever the
  // browser substituted or synthesised.
  const html = read(SYSTEM)
  const declared = [...html.matchAll(/@font-face\s*\{[^}]*font-family:\s*'([^']+)'[^}]*font-weight:\s*(\d+)[^}]*url\('([^']+)'\)/g)].map((m) => ({
    family: m[1],
    weight: Number(m[2]),
    file: m[3],
  }))
  assert.ok(declared.length >= 7, `only ${declared.length} @font-face rules found — the reader is broken, not the page`)
  for (const d of declared) {
    assert.ok(existsSync(join('docs/brand', d.file)), `${d.family} ${d.weight} is declared from ${d.file}, which is not staged`)
  }
  // Every block or inline style that sets a weight, with the family it is set
  // in: named in the same block, or the page body's IBM Plex Sans.
  const blocks = [...html.matchAll(/\{([^{}]*)\}/g)].map((m) => m[1]).concat([...html.matchAll(/style="([^"]*)"/g)].map((m) => m[1]))
  let checked = 0
  for (const body of blocks) {
    if (/@font-face/.test(body)) continue
    const weight = body.match(/font-weight:\s*(\d+)/)
    if (!weight) continue
    const named = body.match(/font-family:\s*'?(IBM Plex (?:Serif|Sans|Mono))'?/)
    const family = named ? named[1] : 'IBM Plex Sans'
    checked++
    assert.ok(
      declared.some((d) => d.family === family && d.weight === Number(weight[1])),
      `the brand system sets ${family} ${weight[1]} without declaring that face`,
    )
  }
  assert.ok(checked >= 8, `only ${checked} weight declarations found — the reader is broken, not the page`)
})

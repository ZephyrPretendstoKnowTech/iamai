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
import { APP_ICON, MARK_COLORS, MASTER, RASTER, derived, normalise } from '../../scripts/brandDerive.ts'

const MANIFEST = 'docs/brand/brand-manifest.json'
const CONTRACT = 'docs/brand/iamai-brand-contract.md'
const SYSTEM = 'docs/brand/iamai-brand-system.html'
const PROVENANCE = 'docs/brand/font-provenance.md'
const DECISIONS = 'docs/design/brand-decisions.md'

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
  }
  palette: { light: Hexes; dark: Hexes }
  semantics: { brandPrimaryIsSuccess: boolean }
  typography: { families: Record<string, string>; roles: { role: string; family: string; weight: number | number[] }[]; remoteFontCdn: boolean }
  applicationDesignAuthority: { surfaces: { surface: string; path: string; sha256: string }[]; precedence: string[] }
  generatedBrandApplicationPreviews: Record<string, unknown>
  ui: { radiusPx: Record<string, number>; motionMs: Record<string, number[]> }
  documents: Record<string, string>
}

/**
 * The owner's palette, written out here rather than read from the manifest: a
 * guard that took its expectations from the file it guards would pass on any
 * self-consistent rewrite. These are the values in the task 029 contract and in
 * docs/design/brand-decisions.md (task 028).
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
  canvas: '#0E1516',
  surface: '#151F20',
  secondarySurface: '#111A1B',
  line: '#2A3737',
  strongLine: '#3B4B4A',
  primaryText: '#F0F4F2',
  secondaryText: '#C4CECA',
  mutedText: '#879693',
  brandPrimary: '#59C7B7',
  brandSecondary: '#7AD9CB',
  brandSoft: '#173B37',
  brandSoftText: '#D9FFF8',
  success: '#79D7A6',
  attention: '#E3B35B',
  danger: '#E88A8A',
  admin: '#B9A7FF',
  codeSurface: '#0A1112',
}

/** Task 028's four approved application authorities, by name and by bytes. */
const APPROVED = [
  { surface: 'home', path: 'docs/design/approved/iamai-home-design-pack-v2.html', sha256: '88b9a3a5907e78ad83f7c31dca00b86a2bdd741b9b4efca575254567d6e55a50' },
  { surface: 'connect', path: 'docs/design/approved/iamai-connect-design-pack-v3.html', sha256: '903808b07210209a22d1a4f380b9e79dad95bd0e740a0fce0bb3745d265ee48b' },
  { surface: 'plan', path: 'docs/design/approved/iamai-plan-step-design-pack.html', sha256: '1f1bda574fc76d0cc48c7d2e7a5d26abe34d8ee0aa5fab4888282cd9955ad4ec' },
  { surface: 'mfa-readiness', path: 'docs/design/approved/iamai-mfa-readiness-design-pack-v2.html', sha256: '12d8bdfbd09f82de66b732037d74da8217a79fca5cd78f12ce673eecbfc76512' },
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

test('brand: the master mark is where the manifest says, on the 64 grid', () => {
  assert.ok(existsSync(MASTER), `${MASTER} is missing: the brand has no master`)
  assert.equal(manifest().logo.master, MASTER)
  assert.match(master(), /viewBox="0 0 64 64"/, 'the master is drawn on a 0 0 64 64 grid')
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
  for (const re of [/<text\b/i, /<tspan\b/i, /<title\b/i, /<desc\b/i]) {
    assert.doesNotMatch(svg, re, 'the mark is geometry; the wordmark is live text set beside it')
  }
  // Nothing between the tags but tags: no stray text node.
  assert.equal(svg.replace(/<[^>]*>/g, '').trim(), '', 'the master renders no text')
})

test('brand: the master is one colour source, and that source is themeable', () => {
  const svg = master()
  assert.match(svg, /currentColor/, 'the master inherits its colour')
  const literals = [...svg.matchAll(/#[0-9a-f]{3,8}\b/gi)].map((m) => m[0])
  assert.deepEqual(literals, [], 'the master hard-codes no colour; the derivatives carry the values')
})

test('brand: the mark still has its topology — frame, route, arrow, origin, waypoint', () => {
  // Optical refinement is expected and allowed; a redesign is not. If this
  // fails because the mark genuinely changed family or shape, the manifest's
  // logo.version has to move with it.
  const svg = master()
  assert.equal([...svg.matchAll(/<path\b/g)].length, 3, 'frame, route, arrow: three paths')
  assert.equal([...svg.matchAll(/<circle\b/g)].length, 2, 'origin and waypoint: two nodes')
  assert.equal([...svg.matchAll(/stroke-width="/g)].length, 1, 'one stroke weight across the mark')
  const { logo } = manifest()
  assert.equal(logo.family, 'Guided Route')
  assert.equal(logo.variant, 2)
  assert.equal(logo.version, 1)
  assert.equal(logo.topology.length, 6, 'the six-part topology the contract names')
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
  assert.match(svg, /viewBox="0 0 64 64"/)
  assert.match(svg, new RegExp(`fill="${APP_ICON.field}"`), 'the app-icon field is the brand teal')
  assert.match(svg, new RegExp(`stroke="${APP_ICON.mark}"`), 'the mark is drawn light on the field')
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
  assert.equal(palette.dark.name, 'Deep Mineral')
})

test('brand: the palette agrees with task 028s brand decisions', () => {
  // Two records of one decision; if they can disagree, one of them is wrong.
  const decisions = read(DECISIONS)
  for (const hex of [...Object.values(LIGHT), ...Object.values(DARK)]) {
    assert.ok(decisions.includes(hex), `${hex} is not in ${DECISIONS}`)
  }
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

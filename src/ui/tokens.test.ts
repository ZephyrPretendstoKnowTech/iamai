// Both themes must pass WCAG AA on every pair the interface actually paints,
// and tokens.css must be exactly what tokens.ts renders.
//
// Task 030 swapped the shipped paper palette for the owner's approved one:
// Mineral Teal in light, and in dark the palette the owner has since replaced
// with Blue Slate (docs/brand/brand-manifest.json). The canonical seventeen are
// the owner's values and are not negotiable here — what this file proves is
// that the values production actually paints TEXT with clear AA, which is why
// tokens.ts carries a small derived set beside the canonical one.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { BRAND_ROLES, DARK, DERIVED_ROLES, DISPLAY, FONT_FILES, LIGHT, LAYOUT, ROLE_WEIGHTS, ROUTE_WIDTHS, TEXT_SURFACES, TYPE, contrastRatio, renderTokensCss, resolveColourVar, WEIGHTS } from './tokens.ts'
import type { Palette } from './tokens.ts'

const AA_TEXT = 4.5
const AA_COMPONENT = 3

function check(name: string, p: Palette): void {
  test(`${name}: the reading pairs are AA text on every surface text sits on`, () => {
    for (const key of TEXT_SURFACES) {
      const bg = p[key]
      for (const fg of ['primaryText', 'secondaryText', 'brandPrimary', 'onBrand'] as const) {
        if (fg === 'onBrand') continue
        assert.ok(contrastRatio(p[fg], bg) >= AA_TEXT, `${fg} on ${key} = ${contrastRatio(p[fg], bg).toFixed(2)}`)
      }
    }
  })
  test(`${name}: the ink on the brand colour is AA, and text on the brand tint is AA`, () => {
    assert.ok(contrastRatio(p.onBrand, p.brandPrimary) >= AA_TEXT, contrastRatio(p.onBrand, p.brandPrimary).toFixed(2))
    assert.ok(contrastRatio(p.brandSoftText, p.brandSoft) >= AA_TEXT, contrastRatio(p.brandSoftText, p.brandSoft).toFixed(2))
  })
  test(`${name}: every derived text colour is AA on every surface text sits on`, () => {
    for (const fg of ['quietText', 'successText', 'attentionText', 'dangerText', 'adminText', 'unprovenText', 'brandSecondaryText'] as const) {
      for (const key of TEXT_SURFACES) {
        const r = contrastRatio(p[fg], p[key])
        assert.ok(r >= AA_TEXT, `${fg} on ${key} = ${r.toFixed(2)}`)
      }
    }
  })
  test(`${name}: the muted ink is an icon colour, the state fills read as components, the strong rule is perceptible`, () => {
    assert.ok(contrastRatio(p.mutedText, p.canvas) >= AA_COMPONENT, `mutedText on canvas = ${contrastRatio(p.mutedText, p.canvas).toFixed(2)}`)
    // And the three reading levels stay three: primary, secondary, quiet.
    assert.ok(contrastRatio(p.primaryText, p.canvas) > contrastRatio(p.secondaryText, p.canvas))
    assert.ok(contrastRatio(p.secondaryText, p.canvas) > contrastRatio(p.quietText, p.canvas))
    for (const c of [p.success, p.attention, p.danger, p.admin, p.unproven, p.idle]) {
      assert.ok(contrastRatio(c, p.canvas) >= AA_COMPONENT, `${c} on canvas = ${contrastRatio(c, p.canvas).toFixed(2)}`)
    }
    assert.ok(contrastRatio(p.strongLine, p.canvas) >= 1.5, 'the strong rule is perceptible')
  })
  test(`${name}: brand is not a tenant state`, () => {
    // A brand action painted in the success colour tells the reader something
    // untrue about their tenant (docs/brand/brand-manifest.json semantics).
    assert.notEqual(p.brandPrimary, p.success)
    assert.notEqual(p.brandSecondary, p.success)
    assert.notEqual(p.brandPrimary, p.attention)
    assert.notEqual(p.brandPrimary, p.danger)
  })
}

check('light', LIGHT)
check('dark', DARK)

/**
 * Every colour the two stylesheets actually declare as `color:`, resolved
 * through the alias chain to the palette role a browser would compute.
 *
 * The pair tests above prove a role is legible. This proves the pages are
 * PAINTING with a legible role — which is a different fact, and the one that
 * was wrong: `--ink-3` sets the Plan row's reason, the who and when lines, a
 * tile's quiet note and the home section labels, and it resolved to the muted
 * component colour at 3.46:1 on the page.
 */
const PAINTED_ON_ANOTHER_FILL: Record<string, string> = {
  // The ink on the brand fill and the ink on the brand tint are never set on a
  // page surface; both pairs are measured directly in the check() block above.
  onBrand: 'brandPrimary',
  brandSoftText: 'brandSoft',
}

function declaredTextColours(file: string): { where: string; token: string }[] {
  const src = readFileSync(file, 'utf8').replace(/\r\n/g, '\n')
  const out: { where: string; token: string }[] = []
  for (const m of src.matchAll(/(?:^|[;{\s])(?:-webkit-text-fill-)?color:\s*var\((--[a-z0-9-]+)\)/g)) {
    out.push({ where: `${file}:${src.slice(0, m.index).split('\n').length}`, token: m[1] })
  }
  return out
}

test('every colour the pages set text in resolves to a role that is AA on every surface', () => {
  const declared = [...declaredTextColours('src/ui/app.css'), ...declaredTextColours('home/home.css')]
  assert.ok(declared.length > 100, `only ${declared.length} colour declarations found — the reader is broken, not the CSS`)
  for (const { where, token } of declared) {
    const role = resolveColourVar(token)
    assert.ok(role, `${where}: ${token} is not a palette colour`)
    if (role in PAINTED_ON_ANOTHER_FILL) continue
    for (const [theme, p] of [
      ['light', LIGHT],
      ['dark', DARK],
    ] as const) {
      for (const key of TEXT_SURFACES) {
        const r = contrastRatio(p[role], p[key])
        assert.ok(r >= AA_TEXT, `${where}: ${token} → ${role} on ${theme} ${key} = ${r.toFixed(2)}`)
      }
    }
  }
})

test('tokens.css is generated from tokens.ts and has not drifted', () => {
  const onDisk = readFileSync('src/ui/tokens.css', 'utf8').replace(/\r\n/g, '\n')
  assert.equal(onDisk, renderTokensCss(), 'run: node scripts/gen-tokens.mjs')
})

test('every palette entry is an opaque hex, and the two themes carry the same roles', () => {
  for (const p of [LIGHT, DARK]) for (const [k, v] of Object.entries(p)) assert.match(v, /^#[0-9A-F]{6}$/i, `${k}: ${v}`)
  assert.deepEqual(Object.keys(LIGHT), Object.keys(DARK), 'a role exists in one theme only')
  // The canonical seventeen plus the derived set, and nothing unaccounted for.
  assert.deepEqual(Object.keys(LIGHT).sort(), [...BRAND_ROLES, ...Object.keys(DERIVED_ROLES)].sort())
})

test('the weights are the four the brand names, and every role is the manifest’s approved weight', () => {
  assert.deepEqual([...WEIGHTS], [400, 500, 600, 700])
  const manifest = JSON.parse(readFileSync('docs/brand/brand-manifest.json', 'utf8')) as {
    typography: { roles: { role: string; family: string; weight: number | number[] }[] }
  }
  const approved = (match: RegExp): number | number[] => manifest.typography.roles.find((r) => match.test(r.role))!.weight
  assert.equal(ROLE_WEIGHTS.display, approved(/^display/), 'the display role is not the brand’s approved display weight')
  assert.equal(ROLE_WEIGHTS.wordmark, approved(/^wordmark/))
  assert.equal(ROLE_WEIGHTS.strong, approved(/^strong body/))
  assert.equal(ROLE_WEIGHTS.body, approved(/^body/))
})

test('every role weight has a real staged face, on this origin, in the family the role is set in', () => {
  // A weight with no face is drawn by the browser as a synthesised fake bold,
  // which is not the approved brand. The file has to exist on disk AND be
  // declared to the browser: task 029 staged two faces that no @font-face
  // mentioned, and nothing downloaded them.
  const css = renderTokensCss()
  const declared = [...css.matchAll(/font-family: '([^']+)';\n\s*src: url\('\/fonts\/([^']+)'\)[\s\S]*?font-weight: (\d+);/g)].map((m) => ({
    family: m[1],
    file: m[2],
    weight: Number(m[3]),
  }))
  for (const [role, family] of [
    ['display', 'IBM Plex Serif'],
    ['body', 'IBM Plex Sans'],
    ['strong', 'IBM Plex Sans'],
    ['wordmark', 'IBM Plex Sans'],
  ] as const) {
    const weight = ROLE_WEIGHTS[role]
    const face = declared.find((d) => d.family === family && d.weight === weight)
    assert.ok(face, `no @font-face declares ${family} ${weight} for the ${role} role`)
    assert.ok(existsSync(`public/fonts/${face.file}`), `${face.file} is declared but not staged under public/fonts`)
  }
})

test('every declared face is staged, and every staged face is declared', () => {
  const css = renderTokensCss()
  const files = [...css.matchAll(/url\('\/fonts\/([^']+)'\)/g)].map((m) => m[1]).sort()
  const staged = readdirSync('public/fonts')
    .filter((f) => f.endsWith('.woff2'))
    .sort()
  assert.deepEqual(files, staged, 'a face is shipped that nothing declares, or declared that nothing ships')
})

test('the display ramp can express the approved packs, well past the old 26px ceiling', () => {
  const sizes: number[] = Object.values(DISPLAY)
  assert.ok(Math.max(...sizes) >= 50, 'the Home display is 50px in docs/design/approved/anatomy/home-v2.html')
  // The four approved desktop display sizes, each with a token of its own.
  for (const px of [50, 42, 40, 38, 21]) assert.ok(sizes.includes(px), `no token expresses ${px}px`)
  // The old scale topped out at 26px, which no approved display heading fits.
  assert.ok(Math.max(...Object.values(TYPE)) < 30, 'the interface scale stays an interface scale')
  assert.ok(Math.min(...Object.values(TYPE)) <= 10, 'metadata reaches 10px')
})

test('each approved surface has its own content width, and the reading measure is separate', () => {
  assert.equal(ROUTE_WIDTHS.home, 1040)
  assert.equal(ROUTE_WIDTHS.connect, 1040)
  assert.equal(ROUTE_WIDTHS.plan, 1240)
  assert.equal(ROUTE_WIDTHS.readiness, 1200)
  assert.equal(ROUTE_WIDTHS.default, 760)
  // A wide operational page must not set every paragraph 1240px wide.
  assert.ok(LAYOUT.measureCh >= 68 && LAYOUT.measureCh <= 76, `prose measure ${LAYOUT.measureCh}ch`)
  assert.ok(LAYOUT.leadPx < ROUTE_WIDTHS.plan, 'a lead paragraph is narrower than the widest page')
})

test('the shape hierarchy is the brand’s 4 / 8 / 12', () => {
  assert.equal(LAYOUT.radiusPx, 4)
  assert.equal(LAYOUT.radiusControlPx, 8)
  assert.equal(LAYOUT.radiusPanelPx, 12)
})

test('nothing in the token file asks a third party for a face', () => {
  const css = renderTokensCss()
  for (const m of css.matchAll(/url\(([^)]+)\)/g)) assert.match(m[1], /^'\/fonts\//, `${m[1]} is not served from this origin`)
})

/** The Plex family a `font-family: var(--font-*)` request resolves to. */
const PLEX_FAMILY: Record<string, string> = {
  '--font-serif': 'IBM Plex Serif',
  '--font-sans': 'IBM Plex Sans',
  '--font-mono': 'IBM Plex Mono',
}

/**
 * Every (family, weight) a stylesheet actually asks for: a rule that names a
 * Plex family and a weight in the same block. The role tests above prove the
 * four NAMED roles have faces; this reads what the pages request, which is not
 * the same set — a rule can set `var(--font-mono)` beside a bare `500`.
 */
function fontRequests(file: string): { where: string; family: string; weight: number }[] {
  const css = readFileSync(file, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')
  const out: { where: string; family: string; weight: number }[] = []
  for (const rule of css.matchAll(/([^{}]*)\{([^{}]*)\}/g)) {
    const selector = rule[1].trim().split('\n').at(-1)?.trim() ?? ''
    const family = rule[2].match(/font-family\s*:\s*var\((--font-(?:serif|sans|mono))\)/)
    if (!family) continue
    for (const m of rule[2].matchAll(/font-weight\s*:\s*([^;]+)/g)) {
      const v = m[1].trim()
      const role = v.match(/^var\(--weight-(display|body|strong|wordmark)\)$/)
      const weight = role ? ROLE_WEIGHTS[role[1] as keyof typeof ROLE_WEIGHTS] : Number(v)
      if (!Number.isFinite(weight)) continue
      out.push({ where: `${file} — ${selector}`, family: PLEX_FAMILY[family[1]], weight })
    }
  }
  return out
}

test('every family and weight the pages actually request has a staged face', () => {
  // The role tests prove the four named roles resolve to real files. They say
  // nothing about a rule that pairs a family with a literal weight, which is
  // how `.rung-badge` came to ask IBM Plex Mono for a 500 that has never been
  // staged: the browser substitutes the 400 face or synthesises a fake medium,
  // and the "complete" typography foundation is not what renders.
  const requests = [...fontRequests('src/ui/app.css'), ...fontRequests('home/home.css')]
  assert.ok(requests.length >= 8, `only ${requests.length} family+weight requests found — the reader is broken, not the CSS`)
  for (const { where, family, weight } of requests) {
    const face = FONT_FILES.find((f) => f.family === family && f.weight === weight)
    assert.ok(face, `${where}: asks for ${family} ${weight}, which has no staged face`)
    assert.ok(existsSync(`public/fonts/${face.file}`), `${where}: ${face.file} is not staged under public/fonts`)
  }
})

// Both themes must pass WCAG AA on every pair the interface actually paints,
// and tokens.css must be exactly what tokens.ts renders.
//
// Task 030 swapped the shipped paper palette for the owner's Mineral Teal and
// Deep Mineral (docs/brand/brand-manifest.json). The canonical seventeen are
// the owner's values and are not negotiable here — what this file proves is
// that the values production actually paints TEXT with clear AA, which is why
// tokens.ts carries a small derived set beside the canonical one.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { BRAND_ROLES, DARK, DERIVED_ROLES, DISPLAY, LIGHT, LAYOUT, ROLE_WEIGHTS, ROUTE_WIDTHS, TEXT_SURFACES, TYPE, contrastRatio, renderTokensCss, WEIGHTS } from './tokens.ts'
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
    for (const fg of ['successText', 'attentionText', 'dangerText', 'adminText', 'unprovenText', 'brandSecondaryText'] as const) {
      for (const key of TEXT_SURFACES) {
        const r = contrastRatio(p[fg], p[key])
        assert.ok(r >= AA_TEXT, `${fg} on ${key} = ${r.toFixed(2)}`)
      }
    }
  })
  test(`${name}: the muted ink is an icon colour, the state fills read as components, the strong rule is perceptible`, () => {
    assert.ok(contrastRatio(p.mutedText, p.canvas) >= AA_COMPONENT, `mutedText on canvas = ${contrastRatio(p.mutedText, p.canvas).toFixed(2)}`)
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

test('the weights are the four the brand names, and a display heading has a real face to be set in', () => {
  assert.deepEqual([...WEIGHTS], [400, 500, 600, 700])
  assert.equal(ROLE_WEIGHTS.wordmark, 700, 'the wordmark is IBM Plex Sans 700')
  assert.equal(ROLE_WEIGHTS.strong, 600)
  // IBM Plex Serif SemiBold/Bold are not staged under public/fonts, so the
  // display weight is the heaviest serif face that actually exists. A pack that
  // stages them changes this one number and nothing else.
  const css = renderTokensCss()
  const serif = [...css.matchAll(/font-family: 'IBM Plex Serif';[\s\S]*?font-weight: (\d+);/g)].map((m) => Number(m[1]))
  assert.ok(serif.includes(ROLE_WEIGHTS.display), `no IBM Plex Serif face is staged at ${ROLE_WEIGHTS.display}`)
})

test('the display ramp can express the approved packs, well past the old 26px ceiling', () => {
  const sizes: number[] = Object.values(DISPLAY)
  assert.ok(Math.max(...sizes) >= 50, 'the Home display is 50px in docs/design/approved/home-v2.html')
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

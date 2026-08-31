// Both themes must pass WCAG AA on every pair the interface actually paints
// (prompt 47 Part 1), and tokens.css must be exactly what tokens.ts renders.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { DARK, LIGHT, contrastRatio, renderTokensCss, WEIGHTS } from './tokens.ts'
import type { Palette } from './tokens.ts'

const AA_TEXT = 4.5
const AA_COMPONENT = 3

function check(name: string, p: Palette): void {
  test(`${name}: ink and ink-2 are AA text on the page, raised and inset backgrounds`, () => {
    for (const bg of [p.bg, p.bgRaised, p.bgInset]) {
      assert.ok(contrastRatio(p.ink, bg) >= AA_TEXT, `ink on ${bg} = ${contrastRatio(p.ink, bg).toFixed(2)}`)
      assert.ok(contrastRatio(p.ink2, bg) >= AA_TEXT, `ink-2 on ${bg} = ${contrastRatio(p.ink2, bg).toFixed(2)}`)
      assert.ok(contrastRatio(p.accent, bg) >= AA_TEXT, `accent (links, tabs) on ${bg} = ${contrastRatio(p.accent, bg).toFixed(2)}`)
    }
  })
  test(`${name}: the primary button's ink is AA on the accent`, () => {
    assert.ok(contrastRatio(p.onAccent, p.accent) >= AA_TEXT, contrastRatio(p.onAccent, p.accent).toFixed(2))
  })
  test(`${name}: ink-3 is an icon colour, not a text colour; the status dots and the strong rule read as components`, () => {
    assert.ok(contrastRatio(p.ink3, p.bg) >= AA_COMPONENT, `ink-3 on bg = ${contrastRatio(p.ink3, p.bg).toFixed(2)}`)
    for (const c of [p.ok, p.wait, p.stop, p.idle]) assert.ok(contrastRatio(c, p.bg) >= AA_COMPONENT, `${c} dot on bg = ${contrastRatio(c, p.bg).toFixed(2)}`)
    assert.ok(contrastRatio(p.ruleStrong, p.bg) >= 1.5, 'the strong rule is perceptible')
  })
}

check('light', LIGHT)
check('dark', DARK)

test('tokens.css is generated from tokens.ts and has not drifted', () => {
  const onDisk = readFileSync('src/ui/tokens.css', 'utf8').replace(/\r\n/g, '\n')
  assert.equal(onDisk, renderTokensCss(), 'run: node scripts/gen-tokens.mjs')
})

test('two weights, and every palette entry is an opaque hex colour', () => {
  assert.deepEqual([...WEIGHTS], [400, 500])
  for (const p of [LIGHT, DARK]) for (const [k, v] of Object.entries(p)) assert.match(v, /^#[0-9A-F]{6}$/i, `${k}: ${v}`)
})

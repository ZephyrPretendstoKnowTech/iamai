// Both themes must pass WCAG AA (prompt 08 §A): 4.5:1 for body text, 3:1 for
// large text / UI components such as chips and accent buttons.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { DARK, LIGHT, contrastRatio } from './tokens.ts'
import type { Palette } from './tokens.ts'

const AA_TEXT = 4.5
const AA_LARGE = 3

function check(name: string, p: Palette): void {
  test(`${name}: body text on every surface is AA`, () => {
    for (const surface of [p.bg, p.surface, p.raised]) {
      assert.ok(contrastRatio(p.text, surface) >= AA_TEXT, `text on ${surface}`)
      assert.ok(contrastRatio(p.muted, surface) >= AA_TEXT, `muted on ${surface}`)
    }
  })
  test(`${name}: accent button ink is AA`, () => {
    assert.ok(contrastRatio(p.accentInk, p.accent) >= AA_TEXT)
  })
  test(`${name}: status colours read against surfaces at large-text/component level`, () => {
    for (const c of [p.success, p.warning, p.danger, p.info, p.accent]) {
      assert.ok(contrastRatio(c, p.surface) >= AA_LARGE, `${c} on surface`)
      assert.ok(contrastRatio(c, p.bg) >= AA_LARGE, `${c} on bg`)
    }
  })
}

check('dark', DARK)
check('light', LIGHT)

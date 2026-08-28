// Both themes must pass WCAG AA (prompt 08 §A): 4.5:1 for body text, 3:1 for
// large text / UI components such as chips and accent buttons.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { BUTTON_STATES, BUTTON_VARIANTS, DARK, LIGHT, buttonColours, contrastRatio } from './tokens.ts'
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

// Prompt 19 §A1: no button variant may lose its label in any state.
for (const [name, p] of [['dark', DARK], ['light', LIGHT]] as const) {
  test(`${name}: every button variant keeps AA text in every state`, () => {
    for (const variant of BUTTON_VARIANTS) {
      for (const state of BUTTON_STATES) {
        const { text, background } = buttonColours(p, variant, state)
        assert.notEqual(text.toUpperCase(), background.toUpperCase(), `${variant}/${state} text equals background`)
        assert.ok(contrastRatio(text, background) >= AA_TEXT, `${variant}/${state}: ${text} on ${background} = ${contrastRatio(text, background).toFixed(2)}`)
      }
    }
  })
}

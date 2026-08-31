// ux-review-04 §1, prompt 21 §A3: a headline number computed over a filtered
// population must name that population (and its window) in its own
// definition. Encoded over the tile definitions, not left as a convention.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { HEADLINE_METRICS, TILE, TODAY_LINE, TODAY_TILE } from './definitions.ts'

test('every headline metric names its population, and its window when it has one', () => {
  for (const m of HEADLINE_METRICS) {
    const text = `${m.tile.title} ${m.tile.text}`.toLowerCase()
    assert.ok(text.includes(m.population.toLowerCase()), `${m.tile.title}: must name "${m.population}"`)
    if (m.window) assert.ok(text.includes(m.window.toLowerCase()), `${m.tile.title}: must name the window "${m.window}"`)
  }
})

test('the rollout tiles are all over enabled users and there is no challenged-rate headline', () => {
  const rollout = [TILE.mfaProven, TILE.noMethod, TILE.registeredUnproven, TILE.toSetUp]
  for (const t of rollout) assert.match(t.text, /all enabled users/, t.title)
  assert.ok(!('challengedRate' in TILE), 'challenged rate is not a tile')
  assert.ok(!('verificationPhase' in TILE), 'the active-only "to verify" tile is gone')
  assert.match(TILE.mfaProven.text, /challenged rate/, 'the challenged rate survives only inside the MFA proven definition')
})

// Prompt 47 Part 5: Today counts over active people, and every tip fits the contract's 25 words.
test("today's tiles and line are over active people, in 25 words or fewer", () => {
  for (const d of [...Object.values(TODAY_TILE), TODAY_LINE.active]) {
    assert.ok(d.text.split(/\s+/).length <= 25, `${d.title}: ${d.text.split(/\s+/).length} words`)
  }
  for (const key of ['proven', 'unproven', 'noMethod'] as const) assert.match(TODAY_TILE[key].text, /share of active people/i, key)
  assert.match(TODAY_TILE.notActive.text, /never counted/)
})

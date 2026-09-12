// dependency-data.json is generated from the playbook by scripts/build-dependency-data.mjs.
// The document is the source of truth: this test fails the moment they diverge.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'
import { PLAYBOOK_PATH, parseDependencyDoc } from './parseDependencyDoc.ts'
import data from './dependency-data.json' with { type: 'json' }

const doc = fs.readFileSync(fileURLToPath(new URL(`../../${PLAYBOOK_PATH}`, import.meta.url)), 'utf8')
const parsed = parseDependencyDoc(doc)

test('dependency-data.json equals the playbook parsed afresh (regenerate with scripts/build-dependency-data.mjs)', () => {
  assert.deepEqual(data, parsed)
})

test('§10.0 step index: every gated step and step prerequisite is indexed; iamai_order is empty', () => {
  const ids = new Set(parsed.steps.map((s) => s.id))
  assert.equal(ids.size, parsed.steps.length)
  for (const e of parsed.edges) {
    assert.ok(ids.has(e.step), e.step)
    if (e.prerequisiteKind === 'step') assert.ok(ids.has(e.prerequisite), e.prerequisite)
  }
  assert.ok(parsed.steps.every((s) => s.iamaiOrder === null))
  assert.ok(!doc.includes('| baseline_order |'), 'baseline_order was removed (V6)')
})

test('§10.1 placeholder row expands to every step under §11 E–H, on enforce, conditional on sd-enabled', () => {
  const expanded = parsed.edges.filter((e) => e.expandedFrom)
  assert.ok(expanded.length > 0)
  for (const e of expanded) {
    assert.equal(e.action, 'enforce')
    assert.equal(e.condition, 'sd-enabled')
    assert.equal(e.prerequisite, 's-prereq-security-defaults')
  }
  assert.equal(new Set(expanded.map((e) => e.step)).size, expanded.length)
})

test('§8 owns every condition an edge uses; conditional edges carry a condition and hard edges none', () => {
  const owned = new Map(parsed.conditions.map((c) => [c.name, c.ownedBy]))
  for (const e of parsed.edges) {
    assert.equal(e.edgeKind === 'conditional', e.condition !== null, `${e.step}:${e.action} ← ${e.prerequisite}`)
    if (e.condition) assert.ok(owned.has(e.condition), e.condition)
  }
})

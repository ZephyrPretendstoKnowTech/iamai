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

test('the parsed playbook is structurally whole: §10.0 indexes every gated step, §10.1 expands the Security Defaults placeholder on enforce under sd-enabled, and §8 owns every condition an edge uses', () => {
  // §10.0 step index: every gated step and step prerequisite is indexed; iamai_order is empty
  {
    const ids = new Set(parsed.steps.map((s) => s.id))
    assert.equal(ids.size, parsed.steps.length)
    for (const e of parsed.edges) {
      assert.ok(ids.has(e.step), e.step)
      if (e.prerequisiteKind === 'step') assert.ok(ids.has(e.prerequisite), e.prerequisite)
    }
    assert.ok(parsed.steps.every((s) => s.iamaiOrder === null))
    assert.ok(!doc.includes('| baseline_order |'), 'baseline_order was removed (V6)')
  }
  // §10.1 placeholder row expands to every step under §11 E–H, on enforce, conditional on sd-enabled
  {
    const expanded = parsed.edges.filter((e) => e.expandedFrom && e.prerequisite === 's-prereq-security-defaults')
    assert.ok(expanded.length > 0)
    for (const e of expanded) {
      assert.equal(e.action, 'enforce')
      assert.equal(e.condition, 'sd-enabled')
      assert.equal(e.prerequisite, 's-prereq-security-defaults')
    }
    assert.equal(new Set(expanded.map((e) => e.step)).size, expanded.length)
  }
  // §8 owns every condition an edge uses; conditional edges carry a condition and hard edges none
  {
    const owned = new Map(parsed.conditions.map((c) => [c.name, c.ownedBy]))
    for (const e of parsed.edges) {
      assert.equal(e.edgeKind === 'conditional', e.condition !== null, `${e.step}:${e.action} ← ${e.prerequisite}`)
      if (e.condition) assert.ok(owned.has(e.condition), e.condition)
    }
  }
})

// Security Defaults enforce six things (Microsoft Learn, fundamentals/security-defaults,
// checked 2026-09-21): MFA registration, MFA for administrators, MFA for users when
// necessary, blocking legacy authentication, blocking device code flow, and protecting
// privileged activities such as the Azure portal. Turning them off drops all six at once,
// so the cutover may not start until something stands in for each. §10.1 carried four rows
// and missed device code, which is the one a reader would least expect to be there: a plan
// could have turned Security Defaults off with the device-code route left open behind it.
test('the Security Defaults cutover waits on a replacement for every protection it removes', () => {
  const inputs = data.edges.filter((e) => e.step === 's-prereq-security-defaults' && e.action === 'start' && e.prerequisiteKind === 'step')
  const planned = new Set(data.steps.map((x) => x.id))
  for (const e of inputs) {
    assert.equal(e.milestone, 'ready-to-enforce', e.prerequisite)
    assert.equal(e.condition, 'sd-enabled', e.prerequisite)
  }
  // What a plan built on the pinned baseline actually waits for. A row naming a step
  // outside the pin (azure-management-mfa) generates nothing and is not one of these;
  // Require MFA for Everyone reaches Azure management as All resources.
  const gating = inputs.map((e) => e.prerequisite).filter((id) => planned.has(id)).sort()
  assert.deepEqual(gating, [
    's-goal-admins-phishing-resistant',
    's-goal-block-device-code',
    's-goal-block-legacy-auth',
    's-goal-mfa-all-users',
  ], 'a protection Security Defaults removes has no replacement holding the cutover')
})

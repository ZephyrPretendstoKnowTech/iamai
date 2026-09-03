// The baseline-update review on the pinned package (derive/baselineDiff.ts):
// a changed file names its package policy however the repository spells the
// file, the steps it stands behind come from the goal map, and a policy no
// goal maps to changes no step.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { PINNED, pinnedPackage } from '../baseline/pinned.ts'
import { PINNED_GOAL_MAP, policyKey } from '../roadmap/goalMap.ts'
import { policyLabel, policyOfFile, stepsChangedBy } from './baselineDiff.ts'
import { mockAuthorUpdate } from '../testing/authorUpdate.ts'
import { baselineTile } from '../ui/scan/connectView.ts'

const pkg = pinnedPackage()
const mapped = new Set(Object.values(PINNED_GOAL_MAP).flat())
const inMap = PINNED.policies.find((p) => mapped.has(policyKey(p)))!
const outOfMap = PINNED.policies.find((p) => !mapped.has(policyKey(p)))!

test('a changed file names its package policy, whatever the separators, and a file the package lacks names itself', () => {
  const file = `Policies/${inMap.displayName.replace(/\s*-\s*/g, '---')}.json`
  assert.equal(policyOfFile(file, pkg.policies)?.displayName, inMap.displayName)
  assert.equal(policyOfFile(inMap.displayName, pkg.policies)?.displayName, inMap.displayName, 'the base name alone works too')
  assert.equal(policyOfFile('Policies/' + inMap.displayName.replace(/\s*-\s*/g, '_-_') + ' (1).json', pkg.policies)?.displayName, inMap.displayName, 'underscores and a (1) suffix')
  assert.equal(policyOfFile('Policies/IAC---OLD---BLOCK---Legacy.json', pkg.policies), null)
  assert.equal(policyLabel(file, pkg.policies), inMap.displayName)
  assert.equal(policyLabel('Policies/IAC---OLD---BLOCK---Legacy.json', pkg.policies), 'IAC - OLD - BLOCK - Legacy')
  assert.equal(policyLabel('Policies/ACME-_ZTCA_-_GLOBAL_-_BLOCK (1).json', pkg.policies), 'ACME- ZTCA - GLOBAL - BLOCK')
})

test('the steps a policy stands behind come from the goal map; a policy no goal maps to changes no step', () => {
  const steps = stepsChangedBy(`Policies/${inMap.displayName.replace(/\s*-\s*/g, '---')}.json`, pkg.policies, PINNED_GOAL_MAP)
  assert.ok(steps.length >= 1, `${inMap.displayName} stands behind a step`)
  for (const s of steps) assert.ok(s.length > 5 && !/\bpolicy\b/.test(s), `a step title: ${s}`)
  assert.deepEqual(stepsChangedBy(outOfMap.displayName, pkg.policies, PINNED_GOAL_MAP), [])
  assert.deepEqual(stepsChangedBy('Policies/IAC---OLD---BLOCK---Legacy.json', pkg.policies, PINNED_GOAL_MAP), [])
  // Every mapped policy in the package stands behind at least one step with a content title.
  for (const p of PINNED.policies.filter((x) => mapped.has(policyKey(x)))) assert.ok(stepsChangedBy(p.displayName, pkg.policies, PINNED_GOAL_MAP).length >= 1, `${p.displayName} maps to a step`)
})

test('the review rows on the pinned package name every changed policy and list the steps under each, or "no step changes"; no row reads "policy"', () => {
  const update = mockAuthorUpdate(new Date('2026-09-03T10:00:00.000Z'))
  const t = baselineTile({ name: 'Jon Hope — Defense in Depth', policyCount: pkg.policies.length, loading: null, update, labelFor: (f) => policyLabel(f, pkg.policies), stepsFor: (f) => stepsChangedBy(f, pkg.policies, PINNED_GOAL_MAP) })
  assert.ok(t.update)
  assert.equal(t.update.rows.length, 4)
  assert.deepEqual(
    t.update.rows.map((r) => r.tag),
    ['changed', 'added', 'changed', 'removed'],
  )
  assert.equal(t.update.rows[0].policy, inMap.displayName)
  assert.ok(t.update.rows[0].steps.length >= 1 && t.update.rows[0].steps.every((s) => /^changes .{5,}$/.test(s)), JSON.stringify(t.update.rows[0].steps))
  assert.deepEqual(t.update.rows[2].steps, ['no step changes'])
  assert.deepEqual(t.update.rows[3].steps, ['no step changes'])
  assert.equal(t.update.rows[3].policy, 'IAC - OLD - BLOCK - Legacy')
  for (const r of t.update.rows) assert.ok(r.policy.length > 3 && !/\bpolicy\b/.test(`${r.tag} ${r.policy} ${r.steps.join(' ')}`), `no row reads "policy": ${JSON.stringify(r)}`)
})

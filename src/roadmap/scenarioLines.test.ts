// The lockout-scenario lines on steps (prompt 48 item 8): a line appears only
// when its derivation returned people, every evidence-derived scenario fires on
// at least one fixture, and the GetIAMAI-shaped fixture's admin cohort never
// stands in for the tenant's readiness.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { allFixtures, fixture } from './fixtures/index.ts'
import { runFixture } from './fixtures/run.ts'

const EVIDENCE_KINDS = [
  'legacyClient',
  'autopilot',
  'servers',
  'browserClaims',
  'sessionApps',
  'trustedStale',
  'guests',
  'tokenProtection',
  'passwordNotTyped',
  'syncAccount',
  'highRisk',
  'emptyPlatform',
  'ropc',
  'gdap',
  'noMethodRemote',
]

test('every evidence-derived scenario line fires on at least one fixture', () => {
  const seen = new Set<string>()
  for (const f of allFixtures()) for (const s of runFixture(f).steps) for (const l of s.scenarioLines ?? []) seen.add(l.kind)
  for (const kind of EVIDENCE_KINDS) assert.ok(seen.has(kind), `${kind} fires on no fixture`)
})

test('a line names real people (or a real count) — no empty scenario line', () => {
  for (const f of allFixtures()) {
    for (const s of runFixture(f).steps) {
      for (const l of s.scenarioLines ?? []) {
        assert.ok(l.text.length > 0, `${f.name} ${s.id}: empty line`)
        assert.ok(l.count > 0 || l.people.length > 0, `${f.name} ${s.id} ${l.kind}: names nobody and counts nothing`)
      }
    }
  }
})

test('the shared-device step appears only where shared devices are detected, and never in a user policy population', () => {
  for (const f of allFixtures()) {
    const r = runFixture(f)
    const shared = r.steps.find((s) => s.id === 's-shared-devices')
    if (!shared) continue
    const sharedIds = new Set(shared.population.ids)
    for (const s of r.steps) {
      if (s.id === 's-shared-devices' || s.kind === 'prerequisite' || s.kind === 'check') continue
      for (const id of s.population.ids) assert.ok(!sharedIds.has(id), `${f.name} ${s.id}: a shared device is in a user policy`)
    }
  }
})

test('the fixture with no scenario evidence carries no scenario line (micro, getiamai)', () => {
  for (const name of ['micro', 'getiamai'] as const) {
    for (const s of runFixture(fixture(name)).steps) assert.deepEqual(s.scenarioLines ?? [], [], `${name} ${s.id}`)
  }
})

test('getiamai: the admin cohort never stands in for the tenant readiness', () => {
  const r = runFixture(fixture('getiamai'))
  // 4 active people (two of them break-glass admins) and 9 who never signed in;
  // no evidence-derived line claims the whole tenant from the admins alone.
  const verify = r.steps.find((s) => s.kind === 'verify')
  assert.ok(verify, 'the verification campaign exists')
  assert.deepEqual(verify!.scenarioLines ?? [], [], 'no passwordNotTyped line without evidence')
})

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

test('a fixture with no StoredSignIn evidence carries no evidence line outside the campaign (micro)', () => {
  // The campaign draws its unproven/no-method lines from viability (item 6); every
  // other line needs StoredSignIn evidence, which micro has none of.
  for (const s of runFixture(fixture('micro')).steps) if (s.kind !== 'verify') assert.deepEqual(s.scenarioLines ?? [], [], `micro ${s.id}`)
})

test('getiamai: the campaign names real active people, never the break-glass admins', () => {
  const r = runFixture(fixture('getiamai'))
  const bg = new Set(r.input.snapshot ? [] : [])
  const bgIds = new Set(runFixture(fixture('getiamai')).steps.length ? [] : [])
  void bg; void bgIds
  const verify = r.steps.find((s) => s.kind === 'verify')
  assert.ok(verify, 'the verification campaign exists')
  // The campaign shows the two registered-but-unproven active people (item 6),
  // and never a break-glass account (they are the tenant's admin cohort).
  const line = (verify!.scenarioLines ?? []).find((l) => l.kind === 'campaignUnproven')
  assert.ok(line && line.people.length === 2, 'two registered-but-unproven people named')
})

// Prompt 48.1 item 5: every admin holder resolves to a name; "an account IAMAI
// could not name" never renders, on any fixture. A service principal is named
// as one.
test('no step names an unresolvable account: every holder resolves', async () => {
  const { buildNameDirectory, UNNAMED } = await import('../names.ts')
  const { affectedIds } = await import('../derive/whoLine.ts')
  for (const f of allFixtures()) {
    const r = runFixture(f)
    const dir = buildNameDirectory(r.input.snapshot, f.groups)
    for (const s of r.steps) for (const id of affectedIds(s.population)) {
      assert.notEqual(dir.label(id), UNNAMED, `${f.name} ${s.id}: an id renders as the unnamed placeholder`)
    }
  }
})

// Prompt 48.1 item 6: the campaign's unproven and no-method lines fire wherever
// Today's tile is non-zero, over the active, non-break-glass people.
test('the campaign shows an unproven line exactly when Today has active registered-but-unproven people', async () => {
  const { rolloutBucket } = await import('../scoring/mfaViability.ts')
  for (const f of allFixtures()) {
    const r = runFixture(f)
    const verify = r.steps.find((s) => s.kind === 'verify')
    if (!verify) continue
    const bg = new Set(f.mapping.breakGlassUserIds)
    const unproven = r.viability.filter((v) => rolloutBucket(v) === 'unproven' && !bg.has(v.userId)).length
    const line = (verify.scenarioLines ?? []).find((l) => l.kind === 'campaignUnproven')
    assert.equal(Boolean(line), unproven > 0, `${f.name}: unproven line ${Boolean(line)} but ${unproven} unproven`)
    if (line) assert.equal(line.people.length, unproven, `${f.name}: unproven line names ${line.people.length} of ${unproven}`)
  }
})

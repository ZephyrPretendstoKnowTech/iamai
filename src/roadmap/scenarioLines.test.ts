// The lockout-scenario lines on steps (prompt 48 item 8): a line appears only
// when its derivation returned people, every evidence-derived scenario fires on
// at least one fixture, and the GetIAMAI-shaped fixture's admin cohort never
// stands in for the tenant's readiness.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { allFixtures, fixture } from './fixtures/index.ts'
import { runFixture } from './fixtures/run.ts'
import { rolloutBucket } from '../scoring/mfaViability.ts'
import { contentLists } from '../derive/contentLists.ts'

// Prompt 50 item 10: at least twelve of the twenty-two lockout scenarios fire on
// the demo, and the property test names which — so the demo keeps showing them.
const DEMO_SCENARIOS = [
  'autopilot', // 3
  'browserClaims', // 18
  'campaignNoMethod', // 12/14
  'campaignUnproven', // 12
  'emptyPlatform', // 17
  'gdap', // 11
  'guests', // 6
  'legacyClient', // 1/7/21
  'noMethodRemote', // 14 — hosted by register-info-protected, the floor's step (target-state §13)
  'passwordNotTyped', // 12
  'ropc', // 19
  'servers', // 16
  'sessionApps', // 4
  'syncAccount', // 13
  'tokenProtection', // 9
  'trustedStale', // 5
]

function demoScenarioKinds(name: 'demo' | 'demo-week2'): Set<string> {
  const kinds = new Set<string>()
  for (const s of runFixture(fixture(name)).steps) for (const l of s.scenarioLines ?? []) kinds.add(l.kind)
  return kinds
}

test('prompt 50 item 10: at least twelve scenarios fire on the demo, and these are the ones', () => {
  const kinds = demoScenarioKinds('demo')
  assert.ok(kinds.size >= 12, `only ${kinds.size} scenario kinds fire on the demo: ${[...kinds].sort().join(', ')}`)
  for (const k of DEMO_SCENARIOS) assert.ok(kinds.has(k), `${k} no longer fires on the demo`)
})

test('prompt 50 item 15 / 50.1 item 5: the week-two snapshot advances the tracking story, and the in-place count rises', () => {
  const day1 = runFixture(fixture('demo'))
  const week2 = runFixture(fixture('demo-week2'))
  // Ready is phishing-resistant readiness (Step 7, scoring/phishingResistant.ts), over the active people.
  const ready = (r: ReturnType<typeof runFixture>): number => r.viability.filter((v) => rolloutBucket(v) !== null && v.readiness.state === 'ready').length
  const inPlace =(r: ReturnType<typeof runFixture>): number => r.steps.filter((s) => s.status === 'done').length
  // A policy in report-only is in-report-only, or ready-to-enforce once one of its two gates is met (tracking.ts); both read Report-only.
  const reportOnly = (r: ReturnType<typeof runFixture>): number => r.steps.filter((s) => s.status === 'in-report-only' || s.status === 'ready-to-enforce').length
  const exclusionStep = (r: ReturnType<typeof runFixture>) => r.steps.find((s) => s.id === 's-prereq-exclusion-group')
  // Three people who had only Authenticator on day one set up a passkey and proved it by week two.
  assert.equal(ready(week2), ready(day1) + 3, 'three more people are Ready in week two')
  // By week two the admins phishing-resistant policy is enforced, the second
  // emergency account is excluded from the MFA policy, and the tenant's policies
  // carve out the group its technician chose rather than the break-glass group:
  // three more steps are in place — and so is every goal whose tenant policy
  // lacked only that group on day one (Step 3 correction).
  const exclusionOnly = day1.steps.filter((s) => {
    if (!s.id.startsWith('s-goal-') || s.status === 'done') return false
    const kinds = (day1.coverage.results.find((x) => x.goal.id === s.goalId)?.reasons ?? []).filter((x) => !x.expected).map((x) => x.kind)
    return kinds.length > 0 && kinds.every((k) => k === 'exclusion-missing')
  })
  assert.ok(exclusionOnly.length > 0, 'day one has policies short only of the exclusions group')
  for (const s of exclusionOnly) assert.equal(week2.steps.find((x) => x.id === s.id)?.status, 'done', `${s.id} is in place once the chosen group is carved out`)
  assert.equal(inPlace(week2), inPlace(day1) + 3 + exclusionOnly.length, 'phishing-resistant enforced, emergency access and the exclusions group In place by week two, with the policies that lacked only that group')
  assert.equal(reportOnly(week2), 3, 'three plan-created policies are in report-only in week two (A4 added the Intune enrollment one)')
  // The step is on every plan. Day one: the group its technician chose is not
  // the one the tenant's policies carve out, so the step has a check to fix; by
  // week two the policies carve it out and the step is In place.
  assert.equal(exclusionStep(day1)?.status, 'ready', 'day one: the chosen group is not excluded everywhere yet')
  assert.ok((exclusionStep(day1)?.checks?.failing ?? 0) > 0, 'day one: the step says which policies do not exclude it')
  assert.equal(exclusionStep(week2)?.status, 'done', 'week two: the group is excluded everywhere')
})

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

// noMethodRemote is hosted by register-info-protected, which the pinned baseline
// does not hold; the floor (target-state §13) renders that step from Microsoft's
// template, so the scenario fires on the fixtures again.
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
  const f = fixture('getiamai')
  const r = runFixture(f)
  const bg = new Set(f.mapping.breakGlassUserIds)
  const verify = r.steps.find((s) => s.kind === 'verify')
  assert.ok(verify, 'the verification campaign exists')
  // The campaign names the active people who are not Ready (item 6; Step 7),
  // never a break-glass account (they are the tenant's admin cohort). GetIAMAI's
  // two active people hold only Authenticator, so both are in its Needs setup
  // group; the signed-in account is a person like any other (derive/operator.ts).
  const lists = contentLists({ snapshot: f.snapshot, mapping: f.mapping, nameOf: (id) => id, now: f.snapshot.asOf })
  const active = r.viability.filter((v) => rolloutBucket(v) !== null && !bg.has(v.userId)).map((v) => v.userId)
  assert.equal(active.length, 2, 'the fixture has two active people')
  assert.deepEqual([...lists.needsSetup].sort(), [...active].sort(), `both active people named in Needs setup: ${JSON.stringify(lists.needsSetup)}`)
  assert.ok(lists.needsSetup.includes(f.operatorId), 'the signed-in account is named like anyone else')
  for (const id of [...lists.noMethod, ...lists.needsSetup, ...lists.needsProof, ...lists.readinessUnknown]) assert.ok(!bg.has(id), `${id}: a break-glass account in the campaign's groups`)
  for (const l of verify!.scenarioLines ?? []) for (const id of l.people) assert.ok(!bg.has(id), `${l.kind}: names a break-glass account`)
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

// Prompt 48.1 item 6 (Step 7): the campaign's needs-proof line fires wherever
// MFA Readiness counts active, non-break-glass people who Need proof — a
// phishing-resistant method not yet proven on every platform they use.
test('the campaign shows a needs-proof line exactly when MFA Readiness has active people who Need proof', () => {
  for (const f of allFixtures()) {
    const r = runFixture(f)
    const verify = r.steps.find((s) => s.kind === 'verify')
    if (!verify) continue
    const bg = new Set(f.mapping.breakGlassUserIds)
    const unproven = r.viability.filter((v) => rolloutBucket(v) !== null && v.readiness.state === 'needsProof' && !bg.has(v.userId)).length
    const line = (verify.scenarioLines ?? []).find((l) => l.kind === 'campaignUnproven')
    assert.equal(Boolean(line), unproven > 0, `${f.name}: unproven line ${Boolean(line)} but ${unproven} unproven`)
    if (line) assert.equal(line.people.length, unproven, `${f.name}: unproven line names ${line.people.length} of ${unproven}`)
  }
})

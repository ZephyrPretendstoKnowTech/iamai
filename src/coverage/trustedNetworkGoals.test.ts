// Owner, 2026-09-28: a Countries block (every location but the allowed countries,
// blocked) read as Restrict SharePoint and OneDrive, AVD and Service Accounts to
// the Trusted Network, Completed, with no such policy in the tenant. The four goals
// shared one signature key that took any location condition. A trusted-network
// goal is now delivered only by a block that carves out the trusted network, and
// the countries goal only by a policy that names a country location.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fixture } from '../roadmap/fixtures/index.ts'
import type { Fixture } from '../roadmap/fixtures/index.ts'
import { runFixture } from '../roadmap/fixtures/run.ts'
import { answerKey } from '../roadmap/answers.ts'
import { DIRECTION_LOCATIONS_STORAGE } from '../roadmap/directionAnswers.ts'
import { PREREQ_STEP_ID } from '../roadmap/stepIds.ts'
import { completedDaysOf } from '../roadmap/progress.ts'
import { EXCLUSIONS_RECORD_KEY } from '../mapping/safetyChoice.ts'
import { pinnedPackage } from '../baseline/pinned.ts'
import { CATALOGUE } from './coverage.ts'
import { goalsMatching, matchesSignature } from './classify.ts'
import { policyFacts } from './facts.ts'
import { buildStrengthLookup } from './strength.ts'
import { stepVars } from '../ui/surfaces/stepVars.ts'
import type { StepVarContext } from '../ui/surfaces/stepVars.ts'

const TRUSTED_GOALS = ['service-accounts-trusted-network', 'avd-trusted-network', 'sharepoint-trusted-network']
const COUNTRY = 'c0c0c0c0-0000-4000-8000-00000000c0c0'
const OFFICE = 'd1d1d1d1-0000-4000-8000-00000000d1d1'
const PARTNER = 'b4b4b4b4-0000-4000-8000-0000000b4b4b'
const SERVICE_ACCOUNTS_GROUP = '5a5a5a5a-0000-4000-8000-00000000005a'
const SHAREPOINT = '00000003-0000-0ff1-ce00-000000000000'
const none = buildStrengthLookup([])
const sig = (id: string) => CATALOGUE.find((g) => g.id === id)!.implementations[0].signature
const kinds = (trusted: string[] = [], countries: string[] = []) => ({ trusted: new Set(trusted), countries: new Set(countries) })
const block = (id: string, apps: string[], exclude: string[], users: Record<string, unknown> = { includeUsers: ['All'] }, include: string[] = ['All']) => ({
  id,
  displayName: id,
  state: 'enabled',
  conditions: { users, applications: { includeApplications: apps }, clientAppTypes: ['all'], locations: { includeLocations: include, excludeLocations: exclude } },
  grantControls: { operator: 'OR', builtInControls: ['block'] },
})

test('a Countries block is the countries goal and no trusted-network goal', () => {
  const countries = policyFacts(block('p', ['All'], [COUNTRY]), none, false, kinds([OFFICE], [COUNTRY]))
  assert.equal(matchesSignature(countries, sig('geo-restriction')), true)
  for (const g of TRUSTED_GOALS) assert.equal(matchesSignature(countries, sig(g)), false, g)
  // A blocked-countries include is the countries goal's too.
  assert.equal(matchesSignature(policyFacts(block('p', ['All'], [], { includeUsers: ['All'] }, [COUNTRY]), none, false, kinds([], [COUNTRY])), sig('geo-restriction')), true)
})

test('a block that carves out only the trusted network is the trusted-network goals’ shape, and never the countries goal', () => {
  const sharePoint = policyFacts(block('p', [SHAREPOINT], ['AllTrusted']), none)
  assert.equal(matchesSignature(sharePoint, sig('sharepoint-trusted-network')), true)
  const office = policyFacts(block('p', ['All'], [OFFICE]), none, false, kinds([OFFICE]))
  assert.equal(matchesSignature(office, sig('service-accounts-trusted-network')), true)
  assert.equal(matchesSignature(office, sig('geo-restriction')), false, 'a block outside the trusted network is not the countries goal')
  assert.equal(matchesSignature(policyFacts(block('p', ['All'], ['AllTrusted']), none), sig('geo-restriction')), false)
  // A location that is neither marked trusted nor the plan's office is not the trusted network, nor a country.
  const unknown = policyFacts(block('p', ['All'], [OFFICE]), none, false, kinds())
  assert.equal(matchesSignature(unknown, sig('service-accounts-trusted-network')), false)
  assert.equal(matchesSignature(unknown, sig('geo-restriction')), false)
})

test('the pinned baseline’s own trusted-network blocks match their own goals, and its Countries policy the countries goal alone', () => {
  const pin = pinnedPackage().policies as unknown as { displayName: string }[]
  const facts = (name: RegExp) => policyFacts(pin.find((p) => name.test(p.displayName))!, none)
  assert.equal(matchesSignature(facts(/SharePoint-OneDrive-NonTrustedLocations/), sig('sharepoint-trusted-network')), true)
  assert.equal(matchesSignature(facts(/AVD - NonTrustedLocations/), sig('avd-trusted-network')), true)
  // The author's own trusted IP location, read through the pin's placeholders.
  assert.equal(matchesSignature(facts(/BLOCK – Service Accounts/), sig('service-accounts-trusted-network')), true)
  // Of the four goals a location condition decides, the Countries policy is the countries goal's alone.
  const matched = goalsMatching(facts(/Countries not Allowed$/), CATALOGUE).map((g) => g.id)
  assert.deepEqual(matched.filter((g) => g === 'geo-restriction' || TRUSTED_GOALS.includes(g)), ['geo-restriction'])
})

/** demo with AVD and SharePoint in use, the office answer given, a service-accounts group, and a country location. */
function demoWith(office: 'office' | 'remote', policies: (ex: string) => Record<string, unknown>[]): Fixture {
  const f = structuredClone(fixture('demo'))
  f.mapping.workflowAnswers = { ...(f.mapping.workflowAnswers ?? {}), avd: 'yes', sharepoint: 'yes' }
  const on = { on: true, reason: 'confirmed in use' }
  f.mapping.facetOverrides = { ...f.mapping.facetOverrides, avd: on, sharepoint: on }
  const head = (f.snapshot.config.namedLocations!.rows as { id: string; isTrusted?: boolean }[]).find((l) => l.isTrusted === true)!.id
  f.mapping.trustedLocationIds = office === 'office' ? [head] : []
  f.mapping.questionAnswers = { ...(f.mapping.questionAnswers ?? {}), [answerKey(DIRECTION_LOCATIONS_STORAGE, 'officeNetwork')]: office }
  f.groups = new Map([...f.groups, [SERVICE_ACCOUNTS_GROUP, { id: SERVICE_ACCOUNTS_GROUP, displayName: 'Service accounts', memberIds: [...f.mapping.serviceAccountUserIds], sampled: false } as never]])
  f.mapping.serviceAccountsGroupId = SERVICE_ACCOUNTS_GROUP
  const rows = f.snapshot.config.namedLocations!.rows as unknown[]
  rows.push({ '@odata.type': '#microsoft.graph.countryNamedLocation', id: COUNTRY, displayName: 'Allowed countries', countriesAndRegions: ['AU'], countryLookupMethod: 'clientIpAddress', includeUnknownCountriesAndRegions: false })
  rows.push({ '@odata.type': '#microsoft.graph.ipNamedLocation', id: PARTNER, displayName: 'Partner site', isTrusted: false, ipRanges: [{ cidrAddress: '198.51.100.0/24' }] })
  const ex = (f.mapping.records[EXCLUSIONS_RECORD_KEY] as { resolvedId?: string } | undefined)?.resolvedId ?? ''
  ;(f.snapshot.config.caPolicies!.rows as unknown[]).push(...policies(ex))
  return f
}

const headOf = (f: Fixture): string => f.mapping.trustedLocationIds[0]
const opsOf = (f: Fixture, goal: string, r = runFixture(f)) => (r.steps.find((s) => s.goalId === goal)?.action.resolution?.policies ?? []).map((p) => [p.mode, p.policyId ?? null] as const)

// Review of 453d250b: beside AllTrusted, the Countries block stayed a narrower
// candidate of the three, and each step said the tenant "already covers this" with
// it and to review whether it could be retired: the tenant's only Countries policy.
test('a Countries block that also carves out the trusted network is no trusted-network goal’s policy, and no step names it as coverage', () => {
  for (const also of [() => 'AllTrusted', headOf] as const) {
    const f = demoWith('office', () => [])
    const ex = (f.mapping.records[EXCLUSIONS_RECORD_KEY] as { resolvedId?: string }).resolvedId!
    ;(f.snapshot.config.caPolicies!.rows as unknown[]).push(block('p-countries', ['All'], [COUNTRY, also(f)], { includeUsers: ['All'], excludeGroups: [ex] }))
    const r = runFixture(f)
    const ctx = { snapshot: f.snapshot, mapping: f.mapping, groups: f.groups, nameOf: (id: string) => r.input.names!.label(id), signature: 'IT', operatorId: f.operatorId, now: f.snapshot.asOf, reportOnlyAt: null } as unknown as StepVarContext
    for (const g of TRUSTED_GOALS) {
      const c = r.coverage.results.find((x) => x.goal.id === g)!
      assert.ok(!c.candidates.some((x) => x.policyId === 'p-countries'), `${g} (${also(f)}): the Countries block is a candidate`)
      assert.notEqual(c.status, 'enforced', `${g}: ${c.status}`)
      const step = r.steps.find((s) => s.goalId === g)!
      assert.notEqual(step.status, 'done', g)
      assert.ok(!opsOf(f, g, r).some(([, id]) => id === 'p-countries'), `${g}: ${JSON.stringify(opsOf(f, g, r))}`)
      assert.ok(!step.deliveredBy.some((d) => d.startsWith('p-countries')), `${g}: ${JSON.stringify(step.deliveredBy)}`)
      assert.deepEqual(stepVars(step, ctx).existingPolicies, [], `${g}: the step names the Countries block as coverage it might retire`)
    }
    assert.equal(r.coverage.results.find((x) => x.goal.id === 'geo-restriction')!.candidates.some((x) => x.policyId === 'p-countries'), true, 'the Countries block is not the countries goal’s')
  }
})

// Same review: an all-apps block for everyone that carves out the trusted network
// and a partner site applies here only under narrower conditions and reaches
// beyond SharePoint, AVD and the service accounts, so a step of theirs never
// makes it redundant and never names it as coverage to retire.
test('an all-apps block with a partner carve-out is never named as coverage the trusted-network steps supersede', () => {
  const f = demoWith('office', () => [])
  const ex = (f.mapping.records[EXCLUSIONS_RECORD_KEY] as { resolvedId?: string }).resolvedId!
  ;(f.snapshot.config.caPolicies!.rows as unknown[]).push(block('p-ztca', ['All'], ['AllTrusted', PARTNER], { includeUsers: ['All'], excludeGroups: [ex] }))
  const r = runFixture(f)
  const ctx = { snapshot: f.snapshot, mapping: f.mapping, groups: f.groups, nameOf: (id: string) => r.input.names!.label(id), signature: 'IT', operatorId: f.operatorId, now: f.snapshot.asOf, reportOnlyAt: null } as unknown as StepVarContext
  let seen = 0
  for (const g of TRUSTED_GOALS) {
    const c = r.coverage.results.find((x) => x.goal.id === g)!
    const cand = c.candidates.find((x) => x.policyId === 'p-ztca')
    if (cand) {
      seen++
      assert.ok(!cand.ownScope && cand.caveats.includes('conditions-narrower'), `${g}: the premise: a wider, narrower candidate: ${JSON.stringify(cand)}`)
    }
    const step = r.steps.find((s) => s.goalId === g)!
    assert.ok(!step.deliveredBy.some((d) => d.startsWith('p-ztca')), `${g}: ${JSON.stringify(step.deliveredBy)}`)
    assert.deepEqual(stepVars(step, ctx).existingPolicies, [], `${g}: the step names the all-apps block as coverage it might retire`)
  }
  assert.ok(seen > 0, 'the premise: the all-apps block is a candidate of a trusted-network goal')
})

test('the plan’s own office network is the trusted network before the tenant marks it trusted', () => {
  const sa = (exclude: (f: Fixture) => string) => (f: Fixture, ex: string) => block('p-sa', ['All'], [exclude(f)], { includeGroups: [SERVICE_ACCOUNTS_GROUP], excludeGroups: [ex] })
  const candidates = (f: Fixture) => runFixture(f).coverage.results.find((x) => x.goal.id === 'service-accounts-trusted-network')!.candidates.map((c) => c.policyId)
  const picked = demoWith('office', () => [])
  ;(picked.snapshot.config.namedLocations!.rows as { id: string; isTrusted?: boolean }[]).find((l) => l.id === headOf(picked))!.isTrusted = false
  ;(picked.snapshot.config.caPolicies!.rows as unknown[]).push(sa(headOf)(picked, (picked.mapping.records[EXCLUSIONS_RECORD_KEY] as { resolvedId?: string }).resolvedId!))
  assert.ok(candidates(picked).includes('p-sa'), 'a block outside the picked office, not yet marked trusted, is not the service-accounts block')
  // A location that is neither marked trusted nor picked is not the trusted network.
  const partner = demoWith('office', () => [])
  ;(partner.snapshot.config.caPolicies!.rows as unknown[]).push(sa(() => PARTNER)(partner, (partner.mapping.records[EXCLUSIONS_RECORD_KEY] as { resolvedId?: string }).resolvedId!))
  assert.ok(!candidates(partner).includes('p-sa'), 'a block outside a partner site read as the service-accounts block')
})

// Policy identity is the name (owner, 2026-10-04): the coverage reading is as it
// was, but a block under the tenant's own name is no longer the step's by its
// controls. Under its own name the step builds the baseline's in Report-only and
// lists the tenant's beside it; carrying the baseline's name, it is the step's own
// and its partner carve-out is corrected in place.
test('a tenant’s block that carves out the trusted network and a partner site is listed beside the baseline’s, and corrected in place once it carries the baseline’s name', () => {
  const cases = [
    { goal: 'sharepoint-trusted-network', id: 'p-sp', policy: (_f: Fixture, ex: string) => block('p-sp', [SHAREPOINT], ['AllTrusted', PARTNER], { includeUsers: ['All'], excludeGroups: [ex] }) },
    { goal: 'service-accounts-trusted-network', id: 'p-sa', policy: (f: Fixture, ex: string) => block('p-sa', ['All'], [headOf(f), PARTNER], { includeGroups: [SERVICE_ACCOUNTS_GROUP], excludeGroups: [ex] }) },
  ]
  for (const c of cases) {
    const f = demoWith('office', () => [])
    const ex = (f.mapping.records[EXCLUSIONS_RECORD_KEY] as { resolvedId?: string }).resolvedId!
    ;(f.snapshot.config.caPolicies!.rows as unknown[]).push(c.policy(f, ex))
    const r = runFixture(f)
    const result = r.coverage.results.find((x) => x.goal.id === c.goal)!
    const own = result.candidates.find((x) => x.policyId === c.id)
    assert.ok(own, `${c.goal}: the tenant's block is not the goal's policy`)
    assert.ok(own.caveats.includes('conditions-narrower'), `${c.goal}: the partner carve-out is not named: ${own.caveats}`)
    assert.notEqual(result.status, 'enforced', c.goal)
    const step = r.steps.find((s) => s.goalId === c.goal)!
    assert.deepEqual(opsOf(f, c.goal, r), [['create', null]], `${c.goal}: the tenant's block under its own name was edited`)
    assert.deepEqual((step.action.besidePolicies ?? []).map((b) => b.policyId), [c.id], `${c.goal}: the tenant's block is not listed beside the baseline's`)
    // The same block carrying the baseline's name is the step's own.
    const named = structuredClone(f)
    ;(named.snapshot.config.caPolicies!.rows as { id: string; displayName: string }[]).find((p) => p.id === c.id)!.displayName = step.createName!
    const ops = opsOf(named, c.goal)
    assert.ok(ops.some(([mode, id]) => mode === 'update' && id === c.id), `${c.goal}: ${JSON.stringify(ops)}`)
    assert.ok(!ops.some(([mode]) => mode === 'create'), `${c.goal}: a second block beside the plan's own: ${JSON.stringify(ops)}`)
  }
})

test('the Countries step never offers to rewrite the service-accounts block', () => {
  for (const variant of ['marked trusted, not picked', 'picked, not yet trusted', 'named locations unread'] as const) {
    const f = demoWith('office', () => [])
    f.mapping = { ...f.mapping, allowedCountries: ['AU'], workCountriesConfirmed: true, wizardAnswered: { ...f.mapping.wizardAnswered, countries: true } }
    const saStep = runFixture(f).steps.find((s) => s.goalId === 'service-accounts-trusted-network')!
    ;(f.snapshot.config.caPolicies!.rows as unknown[]).push({ ...JSON.parse(saStep.action.json!), id: 'p-plan-sa', displayName: 'Service accounts outside the trusted network', state: 'enabled' })
    const head = (f.snapshot.config.namedLocations!.rows as { id: string; isTrusted?: boolean }[]).find((l) => l.id === headOf(f))!
    // The tenant's own mark alone: the plan picked no office, so only the scan says the location is trusted.
    if (variant === 'marked trusted, not picked') f.mapping = { ...f.mapping, trustedLocationIds: [] }
    if (variant === 'picked, not yet trusted') head.isTrusted = false
    if (variant === 'named locations unread') f.snapshot.config.namedLocations = { ...f.snapshot.config.namedLocations!, status: 'error' } as never
    const r = runFixture(f)
    const geo = opsOf(f, 'geo-restriction', r)
    assert.ok(!geo.some(([, id]) => id === 'p-plan-sa'), `${variant}: the Countries step takes the service-accounts block: ${JSON.stringify(geo)}`)
    const sa = r.coverage.results.find((x) => x.goal.id === 'service-accounts-trusted-network')!
    assert.ok(sa.candidates.some((c) => c.policyId === 'p-plan-sa'), `${variant}: the service-accounts block is not its own goal's policy`)
  }
})

test('a completion the Countries block earned is not kept, and not brought back when the real block completes', () => {
  const f = demoWith('office', (ex) => [block('p-countries', ['All'], [COUNTRY], { includeUsers: ['All'], excludeGroups: [ex] })])
  const earlier = '2026-08-20T09:00:00.000Z'
  const id = 's-goal-sharepoint-trusted-network'
  const r = runFixture({ ...f, completedAt: { [id]: earlier } }, {}, null, f.snapshot.asOf)
  const step = r.steps.find((s) => s.id === id)!
  assert.notEqual(step.status, 'done', 'the Countries block completed Restrict SharePoint and OneDrive')
  assert.equal(step.completedAt ?? null, null, 'an open step kept the day the Countries block completed it')
  const record = completedDaysOf(r.steps)
  assert.equal(record[id], undefined, 'the plan record keeps the false completion')
  // The next scan reads the record this one wrote; the real block, built as the step writes it, completes on its own day.
  const built = structuredClone(f)
  ;(built.snapshot.config.caPolicies!.rows as unknown[]).push({ ...JSON.parse(step.action.json!), id: 'p-sp', state: 'enabled' })
  const later = runFixture({ ...built, completedAt: record }, {}, null, built.snapshot.asOf).steps.find((s) => s.id === id)!
  assert.equal(later.status, 'done', 'the block built as the step writes it does not complete the step')
  assert.notEqual(later.completedAt, earlier, 'the stale completed day came back')
})

test('with an office and no trusted location yet, the SharePoint and AVD blocks wait on Define the Trusted Network', () => {
  const f = demoWith('office', (ex) => [block('p-countries', ['All'], [COUNTRY], { includeUsers: ['All'], excludeGroups: [ex] })])
  for (const l of f.snapshot.config.namedLocations!.rows as { isTrusted?: boolean }[]) if (l.isTrusted) l.isTrusted = false
  const r = runFixture(f)
  const trusted = r.steps.find((s) => s.id === PREREQ_STEP_ID.trustedLocation)
  assert.ok(trusted && trusted.status !== 'done' && trusted.doesntApply == null, 'the premise: Define the Trusted Network is open')
  for (const g of TRUSTED_GOALS) {
    const step = r.steps.find((s) => s.goalId === g)!
    assert.notEqual(step.status, 'done', g)
    assert.ok(step.blockers.some((b) => b.kind === 'step' && b.stepId === PREREQ_STEP_ID.trustedLocation), `${g} does not wait on Define the Trusted Network: ${JSON.stringify(step.blockers)}`)
  }
})

// Review of 453d250b: each part of the reading, with a test of its own.

test('an IP location the tenant marks trusted is the trusted network though the plan picked another office', () => {
  const f = demoWith('office', () => [])
  const branch = 'e3e3e3e3-0000-4000-8000-00000000e3e3'
  ;(f.snapshot.config.namedLocations!.rows as unknown[]).push({ '@odata.type': '#microsoft.graph.ipNamedLocation', id: branch, displayName: 'Branch office', isTrusted: true, ipRanges: [{ cidrAddress: '203.0.113.0/24' }] })
  const ex = (f.mapping.records[EXCLUSIONS_RECORD_KEY] as { resolvedId?: string }).resolvedId!
  ;(f.snapshot.config.caPolicies!.rows as unknown[]).push(block('p-sa', ['All'], [branch], { includeGroups: [SERVICE_ACCOUNTS_GROUP], excludeGroups: [ex] }))
  assert.ok(!f.mapping.trustedLocationIds.includes(branch), 'the premise: the plan did not pick the branch')
  const r = runFixture(f)
  assert.ok(r.coverage.results.find((x) => x.goal.id === 'service-accounts-trusted-network')!.candidates.some((c) => c.policyId === 'p-sa'), 'a block outside a location the tenant marks trusted is not the service-accounts block')
})

test('a block that applies only at one location is no trusted-network block, whatever it carves out', () => {
  const f = demoWith('office', (ex) => [block('p-sp', [SHAREPOINT], ['AllTrusted'], { includeUsers: ['All'], excludeGroups: [ex] }, [PARTNER])])
  const r = runFixture(f)
  for (const g of TRUSTED_GOALS) assert.ok(!r.coverage.results.find((x) => x.goal.id === g)!.candidates.some((c) => c.policyId === 'p-sp'), g)
})

test('only the trusted-network goals read a carve-out beside the trusted network as narrower: a compliant-device policy that also spares a partner site is judged as before', () => {
  const f = demoWith('office', (ex) => [{ ...block('p-device', ['All'], ['AllTrusted', PARTNER], { includeUsers: ['All'], excludeGroups: [ex] }), grantControls: { operator: 'OR', builtInControls: ['compliantDevice'] } }])
  const r = runFixture(f)
  const own = r.coverage.results.find((x) => x.goal.id === 'require-managed-device')!.candidates.find((c) => c.policyId === 'p-device')
  assert.ok(own, 'the premise: the policy is the compliant-device goal’s')
  assert.ok(!own.caveats.includes('conditions-narrower'), `a compliant-device policy read as narrower for its partner carve-out: ${own.caveats}`)
})

test('a block that carves out only trusted locations, two of them, is not narrower', () => {
  const f = demoWith('office', () => [])
  const ex = (f.mapping.records[EXCLUSIONS_RECORD_KEY] as { resolvedId?: string }).resolvedId!
  ;(f.snapshot.config.caPolicies!.rows as unknown[]).push(block('p-sp', [SHAREPOINT], ['AllTrusted', headOf(f)], { includeUsers: ['All'], excludeGroups: [ex] }))
  const own = runFixture(f).coverage.results.find((x) => x.goal.id === 'sharepoint-trusted-network')!.candidates.find((c) => c.policyId === 'p-sp')
  assert.ok(own, 'the premise: the block is the SharePoint goal’s')
  assert.ok(!own.caveats.includes('conditions-narrower'), `AllTrusted beside the office read as narrower: ${own.caveats}`)
})

// Review of 453d250b: a scan that did not read the named locations read the
// tenant's Countries block as no policy at all. The step reopened as a create of
// a second Countries policy, and the plan record lost the day it was completed.
test('a scan that did not read the named locations holds the Countries step, and keeps the day it was completed', () => {
  const f = demoWith('office', (ex) => [block('p-countries', ['All'], [COUNTRY], { includeUsers: ['All'], excludeGroups: [ex] })])
  const id = 's-goal-geo-restriction'
  // Policy identity is the name (owner, 2026-10-04): the Countries block is the
  // step's own, as this case needs, once it carries the baseline's name.
  ;(f.snapshot.config.caPolicies!.rows as { id: string; displayName: string }[]).find((p) => p.id === 'p-countries')!.displayName = runFixture(f).steps.find((s) => s.id === id)!.createName!
  const earlier = '2026-08-20T09:00:00.000Z'
  const first = runFixture({ ...f, completedAt: { [id]: earlier } }, {}, null, f.snapshot.asOf)
  assert.equal(first.steps.find((s) => s.id === id)!.status, 'done', 'the premise: the Countries block completes the Countries step')
  const record = completedDaysOf(first.steps)
  assert.equal(record[id], earlier)
  // The next scan could not read the named locations: its rows are there, but nothing it says about them is read.
  const unread = structuredClone(f)
  unread.snapshot.config.namedLocations = { ...unread.snapshot.config.namedLocations!, status: 'error' } as never
  const second = runFixture({ ...unread, completedAt: record }, {}, null, unread.snapshot.asOf)
  const held = second.steps.find((s) => s.id === id)!
  assert.equal(second.coverage.results.find((x) => x.goal.id === 'geo-restriction')!.status, 'unknown', 'an unread scan read the Countries block as known')
  assert.deepEqual(opsOf(unread, 'geo-restriction', second), [], 'the Countries step offers a create or an update on a scan that could not place the block')
  assert.ok(held.blockers.some((b) => b.kind === 'evidence' && b.unverified === true), `the step does not hold for the named locations: ${JSON.stringify(held.blockers)}`)
  const kept = completedDaysOf(second.steps, record)
  assert.equal(kept[id], earlier, 'the plan record lost the day the Countries step was completed')
  // The scan after that reads them again: the step is complete on its first day.
  const third = runFixture({ ...f, completedAt: kept }, {}, null, f.snapshot.asOf).steps.find((s) => s.id === id)!
  assert.equal(third.status, 'done')
  assert.equal(third.completedAt, earlier, 'the Countries step completed on a new day')
})

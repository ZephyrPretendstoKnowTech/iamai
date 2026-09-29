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

test('a Countries block that also carves out AllTrusted credits no trusted-network goal, and no trusted-network step rewrites it', () => {
  const f = demoWith('office', (ex) => [block('p-countries', ['All'], [COUNTRY, 'AllTrusted'], { includeUsers: ['All'], excludeGroups: [ex] })])
  const r = runFixture(f)
  for (const g of TRUSTED_GOALS) {
    const c = r.coverage.results.find((x) => x.goal.id === g)!
    assert.notEqual(c.status, 'enforced', `${g}: ${c.status}`)
    const step = r.steps.find((s) => s.goalId === g)!
    assert.notEqual(step.status, 'done', g)
    assert.ok(!opsOf(f, g, r).some(([mode, id]) => mode === 'update' && id === 'p-countries'), `${g}: ${JSON.stringify(opsOf(f, g, r))}`)
  }
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

test('a tenant’s own block that carves out the trusted network and a partner site stays the step’s policy, corrected in place', () => {
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
    const ops = opsOf(f, c.goal, r)
    assert.ok(ops.some(([mode, id]) => mode === 'update' && id === c.id), `${c.goal}: ${JSON.stringify(ops)}`)
    assert.ok(!ops.some(([mode]) => mode === 'create'), `${c.goal}: a second block beside the tenant's: ${JSON.stringify(ops)}`)
  }
})

test('the Countries step never offers to rewrite the service-accounts block', () => {
  for (const variant of ['trusted', 'picked, not yet trusted', 'named locations unread'] as const) {
    const f = demoWith('office', () => [])
    f.mapping = { ...f.mapping, allowedCountries: ['AU'], workCountriesConfirmed: true, wizardAnswered: { ...f.mapping.wizardAnswered, countries: true } }
    const saStep = runFixture(f).steps.find((s) => s.goalId === 'service-accounts-trusted-network')!
    ;(f.snapshot.config.caPolicies!.rows as unknown[]).push({ ...JSON.parse(saStep.action.json!), id: 'p-plan-sa', displayName: 'Service accounts outside the trusted network', state: 'enabled' })
    const head = (f.snapshot.config.namedLocations!.rows as { id: string; isTrusted?: boolean }[]).find((l) => l.id === headOf(f))!
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

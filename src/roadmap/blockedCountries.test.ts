// v1.1 T2-NE (owner D4, 2026-10-03): Jon's "IAC - GLOBAL – BLOCK – Countries
// not Allowed - NoExclusions" as the optional second half of Block Sign-ins From
// Countries Not Allowed. Empty by default, and then nothing changes: the policy
// stays in the Plan's footer with its reason. With countries listed to block
// outright, 6.3 also makes a countries location holding them and Jon's policy
// (baseline name, exclusions group excluded, no other exception), created in
// Report-only and turned on with 6.3's turn-on. A country on both lists is
// refused. Nothing ever reads Jon's blocked list as the allowed one.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fixture } from './fixtures/index.ts'
import type { Fixture } from './fixtures/index.ts'
import { runFixture, withFoundationSettled } from './fixtures/run.ts'
import { applyStepDecisions } from './decisions.ts'
import { PREREQ_STEP_ID, stepIdForGoal } from './stepIds.ts'
import { PINNED_GOAL_MAP } from './goalMap.ts'
import { BLOCKED_COUNTRIES_SLOT, resolveTenantPolicy, tenantObjectsOf } from './resolvePolicy.ts'
import { buildPlanFile, parsePlanFile } from './plan.ts'
import { countriesLockout } from './countriesLockout.ts'
import { blockedCountriesCompanion, goalMapInUse } from '../coverage/companions.ts'
import { pinnedPackage } from '../baseline/pinned.ts'
import { notInPlanRows } from '../derive/notInPlan.ts'
import { emptyMappingState } from '../mapping/types.ts'
import { fixtureSnapshot } from '../testing/uiSnapshot.ts'
import { stepBodyOf } from '../ui/surfaces/stepBody.ts'
import { stepContract } from '../ui/surfaces/stepContract.ts'
import { blockedConflictLine } from '../ui/surfaces/countriesDecision.ts'
import type { StepVarContext } from '../ui/surfaces/stepVars.ts'
import type { Step } from './types.ts'

const GEO = stepIdForGoal('geo-restriction')
const LOCATION = PREREQ_STEP_ID.allowedCountries
const NO_EXCLUSIONS = 'IAC - GLOBAL – BLOCK – Countries not Allowed - NoExclusions'
const NO_EXCLUSIONS_ID = '1eaf943a-abad-4c77-b101-0c5342fc1044'
const ALLOWED_LOCATION = 'aaaaaaaa-0000-4000-8000-000000000001'
const BLOCKED_LOCATION = 'bbbbbbbb-0000-4000-8000-000000000002'

/** The sample, settled, with Australia allowed and the countries to block outright saved with Save Countries. */
function saved(blocked: string[], locations: { allowed?: boolean; blocked?: boolean } = {}): Fixture {
  const f0 = withFoundationSettled(fixture('demo'))
  const f: Fixture = { ...f0, mapping: applyStepDecisions(f0.mapping, { [LOCATION]: { picked: ['AU'], at: f0.snapshot.asOf, answers: { blockedOutright: blocked.join(', ') } } }) }
  if (!locations.allowed && !locations.blocked) return f
  const snapshot = structuredClone(f.snapshot)
  const country = (id: string, displayName: string, countriesAndRegions: string[]) => ({ '@odata.type': '#microsoft.graph.countryNamedLocation', id, displayName, countriesAndRegions, countryLookupMethod: 'clientIpAddress', includeUnknownCountriesAndRegions: false })
  if (locations.allowed) snapshot.config.namedLocations.rows.push(country(ALLOWED_LOCATION, 'Allowed', ['AU']))
  if (locations.blocked) snapshot.config.namedLocations.rows.push(country(BLOCKED_LOCATION, 'Blocked', blocked))
  return { ...f, snapshot }
}

const geoOf = (steps: readonly Step[]): Step => {
  const s = steps.find((x) => x.id === GEO)
  assert.ok(s, 'the premise: the plan carries the countries policy')
  return s
}
type Op = { mode: string; sourceName?: string; body: Record<string, any>; pending?: Record<string, any> }
const opsOf = (s: Step): Op[] => (s.action.resolution?.policies ?? []) as unknown as Op[]
const ctxOf = (f: Fixture, r: ReturnType<typeof runFixture>): StepVarContext => ({ snapshot: f.snapshot, mapping: r.input.mapping, nameOf: (id) => r.input.names!.label(id), signature: 'IT', operatorId: f.operatorId, now: f.snapshot.asOf, groups: f.groups, directory: r.input.directory, naming: r.coverage.organisation.naming })

test('T2-NE: with no country to block outright nothing changes, and Jon\'s NoExclusions block stays in the footer, optional', () => {
  const f = saved([])
  assert.equal(f.mapping.countriesBlockedOutright, undefined, 'the premise: none listed')
  const r = runFixture(f)
  const geo = geoOf(r.steps)
  assert.deepEqual(opsOf(geo).map((o) => o.sourceName), ['IAC - GLOBAL – BLOCK – Countries not Allowed'])
  assert.equal(blockedCountriesCompanion(f.baseline.policies as never, f.mapping.countriesBlockedOutright), null)
  const map = goalMapInUse(PINNED_GOAL_MAP, f.snapshot, null)
  const row = notInPlanRows(f.baseline.policies, r.steps, r.coverage, map).find((x) => x.policy === NO_EXCLUSIONS)
  assert.ok(row, 'the policy left the footer with nothing listed')
  assert.match(row.reason, /^Blocks a list of countries outright, even for travellers\. Optional: list them under Countries to block outright in Block Sign-ins From Countries Not Allowed/)
})

test('T2-NE: countries listed to block outright add Jon\'s NoExclusions block to 6.3 by its baseline name, excluding only the exclusions group, and a location holding them that 6.3 makes first; it leaves the footer', () => {
  const f = saved(['RU', 'KP'])
  assert.deepEqual(f.mapping.countriesBlockedOutright, ['RU', 'KP'])
  assert.equal(blockedCountriesCompanion(pinnedPackage().policies as never, ['RU']), NO_EXCLUSIONS_ID, 'Jon\'s policy is not found by its blocked-countries reading')
  const r = runFixture(f)
  const geo = geoOf(r.steps)
  const ops = opsOf(geo)
  assert.deepEqual(ops.map((o) => [o.mode, o.sourceName]), [['create', 'IAC - GLOBAL – BLOCK – Countries not Allowed'], ['create', NO_EXCLUSIONS]])
  const [allow, block] = ops
  assert.equal(block.body.displayName, NO_EXCLUSIONS, 'not the baseline\'s name')
  assert.equal(block.body.state, 'enabledForReportingButNotEnforced', 'not created in Report-only')
  assert.deepEqual(block.body.grantControls.builtInControls, ['block'])
  assert.deepEqual(block.body.conditions.users.includeUsers, ['All'])
  // The exclusions group stays excluded, as Jon wrote it; his author-environment group is dropped; no partner exception.
  assert.deepEqual(block.body.conditions.users.excludeGroups, allow.body.conditions.users.excludeGroups.filter((g: string) => !/^\{/.test(g)), 'the exclusions group is not what it excludes')
  assert.ok(allow.body.conditions.users.excludeGuestsOrExternalUsers, 'the premise: the sample excludes service providers from the allow-list block')
  assert.equal(block.body.conditions.users.excludeGuestsOrExternalUsers, undefined, 'blocked outright carries the partner exception')
  // Its location is the one 6.3 makes, named by the slot, never the allowed list.
  assert.deepEqual(block.pending?.conditions.locations.includeLocations, [BLOCKED_COUNTRIES_SLOT])
  assert.ok((geo.action.missing ?? []).some((m) => m.token === BLOCKED_COUNTRIES_SLOT && m.stepId === GEO), 'the location is not 6.3\'s own task')
  assert.ok(!geo.blockedBy.includes(GEO))
  // The footer no longer lists it.
  const map = goalMapInUse(PINNED_GOAL_MAP, f.snapshot, blockedCountriesCompanion(f.baseline.policies as never, f.mapping.countriesBlockedOutright))
  assert.deepEqual(map['geo-restriction'], [...PINNED_GOAL_MAP['geo-restriction'], NO_EXCLUSIONS_ID])
  assert.ok(!notInPlanRows(f.baseline.policies, r.steps, r.coverage, map).some((x) => x.policy === NO_EXCLUSIONS), 'the policy is on the plan and in the footer')
  // A country listed to block outright is left out on purpose: it holds no turn-on (T1-2).
  assert.deepEqual(countriesLockout(f.snapshot, { allowedCountries: ['NZ'], countriesBlockedOutright: ['AU'] }), [])
})

test('T2-NE: the Implementation Tasks make the blocked countries location, then both policies in Report-only, then turn both on; with the allowed location in place the blocked one is the next action, and the policy never names the allowed location', () => {
  {
    const f = saved(['RU', 'KP'], { allowed: true })
    const r = runFixture(f)
    const geo = geoOf(r.steps)
    const ctx = ctxOf(f, r)
    // The allowed location exists; the policy waits on the blocked one alone.
    assert.deepEqual((geo.action.missing ?? []).map((m) => m.token), [BLOCKED_COUNTRIES_SLOT])
    for (const o of opsOf(geo)) assert.ok(!JSON.stringify(o.body).includes(ALLOWED_LOCATION) || o.sourceName !== NO_EXCLUSIONS, 'Jon\'s blocked list read as the allowed location')
    const tasks = stepBodyOf(geo, ctx).emergencyAccountTasks?.tasks ?? []
    assert.deepEqual(tasks.map((t) => t.id), ['blocked-location', 'create', 'turn-on'])
    const location = tasks[0]
    assert.equal(location.title, 'Set up the blocked countries location')
    assert.ok(location.steps.some((l) => l.includes('**RU, KP**')), location.steps.join(' | '))
    assert.ok(location.steps.some((l) => l.includes('Named locations → + Countries location')))
    const create = tasks[1].steps.join(' | ')
    assert.match(create, /Name: \*\*IAC - GLOBAL – BLOCK – Countries not Allowed - NoExclusions\*\*/)
    assert.match(create, /include \*\*[^*]*Blocked[^*]*Countries\*\*/, 'the create does not name the blocked location')
    assert.ok(tasks[2].steps.join(' ').includes(NO_EXCLUSIONS), 'the turn-on leaves Jon\'s policy off')
    const c = stepContract(geo, ctx)
    assert.equal(c.milestone.label, 'Set up the blocked countries location', 'the next action is not the blocked location')
    assert.match(c.whatToDo.text, /RU, KP/)
  }
  {
    // Both locations in place: both policies are written whole, each with its own location.
    const f = saved(['RU', 'KP'], { allowed: true, blocked: true })
    const geo = geoOf(runFixture(f).steps)
    assert.deepEqual(geo.action.missing ?? [], [])
    const [allow, block] = opsOf(geo)
    assert.deepEqual(allow.body.conditions.locations, { excludeLocations: [ALLOWED_LOCATION], includeLocations: ['All'] })
    assert.deepEqual(block.body.conditions.locations, { excludeLocations: [], includeLocations: [BLOCKED_LOCATION] })
  }
})

test('T2-NE: the resolver reads Jon\'s blocked-countries location as its own slot, never the allowed countries location', () => {
  const policies = pinnedPackage().policies
  const source = policies.find((p) => p.displayName === NO_EXCLUSIONS)!
  const mapping = emptyMappingState('t-1')
  const withAllowed = tenantObjectsOf(mapping, ALLOWED_LOCATION, 'xg-1')
  const resolved = resolveTenantPolicy(source as never, withAllowed, 'geo-restriction', policies)
  const include = (resolved.body.conditions as { locations: { includeLocations: string[] } }).locations.includeLocations
  assert.deepEqual(include, [BLOCKED_COUNTRIES_SLOT])
  const placed = resolveTenantPolicy(source as never, { ...withAllowed, blockedCountriesLocationId: BLOCKED_LOCATION }, 'geo-restriction', policies)
  assert.deepEqual((placed.body.conditions as { locations: { includeLocations: string[] } }).locations.includeLocations, [BLOCKED_LOCATION])
})

test('T2-NE: a country on both lists is refused — by the decision, by the saved answer and by a plan file', () => {
  assert.equal(blockedConflictLine(['AU', 'NZ'], ['RU']), null)
  assert.equal(blockedConflictLine(['AU', 'NZ'], ['AU']), 'Australia is on the work countries above, so it cannot be blocked outright. Take it off one of the two lists.')
  assert.equal(blockedConflictLine(['AU', 'NZ'], ['nz', 'AU', 'RU']), 'New Zealand and Australia are on the work countries above, so they cannot be blocked outright. Take each off one of the two lists.')
  // A save that carries one anyway never blocks an allowed country.
  const at = '2026-10-03T00:00:00.000Z'
  const m = applyStepDecisions(emptyMappingState('t-1'), { [LOCATION]: { picked: ['AU'], at, answers: { blockedOutright: 'AU, RU' } } })
  assert.deepEqual(m.countriesBlockedOutright, ['RU'])
  assert.equal(Object.keys(m.questionAnswers ?? {}).some((k) => k.endsWith(':blockedOutright')), false, 'the list is stored twice')
  assert.equal(applyStepDecisions(m, { [LOCATION]: { picked: ['AU'], at, answers: { blockedOutright: '' } } }).countriesBlockedOutright, undefined, 'an emptied list still blocks')
  // A plan file carries the list, and refuses one that allows a country it blocks.
  const snapshot = fixtureSnapshot()
  const file = buildPlanFile({ planId: 'blocked-plan', snapshot, operator: { userId: 'u-1', userPrincipalName: 'alex@example.com' }, baselineSource: { kind: 'upload', fileName: 'synthetic.json' }, mapping: { ...emptyMappingState(snapshot.tenantId), allowedCountries: ['AU'], countriesBlockedOutright: ['RU'] }, steps: [], checkpoints: [] })
  assert.deepEqual(parsePlanFile(JSON.stringify(file)).plan?.mappings.countriesBlockedOutright, ['RU'])
  for (const bad of [['AU'], ['Russia'], 'RU']) {
    const broken = structuredClone(file) as { mappings: Record<string, unknown> }
    broken.mappings.countriesBlockedOutright = bad
    assert.match(parsePlanFile(JSON.stringify(broken)).error ?? '', /invalid countries blocked outright/, JSON.stringify(bad))
  }
})

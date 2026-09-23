// Block Sign-ins From Countries Not Allowed as ONE step (roadmap-flow Stage 3,
// V1 decision 5): the work countries picker, the countries location and the
// policy are one step's tasks, in the order the portal needs them. The location
// step (s-prereq-allowed-countries) is no longer built; its lockout checks and
// its old links come to 6.3, and the object 6.3 makes itself is its own task,
// never a wait on itself.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { curatedFixture, fixture } from '../../roadmap/fixtures/index.ts'
import type { Fixture, FixtureName } from '../../roadmap/fixtures/index.ts'
import { runFixture, withFoundationSettled } from '../../roadmap/fixtures/run.ts'
import { stepIdForGoal, REPAIR_STEP_ALIASES, PREREQ_STEP_ID } from '../../roadmap/stepIds.ts'
import { canonicalBlockerStepId } from '../../roadmap/blockerSteps.ts'
import { isHeld } from '../../roadmap/holds.ts'
import type { Step } from '../../roadmap/types.ts'
import { laneReadings } from './planLanes.ts'
import { planStateOf } from './planState.ts'
import { objectTaskBodyOf, stepBodyOf } from './stepBody.ts'
import type { StepVarContext } from './stepVars.ts'
import { applyStepDecisions } from '../../roadmap/decisions.ts'
import { existsSync, readFileSync } from 'node:fs'
import { packageSources } from '../../content/implementation/library.ts'
import registry from '../../content/implementation/registry.generated.json' with { type: 'json' }

const GEO = stepIdForGoal('geo-restriction')
const LOCATION = PREREQ_STEP_ID.allowedCountries

/** The tenant with no work country saved: nobody has answered the picker. */
function noCountries(f: Fixture): Fixture {
  return { ...f, mapping: { ...f.mapping, allowedCountries: [], workCountriesConfirmed: false, wizardAnswered: { ...f.mapping.wizardAnswered, countries: false } } }
}

const geoOf = (steps: readonly Step[]): Step => {
  const s = steps.find((x) => x.id === GEO)
  assert.ok(s, 'the premise: the plan carries the countries policy')
  return s
}

test('the countries location is not built as a step of its own; its old links open 6.3', () => {
  for (const name of ['getiamai', 'mid', 'small', 'demo'] as FixtureName[]) {
    const r = runFixture(withFoundationSettled(curatedFixture(name)))
    assert.equal(r.steps.some((s) => s.id === LOCATION), false, `${name}: the location step is still built`)
    geoOf(r.steps)
  }
  assert.equal(REPAIR_STEP_ALIASES[LOCATION], GEO)
  assert.equal(REPAIR_STEP_ALIASES['s-blocker-allowed-countries'], GEO)
  assert.equal(canonicalBlockerStepId('allowedCountries'), GEO)
})

test('6.3 is Ready or Up Next, never On Hold on a missing object it makes itself (getiamai, mid, small)', () => {
  for (const name of ['getiamai', 'mid', 'small'] as FixtureName[]) {
    for (const [label, f] of [['settled', withFoundationSettled(curatedFixture(name))], ['raw', fixture(name)]] as const) {
      const r = runFixture(f)
      const geo = geoOf(r.steps)
      const reading = laneReadings(r.steps, [], r.input.mapping).get(GEO)!
      assert.ok(!reading.blockers.some((b) => b.kind === 'missingObject'), `${name}/${label}: ${reading.lane} · missingObject`)
      assert.ok(!geo.blockedBy.includes(GEO), `${name}/${label}: 6.3 waits on itself`)
      assert.ok(!reading.blockers.some((b) => b.id === GEO), `${name}/${label}: 6.3 waits on itself`)
      if (label === 'settled') assert.ok(reading.lane === 'Ready' || reading.lane === 'Up Next', `${name}/${label}: ${reading.lane} · ${reading.reason?.kind}:${reading.reason?.id}`)
    }
  }
})

test('6.3 reads Needs decision while no work country is saved', () => {
  for (const name of ['getiamai', 'mid', 'small'] as FixtureName[]) {
    const r = runFixture(noCountries(withFoundationSettled(curatedFixture(name))))
    const geo = geoOf(r.steps)
    assert.equal(geo.state.condition, 'needs-decision', `${name}: its condition`)
    assert.equal(planStateOf(geo, isHeld(geo)).word, 'Needs decision', `${name}: its word`)
    const reading = laneReadings(r.steps, [], r.input.mapping).get(GEO)!
    assert.deepEqual([reading.lane, reading.substatus], ['Ready', 'Decision'], `${name}: its lane`)
  }
  // And a saved list releases it.
  const saved = geoOf(runFixture(withFoundationSettled(curatedFixture('getiamai'))).steps)
  assert.notEqual(saved.state.condition, 'needs-decision', 'a saved country list still reads Needs decision')
})

test('the lockout checks show on 6.3, and a blocking one holds its turn-on, never its report-only creation', () => {
  // The countries people sign in from, your own country, unknown countries: the
  // checks the location step carried (they were dropped once it was gone).
  for (const name of ['getiamai', 'mid', 'demo-week2'] as FixtureName[]) {
    const r = runFixture(withFoundationSettled(curatedFixture(name)))
    const checks = (geoOf(r.steps).configurationFindings ?? []).filter((f) => f.key.startsWith('cty.'))
    assert.ok(checks.length > 0, `${name}: no lockout check shows on 6.3`)
    for (const c of checks) assert.ok(['cty.seenCountriesIncluded', 'cty.includesOperator', 'cty.unknownCountries', 'cty.atLeastOne'].some((k) => c.key.startsWith(`${k}:`)), c.key)
  }
  // A blocking check (an empty confirmed list) holds the turn-on as it held the
  // location step, as a gate: the create in report-only is not held, and 6.3
  // never reads Completed over it.
  const f = withFoundationSettled(curatedFixture('getiamai'))
  const r = runFixture({ ...f, mapping: { ...f.mapping, allowedCountries: [], wizardAnswered: { ...f.mapping.wizardAnswered, countries: true } } })
  const geo = geoOf(r.steps)
  assert.ok((geo.configurationFindings ?? []).some((c) => c.key.startsWith('cty.atLeastOne:') && c.outcome === 'fail'), 'the premise: the empty list fails its blocking check')
  assert.ok(geo.blockers.some((b) => b.kind === 'readiness' && b.label === 'countries-unsafe' && typeof b.binding === 'string' && b.binding.length > 0), 'the blocking check does not hold the turn-on')
  assert.ok(!geo.blockedBy.includes(GEO), 'and it is no wait on itself')
  const reading = laneReadings(r.steps, [], r.input.mapping).get(GEO)!
  assert.ok(reading.gates.some((g) => g.id === 'evidence:readiness:countries-unsafe'), 'the hold is not a gate on the turn-on')
  assert.notEqual(reading.lane, 'Completed')
})

test('with an empty countries list, no step but 6.3 is held by it or waits on it', () => {
  for (const name of ['getiamai', 'mid', 'small', 'large', 'demo'] as FixtureName[]) {
    const f = fixture(name)
    const empty: Fixture = { ...f, mapping: { ...f.mapping, allowedCountries: [], wizardAnswered: { ...f.mapping.wizardAnswered, countries: true } } }
    const r = runFixture(empty)
    for (const s of r.steps) {
      if (s.id === GEO) continue
      assert.ok(!s.blockers.some((b) => b.label === 'countries-unsafe'), `${name}/${s.id}: held by the countries list`)
      assert.ok(!s.blockedBy.includes(GEO) && !s.blockedBy.includes(LOCATION), `${name}/${s.id}: waits on the countries step`)
    }
    const readings = laneReadings(r.steps, [], r.input.mapping)
    for (const [id, reading] of readings) {
      if (id === GEO) continue
      assert.ok(!reading.blockers.some((b) => b.id === GEO || b.id === LOCATION), `${name}/${id}: its reading waits on the countries step`)
    }
  }
})

test('6.3 draws the location as its own task in its one frame: the picker saved under the location id, then the location Implementation, then the policy', () => {
  const f = withFoundationSettled(curatedFixture('getiamai'))
  const r = runFixture(f)
  const geo = geoOf(r.steps)
  assert.equal(geo.objectTask?.id, LOCATION, 'the task keeps the location id, which its picker saves under')
  assert.equal(geo.objectTask?.state.satisfied, false, 'the premise: getiamai has no countries location yet')
  const ctx: StepVarContext = { snapshot: f.snapshot, mapping: r.input.mapping, nameOf: (id) => r.input.names!.label(id), signature: 'IT', operatorId: f.operatorId, now: f.snapshot.asOf, groups: f.groups, directory: r.input.directory, naming: r.coverage.organisation.naming }
  const body = stepBodyOf(geo, ctx)
  // Task 1: the picker, the location's own words, saved under its id.
  assert.equal(body.decides, true, 'the picker is not drawn')
  assert.equal(body.taskDecision?.stepId, LOCATION)
  assert.equal(body.taskDecision?.d.label, 'Work Countries')
  // Task 2: the location's own Implementation leads while it is to be made; task 3 is the policy's.
  const portal = body.artifacts.find((a) => a.id === 'portal')
  assert.ok(portal, 'the location task hands over no Entra procedure')
  assert.ok(portal.text().includes('Named locations → + Countries location'), portal.text())
  assert.deepEqual(body.emergencyAccountTasks?.tasks.map((t) => t.title), ['Set up the allowed countries location', 'Block Sign-ins From Countries Not Allowed'])
  // The location's words, first: its About sentence, its completion, its evidence and its risks.
  const location = objectTaskBodyOf(geo, ctx)!
  assert.ok(body.contract.why.startsWith(String(location.cs.why)), body.contract.why)
  assert.ok(body.contract.doneWhen[0].includes('the countries people work from'), body.contract.doneWhen.join(' | '))
  assert.ok(body.whoInline.some((b) => b.names.some((n) => n.startsWith('Australia'))), 'the countries the scan saw are not on 6.3')
  assert.ok((body.cs.more?.risks ?? []).some((x: { text?: string }) => (x.text ?? '').includes('Determine location by GPS coordinates')), 'the location risks are not on 6.3')
  // The frame draws one picker, and its Save lands under the location id.
  const content = readFileSync('src/ui/surfaces/ContentStep.tsx', 'utf8')
  assert.ok(content.includes('<Decision key={step.id} d={taskDecision?.d ?? d} ex={taskDecision?.ex ?? ex} saved={taskDecision ? objectTask?.saved ?? null : decision} onDecide={taskDecision ? objectTask?.onDecide : onDecide} stepId={taskDecision?.stepId ?? step.id}'), 'the picker is not the object task picker where the step has none')
  assert.ok(readFileSync('src/ui/surfaces/Plan.tsx', 'utf8').includes('objectTask={step.objectTask ? { saved: data.stepDecisions[step.objectTask.id] ?? null, onDecide: (d) => data.onDecide(step.objectTask!.id, d) }'), 'the Plan does not save the picker under the location id')
  // Until a work country is saved nothing to make is offered; a save there releases the step.
  const none = noCountries(f)
  const held = runFixture(none)
  assert.equal(geoOf(held.steps).state.condition, 'needs-decision', 'the premise: no country saved')
  assert.ok(!stepBodyOf(geoOf(held.steps), { ...ctx, mapping: held.input.mapping }).artifacts.some((a) => a.text().includes('Countries location')), 'a location is offered before any work country is saved')
  const saved = { ...none, mapping: applyStepDecisions(none.mapping, { [LOCATION]: { picked: ['AU'], at: f.snapshot.asOf } }) }
  assert.notEqual(geoOf(runFixture(saved).steps).state.condition, 'needs-decision', 'saving a country under the location id does not release it')
})


test('the countries location package is folded into the countries block package, tasks first, and compiles to the same two packages', () => {
  const dir = 'docs/implementation-content/s-goal-geo-restriction/s-goal-geo-restriction'
  assert.equal(existsSync('docs/implementation-content/s-prereq-allowed-countries'), false, 'the location still has a package folder of its own')
  const meta = JSON.parse(readFileSync(`${dir}/META.json`, 'utf8')) as { tasks?: { blockPrefix: string; meta: { stepId: string } }[] }
  assert.equal(meta.tasks?.[0]?.meta.stepId, LOCATION, 'the location is not the first task')
  const first = /@@IAMAI-BEGIN (\{.*\})/.exec(readFileSync(`${dir}/CONTENT.md`, 'utf8'))?.[1]
  assert.ok(first && (JSON.parse(first) as { id: string }).id.startsWith(meta.tasks![0].blockPrefix), 'the location blocks do not come first')
  assert.ok(readFileSync(`${dir}/STEP.md`, 'utf8').indexOf('# Task 1 — Create or Correct Allowed Countries Location') < readFileSync(`${dir}/STEP.md`, 'utf8').indexOf('# Task 2 — Block Sign-ins From Countries Not Allowed'))
  // The registry pipeline compiles the folder to the two packages the runtime reads, each under its own step id.
  assert.deepEqual(packageSources(dir).map((s) => (JSON.parse(s.metaJson) as { stepId: string }).stepId), [GEO, LOCATION])
  const packages = (registry as unknown as { packages: Record<string, { blocks: Record<string, unknown> }> }).packages
  assert.ok(packages[LOCATION]?.blocks['entra.create'], 'the location package is not in the registry under its own id')
  assert.ok(packages[GEO]?.blocks['entra.create'], 'the countries block package lost its own blocks')
  assert.equal(Object.keys(packages[GEO].blocks).some((id) => id.startsWith('location/')), false, 'the location blocks leaked into the policy package')
})

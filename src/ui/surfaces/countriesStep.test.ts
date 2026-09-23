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
import { laneReadings, observe } from './planLanes.ts'
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
      // Nor on the location as a step of its own, as it did before Stage 3.
      assert.ok(!geo.blockedBy.includes(LOCATION), `${name}/${label}: 6.3 waits on the location step`)
      assert.ok(!reading.blockers.some((b) => b.id === LOCATION), `${name}/${label}: 6.3's reading waits on the location step`)
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

test('the lockout checks show on 6.3; only the blocking one holds its turn-on, never its report-only creation, and the three warnings hold nothing', () => {
  // The countries people sign in from, your own country, unknown countries: the
  // checks the location step carried (they were dropped once it was gone). In
  // v1.0 they are warnings: each draws as Needs Correction and holds nothing
  // (owner, 2026-09-23; gating the turn-on on them is on the v1.1 list).
  for (const name of ['getiamai', 'mid', 'demo-week2'] as FixtureName[]) {
    const r = runFixture(withFoundationSettled(curatedFixture(name)))
    const geo = geoOf(r.steps)
    const checks = (geo.configurationFindings ?? []).filter((f) => f.key.startsWith('cty.'))
    assert.ok(checks.length > 0, `${name}: no lockout check shows on 6.3`)
    for (const c of checks) assert.ok(['cty.seenCountriesIncluded', 'cty.includesOperator', 'cty.unknownCountries', 'cty.atLeastOne'].some((k) => c.key.startsWith(`${k}:`)), c.key)
    if (!checks.some((c) => c.key.startsWith('cty.atLeastOne:'))) assert.ok(!geo.blockers.some((b) => b.label === 'countries-unsafe'), `${name}: a warning holds the turn-on`)
  }
  const warned = geoOf(runFixture(withFoundationSettled(curatedFixture('getiamai'))).steps)
  assert.ok((warned.configurationFindings ?? []).some((c) => c.key.startsWith('cty.unknownCountries:') && c.outcome !== 'pass'), 'the premise: getiamai fails a warning')
  assert.deepEqual(warned.blockers, [], 'a failing warning holds 6.3')
  // A blocking check (an empty confirmed list) holds the turn-on as it held the
  // location step, as a gate: the create in report-only is not held, and 6.3
  // never reads Completed over it. An empty list is also no work country saved,
  // so the step reads its question first (Ready · Decision), and the gate waits
  // behind it on the turn-on.
  const f = withFoundationSettled(curatedFixture('getiamai'))
  const r = runFixture({ ...f, mapping: { ...f.mapping, allowedCountries: [], wizardAnswered: { ...f.mapping.wizardAnswered, countries: true } } })
  const geo = geoOf(r.steps)
  assert.ok((geo.configurationFindings ?? []).some((c) => c.key.startsWith('cty.atLeastOne:') && c.outcome === 'fail'), 'the premise: the empty list fails its blocking check')
  assert.ok(geo.blockers.some((b) => b.kind === 'readiness' && b.label === 'countries-unsafe' && typeof b.binding === 'string' && b.binding.length > 0), 'the blocking check does not hold the turn-on')
  assert.ok(!geo.blockedBy.includes(GEO), 'and it is no wait on itself')
  const observed = observe(geo, new Map(r.steps.map((s) => [s.id, s])))
  assert.ok((observed.gates ?? []).some((g) => g.id === 'evidence:readiness:countries-unsafe'), 'the hold is not a gate on the turn-on')
  assert.ok(!(observed.blockers ?? []).some((b) => b.id.includes('countries-unsafe')), 'the hold blocks the report-only create')
  const reading = laneReadings(r.steps, [], r.input.mapping).get(GEO)!
  assert.deepEqual([reading.lane, reading.substatus], ['Ready', 'Decision'], 'the question does not come first')
})

test('with an empty confirmed list, 6.3 still asks for its work countries, and the hold on its turn-on names the location task', () => {
  const f = withFoundationSettled(curatedFixture('getiamai'))
  const r = runFixture({ ...f, mapping: { ...f.mapping, allowedCountries: [], wizardAnswered: { ...f.mapping.wizardAnswered, countries: true } } })
  const geo = geoOf(r.steps)
  const hold = geo.blockers.find((b) => b.kind === 'readiness' && b.label === 'countries-unsafe')
  assert.ok(hold, 'the premise: the empty list holds the turn-on')
  // No work country is saved, so the question comes first, as it does with no list at all.
  assert.equal(geo.state.condition, 'needs-decision', 'the countries check raised the question to Blocked')
  assert.equal(planStateOf(geo, isHeld(geo)).word, 'Needs decision')
  // The hold names what 6.3 does first as its task, never the step it used to be (D3).
  const TASK_TITLE = 'Set up the allowed countries location'
  assert.ok(hold.kind === 'readiness' && typeof hold.binding === 'string' && hold.binding.includes(TASK_TITLE), `the hold reads: ${hold.kind === 'readiness' ? hold.binding : ''}`)
  const said = [geo.blockedReason ?? '', ...geo.blockers.map((b) => ('binding' in b && typeof b.binding === 'string' ? b.binding : ''))]
  for (const line of said) assert.ok(!line.includes(RETIRED_TITLE), `names the retired step: ${line}`)
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

/** The retired step's title: nothing may name it as a step (D3). */
const RETIRED_TITLE = 'Create or Correct Allowed Countries Location'

/** 6.3 as the Plan draws it on getiamai, curated, the foundation settled and Direction approved: the board's lane, blockers and labels (as step-snapshots do). */
async function geoOnBoard() {
  const { withDirectionApproved } = await import('../../roadmap/fixtures/run.ts')
  const { boardHolds, boardReadingsOf, laneViewFor, prerequisiteLabelFor, readinessBlockersOf, waveStartOf } = await import('./planBoard.ts')
  const { planDates } = await import('./stepVars.ts')
  const f = withDirectionApproved(withFoundationSettled(curatedFixture('getiamai')))
  const r = runFixture(f, {}, null, f.snapshot.asOf)
  const board = boardReadingsOf(r.steps, r.schedule.cleanup, f.mapping.breakGlassAnswers ?? null)
  const prerequisiteLabel = prerequisiteLabelFor(board.readings)
  const dates = planDates(r.steps, r.schedule.start, r.coverage.organisation.naming, f.snapshot, (s) => boardHolds(s, laneViewFor(s, board)))
  const geo = geoOf(r.steps)
  const lane = laneViewFor(geo, board)
  const ctx: StepVarContext = { snapshot: f.snapshot, mapping: r.input.mapping, nameOf: (id) => r.input.names!.label(id), signature: 'IT', operatorId: f.operatorId, now: f.snapshot.asOf, ...dates, reportOnlyAt: geo.reportOnlyAt ?? null, scheduledOn: waveStartOf(geo), groups: f.groups, directory: r.input.directory, naming: r.coverage.organisation.naming }
  const body = stepBodyOf(geo, ctx, { lane, blockers: readinessBlockersOf(board.readings.get(GEO), board.titleOf), prerequisiteLabel })
  return { f, r, board, geo, lane, ctx, body, prerequisiteLabel }
}

test('6.3 offers its location task as its implementation: no Unavailable tile or card, and its next line and action name the task', async () => {
  const { geo, ctx, body } = await geoOnBoard()
  assert.equal(geo.objectTask?.state.satisfied, false, 'the premise: getiamai has no countries location yet')
  assert.equal(body.contract.implementation.offered, false, 'the premise: the policy itself cannot be written before its location exists')
  // Tasks Remaining (the Readiness tiles) and the Implementation box.
  assert.ok(!body.readiness.tiles.some((t) => t.key === 'implementation'), body.readiness.tiles.map((t) => `${t.label} · ${t.value}`).join(' | '))
  assert.notEqual(body.empty.key, 'unavailable', 'the Implementation box reads Unavailable')
  // The next line names the location task, by the task's own title.
  const task = objectTaskBodyOf(geo, ctx)!
  const TASK_TITLE = String((task.cs as { taskTitle?: string }).taskTitle)
  assert.equal(TASK_TITLE, 'Set up the allowed countries location', 'the premise: the title the task list shows')
  assert.ok(body.contract.milestone.line?.includes(TASK_TITLE), `the next line: ${body.contract.milestone.line}`)
  // What to do is the task's own action; the implementation's because names the task.
  assert.equal(body.contract.whatToDo.text, task.contract.whatToDo.text)
  assert.equal(body.contract.whatToDo.text, 'Create the countries named location the country rule reads, holding exactly the countries people work from.')
  const because = body.contract.implementation.offered ? null : body.contract.implementation.because
  assert.ok(because?.includes(TASK_TITLE), `the implementation's because: ${because}`)
  // Nothing on the opened step names the retired step (D3).
  const said = [body.contract.whatToDo.text, body.contract.milestone.label, body.contract.milestone.line ?? '', because ?? '', ...body.readiness.tiles.flatMap((t) => [t.label, t.value, t.note ?? ''])]
  for (const line of said) assert.ok(!line.includes(RETIRED_TITLE), `names the retired step: ${line}`)
})

test('6.3’s exports carry the location task’s About sentence and procedure ahead of the policy’s, word for word, on every channel', async () => {
  const { withDirectionApproved } = await import('../../roadmap/fixtures/run.ts')
  const { boardOf, boardOrderOf } = await import('./planBoard.ts')
  const { planDates } = await import('./stepVars.ts')
  const { exportCleanupViewsOf, exportHoldOf, exportViewsOf, stepExportView } = await import('./stepExport.ts')
  const { buildIcs } = await import('../../roadmap/ics.ts')
  const { groundingBundle, promptPack } = await import('../../roadmap/prompts.ts')
  // The Export page's own construction (Export.tsx): the board once, its hold, the dates, the views.
  const f = withDirectionApproved(withFoundationSettled(curatedFixture('getiamai')))
  const r = runFixture(f, {}, null, f.snapshot.asOf)
  const board = boardOf(r.steps, r.schedule.cleanup, f.mapping.breakGlassAnswers ?? null)
  const held = exportHoldOf(board)
  const dates = planDates(r.steps, r.schedule.start, r.coverage.organisation.naming, f.snapshot, held)
  const ctxOf = (s: Step): StepVarContext => ({ snapshot: f.snapshot, mapping: f.mapping, nameOf: (id) => r.input.names!.label(id), signature: 'IT', operatorId: f.operatorId, now: f.snapshot.asOf, ...dates, reportOnlyAt: s.reportOnlyAt ?? null, groups: f.groups, directory: r.input.directory, naming: r.coverage.organisation.naming })
  const view = exportViewsOf(board, ctxOf)
  const geo = geoOf(r.steps)
  assert.equal(geo.objectTask?.state.satisfied, false, 'the premise: getiamai has no countries location yet')
  const v = view(geo)
  // The location task's own export lines, which its step used to export.
  const task = stepExportView(geo.objectTask!, ctxOf(geo))
  for (const line of ['+ Countries location', 'Name it CA - Allowed - Countries', 'Leave "Include unknown countries/regions" off', 'A countries location carries no trusted mark']) {
    assert.ok(task.whatToDo.some((l) => l.includes(line)), `the premise: the location task exports "${line}"`)
  }
  // The view: the task's About sentence leads the policy's, and its lines lead the policy's procedure.
  assert.ok(v.why.startsWith(task.why), `the About sentence: ${v.why}`)
  assert.deepEqual(v.whatToDo.slice(0, task.whatToDo.length), task.whatToDo, `the task's lines do not lead: ${v.whatToDo.join(' | ')}`)
  assert.ok(v.whatToDo.length > task.whatToDo.length, 'the policy\'s own procedure is gone')
  for (const line of [...v.whatToDo, v.why]) assert.ok(!line.includes(RETIRED_TITLE), `names the retired step: ${line}`)
  // Every channel that reads the view carries the moved words as they are.
  const moved = [task.why, ...task.whatToDo]
  const cleanup = exportCleanupViewsOf(board, r.steps, r.schedule.cleanup)
  const order = boardOrderOf(board.rows.map((x) => x.item))
  const unescape = (text: string): string => text.replace(/\r\n /g, '').replace(/\\n/g, '\n').replace(/\\([,;\\])/g, '$1')
  const ics = unescape(buildIcs(r.steps, 'Tenant', 'plan', view, cleanup, order))
  const entry = ics.split('BEGIN:VEVENT').find((e) => e.includes(`UID:plan-${GEO}@iamai`))
  assert.ok(entry, 'the premise: the calendar books 6.3')
  const pack = promptPack({ view, tenant: 'Tenant', steps: r.steps, schedule: r.schedule, changeRecord: '', announcement: null, cleanup, order }).map((p) => p.prompt).join('\n')
  const bundle = groundingBundle({ view, tenant: 'Tenant', snapshot: f.snapshot, coverage: r.coverage, steps: r.steps, schedule: r.schedule, redacted: false, generated: 'today', cleanup, groups: f.groups, order }) as { plan: { steps: { id: string; why?: string; whatToDo?: string[] }[] } }
  const bundled = bundle.plan.steps.find((s) => s.id === GEO)
  assert.ok(bundled, 'the premise: the bundle carries 6.3')
  for (const line of moved) {
    assert.ok(entry.includes(line), `the calendar entry drops "${line}"`)
    assert.ok(pack.includes(line), `the prompt pack drops "${line}"`)
    assert.ok(JSON.stringify(bundled).includes(JSON.stringify(line).slice(1, -1)), `the grounding bundle drops "${line}"`)
  }
})

test('6.3’s Completion Criteria: the location task’s lines, the answer it asks for, then its own outcome; set aside, the set-aside line alone', async () => {
  const { CONTRACT, stepContract } = await import('./stepContract.ts')
  const { applySkips } = await import('../../roadmap/progress.ts')
  const f = noCountries(withFoundationSettled(curatedFixture('getiamai')))
  const r = runFixture(f)
  const geo = geoOf(r.steps)
  assert.equal(geo.state.condition, 'needs-decision', 'the premise: no work country is saved')
  const ctx: StepVarContext = { snapshot: f.snapshot, mapping: r.input.mapping, nameOf: (id) => r.input.names!.label(id), signature: 'IT', operatorId: f.operatorId, now: f.snapshot.asOf, groups: f.groups, directory: r.input.directory, naming: r.coverage.organisation.naming }
  const done = stepContract(geo, ctx).doneWhen
  const task = stepContract(geo.objectTask!, ctx).doneWhen.filter((l) => done.includes(l))
  assert.ok(task.length > 0, `the premise: the location task's completion is drawn: ${done.join(' | ')}`)
  // The policy's own outcome stays, after the answer the step still asks for.
  const outcome = /^Nobody signs in to .+ from a country that is not on the approved list/
  assert.deepEqual(done, [...task, CONTRACT.doneDecision, done.find((l) => outcome.test(l))], done.join(' | '))
  // Set aside, nothing of it is left to finish: the set-aside line, and no task's.
  applySkips(r.steps, { [GEO]: { reason: 'Not needed for this tenant', at: f.snapshot.asOf } })
  assert.equal(geo.state.setAside, true, 'the premise: 6.3 is set aside')
  assert.deepEqual(stepContract(geo, ctx).doneWhen, [CONTRACT.doneSetAside])
})

test('6.3’s countries picker keeps the Direction question’s words: its label, and the countries the scan saw under it', async () => {
  const { directionWords } = await import('../../content/content.ts')
  const Q = directionWords.questions as unknown as Record<string, { label?: string; seen?: string } | undefined>
  // Restored word for word where Direction asked them (moved, not removed).
  assert.deepEqual(Q.workCountries, { label: 'Work countries', seen: 'Sign-ins in the last 30 days came from {countries}.' })
  const { body } = await geoOnBoard()
  assert.equal(body.taskDecision?.d.label, 'Work Countries', 'the premise: the picker still saves under its own label')
  assert.equal(body.taskDecision?.d.heading, 'Work countries', 'the picker is not headed by the question')
  assert.equal(body.taskDecision?.d.text, 'Sign-ins in the last 30 days came from AU.', 'the countries the scan saw are not under the picker')
  // Where the scan saw no country, no line.
  const f = withFoundationSettled(curatedFixture('getiamai'))
  const blind = { ...f, snapshot: { ...f.snapshot, evidenceAggregates: { ...f.snapshot.evidenceAggregates!, byCountry: {} } } }
  const r = runFixture(blind)
  const geo = geoOf(r.steps)
  const ctx: StepVarContext = { snapshot: blind.snapshot, mapping: r.input.mapping, nameOf: (id) => r.input.names!.label(id), signature: 'IT', operatorId: f.operatorId, now: f.snapshot.asOf, groups: f.groups, directory: r.input.directory, naming: r.coverage.organisation.naming }
  const unseen = stepBodyOf(geo, ctx).taskDecision?.d
  assert.equal(unseen?.heading, 'Work countries')
  assert.equal(unseen?.text, undefined, `a seen line with nothing seen: ${unseen?.text}`)
  // The one picker draws the heading and the line (ContentStep.tsx Decision).
  const content = readFileSync('src/ui/surfaces/ContentStep.tsx', 'utf8')
  assert.ok(content.includes('{d.heading ?? d.label}</h5>') && content.includes("typeof d.text === 'string' && <p className=\"reason\"><T s={d.text} ex={ex} /></p>"), 'the picker does not draw its heading and line')
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

// Stage 3 on every scenario the roadmap-flow check ran: getiamai curated with
// the foundation settled and Direction approved, demo, demo week two, small,
// mid, large, messy and midflight.
test('Stage 3 holds on every scenario: three Direction steps, one countries step that waits on nothing of its own, and Doesn’t apply only where it is true', async () => {
  const { withDirectionApproved } = await import('../../roadmap/fixtures/run.ts')
  const { isGroupMember, DIRECTION_GROUP } = await import('../../roadmap/stepGroups.ts')
  const scenarios: [string, Fixture][] = [
    ['getiamai', withDirectionApproved(withFoundationSettled(curatedFixture('getiamai')))],
    ...(['demo', 'demo-week2', 'small', 'mid', 'large', 'messy', 'midflight'] as FixtureName[]).map((n): [string, Fixture] => [n, fixture(n)]),
  ]
  for (const [name, f] of scenarios) {
    const r = runFixture(f)
    assert.deepEqual(r.steps.filter((s) => isGroupMember(s.id, DIRECTION_GROUP)).map((s) => s.id), ['s-direction-use', 's-direction-accounts', 's-direction-devices'], `${name}: Direction`)
    assert.ok(!r.steps.some((s) => s.id === 's-direction-locations' || s.id === LOCATION), `${name}: a retired step is drawn`)
    for (const s of r.steps) {
      assert.ok(!s.blockedBy.includes(s.id) && !s.blockedBy.includes(LOCATION), `${name}/${s.id}: waits on itself or on the folded location`)
      assert.ok(!s.blockers.some((b) => b.kind === 'step' && (b.stepId === s.id || b.stepId === LOCATION)), `${name}/${s.id}: a step blocker on itself or the folded location`)
    }
    const geo = r.steps.find((s) => s.id === GEO)
    if (geo) {
      assert.equal(geo.objectTask?.id, LOCATION, `${name}: the countries step carries no location task`)
      const reading = laneReadings(r.steps, [], r.input.mapping).get(GEO)
      assert.ok(reading && !reading.blockers.some((b) => b.kind === 'missingObject'), `${name}: 6.3 reads ${reading?.lane} · missingObject`)
    }
    const sd = r.steps.find((s) => s.id === 's-prereq-security-defaults')
    const readOn = f.snapshot.config.securityDefaults?.status === 'ok' && (f.snapshot.config.securityDefaults.rows?.[0] as { isEnabled?: boolean } | undefined)?.isEnabled === true
    if (sd) assert.equal(sd.doesntApply != null, !readOn && f.snapshot.config.securityDefaults?.status === 'ok', `${name}: security defaults read ${readOn ? 'on' : 'off'}, the step reads ${sd.doesntApply ?? sd.status}`)
    if (!readOn) assert.ok(!r.steps.some((s) => s.blockers.some((b) => b.label === 'security-defaults-first')), `${name}: security defaults read off hold a policy`)
    const network = r.steps.find((s) => s.id === 's-prereq-trusted-location')
    const remote = r.input.mapping.wizardAnswered.trustedLocations === true && r.input.mapping.assumed?.trustedLocations !== 'detected' && r.input.mapping.trustedLocationIds.length === 0
    if (network && r.input.mapping.notApplicable?.[network.id] === undefined) assert.equal(network.doesntApply != null, remote, `${name}: the network reads ${network.doesntApply ?? network.status} and the answer is ${remote ? 'remote' : 'not remote'}`)
  }
})

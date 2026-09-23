// The persona harness's self-check (docs/qa/night/personas/harness.ts).
//
// The harness is not the product: nothing in it ships. It drives the product's
// own producers so a simulated administrator can use IAMAI end to end and quote
// what the screen would say. When it says something the screen does not, a
// persona files the harness's mistake as the product's, and a whole round is
// spent on it. Every assertion below is one such mistake the harness made, and
// fails if the harness makes it again.
//
// Importing the harness core here is also what typechecks it: the project's
// typecheck covers src/, and follows these imports into harness.ts,
// r3-tenants.ts and r3-journey.ts. Nothing checked those files before, which is
// how two calls with the wrong number of arguments sat in a tracked file.
import { afterEach, test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { acceptDirection, activePeople, answers, decide, enrolMfa, goalMapDescribes, lanes, mappingOf, plan, render, stepView, tenant } from '../../docs/qa/night/personas/harness.ts'
import type { Tenant } from '../../docs/qa/night/personas/harness.ts'
import { marcusTenant } from '../../docs/qa/night/personas/r3-tenants.ts'
import { board as journeyBoard, walk } from '../../docs/qa/night/personas/r3-journey.ts'
import { fixture } from '../roadmap/fixtures/index.ts'
import { runFixture } from '../roadmap/fixtures/run.ts'
import { pinnedPackage } from '../baseline/pinned.ts'
import { appliedMapping } from '../ui/surfaces/pickerRows.ts'
import { customerPlanSteps } from '../ui/surfaces/customerPlanSteps.ts'
import { allWorkGroups, boardOf } from '../ui/surfaces/planBoard.ts'
import { badgeLabel } from '../ui/surfaces/stepContract.ts'
import { contentTitle } from '../content/stepTitle.ts'
import { facts } from '../derive/facts.ts'
import { activePeopleIds } from '../derive/population.ts'
import { methodAvailability } from '../roadmap/methodAvailability.ts'
import { directionAnswerComplete } from '../roadmap/directionAnswers.ts'
import { absolute, setDisplayTimeZone } from '../copy/dates.ts'

// The harness sets the plan's display time zone, as planData.ts does. The suite
// runs in one process, so the zone goes back after every test.
afterEach(() => setDisplayTimeZone(null))

// The office network is the Direction question that takes a list (the trusted
// locations picked with "office") since work countries moved to the countries
// step (Stage 3); it is asked on Decide How and Where People Sign In.
const DEVICES = 's-direction-devices'
const PICKED = ['trusted-location-under-test']

test('a persona tenant runs on the baseline the product ships, unless it asks for the fixture\'s', (ctx) => {
  ctx.mock.method(console, 'warn', () => {})
  // Every fixture but the demo builds on an eight-policy synthetic stand-in the
  // product never loads, so a finding about a policy's contents described a
  // policy that never ships.
  assert.deepEqual(tenant('getiamai').baseline, pinnedPackage())
  assert.deepEqual(tenant('getiamai', () => {}, { baseline: 'fixture' }).baseline, fixture('getiamai').baseline)
  assert.notDeepEqual(fixture('getiamai').baseline.policies.length, pinnedPackage().policies.length, 'the fixture is on the pin now: the opt-out proves nothing')
})

test('a run on a baseline the goal map does not describe says so, and on the pin it stops', (ctx) => {
  // The goal map describes the pinned baseline and none of the stand-in's
  // policies, so on the stand-in the engine matches policies to goals by
  // signature, which no production baseline does. The opt-out re-opened that
  // path with only a docstring to warn of it.
  const warn = ctx.mock.method(console, 'warn', () => {})
  assert.equal(goalMapDescribes(tenant('getiamai')), true)
  assert.equal(warn.mock.callCount(), 0, 'a run on the pin was warned')
  const standIn = tenant('getiamai', () => {}, { baseline: 'fixture' })
  assert.equal(goalMapDescribes(standIn), false)
  assert.equal(warn.mock.callCount(), 1, 'a run on the stand-in was not told what it is reading')
  assert.match(String(warn.mock.calls[0].arguments[0]), /stand-in baseline[\s\S]*by signature/)
  // A pinned tenant whose baseline was swapped underneath it stops.
  assert.throws(() => tenant('getiamai', (x) => { x.baseline = fixture('getiamai').baseline }), /goal map describes none/)
})

test('the plan is derived from the mapping the product derives it from, and saving an answer leaves the stored record alone', () => {
  const t = tenant('mid')
  const applied = appliedMapping({ snapshot: t.snapshot, mapping: t.mapping, nameOf: (id) => t.groups.get(id)?.displayName ?? id, groups: t.groups, now: t.snapshot.asOf }, null)
  // planData.ts derives from the stored record with the detected defaults and
  // the saved decisions applied; the harness handed the engine the stored record.
  assert.notDeepEqual(applied, t.mapping, 'the detected defaults change nothing on mid: this proves nothing')
  assert.deepEqual(plan(t).input.mapping, applied)
  // decide() saves a decision and does not write it back into the stored
  // record, which re-applied every earlier decision over itself.
  const r = plan(t)
  const values = Object.fromEntries(r.steps.find((s) => s.id === DEVICES)!.directionQuestions!.map((x) => [x.key, x.saved ?? x.suggested]))
  const t2 = decide(t, DEVICES, answers({ ...values, officeNetwork: { value: 'office', picked: PICKED } }))
  assert.deepEqual(t2.mapping, t.mapping, 'saving a decision rewrote the stored mapping record')
  assert.deepEqual(plan(t2).input.mapping, mappingOf(t2))
  assert.deepEqual(plan(t2).steps.find((s) => s.id === DEVICES)!.directionQuestions!.find((x) => x.key === 'officeNetwork')!.saved?.picked, PICKED)
})

test('Approve answers keeps an answer the person saved', () => {
  // acceptDirection saved each question's suggestion over a saved answer; the
  // screen's Approve saves what its draft holds, which starts from the saved one.
  const t = tenant('mid')
  const r = plan(t)
  const step = r.steps.find((s) => s.id === DEVICES)!
  const values = Object.fromEntries(step.directionQuestions!.map((x) => [x.key, x.saved ?? x.suggested]))
  const suggested = step.directionQuestions!.find((x) => x.key === 'officeNetwork')!.suggested
  assert.notDeepEqual(suggested.picked, PICKED)
  const saved = decide(t, DEVICES, answers({ ...values, officeNetwork: { value: 'office', picked: PICKED } }))
  const approved = acceptDirection(saved, plan(saved))
  assert.deepEqual(plan(approved).steps.find((s) => s.id === DEVICES)!.directionQuestions!.find((x) => x.key === 'officeNetwork')!.saved?.picked, PICKED)
})

test('no step the product withholds from every customer surface reaches a persona', () => {
  const t = tenant('mid')
  const raw = runFixture({ ...t, mapping: mappingOf(t) })
  const withheld = raw.steps.filter((s) => !customerPlanSteps([s]).length).map((s) => s.id)
  assert.ok(withheld.length > 0, 'the engine withholds nothing on mid: this proves nothing')
  const shown = new Set(plan(t).steps.map((s) => s.id))
  for (const id of withheld) assert.equal(shown.has(id), false, `${id} is withheld from every surface and the harness shows it`)
})

test('the board a persona reads is the board the Plan draws: its rows, their titles, their lanes and the Cleanup rows', () => {
  const t = tenant('mid')
  const r = plan(t)
  const board = boardOf(r.steps, r.schedule.cleanup, r.input.mapping.breakGlassAnswers ?? null)
  const rows = lanes(t, r)
  const drawn = rows.filter((row) => row.tab !== 'none' && row.tab !== 'doesntApply')
  // Every row the board has, once, each with the title and the lane the board gives it.
  assert.deepEqual(drawn.map((row) => row.id).sort(), board.rows.map((row) => row.item.id).sort())
  // In the order the Plan opens on: All work, section by section (owner, roadmap flow V2).
  const items = board.rows.map((row) => row.item)
  const sections = allWorkGroups(items, items)
  assert.deepEqual(drawn.map((row) => row.id), sections.flatMap((g) => g.items.map((i) => i.id)), 'the harness reads the rows in an order the Plan does not draw')
  assert.deepEqual([...new Set(drawn.map((row) => row.group))], sections.map((g) => g.label), 'the harness names a section the Plan does not draw')
  for (const row of drawn) {
    const b = board.rows.find((x) => x.item.id === row.id)!
    assert.equal(row.title, b.item.title, `${row.id}: the harness titles a row another way`)
    assert.equal(row.lane, b.item.lane, `${row.id}: the harness reads another lane`)
    if (row.step) assert.equal(row.title, contentTitle(row.step), `${row.id}: a row titled by the engine's goal statement, which no row draws`)
  }
  // The drill is a row, and it is not a step.
  const drill = rows.find((row) => row.id === 'cleanup-drill')
  assert.ok(drill, 'the drill that holds every enforcement is not on the harness board')
  assert.equal(drill!.step, null)
  assert.equal(drill!.cleanup, 'drill')
  // And r3-journey counts the same rows.
  const counted = Object.values(journeyBoard(t, r)).reduce((n, k) => n + k, 0)
  assert.equal(counted, rows.length, 'the journey counts a board of its own')
  // The harness reads the board; it builds no copy of it. Its copy of Plan.tsx's
  // construction was wrong five ways before it was right, and it would drift
  // again the next time the board changed.
  const src = readFileSync('docs/qa/night/personas/harness.ts', 'utf8').replace(/\/\/[^\n]*|\/\*[\s\S]*?\*\//g, '')
  assert.match(src, /\bboardOf\(/, 'the harness does not read the board')
  for (const own of ['laneReadings(', 'laneViewOf(', 'readinessBlockersOf(', 'prerequisiteLabelFor(', 'cleanupComplete(', 'cleanupTitleOf(']) {
    assert.equal(src.includes(own), false, `the harness builds its own board: it calls ${own}`)
  }
})

test('the opened step reports the badge its head draws, and has no state of its own', () => {
  const t = tenant('mid')
  const r = plan(t)
  const board = boardOf(r.steps, r.schedule.cleanup, r.input.mapping.breakGlassAnswers ?? null)
  let checked = 0
  for (const step of r.steps.filter((s) => board.readings.has(s.id))) {
    const seen = render(t, r, step)
    assert.equal(seen.badge, badgeLabel(stepView(t, r, step).contract), `${step.id}: render().badge is not what the head draws`)
    assert.equal(seen.badge, board.laneOf(step.id).label, `${step.id}: the opened step's badge is not its board row's label`)
    checked += 1
  }
  assert.ok(checked > 20)
  const one = render(t, r, r.steps.find((s) => board.readings.has(s.id))!)
  assert.throws(() => (one as unknown as { state: string }).state, /render\(\)\.state is gone/)
})

test('every date a persona reads is in the plan\'s display time zone', () => {
  const t = tenant('mid')
  assert.equal(t.mapping.displayTimeZone, 'Australia/Sydney')
  // The machine's zone, before the harness sets the tenant's.
  setDisplayTimeZone('UTC')
  assert.equal(absolute(t.snapshot.asOf), 'Aug 28, 2026, 9:00 AM')
  plan(t)
  assert.equal(absolute(t.snapshot.asOf), 'Aug 28, 2026, 7:00 PM', 'the harness drew a date in the machine zone')
})

test('the harness counts the people the product counts, at the scan\'s own clock', () => {
  const t = marcusTenant()
  const product = facts(t.snapshot, mappingOf(t)).active
  assert.equal(activePeople(t).length, product)
  // The harness counted without the service and emergency accounts taken out (and without the clock).
  assert.ok(activePeopleIds(t.snapshot, t.snapshot.asOf).length > product, 'the accounts that are not people change nothing: this proves nothing')
})

test('the team registers a method: afterwards no active person holds nothing, or only a method the tenant turned off', () => {
  const t: Tenant = tenant('mid')
  const stranded = (x: Tenant): { none: string[]; off: string[] } => {
    const available = methodAvailability(x.snapshot)
    const people = activePeople(x)
    const methods = (id: string): string[] => x.snapshot.registrationDetails.find((row) => row.id === id)?.methodsRegistered ?? []
    return {
      none: people.filter((id) => { const m = x.snapshot.authMethods[id]; return !Array.isArray(m) || m.length === 0 }),
      off: people.filter((id) => methods(id).length > 0 && methods(id).every((m) => available.usable(id, m) === 'no')),
    }
  }
  const before = stranded(t)
  assert.ok(before.off.length > 0 && before.none.length > 0, 'nobody on mid holds only a turned-off method: this proves nothing')
  const after = stranded(enrolMfa(t))
  assert.deepEqual(after, { none: [], off: [] }, 'the campaign left people with no method the tenant allows')
})

test('the recovery test can be recorded, and with it the policies ready to enforce are turned on', () => {
  // The harness had no way to record the drill, and every policy's enforcement
  // waits on it: on every tenant but the demo's week two a run reached "ready to
  // enforce" and stopped there, with nothing to submit.
  const habit = { foundationsFirst: true, fidelity: 'exact', waits: true, enrols: true } as const
  const stage = (stages: { label: string; counts: Record<string, number> }[], label: string): Record<string, number> => stages.find((s) => s.label === label)!.counts
  const held = walk(tenant('mid'), { ...habit, drills: false })
  const ready = stage(held.stages, 'report-only window')['ready-to-enforce'] ?? 0
  assert.ok(ready > 0, 'nothing reaches ready to enforce on mid: this proves nothing')
  assert.equal(stage(held.stages, 'enforced what was ready')['ready-to-enforce'], ready, 'without the drill a turn-on went through')
  for (const s of held.r.steps.filter((x) => x.status === 'ready-to-enforce')) {
    assert.ok((s.action.enforceWaitsOn ?? []).some((w) => w.id === 'cleanup-drill'), `${s.id} waits on something other than the drill`)
  }
  const drilled = walk(tenant('mid'), habit)
  assert.equal(lanes(drilled.t, drilled.r).find((row) => row.id === 'cleanup-drill')?.lane, 'Completed', 'the recorded drill does not complete the drill row')
  const enforced = stage(drilled.stages, 'enforced what was ready')
  // Every prerequisite the board lists holds a turn-on (owner decision 6), not
  // the drill alone: a policy still ready to enforce once the drill is recorded
  // waits on another step the plan names — never on the drill, never on nothing.
  for (const s of drilled.r.steps.filter((x) => x.status === 'ready-to-enforce')) {
    const waits = (s.action.enforceWaitsOn ?? []).map((w) => w.id)
    assert.ok(waits.length > 0 && !waits.includes('cleanup-drill'), `${s.id} ready to enforce and not turned on, waiting on ${JSON.stringify(waits)}`)
  }
  assert.ok((enforced['ready-to-enforce'] ?? 0) < ready, 'the recorded drill turned nothing on')
  assert.ok(enforced.done > stage(drilled.stages, 'report-only window').done, 'turning the policies on completed none of them')
})

test('Approve answers is pressed only where the screen lets it be pressed', () => {
  // Approve is disabled while a question that takes a list has none
  // (directionAnswerComplete). acceptDirection saved such a step anyway: a
  // countries question with no country suggested was approved as none. The
  // office network's "trusted locations" answer takes a list the same way.
  const t = tenant('mid')
  const r = plan(t)
  const incomplete = { ...r, steps: r.steps.map((s) => (s.id !== DEVICES ? s : { ...s, directionQuestions: s.directionQuestions!.map((q) => (q.key !== 'officeNetwork' ? q : { ...q, saved: null, suggested: { value: 'office', picked: [] } })) })) }
  const q = incomplete.steps.find((s) => s.id === DEVICES)!.directionQuestions!.find((x) => x.key === 'officeNetwork')!
  assert.equal(directionAnswerComplete(q, q.suggested), false, 'an empty trusted-locations answer is approvable: this proves nothing')
  const approved = acceptDirection(t, incomplete)
  assert.equal(approved.decisions?.[DEVICES], undefined, 'the harness approved a step whose Approve button is disabled')
  assert.ok(approved.decisions?.['s-direction-use'], 'the steps that could be approved were not')
})

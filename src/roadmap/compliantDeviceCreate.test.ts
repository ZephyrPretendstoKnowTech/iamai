// The owner, verbatim (2026-09-23): "Hold the create for that policy until
// ready." A report-only policy that requires a compliant device can prompt Mac,
// iOS and Android devices to pick a certificate, again and again, until the
// device is compliant (Microsoft Learn, concept-conditional-access-report-only).
// So the create of every policy whose grant requires a compliant device waits on
// the device readiness that already gates its turn-on (`Action.readinessGate`),
// and states why; every other create is unchanged and stays creatable early.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fixture } from './fixtures/index.ts'
import type { Fixture } from './fixtures/index.ts'
import { runFixture, withFoundationSettled } from './fixtures/run.ts'
import { createWaitsOnReadiness, implementationOffered, unavailableReason } from './operations.ts'
import { scheduleOf } from './stepSchedule.ts'
import { boardReadingsOf, laneLabelOf, holdLabelOf, laneViewOf, prerequisiteLabelFor, readinessBlockersOf, waveStartOf } from '../ui/surfaces/planBoard.ts'
import { laneReadings } from '../ui/surfaces/planLanes.ts'
import { planDates } from '../ui/surfaces/stepVars.ts'
import { stepBodyOf } from '../ui/surfaces/stepBody.ts'
import { setDisplayTimeZone } from '../copy/dates.ts'
import { stepContract } from '../ui/surfaces/stepContract.ts'
import { stepExportView } from '../ui/surfaces/stepExport.ts'
import type { StepVarContext } from '../ui/surfaces/stepVars.ts'
import { shared } from '../content/content.ts'
import type { Step } from './types.ts'

const DEVICE = 's-goal-require-managed-device'
const CERTIFICATE = (shared as { certificatePrompt: string }).certificatePrompt

function run(f: Fixture) {
  const r = runFixture(f)
  const board = boardReadingsOf(r.steps, r.schedule.cleanup, null)
  const label = (s: Step) => { const rd = board.readings.get(s.id); return rd ? laneLabelOf(rd, board.titleOf) : null }
  const ctx: StepVarContext = { snapshot: f.snapshot, mapping: f.mapping, nameOf: (id) => r.input.names!.label(id), signature: 'IT', operatorId: f.operatorId, now: f.snapshot.asOf, groups: f.groups, naming: r.coverage.organisation.naming }
  return { r, board, label, ctx }
}

/** The report-only creates the plan offers today, each with its day. */
function creates(f: Fixture) {
  const { r, label } = run(f)
  return r.steps.filter((s) => label(s) === 'Ready · Create').map((s) => ({ id: s.id, at: scheduleOf(s).at }))
}

/** Every person in the demo holds a compliant computer: device readiness is met. */
function devicesReady(f: Fixture): Fixture {
  const snapshot = structuredClone(f.snapshot)
  snapshot.devices = [...snapshot.devices, ...snapshot.users.map((u, i) => ({ id: `probe-device-${i}`, displayName: `PC-${i}`, isCompliant: true, isManaged: true, trustType: 'AzureAd', ownerIds: [u.id], operatingSystem: 'Windows' }))]
  return { ...f, snapshot }
}

test('demo: the managed-device create waits on device readiness, and says why', () => {
  const f = withFoundationSettled(fixture('demo'))
  const { r, board, label, ctx } = run(f)
  const step = r.steps.find((s) => s.id === DEVICE)!
  const gate = step.action.readinessGate
  assert.ok(gate && /device readiness/.test(gate.measure), 'the premise: device readiness gates its turn-on, unmet')
  assert.equal(step.state.lifecycle, 'not-deployed')
  assert.equal(createWaitsOnReadiness(step), true)
  assert.equal(implementationOffered(step), false, 'the translator offers no portal lines, JSON, PowerShell or download for the create')
  assert.equal(unavailableReason(step), 'readiness-unmet')
  assert.equal(label(step), 'On Hold', 'never Ready · Create')
  const reading = board.readings.get(DEVICE)!
  assert.equal(holdLabelOf(reading, board.titleOf), `when device readiness reaches ${gate.threshold} (now ${gate.value})`, 'the row names the number it waits for')
  const sch = scheduleOf(step)
  assert.equal(sch.class, 'waiting')
  assert.equal(sch.at, null, 'no report-only day')
  assert.equal(step.reportOnlyAt, null)
  // Why: the certificate prompt, stated as a fact, on the step and in its export.
  const because = stepContract(step, ctx).implementation
  assert.ok(!because.offered && because.because?.startsWith(CERTIFICATE), because.offered ? 'offered' : String(because.because))
  assert.match(because.because ?? '', new RegExp(`${gate.measure} reaches ${gate.threshold}`))
  assert.doesNotMatch(because.because ?? '', /turns the policy on;/, 'not the words for a withheld turn-on')
  assert.ok(stepExportView(step, ctx).whatToDo.some((l) => l.startsWith(CERTIFICATE)), 'the export says the same')
  assert.match(CERTIFICATE, /requires a compliant device/)
  assert.match(CERTIFICATE, /Mac, iOS and Android/)
})

test('demo: once device readiness is met the managed-device create is Ready · Create on the plan\'s first day', () => {
  const f = devicesReady(withFoundationSettled(fixture('demo')))
  const { r, label } = run(f)
  const step = r.steps.find((s) => s.id === DEVICE)!
  assert.equal(step.action.readinessGate, undefined, 'the premise: readiness is met')
  assert.equal(createWaitsOnReadiness(step), false)
  assert.equal(label(step), 'Ready · Create')
  assert.equal(scheduleOf(step).transition, 'createReportOnly')
})

test('demo and mid: every other create is unchanged — creatable early, on the same first day', () => {
  for (const name of ['demo', 'mid'] as const) {
    const f = withFoundationSettled(fixture(name))
    const { r } = run(f)
    for (const s of r.steps.filter((x) => x.id !== DEVICE)) assert.equal(createWaitsOnReadiness(s), false, `${name}: ${s.id} has no compliant-device grant`)
    const now = creates(f)
    assert.ok(now.length > 3, `${name}: creates remain Ready`)
    const days = new Set(now.map((c) => c.at))
    assert.equal(days.size, 1, `${name}: every Ready create is dated the same first day (${[...days].join(', ')})`)
    // The creates a tenant with ready devices would offer, less the managed-device one: nothing else moved.
    const ready = creates(devicesReady(f)).filter((c) => c.id !== DEVICE)
    assert.deepEqual(now, ready, `${name}: the other creates do not depend on device readiness`)
  }
  // Mid holds no Intune licence, so it has no managed-device step at all.
  assert.ok(!runFixture(withFoundationSettled(fixture('mid'))).steps.some((s) => s.id === DEVICE))
})

/**
 * The step as the Plan opens it and prints it (stepBody.ts: ContentStep and
 * PrintPlan draw this body), and its export (the export, the plan file and the
 * prompts read stepExportView), on the board's own reading.
 */
function opened(f: Fixture) {
  setDisplayTimeZone('UTC')
  try {
    const r = runFixture(f, { mapping: f.mapping }, null, f.snapshot.asOf)
    const readings = laneReadings(r.steps, [])
    const titleOf = (id: string): string | null => r.steps.find((s) => s.id === id)?.title ?? null
    const dates = planDates(r.steps, r.schedule.start, r.coverage.organisation.naming, f.snapshot)
    const step = r.steps.find((s) => s.id === DEVICE)!
    const reading = readings.get(DEVICE)!
    const lane = laneViewOf(reading, titleOf)
    const ctx: StepVarContext = { snapshot: f.snapshot, mapping: f.mapping, nameOf: (id) => r.input.names!.label(id), signature: 'IT', operatorId: f.operatorId, now: f.snapshot.asOf, ...dates, reportOnlyAt: step.reportOnlyAt ?? null, scheduledOn: waveStartOf(step), groups: f.groups, directory: r.input.directory, naming: r.coverage.organisation.naming }
    const body = stepBodyOf(step, ctx, { lane, blockers: readinessBlockersOf(reading, titleOf), prerequisiteLabel: prerequisiteLabelFor(readings) })
    const tasks = (body.emergencyAccountTasks?.tasks ?? []).map((t) => [t.title, t.actionLabel, ...(t.facts ?? []).map((x) => `${x.label}: ${x.value}`), ...t.steps].join('\n'))
    return { step, body, tasks, whatToDo: stepExportView(step, ctx, lane).whatToDo }
  } finally {
    setDisplayTimeZone(null)
  }
}

/** Words that hand over the policy's creation: the portal's New policy, a Create-mode script, a POST, a report-only body, or saying the next action creates it. */
const CREATES: [string, RegExp][] = [
  ['the portal create', /New policy/i],
  ['a Create-mode script', /ValidateSet\('Create'\)|-Mode\s+'?Create|in Create mode/i],
  ['a POST', /\bPOST\b/],
  ['a report-only body', /enabledForReportingButNotEnforced/],
  ['saying the next action creates it', /next action (?:creates|is to create)/i],
]

test('demo: while its create waits, the opened, printed and exported step hands over nothing that creates the policy', () => {
  const { step, body, tasks, whatToDo } = opened(withFoundationSettled(fixture('demo')))
  assert.equal(createWaitsOnReadiness(step), true, 'the premise: the create waits on device readiness')
  const texts: [string, string][] = [
    ...body.artifacts.map((a): [string, string] => [`the ${a.id} tab`, a.text()]),
    ...tasks.map((t, i): [string, string] => [`implementation task ${i + 1}`, t]),
    ['the export', whatToDo.join('\n')],
  ]
  for (const [where, text] of texts) {
    for (const [what, pattern] of CREATES) assert.doesNotMatch(text, pattern, `${where} carries ${what}`)
  }
  // The Entra tab, and the Implementation Task drawn from it, inspect the policies that are there, as a switched-off policy's do.
  assert.match(body.artifacts.find((a) => a.id === 'portal')?.text() ?? '', /Review the policies that affect/)
  // What it does say: why the create waits, in the export as on the step.
  assert.ok(whatToDo.some((l) => l.startsWith(CERTIFICATE)), whatToDo.join(' | '))
  const ai = body.artifacts.find((a) => a.id === 'ai')
  assert.ok(ai, 'AI Info still explains the step')
  assert.ok(ai.text().includes(CERTIFICATE), 'AI Info states the hold and why')
})

test('demo: once device readiness is met the opened step hands the create over again', () => {
  const { body } = opened(devicesReady(withFoundationSettled(fixture('demo'))))
  const entra = body.artifacts.find((a) => a.id === 'portal')?.text() ?? ''
  assert.match(entra, /New policy/, 'the Entra procedure creates it')
  assert.match(body.artifacts.find((a) => a.id === 'json')?.text() ?? '', /enabledForReportingButNotEnforced/, 'the JSON is the report-only create')
})

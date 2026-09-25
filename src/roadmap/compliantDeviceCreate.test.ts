// The owner, verbatim (2026-09-23): "Hold the create for that policy until
// ready." A report-only policy that requires a compliant device can prompt Mac,
// iOS and Android devices to pick a certificate, again and again, until the
// device is compliant (Microsoft Learn, concept-conditional-access-report-only).
// So the create of every policy whose grant requires a compliant device waits on
// the device readiness that already gates its turn-on (`Action.readinessGate`),
// and states why; every other create is unchanged and stays creatable early.
import { test } from 'node:test'
import { stepCreatedOn } from './evidenceStrategy.ts'
import assert from 'node:assert/strict'
import { fixture } from './fixtures/index.ts'
import type { Fixture } from './fixtures/index.ts'
import { runFixture, withDevicesReady, withFoundationSettled } from './fixtures/run.ts'
import { createWaitsOnReadiness, implementationOffered, switchedOffPolicies, toReportOnly, unavailableReason } from './operations.ts'
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
/** The report-only creates the board offers now; a User Action policy is created On and dated as the turn-on it is (Phase 2e). */
function creates(f: Fixture) {
  const { r, label } = run(f)
  return r.steps.filter((s) => label(s) === 'Ready · Create' && !stepCreatedOn(s)).map((s) => ({ id: s.id, at: scheduleOf(s).at }))
}

test('demo: the managed-device create waits on device readiness and says why; once readiness is met it is Ready · Create', () => {
  // demo: the managed-device create waits on device readiness, and says why
  {
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
    assert.equal(holdLabelOf(reading, board.titleOf), `When device readiness reaches ${gate.threshold} (now ${gate.value})`, 'the row names the number it waits for, starting with a capital (walk list 4.x item 27)')
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
  }

  // demo: once device readiness is met the managed-device create is Ready · Create on the plan's first day
  {
    const f = withDevicesReady(withFoundationSettled(fixture('demo')))
    const { r, label } = run(f)
    const step = r.steps.find((s) => s.id === DEVICE)!
    assert.equal(step.action.readinessGate, undefined, 'the premise: readiness is met')
    assert.equal(createWaitsOnReadiness(step), false)
    // The demo works from an office (Decide How and Where People Sign In, 9c7d3386):
    // the create comes after Define the Trusted Network, as sequencing, never a
    // hold on readiness.
    const { board } = run(f)
    assert.equal(label(step), 'Up Next')
    assert.equal(holdLabelOf(board.readings.get(DEVICE)!, board.titleOf), 'After Define the Trusted Network')
    assert.equal(scheduleOf(step).transition, 'createReportOnly')
  }
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
    const ready = creates(withDevicesReady(f)).filter((c) => c.id !== DEVICE)
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

test('demo: while its create waits, the opened, printed and exported step hands over nothing that creates the policy; once readiness is met it does', () => {
  // demo: while its create waits, the opened, printed and exported step hands over nothing that creates the policy
  {
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
    // What it does say: why the create waits, in the export as on the step.
    assert.ok(whatToDo.some((l) => l.startsWith(CERTIFICATE)), whatToDo.join(' | '))
    const ai = body.artifacts.find((a) => a.id === 'ai')
    assert.ok(ai, 'AI Info still explains the step')
    assert.ok(ai.text().includes(CERTIFICATE), 'AI Info states the hold and why')
  }

  // demo: once device readiness is met the opened step hands the create over again
  {
    const { body } = opened(withDevicesReady(withFoundationSettled(fixture('demo'))))
    const entra = body.artifacts.find((a) => a.id === 'portal')?.text() ?? ''
    assert.match(entra, /New policy/, 'the Entra procedure creates it')
    assert.match(body.artifacts.find((a) => a.id === 'json')?.text() ?? '', /enabledForReportingButNotEnforced/, 'the JSON is the report-only create')
  }
})

/**
 * The Intune setting the content says to change before this policy (its
 * `whatToDo.before` line) is preparation, not the create. It is also what keeps
 * the device readiness the create waits on honest: at Intune's shipped value a
 * device with no compliance policy reads compliant, so readiness could reach the
 * threshold and release the create into the prompts the wait exists to prevent.
 */
const INTUNE_PREPARATION = /Mark devices with no compliance policy assigned/

test('demo, first visit and settled: while its create waits, the step, its Implementation Task, its export and AI Info keep the Intune preparation', () => {
  for (const [when, f] of [['first visit', fixture('demo')], ['settled', withFoundationSettled(fixture('demo'))]] as const) {
    const { step, body, tasks, whatToDo } = opened(f)
    assert.equal(createWaitsOnReadiness(step), true, `${when}: the premise: the create waits on device readiness`)
    assert.equal(unavailableReason(step), 'readiness-unmet', `${when}: and nothing else holds it`)
    const entra = body.artifacts.find((a) => a.id === 'portal')?.text() ?? ''
    const ai = body.artifacts.find((a) => a.id === 'ai')?.text() ?? ''
    const texts: [string, string][] = [['the Entra tab', entra], ['the Implementation Task', tasks.join('\n')], ['the export', whatToDo.join('\n')], ['AI Info', ai]]
    for (const [where, text] of texts) {
      assert.match(text, INTUNE_PREPARATION, `${when}: ${where} keeps the Intune preparation`)
      for (const [what, pattern] of CREATES) assert.doesNotMatch(text, pattern, `${when}: ${where} carries ${what}`)
    }
    assert.ok(body.before.some((l) => INTUNE_PREPARATION.test(l)), `${when}: the step's own before lines stand`)
    // The preparation stands where a switched-off policy draws an inspection, not beside one.
    assert.doesNotMatch(entra, /Review the policies that affect/, `${when}: the Entra tab is the preparation, not an inspection`)
    assert.doesNotMatch(tasks.join('\n'), /Review the policies that affect/, `${when}: the Implementation Task is the preparation, not an inspection`)
    // The export says why the create waits first, then what to prepare meanwhile.
    const why = whatToDo.findIndex((l) => l.startsWith(CERTIFICATE))
    const prepare = whatToDo.findIndex((l) => INTUNE_PREPARATION.test(l))
    assert.ok(why >= 0 && prepare > why, `${when}: ${whatToDo.join(' | ')}`)
  }
})

/**
 * The demo tenant holding this plan's own Require a Managed Device policy,
 * switched off: the body IAMAI's create would submit, tag and all, found by the
 * scan with Enable policy Off. `ready` decides device readiness.
 */
function managedDeviceOff(ready: boolean): Fixture {
  const f = withFoundationSettled(fixture('demo'))
  const seed = runFixture(withDevicesReady(f)).steps.find((s) => s.id === DEVICE)!
  const op = seed.action.resolution?.policies.find((o) => o.mode === 'create')
  assert.ok(op, 'the premise: the plan would create the policy')
  const snapshot = structuredClone(f.snapshot)
  snapshot.config.caPolicies!.rows = [...(snapshot.config.caPolicies!.rows ?? []), { id: 'e5d0d3c6-0b6e-4a2e-9a3f-9c4b7a1d0d0f', createdDateTime: f.snapshot.asOf, modifiedDateTime: f.snapshot.asOf, ...(op.body as Record<string, unknown>), state: 'disabled' }]
  const off = { ...f, snapshot }
  return ready ? withDevicesReady(off) : off
}

/** The switched-off instruction, in the portal's words, bold or plain (the procedure bolds the control and its value, roadmap/policyProcedure.ts). */
const REPORT_ONLY = /set (?:\*\*)?Enable policy(?:\*\*)? to (?:\*\*)?Report-only/i

test('demo: Require a Managed Device found Off is told to go to Report-only only once device readiness is met', () => {
  // demo: Require a Managed Device found Off is not told to go to Report-only while device readiness is unmet
  {
    const f = managedDeviceOff(false)
    const { r, label, ctx } = run(f)
    const step = r.steps.find((s) => s.id === DEVICE)!
    const gate = step.action.readinessGate
    assert.ok(gate && /device readiness/.test(gate.measure), 'the premise: device readiness is unmet')
    assert.ok(switchedOffPolicies(step).length > 0, 'the premise: the scan finds the policy Off')
    assert.equal(createWaitsOnReadiness(step), true, 'its Report-only patch waits on the same gate as the create')
    assert.equal(unavailableReason(step), 'readiness-unmet')
    assert.deepEqual(toReportOnly(step), [], 'no channel hands over the Report-only patch')
    // Whichever reason the step reads: a missing object outranks the switched-off reason, and the patch still waits.
    const missing = { ...step, action: { ...step.action, missing: [{ token: 'probe', stepId: null }] } }
    assert.equal(unavailableReason(missing), 'missing-object')
    assert.deepEqual(toReportOnly(missing), [])
    assert.equal(label(step), 'On Hold', 'never Ready · Correct')
    const contract = stepContract(step, ctx)
    assert.doesNotMatch(contract.whatToDo.text, REPORT_ONLY, contract.whatToDo.text)
    assert.ok(!contract.implementation.offered && contract.implementation.because?.startsWith(CERTIFICATE), contract.implementation.offered ? 'offered' : String(contract.implementation.because))
    // The reason says the policy was found switched off, not that creating it waits.
    const because = String(contract.implementation.because)
    assert.match(because, /already in .+, switched off\. So setting it to Report-only waits/, because)
    assert.doesNotMatch(because, /creating this policy/i, because)
    const { body, whatToDo } = opened(f)
    for (const a of body.artifacts) assert.doesNotMatch(a.text(), REPORT_ONLY, `the ${a.id} tab says to set it to Report-only`)
    assert.doesNotMatch(whatToDo.join('\n'), REPORT_ONLY, 'the export says to set it to Report-only')
    assert.ok(whatToDo.some((l) => l.startsWith(CERTIFICATE)), whatToDo.join(' | '))
  }

  // demo: once device readiness is met, Require a Managed Device found Off is told to go to Report-only
  {
    const f = managedDeviceOff(true)
    const { r, label, ctx } = run(f)
    const step = r.steps.find((s) => s.id === DEVICE)!
    assert.equal(step.action.readinessGate, undefined, 'the premise: readiness is met')
    assert.ok(switchedOffPolicies(step).length > 0, 'the premise: the scan finds the policy Off')
    assert.equal(createWaitsOnReadiness(step), false)
    assert.equal(unavailableReason(step), 'switched-off')
    assert.ok(toReportOnly(step).length > 0)
    const missing = { ...step, action: { ...step.action, missing: [{ token: 'probe', stepId: null }] } }
    assert.ok(toReportOnly(missing).length > 0, 'behind a missing object too')
    assert.equal(label(step), 'Ready · Correct')
    assert.match(stepContract(step, ctx).whatToDo.text, REPORT_ONLY)
    const { body, whatToDo } = opened(f)
    assert.match(body.artifacts.find((a) => a.id === 'portal')?.text() ?? '', REPORT_ONLY)
    assert.match(whatToDo.join('\n'), REPORT_ONLY)
  }
})

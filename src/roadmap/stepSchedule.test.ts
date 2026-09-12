// One scheduling result per step (correction batch 1.1): a row's day, the phase it
// sits in and that phase's range are one reading, so no dated row falls outside its
// phase; readiness gates enforcement and not creation; a real prerequisite still
// holds creation; and the phases move with the answers, the start and the first
// deployment.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { curatedFixture, fixture } from './fixtures/index.ts'
import type { Fixture } from './fixtures/index.ts'
import { runFixture } from './fixtures/run.ts'
import { applyStepDecisions } from './decisions.ts'
import { referenceOptions } from './answers.ts'
import { BASELINE_MAPPINGS_KEY, sourceMappingsOf } from './sourceMappings.ts'
import { holdOf, isHeld } from './holds.ts'
import { nextMilestone } from './lifecycle.ts'
import { unavailableReason } from './operations.ts'
import type { Schedule } from './schedule.ts'
import type { Step } from './types.ts'

const SOURCE = BASELINE_MAPPINGS_KEY
const DEVICE_REGISTRATION = 's-goal-device-registration-mfa'
const MANAGED_DEVICE = 's-goal-require-managed-device'
const DAY = 86_400_000

/** The fixture with every one of the baseline's unanswered references answered "none needed here", through the real decision path. */
function omitted(f: Fixture): Fixture {
  const pending = sourceMappingsOf(runFixture(f).steps)
  const answers = Object.fromEntries(pending.map((r) => [r.id, referenceOptions()[0]]))
  return { ...f, mapping: applyStepDecisions(f.mapping, { [SOURCE]: { answers, at: f.snapshot.asOf } }) }
}

const t = (iso: string): number => Date.parse(iso)
const drawn = (s: Step): boolean => s.status !== 'done' && !s.floor && !s.doesntApply

/** Everything wrong with a finished plan's phases against its steps' own results. */
function violations(steps: readonly Step[], schedule: Schedule): string[] {
  const out: string[] = []
  const phases = schedule.phases ?? []
  if (phases.length === 0) out.push('the finished plan carries no phases')
  const byId = new Map(steps.map((s) => [s.id, s]))
  for (const p of phases) {
    for (const id of p.stepIds) {
      const s = byId.get(id)
      if (!s || !drawn(s)) continue
      const r = s.scheduled!
      if (r.wave !== p.wave) out.push(`${id} is drawn in phase ${p.wave} and scheduled in ${r.wave}`)
      if (r.at !== null && !(t(p.start) <= t(r.at) && t(r.at) <= t(p.end))) out.push(`${id} is dated ${r.at} outside phase ${p.wave} (${p.start}..${p.end})`)
      if (r.range !== null && !(t(p.start) <= t(r.range.start) && t(r.range.end) <= t(p.end))) out.push(`${id} spans ${r.range.start}..${r.range.end} outside phase ${p.wave}`)
    }
  }
  for (const s of steps.filter(drawn)) {
    const r = s.scheduled
    if (!r) {
      out.push(`${s.id} has no scheduling result`)
      continue
    }
    const n = phases.filter((p) => p.stepIds.includes(s.id)).length
    if (r.class === 'waiting' && n !== 0) out.push(`${s.id} is waiting and sits in a phase`)
    if ((r.class === 'scheduled' || r.class === 'observing') && n !== 1) out.push(`${s.id} is ${r.class} and sits in ${n} phases`)
  }
  return out
}

const RUNS: [string, () => Fixture][] = [
  ['demo', () => fixture('demo')],
  ['demo answered', () => omitted(fixture('demo'))],
  ['demo-week2', () => fixture('demo-week2')],
  ['demo-week2 answered', () => omitted(fixture('demo-week2'))],
  ['curated demo', () => curatedFixture('demo')],
  ['curated demo-week2', () => curatedFixture('demo-week2')],
  ['small', () => fixture('small')],
  ['mid', () => fixture('mid')],
  ['messy', () => fixture('messy')],
  ['midflight', () => fixture('midflight')],
]

test('every dated row falls inside its phase, every phase spans its rows, and a waiting row sits in none', () => {
  let dated = 0
  for (const [name, make] of RUNS) {
    const r = runFixture(make())
    assert.deepEqual(violations(r.steps, r.schedule), [], name)
    dated += r.steps.filter((s) => drawn(s) && s.scheduled?.at != null).length
  }
  assert.ok(dated > 50, `dated rows checked: ${dated}`)
})

test('waiting is exactly held with nothing scheduled, and finished or scheduled work never waits', () => {
  for (const [name, make] of RUNS) {
    for (const s of runFixture(make()).steps) {
      const r = s.scheduled!
      if (s.status === 'done') assert.equal(r.class, 'complete', `${name}/${s.id}`)
      const gatedCreate = r.transition === 'createReportOnly' && r.enforcement === 'gated'
      if (s.status !== 'done' && s.status !== 'skipped') assert.equal(r.class === 'waiting', isHeld(s) && !gatedCreate, `${name}/${s.id}: ${r.class}`)
      if (r.class === 'scheduled') assert.notEqual(r.at, null, `${name}/${s.id}: scheduled with no day`)
    }
  }
})

test('readiness gates enforcement, not creation: a create only a threshold holds keeps its report-only day', () => {
  const r = runFixture(omitted(fixture('demo')))
  const step = r.steps.find((s) => s.id === DEVICE_REGISTRATION)!
  assert.equal(holdOf(step)?.kind, 'readiness', 'the premise: a readiness threshold holds it')
  assert.ok(step.action.readinessGate, 'the premise: it names the threshold')
  const s = step.scheduled!
  assert.equal(s.class, 'scheduled')
  assert.equal(s.transition, 'createReportOnly')
  assert.equal(s.enforcement, 'gated')
  assert.equal(s.at, step.reportOnlyAt, 'the day is the day the plan creates it')
  assert.equal(s.wave, 0, 'creation is Preparation work')
  assert.ok(r.schedule.phases![0].stepIds.includes(step.id))
  const m = nextMilestone(step)
  assert.equal(m.at, s.at, 'the next milestone is that day')
  assert.match(m.label, new RegExp(step.action.readinessGate!.threshold), 'and says turning it on waits for the threshold')
})

test('enforcement stays gated below the threshold: no enforcement day, ring or wave', () => {
  const r = runFixture(omitted(fixture('demo')))
  const step = r.steps.find((s) => s.id === DEVICE_REGISTRATION)!
  assert.ok(isHeld(step))
  assert.equal(step.events, null, 'no enforcement event')
  assert.deepEqual(step.rings, [], 'no rings')
  assert.equal(r.schedule.waveOf[step.id], undefined, 'no enforcement wave')
  assert.notEqual(step.status, 'ready-to-enforce')
})

test('a real prerequisite still holds creation: a missing object, an unverified way back in, or an open decision', () => {
  const r = runFixture(omitted(fixture('demo')))
  const unavailable = r.steps.filter((s) => (s.kind === 'create' || s.kind === 'adjust') && s.status !== 'done' && unavailableReason(s) !== null)
  assert.ok(unavailable.some((s) => unavailableReason(s) === 'missing-object'), 'the premise: a policy names an object the tenant lacks')
  for (const s of unavailable) {
    assert.equal(s.scheduled!.class, 'waiting', s.id)
    assert.equal(s.scheduled!.at, null, s.id)
    assert.equal(s.reportOnlyAt, null, `${s.id} keeps a creation day`)
  }
  const device = r.steps.find((s) => s.id === MANAGED_DEVICE)!
  assert.equal(holdOf(device)?.kind, 'readiness', 'the premise: a threshold holds it')
  assert.ok(device.blockers.some((b) => b.kind === 'step' && r.steps.find((x) => x.id === b.stepId)?.state.condition === 'needs-decision'), 'the premise: it waits on an open decision')
  assert.equal(device.scheduled!.class, 'waiting', 'a decision that may redefine the policy comes before it is created')
})

test('answering the references recalculates the phases, and taking the answers back withdraws them', () => {
  const policyPhases = (f: Fixture): number => {
    const r = runFixture(f)
    return (r.schedule.phases ?? []).filter((p) => p.wave > 0 && p.stepIds.some((id) => drawn(r.steps.find((s) => s.id === id)!))).length
  }
  const base = fixture('demo')
  assert.equal(policyPhases(base), 0, 'unanswered, no policy phase is dated')
  assert.ok(policyPhases(omitted(base)) >= 2, 'answered, the rollout has its phases')
  assert.equal(policyPhases({ ...base, mapping: applyStepDecisions(base.mapping, { [SOURCE]: { answers: {}, at: base.snapshot.asOf } }) }), 0, 'with the answers taken back, they are withdrawn')
})

test('moving the plan start moves every phase with it', () => {
  const f = omitted(fixture('demo'))
  const a = runFixture(f)
  const b = runFixture(f, { startDate: '2026-09-14' })
  assert.deepEqual(violations(b.steps, b.schedule), [])
  assert.equal(t(b.schedule.phases![0].start) - t(a.schedule.phases![0].start), 14 * DAY)
  for (const p of b.schedule.phases!) assert.ok(t(p.start) >= t(b.schedule.start), `phase ${p.wave} starts before the plan`)
})

test('the first deployment is respected: nothing is created in report-only before it, and the phases still hold their rows', () => {
  const f = omitted(fixture('demo'))
  const first = '2026-09-02T12:00:00.000Z'
  const r = runFixture(f, { firstDeployment: first })
  assert.deepEqual(violations(r.steps, r.schedule), [])
  const creates = r.steps.filter((s) => s.scheduled?.transition === 'createReportOnly')
  assert.ok(creates.length > 0)
  for (const s of creates) assert.ok(t(s.scheduled!.at!) >= t(first), `${s.id} is created on ${s.scheduled!.at}`)
})

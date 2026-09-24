// One scheduling result per step (correction batch 1.1): a row's day, the phase it
// sits in and that phase's range are one reading, so no dated row falls outside its
// phase; readiness gates enforcement and not creation; a real prerequisite still
// holds creation; and the phases move with the answers, the start and the first
// deployment.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { curatedFixture, fixture, noExclusionsAnswer } from './fixtures/index.ts'
import type { Fixture } from './fixtures/index.ts'
import { runFixture, withDirectionApproved } from './fixtures/run.ts'
import { applyStepDecisions } from './decisions.ts'
import { referenceOptions } from './answers.ts'
import { BASELINE_MAPPINGS_KEY, sourceMappingsOf } from './sourceMappings.ts'
import { FOUNDATION_WAIT, holdOf, isHeld } from './holds.ts'
import { nextMilestone } from './lifecycle.ts'
import { unavailableReason } from './operations.ts'
import type { Schedule } from './schedule.ts'
import type { Step } from './types.ts'

const SOURCE = BASELINE_MAPPINGS_KEY
const DEVICE_REGISTRATION = 's-goal-device-registration-mfa'
const EXCLUSIONS = 's-prereq-exclusion-group'
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

test('every dated row falls inside its phase, every phase spans its rows, a waiting row sits in none, and waiting is exactly held with nothing scheduled', () => {
  let dated = 0
  for (const [name, make] of RUNS) {
    const r = runFixture(make())
    assert.deepEqual(violations(r.steps, r.schedule), [], name)
    dated += r.steps.filter((s) => drawn(s) && s.scheduled?.at != null).length
    // Waiting is exactly held with nothing scheduled, and finished or scheduled work never waits.
    for (const s of r.steps) {
      const sc = s.scheduled!
      if (s.status === 'done') assert.equal(sc.class, 'complete', `${name}/${s.id}`)
      const gatedCreate = sc.transition === 'createReportOnly' && sc.enforcement === 'gated'
      if (s.status !== 'done' && s.status !== 'skipped') assert.equal(sc.class === 'waiting', isHeld(s) && !gatedCreate, `${name}/${s.id}: ${sc.class}`)
      if (sc.class === 'scheduled') assert.notEqual(sc.at, null, `${name}/${s.id}: scheduled with no day`)
    }
  }
  assert.ok(dated > 50, `dated rows checked: ${dated}`)
})

test('readiness gates enforcement, not creation: a create only a threshold holds keeps its report-only day, and enforcement stays gated below the threshold with no day, ring or wave', () => {
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
  // The plan's foundation is unsettled on the demo's first visit and withdraws
  // the create with it (roadmap/holds.ts waitsOnFoundation), so the milestone is
  // that wait. With it cleared, the threshold is what is left, and the milestone
  // is the day the plan creates the policy.
  const released = structuredClone(step)
  released.blockers = released.blockers.filter((b) => b.label !== FOUNDATION_WAIT)
  const m = nextMilestone(released)
  assert.equal(m.at, s.at, 'the next milestone is that day')
  assert.match(m.label, new RegExp(step.action.readinessGate!.threshold), 'and says turning it on waits for the threshold')

  // Enforcement stays gated below the threshold: no enforcement day, ring or wave.
  {
    const r = runFixture(omitted(fixture('demo')))
    const step = r.steps.find((s) => s.id === DEVICE_REGISTRATION)!
    assert.ok(isHeld(step))
    assert.equal(step.events, null, 'no enforcement event')
    assert.deepEqual(step.rings, [], 'no rings')
    assert.equal(r.schedule.waveOf[step.id], undefined, 'no enforcement wave')
    assert.notEqual(step.status, 'ready-to-enforce')
  }
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
  // An open decision: the exclusions group nobody has chosen. The device goals used to be the case
  // here, waiting on the retired device-plan step; their wait is on Decide How People and Devices
  // Sign In now, a Direction answer (roadmap/direction.ts gateOnDirection), covered below.
  const open = runFixture(noExclusionsAnswer(omitted(fixture('demo'))))
  assert.equal(open.steps.find((s) => s.id === EXCLUSIONS)!.state.condition, 'needs-decision', 'the premise: the decision is open')
  const waiting = open.steps.filter((s) => (s.kind === 'create' || s.kind === 'adjust') && s.status !== 'done' && s.blockers.some((b) => b.kind === 'step' && b.stepId === EXCLUSIONS))
  assert.ok(waiting.length > 0, 'the premise: policies wait on the open decision')
  for (const s of waiting) {
    assert.equal(s.scheduled!.class, 'waiting', `${s.id}: a decision that may redefine the policy comes before it is created`)
    assert.equal(s.scheduled!.at, null, s.id)
  }
})

test('answering the references recalculates the phases, and taking the answers back withdraws them', () => {
  const policyPhases = (f: Fixture): number => {
    const r = runFixture(f)
    return (r.schedule.phases ?? []).filter((p) => p.wave > 0 && p.stepIds.some((id) => drawn(r.steps.find((s) => s.id === id)!))).length
  }
  // The plan's foundation settled: until it is, every policy is held and the
  // rollout has no numbered phase at all (roadmap/foundations.ts), so the demo's
  // own first visit can no longer show what answering the references does. Week
  // two has most of its policies delivered, so its rollout draws one phase.
  const base = withDirectionApproved(fixture('demo-week2'))
  const initial = policyPhases(base)
  assert.ok(initial > 0, 'approved optional exclusion defaults do not hold unrelated policies')
  assert.ok(policyPhases(omitted(base)) >= initial, 'answered, the rollout keeps its phases')
  assert.equal(policyPhases({ ...base, mapping: applyStepDecisions(base.mapping, { [SOURCE]: { answers: {}, at: base.snapshot.asOf } }) }), initial, 'taking answers back restores the approved default schedule')
})

test('moving the plan start moves every phase with it, and the first deployment is respected: nothing is created in report-only before it', () => {
  const f = omitted(fixture('demo'))
  const a = runFixture(f)
  const b = runFixture(f, { startDate: '2026-09-14' })
  assert.deepEqual(violations(b.steps, b.schedule), [])
  assert.equal(t(b.schedule.phases![0].start) - t(a.schedule.phases![0].start), 14 * DAY)
  for (const p of b.schedule.phases!) assert.ok(t(p.start) >= t(b.schedule.start), `phase ${p.wave} starts before the plan`)

  // The first deployment is respected: nothing is created in report-only before it, and the phases still hold their rows.
  {
    const f = omitted(fixture('demo'))
    const first = '2026-09-02T12:00:00.000Z'
    const r = runFixture(f, { firstDeployment: first })
    assert.deepEqual(violations(r.steps, r.schedule), [])
    const creates = r.steps.filter((s) => s.scheduled?.transition === 'createReportOnly')
    assert.ok(creates.length > 0)
    for (const s of creates) assert.ok(t(s.scheduled!.at!) >= t(first), `${s.id} is created on ${s.scheduled!.at}`)
  }
})

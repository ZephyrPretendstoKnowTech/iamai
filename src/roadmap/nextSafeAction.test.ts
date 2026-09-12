// One executability rule (correction batch 2): whether a step's next safe technical
// action can be executed now is one answer, whether its policy can be enforced now
// is another, and neither is read from the phase a step is drawn in.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fixture } from './fixtures/index.ts'
import type { FixtureName } from './fixtures/index.ts'
import { runFixture } from './fixtures/run.ts'
import type { Step } from './types.ts'
import { executableNow, implementationIsCurrent, nextSafeAction } from './nextSafeAction.ts'
import { unavailableReason } from './operations.ts'
import { applyStepDecisions } from './decisions.ts'
import { referenceOptions } from './answers.ts'
import { BASELINE_MAPPINGS_KEY, sourceMappingsOf } from './sourceMappings.ts'

const NAMES: FixtureName[] = ['demo', 'demo-week2', 'small', 'messy', 'midflight']
/** Week two with its baseline's unsettled source references answered, so its report-only policies are not waiting on them. */
function answeredWeekTwo() {
  const raw = fixture('demo-week2')
  const source = BASELINE_MAPPINGS_KEY
  const pending = sourceMappingsOf(runFixture(raw).steps)
  return { ...raw, mapping: applyStepDecisions(raw.mapping, { [source]: { answers: Object.fromEntries(pending.map((p) => [p.id, referenceOptions()[0]])), at: raw.snapshot.asOf } }) }
}
const PLANS = [...NAMES.map((name) => ({ name: name as string, steps: runFixture(fixture(name)).steps })), { name: 'demo-week2-answered', steps: runFixture(answeredWeekTwo()).steps }]
const all = (): { name: string; step: Step }[] => PLANS.flatMap((p) => p.steps.map((step) => ({ name: p.name, step })))
const find = (name: string, id: string): Step => PLANS.find((p) => p.name === name)!.steps.find((s) => s.id === id || s.goalId === id)!

test('every step’s executability is the one answer: its action is current and its policy can be written; enforcement is a narrower question', () => {
  const seen = new Set<string>()
  for (const { name, step } of all()) {
    const next = nextSafeAction(step)
    seen.add(`${next.kind}:${next.executable}`)
    if (next.kind === 'none' || next.kind === 'decide' || next.kind === 'resolve-source') {
      assert.equal(next.executable, false, `${name}/${step.id}: ${next.kind} is executable`)
    } else {
      assert.equal(next.executable, implementationIsCurrent(step) && unavailableReason(step) === null, `${name}/${step.id}`)
      assert.equal(executableNow(step), next.executable)
    }
    if (next.enforceable) {
      assert.equal(next.kind, 'enforce', `${name}/${step.id}: enforceable without being the enforcement`)
      assert.equal(step.state.lifecycle, 'ready-to-enforce')
      assert.equal(next.executable, true)
    }
    if (next.kind === 'create-report-only' || next.kind === 'correct' || next.kind === 'prepare') assert.equal(next.enforceable, false)
    if (!next.executable && next.kind !== 'none') assert.notEqual(next.blockedBy, null, `${name}/${step.id}: held with no reason`)
  }
  for (const kind of ['create-report-only:true', 'create-report-only:false', 'correct:false', 'observe:true', 'observe:false', 'enforce:true', 'decide:false', 'resolve-source:false']) assert.ok(seen.has(kind), `no ${kind} step in the fixtures: ${[...seen].join(', ')}`)
})

test('readiness holds enforcement and not report-only creation; a missing object, a decision and a contradictory source hold the action itself', () => {
  // A readiness-gated create: executable now, not enforceable.
  const gated = all().find(({ step }) => nextSafeAction(step).kind === 'create-report-only' && step.state.condition === 'blocked' && nextSafeAction(step).executable)
  assert.ok(gated, 'no create held only by readiness in the fixtures')
  assert.deepEqual([nextSafeAction(gated.step).executable, nextSafeAction(gated.step).enforceable], [true, false])
  // An object the tenant lacks holds the creation.
  const missing = all().find(({ step }) => nextSafeAction(step).blockedBy === 'missing-object')
  assert.ok(missing, 'no step waiting on a missing object')
  assert.equal(nextSafeAction(missing.step).executable, false)
  // A correction held on the escape hatch is a correction, held, and says so.
  const legacy = nextSafeAction(find('demo', 's-goal-block-legacy-auth'))
  assert.equal(legacy.kind, 'correct')
  assert.equal(legacy.executable, false)
  assert.notEqual(legacy.blockedBy, null)
  // The source contradicts itself; a decision is a person's.
  assert.deepEqual(nextSafeAction(find('demo', 'admin-portals-protected')), { kind: 'resolve-source', executable: false, blockedBy: 'baseline-conflict', enforceable: false })
  const decision = all().find(({ step }) => step.state.condition === 'needs-decision')
  assert.ok(decision)
  assert.equal(nextSafeAction(decision.step).kind, 'decide')
  // A report-only policy mid-window: verifying is due now, enforcement is not.
  assert.deepEqual(nextSafeAction(find('demo-week2-answered', 's-goal-block-auth-transfer')), { kind: 'observe', executable: true, blockedBy: 'observation-incomplete', enforceable: false })
  // The same policy while a source reference it names is unanswered: nothing is due until it is.
  assert.deepEqual(nextSafeAction(find('demo-week2', 's-goal-block-auth-transfer')), { kind: 'observe', executable: false, blockedBy: 'missing-object', enforceable: false })
  // Watched to the point Foundation B grants it: enforcement is the action, and it can be taken.
  assert.deepEqual(nextSafeAction(find('demo-week2-answered', 's-goal-token-protection')), { kind: 'enforce', executable: true, blockedBy: null, enforceable: true })
})

test('the phase, wave and dates a step is drawn in never change what it can execute or enforce', () => {
  let checked = 0
  for (const { step } of all()) {
    if (!step.scheduled) continue
    const before = nextSafeAction(step)
    const moved = structuredClone(step)
    const scheduled = moved.scheduled as unknown as Record<string, unknown>
    for (const key of Object.keys(scheduled)) {
      if (typeof scheduled[key] === 'number') scheduled[key] = (scheduled[key] as number) + 3
      if (typeof scheduled[key] === 'string' && !Number.isNaN(Date.parse(scheduled[key] as string))) scheduled[key] = '2031-01-06T00:00:00.000Z'
    }
    assert.deepEqual(nextSafeAction(moved), before, step.id)
    checked++
  }
  assert.ok(checked > 10, `only ${checked} scheduled steps`)
})

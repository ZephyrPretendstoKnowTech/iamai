// Content review S0 (docs/content-review/specs/UNIVERSAL-CONTENT-CHANGES.md):
// one test per renderer fix, UI polish item and resolved decision, each
// asserting what the opened step now shows.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { CONTRACT, implementationEmptyOf } from './stepContract.ts'
import type { StepContract } from './stepContract.ts'
import { laneViewFor, prerequisiteLabelFor, readinessBlockersOf, waveStartOf } from './planBoard.ts'
import dependencyData from '../../actionability/dependency-data.json' with { type: 'json' }
import type { DependencyData } from '../../actionability/parseDependencyDoc.ts'
import { buildGraph, deriveLane } from '../../actionability/lanes.ts'
import type { ConditionState, PrerequisiteState, StepObservation, TenantState } from '../../actionability/lanes.ts'
import { fixture } from '../../roadmap/fixtures/index.ts'
import type { Fixture } from '../../roadmap/fixtures/index.ts'
import { runFixture } from '../../roadmap/fixtures/run.ts'
import { laneReadings } from './planLanes.ts'
import { planDates } from './stepVars.ts'
import type { StepVarContext } from './stepVars.ts'
import { stepBodyOf } from './stepBody.ts'
import { fillText } from '../../content/render.ts'
import type { StepBody } from './stepBody.ts'
import { usesDecisionAnatomy } from '../../roadmap/stepGroups.ts'

/** Every step's body on a fixture, as the Plan composes it (readinessWords.test.ts, stepSnapshots.ts). */
function bodiesOf(f: Fixture): Map<string, StepBody> {
  const r = runFixture(f, {}, null, f.snapshot.asOf)
  const readings = laneReadings(r.steps, [])
  const titleOf = (id: string): string | null => r.steps.find((s) => s.id === id)?.title ?? null
  const dates = planDates(r.steps, r.schedule.start, r.coverage.organisation.naming, f.snapshot)
  const out = new Map<string, StepBody>()
  for (const step of r.steps) {
    const reading = readings.get(step.id)
    const lane = laneViewFor(step, { readings, titleOf })
    const ctx: StepVarContext = { snapshot: f.snapshot, mapping: f.mapping, nameOf: (id) => r.input.names!.label(id), signature: 'IT', operatorId: f.operatorId, now: f.snapshot.asOf, ...dates, reportOnlyAt: step.reportOnlyAt ?? null, scheduledOn: waveStartOf(step), groups: f.groups, directory: r.input.directory, naming: r.coverage.organisation.naming }
    out.set(step.id, stepBodyOf(step, ctx, { lane, blockers: readinessBlockersOf(reading, titleOf), prerequisiteLabel: prerequisiteLabelFor(readings) }))
  }
  return out
}

test('R8: an enforced policy that drifted reads Ready · Correct, whatever conditional input is unanswered', () => {
  const data = dependencyData as DependencyData
  const graph = buildGraph(data)
  // A healthy tenant around the step: everything else complete, every condition settled, every prerequisite resolved.
  const tenant = (id: string, obs: StepObservation): TenantState => {
    const steps: Record<string, StepObservation> = Object.fromEntries(data.steps.map((s) => [s.id, { complete: true }]))
    const conditions: Record<string, ConditionState> = Object.fromEntries(data.conditions.map((c) => [c.name, 'not-applicable']))
    const prerequisites: Record<string, PrerequisiteState> = Object.fromEntries(data.edges.filter((e) => e.prerequisiteKind !== 'step').map((e) => [e.prerequisite, 'resolved']))
    return { steps: { ...steps, [id]: obs }, conditions, prerequisites }
  }
  const enforced: StepObservation = { exists: true, enforced: true, evidenceSatisfied: true }
  for (const [id, input] of [['s-goal-block-legacy-auth', 'Mail-sending devices'], ['s-goal-block-device-code', 'Device code sign-in'], ['s-goal-guests-mfa', 'Partner or MSP access']]) {
    const drifted = deriveLane(id, graph, tenant(id, { ...enforced, drift: true, unsaved: [input] }), { deferred: [] })
    assert.deepEqual([drifted.lane, drifted.substatus], ['Ready', 'Correct'], `${id}: an unanswered ${input} overrides the correction`)
    // The input still gates completion, and with nothing to correct it is the next thing.
    const asPinned = deriveLane(id, graph, tenant(id, { ...enforced, unsaved: [input] }), { deferred: [] })
    assert.deepEqual([asPinned.lane, asPinned.substatus], ['Ready', 'Decision'], `${id}: the unanswered input no longer holds completion`)
  }
})

test('R9: "No implementation needed" appears only on a goal delivered with nothing open', () => {
  const E = CONTRACT.implementation.empty as Record<string, string[]>
  const satisfied = { state: { satisfied: true, condition: 'healthy', setAside: false }, fix: [], implementation: { offered: false, reason: null, hold: null }, whatToDo: { kind: 'preserve', text: 'x' } } as unknown as StepContract
  assert.equal(implementationEmptyOf(satisfied).key, 'inPlace')
  assert.equal(implementationEmptyOf(satisfied, 1).key, 'blocked', 'an unresolved tile still reads No implementation needed')
  assert.equal(implementationEmptyOf({ ...satisfied, fix: [{ key: 'step:x', text: 'x' }] } as unknown as StepContract).key, 'blocked', 'a pending correction still reads No implementation needed')
  // Every opened step on the fixtures: Block Legacy Auth with Mail-sending devices unconfirmed among them.
  let open = 0
  for (const name of ['mid'] as const) {
    for (const [id, b] of bodiesOf(fixture(name))) {
      if (b.readiness.tiles.length === 0 && b.contract.fix.length === 0) continue
      assert.notEqual(b.empty.title, E.inPlace[0], `${name}/${id}: "${E.inPlace[0]}" beside ${b.readiness.tiles.length} open tile(s)`)
      if (b.contract.state.satisfied) open += 1
    }
  }
  assert.ok(open > 0, 'no satisfied step with an open item on the fixtures: the premise is untested')
})

test('D2: steps keep supported channels across actions and omit permanently unsupported formats', () => {
  const unavailable = fillText(CONTRACT.implementation.channelUnavailable, { address: 'feedback@getiamai.com' })
  // Editorial batch C: a channel with nothing for this action says so neutrally, and never sends a customer to the product's feedback address.
  assert.equal(unavailable, 'This format has no output for the current action. Use the available guidance and readiness checks on this step.')
  assert.doesNotMatch(unavailable, /feedback@|could not be loaded/)
  let steps = 0
  let missing = 0
  for (const name of ['demo', 'mid'] as const) {
    for (const [id, b] of bodiesOf(fixture(name))) {
      // A decision-anatomy step (Define Your Rollout Scope) builds nothing and draws no Implementation (owner, 2026-09-19).
      if (usesDecisionAnatomy(id)) { assert.equal(b.showImplementation, false, `${name}/${id}`); continue }
      assert.equal(b.showImplementation, true, `${name}/${id}: the Implementation region is hidden`)
      assert.ok(b.artifacts.some((a) => a.id === 'ai'), `${name}/${id}: AI briefing is missing`)
      assert.ok(b.artifacts.every(a => a.text().trim().length > 0), `${name}/${id}: empty resource`)
      for (const a of b.artifacts.filter((x) => x.unavailable)) {
        assert.ok(a.text().trim().length > 0, `${name}/${id}: ${a.id} has no explanation`)
        assert.doesNotMatch(a.text(), /could not be loaded/, `${name}/${id}: lifecycle wait is presented as an error`)
        missing += 1
      }
      steps += 1
    }
  }
  assert.ok(steps > 20 && missing === 0, `steps ${steps}, channels without content ${missing}`)
  const src = readFileSync('src/ui/surfaces/ContentStep.tsx', 'utf8')
  assert.match(src, /const copyable = active !== null && active\.unavailable !== true/, 'a channel with no content can be copied')
  assert.doesNotMatch(src, /artifacts\.length === 0 \?/, 'the region still swaps its channels for a box')
})

// The pinned baseline wins on every channel of a create (q-pin).
//
// On mid the High user-risk step's portal block said "Require multifactor
// authentication, Require password change" and its JSON sent {mfa, passwordChange}
// — the goal's own template in data/goals.json — while its Implementation Task and
// reference said "Require risk remediation, Require authentication strength", the
// pinned policy. A fixture's eight-policy stand-in carries no policy for that goal,
// so the engine wrote the goal's template for a goal the pinned map holds. A goal
// the pinned map holds is written from the pinned policy through the translator,
// on every fixture, and every channel of its create says the same grant and
// session as the pin.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { curatedFixture, fixture } from './fixtures/index.ts'
import type { Fixture, FixtureName } from './fixtures/index.ts'
import { runFixture, withDirectionApproved, withFoundationSettled } from './fixtures/run.ts'
import { PINNED_GOAL_MAP, goalInMap } from './goalMap.ts'
import { PINNED } from '../baseline/pinned.ts'
import { policyFacts } from '../coverage/facts.ts'
import { portalLines } from './portalLines.ts'
import type { Step } from './types.ts'
import { boardHolds, boardReadingsOf, laneViewFor, prerequisiteLabelFor, readinessBlockersOf, waveStartOf } from '../ui/surfaces/planBoard.ts'
import { planDates } from '../ui/surfaces/stepVars.ts'
import type { StepVarContext } from '../ui/surfaces/stepVars.ts'
import { stepBodyOf } from '../ui/surfaces/stepBody.ts'

const SCENARIOS: [string, () => Fixture][] = [
  ['getiamai (curated, foundation settled, Direction approved)', () => withDirectionApproved(withFoundationSettled(curatedFixture('getiamai')))],
  ...(['demo', 'demo-week2', 'small', 'mid', 'large', 'messy', 'midflight'] as FixtureName[]).map((n): [string, () => Fixture] => [n, () => fixture(n)]),
]

const PINNED_BY_NAME = new Map(PINNED.policies.map((p) => [p.displayName, p]))
const PORTAL = { policyName: 'Policy', nameOf: (id: string) => id, portalRoot: 'Root', reportOnlyLine: 'Report-only', exclusionsLine: 'Exclusions' }

/**
 * A policy's grant and session as the portal words them, with the strength's
 * name taken out: the step names this tenant's strength and the pin the
 * author's, and which one it is is the translator's business, not this test's.
 */
const controls = (lines: readonly string[]): string[] =>
  lines.filter((l) => /^(?:Grant|Session) →/.test(l)).map((l) => l.replace(/(Require authentication strength): [^,;]+/, '$1'))
const controlsOf = (body: unknown): string[] => controls(portalLines(policyFacts(body, new Map()), PORTAL))

type Drawn = { instructions: string[]; facts: string[]; json: string | null }

/** Every step of the scenario's plan with what its body draws, the way the Plan draws it. */
function drawnSteps(f: Fixture): { step: Step; drawn: () => Drawn }[] {
  const r = runFixture(f)
  const board = boardReadingsOf(r.steps, r.schedule.cleanup, f.mapping.breakGlassAnswers ?? null)
  const prerequisiteLabel = prerequisiteLabelFor(board.readings)
  const dates = planDates(r.steps, r.schedule.start, r.coverage.organisation.naming, f.snapshot, (s) => boardHolds(s, laneViewFor(s, board)))
  return r.steps.map((step) => ({
    step,
    drawn: () => {
      const ctx = { snapshot: f.snapshot, mapping: f.mapping, nameOf: (id: string) => r.input.names!.label(id), signature: 'IT', operatorId: f.operatorId, now: f.snapshot.asOf, ...dates, reportOnlyAt: step.reportOnlyAt ?? null, scheduledOn: waveStartOf(step), groups: f.groups, directory: r.input.directory, naming: r.coverage.organisation.naming } as StepVarContext
      const body = stepBodyOf(step, ctx, { lane: laneViewFor(step, board), blockers: readinessBlockersOf(board.readings.get(step.id), board.titleOf), prerequisiteLabel })
      const task = body.emergencyAccountTasks?.tasks[0]
      return {
        instructions: body.instructions.portal ?? [],
        // A fact is its setting line split at its first colon (policyTasks.ts portalProcedureOf): put back whole.
        facts: (task?.facts ?? []).map((x) => (x.label === 'Setting' ? x.value : `${x.label}: ${x.value}`)),
        json: body.artifacts.find((a) => a.id === 'json')?.text() ?? null,
      }
    },
  }))
}

for (const [name, make] of SCENARIOS) {
  test(`${name}: no step for a goal the pinned map holds is written from the goal's own template`, () => {
    for (const { step } of drawnSteps(make())) {
      if (!step.goalId || !goalInMap(PINNED_GOAL_MAP, step.goalId)) continue
      for (const op of step.action.resolution?.policies ?? []) {
        assert.notEqual(op.sourceName, step.goalId, `${step.id}: its ${op.mode} is the goal's template, not the pinned policy`)
      }
    }
  })

  test(`${name}: every create backed by a pinned policy says the pin's grant and session on every channel`, () => {
    let checked = 0
    for (const { step, drawn } of drawnSteps(make())) {
      if (!step.goalId || !goalInMap(PINNED_GOAL_MAP, step.goalId) || step.action.kind !== 'create') continue
      const ops = (step.action.resolution?.policies ?? []).filter((op) => op.mode === 'create')
      const pinned = ops.map((op) => PINNED_BY_NAME.get(op.sourceName))
      if (ops.length === 0 || pinned.some((p) => p === undefined)) continue
      ops.forEach((op, i) => assert.deepEqual(controlsOf(op.body), controlsOf(pinned[i]), `${step.id}: the body of ${op.sourceName}`))
      // A pinned policy this tenant cannot use yet offers no body and says why:
      // the objects it names that are not here are the step's own blockers.
      if (step.action.json === null) assert.ok((step.action.missing ?? []).length > 0, `${step.id}: no body, and nothing says why`)
      checked++
      if (ops.length !== 1) continue
      const want = controlsOf(pinned[0])
      if (step.action.json) assert.deepEqual(controlsOf(JSON.parse(step.action.json)), want, `${step.id}: the step's JSON`)
      const d = drawn()
      const said = controls(d.instructions)
      if (said.length > 0) assert.deepEqual(said, want, `${step.id}: the portal block`)
      const facts = controls(d.facts)
      if (facts.length > 0) assert.deepEqual(facts, want, `${step.id}: the Implementation Task's facts`)
      const json = d.json !== null && d.json.trim().startsWith('{') ? (JSON.parse(d.json) as Record<string, unknown>) : null
      if (json && 'grantControls' in json) assert.deepEqual(controlsOf(json), want, `${step.id}: the JSON channel`)
    }
    assert.ok(checked > 0, 'the premise: the plan creates a policy from the pin')
  })
}

test('mid: the High user-risk create requires risk remediation with the strength, on the portal block, the task and the JSON', () => {
  // Curated, so the author's own groups this policy names read as the author's
  // environment and nothing holds the create: every channel is drawn.
  const steps = drawnSteps(curatedFixture('mid'))
  const hit = steps.find((s) => s.step.id === 's-goal-user-risk')
  assert.ok(hit, 'mid plans the High user-risk step')
  const op = hit.step.action.resolution?.policies[0]
  assert.equal(op?.sourceName, 'IAC - P2 - GLOBAL - GRANT - High-Risk Users - Risk Remediation')
  const grant = (op?.body as { grantControls?: { operator?: string; builtInControls?: string[]; authenticationStrength?: { id?: string } } }).grantControls
  assert.deepEqual(grant?.builtInControls, ['riskRemediation'])
  assert.equal(grant?.operator, 'AND')
  assert.ok(grant?.authenticationStrength?.id, 'the grant carries the resolved strength')
  const d = hit.drawn()
  const want = 'Grant → Require risk remediation, Require authentication strength; Require all the selected controls'
  assert.ok(controls(d.instructions).includes(want), `portal block: ${JSON.stringify(controls(d.instructions))}`)
  assert.ok(controls(d.facts).includes(want), `task facts: ${JSON.stringify(controls(d.facts))}`)
  assert.ok(hit.step.action.json, 'the create is offered')
  assert.deepEqual(JSON.parse(hit.step.action.json).grantControls.builtInControls, ['riskRemediation'])
  // The Medium-risk step stays its own step (the risk-pair merge is v1.1).
  const medium = steps.find((s) => s.step.id === 's-goal-user-risk-medium')
  assert.ok(medium, 'the Medium user-risk step is still its own step')
  assert.equal(medium.step.action.resolution?.policies[0]?.sourceName, 'IAC - P2 - GLOBAL - GRANT - Medium-Risk Users')
})

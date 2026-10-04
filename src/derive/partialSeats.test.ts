// v1.1 T1-4, partial P2 seats: the risk policies are planned for everyone even
// where Entra ID P2 covers only some people, and only Inventory showed the seat
// count. Each step whose goal needs P2 now says, after its own About sentence,
// how many seats against how many people it covers, and that the people
// without a seat are not covered by the licence. Words only: the plan's steps
// do not change.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fixture } from '../roadmap/fixtures/index.ts'
import { runFixture } from '../roadmap/fixtures/run.ts'
import { partialSeatsLine } from './notLicensed.ts'
import { stepContract } from '../ui/surfaces/stepContract.ts'
import { stepExportView } from '../ui/surfaces/stepExport.ts'
import type { StepVarContext } from '../ui/surfaces/stepVars.ts'

const RISK_STEPS = ['s-goal-sign-in-risk', 's-goal-sign-in-risk-medium', 's-goal-user-risk', 's-goal-user-risk-medium', 's-goal-risky-users-register-block']

const ctxOf = (f: ReturnType<typeof fixture>, run: ReturnType<typeof runFixture>): StepVarContext => ({ snapshot: f.snapshot, mapping: f.mapping, nameOf: (id) => run.input.names!.label(id), signature: 'IT', operatorId: f.operatorId, now: f.snapshot.asOf, groups: f.groups })

test('each risk step on a tenant with fewer P2 seats than people says how many seats against how many people', () => {
  const f = fixture('mid')
  const run = runFixture(f)
  const ctx = ctxOf(f, run)
  assert.equal(f.snapshot.capabilities.entraP2.seats, 140, 'the premise: the mixed-licence tenant holds 140 P2 seats')
  for (const id of RISK_STEPS) {
    const step = run.steps.find((s) => s.id === id)
    assert.ok(step, `the premise: the plan carries ${id}`)
    const line = partialSeatsLine(step, f.snapshot)
    assert.ok(line, `${id} says its seats`)
    assert.match(line, /^Entra ID P2: 140 seats for the [0-9,]+ people who sign in here\. Microsoft licenses risk-based Conditional Access per user, so the people without a seat, at least [0-9,]+ people, are not covered by the licence\.$/)
    // The About sentence carries it after the step's own, on screen and in the export.
    const why = stepContract(step, ctx).why
    assert.ok(why.endsWith(` ${line}`), `${id}: About this Step ends with the seats line`)
    assert.equal(stepExportView(step, ctx).why, why, `${id}: the export says what the screen says`)
  }
  // The count is the tenant's active people, guests aside (not the step's own population,
  // which an open policy's words never move with): 239 on mid, of whom 140 hold a seat.
  const userRisk = run.steps.find((s) => s.id === 's-goal-user-risk-medium')!
  assert.match(partialSeatsLine(userRisk, f.snapshot)!, /140 seats for the 239 people .* at least 99 people,/)
  // Every risk step says the same count.
  assert.equal(new Set(RISK_STEPS.map((id) => partialSeatsLine(run.steps.find((s) => s.id === id)!, f.snapshot))).size, 1)
})

test('no seats line where the seats cover everyone, where the goal needs no P2, or on a full-P2 tenant', () => {
  const f = fixture('mid')
  const run = runFixture(f)
  const risk = run.steps.find((s) => s.id === 's-goal-sign-in-risk')!
  const enough = { ...f.snapshot, capabilities: { ...f.snapshot.capabilities, entraP2: { ...f.snapshot.capabilities.entraP2, seats: 1000 } } }
  assert.equal(partialSeatsLine(risk, enough), null)
  for (const step of run.steps.filter((s) => !RISK_STEPS.includes(s.id))) assert.equal(partialSeatsLine(step, f.snapshot), null, `${step.id} needs no P2`)
  const huge = fixture('huge')
  const hugeRun = runFixture(huge)
  for (const id of RISK_STEPS) {
    const step = hugeRun.steps.find((s) => s.id === id)!
    assert.equal(partialSeatsLine(step, huge.snapshot), null, `${id}: every person holds a seat`)
    assert.doesNotMatch(stepContract(step, ctxOf(huge, hugeRun)).why, /seats/)
  }
})

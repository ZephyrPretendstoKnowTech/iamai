// Review queue (board/export Ready vs blocked): a report-only create that an
// emergency-access wait does not hold (A3 B3) exported "Ready · Create" over "This is
// the work once the prerequisites are resolved. It is not ready to run", when only
// values IAMAI cannot fill stood between it and Copy. The note's lead now follows the
// step's intended next action, one reading for the screen and the export. The
// legitimate report-only create is kept, and a held step keeps its hold and its note.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { curatedFixture, fixture } from '../../roadmap/fixtures/index.ts'
import { runFixture, withFoundationSettled } from '../../roadmap/fixtures/run.ts'
import { implementationIsCurrent, nextSafeAction } from '../../roadmap/nextSafeAction.ts'
import { laneReadings } from './planLanes.ts'
import { laneViewOf } from './planBoard.ts'
import { planDates } from './stepVars.ts'
import { stepBodyOf } from './stepBody.ts'
import { stepExportView } from './stepExport.ts'
import { CONTRACT } from './stepContract.ts'

const W = CONTRACT.implementation.preview
const NOT_READY = 'not ready to run'

function open(f: ReturnType<typeof fixture>, id: string) {
  const r = runFixture(f, {}, null, f.snapshot.asOf)
  const readings = laneReadings(r.steps)
  const titleOf = (x: string): string | null => r.steps.find((s) => s.id === x)?.title ?? null
  const dates = planDates(r.steps, r.schedule.start, r.coverage.organisation.naming, f.snapshot)
  const step = r.steps.find((s) => s.id === id)!
  const ctx = { snapshot: f.snapshot, mapping: f.mapping, nameOf: (x: string) => r.input.names!.label(x), signature: 'IT', operatorId: f.operatorId, now: f.snapshot.asOf, ...dates, reportOnlyAt: step.reportOnlyAt ?? null, groups: f.groups, directory: r.input.directory, naming: r.coverage.organisation.naming } as never
  const lane = laneViewOf(readings.get(step.id)!, titleOf)
  return { step, lane, body: stepBodyOf(step, ctx, { lane }), exp: stepExportView(step, ctx, lane) }
}

test('a report-only create waiting only on values reads Ready on the board, the screen and the export, and says values stand between it and Copy', () => {
  // With the plan's foundation settled (roadmap/foundations.ts): until both
  // pinned groups are, every policy step is held and the plan dates nothing.
  const small = withFoundationSettled(fixture('small'))
  const mid = withFoundationSettled(fixture('mid'))
  // Curated for the High user-risk step: it is written from the pinned policy
  // (q-pin), which names groups of the author's this baseline has not settled.
  const midCurated = withFoundationSettled(curatedFixture('mid'))
  for (const [f, id] of [[small, 's-goal-all-users-no-persistence'], [mid, 's-goal-all-users-no-persistence'], [mid, 's-goal-pim-activation-reauth'], [midCurated, 's-goal-user-risk']] as const) {
    const { step, lane, body, exp } = open(f, id)
    const what = `${f === small ? 'small' : 'mid'} ${id}`
    // Premises: the intended next action is the report-only create, and it is not copyable yet.
    assert.equal(implementationIsCurrent(step), true, what)
    assert.equal(exp.state, 'Ready · Create', what)
    assert.equal(lane.label, exp.state, `${what}: board and export disagree`)
    assert.match(exp.whatToDo[0], /^Create the policy in [Rr]eport-only/, `${what}: the report-only create was not kept`)
    assert.equal(body.previewNote, null, what)
    assert.ok(body.artifacts.every(a => a.unavailable !== true), what)
    for (const line of exp.whatToDo) assert.equal(line.includes(NOT_READY) || line === W.text || line === W.textValues, false, `${what}: ${line}`)
  }
})

test('a step whose next action is to clear a hold keeps the hold, the prerequisites note, and no walk-through in its export', () => {
  const { step, body, exp } = open(fixture('demo'), 's-goal-mfa-all-users')
  assert.equal(implementationIsCurrent(step), false)
  assert.equal(nextSafeAction(step).executable, false, 'the hold was released')
  assert.equal(body.previewNote, null)
  assert.equal(exp.whatToDo.some((l) => l.startsWith('Enable policy:') || l === W.text || l === W.textValues), false, JSON.stringify(exp.whatToDo))
})

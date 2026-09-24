// Require Phishing-Resistant MFA for Admins, on the pin (walk list 4.x item 1).
//
// The pinned baseline files "IAC - GLOBAL - GRANT - MFA - AllAdmins" under the
// admins goal and grants it the "Modern MFA + TAP" strength. The pinned baseline
// wins: the goal's floor is that strength (coverage/classify.ts raiseFloor), so
// the policy built exactly as written is offered its turn-on from report-only,
// and once it is On the step is Completed. It sat On Hold for good before,
// "Not supported" with nothing to submit, because the goal read the plan's own
// grant as a gap. No line on the step says that grant is weaker (owner, 2026-09-24).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { asCuratedBaseline, fixture } from './fixtures/index.ts'
import type { Fixture } from './fixtures/index.ts'
import { pinnedPackage } from '../baseline/pinned.ts'
import { runFixture, withFoundationSettled } from './fixtures/run.ts'
import { stepBodyOf } from '../ui/surfaces/stepBody.ts'
import type { StepVarContext } from '../ui/surfaces/stepVars.ts'

const ADMINS = 's-goal-admins-phishing-resistant'
const onPin = (): Fixture => withFoundationSettled({ ...fixture('small'), baseline: asCuratedBaseline(pinnedPackage() as never) })

/** The tenant with the step's own create in it, in the state given. */
function built(f: Fixture, state: string): Fixture {
  const op = runFixture(f).steps.find((s) => s.id === ADMINS)!.action.resolution!.policies[0]
  assert.equal(op.mode, 'create', 'the premise: the step creates the baseline policy')
  const g = structuredClone(f)
  ;(g.snapshot.config.caPolicies!.rows as Record<string, unknown>[]).push({ ...(structuredClone(op.body) as Record<string, unknown>), id: 'c0100000-0000-4000-8000-0000000000a1', state, createdDateTime: f.snapshot.asOf, modifiedDateTime: f.snapshot.asOf })
  return g
}

test('on the pin, the admin policy built as written is offered its turn-on, completes once On, and nothing on the step calls its grant weaker', () => {
  const watched = built(onPin(), 'enabledForReportingButNotEnforced')
  const ops = runFixture(watched, { snapshot: watched.snapshot } as never).steps.find((s) => s.id === ADMINS)!.action.resolution?.policies ?? []
  assert.deepEqual(ops.map((o) => [o.mode, o.body]), [['update', { state: 'enabled' }]], `the switch, and nothing it already holds: ${JSON.stringify(ops.map((o) => o.body))}`)

  const on = built(onPin(), 'enabled')
  const r = runFixture(on, { snapshot: on.snapshot } as never)
  const step = r.steps.find((s) => s.id === ADMINS)!
  assert.equal(step.status, 'done', `On as the plan wrote it is Completed: ${step.status} ${JSON.stringify(step.blockers.map((b) => b.label))}`)
  const ctx: StepVarContext = { snapshot: on.snapshot, mapping: r.input.mapping, nameOf: (id: string) => r.input.names!.label(id), signature: 'IT', operatorId: on.operatorId, now: on.snapshot.asOf, groups: on.groups }
  for (const s of [runFixture(onPin()).steps.find((x) => x.id === ADMINS)!, step]) {
    const body = stepBodyOf(s, ctx)
    const said = [String(body.cs?.why ?? ''), ...[...body.readiness.tiles, ...body.readiness.satisfied].flatMap((t) => [t.label, t.value, t.note ?? '']), ...body.contract.doneWhen, ...body.artifacts.map((a) => { try { return a.text() } catch { return '' } })].join('\n')
    assert.doesNotMatch(said, /weaker than|not exclusively phishing-resistant|does not accept a Temporary Access Pass/i, said)
  }
})

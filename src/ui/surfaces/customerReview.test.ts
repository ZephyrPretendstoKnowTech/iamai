import test from 'node:test'
import assert from 'node:assert/strict'
import { fixture } from '../../roadmap/fixtures/index.ts'
import { runFixture } from '../../roadmap/fixtures/run.ts'
import { laneReadings } from './planLanes.ts'
import { boardReadingsOf, laneViewFor } from './planBoard.ts'
import { stepBodyOf } from './stepBody.ts'
import { customerPlanSteps } from './customerPlanSteps.ts'
import { passkeyBindings } from '../../roadmap/passkeySettings.ts'

function setup(profile = false) {
  const f = fixture('demo')
  if (profile) {
    const row = f.snapshot.config.authMethodsPolicy.rows[0] as { authenticationMethodConfigurations: Record<string, unknown>[] }
    const config = row.authenticationMethodConfigurations.find(c => String(c.id).toLowerCase() === 'fido2')!
    config.defaultPasskeyProfile = 'existing-profile'
  }
  const r = runFixture(f)
  const ctx = { snapshot: f.snapshot, mapping: f.mapping, nameOf: (id: string) => r.input.names!.label(id), signature: 'IT', operatorId: f.operatorId, now: f.snapshot.asOf, groups: f.groups }
  return { f, r, ctx }
}

test('a prerequisite never fabricates an update or a completion, and creates exactly the pinned baseline combinations it completes on', () => {
  {
    const { f, r, ctx } = setup(true)
    const step = r.steps.find(s => s.id === 's-prereq-passkey-settings')!
    const reading = laneReadings(r.steps).get(step.id)!
    assert.equal(reading.lane, 'Ready')
    assert.equal(reading.substatus, 'Review')
    assert.equal(step.state.satisfied, false)
    assert.ok(step.blockers.length > 0)
    assert.equal(passkeyBindings(f.snapshot)['passkey.target.fido2Configuration'], undefined)
    const body = stepBodyOf(step, ctx, { lane: laneViewFor(step, boardReadingsOf(r.steps, r.schedule.cleanup, r.input.mapping.breakGlassAnswers ?? null)) })
    assert.match(body.artifacts.find(a => a.id === 'portal')!.text(), /Open only the applicable profiles/)
    assert.doesNotMatch(body.artifacts.find(a => a.id === 'portal')!.text(), /Apply the resolved change/)
  }
  {
    const f = fixture('demo')
    f.snapshot.config.authStrengths.rows = []
    const r = runFixture(f)
    const step = r.steps.find(s => s.id === 's-prereq-auth-strength')!
    const ctx = { snapshot: f.snapshot, mapping: f.mapping, nameOf: (id: string) => r.input.names!.label(id), signature: 'IT', operatorId: f.operatorId, now: f.snapshot.asOf, groups: f.groups }
    const body = stepBodyOf(step, ctx, {lane: laneViewFor(step, boardReadingsOf(r.steps, r.schedule.cleanup, r.input.mapping.breakGlassAnswers ?? null))})
    const wanted = step.authenticationStrengthTarget!.allowedCombinations
    assert.equal(wanted.length, 4, 'the pinned baseline has four combinations')
    const portal = body.artifacts.find(a => a.id === 'portal')!.text()
    assert.match(portal, /Temporary Access Pass \(one-time use\)/)
    assert.doesNotMatch(portal, /multi-use|five methods|‹/i)
    for (const a of body.artifacts.filter(a => a.id === 'json')) {
      assert.doesNotMatch(a.text(), /temporaryAccessPassMultiUse/)
      for (const method of wanted) assert.ok(a.text().includes(method), `${a.id}: ${method}`)
    }
    assert.equal(body.contract.state.satisfied, false)
  }
})

test('customer plans omit the admin-portals step without deleting its safety assessment', () => {
  const { r } = setup()
  assert.ok(r.steps.some(s => s.goalId === 'admin-portals-protected'))
  const publicSteps = customerPlanSteps(r.steps)
  assert.equal(publicSteps.some(s => s.goalId === 'admin-portals-protected'), false)
  assert.equal(publicSteps.length, r.steps.filter(s => s.goalId !== 'admin-portals-protected').length)
})


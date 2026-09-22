import test from 'node:test'
import assert from 'node:assert/strict'
import { fixture } from '../../roadmap/fixtures/index.ts'
import { runFixture } from '../../roadmap/fixtures/run.ts'
import { laneReadings } from './planLanes.ts'
import { boardReadingsOf, laneViewFor } from './planBoard.ts'
import { stepBodyOf } from './stepBody.ts'
import { customerPlanSteps } from './customerPlanSteps.ts'
import { passkeyBindings } from '../../roadmap/passkeySettings.ts'
import { questionFor } from './stepQuestion.ts'
import { contentStepFor } from '../../content/stepTitle.ts'

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

test('passkey profiles offer an early manual review without fabricating an update or completing the prerequisite', () => {
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
})

test('customer plans omit the admin-portals step without deleting its safety assessment', () => {
  const { r } = setup()
  assert.ok(r.steps.some(s => s.goalId === 'admin-portals-protected'))
  const publicSteps = customerPlanSteps(r.steps)
  assert.equal(publicSteps.some(s => s.goalId === 'admin-portals-protected'), false)
  assert.equal(publicSteps.length, r.steps.filter(s => s.goalId !== 'admin-portals-protected').length)
})

test('guest decisions remain answerable without service-provider sign-ins or an unsupported partner picker', () => {
  const { r, ctx } = setup()
  const step = r.steps.find(s => s.goalId === 'guests-mfa')!
  const cs = contentStepFor(step) as Record<string, any>
  assert.equal(cs.decision.pickerSource, undefined)
  assert.equal(cs.decision.heading, 'IT Provider Access')
  assert.ok(questionFor(cs.decision, {}))
  const body = stepBodyOf(step, ctx, { lane: laneViewFor(step, boardReadingsOf(r.steps, r.schedule.cleanup, r.input.mapping.breakGlassAnswers ?? null)) })
  const portal = body.artifacts.find(a => a.id === 'portal')!
  assert.ok(portal)
  assert.doesNotMatch(portal.text(), /channel is not available/)
})


test('authentication-strength creation uses the same baseline combinations as automatic completion', () => {
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
})

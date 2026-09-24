import test from 'node:test'
import assert from 'node:assert/strict'
import { readyEvidence } from './fixtures/readyEvidence.ts'
import { fixture } from './fixtures/index.ts'
import { runFixture } from './fixtures/run.ts'
const APP = '708861da-226e-4d65-a57a-24128df64524'
const fixtureWithUse = () => {
 const f = fixture('demo')
 f.mapping.workflowAnswers = { ...(f.mapping.workflowAnswers ?? {}), inforcer: 'yes' }
 f.mapping.facetOverrides.inforcer = { on: true, reason: 'confirmed in use' }
 f.mapping.workflowConfirmedAt = f.snapshot.asOf
 return f
}
test('Inforcer uses the ordinary scoped goal and exact application identity, never generic acknowledgement, and No is a meaningful not-applicable row', () => {
  // Inforcer uses the ordinary scoped goal and exact application identity, never generic acknowledgement
  {
   const f = fixtureWithUse()
   const before = runFixture(f).steps
   const unresolved = before.find(s => s.id === 's-goal-inforcer-mfa')!
   assert.ok(unresolved)
   assert.equal(unresolved.state.satisfied, false)
   assert.equal(unresolved.manualReview, undefined)
   assert.ok(unresolved.configurationFindings?.some(f => f.key === 'inforcerApplication' && f.outcome === 'unknown'))
   assert.equal(before.some(s => s.id.startsWith('s-review-baseline-iac-app-inforcer')), false)
   f.snapshot.appSignInSummary.push({ appId: 'wrong-id', appDisplayName: 'Inforcer', signInCount: 1 })
   assert.equal(runFixture(f).steps.find(s => s.id === unresolved.id)?.configurationFindings?.[0].outcome, 'unknown')
   f.snapshot.appSignInSummary.push({ appId: APP, signInCount: 1 })
   const exact = runFixture(f).steps.find(s => s.id === unresolved.id)!
   assert.equal(exact.configurationFindings?.[0].outcome, 'pass')
   assert.ok(exact.action.resolution?.policies.length)
   assert.ok(JSON.stringify(exact.action).includes(APP))
  }

  // Inforcer No remains a meaningful not-applicable row
  {
   const f = fixtureWithUse()
   f.mapping.workflowAnswers!.inforcer = 'no'
   f.mapping.facetOverrides.inforcer = { on: false, reason: 'confirmed not in use' }
   const step = runFixture(f).steps.find(s => s.id === 's-goal-inforcer-mfa')!
   assert.ok(step)
   assert.equal(step.state.setAside, true)
   assert.equal(step.state.satisfied, false)
  }
})

test('Inforcer recognizes an exact enforced policy and deletion reopens work without repurposing broad MFA', () => {
 const f = fixtureWithUse()
 f.snapshot.appSignInSummary.push({ appId: APP, signInCount: 1 })
 const draft = runFixture(f).steps.find(s => s.id === 's-goal-inforcer-mfa')!
 const operation = draft.action.resolution!.policies[0]
 const body = operation.intent ?? operation.target ?? operation.body
 f.snapshot.config.caPolicies.rows.push({ ...body, id: 'tenant-inforcer', state: 'enabled', displayName: 'Tenant Inforcer MFA' })
 readyEvidence(f, f.snapshot)
 const enforced = runFixture(f).steps.find(s => s.id === draft.id)!
 assert.equal(enforced.state.lifecycle, 'enforced')
 assert.equal(enforced.state.observation?.reviewRequired, false, 'exact deployed configuration is recognized even if separate emergency readiness is pending')
 assert.ok(enforced.action.resolution?.policies.every(p => p.mode === 'create' || p.policyId === 'tenant-inforcer'), 'never changes the existing all-app MFA policy')
 f.snapshot.config.caPolicies.rows = f.snapshot.config.caPolicies.rows.filter(raw => (raw as { id?: string }).id !== 'tenant-inforcer')
 const deleted = runFixture(f).steps.find(s => s.id === draft.id)!
 assert.equal(deleted.state.satisfied, false)
 assert.ok(deleted.action.resolution?.policies.every(p => p.mode === 'create'), 'missing exact policy is created without rewriting broad protection')
})

test('broader MFA coverage cannot complete an unresolved Inforcer application finding', () => {
 for (const name of ['small', 'mid', 'large'] as const) {
  const f = fixture(name)
  f.mapping.workflowAnswers = { ...(f.mapping.workflowAnswers ?? {}), inforcer: 'yes' }
  f.mapping.facetOverrides.inforcer = { on: true, reason: 'confirmed in use' }
  f.mapping.workflowConfirmedAt = f.snapshot.asOf
  const result = runFixture(f)
  const step = result.steps.find(s => s.id === 's-goal-inforcer-mfa')!
  assert.ok(step.configurationFindings?.some(f => f.key === 'inforcerApplication' && f.outcome === 'unknown'), name)
  assert.equal(step.state.satisfied, false, `${name}: broad MFA coverage is not proof the required application was resolved`)
  assert.notEqual(step.status, 'done')
  assert.equal(step.history.some(h => h.to === 'done'), false, 'no contradictory completion history')
 }
})

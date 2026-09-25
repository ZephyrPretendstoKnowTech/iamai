import test from 'node:test'
import assert from 'node:assert/strict'
import { readyEvidence } from './fixtures/readyEvidence.ts'
import { fixture } from './fixtures/index.ts'
import { runFixture } from './fixtures/run.ts'
import { policyInspectionLines } from '../ui/surfaces/stepResources.ts'
const APP = '708861da-226e-4d65-a57a-24128df64524'
const fixtureWithUse = () => {
 const f = fixture('demo')
 f.mapping.workflowAnswers = { ...(f.mapping.workflowAnswers ?? {}), inforcer: 'yes' }
 f.mapping.facetOverrides.inforcer = { on: true, reason: 'confirmed in use' }
 f.mapping.workflowConfirmedAt = f.snapshot.asOf
 return f
}
// Owner decision 17 (2026-09-25): Confirm What You Use says whether Inforcer is
// used, never whether this scan saw it sign in. Used, the goal's coverage decides
// the step like any other: an all-applications MFA policy that delivers it
// completes it and is named, and where nothing delivers it the step writes Jon's
// policy for the application. There is no application card and no step to
// identify the application.
test('Inforcer uses the ordinary scoped goal and exact application identity, never generic acknowledgement, and No is a meaningful not-applicable row', () => {
  // Used and not delivered: the step writes Jon's policy for the exact application, whether or not a sign-in was seen.
  {
   const f = fixtureWithUse()
   const before = runFixture(f).steps
   const step = before.find(s => s.id === 's-goal-inforcer-mfa')!
   assert.ok(step)
   assert.equal(step.state.satisfied, false, 'the premise: nothing delivers it yet')
   assert.equal(step.manualReview, undefined)
   assert.equal(step.configurationFindings?.some(f => f.key === 'inforcerApplication') ?? false, false, 'an application card')
   assert.equal(step.blockers.some(b => b.label === 'inforcer-application'), false, 'a hold on identifying the application')
   assert.equal(before.some(s => s.id.startsWith('s-review-baseline-iac-app-inforcer')), false)
   assert.ok(step.action.resolution?.policies.length)
   assert.ok(JSON.stringify(step.action).includes(APP), 'the exact application')
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

test('an all-applications MFA policy that delivers Inforcer completes it, and is the policy named', () => {
 let completed = 0
 for (const name of ['small', 'mid', 'large'] as const) {
  const f = fixture(name)
  f.mapping.workflowAnswers = { ...(f.mapping.workflowAnswers ?? {}), inforcer: 'yes' }
  f.mapping.facetOverrides.inforcer = { on: true, reason: 'confirmed in use' }
  f.mapping.workflowConfirmedAt = f.snapshot.asOf
  const result = runFixture(f)
  const step = result.steps.find(s => s.id === 's-goal-inforcer-mfa')!
  assert.equal(step.configurationFindings?.some(f => f.key === 'inforcerApplication') ?? false, false, `${name}: an application card`)
  const all = (step.satisfiedBy?.policies ?? []).length > 0
  assert.equal(step.status === 'done', step.state.satisfied, `${name}: done exactly when a policy delivers it`)
  if (step.state.satisfied) {
   completed++
   assert.ok(all, `${name}: the Satisfied card names the policy that delivers it`)
  }
 }
 assert.ok(completed > 0, 'the premise: a fixture whose all-users MFA policy delivers Inforcer')
})

test('no step asks the reader to identify the Inforcer application or sign in to it', () => {
 const step = runFixture(fixture('demo')).steps.find(s => s.id === 's-goal-inforcer-mfa')!
 assert.doesNotMatch(policyInspectionLines(step).join('\n'), /Find Inforcer|representative|Enterprise applications/)
})

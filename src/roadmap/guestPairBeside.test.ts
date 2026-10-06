// Require MFA for Guests builds Jon's two guest policies beside the tenant's own
// guest MFA policy, as the single-policy steps do (option B), so the step names it
// and Retire Replaced Policies retires it once both are On (live check, owner
// 2026-10-05: "Core - Allow - MFA for Guests" On read no beside line and never
// reached Retire).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { curatedFixture } from './fixtures/index.ts'
import { runFixture, withFoundationSettled } from './fixtures/run.ts'
import { besideLineOf } from '../ui/surfaces/policyTasks.ts'

test('the guest pair names the tenant\'s own guest policy beside it, and Retire lists it', () => {
  const r = runFixture(withFoundationSettled(curatedFixture('demo')))
  const guests = r.steps.find((s) => s.goalId === 'guests-mfa')!
  const beside = guests.action.besidePolicies ?? []
  assert.deepEqual(beside.map((p) => p.name), ['Core - Grant - Guests MFA'])
  for (const m of guests.action.pairMembers ?? []) assert.ok(!beside.some((p) => p.policyId === m.policyId), `${m.name} is the step's own, never beside it`)
  assert.match(String(besideLineOf(guests)), /^Your Core - Grant - Guests MFA \(On\) keeps doing this job until this policy is On\./)
  assert.ok((r.schedule.cleanup?.retiringPolicyIds ?? []).includes(beside[0]!.policyId), 'Retire Replaced Policies lists it')
})

test('a tenant with no guest policy of its own gets no beside line on the pair', () => {
  const r = runFixture(curatedFixture('demo'))
  const guests = r.steps.find((s) => s.goalId === 'guests-mfa')!
  for (const p of guests.action.besidePolicies ?? []) assert.notEqual(p.state, 'disabled', `${p.name}: an Off policy is never beside`)
})

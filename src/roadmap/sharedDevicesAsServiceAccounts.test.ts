// Shared-device accounts under Jon's baseline (owner, 2026-09-24, Phase 2a).
// Jon publishes no policy for a meeting-room or shared-device account, and his
// sources name no group of his as a shared-device carve-out, so the plan's own
// "Give Shared Devices Their Own Policy" went. The accounts join the
// service-accounts group: Jon's Block Service Accounts keeps them to the
// trusted network, and 2.2's answer leaves that group out of his policies that
// ask a person for something, with his version shown beside it.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fixture } from './fixtures/index.ts'
import type { Fixture } from './fixtures/index.ts'
import { runFixture } from './fixtures/run.ts'
import { PREREQ_STEP_ID } from './stepIds.ts'
import { answerKey } from './answers.ts'
import { DIRECTION_LOCATIONS_STORAGE } from './directionAnswers.ts'

const GROUP = '0000aaaa-0000-4000-a000-0000000005c7'
type Body = { conditions?: { users?: { excludeGroups?: string[] } } }
const excluded = (b: unknown): string[] => ((b as Body | undefined)?.conditions?.users?.excludeGroups ?? []).map((g) => g.toLowerCase())

/** demo with one shared-device account saved on 2.2, and the office answer given. */
function withSharedDevice(office: 'office' | 'remote', group: string | null): { f: Fixture; shared: string } {
  const f = structuredClone(fixture('demo'))
  const shared = f.snapshot.users.find((u) => u.userType !== 'guest' && u.accountEnabled !== false && !f.mapping.breakGlassUserIds.includes(u.id) && !f.mapping.serviceAccountUserIds.includes(u.id))!.id
  f.mapping.sharedDeviceUserIds = [shared]
  f.mapping.serviceAccountsGroupId = group
  f.mapping.questionAnswers = { ...(f.mapping.questionAnswers ?? {}), [answerKey(DIRECTION_LOCATIONS_STORAGE, 'officeNetwork')]: office }
  return { f, shared }
}

test('shared-device accounts join the service-accounts group; no step of IAMAI’s own stands for them', () => {
  const { f, shared } = withSharedDevice('office', null)
  const r = runFixture(f)
  assert.equal(r.steps.find((s) => s.id === 's-shared-devices'), undefined, 'Give Shared Devices Their Own Policy is not on the plan')
  const group = r.steps.find((s) => s.id === PREREQ_STEP_ID.serviceAccountsGroup)
  assert.ok(group, 'the service-accounts group step is')
  assert.equal(group.impactCount, f.mapping.serviceAccountUserIds.length + 1, 'and it counts the shared-device account with the service accounts')
  const restrict = r.steps.find((s) => s.goalId === 'service-accounts-trusted-network')
  assert.ok(restrict, 'Jon’s Block Service Accounts is on the plan')
  assert.ok(restrict.population.ids.includes(shared), 'and reaches the shared-device account')
})

test('Jon’s policies that ask a person leave the service-accounts group out, beside his version; blocks keep it', () => {
  const { f } = withSharedDevice('office', GROUP)
  const r = runFixture(f)
  const mfa = r.steps.find((s) => s.id === 's-goal-mfa-all-users')!
  const op = (mfa.action.resolution?.policies ?? [])[0]
  assert.ok(op, 'the premise: Require MFA for Everyone has an operation')
  assert.ok(excluded(op.body).concat(excluded(op.target)).includes(GROUP.toLowerCase()), JSON.stringify(op.body))
  assert.ok(op.baseline, 'Jon’s version travels with the change')
  assert.equal(excluded(op.baseline).includes(GROUP.toLowerCase()), false, 'and it leaves the group in')
  const block = r.steps.find((s) => s.id === 's-goal-block-legacy-auth')!
  for (const o of block.action.resolution?.policies ?? []) assert.equal(excluded(o.body).includes(GROUP.toLowerCase()), false, 'a block is left as Jon wrote it')
})

test('with no group yet the people policies wait on the step that makes it; with everyone remote nothing is left out', () => {
  {
    const { f } = withSharedDevice('office', null)
    const mfa = runFixture(f).steps.find((s) => s.id === 's-goal-mfa-all-users')!
    assert.ok((mfa.action.missing ?? []).some((m) => m.token === '{serviceAccountsGroup}' && m.stepId === PREREQ_STEP_ID.serviceAccountsGroup), JSON.stringify(mfa.action.missing))
  }
  {
    const { f } = withSharedDevice('remote', GROUP)
    const mfa = runFixture(f).steps.find((s) => s.id === 's-goal-mfa-all-users')!
    for (const o of mfa.action.resolution?.policies ?? []) assert.equal(excluded(o.body).includes(GROUP.toLowerCase()), false, 'nothing keeps them to an office, so they stay in')
    assert.equal((mfa.action.missing ?? []).some((m) => m.token === '{serviceAccountsGroup}'), false)
  }
})

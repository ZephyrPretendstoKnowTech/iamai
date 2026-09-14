// C01 (preview corrections): which tenant policy a goal's step corrects is decided
// by what the policy is — who it is assigned to and which kind of control it
// carries — never by the order the scan listed the policies in or by their names.
//
// The tenant holds three overlapping policies: one assigned to a directory role
// that requires the built-in phishing-resistant strength, one for All users with
// guests excluded that requires MFA, and one assigned to the same role that sets
// only a sign-in frequency. The expected answer is written down independently of
// the engine: the all-users goal corrects the All users policy, the admins goal
// the role policy with the grant, the admin-session goal the session policy.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fixture } from './fixtures/index.ts'
import { runFixture } from './fixtures/run.ts'
import type { FixtureRun } from './fixtures/run.ts'
import { actionableExclusionsGroupId, directoryEvidenceFromGroups } from '../mapping/safetyChoice.ts'

const GLOBAL_ADMIN = '62e90394-69f5-4237-9190-012177145e10'
const ADMIN = 'c0100000-0000-4000-8000-000000000001'
const EVERYONE = 'c0100000-0000-4000-8000-000000000002'
const SESSION = 'c0100000-0000-4000-8000-000000000003'
const EXPECTED: Record<string, string> = { 'mfa-all-users': EVERYONE, 'admins-phishing-resistant': ADMIN, 'admin-session': SESSION }
const ALL_GUEST_KINDS = 'internalGuest,b2bCollaborationGuest,b2bCollaborationMember,b2bDirectConnectUser,otherExternalUser,serviceProvider'

type Names = { admin: string; everyone: string; session: string }
const NAMES: Names = { admin: 'Require strong MFA - admins', everyone: 'Require MFA - staff', session: 'Admin sign-in frequency' }
// The admin policy carries the name an all-users policy would have, and the other way round.
const SWAPPED: Names = { admin: 'Require MFA - staff', everyone: 'Require strong MFA - admins', session: 'Policy 1' }

function run(opts: { reversed: boolean; names: Names; carveOut: boolean }): FixtureRun {
  const f = fixture('demo-week2')
  const group = actionableExclusionsGroupId({ snapshot: f.snapshot, mapping: f.mapping, groups: f.groups, directory: directoryEvidenceFromGroups(f.groups, 'complete') })
  assert.ok(group, 'the demo tenant has a chosen exclusions group')
  const excludeGroups = opts.carveOut ? [group] : []
  const apps = { includeApplications: ['All'] }
  const rows: Record<string, unknown>[] = [
    { id: ADMIN, displayName: opts.names.admin, state: 'enabled', conditions: { users: { includeRoles: [GLOBAL_ADMIN], excludeGroups }, applications: apps, clientAppTypes: ['all'] }, grantControls: { operator: 'OR', builtInControls: [], authenticationStrength: { id: '00000000-0000-0000-0000-000000000004' } } },
    { id: EVERYONE, displayName: opts.names.everyone, state: 'enabled', conditions: { users: { includeUsers: ['All'], excludeGroups, excludeGuestsOrExternalUsers: { guestOrExternalUserTypes: ALL_GUEST_KINDS, externalTenants: { membershipKind: 'all' } } }, applications: apps, clientAppTypes: ['all'] }, grantControls: { operator: 'OR', builtInControls: ['mfa'] } },
    { id: SESSION, displayName: opts.names.session, state: 'enabled', conditions: { users: { includeRoles: [GLOBAL_ADMIN], excludeGroups }, applications: apps, clientAppTypes: ['all'] }, grantControls: null, sessionControls: { signInFrequency: { isEnabled: true, value: 24, type: 'hours', frequencyInterval: 'timeBased' } } },
  ]
  const ca = f.snapshot.config.caPolicies ?? { status: 'ok' as const, reason: null, rows: [] }
  const snapshot = { ...f.snapshot, config: { ...f.snapshot.config, caPolicies: { ...ca, rows: opts.reversed ? [...rows].reverse() : rows } } }
  return runFixture({ ...f, snapshot }, { snapshot } as never)
}

const VARIANTS = [
  { label: 'as listed', reversed: false, names: NAMES },
  { label: 'reversed', reversed: true, names: NAMES },
  { label: 'names swapped, reversed', reversed: true, names: SWAPPED },
]

for (const carveOut of [false, true]) {
  for (const v of VARIANTS) {
    test(`C01 ${v.label}, exclusions group ${carveOut ? 'carved out' : 'missing'}: each goal corrects and tracks its own policy`, () => {
      const r = run({ reversed: v.reversed, names: v.names, carveOut })
      for (const [goalId, expected] of Object.entries(EXPECTED)) {
        const result = r.coverage.results.find((x) => x.goal.id === goalId)
        assert.ok(result, goalId)
        const own = result.candidates.filter((c) => c.ownScope).map((c) => c.policyId)
        assert.ok(own.includes(expected), `${goalId}: its own policy is its own`)
        for (const other of Object.values(EXPECTED).filter((id) => id !== expected)) assert.equal(own.includes(other), false, `${goalId}: another goal's policy is not its own`)

        const step = r.steps.find((x) => x.goalId === goalId && x.kind !== 'verify')
        assert.ok(step, `${goalId} is on the plan`)
        for (const op of step.action.resolution?.policies ?? []) {
          if (op.mode === 'update') assert.equal(op.policyId, expected, `${goalId}: the update targets its own policy`)
        }
        if (step.tracking?.policyId) assert.equal(step.tracking.policyId, expected, `${goalId}: tracking follows its own policy`)
      }
    })
  }
}

test('C01/C02: correcting a policy that already meets the floor writes no grant from another policy, and a session raise is a session change', () => {
  for (const reversed of [false, true]) {
    const r = run({ reversed, names: NAMES, carveOut: false })
    // The admin policy's only shortfall is the exclusions group. The session-only
    // policy "requires nothing", but that is its finding, not the admin policy's:
    // the built-in phishing-resistant strength stays as the tenant has it.
    const admins = r.steps.find((x) => x.goalId === 'admins-phishing-resistant' && x.kind === 'adjust')
    assert.ok(admins, 'the admins goal corrects its policy')
    const update = (admins.action.resolution?.policies ?? []).find((o) => o.mode === 'update')
    assert.equal(update?.policyId, ADMIN)
    assert.equal(Object.hasOwn(update?.body ?? {}, 'grantControls'), false, 'no grant is written onto the admin policy')
    assert.deepEqual((admins.action.changes ?? []).map((c) => c.field), ['Users'])

    const session = r.steps.find((x) => x.goalId === 'admin-session' && x.kind === 'adjust')
    assert.ok(session, 'the admin-session goal corrects its policy')
    assert.equal((session.action.changes ?? []).some((c) => c.field === 'Grant controls'), false, 'a shorter sign-in frequency is not listed as a grant change')
    assert.ok((session.action.changes ?? []).some((c) => c.field === 'Session controls'))
  }
})

test('C01: where the only MFA policy is assigned to an admin role, the all-users step neither rewrites nor tracks it', () => {
  const f = fixture('demo-week2')
  const ca = f.snapshot.config.caPolicies ?? { status: 'ok' as const, reason: null, rows: [] }
  const rows = [{ id: ADMIN, displayName: 'Policy 2', state: 'enabled', conditions: { users: { includeRoles: [GLOBAL_ADMIN], excludeGroups: [] }, applications: { includeApplications: ['All'] }, clientAppTypes: ['all'] }, grantControls: { operator: 'OR', builtInControls: ['mfa'] } }]
  const snapshot = { ...f.snapshot, config: { ...f.snapshot.config, caPolicies: { ...ca, rows } } }
  const r = runFixture({ ...f, snapshot }, { snapshot } as never)

  const everyone = r.steps.find((x) => x.goalId === 'mfa-all-users' && x.kind !== 'verify')
  assert.ok(everyone, 'the all-users goal is on the plan')
  for (const op of everyone.action.resolution?.policies ?? []) assert.notEqual(op.mode === 'update' ? op.policyId : null, ADMIN, 'the admin policy is not rewritten to All users')
  assert.notEqual(everyone.tracking?.policyId ?? null, ADMIN, 'nor tracked as the all-users policy')

  // The admin policy is still the admins goal's to correct.
  const admins = r.steps.find((x) => x.goalId === 'admins-phishing-resistant' && x.kind === 'adjust')
  assert.ok(admins, 'the admins goal corrects its policy')
  assert.equal((admins.action.resolution?.policies ?? []).find((o) => o.mode === 'update')?.policyId, ADMIN)
})

test('C01: an all-users policy is the one corrected when the admin policy is listed first and both lack the exclusions group', () => {
  const r = run({ reversed: false, names: NAMES, carveOut: false })
  const step = r.steps.find((x) => x.goalId === 'mfa-all-users' && x.kind === 'adjust')
  assert.ok(step, 'the all-users goal is corrected, not created beside the tenant policy')
  const update = (step.action.resolution?.policies ?? []).find((o) => o.mode === 'update')
  assert.equal(update?.policyId, EVERYONE)
  // The admin policy's assignment and grant are not what this step writes.
  assert.equal((step.action.changes ?? []).some((c) => c.field === 'Grant controls'), false, 'an MFA-for-everyone correction of an MFA policy leaves its grant alone')
})

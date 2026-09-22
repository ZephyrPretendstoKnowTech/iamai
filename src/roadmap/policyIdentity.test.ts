import { readyEvidence } from './fixtures/readyEvidence.ts'
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
import { curatedFixture, fixture, noExclusionsAnswer } from './fixtures/index.ts'
import { runFixture, withFoundationSettled } from './fixtures/run.ts'
import type { FixtureRun } from './fixtures/run.ts'
import { actionableExclusionsGroupId, directoryEvidenceFromGroups } from '../mapping/safetyChoice.ts'
import { nextSafeAction } from './nextSafeAction.ts'
import { personReadiness } from '../scoring/phishingResistant.ts'
import { stepBodyOf } from '../ui/surfaces/stepBody.ts'
import { stepExportView } from '../ui/surfaces/stepExport.ts'
import type { StepVarContext } from '../ui/surfaces/stepVars.ts'

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

test('C01/C02: a report-only admin policy that already asks for the built-in phishing-resistant strength keeps it', () => {
  const f = fixture('demo-week2')
  const group = actionableExclusionsGroupId({ snapshot: f.snapshot, mapping: f.mapping, groups: f.groups, directory: directoryEvidenceFromGroups(f.groups, 'complete') })
  const ca = f.snapshot.config.caPolicies ?? { status: 'ok' as const, reason: null, rows: [] }
  const apps = { includeApplications: ['All'] }
  const rows = [
    { id: ADMIN, displayName: 'Policy A', state: 'enabledForReportingButNotEnforced', conditions: { users: { includeRoles: [GLOBAL_ADMIN], excludeGroups: [group] }, applications: apps, clientAppTypes: ['all'] }, grantControls: { operator: 'OR', builtInControls: [], authenticationStrength: { id: '00000000-0000-0000-0000-000000000004' } } },
    // A session-only policy for the same role: its "requires nothing" is its own finding.
    { id: SESSION, displayName: 'Policy C', state: 'enabled', conditions: { users: { includeRoles: [GLOBAL_ADMIN], excludeGroups: [group] }, applications: apps, clientAppTypes: ['all'] }, grantControls: null, sessionControls: { signInFrequency: { isEnabled: true, value: 24, type: 'hours', frequencyInterval: 'timeBased' } } },
  ]
  for (const order of [rows, [...rows].reverse()]) {
    const snapshot = { ...f.snapshot, config: { ...f.snapshot.config, caPolicies: { ...ca, rows: order } } }
    const r = runFixture({ ...f, snapshot }, { snapshot } as never)
    const admins = r.steps.find((x) => x.goalId === 'admins-phishing-resistant' && x.kind !== 'verify')
    assert.ok(admins, 'the admins goal is on the plan')
    for (const op of admins.action.resolution?.policies ?? []) {
      assert.equal(op.mode === 'update' ? op.policyId : ADMIN, ADMIN, 'it is the admin policy the step follows')
      assert.equal(Object.hasOwn(op.body, 'grantControls'), false, 'the built-in strength is not swapped for the baseline’s')
    }
    assert.equal((admins.action.changes ?? []).some((c) => c.field === 'Grant controls'), false)
  }
})

test('C01: a guests step does not claim the all-users policy that does not deliver it; the all-users step does', () => {
  const f = noExclusionsAnswer(fixture('small'))
  const r = runFixture(f)
  const everyoneId = r.coverage.results.find((x) => x.goal.id === 'mfa-all-users')?.candidates.find((c) => c.ownScope)?.policyId
  assert.ok(everyoneId, 'the premise: the tenant has an all-users MFA policy')
  const guests = r.coverage.results.find((x) => x.goal.id === 'guests-mfa')
  assert.ok(guests && guests.satisfaction === null, 'the premise: nothing delivers the guests goal here')
  const guestsStep = r.steps.find((x) => x.goalId === 'guests-mfa' && x.kind !== 'verify')
  assert.ok(guestsStep, 'the guests goal is on the plan')
  assert.notEqual(guestsStep.tracking?.policyId ?? null, everyoneId, 'the guests step does not name the all-users policy as its own')
  const everyoneStep = r.steps.find((x) => x.goalId === 'mfa-all-users' && x.kind !== 'verify')
  assert.equal(everyoneStep?.tracking?.policyId, everyoneId, 'the all-users step still finds it')
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

// Review R1-F2: an admins policy assigned to a group (built-in phishing-resistant
// strength) and a staff policy assigned to a group (MFA) are both "assigned to
// groups". Correcting the first listed for the all-users goal rewrote the admins
// policy to All users. Expected, independent of the engine: neither is taken by
// scan order or name. A group policy asking more than MFA of every sign-in is not
// the all-users goal's to widen, alone (BLOCKED S5 23:30) or beside a staff policy;
// two that ask the same and nothing tells apart hold the step and hand over
// nothing; beside an All users policy that policy is the one.
const STRONG = { operator: 'OR', builtInControls: [], authenticationStrength: { id: '00000000-0000-0000-0000-000000000004' } }
const MFA = { operator: 'OR', builtInControls: ['mfa'] }
const MFA_AND_DEVICE = { operator: 'AND', builtInControls: ['mfa', 'compliantDevice'] }
const READY = personReadiness({ methods: [{ kind: 'passkey' }], registered: null, signIns: { read: true, proofs: [{ cls: 'passkey', os: 'Windows', at: '2026-01-01T00:00:00.000Z', method: 'Passkey (device-bound)' }], platforms: [{ os: 'Windows', at: '2026-01-01T00:00:00.000Z' }] }, history: null } as never)

type GroupShape = {
  reversed: boolean
  names: [string, string]
  /** The second policy: assigned to a staff group, to All users, or not in the tenant. */
  staff: 'group' | 'all' | 'none'
  /** The first policy: its grant and its assignment, or not in the tenant. */
  admins?: { grant: Record<string, unknown>; users: 'group' | 'group+user' | 'group+role' } | null
  /** Every person Ready, so nothing but the target decides whether the step is handed over. */
  ready?: boolean
  /** The second policy's target resources, where not All resources with nothing excluded. */
  staffApps?: Record<string, unknown>
}
function groupRun(opts: GroupShape): FixtureRun & { ctx: StepVarContext } {
  // The curated week-two demo (its source groups answered), as R1 reproduced it:
  // the tenant's other policies stay, the three this shape stands in for go.
  const base = withFoundationSettled(curatedFixture('demo-week2'))
  const f = { ...base, groups: new Map(base.groups) }
  const exclusions = actionableExclusionsGroupId({ snapshot: f.snapshot, mapping: f.mapping, groups: f.groups, directory: directoryEvidenceFromGroups(f.groups, 'complete') })
  assert.ok(exclusions, 'the demo tenant has a chosen exclusions group')
  const staffGroup = [...f.groups.keys()].find((id) => id !== exclusions)
  assert.ok(staffGroup, 'the demo tenant has another group')
  const adminsGroup = 'bbbbbbbb-0000-4000-8000-00000000000a'
  const copy = structuredClone(f.groups.get(staffGroup)) as unknown as { memberIds?: string[] }
  const adminMember = (copy.memberIds ?? [])[0]
  assert.ok(adminMember, 'the demo group has a member')
  f.groups.set(adminsGroup, { ...copy, groupId: adminsGroup, memberIds: [adminMember], memberCount: 1 } as never)
  const apps = { includeApplications: ['All'] }
  const admins = opts.admins === undefined ? { grant: STRONG, users: 'group' as const } : opts.admins
  const adminUsers = { includeGroups: [adminsGroup], excludeGroups: [exclusions], ...(admins?.users === 'group+user' ? { includeUsers: [adminMember] } : admins?.users === 'group+role' ? { includeRoles: [GLOBAL_ADMIN] } : {}) }
  const staffUsers = opts.staff === 'all' ? { includeUsers: ['All'], excludeGroups: [exclusions] } : { includeGroups: [staffGroup], excludeGroups: [exclusions] }
  const rows: Record<string, unknown>[] = [
    ...(admins ? [{ id: ADMIN, displayName: opts.names[0], state: 'enabled', conditions: { users: adminUsers, applications: apps, clientAppTypes: ['all'] }, grantControls: admins.grant }] : []),
    ...(opts.staff !== 'none' ? [{ id: EVERYONE, displayName: opts.names[1], state: 'enabled', conditions: { users: staffUsers, applications: opts.staffApps ?? apps, clientAppTypes: ['all'] }, grantControls: MFA }] : []),
  ]
  const ca = f.snapshot.config.caPolicies ?? { status: 'ok' as const, reason: null, rows: [] }
  const keep = (ca.rows as Record<string, unknown>[]).filter((p) => !/MFA for all users|Admins phishing-resistant|Admin sign-in|session/i.test(String(p.displayName)))
  // Reversed, the shape's policies are listed after the tenant's others as well.
  const snapshot = { ...f.snapshot, config: { ...f.snapshot.config, caPolicies: { ...ca, rows: opts.reversed ? [...keep, ...[...rows].reverse()] : [...rows, ...keep] } } }
  if (opts.ready) readyEvidence(f, snapshot)
  const viability = opts.ready ? runFixture({ ...f, snapshot }, { snapshot } as never).viability.map((v) => ({ ...v, readiness: READY })) : undefined
  const r = runFixture({ ...f, snapshot }, { snapshot, ...(viability ? { viability } : {}) } as never)
  const ctx = { snapshot, mapping: f.mapping, nameOf: (id: string) => r.input.names!.label(id), signature: 'IT', operatorId: f.operatorId, now: snapshot.asOf, groups: f.groups, reportOnlyAt: null } as unknown as StepVarContext
  return Object.assign(r, { ctx })
}

const GROUP_NAMES: [string, string][] = [
  ['Policy 1', 'Policy 2'],
  ['MFA for Internal Users', 'MFA for Admins'],
]

const allUsersStep = (r: FixtureRun) => {
  const step = r.steps.find((x) => x.goalId === 'mfa-all-users' && x.kind !== 'verify')
  assert.ok(step, 'the all-users goal is on the plan')
  return step
}
const ownOf = (r: FixtureRun) => (r.coverage.results.find((x) => x.goal.id === 'mfa-all-users')?.candidates ?? []).filter((c) => c.ownScope).map((c) => c.policyId).sort()
/** Every text the Implementation region and the export hand over for a step. */
function handedOver(r: FixtureRun & { ctx: StepVarContext }, step: ReturnType<typeof allUsersStep>): string {
  const body = stepBodyOf(step, r.ctx)
  return [...body.artifacts.filter((a) => !a.unavailable).map((a) => a.text()), ...stepExportView(step, r.ctx).whatToDo].join('\n')
}

test('C01 R1-F2: two group-assigned MFA policies nothing tells apart hold the all-users step, whatever the order or names', () => {
  for (const reversed of [false, true]) {
    for (const names of GROUP_NAMES) {
      const r = groupRun({ reversed, names, staff: 'group', admins: { grant: MFA, users: 'group' } })
      const step = allUsersStep(r)
      assert.deepEqual(ownOf(r), [ADMIN, EVERYONE].sort(), 'the premise: both group policies are candidates of the all-users goal')
      assert.equal(step.kind, 'adjust', 'the premise: the step corrects a tenant policy rather than creating one, so the choice is made')
      const ops = step.action.resolution?.policies ?? []
      assert.deepEqual(ops.filter((o) => o.mode === 'update').map((o) => o.policyId), [], `no update of either policy (reversed ${reversed}, ${names.join('/')})`)
      assert.equal(ops.some((o) => o.mode === 'create'), false, 'and no duplicate beside them')
      assert.equal(step.action.ambiguousTarget, true, 'the step says it cannot tell which is the goal’s own')
      assert.equal(nextSafeAction(step).executable, false, 'nothing is handed over')
      assert.equal(step.tracking?.policyId ?? null, null, 'neither is tracked as the all-users policy')
    }
  }
})

test('C01 R2-N1: the held step’s Implementation region plans no create or correction the hold rules out', () => {
  for (const reversed of [false, true]) {
    const r = groupRun({ reversed, names: GROUP_NAMES[0], staff: 'group', admins: { grant: MFA, users: 'group' }, ready: true })
    const step = allUsersStep(r)
    assert.equal(step.action.ambiguousTarget, true, 'the premise: the step is held on the tie')
    const body = stepBodyOf(step, r.ctx)
    assert.equal(body.previewNote, null, 'no preview blames prerequisites or values for the hold')
    const text = handedOver(r, step)
    assert.doesNotMatch(text, /New policy|create it|Report-only and create/i, 'no create procedure beside the tied policies')
    for (const id of [ADMIN, EVERYONE]) assert.equal(text.includes(id), false, 'neither tied policy is named as a target')
  }
})

test('C01: a group-assigned policy asking more than MFA is not the all-users goal’s own; beside a staff group MFA policy the staff policy is corrected', () => {
  for (const reversed of [false, true]) {
    for (const names of GROUP_NAMES) {
      const r = groupRun({ reversed, names, staff: 'group' })
      const step = allUsersStep(r)
      assert.deepEqual(ownOf(r), [EVERYONE], `only the staff policy is the goal’s own (reversed ${reversed}, ${names.join('/')})`)
      assert.notEqual(step.action.ambiguousTarget, true)
      const updates = (step.action.resolution?.policies ?? []).filter((o) => o.mode === 'update')
      assert.deepEqual(updates.map((o) => o.policyId), [EVERYONE], 'the update targets the staff policy')
      const users = (updates[0].body.conditions as { users: Record<string, unknown> }).users
      assert.deepEqual(users.includeUsers, ['All'], 'the staff policy is widened to All users')
      assert.deepEqual(users.includeGroups, [], 'its group assignment is replaced')
      assert.equal(Object.hasOwn(updates[0].body, 'grantControls'), false, 'its MFA grant stays as it is')
      assert.equal(step.tracking?.policyId, EVERYONE, 'tracking follows the staff policy')
    }
  }
})

test('C01: a lone group-assigned policy that is not the all-users goal’s own is never rewritten to All users; the step creates the goal’s own report-only policy', () => {
  const shapes = [
    { label: 'phishing-resistant strength, group', grant: STRONG, users: 'group' as const },
    { label: 'phishing-resistant strength, group and a user', grant: STRONG, users: 'group+user' as const },
    { label: 'MFA and a compliant device, group', grant: MFA_AND_DEVICE, users: 'group' as const },
    { label: 'MFA, group and a directory role', grant: MFA, users: 'group+role' as const },
  ]
  for (const shape of shapes) {
    for (const reversed of [false, true]) {
      for (const names of GROUP_NAMES) {
        const label = `${shape.label} (reversed ${reversed}, ${names[0]})`
        const r = groupRun({ reversed, names, staff: 'none', admins: { grant: shape.grant, users: shape.users } })
        const step = allUsersStep(r)
        assert.equal(ownOf(r).includes(ADMIN), false, `${label}: not the goal’s own`)
        assert.notEqual(step.action.ambiguousTarget, true, `${label}: one policy is no tie`)
        const ops = step.action.resolution?.policies ?? []
        assert.deepEqual(ops.filter((o) => o.mode === 'update').map((o) => o.policyId), [], `${label}: no update of the tenant policy`)
        const create = ops.find((o) => o.mode === 'create')
        assert.ok(create, `${label}: the goal’s own policy is created`)
        assert.equal(create.body.state, 'enabledForReportingButNotEnforced', `${label}: in report-only`)
        assert.deepEqual((create.body.conditions as { users: Record<string, unknown> }).users.includeUsers, ['All'], `${label}: for All users`)
        assert.notEqual(step.tracking?.policyId ?? null, ADMIN, `${label}: nor tracked as the all-users policy`)
      }
    }
  }
  // What is handed over, with nothing else holding the step: the create, and not a word of the admins policy.
  for (const reversed of [false, true]) {
    const r = groupRun({ reversed, names: GROUP_NAMES[1], staff: 'none', ready: true })
    const step = allUsersStep(r)
    assert.equal(nextSafeAction(step).kind, 'create-report-only', 'the next action is the report-only create')
    const text = handedOver(r, step)
    assert.equal(text.includes(ADMIN), false, 'no channel or export names the admins policy’s id')
    assert.equal(text.includes(`"${GROUP_NAMES[1][0]}"`), false, 'nor opens the admins policy by name')
    assert.match(text, /New policy/, 'the Entra procedure creates a policy')
  }
})

test('C01: a lone staff group MFA policy is still corrected to All users', () => {
  for (const reversed of [false, true]) {
    const r = groupRun({ reversed, names: GROUP_NAMES[0], staff: 'group', admins: null, ready: true })
    const step = allUsersStep(r)
    assert.deepEqual(ownOf(r), [EVERYONE])
    const ops = step.action.resolution?.policies ?? []
    assert.deepEqual(ops.map((o) => [o.mode, o.mode === 'update' ? o.policyId : null]), [['update', EVERYONE]], 'one update of the staff policy, no create')
    const users = (ops[0].body.conditions as { users: Record<string, unknown> }).users
    assert.deepEqual(users.includeUsers, ['All'])
    assert.equal(Object.hasOwn(ops[0].body, 'grantControls'), false, 'its MFA grant stays as it is')
    const next = nextSafeAction(step)
    assert.equal(next.kind, 'correct')
    assert.equal(next.executable, true, 'the legitimate correction is handed over')
    assert.ok(handedOver(r, step).includes(EVERYONE), 'the PowerShell names the staff policy it corrects')
  }
})

// Review R1-F3: the correction's Entra and AI Info said Microsoft Intune Enrollment
// is excluded, while its JSON and PowerShell target kept the tenant's resources.
// The pinned all-users policy excludes it, so the target is the baseline's: the
// update submits the exclusion, lists the change, and every channel carries it.
const INTUNE_ENROLLMENT = 'd4ebce55-015a-49b5-a083-c84d1797ae8c'

test('C02 R1-F3: correcting a policy without the baseline’s Intune Enrollment exclusion submits it, lists it and carries it in every channel', () => {
  for (const reversed of [false, true]) {
    const r = groupRun({ reversed, names: GROUP_NAMES[0], staff: 'group', admins: null, ready: true })
    const step = allUsersStep(r)
    const update = (step.action.resolution?.policies ?? []).find((o) => o.mode === 'update')
    assert.ok(update, 'the premise: the staff policy is corrected')
    const applications = (update.body.conditions as { applications?: Record<string, unknown> }).applications
    assert.deepEqual(applications?.includeApplications, ['All'])
    assert.deepEqual(applications?.excludeApplications, [INTUNE_ENROLLMENT], 'the update submits the baseline’s exclusion')
    assert.ok((step.action.changes ?? []).some((c) => c.field === 'Target resources'), 'and lists it as a change')
    const body = stepBodyOf(step, r.ctx)
    for (const [id, carries] of [['portal', /Intune Enrollment/], ['ai', /Intune Enrollment/], ['json', new RegExp(INTUNE_ENROLLMENT)], ['ps', new RegExp(INTUNE_ENROLLMENT)]] as const) {
      const artifact = body.artifacts.find((a) => a.id === id)
      assert.ok(artifact && !artifact.unavailable, `${id} is drawn`)
      assert.match(artifact.text(), carries, `${id} carries the exclusion`)
    }
    assert.match(stepExportView(step, r.ctx).whatToDo.join('\n'), /Target resources → Include: All resources\. Exclude: Microsoft Intune Enrollment/, 'the export names it too')
  }
  // Where the tenant's policy already excludes it, the resources are not a change.
  const r = groupRun({ reversed: false, names: GROUP_NAMES[0], staff: 'group', admins: null, staffApps: { includeApplications: ['All'], excludeApplications: [INTUNE_ENROLLMENT] } })
  const step = allUsersStep(r)
  assert.ok((step.action.resolution?.policies ?? []).some((o) => o.mode === 'update'), 'the premise: the staff policy is still corrected')
  assert.equal((step.action.changes ?? []).some((c) => c.field === 'Target resources'), false, 'no resources change is listed')
})

test('C01 R1-F2: beside an All users policy, a group-assigned admins policy is never the all-users step’s target', () => {
  for (const reversed of [false, true]) {
    for (const names of GROUP_NAMES) {
      const r = groupRun({ reversed, names, staff: 'all' })
      const step = r.steps.find((x) => x.goalId === 'mfa-all-users' && x.kind !== 'verify')
      assert.ok(step, 'the all-users goal is on the plan')
      assert.notEqual(step.action.ambiguousTarget, true, 'the All users policy tells them apart')
      for (const op of step.action.resolution?.policies ?? []) assert.notEqual(op.mode === 'update' ? op.policyId : null, ADMIN, `the admins policy is not rewritten (reversed ${reversed})`)
      if (step.tracking?.policyId) assert.equal(step.tracking.policyId, EVERYONE, 'tracking follows the All users policy')
    }
  }
})

// R3-1: a tenant IAMAI has planned before, carrying its own tag on a policy
// somebody switched off.
//
// `claimedPolicy` will not take a disabled policy as the step's live one —
// correctly, it enforces nothing — and the step fell through to a create.
// The create then suffixed its name around the step's OWN policy and told the
// operator to build "Core - Block - Device code flow (2)" beside "Core -
// Block - Device code flow". Two policies would then carry the tag for one
// step, which is a state the step can never finish from; and nothing on the
// card said the first policy was there at all.
test('a step whose own tagged policy is switched off proposes no duplicate, and says it is there', () => {
  const f = structuredClone(fixture('midflight'))
  const r = runFixture(f)
  const step = r.steps.find((s) => s.id === 's-goal-block-device-code')
  assert.ok(step, 'the premise: midflight plans the device-code step')
  assert.equal(step.tracking?.matchedBy, 'tag', 'the premise: the policy carries this plan own tag')
  assert.equal(step.tracking?.state, 'disabled', 'the premise: the tenant has it switched off')

  const ctx = { snapshot: f.snapshot, mapping: f.mapping, groups: f.groups, nameOf: (id: string) => id, signature: 'IT', operatorId: f.operatorId, now: f.snapshot.asOf, reportOnlyAt: null } as unknown as StepVarContext
  const body = stepBodyOf(step, ctx)
  const rendered = JSON.stringify(body)
  assert.doesNotMatch(rendered, /\(2\)/, 'the step still instructs a duplicate policy')
  assert.ok(rendered.includes(String(step.tracking?.policyName)), 'nothing on the step names the policy that is already there')

  const found = body.contract.found.find((item) => item.key === 'tagged-disabled')
  assert.ok(found, 'the card says nothing about a tenant this plan has already written to')
  assert.match(found.text, /switched off/)
})

// Review 3 queue 3: an all-users correction sends its users and applications sections
// whole, so a tenant exclusion the baseline does not carry is gone once it is saved.
// The request is the baseline's; what was missing was saying so. The export named only
// the new target ("Users → Include: All users …"). Each removed exclusion is now named
// beside the change, with what saving does to a policy that is On.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { curatedFixture } from './fixtures/index.ts'
import { runFixture } from './fixtures/run.ts'
import { actionableExclusionsGroupId, directoryEvidenceFromGroups } from '../mapping/safetyChoice.ts'
import { personReadiness } from '../scoring/phishingResistant.ts'
import { stepExportView } from '../ui/surfaces/stepExport.ts'

const READY = personReadiness({ methods: [{ kind: 'passkey' }], registered: null, signIns: { read: true, proofs: [{ cls: 'passkey', os: 'Windows', at: '2026-01-01T00:00:00.000Z', method: 'Passkey (device-bound)' }], platforms: [{ os: 'Windows', at: '2026-01-01T00:00:00.000Z' }] }, history: null } as never)
const B = 'c0100000-0000-4000-8000-000000000002'
const MFA = { operator: 'OR', builtInControls: ['mfa'] }
const EXO = '00000002-0000-0ff1-ce00-000000000000'
const INTUNE_ENROLLMENT = 'd4ebce55-015a-49b5-a083-c84d1797ae8c'
const GUESTS = { guestOrExternalUserTypes: 'b2bCollaborationGuest', externalTenants: { membershipKind: 'all' } }
const REMOVES = /^This change removes (.+) from the policy's exclusions\. If the policy is On, it applies to them as soon as you save\.$/
const UNTOUCHED = 'Change only the settings listed above; leave every other setting on this policy as it is.'

type Groups = { staffGroup: string; excl: string }
const pol = (users: Record<string, unknown>, applications: Record<string, unknown> = { includeApplications: ['All'] }) => ({
  id: B, displayName: 'Policy B', state: 'enabled', conditions: { users, applications, clientAppTypes: ['all'] }, grantControls: MFA,
})

function plan(rowOf: (g: Groups) => ReturnType<typeof pol>) {
  const base = curatedFixture('demo-week2')
  const f = { ...base, groups: new Map(base.groups) }
  const excl = actionableExclusionsGroupId({ snapshot: f.snapshot, mapping: f.mapping, groups: f.groups, directory: directoryEvidenceFromGroups(f.groups, 'complete') })!
  const staffGroup = [...f.groups.keys()].find((id) => id !== excl)!
  const ca = f.snapshot.config.caPolicies!
  const keep = (ca.rows as { displayName?: string }[]).filter((p) => !/MFA for all users|Admins phishing-resistant|Admin sign-in|session/i.test(String(p.displayName)))
  const snapshot = { ...f.snapshot, config: { ...f.snapshot.config, caPolicies: { ...ca, rows: [rowOf({ staffGroup, excl }), ...keep] } } }
  const scored = runFixture({ ...f, snapshot } as never, { snapshot } as never).viability
  const r = runFixture({ ...f, snapshot } as never, { snapshot, viability: scored.map((v) => ({ ...v, readiness: READY })) } as never)
  const step = r.steps.find((x) => x.goalId === 'mfa-all-users' && x.kind !== 'verify')!
  const nameOf = (id: string): string => r.input.names!.label(id)
  const ctx = { snapshot, mapping: f.mapping, nameOf, signature: 'IT', operatorId: f.operatorId, now: snapshot.asOf, groups: f.groups, reportOnlyAt: r.schedule.reportOnlyAt[step.id] ?? null } as never
  const ops = step.action.resolution?.policies ?? []
  assert.deepEqual(ops.map((o) => [o.mode, o.policyId]), [['update', B]], 'the staff policy is corrected')
  return { op: ops[0], lines: stepExportView(step, ctx).whatToDo, nameOf }
}

test('a correction that drops the tenant\'s guest or external user exclusion says so beside the change', () => {
  const { op, lines } = plan(({ staffGroup, excl }) => pol({ includeGroups: [staffGroup], excludeGroups: [excl], excludeGuestsOrExternalUsers: GUESTS }))
  const users = (op.body.conditions as { users: Record<string, unknown> }).users
  assert.equal(users.excludeGuestsOrExternalUsers, undefined, 'the request is the baseline\'s users section, unchanged')
  assert.deepEqual(op.removes, { guestsOrExternalUsers: true, ids: [] })
  const at = lines.findIndex((l) => REMOVES.test(l))
  assert.ok(at >= 0, lines.join('\n'))
  assert.equal(REMOVES.exec(lines[at])![1], 'guest or external users')
  assert.ok(at < lines.indexOf(UNTOUCHED), 'named above "Change only the settings listed above"')
})

test('a correction that replaces the tenant\'s excluded application names the application it removes', () => {
  const { op, lines, nameOf } = plan(({ staffGroup, excl }) => pol({ includeGroups: [staffGroup], excludeGroups: [excl] }, { includeApplications: ['All'], excludeApplications: [EXO] }))
  const apps = (op.body.conditions as { applications: { excludeApplications: string[] } }).applications
  assert.deepEqual(apps.excludeApplications, [INTUNE_ENROLLMENT], 'the request carries the baseline\'s exclusion')
  assert.deepEqual(op.removes, { guestsOrExternalUsers: false, ids: [EXO] })
  const line = lines.find((l) => REMOVES.test(l))
  assert.ok(line, lines.join('\n'))
  assert.equal(REMOVES.exec(line)![1], nameOf(EXO))
  assert.ok(!line.includes(EXO), 'named, not an id')
})

test('control: a correction that keeps every exclusion the tenant has removes nothing and says nothing', () => {
  const { op, lines } = plan(({ staffGroup, excl }) => pol({ includeGroups: [staffGroup], excludeGroups: [excl] }, { includeApplications: ['All'], excludeApplications: [INTUNE_ENROLLMENT] }))
  assert.equal(op.removes, undefined)
  assert.ok(!lines.some((l) => REMOVES.test(l)), lines.join('\n'))
  assert.ok(lines.includes(UNTOUCHED))
})

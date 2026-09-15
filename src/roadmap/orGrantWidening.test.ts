// Cycle 3 (review 2 R1): a group policy whose OR grant offers a way round the floor
// ("phishing-resistant OR compliant device", "MFA OR compliant device") is the
// all-users goal's own policy — under OR the person may use the weakest control, so
// it asks no more than the floor (C01) — and it falls short of the floor. With all of
// its current people excluded, coverage counted none of them, so the correction
// widened it to All users with its own grant kept: an executable update that put the
// compliant-device way round on everyone and never delivered MFA. The correction now
// writes the floor grant as well, lists it, and every channel carries it.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { curatedFixture } from './fixtures/index.ts'
import { runFixture } from './fixtures/run.ts'
import { actionableExclusionsGroupId, directoryEvidenceFromGroups } from '../mapping/safetyChoice.ts'
import { grantExceedsFloor } from '../coverage/strength.ts'
import { stepExportView } from '../ui/surfaces/stepExport.ts'
import { stepBodyOf } from '../ui/surfaces/stepBody.ts'
import { nextSafeAction } from './nextSafeAction.ts'
import { personReadiness } from '../scoring/phishingResistant.ts'

// Everyone ready, so the readiness gate does not withhold the instructions under test.
const READY = personReadiness({ methods: [{ kind: 'passkey' }], registered: null, signIns: { read: true, proofs: [{ cls: 'passkey', os: 'Windows', at: '2026-01-01T00:00:00.000Z', method: 'Passkey (device-bound)' }], platforms: [{ os: 'Windows', at: '2026-01-01T00:00:00.000Z' }] }, history: null } as never)
const A = 'c0100000-0000-4000-8000-000000000001'
const ADMINS = 'bbbbbbbb-0000-4000-8000-00000000000a'
const PHISHING_RESISTANT = '00000000-0000-0000-0000-000000000004'

type Grant = Record<string, unknown>

function plan(grant: Grant, group: 'admins' | 'staff', reversed: boolean) {
  const base = curatedFixture('demo-week2')
  const f = { ...base, groups: new Map(base.groups) }
  const excl = actionableExclusionsGroupId({ snapshot: f.snapshot, mapping: f.mapping, groups: f.groups, directory: directoryEvidenceFromGroups(f.groups, 'complete') })!
  const staff = [...f.groups.keys()].find((id) => id !== excl)!
  const src = structuredClone(f.groups.get(staff)) as { memberIds?: string[] }
  f.groups.set(ADMINS, { ...(src as object), groupId: ADMINS, memberIds: (src.memberIds ?? []).slice(0, 1), memberCount: 1 } as never)
  const ca = f.snapshot.config.caPolicies!
  const keep = (ca.rows as { displayName?: unknown }[]).filter((p) => !/MFA for all users|Admins phishing-resistant|Admin sign-in|session/i.test(String(p.displayName)))
  const row = { id: A, displayName: 'Policy A', state: 'enabled', conditions: { users: { includeGroups: [group === 'admins' ? ADMINS : staff], excludeGroups: [excl] }, applications: { includeApplications: ['All'] }, clientAppTypes: ['all'] }, grantControls: grant }
  const rows = reversed ? [...keep, row] : [row, ...keep]
  const snapshot = { ...f.snapshot, config: { ...f.snapshot.config, caPolicies: { ...ca, rows } } }
  const scored = runFixture({ ...f, snapshot }, { snapshot } as never).viability
  const r = runFixture({ ...f, snapshot }, { snapshot, viability: scored.map((v) => ({ ...v, readiness: READY })) } as never)
  const step = r.steps.find((x) => x.goalId === 'mfa-all-users' && x.kind !== 'verify')!
  const ctx = { snapshot, mapping: f.mapping, nameOf: (id: string) => r.input.names!.label(id), signature: 'IT', operatorId: f.operatorId, now: snapshot.asOf, groups: f.groups, reportOnlyAt: r.schedule.reportOnlyAt[step.id] ?? null } as never
  const ops = step.action.resolution?.policies ?? []
  return { step, ctx, ops }
}

const drawn = (step: Parameters<typeof stepBodyOf>[0], ctx: never): Record<string, string> =>
  Object.fromEntries(stepBodyOf(step, ctx).artifacts.filter((a) => !a.unavailable).map((a) => [a.id, a.text()]))

const WAYS_ROUND: [string, Grant][] = [
  ['phishing-resistant strength OR compliant device', { operator: 'OR', builtInControls: ['compliantDevice'], authenticationStrength: { id: PHISHING_RESISTANT } }],
  ['MFA OR compliant device', { operator: 'OR', builtInControls: ['mfa', 'compliantDevice'] }],
]

for (const [label, grant] of WAYS_ROUND) {
  for (const group of ['admins', 'staff'] as const) {
    for (const reversed of [false, true]) {
      test(`R1: an enabled ${group}-group policy granting ${label} (${reversed ? 'listed last' : 'listed first'}) is widened with the floor grant, not its own`, () => {
        const { step, ctx, ops } = plan(grant, group, reversed)
        assert.deepEqual(ops.map((o) => [o.mode, o.policyId]), [['update', A]])
        const body = ops[0].body as { grantControls?: { operator?: string; builtInControls?: string[]; authenticationStrength?: unknown }; conditions?: { users?: { includeUsers?: string[] } } }
        assert.deepEqual(body.conditions?.users?.includeUsers, ['All'])
        assert.ok(body.grantControls, 'the widening carries the goal grant')
        assert.ok(!(body.grantControls.builtInControls ?? []).includes('compliantDevice'), JSON.stringify(body.grantControls))
        assert.notDeepEqual(body.grantControls, grant)
        // The same grant the goal's own policy is created with where no policy is its own.
        const created = plan({ operator: 'AND', builtInControls: ['compliantDevice'], authenticationStrength: { id: PHISHING_RESISTANT } }, 'admins', reversed)
        const create = created.ops.find((o) => o.mode === 'create')
        assert.ok(create, JSON.stringify(created.ops.map((o) => o.mode)))
        assert.deepEqual(body.grantControls, create.body.grantControls)
        assert.ok((step.action.changes ?? []).some((c) => c.field === 'Grant controls'), JSON.stringify(step.action.changes))
        assert.equal(nextSafeAction(step).kind, 'correct')
        const art = drawn(step, ctx)
        assert.ok(art.ps, 'the PowerShell tab is drawn')
        const target = /-TargetPolicyJson '(.*?)' -PolicyId/.exec(art.ps)
        assert.ok(target, art.ps.slice(-300))
        const t = JSON.parse(target[1].replaceAll("''", "'")) as { grantControls: unknown }
        assert.deepEqual(t.grantControls, body.grantControls, 'the script submits the listed grant')
        assert.ok(art.ps.includes(`-PolicyId '${A}'`))
        // The script's CorrectConditions writes conditions only and CorrectGrant the grant only
        // (mfa-all-users CONTENT.md), so both calls have to be drawn: the target JSON carrying
        // the grant says nothing about whether the grant is ever written (review 3 queue 7).
        const calls = art.ps.split('\n').filter((l) => l.startsWith('Invoke-IAMAIStep -Mode '))
        const modes = calls.map((l) => /^Invoke-IAMAIStep -Mode '(\w+)'/.exec(l)?.[1])
        assert.deepEqual([...modes].sort(), ['CorrectConditions', 'CorrectGrant'], calls.join('\n'))
        for (const call of calls) assert.ok(call.endsWith(`-PolicyId '${A}'`), call)
        const grantCall = calls.find((l) => l.startsWith("Invoke-IAMAIStep -Mode 'CorrectGrant' "))!
        const grantTarget = JSON.parse(/-TargetPolicyJson '(.*?)' -PolicyId/.exec(grantCall)![1].replaceAll("''", "'")) as { grantControls: unknown }
        assert.deepEqual(grantTarget.grantControls, body.grantControls, 'the CorrectGrant call submits the listed grant')
        assert.doesNotMatch(art.json ?? '', /compliantDevice/)
        const exported = stepExportView(step, ctx).whatToDo.join('\n')
        assert.match(exported, /Under Grant, select Require multifactor authentication and clear any other control/)
        assert.match(exported, /Open the policy named Policy A/)
      })
    }
  }
}

test('R1 control: an enabled staff-group policy asking plain MFA is widened without a grant change', () => {
  for (const reversed of [false, true]) {
    const { step, ops } = plan({ operator: 'OR', builtInControls: ['mfa'] }, 'staff', reversed)
    assert.deepEqual(ops.map((o) => [o.mode, o.policyId]), [['update', A]])
    assert.ok(!('grantControls' in ops[0].body), JSON.stringify(Object.keys(ops[0].body)))
    assert.ok(!(step.action.changes ?? []).some((c) => c.field === 'Grant controls'))
  }
})

test('R1 control: an admins-group policy asking a phishing-resistant strength AND compliant device is still not the all-users goal\'s own (C01)', () => {
  for (const reversed of [false, true]) {
    const { ops } = plan({ operator: 'AND', builtInControls: ['compliantDevice'], authenticationStrength: { id: PHISHING_RESISTANT } }, 'admins', reversed)
    assert.ok(!ops.some((o) => o.mode === 'update'), JSON.stringify(ops.map((o) => [o.mode, o.policyId])))
    assert.ok(ops.some((o) => o.mode === 'create'))
  }
})

test('grantExceedsFloor under OR: more only where every control is stronger than the floor', () => {
  const g = (operator: 'AND' | 'OR', controls: string[], strength: 'phishingResistant' | 'mfa' | null = null) => ({ operator, controls: new Set(controls), strength }) as never
  assert.equal(grantExceedsFloor(g('OR', ['mfa', 'compliantDevice'], 'phishingResistant'), 'mfa'), false, 'strength OR compliant device: the device is a way round')
  assert.equal(grantExceedsFloor(g('OR', ['mfa', 'compliantDevice']), 'mfa'), false, 'MFA OR compliant device')
  assert.equal(grantExceedsFloor(g('OR', ['mfa', 'block'], 'phishingResistant'), 'mfa'), true, 'every alternative is stronger')
  assert.equal(grantExceedsFloor(g('AND', ['mfa', 'compliantDevice']), 'mfa'), true, 'another control under AND')
  assert.equal(grantExceedsFloor(g('OR', ['mfa'], 'phishingResistant'), 'mfa'), true, 'a single stronger control')
  assert.equal(grantExceedsFloor(g('OR', ['mfa']), 'mfa'), false, 'the floor itself')
})

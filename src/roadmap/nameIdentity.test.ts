// Policy identity is the name (owner, 2026-10-04; docs/STATUS.md). A goal step's
// own policy is the one carrying this plan's tag, else the plan's name for it.
// Controls alone never claim one. Read here on Require MFA for Everyone, the step
// every tenant meets, from a fresh tenant and Microsoft's gallery policy.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { asCuratedBaseline, fixture } from './fixtures/index.ts'
import type { Fixture } from './fixtures/index.ts'
import { pinnedPackage } from '../baseline/pinned.ts'
import { runFixture, withFoundationSettled } from './fixtures/run.ts'
import type { Step } from './types.ts'

const MFA = 's-goal-mfa-all-users'
const REPORT_ONLY = 'enabledForReportingButNotEnforced'
const GALLERY = 'c0500000-0000-4000-8000-000000000001'
const OTHER = 'c0500000-0000-4000-8000-000000000002'

type Row = Record<string, unknown>

function fresh(): Fixture {
  return withFoundationSettled({ ...fixture('small'), baseline: asCuratedBaseline(pinnedPackage() as never) })
}

function withPolicies(f: Fixture, rows: Row[]): Fixture {
  const g = structuredClone(f)
  const at = g.snapshot.asOf
  ;(g.snapshot.config.caPolicies!.rows as Row[]).push(...rows.map((p) => ({ createdDateTime: at, modifiedDateTime: at, ...p })))
  return g
}

/** Microsoft's gallery policy: MFA for all users, plain MFA, under Microsoft's name. */
const gallery = (state = 'enabled'): Row => ({ id: GALLERY, displayName: 'Require multifactor authentication for all users', state, conditions: { users: { includeUsers: ['All'] }, applications: { includeApplications: ['All'] }, clientAppTypes: ['all'] }, grantControls: { operator: 'OR', builtInControls: ['mfa'] } })

const stepOf = (f: Fixture): Step => runFixture(f).steps.find((s) => s.id === MFA)!
/** What Align Policy Names (8.2) suggests for the tenant's policy. */
const suggested = (f: Fixture): string[] => (runFixture(f, {}, null, f.snapshot.asOf).schedule.cleanup?.namingProposals ?? []).filter((n) => n.id === OTHER).map((n) => n.to)

/** The step's planned create, as a whole policy: what a tenant built from the step's procedure holds. */
function plannedBody(f: Fixture): Row {
  const op = stepOf(f).action.resolution?.policies[0]
  assert.ok(op && op.mode === 'create', 'the premise: on a fresh tenant the step creates')
  // A policy a person built from the procedure, with no IAMAI tag: identity by name alone.
  const body = structuredClone(op.body as Row)
  delete body.description
  return body
}

test('no policy carries the name: the step creates the baseline policy in Report-only beside the gallery policy, which is listed to retire', () => {
  const f = withPolicies(fresh(), [gallery()])
  const step = stepOf(f)
  const ops = step.action.resolution?.policies ?? []
  assert.deepEqual(ops.map((o) => o.mode), ['create'])
  assert.equal(ops[0].body.state, REPORT_ONLY)
  assert.ok((step.action.besidePolicies ?? []).some((p) => p.policyId === GALLERY), 'the gallery policy is never edited: it is listed to retire')
  assert.ok(!ops.some((o) => o.policyId === GALLERY))
})

// Rule 6, the owner option of 2026-10-05 ("Suggest a rename"): a tenant policy
// exactly the baseline's under another name is the step's own, read as it would be
// under the plan's name. On and exact as it stands, the step is done; the name is
// Align Policy Names' to suggest, in the one place every rename lives.
test('exactly the baseline policy under another name, On: the step is done on it, writes nothing, and Align Policy Names suggests the plan name', () => {
  const body = plannedBody(withPolicies(fresh(), [gallery()]))
  const f = withPolicies(fresh(), [{ ...body, id: OTHER, displayName: 'Contoso - MFA for everyone', state: 'enabled' }])
  const r = runFixture(f, {}, null, f.snapshot.asOf)
  const step = r.steps.find((s) => s.id === MFA)!
  assert.deepEqual(step.action.resolution?.policies ?? [], [], 'nothing to create or edit: no rename on the step')
  assert.equal(step.state.satisfied, true, 'done as it stands')
  assert.equal(step.status, 'done')
  assert.equal(step.action.intendedFor, OTHER, 'its own policy, compared as the finished step compares it')
  assert.equal(step.tracking?.members?.[0]?.policyId, OTHER, 'tracked as its own')
  assert.ok(!(step.action.besidePolicies ?? []).some((p) => p.policyId === OTHER), 'its own policy, not one to retire')
  const naming = r.schedule.cleanup?.namingProposals ?? []
  assert.deepEqual(naming.filter((n) => n.id === OTHER).map((n) => [n.from, n.to]), [['Contoso - MFA for everyone', body.displayName]], 'Align Policy Names suggests the plan name')
  // Renamed by hand, it is the same step's own, still done, and 8.2 has nothing left for it.
  const renamed = withPolicies(fresh(), [{ ...body, id: OTHER, state: 'enabled' }])
  const again = runFixture(renamed, {}, null, renamed.snapshot.asOf)
  assert.equal(again.steps.find((s) => s.id === MFA)!.status, 'done')
  assert.ok(!(again.schedule.cleanup?.namingProposals ?? []).some((n) => n.id === OTHER))
})

test('exactly the baseline policy under another name, in Report-only: the step’s own, turned on as the plan’s own would be, never renamed or created beside', () => {
  const body = plannedBody(withPolicies(fresh(), [gallery()]))
  const theirsF = withPolicies(fresh(), [{ ...body, id: OTHER, displayName: 'Contoso - MFA for everyone', state: REPORT_ONLY }])
  const theirs = stepOf(theirsF)
  assert.deepEqual(suggested(theirsF), [body.displayName], 'Align Policy Names suggests the plan name')
  const named = stepOf(withPolicies(fresh(), [{ ...body, id: OTHER, state: REPORT_ONLY }]))
  assert.notEqual(theirs.status, 'done', 'Report-only is not done')
  assert.ok(!(theirs.action.resolution?.policies ?? []).some((o) => o.mode === 'create'), 'nothing is created beside it')
  assert.ok(!(theirs.action.resolution?.policies ?? []).some((o) => typeof o.body.displayName === 'string'), 'the step writes no name')
  assert.equal(theirs.tracking?.members?.[0]?.policyId, OTHER, 'tracked as its own')
  // Read exactly as the plan's own under the plan's name: the same operations, the same lifecycle.
  const ops = (s: Step) => JSON.stringify((s.action.resolution?.policies ?? []).map((o) => [o.mode, o.policyId, o.body]))
  assert.equal(ops(theirs), ops(named), 'the name changes what the step writes')
  assert.equal(theirs.state.lifecycle, named.state.lifecycle)
  assert.equal(theirs.status, named.status)
})

test('exactly the baseline policy under another name but for the exclusions group: a correction under its own name, never a rename', () => {
  const body = plannedBody(withPolicies(fresh(), [gallery()]))
  const users = ((body.conditions as Row).users ?? {}) as Row
  const short = { ...body, conditions: { ...(body.conditions as Row), users: { ...users, excludeGroups: [] } } }
  const theirsF = withPolicies(fresh(), [{ ...short, id: OTHER, displayName: 'Contoso - MFA for everyone', state: 'enabled' }])
  const theirs = stepOf(theirsF)
  assert.deepEqual(suggested(theirsF), [body.displayName], 'Align Policy Names suggests the plan name')
  const named = stepOf(withPolicies(fresh(), [{ ...short, id: OTHER, state: 'enabled' }]))
  assert.notEqual(theirs.status, 'done', 'the exclusions group missing is not done')
  assert.ok(!(theirs.action.resolution?.policies ?? []).some((o) => o.mode === 'create'), 'nothing is created beside it')
  assert.ok(!(theirs.action.resolution?.policies ?? []).some((o) => typeof o.body.displayName === 'string'), 'the step writes no name')
  assert.equal(theirs.tracking?.members?.[0]?.policyId, OTHER)
  assert.equal(theirs.status, named.status, 'read as the plan’s own under the plan’s name')
  // The same correction, naming the policy by its own name.
  const correction = (s: Step) => JSON.stringify(s.tracking?.members?.[0]?.correction ?? null).replace('Contoso - MFA for everyone', String(body.displayName))
  assert.notEqual(theirs.tracking?.members?.[0]?.correction ?? null, null, 'the premise: a correction')
  assert.equal(correction(theirs), correction(named))
})

test('the plan name and every control: in place, nothing to create or edit', () => {
  const body = plannedBody(withPolicies(fresh(), [gallery()]))
  const f = withPolicies(fresh(), [{ ...body, id: OTHER, state: 'enabled' }])
  const step = stepOf(f)
  assert.equal(step.state.satisfied, true)
  assert.ok(!(step.action.resolution?.policies ?? []).some((o) => o.mode === 'create'), 'nothing is created')
})

test('the plan name with other controls: the step edits that policy in place, never a second one beside it', () => {
  const body = plannedBody(withPolicies(fresh(), [gallery()]))
  const f = withPolicies(fresh(), [{ ...gallery(), id: OTHER, displayName: body.displayName }])
  const step = stepOf(f)
  const ops = step.action.resolution?.policies ?? []
  assert.ok(ops.length > 0 && ops.every((o) => o.mode === 'update' && o.policyId === OTHER), JSON.stringify(ops.map((o) => [o.mode, o.policyId])))
})

test('a switched-off policy carrying the plan name is still its own: no second policy, no "(2)" name', () => {
  const body = plannedBody(withPolicies(fresh(), [gallery()]))
  const f = withPolicies(fresh(), [{ ...body, id: OTHER, state: 'disabled' }])
  const step = stepOf(f)
  const ops = step.action.resolution?.policies ?? []
  assert.ok(!ops.some((o) => o.mode === 'create'), 'nothing is created beside it')
  assert.ok(ops.some((o) => o.policyId === OTHER))
})

test('two live policies carrying the plan name and neither its tag: the step holds and creates nothing', () => {
  const body = plannedBody(withPolicies(fresh(), [gallery()]))
  const f = withPolicies(fresh(), [
    { ...gallery(), id: OTHER, displayName: body.displayName },
    { ...gallery(), id: GALLERY, displayName: body.displayName, state: REPORT_ONLY },
  ])
  const step = stepOf(f)
  assert.equal(step.action.ambiguousTarget, true)
  assert.deepEqual(step.action.resolution?.policies ?? [], [])
})

test('demo-week2: the three enforced policies exactly the baseline’s under the tenant’s names are their steps’ own, and Align Policy Names suggests their names (owner option, 2026-10-05)', async () => {
  const { boardReadingsOf } = await import('../ui/surfaces/planBoard.ts')
  const f = withFoundationSettled(fixture('demo-week2'))
  const r = runFixture(f, {}, null, f.snapshot.asOf)
  const rows = f.snapshot.config.caPolicies!.rows as Row[]
  const naming = r.schedule.cleanup?.namingProposals ?? []
  const exact: Record<string, string> = { [MFA]: 'Core - Grant - MFA for all users', 's-goal-block-device-code': 'Core - Block - Device code flow', 's-goal-block-legacy-auth': 'Core - Block - Legacy authentication' }
  for (const [id, name] of Object.entries(exact)) {
    const step = r.steps.find((s) => s.id === id)!
    const policy = rows.find((p) => p.displayName === name)
    assert.ok(policy, `the premise: week two holds ${name}`)
    assert.equal(policy.state, 'enabled', `the premise: ${name} is On`)
    assert.deepEqual(step.action.resolution?.policies ?? [], [], `${id} hands over a rename`)
    assert.equal(step.action.intendedFor, policy.id, `${id} compares ${name} as its own`)
    assert.ok(naming.some((n) => n.id === policy.id && n.from === name && n.to === step.createName), `${id}: Align Policy Names does not suggest ${step.createName} for ${name}: ${JSON.stringify(naming)}`)
  }
  // Two are done; Block Legacy Authentication stays open for its own reason, the
  // mail accounts still to move (blockSignIns.ts), never for its name.
  assert.equal(r.steps.find((s) => s.id === MFA)!.status, 'done')
  assert.equal(r.steps.find((s) => s.id === 's-goal-block-device-code')!.status, 'done')
  const legacy = r.steps.find((s) => s.id === 's-goal-block-legacy-auth')!
  assert.ok((legacy.mailAccountsToMove ?? []).length > 0 && legacy.state.lifecycle === 'enforced', 'the premise: legacy is open for its mail accounts alone')
  assert.ok(!r.steps.some((s) => (s.action.resolution?.policies ?? []).some((o) => o.renamesOnly === true)), 'a step hands over a rename: 8.2 is the one place')
  // The unchanged tenant's follow-up scan completes what v1.0.0 completed on it:
  // ten of the board's rows (v1.1 before this option: eight).
  const board = boardReadingsOf(r.steps, r.schedule.cleanup, null)
  assert.equal([...board.readings.values()].filter((x) => x.lane === 'Completed').length, 10)
})

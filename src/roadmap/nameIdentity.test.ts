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

test('exactly the baseline policy under another name: the step renames it, its one edit, and creates nothing', () => {
  const body = plannedBody(withPolicies(fresh(), [gallery()]))
  const f = withPolicies(fresh(), [{ ...body, id: OTHER, displayName: 'Contoso - MFA for everyone', state: 'enabled' }])
  const step = stepOf(f)
  const ops = step.action.resolution?.policies ?? []
  assert.equal(ops.length, 1)
  assert.equal(ops[0].mode, 'update')
  assert.equal(ops[0].policyId, OTHER)
  assert.equal(ops[0].body.displayName, body.displayName, 'the rename writes the plan name')
  assert.ok((step.action.changes ?? []).some((c) => c.field === 'Name'))
  assert.ok(!(step.action.besidePolicies ?? []).some((p) => p.policyId === OTHER), 'the renamed policy is its own, not one to retire')
  assert.equal(step.state.satisfied, false, 'not done until it carries the plan name')
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

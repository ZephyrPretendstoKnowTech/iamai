// Every control is exact (owner, 2026-09-25): a policy completes its step only
// where each condition, grant and session setting is the plan's. Only the name
// may differ, and the step says so.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { allFixtures } from './fixtures/index.ts'
import { runFixture } from './fixtures/run.ts'
import { REPORT_ONLY_STEP_ID } from './reportOnlyBatch.ts'
import { sameDimension } from './observation.ts'
import { stepBodyOf } from '../ui/surfaces/stepBody.ts'
import { planDates } from '../ui/surfaces/stepVars.ts'
import type { StepVarContext } from '../ui/surfaces/stepVars.ts'

type Row = Record<string, unknown>
const DEMO = allFixtures().find((f) => f.name === 'demo')!
const rowsOf = (snap: typeof DEMO.snapshot): Row[] => (snap.config.caPolicies?.rows ?? []) as Row[]

/** A demo step still to create, listed on Create the Policies in Report-only: the one every case builds, as someone would in Entra. */
function toCreate() {
  const run = runFixture(DEMO)
  const batch = run.steps.find((s) => s.id === REPORT_ONLY_STEP_ID)!
  const step = run.steps.find((s) => batch.reportOnlyBatch!.create.includes(s.id) && (s.action.resolution?.policies ?? []).length === 1)!
  assert.ok(step, 'the premise: the demo has a policy still to create in Report-only')
  return { id: step.id, body: structuredClone(step.action.resolution!.policies[0].body) as Row }
}

/** The tenant after someone built that step's policy from its own create body, edited as the case needs, in Report-only. */
function rescan(edit: (row: Row) => void) {
  const { id, body } = toCreate()
  const snapshot = structuredClone(DEMO.snapshot)
  const row: Row = { ...body, id: 'p-built-from-step', state: 'enabledForReportingButNotEnforced', createdDateTime: snapshot.asOf }
  edit(row)
  rowsOf(snapshot).push(row)
  const run = runFixture({ ...DEMO, snapshot })
  const ctx: StepVarContext = { snapshot, mapping: DEMO.mapping, nameOf: (x) => run.input.names!.label(x), signature: 'IT', operatorId: DEMO.operatorId, now: snapshot.asOf, groups: DEMO.groups, naming: run.coverage.organisation.naming, ...planDates(run.steps, run.schedule.start, run.coverage.organisation.naming, snapshot) }
  return { step: run.steps.find((s) => s.id === id)!, batch: run.steps.find((s) => s.id === REPORT_ONLY_STEP_ID), ctx }
}

test('one session setting off the plan: the step asks for the correction, and Create the Policies in Report-only reads Correct', () => {
  const { step, batch, ctx } = rescan((row) => {
    row.sessionControls = { signInFrequency: { isEnabled: true, type: 'hours', value: 4, frequencyInterval: 'timeBased', authenticationType: 'primaryAndSecondaryAuthentication' } }
  })
  assert.deepEqual([...new Set(step.state.members.flatMap((m) => [...m.change.unwritten]))], ['sessionControls'])
  assert.equal(step.state.satisfied, false)
  assert.ok(batch?.reportOnlyBatch?.correct?.includes(step.id), 'the batch lists it to correct')
  assert.equal(batch!.state.satisfied, false, 'the batch is not done while a policy differs')
  const card = stepBodyOf(batch!, ctx).readiness.tiles.find((t) => t.key === `batch:${step.id}`)
  assert.equal(card?.value, 'Correct session controls')
})

test('built exactly from its create: nothing to correct, the batch counts it created, and no name card', () => {
  const { step, batch, ctx } = rescan(() => {})
  assert.equal(step.tracking?.policyId, 'p-built-from-step', 'the premise: the step finds the policy built from it')
  assert.deepEqual(step.state.members.flatMap((m) => [...m.change.unwritten]), [])
  assert.equal(step.state.lifecycle, 'report-only')
  assert.ok(batch!.reportOnlyBatch!.created.includes(step.id) && !(batch!.reportOnlyBatch!.correct ?? []).includes(step.id))
  assert.equal(stepBodyOf(step, ctx).readiness.satisfied.some((t) => t.key.startsWith('policy-name')), false)
})

test('built exactly from its create, as Graph returns it: its OData annotations are no setting to correct', () => {
  const { step, batch } = rescan((row) => {
    // What Graph answers beside every deployed grant, and on a guest setting's external tenants.
    const grant = (row.grantControls ?? {}) as Row
    row.grantControls = { ...grant, customAuthenticationFactors: [], termsOfUse: [], 'authenticationStrength@odata.context': 'https://graph.microsoft.com/v1.0/$metadata#identity/conditionalAccess/policies(\'p\')/grantControls/authenticationStrength/$entity', authenticationStrength: grant.authenticationStrength ?? null }
    const users = ((row.conditions as Row).users ?? {}) as Row
    ;(row.conditions as Row).users = { ...users, excludeGuestsOrExternalUsers: users.excludeGuestsOrExternalUsers ?? null }
  })
  assert.deepEqual(step.state.members.flatMap((m) => [...m.change.unwritten]), [])
  assert.ok(!(batch!.reportOnlyBatch!.correct ?? []).includes(step.id))
})

test('Token Protection as Graph returns it: secureAppSessionMode at its unset default is no session to correct, and a set value is', () => {
  const same = sameDimension({ secureSignInSession: { isEnabled: true } }, { disableResilienceDefaults: null, signInFrequency: null, secureSignInSession: { secureAppSessionMode: 'notEnforced', isEnabled: true } })
  assert.equal(same, true)
  assert.equal(sameDimension({ secureSignInSession: { isEnabled: true } }, { secureSignInSession: { secureAppSessionMode: 'enforced', isEnabled: true } }), false)
})

test('only the name off the plan: the step completes as before and names the step’s own name', () => {
  const before = rescan(() => {})
  const { step, ctx } = rescan((row) => {
    row.displayName = 'Renamed by someone'
  })
  assert.deepEqual(step.state.members.flatMap((m) => [...m.change.unwritten]), [])
  assert.equal(step.state.lifecycle, before.step.state.lifecycle)
  const member = step.tracking!.members!.find((m) => m.policyName === 'Renamed by someone')!
  assert.ok(member.plannedName && member.plannedName !== 'Renamed by someone', 'the step keeps its own name')
  const tile = stepBodyOf(step, ctx).readiness.satisfied.find((t) => t.key.startsWith('policy-name'))
  assert.equal(tile?.value, 'Renamed by someone')
  assert.match(String(tile?.note), new RegExp(`This step names it ${member.plannedName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`))
})

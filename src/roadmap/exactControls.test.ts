// Every control is exact (owner, 2026-09-25): a policy completes its step only
// where each condition, grant and session setting is the plan's. Only the name
// may differ, and the step says so.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { allFixtures } from './fixtures/index.ts'
import { runFixture } from './fixtures/run.ts'
import { REPORT_ONLY_STEP_ID } from './reportOnlyBatch.ts'
import { sameDimension } from './observation.ts'
import { DEVIATION_KEY, applyStepDecisions } from './decisions.ts'
import { usersWider } from './tracking.ts'
import { asPlanned } from './fixtures/asPlanned.ts'
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

test('a policy doing another step’s job is never corrected into this one: Shorten Admin Sessions creates the baseline’s beside the admins’ MFA policy', () => {
  // Owner, 2026-09-25 ("only policies doing another step's job"): GetIAMAI's own
  // "Core - Allow - MFA for Admins" requires phishing-resistant MFA and also sets a
  // 7-day sign-in frequency. Shorten Admin Sessions read it as its policy and asked
  // to correct its users, client apps, grant and session, which would have taken
  // the MFA off it. A grant policy is never a session-only step's.
  const snapshot = structuredClone(DEMO.snapshot)
  const GA = '62e90394-69f5-4237-9190-012177145e10'
  rowsOf(snapshot).push({
    id: 'p-mfa-for-admins', displayName: 'Contoso MFA for Admins', description: '', state: 'enabled', createdDateTime: snapshot.asOf,
    conditions: { users: { includeRoles: [GA], excludeGroups: [] }, applications: { includeApplications: ['All'] }, clientAppTypes: ['all'] },
    grantControls: { operator: 'OR', builtInControls: [], authenticationStrength: { id: '00000000-0000-0000-0000-000000000004' } },
    sessionControls: { signInFrequency: { isEnabled: true, type: 'days', value: 7, frequencyInterval: 'timeBased', authenticationType: 'primaryAndSecondaryAuthentication' }, persistentBrowser: { isEnabled: true, mode: 'always' } },
  })
  const run = runFixture({ ...DEMO, snapshot })
  const session = run.steps.find((s) => s.goalId === 'admin-session')!
  assert.ok(session, 'the premise: the demo plans Shorten Admin Sessions')
  assert.notEqual(session.tracking?.policyId, 'p-mfa-for-admins', 'the admins’ MFA policy is not tied to the session step')
  assert.ok((session.action.resolution?.policies ?? []).every((o) => o.policyId !== 'p-mfa-for-admins'), 'nothing edits it for the session step')
  assert.ok(!session.state.members.some((m) => m.change.unwritten.includes('grantControls')), 'no grant correction is asked of it')
})

test('stricter than the baseline is accepted and said: an admins policy covering more roles than the plan’s completes, noting it', () => {
  // Owner, 2026-09-25 (deviations, option A): GetIAMAI's admins policy covers 133
  // roles, the baseline's 46. Wider users with no extra exclusion is stricter.
  const plan = { conditions: { users: { includeRoles: ['r1', 'r2'], excludeGroups: ['x'] } } }
  assert.equal(usersWider(plan, { conditions: { users: { includeRoles: ['r1', 'r2', 'r3'], excludeGroups: ['x'] } } }), true, 'more roles')
  assert.equal(usersWider(plan, { conditions: { users: { includeUsers: ['All'], excludeGroups: ['x'] } } }), true, 'everyone')
  assert.equal(usersWider(plan, { conditions: { users: { includeRoles: ['r1'], excludeGroups: ['x'] } } }), false, 'a role missing')
  assert.equal(usersWider(plan, { conditions: { users: { includeRoles: ['r1', 'r2', 'r3'], excludeGroups: ['x', 'y'] } } }), false, 'an extra exclusion')

  const ADMINS = 's-goal-admins-phishing-resistant'
  const f = asPlanned(DEMO, ADMINS)
  const id = runFixture(f).steps.find((s) => s.id === ADMINS)!.tracking!.policyId
  const snapshot = structuredClone(f.snapshot)
  const row = rowsOf(snapshot).find((p) => p.id === id)!
  const users = (row.conditions as Row).users as Row
  users.includeRoles = [...((users.includeRoles as string[]) ?? []), '9b895d92-2cd3-44c7-9d02-a6ac2d5ea5c3']
  const run = runFixture({ ...f, snapshot })
  const step = run.steps.find((s) => s.id === ADMINS)!
  assert.deepEqual(step.state.members.flatMap((m) => [...m.change.unwritten]), [], 'no correction')
  assert.deepEqual(step.tracking?.members?.[0]?.stricter, ['conditions.users'])
  const ctx: StepVarContext = { snapshot, mapping: f.mapping, nameOf: (x) => run.input.names!.label(x), signature: 'IT', operatorId: f.operatorId, now: snapshot.asOf, groups: f.groups, naming: run.coverage.organisation.naming, ...planDates(run.steps, run.schedule.start, run.coverage.organisation.naming, snapshot) }
  const tile = stepBodyOf(step, ctx).readiness.satisfied.find((t) => t.key.startsWith('stricter:'))
  assert.match(String(tile?.note), /is stricter than the baseline's policy in who it applies to\. IAMAI accepts it as it is\./)
})

test('a difference accepted with a reason completes the step and says so; changing the accepted setting reopens it', () => {
  // Owner, 2026-09-25 (deviations, option B).
  const session = (hours: number) => (row: Row): void => {
    row.sessionControls = { signInFrequency: { isEnabled: true, type: 'hours', value: hours, frequencyInterval: 'timeBased', authenticationType: 'primaryAndSecondaryAuthentication' } }
  }
  const first = rescan(session(4))
  const member = first.step.tracking!.members![0]
  assert.deepEqual(Object.keys(member.differsFields ?? {}), ['sessionControls'], 'the premise: one setting to correct, with its fingerprint')
  const decisions = { [`${DEVIATION_KEY}${first.step.id}`]: { answers: { reason: 'Reception kiosks sign in again every four hours', fields: JSON.stringify(member.differsFields) }, at: '2026-09-25T00:00:00Z' } }
  const accepting = (hours: number) => {
    const snapshot = structuredClone(DEMO.snapshot)
    const { body } = toCreate()
    const row: Row = { ...structuredClone(body), id: 'p-built-from-step', state: 'enabledForReportingButNotEnforced', createdDateTime: snapshot.asOf }
    session(hours)(row)
    rowsOf(snapshot).push(row)
    const f = { ...DEMO, snapshot, mapping: applyStepDecisions(DEMO.mapping, decisions) }
    const run = runFixture(f)
    const ctx: StepVarContext = { snapshot, mapping: f.mapping, nameOf: (x) => run.input.names!.label(x), signature: 'IT', operatorId: f.operatorId, now: snapshot.asOf, groups: f.groups, naming: run.coverage.organisation.naming, ...planDates(run.steps, run.schedule.start, run.coverage.organisation.naming, snapshot) }
    return { step: run.steps.find((s) => s.id === first.step.id)!, ctx }
  }
  const kept = accepting(4)
  assert.deepEqual(kept.step.state.members.flatMap((m) => [...m.change.unwritten]), [], 'nothing left to correct')
  assert.deepEqual(kept.step.tracking?.members?.[0]?.accepted, ['sessionControls'])
  const tile = stepBodyOf(kept.step, kept.ctx).readiness.satisfied.find((t) => t.key.startsWith('accepted:'))
  assert.match(String(tile?.note), /differs from the baseline's policy in session controls\. Accepted .+: Reception kiosks sign in again every four hours/)
  const moved = accepting(8)
  assert.deepEqual([...new Set(moved.step.state.members.flatMap((m) => [...m.change.unwritten]))], ['sessionControls'], 'the accepted setting moved: the step reopens')
})

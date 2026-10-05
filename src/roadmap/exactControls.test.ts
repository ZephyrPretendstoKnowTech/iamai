// Every control is exact (owner, 2026-09-25): a policy completes its step only
// where each condition, grant and session setting is the plan's. Which policy is
// the step's is read by its name (owner, 2026-10-04: policy identity is the name):
// the plan's tag, else the baseline's name. A policy carrying the tag keeps it
// under any name, and Align Policy Names lists the rename; an untagged policy
// exactly the baseline's under another name is renamed by the step itself, and
// under the baseline's name it completes the step.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { allFixtures } from './fixtures/index.ts'
import { runFixture } from './fixtures/run.ts'
import { REPORT_ONLY_STEP_ID } from './reportOnlyBatch.ts'
import { sameDimension } from './observation.ts'
import { DEVIATION_KEY, applyStepDecisions } from './decisions.ts'
import { differencePieces } from './differences.ts'
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
  return { step: run.steps.find((s) => s.id === id)!, batch: run.steps.find((s) => s.id === REPORT_ONLY_STEP_ID), ctx, run }
}

test('one session setting off the plan: the step asks for the correction, and Create the Policies in Report-only lists it no second time', () => {
  const { step, batch, ctx } = rescan((row) => {
    row.sessionControls = { signInFrequency: { isEnabled: true, type: 'hours', value: 4, frequencyInterval: 'timeBased', authenticationType: 'primaryAndSecondaryAuthentication' } }
  })
  assert.deepEqual([...new Set(step.state.members.flatMap((m) => [...m.change.unwritten]))], ['sessionControls'])
  assert.equal(step.state.satisfied, false)
  // Only the policies still to create are 3.6's (owner, 2026-09-26): the correction is this step's own card.
  assert.ok(batch!.reportOnlyBatch!.created.includes(step.id), 'the batch counts it created')
  assert.equal(stepBodyOf(batch!, ctx).readiness.tiles.some((t) => t.key === `batch:${step.id}`), false, 'and draws no card for it')
})

test('built exactly from its create: nothing to correct, the batch counts it created, and no name card', () => {
  const { step, batch, ctx } = rescan(() => {})
  assert.equal(step.tracking?.policyId, 'p-built-from-step', 'the premise: the step finds the policy built from it')
  assert.deepEqual(step.state.members.flatMap((m) => [...m.change.unwritten]), [])
  assert.equal(step.state.lifecycle, 'report-only')
  assert.ok(batch!.reportOnlyBatch!.created.includes(step.id))
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
  assert.ok(batch!.reportOnlyBatch!.created.includes(step.id))
})

test('Token Protection as Graph returns it: secureAppSessionMode at its unset default is no session to correct, and a set value is', () => {
  const same = sameDimension({ secureSignInSession: { isEnabled: true } }, { disableResilienceDefaults: null, signInFrequency: null, secureSignInSession: { secureAppSessionMode: 'notEnforced', isEnabled: true } })
  assert.equal(same, true)
  assert.equal(sameDimension({ secureSignInSession: { isEnabled: true } }, { secureSignInSession: { secureAppSessionMode: 'enforced', isEnabled: true } }), false)
})

test('an authentication strength is compared by its id: Graph’s expanded object is the same strength, and another id is not', () => {
  // Owner, 2026-09-26: the expanded object read as a grant stricter than the baseline's.
  const id = '00000000-0000-0000-0000-000000000004'
  const planned = { operator: 'OR', builtInControls: [], authenticationStrength: { id } }
  const expanded = { id, displayName: 'Phishing-resistant MFA', policyType: 'builtIn', requirementsSatisfied: 'mfa', allowedCombinations: ['windowsHelloForBusiness', 'fido2', 'x509CertificateMultiFactor'], combinationConfigurations: [] }
  assert.equal(sameDimension(planned, { ...planned, customAuthenticationFactors: [], termsOfUse: [], authenticationStrength: expanded }), true)
  assert.equal(sameDimension(planned, { ...planned, authenticationStrength: { id, displayName: 'Phishing-resistant MFA' } }), true)
  assert.equal(sameDimension(planned, { ...planned, authenticationStrength: { ...expanded, id: '00000000-0000-0000-0000-000000000002' } }), false)
})

test('only the name off the plan: the step completes as before, draws no name card, and Align Policy Names lists the rename', () => {
  const before = rescan(() => {})
  const { step, ctx, run } = rescan((row) => {
    row.displayName = 'Renamed by someone'
  })
  assert.deepEqual(step.state.members.flatMap((m) => [...m.change.unwritten]), [])
  assert.equal(step.state.lifecycle, before.step.state.lifecycle)
  const member = step.tracking!.members!.find((m) => m.policyName === 'Renamed by someone')!
  assert.ok(member.plannedName && member.plannedName !== 'Renamed by someone', 'the step keeps its own name')
  // The rename is 8.2's, never a card on the step (owner, 2026-09-26).
  assert.equal(stepBodyOf(step, ctx).readiness.satisfied.some((t) => t.key.startsWith('policy-name')), false)
  const naming = run.schedule.cleanup!.rows.find((r) => r.kind === 'naming')
  assert.ok(naming?.lists.renames.includes(`Renamed by someone → ${member.plannedName} (ID: p-built-from-step)`), JSON.stringify(naming?.lists))
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

test('a difference is marked stricter or weaker, piece by piece', () => {
  const plan = { conditions: { users: { includeRoles: ['r1', 'r2'], excludeGroups: ['x'] } } }
  const pieces = (tenant: Row) => differencePieces('conditions.users', plan, tenant, { exclusionsGroupId: 'x', same: sameDimension })
  assert.deepEqual(pieces({ conditions: { users: { includeRoles: ['r1', 'r2', 'r3'], excludeGroups: ['x'] } } }).map((d) => [d.part, d.kind, d.change, d.ids, d.direction]), [['include', 'role', 'extra', ['r3'], 'stricter']], 'more roles')
  assert.deepEqual(pieces({ conditions: { users: { includeRoles: ['r1'], excludeGroups: ['x', 'y'] } } }).map((d) => [d.part, d.change, d.ids, d.direction]), [['include', 'missing', ['r2'], 'weaker'], ['exclude', 'extra', ['y'], 'weaker']], 'a role missing and an extra exclusion')
  assert.equal(pieces({ conditions: { users: { includeRoles: ['r1', 'r2'] } } })[0].required, true, 'the exclusions group is never optional')
  assert.deepEqual(pieces({ conditions: { users: { includeUsers: ['All'], excludeGroups: ['x'] } } }).map((d) => [d.part, d.direction]), [['allUsers', 'stricter']], 'everyone')
})

test('every difference is corrected or accepted, a stricter one too: accepted, more roles later keep it accepted; a missing role reopens it', () => {
  // Owner, 2026-09-26: the policy points at exactly what the plan's has; stricter
  // or looser is what an acceptance is for, and only a new gap reopens it.
  const ADMINS = 's-goal-admins-phishing-resistant'
  const f = asPlanned(DEMO, ADMINS)
  const id = runFixture(f).steps.find((s) => s.id === ADMINS)!.tracking!.policyId
  const withRoles = (edit: (roles: string[]) => string[], decisions: Record<string, unknown> = {}) => {
    const snapshot = structuredClone(f.snapshot)
    const users = (rowsOf(snapshot).find((p) => p.id === id)!.conditions as Row).users as Row
    users.includeRoles = edit([...((users.includeRoles as string[]) ?? [])])
    return runFixture({ ...f, snapshot, mapping: applyStepDecisions(f.mapping, decisions as never) }).steps.find((s) => s.id === ADMINS)!
  }
  // Agent ID Developer, outside the plan's 46.
  const extra = withRoles((r) => [...r, 'adb2368d-a9be-41b5-8667-d96778e081b0'])
  assert.deepEqual([...new Set(extra.state.members.flatMap((m) => [...m.change.unwritten]))], ['conditions.users'], 'a stricter policy is still a correction')
  assert.ok(extra.tracking?.members?.[0]?.differences?.some((d) => d.part === 'include' && d.kind === 'role' && d.change === 'extra' && d.direction === 'stricter'))
  const decisions = { [`${DEVIATION_KEY}${ADMINS}`]: { answers: { reason: 'Every admin role asks for phishing-resistant MFA', fields: JSON.stringify(extra.tracking!.members![0].differsFields) }, at: '2026-09-26T00:00:00Z' } }
  const accepted = withRoles((r) => [...r, 'adb2368d-a9be-41b5-8667-d96778e081b0'], decisions)
  assert.deepEqual(accepted.state.members.flatMap((m) => [...m.change.unwritten]), [], 'accepted')
  const more = withRoles((r) => [...r, 'adb2368d-a9be-41b5-8667-d96778e081b0', '6b942400-691f-4bf0-9d12-d8a254a2baf5'], decisions)
  assert.deepEqual(more.state.members.flatMap((m) => [...m.change.unwritten]), [], 'another role later keeps the acceptance')
  const gap = withRoles((r) => [...r.slice(1), 'adb2368d-a9be-41b5-8667-d96778e081b0'], decisions)
  // The step's own policy (owner, 2026-10-04: policy identity is the name) has a
  // role the goal needs taken off: the step's update now writes the users back
  // itself, so the gap is a correction the operation carries, not one left unwritten.
  assert.equal(gap.state.satisfied, false, 'a role taken off reopens it')
  const writes = (gap.action.resolution?.policies ?? []).some((o) => o.mode === 'update' && o.policyId === id && ((o.body as Row).conditions as Row | undefined)?.users !== undefined)
  const unwritten = gap.state.members.flatMap((m) => [...m.change.unwritten])
  assert.ok(writes || unwritten.includes('conditions.users'), 'a role taken off reopens it: its users are corrected')
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

test('exactly the baseline’s policy, untagged, under another name: the step’s own, read as under the baseline’s name, and Align Policy Names suggests the name (owner option, 2026-10-05: "Suggest a rename")', () => {
  // A person built the policy by hand from the step's procedure, kept no IAMAI
  // tag and gave it the tenant's own name: its controls are the plan's, so it is
  // the step's own rather than a reason to create a second one. The step writes
  // no name; the rename is suggested where every rename lives, 8.2.
  const { step, run } = rescan((row) => {
    delete row.description
    row.displayName = 'Renamed by someone'
  })
  assert.equal(step.tracking?.policyId, 'p-built-from-step', 'its controls make it the step’s own')
  assert.deepEqual(step.state.members.flatMap((m) => [...m.change.unwritten]), [])
  assert.ok(!(step.action.resolution?.policies ?? []).some((o) => o.mode === 'create'), 'nothing is created beside it')
  assert.ok(!(step.action.resolution?.policies ?? []).some((o) => typeof (o.body as Row).displayName === 'string'), 'the step writes no name')
  assert.equal(step.state.lifecycle, 'report-only')
  assert.ok(!(step.action.besidePolicies ?? []).some((p) => p.policyId === 'p-built-from-step'), 'it is the step’s own, never one to retire')
  assert.ok((run.schedule.cleanup?.namingProposals ?? []).some((n) => n.id === 'p-built-from-step' && n.from === 'Renamed by someone' && n.to === step.createName), JSON.stringify(run.schedule.cleanup?.namingProposals))
})

test('exactly the baseline’s policy, untagged, under the baseline’s name: the step finds it and has nothing to correct (owner, 2026-10-04: policy identity is the name)', () => {
  const { step } = rescan((row) => {
    delete row.description
  })
  assert.equal(step.tracking?.policyId, 'p-built-from-step', 'the name alone makes it the step’s own')
  assert.deepEqual(step.state.members.flatMap((m) => [...m.change.unwritten]), [])
  assert.ok(!(step.action.resolution?.policies ?? []).some((o) => o.mode === 'create'), 'nothing is created beside it')
  assert.equal(step.state.lifecycle, 'report-only')
})

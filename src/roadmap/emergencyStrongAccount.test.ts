// Owner, 2026-10-05: Jon's "IAC - GLOBAL - GRANT - BreakGlass - TrustedLocations",
// listed until now under In the baseline, not in this plan, is a policy step:
// Require a Security Key for One Emergency Account Outside the Office.
// Microsoft's two-account pattern. It includes the one emergency account the
// operator names in Decide How and Where People Sign In and nobody else, so the
// other emergency account is out of its scope; it excludes no account by name
// and does not exclude the exclusions group, which holds the account it is for.
// Every emergency safety reading accepts exactly that policy reaching exactly
// that account, and still flags anything else. SAFETY-CRITICAL: every gate is
// proved here in both directions.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fixture } from './fixtures/index.ts'
import type { Fixture } from './fixtures/index.ts'
import { runFixture, withFoundationSettled, withRecoveryTested } from './fixtures/run.ts'
import { applyStepDecisions } from './decisions.ts'
import { answerKey } from './answers.ts'
import { DIRECTION_LOCATIONS_STORAGE, DIRECTION_STEP, EMERGENCY_STRONG_STORAGE, directionAnswerComplete, directionComplete, savedAnswerOf } from './directionAnswers.ts'
import { BREAK_GLASS_STEP_ID, EXCLUSION_GROUP_STEP_ID, PREREQ_STEP_ID } from './stepIds.ts'
import { DRILL_PREREQUISITE } from './enforceWaits.ts'
import { EMERGENCY_STRONG_GOAL, EMERGENCY_STRONG_SLOT, EMERGENCY_STRONG_STEP, acceptedEmergencyStrongPolicy, acceptedOwnExposure, emergencyStrongShape } from './emergencyStrongAccount.ts'
import { PINNED_GOAL_MAP } from './goalMap.ts'
import { enforcesOnRun, operationsOf, policyResult } from './operations.ts'
import { buildPlanFile, parsePlanFile } from './plan.ts'
import { automaticRecoveryPreparationStates } from './cleanupDone.ts'
import { emergencyStrongAccountOf } from '../mapping/emergencyChoice.ts'
import { emptyMappingState } from '../mapping/types.ts'
import { readInterpretation } from '../baseline/interpretation.ts'
import { pinnedPackage } from '../baseline/pinned.ts'
import { goalMapInUse } from '../coverage/companions.ts'
import { notInPlanRows } from '../derive/notInPlan.ts'
import { buildContext } from '../validation/report.ts'
import { evaluateSubject } from '../validation/rules.ts'
import { exclusionsGroupPolicies, groupLookup } from '../validation/exclusionsGroupPolicies.ts'
import { stepById } from '../content/content.ts'
import interpretation from '../../baselines/jhope188-conditionalaccesspolicies.interpretation.json' with { type: 'json' }
import pinned from '../../baselines/jhope188-conditionalaccesspolicies.pinned.json' with { type: 'json' }
import type { Step } from './types.ts'

const POLICY = 'IAC - GLOBAL - GRANT - BreakGlass - TrustedLocations'
const POLICY_ID = '1588fdc7-f34a-468e-8023-4d788ef5d226'
/** Jon's emergency account the policy includes, and the one it excludes by name. */
const JON_STRONG = 'cec6164b-ea04-4646-b1b0-125cb7b0c71b'
const JON_OTHER = 'ebb6b745-eb22-4e8e-8b09-95e9bb568ce2'
/** Jon's trusted location and his Modern MFA + TAP strength: the tenant's own stand in their place. */
const JON_LOCATION = '0403d368-f07f-4e4c-b75d-aa169d5b6683'
const JON_STRENGTH = '42de22a7-5339-4a58-b560-28565d53b14d'
const HEAD_OFFICE = '003d0901-78a9-43a8-8807-8a1b61b6f6f3'
const WAIT = `direction:${DIRECTION_STEP.devices}`

type Users = { includeUsers?: string[]; excludeUsers?: string[]; includeGroups?: string[]; excludeGroups?: string[]; includeRoles?: string[]; excludeRoles?: string[] }

/** The demo, settled, with the office network answered: Head office, trusted in Entra. */
function settled(office: 'office' | 'remote' = 'office'): Fixture {
  const f = withFoundationSettled(fixture('demo'))
  const at = f.snapshot.asOf
  const mapping = applyStepDecisions(f.mapping, { [PREREQ_STEP_ID.trustedLocation]: { picked: office === 'office' ? [HEAD_OFFICE] : [], option: office === 'office' ? 'office-network' : 'remote', at } })
  mapping.questionAnswers = { ...(mapping.questionAnswers ?? {}), [answerKey(DIRECTION_LOCATIONS_STORAGE, 'officeNetwork')]: office }
  return { ...f, mapping }
}
/** The fixture with the operator's Save naming `picked` as the account that must use its security key. */
function named(f: Fixture, picked: string[], provenance?: 'detected'): Fixture {
  return { ...f, mapping: applyStepDecisions(f.mapping, { [EMERGENCY_STRONG_STORAGE]: { picked, at: f.snapshot.asOf } }, provenance) }
}
const stepOf = (steps: Step[], id: string): Step => {
  const s = steps.find((x) => x.id === id)
  assert.ok(s, `${id} is on the plan`)
  return s
}
const strongOf = (f: Fixture): Step => stepOf(runFixture(f).steps, EMERGENCY_STRONG_STEP)
const bodyOf = (s: Step): Record<string, any> => {
  assert.ok(s.action.json, `${s.id} hands over a body: ${JSON.stringify(s.action.missing)}`)
  return JSON.parse(s.action.json) as Record<string, any>
}
/** The fixture with the step's own policy in the tenant, as 3.8 created it, in `state`. */
function deployed(f: Fixture, state = 'enabledForReportingButNotEnforced', edit: (p: Record<string, any>) => void = () => {}): Fixture {
  const body = bodyOf(strongOf(f))
  const policy = { ...structuredClone(body), id: 'tenant-strong-1', state, createdDateTime: '2026-01-01T00:00:00Z' }
  edit(policy)
  const snapshot = structuredClone(f.snapshot)
  ;(snapshot.config.caPolicies!.rows as unknown[]).push(policy)
  return { ...f, snapshot }
}
/** The validation context generate builds, for the tenant as it stands. */
const ctxOf = (f: Fixture) => buildContext({ snapshot: f.snapshot, state: f.mapping, groupMembers: [...f.groups].map(([groupId, g]) => ({ groupId, ...g })) as never, drillRecords: [] })
const outcomeOf = (f: Fixture, id: string, rule: string): string => evaluateSubject('breakGlass', id, ctxOf(f)).find((r) => r.id === rule)!.outcome
/** The exclusions group the plan uses, read off the step's own resolution before its policy exists. */
const exclusionsGroupOf = (f: Fixture): string => {
  const groupId = strongOf(f).action.resolution?.tenant.exclusionsGroupId ?? null
  assert.ok(groupId, 'the premise: the settled demo has its exclusions group')
  return groupId
}
const groupOutcome = (f: Fixture, groupId: string): string => {
  const ctx = ctxOf(f)
  const entry = ctx.groupMembers.find((g) => g.groupId.toLowerCase() === groupId.toLowerCase())
  return evaluateSubject('exclusionGroup', entry, ctx).find((r) => r.id === 'xg.usedConsistently')!.outcome
}

test('BreakGlass: the interpretation reads Jon’s two emergency accounts, the pin carries both on that one policy, and the goal map holds it under its own goal', () => {
  const read = readInterpretation(interpretation)
  const strong = read.references.find((r) => r.id === JON_STRONG)
  const other = read.references.find((r) => r.id === JON_OTHER)
  assert.equal(strong?.meaning, 'emergencyStrongAccount')
  assert.equal(strong?.kind, 'user')
  assert.deepEqual(strong?.includedIn, [POLICY_ID])
  assert.equal(other?.meaning, 'emergencyOtherAccount')
  assert.deepEqual(other?.excludedFrom, [POLICY_ID])
  for (const r of [strong!, other!]) assert.equal(r.classification, 'knownSemantic')
  const policies = pinned.policies as unknown as { id: string | null; placeholders: Record<string, string> }[]
  const own = policies.find((p) => p.id === POLICY_ID)!.placeholders
  assert.equal(own[JON_STRONG], 'emergencyStrongAccount')
  assert.equal(own[JON_OTHER], 'emergencyOtherAccount')
  assert.equal(own[JON_LOCATION], 'trustedLocation')
  assert.equal(own[JON_STRENGTH], 'strength')
  assert.deepEqual(policies.filter((p) => Object.values(p.placeholders).some((t) => t.startsWith('emergency'))).map((p) => p.id), [POLICY_ID], 'no other policy carries an emergency account token')
  assert.deepEqual(PINNED_GOAL_MAP[EMERGENCY_STRONG_GOAL], [POLICY_ID])
  assert.equal(Object.entries(PINNED_GOAL_MAP).filter(([, keys]) => keys.includes(POLICY_ID)).length, 1, 'its own goal’s and no other’s')
})

test('BreakGlass: Decide How and Where People Sign In asks which emergency account must use its security key — optional, one account, only the saved emergency accounts, nothing suggested; left empty, only this step waits', () => {
  const f = settled()
  const run = runFixture(f)
  const d3 = stepOf(run.steps, DIRECTION_STEP.devices)
  const q = d3.directionQuestions!.find((x) => x.key === 'emergencyStrong')
  assert.ok(q, 'the question is on Decide How and Where People Sign In')
  assert.equal(q.label, 'Which emergency account must use its security key?')
  assert.equal(q.control, 'accounts')
  assert.equal(q.optional, true)
  assert.equal(q.pickOne, true)
  assert.deepEqual(q.suggested, { value: 'some', picked: [] }, 'nothing is suggested')
  assert.equal(q.evidence, '')
  assert.equal(q.saved, null)
  assert.equal(directionComplete(d3.directionQuestions ?? []), true, 'left empty, the Direction step is still settled')
  // Exactly one: two picked is not an answer to approve.
  const [a, b] = f.mapping.breakGlassUserIds
  assert.equal(directionAnswerComplete(q, { value: 'some', picked: [a] }), true)
  assert.equal(directionAnswerComplete(q, { value: 'some', picked: [a, b] }), false)
  // Unanswered, only this step waits on the answer; nothing else does.
  const s = stepOf(run.steps, EMERGENCY_STRONG_STEP)
  assert.ok(s.blockers.some((x) => x.kind === 'decision' && x.label === WAIT), JSON.stringify(s.blockers))
  for (const other of run.steps.filter((x) => x.id !== EMERGENCY_STRONG_STEP)) {
    assert.equal(other.blockers.some((x) => x.kind === 'decision' && x.label === WAIT), false, `${other.id} never waits on the emergency account answer`)
  }
})

test('BreakGlass: unanswered, the step hands over nothing and 3.8 does not create it', () => {
  const run = runFixture(settled())
  const s = stepOf(run.steps, EMERGENCY_STRONG_STEP)
  assert.equal(s.kind, 'create')
  assert.deepEqual(s.action.missing, [{ token: EMERGENCY_STRONG_SLOT, stepId: DIRECTION_STEP.devices }])
  assert.equal(s.action.json, null, 'no body while the account is not named')
  assert.equal(JSON.stringify(s.action).toLowerCase().includes(JON_STRONG), false)
  assert.equal(JSON.stringify(s.action).toLowerCase().includes(JON_OTHER), false)
  assert.equal(stepOf(run.steps, 's-create-report-only').reportOnlyBatch?.create.includes(EMERGENCY_STRONG_STEP), false)
})

test('BreakGlass: named, it is created in Report-only through 3.8, including that one account and nobody else, excluding no account and not the exclusions group, outside the office, with the strength 3.5 made', () => {
  const f = settled()
  const [chosen, other] = f.mapping.breakGlassUserIds
  const g = named(f, [chosen])
  assert.equal(g.mapping.emergencyStrongAccountId, chosen)
  assert.deepEqual(savedAnswerOf('emergencyStrong', g.mapping), { value: 'some', picked: [chosen] })
  const run = runFixture(g)
  const s = stepOf(run.steps, EMERGENCY_STRONG_STEP)
  assert.equal(s.kind, 'create')
  assert.deepEqual(s.action.missing ?? [], [])
  const body = bodyOf(s)
  assert.equal(body.displayName, POLICY)
  assert.equal(body.state, 'enabledForReportingButNotEnforced')
  const users = body.conditions.users as Users
  assert.deepEqual(users.includeUsers, [chosen], 'the chosen account and nobody else')
  assert.deepEqual(users.includeGroups ?? [], [])
  assert.deepEqual(users.includeRoles ?? [], [])
  assert.deepEqual(users.excludeUsers ?? [], [], 'no account excluded by name')
  const exclusions = s.action.resolution?.tenant.exclusionsGroupId
  assert.ok(exclusions, 'the premise: the settled demo has its exclusions group')
  assert.deepEqual(users.excludeGroups ?? [], [], 'never the exclusions group: it holds the account the policy is for')
  assert.equal(JSON.stringify(body).toLowerCase().includes(other.toLowerCase()), false, 'the other emergency account is named nowhere')
  assert.deepEqual(body.conditions.locations, { excludeLocations: [HEAD_OFFICE], includeLocations: ['All'] }, 'everywhere but the office the operator named')
  const strength = body.grantControls.authenticationStrength?.id as string
  assert.ok(strength && strength.toLowerCase() !== JON_STRENGTH)
  assert.equal(((g.snapshot.config.authStrengths?.rows ?? []) as { id?: string; displayName?: string }[]).find((x) => x.id === strength)?.displayName, 'Modern MFA + TAP')
  assert.deepEqual(body.grantControls.builtInControls, [], 'a strength, never a block')
  for (const id of [JON_STRONG, JON_OTHER, JON_LOCATION, JON_STRENGTH]) assert.equal(JSON.stringify(body).toLowerCase().includes(id), false, `${id} is the author’s own`)
  // Its own exposure is accepted: it reaches the chosen account on purpose, and no other.
  assert.equal(s.action.emergencyExposure, undefined, JSON.stringify(s.action.emergencyExposure))
  assert.ok(stepOf(run.steps, 's-create-report-only').reportOnlyBatch?.create.includes(EMERGENCY_STRONG_STEP), '3.8 creates it in Report-only')
  assert.equal(stepById[EMERGENCY_STRONG_GOAL].title, 'Require a Security Key for One Emergency Account Outside the Office')
  assert.equal(s.plainTitle, 'Require a Security Key for One Emergency Account Outside the Office')
})

test('BreakGlass: with everyone remote the words say everywhere and the body has no location condition (include All, exclude none)', () => {
  const g = named(settled('remote'), [settled('remote').mapping.breakGlassUserIds[0]])
  const s = strongOf(g)
  assert.equal(s.plainTitle, 'Require a Security Key for One Emergency Account Everywhere')
  assert.match(String((s.guidance as { why?: string } | undefined)?.why), /wherever it signs in/)
  const body = bodyOf(s)
  assert.deepEqual(body.conditions.locations?.includeLocations ?? ['All'], ['All'])
  assert.deepEqual(body.conditions.locations?.excludeLocations ?? [], [], 'no office to carve out')
  assert.deepEqual(s.action.missing ?? [], [], 'nothing waits on a trusted location that does not exist')
  // The question's own line says so too.
  const q = stepOf(runFixture(g).steps, DIRECTION_STEP.devices).directionQuestions!.find((x) => x.key === 'emergencyStrong')!
  assert.match(q.chosen?.some ?? '', /everywhere/)
})

test('BreakGlass: with fewer than two emergency accounts it does not apply, says why, and the question is not asked', () => {
  const f = settled()
  const one: Fixture = { ...f, mapping: { ...f.mapping, breakGlassUserIds: f.mapping.breakGlassUserIds.slice(0, 1), emergencyStrongAccountId: f.mapping.breakGlassUserIds[0] } }
  const run = runFixture(one)
  const s = stepOf(run.steps, EMERGENCY_STRONG_STEP)
  assert.equal(s.doesntApply, stepById[EMERGENCY_STRONG_GOAL].oneAccount)
  assert.match(s.doesntApply ?? '', /excluded from every policy/)
  assert.equal(s.state.setAside, true)
  assert.equal(stepOf(run.steps, DIRECTION_STEP.devices).directionQuestions!.some((q) => q.key === 'emergencyStrong'), false)
  assert.equal(emergencyStrongAccountOf(one.mapping), null, 'a saved id is no answer with one emergency account')
})

test('BreakGlass: only an operator’s Save names the account — one of the saved emergency accounts, exactly one — and a plan file keeps it only while it is one of them', () => {
  const f = settled()
  const [a, b] = f.mapping.breakGlassUserIds
  assert.equal(named(f, [a], 'detected').mapping.emergencyStrongAccountId, undefined, 'a detection names nobody')
  assert.equal(named(f, [a, b]).mapping.emergencyStrongAccountId, undefined, 'two is no answer')
  assert.equal(named(f, ['00000000-0000-4000-8000-00000000dead']).mapping.emergencyStrongAccountId, undefined, 'never an account that is not an emergency account')
  assert.equal(named(f, [a.toUpperCase()]).mapping.emergencyStrongAccountId, a)
  assert.equal(applyStepDecisions(named(f, [a]).mapping, { [EMERGENCY_STRONG_STORAGE]: { picked: [], at: f.snapshot.asOf } }).emergencyStrongAccountId, undefined, 'none picked takes it back')
  const snapshot = f.snapshot
  const file = (mappings: Record<string, unknown>) => buildPlanFile({ planId: 'strong-plan', snapshot, operator: { userId: 'u-1', userPrincipalName: 'alex@example.com' }, baselineSource: { kind: 'upload', fileName: 'synthetic.json' }, mapping: { ...emptyMappingState(snapshot.tenantId), ...mappings } as never, steps: [], checkpoints: [] })
  assert.equal(parsePlanFile(JSON.stringify(file({ breakGlassUserIds: [a, b], emergencyStrongAccountId: a }))).plan?.mappings.emergencyStrongAccountId, a)
  assert.equal(parsePlanFile(JSON.stringify(file({ breakGlassUserIds: [b], emergencyStrongAccountId: a }))).plan?.mappings.emergencyStrongAccountId, undefined, 'not one of its emergency accounts: ignored')
  const broken = { ...file({ breakGlassUserIds: [a, b] }), mappings: { ...file({ breakGlassUserIds: [a, b] }).mappings, emergencyStrongAccountId: 7 } }
  assert.match(parsePlanFile(JSON.stringify(broken)).error ?? '', /invalid emergency account/)
})

test('BreakGlass: the turn-on is held on each gate — the account’s method, its recorded drill sign-in, the other account excluded everywhere else — and on anything unread; all three met, nothing holds it', () => {
  const f = named(settled(), [settled().mapping.breakGlassUserIds[0]])
  const [chosen, other] = f.mapping.breakGlassUserIds
  /** The step as it would be once its report-only window closed, so only the gates hold the turn-on. */
  const turnOn = (s: Step) => policyResult({ ...s, state: { ...s.state, lifecycle: 'ready-to-enforce' } } as never)
  const waitsOf = (s: Step): string[] => (s.action.enforceWaitsOn ?? []).map((w) => w.id)

  // Created, not yet drilled: held on Verify Emergency Access alone.
  const created = deployed(f)
  const noDrill = strongOf(created)
  assert.deepEqual(noDrill.emergencyStrongGates, { accountId: chosen, method: true, drilled: false, otherExcluded: true })
  assert.deepEqual(waitsOf(noDrill), [DRILL_PREREQUISITE])
  assert.ok(operationsOf(noDrill).some(enforcesOnRun), 'the premise: the next operation turns it on')
  assert.deepEqual([turnOn(noDrill).kind, (turnOn(noDrill) as { hold?: string }).hold], ['held', 'prerequisite-unmet'])

  // Every gate met: nothing holds it.
  const ready = withRecoveryTested(created)
  const met = strongOf(ready)
  assert.deepEqual(met.emergencyStrongGates, { accountId: chosen, method: true, drilled: true, otherExcluded: true })
  assert.equal(met.action.enforceWaitsOn, undefined)
  assert.equal(turnOn(met).kind, 'implementable', 'all three met, the turn-on is offered')

  // (i) No phishing-resistant method of its own — only a Temporary Access Pass the strength also takes: held.
  {
    const snapshot = structuredClone(ready.snapshot)
    snapshot.authMethods[chosen] = [{ kind: 'temporaryAccessPass' }] as never
    snapshot.registrationDetails = snapshot.registrationDetails.map((r) => (r.id === chosen ? { ...r, methodsRegistered: ['temporaryAccessPass'] } : r))
    const s = strongOf({ ...ready, snapshot })
    assert.equal(s.emergencyStrongGates?.method, false)
    assert.ok(waitsOf(s).includes(BREAK_GLASS_STEP_ID), JSON.stringify(s.action.enforceWaitsOn))
    assert.notEqual(turnOn(s).kind, 'implementable')
  }
  // (i) Its methods unread: unknown holds.
  {
    const snapshot = structuredClone(ready.snapshot)
    snapshot.authMethods[chosen] = 'unknown' as never
    const s = strongOf({ ...ready, snapshot })
    assert.equal(s.emergencyStrongGates?.method, null)
    assert.ok(waitsOf(s).includes(BREAK_GLASS_STEP_ID))
    assert.notEqual(turnOn(s).kind, 'implementable')
  }
  // (iii) Another policy that does not exclude the exclusions group: the other account is not excluded everywhere.
  {
    const snapshot = structuredClone(ready.snapshot)
    ;(snapshot.config.caPolicies!.rows as unknown[]).push({ id: 'loose-1', displayName: 'Loose policy', state: 'enabledForReportingButNotEnforced', conditions: { users: { includeUsers: ['All'], excludeGroups: [] }, applications: { includeApplications: ['All'] } }, grantControls: { operator: 'OR', builtInControls: ['mfa'] } })
    const s = strongOf({ ...ready, snapshot })
    assert.equal(s.emergencyStrongGates?.otherExcluded, false)
    assert.ok(waitsOf(s).includes(EXCLUSION_GROUP_STEP_ID))
    assert.notEqual(turnOn(s).kind, 'implementable')
  }
  // (iii) The other account taken out of the exclusions group: held.
  {
    const groups = new Map([...ready.groups].map(([id, g]) => [id, { ...g, memberIds: g.memberIds.filter((m) => m !== other) }]))
    const s = strongOf({ ...ready, groups })
    assert.equal(s.emergencyStrongGates?.otherExcluded, false)
    assert.notEqual(turnOn(s).kind, 'implementable')
  }
  // (iii) The exclusions group's members unread: unknown holds.
  {
    const groups = new Map([...ready.groups].map(([id, g]) => [id, { ...g, memberIds: g.memberIds.filter((m) => m !== other), sampled: true }]))
    const s = strongOf({ ...ready, groups })
    assert.notEqual(s.emergencyStrongGates?.otherExcluded, true)
    assert.notEqual(turnOn(s).kind, 'implementable')
  }
})

test('BreakGlass: every emergency reading accepts exactly this policy reaching exactly the chosen account, and flags it the moment it reaches the other account or anyone else, or is not the step’s own', () => {
  const f = named(settled(), [settled().mapping.breakGlassUserIds[0]])
  const [chosen, other] = f.mapping.breakGlassUserIds
  // Without the policy, both accounts are excluded everywhere and the exclusions group is used consistently: the premise.
  assert.equal(outcomeOf(f, chosen, 'bg.excludedFromAllPolicies'), 'pass')
  assert.equal(outcomeOf(f, other, 'bg.excludedFromAllPolicies'), 'pass')
  const group = exclusionsGroupOf(f)
  assert.equal(groupOutcome(f, group), 'pass')
  const before = automaticRecoveryPreparationStates(f.snapshot, f.mapping, f.groups)

  // The step's own policy, On and in Report-only: accepted by every reading.
  for (const state of ['enabled', 'enabledForReportingButNotEnforced']) {
    const on = deployed(f, state)
    for (const id of [chosen, other]) {
      assert.equal(outcomeOf(on, id, 'bg.excludedFromAllPolicies'), 'pass', `${state}: ${id}`)
      assert.equal(outcomeOf(on, id, 'bg.excludedFromReportOnly'), 'pass', `${state}: ${id}`)
    }
    assert.equal(groupOutcome(on, group), 'pass', `${state}: Configure Emergency Exclusions never asks to add the group to it`)
    assert.deepEqual(automaticRecoveryPreparationStates(on.snapshot, on.mapping, on.groups), before, `${state}: the drill's preparation reads the same`)
    const run = runFixture(on)
    assert.equal(stepOf(run.steps, EXCLUSION_GROUP_STEP_ID).configurationFindings?.find((x) => x.key === 'group-policies')?.items?.some((i) => i.subjectId === 'tenant-strong-1'), false, 'not on Configure Emergency Exclusions’ list')
    assert.equal(stepOf(run.steps, EMERGENCY_STRONG_STEP).action.emergencyExposure, undefined)
  }

  // Flagged: the same policy reaching the other account too.
  const both = deployed(f, 'enabled', (p) => { p.conditions.users.includeUsers = [chosen, other] })
  assert.equal(outcomeOf(both, other, 'bg.excludedFromAllPolicies'), 'fail')
  assert.equal(outcomeOf(both, chosen, 'bg.excludedFromAllPolicies'), 'fail')
  assert.equal(groupOutcome(both, group), 'fail')
  // Flagged: reaching the other account instead.
  const swapped = deployed(f, 'enabled', (p) => { p.conditions.users.includeUsers = [other] })
  assert.equal(outcomeOf(swapped, other, 'bg.excludedFromAllPolicies'), 'fail')
  assert.equal(groupOutcome(swapped, group), 'fail')
  // Flagged: reaching anyone else as well, by group or by All.
  const widened = deployed(f, 'enabled', (p) => { p.conditions.users.includeGroups = ['00000000-0000-4000-8000-0000000000aa'] })
  assert.equal(outcomeOf(widened, chosen, 'bg.excludedFromAllPolicies'), 'fail')
  const everyone = deployed(f, 'enabled', (p) => { p.conditions.users.includeUsers = ['All'] })
  assert.equal(outcomeOf(everyone, other, 'bg.excludedFromAllPolicies'), 'fail')
  // Flagged: a block, or a grant that is not the strength alone.
  const block = deployed(f, 'enabled', (p) => { p.grantControls = { operator: 'OR', builtInControls: ['block'] } })
  assert.equal(outcomeOf(block, chosen, 'bg.excludedFromAllPolicies'), 'fail')
  // Flagged: the same shape that is not the step's own (no tag, another name).
  const stranger = deployed(f, 'enabled', (p) => { p.displayName = 'Somebody else’s policy'; p.description = '' })
  assert.equal(outcomeOf(stranger, chosen, 'bg.excludedFromAllPolicies'), 'fail')
  assert.equal(groupOutcome(stranger, group), 'fail')
  // Flagged: the operator's answer taken back — nothing is accepted any more.
  const unnamed = { ...deployed(f, 'enabled'), mapping: { ...f.mapping, emergencyStrongAccountId: undefined } }
  assert.equal(outcomeOf(unnamed, chosen, 'bg.excludedFromAllPolicies'), 'fail')

  // The step's own exposure: the chosen account through its own shape only.
  assert.equal(acceptedOwnExposure({ reached: [chosen], unproven: [] }, [{ conditions: { users: { includeUsers: [chosen] } }, grantControls: { builtInControls: [], authenticationStrength: { id: 's' } } }], chosen), null)
  assert.deepEqual(acceptedOwnExposure({ reached: [chosen, other], unproven: [] }, [{ conditions: { users: { includeUsers: [chosen, other] } }, grantControls: { builtInControls: [], authenticationStrength: { id: 's' } } }], chosen), { reached: [chosen, other], unproven: [] }, 'a body reaching the other account accepts nothing')
  assert.deepEqual(acceptedOwnExposure({ reached: [chosen], unproven: [] }, [{ conditions: { users: { includeUsers: [chosen] } }, grantControls: { builtInControls: ['block'] } }], chosen), { reached: [chosen], unproven: [] }, 'a block is never accepted')
  assert.deepEqual(acceptedOwnExposure({ reached: [chosen], unproven: [] }, [{ conditions: { users: { includeUsers: [chosen] } }, grantControls: { builtInControls: [], authenticationStrength: { id: 's' } } }], null), { reached: [chosen], unproven: [] }, 'no chosen account accepts nothing')
  assert.equal(emergencyStrongShape({ conditions: { users: { includeUsers: [chosen], includeGuestsOrExternalUsers: { guestOrExternalUserTypes: 'b2bCollaborationGuest' } } }, grantControls: { builtInControls: [], authenticationStrength: { id: 's' } } }, chosen), false, 'nobody else, guests included')
  // Nothing else the account must satisfy (audit, 2026-10-05): terms of use, a custom control, or a session control that is on.
  const only = { conditions: { users: { includeUsers: [chosen] } }, grantControls: { builtInControls: [], authenticationStrength: { id: 's' } } }
  assert.equal(emergencyStrongShape(only, chosen), true, 'the premise: the strength alone is accepted')
  assert.equal(emergencyStrongShape({ ...only, sessionControls: null }, chosen), true, 'no session controls')
  assert.equal(emergencyStrongShape({ ...only, sessionControls: { signInFrequency: { isEnabled: false }, disableResilienceDefaults: false } }, chosen), true, 'session controls that are off')
  assert.equal(emergencyStrongShape({ ...only, grantControls: { ...only.grantControls, termsOfUse: ['tou-1'] } }, chosen), false, 'terms of use')
  assert.equal(emergencyStrongShape({ ...only, grantControls: { ...only.grantControls, customAuthenticationFactors: ['x'] } }, chosen), false, 'a custom control')
  assert.equal(emergencyStrongShape({ ...only, sessionControls: { signInFrequency: { isEnabled: true, type: 'hours', value: 1 } } }, chosen), false, 'a sign-in frequency that is on')
  assert.equal(emergencyStrongShape({ ...only, sessionControls: { continuousAccessEvaluation: { mode: 'strictLocation' } } }, chosen), false, 'an unknown session control reads as on')
})

test('BreakGlass: the other emergency account stays excluded from every policy — this one included, which never reaches it — on every fixture and answer', () => {
  for (const office of ['office', 'remote'] as const) {
    const base = settled(office)
    for (const chosen of base.mapping.breakGlassUserIds) {
      const f = named(base, [chosen])
      const others = f.mapping.breakGlassUserIds.filter((id) => id !== chosen)
      const s = strongOf(f)
      const body = bodyOf(s)
      for (const other of others) {
        assert.equal(JSON.stringify(body.conditions.users).toLowerCase().includes(other.toLowerCase()), false, `${office}: ${other} is not in its scope`)
        assert.equal(acceptedEmergencyStrongPolicy(f.snapshot.tenantId, f.mapping)({ ...body, conditions: { ...body.conditions, users: { includeUsers: [other] } } }), false, 'reaching the other account is never accepted')
      }
      // Every other policy the plan writes excludes the exclusions group, which holds the other account.
      const run = runFixture(deployed(f, 'enabled'))
      const groupId = s.action.resolution?.tenant.exclusionsGroupId!
      assert.ok(f.groups.get(groupId)?.memberIds.includes(others[0]), 'the premise: the other account is in the exclusions group')
      for (const step of run.steps) {
        if (step.id === EMERGENCY_STRONG_STEP) continue
        for (const op of step.action.resolution?.policies ?? []) {
          const users = ((op.mode === 'update' ? op.target : op.body)?.conditions as { users?: Users } | undefined)?.users
          // A policy that reaches no person (agents, workload identities) takes no exclusions group.
          if (!users || (users.includeUsers ?? []).filter((u) => u !== 'None').length + (users.includeGroups ?? []).length + (users.includeRoles ?? []).length === 0) continue
          assert.ok((users.excludeGroups ?? []).some((g) => g.toLowerCase() === groupId.toLowerCase()), `${step.id} excludes the exclusions group`)
          assert.equal((users.includeUsers ?? []).some((u) => others.includes(u)), false, `${step.id} never names the other account`)
        }
      }
      // And the tenant's own policies, read by the one rule, all exclude it but this one, which is not on the list.
      const needing = exclusionsGroupPolicies({ policies: run.input.snapshot.config.caPolicies!.rows, groupId, accountIds: others, activeRoles: f.snapshot.roles.active, membersOf: groupLookup(f.groups), accepted: acceptedEmergencyStrongPolicy(f.snapshot.tenantId, f.mapping) })
      assert.ok(needing.every((p) => p.outcome === 'pass'), JSON.stringify(needing.filter((p) => p.outcome !== 'pass')))
      assert.equal(needing.some((p) => p.id === 'tenant-strong-1'), false)
    }
  }
})

test('BreakGlass: rollback is back to Report-only, and In the baseline, not in this plan no longer lists the policy, answered or not', () => {
  assert.match(stepById[EMERGENCY_STRONG_GOAL].ifWrong ?? '', /back to Report-only/)
  const f = settled()
  for (const g of [f, named(f, [f.mapping.breakGlassUserIds[0]])]) {
    const r = runFixture(g)
    const rows = notInPlanRows(pinnedPackage().policies, r.steps, r.coverage, goalMapInUse(PINNED_GOAL_MAP, g.snapshot))
    assert.equal(rows.some((x) => x.policy === POLICY), false, JSON.stringify(rows.map((x) => x.policy)))
  }
  // The footer's emergency reason is gone with it.
  assert.equal(JSON.stringify(stepById).includes('Requires a strong sign-in from one emergency account'), false)
})

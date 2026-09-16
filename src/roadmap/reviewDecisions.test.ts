import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readyEvidence } from './fixtures/readyEvidence.ts'
import { fixture } from './fixtures/index.ts'
import { runFixture } from './fixtures/run.ts'
import { addWorkflowSteps, WORKFLOW_STEP } from './workflows.ts'
import { applyStepDecisions } from './decisions.ts'
import { DEVICE_ANSWER_KEYS, QUESTION_STEP, devicePlanOf, devicePlanComplete } from './answers.ts'
import { manualBasis, applyManualReviews, MANUAL_REVIEW_ID } from './manualWork.ts'
import type { Step } from './types.ts'
import { assumedAbsentSourceGroups } from './sourceMappings.ts'
import { resolveTenantPolicy } from './resolvePolicy.ts'
import { buildCreateAction } from './generate.ts'

test('service defaults propose detected use without confirming and preserve incomplete evidence', () => {
  const f = fixture('demo')
  f.mapping.workflowAnswers = {}; f.mapping.facetOverrides = {}; delete f.mapping.workflowConfirmedAt
  const steps: Step[] = []
  addWorkflowSteps(steps, [], f.snapshot, f.mapping, {}, ['mobile-app-protection'])
  const service = steps.find(s => s.id === WORKFLOW_STEP)!
  assert.ok(service.workflowChoices!.some(c => c.key === 'intune' && c.answer === 'no'), 'licence alone does not approve use')
  assert.equal(service.state.satisfied, false, 'defaults still need Save')
  const source = [{ name: 'IAC - APP - SharePoint', json: {}, reason: 'unmapped' }] as never
  const known: Step[] = []
  addWorkflowSteps(known, source, f.snapshot, f.mapping)
  assert.equal(known[0].workflowChoices![0].answer, 'yes')
  f.snapshot.sources.appSignInSummary.status = 'error'
  const unread: Step[] = []
  addWorkflowSteps(unread, source, f.snapshot, f.mapping)
  assert.equal(unread[0].workflowChoices![0].answer, 'unsure')
})

test('a saved No contradicted by new use needs review; acknowledging that evidence stops repeated churn', () => {
  const f = fixture('demo')
  f.mapping.workflowAnswers = { sharepoint: 'no' }; f.mapping.facetOverrides = {}; f.mapping.workflowConfirmedAt = f.snapshot.asOf
  const source = [{ name: 'SharePoint', json: {}, reason: 'unmapped' }] as never
  const steps: Step[] = []; addWorkflowSteps(steps, source, f.snapshot, f.mapping)
  assert.equal(steps[0].workflowChoices![0].needsReview, true)
  assert.equal(steps[0].workflowChoices![0].answer, 'no', 'saved choice remains visible')
  const mapping = applyStepDecisions(f.mapping, { [WORKFLOW_STEP]: { at: f.snapshot.asOf, answers: { sharepoint: 'no', 'evidence:sharepoint': 'present' } } })
  const again: Step[] = []; addWorkflowSteps(again, source, f.snapshot, mapping)
  assert.equal(again[0].state.satisfied, true)
})

test('split device choices distinguish registered, app-protected and blocked phones', () => {
  const f = fixture('demo')
  const mapping = applyStepDecisions(f.mapping, { [QUESTION_STEP.devices]: { at: f.snapshot.asOf, answers: { [DEVICE_ANSWER_KEYS.phoneManagement]: 'registered', [DEVICE_ANSWER_KEYS.phoneAppProtection]: 'required', [DEVICE_ANSWER_KEYS.computers]: 'hybrid' } } })
  const plan = devicePlanOf(mapping)!
  assert.equal(devicePlanComplete(plan), true)
  assert.equal(plan.phoneManagement, 'registered')
  assert.equal(plan.phoneAppProtection, 'required')
  assert.equal(plan.noWorkPhones, false)
})

test('retained foundational rows re-evaluate and dormant Keep requires a reason', () => {
  const f = fixture('demo')
  const first = runFixture(f)
  const dormant = first.steps.find(s => s.id === 's-check-dormant-accounts')!
  assert.ok(dormant.dormantChoices)
  const outcomes = Object.fromEntries(dormant.dormantChoices!.flatMap(c => [[`outcome:${c.id}`, 'keep'], [`reason:${c.id}`, 'Reserved operational account']]))
  const mapping = applyStepDecisions(f.mapping, { [dormant.id]: { at: f.snapshot.asOf, answers: outcomes } })
  const after = runFixture({ ...f, mapping })
  assert.equal(after.steps.find(s => s.id === dormant.id)?.state.satisfied, true)
  assert.ok(after.steps.some(s => s.id === 's-prereq-security-defaults'), 'disabled Security Defaults remains discoverable')
  assert.ok(!after.steps.some(s => /s-review-baseline-iac-agent-block/.test(s.id)))
  if (dormant.dormantChoices!.length) {
    outcomes[`reason:${dormant.dormantChoices![0].id}`] = ''
    const invalid = applyStepDecisions(f.mapping, { [dormant.id]: { at: f.snapshot.asOf, answers: outcomes } })
    assert.equal(runFixture({ ...f, mapping: invalid }).steps.find(s => s.id === dormant.id)?.state.satisfied, false)
  }
})

test('a mail-device follow-up ignores unrelated policy edits', () => {
  const f = fixture('demo-week2')
  const step = { id: 's-question-mail-devices', population: { ids: [...f.mapping.serviceAccountUserIds] } } as Step
  const before = manualBasis(step, f.snapshot, f.mapping)
  f.snapshot.config.caPolicies.rows.push({ id: 'unrelated', state: 'enabled', conditions: { clientAppTypes: ['browser'] }, grantControls: { builtInControls: ['mfa'] } })
  assert.equal(manualBasis(step, f.snapshot, f.mapping), before)
  f.snapshot.config.caPolicies.rows.push({ id: 'legacy', state: 'enabled', conditions: { users: { includeUsers: ['All'] }, clientAppTypes: ['other'] }, grantControls: { builtInControls: ['block'] } })
  assert.notEqual(manualBasis(step, f.snapshot, f.mapping), before)
})

test('source assumptions omit optional exclusions, never AVD allowed users, include targets or documented emergency group', () => {
  const group = '62d67e66-2bc9-43cd-b00c-6326dae53d18'
  const emergency = '5628ad67-f9d1-4495-abe3-99dc8f9074f1'
  const policy = { displayName: 'Example', conditions: { users: { includeUsers: ['All'], excludeGroups: [group, emergency] } } }
  assert.deepEqual(assumedAbsentSourceGroups(policy, [policy]), [group])
  assert.deepEqual(assumedAbsentSourceGroups({ ...policy, displayName: 'IAC - APP - BLOCK - AVD - Exclude - AllowedAVDUsers' }, [policy]), [])
  assert.deepEqual(assumedAbsentSourceGroups(policy, [policy, { conditions: { users: { includeGroups: [group] } } }]), [])
})

test('updating a source with an assumed absent group preserves actual tenant exclusions', () => {
  const f = fixture('demo')
  const source = { id: 'source', displayName: 'Example', state: 'enabled', conditions: { users: { includeUsers: ['All'], excludeGroups: ['62d67e66-2bc9-43cd-b00c-6326dae53d18'] }, applications: { includeApplications: ['All'] } }, grantControls: { operator: 'OR', builtInControls: ['mfa'] } }
  const resolved = resolveTenantPolicy(source, { exclusionsGroupId: 'emergency', serviceAccountsGroupId: null, allowedCountriesLocationId: null }, 'mfa-all-users', [source] as never)
  const action = buildCreateAction([{ sourceName: source.displayName, resolved, target: { policyId: 'tenant-policy', state: 'enabled', policy: { ...source, conditions: { ...source.conditions, users: { includeUsers: ['All'], excludeGroups: ['actual-tenant-exception'], excludeUsers: ['actual-user-exception'] } } } } }], f.mapping, 'plan', 'step', 'mfa-all-users', { sections: new Set(['users']) })
  const body = action.resolution!.policies[0].body as { conditions: { users: { excludeGroups: string[]; excludeUsers: string[] } } }
  assert.ok(body.conditions.users.excludeGroups.includes('actual-tenant-exception'))
  assert.ok(body.conditions.users.excludeUsers.includes('actual-user-exception'))
})

test('MFA preparation requires every suitable registration but not a recent proof from every person', () => {
  const f = fixture('demo-week2')
  const initial = runFixture(f)
  const viability = structuredClone(initial.viability)
  for (const v of viability) {
    v.mfaCapable = true
    v.readiness.methods = ['passkey']
    v.readiness.qualifying = ['passkey']
    v.readiness.proof = []
    v.readiness.state = 'needsProof'
  }
  readyEvidence(f, f.snapshot)
  const ready = runFixture(f, { viability }).steps.find(s => s.id === 's-verify-mfa')!
  assert.ok(ready.preparation!.ids.length > 0)
  assert.equal(ready.state.satisfied, true, 'registered quiet users do not hold preparation open')
  const admin = viability.find(v => v.isAdmin && ready.preparation!.ids.includes(v.userId))!
  assert.ok(admin)
  admin.readiness.qualifying = []
  f.snapshot.registrationDetails.find(row => row.id === admin.userId)!.methodsRegistered = ['mobilePhone']
  const missing = runFixture(f, { viability }).steps.find(s => s.id === 's-verify-mfa')!
  assert.equal(missing.state.satisfied, false, 'one administrator lacking their stronger method is not rounded away')
  assert.ok(missing.preparation!.missingIds.includes(admin.userId))
})

test('migrationComplete does not prove legacy per-user MFA is disabled; manual review is shared across aliases', () => {
  const f = fixture('demo-week2')
  const row = runFixture(f).steps.find(s => s.id === 's-prereq-per-user-mfa')!
  assert.ok(row)
  assert.equal(row.state.satisfied, false)
  assert.equal(row.manualReview?.readyToConfirm, true)
  const alias = { ...structuredClone(row), id: 's-ladder-per-user-mfa-cleanup' }
  assert.equal(manualBasis(row, f.snapshot, f.mapping), manualBasis(alias, f.snapshot, f.mapping))
  applyManualReviews([row], f.snapshot, { [alias.id]: { [MANUAL_REVIEW_ID]: { basis: manualBasis(alias, f.snapshot, f.mapping), at: '2026-01-01T00:00:00Z' } } }, f.mapping)
  assert.equal(row.state.satisfied, true)
})


test('saved no-service and deleted shared-account choices remain visible without claiming protection', () => {
  const f = fixture('demo')
  f.mapping.serviceAccountUserIds = []
  f.mapping.wizardAnswered.serviceAccounts = true
  f.mapping.sharedDeviceUserIds = ['deleted-shared-identity']
  const result = runFixture(f)
  for (const id of ['s-prereq-service-accounts-group', 's-shared-devices']) {
    const step = result.steps.find(s => s.id === id)
    assert.ok(step, `${id} retained`)
    assert.equal(step.state.setAside, true)
    assert.equal(step.state.satisfied, false, 'not applicable is not configured protection')
    assert.ok(step.doesntApply)
  }
  assert.equal(result.steps.find(s => s.id === 's-shared-devices')!.population.total, 0)
})


test('unresolved allowed-AVD-user definition cannot become completed through a generic acknowledgement', () => {
  const f = fixture('demo')
  f.mapping.workflowAnswers = { avd: 'yes' }
  const source = [{ name: 'IAC - APP - BLOCK - AVD - Exclude - AllowedAVDUsers', json: { conditions: { users: { includeUsers: ['All'], excludeGroups: ['unknown'] } } }, reason: 'unmapped' }] as never
  const first: Step[] = []; addWorkflowSteps(first, source, f.snapshot, f.mapping)
  const row = first.find(s => s.id.startsWith('s-review-baseline'))!
  const next: Step[] = []; addWorkflowSteps(next, source, f.snapshot, f.mapping, { [row.id]: { [MANUAL_REVIEW_ID]: { at: f.snapshot.asOf, basis: row.manualReview?.basis ?? '' } } })
  const current = next.find(s => s.id === row.id)!
  assert.equal(current.state.satisfied, false)
  assert.equal(current.state.condition, 'blocked')
  assert.equal(current.manualReview, undefined)
  assert.ok(Array.isArray(current.guidance?.whatToDo?.steps) && current.guidance.whatToDo.steps.length > 0)
  assert.ok(current.configurationFindings?.some(f => f.key === 'avd-allowed-population'))
})

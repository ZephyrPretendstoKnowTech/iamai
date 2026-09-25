import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readyEvidence } from './fixtures/readyEvidence.ts'
import { fixture } from './fixtures/index.ts'
import { runFixture } from './fixtures/run.ts'
import { addWorkflowSteps } from './workflows.ts'
import { directionSteps } from './direction.ts'
import { DIRECTION_STEP } from './directionAnswers.ts'
import { applyStepDecisions } from './decisions.ts'
import { DEVICE_ANSWER_KEYS, QUESTION_STEP, devicePlanOf, devicePlanComplete } from './answers.ts'
import { manualBasis, MANUAL_REVIEW_ID } from './manualWork.ts'
import type { Step } from './types.ts'
import { assumedAbsentSourceGroups } from './sourceMappings.ts'
import { resolveTenantPolicy } from './resolvePolicy.ts'
import { buildCreateAction } from './generate.ts'

const useStep = (f: ReturnType<typeof fixture>, notAssessed: never[] | never, goalIds: string[] = []): Step => directionSteps({ snapshot: f.snapshot, mapping: f.mapping, notAssessed, availableGoalIds: goalIds }).find(s => s.id === DIRECTION_STEP.use)!
const service = (step: Step, key: string) => step.directionQuestions!.find(q => q.key === `service:${key}`)!

test('service defaults propose detected use without confirming, an unread service keeps its policy by default, and a saved No contradicted by new use needs review until that evidence is acknowledged', () => {
  const f = fixture('demo')
  f.mapping.workflowAnswers = {}; f.mapping.facetOverrides = {}; delete f.mapping.workflowConfirmedAt
  const licensed = useStep(f, [] as never, ['mobile-app-protection'])
  assert.equal(licensed.directionQuestions!.some(q => q.key === 'service:intune'), false, 'Intune follows the device answers, not a service question')
  assert.equal(licensed.state.satisfied, false, 'defaults still need approval')
  const source = [{ name: 'IAC - APP - SharePoint', json: {}, reason: 'unmapped' }] as never
  const known = service(useStep(f, source), 'sharepoint')
  assert.equal(known.suggested.value, 'yes')
  assert.equal(known.saved, null, 'a suggestion is not an answer')
  f.snapshot.sources.appSignInSummary.status = 'error'
  const unread = service(useStep(f, source), 'sharepoint')
  assert.equal(unread.suggested.value, 'yes')
  // The app summary unread, the sign-in records read whole say what they show.
  assert.equal(unread.evidence, 'No SharePoint and OneDrive sign-ins in the last 30 days.')

  // A saved No contradicted by new use needs review; acknowledging that evidence stops repeated churn.
  {
    const f = fixture('demo')
    f.mapping.workflowAnswers = { sharepoint: 'no' }; f.mapping.facetOverrides = {}; f.mapping.workflowConfirmedAt = f.snapshot.asOf
    const source = [{ name: 'SharePoint', json: {}, reason: 'unmapped' }] as never
    const first = service(useStep(f, source), 'sharepoint')
    assert.equal(first.needsReview, true)
    assert.equal(first.saved?.value, 'no', 'saved choice remains visible')
    const mapping = applyStepDecisions(f.mapping, { 's-confirm-workloads': { at: f.snapshot.asOf, answers: { sharepoint: 'no', 'evidence:sharepoint': 'present' } } })
    assert.equal(service(useStep({ ...f, mapping }, source), 'sharepoint').needsReview, false)
  }
})

test('retained foundational rows re-evaluate and dormant Keep completes the step', () => {
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
})

test('source assumptions omit optional exclusions, the second break-glass group among them, never AVD allowed users or include targets, and an update over one preserves the tenant’s actual exclusions', () => {
  const group = '62d67e66-2bc9-43cd-b00c-6326dae53d18'
  // The owner takes 5628ad67 as a second break-glass group (2026-09-19): the exclusions group every plan policy excludes stands where it stood.
  const emergency = '5628ad67-f9d1-4495-abe3-99dc8f9074f1'
  const policy = { displayName: 'Example', conditions: { users: { includeUsers: ['All'], excludeGroups: [group, emergency] } } }
  assert.deepEqual(assumedAbsentSourceGroups(policy, [policy]), [group, emergency])
  assert.deepEqual(assumedAbsentSourceGroups({ ...policy, displayName: 'IAC - APP - BLOCK - AVD - Exclude - AllowedAVDUsers' }, [policy]), [])
  assert.deepEqual(assumedAbsentSourceGroups(policy, [policy, { conditions: { users: { includeGroups: [group] } } }]), [emergency])

  // Updating a source with an assumed absent group preserves actual tenant exclusions.
  {
    const f = fixture('demo')
    const source = { id: 'source', displayName: 'Example', state: 'enabled', conditions: { users: { includeUsers: ['All'], excludeGroups: ['62d67e66-2bc9-43cd-b00c-6326dae53d18'] }, applications: { includeApplications: ['All'] } }, grantControls: { operator: 'OR', builtInControls: ['mfa'] } }
    const resolved = resolveTenantPolicy(source, { exclusionsGroupId: 'emergency', serviceAccountsGroupId: null, allowedCountriesLocationId: null }, 'mfa-all-users', [source] as never)
    const action = buildCreateAction([{ sourceName: source.displayName, resolved, target: { policyId: 'tenant-policy', state: 'enabled', policy: { ...source, conditions: { ...source.conditions, users: { includeUsers: ['All'], excludeGroups: ['actual-tenant-exception'], excludeUsers: ['actual-user-exception'] } } } } }], f.mapping, 'plan', 'step', 'mfa-all-users', { sections: new Set(['users']) })
    const body = action.resolution!.policies[0].body as { conditions: { users: { excludeGroups: string[]; excludeUsers: string[] } } }
    assert.ok(body.conditions.users.excludeGroups.includes('actual-tenant-exception'))
    assert.ok(body.conditions.users.excludeUsers.includes('actual-user-exception'))
  }
})

test('MFA preparation requires every suitable registration but not a recent proof from every person', () => {
  const f = fixture('demo-week2')
  const initial = runFixture(f)
  const viability = structuredClone(initial.viability)
  for (const v of viability) {
    v.mfaCapable = true
    v.readiness.methods = ['passkey']
    v.readiness.qualifying = ['passkey']
    // Held, and no confirmed use in the window: Confirm it (prompt 62), never Ready.
    v.readiness.lastConfirmed = null
    v.readiness.readyUntil = null
    v.readiness.state = 'confirm'
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


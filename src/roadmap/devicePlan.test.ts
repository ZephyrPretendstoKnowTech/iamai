// The device decision (E2), on the demo (Entra ID P1 + Intune, people on
// phones and unjoined computers). Open: a Preparation step asks, phones are out
// of device readiness, the compliant-device and Intune-enrolment steps wait on
// it and nothing else does. Answered: the compliant-device policy's platform
// condition is a recorded deviation beside the baseline's version, the
// app-protection step applies or goes to the footer with the answer as reason,
// the Intune-enrolment step follows the compliant-device one, the campaign
// carries a device line per person and one sentence in its email, and device
// readiness is measured against the answer. Without Intune the device steps are
// one shared Not licensed line and nothing asks.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fixture } from './fixtures/index.ts'
import type { Fixture } from './fixtures/index.ts'
import { runFixture } from './fixtures/run.ts'
import type { FixtureRun } from './fixtures/run.ts'
import type { MappingState } from '../mapping/types.ts'
import { applyStepDecisions } from './decisions.ts'
import type { StepDecision } from './decisions.ts'
import { QUESTION_STEP, devicePlanOf, deviceScopeOf, questionLabels } from './answers.ts'
import { APP_PROTECTION_GOAL, COMPLIANT_DEVICE_GOAL, DEVICE_GOALS, INTUNE_ENROLMENT_GOAL, deviceStepDoesntApply, excludedPlatforms } from './deviations.ts'
import { PREREQ_STEP_ID } from './stepIds.ts'
import { readinessFor } from './readiness.ts'
import { notLicensedRows } from '../derive/notLicensed.ts'
import { PINNED_GOAL_MAP } from './goalMap.ts'
import { defaultDecisions } from '../ui/surfaces/pickerRows.ts'
import { stepVars } from '../ui/surfaces/stepVars.ts'
import type { StepVarContext } from '../ui/surfaces/stepVars.ts'
import { portalNamesFor, stepPortalLines } from '../ui/surfaces/stepPortal.ts'
import { stepLines } from '../ui/surfaces/stepExport.ts'
import { stepById } from '../content/content.ts'

function applied(f: Fixture, decisions: Record<string, StepDecision> | null): MappingState {
  const nameOf = (id: string): string => f.snapshot.users.find((u) => u.id === id)?.displayName ?? id
  const defaults = applyStepDecisions(f.mapping, defaultDecisions({ snapshot: f.snapshot, mapping: f.mapping, nameOf, groups: f.groups, now: f.snapshot.asOf }), 'detected')
  return applyStepDecisions(defaults, decisions)
}
function ctxFor(f: Fixture, r: FixtureRun, mapping: MappingState): StepVarContext {
  return { snapshot: f.snapshot, mapping, nameOf: (id) => r.input.names!.label(id), signature: 'IT', operatorId: null, now: f.snapshot.asOf, groups: f.groups, naming: r.coverage.organisation.naming }
}
const AT = '2026-09-02T00:00:00.000Z'
/** A service-accounts group this tenant has named, so the compliant-device policy resolves. */
const SERVICE_ACCOUNTS_GROUP = '00000000-0000-4000-8000-0000000a0001'
const DEVICE = PREREQ_STEP_ID.devicePlan
const labels = questionLabels(DEVICE)

/** The decision as the walk makes it on the demo: phones protected by their apps, computers hybrid-joined. */
function decided(phones: string, computers: string | null, strict = false): Record<string, StepDecision> {
  return { [DEVICE]: { option: phones, answers: { ...(computers ? { [labels.question!]: computers } : {}), ...(strict ? { [labels.strict!]: 'Block phones that are not enrolled' } : {}) }, at: AT } }
}

test('open: the step asks, phones are out of readiness, and only the device steps wait on it', () => {
  const f = fixture('demo')
  assert.ok(labels.decision && labels.question && labels.strict, 'the device step\'s content carries the three labels')
  const m = applied(f, null)
  assert.equal(devicePlanOf(m), null)
  assert.deepEqual(deviceScopeOf(null), { phones: false, computers: true, hybridCounts: false })
  const r = runFixture({ ...f, mapping: m }, { mapping: m })
  const ds = r.steps.find((s) => s.id === DEVICE)
  assert.ok(ds, 'the device decision is a Preparation step on the demo')
  assert.equal(ds.phase, 0)
  assert.equal(ds.status, 'ready')
  assert.ok(ds.population.active > 0, 'it names the people on phones and unjoined computers')
  const ex = stepVars(ds, ctxFor(f, r, m))
  assert.ok((ex.phoneUsers as string[]).length >= 2, 'the demo signs in from two phones')
  for (const goalId of [COMPLIANT_DEVICE_GOAL, INTUNE_ENROLMENT_GOAL]) {
    const s = r.steps.find((x) => x.goalId === goalId)
    assert.ok(s, `${goalId}: on the plan`)
    assert.ok(s.blockedBy.includes(DEVICE), `${goalId}: waits on the device decision`)
    assert.ok(s.blockers.some((b) => b.kind === 'step' && b.stepId === DEVICE))
  }
  for (const s of r.steps) if (!DEVICE_GOALS.has(s.goalId)) assert.ok(!s.blockedBy.includes(DEVICE), `${s.id}: does not wait on the device decision`)
  // Device readiness against the open decision: compliant computers only, phones out.
  const compliant = r.steps.find((x) => x.goalId === COMPLIANT_DEVICE_GOAL)!
  const all = r.viability.map((v) => v.userId)
  assert.equal(compliant.readiness.percent, readinessFor(COMPLIANT_DEVICE_GOAL, all, r.viability, f.snapshot, { phones: false, computers: true, hybridCounts: false }).percent)
  assert.notEqual(compliant.readiness.percent, readinessFor(COMPLIANT_DEVICE_GOAL, all, r.viability, f.snapshot, { phones: true, computers: true, hybridCounts: false }).percent, 'phones out changes the number on the demo (it has compliant phones)')
  // No decision: the campaign carries no device line and no device sentence.
  const campaign = r.steps.find((s) => s.id === 's-verify-mfa')!
  const cv = stepVars(campaign, ctxFor(f, r, m))
  assert.equal(cv.deviceLines, undefined)
  assert.equal(cv.deviceSentence, undefined)
})

test('answered (apps, hybrid): the platform deviation, the enrolment step follows, the campaign says it, readiness counts hybrid', () => {
  const f = fixture('demo')
  // The baseline's compliant-device policy excludes the author's service-accounts
  // group, so this tenant needs one before the policy can be written at all.
  const m = { ...applied(f, decided('Protect the apps only', 'Hybrid-joined is enough')), serviceAccountsGroupId: SERVICE_ACCOUNTS_GROUP }
  const plan = devicePlanOf(m)
  assert.deepEqual(plan && { phones: plan.phones, computers: plan.computers, blockPhones: plan.blockPhones }, { phones: 'apps', computers: 'hybrid', blockPhones: false })
  assert.deepEqual(excludedPlatforms(m), ['android', 'iOS'])
  const r = runFixture({ ...f, mapping: m }, { mapping: m })
  const ds = r.steps.find((s) => s.id === DEVICE)!
  assert.equal(ds.status, 'done')
  const compliant = r.steps.find((x) => x.goalId === COMPLIANT_DEVICE_GOAL)!
  assert.ok(!compliant.blockedBy.includes(DEVICE), 'nothing waits on a made decision')
  assert.notEqual(compliant.status, 'skipped', 'computers stay in the policy')
  const body = JSON.parse(compliant.action.json ?? '{}') as { conditions?: { platforms?: { includePlatforms?: string[]; excludePlatforms?: string[] } } }
  assert.deepEqual(body.conditions?.platforms, { includePlatforms: ['all'], excludePlatforms: ['android', 'iOS'] }, 'the JSON scopes phones out')
  const ctx = ctxFor(f, r, m)
  const lines = stepPortalLines(compliant, portalNamesFor(ctx, stepVars(compliant, ctx), 'x')) ?? []
  const platforms = lines.find((l) => /Device platforms/.test(l))
  assert.ok(platforms, `the portal lines carry the platform condition: ${lines.join(' | ')}`)
  assert.match(platforms, /Include: Any device; Exclude: Android, iOS/)
  assert.match(platforms, /the baseline's version: no such condition/, 'the deviation is shown beside the baseline\'s version')
  const enrolment = r.steps.find((x) => x.goalId === INTUNE_ENROLMENT_GOAL)!
  assert.ok(!enrolment.blockedBy.includes(DEVICE))
  assert.notEqual(enrolment.status, 'skipped', 'the enrolment step follows the compliant-device one')
  assert.equal(deviceStepDoesntApply(APP_PROTECTION_GOAL, m), null, 'phones protected by their apps: the app-protection policy applies')
  // Readiness against the answer: hybrid-joined computers count as managed.
  const all = r.viability.map((v) => v.userId)
  assert.equal(compliant.readiness.percent, readinessFor(COMPLIANT_DEVICE_GOAL, all, r.viability, f.snapshot, { phones: false, computers: true, hybridCounts: true }).percent)
  assert.ok((compliant.readiness.percent ?? 0) > (readinessFor(COMPLIANT_DEVICE_GOAL, all, r.viability, f.snapshot).percent ?? 0), 'hybrid counting raises the number on the demo (it is hybrid)')
  // The campaign: a device line per person, one sentence in its email.
  const campaign = r.steps.find((s) => s.id === 's-verify-mfa')!
  const cv = stepVars(campaign, ctx)
  const deviceLines = cv.deviceLines as string[]
  assert.ok(deviceLines.some((l) => / · phone$/.test(l)), `a phone line per person: ${deviceLines.join(' | ')}`)
  assert.ok(deviceLines.some((l) => / · computer$/.test(l)), 'a computer line per person')
  assert.equal(deviceLines.length, (cv.phoneUsers as string[]).length + (cv.unjoinedUsers as string[]).length, 'one line per person on a phone or an unjoined computer')
  assert.equal(cv.deviceIntro, 'Devices, from Decide How Devices Are Managed, one line per person: on a phone, use Outlook and Teams for work; nothing to enrol; on a computer, domain-joined computers are already covered:')
  assert.equal(cv.deviceSentence, 'On your phone, use Outlook and Teams for work; nothing to enrol; on your computer, domain-joined computers are already covered.')
})

test('the other answers: enrol keeps phones in, block phones keeps them in, nothing managed sends the device steps to the footer with the answer', () => {
  const f = fixture('demo')
  const enrol = applied(f, decided('Enrol phones in Intune', 'Enrol in Intune'))
  assert.deepEqual(excludedPlatforms(enrol), [], 'enrol: the baseline stands')
  assert.equal(deviceStepDoesntApply(APP_PROTECTION_GOAL, enrol), 'Enrol phones in Intune', 'the app-protection step leaves with the answer as reason')
  const strict = applied(f, decided('No company data on phones', 'Hybrid-joined is enough', true))
  assert.equal(devicePlanOf(strict)?.blockPhones, true)
  assert.deepEqual(excludedPlatforms(strict), [], 'block phones: phones stay in the policy, so a phone not enrolled is blocked')
  const none = applied(f, decided('No company data on phones', 'Not managed'))
  assert.deepEqual(excludedPlatforms(none), ['android', 'iOS', 'windows', 'macOS', 'linux'])
  const r = runFixture({ ...f, mapping: none }, { mapping: none })
  for (const goalId of [COMPLIANT_DEVICE_GOAL, INTUNE_ENROLMENT_GOAL]) {
    const s = r.steps.find((x) => x.goalId === goalId)!
    assert.equal(s.status, 'skipped', `${goalId}: leaves the plan`)
    assert.equal(s.doesntApply, 'No company data on phones; Not managed', `${goalId}: the answer is the reason`)
  }
})

test('no Intune licence: the device steps are one shared Not licensed line, device readiness leaves the plan, nothing asks', () => {
  const f = fixture('small')
  assert.equal(f.snapshot.capabilities.intune.enabled, false)
  const r = runFixture(f)
  assert.ok(!r.steps.some((s) => s.id === DEVICE), 'nothing asks how devices are managed')
  assert.ok(!r.steps.some((s) => DEVICE_GOALS.has(s.goalId)), 'no device step is on the plan')
  const ctx = ctxFor(f, r, f.mapping)
  assert.ok(!r.steps.some((s) => stepLines(s, ctx).some((l) => /device readiness/i.test(l))), 'device readiness leaves the plan: no step says it')
  const rows = notLicensedRows(r.coverage, PINNED_GOAL_MAP)
  const devices = rows.filter((x) => x.goalId === 'devices')
  assert.equal(devices.length, 1, `one shared line: ${rows.map((x) => x.goalId).join(', ')}`)
  assert.ok(devices[0].text.includes(String(stepById[COMPLIANT_DEVICE_GOAL]?.title)), 'the shared line names the compliant-device step by its content title')
  assert.match(devices[0].text, /Require a Fresh Sign-in for Intune Enrollment/)
  assert.match(devices[0].text, /Intune Plan 1/)
  assert.ok(!rows.some((x) => DEVICE_GOALS.has(x.goalId)), 'no device goal has a line of its own')
})

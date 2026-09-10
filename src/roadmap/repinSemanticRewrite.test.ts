// A re-pin can keep a policy's stable id and change what it requires (task 022).
//
// Task 022 moved the default baseline to 90d9b890, where one member evolved
// under its own id: `aeb49474-5250-4b65-8b0a-56c47127ee0f` was renamed from
// "Device Registration from trusted location" to "Device Registration - MFA
// Strength", and its grant went from the built-in "Multifactor authentication"
// strength - seventeen combinations, password and SMS among them - to the
// author's custom "Modern MFA + TAP", which allows four and is effectively
// phishing-resistant.
//
// Stable identity is what lets the member's history be attributed at all. It is
// not permission to keep the proof: a tenant watched in report-only against the
// weaker requirement has evidence about the policy it used to be asked for.
//
// The defect this file was written against was real and is fixed at its source.
// `observation.ts` treated `id` as cosmetic at every depth, and the only nested
// id in a Conditional Access policy is `grantControls.authenticationStrength.id`
// - so the two strengths above fingerprinted identically. A tenant still holding
// the built-in strength read as deployed-as-planned against an operation that
// submits Modern MFA + TAP, and reached ready to enforce on a window earned
// against the weaker one.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fixture } from './fixtures/index.ts'
import { runFixture } from './fixtures/run.ts'
import { cleanReportOnly } from './fixtures/records.ts'
import { memberKeyOf, observe, semanticFieldsOf, semanticsOf } from './observation.ts'
import type { StepObservation } from './observation.ts'
import { PINNED_GOAL_MAP } from './goalMap.ts'
import { activePeopleIds } from '../derive/population.ts'
import type { TenantSnapshot } from '../graph/collect/types.ts'

const STEP = 's-goal-device-registration-mfa'
const MEMBER = 'aeb49474-5250-4b65-8b0a-56c47127ee0f'
const OLD_NAME = 'IAC - INTUNE – GRANT – Device Registration from trusted location'
const NEW_NAME = 'IAC - INTUNE – GRANT – Device Registration - MFA Strength'
/** The built-in "Multifactor authentication" strength the baseline used to ask for. */
const BUILTIN = '00000000-0000-0000-0000-000000000002'
/** The author's custom "Modern MFA + TAP", which the re-pinned baseline asks for. */
const MODERN = '42de22a7-5339-4a58-b560-28565d53b14d'
/**
 * The tenant's own strength for it: the id the plan's operation actually
 * submits. The author's id is the author's, and no other tenant has it, so what
 * a tenant deployed as planned holds is its own strength allowing exactly what
 * the baseline asks for (resolvePolicy.ts tenantStrengthFor).
 */
const TENANT_MODERN = (): string => {
  const st = (asked.grantControls as { authenticationStrength?: { id?: string } } | null)?.authenticationStrength
  assert.ok(st?.id && st.id !== MODERN, 'the plan submits the tenant’s own strength, never the author’s id')
  return st.id
}
const PID = 'dddddddd-0000-4000-8000-000000000001'
const DAY = 86_400_000

const pinned = JSON.parse(readFileSync('baselines/jhope188-conditionalaccesspolicies.pinned.json', 'utf8')) as {
  policies: { id: string | null; displayName: string; grantControls: { authenticationStrength?: { id?: string; displayName?: string; allowedCombinations?: string[] } } | null }[]
}

// ---- the member the re-pin moved ----

test('the goal still names the same source policy after the rename', () => {
  assert.deepEqual(PINNED_GOAL_MAP['device-registration-mfa'], [MEMBER], 'a same-id rename must not remap the goal by display name')
  const member = pinned.policies.find((p) => p.id === MEMBER)
  assert.ok(member, 'the member left the baseline')
  assert.equal(member.displayName, NEW_NAME)
})

test('the re-pinned baseline asks for the stronger strength', () => {
  const strength = pinned.policies.find((p) => p.id === MEMBER)!.grantControls?.authenticationStrength
  assert.equal(strength?.id, MODERN)
  assert.equal(strength?.displayName, 'Modern MFA + TAP')
  assert.deepEqual([...(strength?.allowedCombinations ?? [])].sort(), ['fido2', 'temporaryAccessPassOneTime', 'windowsHelloForBusiness', 'x509CertificateMultiFactor'])
})

test('the member is identified by the baseline key, so the rename does not move it', () => {
  assert.equal(memberKeyOf(MEMBER, 0), memberKeyOf(MEMBER, 3), 'the key is the source key, never the position')
  assert.notEqual(memberKeyOf(OLD_NAME, 0), memberKeyOf(MEMBER, 0), 'and it is the id, so a baseline that carried a name key is a different member')
})

// ---- the fingerprint ----

const body = (strengthId: string) => ({
  conditions: { users: { includeUsers: ['All'] }, applications: { includeUserActions: ['urn:user:registerdevice'] }, clientAppTypes: ['all'] },
  grantControls: { operator: 'OR', builtInControls: [], authenticationStrength: { id: strengthId } },
  sessionControls: null,
})

test('a referenced object is its id: two strengths are two requirements', () => {
  assert.notEqual(semanticsOf(body(BUILTIN)), semanticsOf(body(MODERN)), 'requiring seventeen combinations and requiring four are not the same policy')
  assert.notEqual(semanticFieldsOf(body(BUILTIN)).grantControls, semanticFieldsOf(body(MODERN)).grantControls, 'and the grant is the dimension that moved')
  // What is still cosmetic about a referenced object: what it is called.
  const renamedStrength = { ...body(MODERN), grantControls: { operator: 'OR', builtInControls: [], authenticationStrength: { id: MODERN, displayName: 'Modern MFA + TAP (2026)' } } }
  assert.equal(semanticsOf(renamedStrength), semanticsOf(body(MODERN)), 'renaming the strength is not rewriting the policy')
})

test('the window earned against the old strength does not carry across the change', () => {
  const at = '2026-09-07T00:00:00.000Z'
  const prior: StepObservation = {
    artifact: 'A',
    state: 'report-only',
    semantics: semanticsOf(body(BUILTIN)),
    fields: semanticFieldsOf(body(BUILTIN)),
    firstSeenAt: '2026-08-14T00:00:00.000Z',
    since: 'first-scan',
    lastSeenAt: '2026-09-06T00:00:00.000Z',
    evidenceAt: '2026-08-14T00:00:00.000Z',
  }
  const now = observe(prior, { artifact: 'A', state: 'report-only', semantics: semanticsOf(body(MODERN)), fields: semanticFieldsOf(body(MODERN)), at, evidenceAt: '2026-08-14T00:00:00.000Z' })
  assert.equal(now.changed, 'semantics')
  assert.equal(now.continuity, 'reset', 'the policy now requires something else and has been watched for no time at all')
  assert.equal(now.reviewRequired, true, 'and nobody asked for it, so somebody looks')
  assert.equal(now.latest.evidenceAt, null, 'records made under the weaker requirement are about the policy it used to be')
  assert.equal(now.latest.firstSeenAt, at)

  // The same object left alone keeps everything it earned.
  const still = observe(prior, { artifact: 'A', state: 'report-only', semantics: semanticsOf(body(BUILTIN)), fields: semanticFieldsOf(body(BUILTIN)), at, evidenceAt: '2026-08-14T00:00:00.000Z' })
  assert.equal(still.changed, 'none')
  assert.equal(still.continuity, 'continues')
  assert.equal(still.latest.firstSeenAt, prior.firstSeenAt)
  assert.equal(still.latest.evidenceAt, '2026-08-14T00:00:00.000Z')
})

// ---- what a person sees ----
//
// The whole engine over a real fixture whose tenant has the device-registration
// policy deployed in report-only, watched clean for a fortnight, with every
// active person seen. The two cases differ in one field: which authentication
// strength the deployed policy requires. Everything else is exactly the body the
// plan itself asks for, so nothing but the strength can explain the difference.

const asked = runFixture(fixture('demo-week2')).steps.find((s) => s.id === STEP)!.action.resolution!.policies![0].body as Record<string, unknown>

function deployed(strengthId: string) {
  const f = fixture('demo-week2')
  const people = activePeopleIds(f.snapshot, f.snapshot.asOf)
  const at = new Date(Date.parse(f.snapshot.asOf) - 14 * DAY).toISOString()
  const grantControls = structuredClone(asked.grantControls) as Record<string, unknown>
  grantControls.authenticationStrength = { id: strengthId }
  const row = { ...structuredClone(asked), id: PID, state: 'enabledForReportingButNotEnforced', description: '', createdDateTime: at, modifiedDateTime: at, grantControls }
  // The fixture tenant already has its own strength allowing what the baseline
  // asks for; nothing is added here, because a second strength allowing the same
  // combinations would be two answers to one question and the plan would decline
  // to pick between them (resolvePolicy.ts).
  const snapshot = {
    ...f.snapshot,
    config: {
      ...f.snapshot.config,
      caPolicies: { ...f.snapshot.config.caPolicies!, rows: [...(f.snapshot.config.caPolicies?.rows ?? []), row] },
    },
    evidencePolicyResults: [...(f.snapshot.evidencePolicyResults ?? []), cleanReportOnly({ policyId: PID, people, asOf: f.snapshot.asOf, firstReportOnlyAt: at })],
  } as TenantSnapshot
  return runFixture({ ...f, snapshot }, { snapshot }).steps.find((s) => s.id === STEP)!
}

test('a tenant deployed with what the baseline now asks earns its window', () => {
  const step = deployed(TENANT_MODERN())
  // Both gates close on it. Whether it may then be turned on is the hold's
  // question, and on this baseline the policy names objects it has not settled
  // (roadmap/holds.ts): the window is what a re-pin must carry, so it is read here.
  assert.equal(step.tracking?.readyNow, true)
  assert.equal(step.action.resolution?.policies?.[0]?.mode, 'update', 'the one change left is turning on the policy the tenant has')
  assert.equal(step.tracking?.policyId, PID)
})

test('a tenant still on the built-in strength does not inherit that window', () => {
  const step = deployed(BUILTIN)
  assert.notEqual(step.state?.lifecycle, 'ready-to-enforce', 'the window was earned against a requirement the baseline no longer makes')
  assert.equal(step.state?.lifecycle, 'report-only')
  assert.notEqual(step.action.resolution?.policies?.[0]?.mode, 'update', 'and the tenant is not told the policy it has is the policy the plan asked for')
})

// Require MFA for Guests (5.3), Phase 3 (owner, 2026-09-25):
// - Impact counts the guests it acts on, "No guests" on a tenant with none, and a
//   tenant with none has no Email tab; the Guest Directory card is gone;
// - its guest gate counts only guests the scan can read and place (decision 7);
// - the step builds exactly Jon's two guest policies (owner, 2026-09-29): the
//   tenant's own guest policy is never credited as a half nor rewritten into one;
//   a half with no policy of its own is created in Report-only, the tenant's
//   policy is named as existing coverage, and the step completes when both halves
//   are On and exact;
// - a Ready row with no day of its own reads its phase's first day, never
//   "Review now" (net-new 29).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fixture } from './fixtures/index.ts'
import type { Fixture } from './fixtures/index.ts'
import { runFixture, withFoundationSettled } from './fixtures/run.ts'
import { stepBodyOf } from '../ui/surfaces/stepBody.ts'
import { stepContract } from '../ui/surfaces/stepContract.ts'
import { rowWho } from '../ui/surfaces/rowWho.ts'
import { boardOf, boardWhenOf, laneViewFor, waveStartOf } from '../ui/surfaces/planBoard.ts'
import { IMPACT } from '../derive/whoLine.ts'
import type { StepVarContext } from '../ui/surfaces/stepVars.ts'
import type { Step } from './types.ts'
import { observationsOf } from './tracking.ts'
import type { StepObservationRecord } from './observation.ts'
import { serviceProvidersExcluded } from './answers.ts'
import { EXCLUSIONS_RECORD_KEY } from '../mapping/safetyChoice.ts'
import { REPORT_ONLY_STEP_ID } from './reportOnlyBatch.ts'

const GUESTS = 's-goal-guests-mfa'
const MIXED = 'IAC - GLOBAL - GRANT - MFA - Mixed-Guests'
const B2B = 'IAC - GLOBAL - GRANT - MFA - B2B-Guest'
const OLD = 'tenant-guest-mfa'
const ALL6 = 'internalGuest,b2bCollaborationGuest,b2bCollaborationMember,b2bDirectConnectUser,otherExternalUser,serviceProvider'
type Row = Record<string, unknown> & { id: string; displayName: string; state: string }

/** The owner's shape: a guest-only MFA policy of the tenant's own, every guest type, On, untagged. */
function tenantGuestPolicy(f: Fixture): Row {
  const exclusions = (f.mapping.records[EXCLUSIONS_RECORD_KEY] as { resolvedId?: string } | undefined)?.resolvedId
  return {
    id: OLD, displayName: 'Core - Allow - MFA for Guests', state: 'enabled', createdDateTime: '2026-01-01T00:00:00Z', modifiedDateTime: '2026-01-01T00:00:00Z',
    conditions: {
      users: { includeUsers: [], excludeUsers: [], includeGroups: [], excludeGroups: exclusions ? [exclusions] : [], includeRoles: [], excludeRoles: [], includeGuestsOrExternalUsers: { guestOrExternalUserTypes: ALL6, externalTenants: { membershipKind: 'all' } } },
      applications: { includeApplications: ['All'], excludeApplications: [], includeUserActions: [], includeAuthenticationContextClassReferences: [] },
      clientAppTypes: ['all'], signInRiskLevels: [], userRiskLevels: [], servicePrincipalRiskLevels: [],
    },
    grantControls: { operator: 'OR', builtInControls: ['mfa'], customAuthenticationFactors: [], termsOfUse: [] },
    sessionControls: null,
  }
}

function withRows(f: Fixture, edit: (rows: Row[]) => Row[]): Fixture {
  const snapshot = structuredClone(f.snapshot)
  ;(snapshot.config.caPolicies as { rows: unknown[] }).rows = edit(snapshot.config.caPolicies.rows as Row[])
  return { ...f, snapshot }
}

/** The settled demo with its own guest policies replaced by the owner's shape. */
const ownerShape = (f: Fixture = withFoundationSettled(fixture('demo'))): Fixture => withRows(f, (rows) => [...rows.filter((p) => !/Guests MFA/.test(p.displayName)), tenantGuestPolicy(f)])

function guestStep(f: Fixture, records: Record<string, StepObservationRecord> | null = null): { step: Step; run: ReturnType<typeof runFixture> } {
  const run = runFixture(f, {}, records)
  const step = run.steps.find((s) => s.id === GUESTS)
  assert.ok(step, 'Require MFA for Guests is on the plan')
  return { step, run }
}

/** The step's creates, put on the tenant as the operator would, under ids of their own. */
const created = (f: Fixture, step: Step, state = 'enabledForReportingButNotEnforced'): Fixture => withRows(f, (rows) => [...rows, ...(step.action.resolution?.policies ?? []).filter((o) => o.mode === 'create').map((o) => ({ ...(structuredClone(o.body) as Row), id: `created-${o.memberKey}`, state, createdDateTime: f.snapshot.asOf, modifiedDateTime: f.snapshot.asOf }))])

test("the owner's shape: Jon's two are created beside the tenant's own guest policy, which is never edited and is named as existing coverage", () => {
  const f = ownerShape()
  const { step, run } = guestStep(f)
  const ops = step.action.resolution?.policies ?? []
  assert.deepEqual(ops.map((o) => [o.mode, o.sourceName, (o.body as { state?: string }).state]), [['create', MIXED, 'enabledForReportingButNotEnforced'], ['create', B2B, 'enabledForReportingButNotEnforced']])
  assert.deepEqual((step.action.pairMembers ?? []).map((h) => [h.name, h.policyId]), [[MIXED, null], [B2B, null]], 'each half keyed, neither credited to a tenant policy')
  assert.equal(ops.some((o) => o.policyId === OLD), false, "an operation on the tenant's guest policy")
  assert.notEqual(step.status, 'done')
  // Named as existing coverage (shared.existingCoverage).
  assert.ok(step.deliveredBy.some((d) => d.startsWith('Core - Allow - MFA for Guests')), step.deliveredBy.join(' | '))
  const ctx: StepVarContext = { snapshot: f.snapshot, mapping: f.mapping, nameOf: (x: string) => run.input.names!.label(x), signature: 'IT', operatorId: f.operatorId, now: f.snapshot.asOf, groups: f.groups }
  const who = JSON.stringify(stepBodyOf(step, ctx))
  assert.match(who, /already covers this with Core - Allow - MFA for Guests \(On\)\. This step creates the baseline's version; once it is enforced, review whether the older ones can be retired\./)
  // Both halves are listed in 3.8 Create the Policies in Report-only.
  const batch = run.steps.find((s) => s.id === REPORT_ONLY_STEP_ID)
  assert.ok(batch?.reportOnlyBatch?.create.includes(GUESTS), 'the guest step is in the Report-only batch')
})

test("a tenant with Jon's Mixed-Guests by name: that half is its own and corrected in place, and B2B-Guest is created (R4-11)", () => {
  const f0 = ownerShape()
  const first = guestStep(f0).step
  const mixed = structuredClone(first.action.resolution!.policies[0].body) as Row
  // Jon's Mixed-Guests by name, drifted: plain MFA but Report-only.
  const f = withRows(f0, (rows) => [...rows, { ...mixed, id: 'named-mixed', state: 'enabledForReportingButNotEnforced', createdDateTime: '2026-01-01T00:00:00Z' }])
  const { step } = guestStep(f)
  assert.deepEqual((step.action.pairMembers ?? []).map((h) => [h.name, h.policyId]), [[MIXED, 'named-mixed'], [B2B, null]])
  const ops = step.action.resolution?.policies ?? []
  assert.ok(ops.some((o) => o.mode === 'create' && o.sourceName === B2B), 'B2B-Guest created')
  assert.equal(ops.some((o) => o.mode === 'create' && o.sourceName === MIXED), false, 'a second Mixed-Guests beside the named one')
  assert.equal(ops.some((o) => o.policyId === OLD), false, "an operation on the tenant's guest policy")
})

test('both halves present, On and exact: Completed, tracked by both halves under their own names, and B2B-Guest is proposed no rename', () => {
  const f0 = ownerShape()
  const p1 = guestStep(f0)
  const f1 = created(f0, p1.step)
  const p2 = guestStep(f1, observationsOf(p1.run.steps))
  const b2bKey = p1.step.action.pairMembers![1].key
  const b2b = (p2.step.tracking?.members ?? []).find((m) => m.key === b2bKey)
  assert.equal(b2b?.policyName, B2B, 'the created B2B-Guest is tracked as its own half')
  assert.notEqual(b2b?.plannedName, MIXED, 'a created B2B-Guest proposed the Mixed-Guests name')
  assert.equal((p2.step.tracking?.members ?? []).some((m) => m.key === 'sole'), false, 'a sole member for a pair')
  const on = created(f0, p1.step, 'enabled')
  const p3 = guestStep(on, observationsOf(p2.run.steps))
  assert.equal(p3.step.status, 'done')
  assert.deepEqual((p3.step.tracking?.members ?? []).map((m) => m.policyName), [MIXED, B2B])
  for (const m of p3.step.tracking?.members ?? []) assert.ok(m.plannedName === undefined || m.plannedName === m.policyName, `${m.policyName} proposed as ${String(m.plannedName)}`)
  const renames = (p3.run.schedule.cleanup?.rows ?? []).filter((r) => r.kind === 'naming').flatMap((r) => r.lists.renames ?? [])
  assert.equal(renames.some((l) => l.startsWith(B2B)), false, renames.join(' | '))
})

test("the demo's own partner answer (service providers excluded) does not deadlock completion", () => {
  const settled = withFoundationSettled(fixture('demo'))
  assert.equal(serviceProvidersExcluded(settled.mapping), true, 'the premise: the demo excludes service providers')
  const f0 = ownerShape(settled)
  const p1 = guestStep(f0)
  assert.equal(p1.step.action.resolution?.policies.length, 2)
  const done = guestStep(created(f0, p1.step, 'enabled'), observationsOf(p1.run.steps))
  assert.equal(done.step.status, 'done')
})

test('two tenant policies carrying one half\'s name hold the pair as unmatched', () => {
  const f0 = ownerShape()
  const first = guestStep(f0).step
  const mixed = structuredClone(first.action.resolution!.policies[0].body) as Row
  const f = withRows(f0, (rows) => [...rows, { ...mixed, id: 'mixed-a', state: 'enabled' }, { ...mixed, id: 'mixed-b', state: 'enabled' }])
  const { step } = guestStep(f)
  assert.equal(step.action.unmatchedPair, true)
  assert.equal((step.action.resolution?.policies ?? []).length, 0)
})

function opened(f: Fixture): { step: Step; ctx: StepVarContext } {
  const run = runFixture(f)
  const step = run.steps.find((s) => s.id === GUESTS)
  assert.ok(step, 'Require MFA for Guests is on the plan')
  return { step, ctx: { snapshot: f.snapshot, mapping: f.mapping, nameOf: (x: string) => run.input.names!.label(x), signature: 'IT', operatorId: f.operatorId, now: f.snapshot.asOf, groups: f.groups } }
}

/** The tenant with every guest account turned into a member: nobody for a guest step to act on. */
function withoutGuests(f: Fixture): Fixture {
  const g = structuredClone(f)
  for (const u of g.snapshot.users) if (u.userType === 'guest') u.userType = 'member'
  return g
}

test('5.3 counts its guests: "No guests" and no Email tab on a tenant with none, and no Guest Directory card', () => {
  const f = fixture('demo')
  const withGuests = opened(structuredClone(f))
  const guests = f.snapshot.users.filter((u) => u.userType === 'guest').length
  assert.ok(guests > 0, 'the premise: the demo has guests')
  assert.match(rowWho(withGuests.step), /^\d+ guests?$/)
  const body = stepBodyOf(withGuests.step, withGuests.ctx)
  assert.ok(body.artifacts.some((a) => a.id === 'email'), 'with guests, the Email tab stands')
  const none = opened(withoutGuests(f))
  assert.equal(rowWho(none.step), IMPACT.noGuests)
  assert.equal(stepContract(none.step, none.ctx).who?.text, IMPACT.noGuests, 'the step says what its Impact says')
  const noneBody = stepBodyOf(none.step, none.ctx)
  assert.equal(noneBody.artifacts.some((a) => a.id === 'email'), false, 'an Email tab with nobody to write to')
  for (const b of [body, noneBody]) {
    const cards = [...(b.readiness?.tiles ?? []), ...(b.readiness?.satisfied ?? [])]
    assert.equal(cards.some((t) => t.key === 'directory-inventory' || /Guest Directory/.test(t.label)), false, 'the Guest Directory card')
  }
})

test('the guest gate counts only guests the scan reads and places: with none, there is no gate', () => {
  const { step } = opened(fixture('demo'))
  assert.equal(step.action.readinessGate, undefined, 'a gate on guests nobody can read')
  assert.equal(step.methodPreparation?.ids.length ?? 0, 0)
})

test('a Ready row with no day of its own reads its phase’s first day, never Review now or Decide now', () => {
  const f = fixture('demo')
  const r = runFixture(f)
  const board = boardOf(r.steps, r.schedule.cleanup, f.mapping.breakGlassAnswers ?? null)
  const step = r.steps.find((s) => s.id === 's-check-dormant-accounts')!
  const lane = laneViewFor(step, board)
  assert.equal(`${lane.lane} · ${lane.substatus}`, 'Ready · Review', 'the premise')
  const waveStart = waveStartOf(step)
  assert.ok(waveStart, 'the premise: the plan places it in a phase')
  const undated = { ...step, scheduled: undefined } as Step
  const when = boardWhenOf(undated, waveStart, lane)
  assert.doesNotMatch(when, /now/i)
  assert.match(when, /\d{4}/, when)
})


// Require MFA for Everyone matches Jon Hope's IAC - GLOBAL - GRANT - MFA - AllUsers
// exactly, its exclusions of Microsoft Intune Enrollment and Microsoft Rights
// Management Services included (owner, 2026-09-29). The goal's one own-scoped
// policy that delivers it is its step's, beside the admins' and guests' MFA
// policies that also cover some of its people; the one fact of which policy that
// is (Action.intendedFor) is what tracking compares and Align Policy Names renames.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { allFixtures } from './fixtures/index.ts'
import type { Fixture } from './fixtures/index.ts'
import { runFixture } from './fixtures/run.ts'
import type { Step } from './types.ts'
import { planDates } from '../ui/surfaces/stepVars.ts'
import { deliveredByEnforcedPolicy } from './operations.ts'

type Row = Record<string, unknown>
type Run = ReturnType<typeof runFixture>
const MFA = 's-goal-mfa-all-users'
const REAUTH = 's-goal-intune-enrollment-reauth'
const ALL_USERS = 'IAC - GLOBAL - GRANT - MFA - AllUsers'
const OWN = 'Core - Grant - MFA for all users'
const INTERNAL = 'Core - Allow - MFA for Internal Users'
const INTUNE_ENROLLMENT = 'd4ebce55-015a-49b5-a083-c84d1797ae8c'
const RMS = '00000012-0000-0000-c000-000000000000'
const GLOBAL_ADMIN = '62e90394-69f5-4237-9190-012177145e10'
const GUEST_TYPES = 'internalGuest,b2bCollaborationGuest,b2bCollaborationMember,b2bDirectConnectUser,otherExternalUser,serviceProvider'

const WEEK2 = allFixtures().find((f) => f.name === 'demo-week2')!
const DAY1 = allFixtures().find((f) => f.name === 'demo')!
const stepOf = (r: Run, id: string): Step => r.steps.find((s) => s.id === id)!
const renames = (r: Run): string[] => (r.schedule.cleanup?.namingProposals ?? []).map((p) => `${p.from} → ${p.to}`)
const reading = (r: Run) => r.steps.map((s) => [s.id, s.status, s.state.condition].join('|'))
const appsOf = (row: unknown): Row => (((row as Row)?.conditions as Row)?.applications ?? {}) as Row

function edited(f: Fixture, edit: (rows: Row[]) => void): Fixture {
  const snapshot = structuredClone(f.snapshot)
  edit((snapshot.config.caPolicies?.rows ?? []) as Row[])
  return { ...f, snapshot }
}
const named = (rows: Row[], name: string): Row => rows.find((p) => p.displayName === name)!
const users = (row: Row): Row => ((row.conditions as Row).users ?? {}) as Row

/**
 * The owner's shape: one MFA policy for internal users (leaving out admins and
 * every guest type, and Intune Enrollment still under its MFA), one for admins
 * and one for guests, all On.
 */
function split(name = INTERNAL): Fixture {
  return edited(WEEK2, (rows) => {
    const own = named(rows, OWN)
    own.displayName = name
    ;(own.conditions as Row).applications = { includeApplications: ['All'] }
    ;(own.conditions as Row).users = { ...users(own), excludeRoles: [GLOBAL_ADMIN], excludeGuestsOrExternalUsers: { guestOrExternalUserTypes: GUEST_TYPES, externalTenants: { membershipKind: 'all' } } }
    const guests = named(rows, 'Core - Grant - Guests MFA')
    ;(guests.conditions as Row).users = { ...users(guests), includeUsers: [], includeGuestsOrExternalUsers: { guestOrExternalUserTypes: GUEST_TYPES, externalTenants: { membershipKind: 'all' } } }
  })
}

test('week two follows the baseline: its own MFA policy is compared, Completed, and Align Policy Names renames it; after the rename nothing reopens', () => {
  const run = runFixture(WEEK2)
  const step = stepOf(run, MFA)
  const own = named((WEEK2.snapshot.config.caPolicies?.rows ?? []) as Row[], OWN)
  assert.equal(step.action.intendedFor, own.id)
  assert.equal(step.tracking?.members?.[0]?.policyId, own.id)
  assert.equal(step.status, 'done')
  assert.ok(renames(run).includes(`${OWN} → ${ALL_USERS}`), JSON.stringify(renames(run)))
  const after = runFixture(edited(WEEK2, (rows) => { named(rows, OWN).displayName = ALL_USERS }))
  assert.deepEqual(reading(after), reading(run), 'a rename changes no step')
  assert.ok(!renames(after).some((r) => r.startsWith(`${ALL_USERS} →`)))
})

test('the owner-like split tenant: its internal users’ policy is compared against AllUsers, directed to exclude Intune Enrollment and RMS, and renamed', () => {
  const f = split()
  const run = runFixture(f)
  const result = run.coverage.results.find((r) => r.goal.id === 'mfa-all-users')!
  assert.equal(result.status, 'enforced', 'the premise: the three deliver it together')
  const step = stepOf(run, MFA)
  const own = named((f.snapshot.config.caPolicies?.rows ?? []) as Row[], INTERNAL)
  assert.equal(step.action.intendedFor, own.id)
  assert.equal(step.tracking?.members?.[0]?.policyName, INTERNAL)
  const excluded = (appsOf(step.action.intended).excludeApplications ?? []) as string[]
  assert.deepEqual([...excluded].map((x) => x.toLowerCase()).sort(), [RMS, INTUNE_ENROLLMENT].sort(), 'the correction names both of Jon’s exclusions')
  assert.ok((step.state.observation?.unwritten ?? []).includes('conditions.applications'), JSON.stringify(step.state.observation?.unwritten))
  assert.ok(renames(run).includes(`${INTERNAL} → ${ALL_USERS}`), JSON.stringify(renames(run)))
  // A correction owed on 4.4 is not MFA missing: nobody meets it for the first time.
  assert.notEqual(step.status, 'done', 'the premise: a correction is owed')
  assert.equal(deliveredByEnforcedPolicy(step), true)
  assert.equal(planDates(run.steps, run.schedule.start, run.coverage.organisation.naming, f.snapshot).mfaInPlace, true)
  // 7.3 is never held for the session loop, and Inforcer stays delivered.
  assert.ok(!stepOf(run, REAUTH).blockers.some((b) => b.label === 'session-loop'))
})

test('correcting the split tenant’s policy exactly to AllUsers completes it, and Inforcer and Azure management stay delivered', () => {
  const before = runFixture(split())
  const intended = stepOf(before, MFA).action.intended as Row
  const corrected = edited(split(), (rows) => {
    const p = named(rows, INTERNAL)
    p.conditions = structuredClone(intended.conditions)
    p.grantControls = structuredClone(intended.grantControls)
    p.sessionControls = structuredClone(intended.sessionControls ?? null)
  })
  const after = runFixture(corrected)
  assert.equal(stepOf(after, MFA).status, 'done', JSON.stringify(stepOf(after, MFA).state.observation?.unwritten))
  assert.ok(!stepOf(after, REAUTH).blockers.some((b) => b.label === 'session-loop'))
  for (const goal of ['inforcer-mfa', 'azure-management-mfa']) {
    const r = after.coverage.results.find((x) => x.goal.id === goal)
    if (!r) continue
    const was = before.coverage.results.find((x) => x.goal.id === goal)!
    assert.equal(r.status, was.status, `${goal} does not reopen`)
    assert.ok(r.candidates.every((c) => !(c.policyName === INTERNAL && c.caveats.includes('apps-excluded'))), goal)
  }
  const inforcer = stepOf(after, 's-goal-inforcer-mfa')
  if (inforcer) assert.equal(inforcer.status, stepOf(before, 's-goal-inforcer-mfa').status)
})

test('an excluded app outside the goal’s resources gives nothing away; an excluded Office 365 group still does', () => {
  const coverageOf = (apps: string[], goal: string) => runFixture(edited(WEEK2, (rows) => { appsOf(named(rows, OWN)).excludeApplications = apps })).coverage.results.find((r) => r.goal.id === goal)
  const inforcer = coverageOf([INTUNE_ENROLLMENT, RMS], 'inforcer-mfa')!
  assert.ok(inforcer.candidates.every((c) => !(c.policyName === OWN && c.caveats.includes('apps-excluded'))))
  const azure = coverageOf([INTUNE_ENROLLMENT, RMS], 'azure-management-mfa')!
  assert.equal(azure.status, 'enforced')
  assert.ok(azure.candidates.every((c) => !(c.policyName === OWN && c.caveats.includes('apps-excluded'))))
  const inforcerApp = '708861da-226e-4d65-a57a-24128df64524'
  assert.ok(coverageOf([inforcerApp], 'inforcer-mfa')!.candidates.some((c) => c.policyName === OWN && c.caveats.includes('apps-excluded')), 'excluding Inforcer itself still gives it away')
  assert.ok(coverageOf(['Office365'], 'inforcer-mfa')!.candidates.some((c) => c.policyName === OWN && c.caveats.includes('apps-excluded')), 'an excluded Microsoft group still counts')
})

test('day one directs 4.4’s correction with both of Jon’s exclusions', () => {
  const step = stepOf(runFixture(DAY1), MFA)
  const update = (step.action.resolution?.policies ?? []).find((o) => o.mode === 'update')
  assert.ok(update, 'the premise: day one corrects its MFA policy')
  const excluded = ((appsOf(update!.target).excludeApplications ?? []) as string[]).map((x) => x.toLowerCase())
  assert.ok(excluded.includes(INTUNE_ENROLLMENT) && excluded.includes(RMS), JSON.stringify(excluded))
})

test('a duplicate the scan lists first that does not deliver it gets no comparison and no rename', () => {
  const f = edited(WEEK2, (rows) => {
    const own = named(rows, OWN)
    rows.unshift({ ...structuredClone(own), id: 'dup-mfa-except-exchange', displayName: 'Contoso - MFA except Exchange', conditions: { ...(structuredClone(own.conditions) as Row), applications: { includeApplications: ['All'], excludeApplications: ['00000002-0000-0ff1-ce00-000000000000'] } } })
  })
  const run = runFixture(f)
  const result = run.coverage.results.find((r) => r.goal.id === 'mfa-all-users')!
  assert.ok(!(result.satisfaction?.policyIds ?? []).includes('dup-mfa-except-exchange'), 'the premise: it does not deliver the goal')
  const step = stepOf(run, MFA)
  assert.equal(step.tracking?.members?.[0]?.policyName, OWN)
  assert.equal(step.status, 'done')
  assert.ok(!renames(run).some((r) => r.startsWith('Contoso - MFA except Exchange')), JSON.stringify(renames(run)))
  assert.ok(renames(run).includes(`${OWN} → ${ALL_USERS}`))
})

// Lockout lists (E8): steps 15 and 33 show in Who how many people in scope are
// not yet Ready for phishing-resistant MFA (scoring/phishingResistant.ts), by name
// when three or fewer and as a count otherwise; step 35 counts the people with
// only Authenticator approval, and when that list is not empty the high-risk sign-in policy
// offers the plain-MFA rung as the first enforcement, with the baseline's
// strength beside it on the portal lines and deferred in the JSON.
import { test } from 'node:test'
import assert from 'node:assert/strict'
// On the curated baseline (fixtures/index.ts `curatedFixture`): this is about a
// policy that can be written, not about the source groups this baseline has not
// settled (roadmap/sourceIdentity.test.ts).
import { curatedFixture as fixture } from './fixtures/index.ts'
import { runFixture } from './fixtures/run.ts'
import { contentLists, NAMES_UP_TO } from '../derive/contentLists.ts'
import { adminUserIds } from '../roles.ts'
import { stepById } from '../content/content.ts'
import { stepVars } from '../ui/surfaces/stepVars.ts'
import { stepLines } from '../ui/surfaces/stepExport.ts'
import type { StepVarContext } from '../ui/surfaces/stepVars.ts'
import { portalNamesFor, stepPortalLines } from '../ui/surfaces/stepPortal.ts'
import { answerKey, questionLabels } from './answers.ts'
import { plainMfaFirst } from './deviations.ts'
import { stepIdForGoal } from './stepIds.ts'
import { listCountVars, whole } from '../content/render.ts'
import { personReadiness } from '../scoring/phishingResistant.ts'
import type { MfaViability } from '../scoring/mfaViability.ts'

/** The admins at the readiness their own policy asks for (Step 7): Ready, a passkey proven on the platform they use. */
const READY_ADMIN = personReadiness({ methods: [{ kind: 'passkey' }], registered: null, signIns: { read: true, proofs: [{ cls: 'passkey', os: 'Windows', at: '2026-01-01T00:00:00.000Z', method: 'Passkey (device-bound)' }], platforms: [{ os: 'Windows', at: '2026-01-01T00:00:00.000Z' }] }, history: null })
const withAdminsReady = (viability: MfaViability[]): MfaViability[] => viability.map((v) => (v.isAdmin ? { ...v, readiness: READY_ADMIN } : v))

const ctxFor = (f: ReturnType<typeof fixture>, r: ReturnType<typeof runFixture>, over: Partial<StepVarContext> = {}): StepVarContext => ({ snapshot: f.snapshot, mapping: f.mapping, nameOf: (id) => r.input.names!.label(id), signature: 'IT', operatorId: f.operatorId, now: f.snapshot.asOf, groups: f.groups, naming: r.coverage.organisation.naming, ...over })

/** Week two with its admins policy back in report-only: a policy the plan can write, and a change to make to it. */
function adminsInReportOnly(f: ReturnType<typeof fixture>): typeof f.snapshot {
  const ca = f.snapshot.config.caPolicies!
  const rows = (ca.rows as Record<string, unknown>[]).map((p) => (/Admins phishing-resistant/.test(String(p.displayName)) ? { ...p, state: 'enabledForReportingButNotEnforced' } : p))
  return { ...f.snapshot, config: { ...f.snapshot.config, caPolicies: { ...ca, rows } } }
}

test('step 15 names the admins not yet Ready for phishing-resistant MFA on the demo (three or fewer), and counts them past that', () => {
  const f = fixture('demo-week2')
  const snapshot = adminsInReportOnly(f)
  const r = runFixture({ ...f, snapshot }, { snapshot } as never)
  const s = r.steps.find((x) => x.goalId === 'admins-phishing-resistant')!
  const ex = stepVars(s, ctxFor(f, r)) as { adminsWithout: string[]; adminsWithoutCount?: number }
  const admins = [...adminUserIds(f.snapshot.roles)].filter((id) => !f.mapping.breakGlassUserIds.includes(id))
  // Readiness, not the registration alone: a passkey never used is not what the policy needs (Step 7).
  const without = r.viability.filter((v) => admins.includes(v.userId) && v.activity === 'active' && v.readiness.state !== 'ready')
  assert.ok(without.length > 0 && without.length <= NAMES_UP_TO, `the demo has ${without.length} admins not yet Ready`)
  assert.equal(ex.adminsWithout.length, without.length, 'named, not counted')
  assert.equal(ex.adminsWithoutCount, undefined)
  // The line names a day to register before, and there is no such day while the
  // plan is holding the enforcement behind the very readiness these admins are
  // short of (roadmap/operations.ts readinessGate): the demo's admins are 67% of
  // the way to the 100% the step asks for, so nothing about it is dated and the
  // line does not render. The list itself is unchanged, and the row says what it
  // is waiting for.
  const lines = stepLines(s, ctxFor(f, r))
  assert.equal(s.action.readinessGate?.value, '67%', 'the step waits on admin readiness')
  assert.ok(!s.events, 'so nothing about it is dated')
  assert.deepEqual(lines.filter((l) => /not yet Ready for phishing-resistant MFA/.test(l)), [], 'and a line that names a deadline does not invent one')
  assert.ok(s.blockers.some((b) => b.binding === 'when admin readiness reaches 100% (now 67%)'), JSON.stringify(s.blockers))
  // With the prerequisite met the enforcement is dated again, and the line comes
  // back counting whatever list is left.
  const ready = runFixture({ ...f, snapshot }, { snapshot, viability: withAdminsReady(r.viability) } as never)
  const dated = ready.steps.find((x) => x.goalId === 'admins-phishing-resistant')!
  // The readiness hold is released, so the plan dates the change again. Where it
  // holds that date is Foundation B's: this policy is in report-only and the one
  // thing left to submit turns it on, so the rollout the schedule drew is kept
  // apart from the step's own milestones (roadmap/forecast.ts settleForecast)
  // and no line names it until the observation window earns it.
  assert.ok(dated.events ?? ready.schedule.forecastOnly?.[dated.id]?.events, 'the change is dated once admin readiness reaches the threshold')
  // Past three, the count line stands in for the names.
  const many = contentLists({ snapshot: { ...f.snapshot, roles: { ...f.snapshot.roles, active: Object.fromEntries(r.viability.filter((v) => v.activity === 'active').slice(0, 12).map((v) => [v.userId, ['62e90394-69f5-4237-9190-012177145e10']])) } }, mapping: f.mapping, nameOf: (id) => id, now: f.snapshot.asOf })
  assert.deepEqual(many.adminsWithout, [], 'more than three: no names')
  assert.ok(Number(many.adminsWithoutCount) > NAMES_UP_TO, 'a count instead')
})

test('step 33 lists the eligible role holders with no passkey or key yet', () => {
  const f = fixture('mid')
  const r = runFixture(f)
  const eligibleId = r.viability.find((v) => v.activity === 'active' && v.readiness.state !== 'ready' && !f.mapping.breakGlassUserIds.includes(v.userId))!.userId
  const snapshot = { ...f.snapshot, roles: { ...f.snapshot.roles, eligible: { [eligibleId]: ['62e90394-69f5-4237-9190-012177145e10'] } } }
  const lists = contentLists({ snapshot, mapping: f.mapping, nameOf: (id) => id, now: f.snapshot.asOf })
  assert.deepEqual(lists.eligibleWithout, [eligibleId])
  const cs = stepById['pim-activation-reauth'] as unknown as { who: { evidence: string[] } }
  const line = cs.who.evidence.find((l) => l.includes('{list:eligibleWithout}'))!
  // On screen the line counts its own list (render.ts listCountVars); the count line stands in only past three names.
  assert.ok(whole(line, listCountVars(line, lists)), 'the names line renders')
  assert.equal(whole(cs.who.evidence.find((l) => l.includes('{eligibleWithoutCount}'))!, lists), false, 'the count line does not')
})

test('step 35 offers the plain-MFA rung as the first enforcement while anyone has only Authenticator approval, the baseline strength beside it', () => {
  const f = fixture('mid')
  const r = runFixture(f)
  const s = r.steps.find((x) => x.goalId === 'sign-in-risk')!
  assert.ok(s, 'the mixed-licence fixture holds the risk policy')
  const ex = stepVars(s, ctxFor(f, r)) as Record<string, unknown>
  assert.ok(Number(ex.pushOnlyTotal) > 0, 'people with only Authenticator approval')
  const d = (stepById['sign-in-risk'] as unknown as { decision: { applies: string; label: string; options: string[] } }).decision
  assert.equal(d.applies, 'pushOnlyTotal', 'offered only while the list is not empty')
  assert.ok(ex[d.applies], 'offered here')
  // Undecided: the baseline's strength.
  const before = stepPortalLines(s, portalNamesFor(ctxFor(f, r), ex, 'x'))!
  assert.ok(before.some((l) => /^Grant → Require authentication strength: /.test(l)), 'the baseline requires its strength')
  // The plain-MFA rung chosen: the grant is plain MFA, the baseline's version beside it.
  const key = answerKey(stepIdForGoal('sign-in-risk'), questionLabels(stepIdForGoal('sign-in-risk')).decision!)
  const mapping = { ...f.mapping, questionAnswers: { ...(f.mapping.questionAnswers ?? {}), [key]: d.options[1] } }
  assert.ok(plainMfaFirst(mapping))
  // The step carries its own policy: pairing this step with another mapping
  // would change nothing, so the answered plan is derived and its step read.
  assert.deepEqual(stepPortalLines(s, portalNamesFor(ctxFor(f, r, { mapping }), ex, 'x')), stepPortalLines(s, portalNamesFor(ctxFor(f, r), ex, 'x')), 'the step is authoritative: another mapping does not move its lines')
  const rAfter = runFixture({ ...f, mapping }, { mapping })
  const sAfter = rAfter.steps.find((x) => x.goalId === 'sign-in-risk')!
  const after = stepPortalLines(sAfter, portalNamesFor(ctxFor(f, rAfter, { mapping }), stepVars(sAfter, ctxFor(f, rAfter, { mapping })) as Record<string, unknown>, 'x'))!
  const grant = after.find((l) => l.startsWith('Grant → '))!
  assert.match(grant, /^Grant → Require multifactor authentication · your choice; the baseline's version: Grant → Require authentication strength: /)
  const withAnswer = runFixture({ ...f, mapping }, { mapping })
  const json = JSON.parse(withAnswer.steps.find((x) => x.goalId === 'sign-in-risk')!.action.json!) as { grantControls: { builtInControls: string[]; authenticationStrength?: unknown } }
  assert.deepEqual(json.grantControls.builtInControls, ['mfa'])
  assert.equal(json.grantControls.authenticationStrength, undefined, 'the strength is deferred in the JSON too')
})

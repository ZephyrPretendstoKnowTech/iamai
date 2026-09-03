// Lockout lists (E8): steps 15, 33 and 35 show in Who how many people in scope
// have no phishing-resistant method today, by name when three or fewer and as a
// count otherwise; when that list is not empty, the high-risk sign-in policy
// offers the plain-MFA rung as the first enforcement, with the baseline's
// strength beside it on the portal lines and deferred in the JSON.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fixture } from './fixtures/index.ts'
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

const ctxFor = (f: ReturnType<typeof fixture>, r: ReturnType<typeof runFixture>, over: Partial<StepVarContext> = {}): StepVarContext => ({ snapshot: f.snapshot, mapping: f.mapping, nameOf: (id) => r.input.names!.label(id), signature: 'IT', operatorId: f.operatorId, now: f.snapshot.asOf, groups: f.groups, naming: r.coverage.organisation.naming, ...over })

test('step 15 names the admins with no phishing-resistant method on the demo (three or fewer), and counts them past that', () => {
  const f = fixture('demo')
  const r = runFixture(f)
  const s = r.steps.find((x) => x.goalId === 'admins-phishing-resistant')!
  const ex = stepVars(s, ctxFor(f, r)) as { adminsWithout: string[]; adminsWithoutCount?: number }
  const admins = [...adminUserIds(f.snapshot.roles)].filter((id) => !f.mapping.breakGlassUserIds.includes(id))
  const without = r.viability.filter((v) => admins.includes(v.userId) && v.activity === 'active' && !v.methodTiers.includes('phishingResistant'))
  assert.ok(without.length > 0 && without.length <= NAMES_UP_TO, `the demo has ${without.length} admins without a passkey or key`)
  assert.equal(ex.adminsWithout.length, without.length, 'named, not counted')
  assert.equal(ex.adminsWithoutCount, undefined)
  const lines = stepLines(s, ctxFor(f, r))
  assert.ok(lines.some((l) => new RegExp(`^${without.length} admins have no phishing-resistant method; register before .+: `).test(l)), 'the line counts its own list')
  // Past three, the count line stands in for the names.
  const many = contentLists({ snapshot: { ...f.snapshot, roles: { ...f.snapshot.roles, active: Object.fromEntries(r.viability.filter((v) => v.activity === 'active').slice(0, 12).map((v) => [v.userId, ['62e90394-69f5-4237-9190-012177145e10']])) } }, mapping: f.mapping, nameOf: (id) => id, now: f.snapshot.asOf })
  assert.deepEqual(many.adminsWithout, [], 'more than three: no names')
  assert.ok(Number(many.adminsWithoutCount) > NAMES_UP_TO, 'a count instead')
})

test('step 33 lists the eligible role holders with no passkey or key yet', () => {
  const f = fixture('mid')
  const r = runFixture(f)
  const eligibleId = r.viability.find((v) => v.activity === 'active' && !v.methodTiers.includes('phishingResistant') && !f.mapping.breakGlassUserIds.includes(v.userId))!.userId
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
  const before = stepPortalLines('sign-in-risk', portalNamesFor(ctxFor(f, r), ex, 'x'))!
  assert.ok(before.some((l) => /^Grant → Require authentication strength: /.test(l)), 'the baseline requires its strength')
  // The plain-MFA rung chosen: the grant is plain MFA, the baseline's version beside it.
  const key = answerKey(stepIdForGoal('sign-in-risk'), questionLabels(stepIdForGoal('sign-in-risk')).decision!)
  const mapping = { ...f.mapping, questionAnswers: { ...(f.mapping.questionAnswers ?? {}), [key]: d.options[1] } }
  assert.ok(plainMfaFirst(mapping))
  const after = stepPortalLines('sign-in-risk', portalNamesFor(ctxFor(f, r, { mapping }), ex, 'x'))!
  const grant = after.find((l) => l.startsWith('Grant → '))!
  assert.match(grant, /^Grant → Require multifactor authentication · your choice; the baseline's version: Grant → Require authentication strength: /)
  const withAnswer = runFixture({ ...f, mapping }, { mapping })
  const json = JSON.parse(withAnswer.steps.find((x) => x.goalId === 'sign-in-risk')!.action.json!) as { grantControls: { builtInControls: string[]; authenticationStrength?: unknown } }
  assert.deepEqual(json.grantControls.builtInControls, ['mfa'])
  assert.equal(json.grantControls.authenticationStrength, undefined, 'the strength is deferred in the JSON too')
})

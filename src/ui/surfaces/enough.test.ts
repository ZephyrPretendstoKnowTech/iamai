// One definition of enough (E7): admin readiness is Passkey or security key,
// proven (derive/ladder.ts rung 5, the rung the lockout list reads), and the
// campaign and step 12 say "or"; the
// campaign email fills {mfaEnforceLong} and {enrolWindowDays}, the managed-device
// email {personalDevicesClause}, and firstEnforce is gone from the variables.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fixture } from '../../roadmap/fixtures/index.ts'
import { runFixture } from '../../roadmap/fixtures/run.ts'
import { planDates, stepVars } from './stepVars.ts'
import type { StepVarContext } from './stepVars.ts'
import { missingVars, fillText } from '../../content/render.ts'
import { engine, stepById } from '../../content/content.ts'
import { absoluteDate, longDate } from '../../copy/dates.ts'
import { adminUserIds } from '../../roles.ts'
import { rungOf } from '../../derive/ladder.ts'

const setUp = () => {
  const f = fixture('demo-week2')
  const r = runFixture(f)
  const dates = planDates(r.steps, r.schedule.start)
  const ctx = (over: Partial<StepVarContext> = {}): StepVarContext => ({ snapshot: f.snapshot, mapping: f.mapping, nameOf: (id) => r.input.names!.label(id), signature: 'IT', operatorId: f.operatorId, now: f.snapshot.asOf, groups: f.groups, ...dates, ...over })
  return { f, r, dates, ctx }
}

test('admin readiness is the share of admins at Passkey or security key, proven', () => {
  const { f, r } = setUp()
  const admins = [...adminUserIds(f.snapshot.roles)]
  const rows = r.viability.filter((v) => admins.includes(v.userId))
  const withPr = rows.filter((v) => rungOf(v) === 5).length
  const step = r.steps.find((s) => s.goalId === 'admins-phishing-resistant')!
  assert.equal(step.readiness.family, 'admin')
  assert.equal(step.readiness.percent, Math.round((withPr / rows.length) * 100))
  const camp = stepById['s-verify-mfa'] as unknown as { doneWhen: string[]; whatToDo: { steps: string[] } }
  assert.ok(camp.doneWhen.some((l) => l === 'Every admin has a passkey or a security key registered.'))
  assert.ok(camp.whatToDo.steps.some((l) => l.includes('Admins: a passkey or a hardware security key; either is phishing-resistant.')))
  const op = stepById['s-ladder-operator-passkey'] as unknown as { whatToDo: { steps: string[] } }
  assert.ok(op.whatToDo.steps[0].includes('or a hardware security key'), 'step 12 says or')
})

test('the campaign email fills the MFA enforcement day and the window; firstEnforce is gone', () => {
  const { r, dates, ctx } = setUp()
  const camp = r.steps.find((s) => s.id === 's-verify-mfa')!
  const ex = stepVars(camp, ctx()) as Record<string, unknown>
  assert.ok(!('firstEnforce' in ex) && !('firstEnforceLong' in ex), 'firstEnforce and firstEnforceLong are deleted')
  const mfa = r.steps.find((s) => s.goalId === 'mfa-all-users' && s.kind !== 'verify')
  const day = mfa?.events?.enforce?.at ?? dates.firstEnforce!
  assert.equal(ex.mfaEnforce, absoluteDate(day))
  assert.equal(ex.mfaEnforceLong, longDate(day))
  assert.ok(typeof ex.enrolWindowDays === 'number' && ex.enrolWindowDays >= 1, `the window is the plan's (${String(ex.enrolWindowDays)})`)
  const cs = stepById['s-verify-mfa'] as unknown as { comms: { body: string }; who: { timeline: string } }
  assert.deepEqual(missingVars(cs.comms.body, ex), [], 'the email fills every variable')
  assert.match(fillText(cs.comms.body, ex), /over the next \d+ days/)
  assert.deepEqual(missingVars(cs.who.timeline, ex), [], 'the timeline fills {mfaEnforce}')
})

test('the managed-device email says what a personal device can still do, from the plan', () => {
  const { r, ctx } = setUp()
  const md = r.steps.find((s) => s.goalId === 'require-managed-device')!
  const cs = stepById['require-managed-device'] as unknown as { comms: { body: string } }
  // The pinned baseline holds no unmanaged-browser goal: personal devices are blocked.
  const blocked = stepVars(md, ctx()) as Record<string, unknown>
  assert.equal(blocked.personalDevicesClause, engine.personalDevices.blocked)
  // The compliant-device policy waits on this tenant's service-accounts group,
  // so it has no enforcement date to announce; every other variable is filled.
  assert.deepEqual(missingVars(cs.comms.body, blocked), ['enforceLong'])
  assert.ok(fillText(cs.comms.body, { ...blocked, enforceLong: 'a date' }).includes(`Personal devices ${engine.personalDevices.blocked}.`))
  const limited = stepVars(md, ctx({ unmanagedBrowserOnPlan: true })) as Record<string, unknown>
  assert.equal(limited.personalDevicesClause, engine.personalDevices.browserLimited)
  assert.equal((stepVars(md, ctx({ unmanagedBrowserOnPlan: undefined })) as Record<string, unknown>).personalDevicesClause, undefined, 'unknown, the line drops rather than guesses')
})

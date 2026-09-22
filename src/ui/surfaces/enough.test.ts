// One definition of enough (E7; Step 7): admin readiness is the share of admins
// who are Ready for phishing-resistant MFA (scoring/phishingResistant.ts, the
// state the admin lists read), and the campaign and step 12 say "or"; the
// campaign email fills {mfaEnforceLong} and {enrolWindowDays}, the managed-device
// email {personalDevicesClause}, and firstEnforce is gone from the variables.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { curatedFixture, fixture } from '../../roadmap/fixtures/index.ts'
import { runFixture, withFoundationSettled } from '../../roadmap/fixtures/run.ts'
import { planDates, stepVars } from './stepVars.ts'
import type { StepVarContext } from './stepVars.ts'
import { missingVars, fillText } from '../../content/render.ts'
import { commsFor } from './stepExport.ts'
import { isReady } from '../../scoring/phishingResistant.ts'
import { enforcementHeld } from '../../roadmap/operations.ts'
import { engine, stepById } from '../../content/content.ts'
import { absoluteDate, longDate } from '../../copy/dates.ts'
import { adminUserIds } from '../../roles.ts'
import { readinessPercent } from '../../roadmap/readiness.ts'

const setUp = (curated = false) => {
  // The curated run also settles the plan's foundation (roadmap/foundations.ts):
  // until both pinned groups are, every policy is held and the email has no day.
  const f = curated ? withFoundationSettled(curatedFixture('demo-week2')) : fixture('demo-week2')
  const r = runFixture(f)
  const dates = planDates(r.steps, r.schedule.start)
  const ctx = (over: Partial<StepVarContext> = {}): StepVarContext => ({ snapshot: f.snapshot, mapping: f.mapping, nameOf: (id) => r.input.names!.label(id), signature: 'IT', operatorId: f.operatorId, now: f.snapshot.asOf, groups: f.groups, ...dates, ...over })
  return { f, r, dates, ctx }
}

test('admin readiness is the share of admins who are Ready for phishing-resistant MFA', () => {
  const { f, r } = setUp()
  const admins = [...adminUserIds(f.snapshot.roles)]
  const rows = r.viability.filter((v) => admins.includes(v.userId))
  // Ready and Seamless are both Ready (79b66fd8).
  const ready = rows.filter((v) => isReady(v.readiness.state)).length
  const step = r.steps.find((s) => s.goalId === 'admins-phishing-resistant')!
  assert.equal(step.readiness.family, 'admin')
  // Rounded down, the one rounding a readiness percentage has (R4-14,
  // roadmap/readiness.ts readinessPercent): two of three admins is 66%, not 67%.
  assert.equal(step.readiness.percent, readinessPercent(ready, rows.length))
  const camp = stepById['s-verify-mfa'] as unknown as { doneWhen: string[]; whatToDo: { steps: string[] } }
  // Editorial batch C: the admin gate is its own line; the campaign settings check is a human check.
  // mfa-everyone-spec.md §4 C9: Completion Criteria is split so each line says one
  // thing, and the admin gate's line now reads "Every administrator has…".
  assert.ok(camp.doneWhen.some((l) => /Every administrator has a phishing-resistant method/.test(l)))
  assert.equal(camp.doneWhen.length, 3, camp.doneWhen.join(' | '))
  assert.ok(camp.whatToDo.steps.some((l) => l.includes('Admins: a passkey or a hardware security key; either is phishing-resistant.')))
  const op = stepById['s-ladder-operator-passkey'] as unknown as { whatToDo: { steps: string[] } }
  // protect-admins A3: the two methods are now named by the menu entries
  // Microsoft documents, which are different items; the "or" this test owns is
  // the sentence that says either of them finishes the step.
  assert.ok(op.whatToDo.steps.some((l) => l.includes('Either one is enough')), 'step 12 says either')
})

test('the campaign email fills the MFA enforcement day and the window; firstEnforce is gone', () => {
  // On the curated baseline, where week two's plan dates policies: on the pinned
  // one every policy is held and the email has no day to fill (roadmap/holds.ts).
  const { r, dates, ctx } = setUp(true)
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
  assert.match(fillText(cs.comms.body, ex), /[Oo]ver the next \d+ days/)
  assert.ok(fillText(cs.comms.body, ex).includes(String(ex.mfaEnforceLong)), 'the email states the MFA day it fills')
  assert.deepEqual(missingVars(cs.who.timeline, ex), [], 'the timeline fills {mfaEnforce}')
})

test('the managed-device email says what a personal device can still do, from the plan', () => {
  const { r, ctx } = setUp()
  const md = r.steps.find((s) => s.goalId === 'require-managed-device')!
  const cs = stepById['require-managed-device'] as unknown as { comms: { body: string } }
  // The pinned baseline holds no unmanaged-browser goal: personal devices are blocked.
  const blocked = stepVars(md, ctx()) as Record<string, unknown>
  assert.equal(blocked.personalDevicesClause, engine.personalDevices.blocked)
  // The policy's enforcement is held behind a readiness threshold this tenant
  // has not met, so the plan writes it no enforcement day (roadmap/timing.ts
  // eventsFor) and it announces nothing at all: the email states the day the
  // change lands, and there is no such day. Every other variable is filled, so
  // the clause is there the moment the day is.
  assert.ok(enforcementHeld(md), 'the demo holds this step behind device readiness')
  assert.equal(md.events, null, 'a held enforcement takes no date')
  assert.equal(commsFor(cs as unknown as Record<string, unknown>, blocked, md), null, 'and no announcement')
  assert.deepEqual(missingVars(cs.comms.body, blocked), ['enforceLong'])
  assert.ok(fillText(cs.comms.body, { ...blocked, enforceLong: 'a date' }).includes(`Personal devices ${engine.personalDevices.blocked}.`))
  const limited = stepVars(md, ctx({ unmanagedBrowserOnPlan: true })) as Record<string, unknown>
  assert.equal(limited.personalDevicesClause, engine.personalDevices.browserLimited)
  assert.equal((stepVars(md, ctx({ unmanagedBrowserOnPlan: undefined })) as Record<string, unknown>).personalDevicesClause, undefined, 'unknown, the line drops rather than guesses')
})

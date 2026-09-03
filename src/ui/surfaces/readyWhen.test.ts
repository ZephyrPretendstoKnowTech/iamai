// A policy already in report-only says when it may be enforced, from two gates,
// whichever first (tracking.ts): the time gate (in report-only since the scan
// first saw it, plus the observation window) and the evidence gate (the records
// since then show zero failures and every active person in scope). The row's
// date column, the step's Done-when and the status word read one derivation;
// nothing asks the person to mark anything. Over the demo and its week two.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fixture } from '../../roadmap/fixtures/index.ts'
import { runFixture } from '../../roadmap/fixtures/run.ts'
import { stepIdForGoal } from '../../roadmap/generate.ts'
import { applyProgress } from '../../roadmap/progress.ts'
import { observationDaysFor } from '../../roadmap/schedule.ts'
import { reportOnlySeenOf } from '../../roadmap/tracking.ts'
import { readyWhen } from '../../derive/readyWhen.ts'
import { rowWhen } from './rowWhen.ts'
import { statusOf } from './statusWord.ts'
import { stepVars } from './stepVars.ts'
import type { StepVarContext } from './stepVars.ts'
import { doneWhenTemplates } from './doneWhen.ts'
import { fillText, whole } from '../../content/render.ts'
import { absoluteDate } from '../../copy/dates.ts'

const DAY = 86_400_000
const ADMINS = stepIdForGoal('admins-phishing-resistant')
const TOKEN = stepIdForGoal('token-protection')
const TRANSFER = stepIdForGoal('block-auth-transfer')

test('week one: a policy the scan first sees in report-only is ready on the scan date plus its observation window; the row reads Report-only · ready <date>', () => {
  const f = fixture('demo')
  const run = runFixture(f)
  const step = run.steps.find((s) => s.id === ADMINS)!
  assert.equal(step.status, 'in-report-only')
  assert.equal(step.tracking?.reportOnlyAt, f.snapshot.asOf, 'in report-only since the scan that first saw it')
  const readyOn = new Date(Date.parse(f.snapshot.asOf) + observationDaysFor(step) * DAY).toISOString()
  assert.equal(step.tracking?.readyOn, readyOn, 'the time gate: first seen plus the observation window')
  assert.equal(step.tracking?.readyNow, false, 'no records of this policy yet: the evidence gate is not met')
  assert.equal(readyWhen(step)?.kind, 'on')
  assert.equal(statusOf(step).word, 'Report-only')
  assert.equal(rowWhen(step), `ready ${absoluteDate(readyOn)}`)
  // The observation the plan record keeps, so the next scan continues the clock.
  assert.deepEqual(reportOnlySeenOf(run.steps), { [ADMINS]: f.snapshot.asOf })
})

test('week two: the report-only policy with clean, complete records is ready now; the one seen for 24 people waits for its window; the one the tenant turned on is Enforced', () => {
  const f = fixture('demo-week2')
  const run = runFixture(f)
  const token = run.steps.find((s) => s.id === TOKEN)!
  assert.equal(token.status, 'ready-to-enforce')
  assert.equal(token.tracking?.failures, 0)
  assert.ok((token.tracking?.activeInScope ?? 0) > 0)
  assert.equal(token.tracking?.seenInScope, token.tracking?.activeInScope, 'every active person in scope seen at least once')
  assert.equal(token.tracking?.daysInReportOnly, 7)
  assert.equal(readyWhen(token)?.kind, 'now')
  assert.equal(statusOf(token).word, 'Report-only')
  assert.equal(rowWhen(token), 'ready now')

  const transfer = run.steps.find((s) => s.id === TRANSFER)!
  assert.equal(transfer.status, 'in-report-only')
  assert.ok((transfer.tracking?.seenInScope ?? 0) < (transfer.tracking?.activeInScope ?? 0), 'not everyone seen yet')
  assert.equal(readyWhen(transfer)?.kind, 'on')
  assert.equal(rowWhen(transfer), `ready ${absoluteDate(transfer.tracking!.readyOn!)}`)

  const admins = run.steps.find((s) => s.id === ADMINS)!
  assert.equal(admins.status, 'done')
  assert.equal(statusOf(admins).word, 'Enforced')
  assert.equal(readyWhen(admins), null)

  // The step's Done-when: both gates with today's numbers replace the generic lines.
  const ctx: StepVarContext = { snapshot: f.snapshot, mapping: f.mapping, nameOf: (id) => id, signature: 'IT', operatorId: f.operatorId, now: f.snapshot.asOf, firstEnforce: null, reportOnlyAt: run.schedule.reportOnlyAt[TOKEN] ?? null }
  const ex = stepVars(token, ctx)
  const lines = doneWhenTemplates(token, ['{policyDoneWhen}']).filter((x) => whole(x, ex)).map((x) => fillText(x as string, ex))
  assert.ok(lines.some((l) => l.startsWith('Time: in report-only since ') && l.includes(absoluteDate(token.tracking!.reportOnlyAt!))), lines.join('\n'))
  assert.ok(lines.some((l) => l.startsWith('Evidence: ') && l.endsWith('today ready now: 0 failures in 7 days.')), lines.join('\n'))
  assert.ok(!lines.some((l) => /in report-only for \d+ days with no failures/.test(l)), 'the generic gate line is replaced by the gates with numbers')
  assert.ok(lines.some((l) => l.startsWith('After enforcement')), 'the lines after the gates stay')
  const untracked = doneWhenTemplates(transfer, ['{policyDoneWhen}']).map((x) => fillText(x as string, stepVars(transfer, ctx)))
  const seen = `${transfer.tracking!.seenInScope} of ${transfer.tracking!.activeInScope} active people seen in ${transfer.tracking!.daysInReportOnly} days.`
  assert.ok(untracked.some((l) => l.startsWith('Time: ')) && untracked.some((l) => l.endsWith(`today 0 failing or interrupted, ${seen}`)), untracked.join('\n'))
})

test('rescan: a policy still in report-only past its date stays Report-only and reads ready since <date>', () => {
  const f = fixture('demo')
  const run = runFixture(f)
  const seenAt = new Date(Date.parse(f.snapshot.asOf) - 10 * DAY).toISOString()
  applyProgress(run.steps, f.snapshot, run.coverage, f.planId, undefined, null, { [ADMINS]: seenAt })
  const step = run.steps.find((s) => s.id === ADMINS)!
  assert.equal(step.tracking?.reportOnlyAt, seenAt, 'the record\'s observation wins over this scan')
  assert.equal(step.status, 'ready-to-enforce')
  assert.equal(readyWhen(step)?.kind, 'since')
  assert.equal(statusOf(step).word, 'Report-only')
  assert.equal(rowWhen(step), `ready since ${absoluteDate(step.tracking!.readyOn!)}`)
  assert.equal(step.history.at(-1)?.note, `ready since ${absoluteDate(step.tracking!.readyOn!)}`)
})

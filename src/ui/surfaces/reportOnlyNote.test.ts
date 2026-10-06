// Create the Policies in Report-only's note (owner, 2026-09-26): under its cards,
// only where a policy still to create was left out for this tenant, one whole
// sentence naming the type of policy and why. The screen, the print and the
// export read the one value (reportOnlyStep.ts reportOnlyNoteOf).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fixture } from '../../roadmap/fixtures/index.ts'
import { runFixture } from '../../roadmap/fixtures/run.ts'
import { REPORT_ONLY_STEP_ID, reportOnlyOutlierOf, settleReportOnlyBatch, tenantPoliciesOf } from '../../roadmap/reportOnlyBatch.ts'
import type { Step } from '../../roadmap/types.ts'
import { reportOnlyNoteOf } from './reportOnlyStep.ts'
import { stepContract } from './stepContract.ts'
import { stepExportView } from './stepExport.ts'
import { planDates } from './stepVars.ts'
import type { StepVarContext } from './stepVars.ts'

const BOTH = "Some policies aren't listed. Report-only doesn't evaluate user actions, like registering a device, and on a compliant-device policy it can prompt people on Mac, iOS and Android for a certificate. Their own steps create those policies."
const USER = "Some policies aren't listed. Report-only doesn't evaluate user actions, like registering a device. Their own steps create those policies."
const DEVICE = "Some policies aren't listed. On a compliant-device policy, report-only can prompt people on Mac, iOS and Android for a certificate. Their own steps create those policies."
/** The countries policies (owner, 2026-10-04): created on their own step, which the note names. */
const OWN = "Block Sign-ins From Countries Not Allowed isn't listed: its own step creates its policies, from the countries you choose there."
const COUNTRIES = 'geo-restriction'

const f = fixture('demo')
const run = runFixture(f)
const tenant = tenantPoliciesOf(f.snapshot.config.caPolicies?.rows)
const whyOf = (s: Step) => (s.action.resolution?.policies ?? []).map((op) => reportOnlyOutlierOf(op.body as Record<string, unknown>)).find((r) => r !== null) ?? null

/** Demo's plan, with each step the edit names changed, settled again. */
function settled(edit: (s: Step) => void): Step {
  const steps = structuredClone(run.steps)
  for (const s of steps) edit(s)
  settleReportOnlyBatch(steps, tenant)
  return steps.find((s) => s.id === REPORT_ONLY_STEP_ID)!
}

test('the demo leaves out a user-action policy, a compliant-device policy and the countries policies, and the note says all three, on screen and in the export', () => {
  const batch = run.steps.find((s) => s.id === REPORT_ONLY_STEP_ID)!
  assert.deepEqual(batch.reportOnlyBatch?.leftOut, ['userAction', 'deviceCheck'])
  assert.deepEqual(batch.reportOnlyBatch?.ownStep, [COUNTRIES])
  const ctx: StepVarContext = { snapshot: f.snapshot, mapping: f.mapping, nameOf: (x) => run.input.names!.label(x), signature: 'IT', operatorId: f.operatorId, now: f.snapshot.asOf, groups: f.groups, naming: run.coverage.organisation.naming, planSteps: run.steps, ...planDates(run.steps, run.schedule.start, run.coverage.organisation.naming, f.snapshot) }
  assert.equal(stepContract(batch, ctx).batchNote, `${BOTH} ${OWN}`)
  assert.equal(stepExportView(batch, ctx).whatToDo.at(-1), `${BOTH} ${OWN}`, 'the export says it last in What to do, as the screen draws it under the cards')
  assert.equal(reportOnlyNoteOf(run.steps.find((s) => s.id !== REPORT_ONLY_STEP_ID)!), null, 'no other step carries it')
})

test('each type of policy left out is said alone when it is the only one', () => {
  const noDevice = settled((s) => { if (whyOf(s) === 'deviceCheck' || s.goalId === COUNTRIES) s.doesntApply = 'test' })
  assert.equal(reportOnlyNoteOf(noDevice), USER)
  const noUser = settled((s) => { if (whyOf(s) === 'userAction' || s.goalId === COUNTRIES) s.doesntApply = 'test' })
  assert.equal(reportOnlyNoteOf(noUser), DEVICE)
  const onlyCountries = settled((s) => { if (whyOf(s) !== null) s.doesntApply = 'test' })
  assert.equal(reportOnlyNoteOf(onlyCountries), OWN, 'the countries line stands alone')
})

test('a user-action policy already created, or a step set aside, leaves nothing out; with nothing left out there is no note', () => {
  const created = settled((s) => { if (whyOf(s) === 'userAction') s.state.lifecycle = 'enforced' })
  assert.deepEqual(created.reportOnlyBatch?.leftOut, ['deviceCheck'], 'a created policy counts for nothing')
  const none = settled((s) => { if (whyOf(s) !== null || s.goalId === COUNTRIES) s.state.setAside = true as never })
  assert.equal(none.reportOnlyBatch?.leftOut, undefined)
  assert.equal(none.reportOnlyBatch?.ownStep, undefined)
  // Once the countries policy exists, the line goes: nothing of it is left to create.
  const countriesMade = settled((s) => { if (s.goalId === COUNTRIES) s.state.lifecycle = 'report-only' })
  assert.equal(countriesMade.reportOnlyBatch?.ownStep, undefined)
  assert.equal(reportOnlyNoteOf(none), null)
})

test('cards that each point to their own task say it once, in one line under them: 3.8\'s policies and the Lockdown Kit\'s switches (owner, 2026-10-05)', async () => {
  const { oncePerBatch } = await import('./emergencyReadiness.ts')
  const card = (key: string, instruction: string) => ({ key, accountId: null, heading: 'Policy', upn: null, title: 'Create in Report-only', instruction, completed: [], remainingCount: null, satisfied: false })
  const out = oncePerBatch([card('batch:a', 'Follow A in Implementation Tasks.'), card('batch:b', 'Follow B in Implementation Tasks.'), card('batch:c', 'Follow C in Implementation Tasks.'), card('other', 'Keep this.')])
  assert.deepEqual(out.map((c) => c.instruction), ['', '', '', 'Keep this.'], 'no card carries it')
  assert.deepEqual(out.map((c) => c.below ?? null), ["Each policy's steps are in Implementation Tasks.", null, null, null], 'the group says it once, drawn under the cards')
  const kit = oncePerBatch([card('kit:a', 'Follow Create A, turned off in Implementation Tasks.'), card('kit:b', 'Follow Create B, turned off in Implementation Tasks.')])
  assert.deepEqual(kit.map((c) => [c.instruction, c.below ?? null]), [['', "Each switch's steps are in Implementation Tasks."], ['', null]])
  // One card keeps its own pointer: nothing is said twice.
  assert.equal(oncePerBatch([card('batch:a', 'Follow A in Implementation Tasks.')])[0].instruction, 'Follow A in Implementation Tasks.')
  // The tiles section draws the shared line under the grid, never inside a card.
  const view = readFileSync('src/ui/surfaces/ContentStep.tsx', 'utf8')
  assert.ok(view.includes('const below = remaining.find(subject => subject.below)?.below ?? null'))
  assert.ok(view.indexOf('{below && <p') > view.indexOf('emergency-account-status-grid">{remaining.map(tile)}'), 'under the cards')
})

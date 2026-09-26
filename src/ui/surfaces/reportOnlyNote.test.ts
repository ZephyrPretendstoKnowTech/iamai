// Create the Policies in Report-only's note (owner, 2026-09-26): under its cards,
// only where a policy still to create was left out for this tenant, one whole
// sentence naming the type of policy and why. The screen, the print and the
// export read the one value (reportOnlyStep.ts reportOnlyNoteOf).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fixture } from '../../roadmap/fixtures/index.ts'
import { runFixture } from '../../roadmap/fixtures/run.ts'
import { REPORT_ONLY_STEP_ID, reportOnlyOutlierOf, settleReportOnlyBatch, tenantPoliciesOf } from '../../roadmap/reportOnlyBatch.ts'
import type { Step } from '../../roadmap/types.ts'
import { reportOnlyNoteOf } from './reportOnlyStep.ts'
import { stepContract } from './stepContract.ts'
import { stepExportView } from './stepExport.ts'
import { planDates } from './stepVars.ts'
import type { StepVarContext } from './stepVars.ts'

const BOTH = "Some policies aren't listed. Report-only doesn't evaluate user actions, like registering a device, and on a compliant-device policy it can prompt Mac, iOS and Android users for a certificate. Their own steps create those policies."
const USER = "Some policies aren't listed. Report-only doesn't evaluate user actions, like registering a device. Their own steps create those policies."
const DEVICE = "Some policies aren't listed. On a compliant-device policy, report-only can prompt Mac, iOS and Android users for a certificate. Their own steps create those policies."

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

test('the demo leaves out a user-action policy and a compliant-device policy, and the note says both, on screen and in the export', () => {
  const batch = run.steps.find((s) => s.id === REPORT_ONLY_STEP_ID)!
  assert.deepEqual(batch.reportOnlyBatch?.leftOut, ['userAction', 'deviceCheck'])
  const ctx: StepVarContext = { snapshot: f.snapshot, mapping: f.mapping, nameOf: (x) => run.input.names!.label(x), signature: 'IT', operatorId: f.operatorId, now: f.snapshot.asOf, groups: f.groups, naming: run.coverage.organisation.naming, planSteps: run.steps, ...planDates(run.steps, run.schedule.start, run.coverage.organisation.naming, f.snapshot) }
  assert.equal(stepContract(batch, ctx).batchNote, BOTH)
  assert.equal(stepExportView(batch, ctx).whatToDo.at(-1), BOTH, 'the export says it last in What to do, as the screen draws it under the cards')
  assert.equal(reportOnlyNoteOf(run.steps.find((s) => s.id !== REPORT_ONLY_STEP_ID)!), null, 'no other step carries it')
})

test('each type of policy left out is said alone when it is the only one', () => {
  const noDevice = settled((s) => { if (whyOf(s) === 'deviceCheck') s.doesntApply = 'test' })
  assert.equal(reportOnlyNoteOf(noDevice), USER)
  const noUser = settled((s) => { if (whyOf(s) === 'userAction') s.doesntApply = 'test' })
  assert.equal(reportOnlyNoteOf(noUser), DEVICE)
})

test('a user-action policy already created, or a step set aside, leaves nothing out; with nothing left out there is no note', () => {
  const created = settled((s) => { if (whyOf(s) === 'userAction') s.state.lifecycle = 'enforced' })
  assert.deepEqual(created.reportOnlyBatch?.leftOut, ['deviceCheck'], 'a created policy counts for nothing')
  const none = settled((s) => { if (whyOf(s) !== null) s.state.setAside = true as never })
  assert.equal(none.reportOnlyBatch?.leftOut, undefined)
  assert.equal(reportOnlyNoteOf(none), null)
})

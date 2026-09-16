// The shared-devices step (content s-shared-devices) renders its own
// instructions on a baseline with no shared-device policy: the translator has
// no policy to render, so the content's What to do steps carry the portal
// path, the proposed name, the accounts, the trusted network, the block, and
// the people policies the accounts leave.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fixture } from '../../roadmap/fixtures/index.ts'
import { runFixture } from '../../roadmap/fixtures/run.ts'
import { PREREQ_STEP_ID } from '../../roadmap/stepIds.ts'
import { planDates, stepVars } from './stepVars.ts'
import type { StepVarContext } from './stepVars.ts'
import { stepExportView, stepLines } from './stepExport.ts'
import { stepContract } from './stepContract.ts'
import { portalNamesFor, stepPortalLines } from './stepPortal.ts'

const HOLE = /\{[a-zA-Z:]+\}/
// Week two: on day one Require MFA for Everyone lacks the chosen exclusions group, so its step is a held change whose effects are unread (Step 3 correction).
const f = fixture('demo-week2')
const r = runFixture(f)
const ctx: StepVarContext = { snapshot: f.snapshot, mapping: f.mapping, nameOf: (id) => r.input.names!.label(id), signature: 'IT', operatorId: f.operatorId, now: f.snapshot.asOf, groups: f.groups, naming: r.coverage.organisation.naming, ...planDates(r.steps, r.schedule.start, r.coverage.organisation.naming) }
const step = r.steps.find((s) => s.id === 's-shared-devices')!

test('on a baseline with no shared-device policy, the step renders its instructions, whole', () => {
  assert.ok(step, 'the demo has shared devices')
  const ex = stepVars(step, ctx) as Record<string, unknown>
  assert.equal(stepPortalLines(step, portalNamesFor(ctx, ex, step.title)), null, 'the pinned baseline holds no shared-device policy')
  const view = stepExportView(step, ctx)
  // The frozen contract's next action leads, then the step's own lines (stepExport.ts).
  assert.equal(view.whatToDo[0], stepContract(step, ctx).whatToDo.text, 'the export leads with the action the screen states')
  for (const l of view.whatToDo) assert.ok(!HOLE.test(l), `no hole: ${l}`)
  const text = view.whatToDo.join('\n')
  const shared = ex.sharedDevices as string[]
  assert.ok(shared.length > 0)
  assert.ok(text.includes(`Proposed policy name: ${step.naming?.proposed}`), 'the proposed policy name')
  for (const name of shared) assert.ok(text.includes(name), `named shared account: ${name}`)
  assert.match(text, /Boardroom.*00000409-6722-4eda-83dd-bed44631b715/, 'the named account keeps its stable ID')
  assert.equal(view.whatToDo.filter(l => /^\d+\. /.test(l)).length, 6, 'all six setup and verification actions travel')
  assert.match(text, /Confirm the named location in Define the Trusted Network/)
  assert.match(text, /include Any location and exclude only the approved trusted location/)
  assert.match(text, /Grant: Block access\. Start in Report-only/)
  assert.match(text, /Add only the exceptions the device needs/)
  assert.match(text, /do not place shared devices in the emergency-access exclusions group/)
  assert.match(text, /Test the device's actual tasks, including scheduled jobs/)
  assert.match(text, /record the completed review/)
  // The rendered lines carry the same instructions.
  const lines = stepLines(step, ctx)
  for (const l of view.whatToDo) assert.ok(lines.includes(l), `rendered: ${l}`)
})

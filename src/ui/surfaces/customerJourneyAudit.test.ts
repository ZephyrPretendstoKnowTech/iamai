import { test } from 'node:test'
import assert from 'node:assert/strict'
import { usability100 } from '../../testing/usability100.ts'
import { runFixture } from '../../roadmap/fixtures/run.ts'
import { stepBodyOf } from './stepBody.ts'
import { planDates } from './stepVars.ts'

function setup(f = usability100('deployment')) {
  const r = runFixture(f, {}, null, f.snapshot.asOf)
  const ctx = { snapshot:f.snapshot, mapping:f.mapping, nameOf:(id:string)=>r.input.names!.label(id), signature:'IT', operatorId:f.operatorId, now:f.snapshot.asOf, groups:f.groups, directory:r.input.directory, ...planDates(r.steps,r.schedule.start,r.coverage.organisation.naming,f.snapshot) }
  return { f,r,ctx }
}

test('mail-device follow-up is read from the scan: directions on the step and no record to keep', () => {
  // Folded onto Block Legacy Authentication (finding 6). The named accounts'
  // move is read from the sign-in records (walk list 4.x item 4), so the step
  // keeps its directions and asks for no record.
  const {r,ctx} = setup()
  const step = r.steps.find(s=>s.id==='s-goal-block-legacy-auth')!
  assert.ok(step)
  assert.equal(step.manualReview, undefined, 'the mail follow-up still asks for a record')
  assert.ok(stepBodyOf(step,ctx).artifacts.find(a=>a.id==='portal'&&!a.unavailable)?.text().trim())
})

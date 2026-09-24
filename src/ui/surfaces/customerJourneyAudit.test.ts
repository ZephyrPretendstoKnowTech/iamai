import { test } from 'node:test'
import assert from 'node:assert/strict'
import { usability100 } from '../../testing/usability100.ts'
import { runFixture } from '../../roadmap/fixtures/run.ts'
import { stepBodyOf } from './stepBody.ts'
import { planDates } from './stepVars.ts'
import { applyManualReviews, MANUAL_REVIEW_ID, manualBasis, scopeManualBasis } from '../../roadmap/manualWork.ts'
import { setState } from '../../roadmap/lifecycle.ts'

function setup(f = usability100('deployment')) {
  const r = runFixture(f, {}, null, f.snapshot.asOf)
  const ctx = { snapshot:f.snapshot, mapping:f.mapping, nameOf:(id:string)=>r.input.names!.label(id), signature:'IT', operatorId:f.operatorId, now:f.snapshot.asOf, groups:f.groups, directory:r.input.directory, ...planDates(r.steps,r.schedule.start,r.coverage.organisation.naming,f.snapshot) }
  return { f,r,ctx }
}

test('mail-device follow-up exposes manual directions and a reversible completion', () => {
  // Folded onto Block Legacy Authentication (finding 6): the same manual record,
  // on the step that owns the outcome.
  const {f,r,ctx} = setup()
  for (const id of ['s-goal-block-legacy-auth']) {
    const step = r.steps.find(s=>s.id===id)!
    assert.ok(step, id)
    assert.ok(step.manualReview, `${id}: the named devices bring the folded evidence onto the policy step`)
    // The exception cannot be removed from a policy that is not there, so the
    // folded evidence is confirmable only once the policy is in place (finding 6).
    setState(step,{satisfied:true,inPlace:true})
    const body = stepBodyOf(step,ctx)
    assert.ok(body.artifacts.find(a=>a.id==='portal'&&!a.unavailable)?.text().trim(), id)
    const record = {at:f.snapshot.asOf,basis:manualBasis(step,f.snapshot,f.mapping),accountIds:step.population.ids.length ? step.population.ids : [f.snapshot.users.find(u=>u.accountEnabled)!.id],workflow:'Required workflow tested',testedAt:f.snapshot.asOf.slice(0,10),outcome:'passed' as const,exceptionRemoved:true}
    record.basis=scopeManualBasis(record.basis,record)
    const confirmation = {[id]:{[MANUAL_REVIEW_ID]:record}}
    applyManualReviews([step],f.snapshot,confirmation,f.mapping)
    assert.equal(step.status,'done')
    const rescan = structuredClone(f.snapshot)
    rescan.asOf = new Date(Date.parse(rescan.asOf)+86400000).toISOString()
    applyManualReviews([step],rescan,confirmation,f.mapping)
    assert.equal(step.status,'done','scan timestamp does not erase completed work')
    applyManualReviews([step],rescan,{},f.mapping)
    assert.notEqual(step.status,'done','the review can be reopened')
  }
})

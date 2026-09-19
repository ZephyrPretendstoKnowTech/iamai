import { test } from 'node:test'
import assert from 'node:assert/strict'
import { usability100 } from '../../testing/usability100.ts'
import { fixture } from '../../roadmap/fixtures/index.ts'
import { runFixture } from '../../roadmap/fixtures/run.ts'
import { stepBodyOf } from './stepBody.ts'
import { stepExportView } from './stepExport.ts'
import { planDates } from './stepVars.ts'
import { laneViewFor } from './planBoard.ts'
import { applyManualReviews, MANUAL_REVIEW_ID, manualBasis, scopeManualBasis } from '../../roadmap/manualWork.ts'
import { CARVE_OUT_STEP_ID, QUESTION_STEP, answerKey, questionLabels, questionOptions } from '../../roadmap/answers.ts'
import { passkeyCurrentSummary } from '../../roadmap/passkeySettings.ts'

function setup(f = usability100('deployment')) {
  const r = runFixture(f, {}, null, f.snapshot.asOf)
  const ctx = { snapshot:f.snapshot, mapping:f.mapping, nameOf:(id:string)=>r.input.names!.label(id), signature:'IT', operatorId:f.operatorId, now:f.snapshot.asOf, groups:f.groups, directory:r.input.directory, ...planDates(r.steps,r.schedule.start,r.coverage.organisation.naming,f.snapshot) }
  return { f,r,ctx }
}

test('mail-device follow-up exposes manual directions and a reversible completion', () => {
  const {f,r,ctx} = setup()
  for (const id of [CARVE_OUT_STEP_ID.mailDevices, CARVE_OUT_STEP_ID.partner]) {
    const step = r.steps.find(s=>s.id===id)!
    assert.ok(step, id)
    assert.ok(step.manualReview?.readyToConfirm, id)
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

test('travel follow-up remains hidden when recurring destinations change', () => {
  const {f,r} = setup()
  assert.ok(!r.steps.some(step=>step.id===CARVE_OUT_STEP_ID.travel))
  const mapping=structuredClone(f.mapping)
  mapping.questionAnswers![answerKey(QUESTION_STEP.travel,questionLabels(QUESTION_STEP.travel).question!)]=questionOptions(QUESTION_STEP.travel,'question')[0]
  assert.ok(!runFixture({...f,mapping}).steps.some(step=>step.id===CARVE_OUT_STEP_ID.travel))
})

test('generic Entra references include the selected request settings in the step and export', () => {
  const {r,ctx}=setup(fixture('demo'))
  const step=r.steps.find(s=>s.goalId==='register-info-protected')!
  const body=stepBodyOf(step,ctx)
  const portal=body.artifacts.find(a=>a.id==='portal')!.text()
  assert.match(portal,/Settings for This Action/)
  assert.match(portal,/Users → Include: All users/)
  assert.match(portal,/Core - Exclusions/)
  assert.match(stepExportView(step,ctx,laneViewFor(step,r.steps)).whatToDo.join('\n'),/Settings for This Action/)
  assert.equal(body.contract.doneWhen.filter(line=>/enabled state/.test(line)).length,1)
})

test('passkey evidence translates the Graph all-users identifier', () => {
  assert.match(passkeyCurrentSummary({id:'Fido2',state:'enabled',includeTargets:[{id:'all_users'}]}),/Included: All users/)
  assert.doesNotMatch(passkeyCurrentSummary({id:'Fido2',state:'enabled',includeTargets:[{id:'all_users'}]}),/all_users/)
})

test('service confirmation keeps its choices without adding a redundant Entra procedure', () => {
  const {r,ctx}=setup(fixture('demo'))
  const step=r.steps.find(s=>s.id==='s-direction-use')!
  assert.ok(step.directionQuestions)
  assert.equal(stepBodyOf(step,ctx).artifacts.some(a=>a.id==='portal'),false)
})

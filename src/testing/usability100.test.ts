import test from 'node:test'
import assert from 'node:assert/strict'
import { usability100, type Usability100Stage } from './usability100.ts'
import { runFixture } from '../roadmap/fixtures/run.ts'
import { laneReadings, observe } from '../ui/surfaces/planLanes.ts'
import { boardReadingsOf, laneViewAlone, laneViewFor } from '../ui/surfaces/planBoard.ts'
import { stepBodyOf } from '../ui/surfaces/stepBody.ts'
import { stepExportView } from '../ui/surfaces/stepExport.ts'
import { applySkips } from '../roadmap/progress.ts'
import { applyManualReviews, MANUAL_REVIEW_ID, manualBasis, scopeManualBasis } from '../roadmap/manualWork.ts'

function setup(stage: Usability100Stage) {
  const f=usability100(stage),r=runFixture(f,{},null,f.snapshot.asOf)
  const ctx={snapshot:f.snapshot,mapping:f.mapping,nameOf:(id:string)=>r.input.names!.label(id),signature:'IT',operatorId:f.operatorId,now:f.snapshot.asOf,groups:f.groups,directory:r.input.directory,naming:r.coverage.organisation.naming}
  const board=boardReadingsOf(r.steps,r.schedule.cleanup,f.mapping.breakGlassAnswers??null)
  const body=(id:string)=>{const s=r.steps.find(s=>s.id===id)!;assert.ok(s,id);return stepBodyOf(s,ctx,{lane:laneViewFor(s,board)})}
  return {f,r,ctx,body,board}
}
test('100 identities remain stable across deployment stages; drift reopens the admin policy',()=>{
  const stages=['initial','deployment','configured','drift','specialist'] as const
  const runs=stages.map(setup)
  for(const {f,r,ctx,body,board} of runs){
    assert.equal(f.snapshot.users.length,100)
    assert.deepEqual(f.snapshot.users.map(u=>u.id),runs[0].f.snapshot.users.map(u=>u.id))
    for(const s of r.steps){
      const b=body(s.id)
      assert.ok(b.contract.why.trim(),s.id)
      assert.ok(b.contract.doneWhen.length,s.id)
      assert.ok(b.artifacts.find(a=>a.id==='ai')?.text().length!>150,s.id)
      assert.deepEqual(stepExportView(s,ctx,laneViewFor(s,board)).doneWhen,b.contract.doneWhen,s.id)
    }
  }
  assert.equal(runs[2].r.steps.find(s=>s.id==='s-goal-admins-phishing-resistant')!.state.satisfied,true)
  assert.equal(runs[3].r.steps.find(s=>s.id==='s-goal-admins-phishing-resistant')!.state.satisfied,false)
  assert.equal(laneReadings(runs[3].r.steps).get('s-goal-admins-phishing-resistant')?.lane,'Ready')
  assert.equal(laneReadings(runs[3].r.steps).get('s-goal-admins-phishing-resistant')?.substatus,'Correct', 'a safe correction that does not enforce can proceed before final recovery verification')
})
test('shared-device review can finish, survive a rescan, and reopen after a policy edit',()=>{
  const {f,r,body,ctx}=setup('initial');const step=r.steps.find(s=>s.id==='s-shared-devices')!
  assert.ok(step.manualReview?.readyToConfirm)
  assert.match(body(step.id).artifacts.find(a=>a.id==='portal')!.text(),/dedicated access policy|Conditional Access/)
  const record={at:f.snapshot.asOf,basis:'',accountIds:step.population.ids,workflow:'Test shared-device sign-in and application access',outcome:'passed' as const,testedAt:f.snapshot.asOf.slice(0,10)}
  record.basis=scopeManualBasis(manualBasis(step,f.snapshot,f.mapping),record)
  const confirmations={[step.id]:{[MANUAL_REVIEW_ID]:record}}
  applyManualReviews([step],f.snapshot,confirmations,f.mapping)
  assert.equal(step.state.satisfied,true)
  const rescanned=runFixture(f,{manualConfirmations:confirmations},null,f.snapshot.asOf).steps.find(s=>s.id===step.id)!
  assert.equal(rescanned.state.satisfied,true)
  const completed = stepBodyOf(rescanned,ctx,{lane:laneViewAlone(rescanned)})
  assert.match(completed.contract.doneWhen.join(' '),/successful test records the account, task and date/)
  assert.doesNotMatch(completed.contract.doneWhen.join(' '),/scan found the assessed configuration/)
  const refreshed=structuredClone(f.snapshot)
  refreshed.asOf=new Date(Date.parse(refreshed.asOf)+86_400_000).toISOString()
  for(const raw of refreshed.config.caPolicies.rows) (raw as Record<string, unknown>).modifiedDateTime=refreshed.asOf
  assert.equal(manualBasis(rescanned,refreshed),manualBasis(rescanned,f.snapshot),'scan and metadata timestamps do not revoke a review')
  const changed=structuredClone(f.snapshot)
  changed.config.caPolicies.rows.push({ id: 'shared-review-change', state: 'enabled', conditions: { users: { includeUsers: [...rescanned.population.ids] }, applications: { includeApplications: ['All'] } }, grantControls: { builtInControls: ['mfa'] } })
  applyManualReviews([rescanned],changed,confirmations,f.mapping)
  assert.equal(rescanned.state.satisfied,false)
  assert.equal(rescanned.manualReview?.confirmedAt,null)
})
test('an Every time configuration hazard cannot be mistaken for a timed observation',()=>{
  const {r,body}=setup('configured');const s=r.steps.find(s=>s.id==='s-goal-intune-enrollment-reauth')!
  assert.ok(observe(s,new Map(r.steps.map(s=>[s.id,s]))).blockers?.some(b=>b.id==='fact:session-loop'))
  assert.notEqual(laneReadings(r.steps).get(s.id)?.substatus,'Observing')
  assert.match(body(s.id).readiness.tiles.map(t=>t.value+' '+t.note).join(' '),/More observation time will not resolve/)
})

test('deferring a prerequisite does not complete it or release its dependent policies',()=>{
  const {f,r}=setup('initial')
  const id='s-prereq-service-accounts-group'
  applySkips(r.steps,{[id]:{reason:'Service owner needs to review this first',at:f.snapshot.asOf}})
  const readings=laneReadings(r.steps)
  assert.equal(readings.get(id)?.lane,'Deferred')
  assert.equal(r.steps.find(s=>s.id===id)!.state.satisfied,false)
  for(const s of r.steps.filter(s=>s.blockedBy.includes(id))) assert.notEqual(readings.get(s.id)?.lane,'Ready',s.id)
})

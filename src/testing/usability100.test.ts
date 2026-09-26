import test from 'node:test'
import assert from 'node:assert/strict'
import { usability100, type Usability100Stage } from './usability100.ts'
import { runFixture } from '../roadmap/fixtures/run.ts'
import { laneReadings, observe } from '../ui/surfaces/planLanes.ts'
import { boardReadingsOf, laneViewFor } from '../ui/surfaces/planBoard.ts'
import { stepBodyOf } from '../ui/surfaces/stepBody.ts'
import { stepExportView } from '../ui/surfaces/stepExport.ts'
import { applySkips } from '../roadmap/progress.ts'
import { mfaLeavesOutIntune } from '../roadmap/fixtures/intuneMfa.ts'
import type { Fixture } from '../roadmap/fixtures/index.ts'

function setup(stage: Usability100Stage | Fixture) {
  const f=typeof stage==='string'?usability100(stage):stage,r=runFixture(f,{},null,f.snapshot.asOf)
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
test('an Every time configuration hazard cannot be mistaken for a timed observation',()=>{
  // The hazard stands where nothing asks for MFA on the enrollment sign-in: the
  // tenant's MFA policies leave Intune Enrollment out, as the baseline's does (7.3).
  const {fixture:out,changed}=mfaLeavesOutIntune(usability100('configured'))
  assert.ok(changed>0,'the premise: an On MFA policy on All resources')
  const {r,body}=setup(out);const s=r.steps.find(s=>s.id==='s-goal-intune-enrollment-reauth')!
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

import test from 'node:test'
import assert from 'node:assert/strict'
import { fixture, curatedFixture } from '../../roadmap/fixtures/index.ts'
import { runFixture } from '../../roadmap/fixtures/run.ts'
import { stepBodyOf } from './stepBody.ts'
import { stepExportView } from './stepExport.ts'
import type { StepVarContext } from './stepVars.ts'
import { emergencyPasskeyCompatibility } from '../../roadmap/passkeyCompatibility.ts'
import { resolvePasskeyTarget } from '../../roadmap/passkeySettings.ts'
import { addWorkflowSteps, WORKFLOW_STEP } from '../../roadmap/workflows.ts'
import { currentAnswerText, devicePlanOf, deviceScopeOf, parseAnswer, questionOptions, QUESTION_STEP } from '../../roadmap/answers.ts'
import { redactText } from '../../redactSnapshot.ts'
import { proofLabel } from './readinessCells.ts'
import type { Step } from '../../roadmap/types.ts'
import { applyStepDecisions } from '../../roadmap/decisions.ts'
import { applyManualReviews, manualBasis, MANUAL_REVIEW_ID } from '../../roadmap/manualWork.ts'

function setup(name: 'demo' | 'demo-week2' = 'demo') {
 const f = curatedFixture(name); const run = runFixture(f)
 const ctx = {snapshot:f.snapshot,mapping:f.mapping,nameOf:(id:string)=>run.input.names!.label(id),signature:'IT',operatorId:f.operatorId,now:f.snapshot.asOf,groups:f.groups,reportOnlyAt:null} as StepVarContext
 return { f, run, ctx }
}

test('existing manual completion records keep the original persisted basis',()=>{
 const {f,run}=setup();const step={...structuredClone(run.steps[0]),id:'s-ladder-legacy-auth-inventory',manualReview:undefined}
 const users=f.snapshot.users.map(u=>[u.id,u.accountEnabled,u.userType,null,null,null]).sort((a,b)=>String(a[0]).localeCompare(String(b[0])))
 const legacy=JSON.stringify([step.id,users,null]);assert.equal(manualBasis(step,f.snapshot),legacy)
 applyManualReviews([step],f.snapshot,{[step.id]:{[MANUAL_REVIEW_ID]:{at:f.snapshot.asOf,basis:legacy}}})
 assert.equal(step.state.satisfied,true)
})
test('device decision offers technical AI context before a choice and no executable channel',()=>{
 const {run,ctx}=setup(); const step=run.steps.find(s=>s.id===QUESTION_STEP.devices)!; assert.ok(step)
 const body=stepBodyOf(step,ctx);const ai=body.artifacts.find(a=>a.id==='ai')!;
 assert.notEqual(ai.unavailable,true);assert.match(ai.text(),/hybrid join/i);assert.match(ai.text(),/Enrollment alone/);assert.match(ai.text(),/app protection/i)
 assert.ok(body.artifacts.every(a=>a.id!=='ps'&&a.id!=='json'))
})
test('emergency account guidance has no Email placeholder',()=>{
 const {run,ctx}=setup();const body=stepBodyOf(run.steps.find(s=>s.id==='s-prereq-break-glass')!,ctx)
 assert.ok(body.artifacts.every(a=>a.id!=='email'));assert.ok(body.artifacts.some(a=>a.id==='ai'&&!a.unavailable))
})
test('services suggest actual activity without saving it, and preserve a saved No',()=>{
 const f=fixture('demo');const make=()=>{const r=runFixture(f);const steps=structuredClone(r.steps).filter(s=>s.id!==WORKFLOW_STEP);addWorkflowSteps(steps,r.coverage.organisation.notAssessed,f.snapshot,f.mapping);return steps.find(s=>s.id===WORKFLOW_STEP)!}
 const first=make().workflowChoices!.find(c=>c.key==='sharepoint')!;assert.equal(first.suggested,true);assert.equal(first.answer,'unsure')
 f.mapping.workflowAnswers={sharepoint:'no'};const saved=make().workflowChoices!.find(c=>c.key==='sharepoint')!;assert.equal(saved.answer,'no');assert.equal(saved.suggested,false)
})
test('licence alone is not suggested service use',()=>{const f=fixture('demo');const r=runFixture(f);const steps=structuredClone(r.steps).filter(s=>s.id!==WORKFLOW_STEP);addWorkflowSteps(steps,r.coverage.organisation.notAssessed,f.snapshot,f.mapping);assert.notEqual(steps.find(s=>s.id===WORKFLOW_STEP)!.workflowChoices!.find(c=>c.key==='intune')?.suggested,true)})

test('all nine device choices preserve their saved scope through a second save',()=>{
 for(const [phoneIndex,phone] of questionOptions(QUESTION_STEP.devices,'decision').entries()) for(const [computerIndex,computer] of questionOptions(QUESTION_STEP.devices,'question').entries()){
  const f=curatedFixture('demo');const decision={[QUESTION_STEP.devices]:{at:f.snapshot.asOf,option:phone,answers:{Computers:computer}}}
  const first=applyStepDecisions(f.mapping,decision);const second=applyStepDecisions(first,decision)
  assert.deepEqual(devicePlanOf(second),devicePlanOf(first))
  assert.equal(deviceScopeOf(devicePlanOf(second)).phones,phoneIndex===0)
  assert.equal(deviceScopeOf(devicePlanOf(second)).computers,computerIndex!==2)
 }
})

test('sync service suggestion explains the detected role independently of licensing',()=>{
 const f=fixture('demo');const r=runFixture(f);const steps=structuredClone(r.steps).filter(s=>s.id!==WORKFLOW_STEP)
 addWorkflowSteps(steps,r.coverage.organisation.notAssessed,f.snapshot,f.mapping,{},['workload-identity-block'])
 const choice=steps.find(s=>s.id===WORKFLOW_STEP)!.workflowChoices!.find(c=>c.key==='workload')!
 assert.equal(choice.suggested,true);assert.match(choice.evidence,/Directory Synchronization Accounts role found/)
 assert.doesNotMatch(choice.evidence,/no.*licence/)
})
test('old mail exception and device answers still resolve after labels change',()=>{
 assert.equal(currentAnswerText('Yes: add: u1, u2; the service-accounts group carries them'),'Temporary exception accounts: u1, u2')
 assert.deepEqual(parseAnswer('Hybrid join is sufficient',questionOptions(QUESTION_STEP.devices,'question')),{index:1,picked:[]})
})
test('no-data-on-phones adds an explicit manual restriction review in all computer choices',()=>{
 for(const computer of questionOptions(QUESTION_STEP.devices,'question')){
 const f=curatedFixture('demo');const initial=runFixture(f);f.mapping=applyStepDecisions(f.mapping,{[QUESTION_STEP.devices]:{at:f.snapshot.asOf,picked:[],option:'Keep company data off phones',answers:{Computers:computer}}})
 const run=runFixture(f);const step=run.steps.find(s=>s.id==='s-ladder-phone-access-restriction');assert.ok(step,computer);assert.equal(step.state.satisfied,false);assert.ok(step.manualReview)
 }
})
test('fresh passkey configuration allows hardware instead of imposing an Authenticator-only list',()=>{const r=resolvePasskeyTarget(null);assert.equal(r.kind,'target');if(r.kind==='target'){assert.equal(r.restriction,'unrestricted');assert.equal(r.target.keyRestrictions?.isEnforced,false);assert.equal(r.target.isAttestationEnforced,true)}})
test('passkey exclusion wins over All users, and incomplete membership stays unknown',()=>{
 const f=fixture('demo');const id=f.mapping.breakGlassUserIds[0];assert.ok(id)
 const config={id:'Fido2',state:'enabled',includeTargets:[{id:'all_users',allowedPasskeyProfiles:[]}],excludeTargets:[{id:'g'}],isSelfServiceRegistrationAllowed:true,isAttestationEnforced:true,keyRestrictions:{isEnforced:false,enforcementType:'allow',aaGuids:[]}}
 f.snapshot.config.authMethodsPolicy.rows=[{authenticationMethodConfigurations:[config]}]
 assert.equal(emergencyPasskeyCompatibility(f.snapshot,[id],new Map([['g',{memberIds:[id],memberCount:1,sampled:false}]]))[0].state,'excluded')
 assert.equal(emergencyPasskeyCompatibility(f.snapshot,[id],new Map())[0].state,'unknown')
 config.excludeTargets=[];f.snapshot.authMethods[id]=[{kind:'fido2',aaGuid:'11111111-1111-4111-8111-111111111111'}]
 assert.equal(emergencyPasskeyCompatibility(f.snapshot,[id])[0].state,'eligible')
})
test('proof text survives export without relying on a symbol',()=>{assert.equal(proofLabel({mark:'warn',text:'Windows'}),'Proof missing: Windows');assert.equal(proofLabel({mark:'good',text:'Windows'}),'Verified: Windows')})
test('masking retains ordinary counts while masking a department value and avoiding substrings',()=>{const v=new Map([['people','[a department 1]'],['it','[a department 2]']]);assert.equal(redactText('30 people need a security check',v),'30 people need a security check');assert.equal(redactText('People',v),'[a department 1]');assert.equal(redactText('Identity',v),'Identity')})
test('packaged Entra instructions are present in the export for the same current action',()=>{const {run,ctx}=setup();const s=run.steps.find(s=>s.goalId==='register-info-protected')!;const body=stepBodyOf(s,ctx);const portal=body.artifacts.find(a=>a.id==='portal');assert.ok(portal&&!portal.unavailable);const text=stepExportView(s,ctx).whatToDo.join('\n');for(const line of portal.text().replace(/\*\*(.*?)\*\*/g,'$1').split(/\r?\n/).map(x=>x.trim()).filter(Boolean))assert.ok(text.includes(line),line)})

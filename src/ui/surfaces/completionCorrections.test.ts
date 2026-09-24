import test from 'node:test'
import assert from 'node:assert/strict'
import { fixture, curatedFixture } from '../../roadmap/fixtures/index.ts'
import { runFixture } from '../../roadmap/fixtures/run.ts'
import { emergencyPasskeyCompatibility } from '../../roadmap/passkeyCompatibility.ts'
import { resolvePasskeyTarget } from '../../roadmap/passkeySettings.ts'
import { directionSteps } from '../../roadmap/direction.ts'
import { DIRECTION_STEP } from '../../roadmap/directionAnswers.ts'
import { currentAnswerText, devicePlanOf, deviceScopeOf, parseAnswer, questionOptions, QUESTION_STEP } from '../../roadmap/answers.ts'
import { redactText } from '../../redactSnapshot.ts'
import { applyStepDecisions } from '../../roadmap/decisions.ts'
import { applyManualReviews, manualBasis, scopeManualBasis, MANUAL_REVIEW_ID } from '../../roadmap/manualWork.ts'

function setup(name: 'demo' | 'demo-week2' = 'demo') {
 const f = curatedFixture(name); const run = runFixture(f)
 return { f, run }
}

test('legacy inventory reviews track observed legacy accounts and protocols, not unrelated directory accounts',()=>{
 const {f,run}=setup();const step={...structuredClone(run.steps[0]),id:'s-ladder-legacy-auth-inventory',manualReview:undefined}
 const record={at:f.snapshot.asOf,basis:'',accountIds:f.snapshot.evidenceUsage?.legacyAuth.userIds??[],workflow:'Each mail job owner recorded its replacement and follow-up',outcome:'passed' as const,testedAt:f.snapshot.asOf.slice(0,10)}
 record.basis=scopeManualBasis(manualBasis(step,f.snapshot),record)
 applyManualReviews([step],f.snapshot,{[step.id]:{[MANUAL_REVIEW_ID]:record}})
 assert.equal(step.state.satisfied,true)
 const unrelated=f.snapshot.users.find(u=>!record.accountIds.includes(u.id))!;unrelated.accountEnabled=!unrelated.accountEnabled
 applyManualReviews([step],f.snapshot,{[step.id]:{[MANUAL_REVIEW_ID]:record}})
 assert.equal(step.state.satisfied,true)
 applyManualReviews([step],f.snapshot,{[step.id]:{[MANUAL_REVIEW_ID]:{at:record.at,basis:record.basis}}})
 assert.equal(step.state.satisfied,false,'old generic acknowledgement is not a scoped dependency review')
})
const useQuestions=(f:ReturnType<typeof fixture>,goalIds?:string[])=>{const r=runFixture(f);return directionSteps({snapshot:f.snapshot,mapping:f.mapping,notAssessed:r.coverage.organisation.notAssessed,availableGoalIds:goalIds??r.coverage.results.filter(x=>x.status!=='licence-limited').map(x=>x.goal.id)}).find(s=>s.id===DIRECTION_STEP.use)!.directionQuestions!}
test('Direction use suggests a service from actual activity or a detected role, never from a licence alone, and preserves a saved No',()=>{
 {
  const f=fixture('demo');const first=useQuestions(f).find(c=>c.key==='service:sharepoint')!;assert.equal(first.suggested.value,'yes');assert.equal(first.saved,null)
  f.mapping.workflowAnswers={sharepoint:'no'};const saved=useQuestions(f).find(c=>c.key==='service:sharepoint')!;assert.equal(saved.saved?.value,'no')
 }
 {const f=fixture('demo');assert.equal(useQuestions(f).some(c=>c.key==='service:intune'),false)}
})
test('device answers: all nine choices keep their scope through a second save, old labels still resolve, and no-data-on-phones adds a manual restriction review',()=>{
 {
  for(const [phoneIndex,phone] of questionOptions(QUESTION_STEP.devices,'decision').entries()) for(const [computerIndex,computer] of questionOptions(QUESTION_STEP.devices,'question').entries()){
   const f=curatedFixture('demo');const decision={[QUESTION_STEP.devices]:{at:f.snapshot.asOf,option:phone,answers:{Computers:computer}}}
   const first=applyStepDecisions(f.mapping,decision);const second=applyStepDecisions(first,decision)
   assert.deepEqual(devicePlanOf(second),devicePlanOf(first))
   assert.equal(deviceScopeOf(devicePlanOf(second)).phones,phoneIndex===0)
   assert.equal(deviceScopeOf(devicePlanOf(second)).computers,computerIndex!==2)
  }
 }
 {
  assert.equal(currentAnswerText('Yes: add: u1, u2; the service-accounts group carries them'),'Temporary exception accounts: u1, u2')
  assert.deepEqual(parseAnswer('Hybrid join is sufficient',questionOptions(QUESTION_STEP.devices,'question')),{index:1,picked:[]})
 }
 {
  for(const computer of questionOptions(QUESTION_STEP.devices,'question')){
  const f=curatedFixture('demo');f.mapping=applyStepDecisions(f.mapping,{[QUESTION_STEP.devices]:{at:f.snapshot.asOf,picked:[],option:'Keep company data off phones',answers:{Computers:computer}}})
  const run=runFixture(f);const step=run.steps.find(s=>s.id==='s-ladder-phone-access-restriction');assert.ok(step,computer);assert.equal(step.state.satisfied,false);assert.ok(step.manualReview)
  }
 }
})
test('passkey settings: a fresh configuration starts with known approved models, an exclusion wins over All users, and incomplete membership stays unknown',()=>{
 {const r=resolvePasskeyTarget(null);assert.equal(r.kind,'target');if(r.kind==='target'){assert.equal(r.restriction,'allow');assert.equal(r.target.keyRestrictions?.isEnforced,true);assert.equal(r.target.isAttestationEnforced,true)}}
 {
  const f=fixture('demo');const id=f.mapping.breakGlassUserIds[0];assert.ok(id)
  const config={id:'Fido2',state:'enabled',includeTargets:[{id:'all_users',allowedPasskeyProfiles:[]}],excludeTargets:[{id:'g'}],isSelfServiceRegistrationAllowed:true,isAttestationEnforced:true,keyRestrictions:{isEnforced:false,enforcementType:'allow',aaGuids:[]}}
  f.snapshot.config.authMethodsPolicy.rows=[{authenticationMethodConfigurations:[config]}]
  assert.equal(emergencyPasskeyCompatibility(f.snapshot,[id],new Map([['g',{memberIds:[id],memberCount:1,sampled:false}]]))[0].state,'excluded')
  assert.equal(emergencyPasskeyCompatibility(f.snapshot,[id],new Map())[0].state,'unknown')
  config.excludeTargets=[];f.snapshot.authMethods[id]=[{kind:'fido2',aaGuid:'11111111-1111-4111-8111-111111111111',attestationLevel:'attested'}]
  assert.equal(emergencyPasskeyCompatibility(f.snapshot,[id])[0].state,'eligible')
 }
})
test('masking retains ordinary counts while masking a department value and avoiding substrings',()=>{const v=new Map([['people','[a department 1]'],['it','[a department 2]']]);assert.equal(redactText('30 people need a security check',v),'30 people need a security check');assert.equal(redactText('People',v),'[a department 1]');assert.equal(redactText('Identity',v),'Identity')})

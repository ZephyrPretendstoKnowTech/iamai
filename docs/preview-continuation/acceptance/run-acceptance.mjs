// Independent acceptance probes. Run only against an idle, isolated source copy.
// No dependency installation, subprocesses, tenant credentials, or real fetches.
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';

const [sourceArg, outputArg] = process.argv.slice(2);
if (!sourceArg || !outputArg) {
  console.error('Usage: node run-acceptance.mjs <isolated-source-directory> <results-directory>');
  process.exit(2);
}
const source = resolve(sourceArg), output = resolve(outputArg);
const paths = ['src/graph/collect/http.ts', 'src/graph/collect/collectors.ts', 'src/scoring/phishingResistant.ts'];
const hashes = Object.fromEntries(paths.map(p => [p, createHash('sha256').update(readFileSync(join(source,p))).digest('hex')]));
let queue = [], unexpected = [], refreshes = 0;
// Installed before imports; ALL fetches are synthetic. Unexpected calls fail verification.
globalThis.fetch = async (url) => {
  const next = queue.shift();
  if (!next || String(url) !== next.url) {
    unexpected.push(String(url));
    return new Response('{"error":{"message":"unexpected mock request"}}', {status:400});
  }
  return new Response(next.raw ?? JSON.stringify(next.body), {status: next.status ?? 200});
};
const { graphPaged, graphRequest } = await import(pathToFileURL(join(source,paths[0])).href);
const { collectMethodsForUsers } = await import(pathToFileURL(join(source,paths[1])).href);
const { personReadiness, readSignIn, isQualifying } = await import(pathToFileURL(join(source,paths[2])).href);
const tokens = {get:()=> 'SYNTHETIC-NOT-A-CREDENTIAL',refresh:async()=> {refreshes++;return 'SYNTHETIC-NOT-A-CREDENTIAL';}};
const url = 'https://graph.microsoft.com/v1.0/users', page2 = url+'?$skiptoken=SYNTHETIC';
const results=[];
async function test(id,title,fn) {
  queue=[]; unexpected=[]; refreshes=0;
  let error=null;
  try { await fn(); } catch(e) { error=e; }
  const harnessError = unexpected.length || queue.length;
  results.push({id,title,status:harnessError?'HARNESS_ERROR':error?'FAIL':'PASS',detail:harnessError?`Unexpected requests: ${unexpected.join(', ')}; unconsumed responses: ${queue.length}`:error?.message??'Expected outcome observed'});
}
function respond(body, extra={}) { queue.push({url,body,...extra}); }
const paged=()=>graphPaged(tokens,url,{wait:async()=>{}});
await test('H01','A genuinely empty collection remains a successful empty result',async()=>{respond({value:[]});assert.deepEqual(await paged(),[]);});
await test('H02','Valid pagination preserves both pages',async()=>{respond({value:[{id:'a'}],'@odata.nextLink':page2});respond({value:[{id:'b'}]},{url:page2});assert.deepEqual(await paged(),[{id:'a'},{id:'b'}]);});
for(const [id,title,response] of [
  ['H03','Invalid JSON must not become an empty inventory',{raw:'<html>upstream error</html>'}],
  ['H04','Missing value must not become an empty inventory',{body:{}}],
  ['H05','Non-array value must not become an empty inventory',{body:{value:{}}}],
  ['H06','Null response must not become an empty inventory',{body:null}],
]) await test(id,title,async()=>{respond(undefined,response);await assert.rejects(paged);});
await test('H07','Malformed second page must not silently return a complete-looking first page',async()=>{respond({value:[{id:'a'}],'@odata.nextLink':page2});respond({},{url:page2});await assert.rejects(paged);});
await test('H08','Count endpoints still support a numeric response',async()=>{respond(undefined,{raw:'7'});assert.equal((await graphRequest(tokens,url)).count,7);});
await test('H09','Denied collection throws rather than returning empty',async()=>{respond({error:{message:'Denied'}},{status:403});await assert.rejects(paged);});
await test('H10','One expired token can recover without losing data',async()=>{respond({error:{}},{status:401});respond({value:[{id:'a'}]});assert.deepEqual(await paged(),[{id:'a'}]);assert.equal(refreshes,1);});
await test('H11','A cancelled request makes no fetch',async()=>{const c=new AbortController();c.abort();await assert.rejects(()=>graphPaged(tokens,url,{signal:c.signal}));});

const old='2024-01-01T00:00:00Z', now='2026-09-13T00:00:00Z';
const proof={cls:'passkey',os:'Windows',at:now,method:'FIDO2 security key'};
function input() {return {methods:[{kind:'fido2',id:'CURRENT',createdDateTime:old}],registered:[],signIns:{read:true,proofs:[{...proof}],platforms:[{os:'Windows',at:now}]},history:null};}
await test('R01','Current credential with matching platform proof remains Ready',()=>{assert.equal(personReadiness(input()).state,'ready');});
await test('R02','Credential created after proof requires new proof',()=>{const x=input();x.methods[0].createdDateTime=now;x.signIns.proofs[0].at=old;assert.equal(personReadiness(x).state,'needsProof');});
await test('R03','Unknown-date replacement must not inherit proof from a removed credential',()=>{const x=input();delete x.methods[0].createdDateTime;x.signIns.proofs=[];x.history={methods:[{key:'REMOVED',cls:'passkey',firstSeen:old,lastSeen:old,present:false}],proofs:[{...proof,at:old}],platforms:[{os:'Windows',at:old}]};assert.notEqual(personReadiness(x).state,'ready');});
await test('R04','Unread method inventory is Unknown',()=>{const x=input();x.methods='unknown';x.registered=null;assert.equal(personReadiness(x).state,'unknown');});
await test('R05','Unread sign-ins are Unknown',()=>{const x=input();x.signIns.read=false;x.signIns.proofs=null;assert.equal(personReadiness(x).state,'unknown');});
await test('R06','Registration without usage evidence needs proof',()=>{const x=input();x.signIns.proofs=[];assert.equal(personReadiness(x).state,'needsProof');});
await test('R07','A removed credential cannot remain Ready through history',()=>{const x=input();x.methods=[];assert.equal(personReadiness(x).state,'needsSetup');});
await test('R08','Windows evidence does not prove an observed Android platform',()=>{const x=input();x.signIns.platforms.push({os:'Android',at:now});assert.equal(personReadiness(x).state,'needsProof');});
await test('R09','Windows Hello alone can satisfy observed Windows readiness',()=>{const x=input();x.methods=[{kind:'windowsHelloForBusiness',id:'HELLO',createdDateTime:old}];x.signIns.proofs=[{...proof,cls:'windowsHello',method:'Windows Hello for Business'}];assert.equal(personReadiness(x).state,'ready');});
await test('R10','Authenticator push is not phishing-resistant proof',()=>{assert.equal(isQualifying('authenticator'),false);const x=input();x.signIns.proofs=[{...proof,cls:'authenticator',method:'Mobile app notification'}];assert.equal(personReadiness(x).state,'needsProof');});
function signIn(method,errorCode=0) {return {createdDateTime:now,status:{errorCode},deviceDetail:{operatingSystem:'Windows'},authenticationRequirement:'multiFactorAuthentication',authenticationDetails:[{succeeded:true,authenticationMethod:method}]};}
await test('R11','A failed sign-in cannot prove readiness',()=>{assert.equal(readSignIn(signIn('FIDO2 security key',50074)).proof,null);});
await test('R12','Previously satisfied is not fresh method proof',()=>{assert.equal(readSignIn(signIn('Previously satisfied')).proof,null);});
await test('R13','A successful FIDO2 event remains qualifying proof',()=>{assert.equal(readSignIn(signIn('FIDO2 security key')).proof?.cls,'passkey');});

const batchUrl='https://graph.microsoft.com/v1.0/$batch';
const fido=(id)=>({'@odata.type':'#microsoft.graph.fido2AuthenticationMethod',id,createdDateTime:old,displayName:'Synthetic key'});
await test('B01','Batch IDs correlate correctly when responses arrive out of order',async()=>{respond({responses:[{id:'1',status:200,body:{value:[fido('B')]}},{id:'0',status:200,body:{value:[fido('A')]}}]},{url:batchUrl});const r=await collectMethodsForUsers({tokens},['USER-A','USER-B']);assert.equal(r['USER-A'][0].id,'A');assert.equal(r['USER-B'][0].id,'B');});
await test('B02','An inner 403 remains Unknown despite an outer 200',async()=>{respond({responses:[{id:'0',status:403,body:{error:{message:'Denied'}}}]},{url:batchUrl});const r=await collectMethodsForUsers({tokens},['USER-A']);assert.equal(r['USER-A'],'unknown');});
await test('B03','Current FIDO2 creation timestamp survives projection',async()=>{respond({responses:[{id:'0',status:200,body:{value:[fido('A')]}}]},{url:batchUrl});const r=await collectMethodsForUsers({tokens},['USER-A']);assert.equal(r['USER-A'][0].createdDateTime,old);});
await test('B04','Sensitive phone values are excluded from the retained summary',async()=>{respond({responses:[{id:'0',status:200,body:{value:[{'@odata.type':'#microsoft.graph.phoneAuthenticationMethod',id:'PHONE',phoneNumber:'+1-SYNTHETIC-SECRET',smsSignInState:'ready'}]}}]},{url:batchUrl});const r=await collectMethodsForUsers({tokens},['USER-A']);assert.ok(!JSON.stringify(r).includes('+1-SYNTHETIC-SECRET'));});

const counts=Object.fromEntries(['PASS','FAIL','HARNESS_ERROR'].map(s=>[s,results.filter(r=>r.status===s).length]));
const report={generatedAt:new Date().toISOString(),source,node:process.version,hashes,counts,scope:'Synthetic pure-module acceptance probes; no production, UI, deployment, or full policy compiler validation.',results};
mkdirSync(output,{recursive:true});
writeFileSync(join(output,'results.json'),JSON.stringify(report,null,2)+'\n');
writeFileSync(join(output,'results.md'),`# Independent acceptance results\n\nSource: ${source}\n\n${counts.PASS} passed; ${counts.FAIL} failed; ${counts.HARNESS_ERROR} harness errors.\n\nThese are scenario results, not a count of distinct defects or a release certification.\n\n| ID | Result | Scenario |\n|---|---|---|\n`+results.map(r=>`| ${r.id} | ${r.status} | ${r.title} |`).join('\n')+'\n\n## Failure details\n\n'+results.filter(r=>r.status!=='PASS').map(r=>`### ${r.id}\n\n${r.detail}\n`).join('\n'));
console.log(JSON.stringify({counts,output},null,2));
process.exitCode=counts.HARNESS_ERROR?2:counts.FAIL?1:0;

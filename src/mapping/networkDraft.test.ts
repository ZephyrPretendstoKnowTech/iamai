import {test} from 'node:test'
import assert from 'node:assert/strict'
import {emptyMappingState} from './types.ts'
import {NETWORK_STEP, NETWORK_NAME, NETWORK_RANGES, networkDraftOf, validNetworkRanges} from './networkDraft.ts'
import {applyStepDecisions} from '../roadmap/decisions.ts'
test('a saved proposed network is not confused with everyone remote or an existing Entra object', () => {
 const original = emptyMappingState('tenant')
 const saved = applyStepDecisions(original, {[NETWORK_STEP]: {at:'2026-09-16T00:00:00Z',option:'office-network',picked:[],answers:{[NETWORK_NAME]:'Office',[NETWORK_RANGES]:'203.0.113.10/32'}}})
 assert.deepEqual(networkDraftOf(saved), {name:'Office',ranges:['203.0.113.10/32']})
 assert.equal(saved.wizardAnswered.trustedLocations,false)
 assert.deepEqual(saved.trustedLocationIds,[])
 const remote = applyStepDecisions(saved, {[NETWORK_STEP]: {at:'2026-09-16T00:00:00Z',option:'remote',picked:[],answers:{[NETWORK_NAME]:'',[NETWORK_RANGES]:''}}})
 assert.equal(remote.wizardAnswered.trustedLocations,true)
 assert.equal(networkDraftOf(remote),null)
})
test('draft ranges require valid CIDR syntax and cannot cover the whole internet', () => {
 for(const range of ['203.0.113.1/32','2001:db8::/64']) assert.equal(validNetworkRanges(range),true)
 for(const range of ['','203.0.113.999/32','0.0.0.0/0','::/0','bad/24','2001:broken::/64']) assert.equal(validNetworkRanges(range),false,range)
})

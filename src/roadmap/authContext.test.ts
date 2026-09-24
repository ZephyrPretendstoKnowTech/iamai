// The one reading of "another of the tenant's policies already targets the
// authentication context this step's policy would target" (R4-18 review): it
// holds a policy the plan would put on a context in use for something the plan
// did not make, and nothing else.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { contextsTakenElsewhere } from './authContext.ts'
import type { PolicyOperation } from './types.ts'

const on = (...contexts: string[]): Record<string, unknown> => ({ conditions: { applications: { includeAuthenticationContextClassReferences: contexts } } })
const create = (...contexts: string[]): PolicyOperation => ({ mode: 'create', body: on(...contexts) }) as unknown as PolicyOperation
const update = (policyId: string, ...contexts: string[]): PolicyOperation => ({ mode: 'update', policyId, body: { state: 'enabled' }, target: on(...contexts) }) as unknown as PolicyOperation
const row = (id: string, state: string, ...contexts: string[]): Record<string, unknown> => ({ id, state, displayName: id, ...on(...contexts) })

test('a context another policy targets holds a create, whatever its state or case; never the step\'s own policy, and an update only on a context it adds', () => {
  // a create on a context another policy targets is held on that context, whatever the other policy’s state or the ID’s case
  {
    assert.deepEqual(contextsTakenElsewhere([create('c1')], [row('labels', 'enabled', 'C1')]), ['c1'])
    assert.deepEqual(contextsTakenElsewhere([create('c1')], [row('old', 'disabled', 'c1')]), ['c1'], 'a switched-off policy still names the context')
    assert.deepEqual(contextsTakenElsewhere([create('c1')], [row('other', 'enabled', 'c2')]), [])
    assert.deepEqual(contextsTakenElsewhere([create('c1')], []), [])
  }

  // the step’s own policies are never another policy
  {
    // A policy carrying this plan's tag for the step — say one the tenant switched off.
    assert.deepEqual(contextsTakenElsewhere([create('c1')], [row('ours', 'disabled', 'c1')], ['OURS']), [])
  }

  // an update is held only on a context it adds, never on the targets the tenant’s policy already has
  {
    const rows = [row('pim', 'enabled', 'c7'), row('labels', 'enabled', 'c7', 'c1')]
    // The tenant's own policy keeps its own context, which another policy shares: the tenant's choice.
    assert.deepEqual(contextsTakenElsewhere([update('pim', 'c7')], rows), [])
    // An update that moves it onto c1, which another policy targets, is held.
    assert.deepEqual(contextsTakenElsewhere([update('pim', 'c1')], rows), ['c1'])
    // The policy being changed is not "another" policy for its own targets.
    assert.deepEqual(contextsTakenElsewhere([update('labels', 'c7', 'c1')], rows), [])
  }
})

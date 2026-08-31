// The hash router never rewrites an MSAL auth response (prompt 47.1 Part 1):
// the sign-in on the live site depended on a fragment the first render wiped.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { isAuthResponseHash, resolveHash } from './routes.ts'

test('an auth response in the fragment is home, and is never rewritten', () => {
  const responses = [
    '#code=0.AXkA…&client_info=eyJ1aWQi…&state=eyJpZCI6…&session_state=abc',
    '#error=interaction_required&error_description=AADSTS50058&state=eyJpZCI6…',
    '#access_token=eyJ0eXAi…&token_type=Bearer&expires_in=3599&state=abc&client_info=def',
    '#id_token=eyJ0eXAi…&state=abc&client_info=def',
    '#state=ghi&client_info=def&something=else',
  ]
  for (const h of responses) {
    assert.equal(isAuthResponseHash(h), true, h)
    assert.deepEqual(resolveHash(h), { route: 'home', redirect: null }, h)
  }
})

test('routes and redirects are as they were', () => {
  assert.deepEqual(resolveHash('#/connect'), { route: 'connect', redirect: null })
  assert.deepEqual(resolveHash('#/start'), { route: 'connect', redirect: '#/connect' })
  assert.deepEqual(resolveHash('#'), { route: 'home', redirect: null })
  assert.deepEqual(resolveHash(''), { route: 'home', redirect: null })
  assert.deepEqual(resolveHash('#/roadmap/step/x'), { route: 'plan', redirect: '#/plan/x' })
  assert.deepEqual(resolveHash('#/plan/s-goal-mfa-all-users'), { route: 'plan', redirect: null })
  assert.deepEqual(resolveHash('#/plan'), { route: 'plan', redirect: null })

  assert.deepEqual(resolveHash('#/nonsense'), { route: 'connect', redirect: '#/connect' })
  for (const h of ['#/connect', '#/start', '#', '#/roadmap/step/x', '#/today?state=1']) assert.equal(isAuthResponseHash(h), false, h)
})

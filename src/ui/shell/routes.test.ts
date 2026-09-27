// The hash router never rewrites an MSAL auth response (prompt 47.1 Part 1):
// the sign-in on the live site depended on a fragment the first render wiped.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { isAuthResponseHash, planTabsOn, resolveHash } from './routes.ts'

test('an auth response in the fragment is home and never rewritten; every other route and legacy redirect resolves as it was', () => {
  {
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
  }
  {
    const destination = { route: 'how', redirect: null }
    assert.deepEqual(resolveHash('#/how#package'), destination)
    for (const legacy of ['#/package', '#/baseline/package']) {
      const first = resolveHash(legacy)
      assert.equal(first.route, 'how')
      assert.deepEqual(resolveHash(first.redirect!), destination)
    }
  }
  {
    assert.deepEqual(resolveHash('#/connect'), { route: 'connect', redirect: null })
    assert.deepEqual(resolveHash('#/start'), { route: 'connect', redirect: '#/connect' })
    assert.deepEqual(resolveHash('#'), { route: 'home', redirect: null })
    assert.deepEqual(resolveHash(''), { route: 'home', redirect: null })
    assert.deepEqual(resolveHash('#/roadmap/step/x'), { route: 'plan', redirect: '#/plan/x' })
    assert.deepEqual(resolveHash('#/plan/s-goal-mfa-all-users'), { route: 'plan', redirect: null })
    assert.deepEqual(resolveHash('#/plan'), { route: 'plan', redirect: null })

    assert.deepEqual(resolveHash('#/nonsense'), { route: 'connect', redirect: '#/connect' })
    for (const h of ['#/connect', '#/start', '#', '#/roadmap/step/x', '#/today?state=1']) assert.equal(isAuthResponseHash(h), false, h)
  }
})

test('Plan, MFA Readiness and Export stay live through a rescan, and wait only for the first scan (F-168)', () => {
  assert.equal(planTabsOn('scanned', true), true)
  // A rescan over a plan: the last plan is on screen, so the header reaches it.
  assert.equal(planTabsOn('scanning', true), true)
  // The first scan: nothing to show yet.
  assert.equal(planTabsOn('scanning', false), false)
  assert.equal(planTabsOn('noScan', false), false)
  assert.equal(planTabsOn('signedOut', false), false)
  const shell = readFileSync('src/ui/shell/AppShell.tsx', 'utf8')
  assert.match(shell, /const tabsOn = planTabsOn\(state, snapshot !== null\)/)
})

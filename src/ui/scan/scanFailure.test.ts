// A scan that stopped because Microsoft's session needs a fresh sign-in (2026-10-06:
// a tab left overnight stopped its scan with MSAL's raw "timed_out: See
// https://aka.ms/msal.js.errors#timed_out", under a strip still reading Ready to plan).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { renewalTimedOut } from '../../graph/collect/tokenGate.ts'
import { connectStatus, scanFailedLine } from './connectView.ts'
import { app, pages } from '../../content/content.ts'

const C = app.connect as unknown as { failed: string; failedSession: string }
const S = (pages.connect as unknown as { status: { ready: string; failed: string } }).status

test('a silent renewal that timed out needs a sign-in, like an expired session; anything else is still an error', () => {
  assert.equal(renewalTimedOut({ errorCode: 'timed_out' }), true)
  assert.equal(renewalTimedOut({ errorCode: 'monitor_window_timeout' }), true)
  assert.equal(renewalTimedOut({ errorCode: 'user_cancelled' }), false)
  assert.equal(renewalTimedOut(new Error('timed_out')), false, 'only MSAL\'s own code, never a message that mentions it')
  assert.equal(renewalTimedOut(null), false)
  // The token door falls back to the sign-in for it, as it does for interaction_required.
  assert.match(readFileSync('src/graph/msal.ts', 'utf8'), /if \(e instanceof InteractionRequiredAuthError \|\| renewalTimedOut\(e\)\) \{/)
})

test('a scan stopped by the session says what to do, never MSAL\'s code or link; any other reason is quoted', () => {
  for (const raw of ['timed_out: See https://aka.ms/msal.js.errors#timed_out for details', 'interaction_required: AADSTS50076', 'login_required', 'Microsoft session expired']) {
    const line = scanFailedLine(raw)
    assert.equal(line, C.failedSession, raw)
    assert.doesNotMatch(line, /aka\.ms|timed_out|AADSTS/)
  }
  assert.equal(scanFailedLine('Graph answered 503'), C.failed.replace('{why}', 'Graph answered 503'))
  assert.match(C.failedSession, /Sign out, sign in again, then select Scan again/)
})

test('the status strip says the scan did not finish over a stopped scan, never Ready to plan', () => {
  const stage = { title: 't', state: 's', tone: null }
  const ready = connectStatus([true, true, true, true], [stage, stage, stage, stage])
  assert.equal(ready.title, S.ready, 'the premise: every stage done reads ready')
  const stopped = connectStatus([true, true, true, true], [stage, stage, stage, stage], C.failedSession)
  assert.deepEqual(stopped, { tone: 'stop', title: S.failed, text: C.failedSession })
  const view = readFileSync('src/ui/surfaces/Connect.tsx', 'utf8')
  assert.ok(view.includes("connectStatus(done, [t1, baselineStrings(baseline, baselineBusy), t3, t4], !scanning && runner.state === 'failed' && runner.error ? scanFailedLine(runner.error) : null)"))
  assert.ok(readFileSync('src/ui/shell/AppShell.tsx', 'utf8').includes('{scanFailedLine(scan.error)}'), 'the shell line reads the same')
})

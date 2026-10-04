// F-180: a tenant with no Conditional Access policy on and security defaults off
// was never told that nobody is asked for MFA today. The Plan says it above its
// tiles and the printed briefing in its introduction, from the per-user MFA
// reading beside the policies and security defaults, and only where the scan
// read every part of it.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fixture } from '../../roadmap/fixtures/index.ts'
import { pages } from '../../content/content.ts'
import { fillText } from '../../content/render.ts'
import { mfaTodayLine } from './mfaToday.ts'
import type { MfaTodaySnapshot } from './mfaToday.ts'
import type { TenantSnapshot } from '../../graph/collect/types.ts'

const W = (pages.plan as unknown as { mfaToday: { nobody: string; perUserOnly: string } }).mfaToday

// The GetIAMAI shape: no Conditional Access policy, security defaults off.
const base = fixture('getiamai').snapshot
const perUser = (state: 'disabled' | 'enabled' | 'enforced' | 'unknown', over: Record<string, typeof state> = {}): TenantSnapshot['perUserMfa'] =>
  Object.fromEntries(base.users.map((u) => [u.id, { state: over[u.id] ?? state, reason: null }]))
const read = (over: Partial<MfaTodaySnapshot>): MfaTodaySnapshot => ({ config: base.config, sources: base.sources, users: base.users, perUserMfa: perUser('disabled'), ...over })
const signIn = base.users.filter((u) => u.accountEnabled !== false)

test('the premise: no policy, security defaults off, every part read', () => {
  assert.equal(base.config.caPolicies.status, 'ok')
  assert.equal(base.config.caPolicies.rows.length, 0)
  assert.equal((base.config.securityDefaults.rows[0] as { isEnabled?: boolean }).isEnabled, false)
  assert.ok(signIn.length >= 2)
})

test('nobody is asked for MFA today, where no policy is on, security defaults are off and per-user MFA is off for everyone', () => {
  assert.equal(mfaTodayLine(read({})), W.nobody)
})

test('only per-user MFA asks, on the accounts it still asks', () => {
  assert.equal(mfaTodayLine(read({ perUserMfa: perUser('disabled', { [signIn[0].id]: 'enforced', [signIn[1].id]: 'enabled' }) })), fillText(W.perUserOnly, { accounts: '2 accounts' }))
  // A disabled account signs in to nothing, so its per-user state is not counted.
  const users = base.users.map((u) => (u.id === signIn[1].id ? { ...u, accountEnabled: false } : u))
  assert.equal(mfaTodayLine(read({ users, perUserMfa: perUser('disabled', { [signIn[0].id]: 'enforced', [signIn[1].id]: 'enabled' }) })), fillText(W.perUserOnly, { accounts: '1 account' }))
})

test('nothing where something asks for MFA, or where any part was not read', () => {
  const enabled = { ...base.config, caPolicies: { ...base.config.caPolicies, rows: [{ id: 'p', displayName: 'Require MFA', state: 'enabled' }] } }
  assert.equal(mfaTodayLine(read({ config: enabled })), null, 'a policy is on')
  const reportOnly = { ...base.config, caPolicies: { ...base.config.caPolicies, rows: [{ id: 'p', displayName: 'Require MFA', state: 'enabledForReportingButNotEnforced' }] } }
  assert.equal(mfaTodayLine(read({ config: reportOnly })), W.nobody, 'a report-only policy asks nobody')
  assert.equal(mfaTodayLine(read({ config: { ...base.config, securityDefaults: { ...base.config.securityDefaults, rows: [{ isEnabled: true }] } } })), null, 'security defaults on')
  assert.equal(mfaTodayLine(read({ config: { ...base.config, securityDefaults: { status: 'disabled', reason: 'refused', rows: [] } } })), null, 'security defaults not read')
  assert.equal(mfaTodayLine(read({ config: { ...base.config, caPolicies: { status: 'partial', reason: 'stopped', rows: [] } } })), null, 'policies read in part')
  assert.equal(mfaTodayLine(read({ perUserMfa: undefined })), null, 'a scan from before per-user MFA was read')
  assert.equal(mfaTodayLine(read({ perUserMfa: perUser('disabled', { [signIn[0].id]: 'unknown' }) })), null, 'an account whose per-user state came back unknown')
  assert.equal(mfaTodayLine(read({ sources: { ...base.sources, users: { ...base.sources.users, status: 'partial' } } })), null, 'people read in part')
})

test('the Plan says it above its tiles, and the briefing in its introduction', () => {
  const plan = readFileSync('src/ui/surfaces/Plan.tsx', 'utf8')
  assert.ok(plan.indexOf('mfaTodayLine(scan.snapshot)') > 0)
  assert.ok(plan.indexOf('plan-mfa-today') < plan.indexOf('plan-progress-tiles'), 'the line sits above the tiles')
  const print = readFileSync('src/ui/surfaces/PrintPlan.tsx', 'utf8')
  assert.ok(print.indexOf('mfaTodayLine(tenant)') > 0)
  assert.ok(print.indexOf('brief-mfa-today') > print.indexOf('brief-status') && print.indexOf('brief-mfa-today') < print.indexOf('brief-cards'), 'in the introduction, under the status line')
})

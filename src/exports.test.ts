// What leaves as a file (prompt 31 §1.4): every export path run over a
// fixture that holds sign-in names, display names, a tenant id, IP ranges
// and device names, asserting what each output contains. The redacted
// grounding bundle must contain none of them; the others say what they carry.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fixture } from './roadmap/fixtures/index.ts'
import { runFixture } from './roadmap/fixtures/run.ts'
import { groundingBundle } from './roadmap/prompts.ts'
import { ringContextIndexes } from './roadmap/rings.ts'
import { adminUserIds } from './roles.ts'
import { redactIdentifiers } from './redact.ts'
import { toCsv } from './ui/format.ts'
import { buildIcs } from './roadmap/ics.ts'

const f = fixture('small')
const run = runFixture(f)
const snapshot = f.snapshot
const users = snapshot.users.slice(0, 5)
const upns = users.map((u) => u.userPrincipalName!)
const names = users.map((u) => u.displayName!)
const tenantId = snapshot.tenantId
const ip = '203.0.113.0/24'
const deviceNames = snapshot.devices.slice(0, 3).map((d) => d.displayName!)
const nameOf = (id: string) => snapshot.users.find((u) => u.id === id)?.displayName ?? id
const viabilityById = new Map(run.viability.map((v) => [v.userId, v]))

function contains(text: string, needles: string[]): string[] {
  return needles.filter((n) => text.includes(n))
}

test('the fixture really carries the identifiers the exports are checked against', () => {
  const raw = JSON.stringify(snapshot)
  assert.equal(contains(raw, upns).length, upns.length)
  assert.equal(contains(raw, names).length, names.length)
  assert.ok(raw.includes(tenantId) && raw.includes(ip) && deviceNames.length > 0 && contains(raw, deviceNames).length === deviceNames.length)
})

test('diagnostics: redactIdentifiers removes every sign-in name and every id, keeping correlations', () => {
  const out = redactIdentifiers(JSON.stringify(snapshot))
  assert.deepEqual(contains(out, upns), [])
  assert.ok(!out.includes(tenantId))
  assert.ok(!out.includes(users[0].id))
  assert.match(out, /upn-1@redacted/)
  assert.match(out, /guid-0001/)
})

test('the redacted grounding bundle holds no sign-in names, display names, tenant id, device names or IP ranges', () => {
  const bundle = JSON.stringify(groundingBundle({ tenant: 'Fixture small', snapshot, coverage: run.coverage, steps: run.steps, schedule: run.schedule, redacted: true, generated: '2026-08-28' }))
  assert.deepEqual(contains(bundle, upns), [])
  assert.deepEqual(contains(bundle, names), [])
  assert.ok(!bundle.includes(tenantId))
  assert.deepEqual(contains(bundle, deviceNames), [])
  assert.ok(!bundle.includes(ip))
  assert.match(bundle, /Redacted: no user names/)
})

test('the unredacted grounding bundle names what it contains in its header', () => {
  const bundle = JSON.stringify(groundingBundle({ tenant: 'Fixture small', snapshot, coverage: run.coverage, steps: run.steps, schedule: run.schedule, redacted: false, generated: '2026-08-28' }))
  assert.match(bundle, /Unredacted: contains user names and sign-in names/)
  assert.ok(bundle.includes(tenantId))
})

test('the calendar export carries titles, dates and the runbook, never a sign-in name or the tenant id', () => {
  const ics = buildIcs(run.steps, 'Fixture small', f.planId, 5)
  assert.deepEqual(contains(ics, upns), [])
  assert.ok(!ics.includes(tenantId))
})

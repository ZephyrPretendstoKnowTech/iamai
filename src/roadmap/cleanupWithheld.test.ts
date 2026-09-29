// The Cleanup rows held back from every plan for now (owner, 2026-09-28): Alert
// on Emergency Account Sign-ins, Remove Emergency Accounts Excluded by Name and
// Review Overlapping Policies are not finished enough to ship. Align Policy
// Names, the recovery drill and deferred hardening stay. Nothing on a step points
// to a row that is not drawn. Bringing a row back is taking its kind out of
// WITHHELD_CLEANUP; this file then says which.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { WITHHELD_CLEANUP, cleanupRows } from './cleanup.ts'
import { fixture } from './fixtures/index.ts'
import type { FixtureName } from './fixtures/index.ts'
import { runFixture, withFoundationSettled } from './fixtures/run.ts'
import { cleanup, shared, stepById } from '../content/content.ts'

test('Alert on Emergency Account Sign-ins, Remove Emergency Accounts Excluded by Name and Review Overlapping Policies are held back; Align Policy Names, the drill and hardening are not', () => {
  assert.deepEqual([...WITHHELD_CLEANUP].sort(), ['alerting', 'consolidation', 'namedExclusions'])
  const every = cleanupRows({ emergencyAccounts: ['a'], emergencyAccountUpns: ['a@x'], renames: ['b → c'], overlaps: ['d, e'], hardening: ['f'], namedExclusions: ['g'] })
  assert.deepEqual(every.map((r) => r.kind), ['drill', 'hardening', 'naming'])
})

test('no plan draws a held-back Cleanup row, on any sample tenant, before or after its foundation is settled', () => {
  const names: FixtureName[] = ['demo', 'demo-week2', 'getiamai', 'small', 'mid', 'hostile']
  let rows = 0
  for (const name of names) {
    for (const f of [fixture(name), withFoundationSettled(fixture(name))]) {
      const kinds = (runFixture(f).schedule.cleanup?.rows ?? []).map((r) => r.kind)
      rows += kinds.length
      for (const k of kinds) assert.ok(!WITHHELD_CLEANUP.has(k), `${name}: draws ${k}`)
    }
  }
  assert.ok(rows > 0, 'the premise: the plans draw Cleanup rows')
})

test('no step’s words point to a held-back row', () => {
  const titles = [...WITHHELD_CLEANUP].map((k) => String((cleanup as unknown as Record<string, { title?: string } | undefined>)[k]?.title ?? ''))
  assert.ok(titles.every((t) => t.length > 0), `the premise: each held-back row has a title: ${titles}`)
  const lines = [String(shared.existingCoverage), String((stepById['s-prereq-break-glass'] as { whatToDo?: { checkFixes?: Record<string, string> } }).whatToDo?.checkFixes?.['sign-in-alerting'] ?? '')]
  assert.ok(lines[1].length > 0, 'the premise: the sign-in alerting fix line exists')
  for (const line of lines) for (const t of titles) assert.ok(!line.includes(t), `"${line}" names ${t}`)
})

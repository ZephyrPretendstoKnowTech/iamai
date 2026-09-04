// Prompt 52 Part 3: the Cleanup phase renders with its rows and the finish date
// includes it (target-state §5, §9). Cleanup is dated after the last enforcement
// window, one working day per row, no notice, no rings; a Cleanup with nothing
// to say does not exist; the header's finish is the end of the last phase.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { allFixtures, fixture } from './fixtures/index.ts'
import { runFixture } from './fixtures/run.ts'
import { cleanupPhaseFor } from './cleanupPhase.ts'
import { planFinish } from '../derive/finish.ts'
import { isWorkingDay } from './timing.ts'
import { cleanup as cleanupContent } from '../content/content.ts'

const ORDER = ['alerting', 'drill', 'naming', 'consolidation', 'notAssessed']

test('the demo has a Cleanup phase: dated after the last enforcement, one working day per row, in render order', () => {
  const f = fixture('demo')
  const r = runFixture(f)
  const c = r.schedule.cleanup
  assert.ok(c, 'the demo has emergency accounts and unassessed baseline policies, so Cleanup has rows')
  assert.ok(c.rows.length >= 2)
  const kinds: string[] = c.rows.map((x) => x.kind)
  assert.deepEqual(kinds, ORDER.filter((k) => kinds.includes(k)), 'rows keep the §5 order')
  assert.ok(kinds.includes('alerting') && kinds.includes('drill'), 'the emergency accounts give alerting and the drill')
  assert.ok(kinds.includes('notAssessed'), 'the pinned baseline carries policies IAMAI does not assess')
  assert.ok(c.start > r.schedule.targetEnd, 'Cleanup starts after the last enforcement window')
  const ctx = r.schedule.rhythm ? { rhythm: r.schedule.rhythm } : undefined
  for (const [i, row] of c.rows.entries()) {
    assert.ok(ctx ? isWorkingDay(row.day, ctx) : true, `${row.kind} lands on a working day`)
    if (i > 0) assert.ok(row.day > c.rows[i - 1].day, `${row.kind} follows ${c.rows[i - 1].kind}`)
    assert.ok((cleanupContent as Record<string, unknown>)[row.kind], `${row.kind} has its prose in content.cleanup`)
  }
  assert.equal(c.start, c.rows[0].day)
  assert.equal(c.end, c.rows[c.rows.length - 1].day)
  // The alert rule lists sign-in names; the drill lists accounts by name.
  const alerting = c.rows.find((x) => x.kind === 'alerting')!
  assert.equal(alerting.lists.emergencyAccountUpns.length, f.mapping.breakGlassUserIds.length)
  for (const upn of alerting.lists.emergencyAccountUpns) assert.match(upn, /@/, 'a sign-in name, not a display name')
  assert.deepEqual(c.accountIds, f.mapping.breakGlassUserIds)
})

test('the finish date is the end of the last phase, Cleanup included; a held plan stays undated', () => {
  // Week two: its policies name nothing the tenant lacks, so they are on the
  // calendar. A tenant whose Preparation work is still to do has nothing dated.
  const r = runFixture(fixture('demo-week2'))
  const c = r.schedule.cleanup!
  const without = planFinish(r.steps)
  const withCleanup = planFinish(r.steps, c.end)
  assert.ok(without.finish, 'the demo enforces something on the calendar')
  assert.equal(withCleanup.finish, c.end, 'Cleanup ends the plan')
  assert.ok(withCleanup.finish! > without.finish!, 'later than the last enforcement')
  assert.deepEqual(withCleanup.waiting, without.waiting, 'what waits on readiness is unchanged')
  // Nothing dated by the calendar: Cleanup does not invent a finish.
  const held = planFinish([], c.end)
  assert.equal(held.finish, null)
})

test('a Cleanup with nothing to say does not exist', () => {
  const organisation = { notInBaseline: [], notAssessed: [], consolidation: [], naming: { pattern: null, share: 0, outliers: [], prefix: null, separator: null, convention: null, unprefixed: [], names: [] }, microsoftManaged: [] }
  const none = cleanupPhaseFor({ after: '2026-10-05T00:00:00.000Z', rhythm: null, emergencyAccountIds: [], emergencyAccounts: [], emergencyAccountUpns: [], organisation })
  assert.equal(none, null)
  // Outliers without a usable convention propose no rename (nothing to follow).
  const outliersOnly = cleanupPhaseFor({ after: '2026-10-05T00:00:00.000Z', rhythm: null, emergencyAccountIds: [], emergencyAccounts: [], emergencyAccountUpns: [], organisation: { ...organisation, naming: { ...organisation.naming, outliers: ['Odd name'] } } })
  assert.equal(outliersOnly, null)
})

test('every fixture with emergency accounts dates Cleanup after its schedule, on working days', () => {
  for (const f of allFixtures()) {
    const r = runFixture(f)
    const c = r.schedule.cleanup
    if (f.mapping.breakGlassUserIds.length === 0) continue
    assert.ok(c, `${f.name}: emergency accounts give Cleanup at least the alerting and drill rows`)
    assert.ok(c.start > r.schedule.targetEnd, `${f.name}: Cleanup follows the last enforcement window`)
    assert.ok(c.end >= c.start)
  }
})

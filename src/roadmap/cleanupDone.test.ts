// Cleanup completion (E3): a Done records the row's date in the checkpoints and
// the row reads done <date>; the drill's date exempts the matching emergency
// sign-in from the emergency-access step's recent-sign-in check; the naming row
// renders renames as from → to; the consolidation row exists whenever a step's
// existingCoverage line rendered; the not-assessed row's note names the policy
// and the reason.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fixture } from './fixtures/index.ts'
import { runFixture } from './fixtures/run.ts'
import { cleanupDoneDates, cleanupRecord, drillDates, isRecordedDrill, withCleanupDone } from './cleanupDone.ts'
import { renameLine } from './cleanupPhase.ts'
import { supersededPolicies } from './generate.ts'
import { cleanupVars, cleanupWhen } from '../ui/surfaces/cleanupExport.ts'
import { stepVars } from '../ui/surfaces/stepVars.ts'
import { absoluteDate } from '../copy/dates.ts'

test('a Done records the row and its date in the checkpoints; the latest record per row wins', () => {
  let cps: unknown[] = [{ at: '2026-09-01T00:00:00.000Z', coverage: [] }]
  cps = withCleanupDone(cps, 'drill', '2026-09-03', '2026-09-03T10:00:00.000Z')
  cps = withCleanupDone(cps, 'naming', '2026-09-04', '2026-09-04T10:00:00.000Z')
  cps = withCleanupDone(cps, 'drill', '2026-12-01', '2026-12-01T10:00:00.000Z')
  assert.equal(cps.length, 4, 'the scan checkpoint stays beside the Cleanup records')
  assert.deepEqual(cleanupDoneDates(cps), { drill: '2026-12-01T12:00:00.000Z', naming: '2026-09-04T12:00:00.000Z' })
  assert.deepEqual(drillDates(cps), ['2026-09-03T12:00:00.000Z', '2026-12-01T12:00:00.000Z'], 'every drill date is kept: an older sign-in matches an older drill')
  assert.ok(isRecordedDrill('2026-09-03T02:15:00.000Z', drillDates(cps)))
  assert.ok(!isRecordedDrill('2026-09-05T02:15:00.000Z', drillDates(cps)))
  assert.ok(!isRecordedDrill('2026-09-03T02:15:00.000Z', []))
})

test('the drill date exempts the matching emergency sign-in from the recent-sign-in check', () => {
  const f = fixture('demo')
  const bgId = f.mapping.breakGlassUserIds[0]
  const signIn = f.snapshot.users.find((u) => u.id === bgId)!.lastSuccessfulSignIn!
  const before = runFixture(f)
  const bg = before.steps.find((s) => s.id === 's-prereq-break-glass')!
  const recent = bg.checks!.items.filter((it) => it.fix === 'recent-sign-in')
  assert.ok(recent.length > 0, 'an emergency account signed in inside the drill window with no recorded drill: the step asks who and why')
  assert.match(String(recent[0].values.ago), /\d+ days ago/, 'the line says how long ago')
  const ctx = { snapshot: f.snapshot, mapping: f.mapping, nameOf: (id: string) => before.input.names!.label(id), signature: 'IT', operatorId: f.operatorId, now: f.snapshot.asOf, groups: f.groups }
  const ex = stepVars(bg, ctx) as { failingChecks: [string, Record<string, unknown>][] }
  assert.ok(ex.failingChecks.some(([fix, vals]) => fix === 'recent-sign-in' && typeof vals.name === 'string' && /days ago/.test(String(vals.ago))), 'the check fix line fills {name} and {ago}')

  const drilled = runFixture(f, { cleanupRecord: cleanupRecord(withCleanupDone([], 'drill', signIn.slice(0, 10), signIn)) })
  const bgAfter = drilled.steps.find((s) => s.id === 's-prereq-break-glass')!
  assert.equal(bgAfter.checks!.items.filter((it) => it.fix === 'recent-sign-in').length, 0, 'a sign-in on a recorded drill day is the drill')
  const row = drilled.schedule.cleanup!.rows.find((r) => r.kind === 'drill')!
  assert.equal(row.done, `${signIn.slice(0, 10)}T12:00:00.000Z`, 'the drill row carries its recorded date')
  assert.equal(cleanupWhen(row), `done ${absoluteDate(row.done!)}`, 'the row reads done <date>')
  assert.equal(cleanupWhen(before.schedule.cleanup!.rows.find((r) => r.kind === 'drill')!), absoluteDate(row.day), 'undone, the row reads its planned day')
})

test('the naming row renders renames as from → to, in the tenant\'s convention', () => {
  const f = fixture('messy')
  const r = runFixture(f)
  const naming = r.coverage.organisation.naming
  assert.ok(naming.outliers.length > 0, 'messy has names off its convention')
  const row = r.schedule.cleanup!.rows.find((x) => x.kind === 'naming')!
  assert.ok(row, 'the naming row is present')
  for (const line of row.lists.renames) assert.match(line, /^.+ → .+$/, line)
  assert.equal(row.lists.renames[0], renameLine(naming.outliers[0], naming))
  assert.ok(!row.lists.renames[0].endsWith(`→ ${naming.outliers[0]}`), 'the proposed name is not the old one')
})

test('the consolidation row exists whenever a step\'s existingCoverage line rendered, and names those policies', () => {
  let seen = false
  // The large fixture holds a compliant-device policy that partly covers its goal: the one step with existing coverage still to do.
  for (const name of ['demo', 'mid', 'large'] as const) {
    const f = fixture(name)
    const r = runFixture(f)
    const superseded = supersededPolicies(r.steps)
    const row = r.schedule.cleanup?.rows.find((x) => x.kind === 'consolidation') ?? null
    if (superseded.length === 0) continue
    seen = true
    assert.ok(row, `${name}: a step found existing coverage, so the consolidation row exists`)
    for (const s of superseded) assert.ok(row!.lists.overlaps.includes(s), `${name}: the row names ${s}`)
    // The line renders on those steps and on no done step (its policies are what makes it In place).
    for (const s of r.steps) {
      const ex = stepVars(s, { snapshot: f.snapshot, mapping: f.mapping, nameOf: (id) => id, signature: 'IT', operatorId: null, now: f.snapshot.asOf }) as { existingPolicies: string[] }
      if (s.status === 'done') assert.equal(ex.existingPolicies.length, 0, `${name}: ${s.id} is In place; nothing to consolidate`)
      else if (ex.existingPolicies.length > 0 && (s.kind === 'create' || s.kind === 'adjust')) assert.ok(superseded.includes(ex.existingPolicies.join(', ')), `${name}: ${s.id}'s coverage is on the row`)
    }
  }
  assert.ok(seen, 'a fixture has a step with existing coverage')
})

test('the not-assessed row\'s note names the policy and the reason; unnoted policies stay bare', () => {
  const f = fixture('demo')
  const r = runFixture(f)
  const row = r.schedule.cleanup!.rows.find((x) => x.kind === 'notAssessed')!
  assert.ok(row && row.lists.policies.length > 1, 'the demo has baseline policies IAMAI did not assess')
  const [first, second] = row.lists.policies
  const ex = cleanupVars(r.schedule.cleanup!, row, { [first]: 'no agents here' }) as { policies: string[] }
  assert.equal(ex.policies[0], `${first}: does not apply: no agents here`)
  assert.equal(ex.policies[1], second)
})

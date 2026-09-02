// Prompt 53, night-1: the derivations behind the first walk's P0s, pinned so
// they cannot come back. A shared reference ({datesNew}) with a hole is a hole
// in the line that uses it; a policy already in report-only takes its date from
// the scan; a session goal fills {wanted} from the baseline policy it maps to.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fixture } from '../../roadmap/fixtures/index.ts'
import { runFixture } from '../../roadmap/fixtures/run.ts'
import { missingVars } from '../../content/render.ts'
import { pages, shared } from '../../content/content.ts'
import { sessionWantedForGoal } from './stepPortal.ts'
import { stepVars } from './stepVars.ts'
import { hoursInWords } from '../../coverage/verdict.ts'

test('a shared reference with an unfilled variable is a hole in the line that names it', () => {
  // {datesNew} expands to "Announce {announce} · Report-only from {reportOnly} · Enforce {enforce}".
  assert.match(String((shared as Record<string, unknown>).datesNew), /\{announce\}/)
  assert.deepEqual(missingVars('{datesNew}', {}), ['announce', 'reportOnly', 'enforce'])
  assert.deepEqual(missingVars('{datesNew}', { announce: 'Sep 1', reportOnly: 'Sep 1', enforce: 'Sep 8' }), [])
  assert.deepEqual(missingVars('{datesNew}', { announce: 'Sep 1', enforce: 'Sep 8' }), ['reportOnly'], 'the walk saw "Report-only from ·"')
  // The signature reference has a default and is never a hole.
  assert.deepEqual(missingVars('Regards, {signature}', {}), [])
})

test('a policy already in report-only dates its Report-only line from the scan', () => {
  const f = fixture('demo')
  const r = runFixture(f)
  const step = r.steps.find((s) => s.goalId === 'admins-phishing-resistant')!
  assert.equal(step.status, 'in-report-only')
  assert.ok(step.tracking?.reportOnlyAt, 'the scan dates the report-only policy')
  const ex = stepVars(step, { snapshot: f.snapshot, mapping: f.mapping, nameOf: (id) => id, signature: 'IT', operatorId: null, now: f.snapshot.asOf, reportOnlyAt: r.schedule.reportOnlyAt[step.id] ?? null })
  assert.ok(typeof ex.reportOnly === 'string' && ex.reportOnly.length > 0, 'reportOnly is filled from tracking')
  assert.deepEqual(missingVars('{datesNew}', ex), [], 'the Dates line has no hole')
})

test('a session goal fills {wanted} from the baseline policy it maps to, in words', () => {
  assert.equal(sessionWantedForGoal('admin-session'), '4 hours')
  assert.equal(sessionWantedForGoal('mfa-all-users'), null, 'a grant goal wants no session frequency')
  assert.equal(hoursInWords(168), 'weekly')
  assert.equal(hoursInWords(24), 'daily')
  const f = fixture('demo')
  const r = runFixture(f)
  const step = r.steps.find((s) => s.goalId === 'admin-session')!
  const ex = stepVars(step, { snapshot: f.snapshot, mapping: f.mapping, nameOf: (id) => id, signature: 'IT', operatorId: null, now: f.snapshot.asOf })
  assert.equal(ex.wanted, '4 hours', 'the manager note "expire after {wanted}" fills')
})

test('the problematic-accounts check lists the dormant accounts with their state, and counts them', () => {
  const f = fixture('getiamai')
  const r = runFixture(f)
  const step = r.steps.find((s) => s.id === 's-check-dormant-accounts')!
  assert.equal(step.kind, 'check')
  const ex = stepVars(step, { snapshot: f.snapshot, mapping: f.mapping, nameOf: (id) => r.input.names!.label(id), signature: 'IT', operatorId: null, now: f.snapshot.asOf })
  const rows = ex.accountsWithState as string[]
  assert.ok(rows.length > 0, 'getiamai has accounts that never signed in')
  assert.equal(rows.length, step.population.total, 'the list is the step\'s population')
  assert.equal(ex.n, step.population.total, 'the lead counts the accounts checked, not the active ones (none are)')
  for (const row of rows) assert.match(row, / · (no sign-in on record|[A-Z][a-z]{2} \d{1,2}, \d{4})$/, 'name · state')
  assert.equal((ex.accountsWithStateIds as string[]).length, rows.length)
})

test("Today's Show list is the content file's, in the six-state order the table uses (walk-51 item 10)", () => {
  const show = (pages.today as { show: string[] }).show
  // The surface maps each option to a filter by position; a change to this list
  // is a change to that mapping, so the order is pinned here.
  assert.deepEqual(show, ['All', 'Proven', 'Likely works', 'Never prompted', 'Possibly broken', 'No method', 'Not active', 'Admins', 'Guests'])
  const tiles = (pages.today as { tiles: Record<string, { label: string; value: string; heldBy: string | null; tip: string }> }).tiles
  assert.deepEqual(Object.keys(tiles), ['proven', 'unproven', 'noMethod', 'notActive'])
  assert.equal(tiles.proven.heldBy, null, 'proven is held by nothing')
  for (const k of ['unproven', 'noMethod', 'notActive']) assert.match(tiles[k].heldBy ?? '', /^held by /, `${k} names the step that moves it`)
})

test("the Boardroom room's method and evidence agree (walk-51 item 11: the fixture, not the product)", async () => {
  const { todayView } = await import('../../derive/today.ts')
  const f = fixture('demo')
  const v = todayView(f.snapshot, f.snapshot.asOf, new Set(f.mapping.serviceAccountUserIds))
  const room = v.rows.find((r) => r.user.displayName === 'Boardroom')
  assert.ok(room, 'the demo has the Boardroom room')
  assert.notEqual(room.strongest, 'phishingResistant', 'a room holds no passkey')
  assert.equal(room.evidence.kind, 'mfa')
  if (room.evidence.kind === 'mfa') assert.match(room.evidence.method, /notification/i, 'its evidence is the Authenticator approval it has')
})

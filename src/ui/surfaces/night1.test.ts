// Prompt 53, night-1: the derivations behind the first walk's P0s, pinned so
// they cannot come back. A shared reference ({datesNew}) with a hole is a hole
// in the line that uses it; a policy already in report-only takes its date from
// the scan; a session goal fills {wanted} from the baseline policy it maps to.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fixture, noExclusionsAnswer } from '../../roadmap/fixtures/index.ts'
import type { Fixture } from '../../roadmap/fixtures/index.ts'
import { runFixture } from '../../roadmap/fixtures/run.ts'
import { missingVars } from '../../content/render.ts'
import { pages, shared } from '../../content/content.ts'
import { sessionWantedForGoal, sessionWantedLongForGoal } from './stepPortal.ts'
import { stepVars } from './stepVars.ts'
import { datesLineFor } from './stepExport.ts'
import { contentStepFor } from '../../content/stepTitle.ts'
import { hoursInWords } from '../../coverage/verdict.ts'
import { effectsOf } from '../../roadmap/strand.ts'

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
  // Week two: the policy names nothing this tenant lacks, so it is datable.
  const f = fixture('demo-week2')
  const r = runFixture(f)
  const step = r.steps.find((s) => s.goalId === 'block-auth-transfer')!
  assert.equal(step.status, 'in-report-only')
  assert.ok(step.tracking?.reportOnlyAt, 'the scan dates the report-only policy')
  const ex = stepVars(step, { snapshot: f.snapshot, mapping: f.mapping, nameOf: (id) => id, signature: 'IT', operatorId: null, now: f.snapshot.asOf, reportOnlyAt: r.schedule.reportOnlyAt[step.id] ?? null })
  assert.ok(typeof ex.reportOnly === 'string' && ex.reportOnly.length > 0, 'reportOnly is filled from tracking')
  // Its line is the observation line, not the create's three dates: the only
  // thing left to submit is the enforcement and nothing has earned it, so the
  // plan states the day it entered report-only and the review its own gates
  // derive (roadmap/forecast.ts). The point stands on the line it renders — the
  // report-only date comes from the scan and nothing about the line has a hole.
  const cs = contentStepFor(step) as Record<string, unknown>
  assert.equal(datesLineFor(step, cs), '{datesObserve}')
  assert.deepEqual(missingVars('{datesObserve}', ex), [], 'the Dates line has no hole')
})

test('a session goal fills {wanted} from the policy the step will write, and says nothing where it cannot read one', () => {
  assert.equal(sessionWantedForGoal('admin-session'), '4 hours', 'the baseline still answers for a step with no policy of its own')
  assert.equal(sessionWantedForGoal('mfa-all-users'), null, 'a grant goal wants no session frequency')
  assert.equal(hoursInWords(168), 'weekly')
  assert.equal(hoursInWords(24), 'daily')
  const varsFor = (f: Fixture): { ex: Record<string, unknown>; hours: number | null } => {
    const r = runFixture(f)
    const step = r.steps.find((s) => s.goalId === 'admin-session')!
    const hours = (effectsOf(step) ?? []).map((e) => e.sessionControls?.signInFrequencyHours ?? null).find((h) => h !== null) ?? null
    return { ex: stepVars(step, { snapshot: f.snapshot, mapping: f.mapping, nameOf: (id) => id, signature: 'IT', operatorId: null, now: f.snapshot.asOf }) as Record<string, unknown>, hours }
  }
  // The operation the step will run says how long a session lives — whatever the
  // baseline's own version of the goal wants.
  const { ex, hours } = varsFor(fixture('getiamai'))
  assert.equal(hours, 12, 'this tenant’s admin-session policy sets twelve hours')
  assert.equal(ex.wanted, hoursInWords(hours!), 'the manager note "expire after {wanted}" fills from the policy')
  assert.equal(ex.wantedLong, '12 hours', 'the email "expire after {wantedLong}" fills, as a duration')
  assert.notEqual(ex.wanted, sessionWantedForGoal('admin-session'), 'and not from the baseline the goal maps to')
  // The demo cannot write this policy: an object it names is missing. A line
  // that told the operator what their sessions will expire after would be
  // describing the author's policy, not one this tenant is getting.
  const { ex: held } = varsFor(noExclusionsAnswer(fixture('demo')))
  assert.equal(held.wanted, undefined, 'a policy the plan cannot write says nothing about the session it would set')
  assert.equal(held.wantedLong, undefined)
  assert.equal(sessionWantedLongForGoal('mfa-all-users'), null)
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

test("MFA Readiness's Show list is the smallest useful set, and every filter a link arrives with still has a word (task 012)", async () => {
  const { COMPAT_SHOW_KEYS, SHOW_KEYS } = await import('../../derive/mfaReadiness.ts')
  const { showWord } = await import('./readinessCells.ts')
  assert.deepEqual(SHOW_KEYS.map(showWord), ['All accounts', 'Needs action', 'Needs a passkey', 'Needs proof', 'Passkey-ready'])
  // Not on the list, still nameable: the select shows the arriving filter's own
  // word, so the control always says what is on screen.
  assert.deepEqual(
    COMPAT_SHOW_KEYS.map(showWord),
    ['Not known', 'Passkey or security key, proven', 'Authenticator app, proven', 'Windows Hello only', 'Set up, not proven', 'Nothing set up', 'Not active', 'Emergency access', 'Service accounts', 'Shared devices', 'Sign-in disabled', 'Guests'],
  )
  assert.ok(!('tiles' in (pages.readiness as Record<string, unknown>)), 'the four tiles are gone')
})

test("the Boardroom room is a shared device on MFA Readiness: listed, not placed, its method never a passkey (walk-51 item 11)", async () => {
  const { readinessView } = await import('../../derive/mfaReadiness.ts')
  const f = fixture('demo')
  const v = readinessView(f.snapshot, f.snapshot.asOf, f.mapping)
  const room = v.rows.find((r) => r.user.displayName === 'Boardroom')
  assert.ok(room, 'the demo has the Boardroom room')
  assert.equal(room.kind, 'shared')
  assert.equal(room.active, false, 'a shared device is never counted on a rung')
  assert.notEqual(room.method, 'passkey', 'a room holds no passkey')
  assert.equal(room.evidence.kind, 'sharedDevice', 'its evidence is why it counts as a shared device')
})

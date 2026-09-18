import { stepBodyOf } from './stepBody.ts'
import { readyEvidence } from '../../roadmap/fixtures/readyEvidence.ts'
// Six fixes on main: the campaign email is the passkey version once Require MFA
// for Everyone is in place, naming the first policy that needs a passkey; the
// pluraliser conjugates the verb with the count; Today's tile labels are the
// table's state words; a done step's row shows no date word; a started plan
// says "started <date>" once, in the header line; a strength policy's row
// carries its lockout count in the who-column.
import { test } from 'node:test'
import assert from 'node:assert/strict'
// On the curated baseline (fixtures/index.ts `curatedFixture`): this is about a
// policy that can be written, not about the source groups this baseline has not
// settled (roadmap/sourceIdentity.test.ts).
import { curatedFixture as fixture } from '../../roadmap/fixtures/index.ts'
import { adminsAtRung5, runFixture } from '../../roadmap/fixtures/run.ts'
import { planDates, stepVars } from './stepVars.ts'
import type { StepVarContext } from './stepVars.ts'
import { commsFor, stepLines } from './stepExport.ts'
import { fillText } from '../../content/render.ts'
import { app, pages, stepById } from '../../content/content.ts'
import { READINESS_STATES } from '../../scoring/phishingResistant.ts'
import { showWord, stateTitle } from './readinessCells.ts'
import { rowWhen } from './rowWhen.ts'
import { holdOf } from '../../roadmap/holds.ts'
import { enforcementUnearned } from '../../roadmap/forecast.ts'
import { rowWho } from './rowWho.ts'
import { REPORT_ONLY_GAP } from '../../coverage/verdict.ts'
import { headerLine1 } from '../../derive/planHeader.ts'
import { adminUserIds } from '../../roles.ts'
import { whoLine } from '../../derive/whoLine.ts'
import { longDate } from '../../copy/dates.ts'

const ctxFor = (f: ReturnType<typeof fixture>, r: ReturnType<typeof runFixture>): StepVarContext => ({ snapshot: f.snapshot, mapping: f.mapping, nameOf: (id) => r.input.names!.label(id), signature: 'IT', operatorId: f.operatorId, now: f.snapshot.asOf, groups: f.groups, naming: r.coverage.organisation.naming, ...planDates(r.steps, r.schedule.start) })

/** Week two with its admins policy back in report-only: a policy the plan can write, and a change to make to it. */
function adminsInReportOnly(f: ReturnType<typeof fixture>): typeof f.snapshot {
  const ca = f.snapshot.config.caPolicies!
  const rows = (ca.rows as Record<string, unknown>[]).map((p) => (/Admins phishing-resistant/.test(String(p.displayName)) ? { ...p, state: 'enabledForReportingButNotEnforced' } : p))
  return { ...f.snapshot, config: { ...f.snapshot.config, caPolicies: { ...ca, rows } } }
}

test('(1) MFA preparation always supplies practical team, administrator and follow-up emails without invented enforcement dates', () => {
  for (const name of ['demo', 'demo-week2', 'getiamai'] as const) {
    const f = fixture(name)
    const r = runFixture(f)
    const step = r.steps.find(s => s.id === 's-verify-mfa')!
    const email = stepBodyOf(step, ctxFor(f, r)).artifacts.find(a => a.id === 'email')
    assert.ok(email && !email.unavailable, name)
    const text = email.text()
    assert.match(text, /Subject: Prepare Your Team for MFA/)
    assert.match(text, /Subject: Prepare Your Administrator Sign-In Method/)
    assert.match(text, /Subject: Help Completing Your Sign-In Setup/)
    assert.match(text, /https:\/\/aka.ms\/mfasetup/)
    assert.doesNotMatch(text, /From (Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)|undefined|no output/)
  }
})

test('(2) the pluraliser conjugates the verb with the count; step 15\'s Who line reads as one on GetIAMAI', () => {
  assert.equal(fillText('{admins} people hold an admin role', { admins: 1 }), '1 person holds an admin role')
  assert.equal(fillText('{admins} people hold an admin role', { admins: 3 }), '3 people hold an admin role')
  assert.equal(fillText('{n} of them have no passkey or key yet.', { n: 1 }), '1 of them has no passkey or key yet.')
  assert.equal(fillText('{n} admins are not yet Ready for phishing-resistant MFA; get each Ready before {enforce}: {list:x}', { n: 1, enforce: 'Sep 7', x: ['Kai'] }), '1 admin is not yet Ready for phishing-resistant MFA; get each Ready before Sep 7: Kai')
  assert.equal(fillText('{n} people hold a directory role and use that same account for mail or Teams since {from}:', { n: 1, from: 'Aug 1' }), '1 person holds a directory role and uses that same account for mail or Teams since Aug 1:')
  assert.equal(fillText('{n} people signed in from outside', { n: 1 }), '1 person signed in from outside', 'a past tense stays')
  const g = fixture('getiamai')
  const r = runFixture(g)
  const s = r.steps.find((x) => x.goalId === 'admins-phishing-resistant')!
  const lines = stepLines(s, ctxFor(g, r))
  assert.ok(lines.includes('1 person holds an admin role'), lines.filter((l) => /admin role/.test(l)).join(' | '))
  // The same conjugation on the rendered lockout line, once the enforcement it
  // names a day for is one the plan will make. GetIAMAI's admin readiness is 0%
  // against the 100% the step asks for, so held it has no day to name at all.
  assert.equal(s.action.readinessGate?.value, '0%')
  assert.deepEqual(lines.filter((l) => /not yet Ready for phishing-resistant MFA; get each Ready before/.test(l)), [], 'no deadline is invented while the enforcement is held')
  // With the admins at the rung met, the signed-in account still has no safe way
  // in, and that holds the enforcement too (roadmap/holds.ts): still no day.
  const ready = runFixture(g, { viability: adminsAtRung5(r.viability, g.snapshot.asOf) } as never)
  const s2 = ready.steps.find((x) => x.goalId === 'admins-phishing-resistant')!
  assert.ok(s2.blockers.some((b) => b.kind === 'readiness' && b.label === 'operator'), 'the premise: the operator’s own way in')
  assert.equal(holdOf(s2)?.kind, 'readiness')
  assert.equal(s2.events, null, 'a held enforcement is not dated')
  assert.deepEqual(stepLines(s2, ctxFor(g, ready)).filter((l) => /not yet Ready for phishing-resistant MFA; get each Ready before/.test(l)), [], 'and no deadline is written')
})

test("(3) MFA Readiness's states are the legend's words, and a state's filter is named by the same word", () => {
  assert.deepEqual(READINESS_STATES.map((s) => stateTitle(s)), ['Blocked by setup', 'Needs a method', 'Confirm it', 'Needs a device', 'Unknown', 'Ready', 'Seamless'])
  // A link that arrives filtered to a state (#/readiness/<state>) shows a pressed filter in the state's own word.
  for (const s of READINESS_STATES) assert.equal(showWord(s), stateTitle(s), `${s}: the filter and the state read one word`)
  const show = (pages.readiness as { show: Record<string, string> }).show
  assert.equal(showWord('all'), show.all)
  assert.ok(!('tiles' in (pages.readiness as Record<string, unknown>)), 'the tiles carry no words of their own')
})

test('(4) a done step\'s row shows no date word', () => {
  const f = fixture('demo')
  const r = runFixture(f)
  const done = r.steps.filter((s) => s.status === 'done')
  assert.ok(done.length > 0)
  for (const s of done) assert.equal(rowWhen(s), '', `${s.id} is done: blank`)
  const ready = r.steps.find((s) => s.status === 'ready' && (s.kind === 'prerequisite' || s.kind === 'check'))!
  assert.equal(rowWhen(ready), 'now', 'a ready foundation still reads now')
})

test('(5) a started plan says started <date> once, in the header line only', () => {
  const line = headerLine1({ steps: 28, inPlace: 6, finish: '2026-10-05T12:00:00.000Z', weeks: '5 weeks', constraint: '', startedFrom: '2026-09-07T12:00:00.000Z' })
  assert.match(line, /· started Sep 7, 2026 ·/)
  assert.ok(!('startedLine' in app.plan), 'no second started line')
})

test("(6) a strength policy's row carries its lockout count in the who-column when it is not zero", () => {
  // Isolate the Impact renderer from policy/source readiness: its lockout
  // assessment is already covered by the engine's dedicated lockout tests.
  const f = fixture('demo-week2')
  const r = runFixture(f)
  const source = r.steps.find(x => x.goalId === 'admins-phishing-resistant')!
  const s = { ...source, cohort: source.population, lockout: 1 }
  const who = rowWho(s)
  assert.equal(who, `${whoLine(s.population, null)} · 1 would be stopped`)
  assert.ok(!who.includes(REPORT_ONLY_GAP), 'Impact does not repeat the lifecycle state')
  const block = r.steps.find((x) => x.goalId === 'block-legacy-auth')!
  assert.equal(block.lockout, undefined)
  assert.ok(!/without a passkey/.test(rowWho(block)))
  const none = { ...s, lockout: 0 }
  assert.ok(!/without a passkey/.test(rowWho(none)))
})

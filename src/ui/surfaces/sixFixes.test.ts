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
import { RUNGS } from '../../derive/ladder.ts'
import { rungWords, showWord } from './readinessCells.ts'
import { rowWhen } from './rowWhen.ts'
import { holdOf } from '../../roadmap/holds.ts'
import { enforcementUnearned } from '../../roadmap/forecast.ts'
import { rowWho } from './rowWho.ts'
import { headerLine1 } from '../../derive/planHeader.ts'
import { rungOf } from '../../derive/ladder.ts'
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

test('(1) the campaign email is the passkey version once Require MFA for Everyone is in place, and names no policy whose day nothing has earned', () => {
  const f = fixture('demo-week2')
  const snapshot = adminsInReportOnly(f)
  // The campaign names the first *dated* policy that needs a passkey. This
  // scenario has none: the admins policy is in report-only with its readiness
  // prerequisite met (roadmap/operations.ts readinessGate), so the only thing
  // left to submit is the enforcement, and Foundation B has not granted it. The
  // schedule's projection for it is kept off the step (roadmap/forecast.ts
  // settleForecast) and this email is why — "From September 14, Require
  // Phishing-Resistant MFA for Admins requires a passkey" is a day, sent to
  // everyone in the tenant, that a two-day-old observation window has not
  // earned. The body is still the passkey version; the deadline line is not
  // written. Held on readiness, the counterpart is roadmap/readinessGate.test.ts;
  // withheld on observation, ui/surfaces/reportOnlyObserve.test.ts.
  const viability = adminsAtRung5(runFixture({ ...f, snapshot }, { snapshot } as never).viability, f.snapshot.asOf)
  const r = runFixture({ ...f, snapshot }, { snapshot, viability } as never)
  const camp = r.steps.find((s) => s.id === 's-verify-mfa')!
  assert.equal(r.steps.find((s) => s.goalId === 'mfa-all-users' && s.kind !== 'verify')?.status, 'done', 'the demo enforces MFA already')
  const ex = stepVars(camp, ctxFor(f, r)) as Record<string, unknown>
  assert.equal(ex.mfaInPlace, true)
  const cs = stepById['s-verify-mfa'] as unknown as Record<string, unknown>
  const email = commsFor(cs, ex, camp)!
  assert.match(email.body, /^You already confirm sign-ins to Contoso Pty Ltd with the Microsoft Authenticator app\. Over the next \d+ days, add a passkey/)
  const admins = r.steps.find((s) => s.goalId === 'admins-phishing-resistant')!
  assert.equal(admins.state.lifecycle, 'report-only')
  assert.equal(enforcementUnearned(admins), true, 'the one thing left to submit is the enforcement')
  assert.equal(admins.events, null, 'so the step has no day of its own')
  const projected = r.schedule.forecastOnly?.[admins.id]?.events?.enforce.at
  assert.ok(projected, 'though the schedule projected one')
  assert.equal(ex.passkeyPolicy, undefined, 'and the campaign names no policy on the strength of it')
  assert.equal(ex.passkeyEnforceLong, undefined)
  assert.ok(!email.extra.some((l) => /requires a passkey/.test(l)), email.extra.join(' | '))
  assert.ok(!email.extra.some((l) => l.includes(longDate(projected!))), email.extra.join(' | '))
  // Week two: the admins policy is enforced, so no policy needs a passkey yet; the line drops, the body stays.
  const f2 = fixture('demo-week2')
  const r2 = runFixture(f2)
  const camp2 = r2.steps.find((s) => s.id === 's-verify-mfa')!
  const ex2 = stepVars(camp2, ctxFor(f2, r2)) as Record<string, unknown>
  const email2 = commsFor(cs, ex2, camp2)!
  assert.match(email2.body, /^You already confirm/)
  assert.ok(!email2.extra.some((l) => /requires a passkey/.test(l)))
  // MFA not yet enforced (GetIAMAI): the old body.
  const g = fixture('getiamai')
  const rg = runFixture(g)
  const campg = rg.steps.find((s) => s.id === 's-verify-mfa')!
  const exg = stepVars(campg, ctxFor(g, rg)) as Record<string, unknown>
  assert.equal(exg.mfaInPlace, undefined)
  assert.match(commsFor(cs, exg, campg)!.body, /^From (Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday), .+ signing in to Fixture getiamai will ask you to confirm/)
})

test('(2) the pluraliser conjugates the verb with the count; step 15\'s Who line reads as one on GetIAMAI', () => {
  assert.equal(fillText('{admins} people hold an admin role', { admins: 1 }), '1 person holds an admin role')
  assert.equal(fillText('{admins} people hold an admin role', { admins: 3 }), '3 people hold an admin role')
  assert.equal(fillText('{n} of them have no passkey or key yet.', { n: 1 }), '1 of them has no passkey or key yet.')
  assert.equal(fillText('{n} admins are not yet at Passkey or security key, proven; register before {enforce}: {list:x}', { n: 1, enforce: 'Sep 7', x: ['Kai'] }), '1 admin is not yet at Passkey or security key, proven; register before Sep 7: Kai')
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
  assert.deepEqual(lines.filter((l) => /Passkey or security key/.test(l)), [], 'no deadline is invented while the enforcement is held')
  // With the admins at the rung met, the signed-in account still has no safe way
  // in, and that holds the enforcement too (roadmap/holds.ts): still no day.
  const ready = runFixture(g, { viability: adminsAtRung5(r.viability, g.snapshot.asOf) } as never)
  const s2 = ready.steps.find((x) => x.goalId === 'admins-phishing-resistant')!
  assert.ok(s2.blockers.some((b) => b.kind === 'readiness' && b.label === 'operator'), 'the premise: the operator’s own way in')
  assert.equal(holdOf(s2)?.kind, 'readiness')
  assert.equal(s2.events, null, 'a held enforcement is not dated')
  assert.deepEqual(stepLines(s2, ctxFor(g, ready)).filter((l) => /Passkey or security key, proven; register before/.test(l)), [], 'and no deadline is written')
})

test("(3) Today's rungs are the ladder's titles, and the Show list offers each by the same title", () => {
  assert.deepEqual(RUNGS.map((r) => rungWords(r).title), ['Passkey or security key, proven', 'Authenticator app, proven', 'Windows Hello only', 'Set up, not proven', 'Nothing set up'])
  for (const r of RUNGS) assert.equal(showWord(`rung-${r}`), rungWords(r).title, `rung ${r} in the Show list`)
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
  // The count is the people this policy would stop, so the policy has to be one
  // the plan can write: week two, with its admins policy back in report-only.
  const f = fixture('demo-week2')
  const snapshot = adminsInReportOnly(f)
  const r = runFixture({ ...f, snapshot }, { snapshot } as never)
  const s = r.steps.find((x) => x.goalId === 'admins-phishing-resistant')!
  // The step's own answer, and the tenant fact behind it: the admins the policy
  // reaches who are not yet at Passkey or security key, proven. The step reads
  // its own policy for both the count and the names (roadmap/lockout.ts).
  const admins = adminUserIds(f.snapshot.roles)
  const bg = new Set(f.mapping.breakGlassUserIds)
  const without = r.viability.filter((v) => admins.has(v.userId) && !bg.has(v.userId) && v.activity === 'active' && rungOf(v) !== 5).map((v) => v.userId)
  assert.ok(without.length > 0)
  assert.equal(s.lockout, without.length)
  const nameOf = (id: string): string => r.input.names!.label(id)
  const who = rowWho(s, nameOf)
  // The who-line, its gap clause when the row has one, then the lockout count.
  assert.equal(who, `${whoLine(s.population, nameOf, s.gapShort ?? s.gap ?? null)} · ${without.length} not yet at Passkey or security key, proven`)
  assert.match(who, new RegExp(`^${s.population.active} people · .*${without.length} not yet at Passkey or security key, proven$`))
  // Zero: no suffix. The block policies carry none.
  const block = r.steps.find((x) => x.goalId === 'block-legacy-auth')!
  assert.equal(block.lockout, undefined)
  assert.ok(!/without a passkey/.test(rowWho(block, (id) => r.input.names!.label(id))))
  const none = { ...s, lockout: 0 }
  assert.ok(!/without a passkey/.test(rowWho(none, (id) => r.input.names!.label(id))))
})

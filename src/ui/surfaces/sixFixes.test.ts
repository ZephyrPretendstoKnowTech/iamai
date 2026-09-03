// Six fixes on main: the campaign email is the passkey version once Require MFA
// for Everyone is in place, naming the first policy that needs a passkey; the
// pluraliser conjugates the verb with the count; Today's tile labels are the
// table's state words; a done step's row shows no date word; a started plan
// says "started <date>" once, in the header line; a strength policy's row
// carries its lockout count in the who-column.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fixture } from '../../roadmap/fixtures/index.ts'
import { runFixture } from '../../roadmap/fixtures/run.ts'
import { planDates, stepVars } from './stepVars.ts'
import type { StepVarContext } from './stepVars.ts'
import { commsFor, stepLines } from './stepExport.ts'
import { fillText } from '../../content/render.ts'
import { app, pages, stepById } from '../../content/content.ts'
import { TILE_STATES } from '../../derive/today.ts'
import { tileLabel } from './todayCells.ts'
import { rowWhen } from './rowWhen.ts'
import { rowWho } from './rowWho.ts'
import { headerLine1 } from '../../derive/planHeader.ts'
import { lockoutIds } from '../../roadmap/lockout.ts'
import { longDate } from '../../copy/dates.ts'

const ctxFor = (f: ReturnType<typeof fixture>, r: ReturnType<typeof runFixture>): StepVarContext => ({ snapshot: f.snapshot, mapping: f.mapping, nameOf: (id) => r.input.names!.label(id), signature: 'IT', operatorId: f.operatorId, now: f.snapshot.asOf, groups: f.groups, naming: r.coverage.organisation.naming, ...planDates(r.steps, r.schedule.start) })

test('(1) the campaign email is the passkey version once Require MFA for Everyone is in place, naming the first policy that needs a passkey', () => {
  const f = fixture('demo')
  const r = runFixture(f)
  const camp = r.steps.find((s) => s.id === 's-verify-mfa')!
  assert.equal(r.steps.find((s) => s.goalId === 'mfa-all-users' && s.kind !== 'verify')?.status, 'done', 'the demo enforces MFA already')
  const ex = stepVars(camp, ctxFor(f, r)) as Record<string, unknown>
  assert.equal(ex.mfaInPlace, true)
  const cs = stepById['s-verify-mfa'] as unknown as Record<string, unknown>
  const email = commsFor(cs, ex)!
  assert.match(email.body, /^You already confirm sign-ins to Contoso Pty Ltd with the Microsoft Authenticator app\. Over the next \d+ days, add a passkey/)
  const admins = r.steps.find((s) => s.goalId === 'admins-phishing-resistant')!
  assert.equal(ex.passkeyPolicy, 'Require Phishing-Resistant MFA for Admins', 'the first policy that needs a passkey')
  assert.equal(ex.passkeyEnforceLong, longDate(admins.events!.enforce.at))
  assert.ok(email.extra.some((l) => l === `From ${longDate(admins.events!.enforce.at)}, Require Phishing-Resistant MFA for Admins requires a passkey.`), email.extra.join(' | '))
  // Week two: the admins policy is enforced, so no policy needs a passkey yet; the line drops, the body stays.
  const f2 = fixture('demo-week2')
  const r2 = runFixture(f2)
  const ex2 = stepVars(r2.steps.find((s) => s.id === 's-verify-mfa')!, ctxFor(f2, r2)) as Record<string, unknown>
  const email2 = commsFor(cs, ex2)!
  assert.match(email2.body, /^You already confirm/)
  assert.ok(!email2.extra.some((l) => /requires a passkey/.test(l)))
  // MFA not yet enforced (GetIAMAI): the old body.
  const g = fixture('getiamai')
  const rg = runFixture(g)
  const exg = stepVars(rg.steps.find((s) => s.id === 's-verify-mfa')!, ctxFor(g, rg)) as Record<string, unknown>
  assert.equal(exg.mfaInPlace, undefined)
  assert.match(commsFor(cs, exg)!.body, /^From (Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday), .+ signing in to Fixture getiamai will ask you to confirm/)
})

test('(2) the pluraliser conjugates the verb with the count; step 15\'s Who line reads as one on GetIAMAI', () => {
  assert.equal(fillText('{admins} people hold an admin role', { admins: 1 }), '1 person holds an admin role')
  assert.equal(fillText('{admins} people hold an admin role', { admins: 3 }), '3 people hold an admin role')
  assert.equal(fillText('{n} of them have no passkey or key yet.', { n: 1 }), '1 of them has no passkey or key yet.')
  assert.equal(fillText('{n} admins have no phishing-resistant method; register before {enforce}: {list:x}', { n: 1, enforce: 'Sep 7', x: ['Kai'] }), '1 admin has no phishing-resistant method; register before Sep 7: Kai')
  assert.equal(fillText('{n} people hold a directory role and use that same account for mail or Teams since {from}:', { n: 1, from: 'Aug 1' }), '1 person holds a directory role and uses that same account for mail or Teams since Aug 1:')
  assert.equal(fillText('{n} people signed in from outside', { n: 1 }), '1 person signed in from outside', 'a past tense stays')
  const g = fixture('getiamai')
  const r = runFixture(g)
  const s = r.steps.find((x) => x.goalId === 'admins-phishing-resistant')!
  const lines = stepLines(s, ctxFor(g, r))
  assert.ok(lines.includes('1 person holds an admin role'), lines.filter((l) => /admin role/.test(l)).join(' | '))
  assert.ok(lines.some((l) => /^1 admin has no phishing-resistant method; register before /.test(l)))
})

test("(3) Today's tile labels are the table's state words; a tile that groups states names them", () => {
  const show = (pages.today as { show: string[]; tiles: Record<string, Record<string, unknown>> }).show
  assert.equal(tileLabel('proven'), 'Proven')
  assert.equal(tileLabel('unproven'), 'Likely works · Never prompted · Possibly broken')
  assert.equal(tileLabel('noMethod'), 'No method')
  assert.equal(tileLabel('notActive'), 'Not active')
  for (const k of Object.keys(TILE_STATES)) for (const word of tileLabel(k as keyof typeof TILE_STATES).split(' · ')) assert.ok(show.includes(word), `${word} is a table state word`)
  for (const t of Object.values((pages.today as { tiles: Record<string, Record<string, unknown>> }).tiles)) assert.ok(!('label' in t), 'the tiles carry no label of their own')
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
  const f = fixture('demo')
  const r = runFixture(f)
  const s = r.steps.find((x) => x.goalId === 'admins-phishing-resistant')!
  const without = lockoutIds('admins-phishing-resistant', r.viability, f.snapshot, new Set(f.mapping.breakGlassUserIds))
  assert.ok(without.length > 0)
  assert.equal(s.lockout, without.length)
  const who = rowWho(s, (id) => r.input.names!.label(id))
  assert.equal(who, `${s.population.active} people · ${without.length} without a passkey`)
  // Zero: no suffix. The block policies carry none.
  const block = r.steps.find((x) => x.goalId === 'block-legacy-auth')!
  assert.equal(block.lockout, undefined)
  assert.ok(!/without a passkey/.test(rowWho(block, (id) => r.input.names!.label(id))))
  const none = { ...s, lockout: 0 }
  assert.ok(!/without a passkey/.test(rowWho(none, (id) => r.input.names!.label(id))))
})

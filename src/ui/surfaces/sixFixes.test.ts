// Fixes on main that hold: the pluraliser conjugates the verb with the count, and
// a held enforcement writes no deadline; a strength policy's row carries its
// lockout count in the who-column.
import { test } from 'node:test'
import assert from 'node:assert/strict'
// On the curated baseline (fixtures/index.ts `curatedFixture`): this is about a
// policy that can be written, not about the source groups this baseline has not
// settled (roadmap/sourceIdentity.test.ts).
import { curatedFixture as fixture } from '../../roadmap/fixtures/index.ts'
import { adminsAtRung5, runFixture } from '../../roadmap/fixtures/run.ts'
import { planDates } from './stepVars.ts'
import type { StepVarContext } from './stepVars.ts'
import { stepLines } from './stepExport.ts'
import { fillText } from '../../content/render.ts'
import { holdOf } from '../../roadmap/holds.ts'
import { rowWho } from './rowWho.ts'
import { REPORT_ONLY_GAP } from '../../coverage/verdict.ts'
import { whoLine } from '../../derive/whoLine.ts'

const ctxFor = (f: ReturnType<typeof fixture>, r: ReturnType<typeof runFixture>): StepVarContext => ({ snapshot: f.snapshot, mapping: f.mapping, nameOf: (id) => r.input.names!.label(id), signature: 'IT', operatorId: f.operatorId, now: f.snapshot.asOf, groups: f.groups, naming: r.coverage.organisation.naming, ...planDates(r.steps, r.schedule.start) })

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

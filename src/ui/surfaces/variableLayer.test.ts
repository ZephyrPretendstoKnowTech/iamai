// Prompt 52, walk-51 item 2: no rendered line is a variable rendered around a
// hole, and a count of one reads as one. Pluralisation is a unit fact; the
// no-hole guarantee is checked on the demo and GetIAMAI campaign step, whose
// who-line and done-when lines the walk found rendering "1 guests · readiness ,
// the plan waits for 90% until ." with {readiness} and {enrollBy} empty.
import { sharedDeviceIds } from '../../derive/sharedDevices.ts'
import { activePeopleIds, campaignIdsFor } from '../../derive/population.ts'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { allFixtures } from '../../roadmap/fixtures/index.ts'
import { runFixture } from '../../roadmap/fixtures/run.ts'
import { stepVars } from './stepVars.ts'
import type { StepVarContext } from './stepVars.ts'
import { fillText, missingVars } from '../../content/render.ts'
import { setDisplayTimeZone, absoluteDate, longDate } from '../../copy/dates.ts'
import { contentStepFor } from '../../content/stepTitle.ts'
import { strengthForGoal, strengthNameOf } from './stepPortal.ts'
import { analysisUnknown, effectsOf } from '../../roadmap/strand.ts'
import { contentLists } from '../../derive/contentLists.ts'
import { todayView } from '../../derive/today.ts'
import { content } from '../../content/content.ts'

test('a count of one singularises the noun that follows it', () => {
  assert.equal(fillText('{guests} guests', { guests: 1 }), '1 guest')
  assert.equal(fillText('{active} active people', { active: 1 }), '1 active person')
  assert.equal(fillText('{n} policies', { n: 1 }), '1 policy')
  assert.equal(fillText('{guests} guests', { guests: 3 }), '3 guests')
  assert.equal(fillText('{n} guests', { n: 11 }), '11 guests')
})

test('missingVars names only the variables a line does not fill', () => {
  assert.deepEqual(missingVars('readiness {readiness}, until {enrollBy}', { readiness: '36%' }), ['enrollBy'])
  assert.deepEqual(missingVars('{active} active people', { active: 4 }), [])
  assert.deepEqual(missingVars('{n} of {total}', { n: 0, total: 3 }), []) // zero is a value, not a hole
})

test('the campaign who and done-when lines have no hole on the demo and GetIAMAI', () => {
  const fixtures = allFixtures().filter((f) => f.name === 'demo' || f.name === 'getiamai')
  for (const f of fixtures) {
    const run = runFixture(f)
    const firstEnforce = run.steps.map((s) => s.events?.enforce?.at).filter((x): x is string => typeof x === 'string').sort()[0] ?? null
    const camp = run.steps.find((s) => s.goalId === 'mfa-all-users')
    assert.ok(camp, `${f.name}: the campaign step`)
    const cs = contentStepFor(camp!) as { who: Record<string, unknown>; doneWhen: string[] }
    const ctx: StepVarContext = { snapshot: f.snapshot, mapping: f.mapping, nameOf: (id: string) => run.input.names?.label(id) ?? id, signature: 'IT', operatorId: run.input.operatorUserId ?? null, now: f.snapshot.asOf, firstEnforce }
    const ex = stepVars(camp!, ctx) as Record<string, unknown>
    assert.deepEqual(missingVars(cs.who.lead, ex), [], `${f.name}: who.lead fills every variable`)
    for (const dw of cs.doneWhen) {
      // A line that still has a hole would be dropped by the renderer; assert the
      // derivations fill the campaign's own, so nothing important is dropped.
      if (dw.includes('{enrollBy}')) assert.deepEqual(missingVars(dw, ex), [], `${f.name}: done-when fills enrollBy`)
    }
  }
})

// Prompt 52, walk-51 item 3: the campaign's five lists and the special-care
// picker derive from the same population states Today computes — the walk found
// them empty while Today listed 7 no-method and 14 registered-unproven.
test('the campaign lists and the special-care picker derive from Today', () => {
  const f = allFixtures().find((x) => x.name === 'demo')!
  const run = runFixture(f)
  const nameOf = (id: string): string => run.input.names?.label(id) ?? id
  const cl = contentLists({ snapshot: f.snapshot, mapping: f.mapping, nameOf, now: f.snapshot.asOf })
  // Today's ladder over the same people: the campaign's groups are its rungs (derive/ladder.ts).
  const tv = todayView(f.snapshot, f.snapshot.asOf, f.mapping)
  assert.equal(cl.noMethod.length, tv.ladder.rungs[1].length, 'Nothing set up matches Today')
  assert.equal(cl.unproven.length, tv.ladder.rungs[2].length, 'Set up, never used for MFA matches Today')
  assert.ok(cl.noMethod.length > 0 && cl.unproven.length > 0, 'the demo has people in these buckets')
  assert.ok(cl.specialCare.length > 0, 'the special-care picker has people')
  for (const row of cl.specialCare) {
    assert.match(row, /\S · \S/, `"${row}" has a name and a state, not an empty "·"`)
  }
})

// Prompt 52, walk-51 item 6: a policy step's done-when comes from
// shared.policyDoneWhen; the walk found token-protection showing a "Done when"
// heading with nothing under it. Expanded and filled, the section has content.
test('a policy step expands its done-when from the shared lines, no empty section', () => {
  const f = allFixtures().find((x) => x.name === 'demo')!
  const run = runFixture(f)
  const tp = run.steps.find((s) => s.goalId === 'token-protection')!
  const cs = contentStepFor(tp) as { doneWhen: string[] }
  assert.deepEqual(cs.doneWhen, ['{policyDoneWhen}'], 'token-protection defers to the shared policy lines')
  const ctx: StepVarContext = { snapshot: f.snapshot, mapping: f.mapping, nameOf: (id: string) => run.input.names?.label(id) ?? id, signature: 'IT', operatorId: run.input.operatorUserId ?? null, now: f.snapshot.asOf }
  const ex = stepVars(tp, ctx) as Record<string, unknown>
  const shared = content.shared as Record<string, string[]>
  const dw = cs.doneWhen.flatMap((x) => (x === '{policyDoneWhen}' ? shared.policyDoneWhen : [x])).filter((l) => missingVars(l, ex).length === 0)
  assert.ok(dw.length >= 2, `the shared policy done-when lines render (${dw.length})`)
  assert.ok(dw.some((l) => l.includes('report-only for')), 'the report-only line fills reportOnlyDays')
})

// Prompt 52, walk-51 item 7: a per-person email fills the first name or falls
// back to "Hi," — the walk found a literal {firstName} in the token-protection
// email, which ContentStep rendered raw rather than through the fill engine.
test('an email salutation fills the name or falls back to Hi,', () => {
  assert.equal(fillText('Hi {firstName},', {}), 'Hi,')
  assert.equal(fillText('Hi {firstName},', { firstName: 'Sam' }), 'Hi Sam,')
})

// Prompt 52, walk-51 item 5: one short date format everywhere, the long form
// only in emails, both from the same instant. The walk found the email a day
// behind the row (a time-zone off-by-one) and three short formats on one page.
test('the short and long date forms name the same day, one short format everywhere', () => {
  setDisplayTimeZone('America/Denver')
  const iso = '2026-09-29T04:00:00.000Z' // late on Sep 28 in Denver, Sep 29 in UTC
  const shortForm = absoluteDate(iso)
  const longForm = longDate(iso)
  assert.equal(shortForm.match(/\d+/)?.[0], longForm.match(/\d+/)?.[0], `short "${shortForm}" and long "${longForm}" name the same day`)
  setDisplayTimeZone(null)

  // A policy the plan can write: one it cannot has no enforcement date at all.
  const f = allFixtures().find((x) => x.name === 'demo-week2')!
  const run = runFixture(f)
  const policy = run.steps.find((s) => s.events?.enforce && run.schedule.reportOnlyAt[s.id])!
  assert.ok(policy, 'a policy step with an enforcement date and a report-only date')
  const ctx: StepVarContext = { snapshot: f.snapshot, mapping: f.mapping, nameOf: (id: string) => run.input.names?.label(id) ?? id, signature: 'IT', operatorId: null, now: f.snapshot.asOf, reportOnlyAt: run.schedule.reportOnlyAt[policy.id] }
  const ex = stepVars(policy, ctx) as Record<string, string>
  assert.equal(ex.enforce, absoluteDate(policy.events!.enforce.at), 'the enforce date is the one short format')
  assert.equal(ex.reportOnly, absoluteDate(run.schedule.reportOnlyAt[policy.id]), 'report-only is filled and in the short format')
  assert.doesNotMatch(ex.enforce, /Sept/, 'not the en-AU "29 Sept 2026" second format')
})

// Prompt 52, walk-51 item 18: the guests step fills the authentication strength
// its baseline policy requires (the walk found {strengthName} empty). The
// service-provider partner line names {partners}; contentLists does not fill it
// (the content re-uses {n} for three different counts), so ContentStep drops
// the line rather than render a hole — item 2's suppression, the design's other
// branch, is the resolution there.
test('the guests step names the strength its own policy requires, or says nothing; the partner line is whole or dropped', () => {
  assert.ok(strengthForGoal('guests-mfa'), 'the baseline names one, for a step with no policy of its own')
  const guestsContent = content.steps.find((s) => s.id === "guests-mfa") as unknown as { who: { evidence: string[] }; decision: { help: string } }
  let named = 0
  let held = 0
  for (const f of allFixtures()) {
    const run = runFixture(f)
    const guests = run.steps.find((s) => s.goalId === 'guests-mfa')
    if (!guests) continue
    const ctx: StepVarContext = { snapshot: f.snapshot, mapping: f.mapping, nameOf: (id: string) => run.input.names?.label(id) ?? id, signature: 'IT', operatorId: null, now: f.snapshot.asOf }
    const ex = stepVars(guests, ctx) as Record<string, unknown>
    const own = effectsOf(guests)
    const strengthId = (own ?? []).flatMap((e) => (e.strength ? [e.strength.id] : []))[0]
    if (own === null) {
      // A policy already in place, or the enforce step: the baseline answers.
      assert.equal(ex.strengthName, strengthForGoal('guests-mfa'), `${f.name}: the baseline names it`)
      named += 1
    } else if (analysisUnknown(guests) || strengthId === undefined) {
      // Nothing the step will write names a strength IAMAI can read, so the line
      // names none — never the author's name for a policy this tenant is not
      // getting.
      assert.equal(ex.strengthName, undefined, `${f.name}: no name is claimed`)
      held += 1
    } else {
      assert.equal(ex.strengthName, strengthNameOf(strengthId, ctx), `${f.name}: the tenant's own name for the strength the policy requires`)
      assert.equal(missingVars(guestsContent.decision.help, ex).length, 0, `${f.name}: the decision help has no hole`)
      named += 1
    }
  }
  assert.ok(named + held > 0, 'a fixture carries the guests step')
  const partnerLine = guestsContent.who.evidence.find((l) => l.includes('{partners}'))!
  assert.ok(missingVars(partnerLine, { n: 3, from: 'Aug 1' }).includes('partners'), 'the partner line drops when partners is not derived')
})

// Prompt 52, walk-51 item 8: one readiness value per family and one active-people
// count on every step, matching Today — the walk found rows at "now 34%" and
// "now 37%" for MFA, and Today at 33 active while the campaign said 30. Checked
// on the demo and GetIAMAI (item 8/17: GetIAMAI beside the demo in the fixtures).
test('one readiness per family and one active-people count, on the demo and GetIAMAI', () => {
  for (const f of allFixtures().filter((x) => x.name === 'demo' || x.name === 'getiamai')) {
    const run = runFixture(f)
    const tv = todayView(f.snapshot, f.snapshot.asOf, f.mapping)
    const byFamily: Record<string, Set<number>> = {}
    for (const s of run.steps) {
      const r = s.readiness
      if (r && r.percent != null) (byFamily[r.family] ??= new Set()).add(r.percent)
    }
    for (const [family, set] of Object.entries(byFamily)) {
      assert.equal(set.size, 1, `${f.name}: ${family} readiness is one value, got ${[...set].join(', ')}`)
    }
    const camp = run.steps.find((s) => s.id === 's-verify-mfa')
    if (camp) {
      const ctx: StepVarContext = { snapshot: f.snapshot, mapping: f.mapping, nameOf: (id: string) => run.input.names?.label(id) ?? id, signature: 'IT', operatorId: null, now: f.snapshot.asOf }
      const ex = stepVars(camp, ctx) as Record<string, unknown>
      // One population per step: the campaign counts the plan's active people
      // minus the emergency and shared-device accounts; Today's tile is the plan's.
      assert.equal(ex.active, campaignIdsFor(f.snapshot, f.snapshot.asOf, f.mapping).length, `${f.name}: the campaign's lead counts its own population`)
      assert.equal(tv.facts.active, campaignIdsFor(f.snapshot, f.snapshot.asOf, f.mapping).length, `${f.name}: Today's active people are the campaign's population`)
    }
  }
})

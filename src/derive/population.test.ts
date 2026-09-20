// Prompt 51 §8.1 / 2.1: one population object per step, read by the row, the
// step body and its More. Two figures for one quantity is a failing test.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { allFixtures, fixture } from '../roadmap/fixtures/index.ts'
import { runFixture } from '../roadmap/fixtures/run.ts'
import { activePeopleIds, campaignIdsFor, reached, stepPopulation } from './population.ts'
import { whoLine, populationLine, affectedIds } from './whoLine.ts'
import { readinessView } from './mfaReadiness.ts'
import { rowWho } from '../ui/surfaces/rowWho.ts'
import { stepVars } from '../ui/surfaces/stepVars.ts'
import type { StepVarContext } from '../ui/surfaces/stepVars.ts'
import { fillText } from '../content/render.ts'

test('the row and the step body read the same population, for every step on every fixture', () => {
  for (const f of allFixtures()) {
    for (const s of runFixture(f).steps) {
      // One source for both: the people the step is about (reached) — its own
      // policy's scope for an open policy, the goal's population otherwise.
      const of = reached(s)
      const pop = stepPopulation(s)
      if (of === null) {
        assert.equal(pop, null, `${f.name} ${s.id}: an unsettled scope claims no count`)
        continue
      }
      assert.ok(pop !== null)
      assert.equal(pop.active, affectedIds(of).length, `${f.name} ${s.id}: active count`)
      assert.ok(pop.enabledCovered >= pop.active, `${f.name} ${s.id}: enabledCovered is at least active`)
      const who = whoLine(of)
      const m = who.match(/^(\d+) (?:person|people)/)
      if (m) assert.equal(Number(m[1]), pop.active, `${f.name} ${s.id}: the row who-line count is the population's active count`)
      const line = populationLine(of)
      const lm = line.match(/^(\d+) active (?:person|people)/)
      if (lm) assert.equal(Number(lm[1]), pop.active, `${f.name} ${s.id}: the step body population line is the same active count`)
    }
  }
})

// One population per step (derive/population.ts): the row's who-line, the lead's
// counts ({n}, {active}, {people}, {admins}, {guests}) and Today's active tile
// all read it; the campaign's population is the plan's active people minus the
// emergency and shared-device accounts.
test('on the demo and GetIAMAI, every row count equals its step lead count, and Today and the campaign read the same people', () => {
  for (const name of ['demo', 'getiamai'] as const) {
    const f = fixture(name)
    const r = runFixture(f)
    const nameOf = (id: string): string => r.input.names!.label(id)
    const ctx: StepVarContext = { snapshot: f.snapshot, mapping: f.mapping, nameOf, signature: 'IT', operatorId: f.operatorId, now: f.snapshot.asOf, groups: f.groups }
    for (const s of r.steps) {
      const ex = stepVars(s, ctx) as Record<string, unknown>
      const view = stepPopulation(s)
      const of = reached(s)
      if (view === null || of === null) {
        assert.equal(ex.n, undefined, `${name} ${s.id}: an unsettled scope names no count`)
        continue
      }
      const row = whoLine(of)
      const m = row.match(/^(\d+) (?:person|people)/)
      assert.ok(m !== null || row === 'No user impact', `${name} ${s.id}: the row counts people and never names them (${row})`)
      const rowCount = m ? Number(m[1]) : 0
      assert.equal(rowCount, view.active, `${name} ${s.id}: the row's count is the population's (${row})`)
      assert.equal(ex.n, s.kind === 'check' ? s.population.total : view.active, `${name} ${s.id}: the lead's {n} uses reviewed accounts for check steps`)
      const reviewCount = rowWho(s).match(/^(\d+) accounts?$/)
      if (reviewCount) assert.equal(Number(reviewCount[1]), s.population.total, `${s.id}: actual row Impact counts the same reviewed accounts`)
      assert.equal(ex.active, view.active, `${name} ${s.id}: the lead's {active}`)
      assert.equal(ex.people, view.active, `${name} ${s.id}: the lead's {people}`)
      assert.equal(ex.admins, view.admins, `${name} ${s.id}: the lead's {admins}`)
      assert.equal(ex.guests, view.guests, `${name} ${s.id}: the lead's {guests}`)
    }
    const svc = new Set(f.mapping.serviceAccountUserIds)
    assert.equal(readinessView(f.snapshot, f.snapshot.asOf, f.mapping).facts.active, campaignIdsFor(f.snapshot, f.snapshot.asOf, f.mapping).length, `${name}: Today's active people are the campaign's population`)
    assert.ok(activePeopleIds(f.snapshot, f.snapshot.asOf, svc).length >= campaignIdsFor(f.snapshot, f.snapshot.asOf, f.mapping).length, `${name}: the plan's active people include the campaign's`)
    const campaign = r.steps.find((s) => s.kind === 'verify')
    if (campaign) assert.deepEqual([...affectedIds(campaign.population)].sort(), campaignIdsFor(f.snapshot, f.snapshot.asOf, f.mapping).sort(), `${name}: the campaign's population`)
  }
  // {guests} pluralises like {n}.
  assert.equal(fillText('{guests} guests', { guests: 1 }), '1 guest')
  assert.equal(fillText('{n} people', { n: 1 }), '1 person')
})

// V1 audit S4-21. The dormant step is the one place never-signed-in accounts are
// a population: generate.ts sets activeIds to the accounts it names, "though
// none are active". A second pass over the same step then overwrote the whole
// population object with `population(ids, index)`, whose activeIds are the ids
// inside the active index — empty for dormant accounts by definition. The row
// and the Affected-people tile read "No user impact", satisfied, over a step
// whose own body named 731 accounts to disable, on all eight fixtures.
test('the dormant step\'s impact is the accounts it names, not "No user impact"', () => {
  for (const f of allFixtures()) {
    const s = runFixture(f).steps.find((x) => x.id === 's-check-dormant-accounts')
    if (!s) continue
    const view = stepPopulation(s)
    assert.ok(view, `${f.name}: the dormant step has a settled scope`)
    assert.equal(view.active, s.population.total, `${f.name}: every account it names is its reach`)
    const row = whoLine(reached(s)!)
    if (s.population.total === 0) continue
    assert.notEqual(row, 'No user impact', `${f.name}: ${s.population.total} accounts to disable is not "No user impact"`)
    assert.match(row, new RegExp(`^${s.population.total} (?:person|people)`), `${f.name}: the row counts them (${row})`)
  }
})

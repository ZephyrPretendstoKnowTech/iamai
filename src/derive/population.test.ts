// Prompt 51 §8.1 / 2.1: one population object per step, read by the row, the
// step body and its More. Two figures for one quantity is a failing test.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { allFixtures, fixture } from '../roadmap/fixtures/index.ts'
import { runFixture } from '../roadmap/fixtures/run.ts'
import { activePeopleIds, campaignIdsFor, stepPopulation } from './population.ts'
import { whoLine, populationLine, affectedIds } from './whoLine.ts'
import { todayView } from './today.ts'
import { stepVars } from '../ui/surfaces/stepVars.ts'
import type { StepVarContext } from '../ui/surfaces/stepVars.ts'
import { fillText } from '../content/render.ts'

test('the row and the step body read the same population, for every step on every fixture', () => {
  const nameOf = (id: string): string => id
  for (const f of allFixtures()) {
    for (const s of runFixture(f).steps) {
      const pop = stepPopulation(s)
      assert.equal(pop.active, affectedIds(s.population).length, `${f.name} ${s.id}: active count`)
      assert.ok(pop.enabledCovered >= pop.active, `${f.name} ${s.id}: enabledCovered is at least active`)
      const who = whoLine(s.population, nameOf)
      const m = who.match(/^(\d+) (?:person|people)/)
      if (m) assert.equal(Number(m[1]), pop.active, `${f.name} ${s.id}: the row who-line count is the population's active count`)
      const line = populationLine(s.population)
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
      const row = whoLine(s.population, nameOf)
      const m = row.match(/^(\d+) (?:person|people|accounts?)/)
      const rowCount = m ? Number(m[1]) : row.startsWith('nobody affected') ? 0 : row.split(' · ')[0].split(/, | and /).length
      assert.equal(rowCount, view.active, `${name} ${s.id}: the row's count is the population's (${row})`)
      assert.equal(ex.n, view.active, `${name} ${s.id}: the lead's {n}`)
      assert.equal(ex.active, view.active, `${name} ${s.id}: the lead's {active}`)
      assert.equal(ex.people, view.active, `${name} ${s.id}: the lead's {people}`)
      assert.equal(ex.admins, view.admins, `${name} ${s.id}: the lead's {admins}`)
      assert.equal(ex.guests, view.guests, `${name} ${s.id}: the lead's {guests}`)
    }
    const svc = new Set(f.mapping.serviceAccountUserIds)
    assert.equal(todayView(f.snapshot, f.snapshot.asOf, f.mapping).ledger.active, campaignIdsFor(f.snapshot, f.snapshot.asOf, f.mapping).length, `${name}: Today's active people are the campaign's population`)
    assert.ok(activePeopleIds(f.snapshot, f.snapshot.asOf, svc).length >= campaignIdsFor(f.snapshot, f.snapshot.asOf, f.mapping).length, `${name}: the plan's active people include the campaign's`)
    const campaign = r.steps.find((s) => s.kind === 'verify')
    if (campaign) assert.deepEqual([...affectedIds(campaign.population)].sort(), campaignIdsFor(f.snapshot, f.snapshot.asOf, f.mapping).sort(), `${name}: the campaign's population`)
  }
  // {guests} pluralises like {n}.
  assert.equal(fillText('{guests} guests', { guests: 1 }), '1 guest')
  assert.equal(fillText('{n} people', { n: 1 }), '1 person')
})

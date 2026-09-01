// Prompt 51 §8.1 / 2.1: one population object per step, read by the row, the
// step body and its More. Two figures for one quantity is a failing test.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { allFixtures } from '../roadmap/fixtures/index.ts'
import { runFixture } from '../roadmap/fixtures/run.ts'
import { stepPopulation } from './population.ts'
import { whoLine, populationLine, affectedIds } from './whoLine.ts'

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

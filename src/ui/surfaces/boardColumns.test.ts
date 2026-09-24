// The board's Impact and When columns (owner walk of 1.1, 2026-09-23).
//
// Impact says what a row touches, as a count where the step has one: Prepare
// Emergency Access Accounts read "Emergency access accounts", a label that
// counts nothing, over a step whose whole job is two accounts.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { curatedFixture } from '../../roadmap/fixtures/index.ts'
import type { Fixture } from '../../roadmap/fixtures/index.ts'
import { runFixture } from '../../roadmap/fixtures/run.ts'
import { BREAK_GLASS_STEP_ID } from '../../roadmap/stepIds.ts'
import { count } from '../../copy/statements.ts'
import { rowWho } from './rowWho.ts'

/** The fixture with this set of emergency accounts chosen. */
const choosing = (f: Fixture, ids: string[]): Fixture => ({ ...f, mapping: { ...f.mapping, breakGlassUserIds: ids } })
const emergencyStep = (f: Fixture) => runFixture(f, {}, null, f.snapshot.asOf).steps.find((s) => s.id === BREAK_GLASS_STEP_ID)!

test('1.1 Prepare Emergency Access Accounts: Impact counts the emergency accounts chosen, and two while fewer are', () => {
  const f = curatedFixture('getiamai')
  const chosen = f.mapping.breakGlassUserIds
  assert.equal(chosen.length, 2, 'the premise: getiamai has two emergency accounts chosen')
  assert.equal(rowWho(emergencyStep(f)), count(2, 'account'), 'two chosen')
  // A third account chosen is counted: the Impact is the accounts, not the minimum.
  const third = f.snapshot.users.find((u) => !chosen.includes(u.id) && u.accountEnabled !== false)!
  assert.equal(rowWho(emergencyStep(choosing(f, [...chosen, third.id]))), count(3, 'account'), 'three chosen')
  // Fewer than two: the step needs two, so the row says two.
  assert.equal(rowWho(emergencyStep(choosing(f, chosen.slice(0, 1)))), count(2, 'account'), 'one chosen')
  assert.equal(rowWho(emergencyStep(choosing(f, []))), count(2, 'account'), 'none chosen')
})

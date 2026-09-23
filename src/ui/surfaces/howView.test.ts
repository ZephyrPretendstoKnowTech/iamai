// What How IAMAI works says, read from the tables the page draws (howView.ts).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { howCheckTables } from './howView.ts'
import { EVALUATED_SUBJECTS } from '../../validation/report.ts'
import { engine } from '../../content/content.ts'

// "Every check IAMAI runs" listed seven pilot-group rows and three
// authentication-strength rows that no plan evaluates (generate.ts builds
// reports for five subjects only), and left out the static rules the plan does
// run on the tenant's own policies (Phase 2 audit, How).
test('Every check lists the rule subjects the plan evaluates, and the static rules on the tenant’s policies', () => {
  const tables = howCheckTables()
  const ids = tables.flatMap((t) => t.rows.map((r) => r.id))
  for (const id of ids) assert.doesNotMatch(id, /^(pilot|str)\./, `How lists ${id}, which no plan runs`)
  const ruleTables = tables.filter((t) => t.key !== 'staticRules').map((t) => t.key)
  assert.deepEqual(ruleTables, [...EVALUATED_SUBJECTS], 'the rule tables are exactly the subjects the plan evaluates')
  const statics = tables.find((t) => t.key === 'staticRules')
  assert.ok(statics, 'the static rules the plan runs on the tenant’s own policies are listed')
  assert.deepEqual(statics.rows.map((r) => r.id), Object.keys(engine.staticRules), 'one row per static rule the plan runs')
  assert.match(statics.rows.find((r) => r.id === 'autopilot')?.needs ?? '', /sign-in records/, 'the Autopilot rule reads the sign-in records')
  for (const r of statics.rows) {
    assert.ok(r.what.length > 0 && r.why.length > 0, `${r.id} says what it looks for and why`)
    assert.doesNotMatch(r.what, /\{policy\}/, `${r.id} shows a template slot`)
  }
})

// What How IAMAI works says, read from the tables the page draws (howView.ts).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { howCheckTables } from './howView.ts'
import { EVALUATED_SUBJECTS } from '../../validation/report.ts'
import { engine } from '../../content/content.ts'
import { REGISTRY } from '../../validation/rules.ts'
import type { RuleResult } from '../../validation/rules.ts'
import { emergencyTierOf } from '../../validation/emergencyTiers.ts'
import { SEVERITY } from '../../copy/validation.ts'

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

// Emergency access is decided in two tiers (validation/emergencyTiers.ts, owner
// 2026-09-11), not by rule severity: How called a shared Authenticator device and
// a populated profile field "Must fix" — the plan holds every step that can deny
// access — while the plan holds nothing on either (Phase 2 audit, How).
test('How calls an emergency-access check Must fix only where the plan’s tier holds the rollout on it', () => {
  const bg = howCheckTables().find((t) => t.key === 'breakGlass')
  assert.ok(bg)
  for (const row of bg.rows) {
    const rule = REGISTRY.find((r) => r.id === row.id)
    assert.ok(rule)
    const failed = { id: row.id, subject: 'breakGlass', severity: rule.severity, outcome: 'fail', target: null } as RuleResult
    const minimum = emergencyTierOf(failed, 0) === 'minimum'
    assert.equal(row.severityLabel === SEVERITY.blocker, minimum, `${row.id}: How says ${row.severityLabel}; the plan's tier with no account confirmed is ${emergencyTierOf(failed, 0)}`)
  }
  // bg.count is the one check whose tier moves: it holds the rollout with no
  // account confirmed and is hardening with one, and its row says so.
  assert.match(bg.rows.find((r) => r.id === 'bg.count')?.why ?? '', /deferred/)
})

// The owner's rule (validation/exclusionsGroupPolicies.ts): every applicable
// policy, Report-only included, excludes the exclusions group, because a
// Report-only policy is one mode change from enforcing; xg.usedConsistently
// holds the plan on it. How's emergency-account row said "Microsoft does not
// require the exclusion" for the same policy (Phase 2 audit, How).
test('How reads a missing Report-only exclusion one way: the exclusions group is held to Report-only policies too', () => {
  const tables = howCheckTables()
  const row = (id: string) => tables.flatMap((t) => t.rows).find((r) => r.id === id)
  const reportOnly = row('bg.excludedFromReportOnly')
  assert.ok(reportOnly)
  assert.doesNotMatch(reportOnly.why, /does not require/i, reportOnly.why)
  assert.match(reportOnly.why, /Report-only/)
  assert.match(reportOnly.why, /exclusions group/)
  assert.match(row('xg.usedConsistently')?.what ?? '', /report-only/i)
})

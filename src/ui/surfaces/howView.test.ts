// What How IAMAI works says, read from the tables the page draws (howView.ts).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { howCheckTables, howReadTables } from './howView.ts'
import { COLLECTOR_REGISTRY } from '../../graph/collect/registry.ts'
import { CORE_SOURCES } from '../../graph/collect/coreSections.ts'
import { EVALUATED_SUBJECTS } from '../../validation/report.ts'
import { app, engine, stepById } from '../../content/content.ts'
import { REGISTRY } from '../../validation/rules.ts'
import type { RuleResult } from '../../validation/rules.ts'
import { emergencyTierOf } from '../../validation/emergencyTiers.ts'
import { PREREQ_STEP_ID } from '../../roadmap/stepIds.ts'
import { ATTESTATION_RULES, NEED_LABEL, SEVERITY } from '../../copy/validation.ts'

test("Every check lists the rule subjects the plan evaluates, the static rules on the tenant's policies, and the authentication-strength prerequisite that holds the policies requiring it", () => {
  // "Every check IAMAI runs" listed seven pilot-group rows and three
  // authentication-strength rows that no plan evaluates (generate.ts builds
  // reports for five subjects only), and left out the static rules the plan does
  // run on the tenant's own policies (Phase 2 audit, How).
  {
    const tables = howCheckTables()
    const ids = tables.flatMap((t) => t.rows.map((r) => r.id))
    for (const id of ids) assert.doesNotMatch(id, /^(pilot|str)\./, `How lists ${id}, which no plan runs`)
    const ruleTables = tables.filter((t) => t.key !== 'staticRules' && t.key !== 'prerequisites').map((t) => t.key)
    assert.deepEqual(ruleTables, [...EVALUATED_SUBJECTS], 'the rule tables are exactly the subjects the plan evaluates')
    const statics = tables.find((t) => t.key === 'staticRules')
    assert.ok(statics, 'the static rules the plan runs on the tenant’s own policies are listed')
    assert.deepEqual(statics.rows.map((r) => r.id), Object.keys(engine.staticRules), 'one row per static rule the plan runs')
    assert.match(statics.rows.find((r) => r.id === 'autopilot')?.needs ?? '', /sign-in records/, 'the Autopilot rule reads the sign-in records')
    for (const r of statics.rows) {
      assert.ok(r.what.length > 0 && r.why.length > 0, `${r.id} says what it looks for and why`)
      assert.doesNotMatch(r.what, /\{policy\}/, `${r.id} shows a template slot`)
    }
  }
  // Dropping the str.* rows removed How's only mention of the plan's check that the
  // tenant has the baseline's authentication strength (Phase 2 review). The plan
  // runs it as a prerequisite step, not a registry rule: s-prereq-auth-strength
  // reads the scanned strengths, and while none allows exactly the baseline's
  // combinations and restrictions, the policies that require it wait on that step
  // (5, 2 and 1 policy steps on mid, small and large).
  {
    const table = howCheckTables().find((t) => t.key === 'prerequisites')
    assert.ok(table, 'no prerequisite table')
    assert.deepEqual(table.rows.map((r) => r.id), [PREREQ_STEP_ID.authStrength])
    const [row] = table.rows
    assert.equal(row.severity, 'prerequisite')
    assert.equal(row.needs, NEED_LABEL.authStrengths)
    assert.ok(row.what.length > 0)
    const title = (stepById[PREREQ_STEP_ID.authStrength] as unknown as { title: string }).title
    assert.ok(row.why.includes(title), `the row names the step the policies wait on, by its title: ${row.why}`)
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

test("How's Needs column never says nothing: a check that reads no scan evidence, or rests on the operator's confirmation, reads the plan's answers", () => {
  // Two emergency-access checks pass on the operator's own answer, and IAMAI reads
  // no alerting system; How presented the sign-in alert as something IAMAI checks,
  // needing "nothing". The licence check fails only on an enabled mailbox plan, and
  // How said it looks for any licence nothing needs and a mailbox "in daily use",
  // which IAMAI cannot see (Phase 2 audit, How).
  {
    const rows = howCheckTables().flatMap((t) => t.rows)
    for (const id of ATTESTATION_RULES) {
      const row = rows.find((r) => r.id === id)
      assert.ok(row)
      assert.equal(row.needs, NEED_LABEL.answers, `${id} rests on an answer given on the plan`)
    }
    assert.match(rows.find((r) => r.id === 'bg.signInMonitoring')?.what ?? '', /^You confirm/)
    const licence = rows.find((r) => r.id === 'bg.noLicenceNeeded')
    assert.ok(licence)
    assert.match(licence.what, /mailbox/)
    assert.doesNotMatch(licence.what, /daily use|unless something needs one/)
  }
  // A rule that lists no scan evidence reads the plan's answers alone: bg.count the
  // emergency accounts chosen, cty.atLeastOne the countries chosen. Its Needs cell
  // printed "nothing", which reads as a fact IAMAI checks without evidence
  // (Phase 2 review).
  {
    const rows = howCheckTables().flatMap((t) => t.rows)
    for (const r of rows) assert.notEqual(r.needs, 'nothing', r.id)
    for (const rule of REGISTRY.filter((r) => r.needs.length === 0 && (EVALUATED_SUBJECTS as readonly string[]).includes(r.subject))) {
      assert.equal(rows.find((r) => r.id === rule.id)?.needs, NEED_LABEL.answers, rule.id)
    }
    assert.equal(rows.find((r) => r.id === 'bg.count')?.needs, NEED_LABEL.answers)
    assert.equal(rows.find((r) => r.id === 'cty.atLeastOne')?.needs, NEED_LABEL.answers)
  }
})

test('What IAMAI reads lists one plain row per registry read, every path it requests, and no operator-groups read (owner, 2026-09-23)', () => {
  // "What IAMAI reads" printed the registry's developer notes: "none" under "When
  // it can fail" for twelve reads (the hostile tenant refuses one of them), raw
  // property names, "the replay engine", "for later phases" for a read the plan
  // already uses, "attempt and map the 403" (Phase 2 audit, How).
  {
    const tables = howReadTables()
    const rows = tables.flatMap((t) => t.rows)
    assert.equal(rows.length, COLLECTOR_REGISTRY.length, 'one row per registry read')
    assert.deepEqual(Object.keys(app.how.readRows).sort(), COLLECTOR_REGISTRY.map((s) => s.name).sort(), 'one plain line per registry read, and none for a read that is gone')
    const DEVELOPER = /\bnone\b|registrationEnforcement|policyMigrationState|replay engine|later phases|attempt and map|consumers|\bintents?\b|\bincl\.|signInActivity|\bSP\b/
    for (const r of rows) {
      assert.ok(r.conditions.trim().length > 0, `${r.name}: no conditions`)
      assert.ok(r.why.trim().length > 0, `${r.name}: no purpose`)
      assert.doesNotMatch(r.conditions, DEVELOPER, `${r.name}: "${r.conditions}"`)
      assert.doesNotMatch(r.why, DEVELOPER, `${r.name}: "${r.why}"`)
    }
    // A refused core section builds no plan (coreSections.ts), and the row says so.
    for (const s of COLLECTOR_REGISTRY.filter((x) => (CORE_SOURCES as readonly string[]).includes(x.configKey ? `config:${x.configKey}` : (x.sourceKey ?? '')))) {
      assert.match(rows.find((r) => r.name === s.name)?.conditions ?? '', /no plan/, `${s.name}: a refused read builds no plan`)
    }
    assert.doesNotMatch(app.how.columns.gate, /can fail/, 'the column says it lists when a read can fail')
  }
  // The cross-tenant collector also reads /default and /partners. Naming them in
  // the registry's endpoint broke the scan's request (Phase 2 review); the row
  // lists them from the registry's alsoReads, which the collector reads its paths from.
  {
    const rows = howReadTables().flatMap((t) => t.rows)
    for (const s of COLLECTOR_REGISTRY) {
      assert.deepEqual(rows.find((r) => r.name === s.name)?.endpoints, [s.endpoint, ...(s.alsoReads ?? [])], s.name)
    }
    assert.deepEqual(rows.find((r) => r.name === 'Cross-tenant access')?.endpoints, [
      '/policies/crossTenantAccessPolicy',
      '/policies/crossTenantAccessPolicy/default',
      '/policies/crossTenantAccessPolicy/partners',
    ])
  }
  // The operator reads say what the scan does with them (Phase 2 review). The
  // operator's groups (/me/memberOf) were read and nothing used them, which How
  // said; the owner dropped the read (2026-09-23), so How lists no such read.
  // "Signed-in operator … recorded in the plan file" was stale: the plan file
  // records the signed-in MSAL account (Export.tsx); the /me read is the
  // operator's id (derive/operator.ts), which the emergency-account check, the
  // operator-passkey step and the steps' "your own account" lines read.
  {
    assert.equal((app.how.readRows as Record<string, unknown>)['Operator groups'], undefined, 'How has no line for an operator-groups read')
    const rows = howReadTables().flatMap((t) => t.rows)
    assert.deepEqual(rows.filter((r) => r.endpoints.some((e) => e.includes('/me/memberOf'))).map((r) => r.name), [], 'no How row lists /me/memberOf')
    assert.ok(rows.some((r) => r.name === 'Signed-in operator'), 'the /me read is still listed')
    const me = app.how.readRows['Signed-in operator'].why
    assert.doesNotMatch(me, /plan file/i)
    assert.match(me, /emergency/i)
    assert.match(me, /passkey/i)
  }
})

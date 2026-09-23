// What How IAMAI works says, read from the tables the page draws (howView.ts).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { reviewBody } from '../../content/render.ts'
import { howCheckTables, howLimits } from './howView.ts'
import { EVALUATED_SUBJECTS } from '../../validation/report.ts'
import { app, engine, pages, stepById } from '../../content/content.ts'
import { REGISTRY } from '../../validation/rules.ts'
import type { RuleResult } from '../../validation/rules.ts'
import { emergencyTierOf } from '../../validation/emergencyTiers.ts'
import { ATTESTATION_RULES, NEED_LABEL, SEVERITY } from '../../copy/validation.ts'

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

// bg.drilled reads the recovery tests recorded on the plan (latestRecoveryTest),
// and a recent sign-in that is not one fails bg.lastSignIn. How said a sign-in in
// the last 90 days passes the check, needing "the user list": an administrator
// who followed it signed in and failed both (Phase 2 audit, How).
test('How says the drill check reads recorded recovery tests, and that a sign-in outside one is flagged', () => {
  const rows = howCheckTables().flatMap((t) => t.rows)
  const drilled = rows.find((r) => r.id === 'bg.drilled')
  assert.ok(drilled)
  assert.match(drilled.what, /recovery test is recorded/)
  assert.doesNotMatch(drilled.what, /signed in/)
  assert.match(drilled.needs, /recovery tests recorded/)
  const last = rows.find((r) => r.id === 'bg.lastSignIn')
  assert.ok(last)
  assert.match(last.what, /except on a recorded recovery test/, 'the row says when the check fails, not only what it records')
  assert.match(last.needs, /recovery tests recorded/)
})

// bg.perUserMfaOff reads the tenant's migration state and nothing about any
// account's per-user MFA; its "why" was about per-user MFA prompting, a
// different fact, which Finish Moving Off Per-User MFA reads for every account
// (Phase 2 audit, How).
test('How’s migration-state check says why the migration matters, and where per-user MFA itself is read', () => {
  const row = howCheckTables().flatMap((t) => t.rows).find((r) => r.id === 'bg.perUserMfaOff')
  assert.ok(row)
  assert.match(row.what, /migrating to the authentication methods policy/)
  assert.doesNotMatch(row.why, /prompts on its own terms/, row.why)
  assert.match(row.why, /migration/)
  const title = (stepById['s-prereq-per-user-mfa'] as unknown as { title: string }).title
  assert.ok(row.why.includes(title), `the why names the step that reads per-user MFA: ${title}`)
})

// Two emergency-access checks pass on the operator's own answer, and IAMAI reads
// no alerting system; How presented the sign-in alert as something IAMAI checks,
// needing "nothing". The licence check fails only on an enabled mailbox plan, and
// How said it looks for any licence nothing needs and a mailbox "in daily use",
// which IAMAI cannot see (Phase 2 audit, How).
test('How says which emergency-access checks are the operator’s confirmation, and what the licence check reads', () => {
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
})

// Connect's scan tile lists five limitations, then sends the reader to How for
// "its limits in full"; How's Limits held five different lines and none of
// Connect's (Phase 2 audit, How and Connect).
test('How’s Limits hold every limitation Connect lists before sending the reader there', () => {
  const connect = (pages.connect as unknown as { scan: { limits: string[]; limitsMore: string } }).scan
  assert.match(connect.limitsMore, /in full/)
  const limits = howLimits()
  for (const line of connect.limits) assert.ok(limits.includes(line), `How's Limits leave out Connect's "${line.slice(0, 60)}…"`)
  for (const line of app.how.limitsList) assert.ok(limits.includes(line), `How's Limits leave out its own "${line.slice(0, 60)}…"`)
})

// How's Baseline packages section was written into How.tsx rather than read from
// content (app.how.packages had no reader), said the baseline credit a second
// time in other words, and the no-AI line sat outside Limits speaking of "these
// tools" (Phase 2 audit, How).
test('How’s package section reads its words from content, says the credit once, and the no-AI line is a limit', () => {
  const how = readFileSync('src/ui/surfaces/How.tsx', 'utf8')
  assert.doesNotMatch(how, />Baseline Packages</, 'the section heading is written into How.tsx')
  assert.doesNotMatch(how, /maintained by Jon Hope/, 'the credit is written into How.tsx a second time')
  assert.match(how, /\{C\.packages\}/)
  const C = app.how as Record<string, string>
  assert.ok(C.packageBody, 'the section has its own sentence in content')
  const both = [C.packageBody, C.creditBaseline]
  assert.equal(both.filter((s) => /Jon Hope/.test(s)).length, 1, 'the credit is said once')
  assert.equal(both.filter((s) => /pin/i.test(s)).length, 1, 'what IAMAI does with the package is said once')
  for (const s of both) assert.doesNotMatch(s, /\bdefault\b/i, 'the baseline is offered as a default among choices')
  const noAi = (pages.how as Record<string, string>).noAi
  assert.ok(howLimits().includes(noAi), 'the no-AI line is one of the Limits')
  assert.doesNotMatch(noAi, /these tools/)
})

// The content-review page told the owner that How's Needs column names the step
// and that three reworded lines were live; How.tsx read none of them.
test('the review page claims no How rewording the page does not show', () => {
  const review = reviewBody()
  assert.doesNotMatch(review, /Needs column now names the step/)
  for (const key of ['needsByStep', 'exclusionsCheckReworded', 'groupSearchReworded', 'packageProblem']) {
    assert.equal((pages.how as Record<string, unknown>)[key], undefined, `pages.how.${key} is kept without a reader`)
  }
})

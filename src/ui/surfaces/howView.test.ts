// What How IAMAI works says, read from the tables the page draws (howView.ts).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { reviewBody } from '../../content/render.ts'
import { howCheckTables, howLimits, howReadTables } from './howView.ts'
import { COLLECTOR_REGISTRY } from '../../graph/collect/registry.ts'
import { CORE_SOURCES } from '../../graph/collect/coreSections.ts'
import { EVALUATED_SUBJECTS } from '../../validation/report.ts'
import { app, cleanup, engine, pages, stepById } from '../../content/content.ts'
import { REGISTRY } from '../../validation/rules.ts'
import type { RuleResult } from '../../validation/rules.ts'
import { emergencyTierOf } from '../../validation/emergencyTiers.ts'
import { PREREQ_STEP_ID } from '../../roadmap/stepIds.ts'
import { ATTESTATION_RULES, NEED_LABEL, SEVERITY } from '../../copy/validation.ts'

// "Every check IAMAI runs" listed seven pilot-group rows and three
// authentication-strength rows that no plan evaluates (generate.ts builds
// reports for five subjects only), and left out the static rules the plan does
// run on the tenant's own policies (Phase 2 audit, How).
test('Every check lists the rule subjects the plan evaluates, and the static rules on the tenant’s policies', () => {
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
  assert.match(last.what, /recorded recovery test/, 'the row says when the check fails, not only what it records')
  // The rule reads users[].lastSuccessfulSignIn, one date: an unrecorded
  // sign-in before the last one is never seen. "Has not signed in during the
  // last 90 days except on a recorded recovery test" said it was (Phase 2
  // review, round 2).
  assert.match(last.what, /most recent successful sign-in/, 'the row names the one sign-in the check reads')
  assert.doesNotMatch(last.what, /has not signed in|during the last/, 'the check cannot say the account made no other sign-in')
  assert.match(last.needs, /recovery tests recorded/)
})

// The step titles in rule copy came from a second, hand-written source: renaming
// the Cleanup drill row in content would have left How's Needs column naming a
// step that no longer exists (Phase 2 review).
test('Rule copy names steps by their content titles, never a copy of them', () => {
  const drill = cleanup.drill.title
  const perUser = (stepById['s-prereq-per-user-mfa'] as unknown as { title: string }).title
  assert.ok(NEED_LABEL.recoveryTests.includes(drill), NEED_LABEL.recoveryTests)
  const source = readFileSync('src/copy/validation.ts', 'utf8')
  for (const title of [drill, perUser]) assert.ok(!source.includes(title), `src/copy/validation.ts writes "${title}" out by hand`)
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
  // The step is built only when an account still has per-user MFA on, its
  // state was not read, or the directory read was partial
  // (roadmap/manualWork.ts perUserMfaReading), so the why never sends the
  // reader to it as though it were always there, and names all three.
  assert.doesNotMatch(row.why, new RegExp(`is read on ${title}`), row.why)
  assert.match(row.why, /read on every scan/, row.why)
  assert.match(row.why, /only while an account still has it on, its state could not be read, or the scan's read of the directory was incomplete/, row.why)
  // What is read and when the step is on the plan are two sentences: as one it
  // ran to 47 words on How and on the emergency-access check row.
  assert.match(row.why, new RegExp(`is read on every scan\\. The plan carries ${title} only while `), row.why)
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

// A rule that lists no scan evidence reads the plan's answers alone: bg.count the
// emergency accounts chosen, cty.atLeastOne the countries chosen. Its Needs cell
// printed "nothing", which reads as a fact IAMAI checks without evidence
// (Phase 2 review).
test('How’s Needs column never says "nothing": a check that reads no scan evidence reads the plan’s answers', () => {
  const rows = howCheckTables().flatMap((t) => t.rows)
  for (const r of rows) assert.notEqual(r.needs, 'nothing', r.id)
  for (const rule of REGISTRY.filter((r) => r.needs.length === 0 && (EVALUATED_SUBJECTS as readonly string[]).includes(r.subject))) {
    assert.equal(rows.find((r) => r.id === rule.id)?.needs, NEED_LABEL.answers, rule.id)
  }
  assert.equal(rows.find((r) => r.id === 'bg.count')?.needs, NEED_LABEL.answers)
  assert.equal(rows.find((r) => r.id === 'cty.atLeastOne')?.needs, NEED_LABEL.answers)
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

// "What IAMAI reads" printed the registry's developer notes: "none" under "When
// it can fail" for twelve reads (the hostile tenant refuses one of them), raw
// property names, "the replay engine", "for later phases" for a read the plan
// already uses, "attempt and map the 403" (Phase 2 audit, How).
test('What IAMAI reads states conditions and purposes in plain words, never "none"', () => {
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
})

// The cross-tenant collector also reads /default and /partners. Naming them in
// the registry's endpoint broke the scan's request (Phase 2 review); the row
// lists them from the registry's alsoReads, which the collector reads its paths from.
test('What IAMAI reads lists every path a read requests, the cross-tenant default and partner reads among them', () => {
  const rows = howReadTables().flatMap((t) => t.rows)
  for (const s of COLLECTOR_REGISTRY) {
    assert.deepEqual(rows.find((r) => r.name === s.name)?.endpoints, [s.endpoint, ...(s.alsoReads ?? [])], s.name)
  }
  assert.deepEqual(rows.find((r) => r.name === 'Cross-tenant access')?.endpoints, [
    '/policies/crossTenantAccessPolicy',
    '/policies/crossTenantAccessPolicy/default',
    '/policies/crossTenantAccessPolicy/partners',
  ])
})

// The operator reads say what the scan does with them (Phase 2 review). The
// operator's groups (/me/memberOf) were read and nothing used them, which How
// said; the owner dropped the read (2026-09-23), so How lists no such read.
// "Signed-in operator … recorded in the plan file" was stale: the plan file
// records the signed-in MSAL account (Export.tsx); the /me read is the
// operator's id (derive/operator.ts), which the emergency-account check, the
// operator-passkey step and the steps' "your own account" lines read.
test('the operator reads say what the scan does with them, and no operator-groups read is listed', () => {
  assert.equal((app.how.readRows as Record<string, unknown>)['Operator groups'], undefined, 'How has no line for an operator-groups read')
  const rows = howReadTables().flatMap((t) => t.rows)
  assert.deepEqual(rows.filter((r) => r.endpoints.some((e) => e.includes('/me/memberOf'))).map((r) => r.name), [], 'no How row lists /me/memberOf')
  assert.ok(rows.some((r) => r.name === 'Signed-in operator'), 'the /me read is still listed')
  const me = app.how.readRows['Signed-in operator'].why
  assert.doesNotMatch(me, /plan file/i)
  assert.match(me, /emergency/i)
  assert.match(me, /passkey/i)
})

// Dropping the str.* rows removed How's only mention of the plan's check that the
// tenant has the baseline's authentication strength (Phase 2 review). The plan
// runs it as a prerequisite step, not a registry rule: s-prereq-auth-strength
// reads the scanned strengths, and while none allows exactly the baseline's
// combinations and restrictions, the policies that require it wait on that step
// (5, 2 and 1 policy steps on mid, small and large).
test('Every check lists the plan’s authentication-strength prerequisite, which holds the policies that require it', () => {
  const table = howCheckTables().find((t) => t.key === 'prerequisites')
  assert.ok(table, 'no prerequisite table')
  assert.deepEqual(table.rows.map((r) => r.id), [PREREQ_STEP_ID.authStrength])
  const [row] = table.rows
  assert.equal(row.severity, 'prerequisite')
  assert.equal(row.needs, NEED_LABEL.authStrengths)
  assert.ok(row.what.length > 0)
  const title = (stepById[PREREQ_STEP_ID.authStrength] as unknown as { title: string }).title
  assert.ok(row.why.includes(title), `the row names the step the policies wait on, by its title: ${row.why}`)
})

// "Every check IAMAI runs, generated from the rules the code runs from": the plan
// runs checks How does not list (s-prereq-passkey-settings holds 17 steps on mid,
// and is not a row), and the prerequisite and static rows are written in content,
// not generated (Phase 2 review, round 2). The intro claims only what the tables
// hold: the rules' checks and the one prerequisite that is not a rule.
test('How’s checks intro claims only what the tables list', () => {
  const intro = app.how.checksIntro
  assert.doesNotMatch(intro, /\bevery\b|\ball\b|generated/i, intro)
  assert.match(intro, /rules/, 'it says the rows are what the rules check')
  const prerequisites = howCheckTables().find((t) => t.key === 'prerequisites')
  assert.deepEqual(prerequisites?.rows.map((r) => r.id), [PREREQ_STEP_ID.authStrength], 'a prerequisite row added to How is named in the intro too')
  assert.match(intro, /authentication strength/, 'it names the one prerequisite the tables list')
})

// The app-protection rule (roadmap/staticRules.ts) tests the grant
// 'compliantApplication', which Microsoft labels "Require app protection policy";
// 'approvedApplication' is the approved client app. The Plan's Housekeeping line
// and How called the control "an approved app" (Phase 2 review).
test('The app-protection rule names the control it tests', () => {
  const source = readFileSync('src/roadmap/staticRules.ts', 'utf8')
  assert.match(source, /grant\.includes\('compliantApplication'\)/)
  const how = howCheckTables().find((t) => t.key === 'staticRules')?.rows.find((r) => r.id === 'appProtectionManaged')
  for (const text of [how?.what ?? '', engine.staticRules.appProtectionManaged]) {
    assert.match(text, /app protection policy/, text)
    assert.doesNotMatch(text, /approved app/, text)
  }
})

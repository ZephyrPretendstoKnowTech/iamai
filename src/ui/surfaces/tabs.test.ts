// Today as CSV says what the Today table says; the PowerShell tab renders the
// JSON tab's body; the How page's check rows carry no forbidden string.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fixture } from '../../roadmap/fixtures/index.ts'
import { runFixture } from '../../roadmap/fixtures/run.ts'
import { todayView } from '../../derive/today.ts'
import { todayTable } from './inventoryTables.ts'
import { methodWord, readinessWord, todayEvidenceText } from './todayCells.ts'
import { powershellFor } from './stepPowerShell.ts'
import { stepPortalLines, portalNamesFor } from './stepPortal.ts'
import { stepVars } from './stepVars.ts'
import type { StepVarContext } from './stepVars.ts'
import { contentStepFor } from '../../content/stepTitle.ts'
import { REGISTRY, ruleText, citationFor } from '../../validation/rules.ts'
import { SUBJECT } from '../../copy/validation.ts'
import { jsonOffered, missingObjects, stepOperations } from './stepJson.ts'
import { copyBoxes, stepLines } from './stepExport.ts'
import { content } from '../../content/content.ts'
import type { RoadmapInput } from '../../roadmap/generate.ts'
import { rowWhen } from './rowWhen.ts'
import { notLicensedRows } from '../../derive/notLicensed.ts'
import { DEVICE_GOALS } from '../../roadmap/deviations.ts'
import { stepById } from '../../content/content.ts'
import { PINNED_GOAL_MAP, goalInMap } from '../../roadmap/goalMap.ts'
import { pages } from '../../content/content.ts'
import { fillText } from '../../content/render.ts'

const FIXTURES = ['demo', 'getiamai'] as const

test('Today as CSV writes the readiness word, the method word and the evidence line the Today table renders', () => {
  for (const name of FIXTURES) {
    const f = fixture(name)
    const view = todayView(f.snapshot, f.snapshot.asOf, f.mapping)
    const table = todayTable(f.snapshot, f.mapping)
    assert.deepEqual(table.header, ['Account', 'Readiness', 'Strongest method', 'Evidence'])
    assert.equal(table.rows.length, view.rows.length, `${name}: one CSV row per table row`)
    view.rows.forEach((r, i) => {
      assert.equal(table.rows[i][1], readinessWord(r), `${name} row ${i}: the readiness word`)
      assert.equal(table.rows[i][2], methodWord(r.method), `${name} row ${i}: the method word`)
      assert.equal(table.rows[i][3], todayEvidenceText(r), `${name} row ${i}: the evidence line`)
    })
  }
})

test('for every policy step, the three Do it tabs differ and the PowerShell carries the JSON tab\'s displayName', () => {
  let seen = 0
  for (const name of FIXTURES) {
    const f = fixture(name)
    const r = runFixture(f)
    const ctx: StepVarContext = { snapshot: f.snapshot, mapping: f.mapping, nameOf: (id) => r.input.names!.label(id), signature: 'IT', operatorId: f.operatorId, now: f.snapshot.asOf, groups: f.groups }
    for (const s of r.steps) {
      const cs = contentStepFor(s) as { kind?: string; title?: string } | undefined
      if (cs?.kind !== 'policy' || !s.action.json) continue
      const ex = stepVars(s, ctx)
      const names = portalNamesFor(ctx, ex, String(cs.title))
      const portal = stepPortalLines(s, names)
      if (!portal || portal.length === 0) continue
      const body = JSON.parse(s.action.json) as { displayName?: string }
      const jsonTab = JSON.stringify(body, null, 2)
      const ps = powershellFor(stepOperations(s))
      const portalTab = portal.join('\n')
      assert.notEqual(portalTab, jsonTab, `${name} ${s.id}: portal and JSON differ`)
      assert.notEqual(jsonTab, ps, `${name} ${s.id}: JSON and PowerShell differ`)
      assert.notEqual(portalTab, ps, `${name} ${s.id}: portal and PowerShell differ`)
      assert.match(ps, /^Connect-MgGraph -Scopes Policy\.ReadWrite\.ConditionalAccess\n/, `${name} ${s.id}: connects with the one write scope`)
      if (typeof body.displayName === 'string') assert.ok(ps.includes(body.displayName), `${name} ${s.id}: the PowerShell carries the JSON tab's displayName`)
      // Each operation calls the cmdlet its own mode names, against its own policy.
      for (const op of stepOperations(s)) {
        if (op.mode === 'update') assert.ok(op.policyId && ps.includes(`-ConditionalAccessPolicyId '${op.policyId}'`), `${name} ${s.id}: an update names the policy it changes`)
        else assert.match(ps, /New-MgIdentityConditionalAccessPolicy -BodyParameter \$body/, `${name} ${s.id}: a create is New-`)
      }
      seen++
    }
  }
  assert.ok(seen >= 10, `policy steps checked (${seen})`)
  // Two bodies are two labelled blocks.
  const two = powershellFor([
    { sourceName: 'A', mode: 'create', policyId: null, body: { displayName: 'A', conditions: {}, grantControls: { builtInControls: ['mfa'] } } },
    { sourceName: 'B', mode: 'create', policyId: null, body: { displayName: 'B', conditions: {}, grantControls: { builtInControls: ['mfa'] } } },
  ])
  assert.match(two, /# Policy A\n\$bodyA = @'/)
  assert.match(two, /# Policy B\n\$bodyB = @'/)
})

test('the How page\'s check rows carry no forbidden-everywhere string', () => {
  const forbid = (JSON.parse(readFileSync('docs/qa/page-contracts.json', 'utf8')) as { forbidEverywhere?: string[] }).forbidEverywhere ?? []
  assert.ok(forbid.length > 0)
  const hits: string[] = []
  for (const r of REGISTRY) {
    const text = [SUBJECT[r.subject] ?? r.subject, ruleText(r.id).what, ruleText(r.id).why, JSON.stringify(citationFor(r.id) ?? '')].join(' ')
    for (const f of forbid) if (text.includes(f)) hits.push(`${r.id}: ${f}`)
  }
  assert.deepEqual(hits, [])
  assert.equal(ruleText('pilot.hasMembers').why, 'An empty first group proves nothing and delays every group behind it.')
})

// A policy step's JSON waits on every object the body names; the translator
// never drops one silently. GetIAMAI's countries policy names the baseline's
// location; with no such location in the tenant it offers no JSON and names the
// step that creates one; with the tenant's own countries location, its JSON
// carries excludeLocations with that id.
test('GetIAMAI: the countries block waits on the allowed-countries location, then carries it', () => {
  const f = fixture('getiamai')
  const geo = (r: ReturnType<typeof runFixture>) => r.steps.find((s) => s.id === 's-goal-geo-restriction')!
  const without = geo(runFixture(f))
  assert.equal(without.action.json, null, 'no body at all while the location is missing')
  assert.equal(jsonOffered(without), false, 'no JSON is offered while the location is missing')
  const names = missingObjects(without).map((m) => m.title)
  assert.ok(names.includes('Create or Correct Allowed Countries Location'), `names the step that creates it (${names.join(', ')})`)
  // The tenant's own countries location, matching the allowed list.
  const location = { '@odata.type': '#microsoft.graph.countryNamedLocation', id: 'loc-au', displayName: 'Allowed countries', countriesAndRegions: ['AU'], includeUnknownCountriesAndRegions: false }
  const named = f.snapshot.config.namedLocations ?? { status: 'ok', reason: null, rows: [] }
  const snapshot = { ...f.snapshot, config: { ...f.snapshot.config, namedLocations: { ...named, rows: [...(named.rows ?? []), location] } } }
  assert.deepEqual(f.mapping.allowedCountries, ['AU'])
  const withLocation = geo(runFixture({ ...f, snapshot }, { snapshot } as Partial<RoadmapInput>))
  assert.equal(jsonOffered(withLocation), true, 'the JSON is offered once the location exists')
  assert.deepEqual(JSON.parse(withLocation.action.json!).conditions.locations.excludeLocations, ['loc-au'])
  assert.ok(!missingObjects(withLocation).some((m) => m.stepId === 's-prereq-allowed-countries'))
})

// The adapt line renders once under every copy box, and nowhere else.
test('every copy box on both fixtures is followed by the adapt line, and it appears nowhere else', () => {
  const adapt = String((content.shared as Record<string, unknown>).adaptLine)
  assert.ok(adapt.length > 0)
  let boxes = 0
  for (const name of FIXTURES) {
    const f = fixture(name)
    const r = runFixture(f)
    const ctx: StepVarContext = { snapshot: f.snapshot, mapping: f.mapping, nameOf: (id) => r.input.names!.label(id), signature: 'IT', operatorId: f.operatorId, now: f.snapshot.asOf, groups: f.groups }
    for (const s of r.steps) {
      for (const box of copyBoxes(s, ctx)) {
        boxes++
        assert.equal(box.after, adapt, `${name} ${s.id} ${box.kind}: the adapt line follows the box`)
        assert.ok(!box.text.includes(adapt), `${name} ${s.id} ${box.kind}: the box itself does not carry it`)
      }
      for (const line of stepLines(s, ctx)) assert.ok(!line.includes(adapt), `${name} ${s.id}: the adapt line is not in the step's other lines`)
    }
  }
  assert.ok(boxes >= 3, `copy boxes seen (${boxes})`)
  // In the content file it exists once, as shared.adaptLine.
  const hits: string[] = []
  const walk = (node: unknown, path: string): void => {
    if (typeof node === 'string') { if (node.includes(adapt)) hits.push(path) }
    else if (Array.isArray(node)) node.forEach((v, i) => walk(v, `${path}[${i}]`))
    else if (node && typeof node === 'object') for (const [k, v] of Object.entries(node)) walk(v, `${path}.${k}`)
  }
  walk(content, '')
  assert.deepEqual(hits, ['.shared.adaptLine'])
})

// A partly covered goal's step names the tenant's policy as the one to change,
// and its row reads Blocked · <date> or Ready · now, never Blocked · now.
test('GetIAMAI: with a Windows-only token-protection policy on, the step names that policy and its blocked row carries a date', () => {
  const f = fixture('getiamai')
  const exclusions = f.mapping.records['__globalExclusion']?.resolvedId
  const policy = {
    id: 'p-token', displayName: 'Core - Require - Token Protection (Windows)', state: 'enabled', createdDateTime: '2026-01-10T00:00:00Z',
    conditions: { users: { includeUsers: ['All'], excludeUsers: [...f.mapping.breakGlassUserIds], excludeGroups: exclusions ? [exclusions] : [] }, applications: { includeApplications: ['00000002-0000-0ff1-ce00-000000000000', '00000003-0000-0ff1-ce00-000000000000'] }, platforms: { includePlatforms: ['windows'] }, clientAppTypes: ['mobileAppsAndDesktopClients'] },
    grantControls: null, sessionControls: { secureSignInSession: { isEnabled: true } },
  }
  const ca = f.snapshot.config.caPolicies ?? { status: 'ok' as const, reason: null, rows: [] }
  const snapshot = { ...f.snapshot, config: { ...f.snapshot.config, caPolicies: { ...ca, rows: [...(ca.rows ?? []), policy] } } }
  const r = runFixture({ ...f, snapshot }, { snapshot } as Partial<RoadmapInput>)
  const cov = r.coverage.results.find((x) => x.goal.id === 'token-protection')!
  assert.equal(cov.status, 'partial', 'the goal is partly covered')
  const step = r.steps.find((s) => s.id === 's-goal-token-protection')!
  assert.equal(step.kind, 'adjust')
  const ctx: StepVarContext = { snapshot, mapping: f.mapping, nameOf: (id) => r.input.names!.label(id), signature: 'IT', operatorId: f.operatorId, now: f.snapshot.asOf, groups: f.groups }
  const ex = stepVars(step, ctx)
  assert.equal(ex.policyName, 'Core - Require - Token Protection (Windows)', 'Name: is the tenant\'s policy')
  const lines = stepPortalLines(step, portalNamesFor(ctx, ex, 'Require Token Protection')) ?? []
  assert.ok(lines.some((l) => l.includes('Core - Require - Token Protection (Windows)')), 'the portal lines name it')
  assert.ok(!lines.some((l) => /Name: Require Token Protection/.test(l)), 'never the step title')
  const now = (pages.plan as { now: string }).now
  const wave = r.schedule.waves.find((w) => w.stepIds.includes(step.id)) ?? null
  const when = rowWhen(step, wave?.start ?? null)
  if (step.status === 'blocked') assert.notEqual(when, now, 'Blocked · <date>, never Blocked · now')
  else assert.equal(when, now, 'Ready · now')
  // A blocked step with no date of its own reads its wave's start.
  assert.equal(rowWhen({ ...step, status: 'blocked', events: null, rings: [] }, '2026-10-05T12:00:00.000Z'), rowWhen({ ...step, status: 'blocked', events: null, rings: [] }, '2026-10-05T12:00:00.000Z'))
  assert.notEqual(rowWhen({ ...step, status: 'blocked', events: null, rings: [] }, '2026-10-05T12:00:00.000Z'), now)
  assert.equal(rowWhen({ ...step, status: 'ready', events: null, rings: [] }, '2026-10-05T12:00:00.000Z'), now, 'Ready · now')
})

// The footer's Doesn't-apply group holds the person's answers only; a goal a
// licence facet switched off is a Not licensed row, with the licence it needs.
test('GetIAMAI: the prompt renders in full, the Doesn\'t-apply group holds only answers, and the licence rows sit under Not licensed', () => {
  const f = fixture('getiamai')
  const r = runFixture(f)
  const shared = content.shared as Record<string, string>
  const prompt = fillText(shared.doesntApplyPrompt, { tenant: 'GetIAMAI' })
  assert.equal(prompt, shared.doesntApplyPrompt.replace('{tenant}', 'GetIAMAI'), 'the prompt in full, the tenant filled')
  assert.ok(!/\{[a-zA-Z]+\}/.test(prompt))
  assert.deepEqual(r.steps.filter((s) => s.doesntApply).map((s) => s.id), [], 'no answers: the group is empty')
  // Over the goals this baseline holds: an absent goal never renders (walk-51 item 9).
  const licenceGoals = r.coverage.results.filter((x) => x.status === 'not-applicable' && x.applicability && / licence$/.test(x.applicability.reason) && goalInMap(PINNED_GOAL_MAP, x.goal.id)).map((x) => x.goal.id)
  assert.ok(licenceGoals.length >= 1, `licence-facet goals the baseline holds (${licenceGoals.join(', ')})`)
  const rows = notLicensedRows(r.coverage, PINNED_GOAL_MAP)
  for (const id of licenceGoals) {
    // The device goals share one Not licensed line (E2), named by their content titles.
    const row = rows.find((x) => x.goalId === id) ?? (DEVICE_GOALS.has(id) ? rows.find((x) => x.goalId === 'devices' && x.text.includes(String(stepById[id]?.title))) : undefined)
    assert.ok(row, `${id} is a Not licensed row`)
    assert.ok(/Intune|Workload/.test(row!.licence), `${id}: the licence (${row!.licence})`)
  }
})

// Today as CSV says what the Today table says; the PowerShell tab renders the
// JSON tab's body; the How page's check rows carry no forbidden string.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fixture } from '../../roadmap/fixtures/index.ts'
import { runFixture } from '../../roadmap/fixtures/run.ts'
import { todayView } from '../../derive/today.ts'
import { todayTable } from './inventoryTables.ts'
import { todayEvidenceText, todayStateWord } from './todayCells.ts'
import { powershellFor } from './stepPowerShell.ts'
import { stepPortalLines, stepPortalLinesFromBody, portalNamesFor } from './stepPortal.ts'
import { stepVars } from './stepVars.ts'
import type { StepVarContext } from './stepVars.ts'
import { contentStepFor } from '../../content/stepTitle.ts'
import { REGISTRY, ruleText, citationFor } from '../../validation/rules.ts'
import { SUBJECT } from '../../copy/validation.ts'
import { jsonOffered, missingObjects } from './stepJson.ts'
import { copyBoxes, stepLines } from './stepExport.ts'
import { content } from '../../content/content.ts'
import type { RoadmapInput } from '../../roadmap/generate.ts'

const FIXTURES = ['demo', 'getiamai'] as const

test('Today as CSV writes the state word and the evidence line the Today table renders', () => {
  for (const name of FIXTURES) {
    const f = fixture(name)
    const svc = new Set(f.mapping.serviceAccountUserIds)
    const view = todayView(f.snapshot, f.snapshot.asOf, svc)
    const table = todayTable(f.snapshot, svc)
    assert.equal(table.rows.length, view.rows.length, `${name}: one CSV row per table row`)
    view.rows.forEach((r, i) => {
      assert.equal(table.rows[i][1], todayStateWord(r.state), `${name} row ${i}: the state word`)
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
      const portal = stepPortalLines(s.goalId, names) ?? (s.floor ? stepPortalLinesFromBody(s.action.json, names) : null)
      if (!portal || portal.length === 0) continue
      const body = JSON.parse(s.action.json) as { displayName?: string }
      const jsonTab = JSON.stringify(body, null, 2)
      const ps = powershellFor(body, s.kind === 'adjust' ? (s.tracking?.policyId ?? null) : null)
      const portalTab = portal.join('\n')
      assert.notEqual(portalTab, jsonTab, `${name} ${s.id}: portal and JSON differ`)
      assert.notEqual(jsonTab, ps, `${name} ${s.id}: JSON and PowerShell differ`)
      assert.notEqual(portalTab, ps, `${name} ${s.id}: portal and PowerShell differ`)
      assert.match(ps, /^Connect-MgGraph -Scopes Policy\.ReadWrite\.ConditionalAccess\n/, `${name} ${s.id}: connects with the one write scope`)
      if (typeof body.displayName === 'string') assert.ok(ps.includes(body.displayName), `${name} ${s.id}: the PowerShell carries the JSON tab's displayName`)
      if (s.kind === 'adjust') assert.ok(s.tracking?.policyId && ps.includes(`-ConditionalAccessPolicyId '${s.tracking.policyId}'`), `${name} ${s.id}: an adjust updates the policy it names`)
      else assert.match(ps, /New-MgIdentityConditionalAccessPolicy -BodyParameter \$body/, `${name} ${s.id}: a create is New-`)
      seen++
    }
  }
  assert.ok(seen >= 10, `policy steps checked (${seen})`)
  // Two bodies are two labelled blocks.
  const two = powershellFor([{ displayName: 'A' }, { displayName: 'B' }])
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
  assert.ok(without.action.json, 'the body exists')
  assert.equal(jsonOffered(without), false, 'no JSON is offered while the location is missing')
  const names = missingObjects(without).map((m) => m.title)
  assert.ok(names.includes('Create or Correct Allowed Countries Location'), `names the step that creates it (${names.join(', ')})`)
  assert.ok(!JSON.parse(without.action.json!).conditions?.locations?.excludeLocations, 'the missing location is not in the JSON')
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

// One population, three screens (derive/sets.ts notPeopleIds): the emergency
// accounts are not people anywhere but Inventory and the emergency step, and
// the readiness strip, the campaign step's lead, its row's who column and
// Today's active count read the same population, the operator included.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fixture } from '../roadmap/fixtures/index.ts'
import { runFixture } from '../roadmap/fixtures/run.ts'
import { contentStepFor } from '../content/stepTitle.ts'
import { pages } from '../content/content.ts'
import { fillText } from '../content/render.ts'
import { notPeopleIds, peopleCounts } from './sets.ts'
import { todayView } from './today.ts'
import { readinessStrip } from './readinessStrip.ts'
import { affectedIds } from './whoLine.ts'
import { contentLists } from './contentLists.ts'
import { planDates, stepVars } from '../ui/surfaces/stepVars.ts'
import type { StepVarContext } from '../ui/surfaces/stepVars.ts'
import { rowWho } from '../ui/surfaces/rowWho.ts'
import { inventoryTables } from '../ui/surfaces/inventoryTables.ts'

const f = fixture('getiamai')
const r = runFixture(f)
const nameOf = (id: string): string => r.input.names!.label(id)
const notPeople = notPeopleIds(f.mapping)
const today = todayView(f.snapshot, f.snapshot.asOf, notPeople)
const campaign = r.steps.find((s) => (contentStepFor(s) as { kind?: string } | undefined)?.kind === 'campaign')!
const ctx: StepVarContext = { snapshot: f.snapshot, mapping: f.mapping, nameOf, signature: 'IT', operatorId: f.operatorId, now: f.snapshot.asOf, groups: f.groups, naming: r.coverage.organisation.naming, ...planDates(r.steps, r.schedule.start, r.coverage.organisation.naming) }

test('GetIAMAI: the strip, the campaign lead, its who column and Today\'s active count all read 2, the operator among them', () => {
  const strip = readinessStrip(f.snapshot, f.mapping, f.snapshot.asOf)
  const ex = stepVars(campaign, ctx) as Record<string, unknown>
  const lead = fillText(String((contentStepFor(campaign) as unknown as { who: { lead: string } }).who.lead), ex)
  const who = affectedIds(campaign.population)
  const numbers = { strip: strip.active, lead: Number(ex.active), who: who.length, today: today.counts.active }
  assert.deepEqual(numbers, { strip: 2, lead: 2, who: 2, today: 2 }, JSON.stringify(numbers))
  assert.ok(lead.startsWith('2 active people'), lead)
  assert.equal(fillText(String((pages.today as { line: string }).line), { ...today.counts, from: 'x', to: 'y' }).slice(0, 15), '2 active people', "Today's line")
  const whoText = rowWho(campaign, nameOf)
  for (const id of who) assert.ok(whoText.includes(nameOf(id)) || /2 people/.test(whoText), `${whoText} covers ${nameOf(id)}`)
  // The operator is one of them, on every screen.
  assert.ok(who.includes(f.operatorId), 'the campaign counts the operator')
  assert.ok(Object.values(strip.tiles).flat().some((p) => p.id === f.operatorId), 'the strip counts the operator')
  const row = today.rows.find((x) => x.user.id === f.operatorId)!
  assert.ok(row && row.state !== 'notActive', 'Today counts the operator active')
})

test('the emergency accounts are not people: not in Today\'s count or table; Inventory and the emergency step list them', () => {
  const emergency = f.mapping.breakGlassUserIds
  assert.ok(emergency.length === 2)
  for (const id of emergency) assert.ok(!today.rows.some((row) => row.user.id === id), `${nameOf(id)} has no Today row`)
  const withThem = peopleCounts(f.snapshot, f.snapshot.asOf, new Set(f.mapping.serviceAccountUserIds))
  assert.equal(today.counts.directory, withThem.directory - emergency.length, 'not in the directory count')
  assert.equal(today.counts.enabled, withThem.enabled - emergency.length, 'not in the enabled count')
  assert.ok(today.counts.active < withThem.active, 'not in the active count')
  const people = inventoryTables(f.snapshot).find((t) => t.id === 'people')!
  for (const id of emergency) assert.ok(people.rows.some((row) => String(row[0]) === nameOf(id)), `${nameOf(id)} is listed in Inventory`)
  const lists = contentLists({ snapshot: f.snapshot, mapping: f.mapping, nameOf, now: f.snapshot.asOf, operatorId: f.operatorId })
  assert.deepEqual(lists.emergencyAccounts, emergency.map(nameOf), 'the emergency step lists them')
})

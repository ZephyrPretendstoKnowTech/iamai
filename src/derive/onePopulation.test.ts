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
import { notPeopleIds } from './sets.ts'
import { isActivePerson, peopleCounts, reached } from './population.ts'
import { stepContract } from '../ui/surfaces/stepContract.ts'
import { EXPLAINED, readinessView } from './mfaReadiness.ts'
import { KINDS, ladder } from './ladder.ts'
import { READINESS_STATES } from '../scoring/phishingResistant.ts'
import { affectedIds, populationLine } from './whoLine.ts'
import { adminUserIds } from '../roles.ts'
import { contentLists } from './contentLists.ts'
import { planDates, stepVars } from '../ui/surfaces/stepVars.ts'
import type { StepVarContext } from '../ui/surfaces/stepVars.ts'
import { rowWho } from '../ui/surfaces/rowWho.ts'
import { inventoryTables } from '../ui/surfaces/inventoryTables.ts'

const f = fixture('getiamai')
const r = runFixture(f)
const nameOf = (id: string): string => r.input.names!.label(id)
const notPeople = notPeopleIds(f.mapping)
const today = readinessView(f.snapshot, f.snapshot.asOf, f.mapping)
const campaign = r.steps.find((s) => (contentStepFor(s) as { kind?: string } | undefined)?.kind === 'campaign')!
const ctx: StepVarContext = { snapshot: f.snapshot, mapping: f.mapping, nameOf, signature: 'IT', operatorId: f.operatorId, now: f.snapshot.asOf, groups: f.groups, naming: r.coverage.organisation.naming, ...planDates(r.steps, r.schedule.start, r.coverage.organisation.naming) }

test('GetIAMAI: the strip, the campaign lead, its who column and Today\'s active count all read 2, the operator among them', () => {
  const strip = ladder(f.snapshot, f.mapping, f.snapshot.asOf)
  const ex = stepVars(campaign, ctx) as Record<string, unknown>
  const lead = fillText(String((contentStepFor(campaign) as unknown as { who: { lead: string } }).who.lead), ex)
  const who = affectedIds(campaign.population)
  const numbers = { strip: strip.active, lead: Number(ex.active), who: who.length, today: today.facts.active }
  assert.deepEqual(numbers, { strip: 2, lead: 2, who: 2, today: 2 }, JSON.stringify(numbers))
  assert.equal(Number(ex.n), campaign.preparation!.ids.length, 'the lead counts the preparation cohort')
  assert.equal(lead, '2 people are included in this preparation step.')
  const uncounted = EXPLAINED.reduce((n, e) => n + today.explained[e], 0) + KINDS.reduce((n, k) => n + today.facts.kinds[k], 0)
  assert.equal(today.facts.active + uncounted, today.facts.accounts, 'the explained and the kinds are everyone the 2 active people leave out')
  const whoText = rowWho(campaign)
  assert.match(whoText, /^2 people( · |$)/, 'the who column counts the two people')
  for (const id of who) assert.equal(whoText.includes(nameOf(id)), false, `${whoText} names ${nameOf(id)}; a row counts people and never names them`)
  // The signed-in account is a person like any other: on every screen when the directory says it is active, on none otherwise.
  const row = today.rows.find((x) => x.user.id === f.operatorId)!
  assert.ok(row && row.kind === 'person', 'the operator has a row')
  assert.equal(who.includes(f.operatorId), row.active, 'the campaign counts the operator exactly when Today does')
  assert.equal(READINESS_STATES.some((s) => strip.states[s].some((p) => p.id === f.operatorId)), row.active, 'the partition counts the operator exactly when MFA Readiness does')
})

test('the emergency accounts are not people: listed on MFA Readiness by kind, never in a readiness state or the active count; Inventory and the emergency step list them', () => {
  const emergency = f.mapping.breakGlassUserIds
  assert.ok(emergency.length === 2)
  for (const id of emergency) {
    const row = today.rows.find((x) => x.user.id === id)!
    assert.ok(row && row.kind === 'emergency' && !row.active && row.state === null, `${nameOf(id)} is listed as emergency access, never counted`)
  }
  assert.equal(today.facts.kinds.emergency, emergency.length, 'the ledger counts them as emergency access')
  const withThem = peopleCounts(f.snapshot, f.snapshot.asOf, new Set(f.mapping.serviceAccountUserIds))
  assert.ok(today.facts.active < withThem.active, 'not in the active count')
  const people = inventoryTables(f.snapshot).find((t) => t.id === 'people')!
  for (const id of emergency) assert.ok(people.rows.some((row) => String(row[0]) === nameOf(id)), `${nameOf(id)} is listed in Inventory`)
  const lists = contentLists({ snapshot: f.snapshot, mapping: f.mapping, nameOf, now: f.snapshot.asOf })
  assert.deepEqual(lists.emergencyAccounts, emergency.map(nameOf), 'the emergency step lists them')
})

// Two numbers for one word, on one board.
//
// "51 admins" on the admin-session step and "60 admins" on the
// administrator-separation step, same tenant, same sixty accounts. Every
// step counts admins over its ACTIVE ids (generate.ts population: "admins
// and guests are the active ones too, so the line and the count cannot
// disagree") and the separation step counted them over all of them. The
// review scope is its own figure and says so ("60 accounts to review").
//
// Exactly, not "at most" (R4-57): the admins and guests on a line are the ones
// among the ids its head counts. A step that names accounts rather than people
// (the dormant accounts, the per-user MFA states) counts them over those
// accounts; the dormant step read "731 accounts" on the large tenant with 9
// admins and 28 guests among them and said neither, because its admins were
// counted over the active people it holds, which is none. "admins <= active"
// passed it.
test('one admin denominator: every step counts admins over the people it counts', () => {
  for (const name of ['small', 'mid', 'large', 'midflight', 'hostile', 'messy'] as const) {
    const fx = fixture(name)
    const admins = adminUserIds(fx.snapshot.roles)
    const guests = new Set(fx.snapshot.users.filter((u) => u.userType === 'guest').map((u) => u.id))
    for (const step of runFixture(fx).steps) {
      const p = step.population
      if (!p) continue
      const head = affectedIds(p)
      assert.equal(p.admins, head.filter((id) => admins.has(id)).length, `${name}/${step.id}: ${p.admins} admins, counted over the ${head.length} the line counts`)
      assert.equal(p.guests, head.filter((id) => guests.has(id)).length, `${name}/${step.id}: ${p.guests} guests, counted over the ${head.length} the line counts`)
    }
  }
})

// R4-57. The per-user MFA step built its population by hand: "active" meant the
// account is enabled, and the admins and guests were carried over as zero from
// an empty population. With per-user MFA on for the two emergency accounts, two
// dormant ones and one active admin, its line read "5 active people": the
// emergency accounts are not people anywhere, the dormant ones are not active,
// and three admins read as none.
test('the per-user MFA step names accounts, and counts its admins among them', () => {
  const fx = structuredClone(fixture('getiamai'))
  const first = runFixture(fx)
  const active = new Set(first.input.viability.filter((v) => isActivePerson(v)).map((v) => v.userId))
  const admins = adminUserIds(fx.snapshot.roles)
  const bg = new Set(fx.mapping.breakGlassUserIds)
  const dormant = fx.snapshot.users.filter((u) => !active.has(u.id) && !bg.has(u.id)).slice(0, 2).map((u) => u.id)
  const activeAdmin = fx.snapshot.users.filter((u) => active.has(u.id) && admins.has(u.id)).slice(0, 1).map((u) => u.id)
  const on = new Set([...bg, ...dormant, ...activeAdmin])
  assert.equal(on.size, 5, 'the premise: two emergency accounts, two dormant, one active admin')
  fx.snapshot.perUserMfa = Object.fromEntries(fx.snapshot.users.map((u) => [u.id, { state: on.has(u.id) ? 'enabled' : 'disabled', reason: null }])) as typeof fx.snapshot.perUserMfa
  const step = runFixture(fx).steps.find((s) => s.id === 's-prereq-per-user-mfa')
  assert.ok(step, 'the premise: the step is planned')
  const pop = reached(step)
  assert.ok(pop !== null)
  assert.deepEqual([...affectedIds(pop)].sort(), [...on].sort(), 'the step names every account the scan read as on')
  const line = populationLine(pop)
  assert.doesNotMatch(line, /active (person|people)/, `emergency and dormant accounts are called active people: ${line}`)
  assert.equal(pop.admins, [...on].filter((id) => admins.has(id)).length, 'the admins are counted over the accounts it names')
  assert.ok(pop.admins > 0, 'and there are some')
  assert.match(line, new RegExp(`^5 accounts · ${pop.admins} admins?`), line)
})

// And the one figure that is deliberately a different population says so.
test('the guest directory tile says it counts every guest account', () => {
  const f = structuredClone(fixture('large'))
  const run = runFixture(f)
  const step = run.steps.find((s) => s.id === 's-goal-guests-mfa')
  assert.ok(step, 'the premise: large plans the guests step')
  const ctx = { snapshot: f.snapshot, mapping: f.mapping, groups: f.groups, nameOf: (id: string) => id, signature: 'IT', operatorId: f.operatorId, now: f.snapshot.asOf, reportOnlyAt: null } as unknown as StepVarContext
  const inventory = stepContract(step, ctx).inventory
  assert.ok(inventory, 'the premise: the guests step carries the directory tile')
  assert.equal(inventory.count, f.snapshot.users.filter((u) => u.userType === 'guest').length)
  assert.match(inventory.note, /whether or not it has been seen signing in/)
})

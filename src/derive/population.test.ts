// Prompt 51 §8.1 / 2.1: one population object per step, read by the row, the
// step body and its More. Two figures for one quantity is a failing test.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { allFixtures, fixture } from '../roadmap/fixtures/index.ts'
import { runFixture } from '../roadmap/fixtures/run.ts'
import { activePeopleIds, campaignIdsFor, reached, stepPopulation } from './population.ts'
import { whoLine, populationLine, affectedIds } from './whoLine.ts'
import { readinessView } from './mfaReadiness.ts'
import { rowWho } from '../ui/surfaces/rowWho.ts'
import { stepVars } from '../ui/surfaces/stepVars.ts'
import type { StepVarContext } from '../ui/surfaces/stepVars.ts'
import { fillText } from '../content/render.ts'
import { whoBlocks } from '../ui/surfaces/whoBlocks.ts'
import { contentStepFor } from '../content/stepTitle.ts'
import type { Fixture } from '../roadmap/fixtures/index.ts'
import type { Step } from '../roadmap/types.ts'

test('the row and the step body read the same population, for every step on every fixture', () => {
  for (const f of allFixtures()) {
    for (const s of runFixture(f).steps) {
      // One source for both: the people the step is about (reached) — its own
      // policy's scope for an open policy, the goal's population otherwise.
      const of = reached(s)
      const pop = stepPopulation(s)
      if (of === null) {
        assert.equal(pop, null, `${f.name} ${s.id}: an unsettled scope claims no count`)
        continue
      }
      assert.ok(pop !== null)
      assert.equal(pop.active, affectedIds(of).length, `${f.name} ${s.id}: active count`)
      assert.ok(pop.enabledCovered >= pop.active, `${f.name} ${s.id}: enabledCovered is at least active`)
      const who = whoLine(of)
      const m = who.match(/^(\d+) (?:person|people)/)
      if (m) assert.equal(Number(m[1]), pop.active, `${f.name} ${s.id}: the row who-line count is the population's active count`)
      const line = populationLine(of)
      const lm = line.match(/^(\d+) active (?:person|people)/)
      if (lm) assert.equal(Number(lm[1]), pop.active, `${f.name} ${s.id}: the step body population line is the same active count`)
    }
  }
})

// One population per step (derive/population.ts): the row's who-line, the lead's
// counts ({n}, {active}, {people}, {admins}, {guests}) and Today's active tile
// all read it; the campaign's population is the plan's active people minus the
// emergency and shared-device accounts.
test('on the demo and GetIAMAI, every row count equals its step lead count, and Today and the campaign read the same people', () => {
  for (const name of ['demo', 'getiamai'] as const) {
    const f = fixture(name)
    const r = runFixture(f)
    const nameOf = (id: string): string => r.input.names!.label(id)
    const ctx: StepVarContext = { snapshot: f.snapshot, mapping: f.mapping, nameOf, signature: 'IT', operatorId: f.operatorId, now: f.snapshot.asOf, groups: f.groups }
    for (const s of r.steps) {
      const ex = stepVars(s, ctx) as Record<string, unknown>
      const view = stepPopulation(s)
      const of = reached(s)
      if (view === null || of === null) {
        assert.equal(ex.n, undefined, `${name} ${s.id}: an unsettled scope names no count`)
        continue
      }
      const row = whoLine(of)
      const m = row.match(/^(\d+) (?:person|people)/)
      assert.ok(m !== null || row === 'No user impact', `${name} ${s.id}: the row counts people and never names them (${row})`)
      const rowCount = m ? Number(m[1]) : 0
      assert.equal(rowCount, view.active, `${name} ${s.id}: the row's count is the population's (${row})`)
      assert.equal(ex.n, s.kind === 'check' ? s.population.total : view.active, `${name} ${s.id}: the lead's {n} uses reviewed accounts for check steps`)
      const reviewCount = rowWho(s).match(/^(\d+) accounts?$/)
      if (reviewCount) assert.equal(Number(reviewCount[1]), s.population.total, `${s.id}: actual row Impact counts the same reviewed accounts`)
      assert.equal(ex.active, view.active, `${name} ${s.id}: the lead's {active}`)
      assert.equal(ex.people, view.active, `${name} ${s.id}: the lead's {people}`)
      assert.equal(ex.admins, view.admins, `${name} ${s.id}: the lead's {admins}`)
      assert.equal(ex.guests, view.guests, `${name} ${s.id}: the lead's {guests}`)
    }
    const svc = new Set(f.mapping.serviceAccountUserIds)
    assert.equal(readinessView(f.snapshot, f.snapshot.asOf, f.mapping).facts.active, campaignIdsFor(f.snapshot, f.snapshot.asOf, f.mapping).length, `${name}: Today's active people are the campaign's population`)
    assert.ok(activePeopleIds(f.snapshot, f.snapshot.asOf, svc).length >= campaignIdsFor(f.snapshot, f.snapshot.asOf, f.mapping).length, `${name}: the plan's active people include the campaign's`)
    const campaign = r.steps.find((s) => s.kind === 'verify')
    if (campaign) assert.deepEqual([...affectedIds(campaign.population)].sort(), campaignIdsFor(f.snapshot, f.snapshot.asOf, f.mapping).sort(), `${name}: the campaign's population`)
  }
  // {guests} pluralises like {n}.
  assert.equal(fillText('{guests} guests', { guests: 1 }), '1 guest')
  assert.equal(fillText('{n} people', { n: 1 }), '1 person')
})

// V1 audit S4-21. The dormant step is the one place never-signed-in accounts are
// a population: generate.ts sets activeIds to the accounts it names, "though
// none are active". A second pass over the same step then overwrote the whole
// population object with `population(ids, index)`, whose activeIds are the ids
// inside the active index — empty for dormant accounts by definition. The row
// and the Affected-people tile read "No user impact", satisfied, over a step
// whose own body named 731 accounts to disable, on all eight fixtures.
test('the dormant step\'s impact is the accounts it names, not "No user impact"', () => {
  for (const f of allFixtures()) {
    const s = runFixture(f).steps.find((x) => x.id === 's-check-dormant-accounts')
    if (!s) continue
    const view = stepPopulation(s)
    assert.ok(view, `${f.name}: the dormant step has a settled scope`)
    assert.equal(view.active, s.population.total, `${f.name}: every account it names is its reach`)
    const row = whoLine(reached(s)!)
    if (s.population.total === 0) continue
    assert.notEqual(row, 'No user impact', `${f.name}: ${s.population.total} accounts to disable is not "No user impact"`)
    assert.match(row, new RegExp(`^${s.population.total} (?:person|people)`), `${f.name}: the row counts them (${row})`)
  }
})

// R4-52. On the large tenant Prepare Your Team for MFA read "4,169 active people
// · 51 admins · 197 guests" on its Affected people tile and "3,981 people and 197
// guests" (4,178) in its lead and on its row. The nine between them are role
// holders with no sign-in in 90 days: the campaign prepares every admin, active
// or not, and waited on six of them, and no line on the step named any of them.
// Where sign-in activity was not read the tile read "No user impact" over a
// campaign waiting on 48 admins. One population, counted once, and every admin
// it waits on named in the words of what the scan read of them: a named line
// that called every such admin dormant would say it of accounts whose activity
// IAMAI never read.
function campaignOf(f: Fixture): { step: Step; ex: Record<string, unknown>; nameOf: (id: string) => string } {
  const r = runFixture(f)
  const step = r.steps.find((x) => x.id === 's-verify-mfa')
  assert.ok(step && step.preparation, `${f.name}: the premise: the campaign is planned`)
  const nameOf = (id: string): string => r.input.names!.label(id)
  const ctx: StepVarContext = { snapshot: f.snapshot, mapping: f.mapping, nameOf, signature: 'IT', operatorId: f.operatorId, now: f.snapshot.asOf, groups: f.groups }
  return { step, ex: stepVars(step, ctx) as Record<string, unknown>, nameOf }
}
const counted = (words: string): number => [...words.matchAll(/([\d,]+) (?:people|person|guests?|accounts?|active (?:people|person))/g)].reduce((n, m) => n + Number(m[1].replace(/,/g, '')), 0)

test('the campaign counts one population on its tile, its lead and its row', () => {
  for (const f of allFixtures()) {
    const s = runFixture(f).steps.find((x) => x.id === 's-verify-mfa')
    if (!s?.preparation || s.preparation.ids.length === 0) continue
    const { ex } = campaignOf(f)
    const tile = populationLine(reached(s)!)
    const head = counted(tile.split(' · ')[0])
    assert.equal(head, s.preparation.ids.length, `${f.name}: the tile counts every account the campaign prepares (${tile})`)
    assert.equal(counted(rowWho(s)), head, `${f.name}: the row and the tile (${rowWho(s)} / ${tile})`)
    assert.equal(counted(String(ex.cohort)), head, `${f.name}: the lead and the tile (${String(ex.cohort)} / ${tile})`)
    // "active people" only where every one of them is.
    if (/active (?:people|person)/.test(tile)) assert.equal(s.population.active, head, `${f.name}: ${tile}`)
  }
})

test('the campaign names every admin it waits on outside its active people, by what the scan read of them', () => {
  const base = campaignOf(fixture('mid'))
  const active = new Set(runFixture(fixture('mid')).input.viability.filter((v) => v.activity === 'active').map((v) => v.userId))
  const roles = fixture('mid').snapshot.roles
  const admins = new Set([...Object.keys(roles.active), ...Object.keys(roles.eligible ?? {})])
  const [dormantId, unreadId] = base.step.preparation!.missingIds.filter((id) => admins.has(id) && active.has(id))
  assert.ok(dormantId && unreadId, 'the premise: mid has two active admins not yet ready')

  // One stops signing in (read: 200 days ago); the scan cannot read the other's activity at all.
  const f = structuredClone(fixture('mid'))
  const longAgo = new Date(Date.parse(f.snapshot.asOf) - 200 * 86_400_000).toISOString()
  for (const u of f.snapshot.users) {
    if (u.id === dormantId) u.lastSuccessfulSignIn = longAgo
    if (u.id === unreadId) { u.lastSuccessfulSignIn = null; u.successfulSignInActivityRead = false }
  }
  for (const id of [dormantId, unreadId]) if (f.snapshot.signInEvidence[id]) f.snapshot.signInEvidence[id] = { ...f.snapshot.signInEvidence[id], platforms: [] }
  const { step, ex, nameOf } = campaignOf(f)
  const prep = step.preparation!
  assert.ok(prep.ids.includes(dormantId) && prep.ids.includes(unreadId), 'the campaign still prepares both: it prepares every admin')
  assert.ok(prep.missingIds.includes(dormantId) && prep.missingIds.includes(unreadId), 'and waits on both')
  assert.ok(!(ex.adminsNotReady as string[]).includes(nameOf(dormantId)) && !(ex.adminsNotReady as string[]).includes(nameOf(unreadId)), 'the premise: the admins note names active admins only')

  // What the step draws: its Who lines.
  const who = (contentStepFor(step) as unknown as { who: Record<string, unknown> }).who
  const { inline, held } = whoBlocks(who, ex)
  const blocks = [...inline, ...held]
  const lineNaming = (id: string) => blocks.filter((b) => b.names.includes(nameOf(id)))
  const dormantLines = lineNaming(dormantId)
  assert.equal(dormantLines.length, 1, `${nameOf(dormantId)} is named once on the step: ${JSON.stringify(blocks.map((b) => b.lead))}`)
  assert.equal(dormantLines[0].lead, '1 admin with no sign-in in the last 90 days is not yet ready; this step prepares every admin, so it waits on them too:')
  const unreadLines = lineNaming(unreadId)
  assert.equal(unreadLines.length, 1, `${nameOf(unreadId)} is named once on the step`)
  assert.equal(unreadLines[0].lead, '1 admin is not yet ready, and the scan could not read their sign-in activity; this step prepares every admin, so it waits on them too:')
  assert.doesNotMatch(unreadLines[0].lead, /no sign-in|90 days/, 'an account whose activity was not read is never called dormant')
  // And both are in the one count the tile, the lead and the row give.
  assert.equal(counted(populationLine(reached(step)!).split(' · ')[0]), prep.ids.length)
  assert.equal(counted(String(ex.cohort)), prep.ids.length)
})

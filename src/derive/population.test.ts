// Prompt 51 §8.1 / 2.1: one population object per step, read by the row, the
// step body and its More. Two figures for one quantity is a failing test.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { allFixtures, fixture } from '../roadmap/fixtures/index.ts'
import { runFixture, withFoundationSettled } from '../roadmap/fixtures/run.ts'
import { activePeopleIds, campaignIdsFor, isActivePerson, namedAccounts, populationIndex, reached, stepPopulation } from './population.ts'
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
import { validOperations } from '../roadmap/operations.ts'
import { CONTRACT, stepContract } from '../ui/surfaces/stepContract.ts'
import { stepBodyOf } from '../ui/surfaces/stepBody.ts'
import { stepExportView } from '../ui/surfaces/stepExport.ts'
import { cardWordsOf, policyBarOf, policySubjectsOf, taskSubjectOf } from '../ui/surfaces/policyTasks.ts'
import { statusOf } from '../ui/surfaces/statusWord.ts'

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
      // Counts carry separators ("4,169 active people"): read them with the
      // separator, or the large tenant's lines are never compared at all.
      const who = whoLine(of)
      const m = who.match(/^([\d,]+) (?:person|people)/)
      if (m) assert.equal(Number(m[1].replace(/,/g, '')), pop.active, `${f.name} ${s.id}: the row who-line count is the population's count`)
      const line = populationLine(of)
      const lm = line.match(/^([\d,]+) (?:active (?:person|people)|accounts?)/)
      if (lm) assert.equal(Number(lm[1].replace(/,/g, '')), pop.active, `${f.name} ${s.id}: the step body population line is the same count`)
    }
  }
})

// One population per step (derive/population.ts): the row's who-line, the lead's
// counts ({n}, {active}, {people}, {admins}, {guests}) and Today's active tile
// all read it. The campaign's active people are Today's (the plan's active
// people, the emergency and service accounts left out); its population is every
// account it prepares, which since R4-52 includes the role holders who are not
// active (namedAccounts). This test said the population was the active people,
// which held only on tenants where every admin is active.
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
      // Prepare Emergency Access Accounts counts its emergency accounts instead: the ones chosen, at least the two it needs.
      if (reviewCount) assert.equal(Number(reviewCount[1]), s.id === 's-prereq-break-glass' ? Math.max(2, s.emergency?.accounts.length ?? 0) : s.population.total, `${s.id}: actual row Impact counts the same reviewed accounts`)
      assert.equal(ex.active, view.active, `${name} ${s.id}: the lead's {active}`)
      assert.equal(ex.people, view.active, `${name} ${s.id}: the lead's {people}`)
      assert.equal(ex.admins, view.admins, `${name} ${s.id}: the lead's {admins}`)
      assert.equal(ex.guests, view.guests, `${name} ${s.id}: the lead's {guests}`)
    }
    const svc = new Set(f.mapping.serviceAccountUserIds)
    assert.equal(readinessView(f.snapshot, f.snapshot.asOf, f.mapping).facts.active, campaignIdsFor(f.snapshot, f.snapshot.asOf, f.mapping).length, `${name}: Today's active people are the campaign's active people`)
    assert.ok(activePeopleIds(f.snapshot, f.snapshot.asOf, svc).length >= campaignIdsFor(f.snapshot, f.snapshot.asOf, f.mapping).length, `${name}: the plan's active people include the campaign's`)
  }
  for (const name of ['demo', 'getiamai', 'large'] as const) {
    const f = fixture(name)
    const r = runFixture(f)
    const campaign = r.steps.find((s) => s.kind === 'verify')
    assert.ok(campaign?.preparation, `${name}: the premise: the campaign is planned`)
    const ids = affectedIds(campaign.population)
    assert.deepEqual([...ids].sort(), [...campaign.preparation.ids].sort(), `${name}: the campaign's population is every account it prepares`)
    const active = new Set(r.input.viability.filter(isActivePerson).map((v) => v.userId))
    assert.deepEqual(ids.filter((id) => active.has(id)).sort(), campaignIdsFor(f.snapshot, f.snapshot.asOf, f.mapping).sort(), `${name}: and its active people are the plan's`)
    assert.equal(campaign.population.active, campaignIdsFor(f.snapshot, f.snapshot.asOf, f.mapping).length, `${name}: its active count is theirs`)
    if (name === 'large') assert.ok(ids.length > campaign.population.active, 'the premise: large prepares admins who are not active, so the two differ')
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

// R4-30. On the mid tenant the plan's own Block Authentication Transfer policy
// read "covers 283 enabled" while it was planned and in report-only, and
// "covers 279 enabled" the scan after it was enforced, the policy unchanged: a
// done step read the goal's population minus the plan's exclusions instead of
// the policy's own scope. Beside it "Who it misses" said "This goal is written
// for 285 people in this tenant; 6 of them are excluded from the policy that
// delivers it, so it reaches 279" of a policy that excludes the two emergency
// accounts: the six were the plan's exclusions (the emergency accounts, three
// service accounts and an account that is not a person), which the policy
// reaches. An administrator would go looking for four exclusions that are not there.
test('turning a policy on does not move its reach, and "Who it misses" counts only whom the policy misses', () => {
  const STEP = 's-goal-block-auth-transfer'
  const base = withFoundationSettled(fixture('mid'))
  const planned = runFixture(base).steps.find((s) => s.id === STEP)
  assert.ok(planned, 'the premise: mid plans the step')
  const ops = validOperations(planned.action)
  assert.ok(ops.length > 0, 'the premise: the step has a policy to build')
  const at = new Date(Date.parse(base.snapshot.asOf) - 30 * 86_400_000).toISOString()
  const scanWith = (state: string) => {
    const f = structuredClone(base)
    ops.forEach((op, i) => f.snapshot.config.caPolicies.rows.push({ ...structuredClone(op.body as Record<string, unknown>), id: `r430-${i}`, state, createdDateTime: at, modifiedDateTime: at } as never))
    const r = runFixture(f)
    const step = r.steps.find((s) => s.id === STEP)!
    const ctx: StepVarContext = { snapshot: f.snapshot, mapping: f.mapping, nameOf: (id) => r.input.names!.label(id), signature: 'IT', operatorId: f.operatorId, now: f.snapshot.asOf, groups: f.groups }
    return { step, tile: populationLine(reached(step)!), found: stepContract(step, ctx).found }
  }
  const reportOnly = scanWith('enabledForReportingButNotEnforced')
  const enforced = scanWith('enabled')
  assert.equal(reportOnly.step.status, 'in-report-only', 'the premise: the policy is watched in report-only')
  assert.equal(enforced.step.state.satisfied, true, 'the premise: enforced, the goal is delivered')
  const tilePlanned = populationLine(reached(planned)!)
  assert.match(tilePlanned, /covers 283 enabled/, `the premise: the policy names 283 accounts (${tilePlanned})`)
  assert.equal(reportOnly.tile, tilePlanned, 'report-only: the same reach')
  assert.equal(enforced.tile, tilePlanned, 'enforced: the same reach, the policy unchanged')
  // The policy excludes the emergency accounts and nobody else, so there is no
  // line: the emergency accounts are excluded from every policy by design.
  assert.equal(enforced.found.some((x) => x.key === 'shortfall'), false, `a shortfall the policy does not have: ${JSON.stringify(enforced.found.map((x) => x.text))}`)

  // And a delivering policy that does miss somebody else says whom, counted from
  // its own scope: the exclusions group it excludes holds three people besides
  // the emergency accounts.
  const f = structuredClone(base)
  const three = reached(planned)!.activeIds!.slice(0, 3)
  const group = [...f.groups.values()].find((g) => g.displayName === 'Core - Exclusions')
  assert.ok(group, 'the premise: mid has an exclusions group')
  group.memberIds = [...group.memberIds, ...three]
  group.directMemberIds = [...(group.directMemberIds ?? []), ...three]
  group.memberCount = group.memberIds.length
  ops.forEach((op, i) => f.snapshot.config.caPolicies.rows.push({ ...structuredClone(op.body as Record<string, unknown>), id: `r430-${i}`, state: 'enabled', createdDateTime: at, modifiedDateTime: at } as never))
  const r = runFixture(f)
  const step = r.steps.find((s) => s.id === STEP)!
  assert.equal(step.state.satisfied, true, 'the premise: still delivered')
  const ctx: StepVarContext = { snapshot: f.snapshot, mapping: f.mapping, nameOf: (id) => r.input.names!.label(id), signature: 'IT', operatorId: f.operatorId, now: f.snapshot.asOf, groups: f.groups }
  const line = stepContract(step, ctx).found.find((x) => x.key === 'shortfall')?.text ?? ''
  assert.match(line, /; 5 of them are excluded from the policy that delivers it, so it reaches 280\.$/, `the two emergency accounts and the three it excludes (${line})`)
  assert.match(populationLine(reached(step)!), /covers 280 enabled/, 'and the tile reads the same reach')
})

// A tenant policy on mid that delivers its goal, excluding one more group: one
// the scan read only a sample of (over the member cap), or one it read in full.
// Read in full the group holds the emergency accounts and nobody else, so the
// policy's reach is exactly what it was without it.
// `prepare` changes the tenant first, handed the groups the policy already excludes.
function deliveredWithGroup(policyName: string, stepId: string, sampled: boolean, prepare: (f: Fixture, excluded: readonly string[]) => void = () => {}) {
  const GROUP = '7e5b6c1a-0000-4000-8000-00000000c0de'
  const f = structuredClone(withFoundationSettled(fixture('mid')))
  const policy = f.snapshot.config.caPolicies.rows.find((p) => (p as { displayName?: string }).displayName === policyName) as { conditions: { users: { excludeGroups?: string[] } } } | undefined
  assert.ok(policy, `the premise: mid has "${policyName}"`)
  prepare(f, [...(policy.conditions.users.excludeGroups ?? [])])
  policy.conditions.users.excludeGroups = [...(policy.conditions.users.excludeGroups ?? []), GROUP]
  const members = [...f.mapping.breakGlassUserIds]
  f.groups.set(GROUP, { memberIds: members, directMemberIds: members, memberCount: sampled ? 30_000 : members.length, sampled, displayName: 'Contractors' } as never)
  const r = runFixture(f)
  const step = r.steps.find((s) => s.id === stepId)!
  const ctx: StepVarContext = { snapshot: f.snapshot, mapping: f.mapping, nameOf: (id) => r.input.names!.label(id), signature: 'IT', operatorId: f.operatorId, now: f.snapshot.asOf, groups: f.groups }
  const body = stepBodyOf(step, ctx)
  const tiles = [...body.readiness.tiles, ...body.readiness.satisfied]
  // The Tasks Remaining cards and the bar under them, as ContentStep.tsx draws them.
  const cards = policySubjectsOf(body.contract, body.readiness, body.emergencyAccountTasks, taskSubjectOf(step, body.eyebrow, body.title), cardWordsOf(step)?.check ?? null)
  return { f, step, ctx, body, tiles, people: tiles.find((t) => t.key === 'people'), found: body.contract.found, row: rowWho(step), exported: stepExportView(step, ctx).population, vars: stepVars(step, ctx), cards, bar: policyBarOf(cards) }
}

// R4-30's residual (population Q1). On mid the tenant's own "Core - Grant - MFA
// for all users" delivers the goal, and it also excludes a group the scan could
// not read in full (over the member cap, so only a sample of its members came
// back). The step read Completed, and its Affected people card read "246 active
// people · 13 admins · 12 guests · covers 279 enabled": the goal's population
// minus the plan's exclusions, a figure IAMAI never measured for this policy,
// beside a readiness line saying IAMAI cannot measure it. The scan that read
// the group moved the card to the policy's real reach, "covers 283 enabled",
// with nothing changed. Unknown is conservative, with no population fallback
// (Foundation A): the card says the reach is not established and why, the way
// an open policy's does, and nothing on the step counts people it did not
// measure.
test('a delivered step whose delivering policy\'s scope cannot be settled says its reach is not established, and counts nobody', () => {
  const scan = (sampled: boolean) => deliveredWithGroup('Core - Grant - MFA for all users', 's-goal-mfa-all-users', sampled)

  const unread = scan(true)
  assert.equal(unread.step.status, 'done', 'the premise: the tenant\'s policy delivers the goal')
  assert.equal(unread.step.state.satisfied, true, 'the premise: delivered')
  assert.equal(unread.people?.value, CONTRACT.readiness.tiles.peopleUnknown, `the card claims a reach nobody measured: ${JSON.stringify(unread.people)}`)
  assert.equal(unread.people?.note, CONTRACT.whoUnknown, 'and says why, in the words an open policy\'s unsettled scope uses')
  for (const t of unread.tiles) assert.doesNotMatch(`${t.value} ${t.note ?? ''}`, /\d+ active (?:people|person)|covers \d+ enabled/, `${t.label} counts people beside a reach that is not established`)
  assert.equal(unread.found.some((x) => x.key === 'shortfall'), false, 'no "Who it misses" count from a scope nobody settled')
  assert.doesNotMatch(unread.row, /\d/, `the row's Impact counts people (${unread.row})`)
  assert.equal(unread.exported, null, 'the export writes no count either')

  // The scan that reads the group reads the policy's own reach, and only then.
  const read = scan(false)
  assert.equal(read.step.state.satisfied, true, 'the premise: still delivered')
  assert.match(read.people?.value ?? '', /covers 283 enabled/, `the policy's own reach once its scope is settled: ${JSON.stringify(read.people)}`)

  // Not established is not a task (stepContract.ts isReadinessWork): the bar
  // reads what it reads with the group read. It read "Complete the next task
  // shown for each item." over a card nobody can complete.
  assert.equal(read.bar, 'Every task on this step is complete, and it left something behind.', 'the premise: the bar with the group read')
  assert.equal(unread.bar, read.bar, 'the step is handed a task because its reach is not established')
})

// The card above is a statement of fact, not work. It is unresolved, so it
// stood among the Readiness tiles, and both readers of open work counted it:
// "Block Legacy Authentication", Completed, drew "Complete the next task shown
// for each item." under a Tasks Remaining that listed only "Affected people ·
// Not established" (policyTasks.ts policyBarOf, the bar this step draws), and
// its Implementation box turned from "No implementation needed" into "Waiting
// on Readiness / Clear what Readiness lists first." — a new instruction on a
// finished step, and one nobody can carry out. IAMAI never reads an over-cap
// group in full, and the only lever an administrator has is the policy's
// exclusion, which here holds the emergency accounts. What counts as work is
// one answer (stepContract.ts isReadinessWork), and both read it.
test('a delivered step whose reach is not established is not handed Readiness work to clear', () => {
  const unread = deliveredWithGroup('Core - Block - Legacy authentication', 's-goal-block-legacy-auth', true)
  assert.equal(unread.step.status, 'done', 'the premise: the tenant\'s policy delivers the goal')
  assert.equal(unread.step.state.satisfied, true, 'the premise: delivered')
  assert.equal(unread.people?.value, CONTRACT.readiness.tiles.peopleUnknown, `the premise: the reach is not established: ${JSON.stringify(unread.people)}`)
  assert.deepEqual(unread.body.readiness.tiles.map((t) => t.key), ['people'], 'the premise: the reach is the only thing Readiness lists')
  assert.equal(unread.bar, 'Every task on this step is complete.', `a Completed step is told to complete a task nobody can: ${JSON.stringify(unread.cards.filter((c) => !c.satisfied))}`)
  assert.equal(unread.body.empty.key, 'inPlace', `a Completed step is told to clear what nobody can clear: ${JSON.stringify(unread.body.empty)}`)
  assert.equal(unread.body.empty.title, CONTRACT.implementation.empty.inPlace[0])
  // The card itself stays, still saying what it says, where it said it.
  const card = unread.cards.find((c) => c.key === 'people')
  assert.equal(card?.satisfied, false, 'the card is not a task, and it is not done either')
  assert.equal(card?.title, CONTRACT.readiness.tiles.peopleUnknown)

  // The same step with the group read says the same: nothing to do, nothing to implement.
  const read = deliveredWithGroup('Core - Block - Legacy authentication', 's-goal-block-legacy-auth', false)
  assert.equal(read.step.status, 'done', 'the premise: still delivered')
  assert.equal(read.bar, 'Every task on this step is complete.')
  assert.equal(read.body.empty.key, 'inPlace')
})

// "Your account is in scope: 3 sign-ins since Jul 29, 2026." was the one reading
// on a delivered step still taken from the goal's people (stepVars.ts
// operatorInScope), not from the reach the step's cards read, so a policy that
// reached the account was said not to where the goal's people left it out.
// Under "IAMAI cannot establish exactly who this reaches" the line still shows
// unless something the scan read in full excludes the account. Where the reach
// is settled it answers. Where it is not, the delivering policies are asked about
// this one account (generate.ts deliveredReachesOperator), and an answer they
// cannot give counts as reaching it: the convention an open policy follows,
// because unknown is not safe. A group read in full that excludes the account
// still settles it.
test('a delivered step says whether the signed-in account is in scope from the delivering policies, never the goal\'s people', () => {
  const POLICY = 'Core - Block - Legacy authentication'
  const STEP = 's-goal-block-legacy-auth'
  const inScope = (vars: Record<string, unknown>): boolean => vars.operatorSignIns !== undefined || vars.operatorNoRecords !== undefined

  // Settled: the policy reaches an account the goal's people leave out (the
  // plan counts it a service account), and the step says it is in scope.
  const service = deliveredWithGroup(POLICY, STEP, false, (f) => { f.mapping.serviceAccountUserIds = [...f.mapping.serviceAccountUserIds, f.operatorId] })
  const op = service.f.operatorId
  assert.equal(service.step.status, 'done', 'the premise: the tenant\'s policy delivers the goal')
  assert.equal(service.step.population.ids.includes(op), false, 'the premise: the goal\'s people leave the account out')
  assert.equal(reached(service.step)?.ids.includes(op), true, 'the premise: the policy reaches it')
  assert.equal(service.step.deliveredReachesOperator, undefined, 'a settled reach answers for itself, and carries no second answer')
  assert.equal(inScope(service.vars), true, '"Your account is in scope" is not said of an account the policy reaches')

  // Settled: a reach that leaves the account out while the goal's people name it.
  const plain = deliveredWithGroup(POLICY, STEP, false)
  assert.equal(inScope(plain.vars), true, 'the premise: in scope on the tenant as it is')
  const reach = plain.step.deliveredReach
  assert.ok(reach, 'the premise: a settled delivered reach')
  const narrowed: Step = { ...plain.step, deliveredReach: { ...reach, ids: reach.ids.filter((id) => id !== plain.f.operatorId) } }
  assert.equal(narrowed.population.ids.includes(plain.f.operatorId), true, 'the premise: the goal\'s people name the account')
  assert.equal(inScope(stepVars(narrowed, plain.ctx)), false, '"Your account is in scope" read from the goal\'s people, not the policy\'s reach')

  // Not established, and nothing the scan read settles the account: it counts as reached.
  const unread = deliveredWithGroup(POLICY, STEP, true)
  assert.equal(reached(unread.step), null, 'the premise: the reach is not established')
  assert.equal(unread.step.deliveredReachesOperator, true, 'an account the policies cannot answer for counts as reached')
  assert.equal(inScope(unread.vars), true, '"Your account is in scope" is not said of an account nobody can say is out')

  // Not established, but the exclusions group, read in full, holds the account:
  // the policies settle it for this one account, and it is not in scope.
  const excluded = deliveredWithGroup(POLICY, STEP, true, (f, groups) => {
    const g = f.groups.get(groups[0]) as { memberIds: string[]; directMemberIds: string[]; memberCount: number } | undefined
    assert.ok(g, 'the premise: the policy excludes a group the scan read')
    g.memberIds = [...g.memberIds, f.operatorId]
    g.directMemberIds = [...g.directMemberIds, f.operatorId]
    g.memberCount += 1
  })
  assert.equal(excluded.step.status, 'done', 'the premise: still delivered')
  assert.equal(reached(excluded.step), null, 'the premise: the reach is not established')
  assert.equal(excluded.step.deliveredReachesOperator, false, 'an account a group read in full excludes is said to be reached')
  assert.equal(inScope(excluded.vars), false, '"Your account is in scope" for an account the policy excludes')
})

// The answer above is the operator line's, and only on a step still delivered
// when it is read. It was carried in includesOperator, which also decides the
// signed-in account's safety verdict, and a step this run reopens keeps the
// delivered reach the scan read. On small, mid and five more fixtures the
// guests step is found delivered by the tenant's MFA policies and then reopened
// as a policy to create, and it took their answer for the signed-in account, a
// member: in scope, with that account's sign-ins, and on small a stranding
// verdict (operatorSafe false) that turned its tone from wait to stop. Nothing
// the step creates reaches that account, and none of it was said before.
test('a step reopened after the scan found it delivered does not answer for the signed-in account from the policies that delivered it', () => {
  for (const name of ['small', 'mid'] as const) {
    const f = fixture(name)
    const r = runFixture(f)
    const guests = r.steps.find((s) => s.id === 's-goal-guests-mfa')
    assert.ok(guests, `${name}: the premise: the guests step is planned`)
    assert.notEqual(guests.deliveredReach, undefined, `${name}: the premise: the scan found it delivered`)
    assert.equal(guests.state.satisfied, false, `${name}: the premise: reopened`)
    assert.equal(guests.population.ids.includes(f.operatorId!), false, `${name}: the premise: the signed-in account is not one of its guests`)
    assert.equal(guests.includesOperator, false, `${name}: the delivering policies answered for a step they no longer deliver`)
    assert.equal(guests.deliveredReachesOperator, undefined, `${name}: no second answer where the delivered reach was settled`)
    const ctx: StepVarContext = { snapshot: f.snapshot, mapping: f.mapping, nameOf: (id) => r.input.names!.label(id), signature: 'IT', operatorId: f.operatorId, now: f.snapshot.asOf, groups: f.groups }
    const vars = stepVars(guests, ctx)
    assert.equal(vars.operatorSignIns, undefined, `${name}: "Your account is in scope" on the guests step`)
    assert.equal(vars.operatorNoRecords, undefined, `${name}: the no-records line on the guests step`)
    if (name === 'small') {
      assert.equal(guests.operatorSafe, null, 'small: a stranding verdict from policies the step does not create')
      assert.equal(statusOf(guests).tone, 'wait', 'small: the tone a stranding verdict gives')
    }
  }
})

// One number format (copy/statements.ts figure). The thousands separator was
// added at two call sites instead of where numbers are printed: on huge the
// dormant step's row read "3671 accounts" beside a tile of "3,671 accounts · 46
// admins · 169 guests", and on large the campaign's Who lines read "3032 people
// with no phishing-resistant method" under a lead of "3,981 people and 197
// guests". fillText prints every whole number it fills as count() does, and the
// row goes through count().
test('a number prints one way on the row, the tile and every filled line', () => {
  assert.equal(fillText('{n} people', { n: 3032 }), '3,032 people')
  assert.equal(fillText('{n} people', { n: 1 }), '1 person', 'a count of one still reads as one')
  const f = fixture('large')
  const r = runFixture(f)
  // The dormant step at the size huge reaches (HUGE=1 runs huge itself).
  const dormant = r.steps.find((s) => s.id === 's-check-dormant-accounts')
  assert.ok(dormant, 'the premise: large plans the dormant step')
  const big: Step = { ...dormant, population: namedAccounts(f.snapshot.users.slice(0, 3671).map((u) => u.id), populationIndex(f.snapshot, r.input.viability)) }
  assert.equal(rowWho(big), '3,671 accounts')
  assert.match(populationLine(reached(big)!), /^3,671 accounts( · |$)/)
  // The campaign's Who lines on large.
  const { step, ex } = campaignOf(f)
  const { inline, held } = whoBlocks((contentStepFor(step) as unknown as { who: Record<string, unknown> }).who, ex)
  const leads = [...inline, ...held].map((b) => b.lead)
  assert.ok(leads.some((l) => l.startsWith('3,032 people with no phishing-resistant method')), JSON.stringify(leads))
  for (const l of leads) assert.doesNotMatch(l, /(?<![\w@.,])\d{4,}(?= )/, `a count without its separator: ${l}`)
})

// The same format, past two callers that stringified their counts before
// fillText saw them. On large the method readiness line read "3569 of 4900
// people in scope of these policies have a registered method" (and "3435 of
// 4675", "1293") beside tiles reading "4,900"; the "Who it misses" line did the
// same with every figure it prints. They pass numbers now.
test('the readiness and "Who it misses" lines carry separators', () => {
  const f = fixture('large')
  const r = runFixture(f)
  const ctx: StepVarContext = { snapshot: f.snapshot, mapping: f.mapping, nameOf: (id) => r.input.names!.label(id), signature: 'IT', operatorId: f.operatorId, now: f.snapshot.asOf, groups: f.groups }
  const raw = /(?<![\w@.,])\d{4,}(?= )/
  const mfa = r.steps.find((s) => s.id === 's-goal-mfa-all-users')
  assert.ok(mfa, 'the premise: large plans the MFA policy')
  assert.ok(mfa.readiness.lines.some((l) => /^3,569 of 4,900 people this step's policies include/.test(l)), JSON.stringify(mfa.readiness.lines))
  for (const s of r.steps) {
    for (const l of s.readiness.lines) assert.doesNotMatch(l, raw, `${s.id}: ${l}`)
    for (const x of stepContract(s, ctx).found) assert.doesNotMatch(x.text, raw, `${s.id}: ${x.text}`)
  }
  const missing = { ...mfa, state: { ...mfa.state, satisfied: true }, coverageShortfall: { detail: '', people: 1200, reached: 3700, active: 4900 } }
  const line = stepContract(missing, ctx).found.find((x) => x.key === 'shortfall')?.text ?? ''
  assert.match(line, /4,900 people/, line)
  assert.match(line, /1,200 of them/, line)
  assert.match(line, /reaches 3,700/, line)
})

// The floor (target-state §13, decided 2026-09-01; prompt 53 queue item 3): a
// "Microsoft recommended, not in this baseline" set — registration protection,
// the legacy-authentication block, emergency access — rendered when the active
// baseline lacks them, flagged as not the author's, from Microsoft's own template
// through the same translator as a baseline policy.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { allFixtures, fixture } from './fixtures/index.ts'
import { runFixture } from './fixtures/run.ts'
import { readFileSync } from 'node:fs'
import { PINNED_GOAL_MAP } from './goalMap.ts'
import type { GoalMap } from './goalMap.ts'
import { BREAK_GLASS_STEP_ID, stepIdForGoal } from './stepIds.ts'
import { FLOOR_GOAL_IDS, isFloorGoal } from './floor.ts'
import { app, phases } from '../content/content.ts'
import { floorRows, phaseRows, undatedRows } from '../ui/surfaces/planRows.ts'
import { groupsFor } from '../ui/surfaces/planBoard.ts'
import { stepPortalLines, portalNamesFor } from '../ui/surfaces/stepPortal.ts'

test('the pinned baseline lacks registration protection, so the floor renders it, flagged, from the template', () => {
  const r = runFixture(fixture('demo-week2'))
  const reg = r.steps.find((s) => s.goalId === 'register-info-protected')
  assert.ok(reg, 'registration protection renders through the floor')
  assert.equal(reg.floor, true, 'flagged as not the author\'s')
  assert.equal(reg.kind, 'create')
  assert.ok(reg.action.json, 'the body is Microsoft\'s template, resolved for this tenant')
  const body = JSON.parse(reg.action.json) as { conditions: { applications: { includeUserActions?: string[] } } }
  assert.deepEqual(body.conditions.applications.includeUserActions, ['urn:user:registersecurityinfo'])
  // The legacy block is held by the pinned baseline: it renders as the author's, not the floor.
  const legacy = r.steps.find((s) => s.goalId === 'block-legacy-auth')
  assert.ok(legacy)
  assert.ok(!legacy.floor, 'a goal the baseline holds is never the floor')
  // With the accounts confirmed, emergency access is the Cleanup drill row.
  assert.ok(r.schedule.cleanup?.rows.some((row) => row.kind === 'drill'), 'the break-glass drill is a Cleanup row')
})

test('the floor set is exactly the two policy goals; nothing else absent renders', () => {
  assert.deepEqual([...FLOOR_GOAL_IDS], ['register-info-protected', 'block-legacy-auth'])
  assert.ok(isFloorGoal('register-info-protected') && isFloorGoal('block-legacy-auth'))
  assert.ok(!isFloorGoal('mobile-app-protection') && !isFloorGoal('azure-management-mfa'))
  const r = runFixture(fixture('demo'))
  for (const s of r.steps) if (s.floor) assert.ok(isFloorGoal(s.goalId), `${s.id} is flagged floor but is not a floor goal`)
})

test('a baseline that holds the goal renders it as the author\'s, not the floor', () => {
  const held = { ...PINNED_GOAL_MAP, 'register-info-protected': ['(a baseline that holds it)'] }
  const r = runFixture(fixture('demo'), { goalMap: held })
  const reg = r.steps.find((s) => s.goalId === 'register-info-protected')
  assert.ok(reg)
  assert.ok(!reg.floor)
})

test('the floor step\'s What to do is the template through the translator: the user action, the exclusions group, never an account by name', () => {
  // Week two: the exclusions group exists, so the template resolves and the step
  // offers its instructions (stepJson.ts implementationOffered).
  const f = fixture('demo-week2')
  const r = runFixture(f)
  const reg = r.steps.find((s) => s.goalId === 'register-info-protected')!
  const names = (id: string): string => r.input.names!.label(id)
  // The floor step's own resolved template, read off the step like any policy step.
  const lines = stepPortalLines(reg, { nameOf: names, policyName: reg.naming?.proposed ?? reg.title })
  assert.ok(lines && lines.length > 3, 'portal lines render')
  const text = lines!.join('\n')
  assert.match(text, /Register security information|security info/i, 'the user action is named')
  assert.match(text, /Exclude → Groups: Core - Exclusions/, 'the exclusion is the group')
  for (const id of f.mapping.breakGlassUserIds) assert.ok(!text.includes(names(id)), 'never an emergency account by name')
  assert.doesNotMatch(text, /\{[a-zA-Z]+\}|__IAMAI|urn:user:/, 'no raw placeholder or URN')
  assert.match(text, /Report-only/, 'ends in report-only')
})

// ---- Task 025: the floor set, proved against a supplied active baseline ----
//
// Everything below decides floor eligibility from a goal map handed to the run,
// never from the pin and never from what the tenant happens to have. The active
// baseline is what carries a goal or does not; the tenant's own state is a
// separate fact, and one test here keeps the two apart.

/** A goal map with the named goals removed: an active baseline that does not carry them. */
const without = (...goalIds: string[]): GoalMap => {
  const m: GoalMap = { ...PINNED_GOAL_MAP }
  for (const id of goalIds) delete m[id]
  return m
}

test('an active baseline that carries neither floor goal renders both, flagged, from Microsoft\'s own templates', () => {
  const r = runFixture(fixture('getiamai'), { goalMap: without(...FLOOR_GOAL_IDS) })
  const reg = r.steps.find((s) => s.goalId === 'register-info-protected')
  const legacy = r.steps.find((s) => s.goalId === 'block-legacy-auth')
  assert.ok(reg && legacy, 'both floor goals render')
  assert.equal(reg.floor, true)
  assert.equal(legacy.floor, true)
  // Registration protection is the security-information registration user action, not something near it.
  const regBody = JSON.parse(reg.action.json!) as { conditions: { applications: { includeUserActions?: string[] } } }
  assert.deepEqual(regBody.conditions.applications.includeUserActions, ['urn:user:registersecurityinfo'])
  // The legacy block is the legacy block: the two legacy client-app types, blocked.
  const legacyBody = JSON.parse(legacy.action.json!) as { conditions: { clientAppTypes?: string[] }; grantControls: { builtInControls?: string[] } }
  assert.deepEqual([...(legacyBody.conditions.clientAppTypes ?? [])].sort(), ['exchangeActiveSync', 'other'])
  assert.deepEqual(legacyBody.grantControls.builtInControls, ['block'])
  // And nothing else the baseline lacks came with them.
  for (const s of r.steps) if (s.floor) assert.ok(s.goalId !== undefined && isFloorGoal(s.goalId), `${s.id} is flagged floor but is not a floor goal`)
})

test('an active baseline that carries both floor goals renders no floor row at all', () => {
  const holds: GoalMap = { ...PINNED_GOAL_MAP, 'register-info-protected': ['(a baseline that holds it)'], 'block-legacy-auth': ['(a baseline that holds it)'] }
  const r = runFixture(fixture('demo'), { goalMap: holds })
  assert.deepEqual(r.steps.filter((s) => s.floor).map((s) => s.id), [], 'a goal the baseline carries is the author\'s')
  // Emergency access is untouched by any of this: it is the Preparation step, on every plan.
  assert.equal(r.steps.filter((s) => s.id === BREAK_GLASS_STEP_ID).length, 1)
})

test('a goal the active baseline lacks and the floor does not name stays absent: no signature match revives it', () => {
  const map = without(...FLOOR_GOAL_IDS)
  const r = runFixture(fixture('getiamai'), { goalMap: map })
  const rendered = new Set(r.steps.map((s) => s.goalId).filter((g): g is string => g !== undefined))
  const absentAndNotFloor = r.coverage.results.map((c) => c.goal.id).filter((id) => (map[id] ?? []).length === 0 && !isFloorGoal(id))
  assert.ok(absentAndNotFloor.length > 0, 'the catalogue holds goals this baseline does not')
  for (const id of absentAndNotFloor) assert.ok(!rendered.has(id), `${id} is not in the active baseline and is not a floor goal, so it does not render`)
})

test('emergency access is the Preparation check, never a floor policy', () => {
  const r = runFixture(fixture('getiamai'), { goalMap: without(...FLOOR_GOAL_IDS) })
  const bg = r.steps.filter((s) => s.id === BREAK_GLASS_STEP_ID)
  assert.equal(bg.length, 1, 'one emergency-access path, not two')
  assert.equal(bg[0].kind, 'prerequisite')
  assert.ok(!bg[0].floor, 'the prerequisite is not a Microsoft-floor recommendation row')
  assert.equal(bg[0].action.json ?? null, null, 'no Conditional Access body was invented for it')
})

test('the floor flag is provenance, not permission: a floor step whose references cannot resolve stays held', () => {
  const r = runFixture(fixture('messy'), { goalMap: without(...FLOOR_GOAL_IDS) })
  const reg = r.steps.find((s) => s.goalId === 'register-info-protected')!
  assert.equal(reg.floor, true)
  assert.equal(reg.action.json ?? null, null, 'no body is offered while the objects it names are not settled')
  assert.ok(reg.status !== 'done' && reg.status !== 'ready', `held, not offered (status ${reg.status})`)
})

test('the active baseline lacking a goal and the tenant already delivering it are two facts', () => {
  // The demo tenant already blocks legacy authentication. Take the goal out of
  // the active baseline and the recommendation becomes the floor's — but the
  // tenant's own policy still delivers it, so nothing offers to create a second
  // one, and the row is not drawn in the floor group. Week two: the block carves
  // out the chosen exclusions group, which on day one it does not (Step 3 correction).
  const r = runFixture(fixture('demo-week2'), { goalMap: without('block-legacy-auth') })
  const legacy = r.steps.find((s) => s.goalId === 'block-legacy-auth')!
  assert.equal(legacy.floor, true, 'provenance survives: the active baseline does not carry it')
  assert.equal(legacy.status, 'done', 'the tenant\'s own policy delivers it')
  assert.ok(legacy.satisfiedBy && legacy.satisfiedBy.policies.length > 0, 'and the plan says which policy does')
  assert.equal(legacy.action.json ?? null, null, 'nothing offers a duplicate to create')
  assert.deepEqual(floorRows(r.steps).map((s) => s.goalId), ['register-info-protected'], 'a delivered recommendation is not a row in the floor group')
})

// ---- Where a floor row is drawn: once, and never under a numbered phase ----

test('a floor step a wave dates renders once, in the floor group, and in no numbered phase', () => {
  const r = runFixture(fixture('demo-week2'))
  const reg = r.steps.find((s) => s.goalId === 'register-info-protected')!
  assert.equal(reg.floor, true)
  // The premise this test exists for: a schedule that carries the id, so the rows
  // a phase draws have to drop it rather than never see it. On this tenant a
  // readiness threshold holds the step and the schedule withdraws it
  // (roadmap/holds.ts), so the id is put back into a wave here: a plan file or a
  // step that is not held carries it, and the rule has to hold either way.
  const waves = r.schedule.waves.some((w) => w.stepIds.includes(reg.id)) ? r.schedule.waves : r.schedule.waves.map((w, i) => (i === r.schedule.waves.length - 1 ? { ...w, stepIds: [...w.stepIds, reg.id] } : w))
  assert.ok(waves.some((w) => w.stepIds.includes(reg.id)), 'a wave dates the floor step')
  // Once, in the group named for what it is.
  assert.deepEqual(floorRows(r.steps).filter((s) => s.id === reg.id).map((s) => s.id), [reg.id])
  // And nowhere else: no numbered phase, and not the undated group either.
  for (const w of waves) {
    assert.equal(phaseRows(r.steps, w).some((s) => s.id === reg.id), false, `phase ${w.wave} draws the floor step`)
  }
  assert.equal(undatedRows(r.steps, waves).some((s) => s.id === reg.id), false, 'the undated group draws the floor step')
})

test('every step the Plan draws is drawn exactly once, over every fixture', () => {
  for (const f of allFixtures()) {
    const r = runFixture(f)
    const drawn = new Map<string, string[]>()
    const put = (id: string, where: string): void => { drawn.set(id, [...(drawn.get(id) ?? []), where]) }
    for (const w of r.schedule.waves) for (const s of phaseRows(r.steps, w)) put(s.id, `phase ${w.wave}`)
    for (const s of undatedRows(r.steps, r.schedule.waves)) put(s.id, 'undated')
    for (const s of floorRows(r.steps)) put(s.id, 'floor')
    for (const [id, places] of drawn) assert.equal(places.length, 1, `${f.name}: ${id} renders in ${places.join(' and ')}`)
    // And a step with a row to draw has one: a floor step is in the floor group,
    // anything else the waves date is in its phase or the undated group.
    for (const s of r.steps) {
      if (s.status === 'done' || s.doesntApply) continue
      assert.ok(drawn.has(s.id), `${f.name}: ${s.id} renders nowhere`)
    }
  }
})

test('a floor step already delivered is in the footer, not the floor group and not a phase', () => {
  // The demo tenant blocks legacy authentication; take the goal out of the
  // active baseline and the step is the floor's and done at once. Done rows are
  // the footer's, so neither the group nor a numbered phase draws it. Week two,
  // where the block carves out the chosen exclusions group and is delivered.
  const r = runFixture(fixture('demo-week2'), { goalMap: without('block-legacy-auth') })
  const legacy = r.steps.find((s) => s.goalId === 'block-legacy-auth')!
  assert.equal(legacy.floor, true)
  assert.equal(legacy.status, 'done')
  assert.ok(r.schedule.waves.some((w) => w.stepIds.includes(legacy.id)), 'a wave dates it')
  assert.equal(floorRows(r.steps).some((s) => s.id === legacy.id), false, 'the floor group draws a delivered row')
  for (const w of r.schedule.waves) {
    assert.equal(phaseRows(r.steps, w).some((s) => s.id === legacy.id), false, `phase ${w.wave} draws a delivered floor row`)
  }
})

test('a baseline holding both recommendations leaves no floor group to draw', () => {
  // Both goals in the active map: nothing is the floor's, so floorRows is empty
  // and each surface's `floor.length > 0` guard draws no heading at all.
  const held: GoalMap = { ...PINNED_GOAL_MAP, 'register-info-protected': ['(a baseline that holds it)'], 'block-legacy-auth': ['(a baseline that holds it)'] }
  const r = runFixture(fixture('demo-week2'), { goalMap: held })
  assert.deepEqual(floorRows(r.steps), [], 'no row belongs to the floor')
  // The printed document still guards the heading explicitly.
  const print = readFileSync(new URL('../ui/surfaces/PrintPlan.tsx', import.meta.url), 'utf8')
  assert.ok(print.includes('{floor.length > 0 && ('), 'PrintPlan.tsx draws the group unguarded')
  // The Plan does not need a guard any more, and this is the stronger fact: the
  // board builds a group only where a row lands in it (planBoard.ts `byRoadmap`
  // creates a group on first row; the keyed lenses drop empty groups outright),
  // so an empty floor cannot produce a heading. Proven against the projection
  // rather than against the JSX, because that is where the rule now lives.
  const items = floorRows(r.steps).map((step, i) => ({
    id: step.id,
    title: step.title,
    roadmap: { key: 'floor', label: phases.recommended, date: null, secondary: true, start: null },
    status: 'waiting' as const,
    workType: 'ca' as const,
    isNext: false,
    order: i,
  }))
  assert.deepEqual(groupsFor('roadmap', items), [], 'an empty floor still produced a group')
  assert.deepEqual(groupsFor('status', items), [], 'an empty floor still produced a group in the Status lens')
})

// ---- The group on the page and in the printed document ----

test('the Plan draws the floor as its own named group, after the phases and before Cleanup', () => {
  assert.equal(phases.recommended, 'Microsoft recommended, not in this baseline')
  const src = readFileSync(new URL('../ui/surfaces/Plan.tsx', import.meta.url), 'utf8')
  const at = (needle: string): number => { const i = src.indexOf(needle); assert.ok(i > 0, `${needle} renders`); return i }
  // The board composes its groups in order, so placement is the order the rows
  // are added to the one row set rather than the order of two JSX blocks.
  const group = src.slice(at('const floorGroup: RoadmapGroup'), at('const floorGroup: RoadmapGroup') + 260)
  assert.match(group, /label: phases\.recommended/, 'the group is named, from content.phases')
  // Not a numbered phase: its timeline is the scheduler's own placement of its
  // rows, or Not scheduled where nothing places them (owner, 2026-09-11) — never
  // a borrowed wave date.
  assert.match(group, /date: placedSpan\(floor\)/, 'the floor group claims a date it does not have')
  assert.match(group, /secondary: true/, 'the floor group reads as part of the active rollout sequence')
  assert.ok(at('for (const [wi, w] of waveRows.entries())') < at('const floorGroup: RoadmapGroup'), 'the floor group follows the numbered phases')
  assert.match(src, /steps: phaseRows\(c\.steps, w\)/, 'a numbered phase decides its own rows')
  assert.ok(at('const floorGroup: RoadmapGroup') < at('if (cleanupPhase) {'), 'and precedes Cleanup')
  assert.equal(src.includes('phases.heading, { name: phases.recommended'), false, 'the floor group is not dressed as a numbered, dated phase')
})

test('the printed document carries the floor as the same named group, never under a numbered phase', () => {
  const src = readFileSync(new URL('../ui/surfaces/PrintPlan.tsx', import.meta.url), 'utf8')
  assert.match(src, /<h2>\{phases\.recommended\}<\/h2>/, 'the document names the group with the Plan\'s own words')
  // A floor step can sit in a wave's stepIds; the phase sections and the timeline
  // read the Plan's own row rule, so the document never attributes it to the
  // author. That rule (ui/surfaces/planRows.ts phaseRows) drops the floor's ids
  // and the footer's alike, which is one authority rather than a filter the
  // document keeps for itself (task 027).
  assert.match(src, /phaseRows\(steps, w\)/, 'the phases drop the floor\'s ids')
  assert.equal(src.includes('floorGroupIds'), false, 'the document decides for itself which ids a phase may draw')
  assert.equal(src.includes('w.stepIds.map('), false, 'no printed section reads a wave\'s raw step ids')
  assert.equal(src.includes('w.stepIds.filter('), false, 'no printed section filters a wave\'s raw step ids itself')
  const at = (needle: string): number => { const i = src.indexOf(needle); assert.ok(i > 0, `${needle} renders`); return i }
  assert.ok(at('{floor.length > 0 && (') < at('{schedule.cleanup && ('), 'the floor group precedes Cleanup')
})

test('the Plan page contract accepts the two named groups exactly, and nothing broader', () => {
  const contract = JSON.parse(readFileSync(new URL('../../docs/qa/page-contracts.json', import.meta.url), 'utf8')) as { surfaces: { id: string; allow: { headings: string[] } }[] }
  const headings = contract.surfaces.find((s) => s.id === 'plan')!.allow.headings
  assert.deepEqual(headings, [
    'Plan',
    // The board's group heads carry the group's NAME and put its date range in
    // its own slot beside it, so the headings are plain names where they used to
    // be name-plus-dates patterns. The one pattern left is the phase number.
    'Preparation',
    're:^Phase \\d+$',
    'Cleanup',
    phases.recommended,
    // Task 036 named the undated group on screen with the words the print has
    // always used over the same rows (app.plan.held). Both entries are exact
    // strings read from the content file: the guard this test is here for is a
    // broad new PATTERN in the Plan's closed heading list, not a group the Plan
    // stopped drawing anonymously.
    (app.plan as unknown as { held: { heading: string } }).held.heading,
    // Finished work is the board's last group now, not the footer's first
    // details: a lens groups rows, and it cannot group a row that lives in
    // another component.
    'Complete',
  ], 'the contract gained the exact headings and no new pattern')
})

// ---- Correction 1: absence from the active baseline is authoritative for the
// step's body, not only for its label. The render-time signature fallback
// (generate.ts sourcesFor) exists for a package whose policies the map does not
// name — the synthetic fixtures. It must never reach a floor goal: a step that
// says "Microsoft recommended, not in this baseline" cannot be built out of a
// broadly matching policy in that very baseline.

/** An active goal map whose one key resolves in no package: the signature fallback is live for every goal. */
const NON_RESOLVING: GoalMap = { 'mfa-all-users': ['(a policy no package here carries)'] }

test('a goal map that resolves nowhere in the active package still cannot lend a floor step that package\'s policy', () => {
  // The demo package carries a policy that broadly matches registration
  // protection — the risky-users registration block the pin-time rule rejected.
  const r = runFixture(fixture('demo'), { goalMap: NON_RESOLVING })
  const reg = r.steps.find((s) => s.id === stepIdForGoal('register-info-protected'))!
  assert.equal(reg.floor, true, 'the active baseline does not carry it')
  assert.equal(reg.naming?.fromBaseline ?? null, null, 'so nothing attributes it to a policy in that baseline')
  assert.deepEqual(reg.action.resolution?.policies.map((p) => p.sourceName), ['register-info-protected'], 'the source is the catalogue template')
  const body = JSON.parse(reg.action.json!) as { conditions: { applications: { includeUserActions?: string[] }; userRiskLevels?: string[] } }
  assert.deepEqual(body.conditions.applications.includeUserActions, ['urn:user:registersecurityinfo'], 'the template\'s own semantics')
  assert.deepEqual(body.conditions.userRiskLevels ?? [], [], 'and none of the matched policy\'s conditions came with it')
  // Nothing else the active baseline lacks was revived by the same fallback.
  assert.deepEqual(
    r.steps.filter((s) => s.id.startsWith('s-goal-')).map((s) => s.goalId).sort(),
    ['block-legacy-auth', 'mfa-all-users', 'register-info-protected'],
    'the floor\'s two goals and the one goal the map holds, and no other',
  )
})

test('the same for the legacy block, and a goal the map does hold keeps the fallback', () => {
  const r = runFixture(fixture('getiamai'), { goalMap: NON_RESOLVING })
  const legacy = r.steps.find((s) => s.id === stepIdForGoal('block-legacy-auth'))!
  assert.equal(legacy.floor, true)
  assert.equal(legacy.naming?.fromBaseline ?? null, null, 'not attributed to the package\'s own legacy policy')
  assert.deepEqual(legacy.action.resolution?.policies.map((p) => p.sourceName), ['block-legacy-auth'], 'the source is the catalogue template')
  const body = JSON.parse(legacy.action.json!) as { conditions: { clientAppTypes?: string[] }; grantControls: { builtInControls?: string[] } }
  assert.deepEqual([...(body.conditions.clientAppTypes ?? [])].sort(), ['exchangeActiveSync', 'other'])
  assert.deepEqual(body.grantControls.builtInControls, ['block'])
  // The fallback itself is untouched where the map holds the goal: a package the
  // map does not describe still renders that goal from its own policy.
  const mfa = r.steps.find((s) => s.id === stepIdForGoal('mfa-all-users'))!
  assert.ok(!mfa.floor, 'the map holds it, so it is the author\'s')
  assert.deepEqual(mfa.action.resolution?.policies.map((p) => p.sourceName), ['IAC - GLOBAL - GRANT - MFA - AllUsers'], 'matched in the package, as a synthetic fixture needs')
})

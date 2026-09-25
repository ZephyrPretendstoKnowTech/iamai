// The floor (target-state §13, decided 2026-09-01; prompt 53 queue item 3): a
// "Microsoft recommended, not in this baseline" set — registration protection,
// the legacy-authentication block, emergency access — rendered when the active
// baseline lacks them, flagged as not the author's, from Microsoft's own template
// through the same translator as a baseline policy.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { allFixtures, fixture, withSyntheticBaseline } from './fixtures/index.ts'
import { runFixture } from './fixtures/run.ts'
import { PINNED_GOAL_MAP } from './goalMap.ts'
import type { GoalMap } from './goalMap.ts'
import { BREAK_GLASS_STEP_ID, stepIdForGoal } from './stepIds.ts'
import { FLOOR_GOAL_IDS, isFloorGoal } from './floor.ts'
import { floorRows, phaseRows, undatedRows } from '../ui/surfaces/planRows.ts'
import { stepPortalLines } from '../ui/surfaces/stepPortal.ts'

test('the pinned baseline carries registration protection as its author confirmed it, so it is his and never the floor', () => {
  // Jon's UserRegistration policy (baseline/authorCorrections.ts; owner, 2026-09-25:
  // the baseline wins over Microsoft's template): security-info registration, All
  // users, his strength, no location condition.
  const r = runFixture(fixture('demo-week2'))
  const reg = r.steps.find((s) => s.goalId === 'register-info-protected')
  assert.ok(reg, 'registration protection renders')
  assert.ok(!reg.floor, 'the author\'s, not the floor')
  assert.equal(reg.kind, 'create')
  assert.ok(reg.action.json, 'the body is the pinned policy, resolved for this tenant')
  const body = JSON.parse(reg.action.json) as { conditions: { applications: { includeUserActions?: string[] }; users: { includeUsers?: string[]; includeGroups?: string[] }; locations?: unknown; platforms?: unknown }; grantControls: { authenticationStrength?: unknown; builtInControls?: string[] } }
  assert.deepEqual(body.conditions.applications.includeUserActions, ['urn:user:registersecurityinfo'])
  assert.deepEqual(body.conditions.users.includeUsers, ['All'])
  assert.ok(!body.conditions.locations && !body.conditions.platforms, 'no location or platform condition')
  assert.ok(body.grantControls.authenticationStrength, 'his authentication strength')
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

test('the floor step\'s What to do is the template through the translator: the user action, the exclusions group, never an account by name', () => {
  // Week two: the exclusions group exists, so the template resolves and the step
  // offers its instructions (stepJson.ts implementationOffered).
  const f = fixture('demo-week2')
  const r = runFixture(f)
  const held = r.steps.find((s) => s.goalId === 'register-info-protected')!
  // Created On since Phase 2e, MFA readiness holds its create; read once that is met.
  const reg = { ...held, action: { ...held.action, readinessGate: undefined, enforceWaitsOn: [] } }
  const names = (id: string): string => r.input.names!.label(id)
  // The floor step's own resolved template, read off the step like any policy step.
  const lines = stepPortalLines(reg, { nameOf: names, policyName: reg.naming?.proposed ?? reg.title })
  assert.ok(lines && lines.length > 3, 'portal lines render')
  const text = lines!.join('\n')
  assert.match(text, /Register security information|security info/i, 'the user action is named')
  assert.match(text, /Exclude → Groups: Core - Exclusions/, 'the exclusion is the group')
  for (const id of f.mapping.breakGlassUserIds) assert.ok(!text.includes(names(id)), 'never an emergency account by name')
  assert.doesNotMatch(text, /\{[a-zA-Z]+\}|__IAMAI|urn:user:/, 'no raw placeholder or URN')
  assert.match(text, /Enable policy: On → Create\.$/, 'created On: a User Action policy (Phase 2e)')
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

test('an active baseline that carries neither floor goal renders both, flagged, from Microsoft\'s own templates, and emergency access stays the Preparation check', () => {
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
  // Emergency access is the Preparation check, never a floor policy.
  const bg = r.steps.filter((s) => s.id === BREAK_GLASS_STEP_ID)
  assert.equal(bg.length, 1, 'one emergency-access path, not two')
  assert.equal(bg[0].kind, 'prerequisite')
  assert.ok(!bg[0].floor, 'the prerequisite is not a Microsoft-floor recommendation row')
  assert.equal(bg[0].action.json ?? null, null, 'no Conditional Access body was invented for it')
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
  // Registration protection is the pinned baseline's own (Jon's corrected UserRegistration), so no floor row is left at all.
  assert.deepEqual(floorRows(r.steps).map((s) => s.goalId), [], 'a delivered recommendation is not a row in the floor group')
})

// ---- Where a floor row is drawn: once, and never under a numbered phase ----

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

// ---- Correction 1: absence from the active baseline is authoritative for the
// step's body, not only for its label. The render-time signature fallback
// (generate.ts sourcesFor) exists for a package whose policies the map does not
// name — the synthetic fixtures. It must never reach a floor goal: a step that
// says "Microsoft recommended, not in this baseline" cannot be built out of a
// broadly matching policy in that very baseline.

/** An active goal map whose one key resolves in no package: the signature fallback is live for every goal. */
const NON_RESOLVING: GoalMap = { 'mfa-all-users': ['(a policy no package here carries)'] }

test('a goal map that resolves nowhere in the active package still cannot lend a floor step that package\'s policy, and a goal the map holds keeps the fallback', () => {
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

  // The same for the legacy block, and a goal the map does hold keeps the fallback.
  // Asked for by name: this case reads a policy out of the synthetic package, as
  // its last assertion says. getiamai is built on that package already (only the
  // demo is on the pin, fixtures/index.ts buildFixture), so the premise is stated
  // rather than inherited from which fixture was chosen.
  const synthetic = runFixture(withSyntheticBaseline(fixture('getiamai')), { goalMap: NON_RESOLVING })
  const legacy = synthetic.steps.find((s) => s.id === stepIdForGoal('block-legacy-auth'))!
  assert.equal(legacy.floor, true)
  assert.equal(legacy.naming?.fromBaseline ?? null, null, 'not attributed to the package\'s own legacy policy')
  assert.deepEqual(legacy.action.resolution?.policies.map((p) => p.sourceName), ['block-legacy-auth'], 'the source is the catalogue template')
  const legacyBody = JSON.parse(legacy.action.json!) as { conditions: { clientAppTypes?: string[] }; grantControls: { builtInControls?: string[] } }
  assert.deepEqual([...(legacyBody.conditions.clientAppTypes ?? [])].sort(), ['exchangeActiveSync', 'other'])
  assert.deepEqual(legacyBody.grantControls.builtInControls, ['block'])
  // The fallback itself is untouched where the map holds the goal: a package the
  // map does not describe still renders that goal from its own policy.
  const mfa = synthetic.steps.find((s) => s.id === stepIdForGoal('mfa-all-users'))!
  assert.ok(!mfa.floor, 'the map holds it, so it is the author\'s')
  assert.deepEqual(mfa.action.resolution?.policies.map((p) => p.sourceName), ['IAC - GLOBAL - GRANT - MFA - AllUsers'], 'matched in the package, as a synthetic fixture needs')
})

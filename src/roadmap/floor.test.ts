// The floor (target-state §13, decided 2026-09-01; prompt 53 queue item 3): a
// "Microsoft recommended, not in this baseline" set — registration protection,
// the legacy-authentication block, emergency access — rendered when the active
// baseline lacks them, flagged as not the author's, from Microsoft's own template
// through the same translator as a baseline policy.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fixture } from './fixtures/index.ts'
import { runFixture } from './fixtures/run.ts'
import { PINNED_GOAL_MAP } from './goalMap.ts'
import { FLOOR_GOAL_IDS, isFloorGoal } from './floor.ts'
import { stepPortalLinesFromBody } from '../ui/surfaces/stepPortal.ts'

test('the pinned baseline lacks registration protection, so the floor renders it, flagged, from the template', () => {
  const r = runFixture(fixture('demo'))
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
  // Emergency access is the Preparation check step on every plan.
  assert.ok(r.steps.some((s) => /break-glass|emergency/.test(s.id)), 'emergency access is present')
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
  const f = fixture('demo')
  const r = runFixture(f)
  const reg = r.steps.find((s) => s.goalId === 'register-info-protected')!
  const names = (id: string): string => r.input.names!.label(id)
  const lines = stepPortalLinesFromBody(reg.action.json!, { nameOf: names, policyName: reg.naming?.proposed ?? reg.title })
  assert.ok(lines && lines.length > 3, 'portal lines render')
  const text = lines!.join('\n')
  assert.match(text, /Register security information|security info/i, 'the user action is named')
  assert.match(text, /exclusions group/i, 'the exclusion is the group')
  for (const id of f.mapping.breakGlassUserIds) assert.ok(!text.includes(names(id)), 'never an emergency account by name')
  assert.doesNotMatch(text, /\{[a-zA-Z]+\}|__IAMAI|urn:user:/, 'no raw placeholder or URN')
  assert.match(text, /Report-only/, 'ends in report-only')
})

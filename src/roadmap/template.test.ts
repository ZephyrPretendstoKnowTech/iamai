// Every step executable (prompt 46 Part 3, target-state §6): each goal's
// template is the goal it claims to be, renders Do it from the same renderer a
// baseline policy would, and every placeholder either resolves from the
// assumptions or names the Wave 0 step that creates the missing object.
import { powershellFor } from '../ui/surfaces/stepPowerShell.ts'
import { hasBaselineConflict } from './baselineConflict.ts'
import { test } from 'node:test'
import { PINNED_GOAL_MAP, goalInMap } from './goalMap.ts'
import { isFloorGoal } from './floor.ts'
import assert from 'node:assert/strict'
import { CATALOGUE } from '../coverage/coverage.ts'
import { actionVerb, proposedPolicyName } from '../coverage/naming.ts'
import { emptyMappingState } from '../mapping/types.ts'
import { buildCreateAction, PLACEHOLDER_STEP } from './generate.ts'
import { allFixtures } from './fixtures/index.ts'
import { runFixture } from './fixtures/run.ts'
import { placeholdersIn, resolveTemplate, SAMPLE_VALUES, TEMPLATE_PLACEHOLDERS } from './template.ts'
import type { TemplateBody } from './template.ts'

const ALWAYS_RESOLVED = new Set(['{namePrefix}', '{coreAdminRoles}'])

test('prompt 49.1 item 1: an unresolved reference is stripped from the JSON, never left as a raw id or a placeholder token', () => {
  const mapping = emptyMappingState('t')
  const body = {
    displayName: 'Require MFA',
    conditions: { users: { includeUsers: ['All'], excludeGroups: ['ref-exclusions'] } },
    grantControls: { operator: 'OR', builtInControls: ['mfa'] },
  }
  // The author's own group, from the baseline the policy came from: the one
  // resolution boundary reads the reference there, and this tenant has nothing
  // to resolve it with.
  const policies = [{ displayName: 'author', conditions: { users: { excludeGroups: ['ref-exclusions'] } } }] as never
  const action = buildCreateAction(body, mapping, 'plan-1', 's-x', 'x', { tenant: { exclusionsGroupId: null, serviceAccountsGroupId: null, allowedCountriesLocationId: null }, policies })
  assert.ok(action.json, 'json produced')
  assert.doesNotMatch(action.json!, /__IAMAI_|ref-exclusions/, 'no placeholder token or raw reference in the JSON')
  assert.doesNotMatch(action.json!, /"excludeGroups"/, 'the array emptied by stripping loses its key')
  assert.doesNotMatch(powershellFor(JSON.parse(action.json!)), /__IAMAI_|Replace the placeholders|ref-exclusions/, 'no placeholder token or advisory in the PowerShell')
})

test('item 12: every goal × implementation renders Do it from the template with a grant or session control', () => {
  const mapping = emptyMappingState('t')
  for (const goal of CATALOGUE) {
    for (const impl of goal.implementations) {
      const { body, unresolved } = resolveTemplate(impl.template as TemplateBody, SAMPLE_VALUES)
      assert.deepEqual(unresolved, [], `${goal.id}: sample values resolve everything`)
      const action = buildCreateAction(body, mapping, 'plan-1', `s-goal-${goal.id}`, goal.id, { displayName: `CA - ${actionVerb(impl)} - ${goal.shortName}` })
      assert.ok(action.json, `${goal.id}: json`)
      const parsed = JSON.parse(action.json) as { grantControls?: { builtInControls?: string[]; authenticationStrength?: unknown } | null; sessionControls?: Record<string, unknown> | null; state: string; description: string }
      const grants = (parsed.grantControls?.builtInControls?.length ?? 0) + (parsed.grantControls?.authenticationStrength ? 1 : 0)
      const sessions = Object.values(parsed.sessionControls ?? {}).filter((v) => v && typeof v === 'object' && (v as { isEnabled?: boolean }).isEnabled === true).length
      assert.ok(grants + sessions >= 1, `${goal.id}: at least one grant or session control`)
      assert.equal(parsed.state, 'enabledForReportingButNotEnforced', `${goal.id}: created in report-only`)
      assert.match(parsed.description, /^\[IAMAI:plan-1:s-goal-/, `${goal.id}: tagged`)
      assert.match(powershellFor(parsed), /New-MgIdentityConditionalAccessPolicy -BodyParameter/, `${goal.id}: PowerShell`)
    }
  }
})

test('item 12: every placeholder a template uses has a Wave 0 step that creates the object, or always resolves', () => {
  for (const goal of CATALOGUE) {
    for (const impl of goal.implementations) {
      const { unresolved } = resolveTemplate(impl.template as TemplateBody, {})
      for (const p of placeholdersIn(impl.template)) {
        if (ALWAYS_RESOLVED.has(p)) continue
        assert.ok(unresolved.includes(p), `${goal.id}: ${p} is reported unresolved with no values`)
        assert.ok(p in PLACEHOLDER_STEP, `${goal.id}: ${p} has no Wave 0 step`)
      }
    }
  }
  assert.deepEqual(new Set([...Object.keys(PLACEHOLDER_STEP), ...ALWAYS_RESOLVED]), new Set(TEMPLATE_PLACEHOLDERS))
})

test('item 12: with no baseline at all, every create step still carries a body, and unresolved objects block on Wave 0 or Setup', () => {
  const f = allFixtures().find((x) => x.name === 'small')
  assert.ok(f)
  const r = runFixture({ ...f, baseline: { ...f.baseline, policies: [], docs: [] } })
  // A goal whose baseline contradicts itself carries no body on purpose
  // (roadmap/baselineConflict.ts): asserted here so the exception is not a gap.
  const conflicted = r.steps.filter((s) => hasBaselineConflict(s.goalId))
  assert.ok(conflicted.length > 0, 'the conflicted goal is in the plan')
  for (const s of conflicted) assert.equal(s.action.json, null, `${s.id}: a conflicted baseline offers no body`)
  const creates = r.steps.filter((s) => s.goalId && s.kind === 'create' && s.status !== 'done' && !hasBaselineConflict(s.goalId))
  // The plan holds the pinned map's goals (walk-51 item 9): every create step is
  // one of them, and every held goal small does not enforce gets one.
  assert.ok(creates.length >= 8, `expected a create step per held goal small lacks, got ${creates.length}`)
  for (const s of creates) assert.ok(goalInMap(PINNED_GOAL_MAP, s.goalId) || (isFloorGoal(s.goalId) && s.floor === true), `${s.id}: a create step for a goal the baseline does not hold`)
  for (const s of creates) {
    assert.ok(s.action.json, `${s.id}: has a body`)
    assert.equal(s.action.summary.some((l) => /No baseline policy matches/.test(l)), false, `${s.id}: no "create a policy that meets the floor" hand-off`)
    const leftover = TEMPLATE_PLACEHOLDERS.filter((p) => s.action.json?.includes(p))
    for (const p of leftover) {
      assert.ok(p in PLACEHOLDER_STEP, `${s.id}: ${p} left in the body`)
      const prereq = PLACEHOLDER_STEP[p as keyof typeof PLACEHOLDER_STEP]
      const held = s.blockedBy.includes(prereq) || s.blockers.some((b) => b.kind === 'setup')
      assert.ok(held, `${s.id}: ${p} unresolved but the step waits on nothing (blockedBy ${s.blockedBy.join(', ') || 'nothing'})`)
    }
  }
})

test('item 13: proposed names are {prefix} - {Action} - {shortName}, never the goal sentence', () => {
  const legacy = CATALOGUE.find((g) => g.id === 'block-legacy-auth')
  const admins = CATALOGUE.find((g) => g.id === 'admins-phishing-resistant')
  const session = CATALOGUE.find((g) => g.id === 'admin-session')
  assert.ok(legacy && admins && session)
  assert.equal(proposedPolicyName(legacy, null), `CA - Block - ${legacy.shortName}`)
  assert.equal(proposedPolicyName(admins, null), `CA - Require - ${admins.shortName}`)
  assert.equal(proposedPolicyName(session, null), `CA - Session - ${session.shortName}`)
  // A two-segment tenant convention collapses the action into the control.
  const two = proposedPolicyName(legacy, { prefix: 'Core', separator: ' - ' })
  assert.equal(two, `Core - Block ${legacy.shortName.charAt(0).toLowerCase()}${legacy.shortName.slice(1)}`)
  for (const g of CATALOGUE) assert.equal(proposedPolicyName(g, null).includes(g.name), false, `${g.id}: name carries the goal sentence`)
})

test('item 14: no fixture produces an ad-hoc goal or a "Restrict access to" step', () => {
  for (const f of allFixtures()) {
    const r = runFixture(f)
    assert.equal(r.coverage.results.some((x) => x.goal.id.startsWith('adhoc:')), false, `${f.name}: ad-hoc goal`)
    assert.equal(r.steps.some((s) => /^Restrict access to/.test(s.title)), false, `${f.name}: invented title`)
    assert.ok(Array.isArray(r.coverage.organisation.notAssessed), `${f.name}: notAssessed present`)
  }
})

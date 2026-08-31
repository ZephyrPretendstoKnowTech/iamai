// Detected defaults replace Setup (prompt 46 item 19, target-state §5): every
// answer exists once a scan does, nothing is asked, and whatever is not found
// becomes the plan's first steps.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fixtureBaseline, fixtureSnapshot } from '../ui/fixtures/fixtureSnapshot.ts'
import { emptyMappingState } from './types.ts'
import { QUESTION_SCHEMA } from './questionSchema.ts'
import { activeWizardQuestions, applyDetectedDefaults, wizardProgress } from './wizard.ts'
import { allFixtures } from '../roadmap/fixtures/index.ts'
import { runFixture } from '../roadmap/fixtures/run.ts'
import { BREAK_GLASS_STEP_ID } from '../roadmap/generate.ts'

test('the seven answers, and no others: handle-with-care and frameworks are not questions', () => {
  assert.deepEqual(
    QUESTION_SCHEMA.map((q) => q.id),
    ['breakGlass', 'globalExclusion', 'countries', 'trustedLocations', 'serviceAccounts', 'timeZone', 'applicability'],
  )
})

test('after detection every active question is answered and the progress is complete', () => {
  const snapshot = fixtureSnapshot()
  const pkg = fixtureBaseline().pkg
  const state = applyDetectedDefaults(emptyMappingState(snapshot.tenantId), pkg, snapshot, { knownGroups: [], defaultTimeZone: 'Australia/Sydney' })
  const active = activeWizardQuestions(pkg, { snapshot, state })
  const progress = wizardProgress(state, active)
  assert.equal(progress.requiredMissing, 0, `unanswered: ${active.filter((q) => state.wizardAnswered[q.id] !== true).map((q) => q.id).join(', ')}`)
  assert.equal(progress.complete, true)
  assert.equal(state.displayTimeZone, 'Australia/Sydney')
  for (const q of active) assert.ok(state.assumed?.[q.id] === 'detected' || state.assumed?.[q.id] === 'noneFound', `${q.id} says where it came from`)
  // Countries come from where people sign in; the fixture signs in from Australia.
  assert.ok(state.allowedCountries.length > 0)
})

test('a person’s answer is never overwritten; a detected one is recomputed', () => {
  const snapshot = fixtureSnapshot()
  const pkg = fixtureBaseline().pkg
  const first = applyDetectedDefaults(emptyMappingState(snapshot.tenantId), pkg, snapshot, { knownGroups: [] })
  const edited = { ...first, allowedCountries: ['NZ'], wizardAnswered: { ...first.wizardAnswered, countries: true }, assumed: { ...first.assumed, countries: 'confirmed' as const } }
  const again = applyDetectedDefaults(edited, pkg, snapshot, { knownGroups: [] })
  assert.deepEqual(again.allowedCountries, ['NZ'], 'the confirmed answer stands')
  assert.equal(again.assumed?.countries, 'confirmed')
  assert.equal(again.assumed?.breakGlass, first.assumed?.breakGlass, 'detected answers are recomputed to the same result')
})

test('no emergency-access candidate: the assumption reads none found and Wave 0 creates the accounts', () => {
  const snapshot = fixtureSnapshot()
  // Take every signal away: ordinary names, licences, no roles, nobody excluded.
  for (const u of snapshot.users) {
    u.displayName = `Person ${u.id}`
    u.userPrincipalName = `person.${u.id}@contoso.com`
    u.assignedPlans = [{ servicePlanId: 'p', capabilityStatus: 'Enabled' }]
  }
  snapshot.roles = { active: {}, eligible: {} }
  for (const raw of snapshot.config.caPolicies?.rows ?? []) {
    const p = raw as { conditions?: { users?: { excludeUsers?: string[] } } }
    if (p.conditions?.users) p.conditions.users.excludeUsers = []
  }
  const pkg = fixtureBaseline().pkg
  const state = applyDetectedDefaults(emptyMappingState(snapshot.tenantId), pkg, snapshot, { knownGroups: [] })
  assert.deepEqual(state.breakGlassUserIds, [])
  assert.equal(state.assumed?.breakGlass, 'noneFound')
  assert.equal(state.records['__breakGlassMissing']?.doesNotExist, true)
  assert.equal(state.wizardAnswered.breakGlass, true, 'none found is an answer, not a question')
})

test('on every fixture the plan has no Setup step, and the emergency-access step carries the two done-when lines', () => {
  for (const f of allFixtures()) {
    const r = runFixture(f)
    assert.equal(r.steps.some((s) => s.id === 's-setup-questions'), false, `${f.name}: nothing is asked before the plan exists`)
    const bg = r.steps.find((s) => s.id === BREAK_GLASS_STEP_ID)
    if (bg) {
      assert.ok(bg.exitCriteria.some((l) => /passphrase/.test(l)), `${f.name}: passphrase done-when line`)
      assert.ok(bg.exitCriteria.some((l) => /raises an alert/.test(l)), `${f.name}: sign-in alert done-when line`)
    }
    // "Answer it in Setup" has no producer (item 22); a check a failed read kept
    // from running is one housekeeping line, never a reason or a recommendation.
    assert.equal(r.steps.some((s) => [s.stateReason, ...s.unblockNotes, ...s.action.summary].some((t) => /Answer it in Setup/.test(t))), false, `${f.name}: no Setup link`)
    assert.equal(r.steps.some((s) => [s.stateReason, ...s.unblockNotes].some((t) => /could not be checked/.test(t))), false, `${f.name}: no "could not be checked" reason`)
    if (f.name === 'hostile') assert.match(r.housekeeping.checksNotRun ?? '', /^\d+ checks? could not run: /, 'the 403s become one housekeeping line')
    else assert.ok('housekeeping' in r)
  }
})

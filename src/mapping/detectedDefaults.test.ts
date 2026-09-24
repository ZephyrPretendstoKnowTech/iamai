// Detected defaults replace Setup (prompt 46 item 19, target-state §5): every
// answer exists once a scan does, nothing is asked, and whatever is not found
// becomes the plan's first steps.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fixtureSnapshot } from '../testing/uiSnapshot.ts'
import { emptyMappingState } from './types.ts'
import { answersComplete, applyDetectedDefaults, askedAnswers } from './wizard.ts'
import { EXCLUSIONS_RECORD_KEY, exclusionsGroupRecord } from './safetyChoice.ts'

test('detection answers every active question but the exclusions group, which waits for a person; a person\'s answer is never overwritten', () => {
  // after detection every active question is answered, and the exclusions group still waits for a person
  {
    const snapshot = fixtureSnapshot()
    const state = applyDetectedDefaults(emptyMappingState(snapshot.tenantId), snapshot, { knownGroups: [], defaultTimeZone: 'Australia/Sydney' })
    const active = askedAnswers(snapshot, state)
    for (const q of active) assert.equal(state.wizardAnswered[q], true, `${q} has a detected default`)
    // Six of the seven are answered by the detection. The exclusions group is the
    // one coverage may not read that way: it decides who a policy still lets in,
    // so "complete" waits for the record an operator's confirmation writes, and a
    // detected default beside it is not that (mapping/safetyChoice.ts).
    assert.equal(answersComplete(snapshot, state), false, 'a detection does not answer the exclusions question')
    const confirmed = { ...state, records: { ...state.records, [EXCLUSIONS_RECORD_KEY]: exclusionsGroupRecord(undefined, 'g-exclusions') } }
    assert.equal(answersComplete(snapshot, confirmed), true, `unanswered: ${active.filter((q) => confirmed.wizardAnswered[q] !== true).join(', ')}`)
    assert.equal(state.displayTimeZone, 'Australia/Sydney')
    for (const q of active) assert.ok(state.assumed?.[q] === 'detected' || state.assumed?.[q] === 'noneFound', `${q} says where it came from`)
    // Countries come from where people sign in; the fixture signs in from Australia.
    assert.ok(state.allowedCountries.length > 0)
  }

  // a person’s answer is never overwritten; a detected one is recomputed
  {
    const snapshot = fixtureSnapshot()
    const first = applyDetectedDefaults(emptyMappingState(snapshot.tenantId), snapshot, { knownGroups: [] })
    const edited = { ...first, allowedCountries: ['NZ'], wizardAnswered: { ...first.wizardAnswered, countries: true }, assumed: { ...first.assumed, countries: 'confirmed' as const } }
    const again = applyDetectedDefaults(edited, snapshot, { knownGroups: [] })
    assert.deepEqual(again.allowedCountries, ['NZ'], 'the confirmed answer stands')
    assert.equal(again.assumed?.countries, 'confirmed')
    assert.equal(again.assumed?.breakGlass, first.assumed?.breakGlass, 'detected answers are recomputed to the same result')
  }
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
  const state = applyDetectedDefaults(emptyMappingState(snapshot.tenantId), snapshot, { knownGroups: [] })
  assert.deepEqual(state.breakGlassUserIds, [])
  assert.equal(state.assumed?.breakGlass, 'noneFound')
  assert.equal(state.records['__breakGlassMissing']?.doesNotExist, true)
  assert.equal(state.wizardAnswered.breakGlass, true, 'none found is an answer, not a question')
})

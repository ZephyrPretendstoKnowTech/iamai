// v1.1 T1-2: the one reading of the countries a work-countries list leaves out
// that people sign in from (countriesLockout.ts), the answer that marks one left
// out on purpose (decisions.ts), the plan file that carries it (plan.ts), and the
// Work countries decision's list (ui/surfaces/countriesDecision.ts).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fixture } from './fixtures/index.ts'
import { fixtureSnapshot } from '../testing/uiSnapshot.ts'
import { emptyMappingState } from '../mapping/types.ts'
import { applyStepDecisions } from './decisions.ts'
import { PREREQ_STEP_ID } from './stepIds.ts'
import { buildPlanFile, parsePlanFile } from './plan.ts'
import { BLOCKED_REASON, BLOCKED_REASON_MAX_WORDS } from '../copy/reasons.ts'
import { COUNTRIES_LEFT_OUT_ANSWER, adminCountriesLeftOut, countriesLockout, countriesLockoutWait, parseCountryCodes, seenCountriesLeftOut } from './countriesLockout.ts'
import { initialLeftOut, leftOutAnswers, leftOutOptions } from '../ui/surfaces/countriesDecision.ts'

const LOCATION = PREREQ_STEP_ID.allowedCountries

test('the countries left out that people sign in from: administrators first, each with who; one marked left out on purpose, or allowed, is gone; nothing read is nothing said', () => {
  const f = fixture('demo')
  const s = f.snapshot
  const admins = Object.keys(s.roles.active).filter((id) => (s.signInEvidence[id]?.countries ?? []).includes('AU'))
  assert.ok(admins.length > 0, 'the premise: an administrator signs in from Australia')
  {
    const out = countriesLockout(s, { allowedCountries: ['NZ'] })
    assert.equal(out[0]?.code, 'AU')
    assert.deepEqual(new Set(out[0].adminIds), new Set(admins))
    assert.equal(out[0].people, s.evidenceAggregates!.byCountry.AU)
  }
  assert.deepEqual(countriesLockout(s, { allowedCountries: ['NZ'], countriesLeftOut: ['au'] }), [], 'a country marked left out on purpose still holds')
  assert.deepEqual(countriesLockout(s, { allowedCountries: ['AU'] }), [], 'an allowed country holds')
  // Nothing to read decides nothing: no administrator's sign-in with a country, no counts by country.
  const blind = structuredClone(s)
  for (const id of Object.keys(blind.roles.active)) if (blind.signInEvidence[id]) blind.signInEvidence[id].countries = []
  ;(blind.evidenceAggregates as { byCountry: unknown }).byCountry = null
  assert.equal(adminCountriesLeftOut(blind, ['NZ']), null)
  assert.equal(seenCountriesLeftOut(blind, ['NZ']), null)
  assert.deepEqual(countriesLockout(blind, { allowedCountries: ['NZ'] }), [])
  // The step's words: the country, who, and the two ways to clear it.
  const wait = countriesLockoutWait(countriesLockout(s, { allowedCountries: ['NZ'] }), (id) => `Name-${id}`)
  for (const words of ['Australia', `Name-${admins[0]}`, 'Work countries', 'Left out on purpose', 'Save Countries']) assert.ok(wait.includes(words), wait)
})

test('the row names one to three countries within twelve words, more by count', () => {
  assert.equal(BLOCKED_REASON.countriesLeftOut(['Australia']), 'until Australia is added or marked left out on purpose')
  assert.equal(BLOCKED_REASON.countriesLeftOut(['Australia', 'Fiji']), 'until Australia and Fiji are added or marked left out on purpose')
  for (const names of [['United States', 'United Kingdom', 'New Zealand'], ['A', 'B', 'C', 'D']]) {
    const r = BLOCKED_REASON.countriesLeftOut(names)
    assert.equal(r, `until ${names.length} countries are added or marked left out on purpose`)
    assert.ok(r.split(/\s+/).length <= BLOCKED_REASON_MAX_WORDS, r)
  }
})

test('Save Countries saves the countries left out on purpose with the countries: only a person\'s save, never one it allows, and a save without them clears them', () => {
  const base = emptyMappingState('t-1')
  const at = '2026-10-03T00:00:00.000Z'
  const saved = applyStepDecisions(base, { [LOCATION]: { picked: ['NZ'], at, answers: { [COUNTRIES_LEFT_OUT_ANSWER]: 'au, NZ, nonsense, AU' } } })
  assert.deepEqual(saved.allowedCountries, ['NZ'])
  assert.deepEqual(saved.countriesLeftOut, ['AU'], 'an allowed country, a repeat or a non-code is kept as left out')
  assert.equal(Object.keys(saved.questionAnswers ?? {}).some((k) => k.endsWith(`:${COUNTRIES_LEFT_OUT_ANSWER}`)), false, 'the list is stored twice')
  // A detection never writes one.
  assert.equal(applyStepDecisions(base, { [LOCATION]: { picked: ['NZ'], at, answers: { [COUNTRIES_LEFT_OUT_ANSWER]: 'AU' } } }, 'detected').countriesLeftOut, undefined)
  // A later save with none clears them; one with no answers at all (an older save) leaves them.
  assert.equal(applyStepDecisions(saved, { [LOCATION]: { picked: ['NZ'], at, answers: { [COUNTRIES_LEFT_OUT_ANSWER]: '' } } }).countriesLeftOut, undefined)
  assert.deepEqual(applyStepDecisions(saved, { [LOCATION]: { picked: ['NZ'], at } }).countriesLeftOut, ['AU'])
  assert.deepEqual(parseCountryCodes(' fj ,AU,AU'), ['FJ', 'AU'])
})

test('a plan file carries the countries left out on purpose, and refuses a list that is not country codes or that allows one of them', () => {
  const snapshot = fixtureSnapshot()
  const mapping = { ...emptyMappingState(snapshot.tenantId), allowedCountries: ['NZ'], countriesLeftOut: ['AU'] }
  const file = buildPlanFile({ planId: 'countries-plan', snapshot, operator: { userId: 'u-1', userPrincipalName: 'alex@example.com' }, baselineSource: { kind: 'upload', fileName: 'synthetic.json' }, mapping, steps: [], checkpoints: [] })
  const restored = parsePlanFile(JSON.stringify(file))
  assert.equal(restored.error, null)
  assert.deepEqual(restored.plan?.mappings.countriesLeftOut, ['AU'])
  for (const bad of [['Australia'], [3], 'AU', ['NZ']]) {
    const broken = structuredClone(file) as { mappings: Record<string, unknown> }
    broken.mappings.countriesLeftOut = bad
    assert.match(parsePlanFile(JSON.stringify(broken)).error ?? '', /invalid countries left out/, JSON.stringify(bad))
  }
})

test('the Work countries decision offers every country in use that the countries picked now leave out, ticked as saved, and saves only the ticks still offered', () => {
  const s = fixture('demo').snapshot
  const offered = leftOutOptions(s, ['NZ'])
  assert.deepEqual(offered.map((o) => o.code), ['AU'])
  assert.match(offered[0].label, /^Australia · \d+ people, \d+ administrators?$/)
  assert.deepEqual(leftOutOptions(s, ['NZ', 'AU']), [], 'a country added above is still offered')
  assert.deepEqual(initialLeftOut({ answers: { [COUNTRIES_LEFT_OUT_ANSWER]: 'AU' } }, { countriesLeftOut: ['FJ'] }), ['AU'], 'the saved decision is not what opens')
  assert.deepEqual(initialLeftOut(null, { countriesLeftOut: ['FJ'] }), ['FJ'])
  assert.deepEqual(leftOutAnswers(['AU', 'FJ'], offered), { [COUNTRIES_LEFT_OUT_ANSWER]: 'AU' }, 'a tick no longer offered is saved')
})

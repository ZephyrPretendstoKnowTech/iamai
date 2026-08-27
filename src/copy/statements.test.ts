import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  findingsSummary,
  inPlaceStatement,
  missingStatement,
  partialControlStatement,
  partialScopeStatement,
  reportOnlyStatement,
  roadmapOverview,
  share,
} from './statements.ts'
import type { FindingsSummaryInput } from './statements.ts'

const base: FindingsSummaryInput = {
  tenant: 'Contoso',
  enabledPolicies: 4,
  baselineLabel: 'Baseline',
  baselinePolicies: 30,
  inPlace: 3,
  partly: 2,
  missing: 5,
  scored: 10,
  users: 40,
  active: 20,
  readyPercent: 60,
  noMethod: 2,
  notChallenged: 3,
  challengedRate: 0.4,
  working: ['require MFA for all users'],
  fixFirst: ['block legacy authentication'],
  licenceLimited: 0,
}

test('summary at 100% challenged never says "only"', () => {
  const text = findingsSummary({ ...base, challengedRate: 1, readyPercent: 100 }).join(' ')
  assert.doesNotMatch(text, /only/i)
  assert.doesNotMatch(text, /untested/i)
  assert.match(text, /All 20 active users could complete MFA today/)
  assert.match(text, /well tested/)
})

test('summary at 0% challenged and 0% ready', () => {
  const text = findingsSummary({ ...base, challengedRate: 0, readyPercent: 0 }).join(' ')
  assert.match(text, /None of the 20 active users could complete MFA today/)
  assert.match(text, /No user active .* completed MFA/)
  assert.doesNotMatch(text, /0%/)
})

test('summary with n=1 everywhere reads grammatically', () => {
  const text = findingsSummary({
    ...base,
    enabledPolicies: 1,
    inPlace: 1,
    partly: 0,
    missing: 0,
    scored: 1,
    users: 1,
    active: 1,
    readyPercent: 100,
    noMethod: 1,
    notChallenged: 0,
    challengedRate: null,
    licenceLimited: 1,
  }).join(' ')
  assert.match(text, /1 enabled Conditional Access policy with/)
  assert.match(text, /All 1 security goal is in place/)
  assert.match(text, /1 user in the directory/)
  assert.match(text, /1 user has no MFA method/)
  assert.match(text, /1 goal needs a licence/)
  assert.doesNotMatch(text, /1 users|1 goals|1 policies/)
})

test('summary with no active users does not divide by zero in prose', () => {
  const text = findingsSummary({ ...base, active: 0, readyPercent: 0, challengedRate: null }).join(' ')
  assert.match(text, /cannot be measured yet/)
})

test('share branches: none, one, all', () => {
  assert.equal(share(0, 5, 'member'), 'none of the 5 members')
  assert.equal(share(1, 1, 'member'), 'the only member')
  assert.equal(share(5, 5, 'member'), 'all 5 members')
  assert.equal(share(2, 5, 'member'), '2 of 5 members')
})

test('statement shapes', () => {
  assert.equal(inPlaceStatement('Require MFA', ['A', 'B'], 0), '**Require MFA**. Delivered by *A* and *B*.')
  assert.equal(inPlaceStatement('Require MFA', ['A'], 2), '**Require MFA**. Delivered by *A*. 2 accounts excluded as break-glass.')
  assert.equal(
    partialControlStatement('Admin sessions', 'MFA', 'phishing-resistant MFA', 3, 4, 'admin'),
    '**Admin sessions** — the current policy requires MFA; the baseline expects phishing-resistant MFA. 3 of 4 admins affected.',
  )
  assert.equal(
    partialScopeStatement('Guests need MFA', 0, 1, 'guest', [{ reason: 'never targeted', count: 1 }]),
    '**Guests need MFA** applies to none of the 1 guest. Not covered: never targeted (1).',
  )
  assert.equal(missingStatement('Block legacy authentication', 'CA001'), "**Block legacy authentication**. No policy does this yet. The baseline's policy for it: *CA001*.")
  assert.equal(reportOnlyStatement('Require MFA', 'CA002', 9, 0), '**Require MFA** is in report-only via *CA002* (9 days, no would-be failures).')
  assert.equal(reportOnlyStatement('Require MFA', 'CA002', 1, 1), '**Require MFA** is in report-only via *CA002* (1 day, 1 would-be failure).')
})

test('roadmap overview branches', () => {
  assert.equal(
    roadmapOverview({ tenant: 'Contoso', done: 11, total: 31, pace: 'standard', finishes: 'in 27 days · Sep 23, 2026', weeks: 4 }),
    'Contoso: 11 of 31 steps already in place. 20 remain. With a standard pace, the plan finishes in 27 days · Sep 23, 2026 (4 weeks).',
  )
  assert.match(roadmapOverview({ tenant: 'C', done: 5, total: 5, pace: 'standard', finishes: 'x', weeks: 1 }), /all 5 steps are already in place\. Nothing remains\.$/)
  assert.match(roadmapOverview({ tenant: 'C', done: 0, total: 1, pace: 'standard', finishes: 'x', weeks: 1 }), /none of the 1 step is in place yet\. 1 remains\./)
})

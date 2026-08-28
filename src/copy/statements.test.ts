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
  scheduleOverrun,
  scheduleRationale,
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
  rollout: { enabled: 36, proven: 20, noMethod: 6, unproven: 10, toSetUp: 16 },
  working: ['require MFA for all users'],
  fixFirst: ['block legacy authentication'],
  licenceLimited: 0,
}

test('summary: everyone proven never claims enforcement is tested, and names nobody to set up', () => {
  const text = findingsSummary({ ...base, rollout: { enabled: 36, proven: 36, noMethod: 0, unproven: 0, toSetUp: 0 } }).join(' ')
  assert.match(text, /Every one of the 36 enabled users proved MFA in the last 30 days: nobody needs setting up before enforcement/)
  assert.doesNotMatch(text, /tested/i, 'enforcement is only called tested by report-only evidence')
  assert.doesNotMatch(text, /only/i)
})

test('summary: nobody proven lists both gaps and the whole count to set up', () => {
  const text = findingsSummary({ ...base, rollout: { enabled: 36, proven: 0, noMethod: 6, unproven: 30, toSetUp: 36 } }).join(' ')
  assert.match(text, /None of the 36 enabled users proved MFA/)
  assert.match(text, /6 users have no MFA method and 30 users are registered but unproven: all 36 need setting up/)
  assert.doesNotMatch(text, /0%/)
})

test('summary: the mixed case carries count, share and the gaps, over enabled users', () => {
  const text = findingsSummary(base).join(' ')
  assert.match(text, /20 of 36 enabled users \(56%\) proved MFA in the last 30 days/)
  assert.match(text, /6 users have no MFA method and 10 users are registered but unproven: 16 users to set up before enforcement/)
  assert.doesNotMatch(text, /active users could complete MFA/)
  assert.doesNotMatch(text, /challenged/)
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
    rollout: { enabled: 1, proven: 0, noMethod: 1, unproven: 0, toSetUp: 1 },
    licenceLimited: 1,
  }).join(' ')
  assert.match(text, /1 enabled Conditional Access policy with/)
  assert.match(text, /All 1 security goal is in place/)
  assert.match(text, /1 user in the directory/)
  assert.match(text, /1 user has no MFA method: all 1 need setting up/)
  assert.match(text, /1 goal needs a licence/)
  assert.doesNotMatch(text, /1 users|1 goals|1 policies/)
})

test('summary with no active users does not divide by zero in prose', () => {
  const text = findingsSummary({ ...base, active: 0, rollout: { enabled: 0, proven: 0, noMethod: 0, unproven: 0, toSetUp: 0 } }).join(' ')
  assert.match(text, /cannot be drawn/)
})

test('share branches: none, one, all', () => {
  assert.equal(share(0, 5, 'member'), 'none of the 5 members')
  assert.equal(share(1, 1, 'member'), 'the only member')
  assert.equal(share(5, 5, 'member'), 'all 5 members')
  assert.equal(share(2, 5, 'member'), '2 of 5 members')
})

test('statement shapes', () => {
  assert.equal(inPlaceStatement('Require MFA', ['A', 'B'], 0), '**Require MFA**. Delivered by *A* and *B*.')
  assert.equal(inPlaceStatement('Require MFA', ['A'], 2), '**Require MFA**. Delivered by *A*, with 2 break-glass accounts excluded.')
  assert.equal(
    partialControlStatement('Admin sessions', 'MFA', 'phishing-resistant MFA', 3, 4, 'admin'),
    '**Admin sessions**: the current policy requires MFA; the baseline expects phishing-resistant MFA. 3 of 4 admins affected.',
  )
  assert.equal(
    partialScopeStatement('Guests need MFA', 0, 1, 'guest', [{ reason: 'never targeted', count: 1 }]),
    '**Guests need MFA** applies to none of the 1 guest. Not covered: never targeted (1).',
  )
  assert.equal(missingStatement('Block legacy authentication', null, 'CA001'), '**Block legacy authentication**. No policy does this yet.')
  assert.equal(
    missingStatement('Block legacy authentication', 'CA - GLOBAL - Block legacy authentication', 'ACME - GLOBAL - BLOCK - LegacyAuth'),
    "**Block legacy authentication**. No policy does this yet. Proposed: *CA - GLOBAL - Block legacy authentication* (from the baseline's *ACME - GLOBAL - BLOCK - LegacyAuth*).",
  )
  assert.equal(reportOnlyStatement('Require MFA', 'CA002', 9, 0), '**Require MFA** is in report-only via *CA002* (9 days, no would-be failures).')
  assert.equal(reportOnlyStatement('Require MFA', 'CA002', 1, 1), '**Require MFA** is in report-only via *CA002* (1 day, 1 would-be failure).')
})

test('no finding statement runs past two sentences (prompt 17 §5)', () => {
  const sentences = (s: string) => s.replace(/\*\*?[^*]+\*\*?/g, 'x').split(/\.\s+(?=[A-Z])/).filter(Boolean).length
  const samples = [
    inPlaceStatement('Require MFA', ['A', 'B'], 2),
    partialControlStatement('Admin sessions', 'MFA', 'phishing-resistant MFA', 3, 4, 'admin'),
    partialScopeStatement('Guests need MFA', 2, 5, 'guest', [{ reason: 'never targeted', count: 2 }, { reason: 'excluded', count: 1 }]),
    missingStatement('Block legacy authentication', null, 'CA001'),
    reportOnlyStatement('Require MFA', 'CA002', 9, 0),
  ]
  for (const s of samples) assert.ok(sentences(s) <= 2, s)
})

test('schedule rationale branches on campaigns, observation, and Setup waits', () => {
  assert.equal(
    scheduleRationale({ weeks: 4, campaigns: 1, verificationDays: 14, observationDays: 7, waves: 3, waitingOnSetup: 2 }),
    '4 weeks: a 2-week verification campaign, 7-day observation window, 3 enforcement waves, 2 steps waiting on Setup.',
  )
  assert.equal(
    scheduleRationale({ weeks: 1, campaigns: 0, verificationDays: 0, observationDays: 0, waves: 1, waitingOnSetup: 0 }),
    '1 week: no verification campaign needed, no observation window, 1 enforcement wave.',
  )
  assert.equal(scheduleOverrun('small', 4, 6, ['Unknown platforms blocked']), 'Two weeks longer than a typical small tenant. 1 step extends it: Unknown platforms blocked.')
  assert.equal(scheduleOverrun('small', 4, 5, [], 2), 'One week longer than a typical small tenant, because the verification campaign needs two weeks.')
  const many = scheduleOverrun('mid', 8, 10, ['A', 'B', 'C', 'D', 'E', 'F', 'G'])
  assert.match(many, /7 steps extend it: A, B, C, D, and E and 2 more\.$|7 steps extend it: A, B, C, D and E and 2 more\.$/)
})

test('roadmap overview branches', () => {
  assert.equal(
    roadmapOverview({ tenant: 'Contoso', done: 11, total: 31, pace: 'standard', finishes: 'in 27 days · Sep 23, 2026', weeks: 4 }),
    'Contoso: 11 of 31 steps already in place. 20 remain. With a standard pace, the plan finishes in 27 days · Sep 23, 2026 (4 weeks).',
  )
  assert.match(roadmapOverview({ tenant: 'C', done: 5, total: 5, pace: 'standard', finishes: 'x', weeks: 1 }), /all 5 steps are already in place\. Nothing remains\.$/)
  assert.match(roadmapOverview({ tenant: 'C', done: 0, total: 1, pace: 'standard', finishes: 'x', weeks: 1 }), /none of the 1 step is in place yet\. 1 remains\./)
})

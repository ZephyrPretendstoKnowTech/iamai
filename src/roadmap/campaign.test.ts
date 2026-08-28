// ux-review-04 §2, prompt 21 §A5: the verification campaign is required
// whenever any enabled user still has to be set up, and the Overview, the
// blocked-step reasons and the pace all read from that one number. This
// fails if the Overview says no campaign is needed while such a user exists.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fixtureBaseline, fixtureSnapshot } from '../ui/pages/fixtureSnapshot.ts'
import { computeCoverage } from '../coverage/coverage.ts'
import { buildStrengthLookup } from '../coverage/strength.ts'
import { buildViabilityInputs } from '../scoring/fromSnapshot.ts'
import { scoreMfaViability, summarizeTenant } from '../scoring/mfaViability.ts'
import { generateRoadmap } from './generate.ts'
import { emptyMappingState } from '../mapping/types.ts'
import { buildQuestions } from '../mapping/questions.ts'
import { scheduleRationale } from '../copy/statements.ts'
import type { TenantSnapshot } from '../graph/collect/types.ts'

function plan(snapshot: TenantSnapshot) {
  const baseline = fixtureBaseline()
  const strengths = buildStrengthLookup(snapshot.config.authStrengths?.rows ?? [])
  const viability = buildViabilityInputs(snapshot, snapshot.asOf).map(scoreMfaViability)
  const coverage = computeCoverage({
    snapshot,
    tenantPolicies: snapshot.config.caPolicies?.rows ?? [],
    baselinePolicies: baseline.pkg.policies,
    baselineUnusable: [],
    strengths,
    groupMembers: new Map(),
  })
  const { steps, schedule } = generateRoadmap({
    planId: 'campaign-test',
    coverage,
    snapshot,
    baseline: baseline.pkg,
    baselineAuthor: null,
    mapping: emptyMappingState(snapshot.tenantId),
    questions: buildQuestions(baseline.pkg),
    viability,
    strengths,
  })
  const rollout = summarizeTenant(viability).rollout
  const rationale = scheduleRationale({
    weeks: schedule.weeks,
    campaigns: schedule.verification.days > 0 ? 1 : 0,
    verificationDays: schedule.verification.days,
    observationDays: schedule.observation.days,
    waves: schedule.waves.filter((w) => w.wave > 0).length,
    waitingOnSetup: 0,
  })
  return { steps, schedule, rollout, rationale, verify: steps.find((s) => s.kind === 'verify') }
}

test('someone to set up: the campaign is a live step, the pace includes it, the Overview never says none needed', () => {
  const p = plan(fixtureSnapshot())
  assert.ok(p.rollout.toSetUp > 0, 'the fixture has enabled users without a proven method')
  assert.ok(p.verify, 'a verification campaign step exists')
  assert.notEqual(p.verify.status, 'done')
  assert.ok(p.schedule.verification.days > 0, 'the pace includes the campaign window')
  assert.doesNotMatch(p.rationale, /no verification campaign needed/)
  assert.match(p.rationale, /verification campaign/)
  assert.match(p.verify.impact, new RegExp(`${p.rollout.toSetUp} enabled users?`), 'the campaign impact counts the same people')
})

test('everyone proven: the campaign is done, the pace skips it, and the Overview says so', () => {
  const s = fixtureSnapshot()
  // Every enabled user has a method and an MFA success inside the window.
  for (const u of s.users) {
    s.signInEvidence[u.id] = { signInCount: 5, lastSignIn: s.asOf, lastMfaSuccess: { at: s.asOf, method: 'Mobile app notification' } }
    u.lastSuccessfulSignIn = s.asOf
    s.authMethods[u.id] = [{ kind: 'microsoftAuthenticator', phoneAppVersion: '6.2508.0' }]
  }
  for (const r of s.registrationDetails) {
    r.isMfaCapable = true
    r.isMfaRegistered = true
    r.methodsRegistered = ['microsoftAuthenticatorPush']
  }
  const p = plan(s)
  assert.equal(p.rollout.toSetUp, 0)
  assert.ok(p.verify)
  assert.equal(p.verify.status, 'done')
  assert.equal(p.schedule.verification.days, 0)
  assert.match(p.rationale, /no verification campaign needed/)
})

test('a disabled account never counts: it is neither proven nor to set up', () => {
  const s = fixtureSnapshot()
  const disabled = s.users.find((u) => u.id === 'u-3')
  assert.ok(disabled)
  disabled.accountEnabled = false
  const before = summarizeTenant(buildViabilityInputs(fixtureSnapshot(), s.asOf).map(scoreMfaViability)).rollout
  const after = summarizeTenant(buildViabilityInputs(s, s.asOf).map(scoreMfaViability)).rollout
  assert.equal(after.enabled, before.enabled - 1)
  assert.equal(after.noMethod, before.noMethod - 1, 'u-3 had no method and is now out of the picture')
  assert.equal(after.proven + after.toSetUp, after.enabled, 'the buckets still sum to the enabled users')
})

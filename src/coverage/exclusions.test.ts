// ux-review-05 §1 and §4, prompt 22 §1 and §3: answering Setup must never
// lower coverage for an exclusion the answers themselves justify, and the
// admin population is one set everywhere.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fixtureBaseline, fixtureSnapshot } from '../ui/pages/fixtureSnapshot.ts'
import { computeCoverage } from './coverage.ts'
import { buildStrengthLookup } from './strength.ts'
import type { GroupMembers } from './population.ts'
import { resolvePopulation } from './population.ts'
import { adminUserIds } from '../roles.ts'
import { buildViabilityInputs } from '../scoring/fromSnapshot.ts'
import { scoreMfaViability } from '../scoring/mfaViability.ts'
import { generateRoadmap } from '../roadmap/generate.ts'
import { readinessFor } from '../roadmap/readiness.ts'
import { emptyMappingState } from '../mapping/types.ts'
import { buildQuestions } from '../mapping/questions.ts'
import { suggestForWizard } from '../mapping/wizardSuggest.ts'
import type { TenantSnapshot } from '../graph/collect/types.ts'

const BG_GROUP = 'g-breakglass-exclusion'

/** The reviewed tenant's shape: every policy excludes a group whose only member is the break-glass account. */
function tenantWithExclusionGroup(): { snapshot: TenantSnapshot; groups: GroupMembers } {
  const s = fixtureSnapshot()
  for (const raw of s.config.caPolicies?.rows ?? []) {
    const p = raw as { conditions: { users: { excludeUsers?: string[]; excludeGroups?: string[] } } }
    delete p.conditions.users.excludeUsers
    p.conditions.users.excludeGroups = [BG_GROUP]
  }
  const groups: GroupMembers = new Map([[BG_GROUP, { memberIds: ['u-4'], memberCount: 1, sampled: false, displayName: 'Breakglass Exclusion' }]])
  return { snapshot: s, groups }
}

function coverage(snapshot: TenantSnapshot, groups: GroupMembers, mapping?: { breakGlassUsers: string[]; exclusionGroups: Record<string, string>; confirmed: boolean }) {
  const baseline = fixtureBaseline()
  return computeCoverage({
    snapshot,
    tenantPolicies: snapshot.config.caPolicies?.rows ?? [],
    baselinePolicies: baseline.pkg.policies,
    baselineUnusable: [],
    strengths: buildStrengthLookup(snapshot.config.authStrengths?.rows ?? []),
    groupMembers: groups,
    mapping,
  })
}

test('answering Setup never lowers coverage for an exclusion the answers justify', () => {
  const { snapshot, groups } = tenantWithExclusionGroup()
  const before = coverage(snapshot, groups)
  // Question 1 answered (break-glass = u-4), question 2 answered "does not exist yet".
  const after = coverage(snapshot, groups, { breakGlassUsers: ['u-4'], exclusionGroups: {}, confirmed: true })
  const status = (r: ReturnType<typeof coverage>) => new Map(r.results.map((x) => [x.goal.id, x.status]))
  const b = status(before)
  const a = status(after)
  const regressed = [...b].filter(([id, st]) => st === 'enforced' && a.get(id) !== 'enforced').map(([id]) => id)
  assert.deepEqual(regressed, [], 'goals in place before Setup must stay in place after it')
  assert.ok(before.summary.enforced > 0, 'the fixture has goals in place')
  assert.equal(after.summary.enforced, before.summary.enforced)
  // The exclusion is expected, and the reason says so with the group's name.
  const mfa = after.results.find((r) => r.goal.id === 'mfa-all-users')
  assert.ok(mfa)
  assert.equal(mfa.status, 'enforced')
  const ex = mfa.reasons.find((r) => r.kind === 'excluded')
  assert.ok(ex && ex.expected, 'the break-glass-only group is an expected exclusion')
  assert.match(ex.detail, /Breakglass Exclusion/)
  assert.doesNotMatch(ex.detail, /assumed/, 'confirmed answers carry no "assumed" note')
})

test('Setup question 2 suggests the break-glass-only group first, with the evidence line', () => {
  const { snapshot, groups } = tenantWithExclusionGroup()
  const g = groups.get(BG_GROUP)!
  const out = suggestForWizard('globalExclusion', {
    snapshot,
    tenantPolicies: snapshot.config.caPolicies?.rows ?? [],
    knownGroups: [{ tenantId: snapshot.tenantId, groupId: BG_GROUP, displayName: g.displayName ?? null, membershipRule: null, memberCount: 1, memberIds: g.memberIds, sampled: false, asOf: snapshot.asOf }],
    breakGlassUserIds: ['u-4'],
  })
  assert.ok(out.length > 0, 'a suggestion is offered')
  assert.equal(out[0].id, BG_GROUP)
  assert.equal(out[0].rank, 0)
  assert.equal(out[0].why, 'only member is Break-glass 01, your confirmed emergency access account')
})

test('one admin population: Findings, step populations, readiness and the admin catalogue agree', () => {
  const s = fixtureSnapshot()
  // A second user with a non-admin directory role must not count as an admin.
  s.roles.active['u-2'] = ['88d8e3e3-8f55-4a1e-953a-9b9898b8876b'] // Directory Readers
  const admins = adminUserIds(s.roles)
  assert.deepEqual([...admins], ['u-1'])
  const viability = buildViabilityInputs(s, s.asOf).map(scoreMfaViability)
  const baseline = fixtureBaseline()
  const strengths = buildStrengthLookup(s.config.authStrengths?.rows ?? [])
  const report = computeCoverage({ snapshot: s, tenantPolicies: s.config.caPolicies?.rows ?? [], baselinePolicies: baseline.pkg.policies, baselineUnusable: [], strengths, groupMembers: new Map() })
  const adminGoal = report.results.find((r) => r.goal.id === 'admins-phishing-resistant')
  assert.ok(adminGoal)
  assert.equal(adminGoal.expectedCount, admins.size, 'Findings counts the same admins')
  assert.equal(resolvePopulation({ kind: 'coreAdmins' }, s).ids.size, admins.size)
  const { steps } = generateRoadmap({ planId: 'p', coverage: report, snapshot: s, baseline: baseline.pkg, baselineAuthor: null, mapping: emptyMappingState(s.tenantId), questions: buildQuestions(baseline.pkg), viability, strengths })
  const allUsers = steps.find((x) => x.goalId === 'mfa-all-users')
  assert.ok(allUsers)
  assert.equal(allUsers.population.admins, admins.size, 'step populations count the same admins')
  const adminStep = steps.find((x) => x.goalId === 'admins-phishing-resistant')
  assert.ok(adminStep)
  assert.deepEqual([...adminStep.population.ids].sort(), [...admins].sort())
  const readiness = readinessFor('admins-phishing-resistant', [...admins], viability, s)
  assert.equal(readiness.percent, adminStep.readiness.percent, 'the blocked reason reads the same readiness')
})

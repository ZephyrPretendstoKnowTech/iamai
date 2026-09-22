// Task 003 — the Plan must plan against the baseline IAMAI actually pins, not a
// resemblance of it. Every assertion below runs against the shipped pinned
// package, so a re-pin or a classifier change that loses a source policy, remaps
// a goal by display name, drops a resource exclusion, or promotes an unresolved
// semantic to full coverage fails here rather than on a technician's tenant.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import pinnedJson from '../../baselines/jhope188-conditionalaccesspolicies.pinned.json' with { type: 'json' }
import firstParty from '../../data/first-party-apps.json' with { type: 'json' }
import { PINNED, pinnedPackage } from '../baseline/pinned.ts'
import { runBaselineValidators } from '../baseline/validators.ts'
import { PINNED_GOAL_MAP, goalMapFor, policiesForGoal, policyKey } from '../roadmap/goalMap.ts'
import { baselineConflicts, inBaselineConflict } from '../roadmap/baselineConflict.ts'
import { fixture } from '../roadmap/fixtures/index.ts'
import { runFixture } from '../roadmap/fixtures/run.ts'
import { policyResult } from '../roadmap/operations.ts'
import { nextMilestone } from '../roadmap/lifecycle.ts'
import { CATALOGUE, computeCoverage } from './coverage.ts'
import type { CoverageInput } from './coverage.ts'
import { buildStrengthLookup } from './strength.ts'
import type { GroupMembers } from './population.ts'
import type { CaPolicy } from '../baseline/types.ts'
import type { TenantSnapshot } from '../graph/collect/types.ts'
import type { Step } from '../roadmap/types.ts'

const PINNED_POLICIES = pinnedJson.policies as unknown as CaPolicy[]
const GA = '62e90394-69f5-4237-9190-012177145e10'
const PR_STRENGTH = '00000000-0000-0000-0000-000000000004'
/** Microsoft Intune Enrollment: the one application the pinned MFA-all-users policy leaves out. */
const INTUNE_ENROLMENT = 'd4ebce55-015a-49b5-a083-c84d1797ae8c'
/** The author's four Microsoft first-party exclusions on the Admin Portal policy, which task 020 taught the pin to keep. */
const ADMIN_PORTAL_APPS = [
  '00000002-0000-0000-c000-000000000000',
  '0000000c-0000-0000-c000-000000000000',
  '1b912ec3-a9dd-4c4d-a53e-76aa7adb28d7',
  '8c59ead7-d703-4a27-9e55-c96a0054c8d2',
]
/** Any other first-party application id, to stand for an exclusion the baseline does not make. */
const OTHER_APP = 'cc15fd57-2c6c-4117-a88c-83b1d56b4bbe'

// ---------------------------------------------------------------- 1. inventory

test('every pinned source policy is accounted for: mapped, a variant, or an unmapped Cleanup row', () => {
  const built = goalMapFor(PINNED_POLICIES, new Map())
  const keys = PINNED_POLICIES.map((p) => policyKey(p))
  assert.equal(new Set(keys).size, keys.length, 'two pinned policies share a stable key, so one can stand in for the other')

  const mapped = new Set(Object.values(built.map).flat())
  const variants = new Set(built.variants.map((v) => v.policy))
  const unmapped = new Set(built.unmappedPolicies)
  const missed: string[] = []
  for (const p of PINNED_POLICIES) {
    const key = policyKey(p)
    if (mapped.has(key) || variants.has(p.displayName) || unmapped.has(p.displayName)) continue
    missed.push(p.displayName)
  }
  assert.deepEqual(missed, [], 'a pinned policy is in no bucket at all — it would disappear silently')
  assert.equal(mapped.size + variants.size + unmapped.size, PINNED_POLICIES.length, 'the buckets do not partition the pinned set')
  assert.equal(built.ties.length, 0, 'a tie maps nothing, so its policy would carry no consequence')
})

test('the product plans against the same number of policies the pin holds', () => {
  const pkg = pinnedPackage()
  assert.equal(pkg.policies.length, PINNED_POLICIES.length, 'the loaded package dropped or added a policy against pinned truth')
  assert.equal(pkg.report.considered, PINNED_POLICIES.length)
  assert.equal(pkg.report.parsed, PINNED_POLICIES.length)
  assert.deepEqual(pkg.report.skipped, [], 'a pinned policy was skipped at load')
  assert.deepEqual(pkg.report.errors, [], 'a pinned policy failed to parse')
  assert.deepEqual(pkg.report.duplicates, [], 'two pinned policies deduped into one')
  // The count the Connect tile shows is this one, so the count and the pin agree.
  assert.equal(pkg.policies.length, 38, 'the pinned baseline holds 38 policies; reconcile the product copy before changing this')
})

test('the pin the product reports is the commit the plan was derived from', async () => {
  const { loadPinnedBaseline } = await import('../ui/baseline.ts')
  const result = await loadPinnedBaseline()
  assert.equal(result.origin.kind, 'github')
  assert.equal(result.origin.kind === 'github' ? result.origin.commit : null, PINNED.commit, 'the loaded baseline names a commit other than the one its policies came from')
  // One source for one fact: the index file records the previous pin's commit
  // and its file list, so nothing that reports the plan's provenance may read it.
  const exportSource = readFileSync('src/ui/surfaces/Export.tsx', 'utf8')
  assert.equal(/baselineIndex/.test(exportSource), false, 'Export builds a plan pin from the index file, which is not the commit the plan read')
})

// ------------------------------------------------- 2. stable source identity

test('renaming and reordering the pinned policies does not remap a goal', () => {
  // Every policy that carries an id is renamed, and the whole set is reversed.
  // The two policies the author exported without an id keep their name, because
  // the name is the only stable key they have.
  const disguised = [...PINNED_POLICIES].reverse().map((p, i) => (p.id ? { ...p, displayName: `Renamed policy ${i}` } : p))
  const built = goalMapFor(disguised as CaPolicy[], new Map())
  assert.deepEqual(built.map, PINNED_GOAL_MAP, 'goal identity followed the display names, not the stable source identity')
})

test('the runtime reads the stored map rather than matching at render time', () => {
  for (const [goalId, keys] of Object.entries(PINNED_GOAL_MAP)) {
    for (const k of keys) assert.ok(PINNED_POLICIES.some((p) => policyKey(p) === k), `${goalId} maps to ${k}, which is not a pinned policy`)
  }
  assert.equal(policiesForGoal(PINNED_GOAL_MAP, PINNED_POLICIES, 'mfa-all-users')[0]?.displayName, 'IAC - GLOBAL - GRANT - MFA - AllUsers')
})

// ------------------------------------------------- 3. the multi-policy goal

test('guests-mfa stays two distinct required members, and neither stands in for the other', () => {
  const pair = policiesForGoal(PINNED_GOAL_MAP, PINNED_POLICIES, 'guests-mfa')
  assert.equal(pair.length, 2, 'guests-mfa is a two-policy goal')
  assert.equal(pair[0].displayName, 'IAC - GLOBAL - GRANT - MFA - Mixed-Guests')
  assert.equal(pair[1].displayName, 'IAC - GLOBAL - GRANT - MFA - B2B-Guest')

  // And the step built from that pair asks for both, under two member keys.
  const f = fixture('demo-week2')
  ;(f.snapshot.config.caPolicies as { rows: unknown[] }).rows = []
  const step = runFixture(f).steps.find((s) => s.goalId === 'guests-mfa')
  assert.ok(step, 'the guests step is in the plan')
  const result = policyResult(step as never)
  assert.equal(result.kind, 'implementable')
  const ops = result.kind === 'implementable' ? result.operations : []
  assert.equal(ops.length, 2, 'one member disappeared because the other matched')
  assert.deepEqual(ops.map((o) => o.sourceName), pair.map((p) => p.displayName), 'the operations are not the pinned pair, in the pinned order')
  assert.equal(new Set(ops.map((o) => o.memberKey)).size, 2, 'both members share one key, so one artifact could satisfy both')
  assert.notDeepEqual(ops[0].body, ops[1].body, 'the two members submit the same body')
})

// ------------------------------------ 4. application / resource exclusions

test('every application exclusion in the pinned source is inventoried and kept', () => {
  const surviving: string[] = []
  for (const p of PINNED_POLICIES) {
    for (const a of p.conditions?.applications?.excludeApplications ?? []) surviving.push(`${p.displayName}: ${a}`)
    // The pinned source uses excludeApplications; a re-pin that starts using the
    // newer excludeResources shape must be read here before it is trusted.
    const apps = (p.conditions?.applications ?? {}) as Record<string, unknown>
    assert.equal(apps.excludeResources, undefined, `${p.displayName} uses excludeResources, which nothing in IAMAI reads`)
    assert.equal(apps.includeResources, undefined, `${p.displayName} uses includeResources, which nothing in IAMAI reads`)
    assert.equal(apps.applicationFilter, undefined, `${p.displayName} carries an application filter, which nothing in IAMAI evaluates`)
  }
  assert.deepEqual(
    surviving,
    [
      `IAC - GLOBAL - GRANT - MFA - AllUsers: ${INTUNE_ENROLMENT}`,
      ...ADMIN_PORTAL_APPS.map((a) => `IAC - ZTCA - GLOBAL – BLOCK – Admin Portal: ${a}`),
    ],
    'the pinned application exclusions changed; account for each one before changing this list',
  )

  // The exclusions the pin removed are recorded by policy and id, never dropped
  // without a record. Task 020 repaired the first-party registry and task 022's
  // re-pin is the first pin generated with it, so the author's four Admin Portal
  // exclusions now survive and one strip is left: an application id IAMAI does
  // not recognise, which is dropped because carrying somebody else's
  // registration into another tenant is the thing this boundary exists to stop.
  assert.equal(pinnedJson.stripped.length, 1, 'the pin-time strip list changed')
  assert.equal(pinnedJson.stripped.filter((s) => s.startsWith('IAC - ZTCA - GLOBAL – BLOCK – Admin Portal:')).length, 0, 'an Admin Portal exclusion was stripped again')
  assert.equal(pinnedJson.stripped.filter((s) => s.startsWith('IAC - GLOBAL - GRANT - MFA - AllUsers:')).length, 1)

  // Everything that survived is a Microsoft first-party application, so no
  // author-specific object reached the runtime; the validator that says so
  // still passes.
  const ids = new Set((firstParty as { apps: { appId: string }[] }).apps.map((a) => a.appId.toLowerCase()))
  assert.ok(ids.has(INTUNE_ENROLMENT), 'the surviving exclusion is not a first-party application')
  for (const a of ADMIN_PORTAL_APPS) assert.ok(ids.has(a), `${a} survived the pin and is not a first-party application`)
  assert.deepEqual(runBaselineValidators(PINNED_POLICIES).filter((v) => v.id === 'app-01'), [], 'an author-specific application exclusion survived the pin')
})

// -------------------------------------------------- tenant classification

function mkSnapshot(over: Partial<TenantSnapshot> = {}): TenantSnapshot {
  const users = Array.from({ length: 6 }, (_, i) => ({
    id: `u${i}`,
    displayName: `User ${i}`,
    userPrincipalName: `u${i}@x.test`,
    userType: 'member' as const,
    usageLocation: null,
    createdDateTime: '2024-01-01T00:00:00Z',
    lastSuccessfulSignIn: '2026-08-20T00:00:00Z',
    accountEnabled: true,
    mail: null,
    assignedPlans: [],
    onPremisesSyncEnabled: null,
    externalUserState: null,
    department: null,
    jobTitle: null,
    officeLocation: null,
  }))
  const caps = (enabled: boolean) => ({ enabled, seats: 10, consumed: 0 })
  return {
    schemaVersion: 1,
    tenantId: 't',
    asOf: '2026-08-26T00:00:00Z',
    sources: {} as TenantSnapshot['sources'],
    config: {} as TenantSnapshot['config'],
    registrationDetails: [],
    users,
    devices: [],
    spActivity: [],
    authMethods: {},
    appSignInSummary: [],
    signInEvidence: {},
    evidencePolicyResults: [],
    blockedToday: [],
    evidenceUsage: null,
    capabilities: {
      entraP1: caps(true),
      entraP2: caps(true),
      pim: caps(true),
      intune: caps(false),
      workloadIdPremium: caps(false),
      globalSecureAccess: caps(false),
      defenderForCloudApps: caps(false),
      purviewInsiderRisk: caps(false),
    },
    microsoftManagedPolicyIds: [],
    roles: { active: { u0: [GA] }, eligible: {} },
    ...over,
  }
}

type Raw = Record<string, unknown>

/** An enabled all-users, all-apps MFA policy: what the mfa-all-users goal expects. */
function mkTenantPolicy(over: Raw = {}, apps: Raw = {}, users: Raw = {}): Raw {
  return {
    id: `p-${String(over.displayName ?? 'x')}`,
    displayName: 'Tenant MFA',
    state: 'enabled',
    conditions: {
      users: { includeUsers: ['All'], excludeUsers: [], includeGroups: [], excludeGroups: [], includeRoles: [], excludeRoles: [], ...users },
      applications: { includeApplications: ['All'], excludeApplications: [], includeUserActions: [], ...apps },
      clientAppTypes: ['all'],
    },
    grantControls: { operator: 'OR', builtInControls: ['mfa'] },
    sessionControls: null,
    ...over,
  }
}

/** The pinned baseline member for mfa-all-users, so the comparison is against real source semantics. */
const MFA_ALL_USERS = PINNED_POLICIES.find((p) => p.displayName === 'IAC - GLOBAL - GRANT - MFA - AllUsers')!

function cover(tenantPolicies: Raw[], over: Partial<CoverageInput> = {}) {
  return computeCoverage({
    snapshot: mkSnapshot(),
    tenantPolicies,
    baselinePolicies: [MFA_ALL_USERS],
    baselineUnusable: [],
    strengths: buildStrengthLookup([]),
    groupMembers: new Map<string, GroupMembers extends Map<string, infer V> ? V : never>() as GroupMembers,
    goalMap: { 'mfa-all-users': [policyKey(MFA_ALL_USERS)] },
    ...over,
  })
}

const mfaGoal = (r: ReturnType<typeof computeCoverage>) => {
  const g = r.results.find((x) => x.goal.id === 'mfa-all-users')
  assert.ok(g, 'the mfa-all-users goal is evaluated')
  return g
}

test('a tenant policy that differs only by an application exclusion is not the baseline member', () => {
  const g = mfaGoal(cover([mkTenantPolicy({ displayName: 'MFA all, minus one app' }, { excludeApplications: [OTHER_APP] })]))
  assert.notEqual(g.status, 'enforced', 'an application the baseline covers was excluded and the goal still read as in place')
  assert.equal(g.status, 'partial')
  assert.ok(g.reasons.some((r) => r.kind === 'apps-excluded'), 'the dropped application is not stated as a reason')
  // The technician is told what is short, in the statement and in the verdict.
  assert.match(g.statement, /Covers fewer apps than the goal expects/)
  assert.equal(g.verdict, 'partly')
  assert.equal(g.gapSentence, 'covers fewer apps than the baseline')
})

test('a tenant policy that excludes exactly what the baseline member excludes is still equivalent', () => {
  // Fidelity runs both ways: the pinned member itself leaves Intune Enrollment
  // out, so a tenant that leaves the same application out matches it.
  const g = mfaGoal(cover([mkTenantPolicy({ displayName: 'MFA all, same carve-out' }, { excludeApplications: [INTUNE_ENROLMENT] })]))
  assert.equal(g.status, 'enforced', 'a tenant policy matching the baseline member exactly was demoted')
  assert.equal(g.reasons.some((r) => r.kind === 'apps-excluded'), false)
})

test('an application filter IAMAI does not evaluate cannot prove full application scope', () => {
  const g = mfaGoal(cover([mkTenantPolicy({ displayName: 'MFA all, filtered' }, { applicationFilter: { mode: 'include', rule: 'app.assignedName -contains "Finance"' } })]))
  assert.notEqual(g.status, 'enforced', 'an unread filter rule was treated as all applications')
  assert.ok(g.reasons.some((r) => r.kind === 'apps-excluded'))
})

test('a tenant policy covering part of the required users cannot raise the whole goal', () => {
  const groups: GroupMembers = new Map([['g1', { memberIds: ['u1'], memberCount: 1, sampled: false, displayName: 'One team' }]])
  const g = mfaGoal(cover([mkTenantPolicy({ displayName: 'MFA for one team' }, {}, { includeUsers: [], includeGroups: ['g1'] })], { groupMembers: groups }))
  assert.notEqual(g.status, 'enforced')
  assert.equal(g.enforcedIds.length < 6, true, 'a one-group policy was credited with the whole population')
  assert.equal(g.floorRaised, null, 'a narrow tenant policy raised a floor')
})

test('a stronger control on a narrower population is still not full coverage', () => {
  const groups: GroupMembers = new Map([['g1', { memberIds: ['u1'], memberCount: 1, sampled: false, displayName: 'One team' }]])
  const g = mfaGoal(
    cover(
      [
        mkTenantPolicy(
          { displayName: 'Phishing-resistant for one team', grantControls: { operator: 'OR', builtInControls: [], authenticationStrength: { id: PR_STRENGTH } } },
          {},
          { includeUsers: [], includeGroups: ['g1'] },
        ),
      ],
      { groupMembers: groups },
    ),
  )
  assert.notEqual(g.status, 'enforced', 'strength stood in for scope')
  assert.equal(g.floorRaised, null, 'a narrow tenant policy raised the goal floor by being stronger')
})

test('an unreadable semantic stays unknown: never equivalent, full, safe or absent', () => {
  // The policy targets a group nothing in the scan read, so who it reaches is
  // unknown; the goal may not resolve that either way.
  const g = mfaGoal(cover([mkTenantPolicy({ displayName: 'MFA via a group nothing read' }, {}, { includeUsers: [], includeGroups: ['g-never-read'] })]))
  assert.equal(g.status, 'unknown')
  assert.equal(g.verdict, 'unknown')
  assert.equal(g.enforcedIds.length, 0, 'unknown reach was counted as covered')
  assert.notEqual(g.status, 'absent', 'unknown became absent, which is a claim the evidence does not support')
})

test('an unsupported signature key fails closed rather than matching', async () => {
  const { matchesSignature } = await import('./classify.ts')
  const { policyFacts } = await import('./facts.ts')
  const facts = policyFacts(mkTenantPolicy(), buildStrengthLookup([]))
  assert.equal(matchesSignature(facts, { somethingIAMAIDoesNotSupport: true } as never), false)
})

test('a custom tenant policy is kept as evidence without touching pinned source identity', () => {
  const custom = mkTenantPolicy(
    { id: 'p-custom', displayName: 'Custom - block one app', grantControls: { operator: 'OR', builtInControls: ['block'] } },
    { includeApplications: ['0000aaaa-1111-2222-3333-444455556666'] },
  )
  const r = cover([mkTenantPolicy({ displayName: 'MFA all' }), custom])
  assert.ok(r.organisation.notInBaseline.some((p) => p.id === 'p-custom'), 'the custom policy is not retained as evidence')
  // It changed neither which source policy stands for the goal nor the map.
  assert.equal(mfaGoal(r).status, 'enforced')
  assert.deepEqual(PINNED_GOAL_MAP['mfa-all-users'], [policyKey(MFA_ALL_USERS)], 'a tenant policy reassigned the baseline source identity')
})

// ------------------------------------------------ 5. placeholders / templates

test('a named placeholder becomes the object the author named, and never reaches a body as itself', () => {
  // The pinned Intune-enrolment policy excludes no group id at all: the author
  // wrote `CA-GlobalExclusions-GroupID-ReplaceMe` for a consumer to fill in, and
  // their naming guide defines CA-GlobalExclusions as the break-glass exclusion
  // group. That is the author stating the meaning, so this baseline's
  // interpretation settles it as the exclusions group and the tenant's own
  // exclusions group stands there (src/baseline/interpretation.ts).
  //
  // What must never happen is the token travelling: a body carrying the literal
  // string would be submitted to Graph as a group id. It is either the tenant's
  // object or it is reported missing, and it is never itself.
  // The Initial scan: by week two the demo has this policy in report-only (A4), so the create body is day one's.
  const step = runFixture(fixture('demo')).steps.find((s) => s.goalId === 'intune-enrollment-reauth')
  assert.ok(step, 'the intune-enrolment step is in the plan')
  const s = step as Step
  const json = s.action.json
  assert.equal(typeof json === 'string' && (json as string).includes('ReplaceMe'), false, 'the raw token reached a submittable body')
  const missing = (s.action as unknown as { missing?: { token: string }[] }).missing ?? []
  assert.equal(missing.some((m) => m.token.includes('ReplaceMe')), false, 'the token is both resolved and reported missing')
  const excluded = (JSON.parse(String(json)).conditions?.users?.excludeGroups ?? []) as string[]
  assert.ok(excluded.length > 0 && excluded.every((g) => /^[0-9a-f-]{36}$/i.test(g)), `only tenant object ids reach the body: ${JSON.stringify(excluded)}`)

  // And it is the exclusions group, not some other object the plan had to hand.
  const exclusions = fixture('demo-week2').mapping.records['__globalExclusion']?.resolvedId
  assert.ok(exclusions)
  assert.deepEqual(excluded, [exclusions], 'the author’s global-exclusions token became something other than the exclusions group')
})

// ------------------------------------------------------ 6. baseline conflict

test('the Admin Portal conflict is bound to the source policy this package carries, not to the goal id', () => {
  const pkg = pinnedPackage()
  // It holds for the pinned default, because this baseline maps the goal to the
  // policy the review read and still carries that policy as the review read it.
  assert.deepEqual([...baselineConflicts(PINNED_GOAL_MAP, pkg).keys()], ['admin-portals-protected'])
  assert.deepEqual(PINNED_GOAL_MAP['admin-portals-protected'], ['fafaa50c-0b61-4ac6-a589-f9a1120b2f9e'])
  assert.equal(baselineConflicts(PINNED_GOAL_MAP, pkg).get('admin-portals-protected'), 'fafaa50c-0b61-4ac6-a589-f9a1120b2f9e', 'the step is told which source raised it')

  // A baseline whose map hands the same goal to a policy the review did not read
  // is not conflicted: the block is the active baseline's, never the goal's.
  assert.deepEqual([...baselineConflicts({ 'admin-portals-protected': ['a-different-source-policy'] }, pkg).keys()], [], 'the goal is blocked by its id alone, rather than by the source policy the active baseline maps it to')
  assert.deepEqual([...baselineConflicts({}, pkg).keys()], [])
  // And the same source policy under a different goal id still conflicts.
  assert.deepEqual([...baselineConflicts({ 'some-other-goal': ['fafaa50c-0b61-4ac6-a589-f9a1120b2f9e'] }, pkg).keys()], ['some-other-goal'])

  // The package is the other half of the reading: the pinned map over a package
  // that does not carry the reviewed policy conflicts nothing, because there is
  // no source there to contradict itself.
  assert.deepEqual([...baselineConflicts(PINNED_GOAL_MAP, { policies: [] }).keys()], [], 'a package with no reviewed source inherited the conflict from the pinned map')
})

test('the conflicted step offers nothing and the rest of the plan still works', () => {
  const r = runFixture(fixture('demo-week2'))
  const step = r.steps.find((s) => s.goalId === 'admin-portals-protected')
  assert.ok(step, 'the admin-portals step is in the plan')
  const s = step as Step
  assert.equal(policyResult(s as never).kind, 'unavailable')
  assert.equal(s.action.json, null, 'a body was offered for a baseline that contradicts itself')
  assert.deepEqual(s.action.portalSteps, [], 'portal steps were offered')
  assert.deepEqual(s.deliveredBy, [], 'a tenant policy was claimed to deliver a contradicted definition')
  assert.equal(s.state.condition, 'baseline-conflict')
  // No manufactured date: the next thing on the step is the conflict itself.
  const milestone = nextMilestone(s)
  assert.equal(milestone.kind, 'resolve')
  assert.equal(milestone.at, null, 'a rollout date was manufactured for a contradicted policy')
  const others = r.steps.filter((x) => x.goalId !== 'admin-portals-protected')
  assert.ok(others.some((x) => typeof x.action.json === 'string'), 'the rest of the plan lost its implementations')
})

// ------------------------------------------------------- 7. the whole path

test('whole path: pinned member to goal identity to classification to coverage to the Plan step', () => {
  const f = fixture('small')
  const rows = (f.snapshot.config.caPolicies as { rows: Raw[] }).rows
  const mfa = rows.find((p) => /MFA for all users/i.test(String(p.displayName)))
  assert.ok(mfa, 'the fixture tenant has an all-users MFA policy')
  const before = runFixture(fixture('small'))
  assert.equal(before.coverage.results.find((r) => r.goal.id === 'mfa-all-users')?.status, 'enforced', 'the fixture starts with the goal in place')
  assert.equal(before.steps.find((s) => s.id === 's-goal-mfa-all-users')?.status, 'done')

  // One material change: the tenant's policy now leaves an application out.
  const apps = (mfa as { conditions: { applications: Record<string, unknown> } }).conditions.applications
  apps.excludeApplications = [OTHER_APP]

  const after = runFixture(f)
  const goal = after.coverage.results.find((r) => r.goal.id === 'mfa-all-users')
  assert.ok(goal)
  assert.notEqual(goal.status, 'enforced', 'the exclusion travelled no further than the fact reader')
  assert.ok(goal.reasons.some((r) => r.kind === 'apps-excluded'), 'coverage did not state the dropped application')
  const step = after.steps.find((s) => s.id === 's-goal-mfa-all-users')
  assert.ok(step, 'the step is still in the plan')
  assert.notEqual(step.status, 'done', 'the Plan still reads the goal as finished on a narrower policy')
})

// ------------------------------------------- 8. the applications a goal expects

// Nadia D7 / R4-10: a token-protection policy switched On exactly as the step
// asked came back "Ready · Correct" with the gap "covers fewer apps than the
// baseline", and the correction offered was an update to its target resources
// whose body was the resources it already had. goals.json carried two
// token-protection implementations identical but for `expectedApps`: "all" on
// the first — the one coverage reads — over a template that names three
// resources, and "specific" on the second. Token protection cannot target All
// resources, so every token-protection policy, the pinned one included, read as
// narrower than the goal, and the correction could never close the gap. Coverage
// now judges resources against the policy the goal is evaluated against
// (classify.ts narrowerApps), and the duplicate is gone. The goal's own template
// is held to the same rule in coverage.test.ts.

test('no implementation expects all applications while its own template names fewer', () => {
  // require-managed-device had the same disagreement: it expects All resources
  // (the pinned policy's scope, prompt 51) over a template on Office 365. Where
  // a baseline holds no compliant-device policy that template is the reference,
  // so it must carry the scope the goal is judged by, or a policy on Office 365
  // alone would read as the goal in place.
  const wrong: string[] = []
  for (const goal of CATALOGUE) {
    for (const [i, impl] of goal.implementations.entries()) {
      if (impl.kind !== 'ca' || impl.expectedApps !== 'all') continue
      const apps = (impl.template as { conditions?: { applications?: { includeApplications?: unknown } } }).conditions?.applications?.includeApplications
      if (!(Array.isArray(apps) && apps.length === 1 && apps[0] === 'All')) wrong.push(`${goal.id}[${i}]: ${JSON.stringify(apps)}`)
    }
  }
  assert.deepEqual(wrong, [], 'a goal expects all applications of a policy its own template scopes to fewer')
})

test('every pinned member, switched on in the tenant as it stands, is never read as covering fewer applications than its goal expects', () => {
  const on = (enabled: boolean) => ({ enabled, seats: 10, consumed: 0 })
  const snapshot = mkSnapshot({ capabilities: { entraP1: on(true), entraP2: on(true), intune: on(true), workloadIdPremium: on(true), globalSecureAccess: on(true), defenderForCloudApps: on(true), purviewInsiderRisk: on(true) } })
  const judged: string[] = []
  const narrower: string[] = []
  for (const [goalId, keys] of Object.entries(PINNED_GOAL_MAP)) {
    const tenantPolicies = PINNED_POLICIES.filter((p) => keys.includes(policyKey(p))).map((p) => ({ ...structuredClone(p), id: `tenant-${policyKey(p)}`, state: 'enabled' }) as unknown as Raw)
    const r = computeCoverage({
      snapshot,
      tenantPolicies,
      baselinePolicies: PINNED_POLICIES,
      baselineUnusable: [],
      strengths: buildStrengthLookup([]),
      groupMembers: new Map() as GroupMembers,
      goalMap: PINNED_GOAL_MAP,
    })
    const goal = r.results.find((x) => x.goal.id === goalId)
    assert.ok(goal, `${goalId} is evaluated`)
    // A workload goal (no people) and one about confirmed service accounts (none
    // here) do not apply; every other goal reads its own member as its candidate.
    if (goal.status === 'not-applicable') continue
    const own = goal.candidates.filter((c) => tenantPolicies.some((t) => t.id === c.policyId))
    assert.equal(own.length, tenantPolicies.length, `${goalId}: the goal's own pinned policy is not its candidate`)
    judged.push(goalId)
    for (const c of own) if (c.caveats.includes('apps-narrower')) narrower.push(`${goalId}: ${c.policyName}`)
  }
  assert.ok(judged.includes('token-protection'), 'the token-protection member was not judged at all')
  assert.ok(judged.length >= 20, `only ${judged.length} goals were judged`)
  assert.deepEqual(narrower, [], 'the baseline\'s own policy reads as covering fewer apps than its goal expects, so following the step can never finish it')
})

test('an enforced tenant policy equal to the pinned token-protection member is the goal in place', () => {
  const member = PINNED_POLICIES.find((p) => p.displayName === 'IAC - GLOBAL - SESSION - Windows - TokenProtection')!
  const tenant = { ...structuredClone(member), id: 'tenant-token-protection', displayName: 'Tenant token protection', state: 'enabled', conditions: { ...structuredClone(member.conditions), users: { includeUsers: ['All'], excludeUsers: [], includeGroups: [], excludeGroups: [], includeRoles: [], excludeRoles: [] } } } as unknown as Raw
  const r = cover([tenant], { baselinePolicies: [member], goalMap: { 'token-protection': [policyKey(member)] } })
  const g = r.results.find((x) => x.goal.id === 'token-protection')
  assert.ok(g, 'the token-protection goal is evaluated')
  assert.equal(g.reasons.some((x) => x.kind === 'apps-narrower'), false, 'the five resources the baseline names read as fewer than the goal expects')
  assert.equal(g.status, 'enforced')
  assert.equal(g.gapSentence, null)
})

test('resources are judged against the pinned member: fewer token-protection resources are narrower, the admin portals alone are not', () => {
  // The other side of the rule. A token-protection policy on Exchange alone
  // leaves four of the pinned five out and is narrower. A portal policy on the
  // Microsoft Admin Portals is the goal's own scope: the pinned policy also names
  // four applications beside the group, and coverage has never asked a tenant's
  // portal policy to add them (classify.ts narrowerApps; an owner question).
  const users = { includeUsers: ['All'], excludeUsers: [], includeGroups: [], excludeGroups: [], includeRoles: [], excludeRoles: [] }
  const token = PINNED_POLICIES.find((p) => p.displayName === 'IAC - GLOBAL - SESSION - Windows - TokenProtection')!
  const exchangeOnly = { ...structuredClone(token), id: 'tenant-token-exchange', displayName: 'Tenant token protection', state: 'enabled', conditions: { ...structuredClone(token.conditions), users, applications: { includeApplications: ['00000002-0000-0ff1-ce00-000000000000'], excludeApplications: [] } } } as unknown as Raw
  const t = cover([exchangeOnly], { baselinePolicies: [token], goalMap: { 'token-protection': [policyKey(token)] } }).results.find((x) => x.goal.id === 'token-protection')
  assert.ok(t?.candidates.find((c) => c.policyId === 'tenant-token-exchange')?.caveats.includes('apps-narrower'), 'a policy on one of the five resources reads as covering them all')

  const portal = PINNED_POLICIES.find((p) => /Admin Portal/.test(p.displayName))!
  const portalsOnly = { ...structuredClone(portal), id: 'tenant-admin-portals', displayName: 'Tenant admin portals', state: 'enabled', conditions: { ...structuredClone(portal.conditions), users, applications: { includeApplications: ['MicrosoftAdminPortals'], excludeApplications: [] } } } as unknown as Raw
  const a = cover([portalsOnly], { baselinePolicies: [portal], goalMap: { 'admin-portals-protected': [policyKey(portal)] } }).results.find((x) => x.goal.id === 'admin-portals-protected')
  const own = a?.candidates.find((c) => c.policyId === 'tenant-admin-portals')
  assert.ok(own, 'the portal policy is the goal\'s candidate')
  assert.equal(own.caveats.includes('apps-narrower'), false, 'a portal policy is told to add the applications the pinned policy names beside the portals')
})

test('a goal the pinned map does not hold is judged against its own template, never another goal\'s policy', () => {
  // Review of a27fb72d: narrowerApps read the reference coverage keeps for
  // conditions, which for a goal the map does not hold is whatever pinned policy
  // its signature matches. For azure-management-mfa that is the admin-portal
  // BLOCK, which names Azure management (797f…) beside Microsoft Admin Portals.
  // A tenant's MFA policy on Azure management alone read "covers fewer apps"
  // against another goal's policy, and the goal went from in place to partly in
  // place in the findings and the plan checkpoint. No step renders such a goal:
  // generate.ts sourcesFor gives it no source, and a step for it would write
  // the goal's own template, so that is what its resources are judged against.
  const users = { includeUsers: ['All'], excludeUsers: [], includeGroups: [], excludeGroups: [], includeRoles: [], excludeRoles: [] }
  const azure = { id: 'tenant-azure-mfa', displayName: 'Tenant Azure management MFA', state: 'enabled', conditions: { users, applications: { includeApplications: ['797f4846-ba00-4fd7-ba43-dac1f8f63013'], excludeApplications: [] }, clientAppTypes: ['all'] }, grantControls: { operator: 'OR', builtInControls: ['mfa'] }, sessionControls: null } as unknown as Raw
  assert.deepEqual(PINNED_GOAL_MAP['azure-management-mfa'] ?? [], [], 'the premise: the pinned map does not hold Azure management')
  const r = cover([azure], { baselinePolicies: PINNED_POLICIES, goalMap: PINNED_GOAL_MAP }).results.find((x) => x.goal.id === 'azure-management-mfa')
  const own = r?.candidates.find((c) => c.policyId === 'tenant-azure-mfa')
  assert.ok(own, 'the premise: the tenant policy is the goal\'s candidate')
  assert.equal(own.caveats.includes('apps-narrower'), false, 'an MFA policy on Azure management reads as covering fewer apps than the admin-portal block beside it')
  assert.equal(r?.reasons.some((x) => x.kind === 'apps-narrower'), false)
  assert.equal(r?.status, 'enforced')
})

test('a goal\'s application label names the same resources its own template targets', () => {
  // The same disagreement a27fb72d removed for "all", for the two Microsoft
  // groups: byod-session-controls was labelled Office 365 over a template on All
  // resources. With the template the reference for a goal the map does not hold,
  // a tenant's BYOD policy on Office 365 read "covers fewer apps than the goal
  // expects", against the goal's own label. Its template now targets Office 365,
  // Microsoft's own scope for application-enforced restrictions.
  const group: Record<string, string> = { all: 'All', office365: 'Office365', adminPortals: 'MicrosoftAdminPortals' }
  const wrong: string[] = []
  for (const goal of CATALOGUE) {
    for (const [i, impl] of goal.implementations.entries()) {
      const want = group[impl.expectedApps]
      if (impl.kind !== 'ca' || want === undefined) continue
      const apps = (impl.template as { conditions?: { applications?: { includeApplications?: unknown } } }).conditions?.applications?.includeApplications
      if (!(Array.isArray(apps) && apps.length === 1 && apps[0] === want)) wrong.push(`${goal.id}[${i}] ${impl.expectedApps}: ${JSON.stringify(apps)}`)
    }
  }
  assert.deepEqual(wrong, [], 'a goal is labelled with one set of resources and its template targets another')
})

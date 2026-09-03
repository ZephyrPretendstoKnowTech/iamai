// roadmap.md §9 — the 8 required cases, authored fixtures only.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { computeCoverage } from '../coverage/coverage.ts'
import { buildStrengthLookup } from '../coverage/strength.ts'
import type { TenantSnapshot } from '../graph/collect/types.ts'
import { emptyMappingState } from '../mapping/types.ts'
import type { MappingState } from '../mapping/types.ts'
import type { MfaViability } from '../scoring/mfaViability.ts'
import { generateRoadmap } from './generate.ts'
import type { RoadmapInput } from './generate.ts'
import { applyProgress, mergePersisted, skipStep } from './progress.ts'

const GA = '62e90394-69f5-4237-9190-012177145e10'
const PLAN = 'plan-test'

function mkSnapshot(over: Partial<TenantSnapshot> = {}): TenantSnapshot {
  const users = Array.from({ length: 10 }, (_, i) => ({
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
    onPremisesSyncEnabled: false,
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
    sources: {
      signInEvidence: { status: 'ok', coveredWindow: { from: '2026-07-27T00:00:00Z', to: '2026-08-26T00:00:00Z' }, reason: null, asOf: '' },
    } as unknown as TenantSnapshot['sources'],
    config: { caPolicies: { status: 'ok', reason: null, rows: [] } } as unknown as TenantSnapshot['config'],
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

type P = Record<string, unknown>
function mkPolicy(over: P = {}): P {
  return {
    id: `p-${String(over.displayName ?? 'x')}`,
    displayName: 'Policy',
    state: 'enabled',
    conditions: {
      users: { includeUsers: ['All'], excludeUsers: [], includeGroups: [], excludeGroups: [], includeRoles: [], excludeRoles: [] },
      applications: { includeApplications: ['All'], excludeApplications: [], includeUserActions: [] },
      clientAppTypes: ['all'],
    },
    grantControls: { operator: 'OR', builtInControls: ['mfa'] },
    sessionControls: null,
    ...over,
  }
}

function viabilityRows(readyCount: number, total = 10): MfaViability[] {
  return Array.from({ length: total }, (_, i) => ({
    userId: `u${i}`,
    activity: 'active' as const,
    mfa: i < readyCount ? ('verified' as const) : ('unverified' as const),
    enabled: true, mfaCapable: true,
    isAdmin: i === 0,
    strongestMethod: 'push' as const,
    methodTiers: ['push' as const],
    reasons: [],
    signals: {},
  }))
}

function build(args: {
  tenantPolicies?: P[]
  baselinePolicies?: P[]
  mapping?: MappingState
  ready?: number
  snapshot?: TenantSnapshot
}): { input: RoadmapInput; snapshot: TenantSnapshot } {
  const snapshot = args.snapshot ?? mkSnapshot()
  snapshot.config.caPolicies = { status: 'ok', reason: null, rows: args.tenantPolicies ?? [] }
  const strengths = buildStrengthLookup([])
  const coverage = computeCoverage({
    snapshot,
    tenantPolicies: args.tenantPolicies ?? [],
    baselinePolicies: args.baselinePolicies ?? [],
    baselineUnusable: [],
    strengths,
    groupMembers: new Map(),
  })
  const input: RoadmapInput = {
    planId: PLAN,
    coverage,
    snapshot,
    baseline: {
      policies: (args.baselinePolicies ?? []) as never,
      origins: {},
      report: { considered: 0, parsed: 0, skipped: [], errors: [], duplicates: [], warnings: [] },
      references: [],
      groupSignatures: [],
      variantSets: [],
      docs: [],
    },
    baselineAuthor: { author: 'Author', url: 'https://example.test' },
    mapping: args.mapping ?? emptyMappingState('t'),
    viability: viabilityRows(args.ready ?? 10),
    strengths,
  }
  return { input, snapshot }
}

const stepFor = (steps: ReturnType<typeof generateRoadmap>['steps'], goalId: string) => {
  // The verification campaign shares the MFA goal's id; these cases are about the policy step.
  const s = steps.find((x) => x.goalId === goalId && x.kind !== 'verify') ?? steps.find((x) => x.goalId === goalId)
  assert.ok(s, `step for ${goalId}`)
  return s
}

test('1: enforced goal → step created as done', () => {
  const { input } = build({ tenantPolicies: [mkPolicy({ displayName: 'MFA All' })] })
  const steps = generateRoadmap(input).steps
  assert.equal(stepFor(steps, 'mfa-all-users').status, 'done')
})

test('2: absent goal with mapped references → create step JSON has mapped ids, tag, report-only', () => {
  const baseline = mkPolicy({
    displayName: 'Baseline MFA All',
    conditions: {
      users: { includeUsers: ['All'], excludeGroups: ['old-group-id'] },
      applications: { includeApplications: ['All'] },
      clientAppTypes: ['all'],
    },
  })
  const mapping = emptyMappingState('t')
  mapping.records['old-group-id'] = {
    placeholder: 'old-group-id',
    kind: 'group',
    group: 'globalExclusion',
    resolvedId: 'new-group-id',
    resolvedName: 'CA Exclusions',
    provenance: 'confirmed',
    doesNotExist: false,
    validation: null,
  }
  const { input } = build({ baselinePolicies: [baseline], mapping })
  const step = stepFor(generateRoadmap(input).steps, 'mfa-all-users')
  assert.equal(step.kind, 'create')
  assert.ok(step.action.json)
  assert.match(step.action.json!, /new-group-id/)
  assert.doesNotMatch(step.action.json!, /old-group-id/)
  assert.match(step.action.json!, /enabledForReportingButNotEnforced/)
  assert.ok(step.action.json!.includes(`[IAMAI:${PLAN}:${step.id}]`))
})

test('4: partial weaker-control → adjust step with the exact field change', () => {
  const PR = '00000000-0000-0000-0000-000000000004'
  const baseline = mkPolicy({
    displayName: 'Baseline PR MFA',
    grantControls: { operator: 'OR', builtInControls: [], authenticationStrength: { id: PR } },
  })
  const { input } = build({ tenantPolicies: [mkPolicy({ displayName: 'Plain MFA' })], baselinePolicies: [baseline] })
  const step = stepFor(generateRoadmap(input).steps, 'mfa-all-users')
  assert.equal(step.kind, 'adjust')
  assert.ok((step.action.changes?.length ?? 0) > 0, 'field-by-field changes')
})

test('5: MFA step with readiness 60% → blocked with the unblocking numbers', () => {
  const baseline = mkPolicy({ displayName: 'Baseline MFA All' })
  const { input } = build({ baselinePolicies: [baseline], ready: 6 })
  const step = stepFor(generateRoadmap(input).steps, 'mfa-all-users')
  assert.equal(step.status, 'blocked')
  assert.ok(step.blockers.some((b) => typeof b.binding === 'string' && b.binding.includes('60%') && b.binding.includes('90%')))
})

test('6: re-scan matching — report-only, then exit criterion, then enabled', () => {
  const baseline = mkPolicy({ displayName: 'Baseline MFA All' })
  const { input } = build({ baselinePolicies: [baseline] })
  const steps = generateRoadmap(input).steps
  const step = stepFor(steps, 'mfa-all-users')
  const tag = `[IAMAI:${PLAN}:${step.id}]`

  const snap2 = mkSnapshot()
  snap2.config.caPolicies = {
    status: 'ok',
    reason: null,
    rows: [mkPolicy({ id: 'created-1', displayName: 'Created', state: 'enabledForReportingButNotEnforced', description: tag })],
  }
  applyProgress(steps, snap2, input.coverage, PLAN)
  assert.equal(step.status, 'in-report-only')

  // The time gate: the plan record says a scan eight days before this one first
  // saw the policy in report-only, past the observation window.
  applyProgress(steps, snap2, input.coverage, PLAN, undefined, null, { [step.id]: '2026-08-18T00:00:00Z' })
  assert.equal(step.status, 'ready-to-enforce')

  const rows = snap2.config.caPolicies.rows as P[]
  rows[0] = { ...rows[0], state: 'enabled' }
  // The policy is on, but this coverage still says the goal is missing. A step
  // is done if and only if its goal's verdict is inPlace (target-state §8.2,
  // prompt 46 item 9), so the policy's own state cannot finish it on its own:
  // that is exactly how the Plan came to count 11 in place against Findings' 6.
  applyProgress(steps, snap2, input.coverage, PLAN)
  assert.equal(step.status, 'ready-to-enforce', 'an enabled policy does not make a step done while coverage disagrees')
  // On a real re-scan coverage is recomputed and agrees; then, and only then, the step is done.
  const agreeing = {
    ...input.coverage,
    results: input.coverage.results.map((r) => (r.goal.id === 'mfa-all-users' ? { ...r, status: 'enforced' as const, verdict: 'inPlace' as const } : r)),
  }
  applyProgress(steps, snap2, agreeing, PLAN)
  assert.equal(step.status, 'done')
  assert.equal(step.history.length, 3)
})

test('7: regression after done → re-opened with a dated note (missing policy: a create step again)', () => {
  const baseline = mkPolicy({ displayName: 'Baseline MFA All' })
  const { input } = build({ baselinePolicies: [baseline] })
  const steps = generateRoadmap(input).steps
  const step = stepFor(steps, 'mfa-all-users')
  mergePersisted(steps, { [step.id]: { status: 'done', history: [{ at: '2026-08-01T00:00:00Z', from: 'ready', to: 'done', note: null }], skipReason: null } })
  assert.equal(step.status, 'done')
  // coverage for this run says absent (no tenant policy) → drift reopen.
  applyProgress(steps, mkSnapshot(), input.coverage, PLAN)
  assert.equal(step.status, 'ready')
  assert.equal(step.kind, 'create')
  assert.match(step.history.at(-1)?.note ?? '', /changed since .*missing again/)
})

test('9: valid break-glass answers → the emergency-access step stands by its checks; drill depends on their last sign-in', () => {
  const mapping = emptyMappingState('t')
  // Every shown question is required now (prompt 26): answer them all so only the break-glass branch is under test.
  for (const id of ['breakGlass', 'globalExclusion', 'countries', 'highCare', 'trustedLocations', 'serviceAccounts', 'timeZone', 'frameworks', 'applicability']) mapping.wizardAnswered[id] = true
  mapping.breakGlassUserIds = ['u1', 'u2']
  const snapshot = mkSnapshot()
  snapshot.users[1].lastSuccessfulSignIn = '2026-01-01T00:00:00Z' // u1 stale
  const { input } = build({ baselinePolicies: [mkPolicy({ displayName: 'Baseline MFA All' })], mapping, snapshot })
  const steps = generateRoadmap(input).steps
  // Emergency access is a foundation: the step stands on every plan, In place or Ready by its checks.
  assert.ok(steps.some((s) => s.id === 's-prereq-break-glass'))
  assert.ok(!steps.some((s) => s.id === 's-setup-questions'))
  // The drill is a Cleanup row now, never a step.
  assert.ok(!steps.some((s) => s.id.includes('drill')))
})

test('11: geo policy: allowlist style chosen by data, NoExclusions dropped', () => {
  const geo = (displayName: string, locations: { includeLocations: string[]; excludeLocations: string[] }) =>
    mkPolicy({
      displayName,
      conditions: { users: { includeUsers: ['All'] }, applications: { includeApplications: ['All'] }, clientAppTypes: ['all'], locations },
      grantControls: { operator: 'OR', builtInControls: ['block'] },
    })
  const allow = geo('Countries - allow list', { includeLocations: ['All'], excludeLocations: ['loc-allowed'] })
  const block = geo('Countries - block list', { includeLocations: ['loc-blocked'], excludeLocations: [] })
  const noEx = geo('Countries - allow list - NoExclusions', { includeLocations: ['All'], excludeLocations: ['loc-allowed'] })
  const { input } = build({ baselinePolicies: [noEx, block, allow] })
  const steps = generateRoadmap(input).steps
  const step = stepFor(steps, 'geo-restriction')
  // Allowlist style: everywhere except the allowed location, block.
  const json = JSON.parse(step.action.json ?? '{}') as { conditions: { locations: { includeLocations: string[]; excludeLocations: string[] } } }
  assert.deepEqual(json.conditions.locations, { includeLocations: ['All'], excludeLocations: ['loc-allowed'] })
  assert.doesNotMatch(step.action.json ?? '', /NoExclusions|loc-blocked/)
})

test('12: answered Countries with no matching tenant location → phase-0 step creates it and gates the geo policy', () => {
  const allow = mkPolicy({
    displayName: 'Countries - allow list',
    conditions: { users: { includeUsers: ['All'] }, applications: { includeApplications: ['All'] }, clientAppTypes: ['all'], locations: { includeLocations: ['All'], excludeLocations: ['loc-allowed'] } },
    grantControls: { operator: 'OR', builtInControls: ['block'] },
  })
  const mapping = emptyMappingState('t')
  mapping.allowedCountries = ['AU', 'NZ']
  mapping.wizardAnswered = { countries: true }
  const { input } = build({ baselinePolicies: [allow], mapping })
  const steps = generateRoadmap(input).steps
  const create = steps.find((s) => s.id === 's-prereq-allowed-countries')
  assert.ok(create && create.phase === 0)
  const step = stepFor(steps, 'geo-restriction')
  assert.ok(step.blockedBy.includes('s-prereq-allowed-countries'))
})

test('13: confirmed service accounts with no group → phase-0 step creates the group', () => {
  const mapping = emptyMappingState('t')
  mapping.serviceAccountUserIds = ['u1']
  const { input } = build({ baselinePolicies: [mkPolicy({ displayName: 'Baseline MFA All' })], mapping })
  const steps = generateRoadmap(input).steps
  const create = steps.find((s) => s.id === 's-prereq-service-accounts-group')
  assert.ok(create && create.kind === 'prerequisite')
})

test('8: skipping requires a reason and never "risk accepted"', () => {
  const baseline = mkPolicy({ displayName: 'Baseline MFA All' })
  const { input } = build({ baselinePolicies: [baseline] })
  const step = stepFor(generateRoadmap(input).steps, 'mfa-all-users')
  assert.equal(skipStep(step, '   ').ok, false)
  assert.equal(skipStep(step, 'risk accepted by CISO').ok, false)
  const ok = skipStep(step, 'not applicable to us — no such workload')
  assert.equal(ok.ok, true)
  assert.equal(step.status, 'skipped')
})

// Foundation A: one authoritative resolved tenant policy, and every
// implementation channel reads it off the step. The author's four exclusion
// groups on a policy are this tenant's one exclusions group, named once — in
// the resolved object itself, not only in a rendered string — and the portal
// instructions, the JSON, the PowerShell and the download all describe that
// same policy and are offered together or not at all.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import pinned from '../../baselines/jhope188-conditionalaccesspolicies.pinned.json' with { type: 'json' }
import type { CaPolicy } from '../baseline/types.ts'
import { implementable, resolveTenantPolicy } from './resolvePolicy.ts'
import type { TenantObjects } from './resolvePolicy.ts'
import { PREREQ_STEP_ID } from './stepIds.ts'
import { fixture } from './fixtures/index.ts'
import { adminsAtRung5, runFixture } from './fixtures/run.ts'
import { contentStepFor } from '../content/stepTitle.ts'
import { stepVars } from '../ui/surfaces/stepVars.ts'
import type { StepVarContext } from '../ui/surfaces/stepVars.ts'
import { portalNamesFor, stepPortalLines } from '../ui/surfaces/stepPortal.ts'
import { implementationOffered, jsonOffered, missingObjects, policyJson, policyJsonText, stepOperations } from '../ui/surfaces/stepJson.ts'
import { powershellFor } from '../ui/surfaces/stepPowerShell.ts'
import { enforcementUnearned } from './forecast.ts'
import type { MappingState } from '../mapping/types.ts'
import { applyStepDecisions } from './decisions.ts'
import { applyDeviations } from './deviations.ts'
import { commsFor, stepExportView } from '../ui/surfaces/stepExport.ts'
import { stepContract } from '../ui/surfaces/stepContract.ts'
import type { Step } from './types.ts'

const POLICIES = pinned.policies as unknown as CaPolicy[]
const X = '00000000-1111-2222-3333-444444444444'
const SA = '00000000-1111-2222-3333-555555555555'
const CONFIRMED = '00000000-1111-2222-3333-666666666666'

const tenant = (over: Partial<TenantObjects> = {}): TenantObjects => ({ exclusionsGroupId: X, serviceAccountsGroupId: null, allowedCountriesLocationId: null, ...over })

/** The author's policy behind a goal, by its name in the pin. */
function authorPolicy(displayName: string): CaPolicy {
  const p = POLICIES.find((x) => x.displayName === displayName)
  assert.ok(p, `the pin holds ${displayName}`)
  return p as CaPolicy
}

/** The author's own id for a token, from a pinned policy's placeholder map. */
function authorIdFor(p: CaPolicy, token: string): string {
  const hit = Object.entries((p as unknown as { placeholders: Record<string, string> }).placeholders).find(([, t]) => t === token)
  assert.ok(hit, `${p.displayName} names an author ${token}`)
  return hit[0]
}

const usersOf = (body: Record<string, unknown>): Record<string, unknown> => (((body.conditions ?? {}) as Record<string, unknown>).users ?? {}) as Record<string, unknown>
const excludeGroupsOf = (body: Record<string, unknown>): string[] => (usersOf(body).excludeGroups as string[] | undefined) ?? []

/** Every fixture step that describes a policy, with its portal instructions. */
function policySteps(name: Parameters<typeof fixture>[0], mappingOver: Partial<MappingState> = {}) {
  const base = fixture(name)
  const changed = Object.keys(mappingOver).length > 0
  const mapping = changed ? { ...base.mapping, ...mappingOver } : base.mapping
  const f = { ...base, mapping }
  const r = changed ? runFixture(f, { mapping }) : runFixture(f)
  const nameOf = (id: string): string => r.input.names!.label(id)
  const ctx: StepVarContext = { snapshot: f.snapshot, mapping, nameOf, signature: 'IT', operatorId: f.operatorId, now: f.snapshot.asOf, groups: f.groups, naming: r.coverage.organisation.naming }
  const rows = r.steps
    .filter((s) => (s.kind === 'create' || s.kind === 'adjust') && contentStepFor(s) !== undefined)
    .map((step) => {
      const cs = contentStepFor(step) as Record<string, unknown>
      const names = portalNamesFor(ctx, stepVars(step, ctx) as Record<string, unknown>, step.title)
      return { step: step as Step, cs, portal: cs.kind === 'policy' ? stepPortalLines(step, names) : null }
    })
  return { f, r, ctx, rows }
}

/** The same tenant with none of its own Conditional Access policies: every goal has a policy to write. */
function bareSteps(name: Parameters<typeof fixture>[0], mappingOver: Partial<MappingState> = {}) {
  const base = fixture(name)
  const mapping = { ...base.mapping, ...mappingOver }
  const ca = base.snapshot.config.caPolicies ?? { status: 'ok' as const, reason: null, rows: [] }
  const snapshot = { ...base.snapshot, config: { ...base.snapshot.config, caPolicies: { ...ca, rows: [] } } }
  const f = { ...base, mapping, snapshot }
  const r = runFixture(f, { mapping, snapshot })
  const nameOf = (id: string): string => r.input.names!.label(id)
  const ctx: StepVarContext = { snapshot, mapping, nameOf, signature: 'IT', operatorId: f.operatorId, now: snapshot.asOf, groups: f.groups, naming: r.coverage.organisation.naming }
  const of = (goalId: string): { step: Step; portal: string[] | null } => {
    const step = r.steps.find((x) => x.goalId === goalId && x.kind !== 'verify') as Step
    assert.ok(step, `${goalId} is on the plan`)
    const portal = stepPortalLines(step, portalNamesFor(ctx, stepVars(step, ctx) as Record<string, unknown>, step.title))
    return { step, portal }
  }
  return { f, r, ctx, of }
}

/** The demo's week two with the tenant's own policies replaced, so a goal can be partly covered. */
function withTenantPolicies(rows: Record<string, unknown>[], edit: (p: Record<string, unknown>) => Record<string, unknown> = (p) => p, opts: { adminsReady?: boolean } = {}) {
  const f = fixture('demo-week2')
  const ca = f.snapshot.config.caPolicies ?? { status: 'ok' as const, reason: null, rows: [] }
  const snapshot = { ...f.snapshot, config: { ...f.snapshot.config, caPolicies: { ...ca, rows: rows.map(edit) } } }
  // A case about the admins policy meets the readiness prerequisite the plan
  // names for it first (roadmap/operations.ts readinessGate); otherwise the hold
  // is what it would be testing rather than the update boundary.
  const viability = opts.adminsReady ? adminsAtRung5(runFixture({ ...f, snapshot }, { snapshot } as never).viability, f.snapshot.asOf) : undefined
  const r = runFixture({ ...f, snapshot }, { snapshot, ...(viability ? { viability } : {}) } as never)
  const nameOf = (id: string): string => r.input.names!.label(id)
  const ctx: StepVarContext = { snapshot, mapping: f.mapping, nameOf, signature: 'IT', operatorId: f.operatorId, now: f.snapshot.asOf, groups: f.groups, naming: r.coverage.organisation.naming }
  const of = (goalId: string): { step: Step; portal: string[] | null } => {
    const step = r.steps.find((x) => x.goalId === goalId && x.kind !== 'verify') as Step
    assert.ok(step, `${goalId} is on the plan`)
    return { step, portal: stepPortalLines(step, portalNamesFor(ctx, stepVars(step, ctx) as Record<string, unknown>, step.title)) }
  }
  return { f, r, ctx, of, snapshot }
}

/** The tenant's own admins policy, weaker than the baseline's, with a session control the baseline never sets. */
function weakAdminsPolicy(exclusions: string | null): Record<string, unknown> {
  return {
    id: 'p-admins',
    displayName: 'Core - Grant - Admins phishing-resistant',
    state: 'enabled',
    createdDateTime: '2026-01-10T00:00:00Z',
    conditions: { users: { includeRoles: ['62e90394-69f5-4237-9190-012177145e10'], excludeGroups: exclusions ? [exclusions] : [] }, applications: { includeApplications: ['All'] }, clientAppTypes: ['all'] },
    grantControls: { operator: 'OR', builtInControls: ['mfa'] },
    // Stronger than anything the baseline asks for, and nothing to do with the gap.
    sessionControls: { persistentBrowser: { isEnabled: true, mode: 'never' } },
  }
}

/** One half of the guests pair, as an operator who followed these instructions would have created it. */
function guestsMemberA(displayName: string, exclusions: string | null): Record<string, unknown> {
  return {
    id: 'p-guests-a',
    displayName,
    state: 'enabledForReportingButNotEnforced',
    createdDateTime: '2026-01-10T00:00:00Z',
    conditions: {
      users: { includeUsers: ['All'], includeGuestsOrExternalUsers: { guestOrExternalUserTypes: 'b2bCollaborationGuest,b2bCollaborationMember,b2bDirectConnectUser,internalGuest,serviceProvider,otherExternalUser', externalTenants: { membershipKind: 'all' } }, excludeGroups: exclusions ? [exclusions] : [] },
      applications: { includeApplications: ['All'] },
      clientAppTypes: ['all'],
    },
    grantControls: { operator: 'OR', builtInControls: ['mfa'] },
    sessionControls: null,
  }
}

/** The exclusions group the step's own resolution used. */
const X_TENANT = (step: Step): string => String(step.action.resolution?.tenant.exclusionsGroupId)

// ---- 1 + 2 + 8: the resolved object itself ----

test('1: the author’s four exclusion groups on one policy come to the tenant’s one exclusions group, once', () => {
  // Jon Hope's SharePoint block excludes three groups of his own and his
  // exclusions group. One of those four is a reading this baseline settles
  // (interpretation.ts: the break-glass group); the other three are his tenant's
  // and nothing explains them, so they are not substituted with anything - they
  // are left out, and reported as left out.
  const source = authorPolicy('IAC - APP - BLOCK - SharePoint-OneDrive-NonTrustedLocations')
  const authorGroups = excludeGroupsOf(source as unknown as Record<string, unknown>)
  assert.equal(authorGroups.length, 4, 'the author names four groups')
  const resolved = resolveTenantPolicy(source as unknown as Record<string, unknown>, tenant(), 'x', POLICIES)
  assert.deepEqual(resolved.substitutions.get(authorIdFor(source, 'exclusionsGroup')), [X], 'the one group a record settles is the tenant’s')
  for (const g of authorGroups) if (g !== authorIdFor(source, 'exclusionsGroup')) assert.equal(resolved.substitutions.get(g), undefined, `${g} is nobody’s object but the author’s`)
  // Not a string check: the array on the body an implementation channel carries
  // holds the tenant's one group, once, and no id out of the author's tenant.
  const impl = implementable(resolved.body, resolved.unresolved, resolved.authorOnly)
  assert.deepEqual(excludeGroupsOf(impl.policy), [X])
  assert.deepEqual(impl.missing, [], 'and nothing is waiting on an object this tenant could make')
  assert.deepEqual(
    impl.authorOnly.sort(),
    authorGroups.filter((g) => g !== authorIdFor(source, 'exclusionsGroup')).sort(),
    'the three are reported as the author’s own, not dropped in silence',
  )
})

test('2: distinct resolved ids stay distinct, and no id crosses a collection', () => {
  // The author's service-accounts group is this tenant's own; the three groups
  // the same policy excludes are all this tenant's exclusions group. Four author
  // ids, two tenant ids, each named once and each on the side the author put it.
  //
  // Ordering *within* one collection is exercised by 8 below, on a synthetic
  // body: no policy in the pinned baseline resolves two different tenant objects
  // into one list, because only the references this baseline's interpretation
  // settles carry a mapped token at all (src/baseline/interpretation.ts).
  const source = authorPolicy('IAC - GLOBAL – BLOCK – Service Accounts')
  const authorServiceAccounts = authorIdFor(source, 'serviceAccountsGroup')
  assert.equal(excludeGroupsOf(source as unknown as Record<string, unknown>).length, 3, 'the author excludes three groups')
  const resolved = resolveTenantPolicy(source as unknown as Record<string, unknown>, tenant({ serviceAccountsGroupId: SA }), 'service-accounts-trusted-network', POLICIES)
  const impl = implementable(resolved.body, resolved.unresolved, resolved.authorOnly).policy
  assert.deepEqual(usersOf(impl).includeGroups, [SA], 'the group the policy targets is the tenant’s service accounts')
  assert.deepEqual(excludeGroupsOf(impl), [X], 'and what it excludes is the exclusions group, named once')
  assert.deepEqual(resolved.substitutions.get(authorServiceAccounts), [SA])
})

test('8: an unrelated policy’s includes and excludes are untouched, and no id crosses a collection', () => {
  const body = {
    conditions: {
      users: { includeUsers: ['All'], includeGroups: ['g-1', 'g-2'], excludeGroups: ['g-3'], includeRoles: ['r-1', 'r-2'], excludeUsers: ['u-1'] },
      applications: { includeApplications: ['All'], excludeApplications: ['app-1', 'app-2'] },
    },
    grantControls: { operator: 'OR', builtInControls: ['mfa'] },
  }
  const resolved = resolveTenantPolicy(body, tenant({ exclusionsGroupId: null }), 'x')
  // Nothing the tenant does not resolve is changed. The one addition is the slot
  // for the exclusions group every policy the plan writes excludes, which this
  // tenant has not settled: `implementable` takes it back out and the step waits
  // on the group, rather than the policy quietly excluding nobody.
  const withoutSlot = implementable(resolved.body, resolved.unresolved, resolved.authorOnly)
  assert.deepEqual(withoutSlot.policy, body, 'nothing the tenant does not resolve is changed')
  assert.deepEqual(
    withoutSlot.missing,
    [{ token: '{exclusionsGroup}', stepId: PREREQ_STEP_ID.exclusionsGroup }],
    'and the exclusions group is what it waits on',
  )
  const withGroup = resolveTenantPolicy(body, tenant(), 'x')
  const users = usersOf(withGroup.body)
  assert.deepEqual(users.includeGroups, ['g-1', 'g-2'])
  assert.deepEqual(users.excludeGroups, ['g-3', X])
  assert.deepEqual(users.includeRoles, ['r-1', 'r-2'])
  assert.deepEqual((withGroup.body.conditions as Record<string, unknown>).applications, body.conditions.applications)
})

// ---- 4 + 5: an explicit token means that object, or nothing ----

test('4: an explicit serviceAccountsGroup the tenant does not have stays unresolved — it never becomes the exclusions group', () => {
  const source = authorPolicy('IAC - GLOBAL – BLOCK – Service Accounts')
  const authorServiceAccounts = authorIdFor(source, 'serviceAccountsGroup')
  // The tenant has its trusted network, so the group is the one thing left.
  const resolved = resolveTenantPolicy(source as unknown as Record<string, unknown>, tenant({ trustedLocationIds: ['loc-1'] }), 'service-accounts-trusted-network', POLICIES)
  assert.deepEqual(usersOf(resolved.body).includeGroups, [authorServiceAccounts], 'the author’s group is not substituted')
  assert.equal(resolved.substitutions.get(authorServiceAccounts), undefined, 'nothing resolved it')
  assert.equal(resolved.unresolved.get(authorServiceAccounts), PREREQ_STEP_ID.serviceAccountsGroup, 'it waits on the service-accounts-group step')
  assert.equal(resolved.authorOnly.has(authorServiceAccounts), false, 'a group the policy targets is never left out as the author’s own')
  // The exclusions group is still there, where the policy independently needs it.
  assert.ok(excludeGroupsOf(resolved.body).includes(X), 'the exclusions group is applied')
  const impl = implementable(resolved.body, resolved.unresolved, resolved.authorOnly)
  assert.deepEqual(impl.missing.map((m) => m.stepId), [PREREQ_STEP_ID.serviceAccountsGroup])
  assert.ok(!(((usersOf(impl.policy).includeGroups as string[] | undefined) ?? []).includes(authorServiceAccounts)), 'and it is not in the body a channel carries')
  assert.ok(excludeGroupsOf(impl.policy).includes(X), 'while the exclusions group still is')

  // On the plan: every channel waits on it together.
  const { rows } = policySteps('demo-week2')
  const step = rows.find((x) => x.step.goalId === 'service-accounts-trusted-network')
  assert.ok(step, 'the service-accounts step is on the demo plan')
  assert.ok(missingObjects(step.step).some((m) => m.stepId === PREREQ_STEP_ID.serviceAccountsGroup), 'it waits on the service-accounts group')
  assert.equal(implementationOffered(step.step), false)
  assert.equal(step.portal, null, 'no portal instructions')
  assert.equal(jsonOffered(step.step), false, 'no JSON, no PowerShell, no download')
})

test('5: with a service-accounts group of its own, the tenant’s group is used and the exclusions group stays the exclusions group', () => {
  // The policy also names the author's trusted network, so the tenant needs both
  // before anything is offered: the point here is that its own service-accounts
  // group is what stands where the author's did, and that it did not become the
  // exclusions group on the way.
  const { rows, f } = policySteps('demo-week2', { serviceAccountsGroupId: SA, trustedLocationIds: ['loc-1'] })
  const exclusions = f.mapping.records['__globalExclusion']?.resolvedId
  assert.ok(exclusions)
  const step = rows.find((x) => x.step.goalId === 'service-accounts-trusted-network')
  assert.ok(step, 'the service-accounts step is on the plan')
  assert.equal(implementationOffered(step.step), true, 'nothing is missing now')
  assert.equal(jsonOffered(step.step), true)
  const json = policyJson(step.step) as Record<string, unknown>
  assert.deepEqual(usersOf(json).includeGroups, [SA], 'the tenant’s own service-accounts group is the target')
  assert.deepEqual(excludeGroupsOf(json), [exclusions], 'and the exclusions group is still the exclusions group')
  assert.notEqual(SA, exclusions, 'two distinct tenant objects, neither standing in for the other')
  assert.ok(step.portal && step.portal.length > 0, 'the portal instructions render')
  assert.match(step.portal.join('\n'), /Core - Exclusions/, 'the instruction names the exclusions group')
})

// ---- 3: a confirmed per-reference mapping wins, and every channel agrees ----

test('3: a confirmed mapping for one author reference wins over the token and the fallback, on every channel', () => {
  const source = authorPolicy('IAC - GLOBAL – SESSION – Admin Persistence (4 Hours)')
  const authorExclusions = authorIdFor(source, 'exclusionsGroup')
  const resolved = resolveTenantPolicy(source as unknown as Record<string, unknown>, tenant({ confirmed: new Map([[authorExclusions, CONFIRMED]]) }), 'admin-session', POLICIES)
  assert.deepEqual(resolved.substitutions.get(authorExclusions), [CONFIRMED], 'the confirmed object wins over the token')
  // Two distinct tenant objects, each named once: the confirmed group where the
  // author's own exclusions group stood, and the tenant's exclusions group every
  // policy the plan writes carries. The author's other group is left out.
  assert.deepEqual(excludeGroupsOf(implementable(resolved.body, resolved.unresolved, resolved.authorOnly).policy), [CONFIRMED, X])

  // On the plan: the record a person saved travels into the step, and Portal,
  // JSON, PowerShell and Download all describe that same body. Portal cannot
  // rebuild this mapping from names, so it would lose the object if it tried.
  const base = fixture('demo-week2')
  const record = { placeholder: authorExclusions, kind: 'group', group: 'placeholders' as const, resolvedId: CONFIRMED, resolvedName: 'Confirmed exclusions', provenance: 'confirmed' as const, doesNotExist: false, validation: null }
  const { rows } = policySteps('demo-week2', { records: { ...base.mapping.records, [authorExclusions]: record } })
  const step = rows.find((x) => x.step.goalId === 'admin-session')
  assert.ok(step, 'the admin-session step is on the plan')
  assert.ok(excludeGroupsOf(step.step.action.resolution!.policies[0].body).includes(CONFIRMED), 'the step’s resolved body carries the confirmed object')
  assert.equal(jsonOffered(step.step), true)
  const body = policyJson(step.step) as Record<string, unknown>
  assert.ok(excludeGroupsOf(body).includes(CONFIRMED), 'the JSON carries it')
  assert.ok(powershellFor(stepOperations(step.step)).includes(CONFIRMED), 'the PowerShell wraps the same body')
  assert.equal(policyJsonText(step.step), JSON.stringify(body, null, 2), 'the download is that text')
  assert.ok(step.portal && step.portal.length > 0, 'the portal instructions render')
  // Two distinct tenant objects are excluded, and the instruction names both:
  // the exclusions group in its own sentence, the confirmed group by name. A
  // line that collapsed the second into the first would leave a person excluding
  // one group where the body excludes two.
  assert.deepEqual(excludeGroupsOf(body), [CONFIRMED, X_TENANT(step.step)], 'the body excludes both, in order')
  const named = (id: string): string => (id === CONFIRMED ? 'Confirmed exclusions' : id)
  const lines = stepPortalLines(step.step, { nameOf: named, policyName: step.step.title }) ?? []
  const users = lines.find((l) => l.startsWith('Users → Include:'))
  assert.ok(users, JSON.stringify(lines))
  assert.match(users, /Users → Exclude → Groups: /, 'the exclusions group keeps its own sentence')
  assert.match(users, /Also exclude the groups Confirmed exclusions\./, `the confirmed group is named: ${users}`)
})

// ---- 6: one unresolved list, one answer from all four channels ----

test('6: an object the tenant does not have withholds Portal, JSON, PowerShell and Download together', () => {
  const { rows } = policySteps('demo-week2')
  let gated = 0
  let offered = 0
  let unearned = 0
  for (const { step, portal } of rows) {
    if ((step.action.resolution?.policies.length ?? 0) === 0) continue
    if (missingObjects(step).length > 0) {
      gated += 1
      assert.equal(implementationOffered(step), false, `${step.id}: the one gate is shut`)
      assert.equal(portal, null, `${step.id}: no portal instructions`)
      assert.equal(jsonOffered(step), false, `${step.id}: no JSON, no PowerShell, no download`)
      continue
    }
    // The same one gate, held for the other reason it has: a policy already in
    // report-only whose only remaining submission is the enforcement its window
    // has not earned (`observation-incomplete`). All four channels shut
    // together, exactly as a missing object shuts them — and for the same
    // reason, that nothing may hand over a change the plan itself says to wait
    // for. There is no second answer anywhere downstream.
    if (enforcementUnearned(step)) {
      unearned += 1
      assert.equal(implementationOffered(step), false, `${step.id}: the one gate is shut while the window is open`)
      assert.equal(portal, null, `${step.id}: no portal instructions while the window is open`)
      assert.equal(jsonOffered(step), false, `${step.id}: no JSON, no PowerShell, no download either`)
      continue
    }
    assert.equal(implementationOffered(step), true, `${step.id}: the gate is open`)
    offered += 1
    if (step.action.json) assert.equal(jsonOffered(step), true, `${step.id}: the JSON is offered with it`)
  }
  assert.ok(gated >= 2, `more than one gated policy exercised (${gated})`)
  assert.ok(offered >= 5, `more than one offered policy exercised (${offered})`)
  assert.ok(unearned >= 1, `the report-only case exercised (${unearned})`)
})

test('6: the countries block waits on the allowed-countries location, and nothing actionable escapes', () => {
  const { rows } = policySteps('demo-week2')
  const geo = rows.find((r) => r.step.goalId === 'geo-restriction')
  assert.ok(geo, 'the countries block is in the plan')
  assert.ok(missingObjects(geo.step).some((m) => m.stepId === PREREQ_STEP_ID.allowedCountries), 'it names the step that creates the location')
  assert.equal(geo.portal, null, 'no portal instructions')
  assert.equal(jsonOffered(geo.step), false, 'no JSON, no PowerShell, no download')
})

// ---- every offered channel carries the one body ----

test('portal, JSON, PowerShell and download carry the one resolved body, with the exclusions group named once', () => {
  const { f, rows } = policySteps('demo-week2')
  const exclusionsGroupId = f.mapping.records['__globalExclusion']?.resolvedId
  assert.ok(exclusionsGroupId, 'the demo tenant has a recognised exclusions group')
  const groupName = 'Core - Exclusions'
  let checked = 0
  for (const { step, portal } of rows) {
    if (!jsonOffered(step)) continue
    const body = policyJson(step) as Record<string, unknown>
    // A bounded patch is not a whole policy. The update that enforces a policy
    // already deployed in report-only submits the one field it controls and
    // nothing else — that is Foundation A's patch semantics and the reason the
    // tenant's own settings survive it — so it carries no user scope to check.
    // Where a body does scope users, the exclusions group is in it exactly once;
    // where it does not, no channel may name a group the body never mentions.
    const scoped = ((body.conditions ?? {}) as Record<string, unknown>).users !== undefined
    const groups = excludeGroupsOf(body)
    assert.equal(groups.filter((g) => g === exclusionsGroupId).length, scoped ? 1 : 0, `${step.id}: excludeGroups names the exclusions group once, and only where the body scopes users`)
    assert.equal(new Set(groups).size, groups.length, `${step.id}: no duplicate group id`)
    if (portal) assert.equal(portal.join('\n').split(groupName).length - 1, scoped ? 1 : 0, `${step.id}: the portal lines name ${groupName} once, and only where the body scopes users`)
    const ps = powershellFor(stepOperations(step))
    const heredoc = ps.slice(ps.indexOf("@'\n") + 3, ps.indexOf("\n'@"))
    assert.deepEqual(JSON.parse(heredoc), body, `${step.id}: the PowerShell body is the JSON body`)
    assert.equal(ps.split(exclusionsGroupId).length - 1, scoped ? 1 : 0, `${step.id}: the PowerShell names the exclusions group once, and only where the body scopes users`)
    assert.equal(policyJsonText(step), JSON.stringify(body, null, 2), `${step.id}: the download is the JSON tab's body`)
    checked += 1
  }
  assert.ok(checked >= 5, `more than one policy exercised (${checked})`)
})

test('no step on any fixture ships a duplicated id in any collection', () => {
  for (const name of ['demo-week2', 'mid', 'small', 'large'] as const) {
    const { rows } = policySteps(name)
    for (const { step } of rows) {
      if (!step.action.json) continue
      const seen: string[] = []
      const walk = (v: unknown, path: string): void => {
        if (Array.isArray(v)) {
          const strings = v.filter((x) => typeof x === 'string') as string[]
          if (new Set(strings).size !== strings.length) seen.push(`${name}/${step.id}${path}`)
          for (const x of v) walk(x, path)
          return
        }
        if (v !== null && typeof v === 'object') for (const [k, val] of Object.entries(v as Record<string, unknown>)) walk(val, `${path}.${k}`)
      }
      walk(JSON.parse(step.action.json), '')
      assert.deepEqual(seen, [], 'no collection repeats an id')
    }
  }
})

// ---- 7: what this run must not have moved ----

test('7: the admin-portals baseline conflict still suppresses every implementation channel', () => {
  const { rows } = policySteps('demo-week2')
  const admin = rows.find((r) => r.step.goalId === 'admin-portals-protected')
  assert.ok(admin, 'the admin-portals step is in the plan')
  assert.equal(admin.portal, null, 'no portal lines')
  assert.equal(jsonOffered(admin.step), false, 'no JSON, PowerShell or download')
})

test('emergency access and the exclusions group are unchanged outside policy resolution', () => {
  const { f, r, rows } = policySteps('demo-week2')
  assert.ok(f.mapping.breakGlassUserIds.length > 0, 'the tenant has emergency-access accounts')
  assert.ok(r.steps.some((s) => s.id === 's-prereq-exclusion-group'), 'the exclusions-group step still stands')
  assert.ok(r.steps.some((s) => s.id === 's-prereq-break-glass'), 'the emergency-access step still stands')
  const tenantObjects = tenant({ exclusionsGroupId: f.mapping.records['__globalExclusion']?.resolvedId ?? null })
  for (const p of POLICIES) {
    const resolved = resolveTenantPolicy(p as unknown as Record<string, unknown>, tenantObjects, 'x', POLICIES)
    const text = JSON.stringify(resolved.body)
    for (const id of f.mapping.breakGlassUserIds) assert.doesNotMatch(text, new RegExp(id, 'i'), `${p.displayName}: resolution names no emergency account`)
  }
  const names = new Set(f.mapping.breakGlassUserIds.map((id) => r.input.names!.label(id)))
  for (const { step, portal } of rows) for (const line of portal ?? []) for (const n of names) assert.ok(!line.includes(n), `${step.id}: no emergency account named on a portal line`)
})


// ---- the answer is applied once, at the boundary ----

test('an answered deviation is in the step once, and every channel carries it', () => {
  // The partner answer excludes the Service provider type from the guests
  // policy. The step's own body carries it; nothing re-applies it downstream.
  const f = fixture('demo-week2')
  const answered = applyStepDecisions(f.mapping, f.decisions ?? null)
  const { of } = bareSteps('demo-week2', answered)
  const { step, portal } = of('guests-mfa')
  assert.equal(implementationOffered(step), true)
  const bodies = policyJson(step) as Record<string, unknown>[]
  const guestTypes = (b: Record<string, unknown>): string =>
    String((((b.conditions as Record<string, unknown>).users as Record<string, unknown>).excludeGuestsOrExternalUsers as { guestOrExternalUserTypes?: string } | undefined)?.guestOrExternalUserTypes ?? '')
  assert.ok(bodies.some((b) => guestTypes(b) === 'serviceProvider'), 'the JSON carries the answer')
  assert.ok(portal && portal.some((l) => /Service provider users/.test(l)), 'the instructions carry it')
  assert.ok(portal.some((l) => /the baseline's version/.test(l)), 'and the baseline\'s version beside it')
  assert.ok(powershellFor(stepOperations(step)).includes('serviceProvider'), 'the PowerShell wraps the same bodies')
  assert.equal(policyJsonText(step), JSON.stringify(bodies, null, 2), 'the download is that text')
  // The answer is in the body once: applying it again would change nothing.
  assert.deepEqual(bodies.map(guestTypes), bodies.map((b) => guestTypes(applyDeviations(structuredClone(b), 'guests-mfa', answered))))
})

test('the step is authoritative: another mapping context does not move its instructions', () => {
  const f = fixture('demo-week2')
  const answered = applyStepDecisions(f.mapping, f.decisions ?? null)
  const { of, ctx } = bareSteps('demo-week2', answered)
  const { step, portal } = of('guests-mfa')
  // A context whose answers contradict the ones the step was built from, and a
  // context with none at all: the lines are the step's, so neither moves them.
  for (const other of [{ ...ctx, mapping: { ...ctx.mapping, questionAnswers: {} } }, { ...ctx, mapping: f.mapping }]) {
    const lines = stepPortalLines(step, portalNamesFor(other as StepVarContext, stepVars(step, other as StepVarContext) as Record<string, unknown>, step.title))
    assert.deepEqual(lines, portal, 'the instructions are the step\'s')
  }
})

// ---- the trusted network: the tenant's own locations, or nothing ----

test('an explicit trustedLocation with none selected stays unresolved and gates all four channels', () => {
  const { of } = bareSteps('demo-week2', { trustedLocationIds: [], serviceAccountsGroupId: SA })
  const { step, portal } = of('service-accounts-trusted-network')
  assert.ok(missingObjects(step).some((m) => m.stepId === PREREQ_STEP_ID.trustedLocation), 'it waits on the trusted-network step')
  assert.equal(implementationOffered(step), false)
  assert.equal(portal, null, 'no portal instructions')
  assert.equal(jsonOffered(step), false, 'no JSON, no PowerShell, no download')
})

test('the trusted locations the tenant selected stand where the author\'s one stood, in order, once each', () => {
  const trusted = ['00000000-aaaa-4000-8000-000000000001', '00000000-aaaa-4000-8000-000000000002']
  const { of, ctx } = bareSteps('demo-week2', { trustedLocationIds: trusted, serviceAccountsGroupId: SA })
  const { step, portal } = of('service-accounts-trusted-network')
  assert.equal(implementationOffered(step), true, 'nothing is missing now')
  const body = policyJson(step) as Record<string, unknown>
  const locations = (body.conditions as Record<string, unknown>).locations as { excludeLocations?: string[] }
  assert.deepEqual(locations.excludeLocations, trusted, 'both, in the tenant\'s order, once each')
  const text = (portal ?? []).join('\n')
  for (const id of trusted) assert.ok(text.includes(ctx.nameOf(id)), 'the instruction names it')
  assert.ok(powershellFor(stepOperations(step)).includes(trusted[1]), 'the PowerShell wraps the same body')
  assert.equal(policyJsonText(step), JSON.stringify(body, null, 2), 'the download is that text')
})

// ---- a confirmed reference, named on every channel ----

test('a confirmed object on an include is the object every channel names', () => {
  // The author's service-accounts group, on the policy that includes it, mapped
  // by a person to a tenant group of their own. Portal could not name it from
  // the mapping's own service-accounts group, so this fails if the lines are
  // rebuilt rather than read off the step.
  const source = authorPolicy('IAC - GLOBAL – BLOCK – Service Accounts')
  const authorGroup = authorIdFor(source, 'serviceAccountsGroup')
  const base = fixture('demo-week2')
  const record = { placeholder: authorGroup, kind: 'group', group: 'placeholders' as const, resolvedId: CONFIRMED, resolvedName: 'Confirmed service accounts', provenance: 'confirmed' as const, doesNotExist: false, validation: null }
  const { of } = bareSteps('demo-week2', {
    records: { ...base.mapping.records, [authorGroup]: record },
    trustedLocationIds: ['00000000-aaaa-4000-8000-000000000001'],
    serviceAccountsGroupId: SA,
  })
  const { step } = of('service-accounts-trusted-network')
  assert.equal(implementationOffered(step), true)
  const body = policyJson(step) as Record<string, unknown>
  const users = (body.conditions as Record<string, unknown>).users as Record<string, unknown>
  assert.deepEqual(users.includeGroups, [CONFIRMED], 'the JSON includes the confirmed object, not the mapping\'s service-accounts group')
  const named = (id: string): string => (id === CONFIRMED ? 'Confirmed service accounts' : id)
  const lines = stepPortalLines(step, { nameOf: named, policyName: step.title }) ?? []
  assert.ok(lines.some((l) => l.includes('Confirmed service accounts')), `the instruction names it: ${lines.join(' | ')}`)
  assert.ok(powershellFor(stepOperations(step)).includes(CONFIRMED), 'the PowerShell wraps the same body')
  assert.equal(policyJsonText(step), JSON.stringify(body, null, 2), 'the download is that text')
})

// ---- a goal the baseline implements with two policies ----

test('the guests pair carries both policies, in the baseline\'s order, on every channel', () => {
  const { of, ctx } = bareSteps('demo-week2')
  const { step, portal } = of('guests-mfa')
  const carried = step.action.resolution?.policies ?? []
  assert.equal(carried.length, 2, 'the step carries both')
  assert.equal(implementationOffered(step), true)
  const bodies = policyJson(step) as Record<string, unknown>[]
  assert.ok(Array.isArray(bodies) && bodies.length === 2, 'the JSON is both bodies')
  assert.deepEqual(bodies.map((b) => b.displayName), carried.map((c) => c.body.displayName), 'the same policies, in the same order')
  const roots = (portal ?? []).filter((l) => /^Policy [AB] — /.test(l))
  assert.equal(roots.length, 2, 'two labelled blocks')
  assert.ok(roots[0].startsWith(`Policy A — ${bodies[0].displayName}: `), roots[0])
  assert.ok(roots[1].startsWith(`Policy B — ${bodies[1].displayName}: `), roots[1])
  const ps = powershellFor(stepOperations(step))
  assert.equal((ps.match(/New-MgIdentityConditionalAccessPolicy/g) ?? []).length, 2, 'a command per policy')
  assert.ok(ps.indexOf(String(bodies[0].displayName)) < ps.indexOf(String(bodies[1].displayName)), 'in the same order')
  assert.equal(policyJsonText(step), JSON.stringify(bodies, null, 2), 'the download is that text')
  assert.ok(ctx.nameOf.length >= 0)
})

test('one unresolved reference in either policy of a pair gates all four channels', () => {
  // The tenant has no exclusions group: both guests policies exclude one, so
  // neither can be written and the step offers nothing.
  const { of } = bareSteps('demo', { records: {} })
  const { step, portal } = of('guests-mfa')
  assert.equal((step.action.resolution?.policies ?? []).length, 2, 'both policies are still described')
  assert.ok(missingObjects(step).length > 0, 'something is missing')
  assert.equal(implementationOffered(step), false)
  assert.equal(portal, null, 'no portal instructions')
  assert.equal(jsonOffered(step), false, 'no JSON, no PowerShell, no download')
})

// ---- a step with nothing to create ----

test('a goal already in place has no artifact, so it offers no implementation on any channel', () => {
  const { rows } = policySteps('demo-week2')
  const done = rows.filter((x) => x.step.status === 'done' && x.cs.kind === 'policy')
  assert.ok(done.length >= 3, `the demo holds goals already in place (${done.length})`)
  for (const { step, portal } of done) {
    assert.equal(step.action.json, null, `${step.id}: nothing to create`)
    assert.equal(implementationOffered(step), false, `${step.id}: no implementation offered`)
    assert.equal(portal, null, `${step.id}: no instructions for a second copy`)
    assert.equal(jsonOffered(step), false, `${step.id}: no JSON, no PowerShell, no download`)
  }
})


// ---- an update is one operation: one mode, one target, one body ----

test('a single-policy change is one update operation, and every channel carries that exact body', () => {
  const f = fixture('demo-week2')
  const exclusions = f.mapping.records['__globalExclusion']?.resolvedId ?? null
  const rows = ((f.snapshot.config.caPolicies?.rows ?? []) as Record<string, unknown>[]).map((p) => (/Admins phishing-resistant/.test(String(p.displayName)) ? weakAdminsPolicy(exclusions) : p))
  const { of, ctx } = withTenantPolicies(rows, (p) => p, { adminsReady: true })
  const { step, portal } = of('admins-phishing-resistant')
  assert.equal(step.kind, 'adjust')
  assert.equal(implementationOffered(step), true)
  const ops = stepOperations(step)
  assert.equal(ops.length, 1, 'one policy, one operation')
  assert.equal(ops[0].mode, 'update')
  assert.equal(ops[0].policyId, 'p-admins', 'it names the tenant policy it changes')
  // JSON, PowerShell and Download are that one body.
  assert.deepEqual(policyJson(step), ops[0].body, 'the JSON is the operation body')
  assert.equal(policyJsonText(step), JSON.stringify(ops[0].body, null, 2), 'the download is that text')
  const ps = powershellFor(ops)
  assert.ok(ps.includes("Update-MgIdentityConditionalAccessPolicy -ConditionalAccessPolicyId 'p-admins'"), 'the PowerShell updates that policy')
  assert.ok(!ps.includes('New-MgIdentityConditionalAccessPolicy'), 'and creates nothing')
  const heredoc = ps.slice(ps.indexOf("@'\n") + 3, ps.indexOf("\n'@"))
  assert.deepEqual(JSON.parse(heredoc), ops[0].body, 'the PowerShell body is the JSON body')
  // The whole policy it is working towards travels for explanation only.
  assert.ok(ops[0].target, 'the target is carried')
  assert.notDeepEqual(ops[0].target, ops[0].body, 'and it is not what is submitted')
  assert.ok(ctx.nameOf.length >= 0)

  // The instruction opens the tenant's own policy and lists the body's fields.
  assert.ok(portal && portal.length > 0)
  assert.match(portal[0], /open "Core - Grant - Admins phishing-resistant"/, 'it opens the policy the operation names')
  assert.ok(!portal.some((l) => /New policy/.test(l)), 'it never says New policy')
  assert.ok(!portal.some((l) => /^Name: /.test(l)), 'and never names a policy to create')
  assert.ok(portal.some((l) => /^Grant → /.test(l)), 'the field the body changes is listed')
  assert.ok(portal.some((l) => /leave every other setting on this policy as it is/.test(l)), 'and the rest is left alone')
  // The fields the update body does not carry are not instructed.
  assert.ok(!portal.some((l) => /^Users → /.test(l)), 'the users are not touched')
  assert.ok(!portal.some((l) => /^Target resources → /.test(l)), 'the resources are not touched')
  assert.ok(!portal.some((l) => /^Session → /.test(l)), 'the tenant’s own session control is not touched')
  assert.equal(((ops[0].body as Record<string, unknown>).sessionControls), undefined, 'and the body does not carry it either')

  // The body's fields and the instruction's lines are the same set: nothing the
  // body carries goes uninstructed, and nothing is changed that the body leaves
  // out — the description included, which a person was never shown.
  const body = ops[0].body as Record<string, unknown>
  assert.deepEqual(Object.keys(body).sort(), ['grantControls'], 'the update carries the one section that changes')
  assert.equal(body.description, undefined, 'no hidden description change')
  assert.equal(body.state, undefined, 'and no hidden state change')
  const instructed = portal.filter((l) => /^(Users|Target resources|Conditions|Grant|Session|Enable policy) /.test(l))
  assert.equal(instructed.length, 1, `one field listed, for the one field the body carries: ${instructed.join(' | ')}`)
  assert.match(instructed[0], /^Grant → /)
})

// ---- a pair with one half already there ----

test('a partly-built pair is one update and one create, each on its own policy, in the baseline’s order', () => {
  const f = fixture('demo-week2')
  const exclusions = f.mapping.records['__globalExclusion']?.resolvedId ?? null
  const { of } = withTenantPolicies([guestsMemberA('CA - Require - MFA for guests and external users', exclusions)])
  const { step, portal } = of('guests-mfa')
  assert.equal(implementationOffered(step), true)
  const ops = stepOperations(step)
  assert.equal(ops.length, 2, 'both members are operations')
  assert.equal(ops[0].mode, 'update')
  assert.equal(ops[0].policyId, 'p-guests-a', 'the member the tenant already has is an update to its own policy')
  assert.equal(ops[1].mode, 'create')
  assert.equal(ops[1].policyId, null, 'the missing member is a create')
  assert.notEqual(ops[0].sourceName, ops[1].sourceName, 'two baseline policies, in the baseline’s order')
  assert.equal(new Set(ops.map((o) => o.policyId).filter(Boolean)).size, 1, 'no tenant policy is reused for another member')
  // The bodies, in that order, on every channel.
  const bodies = policyJson(step) as Record<string, unknown>[]
  assert.deepEqual(bodies, ops.map((o) => o.body), 'the JSON is the operations’ bodies, in order')
  assert.equal(policyJsonText(step), JSON.stringify(bodies, null, 2), 'the download is that text')
  const ps = powershellFor(ops)
  assert.ok(ps.includes("Update-MgIdentityConditionalAccessPolicy -ConditionalAccessPolicyId 'p-guests-a'"), 'one update, on its own policy')
  assert.equal((ps.match(/New-MgIdentityConditionalAccessPolicy/g) ?? []).length, 1, 'one create')
  assert.ok(ps.indexOf('$bodyA') < ps.indexOf('$bodyB'), 'in the step’s order')
  // Two blocks: one opens the existing policy, one creates the missing member.
  const roots = (portal ?? []).filter((l) => /^Policy [AB] — /.test(l))
  assert.equal(roots.length, 2, JSON.stringify(portal))
  assert.match(roots[0], /open "CA - Require - MFA for guests and external users"/, 'A opens the policy the tenant has')
  assert.match(roots[1], /New policy$/, 'B is a new policy')
})

test('a pair whose halves the plan cannot tell apart is withheld, not guessed', () => {
  const f = fixture('demo-week2')
  const exclusions = f.mapping.records['__globalExclusion']?.resolvedId ?? null
  const { of } = withTenantPolicies([guestsMemberA('Some other name entirely', exclusions)])
  const { step, portal } = of('guests-mfa')
  assert.equal(step.action.unmatchedPair, true, 'the plan says it cannot match the pair')
  assert.equal(step.action.json, null, 'nothing executable')
  assert.equal(implementationOffered(step), false)
  assert.equal(portal, null, 'no instructions')
  assert.equal(jsonOffered(step), false, 'no JSON, no PowerShell, no download')
  assert.ok(!step.events, 'and nothing is scheduled for it')
})

// ---- unresolved: no artifact, and nothing that implies a rollout ----

test('an unresolved service-accounts reference leaves no executable body and no channel', () => {
  const { rows } = policySteps('demo-week2')
  const step = rows.find((x) => x.step.goalId === 'service-accounts-trusted-network')
  assert.ok(step, 'the service-accounts step is on the plan')
  assert.ok(missingObjects(step.step).some((m) => m.stepId === PREREQ_STEP_ID.serviceAccountsGroup), 'it waits on the service-accounts group')
  assert.equal(step.step.action.json, null, 'no executable body is exposed')
  assert.deepEqual(stepOperations(step.step), [], 'no operation to run')
  assert.equal(implementationOffered(step.step), false)
  assert.equal(step.portal, null, 'no portal instructions')
  assert.equal(jsonOffered(step.step), false, 'no JSON, no PowerShell, no download')
  assert.equal(policyJsonText(step.step), JSON.stringify({ note: 'Portal steps show the policy to create.' }, null, 2), 'and nothing downloadable stands in for it')
})

test('an unresolved step is not scheduled and carries nothing that implies a rollout, but still names what it waits on', () => {
  const { r, ctx, rows } = policySteps('demo-week2')
  const row = rows.find((x) => x.step.goalId === 'service-accounts-trusted-network')
  assert.ok(row)
  const step = row.step
  assert.ok(!step.events, 'no enforcement or announcement event')
  assert.ok(!r.steps.some((x) => x.id === step.id && x.events), 'and no calendar entry can be made from it')
  const view = stepExportView(step, ctx)
  // The completion is the one the screen shows, and on a policy waiting on an
  // object that is what would clear the wait — not the rollout's gates.
  assert.deepEqual(view.doneWhen, stepContract(step, ctx).doneWhen, "the completion is not the screen's")
  assert.equal(view.doneWhen.length, 1, `one resolution completion: ${view.doneWhen.join(' | ')}`)
  assert.ok(!/report-only|sign-in failures|%/i.test(view.doneWhen.join(' ')), `a rollout completion leaked: ${view.doneWhen.join(' | ')}`)
  assert.equal(view.ifWrong, null, 'no rollback instructions')
  assert.equal(view.dates, null, 'no rollout dates')
  const cs = contentStepFor(step) as Record<string, unknown>
  assert.equal(commsFor(cs, stepVars(step, ctx) as Record<string, unknown>, step), null, 'nothing to announce')
  // What it does say: the object it waits on and the step that creates it.
  assert.ok(view.whatToDo.some((l) => /first: this policy names an object/.test(l)), view.whatToDo.join(' | '))
  assert.ok(view.whatToDo.some((l) => /Service Accounts Group/.test(l)), 'the Preparation step is named')
})


// ---- the three reasons, on the screen and in the export ----

test('an unmatched pair and a contradictory baseline carry a next action and no rollout', () => {
  const f = fixture('demo-week2')
  const exclusions = f.mapping.records['__globalExclusion']?.resolvedId ?? null
  const pair = withTenantPolicies([guestsMemberA('Some other name entirely', exclusions)])
  const cases: { label: string; step: Step; ctx: StepVarContext; says: RegExp }[] = [
    { label: 'unmatched pair', step: pair.of('guests-mfa').step, ctx: pair.ctx, says: /IAMAI cannot match to either/ },
  ]
  const plain = policySteps('demo-week2')
  const conflicted = plain.rows.find((x) => x.step.goalId === 'admin-portals-protected')
  assert.ok(conflicted)
  cases.push({ label: 'baseline conflict', step: conflicted.step, ctx: plain.ctx, says: /Both cannot be true/ })
  for (const c of cases) {
    assert.equal(implementationOffered(c.step), false, `${c.label}: no implementation`)
    assert.equal(jsonOffered(c.step), false, `${c.label}: no JSON, PowerShell or download`)
    assert.deepEqual(stepOperations(c.step), [], `${c.label}: no operation to run`)
    assert.ok(!c.step.events, `${c.label}: nothing scheduled`)
    assert.deepEqual(c.step.rings, [], `${c.label}: no rings`)
    const view = stepExportView(c.step, c.ctx)
    assert.deepEqual(view.doneWhen, stepContract(c.step, c.ctx).doneWhen, `${c.label}: the completion is not the screen's`)
    assert.equal(view.doneWhen.length, 1, `${c.label}: one resolution completion — ${view.doneWhen.join(' | ')}`)
    assert.ok(!/report-only|sign-in failures|%/i.test(view.doneWhen.join(' ')), `${c.label}: a rollout completion leaked — ${view.doneWhen.join(' | ')}`)
    assert.equal(view.ifWrong, null, `${c.label}: no rollback`)
    assert.equal(view.dates, null, `${c.label}: no dates`)
    const cs = contentStepFor(c.step) as Record<string, unknown>
    assert.equal(commsFor(cs, stepVars(c.step, c.ctx) as Record<string, unknown>, c.step), null, `${c.label}: nothing announced`)
    assert.ok(view.whatToDo.some((l) => c.says.test(l)), `${c.label}: it says what to do — ${view.whatToDo.join(' | ')}`)
  }
})

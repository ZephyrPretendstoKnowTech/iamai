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
import { runFixture } from './fixtures/run.ts'
import { contentStepFor } from '../content/stepTitle.ts'
import { stepVars } from '../ui/surfaces/stepVars.ts'
import type { StepVarContext } from '../ui/surfaces/stepVars.ts'
import { portalNamesFor, stepPortalLines } from '../ui/surfaces/stepPortal.ts'
import { implementationOffered, jsonOffered, missingObjects, policyJson, policyJsonText } from '../ui/surfaces/stepJson.ts'
import { powershellFor } from '../ui/surfaces/stepPowerShell.ts'
import type { MappingState } from '../mapping/types.ts'
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

// ---- 1 + 2 + 8: the resolved object itself ----

test('1: the author’s four exclusion groups on one policy resolve to the tenant’s one exclusions group, once', () => {
  // Jon Hope's SharePoint block excludes three travellers groups and the
  // author's own exclusions group: four author objects, one tenant group.
  const source = authorPolicy('IAC - APP - BLOCK - SharePoint-OneDrive-NonTrustedLocations')
  assert.equal(excludeGroupsOf(source as unknown as Record<string, unknown>).length, 4, 'the author names four groups')
  const resolved = resolveTenantPolicy(source as unknown as Record<string, unknown>, tenant(), 'x', POLICIES)
  assert.deepEqual(excludeGroupsOf(resolved.body), [X], 'the tenant group is named once')
  // Not a string check: the array on the object holds one entry, and the body an
  // implementation channel carries keeps it that way.
  assert.deepEqual(excludeGroupsOf(implementable(resolved.body, resolved.unresolved).policy), [X])
})

test('2: distinct resolved ids stay distinct and keep first-occurrence order', () => {
  const source = authorPolicy('IAC - INTUNE - GRANT - RequireCompliantDevice')
  // The author's service-accounts group is this tenant's own; its two other
  // groups are the exclusions group. Three author ids, two tenant ids, in the
  // order the first of each appeared.
  const resolved = resolveTenantPolicy(source as unknown as Record<string, unknown>, tenant({ serviceAccountsGroupId: SA }), 'require-managed-device', POLICIES)
  assert.deepEqual(excludeGroupsOf(resolved.body), [SA, X])
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
  assert.deepEqual(resolved.body, body, 'nothing the tenant does not resolve is changed')
  const withGroup = resolveTenantPolicy(body, tenant(), 'x')
  const users = usersOf(withGroup.body)
  assert.deepEqual(users.includeGroups, ['g-1', 'g-2'])
  assert.deepEqual(users.excludeGroups, ['g-3', X])
  assert.deepEqual(users.includeRoles, ['r-1', 'r-2'])
  assert.deepEqual((withGroup.body.conditions as Record<string, unknown>).applications, body.conditions.applications)
})

// ---- 4 + 5: an explicit token means that object, or nothing ----

test('4: an explicit serviceAccountsGroup the tenant does not have stays unresolved — it never becomes the exclusions group', () => {
  const source = authorPolicy('IAC - INTUNE - GRANT - RequireCompliantDevice')
  const authorServiceAccounts = authorIdFor(source, 'serviceAccountsGroup')
  const resolved = resolveTenantPolicy(source as unknown as Record<string, unknown>, tenant(), 'require-managed-device', POLICIES)
  assert.ok(excludeGroupsOf(resolved.body).includes(authorServiceAccounts), 'the author’s group is not substituted')
  assert.equal(resolved.substitutions.get(authorServiceAccounts), undefined, 'nothing resolved it')
  assert.equal(resolved.unresolved.get(authorServiceAccounts), PREREQ_STEP_ID.serviceAccountsGroup, 'it waits on the service-accounts-group step')
  // The exclusions group is still there, where the policy independently needs it.
  assert.ok(excludeGroupsOf(resolved.body).includes(X), 'the exclusions group is applied')
  const impl = implementable(resolved.body, resolved.unresolved)
  assert.deepEqual(impl.missing.map((m) => m.stepId), [PREREQ_STEP_ID.serviceAccountsGroup])
  assert.ok(!excludeGroupsOf(impl.policy).includes(authorServiceAccounts), 'and it is not in the body a channel carries')
  assert.ok(excludeGroupsOf(impl.policy).includes(X), 'while the exclusions group still is')

  // On the plan: every channel waits on it together.
  const { rows } = policySteps('demo-week2')
  const step = rows.find((x) => x.step.goalId === 'require-managed-device')
  assert.ok(step, 'the compliant-device step is on the demo plan')
  assert.ok(missingObjects(step.step).some((m) => m.stepId === PREREQ_STEP_ID.serviceAccountsGroup), 'it waits on the service-accounts group')
  assert.equal(implementationOffered(step.step), false)
  assert.equal(step.portal, null, 'no portal instructions')
  assert.equal(jsonOffered(step.step), false, 'no JSON, no PowerShell, no download')
})

test('5: with a service-accounts group of its own, the tenant’s group is used and the exclusions group stays the exclusions group', () => {
  const { rows, f } = policySteps('demo-week2', { serviceAccountsGroupId: SA })
  const exclusions = f.mapping.records['__globalExclusion']?.resolvedId
  assert.ok(exclusions)
  const step = rows.find((x) => x.step.goalId === 'require-managed-device')
  assert.ok(step, 'the compliant-device step is on the plan')
  assert.equal(implementationOffered(step.step), true, 'nothing is missing now')
  assert.equal(jsonOffered(step.step), true)
  assert.deepEqual(excludeGroupsOf(policyJson(step.step) as Record<string, unknown>), [SA, exclusions], 'two tenant objects, distinct, in first-occurrence order')
  assert.ok(step.portal && step.portal.length > 0, 'the portal instructions render')
  const text = step.portal.join('\n')
  assert.match(text, /Also exclude the service accounts group/, 'the instruction names the service-accounts group')
  assert.match(text, /Core - Exclusions/, 'and the exclusions group')
})

// ---- 3: a confirmed per-reference mapping wins, and every channel agrees ----

test('3: a confirmed mapping for one author reference wins over the token and the fallback, on every channel', () => {
  const source = authorPolicy('IAC - GLOBAL – SESSION – Admin Persistence (4 Hours)')
  const authorExclusions = authorIdFor(source, 'exclusionsGroup')
  const resolved = resolveTenantPolicy(source as unknown as Record<string, unknown>, tenant({ confirmed: new Map([[authorExclusions, CONFIRMED]]) }), 'admin-session', POLICIES)
  assert.equal(resolved.substitutions.get(authorExclusions), CONFIRMED, 'the confirmed object wins over the token')
  // The travellers group still resolves by the generic rule to the tenant's
  // exclusions group: two distinct ids, each named once.
  assert.deepEqual(excludeGroupsOf(resolved.body), [X, CONFIRMED])

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
  assert.ok(powershellFor(body, null).includes(CONFIRMED), 'the PowerShell wraps the same body')
  assert.equal(policyJsonText(step.step), JSON.stringify(body, null, 2), 'the download is that text')
  assert.ok(step.portal && step.portal.length > 0, 'the portal instructions render')
  // Portal named the confirmed group by name — from the step's body, not a name
  // map of its own.
  assert.match(step.portal.join('\n'), /Exclude → Groups:/, 'the exclusion line renders from the resolved body')
})

// ---- 6: one unresolved list, one answer from all four channels ----

test('6: an object the tenant does not have withholds Portal, JSON, PowerShell and Download together', () => {
  const { rows } = policySteps('demo-week2')
  let gated = 0
  let offered = 0
  for (const { step, portal } of rows) {
    if ((step.action.resolution?.policies.length ?? 0) === 0) continue
    if (missingObjects(step).length > 0) {
      gated += 1
      assert.equal(implementationOffered(step), false, `${step.id}: the one gate is shut`)
      assert.equal(portal, null, `${step.id}: no portal instructions`)
      assert.equal(jsonOffered(step), false, `${step.id}: no JSON, no PowerShell, no download`)
      continue
    }
    offered += 1
    assert.equal(implementationOffered(step), true, `${step.id}: the gate is open`)
    if (step.action.json) assert.equal(jsonOffered(step), true, `${step.id}: the JSON is offered with it`)
  }
  assert.ok(gated >= 2, `more than one gated policy exercised (${gated})`)
  assert.ok(offered >= 5, `more than one offered policy exercised (${offered})`)
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
    const groups = excludeGroupsOf(body)
    assert.equal(groups.filter((g) => g === exclusionsGroupId).length, 1, `${step.id}: excludeGroups names the exclusions group once`)
    assert.equal(new Set(groups).size, groups.length, `${step.id}: no duplicate group id`)
    if (portal) assert.equal(portal.join('\n').split(groupName).length - 1, 1, `${step.id}: the portal lines name ${groupName} once`)
    const ps = powershellFor(body, null)
    const heredoc = ps.slice(ps.indexOf("@'\n") + 3, ps.indexOf("\n'@"))
    assert.deepEqual(JSON.parse(heredoc), body, `${step.id}: the PowerShell body is the JSON body`)
    assert.equal(ps.split(exclusionsGroupId).length - 1, 1, `${step.id}: the PowerShell names the exclusions group once`)
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

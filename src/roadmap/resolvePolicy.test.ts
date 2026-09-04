// Foundation A: one canonical resolved tenant policy, and every implementation
// channel reads it. The author's four exclusion groups on a policy are this
// tenant's one exclusions group, named once — in the resolved object itself,
// not only in a rendered string — and the portal lines, the JSON, the
// PowerShell and the download all describe that same policy.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import pinned from '../../baselines/jhope188-conditionalaccesspolicies.pinned.json' with { type: 'json' }
import type { CaPolicy } from '../baseline/types.ts'
import { implementable, resolveTenantPolicy } from './resolvePolicy.ts'
import type { TenantObjects } from './resolvePolicy.ts'
import { fixture } from './fixtures/index.ts'
import { runFixture } from './fixtures/run.ts'
import { contentStepFor } from '../content/stepTitle.ts'
import { stepVars } from '../ui/surfaces/stepVars.ts'
import type { StepVarContext } from '../ui/surfaces/stepVars.ts'
import { portalNamesFor, stepPortalLines } from '../ui/surfaces/stepPortal.ts'
import { jsonOffered, missingObjects, policyJson, policyJsonText } from '../ui/surfaces/stepJson.ts'
import { powershellFor } from '../ui/surfaces/stepPowerShell.ts'
import type { Step } from './types.ts'

const POLICIES = pinned.policies as unknown as CaPolicy[]
const X = '00000000-1111-2222-3333-444444444444'
const SA = '00000000-1111-2222-3333-555555555555'

const tenant = (over: Partial<TenantObjects> = {}): TenantObjects => ({ exclusionsGroupId: X, serviceAccountsGroupId: null, allowedCountriesLocationId: null, ...over })

/** The author's policy behind a goal, by its name in the pin. */
function authorPolicy(displayName: string): CaPolicy {
  const p = POLICIES.find((x) => x.displayName === displayName)
  assert.ok(p, `the pin holds ${displayName}`)
  return p as CaPolicy
}

const excludeGroupsOf = (body: Record<string, unknown>): string[] => {
  const users = ((body.conditions ?? {}) as Record<string, unknown>).users as Record<string, unknown> | undefined
  return (users?.excludeGroups as string[] | undefined) ?? []
}

/** Every fixture step whose body is a policy the tenant can carry. */
function policySteps(name: Parameters<typeof fixture>[0]) {
  const f = fixture(name)
  const r = runFixture(f)
  const nameOf = (id: string): string => r.input.names!.label(id)
  const ctx: StepVarContext = { snapshot: f.snapshot, mapping: f.mapping, nameOf, signature: 'IT', operatorId: f.operatorId, now: f.snapshot.asOf, groups: f.groups, naming: r.coverage.organisation.naming }
  const rows = r.steps
    .filter((s) => (s.kind === 'create' || s.kind === 'adjust') && contentStepFor(s) !== undefined)
    .map((step) => {
      const cs = contentStepFor(step) as Record<string, unknown>
      const names = portalNamesFor(ctx, stepVars(step, ctx) as Record<string, unknown>, step.title)
      return { step: step as Step, cs, portal: cs.kind === 'policy' ? stepPortalLines(step.goalId, names) : null }
    })
  return { f, r, ctx, rows }
}

// ---- A + B: the resolved object itself carries the tenant group once ----

test('A: the author’s four exclusion groups on one policy resolve to the tenant’s one exclusions group, once', () => {
  // Jon Hope's SharePoint block excludes two travellers groups, a third
  // travellers group and the author's own exclusions group: four author objects,
  // one tenant group.
  const source = authorPolicy('IAC - APP - BLOCK - SharePoint-OneDrive-NonTrustedLocations')
  assert.equal(excludeGroupsOf(source as unknown as Record<string, unknown>).length, 4, 'the author names four groups')
  const resolved = resolveTenantPolicy(source as unknown as Record<string, unknown>, tenant(), 'x', POLICIES)
  assert.deepEqual(excludeGroupsOf(resolved.body), [X], 'the tenant group is named once')
})

test('B: the de-duplication is in the resolved semantic object, before anything is rendered', () => {
  const source = authorPolicy('IAC - GLOBAL - GRANT - MFA - AllUsers')
  const resolved = resolveTenantPolicy(source as unknown as Record<string, unknown>, tenant(), 'mfa-all-users', POLICIES)
  const groups = excludeGroupsOf(resolved.body)
  // Not a string check: the array on the object holds one entry.
  assert.equal(groups.length, 1)
  assert.equal(groups[0], X)
  assert.equal(new Set(groups).size, groups.length)
  // And the body the implementation channels carry keeps it that way.
  assert.deepEqual(excludeGroupsOf(implementable(resolved.body, resolved.unresolved).policy), [X])
})

test('H: distinct resolved ids stay distinct and keep first-occurrence order', () => {
  const source = authorPolicy('IAC - INTUNE - GRANT - RequireCompliantDevice')
  // The author's service-accounts group is this tenant's own; its two other
  // groups are the exclusions group. Three author ids, two tenant ids, in the
  // order the first of each appeared.
  const resolved = resolveTenantPolicy(source as unknown as Record<string, unknown>, tenant({ serviceAccountsGroupId: SA }), 'require-managed-device', POLICIES)
  assert.deepEqual(excludeGroupsOf(resolved.body), [SA, X])
})

test('I: an unrelated policy’s includes and excludes are untouched, and no id crosses a collection', () => {
  const body = {
    conditions: {
      users: { includeUsers: ['All'], includeGroups: ['g-1', 'g-2'], excludeGroups: ['g-3'], includeRoles: ['r-1', 'r-2'], excludeUsers: ['u-1'] },
      applications: { includeApplications: ['All'], excludeApplications: ['app-1', 'app-2'] },
    },
    grantControls: { operator: 'OR', builtInControls: ['mfa'] },
  }
  const resolved = resolveTenantPolicy(body, tenant({ exclusionsGroupId: null }), 'x')
  assert.deepEqual(resolved.body, body, 'nothing the tenant does not resolve is changed')
  // With the tenant's exclusions group, only the exclude side gains it.
  const withGroup = resolveTenantPolicy(body, tenant(), 'x')
  const users = (withGroup.body.conditions as Record<string, unknown>).users as Record<string, unknown>
  assert.deepEqual(users.includeGroups, ['g-1', 'g-2'])
  assert.deepEqual(users.excludeGroups, ['g-3', X])
  assert.deepEqual(users.includeRoles, ['r-1', 'r-2'])
  assert.deepEqual((withGroup.body.conditions as Record<string, unknown>).applications, body.conditions.applications)
})

// ---- C–F: every channel describes the one resolved policy ----

test('C+D+E+F: portal, JSON, PowerShell and download carry the one resolved body, with the exclusions group named once', () => {
  const { f, rows } = policySteps('demo-week2')
  const exclusionsGroupId = f.mapping.records['__globalExclusion']?.resolvedId
  assert.ok(exclusionsGroupId, 'the demo tenant has a recognised exclusions group')
  const groupName = 'Core - Exclusions'
  let checked = 0
  for (const { step, portal } of rows) {
    if (!jsonOffered(step)) continue
    const body = policyJson(step) as Record<string, unknown>
    const groups = excludeGroupsOf(body)
    // D: the tenant's group is in the JSON exactly once.
    assert.equal(groups.filter((g) => g === exclusionsGroupId).length, 1, `${step.id}: excludeGroups names the exclusions group once`)
    assert.equal(new Set(groups).size, groups.length, `${step.id}: no duplicate group id`)
    // C: the portal instruction names it once too.
    if (portal) {
      const mentions = portal.join('\n').split(groupName).length - 1
      assert.equal(mentions, 1, `${step.id}: the portal lines name ${groupName} once`)
    }
    // E: the PowerShell wraps that same body, unchanged.
    const ps = powershellFor(body, null)
    const heredoc = ps.slice(ps.indexOf("@'\n") + 3, ps.indexOf("\n'@"))
    assert.deepEqual(JSON.parse(heredoc), body, `${step.id}: the PowerShell body is the JSON body`)
    assert.equal(ps.split(exclusionsGroupId).length - 1, 1, `${step.id}: the PowerShell names the exclusions group once`)
    // F: Download JSON saves the text the JSON tab shows.
    assert.equal(policyJsonText(step), JSON.stringify(body, null, 2), `${step.id}: the download is the JSON tab's body`)
    checked += 1
  }
  assert.ok(checked >= 5, `more than one policy exercised (${checked})`)
})

test('D: no step on any fixture ships a duplicated id in any collection', () => {
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

// ---- G: one unresolved condition, one answer from every channel ----

test('G: an object the tenant does not have gates JSON, PowerShell and Download together, and the portal names it rather than an id', () => {
  const { rows } = policySteps('demo-week2')
  const geo = rows.find((r) => r.step.goalId === 'geo-restriction')
  assert.ok(geo, 'the countries block is in the plan')
  // The one unresolved list, from the one resolution.
  const missing = missingObjects(geo.step)
  assert.ok(missing.length > 0, 'the allowed-countries location is missing')
  assert.ok(missing.some((m) => m.stepId === 's-prereq-allowed-countries'), 'it names the Preparation step that creates it')
  // JSON, PowerShell and Download are the one gate.
  assert.equal(jsonOffered(geo.step), false)
  // The body never carries the unresolved reference, whichever channel reads it.
  const text = policyJsonText(geo.step)
  for (const m of missing) assert.doesNotMatch(text, new RegExp(m.token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), `${m.token} is not in the body`)
  assert.doesNotMatch(powershellFor(policyJson(geo.step), null), /\{[A-Za-z]+\}/, 'no placeholder token in the PowerShell')
  // The portal keeps the reference, named as the plan proposes to create it —
  // never as an id.
  assert.ok(geo.portal && geo.portal.length > 0, 'the portal lines still render')
  for (const line of geo.portal ?? []) assert.doesNotMatch(line, /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i, 'no raw id on a portal line')
})

// ---- J + K: what this run must not have moved ----

test('J: the admin-portals baseline conflict still suppresses every implementation channel', () => {
  const { rows } = policySteps('demo-week2')
  const admin = rows.find((r) => r.step.goalId === 'admin-portals-protected')
  assert.ok(admin, 'the admin-portals step is in the plan')
  assert.equal(admin.portal, null, 'no portal lines')
  assert.equal(jsonOffered(admin.step), false, 'no JSON, PowerShell or download')
})

test('K: emergency access and the exclusions group are unchanged outside policy resolution', () => {
  const { f, r, rows } = policySteps('demo-week2')
  assert.ok(f.mapping.breakGlassUserIds.length > 0, 'the tenant has emergency-access accounts')
  assert.ok(r.steps.some((s) => s.id === 's-prereq-exclusion-group'), 'the exclusions-group step still stands')
  assert.ok(r.steps.some((s) => s.id === 's-prereq-break-glass'), 'the emergency-access step still stands')
  // Resolution reads the mapping and adds one object: the exclusions group. It
  // never puts an account in a policy and never reclassifies one.
  const tenantObjects = tenant({ exclusionsGroupId: f.mapping.records['__globalExclusion']?.resolvedId ?? null })
  for (const p of POLICIES) {
    const resolved = resolveTenantPolicy(p as unknown as Record<string, unknown>, tenantObjects, 'x', POLICIES)
    const text = JSON.stringify(resolved.body)
    for (const id of f.mapping.breakGlassUserIds) assert.doesNotMatch(text, new RegExp(id, 'i'), `${p.displayName}: resolution names no emergency account`)
  }
  // Exclusions go through the exclusions group on the instruction a person reads.
  const names = new Set(f.mapping.breakGlassUserIds.map((id) => r.input.names!.label(id)))
  for (const { step, portal } of rows) for (const line of portal ?? []) for (const n of names) assert.ok(!line.includes(n), `${step.id}: no emergency account named on a portal line`)
})

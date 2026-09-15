// Consolidated batch item 2: "Limit How Long Sessions Last" requires the resolved target's
// excluded accounts, and the pinned browser policy excludes nobody. The empty list IAMAI
// binds on purpose ("the baseline's own nobody") failed the required-value check, so a
// tenant whose target excludes no individual accounts held on a value it already had.
// The package now declares that a resolved empty `policy.target.excludeUsers` is a value
// (META `resolvedEmptyBindings`); a value IAMAI did not bind still holds, and no other
// required binding (the exclusions group above all) becomes optional.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import registry from './registry.generated.json' with { type: 'json' }
import type { CompiledPackage, PackageState } from './protocol.ts'
import { validatePackage } from './protocol.ts'
import { bound, projectImplementation, resolvedEmptyOf } from './project.ts'
import type { Projection } from './project.ts'
import { CONTRACT } from '../../ui/surfaces/stepContract.ts'

const PACKAGES = (registry as unknown as { packages: Record<string, CompiledPackage> }).packages
const PKG = PACKAGES['s-goal-session-lifetime']
/** Sample ids, never a tenant's. */
const ID = (n: number): string => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`
const NONE = CONTRACT.implementation.excludeUsersNone
const base = (state: PackageState): Record<string, unknown> => ({
  'tenant.displayName': 'Sample tenant',
  'policies.session.browser.target.displayName': 'Sample - browser sessions',
  'policy.target.excludeGroups': [ID(1)],
  ...(state === 'missing' ? {} : { 'policies.session.browser.current.id': ID(3) }),
})
const channel = (p: Projection, ch: string): string => p.channels.find((c) => c.channel === ch)?.text ?? ''
const calls = (p: Projection): string[] => channel(p, 'powershell').split('\n').filter((l) => l.startsWith('Invoke-IAMAIStep '))
const usersOf = (p: Projection): { excludeUsers: unknown; excludeGroups: unknown } => (JSON.parse(channel(p, 'json')) as { conditions: { users: { excludeUsers: unknown; excludeGroups: unknown } } }).conditions.users
/** Wording that makes a shared-device exclusion mandatory whatever the target says. */
const MANDATORY_SHARED = /resolved shared-device accounts|shared-device exclusions|shared-device accounts remain excluded|group\/shared-device/

test('a resolved empty excludeUsers is a value: every channel draws, the JSON and script carry [], and the words say the target excludes nobody', () => {
  const empty = { 'policy.target.excludeUsers': [], 'policy.target.excludeUsersSummary': NONE }
  const create = projectImplementation(PKG, 'missing', { ...base('missing'), ...empty })
  assert.equal(create.hold, null, JSON.stringify(create.hold))
  assert.deepEqual(create.channels.map((c) => c.channel), ['entra', 'powershell', 'json', 'aiInfo'])
  assert.deepEqual([usersOf(create).excludeUsers, usersOf(create).excludeGroups], [[], [ID(1)]])
  assert.deepEqual(calls(create), [`Invoke-IAMAIStep -Mode 'CreateBrowser' -BrowserPolicyDisplayName 'Sample - browser sessions' -ExcludeGroupIds @('${ID(1)}') -ExcludeUserIds @()`])
  for (const ch of ['entra', 'aiInfo']) {
    assert.ok(channel(create, ch).includes(`Individual accounts the resolved target excludes: ${NONE}.`), `${ch}: ${channel(create, ch)}`)
    assert.doesNotMatch(channel(create, ch), MANDATORY_SHARED, ch)
  }
  const watch = projectImplementation(PKG, 'reportOnly', { ...base('reportOnly'), ...empty })
  assert.equal(watch.hold, null, JSON.stringify(watch.hold))
  assert.ok(calls(watch)[0].startsWith(`Invoke-IAMAIStep -Mode 'VerifyBrowser' -BrowserPolicyId '${ID(3)}'`) && calls(watch)[0].endsWith('-ExcludeUserIds @()'), calls(watch)[0])
  assert.match(channel(watch, 'entra'), /Confirm the policy's exclusions still match the resolved target\./)
  assert.doesNotMatch(channel(watch, 'entra'), MANDATORY_SHARED)
  const enforce = projectImplementation(PKG, 'readyToEnforce', { ...base('readyToEnforce'), ...empty })
  assert.equal(enforce.hold, null, JSON.stringify(enforce.hold))
  assert.deepEqual(JSON.parse(channel(enforce, 'json')), { state: 'enabled' })
  assert.match(channel(enforce, 'entra'), /including any account the resolved target excludes/)
})

test('a resolved non-empty excludeUsers is carried exactly into the JSON, the script and the words', () => {
  const summary = `Room Panel (${ID(2)}), Lobby Phone (${ID(5)})`
  const p = projectImplementation(PKG, 'missing', { ...base('missing'), 'policy.target.excludeUsers': [ID(2), ID(5)], 'policy.target.excludeUsersSummary': summary })
  assert.equal(p.hold, null, JSON.stringify(p.hold))
  assert.deepEqual(usersOf(p).excludeUsers, [ID(2), ID(5)])
  assert.ok(calls(p)[0].endsWith(`-ExcludeUserIds @('${ID(2)}', '${ID(5)}')`), calls(p)[0])
  for (const ch of ['entra', 'aiInfo']) assert.ok(channel(p, ch).includes(`Individual accounts the resolved target excludes: ${summary}.`), ch)
})

test('an unresolved excludeUsers still holds, and the empty-list rule makes no other required binding optional', () => {
  for (const state of ['missing', 'reportOnly', 'readyToEnforce'] as PackageState[]) {
    assert.deepEqual(projectImplementation(PKG, state, base(state)).hold?.missingBindings, ['policy.target.excludeUsers'], `${state}: absent`)
    assert.deepEqual(projectImplementation(PKG, state, { ...base(state), 'policy.target.excludeUsers': null }).hold?.missingBindings, ['policy.target.excludeUsers'], `${state}: null is not a resolved list`)
  }
  // The exclusions group is still required: an empty group list is not the target's own "none".
  const noGroup = projectImplementation(PKG, 'missing', { ...base('missing'), 'policy.target.excludeGroups': [], 'policy.target.excludeUsers': [] })
  assert.deepEqual(noGroup.hold?.missingBindings, ['policy.target.excludeGroups'])
  // The rule is the package's declaration, and only this package declares one.
  assert.deepEqual([...resolvedEmptyOf(PKG as unknown as { meta: Record<string, unknown> })], ['policy.target.excludeUsers'])
  const declaring = Object.entries(PACKAGES).filter(([, p]) => resolvedEmptyOf(p as unknown as { meta: Record<string, unknown> }).size > 0).map(([id]) => id)
  assert.deepEqual(declaring, ['s-goal-session-lifetime'])
  assert.equal(bound({ k: [] }, 'k'), false)
  assert.equal(bound({ k: [] }, 'k', new Set(['k'])), true)
  assert.equal(bound({}, 'k', new Set(['k'])), false)
  assert.equal(bound({ k: 'text' }, 'k', new Set()), true)
})

test('the validator refuses a resolvedEmptyBindings entry the package does not declare', () => {
  assert.deepEqual(validatePackage(PKG).filter((m) => m.includes('resolvedEmptyBindings')), [])
  const bad = { ...PKG, meta: { ...PKG.meta, resolvedEmptyBindings: ['policy.target.notDeclared'] } } as CompiledPackage
  assert.ok(validatePackage(bad).includes('resolvedEmptyBindings: policy.target.notDeclared is not a declared binding'), JSON.stringify(validatePackage(bad).filter((m) => m.includes('resolved'))))
})

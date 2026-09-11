// Step-scoped semantic re-pin review (correction batch 1): a package applies to
// the members it was reviewed for, a changed member sets only that package aside
// for review, a removed member holds only that package, a new member is reported,
// and the library is never disabled as a whole.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import registry from './registry.generated.json' with { type: 'json' }
import type { CompiledPackage } from './protocol.ts'
import { driftOf, memberFingerprint, membersAt } from './drift.ts'
import { PINNED } from '../../baseline/pinned.ts'
import { implementationPackageFor, packageReviewFor } from '../../ui/surfaces/stepPackage.ts'

const PACKAGES = (registry as unknown as { packages: Record<string, CompiledPackage> }).packages
const REVIEWS = (registry as unknown as { reviews: Record<string, { status: string; changed: string[] }> }).reviews

const policy = (id: string, strength: string, name = 'Policy') => ({ id, displayName: name, state: 'enabled', conditions: { users: { includeUsers: ['All'] } }, grantControls: { operator: 'OR', builtInControls: [], authenticationStrength: { id: strength } }, sessionControls: null })
const pin = (commit: string, policies: ReturnType<typeof policy>[], goalMap: Record<string, string[]>) => ({ commit, policies, goalMap })
const A = '00000000-0000-4000-8000-0000000000a1'
const B = '00000000-0000-4000-8000-0000000000b1'

test('each package is reviewed against the pin the build carries, member by member, and only a changed member sets its package aside', () => {
  assert.deepEqual(Object.keys(REVIEWS).sort(), Object.keys(PACKAGES).sort(), 'a registered package was not reviewed')
  const statuses = Object.fromEntries(Object.entries(REVIEWS).map(([id, r]) => [id, r.status]))
  assert.equal(statuses['s-goal-device-registration-mfa'], 'current', 'the re-authored package still reads as drifted')
  const portal = REVIEWS['s-goal-admin-portals-protected']
  assert.equal(portal.status, 'reviewNeeded')
  assert.deepEqual(portal.changed, ['fafaa50c-0b61-4ac6-a589-f9a1120b2f9e'])
  const aside = Object.entries(statuses).filter(([, s]) => s !== 'current').map(([id]) => id)
  assert.deepEqual(aside, ['s-goal-admin-portals-protected'], 'more than the changed member’s package was set aside')
  // A placeholder re-baked at the new pin, or a rename, changes no fingerprint.
  const medium = PINNED.policies.find((p) => p.id === '7475b373-0544-4ee8-8827-cff35009136d')!
  assert.equal(memberFingerprint({ ...medium, displayName: 'renamed', placeholders: {} } as never), memberFingerprint(medium as never))
})

test('unchanged is current, changed needs review, removed is held, and a new member is reported without disabling the package', () => {
  const reviewed = pin('old', [policy(A, 's1')], { goal: [A] })
  const record = membersAt(reviewed, ['goal'])
  assert.equal(driftOf(record, 'old', ['goal'], pin('new', [policy(A, 's1', 'Renamed')], { goal: [A] })).status, 'current')
  assert.deepEqual(driftOf(record, 'old', ['goal'], pin('new', [policy(A, 's2')], { goal: [A] })), { status: 'reviewNeeded', reviewedPin: 'old', pinned: 'new', unchanged: [], changed: [A], removed: [], added: [], identityFallback: [], renamed: [] })
  assert.equal(driftOf(record, 'old', ['goal'], pin('new', [], { goal: [] })).status, 'held')
  const grown = driftOf(record, 'old', ['goal'], pin('new', [policy(A, 's1'), policy(B, 's1')], { goal: [A, B] }))
  assert.equal(grown.status, 'current')
  assert.deepEqual(grown.added, [B])
  // Never reviewed against a member it implements: needs review. Implements none: nothing to drift.
  assert.equal(driftOf(undefined, null, ['goal'], pin('new', [policy(A, 's1')], { goal: [A] })).status, 'reviewNeeded')
  assert.equal(driftOf(undefined, null, ['template-only'], pin('new', [policy(A, 's1')], { goal: [A] })).status, 'current')
})

test('a member the pin knows by display name alone is reported as such, and a rename that changes nothing is not a removal', () => {
  const NAME = 'IAC - WORKLOAD - BLOCK - Example'
  const idless = (name: string, strength: string) => ({ ...policy(A, strength, name), id: null }) as unknown as ReturnType<typeof policy>
  const record = membersAt(pin('old', [idless(NAME, 's1')], { goal: [NAME] }), ['goal'])
  // The same member, renamed and otherwise untouched.
  const renamed = driftOf(record, 'old', ['goal'], pin('new', [idless('Renamed', 's1')], { goal: ['Renamed'] }))
  assert.equal(renamed.status, 'current')
  assert.deepEqual(renamed.renamed, [{ from: NAME, to: 'Renamed' }])
  assert.deepEqual(renamed.removed, [])
  assert.deepEqual(renamed.added, [])
  assert.deepEqual(renamed.identityFallback, [NAME], 'the fallback is said, never assumed stable')
  // Materially changed under the same name.
  const changed = driftOf(record, 'old', ['goal'], pin('new', [idless(NAME, 's2')], { goal: [NAME] }))
  assert.equal(changed.status, 'reviewNeeded')
  assert.deepEqual(changed.changed, [NAME])
  // Removed.
  assert.equal(driftOf(record, 'old', ['goal'], pin('new', [], { goal: [] })).status, 'held')
  // Renamed and changed cannot be told from a replacement: it holds.
  assert.equal(driftOf(record, 'old', ['goal'], pin('new', [idless('Renamed', 's2')], { goal: ['Renamed'] })).status, 'held')
  // An unrelated member changing touches nothing.
  const other = driftOf(record, 'old', ['goal'], pin('new', [idless(NAME, 's1'), policy(B, 's9')], { goal: [NAME], elsewhere: [B] }))
  assert.equal(other.status, 'current')
  // Members with a stable id report no fallback.
  assert.deepEqual(driftOf(membersAt(pin('old', [policy(A, 's1')], { goal: [A] }), ['goal']), 'old', ['goal'], pin('new', [policy(A, 's1')], { goal: [A] })).identityFallback, [])
  // The build's registry names the packages reviewed by name.
  const fallback = Object.entries(REVIEWS as unknown as Record<string, { identityFallback: string[] }>).filter(([, r]) => r.identityFallback.length > 0).map(([id]) => id).sort()
  assert.deepEqual(fallback, ['s-goal-intune-enrollment-reauth', 's-goal-workload-identity-block'])
})

test('a package set aside for review no longer draws its step, says why, and every other package still applies', () => {
  const portalStep = { id: 's-goal-admin-portals-protected', goalId: 'admin-portals-protected' }
  assert.equal(implementationPackageFor(portalStep), null, 'guidance for a policy the baseline no longer asks for was applied')
  assert.equal(packageReviewFor(portalStep)?.status, 'reviewNeeded')
  const applied = Object.keys(PACKAGES).filter((id) => implementationPackageFor({ id, goalId: id.replace(/^s-goal-/, '') }) !== null)
  assert.ok(applied.length >= Object.keys(PACKAGES).length - 1, `only ${applied.length} packages still apply`)
  assert.equal(packageReviewFor({ id: 's-goal-device-registration-mfa', goalId: 'device-registration-mfa' }), null)
})

test('the compiler no longer calls an applied package inactive', () => {
  assert.equal(readFileSync('scripts/compile-implementation-content.mjs', 'utf8').includes('inactive in this build'), false)
})

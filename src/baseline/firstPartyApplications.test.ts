import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { CaPolicy } from './types.ts'
import { inventoryReferences, isFirstPartyApplicationId, unresolvedReferences } from './references.ts'
import { runBaselineValidators } from './validators.ts'

const INTUNE_ENROLLMENT = 'd4ebce55-015a-49b5-a083-c84d1797ae8c'
const UNKNOWN_APP = '11111111-2222-4333-8444-555555555555'

const policy = (
  appId: string,
  side: 'include' | 'exclude' = 'include',
): CaPolicy => ({
  displayName: `test-${side}-${appId}`,
  conditions: {
    applications:
      side === 'include'
        ? { includeApplications: [appId] }
        : {
            includeApplications: ['All'],
            excludeApplications: [appId],
          },
  },
  grantControls: {
    operator: 'OR',
    builtInControls: ['mfa'],
  },
})

test('Microsoft first-party application IDs are stable Conditional Access references', () => {
  assert.equal(isFirstPartyApplicationId(INTUNE_ENROLLMENT), true)

  const refs = inventoryReferences([
    policy(INTUNE_ENROLLMENT),
  ])

  const app = refs.find(
    (ref) =>
      ref.kind === 'application' &&
      ref.id === INTUNE_ENROLLMENT,
  )!

  assert.equal(app.portability, 'stable')

  assert.equal(
    unresolvedReferences(refs).some(
      (ref) => ref.id === INTUNE_ENROLLMENT,
    ),
    false,
  )
})

test('unknown application GUIDs remain tenant-specific and unresolved', () => {
  assert.equal(isFirstPartyApplicationId(UNKNOWN_APP), false)

  const refs = inventoryReferences([
    policy(UNKNOWN_APP),
  ])

  const app = refs.find(
    (ref) =>
      ref.kind === 'application' &&
      ref.id === UNKNOWN_APP,
  )!

  assert.equal(app.portability, 'tenantSpecific')

  assert.equal(
    unresolvedReferences(refs).some(
      (ref) => ref.id === UNKNOWN_APP,
    ),
    true,
  )
})

test('app-01 uses the same first-party authority as reference portability', () => {
  assert.equal(
    runBaselineValidators([
      policy(INTUNE_ENROLLMENT, 'exclude'),
    ]).some((finding) => finding.id === 'app-01'),
    false,
  )

  assert.equal(
    runBaselineValidators([
      policy(UNKNOWN_APP, 'exclude'),
    ]).some((finding) => finding.id === 'app-01'),
    true,
  )
})

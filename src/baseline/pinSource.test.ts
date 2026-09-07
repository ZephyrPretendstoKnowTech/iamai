// Task 020 — source application-exclusion fidelity.
//
// The author's Admin Portal policy (source policy id fafaa50c-0b61-4ac6-a589-f9a1120b2f9e,
// "IAC - ZTCA - GLOBAL – BLOCK – Admin Portal") excludes four applications. Pinning asked
// whether each was a Microsoft first-party id, the registry did not know three of them, and
// pinning dropped them — so the policy IAMAI ships blocks more than the author's export does.
// The shipped pin records exactly what it removed, and those four ids are the provenance for
// the constants below: `baselines/jhope188-conditionalaccesspolicies.pinned.json` → `stripped`,
// the four entries prefixed "IAC - ZTCA - GLOBAL – BLOCK – Admin Portal:".
//
// These assertions run against the real pin/sanitise boundary, so they fail if the registry
// loses an entry again — not merely if the registry file is edited.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { pinPolicy } from './pinSource.ts'
import { inventoryReferences, isFirstPartyApplicationId, unresolvedReferences } from './references.ts'
import type { CaPolicy } from './types.ts'

/** The four applications the Admin Portal source excludes, by id and the name the source audit gave each. */
const AUTHORED_EXCLUSIONS: { appId: string; displayName: string }[] = [
  { appId: '00000002-0000-0000-c000-000000000000', displayName: 'Windows Azure Active Directory' },
  { appId: '0000000c-0000-0000-c000-000000000000', displayName: 'Microsoft App Access Panel' },
  { appId: '1b912ec3-a9dd-4c4d-a53e-76aa7adb28d7', displayName: 'AADReporting' },
  { appId: '8c59ead7-d703-4a27-9e55-c96a0054c8d2', displayName: 'My Profile' },
]
const AUTHORED_IDS = AUTHORED_EXCLUSIONS.map((a) => a.appId)

/** Microsoft Intune Enrollment — a first-party id the registry has always known. */
const KNOWN_STABLE = 'd4ebce55-015a-49b5-a083-c84d1797ae8c'
/** Not a Microsoft application: the author's own registration, or somebody's service principal. */
const CUSTOM_APP = '9f3c1d7a-24b8-4e51-9a6d-7c0b5e832f14'

const NO_PLACEHOLDERS = new Map<string, string>()

/** The Admin Portal source shape: a block of the admin portals with the author's four exclusions. */
function adminPortalSource(excludeApplications: string[]): CaPolicy {
  return {
    id: 'fafaa50c-0b61-4ac6-a589-f9a1120b2f9e',
    displayName: 'IAC - ZTCA - GLOBAL – BLOCK – Admin Portal',
    state: 'enabled',
    conditions: {
      users: { includeUsers: ['All'] },
      applications: { includeApplications: ['MicrosoftAdminPortals'], excludeApplications },
    },
    grantControls: { operator: 'OR', builtInControls: ['block'] },
  } as CaPolicy
}

const excludeAppsOf = (pinned: { conditions: unknown }): string[] =>
  ((pinned.conditions as { applications?: { excludeApplications?: string[] } }).applications?.excludeApplications ?? [])

const includeAppsOf = (pinned: { conditions: unknown }): string[] =>
  ((pinned.conditions as { applications?: { includeApplications?: string[] } }).applications?.includeApplications ?? [])

// ------------------------------------------------- A. the authored exclusions survive pinning

test('the four authored Admin Portal application exclusions survive the pin', () => {
  const { policy, stripped } = pinPolicy(adminPortalSource(AUTHORED_IDS), NO_PLACEHOLDERS)

  assert.deepEqual(
    excludeAppsOf(policy),
    AUTHORED_IDS,
    'pinning dropped an application the author excluded, so the pinned policy blocks more than the source does',
  )
  assert.deepEqual(stripped, [], 'a first-party exclusion was recorded as author-specific')
  // The scope the author wrote, not a substitute: the include side is untouched.
  assert.deepEqual(includeAppsOf(policy), ['MicrosoftAdminPortals'])
})

test('each authored exclusion is a first-party id the shared registry knows by name', () => {
  for (const { appId, displayName } of AUTHORED_EXCLUSIONS) {
    assert.equal(isFirstPartyApplicationId(appId), true, `${displayName} (${appId}) is not in the first-party registry`)
  }
})

// ------------------------------------------------- B. the include/exclude side does not decide identity

test('a stable application id is retained on either side, and the side is preserved', () => {
  const included = pinPolicy(
    {
      displayName: 'include side',
      conditions: { applications: { includeApplications: [KNOWN_STABLE, ...AUTHORED_IDS] } },
      grantControls: { operator: 'OR', builtInControls: ['mfa'] },
    } as CaPolicy,
    NO_PLACEHOLDERS,
  )
  const excluded = pinPolicy(
    {
      displayName: 'exclude side',
      conditions: { applications: { includeApplications: ['All'], excludeApplications: [KNOWN_STABLE, ...AUTHORED_IDS] } },
      grantControls: { operator: 'OR', builtInControls: ['mfa'] },
    } as CaPolicy,
    NO_PLACEHOLDERS,
  )

  assert.deepEqual(includeAppsOf(included.policy), [KNOWN_STABLE, ...AUTHORED_IDS])
  assert.deepEqual(excludeAppsOf(excluded.policy), [KNOWN_STABLE, ...AUTHORED_IDS])
  assert.deepEqual(excluded.stripped, [], 'the same id was rejected only because it sat on the exclude side')

  // The sides stay apart: an exclusion never becomes an inclusion.
  assert.deepEqual(excludeAppsOf(included.policy), [])
  assert.deepEqual(includeAppsOf(excluded.policy), ['All'])
})

// ------------------------------------------------- C. an unknown application stays non-portable

test('an application id the registry does not know is still stripped, and recorded', () => {
  const { policy, stripped } = pinPolicy(adminPortalSource([...AUTHORED_IDS, CUSTOM_APP]), NO_PLACEHOLDERS)

  assert.equal(isFirstPartyApplicationId(CUSTOM_APP), false, 'a custom application id was promoted into the first-party registry')
  assert.deepEqual(excludeAppsOf(policy), AUTHORED_IDS, 'a tenant-specific application id was carried into the pin')
  assert.deepEqual(
    stripped,
    [`IAC - ZTCA - GLOBAL – BLOCK – Admin Portal: ${CUSTOM_APP}`],
    'the removal was not recorded against its policy and id',
  )
})

// ------------------------------------------------- D. runtime portability agrees with pinning

test('an exclusion the pin kept is not an unresolved tenant reference at runtime', () => {
  const { policy } = pinPolicy(adminPortalSource([...AUTHORED_IDS, CUSTOM_APP]), NO_PLACEHOLDERS)
  const refs = inventoryReferences([policy as unknown as CaPolicy])
  const unresolved = new Set(unresolvedReferences(refs).map((r) => r.id))

  for (const { appId, displayName } of AUTHORED_EXCLUSIONS) {
    const ref = refs.find((r) => r.kind === 'application' && r.id === appId.toLowerCase())
    assert.ok(ref, `${displayName} is in the pinned policy but was not inventoried`)
    assert.equal(ref.portability, 'stable', `pinning kept ${displayName} but runtime calls it tenant-specific`)
    assert.equal(unresolved.has(appId.toLowerCase()), false, `${displayName} would be reported as a missing tenant object`)
  }

  // The custom id never reached the pin, so it is not there to resolve either way.
  assert.equal(refs.some((r) => r.id === CUSTOM_APP), false)
})

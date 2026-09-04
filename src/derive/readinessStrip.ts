// The readiness strip on the Plan: five tiles from the same population and
// campaign buckets the steps use (derive/population.ts campaignIds, the
// rollout buckets of scoring/mfaViability.ts, the admin policy's lockout list),
// so every number equals the campaign step's and Today's for the same fact.
// Ready: a phishing-resistant method, seen working. Method not strong enough:
// seen working, but Authenticator approval, a code, a text or a call only.
// Registered, never used: a method, and no MFA sign-in in the evidence window.
// No method. Admins without a passkey or key: the admin policy's lockout list.
// The first four partition the active people; the emergency and shared-device
// accounts are outside the population, so they never appear.
//
// Pure: no DOM, no network.
import type { TenantSnapshot } from '../graph/collect/types.ts'
import type { MappingState } from '../mapping/types.ts'
import { buildViabilityInputs } from '../scoring/fromSnapshot.ts'
import { rolloutBucket, scoreMfaViability, sortViability } from '../scoring/mfaViability.ts'
import type { MethodTier, MfaViability } from '../scoring/mfaViability.ts'
import { campaignIds } from './population.ts'
import { sharedDeviceIds } from './sharedDevices.ts'
import { adminUserIds } from '../roles.ts'
import { lockoutIds } from '../roadmap/lockout.ts'

export type StripTile = 'ready' | 'weak' | 'unproven' | 'noMethod' | 'admins'
export const STRIP_TILES: StripTile[] = ['ready', 'weak', 'unproven', 'noMethod', 'admins']

/** One person on an opened tile: the dot (the bar met or not), the name's id, the strongest method, the last MFA sign-in. */
export type StripPerson = { id: string; admin: boolean; meetsBar: boolean; method: MethodTier; lastMfa: string | null }
export type ReadinessStrip = { active: number; tiles: Record<StripTile, StripPerson[]> }

/** The bar the plan needs: a phishing-resistant method for an admin, a working method for everyone else. */
export function meetsBar(v: Pick<MfaViability, 'methodTiers' | 'mfa'>, admin: boolean): boolean {
  return admin ? v.methodTiers.includes('phishingResistant') : v.mfa === 'verified' || v.mfa === 'likelyViable'
}

export function readinessStrip(snapshot: TenantSnapshot, mapping: Pick<MappingState, 'breakGlassUserIds' | 'serviceAccountUserIds'>, now: string): ReadinessStrip {
  const svc = new Set(mapping.serviceAccountUserIds)
  const viability = sortViability(buildViabilityInputs(snapshot, now, svc).map(scoreMfaViability))
  const pop = new Set(campaignIds(viability, snapshot, mapping))
  const admins = adminUserIds(snapshot.roles ?? { active: {} })
  const rows = viability.filter((v) => pop.has(v.userId))
  const person = (v: MfaViability): StripPerson => ({ id: v.userId, admin: admins.has(v.userId), meetsBar: meetsBar(v, admins.has(v.userId)), method: v.strongestMethod, lastMfa: v.evidence?.at ?? null })
  const phishingResistant = (v: MfaViability): boolean => v.methodTiers.includes('phishingResistant')
  const lockedOut = new Set(lockoutIds('admins-phishing-resistant', viability, snapshot, new Set([...mapping.breakGlassUserIds, ...sharedDeviceIds(snapshot), ...svc])))
  return {
    active: rows.length,
    tiles: {
      ready: rows.filter((v) => rolloutBucket(v) === 'proven' && phishingResistant(v)).map(person),
      weak: rows.filter((v) => rolloutBucket(v) === 'proven' && !phishingResistant(v)).map(person),
      unproven: rows.filter((v) => rolloutBucket(v) === 'unproven').map(person),
      noMethod: rows.filter((v) => rolloutBucket(v) === 'noMethod').map(person),
      admins: rows.filter((v) => lockedOut.has(v.userId)).map(person),
    },
  }
}

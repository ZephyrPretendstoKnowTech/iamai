// Jon's "IAC - GLOBAL - GRANT - BreakGlass - TrustedLocations" as a plan step
// (owner, 2026-10-05): Microsoft's two-account emergency pattern. One emergency
// account — the one the operator names in Decide How and Where People Sign In —
// must sign in with a strong method outside the office; the other stays excluded
// from every policy through the exclusions group.
//
// The plan never excludes an emergency account by name, and it never excludes
// the exclusions group from this one policy: the chosen account is in that
// group, and a Conditional Access exclusion wins, so excluding it would exclude
// the very account the policy is for. The policy instead INCLUDES that one
// account by id and nobody else, so the other account is simply out of its
// scope.
//
// That makes it the one policy the plan writes that reaches an emergency account
// on purpose, so every safety reading that asks "does a policy reach an
// emergency account" or "does every policy exclude the exclusions group" accepts
// exactly this policy — identified by this step's tag or plan name AND by its
// shape (it includes only the chosen account; its grant is an authentication
// strength and nothing else, never a block) — and still flags anything else,
// this policy included the moment it reaches the other account or anyone else.
// This module is the one place that acceptance is decided.
//
// Pure: no DOM, no network.
import goalsData from '../../data/goals.json' with { type: 'json' }
import pinnedBaseline from '../../baselines/jhope188-conditionalaccesspolicies.pinned.json' with { type: 'json' }
import { nameKey } from '../baseline/discover.ts'
import { emergencyStrongAccountOf } from '../mapping/emergencyChoice.ts'
import type { MappingState } from '../mapping/types.ts'
import { planIdFor, stepIdForGoal } from './stepIds.ts'
import { stepById } from '../content/content.ts'
import type { ContentStep } from '../content/content.ts'
import { everywhereContent } from '../content/stepTitle.ts'

/** The goal (data/goals.json) and its step. */
export const EMERGENCY_STRONG_GOAL = 'emergency-account-strong-signin'
export const EMERGENCY_STRONG_STEP = stepIdForGoal(EMERGENCY_STRONG_GOAL)
/**
 * The slot a body names for the chosen account until the operator names it: the
 * template's placeholder, and what the author's account resolves to while the
 * question is unanswered (roadmap/resolvePolicy.ts). It waits on Decide How and
 * Where People Sign In (PLACEHOLDER_STEP), so no channel hands over a policy
 * whose only include is missing.
 */
export const EMERGENCY_STRONG_SLOT = '{emergencyStrongAccount}'

type Row = { displayName?: unknown; description?: unknown; conditions?: unknown; grantControls?: unknown; sessionControls?: unknown }
const strings = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [])
const object = (v: unknown): Record<string, unknown> | null => (v !== null && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null)
const same = (a: string, b: string): boolean => a.toLowerCase() === b.toLowerCase()

/**
 * The policy's shape: it includes exactly `accountId` (the chosen account, or
 * the slot while it is unnamed) and nobody else — no group, no role, no guest
 * type, not All — and its grant is an authentication strength alone: no
 * built-in control, so never a block, and no terms of use, custom control or
 * session control that is on. Exclusions are not read: excluding more
 * people never makes it reach another emergency account.
 */
export function emergencyStrongShape(policy: unknown, accountId: string): boolean {
  const p = object(policy) as Row | null
  const users = object(object(p?.conditions)?.users)
  if (users === null) return false
  const included = strings(users.includeUsers)
  if (included.length !== 1 || !same(included[0], accountId)) return false
  if (strings(users.includeGroups).length > 0 || strings(users.includeRoles).length > 0) return false
  if (users.includeGuestsOrExternalUsers !== undefined && users.includeGuestsOrExternalUsers !== null) return false
  const grant = object(p?.grantControls)
  if (grant === null) return false
  if (strings(grant.builtInControls).length > 0) return false
  // Nothing else the account must satisfy or accept (audit, 2026-10-05): terms of use or a
  // custom control could stop the one emergency account it reaches at sign-in.
  if (strings(grant.termsOfUse).length > 0 || strings(grant.customAuthenticationFactors).length > 0) return false
  // And no session control that is on: a sign-in frequency or a session restriction is
  // not what this policy is for, and an unknown control is read as one (conservative).
  const session = object(p?.sessionControls)
  if (session !== null && Object.values(session).some((v) => v !== null && v !== undefined && v !== false && object(v)?.isEnabled !== false)) return false
  const strength = object(grant.authenticationStrength)
  return strength !== null && typeof strength.id === 'string' && strength.id.trim() !== ''
}

/** The names this step's policy goes by: the pinned baseline's policy for the goal, and the goal's own template name under any prefix. */
const PINNED_NAMES = new Set(((pinnedBaseline as { goalMap?: Record<string, string[]>; policies: { id: string | null; displayName: string }[] }).goalMap?.[EMERGENCY_STRONG_GOAL] ?? [])
  .map((id) => (pinnedBaseline as { policies: { id: string | null; displayName: string }[] }).policies.find((p) => p.id === id)?.displayName ?? '')
  .filter((n) => n !== '')
  .map(nameKey))
const TEMPLATE_SUFFIX = ((): string | null => {
  const goal = (goalsData.goals as { id: string; implementations: { template?: { displayName?: string } }[] }[]).find((g) => g.id === EMERGENCY_STRONG_GOAL)
  const name = goal?.implementations[0]?.template?.displayName ?? ''
  const at = name.indexOf('{namePrefix}')
  return at === 0 ? nameKey(name.slice('{namePrefix}'.length)) : null
})()

/** Whether a tenant policy is this step's own: it carries the plan's tag for this step, or the plan's name for it. */
export function emergencyStrongIdentified(policy: unknown, tenantId: string): boolean {
  const p = object(policy) as Row | null
  if (p === null) return false
  const description = typeof p.description === 'string' ? p.description : ''
  const tag = `[IAMAI:${planIdFor(tenantId)}:${EMERGENCY_STRONG_STEP}`
  const at = description.indexOf(tag)
  if (at >= 0 && [':', ']'].includes(description.charAt(at + tag.length))) return true
  const key = nameKey(typeof p.displayName === 'string' ? p.displayName : '')
  if (key === '') return false
  return PINNED_NAMES.has(key) || (TEMPLATE_SUFFIX !== null && key.endsWith(TEMPLATE_SUFFIX) && key.length > TEMPLATE_SUFFIX.length)
}

/**
 * The one tenant policy every emergency safety reading accepts: this step's own
 * (tag or plan name), shaped to reach the operator's chosen emergency account
 * and nobody else. With no chosen account — unanswered, fewer than two
 * emergency accounts, or an id that is no longer one of them — nothing is
 * accepted, and every reading flags exactly as it always did.
 */
export function acceptedEmergencyStrongPolicy(tenantId: string, mapping: Pick<MappingState, 'emergencyStrongAccountId' | 'breakGlassUserIds'>): (policy: unknown) => boolean {
  const chosen = emergencyStrongAccountOf(mapping)
  if (chosen === null) return () => false
  return (policy) => emergencyStrongIdentified(policy, tenantId) && emergencyStrongShape(policy, chosen)
}

/**
 * The step's own emergency exposure (operations.ts emergencyExposureOf over its
 * own policies), with the chosen account accepted where every body the step
 * writes is shaped to reach it alone. Any other account it reaches, or the
 * chosen one through a body of any other shape, stays exposed.
 */
export function acceptedOwnExposure<T extends { reached: string[]; unproven: string[] }>(exposure: T | null, bodies: readonly unknown[], chosen: string | null): T | null {
  if (exposure === null || chosen === null || bodies.length === 0 || !bodies.every((b) => emergencyStrongShape(b, chosen))) return exposure
  const reached = exposure.reached.filter((id) => !same(id, chosen))
  const unproven = exposure.unproven.filter((id) => !same(id, chosen))
  return reached.length === 0 && unproven.length === 0 ? null : { ...exposure, reached, unproven }
}

/**
 * What the turn-on waits on (owner, 2026-10-05), each true, false or null where
 * the scan could not read it — and null holds, as false does (unknown is
 * conservative):
 *
 * - `method`: the chosen account holds a method the strength accepts that is
 *   phishing-resistant and its own (a device-bound passkey, a FIDO2 key,
 *   Windows Hello for Business or a certificate) — a Temporary Access Pass is
 *   not one;
 * - `drilled`: Verify Emergency Access has a recorded successful sign-in for it,
 *   current for its present configuration (roadmap/cleanupDone.ts
 *   latestRecoveryTest);
 * - `otherExcluded`: every other emergency account is in the exclusions group,
 *   and every other policy excludes that group.
 */
export type EmergencyStrongGates = { accountId: string; method: boolean | null; drilled: boolean | null; otherExcluded: boolean | null }

/** The gates that still hold the turn-on, in the order a person clears them. */
export function emergencyStrongWaits(g: EmergencyStrongGates): ('method' | 'drilled' | 'otherExcluded')[] {
  return (['method', 'drilled', 'otherExcluded'] as const).filter((k) => g[k] !== true)
}

/**
 * The step's words: the content file's, or — where everyone works remotely and
 * the policy has no office to carve out — its `everywhere` words in place of
 * the title, the why and the brief's notice (owner, 2026-10-05).
 */
export function emergencyStrongContent(remote: boolean): ContentStep {
  const own = stepById[EMERGENCY_STRONG_GOAL]
  return remote && own ? everywhereContent(own) : own
}

/** The step's title, by the office answer. */
export const emergencyStrongTitle = (remote: boolean): string => emergencyStrongContent(remote)?.title ?? EMERGENCY_STRONG_GOAL

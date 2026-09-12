// Emergency access, in two tiers (owner, 2026-09-11).
//
// Every emergency-access check used to be read the same way: any result that did
// not pass held every step that can deny access. That treated best-practice
// hardening — two accounts sharing an authenticator, a drill not recorded, a
// passphrase not yet stored in two places — as though it were the absence of a
// way back in. They are not the same fact.
//
//   * Minimum safety: without these there is no usable tenant-local way back in.
//     A confirmed account that is not permanent Global Administrator, is synced,
//     sits on a custom domain, is disabled, is not excluded from every enforcing
//     policy, is in a dynamic group, or has no MFA method; or no confirmed account
//     at all. These hold the rollout, and nothing defers them.
//   * Resilience hardening: everything else the checks find. The rollout waits
//     until each is fixed or the operator defers them, and a deferral moves them
//     to Cleanup; it never makes them disappear.
//
// An unknown is never a pass: an unknown minimum check holds the rollout exactly
// as a failure does, and an unknown hardening check is outstanding hardening.
//
// Pure: no DOM, no network.
import type { SubjectReport } from './report.ts'
import { SET_LEVEL } from './report.ts'

type Result = SubjectReport['targets'][number]['results'][number]

/** The checks without which there is no usable way back in. */
export const EMERGENCY_MINIMUM_RULES: ReadonlySet<string> = new Set(['bg.role.permanentGa', 'bg.cloudOnly', 'bg.initialDomain', 'bg.enabled', 'bg.excludedFromAllPolicies', 'bg.notInDynamicScope', 'bg.hasMfaMethod'])

/** The owner confirmation a deferral is recorded under (PlanDecisions.confirmations[emergency step][this]). */
export const HARDENING_DEFERRAL_ID = 'hardening-deferred'

export type EmergencyTier = 'minimum' | 'hardening'

/**
 * The tier of one emergency-access result, or null where it asks nothing: a
 * pass, a note, or another subject's check. `bg.count` is minimum only with no
 * confirmed account; one confirmed account is a way back in, and the second is
 * resilience.
 */
export function emergencyTierOf(r: Result, confirmedAccounts: number): EmergencyTier | null {
  if (r.subject !== 'breakGlass' || r.severity === 'note') return null
  if (r.outcome !== 'fail' && r.outcome !== 'unknown') return null
  if (r.id === 'bg.count') return confirmedAccounts === 0 ? 'minimum' : 'hardening'
  return EMERGENCY_MINIMUM_RULES.has(r.id) ? 'minimum' : 'hardening'
}

export type EmergencyStanding = { minimum: Result[]; hardening: Result[] }

/** The emergency-access report, split into what holds the rollout and what can be deferred. */
export function emergencyStanding(report: SubjectReport, confirmedAccounts: number): EmergencyStanding {
  const all = report.targets.flatMap((t) => t.results)
  return {
    minimum: all.filter((r) => emergencyTierOf(r, confirmedAccounts) === 'minimum'),
    hardening: all.filter((r) => emergencyTierOf(r, confirmedAccounts) === 'hardening'),
  }
}

/** One confirmed account's own standing: what its checks found about it alone, and whether any ran. */
export type EmergencyAccountStanding = { id: string; minimum: number; hardening: number; assessed: boolean }

/**
 * Each confirmed emergency account's own standing, in the order the operator
 * confirmed them. The report files a check about the set of accounts (report.ts
 * SET_LEVEL: how many there are, whether their methods differ, where credentials
 * are kept, whether sign-ins alert) under the first account; that finding is
 * about every account and belongs to no one account's count, so the first
 * account never carries the set's evidence and the second never borrows the
 * first's. An account no check ran for is unassessed, never a pass.
 */
export function emergencyAccountStanding(report: SubjectReport, confirmedIds: readonly string[]): EmergencyAccountStanding[] {
  return confirmedIds.map((id) => {
    const own = report.targets.flatMap((t) => t.results).filter((r) => r.subject === 'breakGlass' && r.target === id && !SET_LEVEL.has(r.id))
    return {
      id,
      minimum: own.filter((r) => emergencyTierOf(r, confirmedIds.length) === 'minimum').length,
      hardening: own.filter((r) => emergencyTierOf(r, confirmedIds.length) === 'hardening').length,
      assessed: own.some((r) => r.outcome === 'pass' || r.outcome === 'fail' || r.outcome === 'unknown'),
    }
  })
}

/** FNV-1a: a short fingerprint that carries no account id into the plan record. */
function fingerprint(text: string): string {
  let h = 0x811c9dc5
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i)
    h = Math.imul(h, 0x01000193) >>> 0
  }
  return h.toString(16).padStart(8, '0')
}

const keyOf = (r: Result): string => fingerprint(`${r.id}|${r.target ?? ''}`)

/** What a deferral is given against: one fingerprint per outstanding recommendation (its check and the account it is about). */
export function hardeningBasis(hardening: readonly Result[]): string {
  return [...new Set(hardening.map(keyOf))].sort().join(',')
}

/**
 * Whether a recorded deferral covers the hardening outstanding now: every
 * recommendation still open was among those deferred. One fixed since changes
 * nothing; a new one is not covered, so the rollout waits until it is fixed or
 * deferred in its turn.
 */
export function hardeningDeferred(hardening: readonly Result[], deferral: { at: string; basis: string } | null | undefined): boolean {
  if (!deferral || hardening.length === 0) return false
  const given = new Set(deferral.basis.split(',').filter(Boolean))
  return hardening.every((r) => given.has(keyOf(r)))
}

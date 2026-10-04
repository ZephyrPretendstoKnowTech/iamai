// Who is asked for MFA today, where the scan read that the answer is nobody or
// nearly nobody (F-180): a tenant with no Conditional Access policy on and
// security defaults off is a common starting point, and nothing told its reader
// that nobody signs in with more than a password. The Plan says it above its
// tiles and the printed briefing in its introduction.
//
// It says only what the scan read. Every part of it is a reading taken in full:
// the policies (status ok, none On), security defaults (read, off), the people
// (status ok) and legacy per-user MFA for every account that can sign in
// (manualWork.ts perUserMfaReading, the one reading of it). Where any part was
// not read, or an account's per-user state came back unknown, it says nothing.
//
// Pure: no DOM, no network.
import type { TenantSnapshot } from '../../graph/collect/types.ts'
import { readInFull } from '../../graph/collect/coreSections.ts'
import { securityDefaultsState } from '../../derive/readinessContext.ts'
import { perUserMfaReading } from '../../roadmap/manualWork.ts'
import { pages } from '../../content/content.ts'
import { fillText } from '../../content/render.ts'
import { count } from '../../copy/statements.ts'

type Words = { nobody: string; perUserOnly: string }
const W = (pages.plan as unknown as { mfaToday: Words }).mfaToday

export type MfaTodaySnapshot = Pick<TenantSnapshot, 'config' | 'sources' | 'users' | 'perUserMfa'>

/**
 * The line, or null where the scan read MFA asked of somebody by a policy or
 * security defaults, or did not read enough to say: nobody is asked; or only the
 * accounts legacy per-user MFA still asks, by count.
 */
export function mfaTodayLine(snapshot: MfaTodaySnapshot): string | null {
  if (!readInFull(snapshot, 'caPolicies') || !readInFull(snapshot, 'users')) return null
  const on = (snapshot.config.caPolicies.rows ?? []).filter((p) => (p as { state?: unknown }).state === 'enabled')
  if (on.length > 0) return null
  if (securityDefaultsState(snapshot) !== false) return null
  const perUser = snapshot.perUserMfa
  if (!perUser) return null
  const signIn = snapshot.users.filter((u) => u.accountEnabled !== false)
  if (signIn.some((u) => (perUser[u.id]?.state ?? 'unknown') === 'unknown')) return null
  const live = new Set(signIn.map((u) => u.id))
  const asked = perUserMfaReading(snapshot).enabled.filter((u) => live.has(u.id))
  return asked.length === 0 ? W.nobody : fillText(W.perUserOnly, { accounts: count(asked.length, 'account') })
}

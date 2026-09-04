// The signed-in account (the operator): the one the scan read as /me
// (config.me). It is signed in now by definition, whatever the directory's
// lastSuccessfulSignIn says (Graph's sign-in activity lags by hours or days),
// so every activity reader takes its sign-in as the scan's own moment: Today
// counts it active as "signed in now", the dormant step never lists it, and
// its role counts in the admin populations. One source for who the operator
// is and when they last signed in; nothing else reads config.me.
import type { TenantSnapshot, UserRow } from '../graph/collect/types.ts'
import { pages } from '../content/content.ts'

/** The operator's user id, from the scan's /me row; null when the scan did not read it. */
export function operatorUserId(snapshot: TenantSnapshot): string | null {
  const me = (snapshot.config.me?.rows?.[0] ?? null) as { id?: unknown } | null
  return typeof me?.id === 'string' && me.id.length > 0 ? me.id : null
}

/** True for the signed-in account. */
export function isOperator(snapshot: TenantSnapshot, userId: string): boolean {
  return operatorUserId(snapshot) === userId
}

/**
 * A person's MFA evidence as the plan reads it: the records' last MFA success,
 * except that the operator's sign-in for this scan is one, at the scan's
 * moment, when the records hold none: the account signed in now, with MFA, to
 * run the scan, so it stands in the readiness strip like any active person
 * (Ready with a passkey), never "registered but never seen to complete MFA".
 */
export function mfaEvidenceOf(snapshot: TenantSnapshot, userId: string, records: { lastMfaSuccess?: { at: string; method: string } | null } | undefined): { at: string; method: string } | null {
  if (records?.lastMfaSuccess) return records.lastMfaSuccess
  return isOperator(snapshot, userId) ? { at: snapshot.asOf, method: (pages.app.today as { signedInNow: string }).signedInNow } : null
}

/**
 * A person's last successful sign-in as the plan reads it: the directory's
 * value, except that the operator signed in at the scan (asOf) if the
 * directory says nothing or something older.
 */
export function lastSignInOf(snapshot: TenantSnapshot, u: Pick<UserRow, 'id' | 'lastSuccessfulSignIn'>): string | null {
  if (!isOperator(snapshot, u.id)) return u.lastSuccessfulSignIn
  const own = u.lastSuccessfulSignIn ? Date.parse(u.lastSuccessfulSignIn) : Number.NaN
  const scan = Date.parse(snapshot.asOf)
  if (!Number.isFinite(scan)) return u.lastSuccessfulSignIn
  return Number.isFinite(own) && own >= scan ? u.lastSuccessfulSignIn : snapshot.asOf
}

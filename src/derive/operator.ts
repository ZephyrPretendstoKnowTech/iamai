// The signed-in account (the operator): the one the scan read as /me
// (config.me). The steps' "your own account" lines and the validation report
// name it, Connect asks it whether a stored scan's refused sections were
// refused to the account signed in now, and the passkey settings read it for
// the operator's own passkey (roadmap/passkeySettings.ts).
//
// One fact about it reaches the population (owner, 2026-09-27, F-177): the
// account signed in to run the scan, so it is in use as of the scan
// (scanSignInOf). The directory's last sign-in lags, and an admin who keeps a
// separate admin account for occasional admin work, as the plan asks, read as
// dormant on the scan they had just run: Disable or Confirm Dormant Accounts
// told them to disable the account they were signed in with, the only Global
// Administrator in a small tenant. Everything else about the operator is display
// only: signing in as a different account that is in use anyway changes nothing
// on Today, the Plan or Connect.
import type { TenantSnapshot } from '../graph/collect/types.ts'

/** The operator's user id, from the scan's /me row; null when the scan did not read it. */
export function operatorUserId(snapshot: Pick<TenantSnapshot, 'config'>): string | null {
  const me = (snapshot.config?.me?.rows?.[0] ?? null) as { id?: unknown } | null
  return typeof me?.id === 'string' && me.id.length > 0 ? me.id : null
}

/** The scan's own sign-in, for the account that ran it: the scan's time; null for anyone else, or where the scan read no /me row. */
export function scanSignInOf(snapshot: Partial<Pick<TenantSnapshot, 'config' | 'asOf'>>, userId: string): string | null {
  if (!snapshot.config || !snapshot.asOf) return null
  return operatorUserId(snapshot as Pick<TenantSnapshot, 'config'>) === userId ? snapshot.asOf : null
}

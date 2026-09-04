// The signed-in account (the operator): the one the scan read as /me
// (config.me). It is display only: the steps' "your own account" lines and the
// validation report name it, and nothing else reads config.me. The population
// never depends on it (derive/sets.ts, scoring/fromSnapshot.ts): the operator
// is a person like any other, active by the directory's own sign-in, proven
// by the records alone, so signing in as a different account changes nothing
// on Today, the Plan or Connect.
import type { TenantSnapshot } from '../graph/collect/types.ts'

/** The operator's user id, from the scan's /me row; null when the scan did not read it. */
export function operatorUserId(snapshot: TenantSnapshot): string | null {
  const me = (snapshot.config.me?.rows?.[0] ?? null) as { id?: unknown } | null
  return typeof me?.id === 'string' && me.id.length > 0 ? me.id : null
}

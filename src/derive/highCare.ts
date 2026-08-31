// Handle-with-care is detection only (prompt 46 item 19): the people an
// accidental lockout would hurt most, read from the tenant rather than asked
// for. Admins, the emergency-access accounts, confirmed service accounts, and
// every active person who has no MFA method yet. Changes still apply to them;
// the plan takes extra care around them. Pure.
import type { TenantSnapshot } from '../graph/collect/types.ts'
import type { MfaViability } from '../scoring/mfaViability.ts'
import { adminUsers } from './sets.ts'

export function detectHighCare(args: {
  snapshot: TenantSnapshot
  breakGlassUserIds: readonly string[]
  serviceAccountUserIds: readonly string[]
  viability: readonly MfaViability[]
}): Set<string> {
  const out = new Set<string>()
  for (const u of adminUsers(args.snapshot, new Set(args.serviceAccountUserIds))) out.add(u.id)
  for (const id of args.breakGlassUserIds) out.add(id)
  for (const id of args.serviceAccountUserIds) out.add(id)
  for (const v of args.viability) if (v.activity === 'active' && v.mfa === 'none') out.add(v.userId)
  return out
}

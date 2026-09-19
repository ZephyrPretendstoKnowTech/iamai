// Guests on MFA Readiness. Guests stay in the MFA campaign (owner, 2026-09-19,
// superseding 2026-09-18 option B): the page counts and lists them with
// everyone else, tagged Guest. This tile adds what is tenant-level: how many
// guests sign in, whether this tenant trusts MFA from
// their home organisation (the cross-tenant access settings), and whether the
// Plan's Require MFA for Guests is in place — with the suggestion, never a
// requirement, to ask guests for phishing-resistant MFA where their
// organisation does it.
//
// Pure: no DOM, no network.
import type { TenantSnapshot } from '../graph/collect/types.ts'

type TrustRow = { relationship?: string; inboundTrust?: { isMfaAccepted?: boolean }; b2bCollaborationInbound?: { inboundTrust?: { isMfaAccepted?: boolean } } }

/**
 * Whether this tenant trusts MFA performed in a guest's home organisation. On
 * only where the default relationship is readable and accepts it and no partner
 * override rejects it; off where the default or a partner rejects it; unknown
 * where the settings were not read. The one reading (roadmap/scenarioLines.ts
 * reads it too).
 */
export function guestMfaTrustOf(snapshot: Pick<TenantSnapshot, 'config'>): 'on' | 'off' | 'unknown' {
  const section = snapshot.config.crossTenantAccess
  const rows = (section?.rows ?? []) as TrustRow[]
  const value = (row: TrustRow): boolean | null => {
    const v = row.inboundTrust?.isMfaAccepted ?? row.b2bCollaborationInbound?.inboundTrust?.isMfaAccepted
    return typeof v === 'boolean' ? v : null
  }
  const defaults = rows.find((r) => r.relationship === 'default')
  const partners = rows.filter((r) => r.relationship === 'partner')
  if (defaults && value(defaults) === false) return 'off'
  if (partners.some((r) => value(r) === false)) return section?.status === 'ok' ? 'off' : 'unknown'
  if (section?.status === 'ok' && defaults && value(defaults) === true) return 'on'
  return 'unknown'
}

export type GuestReading = {
  /** Guests who signed in during the activity window. */
  active: number
  trust: 'on' | 'off' | 'unknown'
  /** The Plan's Require MFA for Guests step: in place, not yet, or not on this plan. */
  policy: 'inPlace' | 'notInPlace' | 'absent'
}

export const GUEST_STEP_ID = 's-goal-guests-mfa'

export function guestReadingOf(snapshot: Pick<TenantSnapshot, 'config'>, activeGuests: number, guestStep: { status: string } | null): GuestReading {
  return {
    active: activeGuests,
    trust: guestMfaTrustOf(snapshot),
    policy: guestStep === null ? 'absent' : guestStep.status === 'done' ? 'inPlace' : 'notInPlace',
  }
}

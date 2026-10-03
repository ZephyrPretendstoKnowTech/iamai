// Who Configure Passkey Authentication's change stops, and whether each keeps a
// way in. One reading, for the step's card, its Tasks, its Entra channel, the
// Plan's hold and MFA Readiness alike (ui/surfaces/emergencyPasskeyTasks.ts,
// emergencyImplementation.ts, derive/readinessContext.ts).
//
// The change makes passkeys device-bound and attested for every user, with no
// key restrictions added (owner, 2026-10-03). Device-bound applies at sign-in,
// so a synced passkey (iCloud Keychain, Google Password Manager) stops working;
// attestation applies to new registrations only. Before the change the step
// lists the people it would stop, so the admin knows: those left with no other
// way in first. The change is not withheld; the list is how the admin prepares.
//
// Only accounts that sign in are listed: an enabled account with a sign-in
// inside the activity window, the one rule Disable or Confirm Dormant Accounts
// uses (derive/sets.ts notActiveUsers). An emergency access account is always
// listed, however rarely it signs in: its passkey is the way back in.
//
// An administrator is held to more. The admin policy asks for a
// phishing-resistant sign-in, and where the tenant already enforces it, push
// does not satisfy it: "Each keeps Microsoft Authenticator, so none is locked
// out" was said over five admins on one tenant whose only phishing-resistant
// method was the passkey nobody could judge. For an admin, only another
// phishing-resistant method counts as keeping their way in.
import type { GroupMembers } from '../coverage/population.ts'
import type { TenantSnapshot } from '../graph/collect/types.ts'
import type { MappingState } from '../mapping/types.ts'
import type { MethodKind } from '../scoring/mfaViability.ts'
import { methodAvailability } from './methodAvailability.ts'
import { adminUserIds } from '../roles.ts'
import { notActiveUsers } from '../derive/sets.ts'
import { affectedPasskeysByProposedChange } from './passkeyCompatibility.ts'
import type { AffectedPasskeyProjection, AffectedPasskeyUser } from './passkeyCompatibility.ts'

/** The kinds that satisfy a phishing-resistant requirement besides a passkey (the stranded one is the passkey). */
const PHISHING_RESISTANT: ReadonlySet<MethodKind> = new Set<MethodKind>(['windowsHelloForBusiness'])

/** A registered method kind as the registration report names it, for methodAvailability. Absent: not a way to sign in. */
const SIGN_IN_METHOD: Partial<Record<MethodKind, string>> = {
  microsoftAuthenticator: 'microsoftAuthenticatorPush',
  phone: 'mobilePhone',
  softwareOath: 'softwareOneTimePasscode',
  temporaryAccessPass: 'temporaryAccessPass',
  windowsHelloForBusiness: 'windowsHelloForBusiness',
}

export type PasskeyRestrictionReading = {
  /** Listed accounts the intended settings leave with no passkey IAMAI can confirm they allow (passkeyCompatibility.ts `stranded`). */
  stranded: string[]
  /** Those of them with no other sign-in method the tenant is known to accept: the change locks them out. */
  lockedOut: string[]
  /** Those of them that keep another method, with it: they lose a passkey, not their access. */
  keeps: { accountId: string; method: MethodKind }[]
}

/**
 * The accounts the step lists: enabled and signing in, by the dormant step's own
 * rule, and every emergency access account. A dormant account is Disable or
 * Confirm Dormant Accounts' to handle; a disabled one cannot sign in at all.
 */
export function listedPasskeyAccounts(snapshot: TenantSnapshot, mapping: MappingState | undefined): (accountId: string) => boolean {
  const emergency = new Set((mapping?.breakGlassUserIds ?? []).map((id) => id.toLowerCase()))
  const dormant = new Set(notActiveUsers(snapshot, snapshot.asOf).map((u) => u.id.toLowerCase()))
  const disabled = new Set(snapshot.users.filter((u) => u.accountEnabled === false).map((u) => u.id.toLowerCase()))
  return (accountId) => {
    const id = accountId.toLowerCase()
    return emergency.has(id) || (!dormant.has(id) && !disabled.has(id))
  }
}

/**
 * The listed accounts whose passkeys the change stops, each with the passkeys it
 * stops: the accounts left with no other way in first (F-036: the card and the
 * task read this one list).
 */
export function affectedByHandover(snapshot: TenantSnapshot, mapping: MappingState | undefined, affected: AffectedPasskeyProjection, reading: PasskeyRestrictionReading): AffectedPasskeyUser[] {
  const listed = listedPasskeyAccounts(snapshot, mapping)
  const locked = new Set(reading.lockedOut.map((id) => id.toLowerCase()))
  const users = affected.users.filter((u) => listed(u.accountId))
  return [...users.filter((u) => locked.has(u.accountId.toLowerCase())), ...users.filter((u) => !locked.has(u.accountId.toLowerCase()))]
}

export function passkeyRestrictionReading(snapshot: TenantSnapshot, mapping: MappingState | undefined, groups: GroupMembers = new Map()): PasskeyRestrictionReading {
  const affected = affectedPasskeysByProposedChange(snapshot, mapping, groups)
  const listed = listedPasskeyAccounts(snapshot, mapping)
  const { usable } = methodAvailability(snapshot, { groupMembers: Object.fromEntries([...groups].filter(([, g]) => g.sampled !== true).map(([id, g]) => [id.toLowerCase(), g.memberIds])) })
  const lockedOut: string[] = []
  const keeps: { accountId: string; method: MethodKind }[] = []
  const admins = new Set([...adminUserIds(snapshot.roles)].map((id) => id.toLowerCase()))
  for (const row of snapshot.registrationDetails ?? []) if (row.isAdmin) admins.add(row.id.toLowerCase())
  const stranded = affected.stranded.filter(listed)
  for (const accountId of stranded) {
    const methods = snapshot.authMethods[accountId]
    const admin = admins.has(accountId.toLowerCase())
    // Known to be accepted, or it does not count: an unread authentication
    // methods policy says nothing about whether the account can still sign in.
    // An admin's must also be phishing-resistant.
    const other = Array.isArray(methods) ? methods.find((m) => { const name = SIGN_IN_METHOD[m.kind]; return name !== undefined && (!admin || PHISHING_RESISTANT.has(m.kind)) && usable(accountId, name) === 'yes' }) : undefined
    if (other) keeps.push({ accountId, method: other.kind })
    else lockedOut.push(accountId)
  }
  return { stranded, lockedOut, keeps }
}

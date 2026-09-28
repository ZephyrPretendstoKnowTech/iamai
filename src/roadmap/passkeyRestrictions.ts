// Whether the passkey key restrictions — an allow list of authenticator models —
// are IAMAI's to hand over yet. One reading, for the step's Tasks and its Entra
// channel alike (ui/surfaces/emergencyPasskeyTasks.ts, emergencyImplementation.ts).
//
// An allow list stops every passkey it does not name. The step opened on "Set
// Enforce key restrictions to Yes… Restrict specific keys to Allow… Add AAGUID…
// Save", four lines below a hedge that the passkeys on eleven accounts could not
// be judged (Jordan D13). A warning above an instruction is still the
// instruction.
//
// What is held back is precise, because holding it back everywhere would make
// the tool require what it can only help with: nearly every tenant holds a
// passkey whose model the scan cannot read, and an account that keeps another
// way to sign in loses a method, not its access, and registers an allowed
// passkey afterwards. So the restrictions are withheld only while some
// account the settings would leave without a passkey they allow has no other
// sign-in method this tenant is known to accept. That account is locked out by
// the save.
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
  /** Accounts the intended settings leave with no passkey IAMAI can confirm they allow (passkeyCompatibility.ts `stranded`). */
  stranded: string[]
  /** Those of them with no other sign-in method the tenant is known to accept: the save locks them out. */
  lockedOut: string[]
  /** Those of them that keep another method, with it: they lose a passkey, not their access. */
  keeps: { accountId: string; method: MethodKind }[]
}

/**
 * The accounts whose passkeys the change IAMAI hands over actually stops. While an
 * account would be locked out, the allow list is withheld (emergencyPasskeyTasks.ts
 * `withheld`), so a passkey that only the allow list stops is not stopped by what is
 * handed over, and its account is not affected (F-036, owner 2026-09-28: the sample's
 * card named one account whose passkey "loses access" while its task named another
 * as the one locked out). The card and the task read this one list.
 */
export function affectedByHandover(snapshot: TenantSnapshot, mapping: MappingState | undefined, groups: GroupMembers | undefined, affected: AffectedPasskeyProjection, reading: PasskeyRestrictionReading, beforeChange: boolean): AffectedPasskeyUser[] {
  // Once the settings are in place the allow list is the tenant's, and it stops them.
  if (reading.lockedOut.length === 0 || !beforeChange) return affected.users
  // The change as handed over, not a guess from a passkey's reason: a passkey the
  // storage-type change stops is still named (review, 2026-09-28).
  return affectedPasskeysByProposedChange(snapshot, mapping, groups ?? new Map(), { allowListWithheld: true }).users
}

export function passkeyRestrictionReading(snapshot: TenantSnapshot, mapping: MappingState | undefined, groups: GroupMembers = new Map()): PasskeyRestrictionReading {
  const affected = affectedPasskeysByProposedChange(snapshot, mapping, groups)
  const { usable } = methodAvailability(snapshot, { groupMembers: Object.fromEntries([...groups].filter(([, g]) => g.sampled !== true).map(([id, g]) => [id.toLowerCase(), g.memberIds])) })
  const lockedOut: string[] = []
  const keeps: { accountId: string; method: MethodKind }[] = []
  const admins = new Set([...adminUserIds(snapshot.roles)].map((id) => id.toLowerCase()))
  for (const row of snapshot.registrationDetails ?? []) if (row.isAdmin) admins.add(row.id.toLowerCase())
  for (const accountId of affected.stranded) {
    const methods = snapshot.authMethods[accountId]
    const admin = admins.has(accountId.toLowerCase())
    // Known to be accepted, or it does not count: an unread authentication
    // methods policy says nothing about whether the account can still sign in.
    // An admin's must also be phishing-resistant.
    const other = Array.isArray(methods) ? methods.find((m) => { const name = SIGN_IN_METHOD[m.kind]; return name !== undefined && (!admin || PHISHING_RESISTANT.has(m.kind)) && usable(accountId, name) === 'yes' }) : undefined
    if (other) keeps.push({ accountId, method: other.kind })
    else lockedOut.push(accountId)
  }
  return { stranded: affected.stranded, lockedOut, keeps }
}

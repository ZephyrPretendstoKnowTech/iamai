// Announcement templates keyed by the step's actual change (prompt 17 §4):
// a session change gets session wording, a strength change gets passkey
// wording, a block names the affected users or needs no announcement.
import type { Readiness } from '../roadmap/types.ts'

export const NO_ANNOUNCEMENT = 'No announcement needed: nobody is affected.'

/**
 * How a message opens, by who receives it (prompt 41 §4, review-09 finding 8).
 *
 * Every template opened "Hi everyone," including the ones sent to two named
 * people, which tells the reader immediately that nobody looked at who this was
 * for. The audience model already knows; it just was not reaching the first
 * line. Five branches, one per audience kind.
 */
export function salutation(audience: { kind: string; names?: string[] } | null): string {
  if (!audience) return 'Hi everyone,'
  switch (audience.kind) {
    case 'named':
      // Up to three names read as a greeting; six read as a distribution list.
      // Beyond that the recipients are still listed on the step, by name.
      if (!audience.names || audience.names.length === 0) return 'Hi,'
      return audience.names.length <= NAME_IN_GREETING ? `Hi ${listNames(audience.names)},` : 'Hi all,'
    case 'admins':
      return 'Hi admins,'
    case 'segment':
      return 'Hi all,'
    case 'none':
      return 'Hi,'
    default:
      return 'Hi everyone,'
  }
}

/** More names than this in a greeting reads as a distribution list. */
const NAME_IN_GREETING = 3

/** "Alex", "Alex and Sam", "Alex, Sam and Ali" — never a trailing comma. */
function listNames(names: string[]): string {
  if (names.length === 1) return names[0]
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`
}

const SETUP_LINK = 'https://aka.ms/mfasetup'
const SIGN_OFF = 'Questions or trouble? Reply here and we will help before the change lands.\n\nIT'

export type AnnouncementChange = {
  goalId: string
  family: Readiness['family']
  /** The grant floor the change lands on, when it is a grant change. */
  grant: 'mfa' | 'passwordless' | 'phishingResistant' | 'block' | 'compliantDevice' | 'compliantApplication' | 'approvedApplication' | 'passwordChange' | null
  /** True when the change is only to session controls. */
  sessionOnly: boolean
  /** Users seen using what a block would block; null when not measured. */
  affected: number | null
  /** Admin-only population. */
  admins: boolean
  /** Who receives it, so the greeting matches (prompt 41 §4). */
  audience?: { kind: string; names?: string[] } | null
}

export function announcementFor(c: AnnouncementChange, tenant: string, date: string): string | null {
  const hi = salutation(c.audience ?? (c.admins ? { kind: 'admins' } : null))
  if (c.goalId === 'register-info-protected') {
    return `${hi}\n\nFrom ${date}, setting up or changing your sign-in methods at ${tenant} works from the office network or after a Microsoft Authenticator check. If you need to set up a new phone, do it in the office or ask IT for a one-time pass.\n\n${SIGN_OFF}`
  }
  if (c.goalId === 'geo-restriction') {
    return `${hi}\n\nFrom ${date}, ${tenant} sign-ins from outside our allowed countries will be blocked. Travelling for work? Tell IT before you go so your trip is covered.\n\n${SIGN_OFF}`
  }
  if (c.sessionOnly) {
    return c.admins
      ? `Admins,\n\nFrom ${date}, admin sessions at ${tenant} expire sooner and never stay signed in on a browser. Expect to sign in again more often on admin portals; nothing changes for everyday work.\n\n${SIGN_OFF}`
      : `${hi}\n\nFrom ${date}, ${tenant} shortens how long a browser stays signed in on personal or shared devices. When asked, sign in again; nothing else changes.\n\n${SIGN_OFF}`
  }
  if (c.grant === 'block') {
    if (c.affected === 0) return NO_ANNOUNCEMENT
    if (c.affected !== null && c.affected > 0) {
      return `Hi,\n\nFrom ${date}, ${tenant} blocks a sign-in method you have used recently. IT will contact you before then with the supported way to sign in, so nothing stops working for you.\n\n${SIGN_OFF}`
    }
    return null
  }
  if (c.grant === 'phishingResistant' || c.grant === 'passwordless') {
    return c.admins
      ? `Admins,\n\nFrom ${date}, administrative sign-ins at ${tenant} require a passkey or security key. Register one now at ${SETUP_LINK} (Security info, Add method, Passkey).\n\n${SIGN_OFF}`
      : `${hi}\n\nFrom ${date}, signing in to ${tenant} uses a passkey instead of a password prompt. Set one up now at ${SETUP_LINK} (Security info, Add method, Passkey).\n\n${SIGN_OFF}`
  }
  if (c.grant === 'compliantDevice' || c.grant === 'approvedApplication' || c.grant === 'compliantApplication') {
    return `${hi}\n\nFrom ${date}, access to ${tenant} data will require a company-managed device or the approved apps. Sign in to your work device with your work account to make sure it is registered.\n\n${SIGN_OFF}`
  }
  if (c.grant === 'passwordChange') {
    return `${hi}\n\nFrom ${date}, ${tenant} asks for a password change when a sign-in looks risky. If you see the prompt, choose a new password and carry on; contact IT if it keeps happening.\n\n${SIGN_OFF}`
  }
  if (c.grant === 'mfa') {
    if (c.family === 'guest') {
      return `Hello,\n\nFrom ${date}, guest access to ${tenant} requires multifactor authentication. When prompted, confirm the sign-in with your own organisation's authenticator or set one up at ${SETUP_LINK}.\n\n${SIGN_OFF}`
    }
    return `${hi}\n\nFrom ${date}, ${tenant} is stepping up sign-in security. You may be asked to confirm sign-ins with Microsoft Authenticator. It takes about two minutes to get ready: go to ${SETUP_LINK} and add Microsoft Authenticator.\n\n${SIGN_OFF}`
  }
  if (c.family === 'location') {
    return `${hi}\n\nFrom ${date}, ${tenant} treats the office network as trusted; some tasks will ask for an extra check when you are away from it.\n\n${SIGN_OFF}`
  }
  return null
}

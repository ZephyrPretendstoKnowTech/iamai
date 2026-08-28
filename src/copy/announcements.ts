// Announcement templates keyed by goal family (prompt 13 §8). Steps whose
// evidence shows nobody affected get no template at all.
import type { Readiness } from '../roadmap/types.ts'

export const NO_ANNOUNCEMENT = 'No announcement needed: nobody is affected.'

const SETUP_LINK = 'https://aka.ms/mfasetup'
const SIGN_OFF = 'Questions or trouble? Reply here and we will help before the change lands.\n\nIT'

export function announcementFor(family: Readiness['family'], goalId: string, tenant: string, date: string): string | null {
  if (goalId === 'register-info-protected') {
    return `Hi everyone,\n\nFrom ${date}, setting up or changing your sign-in methods at ${tenant} works from the office network or after a Microsoft Authenticator check. If you need to set up a new phone, do it in the office or ask IT for a one-time pass.\n\n${SIGN_OFF}`
  }
  if (goalId === 'geo-restriction') {
    return `Hi everyone,\n\nFrom ${date}, ${tenant} sign-ins from outside our allowed countries will be blocked. Travelling for work? Tell IT before you go so your trip is covered.\n\n${SIGN_OFF}`
  }
  switch (family) {
    case 'mfa':
      return `Hi everyone,\n\nFrom ${date}, ${tenant} is stepping up sign-in security. You may be asked to confirm sign-ins with Microsoft Authenticator. It takes about two minutes to get ready: go to ${SETUP_LINK} and add Microsoft Authenticator.\n\n${SIGN_OFF}`
    case 'guest':
      return `Hello,\n\nFrom ${date}, guest access to ${tenant} requires multifactor authentication. When prompted, confirm the sign-in with your own organisation's authenticator or set one up at ${SETUP_LINK}.\n\n${SIGN_OFF}`
    case 'admin':
      return `Admins,\n\nFrom ${date}, administrative sign-ins at ${tenant} require a passkey or security key. Register one now at ${SETUP_LINK} (Security info, Add method, Passkey).\n\n${SIGN_OFF}`
    case 'device':
      return `Hi everyone,\n\nFrom ${date}, access to ${tenant} data will require a company-managed device. Sign in to your work device with your work account to make sure it is registered.\n\n${SIGN_OFF}`
    case 'location':
      return `Hi everyone,\n\nFrom ${date}, ${tenant} treats the office network as trusted; some tasks will ask for an extra check when you are away from it.\n\n${SIGN_OFF}`
    case 'block':
    case 'other':
    default:
      return null
  }
}

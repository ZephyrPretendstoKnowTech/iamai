// The lockout-scenario lines (prompt 48 item 6; docs/design/lockout-scenarios.md):
// one per scenario, named from this tenant's evidence — the client, the count,
// the people, the action, the date. A line exists only when its derivation
// returned people; the generic version lives behind More. Product voice.
import { count, list } from './statements.ts'

/** Up to ten names, then "and N more"; the caller resolves ids to names first. */
export function names(list_: string[]): string {
  if (list_.length === 0) return 'nobody'
  if (list_.length <= 10) return list(list_)
  return `${list_.slice(0, 10).join(', ')} and ${count(list_.length - 10, 'other')}`
}

const by = (date: string | null): string => (date ? ` Act before ${date}.` : '')

export const SCENARIO = {
  // 1 / 7 / 21 — legacy mail clients, on the block-legacy-auth step.
  legacyClient: (client: string, people: string[], date: string | null) =>
    `${count(people.length, 'person', 'people')} signed in with ${client} this month (${names(people)}), so they break when it is blocked.${by(date)}`,
  smtpRelay: (people: string[]) => `Authenticated SMTP is in use (${names(people)}), so move each to an SMTP relay or exclude it.`,
  eas: (people: string[], date: string | null) =>
    `${count(people.length, 'person', 'people')} use the phone's built-in Mail app over Exchange ActiveSync (${names(people)}), so they need Outlook mobile.${by(date)}`,
  // 3 — Autopilot, on the device-compliance step.
  technicianOffCompliance: (n: number, tool: string) =>
    `${count(n, 'technician sign-in')} to ${tool} came from non-compliant devices, so Autopilot registration from those machines stops.`,
  // 4 — session frequency, on the session steps.
  nonMicrosoftApps: (apps: string[]) => `The session controls also cover ${list(apps)}, so test their re-auth first.`,
  // 5 — trusted location stale, on the location steps.
  trustedLocationStale: (loc: string, matched: number, total: number) =>
    `${matched} of ${count(total, 'sign-in')} matched "${loc}" this month, so its ranges are stale or IPv6 is missing.`,
  // 6 — guests, on the guest steps.
  guestsNoTrust: (n: number, date: string | null) =>
    `${count(n, 'guest')} signed in this month and MFA trust from partner tenants is off, so each is asked to register here. Turn trust on first.${by(date)}`,
  // 8 — shared devices, on the shared-device step.
  sharedDevices: (rooms: string[]) =>
    `${count(rooms.length, 'shared device')} (${names(rooms)}) are excluded from the user policies, so this is their own policy.`,
  // 9 — token protection.
  unregisteredWindows: (people: string[], date: string | null) =>
    `${count(people.length, 'person', 'people')} sign in to Office from Windows devices that are neither joined nor registered (${names(people)}), so they are signed out.${by(date)}`,
  // 11 — service provider (GDAP).
  serviceProvider: (n: number, tenants: number, date: string | null) =>
    `${count(n, 'service-provider account')} from ${count(tenants, 'partner tenant')} signed in this month, so exclude "Service provider users" or they lose access.${by(date)}`,
  // 12 — the campaign's registered-but-unproven and no-method active people (prompt 48.1 item 6).
  campaignUnproven: (people: string[], date: string) =>
    `${count(people.length, 'person', 'people')} registered but unproven (${names(people)}), so ask each for one MFA sign-in before ${date}.`,
  campaignNoMethod: (people: string[], date: string) =>
    `${count(people.length, 'person', 'people')} with no method (${names(people)}), so register each and issue a Temporary Access Pass when off a trusted network, before ${date}.`,
  // 12 (48) — verification campaign, password-not-typed.
  passwordNotTyped: (people: string[]) =>
    `${count(people.length, 'person', 'people')} have not typed a password this month (${names(people)}), so line up a reset path before enforcement.`,
  // 15 — user risk.
  highUserRisk: (people: string[], date: string | null) =>
    `${count(people.length, 'person', 'people')} carry high risk today (${names(people)}), so dismiss stale risk first or they all reset on day one.${by(date)}`,
  hybridWriteback: 'Hybrid users are present, so a user-risk password change needs password writeback, which IAMAI cannot read.',
  // 16 — servers.
  serverSignIns: (people: string[], date: string | null) =>
    `${count(people.length, 'person', 'people')} sign in to servers or Azure VMs (${names(people)}), so servers cannot be compliant. Scope the policy or they lose RDP.${by(date)}`,
  // 17 — empty platform.
  emptyPlatform: (n: number, app: string) =>
    `${count(n, 'sign-in')} this month carried no platform (${app}), so an unknown-platform block would stop them.`,
  // 18 — browser without device claims.
  browserWithoutClaims: (people: string[], browser: string) =>
    `${names(people)} signed in from ${browser} without device claims on a compliant device, so those sign-ins are blocked.`,
  // 19 — ROPC automation.
  ropcAutomation: (person: string, tool: string, signIns: number, date: string | null) =>
    `${person} signed in ${count(signIns, 'time')} by ROPC to ${tool}, so move it to a service principal.${by(date)}`,
  // 13 — sync account.
  syncAccount: (name: string) => `${name} holds the directory-sync role and would be prompted, so the template excludes it. Check the tenant policy.`,
  // 14 — remote registration.
  noMethodRemote: (people: string[], date: string | null) =>
    `${count(people.length, 'person', 'people')} have no method and work outside the office (${names(people)}), so issue each a Temporary Access Pass.${by(date)}`,
} as const

/** What the tool cannot see, stated plainly under More (never a question, never a button). */
export const CANT_SEE = {
  mailDevices: 'Mail-sending devices that did not send during the last 30 days are not in the records.',
  smtpPerMailbox: 'Whether SMTP AUTH is on per mailbox is an Exchange Online setting IAMAI does not read.',
  passwordWriteback: 'Password writeback needs a permission IAMAI does not hold, so a hybrid password change cannot be confirmed here.',
}

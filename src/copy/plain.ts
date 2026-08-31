// Plain-language titles for every goal (scheduling-and-onboarding.md §3.1)
// and the three sentences for a manager (§3.3). The technical name stays as
// the subtitle; the plain title leads wherever a user first meets the goal.
import { count } from './statements.ts'

export const PLAIN_TITLES: Record<string, string> = {
  'mfa-all-users': 'Make sure everyone can prove who they are',
  'admins-phishing-resistant': 'Give admins a sign-in method that cannot be phished',
  'admin-portals-protected': 'Keep non-admins out of the admin portals',
  'guests-mfa': 'Make guests prove who they are too',
  'register-info-protected': 'Stop attackers adding their own MFA method',
  'block-legacy-auth': 'Turn off old sign-in methods that skip MFA',
  'block-device-code': 'Stop the device-code sign-in trick',
  'block-auth-transfer': 'Stop sign-ins being handed to another device',
  'geo-restriction': "Stop sign-ins from countries you don't work in",
  'admin-session': 'Keep admin sessions short',
  'byod-session-controls': 'Limit what personal devices can do in the browser',
  'require-managed-device': 'Require a company-managed device for company data',
  'block-unsupported-platforms': 'Block devices Entra cannot identify',
  'mobile-app-protection': 'Only allow protected apps on phones',
  'sign-in-risk': 'Challenge sign-ins that look risky',
  'user-risk': 'Reset the password of anyone marked high-risk',
  'azure-management-mfa': 'Protect the Azure management tools with strong sign-in',
  'device-registration-mfa': 'Ask for MFA before a device can be registered',
  'token-protection': 'Stop a stolen session token from being reused',
  'workload-identity-block': 'Keep automation accounts to the places they belong',
  'all-users-no-persistence': 'Sign everyone out when the browser closes',
  'pim-activation-reauth': 'Ask for MFA when an admin role is activated',
  'intune-enrollment-reauth': 'Ask for MFA before a device is enrolled',
  'block-downloads-unmanaged': 'Stop downloads to devices you do not manage',
  'sign-in-risk-medium': 'Challenge moderately risky sign-ins',
  'user-risk-medium': 'Reset the password of anyone marked medium-risk',
}

export function plainTitleFor(goalId: string, technical: string): string {
  return PLAIN_TITLES[goalId] ?? technical
}

/** Three sentences: the risk closed, the cost to the people who use the system, what happens if it is not done. */
export const MANAGER = {
  mfa: (people: number, notReady: number) =>
    `This closes the most common way accounts are taken over: a stolen or guessed password used on its own. ${count(people, 'person', 'people')} will confirm sign-ins with the Authenticator app they already have, and ${count(notReady, 'person', 'people')} need${notReady === 1 ? 's' : ''} it set up first, which takes a few minutes each. Without it, one leaked password is enough to read mail, files and chats as that person.`,
  admin: (admins: number) =>
    `This stops a phished admin password from becoming a takeover of the whole tenant. ${count(admins, 'admin')} will sign in with a security key or Windows Hello instead of a code that can be tricked out of them, which is faster once set up. Without it, one convincing email to one admin exposes every account and every setting.`,
  guest: (guests: number) =>
    `This makes the outside people you share with prove who they are, the same as staff. ${count(guests, 'guest')} will confirm once with their own phone or through their own company's sign-in. Without it, a partner's stolen password becomes a way into your files.`,
  block: (affected: number) =>
    `This turns off a sign-in path that bypasses every protection you have, which attackers scan for daily. ${affected === 0 ? 'Nobody used it in the last 30 days, so nobody notices the change.' : `${count(affected, 'account')} still use${affected === 1 ? 's' : ''} it and ${affected === 1 ? 'is' : 'are'} moved to a modern method first.`} Without it, MFA can be sidestepped entirely.`,
  location: (countries: string, affected: number) =>
    `This blocks sign-ins from places the business does not operate in, which is where most automated attacks come from. ${affected === 0 ? 'Nobody signed in from outside the allowed countries in the last 30 days.' : `${count(affected, 'person', 'people')} signed in from outside ${countries} recently and need${affected === 1 ? 's' : ''} a travel exception.`} Without it, a stolen password works from anywhere in the world.`,
  device: (people: number, noDevice: number) =>
    `This keeps company data on company-managed devices, where it can be protected and wiped. ${count(people, 'person', 'people')} keep working as they do today on managed devices; ${count(noDevice, 'person', 'people')} on unmanaged devices will use the browser with limits or enrol the device. Without it, a copy of the data can sit on any laptop or phone with no way to remove it.`,
  session: (people: number) =>
    `This limits how long a sign-in stays valid, so a device left open or a stolen session cannot be used for long. ${count(people, 'person', 'people')} will sign in a little more often, mainly on shared or personal devices. Without it, one unlocked screen or one stolen token stays usable for days.`,
  other: () =>
    'This closes a gap the baseline names that this tenant still has. People will see, at most, an occasional extra prompt. Without it, the gap stays open for anyone who knows to look for it.',
  prerequisite: () => 'This puts an object in place that the later changes depend on. Nobody notices it. Without it, the protective changes cannot be made at all.',
  verify: (people: number) =>
    `This confirms, before anything is enforced, that ${count(people, 'person', 'people')} can complete MFA. It costs each of them a few minutes once. Without it, enforcement locks out whoever was never set up.`,
}

// Goals whose control does something more specific than "everyone signs in with
// MFA", so the family note above would name another control's effect (prompt
// 49.1 item 5). Keyed by goal id; the family note is the fallback.
export const MANAGER_BY_GOAL: Record<string, () => string> = {
  'register-info-protected': () =>
    'This stops an attacker with a stolen password from registering their own MFA method and locking the real person out. Anyone already set up sees no change. Without it, one leaked password becomes a lasting hold on the account.',
  'device-registration-mfa': () =>
    'This requires MFA before a device joins or registers to the tenant, so a stolen password cannot enrol a device the attacker controls. People adding a real device confirm once. Without it, a rogue device can be made to look trusted.',
  'azure-management-mfa': () =>
    'This requires MFA to reach the Azure management portals and APIs, where one session can change billing, resources and access. Admins confirm when they open them. Without it, a stolen admin password runs the subscription unchallenged.',
  'admin-portals-protected': () =>
    'This requires MFA to open the Microsoft admin portals, so a phished password alone cannot reach tenant settings. Admins confirm when they sign in. Without it, one leaked admin password reaches every control.',
}

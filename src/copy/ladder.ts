// The free-tier ladder as plan steps (SPEC §12, pre-share-blockers §1).
//
// A tenant with no Entra ID P1 cannot hold a single Conditional Access policy,
// so every catalogue goal is licence-limited and the plan would otherwise be
// almost empty. The ladder is what such a tenant can do, in order, with the
// portal it already has. One entry per item in data/free-tier-ladder.json.
//
// Every impact sentence takes only what the scan can read on a free licence:
// configuration, the directory, and role assignments. Where a number needs
// sign-in records, the sentence says so rather than guessing.
import { count, list } from './statements.ts'

export const LADDER = {
  /** Shown once, above the ladder steps. */
  intro:
    'Entra ID Free holds no Conditional Access policy, so this plan is the free hardening ladder: ten steps carried out in the portal, in this order. Each one closes a way in that costs nothing to close.',
  heading: 'The free-tier ladder',
  rollback:
    'Every change on this ladder is undone in the screen it was made: re-enable an account, put a role back, invite a guest again. Nothing here deletes anything.',
}

export type LadderCopy = {
  title: string
  plainTitle: string
  why: string
  how: string[]
  exit: string[]
  whatChanges: string
  forManager: string
  learn: string
}

export const LADDER_STEPS: Record<string, LadderCopy> = {
  'security-defaults': {
    title: 'Turn on security defaults',
    plainTitle: 'Switch on the free protection Microsoft already ships',
    why: 'Security defaults require MFA of every administrator, ask everyone else to register for it, and block the old sign-in protocols that cannot do MFA at all. Without Entra ID P1 there is no Conditional Access, which makes security defaults the only tenant-wide control this licence has.',
    how: [
      'Sign in to the Entra admin center as a Global Administrator.',
      'Identity → Overview → Properties → Manage security defaults.',
      'Set the toggle to Enabled and save.',
      'Sign in with the break-glass account on a second device before closing the session, so a mistake still leaves a way back in.',
    ],
    exit: ['Security defaults report enabled on the next scan.', 'The break-glass account signed in once after the change.'],
    whatChanges: 'Everyone is asked to set up the Microsoft Authenticator app within 14 days, and anyone with an admin role is asked for it at every sign-in.',
    forManager:
      'A stolen password stops being enough to read anyone\'s mail. The cost to people is one setup on a phone, and a prompt on the app for the handful of accounts that administer the tenant. Without it, a single guessed or phished password reaches everything that account can reach.',
    learn: 'https://learn.microsoft.com/entra/fundamentals/security-defaults',
  },
  'break-glass-accounts': {
    title: 'Create and validate break-glass accounts',
    plainTitle: 'Keep two emergency accounts that always work',
    why: 'Every control on this ladder can lock the wrong person out, and the person locked out is usually the one who would fix it. Two cloud-only emergency accounts, kept out of every control and signed in on a schedule, mean a mistake costs minutes rather than a support case with Microsoft.',
    how: [
      'Entra admin center → Identity → Users → New user → Create new user.',
      'Create two accounts on the tenant\'s onmicrosoft.com domain, so neither depends on a custom domain or on the on-premises directory.',
      'Give each one a long random passphrase, stored where the admins can reach it without signing in to the tenant.',
      'Assign Global Administrator to both as a permanent active assignment.',
      'Sign in with each account once now, and again every 90 days, so nobody discovers a stale password during an incident.',
    ],
    exit: ['Two cloud-only accounts exist and are named in Setup.', 'Each has signed in within the last 90 days.'],
    whatChanges: 'Nothing changes for anyone who works here. Two accounts exist that nobody uses day to day.',
    forManager:
      'A locked-out administrator becomes a ten-minute problem rather than a day-long one. Nobody is affected by the change. Without the accounts, one bad setting can leave the organisation with no way into its own tenant.',
    learn: 'https://learn.microsoft.com/entra/identity/role-based-access-control/security-emergency-access',
  },
  'legacy-auth-inventory': {
    title: 'Inventory legacy authentication usage',
    plainTitle: 'Find what still signs in the old way',
    why: 'The old mail protocols carry a password and nothing else, so MFA never applies to them. Security defaults block them outright, which is why what still uses them has to be known before the block, rather than discovered by a stopped scanner on a Monday morning.',
    how: [
      'Microsoft 365 admin center → Settings → Org settings → Modern authentication, and confirm the legacy protocols are already off for Exchange Online.',
      'Exchange admin center → Reports → Mail flow, and look for devices sending through SMTP with a password.',
      'Walk the room: multifunction printers, scanners, alarm panels, backup jobs and line-of-business tools are what usually break.',
      'Move each one to a modern method, or to the authenticated SMTP relay Microsoft documents for devices that have no other option.',
    ],
    exit: ['Every device or application that used a legacy protocol is listed, with what it was moved to.'],
    whatChanges: 'Nothing changes yet. This step is a list of the devices that would stop working when the old protocols are blocked.',
    forManager:
      'Blocking the protocols that cannot do MFA closes the most common route into a mailbox. The cost is reconfiguring the printers and scanners that still send mail with a password. Without the list, the block happens anyway and the discovery is a stopped device.',
    learn: 'https://learn.microsoft.com/exchange/clients-and-mobile-in-exchange-online/disable-basic-authentication-in-exchange-online',
  },
  'app-passwords': {
    title: 'Eliminate app passwords',
    plainTitle: 'Remove the passwords that skip the second step',
    why: 'An app password is a password that bypasses MFA by design, issued for applications that cannot prompt. One of them in a mailbox client is a permanent hole in every control above it.',
    how: [
      'Entra admin center → Identity → Users → All users → Per-user MFA → Service settings.',
      'Look at whether users are allowed to create app passwords.',
      'Move any application still using one to modern authentication first: a current Outlook, or the documented SMTP relay for devices.',
      'Set the service settings so app passwords cannot be created, and remove the ones already issued.',
    ],
    exit: ['App passwords are not allowed in the service settings.', 'No application depends on one.'],
    whatChanges: 'An old mail program or device set up with a special password stops working until it is moved to a current one.',
    forManager:
      'A password that skips the second step stops existing. A small number of old devices or programs need setting up again. Without it, every other MFA control has a documented way around it.',
    learn: 'https://learn.microsoft.com/entra/identity/authentication/howto-mfa-mfasettings',
  },
  'per-user-mfa-cleanup': {
    title: 'Reconcile per-user MFA states',
    plainTitle: 'Retire the old per-person MFA switch',
    why: 'Per-user MFA is the setting that predates both security defaults and Conditional Access. It prompts on its own terms, hides who is really covered, and fights whatever is turned on above it.',
    how: [
      'Entra admin center → Identity → Users → All users → Per-user MFA.',
      'Note who is set to Enabled or Enforced, so nobody loses a prompt without it being deliberate.',
      'Set every account to Disabled there once security defaults are on, so one control does the prompting.',
      'Entra admin center → Protection → Authentication methods → Manage migration, and complete the migration so the methods policy is the single source.',
    ],
    exit: ['Every account reads Disabled under per-user MFA.', 'The authentication methods migration reports complete.'],
    whatChanges: 'People who were prompted by the old setting are prompted by security defaults instead. The prompt looks the same to them.',
    forManager:
      'Who is covered by MFA becomes a question with one answer instead of three. Nobody loses a prompt. Without it, an account can look protected in one screen and be unprotected in another.',
    learn: 'https://learn.microsoft.com/entra/identity/authentication/how-to-authentication-methods-manage',
  },
  'admin-accounts-separate': {
    title: 'Separate admin accounts from daily-driver accounts',
    plainTitle: 'Give administrators a second account for admin work',
    why: 'An admin role on the account that reads mail makes every phishing message a tenant-wide risk. A separate, role-only account with no mailbox means the message that gets through reaches an ordinary account and stops there.',
    how: [
      'Entra admin center → Identity → Users → New user, one role-only account per administrator, on the onmicrosoft.com domain.',
      'Leave the role-only accounts unlicensed: no mailbox, no Teams, nothing to phish.',
      'Move the directory roles onto the new accounts.',
      'Remove the roles from the accounts that hold mailboxes, and confirm each administrator can still do their work.',
    ],
    exit: ['No account holding a directory role also holds a mailbox licence.'],
    whatChanges: 'Administrators sign in with a second account when they administer the tenant, and with their usual account for everything else.',
    forManager:
      'A phishing message that catches an administrator reaches their mail rather than the whole tenant. The cost is a second sign-in for admin work, several times a week. Without it, one clicked link is a tenant-wide incident.',
    learn: 'https://learn.microsoft.com/entra/identity/role-based-access-control/best-practices',
  },
  'global-admin-count': {
    title: 'Reduce the number of Global Administrators',
    plainTitle: 'Give people the smallest role that does their job',
    why: 'Global Administrator can read, change and delete everything, and Microsoft\'s guidance is two to four accounts holding it. Every extra one is another account whose compromise is total.',
    how: [
      'Entra admin center → Identity → Roles & admins → Global Administrator, and list who holds it.',
      'For each person, find the role that covers what they actually do: User Administrator, Exchange Administrator, Helpdesk Administrator, Security Reader.',
      'Assign the smaller role, confirm the person can still work, then remove Global Administrator.',
      'Keep the two break-glass accounts in the count, and check the total is between two and four.',
    ],
    exit: ['Between two and four accounts hold Global Administrator, the break-glass accounts among them.'],
    whatChanges: 'Some administrators see fewer screens in the portal. What they do day to day still works.',
    forManager:
      'The number of accounts whose compromise costs the whole tenant drops to the smallest workable number. Some administrators lose access to screens they did not use. Without it, every extra Global Administrator is a full-tenant key in circulation.',
    learn: 'https://learn.microsoft.com/entra/identity/role-based-access-control/best-practices',
  },
  'guest-review': {
    title: 'Review guest accounts and external state',
    plainTitle: 'Remove the outside accounts nobody needs',
    why: 'Guests keep the access they were given long after the project ends, and an invitation nobody accepted is an open door with a name on it. What remains after the review is what any later guest control has to protect.',
    how: [
      'Entra admin center → Identity → Users → All users, filter User type to Guest.',
      'For each guest, find who invited them and whether the work is finished.',
      'Delete the guests nobody sponsors, and the invitations that were never accepted.',
      'Entra admin center → External Identities → External collaboration settings, and restrict who is allowed to invite.',
    ],
    exit: ['Every remaining guest has someone who knows why they are there.', 'No unaccepted invitations remain.'],
    whatChanges: 'People from outside the organisation who no longer work with anyone here lose access to shared files and sites.',
    forManager:
      'Access held by people outside the organisation matches who is actually working with the organisation. Anyone removed by mistake is re-invited in a minute. Without the review, an account at a supplier who left two years ago still opens the files.',
    learn: 'https://learn.microsoft.com/entra/identity/users/users-restrict-guest-permissions',
  },
  'stale-accounts': {
    title: 'Disable dormant and never-used accounts',
    plainTitle: 'Switch off the accounts nobody is using',
    why: 'An account nobody uses is an account nobody notices being used. Disabling it costs nothing and removes it from every attack that starts with a password.',
    how: [
      'Entra admin center → Identity → Users → All users, and sort by the date each account was created.',
      'Start with the enabled accounts that hold no licence: a person who works here almost always holds one.',
      'Confirm each candidate with whoever manages that part of the organisation, then set Block sign-in rather than deleting, so nothing is lost.',
      'Delete after 30 days of nobody asking for it back.',
    ],
    exit: ['Every account not in use is blocked from signing in.'],
    whatChanges: 'Accounts that nobody has used stop being able to sign in. Anyone who needs one back is unblocked in a minute.',
    forManager:
      'Forgotten accounts stop being a way in. Nobody who works here is affected, and a mistake is undone immediately. Without it, the account of someone who left years ago still accepts a password.',
    learn: 'https://learn.microsoft.com/entra/identity/monitoring-health/howto-manage-inactive-user-accounts',
  },
  'authenticator-over-sms': {
    title: 'Move people from text message to the Authenticator app',
    plainTitle: 'Move people off codes sent by text',
    why: 'Codes by text and voice call are the weakest methods Microsoft offers: both are taken by a swapped SIM or a convincing phone call. The Authenticator app and passkeys cost nothing extra and cannot be intercepted that way.',
    how: [
      'Entra admin center → Protection → Authentication methods → Policies.',
      'Enable Microsoft Authenticator for everyone, and passkeys where the devices support them.',
      'Ask people to add the app before the old methods go, so nobody is caught without a way in.',
      'Set text message and voice call to disabled once the app is in place, keeping any person who genuinely has no smartphone in a named group that keeps them.',
    ],
    exit: ['Microsoft Authenticator or a passkey is registered for everyone who can use one.', 'Text message and voice call are off, other than for a named exception group.'],
    whatChanges: 'People approve sign-ins in an app on their phone instead of typing a code from a text message.',
    forManager:
      'A swapped SIM stops being enough to sign in as someone here. The cost is a five-minute setup on each phone, and a plan for the few people who have no smartphone. Without it, the second step can be stolen with a phone call to a mobile provider.',
    learn: 'https://learn.microsoft.com/entra/identity/authentication/concept-authentication-methods',
  },
}

/** Per-tenant impact: numbers the scan can read on a free licence, or a plain statement that it cannot. */
export const LADDER_IMPACT = {
  securityDefaultsOn: (users: number): string =>
    `Security defaults are on: all ${count(users, 'enabled account')} are asked to register for MFA, and every account holding an admin role is asked for it at each sign-in.`,
  securityDefaultsOff: (users: number, admins: number): string =>
    `Security defaults are off. Turning them on asks all ${count(users, 'enabled account')} to register for MFA within 14 days, and prompts the ${count(admins, 'account')} holding an admin role at every sign-in.`,
  securityDefaultsUnknown: 'The security defaults setting could not be read on this scan, so this step cannot say whether it is on.',
  breakGlassDone: (names: string[]): string => `${list(names)} are confirmed as break-glass accounts and stay out of every control on this ladder.`,
  breakGlassMissing: (found: number): string =>
    found === 0
      ? 'No break-glass account is confirmed. Every step below can lock an administrator out, and nothing here is a way back in.'
      : `${count(found, 'break-glass account')} is confirmed. Two accounts mean one can be lost without losing the way back in.`,
  legacyAuth: 'Entra ID Free keeps no sign-in records, so IAMAI cannot count what still signs in with the old protocols. The Exchange admin center reports and the devices in the room are where that list comes from.',
  appPasswords: 'App passwords live in the legacy per-user MFA settings, which Microsoft Graph does not expose, so IAMAI cannot count them. The service settings screen named below shows them.',
  perUserMfaMigrated: 'The authentication methods migration reports complete, so the methods policy is the single place methods are decided.',
  perUserMfaOpen: (state: string): string =>
    `The authentication methods migration reads ${state}, so the legacy per-user settings can still prompt on their own terms.`,
  perUserMfaUnknown: 'The authentication methods policy could not be read on this scan, so this step cannot say whether the migration is finished.',
  adminsSeparate: (admins: number): string =>
    `Every one of the ${count(admins, 'account')} holding a directory role is unlicensed, so none of them carries a mailbox an attacker can reach.`,
  adminsMixed: (mixed: number, admins: number, names: string[]): string =>
    `${mixed} of the ${count(admins, 'account')} holding a directory role also hold a mailbox licence: ${list(names)}. A phishing message to any of them lands on an account that can change the tenant.`,
  adminsNone: 'No directory role assignment was readable on this scan, so this step cannot name who administers the tenant.',
  globalAdminsOk: (n: number, names: string[]): string => `${count(n, 'account')} hold Global Administrator: ${list(names)}. That is inside the two to four Microsoft recommends.`,
  globalAdminsMany: (n: number, names: string[]): string =>
    `${count(n, 'account')} hold Global Administrator: ${list(names)}. Microsoft recommends two to four, so ${n - 4} of them want a smaller role.`,
  globalAdminsFew: (n: number): string =>
    n === 0
      ? 'No permanent Global Administrator was found in the scan. One account locked out would leave nobody able to fix it.'
      : `${count(n, 'account')} holds Global Administrator. A second account means one can be lost without losing the tenant.`,
  guestsClean: 'The directory holds no guest accounts and no unaccepted invitations, so there is nothing outside the organisation to review.',
  guests: (guests: number, pending: number, names: string[]): string =>
    pending === 0
      ? `${count(guests, 'guest account')} can reach shared files and sites: ${list(names)}.`
      : `${count(guests, 'guest account')} can reach shared files and sites, ${pending} of them from an invitation nobody accepted: ${list(names)}.`,
  staleUnlicensed: (n: number, total: number): string =>
    n === total
      ? `Entra ID Free does not record when an account last signed in, so IAMAI cannot name the dormant ones. No licence is assigned to any of the ${count(total, 'enabled account')}, so the licence signal says nothing here: start from the person each account belongs to.`
      : `Entra ID Free does not record when an account last signed in, so IAMAI cannot name the dormant ones. ${n} of the ${count(total, 'enabled account')} hold no licence, which is where the review starts.`,
  staleNone: 'Entra ID Free does not record when an account last signed in, so IAMAI cannot name the dormant ones. Every enabled account holds a licence, so start from the people each one belongs to.',
  methodsWeakOff: 'Text message and voice call are already off in the authentication methods policy, so nobody can fall back to the weakest methods.',
  methodsWeakOn: (weak: string[], authenticator: boolean): string =>
    `${list(weak)} ${weak.length === 1 ? 'is' : 'are'} enabled for everyone in the authentication methods policy. ${authenticator ? 'Microsoft Authenticator is enabled as well, so the move costs a setup on each phone.' : 'Microsoft Authenticator is not enabled yet, so it goes on first.'}`,
  methodsUnknown: 'The authentication methods policy could not be read on this scan, so this step cannot say which methods are in use.',
  /** Named people are shown up to this many, then counted. */
  andMore: (n: number): string => `and ${n} more`,
}

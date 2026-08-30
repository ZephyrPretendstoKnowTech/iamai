// Step content copy (roadmap-v2.md §4): the twelve-part step body. Failure
// modes per goal family, how to verify in the portal's words, help-desk
// notes, rollback timing, owner and date. Product voice throughout.
import { count } from './statements.ts'

export const SECTION = {
  whatChanges: 'What changes',
  whyItMatters: 'Why it matters',
  whoItTouches: 'Who it touches',
  couldGoWrong: 'What could go wrong',
  prerequisites: 'Prerequisites',
  theChange: 'The change',
  ringPlan: 'Ring plan',
  // Said instead of showing nothing, so an absent ring plan reads as a decision
  // rather than a gap (prompt 37 §11).
  noRings: {
    prerequisite: 'No ring plan: this step prepares the tenant and denies nobody access, so it lands in one go.',
    verify: 'No ring plan: this step contacts people rather than changing a policy.',
    recurring: 'No ring plan: this is a recurring check, not a rollout.',
    done: 'No ring plan: this step is already delivered, so there is no rollout left to stage.',
    other: 'No ring plan: this step cannot deny anyone access, so it does not need staging.',
  },
  howToVerify: 'How to verify',
  exitCriteria: 'Exit criteria',
  rollback: 'Rollback',
  comms: 'Comms',
  ownerAndDate: 'Scheduled date',
  noPrerequisites: 'Nothing has to exist first.',
  ringEntry: 'Start when',
  ringExit: 'Move on when',
  ringSoak: (days: number) => `${count(days, 'day')} of soak`,
  applies: { yes: 'applies here', no: 'low risk here', unknown: 'unknown here' },
  changeField: 'Field',
  changeFrom: 'Today',
  changeTo: 'After',
  previousBody: 'Previous policy body (restore byte for byte)',
  helpDeskTitle: 'For the help desk',
  callsAbout: 'What people will call about',
  whatToSay: 'What to say',
  ringAnnouncement: (ring: string, date: string) => `${ring} · ${date}`,
  scheduledDate: 'Scheduled date',
  scheduledHint: 'Setting a date moves this step and everything that waits for it; the rings follow.',
  scheduledClear: 'Use the plan date',
  filterLabel: 'Sign-in log filter (paste into the filter box):',
  goodLooksLike: 'Good looks like:',
}

export const WHAT_CHANGES = {
  create: (title: string, people: number) => `A new Conditional Access policy applies "${title}" to ${count(people, 'person', 'people')}, in report-only first, then enforced ring by ring.`,
  adjust: (name: string, fields: number) => `The existing policy ${name} changes in ${count(fields, 'field')}; nothing else about it moves.`,
  prerequisite: 'An object or an answer is put in place; nobody notices a difference.',
  verify: (people: number) => `${count(people, 'person', 'people')} prove they can complete MFA before anything is enforced.`,
  recurring: 'A check, repeated; nothing changes for anyone.',
  done: 'Already in place; nothing changes.',
}

export const FAILURE = {
  // Security-info registration (guidance-audit-01, steps/security-info-registration.md).
  // Microsoft's own pattern excludes trusted locations and leans on a Temporary
  // Access Pass; without one, a person with no method cannot register at all.
  registration: {
    remote: 'People working away from a trusted location who have no method registered yet',
    noTap: 'Anyone who needs a Temporary Access Pass issued before they can register at all',
    guests: 'Guests and external users, who cannot be issued a Temporary Access Pass',
    passwordless: 'Windows Hello for Business and macOS Platform SSO enrolment, which this policy has applied to since 6 July 2026',
    servicePrincipals: 'Applications and service principals, which a policy scoped to users never covers',
    evidence: {
      noMethod: (n: number) =>
        n === 1
          ? '1 active person has no method registered. Away from a trusted location they cannot register one either: registering asks for MFA, and they have none to answer with.'
          : `${count(n, 'active person', 'active people')} have no method registered. Away from a trusted location they cannot register one either: registering asks for MFA, and they have none to answer with.`,
      allSet: 'everyone active already has a method, so nobody has to register from scratch under this policy.',
      unknown: 'registration data could not be read, so assume some people still have no method and issue passes before enforcing.',
      tapOn: 'Temporary Access Pass is enabled in the authentication methods policy, so an administrator can issue a way in.',
      tapOff: 'Temporary Access Pass is not enabled in the authentication methods policy, so there is no way to rescue somebody who cannot register.',
      tapUnknown: 'the authentication methods policy could not be read, so whether a Temporary Access Pass can be issued is unknown.',
      noTrustedLocation: 'no trusted location is confirmed, so excluding trusted locations excludes nobody and the policy applies everywhere.',
      guests: (n: number) => `${count(n, 'guest')} in the directory. Microsoft says to exclude guests from this policy, because a pass cannot be issued to them.`,
      guestsNone: 'no guests in the directory.',
      passwordless: 'since 6 July 2026 this policy also applies while somebody sets up Windows Hello for Business or macOS Platform SSO; a policy written before then behaves differently now.',
      servicePrincipals: 'a policy scoped to users never blocks an application signing in as itself; Conditional Access for workload identities is the separate control for that.',
    },
  },
  legacy: {
    devices: 'Printers, scanners and appliances that send mail over SMTP',
    lob: 'Line-of-business applications that sign in with basic authentication',
    mailboxes: 'Shared mailboxes and service accounts polled by scripts',
    certificate: 'Certificate-based authentication on mobile, which counts as legacy and is blocked with the rest',
    alreadyGone:
      'Microsoft disabled basic authentication for Exchange ActiveSync, POP, IMAP, EWS, Remote PowerShell, offline address book and Autodiscover in every tenant, and it cannot be turned back on. For those protocols this block closes a door that is already shut. SMTP submission is the exception that is still live.',
    relay:
      'A device that can only send mail with a password moves to an SMTP relay connector, Direct Send, High Volume Email or Azure Communication Services. Excluding its mailbox from the policy instead leaves that account open to password spray.',
    evidence: {
      seen: (users: number, protocols: string) => `${count(users, 'account')} signed in with legacy protocols in 30 days (${protocols}): they will break.`,
      none: 'no legacy-protocol sign-ins in 30 days: low risk.',
      unknown: 'no sign-in records to check against, so treat every printer and script as suspect until one week of report-only says otherwise.',
      serviceAccounts: (n: number) => `${count(n, 'confirmed service account')} among the affected: carve them out first.`,
    },
  },
  deviceCode: {
    tools: 'Command-line tools and scripts that sign in with a device code (Azure CLI, PowerShell on a server, IoT devices)',
    tvs: 'Meeting-room devices and shared screens that use device-code sign-in',
    evidence: {
      seen: (users: number) => `${count(users, 'account')} used device-code sign-in in 30 days: they will break.`,
      none: 'no device-code sign-ins in 30 days: low risk.',
      unknown: 'no sign-in records to check against, so ask whoever runs automation before enforcing.',
    },
  },
  authTransfer: {
    handoff: 'Sign-ins handed from one device to another (a QR code on a desktop, finished on a phone)',
    evidence: {
      seen: (users: number) => `${count(users, 'account')} used authentication transfer in 30 days.`,
      none: 'no authentication-transfer sign-ins in 30 days: low risk.',
      unknown: 'no sign-in records to check against.',
    },
  },
  device: {
    noPolicy:
      'Devices with no compliance policy assigned. Intune treats those as compliant until the tenant-wide setting is changed to Not compliant, so the control can look enforced while it grants everything. Changing that setting marks every unpoliced device non-compliant at once.',
    graceWindow:
      'Set a grace period on the Mark device non-compliant action before enforcing. It ships at zero days, which marks a device non-compliant the moment it fails.',
    staleReport:
      'A device that stops reporting is treated as non-compliant once the compliance status validity period runs out, thirty days by default. Laptops back from a month away are blocked with nothing having changed.',
    errorState: 'A device stuck in the Error state keeps its old status for seven days and then turns non-compliant, so a tenant can look healthy for a week and then block people in a batch.',
    enrolment:
      'Requiring a compliant device does not block Intune enrolment, so no exclusion is needed for it. The one exclusion Microsoft documents is the Windows Store for Business app, for Subscription Activation.',
    reportOnlyPrompt:
      'Even in report-only, this policy makes macOS, iOS and Android users pick a device certificate, and the prompt repeats until the device is compliant.',
    personal: 'Personal or unmanaged machines, including home PCs used for work',
    kiosks: 'Kiosks, shared workstations and lab machines nobody enrolled',
    contractors: 'Contractors and partners on devices the tenant does not manage',
    platforms: 'Devices Intune cannot mark compliant, such as Windows Home editions, other Linux builds, and Edge in InPrivate',
    evidence: {
      noDevice: (n: number, total: number) => `${n} of ${count(total, 'active member')} own no compliant device: they will be stopped.`,
      allCovered: 'every active member owns a compliant or hybrid-joined device: low risk.',
      unknown: 'device data could not be read, so assume the worst until it can.',
      guests: (n: number) => `${count(n, 'guest')} sign in on devices the tenant will never manage, so exclude guests or expect calls.`,
      platforms: (summary: string) => `devices seen: ${summary}.`,
    },
  },
  geo: {
    travel: 'People travelling for work (seen in the field; Microsoft documents the proxy case rather than this one)',
    vpn: 'A VPN or proxy whose exit is in another country, because the address the policy reads is the proxy address',
    roaming: 'Mobile networks that route through a neighbouring country (seen in the field; not something Microsoft documents)',
    notInstant: 'A country rule does not bite until the token refreshes, so an existing session carries on and a traveller is not unblocked the moment the list changes.',
    residential: 'An office on ordinary broadband whose address changes, so the trusted location stops matching (seen in the field; not something Microsoft documents)',
    evidence: {
      seen: (countries: string, users: number) => `sign-ins seen from ${countries} (${count(users, 'person', 'people')}) in 30 days: these will be blocked.`,
      none: 'every sign-in in 30 days came from an allowed country: low risk.',
      unknown: 'no sign-in records to check against, so ask who travels before enforcing.',
      // C13: this risk always applies, because it is a property of token
      // lifetime rather than of the tenant, so it needs evidence of its own
      // instead of borrowing the country-sign-in evidence beside it.
      tokenLifetime: (people: number) => `${count(people, 'active person', 'active people')} hold a session that carries on until its token refreshes, up to an hour.`,
    },
  },
  mfa: {
    noMethod: 'People with no MFA method who are prompted and cannot answer',
    smsOnly: 'People whose only method is SMS, waiting on a text that does not arrive',
    dormant: 'Dormant accounts that return after the change and were never set up',
    shared: 'Shared accounts whose method sits on one person\'s phone',
    evidence: {
      noMethod: (n: number) => `${count(n, 'active person', 'active people')} have no method: they will be locked out on first prompt.`,
      allSet: 'everyone active has a method: low risk.',
      smsOnly: (n: number) => `${count(n, 'person', 'people')} rely on SMS or voice only.`,
      dormant: (n: number) => `${count(n, 'dormant account')} would meet the prompt on return.`,
      unknown: 'registration data could not be read, so run the campaign and verify by hand.',
    },
  },
  admin: {
    customRoles: 'People holding a custom role or an administrative-unit-scoped role, which a policy targeting directory roles does not reach at all',
    portalFloor: 'Microsoft already requires MFA on the admin portals for every account, exclusions included. This step is the strength above that floor, not the floor itself.',
    noKey: 'Admins without a FIDO2 key, passkey or Windows Hello for Business',
    eligible: 'PIM-eligible admins who activate a role and meet the requirement mid-task',
    breakGlass: 'A break-glass account caught by the policy',
    evidence: {
      without: (n: number, total: number) => `${n} of ${count(total, 'admin')} hold no phishing-resistant method: they will be stopped.`,
      all: 'every admin holds a phishing-resistant method: low risk.',
      eligible: (n: number) => `${count(n, 'eligible-only admin')} would meet it on activation.`,
      breakGlassOut: 'the break-glass accounts sit in the exclusion group: safe.',
      breakGlassIn: 'a break-glass account is in scope, so stop and fix the exclusion first.',
      unknown: 'registration data could not be read, so verify each admin by hand.',
    },
  },
  guest: {
    noTap: 'Guests who get stuck: a Temporary Access Pass cannot be issued to an external guest, so the usual rescue does not exist',
    partner: 'An IT partner administering this tenant through delegated access, which a policy aimed at external users can sever. Scope it with the Service provider user type rather than by naming people.',
    home: 'Guests whose home tenant MFA is not trusted here, prompted to register again',
    evidence: {
      guests: (n: number) => `${count(n, 'active guest')} in scope; MFA trust for their home tenants is not configured, so each registers here once.`,
      trusted: (n: number) => `${count(n, 'active guest')} in scope; inbound MFA trust is configured, so most will pass on their home MFA.`,
      none: 'no active guests: low risk.',
    },
  },
  session: {
    persistScope: 'A never-persistent rule that does not target every resource, which Microsoft requires because all tabs in a browser share one session token',
    everyTimeLoop: 'Asking for sign-in every time without also requiring MFA in the same policy can put people in a sign-in loop.',
    sharedDevices: 'Teams Rooms, panels and desk phones do not support sign-in frequency or browser persistence, and a frequency policy signs them out on a cycle.',
    rememberMfa: 'Remember MFA on trusted devices left on, which prompts people at times nobody expects once sessions stop persisting',
    downloadLeaks:
      'App-enforced restrictions stop downloads in the browser, and leave Anyone links, older clients and file previews working. It can take a day to take effect and does not touch sessions already signed in.',
    unsaved: 'People losing unsaved work to a re-authentication prompt',
    kiosks: 'Shared and kiosk sessions that time out mid-task',
    evidence: (n: number) => `${count(n, 'active person', 'active people')} will see the new prompt cadence; nobody is blocked.`,
  },
  generic: {
    misconfig: 'A condition typed wrongly (a group, an app, a location) and the policy hits more than intended',
    evidence: 'report-only shows the real match before anything is enforced.',
  },
}

export const VERIFY = {
  reportOnly: (policy: string) => `Entra admin center → Protection → Conditional Access → Policies → ${policy} → Insights and reporting: the report-only impact by user and by result.`,
  signInLogs: 'Entra admin center → Identity → Monitoring & health → Sign-in logs → Add filters.',
  filterPolicy: (policy: string) => `Conditional Access policy: "${policy}"; Result: Failure or Report-only: Failure`,
  filterLegacy: 'Client app: Exchange ActiveSync, Other clients; Status: Failure',
  filterDeviceCode: 'Authentication protocol: Device code; Status: Failure',
  filterAuthTransfer: 'Authentication protocol: Authentication transfer; Status: Failure',
  filterCountry: (allowed: string) => `Location: not in ${allowed}; Status: Failure`,
  filterMfa: 'Authentication requirement: Multifactor authentication; Status: Failure',
  filterDevice: 'Device: Compliant = No; Status: Failure',
  filterSession: 'Conditional Access: Success; look for sign-in frequency and persistence in the Conditional Access tab of each sign-in.',
  goodGrant: (percent: number, ring: string) => `at least ${percent}% of the ${ring} members' sign-ins succeed, and every failure has a name and a cause.`,
  goodBlock: 'every failure against the policy is one the plan expected (the accounts named above), and none is a person doing legitimate work.',
  goodSession: 'people report the new prompt cadence and nobody reports losing work to it.',
  goodPrerequisite: 'the object exists with the exact name in the plan and the next scan sees it.',
  goodVerify: (threshold: number) => `readiness reaches ${threshold}% of active users on a re-scan.`,
  registration: 'Entra admin center → Protection → Authentication methods → Activity → Registration: who has which method.',
  strength: 'Entra admin center → Protection → Authentication methods → Authentication strengths: the strength exists with the allowed combinations.',
  objects: 'Entra admin center → Groups (or Named locations, under Conditional Access): the object exists with the name in the plan.',
}

export const ROLLBACK_V2 = {
  create: 'Set the policy back to Report-only (or delete it). Nothing else in the tenant changes.',
  adjust: 'Restore the fields listed above from the previous body below; leave every other field alone.',
  timing: 'Microsoft documents Conditional Access changes as taking up to a day to reach every service, and about two hours for some updates. Tokens already issued keep working until they refresh, so revoke sessions if the change has to bite now.',
  storedBody: 'The previous body is stored in the plan file so it can be restored byte for byte.',
}

export const HELP_DESK = {
  mfa: {
    calls: ['A prompt asks for a code and the caller has no Authenticator app.', 'The Authenticator notification never arrives.', 'The caller has a new phone.'],
    say: ['Issue a Temporary Access Pass and walk through https://aka.ms/mfasetup together.', 'Check the account is not in the exclusion group; it should not be.', 'For a new phone: Temporary Access Pass, then re-register Authenticator.'],
  },
  admin: {
    calls: ['An admin sign-in is blocked asking for a security key.', 'Windows Hello is not offered on the machine.'],
    say: ['A FIDO2 key or a passkey registered in advance is the only way through; do not add exclusions.', 'Windows Hello for Business needs the device joined and the PIN set up first.'],
  },
  device: {
    calls: ['Blocked on a home computer.', 'A Mac shows as not compliant.', 'A contractor cannot get in.'],
    say: ['Personal devices: use the browser with the session limits, or enrol the device in Intune.', 'Check compliance in Intune → Devices; a stale check-in is the usual cause.', 'Contractors: confirm they sit in the intended scope; a managed device or an approved app is required.'],
  },
  block: {
    calls: ['The scanner stopped emailing.', 'An old app cannot sign in.', 'A script broke overnight.'],
    say: ['Legacy protocols are blocked. Move the device to SMTP AUTH with OAuth, or to the service-accounts carve-out with a ticket.', 'Ask which app and which account; most need a modern-authentication update.', 'Scripts on device-code sign-in need a workload identity or a managed identity.'],
  },
  location: {
    calls: ['Travelling and cannot sign in.', 'The VPN makes the sign-in look like it comes from abroad.'],
    say: ['Travel: log the trip; a temporary named-location exception is the approved route, never a user exclusion.', 'VPN exits abroad: add the VPN egress to the trusted location.'],
  },
  guest: {
    calls: ['A partner cannot open the shared site.'],
    say: ['The guest registers MFA once for this tenant, or their home tenant MFA is trusted in cross-tenant settings.'],
  },
  session: {
    calls: ['Asked to sign in again more often than before.', 'The browser no longer stays signed in.'],
    say: ['Expected: the sign-in frequency and persistence limits are deliberate; on a managed device it should be rare.', 'If it happens every few minutes, check the device is compliant and the clock is right.'],
  },
}

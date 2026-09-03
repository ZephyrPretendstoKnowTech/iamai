// Copy for the validation rule set (docs/design/validation-rules.md).
//
// Every rule in src/validation/rules.ts names its check and why it matters
// here, so the reference page, the Setup findings and the plan's blocker steps
// all read the same sentences. Findings name the object and the fact that
// produced them, never a rule id.
import { count, list } from './statements.ts'

export const SEVERITY = {
  blocker: 'Must fix',
  warning: 'Recommended',
  note: 'Note',
} as const

export const SEVERITY_WHY = {
  blocker: 'The plan holds every step that can deny access until this is cleared.',
  warning: 'The plan runs; this is worth fixing before enforcement.',
  note: 'Recorded so the state is visible; nothing is asked for.',
} as const

export const SUBJECT = {
  breakGlass: 'Emergency access accounts',
  exclusionGroup: 'The exclusions group',
  trustedLocation: 'Trusted named location',
  allowedCountries: 'Allowed countries',
  pilotGroup: 'Pilot group',
  serviceAccount: 'Service accounts',
  authStrength: 'Authentication strength',
} as const

export const SUBJECT_PLAIN = {
  breakGlass: 'Sort out emergency access before anything else',
  exclusionGroup: 'Sort out the exclusions group',
  trustedLocation: 'Fix the trusted location before it is used',
  allowedCountries: 'Fix the allowed-countries list before it is used',
  pilotGroup: 'Fix the pilot group before the first ring',
  serviceAccount: 'Check the service accounts',
  authStrength: 'Fix the authentication strength before it is required',
} as const

/** Where a subject is fixed, when no individual check offered a path. */
export const SUBJECT_WHERE: Record<string, string> = {
  breakGlass: 'Entra admin center → Identity → Users',
  exclusionGroup: 'Entra admin center → Identity → Groups → this group → Members',
  trustedLocation: 'Entra admin center → Protection → Conditional Access → Named locations',
  allowedCountries: 'The allowed-countries decision on the plan, and Protection → Conditional Access → Named locations',
  pilotGroup: 'Entra admin center → Identity → Groups → this group → Members',
  serviceAccount: 'The service-accounts decision on the plan',
  authStrength: 'Entra admin center → Protection → Authentication methods → Authentication strengths',
}

/** What could not be read; an unknown on a blocker holds the plan the same way a failure does. */
export const NEED_LABEL: Record<string, string> = {
  users: 'the user list',
  roles: 'role assignments',
  authMethods: 'registered sign-in methods',
  caPolicies: 'Conditional Access policies',
  organization: 'the tenant domains',
  authMethodsPolicy: 'the authentication methods policy',
  namedLocations: 'named locations',
  authStrengths: 'authentication strengths',
  signInEvidence: 'sign-in records',
  devices: 'devices',
  groupMembers: 'group membership',
  answers: 'an answer given on the plan',
}

export const UNKNOWN = {
  needs: (labels: string[]): string => `could not be checked: ${list(labels)} could not be read on this scan`,
  /** The read succeeded; the answer was not in it (prompt 46 item 24). Never "could not be read". */
  readWithout: (label: string, field: string): string => `could not be checked: ${label} was read but reports no ${field}`,
  blocked: 'A check that cannot be run is treated as failed while it gates access.',
}

/**
 * Where each check comes from. A rule without a source is a rule nobody has
 * verified (audit-program §6), so `src/validation/rules.test.ts` fails the build
 * when one is missing. `FIELD_PRACTICE` is the honest alternative for the
 * checks that are real and that Microsoft does not document.
 */
export const FIELD_PRACTICE = 'field-practice' as const
export type Citation = { url: string; label: string } | typeof FIELD_PRACTICE

const EMERGENCY_ACCESS = { url: 'https://learn.microsoft.com/entra/identity/role-based-access-control/security-emergency-access', label: 'Microsoft: manage emergency access accounts' }
const GRANT_CONTROLS = { url: 'https://learn.microsoft.com/entra/identity/conditional-access/concept-conditional-access-grant', label: 'Microsoft: Conditional Access grant controls' }
const NETWORK = { url: 'https://learn.microsoft.com/entra/identity/conditional-access/concept-assignment-network', label: 'Microsoft: network assignment and named locations' }
const REPORT_ONLY = { url: 'https://learn.microsoft.com/entra/identity/conditional-access/concept-conditional-access-report-only', label: 'Microsoft: report-only mode' }
const MANAGED = { url: 'https://learn.microsoft.com/entra/identity/conditional-access/managed-policies', label: 'Microsoft: Microsoft-managed policies' }
const METHODS = { url: 'https://learn.microsoft.com/entra/identity/authentication/concept-authentication-methods', label: 'Microsoft: authentication methods' }
const METHODS_MANAGE = { url: 'https://learn.microsoft.com/entra/identity/authentication/how-to-authentication-methods-manage', label: 'Microsoft: manage authentication methods' }
const PER_USER_MFA = { url: 'https://learn.microsoft.com/entra/identity/authentication/howto-mfa-userstates', label: 'Microsoft: per-user MFA states' }
const BEST_PRACTICES = { url: 'https://learn.microsoft.com/entra/identity/role-based-access-control/best-practices', label: 'Microsoft: best practices for roles' }
const PLAN_CA = { url: 'https://learn.microsoft.com/entra/identity/conditional-access/plan-conditional-access', label: 'Microsoft: plan a Conditional Access deployment' }
const TAP = { url: 'https://learn.microsoft.com/entra/identity/authentication/howto-authentication-temporary-access-pass', label: 'Microsoft: Temporary Access Pass' }
const STRENGTHS = { url: 'https://learn.microsoft.com/entra/identity/authentication/concept-authentication-strengths', label: 'Microsoft: authentication strengths' }
const WORKLOAD = { url: 'https://learn.microsoft.com/entra/identity/conditional-access/workload-identity', label: 'Microsoft: Conditional Access for workload identities' }
const COUNTRY_BLOCK = { url: 'https://learn.microsoft.com/entra/identity/conditional-access/policy-block-by-location', label: 'Microsoft: block access by location' }

export const RULE_CITATION: Record<string, Citation> = {
  'bg.count': EMERGENCY_ACCESS,
  'bg.role.permanentGa': EMERGENCY_ACCESS,
  'bg.cloudOnly': EMERGENCY_ACCESS,
  'bg.initialDomain': EMERGENCY_ACCESS,
  'bg.enabled': EMERGENCY_ACCESS,
  'bg.excludedFromAllPolicies': EMERGENCY_ACCESS,
  'bg.excludedFromReportOnly': REPORT_ONLY,
  'bg.microsoftManaged': MANAGED,
  'bg.notInDynamicScope': EMERGENCY_ACCESS,
  'bg.hasMfaMethod': EMERGENCY_ACCESS,
  'bg.separateDevices': EMERGENCY_ACCESS,
  'bg.notPersonal': EMERGENCY_ACCESS,
  'bg.phishingResistant': EMERGENCY_ACCESS,
  'bg.methodDiversity': EMERGENCY_ACCESS,
  'bg.perUserMfaOff': PER_USER_MFA,
  'bg.noLicenceNeeded': EMERGENCY_ACCESS,
  'bg.drilled': EMERGENCY_ACCESS,
  'bg.credentialStorage': EMERGENCY_ACCESS,
  'bg.signInMonitoring': EMERGENCY_ACCESS,
  'bg.nameIdentifiesPurpose': FIELD_PRACTICE,
  'bg.lastSignIn': EMERGENCY_ACCESS,
  'bg.signInCountries': FIELD_PRACTICE,
  'bg.mfaSeen': EMERGENCY_ACCESS,
  'xg.membersApproved': PLAN_CA,
  'xg.noExtraAdmins': PLAN_CA,
  'xg.notDynamic': FIELD_PRACTICE,
  'xg.usedConsistently': PLAN_CA,
  'xg.sizeReasonable': FIELD_PRACTICE,
  'xg.notMailEnabled': FIELD_PRACTICE,
  'loc.notWholeInternet': NETWORK,
  'loc.notTooWide': NETWORK,
  'loc.isTrusted': NETWORK,
  'loc.redundancy': FIELD_PRACTICE,
  'loc.seenInSignIns': NETWORK,
  'cty.atLeastOne': COUNTRY_BLOCK,
  'cty.includesOperator': COUNTRY_BLOCK,
  'cty.unknownCountries': NETWORK,
  'cty.seenCountriesIncluded': NETWORK,
  'pilot.hasMembers': FIELD_PRACTICE,
  'pilot.noBreakGlass': EMERGENCY_ACCESS,
  'pilot.spread': FIELD_PRACTICE,
  'pilot.hasAdmin': FIELD_PRACTICE,
  'pilot.membersReady': FIELD_PRACTICE,
  'pilot.passkeyEnabled': METHODS,
  'pilot.tapEnabled': TAP,
  'svc.noInteractive': WORKLOAD,
  'svc.noAdminRole': BEST_PRACTICES,
  'svc.excludedFromBlocks': WORKLOAD,
  'str.exists': STRENGTHS,
  'str.achievable': STRENGTHS,
  'str.matchesBaseline': METHODS_MANAGE,
}

export const CITATION = {
  fieldPractice: 'Seen in the field; Microsoft does not document this one.',
  fieldPracticeShort: 'Field practice',
  source: 'Source',
}

/** One line per rule for the reference page and the plan's checklist. */
export const RULE_TEXT: Record<string, { what: string; why: string }> = {
  // ---- break-glass, blockers ----
  'bg.count': {
    what: 'At least two emergency access accounts are nominated.',
    why: 'One account is a single point of failure: a lost key or a forgotten passphrase leaves nobody able to get back in.',
  },
  'bg.role.permanentGa': {
    what: 'Global Administrator is assigned permanently and active, never eligible-only.',
    why: 'An eligible-only account has to activate its role first, and activation is one of the things a bad policy can block.',
  },
  'bg.cloudOnly': {
    what: 'The account is cloud-only, with no on-premises sync.',
    why: 'A synced account depends on the directory synchronisation and the domain controller behind it, which are among the things being recovered from.',
  },
  'bg.initialDomain': {
    what: "The sign-in address is on the tenant's own onmicrosoft.com domain.",
    why: 'A custom domain depends on public DNS and, when federated, on another identity provider; both can be part of the outage.',
  },
  'bg.enabled': {
    what: 'The account is enabled.',
    why: 'An account disabled for safety is not an escape hatch when it is needed.',
  },
  'bg.excludedFromAllPolicies': {
    what: 'The account is excluded from every enabled and report-only Conditional Access policy, Microsoft-managed ones included.',
    why: 'The account exists to survive a policy that goes wrong; a policy it is inside can lock it out with everyone else.',
  },
  'bg.notInDynamicScope': {
    what: 'No dynamic group rule brings the account into policy scope.',
    why: 'A dynamic rule re-evaluates on its own, so an account outside a policy today can be inside it tomorrow with nobody changing anything.',
  },
  'bg.hasMfaMethod': {
    what: 'At least one method that can satisfy MFA is registered.',
    why: 'Without one, the account cannot sign in under any modern requirement, including the ones this plan adds.',
  },
  'bg.separateDevices': {
    what: 'No two emergency accounts share an Authenticator device, and none shares one with a daily-use account.',
    why: 'One lost or wiped phone must not take out the whole escape hatch.',
  },
  'bg.notPersonal': {
    what: "The account is not somebody's day-to-day account: no department, no job title, no office, not the signed-in operator.",
    why: 'A person leaves, is compromised, or is on a plane. The emergency account has to belong to the organisation rather than to somebody.',
  },
  // ---- break-glass, warnings ----
  'bg.excludedFromReportOnly': {
    what: 'The account is also excluded from the report-only policies.',
    why: 'A report-only policy denies nothing today, so Microsoft does not require the exclusion. It becomes required the moment somebody turns the policy on, which is usually the moment nobody is thinking about it.',
  },
  'bg.microsoftManaged': {
    what: 'The account is excluded from the policies Microsoft manages.',
    why: 'Microsoft creates these in report-only and turns them on itself, no less than thirty days later and sometimes sooner. A policy nobody in the organisation created can catch the emergency account.',
  },
  'bg.phishingResistant': {
    what: 'At least one phishing-resistant method (a security key, a passkey or Windows Hello for Business) is registered.',
    why: 'Text and call codes are taken by a swapped SIM or a convincing phone call, which is a poor last line of defence.',
  },
  'bg.methodDiversity': {
    what: 'The emergency accounts do not all depend on the same single kind of method.',
    why: 'One failing method type then takes out every emergency account at once.',
  },
  'bg.perUserMfaOff': {
    what: 'The tenant has finished migrating to the authentication methods policy.',
    why: 'Microsoft says not to enable or enforce per-user MFA when Conditional Access is in use: the legacy setting prompts on its own terms and can block the recovery sign-in Conditional Access would have allowed.',
  },
  'bg.noLicenceNeeded': {
    what: 'No licence is assigned unless something needs one, and no mailbox is in daily use.',
    why: 'A mailbox on an emergency account is somewhere to phish and somewhere for mail to sit unread.',
  },
  'bg.drilled': {
    what: 'The account has signed in within the last 90 days.',
    why: 'A passphrase nobody has used in a year is found to be wrong at the worst moment.',
  },
  'bg.credentialStorage': {
    what: 'Where the credential is kept, and who can reach it, is recorded in the plan.',
    why: 'An emergency account whose passphrase lives only in one head or one laptop is not available in an emergency.',
  },
  'bg.signInMonitoring': {
    what: 'A sign-in by an emergency account raises an alert.',
    why: 'These accounts should sign in almost never, so a sign-in is either a drill or an incident, and both are worth knowing about.',
  },
  'bg.nameIdentifiesPurpose': {
    what: 'The display name makes the purpose obvious to whoever finds it next.',
    why: 'An unexplained Global Administrator is deleted in a tidy-up, or left alone when it should have been questioned.',
  },
  // ---- break-glass, notes ----
  'bg.lastSignIn': { what: 'When the account last signed in.', why: 'Recorded so the drill history is visible without opening the portal.' },
  'bg.signInCountries': { what: 'Countries the account has signed in from in the evidence window.', why: 'An emergency account signing in from an unexpected country is worth a question.' },
  'bg.mfaSeen': { what: 'Whether the account has completed MFA in the evidence window.', why: 'A registered method that has never been used is a method nobody has proved works.' },
  // ---- exclusions group ----
  'xg.membersApproved': {
    what: 'Every member is an emergency access account or an approved exclusion.',
    why: 'Anyone inside the group is outside every policy the group is excluded from, which is the whole protection removed.',
  },
  'xg.noExtraAdmins': {
    what: 'No member holds an active admin role beyond the emergency accounts.',
    why: 'An administrator excluded from every policy is the most valuable unprotected account in the tenant.',
  },
  'xg.notDynamic': {
    what: 'The group is not dynamic.',
    why: 'A rule that adds members adds exclusions, without anybody deciding to.',
  },
  'xg.usedConsistently': {
    what: 'The group is excluded from every enabled or report-only policy.',
    why: 'A group excluded from some policies and not others protects nobody reliably and hides which is which.',
  },
  'xg.sizeReasonable': {
    what: 'The group holds no more members than there are emergency accounts.',
    why: 'Each extra member is another account every policy will not apply to.',
  },
  'xg.notMailEnabled': {
    what: 'The group is not mail-enabled and carries no licence.',
    why: 'A mail-enabled exclusions group is a target that also delivers mail.',
  },
  // ---- trusted named location ----
  'loc.notWholeInternet': { what: 'No range covers the whole internet.', why: 'A location that trusts everything makes every policy that relaxes inside it unconditional.' },
  'loc.notTooWide': { what: 'No range is wider than a /16 unless it was confirmed.', why: 'A wide range quietly includes networks nobody meant to trust.' },
  'loc.isTrusted': { what: 'The location is marked as trusted.', why: 'Policies that relax inside a trusted location do nothing until the flag is set.' },
  'loc.redundancy': { what: 'More than a single address.', why: 'One address means one broken link takes the office out of its own trusted location.' },
  'loc.seenInSignIns': { what: 'The ranges appear in the sign-in records.', why: 'A range nobody has signed in from is usually an old office nobody removed.' },
  // ---- allowed countries ----
  'cty.atLeastOne': { what: 'At least one country is allowed.', why: 'An empty list blocks everyone, everywhere, including the person who set it.' },
  'cty.includesOperator': {
    what: "The countries the signed-in operator has recently signed in from are included.",
    why: 'The first person locked out by a country policy is usually the person who wrote it.',
  },
  'cty.unknownCountries': { what: 'Sign-ins from unknown countries are not silently allowed.', why: 'Addresses that resolve to no country then pass a policy meant to name every country it allows.' },
  'cty.seenCountriesIncluded': { what: 'Countries with sign-in history are either allowed or deliberately left out.', why: 'A country people actually work from, left off the list, is a lockout on the first day.' },
  // ---- pilot group ----
  'pilot.hasMembers': { what: 'The pilot group has at least one member.', why: 'An empty first group proves nothing and delays every group behind it.' },
  'pilot.noBreakGlass': { what: 'No emergency access account is in the pilot.', why: 'The escape hatch must never be inside the group a change is being tested on.' },
  'pilot.spread': { what: 'Members come from more than one department.', why: 'One department shares one set of applications, so a single-department pilot proves less than it looks.' },
  'pilot.hasAdmin': { what: 'At least one administrator is in the pilot.', why: 'Admin sign-ins hit paths ordinary accounts never reach.' },
  'pilot.membersReady': { what: 'Every member has proved MFA.', why: 'A pilot member who cannot sign in becomes a help-desk call rather than a result.' },
  'pilot.passkeyEnabled': {
    what: 'Passkeys and security keys are enabled in the authentication methods policy and pointed at the pilot group.',
    why: 'A pilot that cannot register the method it is piloting proves nothing.',
  },
  'pilot.tapEnabled': {
    what: 'Temporary Access Pass is enabled and pointed at the pilot group.',
    why: 'Without it, a person with no method yet has no way to register their first one.',
  },
  // ---- service accounts ----
  'svc.noInteractive': { what: 'No confirmed service account has an interactive sign-in in the window.', why: 'An interactive sign-in means a person is using it, so treating it as unattended is wrong.' },
  'svc.noAdminRole': { what: 'No confirmed service account holds an admin role.', why: 'An unattended account with an admin role is a password with tenant-wide reach.' },
  'svc.excludedFromBlocks': { what: 'Every service account a block step would catch has an exclusion.', why: 'The step that blocks legacy sign-in is the step that stops the scanner.' },
  // ---- authentication strength ----
  'str.exists': { what: 'The strength the baseline names exists in the tenant.', why: 'A policy referring to a strength that is not there cannot be created.' },
  'str.achievable': { what: 'Somebody in the target population has registered a method the strength accepts.', why: 'A strength nobody can satisfy is a lockout with a policy around it.' },
  'str.matchesBaseline': { what: 'The combinations match the ones the baseline expects.', why: 'A strength that allows more than the baseline intends quietly weakens the policy.' },
}

/** The findings themselves: the object, then the fact. */
export const FINDING = {
  bgCount: (n: number): string =>
    n === 0 ? 'no emergency access account is nominated' : `only ${count(n, 'emergency access account')} is nominated: two are needed`,
  bgCountOk: (n: number): string => `${count(n, 'emergency access account')} nominated`,
  bgEligibleOnly: 'Global Administrator is eligible-only: the role has to be activated before it can be used',
  bgNoGa: 'not a Global Administrator',
  bgSynced: 'not cloud-only: the account syncs from on-premises',
  bgCustomDomain: (upn: string, initial: string): string => `signs in as ${upn}, not on the tenant's own ${initial} domain`,
  bgNoInitialDomain: "the tenant's own onmicrosoft.com domain could not be found in the organisation record",
  bgDisabled: 'the account is disabled',
  bgNotExcluded: (policies: string[]): string => `not excluded from ${list(policies)}`,
  bgExclusionUnverified: (policies: string[]): string => `exclusion could not be verified for ${list(policies)}: the excluded groups were not read`,
  bgNotExcludedReportOnly: (policies: string[]): string =>
    `not excluded from ${list(policies)}, which run in report-only today and deny nothing until somebody turns them on`,
  bgManagedMissing: (policies: string[]): string =>
    `not excluded from ${list(policies)}, which Microsoft manages and will turn on itself`,
  bgManagedExcluded: (n: number): string => `excluded from the ${count(n, 'policy', 'policies')} Microsoft manages in this tenant`,
  bgNoMfaMethod: 'no method that can satisfy MFA is registered',
  bgSharedDevice: (device: string, who: string[]): string =>
    `the Authenticator device "${device}" is also registered by ${list(who)}: the same device name usually means the same phone`,
  bgDynamic: (group: string, rule: string): string => `swept into the dynamic group ${group} by its rule (${rule})`,
  bgPersonal: (facts: string[]): string => `looks like a person's own account: ${list(facts)}`,
  bgPersonalOperator: 'this is the account signed in to IAMAI right now',
  bgSmsOnly: 'a code by text or call is the only method registered',
  bgNoPhishingResistant: 'no phishing-resistant method registered: a security key or passkey is the stronger choice',
  bgSameMethodType: (kind: string): string => `every emergency account relies on ${kind} alone`,
  bgPerUserMfa: 'the tenant has not finished migrating to the authentication methods policy, so the legacy per-user settings still decide which methods are offered',
  bgLicensed: (plans: number): string => `${count(plans, 'licence plan')} assigned, including a mailbox`,
  bgDrillDue: (date: string, days: number): string => `last signed in ${date}, over ${days} days ago: a drill is due`,
  bgNeverSignedIn: 'has never signed in: nobody knows whether the credential works',
  bgDrilled: (date: string, days: number): string => `signed in ${date}, inside the ${days} day drill window`,
  bgCredentialStorage: 'where the credential is kept has not been recorded',
  bgSignInMonitoring: 'nothing alerts when an emergency account signs in',
  bgName: (name: string): string => `the name "${name}" does not say what the account is for`,
  bgLastSignIn: (date: string): string => `last signed in ${date}`,
  bgLastSignInDrill: (date: string): string => `signed in ${date}, a recorded drill`,
  bgLastSignInUnrecorded: (date: string): string => `signed in ${date}, not a recorded drill: confirm who signed in and why`,
  bgNeverSeen: 'no sign-in for this account in the evidence window',
  bgCountries: (countries: string[]): string => `signed in from ${list(countries)} in the evidence window`,
  bgMfaSeen: 'has completed MFA in the evidence window',
  bgMfaNotSeen: 'has not completed MFA in the evidence window: the registered method is unproven',

  xgUnapproved: (names: string[]): string => `${list(names)} ${names.length === 1 ? 'is' : 'are'} in the group without being an emergency account or an approved exclusion`,
  xgAdmins: (names: string[]): string => `${list(names)} hold admin roles: exclusion removes their protection`,
  xgDynamic: (rule: string): string => `dynamic membership rule (${rule}): membership can change without anybody reviewing it`,
  xgInconsistent: (from: number, total: number): string => `excluded from ${from} of ${total} enabled or report-only policies`,
  xgSize: (members: number, breakGlass: number): string => `${count(members, 'member')} for ${count(breakGlass, 'emergency access account')}`,
  xgMailEnabled: 'the group is mail-enabled',
  xgMembers: (n: number, sampled: boolean): string => `${count(n, 'member')}${sampled ? ', estimated' : ''}`,

  locWholeInternet: (cidr: string): string => `${cidr} trusts the entire internet`,
  locTooWide: (cidr: string): string => `${cidr} is wider than a /16`,
  locNotTrusted: 'not marked as trusted',
  locSingle: (cidr: string): string => `${cidr} is the only address in the location`,
  locUnseen: (cidrs: string[]): string => `no sign-in in the window came from ${list(cidrs)}`,

  ctyNone: 'no country is allowed, which blocks everyone',
  ctyMissingOperator: (countries: string[]): string => `the signed-in operator has signed in from ${list(countries)}, which the list leaves out`,
  ctyUnknown: 'sign-ins from unknown countries are allowed',
  ctySeenMissing: (countries: string[]): string => `people signed in from ${list(countries)} in the window, and the list leaves them out`,

  pilotEmpty: 'the pilot group has no members',
  pilotBreakGlass: (names: string[]): string => `${list(names)} ${names.length === 1 ? 'is an emergency access account' : 'are emergency access accounts'}`,
  pilotOneDepartment: (dept: string): string => `every member is in ${dept}`,
  pilotNoAdmin: 'no administrator is in the pilot',
  pilotMethodOff: (method: string): string => `${method} is not enabled in the authentication methods policy`,
  pilotMethodUntargeted: (method: string): string => `${method} is enabled but not pointed at this group`,
  pilotNotReady: (names: string[]): string => `${list(names)} ${names.length === 1 ? 'has' : 'have'} not proved MFA`,

  svcInteractive: (names: string[]): string => `${list(names)} signed in interactively in the window`,
  svcAdmin: (names: string[]): string => `${list(names)} hold admin roles`,
  svcUnexcluded: (names: string[]): string => `${list(names)} would be caught by a block step with no exclusion`,

  strMissing: 'the strength the baseline names is not in the tenant',
  strUnachievable: (combos: string[]): string => `nobody in scope has registered a method matching ${list(combos)}`,
  strExtra: (combos: string[]): string => `allows combinations the baseline does not: ${list(combos)}`,
  strMissingCombos: (combos: string[]): string => `missing combinations the baseline allows: ${list(combos)}`,
  strMatches: 'identical to the baseline strength',
  strNoBaselineCombos: 'the baseline strength ships without its combinations, so the two cannot be compared',
}

/** The checks reference page. */
export const CHECKS_PAGE = {
  title: 'Every check IAMAI runs',
  intro: 'Every check IAMAI runs, generated from the rules the code runs from.',
  // The total comes first (prompt 37 §13). The headline used to give the
  // severity split and the sections below gave the subject split, with nothing
  // saying they were two cuts of one set — so the numbers looked like they
  // failed to reconcile when they always added up (T17). Made worse by the
  // first section happening to hold exactly as many checks as there are
  // must-fix ones, which invites the reader to match them up.
  counts: (blockers: number, warnings: number, notes: number): string =>
    `${count(blockers + warnings + notes, 'check')} in all: ${count(blockers, 'must-fix check')}, ${count(warnings, 'recommended check')} and ${count(notes, 'note')}.`,
  /** Said above the tables, so the second breakdown is not read as an expansion of the first. */
  bySubject: (subjects: number): string =>
    `The same checks again, grouped by what they look at (${subjects} groups). Every check appears in exactly one group.`,
  sectionCount: (blockers: number, warnings: number, notes: number): string =>
    [blockers > 0 ? `${blockers} must-fix` : null, warnings > 0 ? `${warnings} recommended` : null, notes > 0 ? `${notes} ${notes === 1 ? 'note' : 'notes'}` : null].filter(Boolean).join(', '),
  columns: { id: 'Check', what: 'What it looks for', severity: 'If it fails', why: 'Why it matters', needs: 'Needs' },
  needsNone: 'the answer given on the plan',
  unknownRule: 'A check whose data is missing reports that it could not be run. On a must-fix check, that holds the plan exactly as a failure does.',
  // C17: this defined "Field practice" before the label had appeared. It is
  // defined on the label itself now, where a reader meets it.
  sources: 'Every check names its source.',
  next: 'Next: the plan',
  empty: 'The registry is empty.',
}

/** The Phase 0 step a blocking subject generates. */
export const BLOCKER_STEP = {
  title: (subject: string): string => subject,
  why: (subject: string, n: number): string =>
    `${subject} has ${count(n, 'must-fix check')} outstanding. Every step that can deny access is held until they are cleared, because these are what a mistake is recovered through.`,
  impact: (n: number, held: number): string =>
    held === 0
      ? `${count(n, 'must-fix check')} to clear. Nothing in the plan is held by them yet.`
      : `${count(n, 'must-fix check')} to clear. ${count(held, 'step')} that can deny access ${held === 1 ? 'is' : 'are'} held until then.`,
  whatChanges: 'Nothing changes for anyone. This is groundwork so a mistake later can be undone.',
  nothingToUndo: 'Nothing to undo.',
  forManager: (subject: string): string =>
    `${subject} is the way back in when a security change goes wrong. The cost is an hour of admin time and no disruption to anyone. Without it, a mistake in a later step can lock the organisation out of its own tenant, which is a support case with Microsoft rather than a five-minute fix.`,
  exit: (n: number): string => (n === 1 ? 'The must-fix check passes on the next scan.' : `All ${n} must-fix checks pass on the next scan.`),
  checklistLead: 'Each of these has to pass:',
  recommended: 'Worth fixing too, though nothing waits on them:',
  alsoRecommended: (n: number, first: string): string =>
    `${count(n, 'recommended fix', 'recommended fixes')} on these accounts, starting with: ${first}.`,
}

/**
 * A check step's Do it (prompt 48.1 item 9): each failing must-fix check as one
 * imperative action, in the order to do them, with its portal path. Named
 * specifics (which policies, which shared device) come from the finding.
 * Could-not-run checks and the two attestations never appear here.
 */
export const RULE_ACTION: Record<string, (finding: string | null) => string> = {
  'bg.count': () => 'Create a second emergency access account. Entra admin center → Users → New user: cloud-only, on the onmicrosoft.com domain, no licence, Global Administrator assigned permanently.',
  'bg.cloudOnly': () => 'Replace the synced account with a cloud-only one. Entra admin center → Users → New user, no on-premises sync.',
  'bg.initialDomain': () => 'Give the account a sign-in address on the tenant onmicrosoft.com domain. Entra admin center → Users → the account.',
  'bg.enabled': () => 'Enable the emergency account. Entra admin center → Users → the account → Account status.',
  'bg.role.permanentGa': () => 'Assign Global Administrator to each account permanently, never eligible-only. Entra admin center → Roles and administrators → Global Administrator.',
  'bg.hasMfaMethod': () => 'Register a passkey or FIDO2 security key for each account. Entra admin center → Users → the account → Authentication methods.',
  'bg.phishingResistant': () => 'Register a passkey or FIDO2 security key for each account. Entra admin center → Users → the account → Authentication methods.',
  'bg.excludedFromAllPolicies': (finding) =>
    `Exclude both accounts from every Conditional Access policy${policiesFrom(finding)}. Entra admin center → Protection → Conditional Access → Policies.`,
  'bg.notPersonal': () => 'Use a dedicated account for emergency access, with no department, job title or office, and not the operator. Entra admin center → Users → New user.',
  'bg.separateDevices': (finding) => `Move an emergency account off the shared Authenticator device${deviceFrom(finding)}. Entra admin center → Users → the account → Authentication methods.`,
  'bg.notInDynamicScope': () => 'Move the account out of any dynamic group that a policy targets, or exclude the account directly. Entra admin center → Groups.',
}

/** Rules that are attestations, not actions: they become Done-when lines the operator ticks (prompt 48.1 item 9). */
export const ATTESTATION_RULES: ReadonlySet<string> = new Set(['bg.credentialStorage', 'bg.signInMonitoring'])
export const ATTESTATION_DONE_WHEN: Record<string, string> = {
  'bg.credentialStorage': 'The passphrase for each emergency account is written down where the admins can reach it without signing in.',
  'bg.signInMonitoring': 'A sign-in by an emergency account raises an alert somebody sees.',
}
/** Migration state and other could-not-run checks are Housekeeping only, never an action (prompt 48.1 item 9). */
export const HOUSEKEEPING_ONLY_RULES: ReadonlySet<string> = new Set(['bg.perUserMfaOff', 'bg.perUserMfa'])

function policiesFrom(finding: string | null): string {
  const m = finding ? /not excluded from (.+?)(?:, which|:|$)/.exec(finding) : null
  return m ? `: ${m[1]}` : ''
}
function deviceFrom(finding: string | null): string {
  const m = finding ? /device "([^"]+)"/.exec(finding) : null
  return m ? ` "${m[1]}"` : ''
}

/** The imperative for a rule with no specific action: from its check, plus the portal path. */
export function fallbackAction(what: string, portal: string | null): string {
  const body = what.replace(/.$/, '')
  const lead = /^(At least|No |Every |The account is|The account holds|Each |The sign-in)/.test(body) ? `Make sure ${body.charAt(0).toLowerCase()}${body.slice(1)}` : body
  return portal ? `${lead}. ${portal}.` : `${lead}.`
}

/** The Plan footer's housekeeping lines that come from validation (prompt 46 item 21). */
export const HOUSEKEEPING = {
  checksNotRun: (n: number, reads: string[]): string =>
    reads.length === 0 ? `${count(n, 'check')} could not run.` : `${count(n, 'check')} could not run: ${list(reads)}.`,
}

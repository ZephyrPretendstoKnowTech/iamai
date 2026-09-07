// The permissions disclosure (prompt 34 §1): what the consent screen will ask
// for, in plain words, and how to take it all back.
//
// The rows are generated from what the code actually requests
// (`GRAPH_SCOPES`) crossed with what each scope is used for
// (`COLLECTOR_REGISTRY`), so the disclosure cannot drift from the consent
// screen. `src/ui/permissions.test.ts` fails the build if a scope is requested
// with no explanation here, or explained without being requested.

export const PERMISSIONS = {
  title: 'What IAMAI will ask for, and how to remove it',
  intro:
    'Microsoft shows this list on its own consent screen. It is here in plain words so it can be read first.',
  readOnly:
    // The evidence for the read-only claim made once on Connect, not a fourth
    // restatement of it (review-07 R20, prompt 40 §23).
    'No write permission is in the set below.',
  consentCreates:
    'Granting consent creates one thing in the tenant: an enterprise application named IAMAI, which records that the permissions were granted. Nothing else is created, and no data is copied anywhere.',
  removalTitle: 'Removing it',
  removal: [
    'Entra admin center → Entra ID → Enterprise applications.',
    'Find IAMAI in the list.',
    'Properties → Delete.',
  ],
  removalNote:
    'That removes every permission immediately and leaves nothing behind. Anything IAMAI held was in the browser, and Forget this tenant clears that separately.',
  columns: { permission: 'Permission', reads: 'What IAMAI reads', without: 'Without it' },
  usedFor: (names: string[]): string => `Used for: ${names.join(', ')}.`,
  unusedGroup: 'Requested, not yet used',
  // Rendered only if a requested scope has no collector behind it; none does
  // since Application.Read.All was removed (prompt 46 item 23).
  unusedNote: ['This permission is on the consent screen and nothing in IAMAI calls it.', 'The recommendation is to remove it.'],
  unusedLink: 'The full reasoning',
  notUsedYet: 'Not used by anything IAMAI runs today.',
  fullList: 'Every endpoint, in full →',
  signInGroup: 'Sign in, and stay signed in',
}

/**
 * One scope, explained twice: `reads`/`without` for How's table, and — for a
 * tenant scope — the way Microsoft's own consent screen names it (`consentName`)
 * with the short reading Connect shows beside it (`consentReads`).
 *
 * Connect's signed-out disclosure is generated from these fields rather than
 * from a list of its own (task 016): the consent screen, How's table and
 * Connect's rows all resolve to `GRAPH_SCOPES` crossed with this record, so
 * there is one permission truth and no copy that can quietly widen it.
 */
export type ScopeCopy = { reads: string; without: string; consentName?: string; consentReads?: string }

/** One entry per scope in `GRAPH_SCOPES`. */
export const SCOPE_COPY: Record<string, ScopeCopy> = {
  'Policy.Read.All': {
    reads: 'Conditional Access policies, named locations, authentication strengths, the authentication methods policy, security defaults and the cross-tenant access settings.',
    without: 'Nothing can be compared against the baseline, so there is no plan at all.',
    consentName: "Read your organization's policies",
    consentReads: 'Conditional Access policies, named locations, strengths, cross-tenant settings',
  },
  'Directory.Read.All': {
    reads: 'People, groups and their members, devices, the licences the tenant holds, the organisation name and the signed-in account.',
    without: 'No names, no counts and no populations: every step would be about nobody in particular.',
    consentName: "Read all users' basic profiles / Read directory data",
    consentReads: "People, groups, devices, licences, the tenant's name",
  },
  'AuditLog.Read.All': {
    reads: 'Interactive sign-in records for the last 30 days, and the report of which sign-in methods each person has registered.',
    without: 'No predicted impact and no verification. Steps could still be listed, and none of them could be backed by evidence.',
    consentName: 'Read audit log data',
    consentReads: 'Sign-in records for the last 30 days',
  },
  'RoleManagement.Read.Directory': {
    reads: 'Which accounts hold which directory roles, and which roles are assigned through Privileged Identity Management rather than permanently.',
    without: 'IAMAI cannot tell who administers the tenant, so the admin steps and the emergency-access checks have nothing to work from.',
    consentName: "Read role management data for your company's directory",
    consentReads: 'Who holds which role, and which through PIM',
  },
  'UserAuthenticationMethod.Read.All': {
    reads: 'Which kinds of sign-in method each account has registered. Never the values: no phone numbers, no codes, no keys.',
    without: 'The emergency-access checks lose the method and shared-device tests, and readiness falls back to the registration report alone.',
    consentName: "Read all users' authentication methods",
    consentReads: 'Which kinds of sign-in method each account has, never the values',
  },
  'Reports.Read.All': {
    reads: 'Aggregated per-application sign-in counts, and when each application identity last signed in.',
    without: 'Advice about which applications a policy should be scoped to loses its evidence.',
    consentName: 'Read all usage reports',
    consentReads: 'App sign-in counts, and when each application identity last signed in',
  },
  openid: { reads: 'That the sign-in happened, and who signed in.', without: 'Signing in at all.' },
  profile: { reads: 'The signed-in name and sign-in address, to show whose session it is.', without: 'The header could not say who is signed in.' },
  offline_access: {
    reads: 'Nothing on its own. It lets the browser refresh the session so a long scan does not stop halfway.',
    without: 'A scan longer than about an hour would stop and ask for a fresh sign-in.',
  },
}

/** Scopes that are about signing in rather than about tenant data. */
export const SIGN_IN_SCOPES = ['openid', 'profile', 'offline_access']

/**
 * The order Microsoft's consent screen puts the tenant permissions in, which is
 * not the order the app requests them in. Connect says "the consent screen will
 * list these six, in this order", so the order is a fact about the screen and is
 * written down once here; permissions.test.ts holds it to exactly the tenant
 * scopes in `GRAPH_SCOPES`, so a scope can never be added or dropped on one side
 * alone.
 */
export const CONSENT_SCREEN_ORDER = [
  'Directory.Read.All',
  'Policy.Read.All',
  'AuditLog.Read.All',
  'RoleManagement.Read.Directory',
  'UserAuthenticationMethod.Read.All',
  'Reports.Read.All',
]

/** One row per tenant scope on Microsoft's consent screen, in its order, from `SCOPE_COPY`. */
export type ConsentRow = { scope: string; name: string; reads: string }
export function consentRows(): ConsentRow[] {
  return CONSENT_SCREEN_ORDER.map((scope) => {
    const copy = SCOPE_COPY[scope]
    return { scope, name: copy?.consentName ?? '', reads: copy?.consentReads ?? '' }
  })
}

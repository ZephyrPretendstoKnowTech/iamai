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
    'There is no write permission in the set, so nothing in the tenant can be created, changed or deleted through IAMAI.',
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
  columns: { permission: 'Permission', reads: 'What it lets IAMAI read', without: 'Without it' },
  usedFor: (names: string[]): string => `Used for: ${names.join(', ')}.`,
  unusedGroup: 'Requested, not yet used',
  unusedNote: [
    'This permission is on the consent screen and nothing in IAMAI calls it.',
    'It was consented for a service-principal inventory that has not been built.',
    'That inventory turns out not to need it: Microsoft documents Directory.Read.All, which IAMAI already requests, as sufficient.',
    'The recommendation is to remove it.',
  ],
  unusedLink: 'The full reasoning',
  notUsedYet: 'Not used by anything IAMAI runs today.',
  fullList: 'Every endpoint, in full →',
  signInGroup: 'Sign in, and stay signed in',
}

export type ScopeCopy = { reads: string; without: string }

/** One entry per scope in `GRAPH_SCOPES`. */
export const SCOPE_COPY: Record<string, ScopeCopy> = {
  'Policy.Read.All': {
    reads: 'Conditional Access policies, named locations, authentication strengths, the authentication methods policy, security defaults and the cross-tenant access settings.',
    without: 'Nothing can be compared against the baseline, so there is no plan at all.',
  },
  'Directory.Read.All': {
    reads: 'People, groups and their members, devices, the licences the tenant holds, the organisation name and the signed-in account.',
    without: 'No names, no counts and no populations: every step would be about nobody in particular.',
  },
  'AuditLog.Read.All': {
    reads: 'Interactive sign-in records for the last 30 days, and the report of which sign-in methods each person has registered.',
    without: 'No predicted impact and no verification. Steps could still be listed, and none of them could be backed by evidence.',
  },
  'RoleManagement.Read.Directory': {
    reads: 'Which accounts hold which directory roles, and which roles are assigned through Privileged Identity Management rather than permanently.',
    without: 'IAMAI cannot tell who administers the tenant, so the admin steps and the emergency-access checks have nothing to work from.',
  },
  'UserAuthenticationMethod.Read.All': {
    reads: 'Which kinds of sign-in method each account has registered. Never the values: no phone numbers, no codes, no keys.',
    without: 'The emergency-access checks lose the method and shared-device tests, and readiness falls back to the registration report alone.',
  },
  'Reports.Read.All': {
    reads: 'Aggregated per-application sign-in counts, and when each application identity last signed in.',
    without: 'Advice about which applications a policy should be scoped to loses its evidence.',
  },
  'Application.Read.All': {
    reads: 'Application and service principal registrations.',
    without: 'Nothing. No part of IAMAI calls anything that needs it.',
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

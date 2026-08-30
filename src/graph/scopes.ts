// The delegated scope set, as data (SPEC.md §4).
//
// Kept out of msal.ts because that module builds a PublicClientApplication at
// import time and so touches `window`. The permissions disclosure and its test
// need the list without a browser, and the project rule is that pure data runs
// in Node (CLAUDE.md, Conventions).
//
// Requested once at sign-in: one consent screen, the full set, no staged
// consent. Every entry is a read scope; there is no write scope in the app.
export const GRAPH_SCOPES = [
  'Policy.Read.All',
  'Directory.Read.All',
  'Application.Read.All',
  'AuditLog.Read.All',
  'RoleManagement.Read.Directory',
  'UserAuthenticationMethod.Read.All',
  'Reports.Read.All',
  'openid',
  'profile',
  'offline_access',
]

// The delegated scope set, as data (SPEC.md §4).
//
// Kept out of msal.ts because that module builds a PublicClientApplication at
// import time and so touches `window`. The permissions disclosure and its test
// need the list without a browser, and the project rule is that pure data runs
// in Node (CLAUDE.md, Conventions).
//
// Requested once at sign-in: one consent screen, the full set, no staged
// consent. Every entry is a read scope; there is no write scope in the app.
// Application.Read.All was removed on 2026-08-30 (prompt 46 item 23): nothing
// called it, and the service-principal inventory it was consented for lands
// under Directory.Read.All (docs/design/application-read-decision.md).
export const GRAPH_SCOPES = [
  'Policy.Read.All',
  'Directory.Read.All',
  'AuditLog.Read.All',
  'RoleManagement.Read.Directory',
  'UserAuthenticationMethod.Read.All',
  'Reports.Read.All',
  'openid',
  'profile',
  'offline_access',
]

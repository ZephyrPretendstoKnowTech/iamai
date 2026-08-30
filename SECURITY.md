# Security

IAMAI is a static web app that reads a Microsoft Entra tenant and writes a rollout plan.
This file states what it does with data, what it never does, and how to report a problem.

## What the app reads

Everything IAMAI requests from Microsoft Graph is listed on the "What IAMAI reads" page
inside the app, generated from the same registry the code runs from
(`src/graph/collect/registry.ts`). In summary: Conditional Access policies, named
locations, authentication strengths and the authentication methods policy; users, devices,
group memberships, role assignments and subscribed licences; per-user registered method
types (never phone numbers or secrets); and interactive sign-in records for the last 30
days. Every permission is a delegated **read** scope, requested once at sign-in
(`src/graph/msal.ts`, `GRAPH_SCOPES`). There is no write scope anywhere in the app, and a
test (`src/network.test.ts`) fails the build if any source file addresses a network host
other than `graph.microsoft.com`, `login.microsoftonline.com` and
`raw.githubusercontent.com` (the pinned baseline files).

## What consent asks for, and how to remove it

The app requests one set of delegated **read** scopes at sign-in, on a single
consent screen. There is no write scope in the set, and no staged consent. In
plain words:

| Permission | What it lets IAMAI read | Without it |
|---|---|---|
| `Policy.Read.All` | Conditional Access policies, named locations, authentication strengths, the authentication methods policy, security defaults, cross-tenant access | Nothing can be compared against the baseline, so there is no plan |
| `Directory.Read.All` | People, groups and members, devices, licences, the organisation name, the signed-in account | No names, counts or populations |
| `AuditLog.Read.All` | 30 days of interactive sign-in records, and the registered-methods report | No predicted impact and no verification |
| `RoleManagement.Read.Directory` | Which accounts hold which directory roles, permanently or through PIM | IAMAI cannot tell who administers the tenant |
| `UserAuthenticationMethod.Read.All` | Which kinds of method each account has registered, never the values | The emergency-access method and shared-device checks cannot run |
| `Reports.Read.All` | Aggregated per-application sign-in counts, and application sign-in activity | App-scoping advice loses its evidence |
| `Application.Read.All` | Application and service principal registrations | Nothing today: consented for a planned service-principal inventory (SPEC §4) that has not been built |
| `openid`, `profile`, `offline_access` | That the sign-in happened, who signed in, and a session that can refresh | Signing in, and finishing a long scan |

Granting consent creates **one** thing in the tenant: an enterprise application
named IAMAI, recording that the permissions were granted. Nothing else is
created and no data is copied anywhere.

To remove it: **Entra admin center → Entra ID → Enterprise applications → IAMAI
→ Properties → Delete**. That removes every permission immediately and leaves
nothing behind. Anything IAMAI held was in the browser; *Forget this tenant*
clears that separately.

The same disclosure is on the Connect page and the "What IAMAI reads" page,
generated from the scope list and the collector registry the code runs from, so
it cannot drift from what the consent screen shows.

## The role the signed-in account needs

A delegated read succeeds only where the consent **and** the signed-in account's Entra
role agree, so admin consent alone is not enough. **Global Reader** grants every section
IAMAI reads and can change nothing in the tenant, which makes it the whole ask; the
lower-privilege role per section (Security Reader, Directory Readers, Reports Reader) is
listed on the "What IAMAI reads" page and in `SPEC.md` §4, from
`src/graph/collect/roles.ts`. Where Graph refuses a section, IAMAI names the role to ask
for instead of repeating "insufficient privileges", disables that section with the reason,
and carries on with the rest of the scan.

## What it stores, and where

Everything stays in your browser:

- **IndexedDB** on this device: the scan (a snapshot of the tenant), the raw sign-in rows
  the replay engine uses, cached group memberships, your Setup answers, the plan with its
  history and activity log, and the loaded baseline. All keyed by tenant id.
- **sessionStorage**: the Microsoft sign-in session (MSAL token cache); cleared when the
  tab closes.
- **localStorage**: one flag that you have seen the Start page, and the theme.

"Forget this tenant" (top right) deletes every IndexedDB store for that tenant and signs
you out, which clears the token cache. Nothing is sent to any server: the app has no
backend, no analytics, no error reporting, no fonts or scripts from a CDN.

## What it never does

- Never writes to the tenant. Not even a report-only policy. The plan tells you what to
  create, in the portal, yourself.
- Never sends tenant data anywhere. Exports are files you download; the redacted grounding
  bundle removes names, sign-in names and the tenant id by default, and the unredacted
  version is behind an explicit choice with a warning that says what it contains.
- Never stores phone numbers, secrets, certificates or tokens beyond the session.

## The client id

The app registration's client id (`13f55900-8e9a-4aa3-82c1-e42a4448680f`) appears in the
source. That is by design: a single-page application uses the authorization-code flow with
PKCE and has no client secret, so the id is not a credential. Anyone can use it to sign
in to their own tenant with their own account; nobody can use it to read a tenant they
cannot already read. There is no secret, certificate or token in the repository or the
build, and a test asserts the only Entra identifier in the source is this id.

## Revoking access

Consent is per tenant. To remove it entirely: Entra admin center → Identity →
Applications → Enterprise applications → IAMAI → Delete (or Properties → "Enabled for
users to sign in" → No). Deleting the enterprise application revokes every permission the
tenant granted and invalidates existing tokens at their next refresh.

## Reporting a problem

Open an issue at https://github.com/ZephyrPretendstoKnowTech/iamai/issues. For anything
you would rather not post publicly, use the contact on the maintainer's GitHub profile.
Include the diagnostics download from the error page when there is one: it is redacted
(sign-in names and ids replaced by stable placeholders) before it is written.

For anything that is not a security issue (a wrong number, unclear wording, a
step that does not match your tenant), the address is **feedback@getiamai.com**,
or open an issue on the repository. The footer of every page has a link that
prefills the message; the scan summary is optional, and is counts only with no
names and no tenant id.

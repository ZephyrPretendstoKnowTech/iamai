# Security

IAMAI is a static web app. It reads a Microsoft Entra tenant with delegated, read-only
Microsoft Graph permissions and builds a Conditional Access rollout plan in the browser.
This file covers how to report a vulnerability, what the app reads, what it stores and
where, what can leave the browser, and what it never does.

## Reporting a vulnerability

Report it privately through GitHub's private vulnerability reporting, which is enabled
for this repository:
https://github.com/ZephyrPretendstoKnowTech/iamai/security/advisories/new (the
repository's **Security** tab, then **Report a vulnerability**). Please do not open a
public issue for a vulnerability. If you cannot use GitHub, email
**feedback@getiamai.com** with "Security" in the subject.

Do not include sign-in names, object ids or tenant ids. If the app showed its error page,
you can attach the diagnostics download from it: sign-in names and ids in it are replaced
with stable placeholders before the file is written.

IAMAI has a single maintainer. There is no bug bounty and no guaranteed response time.

For anything that is not a security issue (a wrong number, unclear wording, a step that
does not match your tenant), email **feedback@getiamai.com** or open an issue. The footer
of every page has a link that prefills the message; including a scan summary is
optional, and it is counts only, with no names and no tenant id.

## What the app reads

The "What IAMAI reads" section of the **How IAMAI works** page (`#/how`) lists every
Microsoft Graph request, generated from the collector registry the code runs from
(`src/graph/collect/registry.ts`). In summary: Conditional Access policies, named
locations, authentication strengths and the authentication methods policy; users,
devices, group memberships, role assignments and subscribed licences; per-user registered
method types (never phone numbers or secrets); and interactive sign-in records for up to
the last 30 days.

Every permission is a delegated **read** scope, requested once at sign-in on a single
consent screen (`src/graph/scopes.ts`). There is no write scope, and
`src/ui/permissions.test.ts` fails the build if one is added.

| Permission | What it lets IAMAI read | Without it |
|---|---|---|
| `Policy.Read.All` | Conditional Access policies, named locations, authentication strengths, the authentication methods policy, security defaults, cross-tenant access | Nothing can be compared against the baseline, so there is no plan |
| `Directory.Read.All` | People, groups and members, devices, licences, the organisation name, the signed-in account | No names, counts or populations |
| `AuditLog.Read.All` | Up to 30 days of interactive sign-in records, and the registered-methods report | No predicted impact and no verification |
| `RoleManagement.Read.Directory` | Which accounts hold which directory roles, permanently or through PIM | IAMAI cannot tell who administers the tenant |
| `UserAuthenticationMethod.Read.All` | Which kinds of method each account has registered, never the values | The emergency-access method and shared-device checks cannot run |
| `Reports.Read.All` | Aggregated per-application sign-in counts, and application sign-in activity | App-scoping advice loses its evidence |
| `openid`, `profile`, `offline_access` | That the sign-in happened, who signed in, and a session that can refresh | Signing in, and finishing a long scan |

The Connect page and the How page show the same disclosure, generated from the scope list
and the collector registry, so it cannot drift from what the consent screen asks for.

## The role the signed-in account needs

A delegated read succeeds only where the consent **and** the signed-in account's Entra
role allow it, so consent alone is not enough. **Global Reader** covers every section
IAMAI reads and can change nothing in the tenant. The first sign-in in a tenant needs an
account that can grant tenant-wide admin consent (for example a Global Administrator),
once; after that, Global Reader is enough. The lower-privilege role per section is listed
on the How page and in `SPEC.md` §4, from `src/graph/collect/roles.ts`. Where Graph
refuses a section, IAMAI names the role to ask for, disables that section with the
reason, and carries on with the rest of the scan.

## Consent, and removing it

Granting consent creates one thing in the tenant: an enterprise application named
**IAMAI Planner**, which records the permissions granted. Nothing else is created.

To remove it: **Microsoft Entra admin center → Entra ID → Enterprise apps → IAMAI Planner
→ Properties → Delete.** That removes the permissions the tenant granted; no new token can
be issued after it, and an access token already issued stays valid until it expires.
What IAMAI stored in the browser is separate: *Forget this tenant* clears it.

## Network destinations

The app contacts four hosts:

| Host | What for |
|---|---|
| `login.microsoftonline.com` | Microsoft sign-in (MSAL, authorization code flow with PKCE) |
| `graph.microsoft.com` | The tenant's data, read with the signed-in account's token |
| `api.github.com` | Whether the default baseline's repository has a commit newer than the pinned one (checked from Connect), and that commit's file list when you review an update |
| `raw.githubusercontent.com` | The changed baseline files at the commit under review, only when you review an update |

The two GitHub requests are unauthenticated reads of a public repository and carry no
tenant data. The plan itself is built from the reviewed baseline copy bundled in the build
(`baselines/jhope188-conditionalaccesspolicies.pinned.json`), with no network call.

`src/network.test.ts` fails the build if the source (`src/`, `home/`, `index.html`) makes a
request-shaped reference to any other host, or if the built bundle names a host that is
neither on this list nor on its documented list of inert strings. It is a static check of
the source and the build output.

Both published pages carry a Content-Security-Policy as a `<meta>` element written at
build (`scripts/csp.ts`; `src/csp.test.ts` asserts it). The planner may run only its own
scripts and worker, connect only to its own origin and the four hosts above, and frame
only `login.microsoftonline.com` (MSAL's silent token renewal). The home page runs its
own inline theme script by hash and fetches nothing. Neither page allows `unsafe-eval` or
inline script. Both also allow Cloudflare's beacon hosts, because Cloudflare injects that
script (below) and whether it runs is a setting on the Cloudflare account, not the page's.

GitHub Pages sends no custom response headers, so what only a header can carry is not
set: `frame-ancestors` (framing by other sites), `report-to`, and
`X-Content-Type-Options`. Setting them needs a response-header rule on the Cloudflare
account.

The app has no backend, no analytics or error reporting of its own, and no fonts, scripts
or stylesheets from a CDN.

## What the public site adds: Cloudflare

getiamai.com is a static site on GitHub Pages, served through Cloudflare. Cloudflare
changes the HTML at the edge in two ways. Neither is in this repository or in `dist/`, so
neither can be removed from here; both are settings on the Cloudflare account, and a
build served from a clone or another host loads neither.

- **Web Analytics beacon, on both pages.** Cloudflare adds a script from
  `static.cloudflareinsights.com/beacon.min.js`, which reports page-load and network
  timing for the site to `/cdn-cgi/rum`. It is a third-party script on the page: IAMAI's
  code does not call it or pass it anything, and it is not given the scan.
- **Email address obfuscation, on the home page.** Cloudflare rewrites the footer's
  `mailto:` link into a `/cdn-cgi/l/email-protection` link and adds a same-origin decoding
  script, `/cdn-cgi/scripts/…/cloudflare-static/email-decode.min.js`. The planner draws its
  footer with JavaScript, so its served HTML has no address for Cloudflare to rewrite.

## What it stores, and where

Everything stays in the browser on this device:

- **IndexedDB**, database `iamai`, seven stores keyed by tenant id: `snapshot` (the scan),
  `signin-rows` (the sign-in rows the evidence is read from), `evidence-meta`,
  `group-members` (cached group memberships), `mapping` (your answers and decisions), `plan`
  (the plan and its history) and `baseline` (the baseline chosen for the tenant).
- **sessionStorage**: the Microsoft sign-in session (MSAL's token cache), cleared when the
  tab closes or when you sign out; and `iamai.preloadReloaded`, a flag that allows one
  automatic reload after a new deploy replaces a script the page was loading.
- **localStorage**: `iamai-theme` (light or dark, shared with the home page) and
  `iamai.tip.<page>` (whether a page's tip is collapsed). No tenant data.

*Forget this tenant* (in the Account menu) deletes that tenant's records from every
IndexedDB store; other tenants' records on the same device are untouched, and you stay
signed in. *Sign out* clears the sign-in session.

## What can leave the browser

Nothing leaves on its own. Data moves when you choose to move it: downloading a file
(the plan file, CSVs, the calendar file, the prompts, the grounding bundle, a policy's
JSON, diagnostics), copying text to the clipboard, printing, or sending the feedback
message, which opens your own mail client with a prefilled message you send yourself.

Every download, clipboard write and print goes through `src/ui/exportGuard.ts`, and
`src/ui/exportGuard.test.ts` fails the build if code reaches a browser export API another
way. By default an export is redacted: sign-in names and GUIDs are replaced with stable
placeholders. That default does not replace display names, so a redacted CSV can still
contain people's, groups' or policies' names. The redacted grounding bundle goes further
and replaces every display name the tenant contains (`src/redactSnapshot.ts`).

Three exports carry names and ids in full, and each says so on screen before you export:
the plan file, the print document, and the grounding bundle when you clear its redaction
checkbox. Files exported from demo mode are marked as sample data.

## What it never does

- Never writes to the tenant: not even a report-only policy. The Plan's implementation
  content (Entra admin center steps, PowerShell, policy JSON, email text) is for you to
  review and apply yourself.
- Never sends tenant data to a server of its own. There is none.
- Never stores phone numbers, secrets or certificates, and keeps tokens only in the
  session.

## The client id

The app registration's client id (`13f55900-8e9a-4aa3-82c1-e42a4448680f`) appears in the
source. That is by design: a single-page application uses the authorization code flow with
PKCE and has no client secret, so the id is not a credential. Anyone can use it to sign in
to their own tenant with their own account; nobody can use it to read a tenant they cannot
already read. There is no secret, certificate or token in the repository or the build.

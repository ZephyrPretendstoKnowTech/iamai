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
with stable placeholders before the file is written, and it carries no tenant id or hash
of one.

IAMAI has a single maintainer. There is no bug bounty and no guaranteed response time.

For anything that is not a security issue (a wrong number, unclear wording, a step that
does not match your tenant), email **feedback@getiamai.com** or open an issue. The footer
of every page has that address as a plain mail link: it opens your mail client with an
empty message, and nothing from the scan is added to it.

## What the app reads

The "What IAMAI reads" section of the **How IAMAI works** page (`#/how`) lists every
Microsoft Graph request, generated from the collector registry the code runs from
(`src/graph/collect/registry.ts`). In summary: Conditional Access policies, named
locations, authentication strengths and the authentication methods policy; users,
devices, group memberships, role assignments and subscribed licences; per-user registered
sign-in methods; and interactive sign-in records and directory audit events for up to the last
30 days. For registered
methods, Microsoft returns each method's details. IAMAI saves the sign-in details needed for
its checks, leaving out phone numbers: each method's kind and when it was added, and for
passkeys, security keys and Microsoft Authenticator the device details those checks read.

Every permission is a delegated **read** scope, requested once at sign-in on a single
consent screen (`src/graph/scopes.ts`). There is no write scope, and
`src/ui/permissions.test.ts` fails the build if one is added.

| Permission | What it lets IAMAI read | Without it |
|---|---|---|
| `Policy.Read.All` | Conditional Access policies, named locations, authentication strengths, the authentication methods policy, security defaults, cross-tenant access | Nothing can be compared against the baseline, so there is no plan |
| `Policy.Read.AuthenticationMethod` | The Passkey (FIDO2) method configuration, assigned profiles, attestation settings and allowed authenticator models | IAMAI cannot verify passkey profiles or whether the configured models meet the plan |
| `Directory.Read.All` | People, groups and members, devices, licences, the organisation name, the signed-in account | IAMAI cannot read the people, so it builds no plan |
| `AuditLog.Read.All` | Up to 30 days of interactive sign-in records and directory audit events (from an event: what happened, when, its result and the objects it changed), when each account last signed in, and the registered-methods report | IAMAI cannot read the sign-in records, so it builds no plan (without Entra ID P1 there are none to read, and the plan is built without them) |
| `RoleManagement.Read.Directory` | Which accounts hold which directory roles, permanently or through PIM | IAMAI cannot tell who administers the tenant |
| `UserAuthenticationMethod.Read.All` | Each account's registered methods; IAMAI saves the sign-in details its checks need, leaving out phone numbers | The emergency-access method and shared-device checks cannot run |
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
| `api.github.com` | Whether the baseline's repository has a commit newer than the pinned one (checked from Connect), and, when it has, that commit's file list |
| `raw.githubusercontent.com` | The changed baseline files at that newer commit, read from Connect as soon as the repository has one |

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

A `<meta>` policy does not reach the dedicated worker that runs the scan's bulk reads: a
worker loaded from a URL takes its policy from its own response headers, and GitHub Pages
sends none. The code holds the line there instead. Every request that carries the Graph
token goes through one function (`graphRequest`, `src/graph/collect/http.ts`), in the
worker and in the page, and it refuses any URL whose origin is not exactly
`https://graph.microsoft.com` before the token is attached. That includes an
`@odata.nextLink` or `$batch` continuation a response names; a refused URL is a failed
read of that section (`src/graph/collect/http.test.ts`). So the token only ever goes to
`graph.microsoft.com`.

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

What IAMAI saves stays in the browser on this device:

- **IndexedDB**, database `iamai`, seven stores keyed by tenant id: `snapshot` (the scan),
  `signin-rows` (the sign-in rows the evidence is read from), `evidence-meta`,
  `group-members` (cached group memberships), `mapping` (your answers and decisions), `plan`
  (the plan and its history) and `baseline` (the baseline chosen for the tenant). Each
  tenant opened in this browser keeps its own records here until it is forgotten; opening
  another tenant from the Account menu deletes nothing.
- **sessionStorage**: the Microsoft sign-in session (MSAL's token cache), cleared when the
  tab closes. Sign out removes the open account's part of it, and all of it when no other
  account is signed in in that tab. Also `iamai.preloadReloaded`, a flag that allows one
  automatic reload after a new deploy replaces a script the page was loading.
- **localStorage**: `iamai-theme` (light or dark, shared with the home page) and
  `iamai.tip.<page>` (whether a page's tip is collapsed). No tenant data.

*Forget this tenant* (in the Account menu) deletes that tenant's records from every
IndexedDB store; other tenants' records on the same device are untouched, and you stay
signed in. A tenant that is not open is forgotten the same way from its own row in the
Account menu, without signing in to it. *Sign out* signs out the account that is open; an
account signed in to another tenant in the same tab stays signed in.

## What can leave the browser

Apart from the Microsoft sign-in, the Microsoft Graph reads and the GitHub checks listed
above, nothing leaves on its own. Data moves when you choose to move it: downloading a file
(the plan file, CSVs, the calendar file, the prompts, the grounding bundle,
diagnostics), copying text to the clipboard, or printing. Writing to the feedback
address is a message you compose in your own mail client; the app adds nothing to it.

Every download, clipboard write and print goes through `src/ui/exportGuard.ts`, and
`src/ui/exportGuard.test.ts` fails the build if code reaches a browser export API another
way. Each export either masks identifiers or carries them in full.

**Masked.** Sign-in addresses and object ids (GUIDs) are replaced with stable
placeholders. Display names are not replaced unless the item says so.

- The calendar file and the prompts, downloaded or copied. They keep people's, groups'
  and policies' names and the tenant's name (the file name carries it too). Passkey
  model ids (AAGUIDs) stay as they are: they are vendor constants, not tenant data.
- The text a step's More section copies (the email, help-desk and manager text).
- The diagnostics downloads. They carry no tenant id and no hash of one.
- The grounding bundle, which is masked unless you clear its checkbox. It also replaces
  the display names the tenant contains: the organisation's however short, other names
  from four letters up (a shorter one, such as a group called IT, is a common word)
  (`src/redactSnapshot.ts`). It is still not guaranteed anonymous.

**In full.** Names, sign-in addresses and object ids appear as the tenant holds them.

- The plan file: your answers and decisions, the plan, the tenant id and the signed-in
  account.
- The print document: the people and groups the plan names, and the sign-in address of
  the person who prepared it.
- The grounding bundle with its redaction checkbox cleared.
- Every CSV: MFA Readiness, and each table's CSV on the Inventory and Export pages. The
  accounts CSV lists every account's sign-in address with its roles and MFA state, and the
  groups CSV has an `Id` column with each group's object id.
- Copy in a step's Implementation viewer, AI Info included: the Entra procedure, script,
  JSON or email exactly as the viewer shows it, with the tenant's object ids, tenant id
  and names. A masked copy would be a different artifact that does not deploy.
- Policies as JSON on the Export page: every policy step's create or update as its own
  tabs hand it over, with the tenant's object ids and tenant id, for the same reason.

Review any of these before you share it. Files exported from demo mode are marked as
sample data.

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

# IAMAI

IAMAI is a read-only rollout planner for Microsoft Entra Conditional Access. It runs in
your browser.

- **Home:** https://getiamai.com/
- **Planner:** https://getiamai.com/planner/
- **Demo:** https://getiamai.com/planner/?demo=1#/plan (a built-in sample tenant, no
  sign-in, nothing from a real tenant)

## The problem

A Conditional Access baseline tells you which policies a tenant should have. It does not
tell you what those policies will do to *this* tenant: the admin whose only method is a
text message, the emergency-access account inside the policy it has to survive, the
service account on legacy authentication, the country rule that blocks the person who
wrote it. Working that out by hand means reading policies, exports and sign-in logs
side by side.

IAMAI reads the tenant, compares its policies with a baseline by what each policy does
rather than what it is called, and writes a dated plan: which steps are needed, who
each change is predicted to affect, what has to be ready first, and the change to make.
Predicted impact is an estimate from the tenant's own records, confirmed in report-only
before a policy is enforced. IAMAI does not guarantee that nobody is locked out.

## How it works

1. **Connect.** Sign in with a Microsoft Entra work account and grant the read-only
   permissions. The scan reads the tenant's Conditional Access configuration, users,
   groups, devices, licences, role assignments, registered authentication methods and up
   to 30 days of interactive sign-ins, as far as the tenant's licence and your role
   allow.
2. **Plan.** The main working view: the baseline's goals as dated steps, each with its
   status, who it touches, what it waits on, and implementation content (Entra admin
   center steps, PowerShell, policy JSON, context for your own AI assistant, and an email
   to send). You apply every change yourself.
3. **MFA Readiness.** Person by person, who is ready for MFA and phishing-resistant
   methods, from registered methods and sign-in evidence.
4. **Export.** Print or save as PDF, a calendar file, the plan file, CSVs, prompts and a
   grounding bundle.

**How IAMAI works** (`#/how`) lists the permissions, what IAMAI reads, every check it
runs, baseline packages and the known limits. **Inventory** lists every account and
policy the scan read.

## Access

IAMAI requests these delegated Microsoft Graph permissions, once, at sign-in
(`src/graph/scopes.ts`). Every one is a read scope.

`Policy.Read.All`, `Directory.Read.All`, `AuditLog.Read.All`,
`RoleManagement.Read.Directory`, `UserAuthenticationMethod.Read.All`,
`Reports.Read.All`, plus `openid`, `profile` and `offline_access` for the sign-in itself.

- **Role.** Global Reader is the least privilege that reads everything IAMAI needs, and it
  can change nothing. A delegated read only succeeds where both the consent and your role
  allow it; where Graph refuses a section, IAMAI names the role to ask for and carries on
  with the rest.
- **First sign-in in a tenant.** Consent has to be granted once by an account that can
  grant tenant-wide admin consent (for example a Global Administrator). After that,
  Global Reader is enough.
- **Removing access.** Consent creates one enterprise application, IAMAI Planner. Delete
  it in the Microsoft Entra admin center (Entra ID → Enterprise apps → IAMAI Planner →
  Properties → Delete) to remove every permission. What IAMAI stored in your browser is
  cleared separately with *Forget this tenant*.

## What it does not do

- **It does not change your tenant.** There is no write scope and no call that creates,
  edits or deletes anything, not even a report-only policy. The implementation content is
  text you review and apply yourself.
- **It has no server.** No IAMAI account, no backend, no analytics of its own.
- **It does not monitor.** There are no scheduled rescans, alerts or cross-device sync.
  To see changes, open IAMAI and scan again.
- **It does not reproduce Microsoft's policy evaluation exactly.** Impact is predicted
  from sign-in history; report-only in your tenant is the source of truth.

## Privacy and trust boundaries

- **Where tenant data goes.** The scan calls Microsoft Graph from your browser with your
  own token. The snapshot, your answers and the plan are stored in this browser's
  IndexedDB, keyed by tenant; *Forget this tenant* deletes them.
- **Network hosts.** The app contacts four hosts: `login.microsoftonline.com` (sign-in),
  `graph.microsoft.com` (the tenant's data), and `api.github.com` and
  `raw.githubusercontent.com` (checking for and reviewing baseline updates; no tenant data
  is sent). `src/network.test.ts` fails the build if the source or the built bundle names
  another.
- **Exports.** An export is a file you save, a copy to your clipboard or a printout. By
  default sign-in names and ids are replaced with placeholders (display names can remain);
  the plan file, the print document and the grounding bundle with redaction turned off
  contain names and ids in full, and the page says so before you export.
- **Hosting.** getiamai.com is a static site on GitHub Pages served through Cloudflare.
  Cloudflare adds its own page-load analytics beacon to both pages, and an email-address
  obfuscation script to the home page. Neither is in this repository or the build, and
  IAMAI's code does not pass either of them anything.

[`SECURITY.md`](SECURITY.md) has the detail: what is stored where, the export rules,
the client id and how to report a vulnerability.

## Baseline

The default baseline is Jon Hope's Defense in Depth Conditional Access baseline,
[Jhope188/ConditionalAccessPolicies](https://github.com/Jhope188/ConditionalAccessPolicies).
IAMAI bundles a reviewed, pinned copy of its policy JSON in the build
(`baselines/jhope188-conditionalaccesspolicies.pinned.json`, with an index and an
interpretation file) and credits the author on the How page. The plan is built from that
copy without a network call. Connect checks whether the author's repository has moved past
the pinned commit; reviewing an update fetches the changed files at that commit, and
taking it is your decision. You can also load a baseline package of your own. IAMAI is not
affiliated with or endorsed by the baseline's author.

## Run it locally

Requires Node.js 22.18 or later.

```
npm install
npm run dev          # Vite dev server on port 5173, serving /planner/
npm test             # unit tests (Node's built-in runner over src/**/*.test.ts)
npx tsc --noEmit     # typecheck
npm run build:site   # dist/ (home page) and dist/planner/ (the planner)
npm run smoke        # headless Chrome smoke test against the sample tenant
```

The sample tenant needs no sign-in: open `http://localhost:5173/planner/?demo=1#/plan`.
Signing in from a local build uses IAMAI's own app registration and depends on the
redirect URIs registered there.

## Project status

Active development by a single maintainer. There are no tagged releases; `main` is what
is deployed. Every push runs the `ci` workflow (typecheck, unit tests, site build, smoke),
and a push to `main` walks the sample tenant in headless Chrome before the site is
published. Wording, plan logic and layout still change often.

`SPEC.md` records product decisions and their reasons, with a status note on what is
historical. [`CONTRIBUTING.md`](CONTRIBUTING.md) has the rules a change must keep.

## Feedback

If something is wrong or unclear, email **feedback@getiamai.com** or open an issue. Every
page has a footer link that prefills the message; including a scan summary is optional
and it is counts only, with no names and no tenant id. Security reports: see
[`SECURITY.md`](SECURITY.md).

## Licence

MIT. See [`LICENSE`](LICENSE).

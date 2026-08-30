# Application.Read.All: the decision

Prompt 39 Part 3, answering review 07 finding P1. Written 2026-08-30.

**Recommendation: drop `Application.Read.All` from the scope set.** Not because the
service-principal inventory is a bad idea, but because building it does not require the
scope. IAMAI already requests `Directory.Read.All`, and Microsoft documents that as a
sufficient delegated permission for `GET /servicePrincipals`. The scope buys nothing.

That is the whole finding, and it is worth stating plainly: the scope was consented for a
feature that has not been built, and when the feature is built it will not need it.

## 1. What the inventory would add

`/servicePrincipals` returns a set of facts about workload identities that nothing IAMAI
reads today can supply:

| Fact | Property | Why a rollout plan would want it |
|---|---|---|
| Credential expiry | `keyCredentials`, `passwordCredentials` | A secret expiring inside the rollout window breaks an integration on a day the plan says is safe. |
| Ownerless identities | `owners` (relationship) | Microsoft's own guidance is at least two owners. An ownerless service principal has nobody to warn before a change. |
| What it can do | `appRoleAssignments`, `oauth2PermissionGrants` | A service principal holding a directory role is an admin the admin steps never counted. |
| Kind | `servicePrincipalType` | Managed identities cannot be given an MFA method, so a policy that would catch them needs a different answer from one catching a script account. |
| Where it came from | `appOwnerOrganizationId`, `verifiedPublisher` | Distinguishes first-party Microsoft, a third-party vendor, and something registered in this tenant. |
| Enabled or not | `accountEnabled` | A disabled service principal is not a risk and should not be in a population. |

Which findings improve:

- **`workload-identity-block`** ("Service principals restricted"). Today this goal is scored
  from policy shape alone. With an inventory it could name the identities a workload-identity
  policy would catch, which is the difference between "restrict service principals" and
  "this would apply to these four, one of which runs your billing export".
- **Service-account detection** (`src/mapping/serviceAccounts.ts`) infers service accounts
  from *user* rows using name patterns, licence shape and missing profile fields. A service
  principal inventory does not replace that — they are different objects — but
  `appOwnerOrganizationId` would let Setup separate "an app registered here" from "a vendor's
  app", which the current signals cannot do.
- **Break-glass validation.** A service principal holding a permanent Global Administrator
  role is exactly the gap `bg.role.permanentGa` looks for in users, and IAMAI cannot see it.

None of this is speculative value. It is also none of it urgent: no current step or finding is
*wrong* without it, they are narrower.

## 2. Is it already available?

Partly, and less than the SPEC assumed. IAMAI reads two beta reports, both under
`Reports.Read.All`:

| Source | Endpoint | What it actually returns |
|---|---|---|
| `spActivity` | `/reports/servicePrincipalSignInActivities` | `appId`, `id`, and five `signInActivity` blocks (last sign-in, delegated and app-only, as client and as resource). **No display name. No credentials. No owners. No type.** |
| `appSignInSummary` | `/reports/applicationSignInDetailedSummary` | `appId`, `appDisplayName`, `signInCount`, `status`, `aggregatedEventDateTime`. |

So between them the tool already knows **which app identities signed in, when, how often, and
what most of them are called**. That covers "is this app in use", which is what
`vendorAppSeen` (`src/coverage/coverage.ts`) and `seenInUsage`
(`src/coverage/applicability.ts`) use them for.

What they cannot answer is anything about an identity that has *not* signed in — and that is
the population that matters most for the inventory's purpose. A dormant service principal
with a five-year secret and no owner appears in neither report. Sign-in activity is evidence
of use; it is not an inventory.

**A defect found while checking this.** `seenInUsage` reads `r.appDisplayName` across both
sources, but `servicePrincipalSignInActivity` has no `appDisplayName` property. The name half
of that match silently only ever works against `appSignInSummary` rows. It is not a
correctness bug — the `appId` half still matches — but the name-pattern fallback covers less
than it appears to. Worth fixing whichever way this decision goes.

## 3. What removing it would cost

**Nothing today.** No collector, no registry row, no call. `src/graph/scopes.ts` lists it;
nothing consumes it. The `What IAMAI reads` page already says so in as many words.

**Nothing later, either** — this is the part that settles it. Microsoft's reference for
`GET /servicePrincipals` gives the delegated permissions as:

> Least privileged: `Application.Read.All`. Higher privileged: `Application.ReadWrite.All`,
> `Directory.Read.All`, `Directory.ReadWrite.All`.

IAMAI already holds `Directory.Read.All`, for group membership, directory objects and name
resolution. So the inventory can be built on the scopes already consented. Keeping
`Application.Read.All` would be defensible on least-privilege grounds if it were the *only*
scope in play — but it is not, and adding a second scope that grants a subset of what a
first already grants is not least privilege, it is a longer consent screen.

Two caveats worth recording:

- `keyCredentials` is not returned when listing all service principals unless named in a
  `$select`, and that query is throttled to 150 requests per minute per tenant. A credential
  inventory needs to be a deliberate, paged, rate-aware collector. That constraint is
  identical under either scope.
- The role a delegated caller holds still gates the call. Global Reader and Directory Readers
  both appear in Microsoft's supported-role list for this operation, and IAMAI already asks
  for Global Reader, so this changes nothing about the role requirement.

**Does the consent screen get materially shorter?** Eight scopes become seven, so: barely, in
length. But the wording changes in a way that matters more than the count. `Application.Read.All`
presents as "Read applications" — the one line on the screen that sounds like it might touch
app registrations. Removing it takes the most alarming-looking entry off a screen whose entire
job is to be reassuring enough to click. For a tool whose trust story is "review the code,
then connect", removing a scope nothing uses is worth more than the line it saves.

## 4. Recommendation

1. **Remove `Application.Read.All`** from `src/graph/scopes.ts`, from the app registration,
   and from SPEC §4. Record it in SPEC §4 as *not requested*, with this document as the
   reason — the same way `Agreement.Read.All` and the Intune scopes are recorded.
2. **Keep the service-principal inventory on the roadmap**, and note in SPEC §4 that it lands
   under `Directory.Read.All`. Nothing about it is blocked by this removal.
3. **Existing tenants.** Removing a scope needs no re-consent; the app simply stops asking
   for it. Tenants that consented before the change keep a stale grant until an admin
   reviews it, which is ordinary and harmless. Worth one line in the release note rather than
   a prompt.
4. **Until it is removed**, the `What IAMAI reads` page must not list it inside the table of
   permissions the tool relies on (item 11, done in this prompt).

## 5. What would change this recommendation

If a future collector needed `/applications` rather than `/servicePrincipals` — the app
registration objects, for required resource access and redirect URIs — the permission table
should be re-checked, because the two resources do not always share a least-privileged scope.
Nothing on the roadmap needs `/applications` today.

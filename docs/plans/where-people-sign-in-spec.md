# Control Where People Sign In From: the wave spec

The V1 spec (`v1-procedure.md` §5) for step group `where-people-sign-in`
(`src/roadmap/stepGroups.ts`), taken vertically: one outcome per step, every
technical claim rechecked against Microsoft Learn, and one acceptance test per
item. Same shape as `close-doors-spec.md`.

**Every Microsoft fact below was rechecked on 2026-09-20.** The date beside a
page is its own `ms.date`, read from the live page on that day.

**Frozen, and not touched by this wave:** the four Establish Emergency Access
steps and the four Direction steps. Two open items in
`frozen-step-suggestions.md` bear on this group directly — §7 (D4 can only offer
a named location that already exists, so on a tenant with none the only honest
answer switches off Define the Trusted Network) and §8 (D1's mail-devices answer
rewrites D2's curated service-accounts list). Neither is fixed here. What this
wave did instead is make its own steps **read correctly given that behaviour**,
and say so where a person would otherwise be surprised (§4 D2, §6 S3).

The policy anatomy is Emergency Access's: no component, class, heading, pill or
tag is added. What looked like it needed one is in
`policy-anatomy-deviations.md` §8–§10.

---

## 1. The sources

| Key | Page | `ms.date` | Checked |
|---|---|---|---|
| `ms-network` | https://learn.microsoft.com/entra/identity/conditional-access/concept-assignment-network | 2026-04-01 | 2026-09-20 |
| `ms-block-location` | https://learn.microsoft.com/entra/identity/conditional-access/policy-block-by-location | 2026-03-24 | 2026-09-20 |
| `ms-ca-conditions` | https://learn.microsoft.com/entra/identity/conditional-access/concept-conditional-access-conditions | 2026-06-02 | 2026-09-20 |
| `ms-ca-users` | https://learn.microsoft.com/entra/identity/conditional-access/concept-conditional-access-users-groups | 2026-03-24 | 2026-09-20 |
| `ms-mfa-strength` | https://learn.microsoft.com/entra/identity/conditional-access/policy-all-users-mfa-strength | 2026-03-24 | 2026-09-20 |
| `ms-workload-ca` | https://learn.microsoft.com/entra/identity/conditional-access/workload-identity | 2026-03-24 | 2026-09-20 |
| `ms-workload-faq` | https://learn.microsoft.com/entra/workload-id/workload-identities-faqs | 2025-03-18 | 2026-09-20 |
| `ms-cae-strict` | https://learn.microsoft.com/entra/identity/conditional-access/concept-continuous-access-evaluation-strict-enforcement | 2026-03-24 | 2026-09-20 |
| `ms-connect-accounts` | https://learn.microsoft.com/entra/identity/hybrid/connect/reference-connect-accounts-permissions | 2025-04-09 | 2026-09-20 |
| `ms-cloud-sync-faq` | https://learn.microsoft.com/entra/identity/hybrid/cloud-sync/reference-cloud-sync-faq | 2026-03-30 | 2026-09-20 |
| `ms-roles` | https://learn.microsoft.com/entra/identity/role-based-access-control/permissions-reference | 2026-07-17 | 2026-09-20 |
| `ms-security-defaults` | https://learn.microsoft.com/entra/fundamentals/security-defaults | 2025-07-21 | 2026-09-20 |
| `ms-ip-named-location` | https://learn.microsoft.com/graph/api/resources/ipnamedlocation | 2024-05-23 | 2026-09-20 |
| `ms-country-named-location` | https://learn.microsoft.com/graph/api/resources/countrynamedlocation | 2024-07-22 | 2026-09-20 |
| `ms-secure-service-accounts` | https://learn.microsoft.com/entra/architecture/secure-service-accounts | **2022-08-26** | 2026-09-20 |

### Facts that hold for the whole group

- **The condition is called Network now, not Location.** `ms-network`: "The
  **Location** condition moved and was renamed **Network**. Initially, this
  condition appears at both the **Assignment** level and under **Conditions**.
  Updates or changes appear in both locations. The functionality remains the
  same, and existing policies using **Location** continue to work without
  changes." Its Include options read **Any network or location**, **All trusted
  networks and locations**, **All Compliant Network locations**, **Selected
  networks and locations**. Three of this group's procedures still said "Any
  location". **Corrected.**

- **THE TRAP — Network carries a Configure toggle, and every procedure here was
  missing it.** `ms-block-location`, step 7: "Under **Network**. 1. Set
  **Configure** to **Yes** 2. Under **Include**, select **Selected networks and
  locations**". `ms-mfa-strength` says the same: "Under **Assignments**, select
  **Network**. 1. Configure **Yes**." And `ms-network` states the default:
  "**Conditional Access policies apply to all locations by default.**" A create
  procedure that names Include and Exclude without first setting **Configure**
  to **Yes** describes a policy whose location condition is not configured —
  which is the group-3 trap class exactly. **Corrected in all three policy
  packages and in all three `whatToDoReference` blocks.**

  Recorded honestly in §9.1: Learn spells out what **No** means only for
  **Client apps** (`ms-ca-conditions`: "The **Configure** toggle when set to
  **Yes** applies to checked items, when set to **No** it applies to all client
  apps"). For **Network** it states the default behaviour ("apply to all
  locations by default") and sets the toggle in its own procedures, but never
  writes the sentence. The wave follows Microsoft's procedure and claims no
  more than Microsoft states.

- **Portal path.** `ms-network`: "Locations are in the Microsoft Entra admin
  center under **Entra ID** > **Conditional Access** > **Named locations**."
  One of this group's six procedures said "Entra admin center → Conditional
  Access → Named locations", with no `Entra ID`. **Corrected** (§3 T1); it is
  the same defect `frozen-step-suggestions.md` §2 records on a frozen step.

- **What a location condition can see.** `ms-network`: "A user's location is
  determined using their public IP address or the GPS coordinates provided by
  the Microsoft Authenticator app." For a private network, "the IP address isn't
  the client IP of the user's device on the intranet (like 10.55.99.3), it's the
  address used by the network to connect to the public internet". Behind a
  proxy or VPN, "the IP address Microsoft Entra ID uses while evaluating a
  policy is the IP address of the proxy. The **X-Forwarded-For** (XFF) header,
  which contains the user's public IP address, isn't used because there's no
  validation that it comes from a trusted source." **The XFF half was nowhere in
  this group; added to Block Sign-ins From Countries Not Allowed's risks.**

- **When a location change bites.** `ms-network`: "**By default, Microsoft Entra
  ID issues tokens hourly. After users move off the corporate network, within an
  hour the policy is enforced for applications using modern authentication.**"
  For web apps, "policies apply at initial sign-in and are good for the lifetime
  of the session at the web application". The group said "does not bite until
  the token refreshes" without the hour. **Corrected.**

- **Named-location limits.** `ms-network`: "No more than 195 named locations. No
  more than 2000 IP ranges per named location. **Only CIDR masks greater than /8
  are allowed** when defining an IP range." Define the Trusted Network said
  "never 0.0.0.0/0", which describes a range Entra will not accept in the first
  place. **Replaced with the rule that is actually enforced.**

- **Licence.** Conditional Access needs Entra ID P1 or higher; the workload
  policy needs its own licence (§8). No step of this group claimed otherwise.

- **Report-only first.** Every policy in this group is created in report-only
  (V1 §3.8). `ms-block-location` ends its own recipe the same way. No conflict.

---

## 2. What each step owns

| Step | Outcome sentence lives in | Rendered anatomy |
|---|---|---|
| `s-prereq-trusted-location` | `doneWhen[0]` | object (Why / Readiness / Implementation / Done when) |
| `s-prereq-allowed-countries` | `doneWhen[0]` | object |
| `s-goal-geo-restriction` | `doneEnd` | policy (Emergency Access's) |
| `s-prereq-service-accounts-group` | `doneWhen[0]` | object |
| `s-goal-service-accounts-trusted-network` | `doneEnd` (**new**) | policy |
| `s-goal-workload-identity-block` | `doneEnd` | policy |

The three object steps draw the default step headings, not the Emergency Access
anatomy. That is `stepGroups.ts` `anatomy: null` behaving as designed, and it is
`step-redundancy-analysis.md` finding 15, which is being taken by the non-policy
anatomy work. **Not this wave's, and not changed here.**

`doneEnd` is read only for a **held** policy step (`stepContract.ts`): it is the
sentence a policy step shows under Completion Criteria while it waits. That is
the state all three policy steps of this group are in on both demo snapshots, so
it is the sentence a person actually reads.

---

## 3. `s-prereq-trusted-location` — Define the Trusted Network

**Outcome.** *One named location holds exactly the public addresses the network
owner approved, it is marked trusted, and the sign-ins that should match it do.*

**Applies when.** D4's office-network answer names trusted locations.
`frozen-step-suggestions.md` §7 is the open item: on a tenant with no trusted IP
named location D4's picker has nothing to offer, so the only honest answer
switches this step off. The step is not re-asking that question — its duplicate
"choose your office networks" tile was removed — and it now reads as the doing of
D4's answer.

**Microsoft facts.**

1. **The portal path was missing a level.** `ms-network`: "Locations are in the
   Microsoft Entra admin center under **Entra ID** > **Conditional Access** >
   **Named locations**." The create procedure said "Entra admin center →
   Conditional Access → Named locations". **Corrected** (T1).
2. **"A trusted location also lowers Identity Protection risk scores" is not
   what Learn says.** The only statement is `ms-network`: "Sign-ins from trusted
   named locations **improve the accuracy** of Microsoft Entra ID Protection's
   risk calculation." Improving accuracy is not lowering a score, and
   `concept-identity-protection-risks` (`ms.date` 2026-04-22) does not mention
   named locations at all. **Corrected** (T2) — the advice that follows ("keep
   the ranges tight") is unchanged and is now supported by the fact that is
   true.
3. **A trusted location cannot simply be deleted.** `ms-network`: "Locations
   marked as trusted can't be deleted without first removing the trusted
   designation." Nowhere in the step before. **Added** (T4), because it is what
   a person hits the first time they try to tidy one up.
4. **The range rule.** `ms-network`: "Only CIDR masks greater than /8 are
   allowed when defining an IP range", with "No more than 2000 IP ranges per
   named location". The step said "as narrow as the network owner's allocation;
   never 0.0.0.0/0" — a /0, which Entra rejects. **Corrected to the real rule**
   (T3). IPv6 format from `ms-ip-named-location`: "IPv4 CIDR format (for example,
   1.2.3.4/32) or any allowable IPv6 format from IETF RFC5969".
5. **Private addresses.** `ms-network`: for a device on a private network the
   address is "the address used by the network to connect to the public
   internet". The step already said "Do not use private LAN ranges"; correct,
   unchanged, and now cited.

**Completion from the scan.** A trusted IP named location exists, and its ranges
are the approved ones. Read from the tenant; nothing is ticked. A re-scan
reopens the step only if the object's own ranges or trusted flag move. On the
follow-up snapshot the step reads **Completed · In place**.

**Acceptance.**
- T1 the create procedure's first line reads `Entra admin center → Entra ID →
  Conditional Access → Named locations`.
- T2 no risk says a trusted location lowers a risk score; one says sign-ins from
  it improve the accuracy of Microsoft Entra ID Protection's risk calculation.
- T3 the create procedure states the mask rule Entra enforces (greater than /8)
  and no longer names `0.0.0.0/0`.
- T4 the step says a trusted location cannot be deleted until the trusted
  designation is removed.
- T5 `more.waits` names every step that waits on this one. The demo's board
  shows four — Give Shared Devices Their Own Policy, Protect Sign-in Method
  Registration, Require a Managed Device Outside the Office and Restrict Service
  Accounts to the Trusted Network — and the line named one. The test reads the
  four steps' own tiles and requires the sentence to name each.
- T6 the package's checked date is 2026-09-20 and its source URL is canonical
  (no `/en-us/`).

---

## 4. `s-prereq-allowed-countries` — Create or Correct Allowed Countries Location

**Outcome.** *One countries named location lists exactly the countries people
work from, decides country by IP address, and leaves a sign-in whose country
cannot be worked out outside the list.*

**Microsoft facts.**

1. **A countries location cannot be marked trusted, so the step must not tell
   anyone not to.** The step's fifth create line read "Do not mark it as
   trusted; it is a list, not a trusted network" — an instruction about a
   control that is not on the blade. `ms-network`'s countries recipe is "Provide
   a Name… Choose to determine location by IP address or GPS coordinates. Add
   one or more countries/regions. Optionally choose to **Include unknown
   countries/regions**" — no trusted option — and only the IP-ranges recipe
   carries "Optionally **Mark as trusted location**". Confirmed in the schema:
   `ms-ip-named-location` has `isTrusted`; `ms-country-named-location` has no
   such property. **Corrected** (A2): the line now says the thing that is true
   and useful — trust belongs to the IP-ranges location, and this one is a list.
2. **What choosing GPS would cost.** `ms-network`: "To use **Determine location
   by GPS coordinates**, users need the Microsoft Authenticator app installed on
   their mobile device. Every hour, the system contacts the user's Microsoft
   Authenticator app to collect the GPS location of their mobile device", and
   "A Conditional Access policy with GPS-based named locations in report-only
   mode prompts users to share their GPS location, not sharing this information
   may result in a block." The step said "Determine location by IP address, not
   GPS" with no reason. **Added** (A3), in one sentence.
3. **IP lookup covers IPv6, from a table Microsoft updates.** `ms-network`:
   "Microsoft Entra ID resolves the user's IPv4 or IPv6 address to a country or
   region, based on a periodically updated mapping table." **Added** (A4) — it
   is the honest form of "IP location can differ from physical location", which
   the step's `aiFocus` already asked for and its words never gave.
4. **The unknown-countries box.** `ms-network`: "Some IP addresses can't be
   mapped to a specific country or region. To capture these IP locations, select
   the box **Include unknown countries/regions**." The step's instruction and its
   risk are both correct; the label is verbatim. Unchanged.
5. `countryLookupMethod` carries `clientIpAddress` (default) and
   `authenticatorAppGps` (`ms-country-named-location`). The correction block's
   careful claim — the v1.0 *update* documentation does not list it as writable —
   is unchanged; the resource listing it is not the same as the update accepting
   it.

**Completion from the scan.** A countries named location exists with exactly the
confirmed countries, decided by IP, unknown excluded. Read from the tenant. On
the follow-up snapshot the step reads **Ready · Create** with an "Allowed
countries · Needs Correction" tile.

**One fact, two sources — fixed.** The row's Impact came from two places that
disagreed: `content.json` `impactLabels['s-prereq-allowed-countries']` =
"Allowed countries" (which is what renders) and the package's
`impact.fallbackLabel` = "Country restrictions" (which never does). Per CLAUDE.md
the two are made one: the package now carries the word the screen shows, and
`stepContentPass.test.ts` reads that word.

**Acceptance.**
- A1 the create procedure no longer tells anyone not to mark a countries
  location trusted, and says where the trusted flag does belong.
- A2 the step says what Determine location by GPS coordinates requires.
- A3 the step says country comes from resolving the address against a mapping
  table Microsoft updates periodically.
- A4 the package's `impact.fallbackLabel` is the word the row draws.
- A5 the package's checked date is 2026-09-20.

---

## 5. `s-goal-geo-restriction` — Block Sign-ins From Countries Not Allowed

**Outcome.** *Nobody signs in to this tenant from a country that is not on the
approved list, and every trip, VPN exit and partner route that crosses it is
accounted for.*

**Baseline reading.** All users with resolved exclusions plus the service
accounts group, All resources, Network include Any network or location and
exclude the approved countries named location, grant Block.

**Microsoft facts.**

1. **Configure: Yes.** `ms-block-location` step 7 sets it. The create procedure,
   the correction procedure and `whatToDoReference` all named Include and
   Exclude without it. **Corrected** (G1).
2. **"Any location" is now "Any network or location".** `ms-network`'s Include
   list. `whatToDoReference` said "Include: Any location". **Corrected** (G2).
3. **The address the policy reads is the proxy's, and XFF is ignored.**
   `ms-network`: "the IP address Microsoft Entra ID uses while evaluating a
   policy is the IP address of the proxy. The **X-Forwarded-For** (XFF) header,
   which contains the user's public IP address, isn't used because there's no
   validation that it comes from a trusted source." The risk said "because the
   policy reads the exit address", which is the symptom without the reason a
   network team will ask for. **Corrected** (G3).
4. **A change bites within the hour, not instantly.** `ms-network`: "By default,
   Microsoft Entra ID issues tokens hourly." The risk said "not the moment the
   list changes" with no figure. **Corrected** (G4).
5. **This policy does not reach a service principal at all.**
   `ms-block-location`, in its own exclusion guidance: "**Calls made by service
   principals aren't blocked by Conditional Access policies scoped to users.**
   Use Conditional Access for workload identities to define policies that target
   service principals." The step excluded a *group* of user-based service
   accounts and never said what it cannot reach. **Added to help desk** (G5) —
   it is the first thing someone concludes wrongly when a sync or an app keeps
   working from abroad.
6. **Directory Synchronization Accounts.** `ms-mfa-strength` step 5.2, for an
   all-users policy: "**If you use hybrid identity solutions like Microsoft
   Entra Connect or Microsoft Entra Connect Cloud Sync, select Directory roles,
   then select Directory Synchronization Accounts**". `ms-ca-users` confirms
   built-in directory roles are selectable. Recorded in §9.2 against the pinned
   baseline, which excludes the exclusions group and the service accounts group
   and not that role. The baseline is not changed (CLAUDE.md: the pinned
   baseline wins); the fact is stated for the person in help desk beside G5.
7. Learn link `policy-block-by-location` (`ms.date` 2026-03-24) is the page that
   carries the procedure. Correct; unchanged.

**Completion from the scan.** The policy is On and matches the target,
assignments and exclusions included, and the blocked sign-ins in the records
were reviewed. A re-scan reopens the step only when the policy's own semantics
move.

**Acceptance.**
- G1 the create and correction procedures set **Configure** to **Yes** before
  naming Include and Exclude.
- G2 no procedure says "Any location"; they say "Any network or location".
- G3 a risk names the X-Forwarded-For header as the reason the proxy's country
  is the one that counts.
- G4 a risk says a token is reissued hourly by default.
- G5 help desk says a call made by a service principal is not blocked by this
  policy, and names where such a policy belongs.
- G6 `doneEnd` is the outcome sentence above.
- G7 the package's checked date is 2026-09-20.

---

## 6. `s-prereq-service-accounts-group` — Create or Correct Service Accounts Group

**Outcome.** *One group holds exactly the user accounts that run unattended
jobs, each one confirmed with the person who owns its workload.*

**Microsoft facts.**

1. **Why a service principal does not belong in it, from Learn rather than from
   assertion.** `ms-block-location`, `ms-mfa-strength` and `plan-conditional-access`
   all carry: "**Calls made by service principals aren't blocked by Conditional
   Access policies scoped to users.** Use Conditional Access for workload
   identities to define policies that target service principals." The step's
   decision help already said service principals do not belong; it now says why,
   in the step's own words.
2. **A group is not a way to reach one either.** `ms-workload-ca`: "While
   service principals can be added to groups, Conditional Access policies
   assigned to a group that contains a service principal are **not enforced for
   that service principal**." This is the exact mistake the group invites, and it
   was stated nowhere. **Added.**
3. **`ms-secure-service-accounts` is the step's Learn link and its `ms.date` is
   2022-08-26.** It is the right topic and it is four years old; it says nothing
   about Conditional Access, Entra Connect or the Directory Synchronization
   Accounts role. Recorded in §9.3. It is **not changed**: `walkContent.mjs`
   ACCEPTANCE C2 pins this step to that URL deliberately, and re-pointing it is
   an owner decision, not a correction.

**The D1 merge, stated instead of hidden.** `frozen-step-suggestions.md` §8:
approving Confirm What You Use adds every account named as a mail-sending device
to `serviceAccountUserIds` and un-rejects any that were rejected here. Nothing
said so, and this step's Completion Criteria — "The group exists with exactly
the confirmed accounts" — then asks for a member nobody picked. The frozen
behaviour is unchanged. What changed is that **this step now says the accounts
named as mail-sending devices in Confirm What You Use are among the confirmed
ones**, so the count a person returns to is explained where they see it (S3).

**One fact said twice, and two of the three names were wrong.** `more.risks[1]`
read "Accounts in this group are outside the legacy, countries and token
policies; the baseline's Block Service Accounts policy pins them to the trusted
network: see Restrict Service Accounts to the Trusted Network", and `more.waits`
read "Block Legacy Authentication, Block Sign-ins From Countries Not Allowed and
Require Token Protection on Windows wait on this." The same three policies,
twice, in one step, in two vocabularies — and the list itself was wrong. Read
off the lane engine on every fixture, the steps that actually wait on this
object are **Restrict Service Accounts to the Trusted Network** (every fixture)
and **Require Token Protection on Windows** (`mid`); Block Legacy
Authentication and Block Sign-ins From Countries Not Allowed never name it.
`more.waits` now says those two, the risk states the consequence without
repeating any list, and the S4 test reads both steps' own tiles so the sentence
cannot drift from the board again.

**Completion from the scan.** The group exists with exactly the confirmed
accounts. The owner confirmation on each member is manual evidence — one of the
V1 §3.3 exceptions — and stays in `doneWhen`.

**Acceptance.**
- S1 the step says a Conditional Access policy assigned to a group is not
  enforced for a service principal in that group.
- S2 the step says why a call made by a service principal is out of a
  user-scoped policy's reach.
- S3 the step says the accounts named as mail-sending devices in Confirm What
  You Use are included in this group.
- S4 the three sibling policies are named once in the step, not twice.
- S5 the package carries a dated Microsoft Learn source (it carried none).

---

## 7. `s-goal-service-accounts-trusted-network` — Restrict Service Accounts to the Trusted Network

**Outcome.** *The user-based service accounts in the group can sign in only from
the approved trusted network, and every job that uses one has been run from
there and recorded.*

Before this wave the step had no `doneEnd`, so while it was held its Completion
Criteria read the shared sentence — "The policy is enforced in Contoso Pty Ltd."
That is the state it is in on both demo snapshots. **`doneEnd` added** (N1).

**Microsoft facts.**

1. **Configure: Yes** on Network, and **Any network or location** as the Include
   label (`ms-block-location`, `ms-network`). The create procedure said
   "Conditions → Network: Include Any network/location" with no Configure step.
   **Corrected** (N2, N3).
2. **What this policy cannot cover, and where that work goes.** `ms-block-location`:
   "Calls made by service principals aren't blocked by Conditional Access
   policies scoped to users. Use Conditional Access for workload identities to
   define policies that target service principals." The manager line already
   said "This does not cover service principals or managed identities"; it now
   points at the policy kind that does, which is the next step in this group.
3. **Learn link.** The step cited `ms-secure-service-accounts` (`ms.date`
   2022-08-26), which documents neither the Network condition nor anything this
   step's procedure does. The technical claim this step makes is about the
   Network condition, and `ms-network` (`ms.date` 2026-04-01) is the page that
   carries it. **Moved** (N4). Create or Correct Service Accounts Group keeps
   `ms-secure-service-accounts` — that step is about *which accounts*, which is
   what the architecture page is about. One fact, one source, each.
4. **A whole ISP range trusts every customer on it** — the step's second risk.
   Supported by `ms-network`'s own instruction to use "your organization's public
   network ranges". Unchanged.

**Completion from the scan.** The policy is On and matches the target. The
tested job from the approved network is manual evidence (`roadmap/manualWork.ts`
records the account, the job, the network and the outcome) — a V1 §3.3
exception, and the step's Workflow Check is where it is recorded.

**Acceptance.**
- N1 `doneEnd` is the outcome sentence above, and it is what the held step draws
  under Completion Criteria.
- N2 the create procedure sets **Configure** to **Yes** on Network.
- N3 no procedure says "Any network/location"; they say "Any network or
  location".
- N4 the step's Learn link is `concept-assignment-network`.
- N5 the manager line names Conditional Access for workload identities as where
  a service principal is covered.
- N6 the package's checked date is 2026-09-20.

---

## 8. `s-goal-workload-identity-block` — Restrict the Entra Connect Sync Account to Its Address

**Outcome.** *The identity that requests tokens for directory synchronisation is
confirmed to be one Conditional Access can cover, and it can request them only
from the sync server's own address.*

**This step is generated by no fixture.** It needs the Workload ID Premium
licence and the Entra Connect answer from D1, and no fixture supplies both, so
it appears in no step snapshot and on the demo it sits under "Not licensed".
Its words still reach the printed plan, the export and the prompt pack, so they
are corrected here; the rendered-state table (§10) says honestly that no
snapshot draws it. Recorded in §9.5.

**Microsoft facts.**

1. **What Conditional Access for workload identities can and cannot target —
   the step's central fact, and it was not stated.** `ms-workload-ca`: "Policy
   can be applied to single tenant service principals that are registered in
   your tenant. **Microsoft and third-party SaaS applications, including
   multitenant apps, are not covered by these policies. Managed identities
   aren't covered by policy.**" `ms-workload-faq` repeats it. The step's `who.none`
   said only that a sync account or provisioning configuration "does not
   establish support for workload Conditional Access", which is a conclusion
   without its rule. **The rule is now stated** (W1).
2. **A group is not a route to a service principal.** `ms-workload-ca`: "While
   service principals can be added to groups, Conditional Access policies
   assigned to a group that contains a service principal are not enforced for
   that service principal. To enforce a Conditional Access policy for a service
   principal, it must be assigned directly to the policy as a workload
   identity." **Added to the risks** (W2) — the sibling step in this group
   targets exactly such a group, so this is the fact that keeps the two apart.
3. **Block is the only grant.** `ms-workload-ca`: "Under **Grant**, **Block
   access** is the only available option." The procedure said "Under **Grant**,
   select **Block access**" as though it were a choice. **Corrected** (W3).
4. **Configure: Yes** on the location condition, and the label. `ms-workload-ca`
   itself still says "Under **Conditions** > **Locations**" while `ms-network`
   says the condition is now **Network**; the two Microsoft pages disagree with
   each other. The procedure now names both, the way Block Sign-ins From
   Countries Not Allowed already does, and sets Configure to Yes (W4). Recorded
   in §9.4.
5. **The two sync identities are not the same identity.** `ms-connect-accounts`:
   Entra Connect Sync's connector account is "granted a special Directory
   Synchronization Accounts role… **The Microsoft Entra admin center shows this
   account with the User role**" — a user. `ms-cloud-sync-faq`: "cloud sync
   creates a service principal for the provisioning configuration with the
   domain name as the service principal name" — a service principal. Only the
   second can be a workload-identity policy's target; only the first can be
   reached by a user policy. The step's title names the first and its policy
   targets the second. The **body now states the distinction plainly**; the
   **title is left alone** and the question is recorded in §9.6.
6. **The role itself.** `ms-roles` on Directory Synchronization Accounts: "**Do
   not use.** This role is automatically assigned to the Microsoft Entra Connect
   service, and is not intended or supported for any other use."
   `ms-security-defaults`: those accounts "are excluded from security defaults
   and aren't prompted to register for or perform multifactor authentication.
   Organizations shouldn't be using this account for other purposes." Recorded;
   it is the reason §5.6's exclusion exists.
7. **Licence.** `ms-workload-ca`: "**Workload Identities Premium licenses are
   required to create or modify Conditional Access policies scoped to service
   principals.** In directories without appropriate licenses, existing
   Conditional Access policies for workload identities continue to function, but
   can't be modified." The SKU's own name in `ms-workload-faq` is "Microsoft
   Entra Workload ID Premium", which is what the step's `licence` field says.
   Correct; unchanged.

**Completion from the scan.** The policy is On and matches the target, and the
sync workflow succeeds. The second half is manual evidence: a scan cannot see a
provisioning run succeed. `doneWhen` already said so and still does.

**Acceptance.**
- W1 the step states that a workload-identity policy covers a single-tenant
  service principal registered in this tenant, and not a Microsoft or
  multitenant application or a managed identity.
- W2 a risk states that a policy assigned to a group is not enforced for a
  service principal in it.
- W3 the procedure says Block access is the only grant available.
- W4 the procedure sets **Configure** to **Yes** and names the condition by both
  its names.
- W5 the step says the Connect Sync account and the Cloud Sync provisioning
  service principal are two different identities.
- W6 the row's Impact is a word about this step — "Directory synchronisation",
  added as the package's `impact.fallbackLabel` — not the "Tenant settings"
  placeholder `rowWho.ts` falls back to.
- W7 the package's checked date is 2026-09-20.

---

## 9. Recorded for the owner

1. **Learn never writes down what Network's Configure: No means.** It says the
   toggle exists and sets it to Yes in its own procedures, and it says
   "Conditional Access policies apply to all locations by default" — but the
   explicit "when set to No it applies to all…" sentence exists only for Client
   apps (`ms-ca-conditions`). This wave follows the procedure and claims no more
   than Microsoft states.
2. **Microsoft against the pinned baseline, Block Sign-ins From Countries Not
   Allowed.** `ms-mfa-strength`'s recipe for an all-users policy says to exclude
   the **Directory Synchronization Accounts** directory role where Entra Connect
   or Cloud Sync is in use. The pinned baseline's countries policy excludes the
   exclusions group and the service accounts group, and not that role. The
   baseline is unchanged; the fact is on the step.
3. **`secure-service-accounts` is four years old** (`ms.date` 2022-08-26) and is
   the pinned Learn link for Create or Correct Service Accounts Group
   (`walkContent.mjs` ACCEPTANCE C2). It is the right topic and it predates
   every Conditional Access fact this group depends on. Re-pointing it is an
   owner decision.
4. **Two Microsoft pages name the same condition differently.** `ms-network`
   says the Location condition was renamed **Network**; `ms-workload-ca` still
   says **Conditions > Locations**. Both procedures in this group now name both.
5. **`s-goal-workload-identity-block` is in no fixture**, so it has no step
   snapshot and renders on no demo scan. It is the same shape as the
   `s-question-mail-devices` finding in `close-doors-spec.md` §7.4, without the
   fold: this step is real, the fixtures simply never grant Workload ID Premium
   alongside the Entra Connect answer. A fixture that does would be the honest
   fix, and it is a fixture change, not a step change.
6. **The translator still writes the old label.** `src/roadmap/portalLines.ts`
   composes the resolved settings line as `Conditions → Locations → Include: Any
   location; Exclude: …` from the pinned baseline, for every policy step in
   every group, and `scripts/walk.mjs` matches that exact sentence. The portal
   procedures in this group now say **Network** and **Any network or location**,
   as Microsoft does; the translator's line beneath them still says Locations
   and Any location. Changing it moves every policy step and the walk's reading
   with them, so it is the anatomy's, not this group's.
7. **The step's title names a different identity from its policy.** "Restrict
   the Entra Connect Sync Account to Its Address" names a user account with the
   Directory Synchronization Accounts role; the policy targets Cloud Sync's
   provisioning service principal, and a workload-identity policy cannot target
   the former. `step-redundancy-analysis.md` finding 12 already proposed a
   rename for a different reason ("Restrict …" reads as a sibling of the step
   above it). The body now states the distinction; the title is the owner's.

---

## 10. Rendered at 1280, on the demo and the follow-up scan

Read on `http://localhost:5210/planner/?demo=1#/plan`, 2026-09-20. Every state
this group's steps reach on those two snapshots, and what it says now.

| State | Step and snapshot | What it reads |
|---|---|---|
| Ready to create an object | Define the Trusted Network, initial | «Ready · Create · Sep 21, 2026». Why states the trust fact; the Entra procedure opens at `Entra ID → Conditional Access → Named locations` and states the mask rule; Done when opens on the outcome. |
| The same object, already in place | Define the Trusted Network, follow-up | «Completed · In place · Already in place». The body is unchanged; Done when reads the outcome. |
| Ready to create, with a correction waiting | Create or Correct Allowed Countries Location, follow-up | «Ready · Create» beside an «Allowed countries · Needs Correction» tile. The create procedure no longer warns against a trusted flag the blade does not have. |
| Held policy, waiting on its object | Block Sign-ins From Countries Not Allowed, both | «On Hold · After prerequisites». The policy card's next check names Create or Correct Allowed Countries Location; Completion Criteria is now the outcome sentence, not the shared one. The create task sets **Configure: Yes**. |
| Held policy, waiting on two objects | Restrict Service Accounts to the Trusted Network, initial | «On Hold». Three prerequisite cards; Completion Criteria now reads this step's own end state instead of «The policy is enforced in Contoso Pty Ltd.» |
| The same, with a baseline mapping tile | Restrict Service Accounts to the Trusted Network, follow-up | «On Hold», with «Baseline mapping · Define the Trusted Network». Same words. |
| Not licensed | Restrict the Entra Connect Sync Account to Its Address, both | «needs a licence this tenant does not hold: Microsoft Entra Workload ID Premium». No body is drawn on either snapshot (§9.5); its corrected words reach the printed plan, the export and the prompt pack. |
| Ready, object with no tiles | Create or Correct Service Accounts Group, both | «Ready · Create». Why states the unattended-job fact; Done when opens on the outcome and keeps the owner confirmation. |

**Three cards, one wait — left alone, and why.** On Block Sign-ins From
Countries Not Allowed the same prerequisite is stated three times: the policy
card's next check ("Create or Correct Allowed Countries Location first: this
policy names an object Contoso Pty Ltd does not have yet"), the Affected people
card ("Policy scope awaits: Create or Correct Allowed Countries Location") and a
dedicated "Prerequisite · To do" card. This is
`step-redundancy-analysis.md` finding 3, and all three sentences come from
producers shared by every policy step — `shared.engine.*.jsonWaits`,
`stepContract.ts` and `planLanes.ts`. Changing them is an anatomy change that
moves every policy step in every group, so it is written up in
`policy-anatomy-deviations.md` §8 and not built here. What this wave did fix is
the duplication that is this group's own: the three policy names said twice
inside Create or Correct Service Accounts Group (§6).

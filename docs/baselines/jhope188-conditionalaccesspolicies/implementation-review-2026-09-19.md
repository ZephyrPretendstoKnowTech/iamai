# Implementing Jon Hope's CA baseline: a policy-by-policy review

**Source:** `Jhope188/ConditionalAccessPolicies` at `90d9b89` (3 September 2026). That is the only branch, and it is still the latest commit on 19 September, so there's no newer version to compare against. IAMAI pins this same commit.

**What was read:** every file in the repo and all 128 commits.
- The 38 exported policies under `Updated/Policies`.
- Every per-policy README.
- The naming guide (`README.md`).
- The three PowerPoint decks.
- Jon moved one policy, "O365 - Timeoutsettings", to a `Test` folder on 2 June "to exclude from template". It isn't part of the baseline and isn't reviewed here.

**The view taken:** we implement this baseline in a customer tenant. For each object and each policy:
- what Jon's export does;
- how we interpret it;
- what doesn't add up.

The questions for Jon are at the end, written for you to send as yourself.

---

## 1. Objects to create before any policy

Jon's policies reference objects by their IDs in his tenant. Each one has to become an object in the customer's tenant, or be dropped.

### Settled: we know what it is, and we create or reuse the customer's own

| Jon's ID | What it is | Evidence | How we implement it |
|---|---|---|---|
| `b63c3682-06c6-45f0-9692-ee76b604b4f9` | **Break-glass exclusion group** | Excluded from 32 of 38 policies. The old deck's `Azure-Breakglass` has the same pattern. 20+ README audit lines "Break-glass group excluded ✓" track it. | The customer's **emergency exclusions group** (Establish Emergency Access, Step 2), excluded from every policy. |
| `CA-GlobalExclusions-GroupID-ReplaceMe` | A placeholder Jon left in Intune Enrollment | The naming guide defines CA-GlobalExclusions as the break-glass or exception group. | The same emergency exclusions group. |
| `6612d6d7-12c8-4cbd-8ad5-7460ae2a6579` | **CA-ServiceAccounts** | The only group included by the Service Accounts block. The README names it. | The customer's service accounts group ("Create or Correct Service Accounts Group"). |
| `0403d368-f07f-4e4c-b75d-aa169d5b6683` | **Trusted network** (named location "IAC - Trusted Locations (IP)") | Named in two READMEs. | The customer's trusted IP location ("Define the Trusted Network"). |
| `1d421232-4f10-4436-9883-27d9bd3f64cd` | **Allowed countries** (named location "IAC - AllowedCountries") | Named in the Countries README. | The customer's allowed-countries location. |
| `42de22a7-5339-4a58-b560-28565d53b14d` | **Custom authentication strength "Modern MFA + TAP"** | Embedded in 11 policies. Combinations: Windows Hello for Business, FIDO2/passkey, certificate MFA, TAP one-time, TAP multi-use. | Recreated in the customer's tenant ("Create the Baseline's Authentication Strength"). See issue F on multi-use TAP. |
| `8d0564e5-ab28-4283-9a94-9883c581adde` | **EAM group** (people routed to external authentication) | Named in the risk-remediation READMEs. | Only used by the EAM risk policy, which we don't implement. |

### Probably known: the pattern fits, but Jon should confirm

| Jon's ID | Best reading | Evidence | Default until he answers |
|---|---|---|---|
| `2d25c298-555e-4f26-9984-90dfb7eae325` | **CA-DeviceExclusions** | Excluded only from Require Compliant Device and Device Registration. The deck's CA-DeviceExclusions sits on exactly the Intune device policies. | Dropped: no device exclusion unless the customer asks. |
| `cc7f9bb7-425b-42fc-b025-311a1a3eb0f4` | **CA-TravelingUsers** | Excluded only from Countries not Allowed. That's the deck's CA-TravelingUsers pattern. | IAMAI's travel-exception handling, not a copied group. |
| `e663a7ce-daec-4062-88b8-5970bfec8019` | **An admin accounts group** | Excluded from MFA-AllUsers (admins get the stronger AllAdmins policy) and the Admin Portal block (admins keep portal access), but **not** from MFA-AllAdmins. Also on Auth Transfer, SharePoint off-network, the Service Accounts block and "AllApps - Exclude CA-Global". | See issue B (Admin Portal). |
| `9ee031a3-3551-4bc3-a81d-d6f0149ae329` | **A service-accounts or AVD exception group** | Excluded from SharePoint off-network and both AVD policies. The deck had CA-ServiceAccounts on exactly those three, which clashes with `6612d6d7` being CA-ServiceAccounts. | Only on policies we don't implement. |
| `902993ed-96f7-4af6-825c-510dfc97b258` | **AllowedAVDUsers**, or CA-Azure-DevOps-Users | Excluded only from "AVD - Exclude - AllowedAVDUsers". | Only on a policy we don't implement. |
| `1178bb5d-4f19-4b69-b33b-44eb7f5b39c9` | **A pilot group** for passkey registration | The only group included by MFA-Passkey - UserRegistration. | That policy isn't implemented (issue E). |
| `5f96c57d-380f-4872-97ff-cfd74ef1ac1a` | **An admin pilot group**, probably `ACME-ADM-Users-Dynamic` from the naming guide | The only group included by MFA-Passkeys - ADM-Users. | IAMAI targets admins by directory role (MFA-AllAdmins), not by a group. |

### Unknown: nothing explains it

| Jon's ID | What we can see | Default |
|---|---|---|
| `62d67e66-2bc9-43cd-b00c-6326dae53d18` | Excluded from **23** policies: MFA for users and admins, the legacy auth, device code and auth transfer blocks, sessions, token protection, Intune, admin portal, ZTCA and Inforcer. **Not** excluded from the guest, risk, PIM, agent or Entra Connect policies. No README, naming guide entry or commit names it. | **Ignored.** Today IAMAI holds 14 policies until someone maps it. Ignoring it writes those policies without this exclusion, which is stricter. |
| `5628ad67-f9d1-4495-abe3-99dc8f9074f1` | Four READMEs call it "Break-glass". It appears only in the five policies added 28 Aug to 2 Sep. | See issue A. |

**Also in the export, but not IAMAI objects:**
- `1267ac22-…` "IAC - Blocked Countries" and `0de51b52-…` (Entra Connect IPs) are named locations, used only by policies we don't implement.
- `cec6164b-…` and `ebb6b745-…` are individual user accounts in the break-glass policy (issue G).
- `36f1bcde-…` is his Entra Connect sync service principal (a policy-specific decision).

---

## 2. Every policy

**Rules for all of them:**
- Every policy is created **report-only** first, whatever state Jon exported. Enforcement comes later, through the plan's gates.
- Jon's objects are replaced by the customer's own, as in §1.

### Implemented (22 goals, 23 policies)

| # | Jon's policy (his state) | What it does | Our interpretation | Issues |
|---|---|---|---|---|
| 1 | **GLOBAL - GRANT - MFA - AllUsers** (report-only) | All users, all apps, require MFA. Excludes Rights Management and Intune Enrollment apps. Excludes break-glass, `62d67e66` and `e663a7ce`. | Require MFA for Everyone. The break-glass exclusion becomes the customer's; the unknown group is dropped. | If `e663a7ce` is the admin group, admins are covered by #2 instead. The customer has no such group, so admins simply stay in this policy as well, which is harmless. |
| 2 | **GLOBAL - GRANT - MFA - AllAdmins** (**enabled**) | 46 admin roles, all apps, require the custom strength. Excludes break-glass and `62d67e66`. | Require Phishing-Resistant MFA for Admins, using the customer's strength. | The strength allows **multi-use TAP** (issue F). |
| 3 | **ZTCA - GLOBAL – BLOCK – Admin Portal** (report-only) | All users, block the admin portals (MicrosoftAdminPortals, Azure Service Management, Purview, My Staff, Inforcer Integration). Excludes 4 apps (Windows Azure Active Directory, App Access Panel, AADReporting, My Profile) and the service-provider guest type. Excludes break-glass, `62d67e66` and `e663a7ce`. | **Held today.** The README says "for non-admin users", but the policy targets All users with no role exclusion. Literal = every admin locked out; README = an exclusion is missing. | **Issue B.** If `e663a7ce` is his admin group, we'd exclude the admin **roles**, and this becomes safe to deliver. |
| 4 | **GLOBAL - GRANT - MFA - Mixed-Guests** (report-only) | Guests (B2B collaboration guest, other external), require MFA. Excludes break-glass. | Require MFA for Guests, part one. | — |
| 5 | **GLOBAL - GRANT - MFA - B2B-Guest** (report-only) | Internal guests, B2B members, B2B direct connect and **service providers**; require the custom strength. | Require MFA for Guests, part two. | **Issue H:** the strength's methods mostly can't be satisfied by external users. |
| 6 | **GLOBAL – BLOCK - Legacy Authentication** (**enabled**) | All users, Exchange ActiveSync and other legacy clients, block. | Block Legacy Authentication. The service accounts and mail-sending devices questions gate enforcement. | — |
| 7 | **GLOBAL - BLOCK - Device Code Auth Flow** (**enabled**) | All users, device code flow, block. | Block Device Code Sign-in. | — |
| 8 | **GLOBAL - BLOCK - Authentication Transfer** (report-only) | All users, authentication transfer, block. Also excludes `e663a7ce`. | Block Authentication Transfer. | — |
| 9 | **GLOBAL – BLOCK – Countries not Allowed** (**enabled**) | All users, all locations except allowed countries, block. Also excludes `cc7f9bb7` (travellers). | Block sign-ins from countries not allowed, with the customer's allowed countries and travel exceptions. | — |
| — | **GLOBAL – BLOCK – Countries not Allowed - NoExclusions** (**enabled**) | Blocks the "Blocked Countries" list. Despite its name, it still excludes break-glass and `62d67e66`. | Treated as a variant of #9, not a separate goal. | Minor: the name says "NoExclusions". |
| 10 | **GLOBAL – SESSION – Admin Persistence (4 Hours)** (**enabled**) | 46 admin roles, browser only: sign-in every 4 hours, never persistent. | Shorten Admin Sessions. | — |
| 11 | **GLOBAL – SESSION – All Users Persistence (9-12 Hours)** (report-only) | All users, browser only: sign-in every 12 hours, never persistent. | Limit How Long Sessions Last. | — |
| 12 | **INTUNE - GRANT - RequireCompliantDevice** (report-only) | All users, outside trusted locations: require a compliant **or** hybrid-joined device. Also excludes `2d25c298` (device exclusions). | Require a Managed Device Outside the Office, after the device decision. | — |
| 13 | **GLOBAL - BLOCK - Unsupported Device Platforms** (**enabled**) | All users, any platform except Android, iOS, Windows and macOS: block. That blocks Linux. | Block Unsupported Device Platforms. | Worth telling customers that Linux is blocked. |
| 14 | **INTUNE – GRANT – Device Registration - MFA Strength** (report-only; changed 2 Sep) | All users, the "register or join devices" action, require the custom strength. Excludes break-glass, `62d67e66`, `2d25c298` **and** `5628ad67`. | Require MFA to Register a Device. **IAMAI deliberately uses the built-in MFA requirement**, because Jon's own README says the Device Registration Service only honours "Require MFA". | **Issue D:** his README contradicts his policy. |
| 15 | **GLOBAL - SESSION - Windows - TokenProtection** (report-only) | All users, Windows, mobile and desktop apps; token protection for Exchange, SharePoint, Teams, Windows 365 and AVD. Cloud PCs are excluded by device filter. | Require Token Protection on Windows. | IAMAI reads the Microsoft app IDs as missing objects (our bug, not his). |
| 16 | **GLOBAL – BLOCK – Service Accounts** (report-only) | Service accounts group, everywhere except the trusted network: block. Excludes break-glass, `62d67e66` and `e663a7ce`. | Restrict Service Accounts to the Trusted Network. | Why would admins (`e663a7ce`) need excluding from a service-accounts-only policy? Harmless, but odd. |
| 17 | **WORKLOAD - BLOCK - EntraConnectIDSync - ExcludeEntraConnectIP** (report-only) | His Entra Connect sync service principal, outside its IPs: block. | Restrict the Entra Connect Sync Account to Its Address, with the customer's sync identity and IPs. | Service principal and IPs are tenant-specific. |
| 18 | **APP - SESSION - IntuneEnrollment-SIFEveryTime** (report-only) | All users, the Intune Enrollment app: sign in every time. Excludes the placeholder `CA-GlobalExclusions-GroupID-ReplaceMe`. | Require a Fresh Sign-in for Intune Enrollment, with the emergency exclusions group. | **Issue C:** the only policy with a placeholder rather than an ID. |
| 19 | **P2 - GLOBAL - GRANT - High-Risk Sign-Ins** (report-only) | All users, high sign-in risk: require the custom strength, sign in every time. | Challenge High-Risk Sign-ins. | — |
| 20 | **P2 - GLOBAL - GRANT - Medium-Risk Sign-Ins** (report-only) | All users, medium sign-in risk: require MFA. | Challenge Medium-Risk Sign-ins. | — |
| 21 | **P2 - GLOBAL - GRANT - High-Risk Users - Risk Remediation** (**enabled**) | All users, high user risk: risk remediation **and** the custom strength, sign in every time. Excludes `5628ad67` and the EAM group, **but not the main break-glass group `b63c3682`**. | Remediate High-Risk Users. | **Issue A.** |
| 22 | **P2 - GLOBAL - GRANT - Medium-Risk Users** (**enabled**) | All users (all guest types excluded), medium user risk: password change **and** the custom strength. | Reset Passwords for Medium-Risk Users. | README labels `b63c3682` "EAM users" and `5628ad67` "Break-glass" (issue A). |
| 23 | **P2 - APP - SESSION - PIM - Reauthentication** (report-only) | All users, authentication context c1: custom strength, sign in every time. | Require MFA at Every Role Activation, with the customer's authentication context. | — |

### Not implemented (14 Cleanup rows, "not assessed")

These aren't part of IAMAI's plan. Listed so nothing in the baseline is unaccounted for.

| Jon's policy (his state) | What it does | Notes |
|---|---|---|
| AGENT - BLOCK - HighRiskAgent (report-only) | Block high-risk agent identities; users "None" | Agent ID preview. His repo has it twice under two file names. |
| AGENT - BLOCK - NonTrustedAgents (report-only) | Block untrusted agents | Agent ID preview. |
| APP - BLOCK - SharePoint-OneDrive-NonTrustedLocations (report-only) | Block SharePoint outside trusted locations | Excludes `9ee031a3` and `e663a7ce`. |
| APP - inforcer - RequireMFA (report-only) | Require MFA for the Inforcer app | Only relevant to Inforcer customers. Excludes `62d67e66`. |
| APP – BLOCK – AVD - Exclude - AllowedAVDUsers (report-only) | Block AVD and Windows 365 except allowed users | Excludes `9ee031a3` and `902993ed`. |
| APP – BLOCK – AVD - NonTrustedLocations (report-only) | Block AVD and Windows 365 outside trusted locations | Excludes `9ee031a3`. |
| GLOBAL - GRANT - BreakGlass - TrustedLocations (report-only) | Break-glass (one named user) outside trusted locations: custom strength | **Issue G.** |
| GLOBAL - GRANT - MFA - WindowsAzureAD-BaselineScopes (report-only; added 28 Aug) | All users, the Windows Azure AD resource: custom strength | Excludes **only** `5628ad67` (issue A). |
| GLOBAL - GRANT - MFA-Passkey - UserRegistration (report-only) | Pilot group, **register device** action, **iOS only**: custom strength | **Issue E.** |
| GLOBAL - GRANT - MFA-Passkeys - ADM-Users (report-only) | Admin pilot group, all apps: custom strength | Overlaps with MFA-AllAdmins. |
| P2 - GLOBAL - BLOCK - RiskyUsers - RegisterSecurityInfo (report-only) | High or medium user risk, register security info: block | — |
| P2 - GLOBAL - GRANT - EAM - High-Risk Users - Risk Remediation (**enabled**) | EAM group, high user risk: MFA and risk remediation | External authentication customers only. |
| ZTCA - INTUNE - BLOCK - AllApps - ExcludeTrustedLocation (report-only) | Block all apps from non-compliant devices outside trusted locations | A zero-trust extreme; out of scope. |
| ZTCA - GLOBAL - BLOCK - AllApps -Exclude CA-Global (report-only) | Block **everything** for everyone except three groups | A zero-trust extreme. Its name suggests one of its excluded groups is "CA-Global". |

### Goals IAMAI has that his baseline doesn't cover (5)

His baseline has no source policy for these IAMAI goals:
- **Covered by IAMAI's own authored packages:** Protect Sign-in Method Registration, Mobile app protection, and Azure management MFA.
- **No package yet:** BYOD session controls, and Block downloads on unmanaged devices.

---

## 3. What doesn't add up

- **A. Two different break-glass groups.**
  - Every policy from his May upload excludes `b63c3682`.
  - The five policies added 28 Aug to 2 Sep use `5628ad67`, and their READMEs call it "Break-glass". The same READMEs call `b63c3682` "Additional exclusion" or "EAM users".
  - As a result, **High-Risk Users - Risk Remediation** and **WindowsAzureAD-BaselineScopes** don't exclude `b63c3682` at all. If `b63c3682` is his break-glass group, those two policies could lock break-glass out on a high-risk flag or Windows Azure AD access. That would be a real error in his baseline.
  - Most likely those five were built in a different tenant.
  - *For us:* no risk. We use the customer's emergency group everywhere.
- **B. The Admin Portal scope.**
  - The README says "for non-admin users", but the policy is All users with no role exclusion.
  - It's safe only if `e663a7ce` is an admin group, which the pattern suggests.
  - *For us:* held until confirmed; then deliverable with the admin roles excluded.
- **C. The Intune Enrollment placeholder.** `CA-GlobalExclusions-GroupID-ReplaceMe` suggests either that CA-GlobalExclusions isn't `b63c3682`, or that the policy came from a template.
- **D. Device Registration.** His README says the Device Registration Service only honours "Require multifactor authentication", yet the policy uses a custom authentication strength.
  - *For us:* we use Require MFA. Worth confirming he agrees.
- **E. The passkey registration policy.**
  - The README intent is "before users can register new security information (passkeys, authenticator app, FIDO2 keys)".
  - The policy uses the **register or join devices** action (`urn:user:registerdevice`), not **register security information** (`urn:user:registersecurityinfo`).
  - It's scoped to **iOS only** and one pilot group. His own audit line flags the iOS-only condition: "user-agent spoofing risk".
  - This looks like a wrong user action.
- **F. Multi-use Temporary Access Pass in the admin strength.** "Modern MFA + TAP" allows a multi-use TAP. It satisfies MFA-AllAdmins, risk remediation and PIM. A multi-use TAP is a reusable code, weaker than the phishing-resistant methods beside it. Is that intended for admins?
- **G. The break-glass trusted-locations policy.**
  - The README says break-glass can sign in "only from trusted network locations".
  - The policy doesn't block anything: outside trusted locations it requires the custom strength, which includes TAP. It also targets one account by user ID.
  - *For us:* not implemented. Emergency access is IAMAI's own four-step design.
- **H. The guest strength.** B2B-Guest requires "Modern MFA + TAP" for B2B members, direct connect users and **service providers**.
  - A TAP can't be issued to external users.
  - The other methods need the partner's home tenant to do phishing-resistant MFA, and this tenant to trust it.
  - Enforced as exported, partners and MSP technicians could be blocked. Was cross-tenant trust assumed?
- **I. The two "unknown" standing exclusions,** `62d67e66` (23 policies) and `e663a7ce` (6), never named anywhere, alongside a naming guide that says CA-GlobalExclusions should be on **all** policies.
- **Minor:**
  - "Countries not Allowed - NoExclusions" has exclusions.
  - "HighRiskAgent" exists twice under two file names.
  - The Service Accounts block excludes the probable admin group.

---

## 4. Questions for Jon

*Written for you to send as yourself. Most important first. Plain language, no tool talk.*

> Hey Jon, I've been working through your CA baseline (latest commit, 3 Sep) to implement it in a couple of tenants. Great work. I hit a few things I couldn't work out from the repo, and a couple that look like they might be mistakes. Hoping you can help.
>
> **The groups.** Your naming guide names the CA groups but the exports only carry IDs, so I matched them by where they're excluded. Can you confirm or correct?
> - `b63c3682-06c6-45f0-9692-ee76b604b4f9`: your break-glass group? It's on almost every policy.
> - `2d25c298-555e-4f26-9984-90dfb7eae325`: CA-DeviceExclusions? It's only on the two Intune device policies.
> - `cc7f9bb7-425b-42fc-b025-311a1a3eb0f4`: CA-TravelingUsers? It's only on Countries not Allowed.
> - `e663a7ce-daec-4062-88b8-5970bfec8019`: your admin accounts group? It's excluded from MFA-AllUsers and the Admin Portal block, but not from MFA-AllAdmins.
> - `62d67e66-2bc9-43cd-b00c-6326dae53d18`: this one I can't place at all. It's excluded from 23 policies, but not from the guest, risk or PIM ones. Is it CA-GlobalExclusions, something Inforcer-specific, or something I can skip?
> - `9ee031a3-3551-4bc3-a81d-d6f0149ae329` and `902993ed-96f7-4af6-825c-510dfc97b258`: the AVD/SharePoint exceptions. Service accounts, AllowedAVDUsers, or DevOps users?
> - `1178bb5d-4f19-4b69-b33b-44eb7f5b39c9` and `5f96c57d-380f-4872-97ff-cfd74ef1ac1a`: the groups the two passkey policies target. Pilot groups? Should those policies end up on all users and all admins?
>
> **Things that look off:**
> 1. **Two break-glass groups?** Everything from May excludes `b63c3682`. The five policies you added late August (BaselineScopes, both High-Risk Users remediation, Medium-Risk Users, Device Registration - MFA Strength) use `5628ad67-f9d1-4495-abe3-99dc8f9074f1` instead, and the READMEs call that one break-glass. High-Risk Users - Risk Remediation and BaselineScopes don't exclude `b63c3682` at all. Different tenant for those, or should they have both?
> 2. **Admin Portal:** the README says it blocks non-admins, but the policy targets All users with no admin role excluded. Is `e663a7ce` meant to be the admin exclusion there, or should it exclude the admin roles?
> 3. **MFA-Passkey - UserRegistration:** the README says it protects registering security info (passkeys and so on), but the policy uses the "Register or join devices" action, and only on iOS. Should that be "Register security information", without the platform condition?
> 4. **Device Registration - MFA Strength:** your README says the Device Registration Service only honours "Require MFA" as a grant, but the policy uses the Modern MFA + TAP strength. Which should people use?
> 5. **Modern MFA + TAP** allows multi-use TAP, and it's the strength on AllAdmins, risk remediation and PIM. Intentional for admins, or should admins be one-time TAP (or no TAP)?
> 6. **B2B-Guest** requires Modern MFA + TAP for B2B members, direct connect and service providers. External users can't be given a TAP, and they'd need phishing-resistant MFA at home plus inbound trust. Is that the expectation, or would partners and MSPs get blocked?
> 7. **Intune Enrollment** still has `CA-GlobalExclusions-GroupID-ReplaceMe`. Which group should go there?
> 8. **BreakGlass - TrustedLocations:** the README says break-glass is only allowed from trusted locations, but the policy requires the strength outside them rather than blocking. Which did you intend?
>
> No rush. Thanks!

---

## 5. Jon's answers (19 September 2026, by chat)

In his words, lightly trimmed, then what each one changes for IAMAI.

1. **Groups.** "Documentation is probably out of date as my standards have been updated… I am going to update it with new standard names and clean up old group conventions as I have migrated twice now. The correct group should be SG-Entra-AUG-CAP-BreakglassAccounts. I will have Claude resolve all GUIDs to names in the documentation."
   - **For IAMAI:** the two break-glass ids (`b63c3682`, `5628ad67`) come from his two migrations. Both mean the break-glass exclusion, which IAMAI already replaces with the customer's emergency exclusions group on every policy.
   - The standing exclusions nobody can name (`62d67e66` and the other old conventions) are migration leftovers. Per the owner's rule, a reference with no basis is dropped.
   - His name-resolved documentation, due next week, will confirm or flip the rest.
2. **The Admin Portal block is a Zero Trust (ZTCA) policy, used for incident response.** "This is a hard block for the org… extremely hard to deploy without impact. I use all the ZTCA as an incident response mechanism, so they are in place and created ahead of time but not on. In the event of mass compromise, immediately turn on the ZTCA with only explicit access from a trusted source and everyone else gets blocked. You don't want to be building that logic during the event."
   - **For IAMAI:** the three ZTCA policies are a lockdown kit, not rollout policies:
     - Admin Portal;
     - AllApps - Exclude CA-Global;
     - Intune AllApps - ExcludeTrustedLocation.
   - They're created ahead of time, never switched on by the plan, and paired with a runbook for switching them on. They leave the "Protect admins" wave.
3. **Revoking tokens at scale.** He wrote a script for it, but "that's gotten easier with Entra and honestly Inforcer". **For IAMAI:** it's a runbook line in the lockdown kit ("revoke every session"), not a step.
4. **Multi-use TAP.** "I have started to change my stance on multi-use TAP and changed to single use."
   - **For IAMAI:** the recreated "Modern MFA + TAP" strength allows the one-time TAP only.
   - This is an author-confirmed change from the pinned export, and it's shown beside the baseline's version.
5. **Guests and risk.** "My intention is to block guest accounts from Risk. I have no way to satisfy risk in my tenant, and if they are risky in their own tenant, then I don't want them interacting in mine."
   - **For IAMAI:** a risky guest is blocked by design, which is what the exported risk policies already do.
   - The step says so plainly, so an admin doesn't read it as a lockout bug.
6. **Still open:** the passkey registration question (issue E). He asked which README was meant. The follow-up names the file.

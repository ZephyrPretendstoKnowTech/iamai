# IAMAI: leverage research (phishing-resistant MFA, passkeys, positioning)

Researched 2026-09-18. Every date below is as published by the source; Microsoft dates move, so re-check
before any public claim. "Verified" means read on the primary page today; "secondary" means a
practitioner or news source only.

---

## Executive summary

1. **The market moment is real, and it is dated.** On 2026-07-13 Microsoft announced that passkeys are
   the default in Entra ID and that its own SMS and voice delivery is retiring. Since **2026-09-01**
   everyone enabled for SMS or voice has been auto-enabled for passkeys and nudged at MFA. From
   **2027-02-01**, anyone whose only MFA method is SMS or voice gets a **blocking** passkey registration
   prompt, with no opt-out. For Global Administrators and external users the date is **2027-07-01**
   (verified, Learn, updated 2026-09-16).
2. **Microsoft's own tool for "who is affected" works at policy level only.** The official
   `entra-sms-voice-usage-analyzer` script lists which policies and groups have SMS or voice enabled.
   It does not expand groups, read registered methods or read sign-ins (verified). Nothing Microsoft
   ships answers "which people, on which devices, will hit the blocking prompt, and what should each
   of them do". IAMAI already holds the data to answer that without a new permission. This is the
   strongest pitch available.
3. **Microsoft's deployment guide describes IAMAI's model.** It tells admins to "build a report of
   all your user/device pairs by using sign-in data". Its tool for that is a workbook that needs sign-in
   logs exported to Log Analytics (Azure Monitor), so it only has data from the day export was turned
   on. IAMAI reads the 30 days Graph already holds, in the browser, on day one.
4. **The Microsoft passkey nudge is judged per OS and browser.** The registration-campaign doc (updated
   2026-09-15) has a table saying which credential stops the nudge on which platform. This is the same
   idea as IAMAI's "Seamless on every device". IAMAI can cite that table as its authority and predict
   who will be nudged on which device.
5. **The main competitor is Microsoft's Conditional Access Optimization Agent.** Its passkey adoption
   campaigns are in public preview (since March 2026). They are real, but limited: they cover privileged
   admin roles only, up to 200 users; they need Security Copilot capacity (SCUs) and the Security
   Administrator role; they write to the tenant (Teams messages, groups, a report-only CA policy); and
   they do not check that the users are enabled for passkeys. Security Copilot is now included with
   M365 E5 (secondary sources), so E5 tenants will see it. **Position IAMAI as the free, read-only,
   whole-organisation view that explains why, and that complements the agent.** Don't frame it as a
   rival.
6. **Leads to act on that need no new consent** (all under scopes IAMAI already holds):
   - registration-campaign state and targets, and the `passkeyDynamicMigration` opt-out flag;
   - SMS and voice method configuration, combined with per-person phone methods and "Text message" or
     "Phone call" sign-in evidence;
   - Windows Hello for Business and macOS Platform Credential method objects, which name the device;
   - beta `lastUsedDateTime` on passkeys, which is already collected but not used on the readiness page;
   - the Conditional Access What If API, which works under `Policy.Read.All`;
   - `$count` on sign-ins (preview).
7. **Two accuracy gaps found in the code while checking these APIs** (details in §3):
   - macOS Platform Credential (`platformCredentialAuthenticationMethod`) is mapped to `other` in
     `src/graph/collect/collectors.ts`, so a Mac's built-in credential is not recognised at the
     registration layer.
   - `classOfProofMethod` in `src/scoring/phishingResistant.ts` has no pattern for a "platform
     credential" sign-in string. Mac Platform SSO sign-ins may therefore never count as proof. The
     exact string is unverified; check it in a tenant that uses Platform SSO.
8. **Risks to manage:**
   - Claims accuracy. "Phishing-resistant" is not "immune": in August 2026, published research
     (SpecterOps, Unit 42, Dirk-jan Mollema) showed passkey attacks that need an already-compromised
     endpoint.
   - Privacy: per-person readiness lists are personal data.
   - Trademark and affiliation wording.
   - Microsoft moving fast into the same space.
9. **Top three opportunities** (ranked table in §5):
   - an **SMS/voice retirement countdown** on MFA Readiness;
   - a **nudge predictor** per person and device;
   - a **counts-only readiness snapshot** (image and PDF) that is safe to share.

   All three are read-only, need no new permission, and give the marketing a concrete, dated reason to
   run IAMAI now.

---

## 1. Microsoft's current guidance and timeline (2024–2027)

### Timeline

| Date | Change | Status / source |
|---|---|---|
| Oct 2024 → | Mandatory MFA Phase 1 (Azure portal, Entra admin center, Intune admin center; all CRUD). M365 admin center from Feb 2025. Phase 1 postponement allowed to 2025-09-30. | Verified: [Learn: mandatory MFA](https://learn.microsoft.com/en-us/entra/identity/authentication/concept-mandatory-multifactor-authentication) (updated 2026-07-06) |
| 2025-09-30 | Legacy MFA and SSPR policies stop governing authentication methods; the authentication methods policy is the single authority. | Widely reported (secondary); Microsoft's page: [Manage authentication methods](https://learn.microsoft.com/en-us/entra/identity/authentication/concept-authentication-methods-manage) (not re-read today). IAMAI already checks migration state. |
| 2025-10-01 → | Mandatory MFA Phase 2: Azure CLI, Azure PowerShell, mobile app, IaC, SDKs and REST (`management.azure.com`), for create/update/delete. Postponement allowed to **2026-07-01** at the latest. **Break-glass accounts are not exempt**; Microsoft recommends passkey (FIDO2) or CBA for them. | Verified: same Learn page; [Azure blog](https://azure.microsoft.com/en-us/blog/azure-mandatory-multifactor-authentication-phase-2-starting-in-october-2025/) |
| Mar 2026 | **Synced passkeys GA** and **passkey profiles GA** (group-targeted, `passkeyTypes`, attestation, AAGUID lists; existing config migrated to a Default profile). Profiles per tenant raised from 3 to 10 in May 2026. | Verified: [Entra What's new](https://learn.microsoft.com/en-us/entra/fundamentals/whats-new) (Mar/May 2026); [MC1221452](https://mc.merill.net/message/MC1221452) |
| Mar 2026 | Passkey adoption campaigns in the CA Optimization Agent (public preview); "phased rollout" of any report-only policy (preview). | Verified: What's new (Mar 2026); [Learn: agent passkeys](https://learn.microsoft.com/en-us/entra/security-copilot/conditional-access-agent-optimization-passkeys) (updated 2026-06-26) |
| Apr 2026 | `$count` on the sign-ins API (public preview). | Verified: What's new (Apr 2026) |
| Late Apr → mid-Jun 2026 | **Microsoft Entra passkeys on Windows GA** (worldwide/GCC); stored in the Windows Hello container; works on devices that are not joined. At GA, no AAGUID allow-listing is needed where profiles allow non-attested device-bound passkeys. GCC High/DoD in Oct 2026. | Verified: [MC1282568](https://mc.merill.net/message/MC1282568) (updated 2026-07-20) |
| May 2026 | Passkeys supported in **registration campaigns** (GA). **System-preferred authentication extended to the first factor** in the Microsoft-managed state, so users with passkeys may sign in with no password. | Verified: What's new (May 2026) |
| 2026-06-15 → | CA enforcement for "baseline scopes" when an **All resources** policy has resource exclusions (apps asking only `openid`/`profile`/`User.Read` are now challenged). | Verified: [Learn](https://learn.microsoft.com/en-us/entra/identity/conditional-access/concept-enforcement-resource-exclusions) (updated 2026-07-01) |
| 2026-07-13 | Announcement: passkeys become the default; SMS and voice retire ([Microsoft Security Blog](https://www.microsoft.com/en-us/security/blog/2026/07/13/microsoft-entra-id-security-updates-passkeys-are-the-default-authentication-method-in-entra-id/)); MC1426371 (secondary). | Verified |
| **2026-09-01** | Users enabled for SMS/voice (in the authentication methods policy **or legacy MFA settings**) are auto-enabled for passkeys in a profile that allows **all passkey types**. The registration campaign is set to **Microsoft managed**, targeting passkeys, with **unlimited snoozes**. A temporary opt-out exists: beta `optOutSettings.passkeyDynamicMigration = true` (needs a write scope, so IAMAI can only *report* it). | Verified: [Learn: SMS/voice retirement](https://learn.microsoft.com/en-us/entra/identity/authentication/concept-sms-voice-retirement) and [FAQ](https://learn.microsoft.com/en-us/entra/identity/authentication/concept-sms-voice-retirement-faq) (both updated 2026-09-16) |
| 2026-09-18 / 2026-10-30 | Telecom providers published in the Microsoft Security Store / selectable in Entra, for customers that must keep SMS or voice (paid per message). | Verified: same pages |
| By end of 2026 | Passkey support for B2B and internal guest users (planned). | Verified: FAQ ("planned") |
| **2027-02-01** | Microsoft-provided SMS/voice retired for everyone except Global Administrators and external users (**internal guests are in this group**). After it, users whose only method is SMS/voice get a **blocking** passkey registration prompt, with **no opt-out**. SSPR is included. | Verified |
| **2027-07-01** | The same for **Global Administrators and external users**. | Verified |

Other current facts that matter to IAMAI:
- **Registration campaign (doc updated 2026-09-15).**
  - States: Microsoft managed, Enabled, Disabled. In the Microsoft managed state, passkeys are targeted
    when the included users are enabled for passkeys.
  - Eligibility under Microsoft managed depends on the user's **passkey profile**. For example, an
    AAGUID-restricted profile must allow at least one of iCloud Keychain, Google Password Manager, the
    Authenticator passkey or the Entra passkey on Windows.
  - **The nudge is evaluated per OS and browser.** A table lists which credential stops the nudge where:
    Windows Hello for Business or the Entra passkey on Windows for Windows; iCloud Keychain or Platform
    SSO for macOS; Authenticator or iCloud for iOS; GPM, Samsung Pass or Authenticator for Android.
  - Linux is never nudged; guests are not nudged for passkeys.
  - There is no nudge inside an SSO session, and none where a CA policy blocks "Register security
    information".
  - Source: [Learn: registration campaign](https://learn.microsoft.com/en-us/entra/identity/authentication/how-to-mfa-registration-campaign)
- **Microsoft's recommended target state.**
  - Every user holds a **portable** credential (a synced passkey, or for admins a FIDO2 key or the
    Authenticator passkey).
  - Every computing device has a **local** credential: Windows Hello for Business or the Entra passkey
    on Windows; Platform SSO with a Secure Enclave key on macOS; a synced or Authenticator passkey on a
    phone.
  - Enforcement is done by **user/device pair**, with one CA policy per OS platform, each using a
    "phishing-resistant ready users" group.
  - Minimum OS versions: Windows 10 22H2 (WHfB), Windows 11 22H2 (best passkey experience), macOS 13,
    iOS 17, Android 14.
  - Communication cadence: 60, 45, 30, 15, 7 and 1 days before enforcement, using Microsoft templates.
  - Source: [Learn: plan a phishing-resistant passwordless deployment](https://learn.microsoft.com/en-us/entra/identity/authentication/how-to-deploy-phishing-resistant-passwordless-authentication)
    (2026-03-26)
- **Synced passkeys: Microsoft's own figures** (consumer Microsoft accounts, stated on Learn):
  99% register successfully; 14× faster than password plus MFA (3 s vs 69 s); a 95% vs 30% sign-in
  success rate. Synced passkeys **don't support attestation**. Microsoft suggests device-bound passkeys
  for admins. Source: [Learn: synced passkeys](https://learn.microsoft.com/en-us/entra/identity/authentication/how-to-synced-passkeys)
  (2026-07-05). These figures are quotable with attribution, but they are consumer MSA data, not
  enterprise data.
- **Built-in "Phishing-resistant MFA" authentication strength:** Windows Hello for Business or a
  platform credential, a FIDO2 security key (passkeys), or multifactor CBA. Authenticator phone sign-in
  counts as passwordless but **not** phishing-resistant.
  [Learn: authentication strengths](https://learn.microsoft.com/en-us/entra/identity/authentication/concept-authentication-strengths)
- **Microsoft-managed CA policies** (Learn updated 2026-08-08) still exist.
  - The list includes "Require phishing resistant authentication for admins" (a Baseline Security Mode
    policy managed from the M365 admin center) and "Multifactor authentication for per-user MFA users".
  - A Microsoft Q&A answer claims managed policies are being retired "as a class". That contradicts the
    Learn page; treat the Q&A as unverified.
  - Source: [Learn: managed policies](https://learn.microsoft.com/en-us/entra/identity/conditional-access/managed-policies)
- **Platform SSO for macOS:** GA with Secure Enclave keys; it counts as phishing-resistant.
  ([Entra blog](https://techcommunity.microsoft.com/blog/microsoft-entra-blog/now-generally-available-platform-sso-for-macos-with-microsoft-entra-id/4437424);
  the post date could not be extracted; believed to be 2025, unverified.)
- **Secondary only, not verified at source:**
  - "Passkeys as first MFA": enrolling a passkey without a weaker first method, phased January 2026 to
    November 2027, MC1450133 ([Big Hat Group, 2026-08-08](https://www.bighatgroup.com/blog/entra-id-whats-new-2026-08-08/)).
  - The August 2026 passkey attack research, summarised in the Risks section
    ([The Hacker News, Aug 2026](https://thehackernews.com/2026/08/new-passkey-attacks-can-recover-synced.html)).

### What an admin needs that Microsoft's portal doesn't give them (IAMAI's pitch)

| Need | What Microsoft offers | Gap |
|---|---|---|
| "Who exactly hits the blocking prompt on 2027-02-01 / 2027-07-01?" | A PowerShell analyzer that lists **policy targets**. It doesn't expand groups, read registered methods or read sign-ins (verified, [repo](https://github.com/microsoft/entra-sms-voice-usage-analyzer)). The FAQ says any non-zero result from it puts the tenant in scope. | No person-level list, no split between "only SMS" and "SMS plus something better", no "who actually used SMS this month", and no separate date for Global Administrators. |
| Readiness by user/device pair | A workbook that needs Log Analytics (Azure subscription, ingestion cost, history only from the day export started). The CA agent (E5/SCUs, admins only, max 200). | Most SMB and Business Premium tenants have neither. IAMAI works from the 30 days of Graph sign-ins, with no Azure resources. |
| Is the registration data right? | The Authentication Methods Activity report: registration counts plus a per-user registration list, with up to 36 h latency. | Registration only; no per-device usage. A well-known practitioner critique found counts badly out of step with direct enumeration ([Eric Woodruff, 2025-09-02](https://ericonidentity.com/2025/09/02/entra-useless-insights-report/)). IAMAI enumerates methods per user directly, and Ready requires a confirmed sign-in. |
| "Will my nudge settings actually reach people?" | The registration campaign blade shows configuration only. | No forecast of who is eligible under Microsoft managed (passkey-profile rules), who is suppressed per device, or who is blocked by a security-info CA policy. |
| Break-glass for mandatory MFA | Guidance: use a passkey or CBA. | IAMAI's Emergency Access family already does this. It can be connected to the mandatory-MFA story in marketing. |
| A plan with dates, what it waits on, and emails | Templates (docx) and a comms cadence. | IAMAI writes the dated plan and the email. |

---

## 2. Comparable tools and positioning

| Tool | What it does | Cost and requirements | What it lacks vs IAMAI | Positioning line |
|---|---|---|---|---|
| **CA Optimization Agent (Security Copilot)**: passkey campaigns (preview), phased rollout (preview), policy suggestions (GA) | Assesses admins' device and passkey readiness in three buckets (needs a device update / needs to register / ready). Sends Teams nudges, adds users to a group, creates a report-only CA policy after a grace period. Runs every 24 h. | Entra P1, SCUs (under 1 SCU per run on average), Security Administrator. Security Copilot is included with M365 E5: 400 SCU/month per 1,000 users, capped at 10k, rolled out from 2026-04-20 to 2026-06-30 (secondary: [Schneider](https://www.schneider.im/microsoft-365-e5-security-copilot-now-included/), [zakitpro](https://www.zakitpro.com/ai/security-copilot-m365-e5-inclusion-april-2026/)). | Admin roles only, max 200 users. Writes to the tenant. Doesn't check that passkeys are enabled for the users. Readiness is judged by device OS version, not by the credential used on each device. No plan for the rest of the organisation; no explanation per person. | "See everyone, read-only, free, before you let an agent act. IAMAI tells you who the agent would target and who it leaves out." Offer a CSV of Ready object ids to feed its groups. |
| **Phishing-Resistant Passwordless workbook** | Enrolment and enforcement readiness per OS and credential, drawn from sign-in logs. | Log Analytics, sign-in logs exported. | Nothing to show until logs have been exported for a while. Azure cost. Workbook skills needed. | "Microsoft's user/device-pair method, without Log Analytics." |
| **Authentication Methods Activity** (portal plus Graph) | Registration counts, per-user registration details, usage counts. | P1; Reports Reader. | No per-device usage; latency; reported accuracy issues. | IAMAI reads the same source and goes further. Don't disparage it; say what the report can't show. |
| **CA policy impact tab / What If** | Impact of existing policies on sign-ins (24 h / 7 d / 1 month); What If per simulated sign-in. | P1. | Only for existing policies; nothing about baseline gaps or future steps. | IAMAI plans the policies you don't have yet. |
| **Microsoft SMS/voice analyzer** | Policy scope for SMS/voice. | PowerShell modules, Policy.Read.All, Group.Read.All. | See above. | "Microsoft's script tells you *whether* you're in scope. IAMAI tells you *who*, and what each person needs." |
| **Microsoft Zero Trust Assessment** | Free PowerShell tool; configuration checks across pillars, with an HTML report. Includes identity checks (for example, privileged users' methods). | PowerShell 7, Graph consent. | Pass/fail on configuration; not a person-level rollout plan. (Tool details are secondary: [repo](https://github.com/microsoft/zerotrustassessment).) | A complement: ZTA finds the gap; IAMAI plans closing it. |
| **Maester** | Open-source Pester test framework (for example, `Test-MtCisaPhishResistant`, `Test-MtCisaPrivilegedPhishResistant`). | PowerShell, CI. | Tests of configuration presence; no person or device evidence. ([maester.dev](https://maester.dev/)) | Recommend Maester for continuous regression after IAMAI's plan is done. |
| **CIPP** (MSP) | Multi-tenant MSP console; MFA report combining registration, per-user MFA and CA coverage. | Self-hosted or sponsored; GDAP. | Registration and policy coverage, not sign-in device evidence; no passkey "seamless" model. ([docs](https://docs.cipp.app/user-documentation/identity/reports/mfa-report)) | IAMAI as the per-customer passkey deep dive an MSP runs before a CIPP standard is pushed. |
| **idPowerToys CA Documenter** (Merill) | CA policies to PowerPoint. | Web app with consent. | Documentation only. | Different job; friendly community peer. |

**Positioning in one sentence:** *IAMAI is the free, read-only, browser-only way to see which people in
your Entra tenant can already sign in phishing-resistant on every device they use, and what each of
the rest needs before Microsoft's SMS and voice retirement. It comes with a dated plan to get there.*

Differentiators to repeat:
- Read-only and consented once; there is no server.
- Every person, not only admins.
- Evidence from sign-ins, not registration alone.
- Per device, with Microsoft's own nudge rules cited.
- Free, with no Log Analytics or SCUs.
- It explains why for each person.

---

## 3. More read-only Graph data within existing consent

What IAMAI already collects (from the code, so these are not proposed twice):
- `userRegistrationDetails` (v1.0): `isPasswordlessCapable`, `methodsRegistered`, `defaultMfaMethod`,
  preferred methods.
- `/users/{id}/authentication/methods`, plus v1.0 `fido2Methods` (`aaGuid`, `attestationLevel`,
  `passkeyType`, `model`) and beta `fido2Methods` for `lastUsedDateTime`.
- Per-user MFA state.
- Interactive sign-ins (beta) with `authenticationDetails`, `mfaDetail`, OS, browser, deviceId, trust
  type, and applied CA including report-only results.
- Devices, and the authentication methods policy.

| # | Data | Endpoint (version) | Scope held | What it adds | Caveats |
|---|---|---|---|---|---|
| 1 | **SMS and voice method configuration** (state, include/exclude targets) plus legacy per-user MFA (already read) | `/policies/authenticationMethodsPolicy` → `authenticationMethodConfigurations` `sms`, `voice` (v1.0) | Policy.Read.All | Who is *enabled* for SMS/voice, the population Microsoft auto-enabled on 2026-09-01. | Group expansion is needed to reach people (IAMAI already expands groups on demand). |
| 2 | **Phone methods per person** (already read) plus **sign-in evidence** ("Text message", "Phone call" in `authenticationDetails`) | existing | existing | Splits people into: **only SMS/voice → blocking prompt on 2027-02-01** (or 2027-07-01 for Global Admins and external users); **SMS plus a stronger method**; and **used SMS in the last 30 days**. | Whether "Global Administrators" includes PIM-*eligible* holders is not stated by Microsoft. Show both counts and say the rule is unclear. |
| 3 | **Registration campaign** state and targets | same policy → `registrationEnforcement.authenticationMethodsRegistrationCampaign` (v1.0) | Policy.Read.All | Show that the tenant is Microsoft managed with a passkey target since 2026-09-01; who is included or excluded; snooze settings. Combined with passkey profiles (already read), predict **nudge eligibility**. | Graph `state` values are documented as `default`/`enabled`/`disabled`. How "Microsoft managed" shows up in Graph is **unverified**; read a live tenant before building. |
| 4 | **Opt-out flag** `optOutSettings.passkeyDynamicMigration` | `/beta/policies/authenticationMethodsPolicy` | Policy.Read.All | "This tenant has opted out of the September auto-enable. Enforcement still arrives on 2027-02-01." | Beta, and documented only in a PATCH example. Whether GET returns it is **unverified**. |
| 5 | **Nudge prediction per person × device** | derived: sign-in OS and browser (already kept) + methods held + Microsoft's per-platform suppression table | none new | "Maria will be nudged on her Mac in Chrome (no iCloud or Platform SSO credential); not on her iPhone (Authenticator passkey)." This is Microsoft's own rule, so it is a strong citation. | Also depends on no SSO session and on the security-info CA policy. Word it as "eligible for the nudge", not "will see". |
| 6 | **Windows Hello for Business methods by device** | `/users/{id}/authentication/windowsHelloForBusinessMethods` (v1.0); `displayName` = device name; `$expand=device` only on a single GET | UserAuthenticationMethod.Read.All | Which computers hold a WHfB key, per person. Partly replaces the Intune read the owner declined. `keyStrength` flags weak keys. | `$expand=device` means one GET per method, so budget it. IAMAI keeps only id and created date today. |
| 7 | **macOS Platform Credential (Platform SSO) methods** | `/users/{id}/authentication/platformCredentialMethods` (beta; a v1.0 page exists) with `platform`, `displayName` (device), `keyStrength`, `lastUsedDateTime` | UserAuthenticationMethod.Read.All | Macs with a built-in phishing-resistant credential. **Today `KIND_BY_TYPE` in `src/graph/collect/collectors.ts` maps this type to `other`.** Mac Seamless can be under-counted. | Check what the generic `/methods` list returns for it on v1.0. Collection path name: confirm on the list page. |
| 8 | **Platform SSO sign-in string** | existing sign-in rows | none new | `classOfProofMethod` (`src/scoring/phishingResistant.ts`) has no pattern for "platform credential". If Microsoft logs Platform SSO under that name, Mac sign-ins never count as proof. | **Unverified.** Check a real Platform SSO sign-in before changing anything (the file's own rule is that an unrecognised string is never promoted). |
| 9 | **`lastUsedDateTime`** on fido2 (collected) and Platform Credential | beta | held | Explains the "May no longer exist — confirm it" state ("Microsoft last recorded use 14 Mar"). It must **not** make anyone Ready (owner decision 5). | "Optional; null if the method doesn't populate it." |
| 10 | Tenant-level trend counts: `usersRegisteredByMethod`, `usersRegisteredByFeature`, `userSignInsByAuthMethodSummary`, `userMfaSignInSummary` | `/reports/authenticationMethods/...` (beta; some v1.0) | AuditLog.Read.All / Reports.Read.All (Reports Reader, Global Reader) | A cheap "passkey sign-ins per day" or "registered by method" trend for large tenants beyond the 50k-row ceiling, and a cross-check against IAMAI's own counts. | Microsoft's aggregates; latency; an accuracy critique exists. Show as "Microsoft's count", never mixed into Ready. |
| 11 | **`$count` on sign-ins** | `/auditLogs/signIns?$count=true` | AuditLog.Read.All | Size the window before paging; cheaper coverage statements. | Public preview (April 2026). |
| 12 | **CA What If** | `POST /identity/conditionalAccess/evaluate` (v1.0) | **Policy.Read.All** is sufficient (least privileged is Policy.Read.ConditionalAccess) | Confirm with Microsoft's own engine that a Ready person on iOS is covered by a phishing-resistant strength policy, or that the emergency accounts are excluded. | Existing policies only. It is a POST: non-mutating, but check it against the "no call that mutates" rule wording (a `$batch` POST is already precedent). |
| 13 | **Audit log events for authentication-method policy changes** and for "Microsoft Managed Policy Manager" | `/auditLogs/directoryAudits` (v1.0) | AuditLog.Read.All | Show *when* Microsoft auto-enabled passkeys or changed the campaign (2026-09-01 in this tenant) and who changed passkey profiles. | 30-day retention; filter server-side. Output shape since the April 2026 readability change: only changed properties. |
| 14 | **CA "baseline scopes" exposure** | existing CA policies | none new | Flag All-resources policies that have resource exclusions (their behaviour changed from 2026-06-15). A Plan-side check, not MFA. | Policy-shape check only. |

Not recommended here: Intune reads (the owner declined; they need a new scope). Non-interactive sign-ins
(volume, little extra evidence for this page).

---

## 4. Ideas to put the tool to work

### A. SMS/voice retirement countdown (flagship)
- One card on MFA Readiness with three numbers and two dates:
  - "N people whose only MFA method is SMS or voice: blocking prompt on 1 Feb 2027";
  - "M Global Administrators or external users: 1 Jul 2027";
  - "K people who used SMS or voice in the last 30 days".
- Each number links to the people and to what each needs on each device (reusing Seamless eligibility).
- Why it works: the deadline is dated, has no opt-out, and Microsoft's own tool doesn't list people.
  It is also the easiest free-tool story to tell on LinkedIn.
- Accuracy rules:
  - quote Microsoft's dates with "per Microsoft Learn, updated 16 Sep 2026";
  - say "Microsoft-provided SMS/voice" (customer telecom providers remain possible);
  - never say "locked out" (Microsoft says users are prompted, not locked out).

### B. Nudge predictor
- Per person and device: "eligible for Microsoft's passkey prompt", "prompt suppressed (has a Windows
  Hello credential here)", or "not prompted: Linux / SSO session / security-info policy".
- Tenant card: "Microsoft is nudging N people since 1 Sep 2026; the prompt can be skipped without
  limit."
- Cite Microsoft's per-platform table. This reinforces the "Seamless" target with Microsoft's own logic.

### C. A readiness snapshot that is safe to share (counts only)
- A one-page image and PDF: Ready %, Seamless %, the 2027 countdown numbers, the device mix, the
  date and window read ("Sign-ins read 19 Aug → 18 Sep"), and the baseline version.
- **No names, UPNs, ids, tenant name or domains by default.** An optional tenant label typed by the
  operator.
- Generated in the browser (canvas or print), so the no-server rule holds.
- Uses: an internal status update to leadership, cyber-insurance evidence, MSP quarterly reviews.
- Offer a "compare with last scan" delta using the history IAMAI already keeps.

### D. A "passkey readiness score" for marketing: define it carefully
- Recommend **against a single composite score**. Publish two plain percentages instead:
  - **Ready**: a phishing-resistant sign-in in the last 30 days on every device type the person used;
  - **Seamless**.
- Both are reproducible from the page.
- If a single number is wanted, make it `Ready ÷ counted people`, with the exclusions stated
  (guests, never signed in, retired).
- **Don't publish cross-tenant benchmarks or industry averages.** IAMAI has no telemetry by design, so
  any "average tenant is X% ready" would be invented. The only honest sources are the demo tenant
  (label it as synthetic), voluntary opt-in submissions of counts through the existing feedback
  channel, or Microsoft's published figures with attribution.

### E. Campaign emails
- IAMAI already produces emails. Align them with Microsoft's cadence (60/45/30/15/7/1 days) and the
  three phases Microsoft names (awareness, action, reminder).
- Per-audience variants built from the readiness states:
  - "you already hold one; use it on your Mac too";
  - "your only method is text message; set up a passkey before 1 Feb 2027";
  - "confirm the passkey you registered in March still exists".
- Per-device setup lines come from `shared.methodGuides` (one source).
- Export as a CSV mail-merge of recipient-group object ids, not addresses, so the operator's own mail
  tool does the send. IAMAI never sends.

### F. MSP multi-tenant use
Today MSAL uses `login.microsoftonline.com/organizations`, so a GDAP partner user lands in the partner
tenant. Low-effort changes:
- an optional "Customer tenant (domain or id)" field that sets the authority to that tenant;
- documented prerequisites:
  - the IAMAI Planner app consented in the customer tenant (a customer Global Administrator, or the
    partner consent API with a GDAP relationship holding Cloud Application Administrator);
  - GDAP roles that include Global Reader.

  Source: [Learn: GDAP FAQ](https://learn.microsoft.com/en-us/partner-center/customers/gdap-faq) and
  [GDAP and the secure application model](https://learn.microsoft.com/en-us/partner-center/developer/gdap-and-secure-application-model);
  verify the details against a real GDAP relationship.

IndexedDB is already keyed by tenant. A local "all my tenants" table of counts only (Ready %, 2027
countdown) would be the MSP hook. It stays in the browser, so there is no server.

### G. LinkedIn content grounded in real outputs
Use the demo tenant or the owner's own GetIAMAI tenant; never a customer's.
1. "Microsoft's SMS retirement script tells you whether you're in scope. Here's how to see *who*."
   Screenshot of the countdown card (demo).
2. "Registered isn't ready": the gap between `isPasswordlessCapable` and a confirmed phishing-resistant
   sign-in, on the demo tenant's numbers.
3. "The passkey prompt is per device": Microsoft's nudge table drawn as one person's three devices.
4. "Your break-glass account needs MFA at Azure too": mandatory MFA Phase 2, with the Emergency Access
   Step 3 passkey.
5. "What 'phishing-resistant' does and doesn't mean": the August 2026 research, stated calmly and
   pointing to token protection. It builds credibility.
6. "The rollout Microsoft describes, without Log Analytics": user/device pairs with IAMAI's
   per-platform view.
7. A short series: the four emergency-access steps done live (already completed on GetIAMAI).

(Drafts should go through the `lachlan-linkedin-voice` skill.)

### Risks and how to handle them

- **Privacy.**
  - Per-person readiness lists are personal data (names, device use, sign-in times). Keep the default
    export counts-only.
  - Warn before exporting names, as IAMAI already does for the plan file.
  - Discourage using readiness for performance management; the page could say it is "for helping
    people, not rating them".
  - Never put tenant data in URLs, and keep the four-host network rule.
- **Claims accuracy.**
  - Microsoft dates changed repeatedly (Phase 2 moved; Windows passkeys GA timing adjusted). Date-stamp
    every claim and link it.
  - Say "phishing-resistant", not "unphishable". The August 2026 research needed an already-compromised
    endpoint; Microsoft shipped mitigations for CVE-2026-34348 in July 2026 (secondary). Recommend
    token protection as the next layer, not as an IAMAI feature.
  - Say "predicted" and "per the records read". The 30-day window and report latency limit what can
    be known.
- **Trademark and affiliation.** Use "for Microsoft Entra ID" as a factual compatibility statement.
  Don't use Microsoft logos or product icons, don't imply endorsement, and keep the IAMAI brand more
  prominent ([Microsoft trademark guidelines](https://www.microsoft.com/en-us/legal/intellectualproperty/trademarks)).
  Keep the existing "not affiliated with the baseline's author" line.
- **Competitive risk.** Microsoft is automating the same space (the agent, Microsoft-managed campaigns,
  Baseline Security Mode). IAMAI's durable edges are that it is read-only, covers everyone, explains
  itself, has no licence prerequisites and is baseline-driven. Build interop (CSV of ids for the agent
  or enforcement groups) rather than trying to out-automate Microsoft.
- **Beta dependence.** Several useful reads are beta (sign-ins, `lastUsedDateTime`, Platform
  Credential, the opt-out flag). Keep IAMAI's fail-closed pattern: a missing field is unknown, never
  proof.

---

## 5. Ranked product opportunities

| Rank | Opportunity | Impact | Effort | Risk | New permission? |
|---|---|---|---|---|---|
| 1 | **SMS/voice retirement countdown**: people with only SMS/voice, the 2027-02-01 and 2027-07-01 cohorts, and recent SMS use (§3 rows 1–2) | Very high: dated, no opt-out, Microsoft's tool lacks it | Low–medium (data already held; one derivation plus a card plus content keys) | Low; wording must follow Microsoft's (prompted, not locked out) and flag the eligible-Global-Admin ambiguity | **No** |
| 2 | **Fix the Mac credential recognition**: map `platformCredentialAuthenticationMethod`; verify the Platform SSO sign-in string (§3 rows 7–8) | High for accuracy (Seamless undercount on Macs) | Low (after one live verification) | Low | **No** |
| 3 | **Nudge predictor** per person × device, plus campaign-state card (§3 rows 3, 5) | High (explains what Microsoft is doing to their users right now) | Medium | Medium: the Graph representation of "Microsoft managed" is unverified; SSO and CA suppression must be worded as eligibility | **No** |
| 4 | **Counts-only shareable snapshot** (image/PDF) | High for marketing and MSPs | Low–medium | Low if counts-only by default | **No** |
| 5 | **Windows Hello devices per person** from WHfB method objects (§3 row 6) | Medium–high (per-computer Seamless without Intune) | Medium (per-method GET budget) | Low | **No** |
| 6 | **MSP tenant selector** (authority per customer tenant) plus a local multi-tenant counts table | High for reach | Medium | Medium (GDAP consent paths need live verification) | **No** (consent per customer tenant, same scopes) |
| 7 | **Campaign emails aligned to Microsoft's cadence** with state-specific variants | Medium | Low–medium | Low | **No** |
| 8 | **"Confirm it" explained with `lastUsedDateTime`** (fido2 and Platform Credential) | Medium (fewer confusing states) | Low (fido2 already collected) | Low if it never promotes to Ready | **No** |
| 9 | **What If cross-check** for Ready people and emergency accounts | Medium (Microsoft's engine agrees with IAMAI's prediction) | Medium | Medium (a POST; rule wording; What If needs full sign-in details) | **No** (Policy.Read.All suffices) |
| 10 | **Tenant trend counts** from `/reports/authenticationMethods/*` and `$count` | Low–medium (large tenants, cross-check) | Low | Low (label as Microsoft's count) | **No** |
| 11 | **Audit trail of the 2026-09-01 auto-enable** and of passkey-profile changes | Low–medium | Low | Low | **No** |
| 12 | **Interop export for the CA agent and Microsoft's per-OS enforcement groups** (CSV of Ready object ids per platform) | Medium (complements Microsoft) | Low | Low (ids are tenant data; warn on export) | **No** |
| — | Intune reads (WHfB and Platform SSO provisioning) | Medium | Medium | Consent friction | **Yes**, `DeviceManagementConfiguration.Read.All`; the owner already declined it (2026-09-18). Rows 5 and 7 cover much of the need without it. |

---

## 6. Not verified or uncertain

- How the registration campaign's "Microsoft managed" state appears in the Graph `state` property.
- Whether GET on the beta authentication methods policy returns `optOutSettings.passkeyDynamicMigration`.
- The exact `authenticationDetails.authenticationMethod` string for macOS Platform SSO. Also whether
  the v1.0 generic methods list returns Platform Credential methods.
- Whether "Global Administrators" in the July 2027 cohort includes PIM-eligible (not active) holders.
- The Platform SSO GA date. The Security Copilot E5 inclusion details and SCU formula (secondary sources
  only). MC1450133 "passkeys as first MFA" (secondary only). Details of the Microsoft Zero Trust
  Assessment's identity checks (secondary).
- The August 2026 passkey attack research: summarised from one news article; primary write-ups not read.
- The Microsoft Q&A claim that Microsoft-managed CA policies are retiring as a class. It contradicts
  Learn (updated 2026-08-08).

## Sources (primary first)

- Learn: [SMS/voice retirement](https://learn.microsoft.com/en-us/entra/identity/authentication/concept-sms-voice-retirement) · [FAQ](https://learn.microsoft.com/en-us/entra/identity/authentication/concept-sms-voice-retirement-faq) · [Registration campaign](https://learn.microsoft.com/en-us/entra/identity/authentication/how-to-mfa-registration-campaign) · [Plan phishing-resistant passwordless deployment](https://learn.microsoft.com/en-us/entra/identity/authentication/how-to-deploy-phishing-resistant-passwordless-authentication) · [Synced passkeys](https://learn.microsoft.com/en-us/entra/identity/authentication/how-to-synced-passkeys) · [Mandatory MFA](https://learn.microsoft.com/en-us/entra/identity/authentication/concept-mandatory-multifactor-authentication) · [Authentication strengths](https://learn.microsoft.com/en-us/entra/identity/authentication/concept-authentication-strengths) · [Authentication methods activity](https://learn.microsoft.com/en-us/entra/identity/authentication/howto-authentication-methods-activity) · [Managed CA policies](https://learn.microsoft.com/en-us/entra/identity/conditional-access/managed-policies) · [Baseline scopes enforcement](https://learn.microsoft.com/en-us/entra/identity/conditional-access/concept-enforcement-resource-exclusions) · [CA agent passkey campaigns](https://learn.microsoft.com/en-us/entra/security-copilot/conditional-access-agent-optimization-passkeys) · [Entra What's new](https://learn.microsoft.com/en-us/entra/fundamentals/whats-new)
- Graph: [userRegistrationDetails v1.0](https://learn.microsoft.com/en-us/graph/api/resources/userregistrationdetails?view=graph-rest-1.0) · [beta](https://learn.microsoft.com/en-us/graph/api/resources/userregistrationdetails?view=graph-rest-beta) · [Auth methods usage reports](https://learn.microsoft.com/en-us/graph/api/resources/authenticationmethods-usage-insights-overview?view=graph-rest-beta) · [fido2AuthenticationMethod beta](https://learn.microsoft.com/en-us/graph/api/resources/fido2authenticationmethod?view=graph-rest-beta) · [authenticationMethod beta](https://learn.microsoft.com/en-us/graph/api/resources/authenticationmethod?view=graph-rest-beta) · [windowsHelloForBusinessAuthenticationMethod](https://learn.microsoft.com/en-us/graph/api/resources/windowshelloforbusinessauthenticationmethod?view=graph-rest-1.0) · [platformCredentialAuthenticationMethod](https://learn.microsoft.com/en-us/graph/api/resources/platformcredentialauthenticationmethod?view=graph-rest-beta) · [registration campaign resource](https://learn.microsoft.com/en-us/graph/api/resources/authenticationmethodsregistrationcampaign?view=graph-rest-beta) · [What If evaluate](https://learn.microsoft.com/en-us/graph/api/conditionalaccessroot-evaluate?view=graph-rest-1.0) · [usersRegisteredByMethod](https://learn.microsoft.com/en-us/graph/api/authenticationmethodsroot-usersregisteredbymethod?view=graph-rest-beta)
- Microsoft blogs, message center and repos: [Security blog 2026-07-13](https://www.microsoft.com/en-us/security/blog/2026/07/13/microsoft-entra-id-security-updates-passkeys-are-the-default-authentication-method-in-entra-id/) · [Azure blog, Phase 2](https://azure.microsoft.com/en-us/blog/azure-mandatory-multifactor-authentication-phase-2-starting-in-october-2025/) · [Platform SSO GA](https://techcommunity.microsoft.com/blog/microsoft-entra-blog/now-generally-available-platform-sso-for-macos-with-microsoft-entra-id/4437424) · [MC1282568](https://mc.merill.net/message/MC1282568) · [MC1221452](https://mc.merill.net/message/MC1221452) · [entra-sms-voice-usage-analyzer](https://github.com/microsoft/entra-sms-voice-usage-analyzer) · [zerotrustassessment](https://github.com/microsoft/zerotrustassessment)
- Practitioners and secondary: [Eric Woodruff, 2025-09-02](https://ericonidentity.com/2025/09/02/entra-useless-insights-report/) · [LoginTC, 2026-08-28](https://www.logintc.com/blog/microsoft-entra-sms-voice-mfa-retirement/) · [Big Hat Group, 2026-08-08](https://www.bighatgroup.com/blog/entra-id-whats-new-2026-08-08/) · [The Hacker News, Aug 2026](https://thehackernews.com/2026/08/new-passkey-attacks-can-recover-synced.html) · [Schneider IT](https://www.schneider.im/microsoft-365-e5-security-copilot-now-included/) · [zakitpro](https://www.zakitpro.com/ai/security-copilot-m365-e5-inclusion-april-2026/) · [Maester](https://maester.dev/) · [CIPP MFA report](https://docs.cipp.app/user-documentation/identity/reports/mfa-report) · [idPowerToys](https://idpowertoys.merill.net/ca) · [GDAP FAQ](https://learn.microsoft.com/en-us/partner-center/customers/gdap-faq) · [Microsoft trademark guidelines](https://www.microsoft.com/en-us/legal/intellectualproperty/trademarks)

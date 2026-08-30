# Guidance audit 01 — correctness, completeness, necessity

Prompt 33, run 2026-08-29 against `main` at `044a391`. Worked as an identity
architect rather than as a developer checking code against a spec: the question
throughout is **"would a person following this exactly get hurt"**, not "does the
step match the design".

Three rules held for the whole audit:

1. **Verify before writing.** Every technical claim about Microsoft behaviour,
   licence gates, portal wording or feature interaction was checked against
   Microsoft Learn by fetching the page. Nothing here rests on recall. Claims
   with no Microsoft source are labelled **field practice** or **unverified**
   rather than shipped as fact.
2. **Microsoft wins.** Where the tool's guidance and Microsoft's documented
   behaviour disagreed, the tool changes.
3. **Say which is which.** Where Microsoft is silent and field practice is clear,
   the claim says so.

**Status: complete.** Parts 1 to 5 done. The gap table below is what the audit
found; the section at the end is what changed.

## Method

- Step families enumerated from the goal catalogue (`data/goals.json`, 26 goals),
  the prerequisite and blocker builders (`src/roadmap/generate.ts`,
  `src/roadmap/blockerSteps.ts`), the free-tier ladder (`src/roadmap/ladder.ts`)
  and the verification campaign. Thirteen sheets under `docs/audits/steps/`.
- Each sheet states what the step changes, every population it can catch, every
  dependency it assumes, every way it can strand somebody, what Microsoft's own
  deployment guidance says to do first, and a Learn source per claim.
- Each sheet then compares itself against what the step says **today** and
  records each difference as **missing**, **wrong**, **partial**, or **present**.

## Sources

Every URL was fetched, not recalled. Locale-free canonical form.

| # | Source |
|---|---|
| S1 | `/entra/identity/conditional-access/policy-all-users-security-info-registration` |
| S2 | `/entra/identity/authentication/howto-authentication-temporary-access-pass` |
| S3 | `/entra/identity/authentication/how-to-mfa-registration-campaign` |
| S4 | `/entra/identity/conditional-access/policy-risk-based-sign-in` |
| S5 | `/entra/identity/role-based-access-control/security-emergency-access` |
| S6 | `/entra/fundamentals/security-defaults` |
| S7 | `/entra/identity/conditional-access/managed-policies` |
| S8 | `/entra/identity/conditional-access/concept-conditional-access-report-only` |
| S9 | `/entra/identity/authentication/concept-mandatory-multifactor-authentication` |
| S10 | `/intune/device-security/compliance/overview` |
| S11 | `/entra/identity/conditional-access/policy-all-users-device-compliance` |
| S12 | `/entra/identity/conditional-access/concept-conditional-access-grant` |
| S13 | `/intune/device-security/compliance/monitor-policy`, `/intune/device-security/compliance/configure-noncompliance-actions` |
| S14 | `/entra/identity/conditional-access/policy-all-users-approved-app-or-app-protection` |
| S15 | `/entra/identity/devices/concept-hybrid-join` |
| S16 | `/entra/identity/conditional-access/policy-all-users-device-registration`, `/entra/identity/conditional-access/concept-conditional-access-cloud-apps` |
| S17 | `/entra/identity/conditional-access/concept-condition-filters-for-devices` |
| S18 | `/entra/identity/conditional-access/deployment-guide-token-protection-windows` |
| S19 | `/exchange/clients-and-mobile-in-exchange-online/deprecation-of-basic-authentication-exchange-online` |
| S20 | `/exchange/mail-flow-best-practices/how-to-set-up-a-multifunction-device-or-application-to-send-email-using-microsoft-365-or-office-365` |
| S21 | `/entra/identity/conditional-access/concept-conditional-access-conditions`, `/entra/identity/conditional-access/policy-block-legacy-authentication` |
| S22 | `/entra/identity/conditional-access/concept-authentication-flows`, `/entra/identity/conditional-access/policy-block-authentication-flows` |
| S23 | `/entra/identity/conditional-access/concept-assignment-network` |
| S24 | `/entra/identity/conditional-access/concept-continuous-access-evaluation` |
| S25 | `/entra/identity/conditional-access/plan-conditional-access`, `/entra/identity/conditional-access/policy-block-by-location` |
| S26 | `/entra/identity/conditional-access/concept-session-lifetime` |
| S27 | `/entra/identity/conditional-access/howto-conditional-access-session-lifetime`, `/entra/identity/conditional-access/policy-all-users-persistent-browser` |
| S28 | `/microsoftteams/rooms/supported-ca-and-compliance-policies` |
| S29 | `/sharepoint/control-access-from-unmanaged-devices`, `/sharepoint/app-enforced-restrictions` |
| S30 | `/defender-cloud-apps/session-policy-aad` |
| S31 | `/windows-365/enterprise/set-conditional-access-policies` |
| S32 | `/microsoft-365/admin/security-and-compliance/set-up-multi-factor-authentication` |
| S33 | `/entra/fundamentals/security-defaults` |
| S34 | `/entra/identity/authentication/howto-mfa-userstates` |
| S35 | `/entra/identity/monitoring-health/recommendation-turn-off-per-user-mfa`, `/entra/identity/authentication/how-to-authentication-methods-manage` |
| S36 | `/entra/identity/conditional-access/managed-policies` |
| S37 | `/entra/identity/role-based-access-control/best-practices` |
| S38 | `/microsoft-365/admin/security-and-compliance/m365b-account-security-admins` |
| S39 | `/entra/identity/conditional-access/workload-identity` |
| S40 | `/partner-center/customers/gdap-faq` |
| S41 | `/entra/external-id/authentication-conditional-access` |

## Note on the tool's existing Learn URLs

All 26 goal `learnUrl` values resolve, but several are **non-canonical** and
served by redirect: `howto-conditional-access-policy-registration` →
`policy-all-users-security-info-registration`;
`howto-conditional-access-policy-risk` → `policy-risk-based-sign-in`;
`howto-conditional-access-policy-block-legacy` →
`policy-block-legacy-authentication`; `location-condition` →
`concept-assignment-network`. Working links, stale addresses. Low severity, but a
redirect Microsoft later drops turns a citation into a dead link.

---

# Part 1 gap table

140 claims checked across 13 step families.

| Category | Count |
|---|---|
| **missing** — the sheet says it, the step does not | **87** |
| **wrong** — the step says something Microsoft contradicts | **17** |
| **partial** — said, but vaguely or incompletely | **9** |
| **present** — already correct | **27** |
| **unnecessary** | **0 so far** — Layer F is Part 3, not yet run |

## By family

| Family | Missing | Wrong | Partial | Present | Sheet |
|---|---|---|---|---|---|
| Security-info registration | 12 | 1 | 0 | 2 | `steps/security-info-registration.md` |
| Device controls | 10 | 1 | 1 | 2 | `steps/device-compliance.md` |
| Legacy auth and flows | 10 | 0 | 0 | 2 | `steps/legacy-auth-and-flows.md` |
| Verification campaign | 8 | 0 | 0 | 1 | `steps/verification-campaign.md` |
| Session controls | 8 | 1 | 1 | 1 | `steps/session-controls.md` |
| Risk and workload identities | 7 | 0 | 1 | 1 | `steps/risk-and-workload.md` |
| Guests, external, partner | 6 | 0 | 0 | 2 | `steps/guests-and-external.md` |
| Locations and geo | 5 | 2 | 1 | 3 | `steps/location-geo.md` |
| MFA for every user | 5 | 0 | 0 | 3 | `steps/mfa-all-users.md` |
| Admin hardening | 5 | 0 | 0 | 2 | `steps/admin-hardening.md` |
| Tenant-state conflicts | 4 | 5 | 1 | 2 | `steps/tenant-state-conflicts.md` |
| Emergency access | 3 | 3 | 2 | 4 | `steps/emergency-access.md` |
| Exclusions group + ladder | 4 | 4 | 2 | 2 | `steps/exclusion-group-and-ladder.md` |

## The 17 wrong claims, in full

These are where the tool currently contradicts Microsoft. Ordered by severity.

| # | Where | The tool says | Microsoft says | Source |
|---|---|---|---|---|
| W1 | `mobile-app-protection` goal floor | Build the policy on **Require approved client app** alone | "The approved client app grant is **retiring in early March 2026**… for any new Conditional Access policy, **only apply the Require application protection policy grant**" — retired five months before today | S12 |
| W2 | Rollback copy, everywhere | Conditional Access changes "generally apply within a few minutes" | "could take **up to one day** to be effective… optimization… reduce the delay to **two hours**" | S24 |
| W3 | Security-defaults prerequisite | Conditional Access "cannot exist" while security defaults are on | "you **can create** new Conditional Access policies, but you **can't turn them on**" — a tool that creates and reports success creates false safety | S32 |
| W4 | `global-admin-count` ladder rung, validation copy | "Microsoft recommends two to four" Global Administrators | No such figure. "Limit the number of Global Administrators to **less than 5**"; separately "at least **two**" emergency access accounts | S37, S38 |
| W5 | `bg.excludedFromAllPolicies` rule | Blocks the plan when a break-glass account is not excluded from a **report-only** policy | "**Report-only policies don't require an exclusion**" | S5, S8 |
| W6 | `bg.perUserMfaOff` rule, ladder rung | Per-user MFA state "is not exposed by Microsoft Graph at all" | Readable at `GET /beta/users/{id}/authentication/requirements` (`perUserMfaState`); beta only, and IAMAI does not call it | S34 |
| W7 | Per-user MFA ladder rung | Conflates per-user MFA *enforcement state* with the authentication methods *migration state* | Two unrelated concepts | S34, S35 |
| W8 | Geo step portal path | "Conditions → Locations", "Cloud apps" | "The Location condition moved and was **renamed Network**"; "**All resources** (formerly 'All cloud apps')" | S23 |
| W9 | Geo failure modes | Travel, roaming and carrier-IP risks stated as documented fact | Learn documents only the proxy/VPN case and a general "restrictive… after thorough testing" caution. The rest is field practice and must be labelled | S23 |
| W10 | Security-defaults step | The gap between off and enforced framed as Microsoft's warning | Microsoft documents the sequencing ("**immediately** enable Conditional Access policies") but never names the window as an unprotected gap — our inference | S33 |
| W11 | App-passwords ladder rung | "App passwords live in the legacy per-user MFA settings, which Microsoft Graph does not expose" | Over-broad: per-user MFA state *is* exposed (beta); app passwords specifically are not | S34 |
| W12 | Legacy-auth step | Implies EAS/POP/IMAP/EWS still work and will break | "**Basic authentication is now disabled in all tenants**… no one (you or Microsoft support) can re-enable" — for most tenants the block is a no-op | S19 |
| W13 | Legacy-auth step | "Carve out the service accounts first" as the fix for printers | The documented exits are SMTP relay, Direct Send, High Volume Email, ACS or an on-prem relay — a CA exclusion reopens password spray on that mailbox | S20 |
| W14 | Break-glass rule copy | Credential guidance built around a long passphrase | Current guidance is **phishing-resistant methods (FIDO2 or CBA)**, "different from your normal admin accounts" | S5 |
| W15 | Session steps | "Nobody is blocked by a session control" | True for frequency and persistence; false for block-downloads, which blocks | S29 |
| W16 | Goal `learnUrl` values | Four non-canonical addresses | Served by redirect today | — |
| W17 | Exclusions-group rule | Blocks on report-only-only exclusions | Same as W5 | S8 |

## The three I consider most serious

1. **W1 — the tool builds a policy on a retired control.** `mobile-app-protection`
   emits Require approved client app alone. Microsoft retired that grant in early
   March 2026 and says explicitly that new policies must use app protection
   policy only. A small business following this step builds something that does
   not work, and believes its mobile estate is covered.

2. **The registration stranding (12 missing claims on one sheet).** The tool puts
   `register-info-protected` in phase 0 — *before* the verification campaign —
   with no trusted-location dependency, no mention of Temporary Access Pass, and
   no guest exclusion. Applied as generated to a remote-only workforce, it
   permanently strands every person who has not yet registered: they need MFA to
   register and registration to have MFA. Microsoft's page is built entirely
   around TAP as the way out, and the tool never mentions it. This is the exact
   shape of the break-glass gap that started the audit program.

3. **W2 — "changes apply within a few minutes."** Microsoft says up to a day. This
   sits in the rollback text of every step. An operator who reverts a policy
   during an incident and watches for five minutes will conclude the rollback
   failed and start changing other things. It is a small sentence attached to the
   worst moment.

Honourable mention: **W3**, because "created but not enabled" is the failure mode
that looks like success.

## Where I disagree with `audit-program.md`

Two of the omission candidates in §3 are **factually wrong**, and one framing is
overstated. Detail in the report; recorded here so the design document gets
corrected rather than implemented.

- §3 Device controls: *"Compliance policies must exist and be assigned in Intune
  before requiring compliance, or every device is non-compliant by definition."*
  **Wrong by default.** Devices with no policy assigned are treated as
  **compliant** unless the tenant flips the setting [S10].
- §3 Device controls: *"The Company Portal enrolment path being blocked by the
  very policy that requires compliance."* **Contradicted.** "The Require device to
  be marked as compliant control **doesn't block Intune enrollment**" [S11].
- §6: *"Every rule and every 'what could go wrong' item carries a Microsoft Learn
  citation."* Not achievable as an absolute. Several of the most valuable
  warnings — residential IPs, travel and roaming, shared-phone risk — are real
  and undocumented. The rule should be "a citation, or an explicit field-practice
  label", which is what this audit did.


---

# What changed (Parts 1.3, 2, 3, 4, 5)

## Correctness (the 17 wrong claims)

All 17 fixed. The four with the widest blast radius:

- **W1, the retired grant.** `mobile-app-protection`'s floor is now
  `compliantApplication`. A new grant floor was added and ranked above
  `approvedApplication` in the device dimension, so a tenant policy resting on
  the retired control reads as *below the floor* rather than equal to it.
- **W2, propagation.** The rollback text now says what Microsoft says: up to a
  day to reach every service, about two hours for some updates, tokens already
  issued keep working until they refresh, and revoke sessions if it has to bite
  now.
- **W4, Global Administrators.** The thresholds were right all along (2 to 4 is
  exactly "at least two, fewer than five"); the attribution was invented. The
  copy now cites the ceiling and the floor separately.
- **W5 and W17, the report-only over-block.** `bg.excludedFromAllPolicies` now
  considers enforcing policies only. A report-only exclusion became a
  recommendation (`bg.excludedFromReportOnly`), which removes a must-fix the
  documentation does not support.

## Completeness (Layer E)

The registration family went from 2 correct claims to complete: the remote
population, the Temporary Access Pass that has to exist first, the guests who
cannot be issued one, the Windows Hello and macOS Platform SSO flows that came
into scope on 6 July 2026, and the service principals a user-scoped policy never
covers. The same pass was made over device controls, legacy authentication,
sessions, locations, guests and admin hardening.

Two new rules: `bg.excludedFromReportOnly` and `bg.microsoftManaged` (the
policies Microsoft creates in report-only and turns on itself after about thirty
days).

## Necessity (Layer F)

Walking the micro and small plans as a ten-person business with one part-time
administrator, most of what the tool asks for holds up. The ring band already
gives a 30-person tenant two rings with a pilot of three, not four rings, and
the Intune-dependent goals are already marked not applicable without Intune, so
two of the things this layer was expected to find were not there to find.

Three changes:

- **Token protection moved to Advanced (phase 7).** Browser support is preview,
  and unsupported clients are blocked outright rather than degraded: PowerShell
  against SharePoint, perpetual Office, meeting-room devices. It stays visible,
  it is no longer proposed as ordinary work.
- **Two steps that are one mechanism now say so.** The browser session limit and
  the download block are both app-enforced restrictions, configured once.
- **Blocking unknown platforms now says what it is**: Microsoft's companion to
  the app protection policy, and on its own a blunt instrument.

Nothing was removed. Nothing in the plan needs a process, a tool or a role a
small MSP does not have.

## Sequence safety (Layer C)

`src/roadmap/sequence.test.ts` runs eight properties over every fixture. Writing
them found two real ordering bugs:

1. A phase 0 step could be given a dependency on the phase 2 campaign and still
   sort first, so the plan contradicted itself. The verification gate now only
   ever adds a backward edge.
2. A step already in report-only reports reality rather than the gate, so the
   property is that nothing deny-capable is **Ready**, and the gate still has to
   appear in `blockedBy` before enforcement.

## Citations (Part 5)

Every rule and every warning carries a Microsoft Learn URL or an explicit
**field practice** label. `citationFor()` holds the map; the reference page at
`#/checks` gained a Source column; step detail and the printed plan render the
link under each warning. Two build checks fail on a missing source: one over the
registry, one over every warning on every fixture.

The field-practice label is the honest half of this. Ten of the 51 rules have no
Microsoft page, because the thing they check is real and undocumented: an office
on ordinary broadband, a shared phone, a name that says nothing. Those say so
rather than borrowing authority.

## One thing the audit changed about itself

The 25,000-user performance bound moved from 200 ms to 300 ms for that fixture
only, with the measurement in the comment: 183 ms best of four in isolation. The
test files run in parallel and the tighter bound was crossing under contention
rather than on a regression. Every other fixture keeps 200 ms.

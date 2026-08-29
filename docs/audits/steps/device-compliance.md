# Audit sheet — device controls

**Goals:** `require-managed-device`, `block-unsupported-platforms`,
`mobile-app-protection`, `device-registration-mfa`, `intune-enrollment-reauth`,
`token-protection`. **Family:** device. **Can deny access:** yes.

Two beliefs this project held going in are **wrong**, and one of the tool's
policies is built on a control Microsoft retired five months ago.

## The two corrections

**1. A device with no compliance policy is COMPLIANT by default, not blocked.**
Intune's tenant-wide setting *Mark devices with no compliance policy assigned as*
defaults to **Compliant**: "This security feature is off. Devices that aren't
sent a device compliance policy are considered *compliant*." Microsoft then
advises: "If you use Conditional Access with your device compliance policies,
change this setting to **Not compliant**" [S10].

So the risk is the mirror image of what audit-program §3 assumed. The dangerous
states are:

- Setting left at **Compliant**: the tenant believes it has device controls and
  is granting access to every enrolled device, policed or not. A *false sense of
  protection*, not a lockout.
- Setting flipped to **Not compliant**: every enrolled device with no policy
  assigned is blocked at once. *That* is the lockout.

The genuinely blocked population is different again: a device that is
**unregistered or unenrolled** has no compliance status at all and is blocked by
the grant control. For a small business that is the BYOD estate, not the
"enrolled but unpoliced" one.

**2. Requiring a compliant device does NOT block Intune enrolment.** Microsoft
states it twice: "You can enroll your new devices to Intune even if you select
**Require device to be marked as compliant** for **All users** and **All
resources**… The **Require device to be marked as compliant** control **doesn't
block Intune enrollment**" [S11]. The only exclusion documented on that page is
Windows Store for Business (`45a330b1-b1ec-4cc1-9161-9f03992aa49f`) for
Subscription Activation.

Telling an admin to exclude the enrolment apps would create a permanent bypass
for no benefit. That guidance must not ship.

> Documentation conflict, flagged: `intune/device-enrollment/configure-multifactor-authentication`
> says "**Important: Don't configure Device based access rules for Microsoft
> Intune enrollment**" and then instructs the reader to select "Require device to
> be marked as compliant" on the Microsoft Intune Enrollment app. Microsoft's own
> page contradicts itself; no guidance is generated from it.

## The retired control the tool still emits

`concept-conditional-access-grant` [S12], verbatim:

> **Warning.** The approved client app grant is retiring in early March 2026.
> Organizations must transition all current Conditional Access policies that use
> **only** the Require Approved Client App grant to Require Approved Client App
> **or** Application Protection Policy by March 2026. Additionally, **for any new
> Conditional Access policy, only apply the Require application protection policy
> grant.**

The tool's `mobile-app-protection` goal has floor `{"grant":
"approvedApplication"}` — exactly the shape Microsoft says not to create, on a
control that retired in March 2026. Today is August 2026. **This is the most
serious correctness defect found in the audit.**

## Every population that could be caught

| Population | What happens | Source |
|---|---|---|
| Unregistered / BYOD devices | Blocked: no compliance state exists | S10, S12 |
| macOS, Linux (non-Ubuntu), Windows Home | Outside "Windows 10+, iOS, Android, macOS, and Linux Ubuntu devices registered with Microsoft Entra ID and enrolled with Intune" | S12 |
| Microsoft Edge InPrivate on Windows | "considered as a noncompliant device" | S12 |
| Devices in the **Error** compliance state | State held for up to 7 days, then flips to Not compliant — a tenant looks healthy for a week, then mass-blocks | S13 |
| Devices offline past the **compliance status validity period** (default 30 days) | "the device is treated as noncompliant" — laptops back from a month away are blocked with no policy change | S13 |
| Devices in the **grace period** | Noncompliant but still granted access; the safe rollout lever, default 0 days | S13 |
| iOS / macOS / Android and non-Microsoft browsers | Prompted to select a client certificate, and "prompts may repeat until the device is made compliant" — including **in report-only** | S12, S8 |
| Device code flow sign-ins | Cannot satisfy device grant controls at all: "the device that is performing authentication can't provide its device state" | S12 |
| Windows/Linux browsers under an iOS+Android app-protection policy | Not blocked — simply outside it. Microsoft advises a companion "block unsupported or unknown platforms" policy | S12, S14 |
| Kaizala, Skype for Business, Visio | Do not support Require app protection policy; the "or" clause does not rescue them | S12 |

## Dependencies it assumes exist

1. Intune licences for the users, and Entra ID P1 [S14].
2. Devices **registered in Microsoft Entra ID** before they can be marked
   compliant [S12].
3. At least one compliance policy **created and assigned**, plus a decision on
   the tenant-wide "no policy assigned" setting [S10].
4. For hybrid join: `DomainJoined: YES`, `AzureAdJoined: YES`,
   `WorkplaceJoined: NO`; Windows 10+/down-level only, not Home editions [S15].
5. For `device-registration-mfa`: the legacy tenant setting **Require
   Multifactor Authentication to register or join devices** must be set to
   **No**, "Otherwise, Conditional Access policies with this user action aren't
   properly enforced" [S16].

## Every way a person can be stranded

| # | Stranding | Source |
|---|---|---|
| 1 | Personal/unregistered device, compliance required, no exception | S12 |
| 2 | The tenant-wide "no policy assigned" flag flipped to Not compliant with no policy in place | S10 |
| 3 | Error state ages out after 7 days | S13 |
| 4 | 30-day validity period expires while a laptop is away | S13 |
| 5 | Passwordless-first tenant deadlock: WHfB and device-bound passkeys cannot satisfy the register/join user action "because those scenarios require the device to be already registered" | S16 |
| 6 | Device filter built with a positive operator silently never matches unregistered devices; built with a negative operator it exempts **every** unregistered device on the internet | S17 |
| 7 | Token protection blocks unsupported clients outright (PowerShell to SharePoint, Office perpetual, Surface Hub, Teams Rooms) | S18 |

## Comparison with what the steps say today

| Claim | Status | Fix |
|---|---|---|
| `mobile-app-protection` emits the retired approved-client-app grant alone | **wrong**, severe | Change the floor to app protection policy; add the companion unsupported-platforms advice |
| "No compliance policy assigned" behaviour and the tenant-wide setting | **missing** | New rule + step content |
| Requiring compliance does not block enrolment | **missing** (and the project's own design doc says the opposite) | Step content; delete the belief from audit-program §3 |
| Grace period as the rollout lever | **missing** | Step content |
| Error state 7-day and validity-period 30-day cliffs | **missing** | Failure modes |
| Exact supported platform list | **partial** — "Macs, Linux and mobile devices that Intune does not cover here" is vague | Name the list |
| Report-only prompts for certificates on macOS/iOS/Android, repeatedly | **missing** — and it contradicts "report-only affects nobody" | Step content + a caveat on the report-only promise |
| Device code flow cannot satisfy device controls | **missing** | Step content |
| The legacy "Require MFA to register or join devices" toggle | **missing** | Blocking rule for `device-registration-mfa` |
| Token protection GA/preview split and blocked clients | **missing** | Step content |
| Device filter negative-operator hazard | **missing** | Rule (warning) |
| Kaizala/Skype/Visio gap | **missing** | Step content |
| Names personal devices, kiosks, contractors, platforms as danger areas | **present** | — |
| Counts who owns no compliant device | **present** | — |

Fourteen claims: 10 missing, 1 wrong, 1 partial, 2 present.

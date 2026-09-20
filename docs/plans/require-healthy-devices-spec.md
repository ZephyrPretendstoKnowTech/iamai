# Require Healthy Devices: the wave spec

The V1 spec (`v1-procedure.md` §5) for step group `devices`
(`src/roadmap/stepGroups.ts`), taken vertically: one outcome per step, every
technical claim rechecked against Microsoft Learn, and one acceptance test per
item. It follows `close-doors-spec.md`, `protect-admins-spec.md`,
`mfa-everyone-spec.md` and `where-people-sign-in-spec.md`, which took groups 3–6
through the same procedure.

**Every Microsoft fact below was rechecked on 2026-09-20.** The date beside a
page is its own `ms.date`, read from the live page on that day.

**Frozen, and not touched by this wave:** the four Establish Emergency Access
steps and the four Direction steps. Nothing of theirs moved, and no snapshot of
theirs moved. The policy anatomy is Emergency Access's: no component, class,
heading, pill or tag is added here, and the three things that looked like they
needed one are in `policy-anatomy-deviations.md`.

**Phone width is not a consideration for this wave.** Every reading in §7 was
taken at 1280.

---

## 1. The sources

| Key | Page | `ms.date` | Checked |
|---|---|---|---|
| `ms-ca-grant` | https://learn.microsoft.com/entra/identity/conditional-access/concept-conditional-access-grant | 2026-06-02 | 2026-09-20 |
| `ms-device-compliance-ca` | https://learn.microsoft.com/entra/identity/conditional-access/policy-all-users-device-compliance | 2026-03-24 | 2026-09-20 |
| `ms-ca-conditions` | https://learn.microsoft.com/entra/identity/conditional-access/concept-conditional-access-conditions | 2026-06-02 | 2026-09-20 |
| `ms-ca-filters` | https://learn.microsoft.com/entra/identity/conditional-access/concept-condition-filters-for-devices | 2026-03-24 | 2026-09-20 |
| `ms-hybrid-join` | https://learn.microsoft.com/entra/identity/devices/concept-hybrid-join | 2025-06-27 | 2026-09-20 |
| `ms-intune-compliance` | https://learn.microsoft.com/intune/device-security/compliance/overview | 2026-07-02 | 2026-09-20 |
| `ms-intune-noncompliance` | https://learn.microsoft.com/intune/device-security/compliance/configure-noncompliance-actions | 2024-01-23 | 2026-09-20 |
| `ms-intune-enroll` | https://learn.microsoft.com/intune/device-enrollment/enroll-devices | 2026-04-29 | 2026-09-20 |
| `ms-intune-enroll-mfa` | https://learn.microsoft.com/intune/device-enrollment/configure-multifactor-authentication | 2024-12-11 | 2026-09-20 |
| `ms-intune-ca-scenarios` | https://learn.microsoft.com/intune/device-security/conditional-access-integration/scenarios | 2025-03-19 | 2026-09-20 |
| `ms-session-lifetime` | https://learn.microsoft.com/entra/identity/conditional-access/concept-session-lifetime | 2026-04-08 | 2026-09-20 |
| `ms-session-howto` | https://learn.microsoft.com/entra/identity/conditional-access/howto-conditional-access-session-lifetime | 2026-04-02 | 2026-09-20 |
| `ms-autopilot-selfdeploy` | https://learn.microsoft.com/autopilot/self-deploying | 2024-09-13 | 2026-09-20 |
| `ms-teams-ca` | https://learn.microsoft.com/microsoftteams/rooms/conditional-access-and-compliance-for-devices | 2026-07-06 | 2026-09-20 |
| `ms-teams-supported-ca` | https://learn.microsoft.com/microsoftteams/rooms/supported-ca-and-compliance-policies | 2026-07-06 | 2026-09-20 |
| `ms-assignment-network` | https://learn.microsoft.com/entra/identity/conditional-access/concept-assignment-network | 2026-04-01 | 2026-09-20 |
| `ms-ca-platform-configure` | https://learn.microsoft.com/entra/identity/conditional-access/policy-all-users-approved-app-or-app-protection | 2026-03-24 | 2026-09-20 |
| `ms-ca-location-configure` | https://learn.microsoft.com/entra/identity/conditional-access/policy-all-users-security-info-registration | 2026-03-24 | 2026-09-20 |
| `ms-ca-cloud-apps` | https://learn.microsoft.com/entra/identity/conditional-access/concept-conditional-access-cloud-apps | 2026-03-24 | 2026-09-20 |
| `ms-ca-overview` | https://learn.microsoft.com/entra/identity/conditional-access/overview | 2026-04-27 | 2026-09-20 |
| `ms-intune-licensing` | https://learn.microsoft.com/intune/fundamentals/licensing | 2026-05-13 | 2026-09-20 |

Three pages this wave started from have moved, and the old paths were recorded
in the packages: `intune/intune-service/protect/device-compliance-get-started`
now redirects to `ms-intune-compliance`,
`intune/intune-service/protect/actions-for-noncompliance` to
`ms-intune-noncompliance`, and
`intune/intune-service/enrollment/deployment-guide-enrollment` answers 404.

### Facts that hold for the whole group

- **Licence.** `ms-ca-overview`: "Using this feature requires Microsoft Entra ID
  P1 licenses", and "Customers with Microsoft 365 Business Premium licenses can
  also use Conditional Access features." Device compliance is Intune's:
  `ms-intune-licensing` names **Microsoft Intune Plan 1** as the base service and
  says "An Intune license is required for any user or device that benefits
  directly or indirectly from the Microsoft Intune service". Recorded in §8.4:
  the licensing page no longer lists which bundles include Plan 1, so no step
  says which do.

- **THE TRAP, this group's two instances.** A Conditional Access condition left
  unconfigured matches everything, and this group depends on two of them.
  - **Device platforms.** `ms-ca-conditions`: "By default, it applies to all
    device platforms." `ms-ca-platform-configure` gives the step Microsoft's own
    procedures take: "Under **Conditions** > **Device platforms**, set
    **Configure** to **Yes**."
  - **Locations.** `ms-assignment-network`: "Conditional Access policies apply to
    all locations by default." `ms-ca-location-configure`: "Under **Conditions** >
    **Locations**. 1. Set **Configure** to **Yes**."

  Both were missing from this group's procedures, and the platform one was worse
  than missing: see §3. **Corrected in all three packages and in both of the
  steps' own portal references.**

  Recorded honestly, the same way `where-people-sign-in-spec.md` §9.1 did: Learn
  writes the explicit "when set to **No** it applies to all…" sentence only for
  **Client apps** (`ms-ca-conditions`). For Device platforms and for Locations it
  states the default and sets the toggle in its own procedures, and never writes
  that sentence. This wave follows Microsoft's procedure and states the
  consequence as the default behaviour the same pages give.

- **An unconfigured condition can also be the target, and is then said as one.**
  Require a Fresh Sign-in for Intune Enrollment wants `clientAppTypes: ["all"]`,
  which is **Configure: No**. Its procedure said "Client apps: All", which reads
  as four boxes to select; selecting them writes the four named types, not `all`,
  and IAMAI reads that as a difference that never resolves. Corrected the way
  `protect-admins-spec.md` C5 corrected the same shape.

- **Report-only first** (V1 §3.8) on all three policies. Nothing here claims
  report-only enforces anything.

- **IAMAI has no Intune permission.** No step in this group claims to know what
  any compliance policy says. The compliant-device threshold is read from the
  Entra device objects' own compliance flag and is now labelled as what it
  counts (§3, D8); the Intune prerequisite says in as many words that IAMAI reads
  no Intune policy, so the operator has to check it.

---

## 2. What the group is, and what it is not

Four members, in registry order:

1. `s-goal-require-managed-device` — Require a Managed Device Outside the Office
2. `s-goal-intune-enrollment-reauth` — Require a Fresh Sign-in for Intune Enrollment
3. `s-ladder-phone-access-restriction` — Keep Company Data Off Phones
4. `s-shared-devices` — Give Shared Devices Their Own Policy

Members 1 and 2 stand or fall on the device answer (`roadmap/deviations.ts`
`deviceStepDoesntApply`): where the answer leaves no platform in scope, both go
to the footer with the answer as the reason. Member 3 exists **only** where the
answer keeps company data off phones (`roadmap/generate.ts`
`devicePlan?.phones === 'none'`). Member 4 is independent of the device answer
and waits on the trusted network and on the shared-accounts decision.

`s-goal-mobile-app-protection` is the fifth device goal the engine knows
(`deviations.ts` `APP_PROTECTION_GOAL`) and is in no group, because the pinned
baseline carries no such policy and nothing generates the step
(`stepGroups.ts`). Its Learn facts are recorded in §8.6 so the next wave that
reaches it does not start from nothing.

---

## 3. `s-goal-require-managed-device` — Require a Managed Device Outside the Office

**Outcome.** *Away from the trusted network, work access needs a device this
business manages — one Intune has marked compliant, or a Microsoft Entra hybrid
joined Windows computer — and a device only registered in Entra meets neither.*

**Applies when.** The device answer leaves at least one platform in scope. Its
prerequisites are the emergency accounts, the exclusions group and the trusted
network.

**Baseline reading.** Pinned member `660ab461-0de5-4b00-baea-ec7325280f60`,
`IAC - INTUNE - GRANT - RequireCompliantDevice`: All users with resolved
exclusions, All resources, `clientAppTypes: ["all"]`, locations Include All /
Exclude AllTrusted, grant `compliantDevice` OR `domainJoinedDevice`, no session
controls, **no platform condition**. The device answer adds one
(`deviations.ts` `excludePlatforms`).

**Microsoft facts.**

1. **THE TRAP, and it was worse than a missing toggle.** Where the device answer
   narrowed the platforms, the JSON channel carried
   `"platforms":{"includePlatforms":["all"],"excludePlatforms":["android","iOS"]}`
   and **the Entra procedure did not mention Device platforms at all**. An
   operator following the screen wrote a policy that demands a managed device on
   the phones the business said it does not manage. The screen and the export
   said different things about the same policy. **Fixed at the source**: the
   platform words come from the same translator the location words do
   (`ui/surfaces/stepPackage.ts`, new binding `policy.target.platformWords`,
   read off `roadmap/portalLines.ts`'s own `Conditions → Device platforms →`
   line), and the procedure sets both conditions through their **Configure**
   toggles. A target with no platform condition binds nothing and the line omits
   itself, so the pinned baseline's own shape reads exactly as it did.
2. **What "Require device to be marked as compliant" accepts.** `ms-ca-grant`:
   "Devices must be registered in Microsoft Entra ID before they can be marked as
   compliant", and "Only supports Windows 10+, iOS, Android, macOS, and Linux
   Ubuntu devices registered with Microsoft Entra ID and enrolled with Intune."
   Registration is a precondition, not the control. Stated in the outcome and in
   the prerequisite block.
3. **Without a compliance policy the control does nothing you meant.**
   `ms-device-compliance-ca`: "Without a compliance policy created in Microsoft
   Intune, this Conditional Access policy won't function as intended." Not stated
   anywhere before. **Added**, beside the fact that IAMAI cannot read one.
4. **The Intune path moved.** `ms-intune-compliance`: "sign in to Microsoft
   Intune admin center and go to **Endpoint security** > **Device compliance** >
   **Compliance policy settings**." The package and the step's own before-line
   both said *Devices → Compliance → Compliance policy settings*. **Corrected in
   both**, and in `scripts/walkContent.mjs` ACCEPTANCE item 25, which pinned the
   old path.
5. **The permissive value is the default.** `ms-intune-compliance` on **Mark
   devices with no compliance policy assigned as**: "**Compliant** (*default*):
   This security feature is off", and "If you use Conditional Access with your
   device compliance policies, change this setting to **Not compliant**." The
   step said to set it and never said what it ships as. **Added.**
6. **Two different Intune timers, and the step conflated them.**
   `ms-intune-compliance`: "**Compliance status validity period (days)** … If a
   device fails to report its compliance status for a policy before the validity
   period expires, the device is treated as noncompliant", and "By default, the
   period is set to 30 days." `ms-intune-noncompliance`: "Each compliance policy
   includes **Mark device noncompliant** as a built-in default action, scheduled
   to trigger immediately at zero days", on the field **Schedule (days after
   noncompliance)**. The risk said "the compliance validity period runs out,
   thirty days by default" without naming the field, and the procedure asked for
   "a grace period of 3 days" without naming the field it goes in. **Both now
   name their field, and the built-in 0 is stated**, because 3 is a change from
   it and not a setting that is already there.
7. **The platform-limit risk was three wrong things in one line.** It read
   "Windows Home editions, Linux builds Intune cannot mark compliant, and Edge
   InPrivate." `ms-hybrid-join` lists the operating systems hybrid join supports
   as "Windows 11 or Windows 10 except Home editions" — so Home fails *hybrid
   join*, not compliance. `ms-intune-compliance` supports Linux compliance on
   "Ubuntu Desktop, version 24.04 LTS or 26.04 LTS" and "RedHat Enterprise Linux
   9 or 10" — so it is the build, named. `ms-ca-grant` says InPrivate fails
   **both**: "Microsoft Edge in InPrivate mode on Windows is considered as a
   noncompliant device", and "Doesn't consider Microsoft Edge in InPrivate mode
   as a Microsoft Entra hybrid joined device." **Corrected to say which limit
   each one is.**
8. **Device code flow cannot meet this grant at all.** `ms-ca-grant`: "When you
   use the device-code OAuth flow, the required grant control for the managed
   device or a device state condition isn't supported." A help-desk fact the step
   never had, and one that crosses into Close the Doors. **Added to help desk.**
9. **The threshold counted people and said devices.** `roadmap/readiness.ts`
   `readinessFor` takes the active people who own an in-scope compliant device
   over the active people; the tile read "30% of devices compliant". One number,
   two denominators. `CONTRACT.readinessValue.device` is now
   `{value} of people on a compliant device`, which is what it measures, and the
   measure name beside it ("device readiness") is unchanged.
10. **Hybrid join is Windows, including downlevel.** `ms-ca-grant`: "Only
    supports domain-joined Windows down-level (before Windows 10) and Windows
    current (Windows 10+) devices." The outcome says "Windows computer"; the
    downlevel detail is recorded here and is not on screen, because no plan turns
    on it.
11. The step's Learn link (`ms-device-compliance-ca`) is the page its package
    cites and the page that carries the procedure. Correct; unchanged.

**Completion from the scan.** The policy exists, is On, and its conditions,
grant, assignments and exclusions match the target, plus the device threshold.
Nothing is ticked. Whether a compliance policy exists in Intune is **not** part
of completion, because IAMAI cannot read it. A re-scan reopens the step only
when the policy's own semantics move.

**Acceptance.**
- D1 About this Step names the two device states that pass and says registration
  is neither.
- D2 the Intune prerequisite names the current path, the **Compliant** default,
  and **Schedule (days after noncompliance)**; the step's own before-line says
  the same path.
- D3 the create and correct procedures set **Configure** to **Yes** on Locations
  and on Device platforms, from the resolved words.
- D4 the device answer that narrows the platforms puts them in the Entra
  procedure, beside the JSON that carries them.
- D4b a target with no platform condition drops the platform line and leaves the
  rest of the procedure alone.
- D5 a risk names the compliance status validity period and its 30-day default.
- D6 the platform-limit risk says which limit each item is.
- D7 help desk says a device code sign-in cannot meet this grant.
- D8 the threshold tile counts the people on a compliant device.
- D9 the step says IAMAI reads no Intune policy, on the step and in the
  procedure.
- D10 the package's checked date is 2026-09-20.

---

## 4. `s-goal-intune-enrollment-reauth` — Require a Fresh Sign-in for Intune Enrollment

**Outcome.** *Enrolling a device in Intune asks the person to sign in again, so
an open session cannot quietly turn a device into a managed one — and that is
all it does: no MFA requirement, no compliance.*

**Applies when.** The same device answer as the step above, plus the Microsoft
Intune Enrollment service principal existing in the tenant.

**Baseline reading.** Pinned member
`IAC - APP - SESSION - IntuneEnrollment-SIFEveryTime`: All users with resolved
exclusions, target resource `d4ebce55-015a-49b5-a083-c84d1797ae8c` only,
`clientAppTypes: ["all"]`, **no grant**, sign-in frequency `everyTime`.

**Microsoft facts.**

1. **The target is still the documented one.** `ms-intune-enroll-mfa`: "Search
   for **Microsoft Intune Enrollment**", and "The Microsoft Intune Enrollment
   cloud app isn't created automatically for new tenants. To add the app for new
   tenants, a Microsoft Entra administrator must create a service principal
   object, with app ID d4ebce55-015a-49b5-a083-c84d1797ae8c". The package's
   whole resource-missing state rests on that sentence, and it holds.
   `ms-intune-ca-scenarios` keeps the two apps apart: "**Microsoft Intune** -
   This application controls access to the Microsoft Intune admin center", and
   "**Microsoft Intune Enrollment** - This application controls the enrollment
   workflow." No deprecation or rename found.
2. **Every time on this app is Microsoft's own idea.** `ms-session-lifetime`
   lists the scenarios it is for, including "Securing sensitive user actions like
   Microsoft Intune enrollment", and defines it: "When you select **Every time**,
   the policy requires full reauthentication **when the session is evaluated**."
   The step asserted the behaviour without the source; **the procedure now says
   both**.
3. **Microsoft's own enrollment recipe is stricter than the pin, in a direction
   the pin deliberately does not go.** `ms-intune-enroll-mfa` tells the admin to
   "Select **Require multifactor authentication**. Select **Require device to be
   marked as compliant**." The pinned baseline adds no grant at all. The baseline
   is not changed (CLAUDE.md: the pinned baseline wins), and **the procedure now
   says which one the operator is following** instead of leaving the difference
   silent. Recorded in §8.1.
4. **And Microsoft warns against half of its own recipe here.**
   `ms-intune-enroll-mfa`, Important: "Don't configure **Device based access
   rules** for Microsoft Intune enrollment." The package forbade it; the step's
   own words did not. **Added as a risk, with the reason** — a device cannot
   already be compliant at the moment it is being enrolled.
5. **The loop warning is Microsoft's.** `ms-session-lifetime`: "Using sign-in
   frequency to require reauthentication every time, without multifactor
   authentication might result in sign-in looping for your users." That is
   exactly this policy (no grant, Every time), and the engine already holds the
   step on it (`generate.ts` session-loop). Now sourced; the shared card that
   states it is recorded in `policy-anatomy-deviations.md`.
6. **Nobody is prompted twice in five minutes.** `ms-session-howto`: "The system
   accounts for five minutes of clock skew when **every time** is selected in
   policy, so users aren't prompted more often than once every five minutes."
   **Added to help desk**, because "it asked me twice" is the call.
7. **The devices that cannot answer on their own.** `ms-intune-enroll-mfa`: "A
   second device or a Temporary Access Pass is required to complete the MFA
   challenge for these types of corporate-owned devices: Android Enterprise fully
   managed devices… iOS/iPadOS devices enrolled via Apple automated device
   enrollment; macOS devices enrolled via Apple automated device enrollment."
   **Added to help desk.**
8. **Self-deploying Autopilot sees no person, so it sees no prompt.**
   `ms-autopilot-selfdeploy`: "Self-deploying mode uses a device's Trusted
   Platform Module (TPM) 2.0 hardware to authenticate the device into an
   organization's Microsoft Entra tenant." The package said so in its
   troubleshooting model; **it is a risk on the step now**, because it decides
   what evidence the operator has to go and get.
9. **The "Register or join devices" user action is a different mechanism, and
   this step is not it.** `ms-ca-cloud-apps` describes that user action and its
   limits ("`Require multifactor authentication` and `Require auth strength` are
   the only access controls available"), and Learn documents enrolment MFA only
   through the Intune Enrollment cloud app. The two are never equated. Recorded
   in §8.2 with what could **not** be verified.
10. The step's Learn link is `ms-session-lifetime`, pinned by
    `walkContent.mjs` ACCEPTANCE C2, and it is the page that carries fact 2 and
    fact 5. Correct; unchanged.

**Completion from the scan.** The policy is On with its target and Every time
matching, plus a controlled user-driven enrollment recorded as manual evidence —
one of the V1 §3.3 exceptions, because no scan sees a prompt. A re-scan reopens
the step when the policy's semantics move.

**Acceptance.**
- E1 About this Step is the outcome and says what the control is not.
- E2 the client-apps condition is left unconfigured and the procedure says what
  that means, in the create and in the correction.
- E3 the procedure says the baseline adds no grant where Microsoft's own recipe
  adds one.
- E4 a risk carries Microsoft's instruction against a device-based rule, and its
  reason.
- E5 a risk says a self-deploying device never sees this prompt.
- E6 help desk names the devices that need a second device or a Temporary Access
  Pass, and the five-minute skew.
- E7 the manager line still says user-driven enrollment asks for a fresh
  authentication (`walkContent.mjs` item 34).
- E8 the package's checked date is 2026-09-20.

---

## 5. `s-ladder-phone-access-restriction` — Keep Company Data Off Phones

**Outcome.** *iOS and Android are blocked by a policy this tenant wrote, because
leaving them out of the managed-device rule only means that rule never asks them
anything.*

**Applies when.** The device answer's phone half is "Keep company data off
phones" (`generate.ts`). No fixture reaches it without that answer, so it has no
step snapshot; §7 records it from the demo with the answer saved.

**Not a policy step.** Its content kind is `ladder`, it has no implementation
package, and its completion is manual evidence — the operator records the
policy, its scope and the test.

**What it was.** Four sentences that told the operator to "Use an appropriately
scoped Conditional Access restriction for those platforms" and left them to
design it. No portal path, no field names, no policy shape, no exclusions, no
report-only. It was the weakest step of the four by a distance, and it is the
one the device answer creates *because the operator asked for something
stricter*.

**Microsoft facts.**

1. **The shape.** `ms-ca-conditions` on the device-platform condition: "Use
   device platform with Microsoft Intune device compliance policies or as part of
   a block statement." This is the block statement. The procedure is now eight
   numbered steps: the portal path, All users with the emergency exclusions group
   excluded, All resources, **Conditions → Device platforms → Configure: Yes**
   with Android and iOS included, Grant → Block access, report-only for a working
   week, a test on a real phone of each kind with recovery checked from a
   computer, and the record.
2. **THE TRAP, and here it is a lockout.** `ms-ca-conditions`: "By default, it
   applies to all device platforms"; `ms-ca-platform-configure` sets **Configure**
   to **Yes**. A Block policy whose platform condition was never configured
   blocks every platform, which is every computer in the tenant. **The procedure
   says the toggle and says that consequence.**
3. **The platform is a claim, not a fact.** `ms-ca-conditions`: "Conditional
   Access identifies the device platform using information provided by the
   device, such as user agent strings. Because user agent strings can be
   modified, this information isn't verified." The step's old words gestured at
   this ("An operating-system condition is not a complete data-loss-prevention
   control") without the mechanism. **The risk now names it**, and a second risk
   says plainly that this stops a sign-in and is not a data-loss control.
4. **Everyone loses phone access, including the people on call.** Not a Microsoft
   fact; the consequence of the answer, and the call the help desk gets on day
   one. **Added as a risk**, with the instruction to agree the exception route
   first.
5. **The Learn link was the wrong page.** It pointed at
   `ms-device-compliance-ca`, a compliance how-to, on a step whose whole subject
   is the device-platform condition. It now links `ms-ca-conditions`, the page
   that carries that section and facts 1–3.
6. **The row said nothing.** Its Impact column read "Tenant settings", the
   `rowWho.ts` placeholder. It reads **Phone access**, added under
   `pages.app.plan.impactLabels` — the same content key every other named row
   uses, so no new mechanism.

**Completion from the scan.** It cannot be: IAMAI does not know which policy the
operator wrote, and a policy IAMAI did not plan carries no plan tag. Manual
evidence — a V1 §3.3 exception — recorded through the step's Workflow Check.

**Acceptance.**
- P1 About this Step says the answer needs a policy of its own, and names the two
  platforms.
- P2 the procedure sets **Configure** to **Yes** on Device platforms and says
  what **No** would block.
- P3 the exclusion is the emergency exclusions group, never an account by name.
- P4 the policy is created in report-only, tested on real phones of both kinds,
  and the result is recorded; Completion Criteria is that outcome.
- P5 a risk says the platform is what the client reports and Microsoft does not
  verify it, and the step does not claim to be a data-loss control.
- P6 the step links the page that carries the Device platforms condition.
- P7 the row's Impact is **Phone access**, not the placeholder.

---

## 6. `s-shared-devices` — Give Shared Devices Their Own Policy

**Outcome.** *The room systems and shared devices this tenant confirmed have one
policy of their own — allowed on the approved network, blocked anywhere else —
and are out of the policies written for people.*

**Applies when.** The shared-accounts decision names at least one account, and
the trusted network resolves to exactly one named location.

**Microsoft facts.**

1. **The design is Microsoft's own.** `ms-teams-ca`: "Exclude your Teams Rooms
   resource accounts from all existing Conditional Access policies and create a
   new policy specific to the resource accounts." That is this step, both halves
   of it. Recorded; the design does not change.
2. **Why a prompt is fatal, in Microsoft's words.** `ms-teams-ca`: "Don't require
   user interactive multifactor authentication (MFA). User interactive MFA isn't
   supported for Teams Rooms resource accounts since the resource accounts don't
   have a second device to approve the MFA request." And: "Teams device resource
   accounts should be excluded from any policies requiring action to be taken
   during the sign in flow". The step said a prompt "can stop a room device from
   signing in"; **help desk now says there is no second device, and that the fix
   is an exclusion rather than another method.**
3. **Two controls this plan hands out that a Teams device cannot meet.**
   `ms-teams-supported-ca`'s support matrix: **Sign-in frequency — not
   supported** on either Teams Rooms Windows or Teams Android, because "using the
   sign-in frequency policy causes devices to periodically sign out"; and
   **Require authentication strength — not supported**, with "Authentication
   strength including but not limited to, FIDO2 Security keys, isn't supported
   for use with Conditional Access policies that affect all Teams Devices."
   The plan's Limit How Long Sessions Last and Shorten Admin Sessions set the
   first; Require Phishing-Resistant MFA for Admins and Require MFA for Guests
   set the second. Neither was named anywhere on this step. **Both are risks
   now**, and the review procedure names them where it tells the operator to go
   through the other policies.
4. **THE TRAP, and on this step it is the worst one in the group.** The policy's
   grant is **Block access**, narrowed to everywhere except the trusted network.
   `ms-assignment-network`: "Conditional Access policies apply to all locations
   by default"; `ms-ca-location-configure` sets **Configure** to **Yes**. A
   location condition left unconfigured turns this into a policy that blocks the
   shared devices everywhere, the meeting room included. It was missing from the
   package's create, from its correction, from its manual review **and** from the
   step's own portal reference. **Corrected in all four.**
5. **Compliant device is supported for these accounts; hybrid join is not.**
   `ms-teams-supported-ca`: Require device to be marked as compliant —
   "Supported"; Require Microsoft Entra hybrid joined device — "Not supported".
   Recorded, not on screen: this step's policy sets neither, and Require a
   Managed Device Outside the Office reaches All users, so a tenant with both
   needs these accounts excluded there too — which is what the step's second half
   already tells the operator to do, policy by policy.
6. **Licence.** `ms-teams-ca`: "A Microsoft Entra ID P1 Service Plan is required
   to use Conditional Access which is included in the Microsoft Teams Rooms Pro
   and Shared Device licenses." Recorded; the step states no licence of its own.
7. **The package had no verified source at all**, so the step showed no "Source
   checked" line while every other policy step did. Four are recorded now, and
   the step reads **Source checked Sep 20, 2026**.
8. **The card over the work said nothing.** With no `whatToDo.lead`, the contract
   fell through to `CONTRACT.actions.prepare` — "Make the object this step
   names." — on a step that delivers a policy and a set of exclusions. A lead of
   its own replaces it (`stepContract.ts` reads the step's own words first where
   it has them); no code changed.

**Recorded for the owner — Microsoft against the pinned design (§8.3).**
`ms-teams-ca` asks for one group: "Include all Microsoft 365 room resources
accounts associated with Teams Rooms in one Microsoft Entra ID user group." IAMAI
includes the confirmed accounts by object id, which is what its own
owner-confirmation step resolves. The design is unchanged. Separately,
`ms-teams-supported-ca` lists five resources not to block for Teams devices
— "Office 365, Office 365 SharePoint Online, Microsoft Teams Services,
**Microsoft Intune Enrollment**, & Device Registration Service" — and this
policy blocks All resources off the trusted network, which is the point of it.
Recorded, not changed.

**Completion from the scan.** The dedicated policy is On and matches, the
confirmed accounts are excluded from the person-interactive policies, and a
successful test of each device's real work task is recorded as manual evidence.

**Acceptance.**
- S1 About this Step is the outcome.
- S2 the Tasks Remaining card says this step's own work, not "Make the object
  this step names."
- S3 the create, the correction and the review all set **Configure** to **Yes**
  on Locations and say what **No** would block, and so does the step's own
  portal reference.
- S4 the grant is Block with no interactive control, and the line says why.
- S5 sign-in frequency and authentication strength are risks of this step.
- S6 help desk says the account cannot answer a prompt, and that the fix is an
  exclusion.
- S7 Completion Criteria still ends on the tested work task from the approved
  network (`walkContent.mjs` item 7).
- S8 the package's checked date is 2026-09-20, where it had none at all.

---

## 7. Rendered at 1280, on the demo and the follow-up scan

Read on `http://localhost:5211/planner/?demo=1#/plan`, 2026-09-20. Phone width is
not a consideration for this wave.

| State | Step and snapshot | What it reads |
|---|---|---|
| Waiting on the foundation and on the Direction answer | Require a Managed Device Outside the Office, initial, device answer open | «On Hold · Waiting on your direction». Tasks Remaining: the policy card «Core - Require - Compliant device for Office 365 · 3 checks remaining · Report-only · Clear what this step is waiting on», then «Threshold · 30% of people on a compliant device», then three prerequisites and the Direction answer, each with its link. The one Implementation Task is «Create the policy in Report-only»; its step 5 sets **Configure** to **Yes** on Locations, and there is no Device platforms line because the baseline has no platform condition. «Source checked Sep 20, 2026». |
| Free to create, with the device answer saved | Require a Managed Device Outside the Office, follow-up | «Ready · Create». The card reads «Create the policy in report-only on Sep 22, 2026; turning it on waits for device readiness to reach 80%». Step 5 now carries both lines, the second reading «Device platforms: set Configure to Yes — at No it reaches every platform, including the ones your device answer left out — then Include: Any device; Exclude: Android, iOS · your choice; the baseline's version: no such condition.» The JSON tab shows the same exclusion. |
| Report-only, observing, held on its own hazard | Require a Fresh Sign-in for Intune Enrollment, follow-up | «On Hold · Report-only». Next check «Ready to enforce»; the bar reads «Review MFA before enabling Every time». Cards: Observation · Report-only, the shared session-loop Prerequisites card, and a «Tenant fact» card (§8.5). Completion Criteria is the four shared policy lines plus «The enrollment paths you use work, and user-driven enrollment asks for a fresh authentication.» |
| Waiting on the foundation | Require a Fresh Sign-in for Intune Enrollment, initial | «On Hold · Waiting on your direction», with the same session-loop card. The create procedure's step 5 reads «Conditions: leave every condition unconfigured, **Client apps** included…» and step 6 names the baseline's missing grant against Microsoft's recipe. |
| Ready to review, nothing deployed | Keep Company Data Off Phones, initial and follow-up (device answer saved) | «HARDENING STEP · Ready · Review», Impact «Phone access». The one task is the eight-step procedure; its step 4 is the Device platforms toggle and step 6 is report-only for a working week. Completion Criteria: «iOS and Android are blocked by a policy of this tenant's own…» |
| Waiting on its object, decision unanswered | Give Shared Devices Their Own Policy, initial | «Up Next». The policy card reads «Confirm which accounts belong to shared devices, give them their own policy, and take them out of the policies that ask a person to act», and beside it «Prerequisite · To do · Define the Trusted Network» and the unanswered «Shared device accounts: Not answered yet: the suggestion is Boardroom». |
| Ready to review, accounts confirmed | Give Shared Devices Their Own Policy, follow-up | «Ready · Review», Impact «1 account». The review task now sets **Configure** to **Yes** on Locations and names the two controls a Teams device cannot meet. «Source checked Sep 20, 2026». Completion Criteria unchanged. |
| Set aside by the answer | Require a Managed Device Outside the Office and Require a Fresh Sign-in for Intune Enrollment | Where the device answer leaves no platform in scope, both go to the footer with the answer as the reason (`deviations.ts`). Not re-read in this wave; unchanged by it. |
| Ready to enforce, and Enforced | not reached by either snapshot for this group | No fixture puts one of these four in `Ready · Ready to enforce` or in `Completed · Enforced`. Recorded, not invented; the same gap `close-doors-spec.md` §7 and `protect-admins-spec.md` §8.3 record. |

One reading that is the anatomy's, not this group's words, and was left alone
(`policy-anatomy-deviations.md`): a step with no submittable operation titles its
one Implementation Task with the **step's own name**, so Keep Company Data Off
Phones and Give Shared Devices Their Own Policy both draw a task called after
themselves.

The group heads «Require Healthy Devices · 2 of 3 steps» with the device answer
open and «3 of 4» with it saved, and numbers its rows 1, 2, 4 in the lane that
holds them, because the numbers are registry positions and Keep Company Data Off
Phones is position 3.

---

## 8. Recorded for the owner

1. **Microsoft against the pinned baseline, Intune enrollment.**
   `ms-intune-enroll-mfa` tells the admin to add **Require multifactor
   authentication** *and* **Require device to be marked as compliant** to the
   Intune Enrollment policy, with "Require all the selected controls". The pinned
   baseline adds no grant at all and sets only the session control. The baseline
   is unchanged (CLAUDE.md: the pinned baseline wins). The step now says which
   one the operator is following rather than leaving the reader to discover it on
   the linked page. The second half of Microsoft's own recipe also sits against
   its own warning on the same page — "Don't configure **Device based access
   rules** for Microsoft Intune enrollment" — which is a contradiction inside one
   Learn page, not one IAMAI introduced.

2. **What could not be verified, and was therefore not written.** Three claims
   that circulate about this area have no Learn page behind them as of
   2026-09-20, and none of them is on a step:
   - that the **Register or join devices** user action does not apply to Intune
     enrollment. Learn documents enrolment MFA only through the Intune Enrollment
     cloud app and registration MFA only through the user action, and never
     equates or separates them in words. The exclusions that *are* documented —
     hybrid joined devices, Azure VMs, Autopilot self-deployment — belong to the
     **device setting** `Require Multifactor Authentication to register or join
     devices`, per `manage-device-identities` (ms.date 2026-06-17), not to the
     user action;
   - that Microsoft warns against sign-in frequency on the Intune Enrollment app
     for Autopilot self-deploying flows. `ms-intune-enroll-mfa` **instructs** Every
     time on that app, and `ms-autopilot-selfdeploy` carries no Conditional Access
     warning at all. This step's self-deploying risk therefore says only what the
     Autopilot page supports: the device authenticates with its own TPM and no
     person, so it produces no prompt to prove;
   - that any device-filter property is "not trustworthy". `ms-ca-filters` marks
     **displayName**, **manufacturer** and **model** as not "System defined or
     admin configured" and recommends "using at least one system defined or admin
     configurable device property", which is a weaker and different statement. No
     step in this group uses a device filter, so nothing was written either way.

3. **Microsoft against the pinned design, shared devices.** `ms-teams-ca` asks
   for one Entra group holding every Teams Rooms resource account; IAMAI includes
   the owner-confirmed accounts by object id. And `ms-teams-supported-ca` names
   five resources not to block for Teams devices, one of which is Microsoft Intune
   Enrollment, while this step's policy blocks All resources off the trusted
   network. Both recorded; neither changed.

4. **Intune licensing is no longer enumerable from Learn.**
   `ms-intune-licensing` says "Intune is included only with the licenses listed
   on the Microsoft Intune plans and pricing page" and links out. No step in this
   group names a bundle, and none should until that page is treated as a source.

5. **A Tasks Remaining card that says its own kind twice.** On Require a Fresh
   Sign-in for Intune Enrollment, follow-up, a card reads «Tenant fact · Tenant
   fact». `ui/surfaces/stepContract.ts` `engineTiles` ends in a fallback that
   uses the blocker's label as both the card's label and its value, so any
   blocker kind with no words of its own says its kind twice. It is shared engine
   behaviour that reaches other groups' steps, so this wave recorded it in
   `policy-anatomy-deviations.md` instead of changing it.

6. **`s-goal-mobile-app-protection` is the device goal nobody generates.** It is
   in no group and the pinned baseline has no such policy, so it draws nowhere.
   The facts the next wave will need, checked 2026-09-20: `ms-ca-grant` — "App
   protection policies are generally available for iOS and Android, and in
   preview for Microsoft Edge on Windows"; the grant "requires that the device is
   registered in Microsoft Entra ID, which requires using a broker app", either
   Microsoft Authenticator on iOS or Company Portal on Android; "Kaizala, Skype
   for Business, and Visio don't support the **Require app protection policy**
   grant… Using the 'or' clause between the two grants won't work for these three
   applications"; and "The approved client app grant is retiring in early March
   2026", with organisations told to move to "Require Approved Client App **or**
   Application Protection Policy by March 2026". Learn shows an OR of
   {approved app | app protection} and an OR of {MFA | compliant | hybrid}, but
   no worked example of {compliant device **or** app protection policy}.

7. **Six red assertions this wave did not write and did not fix.** All six are
   about steps of the Turn On MFA for Everyone group, whose wave reworded the
   content and left the assertion behind. This wave touched neither the content
   nor the assertions, because they belong to another group's steps.
   - `src/ui/surfaces/riskDeviceCampaignContentSpecs.test.ts`, "MFA preparation
     explains registration, support and useful campaign setup…": it asserts
     `s-verify-mfa`'s Done when reads "Everyone in this step has a **suitable**
     registered MFA method". `d7838e26` reworded it to "Everyone in this step has
     a registered MFA method they can use".
   - `src/ui/surfaces/stepContentPass.test.ts`, "the campaign and the exclusions
     group finish on what their step docs say": the same step's Done when is
     asserted to read "**Administrators have** a phishing-resistant method", and
     it now reads "Every administrator has a phishing-resistant method."
   - `src/ui/surfaces/beforeLines.test.ts`, "each policy step carries its before
     lines in its own whatToDo": its `device-registration-mfa` pattern expects a
     line beginning "Prepare and validate the replacement Conditional Access
     policy first". That step's before line now begins "While Entra ID → Devices →
     Overview → Device Settings…". Because `device-registration-mfa` is the first
     entry in that test's table, the whole test stops there; this wave's own entry
     in the same table was updated for D2 and is correct.
   - `src/ui/surfaces/registerInfoTargetWords.test.ts`, three fixtures: each
     asserts the Entra create reads `Conditions > Locations: **Include: Any
     location; Exclude: All trusted locations**.` `2535621f` gave that package the
     **Configure: Yes** wording — the same correction this wave made to its own
     three packages — and the assertion was not moved with it.

   Everything else in the files this wave runs is green.

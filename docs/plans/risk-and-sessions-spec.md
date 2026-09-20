# Respond to Risk and Limit Sessions: the wave spec

The V1 spec (`v1-procedure.md` §5) for step group `risk-and-sessions`
(`src/roadmap/stepGroups.ts`), taken vertically: one outcome per step, every
technical claim rechecked against Microsoft Learn, and one acceptance test per
item. It follows `close-doors-spec.md` and `protect-admins-spec.md`, which took
groups 3 and 4 through the same procedure.

**Every Microsoft fact below was rechecked on 2026-09-20.** The date beside a
page is its own `ms.date`, read from the live page on that day.

**Frozen, and not touched by this wave:** the four Establish Emergency Access
steps and the four Direction steps. No Emergency Access or Direction snapshot
moved. The policy anatomy is Emergency Access's: no component, class, heading,
pill or tag was added, and anything that looked like it needed one is in
`policy-anatomy-deviations.md`.

Acceptance tests: `src/ui/surfaces/riskAndSessions.test.ts`, one per item.

---

## 1. The sources

| Key | Page | `ms.date` | Checked |
|---|---|---|---|
| `ms-risk-signin` | https://learn.microsoft.com/entra/identity/conditional-access/policy-risk-based-sign-in | 2026-03-24 | 2026-09-20 |
| `ms-risk-user` | https://learn.microsoft.com/entra/identity/conditional-access/policy-risk-based-user | 2026-03-24 | 2026-09-20 |
| `ms-risk-configure` | https://learn.microsoft.com/entra/id-protection/howto-identity-protection-configure-risk-policies | 2025-10-30 | 2026-09-20 |
| `ms-risk-policies` | https://learn.microsoft.com/entra/id-protection/concept-identity-protection-policies | 2026-05-15 | 2026-09-20 |
| `ms-risk-detections` | https://learn.microsoft.com/entra/id-protection/concept-risk-detection-types | 2026-06-10 | 2026-09-20 |
| `ms-risk-risks` | https://learn.microsoft.com/entra/id-protection/concept-identity-protection-risks | 2026-04-22 | 2026-09-20 |
| `ms-risk-remediate` | https://learn.microsoft.com/entra/id-protection/howto-identity-protection-remediate-unblock | 2026-05-15 | 2026-09-20 |
| `ms-idp-overview` | https://learn.microsoft.com/entra/id-protection/overview-identity-protection | 2025-10-30 | 2026-09-20 |
| `ms-idp-b2b` | https://learn.microsoft.com/entra/id-protection/concept-identity-protection-b2b | 2025-08-06 | 2026-09-20 |
| `ms-session-howto` | https://learn.microsoft.com/entra/identity/conditional-access/howto-conditional-access-session-lifetime | 2026-04-02 | 2026-09-20 |
| `ms-session-concept` | https://learn.microsoft.com/entra/identity/conditional-access/concept-session-lifetime | 2026-04-08 | 2026-09-20 |
| `ms-prompts-session-lifetime` | https://learn.microsoft.com/entra/identity/authentication/concepts-azure-multi-factor-authentication-prompts-session-lifetime | 2025-03-04 | 2026-09-20 |
| `ms-mfa-settings` | https://learn.microsoft.com/entra/identity/authentication/howto-mfa-mfasettings | 2026-02-27 | 2026-09-20 |
| `ms-token-concept` | https://learn.microsoft.com/entra/identity/conditional-access/concept-token-protection | 2026-08-14 | 2026-09-20 |
| `ms-token-windows` | https://learn.microsoft.com/entra/identity/conditional-access/deployment-guide-token-protection-windows | 2026-03-24 (updated 2026-09-10) | 2026-09-20 |
| `ms-token-apple` | https://learn.microsoft.com/entra/identity/conditional-access/deployment-guide-token-protection-apple | 2026-08-14 | 2026-09-20 |
| `ms-ca-conditions` | https://learn.microsoft.com/entra/identity/conditional-access/concept-conditional-access-conditions | 2026-06-02 | 2026-09-20 |
| `ms-grant-controls-v1` | https://learn.microsoft.com/graph/api/resources/conditionalaccessgrantcontrols?view=graph-rest-1.0 | 2026-04-06 | 2026-09-20 |
| `ms-ca-grant` | https://learn.microsoft.com/entra/identity/conditional-access/concept-conditional-access-grant | 2026-06-02 | 2026-09-20 |
| `ms-sif-graph` | https://learn.microsoft.com/graph/api/resources/signinfrequencysessioncontrol | 2024-07-22 | 2026-09-20 |

### Facts that hold across this group

- **Licence.** The four risk steps need Entra ID P2. `ms-idp-overview`'s licence
  table puts "Risk policies … Sign-in and user risk policies (via ID Protection
  or Conditional Access)" at **No / No / Yes** across Free, P1 and P2, and
  `ms-risk-policies`: "**Microsoft Entra ID P2** is required to use risk-based
  access policies." The two session steps need only P1: `ms-token-windows`,
  "Using this feature requires Microsoft Entra ID P1 licenses."
- **What a P1 tenant sees, and what this tool reads.** `ms-risk-risks`:
  "Customers without Microsoft Entra ID P2 licenses receive detections titled
  **Additional risk detected** without risk detection details", and the licence
  table gives P1 "Limited Information. No risk detail or risk level is shown" on
  risky sign-ins and **No** on the Graph risk reports. IAMAI holds no risk-report
  scope at all (`src/graph/collect/registry.ts`): the only risk it reads is the
  level on a sign-in record, and `graph/collect/laneBCore.ts riskLevelOf` reads
  `hidden` or any unrecognised value as **unknown**, never as none. §3 and §4
  make the words say that.
- **The Configure trap, this group's three instances.** `ms-ca-conditions` for
  device platforms: "By default, it applies to all device platforms."
  `ms-risk-signin` for sign-in risk: "Under **Conditions** > **Sign-in risk**,
  set **Configure** to **Yes**". `ms-token-windows` for both of its conditions:
  "Set **Configure** to **Yes**." Group 3 found this trap in the authored
  packages and group 4 fixed Client apps and Authentication flows in the
  translator; the Device platforms, Sign-in risk and User risk lines were still
  naming the boxes. **Corrected at the source (§2).**
- **Report-only first.** Microsoft's own risk recipes agree:
  `ms-risk-signin` and `ms-risk-user` both end "Confirm your settings and set
  **Enable policy** to **Report-only**." Nothing in this wave weakens that.
- **Two risk conditions never share a policy.** `ms-risk-configure`: "Don't
  combine sign-in risk and user risk conditions in the same Conditional Access
  policy. Create separate policies for each risk condition." The pin has four
  separate policies. No conflict.

---

## 2. The Configure trap, fixed in the translator

`src/roadmap/portalLines.ts` is the one place the product composes a policy
step's portal lines. It carried the toggle on Client apps and Authentication
flows and not on the three conditions this group narrows. A line that lists the
risk levels to tick without first setting **Configure** to **Yes** describes a
policy with no risk condition at all — and on these four targets that means the
authentication strength, the password change and the every-time reauthentication
reach **every** sign-in rather than the risky ones.

The three lines now read:

- `Conditions → Device platforms → Configure: Yes, then Include: Windows. Left at No it applies to all device platforms.`
- `Conditions → Sign-in risk → Configure: Yes, then High`
- `Conditions → User risk → Configure: Yes, then Medium`

The consequence of **No** is stated only where Microsoft documents it — the
device-platforms default above. `ms-risk-signin` says to set Configure to Yes
and documents nothing about No; `ms-risk-user` words the same control
"Configure user risk levels needed for policy to be enforced". Neither line
claims what an unconfigured risk condition reaches, which is the rule group 3
set for Authentication flows.

Every authored procedure and reviewer reference in this group says the same.
`scripts/walkContent.mjs` C6 compares the reference's levels against the pin and
now reads them from after the toggle.

**Acceptance.** T1.

---

## 3. `s-goal-sign-in-risk` — Challenge High-Risk Sign-ins

**Outcome.** *A sign-in this tenant rates high risk cannot continue until it is
answered with a method the baseline's authentication strength accepts.*

**Applies when.** Entra ID P2. On a P1 tenant the step is a Not licensed row
(§9).

**Baseline reading.** Pinned member `53a8df0b-4658-4835-ace2-100b5d287aac`,
`IAC - P2 - GLOBAL - GRANT - High-Risk Sign-Ins`: All users with the exclusions
group, All resources, `clientAppTypes: ["all"]`, `signInRiskLevels: ["high"]`,
grant = the custom strength `Modern MFA + TAP`, sign-in frequency `everyTime`.

**Microsoft facts.**

1. **What sign-in risk measures.** `ms-risk-signin`: "Sign-in risk represents
   the likelihood that an authentication request isn't from the identity owner."
   The old `why` said the rule fires "when Microsoft flags a sign-in as
   suspicious", which says nothing about what is being judged. **Corrected.**
2. **The Configure toggle.** `ms-risk-signin`: "Under **Conditions** >
   **Sign-in risk**, set **Configure** to **Yes**… select **High** and
   **Medium**." **Corrected everywhere (§2).**
3. **An unregistered person is blocked, not prompted.** `ms-risk-signin`: "The
   sign-in risk-based policy prevents users from registering MFA during risky
   sessions. If users aren't registered for MFA, their risky sign-ins are
   blocked, and they receive an AADSTS53004 error." Nothing said it. **Added as
   a risk and a help-desk line.**
4. **Answering the prompt clears the risk by itself.** `ms-risk-remediate`: "If
   they successfully complete the MFA challenge, the sign-in risk is
   remediated", with the state moving "'At risk' -> 'Remediated'". Help desk
   said "confirm it was the person, then dismiss the risk in Identity
   Protection", which is work nobody has to do. **Corrected.**
5. **Except where it no longer does.** `ms-risk-remediate`: "we no longer
   autoremediate sessions with MFA claims when a token theft related or the
   Verified threat actor IP detection triggers during sign-in", and then "the
   end user is required to perform secure password change and reauthenticate".
   **Added**, without naming the detections, which are Identity Protection detail
   this tool does not read.
6. **Some risk is worked out after the sign-in.** `ms-risk-detections`:
   "Detections triggered in real-time take 5-10 minutes to surface details in the
   reports. Offline detections take up to 48 hours… risk levels can change,
   because some risk detections are calculated offline after sign-in." **Added
   to the observation procedure**, because it is why a report-only window can
   still gain results.
7. **`{list:riskyUsers}` named nobody.** The two evidence lines that listed
   risky people used a binding that existed only in the example, so
   `render.ts whole()` dropped them on every real plan. The list is now the one
   the reach already counted (`roadmap/evidence.ts riskIds`, exported for it;
   `derive/contentLists.ts riskyUsers`), and it is named as what it is.

**Completion from the scan.** The policy exists, is On, and its risk condition,
grant, session control, assignments and exclusions match the target. A re-scan
reopens the step only when the policy's own semantics move; the risk readings
themselves are evidence, never completion.

**Acceptance.** A1 what sign-in risk measures · A2 Configure: Yes in create and
correct · A3 Client apps left unconfigured with the reason · A4 only the risk
reading the scan has · A5 blocked not prompted, AADSTS53004 · A6 the prompt
clears it, and where it does not · A7 Completion Criteria is the outcome · A8
the step and its package cite one page, checked 2026-09-20.

---

## 4. `s-goal-user-risk` — Remediate High-Risk Users

**Outcome.** *An account this tenant rates high risk cannot be used again until
its owner has completed the remediation the baseline's authentication strength
accepts.*

**Baseline reading.** Pinned member `544cd9ef-5e37-4568-9ad8-b8e151be1814`,
`IAC - P2 - GLOBAL - GRANT - High-Risk Users - Risk Remediation`: All users with
the exclusions groups, All resources, `userRiskLevels: ["high"]`, grant
`operator: AND`, `builtInControls: ["riskRemediation"]` **with** the custom
strength, sign-in frequency `everyTime`.

**Microsoft facts.**

1. **The grant the step described did not exist in the pin.** The reference
   line, the evidence, the outcome and the AI focus all said "Require
   multifactor authentication and Require password change". The pin holds
   **Require risk remediation** with the strength, which is also Microsoft's
   current recipe — `ms-risk-user`: "Select **Require risk remediation**. The
   **Require authentication strength** grant control is automatically selected",
   and `ms-ca-grant`: selecting it also applies "**Sign-in frequency - Every
   time**". `ms-risk-policies` on what it does: "ID Protection manages the
   appropriate remediation flow for all authentication methods." The package was
   already right; the step now agrees with it. **Corrected.**
2. **What user risk measures, and when.** `ms-risk-policies`: "ID Protection
   analyzes signals about user accounts and calculates a risk score based on the
   probability that the user is compromised." `ms-risk-detections`, offline row:
   "User is deemed risky after sign-in." Every user-risk detection but three is
   calculated offline. **Added to `why`.**
3. **Remediation needs a registered method, or there is no remediation.**
   `ms-risk-configure`: "Users must register for Microsoft Entra multifactor
   authentication before they face a situation requiring remediation… **Users
   not registered are blocked and require administrator intervention.**"
   **Added as evidence and as a risk.**
4. **It is not the self-service reset flow.** `ms-risk-remediate`: "The user
   knows their current password, authenticates with multifactor authentication
   (MFA), and then changes their password… **This flow doesn't use self-service
   password reset (SSPR).**" The step's own `more.risks` line was gated on an
   `ssprOff` variable no derivation produces, so it never rendered at all.
   **Rewritten and ungated.**
5. **The two hybrid routes, and the two pages that disagree.**
   `ms-risk-configure`: "For hybrid users that are synced from on-premises,
   password writeback must be enabled." `ms-risk-remediate`: "Hybrid users can
   complete a password change from an on-premises or hybrid joined Windows
   device, when password hash synchronization and the Allow on-premises password
   change to reset user risk setting is enabled." They describe two different
   routes with two different prerequisites. **Both are named**; neither is
   presented as the only one. Recorded in §10.
6. **A guest this policy reaches is blocked, not helped.** `ms-idp-b2b`: "If a
   guest user triggers the ID Protection user risk policy to force password
   reset, **they will be blocked**"; "**Guest users do not appear in the risky
   users report**"; "Administrators **cannot dismiss or remediate a risky B2B
   collaboration user** in their resource directory"; and the user risk itself
   "is evaluated at their home directory". `ms-risk-policies` adds: "**Require
   risk remediation** is not supported for external and guest users." The step
   had one hedged line. **Corrected to say what happens and why.**
7. **Completing it clears the risk.** `ms-risk-remediate`: "Once the password is
   changed, the user risk is remediated." Help desk said to confirm a dismissal.
   **Corrected.**
8. **`{list:atRiskUsers}` named nobody**, for the same reason as §3.7, and
   "rated at risk today" claimed a reading of Identity Protection's risky users
   report that this tool holds no scope for. **Replaced by the sign-in record's
   own rating, said as that.**

**Completion from the scan.** The policy is On and matches the target. Whether a
particular person can remediate is evidence, and the step says what makes it
impossible rather than claiming to have checked it.

**Acceptance.** B1 what user risk measures and when · B2 the pin's grant · B3
registration required, not SSPR · B4 both hybrid routes · B5 the guest is
blocked · B6 Configure: Yes, Client apps left alone · B7 the outcome, checked
2026-09-20.

---

## 5. `s-goal-sign-in-risk-medium` — Challenge Medium-Risk Sign-ins

**Outcome.** *A sign-in this tenant rates medium risk cannot continue until it is
answered with multifactor authentication.*

**Baseline reading.** Pinned member `180ab5a3-d3ae-4457-9ef1-e3c06f5dfbfc`:
All users with the exclusions group, All resources, `clientAppTypes: ["all"]`,
`signInRiskLevels: ["medium"]`, grant `builtInControls: ["mfa"]`, **no session
controls**.

**Microsoft facts.**

1. **What Medium means.** `ms-risk-detections`: "**Medium** indicates that one
   or more moderate-severity anomalies were detected, but there's less
   confidence that the account is compromised." The step said only that the rule
   "adds MFA when Microsoft rates a sign-in medium risk". **Corrected.**
2. **The grant is the built-in control, not a strength.** The reference said
   "Grant → Require authentication strength: Multifactor authentication", which
   is a different control from the one the pin holds. The package was right.
   **Corrected.**
3. **There is no session control here.** The reference added "Session →
   Sign-in frequency → Every time" to a pinned member whose `sessionControls` is
   `null`. **Removed**, and the absence is stated as a fact rather than left as
   a silence.
4. **The list was the High step's.** The medium step's reach is the medium and
   high sign-ins together (`roadmap/evidence.ts`), so it now names
   `{list:mediumRiskUsers}`, which is that same union.
5. The registration block and the self-clearing prompt of §3.3 and §3.4 apply
   here too, because the grant is still a method the person has to hold.
   **Added, in this step's own words.**

**Completion from the scan.** The policy is On and matches the target,
`sessionControls: null` included.

**Acceptance.** C1 what Medium means · C2 the pin's grant and its absent session
control · C3 Configure: Yes, Client apps left alone · C4 its own people and its
own Completion Criteria · C5 blocked not prompted here too.

---

## 6. `s-goal-user-risk-medium` — Reset Passwords for Medium-Risk Users

**Outcome.** *An account this tenant rates medium risk cannot be used again until
its owner has answered the baseline's authentication strength and changed the
password.*

**Applies when.** Entra ID P2. The owner settled on 2026-09-19 that risk
remediation covers medium-risk users, which is why this step exists beside the
High one; Microsoft's own recommendation is High only (§10.2).

**Baseline reading.** Pinned member `7475b373-0544-4ee8-8827-cff35009136d`:
All users with the exclusions groups **and every guest/external type excluded**,
All resources, `userRiskLevels: ["medium"]`, grant `operator: AND`,
`builtInControls: ["passwordChange"]` with the custom strength, **no session
controls**.

**Microsoft facts.**

1. **The grant, and the reference that contradicts the pin.** The step said
   "Require multifactor authentication and Require password change… Session →
   Sign-in frequency → Every time", which is wrong twice. `ms-grant-controls-v1`
   documents a different pair again: "`passwordChange` must be accompanied by
   `mfa` using an `AND` operator", "`passwordChange` and `riskRemediation` must
   be used separately, not in combination", both "must each be used in a policy
   containing `userRiskLevels`", "The policy should target `all` applications",
   and "The policy can't contain any other condition except `users`,
   `applications`, and `userRiskLevels`." Nothing on that page or on `ms-ca-grant`
   forbids `passwordChange` beside an authentication strength, and the pin — an
   export of a real tenant — holds exactly that.

   **The pinned baseline wins** (CLAUDE.md). The Entra procedure, the correction
   and the reviewer reference now name the pin's pair, which is what IAMAI
   compares the tenant against, and they say in the same breath that the JSON and
   PowerShell outputs write Microsoft's documented pair instead. The package's
   authors had already normalised the machine channels and flagged it; their note
   now carries the quote and the date. Recorded for the owner in §10.1.
2. **What Medium means on an account**, as §5.1.
3. **The guest exclusion is the pin's, and it is right.** The pin excludes every
   guest and external type. `ms-idp-b2b` says why that is the correct shape: a
   guest forced to change a password "will be blocked", and the password lives in
   their home directory. The step had the exclusion as a line in a procedure and
   no reason anywhere. **The reason is on the step now.**
4. **No session control**, as §5.3.

**Completion from the scan.** The policy is On and matches the target, the guest
exclusion included.

**Acceptance.** D1 the pin's pair and which channels write which · D2 password
change never beside risk remediation · D3 Configure: Yes, Client apps left alone
· D4 why guests are excluded, and its own people · D5 the outcome, checked
2026-09-20.

---

## 7. `s-goal-all-users-no-persistence` — Limit How Long Sessions Last

**Outcome.** *Nobody's browser session survives closing the browser, and every
one of them authenticates again on the interval the baseline sets.*

**Baseline reading.** Pinned member `ea9459a9-91b6-4d2b-b929-03781ac81d54`,
`IAC - GLOBAL – SESSION – All Users Persistence (9-12 Hours)`: All users with the
exclusions groups, All resources, **`clientAppTypes: ["browser"]`**, no grant,
sign-in frequency 12 hours time-based (primary and secondary), persistent browser
`never`.

**Microsoft facts.**

1. **The Configure trap, the same one group 4 found on the admin policy.** The
   target narrows client apps to Browser. The reviewer reference, the create
   procedure and the correction all named the checkbox and not the toggle, so the
   interval would have applied to Outlook on the desktop and to every mobile app.
   That is also where sign-in frequency's known issues live — `ms-session-howto`:
   "Authentication after each sign-in frequency interval might be slow and can
   take 30 seconds on average" on mobile, and iOS apps with a certificate first
   factor plus Intune app-management policies "are blocked from signing in".
   **Corrected in all three, to the translator's line.**
2. **Remember MFA on trusted devices has to be off first.** `ms-session-howto`:
   "Before enabling Sign-in Frequency, make sure other reauthentication settings
   are disabled in your tenant. If 'Remember MFA on trusted devices' is enabled,
   disable it before using Sign-in Frequency, as using these two settings
   together might prompt users unexpectedly." `ms-mfa-settings` is blunter: "The
   **remember multifactor authentication** feature isn't compatible with the
   Sign-in frequency Conditional Access control." Nothing on this step said it.
   **Added as a risk and as the procedure's first line**, said once as the
   tenant-wide setting it is, so it does not read as a second job beside Shorten
   Admin Sessions.
3. **The persistent-browser setting overrides "Stay signed in?"**
   `ms-session-howto`: "Persistent browser session configuration in Microsoft
   Entra Conditional Access overrides the 'Stay signed in?' setting in the
   company branding pane for the same user if both policies are configured."
   Group 4 put this on the admin step; it is true of everyone here.
   **Added to help desk.**
4. **Why one computer prompts and another does not.** `ms-session-concept`: "On
   Microsoft Entra joined and hybrid joined devices, unlocking the device or
   signing in interactively refreshes the Primary Refresh Token (PRT) every four
   hours", while "On Microsoft Entra registered devices, unlocking or signing in
   doesn't satisfy the SIF policy". **Added to help desk**, because it is the
   call the help desk gets.
5. **Why a persistent browser matters at all.** `ms-session-concept`: "In
   persistent browsers, cookies remain stored on the user's device even after the
   browser is closed. These cookies might access Microsoft Entra artifacts, which
   remain usable until token expiration, regardless of the Conditional Access
   policies applied." **This is now the step's `why`**, which said only that a
   non-persistent session "reduces the chance" of leaving access open.
6. **It is not a hard token lifetime.** `ms-session-concept` on "Every time":
   "the policy requires full reauthentication **when the session is evaluated**."
   The manager line said the policy "controls sign-in frequency… for the clients
   and resources in its scope", which is a restatement. **Corrected.**
7. **The interval had ten sources.** The step and the package wrote "12 hours"
   or "12-hour" in nine places beside the resolved target that already carries
   it. **Both now point at the target everywhere** — the same rule
   `protect-admins-spec.md` D4 set for Shorten Admin Sessions.
8. **Persistent browser session needs All resources.** `ms-session-howto`: "This
   control requires selecting 'All Cloud Apps' as a condition." The pin targets
   All resources and the step's risk already said so. Unchanged.
9. Recorded, not on screen: Learn documents no minimum or maximum sign-in
   frequency value on any page read, and `ms-sif-graph` gives only
   `days | hours`. Nothing in this wave states a bound.

**The two session steps.** The owner's rule is that Shorten Admin Sessions and
Limit How Long Sessions Last are two policies whose Completion Criteria each say
whose sessions they are about. Group 4 wrote the admin side; this step's third
line is its counterpart and shares no sentence with it:

- admin: «A scan confirms the session policy is On for **the administrator roles
  it names**…» and «Limit How Long Sessions Last covers these administrators too,
  as part of everyone; where both apply, the shorter sign-in frequency is the one
  that takes effect.»
- everyone: «A scan confirms the session policy is On for **all users in the
  browser**…» and «Shorten Admin Sessions asks the administrator roles it names
  to sign in more often than this; an administrator covered by both is held to
  that shorter frequency.»

Asserted by E5, which fails if either line is deleted or if one becomes the
other.

**Completion from the scan.** The policy is On for all users in the browser with
the intended frequency, persistence, assignments and exclusions, plus a human
check that ordinary browser work stays practical.

**Acceptance.** E1 Configure: Yes everywhere it is instructed · E2 Remember MFA
off first, said once · E3 the "Stay signed in?" prompt and the PRT difference ·
E4 no interval of its own (the Completion Criteria sentence names the baseline's interval rather than filling a variable, because a fixture with no resolved target would otherwise leave a hole in it) · E5 two Completion Criteria, neither the other's · E6
the outcome, checked 2026-09-20.

---

## 8. `s-goal-token-protection` — Require Token Protection on Windows

**Outcome.** *Every supported Windows desktop client reaching the resources this
policy names presents a token bound to its own device.*

**Baseline reading.** Pinned member `8bb25c6a-ed35-4556-bed4-b3aaa14e192b`,
`IAC - GLOBAL - SESSION - Windows - TokenProtection`: All users with the
exclusions groups, five named resources, `platforms.includePlatforms: ["windows"]`,
`clientAppTypes: ["mobileAppsAndDesktopClients"]`, device filter excluding
`device.systemLabels -contains "CloudPC" -and device.trustType -eq "AzureAD"`, no
grant, `secureSignInSession` enabled.

**Microsoft facts.**

1. **Both narrowed conditions take the toggle, and Microsoft says why.**
   `ms-token-windows`, Device platforms: "Set **Configure** to **Yes**." Client
   apps: "Set **Configure** to **Yes**", with the warning "**Not configuring the
   Client Apps condition, or leaving Browser selected might cause applications
   that use MSAL.js, such as Teams Web to be blocked.**" The step named the
   checkboxes only. **Corrected in the create procedure, both corrections, the
   reviewer reference and the risks.**
2. **What it silently does not cover.** `ms-token-concept`'s availability table
   gives native applications as Generally Available on Windows, iOS/iPadOS and
   macOS, browser-based as preview for web apps reaching Azure Resource Manager
   on Windows and macOS and "Not supported" on iOS. Because the policy is scoped
   to Windows and to mobile-and-desktop clients, a browser, another platform or
   another resource is never evaluated by it: not protected, and not blocked.
   Microsoft names the remedy, identically on `ms-token-windows` and
   `ms-token-apple`: "it's necessary to secure your environment against potential
   policy bypass when an attacker might appear to come from a different
   platform. In addition, you should configure the following policies: Block
   access from unknown platforms; Require device compliance for all known
   platforms." Those are two steps this plan already has. **Added to `why`, to
   the evidence and to the AI Info scope limit, naming them.**
3. **Unsupported clients are blocked, and which ones.** `ms-token-windows`: "The
   following applications don't support signing in using protected token flows
   and users are blocked when accessing Exchange and SharePoint: PowerShell
   modules accessing SharePoint; PowerQuery extension for Excel for users not in
   Current Channel updates; Extensions to Visual Studio Code which access
   Exchange or SharePoint", plus "Office perpetual clients aren't supported",
   "Surface Hub" and "Windows-based Microsoft Teams Rooms (MTR) systems". The
   step said only that "an unsupported client or device path can be blocked".
   **The list is on the step now.**
4. **An external person gets no explanation.** `ms-token-windows`: external users
   "who don't meet these requirements see an unclear error message with no
   indication of the root cause." **Added to help desk.**
5. **All three Windows join types qualify.** `ms-token-concept`: "Windows 10 or
   newer devices that are Microsoft Entra joined, Microsoft Entra hybrid joined,
   or Microsoft Entra registered." The step's evidence already reads that way.
   Unchanged.
6. **The Learn link.** The step linked `concept-token-protection` while its
   package cited the Windows deployment guide — one fact, two sources. The step
   now links the page that carries the procedure, as Close the Doors A5 settled,
   and the concept page joins the package's sources as the authority for what the
   feature reaches.
7. Recorded, not on screen: `ms-token-concept` heads its Apple block "Apple
   (Preview)" while the availability table above it says Apple native is
   "Generally Available". Microsoft has not reconciled the two. Nothing on this
   step depends on it, and no content string may carry a preview claim anyway
   (`scripts/walkContent.mjs` C3).

**Completion from the scan.** The policy is On and matches the target.
Compatibility stays a readiness gate the package owns, because no scan proves a
client can produce a bound token.

**Acceptance.** F1 both conditions through Configure: Yes · F2 Microsoft's
browser warning · F3 what it never reaches, and who covers it · F4 the clients
that cannot comply · F5 one Learn page, checked 2026-09-20 · F6 the outcome, said
once · F7 the follow-up state.

---

## 9. Rendered at 1280, on the demo and the follow-up scan

Read on `http://localhost:5212/planner/?demo=1#/plan`, 2026-09-20, and from the
step bodies on `mid`, which is the fixture that holds P2. Every state this
group's steps reach.

| State | Step and snapshot | What it reads |
|---|---|---|
| Not licensed | the four risk steps, demo and follow-up | Under «Not licensed (6)»: «Challenge High-Risk Sign-ins: needs a licence this tenant does not hold: Microsoft Entra ID P2», and the same for Remediate High-Risk Users, Challenge Medium-Risk Sign-ins and Reset Passwords for Medium-Risk Users, over «Nothing in the plan waits on these.» This is what a P1 tenant sees of this group's risk half. |
| Waiting on the foundation | Limit How Long Sessions Last and Require Token Protection on Windows, demo initial | The group heads «Respond to Risk and Limit Sessions · 2 steps», both «Up Next». Tasks Remaining: «Conditional Access policy · Core - Session - … · 3 checks remaining · Report-only · Clear what this step is waiting on», then «Prerequisite · To do · Prepare Emergency Access Accounts» and the same for Configure Emergency Exclusions, each with its link. |
| Not deployed, the procedure on screen | Limit How Long Sessions Last, demo initial | The one Implementation Task is «Create the policy in Report-only». Its first line turns off Remember multifactor authentication on trusted devices and says it covers Shorten Admin Sessions too; the Client apps line reads «set Configure to Yes, then Browser only. Left at No the condition reaches every client app, and the interval would apply to desktop and mobile apps as well»; the session line takes the interval from the intended target. «Source checked Sep 20, 2026». |
| Not deployed, the procedure on screen | Require Token Protection on Windows, demo initial | Steps 5 and 6 read «set Configure to Yes, then include Windows only. Left at No the policy applies to all device platforms» and «set Configure to Yes, then select only Mobile apps and desktop clients… Microsoft's own warning: not configuring this condition, or leaving Browser selected, can block web apps that sign in through the browser, Teams on the web among them.» |
| Report-only, observing, held | Require Token Protection on Windows, follow-up | «On Hold · Report-only». Tasks Remaining: «1 check remaining · Enforced · Continue observation and collect the missing evidence», then «Observation · Report-only · … Time elapsed alone does not complete this check» and «Waiting on your direction · Decide How People and Devices Sign In» with its link. |
| Ready to enforce, as the step draws it | Require Token Protection on Windows, follow-up with the Direction answers approved | «Up Next · Report-only», «1 check remaining · Enforced · Enable the reviewed policy, then verify the result», and the Implementation Task becomes «Turn the policy on». The badge is Up Next rather than «Ready · Ready to enforce» because one prerequisite, Verify Emergency Access, is still to do. The enforce procedure is what is on screen; the badge is the lane's. |
| Ready to create | Limit How Long Sessions Last, follow-up with the Direction answers approved | «Ready · Create», «3 checks remaining · Report-only · Create the policy in Report-only», next milestone Sep 22, 2026. |
| On Hold, waiting on direction | Limit How Long Sessions Last, follow-up before the answers | «On Hold», «Not scheduled». |
| Up Next, prerequisites only | the four risk steps, `mid` | «Up Next · After Prepare Emergency Access Accounts», one tile «Prerequisite · To do · Prepare Emergency Access Accounts». |

Read but not reached by any fixture in this group: the `Ready · Ready to
enforce` badge, a Partial correction, and an Enforced/Completed reading. The
words for those states were read from the compiled package blocks instead, which
is the rule `closeDoors.test.ts` set. Recorded, not invented.

---

## 10. Recorded for the owner

1. **Microsoft against the pinned baseline, Reset Passwords for Medium-Risk
   Users.** `ms-grant-controls-v1` (ms.date 2026-04-06) says "`passwordChange`
   must be accompanied by `mfa` using an `AND` operator". The pin pairs
   `passwordChange` with the custom authentication strength instead — a shape the
   reference does not describe and does not forbid. The baseline is unchanged.
   The Entra procedure names the pin's pair, because that is what IAMAI compares
   the tenant against; the package's deployable JSON and PowerShell keep the
   documented pair, as their authors left them, and the step says which is which.
   **The owner's decision to make:** re-pin the medium user-risk member to
   `mfa + passwordChange`, or accept that a policy built from this step's JSON
   channel reads as a difference until it is corrected by hand.
2. **Microsoft recommends a different risk shape than the pin.**
   `ms-risk-configure`: "Require Microsoft Entra multifactor authentication when
   sign-in risk level is **Medium** or **High**", in one policy, and
   "Organizations should select **Require risk remediation** when user risk level
   is **High**." The pin splits sign-in risk into two policies at two levels and
   adds a medium user-risk policy Microsoft does not recommend. The owner settled
   the medium user-risk question on 2026-09-19; the sign-in-risk split is
   recorded here and not changed.
3. **The legacy Identity Protection risk policies are being retired.**
   `ms-risk-policies` and `ms-risk-configure` both date it, within weeks of this
   spec. No content string may carry a hard date
   (`scripts/walkContent.mjs` C3), so it stays here. Nothing in this group
   depends on the legacy policies — every member is a Conditional Access policy —
   but Home, How and the public documents should be checked before V1.
4. **Two Learn pages disagree about the hybrid remediation prerequisite.**
   `ms-risk-configure` says password writeback; `ms-risk-remediate` says password
   hash synchronization with "Allow on-premises password change to reset user
   risk". They describe two different routes. Remediate High-Risk Users names
   both. If the owner knows which route the reference tenants take, one line can
   go.
5. **The device filter's syntax differs from Microsoft's example.** The pin uses
   `device.systemLabels -contains "CloudPC" -and device.trustType -eq "AzureAD"`;
   `ms-token-windows` writes `systemLabels -eq "CloudPC" and trustType -eq
   "AzureAD"`. The pin's is the portal rule builder's own form. Nothing changed;
   recorded so a reader comparing the two is not surprised.
6. **The pin omits Windows Cloud Login from token protection's resources.**
   `ms-token-windows`: where the Windows App is deployed, the resources to select
   are "Azure Virtual Desktop / Windows 365 / **Windows Cloud Login**". The pin
   has the first two and not the third, and the package explicitly forbids adding
   it. If the reference tenant deploys the Windows App, that is a gap in the pin,
   not in the step.
7. **No fixture exercises this group's Partial, Enforced or Ready-to-enforce
   badge.** The four risk steps appear only on `mid` and `huge`; the two session
   steps reach report-only on the demo's follow-up and no further. §9 says which
   readings came from the package instead. Both are gaps in the fixture set.
8. **`more` is print-only.** Risks, help desk and the manager line render only
   when `printing` is true (`ContentStep.tsx`), so this wave's risk and
   help-desk corrections reach the printed plan, the export and the prompt pack
   and not the Plan screen. The screen carries the same facts through the
   Implementation Tasks and the evidence lines, which is why the Configure
   corrections were made in both places.
9. **The same Configure trap in other groups' authored words.** The translator
   fix in §2 corrects what every policy step *renders*. Three reviewer-reference
   lines outside this group still name a device-platform selection without the
   toggle — two on `unmanaged-browser` and one on `mobile-app-protection` — and
   were left for their own waves, as `protect-admins-spec.md` §8.5 left its own
   set. Neither is a frozen step. `block-unsupported-platforms` already carries
   the toggle, from group 3.
10. **`s-goal-admin-session`'s package sits one directory too deep.**
    `docs/implementation-content/s-goal-admin-session/s-goal-admin-session/`
    holds its three files, where every other package has them at the top level.
    The compiler still registers it and nothing is broken today. It belongs to
    group 4 and is recorded here for whoever tidies the library; it is not a
    frozen step, so it is not in `frozen-step-suggestions.md`.

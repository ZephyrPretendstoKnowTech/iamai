# Turn On MFA for Everyone: the wave spec

The V1 spec (`v1-procedure.md` §5) for step group `mfa-everyone`
(`src/roadmap/stepGroups.ts`), taken vertically: one outcome per step, every
technical claim rechecked against Microsoft Learn, and one acceptance test per
item. It is the same shape as `close-doors-spec.md`, which is the model.

**Every Microsoft fact below was rechecked on 2026-09-20.** The date beside a
page is its own `ms.date`, read from the live page on that day.

**Frozen, and not touched by this wave:** the four Establish Emergency Access
steps and the four Direction steps. Anything this wave found in them is written
up in `frozen-step-suggestions.md`. **MFA Readiness is settled**: where a step's
words disagreed with that page the step was changed, and the one place the page
itself looks wrong is written up, not edited. The policy anatomy is Emergency
Access's: no component, class, heading, pill or tag is added here, and anything
that looked like it needed one is in `policy-anatomy-deviations.md`.

---

## 1. The sources

| Key | Page | `ms.date` | Checked |
|---|---|---|---|
| `ms-security-defaults` | https://learn.microsoft.com/entra/fundamentals/security-defaults | 2025-07-21 | 2026-09-20 |
| `ms-plan-ca` | https://learn.microsoft.com/entra/identity/conditional-access/plan-conditional-access | 2026-06-01 | 2026-09-20 |
| `ms-managed-policies` | https://learn.microsoft.com/entra/identity/conditional-access/managed-policies | 2026-05-28 | 2026-09-20 |
| `ms-user-states` | https://learn.microsoft.com/entra/identity/authentication/howto-mfa-userstates | 2025-07-13 | 2026-09-20 |
| `ms-turn-off-per-user` | https://learn.microsoft.com/entra/identity/monitoring-health/recommendation-turn-off-per-user-mfa | 2026-04-28 | 2026-09-20 |
| `ms-mfa-settings` | https://learn.microsoft.com/entra/identity/authentication/howto-mfa-mfasettings | 2026-02-27 | 2026-09-20 |
| `ms-campaign` | https://learn.microsoft.com/entra/identity/authentication/how-to-mfa-registration-campaign | 2026-09-15 | 2026-09-20 |
| `ms-default-enablement` | https://learn.microsoft.com/entra/identity/authentication/concept-authentication-default-enablement | 2026-05-04 | 2026-09-20 |
| `ms-passkeys` | https://learn.microsoft.com/entra/identity/authentication/how-to-authentication-passkeys-fido2 | 2026-03-08 | 2026-09-20 |
| `ms-external-ca` | https://learn.microsoft.com/entra/external-id/authentication-conditional-access | 2026-03-27 | 2026-09-20 |
| `ms-cross-tenant-b2b` | https://learn.microsoft.com/entra/external-id/cross-tenant-access-settings-b2b-collaboration | 2026-04-24 | 2026-09-20 |
| `ms-mfa-all-users` | https://learn.microsoft.com/entra/identity/conditional-access/policy-all-users-mfa-strength | 2026-03-24 | 2026-09-20 |
| `ms-strengths` | https://learn.microsoft.com/entra/identity/authentication/concept-authentication-strengths | 2025-03-04 | 2026-09-20 |
| `ms-security-info` | https://learn.microsoft.com/entra/identity/conditional-access/policy-all-users-security-info-registration | 2026-03-24 | 2026-09-20 |
| `ms-device-registration` | https://learn.microsoft.com/entra/identity/conditional-access/policy-all-users-device-registration | 2026-03-24 | 2026-09-20 |
| `ms-user-actions` | https://learn.microsoft.com/entra/identity/conditional-access/concept-conditional-access-cloud-apps | 2026-03-24 | 2026-09-20 |
| `ms-device-settings` | https://learn.microsoft.com/entra/identity/devices/manage-device-identities | 2026-06-17 | 2026-09-20 |
| `ms-network` | https://learn.microsoft.com/entra/identity/conditional-access/concept-assignment-network | 2026-04-01 | 2026-09-20 |
| `ms-sms-retirement` | https://learn.microsoft.com/entra/identity/authentication/concept-sms-voice-retirement | 2026-09-16 | 2026-09-20 |

### Facts that hold across the group

- **Licence.** Conditional Access needs Entra ID P1 (`ms-plan-ca`:
  "Microsoft Entra ID P1, P2, or a trial license"). Security defaults are free
  and need none (`ms-security-defaults`: required licenses "None"). The
  registration campaign lives in the authentication methods policy, not in
  Conditional Access, and its current page asserts no licence gate at all —
  recorded in §10.5 rather than claimed either way.
- **The trap this group hunted, and found twice.** `ms-network`: "Conditional
  Access policies apply to all locations by default." A Locations/Network
  condition whose **Configure** toggle is left at **No** does not make the
  policy inert; it makes it match everywhere, including the network the admin
  meant to carve out. This is the same class as the Client apps trap Close the
  Doors found. **Corrected in Protect Sign-in Method Registration** (§2), which
  is the one step in this group whose target carries a location rule. The second
  instance is a strength, not a condition, and is in §3 and §7.
- **Report-only first.** Every policy step in this group is created in
  report-only (V1 §3.8). For the two User Action steps that is stricter than the
  evidence it produces: `ms-user-actions` documents no report-only telemetry for
  user actions, and the device-registration package already says so.
- **An authentication strength and the built-in MFA grant are exclusive.**
  `ms-strengths`: "You can't use the **Require multifactor authentication** and
  **Require authentication strength** grant controls together in the same
  Conditional Access policy." This settles the contradiction in §5.
- **External authentication methods are incompatible with authentication
  strength** (`ms-mfa-all-users`, Warning; repeated in `ms-external-ca`): "You
  should use the **Require multifactor authentication** grant control."

---

## 2. `s-goal-register-info-protected` — Protect Sign-in Method Registration

**Outcome.** *Nobody can add a sign-in method to an account with the password
alone, and the people who legitimately need to register — a new starter, a new
phone, someone off the office network — still have a route that works.*

**Applies when.** Always. Its shape depends on Define the Trusted Network: with a
trusted network the baseline blocks registration outside it; with none the step
falls back to Microsoft's own form, Require multifactor authentication.

**Baseline reading.** The pinned package has no security-info registration policy
of its own for this goal, so the target is IAMAI's resolved one:
All users, guests and external users excluded, **Target resources > User actions >
Register security information**, Locations Include Any location / Exclude All
trusted locations, Block access — with the MFA fallback where no trusted network
exists.

**Microsoft facts.**

1. **The trap: an unconfigured location condition matches everywhere.**
   `ms-network`: "Conditional Access policies apply to all locations by default."
   `ms-security-info` step 7 sets **Configure** to **Yes** before naming Include
   and Exclude. The package's create and correct blocks named the Include and
   Exclude without it. **Corrected in `entra.create` and
   `entra.correct-conditions`.**
2. **Temporary Access Pass is Microsoft's answer to the chicken-and-egg.**
   `ms-security-info`: "Administrators have to issue Temporary Access Pass
   credentials to new users so they can satisfy the requirements for multifactor
   authentication to register." The step's readiness tile already waits on a TAP
   policy; the words never said why. **Added to help desk.**
3. **A phishing-resistant strength here re-creates the lockout TAP solves.**
   `ms-strengths`' table puts Temporary Access Pass in the Multifactor
   authentication strength and in neither Passwordless nor Phishing-resistant. A
   registration policy set to a phishing-resistant strength cannot be satisfied
   by the one credential Microsoft says to hand a new starter. **Added to help
   desk.**
4. **Guests are excluded, and the reason is TAP.** `ms-security-info`, beside the
   guest step: "Temporary Access Pass does not work for guest users." The
   resolved target already excludes guests; the reason was nowhere.
   **Added to `shared.registrationScope.excluded`.**
5. **Windows Hello for Business and macOS Platform SSO registration now run
   through this policy.** `ms-security-info`: "Starting July 6, 2026, Conditional
   Access policies that target **Register security information** will apply
   during Windows Hello for Business and macOS Platform SSO credential
   registration." That date is past. The package's `entra.observe` block said it;
   the step's own risks did not, and report-only is the one state an admin
   creating the policy is not in. **Added to the risks.** No content string
   carries the date (`scripts/walkContent.mjs` C3); it stays here.
6. The step's Learn link is `policy-all-users-security-info-registration`, the
   page that carries the procedure. Correct; unchanged.

**Recorded for the owner (§10.1).** Microsoft's own recommended grant on this page
is **Require authentication strength**, with the example policy named "Combined
Security Info Registration with TAP". IAMAI's resolved target is Block access
outside the trusted network, with Require multifactor authentication as the
fallback. Both are safe; they are not the same policy. Not changed.

**Completion from the scan.** The policy exists, is On, and its conditions,
grant, assignments and exclusions match the target. A re-scan reopens the step
only if the policy's own semantics move.

**Acceptance.**
- A1 the create procedure sets **Configure** to **Yes** before naming the
  location Include and Exclude.
- A2 the correct-conditions procedure does the same.
- A3 help desk says a Temporary Access Pass is how a person with no method
  registers.
- A4 help desk says a phishing-resistant strength does not accept a Temporary
  Access Pass, so it locks out the person it was meant to help.
- A5 the guest-scope line says guests are excluded *because* a Temporary Access
  Pass does not work for them.
- A6 a risk names Windows Hello for Business and Platform SSO registration as
  going through this policy.
- A7 the package's checked date is 2026-09-20.

---

## 3. `s-goal-device-registration-mfa` — Require MFA to Register a Device

**Outcome.** *Adding a device to this tenant asks for a second factor, and every
way this organisation actually enrols devices still finishes.*

**Applies when.** The tenant registers or joins devices. It waits on Confirm What
You Use.

**Baseline reading.** Pinned member `IAC - INTUNE – GRANT – Device Registration -
MFA Strength`: All users with resolved exclusions, **User actions > Register or
join devices**, grant **Require authentication strength: Modern MFA + TAP**
(`windowsHelloForBusiness`, `fido2`, `x509CertificateMultiFactor`,
`temporaryAccessPassOneTime`).

**Microsoft facts.**

1. **The second trap: two of the pinned strength's four combinations cannot be
   used here.** `ms-user-actions`, under Register or join devices: "Windows Hello
   for Business and device-bound passkeys aren't supported because those
   scenarios require the device to be already registered." The pinned strength
   leads with exactly those two. What is left for an ordinary person is a
   certificate or a one-time Temporary Access Pass. A tenant whose whole MFA plan
   is passkeys would find this policy unsatisfiable and never learn why from the
   step. **Added to the risks and to the create procedure.**
2. **The legacy toggle is not hygiene; it decides whether this policy works at
   all.** `ms-device-registration` and `ms-user-actions`, identically: "you must
   set **Entra ID** > **Devices** > **Overview** > **Device Settings** -
   `Require Multifactor Authentication to register or join devices with Microsoft
   Entra` to **No**. Otherwise, Conditional Access policies with this user action
   aren't properly enforced." The step said to set it to No after enforcement,
   without saying what leaving it at Yes costs. **Corrected in `whatToDo.before`
   and the risks.**
3. **The setting's own page names it differently, and gives its default.**
   `ms-device-settings`, which owns the setting: "Require multifactor
   authentication to register or join devices with Microsoft Entra ID", and "The
   default is **No**." Its path is **Devices > Overview > Device Settings**. The
   step had the short path and the short name. **Corrected.**
4. **Only two grant controls exist for this user action.** `ms-user-actions`:
   "`Require multifactor authentication` and `Require auth strength` are the only
   access controls available with this user action and all others are disabled."
   **Added to the create procedure.**
5. **Three conditions are unavailable, not merely unwise.** `ms-user-actions`:
   "`Client apps`, `Filters for devices`, and `Device state` conditions aren't
   available with this user action because they're dependent on Microsoft Entra
   device registration". The step said "Do not add device-state conditions to
   this policy; a first join has no device to check" — the right instinct, the
   wrong fact. **Corrected in the reference procedure.**
6. **The grant in the step's own reference disagreed with the pin.** The step's
   reference said "Require authentication strength: Multifactor authentication";
   the pin resolves Modern MFA + TAP, and the Implementation Task binds the
   resolved name. One fact, two sources. **The reference now reads the resolved
   strength.**
7. **Not claimed, deliberately.** Learn documents the join-type scope (Entra
   joined / registered, not hybrid joined) for the *legacy toggle only*
   (`ms-device-settings`), never for the Conditional Access user action; and no
   current Learn page says this policy breaks Windows Autopilot, OOBE or hybrid
   join. Both are widely asserted elsewhere. Neither is stated on the step. §10.2.

**Completion from the scan.** The policy is On and matches the target, exclusions
included, and the tenant-wide device-registration MFA setting reads No
(`tenant.deviceRegistration.multiFactorAuthConfiguration`, read with
`Policy.Read.All`). Enrollment-workflow validation is manual evidence — a V1
§3.3 exception, and the readiness tile already says IAMAI cannot prove it.

**Acceptance.**
- B1 a risk states that Windows Hello for Business and device-bound passkeys
  cannot satisfy this policy, because the device is not registered yet.
- B2 the create procedure says the same where the strength is chosen.
- B3 `whatToDo.before` says the policy is not properly enforced while the
  tenant-wide setting is Yes.
- B4 the setting is named and pathed as its own Learn page names it.
- B5 the reference procedure says the three conditions are unavailable, not that
  they are a bad idea.
- B6 the reference procedure's grant is the resolved strength, not a hard-coded
  one.
- B7 the package's checked date is 2026-09-20.

---

## 4. `s-verify-mfa` — Prepare Your Team for MFA

**Outcome.** *Everyone who will be asked for MFA already has a method they can
use, and the few who cannot get there on their own are named and helped.*

**Applies when.** Always, before the policies that wait on it.

**Microsoft facts.**

1. **The campaign nudges passkeys now, not only the Authenticator app.**
   `ms-campaign`: "The registration campaign allows you to nudge users to set up
   a passkey or Microsoft Authenticator during sign-in", and it "supports two
   authentication methods: **Passkey (FIDO2)** … **Authenticator**", with "A
   registration campaign can target only one authentication method at a time."
   The step told the admin to configure an Authenticator campaign and to "check
   the separate passkey registration instructions for passkeys", which is a year
   out of date. **Corrected in `whatToDo.generic` and the package's
   `entra.campaign` and `entra.configure` blocks.**
2. **Guests: Authenticator yes, passkey no — and this is the owner's rule,
   confirmed.** `ms-campaign`: "They're nudged if they're included in a
   registration campaign for Authenticator. They're not nudged if they're
   included in a registration campaign for passkeys because passkey support for
   guest users isn't currently available." And `ms-passkeys`, Known issues:
   "Registration of passkey (FIDO2) credentials isn't supported for internal or
   external guest users, including B2B collaboration users in the resource
   tenant." The owner's 2026-09-19 rule — guests stay in the campaign, counted as
   "N people and M guests", and a guest row asks for Microsoft Authenticator,
   never a passkey — is exactly what Learn requires. **Stated on the step for the
   first time: a passkey campaign reaches nobody's guests.**
3. **Who the nudge actually reaches.** `ms-campaign`, Enabled state, Authenticator:
   users who "Sign in by using **any MFA method**", "Are enabled for Authenticator
   push notifications in the authentication methods policy", and "Don't already
   have Authenticator push set up". So an admin who already holds a security key
   is still nudged to install an app — a downgrade nudge the step never warned
   about. **Added to the risks.**
4. **A setting in another blade silently switches the campaign off.**
   `ms-campaign`, prerequisites: "**Authentication mode** must be set to **Any**
   or **Push**. If the mode is set to **Passwordless**, users aren't eligible for
   the nudge." A tenant that hardened Authenticator to passwordless gets a
   campaign that is Enabled and nudges nobody. **Added to the configure
   procedure.** This is the group's third instance of the trap class.
5. **The prompt needs a fresh interactive MFA.** `ms-campaign`: "The nudge
   doesn't trigger if the user is already signed in with SSO", "Microsoft
   Authenticator registration campaigns aren't supported on mobile devices", and
   "Can I nudge my users if I'm not using Microsoft Entra MFA? **No.**" The
   package said only that it "depends on their eligibility … and on the snooze
   settings". **Corrected to name the conditions.**
6. **The snooze fields, exactly.** `ms-campaign`: the field is **Days allowed to
   snooze** (Graph `snoozeDurationInDays`, "Range: 0 to 14 … Default: one day"),
   and **Limited number of snoozes** — "**Enabled**: Users can skip the prompt
   three times, after which they must register the targeted authentication
   method." The step said "Number of days allowed to snooze" and "after the
   allowed snoozes". **Corrected to the field names and to three.**
7. **Microsoft managed is no longer the weaker option.** `ms-default-enablement`
   lists Registration campaign's Microsoft managed value as **Enabled**, and its
   migration table moves the targeted method from Microsoft Authenticator to
   Passkeys (FIDO2) and the audience from "Voice call or text message users" to
   "All multifactor authentication (MFA) capable users". `ms-sms-retirement`
   says the same from the other end: "Your Registration Campaign settings will be
   set to Microsoft Managed state targeting passkeys, and will automatically
   bring these users into scope." The package told the admin to choose Enabled
   "not Microsoft managed, because the plan keeps an explicit Microsoft
   Authenticator campaign" — which, read today, is advice to narrow a nudge
   Microsoft has already widened. **Corrected: the choice is stated as a choice,
   and what Microsoft managed now does is stated beside it.**
8. **A guest can only ever satisfy four methods in your tenant.**
   `ms-external-ca`, Table 1, Resource tenant column: SMS, voice call, Microsoft
   Authenticator push notification, OATH software token. **Added to help desk**,
   where the guest line already pointed at the home tenant.

**Completion from the scan.** MFA Readiness's states are the campaign's groups
(`scoring/phishingResistant.ts` through `derive/contentLists.ts`); the support
list is the one saved answer. Nothing else is ticked.

**Acceptance.**
- C1 the campaign instructions say the campaign targets one method at a time and
  name both.
- C2 the step says a passkey campaign does not nudge guests.
- C3 a risk says the Authenticator nudge reaches someone who already holds a
  stronger method.
- C4 the configure procedure names the Authenticator **Authentication mode**
  prerequisite.
- C5 the campaign block names the conditions under which the prompt appears
  (interactive Entra MFA, not SSO, not on a mobile device).
- C6 the snooze fields read **Days allowed to snooze** and **Limited number of
  snoozes**, and say three.
- C7 the configure procedure states what Microsoft managed does now instead of
  dismissing it.
- C8 help desk names the four methods a guest can use in this tenant.
- C9 Completion Criteria is split so each line says one thing.
- C10 the package's checked date is 2026-09-20.

---

## 5. `s-goal-mfa-all-users` — Require MFA for Everyone

**Outcome.** *Every person who signs in to this tenant is asked for a second
factor, with only the emergency exclusions and the directory synchronisation
account outside it.*

**Baseline reading.** Pinned member `IAC - GLOBAL - GRANT - MFA - AllUsers`: All
users with resolved exclusions, All resources with **Microsoft Intune
Enrollment** (`d4ebce55-015a-49b5-a083-c84d1797ae8c`) excluded, grant
`builtInControls: ["mfa"]` — **Require multifactor authentication**.

**Microsoft facts.**

1. **The step contradicted itself about its own grant.** `who.evidence` said
   "This policy uses Require multifactor authentication"; the reference procedure
   said "Grant → Require authentication strength: Multifactor authentication".
   These are two different controls, and `ms-strengths` says they cannot both be
   set: "You can't use the **Require multifactor authentication** and **Require
   authentication strength** grant controls together in the same Conditional
   Access policy." The pin is `builtInControls: ["mfa"]`, and the pinned baseline
   wins (CLAUDE.md). **The reference procedure now says Require multifactor
   authentication.**
2. **A text message is no longer just unreliable; it is being retired.**
   `ms-sms-retirement`: "SMS and voice are no longer positioned as secure
   authentication methods and will no longer be provided natively in Entra ID",
   and a user "whose **only available MFA method is SMS or voice**" will be
   "required to register a passkey during sign-in", a prompt that "is
   **blocking**". The step's risk said only that the text might not arrive.
   **Corrected.** The milestone dates stay here (C3).
3. **What Microsoft excludes, and why.** `ms-mfa-all-users`: break-glass
   accounts, and "If you use hybrid identity solutions like Microsoft Entra
   Connect or Microsoft Entra Connect Cloud Sync, select **Directory roles**,
   then select **Directory Synchronization Accounts**". The step's
   `{syncRoleNote}` already carries this. Unchanged.
4. **Service principals are outside a user-scoped policy.** `ms-mfa-all-users`:
   "Calls made by service principals aren't blocked by Conditional Access
   policies scoped to users." The step's fourth risk already says it. Unchanged.
5. **The tenant may already carry Microsoft's own version of this policy.**
   `ms-managed-policies` lists "Multifactor authentication for all users" among
   the Microsoft-managed policies: "The policy is automatically created in your
   tenant in a **Report-only** state", Microsoft enables it "no less than 30 days
   after they're introduced … if they're left in the **Report-only** state", and
   "Organizations can't rename or delete any Microsoft-managed policies."
   `{existingCoverage}` can find such a policy and an admin cannot act on it the
   way the step's correction assumes. **Added to help desk.**

**Recorded for the owner (§10.3).** `ms-mfa-all-users` is emphatic that this
policy should have no resource exclusions: "Microsoft recommends all
organizations create a baseline Conditional Access policy that targets: All
users, all resources without any app exclusions". The pin excludes Microsoft
Intune Enrollment and hands that resource to a separate step. The pin is not
changed.

**Completion from the scan.** The policy is On and matches the target,
assignments and exclusions included.

**Acceptance.**
- D1 the reference procedure's grant is **Require multifactor authentication**,
  the same control `who.evidence` names.
- D2 the SMS risk says the method itself is being retired and that the person
  will be required to register a passkey.
- D3 help desk says a Microsoft-managed policy of the same name cannot be
  renamed or deleted.
- D4 the package's checked date is 2026-09-20.

---

## 6. `s-goal-guests-mfa` — Require MFA for Guests

**Outcome.** *Every external account that signs in here proves who it is with a
method it can actually use.*

**Baseline reading — two policies, and not the two the step described.**

| Pinned policy | External-user types | Grant |
|---|---|---|
| `IAC - GLOBAL - GRANT - MFA - Mixed-Guests` | `b2bCollaborationGuest`, `otherExternalUser` | Require multifactor authentication |
| `IAC - GLOBAL - GRANT - MFA - B2B-Guest` | `internalGuest`, `b2bCollaborationMember`, `b2bDirectConnectUser`, `serviceProvider`, all external tenants | Require authentication strength: **Modern MFA + TAP** |

The step's reference procedure described Policy A as every guest type and Policy
B as B2B collaboration guests and members from *selected* partner tenants. That
is not what the pin holds, on either policy. **Rewritten to the pin.**

**Microsoft facts.**

1. **A guest can satisfy four methods in your tenant, and Modern MFA + TAP
   contains none of them.** `ms-external-ca`, Table 1, Resource tenant column:
   SMS as second factor, Voice call, Microsoft Authenticator push notification,
   OATH software token. Modern MFA + TAP allows Windows Hello for Business,
   FIDO2, certificate-based authentication and a Temporary Access Pass — every
   one of which is home-tenant-only or, for TAP, not available to guests at all
   (`ms-security-info`: "Temporary Access Pass does not work for guest users").
   So Policy B is satisfiable **only** where inbound MFA trust is on with that
   guest's home tenant and the home tenant issues a qualifying claim. This is the
   wave's answer to v1-procedure §5.4's "The guest strength must be one external
   users can meet". **Stated on the step, in the risks and the reference
   procedure.**
2. **What the home tenant's claim actually covers.** `ms-cross-tenant-b2b`,
   Trust settings: "**Trust multifactor authentication from Microsoft Entra
   tenants**: Select this checkbox to allow your Conditional Access policies to
   trust MFA claims from external organizations. During authentication, Microsoft
   Entra ID checks a user's credentials for a claim that the user completed MFA.
   If not, an MFA challenge is initiated in the user's home tenant." And the
   framing that matters: "your MFA policies are still applied to external users,
   but users who already completed MFA in their home tenants don't have to
   complete MFA again in your tenant". Trust does not waive the policy; it moves
   where MFA is satisfied. **Added to `who.evidence`.**
3. **With no trust — the default — the guest registers in your tenant, and a
   direct-connect user is blocked.** `ms-external-ca`: "When no trust settings
   are configured and MFA is required, B2B collaboration users are prompted for
   MFA. They need to satisfy MFA in the resource tenant. **Access is blocked for
   B2B direct connect users.**" The pinned Policy B includes
   `b2bDirectConnectUser`. **Added to the risks.**
4. **Only home-tenant claims count, and only the listed ones.**
   `ms-external-ca`: "If a resource tenant opts to trust claims from external
   Microsoft Entra organizations, **only those claims listed in the 'Home tenant'
   column are accepted**."
5. **GDAP is not covered by the trust setting.** `ms-cross-tenant-b2b`: "This
   setting isn't applied if an external user signs in using granular delegated
   admin privileges (GDAP) … MFA is always required in the user's home tenant,
   and always trusted in the resource tenant." The step's third help-desk line
   already keeps GDAP and B2B apart; it is now a cited fact rather than a
   caution.
6. **Authentication strengths do not reach every external identity.**
   `ms-external-ca`: "Currently, you can only apply authentication strength
   policies to external users who authenticate with Microsoft Entra ID. For email
   one-time passcode, SAML/WS-Fed, and Google federation users, use the MFA grant
   control to require MFA." **Added to the risks**, because Policy B is a
   strength.
7. **The selector was renamed.** `ms-external-ca`: "The 'All guest and external
   users' selection has now been replaced with 'Guest and external users' and all
   its sub types … This change in UX doesn't have any functional impact." The
   Conditional Access pages still print "Guest or external users", which is what
   the step uses. Recorded in §10.4; no change.
8. **Requiring MFA for guests does not add a bill.**
   `ms-external-ca` / External ID pricing: the resource tenant needs premium
   licences that support MFA, and external users are metered by monthly active
   users with a free tier. Not stated on the step, and not added — the step makes
   no licence claim.
9. **The Learn link moved.** The step pointed at
   `entra/external-id/b2b-tutorial-require-mfa`, a tutorial. The page that
   carries Table 1, the trust settings and the no-trust behaviour is
   `entra/external-id/authentication-conditional-access`. One fact, two sources.
   **The step now uses the page the facts come from.**

**Completion from the scan.** Both policies are On with the intended settings.
Representative guest sign-ins on each path are manual evidence (V1 §3.3), which
the step's own verification lines already ask for.

**Acceptance.**
- E1 the reference procedure's two policies are the pin's two, by external-user
  type.
- E2 a risk says a guest can only use SMS, voice, Authenticator push or an OATH
  software token in this tenant.
- E3 a risk says a Temporary Access Pass is not available to a guest, so a
  strength that relies on one needs the home tenant's claim.
- E4 `who.evidence` says the trust setting decides where MFA is satisfied, not
  whether the policy applies.
- E5 a risk says a B2B direct connect user is blocked outright when no trust is
  configured.
- E6 a risk says an authentication strength does not reach one-time-passcode,
  SAML/WS-Fed or Google-federated guests.
- E7 the step's Learn link is `authentication-conditional-access`.
- E8 the package's checked date is 2026-09-20.

---

## 7. `s-prereq-security-defaults` — Turn Off Security Defaults

**Outcome.** *Security defaults are off, and every protection they were giving
this tenant is now given by a policy this plan owns.*

**Applies when.** Security defaults are on.

**Microsoft facts.**

1. **The step's central claim about coexistence was not Learn's.** It said
   "Report-only policies can exist while security defaults are on; an enforced
   one cannot." No Learn page says that. What `ms-plan-ca` says is the reverse
   direction: "Conditional Access and security defaults aren't meant to be
   combined because **creating Conditional Access policies prevents you from
   enabling security defaults**", and `ms-security-defaults`: "Organizations that
   choose to implement Conditional Access policies that replace security defaults
   **must disable security defaults**." **Corrected**, and the rollback line,
   which already said re-enabling may need the policies changed first, is now the
   sentence Learn supports.
2. **Security defaults block device code flow, and the step's replacement list
   was one policy short.** `ms-security-defaults`: "After security defaults are
   enabled in your tenant, authentication requests that use device code flow are
   blocked", and the enforced list now reads "Blocking device code flow" beside
   blocking legacy authentication. The step named three replacement policies —
   Require MFA for Everyone, Block Legacy Authentication, Require
   Phishing-Resistant MFA for Admins — and omitted **Block Device Code Sign-in**.
   Turning security defaults off without it silently reopens device code flow.
   **Corrected in `whatToDo`, `doneWhen`, `who.lead` and the risks.** This is the
   most consequential correction in the group.
3. **The portal value has a word the step dropped.** `ms-security-defaults`: "Set
   **Security defaults** to **Disabled (not recommended)**", from **Entra ID** >
   **Overview** > **Properties** > **Manage security defaults**, by "at least a
   Conditional Access Administrator". **Corrected.**
4. **Security defaults allow one app, not a phone.** `ms-security-defaults`:
   "Security defaults users are required to register for and use multifactor
   authentication using the Microsoft Authenticator app using notifications …
   Users can also use any non-Microsoft application using OATH TOTP to generate
   codes." So nobody in this tenant is on SMS today, and the switch day is the
   first day other methods become possible. **Added to help desk**, beside the
   Temporary Access Pass line.
5. **Guests lose their protection at the same moment.** `ms-security-defaults`:
   "Any B2B guest users or B2B direct connect users that access your directory
   are treated the same as your organization's users." The replacement for guests
   is Require MFA for Everyone, whose target is `includeUsers: ["All"]` —
   `ms-external-ca`: "All users — All users in the directory, **including B2B
   guests**." **Added to help desk**, so the changeover does not leave guests
   unaccounted for.
6. **The 14-day grace period is gone.** `ms-security-defaults`: "Starting July
   29, 2024, new tenants and existing tenants have the 14-day grace period for
   users to register for MFA removed." The step never claimed it; recorded so it
   is never re-added.
7. **Not claimed.** The portal's "why are you turning these off?" picker is not
   documented on any Learn page, so the step does not describe it. §10.6.

**Recorded for the owner (§10.6).** `ms-security-defaults` lists **sixteen** admin
roles it requires MFA of; `ms-managed-policies` lists **fourteen** for the
Microsoft-managed replacement, omitting Authentication Policy Administrator and
Identity Governance Administrator, while the security-defaults page describes
that replacement as the same protection. A tenant moving off security defaults on
Microsoft-managed policies alone loses MFA enforcement for those two roles.
IAMAI's own replacement is the pinned admin policy, not Microsoft's managed one,
so no step word changes.

**Completion from the scan.** The security-defaults singleton reads
`isEnabled: false` and the four replacement policies are enforced. Nothing is
ticked.

8. **The lead named only the direction that blocks nobody.** V1 audit S4-16 /
   S4-20: it said "once these policies exist you cannot turn security defaults
   back on" — true (`ms-plan-ca`), and no reason anyone is stuck — while the
   direction that decides the shape of the whole plan went unsaid. Re-checked
   2026-09-20: `ms-security-defaults` (https://learn.microsoft.com/entra/fundamentals/security-defaults,
   page updated 2026-07-01) "Organizations that choose to implement Conditional
   Access policies that replace security defaults must disable security
   defaults", and "After administrators disable security defaults, organizations
   should immediately enable Conditional Access policies to protect their
   organization." The report-only page (updated 2026-06-01) still contains no
   sentence about security defaults, so playbook V3 stands: report-only creation
   is not restricted, the `sd-enabled` gate stays on `enforce`, and the step's
   sequencing — build the four replacements in report-only, turn security
   defaults off, enforce them the same day — is what Learn describes.
   **The lead now states both directions and says what the first one gates.**

**Acceptance.**
- F1 `whatToDo.lead` says security defaults must be off before the policies
  replace them, and does not claim a report-only policy may coexist.
- F1a the lead names the blocking direction — security defaults off before the
  replacements take over, and nothing in the plan enforces before this step —
  beside the direction that does not block.
- F2 `whatToDo`, `doneWhen` and `who.lead` name Block Device Code Sign-in among
  the replacements.
- F3 a risk says device code flow reopens if that policy is not enforced in the
  same window.
- F4 the portal step reads **Disabled (not recommended)**.
- F5 help desk says security defaults allowed only the Authenticator app, so the
  switch day is the first day another method can be used.
- F6 help desk says guests are covered by Require MFA for Everyone.
- F7 the package carries a checked date of 2026-09-20, so the step shows a source
  line at all.

---

## 8. `s-prereq-per-user-mfa` — Finish Moving Off Per-User MFA

**Outcome.** *No account carries its own MFA requirement any more; the policy is
the only thing asking.*

**Applies when.** At least one account has per-user MFA Enabled or Enforced.

**Microsoft facts.**

1. **Learn's own reason, which the step did not give.** `ms-user-states`, in
   bold: "**Don't enable or enforce per-user Microsoft Entra multifactor
   authentication if you use Conditional Access policies.**" And what Enforced
   means, from the state table: for browser and modern authentication,
   "Microsoft Entra multifactor authentication is required at sign-in." So an
   account left Enforced keeps being asked at every sign-in whatever the policy
   decides. `ms-turn-off-per-user` frames the cost the same way: switching "can
   reduce the number of times your users are prompted for MFA". The step's `why`
   said the move "makes it easier to manage consistently". **Corrected.**
2. **Conditional Access does not change the state, which is why the tile reads
   unknown.** `ms-user-states`: "Enabling Microsoft Entra multifactor
   authentication through a Conditional Access policy doesn't change the state of
   the user. Don't be alarmed if users appear disabled. Conditional Access
   doesn't change the state." **Added to help desk**, where the step had none.
3. **The portal field is Disable MFA.** `ms-turn-off-per-user`: "Browse to
   **Users** > **All users** and select the **Per-user MFA** button", then
   "Select **Disable MFA** for all users who had this option enabled", as "at
   least an Authentication Policy Administrator". The step said "Per-user MFA →
   select the accounts above → Disable". **Corrected.**
4. **The fourth instance of the trap class, and the worst of them.**
   `ms-mfa-settings`, on the legacy service settings this step leaves behind:
   "The **Skip multifactor authentication for requests from federated users on my
   intranet** option will affect the Conditional Access evaluation for locations.
   Any request with the **insidecorporatenetwork** claim would be treated as
   coming from a Trusted location if that option is selected." A checkbox in a
   legacy portal silently turns every intranet request into a trusted location
   for every Conditional Access policy in the tenant. **Added to the risks.**
5. **App passwords outlive the migration.** `ms-user-states`, Enforced row, for
   legacy authentication: "Yes. Apps require app passwords." An app password
   bypasses MFA and survives being set to Disabled unless it is deleted.
   **Added to the risks.**
6. **Method migration is a different thing, and the step's own criteria said so.**
   `ms-mfa-settings`: "Beginning September 30, 2025, authentication methods can't
   be managed in these legacy MFA and SSPR policies." The authentication methods
   policy migration decides which methods people may use; it never requires MFA.
   The step's procedure walked the migration wizard as though it were the
   outcome, while its own Completion Criteria said the opposite. **The procedure
   is now per-user MFA, with the methods check kept as the one safety
   pre-check.**
7. **Per-user MFA is not retired, and the step does not say it is.**
   `ms-managed-policies` calls it "a configuration that Microsoft no longer
   recommends"; no Learn page gives it an end date. §10.7.
8. **Why the tile can only say "not fully read".** The only documented way to
   read or write a per-user MFA state is
   `GET|PATCH /beta/users/{id}/authentication/requirements`
   (`ms-user-states`), and beta APIs carry "Use of these APIs in production
   applications is not supported". IAMAI is read-only and reads what it can; the
   tile's "Not fully read" is the honest answer, not a defect. §10.7.

**Recorded for the owner (§10.7).** The step's Learn link pointed at
`how-to-authentication-methods-manage`, the methods-migration page — the very
thing the step's second Completion Criterion says is *not* this step's outcome.
It now points at `recommendation-turn-off-per-user-mfa`, which is the action plan
this step performs.

**Completion from the scan.** Every account IAMAI could read reads Disabled,
after the replacement policy is enforced and covers it. Where the state cannot be
read, the step says so rather than guessing.

**Acceptance.**
- G1 `why` says an account left Enforced is asked for MFA at every sign-in
  whatever the policy decides.
- G2 help desk says Conditional Access does not change the per-user state.
- G3 the procedure's portal step reads **Per-user MFA** and **Disable MFA**.
- G4 a risk names the intranet-skip option that turns every intranet request into
  a trusted location.
- G5 a risk says app passwords survive and must be deleted.
- G6 the procedure's one methods-policy line is a pre-check, not the outcome.
- G7 the step's Learn link is `recommendation-turn-off-per-user-mfa`.
- G8 the package carries a checked date of 2026-09-20.

---

## 9. Rendered at 1280, on the demo and the follow-up scan

Read on `http://localhost:5209/planner/?demo=1#/plan`, 2026-09-20. Every state
this group's seven steps reach on those two snapshots, and what it says now.

| State | Step and snapshot | What it reads |
|---|---|---|
| On Hold · waiting on your direction | Protect Sign-in Method Registration, initial | «Waiting on your direction». Tasks Remaining holds the threshold tile, two prerequisite steps and two readiness gates; the one Implementation Task is «Create the policy in Report-only», whose location step now sets **Configure** to **Yes** first. |
| On Hold · waiting on your direction | Protect Sign-in Method Registration, follow-up | The same, plus «when 1 trusted location exist (now 0)» and the Confirm What You Use card. |
| On Hold · unmapped group | Require MFA to Register a Device, both | «Baseline references an unmapped group», with the Baseline mappings link, beside five Tasks Remaining tiles. The one Implementation Task is «Create the policy in Report-only»; its grant step reads «Require authentication strength > Modern MFA + TAP … Windows Hello for Business and a device-bound passkey cannot answer this policy», and the paragraph above the procedure says the tenant-wide setting must read No or the policy is not properly enforced. |
| Ready · Create | Prepare Your Team for MFA, both | «Ready now», Impact «29 people and 1 guest». The support-list tile reads «Registration Support · Not confirmed». |
| Up Next | Require MFA for Everyone, initial | «After Prepare Emergency Access Accounts». The Implementation Task is the correction on the existing policy; its grant line and `who.evidence` now name the same control. |
| Completed · Enforced | Require MFA for Everyone, follow-up | «In place», «Already delivered by Core - Grant - MFA for all users». The one task is compare-and-confirm. |
| Ready · Review | Require MFA for Guests, initial | «Complete the review below», Impact «Guest Accounts», «Affected people · Not established». |
| Ready · Decision | Require MFA for Guests, follow-up | «Needs a decision» on Partner or MSP access; Completion Criteria is the five-line report-only sequence. |
| Completed | Turn Off Security Defaults, both | «In place» — the demo tenant has them off. The corrected replacement list is read in About, the procedure and Completion Criteria. |
| Ready · Review | Finish Moving Off Per-User MFA, both | «Complete the review below», «Legacy Per-User MFA · Not fully read · 38 accounts need a per-user state check», Impact «Per-user MFA». |
| Not deployed, free to create | not reached by either snapshot for this group | Both policy steps this group creates are held on these two snapshots. The create procedures are read from the compiled package instead. Recorded, not invented. |

Three readings that are the anatomy's, not this group's words, and were left
alone (`policy-anatomy-deviations.md` §8–§10):

- **Three of the seven steps draw a different set of headings**: the campaign,
  Turn Off Security Defaults and Finish Moving Off Per-User MFA open with
  **Why / Readiness / Implementation / Done when** and draw no Implementation
  *Task* card, because `policyTasks.ts` builds those for policy steps and these
  are `campaign` and `object` steps. Their channel tabs render and their
  corrected words are on screen under those headings. Generalising the task
  anatomy is another wave's work, in flight while this one ran, so this wave
  touched neither `ContentStep.tsx` nor `policyTasks.ts`.
- **The risks are behind a closed disclosure.** Every risk this wave added is in
  the step's "More" details, which the reader opens. That is the anatomy's home
  for them and §5 of the deviations record already asks the owner about it; the
  facts that must be read before acting were also written into the create
  procedures, which is a surface the anatomy draws open.
- **A `whatToDo.before` line does not render where a package is active.** Require
  MFA to Register a Device's before line reaches the reviewer's page and the walk
  and nowhere an admin looks, so its fact is in the package's create procedure as
  well (deviations §9).

## 10. Recorded for the owner

1. **Microsoft's registration policy is not IAMAI's.** `ms-security-info`
   recommends **Require authentication strength** with a TAP-bearing strength;
   IAMAI's resolved target blocks registration outside the trusted network, with
   Require multifactor authentication where no trusted network exists. Both are
   defensible; they are different policies. Not changed.
2. **Two things widely believed about the device-registration user action are not
   in Learn.** That it does not apply to hybrid-joined devices (Learn documents
   that scope for the *legacy toggle* only), and that it breaks Windows Autopilot
   or OOBE (absent from the Autopilot and hybrid-join pages entirely). Neither is
   stated on the step. If the owner wants either said, it needs a source.
3. **Microsoft against the pinned baseline, Require MFA for Everyone.**
   `ms-mfa-all-users` asks for all resources "without any app exclusions"; the pin
   excludes Microsoft Intune Enrollment and gives that resource its own step. The
   baseline is unchanged (CLAUDE.md: the pinned baseline wins).
4. **The guest selector has two names.** External ID's page says the selection is
   now "Guest and external users"; the Conditional Access pages still print
   "Guest or external users". The step uses the Conditional Access spelling,
   which is what an admin sees in the blade it sends them to.
5. **The registration campaign's licence is undocumented.** The 2026-09-15
   version of `ms-campaign` states no licence requirement, and the older sentence
   that no extra licence is needed is gone from it. The step makes no licence
   claim either way. If IAMAI ever gates the campaign on a licence, it needs a
   source that exists.
6. **Moving off security defaults onto Microsoft-managed policies loses two admin
   roles.** Sixteen roles versus fourteen (§7). IAMAI replaces security defaults
   with the pinned admin policy, so this does not bite this plan — but it bites
   the tenant that takes `ms-security-defaults` at its word that the managed
   policies are the same protection. Also unclaimed: the portal's reason picker
   when you disable security defaults is in the product and in no Learn page.
7. **Per-user MFA state is a beta-only API.** Microsoft tells every migrating
   tenant to set each account to Disabled, and documents only
   `/beta/users/{id}/authentication/requirements` to read or write it, under "Use
   of these APIs in production applications is not supported". A read-only tool
   cannot do better than "not fully read", and per-user MFA itself has no
   announced retirement, so the step claims none.
8. **MFA Readiness, one line.** `shared.methodGuides.guest` reads "A guest cannot
   be issued a Temporary Access Pass; they register from their own tenant or with
   their own phone." That is Learn-correct as far as it goes, and it is the only
   guest line MFA Readiness has. It does not say the other half:
   `ms-passkeys` — "Registration of passkey (FIDO2) credentials isn't supported
   for internal or external guest users, including B2B collaboration users in the
   resource tenant." MFA Readiness is settled, so this wave changed the steps to
   agree with it and did not edit the page's line. A guest row that says "set up
   a passkey" would be asking for something the tenant cannot provide. Written up
   here for the owner rather than changed.

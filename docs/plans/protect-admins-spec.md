# Protect Your Administrators: the wave spec

The V1 spec (`v1-procedure.md` §5) for step group `protect-admins`
(`src/roadmap/stepGroups.ts`), taken vertically: one outcome per step, every
technical claim rechecked against Microsoft Learn, and one acceptance test per
item. It follows `close-doors-spec.md`, which took group 3 through the same
procedure.

**Every Microsoft fact below was rechecked on 2026-09-20.** The date beside a
page is its own `ms.date`, read from the live page on that day.

**Frozen, and not touched by this wave:** the four Establish Emergency Access
steps and the four Direction steps. The policy anatomy is Emergency Access's:
no component, class, heading, pill or tag is added here. Two of this group's
five members still draw the default step headings (§8.4); another agent is
generalising the task anatomy to non-policy steps, so this wave judged the
words and left the frame alone.

---

## 1. The sources

| Key | Page | `ms.date` | Checked |
|---|---|---|---|
| `ms-strength-overview` | https://learn.microsoft.com/entra/identity/authentication/concept-authentication-strengths | 2025-03-04 (updated 2026-06-26) | 2026-09-20 |
| `ms-strength-custom` | https://learn.microsoft.com/entra/identity/authentication/concept-authentication-strength-advanced-options | 2026-06-26 | 2026-09-20 |
| `ms-admin-phish` | https://learn.microsoft.com/entra/identity/conditional-access/policy-admin-phish-resistant-mfa | 2026-03-24 | 2026-09-20 |
| `ms-ca-users-groups` | https://learn.microsoft.com/entra/identity/conditional-access/concept-conditional-access-users-groups | 2026-03-24 | 2026-09-20 |
| `ms-ca-conditions` | https://learn.microsoft.com/entra/identity/conditional-access/concept-conditional-access-conditions | 2026-06-02 | 2026-09-20 |
| `ms-session-howto` | https://learn.microsoft.com/entra/identity/conditional-access/howto-conditional-access-session-lifetime | 2026-04-02 | 2026-09-20 |
| `ms-prompts-session-lifetime` | https://learn.microsoft.com/entra/identity/authentication/concepts-azure-multi-factor-authentication-prompts-session-lifetime | 2025-03-04 (updated 2026-02-13) | 2026-09-20 |
| `ms-pim-role-settings` | https://learn.microsoft.com/entra/id-governance/privileged-identity-management/pim-how-to-change-default-settings | 2026-04-23 | 2026-09-20 |
| `ms-passkey-enable` | https://learn.microsoft.com/entra/identity/authentication/how-to-authentication-passkeys-fido2 | 2026-03-08 (updated 2026-06-15) | 2026-09-20 |
| `ms-security-key-passkey` | https://learn.microsoft.com/entra/identity/authentication/how-to-register-passkey-with-security-key | 2026-07-05 | 2026-09-20 |
| `ms-authenticator-passkey` | https://learn.microsoft.com/entra/identity/authentication/how-to-register-passkey-authenticator | 2026-07-05 | 2026-09-20 |
| `ms-block-flows` | https://learn.microsoft.com/entra/identity/conditional-access/policy-block-authentication-flows | 2026-03-24 | 2026-09-20 |

### Facts that hold across this group

- **Licence.** Conditional Access, and therefore authentication strengths,
  needs Entra ID P1 (`ms-strength-overview`, Prerequisites). Privileged Identity
  Management needs P2; the PIM step already carries `licence: Microsoft Entra ID
  P2`. Passkeys themselves need nothing: `ms-passkey-enable` — "Passkeys (FIDO2)
  are available in all Microsoft Entra ID editions, including Microsoft Entra ID
  Free."
- **The baseline's strength is not Microsoft's phishing-resistant one.** The pin
  allows `windowsHelloForBusiness`, `fido2`, `x509CertificateMultiFactor`,
  `temporaryAccessPassOneTime` and `temporaryAccessPassMultiUse`.
  `ms-strength-overview`'s combination table puts Temporary Access Pass (one-time
  use and multiple use) in **MFA strength only** — not in Passwordless MFA
  strength and not in **Phishing-resistant MFA strength**, whose three
  combinations are Windows Hello for Business or platform credential, FIDO2
  security key, and certificate-based authentication (multifactor). Three of the
  group's steps state what the strength accepts; §4 fixes the two that got it
  wrong.
- **The Configure trap, this group's instance.** `ms-ca-conditions`: "By
  default, all newly created Conditional Access policies apply to all client app
  types even if the client apps condition isn't configured", and "The
  **Configure** toggle when set to **Yes** applies to checked items, when set to
  **No** it applies to all client apps, including modern and legacy
  authentication clients." Group 3 found this in the authored packages. This
  wave found it **in the translator** — `src/roadmap/portalLines.ts`, the one
  place the product composes a policy step's portal lines — where the Client
  apps line named the boxes to tick and not the toggle. **Corrected at the
  source (§5).** The Authentication flows line got the toggle too, without the
  "Left at No" clause, because `ms-block-flows` says to set Configure to Yes and
  documents nothing about No.
- **Report-only first, and what it costs here.** Every IAMAI policy is created
  in report-only (V1 §3.8). For the PIM step that interacts with a documented
  Entra behaviour, and the interaction leaves a hole; §6.
- **Conditional Access directory-role targeting covers built-in roles only.**
  `ms-ca-users-groups`: "Lets admins select specific built-in directory roles …
  Other role types aren't supported, including administrative unit-scoped roles
  and custom roles", with the warning repeated. Two of this group's steps target
  directory roles; both already said so.

---

## 2. `s-ladder-operator-passkey` — Register Your Own Passkey

**Outcome.** *You have registered a phishing-resistant sign-in method on your own
account and used it, so the tenant's records show one.*

**Applies when.** Always, before the admin policy depends on it. Its one
prerequisite is Verify Emergency Access.

**Not a policy step.** Its content kind is `check`; it writes nothing in the
tenant and its completion is read from the sign-in records.

**Microsoft facts.**

1. **The registration page.** `ms-security-key-passkey`: "To register a passkey
   for the first time, open [Security info](https://mysignins.microsoft.com/security-info)
   in a web browser to complete the registration." The step sent people to
   `https://aka.ms/mfasetup`, which no current registration page names.
   **Corrected in the step and in its package.**
2. **The five-minute rule.** `ms-passkey-enable`, passkey profile prerequisites:
   "Users must complete multifactor authentication (MFA) within the past five
   minutes before they can register a passkey (FIDO2)." Not stated anywhere
   before, and it is the reason most first attempts are refused. **Added.**
3. **The two methods are two menu entries.** `ms-security-key-passkey`: "Tap
   **Add sign-in method** > **Choose a method** > **Passkey**" for a security
   key. `ms-authenticator-passkey`: "tap **+ Add sign-in method** and select
   **Passkey in Microsoft Authenticator**". The step offered one choice called
   "Passkey" for both. **Corrected.**
4. **Microsoft prefers a security key for this reader.**
   `ms-security-key-passkey`: "Security keys are recommended for highly regulated
   industries or users with elevated privileges." The step presented the two as
   a matter of taste. **Added**, while keeping the "either is enough" that walk
   item 12 owns.
5. **What refuses a registration.** `ms-passkey-enable`: "set **Allow
   self-service set up** to **Yes**. If set to **No**, users can't register a
   passkey by using Security info, even if passkeys (FIDO2) are enabled by the
   Authentication methods policy"; and `ms-authenticator-passkey`: "You can't
   register a passkey in Authenticator this way if attestation is enabled by your
   administrator." Plus key restrictions, which "set the usability of specific
   models or providers for both registration and authentication". The step said
   only "check the error … and whether the device supports the method".
   **Corrected to name the three settings**, all of which live in the frozen
   Configure Passkey Authentication step, which is referenced and not changed.
6. **What a passkey in Authenticator needs on the phone.**
   `ms-authenticator-passkey`: iOS 17 or later / Android 14 or later (15
   recommended), a screen lock, and Authenticator enabled as the device's
   passkey provider. **Added to the package's procedure**, which is on screen.
7. The step's Learn link was `how-to-authentication-passkeys-fido2`, the
   **admin enablement** page, on a step whose whole job is registration. It now
   links `how-to-register-passkey-with-security-key`, which its package also
   cites.

**Two holes that meant the step never said its own outcome (§8.1).**

- `src/ui/surfaces/stepVars.ts` set `v.operator` inside the block for steps that
  carry checks. This step carries none, so `{operator}` was undefined on every
  plan, and `render.ts whole()` dropped both lines that use it — the Who line
  and the one Completion Criteria line. Done when fell back to
  `CONTRACT.doneVerify`, "You have looked at the accounts this step names and
  dealt with them", on a step that is about a passkey. It is the only step in
  `content.json` that uses `{operator}`. **The assignment moved out of that
  block.**
- Its prerequisite is `cleanup-drill`, a Cleanup row, whose words are keyed by
  kind under `content.cleanup`, not by id under `content.steps`. Both title
  lookups in `stepContract.ts` missed it and the tile printed **`cleanup-drill`**
  at the reader. **A `cleanupTitleOf` fallback was added**; the tile now reads
  *Verify Emergency Access*. Five step snapshots move, all of them this step's
  tile.

**Completion from the scan.** A phishing-resistant sign-in by the operator's own
account in the sign-in records. Nothing is ticked. A re-scan reopens the step
only if that evidence is no longer there.

**Acceptance.**
- A1 the step and its package send you to `mysignins.microsoft.com/security-info`
  and no longer to `aka.ms/mfasetup`.
- A2 the five-minute window is stated, on screen and in the procedure.
- A3 the two methods are named by their own menu entries, and either is enough.
- A4 a refused passkey names the three settings that refuse it.
- A5 the step links the page that carries the registration procedure, and its
  package cites the same page.
- A6 the package's checked date is 2026-09-20 and the step shows it.
- A7 the step states its own outcome in every state, because `{operator}`
  resolves.
- A8 no step tile in the repository shows a raw step id, and this step's
  prerequisite reads *Verify Emergency Access*.

---

## 3. `s-prereq-auth-strength` — Create the Baseline's Authentication Strength

**Outcome.** *This tenant has one authentication strength that accepts exactly
the baseline's method combinations, and the policies that need it reference that
one.*

**Applies when.** Whenever a policy in the plan requires the strength: Require
Phishing-Resistant MFA for Admins, Require MFA at Every Role Activation,
Challenge High-Risk Sign-ins, and the partner tier of Require MFA for Guests.

**Baseline reading.** The strength `Modern MFA + TAP`, resolved by its exact
allowed combinations rather than by name or by a source-tenant id.

**Microsoft facts.**

1. **The portal path was wrong.** `ms-strength-custom`: "Browse to **Entra ID** >
   **Authentication methods** > **Authentication strengths**. Select **New
   authentication strength**." `ms-passkey-enable` gives the same path. The step
   said *Conditional Access → Authentication strengths*, while its own package
   already said Authentication methods: one fact, two sources, disagreeing.
   **Corrected, and the two now read alike.**
2. **The role it takes.** `ms-strength-custom`: "Sign in to the Microsoft Entra
   admin center as at least a [Security Administrator]". The step named no role.
   **Added.**
3. **Both Temporary Access Pass forms are in the baseline.** The evidence line
   said "and a Temporary Access Pass", which reads as one option; the pin allows
   `temporaryAccessPassOneTime` and `temporaryAccessPassMultiUse`, and the
   procedure beside it already selected both. **Corrected**, because a multi-use
   pass is a standing credential and the group's other steps describe it.
4. **A strength a policy uses cannot be deleted.** `ms-strength-custom`: "If a
   Conditional Access policy references that authentication strength, you can't
   delete it, and you need to confirm any edit." If it goes wrong said only
   "Delete the strength; no policy references it yet", which is true at that
   moment and stops being true. **The boundary was added.**
5. Up to 15 custom strengths per tenant (`ms-strength-custom`). Recorded; not on
   screen, because no plan gets near it.
6. Recorded, not on screen: `ms-admin-phish` warns that **external authentication
   methods are incompatible with authentication strengths**, and
   `ms-strength-overview` that **Require multifactor authentication and Require
   authentication strength cannot be used together** in one policy. Neither is a
   decision this step offers.

**Completion from the scan.** A custom strength whose allowed combinations match
the baseline's exactly, found by its combinations. A re-scan reopens the step
only when those combinations move.

**Acceptance.**
- B1 the path names Authentication methods and the Security Administrator role,
  in the step and in its package, and nothing says Conditional Access.
- B2 the evidence names both Temporary Access Pass forms, and the procedure still
  lists them as two selections.
- B3 If it goes wrong says when the strength can no longer be deleted.
- B4 the package's checked date is 2026-09-20 and the step shows it.

---

## 4. `s-goal-admins-phishing-resistant` — Require Phishing-Resistant MFA for Admins

**Outcome.** *Admins in the baseline's built-in directory roles can only sign in
with a method the baseline's authentication strength accepts, and every admin in
scope has one registered.*

**Baseline reading.** Pinned member `f893f39f-2ab3-4f1e-a8e1-9a2b9589a9ce`,
`IAC - GLOBAL - GRANT - MFA - AllAdmins`: 46 built-in directory roles, resolved
exclusions, All resources, `clientAppTypes: ["all"]`, grant = the custom strength
`Modern MFA + TAP`, no session controls.

**Microsoft facts.**

1. **The strength is not "the phishing-resistant strength".** Help desk said "A
   Temporary Access Pass satisfies the phishing-resistant strength once, for the
   first sign-in", which is wrong twice: `ms-strength-overview`'s table puts TAP
   outside Phishing-resistant MFA strength entirely, and the baseline allows the
   **multi-use** pass, so it is not once. **Corrected.**
2. **The line beside it contradicted it.** "Only a registered passkey, security
   key or Windows Hello gets through" excludes the pass the line above allows.
   **Corrected to what is actually true**: anything the strength does not list is
   refused. The lockout risk was enumerating the same way and now reads the same.
3. **The Windows Hello call the help desk actually gets.**
   `ms-strength-overview`, Limitations: "if the user signs in with another method
   (like a password) as the primary authentication method, and the authentication
   strength requires Windows Hello for Business, the user isn't prompted to sign
   in with Windows Hello for Business. The user needs to restart the session,
   select **Sign-in options**, and select a method that the authentication
   strength requires." The step named a prerequisite (device joined, PIN set up)
   instead. **Corrected.**
4. **Completion Criteria over-claimed.** It said "every admin holds a qualifying
   phishing-resistant method", which the strength does not require. It is now the
   outcome sentence above.
5. **"All client apps" is an unconfigured condition, not a selection.** The
   create and correct procedures said "Target **All resources** and **all client
   apps**" and "Client apps: All", which reads as boxes to tick. Ticking them all
   writes the four named types, not `all`, and IAMAI reads that as a difference
   that never resolves. **Both corrected to leave the condition unconfigured and
   say why.**
6. **PIM-eligible roles are out of scope until activated.** The evidence line
   already said so; `ms-pim-role-settings` is the source: "During activation, the
   user doesn't have a role yet, so the Conditional Access policy wouldn't
   apply." Unchanged.
7. **Custom and administrative-unit-scoped roles.** `ms-ca-users-groups` warns
   that policies "don't support users assigned a directory role scoped to an
   administrative unit or directory roles scoped directly to an object, like
   through custom roles". The step's risk already said this. Unchanged.

**Recorded for the owner — Microsoft against the pinned baseline (§8.2).**
`ms-admin-phish` recommends the built-in **Phishing-resistant MFA strength** and
names 14 roles. The pin uses a custom strength that also accepts a Temporary
Access Pass in both forms, over 46 roles. The baseline is not changed (CLAUDE.md:
the pinned baseline wins); the step now describes what the pin actually does.

**Completion from the scan.** The policy exists, is On, and its roles, exclusions,
grant and absent session controls match the target; plus every admin in scope
holds a method the strength accepts (MFA Readiness's reading). A re-scan reopens
the step only when the policy's semantics or an admin's methods move.

**Acceptance.**
- C1 help desk says what a Temporary Access Pass does here, in both its forms,
  and that Microsoft's own phishing-resistant strength accepts neither.
- C2 no line enumerates the accepted methods against the strength, in help desk
  or in the risks.
- C3 help desk names the Windows Hello prompt that never arrives after a password.
- C4 Completion Criteria is this step's outcome and does not claim phishing
  resistance the strength does not require.
- C5 the create and correct procedures leave the Client apps condition
  unconfigured and say why.
- C6 the package's checked date is 2026-09-20 and the step shows it.

---

## 5. `s-goal-admin-session` — Shorten Admin Sessions

**Outcome.** *An admin's browser session reauthenticates on the baseline's
interval and never survives closing the browser.*

**Baseline reading.** Pinned member `04b969aa-3e98-4e0f-8b32-2319b199b56a`,
`IAC - GLOBAL – SESSION – Admin Persistence (4 Hours)`: the same 46 roles,
resolved exclusions, All resources, **`clientAppTypes: ["browser"]`**, no grant,
sign-in frequency 4 hours time-based, persistent browser never.

**Microsoft facts.**

1. **The Configure trap, and where it lived.** The target narrows client apps to
   Browser. Every source that told an admin how to do that — the generated portal
   line, the package's create and correct procedures, and the step's reviewer
   reference — named the checkbox and not the toggle. Per `ms-ca-conditions`
   (quoted in §1), the policy then reaches every client app, so the interval
   would apply to Outlook on the desktop and to every mobile app, not to the
   browser. **Fixed at the source**: `roadmap/portalLines.ts` now emits
   `Conditions → Client apps → Configure: Yes, then Browser. Left at No it
   reaches every client app.`, which is what a policy step renders, and the
   package and the reference say the same. This is the one place in the product
   that composes the line, and it had not been changed when group 3 fixed its own
   packages.
2. **Remember MFA on trusted devices has to be off first.** `ms-session-howto`:
   "Before enabling Sign-in Frequency, make sure other reauthentication settings
   are disabled in your tenant. If 'Remember MFA on trusted devices' is enabled,
   disable it before using Sign-in Frequency, as using these two settings
   together might prompt users unexpectedly." Nothing said it. **Added as the
   procedure's first check and as a risk.**
3. **The persistent-browser setting overrides "Stay signed in?".**
   `ms-session-howto`: "Persistent browser session configuration in Microsoft
   Entra Conditional Access overrides the 'Stay signed in?' setting in the
   company branding pane for the same user if both policies are configured", and
   `ms-prompts-session-lifetime` says the same. An admin will report the prompt
   stopping. **Added to help desk.**
4. **The shorter of two sign-in frequencies wins.** Completion Criteria already
   said so; the source is `ms-prompts-session-lifetime`: "In Microsoft Entra ID,
   the most restrictive policy for session lifetime determines when the user
   needs to reauthenticate." Unchanged, now sourced.
5. **Persistent browser session needs All resources.** `ms-session-howto`: "This
   control requires selecting 'All Cloud Apps' as a condition. Browser session
   persistence is controlled by authentication session token." The pin targets
   All resources, so there is nothing to change; recorded because a reader
   narrowing the target would break it.
6. **The interval had two sources.** The step reads it from the resolved target
   through `{wanted}` / `{wantedValue}`; the package restated "4 hours" in six
   places and "four-hour" in three. **The package now points at the resolved
   target everywhere**, so a re-pin cannot leave it lying.
7. Recorded, not on screen: `ms-session-howto`'s known issues — sign-in frequency
   on mobile can add about 30 seconds per interval; iOS apps with a certificate
   first factor plus Intune app-management policies are blocked; Microsoft Entra
   Private Access does not support "every time".

**Completion from the scan.** The policy is On for the roles it names with the
intended frequency, persistence, assignments and exclusions, plus a human check
that admin work stays practical. A re-scan reopens the step only when the
policy's semantics move.

**Acceptance.**
- D1 the generated portal line sets Configure to Yes for any policy that narrows
  client apps, and the step's reviewer reference says the same line.
- D1b the step's own create procedure says it on screen, and the correction says
  it too.
- D2 turning off Remember MFA on trusted devices is a risk and the procedure's
  first check.
- D3 help desk says the "Stay signed in?" prompt stops working for these admins.
- D4 the package names no interval of its own; only the resolved target does.
- D5 Completion Criteria still says the shorter sign-in frequency wins.
- D6 the package's checked date is 2026-09-20 and the step shows it.

---

## 6. `s-goal-pim-activation-reauth` — Require MFA at Every Role Activation

**Outcome.** *Activating an eligible admin role asks for a method the baseline's
strength accepts, every time.*

**Applies when.** Entra ID P2, and the tenant uses Privileged Identity
Management. No demo or follow-up fixture reaches it (§8.3).

**Baseline reading.** Pinned member `a6b3b754-9079-48f0-abb2-9e79b2f41095`,
`IAC - P2 - APP - SESSION - PIM - Reauthentication`: All users with the
exclusions group, target resources = authentication context `c1`, grant = the
custom strength, session sign-in frequency `everyTime`.

**Microsoft facts.**

1. **The trap: report-only turns the requirement off entirely.** The step's
   procedure created the policy in report-only and then, as its very next line,
   told the admin to point every role's activation at that context.
   `ms-pim-role-settings` documents a fallback — "if there are no Conditional
   Access policies in the tenant that target authentication context configured in
   PIM settings, during PIM role activation, the multifactor authentication
   feature in Microsoft Entra ID is required" — and then removes it exactly here:
   "This backup protection mechanism isn't triggered if the Conditional Access
   policy is turned off, **is in report-only mode**, or has an eligible user
   excluded from the policy." Between those two lines, a role activation requires
   nothing at all. The package already forbade it; the step's procedure asked for
   it. **The PIM line moved after enforcement, and the consequence is a risk.**
2. **The PIM path had moved.** `ms-pim-role-settings`: "Browse to **ID
   Governance** > **Privileged Identity Management** > **Microsoft Entra roles** >
   **Roles**", then the role, then **Role settings** → **Edit** → **Update**. The
   step said *Privileged Identity Management → Entra roles → Settings → each
   role*, and the package said *Identity governance … → Role settings*.
   **Both corrected to the documented path.**
3. **All users is the only scope that works.** `ms-pim-role-settings`: "Don't
   create a Conditional Access policy scoped to authentication context and a
   directory role at the same time. During activation, the user doesn't have a
   role yet, so the Conditional Access policy wouldn't apply." The pin targets
   All users; nothing said why that is not a preference. **Added to the procedure
   and to the package.**
4. **The old option is weaker, not redundant.** The risk said a role still set to
   "require MFA on activation" is "redundant with this". `ms-pim-role-settings`:
   "Users might not be prompted for multifactor authentication if they
   authenticated with strong credentials or provided multifactor authentication
   earlier in the session", and Microsoft recommends the authentication context
   with authentication strengths instead, because those "require users to
   authenticate during activation by using methods different from the one they
   used to sign in to the machine". **Corrected.**
5. **The context stops at activation, and the second policy is our own other
   step.** `ms-pim-role-settings`: "After the role is activated, users aren't
   prevented from using another browsing session, device, or location to use
   permissions", and its remedy is two policies — one on the authentication
   context, one on directory roles. In this plan the second one is Require
   Phishing-Resistant MFA for Admins. **Named in help desk.**
6. **The ten-minute window is real, and spans more than Entra roles.**
   `ms-pim-role-settings`: "When a user reauthenticates for one role activation,
   a 10-minute window applies. If the user activates another eligible role within
   this window, they aren't prompted to reauthenticate again. The 10-minute
   window applies across Microsoft Entra roles, Azure resource roles, and PIM for
   Groups." The step's `aiFocus` already said ten minutes and was right; the
   manager line said only "within Microsoft's window". **The number and its reach
   are now stated.**
7. **"Every time" is Microsoft's own instruction here.**
   `ms-pim-role-settings`: "To enforce reauthentication on every role activation,
   configure the Conditional Access policy targeting your authentication context
   with sign-in frequency set to **Every time** under **Session controls**."
   Matches the pin. Unchanged.
8. Recorded, not on screen: `ms-session-howto`'s prompt tolerance — "The system
   accounts for five minutes of clock skew when **every time** is selected in
   policy, so users aren't prompted more often than once every five minutes." It
   is a second, smaller window than the PIM one and naming both on one step would
   confuse more than it explains.

**Completion from the scan.** The policy is On with its context published and its
strength resolved, plus a controlled activation recorded as manual evidence — one
of the V1 §3.3 exceptions, because no scan sees an activation prompt.

**Acceptance.**
- E1 the PIM role setting comes after the policy is On, and the step says what
  report-only costs.
- E2 the PIM role settings path is the one Microsoft documents, in the step and
  in the package.
- E3 the policy targets all users and says why it must not target the roles.
- E4 the old activation option is called weaker, not redundant.
- E5 help desk says where the context stops and which step carries on.
- E6 the reuse window is named, with the roles it spans.
- E7 the package's checked date is 2026-09-20.

---

## 7. Rendered at 1280, on the demo and the follow-up scan

Read on `http://localhost:5208/planner/?demo=1#/plan`, 2026-09-20, and from the
recorded renderings in `docs/qa/step-snapshots/`. Every state this group's steps
reach, and what it says now.

| State | Step and snapshot | What it reads |
|---|---|---|
| Waiting on the foundation | Shorten Admin Sessions, initial | «Up Next». Tasks Remaining: «Conditional Access policy · Core - Session - Admin session lifetime · 3 checks remaining · Report-only · Clear what this step is waiting on», then two cards, «Prerequisite · To do · Prepare Emergency Access Accounts» and the same for Configure Emergency Exclusions, each with its link. |
| Not deployed, the procedure on screen | Shorten Admin Sessions, initial and follow-up | The one Implementation Task is «Create the policy in Report-only». Step 3 turns Remember MFA on trusted devices off; step 4 sets **Configure** to **Yes** then Browser and says what No would reach; step 5 takes the interval from the resolved target. «Source checked Sep 20, 2026». |
| Report-only, observing | Require Phishing-Resistant MFA for Admins, initial | «On Hold · Report-only». The policy card's next check is «Ready to enforce» and says the way back in is not verified yet; beside it a Threshold card, «67% of admins phishing-resistant», and the prerequisite. Completion Criteria is the step's outcome: «Admins in the baseline's built-in directory roles can only sign in to Contoso Pty Ltd with a method its authentication strength accepts…» |
| Ready to enforce | not reached by either snapshot for this group | The check itself is drawn (above); no fixture puts one of these steps in the Ready · Ready to enforce badge. Recorded, not invented. |
| Enforced / in place | Require Phishing-Resistant MFA for Admins, follow-up | «Completed · Enforced». Tasks Remaining holds only «New evidence · Review required · the policy itself changed by Sep 20, 2026: what was watched before this is no longer what is deployed», the Entra task is the compare-and-confirm procedure, and Completion Criteria is the shared «The scan found the assessed configuration in place» — a satisfied policy step's sentence, the same one Close the Doors reaches. |
| In place | Register Your Own Passkey and Create the Baseline's Authentication Strength, initial and follow-up | «Completed · In place · Already in place». The passkey step's Completion Criteria now names the operator: «Casey Kim completed a phishing-resistant sign-in in the records.» |
| A hold this step can reach | Shorten Admin Sessions, follow-up | «On Hold», bar «Waiting on your direction», one card «Waiting on your direction · Confirm What You Use». True, and it names the one action. |
| A hold this step can reach | Register Your Own Passkey, messy | «On Hold», one card «Prerequisite · Waiting · Verify Emergency Access» — which read `cleanup-drill` before this wave. |
| Not licensed | Require MFA at Every Role Activation, initial and follow-up | Under «Not licensed (6)»; the demo has no P2. Its states are read on `mid`, where it is «Up Next · After Prepare Emergency Access Accounts». |

The group heads «Protect Your Administrators · 1 of 4 steps» on the demo and
numbers Shorten Admin Sessions 4, because the numbers are registry positions and
the P2 step is not generated there.

---

## 8. Recorded for the owner

1. **Two steps of this group still draw the default headings.** Register Your Own
   Passkey and Create the Baseline's Authentication Strength render *Why /
   Readiness / Implementation / Done when*, where the three policy steps render
   the Emergency Access anatomy. Another agent is generalising the task anatomy
   to non-policy steps; this wave judged the words and left the frame alone.
2. **Microsoft against the pinned baseline, admins.** `ms-admin-phish` recommends
   the built-in Phishing-resistant MFA strength over 14 roles; the pin uses a
   custom strength that also accepts both Temporary Access Pass forms, over 46
   roles. The baseline is unchanged. The step's title still says
   "Phishing-Resistant", which is the direction of the control rather than a
   description of every combination it accepts; the words underneath no longer
   claim otherwise.
3. **No fixture exercises the P2 step or the Ready-to-enforce badge.** Require
   MFA at Every Role Activation appears only on `mid` and `huge`, and no fixture
   puts any of the five in `Ready · Ready to enforce`. Both are gaps in the
   fixture set, not in the steps.
4. **`more` is print-only.** Risks, help desk and the manager line are rendered
   by `ContentStep.tsx` only when `printing` is true, so the corrections in §4
   and §6 reach the printed plan, the export and the prompt pack, and not the
   Plan screen. Verified in the export text; the screen carries the same facts
   through the Implementation Tasks.
5. **The same Configure trap is still in two other groups' words.**
   `s-goal-guests-mfa`'s package says "Client apps: All" twice, and the reviewer
   reference lines for `require-managed-device`, `token-protection` and
   `unmanaged-browser` name their client-app selections without the toggle. The
   translator fix in §5 corrects what those steps *render*; their authored words
   were left for their own waves. `portalLines.test.ts` does not assert the
   translator equal to the reference lines, so nothing is now inconsistent in a
   way a test can see.
6. **`whatToDoReference` is nobody's renderer.** `content.test.ts` forbids any
   product renderer from reading it; the product generates What to do from the
   baseline through `portalLines.ts`. The reference lines corrected in §5 and §6
   are therefore the review page's and the reviewer's, and the on-screen
   instruction comes from the translator and the package. Both were corrected, so
   they agree.

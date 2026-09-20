# Close the Doors Nobody Should Use: the wave spec

The V1 spec (`v1-procedure.md` §5) for step group `close-doors`
(`src/roadmap/stepGroups.ts`), taken vertically: one outcome per step, every
technical claim rechecked against Microsoft Learn, and one acceptance test per
item.

**Every Microsoft fact below was rechecked on 2026-09-19.** The date beside a
page is its own `ms.date`, read from the live page on that day.

**Frozen, and not touched by this wave:** the four Establish Emergency Access
steps and the four Direction steps. Anything this wave found in them is written
up in `frozen-step-suggestions.md`. The policy anatomy is Emergency Access's:
no component, class, heading, pill or tag is added here, and anything that
looked like it needed one is in `policy-anatomy-deviations.md`.

---

## 1. The sources

| Key | Page | `ms.date` | Checked |
|---|---|---|---|
| `ms-block-legacy` | https://learn.microsoft.com/entra/identity/conditional-access/policy-block-legacy-authentication | 2026-03-24 | 2026-09-19 |
| `ms-ca-conditions` | https://learn.microsoft.com/entra/identity/conditional-access/concept-conditional-access-conditions | 2026-06-02 | 2026-09-19 |
| `ms-block-flows` | https://learn.microsoft.com/entra/identity/conditional-access/policy-block-authentication-flows | 2026-03-24 | 2026-09-19 |
| `ms-auth-flows` | https://learn.microsoft.com/entra/identity/conditional-access/concept-authentication-flows | 2026-03-24 | 2026-09-19 |
| `ms-basic-auth` | https://learn.microsoft.com/exchange/clients-and-mobile-in-exchange-online/deprecation-of-basic-authentication-exchange-online | 2026-07-10 | 2026-09-19 |
| `ms-smtp-timeline` | https://techcommunity.microsoft.com/blog/exchange/updated-exchange-online-smtp-auth-basic-authentication-deprecation-timeline/4489835 | — | 2026-09-19 |
| `ms-mfd` | https://learn.microsoft.com/exchange/mail-flow-best-practices/how-to-set-up-a-multifunction-device-or-application-to-send-email-using-microsoft-365-or-office-365 | — | 2026-09-19 |

### Facts that hold for all four policy steps

- **Licence.** Conditional Access needs a licence that includes it (Entra ID P1
  or higher). `ms-block-legacy`: "Customers without licenses that include
  Conditional Access can make use of security defaults to block legacy
  authentication." The steps' `ai.not-licensed` block already says P1; no change.
- **The portal path.** `Entra ID > Conditional Access > Policies > New policy`,
  under **Assignments**, **Target resources > Resources (formerly cloud apps) >
  Include > All resources**, **Conditions**, **Access controls > Grant**, then
  **Enable policy** set to **Report-only** (`ms-block-legacy`, `ms-block-flows`).
  The packages' create blocks already read this way.
- **The Configure toggle.** Both the **Client apps** and the **Authentication
  flows** conditions carry a **Configure** toggle. `ms-ca-conditions`: "The
  **Configure** toggle when set to **Yes** applies to checked items, when set to
  **No** it applies to all client apps, including modern and legacy
  authentication clients." A create procedure that lists the checkboxes without
  first setting **Configure** to **Yes** describes a policy that matches
  everything. **Corrected in all four packages.**
- **Report-only shows would-be results, not blocks.** `ms-block-legacy`: the
  policy "is put in to Report-only mode to start so administrators can determine
  the impact they have on existing users", reviewed through "policy impact or
  report-only mode". Nothing in this wave claims report-only enforces anything.
- **Conditional Access runs after the first factor.** `ms-block-legacy`, Note:
  "Conditional Access policies are enforced after first-factor authentication is
  completed." Recorded; no step claimed otherwise.
- **Authentication flows is still labelled preview.** `ms-ca-conditions` heads
  the section "Authentication flows (preview)" as of 2026-06-02, while
  `ms-block-flows` documents it as a supported how-to. Recorded in §7; no step
  word changes, because the condition is generally available in the portal and
  the baseline pins it.

---

## 2. `s-goal-block-legacy-auth` — Block Legacy Authentication

**Outcome.** *Nothing signs in to this tenant over Exchange ActiveSync or a
basic-authentication protocol, and every mail-sending device and job that used
one is accounted for.*

**Applies when.** Always. It has no Direction gate of its own; its one question
is the mail-sending-devices decision, which carves out `s-question-mail-devices`.

**Baseline reading.** Pinned member `9eab445f-7f21-479a-85c9-29769512067e`,
`IAC - GLOBAL – BLOCK - Legacy Authentication`: All users with resolved
exclusions, All resources, client app types exactly `exchangeActiveSync` and
`other`, grant Block.

**Microsoft facts.**

1. Legacy protocols cannot complete MFA. `ms-ca-conditions`: "Sign-ins from
   legacy authentication clients don't support multifactor authentication (MFA)
   and don't pass device state information, so they're blocked by Conditional
   Access grant controls". The old `why` said they "can prevent MFA from
   protecting a sign-in", which reads as a possibility; it is the rule.
2. What **Other clients** covers, verbatim from `ms-ca-conditions`: SMTP,
   Autodiscover, Exchange Online PowerShell, Exchange Web Services (EWS), IMAP4,
   MAPI over HTTP, Offline Address Book (OAB), Outlook Anywhere (RPC over HTTP),
   Outlook Service, POP3, Reporting Web Services.
3. **Exchange ActiveSync sends one quarantine email.** `ms-ca-conditions`: "When
   policy blocks the use of Exchange ActiveSync, the affected user receives a
   single quarantine email." Not stated anywhere in the step before; added to
   help desk, because it is the first thing a blocked person reports.
4. **Certificate-based authentication is still legacy authentication.**
   `ms-basic-auth`: "Certificate-based authentication is still legacy
   authentication and as such will be blocked by Microsoft Entra Conditional
   Access policies that block legacy authentication." A device moved off a
   password onto a certificate is *not* out of this policy's reach. Not stated
   before; added to help desk.
5. The Learn link on the step pointed at
   `howto-conditional-access-policy-block-legacy` while its package cited
   `policy-block-legacy-authentication`. One fact, two sources. The step now
   uses the package's, which is the page that carries the procedure.

**Recorded for the owner — Microsoft against the pinned baseline (§7.1).**
`ms-ca-conditions` says of the Exchange ActiveSync client-app selection: "Admins
can only select Exchange ActiveSync clients when assigning policy to users or
groups. Selecting **All users**, **All guest and external users**, or **Directory
roles** causes all users to be subject of the policy", and "When admins create a
policy assigned to Exchange ActiveSync clients, **Exchange Online** should be the
only cloud application assigned to the policy." The pinned baseline assigns
**All users** and **All resources**. The baseline is not changed.

**Completion from the scan.** The policy exists, is On, and its conditions,
grant, assignments and exclusions match the target; plus the mail-devices
decision is saved. Both are read from the tenant and the saved decision; nothing
is ticked. A re-scan reopens the step only if the policy's own semantics move.

**Acceptance.**
- A1 `why` states that legacy protocols cannot complete MFA.
- A2 the create and correct procedures set **Configure** to **Yes** before
  naming the client-app checkboxes.
- A3 help desk names the single Exchange ActiveSync quarantine email.
- A4 help desk says certificate-based authentication is still blocked here.
- A5 the step's Learn link is `policy-block-legacy-authentication`, the same page
  its package cites.
- A6 the package's checked date is 2026-09-19.

---

## 3. Moving the exception devices — Block Legacy Authentication's second task

**Folded in, 2026-09-19** (`docs/plans/step-redundancy-analysis.md` finding 6).
This was `s-question-mail-devices`, and §8.4 below is why: it drew the default
headings beside four policy steps in its own group, and its work is the second
half of Block Legacy Authentication's outcome. It is now that step's second
Implementation Task (`shared.mailDevices`, `ui/surfaces/policyTasks.ts`), shown
only where the mail-sending answer named exception accounts, with the same
manual evidence. The acceptance below is unchanged and is read on that step; the
group heads four steps and numbers its rows 1–4.

### What it was

**Outcome.** *Every device and application that sent mail with a password now
sends through a supported route, and its temporary exception is gone.*

**It was not a policy step.** Its content kind was `check`, so it drew the
default step headings beside four policy steps that draw the Emergency Access
anatomy, and it was generated only when the mail-devices decision on Block Legacy
Authentication answered "Temporary exception accounts". It appeared in no fixture
snapshot. Reported in §7.4 and now resolved by the fold above.

**Microsoft facts.**

1. Basic authentication is **already gone** for the mail protocols.
   `ms-basic-auth`: "Basic authentication is now disabled in all tenants", for
   "Exchange ActiveSync (EAS), POP, IMAP, Remote PowerShell (RPS), Exchange Web
   Services (EWS), Offline Address Book (OAB), Autodiscover, Outlook for Windows,
   and Outlook for Mac". The step's `why` implied the change was ahead of every
   device; for all but one protocol it is behind them.
2. **SMTP AUTH is the one that is left, and it is going.** `ms-smtp-timeline`
   (linked from `ms-basic-auth`): basic authentication for SMTP AUTH is disabled
   by default for existing tenants by the end of December 2026 and is
   unavailable by default for tenants created after that; the final removal date
   is to be announced in the second half of 2027. Admins can still re-enable it
   until the final removal.
3. The supported routes, from `ms-mfd`: SMTP AUTH client submission (with
   OAuth), SMTP relay through an Exchange Online connector, and Direct Send
   (internal recipients only). `ms-basic-auth` adds the Microsoft Graph
   `sendMail` API. The package's `ai.route` block already lists the first three
   with their requirements and is correct.

**Completion from the scan.** It cannot be. Delivery through a replacement route
is manual evidence (`roadmap/manualWork.ts` records the mail job, the route and
the removal of the exception) — one of the V1 §3.3 exceptions.

**Acceptance.**
- B1 Block Legacy Authentication's `why` says basic authentication is already off
  for the mail protocols and that SMTP AUTH is the remaining one.
- B2 That `why` says Microsoft is retiring that route too. It carries no date: no
  content string may hold a hard date (`scripts/walkContent.mjs` C3), so the
  December 2026 and 2027 milestones stay in this spec.
- B3 `shared.mailDevices.steps` keeps the three supported routes and does not
  recommend a password route.
- B4 The second task appears only where an exception account is named, and the
  step that carried it is gone.

---

## 4. `s-goal-block-device-code` — Block Device Code Sign-in

**Outcome.** *No sign-in to this tenant completes through device code flow, and
every tool, shared device and enrollment job that used it has a tested
alternative.*

**Microsoft facts.**

1. What it is, from `ms-auth-flows`: "Device code flow lets you sign into
   devices that lack local input devices, like shared devices or digital
   signage. Device code flow is a high-risk authentication method that can be
   part of a phishing attack".
2. **Protocol tracking — the fact the step never stated.** `ms-auth-flows`: the
   session that used device code flow "is considered protocol tracked", the
   state "is sustained through subsequent refreshes", and "it is possible for
   non device code flow or authentication transfer flows to be subject to
   enforcement of authentication flows policies". Microsoft's own note: "Blocks
   due to protocol tracked sessions are expected behavior for this policy.
   Possible impact can include things such as not being able to access certain
   resources, or complete device sign out." The step showed this only in its
   report-only block, which an admin creating the policy never reads. **Added to
   the risks, which show in every state.**
3. **Device Registration Service.** `ms-auth-flows`: since early September 2024
   authentication-flows policies are enforced on Device Registration Service,
   and this "applies only to policies which target **all resources**". The pinned
   baseline targets All resources. An organisation that registers devices by
   device code must exclude the Device Registration Service resource. The step
   showed this only in its report-only block. **Added to the risks and the help
   desk.**
4. **How to see it in the logs.** `ms-auth-flows`: filter sign-in logs by
   **Authentication Protocol** for device code, and read **Original transfer
   method** in **Activity details** to tell a tracked session from a real device
   code sign-in. The error to expect is `AADSTS530036`.

**Completion from the scan.** The policy is On and matches the target, the
report-only window closed with no failures, and the device-code decision is
saved as "None". A re-scan reopens the step when the policy's semantics move.

**Acceptance.**
- C1 a risk states that blocking this flow can also block later requests in a
  session that used it, and can sign a device out.
- C2 a risk states that this policy, targeting all resources, also reaches
  Device Registration Service.
- C3 help desk names the **Authentication Protocol** filter and the **Original
  transfer method** property.
- C4 the create procedure sets **Configure** to **Yes**.
- C5 the package's checked date is 2026-09-19.

---

## 5. `s-goal-block-auth-transfer` — Block Authentication Transfer

**Outcome.** *Nobody carries a signed-in session from one device to another;
they sign in on the device they are using.*

**Microsoft facts.**

1. What it is, from `ms-auth-flows`: "Authentication transfer is a flow that
   lets users seamlessly transfer authenticated state from one device to
   another. For example, users might see a QR code in the desktop version of
   Outlook that, when scanned on their mobile device, transfers their
   authenticated state to the mobile device." The step's existing risk line
   already matches this; the `why` was vaguer than the fact.
2. **Protocol tracking applies here too.** `ms-auth-flows` names both flows:
   "This tracking is applied to the session using device code flow or
   authentication transfer." The step said nothing about it. **Added to risks.**
3. Microsoft's own recipe (`ms-block-flows`) ends "set **Enable policy** to
   **Enabled**" for authentication transfer, where the device code recipe says
   Report-only. IAMAI creates every policy in report-only first (V1 §3.8), which
   is stricter than Microsoft's page, not weaker. Recorded in §7.3; no change.

**Completion from the scan.** The policy is On and matches the target,
assignments and exclusions included.

**Acceptance.**
- D1 `why` names the flow concretely (a signed-in desktop session carried to a
  phone), not "carries sign-in between devices".
- D2 a risk states the protocol-tracking consequence.
- D3 the create procedure sets **Configure** to **Yes**.
- D4 the package's checked date is 2026-09-19.

---

## 6. `s-goal-block-unsupported-platforms` — Block Unsupported Device Platforms

**Outcome.** *Only Android, iOS, Windows and macOS reach this tenant; Linux and
any sign-in that reports no platform are blocked.*

**Microsoft facts.**

1. **Linux is a supported platform, and this policy blocks it.**
   `ms-ca-conditions` lists the platforms Conditional Access supports: "Android,
   iOS, Windows, macOS, Linux". The pinned target excludes the first four, so
   Linux falls inside the block along with everything unrecognised. The step's
   own words never said the word Linux; only the package's correct-conditions and
   report-only blocks did. **Added to the `why` and the risks.**
2. **The platform is what the client claims.** `ms-ca-conditions`: "Conditional
   Access identifies the device platform using information provided by the
   device, such as user agent strings. Because user agent strings can be
   modified, this information isn't verified." The step's risk said a platform
   "can be treated differently from the device's actual operating system", which
   describes the symptom without the cause. **Corrected to name the mechanism.**
3. **This policy shape is Microsoft's own recommendation.**
   `ms-ca-conditions`, Important: "Microsoft recommends creating a Conditional
   Access policy for unsupported device platforms. For example, to block access
   to corporate resources from **Chrome OS** or other unsupported clients,
   configure a policy with a Device platforms condition that includes any device,
   excludes supported device platforms, and sets Grant control to Block access."
   The pinned target is exactly that. No conflict.
4. The step's Learn link (`concept-conditional-access-conditions`) is the page
   that carries the Device platforms section. Correct; unchanged.

**Completion from the scan.** The policy is On and matches the target.

**Acceptance.**
- E1 the step says Linux is inside the block.
- E2 a risk says the platform comes from what the client reports and is not
  verified.
- E3 the create procedure keeps Microsoft's recommended shape (include Any
  device, exclude the four, Block).
- E4 the package's checked date is 2026-09-19.

---

## 7. Rendered at 1280, on the demo and the follow-up scan

Read on `http://localhost:5203/planner/?demo=1#/plan`, 2026-09-19. Every state
the group's steps reach on those two snapshots, and what it says now.

| State | Step and snapshot | What it reads |
|---|---|---|
| Not deployed, free to create | Block Unsupported Device Platforms, initial | «Core - Block - Unsupported platforms · 3 checks remaining · Report-only · Create the policy in report-only now.» The create task's step 3 sets **Configure** to **Yes**, and step 4 says Linux falls inside the block. |
| Waiting on the foundation | Block Legacy Authentication, initial | Up Next; a card reads «Prerequisite · To do · Prepare Emergency Access Accounts · Finish Prepare Emergency Access Accounts first» with its link. About states the MFA fact; Completion Criteria is the step's own two lines. |
| Report-only, observing | Block Authentication Transfer, follow-up | On Hold · Report-only. The policy card's next check is «Ready to enforce», the Observation card says time alone does not complete it, and a second card waits on Decide How People and Devices Sign In. Completion Criteria: «A scan confirms the policy is On, so a signed-in session on one device no longer signs anyone in on another…» |
| Ready to enforce | not reached by either snapshot for this group | The check itself is drawn (above); no fixture puts one of these four in the Ready · Ready to enforce badge. Recorded, not invented. |
| Enforced / in place | Block Legacy Authentication, follow-up | Completed · Enforced. About unchanged; Tasks Remaining holds only «New evidence · Review required», and the Entra task is the compare-and-confirm procedure. |
| A hold this step can reach | Block Device Code Sign-in, follow-up | On Hold · Enforced: «This step has no policy for IAMAI to write in this plan. Scan Contoso Pty Ltd again to rebuild it», beside «New evidence · Review required». True, and it names the one action. |
| Needs a decision | Block Device Code Sign-in / Block Legacy Authentication, initial | The action column reads «Answered in Confirm What You Use» with the unanswered question and its link. |

Two readings that are the anatomy's, not this group's words, and were left alone
(`policy-anatomy-deviations.md`):

- A step with no submittable operation titles its one Implementation Task with
  the **step's own name** ("Block Authentication Transfer"), where a step with
  operations titles it by the work ("Update the policy settings").
- The group heads "4 steps" and numbers its rows 1, 3, 4, 5, because the number
  is the registry position and `s-question-mail-devices` is not generated.

## 8. Recorded for the owner

1. **Microsoft against the pinned baseline, Block Legacy Authentication.**
   Learn's Exchange ActiveSync guidance asks for a policy assigned to users or
   groups with Exchange Online as its only resource; the pin assigns All users
   and All resources. The baseline is unchanged (CLAUDE.md: the pinned baseline
   wins). In practice the pin's shape is the one Learn's own
   `policy-block-legacy-authentication` procedure gives, which also says All
   users and All resources — the two pages disagree with each other.
2. **Authentication flows is labelled "(preview)"** on
   `concept-conditional-access-conditions` while `policy-block-authentication-flows`
   documents it as a how-to. Two steps of this group depend on it.
3. **Microsoft's authentication-transfer recipe skips report-only.** IAMAI does
   not. This is the tool being stricter; nothing to change, but it is a place
   where the screen and the linked page differ.
4. **`s-question-mail-devices` read as a different kind of step** beside the
   four policy steps in its group. Resolved on 2026-09-19: it is Block Legacy
   Authentication's second Implementation Task (§3 above), so the group draws one
   anatomy and numbers 1–4 with no gap.


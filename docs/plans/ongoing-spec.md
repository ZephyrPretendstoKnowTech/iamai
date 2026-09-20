# Ongoing Checks and Cleanup: the wave spec

The V1 spec (`v1-procedure.md` §5) for step group `ongoing`
(`src/roadmap/stepGroups.ts`), the catch-all, taken vertically: one outcome per
member, every technical claim rechecked against Microsoft Learn, and one
acceptance test per item. It follows `close-doors-spec.md` and
`protect-admins-spec.md`, which took groups 3 and 4 through the same procedure.

**Every Microsoft fact below was rechecked on 2026-09-20.** The date beside a
page is its own `ms.date`, read from the live page on that day.

**Frozen, and not touched by this wave:** the four Establish Emergency Access
steps and the four Direction steps. Anything this wave found in them is in
`frozen-step-suggestions.md`. The policy anatomy is Emergency Access's: no
component, class, heading, pill or tag is added here, and anything that looked
like it needed one is in `policy-anatomy-deviations.md`.

**What this group is.** Nine kinds of row that no other group claims: two policy
goals the rollout never reaches (one because its source contradicts itself, one
because it is a single application), two account-hygiene checks that also stand
in for two free-tier ladder rungs, the `s-review-baseline-*` family generated
per unassessed baseline policy, and the four `cleanup-*` rows. The Cleanup rows
keep today's shape — the owner excluded them from the 2026-09-19 anatomy change
(`CleanupStep.tsx`, `taskHead = row.kind === 'drill' ? TASK_HEAD : null`) — so
this wave changed their words and their accuracy and not one heading.

---

## 1. The sources

| Key | Page | `ms.date` | Checked |
|---|---|---|---|
| `ms-inactive` | https://learn.microsoft.com/entra/identity/monitoring-health/howto-manage-inactive-user-accounts | 2025-02-21 (updated 2026-05-05) | 2026-09-20 |
| `ms-signinactivity` | https://learn.microsoft.com/graph/api/resources/signinactivity | 2024-07-22 (updated 2025-07-05) | 2026-09-20 |
| `ms-create-users` | https://learn.microsoft.com/entra/fundamentals/how-to-create-delete-users | 2026-05-08 | 2026-09-20 |
| `ms-security-planning` | https://learn.microsoft.com/entra/identity/role-based-access-control/security-planning | 2024-11-21 (updated 2026-02-19) | 2026-09-20 |
| `ms-role-best-practices` | https://learn.microsoft.com/entra/identity/role-based-access-control/best-practices | 2026-06-01 | 2026-09-20 |
| `ms-privileged-accounts` | https://learn.microsoft.com/security/privileged-access-workstations/privileged-access-accounts | 2021-01-20 (updated 2026-03-26) | 2026-09-20 |
| `ms-emergency` | https://learn.microsoft.com/entra/identity/role-based-access-control/security-emergency-access | 2026-06-04 | 2026-09-20 |
| `ms-monitor-logs` | https://learn.microsoft.com/entra/identity/monitoring-health/howto-integrate-activity-logs-with-azure-monitor-logs | 2026-01-06 | 2026-09-20 |
| `ms-ca-resources` | https://learn.microsoft.com/entra/identity/conditional-access/concept-conditional-access-cloud-apps | 2026-03-24 (updated 2026-05-28) | 2026-09-20 |
| `ms-plan-ca` | https://learn.microsoft.com/entra/identity/conditional-access/plan-conditional-access | 2026-06-01 | 2026-09-20 |
| `ms-ca-conditions` | https://learn.microsoft.com/entra/identity/conditional-access/concept-conditional-access-conditions | 2026-06-02 (updated 2026-06-03) | 2026-09-20 |

### Facts that hold across this group

- **The Configure trap, this group's instance.** `ms-ca-conditions`: "By
  default, all newly created Conditional Access policies apply to all client app
  types even if the client apps condition isn't configured", and "The
  **Configure** toggle when set to **Yes** applies to checked items, when set to
  **No** it applies to all client apps, including modern and legacy
  authentication clients." Group 3 found this in the authored packages, group 4
  in the translator (`roadmap/portalLines.ts`). This group's instance is
  `s-goal-inforcer-mfa`, whose package told the reader to set **Client apps:
  All** — a selection that does not exist. Ticking all four boxes writes the four
  named types, not `all`, and IAMAI then reads a difference that never resolves
  (the same finding group 4 recorded against `s-goal-guests-mfa` in
  `protect-admins-spec.md` §8.5). **Corrected in §5.**
- **Report-only first.** Every IAMAI policy is created in report-only (V1 §3.8).
  `ms-plan-ca` agrees: "Enable each policy in report-only mode for at least one
  week before enforcement", and "By default, each policy created from a template
  is in report-only mode."
- **Emergency exclusions.** `ms-plan-ca`, Important: "Verify emergency access
  accounts are excluded from all policies". `ms-emergency` narrows it:
  "Report-only policies don't block access and don't need to exclude emergency
  accounts." Both matter to the review rows (§6), which ask an admin to deploy a
  baseline policy IAMAI does not assess.
- **The policy budget is the reason cleanup exists.** `ms-plan-ca`: "Conditional
  Access has a hard limit of 240 policies per tenant across all policy states",
  and "scaling effectively means *consolidating* policies, not adding more".
  This is the missing "why" under the consolidation row (§8.3).

---

## 2. `s-check-dormant-accounts` — Disable or Confirm Dormant Accounts

**Outcome.** *Every enabled account with no recent successful sign-in has one
recorded outcome: disabled, blocked from signing in, or kept with a named owner
and a reason.*

**Applies when.** Always, on every plan and every licence tier. It is also the
free tier's `stale-accounts` rung (`roadmap/ladder.ts COVERED_BY_STEP`), so its
words have to read correctly with no Entra ID P1 (§9).

**What IAMAI actually reads.** `derive/sets.ts notActiveUsers`: enabled person
accounts (guests included) whose `lastSuccessOf` is older than `INACTIVE_DAYS`
(90) or absent. `lastSuccessOf` is the later of the directory's
`signInActivity.lastSuccessfulSignInDateTime` and the newest successful sign-in
in the records IAMAI collected.

**Microsoft facts.**

1. **90 days is the low end of Microsoft's own window.** `ms-inactive`: "In many
   organizations, a reasonable window for inactive user accounts is between 90
   and 180 days", and "The challenge of this method is to define what *for a
   while* means for your environment." The step named 90 days and never said it
   was a choice. **Said now**, because a reader whose people take long leave
   needs to know the number is ours, not a Microsoft threshold.
2. **The property is not backfilled, so blank does not mean never used.**
   `ms-signinactivity`: "Effective December 1, 2023, the
   **lastSuccessfulSignInDateTime** property is available … The data isn't
   backfilled for this property", and "Microsoft Entra ID maintains interactive
   sign-ins going back to April 2020." `ms-inactive` adds that the value "might
   be blank if … the affected user account was never used for a sign-in attempt."
   The step's `why` said "an old or missing sign-in record is a reason to
   investigate, not proof that an account is unused", which is right but does not
   say *why*. **The reason is now stated** in the About and in the procedure.
3. **The record lags, so a sign-in does not clear the row today.**
   `ms-inactive`: "Typically, sign-ins show up in the related sign-in report
   within 6 hours", and "It might take up to 24 hours to update." The step said
   "have the owner sign in once; it leaves this list on the next scan", which is
   wrong if the next scan is ten minutes later. **Corrected** to say the record
   can take up to a day.
4. **Two Microsoft pages define the property differently, and the difference
   matters.** `ms-signinactivity`: `lastSuccessfulSignInDateTime` is "The date
   and time of the user's most recent successful **interactive or
   non-interactive** sign-in." `ms-inactive` says of the same property: "The date
   and time of the last successful interactive sign-in." Recorded in §10.1. The
   step now says what it reads — a successful sign-in — and does not claim it
   covers, or excludes, unattended use.
5. **Failed attempts are a different property.** `ms-signinactivity` on
   `lastSignInDateTime`: "This property records the last time a user attempted an
   interactive sign-in to the directory—whether the attempt was successful or
   not. Note: Since unsuccessful attempts are also logged, this value might not
   accurately reflect actual system usage." IAMAI reads the successful one, which
   is what Microsoft says to use. The package's troubleshooting already said so;
   nothing on screen did. **Added to help desk.**
6. **The licence.** `ms-inactive`, Prerequisites: "To access the
   `lastSuccessfulSignInDateTime` property using Microsoft Graph, you need a
   Microsoft Entra ID P1 or P2 license." The step's licence note already says
   this and is pinned by `scripts/walkContent.mjs` item 3. Unchanged.
7. **The control's name.** `ms-create-users`: "**Account enabled**: This option
   is checked by default. Uncheck to prevent the new user from being able to
   sign-in. … This setting was called **Block sign in** in the legacy create user
   process." The step's path is right; the least-privileged role was missing.
   `ms-create-users`: "Sign in to the Microsoft Entra admin center as at least a
   [User Administrator]". **Added.**
8. **Guests have their own Microsoft process.** `ms-inactive`, Note: "For
   inactive **guest** accounts, see Monitor and clean up stale guest accounts."
   `derive/sets.ts personAccounts` includes guests, so this list can hold one.
   **Added to help desk.**
9. Recorded, not on screen: `ms-inactive`'s answer to "How to address inactive
   users" is three questions — still employed, still needs the access, still
   needed for another reason — which is what the step's review already asks.

**Completion from the scan.** Every listed account is disabled, or kept with a
saved reason, read from the directory and from `mapping.dormantAccountChoices`
(`generate.ts`, the `s-check-dormant-accounts` pass). Nothing is ticked. A
re-scan reopens the step only when an enabled account re-enters the window
without a saved keep.

**Acceptance.**
- A1 About says 90 days is IAMAI's window and names Microsoft's 90-to-180 range.
- A2 About says a blank record is not proof: the directory's value is not
  backfilled and older sign-ins are not kept.
- A3 the procedure does not promise the row clears on the next scan; it says the
  directory's record can take up to a day.
- A4 help desk says the reading is a *successful* sign-in, and that a failed
  attempt does not count as use.
- A5 help desk sends a stale guest to Microsoft's guest process.
- A6 the disable procedure names the User Administrator role, in the step and in
  its package.
- A7 the package carries a checked date of 2026-09-20 and the step shows it.

---

## 3. `s-check-separate-admin-accounts` — Use Separate Accounts for Admin Work

**Outcome.** *Every directory role in this tenant is held by an account that does
nothing else, and the everyday account of the person who holds it has no
privileged role.*

**Applies when.** Always. It is also the free tier's `admin-accounts-separate`
rung (`COVERED_BY_STEP`), so it has to read correctly with no sign-in logs (§9).

**Microsoft facts.**

1. **"No licence, no mailbox" is wrong.** The procedure said to "assign no
   licence, so it has no mailbox". `ms-security-planning`, *Ensure separate user
   accounts and mail forwarding for Global Administrator accounts*: "Be sure
   those accounts have their email forwarded to a working mailbox", and, in the
   Stage 2 inventory, "Ensure that your accounts that are used for administration
   purposes: Have working email addresses attached to them". An admin account
   nobody can reach misses PIM approvals, role-activation notices and Microsoft's
   own service messages. **Corrected**: no mailbox to read, but a working address
   that reaches the person.
2. **The reason is phishing, not tidiness.** `ms-security-planning`: "Personal
   email accounts are regularly phished by cyber attackers, a risk that makes
   personal email addresses unacceptable for Global Administrator accounts. To
   help separate internet risks from administrative privileges, create dedicated
   accounts for each user with administrative privileges", and "Make sure that
   your Global Administrators don't accidentally open emails or run programs with
   their administrator accounts." The About said the separation "reduces the
   exposure of privileged access to everyday mail, meetings and browsing", which
   is the shape of the fact without the fact. **Corrected.**
3. **Cloud-only, with the reason.** `ms-role-best-practices` §9: "Avoid using
   on-premises synced accounts for Microsoft Entra role assignments. If your
   on-premises account is compromised, it can compromise your Microsoft Entra
   resources as well." `ms-security-planning`: "Global Administrator (and other
   privileged groups) accounts should be cloud-only accounts with no ties to
   on-premises Active Directory." The step said "cloud-only" and never why.
   **Added.**
4. **Two numbers a reviewer can hold.** `ms-role-best-practices` §5: "Microsoft
   recommends that you assign the Global Administrator role to **fewer than
   five** people in your organization"; §6: "you should limit the use of these
   privileged role assignments to **fewer than 10**". Neither number was
   anywhere in this step. **Added as a risk**, because the review is the moment
   an admin counts.
5. **The registration page.** The procedure sent the reader to
   `https://aka.ms/mysecurityinfo`. Group 4 corrected the same class on
   `s-ladder-operator-passkey` to the page Microsoft's own registration article
   names, `https://mysignins.microsoft.com/security-info`
   (`protect-admins-spec.md` §2.1). **Corrected here too**, so the two steps send
   an admin to one page.
6. **What the everyday-work evidence is worth.** `ms-privileged-accounts` is the
   step's Learn link and has an `ms.date` of 2021-01-20: it is the account-tier
   model, not a how-to, and it does not name a mailbox test. The step's own
   second Completion Criteria line already says mail and Teams activity are clues
   and their absence proves nothing. **The Learn link moves** to
   `ms-security-planning`, which is the page that carries the instruction the
   step gives.
7. Recorded, not on screen: `ms-role-best-practices` §2 and §7 (PIM just-in-time,
   role-assignable groups) and §4 (access reviews) are the governance layer above
   this step, not its work.

**Completion from the scan.** A saved review for each active and eligible
directory-role holder, plus the directory reading that the everyday account no
longer holds the role (`roadmap/manualWork.ts`, the step's manual record). The
handover itself is manual evidence — one of the V1 §3.3 exceptions, because no
scan sees an admin promise to stop reading mail on that account.

**Acceptance.**
- B1 the procedure gives the admin account a working email address and no longer
  says to leave it without one.
- B2 About names phishing as the reason, not "exposure".
- B3 the procedure says why the account is cloud-only.
- B4 a risk carries Microsoft's two counts: fewer than five Global
  Administrators, fewer than ten privileged role assignments.
- B5 the step and its package send the reader to
  `mysignins.microsoft.com/security-info`, and neither says `aka.ms`.
- B6 the step's Learn link is the page that carries this instruction.
- B7 the package's checked date is 2026-09-20 and the step shows it.
- B8 on a free tenant the step says it cannot see everyday use, and asks for the
  review anyway (§9).

---

## 4. `s-goal-admin-portals-protected` — Block the Admin Portals for Non-Admins

**Outcome.** *Nothing is deployed for this policy: the pinned baseline defines it
two ways, and IAMAI will not guess which one was meant.*

**Applies when.** Never, today. `roadmap/baselineConflict.ts` lists it in
`RETIRED_DECISION_STEPS`, the step reaches `sourceConflict` on every fixture, and
its Implementation region draws the conflict box instead of a procedure. This
spec does not invent a path for it.

**Baseline reading.** Pinned member `fafaa50c-0b61-4ac6-a589-f9a1120b2f9e`. Its
documentation says the policy spares administrators; its definition targets All
users and excludes no directory role, account or group. The step's conflict words
already say exactly that, and they are good. They are unchanged.

**Microsoft facts.** These are what the step *can* say honestly while it deploys
nothing: what the baseline's target resources actually reach.

1. **The Admin Portals grouping is four portal app IDs and nothing behind them.**
   `ms-ca-resources`: "When a Conditional Access policy targets the Microsoft
   Admin Portals cloud app, the policy is enforced for tokens issued to specific
   underlying resource application IDs associated with Microsoft admin portals.
   The app grouping doesn't include the backend services that those portals might
   call or depend on." So a Block here does not stop Microsoft Graph, Microsoft
   Graph PowerShell or the APIs those portals sit on. The step's risks never said
   it, and an admin reading "Block the Admin Portals" reasonably assumes it does.
   **Added to the risks.**
2. **A Block on this app hits a thing end users do.** `ms-ca-resources`, Note:
   "Block policies that target the Microsoft Admin Portals will block end users
   from accessing the Microsoft 365 self-install page, as this page is currently
   located in the Microsoft 365 admin center." That is Office installs, for
   everyone, from a policy named for admin portals. **Added to the risks.**
3. **The grouping is not an exclusion mechanism.** `ms-ca-resources`: "The Admin
   Portal grouping is primarily intended for include scenarios … This option
   isn't intended to function as a bulk exclusion mechanism for all backend
   services associated with the underlying application IDs." Recorded; the
   baseline includes rather than excludes it, so no word changes.
4. **The second resource reaches further than its name.** `ms-ca-resources` on
   Windows Azure Service Management API: the grouping covers Azure Resource
   Manager, the Azure portal ("which also covers the Microsoft Entra admin center
   and the Microsoft Engage Center"), Azure Data Lake, Application Insights API
   and Log Analytics API, and "any services or clients that depend on the Azure
   API can be indirectly affected", listing Azure CLI, Azure PowerShell and the
   Microsoft 365 admin center. Caution: policies on it "[no longer cover Azure
   DevOps]". Note: "It doesn't apply to Microsoft Graph PowerShell." The step's
   third risk said only "Anyone with an Azure RBAC role but no directory role is
   blocked from the Azure portal and CLI". **Widened to what the resource
   actually reaches.**
5. The step's Learn link is `concept-conditional-access-cloud-apps#microsoft-admin-portals`,
   which is the section carrying every fact above. Correct; unchanged.

**Completion from the scan.** There is none to have. Completion Criteria is "The
baseline author publishes a version that resolves the contradiction between the
policy's documentation and its definition", which is true and is the only thing
that would change the step. A re-scan of the tenant cannot move it; a re-pin can.

**Acceptance.**
- C1 About names the contradiction in its first sentence, instead of opening on a
  benefit the step does not deliver.
- C2 a risk says the Admin Portals app covers the portals and not the services
  behind them.
- C3 a risk says a Block here also stops the Microsoft 365 install page for
  everyone.
- C4 the Azure management risk names what that resource reaches, including the
  command-line tools.
- C5 the step reaches no create on any fixture, and its Completion Criteria is
  still the baseline author's publication.
- C6 the row's Impact names the subject instead of the placeholder.

---

## 5. `s-goal-inforcer-mfa` — Require MFA for Inforcer Access

**Outcome.** *A sign-in to the Inforcer application asks for MFA, through one
policy that names Inforcer by its application ID.*

**Applies when.** The Direction answer for Inforcer is "In use", and the scan
resolved the application. Answered "Not in use", the step is set aside with
"Inforcer is confirmed not in use. MFA protection for this service is not
claimed."

**Baseline reading.** Pinned member `1d3a7677-a723-4c56-924c-2e1dc63df105`: All
users with resolved exclusions, target resource `708861da-226e-4d65-a57a-24128df64524`,
`clientAppTypes: ["all"]`, grant = built-in Require multifactor authentication,
no session controls.

**Microsoft facts.**

1. **"Client apps: All" is not a selection.** The create procedure's step 5 said
   "Client apps: **All**", and the correction block said "Client apps to All".
   Per `ms-ca-conditions` (§1), an unconfigured client-apps condition already
   applies to every client app type; ticking the four boxes writes the four named
   types, which is a different policy and a difference IAMAI can never resolve
   against a target of `all`. **Both corrected to leave the condition
   unconfigured, and to say why.** This is the same correction group 4 made to
   `s-goal-admin-session` in the translator and recorded as outstanding for the
   authored packages (`protect-admins-spec.md` §8.5).
2. **A policy scoped to users does not reach the service principals calling the
   same app.** `ms-plan-ca`: "Calls made by service principals aren't blocked by
   Conditional Access policies scoped to users. Use Conditional Access for
   workload identities to define policies that target service principals." The
   package's observe block said this; the step's risks were empty. **Added as a
   risk**, because it is the difference between "Inforcer is protected" and "the
   people signing in to Inforcer are".
3. **Conditional Access applies to resources, not clients.** `ms-ca-resources`:
   "Conditional Access applies to resources not clients, except when the client
   is a confidential client requesting an ID token." So this policy applies
   whenever any client asks for an Inforcer token, from any app. **Added to the
   About**, which previously said only "Require MFA when people sign in to
   Inforcer."
4. **An app-by-app policy is the shape Microsoft argues against.**
   `ms-plan-ca`: "Creating a policy for each app isn't efficient and makes
   managing policies difficult. Conditional Access has a hard limit of 240
   policies per tenant", and, separately, "From a security perspective, it's
   better to create a policy that includes **All resources**". The step already
   renders an existing-coverage line pointing at the all-users MFA policy and at
   the consolidation row. **Added as a risk** so the reader sees the tension
   before deploying, not after.
5. **The application ID, not the name.** `ms-ca-resources`: "Some applications
   don't appear in the picker at all", and the whole app-picker section keys on
   the service principal. The package's rule — "Match the exact application ID,
   not a similar display name" — is right and is kept. What was wrong was the
   rendered sentence: the package wrote `application ID **708861da-…**`, and the
   name directory substitutes `"Inforcer (baseline name)" (708861da-…)` for the
   id, so the line called a display name an application ID. The `(baseline
   name)` marker is deliberate — `src/names.ts` records that the name comes from
   the pinned policy and is not a vendor or first-party claim — so the sentence
   moved around it instead. **Corrected.**

**Completion from the scan.** The policy exists, is On, and its target resource,
assignments, exclusions, grant and absent session controls match the target; plus
the intended person can reach Inforcer with an accepted method. A re-scan reopens
the step only when the policy's semantics move.

**Acceptance.**
- D1 the create and correct procedures leave the Client apps condition
  unconfigured and say why, and neither says "Client apps: All".
- D2 a risk says a user-scoped policy does not cover service principals calling
  Inforcer.
- D3 About says the requirement follows the resource, from whatever client asks
  for it.
- D4 a risk names the cost of one policy per application.
- D5 no rendered line calls a display name an application ID, and the baseline's
  own name marker is left alone.
- D6 the package's checked date is 2026-09-20 and the step shows it.
- D7 the row's Impact names the subject instead of the placeholder.

---

## 6. `s-review-baseline-*` — the baseline review family

**Outcome (per row).** *You have read the baseline's policy for this service,
decided whether it belongs in this tenant, and recorded that decision against the
version you read.*

**Applies when.** The pinned package carries a policy IAMAI has no goal for
(`coverage.organisation.notAssessed`), and the Direction answer for its service
is not "Not in use". One row per policy; four on the demo.

**Where the words are.** `pages.app.plan.workflows` in `content.json`, read by
`roadmap/workflows.ts addWorkflowSteps`. Per-policy words (`policies[]`) give the
title, the About and one instruction; everything else — `source`,
`reviewInstructions`, `reviewDone`, the Learn link and the fallbacks
`reviewTitle` and `reviewWhy` — is the template every row draws. This wave
changed the template once, and left the five per-policy entries alone.

**Microsoft facts.**

1. **The Learn link was locale-pinned and generic.** `workflows.ts` hard-coded
   `https://learn.microsoft.com/en-us/entra/identity/conditional-access/overview`.
   Every other Learn URL in the product is locale-free, so this one row family
   sent a reader to a different site shape; and the overview page is not the page
   for "decide whether this policy belongs here". **Changed to `ms-plan-ca`**,
   whose *Ask the right questions* section is exactly this task: "Here are common
   questions about assignments and access controls. Record the answers for each
   policy before creating it."
2. **Report-only is not conditional.** `reviewInstructions` said "Where the
   policy supports report-only, use it first and review the results." Every
   Conditional Access policy supports it. `ms-plan-ca`: "Enable each policy in
   report-only mode for at least one week before enforcement. Review sign-in logs
   and communicate changes to users before moving to the next phase."
   **Corrected** to say it plainly, with the review that follows it.
3. **Exclusions are the thing that goes wrong, and they need testing.**
   `ms-plan-ca`: "**Ensure you test the exclusion criteria of a policy**. For
   example, you might exclude a user or group from a policy that requires MFA.
   Test whether the excluded users are prompted for MFA, because the combination
   of other policies can require MFA for those users." The template said
   "Preserve emergency access" and stopped. **Corrected**, with `ms-emergency`'s
   narrowing: "Report-only policies don't block access and don't need to exclude
   emergency accounts."
4. **A deleted policy is recoverable for a while; a disabled one is recoverable
   now.** `ms-plan-ca`, *Roll back policies*: "**Disable the policy.** Disabling
   a policy makes sure it doesn't apply when a user tries to sign in", and "If a
   Conditional Access or location is deleted, it can be restored within the 30
   day soft-delete period." The template offered no rollback at all. **Added**,
   as the disable-first instruction.
5. Recorded, not on screen: the `WindowsAzureAD | BaselineScopes` row's policy is
   the one Microsoft is changing under it — `ms-ca-resources` carries a Warning
   that low-privilege scopes previously excluded from an All-resources policy
   with exclusions "will **no longer be excluded**", rolling out in phases. That
   is a per-policy fact, and per-policy words were out of this wave's scope
   (§10.3).

**Completion from the scan.** It cannot be: the row is an attestation, one of the
V1 §3.3 exceptions. What *is* durable is the basis it is recorded against —
`workflows.ts` builds it from the policy's name, its JSON, the tenant objects its
source references, the omitted references and the service answer — so the record
survives an unrelated tenant change and reopens when any of those move. Nothing
on screen said so. **`reviewDone` now says it**, which is what makes the row
honest about what "done" means here.

**Acceptance.**
- E1 the family's Learn link is locale-free and is the planning page.
- E2 the template tells the reader to create it in report-only and review the
  sign-in logs, with no "where the policy supports it" hedge.
- E3 the template says to test the exclusions, not only to preserve them.
- E4 the template says to disable rather than delete when rolling back.
- E5 Completion Criteria says the record is held against the version reviewed and
  reopens when that source or its references change.
- E6 the four demo rows still draw their own per-policy titles and About lines.

---

## 7. `cleanup-alerting` — Alert on Emergency Account Sign-ins

**Shape unchanged** (owner: the Cleanup rows keep today's anatomy). Words and
accuracy only.

**Outcome.** *A sign-in by an emergency account reaches a named person, and
somebody has proved it by signing in on purpose.*

**Microsoft facts.**

1. **Match the object ID, not the sign-in name.** The row said "Create an alert
   rule for sign-ins where UserPrincipalName is one of {list:emergencyAccountUpns}".
   `ms-emergency` leads with the object ID: its *Obtain Object IDs of the
   emergency access accounts* procedure, then `SigninLogs | where UserId ==
   "…"`, with the UPN query offered as an alternative. A UPN can be renamed and
   the rule then matches nothing. **Corrected**: the object ID is the match, the
   sign-in name is the label.
2. **The alert rule's real settings.** `ms-emergency`: Azure portal → **Monitor**
   → **Alerts** → **+ Create** → **Alert rule**; Scope is the Log Analytics
   workspace; on Condition, "From the **Signal name** drop-down, select **Custom
   log search**" with "Query type to **Aggregated logs**"; Alert logic
   "**Threshold type** to **Static**", "**Operator** to **Greater than**",
   "**Threshold value** to **0**"; Details "Select the **Severity** of the event.
   Use **0 - Critical**" and "Under **Advanced options**, select **Enable upon
   creation**"; and the Azure role is "at least a [Monitoring Contributor]". The
   row said "Create an alert rule" and left every one of these to the reader.
   **Added**, as the one place they belong.
3. **The prerequisite is a diagnostic setting, with a role and a path.**
   `ms-monitor-logs`: "Sign in to the Microsoft Entra admin center as at least a
   [Security Administrator]" then "Browse to **Entra ID** > **Monitoring &
   health** > **Diagnostic settings**", "Select **+ Add diagnostic setting**",
   "Select the log categories that you want to stream", "Under **Destination
   Details** select the **Send to Log Analytics workspace** check box". It also
   needs an Azure subscription and a Log Analytics workspace. The row named the
   path and neither role nor the subscription. **Added.**
4. **Azure Monitor is one option of three.** `ms-emergency`: "You can use Azure
   Monitor, Microsoft Sentinel, or other tools to monitor the sign-in logs and
   trigger email and SMS alerts to your administrators whenever emergency access
   accounts sign in. This section illustrates using Azure Monitor." The row
   already said to use the monitoring system you have. Unchanged, now sourced.
5. **The alert needs somewhere to go, and someone to answer it.**
   `ms-emergency`'s action group is "Email/SMS message/Push/Voice" with a
   notification name, and its *Prepare a post-mortem team* section: "If the alert
   is triggered, preserve the logs from Microsoft Entra and other workloads.
   Conduct a review of the circumstances" to decide whether the use was a drill,
   a real emergency, or misuse. The row asked for a recipient and a test, and
   said nothing about what happens when the alert fires. **Added to Completion
   Criteria**, because an alert nobody has agreed to answer is not done.
6. Recorded, not on screen: `ms-emergency`'s "Validate account functionality at
   least every 90 days" belongs to the drill row, which is frozen.

**Completion from the scan.** It cannot be — the alert lives outside Entra. The
row records the test result, the recipient and the date
(`CleanupStep.tsx`, `cleanupEvidenceLines`), which is manual evidence under
V1 §3.3.

**Acceptance.**
- F1 the rule matches the accounts' object IDs, and the sign-in name is the
  label rather than the match.
- F2 the alert rule's signal, query type, threshold, severity and Azure role are
  on screen.
- F3 the diagnostic-setting prerequisite names the Entra role and the workspace.
- F4 Completion Criteria names who answers the alert and what they do with it.
- F5 the row still draws Why, Implementation Tasks and Done when — no heading
  moved, and no Cleanup row carries a key it did not carry before.
- K1 every Cleanup row's words reach the prompt pack whole (§10.7).

---

## 8. The three remaining Cleanup rows

Same rule: today's shape, better words.

### 8.1 `cleanup-hardening` — Harden Emergency Access

**Outcome.** *Every emergency-access improvement this plan deferred now passes on
a scan.*

The row's job is to re-present deferred `bg.*` recommendations, and it is the one
Cleanup row IAMAI *can* complete from the scan. The words said "Completing them
makes the recovery process more resilient", which is a claim with no content.
`ms-emergency`'s *Security guardrails summary* is the list these deferrals come
from — cloud-only `.onmicrosoft.com` accounts, phishing-resistant methods
different from the normal admin accounts, credentials and devices that don't
expire "or be in scope of automated cleanup due to lack of use", permanent active
Global Administrator in PIM, separate secure storage. **The About now says what
the deferrals are and that the scan closes the row**, which is the one thing
distinguishing this row from the other three.

- G1 About says the scan closes this row, and a deferral is not a pass.

### 8.2 `cleanup-naming` — Align Policy Names

**Outcome.** *Every Conditional Access policy in this tenant says what it does
without being opened.*

- **The reason, from Microsoft.** `ms-plan-ca`: "A naming standard helps you find
  policies and understand their purpose without opening them." The row said
  "Consistent names make policy reviews easier for the next person responsible
  for the tenant". **Corrected to Microsoft's, which is sharper and is the test.**
- **What a name should carry.** `ms-plan-ca`, *Set naming standards for your
  policies*: "Name your policy to show: A sequence number / The cloud apps it
  applies to / The response / Who it applies to / When it applies", and "The
  sequence number is helpful if you need to reference a policy in a
  conversation." IAMAI proposes names from the tenant's own convention, so it
  does not impose Microsoft's; naming the five parts tells a reviewer what the
  proposal is for. **Added.**
- **Ownership lives in the name.** `ms-plan-ca`: "Because Conditional Access
  policies don't have a built-in owner attribute, encode ownership in the policy
  name (for example, a team prefix) and maintain an out-of-band registry that
  maps each policy to a responsible admin or team." Nothing said it. **Added.**
- **The rename is safe, and the row already said why.** "Renaming changes no
  Conditional Access evaluation, but scripts or reports that find policies by
  name may need updating; keep the same policy IDs and settings." True and kept.

- H1 About is Microsoft's reason: a name you don't have to open the policy to read.
- H2 the procedure names what a policy name should carry.
- H3 the procedure says ownership is encoded in the name because the policy has
  no owner field.

### 8.3 `cleanup-consolidation` — Review Overlapping Policies

**Outcome.** *Each overlap is settled: both policies kept for a recorded reason,
or one retired after the survivor is shown to cover it.*

- **The budget is the reason.** `ms-plan-ca`: "Conditional Access has a hard
  limit of 240 policies per tenant across all policy states, including
  report-only mode, on, or off", and "scaling effectively means *consolidating*
  policies, not adding more", and "**Audit and consolidate regularly.** Review
  your policies periodically to remove redundant or conflicting rules." The row
  said overlaps "can make later changes harder to understand". **Corrected**: the
  limit is a fact, the confusion is a consequence.
- **Rollback, concretely.** The row said "keep a rollback record".
  `ms-plan-ca`: "**Disable the policy.** Disabling a policy makes sure it doesn't
  apply when a user tries to sign in. You can always come back and enable the
  policy when you want to use it", and "If a Conditional Access or location is
  deleted, it can be restored within the 30 day soft-delete period."
  **Corrected** to disable first, delete later — which is also what the row's own
  saved record then verifies on the next scan.
- **The safety line stays.** "Never remove High-risk coverage because a
  Medium-only policy exists" is IAMAI's, not Microsoft's, and it is the reason
  this row asks for a coverage check rather than a count. Unchanged.

- J1 About names the per-tenant policy limit as the reason to consolidate.
- J2 the procedure says to disable before deleting, and what the delete window is.

---

## 9. The free tier (`micro`)

Both check steps are on every plan, and on a free tenant they are two of the very
few rows there are. What they read there, taken from `runFixture('micro')`:

| Step | What `micro` reads |
|---|---|
| Disable or Confirm Dormant Accounts | «Ready · Review», bar «Complete the review below», lead «1 enabled account with no sign-in for 90 days or none on record.», one name with its date, then the licence note: «Last sign-in dates need Entra ID P1; without it every account here reads no sign-in on record.» |
| Use Separate Accounts for Admin Work | «Ready · Review», lead «Review the 1 administrator account for dedicated administration.», tile «Administrator Account Evidence · Account or role data not fully read». **No evidence list at all**, because mail and Teams activity come from sign-in logs a free tenant does not have. |

The dormant step already carries its licence note, pinned by
`scripts/walkContent.mjs` item 3. The separation step carried nothing: on a free
tenant it asked an admin to review accounts against evidence it could not show,
and did not say so. **A licence note was added to its `who`, matching the dormant
step's** — the one place the two steps had diverged. That is acceptance B8.

Recorded: `micro`'s fixture gives its users `lastSuccessfulSignIn` dates even
though its licence is `none`, so the fixture shows dates beside a note saying
there would be none. The note is right and the fixture is not a tenant; §10.2.

---

## 10. Recorded for the owner

1. **Microsoft defines `lastSuccessfulSignInDateTime` two ways.** The Graph
   reference (`ms-signinactivity`) says "most recent successful **interactive or
   non-interactive** sign-in"; the how-to (`ms-inactive`) says "the last
   successful interactive sign-in". IAMAI reads the property and the sign-in
   records it collected, and its words now say "a successful sign-in" without
   claiming either reading. If the Graph reference is right, an account kept alive
   only by a background client is *not* listed here, which is the safer error.
2. **`micro` shows sign-in dates on a free licence.** The fixture populates
   `lastSuccessfulSignIn` regardless of tier, so the free-tier reading of the
   dormant step cannot be checked end to end against a fixture. The licence note
   is asserted from content; the empty-evidence case is checked on the separation
   step, where `micro` really does have nothing.
3. **The review family's per-policy words were out of scope.** The task set the
   template as the unit ("make the template right once"), and the five
   `policies[]` entries keep their authored titles, About lines and one
   instruction each. One of them is now out of date in a way worth a later pass:
   `ms-ca-resources` carries a Warning that the baseline-scopes exclusion
   behaviour is changing in phases, which is the subject of the
   `WindowsAzureAD | BaselineScopes` row.
4. **`s-goal-admin-portals-protected` still renders three channels it cannot
   use.** Its snapshot lists Entra, PowerShell, JSON and AI Info while its
   Implementation region draws the conflict box; `packageDrawsImplementation`
   and the conflict path disagree about whether there is anything to offer. No
   word fixes it, and it is the anatomy's, not this group's
   (`policy-anatomy-deviations.md`).
5. **"Affected people · No user impact" sits on both check steps.** The tile is
   the shared contract's (`stepContract.ts`, the `people` satisfied tile) and
   reads from `population.active`, which the dormant step deliberately sets to
   zero. Its note underneath says "These are the accounts this step asks you to
   review", so one card says two things. Changing the tile is a shared-anatomy
   change, so it is written up in `policy-anatomy-deviations.md` rather than
   patched here.
6. **`whatToDoReference` is nobody's renderer**, as `protect-admins-spec.md` §8.6
   records. The admin-portals reference lines corrected in §4 are the review
   page's and the reviewer's; the step itself renders no procedure at all.
7. **The prompt pack was silently clipping Cleanup, and this wave fixed it.**
   `roadmap/prompts.ts` put every Cleanup row into one data block, and
   `dataBlock` clips a block at `PROMPT_BLOCK_MAX` (4,000 characters). On the
   demo that block was already 5,130 characters before this wave — the
   consolidation row's Completion Criteria was being dropped, and the alerting
   row's new procedure pushed its *title* past the cap too, which is how the
   existing `cleanupExports.test.ts` caught it. Each row now gets its own
   bounded block, exactly as each step already did, so a long row can only cost
   itself. Acceptance K1 asserts every line of every Cleanup row reaches the
   pack whole. The drill row is frozen and gained nothing; it is simply no
   longer able to crowd the rows after it.

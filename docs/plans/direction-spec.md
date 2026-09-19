# Decide Your Tenant's Direction: the spec (approved by the owner, 2026-09-19)

This is the second pinned group on the Plan, right after Establish Emergency Access. It has four steps, takes about 30 minutes, and asks for **answers only: nothing is changed in Entra.**

It follows the V1 standard (`v1-procedure.md` §3) and "intent over evidence":
- The scan pre-fills every answer, and the person approves or changes it.
- Nothing is hidden on evidence alone.

## Shared rules (all four steps)

- **Anatomy:** it's Emergency Access's, minus Implementation Tasks, because nothing is built.
  - **About this Step:** one or two sentences.
  - **Questions:** one tile per question. Each tile shows the pre-filled answer, why it was suggested (the evidence in one line), and a way to change it.
  - **Completion Criteria:** "Every answer is approved."
- **Pre-fill:**
  - "What you use" questions are pre-filled with **today's state**, from the scan.
  - "How it should work" questions are pre-filled with **the baseline's recommendation**, with today's state shown beside it ("Today: 3 of 12 computers are joined").
- **No signal:** where the scan has no evidence for a question, the suggestion is the safer answer. A service defaults to Yes, which keeps its policy; an exception defaults to None or Not used, so no exception is granted. The step says it's a default, not something seen. Building Direction adds no Graph permission; a pre-fill IAMAI can't read today uses this default.
- **Approving:** one **Approve answers** button per step saves every answer at once. A person can change any single answer before or after approving.
- **No "Not sure" option.** Every question has a suggested answer, and the step says: "Not sure? Keep the suggestion. You can change it any time." Today "Not sure" blocks policies indefinitely.
- **Done:** the step is complete when every answer is saved.
- **Re-scan:** a completed step reopens only when new evidence contradicts a saved answer, for example "You said No to Azure Virtual Desktop, but 14 people signed in to it this week." It never reopens because evidence merely went missing.
- **Gating:** a policy waits only on the answers it depends on. Until then it reads "Waiting on your direction" and links to the question. Policies that depend on no answer are free to go.
- **Storage:** answers stay in their existing keys (`workflowAnswers`, `questionAnswers`, the pickers), so no saved answer is lost. The new step ids resolve to the old keys through one alias table.

---

## D1. Confirm What You Use

**About:** "Tell us which services and sign-in paths your organisation uses, so the plan only includes the policies you need, and closes the ones you don't."

| Question | Options | Pre-fill from | What the answer does |
|---|---|---|---|
| Azure Virtual Desktop | Yes / No | Sign-ins to it (30 days) | Yes adds the baseline's two AVD policies, plus the AVD users group to create |
| SharePoint and OneDrive from outside the office | Yes / No | SharePoint sign-ins | Yes adds the off-network SharePoint policy |
| Azure portal, CLI or PowerShell for managing Azure | Yes / No | Azure management sign-ins | Yes adds MFA for Azure management |
| Inforcer | Yes / No | Inforcer app sign-ins | Yes adds MFA for Inforcer access |
| Sync from on-premises Active Directory (Entra Connect) | Yes / No | The sync account's role, or its sign-ins | Yes adds "Restrict the Entra Connect sync account" |
| Devices or apps that send email by signing in (printers, scanners, line-of-business apps) | None / Some (pick the accounts) | Old-protocol email sign-ins, when readable | Some: those accounts get a task on Block Legacy Authentication (move them to a relay first). None: the block has no exceptions |
| Device code sign-in (CLI tools, meeting-room devices) | Not used / In use | Device code sign-ins | Not used: the block has no exceptions. In use: the exception is a task on that policy |
| Partner or MSP technicians who sign in to your tenant | No / Yes | Partner relationships and service-provider sign-ins | Yes: the partner exclusion task goes on the guest and countries policies |
| External authentication methods (a third-party MFA provider) | No / Yes | The authentication methods policy | Yes: the external-method users group, for the risk policy |

## D2. Identify Service and Shared Accounts

**About:** "Some accounts aren't a person: a mailbox a scanner uses, a script's account, a meeting-room device. Mark them, so every count on the plan is about people, and these accounts get their own rules."

| Question | Options | Pre-fill from | What the answer does |
|---|---|---|---|
| Service accounts (includes script accounts) | Pick accounts, or None | Today's detection (names, non-interactive use) | Leaves people counts. Drives the service accounts group and "Restrict service accounts to the trusted network" |
| Shared device accounts | Pick accounts, or None | Today's shared-device detection | Leaves people counts. Drives the shared devices policy |

The Emergency Access accounts are already excluded, and are shown as "already set aside".

## D3. Decide How People and Devices Sign In

**About:** "Choose where your devices are heading. It's fine if today looks different: the plan prepares the gap before anything is enforced."

| Question | Options | Suggested | Shown beside it | What the answer does |
|---|---|---|---|---|
| Company computers | Managed (joined to Entra and enrolled) / Hybrid joined / Left unmanaged | Managed (the baseline) | "Today: N of M computers seen are joined" | Managed or Hybrid: "Require a managed device" applies; the gap becomes preparation. Unmanaged: that policy is left out, and the Plan says what that means |
| Phones | Enrolled in Intune / App protection only / Unmanaged / Blocked from company data | App protection (the baseline) | "Today: N phones signed in" | Drives the phone policies, and "Keep company data off phones" when Blocked |
| Devices that can't meet the rule (kiosks, lab machines) | None / Some | None | — | Some: the device exceptions group is created later, in the Devices wave |

Intune is treated as in use when either computers or phones are managed. There's no separate question.

## D4. Decide Where People Sign In From

**About:** "Tell us where your people work from. This sets which countries are allowed and which network counts as the office."

| Question | Options | Pre-fill from | What the answer does |
|---|---|---|---|
| The office network | Pick trusted locations or addresses / Everyone works remotely | The tenant's trusted named locations | The trusted network in the service accounts and sign-up policies. Remote: those policies use the remote-work form |
| Work countries | Pick countries | The countries sign-ins come from (30 days) | The allowed-countries location for "Block countries not allowed" |
| Travel outside those countries | Allowed, with notice (a temporary travellers group) / Never | Allowed, with notice | Allowed: the travellers group and its task on the countries policy. Never: no exception |

---

## Owner decisions (2026-09-19)

1. **Layout:** About this Step / Questions / Completion Criteria. There are no Implementation Tasks.
2. **"Not sure" is dropped.** Every question has a suggestion.
3. **Gating is per answer.** A policy waits only for the answers it depends on. This replaces the step map's "nothing after Direction is Ready until it's answered".
4. **Intune** follows D3; there's no separate question.
5. **D2 is titled** "Identify Service and Shared Accounts".

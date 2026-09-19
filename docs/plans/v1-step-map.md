# The V1 step map (draft for owner approval, 2026-09-19)

One page, covering every step in V1: where it sits, what makes it apply, and what happens to every step that exists today.

Two sources sit behind it:
- the facts in `v1-step-inventory.md`;
- the rules in `v1-procedure.md` §3 (the V1 standard) and `iamai-intent-over-evidence`.

## The shape

**Only two pinned groups, then the lanes.** You said too many groups confuses people. So:
1. **Establish Emergency Access** (pinned, 4 steps, frozen).
2. **Decide Your Tenant's Direction** (pinned, 4 steps, answers only, about 30 minutes).
3. **Everything else** shows in the Ready, Up Next and On Hold lanes, as today, ordered by wave. The waves are the build order and the sort order. They are **not** new visible groups.
4. **Cleanup** stays where it is, with the new lockdown kit added.

A policy waits only for the Direction answers it depends on (owner, 2026-09-19). Until then its row says "Waiting on your direction" and links to the question.

## 1. Establish Emergency Access: frozen, no change

| # | Step | Today |
|---|---|---|
| 1 | Prepare Emergency Access Accounts | `s-prereq-break-glass` |
| 2 | Configure Emergency Exclusions | `s-prereq-exclusion-group` |
| 3 | Configure Passkey Authentication | `s-prereq-passkey-settings` |
| 4 | Verify Emergency Access | `cleanup-drill` |

## 2. Decide Your Tenant's Direction (new)

Answers only. Nothing is changed in Entra. The scan pre-fills each answer, and the person adjusts it and approves:
- **"What you use"** is pre-filled with today's state.
- **"How it should work"** is pre-filled with the baseline's recommendation, with today's state shown beside it.

| # | Step | What it asks | Folds in (today) | What the answers drive |
|---|---|---|---|---|
| D1 | **Confirm What You Use** | The services (Azure Virtual Desktop, SharePoint and OneDrive off-network, Inforcer, Intune, external authentication methods), then the old sign-in paths still in use (mail-sending devices, device code sign-in, partner or MSP technicians). | `s-confirm-workloads`, and the mail-devices, device-code and partner questions | Adds or removes the service policies. A "no" on an old path *tightens* its block (no exceptions). A "yes" adds the exception to that policy's tasks. |
| D2 | **Identify Service and Shared Accounts** | Service accounts, shared devices, script accounts. | The pickers in `s-prereq-service-accounts-group` and `s-shared-devices`, and the script-account note on MFA Readiness | Every people count (Plan, MFA Readiness, Impact). The service-accounts policy. The shared-devices policy. |
| D3 | **Decide How People and Devices Sign In** | Phones (registered, enrolled, unmanaged, blocked), app protection, computers (joined, hybrid, unmanaged), and whether any devices need a standing exception. | `s-prereq-device-plan` (always shown now, never hidden on evidence) | Applicability of the device wave. The device exceptions group (Jon's `2d25c298`), created only when the answer asks for one. |
| D4 | **Decide Where People Sign In From** | The trusted network (office addresses, or everyone remote), work countries, and whether travel is allowed (with notice, or never). | The answers in `s-prereq-trusted-location` and `s-prereq-allowed-countries`, plus the unused travel question | The countries policy. The trusted network in the service-accounts and sign-up policies. The travellers group (Jon's `cc7f9bb7`), only when travel is allowed. |

**Groups the answers create.** Each group is created only when an answer calls for it, and IAMAI then maps the policy to it:

| Group | Created when |
|---|---|
| Service accounts | D2 finds any service accounts |
| Device exceptions | D3 says some devices need a standing exception |
| Travellers | D4 allows travel |
| Azure Virtual Desktop users | D1 says the tenant uses Azure Virtual Desktop |
| External authentication method users | D1 says the tenant uses external authentication methods |

## 3. The waves (lanes, in this order)

Each policy follows the same life: create it in Report-only, watch it, then enforce it when its readiness gates are met.

| Wave | Steps (the objects each needs are folded into its tasks) |
|---|---|
| **1. Close the doors nobody should use** | Block legacy authentication (the mail-sending devices task goes here), block device code sign-in, block authentication transfer, block unsupported device platforms |
| **2. Protect admins** | Register your own passkey → require phishing-resistant MFA for admins (**creates the authentication strength**, one-time TAP only), shorten admin sessions, require MFA at every role activation (P2) |
| **3. Protect sign-up** | Protect sign-in method registration (**creates the trusted network** if it's the first to need it), require MFA to register a device |
| **4. MFA for everyone** | Prepare your team for MFA (the campaign, with MFA Readiness) → require MFA for everyone → require MFA for guests (the partner task goes here) → **Turn Off Security Defaults** (only when on, placed just before the first enforcement) → the per-user MFA move-off, as a task of MFA for everyone |
| **5. Where people sign in from** | Block countries not allowed (**creates the allowed-countries location**, the travellers group as needed), restrict service accounts to the trusted network (**creates the service accounts group**), restrict the Entra Connect sync account |
| **6. Devices** (per D3) | Require a managed device outside the office, fresh sign-in for Intune enrollment, keep company data off phones, a separate policy for shared devices |
| **7. Risk** (P2) | High- and medium-risk sign-ins, high- and medium-risk users. **Risky guests are blocked by design** (Jon, 19 Sep) |
| **8. Sessions and hardening** | Limit how long sessions last, token protection on Windows |
| **9. The services you use** (per D1) | Azure Virtual Desktop, SharePoint and OneDrive off-network, Inforcer: the baseline's policies, not "review" rows |

## 4. Ongoing and Cleanup

- **Prepare Your Lockdown Policies (new; owner, 2026-09-19: its own group, at the end, after every other policy).** Jon's three ZTCA policies:
  - the Admin Portal block;
  - block all apps except CA-Global;
  - Intune: block all apps outside the trusted network.

  They're created in Report-only and **never switched on by the plan**. The runbook for switching them on covers turning them on, revoking every session, and what "trusted source" means for this tenant.
- Disable or confirm dormant accounts. Use separate accounts for admin work.
- Alert on emergency account sign-ins, harden emergency access, align policy names, review overlapping policies.

## 5. What happens to every step that exists today

| Today | V1 | Why |
|---|---|---|
| The 4 Emergency Access steps | **Keep** (frozen) | Done |
| `s-confirm-workloads` | **Merge** → D1 | One place for "what you use" |
| `s-prereq-device-plan` | **Merge** → D3 | And it's never hidden on evidence again |
| `s-question-mail-devices`, `s-question-partner`, the device-code question | **Merge** the question → D1. **Fold** the follow-up → the policy's tasks | The question is direction; the change belongs to the policy |
| `s-question-travel` | **Retire** (never shown) → D4 | Travel is a direction answer |
| `s-prereq-service-accounts-group`, `s-shared-devices` pickers | **Split**: who → D2; the group and policy → waves 5 and 6 | Classification drives every count |
| `s-prereq-trusted-location`, `s-prereq-allowed-countries`, `s-prereq-auth-strength` | **Fold**: answers → D4; objects → the first policy that needs them | An object with no policy isn't an outcome |
| `s-prereq-security-defaults` | **Keep**, placed just before the first enforcement | Switching it off early leaves a gap |
| `s-prereq-per-user-mfa` | **Fold** → MFA for everyone | Same outcome |
| `s-ladder-operator-passkey`, `s-verify-mfa` | **Keep** (waves 2 and 4) | |
| `s-goal-*` policies | **Keep**, redesigned onto one policy anatomy | |
| `admin-portals-protected` (hidden) | **Move** → the lockdown kit | Jon: it's incident response |
| `s-review-baseline-*` (AVD, SharePoint, Inforcer, ZTCA) | **Replace**: the service policies → wave 9; ZTCA → the lockdown kit | Real steps, not "review" rows |
| `cleanup-notAssessed` | **Retire** | Nothing is left unassessed |
| `s-ladder-*` (no P1), `s-blocker-*` | **Retire** for V1. Without P1, the Plan says plainly that Conditional Access needs Entra ID P1 | The ladder is a different product |
| The baseline mappings (no screen) | **Retire** | The owner's group rule settles them in the data; Direction creates the groups the decisions need |
| Estimated dates | **Fix**: overdue work moves to today, never shows in the past | Trust |

## 6. What "every next step refreshed by Monday" means in practice

- **The policy steps share one life** (create in Report-only → watch → enforce). So one policy anatomy on the Step Kit gives all ~25 of them the Emergency Access anatomy at once:
  - About this Step
  - Tasks Remaining
  - Implementation Tasks
  - Completion Criteria
- The per-step words and edge cases then get reviewed wave by wave, starting with waves 1–4.
- Direction is built new.
- Emergency Access, MFA Readiness, Connect, Export, How and Home stay as they are, apart from the connection fixes.

## Decisions this map needs from the owner

1. Two pinned groups, with the waves as order only (not visible groups)?
2. Direction as four steps (D1–D4)? **Approved.** D2 is titled "Identify Service and Shared Accounts".
3. The lockdown kit in Report-only, as Jon's export has it, rather than Off? Report-only shows who *would* be blocked, which makes the incident switch-on safer.
4. The retirements in §5, especially the free-tier ladder?

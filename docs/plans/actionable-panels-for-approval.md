# Every control a step asks you to fill in — for approval

The owner asked, 2026-09-20: *"check every step for any actionable panels that have
not been DELIBERATELY approved by me… If I haven't historically approved the
actionable, you can assume I didn't approve them."*

This is the whole set, from `scripts/actionable-dump.mjs` plus a sweep of the rendered
step body across all eight fixtures. **28 steps take an input.** Nothing else in the
product does.

Not counted here, because they are the chrome every step carries and were approved
with the anatomy: the Implementation channel tabs, the Task and Method selectors,
Copy, *Defer this step*, *Doesn't apply here*, and *Scan to update the plan*.

---

## A. Approved historically — unchanged

| Steps | Control | Where it was approved |
|---|---|---|
| Prepare Emergency Access Accounts | account picker + Save | The frozen standard. Every other control in the product is copied from it. |
| Configure Emergency Exclusions | group picker + Save | Same. |
| Configure Passkey Authentication | *Add additional AAGUIDs*, folded in the footer | Owner-approved deviation, recorded in `policy-anatomy-deviations.md`. |
| The four *Decide Your Tenant's Direction* steps | the Questions list | The Direction spec, approved 2026-09-19. Frozen. |

**Nothing to do.** Listed so the set is complete.

---

## B. Not approved — rebuilt, and needing your yes

### B1 · The Workflow Check, on 12 steps

`s-goal-block-legacy-auth` · `s-goal-block-device-code` · `s-goal-register-info-protected` ·
`s-goal-device-registration-mfa` · `s-goal-guests-mfa` · `s-goal-intune-enrollment-reauth` ·
`s-goal-pim-activation-reauth` · `s-goal-service-accounts-trusted-network` ·
`s-goal-user-risk-medium` · `s-shared-devices` · `s-prereq-per-user-mfa` ·
`s-check-separate-admin-accounts` · the baseline-review rows

**Was:** a fifth section in the main column, *below Completion Criteria* — outside the
four sections the anatomy has — asking for up to eight fields: an account picker, free
text for the workflow, the roles, an authentication context, a named network, a partner
access path, a change record, the outcome and the date.

**Now:** in the action column beside the milestone, where Emergency Access puts its one
control. A policy step asks **two** questions — the outcome, and the day it was tested.

**What was cut, and why:** `workflow`, `reference` and `providerAccessPath` were free
text nothing read — the product printed them back on the step and in the export and
used them for nothing. The account picker did nothing at all on the steps whose
completion is counted per workflow rather than per person.

**What was kept, by one rule — it decides completion, or IAMAI checks it against the
tenant:** the outcome and the date everywhere; the account list and the replacement
account where the step is not complete until every scoped person has a record; the
authentication context on PIM and the named network on the service-accounts step,
because IAMAI reads both back and raises a defect if the tenant does not match; the two
safety checkboxes (*Temporary Exception Removed*, *Recovery Prerequisites Verified*).

**The judgement that needs you:** the V1 standard permits exactly one kind of tick —
*"manual evidence such as a tested handover"*. Two fields is my reading of that. If you
want it to be **one** (the outcome alone, with the date taken from when it was saved),
say so and it goes to one.

### B2 · Disable or Confirm Dormant Accounts

**Was:** a dropdown and a text box **per account** — two controls on the demo, and
**1,462 on a directory with 731 dormant accounts**, in the action column of one step.

**Now:** one picker — *Accounts you are keeping* — one reason, and Save. Three controls
at any size.

**Why that is safe:** the step already completes when every listed account is disabled,
active again, or kept with a recorded reason. The scan sees the first two for itself —
an account disabled in Entra reads back disabled — and *Investigate* cleared nothing. So
the only answer a person actually owes is which accounts they are keeping. The step now
says plainly: *"Disable the rest in Entra, then scan again."*

**The judgement that needs you:** one reason covers the whole kept set, rather than a
reason per account. An admin keeping nine service mailboxes writes one sentence, not
nine. If you want per-account reasons back for small sets, that is a cheap change.

---

## C. Not approved, but already built the approved way — needs only your yes

| Step | Control | Why it is left alone |
|---|---|---|
| `s-verify-mfa` — *People Needing Help* | picker + *Save Support List*, in the action column | This is the Emergency Access pattern exactly: a picker, a lead sentence, one Save, beside the milestone. Nothing to simplify. |
| `s-goal-sign-in-risk` | the shared decision control | Same shape. Reaches no fixture's demo screen; it is listed so the set is complete. |

---

## D. Read-only panels that sit where a control would

Seven steps draw *"Answered in Decide Your Tenant's Direction"* in the action column:
`s-prereq-trusted-location`, `s-prereq-allowed-countries`,
`s-prereq-service-accounts-group`, `s-shared-devices`, `s-goal-block-legacy-auth`,
`s-goal-block-device-code`, `s-goal-guests-mfa`.

They take no input — they name the question, show the saved answer, and link to the step
that asks it. They are the fix for a question being asked twice, and the audit's journey
pass flagged a separate fault with them: three of those steps still read **"Needs a
decision"** in their own bar while drawing this panel, so the *Needs your input* count on
the Plan counts the same Direction answers twice. **That is a bug, in the merged findings
list, not a panel to approve.**

---

## What I would still cut, if you agree

The audit's own view is that deletion is the cheapest fix. Two candidates I did **not**
act on, because removing a step's only completion path is yours to decide:

1. **`s-prereq-per-user-mfa`'s Workflow Check** now asks for the outcome and a date on a
   step whose whole content says *"disable the per-user MFA state on each account listed
   here"* — and IAMAI reads per-user MFA state only in preview, so it cannot confirm the
   result either way. The honest options are to keep the attestation or to drop the step's
   manual check entirely and let it complete on the next scan that can read the states.
2. **The baseline-review rows' Workflow Check** is now a single outcome field on a step
   whose entire job is an attestation. That is arguably right, and arguably it should be
   one button — *Reviewed* — rather than a dropdown and a date.

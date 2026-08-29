# Audit sheet — MFA for every user

**Goal:** `mfa-all-users`. **Family:** mfa. **Can deny access:** yes. The
highest-value policy the tool produces, and the one whose readiness story matters
most.

## What it changes

A Conditional Access policy requiring MFA for all users on all resources.

## Every population that could be caught

| Population | What happens | Source |
|---|---|---|
| Anyone with **no registered method** | Prompted, cannot answer, locked out. The tool counts these. | Verified in `verification-campaign.md`: the campaign never reaches them |
| **Dormant accounts** returning after the change | Meet the prompt with nothing registered | — |
| **Shared / kiosk accounts** whose method sits on one person's phone | Break when that person is away or leaves | Field practice; no Learn source found |
| **Guests** | See `guests-and-external.md` — they register in their home tenant | S2 |
| **Service principals** | Not covered at all: "Calls made by service principals aren't blocked by Conditional Access policies scoped to users" | S1, S39 |
| Users whose only method is **SMS or voice** | Covered, but weakly; a SIM swap defeats it | — |
| **Break-glass accounts** | Must be excluded — but see the mandatory-MFA ceiling in `emergency-access.md` | S5, S9 |

## Dependencies it assumes exist

1. Registration coverage — which is the whole point of the verification campaign,
   and which the campaign does not fully deliver.
2. A method that works for each person: a phone-less or smartphone-less worker
   needs a hardware key or a different path.
3. Break-glass exclusion in place before enforcement.

## What Microsoft says to do first

- Exclude break-glass accounts and service accounts; use workload-identity
  Conditional Access for service principals [S39].
- Create in **report-only**, review, then enable [S39].
- Note that **Windows Hello for Business satisfies the MFA requirement** in
  Conditional Access [S12] — relevant when readiness looks low but WHfB is
  deployed.

## The reporting caveat that undercuts the product promise

"Report-only mode evaluates policies but doesn't enforce grant controls or
session controls. **Users aren't prompted for multifactor authentication or
blocked by report-only policies**" [S8]. Report-only therefore proves *whether
the policy applies to a sign-in*, not *whether the person could have satisfied
it*. A user with no method shows as "Report-only: Failure" — correctly — but a
user who would have been prompted and failed the prompt is indistinguishable from
one who would have sailed through.

The product line "predicted impact, confirmed in report-only" is defensible for
scope. It is not a proof of survivability. The audit's recommendation is to keep
the line and add the limit, not to drop the line.

## Comparison with what the step says today

| Claim | Status | Fix |
|---|---|---|
| Names no-method, SMS-only, dormant, shared accounts | **present** | — |
| Counts who has no method | **present** | — |
| Break-glass excluded | **present** | — |
| Report-only proves scope, not survivability | **missing** | Caveat text |
| Windows Hello for Business satisfies MFA | **missing** | Readiness note |
| Service principals are not covered | **missing** | Step content |
| The zero-method population needs TAP, not the campaign | **missing** | Prerequisite + step content |
| Mandatory MFA applies regardless of exclusions | **missing** | Step content |

Eight claims: 5 missing, 0 wrong, 3 present.

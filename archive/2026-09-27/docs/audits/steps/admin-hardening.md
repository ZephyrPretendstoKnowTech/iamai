# Audit sheet — admin hardening

**Goals:** `admins-phishing-resistant`, `admin-portals-protected`,
`azure-management-mfa`, `pim-activation-reauth`, `admin-session`.
**Family:** admin. **Can deny access:** yes.

## What it changes

Phishing-resistant authentication strength for directory-role holders, MFA on the
admin portals and Azure management, MFA on PIM activation, and shorter admin
sessions.

## The ceiling that changes the argument

Microsoft now enforces MFA on the admin portals at the platform level, and it
cannot be excluded: "**The system enforcement applies to all user accounts,
regardless if they are a student account, break-glass account, an administrator
account with activated or eligible roles, or any user exclusions that are enabled
for them.** … If you configured exceptions or exclusions in the policy, they no
longer apply" [S9].

This means `admin-portals-protected` is, for the MFA floor, partly already true
in every tenant. The step's value is the *strength* requirement above the floor,
not the floor itself. The tool presents it as if the tenant were unprotected.

## Every population that could be caught

| Population | What happens | Source |
|---|---|---|
| Admins with **no phishing-resistant method** | Blocked by the strength requirement | — |
| **PIM-eligible** admins | Meet the requirement mid-task, on activation | — |
| **Break-glass accounts** | Must be excluded from the tenant's policies — and must still hold a real method because of the platform floor | S5, S9 |
| Admins on **Azure Virtual Desktop / Windows 365** | "a Conditional Access policy that targets Windows 365 can also affect those admin portal sign-ins" | S31 |
| The admin **applying** an all-resources sign-in-frequency policy | In scope of it, including the Entra admin center, because sign-in frequency now applies to MFA | S26 |

## Multiple grant controls have a validation order

"if a user has two policies requiring multifactor authentication (MFA) and Terms
of Use (ToU), Conditional Access validates the user's MFA claim first, then the
ToU… The validation order is MFA, Device State, and then ToU" [S12]. This is why
a log shows a ToU failure that resolves itself on the second entry — a help-desk
question the tool does not answer.

## What Microsoft says to do first

- For the Azure portal and the Entra admin center, "use either time-based user
  sign-in frequency or require reauthentication on PIM activation … for a better
  user experience" rather than "Every time" [S26].
- Break-glass accounts: phishing-resistant methods "**that are different from
  your normal admin accounts**" [S5].

## Comparison with what the steps say today

| Claim | Status | Fix |
|---|---|---|
| Names admins without a key, PIM-eligible admins, break-glass in scope | **present** | — |
| Counts admins without a phishing-resistant method | **present** | — |
| Mandatory MFA already covers the admin portals; the step adds strength | **missing** — the step overstates its own value | Step content |
| "Every time" is discouraged for the admin portals | **missing** | Step content |
| Grant-control validation order (MFA → device → ToU) | **missing** | Help-desk content |
| Break-glass methods should differ from normal admin methods | **missing** | Rule copy |
| Windows 365 / AVD policies can affect admin portal sign-ins | **missing** | Failure mode |

Seven claims: 5 missing, 0 wrong, 2 present.

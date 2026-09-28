# Audit sheet — emergency access (break-glass)

**Steps:** `s-blocker-break-glass` (validation blocker),
`s-recurring-break-glass-drill`, `s-prereq-break-glass`. **Gates:** every
deny-capable step.

Prompt 32 built the rule set from the design document. This sheet checks that
rule set against Microsoft's own page, which was **substantially rewritten in
June 2026**. Three of the tool's claims are now wrong.

## What Microsoft's current guidance actually says

From `security-emergency-access` [S5], verbatim checklist items:

- "at least two" accounts.
- "cloud-only accounts (`.onmicrosoft.com` domain) with no dependency on
  federated identity providers".
- **"Use phishing-resistant authentication methods (FIDO2 security keys or
  certificate-based authentication) that are different from your normal admin
  accounts"** — the guidance is now passwordless-first, not "a long password in
  a safe".
- "credentials and devices don't expire and aren't subject to automated cleanup".
- "In PIM, assign the Global Administrator role as **permanent active (not
  eligible)**".
- "Store credentials in separate, secure, fireproof locations".
- **"Exclude emergency access accounts from Conditional Access policies that
  block or restrict sign-in. Report-only policies don't require an exclusion."**
- "Monitor all sign-in and audit log activity … with alerts".
- **"Validate account functionality at least every 90 days"**.
- "Don't associate emergency access accounts with any individual user"; "Don't
  connect these accounts with any employee-supplied devices, such as phones."

## The hard ceiling nobody can exclude

`concept-mandatory-multifactor-authentication` [S9]: **"The system enforcement
applies to all user accounts, regardless if they are a student account,
break-glass account, an administrator account with activated or eligible roles,
or any user exclusions that are enabled for them."** And: "If you configured
exceptions or exclusions in the policy, they no longer apply."

A Conditional Access exclusion protects a break-glass account from **the
tenant's own policies**. It does not protect it from Microsoft's platform-level
mandatory MFA on the admin portals. Any copy that says the account is "excluded
from everything" is wrong, and unsafe, because it tells an operator the account
will work without a registered method. It will not.

## Security defaults has no exclusions at all

`security-defaults` [S6]: customization is **"No customization (on or off)"**.
The only carve-out is Microsoft-defined (Directory Synchronization Accounts) and
not admin-configurable. Under security defaults a break-glass account must
register and satisfy MFA like anyone else — there is no reserve.

## Microsoft-managed policies move under the tenant

`managed-policies` [S7]: they arrive in **Report-only**, and **"Microsoft enables
these policies no less than 30 days after they're introduced in your tenant if
they're left in the Report-only state"**, with notice "2 weeks before", and "in
some cases, policies might be enabled faster than 30 days". They cannot be
renamed or deleted, only excluded or toggled. Microsoft says: **"Exclude your
break-glass or emergency access accounts from managed policies just like other
Conditional Access policies."**

Scope auto-expands to newly eligible users, though "any admin-configured
exclusions are always preserved".

## Every way a person can be stranded

| # | Stranding | Source |
|---|---|---|
| 1 | Break-glass account holds only a password; mandatory MFA blocks the admin portal | S9 |
| 2 | A Microsoft-managed policy the admin never created turns itself on and catches the account | S7 |
| 3 | Security defaults on: no exclusion possible for the account | S6 |
| 4 | The account is eligible-only in PIM and activation is what is broken | S5 |
| 5 | Credential in one head or one laptop | S5 |
| 6 | Both accounts share a device or a method type | S5 |

## Comparison with the tool's rule set (prompt 32)

| Claim the tool makes | Status | Fix |
|---|---|---|
| "Microsoft recommends two to four" Global Administrators | **wrong** — no such figure exists. Microsoft says "**Limit the number of Global Administrators to less than 5**" and separately "at least two" emergency access accounts | Restate as "at least two emergency accounts, fewer than five Global Administrators in total" |
| Excluded from every enabled **and report-only** policy, blocking | **wrong** (over-strict) — "Report-only policies don't require an exclusion" | Blocker for enforced policies; warning for report-only, citing both pages |
| Per-user MFA state "is not exposed by Microsoft Graph at all" | **wrong** — readable at `GET /beta/users/{id}/authentication/requirements` (`perUserMfaState`), beta only | Correct the claim; the tool does not call it, so say "not read by IAMAI" not "not exposed" |
| Break-glass excluded from Microsoft-managed policies | **missing** | New rule (warning) + step content |
| Mandatory MFA cannot be excluded; the account needs a real method | **missing** | Step content + strengthen `bg.hasMfaMethod` rationale |
| Phishing-resistant method (FIDO2/CBA), different from normal admin accounts | **partial** — the tool warns if no phishing-resistant method, but does not say "different from your normal admin accounts" | Extend `bg.phishingResistant` copy |
| Permanent active GA, not eligible | **present** (`bg.role.permanentGa`) | — |
| Cloud-only, initial domain, enabled, not personal, not dynamic, two accounts | **present** | — |
| Validate every 90 days | **present** (`bg.drilled`) | — |
| Credentials in separate, secure, fireproof locations | **partial** — asked as one yes/no, not "separate locations" | Extend the Setup question wording |
| Not connected to employee-supplied devices | **missing** | Extend `bg.separateDevices` copy |
| No licence / no mailbox | **present** | — |

Twelve claims: 3 missing, 3 wrong, 2 partial, 4 present.

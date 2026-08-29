# Audit sheet — security-info registration

**Goal:** `register-info-protected` — "Security-info registration requires a trusted context".
**Family:** mfa. **Phase:** 0. **Can deny access:** yes.

This is the highest-risk step the tool produces. Applied in the documented shape
before people have registered, it permanently strands anyone who cannot reach a
trusted location, because the thing they need in order to register is the thing
the policy requires them to already have.

## What it changes

A Conditional Access policy on the **user action** "Register security
information" (`urn:user:registersecurityinfo`), requiring MFA (or an
authentication strength) when the user is not on a trusted network. Microsoft's
documented shape is: include **Any location**, exclude **All trusted
locations**, grant **Require authentication strength** [S1].

The intent is real and worth doing: it stops an attacker who has a password from
registering their own MFA method on the account.

## Every population that could be caught

| Population | What happens | Source |
|---|---|---|
| A member with **no registered method**, off a trusted network | Cannot register. Registration requires MFA; they have no method to do MFA with. Permanently stranded without an administrator issuing a Temporary Access Pass. | S1 |
| A **remote-only** member (no office, no trusted IP) | Same, permanently, not just once. This is the whole workforce in a business with no office. | S1 |
| **Guests and external users** | Microsoft says exclude them: "Temporary Access Pass does not work for guest users." A TAP cannot be issued to an external guest at all. | S1, S2 |
| **Internal guests** (`userType = Guest`, methods in this tenant) | A TAP *can* be issued to these. External guests cannot. | S2 |
| **Break-glass accounts** | Must be excluded, or a registration policy can contribute to a full lockout. | S1 |
| **Service accounts / service principals** | "Calls made by service principals aren't blocked by Conditional Access policies scoped to users." A user-scoped policy does not cover them; workload-identity CA does. | S1 |
| Users **not enabled for combined registration** | Microsoft warns the policy assumes combined registration is on. | S1 |
| Anyone registering **Windows Hello for Business** or **macOS Platform SSO** | **Since 6 July 2026** these flows evaluate registration-targeting CA policies; before that date they did not. Today (August 2026) this is live. | S1 |
| Users of **external authentication methods** | Incompatible with authentication strength; use "Require multifactor authentication" as the grant instead. | S1 |

## Dependencies it assumes exist

1. **Combined registration is enabled** for the tenant [S1].
2. **A trusted named location exists** and actually covers where people work.
   With no trusted location, "exclude all trusted locations" excludes nothing and
   the policy applies everywhere.
3. **Temporary Access Pass is enabled in the authentication methods policy**,
   and the users who need it are in scope of that policy. "Before users can sign
   in with a TAP, you need to enable this method in the Authentication methods
   policy and choose which users and groups can sign in by using a TAP" [S2].
4. **Somebody holds a role that can issue a TAP**: Privileged Authentication
   Administrator (admins and members, not themselves) or Authentication
   Administrator (members, not themselves). Global Reader can see that a TAP
   exists but not read its value [S2].
5. **Break-glass accounts are identified** so they can be excluded.

## Every way a person can be stranded

| # | Stranding | Why | Source |
|---|---|---|---|
| 1 | Remote user with no method, no trusted location, no TAP | Needs MFA to register; needs registration to have MFA | S1 |
| 2 | TAP not enabled in the authentication methods policy when the strand happens | The recovery path does not exist yet | S2 |
| 3 | TAP enabled but the user is not in the TAP policy's scope | "only users included in the policy can sign in with it" | S2 |
| 4 | External guest stranded | A TAP cannot be issued to them at all | S2 |
| 5 | One-time TAP, passwordless registration not finished in 10 minutes | "the user must complete the registration within 10 minutes of sign-in" | S2 |
| 6 | User in scope for the SSPR registration policy or ID Protection MFA registration policy | Redirected to interrupt-mode combined registration, which "doesn't currently support FIDO2 and phone sign-in registration" | S2 |
| 7 | Only the stranded person can issue their own TAP | Authentication Administrators cannot create a TAP for themselves | S2 |
| 8 | Windows Hello for Business / macOS Platform SSO enrolment now blocked | Live since 6 July 2026; a policy written before then behaves differently now | S1 |
| 9 | Risky sign-in blocks registration | "The sign-in risk-based policy prevents users from registering MFA during risky sessions. If users aren't registered for MFA, their risky sign-ins are blocked, and they receive an AADSTS53004 error." | S4 |

## What Microsoft says to do first

- Exclude break-glass accounts, and exclude **All guest and external users** [S1].
- Exclude service accounts and service principals; use workload-identity CA for
  those [S1].
- **Create the policy in report-only**, confirm with policy impact / report-only
  results, and only then move the toggle to On [S1].
- **Issue TAPs**: "Administrators have to issue Temporary Access Pass credentials
  to new users so they can satisfy the requirements for multifactor
  authentication to register" [S1].
- Microsoft explicitly frames TAP as the modern replacement for the older
  trusted-network approach: "Some organizations in the past might have used
  trusted network location or device compliance as a means to secure the
  registration experience. With the addition of Temporary Access Pass… TAP
  credentials satisfy Conditional Access requirements for multifactor
  authentication" [S1].
- Review policies scoped to Register security information and test in report-only
  because of the WHfB / Platform SSO change [S1].

## Ordering rule this implies

**This step must not be enforced before registration coverage is proven**, and
where it is enforced, a TAP path must already exist. The safe order is:

1. Enable TAP in the authentication methods policy, scoped to at least the people
   who might be stranded.
2. Get people registered (campaign, with the caveats in
   `verification-campaign.md`).
3. Only then enforce the registration policy.

Enforcing (3) before (2) is the stranding. The tool currently orders this step in
phase 0 with no such dependency.

## Comparison with what the step says today

| Claim on this sheet | Status | Fix |
|---|---|---|
| Names the trusted-location dependency and what happens with no trusted location | **missing** | Add a failure mode and a blocker |
| Names TAP as the recovery path | **missing** | Add to step content, and make it a prerequisite |
| States TAP must be enabled in the authentication methods policy first | **missing** | New rule, blocking for this step |
| States TAP cannot be issued to external guests | **missing** | Add to the guest failure mode |
| Excludes guests, as Microsoft instructs | **missing** | Baseline/adjust guidance and a warning |
| Names the remote-only workforce as the stranding population | **missing** | Failure mode + scenario fixture |
| Says the step must follow registration, not precede it | **missing** (it is phase 0, ahead of the campaign) | Sequence rule + ordering change |
| The 10-minute one-time-TAP window | **missing** | Help-desk content |
| SSPR / ID Protection registration-policy interaction | **missing** | Failure mode |
| WHfB / macOS Platform SSO now in scope (since 6 Jul 2026) | **missing** | Step content, dated |
| Service principals are not covered by user-scoped CA | **missing** | Step content |
| Combined registration prerequisite | **missing** | Prerequisite line |
| Report-only before enforcement | **present** | — |
| Break-glass excluded | **present** | — |
| Learn URL | **wrong** (non-canonical redirect) | Point at S1 |

Fifteen claims: 12 missing, 1 wrong, 2 present.

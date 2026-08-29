# Audit sheet — verification campaign

**Step:** `s-verify-mfa` — "Run the MFA verification campaign". **Kind:** verify.
**Can deny access:** no (it changes no policy), but every MFA step depends on it.

The plan's premise is that this step gets everyone registered before enforcement.
Microsoft's documented behaviour says it does not reach the people who most need
it.

## What it changes

Nothing in Conditional Access. It represents the period in which people register
a method, measured by the tool as registration coverage. In the tenant, the
mechanism is the **registration campaign** in the authentication methods policy,
which nudges users to set up Authenticator or a passkey after they sign in [S3].

## Every population that could be caught

| Population | What happens | Source |
|---|---|---|
| A user **with no method at all** | **Never nudged.** "The nudge works only for users who are doing MFA by using Microsoft Entra MFA." The campaign fires *after* MFA succeeds, so a user who cannot do MFA never sees it. | S3 |
| A user **in scope of a security-info registration CA policy** restricted by location | Not nudged off-network: "Users aren't prompted unless they're on the internal network." | S3 |
| A user in scope of a CA policy that **blocks** the registration page | "A nudge doesn't appear if a user is in scope for a Conditional Access policy that blocks access to the Register security information page." | S3 |
| A user in an **SSO session** | "The nudge doesn't trigger if the user is already signed in with SSO." | S3 |
| A user who sees a **terms-of-use** screen, or is redirected by **custom controls** | Not nudged. | S3 |
| **Guests / B2B** | Nudged for an Authenticator campaign; **not** nudged for a passkey campaign ("passkey support for guest users isn't currently available"). | S3 |
| **Linux users** | "Linux users aren't nudged. FIDO2 passkeys aren't available on Linux." | S3 |
| **Mobile-only users** | "Microsoft Authenticator registration campaigns aren't supported on mobile devices." Passkey campaigns are, in browsers and native iOS (not native Android). | S3 |
| Users who already have Authenticator push set up | Not eligible for an Authenticator campaign. | S3 |

## Dependencies it assumes exist

1. The target method is **enabled in the authentication methods policy**:
   Authenticator with mode **Any** or **Push** (not Passwordless), or passkey
   (FIDO2) with **Allow self-service setup** on [S3].
2. Microsoft Entra MFA is in use — the nudge does not work otherwise [S3].
3. Only one method can be targeted at a time: "A registration campaign can target
   only one authentication method at a time" [S3].

## Every way a person can be stranded

| # | Stranding | Source |
|---|---|---|
| 1 | No method → never nudged → never registers → locked out when MFA is enforced | S3 |
| 2 | Snoozing indefinitely when **Limited number of snoozes** is Disabled: "users can snooze an unlimited number of times and avoid registration" | S3 |
| 3 | Registration policy applied first, so the nudge never fires (see `security-info-registration.md`) | S1, S3 |
| 4 | A tenant on **Microsoft managed** mode has the campaign silently changed under it: target method moves to passkeys, snooze to one day, snoozes unlimited | S3 |

## What Microsoft says to do first

- Enable the target method in the authentication methods policy before running
  the campaign [S3].
- Set **Limited number of snoozes** to Enabled if registration must actually
  complete: "users can postpone the app setup for up to three times, after which
  setup is required" [S3].
- Read the registration coverage first: the authentication methods activity
  report gives the before number [S3].

## The rule this implies

The campaign is **not** a mechanism that reaches everyone. A person with no
method has to be onboarded by an administrator, with a **Temporary Access Pass**
— which is Microsoft's documented answer for exactly this case [S1, S2]. The plan
must say so, and must not let "run the campaign" stand as the whole answer to
"how do the last N people get set up".

## Comparison with what the step says today

| Claim on this sheet | Status | Fix |
|---|---|---|
| The nudge only reaches users who can already do MFA | **missing** — the step implies the campaign covers everyone | Step content + a named path for the zero-method population |
| TAP is the onboarding path for users with no method | **missing** | New step content, and a prerequisite when anyone has no method |
| Names the method the campaign targets, and that it must be enabled first | **missing** | Prerequisite line |
| Unlimited snooze means the campaign never completes | **missing** | Step content |
| Guests are not nudged for passkeys | **missing** | Guest failure mode |
| Linux and mobile limits | **missing** | Step content |
| SSO sessions are not nudged | **missing** | Step content (explains a stalled campaign) |
| Registration CA policy suppresses the nudge | **missing** | Sequence rule |
| Counts who still needs setting up | **present** | — |

Nine claims: 8 missing, 0 wrong, 1 present.

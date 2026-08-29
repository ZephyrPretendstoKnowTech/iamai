# Audit sheet — session controls

**Goals:** `admin-session`, `all-users-no-persistence`, `byod-session-controls`,
`block-downloads-unmanaged`. **Family:** other/session. **Can deny access:**
interrupts rather than denies, but `block-downloads-unmanaged` blocks.

## Verified behaviour

- **Sign-in frequency** "specifies how long a user can access a resource before
  being asked to sign in again"; default is "a rolling window of 90 days", and it
  "now applies to multifactor authentication (MFA) as well" [S26].
- **There is no documented minimum value.** Graph documents only `type` (days |
  hours) and an Int32 `value`; no Learn page states a bound. The "1 hour minimum"
  in circulation traces to community answers, not documentation. 1 hour is simply
  the value Microsoft's own template uses. **Unverified — do not print as fact.**
- **"Every time" is not every action:** it "requires full reauthentication **when
  the session is evaluated** … if the user closes and opens their browser during
  the session lifetime, they might not be prompted", with a five-minute clock
  skew [S26].
- **"Every time" without MFA is a documented hazard:** "Using sign-in frequency
  to require reauthentication every time, without multifactor authentication
  might result in **sign-in looping**" [S26].
- **Persistent browser session has a hard scoping requirement:** "**This control
  requires selecting 'All Cloud Apps' as a condition.** … All tabs in a browser
  session share a single session token and therefore they all must share
  persistence state" [S27]. A "Never persistent" policy scoped to one app is a
  policy Microsoft says will not work as configured.
- **CAE and sign-in frequency do not interact:** "**Sign-in Frequency is honored
  with or without CAE**" [S24]. Strict *location* enforcement is a separate,
  Public Preview mode.
- **Propagation:** "Changes made to Conditional Access policies and group
  membership made by administrators **could take up to one day to be effective**
  … Some optimization … reduce the delay to **two hours**." Immediate revocation
  needs `Revoke-MgUserSignInSession` or "Revoke Session" [S24].
- **Teams Rooms, panels and phones:** sign-in frequency and persistent browser
  session are both **Not supported**, and "using the sign-in frequency policy
  causes devices to periodically sign out" [S28].
- **Turn off "Remember MFA on trusted devices" first**: "using these two settings
  together might prompt users unexpectedly" [S26].
- **Block downloads is two different products.** *App-enforced restrictions*
  (SharePoint/OneDrive/Outlook on the web) need only Entra ID P1 plus a
  workload-side setting [S29]. *Conditional Access App Control* needs a **Defender
  for Cloud Apps licence in addition to Entra ID P1** and inserts a reverse proxy
  [S30]. Conflating them mis-advises on cost.
- **App-enforced restrictions leak, by documentation:** "Anyone" links "aren't
  affected by these policies"; pre-modern-auth clients "allow users to bypass
  conditional access policies"; previews still render; it takes **up to 24 hours**
  and "won't affect already-signed-in sessions" [S29].

## The correction that matters most across the whole product

The tool's rollback copy says Conditional Access changes "generally apply within
a few minutes". Microsoft says **up to one day**, optimised to two hours in some
cases [S24]. An operator who reverts a policy and watches for a few minutes will
conclude the rollback failed, or worse, that the policy was never the cause.

## Every way a person can be stranded or disrupted

| # | Effect | Source |
|---|---|---|
| 1 | Sign-in looping from "every time" without MFA | S26 |
| 2 | Teams Rooms / panels periodically signed out | S28 |
| 3 | Unexpected prompts from "Remember MFA on trusted devices" left on | S26 |
| 4 | Persistent-browser policy scoped narrowly and silently ineffective | S27 |
| 5 | The admin applying an all-resources sign-in-frequency policy is in scope of it, including the Entra admin center | S26, S31 |
| 6 | iOS certificate-first-factor + Intune MAM: "users are blocked from signing in to the app" | S26 |

## Comparison with what the steps say today

| Claim | Status | Fix |
|---|---|---|
| "Changes generally apply within a few minutes" | **wrong** — up to one day | Correct across the product |
| Persistent browser session must target all resources | **missing** | Blocking rule |
| "Every time" without MFA loops | **missing** | Rule/step content |
| No documented minimum sign-in frequency | **missing** | Avoid asserting one |
| Turn off Remember MFA on trusted devices first | **missing** | Prerequisite |
| Teams Rooms / shared devices unsupported | **missing** | Failure mode |
| Block downloads: which product, which licence | **missing** — the tool does not distinguish | Step content + licence gate |
| App-enforced restrictions leak paths and the 24-hour delay | **missing** | Step content |
| Report-only does not enforce session controls, so it does not prove the experience | **missing** | Caveat on the report-only promise |
| Names unsaved work and kiosk timeouts | **present** | — |
| Says nobody is blocked by a session control | **partial** — true for frequency/persistence, false for block-downloads | Split the two |

Eleven claims: 8 missing, 1 wrong, 1 partial, 1 present.

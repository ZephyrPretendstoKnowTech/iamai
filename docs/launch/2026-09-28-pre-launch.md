# Pre-launch list, morning of 2026-09-28

Everything worth deciding before the post, from the night of 2026-09-27: a walk of
sections 5–8 on the owner's tenant (fresh live scan, 9:04 PM) and the sample, a sweep of
every step and page on both, a security audit (report only), and a repository clean-up.
Nothing here is live until the owner approves it. Where things stand overall:
[docs/STATUS.md](../STATUS.md).

## What the night confirmed

- **Every approved change holds.** Rounds 1–4 were walked in Chrome on the sample and on
  the owner's tenant; the live audit of Round 4 passed.
- **Every step and page is clean** of the patterns earlier approvals banned: "couldn't
  read" and "not established", "Est.", unfilled `{placeholders}`, `undefined`, `NaN`,
  doubled words, invalid dates. That covers 36 steps on the owner's tenant, 38 and 31 on
  the sample's two scans, and Connect, MFA Readiness, Inventory, Export and How on both.
- **Sections 5–8 read well** on the owner's tenant, with the exceptions in "Your yes"
  below.
- **The header works during a rescan (F-168), seen live for the first time.** Leaving for
  MFA Readiness mid-scan keeps you there.
- **Read-only holds:** every Graph scope is a read; every POST is a `$batch` of GETs or
  `directoryObjects/getByIds`.

## Your yes, before you post

### 1. Merge the night branch

`night/2026-09-27` holds, one commit each:
- the Round 4 write-up in the rounds document (scores, Round 5 candidates, prompt);
- **the Plan without Show completed and Show deferred.** All work draws finished and
  deferred steps in their sections; a lane tab draws only its own lane; a step finished
  on a lane tab takes you to All work, where it now sits;
- the test tenant's `onmicrosoft` domain removed from a committed doc;
- README and SECURITY.md: all seven Graph scopes (`Policy.Read.AuthenticationMethod` was
  missing), and how CI really runs (the README said every push runs CI and walks the
  sample; neither is true);
- 139 superseded docs and prototypes moved to `archive/2026-09-27/`, and `docs/STATUS.md`
  as the one source of truth;
- the Home pictures retaken (the old ones showed the two toggles).

Recommended: **merge.** I push, wait for deploy, and audit it live.

### 2. Three product questions (each a short build)

**a. 7.5 Require Token Protection on Windows (safety floor).** On your tenant it is
"Ready · Correct" on a policy that is already **On**. The correction adds Exchange,
SharePoint, Windows 365, Azure Virtual Desktop and Teams to it. Saving applies at the
next sign-in, with no report-only week, and nothing on the screen says so. The same
applies to any correction of an enforced policy (5.6 Remediate High-Risk Users corrects
your own user-risk policy in place too). Round 5's build-new, retire-old pilot is the
real fix.
- (a) Launch as is; Round 5 fixes it.
- (b) **Recommended.** Before posting, add one line to every correction of a policy
  that is On: "This policy is On: a saved change applies at the next sign-in." New
  words, so they need your yes.

**b. The sample's "Require MFA for Inforcer Access" (every evaluator sees it).** It is
the one policy step that never got the step template:
- its path starts "Open Entra ID →";
- it says "exclude the exclusions group you confirmed" instead of naming the group;
- it has a long "Do not choose On here … The script for this step can only create in
  Report-only" paragraph, but no PowerShell tab;
- its milestone and completion use the step title, not the policy name;
- it waits on "Create or Correct Service Accounts Group", which it doesn't use;
- the app is labelled "“Inforcer (baseline name)”".

Your tenant doesn't show it: your 2.1 answers take it off.
- (a) **Recommended.** Put it on the template like every other policy step (about two
  hours).
- (b) Launch as is.

**c. 5.9 Reset Passwords for Medium-Risk Users (on your tenant).** It reads "After
report-only blocks no one (it would have blocked Admin)" and nothing says how to clear
Admin's risk, so the step can never finish (OWN-W5).
- (a) **Recommended.** One line naming the way out: confirm the sign-in was theirs and
  dismiss the user risk in Identity Protection, or have them change their password, then
  scan.
- (b) Round 5.

### 3. Security settings (yours to change, in Cloudflare; no code)

- **S1 Clickjacking (medium). Recommended.** No page sets `X-Frame-Options` or
  `frame-ancestors`, and a `<meta>` CSP cannot set `frame-ancestors`, so any site can
  frame IAMAI and trick a click on Forget. Add a Cloudflare response-header rule for
  getiamai.com:
  `Content-Security-Policy: frame-ancestors 'none'` and `X-Frame-Options: DENY`.
- **S4 (low, optional).** HSTS is 180 days without `includeSubDomains`. Add
  `Referrer-Policy: strict-origin-when-cross-origin` and a `Permissions-Policy` that turns
  off camera, microphone and geolocation.
- **S7 (your call).** Cloudflare's Web Analytics beacon loads on both pages. It is
  disclosed on How and in the README, and it carries no tenant data. Turn it off in
  Cloudflare if you want a flat "no analytics" claim.

### 4. Two repository questions

- **S3 History (low).** Git history still holds two of your addresses and the test
  tenant's `onmicrosoft` domain, from before they were scrubbed. The current tree is
  clean. Only a history rewrite and a force push remove them; the repo is public, so
  clones may already hold them. Recommended: **leave history alone.**
- **S8 The tenant guard (medium). Recommended: fix.** `scripts/tenant-guard.mjs` blocks
  addresses at `getiamai.onmicrosoft.com`. Your tenant's accounts live at another
  `onmicrosoft` domain (seen in 8.1's alert query tonight), so an address there passes
  unless its exact UPN is fingerprinted. Fix: fingerprint each address's domain too, and
  add that domain's hash (guard code only, not the product).

### 5. The three Phase 4 suggestions (still waiting since 2026-09-26)

- The lapsing person's reason line under their next step still describes today's state.
- 4.3's printed page lost its Who section.
- The printed timeline's phases overlap (Phase 2 inside Phase 1).

Each is small. Recommended: yes to all three, after launch.

## You do, before you post

- The Cloudflare headers (S1), if approved.
- After the deploy: open getiamai.com in both themes and check the Plan picture.
- The post links to https://getiamai.com and https://getiamai.com/planner/?demo=1#/plan.

## Waits until after launch

- **Round 5** (rounds document): the policy-matching pilot on 4.3, then Export's file
  names and CSVs (F-047, F-127), keyboard focus on filled buttons in light theme (F-079),
  F-075, F-036, F-062, F-035, OWN-W7, F-092, F-180, Inventory search.
- **Seen tonight, on the list:**
  - Ready steps dated weeks out on your tenant: 5.1 Oct 1, 5.6 Oct 13, 7.5 Oct 20
    (F-092).
  - Completed steps say "After making changes, select Scan" (OWN-W7).
  - Prerequisite lists are not in plan order (the sample's trusted-network steps list
    1.2, 2.3, 1.1, 2.1, then 3.x).
  - "Prerequisite · Waiting" and "Waiting on your answers" are said twice on Define the
    Trusted Network.
  - Review Overlapping Policies names its two policies twice in one sentence, and its
    Retained Policy picker offers unrelated block policies. This gets reworked with the
    Round 5 retire-old work.
  - A returning visitor's stored sample can read 7 weeks while Connect says 5.
  - A tab once read "changed in another tab" right after a second tab signed in. Not
    reproduced in three tries.
- **The v1.1 list:** `docs/plans/roadmap-flow/v1.1-list.md`.
- **Larger items:**
  - staggered turn-ons (OWN-D4), one list of deviations (F-009), a bulk path (F-192),
    baselines as code (F-024), multi-tenant (F-025);
  - the change freeze: make it work or take it out (F-006);
  - the plan re-dating weeks later (F-183);
  - the polish research, for v1.5 or v2.

## Discard

- **`scripts/render-design.mjs`.** Stale since 2026-09-10: it presses controls that no
  longer exist (the Status and Needs attention lenses, `.stage-*`, the toggles), and
  nothing runs it. Recommended: delete (git keeps it).
- **`scripts/walk.mjs`'s stale checks** (for example "Decide How Devices Are Managed", a
  step that was renamed). The walk runs nowhere automatically. Recommended: keep it as a
  discovery tool and refresh it the next time it is needed, not before launch.
- **The approved reference `docs/design/approved/reference/iamai-plan-organization-final.html`**
  still draws the two toggles. The packs don't bind production, so leave it as history.
- **Batch B4/B5** (compact tiles, disabled Copy, the channel filter, the sticky viewer,
  the conflict message). They never landed in September and the step design has moved
  past them. Recommended: drop.

## Promised, never done

Things said "later" that are still owed, whatever you decide about each:
- **The admin bypass on `main`.** CONTRIBUTING.md says it "will be removed"; it is still
  on, and it also skips the required `ci` check.
- **"Create the service principal if it's missing."** Deferred on 2026-09-25 until after
  Phase 3. Never built: steps that target or exclude one of Jon's seven apps don't say
  what to do when the tenant lacks it.
- **Guest-type wording in procedures.** Deferred on 2026-09-25: "Exclude guest or
  external users" doesn't always say which of the six types to tick. The guests step now
  names them; the other procedures are unchecked.
- **The three test users** (Authenticator registered and never used; text only; a passkey
  registered but signing in with push). Planned for 2026-09-25 so pitfalls could be seen
  live; not seen tonight.
- **Jon's unidentified groups.** Six source groups the interpretation file marks unknown
  hold their policies; the shared-device carve-out waits on the same answer. It needs
  Jon.
- **The 4.4 "registered but not used" pitfall** (2026-09-24: bring the concept back as a
  named pitfall). Unverified tonight: check it before claiming it.
- **The unread sign-in activity question:** no account or consent fixes a tenant without
  Entra ID P1. Still open.
- **The v1.1 paused list** ("re-check against the new structure": engine, dates, exports,
  trust and Inventory items). Never re-checked.
- **The report-only review notice after a scan** (v1.1, the owner's idea of 2026-09-24).

# Public copy review: content corrections pass

This is for owner review before publication. Nothing here is published by this pass.

Each row is one changed public sentence.
- The words live in `docs/design/content.json`, and `home/index.html` is regenerated from it with `scripts/build-home.ts`.
- `SECURITY.md` and `src/copy/permissions.ts` are edited in place.
- Jon Hope attribution, the pinned-baseline disclosure and the Connect public-beta notice are unchanged.

## Home page (`pages.home`)

| Location | Before | After |
|---|---|---|
| Hero headline (`h1`) | Strengthen identity security without guessing what will break. | Find the gaps. Catch the hidden risks. Plan a safer rollout. |
| Hero site line (`siteLine`) | IAMAI reads your Microsoft Entra tenant, compares it with a reviewed security baseline, and writes a dated plan for closing the gaps. Each change starts in report-only before it is enforced. | IAMAI looks beyond whether a policy exists. It checks the details that can make a rollout succeed or fail: which sign-in methods people have, whether the available records show they’ve used them, and whether exclusions or external accounts need attention. |
| What it does, lead (`workLead`) | See what the tenant already protects, what it does not, who each change touches, and what to do before enforcement. | Get a practical plan for what to address first, what to check, and how to move toward stronger protection. You stay in control of every change. |
| What it does, "Plans" row (`work[2].text`) | The difference as dated steps: report-only before enforced, who each change touches, what would break, and the emails to send. | The difference as dated steps: report-only first where a policy supports it, who each change touches, what would break, and the emails to send. |
| Baseline rail (`baselineGoal`) | …constrained sessions and devices, and emergency access that survives every policy. | …constrained sessions and devices, and emergency access kept out of every policy as a backup you check and test. |
| Trust row title (`trust[1].title`) | Your tenant's data never leaves the browser | Your scan and plan stay in your browser |
| Trust row body (`trust[1].body`) | The scan reads Microsoft Graph from this browser and keeps the result here: no IAMAI server, no upload, nothing about your tenant sent anywhere; an export is a file you save yourself. The web host that serves this page counts page loads, as web hosts do, and never sees your tenant. | IAMAI has no server of its own: the scan and the plan are processed in this browser, and your tenant's data is not uploaded to IAMAI. Signing in and reading the tenant go straight to Microsoft, and an export or copied text leaves only when you share it. The web host that serves this page counts page loads, as web hosts do; it is not given your tenant's data. |

The Connect page heading (`pages.connect.h1`, "Strengthen identity security without guessing what will break.") is unchanged. The owner's direction is used once, in the home hero and product description, rather than repeated.

## Connect (`pages.connect`)

| Location | Before | After |
|---|---|---|
| Baseline tile goal (`baseline.goal`) | …constrained sessions and devices, and emergency access that survives every policy. | …constrained sessions and devices, and emergency access kept out of every policy as a backup you check and test. |
| Ready-to-scan note (`scan.ready.note`) | About ten minutes. Reads the tenant into this browser; nothing is sent anywhere. | About ten minutes. The scan is processed in this browser; nothing is uploaded to IAMAI. |

## Plan content

| Location | Before | After |
|---|---|---|
| Create or Correct Exclusions Group, Why (`steps[s-prereq-exclusion-group].why`) | …Every Conditional Access policy in the baseline excludes this group, so its members can always sign in. | …Every Conditional Access policy in the baseline excludes this group, so its members are a backup way in: one to check and test, not a guarantee. |
| Announcement date note (`commsForecastNote`) | That date is our target, not a commitment: we run the change in report-only first, watch who it would have affected, and confirm the date with you before anything changes. | That date is our target, not a commitment: where the policy supports it, we run the change in report-only first, watch who it would have affected, and confirm the date with you before anything changes. |

## Sign-in disclosure (`src/copy/permissions.ts`, `UserAuthenticationMethod.Read.All`)

This text is shown on Connect and How.

| Location | Before | After |
|---|---|---|
| What it reads (`reads`) | Which kinds of sign-in method each account has registered. Never the values: no phone numbers, no codes, no keys. | Which kinds of sign-in method each account has registered. Microsoft returns each method’s details; IAMAI saves only a summary of its kind, and drops phone numbers before saving. |
| Consent list (`consentReads`) | Which kinds of sign-in method each account has, never the values | Which kinds of sign-in method each account has; phone numbers are not saved |

## `SECURITY.md`

| Location | Before | After |
|---|---|---|
| What the app reads | …per-user registered method types (never phone numbers or secrets); and interactive sign-in records for up to the last 30 days. | …per-user registered sign-in methods; and interactive sign-in records for up to the last 30 days. For registered methods, Microsoft returns each method's details; IAMAI saves only a summary of each method (its kind, and for a phone, whether it is a mobile or office line), and phone numbers are dropped before anything is saved. |
| Permissions table, `UserAuthenticationMethod.Read.All` | Which kinds of method each account has registered, never the values | Each account's registered methods; IAMAI saves which kinds, without phone numbers |
| What it stores | Everything stays in the browser on this device: | What IAMAI saves stays in the browser on this device: |
| What can leave the browser | Nothing leaves on its own. Data moves when you choose to move it: | Apart from the Microsoft sign-in, the Microsoft Graph reads and the GitHub checks listed above, nothing leaves on its own. Data moves when you choose to move it: |

## Reviewed and left unchanged
- **How page hosting statement (`app.how.hostingBody`):** it is already bounded to the host: the snapshot stays in the browser, so nothing the host serves has held it. It names the beacon separately.
- **Export intro:** "Every file here is built in this browser; nothing is uploaded anywhere." This describes export files, which are built locally.
- **Home meta description and "Read-only / Runs in your browser / Source is public":** these are accurate as short claims.
- **`SECURITY.md` "What it never does":** it says the app never writes to the tenant, and that the user reviews and applies implementation content.
- **`SPEC.md` §4 row A:** "values stripped; never phone numbers" is internal specification, not active public copy. Not changed in this pass.

## Consolidated batch: final changes

These supersede the rows above where the same location appears.

| Location | Before (after the first pass) | Final |
|---|---|---|
| Home trust row title (`pages.home.trust[1].title`) | Your scan and plan stay in your browser | Your plan is built in your browser |
| Home "Plans" row (`pages.home.work[2].text`) | The difference as dated steps: report-only first where a policy supports it, who each change touches, what would break, and the emails to send. | The difference as dated steps: report-only first where a policy supports it, who could be affected by each change, and the emails to send. |
| Home meta description (`pages.home.metaDescription`) | Read a Microsoft Entra tenant, see who a Conditional Access change is predicted to affect before you make it, … | Read a Microsoft Entra tenant, see who a Conditional Access change could affect before you make it, … |
| Connect heading (`pages.connect.h1`; pinned in the Connect test, smoke and walk) | Strengthen identity security without guessing what will break. | Strengthen identity security with evidence about who could be affected. |
| `README.md` introduction | …each change is predicted to affect, … | …each change could affect, … |
| Sign-in disclosure, what it reads (`src/copy/permissions.ts`, `UserAuthenticationMethod.Read.All`) | Which kinds of sign-in method each account has registered. Microsoft returns each method’s details; IAMAI saves only a summary of its kind, and drops phone numbers before saving. | Which kinds of sign-in method each account has registered. IAMAI saves the sign-in details needed for its checks, leaving out phone numbers. |
| `SECURITY.md`, What the app reads | …IAMAI saves only a summary of each method (its kind, and for a phone, whether it is a mobile or office line), and phone numbers are dropped before anything is saved. | …Microsoft returns each method's details. IAMAI saves the sign-in details needed for its checks, leaving out phone numbers: each method's kind and when it was added, and for passkeys, security keys and Microsoft Authenticator the device details those checks read. |
| `SECURITY.md`, permissions table | Each account's registered methods; IAMAI saves which kinds, without phone numbers | Each account's registered methods; IAMAI saves the sign-in details its checks need, leaving out phone numbers |

**Why the method sentence changed:** the saved summary is more than a method type. For passkeys, security keys and Windows Hello for Business it keeps each method's id and creation date. For Authenticator it keeps the device name, app version, device tag and platform, and for a phone line its type. These are the facts IAMAI's readiness and emergency-access checks read. Phone numbers and email-method addresses are dropped before saving.

**Kept unchanged:** the hero headline and site line ("Find the gaps. Catch the hidden risks. Plan a safer rollout." and the approved description), Jon Hope attribution, the pinned-baseline disclosure, and the Connect public-beta notice. No sign-out or Forget wording was touched. `SECURITY.md` already separates *Sign out* (clears the sign-in session) from *Forget this tenant* (deletes that tenant's saved records).

## Consolidated batch: Email and guidance wording

These are not public-site pages, but they are text customers send or follow.

| Location | Before | After |
|---|---|---|
| Register sign-in methods, Entra observe step | Leave the policy in **Report-only**. Review Conditional Access report-only results and the step-specific evidence. … | Leave the policy in **Report-only**. Check its settings by reading the policy back by stable tenant ID; that confirms the configuration, not the registration experience. Report-only results may not show sign-in method registration attempts, so validate the actual registration steps with a controlled test account before enforcement. … |
| Register sign-in methods, AI Info (report-only) | …Do not recommend enforcement unless the step-specific dependencies are actually clear. | …as before, then: Report-only results may not show registration attempts: treat a settings read-back as a check of the configuration and a controlled registration test as the check of the workflow, and say which of the two the available evidence supports. |
| Register sign-in methods, rollout Email | We will validate the actual registration workflows in Report-only before enforcement. | Before the policy is turned on, we will check its settings and test the registration steps with a test account; report-only records alone may not show how registration behaves. |
| Register sign-in methods, enforce Email | The sign-in method registration protection for {tenant} is ready to enforce after Report-only validation. | We plan to turn on the sign-in method registration protection for {tenant}. Before we do, we check its settings and test the registration steps with a test account. |
| Block device code, enforce Email | Known legitimate dependencies have been resolved. | Before the change, any known workflow that still uses device code should move to a supported sign-in path. |
| Block legacy authentication, enforce Email | Approved service/device dependencies have been accounted for. | Before the change, any known service or device that still uses legacy sign-in should move to a supported path. |
| Admins phishing-resistant, enforce Email | The administrator policy has completed validation and is ready to be enabled. | The administrator policy has finished its Report-only review and is ready to be turned on. |
| MFA for everyone, enforce Email | The tenant-wide MFA policy has completed its validation stage and is ready to be enabled. | The tenant-wide MFA policy has finished its Report-only review and is ready to be turned on. |
| Guest MFA, enforce Email | The guest MFA policy pair has completed validation and is ready to be enabled. | The guest MFA policy pair has finished its Report-only review and is ready to be turned on. |
| Shared devices, change Email | We are enabling the dedicated shared-device Conditional Access policy after report-only validation. | We plan to turn on the dedicated shared-device Conditional Access policy after its report-only review. |
| Security Defaults cutover Email | Security Defaults is being replaced with the validated Conditional Access policy set in one controlled change window. | We plan to replace Security Defaults with the reviewed Conditional Access policy set in one controlled change window. |
| Limit How Long Sessions Last: Entra, AI Info, readiness and troubleshooting | "…canonical group/shared-device exclusions…", "Confirm shared-device accounts remain excluded", readiness tile "Shared devices: The complete shared-device account exclusion set is resolved." | "…IAMAI's canonical exclusion groups and only the individual accounts the resolved target names", a line naming those accounts or "none: the resolved target excludes no individual accounts", "Confirm the policy's exclusions still match the resolved target", readiness tile "Excluded accounts: …the exact set, or none where the target excludes nobody." |

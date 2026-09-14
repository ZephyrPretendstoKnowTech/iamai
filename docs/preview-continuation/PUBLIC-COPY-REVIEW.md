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

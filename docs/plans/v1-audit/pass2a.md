# Pass 2A — Implementation Tasks, every channel

Audit only. Nothing was edited. Tree at `7f242c51`, pin `90d9b89`.

## What was read

43 implementation-content packages (`docs/implementation-content/*/CONTENT.md`, two nesting
shapes: `<id>/CONTENT.md` and `<id>/<id>/CONTENT.md`), holding **947 `@@IAMAI-BEGIN` blocks**:
entra 346, aiInfo 220, json 191, email 59, readiness 47, troubleshooting 43, powershell 39,
manual 2. My five channels are 855 of those. The Entra channel (346) and the JSON channel (191)
were read in full; email (59) in full; PowerShell (39) read structurally — every
`Assert-Canonical`, every `New-*Conditions`/`New-Session` builder and the whole `switch ($Mode)`
of each script; aiInfo (220) read by sample plus a targeted sweep for condition instructions,
baseline claims and absolute statements. Enumerated against `docs/qa/tile-dump.txt`: 45 step ids
across 8 fixtures, **41 distinct Implementation Task names**. The translator
`src/roadmap/portalLines.ts` was read in full and executed against the pinned baseline to see
what it renders; `src/ui/surfaces/stepBody.ts` and `stepPackage.ts` `entraWithSettings` were read
to establish that the translator's lines are appended to the packaged Entra tab.

Microsoft Learn pages fetched and checked **2026-09-20**: `concept-conditional-access-conditions`,
`concept-condition-filters-for-devices`, `concept-assignment-network`,
`concept-conditional-access-grant`, `deployment-guide-token-protection-windows`,
`how-to-mfa-registration-campaign`, `how-to-authentication-passkeys-fido2`,
`concept-authentication-strengths`, `concept-authentication-strength-advanced-options`,
`pim-how-to-change-default-settings`.

Counts: 22 findings — **8 at severity 4**, 5 at 3, 7 at 2, 2 at 1 — plus 3 FROZEN.

---

## Findings

| # | step | task | channel | what it says today (quoted) | what an admin would build wrong | sev | proposed fix | source checked |
|---|---|---|---|---|---|---|---|---|
| F1 | every packaged policy step whose target has a location condition (`s-goal-geo-restriction`, `s-goal-require-managed-device`, `s-shared-devices`, `s-goal-service-accounts-trusted-network`, `s-goal-workload-identity-block`) | Settings for This Action (appended to the Entra tab by `stepPackage.ts` `entraWithSettings` → `portalLines`) | Entra | `src/roadmap/portalLines.ts:198` — ``out.push(`Conditions → Locations → Include: ${inc \|\| 'Any location'}${exc ? `; Exclude: ${exc}` : ''}`)``. Rendered against the pin: `5. Conditions → Locations → Include: Any location; Exclude: «1d421232-…»` | **The archetype, still live at the source.** No Configure toggle, no consequence line. Left at **No** the condition is not configured and the policy applies to every location, so the exclusion of the approved countries / trusted network never happens: `IAC - GLOBAL – BLOCK – Countries not Allowed` becomes Block access, All users, All resources, everywhere. Whole-tenant lockout bar the exclusions group. The same tab already carries the package sentence that *does* name the toggle, so the two contradict each other | **4** | In `conditionLines()`, give the locations branch the shape the clientApps/platforms branches were given on 2026-09-19: `Conditions → Network (older portal: Locations) → Configure: Yes, then Include: …; Exclude: …. Left at No the network condition is not configured, and Microsoft's rule is that a policy applies to all locations by default.` | https://learn.microsoft.com/en-us/entra/identity/conditional-access/concept-assignment-network — "A user's location is determined using their public IP address … Conditional Access policies apply to all locations by default." and "The **Location** condition moved and was renamed **Network**." (2026-09-20) |
| F2 | same surface; reaches `s-goal-token-protection` and the `IAC - ZTCA - INTUNE - BLOCK - AllApps - ExcludeTrustedLocation` target | Settings for This Action | Entra | `src/roadmap/portalLines.ts:237` — ``out.push(`Conditions → Filter for devices → ${f.deviceFilter.mode === 'exclude' ? 'Exclude' : 'Include'} devices matching: ${f.deviceFilter.rule}`)``. Rendered: `6. Conditions → Filter for devices → Exclude devices matching: device.isCompliant -eq True -or device.trustType -eq "ServerAD" -or device.trustType -eq "Workplace"` | Same archetype. Filter for devices carries a Configure Yes/No toggle; left at No the filter is not applied at all. On that policy — Block access, All users, All resources, any location except trusted — every compliant and hybrid-joined device is then blocked the moment it leaves the office | **4** | Add `Configure: Yes, then` and the consequence to the deviceFilter branch of `conditionLines()`, in the same commit as F1 | https://learn.microsoft.com/en-us/entra/identity/conditional-access/concept-condition-filters-for-devices — "Under **Conditions**, **Filter for devices**. 1. Toggle **Configure** to **Yes**. 2. Set **Devices matching the rule** to **Exclude filtered devices from policy**." (2026-09-20) |
| F3 | `s-goal-token-protection` | Require Token Protection on Windows — `entra.create` step 7, and `entra.correct.conditions.cloudpc-device-filter` | Entra | "7. Under **Conditions > Filter for devices**, configure **Exclude filtered devices from policy** with `device.systemLabels -contains "CloudPC" -and device.trustType -eq "AzureAD"`." — and the correct block: "Under **Conditions > Filter for devices**, set the filter to **Exclude filtered devices from policy** using …" | Steps 5 and 6 on the same numbered list do say "set **Configure** to **Yes**" for Device platforms and Client apps; step 7 does not. An admin who follows literally leaves Filter for devices at No, so the Cloud PC exclusion is absent and Entra-joined Cloud PCs — an unsupported registration type — are blocked from Exchange Online, SharePoint Online, Teams, AVD and Windows 365 with sign-in status `1003`. The package's own `verifiedSources` entry even records that the Learn guide sets Configure to Yes "on both the Device platforms and the Client apps conditions" — the third condition was never carried across | **4** | Make step 7 read "set **Configure** to **Yes**, then set **Devices matching the rule** to **Exclude filtered devices from policy** … Left at **No** no device filter is applied and Cloud PCs are blocked." Mirror in the correct block | https://learn.microsoft.com/en-us/entra/identity/conditional-access/deployment-guide-token-protection-windows — "Cloud PCs deployed by Windows 365 … that are Microsoft Entra joined" are unsupported; "To prevent disruption during onboarding, modify the token protection Conditional Access policy by adding a device filter condition that excludes devices in the previously described deployment category." (2026-09-20) |
| F4 | `s-goal-block-unsupported-platforms` | Block Unsupported Device Platforms — `entra.correct-conditions` | Entra | "Set its conditions to the intended target: **Users: All users** with the resolved exclusions; **Target resources: All resources**; **Conditions > Device platforms**: include **Any device** and exclude **Android**, **iOS**, **Windows** and **macOS**." | The step's own `entra.create` says "set **Configure** to **Yes**" for the same condition; the correct block drops it. An admin correcting an existing policy leaves Device platforms unconfigured, so the condition applies to all device platforms and the policy becomes Block access / All users / All resources — the tenant, minus the exclusions group. This is the exact 2026-09-19 class, back in an authored package | **4** | Copy the create block's clause verbatim: "set **Configure** to **Yes**, then include **Any device** and exclude … Left at **No** it applies to all device platforms." | https://learn.microsoft.com/en-us/entra/identity/conditional-access/concept-conditional-access-conditions — Device platforms: "By default, it applies to all device platforms." (2026-09-20) |
| F5 | `s-goal-session-lifetime` (renders as `s-goal-all-users-no-persistence`, "Limit How Long Sessions Last") | Create the policy in Report-only | Entra + AI Info vs JSON + PowerShell | Entra `entra.create-set`: "6. Session: Sign-in frequency → Periodic reauthentication, **set to the interval in the intended target shown on this step**". AI Info: "Sign-in frequency as the intended target sets it (periodic reauthentication)". JSON `json.browser.create`: `"signInFrequency":{…,"type":"hours","value":12}`. PowerShell: `New-One $BrowserPolicyDisplayName (New-BrowserConditions) **12**` | Two channels read the resolved target, two hardcode 12. The moment a decision narrows the interval, the tab an admin types from and the body an admin pastes build different policies, and IAMAI then reports a difference against whichever one was used. See the divergence section | **4** | Bind the interval in JSON and PowerShell (`{{json:policies.session.browser.target.signInFrequencyHours}}` / a `-Hours` parameter fed from the binding), or make all four channels state the literal the pin holds | pinned baseline `IAC - GLOBAL – SESSION – All Users Persistence (9-12 Hours)` holds `value: 12` (read 2026-09-20) |
| F6 | `s-goal-session-lifetime` | Create the policy in Report-only / Update the policy settings — the `unmanaged` member | Entra + JSON + PowerShell | `entra.create-set`: "**The baseline has one session policy for this step: the browser policy below.**" Yet the same package ships `entra.correct.unmanaged.missing` ("Create only the missing unmanaged-device component using the Policy B procedure from this package"), `json.unmanaged.create` (`"clientAppTypes":["all"]`, `"devices":{"deviceFilter":{"mode":"exclude","rule":"device.isCompliant -eq True"}}`, `"value":9`) and PowerShell `'CreateUnmanaged'` | A second tenant-wide policy the pinned baseline does not contain: every client app (not browser only), a 9-hour forced reauthentication and Never-persistent for every user on a non-compliant device. The step's own create text denies it exists. CLAUDE.md: "the pinned baseline wins" | **4** (latent) | Either delete the whole `unmanaged` member from the package for V1, or make every block that draws it say the pin holds no such policy and where the 9 hours and the filter come from | `src/roadmap/absentGoals.test.ts` asserts `byod-session-controls` "is absent from the baseline and must not render", so the member is unreachable with pin `90d9b89` — latent, not live |
| F7 | `s-goal-mobile-app-protection` | Require App Protection on Phones | Entra + AI Info | `entra.create` step 4: "Target resources: All resources. **Conditions → Device platforms → Include: Android and iOS.**" `entra.correct-conditions`: "Device platforms → Include: Android and iOS." `ai.create`: "All users with the IAMAI-resolved exclusions, All resources, device platforms Android and iOS, and Grant: Require app protection policy." | No Configure toggle anywhere in the package. Left at No the condition reaches every platform, so **Require app protection policy** becomes the only grant for Windows, macOS and Linux — which Learn says is not supported and which no desktop browser can satisfy. Every desktop sign-in blocked | **4** (latent) | Add the toggle and consequence to all three blocks | https://learn.microsoft.com/en-us/entra/identity/conditional-access/concept-conditional-access-conditions — "Selecting macOS or Linux device platforms isn't supported when you select **Require approved client app** or **Require app protection policy** as the only grant controls" (2026-09-20). Latent: `mobile-app-protection` is in `absentGoals.test.ts` ABSENT |
| F8 | `s-goal-unmanaged-browser` | (Policy A / Policy B) | Entra | `entra.create-set`: "**{{…a.target.displayName}}** (Policy A): Target resources: Office 365; **Client apps: Browser**; apply the device condition shown in the intended target; Session: **Use app enforced restrictions**." | No Configure toggle. Left at No the condition reaches every client app, so app-enforced restrictions are imposed on desktop and mobile clients as well as the browser — wider than intended. The whole block is also a clause per policy, not a procedure | **4** (latent) | Add the toggle; rewrite as a numbered procedure with the portal path | Same conditions page, Client apps: "The **Configure** toggle when set to **Yes** applies to checked items, when set to **No** it applies to all client apps" (2026-09-20). Latent: `block-downloads-unmanaged` is ABSENT |
| F9 | `s-goal-user-risk-medium` | Create the policy in Report-only | Entra, JSON, PowerShell (all agree) | `entra.create` step 7: "Grant: **Grant access** → Require authentication strength: **{{authStrength.target.displayName}}** **and** Require password change → **Require all selected controls**. That is the pair the pinned baseline holds, and it is what IAMAI compares the tenant against." | Microsoft documents that this combination is not allowed. The pin wins — but the step never says Microsoft's current guidance differs, so an admin who meets Entra's refusal has no idea whether they mis-read the step or the product is wrong, and no "what to do when the screen does not look like the instruction". The neighbouring `entra.correct.grant` cites the *same* Learn page for a different restriction ("Microsoft's grant reference says password change and risk remediation are used separately"), so the omission reads as deliberate | 3 | One sentence: "Microsoft's grant reference says Require password change can't be combined with other controls. The pinned baseline holds this pair; if the portal refuses it, stop and record it rather than dropping a control." | https://learn.microsoft.com/en-us/entra/identity/conditional-access/concept-conditional-access-grant — "**Require password change** can't be used with other controls, such as requiring a compliant device." and "The policy must be assigned to **All resources**." (2026-09-20) |
| F10 | `s-goal-token-protection` | Require Token Protection on Windows | Entra (`entra.create`, `entra.observe`) | `entra.create` step 4 selects "**Azure Virtual Desktop**, and **Windows 365**"; `entra.observe` says only "Resolve required unsupported clients, shared/service-device workflows, or **unsupported registration types** before enforcement." | The step targets AVD and Windows 365 as resources but never names which registrations are unsupported. The pinned filter excludes only `CloudPC` + `AzureAD`; Entra-joined **AVD session hosts**, bulk-enrolled Windows devices, Autopilot self-deploying devices, Azure VM-extension devices and Power Automate hosted machine groups are all unsupported and all unexcluded. Enforcement blocks them with no warning | 3 | Name the unsupported registration types in `entra.observe`, with the `tokenProtectionStatusDetails` / `signInSessionStatusCode 1003` query, and say the pinned filter covers only Cloud PCs | Token protection deployment guide, "Known limitations" (2026-09-20) |
| F11 | `s-goal-block-device-code` | Block Device Code Sign-in — `entra.create` | Entra | "because the target is **All resources**, the policy also reaches **Device Registration Service**, which you exclude if this tenant registers devices by device code." | Instructs an application exclusion the pinned policy `IAC - GLOBAL - BLOCK - Device Code Auth Flow` does not carry (`excludeApplications: []`). An admin who takes it builds a policy IAMAI will then report as a difference that never resolves, exactly the failure mode the Client-apps sentences warn about elsewhere | 3 | Say it is a deviation from the pin, or move it to the observe block as something to raise rather than do | pinned baseline read 2026-09-20 |
| F12 | `s-goal-session-lifetime` | Create the policy in Report-only | PowerShell | `switch ($Mode) { 'Create' { … $browserId = New-One … 12; … $unmanagedId = New-One … 9 … } }` | The projection only ever passes `-Mode CreateBrowser` (`registry.generated.json` `projection.missing.powershell`), but the whole script is shown and copyable, and `Create` is the obvious mode name. Running it creates the unpinned unmanaged policy of F6 | 3 | Remove the `Create` / `CreateUnmanaged` modes with the F6 content, or gate them behind `withheldModes` as the service-accounts script does for `Enforce` | registry + script read 2026-09-20 |
| F13 | `s-prereq-auth-strength` | Set up the authentication strength | Entra, JSON | "4. Select exactly these methods: {{strength.target.methodNames}}." | The pin records the same strength id `42de22a7-5339-4a58-b560-28565d53b14d` with two different `allowedCombinations`: `IAC - GLOBAL - GRANT - MFA-Passkey - UserRegistration` carries `temporaryAccessPassMultiUse`, `IAC - INTUNE – GRANT – Device Registration - MFA Strength` does not. Which method list the step prints depends on which baseline policy resolved the binding, and one of them lets a multi-use TAP satisfy every admin policy that uses the strength | 3 | Resolve the strength once from the pin (one definition per id) and fail closed on disagreement; this is a baseline-data fix, not a content fix | `baselines/jhope188-conditionalaccesspolicies.pinned.json`, read 2026-09-20 |
| F14 | product-wide | all policy tasks | Entra | Three spellings of one blade in one product: `Conditions → Locations` (`s-shared-devices` `entra.create` step 6, `s-goal-require-managed-device`, `s-goal-register-info-protected`, `portalLines.ts`); "**Network** (older portal: **Conditions > Locations**)" (`s-goal-geo-restriction`, `s-goal-service-accounts-trusted-network`); "**Network** (this page still calls it **Conditions > Locations**)" (`s-goal-workload-identity-block`) | A newcomer looking for "Locations" in the current portal finds "Network" and stops, or assumes the instruction is stale and improvises | 2 | One phrasing, once, in shared copy; use it in `portalLines.ts` too | `concept-assignment-network`: "The **Location** condition moved and was renamed **Network**." (2026-09-20) |
| F15 | 12 packages (`admin-session`, `admins-phishing-resistant`, `azure-management-mfa`, `block-auth-transfer`, `block-device-code`, `block-legacy-auth`, `block-unsupported-platforms`, `geo-restriction`, `inforcer-mfa`, `mobile-app-protection`, `register-info-protected`, `require-managed-device`, `unmanaged-browser`) | rollout / enforce notice | Email | `email.rollout` (state `missing`) and `email.enforce` (state `readyToEnforce`) are byte-identical. e.g. both: "We are preparing to block the sign-in transfer shortcut between devices. Where supported, sign in directly on the destination device. Tell IT if a required app cannot do that." | The notice sent the week before enforcement says the same thing as the notice sent when the policy was first drafted: no date, no "this is happening", no "what changes for you". Recipients learn nothing new and stop reading | 2 | Give the enforce-state mail its own body: what changes, when, what to do if it fails | read 2026-09-20 |
| F16 | `s-verify-mfa` | Help each person set up their method — `entra.configure` step 2 | Entra | "Left at **Microsoft managed**, Microsoft runs the campaign: it targets passkeys where the included people are enabled for them, Microsoft Authenticator where they are not, and **it reaches everyone who can do MFA rather than only the people on a text message or a voice call.**" | True for the passkey branch, false for the Authenticator branch. Under Microsoft managed + Authenticator the user is prompted only after MFA by SMS or voice call — exactly the population the sentence says it is not limited to. An admin leaves the campaign on Microsoft managed expecting full reach and nudges a fraction of the tenant | 2 | Split the sentence by branch, as Learn's table does | https://learn.microsoft.com/en-us/entra/identity/authentication/how-to-mfa-registration-campaign — MFA-requirement table: Microsoft managed + Microsoft Authenticator → "The user completes MFA by using SMS or voice call." (2026-09-20) |
| F17 | `s-goal-token-protection` | Require Token Protection on Windows | Entra, JSON, PowerShell | "4. Under **Target resources > Resources > Select resources**, select only **Office 365 Exchange Online**, **Office 365 SharePoint Online**, **Microsoft Teams Services**, **Azure Virtual Desktop**, and **Windows 365**." | Microsoft's current list adds **Windows Cloud Login**. The pin holds five app ids and the pin wins — but the step never says the two differ, so an admin who reads the linked Learn page (the block links it) sees six and cannot tell which to trust | 2 | Add the pin-vs-Microsoft sentence the product uses elsewhere | Token protection deployment guide, step 6.1: "Azure Virtual Desktop / Windows 365 / **Windows Cloud Login**" (2026-09-20) |
| F18 | `s-check-dormant-accounts` | Review each account | Entra | `entra.dormant`: "Entra admin center → Entra ID → Users → the account → **Edit properties → Account enabled: No**." `entra.disable`: "4. Under **Account status**, edit the account and clear **Account enabled**." | Two portal paths for one setting in one step's two states. A reader who saw the first and then the second does not know whether they are the same control | 2 | One path, once | read 2026-09-20 |
| F19 | `s-goal-guests-mfa` | Require MFA for Guests — `entra.create-pair` | Entra | The whole create procedure is: "1. **{{…strong.target.displayName}}** — use this policy's resolved users and exclusions, All resources, all client apps, no extra conditions, and the authentication strength resolved for this tenant. 2. **{{…mixed.target.displayName}}** — … and built-in MFA (**Require multifactor authentication**)." | Below the bar: no portal path, no numbered field order, no Enable-policy line, no verification. The step's own `entra.correct-pair` is a proper 16-step procedure — an admin creating from scratch gets less than one correcting. "all client apps" with no Configure guidance also leaves the toggle unnamed | 2 | Write the create as a numbered procedure per policy, the shape `entra.correct-pair` already has | read 2026-09-20 |
| F20 | product-wide | all tasks | Entra | 5 of 346 Entra blocks name a directory role: "as at least a User Administrator" (×2, dormant accounts), "It takes the Security Administrator role" (auth strength), "You need at least the **Authentication Policy Administrator** role" (per-user MFA), "You need at least the **Conditional Access Administrator** role" (security defaults). Every Conditional Access create/correct block names none; `s-goal-pim-activation-reauth` `entra.pim.configure` names none | An admin who is not a Conditional Access Administrator opens the blade, cannot save, and has nothing to tell them why. The Emergency Access bar names the role on its steps; the policy steps do not | 2 | One role line per procedure, the way the Emergency Access steps do it | Learn names Conditional Access Administrator on every CA create procedure; PIM role settings need "at least a [Privileged Role Administrator]" (`pim-how-to-change-default-settings`, 2026-09-20) |
| F21 | `s-prereq-passkey-settings` vs `s-verify-mfa` / `s-prereq-per-user-mfa` | several | Entra | "Open Entra admin center → Entra ID → **Security** → Authentication methods → Policies → Passkey (FIDO2)" vs "check **Entra ID > Authentication methods > Policies > Microsoft Authenticator**" and "Go to **Entra ID > Authentication methods > Policies**" | Same blade, with and without `Security`. Learn uses `Entra ID > Security > Authentication methods > Policies` | 1 | One path | `how-to-authentication-passkeys-fido2`: "Browse to **Entra ID** > **Security** > **Authentication methods** > **Policies**." (2026-09-20) |
| F22 | `s-goal-user-risk` | Create the policy in Report-only — `entra.create` step 5 | Entra | "5. Grant: **Grant access > Require risk remediation**. **When Entra adds authentication strength, select {{authStrength.target.displayName}}.** Keep the relationship as AND." | Unparseable. It reads as "wait for a future Entra feature". What is meant is that selecting Require risk remediation makes Entra apply Require authentication strength automatically, and the admin then picks the resolved strength | 1 | "Selecting **Require risk remediation** makes Entra add **Require authentication strength** and **Sign-in frequency — Every time** to the policy. Choose **{{authStrength.target.displayName}}** as the strength." | https://learn.microsoft.com/en-us/entra/identity/conditional-access/concept-conditional-access-grant — "When you select **Require risk remediation** as a grant control, the following settings are automatically applied to the policy: **Require authentication strength**, **Sign-in frequency - Every time**." (2026-09-20) |

---

## Cross-channel divergence

Where the Entra tab, the JSON body and the PowerShell do not build the same policy. Six, all in
two packages plus the shared translator. Every other package was compared field by field
(population, exclusions, target resources, each condition, grant controls + operator, session
controls, state) across all three channels and **agreed**: `admin-session`,
`admins-phishing-resistant`, `azure-management-mfa`, `block-auth-transfer`, `block-device-code`,
`block-legacy-auth`, `block-unsupported-platforms`, `device-registration-mfa`, `geo-restriction`,
`guests-mfa`, `inforcer-mfa`, `intune-enrollment-reauth`, `mfa-all-users`, `pim-activation-reauth`,
`register-info-protected`, `require-managed-device`, `service-accounts-trusted-network`,
`sign-in-risk`, `sign-in-risk-medium`, `token-protection`, `user-risk`, `user-risk-medium`,
`workload-identity-block`, `shared-devices`.

**D1 — `s-goal-session-lifetime`, the sign-in interval (sev 4).**
Entra `entra.create-set` step 6: "set to the interval in the intended target shown on this step".
AI Info `ai.create`: "Sign-in frequency as the intended target sets it (periodic reauthentication)".
JSON `json.browser.create` / `json.browser.session`: `"type":"hours","value":12` — literal.
PowerShell: `New-One … 12`, `Patch-One $BrowserPolicyId @{sessionControls=(New-Session 12)}`, and
`Assert-Canonical` hardcodes `$hours = if ($Kind -eq 'Browser') { 12 } else { 9 }`. Two channels
read the resolved target, two cannot. 12 happens to match the pin today; nothing keeps them equal.

**D2 — `s-goal-session-lifetime`, how many policies the task creates (sev 4).**
Entra: one. "The baseline has one session policy for this step: the browser policy below."
JSON: two create bodies (`json.browser.create`, `json.unmanaged.create`).
PowerShell: `'Create'` creates both in one run.

**D3 — `s-goal-session-lifetime`, the unmanaged interval (sev 4).**
`entra.correct.unmanaged.session`: "set Sign-in frequency to **9 hours** (Periodic
reauthentication)" — a literal, in the same package whose create block defers to the target and
whose only pinned policy is 12 hours.

**D4 — Filter for devices, Entra vs the machine channels (sev 4).**
JSON and PowerShell always write `devices.deviceFilter`, so the filter is always applied. The Entra
text (F3, and the translator line in F2) never names the Configure toggle, so the Entra path can
produce a policy with no filter at all while the JSON path cannot. Same policy, two outcomes,
depending only on which tab the admin used.

**D5 — Device platforms on `s-goal-block-unsupported-platforms`, correct path (sev 4).**
`json.correct-conditions` sends `{{json:policy.target.conditions}}`, which carries `platforms`, so
the JSON always configures the condition. `entra.correct-conditions` (F4) omits the toggle. Same
class as D4.

**D6 — the translator's supplement against the package prose, on one tab (sev 4).**
`stepPackage.ts:419` `entraWithSettings` appends a "Settings for This Action" list built from
`portalLines` to the packaged Entra tab whenever the text matches `/resolved|match the target|target settings/`.
On `s-goal-geo-restriction` that means the package sentence "**Network** … set **Configure** to
**Yes**" sits directly above the supplement's `Conditions → Locations → Include: Any location;
Exclude: …`, which names neither the blade's current name nor the toggle. The supplement reads as
the authoritative field list. Fixing F1/F2 closes D6.

---

## FROZEN

Findings against `s-prereq-break-glass`, `s-prereq-exclusion-group`, `s-prereq-passkey-settings`,
the Verify Emergency Access cleanup row (`cleanup-drill`) and the four `s-direction-*` steps.
**Recorded, not to be applied.**

| # | step | task | channel | what it says today (quoted) | what an admin would get wrong | sev | proposed fix | source checked |
|---|---|---|---|---|---|---|---|---|
| Z1 | `s-prereq-passkey-settings` | Review passkey settings / Configure passkey registration / Prepare affected passkeys / Configure passkey protections | Entra | `entra.configure-fido2` runs 1–8; `entra.configure-authenticator` opens at "6. Open Microsoft Authenticator in the same Authentication methods list"; `entra.configure-tap` opens at "9. Open Temporary Access Pass in the same list" | When the three blocks project together the numbering reads 1–8, then 6–8, then 9–11. A reader following numbers loses their place, and "the same Authentication methods list" after a jump back to 6 is ambiguous | 2 | Renumber continuously, or drop numbers in the two continuation blocks | read 2026-09-20 |
| Z2 | `s-prereq-exclusion-group` | Create an emergency exclusions group / Choose an existing exclusions group | Entra | `entra.create-group` opens "If confirming an existing group (like "Breakglass Exclusion"): Click Save above." then "If creating a new group: 1. Go to Entra admin center → Groups → All groups → New group." | Two branches in one block; the confirm branch has no portal path and "Click Save above" points at a control the procedure never named. A specific tenant's group name ("Breakglass Exclusion") is hardcoded as the example | 2 | Split into two blocks with their own states; drop the tenant-specific name | read 2026-09-20 |
| Z3 | `s-prereq-break-glass` | Create an emergency account / Configure an existing account / Set up an approved passkey | Entra | `entra.create-or-correct` step 4: "Assign **Global Administrator** as an active permanent assignment, not merely eligible through PIM." Step 5 names the method. Neither names the portal path for the role assignment, while step 1 does name the path for the user | 1 | Inconsistent with its own step: one action has a path, the next does not | 1 | Give step 4 the path (`Entra ID → Roles and administrators → Global Administrator → Add assignments`), as `entra.correct.role` half-does ("Under **Roles and administrators**") | Learn's emergency-access guidance still recommends permanent active Global Administrator on break-glass accounts (2026-09-20) |

Nothing in the frozen set contradicts current Microsoft guidance: the five-minute MFA window before
passkey registration, the one-way passkey-profile opt-in, "Allow self-service set up", the AAGUID
model-family reading and the 90-day drill cadence all check out
(`how-to-authentication-passkeys-fido2`, 2026-09-20). The four Emergency Access steps remain the
bar, and they read as the bar.

---

## Patterns — one commit per class

**P1. The Configure toggle was fixed for five conditions and missed on two.** The 2026-09-19 fix
covered Client apps, Device platforms, Authentication flows, Sign-in risk and User risk. It never
reached **Network/Locations** or **Filter for devices**, in either the translator
(`portalLines.ts` `conditionLines()`, F1+F2) or the authored packages (`s-goal-token-protection`
F3). One commit: add the toggle and the consequence sentence to both branches of
`conditionLines()`, then sweep the four package blocks that name a location or a filter without it.
Closes F1, F2, F3, D4, D6. *Acceptance:* a unit test that asserts every line `conditionLines()`
emits which names a condition with a Configure toggle contains `Configure: Yes` — not a per-branch
assertion, a rule over the whole output.

**P2. The `create` block names the toggle; the matching `correct` block drops it.** Seen on
`s-goal-block-unsupported-platforms` (F4) and `s-goal-mobile-app-protection` (F7). The create path
was authored carefully and the correction path was written as a summary sentence. One rule: **every
sentence that names a condition names its own Configure toggle, in every state**. A lint over
`CONTENT.md` — any block matching `Client apps|Device platforms|Device platforms|Filter for devices|Network|Locations|Sign-in risk|User risk`
must also match `Configure` — would have caught all four.

**P3. A literal in the machine channels beside a binding in the prose channels.** F5, D1, D3. Any
value the pin owns must be a binding in *all* channels or a literal in *all* channels; a package
that mixes them ships two policies under one name. A compile-time check is possible: a package
whose Entra text says "the intended target" for a field whose JSON writes a literal is a drift.

**P4. The enforce-state email is the rollout email.** 12 packages (F15). One commit rewrites
`email.enforce` across all of them: what changes, when, what to do if it fails. The pattern exists
because `email.rollout` was copied into the new state rather than written for it.

**P5. Blade names drift with authoring date.** Locations vs Network (three spellings, F14);
Authentication methods with and without `Security` (F21); Account enabled via Edit properties vs
Account status (F18). Every one of these is a name that changed in the portal and was updated in
the packages written after the change and not in the ones written before. One commit: a shared
portal-vocabulary table, used by the packages and by `portalLines.ts`.

**P6. The directory role is named on 5 of 346 Entra blocks.** F20. The Emergency Access steps —
the approved bar — name the role; the policy steps almost never do. Microsoft names it on every
procedure. One commit adds a role line to each `entra.create` / `entra.correct.open` / PIM block.

**P7. Packages for goals the pin does not hold still claim baseline authority.**
`s-goal-mobile-app-protection` ("require a PIN and block Save As to unmanaged locations, **as the
baseline describes**"; "Leave session controls as the target sets them; **the baseline sets none**"),
`s-goal-unmanaged-browser`, `s-goal-azure-management-mfa`, and the `unmanaged` member of
`s-goal-session-lifetime` all speak as if the pin holds their policy.
`src/roadmap/absentGoals.test.ts` says it does not: `byod-session-controls`,
`mobile-app-protection`, `block-downloads-unmanaged`, `azure-management-mfa` are ABSENT and never
render with pin `90d9b89`. That makes F6, F7 and F8 latent rather than live — and it makes the
claim itself the finding. One decision: delete these packages for V1, or make each one say the pin
holds no such policy and where its values come from. As they stand they are 4s waiting for a pin
bump, and they overstate what IAMAI knows.

---

## Could not check

- **Whether the Network condition still carries a Configure toggle in the live portal.** Learn
  documents the toggle explicitly for Client apps and Filter for devices and not for Network; the
  page says only "Conditional Access policies apply to all locations by default". F1 rests on that
  sentence plus IAMAI's own packages, which assert the toggle exists. A screenshot from a real
  tenant would settle it. The finding stands either way: at Configure: No, or unconfigured, the
  policy reaches all locations, and the translator's line says nothing about it.
- **`s-goal-device-registration-mfa` against the second register-device policy.** The pin holds two
  policies on `urn:user:registerdevice`: `IAC - INTUNE – GRANT – Device Registration - MFA Strength`
  (All users, no platform condition) and `IAC - GLOBAL - GRANT - MFA-Passkey - UserRegistration`
  (one group, platforms include iOS / exclude macOS+windows). The step's "the baseline policy also
  sets no device-platform, location, risk, or authentication-flow conditions" is true of the first
  and false of the second. Whether the second can ever resolve as this step's satisfier needs the
  candidate/satisfier mapping, not a content read.
- **PowerShell line-by-line.** 39 blocks read structurally — parameters, `New-*` builders,
  `Assert-Canonical`, the `switch ($Mode)` and every hardcoded literal. Error handling, retry and
  `Connect-CA` scope logic were not audited line by line.
- **aiInfo line-by-line.** 220 blocks; read by sample plus a sweep for condition instructions,
  baseline-authority claims and absolute statements. A full read may find more of the P7 class.
- **readiness (47) and troubleshooting (43)** are outside this pass's channel list and were only
  grepped for contradictions with the Entra text; none found.
- **Rendered screens.** Everything here is from source and from executing `portalLines` against the
  pin; no step was opened in the running app (the brief bars the walk and smoke).

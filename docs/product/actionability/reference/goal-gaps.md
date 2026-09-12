# Goal gaps — Azure management MFA, mobile app protection, unmanaged-device sessions, passkey read

## Sources
- `baselines/jhope188-conditionalaccesspolicies.pinned.json`: commit `90d9b890c4b9af2ac4bc02d97c06bf8900064b4c`, 38 policies, plus its `stripped` and `goalMap` keys. Queried with node, not read by eye.
- `src/roadmap/goalMap.ts`: `PINNED_GOAL_MAP`, `goalInMap`
- `src/coverage/goalIdentity.ts`: `controlKindOk`, `candidates`, `mapGoalsToPolicies`
- `src/coverage/coverage.ts:50` (`CATALOGUE`) and `data/goals.json`
- `src/roadmap/baselineScope.ts` (`absentStepIds`) and `src/roadmap/baselineScope.test.ts:10-14`
- `src/baseline/pinSource.ts:44-75` (`pinPolicy`, the app-exclusion strip)
- `src/coverage/strength.ts:58-59`
- `docs/implementation-content/s-goal-azure-management-mfa/s-goal-azure-management-mfa/META.json`, `…/s-goal-mobile-app-protection/s-goal-mobile-app-protection/META.json`, `…/s-goal-unmanaged-browser/s-goal-unmanaged-browser/META.json`, `…/s-prereq-passkey-settings/s-prereq-passkey-settings/META.json`
- `scripts/walk.mjs:1440`
- `src/graph/collect/registry.ts:50`, `src/graph/collect/collectors.ts:84, 113-132`, `src/graph/collect/coreSections.ts:45`, `src/graph/scopes.ts:14-19`, `src/graph/collect/roles.ts:33`
- `src/validation/rules.ts:487-498, 945-966, 1115` and `src/validation/report.ts:216`
- `src/roadmap/generate.ts:1070, 1917-1925`, `src/roadmap/ladder.ts:93-116`
- `src/ui/surfaces/InventoryPage.tsx:298-309`, `src/ui/surfaces/inventoryTables.ts:57-65`
- Microsoft Learn, read 2026-09-12: [Get authenticationMethodsPolicy (v1.0)](https://learn.microsoft.com/en-us/graph/api/authenticationmethodspolicy-get?view=graph-rest-1.0) and [Get fido2AuthenticationMethodConfiguration (v1.0)](https://learn.microsoft.com/en-us/graph/api/fido2authenticationmethodconfiguration-get?view=graph-rest-1.0)

Policy ids are shortened to their first eight characters; the full ids are in the committed pin. Group, role and location object ids from the author's tenant are left out.

## How a goal counts as delivered
- `PINNED_GOAL_MAP` is the pin's stored `goalMap`, and nothing else (`goalMap.ts:19`). It was built at pin time by `mapGoalsToPolicies` (`goalIdentity.ts:186`), which checks each `data/goals.json` goal against every pinned policy.
- A policy is a candidate only if all of the following hold (`candidates`, `goalIdentity.ts:170-178`):
  - its control kind matches the goal's floor (`controlKindOk`)
  - its user class matches
  - its application class matches the goal's `expectedApps`
  - its conditions are a superset of the goal template's
- A goal with no key in the map is "not in this baseline" (`goalInMap`). It never renders as a step.
- The map has 22 goal keys. None of these four is among them: `azure-management-mfa`, `mobile-app-protection`, `byod-session-controls`, `block-downloads-unmanaged`.
- `absentStepIds()` returns `['azure-management-mfa', 'mobile-app-protection', 'register-info-protected', 'unmanaged-browser']` (asserted at `baselineScope.test.ts:14`).
- The three matching packages record the same absence. Each has `baselineAuthority.pinCommit` = `8461e0f2…` and no source member: `sourceStableId: null` (or `memberStableIds: []`), with the note "The available retained goalMap has no mapped stable policy member for this goal. No source policy GUID is invented."

## (a) MFA for the Windows Azure Service Management API — **No dedicated policy**

The pin has no policy that targets the Windows Azure Service Management API (`797f4846-ba00-4fd7-ba43-dac1f8f63013`) with an MFA grant.

| Pinned policy | State | Target resources | Grant / session | Why it is not the goal |
|---|---|---|---|---|
| `fafaa50c` IAC - ZTCA - GLOBAL – BLOCK – Admin Portal | report-only | Include: `708861da-…`, **`797f4846-…` (Service Management API)**, `MicrosoftAdminPortals`, `fd642066-…`, `ba9ff945-…`. Exclude: `00000002-0000-0000-c000-000000000000`, `0000000c-…`, `1b912ec3-…`, `8c59ead7-…`. Users: All, minus three exclusion groups (one is `{exclusionsGroup}`) and service-provider guests. | `block` (OR); no session | The only pinned reference to the API, and it is a **block**, not MFA. It is mapped to `admin-portals-protected`. |
| `ab659968` IAC - GLOBAL - GRANT - MFA - WindowsAzureAD-BaselineScopes | report-only | `00000002-0000-0000-c000-000000000000` (Windows Azure Active Directory); users All | Custom strength "Modern MFA + TAP" | Wrong resource. `baselineScope.test.ts:11` says so: "targets the Windows Azure AD app, not the Service Management API". |
| `a66e8427` IAC - GLOBAL - GRANT - MFA - AllUsers | report-only | Include `All`; exclude `d4ebce55-…` (Intune Enrollment); users All minus three exclusion groups | Built-in `mfa` (OR) | Covers the API only because it covers every resource. The goal's `expectedApps` is `azureManagement`, and an All-resources policy is a different app class, so it maps to `mfa-all-users` instead. |
| `f893f39f` IAC - GLOBAL - GRANT - MFA - AllAdmins | enabled | Include `All`; users: 46 directory roles minus two exclusion groups | Custom strength "Modern MFA + TAP" | Same: All resources, and admins only. Mapped to `admins-phishing-resistant`. |

Also:
- When the pin was cut, one excluded application id on `a66e8427` was removed (`stripped`: `IAC - GLOBAL - GRANT - MFA - AllUsers: 00000012-0000-0000-c000-000000000000`). The strip rule in `pinSource.ts:53-60` drops excluded app ids it does not keep as Microsoft first-party. The removed id is not the Service Management API.
- What IAMAI would look for, from the catalogue entry `azure-management-mfa` in `data/goals.json`:
  - floor `grant: mfa`, `expectedApps: azureManagement`, users All
  - resource `797f4846-ba00-4fd7-ba43-dac1f8f63013`
  - built-in `mfa` (OR)
  - excluded groups `{exclusionsGroup}` and `{serviceAccountsGroup}`

  The package's `baselineAuthority.canonicalSemantics` states the same target and grant.

## (b) Approved-client-app or app-protection grant for iOS/Android — **No**

No pinned policy's `grantControls.builtInControls` contains `approvedApplication` or `compliantApplication` (a full-text search of all 38 policies finds neither string). Every grant control in the pin is one of: `block`, `mfa`, `compliantDevice`, `domainJoinedDevice`, `passwordChange`, `riskRemediation`, or an authentication strength.

Pinned policies that touch iOS/Android or managed devices, none of them an app grant:

| Pinned policy | State | Target resources / conditions | Grant | Relevance |
|---|---|---|---|---|
| `9e21fa64` IAC - GLOBAL - BLOCK - Unsupported Device Platforms | enabled | All resources; platforms include `all`, exclude `android`, `iOS`, `windows`, `macOS` | `block` | Lets iOS and Android through with no grant of its own. Mapped to `block-unsupported-platforms`. |
| `660ab461` IAC - INTUNE - GRANT - RequireCompliantDevice | report-only | All resources; users All minus three exclusion groups; locations All, excluding `AllTrusted`; no platform condition | `compliantDevice` OR `domainJoinedDevice` | A **device** grant that also applies to phones, not an app-protection grant. Mapped to `require-managed-device`. |
| `30a1edce` IAC - GLOBAL - GRANT - MFA-Passkey - UserRegistration | report-only | User action `urn:user:registerdevice`; platforms include `iOS` (exclude `macOS`, `windows`); one included group | Custom strength "Modern MFA + TAP" | Device registration on iOS only; no app condition. |

What IAMAI would look for:
- **Catalogue** (`data/goals.json`, `mobile-app-protection`): floor `grant: compliantApplication`, `expectedApps: all`, users `members`, platforms include `android` and `iOS`, built-in `compliantApplication` (OR).
- **Package** (`baselineAuthority.rule`): "Do not resurrect the retired/read-only approvedApplication grant for a new policy." It also makes Intune App Protection policies a separate prerequisite (`intune.appProtection.prerequisiteState`).
- **Code comment** (`src/coverage/strength.ts:59`): "The approved client app grant retired in early March 2026".

## (c) Session control for unmanaged devices (block downloads / limited access via Defender for Cloud Apps) — **No**

No pinned policy has `sessionControls.cloudAppSecurity` (Defender for Cloud Apps Conditional Access App Control) or `sessionControls.applicationEnforcedRestrictions` (SharePoint/Exchange limited web access). A full-text search for `cloudAppSecurity`, `applicationEnforcedRestrictions`, `mcasConfigured`, `monitorOnly` and `blockDownloads` finds none.

Session controls the pin does contain, none for unmanaged devices:

| Pinned policy | Session control |
|---|---|
| IAC - APP - SESSION - IntuneEnrollment-SIFEveryTime (no id; keyed by name) | `signInFrequency` everyTime on `d4ebce55-…` (Intune Enrollment) |
| `04b969aa` IAC - GLOBAL – SESSION – Admin Persistence (4 Hours) | `signInFrequency` 4 h + `persistentBrowser` never (browser) |
| `ea9459a9` IAC - GLOBAL – SESSION – All Users Persistence (9-12 Hours) | `signInFrequency` 12 h + `persistentBrowser` never (browser) |
| `8bb25c6a` IAC - GLOBAL - SESSION - Windows - TokenProtection | `secureSignInSession`; Windows, mobile apps and desktop clients |
| `a6b3b754` PIM - Reauthentication; `53a8df0b` High-Risk Sign-Ins; `bb6a814e` and `544cd9ef` High-Risk Users | `signInFrequency` everyTime |

The pin blocks unmanaged devices instead of limiting them:

| Pinned policy | State | Target resources / conditions | Grant |
|---|---|---|---|
| `2dd84b12` IAC - ZTCA - INTUNE - BLOCK - AllApps - ExcludeTrustedLocation | report-only | All resources; users All; locations All, excluding `AllTrusted`; device filter **exclude** `device.isCompliant -eq True -or device.trustType -eq "ServerAD" -or device.trustType -eq "Workplace"` | `block` |
| `1f960ec9` IAC - APP - BLOCK - SharePoint-OneDrive-NonTrustedLocations | report-only | `00000003-0000-0ff1-ce00-000000000000` (SharePoint Online); users All; locations All, excluding `AllTrusted` | `block` |

The code agrees: `scripts/walk.mjs:1440` says "this baseline holds no unmanaged-browser policy, so they are blocked".

What IAMAI would look for:
- **Catalogue:** the step `s-goal-unmanaged-browser` merges two goals, `byod-session-controls` and `block-downloads-unmanaged`. Both have floor `session: { appEnforced: true }` with `sessionControls.applicationEnforcedRestrictions` enabled (Office 365), so the catalogue floor is **app-enforced restrictions, not Defender for Cloud Apps**. `block-downloads-unmanaged` adds device filter include `device.isCompliant -ne True -and device.trustType -ne "ServerAD"`.
- **Package** (`baselineAuthority.canonicalSemantics`): only policy B uses Defender for Cloud Apps ("cloudAppSecurity blockDownloads; only when Defender for Cloud Apps dependency is licensed/resolved", binding `license.defenderCloudApps`). Policy A uses `applicationEnforcedRestrictions`.
- **Gap in the matching rule:** `goalIdentity.ts controlKindOk` has no floor for `cloudAppSecurity`. It counts the control only as "has a session control" (`:122`).

## Does the scan read the tenant's authenticationMethodsPolicy for FIDO2 / passkey?

**The scan reads it; the FIDO2 part is displayed but never evaluated.**

**Read**
- Lane 0 config section `authMethodsPolicy` issues `GET https://graph.microsoft.com/v1.0/policies/authenticationMethodsPolicy` (`registry.ts:50`, in `CONFIG_KEYS`, `coreSections.ts:45`).
- The v1.0 body includes `authenticationMethodConfigurations`, and the `Fido2` entry is among them. It carries `state`, `includeTargets`, `excludeTargets`, `isAttestationEnforced`, `keyRestrictions` and `passkeyProfiles`.
- When v1.0 has no `policyMigrationState`, one extra beta call reads just that field: `…/beta/policies/authenticationMethodsPolicy?$select=policyMigrationState` (`collectors.ts:113-132`).

**What reads the FIDO2 entry**

| Reader | What it reads | Effect today |
|---|---|---|
| `validation/rules.ts:945-966` `methodTargeted(ctx, 'Fido2', groupId)` → rule `pilot.passkeyEnabled` | `Fido2.state === 'enabled'`, and `includeTargets` containing the pilot group or `all_users` | **Never runs.** The rule belongs to the `pilotGroup` subject, and `pilotGroupFindings` (`report.ts:216`) has no caller in `src/` or `scripts/`. |
| `ui/surfaces/InventoryPage.tsx:298-309` (Authentication tab) and `inventoryTables.ts:57-65` (CSV) | Every method configuration's `id`, `state` and target names, Fido2 included | Displayed only. |
| `roadmap/generate.ts:1917-1925` | `TemporaryAccessPass` state only | Not FIDO2. |
| `roadmap/ladder.ts:93-116` | `Sms`, `Voice` and `MicrosoftAuthenticator` state, plus `policyMigrationState` | Not FIDO2. |
| `validation/rules.ts:487-498` and `generate.ts:1070` | `policyMigrationState` | Not FIDO2. |

**Not found**
- No code reads `passkeyProfiles`, `isAttestationEnforced`, `keyRestrictions` or `isSelfServiceRegistrationAllowed`.
- The `s-prereq-passkey-settings` package requires the binding `passkey.target.fido2Configuration` (also `authenticator.target.configuration` and `tap.target.configuration`), but nothing in `src/` resolves those names. The step is also never generated (see `steps-inventory.md`).

**Graph permission**
- **What the app asks for:** it declares `Policy.Read.All` for this read (`registry.ts:50`); `Policy.Read.All` is in `GRAPH_SCOPES` (`scopes.ts:14`).
- **Microsoft Learn, `GET /policies/authenticationMethodsPolicy` (v1.0):** least privileged is `Policy.Read.AuthenticationMethod` (delegated and application). `Policy.ReadWrite.AuthenticationMethod` and `Policy.Read.All` are listed as higher privileged. The signed-in user needs Global Reader or Authentication Policy Administrator.
- **So:** the read the scan already makes, which carries the whole Fido2 configuration, needs **no new permission**. `Policy.Read.All` already covers it. The least-privileged alternative would be `Policy.Read.AuthenticationMethod`.
- **Microsoft Learn, `GET /policies/authenticationMethodsPolicy/authenticationMethodConfigurations/fido2` (v1.0):** lists only `Policy.Read.AuthenticationMethod` (least) and `Policy.ReadWrite.AuthenticationMethod`; `Policy.Read.All` is not listed. Roles: Global Reader or Authentication Policy Administrator. Reading that one configuration directly would therefore need `Policy.Read.AuthenticationMethod`, a new read-only scope. It is not needed, because the whole-policy read returns the same object.
- **Role mismatch (from docs, not tested live):** `src/graph/collect/roles.ts:33` names Security Reader as the least role for `Policy.Read.All`. Learn lists only Global Reader and Authentication Policy Administrator for this endpoint. An operator with only Security Reader may be refused this read, and the section would then read as not ok.

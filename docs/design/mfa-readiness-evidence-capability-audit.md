# MFA Readiness — evidence capability audit

Status: capability audit, input to the owner's MFA Readiness design decision. Not a design, not an implementation plan.
Repository state audited: `main` at `dcd3518` (2026-09-10). Microsoft documentation accessed 2026-09-10.

**Labels used throughout**

- **[Repo]** — observed in IAMAI's current code or data model (file references are to `main` at `dcd3518`).
- **[MS]** — stated in first-party Microsoft documentation (source numbers refer to the Source log, §14).
- **[MS?]** — the documentation does not settle it; treated as unconfirmed.
- **[Proposal]** — an engineering proposal from this audit. Not a decision.
- **[Owner]** — an owner/product decision is required.

---

## 1. Executive conclusion

**Verdict: design can proceed, with explicit capability limits.** No active P0 truth defect was found. The current page errs mostly toward *not ready*. Its over-claims are narrow or come from deliberate heuristics that the redesign must decide on (§10).

What IAMAI can know today, in one paragraph:

- IAMAI reads the **methods a person has registered**, both per user and through Microsoft's registration report. It also reads **up to 30 days of interactive sign-in records**, from the beta endpoint, with authentication step details, OS and browser family, client app, and Conditional Access results.
- From those records it can prove, per person, that **a named method was used successfully at a time, from a sign-in on an OS family**.
- It **cannot** prove readiness on a specific physical device unless that device is registered in Entra and IAMAI starts reading the sign-in `deviceId`.
- It **cannot** see anything older than the sign-in retention window. It **does not** keep any per-person history between scans, so it cannot detect today that a strong method disappeared.
- Microsoft's v1.0 APIs have **no "last used" timestamp for a method**. A nullable `lastUsedDateTime` exists only in beta [MS S14].

**The single biggest truth constraint:** *proof is per sign-in, per method, per OS family, and bounded by a 30-day window; registration is only a claim.* A design that treats "registered", "used once" or "used on one platform" as "ready everywhere" will overstate readiness. A design that forgets proof after 30 days, without IAMAI keeping its own history, will understate it.

Most of the valuable new evidence needs **no new Microsoft permission**. It needs implementation work (§6 bucket B) and owner decisions on local history, beta fields, and disclosure (§12). Nothing examined here is worth a new permission today (§6 bucket C).

---

## 2. Current evidence inventory

### 2.1 Delegated scopes IAMAI requests [Repo]

`src/graph/scopes.ts` requests, in one consent:

- `Policy.Read.All`
- `Directory.Read.All`
- `AuditLog.Read.All`
- `RoleManagement.Read.Directory`
- `UserAuthenticationMethod.Read.All`
- `Reports.Read.All`
- `openid`, `profile`, `offline_access`

The words shown to users come from `src/copy/permissions.ts`, rendered on Connect and the How page. The `AuditLog.Read.All` text currently promises "interactive sign-in records for the last 30 days, and the report of which sign-in methods each person has registered."

Effective delegated access is the intersection of these scopes with the signed-in admin's role. For example:

- `appliedConditionalAccessPolicies` is omitted unless the admin holds Global Reader, Security Reader, Security Administrator, or Conditional Access Administrator [MS S28].
- The per-user methods API needs Global Reader, Authentication Administrator, or Privileged Authentication Administrator [MS S11].

### 2.2 Facts read, stored or derived [Repo]

Grain key: **P** = person, **S** = sign-in, **D** = device, **T** = tenant.

| Fact | Source as coded | Code path | Scope | Raw / derived | History | Grain | Can it support a readiness conclusion? |
|---|---|---|---|---|---|---|---|
| Directory users and `signInActivity` | v1.0 `/users?$select=…,signInActivity&$top=999`, all pages | `src/graph/collect/collectors.ts` (users) → `src/derive/sets.ts`, `src/scoring/fromSnapshot.ts` | Directory.Read.All + AuditLog.Read.All | Normalized | Current only | P | Population, yes. "Active" uses `lastSuccessfulSignInDateTime`, falling back to **`lastSignInDateTime`**, which can be a failed attempt. Without P1 the attribute is not requested and nobody counts as active. |
| Who is active | Enabled, a person (not emergency, service, shared or disabled), last sign-in within 90 days | `src/scoring/mfaViability.ts` (`INACTIVE_DAYS`), `src/derive/population.ts`, `src/derive/ladder.ts` | — | Derived | — | P | Yes, as the population. The 90-day activity window is separate from the 30-day proof window. |
| Account kind | Operator decisions (emergency, service); shared-device licence plan or Teams-device-only sign-ins; mailbox-shaped licence; disabled | `src/derive/sets.ts` `accountKinds`, `notPeopleIds`; `src/derive/sharedDevices.ts` | — | Derived | Decisions persist | P | Yes. The one person boundary (Step 2). |
| Registration report | v1.0 `/reports/authenticationMethods/userRegistrationDetails`, no `$select`; P1 only | `collectors.ts` → `mfaViability.ts`, `ladder.ts`, `mfaReadiness.ts`, `roadmap/readiness.ts`, `roadmap/strand.ts` | AuditLog.Read.All | Normalized: `isMfaCapable`, `isMfaRegistered`, `isPasswordlessCapable`, `methodsRegistered[]`, `defaultMfaMethod`, preferred method, `isAdmin` | Current only | P | Yes, as a method-name inventory. No freshness is read; the report lags up to 36 h [MS S5]. |
| Per-user registered methods | v1.0 `/users/{id}/authentication/methods` via `$batch` (20 per batch) | `collectors.ts` (`KIND_BY_TYPE`, 9 types) → `mfaViability.ts`, `ladder.ts`, `validation/rules.ts`, `mapping/serviceAccounts.ts` | UserAuthenticationMethod.Read.All | Normalized and stripped; see detail below | Current only | P (one row per method) | Yes, for which method kinds exist. It cannot tell device-bound from synced passkeys. Types outside the 9 become `other`. A failed inner call gives `'unknown'`. |
| Authenticator app version and platform | `phoneAppVersion`, `deviceTag`, `displayName` on the method | `src/scoring/platform.ts` | UserAuthenticationMethod.Read.All | Derived; platform guessed from version and name | Current only | P/D | Weak. The "current version" is relative to the newest version seen in the tenant. |
| Authentication methods policy | v1.0 `/policies/authenticationMethodsPolicy` | `collectors.ts` → `roadmap/ladder.ts`, `validation/rules.ts` | Policy.Read.All | Raw | Current only | T | Context: which methods the tenant allows. |
| Authentication strengths | v1.0 `/policies/authenticationStrengthPolicies?$expand=combinationConfigurations` | `collectors.ts` → `roadmap/strand.ts` (`strengthSatisfaction`) | Policy.Read.All | Raw | Current only | T | Yes, to test whether a person's *registered* methods can satisfy a strength. Unrecognised combinations give `unknown`. |
| Interactive sign-in rows | **beta** `/auditLogs/signIns?$filter=signInEventTypes/any(t: t eq 'interactiveUser')&$top=200`, no `$select`, newest first; P1 only | `src/graph/collect/laneB.ts`, `laneBCore.ts` (`mapRow`) | AuditLog.Read.All | Raw subset (below) | **Kept up to 30 days** in IndexedDB `signin-rows`; only the gap since the last scan is fetched | S | Base evidence for proof. |
| Per-person sign-in evidence | `aggregate()` / `mfaSuccessOf()` over the cached rows | `laneBCore.ts` → `mfaViability.ts`, `ladder.ts`, `rules.ts`, `strand.ts` | — | Derived: `signInCount`, `lastSignIn`, **one** `lastMfaSuccess {at, method}`, countries | Rebuilt each scan from ≤30 days of rows | P | Partly. Keeps only the latest *named* method, so earlier proof of a different method is lost. |
| Per-policy CA results | `derivePolicyResults()` from `appliedConditionalAccessPolicies[].result` | `laneBCore.ts` → `roadmap/tracking.ts` | AuditLog.Read.All plus the role noted in §2.1 | Derived: counts and user ids per result class, `reportOnlyDated`, `byDay` | Rebuilt from rows; per-policy observations persist in the plan record | Policy × P | Who a policy would fail or interrupt. Not which method, not which platform. |
| Usage and scenario sets | `deriveUsageSignals`, `derive/evidence.ts` (phone sign-ins by person, unjoined computers, password not typed, legacy / device code) | `laneBCore.ts`, `src/derive/evidence.ts` | — | Derived | Rebuilt | Person sets | Context. Phone sign-in counts are used for the rung-3 note. |
| Registered devices and owners | v1.0 `/devices?$select=id,displayName,isCompliant,isManaged,trustType,operatingSystem,approximateLastSignInDateTime&$expand=registeredOwners` | `collectors.ts` → `roadmap/readiness.ts` (device family), `strand.ts` | Directory.Read.All | Raw | Current only | D → P | Device-compliance readiness only. **Never joined to sign-ins or methods.** No Intune endpoint is read. |
| Roles (active, PIM-eligible) | v1.0 `roleAssignments`, `roleEligibilitySchedules` | `collectors.ts` | RoleManagement.Read.Directory | Raw | Current only | P | Admin flag. |
| Licence capabilities | v1.0 `/subscribedSkus` | `src/licensing/capabilities.ts` | Directory.Read.All | Derived | Current only | T | Gates the P1-only reads. If this read fails, P1 reads are *skipped* as licence-gated rather than attempted. |
| Directory audit logs | — | **Not read** | — | — | — | — | — |

**Per-user method row (`AuthMethodSummary`):**

- Kept for every method: `createdDateTime`.
- Authenticator: `displayName`, `phoneAppVersion`, `deviceTag`, `platform`.
- fido2/passkey: `displayName`, `model`.
- phone: `phoneType`.
- Temporary Access Pass: `isUsable`.
- **Not kept:** `aaGuid`, `passkeyType`, `attestationLevel`, Windows Hello `keyStrength` or device.
- `platformCredential`, `x509Certificate` and hardware OATH become kind `other`.

**Sign-in row as stored (`mapRow`):**

- Kept: `createdDateTime`, `userId`, `status` (whole), `authenticationRequirement`, `mfaDetail` (whole), `authenticationDetails` (whole, but only `succeeded` and `authenticationMethod` are read), `conditionalAccessStatus`, `appliedConditionalAccessPolicies` (`id`, `displayName`, `result` only), `clientAppUsed`, `appId`, `appDisplayName`, `resourceDisplayName`, `authenticationProtocol`, `originalTransferMethod`, country, risk, cross-tenant fields.
- From `deviceDetail`, kept: normalized `operatingSystem`, browser family, `isCompliant`, `isManaged`, `trustType`.
- **Not kept or read:** `deviceDetail.deviceId`, `deviceDetail.displayName`, `isInteractive`, `authenticationMethodsUsed`, `enforcedGrantControls`, `authenticationStrength`.

### 2.3 What IAMAI calls "MFA proven" today [Repo]

`src/graph/collect/laneBCore.ts` `mfaSuccessOf`:

1. A row counts only if `status.errorCode === 0`.
2. The method is `mfaDetail.authMethod`, or else the **first** succeeded `authenticationDetails` step that is not `Password` or `Previously satisfied`.
3. If `authenticationRequirement === 'multiFactorAuthentication'`, the result is that method, or the generic `'MFA'` when none is named.
4. **If the requirement is not MFA but a non-password step is named, the row still counts.**

`aggregate()` then keeps one latest named method per person, or the latest generic record if no row named a method.

`src/derive/ladder.ts` `rungOf` places each person on a rung:

| Rung | Rule |
|---|---|
| 3 | Windows Hello for Business or certificate and no portable method. **Records ignored.** |
| 5 | A portable passkey or FIDO2 key registered **and** the latest named method matches `/passkey\|fido\|security key\|certificate\|x509/i`. |
| 4 | A portable method registered **and** the latest named method matches the Authenticator pattern or the rung-5 pattern. |
| 2 | Any MFA-capable method. |
| 1 | None. |

The Plan's MFA/guest readiness (`src/roadmap/readiness.ts` `mfaReady`) counts an active person as ready when `mfa` is `verified` **or** `likelyViable`.

`likelyViable` (`src/scoring/mfaViability.ts`) comes from metadata alone:

- an Authenticator app version within 3 releases of the newest seen in the tenant;
- any capable method registered within 30 days;
- a Windows Hello device active within 30 days. This rule reads `deviceLastSignIn`, which the collector never sets, so it cannot fire on a real scan.

Admin readiness is rung 5 only.

### 2.4 What persists between scans [Repo]

IndexedDB `iamai` (`src/graph/collect/cache.ts`):

| Store | What it holds | Across scans |
|---|---|---|
| `snapshot` | The whole snapshot: methods, registration report, sign-in evidence | **Replaced** by each successful scan; no previous copy. |
| `signin-rows` + `evidence-meta` | Raw sign-in rows and the window they cover | Yes, trimmed to 30 days; gap-fetched. |
| `plan` | Decisions and **per-policy-member observations** (not per person) | Yes |
| `mapping` | Operator decisions, including emergency and service accounts | Yes |
| `group-members`, `baseline` | Group memberships; the chosen baseline | Yes |

**No per-person method inventory or proof is kept across scans, and nothing compares methods between two scans.** Forget this tenant deletes all stores.

---

## 3. Capability matrix

Classification:

- **SUP-D** — supported by direct evidence
- **SUP-X** — supported, derivable from existing evidence
- **PARTIAL** — useful but insufficient
- **HUMAN** — needs human validation
- **NEW READ** — needs a new read
- **UNKNOWABLE** — not reliably knowable

| Concept | Class | Basis |
|---|---|---|
| **Method capability:** can the person satisfy the target strength with a currently registered method? | **SUP-X** | [Repo] per-user methods + registration report + strength combinations (`strengthSatisfaction`). Limits: v1.0 hides hardware OATH and security questions [MS S12]; IAMAI collapses `platformCredential`, x509 and hardware OATH to `other`; the report lags up to 36 h [MS S5]. "Allowed by policy" is in `isMfaCapable` / `isPasswordlessCapable` [MS S1]. |
| **Proof of use:** has IAMAI seen a qualifying method succeed? | **SUP-X, but only within the sign-in window** | [Repo] succeeded `authenticationDetails` steps on interactive sign-ins (beta). [MS S27, S30] authentication details are beta-only. [MS?] Method strings for passkey and Windows Hello are not documented, so matching them is a heuristic. [MS S35] details can be incomplete until aggregated. Today's code keeps only the latest named method; a per-method map is derivable from the cached rows. |
| **Platform/workflow coverage:** proof on each platform/workflow the person uses | **PARTIAL** | [Repo] Each row has an OS family, browser family, `clientAppUsed`, `appDisplayName`/`appId` and `authenticationProtocol`, so person × OS family × method × success is derivable for **interactive** sign-ins in the window. Missing: non-interactive sign-ins (beta filter, new call, often empty authentication details [MS S29]). Workflows (device registration, Intune enrolment) are only identifiable by app or resource name, which is unconfirmed. |
| **Device/client viability:** can a known device/platform/client support the method? | **PARTIAL (platform level) / NEW READ (device level)** | [Repo] Platform level: yes, from observed successes. Device level: `deviceDetail.deviceId` is returned but not read, and is filled only for Entra-registered devices [MS S31]. For push approvals, the sign-in's device is where the person signed in, **not the phone that approved**. Beta `authenticationAppDeviceDetails` exists [MS S27] but its contents are unconfirmed. |
| **Credential continuity:** a strong method disappeared or was replaced | **NEW READ / engineering (history)** | [Repo] No history today. [MS] No history API; audit logs record "User deleted security info" and Device Registration Service "Delete Passkey (device-bound)" / "Delete Windows Hello for Business credential" [MS S41], kept 30 days on P1/P2 [MS S32]. Beyond 30 days only IAMAI's own stored inventories could show loss. Method ids and `createdDateTime` exist in v1.0 [MS S13], so replacement (new id, new date) is detectable scan to scan. |
| **Resilience:** a single fragile path | **SUP-X (structure) + HUMAN (sufficiency)** | [Repo] Registered methods by kind and portability, TAP `isUsable` [MS S23], SSPR capability [MS S1]. Counting portable phishing-resistant or MFA methods and a TAP is derivable; for example "only strong method is one device-bound credential" (needs `passkeyType` [MS S15]). Whether a fallback is really usable after device loss needs a human. [MS] documents TAP as the recovery aid [S53]; no "recovery path" field exists. |
| **Evidence freshness:** is the evidence recent? | **SUP-X (as an age) / UNKNOWABLE (as validity)** | The age of the last proof is derivable. [MS] documents no expiry of proof. A universal threshold would be invented. The honest output is "last seen N days ago, within a window that covers M days". |
| **Unknown vs not ready:** "not observed" vs "observed not ready" | **SUP-X for the tenant, PARTIAL for the person** | [Repo] Source status (`ok`, `partial`, `insufficient`, `disabled`, licence-gated) and the covered window exist. The per-user `'unknown'` for methods exists but is not surfaced. Sign-in evidence `insufficient`/`disabled` currently becomes rung 2 or 0% rather than unknown (§10). No per-user "records may be incomplete" flag under `partial`. |
| **Enforcement: safe preparation** | **SUP-X** | Report-only creation affects nobody. Registration and methods show who has *something* to set up. |
| **Enforcement: controlled validation** | **PARTIAL** | [Repo] Report-only results per person per policy exist. [MS S38] **Report-only never prompts for MFA**, so a quiet report-only MFA grant proves nothing about whether people can complete MFA. Policies scoped to User Actions cannot be evaluated in report-only. |
| **Enforcement readiness** | **PARTIAL + HUMAN** | Needs per-person proof of the *target* method class on the platforms observed, within the window, plus human validation for workflows and devices not observed. Today's gate conflates registration with proof (§10). |

---

## 4. Person × platform/workflow feasibility

| Axis | Populated today? | Observed or inferred | Notes |
|---|---|---|---|
| Person (`userId`) | Yes | Observed | Stable join key across users, methods and sign-ins [Repo]. |
| OS family (Windows, macOS, iOS, Android, Linux, ChromeOS) | Yes, per sign-in | Observed (normalized string) | From `deviceDetail.operatingSystem` [Repo][MS S31]. |
| Browser family / client app | Yes, per sign-in | Observed | `browser`, `clientAppUsed` [Repo]. |
| Workflow (device registration, Intune enrolment, admin portals, device code) | Partly | Observed app/resource names; the mapping is inferred | `appDisplayName`, `resourceDisplayName`, `authenticationProtocol` are stored [Repo]. Treating a given app as "the device registration workflow" is an inference. [MS?] |
| Physical device | **No** | — | `deviceId` is not read [Repo]. It is filled only for Entra-registered devices [MS S31]; unregistered phones and PCs have an empty `deviceId` [MS S28]. |
| Method used | Yes, per sign-in (latest only per person today) | Observed string; the class mapping is inferred | [MS?] undocumented method strings for passkey and Windows Hello. |
| Success / failure | Yes | Observed | `status.errorCode`, `authenticationDetails[].succeeded` [Repo]. |

**Answers to the audit's questions:**

- **Axes IAMAI can populate today** (from already-cached rows, with derivation work only): person × OS family × browser/client × method used × success × time.
- **What is observed vs inferred:** success, method string, OS and client are observed. Method class (phishing-resistant, Authenticator), workflow identity and "same device" are inferred.
- **Can a sign-in be tied to a device strongly enough to call it "proven"?** Only at **OS-family level**. Device level needs the sign-in `deviceId` joined to `/devices.deviceId` [MS S29, S43; the join key is unconfirmed but consistent in Microsoft's examples], and works only for registered devices.
- **Several devices on one platform:** they collapse into one OS family. Registered devices could be told apart by `deviceId`/`displayName` if read; personal unregistered devices cannot be.
- **Stable identifiers:** `userId`; method `id` (per registration); device `deviceId` (registered devices only). OS strings are not identities.
- **Important cases that collapse:**
  - An Authenticator push approved on an iPhone during a Windows browser sign-in is recorded as **Windows**. The phone that approved is not the sign-in device.
  - Two iPhones look like one "iOS".
  - A synced passkey used on a Mac and one used on an iPhone are both "passkey" with different OS families.
  - Windows Hello on PC A and PC B are both "Windows Hello for Business" on "Windows".
- **What would be misleading as device-specific proof:** "proven on this iPhone", "this laptop is ready", or "passkey works on her phone" when the evidence is an OS-family string. **Current data supports platform-level (OS family) and coarse workflow-level proof only.**

---

## 5. Historical continuity

| Question | Today | Minimum needed [Proposal] |
|---|---|---|
| Method present on scan A, absent on scan B | **No.** The snapshot is replaced. | Per person, per complete scan: the method `id`, type, `createdDateTime`, plus `passkeyType`/`aaGuid` for fido2, `deviceTag`/`displayName` for Authenticator, `displayName` for Windows Hello, stored locally with the scan time and a per-person read-completeness flag. |
| Strong-method count went down | No | Same inventory; a count by class per scan. |
| A passkey/FIDO2 credential disappeared | No | Same inventory. Corroboration inside 30 days: audit "Delete Passkey (device-bound)" / "User deleted security info" [MS S41]. |
| An Authenticator registration disappeared | No | Same inventory. Audit "Delete passwordless phone sign-in credential" [MS S41] covers the passwordless case only. |
| A person went from qualifying to non-qualifying | No | The capability result per scan (derivable from the inventory and strengths). |
| Last observed successful qualifying sign-in | **Partly.** Within 30 days, and only the *latest named* method. | A per-person, per-method-class last-success date, carried forward past the 30-day raw window by IAMAI's own record. |
| Last observed proof per platform/workflow | No | Per person × method class × OS family, the last success date, carried forward. |
| A proven state no longer backed by current registration | No. `rolloutBucket` counts "proven" whenever evidence exists, without checking the method is still registered [Repo]. | Join the carried-forward proof to the current inventory by method class, or method id where the sign-in names it. [MS?] Sign-ins don't carry a method id, so it is a class-level join. |
| A new device/platform appeared with no proof | No | Observed OS families per person over time (from rows); device level needs `deviceId` for registered devices. |

**Hard constraints:**

- Sign-in and audit retention is 30 days on P1/P2 and 7 days on Free [MS S32]. Any continuity past that window exists only if IAMAI keeps its own history.
- A failed or partial read must never be recorded as disappearance. This repeats the lesson of task 043 on rescan durability; IAMAI already keeps read-completeness at source level.
- How long local history is kept is **[Owner]**. No retention window is proposed here.

---

## 6. Permission delta

### A. Already available with current reads and scopes (no change)

- Users and `signInActivity`; the registration report; per-user methods (as currently stripped); the methods policy; authentication strengths.
- Beta interactive sign-ins, including authentication steps, requirement, MFA detail, CA results, OS/browser/client, compliance and trust.
- Devices with registered owners; roles; SKUs.
- Proof, platform and scenario sets derived from those.

### B. New read or field, covered by permissions IAMAI already has (implementation only)

Unless noted, these need no new tenant call: the data is already returned or already cached and only IAMAI's handling changes.

| Item | Permission already held | Evidence gained |
|---|---|---|
| A per-method last-success map (not one slot) from cached rows | — (already in IndexedDB) | Proof per method class; no longer loses earlier passkey proof. |
| A per-person × OS-family × method-class proof table from cached rows | — | Platform-level coverage. |
| A single-factor vs MFA requirement flag on proof (`authenticationRequirement`, `authenticationStepRequirement`) | — (already stored) | Stops counting single-factor rows as MFA proof. |
| Read `deviceDetail.deviceId` / `displayName` from rows; join to `/devices.deviceId` | AuditLog.Read.All, Directory.Read.All | Device-level proof for **registered** devices only [MS S31]. |
| Keep fido2 `aaGuid`, `passkeyType`, `attestationLevel`; map `platformCredential`, x509, hardware OATH | UserAuthenticationMethod.Read.All | Device-bound vs synced; Authenticator passkey by AAGUID [MS S15, S52]; macOS platform credential [MS S19]. |
| Keep `appliedConditionalAccessPolicies[].enforcedGrantControls` (v1.0) and beta `authenticationStrength` result | AuditLog.Read.All plus admin role | Which strength a sign-in faced and whether it was satisfied. [MS?] the beta strength object may cover custom strengths only [S49]. |
| Beta `/users/{id}/authentication/methods` for `lastUsedDateTime` | UserAuthenticationMethod.Read.All | A last-used date where Microsoft fills it (nullable, beta, "not supported" in production) [MS S14, S4]. |
| Non-interactive sign-ins (beta `signInEventTypes` `nonInteractiveUser`) | AuditLog.Read.All | Usage breadth. Weak proof: authentication details are often empty [MS S29]. Large volume. |
| Directory audit logs filtered to "Authentication Methods" and "Device Registration Service" | AuditLog.Read.All | Method registered/deleted events within 30 days [MS S41]. [MS?] The List page names Reports Reader, Security Administrator and Security Reader, not Global Reader [S40]. Verify before relying on a Global Reader sign-in. |
| Beta `userEventsSummary` (registration events per user) | [MS?] permission not confirmed | Registration and reset events with success/failure [MS S10]. |
| Windows Hello / Authenticator / platform-credential `device` via `$expand` on single GETs | UserAuthenticationMethod.Read.All | Method-to-device link. A per-method GET is expensive; Microsoft advises against whole-population scans with the methods API [MS S12]. |
| Locally stored per-person method inventory and proof across scans | — (no tenant read) | Continuity (§5). **[Owner]** on storage and retention. |

**Trust note:** adding audit logs, non-interactive sign-ins or beta method fields under an existing scope changes what the disclosure text promises. For example, today's `AuditLog.Read.All` wording names only interactive sign-ins and the registration report. That is a disclosure update even though consent does not change. **[Owner]**

### C. New delegated permission or materially broader access

| Permission | Evidence unlocked | Why it would matter | Lower-privilege alternative | Worth considering? | Trust impact |
|---|---|---|---|---|---|
| `DeviceManagementManagedDevices.Read.All` (Intune `managedDevice`) [MS S45, S46] | `complianceState`, `lastSyncDateTime`, `managedDeviceOwnerType`, `enrolledDateTime`, `azureADDeviceId`, `userId` | Ties an enrolled device to a person with sync recency | `device.isCompliant` / `isManaged` / `registeredOwners` via the existing `Directory.Read.All`; only Intune or MDM sets those flags [MS S42] | **No, for readiness.** It adds device-management detail, not authentication proof, and requires an Intune licence. | A new consent row and a broader read of device-management data. |

No other readiness evidence examined here needs a scope IAMAI does not already hold. `Device.Read.All` and `Policy.Read.AuthenticationMethod` are *lower* than the scopes already held [MS S43, S48].

---

## 7. Unsafe inferences — conclusions IAMAI must not make

General:

1. A registered method is a proven working method.
2. One successful sign-in means every device is ready.
3. A passkey exists, so it works on every platform. A device-bound passkey is not usable from another device; a synced passkey is limited to its ecosystem [MS S15 `passkeyType`].
4. No recent failure means ready.
5. No observed workflow means the workflow does not exist (e.g. device registration or a mobile app never seen in 30 days).
6. A quiet report-only period means enforcement is safe. **Report-only never prompts for MFA** [MS S38].
7. One strong method means resilience after device loss.
8. A sign-in platform string is a physical device identity.
9. A method registered once is still available now. It must be read from the current inventory; stale entries can also outlive a lost device [MS S53].
10. Absence of history means failure.
11. Old proof is permanently valid. Equally: proof older than the retention window is not evidence of failure.

Specific to this repo and API:

12. **A metadata-only `likelyViable` is readiness.** A current Authenticator version, a method registered within 30 days, or an active Windows Hello device is not proof [Repo `mfaViability.ts`].
13. **A generic "MFA" record proves a method class.** The repo already refuses this for rungs; keep it that way.
14. **The latest named method is the only method proven.** Earlier passkey proof must not be forgotten because Authenticator was used later [Repo `laneBCore.ts aggregate`].
15. **A certificate sign-in proves a portable passkey** [Repo `ladder.ts` regex includes `certificate|x509`].
16. **A named non-password step on a single-factor sign-in proves MFA** [Repo `mfaSuccessOf`]. Also, `authenticationRequirement` "doesn't account for previously satisfied claims" [MS S27].
17. **The OS of a push-approved sign-in is the Authenticator phone's OS.**
18. **`lastSignInDateTime` means the person is active.** It includes failed interactive attempts [MS S34; Repo fallback].
19. **The registration report's `lastUpdatedDateTime` is a registration time.** It is the report refresh time [MS S1, S5].
20. **A person missing from a failed methods batch has no methods.** It is unknown [Repo `'unknown'`].
21. **Disabled users missing from the registration report have no methods.** The report excludes disabled users [MS S2].
22. **Sign-in evidence `partial` is complete for every person.**
23. **An unreadable sign-in source is a measured 0% ready.** It is unknown.
24. **An empty `authenticationDetails` on a non-interactive sign-in means no MFA** [MS S29].
25. **Windows Hello "CA Not Applied" in a sign-in means no policy applies to that person** [MS S35].
26. **A tenant-wide readiness percentage describes a step's own reach** [Repo `generate.ts` family cache vs `stepMfaHold`].
27. **A usable TAP guarantees recovery.** One TAP per user, time-limited [MS S53].

---

## 8. Minimal proposed evidence contract [Proposal]

A small set of fields that answer two questions: *Can this person satisfy the intended requirement where IAMAI has evidence they need to?* and *What still needs proof, setup or human validation?* Not a UI and not a decision.

| Semantic field | Source | Grain | Direct / derived | Confidence and limits | Available now? | New read / permission? | User-visible? | Example of a truthful conclusion |
|---|---|---|---|---|---|---|---|---|
| `inScopePerson` | Users + `accountKinds` + activity | P | Derived | Activity falls back to possibly-failed `lastSignInDateTime`; nobody is active without P1 | Yes | No | Yes (counts) | "30 active people are in scope." |
| `registeredMethods[] {class, portability, createdAt, id}` | Per-user methods (+ registration report) | P (per method) | Direct | No last-used in v1.0; device-bound vs synced needs `passkeyType` (B); hardware OATH hidden in v1.0 | Partly (class yes; portability partly) | B only | Yes (as the method held) | "Has a device-bound passkey and the Authenticator app registered." |
| `canSatisfy(requirement)` | `registeredMethods` + strength combinations | P × requirement | Derived | Only as good as the method mapping; `unknown` when unmapped | Yes | No | Yes | "Holds a method the Phishing-resistant MFA strength accepts." |
| `proof[] {methodClass, osFamily, client, lastSucceededAt, requirementWasMfa}` | Cached interactive sign-in rows | P × method class × OS family | Derived | ≤30 days unless carried forward; method strings heuristic; OS is the sign-in device, not the approver phone; interactive only | Data yes; derivation no (today one slot) | B only | Yes | "Signed in with a passkey from Windows 3 days ago; no passkey sign-in seen from iOS in the last 30 days." |
| `observedPlatforms[] {osFamily, lastSeenAt}` | Cached sign-in rows | P × OS family | Derived | Interactive only; window-bounded | Yes (data) | B only | Yes | "Signs in from Windows and iOS." |
| `proofGap[] {osFamily or workflow, requirement}` | `observedPlatforms` − `proof` for the target class | P × OS family | Derived | Absence within the window is "not observed", never "failed" | No | B only | Yes | "No passkey proof yet from iOS, where this person signs in." |
| `evidenceCoverage {methodsRead, signInsStatus, windowFrom, windowTo, licence}` | Source statuses + per-user `'unknown'` | T and P | Direct | `partial` does not say which people were affected | Partly | No | Yes (as a limit) | "Sign-in records cover Aug 11 – Sep 10; this person's methods could not be read." |
| `continuity {lastQualifyingAt, lostStrongMethodsSince[]}` | IAMAI's own stored inventories + proof (+ audit events ≤30 d) | P | Derived | Only from the first stored scan onward; a read gap is never loss | No | Storage (B); audit read optional (B) | Yes | "A device-bound passkey registered on Jul 2 is no longer registered as of this scan." |
| `recoverySignals {portableStrongCount, tapUsable, ssprCapable}` | Methods + registration report | P | Derived | Structure only; whether a fallback really works needs a human | Partly | B for portability | Yes, framed as needing validation | "Only strong method is one device-bound passkey; no usable Temporary Access Pass." |
| `policyObservation {policyId, result classes}` | CA results in sign-ins | Policy × P | Direct | Report-only never prompts MFA; User Actions policies not evaluable | Yes | No | Yes (Plan) | "Would have been blocked 3 times by the report-only admin policy." |

Deliberately left out: device-level proof (not reliable for unregistered devices), a universal "fresh" flag (no documented expiry), and a resilience score (no Microsoft basis).

---

## 9. Readiness conclusions the evidence can support [Proposal]

- **Safe preparation:** supported. The per-person capability, proof and evidence coverage above are enough to say who needs setup, who needs proof, and who is unknown.
- **Controlled validation:** partly supported. Per-person proof on the observed OS families plus report-only results. It must state that report-only did not prompt MFA and that workflows not observed stay unvalidated.
- **Enforcement readiness:** supported only as "proof of the target method class on every OS family observed for the person within the window, with evidence coverage OK". Anything outside that is **human validation** or **unknown**. The owner decides whether enforcement may proceed on that basis (§12).

---

## 10. Current MFA Readiness page and logic assessment [Repo]

### 10.1 Population alignment (after Step 2)

The page and the Plan build viability from the same `buildViabilityInputs(snapshot, asOf, notPeopleIds(mapping))` over the same applied mapping. The person boundary (`accountKinds`) and the ledger that sums to all accounts agree.

Remaining differences:

- The Plan's family readiness percentage is computed **once per family, tenant-wide**, while a step's names are its own reach (`stepMfaHold`).
- Exclusions-group members are in the percentage but not in step populations.
- The admin denominator includes **inactive** admins; the page counts active people only.

### 10.2 Trustworthy — retain

- The one person boundary and the account ledger.
- A single rung authority (`ladder.ts`), with groups as views over it.
- An unreadable registration report gives `unknown` on the page and "not measured" (held) on the Plan; neither guesses.
- A generic "MFA" record never implies a method.
- A step's hold reads its own family requirement, and the callout has four explicit states.
- Remediation is keyed only on the group; a guest gets no TAP.

### 10.3 Simplistic or misleading — replace in the redesign

1. **The Plan's MFA 90% gate conflates registration with proof.** `mfaReady` counts metadata-only `likelyViable` (current app version, method registered ≤30 days) as ready (`readiness.ts`). This is a deliberate current rule, not a regression. It is the motivating failure case, and whether it stays is **[Owner]**.
2. **A single `lastMfaSuccess` slot.** A person who proved a passkey and later used Authenticator drops from rung 5 to 4 and is told "needs proof" (pinned by `ladder.test.ts`).
3. **People proven with SMS, voice or OATH are told no record proves them.**
   - These people land on rung 2 ("Set up, not proven"). The rung-2 tip reads: "A method is registered, and no sign-in record names it, so IAMAI cannot prove the person can pass MFA with it" (`content.json` `…tip`).
   - The Require MFA for Everyone step counts them as "have a registered method that no sign-in record proves" (`content.json` step `mfa-all-users`), while the Proof column shows the named SMS sign-in and scoring marks them `verified`.
   - This is a false statement that errs toward *not ready*. It is not a P0: it causes extra work, not a false assurance.
4. **The certificate record in the rung-5 proof regex.** Someone with both a certificate and a passkey, whose latest record was certificate-based, is shown as passkey-proven. This is a narrow over-claim; the certificate itself satisfies phishing-resistant strength on that PC.
5. **Single-factor rows can count as MFA success** (`mfaSuccessOf`). Whether real tenants produce such rows with non-password named steps is unverified.
6. **Unreadable or insufficient sign-in evidence shows as numbers rather than unknown:** rung 2, the admin gate at a measured 0%, and an MFA percentage made only of `likelyViable`.
7. **Per-person unknown is not surfaced:** a failed per-user methods read or a missing registration row falls to "Needs a passkey".
8. **Three different "to set up" counts** across the campaign completion, the print cover, and the manager line.
9. **Activity** uses `lastSignInDateTime` as a fallback (possibly a failed attempt), and without P1 nobody is active.
10. **The admin 100% gate can be blocked by dormant admins** who can never show proof.
11. **The Windows Hello "device recently active" signal cannot fire on real data** (`deviceLastSignIn` is never collected).

### 10.4 Missing but feasible with existing data (no new permission)

- Per-method last-proof dates, and per OS family, from cached rows.
- A single-factor vs MFA flag on proof.
- Per-person "methods unknown" and "proof unknown" states.
- Platform lines per person, from observed OS families and Authenticator method metadata.
- Device-bound vs synced passkey (`passkeyType`) once kept.
- An active/dormant split of admins.

### 10.5 Missing and not currently feasible

- Proof older than the retention window (without IAMAI history).
- Device-level proof on unregistered devices.
- The phone that approved a push.
- Validation of workflows that were never exercised.

### 10.6 P0 assessment

No active P0 truth defect was found. Items 1–7 are recorded for the redesign; item 1 needs an owner decision. Runtime behaviour was not changed in this task.

---

## 11. Gaps requiring engineering [Proposal]

- **Proof derivation:** replace the single proof slot with per-person × method class × OS family last-success, and add the requirement flag and proof-unknown state.
- **Method mapping:** keep `passkeyType`, `aaGuid`, `attestationLevel`; map `platformCredential`, x509 and hardware OATH instead of `other`.
- **Per-person unknown:** surface methods-read failures and a missing registration row as unknown.
- **Local continuity record:** a per-person method inventory and carried-forward proof, recorded only from complete reads.
- **Optional device join:** sign-in `deviceId` → `/devices.deviceId` for registered devices.
- **Optional audit read:** "Authentication Methods" and "Device Registration Service" events (≤30 d), after confirming the Global Reader role question.
- **Consistency:**
  - one "to set up" definition;
  - an evidence-unknown state instead of a measured 0%;
  - fix the rung-2 wording for SMS/voice/OATH-proven people;
  - remove `certificate|x509` from the portable proof regex;
  - retire the dead Windows Hello device signal or collect its input.
- **Licence read failure:** attempt the P1 reads when capabilities are unknown, rather than skipping them as licence-gated.

## 12. Gaps requiring owner/product decision [Owner]

1. **What counts as "ready" for each gate:** proven target method class vs registered vs metadata `likelyViable`. Whether the Plan's 90% MFA gate keeps counting registration signals.
2. **The target requirement per population:** ordinary MFA vs phishing-resistant, for everyone vs admins, and how MFA Readiness relates to each Plan step's own requirement.
3. **Platform proof:** whether platform-level (OS family) proof is acceptable as "proven on iOS", and how to word that it is not device-level.
4. **Local history:** whether to keep per-person method inventories and proof across scans, what to keep, for how long, and how Forget, export and redaction treat it.
5. **Beta sources:** whether to rely on `lastUsedDateTime`, the `authenticationStrength` result, `authenticationAppDeviceDetails`, or non-interactive sign-ins. IAMAI already depends on beta sign-ins.
6. **Audit logs:** whether to read them under the existing `AuditLog.Read.All`, and the disclosure change that follows.
7. **Freshness:** show proof age only; no universal expiry.
8. **Dormant admins:** how they count in the admin readiness gate.
9. **Intune:** confirm no Intune permission.

## 13. Gaps that should remain Unknown

- Readiness on a specific unregistered phone or PC.
- Which phone approved an Authenticator push.
- Whether a synced passkey is available on a device the person has not signed in from.
- Anything before the retention window, unless IAMAI recorded it.
- Whether a person will use a platform or workflow not yet observed.
- Whether a lost device is really lost, or a fallback really works, until a human confirms.
- Whether a report-only MFA policy would have been satisfied, since report-only does not prompt.
- The exact meaning of undocumented method strings in authentication details.

---

## 14. Source log

### Repository (observed at `dcd3518`)

- **Scopes and consent copy:** `src/graph/scopes.ts`; `src/graph/msal.ts`; `src/copy/permissions.ts`; `src/ui/PermissionsDisclosure.tsx`.
- **Collection:** `src/graph/collect/collectors.ts` (users, registration report, per-user methods, devices, roles, policies, strengths); `src/graph/collect/worker.ts` (scan lanes, licence gating); `src/graph/collect/laneB.ts`, `src/graph/collect/laneBCore.ts` (sign-in collection, `mapRow`, `mfaSuccessOf`, `aggregate`, `derivePolicyResults`); `src/graph/collect/registry.ts`; `src/graph/collect/types.ts`; `src/graph/collect/cache.ts` (IndexedDB stores); `src/graph/collect/constants.ts` (window and caps).
- **Scoring and derivation:** `src/scoring/fromSnapshot.ts`, `src/scoring/mfaViability.ts`, `src/scoring/platform.ts`; `src/derive/ladder.ts`, `src/derive/mfaReadiness.ts`, `src/derive/stepMfaReadiness.ts`, `src/derive/population.ts`, `src/derive/sets.ts`, `src/derive/sharedDevices.ts`, `src/derive/evidence.ts`, `src/derive/facts.ts`.
- **Plan:** `src/roadmap/readiness.ts` (`mfaReady`, `adminReady`, `readinessFor`), `src/roadmap/generate.ts` (readiness gate, family cache), `src/roadmap/strand.ts` (`strengthSatisfaction`), `src/roadmap/tracking.ts`, `src/roadmap/observation.ts`.
- **Surfaces and copy:** `src/ui/surfaces/MfaReadiness.tsx`, `src/ui/surfaces/readinessCells.ts`, `src/content/methodGuides.ts`, `docs/design/content.json` (rung-2 tip; Require MFA for Everyone who lines).
- **Tests that pin current behaviour:** `src/derive/ladder.test.ts`, `src/derive/mfaProof.test.ts`, `src/derive/mfaReadiness.test.ts`, `src/derive/mfaReadinessSurface.test.ts`, `src/ui/surfaces/readinessAnatomy.test.ts`, `src/scoring/mfaViability.test.ts`, `src/roadmap/readinessGate.test.ts`, `src/semanticIntegrity.test.ts` (042.9, 042.10).

### Microsoft first-party documentation (accessed 2026-09-10)

- S1 userRegistrationDetails resource (v1.0) — https://learn.microsoft.com/en-us/graph/api/resources/userregistrationdetails?view=graph-rest-1.0
- S2 List userRegistrationDetails (v1.0) — https://learn.microsoft.com/en-us/graph/api/authenticationmethodsroot-list-userregistrationdetails?view=graph-rest-1.0
- S3 authenticationMethodsRoot (v1.0) — https://learn.microsoft.com/en-us/graph/api/resources/authenticationmethodsroot?view=graph-rest-1.0
- S4 authenticationMethodsRoot (beta) — https://learn.microsoft.com/en-us/graph/api/resources/authenticationmethodsroot?view=graph-rest-beta
- S5 Authentication Methods Activity — https://learn.microsoft.com/en-us/entra/identity/authentication/howto-authentication-methods-activity
- S6 Authentication methods usage report API overview (beta) — https://learn.microsoft.com/en-us/graph/api/resources/authenticationmethods-usage-insights-overview?view=graph-rest-beta
- S7 userRegistrationDetails (beta) — https://learn.microsoft.com/en-us/graph/api/resources/userregistrationdetails?view=graph-rest-beta
- S8 usersRegisteredByMethod (beta) — https://learn.microsoft.com/en-us/graph/api/authenticationmethodsroot-usersregisteredbymethod?view=graph-rest-beta
- S9 userMfaSignInSummary (beta) — https://learn.microsoft.com/en-us/graph/api/resources/usermfasigninsummary?view=graph-rest-beta
- S10 userEventsSummary (beta) — https://learn.microsoft.com/en-us/graph/api/resources/usereventssummary?view=graph-rest-beta
- S11 List methods (v1.0) — https://learn.microsoft.com/en-us/graph/api/authentication-list-methods?view=graph-rest-1.0
- S12 Authentication methods API overview (v1.0) — https://learn.microsoft.com/en-us/graph/api/resources/authenticationmethods-overview?view=graph-rest-1.0
- S13 authenticationMethod (v1.0) — https://learn.microsoft.com/en-us/graph/api/resources/authenticationmethod?view=graph-rest-1.0
- S14 authenticationMethod (beta) — https://learn.microsoft.com/en-us/graph/api/resources/authenticationmethod?view=graph-rest-beta
- S15 fido2AuthenticationMethod (v1.0) — https://learn.microsoft.com/en-us/graph/api/resources/fido2authenticationmethod?view=graph-rest-1.0
- S16 fido2AuthenticationMethod (beta) — https://learn.microsoft.com/en-us/graph/api/resources/fido2authenticationmethod?view=graph-rest-beta
- S17 windowsHelloForBusinessAuthenticationMethod (v1.0) — https://learn.microsoft.com/en-us/graph/api/resources/windowshelloforbusinessauthenticationmethod?view=graph-rest-1.0
- S18 microsoftAuthenticatorAuthenticationMethod (v1.0) — https://learn.microsoft.com/en-us/graph/api/resources/microsoftauthenticatorauthenticationmethod?view=graph-rest-1.0
- S19 platformCredentialAuthenticationMethod (v1.0) — https://learn.microsoft.com/en-us/graph/api/resources/platformcredentialauthenticationmethod?view=graph-rest-1.0
- S20 windowsHelloForBusinessAuthenticationMethod (beta) — https://learn.microsoft.com/en-us/graph/api/resources/windowshelloforbusinessauthenticationmethod?view=graph-rest-beta
- S21 microsoftAuthenticatorAuthenticationMethod (beta) — https://learn.microsoft.com/en-us/graph/api/resources/microsoftauthenticatorauthenticationmethod?view=graph-rest-beta
- S22 phoneAuthenticationMethod (v1.0) — https://learn.microsoft.com/en-us/graph/api/resources/phoneauthenticationmethod?view=graph-rest-1.0
- S23 temporaryAccessPassAuthenticationMethod (v1.0) — https://learn.microsoft.com/en-us/graph/api/resources/temporaryaccesspassauthenticationmethod?view=graph-rest-1.0
- S24 softwareOathAuthenticationMethod (v1.0) — https://learn.microsoft.com/en-us/graph/api/resources/softwareoathauthenticationmethod?view=graph-rest-1.0
- S25 emailAuthenticationMethod (v1.0) — https://learn.microsoft.com/en-us/graph/api/resources/emailauthenticationmethod?view=graph-rest-1.0
- S26 signIn resource (v1.0) — https://learn.microsoft.com/en-us/graph/api/resources/signin?view=graph-rest-1.0
- S27 signIn resource (beta) — https://learn.microsoft.com/en-us/graph/api/resources/signin?view=graph-rest-beta
- S28 List signIns (v1.0) — https://learn.microsoft.com/en-us/graph/api/signin-list?view=graph-rest-1.0
- S29 List signIns (beta) — https://learn.microsoft.com/en-us/graph/api/signin-list?view=graph-rest-beta
- S30 authenticationDetail (beta) — https://learn.microsoft.com/en-us/graph/api/resources/authenticationdetail?view=graph-rest-beta
- S31 deviceDetail (v1.0) — https://learn.microsoft.com/en-us/graph/api/resources/devicedetail?view=graph-rest-1.0
- S32 Microsoft Entra data retention — https://learn.microsoft.com/en-us/entra/identity/monitoring-health/reference-reports-data-retention
- S33 Log latency for Microsoft Entra ID — https://learn.microsoft.com/en-us/entra/identity/monitoring-health/reference-log-latency
- S34 signInActivity (v1.0) — https://learn.microsoft.com/en-us/graph/api/resources/signinactivity?view=graph-rest-1.0
- S35 Sign-in log activity details — https://learn.microsoft.com/en-us/entra/identity/monitoring-health/concept-sign-in-log-activity-details
- S36 appliedConditionalAccessPolicy (v1.0) — https://learn.microsoft.com/en-us/graph/api/resources/appliedconditionalaccesspolicy?view=graph-rest-1.0
- S37 appliedConditionalAccessPolicy (beta) — https://learn.microsoft.com/en-us/graph/api/resources/appliedconditionalaccesspolicy?view=graph-rest-beta
- S38 Conditional Access report-only insights — https://learn.microsoft.com/en-us/entra/identity/conditional-access/concept-conditional-access-report-only
- S39 directoryAudit (v1.0) — https://learn.microsoft.com/en-us/graph/api/resources/directoryaudit?view=graph-rest-1.0
- S40 List directoryAudits (v1.0) — https://learn.microsoft.com/en-us/graph/api/directoryaudit-list?view=graph-rest-1.0
- S41 Microsoft Entra audit log activity reference — https://learn.microsoft.com/en-us/entra/identity/monitoring-health/reference-audit-activities
- S42 device resource (v1.0) — https://learn.microsoft.com/en-us/graph/api/resources/device?view=graph-rest-1.0
- S43 List devices (v1.0) — https://learn.microsoft.com/en-us/graph/api/device-list?view=graph-rest-1.0
- S44 List registeredDevices (v1.0) — https://learn.microsoft.com/en-us/graph/api/user-list-registereddevices?view=graph-rest-1.0
- S45 managedDevice resource (Intune, v1.0) — https://learn.microsoft.com/en-us/graph/api/resources/intune-devices-manageddevice?view=graph-rest-1.0
- S46 List managedDevices (Intune, v1.0) — https://learn.microsoft.com/en-us/graph/api/intune-devices-manageddevice-list?view=graph-rest-1.0
- S47 authenticationStrengthPolicy (v1.0) — https://learn.microsoft.com/en-us/graph/api/resources/authenticationstrengthpolicy?view=graph-rest-1.0
- S48 List authenticationStrengthPolicies (v1.0) — https://learn.microsoft.com/en-us/graph/api/authenticationstrengthroot-list-policies?view=graph-rest-1.0
- S49 authenticationStrength (beta) — https://learn.microsoft.com/en-us/graph/api/resources/authenticationstrength?view=graph-rest-beta
- S50 How authentication strengths work in Conditional Access — https://learn.microsoft.com/en-us/entra/identity/authentication/concept-authentication-strength-how-it-works
- S51 Troubleshoot authentication strengths — https://learn.microsoft.com/en-us/entra/identity/authentication/troubleshoot-authentication-strengths
- S52 Enable passkeys in Authenticator — https://learn.microsoft.com/en-us/entra/identity/authentication/how-to-enable-authenticator-passkey
- S53 Configure a Temporary Access Pass — https://learn.microsoft.com/en-us/entra/identity/authentication/howto-authentication-temporary-access-pass

**Unconfirmed in documentation (flagged [MS?] above):**

- The sign-in `deviceId` ↔ `/devices.deviceId` join key (consistent in examples only).
- Method strings for passkeys and Windows Hello in authentication details.
- Whether Global Reader can list directory audits through Graph.
- Whether built-in strengths populate the beta `authenticationStrength` result.
- The contents of `authenticationAppDeviceDetails`.
- The refresh cadence of beta aggregate reports.
- Numeric sign-in and audit API latency.

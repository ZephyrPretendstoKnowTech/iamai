# MFA Readiness audit: prompt 62 rebuild at 79b66fd8 (2026-09-18)

Read-only. Nothing in the repository was edited. I ran the scenario probes myself with `node`:
- `.scratch/audit-mfa-scenarios.ts`, `audit-mfa-scenarios2.ts` and `audit-mfa-scenarios3.ts` call `personReadiness` and the cell functions directly.
- `.scratch/audit-mfa-perf.ts` times the view and compares the Plan's holds with the page.
- `.scratch/audit-mfa-hold.ts` breaks down who is in a Plan hold.
- `.scratch/audit-plural.ts` checks the words for a count of 1.

I measured the row overflow in the approved v3 pack in the browser at widths 1100 and 800.

Classes: **BUG**: the output is wrong or contradicts an owner decision. **POLISH**: the words, accessibility or layout are wrong while the state is right. **PLAN**: an owner decision or a follow-up is needed.
Priority: P0 = a decision is violated for common real-tenant data, P1 = wrong output a person will see, P2 = an edge case or inconsistency, P3 = code quality.

---

## P0

### 1. BUG: a personal Windows PC is told to set up Windows Hello for Business
- **Where:** `src/scoring/phishingResistant.ts:464` (unreported join state goes to `best: 'windowsHello'`, `builtIn: true`, `possible: 'unknown'`), with `:600` (firstSetUp) and `:655` (upgrade).
- **Why it happens:** Entra reports `deviceDetail.trustType` as empty for a device that is not registered. `normaliseTrustType('')` (`src/graph/collect/laneBCore.ts:141`) turns that into `null`. So a real contractor's personal PC always has `trust: null`. Any tenant with at least one joined Windows computer has `windowsDirectory === 'joined'`, which is most tenants.
- **Scenario (probe 1):** a contractor on a personal PC holds Authenticator only.
  - State: `method`. Next step: **"Set up Windows Hello for Business"**.
- **Scenario (probe 2):** the same PC, where the person signs in with an Authenticator passkey across devices.
  - State: Ready. Recommended: **"Add Windows Hello for Business on the Windows computer"**.
  - This contradicts two decisions: the device "is never recommended something it cannot have", and contractors are handled.
- **Knock-on effects:**
  - `goalLine` (`readinessCells.ts:94`) treats these PCs as `builtIn`, so it says "Nobody is seamless yet: … Windows Hello on the computer get them there" to a tenant of contractors.
  - The Windows Hello setup check contradicts the rows. See item 9.
- **Why tests pass:** the demo fixture hides this. It gives the contractor `trust: 'registered'` (`src/roadmap/fixtures/index.ts:806`, `:839`), a value a real unregistered PC never reports.
- **Fix:**
  - A Windows device with `trust === null` and no `deviceIds` did not identify itself. Only a registered or joined device does, so treat it as not joined. It then gets the Windows Hello passkey or the fallback.
  - Alternatively, settle it per person: if `ctx.deviceOwners` gives this user no joined Windows device, the computer is personal.
  - Keep `possible: 'unknown'` only where a `deviceId` was reported but the directory read was incomplete.
  - Add a fixture person with `trust: null` and no `deviceIds`.

### 2. BUG: a carried key or a cross-device passkey counts as Seamless
- **Where:** `src/scoring/phishingResistant.ts:479-487`, `seamlessProof` (`return cls === 'passkey'`).
- **The problem:** the sign-in's `passkey` class covers FIDO2 security keys and phone passkeys used across devices. The function never checks that the credential behind the proof is the device's built-in one.
- **Scenarios (probes 3, 9, 19):**
  - An iPhone signed in with a YubiKey over NFC, with no Authenticator passkey held. The iOS chip reads **Seamless** and the state is `seamless`.
  - An unmanaged Mac signed in with a YubiKey. Chip **Seamless**, state `seamless`.
  - A registered personal PC (whose best option is the Windows Hello passkey) signed in with a YubiKey. The chip reads **Seamless**.
- **Decision:** Seamless means the sign-in is built into each device. Here the person carries a key.
- **Fix:** count a passkey proof as seamless only when the person holds a credential of the matching model:

| Best option | Credential that makes the proof seamless |
| --- | --- |
| `authenticatorPasskey` | a credential whose AAGUID is in `AUTHENTICATOR_AAGUIDS` |
| `windowsHelloPasskey` | `WINDOWS_HELLO_AAGUID` |
| `syncedPasskey` | a credential with `passkeyType` synced |

  Where the proof's `method` string names a security key (`/security key|fido2/i`), it is never seamless. `inv.rows` already carries the AAGUID; pass the matching credentials into `seamlessProof`.

### 3. BUG: Step 3 "not configured" does not exist; every key is checked against the four default models
- **Where:**
  - `src/derive/readinessContext.ts:87`: `requiredModels(undefined)` always returns `PASSKEY_DEFAULT_MODELS` (`roadmap/passkeySettings.ts:198-204`). That list is the 2 Authenticator models and 2 YubiKey 5 models.
  - As a result, `step3.size === 0` at `phishingResistant.ts:551` can never be true.
- **Decision:** when Step 3 isn't configured, accept any passkey the current settings allow, with a note.
- **Scenario (probes 5 and 20), with no `passkeyApprovedModels` in the mapping:**
  - A Feitian key only, proven on a joined PC. State Ready, and the next step reads **"Replace the key with an approved model"**.
  - The same key with no sign-in in the window. State `confirm`, and the next step is `replaceKey`.
  - A Windows Hello passkey (08987058…) on a personal PC. State **Seamless**, yet the Next step cell reads "Replace the key with an approved model". The Seamless group says "Nothing to do".
- **Where the page contradicts itself:** the rail tile and the `step3` setup check show "Configure your passkey settings in … Step 3 so IAMAI can check keys…" (`MfaReadiness.tsx:548`, `readinessSetup.ts:83`). The panel meanwhile says "Blocked by Step 3's approved list".
- **The reverse contradiction:** when Step 3 *is* configured but the tenant's allow list doesn't match it yet, `applied` is false. The page still tells the admin to "Configure" Step 3.
- **Related:** `eligibility` recommends the Windows Hello passkey (`:466`) and synced passkeys (`:471`). Neither model is in the default Step 3 list, so the page recommends a credential that the Step 3 note says would stop working.
- **Fix:**
  - Carry `step3.configured = mapping.passkeyApprovedModels !== undefined`, or a saved `PASSKEY_MODELS_STEP` decision.
  - When it is not configured, set `afterStep3 = null` and show the note.
  - When it is configured, word the tile as "Step 3's models: not applied to the tenant yet", not "Configure".
  - In `eligibility`, treat an option whose AAGUID Step 3 blocks as `possible: 'no'` with a new `whyNot: 'step3'`.

---

## P1

### 4. BUG: the next step names something the person already has, or cannot have
All three cases are in the `device` and `method` branches, `phishingResistant.ts:648-651` and `:597-605`.
- **(a) Passkey already held (probe 3b).**
  - The person holds an Authenticator iOS passkey (the panel lists "Passkey, Microsoft Authenticator — iOS"). It was proven on Windows across devices, and the iPhone signs in silently with a token (usual for Outlook mobile).
  - Next step: **"Add a passkey in Microsoft Authenticator on the iPhone"**.
  - It should be "Sign in once with the passkey on the iPhone".
- **(b) Old phone OS (probe 4).**
  - Windows Hello for Business is proven on a joined PC. An Android 12 phone signs in with push.
  - State `device`. Next step: **"Add a passkey in Microsoft Authenticator on the Android phone"**.
  - The panel on the same device says "A passkey in Authenticator needs iOS 17 or Android 14".
  - Cause: `missing.find(x => x.possible !== 'no') ?? missing[0]` falls back to the impossible device and names its best option anyway. The brief says "Update the phone OS", or a security key over NFC.
- **(c) Passkeys off or phone models not allowed (probe 17).**
  - Windows Hello for Business is proven, the iPhone signs in with push, and passkeys are off tenant-wide.
  - State `device`. Next step: "Add a passkey in Microsoft Authenticator on the iPhone".
  - At the same time the setup rail says passkeys are off. The `blocked` branch (`:607-618`) runs only when `usable.length === 0`, so a person who is partly Ready is never Blocked.
- **Fix:** give `addDevice` its own choice:
  - If a held credential can serve the missing device (an Authenticator passkey for a phone, any key for a computer), the next action is `confirm` with `os`.
  - If the device's `possible === 'no'` and the reason is `notAllowed` or passkeys are off, the state is `blocked` or `waitSetup`.
  - If the reason is `osTooOld`, the next action is a new `updateOs` (or the security-key fallback).

### 5. BUG: Unknown and Blocked rows say "No sign-in seen in 30 days" when sign-ins were never read
- **Where:** `phishingResistant.ts:523`. An unreadable inventory returns `base.devices = []` before devices are computed. Also `:621`, where sign-ins were not read.
- **What the row shows:** `MfaReadiness.tsx:255` and `readinessCells.ts:237` then show the chip, the CSV value and the panel line **"No sign-in seen in 30 days" / "No sign-in in the last 30 days."** Those assert a fact IAMAI did not read.
- **Scenario:** a tenant whose sign-in read failed. Every person holding a passkey is Unknown ("Nothing to do: the next scan retries the sign-in records"), and each row also claims they have not signed in for 30 days.
- **Decision:** Unknown always says what was missing, and never makes a claim of its own.
- **Fix:** compute `devices` before the `inv === null` return, since they come from sign-ins and not methods. Show the quiet "no sign-in" chip only when `r.readiness.unknown === null && signIns.read`. Otherwise show a "Sign-ins not read" chip, using the existing `chip.unread` word.

### 6. BUG: a Plan step's handoff count and the page it opens disagree
- **Where:** `MfaReadiness.tsx:122` takes `context.ids = hold.ids`. `:421` prints "Filtered to the {n} people {step} is waiting on" with `n = ids.length`. The page counts only rows with `state !== null` (`:202`).
- **Measured:**

| Fixture | Step | People in the hold (count shown in the Plan and the filter line) | People the page counts | Who makes up the gap |
| --- | --- | --- | --- | --- |
| mid | `s-goal-admin-portals-protected` | 70 | 55 | 12 looks-retired, 3 guests |
| large | same step | 1,293 | 1,056 | not broken down |
| demo | `s-goal-device-registration-mfa` | 24 | 22 | not broken down |

- **Guest step (a trace through the code, not reproduced in a fixture):** a hold on `s-goal-guests-mfa` holds guests. The scoped page would say "Filtered to the N people…", then "No active people to count." and "Nobody needs action: everyone counted is Ready." (`:517`). The Guests tile is hidden when scoped (`:586`).
- **The reverse case:** the Plan gates on registration (`methodPreparation`) while the page requires proof in a sign-in. A person the step waits on because the registration report lags can be Ready on the page. The page then shows "Filtered to the 5 people…" beside "Nobody needs action".
- **Fix:**
  - Build the scope line from the counted rows in scope, and add a second clause for the rest: "{m} more aren't counted here (guests, retired)", with a link to Not counted.
  - For the guest family, keep the Guests tile when scoped.
  - Choose the empty-state words by whether `active === 0`.

### 7. BUG: Platform SSO on a managed Mac can never be recognised
- **The decision:** Seamless on a Mac means Platform SSO.
- **Why it can't happen:**
  - `ctx.platformSso` is always `'unknown'`, because `snapshot.intune` is never collected (see the brief's Execution status). `eligibility` at `:470` therefore never picks `platformSso`.
  - `#microsoft.graph.platformCredentialAuthenticationMethod` has no entry in `KIND_BY_TYPE` (`graph/collect/collectors.ts:314-324`). It becomes `'other'`, so a Platform SSO credential is not a method class.
- **Scenario:** a managed Mac that signs in daily with Platform SSO and has an iPhone with push.
  - The person reads **Needs a method, "Set up a passkey in Microsoft Authenticator"**.
  - If a Platform SSO sign-in names a method `classOfProofMethod` doesn't know, it proves nothing.
- **Fix:**
  - Map `platformCredentialAuthenticationMethod` to a new `platformCredential` kind, in the `windowsHello` qualifying class or its own.
  - Recognise the sign-in's Platform SSO method string. Confirm the exact string against a real tenant before settling on it.
  - Judge Platform SSO by outcome, as with Windows Hello: a platform-credential proof on macOS makes that device seamless.
  - Add a setup check "Platform SSO seen working / not seen yet".

### 8. BUG: passkey targeting is ignored, so "on for everyone" can be false
- **Where:** `readinessContext.ts:21-52` (`passkeyPolicyOf`) and `phishingResistant.ts:373-382` (`passkeyAllowed`). Neither reads `includeTargets`. The brief's compatibility step 2 asks "is the method targeted at the person?".
- **Scenario:** passkeys are enabled for a "Passkey pilot" group only.
  - The setup check reads "Passkey registration is on".
  - Everyone outside the group gets Needs a method, "Set up a passkey in Microsoft Authenticator", which they cannot register.
  - The profile mode has the same problem. At `:30` a model allowed by any assigned profile counts as allowed for everyone.
- **Fix:**
  - When the targets are not `all_users`, the `passkeyOn` check becomes `note` or `unknown`: "Passkeys are on for {n} groups".
  - For people IAMAI can't place in a target, `passkeyAllowed` returns `'unknown'`. Group membership is available where the groups were read.

### 9. BUG: the Windows Hello setup check contradicts the rows
- **Where:** `readinessSetup.ts:67-73`. `joined` is true only for `trust` of `joined` or `hybrid`.
- **Scenario:** item 1's `trust: null` PCs in a directory with joined devices, where no counted person's sign-ins reported a joined state. This is common when people use Chrome without the Windows accounts extension.
  - The check shows ✓ **"No joined Windows computers seen, so Windows Hello for Business doesn't apply yet"**.
  - The rows say **"Set up Windows Hello for Business"**.
- **Fix:** derive the check from the same field the rows use: `devices.some(d => d.best === 'windowsHello' && d.builtIn)`. Fixing item 1 removes most of the cases.

### 10. POLISH: rows overflow and are clipped at 761–~850px and 1041–~1190px
- **Where:** `src/ui/app.css:4276`. The row grid is `minmax(150px) minmax(200px) minmax(130px) minmax(160px) auto`. With the gaps, padding and the Details button its minimum width is about 798px.
- **At 1041–~1190px:** `.readiness-layout` (`:4101`) is still two columns, so the worklist is about 1100 − 48 − 344 = 708px. `.readiness-group.panel` has `overflow: hidden` (`:4133`), so the Details button is clipped away.
- **Confirmed in the approved pack:**
  - At 1100px the row's `scrollWidth` is 789 against a width of 705. The Details button's right edge is at 808 and the group's at 725.
  - At 800px the group is 824px wide, wider than the viewport.
- **Where people will hit it:** a 1180px iPad landscape and 1100–1180px laptop windows lose the only way into the person panel. The same happens at the 768px tablet preset.
- **Fix:**
  - Move the two-column cut-off to about 1200px, or let the row's columns shrink (`minmax(0, …)` with wrapping cells).
  - Move the stacked-row breakpoint from 760px to about 860px.
  - Drop `overflow: hidden` on the group; use `overflow: clip` only on the rounded corners.

---

## P2

### 11. BUG: "Ready until" and the lapsing count use the Seamless proof, not the latest one
- **Where:** `phishingResistant.ts:590` sorts a device's proofs seamless-first, and `:653` computes `readyUntil` from that proof.
- **Scenario (probe 2a):** Windows Hello for Business was used 25 days ago and a security key yesterday, on the same joined PC.
  - The note says "Ready until Sep 22" and the person counts in "lapse in the next 7 days".
  - They are actually Ready until Oct 17. Only Seamless lapses on Sep 23.
- **Fix:** base `readyUntil` on the latest qualifying proof per device. If it's wanted, add a separate `seamlessUntil`.

### 12. BUG: a certificate-only person reads Needs a method when the registration report has no row
- **Where:** `phishingResistant.ts:500-504`. A certificate enters the inventory only from `registered`, because method rows never list x509.
- **Scenario (probe 6):** method rows read as `[Authenticator]`, `registered === null`, and a certificate sign-in 1 day ago.
  - State `method`, "Set up Windows Hello for Business".
- **Fix:** where `registered` is null, let a qualifying `certificate` proof inside the window establish that the class is held.

### 13. BUG: a proof with no operating system produces contradictory words
- **Where:** `phishingResistant.ts:590` matches proofs only by `x.os === d.os`, and `:623-628` handles the case with no devices.
- **Scenario (probe 7a):** a passkey sign-in with no OS recorded, 2 days ago, plus a Windows push sign-in.
  - State `confirm`: "Sign in once with the passkey".
  - The why line says "no sign-in with it in the last 30 days". The panel's credential says "Last confirmed Sep 16".
- **Scenario (probe 7b):** only a proof with no OS. State Ready, and the device chip reads "No sign-in seen in 30 days".
- **Fix:**
  - When a proof with no OS is inside the window, the credential counts as seen working. Word the device gap as `device`, not `confirm`.
  - In the case with no devices, show a chip reading "Device not reported".

### 14. BUG: the passkey-off case gives the wrong advice twice
- **Where:** `readinessSetup.ts:57-59`. When `p.enabled === false`, `passkeyAllowed` returns `'no'` for both Authenticator models.
- **What the admin sees:** "Phones can't hold a passkey", with the advice "Add the two Microsoft Authenticator models to the approved list". This sits next to "Passkey registration is off". One cause produces two failures, and the second remedy is wrong.
- **Fix:** skip `phonePasskey` (or mark it `note`) when `passkeyOn` fails. For the `unknown` reason, tell "settings unread" apart from "restriction unreadable".

### 15. POLISH: the Methods cell contradicts the Needs a method group
- **Where:** `readinessCells.ts:138` lists every qualifying class held, including ones `allowedNow === 'no'`.
- **Scenario (probe "passkey off current list"):**
  - Methods: **"Passkey"**.
  - Group: "Set up a phishing-resistant method — No passkey, security key or Windows Hello yet".
- **Fix:** build the cell from `rd.qualifying` (the usable classes). Name the held-but-blocked ones with a note, e.g. "Passkey (model not allowed)".

### 16. POLISH: brand names are lower-cased, and the device is dropped
- **Where:** `readinessCells.ts:156-157` lower-cases `classWord` for `restore` and `confirm`.
- **What it produces:** **"Sign in once with the windows hello"** and "Restore the windows hello".
- **Also missing:** the brief's "on <device>". `NextAction.confirm.os` is computed but never shown.
- **Related dead logic:** `phishingResistant.ts:645` has `d.type === 'phone' || true`, which is always true.
- **Fix:** add lower-case method words in `content.json` (e.g. `methodsInline`), and add `{device}` to `next.confirm`.

### 17. POLISH: the chip word on a phone depends on any passkey, including a security key
- **Where:** `readinessCells.ts:119-121`, `holdsPasskey = rd.hasPasskey`. `hasPasskey` includes FIDO2 security keys.
- **Scenario (probe 2b):** a YubiKey holder whose iPhone signs in with push.
  - The chip reads "Not confirmed", suggesting a passkey is on the phone.
  - The next step reads "Add a passkey in Microsoft Authenticator".
- **Fix:** for a phone, pass "holds an Authenticator-model passkey".

### 18. POLISH: Windows Hello advice appears on a Mac-only tenant
- **Where:** `pages.readiness.lead`, `seamlessNone` ("a passkey on the phone and Windows Hello on the computer get them there"), `groups.method.body` and `groups.device.body`.
- **Scenario:** in a Mac tenant whose synced passkeys are allowed, `goalLine` shows `seamlessNone` with the Windows Hello advice.
- **Also wrong:** the title of the `device` group is "Add a passkey to the device they use". Its rows may say "Add Windows Hello for Business…".
- **Fix:** add a variant of `seamlessNone` chosen from the platforms of the counted devices. Retitle the device group "Set up sign-in on the device they use".

### 19. POLISH: an iPad is called an iPhone
- **Where:**
  - `normaliseOs` maps `iPadOS` to `iOS`.
  - `osWord` and `deviceNoun` (`readinessCells.ts:82-107`) say "iPhone" / "the iPhone".
  - `versionWord` says "iOS 17".
- **Scenario:** an iPad-only person is told "Add a passkey in Microsoft Authenticator on the iPhone".
- **Related:** `versionWord` on "Windows 10.0.26100" shows **"Windows 10"** for Windows 11 24H2, the fixture's own string.
- **Fix:** keep a `tablet` hint when the raw OS string starts with `iPadOS`, and use "the iPad". Don't show a Windows major version from the sign-in string, or map build ≥ 22000 to 11.

### 20. POLISH: Unknown people count in "Needs action", and so do the empty states
- **Where:** `MfaReadiness.tsx:215` computes `action = active − ready`, which includes `unknown`. Those people's next step reads "Nothing to do: the next scan retries…".
- **Also:** with 0 counted people (or only guests), `:517` shows "Nobody needs action: everyone counted is Ready."
- **Fix:** subtract `counts.unknown` from the pill, or label them separately. Use `summaryNone` wording when `active === 0`.

### 21. POLISH: "the next scan retries" is said even when a retry cannot help
- **Where:** `next.rescan.signIns` and the Unknown group's why ("The next scan retries").
- **Scenario:** sign-in evidence was disabled by licence or permission (`sources.signInEvidence.status === 'disabled'`). Rows say the next scan will fix it, but it won't.
- **Fix:** give `rescan` a `reason` of `unavailable`, worded with `source.reason`.

### 22. PLAN: a script account is counted, and told to set up Windows Hello for Business
- **Where:** `phishingResistant.ts:320`, where `automated` is "a note, never a state". The brief's Explained table lists "Looks automated" as counted separately.
- **Probe:** state `method`, "Set up Windows Hello for Business", plus the note.
- **Question for the owner:** keep it counted with the note, or move it under Not counted?
- **Also:** the `SCRIPTING` regex (`:438`) matches a bare `sdk`, and `apps` is capped at 8 (`laneBCore.ts:365`).

### 23. PLAN: proof is judged per OS family, but the decision says per device type
- **The code:** judges per OS family (`devices` keyed by `Platform`).
- **The owner decision (brief decision 2):** "every device type they signed in from … computer, and phone".
- **Scenario:** a developer with Windows Hello for Business on a joined laptop and push-only sign-ins from a Linux box reads Needs a device, "Add a security key on the Linux computer". Judged per device type, they would be Ready.
- **Question for the owner:** confirm the grain. The brief's own model section says OS family.

### 24. PLAN: phone proof depends on how often the phone is asked to sign in
- **The issue:** mobile apps refresh tokens silently ("previously satisfied" is discarded at `phishingResistant.ts:133`). A person with an Authenticator passkey may produce no fresh phishing-resistant sign-in on the phone within 30 days.
- **Consequence:** combined with item 4a, they sit in Needs a device indefinitely.
- **Fix:** consider the fido2 `lastUsedDateTime`, which is already collected (`collectors.ts:354`) and is read nowhere. Or state the sign-in-frequency dependency in the Needs a device group's words.

### 25. BUG: registration counts as restricted even when the policy doesn't reach the person
- **Where:** `readinessContext.ts:59-78`. The users condition (include and exclude, guests, roles) is ignored, and any `excludeLocations` counts as "trusted".
- **Scenario:** a "block registration outside trusted locations" policy scoped to guests only. Every member with no method and no trusted-location sign-in reads **Blocked by setup**.
- **Fix:** require all users (or intersect the scope with the person), and require `excludeLocations` to include `AllTrusted` or a trusted named location.

### 26. POLISH: "Completed checks" shows instructions with a ✓
- **Where:** `MfaReadiness.tsx:214`, where `done` includes `note` outcomes.
- **Examples:** "Configure your passkey settings in … Step 3…" and "Attestation is on…" appear under Completed with ✓.
- **Fix:** list `note` checks separately, without ✓.

### 27. POLISH: the setup "unblocks" count ignores the Plan scope
- **Where:** `MfaReadiness.tsx:212` scopes `nextCheck` counts, but `setupNext.affects` (`:506`) counts the whole tenant.
- **Scenario:** a page scoped to 9 people says "Tenant setup, unblocks 1,056 people".
- **Fix:** compute `affects` over the rows in scope.

### 28. POLISH: consistency between the table, the panel, the CSV and the handoff for the same person

| Fact | Table row | Panel | CSV | Plan handoff (`MfaHandoff.tsx`) |
| --- | --- | --- | --- | --- |
| Methods | `methodsCell` (qualifying held; +certificate from the registration report) | credentials (usable and unusable) | `methodsCell.main` | `methodClassesOf` (`derive/ladder.ts:91-105`): **no certificate from the registration report**, lists every class |
| Ready until / last confirmed / on leave | note | why line | **missing** | n/a |
| Automated note | note | yes | **missing** | n/a |
| Count | counted only | n/a | filtered rows | includes guests and retired (item 6) |
| Name | displayName ?? UPN | same | same | `u.displayName` only, so **blank when displayName is null** (`MfaHandoff.tsx:74`) |

- **Scenario:** a certificate holder. The Plan says "Has: Authenticator"; the page says "Certificate".
- **Fix:**
  - Build the handoff's "Has" from `viability.readiness.methods`. The scored person is already in `scored`, so drop the second `methodClassesOf` inventory.
  - Add a CSV column for the note, or fold `methodsCell.note` and `rowNote` into the Readiness column.

### 29. PLAN: rendering and computation cost at scale

| Fixture | Users (people counted) | `readinessView` | `searchText` over all rows (every keystroke) | `rowCells` over all rows |
| --- | --- | --- | --- | --- |
| demo | 38 (30) | 4 ms first run, 1 ms warm | 1 ms | 0 ms |
| mid | 285 (234) | 3 ms | 1 ms | 1 ms |
| large | 4,902 (3,972) | 35–42 ms | 12 ms | 9 ms |
| huge (HUGE=1) | 25,002 (20,238) | 250–300 ms | 92 ms | 56 ms |

  The view is fine. The costs worth addressing:
- **(a) The page computes the whole plan synchronously** (`MfaReadiness.tsx:116`, `usePlanData`, whose `computed` is a `useMemo`) only to resolve step ids and the guest step's status.
  - `runFixture` on large took about 2 s. On huge it took 63 s, though that includes the fixture's own pipeline.
  - Fix: when the page isn't scoped, read the step ids lazily, or defer them with a transition.
- **(b) `MfaHandoff` computes the ladder again per held step** (`MfaHandoff.tsx:55`, `scoredPeople`), although `data.computed.viability` already holds it. On huge that is about 250 ms × each held step.
- **(c) Closed `<details>` sub-groups still mount their rows** (`MfaReadiness.tsx:330`). Grouping by department in a tenant with 300 departments mounts up to 300 × 50 rows.
  - Fix: render the rows only when the sub-group is open. Use `onToggle` state.
- **(d) `searchText` is computed for every row on every keystroke.** Memoise it per row per view (a `WeakMap`).
- **(e) `readinessContextOf` runs twice per view** (in `buildViabilityInputs` and in `readinessView:115`). `methodClassesOf` uses `registrationDetails.find` per row, which is O(N²) for accounts that are not people.

---

## Accessibility (P2 unless noted)

- **A1. The Details buttons all have the same name.** `MfaReadiness.tsx:267-278` gives every row a button called "Details", so a screen reader announces "Details, button" with no person.
  - They also have no `aria-expanded`.
  - `aria-controls="readiness-panel"` points at an id that isn't in the DOM while the panel is closed.
  - Fix: `aria-label={fillText(T.detailsFor, { name })}` (a new content key), `aria-expanded={openId === r.user.id}`, and set `aria-controls` only while the panel is open.
- **A2. The table has no table semantics.** `:283` hides the column header (`aria-hidden`) and the rows are plain divs, so the cells are read with no column name.
  - Fix: `role="table"`/`row`/`columnheader`/`cell`, or a visually hidden label per cell.
- **A3. Heading order.** The order is h1 → h2 (the answer) → h2 "What to do" → h3 (next setup) → the groups (no headings; their titles live in `<summary>`) → rail h3s → panel h2/h3.
  - The rail's h3s land under "What to do".
  - Groups can't be reached by heading navigation.
  - The rail landmark is labelled "Tenant setup" (`:520`) but also holds models, Not counted, Guests and Evidence. The pack says "Tenant setup and evidence".
  - Fix: add `<h3 className="group-title">` inside the summary, give the rail its own h2 (visually hidden is fine), and use the pack's label.
- **A4. Focus.**
  - `:168-170` focuses Close whenever `openRow`'s identity changes, including a recomputed view (for example when the mapping loads), which steals focus.
  - The Escape listener (`:171-178`) is on `window` and re-registered every render. It fires while typing in search and then moves focus to the row.
  - When the trigger has unmounted (the filter changed while the panel was open), `close()` sends focus to `body`.
  - Fix: key the effect on `openId`, check that the trigger `isConnected` or fall back to the group summary, and ignore Escape from inputs.
- **A5. The panel covers the whole screen at phone width** (`width: min(460px, 100%)`, `app.css:4435`), yet it is `aria-modal="false"` and the page behind stays in the tab order. Keyboard users tab into content they can't see.
  - Fix: below 760px, make it modal (`inert` on the page behind), or render it inline under the row.
- **A6. Chip facts live only in the `title` attribute.** The device chip's version and join state (`readinessCells.ts:123`) can't be reached by keyboard or touch. The panel repeats them, which softens this.
- **A7. Counts without their noun.** The group count in `<summary>` is a bare number ("… 21"), and the evidence rows put the count in `<dt>` and the noun in `<dd>`. That also defeats `pluralise`: "1 / people's sign-ins aren't read yet".
- **A8. Colour.** Every state carries its word (legend, chips, panel state), and the bar is `aria-hidden` with a legend. **No colour-only meaning found.**

## Mobile layout (besides item 10)
- **M1.** The person name has no `overflow-wrap`, so a long display name with no spaces overflows the one-column row below 760px (`.person-name`, `app.css:4297`). The UPN already has `overflow-wrap: anywhere`.
- **M2.** The device chips are `white-space: nowrap`, and "Windows Not confirmed" is about 170px. That fits at 343px, but a person with five platforms wraps five chips before the Next step. Acceptable, not a fix.
- **M3.** Below 760px `.readiness-change` takes the full width above the bar. The "Show them" button becomes a tertiary control inside a list item: check the tap target is at least 44px.

## Code quality (P3)
- **Q1. Dead branches.**

| Location | What is dead | Why |
| --- | --- | --- |
| `phishingResistant.ts:608` | `qualifying.length > 0` inside `usable.length === 0` | can't happen |
| `:645` | `d.type === 'phone' \|\| true` | always true |
| `:460`, `readinessSetup.ts:70` | `ctx.whfb === 'disabled'` | `intune` is never collected |
| `:470` | `platformSso === 'configured'` | same |
| `readinessSetup.ts:71` | `whfb === 'enabled'` | same |
| `:551` | `step3.size === 0` | item 3 |
| `ReadinessContext.signInsRead` | the field | never read |
| `readinessCells.ts:66` | `showWord` | unused |
| `mfaReadiness.ts:151` | `ReadinessView.admins` | used by no surface |
| `readinessSetup.ts:95` | `ACTION_STATES` | unused outside tests |
| `pages.readiness.panel.afterStep3` | content key | unused |
| `checks.windowsHello.pass/fail/failText/unknown` | content keys | unreachable |

- **Q2. Duplicates.**
  - `GROUP_ORDER` (`mfaReadiness.ts:77`) equals `READINESS_STATES` (`phishingResistant.ts:207`).
  - `isReadyState` (`readinessCells.ts:147`) duplicates `isReady`.
  - Two method inventories: `inventory()` and `methodClassesOf`.
  - Two `counts` computations (the view and the scoped page).
  - Words are cast inline as `pages.readiness as unknown as {…}` three times (`MfaReadiness.tsx:252`, `readinessCells.ts:237`, `MfaHandoff.tsx:75`). The `Words` types already exist, so add `chip` and `sub` to them.
- **Q3. Unclear names.**
  - `phoneOnly` (`phishingResistant.ts:609`) actually means "no usable Windows Hello device".
  - `settled` is used for two different things (`:549` a verdict, `:587` a device).
  - `holdsPasskey` covers security keys (item 17).
  - `builtIn: true` with `possible: 'unknown'` is used for "we can't tell" (item 1).
- **Q4. Links.** Every "Not counted" ledger row links to `readinessHref('notActive')` (`MfaReadiness.tsx:559`). None filters to its own population (`never`, `retired`, `new`), which `showKeyOf` doesn't support.

---

## Held up against the decisions (for the record)
- **Ready leads, Seamless beside it** (`goalLine`): holds.
- **Guests (option B):** not counted, and a tenant-level tile: holds. It breaks when the page is scoped from a Plan step (item 6).
- **Windows Hello judged by outcome, with no Intune scope:** holds, apart from item 9.
- **History never makes anyone Ready:** holds. `retained` proofs only feed the "before the window" note.
- **Plan gates on its own policy, and the handoff states the higher bar:** holds. The counts disagree (item 6).
- **Confirm it for methods held but not used:** holds, apart from item 4a and item 13.

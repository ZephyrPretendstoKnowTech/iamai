# IAMAI Planner v1.1: the plan

Owner-approved 2026-10-03. Base: `main` at `fcf59888`, tagged `v1.0.0`. All v1.1 work lands
on the `v1.1` branch. Nothing goes to `main` until the owner says so.

v1.1 is about quality, not breadth. The suite tells the truth first. Then:
- safety and plain wrongs;
- the rest of Jon Hope's baseline where it can be built honestly;
- switching between tenants for the consultant who plans several;
- the polish people feel.

Each item still gets the owner's yes before it is built (§5). The v1.1 list
(`docs/plans/roadmap-flow/v1.1-list.md`) stays the backlog this plan draws from.

## 1. What v1.0 left, in facts

**Passkeys (1.3 Configure Passkey Authentication).**
- **What v1.0 targets:** device-bound passkeys, attestation enforced, and an AAGUID allow
  list on every profile.
  - The default models are Authenticator iOS/Android and YubiKey 5 NFC / 5 Series
    (`src/roadmap/passkeySettings.ts` `PASSKEY_DEFAULT_MODELS`, `resolvePasskeyTarget`).
  - That is IAMAI's own stance. Jon's baseline defines only the "Modern MFA + TAP" strength,
    with no AAGUID or attestation settings.
- **1.3's words contradict themselves:**
  - `preparation[2]` restricts models to an allow list;
  - `whatToDo.steps[2]` and `example.wanted` keep an unrestricted tenant unrestricted.
- **A lockout survives:** when the allow list is withheld, the Device-bound type is still
  handed over, so a synced-only account is stopped.
- **Microsoft's current advice** (Learn, passkey FAQ) is device-bound for admins and synced
  for everyone else. The owner's v1.1 decision is below (§3, D2).

**Jon's baseline.**
- Jon's repo is Conditional Access only. The objects his policies reference are rebuilt by
  IAMAI steps: the strength (3.5), the trusted network (3.6) and the countries list (6.3).
- 31 of the 38 pinned policies are steps on a fully licensed tenant.
- **Left out of v1.0:**
  - the two Agent blocks;
  - AVD AllowedAVDUsers (hidden);
  - BreakGlass-TrustedLocations;
  - MFA-Passkeys ADM-Users;
  - Countries not Allowed - NoExclusions;
  - the three ZTCA switches (All Apps ×2, Admin Portal).
- **Skipped by design:** the test-folder O365 Timeoutsettings policy.

**Tenants.**
- Every IndexedDB store is already keyed by tenant (`iamai` v8,
  `src/graph/collect/cache.ts`).
- The plan, mapping, drafts, scan lock and cross-tab channel are per tenant too.
- Switching tenants needs no database version change and no new Graph scope.

## 2. The tracks, in order

### Track 0: Phase 0, the ground to stand on
v1.0 shipped without a CI run, with Codex's audit open. Phase 0 makes the suite tell the
truth before anything else changes.

- **P0-1** The `v1.1` branch from `fcf59888`, tag `v1.0.0`, this plan as the first commit.
- **P0-2** CI runs on every push to `v1.1` (`ci.yml` gains the push trigger for that branch
  only). `deploy-pages.yml` is untouched.
- **P0-3** The full local preflight (`npm run verify -- --release`), then every failure fixed
  at its source, one commit each:
  - each labelled a product defect or a stale test;
  - no step snapshot changes unless the failure is a real defect, and then only after the
    owner's yes.
- **P0-4** Codex's 2026-09-29 audit (`docs/launch/2026-09-29-codex-handoff.md`, items 1–6),
  each checked at HEAD. A confirmed defect is fixed if it is one small commit outside a
  frozen section; otherwise it becomes a Track 1 item with its finding. Outcome: six
  findings, all in frozen sections, recorded as Track 1 item 6.
- **P0-5** A `VITE_CHANNEL` build flag:
  - `VITE_CHANNEL=preview` marks the page as a preview build (title, banner, noindex), so a
    v1.1 preview can be hosted beside the live tool and never mistaken for it.
  - Unset, the build is byte-identical to today's. A test proves it.
- **P0-6** GitHub Actions pinned to commit ids in `ci.yml` and `external-health.yml`.
  `deploy-pages.yml` is the owner's (§4).
- **P0-7** Stale records refreshed: the QA tile dumps (`scripts/tile-dump.mjs`) and the
  stale `resolvePolicy.ts` comment.
- **P0-8** §6 ticked with commit ids, the v1.1 block in `docs/STATUS.md`, pushed to `v1.1`,
  CI result recorded.

### Track 1: Safety and plain wrongs
1. **1.3, the passkey stance and the lockout list** (D2, decided). First after Phase 0.
   It reaches frozen 1.3; the owner's decision is the yes for the stance, not for the
   snapshot (§5).
   - **The new target:** device-bound passkeys, attestation enforced, for all users, with
     **no AAGUID key restrictions.**
   - **The allow list leaves the product:**
     - `PASSKEY_DEFAULT_MODELS` and the allow-list target;
     - `restricts()` and the withheld path in `emergencyPasskeyTasks.ts`;
     - `shared.passkeyRestrictions.withheld*`;
     - 1.3's `preparation[2-3]`.
   - **A tenant's existing allow list** is left as it is: never required, never told to
     remove.
   - **Stored data:** `mapping.passkeyApprovedModels` stays readable but no longer shapes
     the target. No database version change.
   - **Before the Save, 1.3 lists every active account whose passkey stops working:**
     - Device-bound takes effect at sign-in, so a synced passkey stops. Attestation applies
       to new registrations only.
     - Each entry names the passkey that stops and whether the person has another way to
       sign in. Anyone left with nothing comes first.
     - "Active" is the window 3.1 Disable or Confirm Dormant Accounts uses.
     - It is one reading (`passkeyRestrictions.ts`), used alike by the card, Prepare Your
       Team, MFA Readiness and its CSV.
   - **Tests:**
     - a synced-only active account listed;
     - a dormant one not listed;
     - a device-bound key never listed;
     - no allow-list line in any state.
   - **The method guides** say "device-bound" where they name a passkey.
2. **The countries turn-on** waits on its lockout warnings (includesOperator,
   seenCountriesIncluded), with a way to acknowledge a country left out on purpose.
3. **Dormant synced (hybrid) accounts** are disabled in Active Directory, not Entra.
4. **Partial P2 seats:** risk steps say who P2 does not cover.
5. **4.3's session and name correction lines** that never showed: find the root cause.
6. **Codex's audit, as P0-4 found it at HEAD** (2026-10-03). Each fix reaches a frozen
   section, so each waits for the owner's yes.
   - **6a. 3.8 drops a guest create beside a held update** (item 1, S).
     - Case: the tenant has Mixed-Guests with a difference and no B2B-Guest, and its
       update is held (the drill) or unavailable (readiness).
     - What happens: 3.8 loses the B2B-Guest create, while the guest step reads Ready ·
       Create.
     - Where: `reportOnlyBatch.ts` `createdBodiesOf` reads `operationsOf`, and
       `batchMemberOf` needs the whole step's `implementationOffered`.
     - Fix: count the step's create operations whenever only its enforcing work is held.
     - Snapshots: none move.
   - **6b. A half-created guest pair can be turned On with no report-only week** (item 1,
     S–M).
     - Case: Mixed-Guests in Report-only and B2B-Guest absent. The pair reads
       `not-deployed`, its least advanced member (`tracking.ts`), so the step offers
       Mixed-Guests `state: enabled`.
     - Once both halves are in Report-only, the week runs correctly.
     - Fix: hold an enforcing update per member that is still in Report-only.
   - **6c. The guest create task tells the reader to create the half that exists** (item
     1, S).
     - Where: `policyTasks.ts` `createSteps` writes create lines for every member with a
       body, `m.exists` or not. 3.8 copies them.
     - Fix: create lines only for members that do not exist.
   - **6d. 3.8 counts steps where its cards count policies** (item 2, M).
     - The snapshots record it today:
       - demo: the rail says 7 with 8 cards;
       - demo-week2: the rail says 5 with 6 cards;
       - the Plan row says "7 policies".
     - The second guest card (`batch:s-goal-guests-mfa#2`) has no instruction.
     - Fix: count created bodies for the milestone and `impactCount`, and one task per
       created policy.
     - Snapshots: the `rail` of `s-create-report-only` on demo and demo-week2 moves.
   - **6e. 3.8's Basic Sign-ins task names tabs 3.8 does not have** (item 5, S).
     - It copies "create this policy from the PowerShell or JSON tab", but those tabs are
       on Require Phishing-Resistant MFA for Basic Sign-ins.
     - Fix: name that step. This needs a new content key.
   - **6f. Synthetic fixtures pick one source for two goals** (item 6, S).
     - Where: `generate.ts`'s signature fallback, used only when the goal map does not
       describe the package. On getiamai, the guest step's source is the AllUsers policy
       ("… AllUsers (2)").
     - The product always uses a goal map, so no user sees it. Codex's getiamai order
       check of the guest step read this wrong source.
     - Fix: order the fallback by `goalMapFor`. The synthetic fixtures' snapshots may move.
   - **Not defects:**
     - item 3: the guest pair's completion and the partner answer. The tenant's own guest
       policy is never edited;
     - item 4: MFA for Everyone's ownership, rename and RMS/Intune exclusions;
     - item 5's gate: it holds only the turn-on, and the step's own tabs explain the wait.
   - **Two points for the owner, not defects:**
     - with "Exclude service providers" answered and Jon's halves On verbatim, the guest
       step reads manual-correction, Mixed-Guests included;
     - on a tenant whose service-accounts group is unresolved, MFA for Everyone reads
       Completed without comparing the exclusions, until the group exists.
7. **The remaining Needs attention items** (rounds document): F-010, F-180, OWN-W5, F-066,
   F-107, F-111, F-121, F-063, F-101, F-114, F-037, F-130.
8. **Promised, never done:**
   - "the app is missing, add it first" for the baseline's apps (Inforcer first);
   - guest-type wording in procedures;
   - the "Paused this morning" list re-checked, keeping only what is still wrong.

### Track 2: Finish Jon's baseline
| Policy | v1.1 | Why |
|---|---|---|
| ZTCA All Apps ×2 and Admin Portal (the lockdown kit) | Build all three, created **Off**, with a runbook (D3) | Incident switches: no user impact while off; report-only would mark every sign-in |
| AVD AllowedAVDUsers | Build, behind a Direction question asked only when AVD is in use (D4) | The unidentified group is the only blocker |
| Countries not Allowed - NoExclusions | Build, as an optional second half of 6.3: countries blocked outright, with no travel exception; the exclusions group stays out, as Jon wrote it (D4) | Jon layers it with the allow list |
| MFA-Passkeys ADM-Users | Stays in the footer, with better words | Duplicates 4.3 by group; the role-based policy is stronger |
| BreakGlass-TrustedLocations | Stays in the footer | Contradicts the binding emergency decision |
| Agent blocks ×2 | Deferred | Needs Microsoft Entra Agent ID; exports lack agent targeting |
| EAM, travellers, device and AVD groups | Build the interpretation meaning that ties a group to a Direction answer (D6) | Clears several holds at once |
| Footer fallback reasons (Service Accounts, EntraConnectIDSync, the prose budget) | Specific reasons | No "No step in this plan covers it" left |
| Stage 4, the risk-pair merge | Deferred to v1.5 | The riskiest engine change, for two rows |
| The held-back Cleanup rows | After the policy-matching pilot | Retire-old reshapes them |

### Track 3: Tenants (D1)
- **Tier A, switch tenants in one browser.**
  - The fix first: `restoreSession` keeps the previous tenant's scan when the next tenant
    has none (`src/ui/actions.ts`). It cannot happen today; it can the moment switching
    exists.
  - A switcher in the account menu, built from stored tenants and MSAL accounts.
  - `switchTenant()`: stop the scan, end the tenant turn, reset the session, set the active
    account, restore.
  - Sign out per account.
  - Forget any stored tenant without signing in.
  - The tenant in the header and the tab title (F-145).
  - The tenant id in the wrong-tenant message (F-164).
- **Tier B, after A: sign in to a named tenant.**
  - A tenant ID or domain on Connect, with a tenant-specific MSAL authority instead of
    `/organizations`.
  - Lets a B2B guest or a GDAP technician plan a customer's tenant. Each tenant still
    consents for itself. No new scope.
  - It reaches the approved Connect pack.
- **Tier C, a portfolio across tenants:** v1.5 or later, on evidence.
- **Recorded as a decision:** v1.1 keeps one tenant per session at a time, and changes the
  v1.0 "one tenant per sign-in" decision only that far.

### Track 4: Quality additions
1. **The policy-matching pilot on 4.3** (build new, retire old: decided 2026-09-27, never
   built). It settles F-008, F-014, OWN-W4, OWN-W9, F-102 and F-109. It is its own round.
2. **Policy JSON and PowerShell on every policy step** (F-015: today 8 of 19, while Export
   says all). Then a whole-plan JSON export (F-024).
3. **The report-only notice after a scan:** the policies whose week has ended or that would
   have blocked sign-ins. It reuses F-012's reading.
4. **Accessibility:** F-079 focus ring, F-146 skip link, F-065 focus return, F-097 forced
   colours.
5. **Large tenants:** 1,000-record pages after a live timing check; IndexedDB tests with the
   `fake-indexeddb` dev dependency (D5).

### Track 5: Community feedback
Triaged weekly against the bar:
- safety goes to Track 1;
- a missing piece of Jon's baseline goes to Track 2;
- everything else goes to the backlog with its report.

### Not in v1.1
- A portfolio view.
- The Agent blocks.
- Staggered turn-ons (OWN-D4).
- The change freeze (F-006: take the setting out, if the owner agrees).
- Uploaded baselines.
- The "Create everything" bundle.
- The polish research.

## 3. Owner decisions (2026-10-03)
- **D1** Tenants: Tier A in v1.1, Tier B once A lands cleanly, Tier C later.
- **D2** Passkeys:
  - device-bound and attested for all users, with no AAGUID key restrictions;
  - 1.3 lists the active people whose passkey breaks, so the admin knows before the change.
  - The reason (research, 2026-10-03):
    - a synced passkey is exportable by design and cannot be attested;
    - it lives in a personal sync account the company does not control;
    - NIST keeps it out of AAL3 and asks for compensating controls at AAL2.
  - Microsoft auto-enabled passkey profiles from April to May 2026. Tenants whose
    attestation was off got a default profile that allows synced passkeys, so many now
    hold synced passkeys nobody chose. The lockout list is how the admin finds them.
- **D3** The lockdown kit is created Off: Jon's two All Apps switches and the Admin Portal
  block.
  - The Admin Portal block is the third switch (owner's reading, 2026-10-03). Its ZTCA
    prefix, its Report-only state and its excluded group are shared with the All Apps
    switch. Read that way, the README's "non-admins" and the export no longer contradict
    each other, so `baselineConflict.ts` stops withholding it.
  - **Open:** who keeps working when a switch is flipped. Jon excludes an unnamed group
    (`e663a7ce`, "AllAdminUsers" on the Admin Portal), which IAMAI drops today. That
    leaves only the emergency accounts. Options:
    - emergency accounts only;
    - a responders group the operator names;
    - the admin roles.
- **D4** Build Countries NoExclusions and AVD allowed-users.
- **D5** `fake-indexeddb` may be added as a dev dependency.
- **D6** Jon's named groups, read from his README at the pin, and their counterparts.
  - The EAM and AVD groups say who a policy is for, so they are built:
    - SG-Entra-AUG-MFA-AuthEAM is the group the tenant's external authentication method
      already targets, read from the scan;
    - SG-Intune-AUG-AVD-Prod-Users and -ExternalUsers are the groups allowed to use AVD,
      named by the operator because IAMAI cannot read Azure's assignments.
  - The travellers and device-exception groups excuse people, so they are added only where
    the Direction answer says they are needed, and the step says to keep them small:
    - SG-Entra-AUG-CAP-TravelingUsers, the countries block's travellers;
    - SG-Entra-ADG-CAP-DeviceExclusions, the device policies' exceptions.
  - SG-Entra-DUG-Admins-AllAdminUsers stays in the footer: IAMAI targets the admin roles,
    which cannot fall out of a group rule.
- **Defaults taken unless the owner objects:**
  - "active" is 3.1's window;
  - a tenant's existing allow list is left in place;
  - emergency accounts keep the synced-only warning.

## 4. The owner's jobs
1. **Push the `v1.0.0` tag** when you are happy with it: `git push origin v1.0.0`. It is local
   only, because this work pushes `v1.1` and nothing else.
2. **Choose where the `VITE_CHANNEL=preview` build is hosted.** For example, a Cloudflare Pages
   project that builds `v1.1` with that variable. `deploy-pages.yml` stays as it is.
3. **Pin the actions in `deploy-pages.yml`** to commit ids, as P0-6 does for the others.
4. **The Dependabot pull requests** target `main`. Merge them through CI, or close them until
   v1.1 merges.
5. **Cloudflare:** the `frame-ancestors 'self'` header, and the beacon's EU note for README and
   SECURITY.md.
6. **Remove the admin bypass on `main`.** CONTRIBUTING.md says it will go.
7. **GitHub Support:** purge PR #13's cached views.
8. **Tell Jon, optionally:**
   - SG-Entra-ADG-CAP-DeviceExclusions sits in the users slot of the two Intune device
     policies; a device group there matches nobody;
   - the unnamed `e663a7ce` exclusion carries two different names in his README.

## 5. Binding rules for this work
- `CLAUDE.md`, the binding owner decisions in `docs/STATUS.md`, and this section.
- **Branches, pushes and CI:**
  - Never push to `main`; never open or merge a pull request into `main`; never edit
    `.github/workflows/deploy-pages.yml`.
  - Every commit goes on `v1.1`, one per item, with the item id in the message.
  - Before each push: `npm run verify -- --prepush <the test files the change touches>`.
  - Push to `v1.1` only, then confirm CI started.
- **Stop and ask the owner before anything that:**
  - needs a new Graph scope;
  - changes the database version;
  - reaches a frozen section or an approved pack, beyond what §3 settled;
  - contradicts a binding decision;
  - changes a step snapshot.
- **A failing test** is either a product defect or a stale test: fix it at the source and
  say which.
- **Phases:** each phase ends with a report. The next starts only on the owner's word.

## 6. Phase 0 ticks
- [x] P0-1 Branch, tag and this plan: `4c19f907` (tag `v1.0.0` on `fcf59888`, local)
- [x] P0-2 CI on push to `v1.1`: `28ec5398`
- [x] P0-3 The full preflight green: `243800ba`. One failure: a product defect, the Basic
  Sign-ins create line branched on the lifecycle. After the fix: 2,219 pass, 0 fail,
  12 skipped; build and smoke pass.
- [x] P0-4 Codex's audit checked: `c09737d4` (six findings, Track 1 item 6)
- [x] P0-5 `VITE_CHANNEL`, byte-identical when unset: `bf35a876`
- [x] P0-6 Actions pinned: `060e48be`
- [x] P0-7 Stale records refreshed: `0aeece1f`

## 7. The first build (2026-10-03, for Monday)
Owner-approved bundles, on `v1.1`:
- [x] T1-1 1.3 device-bound and attested for everyone, no AAGUID key restrictions, and the
  lockout list: `75c0bd7c`, snapshots `ec3cc0e1`. MFA Readiness names each passkey
  Device-bound or Synced (drawer and the CSV's last column).
- [x] T1-6a, T1-6c, T1-6e (Codex's audit, 3.8 and the guest pair): `7d6051da`, `f7c82af2`,
  `1a07215b`.
- [x] T4-3 the report-only line under Next: `caae1312`.
- [x] Polish: F-079 `88a984ed`, F-146 `30311a0d`, F-145 `9fd1a098`, F-164 `6f8cab1e`,
  F-114 `81217fa8`.

Calls made on the owner's go-ahead ("you have everything you need", 2026-10-03):
- **The report-only line** lists only what can be acted on now: a Ready row whose week is
  over and stopped nobody, or a policy that would have stopped sign-ins. A turn-on held by
  something else is not listed.
- **F-006, the change freeze, is kept.** It does move dates (schedule.ts placement, the
  finish tip's critical-path reason), so removing it would re-date every saved plan that
  set one. F-090's wording stays on the backlog.
- **Deferred to its own item: a synced passkey in the sample.** The demo's passkey settings
  are the pre-profile form, where a synced passkey cannot be told apart. Showing the lockout
  list needs the sample moved to passkey profiles, as real tenants now are, with every
  sample passkey's type set. That touches every passkey reading in the sample.
- **T1-6e:** 3.8 replaces both of the step's directory lines (waiting and ready) with the
  line naming the step whose tabs create it; the step's own page is unchanged.
- **F-164** reverses an earlier deliberate rule (`284ec456`) that kept tenant IDs out of the
  wrong-tenant message.

## 8. To test on a live tenant before v1.1 reaches `main`
Unit tests cannot prove these; each needs a real tenant, and most a test user.
1. **Graph returns each passkey's type.**
   - Check that `passkeyType` and `attestationLevel` come back on `fido2AuthenticationMethod`
     for a user with a synced passkey (iCloud Keychain) and one with Authenticator.
   - Check that the owner's own script's answers agree with MFA Readiness's new column.
2. **A synced passkey really stops.** On a profile with attestation enforced, does an
   existing synced passkey stop signing in, as Microsoft Learn says? The lockout list rests on
   it. Test with a user holding only a synced passkey and Authenticator.
3. **1.3's change applies as handed over.** Apply the profile change by the Entra steps and
   by the JSON/PowerShell PATCH:
   - Graph accepts the profile back with its key restrictions unchanged;
   - a stored "deviceBound,synced" with attestation enforced reads In place after the scan.
4. **The 1.3 list on a real tenant:** names, what each keeps, locked-out first, dormant
   accounts left out, emergency accounts always in.
5. **The report-only line** after a real report-only week ends: it appears, links the
   step, and goes once the policy is On.
6. **Keyboard and screen:**
   - the skip link and the focus ring in both themes;
   - the tab title with a real tenant name after sign-in;
   - the wrong-tenant refusal with two same-named tenants, if one is at hand.
7. **The MFA Readiness CSV opens in Excel** with the new Passkey type column.
8. **The preview channel:** a `VITE_CHANNEL=preview` build deployed where the owner hosts it,
   with the banner, noindex, and no CNAME.

## 9. The overnight build (2026-10-03/04, owner's go-ahead: "you decide")
Built on `v1.1` by parallel agents and integrated one item at a time. The full preflight passed
on the integrated branch, and CI ran on each push. Snapshot moves are in their own
`[snapshots]` commits, each saying why.

**Tracks**
- **Tenants (T3-A):** `35080be3`…`34db2bfa`.
  - Switch between the tenants stored in this browser, from the Account menu.
  - Sign out of the open account only.
  - Forget a tenant that is not open.
  - The restore bug, where the previous tenant's scan could show, fixed first.
- **The lockdown kit (T2-LK):** `5d318bcf`, `13f9b37f`.
  - Prepare the Lockdown Kit, in section 8: Jon's three ZTCA switches, created Off, with a
    runbook.
  - Who stays online: the emergency exclusions group (owner).
  - The Admin Portal block is no longer a conflict.
- **Countries (T1-2, T2-NE):** `696dec64`, `98f81873`, `e914166b`, `e99c9748`.
  - 6.3's turn-on waits on its lockout warnings.
  - "Left out on purpose" clears that wait.
  - "Countries to block outright" builds Jon's NoExclusions block.
- **Jon's groups (T2-EAM, T2-AVD, T2-GRP):** `09514933`, `d23cad40`, `11e84063`, `2226058d`,
  `b152c79b`.
  - The external-MFA group comes from the tenant's own External authentication method.
  - "Which groups may use Azure Virtual Desktop?" builds the AVD allow-list block.
  - The travellers and device-exception groups stay out, with the reason recorded.
- **The footer (T2-FTR):** `62fad1ad`. A specific reason for every pinned policy, keyed on its
  id.
- **Track 1 fixes:**
  - T1-3 `a5a85006`, synced dormant accounts;
  - T1-4 `78372838`, `1a4f314b`, P2 seats;
  - T1-5 `e7295033`, 4.3's modules;
  - T1-6b/6d/6f `3f7b00f6`, `1a6be812`, `9ad06098`;
  - ENG-1/2/3 `173ef5f3`, `560f50c5`, `630f82ed`;
  - the Needs attention items F-066, F-010, F-101, F-037, F-130, F-107, F-063, F-111, F-121,
    OWN-W5 and F-180.
- **The sample (DEMO-SP):** `63ad283b`.
  - The demo is on passkey profiles and shows 1.3's list: one person whose synced passkey
    stops, keeping Microsoft Authenticator.
  - Two MFA Readiness defects fixed on the way.
- **CI:** the unit job gets 35 minutes (`614648ac`).

**Calls made (the owner said to decide)**
- **The lockdown kit** is a section 8 preparation step. It does not hold the finish date.
- **Countries NoExclusions** is created from 6.3's own task, not listed in 3.8: the countries
  goal was already kept out of 3.8 by design. This sits against the 2026-09-29 rule that every
  created policy is listed in 3.8; the rule or the exception should be settled.
- **AVD:** a tenant that uses Azure Virtual Desktop holds its foundation until it names the
  allowed groups. It is a Direction question, and those gate creates.
- **The travellers and device-exception groups** stay out: their Direction questions were
  retired in Stage 3, and a device group in a users slot excuses no one.
- **The P2 seats line** counts the tenant's active people, so an open policy's words never
  move with its population.

**Still the owner's**
- **The footer's prose budget** (`docs/qa/page-contracts.json`, which only the owner edits):
  the demo footer is about 23 sentences and 358 words against 16 and 260.
- **4.3's JSON and PowerShell** do not carry the session correction, by design (the person's
  correction). Change it or keep it.
- **Unreachable name-correction modules** remain in other policy packages besides 4.3; a
  cleanup, not a defect.
- **The policy-matching pilot on 4.3 (T4-PM):** see its own entry below when it lands.

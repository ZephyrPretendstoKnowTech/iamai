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
| ZTCA All Apps ×2 (the lockdown kit) | Build, created **Off**, with a runbook (D3) | Incident value; no user impact while off; report-only would mark every sign-in |
| ZTCA Admin Portal | Stays withheld | Jon's README and export contradict each other; ask Jon |
| AVD AllowedAVDUsers | Build, behind a Direction question asked only when AVD is in use (D4) | The unidentified group is the only blocker |
| Countries not Allowed - NoExclusions | Build, as an optional second half of 6.3: countries to block outright (D4) | Jon layers it with the allow list |
| MFA-Passkeys ADM-Users | Stays in the footer, with better words | Duplicates 4.3 by group; the role-based policy is stronger |
| BreakGlass-TrustedLocations | Stays in the footer | Contradicts the binding emergency decision |
| Agent blocks ×2 | Deferred | Needs Microsoft Entra Agent ID; exports lack agent targeting |
| EAM, travellers, device and AVD groups | Build the interpretation meaning that ties a group to a Direction answer | Clears several holds at once |
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
- **D3** The lockdown kit is created Off.
- **D4** Build Countries NoExclusions and AVD allowed-users.
- **D5** `fake-indexeddb` may be added as a dev dependency.
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
8. **Ask Jon:**
   - the ZTCA Admin Portal's intent;
   - the AVD allowed-users group;
   - the EAM, travellers and device groups.

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

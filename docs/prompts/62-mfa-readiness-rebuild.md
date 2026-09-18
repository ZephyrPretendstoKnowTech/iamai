# Prompt 62 — MFA Readiness rebuild: phishing-resistant for everyone, seamless on every device

Read first, once:
- `docs/audits/mfa-readiness-audit.md` (prompt 61): its §4 defects are fixed by this
  work, and its §7 decisions are settled below.
- `docs/EMERGENCY-ACCESS-HANDOFF.md`, "Approved interaction and writing rules" and
  "Prompt 60 corrections": the rules this page follows.

The layout authority is the owner-approved version of
`docs/design/proposals/mfa-readiness-v3.html`. Until the owner approves it, build no page
UI: segments 1–3 (model, collection, prerequisites) may proceed, and segment 4 waits.

## Why

MFA Readiness is the page that gets a tenant to phishing-resistant sign-in that people
do not roll back. Its target is higher than the baseline's timing:
- **Phishing-resistant MFA for every active person**, whatever the current policies ask.
- **Seamless where the device allows it:** a passkey on the phone and Windows Hello on
  the computer, so nobody reaches for one device to sign in on another.

The page is also where IAMAI's passkey story is told, so it has to be right, calm and
persuasive. The Plan keeps its own timing: its gates follow each step's own policy
requirement and never read this page's Ready.

## Owner decisions (2026-09-18, settled)

1. **Target.** Phishing-resistant MFA for everyone. The page does no per-policy mapping.
2. **Ready.** A phishing-resistant method the person holds now, confirmed by a
   successful sign-in within the window, on every device type they signed in from in
   the window: computer, and phone if phone sign-ins are seen.
3. **Seamless.** Ready, plus the best built-in credential on each device type (see
   Eligibility).
4. **The headline.** Ready leads; Seamless sits beside it as the goal.
5. **Window.** Only the sign-in records present count, at most 30 days. History keeps
   recording, for display and change detection, but never makes anyone Ready.
6. **"Confirm it."** A qualifying method with no confirmed use in the window reads
   "May no longer exist — confirm it". It is never read as Ready, and never as missing.
7. **Unknown is a last resort.** Every gap is gathered, by a further read, or explained
   (never signed in, looks retired, new account, on leave). Unknown remains only where
   IAMAI could not read something, and it names why and the fix.
8. **Passkey checks** use what is actually seen, the tenant's current settings and the
   Emergency Access Step 3 settings (see Compatibility). The Microsoft Authenticator
   models are the suggested default, so one tenant-wide passkey setting serves
   emergency accounts and everyone else. No separate emergency profile.
9. **The Intune read permission is added** (read-only, `DeviceManagementConfiguration.Read.All`),
   so Windows Hello for Business and macOS Platform SSO provisioning are read, not guessed.
10. **Collection.** Do not raise the 50,000-row ceiling. Stay fast on small tenants and
    reasonable on large ones (see Collection).
11. **Plan copy that points here is reworded** in this batch: `pointer`
    (`content.json:86`) and `adminsNote` (`content.json:3440`).
12. **Guests are out of scope** until the owner picks an option (the last section of
    this brief).

## The model (segment 1)

One pure derivation replaces `personReadiness` as the page's authority. Keep it in
`src/scoring/phishingResistant.ts`, or split out a sibling module there. It is read by
the page, the CSV, the Plan's preview (`MfaHandoff.tsx`) and the print output. The
Plan's gates keep `methodPreparation` (decision 1): nothing in the Plan gates on this
state.

### Device types

- **Computer:** Windows, macOS, Linux, ChromeOS.
- **Phone:** iOS, Android.

Proof is judged per OS family, and shown grouped by device type. Only OS families seen
at an interactive sign-in inside the window count. An OS family used only before the
window drops out, which ends "Test Android forever".

### Person states

Listed in the order the worklist prioritises them. Each carries exactly one next action.

| State | When | Next action (owner of the action) |
| --- | --- | --- |
| Blocked by tenant setup | A tenant prerequisite stops this person: passkey registration not allowed for them, their model not allowed, or security-info registration blocked from where they work | Name the one admin change (admin) |
| Needs a method | No phishing-resistant method usable under the current settings | The best option for their devices (person), or a Temporary Access Pass (admin) |
| Confirm it | Holds a usable phishing-resistant method, with no confirmed use in the window | "Sign in once with <method> on <device>"; if it is gone, register again (person) |
| Needs <device type> | Confirmed on one device type, but signs in from another without phishing-resistant proof there | The best option for that device (person) |
| Ready | Confirmed on every device type seen in the window | None, or the Seamless recommendation (person) |
| Seamless | Ready, and the best built-in credential confirmed on each device type | None |

**Ready until.** A Ready or Seamless person shows "Ready until <date>": the day their
oldest required proof leaves the window.

**On leave.** An active person (a sign-in within 90 days) with no sign-in in the window
reads "Confirm on return", a Confirm it variant worded without alarm.

### Explained populations (counted separately, never Unknown)

| Population | Signal | Wording and action |
| --- | --- | --- |
| Never signed in, no methods | `signInActivity` null, no records, no methods | "Never signed in and has no methods." If unused, point to the Plan's Disable or Confirm Dormant Accounts step |
| Looks retired | Enabled, last sign-in more than 90 days ago | "Last signed in <date>; still enabled." Same Plan step |
| New account | Created within 30 days, not signed in yet | "New; hasn't signed in." Register at first sign-in, or use a Temporary Access Pass |
| Not a person | Emergency, service, shared or disabled accounts (`ladder.ts` kinds) | Counts only, as the ledger does today |
| Looks automated | Sign-ins only from scripting clients or a single app (PowerShell, Graph SDKs) | "Looks like a script or service." Suggest confirming it as a service account (mapping) |

**Activity uses the later of** `signInActivity` and the newest sign-in record
(audit §4, finding 7: the directory's date lags).

### Unknown (only these)

Each carries its reason and IAMAI's fix:
- **Sign-ins not covered:** the person's last sign-in falls outside the rows read, and
  the targeted read (Collection) did not run or failed.
- **Method inventory unread:** a throttled or failed read, or a missing permission.
- **Device eligibility unread:** the Intune read is not consented or not licensed.
  Eligibility falls back to the join state, and the note says so.
- **Settings unread:** the Authentication methods policy or the passkey profile could
  not be read.

### Eligibility: the best option per device

Per OS family seen, from the sign-in's device fields plus the directory's devices plus
the Intune read. The best option comes first; the fallback applies when it is not
possible.

| Device | Seamless option | Possible when | Fallback (the best available; counts as Seamless when nothing better is possible) |
| --- | --- | --- | --- |
| Windows, joined or hybrid | Windows Hello for Business | The account is the device's user, and Windows Hello for Business provisioning is on (Intune; Group Policy shows as "not visible") | Security key, phone passkey used from the computer |
| Windows, registered or personal (contractors) | Windows Hello passkey | Attestation off, and the Windows Hello model allowed | Phone passkey used from the computer, or an allowed security key |
| macOS, managed | Platform SSO (Secure Enclave) | Configured in Intune | Security key, phone passkey used from the computer |
| macOS, unmanaged | Synced passkey | Attestation off | Security key, phone passkey used from the computer |
| Linux, ChromeOS | None built in | — | Security key or phone passkey (counts as Seamless) |
| iOS 17+, Android 14+ | Passkey in Microsoft Authenticator | Authenticator models allowed | Security key over NFC |
| iOS or Android below those versions | — | — | Update the phone OS (person) |

- **Separate admin accounts.** An account signing in on a computer whose registered
  user is a different account cannot use that computer's Windows Hello. Its seamless
  option is a security key or a phone passkey. Detect it from the sign-in device id
  against the device owners.
- **Virtual desktops** (Azure Virtual Desktop, Windows 365, Citrix hosts). Never
  require Windows Hello inside the session. Where the sign-in's app or device marks a
  virtual host, judge the device the person connects from. Follow-up, not the first
  build: record the signal, word it "Virtual desktop: judged at the device you connect
  from", and ask nothing of the host.
- **Phone OS version.** Where the sign-in's OS string carries a version, keep it.

### Compatibility: is this passkey usable?

Judge each registered passkey or security key in this order. The first answer that
settles it wins.
1. **Seen working.** A successful sign-in with this method class in the window, and no
   passkey-policy change in the directory audit log since (the audit read already
   exists): works.
2. **Current settings.** Is the model (AAGUID) allowed by the current key restrictions,
   does attestation permit it, and is the method targeted at the person? This decides
   whether it works today.
3. **Step 3's intended settings.** If Step 3 is configured, a key that works now but is
   not in Step 3's approved list reads "Stops working when you apply Step 3's settings".
   The fix names the model, and Step 3's Additional AAGUIDs control.
4. **Step 3 not configured.** Accept any model the current settings allow, and add one
   page-level note: "Configure your passkey settings in Establish Emergency Access
   Step 3 so IAMAI can check keys against the models you intend to allow."

Model names come from `requiredModels()` plus Step 3's additional models. Anything else
shows as "Unlisted model (AAGUID …)", never a guessed brand. The exact-key limit still
applies: never claim which physical key was used.

### Retire

When segment 6 lands, retire:
- `personReadiness`'s per-platform-forever rule;
- `readinessFor` on the page;
- the passkey rollout strip and the three state tiles;
- `firstMfaDependency`, or reuse it: one implementation, not two;
- the hard-coded strings in `MfaReadiness.tsx` and `MfaHandoff.tsx`.

## Tenant prerequisites (segment 3)

Shown first on the page, in the Tasks Remaining tile standard: the next failing check,
what is wrong, one action, then **Completed checks · N**. They reuse
`passkeySettings.ts`, `passkeyCompatibility.ts` and `methodAvailability.ts`, and
never re-read.

1. **Passkey registration is on for everyone:** the FIDO2 method enabled,
   self-service allowed, and targeting all users or the groups that cover the active
   people.
2. **Phones can hold a passkey:** both Microsoft Authenticator models are allowed by
   the key restrictions.
3. **Attestation consequence:** informational, never a failure. "Attestation is on:
   synced passkeys and Windows Hello passkeys cannot register. Contractors on personal
   computers use a phone passkey or a security key."
4. **Windows Hello for Business is provisioned** (Intune read). Where only Group
   Policy could provide it: "IAMAI cannot see Group Policy; confirm on a joined
   computer."
5. **People can register from where they work:** the security-info registration
   policy's location and device conditions, and whether a Temporary Access Pass is
   enabled.
6. **The authentication-methods policy migration is complete.** The legacy MFA and
   self-service password reset settings no longer govern.
7. **A passkey registration campaign is suggested, never required.** It is a
   suggestion row under Recommendations.
8. **Step 3 is configured:** the compatibility note above.

## Collection (segment 2)

- **Sign-in rows:** additionally keep `deviceDetail.deviceId`, `deviceDetail.displayName`
  and the raw OS version (`mapRow`, `laneBCore.ts:75`). `trustType`, `isManaged` and
  `isCompliant` are already kept.
- **Targeted per-person reads.** Target people holding a qualifying method whose last
  sign-in falls outside the rows read. Read their interactive sign-ins in the window
  (`userId eq … and createdDateTime ge …`), under a request and time budget. People
  with no qualifying method never need one: their state does not depend on the logs.
- **Filling in older days.** Later scans fetch the new gap first (this exists), then
  continue backwards until 30 days are covered, within the same budget.
- **Success-only filter.** If Graph's sign-in filter supports `status/errorCode eq 0`,
  apply it before the ceiling, because failed rows prove nothing. Verify against a real
  tenant first; if unsupported, record that and skip it.
- **Devices:** add `operatingSystemVersion`.
- **Intune (new scope):** Windows Hello for Business enrollment configuration, and the
  settings-catalog policies for Windows Hello for Business and macOS Platform SSO.
  - Add the scope to `copy/permissions.ts` with plain consent wording, marked optional.
    The Connect page's consent row names it, with how to remove it, like the others.
  - It must fail closed: not consented, not licensed or denied all read "not visible",
    with the reason. Eligibility falls back to join state, and no scan ever blocks on it.
  - **Consent path** (existing tenants consented without it, and a Global Reader can't
    consent):
    - **Requested incrementally, not at sign-in.** The sign-in scopes (`GRAPH_SCOPES`)
      stay as they are, so no existing tenant is forced to re-consent. The scan asks
      for the Intune scope silently in its own token request.
    - **A silent request that fails** with consent or interaction required records
      "not granted". It is not treated as an error.
    - **The page shows one Tenant setup row:** "IAMAI can't see Windows Hello or Mac
      sign-in settings. A Global Administrator can grant read-only access once."
      - Signed in as a Global Administrator: a **Grant read access** button runs an
        interactive consent for that one scope, then scans again.
      - Otherwise: **Copy the consent link**, the tenant's admin-consent URL for
        IAMAI's app id, with "Send it to a Global Administrator".
    - **Test the three outcomes:** not granted (the row and the fallback wording),
      granted but Intune unlicensed ("not visible: no Intune licence"), and granted and
      read.
- **Coverage statement.** Coverage is stated once, at page level: "Sign-ins read
  <from> → <to>" plus "N people read individually".

## The page (segment 4, after layout approval)

In order. Each section answers one question.

1. **Header.** *What is this?* An eyebrow, the heading, one sentence of the passkey
   pitch, the scan time and the evidence window.
2. **The answer.** *How far along are we?*
   - "N of M are Ready", with Seamless beside it as the goal.
   - One segmented bar: Seamless, Ready, Confirm, Needs, Blocked, Unknown.
   - A sub-line: "Ready = phishing-resistant sign-in confirmed in the last 30 days on
     every device type they use." The footer adds that the count covers people active
     in 90 days.
   - **Progress since the last scan,** beside the answer: "+N Ready", "+N Seamless" and
     "N lapse in the next 7 days", with a link to those people.
     - Source: a per-scan summary kept with the history (`mfaHistory.ts`): the scan
       date, each state's count, and each person's state. It holds no raw records.
     - The first scan shows no change block.
     - The lapse count comes from each Ready person's "Ready until" date.
3. **Next check, then the rest of the worklist.** *What do I do first?* The next check
   is not a separate card: it is the first group of the worklist, opened, with its
   explanation and actions under the heading. It is chosen in this order:
   - A **tenant setup check** takes the slot when the people it blocks are more than
     the largest person group. On a tie, setup wins, because those people can't act
     until it lands. It renders as its own block, "Tenant setup, unblocks N people",
     and the blocked people follow as "Waiting on tenant setup".
   - Otherwise the **largest actionable person group** takes it. Groups of Ready people
     never do.
   - The other groups follow in the fixed order, collapsed.
   - The Tenant setup tile in the rail keeps every prerequisite (satisfied checks
     collapsed). When its check holds the slot, the tile says "Shown above as the next
     check".
4. **People, grouped by next action.**
   - Each group is a collapsible section headed by the action and its count.
   - Rows show the person, device chips (a computer and a phone icon, each with a
     state), the phishing-resistant methods held, the last confirmed use and the next
     step.
   - Search, the Admins filter and CSV stay.
   - **At scale** (a group over 50 people):
     - The group splits into sub-groups. **Admins come first**, open, three rows, then
       "Show all N".
     - Then sub-groups by **device setup** (the default: Windows and iPhone, Windows
       only, Mac and iPhone, and so on), because each shares one set of instructions.
     - A **Group by** control offers **Department** instead (`users.department`, which
       is already collected).
     - Each sub-group pages 50 rows, admins first.
     - The acceptance fixture is `large`: no group renders more than 50 rows before the
       admin opens a sub-group.
5. **Person detail.** A non-modal side panel (NN/g: never cover the table):
   - devices seen, with type, OS, join state, last seen, eligibility and best option;
   - methods, with model, compatibility now and after Step 3, and last confirmed use
     and where;
   - one next action;
   - "Ready until <date>".
6. **Explained, not counted.** Each population's count and its action (the Plan step
   link).
7. **Unknown.** One line per reason, with its count and IAMAI's fix.
8. **Recommendations (collapsed).** Seamless upgrades for Ready people, and the
   registration campaign.
9. **Satisfied · N** (collapsed), then the ledger footer: the denominator, coverage,
    and the Inventory link.

Words live in `pages.readiness` (rewritten keys; the commit message says so). Pass the
footer test's word rules ("person", never "user", in page words).

## Plan interplay (segment 6)

- **`s-verify-mfa`.** The `pointer` line points to the rebuilt page's groups. The
  `adminsNote` names only admins who are not yet Ready (audit §4, finding 3), and never
  a completed step as "waiting".
- **`methodPreparation`.** Takes the "seen working" outcome: a successful sign-in with
  the method class under the target strength settles compatibility for that person
  (audit §4, finding 2). The Plan's gates otherwise stay as they are.
- **`MfaHandoff`: Plan previews speak the step's own requirement, never this page's
  bar.**
  - A held step previews the people its own gate names (`stepMfaHold`, from
    `methodPreparation`), in that requirement's words: for example "Has no method
    allowed by Require MFA for Everyone".
  - It then links here with one line: "MFA Readiness holds the higher bar:
    phishing-resistant on every device."
  - The Plan never shows a person as "Needs a method" by this page's standard while the
    step counts them as prepared. The acceptance test: on the demo tenant's held MFA
    steps, every previewed person is one the step's own gate names, worded in the
    step's requirement, and no preview uses this page's state words.
  - "Has" and "Needs" move to `content.json`.

## Fixtures and demo (segment 7)

- **Test fixtures:**
  - add the missing `Voice` configuration;
  - a partial-coverage case;
  - a contractor on a registered-only Windows PC;
  - a separate admin account;
  - a managed and an unmanaged Mac;
  - a Linux user;
  - a key whose model is off Step 3's approved list;
  - a person on leave;
  - a looks-retired account;
  - a new account;
  - a script account.
- **Demo:** tune the demo fixture to tell the passkey story. Mostly Ready, a visible
  Seamless share, one of each actionable group, and one blocked-by-setup check that
  resolves in the follow-up snapshot.

## Acceptance (a unit test per item; live check on GetIAMAI)

- **Live.** Unscoped and step-scoped views state the same state per person. Both
  GetIAMAI people read Ready. A (the admin account, Windows and Android proof) reads
  Seamless only if Windows Hello for Business is confirmed; otherwise Ready, with the
  upgrade as a recommendation.
- **Fixtures:**
  - the large fixture's worklist is grouped by action, with no more than about six
    groups;
  - a proof older than the window never makes anyone Ready;
  - a platform last seen before the window asks nothing;
  - partial coverage without a targeted read reads Unknown with its reason, never
    Confirm it;
  - a contractor's computer asks for no Windows Hello for Business;
  - an off-list key reads "Stops working when you apply Step 3's settings", and without
    Step 3 the page note appears;
  - every Unknown carries a reason and a fix; every explained population carries its
    wording and action;
  - the Intune scope, not consented, yields "not visible" and no failure;
  - the next check is the first group, never a separate card that repeats it. A setup
    check that blocks more people than the largest group takes the slot;
  - on `large`, admins lead every sub-grouped group, and no group shows more than 50
    rows until a sub-group is opened;
  - the progress block's deltas come from the stored per-scan summary, and a first
    scan shows none.
- **Screen.** Desktop 1280 and mobile 375, with no horizontal scroll. The segmented bar
  and the device chips carry text, never colour alone (WCAG 1.4.1). Contrast is AA in
  both themes.

## Guests: options for the owner (not built until chosen)

B2B guests authenticate in their home tenant. The resource tenant sees their methods
only if they registered here.
- **A. The baseline minimum (recommended).** Guests leave the worklist. One tenant-level
  card instead:
  - "Guests: MFA happens in their home tenant";
  - reads the cross-tenant inbound trust setting (under the existing `Policy.Read.All`,
    to verify);
  - states whether the baseline's Require MFA for Guests policy is in place.
- **B. The suggested stronger bar (add to A).** Trust home-tenant MFA and require a
  phishing-resistant authentication strength for guests. This works only where their
  home tenant performs phishing-resistant MFA. Shown as a Recommendation, never a
  requirement.
- **C. Resource-tenant methods.** Guests register a method in this tenant and are listed
  like members. Not recommended: it duplicates their home identity and cannot give them
  a seamless experience.
- **D. Exclude guests entirely,** with a single count in the ledger. Simplest, and
  silent about a real gap.

## Boundaries

- Read-only. The one new scope is `DeviceManagementConfiguration.Read.All`. No write
  scope.
- Never commit tenant-derived data.
- One root cause per commit. Words in `content.json`.
- Tests: `npm run verify -- <focused tests>`. No full suite, smoke or walk. Release by
  the owner's procedure.
- The page UI waits for the owner's approval of the v3 layout, which is then promoted to
  `docs/design/approved/anatomy/` with its manifest hash.

## Execution status (2026-09-18)

Built and shipped: segments 1–7, except the Intune read.

- **The Intune read is held on a contradiction.** `SPEC.md` §2 (a hard decision:
  "One admin-consent screen with the full read scope set. No staged consent")
  contradicts this brief's incremental consent. Microsoft also documents two scopes,
  not one: `DeviceManagementServiceConfig.Read.All` for the Windows Hello for
  Business enrollment configuration, and `DeviceManagementConfiguration.Read.All`
  for the settings catalog (Windows Hello and macOS Platform SSO policies).
  - Until the owner chooses, the snapshot type carries `intune` (IntuneReading).
  - The Windows Hello setup check reads unknown, with the "IAMAI can't see Windows
    Hello for Business settings; check Intune" wording.
  - Eligibility falls back to the join state.
  - The choice is between:
    - adding both scopes to the one consent screen, which forces existing tenants
      to consent again;
    - amending SPEC §2 to allow the incremental path described above.
- **Page contracts.** `docs/qa/page-contracts.json` is not edited (Claude Code never
  edits it). The proposed readiness entry is
  `docs/qa/page-contracts-readiness-v3-proposal.md`.
- **The layout** is promoted to `docs/design/approved/anatomy/mfa-readiness-v3.html`.
  v2 is in `docs/design/superseded/`.

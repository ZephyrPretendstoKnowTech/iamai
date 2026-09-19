# Overnight review, 2026-09-18 → 19: what shipped, what needs you, what comes next

Written for the owner after an unattended night. Everything below was deployed to getiamai.com and verified live (the GetIAMAI tenant in your signed-in Chrome, and the demo), unless it says otherwise.

The five audit reports behind this plan are in `docs/audits/2026-09-18-overnight/`:
- `mfa-readiness.md`: 29 findings from probing the model.
- `emergency-access.md`: every handoff rule traced to its code and its test.
- `foundation.md`: triage of the failing tests, dead code, and Graph data checked against Microsoft Learn.
- `research-leverage.md`: Microsoft's timeline, competing tools, and product opportunities.
- `plan-step-organization.md`: an inventory of every step, and the proposed groups.

**The rules I worked to.**
- **Emergency Access:** review and verify only, plus tiny polish.
- **Steps and pages not yet reviewed together:** plans only; no edits.
- **Engine and foundation:** changes allowed only where approved features don't change.
- **Release procedure:** no full suite, smoke or walk.

---

## 1. What shipped (15 commits, 89f7d3de..8b77016e)

**MFA Readiness: your decisions**
- Guests use option B. They are not counted as people, and a Guests tile appears in the rail. The Windows Hello check is judged by what is seen, with no Intune permission.
- Seamless means the sign-in is built into the device. A phone passkey used from a personal PC is Ready ("it isn't technically seamless. It's just ready").
- The page contract (`page-contracts.json`) is applied with your approval. Readiness rows now count as repeaters.

**MFA Readiness: found on your live tenant**
- Both of you were told to "Add Windows Hello for Business" on a personal PC.
  - Cause: Microsoft reports a sign-in's `deviceId` only for devices registered in Entra ID, so an unregistered PC arrives with no join state, and IAMAI read that as "unknown".
  - Fix: a computer whose records never named a device is now treated as neither joined nor registered. With no Windows computer in the tenant's device directory, the same holds.
- The migration check said "Authentication methods weren't read", but the policy had been read. `policyMigrationState: null` now reads "Nothing to migrate".
- The OS read "Windows10". It now reads "Windows"; see below for why no version is shown.

**MFA Readiness: post-ship audit, 29 findings, model fixes**
- **Carried keys are not Seamless.** A security key carried to an iPhone or a Mac reads Ready. A passkey proof is Seamless only when the person holds that device's built-in form: Authenticator on a phone, a Windows Hello passkey, or a synced passkey.
- **Windows Hello passkeys.** IAMAI now knows all three model IDs. Microsoft Learn (2026-09-03) says they must be named explicitly in an allow list and can't be used where attestation is enforced. They work on personal PCs.
- **Attestation.** It applies only when a passkey is registered (Microsoft Learn). A synced passkey someone already holds keeps working.
- **Step 3.**
  - It is "in place" exactly when Emergency Access Step 3 reads it so, from one reading (`passkeyReadingOf`).
  - Until then, any passkey counts, per your rule. An off-list key is flagged on the credential and is never the only next step.
  - This also fixes audit B2: a Step 3 that kept an extra model read as "not applied".
- **Next steps name something the person can do.**
  - "Sign in once with the passkey on the iPhone" when they already hold one.
  - "Update the Android phone to Android 14, or use a security key" for an old OS.
  - Blocked by setup when passkeys are off tenant-wide.
- **Unknown stays honest.** An unreadable method list still shows the devices seen. A row whose sign-ins weren't read shows "Not read", never "No sign-in seen in 30 days". When sign-ins are unavailable because of the licence, the page no longer promises that a rescan will help.
- **Smaller model fixes.**
  - "Ready until" uses each device's latest phishing-resistant sign-in.
  - A certificate seen in a sign-in counts as held when the registration report has no row for the person.
  - Passkeys enabled for some groups only is a note, not "on".
  - Passkeys off is one failure, not two with a wrong remedy.
  - A registration policy that doesn't reach all users blocks nobody.

**MFA Readiness: page fixes**
- **Rows are never clipped.** Details was hidden at 761–850px and 1041–1190px (iPad landscape). This was checked in the demo at 1100px and 800px.
- **Details buttons name their person** ("Details for Admin"). Focus is kept safe.
- **Words.**
  - Brand names keep their capitals ("Windows Hello for Business", never "the windows hello").
  - An iPad is called an iPad.
  - No Windows version is shown, because sign-in records report Windows 11 as "Windows10".
- **Opened from a Plan step.** The scope line says how many of the step's people this page doesn't count. The next check counts the step's people. The guest step keeps the Guests tile.
- **One method list.** The Plan's preview and the page show the same methods: the shared reading now includes certificates.
- **Speed.** The tenant is scored once per scan rather than once per held step, which is about 250 ms per held step at 25,000 people. Search text is built once per row, and closed sub-groups mount no rows.

**Emergency Access: polish only; nothing changes on screen or in function**
- **Three text regressions restored to the approved output.**
  - Step 2's Entra text names the policies missing the group again. It had been printing "Mode — On / Group exclusion — Present".
  - Step 1's export opens with the screen's action again.
  - Step 2's rail line comes from content rather than from the component.
- **Dead code removed.**
- The Cleanup row component that renders Step 4 no longer returns before its React hooks run (a hooks-order fault).
- **Account id lookups are case-insensitive** (audit B7).
- **The handoff's stale facts are fixed.** Its test command now names every Emergency Access test file, and all 220 of those tests pass.

**Foundation**
- **Stale tests updated.** Nine tests expected wording or markup the product changed on purpose.
- **CSS fixed.** Font values now use the design roles, and a stray 620px breakpoint moved to the Plan's 650px.
- **Dead code removed.**
  - The Intune reading: nothing has collected it since you decided against the Intune permission.
  - Twelve unused content keys.
  - Two unused CSS rules.
  - Unused constants.
- **Tenant data redacted from two committed docs:** a test tenant's admin UPN, and the live emergency account's UPN.

---

## 2. Decisions I need from you

Each has a recommendation. Where it says "default", I'd proceed that way if you say nothing.

### MFA Readiness
1. **Proof per operating system, or per device type?**
   - Today someone with a joined Windows laptop and a Linux box needs proof on both. Your wording said "every device type (phone, computer)".
   - **Recommend per device type.** It's your stated rule, and it spares developers a second key.
2. **Phones and silent sign-ins.**
   - Mobile apps renew tokens silently, so a phone may produce no fresh phishing-resistant sign-in within 30 days. That person stays "Needs a device" indefinitely.
   - The passkey's `lastUsedDateTime` is already collected and unused.
   - **Recommend** using it as supporting evidence: it can move someone from Confirm it to "used recently", but never to Ready on its own. Say so on the page.
3. **Script accounts.** Keep them counted with the "looks like a script" note, or list them under Not counted as the brief's table had it? **Recommend Not counted.** They aren't people who will register a passkey.
4. **Unknown inside Needs action.** People IAMAI couldn't read sit in the Needs action count although their next step is "nothing to do". **Recommend** counting them separately ("Needs action · 21, 1 not read").
5. **Group headings and the phone panel (accessibility).**
   - Group titles live in `<summary>` with no heading.
   - At phone width the non-modal panel covers the whole screen.
   - **Recommend** a visually hidden heading per group, and making the panel modal below 760px. Both change the page's anatomy, so they're yours to approve.
6. **Words that assume Windows.** The lead and the Needs a method body say "Windows Hello on the computer" even in a Mac-only tenant. **Recommend** choosing platform-appropriate words from the devices actually seen.
7. **Three sentences over the 25-word rule.** The goal line, the definition of Ready and the Needs a method body are over it; you approved them in the pack. Keep them, or trim them?

### Engine: changes that move Plan numbers
8. **Passkey usability for the Plan's gates (three red tests: `methodReadiness`).**
   - The gates judge "can this key be used?" with the registration rules, so every key reads unknown when the policy doesn't report attestation.
   - Microsoft: attestation applies at registration only.
   - **Recommend** using the sign-in rules for the gates. Emergency Access approval stays on the registration rules. Plan readiness counts would rise to the truth.
9. **Passkey profiles are merged tenant-wide.**
   - Microsoft requires a person's passkey to satisfy a profile scoped to them.
   - Since 1 September 2026 Microsoft has put every SMS or voice user in an auto-created "all passkeys" profile, so this is now common.
   - **Recommend** reading each person against the profiles scoped to them. `passkeyCompatibility.ts` already does this for Emergency Access.
10. **Phishing-resistant method sets disagree.** `strand.ts` and `mfaViability.ts` ignore synced passkeys and count Authenticator phone sign-in as phishing-resistant, which Microsoft doesn't. **Recommend** one shared set.
11. **Macs with Platform SSO.**
    - `platformCredentialAuthenticationMethod` becomes "other", so these Macs read "Needs a method".
    - **Recommend** mapping it after one real Platform SSO sign-in shows what text Microsoft logs for it.

### Emergency Access (behaviour changes; I held them)
12. **B1: Step 4's "Recorded Test" section.** It shows one account when both are verified, and adds "does not cover the current accounts". **Recommend** showing it only for legacy manual records. The Sign-in Evidence tile already states each account's result.
13. **B3: Report-only policies.** Step 2 completes on enabled policies only, while its tile and Step 4 count Report-only ones. **Recommend** one rule: every applicable policy, Report-only included, needs the group. That matches Step 4.
14. **B4: The start time after an account or group change.** Step 4 uses the scan time, not the change time, so a passkey sign-in between the change and the scan is rejected. **Recommend** the change time, as the handoff specifies.
15. **B5: Step 2 and Step 3 exports don't match the screen.** Step 3's export prints old instructions, including "without key restrictions, leave them off". **Recommend** exporting the task text, as Step 1 now does.
16. **B6 and the demo drill (one red test).**
    - Two validation rules (`bg.drilled`, `bg.lastSignIn`) can't see Step 4's proof.
    - The follow-up demo's drill record uses an old format, so the demo's Step 4 reads "Evidence needed".
    - **Recommend** one function that builds the recovery evidence context for every caller, and updating the demo fixture.
17. **D4 (one red test).** The "hardening" slot on Step 1 can no longer be reached by any fixture. **Recommend** retiring it, unless you want hardening back on Step 1.
18. **Small wording items.** "Initial onmicrosoft.com" in Step 1's Done-when; clearer text for "excluded from the Passkey method"; Title Case versus sentence case on tile labels. Any you want?

### Foundation and process
19. **Pushes to main run no tests.**
    - Since bb385cd0, a push only builds and deploys.
    - The tests went red for several days without anyone seeing it. Tonight's five remaining failures are all items 8, 16 and 17.
    - `CLAUDE.md` still says CI runs the walk.
    - **Recommend** running `tsc` and `npm test` (or the release subset) on push, without blocking the deploy, so red is visible the same day.
    - The separate session fixing the walk's stale readiness checks will correct `CLAUDE.md`'s wording.
20. **Git history holds two live UPNs.** One is in the prompt 60 file (11d3650); the other is the audit reference redacted tonight. The repository is public.
    - Rewriting public history is disruptive.
    - **Recommend** leaving history as it is, since these are your own tenant's accounts, unless you want a `filter-repo` pass.
21. **Your admin address in two approved design packs.** The owner's admin address appears in `connect-v3.html` and its reference copy. They're hash-locked, so changing them needs your approval. **Recommend** a placeholder ("admin@contoso.com") the next time you revise those packs.
22. **REFERENCE-MANIFEST.json** still names the old "final" MFA Readiness page as the authority, and `manifest.json` names v3. **Recommend** marking the old entry superseded.

---

## 3. Organising the Plan's steps (your question)

**Your idea is sound, with one condition.** Emergency Access worked for two sets of reasons:
- **Why it works:** each step owns one outcome and its own checks; completion comes from what the scan sees; a re-scan reopens a step only on a real change; and it ends with a proof.
- **How it looks:** the pinned group and the four headings.

A new group that copies the look without the substance will look finished when it isn't. So the grouping should come with the same bar.

### Proposed groups

**Know Your Tenant** (new, pinned; answers only, no change to Entra)
1. **Map Baseline References.** The biggest choice task, and it's hidden in Plan settings. One unmapped source group holds the create action of 14 policies. Promote it to a Plan row while any mapping is pending.
2. **Confirm the Services You Use.** Today it's the weakest decision step:
   - it isn't in the dependency graph (the Plan's lane code patches it in at runtime);
   - it has no content step and no package;
   - in the demo, it lists its own title as its blocker.
3. **Identify Accounts That Are Not People.** Split the service-account and shared-device selection out of their group and policy steps, the way Emergency Access Step 1 feeds Step 2. That classification drives every people count, not just the group.
4. **Decide How Devices Are Managed**, after Services, because Intune use is a services answer.
5. **Confirm Sign-in Exceptions.** Merge the mail-sending devices, device code and partner/MSP questions that now sit on three policy steps. Each policy then shows the saved answer and links to it.

**Set Up Locations and Groups** (new, pinned after it): Trusted Network, Allowed Countries, Service Accounts Group. Each is a choice plus an Entra object that the scan checks.

**Get Ready for MFA** (not pinned): your own passkey, then the authentication strength, then the team campaign. They gate seven policies' enforce action between them.

**Leave ungrouped:**
- The policy steps, which the Ready / Up Next / On Hold lanes already organise.
- Account hygiene, which has no dependents.
- Security Defaults and per-user MFA, whose gates are policy milestones, so a group holding them would stay open for the whole rollout.

### Two things decide whether it's safe
- **Gates stay per answer, never per group.** If "Know Your Tenant complete" gated policies, one "Not sure" about Azure management would hold Block Legacy Authentication. Exception answers gate enforcement, never report-only creation ("helps with strictness, never requires it").
- **Saved answers must not move.**
  - Answers are stored under the step id plus the question label, and the option's text is the stored answer.
  - Moving a question to a new step needs one alias table first. `BLOCKED.md` already hits this problem four times.

### Prerequisite
Emergency Access grouping is hard-coded by step id in three files. Build one **group registry** first (key, words key, ordered members, pinned or not, completion rule). Emergency Access should behave identically on it, proven by its existing tests and snapshots. Its four section headings also become content keys.

### Recommended answers to the plan's open questions (full list in the report, §7)
- **Two groups or one:** two. "Answered" and "changed in Entra" are different kinds of done.
- **Exception questions:** move them, but only after the alias table exists.
- **Baseline mappings:** yes, make it a Plan row while any mapping is pending.
- **Account-selection split:** yes.
- **Intune "Not in use":** defer the device decision and the Intune policies; don't retire them.
- **Security Defaults and per-user MFA:** keep them in the lanes.
- **Pinning:** Emergency Access first, then Know Your Tenant (it takes minutes).
- **Retire:** `cleanup-notAssessed` (empty on Conditional Access plans), and freeze the free-tier ladder. Keep the hidden travel question until you decide on travel.
- **Tiles:** reuse the Emergency Access subject tile; no new designs.
- **Headings:** the four headings for grouped steps only, for now.
- **Emergency follow-ups:** show Harden and Alert as follow-ups under the completed Emergency Access group.

### Order to bring steps to the Emergency Access standard
1. Baseline mappings.
2. Confirm Services.
3. The group registry.
4. Operator passkey and the MFA campaign. The operator passkey has two test files and gates the campaign; the campaign's snooze days disagree across its channels.
5. The account-selection split.
6. Trusted Network and Allowed Countries. The IP-range entry is the known gap.
7. The merged exception questions, after the alias table.
8. The Security Defaults and per-user MFA cutovers.
9. Account hygiene.
10. Policy packages, as their own track, starting with the channel disagreements already in `BLOCKED.md`.

---

## 4. What comes next for the tool

### The market moment, verified on Microsoft Learn (updated 2026-09-16)
- **1 September 2026:** passkeys became the default. Everyone enabled for SMS or voice was auto-enabled for passkeys, put in an "all passkeys" profile, and prompted to register one at MFA, with unlimited snoozes.
- **1 February 2027:** Microsoft stops delivering SMS and voice for everyone except Global Administrators and external users. After that date, anyone whose **only** method is SMS or voice gets a **blocking** prompt to register a passkey. There is **no opt-out** (internal guests are in this group).
- **1 July 2027:** the same applies to Global Administrators and external users.
- **Microsoft's way to find the affected users** is a PowerShell script that lists which policies and groups have SMS or voice enabled. It doesn't name people, read their methods or read their sign-ins.

**IAMAI already holds that data.** It's the one read-only, free, browser-only tool that can say: these people, on these devices, will hit the blocking prompt, and this is what each should do. That's the pitch.

### Roadmap

**Now (the next two weeks)**
1. **Decisions 8–11** (engine truth), then **12–17** (Emergency Access), so the suite goes green and stays green (decision 19).
2. **SMS and voice retirement card** on MFA Readiness. The derivation is built and tested (`src/derive/smsRetirement.ts`); the card's draft brief, for your review, is `docs/prompts/63-sms-voice-retirement-brief.md`.
   - Who has only SMS or voice, split into the February and July groups.
   - Who used SMS in the last 30 days.
   - Dated, with wording that follows Microsoft's ("prompted to register", never "locked out").
   - No new permission.
3. **The group registry**, then **Know Your Tenant** with Baseline mappings and Confirm Services at the Emergency Access standard.

**Next**
4. **Nudge predictor.** Who Microsoft will prompt, on which device, using Microsoft's own per-platform table as the authority.
5. **Counts-only readiness snapshot** (image or PDF) that is safe to share with leadership or a customer. No names by default.
6. **Windows Hello devices per person**, from the Windows Hello for Business method objects. This covers much of what the declined Intune permission would have given.
7. **Campaign emails aligned** to Microsoft's awareness → action → reminder cadence, scoped to the people still on SMS or voice.

**Later**
8. **MSP tenant selector** (one authority per customer tenant, with the same scopes) and a local table of counts across tenants.
9. **What If cross-check.** Ask Microsoft's own engine to confirm IAMAI's prediction for the Ready people and emergency accounts. It needs only the `Policy.Read.All` permission IAMAI already has.
10. **Tenant trend counts** from Microsoft's authentication-method reports, labelled as Microsoft's numbers.

### Positioning
- **The closest competitor is Microsoft's Conditional Access Optimization Agent**, whose passkey campaigns have been in preview since March 2026. It covers admins only (up to 200), needs Security Copilot capacity, and writes to the tenant.
- **Frame IAMAI as the free, read-only, whole-organisation view that explains why**, complementing the agent rather than competing with it.
- **Keep claims precise.** Phishing-resistant isn't "immune": August 2026 research showed passkey attacks, though each needed an already-compromised device.
- **Never publish cross-tenant averages.** Without telemetry, any "average readiness" would be invented.

### MFA Readiness follow-ups not needing a decision (I'll do these next unless you say otherwise)
- Recognise Platform SSO once decision 11 is settled.
- Profile-aware passkey checks once decision 9 is settled.
- The Plan's heavy synchronous computation on the readiness page: about 2 s on large tenants. Defer it behind a transition.

---

## 5. Left as found (noted, not touched)
- **Walk fix:** a separate session is fixing the walk's stale readiness checks and `CLAUDE.md`'s CI wording.
- **Old worktrees:**
  - `agent-a94715…` holds two commits that never reached main.
  - `C:\Dev\IAMAI-walk` has 47 changed files.
  - I removed six clean, fully merged worktrees.
- **Another runner's files:** `AGENTS.md`, `src/ui/surfaces/finalContentSpecs.test.ts` and a change to `docs/content-review/BLOCKED.md` are uncommitted. I didn't touch them.
- **One more stale link:** "Test Emergency Access and Record the Result →" on the free-tier ladder step should read "Verify Emergency Access →". That step hasn't been reviewed, so it's left for you.

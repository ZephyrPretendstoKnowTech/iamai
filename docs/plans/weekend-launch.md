# Weekend launch: the living hand-off

Target: a public LinkedIn beta on Monday 2026-09-21. The owner and Claude work through Saturday and Sunday. This file is the one place a new session starts from. Update it at every milestone.

## Hand-off prompt (paste into a new session)

> Continue the IAMAI weekend launch. Read `docs/plans/weekend-launch.md` first, then `docs/plans/v1-procedure.md` §3 (the V1 standard). Work from "Next" below. Fast cadence: `npx tsc --noEmit`, `npm run build:site`, focused `node --test --test-isolation=none <files>`, `git diff --check`, commit, `git fetch`, `git push origin HEAD:main`. CI (type check, unit tests, smoke) now runs on every push beside the deploy and never gates it: check it the same day. Run the full suite only at milestones. Tell the owner when context is getting heavy and hand off at a phase boundary.

## Owner decisions this weekend (2026-09-19)

- **Audience:** public (LinkedIn), as a beta.
- **Scope:** "We're going to do it all": design and combine the decision groups, and refresh every next step, by Monday.
- **Jon's groups:** assume IAMAI's identification of each group is right. Where a group follows from a decision, the person creates it and IAMAI maps to it. No basis means the reference is dropped. Break-glass is excluded from every policy, and 5628ad67 is taken as a second break-glass mistake.
- **Design review:** the owner sees every design and recommendation before it's built, and says explicitly when they disagree.
- **Red tests:** clear them, or remove them where they test old data or something already defined as complete.

## Owner answers on the review list (2026-09-19, late morning)

All 31 items in the review list are approved, except these:
- **2:** a "last used" date never makes a person Ready. Also flag passkeys that were never used, or not used for 90+ days, as "registered but not used, may be gone".
- **4:** "not read" is our evidence problem to fix, not the user's:
  - retry failed per-person method reads, then fall back to the registration report;
  - retry the sign-in logs; without P1, say it once at the page level;
  - always read the full 30 days.
- **11:** there's no Mac to test with. Count the registered Platform SSO credential as a method. Never make a Mac Ready without a recognised sign-in.
  - **Microsoft Learn** (Platform Credential for macOS, updated 2026-03-27; the authentication strength known issue):
    - Platform Credential for macOS is "represented in authentication strength under Windows Hello For Business". So a macOS sign-in whose method reads as Windows Hello for Business is the Mac's built-in phishing-resistant credential, and should count as that device's built-in proof.
    - Its WebAuthn AAGUID is `7FD635B3-2EF9-4542-8D9D-164F2C771EFC`. A tenant with passkey key restrictions must allow it, just like the three Windows Hello AAGUIDs (`WINDOWS_HELLO_AAGUIDS` in `phishingResistant.ts`).
  - Sources: https://learn.microsoft.com/en-us/entra/identity/authentication/concept-authentication-platform-credential-for-macos and https://learn.microsoft.com/en-us/answers/questions/1680330/macos-platform-sso-secure-enclave-entra-id-sign-on
- **20:** no history rewrite. The owner renames the break-glass account in the tenant.
- **21:** scrub the owner's tenant data from the tree, and add a guard (a fingerprint list, pre-commit, CI).
- **22:** archive the old files.
- **23:** add a fourth "By Area" view (steps grouped by wave), beside Ready, Up Next and On Hold.
- **24:** D2 needs a better title. Proposed: "Identify Service and Shared Accounts".
- **25:** the lockdown kit (Jon's ZTCA) gets built, as **its own group at the end, after all the other policies**. It's low priority for Monday.

## After launch (context from Jon, 2026-09-19)

- He clarified the purpose in the per-policy READMEs, and will review them further. More changes may come.
- He's testing new policies he may add to the baseline soon ("DFCA"). The pin stays at `90d9b89` for V1; a re-pin is a deliberate, owner-approved event.
- He'd like feedback on the sign-in log feature of his **CA Policy Analyzer**. He's still working on making its results match the Entra portal's sign-in log filters. IAMAI reads the same logs (MFA Readiness evidence), so our lessons may help him: 30-day windows, the method as logged per sign-in, the Platform SSO method appearing as Windows Hello for Business. Post-launch.

## Later: Connect's scan screen (owner, 2026-09-19)

The owner likes the scan screen in Jon's CA Policy Analyzer:
- a shield icon;
- "Ready to Analyze" with "Connected as <name>";
- a live checklist of each read (a tick when done, a spinner while running, greyed out while waiting);
- a progress bar with "Step 7 of 14".

**For IAMAI:** Connect's scan becomes a live list of what's being read (policies, named locations, sign-in logs, methods, and so on), fed by the collector's per-source progress. A source that fails shows as "couldn't read" in place, instead of only surfacing on MFA Readiness later. The design goes to the owner first. It's a Sunday stretch goal if time allows; otherwise it's the first post-launch item.

## Before the public deployment (owner does these)

- [x] **Rename the break-glass account's UPN in the GetIAMAI tenant.** Done 2026-09-20. Its old name is in the public git history. IAMAI is read-only, so the owner does this. Re-scan afterwards so Emergency Access still reads Completed.

## Done

- `7e99ffb4`: CI runs on every push to main, beside the deploy and never gating it.
- `24755bd2`, `f7374a64`, `72201bb1`: Jon's answers; the step inventory; the V1 step map; the Direction spec (approved).
- `db2d1070`: the group registry (`src/roadmap/stepGroups.ts`). Emergency Access runs on it.
- `87b30f1a`: an estimated date is never in the past. Known gap: a policy already ready to enforce still waits one observation window from today.
- `b558ebb3`: the tenant-data scrub, plus `scripts/tenant-guard.mjs` (in CI and in `npm run verify`).
- The baseline docs:
  - `readme-refresh-2026-09-19.md`: Jon's refreshed READMEs mapped against the pin.
  - Owner decisions: single-use TAP; risk remediation for medium-risk users; the sync role kept separate. Since 6 July 2026, the register-security-info policy also covers Windows Hello for Business and Platform SSO setup.
- `becebe29` (31 commits): **the red suite, triaged from 82 failures to 4.** Three P0s fixed:
  - the export guard bypass;
  - the tenant id left in sessionStorage;
  - deny-capable steps offered before Emergency Access Step 1.

  Also: AA contrast, and the large-tenant performance run.
- `840abc1e`: **Direction built and live**, with its commits:
  - `b5e3f1ac`: the registry's anatomy kind;
  - `5460d406`: the engine and `directionAnswers.ts`;
  - `3ea0791d`: per-answer gating;
  - `9c0233ab`: the UI (`DirectionQuestions.tsx`);
  - `840abc1e`: the fixtures and snapshots.

  Checked on the demo: approving D1 took Completed from 3/42 to 4/39 and On Hold from 14 to 8, with no console errors.

## Afternoon session (2026-09-19): landed

- `3a85c604`: the two Linux-only reds (`pwsh` by platform; the 041 report keeps Connect's pre-scrub hash).
- `75e83b97`, `2ff15dae`: Direction polish (content evidence, "Decision step" eyebrow, tiles that don't stretch, Approve moves to the next open Direction step) and the source-reading tests.
- `1d3a1490`, `39c18f18`: free tenants. The free-tier Emergency Access rung is gone; the Plan says first that Conditional Access needs Entra ID P1.
- `e1d28362`, `37067a3e`: item 22. The old MFA Readiness design files are archived; REFERENCE-MANIFEST hands over to v3.
- `b3113b3a`: guests stay in the MFA campaign. One cohort, "30 people and 1 guest" on the Plan and MFA Readiness; guest rows ask for Microsoft Authenticator, never a passkey.
- `664217da`..`666e294b`: the 14 reds the Direction commits caused. Engine fix: Direction gating runs after tracking, so an enforced policy never waits and a waiting step reads Blocked, never Ready.
- `05450e85`..`233db2b6`: MFA Readiness items 5–7. Hidden group headings, the panel is modal below 760px, words by the computers seen (Windows / Mac / both / none), every sentence within 25 words.
- `19490ed8`..`b301954a`: item 4, "not read" as our evidence problem. Per-person method retries, registration-report fallback, longer sign-in retries, the full 30 days, no-P1 said once, "Needs action · 26, 1 not read".
- `0a61e44f`..`9f80a4be`: MFA Readiness items 1, 2, 3, 9, 10, 11. Proof per device type; a last-used date never makes Ready, and unused passkeys are flagged; script accounts under Not counted (demo: 31 → 30 active, "29 people and 1 guest"); passkey profiles read per person; one phishing-resistant method set; Mac Platform SSO counts, its macOS "Windows Hello for Business" sign-in is its proof, and AAGUID `7FD635B3-…` is checked against key restrictions.
- CI on `df5f23e9`: **every unit test passes.** Smoke fails 5 checks (was 8+ Plan failures this morning); an agent is on them.
- `2069e30f`..`df5f23e9`: Emergency Access 12–15 and 18. Recorded Test only for legacy records; one exclusions-group rule; Step 4 starts at the change time; exports print the screen's tasks; wording and sentence-case tiles.

## Owner answers at Gates 1–2 (2026-09-19, afternoon)

- **Policy anatomy + By Area spec** (`policy-anatomy-spec.md`): build as recommended, all 15 decisions. An agent is building it.
- **Direction waits hold the date back:** a policy waiting on a Direction answer is undated until the answer is approved, like every other hold. (Replaces item 1 below.)
- **The exclusions group goes on every On or Report-only policy**, whatever it reaches today: "that's the intent from Jon's baseline" (`7467521e`; replaces item 3 below). The GetIAMAI live check should confirm Emergency Access still reads Completed.
- **"Never used" passkeys:** keep the flag; verify it against GetIAMAI on Sunday.

## The policy step rework (2026-09-19, evening) — owner-directed

The owner rejected the first policy-anatomy build for inventing its own UI, and set the rule: **a policy step must look IDENTICAL to an Establish Emergency Access step. "There will be ZERO lack of uniformity among UI that SHOULD be identical."** Nothing may be added that an Emergency Access step does not already draw; anything that seems needed is written to `docs/plans/policy-anatomy-deviations.md` for approval, never built. Less is more.

**Frozen:** the four Emergency Access steps and the four Direction steps. No UI, wording or behaviour change; suggestions go to `docs/plans/frozen-step-suggestions.md`. (The Direction steps' UI is separately acknowledged as poor and gets its own pass later — not folded into anything else.)

Landed on main (not pushed yet):
- Every policy step renders through the Emergency Access components: the same cards, the same task frame with Task/Method selectors, the same footer. No new component or CSS class; the task-anatomy styling is addressed by `data-policy-task`, so every policy step gets it (it was pinned to five step ids, which would have clipped the procedure everywhere else).
- The policy's own work is a card of its own, so a step can never read "No tasks remaining" while a task sits below it. The lifecycle track is unnecessary rather than hidden: its stages are the card's checks.
- Each card says one thing: the policy card states its next stage, the prerequisite cards state what is waited on. "Report-only doesn't enforce" appears once per step.
- **No policy step is Ready until both pinned groups are settled** (owner): Emergency Access complete and every Direction answer approved. Demo first visit: Ready 16 → 8; held rows are undated and name what they wait on. Prerequisite objects and the campaign are not gated.
- "Settings for This Action" is back on one policy only (`s-goal-admin-session`), folded, for the owner to judge before it goes wider.
- Every step now sits in a group (`src/roadmap/stepGroups.ts`), nine groups; each group's rows are numbered from 1, tinted with the existing lane tone, and the numbers do not renumber when a lane tab filters. Renaming, moving, reordering, splitting or merging is a one-file edit. `docs/plans/policy-groups-proposal.md` is written to be redlined.
- The By Area tab was dropped: a group heading already says what it said.

## Owner answers at Gate 1 (CI fully green at `c7682fb5`, 2026-09-19 evening)

- **Require MFA for Everyone (and any enforced policy):** a correction that only adds exclusions is offered now, not held by readiness. The body keeps the tenant's existing exclusions; a Cleanup row asks to remove a by-name emergency-account exclusion once the group covers it. An agent is building it.
- **A not-deployed policy waiting on Direction** says "Answer {Direction step} first" and offers no creation. Same agent.
- Landed since Gate 2: `7d156f3d` (an enforced policy awaiting its workflow test no longer reads "Not supported"), `2acbd97f` (Direction waits are undated), `1e1528b2`/`c7682fb5` (smoke runs against its own production build; the cause of the blank-Plan flake was Chrome's `ERR_INSUFFICIENT_RESOURCES` on hundreds of dev-server modules). The walk still starts a dev server and needs the same move before its next local run.

## Where it stands (2026-09-20, 05:xx): all nine groups pushed, CI green, deployed

`e7befb60` on main: **CI green (type check, 3,190 unit tests, browser smoke) and deployed to getiamai.com.** 128 commits since `44f6552d`. The live demo shows the nine groups, numbered rows, the foundation gate holding the policies, and every step drawing the Emergency Access anatomy.

**What a new session should read first:** this file, then `docs/plans/step-redundancy-analysis.md`, then the seven wave specs (`close-doors-spec.md`, `protect-admins-spec.md`, `mfa-everyone-spec.md`, `where-people-sign-in-spec.md`, `require-healthy-devices-spec.md`, `risk-and-sessions-spec.md`, `ongoing-spec.md`), then `docs/plans/frozen-step-suggestions.md` and `docs/plans/policy-anatomy-deviations.md` — the two lists of things held for the owner rather than built.

**Still owed to the owner:** the owner's own audit of every step ("we'll go through each step to make sure it's up to snuff"), the Direction steps' UI pass (acknowledged as poor, frozen for now, its own job), and the decisions in the two held lists.

## Overnight, 2026-09-19 → 20: every group rebuilt

Order of work: redundancy read first (the owner's rule — evaluate a step for redundancy BEFORE building it), then the anatomy, then each group end to end.

- **`docs/plans/step-redundancy-analysis.md`** — 67 steps catalogued (asks / checks / produces / completes), 15 findings ranked. **Eleven step identities removed** with no outcome lost: five registry members the engine could never build (one not even a valid goal id), a cleanup row duplicating the baseline review rows, two "question" steps that were pointers at other steps, and two ladder rungs that defer to the steps they already were. The `s-question-` prefix is gone. The owner's own example — the Trusted Network step asking what D4 already asks — is fixed: it is the doing of D4's answer.
- **Every step that carries work draws the Emergency Access anatomy.** One registry field decides it; two duplicate predicates deleted. Cleanup rows keep their shape (owner). Object, campaign, check and review steps now have real Tasks Remaining cards and real Implementation Tasks.
- **"Settings for This Action"** folds under the Entra procedure on every policy step (owner-approved deviation).
- **The frozen steps' links and portal paths** were corrected (dead passkey link; `Protection →` and `Identity →` are `Entra ID →` in Microsoft's current articles). Nothing else on them was touched; `docs/plans/frozen-step-suggestions.md` holds the rest.
- **Groups 3–6 end to end**, each with a spec naming every Learn page, its `ms.date` and the date checked: `close-doors-spec.md`, `protect-admins-spec.md`, `mfa-everyone-spec.md`, `where-people-sign-in-spec.md`.

### The trap that ran through the whole baseline

A Conditional Access condition left at **Configure: No** matches *everything*. Every procedure that named Client apps, Network/Locations or Authentication flows without setting Configure first described a policy far wider than the one intended — a session limit that hits every mobile app, a registration policy that matches every location. Group 3 found it in four steps; group 4 found it in **`src/roadmap/portalLines.ts`**, the one translator that composes every policy step's portal lines, and fixed it at the source.

### Other corrections worth the owner's eye

- Turning security defaults off without **Block Device Code Sign-in** reopens that route: defaults now block it.
- The device-registration policy cannot be satisfied by Windows Hello or a device-bound passkey (the device must already be registered), while the pinned strength leads with both.
- PIM: the procedure created the policy in report-only and then told the admin to point roles at it — in report-only, activation then requires nothing at all.
- A countries location has no "trusted" flag; the step instructed setting one.
- Registering a passkey needs MFA within the past five minutes, which is why most first attempts fail.
- Guests can register Microsoft Authenticator but not a passkey in the resource tenant, and cannot be issued a Temporary Access Pass.

## For the owner to confirm (decided so work could continue)

1. **Direction waits and dates:** a policy waiting on a Direction answer keeps its date (the device policy on the demo shows "On Hold · Waiting on your direction" beside a date). If a wait should hold the date back, the Direction exception in `holdOf` (`src/roadmap/holds.ts`) comes out.
2. **The week-two demo leaves D3 open** (from the Direction build).
3. **Exclusions group rule (item 13):** "applicable" means a policy that reaches an emergency account (All users, the account, one of its roles, or a group it is in), On or Report-only. An On policy that targets only other users does not hold Step 2. Step 4 already worked this way.
4. **Step 2's export** prints every task the screen shows, including the optional "Create an emergency exclusions group". One line to print required tasks only.
5. **Free tier:** "Review Global Administrator access" no longer requires two selected emergency accounts (nothing can select them now).
6. **The walk's heading list** (`docs/qa/page-contracts.json`, owner-owned) needs the four hidden MFA Readiness group headings, or the walk flags them.
7. **Still Windows-worded on a Mac-only tenant:** `seamlessNone` and the "Needs a method" reason ("No passkey, security key or Windows Hello yet").
8. **"Never used" passkeys (item 2):** a beta method row whose `lastUsedDateTime` is an explicit null reads "never used"; a row without the field stays unknown. If Microsoft's null means "not tracked", the flag would show on keys in use (it is suppressed when the sign-in logs show the passkey working).
9. **Passkey profiles targeted at a group (item 9)** read "unknown" in the Plan and page counts, because counting runs without group membership. Passing groups in is a signature change across the counting code.
10. **Loose ends:** the device-plan reason and tile words are unused now; on the demo's first visit the trusted-location step reads Ready with a "Choose your office networks" tile although that question lives in D4. A very large tenant can still stop before 30 days at the 50,000-row ceiling.

## Next (in order)

1. ~~**Check CI for `840abc1e`.**~~ Done (see the afternoon session). The triage push had 11 failures on CI against 4 locally. The 7 extra are Linux-only:
   - the PowerShell parser and role-page tests;
   - "the final verification report exists" (probably filename case);
   - "the campaign lists… derive from Today";
   - "readiness numbers are one set";
   - "MFA preparation row… whole cohort".

   Fix them.
2. ~~**The last 4 red tests, with the owner's answers:**~~ Done.
   - **Free tenants:** without P1, the Plan says Conditional Access needs Entra ID P1. Remove the free-tier Emergency Access path and its test (`structuralCorrections` "free-licence emergency accounts…").
   - **Guests "the way Jon envisioned":** guests STAY in the MFA campaign and its preparation (Authenticator nudges work for guests; passkeys don't until late 2026). Reconcile the numbers with the same words everywhere ("30 people and 1 guest") instead of dropping guests. Tests: `planStrip`, `variableLayer`, `preparationPresentation`.
3. ~~**Direction polish,** seen on the demo:~~ Done; the two open Direction decisions are in "For the owner to confirm".
   - the eyebrow reads "CHECK STEP"; it should be a decision step;
   - the evidence lines are raw engine reasons ("no sign-in activity for inforcer"); they should come from content, capitalised, as plain sentences;
   - odd spacing on the Entra Connect tile;
   - after Approve answers the page jumps to the top; it should go to the next Direction step.

   Open the Direction agent's decisions for the owner:
   - the week-two demo leaves D3 open;
   - a Direction wait adds no date change.
4. ~~**The approved review items:**~~ All landed:
   - MFA Readiness items 1–7 and 9–11, including Mac Platform SSO: a macOS sign-in reading "Windows Hello for Business" counts as the Mac's built-in proof, plus the key restriction needs AAGUID `7FD635B3-2EF9-4542-8D9D-164F2C771EFC`;
   - "not read" as an evidence fix;
   - Emergency Access bugs 12–15 and 18;
   - item 22: archive the old manifest.
5. **One policy anatomy for every policy step** (the V1 map §6), then the "By Area" view, then the words for waves 1–4. Protect Sign-in Method Registration must allow Windows Hello and Platform SSO setup for remote workers.
6. **Sunday:** launch readiness (Home and How accuracy, phone widths, privacy), a full-suite milestone, and a live GetIAMAI check with the owner.

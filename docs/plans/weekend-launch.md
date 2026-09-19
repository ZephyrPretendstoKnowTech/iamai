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

- [ ] **Rename the break-glass account's UPN in the GetIAMAI tenant.** Its old name is in the public git history. IAMAI is read-only, so the owner does this. Re-scan afterwards so Emergency Access still reads Completed.

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

## In flight (2026-09-19 afternoon session)

- `3a85c604`: CI's Linux-only reds were two, not seven: the PowerShell harness spawned `pwsh.exe` (Linux has `pwsh`), and the 041 report test compared against Connect's post-scrub hash (the dated report keeps the hash it verified).
- `75e83b97`: Direction polish (Next 3): evidence lines from content, "Decision step" eyebrow, tiles that don't stretch, Approve moves to the next open Direction step (checked on the demo).
- `2ff15dae`: planAnatomy and planVariants read the Direction code as it is.
- **CI on `3a85c604` showed 21 reds, not 11.** The Direction commits broke 13 more (holds, stepSchedule, blockedReason, rescanDurability, semanticIntegrity, readinessTiles, aiGrounding and others). An agent is on them.
- Agents in worktrees: free-tier EA path removal; guests in the campaign ("30 people and 1 guest"); Direction reds; Emergency Access 12–15 and 18; item 22 archive.

## Next (in order)

1. **Check CI for `840abc1e`.** The triage push had 11 failures on CI against 4 locally. The 7 extra are Linux-only:
   - the PowerShell parser and role-page tests;
   - "the final verification report exists" (probably filename case);
   - "the campaign lists… derive from Today";
   - "readiness numbers are one set";
   - "MFA preparation row… whole cohort".

   Fix them.
2. **The last 4 red tests, with the owner's answers:**
   - **Free tenants:** without P1, the Plan says Conditional Access needs Entra ID P1. Remove the free-tier Emergency Access path and its test (`structuralCorrections` "free-licence emergency accounts…").
   - **Guests "the way Jon envisioned":** guests STAY in the MFA campaign and its preparation (Authenticator nudges work for guests; passkeys don't until late 2026). Reconcile the numbers with the same words everywhere ("30 people and 1 guest") instead of dropping guests. Tests: `planStrip`, `variableLayer`, `preparationPresentation`.
3. **Direction polish,** seen on the demo:
   - the eyebrow reads "CHECK STEP"; it should be a decision step;
   - the evidence lines are raw engine reasons ("no sign-in activity for inforcer"); they should come from content, capitalised, as plain sentences;
   - odd spacing on the Entra Connect tile;
   - after Approve answers the page jumps to the top; it should go to the next Direction step.

   Open the Direction agent's decisions for the owner:
   - the week-two demo leaves D3 open;
   - a Direction wait adds no date change.
4. **The approved review items:**
   - MFA Readiness items 1–7 and 9–11, including Mac Platform SSO: a macOS sign-in reading "Windows Hello for Business" counts as the Mac's built-in proof, plus the key restriction needs AAGUID `7FD635B3-2EF9-4542-8D9D-164F2C771EFC`;
   - "not read" as an evidence fix;
   - Emergency Access bugs 12–15 and 18;
   - item 22: archive the old manifest.
5. **One policy anatomy for every policy step** (the V1 map §6), then the "By Area" view, then the words for waves 1–4. Protect Sign-in Method Registration must allow Windows Hello and Platform SSO setup for remote workers.
6. **Sunday:** launch readiness (Home and How accuracy, phone widths, privacy), a full-suite milestone, and a live GetIAMAI check with the owner.

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

## Before the public deployment (owner does these)

- [ ] **Rename the break-glass account's UPN in the GetIAMAI tenant.** Its old name is in the public git history. IAMAI is read-only, so the owner does this. Re-scan afterwards so Emergency Access still reads Completed.

## Done

- `7e99ffb4`: CI runs on every push to main, beside the deploy and never gating it. The first run showed about 60 red tests, not 5; an agent is triaging them.
- `24755bd2`, `f7374a64`: Jon's answers recorded; the step inventory; the V1 step map.
- `db2d1070`: the group registry (`src/roadmap/stepGroups.ts`). Emergency Access runs on it with no visible change.
- `87b30f1a`: an estimated date is never in the past. Known gap: a policy already ready to enforce still waits one observation window from today.

## Next

1. Land the red-suite triage and the tenant-data scrub (agents running in worktrees).
2. The Direction spec (`docs/plans/direction-spec.md`) goes to the owner for review, then gets built on the registry.
3. The approved review items, in the build queue.
4. One policy anatomy for every policy step, then per-wave word reviews (waves 1–4 first), then the "By Area" view.
5. Launch readiness on Sunday, with a full-suite milestone each night.

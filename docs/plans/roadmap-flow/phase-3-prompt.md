# Phase 3 prompt: sections 5 to 8 (from 2026-09-25)

Paste the prompt below into a new chat. This file carries no tenant data, and nothing in it may name a person, a UPN, a group, a policy id or a tenant id.

## The prompt

> Read `docs/plans/roadmap-flow/phase-3-prompt.md` first, then `v1-plan.md`, `intent.md` and `step-template.md` in the same folder. CLAUDE.md and the memory index load on their own and are authority. We're starting Phase 3: sections 5 to 8, one section per round, at the full standard. Start with the Chrome audit of 5.x on my tenant, and the demo for any state my tenant can't show. Read every line against intent.md's seven questions and report a short, plain findings list, with the carried-in items below for 5.x marked. Don't change anything until I pick.

## Where things stand
- **Phase 2 is done and live** (pushed 2026-09-25). One commit per part on `main`:
  - **2a:** Jon's policies only. Shared-device accounts join the service-accounts group. "Phones: blocked" widens Jon's Block Unsupported Device Platforms. 5628ad67 is assumed absent (a second break-glass group).
  - **2b:** AVD and SharePoint blocks outside the trusted network are policy steps. AllowedAVDUsers and WindowsAzureAD-BaselineScopes are hidden (v1.1 list).
  - **2c:** Block Risky Users From Registering Sign-in Methods is a new step after Remediate High-Risk Users. EAM High-Risk Users is that step's second policy where the scan sees an external MFA provider; without one, its population is left out.
  - **2d:** with everyone working remotely, the service-accounts, SharePoint and AVD blocks read Doesn't apply, and so does the service-accounts group.
  - **2e:** user-action policies (5.1, 5.2 and the new risky-users block) are created On. They get no report-only week, no registration test, and 3.8 doesn't list them. Whatever holds a turn-on holds their create. 5.2 waits until everyone it covers has a method its strength accepts, and its card names each person who doesn't, with MFA Readiness's next step.
- **Verified:**
  - full suite green;
  - `npm run verify -- --prepush`;
  - live check in Chrome after the deploy.
- **CI** runs on demand only, once, in Phase 5.
- **Test users:** the owner sets up three on 2026-09-25 morning:
  - Authenticator registered and never used;
  - text only;
  - a passkey registered but signing in with push.

  Until then, each pitfall is proved by a unit test and checked on the demo. The live check follows a scan the owner approves.

## How we work
- **The loop, one section at a time:**
  1. Audit the section yourself in Claude in Chrome, on the owner's tenant (getiamai.com/planner; the owner is signed in). Never use a workflow or subagents for an audit.
  2. The owner picks.
  3. One branch from `origin/main`. Make small fixes, then run tsc, `node scripts/step-snapshots.mjs` (commit it as "[snapshots]" when they move), the focused tests, and `npm run verify -- --prepush <tests>`.
  4. Ask before pushing. A push to main deploys.
  5. Re-check in Chrome.
- **Do only the literal ask.** Ask before any fix, push, deploy, tenant scan or agent launch the owner hasn't approved in the same message. Decide small calls yourself. Batch the questions that change direction, and explain an unfamiliar concept with a real scenario before asking.
- **Never enter a password.** If a sign-in or consent prompt appears, stop and hand it to the owner.
- **Tests:**
  - Run with `node --test --test-isolation=none <files>`, putting `src/content/content.test.ts` first.
  - `npm test` is the whole suite (about 10 minutes); run it in the background.
  - Focused runs miss files you didn't name. Phase 2 found several tests that had been broken for a day, so run the whole suite before a push.
- **Heredocs and python-in-bash lose backslashes** (`\n` becomes a real newline). Write scripts with the Write tool, and use the Edit tool for lines that contain them.
- **Name every new content key in its commit message.** Don't read `content.json` whole; grep for the key. Don't read `archive/`.

## Scope (v1-plan.md, Phase 3)
- **5.x** (Extend MFA Coverage):
  - net-new 29: 5.3's When column;
  - net-new 30: the owner's decision on the four r6 branches (below);
  - the 5.2 pitfall: registering a device needs a passkey, Windows Hello or a Temporary Access Pass, and a device-bound passkey can't answer it on the device being registered.
- **6.x** (Close the Doors Nobody Should Use), **7.x** (Limit Sessions and Require Healthy Devices), **8.x** (Ongoing Checks and Cleanup).

## Carried in from Phase 2, for the owner to pick
1. **5.2 counts guests and waits for everyone it covers.** Jon's policy includes All users, and MFA Readiness says passkeys don't work for guests yet. A tenant with guests may never reach 100%, so 5.2 never gets created. Options:
   - leave guests out of 5.2's count;
   - let Turn On Without Them apply to 5.2;
   - keep the gate literal.
2. **The r6 branches overlap Phase 2.** `fix/r6-plan` ("with everyone remote, Restrict Service Accounts … does not apply") is what 2d now does. `fix/r6-registration` changes what a remote team's 5.1 waits on. Decide each against the live main; don't merge them as they are.
3. **5.1 and 5.2 packages.** Their create blocks (Entra, JSON, PowerShell, AI Info) now create On. Each package's enforce path is still there, for a copy somebody left in Report-only. Read both packages on screen in the 5.x audit.
4. **Held rows show "Est." dates in the When column** (the board forecast, owner 2026-09-23). Confirm this against "held steps are undated everywhere".
5. **5.3 guests:**
   - Impact reads "1 person";
   - the "Verify the workflow" task;
   - the Guest Directory lecture.
6. **5.1:** the Workflow Check and the About qualifier (round 1 audit). 5.1 no longer has a registration test, so re-read it.
7. **EAM wording:** does Remediate High-Risk Users say it has two policies, and why, where an external MFA provider is used?
8. **SharePoint on 2.1:** Yes keeps the step. Confirm the question's words say what each answer does.
9. **The wider-built-policy gap** (parked in round 1): a tenant policy built wider than Jon's is adopted as-is.
10. **6.2 pitfall:** with phones blocked, Jon's Block Unsupported Device Platforms stops a phone from registering an Authenticator passkey. Say so where the answer is chosen, before the block is created.
11. **The demo's follow-up scan is a remote team.** Its service-accounts group and block, and its AVD and SharePoint blocks, now read Doesn't apply there. That is Phase 5's demo refresh, not a Phase 3 fix.
12. **planState's floor-dated rule has no fixture left.** 5.1 is the fixtures' only floor row, and readiness now holds it undated.
13. **A created-On step has no Dates line.** A step waiting to deploy reads `{datesDeploy}` ("Report-only from …"), and a created-On step has no report-only day, so the line is dropped rather than wrong. Decide its words, for example "Announce … · Create On …".
14. **The Plan → MFA Readiness handoff isn't drawn anywhere.** The block "N people are not yet confirmed ready for this sign-in requirement", with its link, sits under the plain readiness layout. Since 2a, every step held on its own sign-in requirement uses the task layout (4.3, 4.4, 5.1, 5.2), so no step draws it. The smoke opens the scoped MFA Readiness page directly instead. Options:
    - draw the handoff on task-layout steps;
    - retire it, because the Threshold card names the people now.

## After Phase 3
Phase 4 is the surfaces: MFA Readiness, Connect, then Export. Phase 5 runs CI once, then refreshes the demo last. The v1.1 list is `docs/plans/roadmap-flow/v1.1-list.md`.

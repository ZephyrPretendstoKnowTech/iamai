# The plan to a complete v1.0 (from 2026-09-24)

This replaces the round table in handoff-2026-09-24.md. intent.md and step-template.md stay the standard. Timing is not the constraint: v1.0 is done when every section meets the seven questions and every step follows the template. The hand-off's loop stays: audit in Chrome, the owner picks, one branch, small verified commits, ask before every push, re-check in Chrome.

## The order, and why
1. **Single sources first.** Anything several steps read is fixed once before the steps that read it, so no card is written twice.
2. **Round 1 next (1.x–4.x),** because every item in it is decided.
3. **Structure before polish.** The batch that decides which steps exist (Jon-only, review rows, the two new P2 policies, the remote-team rule) runs before 5.x–8.x are audited. Polishing a step that is about to be removed or reshaped is wasted work.
4. **Sections 5–8,** one at a time, at the full standard.
5. **The surfaces:** MFA Readiness, Connect, Export.
6. **CI once, then the demo, last.**

## Phase 1 — Round 1: sections 1–4 (decided)
Every item here was decided by the owner in the round 1 chat (2026-09-24).

**1a. One source for passkey setup and passkey sign-in.** Emergency Access already has the right procedure (`authenticatorSteps`: open Microsoft Authenticator, select the account, Create a passkey, turn on a screen lock, pick Authenticator as the passkey provider). It never sends anyone to https://aka.ms/mfasetup, which leads people the wrong way. The MFA Readiness method guides, 3.3, 3.4's procedure and its emails all read that one source. The sign-in line is one shared sentence, in Microsoft Learn's words: "after the username, choose Other ways to sign in, then Face, fingerprint, PIN or security key."
- *Check:* no step, email or guide tells a person to open aka.ms/mfasetup to create an Authenticator passkey.

**1b. About rewrites** on 2.1, 2.2, 3.1, 3.3, 3.5, 4.3 and 4.4, as approved. 2.3 waits for Phase 2, because its answers change there.

**1c. 3.4 Prepare Your Team for MFA:**
- the push-back line first;
- the card names its own people, each with MFA Readiness's next step, folded after five, and keeps Open MFA Readiness;
- line 2 reads "Anyone named in Tasks Remaining";
- "sign in once" names the method and the path to pick it;
- the email and the follow-up are rewritten. The computer paragraph follows 2.3: Windows Hello where computers are managed and the scan sees joined Windows computers, and otherwise the phone passkey used from the computer.

**1d. 4.3 and 4.4 pitfall cards.**
- **4.3:** each admin who isn't Ready on MFA Readiness, named with the exact method and device. The scan checks the method, so a push or a text doesn't count, and the line says what they used instead. The turn-on waits until every admin is Ready.
- **4.4:** people who have a method but no MFA sign-in in the last 30 days, each with MFA Readiness's next step. The card informs; it never holds the turn-on.

**1e. The other pitfalls the scan can see, in sections 1–4:**
- accounts that sign in only from PowerShell or Graph tools, suggested on 2.2 and named on 4.4;
- shared-device accounts not picked on 2.2, named on 4.4;
- Temporary Access Pass off while 3.4 says to issue one;
- people on text or call only, named on 3.4;
- legacy and device-code users, named on 4.1 and 4.2 before the block is created.

Each pitfall gets a fixture and a unit test, and an on-screen check on the demo.

**1f. 3.8 Create the Policies in Report-only**, at the end of section 3:
- **Lists:** every policy Jon's baseline and the tenant's licences allow;
- **Includes:** policies held only by order or a readiness threshold;
- **Leaves out:**
  - user-action policies;
  - compliant- or managed-device policies;
  - the countries policy;
  - policies held on an unresolved object;
  - doesn't-apply, not-licensed and deferred policies.
- **Completes** when the scan sees each listed policy in Report-only or On.
- **Also:** the "N policies are ready to create in report-only now" line above the Plan goes, and the policy card reads "Report-only until {date}; scan after that day."

**1g. The net-new items for sections 1–4** (review-2026-09-24/00-net-new.md 1–28): every recommendation at the end of this file (decision 7).

**1h. High-care code removed** (decision 6). Nothing showed on screen in 1.x–4.x; the Turn On Without Them list stays.

## Phase 2 — Structure: which steps exist
- **2a. Jon's policies only.** Answers adapt Jon's policies; the plan authors none of its own. Out go app protection for phones, unmanaged-browser session limits, Keep Company Data Off Phones, Give Shared Devices Their Own Policy and the separate Azure management step. "Phones: blocked" uses Jon's Block Unsupported Device Platforms. Each step shows Jon's version beside the person's choice. 2.2 and 2.3 wording follows. 5.1 stays: it is what Jon said his export meant.
- **2b. Review rows become policy steps:** AVD NonTrustedLocations and SharePoint. AVD AllowedAVDUsers and WindowsAzureAD-BaselineScopes are hidden for v1.0 (decision 2).
- **2c. New P2 steps:** Block Risky Users From Registering Sign-in Methods (RiskyUsers-RegisterSecurityInfo), and EAM High-Risk Users as the second policy of Remediate High-Risk Users where an external MFA provider is configured.
- **2d. Remote teams:** every "block outside the trusted network" policy reads Doesn't apply for a team with no office. The service-accounts case was approved on 2026-09-24.
- **2e. User-action policies** (5.1, 5.2) are created On, with no report-only week and no registration test (decision 3). 5.2's turn-on waits for the passkey campaign (decision 4).

## Phase 3 — Sections 5 to 8, at the full standard
One section per round: Chrome audit on the owner's tenant, plus the demo for pitfall states the tenant can't show; the owner picks; fix; re-check.
- **5.x:** includes net-new 29 (5.3's When column) and the decision on the four r6 branches (net-new 30). Also the 5.2 pitfall: registering a device needs a passkey, Windows Hello or a Temporary Access Pass.
- **6.x**
- **7.x**
- **8.x**

## Phase 4 — The surfaces
- **MFA Readiness:** one language with the Plan.
- **Connect.**
- **Export,** its own walk: print, exports, prompt pack, and net-new 15.

## Phase 5 — Finish
- CI once, on demand.
- The demo refreshed last, so it shows the finished tool.

## Design decisions (owner, 2026-09-24)
1. **Shared-device accounts under Jon-only:** identify Jon's two unnamed exclusion groups first (his compliant-device and Admin Portal policies). If one is his shared-device carve-out, shared-device accounts go in it; otherwise back to the owner.
2. **AVD's allowed-user group and WindowsAzureAD-BaselineScopes' excluded group** are unidentified. Those two policies are left out of v1.0 and hidden so nothing shows them; they go on the v1.1 list.
3. **User-action policies (5.1, 5.2):** create them On. No report-only week and no registration test: MFA has already been done by then. 3.8 doesn't list them.
4. **5.2 Require MFA to Register a Device** waits for the passkey campaign: its turn-on waits until the people it covers are Ready, and its card names anyone who isn't, with their next step.
5. **Remote teams:** every policy whose only purpose is blocking outside the trusted network (service accounts, SharePoint and OneDrive, AVD) reads Doesn't apply for a team with no office.
6. **High-care code** is removed. The Turn On Without Them list stays.
7. **Net-new 1–28:** apply every recommendation below in round 1.
8. **Test users:** the owner sets up three on 2026-09-25 morning (Authenticator registered and never used; text only; a passkey registered but signing in with push). Until then each pitfall is proved by a unit test and checked on the demo. After that, the live check follows a scan the owner approves.

## Net-new 1–28: recommendations
| # | Item | Recommendation |
|---|---|---|
| 1 | "Could not verify" words on 1.1–1.3; 1.3 "Allow list not established" | The card states what IAMAI holds; delete the rest (banned phrasing) |
| 2 | 1.1 "Missing scan evidence" on a failed read | Delete: no real tenant has shown it |
| 3 | 1.3 card and task counts differ | One count, the lock-outs, named |
| 4 | 1.3 Completed while a task is still required | Not Completed while a task is required |
| 5 | SharePoint evidence on fixtures | Demo round |
| 6 | Reopened with no line | Keep the reopen; add the line saying what the scan saw |
| 7 | Service short name vs card label | Keep |
| 8 | 2.3 computers note follows the saved phone answer | Fix with Phase 2's 2.3 work |
| 9 | "Answer it in {step}." in AI Info | Delete |
| 10 | The deleted device-code question's leftover code | Delete |
| 11 | Hard-coded save alert | Move into content.json |
| 12 | Inventory's /agents?/ pattern | Fix in the Inventory pass (Phase 4) |
| 13 | No Graph-shaped fixture | Add one: the pitfall proofs need it |
| 14 | 4.4 "Not as asked · target resources differ" | Investigate in round 1 |
| 15 | Print "No unresolved checks" | Export walk |
| 16 | Stale procedure copies (3.4, 3.3) | Delete |
| 17 | 3.4 "Who this touches" vs Impact | One count |
| 18 | 3.4's picker offers the operator | Leave the operator out |
| 19 | 3.1 "this scan cannot tell…" | Delete |
| 20 | Held 3.6 with a trusted location already in Entra | Say it exists; no create procedure |
| 21 | 3.7 unsaved group | Keep (suggest, never assume) |
| 22 | 4.4 and 4.6 dated a week after 4.5 | Same day as 4.5 |
| 23 | 4.5 prerequisite cards "Waiting" with no reason | Name the wait |
| 24 | 4.5 on a failed security-defaults read | Delete the line for the unread state |
| 25 | 4.4 Satisfied counts the admin requirement once 4.3 is On | Fix |
| 26 | 4.1 waits on the mail answer when nobody used legacy authentication | Let it proceed |
| 27 | 4.2's old procedure in CONTENT.md | Delete |
| 28 | Unreachable correction lines | Delete |

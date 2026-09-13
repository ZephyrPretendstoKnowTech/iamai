# SEGMENTS-B — run in order, fresh session each, /effort high

Segment ids: B1 B2 B3 B4 B5 B6 B7 B8 B9 B10 B11 B12 B13.

B1–B5 are complete. Resume from B6.

---

## B6 — Data: pre-fill pickers, exclusion-group investigation

READ: RUN-CONTEXT-B.md; MASTER (U24, U27); `src/roadmap/coverage.ts`, `src/roadmap/generate.ts`, `src/ui/surfaces/stepPackage.ts` (bindings); STEPS/step-exclusions-group.md, STEPS/step-block-legacy-auth.md.

DO:
1. **U27 — exclusion-group investigation.** Read the plan record's exclusion-group step. Read the scan's group data for "Breakglass Exclusion" or "Core - Exclusions". Read Block Legacy Auth's policy `conditions.users.excludeGroups`. Determine why the step reports a missing exclusion when the group exists. Document the root cause in BLOCKED.md under "U27 investigation". Fix the root cause if it's a matching bug. If it's "baseline mapping not resolved," document that.
2. **U24 — pre-fill pickers.** In the step input components (account picker, group picker, strength picker): add a `matchedObjects` or `defaultValue` prop. When the scan finds an unambiguous match and the plan record has no saved value, pre-fill the picker. The pre-fill does NOT write to the plan record — only Save does. Test: picker shows matched object, badge still reads "Decision", Save writes the record.
3. Update snapshots with `[snapshots]`.

DONE-WHEN: U27 root cause documented; pre-fill works on at least one picker; suite green; committed.

---

## B7 — Content fixes: channel gaps, generation rules, conditional inputs

READ: RUN-CONTEXT-B.md; STEPS/step-sign-in-risk-high.md, STEPS/step-user-risk.md, STEPS/step-workload-identity.md, STEPS/step-device-code.md.

DO:
1. **High-Risk sign-in channels.** Copy channel content from `docs/implementation-content/s-goal-sign-in-risk-medium/` CONTENT.md to `s-goal-sign-in-risk/`. Adjust risk level from medium to high. Validate with `node scripts/compile-implementation-content.mjs --validate-library`.
2. **High-Risk user-risk channels.** Copy from `s-goal-user-risk-medium/` to `s-goal-user-risk/`. Adjust risk level. Validate.
3. **Workload-identity generation condition.** In `generate.ts` or `registry.ts`: only generate `s-goal-workload-identity-block` when the scan detects a user holding the Directory Synchronization Accounts role. If no such user, skip generation. Test on fixtures.
4. **Device-code conditional input.** Add `decisions.deviceCodeWorkflows` to the plan record schema. Author the input in `s-goal-block-device-code` package content: "Does anyone use device code sign-in for CLI tools, IoT devices, or display-limited devices?" with None / Yes options. Add condition `device-code-workflows-exist` to `dependency-data.json`.
5. Update snapshots with `[snapshots]`.

DONE-WHEN: High-Risk steps have channels; workload-identity skips on fixtures without sync; device-code input exists; validator passes; suite green; committed.

---

## B8 — Per-step content pass: Source checked, Done-when, Learn links, impact labels, milestone text

READ: RUN-CONTEXT-B.md; every file in STEPS/.

DO:
For each step-findings doc, apply the content changes it specifies:
1. **Source checked:** If doc says "Add checkedOn" → add `"checkedOn": "2026-09-12"` to `verifiedSources[]` in the package META.json.
2. **Done-when:** If doc provides a target text → update `doneWhen` in package CONTENT.md.
3. **Learn link:** If doc says "Add inline Learn link" → append ` Learn →` with a URL to the end of the `why` field. Find the URL by searching learn.microsoft.com for the policy type.
4. **Impact fallback label:** Add `"impact": { "fallbackLabel": "<label>" }` to package META.json using the label from the step doc.
5. **Milestone actionText:** Add `"milestone": { "actionText": "<text>" }` to package META.json if the doc specifies one.

**CRITICAL — content that lives only in What-to-do and has no other home:**
6. **Separate Accounts (`s-check-separate-admin-accounts`):** The per-person checklist (create cloud-only admin account, move directory role, register passkey, keep mail/Teams on everyday account) currently lives ONLY in the What-to-do section. B3 removed What-to-do. This content MUST be authored as an Entra Implementation channel in this package's CONTENT.md. If the content is already gone from the rendered step, write it fresh in the Entra channel. Read the step-findings doc S-SA-1 for the target content.
7. **Rename Policies (`cleanup-naming`):** The rename instructions must survive as Implementation content. Verify they still render; if not, move them to an Entra channel.
8. **Review Baseline (`cleanup-notAssessed`):** The 7-policy review list with per-policy Save buttons. Per S-RB-3, these inputs are an exception to U2 — they stay in the main column under Implementation, not the action column. Verify the layout handles this exception. If the inputs are in the action column and overflowing, move them back to the main column.

Run the content validator after every 5 packages. Update snapshots with `[snapshots]` at the end.

DONE-WHEN: every step doc's content changes applied; critical content items 6–8 verified; validator passes; suite green; committed.

---

## B9 — Comprehensive audit of B1–B8

READ: RUN-CONTEXT-B.md; docs/product/actionability/POST-B8-AUDIT-PROMPT.md; MASTER; every file in STEPS/.

DO:
Start by confirming `http://localhost:5173/planner/?demo=1#/plan` is reachable in Chrome (the dev server should already be running). If it's not, start it with `npm run dev &` and wait for it. Then execute the audit prompt:
1. Read the universal master list and all 33 step-findings docs.
2. Verify engine states (Phase 1): enforced policies read Completed or Correct, substatus is "Decision" not "Needs decision", completion gates work, packageStateOf safe correction works, threshold tile is state-aware.
3. Verify plan rows (Phase 2): no subtitles, no "next" pill, no person names, no "Configuration only".
4. Verify step body layout (Phase 3): no "What to do", two-column grid, milestone in action column, inputs in action column, Planned work gone. Check Separate Accounts, Review Baseline, and Rename Policies for content survival.
5. Verify tiles (Phase 4): compact/expand works, transitive suppression works.
6. Verify Implementation (Phase 5): channels always visible on enforced policies, non-policy steps show Entra+AI Info only, sticky viewer, icon buttons, disabled copy with tooltip, Admin Portals shows conflict message.
7. Verify data and content (Phase 6): exclusion-group investigation result, pre-fill pickers, High-Risk channels, workload-identity absent, device-code input.
8. Verify per-step content (B8 checks): Source checked, Done-when, Learn links, impact labels for every step.
9. Forbidden content sweep: no "What to do", "Planned work", "Nothing to submit yet", "Configuration only", "Needs decision", "next" pill, person names in impact.

**Additionally, audit these items that B1–B8 were NOT designed to implement. Record them as P0 if missing:**
10. Emergency Access: per-account readiness tiles (two tiles per break-glass slot, replacing the Emergency Access / Check / Resilience triple). Per step-findings S-BG-1.
11. Device Decision: dropdowns for Phones and Computers (not radios). Unmanaged phones conditional on Phones answer. Per step-findings S-DD-1 and archetype A1.
12. Campaign: Entra Implementation channel with campaign setup instructions. "In person" or AI Info channel with the operational walkthrough. Special-care people picker completion gate. Per step-findings S-MC-1, S-MC-2, archetype A3.
13. Exclusions Group: CHECK tile content references the plan's intended policies, not just existing ones. Per step-findings S-EG-1.
14. Campaign: step stays open until special-care users are identified or admin confirms none exist. Per archetype A6.

Write the full audit report to `docs/product/actionability/POST-B8-AUDIT.md` in the format specified by the audit prompt: Summary, P0 table, P1 table, P2 table, per-step content table, phase results. Every P0 and P1 must have a Fix column with the exact file, function, and change needed.

**Phase 8: Real tenant audit (sign-in on localhost)**

After the demo audit, also audit the real tenant:
1. Navigate to `http://localhost:5173/planner/` (no `?demo=1`).
2. Click "Sign in with Microsoft" — the redirect URI is registered for localhost.
3. Wait for sign-in and scan to complete.
4. Navigate to the Plan tab.
5. For each enforced policy (there are 8 on this tenant — Shorten Admin Sessions, Phishing-Resistant MFA, Block Auth Transfer, Block Device Code, Block Legacy Auth, Require MFA for Guests, Require MFA for Everyone, Require Token Protection):
   - Record the badge/lane. Expected: Completed (no drift) or Ready · Correct (drift), NOT Observing.
   - Record whether Implementation channels are visible. Expected: yes, with content.
   - Record whether "Nothing to submit yet" appears. Expected: no.
6. Check the exclusion-group step: is the picker pre-filled with the tenant's group?
7. Check the passkey settings step: does it appear as Ready · Create?
8. Check the campaign step: does it wait on passkeys (Up Next · After Set Up Passkeys)?
9. Check "Not licensed" section: the workload-identity step should NOT appear (no sync connector on this tenant).
10. Check that no row shows a person's display name in the impact column.
11. Check that no row has a subtitle under the step title.
12. Run the forbidden content sweep on the real tenant's plan page.

Record all findings in a "Phase 8: Real tenant" section in the audit report. Every enforced policy that still reads Observing or shows "Nothing to submit yet" is a P0.

Do NOT fix anything. Audit only. Write the report. Commit it. Stop.

DONE-WHEN: `POST-B8-AUDIT.md` exists with complete findings including real-tenant results; committed.

---

## B10 — Fix every P0 and P1 from the audit, plus all deferred per-step items

READ: RUN-CONTEXT-B.md; `docs/product/actionability/POST-B8-AUDIT.md` (the audit report from B9); STEPS/step-emergency-access.md, STEPS/step-device-decision.md, STEPS/step-mfa-campaign.md, STEPS/step-exclusions-group.md, STEPS/step-separate-accounts.md.

DO:
1. Read `POST-B8-AUDIT.md`. For every P0 finding, apply the fix described in the Fix column. For every P1 finding, apply the fix. Skip P2 items.

2. **Regardless of what the audit found, implement these if they are not already done:**

   a. **Emergency Access per-account tiles (A5 / S-BG-1).** Replace the EMERGENCY ACCESS / CHECK / RESILIENCE tiles with two tiles, one per break-glass account slot. Each tile: not selected → "Not selected"; selected + minimum fails → minimum blockers (compact, expand for detail); selected + minimum met + hardening open → green minimum, amber hardening list; all clear → green. The tile data comes from `engineTiles` reading the plan record's selected accounts and the scan's per-account evidence. Labels use the account display name or "Account 1" / "Account 2".

   b. **Device Decision dropdowns (A1 / S-DD-1).** Replace Phones and Computers radio groups with `<select>` elements. Same options. The Unmanaged phones checkbox renders only when Phones = "Enroll phones in Intune"; otherwise hidden and plan-record value cleared.

   c. **Campaign Entra channel (S-MC-1).** Author the Entra Implementation channel: Entra admin center → Security → Authentication methods → Registration campaign → Enable → Target all users → Method: passkey (Microsoft Authenticator) → Enforcement: remind on sign-in. Save.

   d. **Campaign walkthrough channel (A3).** The "Book ten minutes with each" operational guide needs an Implementation channel. Check if the content-schema supports custom channel names. If yes, use "In person". If no, put the walkthrough content in AI Info. Content: book ten minutes, open aka.ms/mfasetup, no-method users get TAP first, text/call-only register passkey then remove phone, admins get passkey or hardware key, have each sign in once.

   e. **Campaign special-care gate (A6 / S-MC-2).** Add `decisions.specialCareConfirmed` to the plan record. The completion evaluator checks it's not null. The people picker's Save writes this field. Empty array = "no special-care users" (confirmed, gate clears). Null = not yet addressed (gate blocks).

   f. **Exclusions Group CHECK tile (S-EG-1).** Rewrite the CHECK tile content: instead of listing individual existing policies, say "Confirm this group will be excluded from every policy in the plan." Show existing policies with the group as satisfied; planned-but-not-yet-created policies as "will include at creation."

   g. **Separate Accounts content (S-SA-1).** If the Entra channel content is still missing after B8 item 6, author it now: create cloud-only admin account (Entra admin center → Users → New user), move directory role, register passkey on admin account, keep mail/Teams on everyday account.

   h. **Review Baseline layout exception (S-RB-3).** If the 7 policy inputs are crammed in the 260px action column, move them to the main column under Implementation. The step is an exception to U2.

3. Run the content validator. Update snapshots with `[snapshots]`. Run the full test suite.

DONE-WHEN: every P0 and P1 from the audit is fixed; all items 2a–2h are implemented; validator passes; suite green; committed.

---

## B11 — Second audit: verify B10 fixed everything

READ: RUN-CONTEXT-B.md; `docs/product/actionability/POST-B8-AUDIT.md` (B9's report, for comparison); MASTER; STEPS/.

DO:
Confirm `http://localhost:5173` is still serving (hot-reload picks up B10's changes). Then re-run the audit, focused:
1. For every P0 from B9's report: verify it's now fixed. Record FIXED or STILL BROKEN.
2. For every P1 from B9's report: verify it's now fixed. Record FIXED or STILL BROKEN.
3. For each deferred item (2a–2h from B10): verify it's implemented. Record DONE or MISSING with specifics.
4. Run the forbidden content sweep again.
5. Open at least 10 steps in Chrome on the DEMO and verify visually: two-column layout, compact tiles, channels visible, no forbidden text, correct lane states.
6. Sign into the real tenant on localhost (same as B9 Phase 8). Check all 8 enforced policies: lane state, channels visible, no "Nothing to submit yet." Check exclusion-group pre-fill, passkey step, campaign dependency, workload-identity absence.
6. Check the per-step content table (Source checked, Done-when, Learn link, Impact label) for any step that was MISSING or WRONG in B9 — is it fixed now?

Write the report to `docs/product/actionability/POST-B10-AUDIT.md` in the same format as B9's report.

If P0 count = 0: write "READY TO DEPLOY" at the top of the report.
If P0 count > 0: write each remaining P0 with its Fix column.

Commit the report. Stop.

DONE-WHEN: `POST-B10-AUDIT.md` committed.

---

## B12 — Self-correcting fix loop (up to 3 passes)

READ: RUN-CONTEXT-B.md; `docs/product/actionability/POST-B10-AUDIT.md`.

DO:
1. Read `POST-B10-AUDIT.md`. If it says "READY TO DEPLOY" at the top, skip all work and go straight to DONE-WHEN.

2. If P0s or P1s remain, execute this loop up to 3 times:

   **Pass N (starting at 1):**
   a. Fix every P0 using the Fix column from the audit report. Then fix every P1.
   b. Run `npx tsc --noEmit` and `npm test`. If either fails, fix the failure.
   c. Update snapshots with `[snapshots]`.
   d. Commit: `B12: fix pass N`.
   e. **Re-audit in this same session.** Open `http://localhost:5173/planner/?demo=1#/plan` in Chrome. Run through:
      - Open 6 steps across archetypes (one foundation, one enforced, one Up Next, one On Hold, one campaign, one decision). For each: verify two-column layout, no "What to do", no "Planned work", tiles compact, channels visible, correct badge/lane.
      - Forbidden content sweep: search the rendered page for each forbidden string. Record any found.
      - For each P0 you just fixed: verify the fix holds in the rendered product.
      - If any P0 was a real-tenant issue: sign into the real tenant on localhost and verify the fix there too.
   f. Write the results to `docs/product/actionability/B12-PASS-N.md` with a P0/P1 table.
   g. If P0 count = 0: write "READY TO DEPLOY" at the top and break the loop.
   h. If P0 count > 0 and N < 3: increment N, continue the loop.
   i. If P0 count > 0 and N = 3: write "UNRESOLVED P0s — owner review needed" at the top with the remaining items. Break.

3. Commit the final pass report.

DONE-WHEN: "READY TO DEPLOY" reached, or 3 passes exhausted with remaining items documented; suite green; committed.

---

## B13 — Gauntlet, deploy, live check

READ: RUN-CONTEXT-B.md; BLOCKED.md; `docs/product/actionability/POST-B10-AUDIT.md`.

DO:
1. **Gauntlet — once:**
   ```
   npm test
   npm run build:site
   node scripts/compile-implementation-content.mjs --validate-library
   node scripts/compile-implementation-content.mjs --registry
   npm run walk
   ```
   Smoke, allowlist, external health. P0 = 0.

2. **Push and deploy.** Push to main. Wait for CI. Confirm deployed HEAD.

3. **Live check (Chrome, desktop)** on getiamai.com/planner demo, both scans:
   1. No row subtitles on any row
   2. No "next" pill
   3. No "Configuration only" in impact column
   4. No "Planned work" banner on any opened step
   5. No "What to do" heading on any opened step
   6. No "Nothing to submit yet" on any step (except Admin Portals conflict message)
   7. No "Needs decision" — substatus reads "Decision"
   8. No forbidden words (Blocked, Held, Needs attention, Skipped, Set aside)
   9. Two-column layout: milestone + inputs in right column
   10. Tiles collapsed by default; clicking expands; transitive tiles suppressed
   11. Enforced no-drift step reads Completed
   12. Enforced with-drift step reads Ready · Correct with visible channels
   13. Threshold tile on enforced policy uses informational text
   14. Non-policy step shows Entra + AI Info only
   15. Expand viewer: scroll content, tabs + copy stay at top (sticky)
   16. Copy button disabled with tooltip on unresolved step
   17. Emergency Access: two per-account tiles
   18. Devices: dropdowns for Phones and Computers, Unmanaged phones conditional
   19. Campaign: Entra channel + walkthrough channel, special-care picker in action column
   20. Exclusions Group: CHECK tile references plan's intended policies
   21. Passkey step present; campaign waits on it
   22. Admin Portals: conflict message, no channels
   23. No console errors

   **Part B: Real tenant** (getiamai.com/planner, sign in with Microsoft):
   24. All 8 enforced policies show Completed or Ready · Correct, NOT Observing
   25. All 8 enforced policies have visible Implementation channels
   26. No "Nothing to submit yet" on any step
   27. Exclusion-group picker pre-filled with tenant's group
   28. Passkey settings step present as Ready · Create
   29. Campaign waits on passkeys
   30. Workload-identity step absent (no sync connector)
   31. No person names in impact column
   32. No row subtitles
   33. Forbidden content sweep clean

4. **Report:**
   ```
   ## FIXED
   | # | Root cause | Change |

   ## DEFERRED / OWNER DECISIONS
   From BLOCKED.md. Items that need Lachlan's input.

   ## LANE COUNTS
   Demo Initial: Ready / Up Next / On Hold / Completed / Deferred
   Demo Follow-up: Ready / Up Next / On Hold / Completed / Deferred

   ## VALIDATION
   npm test / build / validator / registry / walk P0·P1·P2 / smoke / allowlist / health

   ## LIVE CHECK
   1–23 PASS/FAIL

   ## DEPLOYMENT
   Commits / CI / deployed HEAD
   ```

Stop after the report.

# POST-B8 audit (segment B9)

Audit only; nothing was fixed. 2026-09-12, HEAD `5527a90`, dev server `localhost:5173`, Chrome.

**Read:** RUN-CONTEXT-B, SEGMENTS-B §B9, MASTER, all 33 step-findings docs and their README, BLOCKED.md.

**Missing input:** `POST-B8-AUDIT-PROMPT.md` is not in the repository or its history. This report uses the format B9 names itself (see BLOCKED.md, B9 choices).

**Method.**
- Every row of all three lanes was opened on the demo Initial scan and on the real tenant, and read by script: badge, headings, grid, action column, tiles (label, value, height), Implementation tabs, Copy, Source checked, Done when and forbidden words.
- On the demo Follow-up scan, the board was read and the forbidden-word sweep run.
- The expand viewer was opened with a real click and read by script.
- 800 px was measured in a same-origin iframe.
- The real tenant was signed in through the browser's existing session and scanned read-only. No UPN, object id, person name or tenant policy name is recorded here; the tenant's name is written `{tenant}`.

**Severity.**
- **P0:** contradicts a RUN-CONTEXT-B decision, is one of B9 items 10–14, is an enforced real-tenant policy reading Observing or "Nothing to submit yet", or leaves the unit suite red.
- **P1:** a MASTER target or step-findings fix is unmet with no decision behind it.
- **P2:** polish, or a reading this audit could not settle.

## Summary

**13 P0 · 6 P1 · 10 P2.**

0. **The unit suite is red at HEAD `5527a90`:** 2,499 tests, 2,492 pass, 5 fail. All five come from B8's content pass (`9aabe56`); B9 changed only docs (P0-13).
1. **B4 and B5 never landed.** `git log 2a61f01..HEAD` holds B1, B2, B3, B6, B7 and B8 only. So the following are all absent:
   - compact/expand tiles (decision 3)
   - disabled Copy with a tooltip (decision 4)
   - PowerShell/JSON limited to CA policy steps (decision 12)
   - the sticky viewer with icon buttons (decision 13)
   - the baseline-conflict message (decision 5)
2. **Real tenant, enforced policies:** all 8 named policies, plus Remediate High-Risk Users, read **Ready · Correct**. None reads Observing, so U20/U21 hold. But every one of them shows **"Nothing to submit yet / IAMAI offers no artifact for this policy as it stands"** and no channel tab (P0-1). `packageStateOf` returns `blocked` at Foundation A's `unavailable` result, because the unconfirmed exclusions group empties the correction (the U27 chain). The demo's enforced steps take a different path and draw their channels as a planning preview.
3. **Items 10–14** (per-account emergency tiles, device dropdowns, campaign channels and gate, exclusions Check tile) are all missing.
4. **What passes:**
   - Plan rows on both tenants and both demo snapshots: no subtitle, no "next" pill, no names, no "Configuration only".
   - Two-column body, action column in DOM order, stacking at 800 px.
   - No What to do, no Planned work.
   - State-aware Threshold wording.
   - Learn → at the end of every Why.
   - Source checked on every package-backed step read.
   - B8's Done-when sentences.
   - Real-tenant exclusions pre-fill ("Matched by IAMAI").
   - High-Risk sign-in channels.
   - Workload identity absent on the real tenant.
   - The device-code input.
5. **Contradiction for the owner:** decision 6 (Observing is report-only only) and decision 17 (a conditional input needs Save before completion). An enforced, undrifted policy with an unsaved input can be neither Completed nor Observing (P0-12).

## P0

| # | Finding | Seen | Authority | Fix |
|---|---|---|---|---|
| P0-1 | Every enforced policy on the real tenant shows "Nothing to submit yet" and no channel tab. | Real tenant: Require MFA for Everyone, Shorten Admin Sessions, Require Phishing-Resistant MFA for Admins, Block Authentication Transfer, Block Device Code Sign-in, Block Legacy Authentication, Require MFA for Guests, Require Token Protection on Windows, Remediate High-Risk Users | Decision 5, U14, U19, Phase 8 rule | `src/ui/surfaces/stepPackage.ts packageStateOf`: line 223 (`policyResult(step).kind === 'unavailable'` → `'blocked'`) runs for an enforced policy whose unavailable reason is the unconfirmed exclusions group, and `safeCorrectionOf` never fires because generation emptied the operation to `missing: [{exclusionsGroup}]`. For `c.state.lifecycle === 'enforced'`, return the package's correction state as a planning preview (`planningPreview` over `plannedOperationsOf(step)`), not `blocked`. `src/ui/surfaces/ContentStep.tsx`, Implementation region, `artifacts.length === 0` branch (line 549): draw the package's authored channels as a preview before falling back to `ImplementationEmptyBox`. `docs/design/content.json` `implementation.empty.unavailable` (line 1440): remove the "Nothing to submit yet" title. Test: a mid fixture with the exclusions question unanswered and legacy auth enforced renders Entra, JSON and AI Info tabs and no "Nothing to submit". |
| P0-2 | Tiles are not compact. Every tile draws label, value and a `details` "Why" at 104–137 px. `.readiness-strip` computes `align-items: normal` (stretch), so tiles match heights. | Demo and real, every step with Readiness (Require MFA to Register a Device: 8 tiles × 125 px on the real tenant) | Decision 3, U6 | `src/ui/surfaces/StepSections.tsx Tile` (319–353): replace head + `strong` + `details.readiness-more` with a `button.tile-summary[aria-expanded]` (mark · label · value · chevron) and a `div.tile-detail hidden` holding note, extra and link. Hold state in `useState(false)` inside `Tile` (unmounts when the step closes, so it resets); `open` (printing) forces expanded. `src/ui/app.css` `.readiness-strip { align-items: start }`. Test in `stepLayout.test.ts`: summary one line, detail hidden, strip `align-items: start`. |
| P0-3 | Copy is removed, not disabled with a reason, wherever the implementation is a planning preview. | Demo: Require MFA for Everyone, Block Device Code Sign-in, Block Legacy Authentication, Create or Correct Service Accounts Group, Create or Correct Exclusions Group, every On Hold step with channels. Real: Define the Trusted Network, Create or Correct Emergency Access Accounts, Create or Correct Exclusions Group, every Up Next/On Hold step with channels | Decision 4, U18 | `src/ui/surfaces/ContentStep.tsx`, Implementation region line 579: always render the Copy `icon-btn` when `artifacts.length > 0`, with `disabled={!copyable}` and `title` / `aria-description` = the preview's reason (`stepBody.ts previewNote.lines`, the `implementation.preview.text`/`textValues`/`values` words B3 kept for this). Do the same in the dialog toolbar (line 596). `app.css` `.icon-btn:disabled { opacity: .4; cursor: not-allowed }`. Test: Exclusions Group Copy is disabled with "Values still to resolve: …" as its title. |
| P0-4 | PowerShell (and JSON where authored) render on steps that are not CA policies. | Emergency Access, Exclusions Group, Passkey Settings, Allowed Countries, Service Accounts Group (demo); Authentication Strength and Trusted Network (real) — all show Entra/PowerShell/AI Info | Decision 12, U15, S-BG-2, S-EG-3, S-PK-1, S-AS-1, S-TN-1, S-AC-1 | `src/ui/surfaces/stepBody.ts`: filter the package artifacts before `channelTabsOf(artifacts)` (line 113), dropping `ps` and `json` where the content step's `kind !== 'policy'` (`cs.kind`, already read at line 173). This keeps the tabs, the dialog tabs and Copy on one list. Test: Emergency Access and Exclusions Group tabs are exactly Entra, AI Info; Block Legacy Authentication keeps all four. |
| P0-5 | The expand viewer is not sticky and its buttons carry text. Channel tabs and Copy sit in `div.dialog-toolbar` inside the scrolling `.dialog-content`. The header is `position: static` with a text "Minimize" button, and the dialog's Copy reads "Copy implementation" as text. | Demo, Emergency Access expanded (read by script) | Decision 13, U16, U17 | `src/ui/surfaces/StepSections.tsx StepDialog` (435–496): add a `toolbar` prop rendered on the right of `header.dialog-head`; the close control becomes `button.icon-btn` with `aria-label={closeLabel}` (line 487). `src/ui/surfaces/ContentStep.tsx` (593–601): pass the tabs and an icon-only Copy (`aria-label={W.copy}`) as `toolbar`, not as children. `app.css` `.step-dialog .dialog-head { position: sticky; top: 0; z-index: 1; background: var(--surface-2) }`. Test: the dialog's tablist and Copy are inside `.dialog-head`, and no dialog button has visible text. |
| P0-6 | Block the Admin Portals for Non-Admins reads "Nothing to submit yet / No Entra, PowerShell, JSON or AI artifact is offered while the baseline definition is unresolved." | Demo and real | Decisions 5 and 19, S-AP-2 | `docs/design/content.json` `implementation.empty.conflict` (line 1444) → `["Not enough information to provide implementation guidance.", "The baseline defines this policy two ways; resolve the conflict before implementation is available."]`. `stepContract.ts implementationEmptyOf` already routes the conflict first. Test: the conflict step's Implementation holds that sentence and no tab. |
| P0-7 | Emergency Access still draws the Emergency access / Check / Resilience triple, not two per-account slot tiles. | Demo (Break-glass 1 and 2 selected) and real (none selected) | B9 item 10, S-BG-1 | `src/ui/surfaces/stepContract.ts emergencyTiles` (1114): return one tile per slot (two), each from that account's minimum and hardening results ("Not selected" / minimum blockers / hardening open / clear). Stop the emergency step's failing-check tiles in `fixOf` (606–610) and `fixTiles`. Move `HardeningBody` (the `extra` handed to `ReadinessSection`) under each slot. Generation must expose per-account results on `step.emergency` (today it carries counts and `c.emergencyAccounts` strings). New content keys `hardening.tiles.slot` and `hardening.tiles.notSelected`. |
| P0-8 | Decide How Devices Are Managed draws radios (6) and the Unmanaged phones checkbox with no Phones answer. | Demo and real (all radios unchecked, checkbox shown) | B9 item 11, S-DD-1, A1 | `src/ui/surfaces/ContentStep.tsx Options` (844): add a `select` rendering, used by the decision block (807, 813) where no option takes a value (`needs === null`). Strict block (817–828): render only when the Phones answer (`option`) is the content's enroll option. `save` (781–787): omit the strict answer otherwise, so `questionAnswers[step:Block phones]` is cleared. Test: Phones and Computers are `select`; Unmanaged phones is absent until Phones = Enroll. |
| P0-9 | The MFA Registration Campaign draws no Implementation region (Why > Readiness > Done when), although `docs/implementation-content/s-verify-mfa/s-verify-mfa/` exists. | Demo and real (Up Next · After Set Up Passkeys to Match the Baseline) | B9 item 12, S-MC-1, S-MC-3, A3 | That package's `CONTENT.md`/`META.json`: author an Entra block (registration campaign setup, S-MC-1 lines 1–5) and an AI Info block carrying the seven in-person walkthrough lines, with `[MFA Readiness →](#/readiness)`, projected for every state the step reaches (`missing` and the held states as preview). Recompile with `--registry`. Test: on demo, the campaign offers Entra and AI Info. |
| P0-10 | The campaign has no special-care completion gate. `src/roadmap/answers.ts CONDITIONAL_INPUTS` (197) lists mail devices, device code, partner and travel only. The picker opens pre-filled with the plan's proposal (10 chips demo, 2 real), and nothing requires a Save. | Demo and real | B9 items 12 and 14, S-MC-2, A6, U28 | `src/roadmap/answers.ts`: add `{ stepId: <s-verify-mfa>, kind: 'decision' }` to `CONDITIONAL_INPUTS`. `unsavedInputsOf` treats a saved `stepDecisions['s-verify-mfa'].picked` (including an empty list) as confirmed. Add a "Nobody needs special care" option to the campaign decision in `docs/design/content.json` so an empty answer can be saved. `planLanes.ts observe` already passes `unsaved` to the engine. Test: an unsaved campaign never reads Completed; saving an empty list clears the gate. |
| P0-11 | The Exclusions Group Check tile tells the admin to "Exclude the group from {policies}: open each policy → Users → Exclude → Groups", listing existing policies, not what the plan intends. | Demo (Up Next); on the real tenant the Decision tile alone shows while the group is unconfirmed | B9 item 13, S-EG-1 | `docs/design/content.json` `steps[s-prereq-exclusion-group].whatToDo.checkFixes["excluded-from-every-policy"]` (line 2039) and `src/ui/surfaces/stepContract.ts fixOf` (606–610): drop that check from the exclusions step's fixes, since each policy step owns its correction. Replace it with an info tile "{n} policies exclude the group · {m} will include it when created", counted from the plan's policy steps. Test: the Exclusions Group step carries no tile naming existing policies to edit. |
| P0-12 | An enforced policy reads Ready · Observing. On the demo Follow-up scan, Block Device Code Sign-in (Enforced chip) reads Observing because its device-code answer is unsaved in this browser's stored record (see P2-2). The code path is general: an unsaved conditional input on an enforced, undrifted policy is an open enforcement gate, which reads Observing (B1 task 5). | Demo Follow-up | Decision 6 vs decision 17 (contradiction, owner) | Owner decides the reading. Smallest option: `src/actionability/lanes.ts` (substatus derivation) with `src/ui/surfaces/planLanes.ts observe`: pass `unsaved` inputs on an enforced step as a `decision` blocker, so the step reads **Ready · Decision**, never Observing and never Completed. Test in `enforcedLanes.test.ts`: an enforced, undrifted policy with an unsaved input reads Ready · Decision. |
| P0-13 | `npm test` fails 5 of 2,499 at `5527a90`. B8's new `steps[].doneEnd` keys read as orphan content strings. The walk rule and three tests still expect the campaign's old Done when ("Every admin is Ready for phishing-resistant MFA.") and the exclusions group's old one ("The question on this step is answered and saved."). | `npm test`, run once at the end of B9 | CLAUDE.md "Done means … CI green" | B8 changed the words; the checks did not follow. `src/content/content.test.ts` (237): `doneEnd` is rendered (`stepContract.ts` held end state), so teach the orphan reader that consumer instead of listing the keys. `src/content/contentChecks.ts` (the s-verify-mfa doneWhen rule reported as walk rule 13) and `src/ui/surfaces/enough.test.ts` (27): accept S-MC-4's sentence, "Every admin is Ready for phishing-resistant MFA, and the registration campaign has been reviewed for all other users." `src/ui/surfaces/mfaGuidance.test.ts` (304, "the admin completion gate"): match the same sentence. `src/ui/surfaces/needsDecision.test.ts` (215): expect S-EG-5's sentence for the exclusions group. Run before anything else in B10. |

## P1

| # | Finding | Seen | Authority | Fix |
|---|---|---|---|---|
| P1-1 | The Decision tile's value reads "Needs decision" (the forbidden word). The exclusions group's tile does not name the matched group. | Devices (demo, real); Exclusions Group (real, pre-filled "Matched by IAMAI") | U11 sweep, S-EG-2 | `src/ui/surfaces/stepContract.ts stateTile` (1082): value → a new key `readiness.tiles.decisionValue` ("Decision"); note → the step's own ask. For the exclusions group: "IAMAI found {group}. Confirm this is the right group." (new key, `{group}` from `pickerVars.groupsMatched`). `stepContract.condition.needs-decision` (content.json 1265) stays only if the export still reads it. |
| P1-2 | No Readiness tile names an unsaved conditional input, so the admin is not told what blocks completion. | Block Legacy Authentication, Block Device Code Sign-in, Require MFA for Guests, Allowed Countries (demo and real) | U28 test ("Mail-sending devices: confirm"); B1 noted it as owed | `src/ui/surfaces/stepContract.ts readinessOf` (1222): add one warn tile per `step.unsavedInputs` label (key `unsaved:<label>`, value "Confirm", note the question), with new content key `readiness.tiles.unsaved`. Test: legacy auth with no saved answer carries the tile. |
| P1-3 | Transitive suppression is a special case. `directFixes` removes only the emergency gate beside the exclusions group; `engineTiles` does no graph reduction. Restrict Service Accounts to the Trusted Network shows both Create or Correct Service Accounts Group and Create or Correct Emergency Access Accounts. Whether the second is an ancestor of the first was not settled. | Demo On Hold | U7 | `src/ui/surfaces/stepContract.ts readinessOf` (1229): after `engineTiles`, drop any `step:`/`missing:` tile whose step is an ancestor (reachability over `dependency-data.json`, as `actionability/sorting.ts unlockCounts` walks it) of another step tile on the same step. Delete the `directFixes` special case. Test: a step with prerequisites A → B shows B only. |
| P1-4 | Use Separate Accounts for Admin Work offers Entra only, no AI Info. | Demo and real | B9 Phase 5 ("non-policy steps show Entra + AI Info"), U15 | `docs/implementation-content/s-check-separate-admin-accounts/` `CONTENT.md`: author an `aiInfo` block for the `missing` projection B8 added; recompile the registry. |
| P1-5 | Disable or Confirm Dormant Accounts draws no Implementation (Why > Readiness > Done when). Its package authors no `missing` projection (B8 item 6). | Demo | U14, U1 (guidance moves to channels) | The dormant-accounts package `CONTENT.md`: author Entra and AI Info blocks for `missing` from its content.json `whatToDo` lines; recompile the registry. |
| P1-6 | The real tenant's policies already exclude a qualifying group, yet read as missing the exclusions group while it is unconfirmed. All 9 enforced policies read Ready · Correct with a Prerequisite · Ready: Create or Correct Exclusions Group tile. | Real tenant | U27 (B6 investigation: owner decision) | Owner decision. If taken: `src/coverage/coverage.ts` (the `exclusionsGroupId === null` branch, B6 §U27 line 419) adds an `exclusion-unconfirmed` caveat when `excludeGroups` holds a qualifying candidate. `roadmap/generate.ts` then words the hold as "confirm the exclusions group", not a missing object. |

## P2

| # | Finding | Note |
|---|---|---|
| P2-1 | Protect Sign-in Method Registration (demo, Ready · Create) offers PowerShell / JSON / AI Info / Email and no Entra tab. The real tenant (Up Next) has Entra. | Its source conflict is frozen (RUN-CONTEXT-B Freeze); record only. |
| P2-2 | The demo Follow-up record in this browser predates B7, so Block Device Code Sign-in has no saved answer, although `roadmap/fixtures/index.ts` 748 seeds `None`. | `ui/demo.ts seedInto` seeds once per snapshot. Re-read in a fresh profile; if it reproduces, `seedInto` adds seed decisions the stored record lacks. |
| P2-3 | Undated steps put the lane label in the action column's metric ("Ready · Decision", "Ready · Correct", "On Hold · …", "Up Next · After …"), repeating the badge. Devices' row When says Sep 14, 2026 while its metric says Ready · Decision. | `stepContract.ts railOf`; the decision case is an owner choice (2026-09-11). |
| P2-4 | Impact reads "—" on Emergency Access, Exclusions Group, Service Accounts Group, Review Baseline and Rename Policies. The docs ask for counts (S-EG U13, S-RB-6, S-RN-5), which `impact.fallbackLabel` cannot state. | Needs a count producer in the row impact chain (`derive/whoLine.ts rowWho`). |
| P2-5 | Restrict Service Accounts to the Trusted Network's Done when is the generic "The policy is enforced in {tenant}." | No step-findings doc covers the step; `content.json steps[].doneEnd`. |
| P2-6 | The demo's Not licensed (6) lists Restrict the Entra Connect Sync Account. | Correct only if the demo fixture holds a directory-sync role holder (B7's facet rule); not verified. |
| P2-7 | The viewer's scroll was not exercised: Emergency Access's Entra content fits the dialog (scrollHeight = clientHeight 1125). | Re-check P0-5 on a long channel (Block Sign-ins From Countries Not Allowed, PowerShell). |
| P2-8 | Post-Save transitions were not exercised: the real-tenant exclusions pre-fill → Save → Correct/Completed (U24, U27 test), and the device-decision follow-up after answering. | The audit wrote nothing to the plan record. |
| P2-9 | Require Phishing-Resistant MFA for Admins shows no Set Up Passkeys prerequisite tile on either tenant. MASTER U7 expected Exclusions Group and Passkeys as its direct prerequisites. | Check the §10 edge on `s-goal-admins-phishing-resistant` before calling it a defect. |
| P2-10 | Use Separate Accounts' row Impact reads "1 person" on the real tenant; S-SA-3 asks for "1 admin". | Row counts come from `rowWho`. |

## Per-step content table

Legend:
- **Learn:** Why ends in Learn →.
- **Source:** "Source checked" date (demo / real; "—" none drawn; "n/r" not read).
- **Done when:** B8/doc target met.
- **Channels:** demo / real ("none" = no tab; "NtS" = "Nothing to submit yet").

| Step | Learn | Source | Done when | Impact (demo / real) | Channels (demo / real) | Step-specific result |
|---|---|---|---|---|---|---|
| Create or Correct Emergency Access Accounts | ✓ | Sep 12 / n/r | no doc target | — / — | Entra, PS, AI / Entra, PS, AI | S-BG-1 ✗ (P0-7); S-BG-2 ✗ (P0-4); S-BG-4 ✓ demo Ready · Correct; actionText ✓ |
| Create or Correct Exclusions Group | ✓ | Sep 12 / Sep 12 | ✓ S-EG-5 | — / — | Entra, PS, AI / same (Copy absent) | S-EG-1 ✗ (P0-11); S-EG-2 real pre-filled ✓, tile words ✗ (P1-1); S-EG-3 ✗ (P0-4); S-EG-6 deferred |
| Decide How Devices Are Managed | ✓ | — / — | ✓ kept (S-DD-4) | 6 people / 3 people | none / none | S-DD-1 and A1 ✗ (P0-8); tile "Needs decision" (P1-1) |
| Create and Enforce the MFA Registration Campaign | ✓ | — / — | ✓ S-MC-4 | 30 people / 3 people | none / none | S-MC-1 ✗ (P0-9); S-MC-2 gate ✗ (P0-10); picker in action column ✓ |
| Block Legacy Authentication | ✓ | Sep 12 / Sep 12 | ✓ S-LA-3 | Not established / same | Entra, PS, JSON, AI / NtS | S-LA-2 input in action column ✓; real channels ✗ (P0-1); U23 deferred |
| Require Phishing-Resistant MFA for Admins | ✓ | Sep 12 / Sep 12 | ✓ S-PR-4 | Not established / same | Entra, PS, AI / NtS | S-PR-2 ✓ real "0% of admins have a qualifying method."; S-PR-3 ✗ real (P0-1); S-PR-5 ✓ real bar Needs correction |
| Set Up Passkeys to Match the Baseline | ✓ | Sep 12 / n/r | ✓ kept | Passkey settings / same | Entra, PS, AI / same | S-PK-1 ✗ (P0-4); real Ready · Create ✓ |
| Create the Baseline's Authentication Strength | ✓ | not on demo / n/r | n/r | not on demo / Authentication strength | not on demo / Entra, PS, AI | S-AS-1 ✗ (P0-4); picker in action column ✓ |
| Define the Trusted Network | ✓ | Completed on demo / n/r | n/r | Trusted network / same | not opened / Entra, PS, AI (Copy absent) | S-TN-1 ✗ (P0-4); S-TN-3 Copy ✗ (P0-3) |
| Create or Correct Allowed Countries Location | ✓ | Sep 12 / n/r | ✓ kept | Country restrictions / same | Entra, PS, AI / same | S-AC-1 ✗ (P0-4); S-AC-3 travel question in action column ✓ |
| Use Separate Accounts for Admin Work | ✓ | Sep 12 / n/r | no doc target | 2 people / 1 person | Entra / Entra | S-SA-1/2 checklist survived under Entra ✓; AI Info ✗ (P1-4); S-SA-3 (P2-10); actionText ✓ |
| Shorten Admin Sessions | ✓ | Sep 12 / Sep 12 | ✓ S-SH-5 | Not established / same | Entra, PS, JSON, AI, Email / NtS | real Ready · Correct ✓, channels ✗ (P0-1) |
| Block Authentication Transfer | ✓ | Sep 12 / Sep 12 | ✓ S-AT-5 | Not established / same | 5 tabs / NtS | real Ready · Correct ✓, channels ✗ (P0-1) |
| Block Device Code Sign-in | ✓ | Sep 12 / Sep 12 | ✓ S-DC-5 | Not established / same | Entra, PS, JSON, AI / NtS | S-DC-6 input ✓ both; Follow-up Observing (P0-12, P2-2); real channels ✗ (P0-1) |
| Require MFA for Guests | ✓ | Sep 12 / Sep 12 | n/r | Not established / same | Entra, PS, AI / NtS | S-GM-2 partner input in action column ✓; demo Initial On Hold · Not supported, Follow-up Completed; real channels ✗ (P0-1) |
| Require MFA for Everyone | ✓ | Sep 12 / Sep 12 | ✓ S-ME-6 | Not established / same | Entra, PS, JSON, AI / NtS | S-ME-2 ✓ informational Threshold (demo 13%, real 33%); real channels ✗ (P0-1) |
| Require Token Protection on Windows | ✓ | Sep 10 / Sep 12 | ✓ S-TP-4 | Not established / same | Entra, PS, JSON, AI / NtS | S-TP-5 compatibility tile absent (per-step item, not B1–B8); real channels ✗ (P0-1) |
| Challenge Medium-Risk Sign-ins | ✓ | not licensed on demo / Sep 10 | n/r | — / Not established | — / Entra, PS, JSON, AI | Up Next ✓ |
| Require MFA at Every Role Activation | ✓ | not licensed / Sep 10 | n/r | — / Not established | — / Entra, PS, JSON, AI | Up Next ✓ |
| Challenge High-Risk Sign-ins | ✓ | not licensed / Sep 10 | n/r | — / Not established | — / Entra, PS, JSON, AI | S-RH-1 ✓ (B7) |
| Require a Fresh Sign-in for Intune Enrollment | ✓ | Sep 10 / Sep 10 | n/r | 30 people / Not established | Entra, PS, JSON, AI / same | S-IE-5 ✓ Follow-up Ready · Observing with Report-only chip |
| Protect Sign-in Method Registration | ✓ | Sep 12 / Sep 12 | report-only sentence on demo | 29 people / Not established | PS, JSON, AI, Email (no Entra) / Entra, PS, JSON, AI, Email | P2-1 |
| Block the Admin Portals for Non-Admins | ✓ | Sep 12 / Sep 12 | ✓ kept (S-AP-6) | Not established / same | NtS / NtS | S-AP-2 ✗ (P0-6) |
| Limit How Long Sessions Last | ✓ | Sep 10 / Sep 10 | ✓ S-SL-8 | Not established / same | Entra, PS, AI / same | S-SL-4 answered: the line draws on both tenants |
| Block Unsupported Device Platforms | ✓ | Sep 12 / Sep 12 | ✓ S-UP-5 | Not established / same | 5 tabs / 5 tabs | ✓ |
| Require MFA to Register a Device | ✓ | Sep 10 / Sep 10 | ✓ S-DR-9 | Not established / same | Entra, PS, JSON, AI / same | S-DR-6 dense: 7–8 tiles × 108–125 px (P0-2) |
| Block Sign-ins From Countries Not Allowed | ✓ | Sep 12 / Sep 12 | ✓ S-GR-8 | Not established / same | 5 tabs / 5 tabs | S-GR-2 partner/travel condition tiles not drawn (per-step item) |
| Require a Managed Device Outside the Office | ✓ | Sep 12 / Sep 12 | ✓ S-MD-9 | Not established / same | 5 tabs / 5 tabs | Threshold 27% gate wording (not enforced) ✓ |
| Remediate High-Risk Users | ✓ | not licensed / n/r | n/r | — / Not established | — / NtS | real Ready · Correct Enforced; channels ✗ (P0-1) |
| Reset Passwords for Medium-Risk Users | ✓ | not licensed / Sep 10 | n/r | — / Not established | — / Entra, PS, JSON, AI | On Hold ✓ |
| Rename Policies Off the Naming Convention | ✓ | not on demo / — | n/r | — / — | — / Implementation heading with the rename list | S-RN-2 content survived ✓ |
| Review Baseline Policies IAMAI Did Not Assess | ✓ | — / — | ✓ | — / — | Implementation heading with the policy list / same | S-RB-3 content survived ✓; S-RB-7 Done gate not exercised |
| Restrict the Entra Connect Sync Account | — | — | — | — | — | real: absent from the plan and no Not licensed group ✓ (S-WI-1); demo: listed under Not licensed (P2-6) |

## Phase results

### Phase 1 — engine states

**Enforced policies read Completed or Correct.**
- Demo Initial: Require MFA for Everyone, Block Device Code Sign-in and Block Legacy Authentication read Ready · Correct ✓.
- Demo Follow-up: four Enforced policies Completed ✓ (Require MFA for Everyone, Require Phishing-Resistant MFA for Admins, Block Legacy Authentication, Require MFA for Guests). Block Device Code Sign-in reads Ready · Observing with the Enforced chip ✗ (P0-12).
- Real tenant: 9 of 9 Ready · Correct ✓.

**Substatus "Decision":** ✓ on rows and badges; the Decision tile's value still reads "Needs decision" ✗ (P1-1).

**Completion gates:** the unsaved inputs keep steps open ✓. No tile names them ✗ (P1-2); the campaign gate is missing ✗ (P0-10).

**packageStateOf safe correction:** the demo's enforced drifted steps draw their channels (as preview). The real tenant's enforced steps return `blocked` and draw nothing ✗ (P0-1).

**Threshold tile state-aware:** ✓
- Enforced: "13% of people in scope have a qualifying method." (demo), "0% of admins have a qualifying method." (real).
- Not enforced: "admin readiness is 67% today; enforcement waits for 100%." (demo report-only).

### Phase 2 — plan rows

✓ on demo Initial (14 / 4 / 12 + 1 Completed), demo Follow-up (13 / 2 / 10 + 9 Completed) and the real tenant (19 / 6 / 7, 0 Completed):
- zero `.plan-row-reason`
- zero "next" pills
- no "Configuration only"
- every Impact is a count, "Not established", "—" or a B8 label

### Phase 3 — step body layout

- No "What to do" ✓.
- Grid `1fr 260px` ✓ on every non-Cleanup step; Cleanup rows are one column by design.
- DOM order `step-main-lead` → `step-action-column` → `step-main-rest` ✓.
- At 800 px: one 731 px column, action column between Readiness and Implementation, no overflow ✓.
- Milestone and inputs in the action column ✓.
- Planned work banner gone ✓.
- Content survival: Separate Accounts' checklist under Entra ✓; Review Baseline's list under Implementation ✓; Rename Policies' list under Implementation (real) ✓.

### Phase 4 — tiles

- Compact/expand ✗ (P0-2).
- Transitive suppression: special case only ✗ (P1-3). The real tenant's enforced policies show only the direct Exclusions Group tile ✓.

### Phase 5 — Implementation

- Channels on enforced policies: demo ✓ (preview), real ✗ (P0-1).
- Non-policy steps Entra + AI Info only ✗ (P0-4, P1-4).
- Sticky viewer ✗; icon buttons: inline ✓ (Copy and Expand are `icon-btn` with aria-labels), dialog ✗ (P0-5).
- Disabled Copy with tooltip ✗ (P0-3).
- Admin Portals conflict message ✗ (P0-6).

### Phase 6 — data and content

- Exclusion-group investigation: recorded by B6 (BLOCKED.md §U27). Root cause is the unanswered exclusions question, not an id mismatch; the wording is an owner decision (P1-6).
- Pre-filled pickers: ✓ real tenant (one chip, "Matched by IAMAI", step stays Ready · Decision). Demo has two candidates, so no pre-fill, as U24 intends.
- High-Risk channels ✓.
- Workload identity absent on the real tenant ✓.
- Device-code input ✓ on both tenants.

### B8 checks

- **Source checked:** drawn on every package-backed step read. Absent on Devices, Campaign, Dormant Accounts, Service Accounts Group, Shared Devices, Review Baseline, the Drill and the alerting Cleanup row.
- **Learn →:** ends Why on every step on both tenants.
- **Done when:** B8's sentences on all policies read ✓; Restrict Service Accounts stays generic (P2-5).
- **Impact labels:** ✓ Passkey settings, Authentication strength, Trusted network, Country restrictions. "Device policies" is not visible because Devices has a count.

### Forbidden-content sweep

- **Board** (`main` text, both toggles pressed): 0 on demo Initial, demo Follow-up and the real tenant, for "What to do", "Planned work", "Nothing to submit yet", "Configuration only" and "Needs decision".
- **Opened steps:**
  - "Needs decision" on Devices (demo, real) and Exclusions Group (real) (P1-1).
  - "Nothing to submit" on Admin Portals (demo, real) (P0-6) and the 9 enforced real-tenant policies (P0-1).
- **Rows:** no "next" pill; no person's name in Impact.

### Items B1–B8 were not designed to implement

| Item | Result |
|---|---|
| 10 Emergency Access per-account tiles | ✗ P0-7 |
| 11 Device Decision dropdowns, conditional Unmanaged phones | ✗ P0-8 |
| 12 Campaign Entra / in-person channels, special-care gate | ✗ P0-9, P0-10 |
| 13 Exclusions Group Check tile references intended policies | ✗ P0-11 |
| 14 Campaign stays open until special-care is identified or confirmed none | ✗ P0-10 |

## Phase 8: Real tenant

Signed in with the browser's existing session and scanned read-only.

Connect reads "Scan complete · Plan ready · 32 steps, 0 completed". Plan tiles: Steps 32 · Completed 0 · Projected finish Sep 21, 2026 · Started —. Tabs: Ready 19 · Up Next 6 · On Hold 7; nothing Completed or Deferred.

| Enforced policy | Badge / lane | Implementation channels | "Nothing to submit yet" | Verdict |
|---|---|---|---|---|
| Shorten Admin Sessions | Ready · Correct, Enforced | none | yes | P0-1 |
| Require Phishing-Resistant MFA for Admins | Ready · Correct, Enforced | none | yes | P0-1 |
| Block Authentication Transfer | Ready · Correct, Enforced | none | yes | P0-1 |
| Block Device Code Sign-in | Ready · Correct, Enforced | none | yes | P0-1 |
| Block Legacy Authentication | Ready · Correct, Enforced | none | yes | P0-1 |
| Require MFA for Guests | Ready · Correct, Enforced | none | yes | P0-1 |
| Require MFA for Everyone | Ready · Correct, Enforced | none | yes | P0-1 |
| Require Token Protection on Windows | Ready · Correct, Enforced | none | yes | P0-1 |
| (also) Remediate High-Risk Users | Ready · Correct, Enforced | none | yes | P0-1 |

No enforced policy reads Observing ✓. All read Correct rather than Completed because the exclusions group is unconfirmed (P1-6); each carries only the Prerequisite · Ready: Create or Correct Exclusions Group tile.

1. **Exclusion-group step:** Ready · Decision. The picker opens on one group, badged "Matched by IAMAI" ✓. The Decision tile reads "Needs decision" (P1-1).
2. **Passkey settings:** Set Up Passkeys to Match the Baseline reads Ready · Create ✓. It offers PowerShell (P0-4).
3. **Campaign:** Up Next · After Set Up Passkeys to Match the Baseline ✓. No Implementation (P0-9), no gate (P0-10).
4. **Not licensed:** no Not licensed group; the workload-identity step appears nowhere ✓.
5. **Impact:** no row shows a person's name ✓. Values seen: counts ("3 people", "1 person"), "Not established", "—", "Passkey settings", "Authentication strength", "Trusted network", "Country restrictions".
6. **Subtitles:** no row has a subtitle ✓ (0 `.plan-row-reason`).
7. **Forbidden sweep on the Plan page:** board 0 for all five phrases ✓. In opened steps, "Nothing to submit" appears on the 9 enforced policies and Admin Portals, and "Needs decision" on Devices and Exclusions Group.
8. **Other readings:**
   - Block Legacy Authentication carries the mail-sending devices input, Block Device Code Sign-in the device-code input, and Require MFA for Guests the partner inputs, all in the action column ✓.
   - Threshold tiles are informational on enforced policies ✓.
   - Rename Policies Off the Naming Convention and Review Baseline Policies IAMAI Did Not Assess draw their lists under Implementation ✓.

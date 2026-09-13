# POST-B10 audit (segment B11)

**Not ready to deploy: 1 P0 remains (P0-1, Require MFA for Guests on the real tenant).**

Audit of B10's fixes. 2026-09-12, HEAD `a6a1b29`, dev server `localhost:5173`, Chrome.

**Read:**
- RUN-CONTEXT-B and SEGMENTS-B §B11, plus the B10 item 2a–2h lines §B11 points to.
- POST-B8-AUDIT, MASTER, BLOCKED.md.
- The step-findings README and the docs for Emergency Access, Exclusions Group, Devices, Campaign, Block Legacy Authentication, Require Phishing-Resistant MFA for Admins, Token Protection and Geo Restriction. The rest were read through B9's per-step table.

**Method.**
- **Rows opened and read by script** (badge, grid, tiles with heights, Implementation tabs, Copy state and title, Learn, Source checked, empty box, forbidden words):
  - demo Initial: all 30 lane rows plus the Completed group
  - demo Follow-up: all 25 lane rows plus the 9 Completed
  - real tenant: all 32 rows
- **Driven by script:**
  - the expand viewer on a long channel, scrolled and closed with Minimize
  - a tile expanded, then the step closed and reopened
  - the device decision's Phones dropdown moved and put back, without Save
- **Real tenant:** signed in silently through the browser's existing Microsoft session. The same-day scan (1 hour old) was read, not rescanned.
- **Nothing was saved** to any plan record. No UPN, object id, person name, group name or tenant policy name is recorded here.
- **Screenshots:** the board was screenshotted; the two step screenshots timed out while the unit suite ran. Layout was read from computed styles on every opened step.

**Severity:** as B9.
- **P0:** contradicts a RUN-CONTEXT-B decision, is one of B9 items 10–14, is an enforced real-tenant policy reading Observing or "Nothing to submit yet" (or drawing no channel), or leaves the unit suite red.
- **P1:** a MASTER target or step-findings fix is unmet with no decision behind it.
- **P2:** polish, or a reading this audit could not settle.

## Summary

**Remaining: 1 P0 · 2 P1 · 14 P2.**

- **B9's P0s:** 12 of 13 FIXED. P0-1 is STILL BROKEN on one policy: 8 of the 9 enforced real-tenant policies now draw Entra, PowerShell, JSON and AI Info, but Require MFA for Guests draws no channel ("No artifact for this policy yet"), as B10 recorded in BLOCKED.md.
- **B9's P1s:** 5 of 6 FIXED. P1-6 is STILL BROKEN in part: the Prerequisite tile says to confirm the exclusions group, but the readiness bar under the same step still says the policy "names an object IAMAI does not have yet".
- **B10's deferred items 2a–2h:** all DONE. 2e is on screen with its Save path unit-tested only; 2f differs from the segment text as B10 recorded.
- **New P1 (P1-7):** a package readiness gate renders the retired word "Blocked" as a tile value on Require MFA to Register a Device, on both demo scans and the real tenant.
- **The unit suite was red at `a6a1b29`:** 2,517 tests, 2,506 pass, 9 fail. B10 never ran the full suite, and all 9 are checks that did not follow its product. B11 brought them up to date in `8debd91` (P0-14, FIXED); the suite at that commit reads 2,517 tests, 2,515 pass, 0 fail.
- **Nowhere, on the demo (both scans) or the real tenant:**
  - "Nothing to submit yet", "What to do", "Planned work", "Configuration only", "Needs decision"
  - a row subtitle or a "next" pill
  - a person's name in Impact
  - a console error

## B9 P0 verification

| # | B9 finding | Status | Evidence |
|---|---|---|---|
| P0-1 | Enforced real-tenant policies show "Nothing to submit yet" and no channel | **STILL BROKEN (1 of 9)** | Real tenant: Require MFA for Everyone, Shorten Admin Sessions, Require Phishing-Resistant MFA for Admins, Block Authentication Transfer, Block Device Code Sign-in, Block Legacy Authentication, Require Token Protection on Windows and Remediate High-Risk Users all read Ready · Correct and draw Entra · PowerShell · JSON · AI Info. Copy is disabled, titled "…Values still to resolve: policy conditions.", and Entra holds the correction text. **Require MFA for Guests** draws no tab and reads "No artifact for this policy yet / IAMAI offers no artifact for this policy as it stands." "Nothing to submit yet" appears nowhere. |
| P0-2 | Tiles not compact | FIXED | Every unresolved tile on all three plans is one 47 px line: `button.tile-summary[aria-expanded=false]`, detail `hidden`, `.readiness-strip` `align-items: start`. Opening Break-glass 2 grows it to 135 px while Break-glass 1 stays 47 px. After close and reopen, both read collapsed at 47 px. |
| P0-3 | Copy removed on previews | FIXED | Copy is drawn on every step with channels. On a preview it is `aria-disabled="true"` with the preview's lines as its title: Exclusions Group reads "Nothing blocks this step, but IAMAI cannot fill in every value yet, so this cannot be copied. Values still to resolve: group name, group mail nickname and group members." Elsewhere it is enabled. Its muting broke design rule 2 (opacity) and was corrected in B11 (P0-14). |
| P0-4 | PowerShell/JSON on non-policy steps | FIXED | Demo: Emergency Access, Exclusions Group, Passkeys, Allowed Countries, Service Accounts Group, Dormant Accounts, Separate Accounts and the campaign offer Entra · AI Info. Real: also Authentication Strength and Trusted Network. Policy steps keep PowerShell and JSON. |
| P0-5 | Viewer not sticky, text buttons | FIXED | Block Sign-ins From Countries Not Allowed, PowerShell: `.dialog-head` is `position: sticky`. It holds the five channel tabs, the icon-only Copy (aria-disabled) and the icon-only Minimize, and no dialog button carries visible text. Scrolling the content to its end (109 px) leaves the head's top at 24.7 px. |
| P0-6 | Admin Portals conflict message | FIXED | Demo and real: "Not enough information to provide implementation guidance. The baseline defines this policy two ways; …", no tab. |
| P0-7 | Emergency Access per-account tiles | FIXED | Demo: Break-glass 1 · Minimum met · hardening open; Break-glass 2 · Minimum not met. Real: Account 1 · Not selected; Account 2 · Not selected. No Check or Resilience tile. |
| P0-8 | Device decision dropdowns | FIXED | Phones and Computers are `select` elements that open on "Choose…", with no radio. Unmanaged phones is absent, appears when Phones = Enroll phones in Intune, and goes when Phones = Protect company apps only. Put back unsaved. |
| P0-9 | Campaign channels | FIXED | Demo and real offer Entra and AI Info. Entra: "Security → Authentication methods → Registration campaign … Target: All users. Authentication method: Passkey (Microsoft Authenticator). Enforcement: remind on sign-in … Save." AI Info: the in-person walkthrough, with "MFA Readiness →" linking `#/readiness`. Source checked Sep 12, 2026. |
| P0-10 | Campaign special-care gate | FIXED (on screen) | A "People who need special care · Confirm" tile on demo Initial, demo Follow-up and the real tenant; the campaign is never Completed. Saving an empty list was not exercised: the audit writes nothing. `campaignStep` tests assert it. |
| P0-11 | Exclusions Check tile names existing policies | FIXED | No "Exclude the group from" or "Users → Exclude" on the step. Demo: "Policies · 0 of 5 policies exclude the group — Each policy step adds the group where it is missing, and a policy the plan creates includes it when it is created." |
| P0-12 | Enforced policy reads Observing | FIXED (owner confirmation open) | Demo Follow-up: Block Device Code Sign-in reads Ready · Decision with the Enforced chip and a "Device code sign-in · Confirm" tile. No enforced policy reads Observing on any plan. |
| P0-13 | Suite red from B8 | FIXED | B9's five tests pass. The suite went red again from B10 (P0-14). |
| P0-14 | *(new)* Suite red at `a6a1b29`: 9 of 2,517 fail | FIXED in `8debd91` | See P0-14 below. |

## B9 P1 verification

| # | B9 finding | Status | Evidence |
|---|---|---|---|
| P1-1 | Decision tile reads "Needs decision"; no matched group | FIXED | Devices (demo, real): Decision · Decision. Exclusions Group (real): Decision · Decision, note "IAMAI found {group}. Confirm this is the right group.", with the picker's chip badged Matched by IAMAI. |
| P1-2 | No tile names an unsaved input | FIXED | Confirm tiles: Mail-sending devices (Block Legacy Authentication), Device code sign-in, Partner or MSP access (Require MFA for Guests), People who travel or work abroad (Allowed Countries), People who need special care (campaign). |
| P1-3 | Transitive suppression special case | FIXED | Demo On Hold policies show Create or Correct Exclusions Group and not Emergency Access. Real Require Phishing-Resistant MFA for Admins shows only the Exclusions Group prerequisite. Restrict Service Accounts to the Trusted Network keeps both of its prerequisites, since neither is the other's ancestor in the graph (B10 choice). |
| P1-4 | Separate Accounts no AI Info | FIXED | Entra · AI Info, demo and real. |
| P1-5 | Dormant Accounts no Implementation | FIXED | Entra · AI Info on both demo scans. |
| P1-6 | Unconfirmed group read as a missing object | **STILL BROKEN (bar)** | The tile is fixed. On the real tenant, Block Legacy Authentication's prerequisite tile reads "Confirm the exclusions group on Create or Correct Exclusions Group first: IAMAI found a group that qualifies, and only your Save makes it the one this policy excludes". But the readiness bar on Require Phishing-Resistant MFA for Admins reads "Needs correction · Create or Correct Exclusions Group first: this policy names an object … does not have yet." |

## B10 deferred items (2a–2h)

| Item | Status | Evidence |
|---|---|---|
| 2a Emergency Access per-account tiles | DONE | P0-7. |
| 2b Device decision dropdowns | DONE | P0-8. |
| 2c Campaign Entra channel | DONE | P0-9. The target, remind-on-sign-in and Save lines match the segment text. |
| 2d Campaign walkthrough channel | DONE | In AI Info, because the content schema has no custom channel names (B10 choice). It carries the ten-minute booking, aka.ms/mfasetup, the Temporary Access Pass, text/call-only, and the admin lines. |
| 2e Campaign special-care gate | DONE (on screen) | P0-10. The Save that writes `specialCareConfirmed` was not exercised. |
| 2f Exclusions Group Check tile | DONE, with deviation | The tile counts existing policies that exclude the group and says in a sentence that a created policy includes it. The segment asked for planned policies listed as "will include at creation": the contract holds no plan-wide step list (B10 choice). |
| 2g Separate Accounts content | DONE | Entra checklist (B8) and AI Info (B10). |
| 2h Review Baseline layout exception | DONE (no change needed) | A Cleanup row: one column, its list under Implementation, Learn → in Why. |

## P0

| # | Finding | Seen | Authority | Fix |
|---|---|---|---|---|
| P0-1 | Require MFA for Guests, enforced on the real tenant, draws no Implementation channel: "No artifact for this policy yet / IAMAI offers no artifact for this policy as it stands." | Real tenant (Ready · Correct, Enforced). Demo Initial reads On Hold · Not supported with Entra · PowerShell · AI Info; demo Follow-up reads Completed. | Decision 5, U14, U19, Phase 8 rule, B13 live check 25 | `docs/implementation-content/s-goal-guests-mfa/`: author the pair's `partial` projection in the composed shape Block Legacy Authentication's package uses, built from the changed fields (`conditions.users.excludeGroups`), so `--registry` keeps it. Recompile with `node scripts/compile-implementation-content.mjs --registry`, then `--library-index`. The runtime needs nothing else: `plannedPackageStateOf` already plans the correction and `packageBindings` binds the emptied field (B10 BLOCKED). Test in `implementationRegion.test.ts` P0-1: add the guests pair to the enforced steps on the unanswered-exclusions mid fixture, expecting Entra, JSON and AI Info and no empty box. |
| P0-14 | The unit suite fails 9 of 2,517 at `a6a1b29`. | `npm test`, B11 | CLAUDE.md "Done means … CI green" | **FIXED in `8debd91`.** The checks follow B10's product:<br>• `LIBRARY.json` regenerated (`--library-index`)<br>• `pilot.test.ts` and `accessibility.test.ts` read the always-drawn Copy and the parenthesised artifact list<br>• `stepFamilies.test.ts` reads the typed `channels.map`<br>• `stepFamilies.test.ts` and `planAnatomy.test.ts` count only returns at the step's own level, so the emergency slot callback is not a second render path<br>• `planAnatomy.test.ts` reads decision 3's one-line tile, lets the emergency slots carry its `check:` fixes, and gives the hand-built contract `exclusionsReach: null`<br>• `planMigration.test.ts` counts the exclusions reach tile as carrying the usage check<br>• the disabled Copy is muted by `color: var(--quiet-text)`, the idiom `.btn:disabled` uses, not `opacity: 0.4`, which design rule 2 forbids; `implementationRegion.test.ts` asserts it |

## P1

| # | Finding | Seen | Authority | Fix |
|---|---|---|---|---|
| P1-6 | The readiness bar calls an unconfirmed exclusions group a missing object, while the prerequisite tile says to confirm it. | Real tenant, enforced policies waiting on the unconfirmed group (read on Require Phishing-Resistant MFA for Admins) | U27, S-LA-1, B10's P1-6 choice | `src/ui/surfaces/stepJson.ts` 70 fills `pages.app.plan.jsonWaits` ("{steps} first: this policy names an object {tenant} does not have yet."). Where the missing value is `{exclusionsGroup}` and the exclusions question is unanswered with a qualifying group, fill `CONTRACT.fixConfirmExclusions` instead, with the same test `stepContract.ts` 643 uses. Test: the unanswered-exclusions mid fixture's legacy-auth bar and tile both name the confirmation, and no line on the step says "does not have yet". |
| P1-7 | A package readiness gate renders the retired word "Blocked" as a tile value. | Require MFA to Register a Device: "Exclusions · Blocked" (demo Initial, demo Follow-up, real); "Authentication strength · Blocked" (real) | A1b retired words (`oneProducer.test.ts`: "no retired word renders … on an opened step"), B13 live check 8 | `src/ui/surfaces/stepPackage.ts mergeReadiness` (576) sets `value: t.result` straight from the package protocol (`protocol.ts READINESS_RESULTS`). Map the result through a content word instead (a new key such as `readiness.tiles.result`, where Blocked → "Not met"); the protocol vocabulary stays. `oneProducer.test.ts wordsOf` reads `readinessOf` alone, so add the merged package tiles (`mergeReadiness`) to the words it checks. |

## P2

| # | Finding | Note |
|---|---|---|
| P2-1 | Protect Sign-in Method Registration on the demo offers PowerShell / JSON / AI Info / Email and no Entra. On the real tenant (Up Next) it offers all five. | Unchanged; frozen source conflict. |
| P2-2 | This browser's demo Follow-up record still lacks the seeded device-code answer, so Block Device Code Sign-in reads Ready · Decision, not Completed. | Not re-read in a fresh profile: the extension drives the existing one. Unchanged from B9. |
| P2-3 | The action column's metric repeats the lane label on undated steps. | Not re-read. |
| P2-4 | Impact reads "—" on Emergency Access, Exclusions Group, Service Accounts Group, Review Baseline and Rename Policies. | Unchanged. |
| P2-5 | Restrict Service Accounts to the Trusted Network's Done when is generic. | Not re-read. |
| P2-6 | The demo's Not licensed group lists the Entra Connect Sync step. | Not re-read on the demo. The real tenant has no Not licensed group. |
| P2-7 | Viewer scroll on a long channel. | Exercised: head fixed through the full scroll (109 px). Closed. |
| P2-8 | Post-Save transitions not exercised. | Unchanged: the audit writes nothing. |
| P2-9 | Require Phishing-Resistant MFA for Admins shows no Set Up Passkeys prerequisite tile. | Unchanged on the real tenant (Threshold, Affected people, Exclusions Group). |
| P2-10 | Use Separate Accounts' Impact reads "1 person" on the real tenant (S-SA-3 asks "1 admin"). | Unchanged. |
| P2-11 | A delivered policy draws no channel: "No implementation needed / The tenant already delivers this, so nothing is generated for it." | Demo Follow-up: the Completed enforced policies (Require MFA for Everyone, Require Phishing-Resistant MFA for Admins, Block Legacy Authentication, Require MFA for Guests), and Block Device Code Sign-in at Ready · Decision. Decision 5 says channels show wherever authored content exists, and B13 check 25 asks every enforced real-tenant policy for visible channels. Once the exclusions group is confirmed, an undrifted enforced policy reads Completed with none. Owner reading: does "authored content" cover a delivered state? |
| P2-12 | "Prerequisites · when 1 MFA grant on this policy exist (now 0)" and "when 1 trusted location exist (now 0)": a singular count with a plural verb. | `content.json` 684 `count`; pluralise the verb. |
| P2-13 | The exclusions reach tile sits behind "1 satisfied" while reading "0 of 5 policies exclude the group", and is not drawn on the real tenant while the group is unconfirmed. | `stepContract.ts exclusionsReachTile` (info tone). |
| P2-14 | Demo Follow-up: Exclude the Partner or MSP Accounts (Ready · Decision) draws no Decision tile and no channel; Set Up an SMTP Relay for Mail-Sending Devices (Ready · Create) draws no tile and no channel. | Conditional steps outside the step-findings set. |

## Per-step content table

Legend:
- **Learn:** Why ends in Learn → (for Cleanup rows, the step's Learn → link).
- **Source:** "Source checked" date (demo / real; "—" none drawn).
- **Channels:** demo Initial / real; "none" = no tab.
- **Result vs B9:** what changed since B9's reading.

| Step | Learn | Source | Impact (demo / real) | Channels (demo / real) | Result vs B9 |
|---|---|---|---|---|---|
| Create or Correct Emergency Access Accounts | ✓ | Sep 12 / Sep 12 | — / — | Entra, AI / Entra, AI (Copy disabled) | S-BG-1 ✓ (was ✗); S-BG-2 ✓ (was ✗); demo Ready · Correct, real Ready · Create |
| Create or Correct Exclusions Group | ✓ | Sep 12 / Sep 12 | — / — | Entra, AI (Copy disabled with reason) / same | S-EG-1 ✓, S-EG-2 ✓, S-EG-3 ✓ (all were ✗); S-EG-6 deferred |
| Decide How Devices Are Managed | ✓ | — / — | 6 people / 3 people | none / none | S-DD-1 and A1 ✓; tile Decision ✓ (all were ✗) |
| Create and Enforce the MFA Registration Campaign | ✓ | Sep 12 / Sep 12 (was —) | 30 people / 3 people | Entra, AI / Entra, AI | S-MC-1 ✓, S-MC-3 link ✓, S-MC-2 gate tile ✓ (were ✗) |
| Block Legacy Authentication | ✓ | Sep 12 / Sep 12 | Not established / same | Entra, PS, JSON, AI / same | real channels ✓ (was NtS); Confirm tile ✓; U23 deferred |
| Require Phishing-Resistant MFA for Admins | ✓ | Sep 12 / Sep 12 | Not established / same | Entra, PS, AI (On Hold, Report-only) / Entra, PS, JSON, AI | S-PR-3 ✓ (was ✗); S-PR-2 ✓ "0% of admins have a qualifying method."; bar wording P1-6; P2-9 |
| Set Up Passkeys to Match the Baseline | ✓ | Sep 12 / Sep 12 | Passkey settings / same | Entra, AI / Entra, AI | S-PK-1 ✓ (was ✗); real Ready · Create ✓ |
| Create the Baseline's Authentication Strength | ✓ | not on demo / Sep 12 | not on demo / Authentication strength | — / Entra, AI | S-AS-1 ✓ (was ✗) |
| Define the Trusted Network | ✓ | Completed on demo / Sep 12 | Trusted network / same | — / Entra, AI (Copy disabled) | S-TN-1 ✓, S-TN-3 ✓ (were ✗) |
| Create or Correct Allowed Countries Location | ✓ | Sep 12 / Sep 12 | Country restrictions / same | Entra, AI / Entra, AI | S-AC-1 ✓ (was ✗); travel Confirm tile ✓ |
| Use Separate Accounts for Admin Work | ✓ | Sep 12 / Sep 12 | 2 people / 1 person | Entra, AI / Entra, AI | AI Info ✓ (was ✗); S-SA-3 ✗ (P2-10) |
| Disable or Confirm Dormant Accounts | ✓ | — / not on real | 3 people / — | Entra, AI / — | P1-5 ✓ (was none) |
| Create or Correct Service Accounts Group | ✓ | — / not on real | — / — | Entra, AI (Copy disabled) / — | PowerShell gone ✓ |
| Give Shared Devices Their Own Policy | ✓ | — / not on real | 1 person / — | Entra, PS, AI / — | policy-kind step, keeps PowerShell |
| Shorten Admin Sessions | ✓ | Sep 12 / Sep 12 | Not established / same | Entra, PS, JSON, AI, Email (On Hold) / Entra, PS, JSON, AI | real channels ✓ (was NtS) |
| Block Authentication Transfer | ✓ | Sep 12 / Sep 12 | Not established / same | 5 tabs (On Hold) / Entra, PS, JSON, AI | real channels ✓ (was NtS) |
| Block Device Code Sign-in | ✓ | Sep 12 / Sep 12 | Not established / same | Entra, PS, JSON, AI / same | real channels ✓ (was NtS); Follow-up Ready · Decision, no channel (P0-12 ✓, P2-2, P2-11) |
| Require MFA for Guests | ✓ | Sep 12 / Sep 12 | Not established / same | Entra, PS, AI (On Hold · Not supported) / **none** | real channels ✗ (**P0-1**); partner Confirm tile ✓ |
| Require MFA for Everyone | ✓ | Sep 12 / Sep 12 | Not established / same | Entra, PS, JSON, AI / same | real channels ✓ (was NtS); Threshold 13% demo / 33% real |
| Require Token Protection on Windows | ✓ | Sep 10 / Sep 10 | Not established / same | Entra, PS, JSON, AI / same | real channels ✓ (was NtS); S-TP-5 compatibility tile still absent |
| Challenge Medium-Risk Sign-ins | ✓ | not licensed / Sep 10 | — / Not established | — / Entra, PS, JSON, AI | Up Next ✓ |
| Require MFA at Every Role Activation | ✓ | not licensed / Sep 10 | — / Not established | — / Entra, PS, JSON, AI | Up Next ✓ |
| Challenge High-Risk Sign-ins | ✓ | not licensed / Sep 10 | — / Not established | — / Entra, PS, JSON, AI | Up Next ✓ |
| Require a Fresh Sign-in for Intune Enrollment | ✓ | Sep 10 / Sep 10 | 30 people / Not established | Entra, PS, JSON, AI / same | Follow-up Ready · Observing, Report-only, Entra, PS, AI |
| Protect Sign-in Method Registration | ✓ | Sep 12 / Sep 12 | 29 people / Not established | PS, JSON, AI, Email / Entra, PS, JSON, AI, Email | P2-1; real "when 1 trusted location exist" (P2-12) |
| Block the Admin Portals for Non-Admins | ✓ | Sep 12 / Sep 12 | Not established / same | none (conflict message) / same | S-AP-2 ✓ (was ✗) |
| Limit How Long Sessions Last | ✓ | Sep 10 / Sep 10 | Not established / same | Entra, PS, AI / same | unchanged |
| Block Unsupported Device Platforms | ✓ | Sep 12 / Sep 12 | Not established / same | 5 tabs / 5 tabs | unchanged |
| Require MFA to Register a Device | ✓ | Sep 10 / Sep 10 | Not established / same | Entra, PS, JSON, AI / same | tiles compact ✓ (S-DR-6 density was P0-2); "Blocked" gate values ✗ (P1-7) |
| Block Sign-ins From Countries Not Allowed | ✓ | Sep 12 / Sep 12 | Not established / same | 5 tabs / 5 tabs | S-GR-2 partner and travel condition tiles still not drawn |
| Require a Managed Device Outside the Office | ✓ | Sep 12 / Sep 12 | Not established / same | 5 tabs / 5 tabs | Threshold 27% demo / 0% real |
| Restrict Service Accounts to the Trusted Network | ✓ | Sep 10 / not on real | Not established / — | Entra, PS, JSON, AI / — | both prerequisite tiles kept (B10 P1-3 choice) |
| Remediate High-Risk Users | ✓ | not licensed / Sep 10 | — / Not established | — / Entra, PS, JSON, AI | real channels ✓ (was NtS) |
| Reset Passwords for Medium-Risk Users | ✓ | not licensed / Sep 10 | — / Not established | — / Entra, PS, JSON, AI | On Hold ✓ |
| Rename Policies Off the Naming Convention | ✓ | not on demo / — | — / — | — / Implementation list | one column, Learn → ✓ |
| Review Baseline Policies IAMAI Did Not Assess | ✓ | — / — | — / — | Implementation list / same | 2h ✓ |
| Restrict the Entra Connect Sync Account | — | — | — | — | real: absent from the plan, no Not licensed group ✓ |

**Source checked still absent** (unchanged from B9): Devices, Dormant Accounts, Service Accounts Group, Shared Devices, Review Baseline, and the Drill and alerting Cleanup rows. Fixed since B9: the campaign.

## Phase results

### Engine states
- **Demo Initial:** Require MFA for Everyone, Block Device Code Sign-in and Block Legacy Authentication read Ready · Correct with the Enforced chip ✓.
- **Demo Follow-up:** Require MFA for Everyone, Require Phishing-Resistant MFA for Admins, Block Legacy Authentication and Require MFA for Guests read Completed ✓. Block Device Code Sign-in reads Ready · Decision (P0-12 reading).
- **Real tenant:** 9 of 9 enforced policies read Ready · Correct ✓; none reads Observing.
- **Substatus and bar:** "Decision" on rows, badges and tiles ✓. Threshold on an enforced policy is informational ("0% of admins have a qualifying method.") ✓.

### Plan rows
Every row on all three plans:
- zero `.plan-row-reason`
- zero "next" pills
- no "Configuration only"
- Impact is a count, "Not established", "—" or a B8 label

### Step body
- `1fr 260px` grid on every non-Cleanup step on all three plans, with Cleanup rows one column.
- Headings are Why / Readiness / Implementation / Done when, with no What to do and no Planned work.
- Learn → ends Why everywhere, including the Cleanup rows' Learn link.

### Forbidden-content sweep
- **Real tenant board:** the `main` text of each tab is clean for What to do, Planned work, Nothing to submit, Configuration only, Needs decision, Needs attention, Skipped, Set aside, Blocked and Held.
- **Opened steps:** every step on all three plans was swept for the same words. The only hit is "Blocked" on Require MFA to Register a Device (P1-7), on all three.

## Lane counts

| Plan | Steps | Ready | Up Next | On Hold | Completed | Deferred |
|---|---|---|---|---|---|---|
| Demo Initial | 31 | 14 | 4 | 12 | 1 | 0 |
| Demo Follow-up | 34 | 13 | 2 | 10 | 9 | 0 |
| Real tenant | 32 | 19 | 6 | 7 | 0 | 0 |

## Phase 8: Real tenant

Signed in through the browser's existing session, with no password and no consent screen. The same-day scan was read, not rescanned. Connect reads "Plan ready · 32 steps, 0 completed". Plan tiles: Steps 32 · Completed 0 · Projected finish Sep 21, 2026 · Started —.

| Enforced policy | Badge / lane | Implementation channels | "Nothing to submit yet" | Verdict |
|---|---|---|---|---|
| Shorten Admin Sessions | Ready · Correct, Enforced | Entra, PS, JSON, AI | no | ✓ |
| Require Phishing-Resistant MFA for Admins | Ready · Correct, Enforced | Entra, PS, JSON, AI | no | ✓ |
| Block Authentication Transfer | Ready · Correct, Enforced | Entra, PS, JSON, AI | no | ✓ |
| Block Device Code Sign-in | Ready · Correct, Enforced | Entra, PS, JSON, AI | no | ✓ |
| Block Legacy Authentication | Ready · Correct, Enforced | Entra, PS, JSON, AI | no | ✓ |
| Require MFA for Guests | Ready · Correct, Enforced | **none** ("No artifact for this policy yet") | no | **P0-1** |
| Require MFA for Everyone | Ready · Correct, Enforced | Entra, PS, JSON, AI | no | ✓ |
| Require Token Protection on Windows | Ready · Correct, Enforced | Entra, PS, JSON, AI | no | ✓ |
| (also) Remediate High-Risk Users | Ready · Correct, Enforced | Entra, PS, JSON, AI | no | ✓ |

1. **Exclusions group:** Ready · Decision. The picker opens on one group, badged "Matched by IAMAI" ✓. The Decision tile reads "IAMAI found {group}. Confirm this is the right group." ✓ Copy is disabled with its reason ✓.
2. **Passkey settings:** Set Up Passkeys to Match the Baseline reads Ready · Create with Entra, AI Info ✓.
3. **Campaign:** Up Next · After Set Up Passkeys to Match the Baseline, with Entra and AI Info and the special-care Confirm tile ✓.
4. **Workload identity:** absent from the plan; no Not licensed group ✓.
5. **Impact:** no person's name ✓. Values: "—", "Passkey settings", "Authentication strength", "Trusted network", "3 people", "Country restrictions", "Not established", "1 person".
6. **Subtitles:** 0 ✓.
7. **Forbidden sweep:** board clean; opened steps "Blocked" on Require MFA to Register a Device (P1-7).
8. **Console:** no errors.

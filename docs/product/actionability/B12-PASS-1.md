# READY TO DEPLOY

# B12 pass 1

Fix pass 1 against `POST-B10-AUDIT.md` (1 P0 · 2 P1), then the re-audit in the same session.
- **When:** 2026-09-12 to 2026-09-13.
- **Commits:** `0745511` (P0-1, P1-6, P1-7 `[snapshots]`) and `7fe4f9c` (the P1-6 remainder the re-audit found).
- **Where:** dev server `localhost:5173`, Chrome.

**Read:** RUN-CONTEXT-B, SEGMENTS-B §B12, POST-B10-AUDIT.

**Method.**
- **Demo Initial:** read by an in-page background script (B11's recipe): the three board tabs, and seven opened steps across archetypes.
- **Real tenant:** signed in silently through the browser's existing Microsoft session, with no password and no consent screen. The same-day scan was read, not rescanned. Read the same way: the board tabs, six opened steps, then a sweep of every plan step.
- **Nothing was saved** to any plan record. No UPN, object id, person name, group name or tenant policy name is recorded here.
- **Layout** was read from computed styles, because screenshots time out while the unit suite runs.

**Severity:** as B9 and B11.

## Summary

**Remaining: 0 P0 · 0 P1.** One new P2 (P2-15).

- **Unit suite:** 2,519 tests · 2,517 pass · 0 fail (`npm test`, exit 0, with both pass-1 changes in the tree)
- **Nowhere, on demo Initial or the real tenant:**
  - "What to do", "Planned work", "Configuration only", "Needs decision", "Blocked", "Held"
  - a retired phrase
  - a row subtitle
  - an enforced policy with no channel
  - a console error

## P0

| # | Finding (POST-B10-AUDIT) | Fix | Seen on screen | Unit test | Status |
|---|---|---|---|---|---|
| P0-1 | Require MFA for Guests, enforced on the real tenant, drew no Implementation channel ("No artifact for this policy yet"). | `s-goal-guests-mfa` META: the Partial is `compose`, with one `pair.canonical` module over `conditions`, `grantControls` and `sessionControls`, `mismatchBinding` `policies.guests.semanticMismatches`, and `ai.correct` after. `--registry` now keeps it; the registry and LIBRARY.json are regenerated. | **Real tenant:** Ready · Correct, Enforced, draws Entra · PowerShell · AI Info, no "No artifact" box. **Demo Initial:** On Hold · Not supported, Entra · PowerShell · AI Info, unchanged. JSON stays withheld because `json.target-pair` names no request (BLOCKED S8; B12 choice). | `implementationRegion.test.ts` P0-1: the enforced guests pair on the unanswered-exclusions mid fixture draws Entra, PowerShell and AI Info as a planning preview. | **FIXED** |
| P0-14 | Suite red at `a6a1b29`. | Fixed in B11 (`8debd91`). | — | Suite at the end of pass 1: 2,519 tests · 2,517 pass · 0 fail (`npm test`, exit 0, with both pass-1 changes in the tree) | **FIXED** |

## P1

| # | Finding (POST-B10-AUDIT) | Fix | Seen on screen | Unit test | Status |
|---|---|---|---|---|---|
| P1-6 | The readiness bar called an unconfirmed exclusions group a missing object, while the tile said to confirm it. | **The reading:** `stepContract.ts` computes the unconfirmed-group reading once, and hands it to `actionOf` → `reasonLine` → `stepJson.ts waitingLine`, to the Implementation reason and to `fixOf`. The line fills `fixConfirmExclusions` for the group.<br>**Remainder, found in this re-audit:** on the real tenant, Require MFA to Register a Device still named the group's step among missing objects, through a second missing entry that step makes under another token. The confirmation now covers every object that step makes, by step id, in `waitingLine` and in `fixOf`. | **Real tenant:**<br>• Require Phishing-Resistant MFA for Admins: "Needs correction · Confirm the exclusions group on Create or Correct Exclusions Group first: IAMAI found a group that qualifies, and only your Save makes it the one this policy excludes."<br>• Require MFA to Register a Device: the confirmation, then "Create the Baseline's Authentication Strength first: this policy names an object … does not have yet." The strength really is missing.<br>• The sweep: no step names the exclusions group as missing. | `readinessWords.test.ts`:<br>• P1-6 (B11): on mid with the question unanswered, the bar's sub-line and the Implementation reason of Legacy Authentication, Phishing-Resistant Admins and Guests are the confirmation, and no line on those steps says "does not have yet".<br>• P1-6 (B12 re-audit): a hand-built step with two entries from the group's step and a missing strength. | **FIXED** |
| P1-7 | A package readiness gate rendered the retired word "Blocked" as a tile value. | `stepPackage.ts mergeReadiness` maps the result through a new content key, `pages.app.plan.stepContract.readiness.results`, where Blocked → "Not met". The protocol's words (`READINESS_RESULTS`) stay the package's. | **Require MFA to Register a Device:**<br>• demo Initial: "Exclusions · Not met"<br>• real tenant: "Exclusions · Not met" and "Authentication strength · Not met"<br>No "Blocked" on either. | `oneProducer.test.ts` now reads the tiles through `stepBodyOf`, the runtime's merged with the package's gates, so the retired-word check covers package values. Snapshots: demo, demo-week2 and messy read "Not met" (4 lines). | **FIXED** |

## Re-audit: demo Initial

- **Board:** Ready 14 · Up Next 4 · On Hold 12.
- **Rows:** 0 `.plan-row-reason`.
- **Sweep:** each tab's text is clean of the forbidden words.
- **Console:** no errors.

| Step | Archetype | Bar | Grid | Tiles (collapsed, px) | Channels | Forbidden |
|---|---|---|---|---|---|---|
| Create or Correct Exclusions Group | foundation, Up Next | After Create or Correct Emergency Access Accounts | 950 + 260 | 2 × 46 | Entra, AI Info | none |
| Block Legacy Authentication | enforced | Needs correction | 950 + 260 | 3 × 46 | Entra, PowerShell, JSON, AI Info | none |
| Require MFA for Guests | On Hold (Not supported) | Not supported | 950 + 260 | 3 × 46 | Entra, PowerShell, AI Info | none |
| Create and Enforce the MFA Registration Campaign | campaign, Up Next | After Set Up Passkeys to Match the Baseline | 950 + 260 | 2 × 46 (special care · Confirm) | Entra, AI Info | none |
| Decide How Devices Are Managed | decision | Needs a decision | 950 + 260 | 1 × 46 (Decision · Decision) | — (decision step) | none |
| Require MFA to Register a Device | On Hold (unmapped group) | Baseline references an unmapped group | 950 + 260 | 6 × 46, Exclusions · Not met | Entra, PowerShell, JSON, AI Info | none |
| Require Phishing-Resistant MFA for Admins | On Hold (unmapped group) | Baseline references an unmapped group | 950 + 260 | 4 × 46 | Entra, PowerShell, AI Info | none |

**Layout on every opened step:**
- two columns
- every tile one line and `aria-expanded=false`
- no "What to do" and no "Planned work"

## Re-audit: real tenant

- **Board:** Ready 19 · Up Next 6 · On Hold 7.
- **Rows:** 0 `.plan-row-reason`.
- **Sweep:** each tab's text is clean.
- **Console:** no errors.

**Opened steps:**
- **Require MFA for Guests:** Needs correction. Entra, PowerShell, AI Info. Tiles: Affected people, and the prerequisite asking to confirm the group.
- **Require Phishing-Resistant MFA for Admins:** Needs correction, with the confirmation as its sub-line. Entra, PowerShell, JSON, AI Info.
- **Require MFA to Register a Device:** Baseline references an unmapped group. Its gates read "Not met", and it draws all four channels.
- **Block Legacy Authentication:** Needs correction. Entra, PowerShell, JSON, AI Info.
- **Create or Correct Exclusions Group:** Needs a decision (Decision · Decision). Entra, AI Info.
- **Create and Enforce the MFA Registration Campaign:** After Set Up Passkeys to Match the Baseline, with the special-care Confirm tile. Entra, AI Info.

**Sweep of every plan step** (29 content steps; the Cleanup rows were not in the sweep):
- The two-column grid is on every step.
- No step shows "No artifact for this policy yet".
- No step names the exclusions group as a missing object.
- None shows "What to do", "Planned work", "Configuration only", "Needs decision", "Blocked" or "Held".
- **Enforced policies with channels:**

| Policy | Channels |
|---|---|
| Shorten Admin Sessions | Entra, PowerShell, JSON, AI Info |
| Require Phishing-Resistant MFA for Admins | Entra, PowerShell, JSON, AI Info |
| Block Authentication Transfer | Entra, PowerShell, JSON, AI Info |
| Block Device Code Sign-in | Entra, PowerShell, JSON, AI Info |
| Block Legacy Authentication | Entra, PowerShell, JSON, AI Info |
| Require MFA for Guests | Entra, PowerShell, AI Info |
| Require MFA for Everyone | Entra, PowerShell, JSON, AI Info |
| Require Token Protection on Windows | Entra, PowerShell, JSON, AI Info |
| Remediate High-Risk Users | Entra, PowerShell, JSON, AI Info |

- **Block the Admin Portals for Non-Admins:** the Implementation region reads "Not enough information to provide implementation guidance. The baseline defines this policy two ways; resolve the conflict before implementation is available." (decision 5).

## P2

| # | Finding | Note |
|---|---|---|
| P2-15 | *(new)* Block the Admin Portals for Non-Admins' readiness bar sub-line, and its tile detail, read "Wait for a reviewed baseline that settles the contradiction; there is nothing to submit." | Read on the real tenant. The sentence is the engine's conflict milestone (`stepContract.ts reasonLine`, `baseline-conflict`), which every plan shares. It is not the forbidden "Nothing to submit yet", and the Implementation region shows decision 5's message. B11's sweep matched the phrase case-sensitively, so it was not listed. Owner rewords `engine.milestone.conflict` if the phrase should go too. |
| P2-1 – P2-14 | B11's P2s. | Not re-read in this pass; unchanged by it. |

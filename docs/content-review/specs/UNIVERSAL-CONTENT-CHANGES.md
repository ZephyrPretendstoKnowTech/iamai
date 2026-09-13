# Universal Changes — Content + UI Polish

These items apply across multiple or all steps. They are NOT in the per-step content specs because they're shared code, renderer logic, or patterns that repeat identically. Apply these as a single sweep before or alongside the per-step content specs.

---

## Renderer fixes (code changes)

### R1. Milestone shows lane substatus instead of a date

**Where:** The milestone renderer in the action column (find by grepping `NEXT MILESTONE` in the step body component or `stepContract.ts`).

**Current:** When no date is scheduled (enforced policies, Up Next, On Hold), the milestone renders the lane substatus as its heading: "Ready · Correct", "Up Next · After Create or Correct Exclusions Group", "On Hold · Baseline references an unmapped group."

**Target:** When no date is scheduled, show "—" as the date. The lane substatus is already visible in the badge and the plan row. Showing it again in the milestone is redundant and confusing — it looks like a date field with text instead of a date.

**Affected:** Every enforced policy (9 steps), every Up Next step (6), every On Hold step (7). 22 of 32 steps.

---

### R2. Readiness bar filler text — second location

**Where:** The readiness bar component between the tiles and the "Why IAMAI says this →" link. Different component from the milestone sub-text (which was fixed in B3).

**Current:** Some steps show "Make the object this step names." or "For each person:" in the readiness bar sub-text. B3 removed these phrases from the milestone, but the readiness bar reads from a different source and still shows them.

**Target:** The readiness bar sub-text follows the same rule as the milestone: if the text matches a known filler phrase, render nothing. Known filler: "Make the object this step names", "Make the decision", "Resolve prerequisites", "For each person:".

**Affected:** Passkey Settings ("Make the object this step names."), Separate Accounts ("For each person:"), and likely other foundation steps.

---

### R3. Prerequisite tile label: "READY" → "IN PROGRESS"

**Where:** The tile label renderer in `stepContract.ts` → `engineTiles` or the tile component.

**Current:** Prerequisite tiles show `PREREQUISITE · READY` when the prerequisite step is in the Ready lane. This reads as "the prerequisite is ready/done" when it actually means "the prerequisite is actionable but not complete."

**Target:**
- Prerequisite step is in Ready lane (started but not complete) → `PREREQUISITE · IN PROGRESS`
- Prerequisite step is Completed → `PREREQUISITE · COMPLETED` (with ✓ icon)
- Prerequisite step is Up Next or On Hold → `PREREQUISITE · WAITING`

**Affected:** Every policy step with prerequisites (at least 15 steps).

---

### R4. Tile icon inconsistency: "!" vs "…" vs "✓"

**Where:** The tile icon selector in the tile component.

**Current:** Some tiles show "!" (warning), some show "…" (in progress?), some show "✓" (satisfied). The rules for which icon appears are unclear. On the same step, two prerequisite tiles in the same state show different icons ("!" on one, "…" on another).

**Target:** Consistent icon rules:
- "!" = this tile is blocking or needs attention (unsatisfied prerequisite, unconfirmed input, threshold not met)
- "✓" = this tile is satisfied (prerequisite complete, threshold met, input confirmed)
- No icon or neutral dot = informational (AFFECTED PEOPLE when the count is known)

When a prerequisite tile's label says "IN PROGRESS" or "WAITING", the icon is "!" (it's blocking). When it says "COMPLETED", the icon is "✓".

**Affected:** All steps with readiness tiles.

---

### R5. Readiness tile clear text

**Where:** The clear/satisfied tile content.

**Current:** `✓ Clear — Nothing outstanding changes the next action.`

**Target:** `✓ Clear — No blockers. Ready to proceed.`

"Nothing outstanding changes the next action" is engineer-speak. Replace everywhere it appears.

**Affected:** Every step where all readiness conditions are met (foundation steps on a clean tenant).

---

### R6. Action column heading — bold label above inputs

**Where:** The `StepActionColumn` component (or whatever renders the right column).

**Current:** The action column has the milestone date at the top, then inputs (pickers, dropdowns, Save) below it. There's no heading or visual emphasis on the input section.

**Target:** Add a bold heading above the first input element: the step's input label (e.g. "Emergency access accounts", "Exclusions group", "Device code sign-in", "People who need special care"). Use the existing input label text but render it as a `<strong>` or `<h5>` to draw attention.

**Affected:** Every step with inputs in the action column (~10 steps).

---

### R7. Action column background extends to bottom

**Where:** The `StepActionColumn` CSS.

**Current:** The dark background and left border line of the action column ends after the Save button. Below Save is empty space with the main background color down to "Scan to update the plan."

**Target:** The action column's dark background and left border extend all the way to the bottom of the step, matching the height of the left column. Use `min-height: 100%` on the grid row or `align-self: stretch` on the action column.

**Affected:** Every step with an action column.

---

### R8. Enforced policy substatus priority: Correct wins over Decision

**Where:** The lane derivation in `lanes.ts` — where an enforced policy with drift AND an unanswered conditional input gets its substatus.

**Current:** When an enforced policy has drift (needs correction) AND an unanswered conditional input (e.g. mail devices, device-code workflows), the substatus reads "Decision" because the conditional input's unanswered state overrides the drift state.

**Target:** On an enforced policy with drift, the primary substatus is "Correct" regardless of whether a conditional input is answered. The conditional input shows as a readiness tile ("Confirm") but doesn't change the lane substatus. The admin sees "Ready · Correct" and knows the next action is to correct the policy. The conditional input is secondary — it gates completion but doesn't change the lane label.

**Affected:** Block Legacy Auth, Block Device Code, Require MFA for Guests (any enforced policy with a conditional input).

---

### R9. "No implementation needed" on enforced policies with drift

**Where:** The Implementation section renderer — the condition that shows "No implementation needed / The tenant already delivers this, so nothing is generated for it."

**Current:** This message appears on some enforced policies even when they have drift and need a correction. It fires when the `packageStateOf` determines the tenant's policy "already delivers" the goal, but the exclusion-group correction isn't counted as a mismatch because the exclusion group hasn't been confirmed.

**Target:** "No implementation needed" should NEVER appear on a step that has drift or an unsatisfied readiness tile. If any tile shows "!" or any correction is pending, the Implementation channels render (per U14). The "No implementation needed" message is only valid when the step is fully Completed with zero open items.

**Affected:** Block Legacy Auth (confirmed in Lachlan's screenshot), possibly other enforced policies depending on the scan state.

---

## Content patterns (find-and-replace across all packages)

### C1. Internal IAMAI terms → plain English

Find and replace these terms in every package CONTENT.md file:

| Find | Replace with |
|---|---|
| `IAMAI-resolved canonical target` | `the baseline's target configuration` |
| `IAMAI-resolved canonical exclusions` | `the exclusions group you confirmed in the Exclusions Group step` |
| `IAMAI's canonical target` | `the baseline's target configuration` |
| `canonical exclusions` | `the exclusions group` |
| `canonical target` | `the baseline's target` |
| `stable tenant ID [GUID]` or `stable tenant policy identity` | `(find it by name in Conditional Access, or by ID in Plan settings)` |
| `retained baseline member` | remove the phrase entirely |
| `resolved target` | `baseline's target` |
| `owner-confirmed` | remove (the admin's confirmation is implicit in the step flow) |
| `profileOptInApproved` | `confirm with your admin lead before enabling` |
| `mismatch modules IAMAI selected` | `the corrections listed below` |
| `semantic mismatch(es)` | `differences from the baseline` |
| `tenant truth` | remove — rephrase the sentence |

**Affected:** At least 15 packages (every policy step plus some foundation steps).

---

### C2. Readiness explanation — simplify the exclusion-group sentence

**Current (appears on ~15 steps):**
```
Confirm the exclusions group on Create or Correct Exclusions Group first: IAMAI found a group that qualifies, and only your Save makes it the one this policy excludes.
```

**Target:**
```
Complete the Exclusions Group step first. IAMAI found a matching group, but needs your confirmation before this policy can reference it.
```

**Where:** This text appears in the readiness bar explanation on every step that depends on the exclusions group. It's likely generated by a shared function or template, not authored per-step. Find the source (possibly in `stepContract.ts` or a content template) and change it once.

---

### C3. THRESHOLD tile collapsed context

**Current:** Threshold tiles show just a percentage: "0%", "33%".

**Target:** Add a context suffix based on what the threshold measures:
- MFA readiness threshold → "33% MFA-ready"
- Admin phishing-resistant threshold → "0% of admins phishing-resistant"
- Device compliance threshold → "0% of devices compliant"

**Where:** The threshold tile's summary text generator. The suffix comes from the step's scope or the threshold's kind.

**Affected:** Require MFA for Everyone, Phishing-Resistant MFA, Managed Device, Device Reg MFA, Register Info, and any step with a THRESHOLD tile.

---

### C4. Long tile labels — shorten

| Current label | Target label |
|---|---|
| `PEOPLE WHO NEED SPECIAL CARE` | `SPECIAL CARE` |
| `PEOPLE WHO TRAVEL OR WORK ABROAD` | `TRAVEL` |
| `PARTNER OR MSP ACCESS` | `PARTNER ACCESS` |

The expanded content still contains the full phrase. The collapsed summary uses the short label.

**Where:** The tile label generator or the package content that names the tile.

---

### C5. Dropdown/radio option labels need explanations

When a step has a dropdown or radio in the action column, each option should have a suffix explaining what it means. Format: `Option label — what this means`.

Examples already spec'd:
- Device Code: `None — no one uses device code, safe to block` / `Yes — add exceptions before blocking`
- Allowed Countries travel: `Nobody — block sign-ins from all other countries` / `Occasionally — I will add a country before each trip`

Apply the same pattern to any other step with unlabeled options (check Devices Decision dropdowns, MFA for Guests partner tier).

---

## UI polish (CSS/layout changes)

### U-P1. Header tiles — date formatting

**Where:** The Plan header tiles (Steps / Completed / Projected finish / Started).

**Current:** The Projected finish date ("Sep 21, 2026") splits awkwardly across lines inside the tile. The date is large text but the tile is narrow.

**Target:** Either widen the tile slightly, reduce the date font size, or format as "Sep 21" with "2026" on a smaller line below. The exact fix depends on the design system — the goal is the date reads cleanly without line-break mid-word.

---

### U-P2. Projected finish timeline calibration

**Where:** The scheduler that computes the projected finish date.

**Current:** The projected finish is Sep 21, 2026 (10 days from the scan date of Sep 11). For a tenant with 32 steps including complex policies with observation windows, this is unrealistically fast.

**Target:** Minimum projected finish should account for:
- Foundation steps: 1–2 days each
- Policy steps with observation windows: 7 days each (the default evidence window)
- Enforcement transitions: 2–3 days each
- A buffer for review and testing

For a small tenant (< 50 users): 2–4 weeks minimum. For a large tenant (> 200 users): 8–12 weeks. The current linear pace calculation doesn't account for parallelism limits or observation windows stacking.

This is a product/engine change, not a content change. Document it as a known issue and defer if the scheduler logic is complex.

---

### U-P3. Sign-in session persistence

**Where:** MSAL token cache configuration.

**Current:** The sign-in session expires frequently, requiring repeated clicks on "Sign in with Microsoft." The session doesn't persist across tab opens or page navigations in some cases.

**Target:** The MSAL cache should persist the token in `sessionStorage` or `localStorage` so the session survives page navigation and tab refreshes within the same browser session. The token should expire based on the Entra token lifetime (typically 1 hour for access tokens, longer for refresh tokens), not on every navigation.

This is a product bug, not a content change. Track as a separate fix.

---

## Resolved decisions (apply these)

### D1. Shared-device conditional input

The Managed Device step's Done When mentions "shared-device exception" but no question exists in the action column. **Decision: remove the shared-device mention from Done When.** The reference is orphaned. If a shared-device step is needed later it will be added as its own step.

---

### D2. Implementation channels must never be hidden

**Where:** The renderer that decides whether to show Implementation tabs (Entra, PowerShell, JSON, AI Info, Email).

**Current:** Some steps hide implementation channels due to a sensitive key filter or because the engine considers the tenant to "already deliver" the goal.

**Target:** Implementation channels render on every step, always, with zero exceptions. If a channel has content, show it. If a channel's content cannot be loaded, show the channel tab with an error message ("Content could not be loaded — report this at feedback@getiamai.com"). The engine must never suppress an implementation channel for any reason. A run or build that hides implementation content is a failure.

---

### D3. Cleanup steps get a Defer button

**Where:** The step footer renderer — the condition that decides whether "Defer this step" appears.

**Current:** Cleanup steps (like Rename Policies) have no Defer button.

**Target:** Add "Defer this step" to every cleanup step. When deferred, the step moves to a low-priority lane. It's still visible, still actionable, but not blocking progress.

---

### D4. Emergency Access tile icon — ✓ when minimum is met

**Where:** The tile icon selector for Emergency Access.

**Current:** The icon stays "!" even when minimum safety checks pass (2 accounts, correct roles, correct group) because hardening recommendations (monitoring, drill) are still open.

**Target:** When the minimum checks pass, the icon is ✓ regardless of open hardening items. Hardening is advisory. The ✓ tells the tech "you're safe, these are improvements." The "!" means "this is blocking, fix it now." Minimum-met-with-open-hardening is not blocking.

---

### D5. Auto-expand blocking tiles only — with height awareness

**Where:** The tile expand/collapse logic.

**Current:** All tiles start collapsed.

**Target:** Tiles with "!" (blocking state) auto-expand on step open. Tiles with "✓" or neutral stay collapsed. Before auto-expanding, check the tile's expanded content height. If expanding all blocking tiles on a step would produce a combined height over a reasonable threshold (e.g. 400px), expand only the first blocking tile and leave the rest collapsed with a visual indicator that more blocking items exist. This prevents a step with 4 blocking tiles from rendering as a 5-mile scroll.

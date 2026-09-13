# IAMAI Universal Fixes — Master List (v2)

**Source:** Six-archetype step review (Sep 12, 2026)
**Steps reviewed:** Emergency Access, Exclusions Group, Decide How Devices Are Managed, MFA Registration Campaign, Block Legacy Authentication, Require Phishing-Resistant MFA for Admins
**Status:** Agreed with Lachlan. Ready for Batch B implementation.
**Code map:** Paths reference the filled code map in `docs/product/actionability/RUN-CONTEXT.md` and the reference dump at `docs/product/actionability/reference/`. Read `reference/step-renderer.md` for the component tree, `reference/state-model.md` for every state word and its producer, `reference/readiness-taxonomy.md` for tile kinds, and `reference/content-schema.md` for the package format.

---

## U1 — Remove "What to do" section from every step

**File:** `src/ui/surfaces/StepSections.tsx` (or the component that renders the `<h4>What to do</h4>` section inside an opened step — find it by grepping `What to do` in JSX).

**Current:** A section with heading "What to do" appears between Readiness and Implementation on most steps. It contains a mix of: generic sentences ("Answer the question this step is waiting on."), IAMAI input controls (account pickers, group pickers, radio buttons, search boxes, Save buttons), and operational guidance (numbered how-to lists). The content comes from the package's `CONTENT.md` under the `whatToDo` field.

**Target:** The section heading and its generic prose are removed. The three kinds of content inside it go to different places:
1. **IAMAI input controls** (pickers, radios, checkboxes, search, Save) → move to the action column (U2). They are identified by being interactive form elements, not prose.
2. **Operational guidance** (numbered lists of how-to steps, e.g. the emergency access creation steps 1–5) → move into the Implementation section as Entra channel content or a new channel. They are authored prose that tells the admin what to do in Entra or in person.
3. **Generic sentences** ("Answer the question this step is waiting on.", "Clear what this step is waiting on.") → deleted. The readiness tiles and lane label already communicate this.

**Implementation:** Remove the `whatToDo` section from the step body renderer. Do NOT delete the content from package CONTENT.md files yet — that's the per-step content pass. For Batch B, the renderer stops rendering the section; the content stays in the packages and is moved to its new home during the per-step pass. If the component conditionally renders What-to-do only when content exists, the simplest change is to never render it. Add a test: no opened step on any fixture contains an `<h4>` with text "What to do".

---

## U2 — Two-column layout for opened steps

**File:** `src/ui/surfaces/StepSections.tsx` (or `ContentStep.tsx` — the component that wraps the opened step's body sections). Also `src/ui/surfaces/stepContract.ts` for the milestone column if it's a separate component.

**Current:** The opened step is a single-column layout. The NEXT MILESTONE section is a `div` or `aside` floated or positioned to the right of the Why section, taking ~290px. IAMAI input controls (pickers, radios) sit inline in the What-to-do section within the single column.

**Target:** CSS grid, two columns:
- Left column (`1fr`, min ~600px): Why → Readiness tiles → Implementation → Done when. This is the information and guidance path.
- Right column (~260px, fixed): milestone date at the top, then all IAMAI-internal input controls below it (account picker, group picker, decision dropdowns, mapping answers, mail-device radio, Save button). This is the "what you do here in IAMAI" column.

At viewport widths below ~900px (mobile / narrow), the right column stacks below the left column, between Readiness and Implementation.

**Implementation:**
1. Wrap the step body in a CSS grid container: `display: grid; grid-template-columns: 1fr 260px; gap: 2rem; align-items: start;`.
2. The left column contains the existing sections (Why, Readiness, Implementation, Done when) in their current order.
3. The right column contains a new component (e.g. `StepActionColumn`) that receives: the milestone date and sub-text, and any input controls the step defines. The input controls are currently rendered inside the What-to-do section; after U1 removes that section, the controls need a new parent — this column is it.
4. Media query: `@media (max-width: 900px) { grid-template-columns: 1fr; }` — the action column stacks below Readiness.
5. The DOM order must be: action column BEFORE Done when (so screen readers encounter it in the right place). Use CSS `order` or place it in the grid template at the right position.

**Which inputs go to the action column (by step type):**
- Emergency Access: account picker (search + chips + Save)
- Exclusions Group: group picker (search + chip + Save)
- Device Decision: decision dropdowns (phones, computers, unmanaged phones + Save)
- Campaign: people picker ("People who need special care" + chips + Save)
- Block Legacy Auth: mail-device radio (None / Yes + search + Save)
- Policy steps with no input: the action column shows only the milestone date; no empty column rendered.

**Test:** On the demo, open Emergency Access — the account picker is in the right column, the milestone date is above it, and Why/Readiness/Implementation/Done-when are in the left column. At 800px viewport width, the action column stacks below Readiness.

---

## U3 — NEXT MILESTONE sub-text: specific or nothing

**File:** The component that renders the NEXT MILESTONE section (find by grepping `NEXT MILESTONE` or `milestone` in `StepSections.tsx` or `stepContract.ts`).

**Current:** The sub-text below the date is generated from one of: the lane substatus repeated as text ("Ready · Needs decision"), a generic phrase ("Make the object this step names", "Make the decision", "Check it did what it should"), or a prerequisite name ("after: Create or Correct Exclusions Group").

**Target:** The sub-text is one of:
- A specific action phrase authored in the package META (e.g. "Create and verify two emergency accounts", "Correct the policy exclusions"). If the package provides `milestone.actionText`, use it.
- Nothing — if no authored text exists, show only the date. Do not generate filler.
- Never the lane substatus, never a prerequisite name (that's the lane label's job), never "Make the object this step names."

**Implementation:** In the milestone renderer, replace the current text-generation logic with: `package.meta.milestone?.actionText || ''`. If empty, render only the date with no sub-text div. Remove the fallback logic that generates the generic phrases. The `milestone.actionText` field is a new optional string in the package META schema — add it to the content-schema types and the validator as optional. During the per-step content pass, packages that need a specific sub-text get one authored; for Batch B, the fallback is empty, which is better than wrong.

---

## U4 — Remove the Planned work banner entirely

**File:** `src/ui/surfaces/StepSections.tsx` or wherever the "Planned work" banner renders inside the Implementation section. Find by grepping `Planned work` or `planned-work` in the component tree.

**Current:** A banner div with heading "Planned work" and text like "This is the work once the prerequisites are resolved. It is not ready to run, so it cannot be copied yet. Values still to resolve: group name, group mail nickname and group members." appears above the Implementation channel tabs when `packageStateOf` returns a state that is not executable.

**Target:** The banner is removed. The information it carried is split:
- "Cannot be copied" → the Copy button is disabled with a tooltip (U18).
- "Values still to resolve" → the tooltip text on the disabled Copy button names the unresolved values.
- The channel content below the banner is ALWAYS visible (U14) — removing the banner does not mean hiding the channels.

**Implementation:** Remove the Planned work banner component and its conditional rendering. The channel tabs and content render unconditionally (U14 handles this). Add the tooltip to the Copy button (U18 handles the tooltip implementation).

---

## U5 — DOM section order must match visual order

**File:** `src/ui/surfaces/StepSections.tsx` or the component that arranges the step body sections.

**Current:** NEXT MILESTONE is visually positioned top-right (CSS float or absolute position) but appears in the DOM after Done when. Screen readers and keyboard tab order encounter Done when before the milestone.

**Target:** After U2 (two-column grid), the action column (which contains the milestone) is a grid child that appears in the DOM before Done when. The grid places it visually on the right. DOM order: step header → Why → Readiness → action column (milestone + inputs) → Implementation → Done when. CSS grid handles the visual two-column placement.

**Implementation:** This is solved by U2's grid layout if the action column div is placed in the DOM between Readiness and Implementation. No separate fix needed beyond U2.

---

## U6 — Compact/expand readiness tile pattern

**File:** The tile component in `src/ui/surfaces/stepContract.ts` → `engineTiles` function (which produces the tile data), and the component that renders tiles (find by grepping the `readiness` or `tile` class in the step body renderer).

**Current:** Every tile renders all its content inline — label, status, icon, explanation text, Why chevron, sub-items (e.g. per-account hardening recommendations). A tile with a lot of content (like the RESILIENCE tile on Emergency Access, 276px tall) inflates the entire tile row because tiles are in a CSS grid with `align-items: stretch` or similar.

**Target:** Each tile has two states:
- **Collapsed (default):** One line: `[icon] LABEL · status-text [expand-chevron]`. Height is fixed at ~48px. Examples: `[!] EMERGENCY ACCESS · Not available [v]`, `[✓] AFFECTED PEOPLE · 3 active people [v]`, `[…] PREREQUISITE · READY · Exclusions Group [v]`.
- **Expanded (on click):** The full content renders below the collapsed line: explanation text, Why link, sub-items, per-account details. The tile grows to fit. Other tiles in the row do NOT grow with it — each tile expands independently.

**Implementation:**
1. Wrap the tile's content (everything below the first line) in a collapsible container: `<div class="tile-detail" hidden>...</div>`.
2. The first line is always visible: `<div class="tile-summary" role="button" aria-expanded="false">`. Click toggles `aria-expanded` and the `hidden` attribute on the detail div.
3. The tile grid uses `align-items: start` (not `stretch`) so tiles don't match heights.
4. Expanded state does NOT persist across step close/reopen — it resets to collapsed. This keeps the initial view clean.
5. The `engineTiles` function already returns structured data with label, status, icon, and detail content. The renderer splits this into summary (label + status + icon) and detail (everything else).

**Test:** On Emergency Access, all tiles render as one-line summaries. Clicking the RESILIENCE tile expands it to show the hardening items; the EMERGENCY ACCESS tile next to it does not grow. Closing and reopening the step resets all tiles to collapsed.

---

## U7 — Suppress transitive prerequisite tiles

**File:** `src/ui/surfaces/stepContract.ts` → `engineTiles` function, or the tile filtering logic in the step body renderer.

**Current:** All prerequisite tiles render, including transitive ones. Example: Block Legacy Auth shows both "PREREQUISITE · READY — Create or Correct Exclusions Group" (direct) and "PREREQUISITE · READY — Create or Correct Emergency Access Accounts" (transitive through the exclusions group). Phishing-Resistant MFA shows four prerequisite tiles.

**Target:** A prerequisite tile is suppressed when a more direct prerequisite tile is present that transitively implies it. Specifically: if step A depends on step B, and step B depends on step C, and both B and C appear as prerequisite tiles on step A, suppress C's tile. The admin sees only the nearest dependency, not the whole chain.

**Implementation:** The `engineTiles` function (or the renderer that maps `deriveLane().blockers` to tiles) needs a transitive-reduction pass:
1. Collect all prerequisite step IDs that would produce tiles.
2. For each pair (X, Y), check if X is reachable from Y in `dependency-data.json` (i.e., Y is an ancestor of X). If so, Y is transitive and its tile is suppressed.
3. The check uses the same graph data the lane engine already loads. A simple BFS or the pre-computed transitive closure (if available) determines reachability.
4. Non-step blockers (THRESHOLD, AFFECTED PEOPLE, DECISION, etc.) are never suppressed — this rule applies only to PREREQUISITE tiles.

**Test:** On Block Legacy Auth, only the Exclusions Group prerequisite tile shows; the Emergency Access tile is suppressed. On Phishing-Resistant MFA, verify which tiles remain after suppression (expected: Exclusions Group and Passkeys as direct; Emergency Access and Campaign suppressed as transitive).

---

## U8 — Prerequisite tiles show the prerequisite's lane (no change)

Already working correctly. `PREREQUISITE · READY`, `PREREQUISITE · UP NEXT`, `PREREQUISITE · COMPLETED` render with the correct lane. Keep as-is.


---

## U9 — Remove row subtitle text

**File:** The plan row component (find by grepping `plan-row-reason` class name). Per `reference/state-model.md`, the reason text is produced by the lane adapter or `planState.ts`.

**Current:** Many rows have a `<span class="plan-row-reason">` under the step title showing text like "until phones and computers are decided", "after: Create or Correct Exclusions Group", "until you choose the exclusions group". On the real tenant, 10 of 18 Ready rows have these subtitles. The lane label in the STATE column already carries the same information ("Ready · Decision", "Up Next · After Create or Correct Exclusions Group").

**Target:** The `plan-row-reason` span is not rendered. The lane label is the single source of the step's reason.

**Implementation:** In the plan row component, remove the rendering of `plan-row-reason`. Do not delete the data from the lane engine — other consumers (export, print) may still use the reason text. Just stop rendering it in the plan row.

**Test:** No `span.plan-row-reason` elements exist in the rendered plan on any fixture.

---

## U10 — Remove the "next" pill

**File:** The plan row component. Find by grepping `next` as a class name or text content in the row renderer.

**Current:** The first row in the Ready tab shows a teal pill with text "next" after the step title. It's rendered as a `<span>` or badge element.

**Target:** The pill is not rendered. The Ready tab's sort order already communicates which step is next — it's the first one.

**Implementation:** Remove the conditional rendering of the "next" badge in the plan row component. Find the condition (likely `isNext` or `index === 0` in the Ready group) and remove the badge element.

**Test:** No element with text "next" exists in any plan row on any fixture.

---

## U11 — Substatus "Needs decision" → "Decision"

**File:** `src/actionability/lanes.ts` or `src/ui/surfaces/planLanes.ts` — wherever the substatus string `"Needs decision"` is produced. Also `docs/design/content.json` → `pages.plan.substatus.needsDecision` if the string is stored there.

**Current:** Steps with an unresolved owner decision show substatus "Needs decision" in the badge, lane label, and bar.

**Target:** The substatus string is "Decision". The badge reads "Ready · Decision". The bar reads "Needs a decision" (this is a separate string from the substatus and can stay as-is since it's a sentence, not a label).

**Implementation:** Change the substatus literal from `"Needs decision"` to `"Decision"` in the lane engine or the content.json entry. Search for every occurrence of the string `"Needs decision"` in the codebase (including tests and snapshots) and update. The bar text "Needs a decision" is a different string and stays unchanged.

**Test:** On the demo Initial scan, the Devices step row shows "Ready · Decision" in the STATE column. The badge inside the opened step shows "Ready · Decision".

---

## U12 — Impact column never shows a person's name

**File:** The function that produces the impact text for a plan row. Per `reference/step-renderer.md`, this is likely in `stepContract.ts` or the plan row data builder. Find by grepping for the logic that formats the `who` or `impact` span content.

**Current:** On a one-person tenant or when only one person is affected, the impact column can show the person's display name (e.g. "Lachlan Robinette") instead of a count.

**Target:** Always show counts: "1 person", "3 people", "2 admins", "30 people · 3 admins". Never a display name. If the count is 0 or unknown, show "Not established" (already the existing fallback).

**Implementation:** In the impact formatter, replace any path that returns a person's `displayName` with the count format. The condition is likely `if (count === 1) return person.displayName` — change to `if (count === 1) return "1 person"`. For plural: `${count} people`.

**Test:** On a tenant with any user count, no plan row's impact column contains a display name that matches any user in the scan.

---

## U13 — "Configuration only" replaced with what the step touches

**File:** Same impact formatter as U12. The string "Configuration only" is the fallback when no affected-people count is available.

**Current:** Foundation steps (Emergency Access, Exclusions Group, Passkey Settings, Authentication Strength, Trusted Network, Allowed Countries, Service Accounts Group) and some policy steps with unresolved scope show "Configuration only".

**Target:** Foundation steps show a description of what the object serves:
- Emergency Access → "Emergency access" (or the count of accounts if selected: "2 accounts")
- Exclusions Group → "Emergency access · N policies" (where N is the count of policies in the plan that reference it)
- Passkey Settings → "Authentication methods"
- Authentication Strength → "Authentication strength"
- Trusted Network → "Network locations"
- Allowed Countries → "Named locations"
- Service Accounts Group → "Service accounts"
- Decision steps → the downstream step count if available: "2 downstream steps" (from the dependency graph's unlock count)
- Policy steps with unresolved scope → "Not established" (already the existing behavior for this case)

**Implementation:** The impact formatter needs a fallback chain:
1. If affected-people count is available → use the count format (U12).
2. If the step is a foundation object → use a per-step-type string. This could be a new field in the package META (`impact.fallbackLabel`) or a switch on the step's `workType`. A META field is cleaner because it's authored content, not code logic. Add `impact.fallbackLabel: string` as optional to the content-schema types. During the per-step pass, each foundation package gets its label authored. For Batch B, add the field to the schema and the formatter's fallback chain; leave the field empty on packages that don't have it yet, which falls back to the step title or "—".
3. If no fallback label and no count → show "—" (not "Configuration only").

**Test:** No plan row on any fixture shows "Configuration only".

---

## U14 — Implementation channels always visible in every state

**File:** `src/ui/surfaces/stepPackage.ts` → `packageStateOf` function (per `reference/step-renderer.md` §3.3–§3.7). Also the step body renderer that conditionally renders the Implementation section.

**Current:** `packageStateOf` has a rule order (rules 1–7 per the reference) that determines the "package state." When the state is `nothingToSubmit` (rule 7, no channels have projectable content) or `plannedWork` (rule 4, `!executableNow`), the Implementation section either shows the Planned work banner with no channels, or "Nothing to submit yet / IAMAI offers no artifact for this policy as it stands" with no channel tabs.

The withholding logic is:
- Rule 4: `!executableNow` (the step's condition is not healthy, or a prerequisite is incomplete) → `plannedWork` state → channels hidden behind the Planned work banner.
- Rule 7: no channel has projectable content → `nothingToSubmit` → no channels at all.

**Target:** Implementation channels are ALWAYS rendered when the package has channel content authored in CONTENT.md. The `packageStateOf` function still evaluates the state (for the Copy button and the progress bar), but it no longer controls channel visibility. Specifically:
- Remove the `plannedWork` return path's effect on channel rendering. The Planned work banner is deleted (U4). The channel tabs and content render regardless of `executableNow`.
- Remove the `nothingToSubmit` return path's effect on channel rendering. If a channel has authored content, show it. If ALL channels are empty (no authored content at all), show nothing — but this is "the package has no content" not "the projector is withholding content that exists."
- The Copy button's enabled/disabled state is separate from channel visibility (U18).

**Implementation:**
1. In `packageStateOf`: keep the function for its return value (used by the Copy button, the progress bar, and the bar text), but remove the places where the return value gates channel rendering.
2. In the step body renderer (the component that maps `packageStateOf` result to what's shown): unconditionally render the channel tabs and content when `package.channels` (or however the authored content is accessed) is non-empty. The `plannedWork` and `nothingToSubmit` states no longer suppress the tabs.
3. Remove the "Nothing to submit yet / IAMAI offers no artifact for this policy as it stands" text entirely. If no channels exist (no authored content), the Implementation section shows only the Microsoft Learn link.

**Test:** On the real tenant, Block Legacy Authentication (Enforced, with prerequisites not Complete) shows Entra, JSON, and AI Info channel tabs with their content visible. The Copy button may be disabled (U18), but the content is readable.

---

## U15 — PowerShell and JSON channels for CA policy steps only

**File:** The package CONTENT.md files for non-policy steps. This is a content change, not a renderer change.

**Current:** Emergency Access and Exclusions Group have PowerShell channels authored. Emergency Access has a multi-mode PowerShell script. Exclusions Group has a `New-MgGroup` script.

**Target:** Non-policy steps (work type: preparation, campaign, check, cleanup, resolution) render only Entra and AI Info channels. PowerShell and JSON are reserved for CA policy steps where the output is a policy body or a Graph API call.

**Implementation:** During the per-step content pass, remove the PowerShell channel content from non-policy packages. For Batch B, the renderer change is: if the step's work type (from the package META or the step index) is not `policy`, filter out PowerShell and JSON from the rendered channel tabs. The authored content stays in the package files (in case it's useful later); the renderer just doesn't show those tabs.

The work type is available in the step index (`dependency-data.json` → `workType` field, or the package META → `workType`). If the field doesn't exist in the data the renderer reads, add it to the step index build script.

**Test:** On Emergency Access and Exclusions Group, only Entra and AI Info tabs render. On Block Legacy Auth and Phishing-Resistant MFA, Entra, PowerShell, JSON, and AI Info all render.

---

## U16 — Expand viewer: sticky header

**File:** The dialog/modal component that opens when the expand button is clicked. Find by grepping `dialog` or `Expand implementation` in the component tree. Per the earlier audit, the dialog has a `dialog-content` div (class `dialog-content`) that is the scroll container (scrollHeight 2633, clientHeight 1125).

**Current:** The dialog structure is approximately:
```
<dialog>
  <div class="dialog-header"> ← contains Minimize button
    <h3>IMPLEMENTATION / Step title / Channel name</h3>
    <button>Minimize</button>
  </div>
  <div class="dialog-content"> ← scrollable (overflow: auto)
    <div class="channel-tabs"> ← Entra / PowerShell / AI Info buttons
    <div class="channel-body"> ← the code/content
  </div>
</dialog>
```
When `dialog-content` scrolls, the channel tabs scroll away (y goes negative). The Copy button doesn't exist in the expanded view at all for some steps. The Minimize button stays visible (it's in the non-scrolling header).

**Target:**
```
<dialog>
  <div class="dialog-header" style="position: sticky; top: 0; z-index: 1;"> 
    <div class="dialog-header-left">
      <span class="channel-tabs">Entra | PowerShell | AI Info</span>
    </div>
    <div class="dialog-header-right">
      <button aria-label="Copy"><icon copy/></button>
      <button aria-label="Minimize"><icon shrink/></button>
    </div>
  </div>
  <div class="dialog-content" style="overflow-y: auto; flex: 1;">
    <div class="channel-body"> ← only this scrolls
  </div>
</dialog>
```
The channel tabs, Copy button, and Minimize button are in the sticky header and never scroll away. Only the channel body content scrolls.

**Implementation:**
1. Move the channel tabs from inside `dialog-content` to inside `dialog-header`.
2. Add the Copy button to `dialog-header` (it currently only exists in the inline Implementation view, not the expanded one — or it exists but is positioned wrong).
3. Make `dialog-header` sticky: `position: sticky; top: 0; z-index: 1; background: var(--surface-2);` (needs a background so content doesn't show through when scrolling).
4. The dialog itself should be `display: flex; flex-direction: column;` so the header stays at the top and `dialog-content` takes the remaining height with `flex: 1; overflow-y: auto;`.

**Test:** Open Emergency Access → expand Implementation → switch to Entra → scroll down 500px in the content. The Entra/AI Info tabs and the Copy/Minimize buttons remain visible at the top of the dialog. The content scrolls independently beneath them.

---

## U17 — Copy and Expand buttons become icon-only

**File:** The Implementation section renderer (for the inline Copy and Expand buttons) and the dialog header (for the expanded-view Copy and Minimize buttons).

**Current:** Inline: a button with text "Expand implementation" (or an icon-only button with `aria-label="Expand implementation"`). Expanded: a button with text "Minimize". Copy button text varies ("Copy implementation" in some views).

**Target:** All four buttons are icon-only with aria-labels:
- Inline expand: `<button aria-label="Expand implementation"><i class="ti ti-arrows-maximize"></i></button>` (or the existing icon; keep whatever icon is there, just remove the text label).
- Inline copy: `<button aria-label="Copy implementation"><i class="ti ti-copy"></i></button>`.
- Dialog minimize: `<button aria-label="Minimize"><i class="ti ti-arrows-minimize"></i></button>` (or `ti-x` for close).
- Dialog copy: same as inline copy.

All four go in consistent positions: copy and expand are right-aligned above or beside the channel tabs. In the dialog, they're in the sticky header right side.

**Implementation:** In both the inline Implementation section and the dialog header, change the button content from text to icon. Keep the `aria-label` for accessibility. Use whichever Tabler icons the codebase already uses (search for existing `ti-copy` or `ti-arrows-maximize` usage). If no icons are loaded, the reference docs say Tabler outline webfont is available.

**Test:** No button in the Implementation section or the expanded dialog contains the text "Copy implementation", "Expand implementation", or "Minimize" as visible text. Each has an `aria-label` and an icon.

---

## U18 — Copy button disabled with tooltip when content can't be copied

**File:** The Copy button component in the Implementation section and the dialog. The tooltip needs the reason from `packageStateOf`.

**Current:** When `packageStateOf` returns `plannedWork` or `nothingToSubmit`, the entire Implementation content is hidden or the Planned work banner appears. There is no disabled-with-tooltip state for the Copy button.

**Target:** The Copy button is rendered on every step that has Implementation channels. Its states:
- **Enabled:** content is executable/copyable. Click copies the active channel's content.
- **Disabled with tooltip:** content is visible but not ready to copy. The button is visually muted (`opacity: 0.5` or similar) and shows a tooltip on hover explaining why. Tooltip text comes from `packageStateOf`'s reason: "Waiting on Create or Correct Exclusions Group" (if a prerequisite is the blocker), "Values not resolved: group name, members" (if unresolved bindings are the blocker), "Policy not created yet" (if the step hasn't started). The tooltip uses the existing tooltip component if one exists, or a `title` attribute as a fallback.

**Implementation:**
1. `packageStateOf` already returns a state with a reason. Expose the reason as a string alongside the state.
2. The Copy button reads this: if state is `executable` or `partial` (safe correction), enabled. If state is `plannedWork`, `nothingToSubmit`, or any non-executable state, disabled with the reason as tooltip.
3. The button element: `<button aria-label="Copy" disabled={!canCopy} title={canCopy ? '' : reason}>`.
4. CSS: `button:disabled { opacity: 0.4; cursor: not-allowed; }`.

**Test:** On Exclusions Group (Ready · Decision, values unresolved), the Copy button is visible, disabled, and hovering shows "Values not resolved: group name, group mail nickname, group members". On Emergency Access (Ready · Create, content is executable on the Entra channel), the Copy button is enabled.


---

## U19 — packageStateOf: distinguish "can't create" from "can correct safely"

**File:** `src/ui/surfaces/stepPackage.ts` → `packageStateOf` function.

**Current:** `packageStateOf` has a rule order (per `reference/step-renderer.md` §3.3). The relevant rules:
- Rule 4: `!executableNow` → return `plannedWork`. This fires when ANY prerequisite is incomplete or the condition is unhealthy, regardless of whether the step is started or the correction is safe.
- Rule 6: `partial` (the policy exists, some fields can be corrected safely) → return `partial` with the safe correction fields.

Rule 4 fires before rule 6, so a drifted enforced policy with an incomplete prerequisite gets `plannedWork` (hiding the correction) instead of `partial` (showing it).

A1a was supposed to fix this by reordering: evaluate `partial` before `!executableNow`. The fix was committed but the real tenant still shows "Nothing to submit yet" on enforced policies, which means either:
- The `partial` evaluation doesn't apply to enforced policies (it might check `lifecycle !== 'enforced'`).
- The `partial` evaluation returns false because the correction fields aren't classified as "safe" for the specific drift type (exclusion-only changes to a block policy should be safe but might not be flagged as such).
- The prerequisite hold is on `create`, not `enforce`, and the `partial` path only activates for `enforce` holds.

**Target:** An enforced policy with drift shows its correction instructions even when a prerequisite (like the exclusions group) is not yet complete, IF the correction is safe. A safe correction is one where applying it cannot lock anyone out — specifically:
- Adding a group to the exclusion list of a block policy (widens access, can't lock out).
- Adding a group to the exclusion list of a grant policy (widens who is exempt, can't lock out).
- Correcting the policy name (no access impact).
- Correcting a session control value (no block impact).

An UNSAFE correction (which should still be withheld) is:
- Changing a grant control from MFA to a stronger method (could lock out users without that method).
- Narrowing the scope (removing users from the include list or adding to exclude without the exclusions group).
- Enabling a policy that's in Report-only without evidence.

**Implementation:**
1. In `packageStateOf`, after the A1a reorder (rule 6 before rule 4): confirm that rule 6 fires for enforced policies. Check whether `partial` is only evaluated when `lifecycle === 'reportOnly'` or `lifecycle === 'missing'` — if so, add `lifecycle === 'enforced'` to the condition.
2. The `partial` evaluation needs a `correctionSafety` field on each drift dimension. The package META or the drift classifier (`tracking.ts`) should flag each drifted field as `safe` or `unsafe`. For Batch B, a simple heuristic: if the only drift is in `excludeGroups` (and the change is adding, not removing), the correction is safe. All other drift types are unsafe and the step stays in `plannedWork` until prerequisites clear.
3. When `partial` fires with safe corrections: the channels render with the correction content (the Entra instructions say "add this group to the exclusion list"). The Copy button copies the correction JSON (PATCH body with only the safe fields). Unsafe fields are not in the copy content.

**Test:** On the real tenant, Block Legacy Auth (Enforced, exclusion-group prerequisite Ready but not Complete, drift = missing exclusion): the Implementation section shows Entra instructions for adding the exclusion group, the JSON tab shows the PATCH body, and the Copy button copies it. The `require-managed-device` step (if it had unsafe drift like a grant-control change) would still show `plannedWork`.

---

## U20 — Enforced policies with no drift = Completed

**File:** `src/actionability/lanes.ts` or `src/ui/surfaces/planLanes.ts` — the lane derivation logic. Also `src/ui/surfaces/stepPackage.ts` for the `lifecycle` evaluation.

**Current:** Enforced policies on the real tenant show "Ready · Observing" with bar "Continue observation". The lane engine reads the `lifecycle` as `enforced` but the substatus is `Observing` because the engine treats all started policies that aren't Ready-to-enforce as Observing.

**Target:** An enforced policy whose tenant configuration matches the baseline's target (no drift in any field) = **Completed**. The step disappears from the Ready tab and appears under Show completed. The lane derivation algorithm (playbook §4 step 1) checks: terminal intended outcome reached → Completed. For a policy step, the terminal outcome is: enforced AND matching the baseline target.

**Implementation:** In the lane engine's step-1 check (terminal outcome), add: if `lifecycle === 'enforced'` AND the drift classifier reports zero drift dimensions → return `Completed`. The drift classifier is in `tracking.ts` or `coverage.ts` — it already computes drift; the lane engine just needs to read it. Currently the "Completed" check might only look at `lifecycle === 'enforced'` without checking drift, or it might not check enforced policies at all (treating Completed as only for foundation steps that are "in place").

**Test:** Create a fixture with an enforced policy that has zero drift. That step reads Completed. An enforced policy with drift (like the current Legacy Auth on the real tenant) reads Ready · Correct (U21), not Completed.

---

## U21 — Enforced policies with drift = Ready · Correct

**File:** Same as U20 — the lane derivation logic.

**Current:** Enforced policies with drift show "Ready · Observing". The `Observing` substatus is intended for policies in Report-only accumulating evidence before enforcement.

**Target:** An enforced policy with drift = **Ready · Correct**. The step is started (the policy exists and is enforced), the next action is `correct` (bring it to the baseline target), and the substatus reflects that. The bar reads "Needs correction". The Implementation shows the correction instructions (per U19).

**Implementation:** In the lane derivation, after the Completed check (U20): if `lifecycle === 'enforced'` AND drift exists → next action = `correct` → Ready · Correct. The `Observing` substatus is reserved for: `lifecycle === 'reportOnly'` AND evidence predicate open. This may require splitting the current Observing logic: instead of "started and not Ready-to-enforce → Observing", it becomes "started AND report-only AND evidence predicate open → Observing" plus "started AND enforced AND drift → Correct".

**Test:** On the real tenant, Block Legacy Auth shows "Ready · Correct" with chip "Enforced" and bar "Needs correction". Phishing-Resistant MFA (if it has drift) shows the same. An undrifted enforced policy shows Completed (U20). A report-only policy accumulating evidence shows Ready · Observing.

---

## U22 — Threshold tile text is state-aware

**File:** The threshold tile renderer — find by grepping `THRESHOLD` or `readiness` in `stepContract.ts` → `engineTiles`, or the tile component.

**Current:** The threshold tile always uses gate language: "admin readiness is 0% today; enforcement waits for 100%." This is correct for an unenforced policy but misleading on an enforced one (the policy is already enforced; it's not "waiting").

**Target:** The tile text has two templates:
- **Policy not enforced:** "admin readiness is {pct}% today; enforcement waits for {threshold}%." (gate language, current behavior)
- **Policy enforced:** "{pct}% of admins have a qualifying method." (informational, states the fact)

The threshold tile on an enforced policy is informational — it tells the admin the current state of method adoption. It's not a gate because enforcement already happened.

**Implementation:** In the tile data builder, check `lifecycle`:
```
if (lifecycle === 'enforced') {
  text = `${pct}% of admins have a qualifying method.`;
} else {
  text = `admin readiness is ${pct}% today; enforcement waits for ${threshold}%.`;
}
```
The `lifecycle` value is available from the step's state or from `packageStateOf`.

**Test:** On the real tenant, Phishing-Resistant MFA (Enforced, 0% readiness): the threshold tile reads "0% of admins have a qualifying method." not "enforcement waits for 100%."

---

## U23 — Policy name conformance (DEFERRED to per-step pass)

**Original proposal:** Surface when a policy functionally matches a control but its name doesn't conform to the baseline's naming convention, and let the user choose rename or acknowledge.

**Decision:** This is a feature, not a renderer fix. It requires:
- Ownership logic changes in `tracking.ts` to detect functional-match-but-name-mismatch.
- A new UI element (tile, banner, or inline prompt) on the step.
- A plan record field to store the admin's choice (rename / acknowledge).
- Integration with the existing Rename step.

This is too large for Batch B. Defer to the per-step content pass or a dedicated feature segment. Record it as a known gap: currently, IAMAI either matches by name+structure and claims ownership, or doesn't match and says the goal is unmet. The middle case (functional match, name divergence) exists on real tenants but has no user-facing path.

---

## U24 — Scan-matched objects pre-filled in pickers, never auto-closed

**File:** The step input components (account picker, group picker) and the plan record logic that reads scan matches.

**Current:** When IAMAI scans a tenant and finds objects that match the step's target (e.g. the exclusions group, emergency access accounts), the picker is empty — the admin must manually search for and select the object. The step shows "Needs decision" even though IAMAI already knows the answer.

**Target:** When the scan finds an unambiguous match (one group with the right role in existing policies, one account with permanent Global Admin and cloud-only properties):
1. **Pre-fill the picker** with the matched object. Show it as a chip in the picker with a visual indicator that it was matched by IAMAI (e.g. a subtle "matched" label or a different chip style).
2. **Keep the step open.** The substatus stays "Decision" until the admin clicks Save. The badge shows "Ready · Decision" not "Completed".
3. **After Save:** the step evaluates the confirmed object against the target. If it matches → Completed or the next substatus. If it has issues → Correct with the issues listed.

When the match is ambiguous (multiple candidate groups) or absent (no matching object): the picker is empty and the step is Create or Decision as today.

**Implementation:**
1. The scan matching logic (in `coverage.ts` or `generate.ts`) already identifies candidates. Expose the matched candidates to the step input component.
2. The picker component receives `defaultValue` or `matchedObjects` prop. On mount, if `matchedObjects` has exactly one entry and the plan record has no saved value for this input, pre-fill with the match.
3. The pre-fill does NOT write to the plan record. Only the admin's Save writes the record. This is the critical safety property: a pre-filled but unsaved match is a suggestion, not a decision.
4. The step's readiness evaluator checks the plan record, not the pre-fill. Until Save is clicked, the record is empty → the step is "Decision" → not Completed.

**Test:** On a tenant where IAMAI finds "Breakglass Exclusion" as the exclusions group candidate: the picker pre-fills with "Breakglass Exclusion" as a chip. The badge still reads "Ready · Decision". The admin clicks Save. The step re-evaluates: if the group is correct, the step moves toward Correct/Completed.

---

## U25 — Microsoft Learn link inline at end of Why

**File:** The Why section renderer in the step body component, or the package CONTENT.md where the Why text is authored.

**Current:** The Learn link appears below the Implementation section as "Microsoft Learn · Troubleshooting". Some steps also have a "Learn →" link inline in the Why text (e.g. Devices: "...domain-joined, or not managed. Learn →"). This is inconsistent across steps.

**Target:** Every step that has a Microsoft Learn reference shows it in two places:
1. **Inline at the end of the Why sentence:** "...if a change goes wrong. [Learn →](url)". This is the first appearance, in context with the reasoning.
2. **Below Implementation:** "Microsoft Learn · Troubleshooting" (or just "Microsoft Learn" if no troubleshooting link exists). This is the reference position for the admin who scrolled through everything.

**Implementation:** This is primarily a content change per step (adding the inline "Learn →" link to the Why text in each package's CONTENT.md). For Batch B, the renderer change is: ensure the Why section can render inline links (it probably already can — verify). The per-step content pass adds the link text to each package's Why field.

For Batch B specifically: add a rendering test that the Why section supports inline markdown links (if the content format is markdown) or inline `<a>` tags (if the content format is HTML). No content changes in Batch B.

---

## U26 — Source checked on every step

**File:** The Implementation section renderer (already implemented by A4) and each package's META file.

**Current:** A4 added the rendering: "Source checked <date>" appears at the bottom right of Implementation when `verifiedSources[].checkedOn` exists in the package META. 13 packages have the field; the rest don't.

**Target:** Every package that has a `verifiedSources` entry gets a `checkedOn` date. This is a per-step content change, not a renderer change. The renderer is already done.

**Implementation:** During the per-step content pass, add `checkedOn: "<date>"` to each package's `verifiedSources` entry. The date is the date the Implementation content was last verified against the current Microsoft documentation. For Batch B: no change needed. The renderer is in place.

---

## U27 — Investigate exclusion-group data mismatch

**File:** The exclusion-group step's evaluation logic, the scan's group matching, and the policy drift classifier.

**Current:** On Lachlan's real tenant, IAMAI says Block Legacy Authentication (and other enforced policies) are missing the exclusions group. But the Entra portal shows the policy already excludes "Breakglass Exclusion" with its group ID. IAMAI reports drift that doesn't exist.

**Root cause investigation steps for Claude Code:**
1. Read the plan record for the exclusion-group step (`s-prereq-exclusion-group`). Check whether a group ID is saved. If not, the step hasn't been confirmed by the admin → IAMAI doesn't know which group is "the exclusions group."
2. Read the scan's group data. Find the group that matches "Breakglass Exclusion" or "Core - Exclusions". Get its object ID.
3. Read the Block Legacy Auth policy from the scan. Get its `conditions.users.excludeGroups` array. Check whether the group ID from step 2 is in this array.
4. If yes (the group is in the policy but IAMAI doesn't see it): the issue is that IAMAI's drift classifier compares against the baseline's expected exclusion group reference, which is an unresolved source mapping (the `62d67e66` or similar reference from Baseline mappings). Until the mapping is resolved in Plan settings, the drift classifier can't confirm the match.
5. If no (the group ID genuinely doesn't match): there's a different group in the policy than what the scan found, or the scan didn't read the policy correctly.

**Fix:** If the root cause is unresolved baseline mapping (#4): this is working as designed — the admin needs to map the baseline's exclusion group reference to the tenant's "Breakglass Exclusion" group in Plan settings → Baseline mappings. The U24 pre-fill would help here (pre-fill the mapping with the matched group). If the root cause is a scan/matching bug (#5): fix the specific comparison.

**Test:** After the admin resolves the baseline mapping for the exclusion group in Plan settings, Block Legacy Auth should either show Completed (if the policy fully matches) or Ready · Correct (if other drift exists besides the exclusion group).

---

## U28 — Steps with conditional inputs require explicit user confirmation before completing

**File:** The step completion evaluator in `coverage.ts` or `generate.ts` (wherever step completion is determined), and each step's readiness evaluation.

**Current:** Some steps have conditional inputs: Block Legacy Auth has the mail-device question, Campaign has the special-care people list, other steps have partner-account questions and travel exceptions. The step can reach Completed based on scan evidence (e.g. "no SMTP traffic seen") without the admin ever addressing the question.

**Target:** A step with a conditional input cannot reach Completed or Ready-to-enforce until the admin has explicitly saved an answer (even if the answer is "None" / "No"). The scan evidence can pre-fill the answer (e.g. "No SMTP traffic since Aug 13, 2026" → pre-fill "None"), but the admin must Save to confirm.

**Implementation:**
1. Each conditional input has a plan-record field (e.g. `decisions.mailDevices`, `decisions.specialCareUsers`). If the field is `null` or `undefined` (never saved), the step has an unsatisfied completion gate.
2. The step's completion evaluator checks: all conditional inputs have a saved value (not null). If any are null, the step cannot be Completed or Ready-to-enforce — it stays at Observing or Ready · Correct with a readiness tile showing "Answer the [question name]".
3. The pre-fill (from scan evidence) shows in the input, but the plan-record field stays null until Save.
4. When the admin saves "None": the field is set to `"none"` (not null), the gate is satisfied, and the condition resolves to not-applicable per the playbook's §8.2 (the owning question step reaches Completed).

**Test:** On a fixture where Block Legacy Auth has no SMTP traffic (scan evidence suggests no mail devices) but the admin has never saved the mail-device answer: the step shows a readiness tile "Mail-sending devices: confirm" and cannot reach Ready-to-enforce. After the admin saves "None", the gate clears.

---

## Archetype-specific items

### A1 — Decision steps: dropdowns for simple option lists

**File:** Decision step input components (e.g. the device-decision radios).

**Current:** Radio buttons for each option group (Phones: 3 radios, Computers: 3 radios, Unmanaged phones: 1 checkbox).

**Target:** Dropdowns (`<select>`) when the options are single-line labels without contextual explanation. Radios when the options need multi-line explanation underneath each choice. For the device decision: Phones and Computers use dropdowns (the options are self-explanatory labels); Unmanaged phones stays a checkbox (it's a yes/no toggle with an explanation sentence).

**Implementation:** In the device-decision input component, replace the radio groups for Phones and Computers with `<select>` elements. Keep the checkbox for Unmanaged phones. This is a component-level change specific to this step's input renderer.

### A2 — Decision steps: AI Info channel (deferred)

Consider adding an AI Info channel to decision steps that explains what each option means for the specific tenant. Deferred to the per-step content pass.

### A3 — Campaign steps: human-process channel (deferred to per-step pass)

The campaign's operational walkthrough needs an Implementation channel. This is content authoring, deferred to the campaign step's per-step fix.

### A4 — Policy steps: Observing-with-drift vs Observing-clean

Solved by U20 and U21. Enforced+drift = Ready · Correct (not Observing). Report-only+evidence-open = Ready · Observing (healthy). No separate archetype fix needed beyond the universal lane changes.

### A5 — Emergency Access: per-account tiles (deferred to per-step pass)

The per-account tile structure is defined in `step-emergency-access.md`. This is a step-specific rendering change, deferred to the Emergency Access per-step fix.

### A6 — Campaign: special-care confirmation gate

Implemented by U28 for conditional inputs generally, plus the campaign step's specific per-step fix in `step-mfa-campaign.md`.

---

## V2 (parked)

**V2-1:** Drill into who is affected from the impact column. A future feature allowing the admin to click the impact count and see the list of affected people. Not in scope for Batch B or the per-step pass.

---

## Implementation order

1. **Batch B segment 1 (engine + projector):** U19, U20, U21, U22, U11, U28 — lane derivation and packageStateOf changes. These change what state each step is in, which affects everything downstream. Run first. Test with the 15 worked examples + enforced-policy fixtures.
2. **Batch B segment 2 (renderer + layout):** U1, U2, U3, U4, U5, U6, U7, U9, U10, U14, U15, U16, U17, U18, U25 — the step body, plan rows, tiles, Implementation visibility, expand viewer. Depends on segment 1 (the lane states must be correct before the renderer reads them).
3. **Batch B segment 3 (data + content schema):** U12, U13, U24, U26, U27 — impact formatting, pre-fill, source checked field, and the exclusion-group investigation. Can run in parallel with segment 2.
4. **Deferred:** U23 (name conformance feature), A2 (AI Info on decisions), A3 (campaign channel), A5 (per-account tiles). These go in the per-step pass.


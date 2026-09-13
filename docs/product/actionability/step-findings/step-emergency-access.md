# Step findings: Create or Correct Emergency Access Accounts

**Step ID:** `s-prereq-break-glass`
**Archetype:** Foundation with owner input
**Current state on Lachlan's tenant:** Ready · Create (one account exists, no accounts selected in IAMAI, second account missing)
**Package path:** `docs/implementation-content/s-prereq-break-glass/`

---

## Step-specific fixes

### S-BG-1: Per-account readiness tiles

**Current:** Three tiles — EMERGENCY ACCESS ("Not available"), CHECK ("Create a second account: one account is a single point of failure"), RESILIENCE ("Hardening open" with a full list of hardening items inline, inflating the tile to 276px tall).

**Target:** Two tiles, one per break-glass account slot. Each tile is labelled by the account's role (not "First" / "Second" — use a better term; the naming is a later content decision, but the structure is two slots). Each tile updates when an account is selected in the picker:

- **No account selected:** tile shows "Not selected" with a prompt to choose one.
- **Account selected, minimum not met:** tile shows the minimum blockers as a compact list (expand for detail). Minimum = the account exists, is cloud-only on the *.onmicrosoft.com domain, holds permanent active Global Administrator, has a passkey or hardware security key registered. These are the items that gate `emergency-access.minimum-satisfied`.
- **Account selected, minimum met, hardening open:** tile shows a green check for minimum and an amber list of hardening recommendations (expand for detail). Hardening = passphrase stored offline in two places, alerting configured, sign-in activity reviewed, passkeys on separate sources. These are the items that close `emergency-access.hardening-complete`.
- **Account selected, everything clear:** tile shows green.

The RESILIENCE tile's current content (hardening items) moves into the per-account tiles under each account's hardening section. The CHECK tile's content (create a second account) becomes the state of the second tile when no account is selected for it.

**Implementation notes for Claude Code:** The readiness tile data comes from `stepContract.ts` → `engineTiles`. The current `EMERGENCY_ACCESS`, `CHECK`, and `RESILIENCE` tile kinds need to be replaced with a per-account tile kind that reads the plan record's selected accounts and the scan's per-account evidence. The package META likely has the minimum/hardening split already (it maps to the `minimum-satisfied` and `hardening-complete` milestones in the dependency graph). The tile component needs to accept account-specific data and render the blocker/recommendation lists per account.

---

### S-BG-2: Remove PowerShell channel

**Current:** Three channels: Entra, PowerShell, AI Info. The PowerShell is a multi-mode script (`EnsureDeterministic`, `EnsureRole`, `EnsureGroupMembership`, `VerifyDeterministic`) that takes UserId, GroupId, and Mode parameters.

**Target:** Two channels: Entra, AI Info. PowerShell is removed because the actual work of this step is portal + physical (create account, set passphrase on paper, register a hardware key). PowerShell can verify after the fact, but that's a different use case and not Implementation.

**Implementation notes for Claude Code:** Remove the PowerShell channel from the package's Implementation content. This is a content change in the package META or CONTENT.md, not a renderer change. The universal rule (U15) removes PowerShell from all non-policy steps; this step is one of them. Do not delete the PowerShell script from the repo if it exists as a standalone file — just stop rendering the channel on this step.

---

### S-BG-3: Add Source checked

**Current:** No `verifiedSources[].checkedOn` in the package META.

**Target:** Add a `checkedOn` date to the package's `verifiedSources` entry. The Implementation section renders "Source checked <date>" at the bottom right. The source for emergency-access best practice is the Microsoft Learn page on managing emergency access accounts; best practice evolves (e.g. passkeys for break-glass is now recommended, wasn't a few years ago).

**Implementation notes for Claude Code:** Add `checkedOn: "2026-09-12"` (or the actual date the content was last verified) to the `verifiedSources` array in the package META. The renderer already shows this field when it exists (A4 added the rendering). If the field doesn't exist in the META schema for this package, follow the pattern from one of the 13 packages A4 already added it to.

---

### S-BG-4: Emergency Access with selected accounts and failing checks should read Ready · Correct, not Ready · Create

**Current:** On the demo (where accounts are selected and have failing minimum checks), the step reads Ready · Create with bar "Ready now". On Lachlan's tenant (no accounts selected), it correctly reads Ready · Create.

**Target:** When accounts are selected in the plan record AND the tenant has existing emergency accounts that match, the step is **started** (the object exists). Failing minimum checks make the next action `correct`, not `create`. The badge should read Ready · Correct and the bar "Needs correction".

**Implementation notes for Claude Code:** This is the adapter's started-state detection for emergency access. In `planLanes.ts` or `stepPackage.ts`, the step's started condition should check: (a) accounts are selected in the plan record (saved by the admin), AND (b) matching accounts exist in the tenant scan. When both are true, the step is started, and failing checks make the next action `correct`. This was flagged in A1b's BLOCKED.md as a deferred item. The A6 segment fixed it for the demo but the general rule may not be implemented.

---

## Universal items that apply to this step

These are implemented by Batch B (the universal segment) and do not need per-step work, but are listed here for completeness so the step's final state is fully specified.

- **U1:** Remove "What to do" section. Current content: "Choose the emergency access accounts below and save, then clear what Readiness lists." plus a numbered list of account creation steps (1–5). The numbered list is Implementation content and stays under the Entra channel. The picker moves to the action column (U2).
- **U2:** Two-column layout. The account picker (search box, chips, Save) moves to the right column under the milestone date. The left column is Why → Readiness → Implementation → Done when.
- **U3:** NEXT MILESTONE sub-text "Make the object this step names." is removed. The date (Sep 14, 2026) stays. The sub-text should say "Create and verify two emergency accounts" or nothing.
- **U4:** Planned work banner: currently shows "This is the work once the prerequisites are resolved. It is not ready to run, so it cannot be copied yet." on the real tenant. Removed entirely; the copy button is disabled with a tooltip if applicable.
- **U6:** Tiles become compact/expand. The current RESILIENCE tile with its full hardening list is the worst example of a tile inflating the row. After S-BG-1, the per-account tiles use the compact pattern: title + one-line status + expand chevron.
- **U7:** If this step shows prerequisite tiles, suppress the transitive ones when the direct one is present. Currently this step has no prerequisite tiles (it's the first step in the graph), so this is a no-op here.
- **U14:** Implementation channels always visible. Currently the Entra channel content is present and renders; this step is not affected by the "Nothing to submit" bug (it has content). But after U14, the channels stay visible even when the step is Completed.
- **U16/U17:** Expand viewer sticky header and icon-only buttons apply to this step's viewer.
- **U25:** Microsoft Learn link inline at the end of the Why sentence. Currently the Why says "Emergency access accounts are how you keep access to GetIAMAI if a change goes wrong." — add "Learn →" at the end linking to the emergency-access Learn page. The existing "Microsoft Learn · Troubleshooting" below Implementation stays.
- **U26:** Source checked rendered (after S-BG-3 adds the date).

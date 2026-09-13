# Step findings: Create or Correct Exclusions Group

**Step ID:** `s-prereq-exclusion-group`
**Archetype:** Foundation object with owner input (minimal)
**Current state on Lachlan's tenant:** Ready · Needs decision (group exists as "Core - Exclusions" / "Breakglass Exclusion", not confirmed in IAMAI picker)
**Package path:** `docs/implementation-content/s-prereq-exclusion-group/`

---

## Step-specific fixes

### S-EG-1: CHECK tile content references existing policies, should reference plan's intended policies

**Current:** The CHECK tile says "Exclude the group from Core - Grant - MFA for all users, Core - Block - Legacy authentication, Core - Block - Device code flow, Core - Grant - Admins phishing-resistant, Core - Grant - Guests MFA: open each policy's Users → Exclude → Groups." This lists policies that already exist in the tenant.

**Target:** The step's completion condition is broader than existing policies. The group needs to be confirmed so that IAMAI has its ID recorded, and every future policy the plan creates will include this group in its exclusions. The CHECK tile should:
- For policies that already exist and already exclude the group: show them as satisfied (green).
- For policies that already exist but don't exclude the group: show them as needing correction.
- For policies the plan intends to create that don't exist yet: note that these will include the group when created.
- The tile text should not tell the admin to manually add the group to existing policies if IAMAI will guide them through that on each policy's own step.

**Implementation notes for Claude Code:** The CHECK tile content is generated from the package's readiness evaluation, which compares the group's current exclusion membership against the policies in the plan. The content generator needs to distinguish between existing-policy corrections (which are those policies' own steps) and future-policy inclusions (which are handled at creation time). The tile for this step should focus on: is the group itself correct (right members, right type), not on whether each policy uses it — that's each policy step's concern.

---

### S-EG-2: Step reads "Needs decision" but should read "Correct" when the group exists

**Current:** Badge "Ready · Needs decision". The DECISION tile says "Needs decision / Answer the question this step is waiting on." The group picker is empty (no group selected). But the scan found the group (Core - Exclusions / Breakglass Exclusion) and matched it.

**Target:** Per universal rule U24, the scan-matched group should be pre-filled in the picker. The step stays open until the admin saves (explicit confirmation required). But the substatus should reflect that the object exists:
- Group exists and is matched → pre-fill the picker, substatus = "Decision" (waiting for admin confirmation).
- After admin saves → evaluate the group's state: if it has the right members and type, substatus = "Correct" (check each policy step for exclusion membership) or "Completed" if everything is clean.
- Group doesn't exist → substatus = "Create".

The current state (group exists, picker empty, "Needs decision") is technically correct under U24 (waiting for admin save), but the DECISION tile's content is wrong — it should say "IAMAI found Core - Exclusions. Confirm this is the right group." not "Answer the question this step is waiting on."

**Implementation notes for Claude Code:** The adapter or the step's binding code needs to check whether the scan found a matching group. If it did, pre-fill the picker with that group and change the DECISION tile content to name the matched group and ask for confirmation. The group picker's pre-fill comes from the scan's group matching (likely in `coverage.ts` or `generate.ts` where the exclusion group is identified). After save, the step's readiness re-evaluates against the group's actual state.

---

### S-EG-3: Remove PowerShell channel

**Current:** Three channels: Entra, PowerShell, AI Info.

**Target:** Two channels: Entra, AI Info. Creating a security group is three clicks in Entra. Same rationale as Emergency Access (U15).

**Implementation notes for Claude Code:** Remove the PowerShell channel from this package's content. Same pattern as S-BG-2.

---

### S-EG-4: Add Source checked

**Current:** No `verifiedSources[].checkedOn` in the package META.

**Target:** Add `checkedOn` date. The source is Microsoft's documentation on Conditional Access exclusion groups and emergency access.

---

### S-EG-5: Done-when text

**Current:** "The question on this step is answered and saved."

**Target:** "The exclusions group is confirmed, has the emergency access accounts as its only members, and IAMAI has recorded its ID for every policy in the plan."

---

### S-EG-6: Ready vs Up Next when paired with Emergency Access

**Current:** Shows as Up Next · After Create or Correct Emergency Access Accounts on the demo (the dependency edge `exclusion-group:start ← break-glass@minimum-satisfied` requires the full Emergency Access minimum before this step can start).

**Issue:** These two steps are described as "done together" in both steps' subtitles. The group can be created as soon as the accounts are identified (saved in IAMAI), not when all minimum checks pass. The current edge is too strict.

**Decision (deferred):** This is a graph edge change that affects the dependency model. It's not a rendering fix. Options: (a) change the prerequisite from `break-glass@minimum-satisfied` to a new milestone `break-glass@accounts-identified` representing the admin's save; (b) treat "done together" paired steps as both Ready when either is Ready, with the prerequisite shown as a tile but not gating the lane. This is parked as a product decision, not included in Batch B.

---

## Universal items that apply to this step

- **U1:** Remove "What to do" section. Content "Answer the question this step is waiting on." is redundant.
- **U2:** Group picker moves to the action column.
- **U3:** Milestone sub-text "Make the decision" removed; date stays.
- **U4:** Planned work banner ("Nothing blocks this step, but IAMAI cannot fill in every value yet, so this cannot be copied. Values still to resolve: group name, group mail nickname and group members.") removed. Copy button disabled with tooltip "Confirm the exclusions group first" until the admin saves.
- **U6:** DECISION tile uses compact/expand. Compact: "Decision · Confirm the exclusions group". Expand: explanation of what the group is and why IAMAI needs confirmation.
- **U9:** Row subtitle "until you choose the exclusions group" removed.
- **U11:** Substatus "Needs decision" → "Decision".
- **U13:** Impact "Configuration only" → describe what the group touches: "2 accounts · N policies" where N is the count of policies in the plan that will reference it.
- **U14:** Implementation channels always visible. The Entra content already exists and renders under the Planned work banner; after U4 removes the banner, it's directly visible.
- **U25:** Learn link inline at end of Why sentence.
- **U26:** Source checked rendered after S-EG-4.

# Step findings: Block Legacy Authentication

**Step ID:** `s-goal-block-legacy-auth`
**Archetype:** CA policy (enforced, with drift and a conditional input)
**Current state on Lachlan's tenant:** Ready · Observing, Enforced (IAMAI reports drift — exclusions group missing — but the tenant actually has "Breakglass Exclusion" in the policy's exclusion list)
**Package path:** `docs/implementation-content/s-goal-block-legacy-auth/`

---

## Step-specific fixes

### S-LA-1: Data accuracy — IAMAI says exclusions group is missing, but it's present

**Current:** IAMAI reports the policy doesn't exclude the emergency-access exclusions group. The PREREQUISITE · READY tile says "Create or Correct Exclusions Group — Finish Create or Correct Exclusions Group first." The What-to-do text says "Create or Correct Exclusions Group first: this policy names an object GetIAMAI does not have yet."

**Reality:** The Entra portal shows the policy (Core - Block - Legacy Authentication) already excludes the group "Breakglass Exclusion" with 1 group. The policy is Enforced and correctly configured.

**Root cause to investigate:** One of:
1. The plan record's exclusion-group step has no saved confirmation (the admin hasn't clicked Save in IAMAI's picker), so IAMAI doesn't know which group is "the exclusions group" — it hasn't matched the tenant's "Breakglass Exclusion" / "Core - Exclusions" to the plan's concept of an exclusions group.
2. The baseline mapping for the source reference that represents the exclusions group hasn't been resolved in Plan settings → Baseline mappings, so the policy's evaluation can't match the exclusion to a known group.
3. The group object ID IAMAI found during scan doesn't match the group object ID in the policy's `excludeGroups` array — a data mismatch.

**Target:** After investigation, if the root cause is #1 or #2 (admin confirmation needed): the step should pre-fill the matched group per U24 and show the admin what it found, but not auto-close. If the root cause is #3 (ID mismatch): fix the matching logic. Either way, once the exclusions group is confirmed and the policy's exclusions match, this step should read **Completed** (the policy is enforced and correct) or **Ready · Correct** if other drift exists.

**Implementation notes for Claude Code:** This investigation is U27 from the universal list. Run: `Read the plan record's exclusion-group step, the scan's group data, the policy's excludeGroups array for Block Legacy Authentication, and explain why the step reports the exclusion as missing.` The fix depends on the root cause. Do not guess; read the data.

---

### S-LA-2: Mail-device conditional input positioning

**Current:** Under "What to do": "No printer, scanner or application sent mail by SMTP since Aug 13, 2026. Is there one? A device that sends by SMTP AUTH stops when this is enforced." with a radio (None / Yes: add [search]) and Save.

**Target:** This input moves to the action column (right column under milestone). It's the `mail-devices-incompatible-path` condition from the dependency graph. The admin's answer determines whether the step has an enforcement blocker (devices exist that would break) or not (no devices, enforcement is safe).

The step must not auto-complete without this answer. If the admin hasn't answered and the scan shows no SMTP traffic, the pre-fill should be "None" with the evidence ("No SMTP traffic since Aug 13, 2026"), but the admin must still Save to confirm. If the admin says "Yes: add" and names devices, those devices are added to the service-accounts group as an exception, and enforcement is held until they're remediated.

**Implementation notes for Claude Code:** Move the mail-device radio + search + Save into the action column component. The completion gate: the mail-device question must be answered (saved) before the step can reach Ready to enforce or Completed. This implements U28 (explicit user confirmation for conditional inputs) for this specific step.

---

### S-LA-3: Done-when doesn't mention correction or full target match

**Current:** "The policy is enforced in GetIAMAI."

**Target:** "The policy is enforced and matches the baseline's target: blocks legacy authentication for all users, excludes the emergency access group, and any mail-sending devices are accounted for."

---

### S-LA-4: Add Source checked

**Current:** No source checked visible.

**Target:** Add `checkedOn` date. The source is Microsoft's documentation on blocking legacy authentication and the SMTP AUTH retirement timeline.

---

### S-LA-5: Policy name conformance

**Current:** The tenant's policy is named "Core - Block - Legacy Authentication". The baseline may expect a different naming convention. IAMAI doesn't surface whether the name matches or not.

**Target:** Per U23, if the policy's name doesn't match the baseline's naming convention but the policy functionally meets the control, IAMAI should surface: "This policy meets the control. Its name is [tenant name]; the baseline calls it [baseline name]." with an option to rename or acknowledge. If the names already match, no message. This applies to every policy step.

---

## Universal items that apply to this step

- **U1:** Remove "What to do" section. Content splits: mail-device input → action column (S-LA-2), "Create or Correct Exclusions Group first" text → removed (this is the prerequisite tile's job, and it's wrong per S-LA-1), the explanation about SMTP → moved to Implementation or the mail-device input's contextual text.
- **U2:** Mail-device input moves to the action column.
- **U4:** Planned work banner: currently not shown (the step shows "Nothing to submit yet" under Implementation instead, which is worse). After U4 + U14, the banner is gone and Implementation channels are always visible.
- **U6:** Tiles compact/expand. The AFFECTED PEOPLE tile ("Not established") and prerequisite tiles are all expanded.
- **U7:** Suppress the transitive Emergency Access prerequisite tile. Only the Exclusions Group tile should show as a direct prerequisite.
- **U9:** Row subtitle "after: Create or Correct Emergency Access Accounts" removed.
- **U14:** Implementation channels always visible. This is the critical fix for this step — currently shows "Nothing to submit yet / IAMAI offers no artifact for this policy as it stands." After U14, the Entra channel shows correction instructions (open the policy, verify exclusions, check conditions), the JSON channel shows the target policy body, the AI Info channel shows the correction context. These channels exist in the package content but are being withheld by the projector.
- **U19:** The projector must show the correction instructions even though the exclusions-group prerequisite is Ready but not Complete. Adding an exclusion to a block policy is a safe correction (it only widens who gets through). The projector evaluates correction safety before prerequisite holds.
- **U20/U21:** After S-LA-1 investigation, if the policy is actually correct: Completed. If it has real drift: Ready · Correct.
- **U22:** No threshold tile on this step. N/A.
- **U23:** Name conformance (S-LA-5).
- **U25:** Learn link inline at end of Why. Currently Why says "Legacy protocols skip MFA; this also moves everyone off the built-in phone mail apps (ActiveSync), even with modern sign-in." — add Learn link.
- **U26:** Source checked rendered after S-LA-4.
- **U28:** Mail-device question requires explicit confirmation (S-LA-2).

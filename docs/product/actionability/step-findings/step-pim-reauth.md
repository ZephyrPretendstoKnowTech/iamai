# Step findings: Require MFA at Every Role Activation

**Step ID:** `s-goal-pim-activation-reauth`
**Archetype:** CA + PIM composite (Up Next)
**Current state:** Up Next · After Create the Baseline's Authentication Strength
**Channels:** Entra, PowerShell, JSON, AI Info

## Step-specific fixes

### S-PM-1: Planned work banner present — remove
Per U4.

### S-PM-2: Row subtitle redundancy
Subtitle "after: Create or Correct Exclusions Group" but the lane label says "After Create the Baseline's Authentication Strength." The subtitle and the lane DISAGREE — the lane names the direct prerequisite (auth strength), the subtitle names a different prerequisite (exclusions group). This is a data/rendering bug: the row subtitle is reading from a different source than the lane. After U9 removes the subtitle, the disagreement is invisible, but it suggests the underlying reason text is wrong.

### S-PM-3: Source checked present ✓
"Source checked Sep 10, 2026". No change.

### S-PM-4: This step has unique PIM requirements
The playbook notes: the authentication-context CA policy must be enabled (not Report-only) before the context is assigned in PIM role settings. Report-only is not meaningful here. The step's observation predicate should be pilot-role validation, not sign-in evidence. Verify the step's readiness and observation logic reflects this. Per-step content item.

### S-PM-5: Milestone
"Up Next · After Create the Baseline's Authentication Strength / Resolve prerequisites." Generic. Remove per U3.

### S-PM-6: Done-when generic
"The policy is enforced in GetIAMAI." Needs to include: authentication context created, assigned to the CA policy, CA policy enabled (not Report-only), PIM role settings updated to require the context.

## Universal items: U4, U7, U9, U25, U26 (already has source checked).

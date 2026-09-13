# Step findings: Challenge High-Risk Sign-ins

**Step ID:** `s-goal-sign-in-risk`
**Archetype:** CA policy (Up Next, Identity Protection)
**Current state:** Up Next · After Create the Baseline's Authentication Strength
**Channels:** None (zero — "Nothing to submit yet")

## Step-specific fixes

### S-RH-1: Content authoring gap — zero channels
**Current:** "Nothing to submit yet / IAMAI offers no artifact for this policy as it stands." The Medium-Risk counterpart (`s-goal-sign-in-risk-medium`) has four channels: Entra, PowerShell, JSON, AI Info.
**Decision (confirmed by Lachlan):** This is a content gap, not intentional. Both sign-in risk steps should have the same channels.
**Target:** Author Entra, PowerShell, JSON, and AI Info channel content for this package, mirroring the Medium-Risk package but with high-risk threshold.
**Implementation for Claude Code:** Copy the channel content structure from `s-goal-sign-in-risk-medium`'s CONTENT.md to `s-goal-sign-in-risk`'s CONTENT.md. Adjust the risk level from `medium` to `high` in the policy configuration values (the `riskLevels` condition array, the display name, any threshold references). Verify the JSON body targets the correct risk level. If the package CONTENT.md doesn't exist, create it from the medium-risk template.

### S-RH-2: Row subtitle disagrees with lane label
**Current:** Row subtitle says "after: Create or Correct Exclusions Group" but the lane label says "Up Next · After Create the Baseline's Authentication Strength." These are different prerequisites — the subtitle is wrong.
**Root cause:** The subtitle reads from a different source (legacy reason text) than the lane (the engine's nearest prerequisite). After U9 removes the subtitle, the disagreement is invisible. But the underlying reason text is wrong — it should be fixed in the source too, not just hidden.
**Target:** Remove subtitle (U9). Also fix the underlying reason text in the lane adapter or wherever it's produced.

### S-RH-3: No Learn link in Why
**Current Why:** "Microsoft sees leaked-credential lists and impossible travel before you do; this lets that signal act."
**Target:** Add inline Learn link to the Identity Protection sign-in risk documentation.

### S-RH-4: Source checked present ✓
"Source checked Sep 10, 2026." No change.

### S-RH-5: Done-when generic
**Current:** "The policy is enforced in GetIAMAI."
**Target:** "The policy is enforced at the high-risk threshold, with the baseline's authentication strength as the grant control and the exclusions group applied."

### S-RH-6: Suppress transitive prerequisite tiles
Per U7. Check which of the 4 prerequisite tiles are direct and which are transitive.

## Universal items
U7, U9, U14 (critical — currently zero channels; S-RH-1 adds content), U25, U26 (already present).

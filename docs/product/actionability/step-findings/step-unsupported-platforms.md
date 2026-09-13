# Step findings: Block Unsupported Device Platforms

**Step ID:** `s-goal-block-unsupported-platforms`
**Archetype:** CA policy (On Hold — unmapped group)
**Current state:** On Hold · Baseline references an unmapped group
**Channels:** Entra, PowerShell, JSON, AI Info, Email (5 channels — visible despite On Hold)

## Step-specific fixes

### S-UP-1: Planned work banner present — remove
**Current:** The Implementation section shows a "Planned work" banner above the channel tabs: "This is the work once the prerequisites are resolved. It is not ready to run, so it cannot be copied." The channels are visible below the banner.
**Target:** Remove the banner per U4. The channels remain visible (they already are on this step — good). The Copy button is disabled with tooltip "Resolve baseline mapping first" per U18.

### S-UP-2: Has Email channel — keep
The Email channel contains a user notification template about device platform requirements. This is appropriate for a people-facing policy. No change.

### S-UP-3: BASELINE MAPPING tile with "Open Baseline mappings" button — good
This is the correct On Hold presentation: the tile names the unmapped reference, explains what it is, and links to Plan settings → Baseline mappings. Keep this pattern.

### S-UP-4: No Source checked
Add `checkedOn` to the package META `verifiedSources` array. Set the date to the date the Implementation content was last verified. Format: `"YYYY-MM-DD"`. The renderer already shows this field.

### S-UP-5: Done-when needs to be specific
**Current:** Verify what the Done-when text says. If it's the generic "The policy is enforced in GetIAMAI," replace with: "The policy is enforced, blocking sign-ins from unsupported device platforms, with the exclusions group applied and the baseline mapping resolved."
**Implementation for Claude Code:** Read the package CONTENT.md Done-when field. If it matches the generic text, replace it with the specific text above.

### S-UP-6: No Learn link in Why
**Current:** No "Learn →" at the end of the Why sentence.
**Target:** Add ` Learn →` as an inline link at the end of the Why paragraph, linking to the Microsoft Learn page on Conditional Access device platform conditions. The URL is authored during the per-step content pass.

### S-UP-7: Suppress transitive prerequisite tiles
Per U7. If both Exclusions Group and Emergency Access tiles are present, suppress Emergency Access.

### S-UP-8: Row subtitle
"Baseline references an unmapped group" — remove per U9. The lane label already says this.

## Universal items
U4, U7, U9, U18, U25, U26.

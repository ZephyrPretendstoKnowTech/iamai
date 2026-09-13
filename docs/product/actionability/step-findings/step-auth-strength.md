# Step findings: Create the Baseline's Authentication Strength

**Step ID:** `s-prereq-auth-strength`
**Archetype:** Foundation object with owner input (strength picker)
**Current state:** Ready · Create
**Channels:** Entra, PowerShell, AI Info

## Step-specific fixes

### S-AS-1: Remove PowerShell channel
Per U15. Creating an authentication strength is a portal wizard.

### S-AS-2: What to do section present — remove
Contains: "Make the object this step names." and a strength picker with Save. The picker moves to the action column (U2); the generic sentence is deleted (U1).

### S-AS-3: No Learn link in Why
Why: "The baseline's admin, guest, risk and role-activation policies all point at one custom authentication strength; the policy cannot be created until the strength exists." Add inline Learn link to the authentication strengths documentation.

### S-AS-4: Milestone sub-text filler
"Make the object this step names." Remove per U3.

### S-AS-5: Impact "Configuration only"
Replace per U13 with "Authentication strength" or "N downstream policies" (count from the dependency graph).

### S-AS-6: No Source checked
Add `checkedOn` to the package META `verifiedSources` array. Set the date to the date the Implementation content was last verified against current Microsoft documentation. If authoring new content, use the current date. Format: `"YYYY-MM-DD"`. The renderer (added in A4) already shows this field when present.

### S-AS-7: Done-when good
"A strength named Modern MFA + TAP exists with exactly those five combinations, or an existing strength with the same combinations is selected above." Specific and verifiable. Keep.

## Universal items: U1 (remove What-to-do), U2 (strength picker → action column), U3, U13, U15, U24 (if a matching strength exists, pre-fill the picker), U25, U26.

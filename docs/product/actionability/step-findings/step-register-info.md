# Step findings: Protect Sign-in Method Registration

**Step ID:** `s-goal-register-info-protected`
**Archetype:** CA user-action policy (Up Next)
**Current state:** Up Next · After Create the Baseline's Authentication Strength
**Channels:** Entra, PowerShell, JSON, AI Info, Email (5 channels)

## Step-specific fixes

### S-RI-1: Planned work banner present — remove
Per U4.

### S-RI-2: Has 5 channels including Email
This is one of the few steps with an Email channel. The Email channel presumably contains a notification template for users about registration changes. Verify the Email content is appropriate and that the channel renders correctly. Keep the Email channel — this is a people-facing step.

### S-RI-3: THRESHOLD tile present
Shows MFA readiness threshold (13% or similar). Per U22, the threshold text should be state-aware when this policy is eventually enforced.

### S-RI-4: Row subtitle
"after: Create or Correct Exclusions Group" but lane says "After Create the Baseline's Authentication Strength." Same disagreement. Remove per U9.

### S-RI-5: No Source checked
Add `checkedOn` to the package META `verifiedSources` array. Set the date to the date the Implementation content was last verified against current Microsoft documentation. If authoring new content, use the current date. Format: `"YYYY-MM-DD"`. The renderer (added in A4) already shows this field when present.

### S-RI-6: 13 tiles — very dense
This step has 13 tile elements (some are sub-elements of larger tiles). After U6 (compact/expand), this is the step that benefits most from collapsed tiles. Verify the compact pattern doesn't overflow or wrap badly with this many tiles.

### S-RI-7: Known source conflict
Per the playbook, this step has a `sourceConflict` — the package authoring needs correction against Microsoft's current pattern (Register security information, any location excluding trusted, MFA/strength grant). This is an existing known issue, not a new finding. It should be On Hold for the source conflict, not just for the unmapped group. Verify the lane engine reads both blockers.

### S-RI-8: User-action scope and Report-only
Per playbook V9, Microsoft doesn't evaluate user-action policies in Report-only. The observation predicate for this step should be pilot-scope + human validation, not sign-in evidence. Verify the step's observation logic.

### S-RI-9: Milestone
"Up Next · After Create the Baseline's Authentication Strength / Resolve prerequisites." Generic. Remove per U3.

## Universal items: U4, U6 (critical — 13 tiles), U7, U9, U25, U26.

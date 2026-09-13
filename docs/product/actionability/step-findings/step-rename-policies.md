# Step findings: Rename Policies Off the Naming Convention

**Step ID:** `cleanup-naming`
**Archetype:** Cleanup / operational
**Current state:** Ready · Create
**Channels:** None (zero)

## Step-specific fixes

### S-RN-1: Minimal anatomy — no Readiness, no Implementation
This step has only: Why, What to do (with a single rename instruction and a Done button), Done when. No Readiness section, no Implementation section, no tiles, no milestone column. It opens as a lightweight popup-like view with a Close button.

### S-RN-2: "What to do" present — but this step IS an action list
Unlike other steps where What-to-do is redundant, this step's What-to-do IS the whole step: "Rename SG - Entra - Users - User Risk Policy → Core - Entra - Users User Risk Policy." For cleanup steps, the action list is the Implementation. After U1 removes the section heading, the rename instructions should move to an Entra Implementation channel (opening the policy in Entra → renaming it).

### S-RN-3: No Learn link in Why
Why: "One convention means the next person can read the policy list without opening each policy. Learn →" — actually, "Learn →" IS present. No change needed.

### S-RN-4: No Source checked
This is a cleanup step, not a baseline-sourced step. Source checked may not apply. Skip unless the naming convention itself comes from a documented source.

### S-RN-5: Impact "Configuration only"
Replace per U13 with the count: "1 policy to rename" or just "Policy names".

### S-RN-6: Done button
The step has a "Done" button with a "Done on" field. This is a manual-completion pattern — the admin clicks Done to mark the step as finished. This is different from the scan-verified completion pattern on other steps. Keep this pattern for cleanup steps; it's appropriate. But verify: does clicking Done write to the plan record and does the step then show as Completed?

## Universal items: U1 (move rename list to Implementation), U13, U25 (already present).

# Step findings: Review Baseline Policies IAMAI Did Not Assess

**Step ID:** `cleanup-notAssessed`
**Archetype:** Cleanup / review (multi-item)
**Current state:** Ready · Create
**Channels:** None (zero)

## Step-specific fixes

### S-RB-1: Minimal anatomy — no Readiness, no Implementation channels
This step has only Why, What to do (with a list of 7 policies and per-policy Save buttons), Done when, and a Done button. No Readiness section, no Implementation channels, no tiles, no milestone column. It opens as a lightweight view with a Close button.

### S-RB-2: Per-policy Save buttons — good pattern, keep
Each of the 7 policies has its own "Does not apply here" checkbox and "Save" button. This is the conditional input pattern (U28) — each policy needs explicit confirmation. Keep.

### S-RB-3: What to do section present — special case for this step
**Current:** What to do contains the list of 7 unassessed policies, each with its own Save button.
**Decision:** This step is an exception to the U2 action-column rule. 7 policy entries with individual Save buttons will not fit in a 260px action column. The inputs stay in the main column, but under an Implementation heading instead of "What to do." The section heading changes from "What to do" to "Implementation" (or the content moves under a single Entra channel). The layout is still two-column (milestone in the right column), but the inputs are in the left column under Implementation.
**Implementation for Claude Code:** When the step type is `cleanup` and the input count exceeds a threshold (e.g. > 3 inputs), render the inputs in the main column under Implementation instead of the action column. The threshold can be hardcoded for now; the only step that hits it is this one.

### S-RB-4: Learn link present in Why ✓
"Learn →" is inline. No change.

### S-RB-5: No Source checked — skip
This is a review step about unassessed policies. Source checked doesn't apply because the "source" is the tenant's own policies, not a documentation reference.

### S-RB-6: Impact "Configuration only"
**Current:** Shows "Configuration only."
**Target:** Replace with "7 unassessed policies" per U13.

### S-RB-7: Completion gate — all 7 must be addressed
**Current:** The step has a "Done" button for overall completion. Each policy has its own Save.
**Target:** The admin cannot click Done until all 7 policies have been saved (each either created or marked "Does not apply here"). Per U28, every conditional input requires explicit confirmation before the step can complete. The Done button is disabled with tooltip "N policies not reviewed" until all 7 are saved.
**Implementation for Claude Code:** The Done button's disabled state reads the count of unsaved policies. If any policy's plan-record field is null, the button is disabled. The tooltip text is dynamic: "3 policies not reviewed" (count of nulls).

## Universal items
U1 (heading change, not removal — see S-RB-3), U13, U28.

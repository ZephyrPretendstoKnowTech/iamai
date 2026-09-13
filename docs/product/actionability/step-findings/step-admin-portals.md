# Step findings: Block the Admin Portals for Non-Admins

**Step ID:** `s-goal-admin-portals-protected`
**Archetype:** CA policy (On Hold — baseline conflict)
**Current state:** On Hold · Baseline conflict
**Channels:** None (zero)

## Step-specific fixes

### S-AP-1: Baseline conflict behavior is correct — keep
The step is On Hold with "the baseline defines this policy two ways." The heading "Do not deploy this policy from the current baseline" is appropriate. The BASELINE DEFINITION tile shows "Conflict unresolved" with a Why explaining the two interpretations. This is working as designed.

### S-AP-2: Implementation stays empty with an explicit message
**Decision (confirmed by Lachlan):** A baseline-conflict step does NOT show Implementation content for either interpretation. Showing one could lead the admin to deploy something the baseline author didn't intend. Instead, the Implementation section renders a single message: "Not enough information to provide implementation guidance. The baseline defines this policy two ways; resolve the conflict before implementation is available." This replaces the current "Nothing to submit yet / IAMAI offers no artifact for this policy as it stands" which is generic. The new message names the specific reason.

**Implementation for Claude Code:** In the step body renderer, when `packageStateOf` returns a `sourceConflict` or `baselineSafetyConflict` state, render the Implementation section with this specific message instead of the generic "Nothing to submit yet." The message is a content string, not a code path — add it to `content.json` under a new key like `pages.plan.implementation.baselineConflict`. No channel tabs render. The Copy button is hidden (not disabled — there's nothing to copy).

### S-AP-3: No Learn link in Why
**Current:** "A standard account has no business in an admin portal; blocking it there removes a whole class of accidental and stolen-password changes."
**Target:** Add inline Learn link to the Microsoft Learn page on Conditional Access and admin portals at the end of the Why sentence.

### S-AP-4: No Source checked
Add `checkedOn` date to the package META. The source is the Microsoft documentation on admin-portal protection.

### S-AP-5: Suppress transitive prerequisite tile
Per U7, if the Exclusions Group tile is present, suppress the Emergency Access tile.

### S-AP-6: Done-when is correct — keep
"A reviewed baseline version settles which of its two definitions of this policy is meant." Names the actual blocker. No change.

## Universal items
U7 (suppress transitive tiles), U9 (remove row subtitle), U25 (Learn link in Why), U26 (Source checked).
The U14 rule (always show channels) does NOT apply here — this step is an explicit exception where Implementation is intentionally empty with a reason message (S-AP-2).

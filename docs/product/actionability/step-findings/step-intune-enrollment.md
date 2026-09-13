# Step findings: Require a Fresh Sign-in for Intune Enrollment

**Step ID:** `s-goal-intune-enrollment-reauth`
**Archetype:** CA policy (Up Next)
**Current state:** Up Next · After Decide How Devices Are Managed
**Channels:** Entra, PowerShell, JSON, AI Info

## Step-specific fixes

### S-IE-1: Planned work banner present — remove
Per U4.

### S-IE-2: Row subtitle
"after: Create or Correct Exclusions Group" but lane says "After Decide How Devices Are Managed." Another subtitle/lane disagreement (same as S-PM-2, S-RH-2). Remove per U9.

### S-IE-3: Source checked present ✓
"Source checked Sep 10, 2026". No change.

### S-IE-4: Done-when
Verify it's specific to this step's requirements (session reauthentication, not MFA grant).

### S-IE-5: This step was the Ready · Observing example on the Follow-up demo
On the demo Follow-up scan, this step shows as Ready · Observing with Report-only chip, with observation evidence ("in report-only since Sep 10, 0 failing, 18 of 30 seen"). Good. Verify this works on a real tenant too when the policy is in Report-only.

### S-IE-6: 4 prerequisite tiles
Check for transitive suppression (U7).

## Universal items: U4, U7, U9, U25, U26.

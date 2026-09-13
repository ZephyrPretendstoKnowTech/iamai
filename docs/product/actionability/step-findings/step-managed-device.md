# Step findings: Require a Managed Device Outside the Office

**Step ID:** `s-goal-require-managed-device`
**Archetype:** CA + Intune composite (On Hold — unmapped group)
**Current state:** On Hold · Baseline references an unmapped group
**Channels:** Entra, PowerShell, JSON, AI Info, Email (5 channels)

## Step-specific fixes

### S-MD-1: Planned work banner present — remove
**Current:** "Planned work" banner above the channel tabs.
**Target:** Remove per U4. Channels remain visible. Copy disabled with tooltip per U18.

### S-MD-2: THRESHOLD tile — device compliance readiness
Shows a readiness threshold for compliant device coverage. Per U22, the text must be state-aware. Currently the step is On Hold so the tile is informational.

### S-MD-3: Conditional dependency on shared devices
**Current:** Per the playbook, the `shared-devices-exist` condition gates enforcement. If the tenant has shared devices (kiosks, conference rooms), they need their own policy before this one blocks them.
**Target:** Per U28, the shared-devices question must have an explicit admin answer before the step can reach Ready-to-enforce. If no shared devices exist, the admin saves "None" and the gate clears. If shared devices exist, the "Give Shared Devices Their Own Policy" step must be completed first.
**Implementation for Claude Code:** The condition `shared-devices-exist` is already in the dependency graph. Verify it produces a readiness tile when the step reaches Ready, and that the plan record field `decisions.sharedDevices` must be non-null for the completion gate to clear.

### S-MD-4: Intune compliance dependency
**Current:** This step requires Intune compliance policies to exist and devices to be reporting compliant. If the tenant has no Intune license or no compliance policies, the step should show a `license/platform` blocker.
**Target:** Verify the readiness tiles surface the Intune dependency. If Intune is licensed but no compliance policies exist, show a readiness tile: "No compliance policies configured — devices cannot report compliant." If Intune is not licensed, show the license blocker (which should already work via the `license/platform` edge).
**Implementation for Claude Code:** Check whether the step's readiness evaluation reads Intune compliance policy existence from the scan. If it does, verify the tile renders. If it doesn't, this is a per-step evaluation addition: read the scan's Intune data and produce a readiness tile.

### S-MD-5: No Source checked
Add `checkedOn` to the package META `verifiedSources` array. Format: `"YYYY-MM-DD"`.

### S-MD-6: Has Email channel — keep
User notification about device requirements. Appropriate.

### S-MD-7: No Learn link in Why
Add inline Learn link.

### S-MD-8: Row subtitle — remove
Per U9.

### S-MD-9: Done-when needs to be specific
Replace generic text with: "The policy is enforced, requiring a managed (compliant or domain-joined) device outside the trusted network, with the exclusions group and shared-device exception applied."

## Universal items
U4, U7, U9, U18, U22, U25, U26, U28.

# Step findings: Reset Passwords for Medium-Risk Users

**Step ID:** `s-goal-user-risk-medium`
**Archetype:** CA policy (On Hold — unmapped group)
**Current state:** On Hold · Baseline references an unmapped group
**Channels:** Entra, PowerShell, JSON, AI Info (4 channels)

## Step-specific fixes

### S-UM-1: Planned work banner present — remove
Per U4. The On Hold lane already communicates the state. The Planned work banner above the channels is redundant.

### S-UM-2: Source checked present ✓
"Source checked Sep 10, 2026." No change.

### S-UM-3: Hybrid user concern — same as High-Risk Users
Per the playbook, the remediation path (password reset/change) must work for hybrid users. If the tenant has hybrid users and password writeback isn't configured, this should appear as a readiness tile. Same as S-UR-5.

### S-UM-4: Done-when generic
**Current:** "The policy is enforced in GetIAMAI."
**Target:** "The policy is enforced at the medium-risk threshold, with password change as the remediation action, and the exclusions group applied."

### S-UM-5: Suppress transitive tiles
Per U7. Check which tiles are direct vs transitive.

## Universal items
U4, U7, U9, U25 (Learn link in Why), U26 (already present).

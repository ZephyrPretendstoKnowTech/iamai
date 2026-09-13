# Step findings: Challenge Medium-Risk Sign-ins

**Step ID:** `s-goal-sign-in-risk-medium`
**Archetype:** CA policy (Up Next, Identity Protection)
**Current state:** Up Next · After Create or Correct Exclusions Group
**Channels:** Entra, PowerShell, JSON, AI Info

## Step-specific fixes

### S-RM-1: Planned work banner present — remove
Per U4.

### S-RM-2: Row subtitle redundancy
Subtitle "after: Create or Correct Exclusions Group" duplicates the lane label. Remove per U9.

### S-RM-3: No Learn link in Why
Why: "Medium risk is where most real attacks land: a new country, a new device, a password that appears on a list." Good sentence. Add inline Learn link to Identity Protection documentation.

### S-RM-4: Source checked present ✓
"Source checked Sep 10, 2026". No change.

### S-RM-5: Done-when generic
"The policy is enforced in GetIAMAI." Same fix needed: include matching the baseline target.

### S-RM-6: Milestone
"Up Next · After Create or Correct Exclusions Group / Resolve prerequisites." "Resolve prerequisites" is generic. Remove sub-text or make it specific per U3.

### S-RM-7: Impact "Not established"
Scope unresolved due to unmapped group. Correct behavior while mapping is unresolved.

### S-RM-8: Tile count — 5 tiles
AFFECTED PEOPLE (3 tiles counting variants) and PREREQUISITE · READY (2 tiles). Check whether the prerequisite tiles are direct or include transitive ones (U7).

## Universal items: U4, U7, U9, U25, U26 (already has source checked).

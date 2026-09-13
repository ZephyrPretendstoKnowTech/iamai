# Step findings: Limit How Long Sessions Last

**Step ID:** `s-goal-all-users-no-persistence` (runtime id differs from playbook `s-goal-session-lifetime`)
**Archetype:** CA policy pair (On Hold — unmapped group)
**Current state:** On Hold · Baseline references an unmapped group
**Channels:** Entra, PowerShell, AI Info (3 channels — visible despite On Hold)

## Step-specific fixes

### S-SL-1: Planned work banner present — remove
**Current:** "Planned work" banner above the channel tabs.
**Target:** Remove per U4. Channels remain visible. Copy disabled with tooltip per U18.

### S-SL-2: Channels already visible — good
Unlike most On Hold steps (which show "Nothing to submit yet"), this one shows its Implementation channels. This is the correct behavior per U14. No change.

### S-SL-3: This is a policy pair — verify coverage
Per the playbook, this step covers two CA policies (the "unmanaged member" lacks a stable baseline ID, noted as a known projection problem in the playbook). The Implementation channels should address both policies:
- Policy 1: Sign-in frequency for all users (the "main" policy).
- Policy 2: Persistent browser session control (the "pair member").
**Implementation for Claude Code:** Read the Entra and PS channel content. If only one policy is addressed, the content needs to be expanded to cover both. This is a per-step content item.

### S-SL-4: No Source checked
Add `checkedOn` to the package META `verifiedSources` array. Format: `"YYYY-MM-DD"`.

### S-SL-5: ID mismatch between runtime and playbook
**Current:** The runtime uses `s-goal-all-users-no-persistence` but the playbook historically called it `s-goal-session-lifetime`. A1a was supposed to align the playbook's §10.0 to the runtime id.
**Target:** Verify that `dependency-data.json` uses `s-goal-all-users-no-persistence` and that no other file references the old `s-goal-session-lifetime` id. If any do, update them. This is a consistency check, not a feature change.

### S-SL-6: No Learn link in Why
Add inline Learn link to the Microsoft Learn page on Conditional Access session controls.

### S-SL-7: Row subtitle — remove
Per U9.

### S-SL-8: Done-when needs to be specific
Replace generic text with: "Both policies are enforced with the baseline's session control values (sign-in frequency and persistent browser settings), with the exclusions group applied."

## Universal items
U4, U7, U9, U18, U25, U26.

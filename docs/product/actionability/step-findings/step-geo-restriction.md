# Step findings: Block Sign-ins From Countries Not Allowed

**Step ID:** `s-goal-geo-restriction`
**Archetype:** CA policy (On Hold — unmapped group, with conditional enforcement dependencies)
**Current state:** On Hold · Baseline references an unmapped group
**Channels:** Entra, PowerShell, JSON, AI Info, Email (5 channels)

## Step-specific fixes

### S-GR-1: Planned work banner present — remove
**Current:** "Planned work" banner above the channel tabs.
**Target:** Remove per U4. Channels remain visible. Copy disabled with tooltip per U18.

### S-GR-2: Two conditional enforcement dependencies
**Current:** Per the playbook, this step has two conditional enforcement edges that gate whether the policy can safely be enforced:
- `partner-accounts-exist`: from the partner/MSP accounts question. If partners exist, they need an exception in the policy.
- `travel-exceptions-allowed`: from the travel question on the Allowed Countries step. If people travel, the geo-restriction policy needs a travel exception mechanism.
Both conditions are resolved by admin answers on their respective steps (Guests MFA for partner, Allowed Countries for travel). Per U28, both require explicit Save before this step can proceed to enforcement.
**Target:** When this step reaches Ready (after the mapping resolves), the readiness tiles should show the state of both conditions: "Partner accounts: [answered/not answered]" and "Travel exceptions: [answered/not answered]." If either is unanswered, the step cannot reach Ready-to-enforce.
**Implementation for Claude Code:** The conditions are already in the dependency graph as conditional edges. The readiness tile renderer needs to include tiles for conditional enforcement edges that are unresolved. Check whether `engineTiles` already produces tiles for these conditions; if not, add them. The tile label should be the condition name in human-readable form: "Partner accounts" and "Travel exceptions."

### S-GR-3: No Source checked
Add `checkedOn` to the package META `verifiedSources` array. Format: `"YYYY-MM-DD"`.

### S-GR-4: Has Email channel — keep
User notification about country restrictions. Appropriate.

### S-GR-5: BASELINE MAPPING tile present — good
Correct On Hold presentation.

### S-GR-6: No Learn link in Why
Add inline Learn link to the Microsoft Learn page on Conditional Access location conditions and named locations.

### S-GR-7: Row subtitle — remove
"Baseline references an unmapped group" — remove per U9.

### S-GR-8: Done-when needs to be specific
Replace generic text with: "The policy is enforced, blocking sign-ins from countries not in the allowed list, with the exclusions group applied, and partner/travel exceptions addressed."

## Universal items
U4, U7, U9, U18, U25, U26, U28.

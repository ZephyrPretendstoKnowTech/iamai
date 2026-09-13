# Step findings: Require MFA to Register a Device

**Step ID:** `s-goal-device-registration-mfa`
**Archetype:** CA user-action policy (On Hold — unmapped group)
**Current state:** On Hold · Baseline references an unmapped group
**Channels:** Entra, PowerShell, JSON, AI Info (4 channels)

## Step-specific fixes

### S-DR-1: Planned work banner present — remove
**Current:** "Planned work" banner above the channel tabs.
**Target:** Remove per U4. Channels remain visible. Copy disabled with tooltip per U18.

### S-DR-2: THRESHOLD tile present — verify state-awareness
Shows MFA readiness threshold with gate language. Per U22, the text must be state-aware when this policy eventually gets enforced. Currently the step is On Hold so U22 doesn't fire yet, but the tile logic should be ready for when it does.

### S-DR-3: BASELINE MAPPING tile present — good
Shows the unmapped group reference with "Open Baseline mappings." Correct On Hold presentation.

### S-DR-4: Source checked present ✓
"Source checked Sep 10, 2026." No change.

### S-DR-5: User-action scope and Report-only limitation
Per playbook V9, Microsoft does not evaluate user-action CA policies (those targeting "Register security information" or "Register or join devices") in Report-only mode. The observation predicate for this step should NOT rely on sign-in evidence from Report-only. Instead, use pilot-scope validation: enable the policy for a pilot group, verify device registration works for that group, then expand to all users.
**Implementation for Claude Code:** In the step's observation logic (the evidence predicate in the engine), check if the policy targets a user action. If yes, the observation window should require a human confirmation ("Pilot tested") rather than automated sign-in evidence. This may require a new gate type: `pilotValidation` as distinct from `signInEvidence`. If this is too complex for Batch B, defer to the per-step pass but document it clearly.

### S-DR-6: 10 tiles — dense
After U6 (compact/expand), verify the compact pattern works with 10 tiles. On a 680px-wide step body, 10 collapsed tiles at ~48px each would stack to ~480px of tile content. That's a lot but acceptable if they're compact. Test visually.

### S-DR-7: No Learn link in Why
Add inline Learn link.

### S-DR-8: Row subtitle — remove
Per U9.

### S-DR-9: Done-when needs to be specific
Replace generic text if it says "The policy is enforced in GetIAMAI" with: "The policy is enforced, requiring MFA for device registration, with the exclusions group applied and pilot validation complete."

## Universal items
U4, U6, U7, U9, U18, U22, U25, U26.

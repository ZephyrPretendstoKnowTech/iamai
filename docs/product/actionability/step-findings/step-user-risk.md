# Step findings: Remediate High-Risk Users

**Step ID:** `s-goal-user-risk`
**Archetype:** CA policy (On Hold — unmapped group, Enforced)
**Current state:** On Hold · Baseline references an unmapped group, Enforced chip
**Channels:** None (zero — "Nothing to submit yet")

## Step-specific fixes

### S-UR-1: Enforced + On Hold + zero channels — worst combination
The policy is live on the tenant but IAMAI shows nothing about it. No Entra instructions, no JSON, nothing. After universals: U14 makes channels visible; U20/U21 changes the lane to Completed (if no drift after mapping resolves) or Ready · Correct (if drift).

### S-UR-2: Content authoring gap — High-Risk has zero channels, Medium-Risk has four
**Decision (confirmed by Lachlan):** This is a content gap, not intentional. Both user-risk steps should have the same channel availability. During the per-step content pass, author Entra, PowerShell, JSON, and AI Info channels for this package, mirroring the Medium-Risk package's channel structure but with the High-Risk threshold configuration.
**Implementation for Claude Code:** Copy the channel structure from `s-goal-user-risk-medium` CONTENT.md to `s-goal-user-risk` CONTENT.md, adjusting the risk level from medium to high in the policy configuration. The Entra instructions, PowerShell script, and JSON body should target the high-risk threshold.

### S-UR-3: Source checked present ✓
"Source checked Sep 10, 2026." No change.

### S-UR-4: Identity Protection P2 licensing
This step requires Entra ID P2 for risk-based policies. On this tenant the policy is enforced, so P2 is present. The `license/platform` blocker exists in the step's readiness but doesn't fire here. Correct behavior. No change.

### S-UR-5: Hybrid user readiness item
Per the playbook, if the tenant has hybrid users (on-prem AD synced), the remediation path (password change) requires password writeback to be configured. This should appear as a readiness tile when: (a) the tenant has hybrid users (detectable from the scan's user source data), AND (b) SSPR with password writeback is not configured. Currently no such tile exists. Add as a per-step content item.

### S-UR-6: Done-when
**Current:** "The policy is enforced in GetIAMAI."
**Target:** "The policy is enforced, matches the baseline's target, and the remediation path (password change) is confirmed to work for hybrid users if any exist."

## Universal items
U7 (suppress transitive tiles), U9 (row subtitle), U14 (channels always visible), U19, U20/U21, U25 (Learn link), U26 (source checked already present).

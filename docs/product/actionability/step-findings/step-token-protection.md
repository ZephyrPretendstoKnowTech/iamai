# Step findings: Require Token Protection on Windows

**Step ID:** `s-goal-token-protection`
**Archetype:** CA policy (enforced, with drift)
**Current state:** Ready · Observing, Enforced
**Channels:** None (zero — "Nothing to submit yet")

## Step-specific fixes

### S-TP-1: Same enforced-policy core problem
Zero Implementation channels. After universals (U14, U19, U20, U21): Completed or Correct with visible channels.

### S-TP-2: Source checked present ✓
"Source checked Sep 10, 2026." No change.

### S-TP-3: No Learn link in Why
**Current:** No "Learn →" at the end of the Why sentence.
**Target:** Add ` Learn →` (with a space before "Learn") as an inline link at the end of the Why paragraph text, linking to the relevant Microsoft Learn page. The URL is found by the content author during the per-step content pass by searching learn.microsoft.com for the policy type. In the package CONTENT.md, append the link to the `why` field text. The renderer already supports inline links in Why text (verified on the Devices step which has one).

### S-TP-4: Done-when trivially satisfied
**Current:** "The policy is enforced in GetIAMAI."
**Target:** Include matching the baseline target configuration.

### S-TP-5: Unique compatibility concern — add a readiness tile
**Current:** No readiness tile for client compatibility. Token protection only works on Windows devices with supported apps (currently Office desktop apps and some Edge scenarios). Non-Windows devices and unsupported apps fail silently or fall back.
**Target:** Add a readiness tile showing: "X% of sign-ins from compatible clients" based on the scan's sign-in data (device platform + app). This is informational before enforcement and becomes a gate at enforcement time. Similar pattern to the THRESHOLD tile on MFA policies.
**Implementation for Claude Code:** This is a per-step content and evaluation addition. The scan already reads sign-in records with device/app data. Add a compatibility evaluator that checks whether sign-ins come from Windows + supported apps, and expose the percentage as a readiness tile. Add the tile kind to the package META. The tile text follows U22 (state-aware): informational on enforced, gate on unenforced.

### S-TP-6: Exclusion-group data accuracy
Same investigation as all enforced policies (U27).

### S-TP-7: Suppress transitive tiles, milestone, row subtitle
Per U7, U3, U9.

## Universal items
U7, U9, U14, U19, U20/U21, U25, U26 (already present), U27.

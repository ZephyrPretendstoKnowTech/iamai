# Step findings: Require MFA for Everyone

**Step ID:** `s-goal-mfa-all-users`
**Archetype:** CA policy (enforced, with drift, threshold-gated)
**Current state:** Ready · Observing, Enforced
**Channels:** None (zero — "Nothing to submit yet")

## Step-specific fixes

### S-ME-1: Same enforced-policy core problem
Zero channels. After universals: Completed or Correct with visible channels.

### S-ME-2: THRESHOLD tile present
Shows the MFA readiness percentage with gate language. Per U22, the threshold text must be state-aware: on this enforced policy, it should be informational ("X% have MFA") not a gate ("enforcement waits for X%").

### S-ME-3: Exclusion-group data accuracy
Same as all enforced policies (U27).

### S-ME-4: No Learn link in Why
**Current:** No "Learn →" at the end of the Why sentence.
**Target:** Add ` Learn →` (with a space before "Learn") as an inline link at the end of the Why paragraph text, linking to the relevant Microsoft Learn page. The URL is found by the content author during the per-step content pass by searching learn.microsoft.com for the policy type. In the package CONTENT.md, append the link to the `why` field text. The renderer already supports inline links in Why text (verified on the Devices step which has one).

### S-ME-5: No Source checked
Add `checkedOn` to the package META `verifiedSources` array. Set the date to the date the Implementation content was last verified against current Microsoft documentation. If authoring new content, use the current date. Format: `"YYYY-MM-DD"`. The renderer (added in A4) already shows this field when present.

### S-ME-6: Done-when trivially satisfied
**Current:** "The policy is enforced in GetIAMAI."
**Target:** Include: matching the baseline target, exclusions group applied.

### S-ME-7: This policy gates the per-user MFA cleanup
`s-prereq-per-user-mfa` depends on `s-goal-mfa-all-users@enforced`. If this step reaches Completed (enforced, no drift), the per-user MFA cleanup should become Ready. This dependency chain should work after U20 makes enforced-no-drift = Completed. Verify during testing.

### S-ME-8: Suppress transitive tiles, milestone, row subtitle
Per U7, U3, U9.

## Universal items
U7, U9, U14, U19, U20/U21, U22 (threshold state-aware), U25, U26, U27.

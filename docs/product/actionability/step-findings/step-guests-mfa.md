# Step findings: Require MFA for Guests

**Step ID:** `s-goal-guests-mfa`
**Archetype:** CA policy (enforced, with drift, conditional input)
**Current state:** Ready · Observing, Enforced
**Channels:** None (zero — "Nothing to submit yet")

## Step-specific fixes

### S-GM-1: Same enforced-policy core problem
Zero channels. After universals: Completed or Correct with visible channels.

### S-GM-2: Has a "What to do" section — contains the partner question
**Current:** What to do is present. It likely contains the partner/MSP question (`partner-accounts-exist` condition) asking whether the tenant has partner accounts that need a carve-out from the guest MFA policy.
**Target:** Remove What to do (U1). The partner question moves to the action column (U2). Per U28, the admin must explicitly save an answer (even "no partner accounts") before the step can reach Completed or Ready-to-enforce.
**Implementation for Claude Code:** The partner input currently renders in the What-to-do section. After U1 removes that section, the input's parent component must be the action column. The plan record field `decisions.partnerAccounts` must be non-null for the completion gate to clear.

### S-GM-3: Exclusion-group data accuracy
Same as all enforced policies (U27).

### S-GM-4: No Learn link in Why
**Current:** No "Learn →" at the end of the Why sentence.
**Target:** Add ` Learn →` (with a space before "Learn") as an inline link at the end of the Why paragraph text, linking to the relevant Microsoft Learn page. The URL is found by the content author during the per-step content pass by searching learn.microsoft.com for the policy type. In the package CONTENT.md, append the link to the `why` field text. The renderer already supports inline links in Why text (verified on the Devices step which has one).

### S-GM-5: No Source checked
Add `checkedOn` to the package META `verifiedSources` array. Set the date to the date the Implementation content was last verified against current Microsoft documentation. If authoring new content, use the current date. Format: `"YYYY-MM-DD"`. The renderer (added in A4) already shows this field when present.

### S-GM-6: Done-when
**Current:** "The policy is enforced in GetIAMAI."
**Target:** Include: matching the baseline target, partner accounts addressed.

### S-GM-7: Suppress transitive tiles, milestone, row subtitle
Per U7, U3, U9.

## Universal items
U1 (remove What-to-do), U2 (partner input → action column), U7, U9, U14, U19, U20/U21, U25, U26, U27, U28 (partner question requires explicit confirmation).

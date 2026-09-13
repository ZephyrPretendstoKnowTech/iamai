# Step findings: Shorten Admin Sessions

**Step ID:** `s-goal-admin-session`
**Archetype:** CA policy (enforced, with drift)
**Current state:** Ready · Observing, Enforced
**Channels:** None (zero — "Nothing to submit yet")

## Step-specific fixes

### S-SH-1: Same enforced-policy core problem
Badge "Ready · Observing" with chip "Enforced." Implementation shows "Nothing to submit yet." After universals (U14, U19, U20, U21): Completed if no drift, Ready · Correct if drift exists, with visible Implementation channels showing the correction (e.g. add the exclusion group, adjust the session control value to match the baseline).

### S-SH-2: Exclusion-group data accuracy
Same investigation as all enforced policies (U27). The policy may already have the "Breakglass Exclusion" group in its exclusion list in Entra. If it does, the prerequisite tile should reflect that.

### S-SH-3: No Learn link in Why
**Current Why:** "A stolen admin session is worth as long as it lasts; [short session] is long enough to work and short enough to limit the damage."
**Target:** **Current:** No "Learn →" at the end of the Why sentence.
**Target:** Add ` Learn →` (with a space before "Learn") as an inline link at the end of the Why paragraph text, linking to the relevant Microsoft Learn page. The URL is found by the content author during the per-step content pass by searching learn.microsoft.com for the policy type. In the package CONTENT.md, append the link to the `why` field text. The renderer already supports inline links in Why text (verified on the Devices step which has one).

### S-SH-4: No Source checked
Add `checkedOn` to the package META `verifiedSources` array. Set the date to the date the Implementation content was last verified. Format: `"YYYY-MM-DD"`. The renderer already shows this field.

### S-SH-5: Done-when trivially satisfied
**Current:** "The policy is enforced in GetIAMAI." Already true.
**Target:** "The policy is enforced with the baseline's session control (sign-in frequency and persistent browser settings), and the exclusions group is applied."

### S-SH-6: Milestone repeats lane
**Current:** "Ready · Observing / after: Create or Correct Exclusions Group."
**Target:** Date only, or a specific action.

### S-SH-7: Impact "Not established"
Correct while the unmapped group is unresolved. After resolution, the impact should populate with the admin count.

### S-SH-8: Suppress transitive Emergency Access tile
Per U7.

## Universal items
U7 (suppress transitive tiles), U9 (row subtitle "after: Create or Correct Exclusions Group"), U14, U19, U20/U21, U25, U26, U27.

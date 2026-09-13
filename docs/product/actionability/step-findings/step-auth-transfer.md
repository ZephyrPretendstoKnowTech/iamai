# Step findings: Block Authentication Transfer

**Step ID:** `s-goal-block-auth-transfer`
**Archetype:** CA policy (enforced, with drift)
**Current state:** Ready · Observing, Enforced
**Channels:** None (zero — "Nothing to submit yet")

## Step-specific fixes

### S-AT-1: Enforced policy with zero channels — the core enforced-policy problem
**Current:** Badge "Ready · Observing" with chip "Enforced." Implementation shows "Nothing to submit yet / IAMAI offers no artifact for this policy as it stands." The policy is live on the tenant, protecting against authentication transfer attacks, but IAMAI provides no guidance about it.
**Target after universals:** If the policy matches the baseline target (no drift) → lane changes to Completed. If it has drift (e.g. missing exclusion group) → lane changes to Ready · Correct, Implementation channels become visible showing the correction. This is handled by U14 (channels always visible), U19 (correction before prerequisite hold), U20 (enforced no-drift = Completed), U21 (enforced with drift = Correct).

### S-AT-2: Exclusion-group data accuracy
Same investigation as all enforced policies (U27). The policy may already have the "Breakglass Exclusion" group in Entra. If it does, the prerequisite tile should reflect that.

### S-AT-3: No Learn link in Why
**Current Why:** Check the actual Why text on the tenant (it wasn't captured due to the sensitive-key filter, but the step is about blocking authentication transfer — the attack where an attacker moves an authenticated session from one device to another).
**Target:** **Current:** No "Learn →" at the end of the Why sentence.
**Target:** Add ` Learn →` (with a space before "Learn") as an inline link at the end of the Why paragraph text, linking to the relevant Microsoft Learn page. The URL is found by the content author during the per-step content pass by searching learn.microsoft.com for the policy type. In the package CONTENT.md, append the link to the `why` field text. The renderer already supports inline links in Why text (verified on the Devices step which has one).

### S-AT-4: No Source checked
Add `checkedOn` to the package META `verifiedSources` array. Set the date to the date the Implementation content was last verified. Format: `"YYYY-MM-DD"`. The renderer already shows this field.

### S-AT-5: Done-when trivially satisfied
**Current:** "The policy is enforced in GetIAMAI." Already true.
**Target:** "The policy is enforced and matches the baseline's target configuration, with the exclusions group applied."

### S-AT-6: Milestone repeats lane
**Current:** "Ready · Observing / after: Create or Correct Exclusions Group."
**Target:** Date only, or a specific action like "Correct the policy exclusions."

### S-AT-7: Suppress transitive Emergency Access tile
Per U7, only the direct prerequisite (Exclusions Group) should show as a tile.

## Universal items
U7, U9 (row subtitle "after: Create or Correct Exclusions Group"), U14, U19, U20/U21, U25, U26, U27.

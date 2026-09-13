# Step findings: Block Device Code Sign-in

**Step ID:** `s-goal-block-device-code`
**Archetype:** CA policy (enforced, with drift)
**Current state:** Ready · Observing, Enforced
**Channels:** None (zero — "Nothing to submit yet")

## Step-specific fixes

### S-DC-1: Same enforced-policy core problem
Badge "Ready · Observing" with chip "Enforced." Zero Implementation channels. After universals (U14, U19, U20, U21): Completed if no drift, Ready · Correct if drift exists, with visible Implementation channels.

### S-DC-2: Exclusion-group data accuracy
Same investigation as all enforced policies (U27).

### S-DC-3: No Learn link in Why
**Current:** No "Learn →" at the end of the Why sentence.
**Target:** Add ` Learn →` (with a space before "Learn") as an inline link at the end of the Why paragraph text, linking to the relevant Microsoft Learn page. The URL is found by the content author during the per-step content pass by searching learn.microsoft.com for the policy type. In the package CONTENT.md, append the link to the `why` field text. The renderer already supports inline links in Why text (verified on the Devices step which has one).

### S-DC-4: No Source checked
Add `checkedOn` to the package META `verifiedSources` array. Set the date to the date the Implementation content was last verified against current Microsoft documentation. If authoring new content, use the current date. Format: `"YYYY-MM-DD"`. The renderer (added in A4) already shows this field when present.

### S-DC-5: Done-when trivially satisfied
**Current:** "The policy is enforced in GetIAMAI."
**Target:** Include matching the baseline target.

### S-DC-6: Unique operational concern — device-code workflows
**Current:** No conditional input asking about legitimate device-code usage. Device code flow is used by Azure CLI, some IoT workflows, and display-limited devices. Blocking it without checking breaks these.
**Target:** Add a conditional input (same pattern as the mail-device question on Legacy Auth) asking the admin: "Does anyone use device code sign-in for CLI tools, IoT devices, or display-limited devices?" with options None / Yes: add exceptions. Per U28, the admin must confirm before the step can reach Ready-to-enforce or Completed.
**Implementation for Claude Code:** This is a per-step content addition. Add a `decisions.deviceCodeWorkflows` field to the plan record. The step's completion evaluator checks this field is not null. The input renders in the action column (U2). The condition `device-code-workflows-exist` is added to the dependency graph as a conditional enforcement edge on this step, same pattern as `mail-devices-incompatible-path` on Legacy Auth.

### S-DC-7: Suppress transitive tiles, milestone, row subtitle
Per U7, U3, U9.

## Universal items
U7, U9, U14, U19, U20/U21, U25, U26, U27, U28 (new conditional input S-DC-6).

# Content spec: Review Baseline Policies IAMAI Did Not Assess

**Step ID:** `cleanup-notAssessed`
**Package:** `docs/implementation-content/cleanup-notAssessed/`

---

## Header

- Step type label: None visible — this step does not show a "POLICY STEP" or "PREPARATION STEP" label.

CURRENT →
(no step type label)

TARGET →
CLEANUP STEP

Reason: Every other step has a type label. This one should show "CLEANUP STEP" to match the `cleanup-` prefix in its ID and help the tech understand it's a review/resolution task, not a policy to create.

- Title: Review Baseline Policies IAMAI Did Not Assess — No change.
- Badge: Ready · Create — No change.

---

## Why

CURRENT →
These baseline policies carry conditions IAMAI cannot compare (device filters, authentication contexts, workload identities, agent policies), so their status is yours to judge. Learn →

TARGET →
No change. Clear — explains why these policies are separated out and what the tech needs to do.

---

## Readiness tiles

No readiness tiles present — No change. This is a cleanup/review step with no prerequisites or affected-people calculation.

---

## Readiness bar

No readiness bar present — No change. Correct for a cleanup step.

---

## Milestone / action column

No milestone column present — No change. Cleanup steps don't have milestone dates.

---

## Implementation

This step has a unique structure — no Entra/PowerShell/JSON/AI Info tabs. Instead, it has inline instructions followed by a list of 7 policies with individual Save buttons.

### Instructions

CURRENT →
Open each and decide whether it applies: IAC - APP - BLOCK - SharePoint-OneDrive-NonTrustedLocations, IAC - APP - inforcer - RequireMFA, IAC - APP – BLOCK – AVD - Exclude - AllowedAVDUsers, IAC - APP – BLOCK – AVD - NonTrustedLocations, IAC - GLOBAL - GRANT - MFA - WindowsAzureAD-BaselineScopes, IAC - AGENT - BLOCK - HighRiskAgent, IAC - AGENT - BLOCK - NonTrustedAgents

Where it does, create it from its JSON and put it in report-only.

TARGET →
The baseline includes these 7 policies, but IAMAI cannot compare them automatically (they use device filters, authentication contexts, workload identities, or agent conditions that IAMAI does not assess). Review each one and decide whether it applies to your tenant:

1. IAC - APP - BLOCK - SharePoint-OneDrive-NonTrustedLocations
2. IAC - APP - inforcer - RequireMFA
3. IAC - APP – BLOCK – AVD - Exclude - AllowedAVDUsers
4. IAC - APP – BLOCK – AVD - NonTrustedLocations
5. IAC - GLOBAL - GRANT - MFA - WindowsAzureAD-BaselineScopes
6. IAC - AGENT - BLOCK - HighRiskAgent
7. IAC - AGENT - BLOCK - NonTrustedAgents

If a policy applies, create it from its JSON definition and set it to Report-only. If it does not apply, mark it below.

Reason: The current text runs the policy names together in a comma-separated block. A numbered list is easier to scan. Added context about why IAMAI can't assess them (from the Why section, reinforced here).

### Per-policy controls

Each of the 7 policies has a Save button — No change. This lets the tech mark each one individually.

---

## Done when

No explicit Done When section visible — this step uses per-policy Save buttons and a "Does not apply here" button instead.

TARGET →
No change needed. The step's completion is tracked by the individual policy saves.

---

## Links

- Learn → link present. ✓ (Verify URL points to baseline documentation.)

---

## Buttons

- Does not apply here: Present. ✓ — Correct for a cleanup step where the entire set of policies may not be relevant.
- Per-policy Save buttons (7): Present. ✓
- Scan to update the plan: Verify present.
- Defer this step: Not visible. Could be appropriate here but not critical.

---

## Global issues

- Missing step type label — should show "CLEANUP STEP" (see Header above).
- No C2/C6/C7/C12 issues — this step doesn't have the standard Implementation tabs or milestone column, so the common global issues don't apply.

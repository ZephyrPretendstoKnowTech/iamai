# Step findings: Restrict the Entra Connect Sync Account to Its Address

**Step ID:** `s-goal-workload-identity-block`
**Archetype:** Conditional / identity-type-dependent
**Current state:** Not licensed (shown in collapsed "Not licensed (1)" section)

## Step-specific fixes

### S-WI-1: This step should not exist on this tenant
**Decision (confirmed by Lachlan):** This tenant does not use Entra Connect or Cloud Sync. There is no sync connector and no sync account to restrict. The step should not generate.
**Current:** The step generates and appears in a "Not licensed (1)" collapsed section with text: "needs a licence this tenant does not hold: Microsoft Entra Workload ID Premium."
**Target:** The step generator should check whether the tenant has an Entra Connect or Cloud Sync connector. If no connector exists, the step is not generated and does not appear anywhere — not in the plan, not in the "Not licensed" section.
**Implementation for Claude Code:** In the step generator (`generate.ts` or `registry.ts`), add a condition for the workload-identity step: only generate when the scan detects a directory synchronization account (a user holding the Directory Synchronization Accounts role) or a Cloud Sync service principal. The scan already reads role assignments (`roles.ts`); check whether any user holds `d29b2b05-8046-44ba-8758-1e26182fcf32` (Directory Synchronization Accounts role ID — verify the GUID against the Microsoft documentation) or equivalent. If none exists, skip generation entirely.

### S-WI-2: The "Not licensed" section should not show for a step that shouldn't generate
After S-WI-1, this step doesn't generate, so the "Not licensed (1)" section disappears from the plan (assuming no other step is in that section). If other unlicensed steps exist, the section stays for them. The fix is in generation, not in the section renderer.

## No universal items apply — the step is removed from this tenant.

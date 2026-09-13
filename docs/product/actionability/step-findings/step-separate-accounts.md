# Step findings: Use Separate Accounts for Admin Work

**Step ID:** `s-check-separate-admin-accounts`
**Archetype:** Check / hygiene
**Current state:** Ready · Create
**Channels:** None
**Impact:** "Admin" (shows the word, not a count)

## Step-specific fixes

### S-SA-1: No Implementation channels
This step has zero channels — no Entra, no AI Info. Per U14, Implementation should always be visible. For a check step, the Entra channel should explain: how to create the separate admin account (Entra admin center → Users → New user), how to move the role, and how to register a passkey on it. This content currently lives in the What-to-do section numbered list. After U1 removes What-to-do, it needs a home in Entra.

### S-SA-2: What to do section present — remove
Contains a detailed per-person checklist: create cloud-only admin account, move directory role, register passkey, keep mail/Teams on the everyday account. This is Implementation content, not "What to do." Move to Entra channel.

### S-SA-3: Impact shows "Admin" (a word, not a count)
Per U12, impact should show counts: "1 admin" or "2 admins". "Admin" as a bare word is ambiguous — is it one admin? The admin role? Per U13's fallback, if the count is available (the tile says "1 active person · 1 admin"), show "1 admin" on the row.

### S-SA-4: Learn link present in Why ✓
"Learn →" is inline. No change needed.

### S-SA-5: No Source checked
Add `checkedOn` to the package META `verifiedSources` array. Set the date to the date the Implementation content was last verified against current Microsoft documentation. If authoring new content, use the current date. Format: `"YYYY-MM-DD"`. The renderer (added in A4) already shows this field when present.

### S-SA-6: Milestone sub-text
"Check it did what it should." This is borderline — it's generic but describes the actual next action for a check step. Replace with "Verify admin accounts are separated" or leave as-is. Minor.

## Universal items: U1, U2 (no inputs to move; action column shows only milestone), U13, U14, U25 (already present), U26.

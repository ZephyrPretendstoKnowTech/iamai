# Step findings: Set Up Passkeys to Match the Baseline

**Step ID:** `s-prereq-passkey-settings`
**Archetype:** Foundation object (new in A5)
**Current state:** Ready · Create
**Channels:** Entra, PowerShell, AI Info

## Step-specific fixes

### S-PK-1: Remove PowerShell channel
Per U15, non-policy foundation steps get Entra and AI Info only. Passkey settings are portal toggles.

### S-PK-2: No Learn link in Why
Why: "A passkey registered under the wrong settings is refused later by the strength the baseline requires, and has to be rebuilt." No Learn link. Add inline link to the Microsoft Learn page on enabling passkeys.

### S-PK-3: Milestone sub-text filler
Milestone: "Make the object this step names." Remove per U3.

### S-PK-4: Impact "Configuration only"
Replace per U13 with "Authentication methods" or "Passkey settings".

### S-PK-5: Source checked present ✓
Shows "Source checked Sep 12, 2026". No change needed.

### S-PK-6: No What to do section ✓
Already absent. No change needed.

### S-PK-7: Readiness clear ✓
Shows "Clear / Nothing outstanding changes the next action." Correct for a fresh tenant with no passkey config. No change.

### S-PK-8: Done-when content review
"Passkey (FIDO2) is enabled for all users with attestation enforced and an allow-list holding the two Authenticator identifiers and every registered key. Microsoft Authenticator and Temporary Access Pass are enabled for all users." This is good — specific and verifiable. Keep. Minor: "the two Authenticator identifiers" could name them explicitly for clarity.

## Universal items: U1 (no What-to-do, already absent), U2 (no inputs on this step, action column shows only milestone), U3 (milestone filler), U4 (no Planned work banner, already absent), U13 (impact), U14 (channels already visible), U15 (remove PowerShell), U25 (Learn link).

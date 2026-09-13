# Step findings: Define the Trusted Network

**Step ID:** `s-prereq-trusted-location`
**Archetype:** Foundation object with owner input (IP range input)
**Current state:** Ready · Create
**Channels:** Entra, PowerShell, AI Info

## Step-specific fixes

### S-TN-1: Remove PowerShell channel
Per U15. Creating a named location is a portal form.

### S-TN-2: What to do section present — remove
Contains detailed instructions on finding the office IP and creating the location, plus a trusted-network input field with Save. The IP-finding guidance is Implementation content (move to Entra channel). The input field moves to the action column (U2). The generic "Make the object this step names." is deleted.

### S-TN-3: Planned work banner present — remove
Shows "Nothing blocks this step, but IAMAI cannot fill in every value yet, so this cannot be copied. Values still to resolve: trusted IP ranges." Remove per U4. The Copy button is disabled with tooltip "IP ranges not confirmed" per U18.

### S-TN-4: No Learn link in Why
Why: "Some baseline policies relax inside the network your team usually signs in from, and that network has to be named before they can." Add inline Learn link.

### S-TN-5: Milestone sub-text filler
"Make the object this step names." Remove per U3.

### S-TN-6: Impact "Configuration only"
Replace per U13 with "Network locations" or "Trusted network".

### S-TN-7: No Source checked
Add `checkedOn` to the package META `verifiedSources` array. Set the date to the date the Implementation content was last verified against current Microsoft documentation. If authoring new content, use the current date. Format: `"YYYY-MM-DD"`. The renderer (added in A4) already shows this field when present.

### S-TN-8: "Doesn't apply here" button present ✓
Correct — a tenant with no office network can dismiss this step. Keep.

### S-TN-9: Duplicate implementation content
The What-to-do section and the Implementation Entra channel both contain similar step-by-step instructions for creating the location. After U1 removes What-to-do, only the Entra channel remains. Verify the Entra channel has the complete instructions including the IP-finding guidance currently in What-to-do.

## Universal items: U1, U2 (IP input → action column), U3, U4, U13, U15, U18, U25, U26.
